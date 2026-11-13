---
title: 'Kubernetes API - Get Pods on Specific Nodes'
excerpt: 'Learn how to list the pods on one node, or every pod with its node, with kubectl field selectors, custom columns and direct calls to the Kubernetes API.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2024-06-15'
publishedAt: '2024-06-15T09:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Kubernetes
  - API
  - Nodes
  - Pods
  - kubectl
---

## Introduction

Before you drain a node, debug a node that is slow, or check how the scheduler spread your replicas, you need to know which pods run where. Every pod records its node in `spec.nodeName`, and the Kubernetes API can filter on that field on the server. In this guide, you'll learn how to get the pods on one node with `kubectl` and with the API directly, and how to list every pod in the cluster together with its node.

## TL;DR

- Pods on one node, all namespaces: `kubectl get pods -A --field-selector spec.nodeName=worker-node-1`
- Every pod with its node: `kubectl get pods -A -o wide`
- The same filter in the API: `GET /api/v1/pods?fieldSelector=spec.nodeName%3Dworker-node-1`

## Prerequisites

Before proceeding, make sure:

- You have `kubectl` installed and configured.
- Your user can list pods in all namespaces. With access to one namespace only, replace `-A` with `-n <namespace>`.
- `jq` is installed for the examples that process JSON.

## Using the Kubernetes API

### List Pods with Node Information

To list Pods along with their node information, use:

```bash
kubectl get pods -o wide
```

The `-o wide` output adds the `IP`, `NODE`, `NOMINATED NODE` and `READINESS GATES` columns. Like every `kubectl get` for namespaced objects, it shows only the namespace of your current context unless you add `-A`.

### Filter Pods by Node

To get the Pods running on a specific node, use a field selector:

```bash
kubectl get pods -A --field-selector spec.nodeName=<node-name>
```

Replace `<node-name>` with the name from `kubectl get nodes`. The API server does the filtering, so this is fast even in a large cluster.

Do not leave out `-A`. Without it, the command lists only the pods of your current namespace on that node, and system pods such as the CNI agent or kube-proxy are missing from the result.

### Example

To retrieve all Pods running on a node named `worker-node-1`, and only the ones that are running, combine two field selectors:

```bash
kubectl get pods -A -o wide --field-selector spec.nodeName=worker-node-1,status.phase=Running
```

Field selectors for pods support only some fields, for example `spec.nodeName`, `status.phase`, `metadata.name`, `metadata.namespace`, `spec.serviceAccountName` and `status.podIP`. For other pod fields, use `-o json` and `jq`. Pod objects do not contain the labels of their node: to select pods by a node label, get the node names first with `kubectl get nodes -l <label>=<value> -o name`, and query each node.

`kubectl describe node worker-node-1` lists the pods on the node that have not finished under `Non-terminated Pods`, with the CPU and memory requests and limits of each one, and the totals under `Allocated resources`.

### Using the Kubernetes API Directly

`kubectl get --raw` sends a request to the API server with your kubeconfig credentials. Encode the `=` in the field selector as `%3D` and put the URL in quotes:

```bash
kubectl get --raw "/api/v1/pods?fieldSelector=spec.nodeName%3Dworker-node-1" \
  | jq -r '.items[] | "\(.metadata.namespace)/\(.metadata.name)"'
```

To call the API from a script without kubectl, use a ServiceAccount token and verify the server certificate. Do not use `curl -k`, which accepts any certificate:

```bash
APISERVER=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')
kubectl config view --raw --minify --flatten \
  -o jsonpath='{.clusters[0].cluster.certificate-authority-data}' | base64 -d > ca.crt
TOKEN=$(kubectl create token pod-reader -n monitoring)  # a ServiceAccount that may list pods

curl --cacert ca.crt -H "Authorization: Bearer $TOKEN" \
  "$APISERVER/api/v1/pods?fieldSelector=spec.nodeName%3Dworker-node-1"
```

