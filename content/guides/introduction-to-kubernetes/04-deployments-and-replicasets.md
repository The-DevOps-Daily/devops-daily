---
title: Deployments and ReplicaSets
description: Learn the workload resources that manage pod lifecycle, scaling, and updates
order: 4
---

While pods are the basic building blocks in Kubernetes, you rarely create individual pods directly in production environments. Instead, you use higher-level abstractions that manage pod creation, scaling, and updates. The most common of these are Deployments and ReplicaSets.

## Understanding Deployments and ReplicaSets

When you create a Deployment, Kubernetes creates a ReplicaSet under the hood, which then creates and manages your pods. This hierarchy provides several benefits:

```
┌───────────────────┐
│    Deployment     │
│                   │
│  ┌───────────────┐│
│  │  ReplicaSet   ││
│  │               ││
│  │ ┌─────┐┌─────┐││
│  │ │ Pod ││ Pod │││
│  │ └─────┘└─────┘││
│  └───────────────┘│
└───────────────────┘
```

- **Deployments** provide declarative updates for ReplicaSets and enable rolling updates and rollbacks
- **ReplicaSets** ensure a specified number of pod replicas are running at all times

While you can create ReplicaSets directly, it's generally better to use Deployments unless you need custom update orchestration.

## Creating Your First Deployment

Let's create a simple Deployment for an NGINX web server. Create a file named `nginx-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
  labels:
    app: nginx
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
        - name: nginx
          image: nginx:1.21
          ports:
            - containerPort: 80
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 250m
              memory: 256Mi
```

This YAML defines:

- A Deployment named "nginx-deployment"
- Three replica pods
- A pod template with an NGINX container

Apply this configuration to your cluster:

```bash
kubectl apply -f nginx-deployment.yaml
```

## Managing Deployments

### Viewing Deployments

Check the status of your deployment:

```bash
kubectl get deployments
```

You'll see output like:

```
NAME               READY   UP-TO-DATE   AVAILABLE   AGE
nginx-deployment   3/3     3            3           45s
```

The columns indicate:

- `READY`: Number of replicas available / total desired replicas
- `UP-TO-DATE`: Number of replicas updated to the latest pod template
- `AVAILABLE`: Number of replicas available to users

For more detailed information:

```bash
kubectl describe deployment nginx-deployment
```

### Viewing ReplicaSets

Check the ReplicaSet created by your Deployment:

```bash
kubectl get replicasets
```

Output:

```
NAME                          DESIRED   CURRENT   READY   AGE
nginx-deployment-66b6c48dd5   3         3         3       10m
```

### Viewing Pods

See all pods managed by the Deployment:

```bash
kubectl get pods -l app=nginx
```

## Scaling Deployments

You can easily scale the number of pods in a Deployment.

### Scaling Using kubectl

```bash
kubectl scale deployment nginx-deployment --replicas=5
```

### Scaling by Editing the Deployment

You can also edit the Deployment directly:

```bash
kubectl edit deployment nginx-deployment
```

This opens the Deployment configuration in your default editor. Change the `replicas` field to your desired number, save, and exit.

### Declarative Scaling

The most Kubernetes-native approach is updating your YAML file and reapplying it:

```yaml
# Modified nginx-deployment.yaml
spec:
  replicas: 5 # Changed from 3 to 5
```

Then apply the changes:

```bash
kubectl apply -f nginx-deployment.yaml
```

## Updating Deployments

One of the key benefits of Deployments is the ability to update your application declaratively and control the rollout process.

### Updating the Container Image

Let's update our NGINX version from 1.21 to 1.22:

```bash
kubectl set image deployment/nginx-deployment nginx=nginx:1.22
```

Alternatively, edit the YAML file and update the image version, then apply it:

```yaml
# Modified nginx-deployment.yaml
containers:
  - name: nginx
    image: nginx:1.22 # Changed from 1.21 to 1.22
