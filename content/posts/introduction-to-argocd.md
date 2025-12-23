---
title: 'Introduction to ArgoCD: Getting Started with GitOps'
excerpt: 'Learn how ArgoCD brings GitOps principles to Kubernetes deployments. This hands-on guide covers core concepts, architecture, and practical examples to get you started with declarative, automated application delivery.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2025-12-07'
publishedAt: '2025-12-07T10:00:00Z'
updatedAt: '2025-12-07T10:00:00Z'
readingTime: '15 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: true
tags:
  - GitOps
  - ArgoCD
  - Kubernetes
  - CI/CD
  - Automation
  - Deployment
---

## TLDR

ArgoCD is a declarative, GitOps continuous delivery tool for Kubernetes that automatically synchronizes your cluster state with Git repositories. This guide introduces GitOps principles, ArgoCD's architecture, and walks you through deploying your first application. You'll learn how ArgoCD monitors Git repos for changes, automatically syncs applications, detects configuration drift, and enables one-click rollbacks. By the end, you'll understand why GitOps with ArgoCD is becoming the standard for modern Kubernetes deployments.

## What is GitOps?

Before diving into ArgoCD, let's understand the GitOps methodology it implements.

**GitOps** is a way of managing infrastructure and applications where Git is the single source of truth. Instead of manually applying changes or running deployment scripts, you declare your desired state in Git, and automated tools ensure your systems match that state.

### The Four Core Principles of GitOps

```
┌────────────────────────────────────────────────────────────┐
│ 1. Declarative Configuration                               │
│    Everything defined as code (YAML, JSON, etc.)           │
│                                                            │
│ 2. Git as Single Source of Truth                           │
│    All changes committed, reviewed, versioned in Git       │
│                                                            │
│ 3. Automated Synchronization                               │
│    Systems reconcile desired vs actual state               │
│                                                            │
│ 4. Continuous Reconciliation & Self-Healing                │
│    Automatic drift detection and correction                │
└────────────────────────────────────────────────────────────┘
```

### Traditional vs GitOps Deployment

**Traditional Approach:**
```bash
# Developer makes changes locally
$ kubectl apply -f deployment.yaml
$ kubectl set image deployment/myapp myapp=v2.0
$ kubectl scale deployment/myapp --replicas=5

# Problems:
# - No audit trail of who changed what
# - Manual steps prone to errors
# - Difficult to reproduce or rollback
# - Configuration drift over time
```

**GitOps Approach:**
```bash
# Developer commits changes to Git
$ git add deployment.yaml
$ git commit -m "Update app to v2.0, scale to 5 replicas"
$ git push origin main

# ArgoCD automatically:
# ✅ Detects the change in Git
# ✅ Validates the configuration
# ✅ Applies changes to cluster
# ✅ Reports sync status
# ✅ Maintains complete audit trail
```

> **Key Benefit**: With GitOps, your Git history becomes your deployment history. Every change is tracked, reviewed, and reversible.

---

## What is ArgoCD?

**ArgoCD** is a Kubernetes-native continuous delivery tool that implements GitOps patterns. Think of it as the bridge between your Git repository and your Kubernetes cluster.

### Why ArgoCD?

**The Manual Deployment Problem:**

Imagine managing 50 microservices across development, staging, and production environments. Each service has multiple Kubernetes manifests (Deployments, Services, ConfigMaps, Secrets). Every release involves:

- Running `kubectl apply` commands
- Checking if pods are running
- Verifying services are accessible
- Rolling back if something breaks
- Keeping track of what's deployed where

This quickly becomes unmanageable and error-prone.

**The ArgoCD Solution:**

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   Git Repo  │       │   ArgoCD    │       │ K8s Cluster │
│  (Desired   │       │             │       │   (Actual   │
│   State)    │       │             │       │    State)   │
└─────────────┘       └─────────────┘       └─────────────┘
       │                     │                      │
       │  1. Pulls for       │                      │
       │     changes         │                      │
       │◄────────────────────│                      │
       │                     │                      │
       │                     │  2. Compares states  │
       │                     │◄────────────────────►│
       │                     │                      │
       │                     │  3. Syncs if needed  │
       │                     │─────────────────────►│
