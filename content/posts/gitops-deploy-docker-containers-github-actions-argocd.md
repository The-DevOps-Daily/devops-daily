---
title: 'GitOps: Deploy Docker Containers with GitHub Actions and ArgoCD'
excerpt: 'Learn how to implement a modern GitOps workflow for Docker deployments. This guide covers building images with GitHub Actions, pushing to container registries, and automated deployments with ArgoCD.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-01-24'
publishedAt: '2025-01-24T10:00:00Z'
updatedAt: '2025-01-24T10:00:00Z'
readingTime: '14 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - GitHub Actions
  - CI/CD
  - GitOps
  - ArgoCD
  - Kubernetes
---

GitOps is the modern way to deploy containerized applications. Instead of SSH-ing into servers or manually triggering deployments, you declare your desired state in Git and let automated tools handle the rest. This guide shows you how to build a complete GitOps pipeline using GitHub Actions for continuous integration and ArgoCD for continuous deployment to Kubernetes.

## What is GitOps?

GitOps uses Git as the single source of truth for your infrastructure and application deployments. The core principles are:

- **Declarative Configuration**: Define your desired state in YAML files
- **Version Controlled**: All changes go through Git with full history
- **Automated Sync**: Tools continuously reconcile actual state with desired state
- **Pull-Based Deployment**: The cluster pulls changes rather than CI pushing them

```
How GitOps Works (Step by Step):

  1. You push code to GitHub
         |
         v
  2. GitHub Actions builds a Docker image
         |
         v
  3. Image is pushed to a container registry (like GHCR)
         |
         v
  4. GitHub Actions updates the GitOps repo with the new image tag
         |
         v
  5. ArgoCD (running in your cluster) watches the GitOps repo
         |
         v
  6. ArgoCD sees the change and deploys the new version automatically


The key insight: Your cluster PULLS updates from Git.
You never SSH into servers or run kubectl manually.
```

## Why GitOps Over Traditional SSH Deployments?

Traditional CI/CD often uses SSH to push changes to servers:

| Traditional SSH | GitOps |
|-----------------|--------|
| CI pushes to servers | Cluster pulls from Git |
| Secrets in CI pipelines | Secrets stay in cluster |
| Imperative commands | Declarative manifests |
| Hard to audit | Full Git history |
| Drift goes undetected | Continuous reconciliation |

GitOps provides better security (no SSH keys in CI), better auditability (Git history), and self-healing capabilities (automatic drift correction).

## Prerequisites

Before you begin, ensure you have:

- A GitHub repository with your application code
- Docker installed locally for testing
- A Kubernetes cluster (minikube, kind, or cloud-based)
- kubectl configured to access your cluster
- Basic familiarity with Kubernetes manifests

## Project Structure

The recommended GitOps setup uses two repositories:

```
my-app/                    # Application Repository
├── src/
├── Dockerfile
├── package.json
└── .github/workflows/
    └── ci.yaml            # Build and push image

my-app-gitops/             # GitOps Repository  
├── base/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── kustomization.yaml
└── overlays/
    ├── staging/
    │   └── kustomization.yaml
    └── production/
        └── kustomization.yaml
```

This separation keeps application code and deployment configuration independent, allowing different teams to manage each.

## Step 1: Configure GitHub Actions for CI

Create a workflow that builds your Docker image and pushes it to GitHub Container Registry (GHCR).

Create `.github/workflows/ci.yaml`:

```yaml
name: CI Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    outputs:
      image_tag: ${{ steps.meta.outputs.version }}

    steps:
    - name: Checkout repository
      uses: actions/checkout@v4

    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3

    - name: Log in to Container Registry
      if: github.event_name != 'pull_request'
      uses: docker/login-action@v3
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}

    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
        tags: |
          type=sha,prefix=
          type=raw,value=latest,enable=${{ github.ref == 'refs/heads/main' }}

    - name: Build and push
      uses: docker/build-push-action@v5
      with:
        context: .
        push: ${{ github.event_name != 'pull_request' }}
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max

  update-gitops:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
    - name: Checkout GitOps repo
      uses: actions/checkout@v4
      with:
        repository: ${{ github.repository_owner }}/my-app-gitops
        token: ${{ secrets.GITOPS_TOKEN }}
        path: gitops

    - name: Update image tag
      run: |
        cd gitops
        SHORT_SHA=$(echo "${{ github.sha }}" | cut -c1-7)
        sed -i "s|newTag:.*|newTag: ${SHORT_SHA}|" overlays/staging/kustomization.yaml
        
        git config user.name "GitHub Actions"
        git config user.email "actions@github.com"
        git add .
        git diff --staged --quiet || git commit -m "chore: update image to ${SHORT_SHA}"
        git push
```

The workflow does two things:
1. **Builds and pushes** the Docker image to GHCR with the commit SHA as tag
2. **Updates the GitOps repository** with the new image tag

## Step 2: Set Up the GitOps Repository

Create your Kubernetes manifests using Kustomize for easy environment management.

### Base Manifests

**base/deployment.yaml**:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
      - name: my-app
        image: ghcr.io/your-org/my-app
        ports:
        - containerPort: 3000
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

**base/service.yaml**:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-app
spec:
  selector:
    app: my-app
  ports:
  - port: 80
    targetPort: 3000
```

**base/kustomization.yaml**:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - deployment.yaml
  - service.yaml
```

### Environment Overlays

**overlays/staging/kustomization.yaml**:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: staging
resources:
  - ../../base
images:
  - name: ghcr.io/your-org/my-app
    newTag: latest
```

**overlays/production/kustomization.yaml**:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: production
resources:
  - ../../base
replicas:
  - name: my-app
    count: 3
images:
  - name: ghcr.io/your-org/my-app
    newTag: stable
```

