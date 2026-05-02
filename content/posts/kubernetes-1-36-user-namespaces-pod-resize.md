---
title: 'Kubernetes 1.36 Ships User Namespaces GA and Pod-Level In-Place Resize'
excerpt: 'Kubernetes 1.36 "Haru" landed on April 22, 2026. Two changes matter most for production: user namespaces graduated to stable, and pod-level CPU and memory can now be resized in place without restarting. Here is what each one does, the kubelet and runtime requirements, and how to enable them safely.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2026-05-02'
publishedAt: '2026-05-02T10:00:00Z'
updatedAt: '2026-05-02T10:00:00Z'
readingTime: '9 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: true
tags:
  - kubernetes
  - security
  - user-namespaces
  - pod-resize
  - cgroup-v2
  - release-notes
---

Kubernetes **1.36 "Haru"** shipped on April 22, 2026 with 80 tracked enhancements: 18 graduating to stable, 18 graduating to beta, and 26 brand new alpha features. Most of the release reads like normal cleanup work, but two changes are worth treating as production milestones rather than line items in the release notes.

The first is **user namespaces graduating to stable**. The kernel feature has existed for years, the Kubernetes integration has been in alpha or beta since 1.25, and 1.36 is the version that finally promises API stability. With user namespaces enabled, a process running as root inside a container is mapped to an unprivileged user on the host. That single primitive defangs an entire class of container escape CVEs.

The second is **in-place vertical scaling for pod-level resources, now in beta and on by default**. You could already resize individual containers in 1.35; in 1.36 you can resize the aggregate CPU and memory cap defined at the pod level, without recreating the pod. The combination unlocks proper VPA-style autoscaling that doesn't churn pods every time a recommendation changes.

This post walks through both features: what they do, the kernel and runtime requirements, the trade-offs, and the YAML you'd actually deploy.

## TL;DR

- **User namespaces** went GA. Set `spec.hostUsers: false` on a pod and the container's root maps to a non-privileged UID on the node. Mitigates a real list of past CVEs.
- **Pod-level in-place resize** went beta and is enabled by default. `kubectl patch --subresource resize` updates the pod's aggregate `spec.resources` without restarting it.
- Both depend on **cgroup v2** and a recent kernel. User namespaces additionally need **idmap mounts** support on the volume backing `/var/lib/kubelet/pods/`.
- Container runtime must speak the **`UpdateContainerResources` CRI call** (containerd 2.0+, CRI-O recent enough, runc 1.2+).

## Prerequisites

- A cluster on Kubernetes 1.36 (or 1.35 with `UserNamespacesSupport` and `InPlacePodVerticalScaling` feature gates on for the older subset).
- Linux kernel ≥ 6.3 on every node where you want user namespaces to work, and an `idmap mounts` capable filesystem under `/var/lib/kubelet/pods/` (ext4, xfs, btrfs, tmpfs all qualify on recent kernels).
- cgroup v2 unified hierarchy. Most modern distros default to it; if you're still on cgroup v1 the pod-level resize won't enforce limits correctly.
- `kubectl` ≥ v1.32.0 for the `--subresource resize` patch path.

## User namespaces: what changed at GA

Container runtimes have always been able to launch a process under a remapped UID, but Kubernetes did not expose that to pods in a stable way. Until 1.36 you set the feature gate, accepted alpha-quality breakage, and hoped your CSI driver played along with idmapped mounts.

At GA, three things are different:

