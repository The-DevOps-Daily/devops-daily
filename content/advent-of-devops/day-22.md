---
title: 'Day 22 - Run a Local Cluster'
day: 22
excerpt: 'Set up a local Kubernetes cluster with Minikube or Kind for development and testing without cloud costs.'
description: 'Learn to run local Kubernetes clusters using Minikube, Kind, or k3d for fast development, testing, and learning.'
publishedAt: '2025-12-22T00:00:00Z'
updatedAt: '2026-10-18T00:00:00Z'
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
- Route traffic to the app with the Gateway API

## Target

- ✅ Local cluster running
- ✅ kubectl configured
- ✅ Application deployed and accessible
- ✅ Gateway routing `hello.local` to the app
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
# A Gateway is the entry point. The controller you install in the
# solution creates an NGINX proxy for it.
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: hello-gateway
  namespace: demo
spec:
  gatewayClassName: nginx
  listeners:
  - name: http
    protocol: HTTP
    port: 80
---
# The HTTPRoute sends requests for hello.local to the hello Service.
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: hello
  namespace: demo
spec:
  parentRefs:
  - name: hello-gateway
    sectionName: http
  hostnames:
  - hello.local
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /
    backendRefs:
    - name: hello
      port: 80
```

> **Why not Ingress?** Ingress NGINX was retired in March 2026 and gets no more security fixes. The [Gateway API](https://gateway-api.sigs.k8s.io/) is the newer Kubernetes routing API that succeeds Ingress: a `Gateway` owns the listener, and `HTTPRoute`s attach to it. The `Gateway` and `HTTPRoute` kinds only exist after you install the Gateway API CRDs in the solution.

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

# Enable addons (the Gateway controller is installed in step 4)
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
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.33.0/kind-linux-amd64
chmod +x ./kind
sudo mv ./kind /usr/local/bin/kind

# Create cluster configuration
# Port 80 on your machine goes to NodePort 30080 on the control-plane node,
# where the Gateway's NGINX proxy listens (see step 4).
cat <<EOF > kind-config.yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  extraPortMappings:
  - containerPort: 30080
    hostPort: 80
    protocol: TCP
- role: worker
- role: worker
EOF

# Create cluster
kind create cluster --config kind-config.yaml --name dev-cluster

# Verify
kubectl cluster-info --context kind-dev-cluster
```

### 3. k3d Setup

```bash
# Install k3d (macOS/Linux)
curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash

# Create cluster
# k3s ships Traefik, which would also claim port 80. Turn it off so the
# Gateway's proxy gets port 80 behind k3d's load balancer.
k3d cluster create dev \
  --agents 2 \
  --port "8080:80@loadbalancer" \
  --port "8443:443@loadbalancer" \
  --api-port 6443 \
  --k3s-arg "--disable=traefik@server:*"

# Verify
kubectl cluster-info

# List clusters
k3d cluster list
```

### 4. Gateway API Controller

