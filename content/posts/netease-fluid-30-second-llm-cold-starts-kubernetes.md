---
title: "How NetEase Games Cut LLM Cold Starts From 42 Minutes to 30 Seconds Using Fluid"
excerpt: "NetEase Games published a Kubernetes case study walking through how they took their serverless GPU inference cold-start time from 42 minutes down to under 30 seconds. The bottleneck isn't the GPU. It's the 60GB model weights crossing a region. Here is what they did with the CNCF Fluid project and how to apply the same pattern even if you are not on Kubernetes."
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2026-05-26'
publishedAt: '2026-05-26T11:00:00Z'
updatedAt: '2026-05-26T11:00:00Z'
readingTime: '11 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: true
tags:
  - Kubernetes
  - DevOps
  - AI
  - GPU
  - CNCF
---

NetEase Games published a case study on the CNCF blog last week walking through how they took serverless LLM inference cold-start times from a wince-inducing 42 minutes down to roughly 30 seconds. The framing line in the post is the one worth taping above your desk: **"elastic compute is only useful if data can move just as fast."** If you run inference workloads on Kubernetes and you have ever waited for a model to "warm up" on a fresh pod, you have hit this wall.

The interesting thing about the case study isn't the headline 84x speedup. It's the staircase. They publish four numbers, each a different architecture, each a meaningful intermediate stop. The path looks like this:

```text
Cross-region direct access from S3-like storage    : 42 minutes
Traditional cache layer (raw Alluxio)              : 14 minutes
Fluid-based prefetching                            :  3 minutes
Production-tuned Fluid with proactive warmup       : 30 seconds (sometimes under)
```

Each step is a different bet about where the bottleneck actually is. This post walks through the bets, why they paid off, and what patterns transfer to your stack if you are not running NetEase's exact architecture.

## TL;DR

- A modern LLM serving pod has to pull tens of GB of model weights before it can answer a single request. That pull is the cold-start. The GPU is sitting idle the whole time.
- Direct pulls from object storage across a region are bandwidth-and-latency bound. 42 minutes is what you get if you assume cloud-native means "let the storage layer handle it."
- A naive Alluxio cache in front of the storage cuts 3x. A naive cache is not enough.
- Fluid is a CNCF project (incubating) that wraps Alluxio (or JindoCache, or JuiceFS) with a dataset CRD, scheduled prefetch workflows, and CSI/sidecar injection. The wrapper is the value, not the cache.
- The last 10x came from proactive warmup, treating the dataset as a workload to schedule rather than a side concern.
- You can apply most of this pattern without Fluid if you are not on Kubernetes. The principles are: place the cache on the inference node, warm the cache before the pod starts, and treat model weights as a first-class artifact, not a runtime dependency.

## Prerequisites

- A workload where cold-start matters. Production inference, autoscaling LLM endpoints, serverless GPU jobs.
- Models in the 10-100GB range. The numbers below scale linearly with weight size.
- Familiarity with Kubernetes manifests and PV/PVC if you want to apply Fluid directly. The principles section at the end is K8s-agnostic.

## Why the cold start is 42 minutes in the first place

A serverless LLM endpoint goes through this on every scale-up:

1. Scheduler places a pod on a node with a free GPU.
2. Container image pulls (a few GB if you're disciplined, 20+ GB if you've bundled CUDA libraries badly).
3. The container starts, the runtime initializes, and the model loading code tries to open the weights.
4. The weights are not on the local disk. They are in S3, GCS, or an internal object store, maybe in a different region from the GPU node.
5. The model loader streams 30-60 GB across that network link, decodes the shards, and copies them into GPU memory.
6. First request can finally be served.

