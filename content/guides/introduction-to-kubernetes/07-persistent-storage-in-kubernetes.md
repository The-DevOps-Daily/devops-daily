---
title: 'Kubernetes Persistent Volumes, PVCs and StatefulSets'
description: 'Keep data when pods restart: PersistentVolumeClaims, StorageClasses, access modes, StatefulSets with volumeClaimTemplates, volume expansion and backups.'
order: 7
---

**TLDR**: Files written inside a container disappear with the pod. To keep data, a pod mounts a **PersistentVolumeClaim** (PVC), a request for storage of a certain size and access mode. A **StorageClass** creates a matching **PersistentVolume** (PV) for it on demand, usually through a CSI driver. A **StatefulSet** gives each of its pods a stable name and its own PVC, which is what databases and caches need.

In this part you watch the cache lose its data when its pod restarts, create a PVC and see when and where its volume appears, move the cache to a StatefulSet that keeps its data, and learn the limits of node-local storage that will matter again in Part 8.

## Prerequisites

- The cache and the configured podinfo from [Part 6](/guides/introduction-to-kubernetes/06-configmaps-and-secrets). On a new cluster, apply `04-deployments/deployment.yaml` and `05-networking/service.yaml`, create the `podinfo-tls` Secret as Part 6 shows, then apply the files in `06-config/` (`cache.yaml`, `configmap.yaml`, `deployment.yaml`).

## Data Without a Volume Is Lost

The cache from Part 6 is a Deployment without a volume, so Valkey keeps its data in the container's own filesystem. Write a key through podinfo, then replace the cache pod:

```terminal
{
  "title": "lose the data",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl port-forward service/podinfo 8080:80 > /dev/null 2>&1 & PF=$!"
    },
    {
      "cmd": "curl -s --retry 5 --retry-connrefused --retry-delay 1 -X POST -d \"hello from the cache\" localhost:8080/cache/greeting"
    },
    {
      "cmd": "curl -s -w ' [%{http_code}]\\n' localhost:8080/cache/greeting",
      "output": "hello from the cache [200]"
    },
    {
      "cmd": "kubectl delete pod -l app=cache",
      "output": "pod \"cache-7b64d7978-td6fb\" deleted from demo namespace"
    },
    {
      "cmd": "kubectl rollout status deployment/cache",
      "output": "Waiting for deployment \"cache\" rollout to finish: 0 of 1 updated replicas are available...\ndeployment \"cache\" successfully rolled out"
    },
    {
      "cmd": "curl -s -X POST -d ok localhost:8080/cache/check"
    },
    {
      "cmd": "curl -s -w ' [%{http_code}]\\n' localhost:8080/cache/check",
      "output": "ok [200]"
    },
    {
      "cmd": "curl -s -w ' [%{http_code}]\\n' localhost:8080/cache/greeting",
      "output": " [404]"
    }
  ]
}
```

podinfo answers `404` for a key that does not exist, and also when it cannot reach the cache at all. The round trip with the `check` key proves that podinfo is connected to the new cache pod, so the `404` for `greeting` means the data is gone: the new pod started empty. If you get a `404` for `check` too, podinfo has not reconnected yet; wait a few seconds and try again. That is fine for a cache you can refill, and a disaster for a database.

## Volumes, PersistentVolumes and Claims

