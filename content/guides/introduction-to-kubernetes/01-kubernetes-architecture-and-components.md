---
title: 'Kubernetes Architecture Explained: Control Plane and Nodes'
description: 'How Kubernetes works: the API server, etcd, scheduler and controllers, the kubelet and container runtime, and how one kubectl command flows through them.'
order: 1
---

**TLDR**: A Kubernetes cluster has a **control plane** that stores and decides (API server, etcd, scheduler, controller manager) and **worker nodes** that run your containers (kubelet, container runtime, kube-proxy). You never tell a node what to run. You tell the API server what you want, and a set of control loops keeps changing the cluster until it matches.

This part explains each component, shows them running on the kind cluster you build in [Part 2](/guides/introduction-to-kubernetes/02-setting-up-a-kubernetes-cluster), and follows one command through the whole system using the events it leaves behind. You can read it before you have a cluster; the commands are there to run once you have one.

## Desired State and Control Loops

Kubernetes is built around one idea: you describe the **desired state** of an object, and Kubernetes records it and works to make the **actual state** match it. Most objects have a `spec` (what you want) and a `status` (what is true right now); a few, such as ConfigMaps and Secrets, only hold data. Small programs called **controllers** each watch one kind of object, compare the two and act on the difference.

```diagram
{
  "type": "loop",
  "goal": "actual state = desired state",
  "loopBack": "repeat on every change",
  "nodes": [
    { "label": "Observe", "sub": "watch the API server", "variant": "soft" },
    { "label": "Compare", "sub": "spec vs status", "variant": "soft" },
    { "label": "Act", "sub": "create, delete, update", "variant": "accent" }
  ]
}
```

This is why Kubernetes heals itself. If you ask for three copies of a pod and a node dies with one of them, the controller sees two running copies, wants three, and creates a new one somewhere else. Nothing has to notice the failure and run a script; the loop handles it the next time it looks.

## The Big Picture

```diagram
{
  "type": "infra",
  "flow": [
    { "label": "kubectl", "sub": "HTTPS + credentials", "icon": "cpu", "tone": "slate" },
    { "label": "kube-apiserver", "sub": "the only door", "icon": "shield", "tone": "accent" },
    { "label": "kubelet", "sub": "on every node", "icon": "server", "tone": "blue" },
    { "label": "containerd", "sub": "runs containers", "icon": "box", "tone": "green" }
  ],
  "groups": [
    {
      "label": "Control plane",
      "sub": "one or more nodes",
      "icon": "k8s",
      "tone": "accent",
      "nodes": [
        { "label": "kube-apiserver", "sub": "REST API", "icon": "shield", "tone": "accent" },
        { "label": "etcd", "sub": "cluster state", "icon": "database", "tone": "violet" },
        { "label": "kube-scheduler", "sub": "picks a node", "icon": "gear", "tone": "slate" },
        { "label": "controller-manager", "sub": "control loops", "icon": "gear", "tone": "slate" }
      ]
    },
    {
      "label": "Worker node",
      "sub": "many of these",
      "icon": "server",
      "tone": "blue",
      "nodes": [
        { "label": "kubelet", "sub": "node agent", "icon": "activity", "tone": "blue" },
        { "label": "containerd", "sub": "CRI runtime", "icon": "box", "tone": "green" },
        { "label": "kube-proxy", "sub": "Service rules", "icon": "net", "tone": "green" },
        { "label": "pods", "sub": "your containers", "icon": "pod", "tone": "blue" }
      ]
    }
  ]
}
```

Everything goes through the API server. The scheduler, the controllers, the kubelets and you all read and write objects through it, and only the API server talks to etcd. The control plane components do not call each other; they coordinate by watching the API server for changes. The one common direct connection goes the other way: the API server calls a node's kubelet when you ask for logs, `exec` or `port-forward`.

## Control Plane Components

On the kind cluster from Part 2, the control plane components run as pods in the `kube-system` namespace on the control plane node. Managed services such as DigitalOcean Kubernetes, EKS, GKE and AKS run the control plane for you, so you do not see these pods there.

