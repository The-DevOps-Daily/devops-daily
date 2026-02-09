---
title: "DevOps Weekly Digest - Week 7, 2026"
date: "2026-02-09"
summary: "⚡ Curated updates from Kubernetes, cloud native tooling, CI/CD, IaC, observability, and security - handpicked for DevOps professionals!"
---

> 📌 **Handpicked by DevOps Daily** - Your weekly dose of curated DevOps news and updates!

---

## ⚓ Kubernetes

### 📄 From “Connection Refused” to “Active”: My Journey Running RKE2 on SLES 15 ARM with an M-Series Mac

If you’ve ever tried to build a high-fidelity Kubernetes home lab on an Apple Silicon M1/M2/M3/M4 Mac, you know that the “ARM struggle” is very real. This week, I embarked on a mission to set up RKE2 

**📅 Feb 7, 2026** • **📰 SUSE Blog**

[**🔗 Read more**](https://www.suse.com/c/from-connection-refused-to-active-my-journey-running-rke2-on-sles-15-arm-with-an-m-series-mac/)

### 📄 Beyond metrics: Extracting actionable insights from Amazon EKS with Amazon Q Business

In this post, we demonstrate a solution that uses Amazon Data Firehose to aggregate logs from the Amazon EKS control plane and data plane, and send them to Amazon Simple Storage Service (Amazon S3). F

**📅 Feb 3, 2026** • **📰 AWS Containers Blog**

[**🔗 Read more**](https://aws.amazon.com/blogs/containers/beyond-metrics-extracting-actionable-insights-from-amazon-eks-with-amazon-q-business/)

### 📄 Build deep learning model training apps using CNCF Fluid with Amazon EKS

In this blog post, you will learn how to implement the elastic high-throughput file system using Amazon Elastic Kubernetes Service (Amazon EKS) and CNCF Fluid, set up efficient data caching mechanisms

**📅 Feb 3, 2026** • **📰 AWS Containers Blog**

[**🔗 Read more**](https://aws.amazon.com/blogs/containers/build-deep-learning-model-training-apps-using-cncf-fluid-with-amazon-eks/)

### 📄 Introducing Node Readiness Controller

In the standard Kubernetes model, a node’s suitability for workloads hinges on a single binary "Ready" condition. However, in modern Kubernetes environments, nodes require complex infrastructure depen

**📅 Feb 3, 2026** • **📰 Kubernetes Blog**

[**🔗 Read more**](https://kubernetes.io/blog/2026/02/03/introducing-node-readiness-controller/)

### 📄 Achieve more with Red Hat OpenShift 4.21

Red Hat OpenShift 4.21, based on Kubernetes 1.34 and CRI-O 1.34, is now generally available. Together with Red Hat OpenShift Platform Plus, this release demonstrates our continued commitment to delive

**📅 Feb 3, 2026** • **📰 OpenShift Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/achieve-more-red-hat-openshift-421)

---

## ☁️ Cloud Native

### 📄 Docker versus Nix: The quest for true reproducibility

When conducting performance benchmarks, the ultimate goal is an apples-to-apples comparison. Docker, widely recognized as one of the most brilliant The post Docker versus Nix: The quest for true repro

**📅 Feb 7, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/docker-versus-nix-the-quest-for-true-reproducibility/)

### 📄 Amazon ECS Managed Instances now available in AWS European Sovereign Cloud

Amazon Elastic Container Service (Amazon ECS) Managed Instances is now available in the AWS European Sovereign Cloud. ECS Managed Instances is a fully managed compute option designed to eliminate infr

**📅 Feb 6, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/02/ecs-mi-european-sovereign-cloud)

### 📄 Dragonfly v2.4.0 is released

Dragonfly v2.4.0 is released! Thanks to all of the contributors who made this Dragonfly release happen. New features and enhancements load-aware scheduling algorithm A two-stage scheduling algorithm c

**📅 Feb 6, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/02/05/dragonfly-v2-4-0-is-released/)

### 📄 Reduce Vulnerability Noise with VEX: Wiz + Docker Hardened Images

