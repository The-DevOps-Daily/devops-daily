---
title: 'Kubernetes 1.37 Garhwal: What Shipped and What Slipped'
excerpt: 'Kubernetes 1.37 landed on August 26 with 67 enhancements: 16 stable, 23 beta, 27 alpha. We checked the release against the June feature-freeze plan, KEP by KEP. Pod-level resources and Pod Certificates made stable, the GPU-slicing feature everyone watched did not graduate, and the ipvs removal clock is now running.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2026-08-27'
publishedAt: '2026-08-27T15:00:00Z'
updatedAt: '2026-08-27T15:00:00Z'
readingTime: '11 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Kubernetes
  - cloud-native
  - dra
  - upgrades
  - kube-proxy
---

Kubernetes 1.37 shipped on August 26, right on the schedule set back in June. The release is named **Garhwal**, after the Himalayan region of Uttarakhand, India, and it carries **67 enhancements: 16 graduating to stable, 23 to beta, 27 entering alpha, plus one deprecation**.

When [the 1.37 feature set froze in June](https://devops-daily.com/posts/kubernetes-1-37-feature-freeze-whats-locked-in) we wrote that graduation levels could still slip and that the specifics were "the current plan, not a signed release note". The release note is signed now. This post checks what actually shipped against that plan, sourced from the [official release announcement](https://kubernetes.io/blog/2026/08/26/kubernetes-v1-37-release/), the [v1.37 sneak peek](https://kubernetes.io/blog/2026/07/31/kubernetes-v1-37-sneak-peek/), and the KEP files in [kubernetes/enhancements](https://github.com/kubernetes/enhancements), because third-party roundups disagree with each other on several graduations this cycle. More on that below.

## TLDR

- **Went stable:** pod-level resources, Pod Certificates, ClusterTrustBundles, configurable HPA tolerance, KYAML output for kubectl, and DRA device taints and tolerations.
- **Did not graduate:** partitionable devices (KEP-4815), the GPU-slicing feature we called the line item to watch in June. It stays beta, where it has been since 1.36.
- **New since the freeze post:** kube-proxy `ipvs` mode is now formally deprecated, with removal scheduled for 1.43.
- **Still true from June:** cgroup v1 nodes fail to start kubelet unless you explicitly opt out, so audit before you roll.
- **Fact-check note:** at least one widely shared roundup lists the CBOR serializer as stable in 1.37. The KEP says beta. Check graduations against the KEP files, not against blog posts, ours included.

## Prerequisites

- A cluster you care about upgrading, on 1.35 or 1.36
- Basic familiarity with feature gates and the KEP process
- Ten minutes with your node images before you touch the control plane

## The operator checklist first

Features are optional; breakage is not. Four items in 1.37 belong on the upgrade checklist.

**cgroup v1 nodes will not start.** This was the headline warning in our June post and it shipped as planned. The kubelet fails to initialize on cgroup v1 nodes unless `failCgroupV1: false` is set explicitly, a default that has been in place since 1.35. Modern distributions are on cgroup v2, but long-lived on-prem hosts and custom node images are exactly where v1 lingers. Check before the upgrade, not during.

**The ipvs countdown started.** This one arrived after our freeze post, announced in the July sneak peek. kube-proxy's `ipvs` mode logs a deprecation warning on startup in 1.37, is expected to be disabled by default in 1.40, and is scheduled for removal in 1.43 ([KEP-5495](https://github.com/kubernetes/enhancements/issues/5495)). The stated reason is honest engineering: the kernel ipvs API alone cannot implement Kubernetes Services, so ipvs mode has always leaned on iptables underneath. The successor is nftables mode, and 1.37 also starts alpha work toward making nftables the default backend. Find out what you are running:

```bash
kubectl -n kube-system get configmap kube-proxy \
  -o jsonpath='{.data.config\.conf}' | grep 'mode:'
```

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "1.37", "sub": "ipvs logs deprecation warning", "icon": "activity", "tone": "amber" },
    { "label": "1.40", "sub": "ipvs off by default", "icon": "gear", "tone": "amber" },
    { "label": "1.43", "sub": "ipvs removed", "icon": "shield", "tone": "red" },
    { "label": "nftables", "sub": "the successor backend", "icon": "net", "tone": "green" }
  ]
}
```

Three releases a year makes 1.43 land around early 2028. That sounds far away; fleet migrations that touch every node's traffic path are exactly the projects that need that much runway.

**Static pods lose API references.** Static pods can no longer reference Secrets or ConfigMaps through `secretRef` or `configMapRef`, and the `PreventStaticPodAPIReferences` feature gate is gone ([#140226](https://github.com/kubernetes/kubernetes/issues/140226)). The logic: static pods are not created through the API server, so they should not consume API objects. If your control-plane manifests or node bootstrap tooling relied on this, they break here.

**kubectl run --filename is deprecated.** A small one, but it shows up in scripts: `kubectl run -f` never actually used the file for anything beyond what the CLI flags provided, and it is now deprecated ([#138671](https://github.com/kubernetes/kubernetes/issues/138671)). Use `kubectl apply -f` or `kubectl create -f`.

## What made stable, and why it matters

We verified each of these against the KEP's own `kep.yaml`, which records the milestone per stage.

**Pod-level resources ([KEP-2837](https://github.com/kubernetes/enhancements/issues/2837), alpha 1.33, beta 1.34, stable 1.37).** You can now set CPU and memory requests and limits for the pod as a whole, not only per container. Sidecar-heavy pods get the practical win: instead of padding every container's request for its worst case, you give the pod a shared budget that containers draw from.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-with-sidecars
spec:
  resources:            # pod-level, stable in 1.37
    requests:
      cpu: '1'
      memory: 1Gi
    limits:
      memory: 2Gi
  containers:
    - name: app
      image: registry.example.com/app:1.4.2
    - name: log-shipper
      image: registry.example.com/shipper:2.1.0
      # no per-container requests needed; the pod budget covers both
```

