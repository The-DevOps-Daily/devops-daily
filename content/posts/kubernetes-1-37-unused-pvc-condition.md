---
title: 'Kubernetes 1.37 Really Can Flag Unused PVCs, but the Viral YAML Is Wrong'
excerpt: 'A post making the rounds says Kubernetes 1.37 adds an unusedSince field to PVC status. The feature is real and it is genuinely good news for storage bills; the YAML being shared shows an API that does not exist. Here is what KEP-5541 actually shipped, the correct fields, and a working query for "PVCs unused for 30 days".'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2026-08-28'
publishedAt: '2026-08-28T21:00:00Z'
updatedAt: '2026-08-28T21:00:00Z'
readingTime: '9 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Kubernetes
  - FinOps
  - storage
  - upgrades
---

There is a post going around about Kubernetes 1.37 solving one of the quieter FinOps headaches: orphaned PersistentVolumeClaims. It comes with a YAML snippet showing a new field, `status.unusedSince`, with a big red arrow pointing at it.

The good news: the feature is real, it went beta in 1.37, and if you pay a cloud bill it is worth knowing about. The problem: the field in that screenshot does not exist. The actual API is a **condition**, not a timestamp field, and if you go looking for `unusedSince` in your cluster you will find nothing and conclude the feature is missing. We checked the enhancement against [KEP-5541](https://github.com/kubernetes/enhancements/tree/master/keps/sig-storage/5541-pvc-last-used-time-status-field) itself, the same way we checked the [1.37 release claims](https://devops-daily.com/posts/kubernetes-1-37-garhwal-what-shipped) when third-party roundups disagreed. Here is what actually shipped and how to use it.

## TLDR

- The problem is real: deleting a StatefulSet or Helm release keeps its PVCs by design, and nobody remembers whose they are six months later.
- **KEP-5541 "Report Last Used Time on a PVC"**: alpha in 1.36, **beta and enabled by default in 1.37**, behind the `PersistentVolumeClaimUnusedSinceTime` feature gate.
- The API is a new **`Unused` condition** in `status.conditions`, managed by the PVC protection controller. There is no `status.unusedSince` field.
- The "unused since" timestamp is the condition's **`lastTransitionTime`**.
- A PVC with no `Unused` condition at all is normal right after upgrade: the condition appears as usage transitions are observed.
- Unused does not mean deletable. It means no non-terminal pod references the claim.

## Prerequisites

- A cluster on Kubernetes 1.37 (or 1.36 with the alpha gate enabled)
- `kubectl` and, for the queries below, `jq`
- Basic familiarity with PVCs and StatefulSets

## The problem this solves

Kubernetes keeps PVCs around on purpose. Delete a StatefulSet and its claims stay, because the alternative, data vanishing with a workload object, is worse. The cost of that safety is drift: six months later the `monitoring` namespace has a 100Gi claim named after a Prometheus that no longer exists, nobody is sure whether anything still mounts it, and the cloud provider bills for it monthly either way.

Until now, answering "is anything using this PVC?" meant correlating pods to claims yourself, and answering "since when?" meant an audit trail most clusters do not have. That second question is the one 1.37 finally answers natively.

## What actually shipped

KEP-5541 adds a condition type `Unused` to PersistentVolumeClaim status, maintained by the PVC protection controller in kube-controller-manager:

- When the **last** non-terminal pod referencing a PVC goes away, the condition becomes `status: "True"` with reason `NoPodsUsingPVC`.
- When a pod starts referencing it again, the condition flips to `status: "False"` with reason `PodUsingPVC`.
- The condition's **`lastTransitionTime`** records when that flip happened, which is exactly the "unused since" timestamp the viral post promised, living where Kubernetes actually puts such things.

So the real YAML looks like this:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: prometheus-db-data
  namespace: monitoring
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 100Gi
status:
  phase: Bound
  conditions:
    - type: Unused
      status: "True"
      reason: NoPodsUsingPVC
      message: No pods are currently referencing this PVC
      lastTransitionTime: "2026-08-01T10:00:00Z"
```

Same information as the screenshot, different shape: a condition you select on, not a scalar field you read. The distinction matters because every query, controller, or policy you write against this feature addresses `status.conditions[]`, and anything written against `status.unusedSince` silently matches nothing.

(If you are wondering how a feature gate named `PersistentVolumeClaimUnusedSinceTime` produces a condition rather than an `unusedSince` field: gate names stick early and describe intent, not final API shape. It is a fair guess at where the confusion started.)

## The query you actually came for

"Flag PVCs unused for more than 30 days" as a working pipeline:

```bash
kubectl get pvc --all-namespaces -o json | jq -r \
  --arg cutoff "$(date -u -d '30 days ago' +%Y-%m-%dT%H:%M:%SZ)" '
  .items[]
  | . as $pvc
  | (.status.conditions // [])[]
  | select(.type == "Unused" and .status == "True" and .lastTransitionTime < $cutoff)
  | [$pvc.metadata.namespace, $pvc.metadata.name, .lastTransitionTime,
     $pvc.spec.resources.requests.storage]
  | @tsv'
```

Output is one line per stale claim: namespace, name, unused-since, size.

```text
monitoring    prometheus-db-data    2026-08-01T10:00:00Z    100Gi
```

Put that in a weekly CronJob that posts to Slack and you have the "automated cleanup visibility" the viral post promised, in about eight lines. The ISO-8601 timestamps compare correctly as strings, which is what makes the `<` in jq honest.

## The caveats that keep this from biting you

**No condition is not a bug.** Right after upgrading, PVCs carry no `Unused` condition at all. The controller adds it as usage transitions are observed, so a claim that has not had a pod come or go since the feature turned on simply has nothing to report yet. Your tooling needs a three-state model: unused, in use, and not-yet-observed, which is why the query above selects explicitly instead of assuming.

**Unused means unreferenced, not deletable.** The condition says no non-terminal pod references the claim. A monthly reporting job's PVC is "unused" for 29 days at a time. A claim kept as a manual backup is "unused" forever and load-bearing. This feature gives you a review list, not a deletion list; the human step is the point.

**The controller can lag.** Conditions are reconciled from a queue, so the transition timestamp can trail the actual pod event slightly. For a 30-day threshold this is irrelevant; for a 30-minute one it is not the right tool.

**Disabling the gate freezes the conditions.** Turn the feature off and existing `Unused` conditions stay in etcd, stale. If you experiment with the gate, remember that a frozen condition looks exactly like a live one.

## About that "CSI Volume Health" line

The same viral post credits 1.37 with "new CSI Volume Health APIs". Volume health monitoring is real but it is not a 1.37 headline: it is [KEP-1432](https://github.com/kubernetes/enhancements/issues/1432), which has been developing across releases for years, with related work continuing in newer storage KEPs. Combining a genuinely-new-in-1.37 feature with a years-old one under one "1.37 fixes storage" banner is how release folklore starts, and release folklore is how upgrade plans go wrong.

Which is the general lesson we keep re-learning this release cycle: for any "Kubernetes now does X" claim, thirty seconds with the KEP's own `kep.yaml` in [kubernetes/enhancements](https://github.com/kubernetes/enhancements) tells you the real stage, the real milestone, and the real API. The features are usually good news. The screenshots are usually approximate.

## What to do with this

1. **On 1.37, nothing to enable**: the gate is on by default at beta. Give the controller time to observe transitions before expecting conditions everywhere.
2. **Wire the query into a schedule** and route it to wherever your team reviews costs. Sort by size; the top of that list is usually a few claims worth most of the money.
3. **Review, then delete deliberately**: check snapshots, check whether a seasonal workload owns the claim, then remove claim and (depending on your reclaim policy) the underlying volume.
4. **Do not build against `unusedSince`**: it does not exist. Conditions do.
