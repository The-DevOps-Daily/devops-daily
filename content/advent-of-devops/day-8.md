---
title: 'Day 8 - Deploy a Small App on Kubernetes'
day: 8
excerpt: 'Deploy your first application to Kubernetes using Deployments, Services, and ConfigMaps. Learn the fundamentals of K8s.'
description: 'Master Kubernetes basics by deploying a containerized application with proper configuration, service discovery, and health checks.'
publishedAt: '2026-12-08T00:00:00Z'
updatedAt: '2026-12-08T00:00:00Z'
difficulty: 'Intermediate'
category: 'Kubernetes'
tags:
  - Kubernetes
  - Deployment
  - Services
  - Containers
---

## Description

You have a containerized application that runs perfectly with Docker, but you need to deploy it to Kubernetes for better scalability, self-healing, and orchestration. Time to learn the Kubernetes basics.

## Task

Deploy a Node.js application to Kubernetes with proper configuration.

**Requirements:**
- Create Kubernetes Deployment
- Expose application via Service
- Configure environment variables with ConfigMap
- Add health checks (liveness and readiness probes)
- Verify application is running and accessible

## Target

- ✅ Application deployed to Kubernetes
- ✅ Service routes traffic to pods
- ✅ Health checks working
- ✅ Application accessible via LoadBalancer or NodePort
- ✅ Multiple replicas running

## Sample App

### Application Code

#### app.js

```javascript
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const appName = process.env.APP_NAME || 'MyApp';
const version = process.env.VERSION || '1.0.0';

let healthy = true;
let ready = true;

// Simulate startup time
setTimeout(() => {
  ready = true;
  console.log('Application is ready!');
}, 5000);

app.get('/', (req, res) => {
  res.json({
    app: appName,
    version: version,
    hostname: require('os').hostname(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  if (healthy) {
    res.status(200).json({ status: 'healthy' });
  } else {
    res.status(503).json({ status: 'unhealthy' });
  }
});

app.get('/ready', (req, res) => {
  if (ready) {
    res.status(200).json({ status: 'ready' });
  } else {
    res.status(503).json({ status: 'not ready' });
  }
});

// Endpoint to toggle health (for testing)
app.post('/health/toggle', (req, res) => {
  healthy = !healthy;
  res.json({ healthy });
});

app.listen(port, () => {
  console.log(`${appName} v${version} listening on port ${port}`);
});
```

#### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

USER node

CMD ["node", "app.js"]
```

#### package.json

```json
{
  "name": "k8s-demo-app",
  "version": "1.0.0",
  "main": "app.js",
  "scripts": {
    "start": "node app.js"
  },
  "dependencies": {
    "express": "^4.18.0"
  }
}
```

## Solution

### Kubernetes Manifests

#### 1. Namespace

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: demo-app
  labels:
    name: demo-app
    environment: development
```

#### 2. ConfigMap

```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: demo-app
data:
  APP_NAME: "Advent Demo App"
  VERSION: "1.0.0"
  PORT: "3000"
  LOG_LEVEL: "info"
  NODE_ENV: "production"
```

#### 3. Deployment

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: demo-app
  namespace: demo-app
  labels:
    app: demo-app
    version: v1
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: demo-app
  template:
    metadata:
      labels:
        app: demo-app
        version: v1
    spec:
      containers:
      - name: app
        image: your-registry/demo-app:1.0.0
        imagePullPolicy: Always
        ports:
        - containerPort: 3000
          name: http
          protocol: TCP

        envFrom:
        - configMapRef:
            name: app-config

        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 200m
            memory: 256Mi

        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 3
          failureThreshold: 3

        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3

        lifecycle:
          preStop:
            exec:
              command: ["/bin/sh", "-c", "sleep 15"]
```

#### 4. Service

```yaml
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: demo-app
  namespace: demo-app
  labels:
    app: demo-app
spec:
  type: LoadBalancer  # Use NodePort for local clusters
  selector:
    app: demo-app
  ports:
  - name: http
    port: 80
    targetPort: 3000
    protocol: TCP
  sessionAffinity: None
```

#### 5. All-in-One (Optional)

```yaml
# all-in-one.yaml
---
apiVersion: v1
kind: Namespace
metadata:
  name: demo-app
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: demo-app
data:
  APP_NAME: "Advent Demo App"
  VERSION: "1.0.0"
  PORT: "3000"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: demo-app
  namespace: demo-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: demo-app
  template:
    metadata:
      labels:
        app: demo-app
    spec:
      containers:
      - name: app
        image: your-registry/demo-app:1.0.0
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: app-config
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: demo-app
  namespace: demo-app
spec:
  type: LoadBalancer
  selector:
    app: demo-app
  ports:
  - port: 80
    targetPort: 3000
```

## Explanation

### Key Kubernetes Concepts

#### 1. Deployment

**Purpose:** Manages pod lifecycle

```yaml
spec:
  replicas: 3  # Number of pod copies
  strategy:
    type: RollingUpdate  # Update strategy
```

**Benefits:**
- Self-healing (replaces failed pods)
- Scaling (adjust replicas)
- Rolling updates (zero-downtime deployments)

#### 2. Service

**Purpose:** Stable network endpoint

```yaml
spec:
  type: LoadBalancer  # External access
  selector:
    app: demo-app  # Routes to matching pods
