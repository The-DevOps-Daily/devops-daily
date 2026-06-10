---
title: 'Karpenter Spot Storm Fallback Gap: The Production Loop Nobody Talks About'
excerpt: 'When AWS spot capacity dries up in a region, Karpenter does not automatically fall back to on-demand. It retries the same dying offerings on a 3-minute loop. Here is why, and how to design around it.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2026-05-18'
publishedAt: '2026-05-18T09:00:00Z'
updatedAt: '2026-05-18T09:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Kubernetes
  - Karpenter
  - AWS
  - Spot Instances
  - Autoscaling
  - SRE
---

Karpenter sells itself as the smart spot handler for Kubernetes on AWS. Wide instance-type pools, fast bin-packing, automatic interruption draining. Most of the time it lives up to that pitch. Then your region enters a spot-capacity storm at 3pm on a Tuesday, half your nodes get reclaimed in fifteen minutes, and Karpenter keeps trying to launch fresh spot nodes that EC2 immediately refuses. Pods stay Pending for an hour. On-demand capacity sits right there. Karpenter never touches it.

This post is a walk through that scenario: what Karpenter is actually doing during a storm, why the maintainers consider it intentional, the workarounds that hold up in production, and the metrics that catch the loop before your customers do.

## TLDR

- Karpenter caches "unavailable" spot offerings (instance-type plus AZ plus capacity-type) for a hard-coded 3 minutes, then retries. During a regional storm the retries fail again, and the loop repeats.
- Fallback to on-demand fires only when every compatible spot offering in a single NodePool gets ICE'd inside the same scheduling pass. It does not fire on interruption rate.
- Maintainers have closed the obvious "automatic spot-interruption fallback" feature request (`#8298`) as working-as-intended. The official answer is: use wider requirements, `minValues`, and weighted NodePools.
- Production posture today: a weighted spot NodePool with `minValues` across multiple instance families, a separate on-demand NodePool tainted with `karpenter.sh/capacity-type=on-demand:NoSchedule`, and alerts on `karpenter_cloudprovider_errors_total` plus `karpenter_nodeclaims_disrupted_total{reason="interruption"}`.

## Prerequisites

- A cluster running Karpenter (this post references v1 APIs; the behavior is the same on v0.32+ NodePools).
- Familiarity with NodePool, NodeClass, and the v1 `requirements` schema.
- Prometheus scraping Karpenter's `/metrics` endpoint.
- Cluster-admin or comparable RBAC for editing NodePools.

## The exact behavior during a storm

When `CreateFleet` returns `InsufficientInstanceCapacity`, `UnfulfillableCapacity`, or `MaxSpotInstanceCountExceeded`, Karpenter writes a log line like this and removes the offering from its in-memory pool:

```text
"message":"failed launching nodeclaim",
"aws-error-code":"UnfulfillableCapacity",
"aws-operation-name":"CreateFleet",
"error":"... InsufficientInstanceCapacity: We currently do not have sufficient c7i.xlarge capacity in the Availability Zone you requested (us-east-1f) ..."

"message":"removing offering from offerings",
"reason":"MaxSpotInstanceCountExceeded",
"instance-type":"r8i-flex.xlarge","zone":"us-east-1d",
"capacity-type":"spot","ttl":"3m0s"
```

That 3-minute TTL is a hard-coded constant in `pkg/cache/cache.go`. Three minutes later the offering is back in the pool. Karpenter tries it again. EC2 still does not have spot capacity for `c7i.xlarge` in `us-east-1f`. Same log lines. Same eviction. Same wait.

Meanwhile the pods stay Pending. Even if you wrote a second NodePool that allows on-demand, Karpenter will not automatically prefer it during the loop. From maintainer `DerekFrank` on `kubernetes-sigs/karpenter#2275`:

> If there aren't any on-demand `g4dn.xlarge` instances available in `us-east-1a`, it doesn't matter if Karpenter is trying to launch those from NodePool 1 or from NodePool 2. Karpenter won't retry simply because you have two NodePools.

The unit of fallback is the **offering**, not the NodePool. A NodePool that requires `karpenter.sh/capacity-type In [spot]` will never produce an on-demand node, no matter how long the storm lasts. The second NodePool exists, but the scheduler picks based on per-offering availability and per-NodePool weight, not on a "this NodePool is failing, switch" signal.

The clearest reproduction is in `aws/karpenter-provider-aws#8885`: an Orca Security engineer ran a 1000-replica nginx deployment against weighted spot and on-demand NodePools during a real us-east-1 spot storm. 471 pods stayed Pending for more than an hour. The on-demand NodePool was untouched.

## Why the maintainers consider this intentional

Two design positions, both still standing as of writing:

**The 3-minute TTL is a feature, not a bug.** From `jmdeal` on `#8298`:

> Karpenter does keep track of spot interruption events, but a spot interruption will only cause the instance type to be excluded from launch requests for 3 minutes. Spot availability can change quickly, so we don't want to opt out of using spot for too long.

