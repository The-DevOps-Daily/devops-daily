---
title: 'Day 7 - Share Your Stack'
day: 7
excerpt: 'Add a My Stack section to your expert profile: the tools you use daily and why.'
difficulty: 'Intermediate'
time: '15 min'
category: 'Content'
tags:
  - hacktoberfest
  - stack
  - tools
---

## What You'll Do

Add a "My Stack" section to the expert profile you created on [Day 1](/hacktoberfest/day-1). Describe the tools you use every day, how they fit together, and why you chose them. It shows on your profile page and helps other engineers discover real-world tool combinations.

If you skipped Day 1, do it first. Your stack goes in the same file. If your Day 1 PR is not merged yet, start today's branch from your Day 1 branch so the file is there.

## Step by Step

### 1. Add the section to your profile

Open `content/experts/your-name.md` and add a `## My Stack` section to the body, below the frontmatter and your existing text:

```markdown
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

### Why This Stack

I chose this combination because [explain your reasoning].
The biggest win has been [share a specific benefit].

### One Thing I'd Change

If I were starting fresh, I'd [share a lesson learned].
```

Do not change the frontmatter fields from Day 1 unless you want to update them.

### 2. Preview locally

```bash
pnpm dev
# Visit http://localhost:3000/experts/your-name
```

### 3. Submit your PR

```bash
git checkout -b hacktoberfest/stack-your-name
git add content/experts/your-name.md
git commit -m "Add [Your Name]'s DevOps stack"
git push origin hacktoberfest/stack-your-name
```

## Share It

> "Here's my DevOps stack and why I chose each tool - just shared it on @thedevopsdaily for the Hacktoberfest challenge! What does your stack look like? #Hacktoberfest #DevOpsDaily"
