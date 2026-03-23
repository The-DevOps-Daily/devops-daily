---
title: 'Kubernetes Pod Networking Fundamentals: How Pods Communicate in a Cluster'
excerpt: 'Learn how Kubernetes pod networking works under the hood -- from pod-to-pod communication and the flat network model, to Services, endpoints, and cluster DNS resolution. Practical examples included.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2026-03-20'
publishedAt: '2026-03-20T09:00:00Z'
updatedAt: '2026-03-20T09:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Kubernetes
  - Networking
  - Pod Networking
  - Services
  - DNS
  - Container Orchestration
  - CoreDNS
---

Every container you deploy to Kubernetes needs to talk to other containers. Your API server calls a database. Your frontend proxies requests to a backend. Your monitoring agent scrapes metrics from every node. None of this works unless you understand how Kubernetes networking is wired together.

This post covers the three layers that matter most for day-to-day operations: pod-to-pod communication, Services that provide stable endpoints, and DNS resolution that lets you forget about IP addresses entirely. By the end, you will be able to trace a network request from one pod to another and debug the most common connectivity issues.

## TL;DR

- Every pod gets its own unique IP address. Pods communicate directly with each other using these IPs -- no NAT required.
- **Services** provide a stable virtual IP (ClusterIP) that load-balances traffic across a set of pods matched by label selectors.
- **CoreDNS** resolves service names to ClusterIPs, so you connect to `my-service.my-namespace.svc.cluster.local` instead of hardcoding IPs.
- **kube-proxy** programs iptables (or IPVS) rules on every node to route Service traffic to healthy pod endpoints.

## Prerequisites

- A running Kubernetes cluster (minikube, kind, or a managed cluster like EKS/GKE/AKS)
- `kubectl` installed and configured with cluster access
- Basic familiarity with pods, deployments, and namespaces
- Comfort reading YAML manifests

## The Kubernetes Network Model

Kubernetes enforces a few non-negotiable networking rules that every CNI (Container Network Interface) plugin must implement:

1. **Every pod gets a unique IP address.** No two pods share an IP within the cluster.
2. **Pods on any node can communicate with pods on any other node without NAT.** The source IP that the receiving pod sees is the real pod IP of the sender.
3. **Agents on a node (like the kubelet) can communicate with all pods on that node.**

This is often called the **flat network model**. It means you can think of every pod as if it were a regular host on the same network segment.

```
+------------------+                    +------------------+
|     Node A       |                    |     Node B       |
|                  |                    |                  |
| +------+ +------+|                    |+------+ +------+ |
| |Pod   | |Pod   ||                    ||Pod   | |Pod   | |
| |10.1  | |10.1  ||   Flat Network     ||10.2  | |10.2  | |
| |.1.10 | |.1.11 || <================> ||.2.20 | |.2.21 | |
| +------+ +------+|   (No NAT)        |+------+ +------+ |
|                  |                    |                  |
+------------------+                    +------------------+
```

### How CNI Plugins Make This Work

The flat network model is a contract -- not an implementation. The actual packet routing is handled by a **CNI plugin**. Common choices include:

- **Calico** -- uses BGP to distribute routes, supports network policies natively
- **Flannel** -- simple overlay network using VXLAN
- **Cilium** -- eBPF-based, high performance, advanced observability
- **Weave Net** -- mesh overlay, easy to set up

Each plugin assigns pod IPs from a configured CIDR range (the **pod CIDR**) and sets up the routing rules so that traffic between any two pods finds its way across nodes.

You can inspect your cluster's pod CIDR with:

```bash
kubectl cluster-info dump | grep -m 1 cluster-cidr
# Example output: --cluster-cidr=10.244.0.0/16
```

## Pod-to-Pod Communication

Within the flat network, pods communicate directly. Let's see this in practice.

### Same-Node Communication

When two pods are on the same node, traffic flows through a **virtual bridge** (typically `cbr0` or `cni0`) created by the CNI plugin.

```
+-------------------------------------------+
|                  Node                      |
|                                            |
|  +--------+    +--------+                  |
|  | Pod A  |    | Pod B  |                  |
|  | eth0   |    | eth0   |                  |
|  +---+----+    +---+----+                  |
|      |  veth pair  |                       |
|  +---+-------------+----+                  |
|  |      cni0 bridge     |                  |
|  +-----------------------+                  |
+-------------------------------------------+
```

