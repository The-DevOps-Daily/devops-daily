---
title: 'The Anatomy of Kubernetes Persistent Storage: PV, PVC and the Parts That Bite'
excerpt: 'A PersistentVolumeClaim is a request and a PersistentVolume is the thing you get. That part takes five minutes to learn. The lifecycle rules underneath, which decide whether deleting a claim also deletes your data, are where teams lose production volumes.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2026-08-19'
publishedAt: '2026-08-19T09:00:00Z'
updatedAt: '2026-08-19T09:00:00Z'
readingTime: '16 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Kubernetes
  - Storage
  - StatefulSets
  - CSI
  - DevOps
---

Most explanations of Kubernetes storage stop at the analogy. A PersistentVolumeClaim is a request, a PersistentVolume is the thing you get, and a StorageClass describes how to make one. That is correct, it takes about five minutes to learn, and it will not help you at three in the morning when a claim has been sitting in `Terminating` for twenty minutes and nobody can explain why.

The parts that actually cost people data are in the lifecycle: who deletes what, when, and what survives. A default you never chose decides whether removing a PVC also destroys the disk behind it. An access mode that reads like a lock is not enforced at all. A volume you carefully set to `Retain` will sit in `Released` refusing every new claim until you edit a field nobody told you about.

This post is the anatomy: the five objects, how they bind, and the seven behaviours that surprise people. Every rule here is checked against the upstream Kubernetes documentation, and the exact strings and version numbers are quoted so you can verify them rather than take my word for it.

## TLDR

- **`ReadWriteOnce` means one node, not one pod.** Several pods on the same node can all mount an RWO volume read-write. `ReadWriteOncePod` is the one that means what people assume RWO means.
- **Access modes are not enforced.** Upstream says plainly that RWO, ROX and RWX "don't set any constraints on the volume". Only `ReadWriteOncePod` is a real constraint.
- **`reclaimPolicy` defaults to `Delete`.** For dynamically provisioned volumes, deleting the PVC deletes the disk and the data on it.
- **A PVC stuck in `Terminating` is usually working correctly.** The `kubernetes.io/pvc-protection` finalizer holds it until no pod is using it.
- **`Retain` does not mean reusable.** The PV goes to `Released` and will not bind again while its `claimRef` is set.
- **Volume expansion is one way.** You can grow a PVC, never shrink it, and editing the PV's capacity by hand stops the resize from happening at all.
- **StatefulSet PVCs outlive the StatefulSet by default.** `persistentVolumeClaimRetentionPolicy` changes that, and it went GA in Kubernetes v1.32.

## Prerequisites

- A Kubernetes cluster you can create and delete objects in, ideally not a production one
- `kubectl` configured against it
- Familiarity with pods and either Deployments or StatefulSets
- A CSI driver installed if you want to try dynamic provisioning, which is the default on every managed cloud offering

## The five objects

Kubernetes storage is often described as two objects. It is really five, and the two that get left out are the ones that decide what happens to your data.

```diagram
{
  "type": "graph",
  "title": "Who creates what, and what binds to what",
  "columns": [
    [
      { "id": "pod", "label": "Pod", "sub": "mounts a claim by name", "icon": "pod", "tone": "slate" },
      { "id": "sc", "label": "StorageClass", "sub": "cluster-wide: the recipe", "icon": "gear", "tone": "violet", "detail": "Holds provisioner, reclaimPolicy, allowVolumeExpansion and volumeBindingMode. The defaults here decide whether your data survives." }
    ],
    [
      { "id": "pvc", "label": "PersistentVolumeClaim", "sub": "namespaced: the request", "icon": "box", "tone": "blue", "detail": "Says how much, which access mode, which class. Lives in a namespace next to the pod." }
    ],
    [
      { "id": "pv", "label": "PersistentVolume", "sub": "cluster-wide: the resource", "icon": "database", "tone": "green", "detail": "Not namespaced. Bound one-to-one to a single PVC via claimRef." }
    ],
    [
      { "id": "disk", "label": "Backing disk", "sub": "EBS, PD, Ceph RBD, NFS", "icon": "cloud", "tone": "slate", "detail": "The real storage asset outside Kubernetes. Whether it is deleted with the PV is the reclaim policy's job." }
    ]
  ],
  "edges": [
    ["pod", "pvc", "mounts"],
    ["pvc", "pv", "binds 1:1"],
    ["sc", "pv", "provisions"],
    ["pv", "disk", "maps to"]
  ]
}
```

