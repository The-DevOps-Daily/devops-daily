---
title: 'How I Finally Understood Docker and Kubernetes'
excerpt: "Docker and Kubernetes can feel abstract until you see what problems they actually solve. Here's a practical guide to understanding both tools through real examples."
category:
  name: 'DevOps'
  slug: 'devops'
date: '2024-11-17'
publishedAt: '2024-11-17T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Kubernetes
  - Containers
  - DevOps
  - Cloud Native
  - Container Orchestration
---

## TLDR

Docker packages your application and its dependencies into containers, eliminating "it works on my machine" problems. Kubernetes manages those containers at scale, handling deployment, scaling, and recovery across multiple servers. This guide walks through practical examples of both tools, showing you how they work together to run applications in production.

For years, I read tutorials about Docker and Kubernetes without really getting it. I could follow the commands and get containers running, but I didn't understand what problems they solved or why teams adopted them. The concepts finally clicked when I stopped thinking about the tools themselves and started focusing on the workflow problems they fix.

This guide takes that approach. You'll build real examples and see exactly what breaks without these tools and how they fix it.

## Prerequisites

Before starting, you'll need:

- A Linux, macOS, or Windows machine with administrator access
- Docker Desktop installed (download from [docker.com](https://www.docker.com/products/docker-desktop))
- Basic command line experience
- A text editor
- At least 4GB of free RAM

For the Kubernetes section, you'll use Docker Desktop's built-in Kubernetes cluster, so no additional installation is needed.

## What Docker Actually Solves

The classic problem: your application works perfectly on your laptop but crashes on the server. Or it runs fine in testing but fails in production. Usually, the issue isn't your code - it's the environment.

Maybe the server has Python 3.8 while you developed with 3.11. Maybe a system library is missing. Maybe environment variables are set differently. These mismatches cause most deployment headaches.

Docker solves this by packaging everything your application needs into a container: your code, the runtime, system libraries, and dependencies. The container runs the same way everywhere because it carries its own environment.

Here's what that looks like in practice. Create a directory for your project:

```bash
mkdir docker-demo && cd docker-demo
```

Now create a simple Node.js application. First, make a `package.json` file:

```json
{
  "name": "demo-app",
  "version": "1.0.0",
  "main": "server.js",
  "dependencies": {
    "express": "^4.18.2"
  }
}
```

This defines your application and its dependency on Express, a web framework. Now create `server.js`:

```javascript
const express = require('express');
const app = express();
const port = 3000;

// Simple route that shows environment info
app.get('/', (req, res) => {
  res.json({
    message: 'Hello from Docker',
    nodeVersion: process.version,
    platform: process.platform,
    environment: process.env.NODE_ENV || 'development'
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});
```

This server responds with JSON showing which Node version and platform it's running on. Without Docker, you'd need to make sure the server has the right Node version installed, run `npm install`, and handle all the setup. With Docker, you define this once.

Create a `Dockerfile`:

```dockerfile
# Start from the official Node 18 image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package files first (this layer gets cached)
COPY package*.json ./

# Install dependencies inside the container
RUN npm install --production

# Copy your application code
COPY server.js ./

# Tell Docker the app listens on port 3000
EXPOSE 3000

# Command to run when the container starts
CMD ["node", "server.js"]
```

Each line in a Dockerfile creates a layer. Docker caches these layers, so if you only change `server.js`, it won't reinstall all your dependencies - it reuses the cached layer from the `npm install` step. This makes rebuilds fast.

Build the container image:

```bash
docker build -t demo-app:v1 .
```

The `-t` flag tags your image with a name and version. Docker downloads the Node 18 base image (if you don't have it yet), runs each instruction in your Dockerfile, and creates a new image called `demo-app:v1`.

Run it:

```bash
docker run -p 3000:3000 demo-app:v1
```

This starts a container from your image. The `-p 3000:3000` flag maps port 3000 in the container to port 3000 on your machine, so you can access the app. Open your browser to `http://localhost:3000` and you'll see:

```json
{
  "message": "Hello from Docker",
  "nodeVersion": "v18.x.x",
  "platform": "linux",
  "environment": "development"
}
```

Notice the platform shows Linux even if you're running macOS or Windows. That's because the container is running its own isolated Linux environment.

Here's what happened:

```
Your Machine                    Container
─────────────                  ──────────────────────────
Docker Engine    →   Creates   Linux Environment
                               Node 18 installed
                               Your app copied
                               Dependencies installed
                               Process running
```

The key insight: this container will run identically on any machine with Docker installed. Your laptop, your colleague's Windows PC, a Linux server, a cloud VM - everywhere. The environment is frozen into the image.

## Working with Container Layers

Understanding layers helps you optimize your Dockerfiles. When you change a file and rebuild, Docker only rebuilds layers from that change downward. Look at this less efficient version:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .              # Copies everything at once
RUN npm install
CMD ["node", "server.js"]
```

If you change one line in `server.js`, Docker copies everything again and reruns `npm install`. The earlier version is smarter:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./  # Only copy dependency files first
RUN npm install         # This layer only rebuilds if package files change
COPY . .                # Then copy your code
CMD ["node", "server.js"]
```

Now changing `server.js` only invalidates the last COPY layer. The `npm install` layer stays cached, making rebuilds nearly instant.

## Handling Environment Differences

Real applications need different configurations for development and production. You might want verbose logging locally but minimal logging in production. Or different database connections.

Docker handles this with environment variables. Update your `server.js`:

```javascript
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({
    message: 'Hello from Docker',
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${port}`);
});
```

Rebuild and run with environment variables:

```bash
docker build -t demo-app:v2 .
docker run -p 3000:3000 -e NODE_ENV=production demo-app:v2
```

The `-e` flag sets environment variables. Now your app knows it's running in production mode, and you can adjust behavior accordingly.

For multiple variables, use an env file. Create `.env`:

```
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
```

Run with:

```bash
docker run -p 3000:3000 --env-file .env demo-app:v2
```

## What Kubernetes Actually Solves

Docker solves the environment problem. Kubernetes solves the operations problem.

When you run containers in production, you face new challenges:
- What happens if a container crashes? Something needs to restart it.
- How do you run 10 copies of your app to handle more traffic?
- When you deploy a new version, how do you update containers without downtime?
- How do you route traffic to healthy containers?

Doing this manually with Docker means writing scripts to monitor containers, restart failed ones, distribute traffic, and coordinate updates. That's what Kubernetes does automatically.

Think of it this way:

```
Docker:        You → docker run → Container running
Kubernetes:    You → kubectl apply → Kubernetes → Containers running
                                    → Monitoring them
                                    → Restarting failures
                                    → Load balancing traffic
                                    → Rolling updates
