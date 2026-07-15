---
title: 'Your GitOps Controller Is Tier Zero: the Argo CD repo-server RCE'
excerpt: 'An unauthenticated RCE in Argo CD''s repo-server turns one compromised pod into full cluster takeover. Reported 18 months ago, still unpatched. Here is how it works and the one control that stops it.'
category:
  name: 'Security'
  slug: 'security'
date: '2026-07-15'
publishedAt: '2026-07-15T09:00:00Z'
updatedAt: '2026-07-15T09:00:00Z'
readingTime: '11 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Security
  - Kubernetes
  - GitOps
  - Argo CD
  - CI/CD
  - Cloud Native
---

You lock down your ingress, scan your images, run your workloads as non-root, and enforce RBAC on the API server. Then a single low-privilege pod gets popped, sends one unauthenticated gRPC request to a service you have never thought about, and five minutes later the attacker is deploying whatever they want to every cluster your GitOps setup manages. That service is Argo CD's `repo-server`, and the bug that makes this possible was reported in January 2025 and still has no patch.

Synacktiv published the full write-up in early July 2026. The headline is an unauthenticated remote code execution in the component that turns your Git repos into Kubernetes manifests. The more useful story is what it says about how most teams treat their continuous delivery control plane: as invisible plumbing, when it is actually the most powerful thing in the cluster.

