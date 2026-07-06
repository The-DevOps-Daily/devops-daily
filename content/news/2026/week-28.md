---
title: "DevOps Weekly Digest - Week 28, 2026"
date: "2026-07-06"
summary: "⚡ Curated updates from Kubernetes, cloud native tooling, CI/CD, IaC, observability, and security - handpicked for DevOps professionals!"
---

> 📌 **Handpicked by DevOps Daily** - Your weekly dose of curated DevOps news and updates!

---

## ⚓ Kubernetes

### 📄 CloudNativePG 1.30.0 Released!

The CloudNativePG Community is excited to announce the immediate availability of CloudNativePG 1.30.0! This minor release introduces the new DatabaseRole CRD for declarative, GitOps-friendly PostgreSQ

**📅 Jul 6, 2026** • **📰 PostgreSQL News**

[**🔗 Read more**](https://www.postgresql.org/about/news/cloudnativepg-1300-released-3337/)

### 📄 Beyond the baseline: Introducing the Digital Sovereignty Readiness Appraisal

Since February, over 1,500 organizations have used Red Hat's complimentary Digital Sovereignty Readiness Assessment to establish a sovereignty baseline in 15 minutes. Today we're introducing the Digit

**📅 Jul 3, 2026** • **📰 OpenShift Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/beyond-baseline-introducing-digital-sovereignty-readiness-appraisal)

### 📄 BackendTLSPolicy expands Gateway API transport security

BackendTLSPolicy is a Kubernetes resource that allows the specification of additional Transport Layer Security (TLS) encryption in Gateway API. It gives Gateway API users on Red Hat OpenShift access t

**📅 Jul 3, 2026** • **📰 OpenShift Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/backendtlspolicy-expands-gateway-api-transport-security)

### 📄 Diagnose Kubernetes Control Plane Performance Issues with AWS DevOps Agent

This post demonstrates how AWS DevOps Agent diagnoses Amazon Elastic Kubernetes Service (Amazon EKS) API server performance degradation, specifically 429 throttling and API Priority and Fairness (APF)

**📅 Jul 2, 2026** • **📰 AWS Containers Blog**

[**🔗 Read more**](https://aws.amazon.com/blogs/containers/diagnose-kubernetes-control-plane-performance-issues-with-aws-devops-agent/)

### 📄 (re)introducing kpt: Your toolchain for infrastructure automation

What is kpt? The opening tagline of the kpt documentation describes it as “… a package-centric toolchain that enables a WYSIWYG configuration authoring, automation, and delivery experience, which simp

**📅 Jul 2, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/07/02/reintroducing-kpt-your-toolchain-for-infrastructure-automation/)

### 📄 Announcing Amazon EKS Rollback for safe and reliable management of cluster upgrades

Today, we’re announcing Amazon EKS Version Rollback, a new capability that allows cluster administrators to safely roll back Kubernetes version upgrades on Amazon Elastic Kubernetes Service (Amazon EK

**📅 Jul 1, 2026** • **📰 AWS Containers Blog**

[**🔗 Read more**](https://aws.amazon.com/blogs/containers/announcing-amazon-eks-rollback-for-safe-and-reliable-management-of-cluster-upgrades/)

---

## ☁️ Cloud Native

### 📄 The 4-body problem of SRE: Why autonomous operations depend on context

What a room full of senior SREs confirmed about the trust gap, and where the actual work begins I spent a day last week at an event in Bengaluru asking a room full of senior SREs,...

**📅 Jul 6, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/07/06/the-4-body-problem-of-sre-why-autonomous-operations-depend-on-context/)

### 📄 How data sovereignty is changing cloud native infrastructure design

The core issue isn’t where your server sits. It’s who can be compelled to hand over what’s on it. For years, cloud providers treated sovereignty as a geography problem. Pick a region. Choose a country

**📅 Jul 3, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/07/03/how-data-sovereignty-is-changing-cloud-native-infrastructure-design/)