The split worth internalising is **namespaced versus cluster-wide**. A PVC lives in a namespace, belongs to a team, and is deleted when that namespace is deleted. A PV and a StorageClass are cluster objects owned by whoever runs the cluster. Deleting a namespace therefore deletes claims, and what that does to the underlying disks depends entirely on a policy set by someone else.

The fifth object, which you rarely write by hand, is the **CSI driver**. It is the thing that actually calls the cloud API to create a disk and attaches it to a node. When storage misbehaves in ways the objects above cannot explain, the driver's controller and node pods are where the answer is.

## PV vs PVC: supply and demand

The cleanest way to hold the distinction is that a **PVC is demand** and a **PV is supply**.

A claim says what the workload needs, in the workload's own namespace, without knowing anything about the infrastructure:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-data
  namespace: databases
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: fast-ssd
  resources:
    requests:
      storage: 100Gi
```

A PersistentVolume is the supply side: a real piece of storage, described in cluster terms.

There are two ways supply appears, and knowing which one you are using tells you who is responsible when things go wrong.

```tabs
{
  "title": "Two ways a PersistentVolume comes into existence",
  "tabs": [
    {
      "label": "Dynamic (the normal case)",
      "lang": "yaml",
      "code": "# You create only the claim. The StorageClass names a provisioner,\n# the CSI driver creates a real disk, and the PV object is generated\n# for you with a name like pvc-74a498d6-3929-47e8-8c02-078c1ece4d78.\n\napiVersion: storage.k8s.io/v1\nkind: StorageClass\nmetadata:\n  name: fast-ssd\nprovisioner: ebs.csi.aws.com\nparameters:\n  type: gp3\nreclaimPolicy: Retain          # override the Delete default\nallowVolumeExpansion: true\nvolumeBindingMode: WaitForFirstConsumer"
    },
    {
      "label": "Static (pre-provisioned)",
      "lang": "yaml",
      "code": "# An administrator creates the PV by hand, pointing at storage that\n# already exists. Nothing is provisioned on demand. Useful for NFS\n# exports and for adopting a disk that already holds data.\n\napiVersion: v1\nkind: PersistentVolume\nmetadata:\n  name: legacy-nfs-export\nspec:\n  capacity:\n    storage: 100Gi\n  accessModes:\n    - ReadWriteMany\n  persistentVolumeReclaimPolicy: Retain\n  storageClassName: \"\"         # empty, so no dynamic provisioning applies\n  nfs:\n    server: 10.0.4.12\n    path: /exports/legacy"
    }
  ]
}
```

Dynamic provisioning is what every managed cluster gives you by default. It is also why so many people have never looked at a PV object: one is quietly created and destroyed on their behalf, carrying policies they did not set.

## Binding is one-to-one, and it is sticky

Once a claim finds a volume, the two are wired together permanently. Upstream is unambiguous:

> Once bound, PersistentVolumeClaim binds are exclusive, regardless of how they were bound. A PVC to PV binding is a one-to-one mapping, using a ClaimRef which is a bi-directional binding between the PersistentVolume and the PersistentVolumeClaim.

Two consequences follow, and both catch people out.

**You cannot point two claims at one volume to share it.** If you need several pods writing to the same storage, that is an access mode and a driver question, not a binding question. One PV serves exactly one PVC.

**The binding is recorded on both objects.** The PV gets a `claimRef` naming the claim. This is the field that makes a `Retain`ed volume refuse to be reused, which we come to below.

If you want a specific claim to land on a specific volume, you pre-bind by naming the volume in the claim. Note the empty `storageClassName`, which upstream flags explicitly:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: foo-pvc
  namespace: foo
spec:
  storageClassName: "" # Empty string must be explicitly set otherwise default StorageClass will be set
  volumeName: foo-pv
```

