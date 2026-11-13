---
title: 'Kubernetes Beyond the Basics: 7 Concepts That Take You From Junior to Mid-Level'
excerpt: 'You can write a Deployment and debug a CrashLoopBackOff. The gap between junior and mid-level is a different set of ideas: how requests really drive scheduling, why Services do not load-balance the way you think, what actually happens during a rolling deploy, and why Kubernetes is a reconciliation engine, not a command runner.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2026-08-25'
publishedAt: '2026-08-25T09:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '17 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Kubernetes
  - DevOps
  - SRE
  - Career
  - Best Practices
---

There is a plateau in learning Kubernetes. You reach it fast: you can write a Deployment, expose it with a Service, read logs, and fix an ImagePullBackOff. Plenty of tutorials get you exactly this far, and then stop.

The engineers who get pulled into the harder conversations, capacity planning, incident reviews, "why did the deploy drop requests," know a different set of things. Not more YAML. A set of mental models about what the cluster is actually doing underneath the YAML. None of them are advanced in the academic sense. They are just systematically missing from beginner material.

Here are the seven that come up over and over, each with the misconception it replaces and the situation where it bites.

## TL;DR

- Kubernetes is a **reconciliation engine**, not a command runner: you edit desired state, controllers converge on it.
- **Requests are for the scheduler, limits are for the kernel.** CPU limits throttle, memory limits kill, and requests also silently drive HPA math.
- **Services are not load balancers** in the way you imagine: they are per-node NAT rules with random pick, and long-lived connections defeat them entirely.
- A **rolling deploy drops requests by default**; fixing it needs readiness gates plus graceful termination working together.
- A bad **liveness probe turns partial degradation into a full outage**. Most containers should not have one.
- **The scheduler places pods once and never rebalances.** An unbalanced cluster stays unbalanced.
- **Namespaces organize, they do not isolate.** Without NetworkPolicies and RBAC, every pod can reach every pod.
- Before production, add a **PodDisruptionBudget**, NetworkPolicies that still allow DNS, and a restricted security context with a seccomp profile.

## Prerequisites

- Comfortable writing and applying Deployments, Services, and ConfigMaps
- You have debugged at least one broken pod with `kubectl describe` and `kubectl logs`
- A cluster to poke at (kind or minikube is fine)

## 1. Kubernetes is a reconciliation engine, not a command runner

The junior mental model is imperative: `kubectl apply` is a command, the cluster executes it, done. That model works until the first time it does not, and then nothing makes sense.

What actually happens: `kubectl apply` writes an object to the API server, and nothing else. Separately, dozens of controllers run infinite loops comparing desired state (what you wrote) against observed state (what exists) and nudging reality toward the spec. The Deployment controller creates ReplicaSets, the ReplicaSet controller creates Pods, the scheduler assigns nodes, the kubelet starts containers. Each loop is independent, retries forever, and does not know you exist.

```diagram
{
  "type": "loop",
  "goal": "Desired state: replicas = 3",
  "nodes": [
    { "label": "Observe", "sub": "what exists now", "variant": "soft" },
    { "label": "Diff", "sub": "vs the spec", "variant": "soft" },
    { "label": "Act", "sub": "create / delete / update", "variant": "accent" }
  ],
  "loopBack": "forever, for every controller"
}
```

This is why deleted pods come back (the ReplicaSet controller sees 2 where the spec says 3), why editing a pod owned by a Deployment is pointless (the next reconcile stomps your change), and why the fix for almost everything is "change the spec, not the running thing." When you internalize this, half of Kubernetes stops being mysterious: it is one pattern applied everywhere, including [the operators you can write yourself](/posts/write-simple-kubernetes-operator).

## 2. Requests are for the scheduler, limits are for the kernel

Most juniors treat `resources` as a formality copied from the last manifest. This block is quietly the most consequential thing in your YAML:

```yaml
resources:
  requests: # scheduler's math: reserved on the node, sums to capacity
    cpu: 250m
    memory: 256Mi
  limits: # kernel's enforcement: throttle CPU, kill on memory
    cpu: '1'
    memory: 512Mi
```

Three things nobody tells you:

**Requests and limits are enforced by different systems.** Requests are bookkeeping for the scheduler: a node "fits" a pod if unreserved capacity covers the request. The pod can use more than it requested if the node has slack. Limits are enforced by the Linux kernel: exceed the CPU limit and you get **throttled** (the app gets slow); exceed the memory limit and you get **OOMKilled** (the app gets dead). Slow and dead are very different failure modes, and the asymmetry is deliberate: CPU is compressible, memory is not.

