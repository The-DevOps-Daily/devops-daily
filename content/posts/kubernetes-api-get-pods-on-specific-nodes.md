---
title: 'Kubernetes API - Get Pods on Specific Nodes'
excerpt: 'Learn how to use the Kubernetes API to retrieve Pods running on specific nodes in your cluster.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2024-06-15'
publishedAt: '2024-06-15T09:00:00Z'
updatedAt: '2024-06-15T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Kubernetes
  - API
  - Nodes
  - Pods
---

## Introduction

Retrieving Pods running on specific nodes in a Kubernetes cluster can be useful for debugging and resource management. In this guide, you'll learn how to use the Kubernetes API to filter Pods by node.

## Prerequisites

Before proceeding, make sure:

- You have `kubectl` installed and configured.
- You have access to the Kubernetes API.

## Using the Kubernetes API

### List Pods with Node Information

To list Pods along with their node information, use:

```bash
kubectl get pods -o wide
```

This command displays additional details, including the node where each Pod is running.

### Filter Pods by Node

To filter Pods running on a specific node, use:

```bash
kubectl get pods --field-selector spec.nodeName=<node-name>
```

Replace `<node-name>` with the name of the node you want to filter by.

### Example

Suppose you want to retrieve Pods running on a node named `worker-node-1`. Run the following command:

```bash
kubectl get pods --field-selector spec.nodeName=worker-node-1
```

This lists all Pods running on `worker-node-1`.

### Using the Kubernetes API Directly

You can also use the Kubernetes API directly to query Pods by node. Here's an example using `curl`:

```bash
curl -k -H "Authorization: Bearer <token>" \
https://<api-server>/api/v1/pods?fieldSelector=spec.nodeName=<node-name>
```

Replace `<token>` with your API token, `<api-server>` with the API server URL, and `<node-name>` with the node name.

## Best Practices

- **Use Labels**: Label nodes and Pods for easier filtering.
- **Monitor Resources**: Use tools like `kubectl top` to monitor resource usage on nodes.
- **Automate Queries**: Use scripts or tools like `kubectl` plugins for frequent queries.

## Conclusion

Using the Kubernetes API to retrieve Pods on specific nodes is a powerful way to manage and debug your cluster. By following these steps, you can efficiently filter and monitor Pods.


## Related Resources

- [Kubernetes List All Pods and Nodes](/posts/kubernetes-list-all-pods-and-nodes)
- [5-Minute Cluster Health Check](/posts/5-minute-kubernetes-cluster-health-check)
- [Introduction to Kubernetes Guide](/guides/introduction-to-kubernetes)
- [Kubernetes Flashcards](/flashcards/kubernetes-basics)