:::warning
As of publication there is **no patched Argo CD release and no assigned CVE** for the core repo-server RCE. The only real mitigation available today is a Kubernetes NetworkPolicy. If you run Argo CD, jump to [what to do right now](#what-to-do-right-now) and check your cluster before you finish reading.
:::

## TLDR

- Argo CD's **`repo-server`** exposes a gRPC API with **no authentication**. Any pod that can reach it can call `GenerateManifest`.
- A crafted request abuses kustomize's `--enable-helm --helm-command` option to run an **attacker-supplied script** from a Git repo, giving code execution inside the repo-server.
- From there the attacker reads the repo-server's environment (including the **Redis password**), poisons Argo CD's Redis manifest cache, and the application controller happily **auto-syncs malicious manifests** into the cluster. That is full takeover.
- The default Helm chart ships with **`networkPolicy.create: false`**, so nothing stops an arbitrary pod from reaching the repo-server and Redis.
- Reported to maintainers in **January 2025**. The repo-server RCE is still unpatched. The one fix you can apply now is a **NetworkPolicy** locking the repo-server down to the four Argo CD components that legitimately talk to it.

## Prerequisites

- A cluster running **Argo CD**, ideally one you can inspect with `kubectl`.
- A basic mental model of how Argo CD works. If it is new to you, start with [an introduction to Argo CD](https://devops-daily.com/posts/introduction-to-argocd).
- Familiarity with **Kubernetes NetworkPolicy** (the fix leans entirely on it).
- Cluster access to check and apply network policies (`kubectl get/apply`).

## What the repo-server actually does

Argo CD is not one process. It is a handful of components with very different jobs:

- **`argocd-server`** serves the API and UI you log into.
- The **application controller** watches your `Application` resources and reconciles the cluster toward the desired state.
- **`redis`** is a cache that sits between them.
- The **`repo-server`** clones your Git repositories and turns them into rendered Kubernetes manifests. It runs `helm template`, `kustomize build`, plugins, and whatever else your sources need, then hands the resulting YAML back over gRPC.

That last component is the interesting one. To render manifests it has to execute templating tools, and templating tools are, by design, ways to run code. The repo-server is the part of Argo CD whose entire job is "take input and produce output by running binaries." The only thing standing between that and disaster is who is allowed to send it input.

The answer, it turns out, is everyone.

## The bug: an unauthenticated gRPC endpoint that runs your tools

The repo-server exposes a gRPC service, and that service has no authentication. It is meant to be internal, reachable only from the other Argo CD components. But there is no token, no mTLS check, nothing at the application layer that verifies the caller. If you can open an HTTP/2 connection to the repo-server's port, you can call its methods.

The method that matters is `GenerateManifest`, exposed at `/repository.RepoServerService/GenerateManifest`. It takes a `ManifestRequest`, and that request lets the caller pass kustomize build options as a free-form string:

```text
ManifestRequest {
  repo: <an attacker-controlled Git repository>
  kustomizeOptions: {
    buildOptions: "--enable-helm --helm-command ./exfil.sh"
  }
}
```

The repo-server clones the repo you point it at, then runs kustomize with the options you supplied. So the effective command becomes:

```bash
kustomize build <cloned-repo-path> --enable-helm --helm-command ./exfil.sh
```

`--helm-command` is meant to let you point kustomize at a specific Helm binary. But it accepts any path, and `./exfil.sh` resolves inside the repository the attacker just told it to clone. Kustomize dutifully executes it. That is arbitrary code execution as the repo-server's user, triggered by a single unauthenticated request and a public Git repo.

No credentials. No Argo CD account. No exotic configuration. Just network reachability.

## Why RCE in the repo-server is full cluster takeover

Code execution inside one container is bad. What makes this a cluster compromise is the second half of the chain, which needs nothing more than reading an environment variable.

```diagram
{
  "type": "flow",
  "title": "From one pod to the whole cluster",
  "steps": [
    { "label": "Compromised pod", "sub": "any workload in the cluster", "icon": "pod" },
    { "label": "Unauth gRPC to repo-server", "sub": "GenerateManifest + malicious kustomize opts", "icon": "net" },
    { "label": "RCE in repo-server", "sub": "reads env, grabs REDIS_PASSWORD", "icon": "cpu" },
    { "label": "Poison Redis cache", "sub": "rewrite mfst + git-refs keys", "icon": "database" },
    { "label": "Controller auto-syncs", "sub": "attacker manifests hit the cluster", "icon": "rocket" }
  ]
}
```

Here is the sequence:

1. **Read the environment.** The exploit script exfiltrates the repo-server's env vars. One of them is `REDIS_PASSWORD`, the credential for Argo CD's cache.
2. **Poison the cache.** Argo CD stores rendered manifests in Redis under `mfst` keys and Git reference data under `git-refs` keys. With the Redis password (and Redis itself reachable), the attacker overwrites a cached manifest with their own malicious Kubernetes resources and adjusts the cached commit SHA so it looks fresh.
3. **Let Argo CD deploy it for you.** The application controller reads that poisoned cache and reconciles the cluster toward it. If the affected `Application` has **Auto Sync** enabled, the malicious manifests are applied automatically. This does not even require `selfHeal`. Auto Sync alone is enough.

So the attacker never has to touch the Kubernetes API directly or steal a kubeconfig. They let the tool whose entire purpose is "apply manifests to the cluster with high privileges" do the applying. Argo CD's service account is typically powerful, often cluster-admin or close to it, because reconciling arbitrary manifests demands it. The blast radius is every cluster that Argo CD instance manages.

## The default that makes it reachable

For any of this to work, the attacker's pod has to reach the repo-server and Redis. In a correctly locked-down install it cannot: a NetworkPolicy restricts ingress to the repo-server so only the API server, the application controller, and the notifications and applicationset controllers can connect.

The problem is that the official Helm chart, which is how most teams install Argo CD, does not turn that on. The relevant values default to:

```yaml
networkPolicy:
  create: false
  defaultDenyIngress: false
```

With `create: false`, no NetworkPolicy objects are created at all. In a default Kubernetes cluster, no NetworkPolicy means all pods can talk to all pods. So the repo-server's unauthenticated gRPC port is reachable from any workload in the cluster, and so is Redis. A single compromised container, a leaky sidecar, a popped CI job running in-cluster, any foothold at all, is enough to start the chain.

This is the quiet part. The RCE is the flashy finding, but the reason it is exploitable in practice is a values file that ships "off" for the one control that contains it.

## What to do right now

The core repo-server authentication bug has no upstream patch yet, so you cannot fix this by bumping a version. You fix it by making the repo-server unreachable from anything that is not Argo CD.

**1. Check whether you have any network policy at all.**

```terminal
{
  "title": "audit argo cd network policies",
  "prompt": "$",
  "steps": [
    { "comment": "list network policies in the argocd namespace" },
    { "cmd": "kubectl get networkpolicy -n argocd", "output": "No resources found in argocd namespace." },
    { "comment": "empty output = every pod in the cluster can reach the repo-server" },
    { "comment": "confirm the repo-server service and its port" },
    { "cmd": "kubectl get svc -n argocd argocd-repo-server", "output": "NAME                  TYPE        CLUSTER-IP     PORT(S)\nargocd-repo-server    ClusterIP   10.96.14.201   8081/TCP,8084/TCP" }
  ]
}
```

**2. Apply a NetworkPolicy that only lets the four Argo CD components in.** This is the control that actually stops the attack.

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: argocd-repo-server-lockdown
  namespace: argocd
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: argocd-repo-server
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: argocd-server
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: argocd-application-controller
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: argocd-notifications-controller
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: argocd-applicationset-controller
```

Do the same for Redis so a stolen password cannot be used from a random pod. If you install via Helm, the fastest route is to flip the chart's own setting, which the maintainers did patch (advisory `GHSA-47m3-95c7-g2g8`):

```yaml
# values.yaml
networkPolicy:
  create: true
  defaultDenyIngress: true
```

**3. Confirm your CNI actually enforces NetworkPolicy.** This is the step people skip. A NetworkPolicy object is inert if your network plugin does not implement it. Flannel, for example, does not enforce policies on its own. Verify you are running something that does, like Cilium or Calico, or the lockdown above is theater.

**4. Reduce what a compromise is worth.** Even with the network sealed, treat the repo-server as sensitive:

- Do not stuff secrets into its environment where a single `env` dump hands them over. Pull credentials from a secrets manager at use time instead.
- Scope Argo CD's own RBAC to the namespaces it needs rather than blanket cluster-admin, so a takeover is contained rather than total.
- Audit who can run pods in the Argo CD cluster. In-cluster CI runners and multi-tenant namespaces are the realistic sources of that first foothold.

## The lesson worth keeping

The CVE-of-the-week churn is easy to tune out. This one is worth internalizing because of what it targets. Your GitOps controller is not a utility. It is a process with credentials to reshape every cluster it manages, whose job is to take external input (your Git repos) and turn it into running workloads. That is the definition of **tier-zero infrastructure**: if it is compromised, everything downstream is compromised, and you treat it accordingly.

Most teams do not. Argo CD gets installed with the default chart, wired to a Git repo, and forgotten, sitting there with cluster-admin and an unauthenticated internal API and no network policy, because it "just works." The Synacktiv research is a concrete reminder that the delivery pipeline deserves the same scrutiny as the production workloads it deploys. The same thinking applies to the rest of your CD stack: a bug in the thing that ships your code is a bug in everything it ships.

If you want the deeper Argo CD security backdrop, we also covered [an authenticated Argo CD secret-leak bug](https://devops-daily.com/posts/argocd-cve-2026-42880-serversidediff-secret-leak) earlier this year. Different flaw, same message: the control plane is worth guarding.

## Summary

- Argo CD's **repo-server** has an **unauthenticated gRPC API**; `GenerateManifest` plus a malicious kustomize `--helm-command` gives arbitrary code execution from any pod that can reach it.
- That RCE leads to **full cluster takeover** by stealing the Redis password, poisoning the manifest cache, and letting the application controller auto-sync attacker manifests.
- The default Helm chart ships **`networkPolicy.create: false`**, which is why a single foothold is enough.
- There is **no upstream patch** for the core bug as of now. A **NetworkPolicy** restricting the repo-server (and Redis) to the four Argo CD components is the mitigation that works, provided your CNI enforces policies.
- Treat your GitOps controller as **tier-zero**: lock its network, scope its RBAC, keep secrets out of its environment, and control who can run code near it.

Check `kubectl get networkpolicy -n argocd` today. If it comes back empty, you are one compromised pod away from a very bad afternoon.
