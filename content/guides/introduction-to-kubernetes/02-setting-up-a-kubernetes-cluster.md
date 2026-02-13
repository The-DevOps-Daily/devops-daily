---
title: Setting Up a Kubernetes Cluster
description: Learn different ways to create and configure a Kubernetes cluster for development and production
order: 2
---

With a solid understanding of Kubernetes architecture, you're ready to set up a cluster. This section covers various options for creating a Kubernetes cluster, from local development environments to production-ready setups.

## Kubernetes Cluster Options

There are several ways to run Kubernetes, depending on your needs:

1. **Local development clusters**: Lightweight options for your machine
2. **Self-managed clusters**: Full control over your infrastructure
3. **Managed Kubernetes services**: Cloud provider-managed control plane
4. **Kubernetes distributions**: Vendor-supported packages with additional features

Let's explore each option, starting with the simplest.

## Local Development Clusters

For learning and development, you can run Kubernetes on your local machine.

### Minikube

Minikube is a lightweight Kubernetes implementation that creates a VM on your local machine and deploys a simple cluster with a single node.

#### Prerequisites

- 2 CPUs or more
- 2GB of free memory
- 20GB of free disk space
- Container or virtual machine manager (Docker, Hyperkit, VirtualBox, etc.)

#### Installation

For macOS with Homebrew:

```bash
brew install minikube
```

For Windows with Chocolatey:

```bash
choco install minikube
```

For Linux:

```bash
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube
```

#### Starting a Cluster

Start a basic Minikube cluster:

```bash
minikube start
```

Or customize with more resources:

```bash
minikube start --cpus 4 --memory 8192 --disk-size 50g
```

Minikube provides a dashboard for visualization:

```bash
minikube dashboard
```

### Kind (Kubernetes IN Docker)

Kind runs Kubernetes clusters inside Docker containers, making it quick and easy to set up test clusters.

#### Installation

For macOS with Homebrew:

```bash
brew install kind
```

For Windows with Chocolatey:

```bash
choco install kind
```

For Linux:

```bash
curl -Lo ./kind https://kind.sigs.k8s.io/dl/latest/kind-linux-amd64
chmod +x ./kind
sudo mv ./kind /usr/local/bin/kind
```

#### Creating a Cluster

Create a basic Kind cluster:

```bash
kind create cluster --name my-cluster
```

For multi-node clusters, create a configuration file `kind-config.yaml`:

```yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
  - role: worker
  - role: worker
```

Then create the cluster with:

```bash
kind create cluster --config kind-config.yaml
```

### Docker Desktop

Docker Desktop for Mac and Windows includes a Kubernetes option that's easily enabled from the settings.

1. Open Docker Desktop preferences
2. Go to the Kubernetes tab
3. Check "Enable Kubernetes"
4. Click "Apply & Restart"

This is one of the simplest ways to start if you already use Docker Desktop.

## Self-Managed Production Clusters

For production workloads, you can set up and manage your own Kubernetes clusters.

### kubeadm

kubeadm is the official Kubernetes cluster bootstrapping tool. It handles the setup of the control plane and worker nodes.

#### Prerequisites

- Multiple Linux machines (virtual or physical)
- 2 GB or more of RAM per machine
- 2 CPUs or more per machine
- Full network connectivity between all machines in the cluster
- sudo privileges on all machines
- Container runtime installed (Docker, containerd, CRI-O)

#### Installation Steps

1. First, install kubeadm on all nodes:

```bash
# Update package list
sudo apt-get update

# Install prerequisites
sudo apt-get install -y apt-transport-https ca-certificates curl

# Add Kubernetes repository key
curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-archive-keyring.gpg

# Add Kubernetes repository
echo "deb [signed-by=/etc/apt/keyrings/kubernetes-archive-keyring.gpg] https://apt.kubernetes.io/ kubernetes-xenial main" | sudo tee /etc/apt/sources.list.d/kubernetes.list

# Update package list again
sudo apt-get update

# Install kubelet, kubeadm, and kubectl
sudo apt-get install -y kubelet kubeadm kubectl

# Pin their version to prevent auto-updates
sudo apt-mark hold kubelet kubeadm kubectl
```