```

ArgoCD continuously monitors your Git repositories, compares them with the running state in Kubernetes, and automatically synchronizes any differences.

### Key Features

- **🎯 Automated Deployment**: Push to Git, ArgoCD handles the rest
- **👁️ Real-time Monitoring**: Visual dashboards showing application health
- **🔄 Automatic Sync & Self-Healing**: Detects and corrects configuration drift
- **⏮️ Easy Rollback**: One-click rollback to any previous Git commit
- **🔐 Multi-tenancy & RBAC**: Control who can deploy what and where
- **🔌 Multiple Source Types**: Supports Helm, Kustomize, raw YAML, and more
- **🌐 Multi-cluster Support**: Manage multiple Kubernetes clusters from one ArgoCD instance

---

## ArgoCD Architecture

Understanding ArgoCD's components helps you troubleshoot issues and optimize your setup.

```
┌────────────────────────────────────────────────────────────┐
│                    ArgoCD Components                       │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────────┐                                        │
│  │   API Server     │  REST/gRPC API for CLI & UI        │
│  │                  │                                        │
│  └────────┬─────────┘                                        │
│           │                                                │
│           ▼                                                │
│  ┌──────────────────┐                                        │
│  │  Repo Server     │  Fetches & renders manifests       │
│  │                  │                                        │
│  └────────┬─────────┘                                        │
│           │                                                │
│           ▼                                                │
│  ┌──────────────────┐                                        │
│  │  Application     │  Reconciliation loop               │
│  │  Controller      │  (Desired vs Actual state)         │
│  └────────┬─────────┘                                        │
│           │                                                │
│           ▼                                                │
│  ┌──────────────────┐                                        │
│  │     Redis        │  Caching & temporary data          │
│  └──────────────────┘                                        │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Component Breakdown

**1. API Server**
- Exposes REST and gRPC APIs
- Handles authentication and authorization
- Serves the web UI
- Used by CLI and integrations

**2. Repository Server**
- Clones and caches Git repositories
- Generates Kubernetes manifests (Helm charts, Kustomize, etc.)
- Keeps local cache for performance

**3. Application Controller**
- The heart of ArgoCD
- Continuously monitors both Git and Kubernetes
- Detects differences (drift)
- Synchronizes applications when needed
- Manages application health status

**4. Redis**
- Caches frequently accessed data
- Stores temporary state information
- Improves performance

---

## Core Concepts

### Application

An **Application** in ArgoCD is a Kubernetes resource that defines:
- **Source**: Where to get the desired state (Git repo, branch, path)
- **Destination**: Where to deploy (cluster, namespace)
- **Sync Policy**: How to keep them in sync (manual or automatic)

Example Application definition:
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: myapp-production
  namespace: argocd
spec:
  # Where to get the desired state
  source:
    repoURL: https://github.com/mycompany/myapp-config
    targetRevision: main
    path: kubernetes/production
  
  # Where to deploy
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  
  # How to sync
  syncPolicy:
    automated:
      prune: true      # Delete resources not in Git
      selfHeal: true   # Correct drift automatically
```

### Project

A **Project** provides logical grouping and access control:
- Group related applications
- Define which Git repositories can be used
- Restrict which clusters/namespaces can be targeted
- Set RBAC policies

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: team-frontend
  namespace: argocd
spec:
  description: Frontend team applications
  
  # Allowed source repositories
  sourceRepos:
    - 'https://github.com/mycompany/frontend-*'
  
  # Allowed destinations
  destinations:
    - namespace: 'frontend-*'
      server: https://kubernetes.default.svc
  
  # Allowed resource types
  clusterResourceWhitelist:
    - group: ''
      kind: Namespace
```

