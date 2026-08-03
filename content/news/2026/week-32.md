---
title: "DevOps Weekly Digest - Week 32, 2026"
date: "2026-08-03"
summary: "⚡ Curated updates from Kubernetes, cloud native tooling, CI/CD, IaC, observability, and security - handpicked for DevOps professionals!"
---

> 📌 **Handpicked by DevOps Daily** - Your weekly dose of curated DevOps news and updates!

---

## ⚓ Kubernetes

### 📄 Run GPU batch inference on Amazon ECS Managed Instances with scale to zero

Deploy a single CloudFormation stack that builds a GPU batch inference pipeline on Amazon ECS Managed Instances. It uses Amazon SQS for job buffering and Application Auto Scaling to scale to zero when

**📅 Aug 3, 2026** • **📰 AWS Containers Blog**

[**🔗 Read more**](https://aws.amazon.com/blogs/containers/run-gpu-batch-inference-on-amazon-ecs-managed-instances-with-scale-to-zero/)

### 📄 Kubernetes upgrades don’t have to break things: How EKS is making cluster lifecycle management simpler and safer

Kubernetes moves at a pace of three minor version releases per year, and staying current is not optional if you The post Kubernetes upgrades don’t have to break things: How EKS is making cluster lifec

**📅 Aug 1, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/eks-kubernetes-upgrade-rollback/)

### 📄 What Is Agentic AI for Kubernetes? A Platform Engineer’s Guide

AI has been the main topic of conversation in infrastructure circles for a while now. Recently, however, the conversation moved from “AI that answers questions” to “AI that takes action,” and that shi

**📅 Aug 1, 2026** • **📰 SUSE Blog**

[**🔗 Read more**](https://www.suse.com/c/what-is-agentic-ai-for-kubernetes-a-platform-engineers-guide/)

### 📄 Kubernetes v1.37 Sneak Peek

As we get closer to the release date for Kubernetes v1.37, the project develops and matures, features may be deprecated, removed, or replaced with better ones for the project's overall health. This bl

**📅 Jul 31, 2026** • **📰 Kubernetes Blog**

[**🔗 Read more**](https://kubernetes.io/blog/2026/07/31/kubernetes-v1-37-sneak-peek/)

### 📄 Scaling Kubernetes pods with KEDA based on Amazon SQS queue depth

In event-driven Kubernetes architectures, CPU and memory utilization often fail to reflect real system pressure. A worker pod may sit idle from a CPU perspective while thousands of messages pile up in

**📅 Jul 31, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/07/31/scaling-kubernetes-pods-with-keda-based-on-amazon-sqs-queue-depth/)

### 📄 Runtime Supply Chain Verification using the Node Resource Interface (NRI)

The widely used container supply chain verification tools today operate at the Kubernetes API layer as admission webhooks (such as Kyverno, OPA Gatekeeper, and Sigstore Policy Controller). They interc

**📅 Jul 30, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/07/30/runtime-supply-chain-verification-using-the-node-resource-interface-nri/)

### 📄 How the controller-runtime Cache Actually Works, and Why Your Controller Does Not Crash the API Server

Caution: Some of the technical detail in this article is not accurate. We are reviewing it and preparing corrections. Until then, check what you read here against the controller-runtime documentation.

**📅 Jul 29, 2026** • **📰 Kubernetes Blog**

[**🔗 Read more**](https://kubernetes.io/blog/2026/07/29/controller-runtime-cache-explained/)

### 📄 Your Kubernetes health checks are accidentally waking your services. Here’s the fix.

Scale-to-zero breaks when health checks scale you back up. Learn how KubeElasti’s ProbeResponse lets Kubernetes services stay genuinely idle — while keeping load balancers and uptime monitors happy. S

**📅 Jul 29, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/07/29/your-kubernetes-health-checks-are-accidentally-waking-your-services-heres-the-fix/)

### 📄 How to Run AI Agents on Kubernetes with Pulumi

Kubernetes has become the default place teams run agentic AI workloads: CNCF’s 2026 annual survey found that 66% of organizations hosting generative AI models use Kubernetes to manage some or all of t

**📅 Jul 28, 2026** • **📰 Pulumi Blog**

[**🔗 Read more**](https://www.pulumi.com/blog/ai-agents-on-kubernetes/)

---

## ☁️ Cloud Native

### 📄 Amazon ECR now supports image layers up to 200 GB

Amazon Elastic Container Registry (Amazon ECR) has increased the maximum image layer size limit to 200 GB, for images pushed via Docker push. Previously, packaging assets required splitting data acros

**📅 Aug 3, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/08/amazon-ecr-image-layers/)