Inside a pod, the token and CA are already mounted under `/var/run/secrets/kubernetes.io/serviceaccount/`, and the API server is `https://kubernetes.default.svc`. The ServiceAccount needs a ClusterRole with `list` on `pods` to read every namespace.

The client libraries accept the same selector. With the official Python client:

```python
from kubernetes import client, config

config.load_kube_config()  # use config.load_incluster_config() inside a pod
pods = client.CoreV1Api().list_pod_for_all_namespaces(
    field_selector="spec.nodeName=worker-node-1"
)
for pod in pods.items:
    print(pod.metadata.namespace, pod.metadata.name, pod.status.phase)
```

## How Do I List All Pods and Their Nodes?

For a quick look, `-o wide` across all namespaces is enough:

```bash
kubectl get pods -A -o wide
```

For a short table that is easy to read or to use in a script, choose the columns yourself and sort by node:

```bash
kubectl get pods -A --sort-by=.spec.nodeName \
  -o custom-columns='NODE:.spec.nodeName,NAMESPACE:.metadata.namespace,POD:.metadata.name,STATUS:.status.phase'
```

```text
NODE            NAMESPACE     POD                        STATUS
<none>          shop          web-7d4b9c-9dw7c           Pending
worker-node-1   kube-system   coredns-6f6b679f8f-8mv2x   Running
worker-node-1   shop          web-7d4b9c-x2kqz           Running
worker-node-2   kube-system   kube-proxy-q8zfn           Running
worker-node-2   shop          web-7d4b9c-p4lsm           Running
```

A pod with `<none>` as its node is not scheduled yet. `kubectl describe pod` shows the reason in its events, for example not enough CPU or a taint that the pod does not tolerate.

### How Many Pods Run on Each Node?

Count the running pods by node:

```bash
kubectl get pods -A --field-selector status.phase=Running \
  -o jsonpath='{range .items[*]}{.spec.nodeName}{"\n"}{end}' | sort | uniq -c
```

```text
     14 worker-node-1
     31 worker-node-2
```

A large difference between nodes is normal after a node joins or comes back: the scheduler places each pod once and does not move it later. Topology spread constraints spread new pods, and the descheduler evicts pods so that the scheduler places them again. To see the pod limit of each node, run `kubectl get nodes -o custom-columns='NODE:.metadata.name,MAX_PODS:.status.allocatable.pods'`.

## Best Practices

- **Add `-A` to node queries.** A node runs pods from many namespaces.
- **Filter on the server.** `--field-selector` and `-l` send less data than `grep` on the full list, which matters in a large cluster and in scripts that run often.
- **Use labels for groups of nodes.** Managed node pools add a pool label to their nodes. Select a pool with `kubectl get nodes -l <label>=<value>`, and show the zone of each node with `kubectl get nodes -L topology.kubernetes.io/zone`.
- **Give scripts their own ServiceAccount** with read-only access, not your admin kubeconfig.

## Conclusion

`spec.nodeName` connects every pod to its node. `kubectl get pods -A --field-selector spec.nodeName=<node>` gives you the pods on one node, `-o wide` or custom columns give you the whole map, and the same field selector works in a raw API call or a client library.

## Related Resources

- [The 5-Minute Kubernetes Cluster Health Check](/posts/5-minute-kubernetes-cluster-health-check): nodes, resource use and problem pods in five commands
- [How to list all containers in a pod](/posts/how-to-restart-container-within-pod#h2-how-do-i-list-all-containers-in-a-kubernetes-pod)
- [Introduction to Kubernetes: Scheduling](/guides/introduction-to-kubernetes/08-resource-management-and-scaling#h2-scheduling-where-pods-run): node selectors, affinity, taints and draining
- [Kubernetes Scheduler Challenge](/games/k8s-scheduler): place pods on nodes yourself and see which rules block them
- [Kubernetes Flashcards](/flashcards/kubernetes-basics)