### Sync Status

ArgoCD reports the relationship between Git and the cluster:

- **🟢 Synced**: Cluster matches Git (desired state)
- **🟡 OutOfSync**: Differences detected between Git and cluster
- **❓ Unknown**: Unable to determine status

### Health Status

ArgoCD monitors application health:

- **🟢 Healthy**: All resources running correctly
- **🟡 Progressing**: Resources being created/updated
- **🔴 Degraded**: Some resources failing
- **⏸️ Suspended**: Application paused (e.g., CronJob)
- **❓ Unknown**: Health cannot be determined

---

## Getting Started: Installing ArgoCD

Let's install ArgoCD and deploy your first application.

### Prerequisites

- A running Kubernetes cluster (local or cloud)
- `kubectl` configured to access your cluster
- Basic understanding of Kubernetes resources

### Installation

**1. Create ArgoCD namespace and install:**

```bash
# Create namespace
kubectl create namespace argocd

# Install ArgoCD
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Verify installation
kubectl get pods -n argocd

# Expected output:
# NAME                                  READY   STATUS    RESTARTS   AGE
# argocd-application-controller-0       1/1     Running   0          2m
# argocd-dex-server-xxx                 1/1     Running   0          2m
# argocd-redis-xxx                      1/1     Running   0          2m
# argocd-repo-server-xxx                1/1     Running   0          2m
# argocd-server-xxx                     1/1     Running   0          2m
```

**2. Access ArgoCD UI:**

```bash
# Expose the server (for local testing)
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Access UI at: https://localhost:8080
# (Accept the self-signed certificate warning)
```

**3. Get admin password:**

```bash
# The initial admin password is stored in a secret
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d && echo

# Login:
# Username: admin
# Password: (from above command)
```

**4. Install ArgoCD CLI (optional but recommended):**

```bash
# macOS
brew install argocd

# Linux
curl -sSL -o /usr/local/bin/argocd https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
chmod +x /usr/local/bin/argocd

# Windows
# Download from: https://github.com/argoproj/argo-cd/releases/latest
```

**5. Login via CLI:**

```bash
# Login to ArgoCD
argocd login localhost:8080 --username admin --password <password> --insecure

# Change admin password
argocd account update-password
```

> **🔒 Production Tip**: For production environments, configure proper ingress with TLS certificates and integrate with your identity provider (OIDC, SAML, LDAP).

---

## Deploying Your First Application

Let's deploy a simple web application using ArgoCD.

### Step 1: Prepare Your Git Repository

Create a Git repository with your Kubernetes manifests:

```bash
# Create a new repo or use existing one
mkdir myapp-config && cd myapp-config
git init

# Create deployment manifest
cat <<EOF > deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-app
spec:
  replicas: 2
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
        image: nginx:1.25
        ports:
        - containerPort: 80
EOF

# Create service manifest
cat <<EOF > service.yaml
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
EOF

# Commit and push
git add .
git commit -m "Add nginx deployment"
git remote add origin <your-repo-url>
git push -u origin main
```

### Step 2: Create ArgoCD Application

**Option A: Using the UI**

1. Open ArgoCD UI at `https://localhost:8080`
2. Click **"+ NEW APP"**
3. Fill in the details:
   - **Application Name**: `nginx-app`
   - **Project**: `default`
   - **Sync Policy**: `Manual` (for now)
   - **Repository URL**: Your Git repo URL
   - **Revision**: `main`
   - **Path**: `.` (root directory)
   - **Cluster**: `https://kubernetes.default.svc`
   - **Namespace**: `default`
4. Click **CREATE**

**Option B: Using the CLI**

```bash
argocd app create nginx-app \
  --repo https://github.com/yourusername/myapp-config \
  --path . \
  --dest-server https://kubernetes.default.svc \
  --dest-namespace default
```

**Option C: Using Kubernetes Manifest**

