---
title: 'The DevOps Knowledge Map: 12 Areas, in the Order to Learn Them'
excerpt: 'A map of the 12 areas of DevOps work in a learning order, with the tools in each, a concrete test that tells you when you know an area, and free browser simulators to practice every one.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-11-19'
publishedAt: '2026-11-19T07:00:00Z'
updatedAt: '2026-11-19T07:00:00Z'
readingTime: '14 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - DevOps
  - Career
  - Learning
  - Linux
  - Kubernetes
  - Cloud
---

Most DevOps roadmaps are a wall of logos. They tell you that Linux, Docker, Kubernetes, Terraform, Prometheus and fifty other tools exist, but not which one to learn first, and not how to tell when you know one well enough to move on. So people collect course certificates, jump between tools, and still freeze when a real server fills its disk.

This post is the map we would hand a junior engineer on day one. It covers 12 areas in the order each one builds on the last. Every area has the tools worth learning, a concrete check that tells you when you have it, and free simulators on DevOps Daily where you can practice it in your browser.

## TL;DR

- Learn the 12 areas in order: Linux, networking, Git, containers, CI/CD, cloud, infrastructure as code, Kubernetes, databases, observability, security, then incidents and reliability.
- Move on when you pass an area's check, not when you finish a course. Each check is a task from real work, such as "find what is filling the disk".
- Learn one tool per job well. The concepts carry over when a new job uses a different tool.
- Every area links to free browser simulators, guides and quizzes on DevOps Daily, with no sign-up.

<figure>
<video controls muted loop playsinline preload="none" width="1200" height="1480" poster="/images/posts/devops-knowledge-map/knowledge-map-poster.webp"><source src="/images/posts/devops-knowledge-map/knowledge-map.mp4" type="video/mp4"></video>
<figcaption>Press play to walk the map step by step: the 12 areas in learning order, the tools in each, and the check that tells you when you know it.</figcaption>
</figure>

## Prerequisites

- A computer with a modern browser for the simulators.
- A Linux shell for the commands in this post: a virtual machine, WSL on Windows, or a small cloud server.
- A free GitHub account for the Git and CI/CD steps.

## How to use the map

Each area uses the ones before it. Containers are Linux processes with a network, so Linux and networking come first. Kubernetes runs containers, so containers come before Kubernetes. Infrastructure as code describes cloud resources, so you meet the cloud by hand before you automate it. Security and incident work run through every step, but they get their own step at the end because by then you have enough context to do them well.

Work through one area at a time. When you can pass its check without notes, move on. If you get stuck in a later area, the cause is often a gap in an earlier one: a Kubernetes networking problem is usually a networking problem.

## The 12 areas, in order

### 1. Linux and shell

Almost everything you run in DevOps runs on Linux, and most incidents start with a shell on a server. Learn the file system and permissions, users and groups, processes and signals, `systemd` services and `journalctl`, `ssh` with keys, `cron`, and enough **bash** to write a 30-line script with error handling.

**You know it when you can** find what is filling the disk and what is eating the CPU on a server you have never seen before, in a few minutes:

```bash
df -h                          # which file system is full, and where it is mounted
sudo du -xh <mount point> --max-depth=2 2>/dev/null | sort -h | tail   # its biggest directories
top -o %CPU                    # which process uses the most CPU
```

Practice in the [Linux terminal simulator](/games/linux-terminal), then the [cron expression simulator](/games/cron-expression-simulator) and the [fork bomb simulator](/games/fork-bomb-simulator). The [Introduction to Linux](/guides/introduction-to-linux) and [Introduction to Bash](/guides/introduction-to-bash) guides cover the theory, and the [Linux quiz](/quizzes/linux-quiz) checks it.

### 2. Networking

Many outages that "only happen in production" come down to DNS, ports, TLS or a load balancer. Learn IP addresses and subnets, **DNS**, TCP and UDP, HTTP, TLS certificates, firewalls and ports, and how a load balancer picks a backend.

**You know it when you can** explain every step of `curl https://example.com`: the DNS lookup, the TCP connection, the TLS handshake, the HTTP request and the response, and point to each one in the output:

```bash
dig +short example.com                     # the DNS answer
curl -v https://example.com -o /dev/null   # connection, TLS and HTTP lines, in order
```

Practice with the [DNS resolution simulator](/games/dns-simulator), the [packet journey](/games/packet-journey), the [TLS handshake simulator](/games/ssl-tls-handshake) and [TCP vs UDP](/games/tcp-vs-udp). The [Networking fundamentals guide](/guides/networking-fundamentals) goes deeper.

