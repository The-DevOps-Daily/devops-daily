---
title: Kubernetes Architecture and Components
description: 'Kubernetes architecture explained: control plane parts (API server, etcd, scheduler, controller manager) and worker node pieces (kubelet, kube-proxy, runtime).'
order: 1
---

Before diving into Kubernetes operations, it's important to understand its architecture and how the various components work together. This knowledge forms the foundation for everything else you'll do with Kubernetes.

## The Big Picture

At its core, Kubernetes is a platform for running and coordinating containerized workloads. It abstracts away the underlying infrastructure, allowing you to describe your desired state of applications, and Kubernetes works to maintain that state.

Kubernetes follows a client-server architecture with multiple components that work together:

```
┌─────────────────────────────────────────────────────────────┐
│                     Kubernetes Cluster                      │
│                                                             │
│  ┌─────────────┐                 ┌─────────────────────┐    │
│  │             │                 │     Worker Node     │    │
│  │             │                 │  ┌──────────────┐   │    │
│  │   Control   │                 │  │   Pod        │   │    │
│  │    Plane    │◄───────────────►│  │ ┌──────────┐ │   │    │
│  │             │                 │  │ │Container │ │   │    │
│  │             │                 │  │ └──────────┘ │   │    │
│  │             │                 │  └──────────────┘   │    │
│  └─────────────┘                 │                     │    │
│                                  │  ┌──────────────┐   │    │
│                                  │  │kubelet       │   │    │
│                                  │  │kube-proxy    │   │    │
│                                  │  │container     │   │    │
│                                  │  │runtime       │   │    │
│                                  │  └──────────────┘   │    │
│                                  └─────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Control Plane Components

The control plane is the brain of Kubernetes. It makes global decisions about the cluster and detects and responds to events. These components can run on a single primary node or be replicated across multiple nodes for high availability.

### kube-apiserver

The API server is the front end of the Kubernetes control plane, exposing the Kubernetes API. It's designed to scale horizontally by deploying more instances.

```bash
# Example API server interaction using kubectl
kubectl get pods --all-namespaces
```

When you run this command, `kubectl` communicates with the kube-apiserver, which then validates the request, retrieves the data from etcd, and returns the result.

### etcd

etcd is a consistent and highly-available key-value store used as Kubernetes' backing store for all cluster data. It stores the complete state of the cluster, including configuration, status, and metadata.

```bash
# You typically won't interact with etcd directly, but can using etcdctl
etcdctl get /registry/pods/default/nginx-pod
```

### kube-scheduler

The scheduler watches for newly created pods that haven't been assigned to a node and selects a node for them to run on based on various factors:

- Resource requirements
- Hardware/software/policy constraints
- Affinity and anti-affinity specifications
- Data locality
- Deadlines

```yaml
# Example pod with scheduling constraints
apiVersion: v1
kind: Pod
metadata:
  name: nginx
spec:
  containers:
    - name: nginx
      image: nginx:1.14
  nodeSelector:
    disktype: ssd # Scheduler will place this on nodes with this label
```

### kube-controller-manager

The controller manager runs controller processes, which are control loops that watch the state of the cluster and make changes to move the current state toward the desired state. Examples include:

- Node controller: Notices and responds when nodes go down
- Job controller: Watches for Job objects that represent one-off tasks
- Endpoints controller: Populates the Endpoints object with service endpoints
- Service Account & Token controllers: Create default accounts and API access tokens

### cloud-controller-manager

The cloud controller manager integrates with your cloud provider's API, allowing your cluster to interact with the cloud provider's resources. It handles cloud-specific control logic for services, nodes, and routing.

## Node Components

Node components run on every node in the cluster, maintaining running pods and providing the Kubernetes runtime environment.

### kubelet

The kubelet is an agent that runs on each node. It ensures that containers are running in a pod by:

- Taking a set of PodSpecs provided by the API server
- Ensuring the containers described in those PodSpecs are running and healthy
- Reporting back to the control plane about node and pod state

```bash
# View kubelet status
systemctl status kubelet
```

### kube-proxy

kube-proxy is a network proxy that runs on each node, implementing part of the Kubernetes Service concept. It maintains network rules that allow network communication to your Pods from network sessions inside or outside your cluster.

```bash
# kube-proxy typically runs as a DaemonSet
kubectl get pods -n kube-system | grep kube-proxy
```

### Container Runtime

The container runtime is the software responsible for running containers. Kubernetes supports container runtimes like Docker, containerd, CRI-O, and any implementation of the Kubernetes CRI (Container Runtime Interface).

```bash
# Check which container runtime is being used
kubectl get nodes -o wide
```

## Kubernetes Objects

Kubernetes objects are persistent entities in the Kubernetes system that represent the state of your cluster. They describe:

- What containerized applications are running (and on which nodes)
- The resources available to those applications
- The policies around how those applications behave (restart policies, upgrades, fault-tolerance)

### Pod

The smallest deployable unit in Kubernetes. A Pod represents a set of running containers on your cluster.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-pod
spec:
  containers:
    - name: nginx
      image: nginx:1.14
      ports:
        - containerPort: 80
```

### Deployment

A Deployment provides declarative updates for Pods and ReplicaSets, allowing you to describe an application's life cycle, such as which images to use, the number of pods, and the way to update them.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
        - name: nginx
          image: nginx:1.14
          ports:
            - containerPort: 80
