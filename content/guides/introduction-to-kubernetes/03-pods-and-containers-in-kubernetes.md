---
title: Pods and Containers in Kubernetes
description: Learn how to work with pods, the basic deployable units in Kubernetes
order: 3
---

Now that you have a Kubernetes cluster up and running, it's time to understand and work with pods and containers. Pods are the smallest deployable units in Kubernetes and the building blocks for all workloads.

## Understanding Pods

A pod is a group of one or more containers with shared storage, network resources, and a specification for how to run the containers. Pods are ephemeral by nature, they're not designed to be persistent. When a pod is deleted and replaced, any data not stored in persistent storage is lost.

Containers within a pod:

- Share the same network namespace (IP address and port space)
- Can communicate with each other using `localhost`
- Can share storage volumes

```
┌──────────────────────────────────────┐
│                 Pod                  │
│                                      │
│  ┌────────────┐     ┌────────────┐   │
│  │            │     │            │   │
│  │ Container 1│     │ Container 2│   │
│  │            │     │            │   │
│  └────────────┘     └────────────┘   │
│                                      │
│           Shared Volumes             │
│                                      │
└──────────────────────────────────────┘
```

## Creating Your First Pod

Let's create a simple pod running an NGINX web server. Create a file named `nginx-pod.yaml`:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-pod
  labels:
    app: nginx
spec:
  containers:
    - name: nginx
      image: nginx:1.21
      ports:
        - containerPort: 80
```

This YAML defines:

- The API version and kind of resource
- Metadata including the pod's name and labels
- A specification with one container using the nginx:1.21 image
- The container exposes port 80

Apply this configuration to your cluster:

```bash
kubectl apply -f nginx-pod.yaml
```

## Viewing and Managing Pods

Check if your pod is running:

```bash
kubectl get pods
```

You should see output like:

```
NAME        READY   STATUS    RESTARTS   AGE
nginx-pod   1/1     Running   0          42s
```

For more detailed information:

```bash
kubectl describe pod nginx-pod
```

This command shows pod details including:

- Current status and conditions
- Container information
- Events related to the pod

## Accessing Your Pod

There are several ways to access and interact with your pods:

### Port Forwarding

Forward a local port to the pod's port:

```bash
kubectl port-forward nginx-pod 8080:80
```

Now you can access NGINX by visiting `http://localhost:8080` in your browser.

### Shell Access

Execute commands inside a container:

```bash
# Run a command
kubectl exec nginx-pod -- ls /usr/share/nginx/html

# Get an interactive shell
kubectl exec -it nginx-pod -- /bin/bash
```

### Viewing Logs

Check the container logs:

```bash
kubectl logs nginx-pod

# Follow logs in real-time
kubectl logs -f nginx-pod
```

## Multi-Container Pods

While many pods contain just a single container, there are valid use cases for multiple containers in a pod. Let's create a pod with two containers:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: multi-container-pod
spec:
  containers:
    - name: web
      image: nginx:1.21
      ports:
        - containerPort: 80
      volumeMounts:
        - name: shared-data
          mountPath: /usr/share/nginx/html

    - name: content-generator
      image: alpine:3.14
      command: ['/bin/sh', '-c']
      args:
        - while true; do
          echo "<h1>The current date is $(date)</h1>" > /data/index.html;
          sleep 10;
          done
      volumeMounts:
        - name: shared-data
          mountPath: /data

  volumes:
    - name: shared-data
      emptyDir: {}
```

This pod has:

1. A web container running NGINX
2. A content generator container that updates the index.html every 10 seconds
3. A shared volume where both containers can access the same files

Apply the configuration:

```bash
kubectl apply -f multi-container-pod.yaml
```

After the pod is running, you can port-forward and see the content refreshing:

```bash
kubectl port-forward multi-container-pod 8080:80
```

Common patterns for multi-container pods include:

- **Sidecar**: Enhances the main container (like adding logging)
- **Ambassador**: Proxies network traffic to/from the main container
- **Adapter**: Transforms the main container's output

## Pod Lifecycle

Pods go through several phases during their lifetime:

1. **Pending**: Pod has been accepted but containers aren't running yet
2. **Running**: At least one container is running
3. **Succeeded**: All containers have terminated successfully
4. **Failed**: At least one container has terminated with failure
5. **Unknown**: The state of the pod cannot be determined

You can see a pod's phase with:

```bash
kubectl get pod nginx-pod -o wide
```

### Container Restart Policies

The `restartPolicy` field determines what happens when a container exits:

- **Always** (default): Always restart the container
- **OnFailure**: Restart only if the container exits with a non-zero code
- **Never**: Never restart the container

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: task-pod
spec:
  restartPolicy: OnFailure
  containers:
    - name: task
      image: alpine:3.14
      command: ['sh', '-c', 'echo "Task completed"; exit 0']
```

## Init Containers

Init containers run and complete before app containers start. They're useful for setup tasks:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: init-pod
spec:
  initContainers:
    - name: init-service
      image: alpine:3.14
      command: ['sh', '-c', 'until nslookup database; do echo waiting for database; sleep 2; done;']

  containers:
    - name: app
      image: nginx:1.21