```bash
cat <<EOF | kubectl apply -f -
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: nginx-app
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/yourusername/myapp-config
    targetRevision: main
    path: .
  destination:
    server: https://kubernetes.default.svc
    namespace: default
  syncPolicy:
    automated:
      prune: false
      selfHeal: false
EOF
```

### Step 3: Sync the Application

Initially, your application will be **OutOfSync** because nothing has been deployed yet.

**Sync via UI:**
1. Click on your application card
2. Click **SYNC** button
3. Click **SYNCHRONIZE**

**Sync via CLI:**
```bash
argocd app sync nginx-app

# Watch the sync progress
argocd app wait nginx-app
```

**Verify deployment:**
```bash
# Check ArgoCD status
argocd app get nginx-app

# Check Kubernetes resources
kubectl get pods,svc

# You should see:
# NAME                         READY   STATUS    RESTARTS   AGE
# pod/nginx-app-xxx            1/1     Running   0          1m
# pod/nginx-app-yyy            1/1     Running   0          1m
#
# NAME                    TYPE        CLUSTER-IP      PORT(S)
# service/nginx-service   ClusterIP   10.96.xxx.xxx   80/TCP
```

🎉 **Congratulations!** You've just deployed your first application with ArgoCD.

---

## Experiencing GitOps in Action

Now let's see the real power of GitOps by making changes.

### Making a Change

**1. Update the deployment in Git:**

```bash
# Edit deployment.yaml to scale to 3 replicas
sed -i 's/replicas: 2/replicas: 3/' deployment.yaml

# Commit and push
git add deployment.yaml
git commit -m "Scale nginx to 3 replicas"
git push origin main
```

**2. ArgoCD detects the change:**

Within 3 minutes (default polling interval), ArgoCD will detect the difference:
- UI will show **OutOfSync** status
- The diff view shows what changed

**3. Sync the change:**

If you have manual sync:
```bash
argocd app sync nginx-app
```

If you have automatic sync enabled:
- ArgoCD automatically applies the change
- No manual intervention needed

**4. Verify:**
```bash
kubectl get pods
# You should now see 3 nginx pods
```

### Automatic Sync and Self-Healing

Enable automatic sync for true GitOps:

```bash
argocd app set nginx-app --sync-policy automated

# Enable self-healing (auto-correct drift)
argocd app set nginx-app --self-heal

# Enable auto-pruning (delete resources not in Git)
argocd app set nginx-app --auto-prune
```

**Test self-healing:**
```bash
# Manually delete a pod
kubectl delete pod -l app=nginx --force --grace-period=0

# ArgoCD detects drift and recreates the pod within seconds
kubectl get pods -w
```

**Test auto-pruning:**
```bash
# Manually create a resource
kubectl create configmap test-config --from-literal=key=value

# ArgoCD detects the extra resource and removes it
# (because it's not in Git)
```

> **💡 Best Practice**: Enable automated sync and self-healing for development/staging environments. Use manual sync for production until you're confident.

---

## Rollback Made Easy

One of ArgoCD's killer features is easy rollback.

### Scenario: Bad Deployment

```bash
# Push a bad change (wrong image tag)
sed -i 's/nginx:1.25/nginx:broken-tag/' deployment.yaml
git add deployment.yaml
git commit -m "Update nginx version"
git push origin main

# ArgoCD syncs it... pods start crashing
kubectl get pods
# NAME              READY   STATUS             RESTARTS   AGE
# nginx-app-xxx     0/1     ImagePullBackOff   0          30s
```

### Quick Rollback Options

**Option 1: Rollback via UI**
1. Click on application
2. Go to **HISTORY AND ROLLBACK** tab
3. Select previous healthy deployment
4. Click **ROLLBACK**

**Option 2: Rollback via CLI**
```bash
# View deployment history
argocd app history nginx-app

# Rollback to previous deployment (ID 1)
argocd app rollback nginx-app 1
```