2. On the control plane node, initialize the cluster:

```bash
sudo kubeadm init --pod-network-cidr=192.168.0.0/16
```

3. Set up kubectl access:

```bash
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config
```

4. Install a pod network add-on (example with Calico):

```bash
kubectl apply -f https://docs.projectcalico.org/manifests/calico.yaml
```

5. Join worker nodes to the cluster using the token from the kubeadm init output:

```bash
sudo kubeadm join <control-plane-IP>:6443 --token <token> --discovery-token-ca-cert-hash <hash>
```

### kubespray

Kubespray uses Ansible to automate Kubernetes cluster deployment and configuration in a more sophisticated manner than kubeadm.

```bash
# Clone the Kubespray repository
git clone https://github.com/kubernetes-sigs/kubespray.git
cd kubespray

# Install dependencies
pip install -r requirements.txt

# Copy the sample inventory and customize it
cp -rfp inventory/sample inventory/mycluster

# Update the inventory file with your servers
vi inventory/mycluster/inventory.ini

# Deploy Kubernetes with Ansible
ansible-playbook -i inventory/mycluster/inventory.ini cluster.yml -b
```

## Managed Kubernetes Services

Managed services offload the control plane management to cloud providers, allowing you to focus on your applications.

### DigitalOcean Kubernetes (DOKS)

