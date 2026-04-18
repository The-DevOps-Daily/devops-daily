---
title: 'Day 14 - Networking Debugging'
day: 14
excerpt: 'Debug network connectivity issues in Kubernetes including DNS, service discovery, and network policies.'
description: 'Master Kubernetes networking troubleshooting by debugging DNS resolution, service connectivity, network policies, and inter-pod communication.'
publishedAt: '2026-12-14T00:00:00Z'
updatedAt: '2026-12-14T00:00:00Z'
difficulty: 'Advanced'
category: 'Kubernetes'
tags:
  - Kubernetes
  - Networking
  - Debugging
  - DNS
---

## Description

Your pods can't communicate with each other. DNS lookups are failing, services aren't reachable, and you suspect network policies might be blocking traffic. Time to dive into Kubernetes networking and debug the issues.

## Task

Debug and fix networking issues in a Kubernetes cluster.

**Requirements:**
- Diagnose DNS resolution problems
- Fix service connectivity issues
- Debug network policies
- Verify pod-to-pod communication
- Test external connectivity

## Target

- ✅ DNS resolution working
- ✅ Services accessible from pods
- ✅ Network policies correctly configured
- ✅ Pod-to-pod communication functional
- ✅ External endpoints reachable

## Sample App

### Broken Networking Setup

#### broken-app.yaml

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: broken-net
---
# Frontend app
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: broken-net
spec:
  replicas: 1
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
        tier: frontend
    spec:
      containers:
      - name: frontend
        image: nginx:alpine
        ports:
        - containerPort: 80
---
# Backend app
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: broken-net
spec:
  replicas: 1
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
        tier: backend
    spec:
      containers:
      - name: backend
        image: hashicorp/http-echo
        args:
        - -text=backend
        - -listen=:5678
        ports:
        - containerPort: 5678
---
# Backend service (wrong selector!)
apiVersion: v1
kind: Service
metadata:
  name: backend
  namespace: broken-net
spec:
  selector:
    app: api  # Wrong! Should be 'backend'
  ports:
  - port: 80
    targetPort: 5678
---
# Network policy that blocks everything
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all
  namespace: broken-net
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
```

## Solution

### 1. Network Debugging Toolkit

#### Deploy Debug Pod

```yaml
# debug-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: netdebug
  namespace: broken-net
spec:
  containers:
  - name: netdebug
    image: nicolaka/netshoot
    command:
      - /bin/bash
      - -c
      - sleep 3600
```

```bash
# Apply and exec into it
kubectl apply -f debug-pod.yaml
kubectl exec -it netdebug -n broken-net -- /bin/bash
```

### 2. DNS Debugging

#### Test DNS Resolution

```bash
# From inside netdebug pod:

# Test DNS resolution
nslookup kubernetes.default
nslookup backend.broken-net.svc.cluster.local

# Verbose DNS query
dig backend.broken-net.svc.cluster.local

# Check DNS config
cat /etc/resolv.conf

# Test different DNS servers
nslookup backend.broken-net.svc.cluster.local 10.96.0.10

# Query specific DNS record types
dig backend.broken-net.svc.cluster.local A
dig backend.broken-net.svc.cluster.local SRV
```

#### Check CoreDNS

```bash
# Check CoreDNS pods
kubectl get pods -n kube-system -l k8s-app=kube-dns

# Check CoreDNS logs
kubectl logs -n kube-system -l k8s-app=kube-dns --tail=50

# Check CoreDNS configmap
kubectl get configmap coredns -n kube-system -o yaml

# Test CoreDNS service
kubectl get svc kube-dns -n kube-system
kubectl describe svc kube-dns -n kube-system
```

### 3. Service Debugging

```bash
# List services
kubectl get svc -n broken-net

# Describe service
kubectl describe svc backend -n broken-net
# Look for: Endpoints - should match pod IPs

# Get endpoints
kubectl get endpoints backend -n broken-net
# If empty, selector is wrong!

# Check service selector matches pod labels
kubectl get pods -n broken-net --show-labels
kubectl get svc backend -n broken-net -o jsonpath='{.spec.selector}'

# Port forward to test service directly
kubectl port-forward svc/backend -n broken-net 8080:80
curl http://localhost:8080
```

### 4. Network Policy Debugging

```bash
# List network policies
kubectl get networkpolicies -n broken-net

# Describe network policy
kubectl describe networkpolicy deny-all -n broken-net

# Test connectivity without policy
kubectl label namespace broken-net network-policy-test=true

