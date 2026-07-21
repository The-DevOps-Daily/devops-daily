---
title: "DevOps Weekly Digest - Week 30, 2026"
date: "2026-07-20"
summary: "⚡ Curated updates from Kubernetes, cloud native tooling, CI/CD, IaC, observability, and security - handpicked for DevOps professionals!"
---

> 📌 **Handpicked by DevOps Daily** - Your weekly dose of curated DevOps news and updates!

---

## ⚓ Kubernetes

### 📄 Self-healing GPU nodes in Kubernetes: What we learned building the EKS node monitoring agent

When you run Kubernetes at the scale we do on Amazon EKS, nodes break constantly. GPUs fall off the PCIe The post Self-healing GPU nodes in Kubernetes: What we learned building the EKS node monitoring

**📅 Jul 19, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/self-healing-gpu-nodes/)

### 📄 Running a self-hosted LLM in Kubernetes with vLLM

Running large language model (LLM) workloads in-house is one of several patterns teams adopt alongside managed API services. Managed API services are convenient and well suited to many workloads. Self

**📅 Jul 16, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/07/16/running-a-self-hosted-llm-in-kubernetes-with-vllm/)

### 📄 OpenTelemetry Has Graduated… Now what?

In case you missed it: OpenTelemetry (OTel) has officially achieved CNCF graduated status! It now stands proudly alongside amazing open source projects such as Kubernetes and Prometheus, to name just 

**📅 Jul 15, 2026** • **📰 OpenTelemetry Blog**

[**🔗 Read more**](https://opentelemetry.io/blog/2026/otel-grad-now-what/)

### 📄 Two-node OpenShift with fencing improves reliability at the edge

Edge computing environments present distinct hurdles as companies move processing capabilities nearer to where data is generated. Customers across industries, especially in retail, industrial, and tel

**📅 Jul 15, 2026** • **📰 OpenShift Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/two-node-openshift-fencing-improves-reliability-edge)

### 📄 Building a Custom Metrics Exporter for Kubernetes

Kubernetes ships with built-in awareness of CPU and memory, but most real-world scaling decisions depend on signals that live entirely outside that narrow window: how many messages are waiting in a qu

**📅 Jul 14, 2026** • **📰 Kubernetes Blog**