Traffic from Pod A to Pod B goes through Pod A's `eth0`, over a **veth pair** into the bridge, and then over another veth pair into Pod B's `eth0`. The kernel handles this entirely at Layer 2 -- fast and efficient.

### Cross-Node Communication

When pods are on different nodes, the CNI plugin handles routing across the node boundary. With an overlay network like Flannel (VXLAN mode), the flow looks like this:

1. Pod A sends a packet to Pod B's IP.
2. The packet hits the node's routing table. The route for Pod B's subnet points to a VXLAN tunnel.
3. The node encapsulates the original packet in a UDP/VXLAN wrapper and sends it to Node B.
4. Node B decapsulates the packet and delivers it to Pod B.

You can verify cross-node connectivity with a simple test:

```bash
# Deploy two pods on different nodes
kubectl run pod-a --image=busybox --restart=Never -- sleep 3600
kubectl run pod-b --image=busybox --restart=Never -- sleep 3600

# Get Pod B's IP
POD_B_IP=$(kubectl get pod pod-b -o jsonpath='{.status.podIP}')

# Ping from Pod A to Pod B
kubectl exec pod-a -- ping -c 3 "$POD_B_IP"
# PING 10.244.1.5 (10.244.1.5): 56 data bytes
# 64 bytes from 10.244.1.5: seq=0 ttl=62 time=0.743 ms
# 64 bytes from 10.244.1.5: seq=1 ttl=62 time=0.512 ms
# 64 bytes from 10.244.1.5: seq=2 ttl=62 time=0.487 ms
```

Notice the TTL of 62 (instead of 64). The two decrements tell you the packet crossed two Layer 3 hops -- one at each node boundary.

## Services: Stable Endpoints for Ephemeral Pods

Pod IPs are ephemeral. Every time a pod restarts, it gets a new IP. You never want to hardcode pod IPs in your application config. This is where **Services** come in.

A Service provides a stable IP address (the **ClusterIP**) and a DNS name. It uses **label selectors** to determine which pods receive traffic, and it load-balances across those pods.

### ClusterIP Service

The default Service type. It creates an internal-only virtual IP.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: backend-api
  namespace: production
spec:
  selector:
    app: backend        # matches pods with this label
    tier: api
  ports:
    - name: http
      protocol: TCP
      port: 80          # port the Service listens on
      targetPort: 8080  # port the container listens on
  type: ClusterIP
```

```bash
kubectl apply -f backend-service.yaml
kubectl get svc backend-api -n production
# NAME          TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)   AGE
# backend-api   ClusterIP   10.96.47.182   <none>        80/TCP    5s
```

Any pod in the cluster can now reach the backend at `10.96.47.182:80` or, better yet, by DNS name `backend-api.production.svc.cluster.local`.

### How kube-proxy Routes Service Traffic

**kube-proxy** runs on every node and watches the Kubernetes API for Service and Endpoint changes. It programs routing rules so that traffic destined for a ClusterIP gets redirected to one of the backing pods.

kube-proxy supports three modes:

| Mode | Mechanism | Performance |
|------|-----------|-------------|
| **iptables** (default) | Netfilter rules with random probability-based load balancing | Good for most clusters |
| **IPVS** | Kernel-level L4 load balancer | Better for clusters with thousands of Services |
| **nftables** | Next-gen replacement for iptables | Available in newer clusters |

The packet flow for a ClusterIP Service in iptables mode:

```
Pod A (10.244.1.10)
  |
  | dst: 10.96.47.182:80  (ClusterIP)
  v
iptables DNAT
  |
  | dst rewritten to: 10.244.2.15:8080  (Pod B)
  v
CNI routing
  |
  v
Pod B (10.244.2.15:8080)
```

You can inspect the iptables rules that kube-proxy creates:

```bash
# On a cluster node (not from inside a pod)
sudo iptables -t nat -L KUBE-SERVICES -n | grep backend-api
# -A KUBE-SERVICES -d 10.96.47.182/32 -p tcp -m tcp --dport 80 -j KUBE-SVC-XXXXXX
```

### NodePort and LoadBalancer Services

Beyond ClusterIP, Kubernetes offers two other Service types for external access:

**NodePort** opens a static port (30000-32767) on every node:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: frontend
spec:
  selector:
    app: frontend
  ports:
    - port: 80
      targetPort: 3000
      nodePort: 31080    # accessible on every node at this port
  type: NodePort
```