**Requests drive autoscaling math.** The HPA's `averageUtilization: 80` means 80 percent _of requests_, not of the node or the limit. Set requests too high and the HPA never scales up because utilization looks low. Set them too low and it thrashes. Engineers debug "broken" autoscaling for days without knowing which number the percentage is relative to.

**The combination defines your eviction priority.** Requests equal to limits gives the `Guaranteed` QoS class, evicted last under node pressure. No requests at all gives `BestEffort`, evicted first. That copy-pasted empty resources block is a decision about which pods die first, made by accident.

For the sizing side of this, [VPA and Karpenter do the measuring for you](/posts/right-sizing-kubernetes-resources-vpa-karpenter).

## 3. A Service is not the load balancer you think it is

The word "Service" suggests a box that traffic flows through and gets balanced. There is no box. A ClusterIP is a virtual IP that exists only as NAT rules (iptables or IPVS) programmed on **every node** by kube-proxy. When your pod connects to the Service IP, its own node rewrites the destination to one backend pod, picked effectively at random. No health checks beyond readiness, no least-connections, no retries, nothing L7.

Two consequences bite constantly:

**Long-lived connections defeat the Service entirely.** The random pick happens once, per connection. gRPC, HTTP/2, database pools, websockets: they open a handful of connections and keep them. Scale the backend from 3 to 10 pods and the 7 new ones sit idle, because nobody opened a new connection to be balanced. The fix lives at L7: client-side load balancing, a mesh, or an ingress/proxy that maintains its own per-request balancing.

**Balancing is per-connection random, not round-robin.** Under low connection counts the distribution is lumpy. One pod at 80 percent CPU while its twin idles is normal Service behavior, not a bug.

```terminal
{
  "title": "there is no box, only rules",
  "steps": [
    { "comment": "the Service IP is not pingable, it only exists in NAT rules" },
    { "cmd": "kubectl get svc api -o jsonpath='{.spec.clusterIP}'", "output": "10.96.114.7" },
    { "cmd": "sudo iptables -t nat -L KUBE-SERVICES -n | grep 10.96.114.7", "output": "KUBE-SVC-XPGD46QRK7WJZT7O  tcp  --  0.0.0.0/0  10.96.114.7  /* default/api */ tcp dpt:80" },
    { "comment": "the SVC chain picks a backend with a random probability per connection" },
    { "cmd": "sudo iptables -t nat -L KUBE-SVC-XPGD46QRK7WJZT7O -n | grep probability", "output": "KUBE-SEP-A  ... statistic mode random probability 0.33333\nKUBE-SEP-B  ... statistic mode random probability 0.50000\nKUBE-SEP-C  ... (the remainder)" }
  ]
}
```

