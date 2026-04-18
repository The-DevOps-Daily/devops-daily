---
title: 'Day 22 - Run a Local Cluster'
day: 22
excerpt: 'Set up a local Kubernetes cluster with Minikube or Kind for development and testing without cloud costs.'
description: 'Learn to run local Kubernetes clusters using Minikube, Kind, or k3d for fast development, testing, and learning.'
publishedAt: '2026-12-22T00:00:00Z'
updatedAt: '2026-12-22T00:00:00Z'
difficulty: 'Beginner'
category: 'Kubernetes'
tags:
  - Kubernetes
  - Local Development
  - Minikube
  - Kind
---

## Description

Cloud Kubernetes clusters cost money and are slower for development. Set up a local cluster on your machine for fast, free Kubernetes development and testing.

## Task

Set up a local Kubernetes cluster for development.

**Requirements:**
- Install local Kubernetes tool (Minikube/Kind/k3d)
- Create a functional cluster
- Deploy test application
- Configure local development workflow
- Set up ingress controller

## Target

- ✅ Local cluster running
- ✅ kubectl configured
- ✅ Application deployed and accessible
- ✅ Ingress controller working
- ✅ Fast development iteration

## Sample App

### Test Application

```yaml
# test-app.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: demo
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hello
  namespace: demo
spec:
  replicas: 2
  selector:
    matchLabels:
      app: hello
  template:
    metadata:
      labels:
        app: hello
    spec:
      containers:
      - name: hello
        image: gcr.io/google-samples/hello-app:1.0
        ports:
        - containerPort: 8080
---
apiVersion: v1
kind: Service
metadata:
  name: hello
  namespace: demo
spec:
  selector:
    app: hello
  ports:
  - port: 80
    targetPort: 8080
  type: ClusterIP
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: hello
  namespace: demo
spec:
  rules:
  - host: hello.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: hello
            port:
              number: 80
```

## Solution

### 1. Minikube Setup

```bash
# Install Minikube (macOS)
brew install minikube

# Install Minikube (Linux)
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube

# Start cluster
minikube start \
  --cpus=4 \
  --memory=8192 \
  --disk-size=50g \
  --driver=docker

# Enable addons
minikube addons enable ingress
minikube addons enable metrics-server
minikube addons enable dashboard

# Verify cluster
kubectl cluster-info
kubectl get nodes

# Open dashboard
minikube dashboard
```

### 2. Kind (Kubernetes in Docker) Setup

```bash
# Install Kind (macOS)
brew install kind

# Install Kind (Linux)
curl -Lo ./kind https://kind.sigs.k8s.io/dl/latest/kind-linux-amd64
chmod +x ./kind
sudo mv ./kind /usr/local/bin/kind

# Create cluster configuration
cat <<EOF > kind-config.yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  kubeadmConfigPatches:
  - |
    kind: InitConfiguration
    nodeRegistration:
      kubeletExtraArgs:
        node-labels: "ingress-ready=true"
  extraPortMappings:
  - containerPort: 80
    hostPort: 80
    protocol: TCP
  - containerPort: 443
    hostPort: 443
    protocol: TCP
- role: worker
- role: worker
EOF

# Create cluster
kind create cluster --config kind-config.yaml --name dev-cluster

# Verify
kubectl cluster-info --context kind-dev-cluster

# Install ingress controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

# Wait for ingress to be ready
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=90s
```

### 3. k3d Setup

```bash
# Install k3d (macOS/Linux)
curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash

# Create cluster
k3d cluster create dev \
  --agents 2 \
  --port "8080:80@loadbalancer" \
  --port "8443:443@loadbalancer" \
  --api-port 6443

# Verify
kubectl cluster-info

# List clusters
k3d cluster list
```

### 4. Local Development Workflow

#### Skaffold Configuration