The argument is that AWS spot pools recover fast. If Karpenter dropped the offering for an hour after one ICE event, you would miss capacity coming back online. So the cache stays short.

**The official solution is wide requirements plus `minValues`, not automatic fallback.** Karpenter assumes that if you give EC2 enough latitude in the `CreateFleet` call (many instance families, multiple sizes, multiple AZs), the price-capacity-optimized strategy will find a spot pool with capacity. Issue `#8298`, which asked for "automatic spot interruption detection and on-demand fallback," was closed without implementation.

This is internally consistent. It is also a bad fit for two real-world scenarios:

1. **Workloads with narrow instance-type constraints.** GPU pods, license-pinned workloads, anything that pins to a specific family. The pool of compatible offerings is small. When it dries up, there is nothing for `CreateFleet` to fall back to within the spot capacity-type.
2. **Regional spot storms.** When a whole region has spot pressure, widening requirements does not help. Every family is ICE'd.

For both cases you need an explicit fallback path. Karpenter will not build it for you.

## Workaround 1: weighted NodePools with wide requirements

The official pattern. The spot NodePool runs at high weight and very wide requirements. The on-demand NodePool runs at low weight and is intended as the safety net.

```yaml
apiVersion: karpenter.sh/v1
kind: NodePool
metadata:
  name: spot
spec:
  weight: 100
  template:
    spec:
      requirements:
        - key: karpenter.sh/capacity-type
          operator: In
          values: ["spot"]
        - key: karpenter.k8s.aws/instance-family
          operator: In
          values: ["c7i", "c6i", "m7i", "m6i", "r7i", "r6i"]
          minValues: 6
        - key: karpenter.k8s.aws/instance-cpu
          operator: In
          values: ["2", "4", "8"]
          minValues: 3
        - key: kubernetes.io/arch
          operator: In
          values: ["amd64"]
      nodeClassRef:
        group: karpenter.k8s.aws
        kind: EC2NodeClass
        name: default
---
apiVersion: karpenter.sh/v1
kind: NodePool
metadata:
  name: on-demand-fallback
spec:
  weight: 10
  template:
    spec:
      requirements:
        - key: karpenter.sh/capacity-type
          operator: In
          values: ["on-demand"]
        - key: karpenter.k8s.aws/instance-family
          operator: In
          values: ["c7i", "c6i", "m7i", "m6i", "r7i", "r6i"]
          minValues: 6
        - key: karpenter.k8s.aws/instance-cpu
          operator: In
          values: ["2", "4", "8"]
          minValues: 3
        - key: kubernetes.io/arch
          operator: In
          values: ["amd64"]
      nodeClassRef:
        group: karpenter.k8s.aws
        kind: EC2NodeClass
        name: default
```

The `minValues` requirement is the single most important knob during a storm. `minValues: 6` on `instance-family` forces `CreateFleet` to evaluate six different families in the same call. EC2's price-capacity-optimized strategy picks whichever has capacity. You go from "the c7i pool is empty, fail" to "the c7i pool is empty, try m7i, m6i, r7i, r6i, c6i."

Caveat from the Karpenter docs themselves: weighted NodePools are a preference, not a policy.

> Based on the way that Karpenter performs pod batching and bin packing, it is not guaranteed that Karpenter will always choose the highest priority NodePool given specific requirements.

Treat weight as a tiebreaker that mostly works, not a guarantee.

## Workaround 2: capacity-type taint on the on-demand pool

Without a taint, pods can land on either NodePool. With a heavy spot workload that occasionally bursts to on-demand, you want pods to prefer spot even when on-demand is available. A taint on the on-demand NodePool forces an explicit toleration:

```yaml
apiVersion: karpenter.sh/v1
kind: NodePool
metadata:
  name: on-demand-fallback
spec:
  weight: 10
  template:
    spec:
      taints:
        - key: karpenter.sh/capacity-type
          value: on-demand
          effect: NoSchedule
      requirements:
        - key: karpenter.sh/capacity-type
          operator: In
          values: ["on-demand"]
        # ... family/cpu/arch as above
```

Workloads that should fail over add the toleration:

```yaml
spec:
  tolerations:
    - key: karpenter.sh/capacity-type
      operator: Equal
      value: on-demand
      effect: NoSchedule
```

This gives you two benefits. First, on-demand becomes opt-in per workload, so a misconfigured deployment cannot accidentally burn money. Second, your dashboards now show "on-demand nodes provisioned" as a clean signal that fallback fired, since on-demand only happens for tolerating workloads.

## Workaround 3: a tiny external controller

There is no upstream-blessed operator for spot-storm detection. Some teams build a small controller that watches Karpenter's error metrics and patches the spot NodePool to temporarily remove `spot` from `karpenter.sh/capacity-type` when interruption rates spike. The shape is straightforward:

