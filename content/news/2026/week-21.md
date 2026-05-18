---
title: "DevOps Weekly Digest - Week 21, 2026"
date: "2026-05-18"
summary: "⚡ Curated updates from Kubernetes, cloud native tooling, CI/CD, IaC, observability, and security - handpicked for DevOps professionals!"
---

> 📌 **Handpicked by DevOps Daily** - Your weekly dose of curated DevOps news and updates!

---

## ⚓ Kubernetes

### 📄 What kubectl debug doesn’t tell you: The silent evidence gap

The session that left no record A kubectl debug session can contain the only direct observation of a failing system state. However, once the session ends, Kubernetes does not retain the termination co

**📅 May 18, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/05/18/what-kubectl-debug-doesnt-tell-you-the-silent-evidence-gap/)

### 📄 Kubernetes v1.36: New Metric for Route Sync in the Cloud Controller Manager

This article was originally published with the wrong date. It was later republished, dated the 15th of May 2026. Kubernetes v1.36 introduces a new alpha counter metric route_controller_route_sync_tota

**📅 May 15, 2026** • **📰 Kubernetes Blog**

[**🔗 Read more**](https://kubernetes.io/blog/2026/05/15/ccm-new-metric-route-sync-total/)

### 📄 Kubernetes v1.36: Mixed Version Proxy Graduates to Beta

Back in Kubernetes 1.28, we introduced the Mixed Version Proxy (MVP) as an Alpha feature (under the feature gate UnknownVersionInteroperabilityProxy) in a previous blog post. The goal was simple but c

**📅 May 15, 2026** • **📰 Kubernetes Blog**

[**🔗 Read more**](https://kubernetes.io/blog/2026/05/15/kubernetes-1-36-feature-mixed-version-proxy-beta/)

### 📄 Kubernetes v1.36: Deprecation and removal of Service ExternalIPs

The .spec.externalIPs field for Service was an early attempt to provide cloud-load-balancer-like functionality for non-cloud clusters. Unfortunately, the API assumes that every user in the cluster is 

**📅 May 14, 2026** • **📰 Kubernetes Blog**

[**🔗 Read more**](https://kubernetes.io/blog/2026/05/14/kubernetes-v1-36-deprecation-and-removal-of-service-externalips/)

### 📄 When AI agents become contributors: How KubeStellar reached 81% PR acceptance

In mid-December, I started building KubeStellar Console from scratch. It’s a multi-cluster management dashboard for Kubernetes, and it sits inside the KubeStellar project in the Cloud Native Computing

**📅 May 14, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/05/14/when-ai-agents-become-contributors-how-kubestellar-reached-81-pr-acceptance/)

### 📄 Kubernetes v1.36: Advancing Workload-Aware Scheduling

AI/ML and batch workloads introduce unique scheduling challenges that go beyond simple Pod-by-Pod scheduling. In Kubernetes v1.35, we introduced the first tranche of workload-aware scheduling improvem

**📅 May 13, 2026** • **📰 Kubernetes Blog**

[**🔗 Read more**](https://kubernetes.io/blog/2026/05/13/kubernetes-v1-36-advancing-workload-aware-scheduling/)

### 📄 Maximizing value with Amazon EKS Auto Mode: Strategies for visibility, control, and optimization

In this post, we explore how to maximize Auto Mode's value through comprehensive cost visibility, proactive governance, and continuous optimization strategies. We cover essential cost management dimen

**📅 May 13, 2026** • **📰 AWS Containers Blog**

[**🔗 Read more**](https://aws.amazon.com/blogs/containers/maximizing-value-with-amazon-eks-auto-mode-strategies-for-visibility-control-and-optimization/)

### 📄 Building a cloud native platform from the ground up with Kairos, k0rdent, and bindy

As we shared in our earlier post on FluxCD, RBC Capital Markets has been on a deliberate journey to modernize our Kubernetes platform. GitOps with FluxCD gave us a solid deployment foundation. But as 

**📅 May 13, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/05/13/building-a-cloud-native-platform-from-the-ground-up-with-kairos-k0rdent-and-bindy/)

### 📄 Kubernetes at Uber with Lucy Sweet

Guest is Lucy Sweet, a Staff Software engineer at Uber and the lead for the Kubernetes Node Lifecycle Working Group. Imagine trying to move millions of compute cores and thousands of microservices to 

**📅 May 13, 2026** • **📰 Kubernetes Podcast**

[**🔗 Read more**](https://e780d51f-f115-44a6-8252-aed9216bb521.libsyn.com/kubernetes-at-uber-with-lucy-sweet)

### 📄 Stop managing the past and start building IT’s future

We’re continuing to navigate a fundamental shift in digital infrastructure. Over the past 18 months, the predictability of the virtualization layer has shed nearly 20 years of stability driven by an u

**📅 May 13, 2026** • **📰 OpenShift Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/stop-managing-past-and-start-building-its-future)

### 📄 Red Hat partner ecosystem: A year of expanding choice for virtualized workloads on Red Hat OpenShift Virtualization

It has been about a year since the last review of Red Hat’s partner ecosystem for Red Hat OpenShift Virtualization. We've had a lot of success in the infrastructure space, including improvements to st

**📅 May 13, 2026** • **📰 OpenShift Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/red-hat-partner-ecosystem-year-expanding-choice-virtualized-workloads-red-hat-openshift-virtualization)

### 📄 Back up and restore your Amazon EKS cluster resources using Velero

In this post, you'll learn to back up and restore Amazon EKS cluster resources and persistent volume data using Velero. You'll deploy a sample stateful application, back it up, and restore it to a dif

**📅 May 12, 2026** • **📰 AWS Containers Blog**

[**🔗 Read more**](https://aws.amazon.com/blogs/containers/back-up-and-restore-your-amazon-eks-cluster-resources-using-velero/)

---

## ☁️ Cloud Native

### 📄 Custom MCP Catalogs and Profiles: Advancing Enterprise MCP Adoption

We’re excited to announce the general availability of Custom Catalogs and Profiles for managing Model Context Protocol (MCP) servers. These two complementary capabilities fundamentally change how team

**📅 May 15, 2026** • **📰 Docker Blog**

[**🔗 Read more**](https://www.docker.com/blog/create-custom-mcp-catalogs-and-profiles/)

### 📄 Extending AI gateways with Rust: Custom transformations in agentgateway and kgateway

Every gateway ships with a set of built-in policies. Authentication. Rate limiting. Request routing. Prompt guards. These cover most use cases. But what about the ones they don’t cover? What if you ne

**📅 May 15, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/05/15/extending-ai-gateways-with-rust-custom-transformations-in-agentgateway-and-kgateway/)

### 📄 Counting to 3 with a new builder processing 50M+ monthly builds

We replaced our Docker-buildx GCP autoscaler with a fleet of microVM build cells running BuildKit. Here's what we learned rolling it out.

**📅 May 14, 2026** • **📰 Railway Blog**

[**🔗 Read more**](https://blog.railway.com/p/new-builder-scale-big)

### 📄 NIST Narrows the NVD: What Container Security Programs Should Reassess

On April 15, NIST announced a prioritized enrichment model for the National Vulnerability Database. Most CVEs will still be published, but fewer will receive the CVSS scores, CPE mappings, and CWE cla

**📅 May 13, 2026** • **📰 Docker Blog**

[**🔗 Read more**](https://www.docker.com/blog/nist-narrows-the-nvd-what-container-security-programs-should-reassess/)

### 📄 Docker AI Governance: Unlock Agent Autonomy, Safely

Introducing Docker AI Governance: centralized control over how agents execute, what they can reach on the network, which credentials they can use, and which MCP tools they can call, so every developer

**📅 May 12, 2026** • **📰 Docker Blog**

[**🔗 Read more**](https://www.docker.com/blog/docker-ai-governance-unlock-agent-autonomy-safely/)

### 📄 Implement centralized observability for multi-account Amazon EKS

This post shows you how to unify your existing Container Insights and CloudWatch data into a centralized monitoring hub using a hub-and-spoke architecture. You will unify fragmented observability data

**📅 May 12, 2026** • **📰 AWS Containers Blog**

[**🔗 Read more**](https://aws.amazon.com/blogs/containers/implement-centralized-observability-for-multi-account-amazon-eks/)

---

## 🔄 CI/CD

### 📄 GitLab Act 2: Still an Open Book

An analysis of GitLab’s "Act 2" transition under CEO Bill Staples, examining whether the company can successfully pivot to an AI-native, agentic software delivery model while dismantling the radically

**📅 May 18, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/gitlab-act-2-still-an-open-book/)

### 📄 Core Java vs Enterprise Java: Jakarta EE & Spring Boot 2026

Java SE, Jakarta EE, and Spring Boot have converged more than most teams realize. A 2026 guide to choosing — and standardizing — your enterprise Java stack. | Blog

**📅 May 18, 2026** • **📰 Harness Blog**

[**🔗 Read more**](https://www.harness.io/blog/jakarta-ee-vs-spring-boot)

### 📄 What a Context Graph Actually Is, and How to Build One

Context graphs help AI agents reason through work by modeling how processes actually happen across your organization. This practical guide breaks down what they are, how they differ from knowledge gra

**📅 May 18, 2026** • **📰 Harness Blog**

[**🔗 Read more**](https://www.harness.io/blog/what-a-context-graph-actually-is-and-how-to-build-one)

### 📄 Building a general-purpose accessibility agent—and what we learned in the process

Learn about the experimental general-purpose accessibility agent that GitHub is piloting. The post Building a general-purpose accessibility agent—and what we learned in the process appeared first on T

**📅 May 15, 2026** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/ai-and-ml/github-copilot/building-a-general-purpose-accessibility-agent-and-what-we-learned-in-the-process/)

### 📄 Widespread Mini Shai-Hulud Campaign Is a Matter of Trust

The latest series of attacks using the notorious Shai-Hulud worm puts into sharp focus the threats facing software developers and their CI/CD pipelines, an issue that has been raised in recent months 

**📅 May 15, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/widespread-mini-shai-hulud-campaign-is-a-matter-of-trust/)

### 📄 Raising the bar: Quality, shared responsibility, and the future of GitHub’s bug bounty program

We're updating our bug bounty program standards to prioritize quality submissions, clarify shared responsibility boundaries, and evolve how we reward low-risk findings. The post Raising the bar: Quali

**📅 May 15, 2026** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/security/raising-the-bar-quality-shared-responsibility-and-the-future-of-githubs-bug-bounty-program/)

### 📄 GitHub availability report: April 2026

In April, we experienced 10 incidents that resulted in degraded performance across GitHub services. The post GitHub availability report: April 2026 appeared first on The GitHub Blog.

**📅 May 14, 2026** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/news-insights/company-news/github-availability-report-april-2026/)

### 📄 From latency to instant: Modernizing GitHub Issues navigation performance

How the GitHub Issues team used client-side caching, smart prefetching, and service workers to make navigation feel instant. The post From latency to instant: Modernizing GitHub Issues navigation perf

**📅 May 14, 2026** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/engineering/architecture-optimization/from-latency-to-instant-modernizing-github-issues-navigation-performance/)

### 📄 Automated Release Management: From CABs to CD

Find out how policy-driven pipelines, continuous delivery and AI-assisted verification are replacing manual CAB processes with automated release management. | Blog

**📅 May 14, 2026** • **📰 Harness Blog**

[**🔗 Read more**](https://www.harness.io/blog/automated-release-management-from-cabs-to-continuous-delivery)

### 📄 Harden your pipeline perimeter for the era of AI-assisted coding

AI-assisted development is moving faster than the security models built to govern it — agents write code, open merge requests, and ship changes at a pace where vulnerabilities go unnoticed. The proble

**📅 May 13, 2026** • **📰 GitLab Blog**

[**🔗 Read more**](https://about.gitlab.com/blog/harden-pipeline-perimeter-for-ai-assisted-coding/)

### 📄 GitLab Patch Release: 18.11.3, 18.10.6, 18.9.7



**📅 May 13, 2026** • **📰 GitLab Blog**

[**🔗 Read more**](https://docs.gitlab.com/releases/patches/patch-release-gitlab-18-11-3-released/)

---

## 🏗️ IaC

### 📄 Ensure Code Integrity for AWS Lambda Functions with Automated Code Signing Using Terraform

Authors: Sourav Kundu and Joyson Neville Lewis. In today’s cloud-native landscape, ensuring the integrity and authenticity of your serverless functions is critical for maintaining security and complia

**📅 May 18, 2026** • **📰 AWS DevOps Blog**

[**🔗 Read more**](https://aws.amazon.com/blogs/devops/ensure-code-integrity-for-aws-lambda-functions-with-automated-code-signing-using-terraform/)

### 📄 Amazon CloudWatch Logs announces increased query result limits

Amazon CloudWatch Logs now supports retrieving up to 100,000 results using the Logs Insights query language. Customers can specify the limit in their query using the LIMIT command. Previously, custome

**📅 May 15, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/05/cloudwatch-logs-query-results/)

### 📄 Simplify cross-account and cross-Region stack output references with AWS CloudFormation and CDK’s new Fn::GetStackOutput

AWS CloudFormation makes it easy to model and provision your cloud application infrastructure as code. CloudFormation templates can be written directly in JSON or YAML, or they can be generated by too

**📅 May 14, 2026** • **📰 AWS DevOps Blog**

[**🔗 Read more**](https://aws.amazon.com/blogs/devops/simplify-cross-account-and-cross-region-stack-output-references-with-aws-cloudformation-and-cdks-new-fngetstackoutput/)

### 📄 How Building AI Agents Has Changed in 2026

Twelve months ago, building an AI agent meant picking a framework, defining your tools, standing up a RAG pipeline, and writing a stack of glue code to wire it all together. That was the default playb

**📅 May 14, 2026** • **📰 Pulumi Blog**

[**🔗 Read more**](https://www.pulumi.com/blog/how-building-ai-agents-has-changed/)

---

## 📊 Observability

### 📄 Inside the LLM Call: GenAI Observability with OpenTelemetry

Your AI agent just took 45 seconds to answer a simple question. Was it the model? A slow tool call? A retry loop? Every time an application calls an LLM, a chain of model calls, tool invocations, and 

**📅 May 14, 2026** • **📰 OpenTelemetry Blog**

[**🔗 Read more**](https://opentelemetry.io/blog/2026/genai-observability/)

### 📄 New ways to agentically build and edit dashboards

Create and edit Sentry dashboards with AI agents, the Sentry CLI, or pre-built templates you can clone and customize for your monitoring needs.

**📅 May 14, 2026** • **📰 Sentry Blog**

[**🔗 Read more**](https://blog.sentry.io/dashboard-updates/)

### 📄 AI-assisted testing, extensions updates, and more: k6 2.0 is here

For years, teams have relied on k6 to take a more proactive approach to performance testing, ensuring they can catch issues early and deliver more reliable user experiences. That approach has helped m

**📅 May 12, 2026** • **📰 Grafana Blog**

[**🔗 Read more**](https://grafana.com/blog/k6-2-0-release/)

### 📄 Introducing OTel Blueprints and Reference Implementations

It’s not uncommon for end users adopting OpenTelemetry to, at some point in their journey, ask themselves: “Why is this stuff so complex?”. Full adoption normally requires understanding the different 

**📅 May 12, 2026** • **📰 OpenTelemetry Blog**

[**🔗 Read more**](https://opentelemetry.io/blog/2026/blueprints-intro/)

---

## 🔐 Security

### 📄 Threats Making WAVs - Incident Response to a Cryptomining Attack

Guardicore security researchers describe and uncover a full analysis of a cryptomining attack, which hid a cryptominer inside WAV files. The report includes the full attack vectors, from detection, in

**📅 May 18, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/security/threats-making-wavs-incident-reponse-cryptomining-attack)

### 📄 Finding the blind spot: How Canonical hunts logic flaws with AI

AI is accelerating and improving how security engineers find and fix vulnerabilities. A new tool developed and used at Canonical, called Redhound, has already uncovered three critical logic vunerabili

**📅 May 15, 2026** • **📰 Ubuntu Blog**

[**🔗 Read more**](https://ubuntu.com//blog/finding-the-blind-spot-how-canonical-hunts-logic-flaws-with-ai)

### 📄 Malicious node-ipc versions published to npm in suspected maintainer account compromise

On May 14, 2026, multiple malicious versions of the popular npm package node-ipc were published to the npm registry. Current public reporting identifies node...

**📅 May 15, 2026** • **📰 Snyk Blog**

[**🔗 Read more**](https://snyk.io/blog/malicious-node-ipc-versions-published-npm/)

### 📄 CloudNativePG 1.29.1 and 1.28.3 released: critical CVE fix

The CloudNativePG community is releasing maintenance updates for all currently supported series: 1.29.1 and 1.28.3. This is a high-priority release. It addresses CVE-2026-44477 (the first CVE official

**📅 May 15, 2026** • **📰 PostgreSQL News**

[**🔗 Read more**](https://www.postgresql.org/about/news/cloudnativepg-1291-and-1283-released-critical-cve-fix-3296/)

### 📄 Fragnesia Linux kernel local privilege escalation vulnerability mitigations

A local privilege escalation (LPE) vulnerability affecting the Linux kernel has been publicly disclosed on May 13, 2026. The vulnerability does not have a CVE ID published, but is referred to as “Frag

**📅 May 14, 2026** • **📰 Ubuntu Blog**

[**🔗 Read more**](https://ubuntu.com//blog/fragnesia-linux-vulnerability-fixes-available)

### 📄 PostgreSQL 18.4, 17.10, 16.14, 15.18, and 14.23 Released!

The PostgreSQL Global Development Group has released an update to all supported versions of PostgreSQL, including 18.4, 17.10, 16.14, 15.18, and 14.23. This release fixes 11 security vulnerabilities a

**📅 May 14, 2026** • **📰 PostgreSQL News**

[**🔗 Read more**](https://www.postgresql.org/about/news/postgresql-184-1710-1614-1518-and-1423-released-3297/)

### 📄 Scaling enterprise AI: Delivering Models-as-a-Service with Red Hat OpenShift AI 3.4

Discover how Red Hat OpenShift AI 3.4 and Red Hat Connectivity Link deliver Models-as-a-Service (MaaS) to centrally govern and scale enterprise AI model serving.Many enterprises have moved past the AI

**📅 May 14, 2026** • **📰 Red Hat Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/scaling-enterprise-ai-delivering-models-service-openshift-ai-34)

### 📄 Rethinking BYOD security: protecting data without trusting devices

BYOD (bring your own device) has always looked better on paper than it does in real life. The promise is clear: let people use the gadgets they already own. Less friction, lower costs, and more freedo

**📅 May 13, 2026** • **📰 Ubuntu Blog**

[**🔗 Read more**](https://ubuntu.com//blog/rethinking-byod-security-protecting-data-without-trusting-devices)

### 📄 5 ways to fix misleading vulnerability severities with policy

A typical enterprise vulnerability report surfaces hundreds of findings per scan cycle, all ranked by the Common Vulnerability Scoring System (CVSS). The problem: CVSS describes the theoretical charac

**📅 May 13, 2026** • **📰 GitLab Blog**

[**🔗 Read more**](https://about.gitlab.com/blog/severity-override-vulnerability-management-policy/)

### 📄 Blog: Introducing Prempti: Falco meets AI coding agents

Today's developer workflow is increasingly reliant on AI coding agents. Tools like Claude Code sit in your terminal, read your files, run shell commands, make network requests, and write code, all on 

**📅 May 12, 2026** • **📰 Falco Blog**

[**🔗 Read more**](https://falco.org/blog/introducing-prempti/)

### 📄 Fighting Tool Sprawl: The Case for AI Tool Registries

As enterprise AI agent adoption scales, the absence of centralized, organization-level tool infrastructure is producing compounding costs. When adoption is built around optimizing for deployment speed

**📅 May 11, 2026** • **📰 MongoDB Blog**

[**🔗 Read more**](https://www.mongodb.com/company/blog/technical/fighting-tool-sprawl-case-for-ai-tool-registries)

---

## 💾 Databases

### 📄 One Agent, One Sandbox, One Database: Inside the Kimi K2.6 Architecture

A few months back I wrote two pieces about what infrastructure agents actually need: One on the database trends shaping 2026, another on why agents are the new database users. The arguments stayed mos

**📅 May 14, 2026** • **📰 TiDB Blog**

[**🔗 Read more**](https://www.pingcap.com/blog/agent-database-kimi-k2-6/)

### 📄 “Key-Value” is Misleading. Access Patterns are Key.

Access patterns determine your data model, your I/O costs, and which database is the best fit for your workload

**📅 May 14, 2026** • **📰 ScyllaDB Blog**

[**🔗 Read more**](https://www.scylladb.com/2026/05/14/access-patterns-are-key/)

### 📄 Context engineering for AI: what it is & how to build it

Your support agent confidently tells a customer they qualify for a refund under a 60-day return policy. Your actual policy is 30 days. The agent hallucinated the longer window, and the easy reaction i

**📅 May 13, 2026** • **📰 Redis Blog**

[**🔗 Read more**](https://redis.io/blog/context-engineering-ai/)

### 📄 How to tame the thundering herd problem

The thundering herd problem occurs when multiple processes or clients repeatedly request the same resource simultaneously, leading to excessive load and performance degradation. If you grew up on clas

**📅 May 13, 2026** • **📰 Redis Blog**

[**🔗 Read more**](https://redis.io/blog/how-to-tame-the-thundering-herd-problem/)

### 📄 TiDB SCaiLE Europe 2026: Speaker Lineup and Session Preview

Agentic AI changes the database problem. A single user action can trigger many agent steps. However, each agent needs state, memory, transactions, analytics, and retrieval to stay consistent under rea

**📅 May 12, 2026** • **📰 TiDB Blog**

[**🔗 Read more**](https://www.pingcap.com/blog/tidb-scaile-europe-2026/)

### 📄 New Research on Cloud Database Trends: Technical Risks, Cost Pressures, and Migration Triggers

Good enough until it isn’t: the database complacency trap

**📅 May 12, 2026** • **📰 ScyllaDB Blog**

[**🔗 Read more**](https://www.scylladb.com/2026/05/12/new-research-on-cloud-database-trends/)

### 📄 AI shopping assistants: how they work & what to build

You type "cozy winter sweater" into a search bar and get zero results because no product is tagged with that exact phrase. Keyword search can't tell that a "wool pullover" is the same idea. AI shoppin

**📅 May 12, 2026** • **📰 Redis Blog**

[**🔗 Read more**](https://redis.io/blog/ai-shopping-assistant/)

### 📄 Dynamic endpoints: Migrate databases without changing your endpoint

Most teams don’t move Redis databases often. But when they do, the complexity is rarely in Redis itself. It’s in coordinating endpoint changes across apps, services, and jobs. Redis Cloud now supports

**📅 May 12, 2026** • **📰 Redis Blog**

[**🔗 Read more**](https://redis.io/blog/dynamic-endpoints-migrate-databases-without-changing-your-endpoint/)

### 📄 From Preview to Production: TiDB Cloud Dedicated on Microsoft Azure is Now Generally Available

For teams standardized on Azure, distributed SQL has been a tradeoff. Stay on managed SQL Server or Azure Database for MySQL and live with single-instance scale ceilings. Step outside Azure to get hor

**📅 May 11, 2026** • **📰 TiDB Blog**

[**🔗 Read more**](https://www.pingcap.com/blog/tidb-cloud-dedicated-ga-microsoft-azure/)

---

## 🌐 Platforms

### 📄 Keep Your Tech Flame Alive: Trailblazer Rachel Bayley

In this Akamai FLAME Trailblazer blog post, Rachel Bayley encourages women to step into the unknown and to be their authentic selves.

**📅 May 18, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/culture/2024/may/keep-your-tech-flame-alive-trailblazer-rachel-bayley)

### 📄 The Oracle of Delphi Will Steal Your Credentials

Our deception technology is able to reroute attackers into honeypots, where they believe that they found their real target. The attacks brute forced passwords for RDP credentials to connect to the vic

**📅 May 18, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/security/the-oracle-of-delphi-steal-your-credentials)

### 📄 The Nansh0u Campaign – Hackers Arsenal Grows Stronger

In the beginning of April, three attacks detected in the Guardicore Global Sensor Network (GGSN) caught our attention. All three had source IP addresses originating in South-Africa and hosted by Volum

**📅 May 18, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/security/the-nansh0u-campaign-hackers-arsenal-grows-stronger)

### 📄 Amazon EMR Serverless is now available in additional AWS Regions

Amazon EMR Serverless is now generally available in six additional AWS Regions - Asia Pacific (Hyderabad), Asia Pacific (Malaysia), Asia Pacific (New Zealand), Asia Pacific (Taipei), Asia Pacific (Tha

**📅 May 15, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/05/amazon-emr-serverless-aws-regions/)

### 📄 AWS Partner Central agents now accelerates opportunity creation

Today, AWS announces that the AWS Partner Central agents now accelerate opportunity creation through natural language conversation. AWS Partner Central agents, released on March 16, 2026, are AI-power

**📅 May 15, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/05/aws-partner-central-agents-oppo)

### 📄 Amazon Connect Cases now lets you edit related items and delete cases from the agent workspace

Amazon Connect Cases now supports editing and deleting related items, and deleting cases directly from the agent workspace without administrator help. Agents can update comments, unlink contacts assoc

**📅 May 15, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/05/amazon-connect-cases-related-item/)

### 📄 Gemini Live Agent Challenge: Announcing the winners and highlights

The Gemini Live Agent Challenge is officially in the books! We challenged developers worldwide to break out of the traditional 'text box' paradigm by building next-generation AI agents. From our initi

**📅 May 15, 2026** • **📰 Google Cloud Blog**

[**🔗 Read more**](https://cloud.google.com/blog/topics/developers-practitioners/winners-and-highlights-of-the-gemini-live-agent-challenge/)

### 📄 Welcome to BlackFile: Inside a Vishing Extortion Operation

Written by: Austin Larsen, Tyler McLellan, Genevieve Stark, Dan Ebreo Introduction Google Threat Intelligence Group (GTIG) has continued to track an expansive extortion campaign by UNC6671, a threat a

**📅 May 15, 2026** • **📰 Google Cloud Blog**

[**🔗 Read more**](https://cloud.google.com/blog/topics/threat-intelligence/blackfile-vishing-extortion-operation/)

### 📄 Friday Five — May 15, 2026

Catch up on the news at Red Hat Summit 2026This definitive guide to all of Red Hat's news offers a centralized view of the latest product innovations, strategic collaborations, and visionary milestone

**📅 May 15, 2026** • **📰 Red Hat Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/friday-five-may-15-2026-red-hat)

### 📄 Scaling SAP HANA Performance: Insights from AWS, Intel, and SUSE

Most SAP teams know they need to move to the cloud. The hesitation isn’t about whether they should, it’s about what happens to performance when you get there. On-premises SAP HANA appliances are predi

**📅 May 14, 2026** • **📰 SUSE Blog**

[**🔗 Read more**](https://www.suse.com/c/scaling-sap-hana-performance-insights-from-aws-intel-and-suse/)

### 📄 May Patches for Azure DevOps Server

We are releasing new patches for our self‑hosted product, Azure DevOps Server. We strongly recommend that all customers stay up to date with the latest, most secure version of Azure DevOps Server. The

**📅 May 14, 2026** • **📰 Azure DevOps Blog**

[**🔗 Read more**](https://devblogs.microsoft.com/devops/may-patches-for-azure-devops-server-3/)

### 📄 Cloud CISO Perspectives: How Google + Wiz changes multicloud strategy for CISOs

Welcome to the first Cloud CISO Perspectives for May 2026. Today, Vinod D’Souza, director, Office of the CISO, shares highlights from his RSA Conference fireside chat with Anthony Belfiore, chief stra

**📅 May 14, 2026** • **📰 Google Cloud Blog**

[**🔗 Read more**](https://cloud.google.com/blog/products/identity-security/cloud-ciso-perspectives-how-google-wiz-changes-multicloud-strategy-for-cisos/)

---

## 📰 Misc

### 📄 Visual Studio Code 1.121

Learn what's new in Visual Studio Code 1.121 (Insiders) Read the full article

**📅 May 20, 2026** • **📰 VS Code Blog**

[**🔗 Read more**](https://code.visualstudio.com/updates/v1_121)

### 📄 The Mac mini just became infrastructure

On April 30, Apple’s Q2 2026 earnings call did something unusual. Tim Cook spent meaningful airtime on Mac mini and The post The Mac mini just became infrastructure appeared first on The New Stack.

**📅 May 17, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/mac-mini-agent-infrastructure/)

### 📄 The clean-up cost of AI-generated code is what the velocity narrative leaves out

The world is actively using AI to make our lives more efficient and safe — from creative writing to safer The post The clean-up cost of AI-generated code is what the velocity narrative leaves out appe

**📅 May 16, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/cleanup-cost-ai-code/)

### 📄 GitHub takes aim at Claude Code and Codex with its new Copilot app

GitHub’s latest move to shake up its Copilot coding assistant is to give it its very own home in a The post GitHub takes aim at Claude Code and Codex with its new Copilot app appeared first on The New

**📅 May 16, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/github-copilot-desktop-app/)

### 📄 Forward deployed engineer is AI’s hottest job as OpenAI and Google race to hire. Here’s how to become one.

I’m Matt Burns, Chief Content Officer at Insight Media Group. Each week, I round up the most important AI developments, The post Forward deployed engineer is AI’s hottest job as OpenAI and Google race

**📅 May 16, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/forward-deployed-engineer-fde-openai-google/)

### 📄 Why DevOps Is Critical for Modern Business Resilience

Today’s business world operates in a state of constant change. What the customer wants to buy changes quickly, new competitors appear overnight, and cyber threats are changing faster than ever. In thi

**📅 May 15, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/why-devops-is-critical-for-modern-business-resilience/)

### 📄 Pyrefly LSP Integration with Type Engine in PyCharm 2026.1.2

In PyCharm 2026.1.2, you can enable Pyrefly as an external type provider, dramatically increasing the speed of the IDE’s code insight features. What is the Pyrefly LSP? “LSP” stands for the Language S

**📅 May 15, 2026** • **📰 JetBrains Blog**

[**🔗 Read more**](https://blog.jetbrains.com/pycharm/2026/05/pyrefly-lsp-integration-in-pycharm-2026-1-2)

### 📄 IntelliJ IDEA 2026.1.2 Is Out!

IntelliJ IDEA 2026.1.2 has arrived with several valuable fixes. You can update to this version from inside the IDE, using the Toolbox App, or using snaps if you are a Ubuntu user. You can also downloa

**📅 May 15, 2026** • **📰 JetBrains Blog**

[**🔗 Read more**](https://blog.jetbrains.com/idea/2026/05/intellij-idea-2026-1-2)

### 📄 A New Default Project Structure for Kotlin Multiplatform

We are updating the default project structure for Kotlin Multiplatform projects to give modules clearer responsibilities, better align with conventions used by other build systems and frameworks, and 

**📅 May 15, 2026** • **📰 JetBrains Blog**

[**🔗 Read more**](https://blog.jetbrains.com/kotlin/2026/05/new-kmp-default-structure)

### 📄 Help Shape the Future of Kotlin in the Age of AI

AI is rapidly changing the way developers write, review, learn, and maintain code. Code completion, AI chat assistants, autonomous coding agents, and other tools are giving rise to new workflows almos

**📅 May 15, 2026** • **📰 JetBrains Blog**

[**🔗 Read more**](https://blog.jetbrains.com/kotlin/2026/05/help-shape-the-future-of-kotlin-in-the-age-of-ai)

### 📄 xAI Enters the Coding Agent Race With Grok Build

Elon Musk's xAI has entered the developer workspace with Grok Build, a local-first coding agent featuring an automated "Arena Mode" that runs and ranks parallel AI outputs to rival Anthropic and OpenA

**📅 May 15, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/xai-enters-the-coding-agent-race-with-grok-build/)

### 📄 The Open Source Procurement Agenda: A Guide for IT Leaders, Procurement Teams and Policymakers

This five-part series from SUSE’s Sovereign Solutions Team, published ahead of the upcoming EU Tech Sovereignty Package, equips IT leaders, procurement professionals, and policymakers with the practic

**📅 May 15, 2026** • **📰 SUSE Blog**

[**🔗 Read more**](https://www.suse.com/c/the-open-source-procurement-agenda-a-guide-for-it-leaders-procurement-teams-and-policymakers/)