```

```bash
kubectl apply -f nginx-deployment.yaml
```

### Watching the Rollout

Monitor the rollout progress:

```bash
kubectl rollout status deployment/nginx-deployment
```

Behind the scenes, Kubernetes:

1. Creates a new ReplicaSet with the updated pod template
2. Gradually scales up the new ReplicaSet while scaling down the old one
3. Keeps both ReplicaSets but sets the old one's replica count to zero

You can see this by checking the ReplicaSets:

```bash
kubectl get replicasets
```

Output:

```
NAME                          DESIRED   CURRENT   READY   AGE
nginx-deployment-66b6c48dd5   0         0         0       30m
nginx-deployment-78cd7c7774   5         5         5       2m
```

## Rollout Strategies

Deployments support two rollout strategies:

### RollingUpdate Strategy (Default)

The `RollingUpdate` strategy gradually replaces old pods with new ones:

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1 # Maximum number of pods that can be unavailable during the update
      maxSurge: 1 # Maximum number of pods that can be created over the desired number
```

Benefits of `RollingUpdate`:

- Zero downtime updates
- Controlled rollout pace
- Automatic rollback if health checks fail

### Recreate Strategy

The `Recreate` strategy terminates all existing pods before creating new ones:

```yaml
spec:
  strategy:
    type: Recreate
```

This causes downtime but ensures no two versions run simultaneously, which can be important for some applications with incompatible versions.

## Deployment History and Rollbacks

Kubernetes tracks your Deployment revisions, enabling rollbacks to previous states.

### Viewing Rollout History

```bash
kubectl rollout history deployment/nginx-deployment
```

Output:

```
REVISION  CHANGE-CAUSE
1         <none>
2         <none>
```

For more details on a specific revision:

```bash
kubectl rollout history deployment/nginx-deployment --revision=2
```

### Rolling Back to a Previous Revision

If an update causes problems, you can roll back:

```bash
# Roll back to the previous revision
kubectl rollout undo deployment/nginx-deployment

# Roll back to a specific revision
kubectl rollout undo deployment/nginx-deployment --to-revision=1
```

### Pausing and Resuming Rollouts

You can pause a rollout to test the new version before proceeding:

```bash
# Pause the rollout
kubectl rollout pause deployment/nginx-deployment

# Resume the rollout
kubectl rollout resume deployment/nginx-deployment
```

## Controlling Deployment Behavior

Fine-tune how your Deployments behave with these fields:

### minReadySeconds

Wait a specified time after a pod is ready before considering it available:

```yaml
spec:
  minReadySeconds: 10 # Wait 10 seconds after a pod is ready
```

### revisionHistoryLimit

Control how many old ReplicaSets to keep for rollback purposes:

```yaml
spec:
  revisionHistoryLimit: 5 # Keep 5 old ReplicaSets (default is 10)
```

### progressDeadlineSeconds

Set a timeout for deployment progress:

```yaml
spec:
  progressDeadlineSeconds: 600 # Consider deployment failed if it takes more than 600 seconds
```

## Advanced Deployment Patterns

Beyond basic deployments, Kubernetes enables sophisticated deployment strategies:

### Blue-Green Deployments

Run two identical environments (blue and green) and switch traffic by updating a Service:

1. Deploy the new version (green) alongside the old version (blue):

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-green
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
      version: green
  template:
    metadata:
      labels:
        app: myapp
        version: green
    spec:
      containers:
        - name: myapp
          image: myapp:v2
```

2. Test the green environment

3. Switch the Service selector to point to the green deployment:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: myapp
spec:
  selector:
    app: myapp
    version: green # Changed from "blue" to "green"
  ports:
    - port: 80
      targetPort: 8080
```

### Canary Deployments

Gradually shift traffic to the new version:

1. Deploy the stable version with most replicas:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-stable
spec:
  replicas: 9 # 90% of traffic
  selector:
    matchLabels:
      app: myapp
      version: stable
  template:
    metadata:
      labels:
        app: myapp
        version: stable
    spec:
      containers:
        - name: myapp
          image: myapp:v1
```

2. Deploy the canary version with fewer replicas:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-canary
spec:
  replicas: 1 # 10% of traffic
  selector:
    matchLabels:
      app: myapp
      version: canary
  template:
    metadata:
      labels:
        app: myapp
        version: canary
    spec:
      containers:
        - name: myapp
          image: myapp:v2
```

