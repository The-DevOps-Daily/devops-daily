---
title: Introduction to Kubernetes
seoTitle: 'Kubernetes Tutorial for Beginners: Learn Kubernetes Hands-On'
description: 'Learn Kubernetes 1.37 hands-on with kind: pods, Deployments, Services, Gateway API, ConfigMaps, Secrets, storage, autoscaling, monitoring and security.'
category:
  name: Kubernetes
  slug: kubernetes
publishedAt: '2025-05-17'
updatedAt: '2026-10-24'
author:
  name: DevOps Daily Team
  slug: devops-daily-team
tags:
  - Kubernetes
  - kubectl
  - Containers
  - Gateway API
  - Helm
  - DevOps
---

**Kubernetes** runs containers across a group of machines and keeps them running the way you describe. You write down the state you want, for example "three copies of this web app, reachable on port 80, with 64 MiB of memory each", and Kubernetes starts the containers, spreads them over the machines, restarts them when they crash, replaces them when a machine dies and rolls out new versions without downtime. Every major cloud sells it as a managed service, and the same YAML runs on your laptop.

This guide teaches Kubernetes by building one small application on a cluster on your own computer. The app is [podinfo](https://github.com/stefanprodan/podinfo), a tiny Go web service made for Kubernetes demos, with a [Valkey](https://valkey.io/) cache next to it. Every part adds a piece: a pod, a Deployment with rolling updates, a Service and a Gateway, configuration and a TLS certificate, a volume, autoscaling, monitoring and, at the end, the security settings that production needs.

```diagram
{
  "type": "infra",
  "flow": [
    { "label": "You", "sub": "kubectl", "icon": "cpu", "tone": "slate" },
    { "label": "Gateway", "sub": "HTTPRoute", "icon": "globe", "tone": "green" },
    { "label": "podinfo", "sub": "3 pods", "icon": "pod", "tone": "blue" },
    { "label": "cache", "sub": "Valkey + volume", "icon": "database", "tone": "violet" }
  ],
  "groups": [
    {
      "label": "kind cluster k8s-guide",
      "sub": "3 Docker containers",
      "icon": "k8s",
      "tone": "blue",
      "groups": [
        {
          "label": "control plane node",
          "icon": "server",
          "tone": "slate",
          "nodes": [
            { "label": "API server", "icon": "gear", "tone": "slate" },
            { "label": "etcd", "icon": "database", "tone": "slate" },
            { "label": "scheduler", "icon": "gear", "tone": "slate" }
          ]
        },
        {
          "label": "namespace demo",
          "sub": "on two worker nodes",
          "icon": "box",
          "tone": "accent",
          "nodes": [
            { "label": "Deployment", "sub": "podinfo", "icon": "pod", "tone": "blue" },
            { "label": "Service", "sub": "podinfo", "icon": "net", "tone": "green" },
            { "label": "StatefulSet", "sub": "cache", "icon": "database", "tone": "violet" }
          ]
        }
      ]
    }
  ]
}
```

Every `kubectl` output in this guide is real. It comes from a public companion repository whose GitHub Actions workflow created the same kind cluster and ran each part's commands on 24 October 2026. You can clone it instead of copying the manifests from the pages:

```github
The-DevOps-Daily/guide-kubernetes-demo-2026-10-24
```

Your pod names, IP addresses, ages and timings will differ from the ones shown, because Kubernetes generates them on every run.

## What You Will Learn

| Part                                                                                                    | What you do                                                                                             |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [1. Architecture](/guides/introduction-to-kubernetes/01-kubernetes-architecture-and-components)         | See the control plane and node components, and follow one `kubectl` command through all of them         |
| [2. Set up a cluster](/guides/introduction-to-kubernetes/02-setting-up-a-kubernetes-cluster)            | Install kubectl, kind and Helm, create a three-node cluster, and learn contexts and namespaces          |
| [3. Pods](/guides/introduction-to-kubernetes/03-pods-and-containers-in-kubernetes)                      | Run, inspect and debug a pod, add health probes, an init container and a native sidecar                 |
| [4. Deployments](/guides/introduction-to-kubernetes/04-deployments-and-replicasets)                     | Scale, update and roll back, watch a broken rollout stop safely, and run Jobs and CronJobs              |
| [5. Services and networking](/guides/introduction-to-kubernetes/05-services-and-networking)             | Give the app a stable address and DNS name, expose it with Gateway API and split traffic for a canary   |
| [6. ConfigMaps and Secrets](/guides/introduction-to-kubernetes/06-configmaps-and-secrets)               | Configure the app and the cache, mount a TLS key pair, and see why Secrets do not belong in env vars    |
| [7. Persistent storage](/guides/introduction-to-kubernetes/07-persistent-storage-in-kubernetes)         | Lose data on purpose, then keep it with a PersistentVolumeClaim and a StatefulSet                       |
| [8. Resources and scaling](/guides/introduction-to-kubernetes/08-resource-management-and-scaling)       | Set requests and limits, resize a pod in place, add quotas and an autoscaler, and drain a node          |
| [9. Monitoring and logging](/guides/introduction-to-kubernetes/09-monitoring-and-logging-in-kubernetes) | Debug three broken workloads, use ephemeral debug containers, and alert with Prometheus                 |
| [10. Security and best practices](/guides/introduction-to-kubernetes/10-best-practices-in-kubernetes)   | Apply Pod Security, RBAC, NetworkPolicies and admission policies, and check the cluster with kube-bench |

## Which Versions This Guide Uses

The guide was updated on 24 October 2026 for **Kubernetes 1.37** (released on 26 August 2026), with **kind v0.33.0**, **kubectl v1.37.1** and **Helm v4.3.1**. The app images are `ghcr.io/stefanprodan/podinfo:6.15.0` and `valkey/valkey:9.1.2-alpine`.

Kubernetes ships three minor releases a year, and the project supports each one for about 14 months. On the day of this update, the supported releases were 1.37 (end of life 28 October 2027), 1.36 (28 June 2027) and 1.35 (28 February 2027); 1.34 reaches its end of life on 27 October 2026. Everything in this guide works on 1.35 and newer unless a section says otherwise.

What is a real run and what is an example:

- **Real runs**: every command that talks to the local kind cluster, including the output of `kind`, `kubectl`, `helm`, `curl`, `openssl`, `cosign` and kube-bench. Every manifest you apply is a file in the companion repository, which also sends each one to the API server as a server-side dry run with strict field validation.
- **Examples**: commands that need a cloud account or a separate machine (DigitalOcean Kubernetes, EKS, GKE, AKS, kubeadm on your own servers), and manifests for things the kind cluster does not run (cloud StorageClasses, the External Secrets Operator, the Vertical Pod Autoscaler, volume snapshots, an audit policy). The guide labels each one. Apart from the audit policy, the dry run checks these manifests too, against the real CRDs of those tools.

If you learned Kubernetes from an older tutorial, these changes matter most:

| Then                                                     | Now                                                                                      | Since                         |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------- |
| Docker Engine as the container runtime (dockershim)      | containerd or CRI-O through the CRI; images built with Docker still run unchanged        | 1.24 (May 2022)               |
| PodSecurityPolicy                                        | Pod Security Admission with namespace labels, plus admission policies                    | removed in 1.25 (August 2022) |
| `apt.kubernetes.io` and `yum.kubernetes.io` repositories | `pkgs.k8s.io`, one repository per minor version                                          | old ones gone 4 March 2024    |
| `autoscaling/v2beta2` HorizontalPodAutoscaler            | `autoscaling/v2`                                                                         | v2beta2 removed in 1.26       |
| Sidecars as ordinary extra containers                    | Native sidecars: init containers with `restartPolicy: Always`                            | stable in 1.33 (April 2025)   |
| Delete and recreate a pod to change its CPU or memory    | In-place pod resize with `kubectl patch --subresource resize`                            | stable in 1.35                |
| `Endpoints` objects                                      | `EndpointSlice` objects; `kubectl get endpoints` prints a deprecation warning            | deprecated in 1.33            |
| Ingress with the ingress-nginx controller                | Gateway API; ingress-nginx was retired on 24 March 2026 and gets no more fixes           | Gateway API v1.0 (2023)       |
| cgroup v1 nodes                                          | cgroup v2; the kubelet refuses to start on cgroup v1 unless you opt out                  | 1.35                          |
| containerd 1.7                                           | containerd 2.x                                                                           | required from 1.36            |
| Helm 3                                                   | Helm 4 (server-side apply by default); Helm 3 gets security fixes until 10 February 2027 | Helm 4.0 (November 2025)      |

## Prerequisites

- A computer with Linux, macOS or Windows and at least 4 CPU cores and 8 GB of memory. The cluster in this guide is three containers, and Part 9 adds a monitoring stack.
- [Docker](https://docs.docker.com/get-started/get-docker/) (Docker Desktop on macOS and Windows) or Podman, because kind runs each Kubernetes node as a container. The [Introduction to Docker](/guides/introduction-to-docker) guide covers containers and images.
- A terminal, Git, `curl`, `jq` and `openssl`. The [Introduction to Linux](/guides/introduction-to-linux) guide covers the shell basics.
- For the managed-cluster examples only: an account with a cloud provider.

## Practice Hands-On

Try `kubectl` in your browser with the [Kubernetes terminal simulator](/games/kubernetes-terminal-simulator), see how the scheduler places pods in the [Kubernetes scheduler simulator](/games/k8s-scheduler) and how traffic moves between pods in the [Kubernetes networking simulator](/games/kubernetes-networking-cni-simulator). Then test yourself with the [Kubernetes quiz](/quizzes/kubernetes-quiz) and the [Kubernetes flashcards](/flashcards/kubernetes-basics).

## Keep Learning

- [How I Finally Understood Docker and Kubernetes](/posts/how-i-finally-understood-docker-and-kubernetes)
- [Docker Swarm vs Kubernetes](/comparisons/docker-swarm-vs-kubernetes) and [Helm vs Kustomize](/comparisons/helm-vs-kustomize)
- [Kubernetes Security Checklist](/checklists/kubernetes-security)
- [Container orchestration interview questions](/interview-questions/junior/container-orchestration-basics)

Start with [Part 1: Kubernetes Architecture](/guides/introduction-to-kubernetes/01-kubernetes-architecture-and-components), or go straight to [setting up a cluster](/guides/introduction-to-kubernetes/02-setting-up-a-kubernetes-cluster) if you know the concepts.