```text
1. Watch karpenter_cloudprovider_errors_total{error=~"Insufficient.*|Unfulfillable.*"}
2. If rate > threshold for N minutes, patch the spot NodePool:
     requirements:
       - key: karpenter.sh/capacity-type
         operator: In
         values: ["on-demand"]
3. After M minutes of error-rate quiet, revert.
```

This is not a substitute for workarounds 1 and 2. It is what you build when narrow-constraint workloads (GPU, instance-pinned) still need a fallback path. Treat it as an internal tool, not a product.

## Metrics that catch the storm

Karpenter exposes a useful set of cloudprovider metrics. The ones that matter during a storm:

- `karpenter_cloudprovider_errors_total`: label `error` carries `InsufficientInstanceCapacity`, `UnfulfillableCapacity`, `MaxSpotInstanceCountExceeded`. A spike is the storm starting.
- `karpenter_cloudprovider_instance_type_offering_available`: gauge per `instance_type` / `capacity_type` / `zone`. Watch the sum drop.
- `karpenter_nodeclaims_created_total`, `karpenter_nodeclaims_terminated_total`, `karpenter_nodeclaims_disrupted_total{reason="interruption"}`: when `disrupted{reason=interruption}` rate approaches `created` rate, you are churning.
- `karpenter_interruption_received_messages_total{message_type="SpotInterruptionKind"}`: spot 2-minute warnings from the SQS queue.
- `karpenter_voluntary_disruption_decisions_total`, `karpenter_voluntary_disruption_queue_failures_total`.

A working Prometheus alert that has caught real storms in production:

```yaml
- alert: KarpenterSpotStorm
  expr: |
    sum(rate(karpenter_nodeclaims_disrupted_total{reason="interruption"}[10m])) > 0.05
    and
    sum(rate(karpenter_cloudprovider_errors_total{error=~"InsufficientInstanceCapacity|UnfulfillableCapacity"}[10m])) > 0.1
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "Karpenter is looping on spot capacity errors"
    description: |
      Spot interruption rate is above 0.05/s AND CreateFleet capacity
      errors are above 0.1/s for 10m. The 3-minute offering TTL is
      probably looping. Consider temporarily widening the on-demand
      NodePool weight or removing 'spot' from the capacity-type
      requirement until the region clears.
```

The `AND` matters. Either signal alone is noisy. Together they describe the loop specifically.

## Known bugs in the metrics themselves

A few sharp edges worth knowing about before you build a dashboard on these:

- `karpenter_interruption_received_messages_total{message_type="SpotInterruptionKind"}` includes account-wide spot interruption events, not just Karpenter-managed instances. It will not match `karpenter_nodeclaims_terminated_total{reason="interruption"}`. Issue `aws/karpenter-provider-aws#6376` is still open as of writing.
- Earlier versions of Karpenter (around v0.37.0) incremented `karpenter_interruption_received_messages_total` by 2 per event. The fix shipped, but worth verifying against the cluster version you actually run. Issue `#6531`.
- Metrics scraped from the standby (non-leader) replica return zeros or stale values, so scraping the Service can yield phantom drops. Issue `kubernetes-sigs/karpenter#1450`. Scrape the Pod, not the Service, or scrape both and reconcile.
- `karpenter_cloudprovider_errors_total` does not carry a `nodepool` label. You cannot alert directly on "the spot NodePool is storming." Infer it from the `capacity_type` label if your provider build labels it, and confirm against your version. Open ask in `#8224`.

## What to expect from the roadmap

As of writing, none of the obvious "automatic fallback" feature requests are scheduled. Issue `#8298` was closed without implementation. Issue `#2275` was closed as working-as-intended in January 2026. The configurable cache TTL and NodePool-aware metrics in `#8224` are still open with no design doc attached.

This is not because the maintainers don't care. It is because the architectural answer they are committed to (wide requirements plus `minValues` plus weighted NodePools) covers most cases. The cases it does not cover (narrow-constraint workloads, regional storms) are real, but rare enough that the project has not prioritized building the fallback machinery.

Practically, this means the production posture is yours to design. Plan for the storm.

## Summary

Karpenter does not auto-fail-over from spot to on-demand. The 3-minute offering TTL plus per-offering retry semantics produce a tight loop during regional capacity storms that can keep workloads Pending for hours while on-demand capacity sits idle. The maintainers consider this intentional and recommend wide instance-type requirements plus weighted NodePools as the answer.

In production, run:

1. A spot NodePool with at least six instance families and `minValues: 6` on family, plus `minValues` on CPU.
2. A separate on-demand NodePool with a `karpenter.sh/capacity-type=on-demand:NoSchedule` taint so fallback is opt-in.
3. A Prometheus alert that pairs `karpenter_nodeclaims_disrupted_total{reason="interruption"}` rate with `karpenter_cloudprovider_errors_total` rate, firing only when both spike together.
4. An internal runbook that documents how to temporarily remove `spot` from the spot NodePool's `karpenter.sh/capacity-type` values during a storm, since Karpenter will not do it for you.

The smart spot handler is still the right default. Just don't trust it to handle the day spot capacity stops being a thing.
