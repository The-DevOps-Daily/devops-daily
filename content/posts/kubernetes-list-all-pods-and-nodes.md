---
title: 'How to List All Pods and Their Nodes in Kubernetes'
excerpt: "Learn how to list all pods in your Kubernetes cluster along with the nodes they're running on, using kubectl and command-line tools for clear, actionable output."
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2024-11-10'
publishedAt: '2024-11-10T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Kubernetes
  - Pods
  - Nodes
  - kubectl
  - DevOps
---

When managing a Kubernetes cluster, it's often helpful to see which pods are running on which nodes. This is useful for troubleshooting, capacity planning, and understanding your cluster's workload distribution.

In this guide, you'll learn how to list all pods and the nodes they're assigned to using `kubectl` and a few handy command-line tricks.

## Prerequisites

You'll need:

- Access to a Kubernetes cluster
- `kubectl` installed and configured

## List Pods with Their Nodes Using kubectl

The quickest way to see pods and their nodes is with:

```bash
kubectl get pods -o wide -n <namespace>
```

This command adds a `NODE` column to the output, showing where each pod is running. To see all namespaces, use:

```bash
kubectl get pods -o wide --all-namespaces
```

## Custom Output with kubectl and awk

For a cleaner, more scriptable output, you can combine `kubectl` with `awk`:

```bash
kubectl get pods -o=custom-columns=NAME:.metadata.name,NAMESPACE:.metadata.namespace,NODE:.spec.nodeName --all-namespaces
```

This prints just the pod name, namespace, and node name for every pod in the cluster.

## Example Output

```
NAME           NAMESPACE     NODE
web-1234       default       node-1
api-5678       staging       node-2
db-9012        prod          node-3
```

## Why This Matters

Knowing which pods run on which nodes helps you:

- Debug node-specific issues
- Spot uneven workload distribution
- Plan for scaling or maintenance

## Next Steps

Try combining these commands with label selectors or JSONPath queries for more advanced filtering. As your cluster grows, consider using monitoring tools like Lens or K9s for a more visual overview of pod placement.


## Related Resources

- [How to List All Containers in a Pod](/posts/how-to-list-all-containers-in-kubernetes-pod)
- [5-Minute Cluster Health Check](/posts/5-minute-kubernetes-cluster-health-check)
- [Checking Pod CPU and Memory](/posts/checking-kubernetes-pod-cpu-and-memory-utilization)
- [Introduction to Kubernetes Guide](/guides/introduction-to-kubernetes)