Kubernetes separates what a pod needs from how storage is provided:

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Pod", "sub": "mounts a claim", "icon": "pod", "tone": "blue" },
    { "label": "PersistentVolumeClaim", "sub": "1Gi, ReadWriteOnce", "icon": "box", "tone": "accent" },
    { "label": "StorageClass", "sub": "how to create it", "icon": "gear", "tone": "slate" },
    { "label": "Provisioner", "sub": "a CSI driver or local-path", "icon": "cpu", "tone": "violet" },
    { "label": "PersistentVolume", "sub": "the actual disk", "icon": "database", "tone": "green" }
  ]
}
```

- A **volume** in a pod spec is anything mounted into containers. Some live as long as the pod (`emptyDir`, `configMap`, `secret`, `projected`), others point at storage that outlives it (`persistentVolumeClaim`).
- A **PersistentVolumeClaim** is a namespaced request: "1 GiB that one node can mount read-write". Apps ask for storage with claims and do not need to know the storage system.
- A **PersistentVolume** is the cluster-wide object for a real piece of storage: a cloud disk, an NFS export, a directory on a node.
- A **StorageClass** tells Kubernetes how to create PVs on demand (**dynamic provisioning**) through a **provisioner**. On cloud clusters that is a **CSI driver**, the plugin that talks to the storage system; kind uses a simpler provisioner. Most clusters have a default StorageClass, used by claims that name none.

`hostPath` volumes, which mount a directory of the node directly, appear in many old examples. Avoid them in apps: a pod can read or overwrite node files through them, the data stays on one node, and the restricted Pod Security level forbids them ([Part 10](/guides/introduction-to-kubernetes/10-best-practices-in-kubernetes)).

## Dynamic Provisioning on kind

kind ships Rancher's local-path provisioner (not a CSI driver) as its default StorageClass. It creates each volume as a `hostPath` directory on the node where the pod runs:

```bash
kubectl get storageclass
```

```text
NAME                 PROVISIONER             RECLAIMPOLICY   VOLUMEBINDINGMODE      ALLOWVOLUMEEXPANSION   AGE
standard (default)   rancher.io/local-path   Delete          WaitForFirstConsumer   false                  77s
```

`WaitForFirstConsumer` means the volume is created only when a pod that uses the claim is scheduled, on that pod's node. `Immediate` would create it right away, possibly in a zone or on a node where the pod cannot run. `ALLOWVOLUMEEXPANSION false` comes back below.

Create a claim:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: scratch
spec:
  accessModes:
    - ReadWriteOnce # one node can mount it read-write
  resources:
    requests:
      storage: 1Gi
  # no storageClassName: the cluster's default StorageClass is used
```

```terminal
{
  "title": "a claim waits for its first pod",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl apply -f 07-storage/pvc.yaml",
      "output": "persistentvolumeclaim/scratch created"
    },
    {
      "cmd": "kubectl get pvc scratch",
      "output": "NAME      STATUS    VOLUME   CAPACITY   ACCESS MODES   STORAGECLASS   VOLUMEATTRIBUTESCLASS   AGE\nscratch   Pending                                      standard       <unset>                 0s"
    },
    {
      "cmd": "kubectl events --for pvc/scratch",
      "output": "LAST SEEN   TYPE     REASON                 OBJECT                          MESSAGE\n0s          Normal   WaitForFirstConsumer   PersistentVolumeClaim/scratch   waiting for first consumer to be created before binding"
    }
  ]
}
```

`Pending` is expected here. Now start a pod that mounts the claim and writes a file:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: writer
spec:
  containers:
    - name: writer
      image: busybox:1.38.0
      command: ['sh', '-c', 'date -u > /data/created-at.txt && sleep 3600']
      volumeMounts:
        - name: scratch
          mountPath: /data
  volumes:
    - name: scratch
      persistentVolumeClaim:
        claimName: scratch
