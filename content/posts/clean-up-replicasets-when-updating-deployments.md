---
title: 'How to Clean Up ReplicaSets When Updating Kubernetes Deployments'
excerpt: 'Learn how and when to clean up old ReplicaSets after updating Kubernetes Deployments, why they accumulate, and how to manage rollout history for a tidy cluster.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2024-09-28'
publishedAt: '2024-09-28T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Kubernetes
  - Deployments
  - ReplicaSets
  - Rollouts
  - DevOps
---

When you update a Kubernetes Deployment, the system creates new ReplicaSets to manage the new version of your pods, but it keeps the old ReplicaSets by default. Over time, these can pile up and clutter your cluster. In this guide, you'll learn why this happens, how to control the number of old ReplicaSets, and how to clean them up safely.

## Prerequisites

You'll need:

- Access to a Kubernetes cluster
- `kubectl` installed and configured
- Familiarity with Deployments and ReplicaSets

## Why Do Old ReplicaSets Accumulate?

Kubernetes Deployments keep old ReplicaSets so you can roll back to previous versions if needed. Each time you update a Deployment (for example, by changing the image), a new ReplicaSet is created, but the old ones are retained for rollback and history.

## How to View Old ReplicaSets

To see all ReplicaSets for a Deployment:

```bash
kubectl get rs -n <namespace> --selector=app=<your-app>
```

Or, to see all ReplicaSets in a namespace:

```bash
kubectl get rs -n <namespace>
```

## Controlling ReplicaSet History with revisionHistoryLimit

You can tell Kubernetes how many old ReplicaSets to keep by setting the `revisionHistoryLimit` field in your Deployment spec. The default is 10.

**Example:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-deployment
spec:
  revisionHistoryLimit: 3
  # ...existing deployment spec...
```

This keeps only the 3 most recent old ReplicaSets. Older ones are cleaned up automatically.

## Manually Deleting Old ReplicaSets

If you want to clean up old ReplicaSets right away, you can delete them manually:

```bash
kubectl delete rs <replicaset-name> -n <namespace>
```

Make sure the ReplicaSet is not needed for rollback before deleting it.

## Why Not Delete All Old ReplicaSets?

Keeping some history is useful for quick rollbacks if a deployment goes wrong. Only reduce or delete old ReplicaSets if you're confident you won't need to revert to those versions.

## Next Steps

Review your deployments and set an appropriate `revisionHistoryLimit` to keep your cluster tidy. Automate cleanup as part of your deployment process if needed, and monitor your ReplicaSets to avoid unnecessary resource usage as your application evolves.