## Step 3: Install ArgoCD

Install ArgoCD on your Kubernetes cluster:

```bash
# Create namespace
kubectl create namespace argocd

# Install ArgoCD
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for pods to be ready
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=argocd-server -n argocd --timeout=120s
```

Get the initial admin password:

```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

Access the ArgoCD UI:

```bash
kubectl port-forward svc/argocd-server -n argocd 8080:443
# Visit https://localhost:8080 (username: admin)
```

## Step 4: Create an ArgoCD Application

Create an ArgoCD Application that watches your GitOps repository.

**argocd-application.yaml**:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app-staging
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/your-org/my-app-gitops
    targetRevision: HEAD
    path: overlays/staging
  destination:
    server: https://kubernetes.default.svc
    namespace: staging
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

Apply it:

```bash
kubectl apply -f argocd-application.yaml
```

Key settings:
- **automated.prune**: Removes resources deleted from Git
- **automated.selfHeal**: Reverts manual changes to match Git
- **CreateNamespace**: Automatically creates the namespace if missing

## Step 5: Configure Secrets

Add these secrets to your **application repository** (Settings → Secrets → Actions):

| Secret | Description |
|--------|-------------|
| `GITOPS_TOKEN` | Personal access token with write access to GitOps repo |

The `GITHUB_TOKEN` is automatically provided for GHCR access.

### Creating the GitOps Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. Create a token with:
   - Repository access: Select your GitOps repository
   - Permissions: Contents (Read and write)
3. Copy the token and add it as `GITOPS_TOKEN` secret

## The Complete Flow

Here's what happens when you push code:

```
Timeline:

0s     ──▶  Developer pushes code to main
30s    ──▶  GitHub Actions starts build job
2min   ──▶  Docker image built and pushed to GHCR
2.5min ──▶  GitOps repo updated with new tag
5min   ──▶  ArgoCD detects change and syncs
6min   ──▶  New version deployed and healthy ✓
```

1. **Push to main** → GitHub Actions triggers
2. **Build & Test** → Docker image is built
3. **Push to GHCR** → Image tagged with commit SHA
4. **Update GitOps Repo** → Staging kustomization updated
5. **ArgoCD Syncs** → Detects change within ~3 minutes
6. **Deploy** → Applies new manifests to cluster
7. **Health Check** → Verifies deployment is healthy

## Promoting to Production

For production deployments, manually update the production overlay:

```bash
cd my-app-gitops

# Get the tested tag from staging
STAGING_TAG=$(grep 'newTag:' overlays/staging/kustomization.yaml | awk '{print $2}')

# Update production
sed -i "s|newTag:.*|newTag: ${STAGING_TAG}|" overlays/production/kustomization.yaml

git add .
git commit -m "promote: ${STAGING_TAG} to production"
git push
```

Or better yet, create a pull request for production changes to require team approval.

## Rollback with Git

GitOps makes rollbacks trivial—just revert the Git commit:

```bash
cd my-app-gitops
git revert HEAD
git push
# ArgoCD automatically rolls back the deployment
```

Or use ArgoCD's UI to sync to a previous commit:

```bash
argocd app sync my-app-staging --revision <previous-commit-sha>
```

## Monitoring with ArgoCD

ArgoCD provides built-in status monitoring:

```bash
# Check application status
argocd app get my-app-staging

# View sync history
argocd app history my-app-staging

# Manual sync if auto-sync is disabled
argocd app sync my-app-staging

# Check for drift
argocd app diff my-app-staging
```

## Best Practices

1. **Separate CI and CD**: CI builds images, CD deploys them
2. **Never auto-sync production**: Require manual promotion or PR approval
3. **Use semantic versioning**: Tag releases for easy identification
4. **Enable selfHeal for staging**: Fast feedback, catch configuration drift
5. **Keep secrets out of Git**: Use Sealed Secrets or External Secrets Operator
6. **Monitor sync status**: Set up alerts for failed syncs

## Troubleshooting

### ArgoCD Not Syncing

```bash
# Check application status
argocd app get my-app-staging

# View detailed sync status
argocd app sync-status my-app-staging

# Check ArgoCD logs
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-repo-server
```

### Image Pull Errors

If your cluster can't pull from GHCR, create an image pull secret:

```bash
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=YOUR_GITHUB_USERNAME \
  --docker-password=YOUR_GITHUB_TOKEN \
  -n staging
```

Add to your deployment:

```yaml
spec:
  imagePullSecrets:
    - name: ghcr-secret
```

### Sync Conflicts

If someone manually changed resources in the cluster:

```bash
# Force sync to override manual changes
argocd app sync my-app-staging --force
```

## Alternative: Flux CD

Flux is another popular GitOps tool with similar capabilities:

```bash
flux bootstrap github \
  --owner=your-org \
  --repository=my-app-gitops \
  --path=overlays/staging \
  --personal
```

Both ArgoCD and Flux are CNCF projects with active communities. ArgoCD has a better UI; Flux integrates more tightly with Git.

## Summary

With this GitOps setup, you have:

- **Declarative deployments**: Everything defined in Git
- **Automated sync**: ArgoCD handles deployment automatically  
- **Easy rollbacks**: Just revert the Git commit
- **Multi-environment support**: Staging and production with Kustomize overlays
- **Audit trail**: Git history shows who deployed what and when
- **Self-healing**: Cluster automatically reverts unauthorized changes

GitOps is the industry standard for Kubernetes deployments. No more SSH scripts or manual kubectl commands—your Git repository becomes the single source of truth, and your cluster stays in sync automatically.