```

Kubernetes isn't a replacement for Docker - it manages Docker containers (or other container runtimes). You still write Dockerfiles and build images. Kubernetes just handles everything that happens after `docker run`.

## Setting Up Your First Kubernetes Application

Enable Kubernetes in Docker Desktop: open Docker Desktop settings, go to Kubernetes, and check "Enable Kubernetes". It takes a few minutes to start.

Verify it's running:

```bash
kubectl cluster-info
```

You should see information about your Kubernetes cluster running locally.

Kubernetes uses YAML files to describe what you want running. Instead of running `docker run` manually, you tell Kubernetes "I want 3 copies of this container running" and it makes it happen.

Create `deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: demo-app
spec:
  # We want 3 copies running
  replicas: 3

  # This selector tells Kubernetes which pods belong to this deployment
  selector:
    matchLabels:
      app: demo-app

  # Template for creating each pod
  template:
    metadata:
      labels:
        app: demo-app
    spec:
      containers:
      - name: demo-app
        image: demo-app:v2
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        # These settings tell Kubernetes if the container is healthy
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
```

This deployment spec tells Kubernetes several things:
- Run 3 replicas of your app
- Use the `demo-app:v2` image you built earlier
- Set NODE_ENV to production
- Check the `/health` endpoint every 5 seconds to verify containers are healthy

Apply it:

```bash
kubectl apply -f deployment.yaml
```

Watch Kubernetes create your pods:

```bash
kubectl get pods
```

You'll see three pods with names like `demo-app-7d8b9c5f4-x8h2n`. Each is a running instance of your container. Kubernetes automatically distributes them and monitors them.

Try deleting one:

```bash
kubectl delete pod <pod-name>
```

Immediately check again:

```bash
kubectl get pods
```

Kubernetes already started a replacement. You told it you want 3 replicas running, so when one disappears, it creates another. This is the core value - you declare desired state, and Kubernetes maintains it.

## Exposing Your Application

Your pods are running, but you can't access them yet. Kubernetes pods get internal IP addresses that change when pods restart. You need a stable way to reach your application.

This is where Services come in. A Service provides a fixed endpoint that routes traffic to your pods. Create `service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: demo-app-service
spec:
  type: LoadBalancer
  selector:
    app: demo-app
  ports:
  - protocol: TCP
    port: 80        # External port
    targetPort: 3000 # Port your app listens on
```

The selector `app: demo-app` matches the labels on your pods. Any pod with that label receives traffic from this service.

Apply it:

```bash
kubectl apply -f service.yaml
```

Check the service:

```bash
kubectl get service demo-app-service
```

On Docker Desktop's Kubernetes, the LoadBalancer gets `localhost` as its external IP. Visit `http://localhost` in your browser. You'll see your app responding, but you can't tell which of the 3 pods handled your request.

