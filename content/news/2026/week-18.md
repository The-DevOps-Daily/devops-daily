---
title: "DevOps Weekly Digest - Week 18, 2026"
date: "2026-04-27"
summary: "⚡ Curated updates from Kubernetes, cloud native tooling, CI/CD, IaC, observability, and security - handpicked for DevOps professionals!"
---

> 📌 **Handpicked by DevOps Daily** - Your weekly dose of curated DevOps news and updates!

---

## ⚓ Kubernetes

### 📄 Kubernetes v1.36: Fine-Grained Kubelet API Authorization Graduates to GA

On behalf of Kubernetes SIG Auth and SIG Node, we are pleased to announce the graduation of fine-grained kubelet API authorization to General Availability (GA) in Kubernetes v1.36! The KubeletFineGrai

**📅 Apr 24, 2026** • **📰 Kubernetes Blog**

[**🔗 Read more**](https://kubernetes.io/blog/2026/04/24/kubernetes-v1-36-fine-grained-kubelet-authorization-ga/)

### 📄 Customer stories and continued momentum: OpenShift Virtualization sessions at Red Hat Summit 2026

Disruption in the virtualization market has not slowed down. The fallout from industry licensing and packaging changes continues to push organizations into decisions they were not planning to make thi

**📅 Apr 24, 2026** • **📰 OpenShift Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/openshift-virtualization-sessions-red-hat-summit-2026)

### 📄 Kubernetes v1.36: User Namespaces in Kubernetes are finally GA

After several years of development, User Namespaces support in Kubernetes reached General Availability (GA) with the v1.36 release. This is a Linux-only feature. For those of us working on low level c

**📅 Apr 23, 2026** • **📰 Kubernetes Blog**