Open source components power most modern applications. A new generation of hardened container images can establish a more secure foundation, but even with hardened images, vulnerability scanners often

**📅 Feb 5, 2026** • **📰 Docker Blog**

[**🔗 Read more**](https://www.docker.com/blog/reduce-vulnerability-noise-with-vex-wiz-docker-hardened-images/)

### 📄 Extending Qodana: Adding Custom Code Inspections

Qodana is a static code analysis tool that brings code inspections and quick-fixes from JetBrains IDEs to the realm of continuous integration. It can be run in the cloud, executed from a Docker contai

**📅 Feb 5, 2026** • **📰 JetBrains Blog**

[**🔗 Read more**](https://blog.jetbrains.com/platform/2026/02/extending-qodana-adding-custom-code-inspections/)

### 📄 Conversing with Large Language Models using Dapr

Imagine you are running a bunch of microservices, each living within its own boundary. What are some of the challenges that come into mind when operating them? This is where Distributed Application Ru

**📅 Feb 4, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/02/04/conversing-with-large-language-models-using-dapr/)

### 📄 Get Started with the Atlassian Rovo MCP Server Using Docker

We’re excited to announce that the remote Atlassian Rovo MCP server is now available in Docker’s MCP Catalog and Toolkit, making it easier than ever to connect AI assistants to Jira and Confluence. Wi

**📅 Feb 4, 2026** • **📰 Docker Blog**

[**🔗 Read more**](https://www.docker.com/blog/atlassian-remote-mcp-server-getting-started-with-docker/)

### 📄 CNCF celebrates successful mentees from LFX Mentorship 2025 Term 3

The Cloud Native Computing Foundation is thrilled to congratulate the 2025 Term 3 (September – November) CNCF LFX Mentorship Program mentees who have successfully completed the program! This term saw 

**📅 Feb 4, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/02/04/cncf-celebrates-successful-mentees-from-lfx-mentorship-2025-term-3/)

### 📄 Introducing the Metaflow-Kubeflow Integration

A tale of two flows: Metaflow and Kubeflow Metaflow is a Python framework for building and operating ML and AI projects, originally developed and open-sourced by Netflix in 2019. In many ways, Kubeflo

**📅 Feb 4, 2026** • **📰 Kubeflow Blog**

[**🔗 Read more**](https://blog.kubeflow.org/metaflow/)

### 📄 Teaching AI Agents to Speak “Production” SQL: Introducing TiDB Skills

AI coding agents are excellent at producing code that “works on my machine”. But as every database engineer knows, there is a massive gap between a query that runs in a local Docker container and one 

**📅 Feb 3, 2026** • **📰 TiDB Blog**

[**🔗 Read more**](https://www.pingcap.com/blog/introducing-tidb-skills/)

### 📄 The Best of KubeCon + CloudNativeCon: Watch the video!

We’re excited to launch a new video celebrating the energy, people, and community that make KubeCon + CloudNativeCon what it is. One of the most powerful things about KubeCon + CloudNativeCon is the s

**📅 Feb 3, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/02/03/the-best-of-kubecon-cloudnativecon-watch-the-video/)

### 📄 Pigsty v4.0 Released: Ready for the Agent Era

Pigsty v4.0, a batteries-included PostgreSQL distribution, is now available with a major infrastructure overhaul, PostgreSQL 18 readiness, and a return to the permissive Apache 2.0 license. This relea

**📅 Feb 3, 2026** • **📰 PostgreSQL News**

[**🔗 Read more**](https://www.postgresql.org/about/news/pigsty-v40-released-ready-for-the-agent-era-3228/)

---

## 🔄 CI/CD

### 📄 Metric Data Sources: import multiple tables for warehouse-native experimentation

Bring your own warehouse tables and schemas to power experimentation

**📅 Feb 9, 2026** • **📰 LaunchDarkly Blog**

[**🔗 Read more**](https://launchdarkly.com/blog/metric-data-sources-warehouse-native-experimentation/)

### 📄 Meet the new navigation in LaunchDarkly

A cleaner, more focused navigation reduces noise and helps you move faster.

**📅 Feb 9, 2026** • **📰 LaunchDarkly Blog**

[**🔗 Read more**](https://launchdarkly.com/blog/new-launchdarkly-navigation/)

### 📄 Introducing LLM Playground for AI Configs

Test, compare, and trace LLM prompt and model variations before they reach production.

**📅 Feb 9, 2026** • **📰 LaunchDarkly Blog**

[**🔗 Read more**](https://launchdarkly.com/blog/llm-playground-for-ai-configs/)

### 📄 NoSQL Change Control for Compliance

Learn how CI/CD-driven NoSQL change control improves compliance, governance, and deployment reliability without slowing modern DevOps teams. | Blog

**📅 Feb 9, 2026** • **📰 Harness Blog**

[**🔗 Read more**](https://www.harness.io/blog/nosql-change-control-for-compliance)

### 📄 Continuous AI in practice: What developers can automate today with agentic CI

Think of Continuous AI as background agents that operate in your repository for tasks that require reasoning. The post Continuous AI in practice: What developers can automate today with agentic CI app

**📅 Feb 5, 2026** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/ai-and-ml/generative-ai/continuous-ai-in-practice-what-developers-can-automate-today-with-agentic-ci/)

### 📄 Backstage Alternatives: Build, Buy, or Harness?

Compare Backstage alternatives, from open source builds to commercial IDPs like Harness, and learn how to choose the right developer portal for your team. | Blog

**📅 Feb 5, 2026** • **📰 Harness Blog**

[**🔗 Read more**](https://www.harness.io/blog/backstage-alternatives-idp-options-for-engineering-leaders)

### 📄 Architecting Trust: The Blueprint for a "Golden Standard" So

Move beyond bespoke CI/CD scripts. Learn how to architect a "Golden Standard" pipeline that enforces governance, accelerates security testing, and guarantees artifact integrity using a Zero Trust appr

**📅 Feb 5, 2026** • **📰 Harness Blog**

[**🔗 Read more**](https://www.harness.io/blog/architecting-trust-the-blueprint-for-a-golden-standard-software-supply-chain)

### 📄 Pick your agent: Use Claude and Codex on Agent HQ

Claude by Anthropic and OpenAI Codex are now available in public preview on GitHub and VS Code with a Copilot Pro+ or Copilot Enterprise subscription. Here's what you need to know and how to get start

**📅 Feb 4, 2026** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/news-insights/company-news/pick-your-agent-use-claude-and-codex-on-agent-hq/)

### 📄 What the fastest-growing tools reveal about how software is being built

What languages are growing fastest, and why? What about the projects that people are interested in the most? Where are new developers cutting their teeth? Let’s take a look at Octoverse data to find o

**📅 Feb 3, 2026** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/news-insights/octoverse/what-the-fastest-growing-tools-reveal-about-how-software-is-being-built/)

### 📄 How to maximize GitHub Copilot’s agentic capabilities

A senior engineer's guide to architecting and extending Copilot's real-world applications. The post How to maximize GitHub Copilot’s agentic capabilities appeared first on The GitHub Blog.

**📅 Feb 2, 2026** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/ai-and-ml/github-copilot/how-to-maximize-github-copilots-agentic-capabilities/)

---

## 🏗️ IaC

### 📄 Amazon WorkSpaces Secure Browser now supports custom domain

Amazon WorkSpaces Secure Browser now supports custom domains for your WorkSpaces Secure Browser portals, enabling you to configure portal access through your own domain name instead of the default por

**📅 Feb 6, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/02/amazon-workspaces-secure-browser-custom-domains/)

### 📄 Amazon Bedrock AgentCore Browser now supports browser profiles

Amazon Bedrock AgentCore Browser now supports browser profiles, enabling you to reuse authentication state across multiple browser sessions without repeated login flows. This feature reduces session s

**📅 Feb 6, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/02/amazon-bedrock-agentcore-browser-profiles)

### 📄 Closing the Year Strong: Harness Q4 2025 Continuous Delivery

Q4 2025 CD update: safer deployments, improved artifacts, stronger IaC integrations, and scalable GitOps enhancements. | Blog

**📅 Feb 6, 2026** • **📰 Harness Blog**

[**🔗 Read more**](https://www.harness.io/blog/closing-the-year-strong-harness-q4-2025-continuous-delivery-gitops-update)

### 📄 Pulumi Neo Now Supports AGENTS.md

Neo now reads AGENTS.md files, the open standard for giving AI coding tools context about your project. If you’re already using AGENTS.md, Neo will pick up those same instructions automatically. The p

**📅 Feb 6, 2026** • **📰 Pulumi Blog**

[**🔗 Read more**](https://www.pulumi.com/blog/pulumi-neo-now-supports-agentsmd/)

### 📄 Announcing OpenAPI support for the Pulumi Cloud REST API

We’re thrilled to announce that the Pulumi Cloud REST API is now described by an OpenAPI 3.0 specification, and we’re just getting started. This is a feature that has been a long time coming. We have 

**📅 Feb 5, 2026** • **📰 Pulumi Blog**

[**🔗 Read more**](https://www.pulumi.com/blog/announcing-openapi-support-pulumi-cloud/)

### 📄 Neo: Share Tasks for Collaborative AI Infrastructure Operations

Neo shows its work, but until now that context was only viewable by the user that initiated the conversation. When you wanted a teammate’s input on a decision Neo made, you had to describe it in Slack

**📅 Feb 4, 2026** • **📰 Pulumi Blog**

[**🔗 Read more**](https://www.pulumi.com/blog/neo-task-sharing/)

---

## 📊 Observability

### 📄 Welcoming New Community Managers to OpenTelemetry

Back in October 2022, I wrote about becoming OpenTelemetry’s first community manager. At the time, the project had just over 5000 contributors. Since then, those numbers have grown considerably – almo

**📅 Feb 6, 2026** • **📰 OpenTelemetry Blog**

[**🔗 Read more**](https://opentelemetry.io/blog/2026/new-community-managers/)

### 📄 SQL Server 2025 is generally available on Ubuntu 24.04 LTS

Microsoft has announced the General Availability of SQL Server 2025 on Ubuntu 24.04 LTS. Learn about the new CU1 features, including OS-level observability, Contained Availability Groups, and native v

**📅 Feb 6, 2026** • **📰 Ubuntu Blog**

[**🔗 Read more**](https://ubuntu.com//blog/sql-server-2025-ubuntu-24-04-lts)

### 📄 KubeCon + CloudNativeCon Europe 2026

The OpenTelemetry project maintainers, members of the governance committee, and technical committee are thrilled to be at KubeCon EU in Amsterdam from March 23 - 26, 2026. Register today to join us! R

**📅 Feb 5, 2026** • **📰 OpenTelemetry Blog**

[**🔗 Read more**](https://opentelemetry.io/blog/2026/kubecon-eu/)

### 📄 Optimize Databricks: Full Visibility with New Relic

Supercharge your Databricks estate with our open-source integration. Get deep, in-context telemetry to optimize performance and master your data.

**📅 Feb 3, 2026** • **📰 New Relic Blog**

[**🔗 Read more**](https://newrelic.com/blog/infrastructure-monitoring/optimize-databricks-full-visibility-with-new-relic)

### 📄 Unified Observability: Seeing the Whole Picture

Break down data silos and end the blame game. Learn how a unified platform correlates network, infrastructure, and app data to solve issues in minutes.

**📅 Feb 3, 2026** • **📰 New Relic Blog**

[**🔗 Read more**](https://newrelic.com/blog/infrastructure-monitoring/network-observability-for-engineers-03)

### 📄 Distributed Monitoring with Zabbix and Entelgy

Entelgy is an international consulting and technology firm specializing in cybersecurity, digital transformation, and advanced IT operations. By leveraging tools like Zabbix, Entelgy helps organizatio

**📅 Feb 3, 2026** • **📰 Zabbix Blog**

[**🔗 Read more**](https://blog.zabbix.com/distributed-monitoring-with-zabbix-and-entelgy/32566/)

---

## 🔐 Security

### 📄 Threats Making WAVs - Incident Response to a Cryptomining Attack

Guardicore security researchers describe and uncover a full analysis of a cryptomining attack, which hid a cryptominer inside WAV files. The report includes the full attack vectors, from detection, in

**📅 Feb 9, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/security/threats-making-wavs-incident-reponse-cryptomining-attack)

### 📄 Veracode Extends Package Firewall Reach to Microsoft Artifacts

Veracode has extended the reach of a Package Firewall that applies policies that limit what types of code can be downloaded from a repository to Azure Artifacts from Microsoft. Additionally, DevSecOps

**📅 Feb 6, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/veracode-extends-package-firewall-reach-to-microsoft-artifacts/)

### 📄 Starfish Space uses Google Cloud to accelerate satellite servicing in orbit

The Defense Industrial Base (DIB) and Federal System Integrator (FSI) communities operate under intense pressure. The mandate is clear: do more, faster, and with greater efficiency. As the engine of o

**📅 Feb 6, 2026** • **📰 Google Cloud Blog**

[**🔗 Read more**](https://cloud.google.com/blog/topics/public-sector/starfish-space-uses-google-cloud-to-accelerate-satellite-servicing-in-orbit/)

### 📄 280+ Leaky Skills: How OpenClaw & ClawHub Are Exposing API Keys and PII

Discover how 7.1% of AI agent skills are designed to leak secrets, PII, and API keys through LLM context. Learn to defend with Evo & mcp-scan.

**📅 Feb 5, 2026** • **📰 Snyk Blog**

[**🔗 Read more**](https://snyk.io/blog/openclaw-skills-credential-leaks-research/)

### 📄 Snyk Finds Prompt Injection in 36%, 1467 Malicious Payloads in a ToxicSkills Study of Agent Skills Supply Chain Compromise

Snyk’s ToxicSkills research reveals 36% of AI agent skills contain security flaws, including 1,467 vulnerable skills and active malicious payloads targeting OpenClaw, Claude Code, and Cursor users.

**📅 Feb 5, 2026** • **📰 Snyk Blog**

[**🔗 Read more**](https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/)

### 📄 The 3Cs: A Framework for AI Agent Security

Every time execution models change, security frameworks need to change with them. Agents force the next shift. The Unattended Laptop Problem No developer would leave their laptop unattended and unlock

**📅 Feb 4, 2026** • **📰 Docker Blog**

[**🔗 Read more**](https://www.docker.com/blog/the-3cs-a-framework-for-ai-agent-security/)

### 📄 Introducing the AI Security Fabric: Empowering Software Builders in the Era of AI

Snyk introduces the AI Security Fabric and a prescriptive path to help organizations secure software at the speed of AI. Discover how to operationalize AI security and scale innovation without comprom

**📅 Feb 3, 2026** • **📰 Snyk Blog**

[**🔗 Read more**](https://snyk.io/blog/ai-security-fabric/)

### 📄 The Prescriptive Path to Operationalizing AI Security

Learn how to move from vision to practice with the Prescriptive Path, a framework for operationalizing AI security at scale. By replacing fragmented tools with a unified platform, you can build trust 

**📅 Feb 3, 2026** • **📰 Snyk Blog**

[**🔗 Read more**](https://snyk.io/blog/prescriptive-path/)

### 📄 Multi-agent systems: Why coordinated AI beats going solo

Your single AI agent starts a customer support conversation tracking their billing issue. Fifteen turns later, it's forgotten the original problem and is now suggesting solutions for a completely diff

**📅 Feb 3, 2026** • **📰 Redis Blog**

[**🔗 Read more**](https://redis.io/blog/multi-agent-systems-coordinated-ai/)

### 📄 Security Features Your Security Team Will Love

A roundup of Railway's new security features to send to your security team. (or a friend)

**📅 Feb 3, 2026** • **📰 Railway Blog**

[**🔗 Read more**](https://blog.railway.com/p/2fa-audit-logs-compliance)

---

## 💾 Databases

### 📄 RAG vs large context window: The real trade-offs for AI apps

You've probably heard the pitch: with context windows hitting 10 million tokens, who needs RAG anymore? Just stuff everything into the prompt and let the model figure it out. If only it were that simp

**📅 Feb 6, 2026** • **📰 Redis Blog**

[**🔗 Read more**](https://redis.io/blog/rag-vs-large-context-window-ai-apps/)

### 📄 How does infrastructure affect fintech app performance?

You've built a fintech app with impressive features: instant payment processing, AI-powered fraud detection with real-time pattern recognition, millisecond-level risk scoring, and AI-driven personaliz

**📅 Feb 6, 2026** • **📰 Redis Blog**

[**🔗 Read more**](https://redis.io/blog/fintech-app-features-infrastructure-scale/)

### 📄 Scaling Is the “Funnest” Game: Rachel Stephens and Adam Jacob

When not to worry about scale, when to rearchitect everything and why passionate criticism is a win “There’s no funner game than the at-scale technology game. But if you play it, some people will hate

**📅 Feb 4, 2026** • **📰 ScyllaDB Blog**

[**🔗 Read more**](https://www.scylladb.com/2026/02/04/rachel-stephens-adam-jacob/)

### 📄 How Shopify Is Re-Architecting for an Agentic Commerce Future with YugabyteDB

What happens when a relational database design built for e-commerce is pushed to planetary scale? For Shopify, the answer involved years of custom sharding, massive replication overhead, and growing a

**📅 Feb 4, 2026** • **📰 Yugabyte Blog**

[**🔗 Read more**](https://www.yugabyte.com/blog/how-shopify-is-re-architecting-for-an-agentic-commerce-future-with-yugabytedb/)

### 📄 AI meets SQL Server 2025 on Ubuntu

Partnership between Microsoft and Canonical Since 2016, when Microsoft announced its intention to make Linux a first class citizen in its ecosystem, Canonical and Microsoft have been working hand in h

**📅 Feb 4, 2026** • **📰 Ubuntu Blog**

[**🔗 Read more**](https://ubuntu.com//blog/sql-server-2025-on-ubuntu)

### 📄 In Person Community-Led PostgreSQL Training March 5th, at SCaLE 23x in Pasadena, California

PostgreSQL community members Elizabeth Christensen, Devrim Gunduz, and Ryan Booz are proud to announce that they will be leading a full day in person training on March 5th, 2026, as part of the Postgr

**📅 Feb 3, 2026** • **📰 PostgreSQL News**

[**🔗 Read more**](https://www.postgresql.org/about/news/in-person-community-led-postgresql-training-march-5th-at-scale-23x-in-pasadena-california-3218/)

### 📄 Building sales automation infrastructure that doesn't slow down at scale

You've built sales automation to move faster. The workflow looks good on paper. The lead comes in, the system routes it, the CRM updates, and the rep gets notified. But at scale, small delays compound

**📅 Feb 3, 2026** • **📰 Redis Blog**

[**🔗 Read more**](https://redis.io/blog/automate-sales-infrastructure-speed-revenue/)

---

## 🌐 Platforms

### 📄 Creating better runtime control with LaunchDarkly and AWS

Ship bold AI changes without the guesswork.

**📅 Feb 9, 2026** • **📰 LaunchDarkly Blog**

[**🔗 Read more**](https://launchdarkly.com/blog/runtime-control-launchdarkly-aws/)

### 📄 Keep Your Tech Flame Alive: Trailblazer Rachel Bayley

In this Akamai FLAME Trailblazer blog post, Rachel Bayley encourages women to step into the unknown and to be their authentic selves.

**📅 Feb 9, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/culture/2024/may/keep-your-tech-flame-alive-trailblazer-rachel-bayley)

### 📄 The Oracle of Delphi Will Steal Your Credentials

Our deception technology is able to reroute attackers into honeypots, where they believe that they found their real target. The attacks brute forced passwords for RDP credentials to connect to the vic

**📅 Feb 9, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/security/the-oracle-of-delphi-steal-your-credentials)

### 📄 The Nansh0u Campaign – Hackers Arsenal Grows Stronger

In the beginning of April, three attacks detected in the Guardicore Global Sensor Network (GGSN) caught our attention. All three had source IP addresses originating in South-Africa and hosted by Volum

**📅 Feb 9, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/security/the-nansh0u-campaign-hackers-arsenal-grows-stronger)

### 📄 Building a scalable code modernization solution with AWS Transform custom

Introduction Software maintenance and modernization is a critical challenge for enterprises managing hundreds or thousands of repositories. Whether upgrading Java versions, migrating to new AWS SDKs, 

**📅 Feb 6, 2026** • **📰 AWS DevOps Blog**

[**🔗 Read more**](https://aws.amazon.com/blogs/devops/building-a-scalable-code-modernization-solution-with-aws-transform-custom/)

### 📄 Now Available: Anthropic Claude Opus 4.6 on DigitalOcean’s Agentic Inference Cloud

Claude Opus 4.6 is now available on the DigitalOcean Gradient™ AI Platform via Serverless Inference—giving teams access to Anthropic’s most capable model on a platform built to run inference reliably 

**📅 Feb 6, 2026** • **📰 DigitalOcean Blog**

[**🔗 Read more**](https://www.digitalocean.com/blog/claude-opus-4-6-gradient-ai-platform)

### 📄 How we cut Vertex AI latency by 35% with GKE Inference Gateway

As generative AI moves from experimentation to production, platform engineers face a universal challenge for inference serving: you need low latency, high throughput, and manageable costs. It is a dif

**📅 Feb 6, 2026** • **📰 Google Cloud Blog**

[**🔗 Read more**](https://cloud.google.com/blog/products/containers-kubernetes/how-gke-inference-gateway-improved-latency-for-vertex-ai/)

### 📄 Delivering a secure, open, and sovereign digital world

The global conversation about our digital future goes beyond technology; it’s about architecting a prosperous, secure, and resilient economy where the digital services we rely on every day — from bank

**📅 Feb 6, 2026** • **📰 Google Cloud Blog**

[**🔗 Read more**](https://cloud.google.com/blog/products/identity-security/delivering-a-secure-open-sovereign-digital-world/)

### 📄 How AI Is Expanding Who Gets to Build Infrastructure

Pavlo Baron, co-founder and CEO of Platform Engineering Labs, unpacks what’s changing in platform engineering as AI reshapes who gets to build, and how infrastructure actually gets managed. Baron trac

**📅 Feb 6, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/how-ai-is-expanding-who-gets-to-build-infrastructure/)

### 📄 AWS Config now supports 30 new resource types

AWS Config now supports 30 additional AWS resource types across key services including Amazon EKS, Amazon Q, and AWS IoT. This expansion provides greater coverage over your AWS environment, enabling y

**📅 Feb 6, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/02/aws-config-new-resource-types)

### 📄 LLM Inference Benchmarking - Measure What Matters

Production-grade LLM inference is a complex systems challenge, requiring deep co-designs - from hardware primitives (FLOPs, memory bandwidth, and interconnects) to sophisticated software layers - acro

**📅 Feb 6, 2026** • **📰 DigitalOcean Blog**

[**🔗 Read more**](https://www.digitalocean.com/blog/llm-inference-benchmarking)

### 📄 Empowering the Linux Admin: Rapid Rollbacks now Default in SLES 16 on AWS

Introduction SUSE Linux Enterprise Server has been a staple on Amazon EC2 for over 15 years. With the launch of SLES 16 this past November, we’ve introduced a change that, on the surface, might seem l

**📅 Feb 6, 2026** • **📰 SUSE Blog**

[**🔗 Read more**](https://www.suse.com/c/empowering-the-linux-admin-rapid-rollbacks-now-default-in-sles-16-on-aws/)

---

## 📰 Misc

### 📄 February 2026 Insiders (version 1.110)

Learn what is new in the Visual Studio Code February 2026 Release (1.110). Read the full article

**📅 Mar 4, 2026** • **📰 VS Code Blog**

[**🔗 Read more**](https://code.visualstudio.com/updates/v1_110)

### 📄 Google Launches Developer Knowledge API to Give AI Tools Access to Official Documentation

Google's new Developer Knowledge API and MCP server provide AI assistants with direct access to up-to-date Google developer documentation.

**📅 Feb 9, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/google-launches-developer-knowledge-api-to-give-ai-tools-access-to-official-documentation/)

### 📄 Five Great DevOps Job Opportunities

This week's report features top employers including Capital One, Google, CLS US Services, Thrive Market, and Cisco Systems, providing insights into the job market and salaries for crucial roles in Dev

**📅 Feb 9, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/five-great-devops-job-opportunities-175/)

### 📄 IDEcline: How the world’s most powerful coding tools became second-class citizens overnight

During the early phase of my career, I used to spend eight hours a day inside the Visual Studio IDE. The post IDEcline: How the world’s most powerful coding tools became second-class citizens overnigh

**📅 Feb 8, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/ide-vs-desktop-agent/)

### 📄 How WebAssembly and Web Workers prevent UI freezes

We’ve all experienced a frozen web page followed by endless refreshing, frustrated sighs, and the occasional foot stomp, only to The post How WebAssembly and Web Workers prevent UI freezes appeared fi

**📅 Feb 7, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/for-darryl-webassembly-and-web-workers/)

### 📄 How GSD turns Claude into a self-steering developer

The speed at which ClawdBot MoltBot OpenClaw climbed in popularity was quite phenomenal, and for good reason: It has an The post How GSD turns Claude into a self-steering developer appeared first on T

**📅 Feb 7, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/openclaw-gsd/)

### 📄 Why We’re Putting Partners at the Heart of SUSECON 26

In B2B technology, “resilience” is often discussed in terms of code, clusters, and clouds. But after over 20 years in this industry, I’ve learned that the truest form of resilience isn’t just found in

**📅 Feb 6, 2026** • **📰 SUSE Blog**

[**🔗 Read more**](https://www.suse.com/c/new-partner-experience-susecon-2026-prague/)

### 📄 Hiring the Canonical way: trust, humanity, and remote-first thinking

Discover the human-centric hiring philosophy at Canonical. Learn how the makers of Ubuntu prioritize remote-first talent, human-led CV reviews, and finding the right role for your unique impact. Explo

**📅 Feb 6, 2026** • **📰 Ubuntu Blog**

[**🔗 Read more**](https://ubuntu.com//blog/hiring-the-canonical-way)

### 📄 More than meets the eye: Behind the scenes of Red Hat Enterprise Linux 10 (Part 5)

This series takes a look at the people and planning that went into building and releasing Red Hat Enterprise Linux 10. From the earliest conceptual stages to the launch at Red Hat Summit 2025, we’ll h

**📅 Feb 6, 2026** • **📰 Red Hat Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/more-meets-eye-behind-scenes-red-hat-enterprise-linux-10-part-5)

### 📄 Friday Five — February 6, 2026

Don't forget to register for Red Hat SummitRegistration is now open for Red Hat Summit 2026 in Atlanta! Register by February 23 for the lowest rates, or save further with group discounts for three or 

**📅 Feb 6, 2026** • **📰 Red Hat Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/friday-five-february-6-2026-red-hat)

### 📄 Accelerating VM migration to Red Hat OpenShift Virtualization: Hitachi storage offload delivers faster data movement

If you're modernizing your virtualization infrastructure, you've probably discovered that migrating thousands of virtual machines (VMs) takes far longer than anyone anticipated.For IT leaders who have

**📅 Feb 6, 2026** • **📰 Red Hat Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/accelerating-vm-migration-red-hat-openshift-virtualization-hitachi-storage-offload-delivers-faster-data-movement)

### 📄 SUSE response to EU consultation on Open Digital Ecosystems

The European Commission recently concluded its “Towards European Open Digital Ecosystems” consultation. With over 1,000 respondents, the high participation confirms a critical industry demand to break

**📅 Feb 5, 2026** • **📰 SUSE Blog**

[**🔗 Read more**](https://www.suse.com/c/suse-response-to-eu-consultation-on-open-digital-ecosystems/)
