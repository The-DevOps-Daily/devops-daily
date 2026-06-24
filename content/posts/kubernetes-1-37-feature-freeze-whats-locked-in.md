---
title: 'Kubernetes 1.37 Just Locked Its Feature Set: What Made the Cut'
excerpt: 'The enhancements freeze for Kubernetes 1.37 landed on June 17, so the shape of the August release is now decided. GPU partitioning keeps maturing for AI workloads, and a cgroup v1 change will stop some kubelets from starting. Here is what is locked in and what to check before you upgrade.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2026-06-24'
publishedAt: '2026-06-24T15:00:00Z'
updatedAt: '2026-06-24T15:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - kubernetes
  - cloud-native
  - dra
  - gpu
  - upgrades
---

Every Kubernetes release has a moment where the feature set stops being a wish list and becomes a plan. That moment is the enhancements freeze, and for **Kubernetes 1.37 it landed on June 17, 2026**. After it, no new KEP joins the release; the cycle is about landing and stabilizing what already made the cut. The code freeze follows on July 22 to 23, and **1.37 ships on August 26**.

So this is the right time to look at what is coming, while there is still runway to prepare. The headline is continuity rather than fireworks: 1.37 keeps pushing on AI infrastructure, and it carries one cleanup that will stop some nodes from booting if you are not ready. Worth noting up front: until code freeze, graduation levels can still slip, so treat specifics as the current plan, not a signed release note.

## The theme: GPUs you can slice

The throughline of the last several Kubernetes releases has been Dynamic Resource Allocation (DRA), the framework that lets pods request specialized hardware (GPUs, accelerators, NICs) with far more nuance than the old "give me one GPU" model. DRA core went GA back in 1.34, and each release since has extended it.

In 1.37 the work continues on **partitionable devices** ([KEP-4815](https://github.com/kubernetes/enhancements/issues/4815)), which entered alpha in 1.36. The idea is exactly what it sounds like: take one physical GPU and carve it into smaller logical slices that schedule independently to different pods. For AI and ML teams this is the feature that matters, because a single modern accelerator is often far bigger than one inference workload needs, and bin-packing several tenants onto one card is the difference between a GPU that pays for itself and one that idles. This is the same economic pressure behind the memory and accelerator crunch we wrote about in [the Hetzner price piece](https://devops-daily.com/posts/hetzner-doubled-prices-ai-memory-crunch): when the hardware is scarce and expensive, the platform that lets you subdivide it wins.

If you run GPU workloads on Kubernetes, partitionable devices is the 1.37 line item to read the KEP on and test in a non-production cluster, because it changes how you model capacity.

## The change that can stop kubelet from starting

Here is the one that belongs on your upgrade checklist rather than your "nice to have" list. **Kubernetes 1.37 tightens the cgroup v1 retirement.** If you are still running cgroup v1 nodes and have not set `failCgroupV1: false`, the kubelet will refuse to start on 1.37. The kubelet now relies entirely on detecting the cgroup driver from the container runtime (the `KubeletCgroupDriverFromCRI` behavior that went GA in 1.36), with the legacy manual driver flags removed.

In plain terms: a node that came up fine on 1.36 can fail to come up on 1.37 if it is still on cgroup v1. Most modern distributions moved to cgroup v2 a while ago, but if you run older base images, custom node images, or long-lived on-prem hosts, check this before you roll the upgrade, not during it. The same release also completes the removal of **containerd 1.x support**: 1.37 expects containerd 2.0 or later.

Neither of these is a surprise, both have been telegraphed for several releases, but "telegraphed" and "handled in your fleet" are different things, and this is the release where the warnings turn into hard failures.

## The rest of the shape

Beyond those two, 1.37 reads as a consolidation release. DRA is the marquee work, the cgroup and containerd removals are the operational edges, and a long tail of smaller enhancements continues maturing features that went beta in 1.36 (such as the WebSocket-to-kubelet streaming work). For scale, 1.36 shipped 70 enhancements split across stable, beta, and alpha, and 1.37 continues directly from that base; the exact stable-versus-beta split for 1.37 firms up at code freeze in late July.

That "consolidation" framing is not a criticism. After several releases of aggressive AI-driven change, a cycle spent hardening DRA and finishing long-deprecated removals is exactly what operators want. The exciting releases make headlines; the consolidation releases are the ones that let you sleep.

## What to do now

1. **Audit your nodes for cgroup v1 before August.** This is the change most likely to bite. Confirm your node images are on cgroup v2, and if any are not, plan the migration or set the flag deliberately rather than discovering it when a node will not register.
2. **Confirm containerd 2.0+ across the fleet.** Pair it with the cgroup check; both are runtime-level and both turn into hard failures here.
3. **If you run GPUs, read [KEP-4815](https://github.com/kubernetes/enhancements/issues/4815) and test partitioning in staging.** It is alpha-track, so it is opt-in, but it is the feature most likely to change how you plan capacity in 2026.
4. **Wait for the official release notes before production.** 1.37 is in alpha now (1.37.0-alpha.1 landed June 10) and GA is August 26. Plan now, upgrade when it is stable and your runtime checks pass.

The pattern across 2026's Kubernetes releases has been steady: more for AI hardware, fewer escape hatches for legacy node configuration. 1.37 is squarely in that groove. The upgrade itself should be calm, as long as your nodes are on cgroup v2 and a current containerd before you start.
