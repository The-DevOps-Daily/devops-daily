---
title: "DevOps Weekly Digest - Week 40, 2026"
date: "2026-09-28"
summary: "⚡ Curated updates from Kubernetes, cloud native tooling, CI/CD, IaC, observability, and security - handpicked for DevOps professionals!"
---

> 📌 **Handpicked by DevOps Daily** - Your weekly dose of curated DevOps news and updates!

---

## ⚓ Kubernetes

### 📄 How a missing kernel flag broke FIPS-certified containers in managed Kubernetes

A customer building a FedRAMP-compliant deployment found that Ubuntu Pro 22.04 FIPS container images were silently failing on standard, mainline Linux kernels, the kind used by managed Kubernetes envi

**📅 Sep 28, 2026** • **📰 Ubuntu Blog**

[**🔗 Read more**](https://ubuntu.com//blog/fixing-fips-kernel-flag)

### 📄 The rise of agentic AI on Kubernetes: unleashing the new infrastructure layer

AI is changing expectations around infrastructure and operations, including Kubernetes management. When models run close to the data they use, The post The rise of agentic AI on Kubernetes: unleashing

**📅 Sep 27, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/agentic-ai-kubernetes-management/)

### 📄 One Amazon EKS, many edges: How to choose your edge container strategy on AWS

Choosing the right edge container strategy across many locations can fragment your fleet into dozens of special cases. This post shows how to avoid that by standardizing on Amazon EKS, then choosing a

**📅 Sep 25, 2026** • **📰 AWS Containers Blog**