### 📄 Introducing Red Hat OpenShift Service Mesh 3.4

Red Hat OpenShift Service Mesh 3.4 is generally available with Red Hat OpenShift and Red Hat OpenShift Platform Plus. Based on the Istio, Envoy, and Kiali projects, this release updates the version of

**📅 Jul 2, 2026** • **📰 OpenShift Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/introducing-red-hat-openshift-service-mesh-34)

### 📄 Why AI Agents Need Isolation

Learn why AI agent isolation matters, how Docker SBX enables safer AI workflows, and how Sandbox Kits help. Written by Docker Captain Karan Verma.

**📅 Jul 1, 2026** • **📰 Docker Blog**

[**🔗 Read more**](https://www.docker.com/blog/why-ai-agents-need-isolation/)

### 📄 Etcd July Patch Releases: v3.5.32 and v3.6.13

SIG-etcd has released routine patch updates for the v3.5 and v3.6 release branches. These releases address dependency CVEs, fix a websocket authentication bug, and add a new option to help operators c

**📅 Jul 1, 2026** • **📰 etcd Blog**

[**🔗 Read more**](https://etcd.io/blog/2026/july-patch-release/)

---

## 🔄 CI/CD

### 📄 How CloudFormation express mode accelerates your development cycle

AWS CloudFormation helps you model and provision cloud infrastructure as code using JSON or YAML templates, or through tools like the AWS Cloud Development Kit (CDK) and AWS Serverless Application Mod

**📅 Jul 2, 2026** • **📰 AWS DevOps Blog**

[**🔗 Read more**](https://aws.amazon.com/blogs/devops/how-cloudformation-express-mode-accelerates-your-development-cycle/)

### 📄 How GitHub used secret scanning to reach inbox zero

GitHub had 20,000+ secret scanning alerts across 15,000 repositories. Here's how we separated signal from noise, built remediation workflows, and reached inbox zero in nine months. The post How GitHub

**📅 Jul 2, 2026** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/security/application-security/how-github-used-secret-scanning-to-reach-inbox-zero/)

### 📄 GitLab Patch Release: 18.8.11



**📅 Jul 1, 2026** • **📰 GitLab Blog**

[**🔗 Read more**](https://docs.gitlab.com/releases/patches/patch-release-gitlab-18-8-11-released/)

### 📄 Ship infrastructure faster with CloudFormation and CDK pre-deployment validation on every stack operation

AWS CloudFormation helps you model and provision cloud infrastructure as code using JSON or YAML templates, or through tools like the AWS Cloud Development Kit (CDK). Whether you create stacks directl

**📅 Jun 30, 2026** • **📰 AWS DevOps Blog**

[**🔗 Read more**](https://aws.amazon.com/blogs/devops/ship-infrastructure-faster-with-cloudformation-and-cdk-pre-deployment-validation-on-every-stack-operation/)

### 📄 Blog: Announcing Flux 2.9 GA

We are thrilled to announce the release of Flux v2.9.0! In this post, we highlight some of the new features and improvements included in this release. Highlights Flux v2.9 introduces the Flux CLI Plug

**📅 Jun 30, 2026** • **📰 Flux CD Blog**

[**🔗 Read more**](https://fluxcd.io/blog/2026/06/flux-v2.9.0/)

### 📄 Gitea Runner 2.0.0 is released

We are happy to announce the release of Gitea Runner 2.0.0.

**📅 Jun 30, 2026** • **📰 Gitea Blog**

[**🔗 Read more**](https://blog.gitea.com/release-of-runner-2.0.0)

### 📄 Claude Sonnet 5 on GitLab: More reliable, more efficient

Anthropic’s Claude Sonnet 5 is now available on GitLab Duo Agent Platform across all tiers and deployment models through GitLab's AI Gateway. Claude Sonnet 5 is built for work that agents assist softw

**📅 Jun 30, 2026** • **📰 GitLab Blog**

[**🔗 Read more**](https://about.gitlab.com/blog/claude-sonnet-5-on-gitlab/)

### 📄 Introducing Autonomous Worker Agents

Harness launches Autonomous Worker Agents: AI that runs as pipeline steps, with the governance enterprises need to trust agents in production | Blog

**📅 Jun 30, 2026** • **📰 Harness Blog**

[**🔗 Read more**](https://www.harness.io/blog/introducing-autonomous-worker-agents)

### 📄 Highlights from Git 2.55

The open source Git project just released Git 2.55. Here is GitHub’s look at some of the most interesting features and changes introduced since last time. The post Highlights from Git 2.55 appeared fi

**📅 Jun 29, 2026** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/open-source/git/highlights-from-git-2-55/)

---

## 🏗️ IaC

### 📄 Scaling NetOps-as-Code: Improving security, eliminating random scripting, and more

The drive toward NetOps-as-Code continues to reshape how enterprises manage their infrastructure. We see the demand for resilient, agile networks capable of supporting hybrid cloud applications and di

**📅 Jul 3, 2026** • **📰 Red Hat Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/scaling-netops-code-improving-security-eliminating-random-scripting-and-more)

### 📄 Amazon SageMaker Unified Studio now supports Terraform for provisioning

Amazon SageMaker Unified Studio now supports Terraform for provisioning. Customers can use the open-source terraform-aws-sagemaker-unified-studio module to deploy a SageMaker Unified Studio domain thr

**📅 Jul 2, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/07/amazon-sagemaker-unified-studio-terraform/)

### 📄 Amazon EC2 Dedicated Hosts now support AMD SEV-SNP

Amazon EC2 is announcing support for AMD Secure Encrypted Virtualization-Secure Nested Paging (SEV-SNP) on Dedicated Hosts, enabling customers to run their confidential computing workloads on physical

**📅 Jul 2, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/07/ec2-amd-sev-snp-dedicated-hosts)

### 📄 The evolution of infrastructure automation in the age of AI: 4 key takeaways from Red Hat Summit 2026

At Red Hat Summit 2026, the conversation centered on a critical reality: AI agents are arriving in enterprise IT faster than most environments can govern them. Across the keynotes and more than 50 tec

**📅 Jul 1, 2026** • **📰 Red Hat Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/evolution-infrastructure-automation-age-ai-4-key-takeaways-red-hat-summit-2026)

### 📄 How to Test Infrastructure as Code

IaC testing means validating your infrastructure code the same way you test application software—unit tests with mocked cloud providers that run in milliseconds, integration tests that deploy and insp

**📅 Jun 30, 2026** • **📰 Pulumi Blog**

[**🔗 Read more**](https://www.pulumi.com/blog/how-to-test-infrastructure-as-code/)

### 📄 Fully Automated AI Inference on AWS, Azure, and Google Cloud with Pulumi

Putting Ollama on a cloud GPU is something I keep coming back to. A while ago I wrote up running open-source LLMs on an AWS EC2 box with Ollama and Pulumi, and the shape never really changes: a GPU in

**📅 Jun 30, 2026** • **📰 Pulumi Blog**

[**🔗 Read more**](https://www.pulumi.com/blog/fully-automated-ai-inference-aws-azure-gcp-pulumi/)

### 📄 Enforce ISO 27001 Across Your AWS Infrastructure

ISO/IEC 27001 is the international standard for information security management. Proving you meet it usually means months of mapping abstract security controls to concrete cloud configuration, then au

**📅 Jun 30, 2026** • **📰 Pulumi Blog**

[**🔗 Read more**](https://www.pulumi.com/blog/iso-27001-policy-pack-for-aws/)

---

## 📊 Observability

### 📄 pg_dbms_errlog v2.4 released

Bangkok, Thailand - June 23, 2026 PostgreSQL DBMS_ERRLOG compatibility extension The pg_dbms_errlog extension provides the infrastructure that enables you to create an error logging table so that DML 

**📅 Jul 5, 2026** • **📰 PostgreSQL News**

[**🔗 Read more**](https://www.postgresql.org/about/news/pg_dbms_errlog-v24-released-3331/)

### 📄 Any Apple update can break our app. Here's how we find out first.

How the Usage app uses Sentry to catch crashes, silent errors, and build regressions before 1.6 million users notice.

**📅 Jul 2, 2026** • **📰 Sentry Blog**

[**🔗 Read more**](https://blog.sentry.io/apple-update-breaks-app/)

### 📄 Prepare for the EU AI Act with Harness AI Security

Learn how Harness AI Security helps organizations meet EU AI Act requirements with AI asset discovery, risk classification, runtime protection, auditability, and continuous compliance monitoring. | Bl

**📅 Jul 2, 2026** • **📰 Harness Blog**

[**🔗 Read more**](https://www.harness.io/blog/prepare-for-the-eu-ai-act-with-harness-ai-security)

### 📄 Multi-Harness AI Agents Need Multi-Layer Observability: Omnigent in MLflow

Omnigent unifies multi-harness agent orchestration and, with MLflow Tracing, delivers automatic observability across every agent, no code changes required.

**📅 Jul 2, 2026** • **📰 MLflow Blog**

[**🔗 Read more**](https://mlflow.org/blog/omnigent-mlflow-tracing/)

### 📄 Reading the agent traces is how you make the call your eval can't

I gave the free tier a cheaper model and it invented conference speakers who don't exist. What that taught me about model tradeoffs, evals, and reading agent traces.

**📅 Jul 1, 2026** • **📰 Sentry Blog**

[**🔗 Read more**](https://blog.sentry.io/spot-checking-ai-agents/)

### 📄 Discover More with Zabbix Marketplace

What if extending Zabbix was as easy as browsing an app store? Zabbix Marketplace is a new, centralized hub built to help users quickly discover integrations, extensions, templates, and observability 

**📅 Jul 1, 2026** • **📰 Zabbix Blog**

[**🔗 Read more**](https://blog.zabbix.com/discover-more-with-zabbix-marketplace/33191/)

### 📄 Full-stack observability in Grafana Cloud: How to investigate issues across services and infrastructure

Many times, the hardest part of troubleshooting isn’t fixing the actual problem. It’s figuring out where to start. As engineers, it’s easy to lose count of how many times we’ve opened logs, then 10 me

**📅 Jun 30, 2026** • **📰 Grafana Blog**

[**🔗 Read more**](https://grafana.com/blog/full-stack-observability-in-grafana-cloud-how-to-investigate-issues-across-services-and-infrastructure/)

### 📄 Building Future-Proof Observability with OpenTelemetry APIs and New Relic Agents

Adopt OpenTelemetry APIs without losing your APM tools using the New Relic hybrid agent. Build vendor-neutral, future-proof observability seamlessly.

**📅 Jun 30, 2026** • **📰 New Relic Blog**

[**🔗 Read more**](https://newrelic.com/blog/apm/building-future-proof-observability-with-opentelemetry-apis-and-new-relic-agents)

---

## 🔐 Security

### 📄 Threats Making WAVs - Incident Response to a Cryptomining Attack

Guardicore security researchers describe and uncover a full analysis of a cryptomining attack, which hid a cryptominer inside WAV files. The report includes the full attack vectors, from detection, in

**📅 Jul 6, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/security/threats-making-wavs-incident-reponse-cryptomining-attack)

### 📄 PostgreSQL JDBC 42.7.12 Security Release

Silent channel-binding authentication downgrade (CVE-2026-54291) channelBinding=require connections can be silently downgraded from SCRAM-SHA-256-PLUS (with channel binding) to plain SCRAM-SHA-256 (wi

**📅 Jul 6, 2026** • **📰 PostgreSQL News**

[**🔗 Read more**](https://www.postgresql.org/about/news/postgresql-jdbc-42712-security-release-3340/)

### 📄 Amazon SageMaker HyperPod now supports AMI versioning and auto-patching

Amazon SageMaker HyperPod now gives you visibility into the Amazon Machine Image (AMI) versions running across your clusters and automatically applies security patches without disrupting your workload

**📅 Jul 2, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/07/amazon-sagemaker-hyperpod-ami-version-auto-patch)

### 📄 6 security settings every GitHub maintainer should enable this week

These six free settings will not make your project unhackable. Nothing will. What they will do is close the easy doors. Turn these on, and your project will be meaningfully harder to attack than it wa

**📅 Jul 1, 2026** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/security/6-security-settings-every-github-maintainer-should-enable-this-week/)

### 📄 DirtyClone Linux kernel local privilege escalation vulnerability fixes available

On June 25, 2026, JFrog published their research into CVE-2026-43503, referring to the vulnerability as DirtyClone. The vulnerability had previously been responsibly disclosed to the Linux kernel main

**📅 Jul 1, 2026** • **📰 Ubuntu Blog**

[**🔗 Read more**](https://ubuntu.com//blog/dirtyclone-linux-vulnerability-fixes-available)

### 📄 pedit COW kernel local privilege escalation vulnerability mitigations

Mitigations are available for the Linux vulnerability with CVE ID CVE-2026-46331. The CVE ID was assigned on June 16 2026 and highlighted as a local privilege escalation (LPE) vulnerability on June 26

**📅 Jul 1, 2026** • **📰 Ubuntu Blog**

[**🔗 Read more**](https://ubuntu.com//blog/pedit-cow-linux-vulnerability-fixes-available)

### 📄 How GitHub maintains compliance for open source dependencies

Explore how the Open Source Program Office uses GitHub’s new license compliance product to manage open source dependencies at scale. The post How GitHub maintains compliance for open source dependenci

**📅 Jun 30, 2026** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/enterprise-software/governance-and-compliance/how-github-maintains-compliance-for-open-source-dependencies/)

### 📄 TiDB Completes Independent Security Assessment by NCC Group

When enterprises evaluate a distributed SQL database for production workloads, security isn’t a checkbox. It’s a prerequisite. Teams running financial transactions, customer data, and AI agent infrast

**📅 Jun 29, 2026** • **📰 TiDB Blog**

[**🔗 Read more**](https://www.pingcap.com/blog/tidb-ncc-group-security-assessment/)

---

## 💾 Databases

### 📄 pg-cdc Frustratingly simple Postgres change data capture to AWS S3

Core Features git Repo: https://github.com/burnside-project/pg-cdc pg-cdc is not just replication. pg-cdc streams Postgres Write Ahead Logs(WAL) out of production Postgres into typed, immutable, time-

**📅 Jul 5, 2026** • **📰 PostgreSQL News**

[**🔗 Read more**](https://www.postgresql.org/about/news/pg-cdc-frustratingly-simple-postgres-change-data-capture-to-aws-s3-3315/)

### 📄 Semantic overload: why AI agents get facts wrong

Your AI agent confidently tells a user that the company's parental leave policy is 12 weeks. It's been 16 for the past year. The old HR handbook, the updated one, and the Slack announcement that chang

**📅 Jul 2, 2026** • **📰 Redis Blog**

[**🔗 Read more**](https://redis.io/blog/semantic-overload-ai-agents-facts-relationships/)

### 📄 AlloyDB AI Functions - now with revolutionary performance boosts and cost savings

AlloyDB is an AI-native database—it isn’t just a passive data store, it intelligently understands and processes your data. With AlloyDB, you get industry-leading vector and hybrid search, near 100% ac

**📅 Jul 1, 2026** • **📰 Google Cloud Blog**

[**🔗 Read more**](https://cloud.google.com/blog/products/databases/boost-performance-and-lower-costs-with-alloydb-ai-functions/)

### 📄 Cutting P99 Latency 1000X During Connection Storms by Hardening ScyllaDB Admission Control

ScyllaDB successfully mitigated performance-degrading connection storms by optimizing caching, throttling, and password hashing to achieve a 1000x reduction in tail latency

**📅 Jul 1, 2026** • **📰 ScyllaDB Blog**

[**🔗 Read more**](https://www.scylladb.com/2026/07/01/cutting-p99-during-connection-storms/)

### 📄 LLM router architecture: best practices for 2026

You picked GPT-5 for every LLM call in your app because it was the safe call: chat, autocomplete, classification, summarization, all of it. Then the bill arrived, and you traced part of it back to que

**📅 Jul 1, 2026** • **📰 Redis Blog**

[**🔗 Read more**](https://redis.io/blog/llm-router-architecture-best-practices/)

### 📄 Token efficiency: getting more signal into the context window

You've probably hit this counterintuitive moment: you give your model more context to work with, expecting better answers, and the answers get worse. More tokens were supposed to mean more information

**📅 Jul 1, 2026** • **📰 Redis Blog**

[**🔗 Read more**](https://redis.io/blog/token-efficiency-signal-context-window/)

### 📄 Comparing the best open source vector databases

Open source vector databases come in two flavors: specialized tools that handle vectors and nothing else, or unified platforms that combine vector search with operational data and caching. Many teams 

**📅 Jul 1, 2026** • **📰 Redis Blog**

[**🔗 Read more**](https://redis.io/blog/best-open-source-vector-databases-comparison/)

### 📄 How ScyllaDB’s Trie-Based Index Delivers Up to 3X More Throughput

By transitioning from separate summary and index files to a prefix tree, we optimized cache efficiency, reduced disk I/O, and reduced memory overhead

**📅 Jun 30, 2026** • **📰 ScyllaDB Blog**

[**🔗 Read more**](https://www.scylladb.com/2026/06/30/trie-index-3x-more-throughput/)

### 📄 ScyllaDB 2026.2: DynamoDB Streams and Vector Search, Trie Indexes, and Strongly Consistent Tables

ScyllaDB 2026.2 brings a combination of GA new features, exciting experimental features, and multiple stability and external use case improvements.

**📅 Jun 29, 2026** • **📰 ScyllaDB Blog**

[**🔗 Read more**](https://www.scylladb.com/2026/06/29/scylladb-2026-2/)

---

## 🌐 Platforms

### 📄 Keep Your Tech Flame Alive: Trailblazer Rachel Bayley

In this Akamai FLAME Trailblazer blog post, Rachel Bayley encourages women to step into the unknown and to be their authentic selves.

**📅 Jul 6, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/culture/2024/may/keep-your-tech-flame-alive-trailblazer-rachel-bayley)

### 📄 The Oracle of Delphi Will Steal Your Credentials

Our deception technology is able to reroute attackers into honeypots, where they believe that they found their real target. The attacks brute forced passwords for RDP credentials to connect to the vic

**📅 Jul 6, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/security/the-oracle-of-delphi-steal-your-credentials)

### 📄 The Nansh0u Campaign – Hackers Arsenal Grows Stronger

In the beginning of April, three attacks detected in the Guardicore Global Sensor Network (GGSN) caught our attention. All three had source IP addresses originating in South-Africa and hosted by Volum

**📅 Jul 6, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/security/the-nansh0u-campaign-hackers-arsenal-grows-stronger)

### 📄 Evolving platform engineering for AI-native workloads

Platform Engineering 1.0 delivered real value. Golden paths accelerated deployment. Internal Developer Platforms (IDPs) reduced cognitive load for developers. Self-service infrastructure gave develope

**📅 Jul 6, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/07/06/evolving-platform-engineering-for-ai-native-workloads/)

### 📄 Reflections from Brussels, Utrecht and Paris

The European open source industry answers the moment The EU Tech Sovereignty Package, published on 3 June, put a question to the European open source industry before it put one to anyone else. The Com

**📅 Jul 6, 2026** • **📰 SUSE Blog**

[**🔗 Read more**](https://www.suse.com/c/reflections-from-brussels-utrecht-and-paris/)

### 📄 SUSE AI Factory with NVIDIA is now generally available

Turning AI potential into operational resilience Key takeaways Operational shift: The AI hype cycle is officially moving into true enterprise industrialization and mission-critical deployment. Turnkey

**📅 Jul 6, 2026** • **📰 SUSE Blog**

[**🔗 Read more**](https://www.suse.com/c/suse-ai-factory-with-nvidia-is-now-generally-available/)

### 📄 Microsoft, AWS and Anthropic are spending billions — and not on better models

On July 2, Judson Althoff, CEO of Microsoft’s commercial business, announced the formation of the Microsoft Frontier Company. The new The post Microsoft, AWS and Anthropic are spending billions — and 

**📅 Jul 5, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/microsoft-frontier-forward-deployed/)

### 📄 Amazon EC2 X8i instances are now available in additional regions

Starting today, Amazon Elastic Compute Cloud (Amazon EC2) X8i instances are available in the Asia Pacific (Seoul), Asia Pacific (Malaysia) and Asia Pacific (Tokyo) regions. These instances are powered

**📅 Jul 2, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/02/amazon-ec2-x8i-instances-ICN-KUL-NRT-region/)

### 📄 Z.ai Debuts ZCode to Compete With GitHub Copilot, Cursor and Anthropic

Chinese AI developer Z.ai has introduced ZCode, a desktop application that automates software development tasks, positioning the platform to compete with established coding platforms from Anthropic, G

**📅 Jul 2, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/z-ai-debuts-zcode-to-compete-with-github-copilot-cursor-and-anthropic/)

### 📄 Google’s Continued Disruption of Malicious Residential Proxy Networks

Background Today, in coordination with the FBI, Lumen, and others, Google took action against the NetNut residential proxy network, also known as Popa. This action builds on our disruption of the IPID

**📅 Jul 2, 2026** • **📰 Google Cloud Blog**

[**🔗 Read more**](https://cloud.google.com/blog/topics/threat-intelligence/google-continued-disruption-residential-proxy-networks/)

### 📄 Built for Mass Scale: Hard-Won Lessons from Teams Running High Volume Inference Workloads in Production

Moving AI from a flashy demo to a high-volume production environment is a transition filled with hidden technical debt and infrastructure challenges. There’s a difference between calling the OpenAI AP

**📅 Jul 2, 2026** • **📰 DigitalOcean Blog**

[**🔗 Read more**](https://www.digitalocean.com/blog/lessons-running-inference-workloads)

### 📄 Upcoming Change: NTLM Removal in Git (libcurl) – Impact to Azure DevOps Server Customers

Overview In September 2026, NTLM support will be removed from libcurl, which is used by Git for HTTP(S) operations. As a result, Git operations over HTTPS against Azure DevOps Server (on-premises) wil

**📅 Jul 1, 2026** • **📰 Azure DevOps Blog**

[**🔗 Read more**](https://devblogs.microsoft.com/devops/upcoming-change-ntlm-removal-in-git-libcurl-impact-to-azure-devops-server-customers/)

---

## 📰 Misc

### 📄 Insignary Closes SBOM Accuracy Gap With Binary-Level Clarity for Regulatory Risk

Toronto, Canada, 6th July 2026, CyberNewswire

**📅 Jul 6, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/insignary-closes-sbom-accuracy-gap-with-binary-level-clarity-for-regulatory-risk/)

### 📄 The code review bug hunt is dead. Here’s what developers get wrong.

The software code review process is a systematic, peer-driven quality assurance procedure that scrutinizes code when a developer submits a The post The code review bug hunt is dead. Here’s what develo

**📅 Jul 6, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/code-review-catches-maintainability-bugs/)

### 📄 Does Speaking to Agents Like Cavemen Really Save 65% of Tokens? We Test

A paired A/B benchmark of the token-compression skill Caveman on Claude Code, run on SkillsBench: does it actually save tokens, and does it degrade AI agent output quality? Advertised saving: 65%. Mea

**📅 Jul 6, 2026** • **📰 JetBrains Blog**

[**🔗 Read more**](https://blog.jetbrains.com/ai/2026/07/speak-to-ai-agents-like-cavemen-tosave-tokens/)

### 📄 Mistral Releases Leanstral 1.5, an Open Model That Solved 587 of 672 Putnam Math Problems

Mistral's open Leanstral 1.5 model solved 587 of 672 Putnam math problems and is already finding real bugs in open-source code.

**📅 Jul 6, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/mistral-releases-leanstral-1-5-an-open-model-that-solved-587-of-672-putnam-math-problems/)

### 📄 10 moments that defined AI’s turbulent first half of 2026

Halfway through 2026, artificial intelligence has been at the center of every major story inside the world of software development The post 10 moments that defined AI’s turbulent first half of 2026 ap

**📅 Jul 5, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/biggest-ai-moments-2026/)

### 📄 The AI revolution will not be televised — it’ll be quantized

With apologies to Gil Scott-Heron and his timeless 1971 protest song, if anyone thought the AI revolution would not be The post The AI revolution will not be televised — it’ll be quantized appeared fi

**📅 Jul 5, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/chinese-frontier-models-quantization/)

### 📄 In Conversation With the Golden Kodee Winners

KotlinConf 2026 marked a milestone for the Kotlin community: the very first Golden Kodee Community Awards. The awards recognize the individuals and communities whose passion and dedication help the Ko

**📅 Jul 3, 2026** • **📰 JetBrains Blog**

[**🔗 Read more**](https://blog.jetbrains.com/kotlin/2026/07/in-conversation-with-the-golden-kodee-winners/)

### 📄 Friday Five — July 3, 2026

IBM, Red Hat, and Deloitte Announce Lightwell Collaboration to Help Strengthen Open Source Software Supply Chain TrustDeloitte is teaming up with IBM and Red Hat to support Lightwell and strengthen th

**📅 Jul 3, 2026** • **📰 Red Hat Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/friday-five-july-3-2026)

### 📄 When AI Agents Get Production Access: The Next Big DevOps Risk

It wasn’t that long ago that AI assistants just watched from the sidelines. They could answer your questions, explain how things worked, sum up logs, and write deployment scripts. Handy, sure, but the

**📅 Jul 2, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/when-ai-agents-get-production-access-the-next-big-devops-risk/)

### 📄 Toolbox App 3.6: Smarter Storage Cleanup, Windows installation diagnostics, and More

Toolbox App 3.6 gives you better control over local storage and makes Windows installation failures easier to diagnose. Clean up removable Toolbox App data from Settings The Toolbox App now shows how 

**📅 Jul 2, 2026** • **📰 JetBrains Blog**

[**🔗 Read more**](https://blog.jetbrains.com/toolbox-app/2026/07/toolbox-app-3-6-smarter-storage-cleanup-windows-installation-diagnostics-and-more/)

### 📄 IntelliJ IDEA 2026.1.4 Is Out!

IntelliJ IDEA 2026.1.4 is out with some useful fixes. You can update to this version from inside the IDE, using the Toolbox App, or using snaps if you are a Ubuntu user. You can also download it from 

**📅 Jul 2, 2026** • **📰 JetBrains Blog**

[**🔗 Read more**](https://blog.jetbrains.com/idea/2026/07/intellij-idea-2026-1-4/)

### 📄 Your Patch Cycle Is Already Behind.

April 7th changed the math on enterprise patching, permanently. AI-speed exploitation is here. The tool to respond already exists. The only thing missing is urgency… and we just ran out of runway to w

**📅 Jul 1, 2026** • **📰 SUSE Blog**

[**🔗 Read more**](https://www.suse.com/c/your-patch-cycle-is-already-behind/)