**Option 3: Git Revert (The GitOps Way)**
```bash
# Revert the bad commit
git revert HEAD
git push origin main

# ArgoCD automatically syncs back to working state
```

All three methods work, but **Option 3 is most aligned with GitOps principles** - Git remains the source of truth.

---

## Common Use Cases

### Multi-Environment Deployments

Structure your repo for multiple environments:

```
myapp-config/
├── base/
│   ├── deployment.yaml
│   └── service.yaml
├── overlays/
│   ├── dev/
│   │   └── kustomization.yaml
│   ├── staging/
│   │   └── kustomization.yaml
│   └── production/
│       └── kustomization.yaml
```

Create separate ArgoCD applications:

```bash
# Development
argocd app create myapp-dev \
  --repo https://github.com/mycompany/myapp-config \
  --path overlays/dev \
  --dest-namespace dev

# Staging
argocd app create myapp-staging \
  --repo https://github.com/mycompany/myapp-config \
  --path overlays/staging \
  --dest-namespace staging

# Production
argocd app create myapp-production \
  --repo https://github.com/mycompany/myapp-config \
  --path overlays/production \
  --dest-namespace production
```

### Deploying Helm Charts

ArgoCD natively supports Helm:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: postgresql
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://charts.bitnami.com/bitnami
    chart: postgresql
    targetRevision: 12.5.8
    helm:
      values: |
        auth:
          username: myuser
          database: mydb
        primary:
          persistence:
            size: 10Gi
  destination:
    server: https://kubernetes.default.svc
    namespace: database
```

### Using Kustomize

ArgoCD automatically detects and renders Kustomize:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: myapp
spec:
  source:
    repoURL: https://github.com/mycompany/myapp
    targetRevision: main
    path: k8s/overlays/production
    # ArgoCD detects kustomization.yaml automatically
  destination:
    server: https://kubernetes.default.svc
    namespace: production
```

---

## Best Practices

### 1. Organize Your Repositories

**Mono-repo vs Multi-repo:**

**Mono-repo** (Single repo for all apps):
```
apps/
├── app1/
├── app2/
└── app3/
```
✅ Easier to manage
✅ Single source of truth
❌ Larger blast radius for mistakes

**Multi-repo** (Separate repos per app):
```
app1-config/
app2-config/
app3-config/
```
✅ Better isolation
✅ Easier access control
❌ More repos to manage

**Recommendation**: Start with mono-repo, split when teams grow.

### 2. Use App of Apps Pattern

Manage multiple applications with one ArgoCD application:

```yaml
# apps/root-app.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: root-app
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/mycompany/argocd-apps
    targetRevision: main
    path: apps
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

This single application deploys all your other applications.

### 3. Separate Config from Source Code

Keep application code and Kubernetes configs in separate repos:

```
myapp/              (Application source code)
myapp-config/       (Kubernetes manifests)
```

This separation:
- Prevents deployment triggers on every code commit
- Allows different teams to manage each repo
- Improves security (deploy keys vs write access)

### 4. Use Sync Windows

Prevent deployments during specific times:

```yaml
spec:
  syncPolicy:
    syncOptions:
    - CreateNamespace=true
    
  # Block syncs during business hours
  syncWindows:
  - kind: deny
    schedule: '0 9-17 * * 1-5'  # Mon-Fri, 9am-5pm
    duration: 8h
    applications:
    - '*-production'
```

### 5. Monitor and Alert

Integrate with monitoring systems:

```bash
# Expose ArgoCD metrics for Prometheus
kubectl port-forward svc/argocd-metrics -n argocd 8082:8082

# Available metrics:
# - argocd_app_sync_total
# - argocd_app_health_status
# - argocd_app_sync_status
```

Create alerts for:
- Applications stuck in **OutOfSync** status
- Applications with **Degraded** health
- Failed sync operations

---

## Troubleshooting Common Issues

### Application Stuck in OutOfSync

**Problem**: Changes pushed to Git but application won't sync.

**Solutions**:
```bash
# Check app status
argocd app get myapp

