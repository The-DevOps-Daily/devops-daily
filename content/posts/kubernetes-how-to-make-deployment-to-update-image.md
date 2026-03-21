---
title: 'Kubernetes: How to Make Deployment to Update Image'
excerpt: 'Learn how to update the container image in a Kubernetes Deployment using kubectl commands.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2024-08-20'
publishedAt: '2024-08-20T09:00:00Z'
updatedAt: '2024-08-20T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Kubernetes
  - Deployments
  - Images
  - DevOps
---

## Introduction

Updating the container image in a Kubernetes Deployment is a common task during application updates. In this guide, you'll learn how to use `kubectl` commands to update the image efficiently.

## Prerequisites

Before proceeding, make sure:

- You have `kubectl` installed and configured.
- You have access to the Kubernetes cluster.

## Updating the Image

### Using `kubectl set image`

The `kubectl set image` command allows you to update the container image in a Deployment. Here's the syntax:

```bash
kubectl set image deployment/<deployment-name> <container-name>=<new-image>
```

### Example

Suppose you have a Deployment named `example-deployment` with a container named `example-container`. To update the image to `nginx:latest`, run:

```bash
kubectl set image deployment/example-deployment example-container=nginx:latest
```

This updates the container image to `nginx:latest`.

### Verify the Update

To verify the update, use:

```bash
kubectl rollout status deployment/<deployment-name>
```

Replace `<deployment-name>` with the name of your Deployment.

### Rollback Changes

If the update causes issues, rollback to the previous version using:

```bash
kubectl rollout undo deployment/<deployment-name>
```

## Best Practices

- **Use Tags**: Use versioned tags for images to avoid unexpected updates.
- **Monitor Rollouts**: Use `kubectl rollout status` to monitor updates.
- **Test Updates**: Verify updates in a staging environment before deploying to production.

## Conclusion

Updating the container image in a Kubernetes Deployment is straightforward with `kubectl set image`. By following these steps, you can ensure smooth and reliable application updates.


## Related Resources

- [Force Kubernetes to Repull Image](/posts/force-kubernetes-repull-image)
- [Kubernetes Deployments vs StatefulSets](/posts/kubernetes-deployments-vs-statefulsets)
- [Introduction to Kubernetes: Deployments](/guides/introduction-to-kubernetes)
- [Kubernetes Flashcards](/flashcards/kubernetes-basics)