```terminal
{
  "title": "the components on a kind cluster",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl get nodes -o wide",
      "output": "NAME                      STATUS   ROLES           AGE   VERSION   INTERNAL-IP   EXTERNAL-IP   OS-IMAGE                       KERNEL-VERSION              CONTAINER-RUNTIME\nk8s-guide-control-plane   Ready    control-plane   33s   v1.37.0   172.18.0.3    <none>        Debian GNU/Linux 13 (trixie)   6.17.0-1022-azure (amd64)   containerd://2.3.4\nk8s-guide-worker          Ready    <none>          19s   v1.37.0   172.18.0.2    <none>        Debian GNU/Linux 13 (trixie)   6.17.0-1022-azure (amd64)   containerd://2.3.4\nk8s-guide-worker2         Ready    <none>          19s   v1.37.0   172.18.0.4    <none>        Debian GNU/Linux 13 (trixie)   6.17.0-1022-azure (amd64)   containerd://2.3.4"
    },
    {
      "cmd": "kubectl get pods -n kube-system -o wide",
      "output": "NAME                                              READY   STATUS    RESTARTS   AGE   IP           NODE                      NOMINATED NODE   READINESS GATES\ncoredns-559f6c778d-nrsj4                          1/1     Running   0          23s   10.244.0.3   k8s-guide-control-plane   <none>           <none>\ncoredns-559f6c778d-xz22s                          1/1     Running   0          23s   10.244.0.2   k8s-guide-control-plane   <none>           <none>\netcd-k8s-guide-control-plane                      1/1     Running   0          31s   172.18.0.3   k8s-guide-control-plane   <none>           <none>\nkindnet-4zjlj                                     1/1     Running   0          23s   172.18.0.3   k8s-guide-control-plane   <none>           <none>\nkindnet-dvqtf                                     1/1     Running   0          19s   172.18.0.2   k8s-guide-worker          <none>           <none>\nkindnet-tjthc                                     1/1     Running   0          19s   172.18.0.4   k8s-guide-worker2         <none>           <none>\nkube-apiserver-k8s-guide-control-plane            1/1     Running   0          31s   172.18.0.3   k8s-guide-control-plane   <none>           <none>\nkube-controller-manager-k8s-guide-control-plane   1/1     Running   0          31s   172.18.0.3   k8s-guide-control-plane   <none>           <none>\nkube-proxy-2lnts                                  1/1     Running   0          23s   172.18.0.3   k8s-guide-control-plane   <none>           <none>\nkube-proxy-sghth                                  1/1     Running   0          19s   172.18.0.4   k8s-guide-worker2         <none>           <none>\nkube-proxy-vpbfr                                  1/1     Running   0          19s   172.18.0.2   k8s-guide-worker          <none>           <none>\nkube-scheduler-k8s-guide-control-plane            1/1     Running   0          31s   172.18.0.3   k8s-guide-control-plane   <none>           <none>"
    }
  ]
}
```

### kube-apiserver

The **API server** is the front door of the cluster. It serves the Kubernetes REST API over HTTPS. For every request it:

1. **Authenticates** the caller (a client certificate, a token, or OIDC).
2. **Authorizes** the action, usually with RBAC rules ([Part 10](/guides/introduction-to-kubernetes/10-best-practices-in-kubernetes)).

For a request that creates, changes or deletes an object, it also:

3. Runs **admission**: built-in plugins and policies that can change or reject the object, such as Pod Security Admission or a ValidatingAdmissionPolicy.
4. **Validates** the object against its schema and stores it in etcd.

It then notifies every client that watches that kind of object. The API server is stateless, so production control planes run several copies behind a load balancer.

### etcd

**etcd** is a consistent, distributed key-value store and the cluster's only database. Every object you create ends up there. If you lose etcd without a backup, you lose the cluster's state, even though the containers on the nodes keep running for a while. The API server reports etcd's health in its readiness checks:

```bash
kubectl get --raw='/readyz?verbose' | grep -E 'etcd|check'
```

```text
[+]etcd ok
[+]etcd-readiness ok
readyz check passed
```

Run etcd with an odd number of members (3 or 5) so it keeps a majority when one fails, and back it up. On a managed service the provider does both.

### kube-scheduler

The **scheduler** watches for pods that have no node yet and picks one for each. It first filters out nodes that cannot run the pod (not enough free CPU or memory for its requests, a taint the pod does not tolerate, a node selector that does not match) and then scores the rest, for example to spread copies of the same app over nodes. Then it writes its choice into the pod's `spec.nodeName`. That is all it does: it does not start anything. [Part 8](/guides/introduction-to-kubernetes/08-resource-management-and-scaling) shows how you steer it.

### kube-controller-manager

The **controller manager** runs most of the built-in control loops in one process: the Deployment controller creates ReplicaSets, the ReplicaSet controller creates pods, the Job controller runs pods to completion, the node controller notices nodes that stop reporting, the EndpointSlice controller tracks which pods back a Service, and so on.

### cloud-controller-manager