# Check if pods match policy selector
kubectl get pods -n broken-net --show-labels
```

### 5. Pod-to-Pod Communication

```bash
# Get pod IPs
kubectl get pods -n broken-net -o wide

# From netdebug pod, test direct pod IP
curl http://<pod-ip>:5678

# Test via service DNS
curl http://backend.broken-net.svc.cluster.local

# Trace network path
traceroute backend.broken-net.svc.cluster.local

# Check network connectivity
ping <pod-ip>
telnet backend.broken-net.svc.cluster.local 80

# TCP connection test
nc -zv backend.broken-net.svc.cluster.local 80
```

### 6. Fixed Configuration

#### fixed-app.yaml

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: fixed-net
  labels:
    name: fixed-net
---
# Frontend app
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: fixed-net
  labels:
    app: frontend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
        tier: frontend
    spec:
      containers:
      - name: frontend
        image: nginx:alpine
        ports:
        - containerPort: 80
          name: http
---
# Frontend service
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: fixed-net
spec:
  selector:
    app: frontend
  ports:
  - port: 80
    targetPort: 80
    name: http
---
# Backend app
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: fixed-net
  labels:
    app: backend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
        tier: backend
    spec:
      containers:
      - name: backend
        image: hashicorp/http-echo
        args:
        - -text=backend response
        - -listen=:5678
        ports:
        - containerPort: 5678
          name: http
---
# Backend service (correct selector!)
apiVersion: v1
kind: Service
metadata:
  name: backend
  namespace: fixed-net
spec:
  selector:
    app: backend  # Correct!
  ports:
  - port: 80
    targetPort: 5678
    name: http
---
# Allow frontend to backend
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-policy
  namespace: fixed-net
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - protocol: TCP
      port: 5678
---
# Allow frontend ingress
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: frontend-policy
  namespace: fixed-net
spec:
  podSelector:
    matchLabels:
      app: frontend
  policyTypes:
  - Ingress
  ingress:
  - ports:
    - protocol: TCP
      port: 80
---
# Allow DNS for all pods
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns
  namespace: fixed-net
spec:
  podSelector: {}
  policyTypes:
  - Egress
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
    ports:
    - protocol: UDP
      port: 53
```

## Explanation

### Kubernetes Networking Basics

#### 1. Pod-to-Pod Communication

Every pod gets its own IP address:
```
Pod A (10.244.1.5) → Pod B (10.244.2.8)
```

No NAT between pods (flat network).

#### 2. Services

Services provide stable DNS names:
```
Service: backend.default.svc.cluster.local → 10.96.1.100 (ClusterIP)
         ↓
Endpoints: 10.244.1.5:5678, 10.244.2.8:5678 (Pod IPs)
```

#### 3. DNS

**DNS format:**
```
<service-name>.<namespace>.svc.cluster.local
```

**Examples:**
- `backend` (same namespace)
- `backend.default` (specify namespace)
- `backend.default.svc.cluster.local` (FQDN)

#### 4. Network Policies

**Default:** All traffic allowed

**With NetworkPolicy:** Explicit allow required

```yaml
# Allow frontend → backend
ingress:
- from:
  - podSelector:
      matchLabels:
        app: frontend
```

### Common Issues and Solutions

| Issue | Symptom | Solution |
|-------|---------|----------|
| **Wrong selector** | Service has no endpoints | Fix `selector` to match pod labels |
| **DNS failure** | `nslookup` fails | Check CoreDNS pods, network policies |
| **Port mismatch** | Connection refused | Match service `port` to container `containerPort` |
| **Network policy** | Can't reach service | Add ingress/egress rules |
| **Namespace** | Service not found | Use FQDN with namespace |

## Result

### Deploy and Test

```bash
# Deploy fixed configuration
kubectl apply -f fixed-app.yaml

# Wait for pods
kubectl wait --for=condition=ready pod -l app=frontend -n fixed-net
kubectl wait --for=condition=ready pod -l app=backend -n fixed-net

# Verify services have endpoints
kubectl get endpoints -n fixed-net

# Output should show:
# NAME       ENDPOINTS
# backend    10.244.1.5:5678,10.244.2.8:5678
# frontend   10.244.1.6:80,10.244.2.9:80

# Test from frontend pod
FRONTEND_POD=$(kubectl get pod -n fixed-net -l app=frontend -o jsonpath='{.items[0].metadata.name}')

kubectl exec -n fixed-net $FRONTEND_POD -- curl -s http://backend
# Should return: backend response
```

