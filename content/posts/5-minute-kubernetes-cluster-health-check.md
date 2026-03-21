---
title: 'The 5-Minute Kubernetes Cluster Health Check'
excerpt: "Learn how to quickly assess your Kubernetes cluster's health with essential commands and catch issues before they become critical problems."
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2025-08-12'
publishedAt: '2025-08-12T09:00:00Z'
updatedAt: '2025-08-12T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Kubernetes
  - Monitoring
  - Troubleshooting
  - DevOps
  - kubectl
---

## TLDR

You can check your Kubernetes cluster's health in under 5 minutes using five key commands: checking node status, monitoring resource usage, reviewing pod health across namespaces, investigating problem pods, and examining cluster events. This quick routine helps catch issues before they escalate into critical problems.

Kubernetes is great until it's not. One bad node, a pod stuck in CrashLoopBackOff, or a resource spike can ruin your day. The good news? You don't need to spend an hour digging through dashboards to spot trouble early. With a few quick commands, you can get a solid read on your cluster's health in under 5 minutes.

Here's how to do it effectively.

## Make Sure Your Nodes Are Happy

Start by checking the overall status of your cluster nodes. This gives you the foundation-level health of your infrastructure.

```bash
kubectl get nodes -o wide
```

This command displays all nodes in your cluster along with their detailed information. You'll see each node's status, roles, age, version, internal and external IPs, OS image, kernel version, and container runtime.

What you want to see:

- **STATUS** should be `Ready` for all nodes
- No mystery nodes suddenly showing up in your cluster
- Roles, IPs, and ages that make sense for your environment

If you spot `NotReady`, that's your cue to dig deeper. A node in this state might be experiencing network issues, resource exhaustion, or kubelet problems.

## Check Resource Usage at a Glance

Next, get a quick overview of resource consumption across your nodes to identify potential bottlenecks.

```bash
kubectl top nodes
```

This command shows CPU and memory usage for each node in your cluster. It provides both absolute values and percentages, making it easy to spot resource pressure.

Keep an eye out for:

- CPU or memory regularly above 80% on any node
- One node doing all the heavy lifting while others are barely working
- Sudden spikes that don't match your expected workload patterns

No `metrics-server` running? Install it with this command:

```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

The metrics-server is essential for resource monitoring and is required for horizontal pod autoscaling to work properly.

## Look at All Pods Across All Namespaces

Get a bird's-eye view of all pods running in your cluster to quickly identify any that are misbehaving.

```bash
kubectl get pods --all-namespaces
```

This command lists every pod across all namespaces, showing their current status, restart count, and age. It's like taking the pulse of your entire application ecosystem.

Healthy pods should be `Running` or `Completed`. If you see states like `CrashLoopBackOff`, `ImagePullBackOff`, `Pending`, or `Error`, note the namespace and pod name for further investigation.

Also watch the **RESTARTS** column closely. If a pod has restarted a dozen times in the last hour, something's definitely off. Frequent restarts often indicate:

- Application crashes due to bugs or configuration issues
- Failing health checks (readiness or liveness probes)
- Resource limits being exceeded
- Dependencies being unavailable

## Zoom In on Problem Pods

When you spot problematic pods, dig deeper to understand what's causing the issues.

```bash
kubectl describe pod <pod-name> -n <namespace>
```

Replace `<pod-name>` and `<namespace>` with the actual values from your problem pods. This command provides detailed information about the pod's configuration, current state, and recent events.

Check for these common issues:

- **Events at the bottom** (often the smoking gun that reveals the root cause)
- **Failing readiness or liveness probes** that prevent the pod from receiving traffic
- **Image pull errors** indicating registry access problems or incorrect image names
- **Resource limit issues** where the pod exceeds its memory or CPU constraints

The events section is particularly valuable because it shows a chronological history of what happened to the pod, including scheduling decisions, volume mounts, and error conditions.

## Check the Cluster's Event Log

Get insight into what's been happening across your entire cluster by examining recent events.

```bash
kubectl get events --sort-by=.metadata.creationTimestamp
```

This command shows cluster-wide events sorted by when they occurred, giving you a timeline of recent activity. Events provide context about system-level operations and can reveal patterns or issues that affect multiple components.

Events will tell you what's been happening behind the scenes:

- Failed volume mounts that prevent pods from starting
- DNS resolution errors affecting service communication
- Scheduling issues when pods can't be placed on nodes
- Node pressure warnings indicating resource constraints

## Try k9s for a Better View

If you want something more interactive than command-line tools, give **[k9s](https://k9scli.io/)** a try. It's a terminal-based UI for Kubernetes that provides real-time cluster information in an intuitive interface.

k9s lets you browse resources, view logs, and drill into problems without typing long commands. You can navigate between different resource types using simple keystrokes, filter resources, and even perform actions like scaling deployments or deleting pods.

Once you try k9s, it's hard to go back to plain kubectl for exploratory tasks. It's particularly useful when you need to quickly jump between different namespaces or resource types during troubleshooting.

Five minutes a day is all it takes to stay ahead of most cluster problems. Make this health check part of your daily routine and you'll catch issues before they blow up and before your pager goes off at 3 a.m. Regular monitoring helps you understand your cluster's normal behavior, making it easier to spot anomalies when they occur.


## Related Resources

- [Checking Pod CPU and Memory](/posts/checking-kubernetes-pod-cpu-and-memory-utilization)
- [Kubernetes List All Pods and Nodes](/posts/kubernetes-list-all-pods-and-nodes)
- [Introduction to Kubernetes: Monitoring](/guides/introduction-to-kubernetes)
- [Kubernetes Quiz](/quizzes/kubernetes-quiz)
- [DevOps Roadmap](/roadmap)