On a cloud provider, the **cloud controller manager** connects Kubernetes to the provider's API: it creates a cloud load balancer for a Service of type `LoadBalancer`, labels nodes with their zone and removes nodes whose virtual machines are gone. kind has no cloud, so it has no cloud controller manager; [Part 5](/guides/introduction-to-kubernetes/05-services-and-networking) adds `cloud-provider-kind`, a stand-in that runs outside the cluster.

## Node Components

Every node, including the control plane node on kind, runs these:

- **kubelet**, the node agent. It watches the API server for pods assigned to its node, asks the container runtime to start their containers, runs their health probes, mounts their volumes and reports their status back. The kubelet runs as a system service on the node, not as a pod.
- A **container runtime** that implements the Container Runtime Interface (CRI): containerd or CRI-O. The kind nodes above run containerd 2.3. Kubernetes removed its built-in Docker Engine support (dockershim) in 1.24; images you build with Docker still run unchanged, because they are standard OCI images. Kubernetes 1.36 and newer need containerd 2.0 or later.
- **kube-proxy**, which turns Services into packet rules on the node (iptables or nftables) so that traffic to a Service's virtual IP reaches one of its pods. Some network plugins, such as Cilium, replace it.
- A **network plugin** (CNI) that gives every pod an IP address and connects pods across nodes. kind uses its own small plugin, kindnet, which also enforces NetworkPolicies.

On the kind cluster, kindnet and kube-proxy run as DaemonSets, one pod per node, which is why the output above lists three of each. kube-proxy runs in iptables mode there:

```bash
kubectl -n kube-system get configmap kube-proxy -o jsonpath='{.data.config\.conf}' | grep 'mode:'
```

```text
mode: iptables
```

The `ipvs` mode that many older tutorials recommend is deprecated: it logs a warning since 1.35, is expected to be off by default in 1.40 and is scheduled for removal in 1.43. Use `nftables` (or the default `iptables`) instead.

## One Command, Followed Through the Cluster

Here is what happens when you create a Deployment with two copies of podinfo, the example app of this guide:

```diagram
{
  "type": "graph",
  "columns": [
    [{ "id": "kubectl", "label": "kubectl create", "sub": "deployment hello", "icon": "cpu", "tone": "slate", "detail": "kubectl sends a POST request with the Deployment object to the API server." }],
    [{ "id": "api", "label": "API server", "sub": "auth, admission, etcd", "icon": "shield", "tone": "accent", "detail": "The API server checks who you are and what you may do, runs admission, and stores the Deployment in etcd." }],
    [
      { "id": "dc", "label": "deployment controller", "sub": "creates a ReplicaSet", "icon": "gear", "tone": "slate", "detail": "Sees a Deployment without a matching ReplicaSet and creates one with replicas: 2." },
      { "id": "rsc", "label": "replicaset controller", "sub": "creates 2 pods", "icon": "gear", "tone": "slate", "detail": "Sees a ReplicaSet that wants 2 pods and has 0, and creates 2 pod objects with no node." }
    ],
    [{ "id": "sched", "label": "scheduler", "sub": "binds pods to nodes", "icon": "gear", "tone": "violet", "detail": "Picks a node for each pod and writes it into spec.nodeName." }],
    [{ "id": "kubelet", "label": "kubelet", "sub": "pulls, creates, starts", "icon": "server", "tone": "blue", "detail": "The kubelet on that node sees a new pod for itself, asks containerd to pull the image and start the container, then reports the status." }]
  ],
  "edges": [["kubectl", "api", "POST"], ["api", "dc", "watch"], ["dc", "rsc", "ReplicaSet"], ["rsc", "sched", "pods"], ["sched", "kubelet", "binding"]]
}
```

Each component records what it did as an **event**, so you can watch the chain happen. Create the Deployment and list the events (the `LAST SEEN` column counts back from the moment you ran the command):