[**🔗 Read more**](https://kubernetes.io/blog/2026/04/23/kubernetes-v1-36-userns-ga/)

### 📄 SELinux Volume Label Changes goes GA (and likely implications in v1.37)

If you run Kubernetes on Linux with SELinux in enforcing mode, plan ahead: a future release (anticipated to be v1.37) is expected to turn the SELinuxMount feature gate on by default. This makes volume

**📅 Apr 22, 2026** • **📰 Kubernetes Blog**

[**🔗 Read more**](https://kubernetes.io/blog/2026/04/22/breaking-changes-in-selinux-volume-labeling/)

### 📄 Kubernetes v1.36: ハル (Haru)

Editors: Chad M. Crowell, Kirti Goyal, Sophia Ugochukwu, Swathi Rao, Utkarsh Umre Similar to previous releases, the release of Kubernetes v1.36 introduces new stable, beta, and alpha features. The con

**📅 Apr 22, 2026** • **📰 Kubernetes Blog**

[**🔗 Read more**](https://kubernetes.io/blog/2026/04/22/kubernetes-v1-36-release/)

### 📄 Auto-diagnosing Kubernetes alerts with HolmesGPT and CNCF tools

What a two-person SRE team learned building an AI investigation pipeline. Spoiler: the runbooks mattered more than the model. Why we built this At STCLab, our SRE team supports multiple Amazon EKS clu

**📅 Apr 21, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/04/21/auto-diagnosing-kubernetes-alerts-with-holmesgpt-and-cncf-tools/)

### 📄 How Skyscanner scales OpenTelemetry: managing collectors across 24 production clusters

The Developer Experience SIG is publishing a series of blog posts featuring real-world OpenTelemetry deployments from companies across different industries and scales. This post features Skyscanner, a

**📅 Apr 21, 2026** • **📰 OpenTelemetry Blog**

[**🔗 Read more**](https://opentelemetry.io/blog/2026/devex-skyscanner/)

---

## ☁️ Cloud Native

### 📄 Trivy, KICS, and the shape of supply chain attacks so far in 2026

Catching the KICS push: what happened, and the case for open, fast collaboration In the past few weeks we've worked through two supply chain compromises on Docker Hub with a similar shape: first Trivy

**📅 Apr 23, 2026** • **📰 Docker Blog**

[**🔗 Read more**](https://www.docker.com/blog/trivy-kics-and-the-shape-of-supply-chain-attacks-so-far-in-2026/)

### 📄 GitOps with IBM Kubecost: API Driven Rightsizing

Introduction When using IBM Kubecost, the UI clearly shows valuable insights on running workloads more efficiently through Container Request Right-Sizing Recommendations. Inevitably, someone asks: “We

**📅 Apr 23, 2026** • **📰 Kubecost Blog**

[**🔗 Read more**](https://www.apptio.com/blog/gitops-with-ibm-kubecost-api-driven-rightsizing/)

### 📄 Zabbix and the Docker API, Part 1: Inspect

In this blog post, I will show you how to configure Zabbix to securely gather Docker API metrics using the Zabbix HTTP agent item with certificate authentication. This guide will cover configuring the

**📅 Apr 22, 2026** • **📰 Zabbix Blog**

[**🔗 Read more**](https://blog.zabbix.com/zabbix-and-the-docker-api-part-1-inspect/32860/)

### 📄 AI Observability in Grafana Cloud: A complete solution for monitoring your agentic workloads

The observability industry has developed great tools for using metrics, logs, traces, and profiles to monitor the cloud native applications that have dominated the last decade of software development.

**📅 Apr 21, 2026** • **📰 Grafana Blog**

[**🔗 Read more**](https://grafana.com/blog/ai-observability-for-agents-in-grafana-cloud/)

---

## 🔄 CI/CD

### 📄 curl removed from Omnibus-GitLab FIPS packages in 19.0

Starting with Omnibus-GitLab 19.0 (and the subsequent patch release to existing supported versions), FIPS packages will no longer include a GitLab-built version of curl. Instead, they will use the cur

**📅 Apr 24, 2026** • **📰 GitLab Blog**

[**🔗 Read more**](https://about.gitlab.com/blog/curl-removed-from-omnibus-gitlab-fips-packages-in-19-0/)

### 📄 AI in DevOps: Why Adoption Lags in CI/CD (and What Comes Next)

AI is everywhere except in CI/CD Developers now use AI for nearly everything, except the part that actually ships code. Recent surveys conducted by JetBrains indicate that AI is now widely used in sof

**📅 Apr 23, 2026** • **📰 JetBrains Blog**

[**🔗 Read more**](https://blog.jetbrains.com/teamcity/2026/04/ai-in-devops/)

### 📄 The Agent Loop is the New OS

The Harness MCP server treats the AI agent loop as an operating system, mapping the LLM to the CPU and the Context Window to RAM. Learn how this design uses 10 generic, composable tools to abstract co

**📅 Apr 23, 2026** • **📰 Harness Blog**

[**🔗 Read more**](https://www.harness.io/blog/agent-loop-new-os)

### 📄 GitLab AI Hackathon 2026: Meet the winners

AI writes code. That is expected now. But planning, security, compliance, and deployments? Those gaps remain. I have run contributor programs for years. I have never seen a community respond to techno

**📅 Apr 22, 2026** • **📰 GitLab Blog**

[**🔗 Read more**](https://about.gitlab.com/blog/gitlab-ai-hackathon-2026-meet-the-winners/)

### 📄 GitLab Patch Release: 18.11.1, 18.10.4, 18.9.6

Discover what's in this latest patch release.

**📅 Apr 22, 2026** • **📰 GitLab Blog**

[**🔗 Read more**](https://docs.gitlab.com/releases/patches/patch-release-gitlab-18-11-1-released/)

### 📄 Gitea 1.26.1 is released

We are excited to announce the release of Gitea 1.26.1! We strongly recommend all users upgrade to this version, as it includes important fixes that address several significant issues since 1.26.0 and

**📅 Apr 21, 2026** • **📰 Gitea Blog**

[**🔗 Read more**](https://blog.gitea.com/release-of-1.26.1)

### 📄 LLM Pricing Comparison: Tutorial & Best Practices

Large Language Models (LLMs) power a wide range of AI applications today.

**📅 Apr 21, 2026** • **📰 LaunchDarkly Blog**

[**🔗 Read more**](https://launchdarkly.com/blog/llm-pricing-comparison/)

### 📄 GitLab + Amazon: Platform orchestration on a trusted AI foundation

If your team runs GitLab and has a strong AWS practice, a new combination of Duo Agent Platform and Amazon Bedrock is just for you. The model is simple: GitLab acts as your orchestration layer to help

**📅 Apr 21, 2026** • **📰 GitLab Blog**

[**🔗 Read more**](https://about.gitlab.com/blog/gitlab-amazon-platform-orchestration-on-a-trusted-ai-foundation/)

### 📄 Changes to GitHub Copilot Individual plans

We're making these changes to ensure a reliable and predictable experience for existing customers. The post Changes to GitHub Copilot Individual plans appeared first on The GitHub Blog.

**📅 Apr 20, 2026** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/news-insights/company-news/changes-to-github-copilot-individual-plans/)

### 📄 Highlights from Git 2.54

The open source Git project just released Git 2.54. Here is GitHub’s look at some of the most interesting features and changes introduced since last time. The post Highlights from Git 2.54 appeared fi

**📅 Apr 20, 2026** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/open-source/git/highlights-from-git-2-54/)

---

## 🏗️ IaC

### 📄 Building a Center of Excellence for Ansible

As Ansible adoption grows, a challenge can arise: How do organizations track automation efforts across the entire enterprise? A common solution is to establish a Center of Excellence (CoE) for Ansible

**📅 May 8, 2026** • **📰 Red Hat Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/building-center-excellence-ansible)

### 📄 Policy Packs Can Now Access Pulumi ESC Environments

Policy authors who need external credentials or environment-specific configuration have had to hardcode values or manage them outside of Pulumi. Policy packs can now reference Pulumi ESC environments,

**📅 Apr 23, 2026** • **📰 Pulumi Blog**

[**🔗 Read more**](https://www.pulumi.com/blog/policy-packs-can-now-access-pulumi-esc-environments/)

### 📄 How to Install Terraform Securely for Scalable Automation

Learn how to use Terraform securely and at scale. Discover ways to automate, manage, and speed up your infrastructure delivery. Get started with a secure setup today. | Blog

**📅 Apr 22, 2026** • **📰 Harness Blog**

[**🔗 Read more**](https://www.harness.io/blog/how-to-install-terraform-for-secure-and-scalable-infrastructure-automation)

### 📄 Agent Sprawl Is Here. Your IaC Platform Is the Answer.

Somewhere in your company right now, a developer is building an AI agent. Maybe it’s a release agent that cuts tags when tests pass. Maybe it’s a cost agent that shuts down idle EC2 overnight. It’s ru

**📅 Apr 22, 2026** • **📰 Pulumi Blog**

[**🔗 Read more**](https://www.pulumi.com/blog/agent-sprawl-iac-platform-is-the-answer/)

---

## 📊 Observability

### 📄 DigitalOcean Dedicated Inference: A Technical Deep Dive

Getting a model to answer 10 inference requests concurrently is tricky but simple enough; getting it to handle 2,000 engineers hitting a coding assistant with long contexts, all day, without runaway c

**📅 Apr 25, 2026** • **📰 DigitalOcean Blog**

[**🔗 Read more**](https://www.digitalocean.com/blog/dedicated-inference-technical-deep-dive)

### 📄 Beyond the Abyss Project Poseidon’s Quest for Zero-Downtime Reliability

In large-scale cloud environments, unpredictable hypervisor crashes carry real operational cost. While traditional reactive monitoring that relies on static thresholds and post-hoc alerts were once th

**📅 Apr 23, 2026** • **📰 DigitalOcean Blog**

[**🔗 Read more**](https://www.digitalocean.com/blog/project-poseidon-zero-downtime-reliability)

### 📄 Deprecating OpenTracing compatibility requirements

On March 19, 2026, the OpenTelemetry Specification project merged PR #4938, deprecating OpenTracing compatibility requirements in the specification. This change updates the specification to match wher

**📅 Apr 23, 2026** • **📰 OpenTelemetry Blog**

[**🔗 Read more**](https://opentelemetry.io/blog/2026/deprecating-opentracing-compatibility/)

### 📄 When agents orchestrate agents, who's watching?

Multi-agent AI systems fail silently. Learn what proper observability looks like when agents orchestrate agents, and how Sentry keeps you in control.

**📅 Apr 23, 2026** • **📰 Sentry Blog**

[**🔗 Read more**](https://blog.sentry.io/scaling-observability-for-multi-agent-ai-systems/)

### 📄 Structuring AI Evaluation and Observability with MLflow: From Development to Production

Shipping your first AI agent or LLM application feels fulfilling until you have to make changes because it does not work as you intended. Most of us start the same way: we test a few prompts, the resu

**📅 Apr 22, 2026** • **📰 MLflow Blog**

[**🔗 Read more**](https://mlflow.org/blog/structured-ai-eval/)

### 📄 The Great Stream Fix: Interleaving Writes in Seastar with AI-Powered Invariants Tracing

How we used AI-assisted invariant-based testing to locate and resolve tricky hidden bugs with complex state transitions

**📅 Apr 21, 2026** • **📰 ScyllaDB Blog**

[**🔗 Read more**](https://www.scylladb.com/2026/04/21/interleaving-writes-in-seastar/)

### 📄 Introducing Pyroscope 2.0: faster, more cost-effective continuous profiling at scale

Continuous profiling is becoming a standard part of the observability stack, and for good reason. It's the only signal that tells you why your code is slow or expensive, not just that it is. Metrics t

**📅 Apr 21, 2026** • **📰 Grafana Blog**

[**🔗 Read more**](https://grafana.com/blog/pyroscope-2-0-release/)

### 📄 Introducing o11y-bench: an open benchmark for AI agents running observability workflows

Evaluating agents is hard. Verifying observability tasks is harder. Yes, AI agents have gotten dramatically and quantifiably better at coding and tool use, but observability presents a different kind 

**📅 Apr 21, 2026** • **📰 Grafana Blog**

[**🔗 Read more**](https://grafana.com/blog/o11y-bench-open-benchmark-for-observability-agents/)

### 📄 Grafana Assistant everywhere: Customize and connect to the AI agent to fit your specific needs

The ways you and your teams build and observe your systems are changing. It’s no longer just engineers looking at dashboards, or writing queries or config files. More often, it’s an agent interacting 

**📅 Apr 21, 2026** • **📰 Grafana Blog**

[**🔗 Read more**](https://grafana.com/blog/grafana-assistant-everywhere/)

### 📄 No more monkey-patching: Better observability with tracing channels

Find out how Node.js Tracing Channels enable libraries to emit their own telemetry, replacing monkey-patching and fixing ESM observability.

**📅 Apr 21, 2026** • **📰 Sentry Blog**

[**🔗 Read more**](https://blog.sentry.io/observability-with-tracing-channels/)

---

## 🔐 Security

### 📄 Threats Making WAVs - Incident Response to a Cryptomining Attack

Guardicore security researchers describe and uncover a full analysis of a cryptomining attack, which hid a cryptominer inside WAV files. The report includes the full attack vectors, from detection, in

**📅 Apr 27, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/security/threats-making-wavs-incident-reponse-cryptomining-attack)

### 📄 Ubuntu 16.04 LTS has reached the end of standard Expanded Security Maintenance with Ubuntu Pro. Here are your options.

Ubuntu 16.04 LTS (Xenial Xerus) reached the end of its five-year Expanded Security Maintenance (ESM) window in April 2026. If you are still running 16.04, it is critical to address your support status

**📅 Apr 27, 2026** • **📰 Ubuntu Blog**

[**🔗 Read more**](https://ubuntu.com//blog/ubuntu-16-04-lts-has-reached-the-end-of-standard-expanded-security-maintenance-with-ubuntu-pro-here-are-your-options)

### 📄 Microsoft Turns to Anthropic’s Mythos to Improve Cyber Defense

Microsoft has unveiled plans to incorporate Anthropic’s Claude Mythos Preview model and other AI models into its Security Development Lifecycle, embedding AI directly into the stages where code is wri

**📅 Apr 24, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/microsoft-turns-to-anthropics-mythos-to-improve-cyber-defense/)

### 📄 Take Control of AI Code Quality in CI: Live Demo

AI is accelerating coding, but without the right checks, it can also introduce risk, inconsistency, and hidden issues into your codebase. Businesses are offering “total automation” and “AI-driven chec

**📅 Apr 24, 2026** • **📰 JetBrains Blog**

[**🔗 Read more**](https://blog.jetbrains.com/qodana/2026/04/take-control-of-ai-code-quality-in-ci-live-demo/)

### 📄 Confidential clusters for Red Hat OpenShift: Developer Preview now available on Microsoft Azure with AMD SEV-SNP

Extending confidential computing from individual workloads to the entire cluster is a new frontier in cloud-native security.Today, Red Hat is announcing the Developer Preview of confidential clusters 

**📅 Apr 24, 2026** • **📰 OpenShift Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/confidential-clusters-red-hat-openshift-developer-preview-now-available-microsoft-azure-amd-sev-snp)

### 📄 Canonical releases Ubuntu 26.04 LTS Resolute Raccoon

The 11th long-term supported release of Ubuntu delivers deep silicon optimization and state-of-the-art security for enterprise workloads.

**📅 Apr 23, 2026** • **📰 Ubuntu Blog**

[**🔗 Read more**](https://ubuntu.com//blog/canonical-releases-ubuntu-26-04-lts-resolute-raccoon)

### 📄 From Ingress NGINX to Higress: migrating 60+ resources in 30 minutes with AI

With the official retirement of Ingress NGINX that took place in March 2026, enterprise platform teams are facing an urgent security and compliance mandate. Remaining on a retired controller leaves cr

**📅 Apr 23, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/04/23/from-ingress-nginx-to-higress-migrating-60-resources-in-30-minutes-with-ai/)

### 📄 Hardcoding Security into Every Commit: The Future of Snyk Secrets

Snyk Secrets bridges the gap between code and credentials with real-time, high-precision detection, ensuring your most sensitive data stays hidden while your developers stay fast.

**📅 Apr 23, 2026** • **📰 Snyk Blog**

[**🔗 Read more**](https://snyk.io/blog/future-snyk-secrets/)

### 📄 JPMorgan Just Published a Cyber To-Do List and Snyk Covers 8 of the 10 Items. How do you stack up?

JPMorganChase published a 10-point cyber resilience checklist. See how Snyk covers 8 of the 10 actions and where it fits in your security stack.

**📅 Apr 23, 2026** • **📰 Snyk Blog**

[**🔗 Read more**](https://snyk.io/blog/snyk-covers-jpmorgan-cyber-list/)

### 📄 SQL Management Studio for PostgreSQL 2.0 Is Here — Faster, Safer, and More Efficient

We are excited to announce the release of SQL Management Studio for PostgreSQL 2.0 — a major update to our database management and administration solution. This version introduces a more intuitive vis

**📅 Apr 23, 2026** • **📰 PostgreSQL News**

[**🔗 Read more**](https://www.postgresql.org/about/news/sql-management-studio-for-postgresql-20-is-here-faster-safer-and-more-efficient-3280/)

### 📄 Building the agentic cloud: everything we launched during Agents Week 2026

Agents Week 2026 is a wrap. Let’s take a look at everything we announced, from compute and security to the agent toolbox, platform tools, and the emerging agentic web. Everything we shipped for the ag

**📅 Apr 20, 2026** • **📰 Cloudflare Blog**

[**🔗 Read more**](https://blog.cloudflare.com/agents-week-in-review/)

---

## 💾 Databases

### 📄 Native OpenTelemetry metrics for Redis client libraries

When Redis server metrics look healthy but an application isn’t performing adequately (for instance, service time outs or p99 latency climbing for no obvious reason) the explanation is often not insid

**📅 Apr 24, 2026** • **📰 Redis Blog**

[**🔗 Read more**](https://redis.io/blog/native-opentelemetry-metrics-for-redis-client-libraries/)

### 📄 4 DynamoDB Configuration Changes for Significant Cost Savings

Learn about ways to cut DynamoDB costs with minimal code changes, zero migration, and no architectural upheaval.

**📅 Apr 23, 2026** • **📰 ScyllaDB Blog**

[**🔗 Read more**](https://www.scylladb.com/2026/04/23/4-dynamodb-configuration-changes-for-significant-cost-savings/)

### 📄 TiDB and the Rise of the AI-Native Database

Editor’s note: This post originally appeared on The New Stack and is republished with permission. The original version is available here. When enterprises talk about artificial intelligence, the atten

**📅 Apr 23, 2026** • **📰 TiDB Blog**

[**🔗 Read more**](https://www.pingcap.com/blog/ai-native-database/)

### 📄 storage_engine 1.0.7 – columnar + row-compressed Table Access Methods for PostgreSQL 16-18

Hi, I'd like to announce storage_engine 1.0.7, a PostgreSQL extension providing two high-performance Table Access Methods: colcompress: column-oriented compressed storage with vectorized execution, ch

**📅 Apr 23, 2026** • **📰 PostgreSQL News**

[**🔗 Read more**](https://www.postgresql.org/about/news/storage_engine-107-columnar-row-compressed-table-access-methods-for-postgresql-16-18-3279/)

### 📄 How to test & reduce Time to First Byte (TTFB)

If your pages feel sluggish, Time to First Byte (TTFB) is often where to look first. TTFB measures how long the browser waits before the server sends anything back. That wait sits at the front of the 

**📅 Apr 23, 2026** • **📰 Redis Blog**

[**🔗 Read more**](https://redis.io/blog/time-to-first-byte-test/)

### 📄 Human in the loop: Why your production AI systems need human oversight

Your AI agent can make tool calls, chain tools, and execute tasks independently. It can also hallucinate a policy that doesn't exist, execute a destructive SQL query that deletes production data, or c

**📅 Apr 23, 2026** • **📰 Redis Blog**

[**🔗 Read more**](https://redis.io/blog/ai-human-in-the-loop/)

### 📄 Client-side geographic failover for Redis Active-Active

The Redis Active-Active architecture supports geographically distributed applications, providing real-time performance when apps are co-located with an Active-Active database member and ensuring stron

**📅 Apr 23, 2026** • **📰 Redis Blog**

[**🔗 Read more**](https://redis.io/blog/client-side-geographic-failover-for-redis-active-active/)

### 📄 Shrinking the Search: Introducing ScyllaDB Vector Quantization

Learn how ScyllaDB Vector Quantization shrinks your vector index memory by up to 30x for cost-efficient, real-time AI applications

**📅 Apr 22, 2026** • **📰 ScyllaDB Blog**

[**🔗 Read more**](https://www.scylladb.com/2026/04/22/scylladb-vector-quantization/)

### 📄 How Retail at Scale Exposes Data Architecture Limitations

Retail and e-commerce platforms are among the most demanding distributed systems in production. Learn why traditional retail and e-commerce database architecture fails at scale and how a distributed d

**📅 Apr 21, 2026** • **📰 Yugabyte Blog**

[**🔗 Read more**](https://www.yugabyte.com/blog/retail-at-scale-exposes-data-architecture-limitations/)

---

## 🌐 Platforms

### 📄 Keep Your Tech Flame Alive: Trailblazer Rachel Bayley

In this Akamai FLAME Trailblazer blog post, Rachel Bayley encourages women to step into the unknown and to be their authentic selves.

**📅 Apr 27, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/culture/2024/may/keep-your-tech-flame-alive-trailblazer-rachel-bayley)

### 📄 The Oracle of Delphi Will Steal Your Credentials

Our deception technology is able to reroute attackers into honeypots, where they believe that they found their real target. The attacks brute forced passwords for RDP credentials to connect to the vic

**📅 Apr 27, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/security/the-oracle-of-delphi-steal-your-credentials)

### 📄 The Nansh0u Campaign – Hackers Arsenal Grows Stronger

In the beginning of April, three attacks detected in the Guardicore Global Sensor Network (GGSN) caught our attention. All three had source IP addresses originating in South-Africa and hosted by Volum

**📅 Apr 27, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/security/the-nansh0u-campaign-hackers-arsenal-grows-stronger)

### 📄 AWS Transform custom: Enterprise Code Modernization with the Learn-Scale-Improve Flywheel

Enterprise modernization has reached an inflection point. You can transform one repository easily. Existing tools, including AWS Transform custom, work well for individual repositories, and the proces

**📅 Apr 27, 2026** • **📰 AWS DevOps Blog**

[**🔗 Read more**](https://aws.amazon.com/blogs/devops/aws-transform-custom-enterprise-code-modernization-with-the-learn-scale-improve-flywheel/)

### 📄 The one Slack message that proved our elite engineering team was flying blind

Someone posted a question in Slack that seemed straightforward: What are we actually running across both cloud environments? Not what The post The one Slack message that proved our elite engineering t

**📅 Apr 26, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/multi-cloud-blind-spots/)

### 📄 AWS Lambda Provisioned Mode for Kafka event source mappings (ESMs) now available in AWS Asia Pacific (Taipei) and AWS GovCloud (US) Regions

AWS Lambda now supports Provisioned Mode for event source mappings (ESMs) that subscribe to Apache Kafka event sources in the Asia Pacific (Taipei), AWS GovCloud (US-East), and AWS GovCloud (US-West) 

**📅 Apr 24, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/04/aws-Lambda-provisioned-esm-region-expansion/)

### 📄 Amazon Quick now integrates with Visier’s Vee agent for workforce intelligence

Amazon Quick now integrates with Vee, the AI assistant from Visier's people analytics platform, through the model context protocol (MCP). HR business partners, finance managers, and operations leaders

**📅 Apr 24, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/04/amazon-quick-visier-vee/)

### 📄 Amazon Bedrock AgentCore Gateway and Identity support VPC egress

Amazon Bedrock AgentCore Gateway and Identity now provide secure and controlled egress traffic management for your applications, enabling seamless communication with resources in your Virtual Private 

**📅 Apr 24, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2024/04/agentcore-gateway-identity-vpc/)

### 📄 260 things we announced at Google Cloud Next '26 – a recap

Google Cloud Next ‘26 took place this week in Las Vegas, and the energy was incredible as we welcomed over 32,000 leaders, developers, and partners to explore the Agentic Era with us. Across three key

**📅 Apr 24, 2026** • **📰 Google Cloud Blog**

[**🔗 Read more**](https://cloud.google.com/blog/topics/google-cloud-next/google-cloud-next-2026-wrap-up/)

### 📄 Amazon EC2 High Memory U7i instances now available in additional regions

Amazon EC2 High Memory U7i-8TB instances (u7i-8tb.112xlarge) are now available in AWS Europe (Stockholm, Zurich) regions, U7in-16TB instances (u7in-16tb.224xlarge) are now available in the AWS US East

**📅 Apr 24, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/04/amazon-ec2-high-memory-u7i/)

### 📄 What’s new with Google Cloud

Want to know the latest from Google Cloud? Find it here in one handy location. Check back regularly for our newest updates, announcements, resources, events, learning opportunities, and more. Tip: Not

**📅 Apr 24, 2026** • **📰 Google Cloud Blog**

[**🔗 Read more**](https://cloud.google.com/blog/topics/inside-google-cloud/whats-new-google-cloud/)

### 📄 Axios npm Supply Chain Compromise – Guidance for Azure Pipelines Customers

On March 31, 2026, malicious versions of the widely used JavaScript HTTP client library Axios were briefly published to the npm registry as part of a supply chain attack. The affected versions — 1.14.

**📅 Apr 24, 2026** • **📰 Azure DevOps Blog**

[**🔗 Read more**](https://devblogs.microsoft.com/devops/axios-npm-supply-chain-compromise-guidance-for-azure-pipelines-customers/)

---

## 📰 Misc

### 📄 Visual Studio Code 1.118

Learn what's new in Visual Studio Code 1.118 (Insiders) Read the full article

**📅 Apr 29, 2026** • **📰 VS Code Blog**

[**🔗 Read more**](https://code.visualstudio.com/updates/v1_118)

### 📄 Understanding disaggregated GenAI model serving with llm-d

What is llm-d? llm-d is an open source solution for managing high-scale, high-performance Large Language Model (LLM) deployments. LLMs are at the heart of generative AI – so when you chat with ChatGPT

**📅 Apr 27, 2026** • **📰 Ubuntu Blog**

[**🔗 Read more**](https://ubuntu.com//blog/understanding-disaggregated-genai-model-serving-with-llm-d)

### 📄 Microsoft Foundry Tackles the AI Agent Tool Problem Nobody Talks About

Tool sprawl is quietly becoming one of the biggest headaches in enterprise AI development. Microsoft thinks it has a fix.

**📅 Apr 27, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/microsoft-foundry-tackles-the-ai-agent-tool-problem-nobody-talks-about/)

### 📄 The disappearing AI middle class

In 24 hours last week, OpenAI and DeepSeek made opposite bets on what frontier AI is worth. One says it The post The disappearing AI middle class appeared first on The New Stack.

**📅 Apr 26, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/disappearing-ai-middle-class/)

### 📄 Beyond prompting: How KubeStellar reached 81% PR acceptance with AI agents

The surprise in building KubeStellar Console with coding agents was not the extent of the model’s capabilities, but the heavy The post Beyond prompting: How KubeStellar reached 81% PR acceptance with 

**📅 Apr 26, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/ai-codebase-maturity-model/)

### 📄 How to find and unlock the data hidden within videos

Video is everywhere in today’s world, and more video content is being pumped out than ever before. It is estimated The post How to find and unlock the data hidden within videos appeared first on The N

**📅 Apr 26, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/build-video-search-vespa/)

### 📄 How Static Code Analysis Helps Reduce Software Bugs, and Money Spent!

Dealing with bugs is a natural part of software development. But it can also be among the most costly, especially when they don’t get discovered until later in the development lifecycle. The daunting 

**📅 Apr 26, 2026** • **📰 JetBrains Blog**

[**🔗 Read more**](https://blog.jetbrains.com/qodana/2026/04/reduce-software-bugs-and-money-spent/)

### 📄 Why Contact Enrichment Belongs in Your Application Architecture, Not Your Sales Workflow

Most B2B applications collect incomplete data by design. A lead form captures a name and company. A recruiting tool surfaces a LinkedIn profile. An event registration system logs an email address and 

**📅 Apr 24, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/why-contact-enrichment-belongs-in-your-application-architecture-not-your-sales-workflow/)

### 📄 Claude’s Code Quality Conundrum Continues

Anthropic admits to a month-long degradation in Claude's output due to reasoning "effort" tradeoffs, cache bugs, and verbosity prompts. As Opus 4.7 rolls out with mixed developer reviews, the company 

**📅 Apr 24, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/claudes-code-quality-conundrum-continues/)

### 📄 Confidential guest reset on QEMU hypervisor: Design choices and approach

Looking at the release notes or changelogs for QEMU upstream, you might notice that there's something new in version 11.0:SEV-SNP and TDX machines can now be reset.This is a feature we at Red Hat help

**📅 Apr 24, 2026** • **📰 Red Hat Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/confidential-guest-reset-qemu-hypervisor-design-choices-and-approach)

### 📄 SUSECON 2026 Wrap-Up: Choice Happened in Prague

What a week in Prague! This city has a way of making big ideas feel possible, and SUSECON 2026 met that energy from the very first keynote. As I sit here catching my breath (and catching up on my slee

**📅 Apr 23, 2026** • **📰 SUSE Blog**

[**🔗 Read more**](https://www.suse.com/c/susecon-2026-wrap-up-choice-happened-in-prague/)

### 📄 IntelliJ IDEA 2026.1.1 Is Out!

IntelliJ IDEA 2026.1.1 has arrived with several valuable fixes. You can update to this version from inside the IDE, using the Toolbox App, or using snaps if you are a Ubuntu user. You can also downloa

**📅 Apr 23, 2026** • **📰 JetBrains Blog**

[**🔗 Read more**](https://blog.jetbrains.com/idea/2026/04/intellij-idea-2026-1-1/)