```

```terminal
{
  "title": "the first consumer binds it",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl apply -f 07-storage/pvc-pod.yaml",
      "output": "pod/writer created"
    },
    {
      "cmd": "kubectl wait --for=condition=Ready pod/writer --timeout=120s",
      "output": "pod/writer condition met"
    },
    {
      "cmd": "kubectl get pvc scratch",
      "output": "NAME      STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   VOLUMEATTRIBUTESCLASS   AGE\nscratch   Bound    pvc-5af14182-989e-4a62-9f01-fb69f7c7c20f   1Gi        RWO            standard       <unset>                 7s"
    },
    {
      "cmd": "kubectl get pv",
      "output": "NAME                                       CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS   CLAIM          STORAGECLASS   VOLUMEATTRIBUTESCLASS   REASON   AGE\npvc-5af14182-989e-4a62-9f01-fb69f7c7c20f   1Gi        RWO            Delete           Bound    demo/scratch   standard       <unset>                          4s"
    },
    {
      "cmd": "kubectl describe pv $(kubectl get pvc scratch -o jsonpath={.spec.volumeName})",
      "output": "Name:              pvc-5af14182-989e-4a62-9f01-fb69f7c7c20f\nLabels:            <none>\nAnnotations:       local.path.provisioner/selected-node: k8s-guide-worker\n                   pv.kubernetes.io/provisioned-by: rancher.io/local-path\nFinalizers:        [kubernetes.io/pv-protection]\nStorageClass:      standard\nStatus:            Bound\nClaim:             demo/scratch\nReclaim Policy:    Delete\nAccess Modes:      RWO\nVolumeMode:        Filesystem\nCapacity:          1Gi\nNode Affinity:\n  Required Terms:\n    Term 0:        kubernetes.io/hostname in [k8s-guide-worker]\nMessage:\nSource:\n    Type:          HostPath (bare host directory volume)\n    Path:          /var/local-path-provisioner/pvc-5af14182-989e-4a62-9f01-fb69f7c7c20f_demo_scratch\n    HostPathType:  DirectoryOrCreate\nEvents:            <none>"
    },
    {
      "cmd": "kubectl exec writer -- cat /data/created-at.txt",
      "output": "Sat Oct 24 10:16:37 UTC 2026"
    }
  ]
}
```

The provisioner created a PV, named after the claim's UID, and bound the two. `Node Affinity` pins this PV to the node the pod landed on: a local volume exists on one node only, so any pod that uses it must run there. Cloud disks are pinned the same way to a zone.

When you delete the claim, the **reclaim policy** decides what happens to the volume. `Delete`, the default for dynamically provisioned volumes, deletes the PV and the data:

```terminal
{
  "title": "reclaim policy Delete",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl delete -f 07-storage/pvc-pod.yaml -f 07-storage/pvc.yaml",
      "output": "pod \"writer\" deleted from demo namespace\npersistentvolumeclaim \"scratch\" deleted from demo namespace"
    },
    {
      "cmd": "kubectl get pv",
      "output": "No resources found"
    }
  ]
}
```

For data you care about, use a StorageClass with `reclaimPolicy: Retain`. The PV then stays after the claim is deleted, and an administrator decides whether to reuse or delete it.

### Access Modes

| Mode               | Short | Meaning                                                                   |
| ------------------ | ----- | ------------------------------------------------------------------------- |
| `ReadWriteOnce`    | RWO   | Mounted read-write by pods on one node at a time                          |
| `ReadWriteOncePod` | RWOP  | Mounted read-write by exactly one pod (stable since 1.29)                 |
| `ReadOnlyMany`     | ROX   | Mounted read-only on many nodes                                           |
| `ReadWriteMany`    | RWX   | Mounted read-write on many nodes, for example NFS or a cloud file service |

Block storage such as cloud disks supports RWO and RWOP; RWX needs a file system that many nodes can share, such as NFS, CephFS, Amazon EFS, Azure Files or Google Filestore. Use RWOP for databases, so that a second pod can never mount the same disk by mistake.

## A StatefulSet for the Cache

A Deployment's pods are interchangeable, and they would all share one claim. A **StatefulSet** gives each pod:

- a stable name, `cache-0`, `cache-1` and so on, kept when the pod is replaced;
- a stable DNS name through a headless Service, `cache-0.cache-headless.demo.svc.cluster.local`;
- its own PVC from `volumeClaimTemplates`, `data-cache-0` for `cache-0`, which the replacement pod mounts again;
- ordered startup, scaling and updates, one pod at a time.

```yaml
# A headless Service gives each StatefulSet pod a stable DNS name: cache-0.cache-headless
apiVersion: v1
kind: Service
metadata:
  name: cache-headless
  labels:
    app: cache
spec:
  clusterIP: None
  selector:
    app: cache
  ports:
    - name: valkey
      port: 6379
      targetPort: valkey
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: cache
  labels:
    app: cache