```terminal
{
  "title": "follow a Deployment through the cluster",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl create deployment hello --image=ghcr.io/stefanprodan/podinfo:6.15.0 --replicas=2",
      "output": "deployment.apps/hello created"
    },
    {
      "cmd": "kubectl events",
      "output": "LAST SEEN   TYPE     REASON              OBJECT                        MESSAGE\n3s          Normal   SuccessfulCreate    ReplicaSet/hello-5956ff4d9f   Created pod: hello-5956ff4d9f-bkz48\n3s          Normal   ScalingReplicaSet   Deployment/hello              Scaled up replica set hello-5956ff4d9f from 0 to 2\n3s          Normal   Scheduled           Pod/hello-5956ff4d9f-bkz48    Successfully assigned demo/hello-5956ff4d9f-bkz48 to k8s-guide-worker2\n3s          Normal   SuccessfulCreate    ReplicaSet/hello-5956ff4d9f   Created pod: hello-5956ff4d9f-rhqdb\n3s          Normal   Scheduled           Pod/hello-5956ff4d9f-rhqdb    Successfully assigned demo/hello-5956ff4d9f-rhqdb to k8s-guide-worker\n2s          Normal   Pulling             Pod/hello-5956ff4d9f-bkz48    Pulling image \"ghcr.io/stefanprodan/podinfo:6.15.0\"\n2s          Normal   Pulling             Pod/hello-5956ff4d9f-rhqdb    Pulling image \"ghcr.io/stefanprodan/podinfo:6.15.0\"\n0s          Normal   Created             Pod/hello-5956ff4d9f-bkz48    Container created\n0s          Normal   Created             Pod/hello-5956ff4d9f-rhqdb    Container created\n0s          Normal   Started             Pod/hello-5956ff4d9f-rhqdb    Container started\n0s          Normal   Pulled              Pod/hello-5956ff4d9f-rhqdb    Successfully pulled image \"ghcr.io/stefanprodan/podinfo:6.15.0\" in 1.839s (1.839s including waiting). Image size: 34763248 bytes.\n0s          Normal   Started             Pod/hello-5956ff4d9f-bkz48    Container started\n0s          Normal   Pulled              Pod/hello-5956ff4d9f-bkz48    Successfully pulled image \"ghcr.io/stefanprodan/podinfo:6.15.0\" in 1.834s (1.834s including waiting). Image size: 34763248 bytes."
    },
    {
      "cmd": "kubectl get pods -o wide",
      "output": "NAME                     READY   STATUS    RESTARTS   AGE   IP           NODE                NOMINATED NODE   READINESS GATES\nhello-5956ff4d9f-bkz48   1/1     Running   0          3s    10.244.1.2   k8s-guide-worker2   <none>           <none>\nhello-5956ff4d9f-rhqdb   1/1     Running   0          3s    10.244.2.2   k8s-guide-worker    <none>           <none>"
    }
  ]
}
```

Many events happened in the same second, so read them by `REASON` rather than by position: `ScalingReplicaSet` is the deployment controller creating a ReplicaSet, `SuccessfulCreate` is the replicaset controller creating the two pods, `Scheduled` is the scheduler assigning each pod to a node, and `Pulling`, `Pulled`, `Created` and `Started` are the kubelet on that node. Each pod records which object owns it, which is how the controllers find "their" pods again:

```terminal
{
  "title": "owner references",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl get pods -o custom-columns=POD:.metadata.name,OWNER-KIND:.metadata.ownerReferences[0].kind,OWNER:.metadata.ownerReferences[0].name",
      "output": "POD                      OWNER-KIND   OWNER\nhello-5956ff4d9f-bkz48   ReplicaSet   hello-5956ff4d9f\nhello-5956ff4d9f-rhqdb   ReplicaSet   hello-5956ff4d9f"
    },
    {
      "cmd": "kubectl delete deployment hello",
      "output": "deployment.apps \"hello\" deleted from demo namespace"
    }
  ]
}
```

Deleting the Deployment also deletes its ReplicaSet and pods, because the garbage collector removes objects whose owner is gone.

## Kubernetes Objects

Every object has the same outer shape:

```yaml
apiVersion: apps/v1 # API group and version
kind: Deployment # the type of object
metadata:
  name: podinfo # unique per kind within a namespace
  namespace: demo
  labels: # key-value pairs that selectors match on
    app: podinfo
spec: {} # what you want; differs per kind
# status: written by Kubernetes, not by you
```

The objects you use most, and the part that covers each:

| Object                  | What it does                                                    | Part |
| ----------------------- | --------------------------------------------------------------- | ---- |
| Pod                     | One or more containers that share a network address and volumes | 3    |
| Deployment, ReplicaSet  | Keep N identical pods running and replace them during updates   | 4    |
| Job, CronJob, DaemonSet | Run pods to completion, on a schedule, or one per node          | 4    |
| Service, EndpointSlice  | A stable virtual IP and DNS name for a changing set of pods     | 5    |
| Gateway, HTTPRoute      | HTTP routing into the cluster                                   | 5    |
| ConfigMap, Secret       | Configuration and sensitive data for pods                       | 6    |
| PersistentVolumeClaim   | A request for storage that outlives a pod                       | 7    |
| StatefulSet             | Pods with stable names and their own volumes                    | 7    |
| HorizontalPodAutoscaler | Changes the number of pods based on load                        | 8    |
| Role, RoleBinding       | Who may do what                                                 | 10   |
| NetworkPolicy           | Which pods may talk to which                                    | 10   |