```yaml
# skaffold.yaml
apiVersion: skaffold/v4beta6
kind: Config
metadata:
  name: local-dev

build:
  artifacts:
  - image: myapp
    docker:
      dockerfile: Dockerfile
    sync:
      manual:
      - src: "src/**/*.js"
        dest: /app/src

deploy:
  kubectl:
    manifests:
    - k8s/*.yaml

portForward:
- resourceType: service
  resourceName: myapp
  namespace: demo
  port: 80
  localPort: 3000

profiles:
- name: debug
  activation:
  - command: debug
  patches:
  - op: add
    path: /build/artifacts/0/docker/buildArgs
    value:
      NODE_ENV: development
```

```bash
# Start development with Skaffold
skaffold dev

# Or with debugging
skaffold debug
```

#### Tilt Configuration

```python
# Tiltfile
# Build Docker image
docker_build('myapp', '.')

# Deploy to Kubernetes
k8s_yaml('k8s/deployment.yaml')

# Port forward
k8s_resource('myapp', port_forwards=3000)

# Live update
docker_build('myapp', '.',
  live_update=[
    sync('./src', '/app/src'),
    run('npm install', trigger=['package.json']),
  ]
)
```

```bash
# Start Tilt
tilt up
```

### 5. Local Registry

#### For Kind

```bash
# Create registry
docker run -d -p 5000:5000 --restart=always --name registry registry:2

# Connect registry to Kind network
docker network connect kind registry

# Build and push
docker build -t localhost:5000/myapp:latest .
docker push localhost:5000/myapp:latest

# Use in Kubernetes
kubectl set image deployment/myapp myapp=localhost:5000/myapp:latest
```

#### For Minikube

```bash
# Use Minikube's Docker daemon
eval $(minikube docker-env)

# Build directly in Minikube
docker build -t myapp:latest .

# Use in deployment (no push needed)
kubectl set image deployment/myapp myapp=myapp:latest --record
```

### 6. Helper Scripts

#### start-cluster.sh

```bash
#!/bin/bash

set -euo pipefail

CLUSTER_NAME="${1:-dev}"
TOOL="${2:-kind}"

echo "Starting local Kubernetes cluster..."
echo "Tool: $TOOL"
echo "Name: $CLUSTER_NAME"

case $TOOL in
  minikube)
    minikube start \
      --profile=$CLUSTER_NAME \
      --cpus=4 \
      --memory=8192 \
      --kubernetes-version=v1.28.0

    minikube addons enable ingress -p $CLUSTER_NAME
    minikube addons enable metrics-server -p $CLUSTER_NAME
    ;;

  kind)
    kind create cluster \
      --name=$CLUSTER_NAME \
      --config=kind-config.yaml

    kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
    ;;

  k3d)
    k3d cluster create $CLUSTER_NAME \
      --agents 2 \
      --port "8080:80@loadbalancer"
    ;;

  *)
    echo "Unknown tool: $TOOL"
    echo "Usage: $0 <cluster-name> <minikube|kind|k3d>"
    exit 1
    ;;
esac

echo "✅ Cluster created successfully"
kubectl cluster-info
kubectl get nodes
```

#### stop-cluster.sh

```bash
#!/bin/bash

set -euo pipefail

CLUSTER_NAME="${1:-dev}"
TOOL="${2:-kind}"

echo "Stopping local Kubernetes cluster..."

case $TOOL in
  minikube)
    minikube stop -p $CLUSTER_NAME
    ;;
  kind)
    kind delete cluster --name=$CLUSTER_NAME
    ;;
  k3d)
    k3d cluster delete $CLUSTER_NAME
    ;;
  *)
    echo "Unknown tool: $TOOL"
    exit 1
    ;;
esac

echo "✅ Cluster stopped"
```

## Explanation

### Comparison of Local Kubernetes Tools