### 📄 Your agent needs a computer, not a container — introducing @cloudflare/computer

Agents need more than just a container to scale. We're introducing @cloudflare/computer, an agent runtime that dynamically orchestrates between fast, efficient isolates and full Linux containers to gi

**📅 Aug 3, 2026** • **📰 Cloudflare Blog**

[**🔗 Read more**](https://blog.cloudflare.com/cloudflare-computer/)

### 📄 Empty sandboxes break developer experience

Learn how Docker Sandbox kits turn empty sandboxes into productive development environments with repeatable tooling, credentials, and configuration.

**📅 Aug 3, 2026** • **📰 Docker Blog**

[**🔗 Read more**](https://www.docker.com/blog/empty-sandboxes-break-developer-experience/)

### 📄 Docker AI Governance: Audit Logs, Now Where Your Security Team Already Works

Now in Docker AI Governance: a single searchable record of every policy decision your agents trigger, streamed to the SIEM your security team already runs, so you can show what your agents did and wha

**📅 Aug 3, 2026** • **📰 Docker Blog**

[**🔗 Read more**](https://www.docker.com/blog/docker-ai-governance-audit-logs-now-where-your-security-team-already-works/)

### 📄 Coordinating Teams of AI Agents in Real Time on NATS and JetStream

Guest post by David Farah and Sven Jonscher, creators of Cotal . We build Cotal, the open standard for AI agents to work together in one shared space. Our first multi-agent prototypes taught us where 

**📅 Aug 1, 2026** • **📰 NATS Blog**

[**🔗 Read more**](https://nats.io/blog/coordinating-ai-agent-teams-on-nats/)

### 📄 Docker OIDC connections for GitHub Actions available for Docker Orgs

Eliminate Stored Credentials in Your CI/CD Pipelines TL;DR: Docker now supports OpenID Connect (OIDC) for GitHub Actions. Your workflows can authenticate with short-lived, per-run tokens instead of st

**📅 Jul 31, 2026** • **📰 Docker Blog**

[**🔗 Read more**](https://www.docker.com/blog/docker-oidc-connections-for-github-actions-available-for-docker-orgs/)

### 📄 The Future of Agentic AI Depends on Openness and Trust. That’s Why Docker Is Joining Nvidia’s Open Secure AI Alliance.

Docker joins NVIDIA's Open Secure AI Alliance to help build the security, governance, and trust frameworks that agentic AI systems demand.

**📅 Jul 30, 2026** • **📰 Docker Blog**

[**🔗 Read more**](https://www.docker.com/blog/docker-joins-nvidia-open-secure-ai-alliance/)

---

## 🔄 CI/CD

### 📄 Blog: Selective drift correction with ignore rules

We are excited to introduce drift ignore rules for Flux Kustomizations, a long-requested capability that lets you tell Flux to leave specific fields alone during drift detection and correction, while 

**📅 Aug 3, 2026** • **📰 Flux CD Blog**

[**🔗 Read more**](https://fluxcd.io/blog/2026/08/ignore-rules-drift-detection/)

### 📄 Secure every commit to production with Claude and GitLab

Agentic coding is moving faster than many enterprise governance programs can keep up with. Coding assistants, like the Claude security guidance plugin and Claude Security, can flag and fix common vuln

**📅 Aug 3, 2026** • **📰 GitLab Blog**

[**🔗 Read more**](https://about.gitlab.com/blog/claude-security-and-gitlab/)

### 📄 Control Runtime Behavior with Config Management

Learn how Config Management lets teams safely manage runtime configuration across FME environments without redeploying applications. | Blog

**📅 Aug 3, 2026** • **📰 Harness Blog**

[**🔗 Read more**](https://www.harness.io/blog/control-runtime-behavior-with-config-management)

### 📄 Stories from the Factory Floor: Empowering agents with LaunchDarkly MCP tools

A new capability on the LaunchDarkly MCP server offers a practical look at what an automated software factory could look like in practice.

**📅 Jul 31, 2026** • **📰 LaunchDarkly Blog**

[**🔗 Read more**](https://launchdarkly.com/blog/stories-from-the-factory-floor-empowering-agents-with-launchdarkly-mcp-tools/)

### 📄 Don’t stop early: Case-folding source code at memory speed

How a branch-free loop and byte-space arithmetic let GitHub case-fold every byte of code search at >45 GiB/s on a single core. The post Don’t stop early: Case-folding source code at memory speed appea

**📅 Jul 31, 2026** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/engineering/architecture-optimization/dont-stop-early-case-folding-source-code-at-memory-speed/)

### 📄 Gitea Runner 3.0.0 is released

We are happy to announce the release of Gitea Runner 3.0.0.

**📅 Jul 31, 2026** • **📰 Gitea Blog**

[**🔗 Read more**](https://blog.gitea.com/release-of-runner-3.0.0)

### 📄 How to govern agentic AI, MCPs, and AI code assistants

AI code completion built human review into the process by design. A developer types, a suggestion appears, and a human decides whether to accept it. A person looked at every line before it shipped. Ag

**📅 Jul 31, 2026** • **📰 GitLab Blog**

[**🔗 Read more**](https://about.gitlab.com/blog/govern-agentic-ai-mcps-code-assistants/)

### 📄 Stacked sessions and pull requests in the GitHub Copilot app

Learn how I modernized an old codebase of mine using stacked sessions and pull requests in the GitHub Copilot app. The post Stacked sessions and pull requests in the GitHub Copilot app appeared first 

**📅 Jul 30, 2026** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/ai-and-ml/github-copilot/stacked-sessions-and-pull-requests-in-the-github-copilot-app/)

### 📄 Automate all the things: How to use Grafana Cloud's AI to relieve the operational burden

Continuous integration and continuous delivery (CI/CD) have dramatically changed how we ship software. But once code reaches production, the operational work is still surprisingly manual. Engineers co

**📅 Jul 29, 2026** • **📰 Grafana Blog**

[**🔗 Read more**](https://grafana.com/blog/automate-all-the-things-how-to-use-grafana-cloud-s-ai-to-relieve-the-operational-burden/)

### 📄 Why GitLab signed the Open Weights and American AI Leadership letter

This week GitLab signed the Open Weights and American AI Leadership letter, joining a long list of other technology companies that support a strong, open AI ecosystem. The letter argues that open weig

**📅 Jul 29, 2026** • **📰 GitLab Blog**

[**🔗 Read more**](https://about.gitlab.com/blog/open-weight-model-letter/)

### 📄 GitLab Patch Release: 19.2.1, 19.1.3, 19.0.5



**📅 Jul 29, 2026** • **📰 GitLab Blog**

[**🔗 Read more**](https://docs.gitlab.com/releases/patches/patch-release-gitlab-19-2-1-released/)

### 📄 Why AI Deployment Breaks Standard CI/CD

Learn why AI deployment can break standard CI/CD and how runtime controls, shadow testing, rollouts, and rollback reduce risk.

**📅 Jul 28, 2026** • **📰 LaunchDarkly Blog**

[**🔗 Read more**](https://launchdarkly.com/blog/why-ai-model-deployments-break-standard-cicd/)

---

## 🏗️ IaC

### 📄 Red Hat Ansible All-Stars: Driving the future of network and infrastructure automation

As enterprise infrastructures scale across hybrid cloud environments and distributed networks, operations teams face an unsustainable calculation. Managing thousands of servers or multi-vendor routing

**📅 Jul 31, 2026** • **📰 Red Hat Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/red-hat-ansible-all-stars-driving-future-network-and-infrastructure-automation)

### 📄 Migrate CloudFormation to Pulumi with Discovered Stacks

With Discovered Stacks, Pulumi Cloud does the bookkeeping for a CloudFormation migration: every resource in the stack gets an explicit migration status, and the migration is done when the code provabl

**📅 Jul 30, 2026** • **📰 Pulumi Blog**

[**🔗 Read more**](https://www.pulumi.com/blog/discovered-stacks-migrate-cloudformation-to-pulumi/)

### 📄 Discovered Stacks: One Place for All Your Infrastructure

Today we’re launching Discovered Stacks: Pulumi Cloud now models your AWS CloudFormation stacks and Azure Resource Manager deployments as stacks, right alongside your Pulumi IaC stacks. And when you’r

**📅 Jul 30, 2026** • **📰 Pulumi Blog**

[**🔗 Read more**](https://www.pulumi.com/blog/discovered-stacks/)

---

## 📊 Observability

### 📄 Cortex completes OSTIF security audit

The Open Source Technology Improvement Fund is proud to share the results of our security audit of Cortex. Cortex functions as a long-term, multi-tenant scalable open source storage for Prometheus and

**📅 Aug 3, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/08/03/cortex-completes-ostif-security-audit/)

### 📄 Reflections on AI Week, and the future of solving problems with observability and AI

Thank you for spending AI Week with us. We’re thrilled by the reaction and we all enjoyed replying to your questions. Thanks for engaging. Some of my favorite quotes from LinkedIn and Reddit include: 

**📅 Jul 31, 2026** • **📰 Grafana Blog**

[**🔗 Read more**](https://grafana.com/blog/ai-week-recap/)

### 📄 Introducing New Relic eBPF Logs - Now in Public Preview

Collect application logs through the New Relic eBPF agent, connect them to APM services, and reduce the need for a separate log forwarder.

**📅 Jul 31, 2026** • **📰 New Relic Blog**

[**🔗 Read more**](https://newrelic.com/blog/news/introducing-ebpf-logs-pp)

### 📄 How to build a trust platform for your agent with Grafana Agent Observability

Observing fast-growing agentic workloads is no small feat, especially if you try to build your own monitoring stack or rely solely on tools built for a time before LLMs. At Grafana Labs, we know this 

**📅 Jul 30, 2026** • **📰 Grafana Blog**

[**🔗 Read more**](https://grafana.com/blog/how-to-build-a-trust-platform-for-your-agent-with-grafana-agent-observability/)

### 📄 Salesforce Observability with New Relic

The New Relic Salesforce Exporter centralizes Salesforce telemetry, performance, and security data into New Relic for proactive, unified observability.

**📅 Jul 30, 2026** • **📰 New Relic Blog**

[**🔗 Read more**](https://newrelic.com/blog/observability/salesforce-observability-with-new-relic)

### 📄 Achieving 100% Observability with BIND and Zabbix

Argentina’s BIND Group is a diversified financial services ecosystem centered around BIND Banco Industrial, offering banking, investment, insurance, leasing, fintech, and digital payment solutions. Wi

**📅 Jul 29, 2026** • **📰 Zabbix Blog**

[**🔗 Read more**](https://blog.zabbix.com/achieving-100-observability-with-bind-and-zabbix/33358/)

### 📄 Telemetry-driven development: How to gain confidence in your coding agents' behavior with gcx and Grafana MCP

You’re about to click "Merge" on a PR, but you feel more anxious about it than you used to. Why? You did everything properly, by today’s standards: You used Claude to create a plan, giving it context 

**📅 Jul 28, 2026** • **📰 Grafana Blog**

[**🔗 Read more**](https://grafana.com/blog/telemetry-driven-development-how-to-gain-confidence-in-your-coding-agents-behavior-with-gcx-and-grafana-mcp/)

### 📄 MCP is going stateless: What the new spec means for AI agents

The Model Context Protocol (MCP) is going stateless. Discover how this architecture shift simplifies agent scaling and integrates OpenTelemetry.

**📅 Jul 28, 2026** • **📰 New Relic Blog**

[**🔗 Read more**](https://newrelic.com/blog/ai/mcp-is-going-stateless)

### 📄 We broke the OTel demo

If you’ve been running the Demo for some time, you may have seen a couple of structural changes lately, and you may even have gotten mad about things not working as expected. We feel your pain and we 

**📅 Jul 28, 2026** • **📰 OpenTelemetry Blog**

[**🔗 Read more**](https://opentelemetry.io/blog/2026/we-broke-the-demo/)

---

## 🔐 Security

### 📄 Threats Making WAVs - Incident Response to a Cryptomining Attack

Guardicore security researchers describe and uncover a full analysis of a cryptomining attack, which hid a cryptominer inside WAV files. The report includes the full attack vectors, from detection, in

**📅 Aug 3, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/security/threats-making-wavs-incident-reponse-cryptomining-attack)

### 📄 AWS WAF now supports Miggo Security managed rule groups for emerging threats and AI/ML application protection

AWS WAF now supports two new partner managed rule groups from Miggo Security, available through AWS Marketplace: Miggo Rules for AWS WAF – High Emerging Application Threats, and Miggo Rules for AWS WA

**📅 Aug 3, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/07/aws-waf-miggo-managed-rule-groups)

### 📄 Microsoft Confirms Copilot ‘Super App’ Is Coming This Year — and It’s About More Than Convenience

Microsoft is combining Copilot Chat, Code, Cowork and Autopilots into one super app, raising new questions about agent governance, identity, licensing and security.

**📅 Aug 3, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/microsoft-confirms-copilot-super-app-is-coming-this-year-and-its-about-more-than-convenience/)

### 📄 Announcing Red Hat OpenShift Platform Plus for Red Hat OpenShift Service on AWS on AWS Marketplace

Organizations using Red Hat OpenShift Service on AWS (ROSA) are increasingly seeking ways to extend their platform’s capabilities with enterprise-grade security and data services. Red Hat OpenShift Pl

**📅 Jul 31, 2026** • **📰 OpenShift Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/red-hat-openshift-platform-plus-rosa-aws-marketplace)

### 📄 Same goals, different clocks: What Red Hat’s 2025 Risk Report reveals about global compliance gaps

In April 2026, Red Hat’s Product Security team published its annual Risk Report . I encourage everyone involved in building, shipping, securing, or regulating software to read it–not just for the vuln

**📅 Jul 31, 2026** • **📰 Red Hat Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/red-hat-2025-risk-report)

### 📄 Friday Five — July 31, 2026

How leading companies are turning AI vision into business valueEnterprises are focused on moving beyond theoretical AI pilots to operationalizing it at scale, optimizing costs, and governing its actio

**📅 Jul 31, 2026** • **📰 Red Hat Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/friday-five-july-31-2026-red-hat)

### 📄 Secure at Inception: Announcing the Snyk Studio Integration for Snowflake Cortex Code

Snyk Studio integrates with Snowflake Cortex Code to scan AI-generated code, dependencies, and containers for vulnerabilities during development.

**📅 Jul 30, 2026** • **📰 Snyk Blog**

[**🔗 Read more**](https://snyk.io/blog/announcing-snyk-studio-integration-snowflake-cortex-code/)

### 📄 The Attacker Never Sleeps, Neither Can Your Testing

AI is accelerating software development and giving attackers machine-speed capabilities. Security teams must continuously test AI-built code, govern agents, and independently validate every finding.

**📅 Jul 30, 2026** • **📰 Snyk Blog**

[**🔗 Read more**](https://snyk.io/blog/attacker-never-sleeps-neither-can-testing/)

### 📄 Tame Dependabot: Group your updates, slow the cadence, keep security fast

Dependabot keeps your dependencies current, but its defaults can flood your repository with pull requests. Here's how grouping updates, slowing the cadence, and keeping security fixes fast cut the noi

**📅 Jul 29, 2026** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/security/supply-chain-security/tame-dependabot-group-your-updates-slow-the-cadence-keep-security-fast/)

### 📄 Add security context to operational investigations with AWS DevOps Agent and Wiz

This post was co-authored by Ayelet Harcz (Product Manager), Hen Perez (CTO Architect), and Shani Gafni (Product Manager) at Wiz. When an on-call engineer receives an alert at 2 AM, a CPU spike, a lat

**📅 Jul 29, 2026** • **📰 AWS DevOps Blog**

[**🔗 Read more**](https://aws.amazon.com/blogs/devops/add-security-context-to-operational-investigations-with-aws-devops-agent-and-wiz/)

### 📄 Stadium Summer: The Snyk Connect Fan Zone Tour

Snyk’s Fan Zone tour brought AI security workshops, networking, and friendly competition to 8 cities and 3 virtual sessions. Attendees built skills, shared ideas, and leveled up together.

**📅 Jul 29, 2026** • **📰 Snyk Blog**

[**🔗 Read more**](https://snyk.io/blog/stadium-summer-snyk-connect-fan-zone-tour/)

### 📄 Sovereign by design: Lessons from Red Hat Summit

Digital sovereignty used to sit somewhere between a compliance checkbox and a future roadmap item. That’s changing fast. At Red Hat Summit, Mohammed Retmi of Core42 in the United Arab Emirates and A.S

**📅 Jul 29, 2026** • **📰 OpenShift Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/sovereign-design-lessons-red-hat-summit)

---

## 💾 Databases

### 📄 AWS Transform for full-stack Windows modernization now supports offline schema transformation to Aurora PostgreSQL

Today, AWS Transform for full-stack Windows modernization announced general availability of offline source transformation, enabling customers to modernize Microsoft SQL Server databases to Amazon Auro

**📅 Aug 3, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/7/aws-transform-windows-sql-schema-aurora)

### 📄 Amazon Aurora DSQL adds multi-Region cluster support in four more Regions

Starting today, Amazon Aurora DSQL supports multi-Region clusters in four additional AWS Regions: Europe (Stockholm), Europe (Spain), Asia Pacific (Mumbai), and Asia Pacific (Singapore). Aurora DSQL i

**📅 Jul 31, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/07/amazon-aurora-dsql-adds-multi-region-clusters-four-more-regions/)

### 📄 How to Persist AI Agent Context Deterministically

Discover why standard MCP wiring makes context persistence optional (the model calls the tool only when it decides to) and what to do instead. We walk through how to treat persistence as control flow 

**📅 Jul 31, 2026** • **📰 Yugabyte Blog**

[**🔗 Read more**](https://www.yugabyte.com/blog/how-to-persist-ai-agent-context-deterministically/)

### 📄 plRuby

PL/Ruby is a procedural-language handler that lets you write database functions in Ruby, stored and executed inside PostgreSQL. You get the expressiveness of Ruby and its standard library with the ful

**📅 Jul 31, 2026** • **📰 PostgreSQL News**

[**🔗 Read more**](https://www.postgresql.org/about/news/plruby-3349/)

### 📄 Vector Search Meets Distributed SQL: Why Agentic AI Does Not Need Another Database

Key Takeaways Add a vector database to the existing stack. Sync it. Maintain it. Debug it when it drifts. Teams building agentic applications have largely accepted that sequence as the price of admiss

**📅 Jul 30, 2026** • **📰 TiDB Blog**

[**🔗 Read more**](https://www.pingcap.com/blog/vector-search-distributed-sql/)

### 📄 Context engineering for AI: what it is & how to build it

Your support agent confidently tells a customer they qualify for a refund under a 60-day return policy. Your actual policy is 30 days. The agent hallucinated the longer window, and the easy reaction i

**📅 Jul 29, 2026** • **📰 Redis Blog**

[**🔗 Read more**](https://redis.io/blog/context-engineering-ai/)

### 📄 Lessons Learned from Real-World NoSQL Database Migrations

Discover the strategies, challenges, and trade-offs teams faced in a few real-world migrations to ScyllaDB

**📅 Jul 28, 2026** • **📰 ScyllaDB Blog**

[**🔗 Read more**](https://www.scylladb.com/2026/07/28/lessons-learned-from-real-world-nosql-database-migrations/)

### 📄 TiDB Log Compaction: Faster Point-in-Time Recovery for Large Clusters

For a large distributed SQL cluster, backup and restore define whether the business can recover from an accident inside a realistic service objective. As TiDB adoption grows across larger, more write-

**📅 Jul 28, 2026** • **📰 TiDB Blog**

[**🔗 Read more**](https://www.pingcap.com/blog/tidb-log-compaction-faster-point-in-time-recovery-for-large-clusters/)

### 📄 Harness Database DevOps: Reference Data Rollbacks

Learn to version reference data with Liquibase OSS, automate deployments in Harness Database DevOps, and enable safe rollbacks. | Blog

**📅 Jul 28, 2026** • **📰 Harness Blog**

[**🔗 Read more**](https://www.harness.io/blog/harness-database-devops-reference-data-rollbacks)

### 📄 The 4 Failure Modes of Agent Context in Production

A production AI agent depends heavily on the context layer that tells it what to know at the moment it acts. It can pass every staging test, answer questions, call the right tools, and demo beautifull

**📅 Jul 28, 2026** • **📰 Redis Blog**

[**🔗 Read more**](https://redis.io/blog/the-4-failure-modes-of-agent-context/)

### 📄 Token-budget-aware LLM reasoning: cut costs in 2026

Reasoning models think before they answer, and those reasoning tokens are usually part of what you pay for. They're billed as output tokens, the expensive kind, and a single request can generate a few

**📅 Jul 28, 2026** • **📰 Redis Blog**

[**🔗 Read more**](https://redis.io/blog/token-budget-aware-llm-reasoning/)

---

## 🌐 Platforms

### 📄 Keep Your Tech Flame Alive: Trailblazer Rachel Bayley

In this Akamai FLAME Trailblazer blog post, Rachel Bayley encourages women to step into the unknown and to be their authentic selves.

**📅 Aug 3, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/culture/2024/may/keep-your-tech-flame-alive-trailblazer-rachel-bayley)

### 📄 The Oracle of Delphi Will Steal Your Credentials

Our deception technology is able to reroute attackers into honeypots, where they believe that they found their real target. The attacks brute forced passwords for RDP credentials to connect to the vic

**📅 Aug 3, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/security/the-oracle-of-delphi-steal-your-credentials)

### 📄 The Nansh0u Campaign – Hackers Arsenal Grows Stronger

In the beginning of April, three attacks detected in the Guardicore Global Sensor Network (GGSN) caught our attention. All three had source IP addresses originating in South-Africa and hosted by Volum

**📅 Aug 3, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/security/the-nansh0u-campaign-hackers-arsenal-grows-stronger)

### 📄 Real-world mainframe modernization with AI: A safe, scalable path from mainframe to cloud

For too long, enterprises with legacy mainframe estates have been faced with a high-stakes dilemma: continue maintaining their mainframes, essentially kicking the modernization can down the road (they

**📅 Aug 3, 2026** • **📰 Google Cloud Blog**

[**🔗 Read more**](https://cloud.google.com/blog/products/infrastructure-modernization/mainframe-migration-and-modernization-with-ai/)

### 📄 Cortex Framework v7 is GA: Build agentic workflows without disrupting SAP operations

Businesses want to quickly and safely deploy AI agents to drive revenue, mitigate risk, and optimize capital, all without disrupting mission-critical ERP systems. And to power AI agents, you need more

**📅 Aug 3, 2026** • **📰 Google Cloud Blog**

[**🔗 Read more**](https://cloud.google.com/blog/products/sap-google-cloud/cortex-framework-v7-power-ai-agents-with-sap-data-faster/)

### 📄 Unifying public and private data: Scale knowledge graphs with Data Commons on Spanner

To make informed decisions, businesses often need to connect their internal data with public reference data, to create a knowledge graph that connects real-world things and their relationships. Howeve

**📅 Aug 3, 2026** • **📰 Google Cloud Blog**

[**🔗 Read more**](https://cloud.google.com/blog/products/databases/unify-public-and-private-data-with-data-commons-on-spanner-graph/)

### 📄 Cloudflare Workers and Containers now support inbound TCP connections and gRPC

Cloudflare Workers now support inbound TCP connections via Spectrum, allowing direct socket forwarding to Durable Objects and Containers. Developers can run full-duplex gRPC applications or leverage a

**📅 Aug 3, 2026** • **📰 Cloudflare Blog**

[**🔗 Read more**](https://blog.cloudflare.com/grpc-workers/)

### 📄 Introducing the Billable Usage API: programmatic cost visibility for Cloudflare

Cloudflare has launched a new Billable Usage API for accounts, giving developers and FinOps teams single-endpoint programmatic visibility into cost and usage across all self-serve products. Built arou

**📅 Aug 3, 2026** • **📰 Cloudflare Blog**

[**🔗 Read more**](https://blog.cloudflare.com/billable-usage-api/)

### 📄 Smaller, faster, safer: running Kimi and GLM at scale

Serving frontier models like Kimi and GLM means fighting for GPU memory. Here's how we quantize KV caches, compress model weights, and add integrity checks to serve them faster, cheaper, and safely.

**📅 Aug 3, 2026** • **📰 Cloudflare Blog**

[**🔗 Read more**](https://blog.cloudflare.com/smaller-faster-safer-models/)

### 📄 Behind the scenes: How we build, test, and scale Google Agent Skills

AI agents are only as good as the instructions and context you give them. When we launched Google Agent Skills, our goal was simple: encode Google Cloud domain knowledge into structured, open-source i

**📅 Aug 3, 2026** • **📰 Google Cloud Blog**

[**🔗 Read more**](https://cloud.google.com/blog/topics/developers-practitioners/behind-the-scenes-how-we-build-test-and-scale-google-agent-skills/)

### 📄 How we made a viral commercial for developers

We made a commercial for Railway featuring the actor behind Gilfoyle from Silicon Valley. This is how we made it so that a developer like you would watch it.

**📅 Jul 31, 2026** • **📰 Railway Blog**

[**🔗 Read more**](https://blog.railway.com/p/how-to-make-viral-commercial)

### 📄 The Complete Package: Why Debugging Is Only Half the C# Productivity Story

As .NET developers, we need to iterate on our applications while building, and part of that developer inner loop is the debugging experience. The rise of multi-platform code editors further requires d

**📅 Jul 30, 2026** • **📰 JetBrains Blog**

[**🔗 Read more**](https://blog.jetbrains.com/dotnet/2026/07/30/the-complete-package-why-debugging-is-only-half-the-csharp-productivity-story/)

---

## 📰 Misc

### 📄 Unlocking agentic AI with Arm AGI CPU & SUSE AI Factory

SUSE collaborating with Arm for Day 0 readiness of the new Arm AGI CPU across SUSE portfolio Key takeaways Day 0 silicon innovation: The collaboration between SUSE and Arm highlights the ongoing work 

**📅 Aug 3, 2026** • **📰 SUSE Blog**

[**🔗 Read more**](https://www.suse.com/c/unlocking-agentic-ai-with-arm-agi-cpu-suse-ai-factory/)

### 📄 Learn pandas the Right Way: A Python Library Course That Doesn’t Waste Your Time

Let’s talk about the elephant in every data scientist’s room (or in this case, the panda). You’ve probably touched pandas before, even if nobody introduced you two properly. Ever opened a CSV file in 

**📅 Aug 3, 2026** • **📰 JetBrains Blog**

[**🔗 Read more**](https://blog.jetbrains.com/education/2026/08/03/mastering-pandas-python-course/)

### 📄 Ten Great DevOps Job Opportunities

DevOps.com is now providing a weekly DevOps jobs report through which opportunities for DevOps professionals will be highlighted as part of an effort to better serve our audience. Our goal in these ch

**📅 Aug 3, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/ten-great-devops-job-opportunities-17/)

### 📄 DeepSeek’s smaller model just outperformed its own flagship

DeepSeek has launched DeepSeek-V4-Flash-0731, delivering a significant boost in agent performance without changing the model’s core architecture. Following an announcement The post DeepSeek’s smaller 

**📅 Aug 3, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/deepseek-v4-flash-open-weights/)

### 📄 Our First Moves to Get AI Spend Under Control

Over the past six months at JetBrains, our AI development expenses have increased roughly 10x. When the costs started rising, of course we noticed – and realized that we simply didn’t know how to cont

**📅 Aug 3, 2026** • **📰 JetBrains Blog**

[**🔗 Read more**](https://blog.jetbrains.com/ai/2026/08/our-first-moves-to-get-ai-spend-under-control/)

### 📄 JetBrains Open-Sources KotlinLLM, a Research Prototype for Runtime Code Generation

JetBrains open-sources KotlinLLM, letting compiled Kotlin apps generate and persist LLM-written code at runtime instead of calling a model live.

**📅 Aug 3, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/jetbrains-open-sources-kotlinllm-a-research-prototype-for-runtime-code-generation/)

### 📄 GitHub Brings Stacked Pull Requests Out of the Shadows

GitHub introduces native stacked pull requests, helping development teams break large changes into smaller, dependency-ordered PRs that are faster and easier to review.

**📅 Aug 3, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/github-brings-stacked-pull-requests-out-of-the-shadows/)

### 📄 Dynamic troubleshooting with guarded command execution in the MCP server for Red Hat Enterprise Linux

Managing Red Hat Enterprise Linux (RHEL) environments can involve troubleshooting when issues occur. While generative AI offers a promising way to accelerate troubleshooting, standard large language m

**📅 Aug 3, 2026** • **📰 Red Hat Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/dynamic-troubleshooting-guarded-command-execution-mcp-server-red-hat-enterprise-linux)

### 📄 Designing APIs for agents

In early 2025, Webflow started building for MCP before there was a clear playbook for agent-ready APIs. We publicly announced The post Designing APIs for agents appeared first on The New Stack.

**📅 Aug 1, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/designing-apis-for-agents/)

### 📄 What Claude’s real-world breaches reveal about AI safety tests

This week, just days after OpenAI announced that two of its advanced AI models had interacted with real-world systems during The post What Claude’s real-world breaches reveal about AI safety tests app

**📅 Aug 1, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/anthropic-claude-containment-failure/)

### 📄 Know Kotlin? Ship It Everywhere and Win at Shipaton 2026

Somewhere in your notes there’s an app idea waiting for a free weekend that never comes. Consider this its official deadline: RevenueCat Shipaton 2026, the world’s biggest mobile hackathon, runs Augus

**📅 Jul 31, 2026** • **📰 JetBrains Blog**

[**🔗 Read more**](https://blog.jetbrains.com/kotlin/2026/07/know-kotlin-ship-it-everywhere-and-win-at-shipaton-2026/)

### 📄 Visual Studio Code 1.131

Learn what's new in Visual Studio Code 1.131 Read the full article

**📅 Jul 29, 2026** • **📰 VS Code Blog**

[**🔗 Read more**](https://code.visualstudio.com/updates/v1_131)