**LoadBalancer** provisions a cloud load balancer (on AWS, GCP, Azure) that routes to the NodePort:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: frontend-lb
spec:
  selector:
    app: frontend
  ports:
    - port: 80
      targetPort: 3000
  type: LoadBalancer
```

The hierarchy looks like this:

```
LoadBalancer
  └── NodePort
        └── ClusterIP
              └── Pod Endpoints
```

Each type builds on the one below it.

### Endpoints and EndpointSlices

When you create a Service, Kubernetes automatically creates an **Endpoints** object (or **EndpointSlices** in newer clusters) that tracks which pod IPs are healthy and ready to receive traffic.

```bash
kubectl get endpoints backend-api -n production
# NAME          ENDPOINTS                                   AGE
# backend-api   10.244.1.15:8080,10.244.2.22:8080           2m

kubectl get endpointslices -l kubernetes.io/service-name=backend-api -n production
# NAME                  ADDRESSTYPE   PORTS   ENDPOINTS                  AGE
# backend-api-abc12     IPv4          8080    10.244.1.15,10.244.2.22    2m
```

If a pod fails its **readiness probe**, it gets removed from the Endpoints list. Traffic stops flowing to it until it becomes ready again. This is how Kubernetes achieves zero-downtime deployments -- new pods must pass readiness checks before they receive traffic, and old pods are removed from endpoints before they are terminated.

## DNS Resolution with CoreDNS

Kubernetes runs **CoreDNS** as a cluster add-on (deployed as pods in the `kube-system` namespace). Every pod in the cluster is configured to use CoreDNS as its DNS resolver.

### Service DNS Records

CoreDNS creates DNS records for every Service in the cluster. The fully qualified domain name (FQDN) follows this pattern:

```
<service-name>.<namespace>.svc.cluster.local
```

For example:

| Service | Namespace | FQDN |
|---------|-----------|------|
| backend-api | production | `backend-api.production.svc.cluster.local` |
| redis | cache | `redis.cache.svc.cluster.local` |
| postgres | default | `postgres.default.svc.cluster.local` |

You don't always need the full FQDN. Kubernetes configures pod DNS search domains so that shorter names resolve:

```bash
# From a pod in the "production" namespace:
nslookup backend-api
# Resolves: backend-api.production.svc.cluster.local

# Cross-namespace: use <service>.<namespace>
nslookup redis.cache
# Resolves: redis.cache.svc.cluster.local
```

### How Pod DNS Is Configured

Every pod gets a `/etc/resolv.conf` that points to CoreDNS:

```bash
kubectl exec pod-a -- cat /etc/resolv.conf
# nameserver 10.96.0.10
# search production.svc.cluster.local svc.cluster.local cluster.local
# options ndots:5
```

The key fields:

- **nameserver** -- the ClusterIP of the CoreDNS Service (typically `10.96.0.10`)
- **search** -- the search domains that get appended when resolving short names
- **ndots:5** -- if a name has fewer than 5 dots, the resolver tries appending each search domain before querying as-is

The `ndots:5` setting is important to understand. When your app resolves `backend-api`, the resolver first tries `backend-api.production.svc.cluster.local`, then `backend-api.svc.cluster.local`, then `backend-api.cluster.local`, and finally `backend-api` as-is. This means short internal names resolve quickly, but external names like `api.github.com` (which has 2 dots, fewer than 5) generate several failed lookups before succeeding.

For pods that make heavy external DNS queries, you can reduce this overhead:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: external-caller
spec:
  dnsConfig:
    options:
      - name: ndots
        value: "2"    # reduce unnecessary search domain lookups
  containers:
    - name: app
      image: my-app:latest
```

### Headless Services

Sometimes you need to discover individual pod IPs rather than load-balance through a ClusterIP. **Headless Services** (where `clusterIP: None`) return the pod IPs directly in DNS responses.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: database
spec:
  clusterIP: None       # makes this a headless Service
  selector:
    app: postgres
  ports:
    - port: 5432
      targetPort: 5432
