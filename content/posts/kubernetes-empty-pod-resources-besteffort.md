---
title: 'An Empty resources: {} Makes Kubernetes 1.34 to 1.36 Pods BestEffort'
excerpt: 'An empty pod-level block makes a pod with requests and limits BestEffort on Kubernetes 1.34 to 1.36. We measured what changes on the node, and what does not.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2026-11-04'
publishedAt: '2026-11-04T15:00:00Z'
updatedAt: '2026-11-04T15:00:00Z'
readingTime: '15 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Kubernetes
  - QoS
  - GitLab Runner
  - k3s
  - cgroups
  - Eviction
  - CI/CD
---

On Kubernetes 1.34, 1.35 and 1.36, one empty block in a pod spec changes how the node treats the pod. If the pod sets `spec.resources: {}` at pod level, the kubelet gives it QoS class **BestEffort**. This happens even when every container sets requests and limits, whenever the `PodLevelResources` feature gate is on, which is the default from 1.34. GitLab Runner's Kubernetes executor builds its job pods with that empty block. Its source does this from 18.10.0 to 19.4.3, unless the runner config sets pod-level values.

We ran the same pods on k3s v1.34.12, v1.35.9, v1.36.5 and v1.37.1. On the three older versions, the empty block moved the pod into the BestEffort cgroup slice. The kubelet set its `oom_score_adj` to 1000, the highest value the kernel accepts. Next to a busy neighbour, a pod that requested half a CPU got 0.06 to 0.08 cores instead of 0.57 to 0.58. A namespace quota that blocks BestEffort pods rejected it. On 1.37.1 the same pods kept their Burstable and Guaranteed classes.

One thing did not change, and the research we started from got it wrong. It said these pods are first in line for kubelet eviction under memory pressure. They are not. The kubelet's eviction ranking compares memory usage with the memory request. For an empty block, that request still comes from the containers. The QoS class is not part of the ranking, and the kubelet evicted our pods in the same order on every version.

## TL;DR

- On k3s v1.34.12, v1.35.9 and v1.36.5, a pod with container requests and limits plus `spec.resources: {}` reported `qosClass: BestEffort`. The Guaranteed variant did too. On v1.37.1 they reported Burstable and Guaranteed. With the new `PodLevelResourcesFixKubeletQOSClass` feature gate turned off, 1.37.1 went back to BestEffort.
- The node settings followed the class. `oom_score_adj` went from 935 (Burstable) and -997 (Guaranteed) to 1000, and the pod cgroup moved to `kubepods-besteffort.slice` with `cpu.weight` 1 and no pod-level `memory.max`. The container-level limits stayed in place.
- A neighbour pod kept both vCPUs busy. Next to it, the BestEffort-classified pod got a median of 0.061 to 0.083 cores on the three affected versions. The same pod without the empty block got 0.573 to 0.580 (so 10.6% to 14.3%). On 1.37.1 the two were equal.
- A `ResourceQuota` with scope `BestEffort` and `pods: "0"` rejected the pod on 1.34 to 1.36 and admitted it on 1.37.
- The kubelet's memory-pressure eviction order was the same on all four versions, in all 12 repetitions: the true BestEffort pod first, then by memory usage relative to the container request. The empty block did not move a pod forward.
- If you run GitLab Runner on Kubernetes, upgrade to 19.5.0 or later. As of 2 November 2026 the latest Kubernetes patch releases for 1.34, 1.35 and 1.36 still have the bug.

## Prerequisites

- A cluster on Kubernetes 1.34, 1.35 or 1.36 (`kubectl version`), or a machine where you can run the lab
- `kubectl` and `jq`
- If you run GitLab Runner with the Kubernetes executor: its version (`gitlab-runner --version`)
- To run the lab: a DigitalOcean token; one `s-2vcpu-4gb` droplet for about an hour costs a few cents

## Where the empty block comes from

