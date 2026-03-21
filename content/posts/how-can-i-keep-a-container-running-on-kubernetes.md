---
title: 'How Can I Keep a Container Running on Kubernetes?'
excerpt: 'Learn how to ensure your container stays running on Kubernetes by using proper configurations and best practices.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2024-07-10'
publishedAt: '2024-07-10T09:00:00Z'
updatedAt: '2024-07-10T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Kubernetes
  - Containers
  - Troubleshooting
  - DevOps
---

## Introduction

Ensuring that a container stays running on Kubernetes is a common challenge, especially when dealing with applications that require persistent uptime. In this guide, you'll learn how to configure your Kubernetes resources to keep containers running reliably.

## Prerequisites

Before proceeding, make sure:

- You have a basic understanding of Kubernetes Pods and Deployments.
- You have access to a Kubernetes cluster and `kubectl` installed.

## Common Reasons Containers Stop Running

Containers in Kubernetes may stop running due to various reasons:

- The application inside the container exits unexpectedly.
- Resource limits (CPU or memory) are exceeded.
- Liveness or readiness probes fail.
- Misconfigured Kubernetes objects.

Understanding these causes is the first step to ensuring container uptime.

## Configurations to Keep Containers Running

### Use Restart Policies

Kubernetes Pods have a `restartPolicy` that determines what happens when a container exits. The default policy for most workloads is `Always`, which ensures the container is restarted automatically.

Here's an example Pod definition:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: example-pod
spec:
  containers:
    - name: example-container
      image: nginx
  restartPolicy: Always
```

In this example:

- The `restartPolicy: Always` ensures the container is restarted whenever it exits.

### Use Deployments for Automatic Recovery

Deployments provide a higher-level abstraction for managing Pods. They ensure that the desired number of replicas are running at all times.

Here's an example Deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: example-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: example-app
  template:
    metadata:
      labels:
        app: example-app
    spec:
      containers:
        - name: example-container
          image: nginx
```

In this example:

- The `replicas: 3` ensures three instances of the container are running.
- If a Pod fails, Kubernetes will automatically create a new one to maintain the desired state.

### Configure Resource Requests and Limits

Resource limits help prevent containers from being terminated due to resource exhaustion. Define `resources` in your container specification:

```yaml
resources:
  requests:
    memory: '128Mi'
    cpu: '500m'
  limits:
    memory: '256Mi'
    cpu: '1000m'
```

This configuration ensures your container has enough resources to run reliably.

### Use Liveness and Readiness Probes

Probes help Kubernetes detect and recover from application failures. Define probes in your container specification:

```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 3
  periodSeconds: 5
readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  initialDelaySeconds: 3
  periodSeconds: 5
```

In this example:

- The `livenessProbe` checks if the container is still running.
- The `readinessProbe` checks if the container is ready to serve traffic.

### Use Persistent Volumes for State

If your application requires persistent data, use Persistent Volumes (PVs) and Persistent Volume Claims (PVCs) to ensure data is not lost when containers restart.

Here's an example:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: example-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
```

Attach the PVC to your Pod:

```yaml
volumes:
  - name: example-volume
    persistentVolumeClaim:
      claimName: example-pvc
containers:
  - name: example-container
    image: nginx
    volumeMounts:
      - mountPath: /data
        name: example-volume
```

This configuration ensures your application can recover with its data intact.

## Best Practices

- **Monitor Logs**: Use `kubectl logs` to debug issues when containers stop running.
- **Use Health Checks**: Define liveness and readiness probes to detect and recover from failures.
- **Scale Appropriately**: Use Deployments to maintain multiple replicas for high availability.
- **Test Configurations**: Verify your configurations in a staging environment before deploying to production.

## Conclusion

By following these configurations and best practices, you can ensure your containers stay running on Kubernetes, providing reliable service to your users.


## Related Resources

- [Why Does a Pod Get Recreated When Deleted?](/posts/why-does-kubernetes-pod-get-recreated-when-deleted)
- [Pods CrashLoopBackOff: No Logs](/posts/kubernetes-pods-crashloopbackoff-no-logs)
- [Introduction to Kubernetes: Pods](/guides/introduction-to-kubernetes)
- [Kubernetes Quiz](/quizzes/kubernetes-quiz)