```

```bash
# DNS lookup returns individual pod IPs
kubectl exec pod-a -- nslookup postgres.database.svc.cluster.local
# Name:   postgres.database.svc.cluster.local
# Address: 10.244.1.30
# Address: 10.244.2.31
# Address: 10.244.3.32
```

This is essential for **StatefulSets** where each replica has a stable identity. Combined with a headless Service, each StatefulSet pod gets its own DNS record:

```
postgres-0.postgres.database.svc.cluster.local -> 10.244.1.30
postgres-1.postgres.database.svc.cluster.local -> 10.244.2.31
postgres-2.postgres.database.svc.cluster.local -> 10.244.3.32
```

## Debugging Networking Issues

When connectivity breaks, here is a systematic approach to diagnose the problem.

### Step 1: Verify Pod Network Connectivity

```bash
# Check that the pod is running and has an IP
kubectl get pod my-pod -o wide
# NAME     READY   STATUS    IP            NODE
# my-pod   1/1     Running   10.244.1.15   node-a

# Test direct pod-to-pod connectivity
kubectl exec debug-pod -- wget -qO- --timeout=3 http://10.244.1.15:8080/health
```

### Step 2: Verify Service Endpoints

```bash
# Check that the Service has endpoints
kubectl get endpoints my-service
# If ENDPOINTS is <none>, the selector doesn't match any running, ready pods

# Verify labels match
kubectl get pods --show-labels | grep my-app
kubectl describe svc my-service | grep Selector
```

### Step 3: Test DNS Resolution

```bash
# Run a debug pod with DNS tools
kubectl run dns-debug --image=busybox:1.36 --restart=Never -- sleep 3600

# Test resolution
kubectl exec dns-debug -- nslookup my-service.my-namespace.svc.cluster.local

# Check CoreDNS is running
kubectl get pods -n kube-system -l k8s-app=kube-dns
```

### Step 4: Check Network Policies

If you use **NetworkPolicy** resources, they may be blocking traffic. A common mistake is creating a policy that inadvertently denies all ingress:

```bash
# List policies in the namespace
kubectl get networkpolicies -n my-namespace

# Describe to see ingress/egress rules
kubectl describe networkpolicy my-policy -n my-namespace
```

### Common Issues Cheat Sheet

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Pod can't reach another pod by IP | CNI plugin misconfigured or node routing broken | Check CNI pod logs, verify node routes |
| Service has no endpoints | Label selector mismatch or no ready pods | Compare `svc.spec.selector` with pod labels |
| DNS resolution fails | CoreDNS pods not running or crashlooping | Check `kube-system` pods, CoreDNS logs |
| Intermittent timeouts | Readiness probe too aggressive, pods flapping in/out of endpoints | Tune readiness probe thresholds |
| External DNS slow | `ndots:5` causing excessive search domain queries | Lower `ndots` in pod dnsConfig |

## Best Practices

- **Always use Service DNS names** in application config, never hardcode pod or ClusterIP addresses. Services are the abstraction boundary.
- **Set meaningful readiness probes** so that only healthy pods receive traffic. A pod without a readiness probe is considered ready immediately, which can cause errors during startup.
- **Use NetworkPolicies** to enforce least-privilege network access. By default, all pods can talk to all other pods -- this is rarely what you want in production.
- **Monitor CoreDNS** metrics and resource usage. DNS is a shared dependency for every pod in the cluster. If CoreDNS is overwhelmed, everything breaks.
- **Tune `ndots`** for pods that make heavy external DNS queries. The default of 5 is optimized for in-cluster lookups.
- **Use headless Services** for stateful workloads where clients need to connect to specific pod instances.
- **Prefer EndpointSlices** over Endpoints for large-scale clusters. EndpointSlices shard endpoint data and scale better with thousands of pods.

Understanding these networking fundamentals gives you the mental model to debug connectivity issues quickly and design your cluster topology with confidence. Every abstraction in Kubernetes networking -- Services, DNS, kube-proxy rules -- exists to solve the problem of connecting ephemeral, dynamically-scheduled pods in a reliable way.

---

To generate the OG image for this post, run:

```bash
npm run generate:images:parallel
npm run convert:svg-to-png:parallel
```
