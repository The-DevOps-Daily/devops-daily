---
title: 'kubectl apply vs kubectl create: Understanding the Key Differences'
excerpt: 'Learn the differences between kubectl apply and kubectl create commands, when to use each, and how they handle resource management in Kubernetes deployments.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2024-12-13'
publishedAt: '2024-12-13T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Kubernetes
  - kubectl
  - deployment
  - resource management
  - DevOps
---

Understanding the difference between `kubectl apply` and `kubectl create` is crucial for effective Kubernetes resource management. While both commands can create resources, they behave differently when resources already exist and handle updates in distinct ways that affect your deployment workflow.

## Prerequisites

You'll need kubectl configured to access a Kubernetes cluster and basic familiarity with Kubernetes resources like pods, deployments, and services. Having YAML manifest files will help you follow the practical examples.

## kubectl create: Imperative Resource Creation

The `kubectl create` command follows an imperative approach, creating resources exactly as specified without considering existing state. It fails if a resource with the same name already exists.

**Basic syntax:**

```bash
kubectl create -f resource.yaml
kubectl create -f directory/
kubectl create -f https://example.com/resource.yaml
```

**Example deployment creation:**

```bash
# Create a deployment from YAML file
kubectl create -f deployment.yaml

# Create multiple resources from a directory
kubectl create -f manifests/

# Create a deployment imperatively
kubectl create deployment nginx --image=nginx:1.20
```

**Key characteristics of kubectl create:**

- Fails if resource already exists
- Purely imperative operation
- No tracking of configuration changes
- Faster for one-time resource creation
- Cannot update existing resources

## kubectl apply: Declarative Resource Management

The `kubectl apply` command follows a declarative approach, ensuring the cluster state matches your desired configuration. It can create new resources or update existing ones.

**Basic syntax:**

```bash
kubectl apply -f resource.yaml
kubectl apply -f directory/
kubectl apply -f https://example.com/resource.yaml
```

**Example deployment management:**

```bash
# Apply a deployment (create or update)
kubectl apply -f deployment.yaml

# Apply all manifests in a directory
kubectl apply -f manifests/

# Apply with recursive directory traversal
kubectl apply -R -f manifests/
```

**Key characteristics of kubectl apply:**

- Creates or updates resources as needed
- Tracks configuration in annotations
- Supports three-way merge for updates
- Idempotent operations
- Declarative resource management

## Practical Comparison Examples

**Creating a new deployment:**

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web-app
  template:
    metadata:
      labels:
        app: web-app
    spec:
      containers:
        - name: web
          image: nginx:1.20
          ports:
            - containerPort: 80
```

**Using kubectl create:**

```bash
# First time - succeeds
kubectl create -f deployment.yaml

# Second time - fails with error
kubectl create -f deployment.yaml
# Error: deployments.apps "web-app" already exists
```

**Using kubectl apply:**

```bash
# First time - creates the deployment
kubectl apply -f deployment.yaml
# deployment.apps/web-app created

# Second time - reports no changes
kubectl apply -f deployment.yaml
# deployment.apps/web-app unchanged
```

## Updating Resources

When you need to modify existing resources, the difference becomes more apparent:

**Modified deployment (updated image):**

```yaml
# deployment.yaml (modified)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
spec:
  replicas: 5 # Changed from 3 to 5
  selector:
    matchLabels:
      app: web-app
  template:
    metadata:
      labels:
        app: web-app
    spec:
      containers:
        - name: web
          image: nginx:1.21 # Updated from nginx:1.20
          ports:
            - containerPort: 80
```

**Updating with kubectl create:**

```bash
# This will fail because resource exists
kubectl create -f deployment.yaml
# Error: deployments.apps "web-app" already exists

# Must delete first, then create (disruptive)
kubectl delete -f deployment.yaml
kubectl create -f deployment.yaml
```

**Updating with kubectl apply:**

```bash
# This succeeds and updates the deployment
kubectl apply -f deployment.yaml
# deployment.apps/web-app configured
```

## Understanding Three-Way Merge

kubectl apply uses a three-way merge strategy that considers:

1. **Current configuration** (your YAML file)
2. **Live configuration** (current cluster state)
3. **Last applied configuration** (stored in annotations)

**Viewing last applied configuration:**

```bash
kubectl get deployment web-app -o yaml | grep "last-applied-configuration"
```

This annotation enables kubectl apply to make intelligent decisions about what changes to apply.

## When to Use Each Command

**Use kubectl create when:**

- Creating resources for the first time in scripts
- You want strict control over resource creation
- Working with temporary or test resources
- You need the operation to fail if resource exists
- Creating resources imperatively for debugging

**Example script using kubectl create:**

```bash
#!/bin/bash
# setup-test-environment.sh

echo "Creating test namespace..."
kubectl create namespace test-env