Leave `storageClassName` off entirely and the default StorageClass is applied, dynamic provisioning kicks in, and you get a brand new empty disk instead of the volume you were trying to attach to. That is a genuinely nasty failure, because it looks like success: the pod starts, the mount is there, and the data is simply gone.

## Access modes: the part almost everyone gets wrong

This is the single biggest misconception in Kubernetes storage, and it is worth stating bluntly.

**`ReadWriteOnce` does not mean one pod.** Here is the upstream definition, verbatim:

> `ReadWriteOnce`: the volume can be mounted as read-write by a single node. ReadWriteOnce access mode still can allow multiple pods to access (read from or write to) that volume when the pods are running on the same node. For single pod access, please see ReadWriteOncePod.

So an RWO volume happily serves three pods at once, as long as the scheduler put them on the same node. Teams discover this when a rolling update briefly runs old and new pods together, both writing, and a database that assumed exclusive access finds its files corrupted. The behaviour is not a bug and it is not a driver quirk. It is the documented meaning of the mode.

The four modes and their `kubectl` abbreviations:

| Mode | Short | What it actually means |
| --- | --- | --- |
| `ReadWriteOnce` | RWO | Read-write by a single **node**, any number of pods on it |
| `ReadOnlyMany` | ROX | Read-only by many nodes |
| `ReadWriteMany` | RWX | Read-write by many nodes, needs a driver that supports it |
| `ReadWriteOncePod` | RWOP | Read-write by exactly **one pod**, cluster-wide |

Now the second half, which is less known and more alarming. Access modes on a PV are, with one exception, not enforced by anything:

> Even if the access modes are specified as ReadWriteOnce, ReadOnlyMany, or ReadWriteMany, they don't set any constraints on the volume. For example, even if a PersistentVolume is created as ReadOnlyMany, it is no guarantee that it will be read-only. If the access modes are specified as ReadWriteOncePod, the volume is constrained and can be mounted on only a single Pod.