spec:
  serviceName: cache-headless
  replicas: 1
  selector:
    matchLabels:
      app: cache
  # Keep the volumes when the StatefulSet is deleted or scaled down (the default)
  persistentVolumeClaimRetentionPolicy:
    whenDeleted: Retain
    whenScaled: Retain
  template:
    metadata:
      labels:
        app: cache
    spec:
      containers:
        - name: valkey
          image: valkey/valkey:9.1.2-alpine
          # --appendonly yes writes every change to a log file in /data
          args: ['/etc/valkey/valkey.conf', '--appendonly', 'yes']
          ports:
            - name: valkey
              containerPort: 6379
          volumeMounts:
            - name: data
              mountPath: /data
            - name: config
              mountPath: /etc/valkey
              readOnly: true
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              memory: 256Mi
      volumes:
        - name: config
          configMap:
            name: cache-config
  # One PersistentVolumeClaim per pod: data-cache-0, data-cache-1, ...
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ['ReadWriteOnce']
        resources:
          requests:
            storage: 1Gi
```

`--appendonly yes` makes Valkey log every write to a file under `/data`, which is now the volume. The existing `cache` Service from Part 6 selects `app: cache`, so podinfo reaches the StatefulSet's pod without any change. Replace the Deployment:

```terminal
{
  "title": "move the cache to a StatefulSet",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl delete deployment cache",
      "output": "deployment.apps \"cache\" deleted from demo namespace"
    },
    {
      "cmd": "kubectl apply -f 07-storage/statefulset.yaml",
      "output": "service/cache-headless created\nstatefulset.apps/cache created"
    },
    {
      "cmd": "kubectl rollout status statefulset/cache",
      "output": "Waiting for 1 pods to be ready...\npartitioned roll out complete: 1 new pods have been updated..."
    },
    {
      "cmd": "kubectl get statefulset,pods,pvc -l app=cache",
      "output": "NAME                     READY   AGE\nstatefulset.apps/cache   1/1     3s\n\nNAME          READY   STATUS    RESTARTS   AGE\npod/cache-0   1/1     Running   0          3s\n\nNAME                                 STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   VOLUMEATTRIBUTESCLASS   AGE\npersistentvolumeclaim/data-cache-0   Bound    pvc-a3e0ac33-4d3d-4119-be4e-e5718580b9db   1Gi        RWO            standard       <unset>                 3s"
    }
  ]
}
```

Check that podinfo reaches the new cache pod, write a key and read it back, delete the pod, and read the key again:

```terminal
{
  "title": "the data survives the pod",
  "prompt": "$",
  "steps": [
    {
      "cmd": "curl -s -X POST -d ok localhost:8080/cache/check && curl -s -w ' [%{http_code}]\\n' localhost:8080/cache/check",
      "output": "ok [200]"
    },
    {
      "cmd": "curl -s -X POST -d \"survives restarts\" localhost:8080/cache/greeting"
    },
    {
      "cmd": "curl -s -w ' [%{http_code}]\\n' localhost:8080/cache/greeting",
      "output": "survives restarts [200]"
    },
    {
      "cmd": "kubectl delete pod cache-0",
      "output": "pod \"cache-0\" deleted from demo namespace"
    },
    {
      "cmd": "kubectl rollout status statefulset/cache",
      "output": "Waiting for 1 pods to be ready...\npartitioned roll out complete: 1 new pods have been updated..."
    },
    {
      "cmd": "curl -s -X POST -d ok localhost:8080/cache/check && curl -s -w ' [%{http_code}]\\n' localhost:8080/cache/check",
      "output": "ok [200]"
    },
    {
      "cmd": "curl -s -w ' [%{http_code}]\\n' localhost:8080/cache/greeting",
      "output": "survives restarts [200]"
    },
    {
      "cmd": "kubectl exec cache-0 -- ls -l /data/appendonlydir",
      "output": "total 12\n-rw-------    1 valkey   valkey          89 Oct 24 10:17 appendonly.aof.1.base.rdb\n-rw-------    1 valkey   valkey         225 Oct 24 10:17 appendonly.aof.1.incr.aof\n-rw-------    1 valkey   valkey          88 Oct 24 10:17 appendonly.aof.manifest"
    },
    {
      "cmd": "kubectl exec cache-0 -- valkey-cli GET greeting",
      "output": "survives restarts"
    }
  ]
}
```

The StatefulSet recreated `cache-0` with the same name, it mounted `data-cache-0` again, and Valkey replayed its append-only file. Each pod also has a DNS name of its own, which clustered databases use to find each other:

```bash
kubectl exec deploy/podinfo -- nslookup cache-0.cache-headless.demo.svc.cluster.local
```

```text
Server:		10.96.0.10
Address:	10.96.0.10:53

