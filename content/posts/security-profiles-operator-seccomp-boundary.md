---
title: 'Build the Container Boundary You Do Not Have: Seccomp Profiles with the Security Profiles Operator'
excerpt: 'A container is not a security boundary out of the box, but you can build one. Here is a hands-on guide to recording, tuning, and enforcing seccomp profiles with the Security Profiles Operator, which just shipped v1.0.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2026-07-20'
publishedAt: '2026-07-20T09:00:00Z'
updatedAt: '2026-07-20T09:00:00Z'
readingTime: '13 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Kubernetes
  - Security
  - Containers
  - Seccomp
  - DevOps
---

We keep saying it: a container is not a security boundary. A shared kernel means one container breakout, one [GhostLock-style CVE](/posts/ghostlock-cve-2026-43499-container-boundary), and the attacker is on the host. That post ended with advice most teams nod at and never action: reduce the kernel surface each container can reach. This post is the actionable half. You are going to build a real boundary with seccomp, and you are going to do it without hand-writing a single syscall list.

The reason this is worth revisiting now is that the [Security Profiles Operator](https://github.com/kubernetes-sigs/security-profiles-operator) (SPO) just shipped **v1.0**, its first stable release, with all eight of its CRD APIs graduated to `v1` and a third-party security audit behind it. Seccomp in Kubernetes went from "theoretically a good idea, practically nobody does it" to "recordable, bindable, and stable enough to depend on."

## TL;DR

- **The gap:** containers share the host kernel, and by default a container can call almost any of the ~450 Linux syscalls. A breakout only needs the dangerous ones.
- **The fix:** a seccomp profile allow-lists the syscalls a workload actually uses and blocks the rest, shrinking the kernel attack surface per container.
- **The catch that killed adoption:** writing seccomp profiles by hand is miserable. Miss one syscall and your app crashes in production with a cryptic `SIGSYS`.
- **What changed:** SPO can **record** a profile from a running workload, let you review it, then **bind** it to pods declaratively as a Kubernetes custom resource. v1.0 makes the APIs stable.
- **Do this:** enable `RuntimeDefault` seccomp everywhere as a baseline, then record and enforce tight per-workload profiles for anything internet-facing.

## Prerequisites

- A Kubernetes cluster you can install an operator on (kind, minikube, or a real cluster on 1.29+).
- `kubectl` and cluster-admin, plus a container runtime with seccomp support (containerd and CRI-O both qualify).
- A rough idea of what a Linux syscall is. You do not need to know the list; the whole point is that you will not write it.

## Why seccomp is the highest-leverage container control

Linux exposes roughly 450 syscalls. A typical web service uses 60 to 100 of them. Every syscall you do not block is reachable by anything that gains code execution inside the container, including the handful (`keyctl`, `unshare`, `ptrace`, `bpf`, `mount`, `add_key`) that show up again and again in container-escape exploits.

seccomp (secure computing mode) is a kernel feature that filters syscalls per process. A seccomp profile is a JSON document that says "default deny, allow this specific set." When a filtered process calls a blocked syscall, the kernel kills it with `SIGSYS` (or returns an error, depending on the action). No syscall, no exploit primitive.

```diagram
{
  "type": "flow",
  "title": "What a seccomp profile changes",
  "nodes": [
    { "label": "Attacker gets code execution in the container", "icon": "cpu" },
    { "label": "Tries a container-escape syscall (unshare, keyctl, mount)", "icon": "activity" },
    { "label": "No profile: kernel runs it, escape proceeds", "icon": "server" },
    { "label": "With profile: kernel blocks it, process killed (SIGSYS)", "icon": "shield" }
  ]
}
```

The catch is precision. A profile that is too loose does nothing; a profile that is too tight crashes your app the first time it hits an unlisted syscall under real traffic. Hand-authoring that list, keeping it correct across library upgrades, and doing it for every service is why almost nobody ran custom seccomp profiles. SPO removes the hand-authoring.

## The baseline you should already have: RuntimeDefault

Before any custom work, there is a free win. Kubernetes ships a `RuntimeDefault` seccomp profile, maintained by your container runtime, that blocks around 40 to 60 of the most dangerous and rarely-legitimate syscalls. It is safe for the overwhelming majority of workloads, and it is off unless you ask for it.

Turn it on per pod:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: api
spec:
  securityContext:
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: api
      image: ghcr.io/example/api:1.4.0
```

Or enforce it cluster-wide so nobody forgets, using Pod Security Admission's `restricted` profile or a policy engine. If you do nothing else from this post, do this. `RuntimeDefault` is the seatbelt: unremarkable until the day it saves you.

Custom profiles are the next step up, for the workloads where "block the 50 worst syscalls" is not tight enough and you want "allow only the 80 this service actually uses."

## Install the Security Profiles Operator

SPO depends on cert-manager for its webhooks. Install both:

```terminal
{
  "title": "install SPO",
  "prompt": "$",
  "steps": [
    { "cmd": "kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml", "output": "namespace/cert-manager created\ncustomresourcedefinition.apiextensions.k8s.io/certificates.cert-manager.io created\n..." },
    { "comment": "wait for cert-manager to be ready, then install the operator" },
    { "cmd": "kubectl apply -f https://github.com/kubernetes-sigs/security-profiles-operator/releases/download/v1.0.0/operator.yaml", "output": "namespace/security-profiles-operator created\ncustomresourcedefinition.apiextensions.k8s.io/seccompprofiles.security-profiles-operator.x-k8s.io created\ncustomresourcedefinition.apiextensions.k8s.io/profilerecordings.security-profiles-operator.x-k8s.io created\n..." },
    { "cmd": "kubectl -n security-profiles-operator get pods", "output": "NAME                                        READY   STATUS    RESTARTS   AGE\nsecurity-profiles-operator-7d9c...          1/1     Running   0          40s\nspod-abcde                                  3/3     Running   0          30s" }
  ]
}
```

The `spod` DaemonSet is the important part: it runs on every node and is what actually loads profiles into the kernel and records syscalls from running pods.

To record profiles, enable the recording feature (it uses an eBPF or log-based backend):

```bash
kubectl -n security-profiles-operator patch spod spod \
  --type=merge -p '{"spec":{"enableProfiling":true}}'
```

## Step 1: Record a profile from a live workload

This is the feature that makes seccomp practical. Instead of guessing which syscalls your app needs, you run it, let SPO watch, and it writes the profile for you.

Create a `ProfileRecording` that selects your pods by label:

```yaml
apiVersion: security-profiles-operator.x-k8s.io/v1alpha1
kind: ProfileRecording
metadata:
  name: api-recording
  namespace: default
spec:
  kind: SeccompProfile
  recorder: bpf
  podSelector:
    matchLabels:
      app: api
```

Now deploy the workload with the matching label and, critically, **exercise it**. The recording only captures syscalls that actually happen, so run your integration tests, hit every endpoint, trigger the background jobs, run the migration path. A syscall your app makes once a day at 3am during log rotation counts, and if you do not trigger it during recording, it will not be in the profile.

```diagram
{
  "type": "loop",
  "title": "The record-review-enforce loop",
  "nodes": [
    { "label": "Record: run the workload under a ProfileRecording", "icon": "activity" },
    { "label": "Exercise every code path (tests, jobs, edge cases)", "icon": "rocket" },
    { "label": "Review the generated SeccompProfile syscall list", "icon": "check" },
    { "label": "Enforce: bind the profile, watch for SIGSYS in logs", "icon": "lock" }
  ]
}
```

When you delete the recorded pods, SPO finalizes a `SeccompProfile` custom resource:

```terminal
{
  "title": "collect the recorded profile",
  "prompt": "$",
  "steps": [
    { "comment": "drive traffic through the app, then remove the pods to finalize" },
    { "cmd": "kubectl delete deployment api", "output": "deployment.apps \"api\" deleted" },
    { "cmd": "kubectl get seccompprofile", "output": "NAME              STATUS      AGE\napi-recording-api Installed   8s" },
    { "cmd": "kubectl get seccompprofile api-recording-api -o jsonpath='{.spec.syscalls[0].names}' | tr ',' '\\n' | head -6", "output": "[\"accept4\"\n\"bind\"\n\"brk\"\n\"clone3\"\n\"close\"\n\"connect\"" }
  ]
}
```

You now have a data-derived allow-list instead of a hopeful guess.

## Step 2: Review before you trust

Do not enforce a recorded profile blind. Recording captures what happened, which includes anything weird that happened, so read the list with two questions:

1. **Is anything dangerous in here that should not be?** If a recording of a plain web API contains `ptrace`, `bpf`, or `unshare`, either your app genuinely does something exotic or something ran during recording that should not have. Investigate before enforcing.
2. **Did I miss a rare-but-real path?** The opposite risk. If your app shells out only on a specific error, and you never triggered that error while recording, the profile will `SIGSYS`-kill the process the first time it happens in production.

:::warning
Record in an environment that mirrors production code paths, not a smoke test that hits one endpoint. An under-exercised recording produces a profile that looks fine in staging and crashes under real traffic when an untested path fires an unlisted syscall. Treat the recorded list as a draft you review, not a finished artifact.
:::

A practical tactic: record, then run the profile in a **non-enforcing audit mode** first if your kernel supports `SCMP_ACT_LOG`, which logs blocked syscalls instead of killing the process. You get a list of "would have blocked" syscalls from real traffic before you flip to enforcing.

## Step 3: Enforce the profile

Once you trust the profile, bind it. SPO installs the profile as a file on each node, and you reference it from the pod's `securityContext`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      securityContext:
        seccompProfile:
          type: Localhost
          # SPO writes profiles under the kubelet's seccomp root
          localhostProfile: operator/default/api-recording-api.json
      containers:
        - name: api
          image: ghcr.io/example/api:1.4.0
```

If you would rather not hard-code the path in every deployment, SPO offers a `ProfileBinding` custom resource that attaches a profile to any pod matching an image, via a webhook, so the binding lives next to the profile instead of scattered across manifests.

Verify it took effect by trying something the profile forbids. A profile recorded from a web server will not include `unshare`; exec into the pod and watch the kernel stop you:

```terminal
{
  "title": "confirm the boundary is live",
  "prompt": "$",
  "steps": [
    { "cmd": "kubectl exec -it deploy/api -- unshare --map-root-user --user sh", "output": "unshare: unshare failed: Operation not permitted" },
    { "comment": "the syscall is blocked by the profile, not by permissions" },
    { "cmd": "kubectl logs deploy/api | grep -i seccomp", "output": "audit: type=1326 ... comm=\"unshare\" syscall=272 ... SECCOMP" }
  ]
}
```

`syscall=272` is `unshare`. The container tried to create a new namespace, a common escape building block, and the kernel refused because it is not on the allow-list. That is the boundary you did not have five minutes ago.

## What SPO v1.0 actually stabilizes

The v1.0 milestone is not just a version bump. It matters for whether you can build a platform on top of this:

- **All eight CRDs graduated to `v1`.** `SeccompProfile`, `SelinuxProfile`, `AppArmorProfile`, `ProfileRecording`, `ProfileBinding`, and the rest now have stable schemas, with a zero-downtime migration path from the older `v1alpha1` and `v1beta1` versions. You can depend on the API shape.
- **A third-party security audit** found zero critical issues and confirmed the operator does not introduce its own escape surface: host file paths come from object metadata rather than user-controlled spec fields, commands are built as argument arrays with no shell-injection surface, and RBAC defaults do not over-grant.
- **Beyond seccomp.** The same record-review-enforce workflow applies to SELinux and AppArmor profiles through the same operator, so the pattern you learn here extends to the other two Linux MAC systems.

## Where this fits in a real defense strategy

seccomp is one layer, and layering is the whole point, because the container boundary is built, not given. A sane stack:

1. **`RuntimeDefault` seccomp everywhere**, enforced by Pod Security Admission. Free, broad, do it today.
2. **Recorded custom profiles** for internet-facing and multi-tenant workloads, where the tighter allow-list is worth the record-review-enforce effort.
3. **Drop capabilities and run as non-root** (`allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: true`, `capabilities.drop: ["ALL"]`). seccomp filters syscalls; capabilities filter privileged operations. You want both.
4. **A real isolation boundary for genuinely untrusted code**: gVisor or Kata Containers, which do not share the host kernel the way a normal container does.

seccomp will not stop every attack, and it is not a substitute for patching the kernel bug that GhostLock exploited. What it does is remove the syscalls those exploits reach for, so a breakout primitive that needs `unshare` or `keyctl` finds the door already locked. Combined with the layers above, it turns "a container is not a security boundary" from a warning into a solved problem for the workloads that matter most.

The tooling excuse is gone. SPO v1.0 records the profile for you, reviews cleanly, and enforces declaratively. The only thing left is to run it.