Read that again. `ReadOnlyMany` does not make a volume read-only. The access mode is matching metadata used when pairing claims with volumes, not a lock applied to the storage. If you want a hard guarantee that exactly one pod can write, `ReadWriteOncePod` is the only mode that provides one, it is CSI-only, and it [graduated to stable in Kubernetes v1.29](https://kubernetes.io/blog/2023/12/18/read-write-once-pod-access-mode-ga/).

:::warning
If you run a database on Kubernetes and rely on `ReadWriteOnce` to prevent two writers, you are relying on the scheduler's node placement, not on a guarantee. Use `ReadWriteOncePod`, and read [Why Running Postgres on Kubernetes Is Still a Bad Idea](/posts/postgres-k8s) before you decide the whole arrangement is worth it.
:::

## The reclaim policy decides whether you keep your data

Every PV carries a `persistentVolumeReclaimPolicy` that says what happens when its claim goes away.

**`Delete`** removes the PV object *and the storage asset in the external infrastructure*. The disk is gone. This is the important part:

> Volumes that were dynamically provisioned inherit the reclaim policy of their StorageClass, which defaults to `Delete`.

And on the StorageClass side:

> If no `reclaimPolicy` is specified when a StorageClass object is created, it will default to `Delete`.

Put those together. On a default managed cluster, with a StorageClass nobody edited, `kubectl delete pvc` destroys the underlying disk. Delete a namespace and every claim in it goes, taking the disks with it. No confirmation, no soft delete, no recycle bin.

**`Retain`** keeps everything and hands you the cleanup. **`Recycle`** still appears in the API and is deprecated:

> The `Recycle` reclaim policy is deprecated. Instead, the recommended approach is to use dynamic provisioning.

Treat `Recycle` as a historical artifact. The real choice is `Delete` or `Retain`.

### The Retain trap

Setting `Retain` protects the data and then produces the second-most-common storage support ticket. When the claim is deleted, the volume moves to `Released`, and:

> the PersistentVolume still exists and the volume is considered "released". But it is not yet available for another claim because the previous claimant's data remains on the volume.

A `Released` PV will not bind to a new claim. Not to an identical claim, not to one with the same name in the same namespace. The blocker is the `claimRef` still pointing at the claim that no longer exists. Clearing it is what returns the volume to `Available`:

```bash
# The volume is Released and no new claim will touch it.
kubectl get pv
# NAME       CAPACITY   RECLAIM POLICY   STATUS     CLAIM
# pv-data    100Gi      Retain           Released   databases/postgres-data

# Drop the stale binding to make it Available again.
kubectl patch pv pv-data -p '{"spec":{"claimRef": null}}'
```

The data on the volume is untouched by this. You are only removing the record of a binding to a claim that has been deleted.

## Why your PVC is stuck in Terminating

You run `kubectl delete pvc`, the command returns, and the claim sits in `Terminating` indefinitely. Nothing is broken. This is Storage Object in Use Protection doing its job:

> If a user deletes a PVC in active use by a Pod, the PVC is not removed immediately. PVC removal is postponed until the PVC is no longer actively used by any Pods.

The mechanism is a finalizer. Two exist, and their exact names are worth knowing because they show up in `kubectl describe`:

- `kubernetes.io/pvc-protection` on claims
- `kubernetes.io/pv-protection` on volumes

```terminal
{
  "title": "a PVC that will not delete",
  "prompt": "$",
  "steps": [
    { "comment": "the delete blocks, because a pod still has it mounted" },
    { "cmd": "kubectl delete pvc postgres-data", "output": "persistentvolumeclaim \"postgres-data\" deleted" },
    { "cmd": "kubectl get pvc postgres-data", "output": "NAME            STATUS        VOLUME    CAPACITY   ACCESS MODES\npostgres-data   Terminating   pv-data   100Gi      RWO" },
    { "comment": "the finalizer is the reason, not a stuck controller" },
    { "cmd": "kubectl describe pvc postgres-data | grep Finalizers", "output": "Finalizers:  [kubernetes.io/pvc-protection]" },
    { "comment": "find the real holder, then remove it" },
    { "cmd": "kubectl get pods -o json | jq -r '.items[] | select(.spec.volumes[]?.persistentVolumeClaim.claimName==\"postgres-data\") | .metadata.name'", "output": "postgres-0" },
    { "cmd": "kubectl delete pod postgres-0", "output": "pod \"postgres-0\" deleted\n# the PVC finishes deleting on its own" }
  ]
}
```

:::warning
The tempting fix, patching the finalizer off with `kubectl patch pvc ... -p '{"metadata":{"finalizers":null}}'`, is the wrong move. It removes the guard while a pod is still writing to the volume, which is exactly the data loss the guard exists to prevent. Find the pod instead. Kubernetes v1.31 also added `external-provisioner.volume.kubernetes.io/finalizer` and `kubernetes.io/pv-controller` on PVs, which make sure a `Delete` volume is only removed once the backing storage really is.
:::

## Why your pod is stuck in Pending

The other half of the stuck-object family, and this one is a StorageClass setting.

`volumeBindingMode` has two values. `Immediate` is the default and binds as soon as the claim is created. `WaitForFirstConsumer` delays binding until a pod actually needs the volume.

That delay is not laziness, it is topology. With `Immediate`, upstream notes that PVs "will be bound or provisioned without knowledge of the Pod's scheduling requirements", which "can result in unschedulable Pods". In plain terms: on a cloud with zones, an `Immediate` claim can provision a disk in `eu-west-1a` while the only node with capacity for your pod is in `eu-west-1b`. The disk cannot cross the zone boundary, the pod cannot be scheduled, and it waits forever.

`WaitForFirstConsumer` inverts the order. The scheduler picks a node first, then the volume is provisioned to match. If you run a multi-zone cluster, this is almost always what you want:

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: ebs.csi.aws.com
volumeBindingMode: WaitForFirstConsumer
```

The diagnostic is quick. A pod in `Pending` with a claim in `Pending` and no provisioning events points at topology or at a missing default StorageClass. A pod in `Pending` with a claim already `Bound` points at the node the volume landed on.

## Expansion only goes one way

Volume expansion has been [stable since v1.24](https://kubernetes.io/blog/2022/05/05/volume-expansion-ga/) and works like this: you edit the claim, requesting more, and the backing volume grows.

> You can only use the volume expansion feature to grow a Volume, not to shrink it.

Two conditions and one trap.

The conditions: the StorageClass needs `allowVolumeExpansion: true`, and the CSI driver has to support resize. Without the first, the API rejects the edit.

The trap is that expansion is driven by the *difference* between the claim and the volume, so closing that gap by hand disables it:

> Directly editing the size of a PersistentVolume can prevent an automatic resize of that volume. If you edit the capacity of a PersistentVolume, and then edit the `.spec` of a matching PersistentVolumeClaim to make the size of the PersistentVolumeClaim match the PersistentVolume, then no storage resize happens. The Kubernetes control plane will see that the desired state of both resources matches, conclude that the backing volume size has been manually increased and that no resize is necessary.

So the correct move is to edit the PVC and nothing else:

```bash
# Right: ask for more on the claim, let the controller do the rest.
kubectl patch pvc postgres-data -p '{"spec":{"resources":{"requests":{"storage":"200Gi"}}}}'
```

Since shrinking is impossible, over-provisioning a volume is a decision you cannot walk back. The only route down is to create a smaller volume and copy the data across.

## StatefulSets: the claims outlive the workload

Deployments and StatefulSets treat storage completely differently, which is most of the reason StatefulSets exist. If that distinction is still fuzzy, [Kubernetes Deployments vs StatefulSets](/posts/kubernetes-deployments-vs-statefulsets) covers it directly.

A StatefulSet's `volumeClaimTemplates` generate one claim per replica, named `<template-name>-<statefulset-name>-<ordinal>`. A template called `www` in a StatefulSet called `web` produces `www-web-0`, `www-web-1`, `www-web-2`. That naming is the mechanism behind stable identity: when `web-1` is rescheduled, it is reattached to `www-web-1` and gets its own data back rather than a fresh disk.

The behaviour that surprises people is what happens on scale-down and delete:

> Deleting and/or scaling a StatefulSet down will *not* delete the volumes associated with the StatefulSet. This is done to ensure data safety, which is generally more valuable than an automatic purge of all related StatefulSet resources.

Scale from 5 to 3 and two claims stay behind, still billed, still holding data. Scale back to 5 and those same claims are picked up again, which is exactly what you want for a database and exactly what you do not want for a cache you have been scaling for a year.

To change it, set `persistentVolumeClaimRetentionPolicy`, which [reached GA in Kubernetes v1.32](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/):

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: web
spec:
  persistentVolumeClaimRetentionPolicy:
    whenDeleted: Retain   # keep the data if someone deletes the StatefulSet
    whenScaled: Delete    # but reclaim it when scaling down
  replicas: 3
  volumeClaimTemplates:
    - metadata:
        name: www
      spec:
        accessModes: [ "ReadWriteOnce" ]
        storageClassName: fast-ssd
        resources:
          requests:
            storage: 10Gi
```

`whenDeleted: Retain` with `whenScaled: Delete` is a sensible pairing for most stateful workloads: scaling in is routine and reversible, deleting the StatefulSet is usually a mistake.

:::note
On a cluster older than v1.32 the field is present but gated. If it appears to be ignored, check the `StatefulSetAutoDeletePVC` feature gate before assuming the field is wrong.
:::

## Reading the state of a volume

Four phases, and each one tells you which half of the system to look at:

| Phase | Meaning | Where to look |
| --- | --- | --- |
| `Available` | Free, not bound to a claim | Nothing wrong; no claim matches it yet |
| `Bound` | Attached to a claim | Normal steady state |
| `Released` | Claim deleted, storage not yet reclaimed | A `Retain` volume needing its `claimRef` cleared |
| `Failed` | Automated reclamation failed | The CSI driver logs |

A `Released` volume on a `Delete` policy that never disappears usually means the driver could not remove the backing disk, often because it was deleted out from under Kubernetes in the cloud console.

## A checklist worth running against your cluster

None of this needs a rewrite of anything. It is four commands and a decision.

```bash
# 1. What is the default StorageClass, and does it delete data?
kubectl get storageclass -o custom-columns=\
'NAME:.metadata.name,RECLAIM:.reclaimPolicy,EXPAND:.allowVolumeExpansion,BINDING:.volumeBindingMode,DEFAULT:.metadata.annotations.storageclass\.kubernetes\.io/is-default-class'

# 2. Which volumes would take their disks with them?
kubectl get pv -o custom-columns='NAME:.metadata.name,POLICY:.spec.persistentVolumeReclaimPolicy,STATUS:.status.phase,CLAIM:.spec.claimRef.name'

# 3. Anything already stranded?
kubectl get pv --field-selector status.phase=Released

# 4. Claims nobody is using, quietly costing money
kubectl get pvc --all-namespaces
```

If step 1 shows `Delete` on the default class, that is the setting to think hardest about. The annotation that marks a class as default is `storageclass.kubernetes.io/is-default-class: "true"`, and the reclaim policy on a StorageClass cannot be changed after creation, so the fix is a new class rather than an edit.

Note that a PV's reclaim policy *can* be patched in place, which is the fastest way to protect volumes that already exist:

```bash
kubectl patch pv pv-data -p '{"spec":{"persistentVolumeReclaimPolicy":"Retain"}}'
```

## Summary

The object model is the easy half. A PVC is demand, a PV is supply, a StorageClass is the recipe, and a CSI driver does the work. Bind one-to-one, mount by claim name, done.

The half that decides whether you keep your data is the lifecycle, and it comes down to a few rules that are not obvious from the YAML:

- `ReadWriteOnce` is a **node** constraint, and access modes other than `ReadWriteOncePod` are not enforced at all
- `reclaimPolicy` defaults to `Delete`, so on an untouched cluster deleting a claim deletes the disk
- `Retain` leaves the volume in `Released`, and it stays unusable until `claimRef` is cleared
- Finalizers holding a `Terminating` PVC are protecting a volume that is still mounted, so find the pod rather than patching the finalizer away
- Expansion grows and never shrinks, and hand-editing PV capacity silently disables it
- StatefulSet claims survive scale-down and deletion unless `persistentVolumeClaimRetentionPolicy` says otherwise

For the wider operational picture around these objects, [Real-World Kubernetes Deployments](/posts/real-world-k8s) covers the neighbouring concerns: probes, resource limits and disruption budgets.

## FAQ

**Can two pods share one PersistentVolumeClaim?**
Yes, if they land on the same node or if the volume is `ReadWriteMany` with a driver that supports it. What you cannot do is bind two claims to one volume, since binding is strictly one-to-one.

**Does deleting a namespace delete the underlying disks?**
It deletes every PVC in that namespace. Whether the disks go with them depends on the reclaim policy of each PV, which for dynamically provisioned volumes is inherited from the StorageClass and defaults to `Delete`.

**Why is my PVC Pending with no events?**
Usually no default StorageClass, or a `storageClassName` naming a class that does not exist. If the class uses `WaitForFirstConsumer`, `Pending` is also the correct state until a pod actually references the claim.

**Can I change a PVC's access mode after creating it?**
Not in place for the general case. The supported route for moving to `ReadWriteOncePod` is documented as a task upstream, and it involves the PV rather than editing the claim's mode directly.

**Is it safe to delete a PV that shows as Released?**
Only once you are certain the data is not needed, or the policy is `Retain` and you have copied it. On `Retain` the storage asset in the cloud survives the PV object, so deleting the PV does not free the disk or stop the bill.

**Do I still need to care about in-tree volume plugins?**
Mostly no. The cloud providers' in-tree plugins have been migrated to CSI, and new drivers are CSI only. It matters when reading older manifests, where a `spec.awsElasticBlockStore` block signals something worth modernising.