[**🔗 Read more**](https://aws.amazon.com/blogs/containers/one-amazon-eks-many-edges-how-to-choose-your-edge-container-strategy-on-aws/)

### 📄 Building a single-pane NOC dashboard for Amazon EKS with Amazon CloudWatch

An incident is the worst moment to discover you cannot trust your Amazon EKS dashboard. This post shows what a trustworthy single-pane NOC for Amazon EKS on Amazon CloudWatch looks like, why each desi

**📅 Sep 23, 2026** • **📰 AWS Containers Blog**

[**🔗 Read more**](https://aws.amazon.com/blogs/containers/building-a-single-pane-noc-dashboard-for-amazon-eks-with-amazon-cloudwatch/)

### 📄 Breaking the AI productivity paradox: an intelligent migration factory to modernize infrastructure and applications

The rise of generative AI promised a silver bullet, but for most enterprises, especially banks, digital transformation remains a slow, complex, and costly endeavor. Early reports suggested massive dev

**📅 Sep 23, 2026** • **📰 OpenShift Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/breaking-ai-productivity-paradox-intelligent-migration-factory-modernize-infrastructure-and-applications)

### 📄 Spotlight on SIG Apps

As Kubernetes adoption has grown, the conversation has shifted beyond running containers to managing increasingly complex application lifecycles. Modern platforms support stateless web services, state

**📅 Sep 22, 2026** • **📰 Kubernetes Blog**

[**🔗 Read more**](https://kubernetes.io/blog/2026/09/22/sig-apps-spotlight/)

### 📄 Kubernetes v1.37: Tracking When a PersistentVolumeClaim Was Last Used (Beta)

Kubernetes v1.37 promotes the PersistentVolumeClaimUnusedSinceTime feature gate to Beta (enabled by default). With this feature, the PersistentVolumeClaim (PVC) protection controller adds an Unused co

**📅 Sep 21, 2026** • **📰 Kubernetes Blog**

[**🔗 Read more**](https://kubernetes.io/blog/2026/09/21/kubernetes-v1-37-pvc-last-used-time/)

---

## ☁️ Cloud Native

### 📄 The case for a cloud native agent harness

Coding agents became useful when they stopped being a chat box. Four things changed the shape of the problem: capable tools, a shared repository and filesystem, subagents, and skills that capture what

**📅 Sep 28, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/09/28/the-case-for-a-cloud-native-agent-harness/)

### 📄 Clearing the Vulnerability Backlog Safely: Agentic SecOps on SUSE AI Factory with the NVIDIA Open Agent Safety Platform

Scan a mid-sized container estate and you get back somewhere north of four thousand findings. Maybe thirty matter. The rest are unreachable code paths, packages that aren’t installed at runtime, image

**📅 Sep 28, 2026** • **📰 SUSE Blog**

[**🔗 Read more**](https://www.suse.com/c/agentic-secops-on-suse-ai-factory-with-nvidia-agent-safety-platform/)

### 📄 AWS named a Leader in the 2026 Gartner Magic Quadrant for Container Management

Gartner has recognized AWS as a Leader in the 2026 Gartner Magic Quadrant for Container Management for the fourth consecutive year. See what our latest container innovations across Amazon ECS and Amaz

**📅 Sep 25, 2026** • **📰 AWS Containers Blog**

[**🔗 Read more**](https://aws.amazon.com/blogs/containers/aws-named-a-leader-in-the-2026-gartner-magic-quadrant-for-container-management/)

### 📄 Security Slam 2026 – Fall edition

Security Slam 2026 – Fall Edition is a 30-day virtual event from October 5 through November 6, 2026. What Is the Security Slam? The Open Source Security Foundation (OpenSSF) is partnering with the Clo

**📅 Sep 25, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/09/25/security-slam-2026-fall-edition/)

### 📄 Manufacturing Trust for AI Agents | Docker’s WeAreDevelopers Keynote

Docker's WeAreDevelopers keynote shows how Sandboxes, Kits, and Cloud Sandboxes give AI agents strong isolation and reproducible authority.

**📅 Sep 24, 2026** • **📰 Docker Blog**

[**🔗 Read more**](https://www.docker.com/blog/manufacturing-trust-for-ai-agents-keynote/)

### 📄 From Dockerfile to Kit: the Docker Sandboxes Kit Specification

Docker's Sandbox Kit Specification v3 packages an AI agent's network rules, credentials, and volumes as an ordinary, pinnable OCI image.

**📅 Sep 24, 2026** • **📰 Docker Blog**

[**🔗 Read more**](https://www.docker.com/blog/docker-sandbox-kit-spec/)

### 📄 Docker and CNCF partner on an open spec for agent permissions

Docker is bringing the open source Sandbox Kit Spec to the CNCF, so AI agent permissions become a neutral, vendor independent standard built on OCI.

**📅 Sep 24, 2026** • **📰 Docker Blog**

[**🔗 Read more**](https://www.docker.com/blog/docker-sandbox-kit-spec-cncf/)

### 📄 Introducing Cloud Sandboxes: Start on Your Laptop, Finish in the Cloud

Run agents on your laptop, in the cloud, and move between them with one command, all safely. Earlier this year we launched Docker Sandboxes: microVM environments where coding agents can work autonomou

**📅 Sep 24, 2026** • **📰 Docker Blog**

[**🔗 Read more**](https://www.docker.com/blog/introducing-cloud-sandboxes-start-on-your-laptop-finish-in-the-cloud/)

### 📄 Observability Day: Where the community comes together at KubeCon + CloudNativeCon North America 2026

Observability Day returns to KubeCon + CloudNativeCon North America on November 9, 2026, in Salt Lake City, Utah, bringing together maintainers, operators, and end users from across the CNCF observabi

**📅 Sep 24, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/09/24/observability-day-where-the-community-comes-together-at-kubecon-cloudnativecon-north-america-2026/)

### 📄 Which hat am I wearing right now?

Neutrality is quietly the hardest part of open source. It gets tricky the moment someone pays your salary — and staying honest about it takes more effort than anyone admits. Here’s something we don’t 

**📅 Sep 23, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/09/23/which-hat-am-i-wearing-right-now/)

### 📄 Cilium at KubeCon + CloudNativeCon and CiliumCon North America 2026

Cilium is heading back to Salt Lake City this November for KubeCon + CloudNativeCon and CiliumCon North America 2026. Since coming…

**📅 Sep 23, 2026** • **📰 Cilium Blog**

[**🔗 Read more**](https://cilium.io/blog/2026/09/23/cilium-at-kubecon-na-26)

### 📄 The Hidden Costs of AI: 7 Cost Drivers Your Enterprise AI Spend May be Missing

Ask most enterprises what their AI costs, and they’ll point at tokens. It’s the number on the invoice. The number in the pricing calculator. The number that often finds its way into the business case.

**📅 Sep 23, 2026** • **📰 Kubecost Blog**

[**🔗 Read more**](https://www.apptio.com/blog/the-hidden-costs-of-ai-7-cost-drivers-your-enterprise-ai-spend-may-be-missing/)

---

## 🔄 CI/CD

### 📄 Leaked GitLab Email Tokens Can Reach Code, Secrets and CI/CD Pipelines

Security researchers have uncovered a GitLab behavior that could let attackers use a leaked project email address to push code, trigger CI/CD jobs and reach other repositories accessible to the addres

**📅 Sep 25, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/leaked-gitlab-email-tokens-can-reach-code-secrets-and-ci-cd-pipelines/)

### 📄 GitHub Copilot app for Beginners: How to build custom workflows with canvases

Describe the interface you need in plain English, then let the agent build a live surface you can both use and update—so you spend less time adapting to tools and more time getting work done. The post

**📅 Sep 25, 2026** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/ai-and-ml/github-copilot/github-copilot-app-for-beginners-how-to-build-custom-workflows-with-canvases/)

### 📄 Improving site performance by shipping more CSS

How we fully migrated github.com away from CSS-in-JS. The post Improving site performance by shipping more CSS appeared first on The GitHub Blog.

**📅 Sep 25, 2026** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/engineering/architecture-optimization/improving-site-performance-by-shipping-more-css/)

### 📄 CI/CD Security Best Practices: A 2026 Pipeline Checklist

CI/CD security best practices for 2026: secrets management, scoped access, dependency scanning, signed artifacts, and audit logging in one checklist. | Blog

**📅 Sep 25, 2026** • **📰 Harness Blog**

[**🔗 Read more**](https://www.harness.io/blog/ci-cd-security-best-practices)

### 📄 When chat is the wrong UI

What is a developer to do when they need something more tangible than a chat box? Enter canvases. The post When chat is the wrong UI appeared first on The GitHub Blog.

**📅 Sep 24, 2026** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/ai-and-ml/github-copilot/when-chat-is-the-wrong-ui/)

### 📄 Gitea Runner 4.0.0 is released

We are happy to announce the release of **Gitea Runner 4.0.0**. This is a runner-side release. It remains wire-compatible with existing Gitea versions; the major version bump reflects two breaking cha

**📅 Sep 24, 2026** • **📰 Gitea Blog**

[**🔗 Read more**](https://blog.gitea.com/release-of-runner-4.0.0/)

### 📄 GitLab Critical Patch Release: 19.4.1, 19.3.3, 19.2.7



**📅 Sep 23, 2026** • **📰 GitLab Blog**

[**🔗 Read more**](https://docs.gitlab.com/releases/patches/patch-release-gitlab-19-4-1-released/)

### 📄 How to design GitLab for enterprise scale

At enterprise scale, even small architecture choices can have outsized consequences. A deployment that works for a handful of teams can become a constraint once thousands of developers, repositories, 

**📅 Sep 22, 2026** • **📰 GitLab Blog**

[**🔗 Read more**](https://about.gitlab.com/blog/how-to-design-gitlab-for-enterprise-scale/)

### 📄 How GitLab reduced code-per-agentic-flow ratio by 45%

GitLab Duo Agent Platform orchestrates and automates complex tasks through agentic flows. A key part of the platform is the Flow Registry, a declarative configuration framework, built from reusable co

**📅 Sep 22, 2026** • **📰 GitLab Blog**

[**🔗 Read more**](https://about.gitlab.com/blog/how-gitlab-reduced-code-per-agentic-flow-ratio/)

---

## 🏗️ IaC

### 📄 Route every Claude Code message to the right model with Jev

Not every message you send to Claude Code needs the most capable model. A quick question about a Git command runs on the same model as a refactor across three services, unless you remember to switch m

**📅 Sep 28, 2026** • **📰 Pulumi Blog**

[**🔗 Read more**](https://www.pulumi.com/blog/route-every-claude-code-message-to-the-right-model-with-jev/)

### 📄 AI agents need continuity, not just context

Pulumi Neo works on infrastructure the way an engineer does: it clones repositories, edits files, installs dependencies, runs previews, and produces intermediate work along the way. A task is not only

**📅 Sep 25, 2026** • **📰 Pulumi Blog**

[**🔗 Read more**](https://www.pulumi.com/blog/neo-kopia-workspace-snapshots/)

---

## 📊 Observability

### 📄 Rider 2026.2.3 Is Released!

Rider 2026.2.3 brings AI performance analysis to the Monitoring tool window and fixes an issue with the AI Agent Setup widget on Windows. You can update directly from the IDE, through the Toolbox App,

**📅 Sep 28, 2026** • **📰 JetBrains Blog**

[**🔗 Read more**](https://blog.jetbrains.com/dotnet/2026/09/28/rd-2026-2-3/)

### 📄 Exploring the OpenTelemetry Instrumentation Ecosystem

OpenTelemetry has a lot of pieces: APIs, SDKs, a protocol, semantic conventions, instrumentation, and tools like the Collector. The APIs and protocol define how telemetry is created and exchanged, whi

**📅 Sep 25, 2026** • **📰 OpenTelemetry Blog**

[**🔗 Read more**](https://opentelemetry.io/blog/2026/exploring-instrumentation-ecosystem/)

### 📄 Best AI Security Solutions in 2026: A Buyer's Guide

Compare the best AI security solutions in 2026: LLM security, model monitoring, and AI-powered SOC tools, plus buying criteria and vendor questions. | Blog

**📅 Sep 25, 2026** • **📰 Harness Blog**

[**🔗 Read more**](https://www.harness.io/blog/best-ai-security-solutions)

### 📄 What if your agent's hallucinations had a budget? How to start using SLOs for agent behavior

At Grafana Labs, observability is what we do. So as we started building AI agents, we naturally reached for the same instincts we bring to every system: measure it, set targets, and make reliability s

**📅 Sep 24, 2026** • **📰 Grafana Blog**

[**🔗 Read more**](https://grafana.com/blog/what-if-your-agent-s-hallucinations-had-a-budget-how-to-start-using-slos-for-agent-behavior/)

### 📄 Measuring the back/forward cache with Application Metrics

A bfcache hit leaves no trace in ordinary metrics. Here's how Sentry's bfcacheMetricsIntegration makes back/forward cache health measurable.

**📅 Sep 24, 2026** • **📰 Sentry Blog**

[**🔗 Read more**](https://blog.sentry.io/bfcache-metrics/)

### 📄 Prometheus and OpenTelemetry interoperability in 2026: Survey results

We ran a survey asking users of OpenTelemetry and Prometheus how they collect, process, and store metrics. The goal was to understand, with real usage data rather than assumptions, how far the ecosyst

**📅 Sep 22, 2026** • **📰 OpenTelemetry Blog**

[**🔗 Read more**](https://opentelemetry.io/blog/2026/otel-prometheus-interoperability/)

### 📄 How to Build an SRE Agent That Actually Works (Without Blowing the Token Budget)

Learn how to build an SRE agent that delivers accurate, low-latency incident triage with multi-tiered memory and RAG—without blowing your token budget.

**📅 Sep 22, 2026** • **📰 New Relic Blog**

[**🔗 Read more**](https://newrelic.com/blog/observability/how-to-build-an-sre-agent-that-actually-works-without-blowing-the-token-budget)

### 📄 Announcing the 2026 Observability Forecast

The Observability Forecast 2026 offers insights from 2,575 IT and engineering leaders and practitioners worldwide on the future of observability.

**📅 Sep 22, 2026** • **📰 New Relic Blog**

[**🔗 Read more**](https://newrelic.com/blog/observability/announcing-the-2026-observability-forecast)

### 📄 Introducing New Relic Compound Alerts

Discover how New Relic Compound Alerts intelligently correlates related alerts into actionable operational issues to improve incident response and operational efficiency.

**📅 Sep 22, 2026** • **📰 New Relic Blog**

[**🔗 Read more**](https://newrelic.com/blog/observability/introducing-new-relic-compound-alerts)

### 📄 MLOps Solutions for Production Machine Learning

Learn how MLOps solutions support experiment tracking, model serving, monitoring, feature management, governance, and production rollouts.

**📅 Sep 21, 2026** • **📰 LaunchDarkly Blog**

[**🔗 Read more**](https://launchdarkly.com/blog/mlops-solutions-for-production-machine-learning/)

### 📄 Grafana Alerting: Scale alert routing without scaling complexity using multiple notification policies

Alert routing often starts simple. A team creates a few contact points, adds some label matchers, and builds a notification policy tree that sends each alert to the right destination. But alerting con

**📅 Sep 21, 2026** • **📰 Grafana Blog**

[**🔗 Read more**](https://grafana.com/blog/grafana-alerting-scale-alert-routing-without-scaling-complexity-using-multiple-notification-policies/)

### 📄 Announcing the 2026 OpenTelemetry Governance Committee Election

The OpenTelemetry project is excited to announce the 2026 OpenTelemetry Governance Committee (GC) election. Nominations are due by 16 October 2026 23:59 AoE. The list of eligible candidates will be sh

**📅 Sep 21, 2026** • **📰 OpenTelemetry Blog**

[**🔗 Read more**](https://opentelemetry.io/blog/2026/gc-elections/)

---

## 🔐 Security

### 📄 Threats Making WAVs - Incident Response to a Cryptomining Attack

Guardicore security researchers describe and uncover a full analysis of a cryptomining attack, which hid a cryptominer inside WAV files. The report includes the full attack vectors, from detection, in

**📅 Sep 28, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/security/threats-making-wavs-incident-reponse-cryptomining-attack)

### 📄 We Gave Our Agents Autonomy. Here’s How We Kept Control.

Co-authored by Stacey Miller & Troy Mangum Key Takeaways The problem: Agents have demonstrated their ability to escape lab environments and access unauthorized systems. Prompt and model safeguards gui

**📅 Sep 28, 2026** • **📰 SUSE Blog**

[**🔗 Read more**](https://www.suse.com/c/we-gave-our-agents-autonomy-heres-how-we-kept-control/)

### 📄 GitHub’s Security Autofix Agent Now Remembers What It Fixed

GitHub’s agentic autofix now uses Copilot Memory to reuse repository-specific security fix patterns, helping Copilot apply lessons from past vulnerabilities across future alerts, reviews and coding wo

**📅 Sep 28, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/githubs-security-autofix-agent-now-remembers-what-it-fixed/)

### 📄 JFrog Artifact Alternatives: What to Look for When Migrating

Considering JFrog Artifactory alternatives? Here's what matters before you migrate: package coverage, security scanning, pricing, and migration risk. | Blog

**📅 Sep 28, 2026** • **📰 Harness Blog**

[**🔗 Read more**](https://www.harness.io/blog/jfrog-artifact-alternatives-what-to-look-for-when-you-migrate)

### 📄 Securing AI agents requires securing the systems around them

Enterprise AI is changing from software that primarily generates information to software that can take action. AI agents can call APIs, invoke tools, access files and credentials, communicate over net

**📅 Sep 28, 2026** • **📰 Red Hat Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/securing-ai-agents-requires-securing-systems-around-them)

### 📄 Blitzy Makes Sandbox for Reverse Engineering Code Available at No Cost

Blitzy has made available a sandbox where DevOps teams can reverse-engineer up to one million lines of code, generate up to 25,000 lines of tested end-to-end code, and identify security vulnerabilitie

**📅 Sep 25, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/blitzy-makes-sandbox-for-reverse-engineering-code-available-at-no-cost/)

### 📄 The path to a sovereign autonomous enterprise: Why open source is your clean core advantage

Key Takeaways Building an autonomous SAP environment requires balancing rapid AI innovation with strict data control and compliance. Keeping your SAP core clean relies on hybrid integration, private A

**📅 Sep 25, 2026** • **📰 SUSE Blog**

[**🔗 Read more**](https://www.suse.com/c/the-path-to-a-sovereign-autonomous-enterprise-why-open-source-is-your-clean-core-advantage/)

### 📄 {unscripted} Chicago and Columbus recap

{unscripted} Chicago and Columbus focused on AI code that doesn't ship, compliance as a feature, and the human cost of machine speed. | Blog

**📅 Sep 25, 2026** • **📰 Harness Blog**

[**🔗 Read more**](https://www.harness.io/blog/unscripted-chicago-columbus-recap-the-bottleneck-moved-did-your-controls)

### 📄 Red Hat Enterprise Linux 10 STIG automation now matches DISA STIG V1R2

For the U.S. Department of Defense (DoD) and its contractors, security has to hold up against a published baseline—not a general claim that systems are “secure.” The Defense Information Systems Agency

**📅 Sep 25, 2026** • **📰 Red Hat Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/red-hat-enterprise-linux-10-stig-automation-now-matches-disa-stig-v1r2)

### 📄 AI-powered fuzzing with the GitHub Security Lab Taskflow Agent

In this blog post, I explain how to use the new fuzzing taskflow based on the GitHub Security Lab Taskflow Agent AI framework. The post AI-powered fuzzing with the GitHub Security Lab Taskflow Agent a

**📅 Sep 24, 2026** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/security/application-security/ai-powered-fuzzing-with-the-github-security-lab-taskflow-agent/)

### 📄 Your Vulnerability Backlog Is No Longer Technical Debt, It’s an Attack Surface

A growing vulnerability backlog is more than technical debt: it is an attack surface. Learn why outdated risk assumptions, automated attackers, and chained findings demand a new approach.

**📅 Sep 24, 2026** • **📰 Snyk Blog**

[**🔗 Read more**](https://snyk.io/blog/vulnerability-backlog-attack-surface/)

### 📄 Accelerating delivery of CVE fixes with a new Kernel release strategy

When it comes to fixing security vulnerabilities, speed is crucial. Canonical is officially outlining a transition from its current 4-week regular and 2-week security kernel Stable Release Update (SRU

**📅 Sep 23, 2026** • **📰 Canonical Blog**

[**🔗 Read more**](https://canonical.com//blog/accelerating-delivery-of-cve-fixes-with-a-new-kernel-release-strategy)

---

## 💾 Databases

### 📄 PLEASE_READ_ME: The Opportunistic Ransomware Devastating MySQL Servers

Guardicore Labs uncovers a Ransomware detection campaign targeting MySQL servers. Attackers use Double Extortion and publish data to pressure victims.

**📅 Sep 28, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/security/please-read-me-opportunistic-ransomware-devastating-mysql-servers)

### 📄 Building a Faster (Rust-Based) Python Driver for ScyllaDB

Binding Rust to Python with PyO3, zero-copy deserialization with yoke

**📅 Sep 28, 2026** • **📰 ScyllaDB Blog**

[**🔗 Read more**](https://www.scylladb.com/2026/09/28/building-a-faster-rust-based-python-driver/)

### 📄 The FinTech Scalability Crisis: How Distributed SQL Unlocks Innovation with Zero Downtime Operations

When Plaid’s Amazon Aurora MySQL fleet faced a major-version upgrade, the estimate came back at six engineering months and tens of minutes of downtime. For a company whose APIs sit underneath thousand

**📅 Sep 26, 2026** • **📰 TiDB Blog**

[**🔗 Read more**](https://www.pingcap.com/blog/fintech-scalability-crisis-how-distributed-sql-unlocks-innovation-zero-downtime/)

### 📄 Unlock 3x QPS and microsecond latency with Memorystore for Valkey 9.1

At Google Cloud, we are committed to delivering the best managed experience backed by open source software. Today, we’re announcing the general availability of Memorystore for Valkey 9.1, which achiev

**📅 Sep 25, 2026** • **📰 Google Cloud Blog**

[**🔗 Read more**](https://cloud.google.com/blog/products/databases/memorystore-for-valkey-9-1-3x-qps-caching/)

### 📄 Change your components, keep your infrastructure

Components let you turn a group of resources into a reusable building block. You can define a network, a database, or an application service once and share it across projects and teams. People using t

**📅 Sep 25, 2026** • **📰 Pulumi Blog**

[**🔗 Read more**](https://www.pulumi.com/blog/component-state-migrations/)

### 📄 Vercel and TiDB Cloud Starter: The Full-Stack Playbook for AI Apps

You have an AI app running on Vercel, or a prototype that v0.dev generated in a few minutes, and now it needs a real database. The choice is harder than it looks, because serverless functions and edge

**📅 Sep 24, 2026** • **📰 TiDB Blog**

[**🔗 Read more**](https://www.pingcap.com/blog/build-with-tidb-cloud-starter-vercel-database/)

### 📄 How to Solve the Agent Handoff Problem

If your agents hand work to each other, or to a teammate's agents, this is the difference between the next agent building on a decision and rebuilding a dead end. Discover how to solve the agent hando

**📅 Sep 24, 2026** • **📰 Yugabyte Blog**

[**🔗 Read more**](https://www.yugabyte.com/blog/how-to-solve-the-agent-handoff-problem/)

### 📄 PostgreSQL 19 Beta 4 Released!

The PostgreSQL Global Development Group announces that the fourth beta release of PostgreSQL 19 is now available for download. This release contains PostgreSQL 19 feature previews ahead of general ava

**📅 Sep 24, 2026** • **📰 PostgreSQL News**

[**🔗 Read more**](https://www.postgresql.org/about/news/postgresql-19-beta-4-released-3386/)

### 📄 The official FastAPI Redis SDK is now available

FastAPI now has an official Redis integration. With the fastapi-redis-sdk, we worked closely with the FastAPI team on what a naturally integrated Redis experience should look like, following FastAPI’s

**📅 Sep 24, 2026** • **📰 Redis Blog**

[**🔗 Read more**](https://redis.io/blog/the-official-fastapi-redis-sdk-is-now-available/)

### 📄 Lakebase, TiDB X, and the Database Architecture AI Demands

An AI coding agent can generate an application, change its schema, test several implementations, and discard most of them within a single session. Another agent might spend that session updating order

**📅 Sep 23, 2026** • **📰 TiDB Blog**

[**🔗 Read more**](https://www.pingcap.com/blog/separation-of-compute-and-storage-lakebase-tidb-x/)

### 📄 Stay up when a region goes down: Highly available Redis for Python apps

Active-Active Redis & client-side geographic failover Active-Active Redis distributes data across multiple regions, allowing each regional database instance to serve both reads and writes. What kind o

**📅 Sep 23, 2026** • **📰 Redis Blog**

[**🔗 Read more**](https://redis.io/blog/stay-up-when-a-region-goes-down-highly-available-redis-for-python-applications/)

### 📄 How moving from Azure Cache for Redis to Azure Managed Redis can cut costs by 40%

Moving to Azure Managed Redis can cut your monthly Redis service cost by around 40%. In four East US 2 Premium-to-Balanced price comparisons, the reduction is 43–44%, with high availability on both si

**📅 Sep 23, 2026** • **📰 Redis Blog**

[**🔗 Read more**](https://redis.io/blog/how-moving-from-azure-cache-for-redis-to-azure-managed-redis-can-cut-costs-by-40percent/)

---

## 🌐 Platforms

### 📄 The Oracle of Delphi Will Steal Your Credentials

Our deception technology is able to reroute attackers into honeypots, where they believe that they found their real target. The attacks brute forced passwords for RDP credentials to connect to the vic

**📅 Sep 28, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/security/the-oracle-of-delphi-steal-your-credentials)

### 📄 The Nansh0u Campaign – Hackers Arsenal Grows Stronger

In the beginning of April, three attacks detected in the Guardicore Global Sensor Network (GGSN) caught our attention. All three had source IP addresses originating in South-Africa and hosted by Volum

**📅 Sep 28, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/security/the-nansh0u-campaign-hackers-arsenal-grows-stronger)

### 📄 Four months of VoidZero at Cloudflare: making the open-source JavaScript toolchain faster for all humans and agents

Since joining Cloudflare, VoidZero has delivered more than 80 releases that drastically speed up JavaScript compilation, linting, and testing. From a 10x faster React compiler to Vite+ 1.0, here’s how

**📅 Sep 28, 2026** • **📰 Cloudflare Blog**

[**🔗 Read more**](https://blog.cloudflare.com/voidzero-update/)

### 📄 Introducing Forge: the open source pipeline for generating SDKs, CLIs, docs, and more

Forge is a pluggable, open-source pipeline that runs in CI to generate SDKs, CLIs, and documentation directly from API definitions. By shifting generation upstream into individual team repositories, F

**📅 Sep 28, 2026** • **📰 Cloudflare Blog**

[**🔗 Read more**](https://blog.cloudflare.com/forge-open-source-generation-pipeline/)

### 📄 The road to the agentic browser: A Kitesurf update

We’ve updated Kitesurf, our Workers-based browser for AI agents, with WebMCP support, improved DOM performance, and terminal-based rendering. With over 730,000 Web Platform subtests passing, agents ca

**📅 Sep 28, 2026** • **📰 Cloudflare Blog**

[**🔗 Read more**](https://blog.cloudflare.com/kitesurf-update/)

### 📄 Introducing The Cold Start: pitch your startup live at Cloudflare Connect

Cloudflare is launching The Cold Start, a startup competition giving five early-stage companies five minutes on stage at Cloudflare Connect. Grand Prize winner receives $500,000 in credits, a San Fran

**📅 Sep 28, 2026** • **📰 Cloudflare Blog**

[**🔗 Read more**](https://blog.cloudflare.com/introducing-the-cold-start/)

### 📄 Nvidia launches Open Agent Safety Platform to lock down rogue AI agents

OpenAI, Anthropic, Meta, and Google have all recently disclosed that their models broke out of their test environments and reached The post Nvidia launches Open Agent Safety Platform to lock down rogu

**📅 Sep 28, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/nvidia-openshell-sentry-agents/)

### 📄 How DigitalOcean Manages Credentials for Autonomous Agents

Built to align with NVIDIA’s Agent Safety Platform strategy for securing autonomous agents Consider an agent investigating a duplicate charge. It reads the customer’s email, checks their billing histo

**📅 Sep 28, 2026** • **📰 DigitalOcean Blog**

[**🔗 Read more**](https://www.digitalocean.com/blog/how-digitalocean-manages-credentials-for-autonomous-agents)

### 📄 Amazon Transcribe adds customer-managed KMS keys for custom resources

Amazon Transcribe now lets you encrypt your custom vocabularies, custom vocabulary filters, and custom language models at rest with a customer-managed AWS KMS key that you own and control. Previously,

**📅 Sep 25, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/09/amazon-transcribe/)

### 📄 Amazon EC2 M8i and M8i-flex instances are now available in additional regions

Starting today, Amazon EC2 M8i and M8i-flex instances are now available in the AWS European Sovereign Cloud (Germany) region. These instances are powered by custom Intel Xeon 6 processors, available o

**📅 Sep 25, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/09/amazon-ec2-m8i-m8i-flex-thf/)

### 📄 Amazon EC2 R8i and R8i-flex instances are now available in additional regions

Starting today, Amazon Elastic Compute Cloud (Amazon EC2) R8i and R8i-flex instances are available in the AWS European Sovereign Cloud (Germany) region. These instances are powered by custom Intel Xeo

**📅 Sep 25, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/09/ec2-r8i-r8i-flex-thf/)

### 📄 Amazon EC2 C8i and C8i-flex instances are now available in additional regions

Starting today, Amazon Elastic Compute Cloud (Amazon EC2) C8i and C8i-flex instances are available in the AWS European Sovereign Cloud (Germany) region. These instances are powered by custom Intel Xeo

**📅 Sep 25, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/09/c8i-c8i-flex-thf-september-2026/)

---

## 📰 Misc

### 📄 Visual Studio Code 1.140 (Insiders)

Learn what's new in Visual Studio Code 1.140 (Insiders) Read the full article

**📅 Sep 30, 2026** • **📰 VS Code Blog**

[**🔗 Read more**](https://code.visualstudio.com/updates/v1_140)

### 📄 Anthropic bought Stainless and shuttered its SDK generator. Cloudflare open-sourced Forge instead.

Cloudflare has announced an open source tool that takes an API definition and automatically produces the SDKs, command-line tools, documentation, The post Anthropic bought Stainless and shuttered its 

**📅 Sep 28, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/cloudflare-forge-anthropic-stainless/)

### 📄 Air Teams: Bring Your Best Agentic Workflows to the Whole Team – and Automate Repeatable Work

Today, we’re introducing JetBrains Air Teams – the team layer for agentic development. It gives humans and agents the shared context, environments, tools, and instructions they need to work effectivel

**📅 Sep 28, 2026** • **📰 JetBrains Blog**

[**🔗 Read more**](https://blog.jetbrains.com/air/2026/09/introducing-air-teams/)

### 📄 A More Reliable Compilation Scheme for Kotlin Multiplatform Modules

The current compilation approach to Kotlin Multiplatform projects works, but sometimes can lead to unexpected or hard-to-predict behavior. For example: With Kotlin 2.5.0-Beta1, we introduced an option

**📅 Sep 28, 2026** • **📰 JetBrains Blog**

[**🔗 Read more**](https://blog.jetbrains.com/kotlin/2026/09/a-more-reliable-compilation-scheme-for-kotlin-multiplatform-modules/)

### 📄 Canonical announces the alpha release of Charmed OpenShell to help secure autonomous AI agent fleets

To streamline enterprise deployment and lifecycle management, Canonical is announcing the alpha release of Charmed OpenShell.

**📅 Sep 28, 2026** • **📰 Canonical Blog**

[**🔗 Read more**](https://canonical.com//blog/charmed-openshell-alpha-release)

### 📄 Why Red Hat is building secure agent onboarding

Every enterprise AI conversation we’ve had this year ends in the same place. A team has an agent that works. It writes code, calls internal APIs, fixes its own mistakes. Then someone asks what happens

**📅 Sep 28, 2026** • **📰 Red Hat Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/why-red-hat-is-building-secure-agent-onboarding)

### 📄 Performance engineering from kernel analysis to AI: Adrian Cockcroft’s take

Over its five-year history, P99 CONF has hosted quite a few speakers who’ve offered pointed takedowns of the namesake metric. The post Performance engineering from kernel analysis to AI: Adrian Cockcr

**📅 Sep 27, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/cockcroft-performance-engineering-ai/)

### 📄 Dependency Mocking Approach That Gets More Accurate as Your Services Deploy More Often

Traffic-based dependency mocking turns frequent upstream deployments into opportunities to refresh mocks from real behavior and reduce integration test drift.

**📅 Sep 25, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/dependency-mocking-approach-that-gets-more-accurate-as-your-services-deploy-more-often/)

### 📄 Managing multiple EKS clusters: why cluster #3 is the wall

Do the arithmetic before you read the rest of this. Count the people on your team who need access to a cluster. Multiply by the number of clusters you run. That result is how many access decisions som

**📅 Sep 25, 2026** • **📰 SUSE Blog**

[**🔗 Read more**](https://www.suse.com/c/managing-multiple-eks-clusters-why-cluster-3-is-the-wall/)

### 📄 How to manage aircraft leases with AI agents

AI quickstarts are a catalog of ready-to-run, industry-specific use cases for your Red Hat AI environment. Each aims to provide a simple and practical way to solve real-world problems using AI on ente

**📅 Sep 25, 2026** • **📰 Red Hat Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/how-manage-aircraft-leases-ai-agents)

### 📄 Continuing to Move PHP Open Source Forward

A year ago, we introduced the first wave of PhpStorm’s open-source sponsorships. We truly believe in the power of open source and the importance of it to the PHP community, and so we want to do our bi

**📅 Sep 24, 2026** • **📰 JetBrains Blog**

[**🔗 Read more**](https://blog.jetbrains.com/phpstorm/2026/09/continuing-to-move-php-open-source-forward/)

### 📄 Visual Studio Code 1.139

Learn what is new in Visual Studio Code 1.139 Read the full article

**📅 Sep 23, 2026** • **📰 VS Code Blog**

[**🔗 Read more**](https://code.visualstudio.com/updates/v1_139)