1. **`spec.hostUsers: false` is a stable API field.** It was already there in beta, but the contract is now frozen and kubelet's behavior is the same across minor versions.
2. **Idmap mounts are mandatory and well-supported.** The kubelet remounts each pod volume with a UID/GID shift so files written by container-root land on disk owned by the remapped non-root UID. ConfigMaps, Secrets, downward API volumes, and emptyDir all work; raw block volumes (`volumeDevices`) and volumes that don't support idmap mounts will fail the pod.
3. **The mitigation list is real.** The kubelet team [enumerated a set of high/critical CVEs](https://kubernetes.io/blog/2026/04/23/kubernetes-v1-36-userns-ga/) that wouldn't have been exploitable with user namespaces on, mostly variants of "container process pivots out via a host-privileged syscall". This is the headline reason to flip it on rather than wait for the next CVE.

### Minimum example

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: userns-demo
spec:
  hostUsers: false
  containers:
    - name: shell
      image: debian:bookworm-slim
      command: ["sleep", "infinity"]
```

Inside the container, `id` will report `uid=0(root)`. From a debug shell on the node, `ps -ef` for that PID will show a non-zero, non-host UID — typically something in the 65536+ range mapped per-pod. A `cat /proc/<pid>/uid_map` on the host shows the mapping range.

### What you can't do with `hostUsers: false`

The API explicitly rejects pods that mix user namespaces with any of the other host namespaces. If you need any of these, you'll have to pick:

- `hostNetwork: true`
- `hostPID: true`
- `hostIPC: true`
- `volumeDevices: [...]` (raw block volumes)
- containers that mount host paths the kubelet cannot idmap

For a typical web service this list is uncontroversial. For privileged DaemonSets (CNI plugins, node-exporter, eBPF agents) you'll likely keep them on host namespaces and rely on PodSecurity admission to scope the blast radius the old way.

### Rollout pattern

The kubelet doesn't automatically opt every workload in — you set `hostUsers: false` per pod template. A reasonable rollout sequence:

1. Pick one stateless deployment in staging. Add `hostUsers: false`. Confirm the pod schedules, the volumes mount, and the app reads its ConfigMap.
2. Spot-check `crictl inspect <containerID>` on the node and verify the runtime reports the user namespace mapping.
3. Roll the same change to a low-blast-radius prod workload (a doc site, a webhook receiver) before going broader.
4. PSAA or Kyverno policy enforcement comes last — once you have evidence multiple workloads work without surprises, you can codify "no `hostUsers: true` for new pods unless explicitly waived".

## Pod-level in-place resize: what's actually new

Per-container resize landed in 1.33 alpha and graduated through 1.35. In 1.36 the resize subresource also accepts changes to **`spec.resources`** — the pod-level aggregate that 1.32 introduced as an upper bound on the sum of container limits.

The semantics matter: pod-level resources are enforced at the pod's cgroup, not by the application runtime inside containers. That's why this resize never restarts the pod — bumping the pod-level cgroup memory limit is just a `cgroup.memory.max` write to a file that already exists. There's nothing to coordinate with the application.

### Pod with both per-container and pod-level resources

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: pod-resize-demo
spec:
  containers:
    - name: app
      image: ghcr.io/example/app:1.0
      resources:
        requests:
          cpu: 250m
          memory: 256Mi
        limits:
          cpu: 500m
          memory: 256Mi
    - name: sidecar
      image: ghcr.io/example/sidecar:1.0
      resources: {}
  resources:                 # pod-level aggregate cap
    requests:
      cpu: "1"
      memory: 512Mi
    limits:
      cpu: "1"
      memory: 512Mi
```

### Resizing without a restart

```bash
kubectl patch pod pod-resize-demo \
  --subresource resize \
  --patch '{"spec":{"resources":{"limits":{"cpu":"2","memory":"1Gi"},"requests":{"cpu":"2","memory":"1Gi"}}}}'
```

Watch what happens:

```bash
kubectl get pod pod-resize-demo -o yaml | yq '.status.resize'
```

`status.resize` cycles through `Proposed` → `InProgress` → empty (success). The container `restartCount` does **not** increment. `kubectl describe pod` will print a `Resized` event with the old and new values.

### When the resize is rejected

The kubelet refuses the resize and surfaces an event when:

- The new request can't fit on the node — same admission rules as initial scheduling.
- The container runtime doesn't implement `UpdateContainerResources` for the requested change. `containerd ≤ 1.7` and older CRI-O versions hit this.
- You try to lower memory below currently-used memory. The kubelet errs on the side of safety here: a memory shrink that would force OOM-kill the container is rejected.

### Why this changes VPA in production

Vertical Pod Autoscaler implementations historically had to choose between "recreate the pod and disrupt traffic" (the auto mode) or "just write the recommendation to a label and hope a future redeploy picks it up" (the off mode). With pod-level in-place resize, VPA can apply recommendations every few minutes without touching pod identity. PDBs, leader election, in-flight requests, and cached state all stay intact.

The remaining caveat: the **request** part of the resize affects scheduling, not what the kubelet has already accepted. A pod resized up beyond the node's remaining capacity stays running with its new limits, but the API server records the discrepancy. Cluster autoscaler should be the one reacting to that signal, not the workload itself.

## Cluster prerequisites checklist

Before flipping either feature on, confirm:

```text
[ ] Every node is on Kubernetes 1.36 (kubectl get nodes -o wide)
[ ] uname -r reports >= 6.3 on every node intended for hostUsers: false
[ ] cat /sys/fs/cgroup/cgroup.controllers shows cpu and memory (cgroup v2)
[ ] containerd --version reports 2.0+ OR cri-o --version reports a recent build
[ ] /var/lib/kubelet/pods/ is on ext4/xfs/btrfs/tmpfs (filesystem supports idmap mounts)
[ ] kubectl version --client shows >= v1.32.0 (resize subresource)
```

A common gotcha: if you upgrade your control plane to 1.36 before the nodes, pods with `hostUsers: false` will be admitted by the API server but stuck in `ContainerCreating` because the older kubelet doesn't know what to do with the field. Roll the kubelet binary on the nodes first.

## What about the rest of 1.36?

A few items worth at least knowing exist:

- **`PodLifecycleSleepAction` to GA.** A `preStop` hook can now declare a structured sleep instead of `["sh", "-c", "sleep 5"]`, which means the kubelet doesn't have to fork a shell to terminate a pod gracefully.
- **Recursive Read-Only Mounts to GA.** `readOnly: true` finally applies recursively to bind-mounted subtrees on Linux 5.12+.
- **`FineGrainedSupplementalGroups` policy graduates.** Pods can declare exactly how the container's supplementary groups are derived, which closes a small but irritating discrepancy between Kubernetes and Docker behavior.
- **CRI image volumes (alpha, opt-in).** Mount the contents of an OCI image as a volume without running a container for it. Mostly useful for sidecar-style data delivery (model weights, ML datasets, mass config blobs).

None of these change your day in the way that user namespaces and pod resize do, but the recursive read-only mounts in particular fix a real footgun if you've ever had a sub-mount remain writable inside an otherwise read-only mount.

## Summary

The headline of 1.36 isn't a new abstraction — it's two long-running features that finally feel safe to put under load:

- **User namespaces (GA)** flips the security baseline for stateless workloads. Add `hostUsers: false` to pods that don't need host network/PID/IPC, and a chunk of the container-escape attack surface goes away.
- **Pod-level in-place resize (beta on by default)** turns vertical autoscaling into a non-disruptive operation. The kubelet patches the cgroup, the application doesn't restart, and PDBs stay green.

Both depend on infrastructure you should already have — cgroup v2, kernel 6.3+, containerd 2.0+ — but it's worth running through the prerequisites checklist before you flip the field on a production deployment. The feature gates are gone, but the kernel and runtime requirements aren't.

Worth bookmarking the official posts: the [user namespaces GA announcement](https://kubernetes.io/blog/2026/04/23/kubernetes-v1-36-userns-ga/), the [pod-level resize beta](https://kubernetes.io/blog/2026/04/30/kubernetes-v1-36-inplace-pod-level-resources-beta/), and the [v1.36 release notes](https://kubernetes.io/blog/2026/04/22/kubernetes-v1-36-release/).
