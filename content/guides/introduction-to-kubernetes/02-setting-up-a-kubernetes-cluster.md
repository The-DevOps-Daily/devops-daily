---
title: 'Set Up a Kubernetes Cluster with kind, minikube or a Cloud Service'
description: 'Install kubectl, kind and Helm, create a three-node Kubernetes 1.37 cluster locally, use contexts and namespaces, or create a DOKS, EKS or kubeadm cluster.'
order: 2
---

**TLDR**: Install `kubectl`, `kind` and `helm`, then run `kind create cluster --config kind-config.yaml` to get a three-node Kubernetes 1.37 cluster inside Docker in about a minute. `kubectl` talks to it through a context in `~/.kube/config`. For production, use a managed service such as DigitalOcean Kubernetes, EKS, GKE or AKS, or build your own with kubeadm.

In this part you install the tools, create the cluster that the rest of the guide uses, learn how kubeconfig contexts and namespaces work, and see the other ways to run Kubernetes, from minikube to kubeadm on your own servers.

## Prerequisites

- Docker Desktop (macOS, Windows) or Docker Engine (Linux), running. On Windows, use WSL 2 with Docker Desktop's WSL integration, and run every command of this guide in the WSL terminal; the commands are written for Bash. kind starts each Kubernetes node as a container. Podman also works with kind, but kind's support for it is experimental.
- Give Docker at least 4 CPUs and 6 GB of memory if you use Docker Desktop (Settings, Resources).
- The [companion repository](https://github.com/The-DevOps-Daily/guide-kubernetes-demo-2026-10-24), cloned. Every command in this guide runs from its root directory:

```bash
git clone https://github.com/The-DevOps-Daily/guide-kubernetes-demo-2026-10-24.git
cd guide-kubernetes-demo-2026-10-24
```

## Ways to Run Kubernetes

| Option                               | What it is                                                         | Good for                                      |
| ------------------------------------ | ------------------------------------------------------------------ | --------------------------------------------- |
| **kind**                             | Kubernetes nodes as Docker containers; the project's own test tool | Learning, CI, multi-node tests on a laptop    |
| **minikube**                         | A single- or multi-node cluster in a VM or container               | Learning, with built-in add-ons               |
| **k3d** / **k3s**                    | k3s, a small Kubernetes distribution, in Docker or on a server     | Laptops, edge devices, small servers          |
| **Docker Desktop / Rancher Desktop** | A cluster you switch on in the app's settings                      | A quick start if you already use the app      |
| **Managed (DOKS, EKS, GKE, AKS)**    | The provider runs the control plane; you pay for worker nodes      | Production for most teams                     |
| **kubeadm** (or Kubespray, Talos)    | You install and run every component on your own machines           | Full control, on-premises, learning internals |

This guide uses kind because it gives you real multi-node behavior (scheduling across nodes, draining a node, node-local storage) on one computer, and because the same commands run in CI. Everything you learn applies to the other options.

## Install kubectl, kind and Helm

**kubectl** is the command-line client for the Kubernetes API. **kind** creates the local cluster. **Helm** installs packaged applications (charts); you use it in [Part 9](/guides/introduction-to-kubernetes/09-monitoring-and-logging-in-kubernetes).

```tabs
{
  "title": "Install the tools",
  "tabs": [
    {
      "label": "macOS",
      "lang": "bash",
      "code": "# Homebrew installs the current releases\nbrew install kubectl kind helm"
    },
    {
      "label": "Linux",
      "lang": "bash",
      "code": "# kubectl v1.37.1 (use arm64 instead of amd64 on ARM machines)\ncurl -LO https://dl.k8s.io/release/v1.37.1/bin/linux/amd64/kubectl\ncurl -LO https://dl.k8s.io/release/v1.37.1/bin/linux/amd64/kubectl.sha256\necho \"$(cat kubectl.sha256)  kubectl\" | sha256sum --check\nsudo install -m 0755 kubectl /usr/local/bin/kubectl\n\n# kind v0.33.0\ncurl -Lo kind https://kind.sigs.k8s.io/dl/v0.33.0/kind-linux-amd64\ncurl -Lo kind.sha256sum https://kind.sigs.k8s.io/dl/v0.33.0/kind-linux-amd64.sha256sum\necho \"$(cut -d' ' -f1 kind.sha256sum)  kind\" | sha256sum --check\nsudo install -m 0755 kind /usr/local/bin/kind\n\n# Helm v4.3.1\ncurl -LO https://get.helm.sh/helm-v4.3.1-linux-amd64.tar.gz\ncurl -LO https://get.helm.sh/helm-v4.3.1-linux-amd64.tar.gz.sha256sum\nsha256sum --check helm-v4.3.1-linux-amd64.tar.gz.sha256sum\ntar -xzf helm-v4.3.1-linux-amd64.tar.gz\nsudo install -m 0755 linux-amd64/helm /usr/local/bin/helm"
    },
    {
      "label": "Windows",
      "lang": "powershell",
      "code": "# The commands in this guide are Bash. On Windows, run them in WSL 2:\nwsl --install -d Ubuntu\n# Then turn on Docker Desktop's WSL integration (Settings, Resources, WSL integration),\n# open the Ubuntu terminal, and follow the Linux tab there."
    }
  ]
}
```

Check the versions:

```terminal
{
  "title": "versions",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kind version",
      "output": "kind v0.33.0 go1.26.7 linux/amd64"
    },
    {
      "cmd": "kubectl version --client",
      "output": "Client Version: v1.37.1\nKustomize Version: v5.8.1"
    },
    {
      "cmd": "helm version",
      "output": "version.BuildInfo{Version:\"v4.3.1\", GitCommit:\"c0d08d0d6d9424d4a14febb5e8a3e51b0dd00dff\", GitTreeState:\"clean\", GoVersion:\"go1.27.2\", KubeClientVersion:\"v1.37\"}"
    }
  ]
}
```

`kubectl` supports API servers one minor version older or newer than itself, so kubectl 1.37 works with clusters from 1.36 to 1.38. If you manage clusters on several versions, keep a kubectl that is no more than one minor version away from each.

## Create the Cluster

The cluster for this guide has one control plane node and two worker nodes. The file also maps port 30080 of the control plane container to port 30080 on `127.0.0.1`, which [Part 5](/guides/introduction-to-kubernetes/05-services-and-networking) uses for a NodePort Service. Binding to `127.0.0.1` keeps other machines on your network from reaching it:

```yaml
# A local cluster with one control plane node and two worker nodes.
# kind v0.33.0 runs Kubernetes v1.37.0 on these nodes by default.
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: k8s-guide
nodes:
  - role: control-plane
    extraPortMappings:
      # Makes NodePort 30080 reachable as localhost:30080 (Part 5), and only from this computer
      - containerPort: 30080
        hostPort: 30080
        listenAddress: '127.0.0.1'
  - role: worker
  - role: worker
```

Create the cluster. kind pulls the node image the first time, so this takes a minute or two:

```bash
kind create cluster --config kind-config.yaml
```

```text
Creating cluster "k8s-guide" ...
 • Ensuring node image (kindest/node:v1.37.0) 🖼️  ...
 ✓ Ensuring node image (kindest/node:v1.37.0) 🖼️
 • Preparing nodes 📦 📦 📦   ...
 ✓ Preparing nodes 📦 📦 📦
 • Writing configuration 📜  ...
 ✓ Writing configuration 📜
 • Starting control-plane 🕹️  ...
 ✓ Starting control-plane 🕹️
 • Installing CNI 🔌  ...
 ✓ Installing CNI 🔌
 • Installing StorageClass 💾  ...
 ✓ Installing StorageClass 💾
 • Joining worker nodes 🚜  ...
 ✓ Joining worker nodes 🚜
Set kubectl context to "kind-k8s-guide"
You can now use your cluster with:

kubectl cluster-info --context kind-k8s-guide

Have a nice day! 👋
```

kind also wrote a context called `kind-k8s-guide` into `~/.kube/config` and made it the current one, so `kubectl` now talks to the new cluster:

```terminal
{
  "title": "is it up?",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl cluster-info --context kind-k8s-guide",
      "output": "Kubernetes control plane is running at https://127.0.0.1:37953\nCoreDNS is running at https://127.0.0.1:37953/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy\n\nTo further debug and diagnose cluster problems, use 'kubectl cluster-info dump'."
    },
    {
      "cmd": "kubectl get nodes",
      "output": "NAME                      STATUS     ROLES           AGE   VERSION\nk8s-guide-control-plane   NotReady   control-plane   15s   v1.37.0\nk8s-guide-worker          NotReady   <none>          0s    v1.37.0\nk8s-guide-worker2         NotReady   <none>          0s    v1.37.0"
    }
  ]
}
```

The nodes report `NotReady` for the first few seconds, until the network plugin runs on each of them. Wait for them instead of guessing:

```terminal
{
  "title": "wait for the nodes",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl wait --for=condition=Ready nodes --all --timeout=120s",
      "output": "node/k8s-guide-control-plane condition met\nnode/k8s-guide-worker condition met\nnode/k8s-guide-worker2 condition met"
    },
    {
      "cmd": "kubectl get nodes -o wide",
      "output": "NAME                      STATUS   ROLES           AGE   VERSION   INTERNAL-IP   EXTERNAL-IP   OS-IMAGE                       KERNEL-VERSION              CONTAINER-RUNTIME\nk8s-guide-control-plane   Ready    control-plane   28s   v1.37.0   172.18.0.4    <none>        Debian GNU/Linux 13 (trixie)   6.17.0-1022-azure (amd64)   containerd://2.3.4\nk8s-guide-worker          Ready    <none>          13s   v1.37.0   172.18.0.2    <none>        Debian GNU/Linux 13 (trixie)   6.17.0-1022-azure (amd64)   containerd://2.3.4\nk8s-guide-worker2         Ready    <none>          13s   v1.37.0   172.18.0.3    <none>        Debian GNU/Linux 13 (trixie)   6.17.0-1022-azure (amd64)   containerd://2.3.4"
    },
    {
      "cmd": "kubectl version",
      "output": "Client Version: v1.37.1\nKustomize Version: v5.8.1\nServer Version: v1.37.0"
    }
  ]
}
```

Each node is a Debian 13 container that runs containerd and the kubelet. You can see them with Docker; the API server is published on a random port on `127.0.0.1`:

```terminal
{
  "title": "the nodes are containers",
  "prompt": "$",
  "steps": [
    {
      "cmd": "docker ps --format 'table {{.Names}}\\t{{.Image}}\\t{{.Ports}}'",
      "output": "NAMES                     IMAGE                  PORTS\nk8s-guide-worker          kindest/node:v1.37.0\nk8s-guide-worker2         kindest/node:v1.37.0\nk8s-guide-control-plane   kindest/node:v1.37.0   127.0.0.1:30080->30080/tcp, 127.0.0.1:37953->6443/tcp"
    },
    {
      "cmd": "kind get clusters",
      "output": "k8s-guide"
    }
  ]
}
```

kind also installed a default StorageClass that creates volumes in a directory on the node ([Part 7](/guides/introduction-to-kubernetes/07-persistent-storage-in-kubernetes)):

```bash
kubectl get storageclass
```

```text
NAME                 PROVISIONER             RECLAIMPOLICY   VOLUMEBINDINGMODE      ALLOWVOLUMEEXPANSION   AGE
standard (default)   rancher.io/local-path   Delete          WaitForFirstConsumer   false                  24s
```

## Contexts and kubeconfig

`kubectl` reads its configuration from `~/.kube/config` (or the files listed in the `KUBECONFIG` variable). The file has three lists: **clusters** (API server addresses and CA certificates), **users** (credentials) and **contexts**, which pair a cluster with a user and a default namespace. The **current context** decides where every `kubectl` command goes.

```bash
kubectl config get-contexts
```

```text
CURRENT   NAME             CLUSTER          AUTHINFO         NAMESPACE
*         kind-k8s-guide   kind-k8s-guide   kind-k8s-guide
```

When you have several clusters, switch with `kubectl config use-context <name>`, or run a single command elsewhere with `--context <name>`. Before any command that changes something, check where you are with `kubectl config current-context`; running a delete against the wrong cluster is one of the most common and expensive Kubernetes mistakes.

:::tip
Your own preferences, such as aliases and default flags, belong in `~/.kube/kuberc` (beta and on by default since Kubernetes 1.34), not in the kubeconfig file. That keeps them out of the credentials you share with tools and CI.
:::

## Namespaces

Every namespaced command runs in the current context's namespace, which is `default` until you change it. Create a namespace for the guide's app and make it the default for this context, so you do not have to type `-n demo` every time:

```terminal
{
  "title": "a namespace for the guide",
  "prompt": "$",
  "steps": [
    {
      "cmd": "kubectl create namespace demo",
      "output": "namespace/demo created"
    },
    {
      "cmd": "kubectl config set-context --current --namespace=demo",
      "output": "Context \"kind-k8s-guide\" modified."
    },
    {
      "cmd": "kubectl config view --minify -o jsonpath='{..namespace}'",
      "output": "demo"
    },
    {
      "cmd": "kubectl get pods",
      "output": "No resources found in demo namespace."
    },
    {
      "cmd": "kubectl get namespaces",
      "output": "NAME                 STATUS   AGE\ndefault              Active   28s\ndemo                 Active   0s\nkube-node-lease      Active   28s\nkube-public          Active   28s\nkube-system          Active   28s\nlocal-path-storage   Active   24s"
    }
  ]
}
```

For a single command, `-n <namespace>` overrides the default and `-A` (`--all-namespaces`) lists objects in every namespace. More on this in [how to switch namespaces in Kubernetes](/posts/switch-namespace-in-kubernetes).

## Stopping and Deleting the Cluster

The cluster keeps running until you delete it, and it starts again after a reboot if Docker does. Delete it when you are done with the guide:

```bash
kind delete cluster --name k8s-guide
```

```text
Deleting cluster "k8s-guide" ...
Deleted nodes: ["k8s-guide-worker" "k8s-guide-worker2" "k8s-guide-control-plane"]
```

To start a later part on a fresh cluster, create it again and recreate the namespace; each part lists the manifests from earlier parts that it needs.

## Other Local Options

The same app runs on these, with small differences you will notice in Parts 5 and 7 (how LoadBalancer Services get an address, and which StorageClass is the default):

```bash
# minikube v1.39 (Kubernetes 1.37 by default)
minikube start --nodes 3 --cpus 2 --memory 4g
minikube tunnel # in a second terminal: gives LoadBalancer Services an address

# k3d v5.9 (k3s in Docker, with Traefik and a LoadBalancer implementation built in)
k3d cluster create k8s-guide --agents 2
```

These are examples; the outputs in this guide come from kind.

## Managed Kubernetes

With a managed service, the provider runs and upgrades the control plane, backs up etcd and connects the cluster to its load balancers and disks. You manage worker nodes (or not even those, with GKE Autopilot or EKS Auto Mode) and pay for them by the hour.

**DigitalOcean Kubernetes (DOKS)** is one of the simplest to start with. Install [`doctl`](https://docs.digitalocean.com/reference/doctl/how-to/install/), create an API token in the control panel, and create a cluster with two worker nodes:

```bash
doctl auth init
doctl kubernetes cluster create k8s-guide \
  --region fra1 \
  --node-pool "name=workers;size=s-2vcpu-4gb;count=2"
kubectl get nodes # doctl adds the context and switches to it
```

If you do not have a DigitalOcean account yet, you can sign up through our [referral link](https://m.do.co/c/2a9bba940f39). A new account gets DigitalOcean's standard [signup credit](https://docs.digitalocean.com/platform/billing/signup-credit/) ($5 that expires 90 days after sign-up), and you must add a payment method before you can create resources. If you later spend $25 on DigitalOcean, this site gets $25 of credit ([referral program](https://docs.digitalocean.com/platform/teams/refer-others/)). The worker nodes are billed while they exist; delete the cluster and the load balancers and volumes it created with `doctl kubernetes cluster delete k8s-guide --dangerous`.

The other large providers, each with its own CLI (examples, not run for this guide):

```bash
# Amazon EKS with eksctl; Auto Mode also manages the nodes for you
eksctl create cluster --name k8s-guide --region eu-central-1 --enable-auto-mode

# Google GKE Autopilot: no nodes to manage
gcloud container clusters create-auto k8s-guide --region europe-west1
gcloud container clusters get-credentials k8s-guide --region europe-west1

# Azure AKS
az group create --name k8s-guide --location westeurope
az aks create --resource-group k8s-guide --name k8s-guide --node-count 2 --generate-ssh-keys
az aks get-credentials --resource-group k8s-guide --name k8s-guide
```

Managed services usually offer a new Kubernetes minor version a few weeks or months after the upstream release, and each has its own support window. Check which versions your provider offers before you plan an upgrade.

## Self-Managed Clusters with kubeadm

**kubeadm** is the official tool for building a cluster on machines you control. Each machine needs a supported Linux with cgroup v2, swap turned off (or configured for Kubernetes), and containerd 2.x configured with the systemd cgroup driver. Install the Kubernetes packages from `pkgs.k8s.io`, which has one repository per minor version; the old `apt.kubernetes.io` and `packages.cloud.google.com` repositories that older guides use stopped working on 4 March 2024.

These commands are an example for Ubuntu and Debian, not run for this guide:

```bash
# On every node: the Kubernetes 1.37 package repository
sudo apt-get update
sudo apt-get install -y apt-transport-https ca-certificates curl gpg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.37/deb/Release.key |
  sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.37/deb/ /' |
  sudo tee /etc/apt/sources.list.d/kubernetes.list
sudo apt-get update
sudo apt-get install -y kubelet kubeadm kubectl
sudo apt-mark hold kubelet kubeadm kubectl # upgrade them on purpose, never by accident
sudo systemctl enable --now kubelet

# On the first control plane node
sudo kubeadm init --pod-network-cidr=10.244.0.0/16
mkdir -p "$HOME/.kube"
sudo cp /etc/kubernetes/admin.conf "$HOME/.kube/config"
sudo chown "$(id -u):$(id -g)" "$HOME/.kube/config"

# Install a network plugin (CNI), for example Cilium or Calico, with its own instructions,
# then join each worker with the command that kubeadm init printed:
sudo kubeadm join CONTROL_PLANE_IP:6443 --token TOKEN --discovery-token-ca-cert-hash sha256:HASH
```

For production, run three control plane nodes behind a load balancer (`kubeadm init --control-plane-endpoint`), back up etcd with `etcdctl snapshot save`, and plan for upgrades: Kubernetes supports each minor version for about 14 months, and you upgrade one minor version at a time, control plane first, then the nodes. Kubespray automates kubeadm with Ansible, and Talos Linux and k3s are lighter alternatives.

## Common Mistakes

- **Running commands against the wrong cluster.** Check `kubectl config current-context` before changes, and use a different color or prompt for production contexts.
- **Too little memory for Docker Desktop.** Pods stay `Pending` or nodes go `NotReady` when the VM runs out of memory. Give it at least 6 GB for this guide.
- **Copying old install steps.** `apt-key`, `apt.kubernetes.io`, Docker as the runtime and `kubernetes-xenial` lines are from before 2024 and no longer work.
- **A kubectl far from the cluster version.** Stay within one minor version of the API server.
- **Forgetting cloud clusters.** Managed nodes, load balancers and volumes cost money until you delete them.

## Summary

- `kind create cluster --config kind-config.yaml` gives you a three-node Kubernetes 1.37 cluster in Docker.
- `kubectl` uses contexts from `~/.kube/config`; each context names a cluster, a user and a default namespace.
- This guide's app lives in the `demo` namespace, set as the default for the `kind-k8s-guide` context.
- Managed services run the control plane for you; kubeadm builds a cluster on your own machines from `pkgs.k8s.io` packages.

## Keep Learning

- [How to switch kubectl between clusters](/posts/how-to-switch-kubectl-clusters-between-gcloud-and-minikube)
- [List all pods and nodes in a cluster](/posts/kubernetes-list-all-pods-and-nodes)
- [A 5-minute Kubernetes cluster health check](/posts/5-minute-kubernetes-cluster-health-check)

Next, in [Part 3](/guides/introduction-to-kubernetes/03-pods-and-containers-in-kubernetes), you run your first pod on this cluster.
