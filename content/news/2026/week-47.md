---
title: "DevOps Weekly Digest - Week 47, 2026"
date: "2026-11-16"
summary: "Deprecating the Collector Batch Processor and Git security vulnerabilities announced, plus 23 more DevOps updates from week 47."
---

## 📌 This week in short

<!-- editor-intro: 2-4 plain lines from the editor go between these markers. Empty renders nothing. -->
KubeCon NA took place this week, so CNCF news leads: CloudNativePG is now an incubating project, and OpenShell joined as a sandbox project.
If you run the OpenTelemetry Collector, remove the batch processor from your pipelines and turn on batching in the exporters. The processor goes away in v0.177.0 (May 2027).
Git has new releases that fix six security issues, so update Git on your build machines and servers.
<!-- /editor-intro -->

**[Deprecating the Collector Batch Processor](https://opentelemetry.io/blog/2026/collector-batching-migration/)**
OpenTelemetry Blog · Nov 11
Batching in the OpenTelemetry Collector is a process that ensures requests are the right size for the exporter, large enough to improve compression and amortize round-trip latency, but not so...

**[Git security vulnerabilities announced](https://github.blog/open-source/git/git-security-vulnerabilities-announced-7/)**
GitHub Blog · Nov 10
Git is releasing updates addressing six security vulnerabilities affecting clones, reference handling, merges, binary patches, and imports.

**[CloudNativePG becomes a CNCF Incubating Project](https://www.cncf.io/blog/2026/11/10/cloudnativepg-becomes-a-cncf-incubating-project/)**
CNCF Blog · Nov 10
The CNCF Technical Oversight Committee (TOC) voted to accept CloudNativePG as a CNCF incubating project.

## 🚀 Releases

- **PostgreSQL** [18.7, 17.12, 16.16, 15.20, 14.25 and 19 RC 2](https://www.postgresql.org/about/news/postgresql-187-1712-1616-1520-1425-and-19-rc-2-released-3442/)
- **Terraform** [1.17.2](https://github.com/hashicorp/terraform/releases/tag/v1.17.2)
- **Docker Compose** [5.7.1](https://github.com/docker/compose/releases/tag/v5.7.1)
- **Grafana** [13.3.1](https://github.com/grafana/grafana/releases/tag/v13.3.1) (also 13.2.6, 13.1.10, 13.0.13 and 12.4.15)
- **Istio** [1.32.0](https://github.com/istio/istio/releases/tag/1.32.0)

## ⚓ Kubernetes

**[AWS Batch on Amazon EKS adds Linux capabilities, seccomp, and pod-level settings](https://aws.amazon.com/about-aws/whats-new/2026/11/aws-batch-eks-security-context/)**
AWS What's New · Nov 13
AWS Batch now supports additional Kubernetes security context settings in Amazon EKS job definitions, including Linux capabilities, seccomp profiles, and pod-level settings.

**[Gang scheduling and topology-aware placement for AI training in Kubernetes](https://www.cncf.io/blog/2026/11/12/gang-scheduling-and-topology-aware-placement-for-ai-training-in-kubernetes/)**
CNCF Blog · Nov 12
Distributed AI training workloads impose complex scheduling requirements that Kubernetes’s built-in scheduler can’t meet.

## ☁️ Cloud Native

**[Welcoming OpenShell to the CNCF: Open Governance to Secure Agentic AI](https://www.cncf.io/blog/2026/11/10/welcoming-openshell-to-the-cncf-open-governance-to-secure-agentic-ai/)**
CNCF Blog · Nov 10
Today at KubeCon + CloudNativeCon North America, the Cloud Native Computing Foundation (CNCF) welcomes OpenShell as a Sandbox project.

**[What's new in Pyroscope: profile more of your workflows, troubleshoot with AI agents, and more](https://grafana.com/blog/whats-new-in-pyroscope-profile-more-of-your-workflows-troubleshoot-with-ai-agents-and-more/)**
Grafana Blog · Nov 13
When an application slows down or memory usage keeps climbing, knowing which code is responsible can help you find a fix faster.

## 🔄 CI/CD

**[GitHub availability report: October 2026](https://github.blog/news-insights/company-news/github-availability-report-october-2026/)**
GitHub Blog · Nov 13
In October, we experienced eight incidents that resulted in degraded performance across GitHub services.

**[Gitea Runner 6.0.0 is released](https://blog.gitea.com/release-of-runner-6.0.0/)**
Gitea Blog · Nov 11
We are happy to announce the release of Gitea Runner 6.0.0. This release has two breaking changes: \`builtin:checkout\` is removed, and the runner now requires Gitea 1.26.2 or newer.

**[Build once, run on any agent: A practical guide to agent skills](https://github.blog/ai-and-ml/github-copilot/build-once-run-on-any-agent-a-practical-guide-to-agent-skills/)**
GitHub Blog · Nov 12
Agent skills capture repeatable engineering work in files teams can review and reuse, while tools, project context, and permissions remain specific to the host that runs them.

## 🏗️ IaC

**[Aurora PostgreSQL with express configuration now supported in CloudFormation](https://aws.amazon.com/about-aws/whats-new/2026/11/aurora-postgresql-cloudformation/)**
AWS What's New · Nov 13
Aurora PostgreSQL now supports express configuration in AWS CloudFormation for infrastructure as code deployment.

## 📊 Observability

**[Datasentinel 2026.10 released with AI Connector](https://www.postgresql.org/about/news/datasentinel-202610-released-with-ai-connector-3400/)**
PostgreSQL News · Nov 15
Datasentinel 2026.10, the new release of our PostgreSQL monitoring and troubleshooting platform, is now available. It introduces AI Connector, which connects Datasentinel metrics to the AI assistant your team already uses.

**[Building an Agent Harness for OTel Instrumentation with GenAI Semantic Conventions and Weaver](https://opentelemetry.io/blog/2026/agent-harness-genai-instrumentation/)**
OpenTelemetry Blog · Nov 12
Instrumenting a GenAI framework means finding suitable extension points, mapping its operations to OpenTelemetry semantic conventions, testing the result, and maintaining it as the framework changes.

**[What’s New in Zabbix 8.0 LTS](https://blog.zabbix.com/whats-new-in-zabbix-8-0-lts/33755/)**
Zabbix Blog · Nov 11
Zabbix 8.0 LTS might just be the largest Zabbix update yet. With a focus on application performance monitoring, new event processing workflows, scalability improvements, and MCP server for connecting Zabbix to your AI agents, Zabbix 8.0...

**[When Missing Telemetry Is the Signal](https://opentelemetry.io/blog/2026/when-missing-telemetry-is-the-signal/)**
OpenTelemetry Blog · Nov 10
An empty dashboard can mean that nothing happened. It can also mean that the system stopped reporting what happened. On a dashboard, they look the same. One needs no action. The other means you are missing the information you need to act.

## 🔐 Security

**[Introducing Falco Operator 0.5.0](https://falco.org/blog/falco-operator-0-5-0/)**
Falco Blog · Nov 10
Dear Falco Community, we are thrilled to announce Falco Operator 0.5.0! If you have ever wondered "is my new rule actually loaded on every node?", this release is for you.

**[Gitea 28.4.0 is released](https://blog.gitea.com/release-of-28.4.0/)**
Gitea Blog · Nov 15
We are excited to announce the release of Gitea 28.4.0, the fourth maintenance release for the 28 series.

**[Adapting to AI penetration testing orchestrators: The Modern Security Model](https://blog.cloudflare.com/adapting-to-ai-penetration-testing-orchestrators/)**
Cloudflare Blog · Nov 13
AI-orchestrated penetration testing platforms like ARTEX have become increasingly powerful tools enabling effective attacks on exposed infrastructure. Here we share Cloudflare’s observations and recommended countermeasures.

## 💾 Databases

**[Amazon Aurora and RDS now support Graviton5-based R9g database instances](https://aws.amazon.com/about-aws/whats-new/2026/11/amazon-aurora-rds-postgresql-mysql-mariadb-r9g-instances/)**
AWS What's New · Nov 12
AWS Graviton5-based R9g database instances are now generally available for Amazon Aurora with PostgreSQL compatibility and MySQL compatibility, and for Amazon RDS for PostgreSQL, MySQL, and MariaDB.

**[How a broken release name overloaded our symbolication database](https://blog.sentry.io/broken-release-database-load/)**
Sentry Blog · Nov 9
An unexpanded env var filled one release with 44M URL index rows. Capping lookups cut database CPU from 76% to 19% and symbolication timeouts by 98%.

**[Throwing Out The Phonebook](https://fly.io/blog/throwing-out-the-phonebook/)**
Fly.io Blog · Nov 13
There’s really only one hard problem in software engineering: synchronization. OK, maybe two: cache invalidation and synchronization.

## 🌐 Platforms

**[Kitesurf is now open source](https://blog.cloudflare.com/kitesurf-open-source/)**
Cloudflare Blog · Nov 13
Kitesurf, our experimental browser engine for AI agents, is now open source. Inspect the code, run it locally, or deploy your own instance on Cloudflare Workers.

**[QM, Y Combinator's Open-Source Agent Harness, Now Deploys in One Click on DigitalOcean](https://www.digitalocean.com/blog/qm-ycombinator-digitalocean-one-click)**
DigitalOcean Blog · Nov 10
Y Combinator built QM, a multiplayer agent harness for Slack and the web, to run agents across its own teams, from accounting and legal to engineering. In July, YC open-sourced it so any startup could do the same.

**[Introducing Spend Management: Spending limits and alerts for Cloudflare](https://blog.cloudflare.com/spend-management/)**
Cloudflare Blog · Nov 13
Spend Management adds opt-in spending caps for Cloudflare Workers and Durable Objects, and more products soon. Here is how we built the metering pipeline that turns usage into runtime decisions.

## 📰 Misc

**[Visual Studio Code 1.146](https://code.visualstudio.com/updates/v1_146)**
VS Code Blog · Nov 11
Learn what's new in Visual Studio Code 1.146

## ✍️ From DevOps Daily this week

- [Five Production Bugs You Can Reproduce in a Browser Tab](/posts/five-production-bugs-you-can-reproduce-in-a-browser)
- [CKNE Is Live: What the Kubernetes Network Engineer Exam Tests and How to Practice](/posts/ckne-kubernetes-network-engineer-exam-guide)
- [Who's On Call for the AI Agent? A Production Runbook](/posts/who-is-on-call-for-the-ai-agent)
- [We Tested AWS Emulator: It Blocks More Than Its Docs Say, and Less Than AWS Does](/posts/aws-emulator-hands-on-test)
- [Disk Full but du Disagrees: Finding Deleted Files That Still Use Space](/posts/disk-full-du-disagrees-deleted-open-files)
- [Node.js November 2026 Security Release: How We Tracked and Patched It](/posts/node-november-2026-security-release-track-and-patch)
