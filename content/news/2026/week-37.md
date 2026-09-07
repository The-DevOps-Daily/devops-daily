---
title: "DevOps Weekly Digest - Week 37, 2026"
date: "2026-09-07"
summary: "⚡ Curated updates from Kubernetes, cloud native tooling, CI/CD, IaC, observability, and security - handpicked for DevOps professionals!"
---

> 📌 **Handpicked by DevOps Daily** - Your weekly dose of curated DevOps news and updates!

---

## ⚓ Kubernetes

### 📄 Kubernetes v1.37: KubeletInUserNamespace (aka Rootless mode) Graduates to Beta

Kubernetes v1.37 promotes the KubeletInUserNamespace feature gate to beta. With this feature enabled, all of the node components (kubelet, CRI and OCI runtimes, CNI plugins, and kube-proxy) can run as

**📅 Sep 4, 2026** • **📰 Kubernetes Blog**

[**🔗 Read more**](https://kubernetes.io/blog/2026/09/04/kubernetes-v1-37-rootless-beta/)

### 📄 Kubernetes isn’t new, but AI makes It scary again

Kubernetes isn’t brand new anymore. Yet, for many teams, adopting it still feels intimidating. Even if you’ve watched Kubernetes become the default foundation for production software and AI workloads,

**📅 Sep 4, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/09/04/kubernetes-isnt-new-but-ai-makes-it-scary-again/)

### 📄 Kubernetes v1.37: DRA Updates

Kubernetes 1.37 is here and Dynamic Resource Allocation (DRA) keeps pushing past where it started! This release brings DRA Extended Resource support to GA, a milestone the team has been building towar

**📅 Sep 3, 2026** • **📰 Kubernetes Blog**