The service is load balancing automatically:

```
Your Request → Service (localhost:80) → Routes to one of:
                                        → Pod 1 (10.1.0.5:3000)
                                        → Pod 2 (10.1.0.6:3000)
                                        → Pod 3 (10.1.0.7:3000)
```

## Updating Your Application

Now comes the powerful part: updating without downtime. Change your `server.js` message:

```javascript
app.get('/', (req, res) => {
  res.json({
    message: 'Hello from Docker - Version 3!',
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});
```

Build a new version:

```bash
docker build -t demo-app:v3 .
```

Update your deployment to use the new image. Edit `deployment.yaml` and change the image line:

```yaml
containers:
- name: demo-app
  image: demo-app:v3  # Changed from v2
```

Apply the update:

```bash
kubectl apply -f deployment.yaml
```

Watch the rollout:

```bash
kubectl rollout status deployment/demo-app
```

Kubernetes performs a rolling update. It creates a pod with the new version, waits for it to be healthy, then terminates an old pod. It repeats this until all pods run the new version. Your service never stops responding because at least some pods are always running.

If something goes wrong with the new version, you can roll back:

```bash
kubectl rollout undo deployment/demo-app
```

Kubernetes immediately switches back to the previous version.

## Scaling Based on Demand

Your app suddenly gets popular and 3 pods aren't enough. Scale up:

```bash
kubectl scale deployment demo-app --replicas=10
```

Kubernetes immediately starts creating 7 more pods. The service automatically includes them in its load balancing.

Check it:

```bash
kubectl get pods
```

You'll see 10 pods running. Scale back down:

```bash
kubectl scale deployment demo-app --replicas=3
```

Kubernetes terminates the extra pods gracefully.

You can also set up autoscaling based on CPU usage:

```bash
kubectl autoscale deployment demo-app --cpu-percent=50 --min=3 --max=10
```

Now Kubernetes watches CPU usage and automatically adjusts the number of pods between 3 and 10 to maintain 50% average CPU utilization.

## Understanding the Architecture

Here's how the pieces fit together:

```
Kubernetes Cluster
├── Control Plane (manages everything)
│   ├── API Server (you talk to this via kubectl)
│   ├── Scheduler (decides where to run pods)
│   └── Controller Manager (maintains desired state)
│
└── Worker Nodes (run your containers)
    ├── Node 1
    │   ├── Pod: demo-app-abc123
    │   └── Pod: demo-app-def456
    └── Node 2
        └── Pod: demo-app-ghi789

Service (demo-app-service)
└── Routes traffic to all pods
    labeled app=demo-app
```

When you run `kubectl apply`, you're talking to the API Server. It stores your desired state. The Controller Manager notices the current state doesn't match (maybe you want 3 pods but only 2 exist) and takes action. The Scheduler decides which node should run new pods.

## Running Multiple Applications

Real systems have multiple services. Maybe you have a web app, an API, and a background worker. Each gets its own deployment.

Create a simple Redis cache as a second service. File `redis-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
---
apiVersion: v1
kind: Service
metadata:
  name: redis-service
spec:
  selector:
    app: redis
  ports:
  - protocol: TCP
    port: 6379
    targetPort: 6379
```

The `---` separator lets you put multiple resources in one file. Apply it:

```bash
kubectl apply -f redis-deployment.yaml
```

Now your app can connect to Redis using the hostname `redis-service`. Kubernetes provides internal DNS, so services can find each other by name.

Update your `server.js` to use Redis. First add the Redis client to `package.json`:

```json
{
  "name": "demo-app",
  "version": "1.0.0",
  "main": "server.js",
  "dependencies": {
    "express": "^4.18.2",
    "redis": "^4.6.5"
  }
}
```

Update `server.js`:

```javascript
const express = require('express');
const redis = require('redis');
const app = express();
const port = process.env.PORT || 3000;

// Connect to Redis using the Kubernetes service name
const redisClient = redis.createClient({
  url: 'redis://redis-service:6379'
});

redisClient.connect().catch(console.error);

app.get('/', async (req, res) => {
  // Increment a counter in Redis
  const visits = await redisClient.incr('visits');

  res.json({
    message: 'Hello from Docker - Version 4!',
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
    visits: visits,
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});
```

Build and update:

```bash
docker build -t demo-app:v4 .
```

Update your deployment image to `demo-app:v4` and apply it. Now your app stores a visit counter in Redis. Refresh the page several times - the counter increases. Delete one of your app pods:

```bash
kubectl delete pod <pod-name>
```