[**🔗 Read more**](https://kubernetes.io/blog/2026/07/14/custom-metrics-exporter-kubernetes/)

### 📄 Operating AI/ML Workloads on Kubernetes: A Headlamp Plugin for Kubeflow

Kubernetes has quietly become the default platform for AI and machine learning. Whether you run notebook servers for data scientists, schedule distributed training jobs, tune hyperparameters, or orche

**📅 Jul 13, 2026** • **📰 Kubernetes Blog**

[**🔗 Read more**](https://kubernetes.io/blog/2026/07/13/introducing-headlamp-plugin-for-kubeflow/)

### 📄 Kubernetes Dashboard to Headlamp: A Step-by-Step Guide

1. Before you start: know what is changing Kubernetes Dashboard and Headlamp both show what is running in a cluster, but they work differently. When Headlamp runs on the desktop, it uses your existing

**📅 Jul 13, 2026** • **📰 Kubernetes Blog**

[**🔗 Read more**](https://kubernetes.io/blog/2026/07/13/kubernetes-dashboard-to-headlamp/)

### 📄 Blog: Introducing Flux Schema and the Ecosystem Catalog

In this blog post, we introduce Flux Schema, a new Flux CLI plugin for validating Kubernetes manifests against JSON Schema and CEL rules using the same evaluation semantics as the Kubernetes API serve

**📅 Jul 13, 2026** • **📰 Flux CD Blog**

[**🔗 Read more**](https://fluxcd.io/blog/2026/07/flux-schema-validation/)

---

## ☁️ Cloud Native

### 📄 Why goodput matters more than throughput for LLM serving

When we benchmark an LLM serving setup, the number almost everyone reaches for first is throughput: how many requests per second the system can push through. It is easy to measure, easy to compare, an

**📅 Jul 20, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/07/20/why-goodput-matters-more-than-throughput-for-llm-serving/)

### 📄 Flipkart and LitmusChaos at KubeCon + CloudNativeCon India 2026: A recap

KubeCon + CloudNativeCon India 2026 brought the cloud native community to Mumbai on June 18-19. For LitmusChaos, this was not just another conference. It was one of our most significant events to date

**📅 Jul 17, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/07/17/flipkart-and-litmuschaos-at-kubecon-cloudnativecon-india-2026-a-recap/)

### 📄 From the Captain’s Chair: Mohammad-Ali A’râbi

In this edition of From the Captain’s Chair, we’re interviewing Mohammad-Ali A'râbi, author, public speaker, and software engineer.

**📅 Jul 16, 2026** • **📰 Docker Blog**

[**🔗 Read more**](https://www.docker.com/blog/from-the-captains-chair-mohammad-ali-arabi/)

### 📄 Argo Rollouts 1.10 Release Candidate

We’re excited to announce the release candidate for Argo Rollouts 1.10! This release includes contributions from 46 contributors and includes 98 commits, covering more reliable rollout reconciliation,

**📅 Jul 16, 2026** • **📰 ArgoCD Blog**

[**🔗 Read more**](https://blog.argoproj.io/argo-rollouts-1-10-release-candidate-24c9edc69abe?source=rss----21be29067291---4)

### 📄 AI Agents Explained: How to Build with Them Safely

Learn what AI agents are, how they work, and what it takes to build and run them safely in production.

**📅 Jul 16, 2026** • **📰 Docker Blog**

[**🔗 Read more**](https://www.docker.com/blog/what-are-ai-agents/)

### 📄 The Developer Has Changed. So Should Developer Conferences

Discover why Docker is co-hosting WeAreDevelopers World Congress North America and how AI agents are transforming software development and developer communities.

**📅 Jul 16, 2026** • **📰 Docker Blog**

[**🔗 Read more**](https://www.docker.com/blog/docker-wearedevelopers-world-congress-north-america-2026/)

### 📄 HAMi becomes a CNCF incubating project

The CNCF Technical Oversight Committee (TOC) has voted to accept HAMi as a CNCF incubating project. About HAMi Modern AI infrastructure teams run into the same problem over and over: expensive GPUs of

**📅 Jul 15, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/07/15/hami-becomes-a-cncf-incubating-project/)

### 📄 AI’s Financial Blind Spot: Why Long-Term Success Depends on Cost Transparency

When a technology with revolutionary potential like AI emerges, it’s easy for companies to let enthusiasm outrun fiscal discipline. In the race to transform operations and outpace competitors, cost co

**📅 Jul 14, 2026** • **📰 Kubecost Blog**

[**🔗 Read more**](https://www.apptio.com/blog/ais-financial-blind-spot-why-long-term-success-depends-on-cost-transparency/)

### 📄 AI Engineer World’s Fair 2026: The Runtime Is Where Agent Trust Is Won

We spent the week at AI Engineer World's Fair in San Francisco, on stage and on the floor. Here's what we heard, and where we think it lands for anyone building with agents.

**📅 Jul 14, 2026** • **📰 Docker Blog**

[**🔗 Read more**](https://www.docker.com/blog/ai-engineer-worlds-fair-2026-the-runtime-is-where-agent-trust-is-won/)

---

## 🔄 CI/CD

### 📄 The cost of saying yes has changed

The cost of writing code dropped; the cost of owning it didn't. A framework for deciding which changes are actually cheap in the AI era. The post The cost of saying yes has changed appeared first on T

**📅 Jul 17, 2026** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/engineering/the-cost-of-saying-yes-has-changed/)

### 📄 Building a Zero Trust Service for CI/CD Pipelines

How Harness built the Zero Trust Service: a customer-owned layer that verifies every CI/CD pipeline task at runtime before it executes. | Blog

**📅 Jul 17, 2026** • **📰 Harness Blog**

[**🔗 Read more**](https://www.harness.io/blog/building-a-zero-trust-service-for-ci-cd-how-we-intercept-every-task-before-it-executes)

### 📄 Turn multi-step software delivery into agentic flows you can trust

Knowing what to do next in software development is rarely the hard part. Doing it again in the exact same steps — implement an issue, fix a pipeline, review a merge request — is. Chat that only provid

**📅 Jul 16, 2026** • **📰 GitLab Blog**

[**🔗 Read more**](https://about.gitlab.com/blog/multi-step-software-delivery-with-agentic-flows/)

### 📄 GitLab Duo Security Review spots logic flaws scanners miss

Static scanners excel at catching vulnerabilities that fit a known pattern, like unsanitized query inputs, hardcoded secrets, and unsafe deserialization. They struggle against flaws in your applicatio

**📅 Jul 16, 2026** • **📰 GitLab Blog**

[**🔗 Read more**](https://about.gitlab.com/blog/gitlab-duo-security-review-flow/)

### 📄 Bring GitLab Duo Agent Platform to your terminal

Most of the work for software delivery doesn’t happen only in the editor. Pipelines fail. Tests break. Vulnerabilities show up. And a lot of that work starts and ends at the command line. Agentic AI i

**📅 Jul 16, 2026** • **📰 GitLab Blog**

[**🔗 Read more**](https://about.gitlab.com/blog/gitlab-duo-cli-generally-available/)

### 📄 Forrester Consulting: GitLab Duo Agent Platform delivers 400% ROI

A new Forrester Consulting Total Economic Impact™ study found that organizations using GitLab Duo Agent Platform achieve a 400% return on investment and $7.5 million in net present value over three ye

**📅 Jul 16, 2026** • **📰 GitLab Blog**

[**🔗 Read more**](https://about.gitlab.com/blog/gitlab-duo-agent-platform-delivers-400-percent-roi/)

### 📄 Least-Privilege AI Agents: Identity & Permissions in Harness

How Harness scopes AI Worker Agent access with delegated identity, ephemeral tokens, RBAC, OPA policy, and the MCP gateway tool, enforced server-side. | Blog

**📅 Jul 16, 2026** • **📰 Harness Blog**

[**🔗 Read more**](https://www.harness.io/blog/identity-and-permissions-for-ai-worker-agents-in-harness)

### 📄 GitHub for Beginners: Your roadmap to mastering the GitHub essentials

New to GitHub? This beginner's guide explains version control, repositories, and pull requests—plus everything else you need to start working confidently on GitHub. The post GitHub for Beginners: Your

**📅 Jul 15, 2026** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/developer-skills/github/github-for-beginners-your-roadmap-to-mastering-the-github-essentials/)

### 📄 Accessing private Git repositories from Amazon EKS capability for Argo CD

In this post, we walk you through three main steps: First, you create an AWS CodeConnections host in your VPC with connectivity to your private Git server. Second, you establish a connection that Argo

**📅 Jul 13, 2026** • **📰 AWS Containers Blog**

[**🔗 Read more**](https://aws.amazon.com/blogs/containers/accessing-private-git-repositories-from-amazon-eks-capability-for-argo-cd/)

---

## 🏗️ IaC

### 📄 HashiCorp Introduces tfpolicy, a Native Policy Framework for Terraform

HashiCorp’s new tfpolicy framework brings native policy-as-code governance to Terraform using HCL and lifecycle-aware infrastructure checks.

**📅 Jul 20, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/hashicorp-introduces-tfpolicy-a-native-policy-framework-for-terraform/)

### 📄 Amazon SageMaker HyperPod now supports partition-level topology for Slurm orchestrated clusters

Amazon SageMaker HyperPod now supports network topology configuration at the partition level for Slurm orchestrated clusters. A single cluster can now run tree topology in one partition and block topo

**📅 Jul 17, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/07/hyperpod-partition-topology-slurm/)

### 📄 Why Database DevOps Matters in Modern Software Delivery

Infrastructure as Code transformed infrastructure delivery. Learn why database delivery requires a different approach and how Database DevOps closes the gap. | Blog

**📅 Jul 17, 2026** • **📰 Harness Blog**

[**🔗 Read more**](https://www.harness.io/blog/database-devops-modern-software-delivery)

### 📄 Connect Your Cloud Accounts to Pulumi in Minutes

Pulumi Insights gives you visibility and governance across your entire cloud footprint, but that visibility is only as complete as the set of accounts you’ve connected. Until now, connecting an accoun

**📅 Jul 15, 2026** • **📰 Pulumi Blog**

[**🔗 Read more**](https://www.pulumi.com/blog/connect-your-cloud-accounts-to-pulumi-in-minutes/)

### 📄 Eliminating Infrastructure Cost Blind Spots: Embedding FinOps into IBM Terraform Workflows with IBM Cloudability

IBM Terraform enables organizations to automate infrastructure provisioning consistently across environments with policy-driven workflows and secure, scalable execution. IBM Cloudability adds near rea

**📅 Jul 14, 2026** • **📰 Kubecost Blog**

[**🔗 Read more**](https://www.apptio.com/blog/eliminating-infrastructure-cost-blind-spots-embedding-finops-into-ibm-terraform-workflows-with-ibm-cloudability/)

### 📄 Introducing Usage Limits for Pulumi Neo

Pulumi Neo is an AI agent that takes on real infrastructure work, and it’s natural to want to hand it more and more. Usage limits give you control so you can do exactly that: set a monthly dollar limi

**📅 Jul 14, 2026** • **📰 Pulumi Blog**

[**🔗 Read more**](https://www.pulumi.com/blog/neo-usage-limits/)

### 📄 Knowledge as Code: The Memory File Just Got a Spec

Five weeks ago I wrote that the least glamorous piece of an agent loop is also the one that decides whether it compounds: memory. A markdown file outside the context window that holds what is done, wh

**📅 Jul 14, 2026** • **📰 Pulumi Blog**

[**🔗 Read more**](https://www.pulumi.com/blog/knowledge-as-code-the-memory-file-just-got-a-spec/)

---

## 📊 Observability

### 📄 Amazon OpenSearch UI now supports one-click dashboard migration

Amazon OpenSearch Service now supports one-click migration from legacy OpenSearch Dashboards to OpenSearch UI, for both OpenSearch domains and serverless collections. OpenSearch UI is the new, zero-do

**📅 Jul 17, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/07/amazon-opensearch-ui-one-click-dashboard-migration)

### 📄 Tracing a memory leak bug in PID 1 and contributing an upstream fix: a Linux support story

How Canonical Support helped a global retail organization trace the cause for an unusual memory leak originating in PID 1. By investigating the issue across three separate system layers our team was a

**📅 Jul 17, 2026** • **📰 Ubuntu Blog**

[**🔗 Read more**](https://ubuntu.com//blog/fixing-memory-bug)

### 📄 Amazon Managed Grafana achieves FedRAMP High authorization in AWS GovCloud (US)

Amazon Managed Grafana is now a FedRAMP High authorized service in the AWS GovCloud (US-East) and AWS GovCloud (US-West) regions. Federal agencies, public sector organizations, and other enterprises w

**📅 Jul 16, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/07/amazon-managed-grafana-fedramp-high/)

### 📄 Announcing v1 of OpenTelemetry Go Compile-Time Instrumentation

If you write Java, Python, Node.js, or .NET, you have been able to add OpenTelemetry to an application without editing its code for years: attach an agent at startup and telemetry starts flowing. Go h

**📅 Jul 16, 2026** • **📰 OpenTelemetry Blog**

[**🔗 Read more**](https://opentelemetry.io/blog/2026/go-compile-time-instrumentation-v1/)

### 📄 ObservabilityCON 2026: Register today and preview this year's agenda

This fall, prepare to leave your heart in San Francisco. Registration is officially open for ObservabilityCON 2026, our flagship observability event that’s taking place from October 19-21 at Pier 27 i

**📅 Jul 16, 2026** • **📰 Grafana Blog**

[**🔗 Read more**](https://grafana.com/blog/observabilitycon-2026-register-today-and-preview-this-year-s-agenda/)

### 📄 New Relic Autopilot Brings Autonomous Operations to Life

Learn how New Relic Autopilot transforms observability into Autonomous Operations by reasoning across operational context, recommending evidence-based actions, and accelerating incident resolution.

**📅 Jul 16, 2026** • **📰 New Relic Blog**

[**🔗 Read more**](https://newrelic.com/blog/ai/new-relic-autopilot-autonomous-operations)

### 📄 Your AI Doesn’t Need More Intelligence. It Needs More Context.

Discover why trusted operational intelligence is the foundation for Autonomous Operations and the future of enterprise AI.

**📅 Jul 16, 2026** • **📰 New Relic Blog**

[**🔗 Read more**](https://newrelic.com/blog/ai/autonomous-operations-trusted-operational-intelligence)

### 📄 New Relic Ground Truth

New Relic Ground Truth transforms observability data into trusted operational intelligence that enables AI agents and Autonomous Operations.

**📅 Jul 16, 2026** • **📰 New Relic Blog**

[**🔗 Read more**](https://newrelic.com/blog/ai/new-relic-ground-truth)

### 📄 Your agent should understand what you see

How Sentry replaced ASCII page snapshots with structured semantic context to make Seer Agent faster, cheaper, and ready for agentic actions.

**📅 Jul 16, 2026** • **📰 Sentry Blog**

[**🔗 Read more**](https://blog.sentry.io/seer-agent-page-context/)

### 📄 Grafana Labs named a Leader again in the 2026 Gartner® Magic Quadrant™ for Observability Platforms

We’re delighted to share that Grafana Labs has been named a Leader in the Gartner® Magic Quadrant™ for Observability Platforms for the third consecutive year. Notably, we’re also positioned furthest i

**📅 Jul 15, 2026** • **📰 Grafana Blog**

[**🔗 Read more**](https://grafana.com/blog/grafana-labs-named-a-leader-again-in-the-2026-gartner-magic-quadrant-for-observability-platforms/)

### 📄 Top Splunk Alternatives: What to Consider in 2026

Compare top Splunk alternatives to reduce costs and complexity. Find a unified observability platform that improves performance and simplifies your log management.

**📅 Jul 15, 2026** • **📰 New Relic Blog**

[**🔗 Read more**](https://newrelic.com/blog/observability/splunk-alternatives)

### 📄 The Evolution of an SNMP Auto-Discovery Tool

Buckle up for the story of how we went from drowning in snmpwalk output to building a device-centric path toward Zabbix 7 walk-based templates. The original problem Every monitoring engineer knows thi

**📅 Jul 15, 2026** • **📰 Zabbix Blog**

[**🔗 Read more**](https://blog.zabbix.com/the-evolution-of-an-snmp-auto-discovery-tool/33123/)

---

## 🔐 Security

### 📄 Threats Making WAVs - Incident Response to a Cryptomining Attack

Guardicore security researchers describe and uncover a full analysis of a cryptomining attack, which hid a cryptominer inside WAV files. The report includes the full attack vectors, from detection, in

**📅 Jul 20, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/security/threats-making-wavs-incident-reponse-cryptomining-attack)

### 📄 xAI Open-Sources Grok Build Coding Agent After Cloud Upload Exposes SSH Keys, Repos

xAI has published the full source code for Grok Build, its terminal-based AI coding agent, on GitHub under an Apache 2.0 license. The release lands three days after a security researcher showed the to

**📅 Jul 20, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/xai-open-sources-grok-build-coding-agent-after-cloud-upload-exposes-ssh-keys-repos/)

### 📄 AI didn’t replace our security team — it multiplied it.

For years, the assumption in security has been straightforward: mature detection and response programs require a Security Operations Center (SOC). The post AI didn’t replace our security team — it mul

**📅 Jul 18, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/scaling-security-with-ai/)

### 📄 Cloudflare WAF protects WordPress applications from two high-severity vulnerabilities

Cloudflare has deployed two WAF rules in response to high-severity vulnerabilities disclosed to us by the WordPress security team. The new rules protect all Cloudflare customers using affected WordPre

**📅 Jul 17, 2026** • **📰 Cloudflare Blog**

[**🔗 Read more**](https://blog.cloudflare.com/wordpress-vulnerabilities/)

### 📄 Level Up Your Column-level Security: Using IAM Data Governance Tags in BigQuery

Many BigQuery customers rely on policy tags for protecting their sensitive information in BigQuery. Policy tags were the go-to solution for applying column-level access controls, allowing only users w

**📅 Jul 17, 2026** • **📰 Google Cloud Blog**

[**🔗 Read more**](https://cloud.google.com/blog/products/data-analytics/level-up-your-column-level-security-using-iam-data-governance-tags-in-bigquery/)

### 📄 Agentic AI, Red Hat OpenShift, and NVIDIA: Shifting to precision security

Red Hat is pioneering the use of agentic AI to shift vulnerability management from volume to precision. By combining the security-hardened foundation of Red Hat OpenShift with advanced AI frameworks f

**📅 Jul 17, 2026** • **📰 OpenShift Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/agentic-ai-red-hat-openshift-and-nvidia-shifting-precision-security)

### 📄 Why You Need AI Agent Security Validation in Software Testing

Engineering teams have been racing for the last two years to deploy AI agents that can find bugs faster than any QA team ever could. Autonomous testing agents can crawl through codebases, identify vul

**📅 Jul 16, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/why-you-need-ai-agent-security-validation-in-software-testing/)

### 📄 How insurance organizations balance strict compliance with data agility

While many organizations have recently adopted a cloud-first strategy, a significant number of those have since pivoted to operating in an open hybrid cloud environment. For insurance organizations, a

**📅 Jul 15, 2026** • **📰 OpenShift Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/how-insurance-organizations-balance-strict-compliance-data-agility)

---

## 💾 Databases

### 📄 Spark 4.2 has a feature that could retire your vector database

Apache Spark 4.2 launched last week, and it signals an expansion of Spark’s decade-plus role at the center of enterprise The post Spark 4.2 has a feature that could retire your vector database appeare

**📅 Jul 19, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/spark-4-2-ai-workloads/)

### 📄 From One Week to 22 Minutes: How Bolt Migrated MySQL to TiDB

When a table crosses one terabyte, MySQL does not fail. It just starts charging for everything. A single index change takes over a week, blocks every other change queued behind it on the cluster, and 

**📅 Jul 17, 2026** • **📰 TiDB Blog**

[**🔗 Read more**](https://www.pingcap.com/blog/bolt-mysql-migration-tidb/)

### 📄 Novita Artifact Hosting + TiDB: Deploying AI-Generated Apps With One SDK Call

AI coding agents such as Cursor, Claude Code, and Devin can now produce a working application from a single prompt. However, most of this code still never reaches production. The blocker is rarely cod

**📅 Jul 16, 2026** • **📰 TiDB Blog**

[**🔗 Read more**](https://www.pingcap.com/blog/novita-artifact-hosting-tidb/)

### 📄 “Where Were We?” Watch Meko Give AI Agents a Shared Context

Developers and engineering teams building production multi-agent AI applications need their agent systems to learn and improve collectively, not just store and retrieve data. This blog explores Meko’s

**📅 Jul 16, 2026** • **📰 Yugabyte Blog**

[**🔗 Read more**](https://www.yugabyte.com/blog/watch-meko-give-ai-agents-a-shared-context/)

### 📄 Zero Downtime Database Migrations: Safe Schema Changes

Learn zero downtime database migration strategies using backward-compatible schema changes, dual writes, and safe rollout patterns. | Blog

**📅 Jul 16, 2026** • **📰 Harness Blog**

[**🔗 Read more**](https://www.harness.io/blog/zero-downtime-database-migrations-safe-schema-changes)

### 📄 PostgreSQL 19 Beta 2 Released!

The PostgreSQL Global Development Group announces that the second beta release of PostgreSQL 19 is now available for download. This release contains PostgreSQL 19 feature previews ahead of general ava

**📅 Jul 16, 2026** • **📰 PostgreSQL News**

[**🔗 Read more**](https://www.postgresql.org/about/news/postgresql-19-beta-2-released-3350/)

### 📄 Real-time context: keeping agent inputs fresh on every step

Your AI agent issued the refund. It read the customer's tier, checked the return window, confirmed the policy, and processed it in seconds. The problem: the return window had closed four minutes earli

**📅 Jul 15, 2026** • **📰 Redis Blog**

[**🔗 Read more**](https://redis.io/blog/real-time-context-ai-agents-fresh-inputs/)

### 📄 CEO Rowan Trollope’s organizational announcement to Redis employees

Today, we are announcing an organizational change at Redis, including a reduction of approximately 200 roles globally and a realignment of roles, teams, and priorities across the company. This is a di

**📅 Jul 15, 2026** • **📰 Redis Blog**

[**🔗 Read more**](https://redis.io/blog/ceo-rowan-trollopes-organizational-announcement-to-redis-employees/)

### 📄 Build Durable Chat Memory for RAG Using ScyllaDB and LangChain

How to replace LangChain's in-memory chat history with ScyllaDB — so your RAG chatbot retains context across restarts and scales across replicas

**📅 Jul 14, 2026** • **📰 ScyllaDB Blog**

[**🔗 Read more**](https://www.scylladb.com/2026/07/14/durable-chat-memory-for-rag-scylladb-and-langchain/)

### 📄 Agent interoperability: a complete explainer

You built a research AI agent in the LangGraph framework. Another team shipped a customer-service agent in CrewAI. A third team wired up tools through the OpenAI Agents SDK. Now leadership asks: can t

**📅 Jul 14, 2026** • **📰 Redis Blog**

[**🔗 Read more**](https://redis.io/blog/agent-interoperability-complete-integration-guide/)

---

## 🌐 Platforms

### 📄 Keep Your Tech Flame Alive: Trailblazer Rachel Bayley

In this Akamai FLAME Trailblazer blog post, Rachel Bayley encourages women to step into the unknown and to be their authentic selves.

**📅 Jul 20, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/culture/2024/may/keep-your-tech-flame-alive-trailblazer-rachel-bayley)

### 📄 The Oracle of Delphi Will Steal Your Credentials

Our deception technology is able to reroute attackers into honeypots, where they believe that they found their real target. The attacks brute forced passwords for RDP credentials to connect to the vic

**📅 Jul 20, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/security/the-oracle-of-delphi-steal-your-credentials)

### 📄 The Nansh0u Campaign – Hackers Arsenal Grows Stronger

In the beginning of April, three attacks detected in the Guardicore Global Sensor Network (GGSN) caught our attention. All three had source IP addresses originating in South-Africa and hosted by Volum

**📅 Jul 20, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/security/the-nansh0u-campaign-hackers-arsenal-grows-stronger)

### 📄 Amazon GameLift Streams now supports IAM role credentials for stream sessions

Amazon GameLift Streams now supports assigning an IAM role to a stream session, enabling your application to securely access resources in your AWS account, such as Amazon S3 buckets and DynamoDB table

**📅 Jul 17, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/07/amazon-gamelift-streams-iam/)

### 📄 What’s new with Google Cloud

Want to know the latest from Google Cloud? Find it here in one handy location. Check back regularly for our newest updates, announcements, resources, events, learning opportunities, and more. Tip: Not

**📅 Jul 17, 2026** • **📰 Google Cloud Blog**

[**🔗 Read more**](https://cloud.google.com/blog/topics/inside-google-cloud/whats-new-google-cloud/)

### 📄 13 hands-on demos to build on Gemini Enterprise Agent Platform

Earlier this year, we introduced Gemini Enterprise Agent Platform, where you can build, scale, govern, and optimize agents. Today, we’re sharing 13 demos that walk you through what Agent Platform can 

**📅 Jul 17, 2026** • **📰 Google Cloud Blog**

[**🔗 Read more**](https://cloud.google.com/blog/products/ai-machine-learning/13-demos-on-gemini-enterprise-agent-platform/)

### 📄 PhpStorm 2026.2 is Now Out

Welcome to the PhpStorm 2026.2 release overview. This version advances PhpStorm as a platform for your preferred coding agents, models, and AI subscriptions, improves PHP and Laravel support, and deli

**📅 Jul 17, 2026** • **📰 JetBrains Blog**

[**🔗 Read more**](https://blog.jetbrains.com/phpstorm/2026/07/phpstorm-2026-2-is-now-out/)

### 📄 Guide to AI Tokenomics: Eleven Principles for Token Efficient Software Engineering

Optimizing token consumption is key to keeping AI coding assistants fast and accurate. You might not be writing every line of code any more, but now you’re responsible for directing those coding assis

**📅 Jul 17, 2026** • **📰 Google Cloud Blog**

[**🔗 Read more**](https://cloud.google.com/blog/topics/developers-practitioners/guide-to-ai-tokenomics-eleven-principles-for-token-efficient-software-engineering/)

### 📄 Roll it out, roll it back, never redeploy

Merge now, release when you're ready: turn a feature on for your team, then 10% of users, then everyone. Feature flags are now built into every Railway project, and your agents can run the rollout fro

**📅 Jul 17, 2026** • **📰 Railway Blog**

[**🔗 Read more**](https://blog.railway.com/p/feature-flags)

### 📄 Introducing Red Hat build of Karpenter

Achieving infrastructure efficiency and controlling compute costs is a continuous effort. While traditional machine pools are effective for steady workloads, scaling diverse applications often require

**📅 Jul 17, 2026** • **📰 OpenShift Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/introducing-red-hat-build-karpenter)

### 📄 Why your AI agent framework isn't enough: 7 platform capabilities missing from production

Your agent works. I know it does. You built it on LangChain or CrewAI or something custom, you tested it against real scenarios, and it handled them. The problem isn't the agent. The problem is everyt

**📅 Jul 17, 2026** • **📰 Red Hat Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/why-your-ai-agent-framework-isnt-enough-7-platform-capabilities-missing-production)

### 📄 Friday Five — July 17, 2026

InfoWorld - Red Hat OpenShift 4.22 tackles cloud costs, AI workloadsInfoWorld looks at Red Hat OpenShift 4.22, the latest version of Red Hat's hybrid cloud application platform. The release focuses on

**📅 Jul 17, 2026** • **📰 Red Hat Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/friday-five-july-17-2026-red-hat)

---

## 📰 Misc

### 📄 Visual Studio Code 1.130 (Insiders)

Learn what's new in Visual Studio Code 1.130 (Insiders) Read the full article

**📅 Jul 22, 2026** • **📰 VS Code Blog**

[**🔗 Read more**](https://code.visualstudio.com/updates/v1_130)

### 📄 Move code review before the code

The pull request as we know it is roughly 20 years old, younger than the careers of many people now The post Move code review before the code appeared first on The New Stack.

**📅 Jul 19, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/move-code-review-upstream/)

### 📄 AI-Generated Code Is Cheap But the Context Infrastructure Behind It Is Not

The cost curve for generating code with AI has moved in one direction, and it has moved fast. What used to require a senior engineer’s full attention for an afternoon can now be scaffolded in minutes,

**📅 Jul 17, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/ai-generated-code-is-cheap-but-the-context-infrastructure-behind-it-is-not/)

### 📄 Kotlin Turns 15: Celebrate the Kotlin Effect

🎉 Kotlin turns 15! 🎉 For 15 years, you’ve helped shape Kotlin into the language it is today. Whether you’ve built apps, contributed to the ecosystem, taught others, or simply chosen Kotlin for your 

**📅 Jul 17, 2026** • **📰 JetBrains Blog**

[**🔗 Read more**](https://blog.jetbrains.com/kotlin/2026/07/kotlin-turns-15-celebrate-the-kotlin-effect/)

### 📄 Key Takeaways From PHPverse 2026

On June 9, PHPverse 2026 brought together PHP developers from different backgrounds to watch talks by domain experts, exchange opinions, and even try to catch a running elePHPant. The five-hour live s

**📅 Jul 17, 2026** • **📰 JetBrains Blog**

[**🔗 Read more**](https://blog.jetbrains.com/phpstorm/2026/07/key-takeaways-from-phpverse-2026/)

### 📄 What’s New in IntelliJ IDEA 2026.2

IntelliJ IDEA 2026.2 is here! This version brings updates designed to streamline your workflows and help you confidently adopt the latest innovations across the Java ecosystem. You can download this l

**📅 Jul 16, 2026** • **📰 JetBrains Blog**

[**🔗 Read more**](https://blog.jetbrains.com/idea/2026/07/intellij-idea-2026-2/)

### 📄 Why Operational Resilience and Digital Sovereignty Top the CIO Agenda - by Martin Lentle

For CIOs across the Middle East Africa, keeping systems online is the foundation of customer trust. As public sector institutions and private enterprises accelerate their digital transformation, maint

**📅 Jul 16, 2026** • **📰 Red Hat Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/why-operational-resilience-and-digital-sovereignty-top-cio-agenda)

### 📄 Interactive labs: Enterprise lab environments, ready in minutes at no cost

Before anything reaches production, you have to test it, validate it, and sometimes learn about it from scratch. All 3 of these steps are necessary to have a properly running environment but your wind

**📅 Jul 16, 2026** • **📰 Red Hat Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/interactive-labs-enterprise-lab-environments-ready-minutes-no-cost)

### 📄 Visual Studio Code 1.129

Learn what is new in Visual Studio Code 1.129. Read the full article

**📅 Jul 15, 2026** • **📰 VS Code Blog**

[**🔗 Read more**](https://code.visualstudio.com/updates/v1_129)

### 📄 Shaking Up the Radio Access Network with SUSE and OCUDU

Telecom networks traditionally run on proprietary hardware and software stacks that lock operators into rigid vendor roadmaps. If you want to change a single component, you often have to overhaul the 

**📅 Jul 15, 2026** • **📰 SUSE Blog**

[**🔗 Read more**](https://www.suse.com/c/shaking-up-the-radio-access-network-with-suse-and-ocudu/)

### 📄 AI Hardware Shortages: How Enterprises Can Do More With Existing Infrastructure

Key takeaways AI hardware shortages are forcing enterprises to rethink how they plan, deploy and scale AI infrastructure. GPU shortages, procurement delays and rising infrastructure costs are delaying

**📅 Jul 15, 2026** • **📰 SUSE Blog**

[**🔗 Read more**](https://www.suse.com/c/ai-hardware-shortages-how-enterprises-can-do-more-with-existing-infrastructure/)