[**🔗 Read more**](https://kubernetes.io/blog/2026/09/03/kubernetes-v1-37-dra-updates/)

### 📄 Agent Substrate, with Tim Hockin and Brandon Royal

Tim Hockin is a long term software engineer with Google Cloud and I would argue one of the fathers of Kubernetes. Brandon Royal is a product manager on GKE and has been behind the launch of multiple O

**📅 Sep 3, 2026** • **📰 Kubernetes Podcast**

[**🔗 Read more**](https://e780d51f-f115-44a6-8252-aed9216bb521.libsyn.com/agent-sandbox-with-tim-hockin-and-brandon-royal)

### 📄 The architecture of autonomy: How ING built a future-proof tech strategy

I recently sat down with Marco Eijsackers, ING’s Global Head of Tech Strategy, at their headquarters in Amsterdam. Serving over 40 million customers worldwide with an enterprise tech team of thousands

**📅 Sep 3, 2026** • **📰 OpenShift Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/architecture-autonomy-how-ing-built-future-proof-tech-strategy)

### 📄 Kubernetes v1.37: Scale Workloads to Zero with HorizontalPodAutoscaler

Kubernetes v1.37 includes API support for horizontal autoscaling of workloads down to zero replicas. This feature is now Beta and enabled by default. A HorizontalPodAutoscaler (HPA) that uses a suitab

**📅 Sep 2, 2026** • **📰 Kubernetes Blog**

[**🔗 Read more**](https://kubernetes.io/blog/2026/09/02/kubernetes-v1-37-hpa-scale-to-zero-beta/)

### 📄 Kubernetes v1.37: etcd RangeStream Cuts Memory Use on Large List Reads

I am excited to announce that etcd RangeStream is graduating to beta in Kubernetes v1.37. Paired with etcd v3.7, it reduces the memory the API server and etcd need to read a large collection, and make

**📅 Sep 1, 2026** • **📰 Kubernetes Blog**

[**🔗 Read more**](https://kubernetes.io/blog/2026/09/01/kubernetes-v1-37-etcd-range-stream/)

### 📄 Fast model loading for AI inference on Amazon EKS

When you scale AI inference on Amazon EKS, every new pod must load model weights into GPU memory before serving traffic. We investigated where cold-start time goes and found two configuration-only cha

**📅 Sep 1, 2026** • **📰 AWS Containers Blog**

[**🔗 Read more**](https://aws.amazon.com/blogs/containers/fast-model-loading-for-ai-inference-on-amazon-eks/)

---

## ☁️ Cloud Native

### 📄 Safeguard your SUSE Virtualization workloads with Storware

Key takeaways: Enterprise IT environments rarely run purely containerized applications. SUSE Virtualization unifies VM and container management on a single platform. Storware Backup and Recovery deliv

**📅 Sep 5, 2026** • **📰 SUSE Blog**

[**🔗 Read more**](https://www.suse.com/c/safeguard-your-suse-virtualization-workloads-with-storware/)

### 📄 Help us write what you need: Take the SUSE Documentation Survey 2026

Key takeaways Docs-first focus: This survey collects feedback exclusively on technical documentation, content architecture and usability, not engineering feature requests or upstream kernel bugs. Full

**📅 Sep 5, 2026** • **📰 SUSE Blog**

[**🔗 Read more**](https://www.suse.com/c/help-us-write-what-you-need-take-the-suse-documentation-survey-2026/)

### 📄 YOLO Mode: Agent Autonomy Without the Guardrails

YOLO mode lets an AI agent run without asking permission. Learn what it is, why it's risky, and how to run it safely.

**📅 Sep 3, 2026** • **📰 Docker Blog**

[**🔗 Read more**](https://www.docker.com/blog/what-is-yolo-mode/)

### 📄 Join OSPOlogy + OSPO Summit China 2026 in Shanghai

There’s still time to join OSPOlogy + OSPO Summit China 2026, taking place on September 7, 2026, in Shanghai, China as part of KubeCon + CloudNativeCon + OpenInfra Summit + PyTorch Conference China. T

**📅 Sep 3, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/09/03/join-ospology-ospo-summit-china-2026-in-shanghai/)

### 📄 Building Reproducible AI Evaluation Workflows with Docker Sandboxes

Learn how Docker Sandboxes can make AI evaluation workflows more reproducible with consistent execution, structured artifacts, and runtime evidence.

**📅 Sep 2, 2026** • **📰 Docker Blog**

[**🔗 Read more**](https://www.docker.com/blog/building-reproducible-ai-evaluation-workflows-with-docker-sandboxes/)

### 📄 Below the Harness: Governing a Multi-Model, Multi-Harness World

We believe the future is a multi-model, multi-harness world. And we think it needs a new trust model. In 1988, Norm Hardy described a problem that had been quietly breaking systems for years: the conf

**📅 Sep 2, 2026** • **📰 Docker Blog**

[**🔗 Read more**](https://www.docker.com/blog/below-the-harness-governing-a-multi-model-multi-harness-world/)

---

## 🔄 CI/CD

### 📄 Project HydraFusion: Frontier quality via multi-model orchestration

In controlled offline evaluations, HydraFusion’s selective coding workflows matched or exceeded the evaluated Opus 5 baseline while reducing estimated workflow cost. Now available as a research previe

**📅 Sep 4, 2026** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/ai-and-ml/github-copilot/project-hydrafusion-frontier-quality-via-multi-model-orchestration/)

### 📄 Stories from the Factory Floor: Building a self-driving ops triage loop

How the Foundation team at LaunchDarkly automated ops triage with three Cursor agents that take an alert all the way to an open PR.

**📅 Sep 3, 2026** • **📰 LaunchDarkly Blog**

[**🔗 Read more**](https://launchdarkly.com/blog/building-a-self-driving-ops-triage-loop/)

### 📄 Introducing the LaunchDarkly AI SDK

The LaunchDarkly AI SDK is available for Python and JavaScript and is the path we recommend for every new AgentControl integration.

**📅 Sep 3, 2026** • **📰 LaunchDarkly Blog**

[**🔗 Read more**](https://launchdarkly.com/blog/introducing-the-launchdarkly-ai-sdk/)

### 📄 GitHub Copilot app for Beginners: Run several agents at once

Learn how to run parallel agents in the GitHub Copilot app, and experience the moment it stops feeling scary and starts feeling powerful. The post GitHub Copilot app for Beginners: Run several agents 

**📅 Sep 3, 2026** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/ai-and-ml/github-copilot/github-copilot-app-for-beginners-run-several-agents-at-once/)

### 📄 Decoding the new AI lingo: Loops, harnesses, squads, hill climbing… oh my!

From loop engineering to harnesses, squads, and open weights, the GitHub Podcast breaks down the AI terms showing up in developer conversations. The post Decoding the new AI lingo: Loops, harnesses, s

**📅 Sep 2, 2026** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/ai-and-ml/decoding-the-new-ai-lingo-loops-harnesses-squads-hill-climbing-oh-my/)

### 📄 Discover Everything Harness Shipped in August 2026

Harness shipped 58 features in August 2026: an agent-scale code repository, AI Code Review, AI Risks scanning, and the Blast Radius Agent. | Blog

**📅 Sep 2, 2026** • **📰 Harness Blog**

[**🔗 Read more**](https://www.harness.io/blog/shipped-in-august-2026)

### 📄 How we make AI coding more cost efficient without sacrificing task quality

Why shorter outputs can cost more, and how GitHub Copilot reduces wasted work across the complete coding task. The post How we make AI coding more cost efficient without sacrificing task quality appea

**📅 Sep 2, 2026** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/ai-and-ml/github-copilot/how-we-make-ai-coding-more-cost-efficient-without-sacrificing-task-quality/)

### 📄 GitLab’s internal playbook to foster AI-fluent technical teams

Give two engineering teams the same AI tool and you can end up with two very different outcomes. One team ships faster with fewer bugs, while the other gets burned by an agent that confidently generat

**📅 Sep 2, 2026** • **📰 GitLab Blog**

[**🔗 Read more**](https://about.gitlab.com/blog/how-gitlab-fosters-ai-fluent-teams/)

### 📄 Critical remote code execution in vm2, a widely used Node.js sandbox library

GitLab's Threat Research Group found a critical sandbox escape vulnerability in vm2, one of the most widely adopted Node.js sandboxing libraries. The vulnerability uses a configuration copied straight

**📅 Sep 2, 2026** • **📰 GitLab Blog**

[**🔗 Read more**](https://about.gitlab.com/blog/critical-remote-code-execution-in-vm2/)

### 📄 Catch AI Regressions Before They Ship with AI Evals in CI/CD

Harness AI Evals tests AI agent quality in CI/CD, using golden datasets and quality gates to catch behavioral regressions before production. | Blog

**📅 Sep 2, 2026** • **📰 Harness Blog**

[**🔗 Read more**](https://www.harness.io/blog/catch-ai-regressions-before-they-ship-with-ai-evals-in-ci-cd)

### 📄 Building Trust in AI DevOps: Validating the Harness Knowledge Graph

Discover our multi-layered validation approach combining AI evals to ensure reliable AI-powered software delivery insights. | Blog

**📅 Aug 31, 2026** • **📰 Harness Blog**

[**🔗 Read more**](https://www.harness.io/blog/building-trust-in-our-knowledge-graph)

---

## 🏗️ IaC

### 📄 Amazon EC2 now supports specifying compatible instance types on AMIs

Amazon EC2 now enables AMI owners to define which instance types are compatible with their AMIs. Owners can specify supported instance types, unsupported instance types, or both — and any launch attem

**📅 Sep 4, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/09/ec2-images-supported-instances)

---

## 📊 Observability

### 📄 Inside the LLM Call: GenAI Observability with OpenTelemetry

Your AI agent just took 45 seconds to answer a simple question. Was it the model? A slow tool call? A retry loop? Every time an application calls an LLM, a chain of model calls, tool invocations, and 

**📅 Sep 7, 2026** • **📰 OpenTelemetry Blog**

[**🔗 Read more**](https://opentelemetry.io/blog/2026/genai-observability/)

### 📄 Observability’s Gaslighting Problem: “Send Less Data” Isn’t a Strategy

A familiar pattern is emerging in observability conversations. As telemetry volumes grow and costs rise, the default recommendation is often to collect less data: Sample more, retain less, index selec

**📅 Sep 4, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/observabilitys-gaslighting-problem-send-less-data-isnt-a-strategy/)

### 📄 Observability 2.0: Why DevOps Teams Are Moving From Monitoring to Intelligent System Understanding

For a long time, monitoring just meant staring at dashboards and waiting for something to flash red. Engineers tracked things like CPU usage, memory, response times, error rates, and uptime. If a numb

**📅 Sep 3, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/observability-2-0-why-devops-teams-are-moving-from-monitoring-to-intelligent-system-understanding/)

### 📄 Proactive Monitoring Tools: Stop Reacting to Incidents After They Happen

Reactive monitoring catches problems after users are already affected. Explore the top proactive monitoring tools, how they work, and what separates tools that detect anomalies from tools that prevent

**📅 Sep 3, 2026** • **📰 New Relic Blog**

[**🔗 Read more**](https://newrelic.com/blog/observability/proactive-monitoring-tools)

### 📄 Multi-Cloud Management Tools: A Practical Guide for Engineering Teams

Managing infrastructure across AWS, Azure, and GCP? Explore the top multi-cloud management tools, what to look for, and how observability keeps costs, performance, and reliability under control.

**📅 Sep 3, 2026** • **📰 New Relic Blog**

[**🔗 Read more**](https://newrelic.com/blog/observability/multi-cloud-management-tools)

### 📄 Enterprise APM: How to Choose Application Performance Monitoring at Scale

Enterprise APM goes beyond basic uptime checks. Explore what enterprise-grade application performance monitoring requires, how it differs from SMB tools, and what to look for when managing distributed

**📅 Sep 3, 2026** • **📰 New Relic Blog**

[**🔗 Read more**](https://newrelic.com/blog/observability/enterprise-apm)

### 📄 APM Dashboard: What It Shows, How to Use It, and What to Look For

An APM dashboard is where performance data becomes actionable. Learn what a good APM dashboard should include, how to read the key metrics, and how unified dashboards accelerate incident resolution.

**📅 Sep 3, 2026** • **📰 New Relic Blog**

[**🔗 Read more**](https://newrelic.com/blog/observability/apm-dashboard)

### 📄 Application Metrics caught my broken size estimator

The numbers your app lives on don't belong in logs or on sampled spans. Here's how a browser video converter's KPIs made the case for Application Metrics.

**📅 Sep 1, 2026** • **📰 Sentry Blog**

[**🔗 Read more**](https://blog.sentry.io/metrics-caught-ai-size-estimate/)

### 📄 OpenTelemetry Go Logs API and SDK reach release candidate status

OpenTelemetry Go v1.47.0-rc.1 is here. This release promotes the Logs API and SDK to release candidate (RC), the final stage before we provide stable v1 compatibility guarantees. We believe the design

**📅 Aug 31, 2026** • **📰 OpenTelemetry Blog**

[**🔗 Read more**](https://opentelemetry.io/blog/2026/go-logs-api-sdk-rc/)

---

## 🔐 Security

### 📄 Threats Making WAVs - Incident Response to a Cryptomining Attack

Guardicore security researchers describe and uncover a full analysis of a cryptomining attack, which hid a cryptominer inside WAV files. The report includes the full attack vectors, from detection, in

**📅 Sep 7, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/security/threats-making-wavs-incident-reponse-cryptomining-attack)

### 📄 Handling vulnerability reports: Recipe card

Recipe Handling Vulnerability Reports Target audience (the chef) This recipe is aimed at small and medium non-security focused projects. Maintainers of a high-risk security sensitive project, you prob

**📅 Sep 7, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/09/07/handling-vulnerability-reports-recipe-card/)

### 📄 Introducing the external secrets management console plug-in

Red Hat recently released the initial version of the external secrets management console plug-in. It’s an extension of the Red Hat OpenShift web console, which lets you inspect any of the resources de

**📅 Sep 7, 2026** • **📰 Red Hat Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/introducing-external-secrets-management-console-plugin)

### 📄 PGConf India 2027 - Dates Announced and CFP Open

Hey there, Mark your calendars: PGConf India 2027 is set for March 2–5, 2027 at the Sheraton Grand Hotel at Brigade Gateway, Bengaluru. The Call for Papers is open right now. Important dates CFP close

**📅 Sep 5, 2026** • **📰 PostgreSQL News**

[**🔗 Read more**](https://www.postgresql.org/about/news/pgconf-india-2027-dates-announced-and-cfp-open-3370/)

### 📄 Escaping the Black Box: How Private Enterprise AI Addresses Compliance, Control and Costs

Almost everyone in enterprise AI agrees that nobody wants a black box. Depending on the person, that concern may center on a public model, a hosted service or someone else’s cloud. In each case, the u

**📅 Sep 4, 2026** • **📰 SUSE Blog**

[**🔗 Read more**](https://www.suse.com/c/escaping-the-black-box-how-private-enterprise-ai-addresses-compliance-control-and-costs/)

### 📄 Friday Five — September 4, 2026

CRN - AI Has Changed Open Source Security, Says Red Hat CEO Matt HicksRed Hat CEO Matt Hicks discusses how AI has transformed open source security, emphasizing the need for better patching and transpa

**📅 Sep 4, 2026** • **📰 Red Hat Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/friday-five-september-4-2026-red-hat)

### 📄 Introducing context-aware vulnerability discovery and remediation with Cloudflare Managed Defense and OpenAI Daybreak models

Use production traffic and security signals to prioritize findings, prepare edge mitigations when safe, and propose code patches. By combining WAF data with OpenAI Daybreak models, Vulnerability Disco

**📅 Sep 3, 2026** • **📰 Cloudflare Blog**

[**🔗 Read more**](https://blog.cloudflare.com/vulnerability-discovery-remediation/)

### 📄 Automate proxy injection for Amazon EKS on AWS Fargate using Kyverno

Learn how to use a Kyverno mutating admission policy to automatically inject corporate proxy environment variables into Amazon EKS on AWS Fargate pods at admission time, delivering consistent egress c

**📅 Sep 1, 2026** • **📰 AWS Containers Blog**

[**🔗 Read more**](https://aws.amazon.com/blogs/containers/automate-proxy-injection-for-amazon-eks-on-aws-fargate-using-kyverno/)

---

## 💾 Databases

### 📄 PLEASE_READ_ME: The Opportunistic Ransomware Devastating MySQL Servers

Guardicore Labs uncovers a Ransomware detection campaign targeting MySQL servers. Attackers use Double Extortion and publish data to pressure victims.

**📅 Sep 7, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/security/please-read-me-opportunistic-ransomware-devastating-mysql-servers)

### 📄 Investigate DMS migration issues with AWS DevOps Agent

Migrating a production database is a high-risk operational event. AWS DMS is a cloud service that migrates relational databases, data warehouses, and other data stores into the AWS Cloud or between en

**📅 Sep 4, 2026** • **📰 AWS DevOps Blog**

[**🔗 Read more**](https://aws.amazon.com/blogs/devops/investigate-dms-migration-issues-with-aws-devops-agent/)

### 📄 Spanner migrations: Automating dual-write with Antigravity CLI for minimal disruption

When Google's Finance Engineering team needed to modernize their legacy data layer, they chose Spanner, a globally distributed, strongly consistent, multi-model database with high availability capabil

**📅 Sep 4, 2026** • **📰 Google Cloud Blog**

[**🔗 Read more**](https://cloud.google.com/blog/topics/developers-practitioners/using-antigravity-cli-to-streamline-dual-write-database-migration/)

### 📄 Serverless MySQL for AI Agents: Store Memory, Tool Outputs, and Searchable State in One Backend

MySQL AI, in the sense that matters most to application teams, means MySQL-compatible infrastructure that holds agent memory, tool outputs, embeddings, and persistent application state in one backend,

**📅 Sep 3, 2026** • **📰 TiDB Blog**

[**🔗 Read more**](https://www.pingcap.com/blog/mysql-ai/)

### 📄 Introducing YugabyteDB Resource Governance

Discover how YugabyteDB Resource Governance helps organizations safely consolidate more databases on shared infrastructure without sacrificing predictable performance. Plus, learn how fair CPU sharing

**📅 Sep 2, 2026** • **📰 Yugabyte Blog**

[**🔗 Read more**](https://www.yugabyte.com/introducing-yugabytedb-resource-governance/)

### 📄 What is a Serverless Database and Why It Matters for Modern AI Apps

A serverless database is a cloud database that decouples compute from storage, scales capacity automatically as demand changes, and bills for what a workload actually consumes. Servers still exist. Th

**📅 Sep 1, 2026** • **📰 TiDB Blog**

[**🔗 Read more**](https://www.pingcap.com/blog/serverless-database-2/)

### 📄 Surviving the uncharted: when dedicated OpenStack expertise is your best ally in disaster recovery

A customer’s OpenStack control plane went down overnight after their only backup proved stale. Canonical support rebuilt the database cluster live, service by service, without losing a single workload

**📅 Sep 1, 2026** • **📰 Ubuntu Blog**

[**🔗 Read more**](https://ubuntu.com//blog/support-restores-openstack)

---

## 🌐 Platforms

### 📄 The Oracle of Delphi Will Steal Your Credentials

Our deception technology is able to reroute attackers into honeypots, where they believe that they found their real target. The attacks brute forced passwords for RDP credentials to connect to the vic

**📅 Sep 7, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/security/the-oracle-of-delphi-steal-your-credentials)

### 📄 The Nansh0u Campaign – Hackers Arsenal Grows Stronger

In the beginning of April, three attacks detected in the Guardicore Global Sensor Network (GGSN) caught our attention. All three had source IP addresses originating in South-Africa and hosted by Volum

**📅 Sep 7, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/security/the-nansh0u-campaign-hackers-arsenal-grows-stronger)

### 📄 Amazon Bedrock Managed Knowledge Base introduces user-managed setup for SharePoint, OneDrive, and Confluence data sources

AWS announces user-managed setup (3LO) for SharePoint, OneDrive, and Confluence data sources in Amazon Bedrock Managed Knowledge Base. Previously, configuring these data sources required generating 2L

**📅 Sep 4, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/09/amazon-bedrock-managed-knowledge-base-user-managed-setup-sharepoint-onedrive-confluence/)

### 📄 Amazon Bedrock Managed Knowledge Base now supports ServiceNow as a native data source connector

AWS announces the ServiceNow data source connector for Amazon Bedrock Managed Knowledge Base, a fully managed retrieval-augmented generation (RAG) service. Customers can now connect their ServiceNow i

**📅 Sep 4, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/09/amazon-bedrock-managed-knowledge-base-servicenow-native-data-source-connector/)

### 📄 Amazon Bedrock Managed Knowledge Base now supports automatic sync scheduling for data source connectors

AWS announces automatic sync scheduling for Amazon Bedrock Managed Knowledge Base, a fully managed retrieval-augmented generation (RAG) service that handles data ingestion, storage optimization, and a

**📅 Sep 4, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/09/amazon-bedrock-managed-knowledge-base-automatic-sync-scheduling-data-source-connectors/)

### 📄 How Yahoo optimizes resources with flexible VMs in Managed Service for Apache Spark

As a global media and technology company connecting hundreds of millions of users to finance, sports, and entertainment platforms, Yahoo operates a massive data infrastructure where analytics workload

**📅 Sep 4, 2026** • **📰 Google Cloud Blog**

[**🔗 Read more**](https://cloud.google.com/blog/products/data-analytics/how-yahoo-optimizes-apache-spark-with-flexible-vms/)

### 📄 Not All LLM Workloads Are Equal: Benchmarking TPU Performance on Classification vs. Generation

Moving Large Language Models (LLMs) from experimental prototypes into enterprise production exposes a critical truth: your infrastructure dictates both your performance ceilings and your unit economic

**📅 Sep 4, 2026** • **📰 Google Cloud Blog**

[**🔗 Read more**](https://cloud.google.com/blog/topics/developers-practitioners/not-all-llm-workloads-are-equal-benchmarking-tpu-performance-on-classification-vs-generation/)

### 📄 CPU + GPU: Why AI platform engineering is a heterogeneous infrastructure problem

AI infrastructure conversations often start with GPUs. Accelerators provide much of the compute behind model training and inference, so the focus is understandable. But a production AI workload rarely

**📅 Sep 4, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/09/04/cpu-gpu-why-ai-platform-engineering-is-a-heterogeneous-infrastructure-problem/)

### 📄 What’s new with Google Cloud

Want to know the latest from Google Cloud? Find it here in one handy location. Check back regularly for our newest updates, announcements, resources, events, learning opportunities, and more. Tip: Not

**📅 Sep 4, 2026** • **📰 Google Cloud Blog**

[**🔗 Read more**](https://cloud.google.com/blog/topics/inside-google-cloud/whats-new-google-cloud/)

### 📄 Modernizing virtualization in higher education: How automated node recovery protects data integrity

Organizations across higher education and enterprise sectors face rising virtualization costs, shifting licensing structures, and architectural decisions that can no longer be deferred. In this landsc

**📅 Sep 4, 2026** • **📰 OpenShift Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/modernizing-virtualization-higher-education-how-automated-node-recovery-protects-data-integrity)

### 📄 Automating the Experimentation Lifecycle with Kiro, AWS DevOps Agent, and LaunchDarkly

Introduction Continuous improvement depends on experimentation. Teams know that the fastest path to better outcomes is to test changes against real user behavior, measure results, and iterate. In prac

**📅 Sep 3, 2026** • **📰 AWS DevOps Blog**

[**🔗 Read more**](https://aws.amazon.com/blogs/devops/automating-the-experimentation-lifecycle-with-kiro-aws-devops-agent-and-launchdarkly/)

### 📄 Your Agent Speaks MCP. Give It a Computer.

Sprites are disposable cloud computers. They appear instantly, always include durable filesystems, and cost practically nothing when idle. They’re the best and safest place on the Internet to run agen

**📅 Sep 3, 2026** • **📰 Fly.io Blog**

[**🔗 Read more**](https://fly.io/blog/sprites-mcp/)

---

## 📰 Misc

### 📄 Visual Studio Code 1.137 (Insiders)

Learn what is new in Visual Studio Code Insiders. Read the full article

**📅 Sep 9, 2026** • **📰 VS Code Blog**

[**🔗 Read more**](https://code.visualstudio.com/updates/v1_137)

### 📄 “Twenty years of brand building simply froze in time”: How coding agents select their tools of choice

The impact of AI has led to a shift in interest from Search Engine Optimisation (SEO) to Answer Engine Optimisation The post “Twenty years of brand building simply froze in time”: How coding agents se

**📅 Sep 7, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/coding-agents-tool-choice/)

### 📄 Kotlin 2.4.20 Released

The Kotlin 2.4.20 release is out! Here are the main highlights: For the complete list of changes, see What’s new in Kotlin 2.4.20 or the release notes on GitHub. How to install Kotlin 2.4.20 The lates

**📅 Sep 7, 2026** • **📰 JetBrains Blog**

[**🔗 Read more**](https://blog.jetbrains.com/kotlin/2026/09/kotlin-2-4-20-released/)

### 📄 Java Annotated Monthly – September 2026

This month’s Java Annotated Monthly brings you the latest Java news, a generous dose of AI-focused articles, Kotlin updates, and highlights from a variety of technologies and frameworks, plus plenty m

**📅 Sep 7, 2026** • **📰 JetBrains Blog**

[**🔗 Read more**](https://blog.jetbrains.com/idea/2026/09/java-annotated-monthly-september-2026/)

### 📄 The Rider 2026.3 Early Access Program Is Open

The first Early Access build for Rider 2026.3 is now available! It includes rainbow brackets, an easier way to set data breakpoints, a new Game Development plugin category, and filters in code complet

**📅 Sep 7, 2026** • **📰 JetBrains Blog**

[**🔗 Read more**](https://blog.jetbrains.com/dotnet/2026/09/07/rider-2026-3-eap/)

### 📄 Why faster coding isn't making delivery any faster

Generative AI promised to eliminate one of the biggest sources of friction in software engineering: Writing code. In many ways, it has delivered. Today, an AI coding agent can implement features in mi

**📅 Sep 7, 2026** • **📰 Red Hat Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/why-faster-coding-isnt-making-delivery-any-faster)

### 📄 Permissions belong in the assembly context

Someone moves off the finance team at 9 a.m. on a Monday. Your sync runs nightly at 2 a.m. For The post Permissions belong in the assembly context appeared first on The New Stack.

**📅 Sep 6, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/enterprise-rag-permission-assembly/)

### 📄 Polars 2.0 pre-release comes with a 5x speed boost — but it could change row order

Working with large datasets can lead to slow queries and out-of-memory errors. Polars, an open-source library that developers and data The post Polars 2.0 pre-release comes with a 5x speed boost — but

**📅 Sep 6, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/polars-streaming-row-order/)

### 📄 Claude Fable 5.1 vs. Fable 5: On real work, I couldn’t tell them apart.

Anthropic launched Claude Fable 5.1 this week, calling it “our most advanced model for coding and knowledge work.” There was The post Claude Fable 5.1 vs. Fable 5: On real work, I couldn’t tell them a

**📅 Sep 5, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/claude-fable-upgrade-tested/)

### 📄 Your DevOps Pipeline Is Already a Sustainability Program

During my doctoral research on modern engineering practices and operational efficiency, one pattern kept surfacing that I did not expect to find. The engineering teams making the most measurable progr

**📅 Sep 4, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/your-devops-pipeline-is-already-a-sustainability-program/)

### 📄 From the Horse’s Mouth: Anthropic Says AI Has Changed the SDLC

Anthropic’s AI-native SDLC playbook argues that faster coding is shifting the bottleneck to planning, testing, governance, deployment and operations.

**📅 Sep 3, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/from-the-horses-mouth-anthropic-says-ai-has-changed-the-sdlc/)

### 📄 Learning to Code in the Age of AI: Advice From a Top Udemy Instructor

What should a beginner developer learn in order to keep up in the AI era? This is one of the most debated questions in tech right now. We got in touch with Ardit Sulce, a Python educator with over 650

**📅 Sep 3, 2026** • **📰 JetBrains Blog**

[**🔗 Read more**](https://blog.jetbrains.com/education/2026/09/03/learning-to-code-in-the-age-of-ai-advice-from-a-top-udemy-instructor/)