When Kubernetes restarts it, the counter persists because Redis maintains the state. This shows how services communicate within a Kubernetes cluster.

## Configuration and Secrets

Hard-coding the Redis URL isn't ideal. Use ConfigMaps for configuration. Create `configmap.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  REDIS_URL: "redis://redis-service:6379"
  LOG_LEVEL: "info"
```

Apply it:

```bash
kubectl apply -f configmap.yaml
```

Reference it in your deployment:

```yaml
containers:
- name: demo-app
  image: demo-app:v4
  envFrom:
  - configMapRef:
      name: app-config
```

Now your app reads `REDIS_URL` from the environment, and you can change it without rebuilding the image.

For sensitive data like passwords or API keys, use Secrets instead of ConfigMaps:

```bash
kubectl create secret generic app-secrets \
  --from-literal=database-password='your-password-here'
```

Reference secrets the same way:

```yaml
envFrom:
- secretRef:
    name: app-secrets
```

Secrets are stored encoded (though not encrypted by default - you'd configure encryption at rest in a production cluster).

## Viewing Logs and Debugging

When something goes wrong, you need to see what's happening. View logs from all pods in a deployment:

```bash
kubectl logs -l app=demo-app --tail=50
```

The `-l` flag selects pods by label, and `--tail=50` shows the last 50 lines. Follow logs in real-time:

```bash
kubectl logs -l app=demo-app -f
```

For debugging, you can open a shell inside a running pod:

```bash
kubectl exec -it <pod-name> -- /bin/sh
```

This connects you to a shell in the container, where you can check files, test connections, or run diagnostic commands.

Describe a pod to see events and status:

```bash
kubectl describe pod <pod-name>
```

This shows everything Kubernetes knows about the pod: its status, events (like image pulled, container started), resource usage, and why it might be failing.

## How This Works in Production

On Docker Desktop, everything runs on your laptop. In production, you'd use a managed Kubernetes service like Google Kubernetes Engine (GKE), Amazon EKS, or Azure AKS. These services handle the control plane for you.

The workflow stays the same:
1. Build Docker images locally or in CI/CD
2. Push images to a container registry (Docker Hub, Google Container Registry, etc.)
3. Update Kubernetes manifests to reference the new image
4. Apply the manifests to your production cluster

Your deployment might specify an image like:

```yaml
image: gcr.io/your-project/demo-app:v4
```

Instead of building locally, your CI/CD pipeline builds when you merge to main:

```bash
docker build -t gcr.io/your-project/demo-app:$GIT_SHA .
docker push gcr.io/your-project/demo-app:$GIT_SHA
kubectl set image deployment/demo-app demo-app=gcr.io/your-project/demo-app:$GIT_SHA
```

The key difference is scale. Production clusters run hundreds or thousands of pods across many nodes. But the concepts - deployments, services, configmaps - work exactly the same way.

## When You Actually Need Kubernetes

Docker alone works great for many use cases. If you're running a single server with a few containers, Docker Compose is simpler than Kubernetes. You only need Kubernetes when you face problems it solves:

- Running across multiple servers
- Needing automatic failover and healing
- Handling complex deployments with many microservices
- Scaling dynamically based on load
- Requiring zero-downtime deployments

For a side project or small application, Docker Compose is usually enough. For a production system serving thousands of users, Kubernetes provides the automation and reliability you need.

## Next Steps

You now understand the core workflow: Docker packages applications, Kubernetes runs them at scale. To go deeper, explore:

- **Persistent storage with Volumes**: What happens when your database pod restarts? Volumes preserve data.
- **Namespaces**: Isolate environments (development, staging, production) within one cluster.
- **Ingress controllers**: Route HTTP traffic to multiple services based on domain or path.
- **Helm charts**: Package Kubernetes applications for easy deployment.
- **Monitoring with Prometheus**: Collect metrics from your applications and cluster.

The best way to learn is to run your own applications. Take a project you've built and containerize it. Then try running it on Kubernetes. You'll run into real problems - networking issues, configuration headaches, resource limits - and solving them will deepen your understanding far more than following tutorials.

The tools themselves matter less than understanding the problems they solve. Once you see why teams adopted containers and orchestration, you'll know when to use them and when simpler solutions work better.


## Related Resources

- [How Docker Differs from a Virtual Machine](/posts/how-docker-differs-from-a-virtual-machine) — deeper comparison
- [Docker Compose vs Kubernetes](/posts/docker-compose-vs-kubernetes-differences) — choosing the right tool
- [Introduction to Docker Guide](/guides/introduction-to-docker) — hands-on Docker learning
- [Introduction to Kubernetes Guide](/guides/introduction-to-kubernetes) — hands-on K8s learning
- [DevOps Roadmap](/roadmap) — the full learning path