Name:	cache-0.cache-headless.demo.svc.cluster.local
Address: 10.244.2.13
```

Scaling a StatefulSet down does not delete its claims (`persistentVolumeClaimRetentionPolicy` controls that, and `Retain` is the default), so scaling back up brings the data back:

```terminal
{
  "title": "scale to zero and back",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl scale statefulset cache --replicas=0",
      "output": "statefulset.apps/cache scaled"
    },
    {
      "cmd": "kubectl wait --for=delete pod/cache-0 --timeout=120s",
      "output": "pod/cache-0 condition met"
    },
    {
      "cmd": "kubectl get pvc",
      "output": "NAME           STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   VOLUMEATTRIBUTESCLASS   AGE\ndata-cache-0   Bound    pvc-a3e0ac33-4d3d-4119-be4e-e5718580b9db   1Gi        RWO            standard       <unset>                 9s"
    },
    {
      "cmd": "kubectl scale statefulset cache --replicas=1",
      "output": "statefulset.apps/cache scaled"
    },
    {
      "cmd": "kubectl rollout status statefulset/cache",
      "output": "Waiting for 1 pods to be ready...\npartitioned roll out complete: 1 new pods have been updated..."
    },
    {
      "cmd": "curl -s -X POST -d ok localhost:8080/cache/check && curl -s -w ' [%{http_code}]\\n' localhost:8080/cache/check",
      "output": "ok [200]"
    },
    {
      "cmd": "curl -s -w ' [%{http_code}]\\n' localhost:8080/cache/greeting",
      "output": "survives restarts [200]"
    }
  ]
}
```

Note where `cache-0` runs. Its volume is a directory on that node, so `cache-0` can only ever run there; Part 8 drains that node and shows what happens:

```terminal
{
  "title": "the node the volume lives on",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl get pod cache-0 -o jsonpath='{.spec.nodeName}{\"\\n\"}'",
      "output": "k8s-guide-worker"
    },
    {
      "cmd": "kill $PF"
    }
  ]
}
```

## Expanding a Volume

To grow a claim, raise `resources.requests.storage`. That only works when the StorageClass has `allowVolumeExpansion: true` and its CSI driver supports resizing. kind's local-path class does not:

```bash
kubectl patch pvc data-cache-0 -p '{"spec":{"resources":{"requests":{"storage":"2Gi"}}}}'
```

```text
Error from server (Forbidden): persistentvolumeclaims "data-cache-0" is forbidden: only dynamically provisioned pvc can be resized and the storageclass that provisions the pvc must support resize
```

Cloud StorageClasses usually allow it, and the disk grows while the pod runs. Claims can only grow, never shrink. In a StatefulSet, `volumeClaimTemplates` cannot be changed in place, so you resize each existing PVC yourself and update the template for future pods by recreating the StatefulSet with `kubectl delete statefulset cache --cascade=orphan`, which keeps the pods and claims. To change a volume's performance, such as IOPS, without a new disk, use a **VolumeAttributesClass** (stable since 1.34) if your CSI driver supports it.

## Storage on Managed Clusters

Managed services install their CSI driver, or offer it as an add-on (the EBS CSI driver on EKS clusters without Auto Mode), and usually a default StorageClass. On DigitalOcean Kubernetes, the default `do-block-storage` class creates a DigitalOcean Volume for each claim, billed while it exists. Here are StorageClasses for the other big providers (examples; each needs that provider's cluster):

```yaml
# StorageClasses for managed clusters. Each needs that provider's CSI driver,
# which the managed service installs or offers as an add-on.
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: ebs-gp3 # Amazon EKS Auto Mode, as created in Part 2
provisioner: ebs.csi.eks.amazonaws.com # with the EBS CSI driver add-on instead: ebs.csi.aws.com
parameters:
  type: gp3
  encrypted: 'true'
