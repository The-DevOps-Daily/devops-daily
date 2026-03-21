---
title: 'Checking Kubernetes Pod CPU and Memory Utilization'
excerpt: 'Learn how to monitor CPU and memory usage of Kubernetes Pods using kubectl and metrics-server.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2024-07-10'
publishedAt: '2024-07-10T09:00:00Z'
updatedAt: '2024-07-10T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Kubernetes
  - Monitoring
  - Metrics
  - DevOps
---

## Introduction

Monitoring the CPU and memory utilization of Kubernetes Pods is essential for optimizing resource usage and troubleshooting performance issues. In this guide, you'll learn how to use `kubectl` and metrics-server to check resource utilization.

## Prerequisites

Before proceeding, make sure:

- You have `kubectl` installed and configured.
- Metrics-server is deployed in your Kubernetes cluster.

## Checking Pod Resource Utilization

### Using `kubectl top`

The `kubectl top` command provides real-time metrics for Pods and nodes. To check the resource utilization of Pods, use:

```bash
kubectl top pod -n <namespace>
```

Replace `<namespace>` with the name of the namespace.

### Example

Suppose you want to check the resource utilization of Pods in the `default` namespace. Run:

```bash
kubectl top pod -n default
```

This command displays the CPU and memory usage of all Pods in the `default` namespace.

### Output Explanation

The output includes:

- **Pod Name**: Name of the Pod.
- **CPU Usage**: CPU usage in millicores (m).
- **Memory Usage**: Memory usage in MiB.

### Using `kubectl describe`

For detailed information about a specific Pod, use:

```bash
kubectl describe pod <pod-name> -n <namespace>
```

Replace `<pod-name>` with the name of the Pod and `<namespace>` with the namespace.

### Example

To describe a Pod named `example-pod` in the `default` namespace, run:

```bash
kubectl describe pod example-pod -n default
```

This command provides detailed information, including resource requests and limits.

## Best Practices

- **Set Resource Limits**: Define resource requests and limits in Pod specifications to prevent resource exhaustion.
- **Monitor Regularly**: Use tools like Prometheus and Grafana for continuous monitoring.
- **Optimize Resources**: Adjust resource requests and limits based on utilization data.

## Conclusion

Monitoring CPU and memory utilization of Kubernetes Pods is crucial for maintaining cluster performance. By using `kubectl top` and metrics-server, you can efficiently track resource usage and optimize your applications.


## Related Resources

- [5-Minute Kubernetes Cluster Health Check](/posts/5-minute-kubernetes-cluster-health-check)
- [Right-Sizing Kubernetes Resources](/posts/right-sizing-kubernetes-resources-vpa-karpenter)
- [Introduction to Kubernetes: Resource Management](/guides/introduction-to-kubernetes)
- [Kubernetes HPA Lab Exercise](/exercises/kubernetes-hpa-lab)
- [Kubernetes Quiz](/quizzes/kubernetes-quiz)