```

### Service

A Service is an abstraction which defines a logical set of Pods and a policy by which to access them. Services enable network access to a set of Pods.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: nginx-service
spec:
  selector:
    app: nginx
  ports:
    - port: 80
      targetPort: 80
  type: ClusterIP
```

### Namespaces

Namespaces provide a mechanism for isolating groups of resources within a single cluster. Names of resources need to be unique within a namespace, but not across namespaces.

```bash
# List all namespaces
kubectl get namespaces
```

## Kubernetes API

The Kubernetes API allows you to query and manipulate the state of objects in the Kubernetes system. At the core of the Kubernetes control plane is the API server and the HTTP API that it exposes.

The API is organized into:

1. **Core Group** (`/api/v1`): Contains objects such as pods, services, and nodes
2. **Named Groups** (`/apis/$GROUP_NAME/$VERSION`): Like `apps/v1` for Deployments, StatefulSets, etc.

All API access is over HTTPS, and the API server validates and configures data for API objects.

```bash
# Get API resources available in your cluster
kubectl api-resources
```

## Declarative vs Imperative Management

Kubernetes favors a declarative approach: you tell it what you want (the desired state), and it figures out how to make it happen. This is different from imperative management, where you give specific commands to achieve a certain state.

```bash
# Imperative approach (telling Kubernetes what to do)
kubectl run nginx --image=nginx:1.14

# Declarative approach (describing what you want)
kubectl apply -f nginx-deployment.yaml
```

The declarative approach is preferred because:

- It's easier to review, track changes, and roll back
- It supports GitOps workflows
- It makes infrastructure as code possible

## High-Level Architecture Diagram

Here's a simplified view of how the components interact:

```
 ┌──────────────┐     │     ┌──────────────┐
 │   kubectl    │     │     │   Developer  │
 └──────┬───────┘     │     └──────┬───────┘
        │             │            │
        │ HTTP        │            │ HTTP
        │ API         │            │ API
        ▼             │            ▼
┌───────────────────────────────────────┐
│                                       │
│            kube-apiserver             │
│                                       │
└─────┬───────────┬────────────┬────────┘
      │           │            │
      ▼           ▼            ▼
┌───────────┐┌─────────┐┌────────────────┐
│    etcd   ││scheduler││controller mgr  │
└───────────┘└─────────┘└────────────────┘
      │           │            │
      └───────────┼────────────┘
                  │
┌─────────────────┼─────────────────┐
│                 │                 │
▼                 ▼                 ▼
┌───────────────────┐  ┌───────────────────┐
│    Worker Node    │  │    Worker Node    │
│ ┌───────────────┐ │  │ ┌───────────────┐ │
│ │    kubelet    │ │  │ │    kubelet    │ │
│ └───────┬───────┘ │  │ └───────┬───────┘ │
│         │         │  │         │         │
│ ┌───────▼───────┐ │  │ ┌───────▼───────┐ │
│ │    Pod(s)     │ │  │ │    Pod(s)     │ │
│ └───────────────┘ │  │ └───────────────┘ │
│                   │  │                   │
│ ┌───────────────┐ │  │ ┌───────────────┐ │
│ │  kube-proxy   │ │  │ │  kube-proxy   │ │
│ └───────────────┘ │  │ └───────────────┘ │
└───────────────────┘  └───────────────────┘
```

## Communication Paths

Understanding the communication flow in Kubernetes helps diagnose problems:

1. **kubectl to API Server**: TLS-encrypted HTTP
2. **API Server to kubelet**: TLS-encrypted HTTP
3. **API Server to Node/Pod/Service**: Uses kubectl proxy when debugging
4. **Kubelet to API Server**: TLS-encrypted HTTP
5. **Kubelet to Container Runtime**: Uses Container Runtime Interface (CRI)
6. **Kube-proxy to API Server**: TLS-encrypted HTTP
7. **Controller Manager to API Server**: TLS-encrypted HTTP
8. **Scheduler to API Server**: TLS-encrypted HTTP

## Kubernetes Terminology

As you continue exploring Kubernetes, you'll encounter these common terms:

- **Node**: A worker machine that runs containerized applications
- **Pod**: The smallest deployable unit, consisting of one or more containers
- **Service**: An abstraction that defines a logical set of Pods and a policy to access them
- **Volume**: A directory accessible to containers in a Pod
- **Namespace**: A virtual cluster to divide cluster resources
- **Label**: Key-value pairs attached to objects for identification and selection
- **Annotation**: Non-identifying metadata attached to objects
- **StatefulSet**: Manages the deployment and scaling of a set of Pods with guarantees about ordering and uniqueness
- **DaemonSet**: Ensures all (or some) Nodes run a copy of a Pod
- **Job**: Creates one or more Pods that run to completion
- **CronJob**: Creates Jobs on a time-based schedule
- **Ingress**: Manages external access to services, typically HTTP
- **ConfigMap**: Stores non-confidential configuration data
- **Secret**: Stores sensitive information like passwords and tokens

Understanding Kubernetes architecture isn't just academic, it helps you design, deploy, and troubleshoot applications effectively. In the next section, we'll explore how to set up your first Kubernetes cluster.
