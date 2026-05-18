---
title: 'Cilium 1.19 ClusterMesh Policy Flip: The Silent Default That Will Drop Your Cross-Cluster Traffic'
excerpt: 'Cilium 1.19 changed how network policies without a cluster selector resolve in a ClusterMesh. East/West traffic that 1.18 implicitly allowed is now silently dropped. Here is how to find every affected policy before you upgrade.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2026-05-18'
publishedAt: '2026-05-18T09:00:00Z'
updatedAt: '2026-05-18T09:00:00Z'
readingTime: '11 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Kubernetes
  - Cilium
  - ClusterMesh
  - Network Policy
  - eBPF
  - Networking
---

The Cilium 1.19 changelog is long. Most of it is fine. One line tucked in the upgrade guide will quietly break ClusterMesh deployments that did not prepare for it: the policy-default-local-cluster flag is now on by default. Network policies that used to implicitly match endpoints across every connected cluster now match only the local cluster. East/West traffic that worked yesterday gets dropped today, with nothing in the policy you wrote to explain why.

This post is the pre-upgrade walkthrough. What changed, what concretely breaks, the `cilium clustermesh inspect-policy-default-local-cluster` command that lists every affected policy on your live 1.18 cluster, and the safe order to roll the upgrade. There is also a side-section on the new strict-encryption knobs in 1.19, since those are easy to misread as a default flip too.

## TLDR

- **The silent break:** `policy-default-local-cluster` defaults to `true` in 1.19. CiliumNetworkPolicies without an explicit `io.cilium.k8s.policy.cluster` selector now match only local-cluster endpoints. Implicit cross-cluster matches stop working.
- **The fix is a pre-upgrade audit, not a code change.** Run `cilium clustermesh inspect-policy-default-local-cluster --all-namespaces` on the 1.18 cluster. Treat the output as your migration TODO.
- **The escape hatch:** set `clustermesh.policyDefaultLocalCluster: false` in Helm during the upgrade window to keep 1.18 semantics while you migrate.
- **Encryption strict mode is opt-in, not flipped.** 1.19 adds a new ingress strict mode and renames the old egress keys. If your `values.yaml` still uses `encryption.strictMode.enabled`, that is now `encryption.strictMode.egress.enabled`. The deprecation warning today becomes a removal in 1.20.

## Prerequisites

- A Cilium ClusterMesh between two or more Kubernetes clusters, currently on 1.18.x.
- Cluster-admin RBAC on each cluster.
- `cilium` CLI v0.16+ installed locally (the inspect command landed alongside the 1.19 release).
- Hubble running. If you don't run Hubble in production, this upgrade is a good reason to start; the validation steps below depend on it.

## What actually changed in 1.19

Two unrelated things people are conflating. Take them one at a time.

### 1. ClusterMesh policy default (the silent-break one)

From the 1.19 upgrade guide:

> Cilium network policies used to implicitly select endpoints from all the clusters. Cilium 1.18 introduced a new option called `policy-default-local-cluster` which will be set by default in Cilium 1.19.

And from the 1.19.0 release notes:

> When network policy selectors don't explicitly define a cluster for communication to be allowed, they will now default to only allowing the local cluster.

The mechanic: before 1.19, a `fromEndpoints` selector like

```yaml
fromEndpoints:
  - matchLabels:
      app: web
```

matched every pod labelled `app: web` in every cluster in the mesh. After 1.19 (with the default), it matches only pods in the local cluster. To preserve the old semantics you have to be explicit:

```yaml
fromEndpoints:
  - matchLabels:
      app: web
      io.cilium.k8s.policy.cluster: "*"     # all clusters in the mesh
# or
fromEndpoints:
  - matchLabels:
      app: web
      io.cilium.k8s.policy.cluster: cluster-east
```

This change is a security improvement. Implicit cross-cluster trust was a frequent source of "we didn't realize that policy reached the staging cluster." But for clusters that intentionally relied on it for legitimate East/West traffic, the upgrade silently severs the path. PR `cilium/cilium#40609`.

### 2. Encryption strict modes (new knobs, not a default flip)

The release-note line that has been getting misread:

> Encryption Strict Modes: Both IPsec and WireGuard transparent encryption modes now support a "strict mode" to require traffic to be encrypted between nodes. Unencrypted traffic will be dropped in this mode.