```

In this example, the init container waits for a service named "database" to be resolvable before the main NGINX container starts.

## Resource Requests and Limits

Specify resource requirements and limits for containers:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: resource-pod
spec:
  containers:
    - name: app
      image: nginx:1.21
      resources:
        requests:
          memory: '64Mi'
          cpu: '250m'
        limits:
          memory: '128Mi'
          cpu: '500m'
```

This configuration:

- Requests 64MiB of memory and 0.25 CPU cores
- Limits the container to 128MiB of memory and 0.5 CPU cores

Resource requests help the scheduler place pods on nodes with sufficient resources, while limits prevent containers from using excessive resources.

## Environment Variables and ConfigMaps

Pass environment variables to your containers:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: env-pod
spec:
  containers:
    - name: app
      image: nginx:1.21
      env:
        - name: ENVIRONMENT
          value: 'production'
        - name: LOG_LEVEL
          value: 'info'
```

For more complex configuration, use ConfigMaps:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  ENVIRONMENT: 'production'
  LOG_LEVEL: 'info'
  app.properties: |
    property1=value1
    property2=value2
---
apiVersion: v1
kind: Pod
metadata:
  name: configmap-pod
spec:
  containers:
    - name: app
      image: nginx:1.21
      envFrom:
        - configMapRef:
            name: app-config
      volumeMounts:
        - name: config-volume
          mountPath: /config
  volumes:
    - name: config-volume
      configMap:
        name: app-config
```

## Health Checks

Kubernetes supports three types of health checks:

1. **Liveness Probe**: Determines if a container is running properly
2. **Readiness Probe**: Determines if a container is ready to receive traffic
3. **Startup Probe**: Determines when a container has started successfully

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: healthcheck-pod
spec:
  containers:
    - name: app
      image: nginx:1.21
      ports:
        - containerPort: 80
      livenessProbe:
        httpGet:
          path: /
          port: 80
        initialDelaySeconds: 3
        periodSeconds: 10
      readinessProbe:
        httpGet:
          path: /
          port: 80
        initialDelaySeconds: 5
        periodSeconds: 5
```

This pod has:

- A liveness probe that checks if NGINX responds at the root path
- A readiness probe to determine when it can receive traffic

## Security Context

Control the security settings for pods and containers:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: security-context-pod
spec:
  securityContext:
    runAsUser: 1000
    runAsGroup: 3000
    fsGroup: 2000
  containers:
    - name: app
      image: nginx:1.21
      securityContext:
        allowPrivilegeEscalation: false
        capabilities:
          drop:
            - ALL
```

This configuration:

- Runs the pod processes as user ID 1000 and group ID 3000
- Sets file permissions for volume mounts with group ID 2000
- Prevents privilege escalation
- Drops all Linux capabilities

## Affinity and Anti-Affinity

Control where pods are scheduled:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: affinity-pod
spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
          - matchExpressions:
              - key: disktype
                operator: In
                values:
                  - ssd
    podAntiAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
        - weight: 100
          podAffinityTerm:
            labelSelector:
              matchExpressions:
                - key: app
                  operator: In
                  values:
                    - nginx
            topologyKey: kubernetes.io/hostname
  containers:
    - name: app
      image: nginx:1.21
```

This pod:

- Requires scheduling on nodes with the label `disktype=ssd`
- Prefers to avoid nodes that already have pods with the label `app=nginx`

## Tolerations and Taints

Allow pods to schedule on tainted nodes:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: toleration-pod
spec:
  tolerations:
    - key: 'dedicated'
      operator: 'Equal'
      value: 'gpu'
      effect: 'NoSchedule'
  containers:
    - name: app
      image: tensorflow/tensorflow:latest-gpu
```

This pod can be scheduled on nodes with the taint `dedicated=gpu:NoSchedule`.

## Pod Disruption Budgets

Protect your applications during voluntary disruptions:

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: nginx-pdb
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: nginx
```

This PodDisruptionBudget ensures that at least 2 pods with the label `app=nginx` are available during node maintenance.

## Best Practices for Pods

1. **Use controllers instead of raw pods**: Direct pod creation is mainly for testing. In production, use Deployments, StatefulSets, or DaemonSets.

2. **Keep pods focused**: Follow the single-responsibility principle.

3. **Set resource requests and limits**: Always specify what resources your pods need.

4. **Implement health checks**: Use probes to help Kubernetes manage your pods.

5. **Use labels and annotations**: Labels enable selection, and annotations add useful metadata.

6. **Don't put application state in pods**: Use persistent volumes for stateful data.

7. **Set appropriate restart policies**: Choose based on your application's needs.

8. **Define pod security contexts**: Reduce the attack surface of your applications.

## Using DigitalOcean for Running Kubernetes Pods

DigitalOcean Kubernetes provides an optimized platform for running your pods with features like:

- Autoscaling node pools
- Load balancer integration
- Block storage for persistent volumes
- Container registry for your images

[Sign up with DigitalOcean](https://www.jdoqocy.com/click-101674709-15836238) to get $200 in free credits and start deploying your pods on a production-ready Kubernetes platform.

In the next section, we'll explore Deployments and ReplicaSets, which help you manage multiple pod instances and handle updates gracefully.
