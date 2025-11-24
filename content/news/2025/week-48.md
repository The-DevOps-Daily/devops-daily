---
title: "DevOps Weekly Digest - Week 48, 2025"
date: "2025-11-24"
summary: "⚡ Curated updates from Kubernetes, cloud native tooling, CI/CD, IaC, observability, and security - handpicked for DevOps professionals!"
---

> 📌 **Handpicked by DevOps Daily** - Your weekly dose of curated DevOps news and updates!

---

## ⚓ Kubernetes

### 📄 Introducing the fully managed Amazon EKS MCP Server (preview)

Learn how to manage your Amazon Elastic Kubernetes Service (Amazon EKS) clusters through simple conversations instead of complex kubectl commands or deep Kubernetes expertise. This post shows you how 

**📅 Nov 21, 2025** • **📰 AWS Containers Blog**

[**🔗 Read more**](https://aws.amazon.com/blogs/containers/introducing-the-fully-managed-amazon-eks-mcp-server-preview/)

### 📄 How Google Does It: Building the largest known Kubernetes cluster, with 130,000 nodes

At Google Cloud, we’re constantly pushing the scalability of Google Kubernetes Engine (GKE) so that it can keep up with increasingly demanding workloads — especially AI. GKE already supports massive 6

**📅 Nov 21, 2025** • **📰 Google Cloud Blog**

[**🔗 Read more**](https://cloud.google.com/blog/products/containers-kubernetes/how-we-built-a-130000-node-gke-cluster/)

### 📄 Guide to Amazon EKS and Kubernetes sessions at AWS re:Invent 2025

In this post, we provide a comprehensive guide to the 48 Amazon EKS and Kubernetes sessions at AWS re:Invent 2025, covering everything from simplified cluster management with Amazon EKS Auto Mode to a

**📅 Nov 21, 2025** • **📰 AWS Containers Blog**

[**🔗 Read more**](https://aws.amazon.com/blogs/containers/guide-to-amazon-eks-and-kubernetes-sessions-at-aws-reinvent-2025/)

### 📄 How I Cut Kubernetes Debugging Time by 80% With One Bash Script

Here's the truth about Kubernetes troubleshooting: 80% of your time goes into finding WHAT broke and WHERE it broke. Only 20% goes into actually fixing it. For months, I lived this reality, managing e

**📅 Nov 20, 2025** • **📰 DZone DevOps**

[**🔗 Read more**](https://feeds.dzone.com/link/23568/17213891/cut-kubernetes-debugging-time)

### 📄 Kubernetes CSI Drivers

In the Kubernetes ecosystem, storage has many facets. The most obvious ones are StorageClass, PersistentVolume, and PersistentVolumeClaim. We have all used them to get storage mounted to pods, but tha

**📅 Nov 20, 2025** • **📰 DZone DevOps**

[**🔗 Read more**](https://feeds.dzone.com/link/23568/17213840/kubernetes-csi-drivers)

### 📄 An architectural decision: Containers on bare metal or on virtual machines

Building and running modern applications begins with selecting Kubernetes distribution as a baseline. Once a platform team has selected its orchestration layer, one of the next architectural choices i

**📅 Nov 20, 2025** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2025/11/20/an-architectural-decision-containers-on-bare-metal-or-on-virtual-machines/)

### 📄 What's new in the migration toolkit for virtualization 2.10

The migration toolkit for virtualization 2.10 (MTV) is now generally available and expands on capabilities introduced in the recent release to better support your virtual machine (VM) migration journe

**📅 Nov 19, 2025** • **📰 OpenShift Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/whats-new-migration-toolkit-virtualization-210)

### 📄 Top 5 hard-earned lessons from the experts on managing Kubernetes

Kubernetes has transformed how modern organizations deploy and operate scalable infrastructure, and the hype around automated cloud native orchestration has made its adoption nearly ubiquitous over th

**📅 Nov 18, 2025** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2025/11/18/top-5-hard-earned-lessons-from-the-experts-on-managing-kubernetes/)

### 📄 Kgateway v2.1 is released!

Kgateway is an open source implementation of the Kubernetes Gateway API that unifies ingress, API gateway, service mesh, and AI gateway capabilities in a singular modular control plane. Built for perf

**📅 Nov 18, 2025** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2025/11/18/kgateway-v2-1-is-released/)

---

## ☁️ Cloud Native

### 📄 The Rising Importance of Governance at SwampUP Berlin 2025

On November 12-14, the Docker team was out in numbers at JFrog SwampUP Berlin 2025. We joined technical sessions, put on a fireside chat, and had conversations with attendees there. We’d like to thank

**📅 Nov 21, 2025** • **📰 Docker Blog**

[**🔗 Read more**](https://www.docker.com/blog/the-rising-importance-of-governance-at-swampup-berlin-2025/)

### 📄 Accelerate container troubleshooting with the fully managed Amazon ECS MCP server (preview)

Amazon ECS today launched a fully managed, remote Model Context Protocol (MCP) server in preview, enabling AI agents to provide deep contextual knowledge of ECS workflows, APIs, and best practices for

**📅 Nov 21, 2025** • **📰 AWS Containers Blog**

[**🔗 Read more**](https://aws.amazon.com/blogs/containers/accelerate-container-troubleshooting-with-the-fully-managed-amazon-ecs-mcp-server-preview/)

### 📄 How Docker Hardened Images Patches Vulnerabilities in 24 hours

On November 19, 2025, the Golang project published two Common Vulnerabilities and Exposures (CVEs) affecting the widely-used golang.org/x/crypto/ssh package. While neither vulnerability received a cri

**📅 Nov 21, 2025** • **📰 Docker Blog**

[**🔗 Read more**](https://www.docker.com/blog/how-docker-hardened-images-patch-cves-in-24-hours/)

### 📄 Streamline container image signatures with Amazon ECR managed signing

Container image security is critical for modern applications with the increasing adoption of containerized workloads. Organizations need reliable ways to verify the authenticity and integrity of their

**📅 Nov 21, 2025** • **📰 AWS Containers Blog**

[**🔗 Read more**](https://aws.amazon.com/blogs/containers/streamline-container-image-signatures-with-amazon-ecr-managed-signing/)

### 📄 Beyond the Hype: How to Use AI to Actually Increase Your Productivity as a Dev

When I started incorporating AI tools into my workflow, I was first frustrated. I didn't get the 5x or 10x gains others raved about on social. In fact, it slowed me down. But I persisted. Partly becau

**📅 Nov 21, 2025** • **📰 Docker Blog**

[**🔗 Read more**](https://www.docker.com/blog/ai-developer-productivity-workflow/)

### 📄 Introducing IBM Apptio Product TCO: Turn Product Spend into Strategic Investments with Clear, End-to-End Visibility

Many organizations have transitioned from traditional service-based delivery models to a product-based approach. Driven by the rise of agile working, this transformation represents a fundamental shift

**📅 Nov 21, 2025** • **📰 Kubecost Blog**

[**🔗 Read more**](https://www.apptio.com/blog/introducing-ibm-apptio-product-tco-turn-product-spend-into-strategic-investments-with-clear-end-to-end-visibility/)

### 📄 Friday Five — November 21, 2025

Techaisle - Red Hat’s AI Platform Play: From "Any App" to "Any Model, Any Hardware, Any Cloud"Red Hat's AI 3 strategy aims to be the "Linux of enterprise AI," offering an open, standardized platform t

**📅 Nov 21, 2025** • **📰 Red Hat Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/friday-five-november-21-2025-red-hat)

### 📄 Docker Model Runner Integrates vLLM for High-Throughput Inference

Expanding Docker Model Runner’s Capabilities Today, we’re excited to announce that Docker Model Runner now integrates the vLLM inference engine and safetensors models, unlocking high-throughput AI inf

**📅 Nov 20, 2025** • **📰 Docker Blog**

[**🔗 Read more**](https://www.docker.com/blog/docker-model-runner-integrates-vllm/)

### 📄 Introducing Template Version Pinning for Functions

As of version 0.18.0 of the faas-cli, you can now pin templates to a specific version via the stack.yaml file for more reproducible builds and to avoid unexpected changes. Why pin a template? Pinning 

**📅 Nov 19, 2025** • **📰 OpenFaaS Blog**

[**🔗 Read more**](https://www.openfaas.com/blog/pinned-template-versions/)

### 📄 The MonkCast: WASM and Edge Compute

Our CEO Matt Butcher recently joined the Monkcast for an episode on Wasm, Edge Computing and beyond - diving deep into topics around serverless compute, network latency and OSS.

**📅 Nov 18, 2025** • **📰 Spin Blog**

[**🔗 Read more**](https://www.fermyon.com/blog/monkcast-interview-2025)

---

## 🔄 CI/CD

### 📄 Less clutter, more control: Manage flag permissions at scale

Preset Role Scope and Flag Lifecycle Settings can help you issue cleaner, faster releases.

**📅 Nov 24, 2025** • **📰 LaunchDarkly Blog**

[**🔗 Read more**](https://launchdarkly.com/blog/preset-role-scope-flag-lifecycle-settings/)

### 📄 Prompt Engineering Best Practices

Poorly written prompts can throw entire AI projects off track.

**📅 Nov 24, 2025** • **📰 LaunchDarkly Blog**

[**🔗 Read more**](https://launchdarkly.com/blog/prompt-engineering-best-practices/)

### 📄 Dig deeper into the data powering your charts

Explore the data behind your charts to validate results and make informed decisions

**📅 Nov 24, 2025** • **📰 LaunchDarkly Blog**

[**🔗 Read more**](https://launchdarkly.com/blog/dig-deeper-into-data/)

### 📄 Why AI Integration in DevOps is so Important

AI is transforming DevOps security with real-time threat detection, automated scanning and predictive analytics. Learn how AI strengthens CI/CD pipelines and protects modern software delivery.

**📅 Nov 21, 2025** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/why-ai-integration-in-devops-is-so-important/)

### 📄 Evolving GitHub Copilot’s next edit suggestions through custom model training

GitHub Copilot’s next edit suggestions just got faster, smarter, and more precise thanks to new data pipelines, reinforcement learning, and continuous model updates built for in-editor workflows. The 

**📅 Nov 20, 2025** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/ai-and-ml/github-copilot/evolving-github-copilots-next-edit-suggestions-through-custom-model-training/)

### 📄 GitLab 18.6: From configuration to control

Editor’s note: After this blog was originally published, the default Security Manager role was withdrawn from the release. It will be included in a future update. The content below has been updated fo

**📅 Nov 20, 2025** • **📰 GitLab Blog**

[**🔗 Read more**](https://about.gitlab.com/blog/gitlab-18-6-from-configuration-to-control/)

### 📄 Harness FME - Fast and Furious | Blog

Read about all the updates we have made to Harness FME | Blog

**📅 Nov 20, 2025** • **📰 Harness Blog**

[**🔗 Read more**](https://www.harness.io/blog/harness-fme-fast-and-furious)

### 📄 How we’re making GitHub Copilot smarter with fewer tools

We're using embedding-guided tool routing, adaptive clustering, and a streamlined 13-tool core to deliver faster experience in VS Code. The post How we’re making GitHub Copilot smarter with fewer tool

**📅 Nov 19, 2025** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/ai-and-ml/github-copilot/how-were-making-github-copilot-smarter-with-fewer-tools/)

### 📄 Amazon introduces two benchmark datasets for evaluating AI agents’ ability on code migration

Introduction: Repository-Level Code Migration Code migration is a repository-level transformation process that modernizes entire software projects to run on new platforms, frameworks, or runtime envir

**📅 Nov 19, 2025** • **📰 AWS DevOps Blog**

[**🔗 Read more**](https://aws.amazon.com/blogs/devops/amazon-introduces-two-benchmark-datasets-for-evaluating-ai-agents-ability-on-code-migration/)

### 📄 How to write a great agents.md: Lessons from over 2,500 repositories

Learn how to write effective agents.md files for GitHub Copilot with practical tips, real examples, and templates from analyzing 2,500+ repositories. The post How to write a great agents.md: Lessons f

**📅 Nov 19, 2025** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/ai-and-ml/github-copilot/how-to-write-a-great-agents-md-lessons-from-over-2500-repositories/)

### 📄 Making your business resilient against Cloudflare like outages | Blog

Cloudflare-like outages can cost your business a significant amount of money. This week’s Cloudflare global outage is a wake-up call for business resilience. You can stay resilient against such outage

**📅 Nov 19, 2025** • **📰 Harness Blog**

[**🔗 Read more**](https://www.harness.io/blog/making-your-business-resilient-against-cloudflare-like-outages)

### 📄 Harness in Seattle at PASS Data Community Summit 2025 | Blog

Discover AI-powered schema changes, Flyway support, and modern DB governance with Harness at PASS Summit 2025. | Blog

**📅 Nov 18, 2025** • **📰 Harness Blog**

[**🔗 Read more**](https://www.harness.io/blog/harness-in-seattle-at-pass-data-community-summit-2025)

---

## 🏗️ IaC

### 📄 Introducing AWS CloudFormation Stack Refactoring Console Experience: Reorganize Your Infrastructure Without Disruption

AWS CloudFormation models and provisions cloud infrastructure as code, letting you manage entire lifecycle operations through declarative templates. Stack Refactoring console experience, announced tod

**📅 Nov 22, 2025** • **📰 AWS DevOps Blog**

[**🔗 Read more**](https://aws.amazon.com/blogs/devops/introducing-aws-cloudformation-stack-refactoring-reorganize-your-infrastructure-without-disruption/)

### 📄 Amazon Athena for Apache Spark is now available in Amazon SageMaker notebooks

Amazon SageMaker now supports Amazon Athena for Apache Spark, bringing a new notebook experience and fast serverless Spark experience together within a unified workspace. Now, data engineers, analysts

**📅 Nov 21, 2025** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2025/11/amazon-athena-apache-spark-sagemaker-notebooks/)

### 📄 All Pulumi CLI flags are now supported as environment variables

With the release of Pulumi v3.208.0, all CLI flags can now be configured as environment variables. This addresses a common friction point of having to remember the same flags across multiple commands 

**📅 Nov 21, 2025** • **📰 Pulumi Blog**

[**🔗 Read more**](https://www.pulumi.com/blog/controlling-the-cli-through-environment-variables/)

### 📄 Enforce AWS Organizations Tag Policies with Pulumi

Tags are the foundation of cloud governance, enabling cost allocation, ownership tracking, compliance reporting, and automation across your AWS infrastructure. Yet missing or inconsistent tags remain 

**📅 Nov 20, 2025** • **📰 Pulumi Blog**

[**🔗 Read more**](https://www.pulumi.com/blog/aws-organizations-tag-policies/)

### 📄 Snyk and Continue Partner to Embed AI-Powered Security into Every Step of the Developer Workflow

Snyk is excited to announce a new partnership with Continue, which will embed AI-powered security into every step of the SDLC. This partnership allows developers to scan code, dependencies, and IaC us

**📅 Nov 18, 2025** • **📰 Snyk Blog**

[**🔗 Read more**](https://snyk.io/blog/snyk-continue-partner-integration/)

---

## 📊 Observability

### 📄 Understanding AI behavior: LLM observability in AI Configs

Get deeper visibility into model behavior and impact with LLM observability.

**📅 Nov 24, 2025** • **📰 LaunchDarkly Blog**

[**🔗 Read more**](https://launchdarkly.com/blog/llm-observability-in-ai-configs/)

### 📄 Observability for AI Workloads: A Primer

Observability and AI Artificial Intelligence (AI) s a set of techniques, methods, and strategies that lets computers perform complex tasks that require skills usually associated with human beings, suc

**📅 Nov 21, 2025** • **📰 SUSE Blog**

[**🔗 Read more**](https://www.suse.com/c/observability-for-ai-workloads/)

### 📄 Scaling AI the Right Way: Platform Patterns for Performance and Reliability

AI performance breaks long before the model runs. Learn how ingestion speed, elastic training, low-latency inference, observability and automation create reliable, scalable AI systems.

**📅 Nov 21, 2025** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/scaling-ai-the-right-way-platform-patterns-for-performance-and-reliability/)

### 📄 Change Tracking for Better Post-Incident Monitoring

Explore how Change Tracking can help troubleshoot outages or incidents caused by recent deployments, and provide valuable insights into those changes.

**📅 Nov 21, 2025** • **📰 New Relic Blog**

[**🔗 Read more**](https://newrelic.com/blog/best-practices/change-tracking-for-better-post-incident-monitoring)

### 📄 Unleashing the Power of Monitoring: Master Your WordPress with New Relic

Optimizing your WordPress site is essential. Learn how to use New Relic and OpenTelemetry for comprehensive monitoring, enhancing performance and user experience.

**📅 Nov 21, 2025** • **📰 New Relic Blog**

[**🔗 Read more**](https://newrelic.com/blog/best-practices/unleashing-the-power-of-monitoring-master-your-wordpress-with-new-relic)

### 📄 How to Keep a Secure Environment with New Relic: Your Observability Shield

Learn how to use New Relic to ensure the security of your applications and keep a threat free environment.

**📅 Nov 21, 2025** • **📰 New Relic Blog**

[**🔗 Read more**](https://newrelic.com/blog/nerdlog/how-to-keep-a-secure-environment)

### 📄 Is the OTCA Exam Right for You? Insights for Both Newcomers and Advanced Users

In the IT industry, certifications often generate debate – some regard them as essential career milestones, while others question their practical value. While OpenTelemetry is getting widely adopted, 

**📅 Nov 21, 2025** • **📰 OpenTelemetry Blog**

[**🔗 Read more**](https://opentelemetry.io/blog/2025/otca-for-newcomers-and-advanced-users/)

### 📄 Breaking siloes: How to use cross-store correlations with Grafana

Grafana is great at hopping between signals in its native backends (Grafana Loki, Grafana Mimir, Grafana Tempo). But your data doesn’t have to live there to get the same smooth workflow. Afterall, we 

**📅 Nov 21, 2025** • **📰 Grafana Blog**

[**🔗 Read more**](https://grafana.com/blog/2025/11/21/breaking-siloes-how-to-use-cross-store-correlations-with-grafana/)

### 📄 How to build workflows that catch bugs early and keep code moving

Observability isn’t just about collecting data. It’s about connecting the dots across your stack to answer why something is broken, not just what is broken. For developers, this means the ability to a

**📅 Nov 20, 2025** • **📰 Dynatrace Blog**

[**🔗 Read more**](https://www.dynatrace.com/news/blog/how-to-build-workflows-that-catch-bugs-early-and-keep-code-moving/)

### 📄 What the Cloudflare Outage Teaches Us About System Limits and Latent Bugs

Cloudflare outage analysis: Learn how predictive observability helps teams find bugs and prevent system failures using Input Hardening & Bulkhead patterns.

**📅 Nov 20, 2025** • **📰 New Relic Blog**

[**🔗 Read more**](https://newrelic.com/blog/how-to-relic/what-the-cloudflare-outage-teaches-us-about-system-limits-and-latent-bugs)

### 📄 ObservabilityCON on the Road: New cities, new sessions in 2026

Last month, observability enthusiasts from around the world gathered in London for ObservabilityCON 2025, our flagship observability event, where we shared major updates in actually useful AI, SaaS ec

**📅 Nov 20, 2025** • **📰 Grafana Blog**

[**🔗 Read more**](https://grafana.com/blog/2025/11/20/observabilitycon-on-the-road-new-cities-new-sessions-in-2026/)

### 📄 Integrating Red Hat Lightspeed in 2025: From observability to actionable automation

Red Hat Lightspeed (formerly Red Hat Insights) has long helped operations teams detect risks, open tickets, and share findings with the right tools, connecting proactive intelligence to everyday workf

**📅 Nov 20, 2025** • **📰 Red Hat Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/red-hat-lightspeed-2025-observability-actionable-automation)

---

## 🔐 Security

### 📄 Threats Making WAVs - Incident Response to a Cryptomining Attack

Guardicore security researchers describe and uncover a full analysis of a cryptomining attack, which hid a cryptominer inside WAV files. The report includes the full attack vectors, from detection, in

**📅 Nov 24, 2025** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/security/threats-making-wavs-incident-reponse-cryptomining-attack)

### 📄 Amazon EMR Serverless now supports Apache Spark 4.0.1 (preview)

Amazon EMR Serverless now supports Apache Spark 4.0.1 (preview). With Spark 4.0.1, you can build and maintain data pipelines more easily with ANSI SQL and VARIANT data types, strengthen compliance and

**📅 Nov 21, 2025** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2025/11/amazon-emr-serverless-apache-spark/)

### 📄 Why Threat Modeling Is Now Even More Critical for AI-Native Applications

AI-native applications demand a security approach as dynamic as they are. Traditional threat modeling is no longer enough. Discover the shift to continuous, adaptive threat modeling for AI security.

**📅 Nov 20, 2025** • **📰 Snyk Blog**

[**🔗 Read more**](https://snyk.io/blog/threat-modeling-critical-ai-native-applications/)

### 📄 Ingest and enrich SonarQube security and quality findings with Dynatrace

Dynatrace integrates with SonarQube to ingest vulnerability findings, quality metrics, and audit logs, helping DevSecOps teams reduce alert noise and focus remediation efforts on what truly matters in

**📅 Nov 19, 2025** • **📰 Dynatrace Blog**

[**🔗 Read more**](https://www.dynatrace.com/news/blog/ingest-and-enrich-sonarqube-security-and-quality-findings-with-dynatrace/)

### 📄 Beyond Automation: Securing Low-Code Agentic AI with MCP Guardrails

Explore how Model Context Protocol (MCP) servers and integrated security scanning workflows are redefining guardrails for low-code/no-code (LCNC) and AI-driven development environments.

**📅 Nov 19, 2025** • **📰 Snyk Blog**

[**🔗 Read more**](https://snyk.io/blog/securing-low-code-agentic-ai-mcp-guardrails/)

### 📄 Level up design-to-code collaboration with GitHub’s open source Annotation Toolkit

Prevent accessibility issues before they reach production. The Annotation Toolkit brings clarity, compliance, and collaboration directly into your Figma workflow. The post Level up design-to-code coll

**📅 Nov 18, 2025** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/enterprise-software/collaboration/level-up-design-to-code-collaboration-with-githubs-open-source-annotation-toolkit/)

### 📄 83% of organizations see value in adopting open source, but report major gaps in security and governance

A new Linux Foundation report reveals how organizations worldwide are adopting, using, and perceiving open source software. The Linux Foundation’s latest report, The state of global open source, has j

**📅 Nov 18, 2025** • **📰 Ubuntu Blog**

[**🔗 Read more**](https://ubuntu.com//blog/state-of-global-open-source-2025)

---

## 💾 Databases

### 📄 Autobase 2.5.0 released

Introducing Autobase 2.5 — Expert Mode brings advanced configuration right into the UI. With the release of Autobase version 2.0, we introduced the Console (UI) — a graphical interface that simplifies

**📅 Nov 24, 2025** • **📰 PostgreSQL News**

[**🔗 Read more**](https://www.postgresql.org/about/news/autobase-250-released-3176/)

### 📄 pg_ai_query — AI-powered SQL generation & query analysis for PostgreSQL

I am excited to announce the release of pg_ai_query — a PostgreSQL extension that brings AI-powered query development directly into Postgres. pg_ai_query allows you to: Generate SQL from natural langu

**📅 Nov 23, 2025** • **📰 PostgreSQL News**

[**🔗 Read more**](https://www.postgresql.org/about/news/pg_ai_query-ai-powered-sql-generation-query-analysis-for-postgresql-3175/)

### 📄 YugabyteDB Joins Google’s MCP Toolbox for AI Agent Development

YugabyteDB is officially supported in Google's MCP Toolbox for Databases, making it easier for you to build production AI agents with confidence. Discover how developers can access YugabyteDB's distri

**📅 Nov 19, 2025** • **📰 Yugabyte Blog**

[**🔗 Read more**](https://www.yugabyte.com/blog/yugabytedb-joins-googles-mcp-toolbox/)

### 📄 Managing ScyllaDB Background Operations with Task Manager

Learn about ScyllaDB Task Manager, which provides a unified way to observe and control ScyllaDB's background maintenance work

**📅 Nov 18, 2025** • **📰 ScyllaDB Blog**

[**🔗 Read more**](https://www.scylladb.com/2025/11/18/task-manager/)

---

## 🌐 Platforms

### 📄 Keep Your Tech Flame Alive: Trailblazer Rachel Bayley

In this Akamai FLAME Trailblazer blog post, Rachel Bayley encourages women to step into the unknown and to be their authentic selves.

**📅 Nov 24, 2025** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/culture/2024/may/keep-your-tech-flame-alive-trailblazer-rachel-bayley)

### 📄 The Oracle of Delphi Will Steal Your Credentials

Our deception technology is able to reroute attackers into honeypots, where they believe that they found their real target. The attacks brute forced passwords for RDP credentials to connect to the vic

**📅 Nov 24, 2025** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/security/the-oracle-of-delphi-steal-your-credentials)

### 📄 The Nansh0u Campaign – Hackers Arsenal Grows Stronger

In the beginning of April, three attacks detected in the Guardicore Global Sensor Network (GGSN) caught our attention. All three had source IP addresses originating in South-Africa and hosted by Volum

**📅 Nov 24, 2025** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/security/the-nansh0u-campaign-hackers-arsenal-grows-stronger)

### 📄 SRE Weekly Issue #498

View on sreweekly.com A message from our sponsor, Costory: You didn’t sign up to do FinOps. Costory automatically explains why your cloud costs change, and reports it straight to Slack. Built for SREs

**📅 Nov 24, 2025** • **📰 SRE Weekly**

[**🔗 Read more**](https://sreweekly.com/sre-weekly-issue-498/)

### 📄 Introducing the TalayLink subsea cable and new connectivity hubs

Today we’re announcing TalayLink, a new subsea cable connecting Australia and Thailand to significantly increase the reach, reliability, and resilience of digital connectivity across Asia Pacific and 

**📅 Nov 23, 2025** • **📰 Google Cloud Blog**

[**🔗 Read more**](https://cloud.google.com/blog/products/infrastructure/talaylink-subsea-cable-to-connect-australia-and-thailand/)

### 📄 Take fine-grained control of your AWS CloudFormation StackSets Deployment with StackSet Dependencies

Introduction AWS CloudFormation StackSets enable you to deploy CloudFormation stacks across multiple AWS accounts and regions with a single operation, providing centralized management of infrastructur

**📅 Nov 21, 2025** • **📰 AWS DevOps Blog**

[**🔗 Read more**](https://aws.amazon.com/blogs/devops/take-fine-grained-control-of-your-aws-cloudformation-stacksets-deployment-with-stackset-dependencies/)

### 📄 AWS Payments Cryptography announces support for post-quantum cryptography to secure data in transit

Today, AWS Payments Cryptography announces support for hybrid post-quantum (PQ) TLS to secure API calls. With this launch, customers can future-proof transmissions of sensitive data and commands using

**📅 Nov 21, 2025** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2025/11/aws-payments-cryptography-post-quantum-data-transit)

### 📄 Announcing a Fully Managed Appium Endpoint for AWS Device Farm

AWS Device Farm enables mobile and web developers to test their apps using real mobile devices and desktop browsers. Starting today, you can connect to a fully managed Appium endpoint using only a few

**📅 Nov 21, 2025** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2025/11/aws-device-farm-managed-appium-endpoint/)

### 📄 Four agentic workflows you can build for life sciences for R&D

AI agents, powered by generative AI, are rapidly transforming industries by acting as intelligent, collaborative partners that can interpret goals, plan multi-step actions, and work independently acro

**📅 Nov 21, 2025** • **📰 Google Cloud Blog**

[**🔗 Read more**](https://cloud.google.com/blog/topics/healthcare-life-sciences/agentic-ai-framework-in-life-sciences-for-rd/)

### 📄 BigQuery AI: The convergence of data and AI is here

From uncovering new insights in multimodal data to personalizing customer experiences, AI is emerging as the engine of modern innovation. The explosion in AI adoption has created a need to bring data 

**📅 Nov 21, 2025** • **📰 Google Cloud Blog**

[**🔗 Read more**](https://cloud.google.com/blog/products/data-analytics/gathering-advanced-data-agent-and-ml-tools-under-bigquery-ai/)

### 📄 Powered by DigitalOcean Hatch: How Ex-human uses GPU Droplets to Build Empathetic AI that Serves Customers

GPU Droplets are now DigitalOcean GradientAI GPU Droplets. Learn more about DigitalOcean GradientAI, our suite of AI products. Hatch is DigitalOcean’s global program for startups, which provides start

**📅 Nov 21, 2025** • **📰 DigitalOcean Blog**

[**🔗 Read more**](https://www.digitalocean.com/blog/ex-human-digitalocean-ai-hatch-program)

### 📄 Hacktoberfest 2025 Comes to a Close

October rolled around again, and with it came Hacktoberfest for its 12th year where contributors and open-source communities across the globe came together to build, contribute, and make tech more acc

**📅 Nov 21, 2025** • **📰 DigitalOcean Blog**

[**🔗 Read more**](https://www.digitalocean.com/blog/hacktoberfest-2025-wrapup)

---

## 📰 Misc

### 📄 Five Great DevOps Job Opportunities

This Thanksgiving week, we share a fresh DevOps jobs report: Top roles and opportunities for professionals looking to level up their careers.

**📅 Nov 24, 2025** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/five-great-devops-job-opportunities-165/)

### 📄 Enterprise Edge Computing: Making Business Possible Anywhere

The edge is where it all happens. Think about the computing required for retailers to create personalized in-store experiences based on smart inventory systems. Or how real-time asset tracking turns s

**📅 Nov 24, 2025** • **📰 SUSE Blog**

[**🔗 Read more**](https://www.suse.com/c/enterprise-edge-computing-making-business-possible-anywhere/)

### 📄 Goodbye Dashboards: Agents Deliver Answers, Not Just Reports

When you wake up in the morning, do you say, “Let me go open my ERP?” Of course not. You The post Goodbye Dashboards: Agents Deliver Answers, Not Just Reports appeared first on The New Stack.

**📅 Nov 23, 2025** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/goodbye-dashboards-agents-deliver-answers-not-just-reports/)

### 📄 Tuxedo OS: Ubuntu Base, KDE Plasma, Awesome Performance

Tuxedo Computers is on a mission to make Linux accessible to the general public. Its primary means of pulling this The post Tuxedo OS: Ubuntu Base, KDE Plasma, Awesome Performance appeared first on Th

**📅 Nov 23, 2025** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/tuxedo-os-ubuntu-base-kde-plasma-awesome-performance/)

### 📄 Is AI Creating a New Code Review Bottleneck for Senior Engineers?

Irish software engineer Addy Osmani is not opposed to vibe coding. And yet this Google Gemini developer (who is also The post Is AI Creating a New Code Review Bottleneck for Senior Engineers? appeared

**📅 Nov 23, 2025** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/is-ai-creating-a-new-code-review-bottleneck-for-senior-engineers/)

### 📄 From Chaotic Vibes to Real Velocity With AI-First Engineering

In 2025, vibe coding became more than a meme; it became a full-blown movement. Suddenly, non-developers were spinning up apps The post From Chaotic Vibes to Real Velocity With AI-First Engineering app

**📅 Nov 22, 2025** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/from-chaotic-vibes-to-real-velocity-with-ai-first-engineering/)

### 📄 Bindplane Adds AI Ability to Automate Configuring OpenTelemetry Pipelines

Bindplane is adding AI-powered Pipeline Intelligence to automate log parsing and optimize OpenTelemetry pipelines as telemetry volumes surge across modern DevOps environments.

**📅 Nov 21, 2025** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/bindplane-adds-ai-ability-to-automate-configuring-opentelemetry-pipelines/)

### 📄 Open design: the opportunity design students didn’t know they were missing

What if you could work on real-world projects, shape cutting-edge technology, collaborate with developers across the world, make a meaningful impact with your design skills, and grow your portfolio… a

**📅 Nov 21, 2025** • **📰 Ubuntu Blog**

[**🔗 Read more**](https://ubuntu.com//blog/open-design-the-opportunity-design-students-didnt-know-they-were-missing)

### 📄 Shaping the future of open source talent in APAC with Red Hat Academy

The Asia-Pacific (APAC) region is witnessing an unprecedented surge in demand for skilled professionals in open source technologies, a field largely new to many students. Red Hat Academy is at the hea

**📅 Nov 21, 2025** • **📰 Red Hat Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/shaping-future-open-source-talent-apac-red-hat-academy)

### 📄 Choosing an Inference Engine: Why Choice Matters

What is an Inference Engine? An inference engine is the runtime that loads a trained model, transforms or fuses parts of its compute graph, and executes it efficiently on specific hardware. Large Lang

**📅 Nov 20, 2025** • **📰 SUSE Blog**

[**🔗 Read more**](https://www.suse.com/c/choosing-an-inference-engine-why-choice-matters/)

### 📄 Spring Boot 4: Leaner, Safer Apps and a New Kotlin Baseline

Spring Boot 4.0 has officially landed. At JetBrains, we’ve been tracking the updates since the first milestones to ensure that IntelliJ IDEA delivers a smooth and reliable development experience. Whil

**📅 Nov 20, 2025** • **📰 JetBrains Blog**

[**🔗 Read more**](https://blog.jetbrains.com/idea/2025/11/spring-boot-4/)

### 📄 IntelliJ IDEA 2025.2.5 Is Out!

We’ve just released IntelliJ IDEA 2025.2.5. You can update to this version from inside the IDE, using the Toolbox App, or using snaps if you are a Ubuntu user. You can also download it from our websit

**📅 Nov 20, 2025** • **📰 JetBrains Blog**

[**🔗 Read more**](https://blog.jetbrains.com/idea/2025/11/intellij-idea-2025-2-5/)
