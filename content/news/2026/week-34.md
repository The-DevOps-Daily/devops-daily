---
title: "DevOps Weekly Digest - Week 34, 2026"
date: "2026-08-17"
summary: "⚡ Curated updates from Kubernetes, cloud native tooling, CI/CD, IaC, observability, and security - handpicked for DevOps professionals!"
---

> 📌 **Handpicked by DevOps Daily** - Your weekly dose of curated DevOps news and updates!

---

## ⚓ Kubernetes

### 📄 Eleven minutes, zero humans: Building a self-healing Kubernetes upgrade pipeline on Kairos

Once upon a time, upgrading a Kubernetes control plane meant staying awake for it. SSH into every node. Run the upgrade by hand. Watch etcd health the whole time, hoping quorum holds through every reb

**📅 Aug 14, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/08/14/eleven-minutes-zero-humans-building-a-self-healing-kubernetes-upgrade-pipeline-on-kairos/)

### 📄 Qodana Lints Your Code. What’s Checking Your DevOps and Platform Engineering Stack?

A developer in DevOps pushes a Kubernetes deployment with no resource limits, a pod running as root explicitly, and a GitHub Actions workflow runs with mutable tags – and it goes straight to productio

**📅 Aug 13, 2026** • **📰 JetBrains Blog**