### 3. Git

All the work that follows lives in Git repositories: application code, pipelines, Terraform, Kubernetes manifests. Learn commits and branches, merge and rebase, resolving conflicts, pull requests and code review, and how to undo things safely.

**You know it when you can** fix a merge conflict without losing anyone's change, and undo a bad commit the right way for where it is:

```bash
git reset --soft HEAD~1   # undo the last local commit, keep the changes staged
git revert <commit>       # undo a commit that is already pushed, with a new commit
```

Practice in the [Git concepts simulator](/games/git-concepts-simulator) and the [merge conflict simulator](/games/git-merge-conflict-simulator), read the [Introduction to Git](/guides/introduction-to-git) guide, and take the [Git quiz](/quizzes/git-quiz).

### 4. Containers

Containers are how most teams package and ship software now. Learn images and containers, a **Dockerfile** with multi-stage builds, volumes and networks, Docker Compose, registries, and what a container really is: Linux namespaces and cgroups around a process.

**You know it when you can** ship an app as a small image that runs as a non-root user, and explain where its files, logs and network live.

Practice in the [Docker terminal simulator](/games/docker-terminal-simulator), see the kernel side in [Docker under the hood](/games/docker-under-the-hood-simulator), and try the [Docker escape](/games/docker-escape) challenge. The [Introduction to Docker](/guides/introduction-to-docker) guide and the [Docker quiz](/quizzes/docker-quiz) fill the gaps.

### 5. CI/CD

CI/CD turns "it works on my machine" into a repeatable path to production. Learn pipelines with build, test and deploy stages, GitHub Actions or GitLab CI, artifacts and caches, secrets in pipelines, and rollout strategies: rolling, blue-green and canary.

**You know it when you can** set up a repository where every push runs the tests, a merge to main deploys, and a failed deploy goes back to the last good version without someone logging in to a server.

Practice in the [deployment strategies simulator](/games/deployment-strategies), the [GitOps workflow](/games/gitops-workflow) and the [preview environment simulator](/games/preview-environment-simulator). The [Introduction to CI/CD](/guides/introduction-to-cicd) guide and the [GitHub Actions quiz](/quizzes/github-actions-quiz) cover the details.

### 6. Cloud

Pick one provider and learn it well; the ideas carry over to the others. Learn regions and zones, a **VPC** with subnets and route tables, security groups, IAM roles and policies, compute, object storage, managed databases, and billing with budgets and alerts.

**You know it when you can** build a VPC with a public and a private subnet, put a server in the private one that can still reach the internet, and say what the setup costs per month before the bill arrives.

Practice in the [AWS VPC simulator](/games/aws-vpc-simulator) and the [cloud cost optimizer](/games/cloud-cost-optimizer). The [Introduction to AWS](/guides/introduction-to-aws) and [FinOps for DevOps engineers](/guides/finops-for-devops-engineers) guides explain the parts and the costs.

### 7. Infrastructure as code

Once you have built cloud resources by hand, describe them in code so you can review, repeat and rebuild them. Learn **Terraform** or OpenTofu (providers, resources, variables, modules, `plan` and `apply`), remote state with locking, Ansible to configure servers, and Packer to build machine images.

**You know it when you can** delete your test environment and rebuild it from the repository, reviewing every change before it happens:

```bash
terraform plan -out=tfplan   # see exactly what will change
terraform apply tfplan       # apply only the plan you reviewed
```

Practice in the [Terraform terminal simulator](/games/terraform-terminal-simulator) and the [Terraform puzzle](/games/terraform-puzzle). The [Introduction to Terraform](/guides/introduction-to-terraform), [Introduction to Ansible](/guides/introduction-to-ansible) and [Introduction to Packer](/guides/introduction-to-packer) guides cover each tool.

### 8. Kubernetes

Kubernetes comes late on purpose: it combines Linux, networking, containers and declarative config, and it is much easier when those are solid. Learn Pods, Deployments and Services, ConfigMaps and Secrets, Ingress or the Gateway API, resource requests and limits, probes, Helm, RBAC, and debugging with `kubectl`.

**You know it when you can** find out why a Pod is stuck in `Pending` or `CrashLoopBackOff`:

```bash
kubectl get pods -n app
kubectl describe pod <pod> -n app      # events: scheduling, image pulls, probe failures
kubectl logs <pod> -n app --previous   # logs from the container that crashed
```