# View detailed sync status
argocd app diff myapp

# Force refresh from Git
argocd app get myapp --refresh

# Hard refresh (clear cache)
argocd app get myapp --hard-refresh
```

### Sync Failing with Errors

**Problem**: Sync fails with error messages.

**Check logs**:
```bash
# Application controller logs
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-application-controller

# Repo server logs
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-repo-server
```

**Common errors**:

| Error | Solution |
|-------|----------|
| `repository not found` | Check repo URL and credentials |
| `path does not exist` | Verify path in application spec |
| `failed to load live state` | Check RBAC permissions |
| `exceeded quota` | Check namespace resource quotas |

### Private Git Repositories

**Add SSH private key**:
```bash
# Add repository with SSH key
argocd repo add git@github.com:mycompany/private-repo.git \
  --ssh-private-key-path ~/.ssh/id_rsa
```

**Or use HTTPS with token**:
```bash
argocd repo add https://github.com/mycompany/private-repo.git \
  --username <username> \
  --password <personal-access-token>
```

---

## Next Steps

You've learned the fundamentals of ArgoCD and GitOps. Here's what to explore next:

### Intermediate Topics

1. **ApplicationSets** - Manage hundreds of applications with templates
2. **Notifications** - Set up Slack/email alerts for sync events
3. **SSO Integration** - Configure OIDC/SAML for team access
4. **Image Updater** - Automatically update container tags
5. **Multi-cluster Management** - Deploy to multiple Kubernetes clusters

### Advanced Topics

6. **Custom Health Checks** - Define health for custom resources
7. **Sync Phases and Hooks** - Pre/post-sync operations
8. **Resource Hooks** - Execute jobs during deployment
9. **Progressive Delivery** - Integrate with Argo Rollouts for canary/blue-green
10. **Disaster Recovery** - Backup and restore ArgoCD configuration

### Learning Resources

- **Official Documentation**: https://argo-cd.readthedocs.io/
- **CNCF ArgoCD**: https://www.cncf.io/projects/argo/
- **Argo Project**: https://argoproj.github.io/
- **GitOps Working Group**: https://opengitops.dev/

### Practice Ideas

1. Deploy a complete microservices application with ArgoCD
2. Set up automated deployments from your CI pipeline
3. Configure notifications to Slack for production deployments
4. Implement the App of Apps pattern for your infrastructure
5. Try out ApplicationSets for managing multiple environments

---

## Conclusion

ArgoCD transforms Kubernetes deployments by implementing GitOps principles. Instead of manually applying changes or relying on fragile scripts, you declare your desired state in Git and let ArgoCD handle the rest.

**Key takeaways:**

✅ **Git is your source of truth** - All changes go through Git's review and audit process
✅ **Automated synchronization** - ArgoCD continuously reconciles desired vs actual state
✅ **Self-healing** - Configuration drift is automatically corrected
✅ **Easy rollbacks** - Revert to any previous state with one click or Git command
✅ **Declarative** - Define what you want, not how to get there
✅ **Visibility** - Clear view of what's deployed, when, and by whom

GitOps with ArgoCD isn't just about automation - it's about **reliability, security, and collaboration**. Your entire deployment history is in Git, every change is tracked, and rolling back is trivial. Teams can work with confidence knowing that:

- Production always matches what's in Git
- Failed deployments are caught immediately
- Rollbacks are simple and safe
- All changes have an audit trail

Start small with a single application, get comfortable with the workflow, then gradually expand. Before you know it, you'll wonder how you ever managed deployments without GitOps.

**Ready to dive deeper?** Check out issue #635 for our upcoming interactive GitOps learning game where you'll practice deployment scenarios, drift detection, and rollback strategies.

---

*Have questions or want to share your ArgoCD setup? Join the discussion on our community channels or contribute to the conversation!*