Three actual changes here, none of which flip on by default:

1. A new **ingress** strict mode was added. Previous releases only had an egress strict mode. Flag: `--enable-encryption-strict-mode-ingress`. Helm: `encryption.strictMode.ingress.enabled`.
2. IPsec strict mode was generalized from WireGuard, so the same strict-mode semantics now exist for both transports. PR `#42115`.
3. The pre-existing egress strict-mode Helm keys were **renamed**. `encryption.strictMode.enabled` is deprecated in favor of `encryption.strictMode.egress.enabled`. The old keys still work in 1.19 with a warning. They are scheduled for removal in 1.20.

If you are not running strict mode today, this section does not change anything for you on upgrade. If you are, you have a `values.yaml` rename to do. Either way, do not enable strict ingress and the ClusterMesh policy migration in the same change window.

## What concretely breaks on a naive `helm upgrade`

| Surface | Behavior post-upgrade |
|---|---|
| ClusterMesh East/West traffic with implicit selectors | Dropped at policy enforcement. Hubble shows `verdict: DROPPED, type: policy-verdict`. |
| Existing strict-mode encryption with old Helm keys | Still works, emits deprecation warning. Will break on 1.20. |
| Mutual Authentication | Now disabled by default. Re-enable explicitly if you depend on it. |
| `CiliumBGPPeeringPolicy` v1 API | Removed. Migrate to `cilium.io/v2` before upgrading. |
| Kafka L7 policy, `ToRequires`, `FromRequires` | Deprecated. Surfaces as warnings, no behavior change yet. |
| Host-network pods | Unchanged, unless you also enable ingress strict mode. |

The only line in that table that silently breaks a naive upgrade is the first one. Everything else either preserves behavior (deprecation warnings), is opt-in (strict ingress), or is a known API removal (BGP v1) that surfaces loudly.

## Pre-flight on the live 1.18 cluster

The command that matters:

```bash
cilium clustermesh inspect-policy-default-local-cluster --all-namespaces
```

This walks every CiliumNetworkPolicy in the cluster, identifies selectors that would implicitly match across clusters in 1.18, and lists them. The output is your migration TODO. You will not get a second chance to run it after upgrade, because once you are on 1.19 the implicit matches no longer exist to inspect.

For each policy in the output, decide:

- **The cross-cluster match was intentional.** Add `io.cilium.k8s.policy.cluster: "*"` to the selector, or list the specific cluster names. Keep behavior identical post-upgrade.
- **The cross-cluster match was accidental.** Do nothing. 1.19 will tighten the policy to local-only, which is what you wanted anyway.

If your audit produces a list you can't finish in a maintenance window, set the escape hatch:

```yaml
# values.yaml on the upgrade
clustermesh:
  policyDefaultLocalCluster: false   # keep 1.18 semantics for one release
```

This is a one-release stay of execution. You upgrade to 1.19, run with 1.18 policy semantics, finish migrating the policies, then flip `policyDefaultLocalCluster: true` and validate. Don't let it sit there past one release.

## Detecting drops with Hubble

You will need Hubble both for pre-flight validation and post-upgrade verification.

```bash
# Cross-cluster traffic that currently works, BEFORE upgrade.
# Capture a representative window — a full day if your workload is daily-batchy.
hubble observe \
  --cluster <remote-cluster-name> \
  --verdict FORWARDED \
  --since 24h \
  --output jsonpb > pre-upgrade-east-west.jsonl
```

Save that file. It is the ground truth of what worked. Post-upgrade, you re-run the equivalent query and diff. Any traffic that was FORWARDED before and is now DROPPED is a policy you missed.

After upgrade, watch for policy drops with the originating rule attribution (1.19 includes the rule name in drop events, which 1.18 did not):

```bash
# Policy drops with rule names
hubble observe --verdict DROPPED --type policy-verdict --since 10m -f
```

Strict-encryption-specific filters added in 1.19 (PR `#43096`):

```bash
hubble observe --unencrypted --since 5m   # cleartext flows
hubble observe --encrypted                # encrypted flows
```

Useful even if you are not flipping strict mode, because it confirms encryption is happening where you expect.

## Prometheus metrics worth alerting on