reclaimPolicy: Delete
allowVolumeExpansion: true
volumeBindingMode: WaitForFirstConsumer
allowedTopologies:
  - matchLabelExpressions:
      - key: eks.amazonaws.com/compute-type
        values: ['auto']
---
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: pd-balanced # Google Kubernetes Engine
provisioner: pd.csi.storage.gke.io
parameters:
  type: pd-balanced
reclaimPolicy: Delete
allowVolumeExpansion: true
volumeBindingMode: WaitForFirstConsumer
---
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: azure-premium # Azure Kubernetes Service
provisioner: disk.csi.azure.com
parameters:
  skuName: Premium_LRS
reclaimPolicy: Delete
allowVolumeExpansion: true
volumeBindingMode: WaitForFirstConsumer
```

Old tutorials use in-tree provisioners such as `kubernetes.io/aws-ebs` or `kubernetes.io/gce-pd`. Kubernetes migrated them to CSI drivers and has removed the in-tree plugins for the major clouds, so use the CSI provisioner names above.

## Snapshots and Backups

A **VolumeSnapshot** asks the CSI driver for a point-in-time copy of a claim, and a new claim can start from it. It needs the snapshot CRDs, the snapshot controller and a CSI driver that supports snapshots, which most managed services provide (kind's local-path driver does not):

```yaml
# Needs the snapshot CRDs and controller, and a CSI driver with snapshot support
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshot
metadata:
  name: cache-data-snapshot
spec:
  volumeSnapshotClassName: csi-snapclass # provided by your CSI driver
  source:
    persistentVolumeClaimName: data-cache-0
---
# A new claim that starts with the snapshot's data
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: data-cache-restore
spec:
  dataSource:
    name: cache-data-snapshot
    kind: VolumeSnapshot
    apiGroup: snapshot.storage.k8s.io
  accessModes: ['ReadWriteOnce']
  resources:
    requests:
      storage: 1Gi
```

Snapshots are not a full backup plan. For databases, also take application-level backups (`pg_dump`, Valkey's RDB files) and store them outside the cluster. [Velero](https://velero.io/) backs up Kubernetes objects and volumes together and restores them into another cluster. For a production database on Kubernetes, use an operator such as CloudNativePG, which handles replicas, failover and backups, or a managed database outside the cluster.

## Common Mistakes

- **No volume for data you need.** Anything written to the container's filesystem or an `emptyDir` is gone when the pod is replaced.
- **`Immediate` binding in multi-zone clusters.** The disk can end up in a zone where the pod cannot run. Use `WaitForFirstConsumer`.
- **`reclaimPolicy: Delete` for important data.** Deleting the claim deletes the disk. Use `Retain`, snapshots and backups.
- **Sharing one RWO claim between replicas.** A Deployment with several replicas and one RWO claim only works while all pods land on one node. Use a StatefulSet with one claim per pod.
- **Forgetting that local volumes pin pods to nodes.** A pod with a node-local volume cannot move when its node is drained or dies.

## Summary

- Pods ask for storage with PersistentVolumeClaims; StorageClasses and their provisioners (usually CSI drivers) create PersistentVolumes on demand.
- `WaitForFirstConsumer` creates the volume where the pod runs; the reclaim policy decides what happens when the claim goes.
- A StatefulSet gives each pod a stable name, DNS name and its own claim, so its data survives restarts and rescheduling.
- Expansion, snapshots and performance changes depend on the CSI driver; backups belong outside the cluster.

## Keep Learning

- [The anatomy of Kubernetes persistent storage](/posts/anatomy-of-kubernetes-persistent-storage)
- [Running Postgres on Kubernetes](/posts/postgres-k8s)
- [Kubernetes 1.37: finding unused PVCs](/posts/kubernetes-1-37-unused-pvc-condition)

Next, in [Part 8](/guides/introduction-to-kubernetes/08-resource-management-and-scaling), you give the pods CPU and memory budgets, scale them with load and drain a node, including the one this volume lives on.