Practice in the [Kubernetes terminal simulator](/games/kubernetes-terminal-simulator), then see how Pods get placed in the [scheduler simulator](/games/k8s-scheduler), lock things down in the [RBAC simulator](/games/k8s-rbac-simulator), and follow a packet in the [CNI networking simulator](/games/kubernetes-networking-cni-simulator). The [Introduction to Kubernetes](/guides/introduction-to-kubernetes) guide and the [Kubernetes quiz](/quizzes/kubernetes-quiz) round it off.

### 9. Databases

You will run, back up, restore and debug databases even if you never design a schema. Learn SQL basics, Postgres users and connections, indexes and `EXPLAIN`, backups and restores, point-in-time recovery, replicas, and schema migrations.

**You know it when you can** restore last night's backup into a new database and prove the data is there, and fix a slow query: read its plan with `EXPLAIN`, use `EXPLAIN ANALYZE` on a test copy (it runs the query), then fix it, often with an index.

Practice in the [Postgres terminal simulator](/games/postgres-terminal-simulator), the [database indexing simulator](/games/db-indexing-simulator) and the [replication and sharding simulator](/games/database-replication-sharding-scaling). The [Introduction to Postgres](/guides/introduction-to-postgres) guide covers the rest.

### 10. Observability

You cannot fix what you cannot see. Learn the three signals (metrics, logs and traces), Prometheus and **PromQL**, Grafana dashboards, latency percentiles such as p95 and p99, alerts on symptoms users feel, and OpenTelemetry for instrumentation.

**You know it when you can** take an alert that says p99 latency went up after a deploy and find which endpoint got slower and why, using dashboards, logs and traces together.

Practice in the [PromQL playground](/games/promql-playground), learn what percentiles hide in the [latency percentiles simulator](/games/latency-percentiles-simulator), and follow logs through the [log aggregation pipeline simulator](/games/log-aggregation-pipeline-simulator). The [monitoring and observability quiz](/quizzes/monitoring-observability-quiz) checks the concepts.

### 11. Security

By now you have touched every layer, so you can secure each one. Learn least privilege in IAM and RBAC, secrets management and rotation, dependency and image scanning, TLS certificates and renewals, OAuth and OIDC, and the common web risks in the OWASP Top 10.

**You know it when you can** handle a key that leaked into a public repository: revoke it, put a new key in every service that used it with as little downtime as you can, then check the logs for any use of the old key.

Practice in the [OAuth and OIDC flow simulator](/games/oauth-oidc-flow-simulator) and the [DDoS simulator](/games/ddos-simulator). The [Security principles](/guides/security-principles), [OWASP Top 10](/guides/owasp-top-10) and [Threat modeling](/guides/threat-modeling) guides give you the framework.

### 12. Incidents and reliability

Things will break. Learn on-call basics, SLOs and error budgets, runbooks, incident roles such as the incident commander, status updates, blameless postmortems, and backup and disaster recovery drills.

**You know it when you can** run a practice incident from the first alert to the all-clear, and write a postmortem that someone who was not there can learn from.

Practice in the [incident commander simulator](/games/incident-commander-simulator), the [on-call simulator](/games/on-call) and the [BCDR simulator](/games/bcdr-simulator). The [incident response quiz](/quizzes/incident-response-quiz) and the [SLOs, SLIs and error budgets quiz](/quizzes/slos-slis-error-budgets-quiz) check the concepts.

## What the map leaves out

- **A programming language.** You will write tooling, glue scripts and small services. Python is a good first choice; start with the [Introduction to Python](/guides/introduction-to-python) guide.
- **Specific vendors.** The map names tools as examples. If a job uses GitLab instead of GitHub Actions, or Azure instead of AWS, the concepts transfer and the syntax is the easy part.
- **The skills that get you hired.** Knowing the tools is the baseline. What makes a team want to hire you is covered in [the DevOps skills that create openings](/posts/devops-skills-that-create-job-openings).

## Practice the whole map as a game

If you learn better by playing, [Opsville](/opsville) is a free pixel-art town where each district is broken in a way that matches this map: a full disk in Linux Lodge, containers in Docker Docks, a stuck pipeline on CI/CD Railway, Pods in Kubernetes Castle, dashboards in the Observatory. Most quests open a simulator like the ones linked above. For a step-by-step path with resources for the first year, see the [Junior DevOps Roadmap](/roadmap/junior).

## Summary

- Learn the areas in order, because each one uses the ones before it.
- Move on when you pass the check, not when a course ends.
- Learn one tool per job well; the concepts transfer.
- Practice every step in a simulator before you need it on a real server.
