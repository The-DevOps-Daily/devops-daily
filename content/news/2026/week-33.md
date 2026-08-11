---
title: "DevOps Weekly Digest - Week 33, 2026"
date: "2026-08-10"
summary: "⚡ Curated updates from Kubernetes, cloud native tooling, CI/CD, IaC, observability, and security - handpicked for DevOps professionals!"
---

> 📌 **Handpicked by DevOps Daily** - Your weekly dose of curated DevOps news and updates!

---

## ⚓ Kubernetes

### 📄 Does Kubernetes DRA Replace HAMi?

Projects that want to share a GPU on Kubernetes have to work around an API instead of with it. The device plugin interface could count devices, and that was the whole vocabulary: nvidia.com/gpu: 1. It

**📅 Aug 7, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/08/07/does-kubernetes-dra-replace-hami/)

### 📄 Shadow AI in CI/CD: Threat-modeling the path from developer laptop to Kubernetes

Artificial intelligence is becoming part of daily software delivery, often before it becomes part of the security architecture. That gap has a name: Shadow AI. It is any AI tool, model, agent, extensi

**📅 Aug 7, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/08/07/shadow-ai-in-ci-cd-threat-modeling-the-path-from-developer-laptop-to-kubernetes/)

### 📄 The migration catalyst: turning virtualization disruption into application innovation

Starting nearly three decades ago, the cost efficiencies of server virtualization drove the first waves of IT transformation, wringing new efficiency out of the x86 servers that had already shaped the

**📅 Aug 6, 2026** • **📰 OpenShift Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/migration-catalyst-turning-virtualization-disruption-application-innovation)

### 📄 GitLab Secrets Manager adds ESO, Terraform, API support

Today, you might maintain separate secret stores for CI/CD, Kubernetes, and Terraform. However, that leaves multiple tools to manage, access models to keep in sync, and audit trails to correlate when 

**📅 Aug 6, 2026** • **📰 GitLab Blog**

[**🔗 Read more**](https://about.gitlab.com/blog/gitlab-secrets-manager-add-eso-terraform-api-support/)

### 📄 OpenCost 1.121.0: First-of-a-kind Kubernetes inference cost tracking

Your GPU bill is rising. Your models are serving billions of tokens. Yet one question remains unanswered: what does each token actually cost? This is not a hypothetical problem. Platform teams today o

**📅 Aug 5, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/08/05/opencost-1-121-0-first-of-a-kind-kubernetes-inference-cost-tracking/)

### 📄 Use EVPN in Red Hat OpenShift 4.22 to integrate production networks across Kubernetes cluster boundaries

Red Hat OpenShift Networking is making it easier for you to seamlessly and directly integrate your Kubernetes platforms with the data center networks you already operate by adopting the same standards

**📅 Aug 5, 2026** • **📰 OpenShift Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/use-evpn-red-hat-openshift-422-integrate-production-networks-across-kubernetes-cluster-boundaries)

### 📄 Run GPU batch inference on Amazon ECS Managed Instances with scale to zero

Deploy a single CloudFormation stack that builds a GPU batch inference pipeline on Amazon ECS Managed Instances. It uses Amazon SQS for job buffering and Application Auto Scaling to scale to zero when

**📅 Aug 3, 2026** • **📰 AWS Containers Blog**

[**🔗 Read more**](https://aws.amazon.com/blogs/containers/run-gpu-batch-inference-on-amazon-ecs-managed-instances-with-scale-to-zero/)

### 📄 Gateway API v1.6: TCPRoute and UDPRoute Graduate to Standard

The Kubernetes SIG Network community is thrilled to share the release of Gateway API v1.6.0, which was released on June 30th of this year! Gateway API has become the standard for modern, role-oriented

**📅 Aug 3, 2026** • **📰 Kubernetes Blog**

[**🔗 Read more**](https://kubernetes.io/blog/2026/08/03/gateway-api-v1-6-release/)

---

## ☁️ Cloud Native

### 📄 Managing virtual machines on Red Hat OpenShift with Service Mesh

Managing virtualized workloads alongside containerized applications remains a persistent challenge for IT operations, often creating siloed management environments. At Red Hat Summit 2026, I had the o

**📅 Aug 7, 2026** • **📰 OpenShift Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/managing-virtual-machines-red-hat-openshift-service-mesh)

### 📄 LitmusChaos Q1-Q2 2026 update: community, contributions, and project progress

About LitmusChaos LitmusChaos is an open source chaos engineering platform that helps teams identify weaknesses and potential outages in their infrastructure by running controlled chaos experiments. B

**📅 Aug 6, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/08/06/litmuschaos-q1-q2-2026-update-community-contributions-and-project-progress/)

