---
title: 'Day 7 - Share Your Stack'
day: 7
excerpt: 'Write a short profile of your DevOps setup and the tools you use daily.'
difficulty: 'Intermediate'
time: '15 min'
category: 'Content'
tags:
  - hacktoberfest
  - stack
  - tools
---

## What You'll Do

Write a short markdown profile describing your DevOps stack - the tools you use every day, how they fit together, and why you chose them. This helps other engineers discover real-world tool combinations.

## Step by Step

### 1. Create your stack file

Create a new file at `content/stacks/your-name.md`:

```markdown
---
name: 'Your Name'
title: 'DevOps Engineer at Company'
slug: 'your-name'
---

## My Stack

### CI/CD
- **GitHub Actions** for CI pipelines
- **ArgoCD** for GitOps deployments to Kubernetes

### Infrastructure
- **Terraform** for cloud provisioning (AWS)
- **Ansible** for configuration management

### Containers
- **Docker** for local development
- **Kubernetes (EKS)** for production orchestration

### Monitoring
- **Prometheus + Grafana** for metrics
- **Loki** for log aggregation
- **PagerDuty** for alerting

## Why This Stack

I chose this combination because [explain your reasoning].
The biggest win has been [share a specific benefit].

## One Thing I'd Change

If I were starting fresh, I'd [share a lesson learned].
```

### 2. Preview locally

```bash
pnpm dev
```

### 3. Submit your PR

```bash
git checkout -b hacktoberfest/stack-your-name
git add content/stacks/
git commit -m "Add [Your Name]'s DevOps stack"
git push origin hacktoberfest/stack-your-name
```

## Share It

> "Here's my DevOps stack and why I chose each tool - just shared it on @thedevopsdaily for the Hacktoberfest challenge! What does your stack look like? #Hacktoberfest #DevOpsDaily"