If the ClusterIP/NodePort/LoadBalancer distinction itself is still fuzzy, start with [the Service types section of our Kubernetes guide](/guides/introduction-to-kubernetes/05-services-and-networking#h2-service-types) and come back.

## 4. Rolling deploys drop requests unless you do two things

Junior version: "Kubernetes does zero-downtime deploys." Reality: the default rolling update drops requests at both edges of the pod lifecycle, and the fixes are unrelated to each other.

**The startup edge**: a pod becomes a Service endpoint the moment its readiness probe passes. No probe means "ready at container start," which is almost always before your app can serve. First fix: a readiness probe that tests something real (the HTTP port answering, not `pgrep`).

**The shutdown edge is the subtle one.** When a pod terminates, two things happen _in parallel_, not in sequence: the kubelet sends SIGTERM to your process, and the endpoint controllers start removing the pod from Service backends across every node. That propagation takes time. For a window of hundreds of milliseconds to seconds, nodes still route new requests to a pod that is already shutting down.

The standard fix is a preStop sleep, which looks like a hack and is actually load-bearing:

```yaml
lifecycle:
  preStop:
    exec:
      command: ['sleep', '5'] # keep serving while endpoint removal propagates
terminationGracePeriodSeconds: 30
```

The sleep delays SIGTERM so the pod keeps serving while the NAT rules catch up; then your app must handle SIGTERM by draining in-flight requests before exiting. Miss either half and every deploy is a small outage that your error budget pays for. Add a PodDisruptionBudget so node drains during upgrades cannot take out all replicas at once, and deploys become genuinely boring.

## 5. Liveness probes cause more outages than they prevent

The junior instinct is that probes are good, so more probes are better, so copy the readiness probe into a liveness probe. This is how partial degradation becomes a full outage.

The two probes have opposite failure semantics. Readiness failing means "stop sending me traffic," which is reversible and safe. Liveness failing means "kill and restart me," which is destructive. Now run the tape on a common incident: the database gets slow, your health endpoint (which pings the database) starts timing out, and the kubelet begins restarting _every replica at once_, throwing away warm caches and in-flight work, while the restarts themselves stampede the recovering database. The cluster did exactly what you configured: it turned a slow dependency into a restart loop. Restarting also does nothing to fix a slow database, which is the other tell: liveness restarts only help for states a restart can cure, like a deadlocked process.

The mid-level defaults: every serving container gets a readiness probe; liveness probes only where a restart genuinely un-sticks the process, never checking dependencies, with generous `failureThreshold`; slow-booting apps get a startup probe so liveness does not kill them mid-initialization. If a pod is restart-looping and the logs are empty, [the troubleshooting playbook in our Kubernetes guide](/guides/introduction-to-kubernetes/09-monitoring-and-logging-in-kubernetes#h2-a-troubleshooting-playbook) walks the diagnosis.

### Where Does the /healthz Convention Come From?

From Google. Its internal servers expose status pages whose paths end in `z`, such as `/statusz` and `/varz`, often called **z-pages**. The usual explanation for the `z` is that it makes a clash with a real application path unlikely: an app may well have a `/health` or `/status` page of its own. Kubernetes came out of Google, its components exposed `/healthz`, and the name spread from there into many other projects.

Kubernetes itself has moved on. The API server's `/healthz` has been deprecated since Kubernetes 1.16 in favor of two endpoints with clear meanings, and the control plane components still serve [other z-pages](https://kubernetes.io/docs/reference/instrumentation/zpages/) for debugging:

- **`/livez`**: is the process alive, or does it need a restart? A failure means a state such as a deadlock that only a restart fixes.
- **`/readyz`**: can it serve traffic right now? A failure means "send traffic elsewhere for a while", for example during start-up or while a dependency is unavailable.

`kubectl get --raw='/readyz?verbose'` shows each check of the API server. The same split works for your own services, and the path name matters much less than what the endpoint checks:

```yaml
livenessProbe:
  httpGet:
    path: /livez # only "the process can answer": no database, no downstream calls
    port: 8080
readinessProbe:
  httpGet:
    path: /readyz # "I can take requests": start-up finished, caches loaded
    port: 8080
```

Keep `/livez` cheap and local, for the reasons above. Let `/readyz` check what this instance needs before it can take requests, such as a finished start-up and loaded caches. Be careful with shared dependencies there too: when every replica reports "not ready" because the database is slow, the Service has no endpoints left at all. Many apps and charts still use `/healthz` for one or both probes; that works, as long as one endpoint is not asked to answer both questions.

## 6. The scheduler places pods once, then never thinks about them again

Scheduling feels like it should be continuous: surely Kubernetes keeps things balanced. It does not. The scheduler makes exactly one decision per pod, at creation, and never revisits it. Nothing rebalances a running cluster.

Where this surprises people:

- **After a node failure**, every replacement pod lands on the surviving nodes. When the failed node returns, it stays empty until unrelated churn happens to place something there.
- **Scale down, scale up**: the cluster autoscaler removes an empty node; tomorrow's scale-up packs new pods wherever they fit. Distribution degrades monotonically between deploys.
- **`nodeSelector` misses mean Pending forever**, not "best effort elsewhere." The scheduler does not compromise; it waits.

A deploy re-creates every pod, which is why "we redeployed and the hotspot went away" works: it is an accidental rebalance. The deliberate tools are `topologySpreadConstraints` (spread across zones or nodes at schedule time), pod anti-affinity for the "not on the same node as my twin" rule, and the [descheduler](https://github.com/kubernetes-sigs/descheduler) if you genuinely need ongoing rebalancing. And since the scheduler's entire worldview is the requests from concept 2, garbage requests mean garbage placement, everywhere, forever.

## 7. Namespaces organize things; they do not isolate anything

Juniors routinely believe namespaces are a security boundary because they look like one: separate names, separate quotas, separate RBAC scopes. But by default, **any pod can open a connection to any pod in any namespace**, and DNS happily hands over the address: `api.other-team.svc.cluster.local`. A compromised pod in your least-important namespace has network reach to your most important one.

Isolation is something you build with three separate mechanisms, each covering what the others do not:

- **NetworkPolicies** for traffic: a default-deny ingress policy per namespace, then explicit allows. Requires a CNI that enforces them, which is worth verifying rather than assuming.
- **RBAC** for the API: a ServiceAccount token lives inside most pods, and its permissions, not the namespace border, decide what an attacker can do with the API server after compromising the app.
- **ResourceQuotas and LimitRanges** for the noisy-neighbor problem, so one team's runaway job cannot starve another team's namespace.

The one-liner worth remembering in design reviews: namespaces are folders, not walls.

## From Concepts to a Production Workload

The seven concepts explain why a cluster behaves as it does. Before a workload goes to production, turn them into settings. This list covers the settings that teams forget most often, with examples that work on current Kubernetes versions.

### A PodDisruptionBudget for Each Service With Replicas

A PodDisruptionBudget (PDB) limits how many pods of a service a drain or an autoscaler can evict at the same time:

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: payment-api
spec:
  maxUnavailable: 1 # at most one pod down for voluntary evictions
  selector:
    matchLabels:
      app: payment-api
```

A PDB protects only against voluntary evictions, such as `kubectl drain` and node upgrades. It does nothing when a node crashes. Do not set `minAvailable` equal to the number of replicas: then no pod may be evicted, and every node drain and cluster upgrade stops at that node.

### NetworkPolicies That Also Allow DNS

Start from deny, then allow what each app needs. Two mistakes break many first policies. Namespaces have no `name` label by default, so select them by the automatic `kubernetes.io/metadata.name` label. And an egress policy that does not allow DNS makes every name lookup fail:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api
  namespace: api
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes: [Ingress, Egress]
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: frontend
      ports:
        - protocol: TCP
          port: 8080
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: database
      ports:
        - protocol: TCP
          port: 5432
    - to: # cluster DNS; without this rule, the app cannot resolve any name
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - protocol: UDP
          port: 53
        - protocol: TCP
          port: 53
```

The policy has no effect if your CNI plugin does not enforce NetworkPolicies, so test it: a pod in a namespace other than `frontend` should not reach port 8080 on the `api` pods. Policies add up, so another policy can still allow that traffic.

### A Restricted Security Context

For Linux pods, the `restricted` level of Pod Security Admission requires `runAsNonRoot`, `allowPrivilegeEscalation: false`, dropping all capabilities, and a seccomp profile. Without `seccompProfile`, a pod that looks locked down is still rejected in a namespace that enforces `restricted`. A read-only root file system is not required, but it is a good addition:

```yaml
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 10001
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: app
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true # mount an emptyDir for paths the app must write to
        capabilities:
          drop: ['ALL']
```

### Secrets, Storage and Autoscaling

- **Secrets** are base64, not encrypted, and anyone allowed to `list` Secrets in a namespace can read every one of them. Turn on encryption at rest, limit `get` and `list` on Secrets in RBAC, and keep the real values in a secret manager with the External Secrets Operator (`external-secrets.io/v1` API) or in Git with Sealed Secrets.
- **Storage** is selected with `spec.storageClassName` on the PVC. The `volume.beta.kubernetes.io/storage-class` annotation in old examples is deprecated.
- **Autoscaling on custom metrics**, such as queue length, needs a metrics adapter in the cluster, for example the Prometheus Adapter or KEDA. A `HorizontalPodAutoscaler` with a `Pods` metric and no adapter never scales and reports that it cannot get the metric.

The [production checklist](/guides/introduction-to-kubernetes/10-best-practices-in-kubernetes#h2-production-checklist) in the Kubernetes guide and the [Kubernetes security checklist](/checklists/kubernetes-security) cover the rest, and the [Pod Security Standards flashcards](/flashcards/pod-security-standards-kubernetes) help you remember what each level requires.

## What connects all seven

Every one of these is the same lesson wearing different clothes: the YAML is an interface, not the machine. Underneath it there is a scheduler doing one-shot bin-packing on requests, kube-proxy programming NAT rules, a kernel enforcing cgroups, and a hundred control loops reconciling forever. Junior engineers know what the YAML fields are called. Mid-level engineers know which system reads each field and what it does with it.

You can pressure-test most of these hands-on in our [Kubernetes terminal simulator](/games/kubernetes-terminal-simulator) and the [networking simulator](/games/kubernetes-networking-cni-simulator), and when you are ready for the storage layer, [the anatomy of persistent storage](/posts/anatomy-of-kubernetes-persistent-storage) picks up where this post stops.

## Summary

- Think in desired state and control loops; stop thinking in commands.
- Set requests from measurements, know that limits throttle CPU but kill memory, and remember HPA percentages are relative to requests.
- Treat Services as per-connection NAT, and move long-lived-connection balancing to L7.
- Make deploys actually zero-downtime: real readiness probe, preStop sleep, SIGTERM draining, and a PodDisruptionBudget.
- Be stingy with liveness probes, and never let them check dependencies.
- Use topology spread constraints, because nobody is coming to rebalance your cluster.
- Build isolation explicitly with NetworkPolicies, RBAC, and quotas; the namespace border alone is decorative.