**Namespaces** divide one cluster into named groups of objects. Names must be unique within a namespace, RBAC rules and quotas usually apply per namespace, and deleting a namespace deletes everything in it. This guide puts the app in a namespace called `demo`. Nodes, PersistentVolumes and StorageClasses are cluster-wide and belong to no namespace.

**Labels** are the glue. A Deployment finds its pods, a Service finds its endpoints and a NetworkPolicy finds its targets with a label selector such as `app=podinfo`, never by name.

## The Kubernetes API

Object types are grouped into API groups with versions. The core group (`v1`) holds pods, Services, ConfigMaps and Secrets; named groups such as `apps/v1`, `batch/v1` and `networking.k8s.io/v1` hold the rest. `kubectl api-resources` lists what your cluster serves, and `kubectl explain` documents any field without leaving the terminal:

```terminal
{
  "title": "explore the API",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl api-resources --api-group=apps",
      "output": "NAME                  SHORTNAMES   APIVERSION   NAMESPACED   KIND\ncontrollerrevisions                apps/v1      true         ControllerRevision\ndaemonsets            ds           apps/v1      true         DaemonSet\ndeployments           deploy       apps/v1      true         Deployment\nreplicasets           rs           apps/v1      true         ReplicaSet\nstatefulsets          sts          apps/v1      true         StatefulSet"
    },
    {
      "cmd": "kubectl explain deployment.spec.replicas",
      "output": "GROUP:      apps\nKIND:       Deployment\nVERSION:    v1\n\nFIELD: replicas <integer>\n\n\nDESCRIPTION:\n    Number of desired pods. This is a pointer to distinguish between explicit\n    zero and not specified. Defaults to 1."
    }
  ]
}
```

Custom Resource Definitions (CRDs) add new object types to the same API. Gateway API in Part 5 and the Prometheus Operator in Part 9 are both CRDs, and you use them with the same `kubectl` commands.

## Declarative and Imperative Commands

You can tell Kubernetes what to do (imperative) or what you want (declarative):

```bash
# Imperative: one action, nothing left behind to review
kubectl create deployment hello --image=ghcr.io/stefanprodan/podinfo:6.15.0

# Declarative: the YAML file is the record of what should exist
kubectl apply -f deployment.yaml
```

Imperative commands are fine for experiments and for debugging. For anything that lasts, keep YAML files in Git and use `kubectl apply`: you can review a change before it happens, see who changed what, roll back with Git, and recreate the whole app in a new cluster. `kubectl create -f` fails if the object already exists, while `kubectl apply -f` creates it or updates it to match the file ([apply vs create in detail](/posts/kubectl-apply-vs-create-differences)). GitOps tools such as Argo CD and Flux take this one step further and apply the files from Git for you.

## Common Mistakes

- **Treating nodes as pets.** Pods move between nodes. Do not store data on a node or SSH into one to fix an app; fix the YAML and let the controllers converge.
- **Forgetting that the control plane is a single point of failure.** A self-managed cluster needs three control plane nodes and etcd backups. A managed service handles this for you.
- **Following tutorials written for old versions.** Docker as the runtime, PodSecurityPolicy, `apt.kubernetes.io` and `ipvs` mode are all gone or deprecated. The [overview](/guides/introduction-to-kubernetes) lists what changed.
- **Talking to components directly.** Use the API server for everything. Reading etcd directly bypasses authorization and is only for backups and emergencies.

## Summary

- The control plane stores the desired state (API server and etcd) and decides what should run where (scheduler and controllers).
- Each node runs the kubelet, a CRI container runtime such as containerd, kube-proxy and a network plugin.
- Every change goes through the API server, and controllers act on it in loops, which is what makes the cluster heal itself.
- Events show you which component did what; you will use them in every part that follows.

## Keep Learning

- [Kubernetes concepts from junior to mid level](/posts/kubernetes-concepts-junior-to-mid-level)
- [Kubernetes kubelet interview questions](/interview-questions/mid/kubernetes-kubelet)
- [Kubernetes scheduler simulator](/games/k8s-scheduler)

Next, in [Part 2](/guides/introduction-to-kubernetes/02-setting-up-a-kubernetes-cluster), you install the tools and create the cluster these outputs came from.