3. Create a Service that selects all pods with the "app: myapp" label:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: myapp
spec:
  selector:
    app: myapp # Selects both stable and canary pods
  ports:
    - port: 80
      targetPort: 8080
```

4. Gradually increase canary replicas while reducing stable replicas.

For more sophisticated traffic splitting, consider using a service mesh like Istio.

## ReplicaSets in Depth

While Deployments are the recommended way to manage pods, understanding ReplicaSets helps in troubleshooting and special cases.

### Creating a ReplicaSet Directly

```yaml
apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: nginx-replicaset
  labels:
    app: nginx
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
        - name: nginx
          image: nginx:1.21
```

### ReplicaSet Selector Types

ReplicaSets support two types of selectors:

1. **matchLabels**: Simple equality-based selector

```yaml
selector:
  matchLabels:
    app: nginx
    environment: production
```

2. **matchExpressions**: More sophisticated set-based selector

```yaml
selector:
  matchExpressions:
    - key: app
      operator: In
      values:
        - nginx
        - web
    - key: environment
      operator: NotIn
      values:
        - development
```

Operators include `In`, `NotIn`, `Exists`, and `DoesNotExist`.

## StatefulSets for Stateful Applications

For stateful applications like databases, use StatefulSets instead of Deployments:

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: 'postgres'
  replicas: 3
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: postgres:14
          ports:
            - containerPort: 5432
          volumeMounts:
            - name: postgres-data
              mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
    - metadata:
        name: postgres-data
      spec:
        accessModes: ['ReadWriteOnce']
        resources:
          requests:
            storage: 10Gi
```

StatefulSets provide:

- Stable, unique network identifiers (`postgres-0`, `postgres-1`, etc.)
- Stable, persistent storage
- Ordered, graceful deployment and scaling
- Ordered, automated rolling updates

## DaemonSets for Node-Level Operations

DaemonSets ensure a copy of a pod runs on selected nodes:

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: fluentd
spec:
  selector:
    matchLabels:
      app: fluentd
  template:
    metadata:
      labels:
        app: fluentd
    spec:
      containers:
        - name: fluentd
          image: fluentd:v1.10
```

Use cases include:

- Node monitoring agents
- Log collection
- Network plugins
- Storage plugins

## Jobs and CronJobs for Batch Processing

For one-off or scheduled tasks, use Jobs and CronJobs:

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: batch-job
spec:
  completions: 5
  parallelism: 2
  template:
    spec:
      containers:
        - name: batch-processor
          image: batch-processor:v1
      restartPolicy: OnFailure
```

For scheduled jobs:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: daily-cleanup
spec:
  schedule: '0 0 * * *' # Midnight every day
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: cleanup
              image: cleanup:v1
          restartPolicy: OnFailure
```

## Best Practices for Deployments

1. **Set resource requests and limits**: Ensure your pods have appropriate resource allocations for reliability.

2. **Implement health checks**: Add liveness and readiness probes for robust deployments.

3. **Use reasonable update strategies**: Configure `maxSurge` and `maxUnavailable` based on your application's needs.

4. **Keep revision history manageable**: Set an appropriate `revisionHistoryLimit` to avoid resource waste.

5. **Label everything effectively**: Use consistent, meaningful labels for your resources.

6. **Test updates before production**: Use staging environments to verify updates before production rollouts.

7. **Implement progressive delivery**: Consider canary deployments for critical applications.

8. **Document rollback procedures**: Ensure your team knows how to roll back problematic deployments.

## Using DigitalOcean for Kubernetes Deployments

DigitalOcean Kubernetes provides a reliable platform for running your Deployments with features like:

- Autoscaling node pools to handle varying workloads
- Load balancer integration for services
- Container Registry for storing your images securely

[Sign up with DigitalOcean](https://www.jdoqocy.com/click-101674709-15836238) and get $200 in free credits to deploy your applications on a production-ready Kubernetes platform.

In the next section, we'll explore Kubernetes Services and Networking, which enable communication between your applications and the outside world.