### 📄 Extending Amazon ECS Express Mode to Build an Optimal Container Environment

Amazon ECS Express Mode gives you load balancing, scaling, logging, and networking out of the box. Learn how to extend an Express Mode service beyond its defaults with three hands-on examples: turning

**📅 Aug 4, 2026** • **📰 AWS Containers Blog**

[**🔗 Read more**](https://aws.amazon.com/blogs/containers/extending-amazon-ecs-express-mode-to-build-an-optimal-container-environment/)

### 📄 Empty sandboxes break developer experience

Learn how Docker Sandbox kits turn empty sandboxes into productive development environments with repeatable tooling, credentials, and configuration.

**📅 Aug 3, 2026** • **📰 Docker Blog**

[**🔗 Read more**](https://www.docker.com/blog/empty-sandboxes-break-developer-experience/)

### 📄 Docker AI Governance: Audit Logs, Now Where Your Security Team Already Works

Now in Docker AI Governance: a single searchable record of every policy decision your agents trigger, streamed to the SIEM your security team already runs, so you can show what your agents did and wha

**📅 Aug 3, 2026** • **📰 Docker Blog**

[**🔗 Read more**](https://www.docker.com/blog/docker-ai-governance-audit-logs-now-where-your-security-team-already-works/)

---

## 🔄 CI/CD

### 📄 Automate Incident Intake with AI SRE Runbooks

Automate incident intake with Harness AI SRE runbooks: auto-create tickets, open Slack channels, start Zoom bridges, and cut response time to seconds. | Blog

**📅 Aug 10, 2026** • **📰 Harness Blog**

[**🔗 Read more**](https://www.harness.io/blog/automate-incident-intake-and-start-response-in-seconds)

### 📄 A guide to slash commands in the GitHub Copilot app

Go beyond chat in the GitHub Copilot app with these slash commands. They'll help you plan, collaborate, automate, and customize your dev workflow. The post A guide to slash commands in the GitHub Copi

**📅 Aug 6, 2026** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/ai-and-ml/github-copilot/a-guide-to-slash-commands-in-the-github-copilot-app/)

### 📄 Confidential AI for GitLab Self-Hosted

Your developers want AI coding agents. Your source code is regulated IP that can't be sent to a third-party AI service, and your compliance team has said so in writing. The usual escape hatch, standin

**📅 Aug 6, 2026** • **📰 GitLab Blog**

[**🔗 Read more**](https://about.gitlab.com/blog/confidential-ai-for-gitlab-self-hosted/)

### 📄 Infrastructure Control Plane | Day 2 Operations & Drift

Learn why infrastructure breaks after deployment and how control planes enforce governance, detect drift, and automate remediation across Terraform, Ansible, and CI/CD. | Blog

**📅 Aug 6, 2026** • **📰 Harness Blog**

[**🔗 Read more**](https://www.harness.io/blog/infrastructure-breaks-after-deployment-why-day-2-operations-demand-a-control-plane)

### 📄 New bazel.build websites incoming!

We're happy to announce the launch of the new bazel.build documentation site and the new web UI for the Bazel Central Registry! New documentation site Last year, Alan Mond wrote a viral blog post that

**📅 Aug 5, 2026** • **📰 Bazel Blog**

[**🔗 Read more**](/2026/08/05/new-websites-incoming.html)

### 📄 How the GitHub legal team used Copilot CLI to streamline their workflows

Learn how to build tools to simplify how you work—without writing a single line of code. The post How the GitHub legal team used Copilot CLI to streamline their workflows appeared first on The GitHub 

**📅 Aug 4, 2026** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/ai-and-ml/github-copilot/how-the-github-legal-team-used-copilot-cli-to-streamline-their-workflows/)

### 📄 Turn one giant AI-generated pull request to a reviewable stack

Instead of one huge, un-reviewable pull request, teach coding agents to decompose work into a clean, ordered stack with GitHub stacked pull requests. The post Turn one giant AI-generated pull request 

**📅 Aug 4, 2026** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/engineering/turn-one-giant-ai-generated-pull-request-to-a-reviewable-stack/)

### 📄 Agent Optimization: Define what better means, and let AgentControl find it

Agent Optimization, now in beta in AgentControl, automatically searches for a better agent configuration against criteria you define.

**📅 Aug 4, 2026** • **📰 LaunchDarkly Blog**

[**🔗 Read more**](https://launchdarkly.com/blog/agent-optimization-launchdarkly-agentcontrol/)

### 📄 Stories from the Factory Floor: Building a software factory on our scariest code

We pointed coding agents at our oldest, most business-critical frontend. Here’s what it taught me about what a healthy AI software factory actually looks like.

**📅 Aug 3, 2026** • **📰 LaunchDarkly Blog**

[**🔗 Read more**](https://launchdarkly.com/blog/building-a-software-factory-on-our-scariest-code/)

### 📄 Blog: Selective drift correction with ignore rules

We are excited to introduce drift ignore rules for Flux Kustomizations, a long-requested capability that lets you tell Flux to leave specific fields alone during drift detection and correction, while 

**📅 Aug 3, 2026** • **📰 Flux CD Blog**

[**🔗 Read more**](https://fluxcd.io/blog/2026/08/ignore-rules-drift-detection/)

---

## 🏗️ IaC

### 📄 Terraform Scalability: When IaC Outgrows Your Setup

Terraform scalability issues slow teams down. Learn how to overcome IaC bottlenecks with better management. See how Harness helps. | Blog

**📅 Aug 10, 2026** • **📰 Harness Blog**

[**🔗 Read more**](https://www.harness.io/blog/terraform-scalability-when-iac-outgrows-your-setup)

### 📄 Autobase 2.10 released

Autobase 2.10 expands day-to-day PostgreSQL operations with new cluster management capabilities. Administrators can now perform common cluster actions directly from the Console UI, configure advanced 

**📅 Aug 7, 2026** • **📰 PostgreSQL News**

[**🔗 Read more**](https://www.postgresql.org/about/news/autobase-210-released-3357/)

### 📄 Accelerate CloudFormation development with the IaC MCP Server

Walk through a complete CloudFormation development cycle - authoring, validation, deployment, and troubleshooting - without leaving your AI assistant, using the AWS IaC MCP Server.

**📅 Aug 4, 2026** • **📰 AWS DevOps Blog**

[**🔗 Read more**](https://aws.amazon.com/blogs/devops/accelerate-cloudformation-development-with-the-iac-mcp-server/)

### 📄 YOLO Mode Is the Right Default. Your Laptop Is the Wrong Place for It.

Claude Code calls the flag --dangerously-skip-permissions, and the community long ago renamed it YOLO mode. It lets your coding agent run any command it wants without ever asking for permission. Every

**📅 Aug 4, 2026** • **📰 Pulumi Blog**

[**🔗 Read more**](https://www.pulumi.com/blog/sandboxing-coding-agents-yolo-mode/)

### 📄 Emulating Terraform on Pulumi's Engine

The core promise of Pulumi’s HCL support is that you can bring your existing Terraform configuration and modules, and pulumi will run them. If it works in OpenTofu and doesn’t work in Pulumi, we would

**📅 Aug 4, 2026** • **📰 Pulumi Blog**

[**🔗 Read more**](https://www.pulumi.com/blog/terraforms-data-model-on-pulumis-engine/)

### 📄 Bring Your Terraform Estate Into the Agentic Era

At Pulumi, we are building the platform for agentic infrastructure. Pulumi Cloud provides the guardrails and enterprise readiness needed to safely move fast in this new era. While we are seeing extrao

**📅 Aug 4, 2026** • **📰 Pulumi Blog**

[**🔗 Read more**](https://www.pulumi.com/blog/bring-your-terraform-estate-into-the-agentic-era/)

### 📄 A guided tour of Terraform state, hosted modules, and HCL in Pulumi

Today’s big release contains a whole new set of features designed for seamless interoperability with the Terraform and OpenTofu ecosystems, and there’s a lot there — so much that it can be tough to ge

**📅 Aug 4, 2026** • **📰 Pulumi Blog**

[**🔗 Read more**](https://www.pulumi.com/blog/terraform-to-pulumi-cloud-hands-on/)

---

## 📊 Observability

### 📄 Unifying Workers AI and AI Gateway into a single AI control plane

Cloudflare is unifying AI Gateway and Workers AI into a single control plane, giving developers observability, billing, and dynamic routing across both managed GPUs and external providers. Learn how u

**📅 Aug 7, 2026** • **📰 Cloudflare Blog**

[**🔗 Read more**](https://blog.cloudflare.com/workers-ai-gateway-unification/)

### 📄 How to Choose Digital Experience Monitoring Tools

Discover how digital experience monitoring tools help you understand user issues beyond APM, enabling faster, clearer insights for better software performance.

**📅 Aug 7, 2026** • **📰 New Relic Blog**

[**🔗 Read more**](https://newrelic.com/blog/observability/digital-experience-monitoring-tools)

### 📄 Scaling Autonomous Operations with AWS DevOps Agent and ServiceNow

This post is co-written with Govind Menon, Head of MCP Product at ServiceNow. Introduction Enterprise teams managing applications on AWS often rely on ServiceNow as their IT service management (ITSM) 

**📅 Aug 6, 2026** • **📰 AWS DevOps Blog**

[**🔗 Read more**](https://aws.amazon.com/blogs/devops/scaling-autonomous-operations-with-aws-devops-agent-and-servicenow/)

### 📄 Podcast recap: Observability won’t save your agents

On a recent episode of the MonkCast, Marek Poliks spoke with James Governor about why governing agents from the outside leaves teams perpetually one step behind.

**📅 Aug 6, 2026** • **📰 LaunchDarkly Blog**

[**🔗 Read more**](https://launchdarkly.com/blog/podcast-recap-observability-wont-save-your-agents/)

### 📄 How we built an automated debugging workflow at Sentry

How Sentry uses Seer autofix and Claude routines to build an automated debugging workflow that detects, fixes, and routes code issues automatically.

**📅 Aug 6, 2026** • **📰 Sentry Blog**

[**🔗 Read more**](https://blog.sentry.io/automated-debugging-workflow-sentry/)

### 📄 Curing alert fatigue: How embedded AI is redefining Red Hat OpenShift cluster troubleshooting

Between virtual machines, microservices, and AI pipelines, hybrid clouds can be incredibly complex and can bring an unwelcome partner: alert fatigue. SREs and IT OPs teams face a constant flood of dis

**📅 Aug 6, 2026** • **📰 OpenShift Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/curing-alert-fatigue-how-embedded-ai-redefining-red-hat-openshift-cluster-troubleshooting)

### 📄 Under the hood: how Amazon EKS Auto Mode detects, repairs, and diagnoses node failures

On Amazon EKS Auto Mode, node failures are detected, drained, and replaced automatically before anyone reaches for a laptop. This post shows how the Node Monitoring Agent and Karpenter form a detect-a

**📅 Aug 5, 2026** • **📰 AWS Containers Blog**

[**🔗 Read more**](https://aws.amazon.com/blogs/containers/under-the-hood-how-amazon-eks-auto-mode-detects-repairs-and-diagnoses-node-failures/)

### 📄 Session Replay Tools: A Technical Buyer’s Guide and Comparison

Discover how to evaluate session replay tools for engineering teams, ensuring they meet technical needs for incident response and observability.

**📅 Aug 5, 2026** • **📰 New Relic Blog**

[**🔗 Read more**](https://newrelic.com/blog/observability/session-replay-tools)

### 📄 Your OTel spans, our errors: A Sentry love story in one trace

The OtlpIntegration bridges OTel traces and Sentry errors. Keep your OTel setup, add Sentry for errors, and see both in one trace waterfall.

**📅 Aug 5, 2026** • **📰 Sentry Blog**

[**🔗 Read more**](https://blog.sentry.io/otel-spans-errors-sentry-trace/)

---

## 🔐 Security

### 📄 Threats Making WAVs - Incident Response to a Cryptomining Attack

Guardicore security researchers describe and uncover a full analysis of a cryptomining attack, which hid a cryptominer inside WAV files. The report includes the full attack vectors, from detection, in

**📅 Aug 10, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/security/threats-making-wavs-incident-reponse-cryptomining-attack)

### 📄 How Google Cloud detects, contains, and protects against emerging threats

At Google Cloud, securing your data and business systems is our foundational commitment. We empower our customers with the tools, governance, and infrastructure needed to securely deploy workloads and

**📅 Aug 7, 2026** • **📰 Google Cloud Blog**

[**🔗 Read more**](https://cloud.google.com/blog/products/identity-security/how-google-cloud-detects-contains-and-protects-against-emerging-threats/)

### 📄 CVE-2026-63077: Additional Guidance Following Reports of Active Exploitation

This post is a follow-up to our July 27, 2026, announcement about CVE-2026-63077. Summary What has changed since our initial announcement Since our initial announcement on July 27, 2026, we have recei

**📅 Aug 7, 2026** • **📰 JetBrains Blog**

[**🔗 Read more**](https://blog.jetbrains.com/teamcity/2026/08/cve-2026-63077-update/)

### 📄 Friday Five — August 7, 2026

Red Hat Recognized as a Leader for Third Consecutive Year in 2026 Gartner® Magic Quadrant™ for Cloud-Native Application PlatformsRed Hat OpenShift is recognized as a Leader in the 2026 Magic Quadrant 

**📅 Aug 7, 2026** • **📰 Red Hat Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/friday-five-august-7-2026-red-hat)

### 📄 Proactive patch management & compliance: Hardening the hybrid Azure fleet at scale

Welcome back to SUSE Solutions on Azure: The Technical Series. Bridging the Gap Between Linux Freedom and Azure Scale Enterprise Linux on Azure requires a careful balance between open source flexibili

**📅 Aug 6, 2026** • **📰 SUSE Blog**

[**🔗 Read more**](https://www.suse.com/c/proactive-patch-management-compliance-hardening-the-hybrid-azure-fleet-at-scale/)

### 📄 Open Source Summit + Embedded Linux Conference Europe 2026 Schedule Champions Open Source Innovation and Marks 35 Years of Linux

Industry leaders gather to advance the open source infrastructure powering embedded systems, cloud orchestration, AI security, safety-critical applications…

**📅 Aug 5, 2026** • **📰 KubeCon Updates**

[**🔗 Read more**](https://events.linuxfoundation.org/2026/08/05/open-source-summit-embedded-linux-conference-europe-2026-schedule-champions-open-source-innovation-and-marks-35-years-of-linux/)

### 📄 Governance Is a Developer Experience Problem

Learn why AI governance is about more than security. Discover how trust, clear boundaries, and developer experience enable AI adoption at scale.

**📅 Aug 5, 2026** • **📰 Docker Blog**

[**🔗 Read more**](https://www.docker.com/blog/governance-is-a-developer-experience-problem/)

### 📄 New Relic SecurityRX - Security for Operational Reliability

Treat security as a reliability problem. New UI experience (with the homepage), automation capabilities (with Jira), and the agent public preview for a complete remediation workflow.

**📅 Aug 5, 2026** • **📰 New Relic Blog**

[**🔗 Read more**](https://newrelic.com/blog/security/securityrx-agent-released)

### 📄 Continuous Offensive Security & AI Pentesting: 20 FAQs

Get answers to 20 common questions about continuous offensive security, AI penetration testing, DAST, and AI red teaming.

**📅 Aug 5, 2026** • **📰 Snyk Blog**

[**🔗 Read more**](https://snyk.io/blog/continuous-offensive-security-ai-pentesting-20-faqs/)

### 📄 The Software Supply Chain Is Under Siege. Devs Are Still the First Line of Defense

77% of organizations experienced a software supply chain incident in the past year. Explore Omdia's latest research on top risks, security gaps, and why developers are your first line of defense.

**📅 Aug 4, 2026** • **📰 Docker Blog**

[**🔗 Read more**](https://www.docker.com/blog/software-supply-chain-security-omdia-2026-report/)

### 📄 Evo Continuous Offensive Security Is Here Pentesting Grade Coverage For The 350 Days A Year You Aren't Testing

Snyk Evo Continuous Offensive Security brings autonomous, AI-powered pentesting to the 350 days between traditional tests, uncovering exploitable flaws attackers can find first.

**📅 Aug 4, 2026** • **📰 Snyk Blog**

[**🔗 Read more**](https://snyk.io/blog/evo-continuous-offensive-security/)

### 📄 AI Model Risk Intelligence Know Which Models You Can Trust Before You Deploy

AI model risk depends on how a model is deployed. Learn how Evo combines adversarial testing, attack impact, and deployment context to help teams compare models and enforce policy.

**📅 Aug 4, 2026** • **📰 Snyk Blog**

[**🔗 Read more**](https://snyk.io/blog/why-we-rebuilt-evo-ai-model-risk-scoring/)

---

## 💾 Databases

### 📄 The Complete Agent State Stack: Memory, Files, and Serverless Database Persistence for AI Apps

A serverless database is a fully-managed database that automatically scales compute and storage with demand, requires no server provisioning or capacity planning, and bills only for actual usage, incl

**📅 Aug 7, 2026** • **📰 TiDB Blog**

[**🔗 Read more**](https://www.pingcap.com/blog/serverless-database/)

### 📄 Postgres Summit US 2026 Schedule is now live!

Hi all, The talk schedule for Postgres Summit US 2026 is now published. Browse it here: Talk Schedule The summit runs September 30 through October 2, 2026 at Convene, 555 Broadway, New York, NY, organ

**📅 Aug 7, 2026** • **📰 PostgreSQL News**

[**🔗 Read more**](https://www.postgresql.org/about/news/postgres-summit-us-2026-schedule-is-now-live-3359/)

### 📄 Why Attend TiDB SCaiLE 2026: Same Complexity, Different Clock Speeds

A single user action in an agentic application no longer maps to a single database query. It spawns agent instances that branch context in milliseconds, hold memory across sessions, and provision thei

**📅 Aug 6, 2026** • **📰 TiDB Blog**

[**🔗 Read more**](https://www.pingcap.com/blog/why-attend-tidb-scaile-2026/)

### 📄 How we took malware advisories beyond npm

GitHub malware advisories no longer stop at npm. Here's how we wired OpenSSF's malicious-packages data into the Advisory Database, and why we built the pipeline paranoid. The post How we took malware 

**📅 Aug 6, 2026** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/security/supply-chain-security/how-we-took-malware-advisories-beyond-npm/)

### 📄 Refactoring a SQL Table at Scale: Lessons from Harness CI

How Harness refactored a flat SQL table into a normalized schema, cutting storage per row from 400 bytes to 28 bytes and making API latency constant at any scale. | Blog

**📅 Aug 6, 2026** • **📰 Harness Blog**

[**🔗 Read more**](https://www.harness.io/blog/lessons-from-refactoring-at-scale)

### 📄 How Redis brings persistent memory to Snowflake Cortex Agents

AI agents can reason and act, but without memory, every interaction starts from zero. Intelligent short-term memory and persistent context across conversations are what turns a capable model into a tr

**📅 Aug 6, 2026** • **📰 Redis Blog**

[**🔗 Read more**](https://redis.io/blog/how-redis-brings-persistent-memory-to-snowflake-cortex-agents/)

### 📄 Top vector database alternatives for RAG pipelines

You're building an AI app: maybe a RAG system, an agent with memory, or a chatbot with semantic caching. You need vector search, and you're weighing your options. One is a unified real-time platform l

**📅 Aug 5, 2026** • **📰 Redis Blog**

[**🔗 Read more**](https://redis.io/blog/vector-database-alternatives-rag-pipelines/)

### 📄 Migrating Real-Time Data into TiDB with Debezium CDC

Moving data into a new database is rarely a one-shot copy. Migrating off a legacy system, adopting a distributed SQL database, carrying out a heterogeneous database migration, or standing up an analyt

**📅 Aug 4, 2026** • **📰 TiDB Blog**

[**🔗 Read more**](https://www.pingcap.com/blog/debezium-cdc-to-tidb/)

### 📄 DDIA 2nd Edition Excerpt: On Scalability

Martin Kleppmann and Chris Riccomini's scalability considerations for designing data-intensive applications -- from the second edition of the Designing Data-Intensive Applications book

**📅 Aug 4, 2026** • **📰 ScyllaDB Blog**

[**🔗 Read more**](https://www.scylladb.com/2026/08/04/ddia-2nd-edition-excerpt-on-scalability/)

### 📄 Your Meko Questions, Answered

Interest in Meko has been tremendous, with user questions coming in thick and fast via Discord, LinkedIn, and at in-person events. In his recent AMA session, Yugabyte co-founder Karthik Ranganathan an

**📅 Aug 4, 2026** • **📰 Yugabyte Blog**

[**🔗 Read more**](https://www.yugabyte.com/blog/your-meko-questions-answered/)

### 📄 Announcing E-Maj 5.0.0.

We are very glad to announce the E-Maj 5.0.0 version. Among improvements, this major version: Allows non-superuser roles to install and use E-Maj in a database, the usable features depending on the pr

**📅 Aug 4, 2026** • **📰 PostgreSQL News**

[**🔗 Read more**](https://www.postgresql.org/about/news/announcing-e-maj-500-3353/)

### 📄 pgBackRest 2.59.0 Released

July 30, 2026: The pgBackRest community is pleased to announce the release of pgBackRest 2.59.0, the latest version of the reliable, easy-to-use backup and restore solution that can seamlessly scale u

**📅 Aug 4, 2026** • **📰 PostgreSQL News**

[**🔗 Read more**](https://www.postgresql.org/about/news/pgbackrest-2590-released-3355/)

---

## 🌐 Platforms

### 📄 Keep Your Tech Flame Alive: Trailblazer Rachel Bayley

In this Akamai FLAME Trailblazer blog post, Rachel Bayley encourages women to step into the unknown and to be their authentic selves.

**📅 Aug 10, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/culture/2024/may/keep-your-tech-flame-alive-trailblazer-rachel-bayley)

### 📄 The Oracle of Delphi Will Steal Your Credentials

Our deception technology is able to reroute attackers into honeypots, where they believe that they found their real target. The attacks brute forced passwords for RDP credentials to connect to the vic

**📅 Aug 10, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/security/the-oracle-of-delphi-steal-your-credentials)

### 📄 The Nansh0u Campaign – Hackers Arsenal Grows Stronger

In the beginning of April, three attacks detected in the Guardicore Global Sensor Network (GGSN) caught our attention. All three had source IP addresses originating in South-Africa and hosted by Volum

**📅 Aug 10, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/security/the-nansh0u-campaign-hackers-arsenal-grows-stronger)

### 📄 Platform Engineering ROI: What it costs to build your own platform

What it actually costs to build your own internal developer platform over five years, and why most “we’ll just build The post Platform Engineering ROI: What it costs to build your own platform appeare

**📅 Aug 9, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/real-cost-diy-platform/)

### 📄 Public Cloud Toolchains in SUSE Linux Enterprise 16: Evolution and Transparent Containers

The release of the SUSE Linux Enterprise (SLE) 16 distributions has long come and gone and the development cycle for SLE 16.1 is well on the way and will culminate in the SLE 16.1 release later this y

**📅 Aug 8, 2026** • **📰 SUSE Blog**

[**🔗 Read more**](https://www.suse.com/c/public-cloud-toolchains-in-suse-linux-enterprise-16-evolution-and-transparent-containers/)

### 📄 The login screen is where sovereignty gets real

Everyone points at the cloud. Almost nobody points at the front door. Ask most executives where their sovereignty risk sits and they point at the cloud, the data, the AI models. Fair enough, those are

**📅 Aug 8, 2026** • **📰 SUSE Blog**

[**🔗 Read more**](https://www.suse.com/c/the-login-screen-is-where-sovereignty-gets-real/)

### 📄 Amazon EC2 R8i and R8i-Flex instances are now available in Europe (Milan) region

Starting today, Amazon Elastic Compute Cloud (Amazon EC2) R8i and R8i-flex instances are available in the Europe (Milan) region. These instances are powered by custom Intel Xeon 6 processors, availabl

**📅 Aug 7, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/08/amazon-ec2-r8i-r8i-flex/)

### 📄 Amazon Timestream for InfluxDB now supports backup and restore

Amazon Timestream for InfluxDB now lets you create and manage your own backups and restore your data on demand. You can trigger one-time, on-demand backups, schedule automated recurring backups at the

**📅 Aug 7, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/07/timestream-influxdb-backup-restore/)

### 📄 Amazon Cognito now available as a skill in the Agent Toolkit for AWS

Amazon Cognito is now available as a core skill (aws-auth) in the Agent Toolkit for AWS. AI coding agents using the toolkit can now set up, configure, secure, and troubleshoot Amazon Cognito using bes

**📅 Aug 7, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/08/aws-auth-agent-skill/)

### 📄 Zero-code, low-cost data ingestion: New BigQuery DTS capabilities

In a fast-paced digital economy, data is your most critical engine. Yet, many enterprises find themselves trapped in a costly paradox, spending over 100 hours a week building and fixing fragile, in-ho

**📅 Aug 7, 2026** • **📰 Google Cloud Blog**

[**🔗 Read more**](https://cloud.google.com/blog/products/data-analytics/new-bigquery-data-transfer-service-capabilities/)

### 📄 Unifying Structured and Unstructured Data Insights with BQ Search Innovations

Modern enterprises possess a vast amount of unstructured data, yet they frequently encounter significant challenges in managing and extracting value from it. Historically, unlocking the insights hidde

**📅 Aug 7, 2026** • **📰 Google Cloud Blog**

[**🔗 Read more**](https://cloud.google.com/blog/products/data-analytics/bigquery-search-innovations-unify-structured-unstructured-data/)

### 📄 GOL! How TelevisaUnivision streamed the FIFA World Cup to millions with Google Cloud

Live sports broadcasting represents the ultimate stress test for digital media infrastructure, where operational success or failure is measured in milliseconds and observed live by millions of viewers

**📅 Aug 7, 2026** • **📰 Google Cloud Blog**

[**🔗 Read more**](https://cloud.google.com/blog/products/networking/streaming-the-fifa-world-cup-with-televisaunivision/)

---

## 📰 Misc

### 📄 Visual Studio Code 1.133 (Insiders)

Learn what's new in Visual Studio Code 1.133 (Insiders) Read the full article

**📅 Aug 11, 2026** • **📰 VS Code Blog**

[**🔗 Read more**](https://code.visualstudio.com/updates/v1_133)

### 📄 Coding agents can be evaluated. We just have to evaluate the work.

I recently argued with a software factory provider, whose position was that coding agents cannot be evaluated. Their reasoning was The post Coding agents can be evaluated. We just have to evaluate the

**📅 Aug 9, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/evaluating-coding-agents-framework/)

### 📄 AI coding got faster. Why didn’t engineering?

AI is great at making individuals faster, but the surrounding systems are then slowing everything right back down. This result The post AI coding got faster. Why didn’t engineering? appeared first on 

**📅 Aug 9, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/ai-productivity-measurement-gap/)

### 📄 AI adoption isn’t the same as AI usage

Every engineering org I’ve talked to this year has some version of the same chart. Seat activations climbing. Token spend The post AI adoption isn’t the same as AI usage appeared first on The New Stac

**📅 Aug 8, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/ai-adoption-versus-usage/)

### 📄 Microsoft’s New Testing Agent Tackles the Trust Gap in AI-Generated Code

AI coding assistants write code fast. Whether that code can be trusted is a separate question, and it’s becoming a more urgent one. Surveys this year put average developer trust in AI-generated output

**📅 Aug 7, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/microsofts-new-testing-agent-tackles-the-trust-gap-in-ai-generated-code/)

### 📄 ‘Flooding Dropper’ Is Hitting npm With a Tidal Wave of Malicious Packages

Threat researchers at Sonatype are warning developers of an expanding campaign that is generating a wide range of npm accounts and dropping small numbers of malicious packages from each one, essential

**📅 Aug 7, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/flooding-dropper-is-hitting-npm-with-a-tidal-wave-of-malicious-packages/)

### 📄 JetBrains Academy – July Digest

Somewhere between the fifteenth open tab and the third iced coffee, it hit me. Maybe we don’t hate meetings. We just hate the ones where nobody has anything to say. Welcome back to another mandatory m

**📅 Aug 7, 2026** • **📰 JetBrains Blog**

[**🔗 Read more**](https://blog.jetbrains.com/education/2026/08/07/jetbrains-academy-july-2026-2-2/)

### 📄 Stop burning your AI budget: Optimize GPU usage and model deployment with workflow navigator

Uber burned through its entire 2026 AI tools budget by April. Microsoft faced a similar crisis, pulling Claude Code licenses because the tool worked too well and people used it too much. Even OpenAI's

**📅 Aug 7, 2026** • **📰 Red Hat Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/stop-burning-your-ai-budget-optimize-gpu-usage-and-model-deployment-workflow-navigator)

### 📄 Why Reliability Guardrails Are Needed in Every AI Coding Pipeline

We’re in the middle of a reliability reckoning. Thanks to AI, companies are shipping code much faster than before. But if there’s anything to learn from the surge in high-profile outages over the last

**📅 Aug 6, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/why-reliability-guardrails-are-needed-in-every-ai-coding-pipeline/)

### 📄 AI Architecture: Moving Past the Washing to the Truth

In the current hype cycle, “AI” has become a linguistic junk drawer—a catch-all term that vendors use to mask everything from basic if-then statements to massive neural networks. For the modern enterp

**📅 Aug 6, 2026** • **📰 SUSE Blog**

[**🔗 Read more**](https://www.suse.com/c/enterprise-ai-architecture-beyond-ai-washing/)

### 📄 Println Debugging Done Right

The simplest tools are often the most useful, and debugging is a prime example of this. There are many advanced debugging techniques, and while they all have their use cases, println debugging is stil

**📅 Aug 6, 2026** • **📰 JetBrains Blog**

[**🔗 Read more**](https://blog.jetbrains.com/idea/2026/08/println-debugging-done-right/)

### 📄 Figma Connect for WebStorm: Stage One of a Better Design-to-Code Experience

Where time actually goes in design-to-code Every design implementation starts the same way: find the Figma tab, find the right frame, screenshot it, paste it somewhere, switch back to the terminal. By

**📅 Aug 6, 2026** • **📰 JetBrains Blog**

[**🔗 Read more**](https://blog.jetbrains.com/webstorm/2026/08/figma-connect-webstorm/)
