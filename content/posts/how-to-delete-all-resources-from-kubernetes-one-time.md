---
title: 'How to Delete All Resources from Kubernetes at One Time'
excerpt: 'Delete every resource in a Kubernetes namespace or whole cluster with kubectl. Covers kubectl delete all, namespace deletion, and cleaning up CRDs safely.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2024-07-01'
publishedAt: '2024-07-01T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Kubernetes
  - Resources
  - Cleanup
  - DevOps
---

## Introduction

Managing resources in Kubernetes often involves creating, updating, and deleting them. Sometimes, you may need to delete all resources in a namespace or even the entire cluster. This guide will walk you through the process of deleting all resources efficiently using `kubectl` commands.

## Prerequisites

Before proceeding, make sure:

- You have `kubectl` installed and configured.
- You have access to the Kubernetes cluster.
- You understand the impact of deleting resources, as this action is irreversible.

## Deleting All Resources in a Namespace

### Using `kubectl delete all`

To delete all resources in a specific namespace, use the following command:

```bash
kubectl delete all --all -n <namespace>
```

Replace `<namespace>` with the name of the namespace you want to clean up.

### Example

Suppose you want to delete all resources in the `default` namespace. Run:

```bash
kubectl delete all --all -n default
```

This command deletes all resources, including Pods, Services, Deployments, and more, in the `default` namespace.

### Verify Deletion

After running the command, verify that the namespace is empty:

```bash
kubectl get all -n <namespace>
```

If no resources are listed, the namespace has been successfully cleaned up.

## Deleting All Resources in the Cluster

### Using `kubectl delete` with `--all`

To delete all resources across the entire cluster, use:

```bash
kubectl delete all --all
```

This command deletes all resources in all namespaces.

### Example

Run the following command to clean up the entire cluster:

```bash
kubectl delete all --all
```

### Warning

Deleting all resources in the cluster is a destructive action. Ensure you have backups or snapshots of critical resources before proceeding.

## Best Practices

- **Use Namespaces**: Organize resources into namespaces to simplify cleanup.
- **Backup Data**: Always back up critical resources before deletion.
- **Test Commands**: Use `kubectl get` commands to preview resources before deleting them.

## Conclusion

Deleting all resources in Kubernetes can be done efficiently using `kubectl` commands. By following these steps, you can clean up namespaces or entire clusters while minimizing risks.


## Related Resources

- [Switch Namespace in Kubernetes](/posts/switch-namespace-in-kubernetes)
- [Fix Pods Stuck Terminating](/posts/fix-pods-stuck-terminating-kubernetes)
- [Introduction to Kubernetes Guide](/guides/introduction-to-kubernetes)
- [Kubernetes Quiz](/quizzes/kubernetes-quiz)