The cross-region throughput on cloud object storage is realistically 200-400 MB/s sustained from a single client. A 60 GB model at 300 MB/s is 3.5 minutes if everything goes perfectly. In practice, you also get retries, redirect overhead, multi-shard sequential reads, and the model loader doing extra work (verifying checksums, building a tokenizer's vocab, allocating GPU memory in chunks). 42 minutes is the realistic worst case when the model is on the other side of a continent and nobody has thought about warming a cache.

## Bet 1: put a cache layer in front of object storage

Step one is the textbook fix. Put [Alluxio](https://www.alluxio.io/) (or any distributed cache) in front of your object store. The first pod that wants a model pulls it once, subsequent pods on the cluster get it from the local cache cluster instead of crossing the region.

NetEase measured this at 14 minutes. Still painful, but 3x better. The reason a raw Alluxio cluster doesn't get you all the way to 30 seconds is the cache doesn't know which models to warm. If the first cold-start of the day is what triggers the cache fill, the first user still waits 42 minutes. Every subsequent pod for the same model is fast, but the moment you autoscale to a new model variant or your fleet horizontally scales, you're back at step one.

The conclusion the team arrived at is the same conclusion every serious LLM inference platform reaches: **caches that are passive are not good enough.** You have to know what you're going to need and start moving it ahead of time.

## Bet 2: Fluid as the dataset CRD on top of the cache

[Fluid](https://github.com/fluid-cloudnative/fluid) is a CNCF incubating project that does something subtle. It treats datasets as Kubernetes-native objects. You declare a `Dataset` and a `Runtime` resource, and Fluid orchestrates the cache layer, scheduling, and pod-to-cache binding for you.

A minimal Fluid setup looks like this:

```yaml
apiVersion: data.fluid.io/v1alpha1
kind: Dataset
metadata:
  name: llama-3-70b
spec:
  mounts:
    - mountPoint: s3://models.example/llama-3-70b/
      name: weights
  accessModes:
    - ReadOnlyMany
---
apiVersion: data.fluid.io/v1alpha1
kind: AlluxioRuntime
metadata:
  name: llama-3-70b
spec:
  replicas: 3                   # how many cache workers
  tieredstore:
    levels:
      - mediumtype: SSD
        path: /mnt/cache
        quota: 200Gi
```

Two YAMLs and Fluid spins up a cache cluster on the nodes you specify, mounts the S3 bucket behind it, and exposes a PVC your inference pods can mount as if the weights were already on the local disk. The CSI driver Fluid registers handles the "make this look like a local mount" part.

Where Fluid earns its 14-minute-to-3-minute win is the **prefetch workflow**. You can declare a `DataLoad` resource that says "warm this dataset into the cache on a schedule" or "warm it whenever a webhook fires". When a new pod requests the weights, the data is already in the local cache cluster, not still being pulled from S3.

```yaml
apiVersion: data.fluid.io/v1alpha1
kind: DataLoad
metadata:
  name: warm-llama
spec:
  dataset:
    name: llama-3-70b
    namespace: inference
  loadMetadata: true
  target:
    - path: /
      replicas: 3
```

The 3-minute number is what you get with Fluid orchestrating a warm cache but the pod still doing the actual weight read at startup. The cache is on the same network as the GPU, but the bytes still have to traverse the host network and load into the model loader process.

## Bet 3: proactive warmup, treating data as a workload

The last 10x is the one that takes engineering judgment. The NetEase post highlights three capabilities Fluid provides for this stage:

- **Scheduled, event-driven, and proactive warmup.** The cache fills before any pod requests it. The warmup itself runs as a workload, with its own resource requests and priority.
- **CSI- and Sidecar-based access patterns.** Critical for letting an inference pod consume a dataset that lives in a different namespace, without copying or duplicating the data.
- **Cross-namespace dataset sharing with logical isolation.** One team's `Dataset` resource can be referenced by another team's pods, but with the access controls staying intact.

The pattern that gets you to 30 seconds (or under) is to treat model warmup as a deployment concern, not a runtime concern:

1. When you publish a new model version, you also schedule a `DataLoad` that warms it across the inference cluster's cache nodes.
2. The warmup completes before any pod requesting that model is scheduled.
3. The Kubernetes scheduler co-locates the inference pod with a cache node that has the weights resident.
4. The pod's only cold-path is the local-disk read + GPU memory copy, which on modern NVMe + PCIe is a few seconds for tens of GB.

The mental shift is from "lazy load on demand" to "the data is already there because we put it there." This is the same shift CDNs went through in the 2010s. The cache fills are not the user's problem.

## What the case study doesn't tell you

A few things worth being honest about because the post glosses over them:

- **They didn't say what model sizes.** "30 seconds" is for some workload they measured. If your model is 7B parameters (~14GB) you'll do better. If it's 405B parameters (~800GB), even Fluid can't make that fit on a single cache node.
- **They didn't say what GPU types.** PCIe 4 versus PCIe 5 versus the NVLink-attached HBM on modern accelerators changes the "weight-load-into-GPU-memory" portion of the cold path by 3-5x.
- **They didn't share the actual Fluid YAML they run in production.** The snippets above are minimal-viable shapes from Fluid's docs, not NetEase's actual config. Production setups have priorities, taints, resource quotas, and observability hooks that aren't in the case study.

That's normal for an end-user post; the architectural takeaway is what's portable, not the exact tuning.

## How to apply the pattern without Fluid

If you're not on Kubernetes, the principles still transfer:

1. **Put the cache on the inference node, not across the network.** Local NVMe at 7 GB/s reads beats network-attached storage at 1-2 GB/s by 3-5x.
2. **Warm the cache before the pod starts.** Tie cache warming to your CI/CD pipeline. When a new model version ships, the deploy step is `(a) push weights to object storage` AND `(b) push a warmup job to every inference region`. Both run before any traffic is routed to the new version.
3. **Treat model weights as a first-class artifact.** They are not configuration. They are not a runtime dependency. They are a build artifact with their own versioning, signing, and distribution path. Sign them with the same tooling you sign container images (cosign + Sigstore both support arbitrary blobs).
4. **If you're on serverless GPU (Modal, RunPod, Beam, Lambda Labs, Cerebrium, Replicate), check the warm-pool feature.** Every credible serverless GPU vendor in 2026 has a "keep N instances pre-loaded" knob. Pay the holding cost; the cold-start fix isn't worth the engineering time for a workload that hits cold pods a handful of times a day.
5. **Measure where your cold start actually goes.** A simple `kubectl describe pod` + `kubectl logs --previous` for a cold-started inference pod will tell you whether you're 90% on weight load or 90% on image pull. The fix is different for each.

## Why this matters beyond LLM inference

The same pattern applies anywhere a workload needs a large blob of data to start. Big data jobs reading TB-scale datasets, video transcoders pulling reference assets, simulation workloads that need GIS data, security tools pulling threat intel snapshots. The cost of "lazy load from object storage" goes up linearly with the size of the blob and the distance to it. The cost of "warm cache, locality-aware scheduling" stays flat.

Fluid is doing for data-intensive workloads what Kubernetes already did for compute: making placement, scheduling, and lifecycle into first-class concerns instead of operational accidents. The graduation path the project is on (incubating today, likely graduating in 2027) is worth tracking if any of your workloads cold-start on more than a few hundred MB of data.

## Summary

NetEase Games turned a 42-minute inference cold start into 30 seconds by stopping treating model weights as something to lazy-load from object storage at runtime. The CNCF Fluid project gave them the Kubernetes-native primitives (Dataset, Runtime, DataLoad) to make cache warming a deployment concern instead of a runtime gamble. The principles transfer to any large-blob cold-start problem, with or without Kubernetes.

If your LLM endpoint takes more than a minute to come online, the bottleneck is almost certainly weight loading, and the fix is almost certainly cache + locality + proactive warmup. Spend a sprint measuring where the time actually goes, then borrow whichever piece of this pattern matches your stack.

Sources:
- [NetEase Games + Fluid case study (CNCF blog)](https://www.cncf.io/blog/2026/05/21/how-netease-games-achieved-30-second-llm-cold-starts-on-kubernetes/)
- [Fluid project on GitHub](https://github.com/fluid-cloudnative/fluid)
- [Alluxio docs](https://www.alluxio.io/)
