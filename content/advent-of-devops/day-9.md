---
title: 'Day 9 - Fix a Failing Pod'
day: 9
excerpt: 'Debug and fix a Kubernetes pod that crashes on startup. Master essential troubleshooting techniques.'
description: 'Learn systematic Kubernetes debugging by diagnosing and fixing common pod failures including CrashLoopBackOff, ImagePullBackOff, and configuration errors.'
publishedAt: '2026-12-09T00:00:00Z'
updatedAt: '2026-12-09T00:00:00Z'
difficulty: 'Intermediate'
category: 'Kubernetes'
tags:
  - Kubernetes
  - Debugging
  - Troubleshooting
  - Pods
---

## Description

Your pod is stuck in `CrashLoopBackOff` status. The application worked fine locally with Docker, but something is wrong in the Kubernetes deployment. Time to put on your debugging hat and figure out what's broken.

## Task

Debug and fix a failing Kubernetes pod.

**Requirements:**
- Identify the root cause of pod failure
- Use kubectl debugging commands effectively
- Fix the underlying issue
- Verify the pod runs successfully
- Document the troubleshooting process

## Target

- ✅ Pod status changes from CrashLoopBackOff to Running
- ✅ All containers in the pod are ready
- ✅ Application responds to requests
- ✅ Root cause identified and documented

## Sample App

### Broken Deployment

```yaml
# broken-deployment.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: broken-app
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: broken-app
data:
  DATABASE_URL: "postgresql://db:5432/mydb"
  API_KEY: ""  # Empty! Will cause issues
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: broken-app
  namespace: broken-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: broken-app
  template:
    metadata:
      labels:
        app: broken-app
    spec:
      containers:
      - name: app
        image: nginx:wrongtag  # Image doesn't exist!
        ports:
        - containerPort: 3000

        env:
        - name: DATABASE_URL
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: DATABASE_URL
        - name: API_KEY
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: API_KEY

        # Wrong port for probe!
        livenessProbe:
          httpGet:
            path: /health
            port: 8080  # App listens on 3000!
          initialDelaySeconds: 5
          periodSeconds: 10

        resources:
          requests:
            memory: "10Gi"  # Too much memory!
            cpu: "8"        # Too many CPUs!
          limits:
            memory: "10Gi"
            cpu: "8"
---
apiVersion: v1
kind: Service
metadata:
  name: broken-app
  namespace: broken-app
spec:
  selector:
    app: broken-app
  ports:
  - port: 80
    targetPort: 3000
```

## Solution

### Debugging Process

#### Step 1: Check Pod Status

```bash
# List pods
kubectl get pods -n broken-app

# Output shows various failure states:
# NAME                          READY   STATUS             RESTARTS   AGE
# broken-app-5d7f8c9b4d-abc12   0/1     ImagePullBackOff   0          2m
# broken-app-7g8h9i0j1k-def34   0/1     CrashLoopBackOff   5          5m
# broken-app-2l3m4n5o6p-ghi78   0/1     Pending            0          1m
```

#### Step 2: Describe the Pod

```bash
# Get detailed information
kubectl describe pod broken-app-xxx -n broken-app

# Look for:
# - Events section (shows what happened)
# - Conditions (why it's failing)
# - Container statuses
```

#### Step 3: Check Pod Logs

```bash
# View current logs
kubectl logs broken-app-xxx -n broken-app

# View previous container logs (if crashed)
kubectl logs broken-app-xxx -n broken-app --previous

# Follow logs in real-time
kubectl logs -f broken-app-xxx -n broken-app

# For multi-container pods
kubectl logs broken-app-xxx -n broken-app -c container-name
```

#### Step 4: Check Events

```bash
# Namespace events
kubectl get events -n broken-app --sort-by='.lastTimestamp'

# Common issues shown:
# - Failed to pull image
# - Insufficient memory
# - Liveness probe failed
# - Container crashed
```

#### Step 5: Exec into Pod (if running)

```bash
# Interactive shell
kubectl exec -it broken-app-xxx -n broken-app -- /bin/sh

# Run specific command
kubectl exec broken-app-xxx -n broken-app -- env
kubectl exec broken-app-xxx -n broken-app -- cat /etc/config/app.conf
```

### Common Issues and Fixes

#### Issue 1: ImagePullBackOff