```

**Service Types:**
- `ClusterIP`: Internal only (default)
- `NodePort`: Accessible via node IP
- `LoadBalancer`: Cloud load balancer

#### 3. ConfigMap

**Purpose:** Configuration management

```yaml
envFrom:
- configMapRef:
    name: app-config
```

Separates config from code.

#### 4. Health Checks

**Liveness Probe:** Is the app alive?
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
```
Restarts pod if failing.

**Readiness Probe:** Ready for traffic?
```yaml
readinessProbe:
  httpGet:
    path: /ready
    port: 3000
```
Removes from service if not ready.

#### 5. Resource Management

```yaml
resources:
  requests:    # Minimum needed
    cpu: 100m
    memory: 128Mi
  limits:      # Maximum allowed
    cpu: 200m
    memory: 256Mi
```

Ensures fair resource allocation.

## Result

### Build and Push Image

```bash
# Build the Docker image
docker build -t your-registry/demo-app:1.0.0 .

# Push to registry
docker push your-registry/demo-app:1.0.0

# Or use local registry (Minikube)
eval $(minikube docker-env)
docker build -t demo-app:1.0.0 .
```

### Deploy to Kubernetes

```bash
# Apply all manifests
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml

# Or apply all at once
kubectl apply -f all-in-one.yaml

# Watch rollout
kubectl rollout status deployment/demo-app -n demo-app
# deployment "demo-app" successfully rolled out
```

### Verify Deployment

```bash
# Check pods
kubectl get pods -n demo-app
# NAME                        READY   STATUS    RESTARTS   AGE
# demo-app-5d7f8c9b4d-abc12   1/1     Running   0          30s
# demo-app-5d7f8c9b4d-def34   1/1     Running   0          30s
# demo-app-5d7f8c9b4d-ghi56   1/1     Running   0          30s

# Check service
kubectl get svc -n demo-app
# NAME       TYPE           EXTERNAL-IP   PORT(S)        AGE
# demo-app   LoadBalancer   <pending>     80:30123/TCP   1m

# Get service details
kubectl describe svc demo-app -n demo-app

# For Minikube, get URL
minikube service demo-app -n demo-app --url
# http://192.168.49.2:30123
```

### Test Application

```bash
# Get the service URL
SERVICE_URL=$(minikube service demo-app -n demo-app --url)

# Test the app
curl $SERVICE_URL
# {
#   "app": "Advent Demo App",
#   "version": "1.0.0",
#   "hostname": "demo-app-5d7f8c9b4d-abc12",
#   "uptime": 42.5,
#   "timestamp": "2025-12-08T12:00:00.000Z"
# }

# Test health endpoint
curl $SERVICE_URL/health
# {"status":"healthy"}

# Test readiness
curl $SERVICE_URL/ready
# {"status":"ready"}
```

## Validation

### Health Check Validation

```bash
# Check pod health status
kubectl get pods -n demo-app -o wide
# Should show all pods Running and Ready 1/1

# View pod events
kubectl describe pod demo-app-xxx -n demo-app
# Should show successful Liveness and Readiness probes

# Test probe failure
POD=$(kubectl get pod -n demo-app -l app=demo-app -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n demo-app $POD -- curl -X POST localhost:3000/health/toggle

# Watch pod restart
kubectl get pods -n demo-app -w
```

### Load Balancing Test

```bash
# Make multiple requests
for i in {1..10}; do
  curl -s $SERVICE_URL | jq -r .hostname
done

# Should show different pod hostnames (load balancing working)
```

### Scaling Test

```bash
# Scale up
kubectl scale deployment demo-app -n demo-app --replicas=5

# Watch scaling
kubectl get pods -n demo-app -w

# Scale down
kubectl scale deployment demo-app -n demo-app --replicas=2
```

## Advanced Features

### Horizontal Pod Autoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: demo-app
  namespace: demo-app
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: demo-app
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### Ingress (for HTTP routing)

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: demo-app
  namespace: demo-app
  annotations:
    kubernetes.io/ingress.class: nginx
spec:
  rules:
  - host: demo.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: demo-app
            port:
              number: 80
```

## Best Practices

### ✅ Do's

1. **Use namespaces**: Organize resources
2. **Set resource limits**: Prevent resource hogging
3. **Add health checks**: Enable self-healing
4. **Use ConfigMaps**: Externalize configuration
5. **Label everything**: Enable selection and filtering
6. **Use rolling updates**: Zero-downtime deployments

### ❌ Don'ts

1. **Don't run as root**: Security risk
2. **Don't use :latest tag**: Unpredictable updates
3. **Don't skip health checks**: Miss failures
4. **Don't hardcode config**: Use ConfigMaps
5. **Don't forget resource limits**: Risk cluster stability

## Links

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Kubernetes Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Kubernetes Services](https://kubernetes.io/docs/concepts/services-networking/service/)
- [Configure Liveness/Readiness Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
- [Minikube](https://minikube.sigs.k8s.io/)

## Share Your Success

Deployed your first app to Kubernetes? Celebrate!

**Tag [@thedevopsdaily](https://x.com/thedevopsdaily)** on X with:
- Screenshot of running pods
- Application URL/response
- Number of replicas
- What you learned

Use hashtags: **#AdventOfDevOps #Kubernetes #CloudNative #Day8**