### Comprehensive Network Test

```bash
# Deploy test pod
kubectl run test -n fixed-net --rm -it --image=nicolaka/netshoot -- /bin/bash

# Inside test pod:

# 1. Test DNS
nslookup backend.fixed-net.svc.cluster.local
# Should resolve

# 2. Test service by name
curl http://backend.fixed-net.svc.cluster.local
# Should work

# 3. Test short name (same namespace)
curl http://backend
# Should work

# 4. Test direct pod IP
POD_IP=$(kubectl get pod -n fixed-net -l app=backend -o jsonpath='{.items[0].status.podIP}')
curl http://$POD_IP:5678
# Might fail due to network policy

# 5. Test external connectivity
curl -I https://google.com
# Should work (unless egress policy blocks)
```

## Validation

### Network Debugging Checklist

```bash
# 1. Pods are running
kubectl get pods -n fixed-net
# All should be Running

# 2. Services have endpoints
kubectl get endpoints -n fixed-net
# Should show pod IPs

# 3. DNS works
kubectl run dnstest --rm -it --image=busybox -n fixed-net -- nslookup backend
# Should resolve

# 4. Service reachable
kubectl run curltest --rm -it --image=curlimages/curl -n fixed-net -- curl http://backend
# Should return response

# 5. Network policies applied
kubectl get networkpolicy -n fixed-net
# Should show policies

# 6. CoreDNS healthy
kubectl get pods -n kube-system -l k8s-app=kube-dns
# Should be Running
```

### Debugging Commands Reference

```bash
# DNS debugging
kubectl run dnsutils --rm -it --image=tutum/dnsutils -- /bin/bash
nslookup <service>
dig <service>

# Network debugging
kubectl run netdebug --rm -it --image=nicolaka/netshoot -- /bin/bash
curl, ping, traceroute, nslookup, dig, nc, tcpdump

# Service endpoints
kubectl get endpoints <service> -n <namespace>

# Network policies
kubectl get networkpolicy -n <namespace>
kubectl describe networkpolicy <name> -n <namespace>

# Pod connectivity
kubectl exec -it <pod> -n <namespace> -- curl http://<service>

# Check network plugin
kubectl get pods -n kube-system | grep -E 'calico|flannel|weave'
```

## Advanced Debugging

### Packet Capture

```bash
# Capture traffic on pod
kubectl exec -it <pod> -- tcpdump -i any -w /tmp/capture.pcap

# Copy capture file
kubectl cp <pod>:/tmp/capture.pcap ./capture.pcap

# Analyze with Wireshark
wireshark capture.pcap
```

### CNI Plugin Debugging

```bash
# Check CNI config
cat /etc/cni/net.d/10-calico.conflist

# Check CNI binaries
ls /opt/cni/bin/

# View CNI logs (depends on plugin)
kubectl logs -n kube-system -l k8s-app=calico-node
```

### Service Mesh Debugging

```bash
# If using Istio
istioctl analyze -n <namespace>
kubectl logs -n istio-system -l app=istiod

# Check proxy logs
kubectl logs <pod> -c istio-proxy
```

## Best Practices

### ✅ Do's

1. **Use services**: Don't rely on pod IPs
2. **Test DNS**: Verify resolution first
3. **Label consistently**: Match selectors to labels
4. **Use FQDN**: Especially cross-namespace
5. **Document policies**: Network policies are powerful
6. **Monitor CoreDNS**: DNS is critical

### ❌ Don'ts

1. **Don't hardcode IPs**: Use service names
2. **Don't skip health checks**: Prevents traffic to broken pods
3. **Don't block DNS**: Always allow DNS in policies
4. **Don't forget namespaces**: Include in service names
5. **Don't mix ports**: Match service to container ports

## Links

- [Kubernetes Networking](https://kubernetes.io/docs/concepts/services-networking/)
- [Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
- [DNS for Services](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/)
- [Debug Services](https://kubernetes.io/docs/tasks/debug/debug-application/debug-service/)
- [Network Policy Recipes](https://github.com/ahmetb/kubernetes-network-policy-recipes)

## Share Your Success

Debugged networking issues? Share your victory!

**Tag [@thedevopsdaily](https://x.com/thedevopsdaily)** on X with:
- What was broken
- How you debugged it
- Tools that helped most
- Lessons learned

Use hashtags: **#AdventOfDevOps #Kubernetes #Networking #Day14**