echo "Creating test deployment..."
kubectl create deployment test-app --image=nginx -n test-env

echo "Exposing deployment..."
kubectl create service clusterip test-app --tcp=80:80 -n test-env
```

**Use kubectl apply when:**

- Managing resources with configuration files
- Implementing GitOps workflows
- You want idempotent operations
- Managing long-lived resources
- Working with CI/CD pipelines

**Example GitOps workflow using kubectl apply:**

```bash
#!/bin/bash
# deploy-application.sh

echo "Applying application manifests..."
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml

echo "Deployment complete!"
```

## Advanced Usage Patterns

**Conditional resource creation with kubectl create:**

```bash
# Create only if not exists
if ! kubectl get deployment web-app 2>/dev/null; then
    kubectl create -f deployment.yaml
else
    echo "Deployment already exists"
fi
```

**Dry run to preview changes:**

```bash
# Preview what kubectl create would do
kubectl create -f deployment.yaml --dry-run=client -o yaml

# Preview what kubectl apply would do
kubectl apply -f deployment.yaml --dry-run=client -o yaml

# Server-side dry run (validates against API)
kubectl apply -f deployment.yaml --dry-run=server
```

**Applying with validation:**

```bash
# Strict validation
kubectl apply -f deployment.yaml --validate=true

# Apply with warnings for deprecated APIs
kubectl apply -f deployment.yaml --warnings-as-errors=false
```

## Force Operations

Sometimes you need to force operations when resources are in inconsistent states:

**Force creation (replace existing):**

```bash
# Delete and recreate with create
kubectl create -f deployment.yaml --force

# Force apply (not recommended for normal use)
kubectl apply -f deployment.yaml --force
```

**When resources are stuck:**

```bash
# Replace resource entirely
kubectl replace -f deployment.yaml --force

# Delete and apply
kubectl delete -f deployment.yaml
kubectl apply -f deployment.yaml
```

## Managing Multiple Resources

**Directory-based operations:**

```bash
# Create all resources in directory
kubectl create -f k8s-manifests/

# Apply all resources in directory
kubectl apply -f k8s-manifests/

# Recursive apply
kubectl apply -R -f k8s-manifests/
```

**Selective application:**

```bash
# Apply specific resource types
kubectl apply -f . --recursive --selector=app=web-app

# Apply with label selector
kubectl apply -f manifests/ -l environment=production
```

## Error Handling and Troubleshooting

**Common kubectl create errors:**

```bash
# Resource already exists
kubectl create -f deployment.yaml
# Error: deployments.apps "web-app" already exists

# Invalid YAML syntax
kubectl create -f invalid.yaml
# Error: error validating data
```

**Common kubectl apply issues:**

```bash
# Check last applied configuration
kubectl get deployment web-app -o jsonpath='{.metadata.annotations.kubectl\.kubernetes\.io/last-applied-configuration}'

# View diff before applying
kubectl diff -f deployment.yaml

# Validate without applying
kubectl apply -f deployment.yaml --dry-run=client --validate=true
```

## Best Practices

**For development environments:**

```bash
# Use apply for consistent development workflow
kubectl apply -f dev-manifests/

# Quick imperative creation for testing
kubectl create deployment test --image=nginx --dry-run=client -o yaml > test-deployment.yaml
kubectl apply -f test-deployment.yaml
```

**For production environments:**

```bash
# Always use apply with version control
git checkout main
kubectl apply -f production-manifests/

# Implement proper validation pipeline
kubectl apply -f production-manifests/ --dry-run=server --validate=true
```

**Configuration management:**

```bash
# Store last-applied-configuration explicitly
kubectl apply -f deployment.yaml --save-config

# Use labels for resource organization
kubectl apply -f manifests/ -l app=web-app,version=v1.0.0
```

## Integration with CI/CD

**Example CI/CD pipeline using kubectl apply:**

```bash
#!/bin/bash
# ci-cd-deploy.sh

set -e

echo "Validating manifests..."
kubectl apply -f k8s/ --dry-run=server --validate=true

echo "Applying manifests..."
kubectl apply -f k8s/

echo "Waiting for rollout..."
kubectl rollout status deployment/web-app

echo "Deployment successful!"
```

**GitOps workflow example:**

```bash
#!/bin/bash
# gitops-sync.sh

# Pull latest changes
git pull origin main

# Apply all manifests
kubectl apply -f applications/ --recursive

# Verify deployment health
kubectl get pods -l app=web-app
```

## Next Steps

Now that you understand the differences between kubectl apply and kubectl create, consider learning about:

- Helm for more sophisticated package management
- Kustomize for configuration management
- GitOps tools like ArgoCD or Flux
- Advanced kubectl commands and debugging techniques
- Kubernetes resource lifecycle management