| Feature | Minikube | Kind | k3d |
|---------|----------|------|-----|
| **Speed** | Slow | Fast | Fastest |
| **Multi-node** | Yes | Yes | Yes |
| **Resource usage** | High | Medium | Low |
| **VM required** | Optional | No | No |
| **Addons** | Many | None | Some |
| **Best for** | Learning | CI/CD | Development |

### How They Work

**Minikube:**
```
Minikube → VM (or Docker) → Single-node Kubernetes
```

**Kind:**
```
Kind → Docker containers as nodes → Multi-node Kubernetes
```

**k3d:**
```
k3d → k3s in Docker → Lightweight Kubernetes
```

### Local Development Pattern

```
1. Code change → 2. Build image → 3. Push to cluster → 4. Restart pods → 5. Test
```

With live reload:
```
1. Code change → 2. Sync to pod → 3. Auto-restart → 4. Test (faster!)
```

## Result

### Start Cluster and Deploy

```bash
# Start Kind cluster
kind create cluster --name dev

# Verify
kubectl get nodes
# NAME                STATUS   ROLES           AGE   VERSION
# dev-control-plane   Ready    control-plane   1m    v1.28.0

# Deploy application
kubectl apply -f test-app.yaml

# Wait for deployment
kubectl wait --for=condition=available --timeout=60s deployment/hello -n demo

# Check pods
kubectl get pods -n demo
# NAME                     READY   STATUS    RESTARTS   AGE
# hello-5d7f8c9b4d-abc12   1/1     Running   0          30s
# hello-5d7f8c9b4d-def34   1/1     Running   0          30s

# Port forward to access
kubectl port-forward -n demo svc/hello 8080:80

# Test
curl http://localhost:8080
# Hello, world!
# Version: 1.0.0
```

### Use with Ingress

```bash
# Add to /etc/hosts
echo "127.0.0.1 hello.local" | sudo tee -a /etc/hosts

# Access via ingress (Minikube)
minikube tunnel  # Run in separate terminal
curl http://hello.local

# Access via ingress (Kind)
curl http://hello.local
```

## Validation

### Cluster Health Check

```bash
# 1. Cluster running
kubectl cluster-info
# Should show cluster endpoint

# 2. Nodes ready
kubectl get nodes
# All should be Ready

# 3. Core services running
kubectl get pods -n kube-system
# All should be Running

# 4. Can deploy apps
kubectl run test --image=nginx --port=80
kubectl wait --for=condition=ready pod/test
# Should succeed

# 5. Networking works
kubectl exec test -- curl http://kubernetes.default.svc.cluster.local
# Should connect

# 6. DNS works
kubectl run dnstest --image=busybox --command -- sleep 3600
kubectl exec dnstest -- nslookup kubernetes.default
# Should resolve

# Cleanup
kubectl delete pod test dnstest
```

## Best Practices

### ✅ Do's

1. **Allocate enough resources**: 4GB RAM minimum
2. **Use local registry**: Faster image loading
3. **Enable ingress**: Test routing locally
4. **Use namespace**: Organize resources
5. **Regular cleanup**: Delete unused resources
6. **Version pin**: Match production K8s version

### ❌ Don'ts

1. **Don't use for production**: Local only
2. **Don't skip cleanup**: Resources accumulate
3. **Don't ignore resource limits**: Set limits
4. **Don't test scale**: Not representative
5. **Don't expose publicly**: Security risk

## Links

- [Minikube](https://minikube.sigs.k8s.io/)
- [Kind](https://kind.sigs.k8s.io/)
- [k3d](https://k3d.io/)
- [Skaffold](https://skaffold.dev/)
- [Tilt](https://tilt.dev/)

## Share Your Success

Set up local cluster? Share it!

**Tag [@thedevopsdaily](https://x.com/thedevopsdaily)** on X with:
- Tool you chose (Minikube/Kind/k3d)
- Cluster specs
- What you're building
- Development workflow improvements

Use hashtags: **#AdventOfDevOps #Kubernetes #LocalDev #Day22**