**Pod-level resources** ([KEP-2837](https://github.com/kubernetes/enhancements/issues/2837)) let you set CPU and memory for the pod as a whole, not only per container. The feature gate `PodLevelResources` went alpha in 1.32 and beta, on by default, in 1.34. [Our Kubernetes 1.36 post](/posts/kubernetes-1-36-user-namespaces-pod-resize) covers the in-place resize of those values.

The QoS calculation has a shortcut for them. This is `ComputePodQOS` at v1.34.0, v1.35.0 and v1.36.0, and still at the latest patches, v1.34.13, v1.35.10 and v1.36.6:

```go
// pkg/apis/core/v1/helper/qos/qos.go, v1.36.6
// When pod-level resources are specified, we use them to determine QoS class.
if utilfeature.DefaultFeatureGate.Enabled(features.PodLevelResources) &&
    pod.Spec.Resources != nil {
```

An empty block is not nil. It has no requests and no limits, so the function returns BestEffort. The loop over the containers never runs. The issue that reported this, [#135082](https://github.com/kubernetes/kubernetes/issues/135082) from November 2025, says that almost everywhere else Kubernetes does not differentiate between nil and empty pod-level resources. The helper for that, `IsPodLevelResourcesSet`, treats `{}` as not set.

The fix is [PR #137150](https://github.com/kubernetes/kubernetes/pull/137150), merged on 15 July 2026 for 1.37. It adds the condition `IsPodLevelResourcesSet(pod)` behind a new gate, `PodLevelResourcesFixKubeletQOSClass`, beta and on by default from 1.37. It was not backported. The patch releases of 27 October 2026, v1.34.13, v1.35.10 and v1.36.6, still have the old condition. The rest of that release is in [our Kubernetes 1.37 review](/posts/kubernetes-1-37-garhwal-what-shipped); `PodLevelResources` itself stays beta in 1.37.

GitLab Runner added pod-level resources to its job pods in 18.10.0 ([MR !5922](https://gitlab.com/gitlab-org/gitlab-runner/-/merge_requests/5922)). At every tag we read (18.10.0, 19.3.5 and 19.4.3), the helper that builds the block returns a non-nil object:

```go
// executors/kubernetes/kubernetes.go, GitLab Runner v19.4.3
func (s *executor) podResourcesReference() *api.ResourceRequirements {
	resources := api.ResourceRequirements{}

	if s.configurationOverwrites != nil {
		resources.Limits = s.configurationOverwrites.podLimits
		resources.Requests = s.configurationOverwrites.podRequests
	}

	return &resources
}
```

If the runner config sets none of `pod_cpu_request`, `pod_memory_request`, `pod_cpu_limit` and `pod_memory_limit`, both maps are empty. The pod then goes to the API server with `resources: {}`. The MR that fixed it, [!7346](https://gitlab.com/gitlab-org/gitlab-runner/-/merge_requests/7346), says the same: job pods "were showing `qosClass: BestEffort` instead of the expected `Burstable`", and after the fix `.spec.resources` "should now be empty/absent (was `{}`)". It merged on 1 October 2026 and shipped in 19.5.0. The 19.4.3 and 19.3.5 tags of 28 October 2026 still have the old function. The class matters only when the runner config gives the job containers requests or limits. Without them, the pods were BestEffort anyway.

## The lab

The lab runs on one DigitalOcean droplet: `s-2vcpu-4gb` in `fra1`, Ubuntu 24.04, cgroup v2. A cloud firewall allows SSH from one address and nothing else. The Kubernetes API port is never exposed, and `kubectl` runs on the node over SSH. For each version, a script removes k3s, installs the pinned release, and runs five stages. The kubelet gets an explicit hard eviction threshold, `memory.available<2Gi`. It also gets a 30 second pressure transition period instead of the default 5 minutes, so repetitions do not wait for the node condition to clear.

```diagram
{
  "type": "graph",
  "columns": [
    [{ "id": "pod", "label": "pod spec", "sub": "resources: {} + container requests", "icon": "pod", "tone": "slate" }],
    [
      { "id": "qos", "label": "ComputePodQOS", "sub": "sees a block: BestEffort", "icon": "gear", "tone": "red", "detail": "Checks only pod.Spec.Resources != nil on 1.34 to 1.36. 1.37 adds IsPodLevelResourcesSet behind a beta gate." },
      { "id": "set", "label": "IsPodLevelResourcesSet", "sub": "sees {}: not set", "icon": "gear", "tone": "green", "detail": "Treats an empty block as not set, so the caller falls back to the container requests." }
    ],
    [
      { "id": "oom", "label": "oom_score_adj", "sub": "1000", "icon": "activity", "tone": "red", "status": "down" },
      { "id": "cg", "label": "cgroup slice", "sub": "besteffort, cpu.weight 1", "icon": "cpu", "tone": "red", "status": "down" },
      { "id": "quota", "label": "ResourceQuota scope", "sub": "BestEffort", "icon": "shield", "tone": "red", "status": "down" },
      { "id": "evict", "label": "eviction ranking", "sub": "container requests", "icon": "queue", "tone": "green", "status": "ok" }
    ]
  ],
  "edges": [
    ["pod", "qos"],
    ["pod", "set"],
    ["qos", "oom"],
    ["qos", "cg"],
    ["qos", "quota"],
    ["set", "evict"]
  ]
}
```

The pods:

| Pod              | Pod-level block                        | Container requests | Container limits |
| ---------------- | -------------------------------------- | ------------------ | ---------------- |
| `be`             | none                                   | none               | none             |
| `ctl-burstable`  | none                                   | 100m CPU, 256Mi    | 500m CPU, 512Mi  |
| `emp-burstable`  | `{}`                                   | 100m CPU, 256Mi    | 500m CPU, 512Mi  |
| `ctl-guaranteed` | none                                   | 200m CPU, 256Mi    | 200m CPU, 256Mi  |
| `emp-guaranteed` | `{}`                                   | 200m CPU, 256Mi    | 200m CPU, 256Mi  |
| `plr-burstable`  | requests 100m/256Mi, limits 500m/512Mi | none               | none             |

`plr-burstable` is the control for the feature itself: a real pod-level block works as documented on every version. The empty block is the only problem.

We wrote down the claim and what would disprove it before the droplet existed, and committed it first (`CLAIM.md`). Every recorded file carries a hash of the manifests and node scripts, and the summary script refuses to mix files with different hashes.

```github
https://github.com/The-DevOps-Daily/k8s-empty-pod-resources
```

## Finding 1: the class flips on 1.34 to 1.36

The API server stored the empty block exactly as written. On v1.34.12, v1.35.9 and v1.36.5 the kubelet then reported BestEffort for both `emp-*` pods, while their controls kept Burstable and Guaranteed. On v1.37.1 the `emp-*` pods got the same class as their controls:

```terminal
{
  "title": "results/demo-k3s-v1.36.5.txt and results/demo-k3s-v1.37.1.txt",
  "prompt": "$",
  "steps": [
    {
      "comment": "k3s v1.36.5+k3s1"
    },
    {
      "comment": "... kubectl apply and wait omitted; the whole session is in the file"
    },
    {
      "cmd": "kubectl get pods -n demo -o custom-columns='NAME:.metadata.name,POD-LEVEL:.spec.resources,QOS:.status.qosClass'",
      "output": "NAME             POD-LEVEL   QOS\nctl-burstable    <none>      Burstable\nctl-guaranteed   <none>      Guaranteed\nemp-burstable    map[]       BestEffort\nemp-guaranteed   map[]       BestEffort"
    },
    {
      "comment": "k3s v1.37.1+k3s1, same manifests"
    },
    {
      "comment": "... kubectl apply and wait omitted"
    },
    {
      "cmd": "kubectl get pods -n demo -o custom-columns='NAME:.metadata.name,POD-LEVEL:.spec.resources,QOS:.status.qosClass'",
      "output": "NAME             POD-LEVEL   QOS\nctl-burstable    <none>      Burstable\nctl-guaranteed   <none>      Guaranteed\nemp-burstable    map[]       Burstable\nemp-guaranteed   map[]       Guaranteed"
    }
  ]
}
```

The same result on every version, from `results/summary.md`:

| Pod              | v1.34.12   | v1.35.9    | v1.36.5    | v1.37.1    | v1.37.1, gate off |
| ---------------- | ---------- | ---------- | ---------- | ---------- | ----------------- |
| `ctl-burstable`  | Burstable  | Burstable  | Burstable  | Burstable  | Burstable         |
| `emp-burstable`  | BestEffort | BestEffort | BestEffort | Burstable  | BestEffort        |
| `ctl-guaranteed` | Guaranteed | Guaranteed | Guaranteed | Guaranteed | Guaranteed        |
| `emp-guaranteed` | BestEffort | BestEffort | BestEffort | Guaranteed | BestEffort        |
| `plr-burstable`  | Burstable  | Burstable  | Burstable  | Burstable  | Burstable         |
| `be`             | BestEffort | BestEffort | BestEffort | BestEffort | BestEffort        |

`plr-burstable`, with real pod-level requests and limits, was Burstable everywhere. Pod-level resources work. Only the empty block breaks the class.

To check that the 1.37 gate is the fix and not something else in the release, we reinstalled v1.37.1 with `PodLevelResourcesFixKubeletQOSClass=false` on both the API server and the kubelet. Both `emp-*` pods went back to BestEffort, with `oom_score_adj` 1000. The API server and kubelet metrics reported the gate as `BETA`, on by default and off in that run.

## Finding 2: the kernel sees a BestEffort pod

QoS is not only a label. The kubelet turns it into numbers that the kernel uses. We read them from `/proc` and `/sys/fs/cgroup` on the node, for the main process of each container:

```chart
{
  "type": "bar",
  "title": "oom_score_adj of the main container process",
  "caption": "Read from /proc/<pid>/oom_score_adj on the node. The 1.34.12, 1.35.9 and 1.36.5 values are identical. The kernel adds this value to a process's badness score when it picks one to kill. Source: results/summary.md.",
  "rows": [
    {
      "label": "ctl-burstable, every version",
      "value": 935,
      "series": "no pod-level block"
    },
    {
      "label": "emp-burstable, 1.34 to 1.36",
      "value": 1000,
      "series": "resources: {}, 1.34 to 1.36"
    },
    {
      "label": "emp-burstable, 1.37.1",
      "value": 935,
      "series": "resources: {}, 1.37.1"
    },
    {
      "label": "ctl-guaranteed, every version",
      "value": -997,
      "series": "no pod-level block"
    },
    {
      "label": "emp-guaranteed, 1.34 to 1.36",
      "value": 1000,
      "series": "resources: {}, 1.34 to 1.36"
    },
    {
      "label": "emp-guaranteed, 1.37.1",
      "value": -997,
      "series": "resources: {}, 1.37.1"
    }
  ],
  "series": [
    {
      "name": "no pod-level block",
      "color": "#64748b"
    },
    {
      "name": "resources: {}, 1.34 to 1.36",
      "color": "#ef4444"
    },
    {
      "name": "resources: {}, 1.37.1",
      "color": "#10b981"
    }
  ]
}
```

The kernel adds `oom_score_adj` to each process's badness score before it picks a process to kill, and it accepts values from -1000 to +1000 ([proc.rst](https://github.com/torvalds/linux/blob/v6.8/Documentation/filesystems/proc.rst)). A Burstable container gets `1000 - 1000 * request / node memory`, which is 935 for a 256Mi request on this node. A Guaranteed container gets -997. The empty block gave both 1000, the same as a pod with no resources at all. `oom_score`, the current OOM killer score the kernel shows for the process, went from 1290 (Burstable) and 4 (Guaranteed) to 1334.

The cgroup changed too. On v1.36.5:

|                        | `ctl-burstable`            | `emp-burstable`             | `ctl-guaranteed` | `emp-guaranteed`            |
| ---------------------- | -------------------------- | --------------------------- | ---------------- | --------------------------- |
| QoS slice              | `kubepods-burstable.slice` | `kubepods-besteffort.slice` | `kubepods.slice` | `kubepods-besteffort.slice` |
| pod `cpu.weight`       | 4                          | 1                           | 8                | 1                           |
| pod `cpu.max`          | 0.5 CPU                    | max (none)                  | 0.2 CPU          | max (none)                  |
| pod `memory.max`       | 512 MiB                    | max (none)                  | 256 MiB          | max (none)                  |
| container `cpu.max`    | 0.5 CPU                    | 0.5 CPU                     | 0.2 CPU          | 0.2 CPU                     |
| container `memory.max` | 512 MiB                    | 512 MiB                     | 256 MiB          | 256 MiB                     |
| `oom_score`            | 1290                       | 1334                        | 4                | 1334                        |

The container cgroup still has its own limits, so `emp-burstable` cannot use more than 512 MiB or half a CPU. What it loses is everything the kubelet sets at pod and QoS level. The pod cgroup has no memory limit and no CPU quota of its own. It sits in `kubepods-besteffort.slice`, where the kubelet sets `cpu.weight` to 1 for the whole slice.

## Finding 3: half a CPU requested, 0.06 to 0.08 cores received

`cpu.weight` 1 matters only when the CPU is busy. To see how much, we ran `cpu-neighbour`, a Burstable pod that requests 1 CPU and runs two busy processes, so both vCPUs are always taken. Next to it, `cpu-ctl` and `cpu-emp` took turns, three times each, alternating which went first. Both request 500m CPU with a 1 CPU limit and run one busy process; `cpu-emp` adds the empty block. Each pod reads its own cgroup's `usage_usec` over 20 seconds after a 5 second warm-up.

```chart
{
  "type": "bar",
  "title": "CPU used next to a busy neighbour, median of 3 runs",
  "unit": " cores",
  "caption": "2 vCPU droplet. Both pods request 500m with a 1 CPU limit and run one busy process; the neighbour requests 1 CPU and runs two. Each pod measured its own cgroup usage_usec over 20 s. Source: results/summary.md.",
  "rows": [
    {
      "label": "v1.34.12 cpu-ctl",
      "value": 0.579,
      "series": "cpu-ctl (no block)"
    },
    {
      "label": "v1.34.12 cpu-emp",
      "value": 0.083,
      "series": "cpu-emp (resources: {})"
    },
    {
      "label": "v1.35.9 cpu-ctl",
      "value": 0.58,
      "series": "cpu-ctl (no block)"
    },
    {
      "label": "v1.35.9 cpu-emp",
      "value": 0.07,
      "series": "cpu-emp (resources: {})"
    },
    {
      "label": "v1.36.5 cpu-ctl",
      "value": 0.573,
      "series": "cpu-ctl (no block)"
    },
    {
      "label": "v1.36.5 cpu-emp",
      "value": 0.061,
      "series": "cpu-emp (resources: {})"
    },
    {
      "label": "v1.37.1 cpu-ctl",
      "value": 0.576,
      "series": "cpu-ctl (no block)"
    },
    {
      "label": "v1.37.1 cpu-emp",
      "value": 0.577,
      "series": "cpu-emp (resources: {})"
    }
  ],
  "series": [
    {
      "name": "cpu-ctl (no block)",
      "color": "#64748b"
    },
    {
      "name": "cpu-emp (resources: {})",
      "color": "#ef4444"
    }
  ]
}
```

On the three affected versions, `cpu-emp` got a median of 0.083, 0.070 and 0.061 cores, against 0.579, 0.580 and 0.573 for `cpu-ctl`. That is 14.3%, 12.1% and 10.6% of the control's CPU, or 7.0 to 9.4 times less. On v1.37.1 the two were the same: 0.576 and 0.577 cores.

The weights explain the direction. `cpu-ctl`'s pod cgroup has `cpu.weight` 20 for its 500m request and sits in the burstable slice next to the neighbour. The kubelet sets the burstable slice's weight from the sum of the CPU requests of the Burstable pods in it, which gave 63 here. `cpu-emp`'s pod cgroup has `cpu.weight` 1 and sits in the besteffort slice. The kubelet always sets that slice to the minimum, `cpu.weight` 1. The 500m request of `cpu-emp` still sets a weight on its container cgroup, but that only counts against other containers in the same pod. On a busy node like this one, a CI build in the BestEffort slice competes with `cpu.weight` 1 at that level and can get far less CPU than Burstable or Guaranteed pods. We did not run a build.

The runs were short and sequential. Each pod ran three times in a fixed alternating order, and we did not record the neighbour's own usage or other load on the host. On the affected versions, each of the nine `cpu-emp` runs got less CPU than every `cpu-ctl` run, including the runs where `cpu-emp` went first. The exact percentages still belong to this setup.

## Finding 4: a "no BestEffort" quota rejects the pod

Some clusters forbid BestEffort pods with a quota like this one, so every workload must declare resources:

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: no-besteffort
spec:
  hard:
    pods: '0'
  scopes: ['BestEffort']
```

The API server applies the scope at create time, before any kubelet sees the pod, and it calls the same `GetPodQOS` function. With no status yet, that function computes the class from the spec. On 1.34 to 1.36 it rejected `emp-burstable`, a pod whose container sets requests and limits:

```terminal
{
  "title": "quota.py on k3s v1.36.5",
  "prompt": "$",
  "steps": [
    {
      "cmd": "grep -A3 ' quota$' results/k3s-v1.36.5/run.log",
      "output": "2026-11-02T10:33:20Z quota\nbe              admitted=False Error from server (Forbidden): error when creating \"/root/k8s-empty-pod-resources/manifests/quota/be.yaml\": pods \"be\" is forbidden: exceeded quota: no-besteffort, requested: pods=1, used: pods=0, limited: pods=0\nctl-burstable   admitted=True  pod/ctl-burstable created\nemp-burstable   admitted=False Error from server (Forbidden): error when creating \"/root/k8s-empty-pod-resources/manifests/quota/emp-burstable.yaml\": pods \"emp-burstable\" is forbidden: exceeded quota: no-besteffort, requested: pods=1, used: pods=0, limited: pods=0"
    }
  ]
}
```

On v1.37.1 the API server admitted `emp-burstable`, and still rejected `be`. We did not run a runner. But a job pod from 18.10.0 to 19.4.x carries the same empty block, so in a namespace with this quota it should fail the same way on 1.34 to 1.36. The fix discussion names the reverse risk: a pod "could theoretically bypass restricted BestEffort quotas by being classified as Guaranteed during admission, while still behaving as BestEffort at the node level". That can happen when the API server has the fix and the kubelet does not.

## Finding 5: the eviction order did not change

The five eviction pods each allocate a fixed amount of memory and then sleep. They are sized so that the two possible rules predict different orders:

| Pod              | Memory request  | Allocates | Working set before the hog | Usage against request |
| ---------------- | --------------- | --------- | -------------------------- | --------------------- |
| `be`             | none            | 50 MiB    | 54 MiB                     | above (request is 0)  |
| `ctl`            | 256Mi           | 200 MiB   | 204 MiB                    | about 52 MiB below    |
| `gua-ctl`        | 256Mi (= limit) | 150 MiB   | 154 MiB                    | about 102 MiB below   |
| `emp` + `{}`     | 256Mi           | 100 MiB   | 104 MiB                    | about 152 MiB below   |
| `gua-emp` + `{}` | 256Mi (= limit) | 50 MiB    | 54 MiB                     | about 202 MiB below   |

If the kubelet ranked by QoS class, `emp` and `gua-emp` would go out together with `be`, before `ctl` and `gua-ctl`. If it ranks by container requests, `be` goes first because any usage exceeds a request of zero, and the rest follow in order of usage minus request: `ctl`, `gua-ctl`, `emp`, `gua-emp`.

A host process outside every pod, `hog.py`, then holds `MemAvailable` at 1000 MiB. That is below the 2Gi threshold even after all five pods are gone, so the kubelet keeps evicting until nothing evictable is left. The kubelet cannot evict the hog. The pods differ in size on purpose, to separate the two models, so this is not a matched pair. CoreDNS also ran on the node. The kubelet ranked it last in every ranking it logged. In 5 of the 12 logs the window ran long enough to show the next step: the kubelet logged `cannot evict a critical pod` once only CoreDNS was left.

Every repetition on every version gave the request order. This is the kubelet's own ranking on v1.36.5, while it reported `emp` and `gua-emp` as BestEffort:

```terminal
{
  "title": "k3s v1.36.5, repetition 1",
  "prompt": "$",
  "steps": [
    {
      "comment": "the class the kubelet reported for each pod"
    },
    {
      "cmd": "jq -c 'select(.rep == 1) | .qos' results/k3s-v1.36.5/40-pressure.jsonl",
      "output": "{\"be\":\"BestEffort\",\"ctl\":\"Burstable\",\"emp\":\"BestEffort\",\"gua-ctl\":\"Guaranteed\",\"gua-emp\":\"BestEffort\"}"
    },
    {
      "comment": "the kubelet's ranking before each eviction; sed keeps the journald timestamp and the message, and drops the host name, the service PID, the severity letter, the kubelet's own timestamp, the second PID and the source file"
    },
    {
      "cmd": "grep -E 'ranked for eviction|evicted successfully' results/k3s-v1.36.5/40-kubelet-rep1.log | sed -E 's/^([^ ]+) .*eviction_manager.go:[0-9]+\\] /\\1 /'",
      "output": "2026-11-02T10:38:17.816980+00:00 \"Eviction manager: pods ranked for eviction\" pods=[\"evict-check/be\",\"evict-check/ctl\",\"evict-check/gua-ctl\",\"evict-check/emp\",\"evict-check/gua-emp\",\"kube-system/coredns-7cfb7bc9c7-svb26\"]\n2026-11-02T10:38:20.108268+00:00 \"Eviction manager: pod is evicted successfully\" pod=\"evict-check/be\"\n2026-11-02T10:38:21.127785+00:00 \"Eviction manager: pods ranked for eviction\" pods=[\"evict-check/ctl\",\"evict-check/gua-ctl\",\"evict-check/emp\",\"evict-check/gua-emp\",\"kube-system/coredns-7cfb7bc9c7-svb26\"]\n2026-11-02T10:38:23.555889+00:00 \"Eviction manager: pod is evicted successfully\" pod=\"evict-check/ctl\"\n2026-11-02T10:38:24.579473+00:00 \"Eviction manager: pods ranked for eviction\" pods=[\"evict-check/gua-ctl\",\"evict-check/emp\",\"evict-check/gua-emp\",\"kube-system/coredns-7cfb7bc9c7-svb26\"]\n2026-11-02T10:38:27.242735+00:00 \"Eviction manager: pod is evicted successfully\" pod=\"evict-check/gua-ctl\"\n2026-11-02T10:38:28.259762+00:00 \"Eviction manager: pods ranked for eviction\" pods=[\"evict-check/emp\",\"evict-check/gua-emp\",\"kube-system/coredns-7cfb7bc9c7-svb26\"]\n2026-11-02T10:38:30.555840+00:00 \"Eviction manager: pod is evicted successfully\" pod=\"evict-check/emp\"\n2026-11-02T10:38:31.572048+00:00 \"Eviction manager: pods ranked for eviction\" pods=[\"evict-check/gua-emp\",\"kube-system/coredns-7cfb7bc9c7-svb26\"]\n2026-11-02T10:38:34.078890+00:00 \"Eviction manager: pod is evicted successfully\" pod=\"evict-check/gua-emp\""
    }
  ]
}
```

The source explains it. `rankMemoryPressure` sorts by three keys. First, whether usage exceeds the memory request. Then pod priority. Then usage minus the memory request. The first and third keys get the request from `GetResourceRequestQuantity`. For an empty block, that helper asks `IsPodLevelResourcesSet`, gets false, and uses the container requests. Priority does not read requests, and the QoS class is not an input at all. If the kubelet had used a request of zero for `emp`, `emp` would have been in the first group with `be`. It came fourth.

```chart
{
  "type": "dots",
  "title": "When each pod was evicted, 12 repetitions",
  "unit": "s",
  "caption": "Seconds after the host hog started, from the kubelet's log. 3 repetitions each on k3s v1.34.12, v1.35.9, v1.36.5 and v1.37.1. Every repetition evicted the pods in the same order. Source: results/summary.md.",
  "series": [
    {
      "name": "be",
      "samples": [
        10.6,
        10.5,
        5.7,
        7.8,
        8.3,
        5.7,
        11.5,
        11.5,
        7.1,
        8.4,
        11.1,
        5.6
      ],
      "color": "#94a3b8"
    },
    {
      "name": "ctl",
      "samples": [
        14.2,
        14.0,
        9.4,
        11.4,
        11.8,
        10.2,
        14.9,
        15.3,
        11.7,
        12.1,
        15.1,
        9.1
      ],
      "color": "#64748b"
    },
    {
      "name": "gua-ctl",
      "samples": [
        18.2,
        17.6,
        13.4,
        15.2,
        15.5,
        13.8,
        18.6,
        20.9,
        16.3,
        15.7,
        20.3,
        12.7
      ],
      "color": "#334155"
    },
    {
      "name": "emp",
      "samples": [
        21.7,
        21.0,
        16.8,
        18.7,
        18.9,
        17.3,
        21.9,
        24.7,
        21.7,
        19.3,
        23.9,
        16.1
      ],
      "color": "#ef4444"
    },
    {
      "name": "gua-emp",
      "samples": [
        25.3,
        24.5,
        20.3,
        22.2,
        22.3,
        20.7,
        25.4,
        28.3,
        29.9,
        22.7,
        27.5,
        19.5
      ],
      "color": "#f97316"
    }
  ]
}
```

In all 12 repetitions the kubelet started to reclaim 3.0 to 9.2 s after the hog started, and evicted the first pod 2.3 to 3.3 s later. After that it evicted one pod at a time. 41 of the 48 gaps between evictions were 4.0 s or less (median 3.6 s, longest 8.2 s). The last pod was gone 19.5 to 29.9 s after the hog started. It does not wait 10 seconds between evictions: after each one it waits for the pod to be cleaned up and then checks again. Its own `available` figure at the first eviction was 931 to 1212 MiB, well under the 2Gi threshold and far from empty. The kernel logged no OOM kill in any repetition, so the order is the kubelet's alone.

The two mechanisms are easy to mix up. The kubelet's eviction manager checks every 10 seconds by default when it has nothing to evict, and it ignores the class. The kernel OOM killer acts when memory runs out before the kubelet frees any. It adds `oom_score_adj` to each process's badness score, and the empty block gives the pod the same 1000 as a pod with no resources at all (Finding 2). We did not trigger a kernel OOM, so we did not watch the kernel make that choice.

## What we got wrong before measuring

The research note we started from had the core right and two details wrong.

- **Right:** Kubernetes 1.34 to 1.36 compute BestEffort for an empty pod-level block. GitLab Runner 18.10 to 19.4 build their job pods with that block (from the source and the fix MR). On 1.34 to 1.36 the pods get `oom_score_adj` 1000. 1.37 fixes the class while its new gate is on, which is the default.
- **Wrong:** it called #137150 the upstream issue. That is the fix PR. The issue is #135082.
- **Wrong, and it matters:** it said these pods are first in line for kubelet eviction under memory pressure. Finding 5 shows they are not.
- **Missing:** the 1.37 fix is a beta feature gate, not a plain code change, and nothing was backported to the 1.34, 1.35 or 1.36 patch releases.

We got one prediction wrong ourselves. `CLAIM.md` said the BestEffort-classified pod would get under 10% of the control's CPU. It got 10.6% to 14.3%. Our falsification line was 50%, so the claim stands, but the number we wrote down was too pessimistic, and we report it as a miss.

We also kept a one-repetition smoke run on v1.36.5 (`results/_smoke-k3s-v1.36.5/`). It used the same code stamp and gave the same results, but the summary does not count it.

## What to do

1. **Find the pods.** This query lists every pod with an empty pod-level block and the class it got:

   ```bash
   kubectl get pods -A -o json \
     | jq -r '.items[] | select(.spec.resources == {}) | [.metadata.namespace, .metadata.name, .status.qosClass] | @tsv'
   ```

2. **GitLab Runner 18.10.0 to 19.4.x: upgrade to 19.5.0 or later.** The job pods then go out without a pod-level block, and the class comes from the containers again.
3. **If you cannot upgrade the runner yet, give the block real values.** Set `pod_cpu_request` and `pod_memory_request` (and the `_limit` keys if you want limits) under `[runners.kubernetes]`. The QoS class then comes from those values, like `plr-burstable` above. This is a behaviour change, not only a workaround: the pod cgroup then takes its limits from the pod-level values too, as it did for `plr-burstable`.
4. **Kubernetes 1.37 fixes it by default.** The fix sits behind a beta gate, so check that nobody turned `PodLevelResourcesFixKubeletQOSClass` off.
5. **Check your own templates.** A Helm chart that renders a pod-level block from a value that defaults to `{}` produces the same bug. Render the key only when it has content:

   ```yaml
   # wrong: renders "resources: {}" at pod level when the value is empty
   spec:
     resources: {{- toYaml .Values.podResources | nindent 4 }}

   # right: no key at all when the value is empty
   spec:
     {{- with .Values.podResources }}
     resources: {{- toYaml . | nindent 4 }}
     {{- end }}
   ```

An empty `resources: {}` inside a container is harmless. Only the pod-level one under `spec` changes the class.

## What we could not conclude

- **k3s is one distribution.** We ran upstream Kubernetes code as k3s packages it. A managed service can turn the `PodLevelResources` gate off or carry its own patches. Run the `jq` query on your own cluster.
- **No GitLab instance and no runner ran here.** The runner part rests on its source at each tag and on the MR description. The `emp-*` pods reproduce the field the runner sends, not a full job pod with helper and service containers.
- **We did not trigger a kernel OOM kill.** The `oom_score` values are the numbers the kernel uses to choose a victim, read from `/proc`. We did not watch it choose.
- **The eviction timing is ours.** It depends on the 2Gi threshold, the hog's 1000 MiB target and how fast it allocates. The order is the finding, not the seconds.
- **The CPU gap depends on the neighbours.** One neighbour with a 1 CPU request on a 2 vCPU node gave the numbers above. More Burstable or Guaranteed load should make the BestEffort slice's share smaller. On an idle node the weights do not matter, because they only divide contended CPU time; we did not measure that case.
- **One node, one admission check.** We did not test scheduling across nodes, or any admission rule other than the one quota. The gate-off run on 1.37.1 covered only the class, the kernel-facing numbers and the quota, not CPU or eviction.
- **Other consumers of the class were not tested.** From the source, the kubelet also rejects new BestEffort pods while the node has the `MemoryPressure` condition. The static CPU manager gives exclusive CPUs only to Guaranteed pods. We did not measure either.

## Summary

On Kubernetes 1.34, 1.35 and 1.36, with the `PodLevelResources` gate at its default (on), `spec.resources: {}` makes a pod BestEffort no matter what its containers request. On our node that meant `oom_score_adj` 1000 instead of 935 or -997, and a place in the BestEffort slice with `cpu.weight` 1 and no pod-level memory or CPU limit. Next to a busy neighbour the pod got about 7 to 9 times less CPU, and a quota that forbids BestEffort pods rejected it. The empty block did not change the kubelet's eviction order. The ranking uses memory requests, and for an empty block those still come from the containers: 12 of 12 repetitions evicted our pods in exactly the order the requests predict. Kubernetes 1.37 fixes the class behind a beta gate that is on by default, and GitLab Runner 19.5.0 stops sending the block. Run the `jq` query above on your clusters, and upgrade whichever side you can first.
