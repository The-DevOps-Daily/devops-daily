---
name: 'Nalla Prakash'
slug: 'nalla-prakash'
title: 'DevOps Engineer'
bio: 'DevOps engineer who enjoys working with Python and backend systems.'
specialties:
  - CI/CD
  - Docker
  - GitHub Actions
  - Kubernetes
website: 'https://github.com/prakashNalla'
---

## About Me

I'm a DevOps engineer who likes building things with Python and working on backend systems. Most of my time goes into CI/CD pipelines, Docker, GitHub Actions and Kubernetes.

## My Stack

### CI/CD

- GitHub Actions for builds, tests and deploys
- Reusable workflows to keep pipelines the same across repos

### Infrastructure

- Terraform for cloud resources
- Python scripts for the glue work between tools

### Containers

- Docker for local development and builds
- Kubernetes for running services, with Helm for packaging

### Monitoring

- Prometheus and Grafana for metrics and dashboards
- Grafana Loki for logs

### Why This Stack

Most of it lives close to the code. GitHub Actions sits next to the repo, Docker images are the same from my laptop to the cluster, and Grafana gives one place to look at metrics and logs together.

### One Thing I'd Change

I'd move more of the Kubernetes deploys to GitOps with Argo CD instead of pushing from CI, so the cluster state is always what's in Git.