```promql
# Sudden policy-drop spike after upgrade
rate(cilium_drop_count_total{reason="Policy denied"}[5m])

# Forward/drop ratio inversion is the clearest "something broke" signal
sum(rate(cilium_forward_count_total[5m]))
  /
sum(rate(cilium_drop_count_total[5m]))

# IPsec health (worth watching if you are running encryption at all,
# strict or not)
cilium_ipsec_xfrm_error
cilium_ipsec_xfrm_states{direction="in"}

# Confirm transparent encryption is on where you expect
cilium_feature_datapath_transparent_encryption{mode="wireguard"}
```

The metric names have shifted a bit across releases. The 1.19 metrics reference documents the current set. If you have alerts on `cilium_policy_l7_denied_total` from older docs, double-check the metric is still emitted under that exact name on 1.19 before relying on it.

## The safe enable-order

Sequence the upgrade so each change is isolated. The whole sequence is one release cycle, not one maintenance window.

```text
Day 0 (1.18, planning)
  - Run: cilium clustermesh inspect-policy-default-local-cluster --all-namespaces
  - Audit. Add io.cilium.k8s.policy.cluster selectors to policies that
    intentionally cross clusters.
  - Capture a baseline:
      hubble observe --cluster <remote> --verdict FORWARDED --since 24h
        > pre-upgrade-east-west.jsonl
  - Rename any encryption.strictMode.* Helm keys to encryption.strictMode.egress.*

Day 1 (1.18 to 1.19 upgrade)
  - helm upgrade with:
      clustermesh.policyDefaultLocalCluster: false
      encryption.strictMode.ingress.enabled: false
  - Validate connectivity unchanged.

Day 1+1h (post-upgrade gate)
  - Re-run hubble observe --cluster <remote> --verdict FORWARDED.
    Diff against pre-upgrade-east-west.jsonl. Should be approximately identical.
  - hubble observe --verdict DROPPED --type policy-verdict.
    Quiet for legitimate traffic.

Day 7 (audit complete)
  - Flip clustermesh.policyDefaultLocalCluster: true
  - Watch cilium_drop_count_total{reason="Policy denied"} for an hour.
    Spikes mean a policy still relies on implicit cross-cluster.

Day 8+ (optional strict encryption rollout)
  - If you want strict ingress encryption, enable it on one node first
    via per-node config override.
  - hubble observe --unencrypted should be quiet for that node's
    workloads.
  - Roll node by node.
```

A small thing that matters: do not flip `policyDefaultLocalCluster` and enable ingress strict mode in the same change window. You cannot tell which one caused a drop if both fire at once.

## Recovery, if you skipped the audit

If you have already upgraded without running the inspect command and traffic is being dropped:

1. Roll the Helm value: `clustermesh.policyDefaultLocalCluster: false`. This restores 1.18 semantics. East/West traffic resumes.
2. Run `cilium clustermesh inspect-policy-default-local-cluster --all-namespaces` (it works on 1.19 too, it just lists policies that *would* differ if you flipped the default).
3. Migrate the policies.
4. Flip the value back to `true`.

This is recoverable. It is also avoidable. Run the inspect command on 1.18 and you skip the firefight.

## Summary

The 1.19 ClusterMesh policy-default flip is the one upgrade item that silently breaks production. The encryption strict-mode changes are knobs, not defaults. The order of operations to upgrade cleanly:

1. Audit policies on 1.18 with `cilium clustermesh inspect-policy-default-local-cluster --all-namespaces`. Add explicit `io.cilium.k8s.policy.cluster` selectors where cross-cluster traffic was intentional.
2. Upgrade with `clustermesh.policyDefaultLocalCluster: false` as a one-release escape hatch.
3. Rename any deprecated `encryption.strictMode.*` Helm keys to `encryption.strictMode.egress.*`.
4. Validate post-upgrade with Hubble against a pre-upgrade traffic capture.
5. Flip `policyDefaultLocalCluster` back to `true` once the audit is complete and traffic is clean.
6. Roll ingress strict encryption separately, node by node, only after the policy migration has settled.

The hardest part of this upgrade is not the upgrade. It is the audit. Run the inspect command on your live 1.18 cluster today, before the maintenance window. The rest of the steps are mechanical.
