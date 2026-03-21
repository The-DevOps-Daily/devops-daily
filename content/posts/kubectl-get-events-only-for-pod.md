---
title: 'How to Get Events Only for a Pod with kubectl'
excerpt: 'Learn how to filter and view Kubernetes events for a specific pod using kubectl, with practical examples for troubleshooting and automation.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2024-03-15'
publishedAt: '2024-03-15T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Kubernetes
  - kubectl
  - Events
  - Pods
  - Troubleshooting
---

Kubernetes events are a valuable resource for troubleshooting issues with your pods. Sometimes, you want to see only the events related to a specific pod, rather than sifting through all cluster events.

In this guide, you'll learn how to filter and view events for a single pod using `kubectl` and command-line tools.

## Prerequisites

You'll need:

- Access to a Kubernetes cluster
- `kubectl` installed and configured

## Why Filter Events for a Pod?

When debugging, it's helpful to focus on just the events for the pod in question. This can reveal scheduling problems, image pull errors, restarts, or other issues that might not show up in pod logs.

## Get Events for a Specific Pod

You can use `kubectl get events` with a field selector to filter events for a specific pod. Replace `<pod-name>` and `<namespace>` as needed:

```bash
kubectl get events --field-selector involvedObject.name=<pod-name> -n <namespace>
```

This command lists all events where the `involvedObject.name` matches your pod. It's a clean way to see only relevant events.

## Sort Events by Timestamp

To see the most recent events first, add the `--sort-by` flag:

```bash
kubectl get events --field-selector involvedObject.name=<pod-name> -n <namespace> --sort-by='.lastTimestamp'
```

This helps you quickly spot the latest issues or changes affecting your pod.

## Example: Filtering Events for a Pod Named `web-1234`

```bash
kubectl get events --field-selector involvedObject.name=web-1234 -n default --sort-by='.lastTimestamp'
```

This will show only the events for the `web-1234` pod in the `default` namespace, sorted by time.

## Why Not Use grep?

While you can pipe `kubectl get events` output to `grep`, using field selectors is more reliable and avoids missing structured data or mis-parsing columns.

## Next Steps

Try combining event filtering with other `kubectl` commands for deeper troubleshooting. Explore how to use label selectors and JSONPath for more advanced queries as your cluster grows.
