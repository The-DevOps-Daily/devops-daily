---
title: 'Day 16 - Autoscaling'
day: 16
excerpt: 'Configure horizontal pod autoscaling in Kubernetes to automatically scale applications based on CPU and memory usage.'
description: 'Implement Kubernetes Horizontal Pod Autoscaler (HPA) and learn metrics-based scaling for efficient resource utilization and high availability.'
publishedAt: '2025-12-16T00:00:00Z'
updatedAt: '2026-04-19T00:00:00Z'
difficulty: 'Intermediate'
category: 'Kubernetes'
tags:
  - Kubernetes
  - Autoscaling
  - HPA
  - Performance
---

## Description

Your application experiences variable load throughout the day. During peak hours, pods are overwhelmed. During off-hours, you're wasting resources. Configure autoscaling to automatically adjust pod count based on demand.

## Task

Configure Horizontal Pod Autoscaler for a Kubernetes application.

**Requirements:**
- Set up metrics server
- Configure HPA based on CPU usage
- Add custom metrics scaling
- Test scaling behavior
- Monitor scaling events

## Target

- ✅ HPA configured and active
- ✅ Pods scale up under load
- ✅ Pods scale down when idle
- ✅ Metrics server running
- ✅ Scaling thresholds optimized

## Sample App

### Application with Load Generation

#### app.yaml

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: autoscale-demo
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
  namespace: autoscale-demo
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web-app
  template:
    metadata:
      labels:
        app: web-app
    spec:
      containers:
      - name: web
        image: nginx:alpine
        ports:
        - containerPort: 80
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 200m
            memory: 256Mi
---
apiVersion: v1
kind: Service
metadata:
  name: web-app
  namespace: autoscale-demo
spec:
  selector:
    app: web-app
  ports:
  - port: 80
    targetPort: 80
  type: ClusterIP
```

## Solution

### 1. Install Metrics Server

```bash
# Install metrics server (if not already installed)
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# For local clusters (Minikube, Kind), you may need to disable TLS verification
kubectl patch deployment metrics-server \
  -n kube-system \
  --type='json' \
  -p='[{"op": "add", "path": "/spec/template/spec/containers/0/args/-", "value": "--kubelet-insecure-tls"}]'

# Verify metrics server is running
kubectl get deployment metrics-server -n kube-system

# Wait for metrics to be available
kubectl top nodes
kubectl top pods -A
```

### 2. Configure HPA - CPU Based

```yaml
# hpa-cpu.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web-app-hpa
  namespace: autoscale-demo
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-app
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 50  # Target 50% CPU
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300  # Wait 5 min before scaling down
      policies:
      - type: Percent
        value: 50  # Scale down max 50% of pods at a time
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0  # Scale up immediately
      policies:
      - type: Percent
        value: 100  # Double pods if needed
        periodSeconds: 60
      - type: Pods
        value: 4  # Or add max 4 pods at a time
        periodSeconds: 60
      selectPolicy: Max  # Use policy that scales fastest
```

### 3. Configure HPA - Memory Based

```yaml
# hpa-memory.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web-app-memory-hpa
  namespace: autoscale-demo
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-app
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 70  # Target 70% memory
```

### 4. Configure HPA - Multi-Metric

```yaml
# hpa-multi.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web-app-multi-hpa
  namespace: autoscale-demo
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-app
  minReplicas: 2
  maxReplicas: 10
  metrics:
  # CPU metric
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 50
  # Memory metric
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 70
  # Pods metric (requests per second per pod)
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "1000"
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Pods
        value: 1
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 50
        periodSeconds: 30
```

### 5. Application with Custom Metrics

```javascript
// app-with-metrics.js
const express = require('express');
const promClient = require('prom-client');

const app = express();
const port = 3000;

// Prometheus metrics
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'status']
});

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'path']
});

register.registerMetric(httpRequestsTotal);
register.registerMetric(httpRequestDuration);

// Middleware to track metrics
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration.labels(req.method, req.path).observe(duration);
    httpRequestsTotal.labels(req.method, req.path, res.statusCode).inc();
  });

  next();
});