**Symptom:**
```
Events:
  Failed to pull image "nginx:wrongtag": rpc error: code = Unknown desc = Error response from daemon: manifest for nginx:wrongtag not found
```

**Fix:**
```yaml
containers:
- name: app
  image: nginx:1.25-alpine  # Correct tag
  imagePullPolicy: IfNotPresent
```

#### Issue 2: CrashLoopBackOff - Wrong Probe Port

**Symptom:**
```
Liveness probe failed: Get "http://10.1.2.3:8080/health": dial tcp 10.1.2.3:8080: connect: connection refused
```

**Fix:**
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000  # Correct port!
  initialDelaySeconds: 30  # Give app time to start
  periodSeconds: 10
```

#### Issue 3: Pending - Insufficient Resources

**Symptom:**
```
Events:
  0/3 nodes are available: 3 Insufficient memory, 3 Insufficient cpu
```

**Fix:**
```yaml
resources:
  requests:
    memory: "128Mi"  # Realistic request
    cpu: "100m"
  limits:
    memory: "256Mi"
    cpu: "200m"
```

#### Issue 4: ConfigMap Issues

**Symptom:**
```
Error: couldn't find key API_KEY in ConfigMap broken-app/app-config
```

**Fix:**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: broken-app
data:
  DATABASE_URL: "postgresql://db:5432/mydb"
  API_KEY: "default-api-key"  # Provide value
```

### Fixed Deployment

```yaml
# fixed-deployment.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: broken-app
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: broken-app
data:
  DATABASE_URL: "postgresql://localhost:5432/mydb"
  API_KEY: "demo-api-key-12345"
  LOG_LEVEL: "info"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fixed-app
  namespace: broken-app
  labels:
    app: fixed-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: fixed-app
  template:
    metadata:
      labels:
        app: fixed-app
    spec:
      containers:
      - name: app
        image: nginx:1.25-alpine  # Valid image
        ports:
        - containerPort: 80
          name: http

        envFrom:
        - configMapRef:
            name: app-config

        resources:
          requests:
            memory: "64Mi"
            cpu: "50m"
          limits:
            memory: "128Mi"
            cpu: "100m"

        livenessProbe:
          httpGet:
            path: /
            port: 80  # Correct port
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 3
          failureThreshold: 3

        readinessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: fixed-app
  namespace: broken-app
spec:
  selector:
    app: fixed-app
  ports:
  - port: 80
    targetPort: 80
  type: ClusterIP
```

## Explanation

### Debugging Toolkit

#### Essential Commands

```bash
# Pod information
kubectl get pods -n <namespace>
kubectl describe pod <pod-name> -n <namespace>
kubectl logs <pod-name> -n <namespace>
kubectl logs <pod-name> -n <namespace> --previous

# Events
kubectl get events -n <namespace> --sort-by='.lastTimestamp'

# Execution
kubectl exec -it <pod-name> -n <namespace> -- /bin/sh

# Port forwarding (for testing)
kubectl port-forward <pod-name> -n <namespace> 8080:80

# Resource usage
kubectl top pod -n <namespace>
kubectl top node

# Detailed YAML
kubectl get pod <pod-name> -n <namespace> -o yaml

# Delete pod (will recreate if part of deployment)
kubectl delete pod <pod-name> -n <namespace>
```

### Common Pod States

| State | Meaning | Common Causes |
|-------|---------|---------------|
| `Pending` | Waiting to be scheduled | No resources, node selector mismatch |
| `ContainerCreating` | Creating container | Pulling image, mounting volumes |
| `Running` | Container is running | Normal state |
| `CrashLoopBackOff` | Container crashes repeatedly | App error, wrong command, probe failure |
| `ImagePullBackOff` | Can't pull image | Wrong image name/tag, auth issues |
| `Error` | Container exited with error | Application crash |
| `Completed` | Container finished successfully | Job/batch workload |
| `Terminated` | Container was terminated | Killed by user or system |

### Debugging Decision Tree

```
Pod not running?
├─ ImagePullBackOff?
│  ├─ Check image name/tag
│  └─ Check imagePullSecrets
├─ CrashLoopBackOff?
│  ├─ Check logs: kubectl logs pod --previous
│  ├─ Check startup command
│  └─ Check liveness probe
├─ Pending?
│  ├─ Check resources: kubectl describe pod
│  ├─ Check node selector
│  └─ Check PVC binding
└─ Running but not working?
   ├─ Check readiness probe
   ├─ Check service selector
   └─ Check network policies
```

