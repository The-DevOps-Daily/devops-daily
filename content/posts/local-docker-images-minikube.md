---
title: 'How Can I Use Local Docker Images with Minikube?'
excerpt: 'Learn how to use local Docker images with Minikube for Kubernetes development and testing.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-12-15'
publishedAt: '2024-12-15T09:00:00Z'
updatedAt: '2024-12-15T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Minikube
  - Kubernetes
  - Containers
  - Tutorials
---

## TLDR

To use local Docker images with Minikube, enable the Minikube Docker environment using `eval $(minikube docker-env)`. Build your images locally, and they will be accessible within the Minikube cluster.

---

Minikube is a popular tool for running Kubernetes clusters locally. When developing applications, you may want to use local Docker images without pushing them to a remote registry. This guide will show you how to use local Docker images with Minikube.

## Prerequisites

Before you begin, make sure you have:

- Minikube installed on your system.
- Docker installed and running.
- A Kubernetes cluster started with Minikube.

## Step 1: Start Minikube

Start your Minikube cluster using the following command:

```bash
minikube start
```

This initializes a local Kubernetes cluster.

## Step 2: Enable Minikube Docker Environment

To use local Docker images with Minikube, you need to enable the Minikube Docker environment. Run the following command:

```bash
eval $(minikube docker-env)
```

This command configures your terminal to use the Docker daemon inside the Minikube VM.

### Example Output

```plaintext
export DOCKER_TLS_VERIFY="1"
export DOCKER_HOST="tcp://192.168.99.100:2376"
export DOCKER_CERT_PATH="/home/user/.minikube/certs"
export MINIKUBE_ACTIVE_DOCKERD="minikube"
```

## Step 3: Build Local Docker Images

Build your Docker images locally using the standard `docker build` command. For example:

```bash
docker build -t my-app:latest .
```

Since your terminal is configured to use the Minikube Docker daemon, the image will be available inside the Minikube cluster.

## Step 4: Verify the Image in Minikube

To verify that the image is available in Minikube, use the following command:

```bash
docker images
```

This will list all Docker images in the Minikube environment. You should see your image (`my-app:latest`) in the list.

## Step 5: Deploy the Image to Kubernetes

Create a Kubernetes deployment using your local image. For example:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
        - name: my-app
          image: my-app:latest
          ports:
            - containerPort: 8080
```

Save this YAML configuration to a file (e.g., `deployment.yaml`) and apply it using `kubectl`:

```bash
kubectl apply -f deployment.yaml
```

## Step 6: Access the Application

Expose the deployment as a service to access the application. For example:

```bash
kubectl expose deployment my-app --type=NodePort --port=8080
```

Use the following command to get the service URL:

```bash
minikube service my-app --url
```

Navigate to the URL in your browser to access the application.

## Additional Tips

- **Switch Back to Local Docker**: To switch back to your local Docker environment, run:

  ```bash
  eval $(minikube docker-env -u)
  ```

- **Use Minikube Addons**: Minikube provides addons like the Kubernetes dashboard for easier management.
- **Monitor Resources**: Use `kubectl get pods` and `kubectl logs` to monitor your application.

By following these steps, you can efficiently use local Docker images with Minikube for Kubernetes development and testing.


## Related Resources

- [Use Local Docker Images with Minikube](/posts/use-local-docker-images-minikube) — updated methods
- [Docker Compose vs Kubernetes](/posts/docker-compose-vs-kubernetes-differences) — choosing the right tool
- [Introduction to Kubernetes Guide](/guides/introduction-to-kubernetes) — learn K8s
- [DevOps Roadmap](/roadmap) — the full learning path