// Routes
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// CPU-intensive endpoint
app.get('/cpu', (req, res) => {
  const iterations = 1000000;
  let result = 0;
  for (let i = 0; i < iterations; i++) {
    result += Math.sqrt(i);
  }
  res.json({ result });
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
```

### 6. Load Testing

```yaml
# load-generator.yaml
apiVersion: v1
kind: Pod
metadata:
  name: load-generator
  namespace: autoscale-demo
spec:
  containers:
  - name: load
    image: busybox
    command:
    - /bin/sh
    - -c
    - |
      while true; do
        wget -q -O- http://web-app.autoscale-demo.svc.cluster.local
        sleep 0.01
      done
```

```bash
# Or use Apache Bench
kubectl run -it --rm load-generator \
  --image=httpd:alpine \
  --restart=Never \
  --namespace=autoscale-demo \
  -- ab -n 100000 -c 100 http://web-app.autoscale-demo.svc.cluster.local/
```

## Explanation

### How HPA Works

#### 1. Metrics Collection

```
Metrics Server → API Server → HPA Controller
                                    ↓
                          Calculates desired replicas
                                    ↓
                            Updates Deployment
```

#### 2. Scaling Algorithm

```
desiredReplicas = ceil[currentReplicas * (currentMetricValue / desiredMetricValue)]
```

**Example:**
- Current: 2 replicas, 80% CPU usage
- Target: 50% CPU
- Desired: ceil[2 * (80 / 50)] = ceil[3.2] = 4 replicas

#### 3. Scaling Behavior

**Scale Up:**
- Immediate (or custom stabilization window)
- Can add multiple pods at once
- Aggressive to handle load spikes

**Scale Down:**
- Delayed (default 5 minutes)
- Gradual (prevents flapping)
- Conservative to maintain stability

### Key Concepts

#### Resource Requests

**Critical for HPA:**
```yaml
resources:
  requests:
    cpu: 100m      # HPA uses this as 100%
    memory: 128Mi
```

HPA calculates percentage based on requests, not limits.

#### Scaling Policies

```yaml
behavior:
  scaleUp:
    policies:
    - type: Percent    # Scale by percentage
      value: 100
    - type: Pods       # Or by pod count
      value: 4
    selectPolicy: Max  # Use fastest scaling
```

#### Cooldown Periods

```yaml
stabilizationWindowSeconds: 300  # Wait 5 min before scaling
```

Prevents rapid scaling (flapping).

## Result

### Deploy and Test

```bash
# Deploy application
kubectl apply -f app.yaml

# Deploy HPA
kubectl apply -f hpa-cpu.yaml

# Verify HPA
kubectl get hpa -n autoscale-demo

# Output:
# NAME          REFERENCE            TARGETS   MINPODS   MAXPODS   REPLICAS
# web-app-hpa   Deployment/web-app   0%/50%    2         10        2

# Watch HPA in real-time
kubectl get hpa -n autoscale-demo --watch
```

### Generate Load

```bash
# Deploy load generator
kubectl apply -f load-generator.yaml

# Watch scaling happen
kubectl get hpa -n autoscale-demo --watch

# After load starts:
# NAME          REFERENCE            TARGETS    MINPODS   MAXPODS   REPLICAS
# web-app-hpa   Deployment/web-app   85%/50%    2         10        2
# web-app-hpa   Deployment/web-app   85%/50%    2         10        4
# web-app-hpa   Deployment/web-app   65%/50%    2         10        4
# web-app-hpa   Deployment/web-app   48%/50%    2         10        4

# Watch pods scaling
kubectl get pods -n autoscale-demo --watch

# Check deployment replicas
kubectl get deployment web-app -n autoscale-demo
```

### Monitor Scaling Events

```bash
# View HPA events
kubectl describe hpa web-app-hpa -n autoscale-demo

# Events:
# Type    Reason             Age   Message
# ----    ------             ----  -------
# Normal  SuccessfulRescale  2m    New size: 4; reason: cpu resource utilization above target

# View HPA details
kubectl get hpa web-app-hpa -n autoscale-demo -o yaml

# Check metrics
kubectl top pods -n autoscale-demo
```

### Stop Load and Watch Scale Down

```bash
# Delete load generator
kubectl delete pod load-generator -n autoscale-demo

# Watch scale down (takes ~5 minutes)
kubectl get hpa -n autoscale-demo --watch

# After 5+ minutes:
# NAME          REFERENCE            TARGETS   MINPODS   MAXPODS   REPLICAS
# web-app-hpa   Deployment/web-app   48%/50%   2         10        4
# web-app-hpa   Deployment/web-app   12%/50%   2         10        4
# web-app-hpa   Deployment/web-app   5%/50%    2         10        3
# web-app-hpa   Deployment/web-app   3%/50%    2         10        2
```

## Validation

### Testing Checklist

```bash
# 1. Metrics server running
kubectl get deployment metrics-server -n kube-system
# Should be available

# 2. Metrics available
kubectl top nodes
kubectl top pods -n autoscale-demo
# Should show CPU/memory usage

# 3. HPA active
kubectl get hpa -n autoscale-demo
# Should show current/target metrics

# 4. Resource requests set
kubectl get deployment web-app -n autoscale-demo -o yaml | grep -A 4 "resources:"
# Should show requests defined

# 5. Scaling works
# Generate load, verify replicas increase
kubectl get deployment web-app -n autoscale-demo -o jsonpath='{.spec.replicas}'
# Should be > minReplicas when under load

# 6. Scale down works
# Remove load, wait 5+ minutes
# Replicas should return to minReplicas
```

## Advanced Configuration

### Custom Metrics with Prometheus

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: custom-metrics-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-app
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "1000"
```

### External Metrics

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: external-metrics-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-app
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: External
    external:
      metric:
        name: queue_depth
        selector:
          matchLabels:
            queue: "orders"
      target:
        type: AverageValue
        averageValue: "30"
```

### Vertical Pod Autoscaler

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: web-app-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-app
  updatePolicy:
    updateMode: "Auto"  # Or "Off" for recommendations only
```

## Best Practices

### ✅ Do's

1. **Set resource requests**: Required for HPA
2. **Use stabilization windows**: Prevent flapping
3. **Monitor scaling events**: Understand behavior
4. **Test scaling**: Verify it works
5. **Set appropriate min/max**: Based on capacity
6. **Use multiple metrics**: More accurate scaling

### ❌ Don'ts

1. **Don't forget requests**: HPA needs them
2. **Don't scale too quickly**: Causes instability
3. **Don't use tiny targets**: CPU spikes are normal
4. **Don't ignore costs**: More pods = more money
5. **Don't skip testing**: Validate before production

## Links

- [Horizontal Pod Autoscaler](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
- [Metrics Server](https://github.com/kubernetes-sigs/metrics-server)
- [HPA Walkthrough](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale-walkthrough/)
- [Custom Metrics](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/#support-for-custom-metrics)
- [VPA](https://github.com/kubernetes/autoscaler/tree/master/vertical-pod-autoscaler)

## Share Your Success

Configured autoscaling? Share your results!

**Tag [@thedevopsdaily](https://x.com/thedevopsdaily)** on X with:
- Min/max replica counts
- Scaling metrics used
- Load test results
- Time to scale up/down

Use hashtags: **#AdventOfDevOps #Kubernetes #Autoscaling #Day16**