## Result

### Apply Fixed Deployment

```bash
# Delete broken deployment
kubectl delete -f broken-deployment.yaml

# Apply fixed version
kubectl apply -f fixed-deployment.yaml

# Watch pods come up
kubectl get pods -n broken-app -w

# Output:
# NAME                         READY   STATUS    RESTARTS   AGE
# fixed-app-5d7f8c9b4d-abc12   1/1     Running   0          15s
# fixed-app-5d7f8c9b4d-def34   1/1     Running   0          15s
```

### Verify Fix

```bash
# Check pod status
kubectl get pods -n broken-app
# All should show Running and Ready 1/1

# Check logs
kubectl logs -l app=fixed-app -n broken-app
# Should show normal startup logs

# Test the app
kubectl port-forward -n broken-app svc/fixed-app 8080:80
curl http://localhost:8080
# Should return nginx welcome page

# Check resource usage
kubectl top pod -n broken-app
# Should show reasonable CPU/memory usage
```

## Validation

### Complete Debugging Checklist

```bash
# 1. Pod is running
kubectl get pod -n broken-app -l app=fixed-app
# STATUS should be "Running"

# 2. No recent restarts
kubectl get pod -n broken-app -l app=fixed-app
# RESTARTS should be 0 or very low

# 3. All containers ready
kubectl get pod -n broken-app -l app=fixed-app
# READY should be 1/1 (or X/X for multi-container)

# 4. No error events
kubectl get events -n broken-app --field-selector type=Warning
# Should be empty or no recent warnings

# 5. Logs show healthy startup
kubectl logs -l app=fixed-app -n broken-app --tail=20
# Should show normal application logs

# 6. Probes passing
kubectl describe pod -n broken-app -l app=fixed-app | grep -A5 "Liveness\|Readiness"
# Should show successful probe results

# 7. Application responds
kubectl run test --rm -it --image=curlimages/curl -- curl http://fixed-app.broken-app.svc.cluster.local
# Should get successful response
```

## Advanced Debugging

### Debug with Ephemeral Containers

```bash
# Add debug container to running pod (K8s 1.23+)
kubectl debug -it broken-app-xxx -n broken-app --image=busybox --target=app

# Debug with different image
kubectl debug broken-app-xxx -n broken-app --image=ubuntu --share-processes
```

### Debug Node Issues

```bash
# Check node status
kubectl get nodes
kubectl describe node <node-name>

# SSH to node (if possible)
kubectl debug node/<node-name> -it --image=ubuntu
```

### Network Debugging

```bash
# Run network debug pod
kubectl run netdebug --rm -it --image=nicolaka/netshoot -- /bin/bash

# Inside pod, test connectivity
nslookup fixed-app.broken-app.svc.cluster.local
curl http://fixed-app.broken-app.svc.cluster.local
traceroute fixed-app.broken-app.svc.cluster.local
```

## Best Practices

### ✅ Do's

1. **Check logs first**: Most issues show up in logs
2. **Use describe**: Shows events and state
3. **Check resource usage**: OOMKilled is common
4. **Validate probes**: Wrong port is frequent issue
5. **Test locally first**: Catch issues before K8s
6. **Set proper timeouts**: Give apps time to start

### ❌ Don'ts

1. **Don't skip previous logs**: Crash info is there
2. **Don't ignore events**: They tell the story
3. **Don't guess**: Use systematic debugging
4. **Don't forget namespaces**: Easy to overlook
5. **Don't use :latest**: Hard to debug versions

## Links

- [Kubernetes Debugging](https://kubernetes.io/docs/tasks/debug/)
- [Debug Pods](https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/)
- [Debug Services](https://kubernetes.io/docs/tasks/debug/debug-application/debug-service/)
- [kubectl Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)
- [Troubleshooting Applications](https://kubernetes.io/docs/tasks/debug/debug-application/)

## Share Your Success

Fixed your broken pod? Share the detective work!

**Tag [@thedevopsdaily](https://x.com/thedevopsdaily)** on X with:
- What was broken
- How you diagnosed it
- The fix you applied
- Screenshot of healthy pods

Use hashtags: **#AdventOfDevOps #Kubernetes #Debugging #Day9**