**Configurable HPA tolerance ([KEP-4951](https://github.com/kubernetes/enhancements/issues/4951), stable 1.37).** The Horizontal Pod Autoscaler's scaling tolerance was a cluster-wide constant (10%) for a decade. It is now settable per HPA, which is the difference between one twitchy workload flapping and being able to tune that one workload without touching the fleet:

```yaml
behavior:
  scaleUp:
    tolerance: 0.03   # this HPA reacts to a 3% metric change
  scaleDown:
    tolerance: 0.15   # but scales down lazily
```

**Pod Certificates ([KEP-4317](https://github.com/kubernetes/enhancements/issues/4317), stable 1.37) and ClusterTrustBundles ([KEP-3257](https://github.com/kubernetes/enhancements/issues/3257), stable 1.37).** Together these are the release's quiet workload-identity story: pods can obtain X.509 certificates through a `PodCertificateRequest` API and a projected volume, and clusters get a first-class object for distributing trust anchors. If you run a service mesh or cert-manager purely to give workloads certificates and roots, the primitives to do it with less machinery are now GA.

**KYAML output for kubectl ([KEP-5295](https://github.com/kubernetes/enhancements/issues/5295), stable 1.37).** `kubectl get ... -o kyaml` emits a flow-style YAML subset designed to dodge the classic YAML traps (the Norway problem, accidental type coercion, whitespace sensitivity). Worth adopting in scripts that parse kubectl output.

**DRA device taints and tolerations ([KEP-5055](https://github.com/kubernetes/enhancements/issues/5055), stable 1.37).** Drivers or admins can taint a device (degraded, scheduled for maintenance) and workloads tolerate it or avoid it, the same mental model as node taints, applied per accelerator. This is the DRA graduation of the cycle.

## The GPU story: what did not graduate

In June we called **partitionable devices ([KEP-4815](https://github.com/kubernetes/enhancements/issues/4815))**, the framework for slicing one physical GPU into independently schedulable logical devices, "the 1.37 line item to read the KEP on". Checking the KEP now: alpha in 1.33, beta in 1.36, and its latest recorded milestone is still **v1.36**. It did not graduate in 1.37.

That is not a failure, it is how the process is supposed to work: graduating a scheduling-critical feature takes production evidence, and one more cycle at beta is the boring, correct call. But if you planned 2026 GPU capacity around it going GA this cycle, adjust: it remains beta, feature-gated, and subject to change. The DRA work that did land, device taints going stable and device status reporting IPs and MAC addresses in resource claims, keeps hardening the platform underneath it.

## A note on trusting release roundups

While fact-checking this post we found third-party 1.37 roundups disagreeing with each other: one lists the CBOR serializer as graduating to stable, another lists ClusterTrustBundles as beta. The KEP files say otherwise: **CBOR ([KEP-4222](https://github.com/kubernetes/enhancements/issues/4222)) is beta in 1.37** with an empty stable milestone, and ClusterTrustBundles is stable.

:::tip
The authoritative record for any graduation claim is the KEP's own `kep.yaml` in [kubernetes/enhancements](https://github.com/kubernetes/enhancements), which lists the milestone per stage. Thirty seconds of checking beats propagating someone else's summary, and this applies to our summaries too.
:::

## What to do now

1. **Audit nodes for cgroup v1 and containerd versions** before scheduling the upgrade. The kubelet-will-not-start failure mode is the one that turns an upgrade window into an incident.
2. **Record your kube-proxy mode.** If it is `ipvs`, open a migration ticket now with a 1.40 deadline, and evaluate nftables mode (kernel 5.13+) rather than falling back to iptables.
3. **Grep manifests for static pods using `secretRef`/`configMapRef`** and for scripts calling `kubectl run -f`. Both are cheap to fix ahead of time.
4. **If sidecar padding inflates your requests, trial pod-level resources** in staging; it is stable and it directly reduces over-provisioning.
5. **If you planned around GPU partitioning going GA, revisit the plan.** It is still beta. Test it behind the gate, do not bet capacity on it.

1.37 confirms the pattern we described in June: steady hardening for AI hardware, fewer escape hatches for legacy node configuration, and deprecations that arrive with multi-release clocks attached. The upgrade should be calm, provided the checklist above is boring by the time you start it.