[**🔗 Read more**](https://blog.jetbrains.com/qodana/2026/08/qodana-for-devops/)

### 📄 Forensic container checkpointing on Amazon Elastic Kubernetes Service (Amazon EKS)

Amazon EKS 1.34 makes the Kubelet Checkpoint API functional, so you can capture a running container's full state (memory, processes, and network connections) without stopping the workload. This post s

**📅 Aug 12, 2026** • **📰 AWS Containers Blog**

[**🔗 Read more**](https://aws.amazon.com/blogs/containers/forensic-container-checkpointing-on-amazon-eks/)

### 📄 Introducing advanced Kubernetes control plane configuration in Amazon EKS

With Amazon EKS, you can now configure Kubernetes control plane components (the API server, scheduler, and controller manager) directly through EKS APIs. This post explains what's configurable and inc

**📅 Aug 12, 2026** • **📰 AWS Containers Blog**

[**🔗 Read more**](https://aws.amazon.com/blogs/containers/introducing-advanced-kubernetes-control-plane-configuration-in-amazon-eks/)

### 📄 How to Pretty-Print Your Kubernetes YAML as KYAML and Why You'd Want To

YAML has been the standard way to write Kubernetes manifests for years. Every example, tutorial, and configuration file you come across is written in it. The problem isn't that YAML is a bad format. I

**📅 Aug 11, 2026** • **📰 Kubernetes Blog**

[**🔗 Read more**](https://kubernetes.io/blog/2026/08/11/how-to-pretty-print-kubernetes-yaml-as-kyaml/)

---

## ☁️ Cloud Native

### 📄 Reproducible ESP32 Firmware Development with Docker and Docker Sandboxes

Build ESP32 firmware with reproducible Docker environments and use Docker Sandboxes for isolated AI-assisted development and hardware testing.

**📅 Aug 14, 2026** • **📰 Docker Blog**

[**🔗 Read more**](https://www.docker.com/blog/reproducible-esp32-firmware-development-with-docker-and-docker-sandboxes/)

### 📄 Lightweight Dragonfly Deployment: P2P Distribution Without the Database Stack

Dragonfly speeds up file and container image distribution using peer-to-peer (P2P) technology, but a standard installation deploys several components and dependencies. Beyond the Scheduler, Seed Clien

**📅 Aug 13, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/08/13/lightweight-dragonfly-deployment-p2p-distribution-without-the-database-stack/)

### 📄 Docker VMM Public Beta: A Complete Overhaul, Built for Performance

Docker VMM is now available in public beta for Mac and Windows. Learn what this means for performance, stability, and governance and how to try it yourself.

**📅 Aug 12, 2026** • **📰 Docker Blog**

[**🔗 Read more**](https://www.docker.com/blog/docker-vmm-public-beta/)

### 📄 Good apps aren’t born, they’re guided: Building observable policy as code

As parents in tech, we’ve learned that neither children nor applications thrive without clear boundaries. There are no “good” or “bad” kids, just as there are no inherently “good” or “bad” application

**📅 Aug 12, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/08/12/good-apps-arent-born-theyre-guided-building-observable-policy-as-code/)

### 📄 Measuring Sustainability via Project Kepler, with Niki Manoledaki

Niki Manoledaki is a Staff Platform Engineer at Grafana Labs, A CNCF Ambassador and Green Software Foundation Champion, and a core maintainer of Project Kepler. We explore the recent rewrite of Projec

**📅 Aug 12, 2026** • **📰 Kubernetes Podcast**

[**🔗 Read more**](https://e780d51f-f115-44a6-8252-aed9216bb521.libsyn.com/measuring-sustainability-via-project-kepler-with-niki-manoledaki)

### 📄 SynchDB 1.4 Released - Oracle Container Database Support and TLS-Secured FDW Snapshots

Dear Community Members, We are excited to announce the release of SynchDB 1.4, a PostgreSQL extension for real-time replication from heterogeneous source databases into PostgreSQL/IvorySQL. This relea

**📅 Aug 12, 2026** • **📰 PostgreSQL News**

[**🔗 Read more**](https://www.postgresql.org/about/news/synchdb-14-released-oracle-container-database-support-and-tls-secured-fdw-snapshots-3362/)

---

## 🔄 CI/CD

### 📄 How to bring your software delivery workflow into GitHub with agent apps

See how four GitHub agent apps can help you scope, secure, roll out, and ship a feature across the SDLC–all without leaving GitHub. The post How to bring your software delivery workflow into GitHub wi

**📅 Aug 14, 2026** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/ai-and-ml/github-copilot/how-to-bring-your-software-delivery-workflow-into-github-with-agent-apps/)

### 📄 Stories from the Factory Floor: Our AI software factory saved me from an incident and I lived to tell the tale

Last summer, I shipped what I thought was a routine cleanup to production. It turned out to be a bug. But before the vast majority of users ever saw it, our AI software factory caught it and rolled ba

**📅 Aug 14, 2026** • **📰 LaunchDarkly Blog**

[**🔗 Read more**](https://launchdarkly.com/blog/our-ai-software-factory-saved-me-from-an-incident/)

### 📄 How Harness AI Reaches Your Toolchain, Safely

One MCP Gateway lets AI Chat call GitHub, Jira, and Confluence with per-tool permissions, RBAC visibility, and no dropped sessions at scale. | Blog

**📅 Aug 14, 2026** • **📰 Harness Blog**

[**🔗 Read more**](https://www.harness.io/blog/bringing-third-party-apps-into-harness-ai)

### 📄 Your guide to GitHub Universe 2026 is here: The schedule just launched!

The GitHub Universe session catalog is live. Explore interactive workshops, community talks, demos, and panels. Plus, register before August 19 to save $300. The post Your guide to GitHub Universe 202

**📅 Aug 13, 2026** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/news-insights/company-news/your-guide-to-github-universe-2026-is-here-the-schedule-just-launched/)

### 📄 How I built a demo generator with GitLab Duo Agent Platform

A demo used to take me days to build — screenshots, narration, stitching it together in an external tool, chasing feedback — and every time the feature changed I'd have to start over. A few months ago

**📅 Aug 13, 2026** • **📰 GitLab Blog**

[**🔗 Read more**](https://about.gitlab.com/blog/agentic-click-through-demo/)

### 📄 GitHub availability report: July 2026

In July, we experienced eight incidents that resulted in degraded performance across GitHub services. The post GitHub availability report: July 2026 appeared first on The GitHub Blog.

**📅 Aug 12, 2026** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/news-insights/company-news/github-availability-report-july-2026/)

### 📄 How GitLab tracks vulnerabilities through refactors and reformatting

Every day, security scans face the same problem: an agent or a developer adds a comment, reformats a file, or moves a function, and a naive vulnerability tracker suddenly reports the same finding twic

**📅 Aug 12, 2026** • **📰 GitLab Blog**

[**🔗 Read more**](https://about.gitlab.com/blog/improved-scope-offset-fingerprinting/)

### 📄 GitLab Patch Release: 19.2.2, 19.1.4, 19.0.6



**📅 Aug 12, 2026** • **📰 GitLab Blog**

[**🔗 Read more**](https://docs.gitlab.com/releases/patches/patch-release-gitlab-19-2-2-released/)

### 📄 Harness Community: Connect, Learn, and Build Together

Join the Harness Community to connect with practitioners, solve delivery challenges, share expertise, and shape the future of software delivery. | Blog

**📅 Aug 12, 2026** • **📰 Harness Blog**

[**🔗 Read more**](https://www.harness.io/blog/join-the-conversation-the-harness-community-is-now-live)

### 📄 Software Delivery Platform: Key Features & How to Evaluate

A software delivery platform isn't just a CI/CD tool. Get the must-have feature checklist and the demo questions to use when evaluating vendors. | Blog

**📅 Aug 11, 2026** • **📰 Harness Blog**

[**🔗 Read more**](https://www.harness.io/blog/software-delivery-platform)

### 📄 Scaling organizational knowledge in Kiro with Amazon Bedrock Knowledge Bases, LangChain, and MCP

“A pull request comes back with a single comment: “This doesn’t follow our circuit breaker pattern. Check the Architectural Decision Record .” You know the architecture decision record exists somewher

**📅 Aug 10, 2026** • **📰 AWS DevOps Blog**

[**🔗 Read more**](https://aws.amazon.com/blogs/devops/scaling-organizational-knowledge-in-kiro-with-amazon-bedrock-knowledge-bases-langchain-and-mcp/)

---

## 🏗️ IaC

### 📄 Compatibility Testing Pulumi HCL

Pulumi HCL has at its core a simple promise: A program that works for tofu apply will also work for pulumi up. This must be true to allow Terraform modules to be shared between tofu config and Pulumi 

**📅 Aug 14, 2026** • **📰 Pulumi Blog**

[**🔗 Read more**](https://www.pulumi.com/blog/compatibility-testing-pulumi-hcl/)

### 📄 Never Miss What Your Infrastructure Is Telling You

Plenty happens in a Pulumi organization while you’re looking somewhere else. Neo finishes a task you kicked off just before taking lunch. A teammate submits an ESC change request that needs your appro

**📅 Aug 11, 2026** • **📰 Pulumi Blog**

[**🔗 Read more**](https://www.pulumi.com/blog/notification-center/)

---

## 📊 Observability

### 📄 Streamline day-two SAP operations with Trento version 3

Key takeaways Automate compliance and observability: Trento version 3 delivers deep visibility into SAP environments by integrating Saptune and SUSE Multi-Linux Manager to track SAP notes and security

**📅 Aug 14, 2026** • **📰 SUSE Blog**

[**🔗 Read more**](https://www.suse.com/c/streamline-day-two-sap-operations-with-trento-version-3/)

### 📄 What can you do with OpenTelemetry entity events?

Metrics, logs, and traces tell you how your systems behave. They are much quieter about what actually exists: which hosts, interfaces, switches, services, and volumes are out there right now, and, cru

**📅 Aug 14, 2026** • **📰 OpenTelemetry Blog**

[**🔗 Read more**](https://opentelemetry.io/blog/2026/consuming-opentelemetry-entity-events/)

### 📄 Scheduled support lifecycle announcement about Fluent Package v7

Hi users! We had launched fluent-package v6 series last year, recently shipped v6.0.4 in LTS release channel. In this blog article, we explain the planned next major updates - v7.0.0. When the next LT

**📅 Aug 14, 2026** • **📰 Fluentd Blog**

[**🔗 Read more**](https://www.fluentd.org/blog/fluent-package-v7-scheduled-lifecycle)

### 📄 Certificate Transparency Monitoring is now generally available

Cloudflare's Certificate Transparency Monitoring is now generally available. The biggest change: we no longer email you about certificates Cloudflare issued for your domain, so when an alert lands in 

**📅 Aug 13, 2026** • **📰 Cloudflare Blog**

[**🔗 Read more**](https://blog.cloudflare.com/certificate-transparency-monitoring-ga/)

### 📄 Automated agent triage with Agent Tracing and Claude Routines

How Sentry uses a Claude Routine and the Sentry MCP to automatically triage 800 AI agent conversations overnight and file bugs.

**📅 Aug 13, 2026** • **📰 Sentry Blog**

[**🔗 Read more**](https://blog.sentry.io/claude-routines-agent-triage/)

### 📄 Windows Monitoring with Zabbix

Windows environments provide a variety of approaches for monitoring both on the OS and the application level. The article will cover utilizing Zabbix agent on Windows to collect and discover OS and ap

**📅 Aug 12, 2026** • **📰 Zabbix Blog**

[**🔗 Read more**](https://blog.zabbix.com/windows-monitoring-with-zabbix/33053/)

### 📄 Announcing General Availability of New Relic Notebooks

Troubleshoot faster with New Relic Notebooks. Combine live queries, visualizations, and text in one unified, collaborative workspace to end tab fatigue.

**📅 Aug 11, 2026** • **📰 New Relic Blog**

[**🔗 Read more**](https://newrelic.com/blog/news/announcing-general-availability-of-new-relic-notebooks)

### 📄 What's new in Sentry Logs: The summer 2026 roundup

Everything that shipped for Sentry Logs this summer: log pinning, JSONL exports, terabyte-scale search, and a dozen usability improvements.

**📅 Aug 11, 2026** • **📰 Sentry Blog**

[**🔗 Read more**](https://blog.sentry.io/sentry-logs-summer-2026-roundup/)

### 📄 Empowering Relics to Own Their Career Growth

Learn how New Relic’s 5th Grow Your Career Month equips employees with continuous learning, leadership development, and AI skills to drive career growth.

**📅 Aug 10, 2026** • **📰 New Relic Blog**

[**🔗 Read more**](https://newrelic.com/blog/news/empowering-relics-to-own-their-career-growth)

---

## 🔐 Security

### 📄 Threats Making WAVs - Incident Response to a Cryptomining Attack

Guardicore security researchers describe and uncover a full analysis of a cryptomining attack, which hid a cryptominer inside WAV files. The report includes the full attack vectors, from detection, in

**📅 Aug 17, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/security/threats-making-wavs-incident-reponse-cryptomining-attack)

### 📄 How Cloudflare detects MCP traffic and helps secure it

Cloudflare Gateway identifies MCP requests using protocol-level heuristics. Security teams can use that signal to find shadow MCP traffic, enforce Portal-only access for approved servers, and block di

**📅 Aug 14, 2026** • **📰 Cloudflare Blog**

[**🔗 Read more**](https://blog.cloudflare.com/mcp-security-updates/)

### 📄 Gitea 1.27.2 is released

We are excited to announce the release of **Gitea 1.27.2**, the second patch release for the 1.27 series. It contains a large batch of security fixes alongside bug fixes for Gitea Actions, packages, L

**📅 Aug 14, 2026** • **📰 Gitea Blog**

[**🔗 Read more**](https://blog.gitea.com/release-of-1.27.2/)

### 📄 Friday Five — August 14, 2026

TechZine: Red Hat tames the open source AI chaosThe AI ecosystem is still in its infancy. This is evident from the regular releases of immature, yet highly imaginative, open source solutions. It’s up 

**📅 Aug 14, 2026** • **📰 Red Hat Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/friday-five-august-14-2026-red-hat)

### 📄 What 50 open source projects taught us about security in the AI era

See how the open source projects in Session 4 of the GitHub Secure Open Source Fund combined AI-assisted workflows, maintainer expertise, GitHub security tools, expert guidance, and funding to improve

**📅 Aug 13, 2026** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/open-source/maintainers/what-50-open-source-projects-taught-us-about-security-in-the-ai-era/)

### 📄 PostgreSQL 18.6, 17.11, 16.15, 15.19, 14.24 and 19 Beta 3 Released!

The PostgreSQL Global Development Group has released an update to all supported versions of PostgreSQL, including 18.6, 17.11, 16.15, 15.19, and 14.24, as well as the third beta release of PostgreSQL 

**📅 Aug 13, 2026** • **📰 PostgreSQL News**

[**🔗 Read more**](https://www.postgresql.org/about/news/postgresql-186-1711-1615-1519-1424-and-19-beta-3-released-3365/)

### 📄 A new security baseline for enterprise agentic adoption

Agent Baseline is a blueprint for AI adoption that defines six security outcomes for putting enterprise agents to work without giving them unchecked authority. Consider this scenario: a customer-suppo

**📅 Aug 12, 2026** • **📰 Docker Blog**

[**🔗 Read more**](https://www.docker.com/blog/a-new-security-baseline-for-enterprise-agentic-adoption/)

### 📄 The Agent Baseline: 35 Controls, But Where Should You Start?

The Agent Baseline defines 35 controls across six security outcomes—but the right starting point depends on how your organization uses agents. Learn how to sequence controls for coding, internal, and 

**📅 Aug 12, 2026** • **📰 Snyk Blog**

[**🔗 Read more**](https://snyk.io/blog/agent-baseline-35-controls-where-should-you-start/)

### 📄 A sandbox is only as closed as what an AI agent can reach

In July, OpenAI and Hugging Face responsibly disclosed an OpenAI model under internal evaluation escaped its sandbox, reached the open internet, and accessed Hugging Face’s internal production infrast

**📅 Aug 12, 2026** • **📰 GitLab Blog**

[**🔗 Read more**](https://about.gitlab.com/blog/ai-agent-sandbox/)

---

## 💾 Databases

### 📄 PLEASE_READ_ME: The Opportunistic Ransomware Devastating MySQL Servers

Guardicore Labs uncovers a Ransomware detection campaign targeting MySQL servers. Attackers use Double Extortion and publish data to pressure victims.

**📅 Aug 17, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/security/please-read-me-opportunistic-ransomware-devastating-mysql-servers)

### 📄 Amazon RDS for Oracle now supports Oracle Application Express (APEX) version 26.1

Amazon Relational Database Service (Amazon RDS) for Oracle now supports Oracle Application Express (APEX) version 26.1. Amazon RDS for Oracle is a managed database service that makes it simple to set 

**📅 Aug 14, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/08/amazon-rds-oracle-apex-26-1/)

### 📄 AWS Billing and Cost Management introduces Managed Dashboards

AWS Billing and Cost Management (BCM) Dashboards now include Managed Dashboards. These are a collection of preconfigured and read-only dashboards located in your dashboard list. They deliver actionabl

**📅 Aug 14, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/08/aws-billing-and-cost-management-managed-dashboards/)

### 📄 plx : Write PostgreSQL functions in the language you already know.

What plx is plx is a PostgreSQL extension that lets you write stored functions and triggers in the dialect you already know (the current set is listed below). When you run CREATE FUNCTION, plx transpi

**📅 Aug 12, 2026** • **📰 PostgreSQL News**

[**🔗 Read more**](https://www.postgresql.org/about/news/plx-write-postgresql-functions-in-the-language-you-already-know-3358/)

### 📄 Dasha - performance dashboard

Dasha is an open source performance dashboard for PostgreSQL fleets. It connects to your clusters with a read-only role, shows what the databases are doing right now, and explains what to do about it.

**📅 Aug 12, 2026** • **📰 PostgreSQL News**

[**🔗 Read more**](https://www.postgresql.org/about/news/dasha-performance-dashboard-3360/)

### 📄 Fresh context: change data capture, not batch ETL

In many systems, the reason an agent quotes yesterday's data isn't the model. It's the pipeline behind it: a nightly ETL job that refreshed the agent's context hours ago. Change data capture (CDC) can

**📅 Aug 12, 2026** • **📰 Redis Blog**

[**🔗 Read more**](https://redis.io/blog/change-data-capture-vs-batch-etl-ai-agents/)

### 📄 Agent memory as a moat: how context compounds

Base LLM inference is stateless. The model doesn't remember your last conversation, your users' preferences, or the mistake your agent made ten minutes ago. Unless the app supplies persisted context, 

**📅 Aug 12, 2026** • **📰 Redis Blog**

[**🔗 Read more**](https://redis.io/blog/compounding-context-memory-as-the-moat/)

### 📄 How Medium Powers Real-Time Recommendations at 1M OPS

Inside Medium’s move from relational features to list features in its ScyllaDB-based feature store “Keep readers reading” is the not-so-simple goal of Medium’s recommendations system. To predict what’

**📅 Aug 11, 2026** • **📰 ScyllaDB Blog**

[**🔗 Read more**](https://www.scylladb.com/2026/08/11/medium-real-time-recommendations/)

### 📄 Accelerate PostgreSQL migrations using Gemini in Database Migration Service

Imagine this scenario: Your team decides to migrate a core application from an existing commercial database like Oracle or SQL Server to open source PostgreSQL or a fully managed service such as Alloy

**📅 Aug 11, 2026** • **📰 Google Cloud Blog**

[**🔗 Read more**](https://cloud.google.com/blog/products/databases/accelerate-postgresql-migrations-with-gemini-in-dms/)

### 📄 ScyllaDB Customer Experience Spotlight: Susie Solis

Meet Susie Solis, a Technical Support Engineer on the Customer Experience team here at ScyllaDB.

**📅 Aug 10, 2026** • **📰 ScyllaDB Blog**

[**🔗 Read more**](https://www.scylladb.com/2026/08/10/cx-spotlight-susie-solis/)

### 📄 Why Agentic AI Architecture Needs a Database, Not Just a Vector Store

Agentic AI architecture is the system design that lets an AI agent perceive context, reason over it, call tools, maintain memory, and take actions across multiple steps. It spans the model, the orches

**📅 Aug 10, 2026** • **📰 TiDB Blog**

[**🔗 Read more**](https://www.pingcap.com/blog/agentic-ai-architecture/)

---

## 🌐 Platforms

### 📄 The Oracle of Delphi Will Steal Your Credentials

Our deception technology is able to reroute attackers into honeypots, where they believe that they found their real target. The attacks brute forced passwords for RDP credentials to connect to the vic

**📅 Aug 17, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/security/the-oracle-of-delphi-steal-your-credentials)

### 📄 The Nansh0u Campaign – Hackers Arsenal Grows Stronger

In the beginning of April, three attacks detected in the Guardicore Global Sensor Network (GGSN) caught our attention. All three had source IP addresses originating in South-Africa and hosted by Volum

**📅 Aug 17, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/security/the-nansh0u-campaign-hackers-arsenal-grows-stronger)

### 📄 Sovereign Workload Placement: How Regulated Enterprises Decide Where Things Run

For more than a decade, cloud-first was the default. If a workload could run in the public cloud, it went there, and the architecture question was mostly about cost and speed. That default is being re

**📅 Aug 15, 2026** • **📰 SUSE Blog**

[**🔗 Read more**](https://www.suse.com/c/distributed-sovereign-architecture/)

### 📄 What’s new with Google Cloud

Want to know the latest from Google Cloud? Find it here in one handy location. Check back regularly for our newest updates, announcements, resources, events, learning opportunities, and more. Tip: Not

**📅 Aug 14, 2026** • **📰 Google Cloud Blog**

[**🔗 Read more**](https://cloud.google.com/blog/topics/inside-google-cloud/whats-new-google-cloud/)

### 📄 Secure all your internal vibe-coded applications — in one click

Introducing Cloudflare Access for Workers. Attach an Access policy directly to a Worker and it applies everywhere that Worker runs — routes, custom domains, workers.dev, and previews — automatically.

**📅 Aug 14, 2026** • **📰 Cloudflare Blog**

[**🔗 Read more**](https://blog.cloudflare.com/workers-protected-by-access/)

### 📄 Amazon SES click tracking now supports custom URL paths for mobile app deep linking

Amazon Simple Email Service (SES) now makes it easier to support mobile deep linking with the new ses:custom-path HTML attribute. When you add this attribute to an tag, SES carries your path segment t

**📅 Aug 14, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/08/amazon-ses-supports-customurl-deeplinking)

### 📄 What Is Disaster Recovery as a Service (DRaaS) & What Are Your Alternatives for Disaster Recovery and Business Continuity?

Critical services rarely fail at a convenient moment. Hardware breaks, software misbehaves and human error slips through, often when demand is highest. Planning for these events is a key part of respo

**📅 Aug 14, 2026** • **📰 SUSE Blog**

[**🔗 Read more**](https://www.suse.com/c/what-is-disaster-recovery-as-a-service-draas-what-are-your-alternatives-for-disaster-recovery-and-business-continuity/)

### 📄 ODC-Noord: Building blocks for an existing government cloud

How did a small team in the east of the Netherlands (Groningen) from the Government Datacenter North (ODC-Noord) grow into a supplier of crucial building blocks for the Netherlands digital government 

**📅 Aug 14, 2026** • **📰 OpenShift Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/odc-noord-building-blocks-existing-government-cloud)

### 📄 Breaking free from lock-in: How a leading insurance provider migrated 1,500 workloads to ROSA in 10 months

Imagine finding out your core platform contract is ending, leaving you with a multi million-dollar liability—and just 10 months to move 1,500 critical workloads. That was the reality for the engineeri

**📅 Aug 14, 2026** • **📰 OpenShift Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/breaking-free-lock-how-leading-insurance-provider-migrated-1500-workloads-rosa-10-months)

### 📄 AWS Client VPN now supports CLI, administration controls, and faster connections

AWS Client VPN introduces a rebuilt AWS VPN Client v6.0.x which offers new features like command-line interface (CLI) support, enterprise administrative controls, and faster connection establishment t

**📅 Aug 13, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/08/aws-client-vpn-cli/)

### 📄 Total eclipse of the Internet: traffic impacts in Iceland, Spain, and Portugal

Cloudflare's data shows a clear impact on Internet traffic from Iceland to Spain and Portugal, following the path of totality of the total solar eclipse that occurred on August 12, 2026.

**📅 Aug 13, 2026** • **📰 Cloudflare Blog**

[**🔗 Read more**](https://blog.cloudflare.com/total-eclipse-internet-traffic-iceland-spain-portugal/)

### 📄 Using BigQuery Graphs with measures for trusted agentic workloads

When enterprises transition from using simple chat assistants to autonomous, agentic workloads, they quickly run into a hard truth: Agents are prone to inaccurate insights when working with directly r

**📅 Aug 13, 2026** • **📰 Google Cloud Blog**

[**🔗 Read more**](https://cloud.google.com/blog/products/data-analytics/bigquery-graphs-with-measures-for-trusted-agentic-workloads/)

---

## 📰 Misc

### 📄 Visual Studio Code 1.134 (Insiders)

Learn what's new in Visual Studio Code 1.134 (Insiders) Read the full article

**📅 Aug 18, 2026** • **📰 VS Code Blog**

[**🔗 Read more**](https://code.visualstudio.com/updates/v1_134)

### 📄 GitHub Copilot’s Latest Update Bets on Model Choice, Not Model Loyalty

GitHub’s latest Copilot updates add Kimi K3, MAI-Code-1.1-Flash, Agent Plugins 1.0, model switching, CLI improvements, and local Ollama support.

**📅 Aug 17, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/github-copilots-latest-update-bets-on-model-choice-not-model-loyalty/)

### 📄 Per-developer environments were the goal. Agents moved the goalposts.

Multi-tenancy has moved in one direction for 60 years: the tenant keeps getting smaller. Mainframe time-sharing carved a single machine The post Per-developer environments were the goal. Agents moved 

**📅 Aug 15, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/new-tenant-is-change/)

### 📄 Grok 4.6 matched Fable 5 Max at an 85% discount. Downloadable models set that price.

I’m Matt Burns, Chief Content Officer at Insight Media Group. Each week, I round up the most important AI developments, The post Grok 4.6 matched Fable 5 Max at an 85% discount. Downloadable models se

**📅 Aug 15, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/grok-4-6-matched-fable-5-max/)

### 📄 Treat Business Workflow Changes Like Deployments

Business automation often reaches production without the release discipline applied to application code. A routing rule changes, an approval threshold moves, or an integration starts writing to a new 

**📅 Aug 14, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/treat-business-workflow-changes-like-deployments/)

### 📄 Apple’s new AI split means your iOS app could behave differently in China

Apple is splitting up its AI stack. Instead of rolling out the same system worldwide, the company reportedly built a The post Apple’s new AI split means your iOS app could behave differently in China 

**📅 Aug 14, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/apple-china-ai-model/)

### 📄 Alibaba’s new model promises Opus 4.6-level performance on your laptop

Alibaba recently made the open weights of its 2.4 trillion parameter Qwen3.8 model available. That’s a massive model, and its The post Alibaba’s new model promises Opus 4.6-level performance on your l

**📅 Aug 14, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/qwen38-27b-local-inference/)

### 📄 Microsoft Decouples AI Agents From the VS Code Editor in Latest Release

Microsoft has shipped Visual Studio Code 1.133, and the headline change is architectural rather than cosmetic: AI agent sessions now run in a dedicated background process rather than within the editor

**📅 Aug 14, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/microsoft-decouples-ai-agents-from-the-vs-code-editor-in-latest-release/)

### 📄 Exploring Compose HTML for Server Side Rendering

Something is happening in server-rendered web development. React shipped Server Components. HTMX made “hypermedia” cool again. Phoenix LiveView proved a server can push interactive UI updates without 

**📅 Aug 14, 2026** • **📰 JetBrains Blog**

[**🔗 Read more**](https://blog.jetbrains.com/kotlin/2026/08/exploring-compose-html-for-server-side-rendering/)

### 📄 Developer Resistance to AI Isn’t Fear – It is Identity

Developer resistance to AI is less about job loss than a deeper shift from hands-on coding to supervising, validating and orchestrating AI-generated work.

**📅 Aug 14, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/developer-resistance-to-ai-isnt-fear-it-is-identity/)

### 📄 How student athletes are changing the game

The program’s participants, pictured on their first day at Red HatOn June 1, the first cohort of student athletes arrived at the Raleigh office to take part in the Red Hat Sales Combine Accelerator Pr

**📅 Aug 14, 2026** • **📰 Red Hat Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/how-student-athletes-are-changing-game)

### 📄 Stop managing SAP infrastructure by hand. Automate it.

How SUSE helps organizations deploy SAP environments faster, more consistently and with less operational risk. Key Takeaways: Manual SAP deployments create configuration drift, slow down migrations an

**📅 Aug 13, 2026** • **📰 SUSE Blog**

[**🔗 Read more**](https://www.suse.com/c/stop-managing-sap-infrastructure-by-hand-automate-it/)