This lab uses [NGINX Gateway Fabric](https://docs.nginx.com/nginx-gateway-fabric/) 2.8.0. It supports Kubernetes 1.32 and later, including the v1.37 node image that kind v0.33 uses, and it implements Gateway API v1.6.3.

```bash
# 1. Install the Gateway API CRDs (standard channel, the version this release supports)
kubectl kustomize "https://github.com/nginx/nginx-gateway-fabric/config/crd/gateway-api/standard?ref=v2.8.0" \
  | kubectl apply -f -
```

The controller creates one NGINX proxy (a Deployment and a Service) for each Gateway. How that Service is exposed depends on your cluster.

```bash
# 2a. kind: expose the proxy on NodePort 30080, the port mapped to localhost:80.
# externalTrafficPolicy=Cluster lets the control-plane node forward to the
# proxy pod even when it runs on a worker.
helm install ngf oci://ghcr.io/nginx/charts/nginx-gateway-fabric \
  --version 2.8.0 \
  --namespace nginx-gateway \
  --create-namespace \
  --set nginx.service.type=NodePort \
  --set nginx.service.externalTrafficPolicy=Cluster \
  --set-json 'nginx.service.nodePorts=[{"port":30080,"listenerPort":80}]'

# 2b. Minikube or k3d: keep the default LoadBalancer Service.
# Minikube gives it an IP through `minikube tunnel`; k3d through its built-in
# load balancer, which can send traffic to any node.
helm install ngf oci://ghcr.io/nginx/charts/nginx-gateway-fabric \
  --version 2.8.0 \
  --namespace nginx-gateway \
  --create-namespace \
  --set nginx.service.externalTrafficPolicy=Cluster

# 3. Wait for the controller, then check the GatewayClass it created
kubectl wait --timeout=5m -n nginx-gateway \
  deployment/ngf-nginx-gateway-fabric --for=condition=Available
kubectl get gatewayclass nginx
# ACCEPTED should be True
```

After you apply `test-app.yaml`, the controller creates the proxy for `hello-gateway` as `hello-gateway-nginx` in the `demo` namespace:

```bash
kubectl get gateway,httproute -n demo
# The Gateway should show PROGRAMMED True

kubectl get svc hello-gateway-nginx -n demo
```

### 5. Local Development Workflow

#### Skaffold Configuration

```yaml
# skaffold.yaml
apiVersion: skaffold/v4beta14
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

manifests:
  rawYaml:
  - k8s/*.yaml

deploy:
  kubectl: {}

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

### 6. Local Registry

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
kubectl set image deployment/myapp myapp=myapp:latest
```

### 7. Helper Scripts

#### start-cluster.sh

```bash
#!/bin/bash

set -euo pipefail

CLUSTER_NAME="${1:-dev}"
TOOL="${2:-kind}"

NGF_VERSION="2.8.0"

echo "Starting local Kubernetes cluster..."
echo "Tool: $TOOL"
echo "Name: $CLUSTER_NAME"

case $TOOL in
  minikube)
    minikube start \
      --profile=$CLUSTER_NAME \
      --cpus=4 \
      --memory=8192 \
      --kubernetes-version=v1.37.0

    minikube addons enable metrics-server -p $CLUSTER_NAME
    GATEWAY_SERVICE_ARGS=()
    ;;

  kind)
    kind create cluster \
      --name=$CLUSTER_NAME \
      --config=kind-config.yaml

    # NodePort 30080 is mapped to localhost:80 in kind-config.yaml
    GATEWAY_SERVICE_ARGS=(
      --set nginx.service.type=NodePort
      --set-json 'nginx.service.nodePorts=[{"port":30080,"listenerPort":80}]'
    )
    ;;

  k3d)
    k3d cluster create $CLUSTER_NAME \
      --agents 2 \
      --port "8080:80@loadbalancer" \
      --k3s-arg "--disable=traefik@server:*"
    GATEWAY_SERVICE_ARGS=()
    ;;

  *)
    echo "Unknown tool: $TOOL"
    echo "Usage: $0 <cluster-name> <minikube|kind|k3d>"
    exit 1
    ;;
esac

echo "Installing the Gateway API CRDs and NGINX Gateway Fabric $NGF_VERSION..."
kubectl kustomize "https://github.com/nginx/nginx-gateway-fabric/config/crd/gateway-api/standard?ref=v$NGF_VERSION" \
  | kubectl apply -f -
helm install ngf oci://ghcr.io/nginx/charts/nginx-gateway-fabric \
  --version "$NGF_VERSION" \
  --namespace nginx-gateway \
  --create-namespace \
  --set nginx.service.externalTrafficPolicy=Cluster \
  ${GATEWAY_SERVICE_ARGS[@]+"${GATEWAY_SERVICE_ARGS[@]}"}  # empty-array safe on macOS bash 3.2
kubectl wait --timeout=5m -n nginx-gateway \
  deployment/ngf-nginx-gateway-fabric --for=condition=Available

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
# Start a kind cluster with the port mapping from step 2
kind create cluster --name dev --config kind-config.yaml

# Verify
kubectl get nodes
# NAME                STATUS   ROLES           AGE   VERSION
# dev-control-plane   Ready    control-plane   1m    v1.37.0
# dev-worker          Ready    <none>          1m    v1.37.0
# dev-worker2         Ready    <none>          1m    v1.37.0

# Install the Gateway API CRDs and the controller (step 4, kind variant)
# before the app: test-app.yaml contains a Gateway and an HTTPRoute.

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

### Use with the Gateway

```bash
# Kind: localhost:80 is mapped to the proxy's NodePort
curl -H "Host: hello.local" http://localhost/

# Or add a hosts entry and use the name
echo "127.0.0.1 hello.local" | sudo tee -a /etc/hosts
curl http://hello.local

# k3d: the load balancer listens on localhost:8080
curl -H "Host: hello.local" http://localhost:8080/

# Minikube: run the tunnel in a separate terminal, then use the external IP
minikube tunnel
EXTERNAL_IP=$(kubectl get svc hello-gateway-nginx -n demo \
  -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
curl -H "Host: hello.local" "http://$EXTERNAL_IP/"

# Any cluster: port-forward the proxy (keep it running in a separate terminal)
kubectl port-forward -n demo svc/hello-gateway-nginx 8081:80
curl -H "Host: hello.local" http://localhost:8081/

# A request for another host name gets a 404 from the proxy,
# because no HTTPRoute matches it
curl -i -H "Host: other.local" http://localhost:8081/
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
3. **Run a Gateway**: Test routing locally with the same Gateway API resources you use in production
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
- [Gateway API](https://gateway-api.sigs.k8s.io/)
- [NGINX Gateway Fabric](https://docs.nginx.com/nginx-gateway-fabric/)
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