DigitalOcean offers a managed Kubernetes service that simplifies setup and maintenance. [Sign up with DigitalOcean](https://www.jdoqocy.com/click-101674709-15836238) to get $200 in free credits to try DOKS.

You can create a cluster through the web UI or using their CLI tool, doctl:

```bash
# Install doctl
brew install doctl  # For macOS

# Authenticate with DigitalOcean
doctl auth init

# Create a Kubernetes cluster
doctl kubernetes cluster create my-cluster \
  --region nyc1 \
  --size s-2vcpu-4gb \
  --count 3
```

### Amazon EKS (Elastic Kubernetes Service)

Amazon EKS is AWS's managed Kubernetes service. You can create clusters through the AWS Management Console, AWS CLI, or eksctl:

```bash
eksctl create cluster \
  --name my-cluster \
  --region us-west-2 \
  --nodegroup-name standard-workers \
  --node-type t3.medium \
  --nodes 3 \
  --nodes-min 1 \
  --nodes-max 4
```

### Google Kubernetes Engine (GKE)

GKE is Google Cloud's managed Kubernetes service, often considered one of the most mature offerings:

```bash
gcloud container clusters create my-cluster \
  --zone us-central1-a \
  --num-nodes 3 \
  --machine-type e2-standard-2
```

### Azure Kubernetes Service (AKS)

Microsoft's managed Kubernetes offering:

```bash
az aks create \
  --resource-group myResourceGroup \
  --name myAKSCluster \
  --node-count 3 \
  --enable-addons monitoring \
  --generate-ssh-keys
```

## Kubernetes Distributions

Several vendors package Kubernetes with additional tools and support:

- **Red Hat OpenShift**: Enterprise Kubernetes platform with developer and operations-focused tools
- **Rancher**: Complete container management platform
- **VMware Tanzu Kubernetes Grid**: Enterprise-ready Kubernetes runtime
- **k3s**: Lightweight Kubernetes distribution for edge and IoT

## Accessing Your Cluster

No matter which option you choose, you'll interact with your cluster using kubectl, the Kubernetes command-line tool.

### Installing kubectl

For macOS:

```bash
brew install kubectl
```

For Windows with Chocolatey:

```bash
choco install kubernetes-cli
```

For Linux:

```bash
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/
```

### Configuring kubectl

kubectl uses a configuration file (kubeconfig) located at `~/.kube/config` by default.

For local clusters, the setup command usually configures kubectl automatically. For remote clusters, you'll need to download the kubeconfig:

```bash
# Example with DigitalOcean
doctl kubernetes cluster kubeconfig save my-cluster

# Example with AWS EKS
aws eks update-kubeconfig --name my-cluster --region us-west-2

# Example with GKE
gcloud container clusters get-credentials my-cluster --zone us-central1-a
```

### Verifying Cluster Access

Ensure kubectl can communicate with your cluster:

```bash
kubectl cluster-info
```

You should see the Kubernetes control plane address and CoreDNS information.

Check the nodes in your cluster:

```bash
kubectl get nodes
```

This should show all the nodes in your cluster with their status, roles, and versions.

## Cluster Configuration

### Setting Up a High-Availability Cluster

For production, a high-availability setup is crucial. This typically involves:

- Multiple control plane nodes
- Multiple worker nodes
- External etcd cluster
- Load balancer for the API server

If you're using kubeadm, initialize with:

```bash
kubeadm init --control-plane-endpoint "LOAD_BALANCER_DNS:LOAD_BALANCER_PORT" \
    --upload-certs \
    --pod-network-cidr=192.168.0.0/16
```

Then join additional control plane nodes with:

```bash
kubeadm join LOAD_BALANCER_DNS:LOAD_BALANCER_PORT \
    --token <token> \
    --discovery-token-ca-cert-hash <hash> \
    --control-plane \
    --certificate-key <certificate-key>
```

### Node Labels and Taints

Customize how pods are scheduled to nodes with labels and taints.

Add a label to a node:

```bash
kubectl label nodes worker-1 disktype=ssd
```

Add a taint to keep certain workloads away:

```bash
kubectl taint nodes worker-2 dedicated=gpu:NoSchedule
```

### Role-Based Access Control (RBAC)

Configure RBAC to control access to your cluster resources:

Create a role:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: default
  name: pod-reader
rules:
  - apiGroups: ['']
    resources: ['pods']
    verbs: ['get', 'watch', 'list']
```

Create a role binding:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: read-pods
  namespace: default
subjects:
  - kind: User
    name: jane
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

### Networking Add-ons

Kubernetes needs a Container Network Interface (CNI) plugin to handle pod networking:

- **Calico**: Provides networking and network policy
- **Flannel**: Simple overlay network
- **Cilium**: Advanced networking with eBPF
- **Weave Net**: Multi-host Docker networking

Install Calico with:

```bash
kubectl apply -f https://docs.projectcalico.org/manifests/calico.yaml
```

## Upgrading Clusters

Kubernetes releases new versions regularly. Upgrading involves these steps:

1. Upgrade the control plane
2. Upgrade worker nodes
3. Upgrade cluster add-ons

For kubeadm clusters:

```bash
# Control plane
sudo apt-get update
sudo apt-get install -y kubeadm=1.24.0-00
sudo kubeadm upgrade plan
sudo kubeadm upgrade apply v1.24.0

# Worker nodes
kubectl drain worker-1 --ignore-daemonsets
sudo apt-get update
sudo apt-get install -y kubelet=1.24.0-00 kubectl=1.24.0-00
sudo systemctl restart kubelet
kubectl uncordon worker-1
```

For managed services, upgrades are often just a few clicks in the UI or a simple CLI command.

## Backup and Disaster Recovery

Regularly back up your cluster's critical components:

- etcd data
- Persistent volumes
- Configuration

Back up etcd:

```bash
ETCDCTL_API=3 etcdctl \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  snapshot save snapshot.db
```

## Choosing the Right Option

When selecting a Kubernetes solution, consider these factors:

- **Expertise required**: Managed services require less Kubernetes expertise
- **Cost**: Self-managed can be cheaper but requires more operational effort
- **Control**: Self-managed provides more control over configuration
- **Scalability**: All solutions can scale, but with different levels of effort
- **Integration**: Consider how well it integrates with your existing tools

For many teams, starting with a managed service like DigitalOcean Kubernetes ([Get $200 in free credits](https://www.jdoqocy.com/click-101674709-15836238)) provides a good balance of simplicity and capability while learning.

In the next section, we'll explore how to work with pods and containers, the fundamental units of deployment in Kubernetes.
