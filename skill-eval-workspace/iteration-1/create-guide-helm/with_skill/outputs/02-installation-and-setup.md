---
title: 'Installing and Configuring Helm'
description: 'Install Helm on your workstation, configure repositories, and verify that everything works against your Kubernetes cluster.'
order: 2
---

With the core concepts under your belt, it is time to install Helm and get it talking to your Kubernetes cluster. Helm runs entirely on the client side, so installation is straightforward -- there is no server component to deploy. This part walks you through installation on all major platforms, initial configuration, and verification.

## Prerequisites

Before installing Helm, you need:

1. **A Kubernetes cluster** -- any cluster will do: minikube, kind, k3s, Docker Desktop, EKS, GKE, or AKS.
2. **kubectl installed and configured** -- Helm uses your kubeconfig to authenticate with the cluster. Run `kubectl cluster-info` to confirm connectivity.

```bash
kubectl cluster-info
```

```text
Kubernetes control plane is running at https://127.0.0.1:6443
CoreDNS is running at https://127.0.0.1:6443/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy
```

If that works, you are ready to install Helm.

## Installing Helm

### macOS (Homebrew)

The simplest method on macOS:

```bash
brew install helm
```

### Linux (Official Script)

Helm provides a one-liner installer script that detects your architecture and downloads the correct binary:

```bash
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

If you prefer a manual installation:

```bash
# Download the latest release
wget https://get.helm.sh/helm-v3.17.0-linux-amd64.tar.gz

# Extract the archive
tar -zxvf helm-v3.17.0-linux-amd64.tar.gz

# Move the binary to your PATH
sudo mv linux-amd64/helm /usr/local/bin/helm
```

### Windows

Using Chocolatey:

```bash
choco install kubernetes-helm
```

Using Scoop:

```bash
scoop install helm
```

Or download the `.zip` from the [Helm releases page](https://github.com/helm/helm/releases), extract it, and add `helm.exe` to your PATH.

### Verifying the Installation

Regardless of your platform, verify the installation:

```bash
helm version
```

```text
version.BuildInfo{Version:"v3.17.0", GitCommit:"301108edc7ac2a8ba79e4ebf5701c02beb878ee3", GitTreeState:"clean", GoVersion:"go1.23.4"}
```

## Configuring Helm Repositories

Out of the box, Helm does not come with any repositories configured. You need to add at least one to start installing charts.

### Adding the Bitnami Repository

Bitnami maintains one of the most comprehensive collections of Helm charts:

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
```

```text
"bitnami" has been added to your repositories
```

### Adding Multiple Repositories

You can add as many repositories as you need:

```bash
# Prometheus community charts
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts

# Ingress NGINX
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx

# Jetstack (cert-manager)
helm repo add jetstack https://charts.jetstack.io
```

### Updating Repository Indexes

After adding repositories, fetch the latest chart index:

```bash
helm repo update
```

```text
Hang tight while we grab the latest from your chart repositories...
...Successfully got an update from the "bitnami" chart repository
...Successfully got an update from the "prometheus-community" chart repository
...Successfully got an update from the "ingress-nginx" chart repository
...Successfully got an update from the "jetstack" chart repository
Update Complete. ⎈Happy Helming!⎈
```

You should run `helm repo update` periodically to ensure you have the latest chart versions.

### Listing and Removing Repositories

View your configured repositories:

```bash
helm repo list
```

```text
NAME                    URL
bitnami                 https://charts.bitnami.com/bitnami
prometheus-community    https://prometheus-community.github.io/helm-charts
ingress-nginx           https://kubernetes.github.io/ingress-nginx
jetstack                https://charts.jetstack.io
```

Remove a repository you no longer need:

```bash
helm repo remove jetstack
```

## Searching for Charts

Helm provides two search commands:

### Search Repositories

Search across all your added repositories:

```bash
helm search repo nginx
```

```text
NAME                            CHART VERSION   APP VERSION     DESCRIPTION
bitnami/nginx                   18.3.1          1.27.3          NGINX Open Source is a web server...
bitnami/nginx-ingress-controller 11.6.3         1.11.3          NGINX Ingress Controller is...
ingress-nginx/ingress-nginx     4.12.0          1.12.0          Ingress controller for Kubernetes...
```

### Search Artifact Hub

Search the broader Artifact Hub registry without needing to add each repo:

```bash
helm search hub wordpress
```

This returns charts from all public repositories registered on Artifact Hub.

### Viewing Chart Details

Before installing a chart, inspect it:

```bash
# Show the chart's README and description
helm show readme bitnami/nginx

# Show default values
helm show values bitnami/nginx

# Show the Chart.yaml metadata
helm show chart bitnami/nginx
```

The `helm show values` command is particularly useful because it reveals every configurable parameter the chart supports. Pipe it to a file to use as a starting point for your own overrides:

```bash
helm show values bitnami/nginx > my-nginx-values.yaml
```

## Helm Environment and Configuration

Helm stores its configuration in your home directory. You can inspect the environment paths:

```bash
helm env
```

```text
HELM_BIN="helm"
HELM_CACHE_HOME="/home/user/.cache/helm"
HELM_CONFIG_HOME="/home/user/.config/helm"
HELM_DATA_HOME="/home/user/.local/share/helm"
HELM_DEBUG="false"
HELM_KUBEAPISERVER=""
HELM_KUBECAFILE=""
HELM_KUBECONTEXT=""
HELM_KUBETOKEN=""
HELM_MAX_HISTORY="10"
HELM_NAMESPACE="default"
HELM_PLUGINS="/home/user/.local/share/helm/plugins"
HELM_REGISTRY_CONFIG="/home/user/.config/helm/registry/config.json"
HELM_REPOSITORY_CACHE="/home/user/.cache/helm/repository"
HELM_REPOSITORY_CONFIG="/home/user/.config/helm/repositories.yaml"
```

Key environment variables you may want to customize:

- `HELM_NAMESPACE` -- set a default namespace so you do not have to pass `--namespace` every time.
- `HELM_MAX_HISTORY` -- controls how many release revisions Helm retains. The default of 10 is reasonable, but you may increase it for audit-heavy environments.
- `HELM_KUBECONTEXT` -- pin Helm to a specific kubeconfig context.

You can set these in your shell profile:

```bash
# ~/.bashrc or ~/.zshrc
export HELM_NAMESPACE=my-team
export HELM_MAX_HISTORY=20
```

## Shell Autocompletion

Helm supports autocompletion for Bash, Zsh, Fish, and PowerShell. This significantly speeds up your workflow:

```bash
# Bash
source <(helm completion bash)

# Zsh
source <(helm completion zsh)

# To make it permanent, add to your profile:
echo 'source <(helm completion bash)' >> ~/.bashrc
```

## Verifying Cluster Connectivity

As a final check, try installing a simple chart:

```bash
helm install my-nginx bitnami/nginx --set service.type=ClusterIP
```

Then verify the release exists:

```bash
helm list
```

```text
NAME      NAMESPACE  REVISION  UPDATED                   STATUS    CHART          APP VERSION
my-nginx  default    1         2026-03-20 11:00:00 UTC   deployed  nginx-18.3.1   1.27.3
```

Clean up:

```bash
helm uninstall my-nginx
```

Your Helm installation is now fully configured. In the next part, we will explore how to work with existing charts in more depth -- customizing values, managing releases, and handling upgrades.
