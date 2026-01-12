---
title: "DevOps Weekly Digest - Week 3, 2026"
date: "2026-01-12"
summary: "⚡ Curated updates from Kubernetes, cloud native tooling, CI/CD, IaC, observability, and security - handpicked for DevOps professionals!"
---

> 📌 **Handpicked by DevOps Daily** - Your weekly dose of curated DevOps news and updates!

---

## ⚓ Kubernetes

### 📄 Kubernetes v1.35: Restricting executables invoked by kubeconfigs via exec plugin allowList added to kuberc

Did you know that kubectl can run arbitrary executables, including shell scripts, with the full privileges of the invoking user, and without your knowledge? Whenever you download or auto-generate a ku

**📅 Jan 9, 2026** • **📰 Kubernetes Blog**

[**🔗 Read more**](https://kubernetes.io/blog/2026/01/09/kubernetes-v1-35-kuberc-credential-plugin-allowlist/)

### 📄 How to Build and Deploy an AI Agent on Kubernetes With AWS Bedrock, FastAPI and Helm

The capabilities offered by AI are no longer limited to large, centralized platforms. Today, engineering teams are increasingly embracing lightweight, specialized AI agents that can be managed, scaled

**📅 Jan 9, 2026** • **📰 DZone DevOps**

[**🔗 Read more**](https://feeds.dzone.com/link/23568/17250186/how-to-build-and-deploy-an-ai-agent-on-kubernetes)

### 📄 Recommended Experiments for Production Resilience in Harness Chaos.

A practical guide to chaos engineering experiments across Kubernetes, AWS, Azure, and GCP for building resilient production systems. | Blog

**📅 Jan 9, 2026** • **📰 Harness Blog**

[**🔗 Read more**](https://www.harness.io/blog/recommended-experiments-for-production-resilience-in-harness-chaos-engineering)

### 📄 Kubernetes v1.35: Mutable PersistentVolume Node Affinity (alpha)

The PersistentVolume node affinity API dates back to Kubernetes v1.10. It is widely used to express that volumes may not be equally accessible by all nodes in the cluster. This field was previously im

**📅 Jan 8, 2026** • **📰 Kubernetes Blog**

[**🔗 Read more**](https://kubernetes.io/blog/2026/01/08/kubernetes-v1-35-mutable-pv-nodeaffinity/)

### 📄 Kubernetes v1.35: A Better Way to Pass Service Account Tokens to CSI Drivers

If you maintain a CSI driver that uses service account tokens, Kubernetes v1.35 brings a refinement you'll want to know about. Since the introduction of the TokenRequests feature, service account toke

**📅 Jan 7, 2026** • **📰 Kubernetes Blog**

[**🔗 Read more**](https://kubernetes.io/blog/2026/01/07/kubernetes-v1-35-csi-sa-tokens-secrets-field-beta/)

### 📄 Kubernetes v1.35: Extended Toleration Operators to Support Numeric Comparisons (Alpha)

Many production Kubernetes clusters blend on-demand (higher-SLA) and spot/preemptible (lower-SLA) nodes to optimize costs while maintaining reliability for critical workloads. Platform teams need a sa

**📅 Jan 5, 2026** • **📰 Kubernetes Blog**

[**🔗 Read more**](https://kubernetes.io/blog/2026/01/05/kubernetes-v1-35-numeric-toleration-operators/)

### 📄 Deploying Harbor on Kubernetes using Helm

Harbor is an indispensable open-source container image registry, offering robust features like policy-driven security, role-based access control, vulnerability scanning, image signing, image replicati

**📅 Jan 5, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/01/05/deploying-harbor-on-kubernetes-using-helm/)

---

## ☁️ Cloud Native

### 📄 Introducing Multiple Registry Support on DigitalOcean Container Registry

Introducing Multiple Registry Support on DigitalOcean Container Registry At DigitalOcean, we’re dedicated to enhancing our container registry experience, providing users with a simple, powerful tool t

**📅 Jan 9, 2026** • **📰 DigitalOcean Blog**

[**🔗 Read more**](https://www.digitalocean.com/blog/multiple-registry-support)

### 📄 Mastering Fluent Bit: Developer Guide to Telemetry Pipeline Routing (Part 12)

This series is a general-purpose getting-started guide for those who want to learn about the Cloud Native Computing Foundation (CNCF) project Fluent Bit. Each article in this series addresses a single

**📅 Jan 9, 2026** • **📰 DZone DevOps**

[**🔗 Read more**](https://feeds.dzone.com/link/23568/17250230/mastering-fluent-bit-developer-guide-to-telemetry)

### 📄 What 10,000 Slack Messages Reveal About OpenTelemetry Adoption Challenges

The OpenTelemetry community has grown tremendously over the past few years, and with that growth comes valuable insights hidden in our community conversations. We analyzed nearly 10,000 messages from 

**📅 Jan 7, 2026** • **📰 OpenTelemetry Blog**

[**🔗 Read more**](https://opentelemetry.io/blog/2026/slack-community-insights/)

### 📄 HolmesGPT: Agentic troubleshooting built for the cloud native era

If you’ve ever debugged a production incident, you know that the hardest part often isn’t the fix, it’s finding where to begin. Most on-call engineers end up spending hours piecing together clues, fig

**📅 Jan 7, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/01/07/holmesgpt-agentic-troubleshooting-built-for-the-cloud-native-era/)

### 📄 Deterministic AI Testing with Session Recording in cagent

AI agents introduce a challenge that traditional software doesn’t have: non-determinism. The same prompt can produce different outputs across runs, making reliable testing difficult. Add API costs and

**📅 Jan 6, 2026** • **📰 Docker Blog**

[**🔗 Read more**](https://www.docker.com/blog/deterministic-ai-testing-with-session-recording-in-cagent/)

### 📄 Using Istio to manage high-traffic services

At STCLab, we operate high-traffic SaaS platforms that require real-time traffic control and bot mitigation. . Handling millions of concurrent connections and identifying malicious bots in real-time r

**📅 Jan 6, 2026** • **📰 CNCF Blog**

[**🔗 Read more**](https://www.cncf.io/blog/2026/01/06/using-istio-to-manage-high-traffic-services/)

---

## 🔄 CI/CD

### 📄 The developer's guide to free feature flagging services

Feature flags let you deploy code safely, test in production, and roll back instantly.

**📅 Jan 12, 2026** • **📰 LaunchDarkly Blog**

[**🔗 Read more**](https://launchdarkly.com/blog/best-free-feature-flag-services/)

### 📄 Making experimentation work for product managers

LaunchDarkly Experimentation is the missing puzzle piece in the PM workflow.

**📅 Jan 12, 2026** • **📰 LaunchDarkly Blog**

[**🔗 Read more**](https://launchdarkly.com/blog/experimentation-for-product-managers/)

### 📄 How to run experiments on high-traffic websites & apps

Running experiments on high-traffic websites creates a unique paradox.

**📅 Jan 12, 2026** • **📰 LaunchDarkly Blog**

[**🔗 Read more**](https://launchdarkly.com/blog/high-traffic-experimentation-best-practices/)

### 📄 Why MABs are not just fancy A/B tests

Know when it’s smarter to let a bandit optimize in real time.

**📅 Jan 12, 2026** • **📰 LaunchDarkly Blog**

[**🔗 Read more**](https://launchdarkly.com/blog/mabs-not-just-fancy-ab-tests/)

### 📄 Light waves, rising tides, and drifting ships: Game Off 2025 winners

Out of more than 700 games submitted to Game Off 2025, these ten winners stand out for creativity, craft, and bold interpretations of the WAVES theme. All are free to play, with source code available 

**📅 Jan 10, 2026** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/open-source/gaming/light-waves-rising-tides-and-drifting-ships-game-off-2025-winners/)

### 📄 Strengthening GitLab.com security: Mandatory multi-factor authentication

To strengthen the security of all user accounts on GitLab.com, GitLab is implementing mandatory multi-factor authentication (MFA) for all users and API endpoints who sign in using a username and passw

**📅 Jan 9, 2026** • **📰 GitLab Blog**

[**🔗 Read more**](https://about.gitlab.com/blog/strengthening-gitlab-com-security-mandatory-multi-factor-authentication/)

### 📄 Why AI is pushing developers toward typed languages

AI is settling the “typed vs. untyped” debate by turning type systems into the safety net for code you didn’t write yourself. The post Why AI is pushing developers toward typed languages appeared firs

**📅 Jan 8, 2026** • **📰 GitHub Blog**

[**🔗 Read more**](https://github.blog/ai-and-ml/llms/why-ai-is-pushing-developers-toward-typed-languages/)

### 📄 AI is reshaping DevSecOps: Attend GitLab Transcend to see what’s next

AI promises a step change in innovation velocity, but most software teams are hitting a wall. According to our latest Global DevSecOps Report, AI-generated code now accounts for 34% of all development

**📅 Jan 8, 2026** • **📰 GitLab Blog**

[**🔗 Read more**](https://about.gitlab.com/blog/ai-is-reshaping-devsecops-attend-gitlab-transcend-to-see-whats-next/)

### 📄 How IIT Bombay students are coding the future with GitLab

The GitLab team recently had the privilege of judging the iHack Hackathon at IIT Bombay's E-Summit. The energy was electric, the coffee was flowing, and the talent was undeniable. But what struck us m

**📅 Jan 8, 2026** • **📰 GitLab Blog**

[**🔗 Read more**](https://about.gitlab.com/blog/how-iit-bombay-students-code-future-with-gitlab/)

---

## 🏗️ IaC

### 📄 Amazon MQ now supports certificate based authentication with mutual TLS for RabbitMQ brokers

Amazon MQ now supports the ability for RabbitMQ brokers to perform authentication (determining who can log in) using X.509 client certificates with mutual TLS (mTLS). The RabbitMQ auth_mechanism_ssl p

**📅 Jan 8, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/01/amazon-mq-certificate-based-authentication-mutual-tls-rabbitmq/)

### 📄 Infrastructure Guardrails: Why Your IaC Stack Needs Them

Learn why infrastructure guardrails prevent costly errors in Terraform and OpenTofu deployments. Discover IaC best practices. Explore now. | Blog

**📅 Jan 8, 2026** • **📰 Harness Blog**

[**🔗 Read more**](https://www.harness.io/blog/why-your-iac-stack-needs-infrastructure-guardrails)

---

## 📊 Observability

### 📄 Snowflake Plans $1B Acquisition of Observe to Expand AI-Powered Observability

Snowflake has signed an agreement to acquire observability startup Observe, moving to fold AI-driven telemetry analysis directly into its AI Data Cloud as enterprises grapple with the operational comp

**📅 Jan 9, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/snowflake-plans-1b-acquisition-of-observe-to-expand-ai-powered-observability/)

### 📄 How Hackensack Meridian Health de-risked network migration using VPC Flow Logs

Network administrators rely heavily on VPC Flow Logs for visibility into their network traffic. Last year, we updated VPC Flow Logs to offer expanded network traffic visibility, extending beyond subne

**📅 Jan 9, 2026** • **📰 Google Cloud Blog**

[**🔗 Read more**](https://cloud.google.com/blog/products/networking/using-vpc-flow-logs-to-de-risk-network-migration/)

### 📄 OpenTelemetry.io 2025 review

As 2025 has come to an end, we’re taking a moment to look back at everything the community accomplished across the website, documentation, and localization efforts. The year was another exciting chapt

**📅 Jan 9, 2026** • **📰 OpenTelemetry Blog**

[**🔗 Read more**](https://opentelemetry.io/blog/2026/2025-year-in-review/)

### 📄 Write the future: Create your own agentic workflows

Imagine commissioning le Carré and Fleming to build your perfect undercover agent: quietly embedded in the system you’re watching. You hand in your mission brief, which includes the target, objective,

**📅 Jan 8, 2026** • **📰 Dynatrace Blog**

[**🔗 Read more**](https://www.dynatrace.com/news/blog/write-the-future-create-your-own-agentic-workflows/)

### 📄 Unity SDK 4.0.0: Console support, logs, user feedback and more

We just released the Sentry SDK for Unity 4.0.0 , our biggest update yet. This major release brings comprehensive gaming console support, structured logging, us...

**📅 Jan 8, 2026** • **📰 Sentry Blog**

[**🔗 Read more**](https://blog.sentry.io/introducing-gaming-console-support-logs-user-feedback-unity/)

### 📄 Calling New Contributors - Help Us Improve the OpenTelemetry Onboarding Experience

Update Update as of 2025-12-08: A giant thank you to those of you who have volunteered to participate! We have received more interest than expected, so sign-ups are closed for now. Stay tuned to the O

**📅 Jan 7, 2026** • **📰 OpenTelemetry Blog**

[**🔗 Read more**](https://opentelemetry.io/blog/2025/calling-new-contributors/)

### 📄 Instant insights: Gemini CLI's New Pre-Configured Monitoring Dashboards

Observability is a key component to understand how tools are helping you and your teams. We're excited to announce a significant set of updates that enhance the Gemini CLI’s telemetry capabilities, ma

**📅 Jan 7, 2026** • **📰 Google Cloud Blog**

[**🔗 Read more**](https://cloud.google.com/blog/topics/developers-practitioners/instant-insights-gemini-clis-new-pre-configured-monitoring-dashboards/)

### 📄 Trace-connected structured logging with LogTape and Sentry

As our applications grow from simple side projects into complex distributed systems with many users, the “old way” of console.log debugging isn’t going to hold ...

**📅 Jan 7, 2026** • **📰 Sentry Blog**

[**🔗 Read more**](https://blog.sentry.io/trace-connected-structured-logging-with-logtape-and-sentry/)

### 📄 Accelerate SNMP network device observability with Dynatrace Discovery & Coverage

When onboarding network devices for observability, challenges often arise related to inconsistent or partial monitoring coverage or inefficient processes. Such challenges make it difficult to ensure t

**📅 Jan 6, 2026** • **📰 Dynatrace Blog**

[**🔗 Read more**](https://www.dynatrace.com/news/blog/accelerate-snmp-network-device-observability-with-dynatrace-discovery-coverage/)

### 📄 Building an “Academy of Uptime” with Kristine Lamberte

If you’ve been working with Zabbix (or are planning to), you’re in luck – we’ve recently launched Zabbix Academy, a new learning platform designed to empower IT professionals and monitoring enthusiast

**📅 Jan 6, 2026** • **📰 Zabbix Blog**

[**🔗 Read more**](https://blog.zabbix.com/building-an-academy-of-uptime-with-kristine-lamberte/31773/)

### 📄 Another year, another $750,000 to Open Source maintainers

Bored yet? 2025 was the fifth year in a row (2024, 2023, 2022, 2021) that Sentry gave a pretty hefty chunk of change to the maintainers of the Open Source softw...

**📅 Jan 6, 2026** • **📰 Sentry Blog**

[**🔗 Read more**](https://blog.sentry.io/another-year-another-750-000-to-open-source-maintainers/)

---

## 🔐 Security

### 📄 Threats Making WAVs - Incident Response to a Cryptomining Attack

Guardicore security researchers describe and uncover a full analysis of a cryptomining attack, which hid a cryptominer inside WAV files. The report includes the full attack vectors, from detection, in

**📅 Jan 12, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/security/threats-making-wavs-incident-reponse-cryptomining-attack)

### 📄 Strengthen production security: Bridge SDLC best practices with runtime validation

Modern software systems face constant security threats. While integrating security measures throughout the software development lifecycle (SDLC) helps reduce risks, some vulnerabilities may still go u

**📅 Jan 9, 2026** • **📰 Dynatrace Blog**

[**🔗 Read more**](https://www.dynatrace.com/news/blog/strengthen-production-security-bridge-sdlc-best-practices-with-runtime-validation/)

### 📄 Security Is a Developer Experience Problem, Rooted in Our Foundations

For more than a decade, the industry has tried to improve software security by pushing it closer to developers. We moved scanners into CI, added security checks to pull requests, and asked teams to re

**📅 Jan 9, 2026** • **📰 Docker Blog**

[**🔗 Read more**](https://www.docker.com/blog/security-is-a-developer-experience-problem-rooted-in-our-foundations/)

### 📄 Automating AWS SDK for Java v1 to v2 Upgrades with AWS Transform

The AWS SDK for Java v2 represents a fundamental shift in how Java applications interact with AWS services, addressing critical security requirements while delivering measurable performance improvemen

**📅 Jan 8, 2026** • **📰 AWS DevOps Blog**

[**🔗 Read more**](https://aws.amazon.com/blogs/devops/automating-aws-sdk-for-java-v1-to-v2-upgrades-with-aws-transform/)

### 📄 Beyond Detection: Building a Resilient Software Supply Chain (Lessons from the Shai-Hulud Post-Mortem)

The Shai-Hulud npm incident exposed the limitations of reactive security in modern software supply chains. To survive the next major attack, organizations must shift toward a multi-layered strategy of

**📅 Jan 8, 2026** • **📰 Snyk Blog**

[**🔗 Read more**](https://snyk.io/blog/shai-hulud-post-mortem/)

### 📄 Navigating secure AI deployment: Architecture for enhancing AI system security and safety

In the previous articles, we discussed how integrating AI into business-critical systems opens up enterprises to a new set of risks with AI security and AI safety [link], and explored the evolving AI 

**📅 Jan 8, 2026** • **📰 Red Hat Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/navigating-secure-ai-deployment-architecture-enhancing-ai-system-security-and-safety)

### 📄 From incident response to everyday analytics: Introducing Dynatrace Investigations

Unlocking actionable insights from data is no longer just a security concern—it’s essential for any team that needs to make sense of large, complex data sets. The recently renamed “Investigations” app

**📅 Jan 7, 2026** • **📰 Dynatrace Blog**

[**🔗 Read more**](https://www.dynatrace.com/news/blog/from-incident-response-to-everyday-analytics-introducing-dynatrace-investigations/)

### 📄 Secure by Default: Why Snyk and Augment Code are the New Standard for AI Development

Snyk and Augment Code have partnered to deliver real-time security scanning and autonomous remediation directly within AI-powered development workflows, allowing teams to maintain peak velocity while 

**📅 Jan 7, 2026** • **📰 Snyk Blog**

[**🔗 Read more**](https://snyk.io/blog/snyk-augment-code-partnership/)

### 📄 OWASP Top 10 2025: What's changed and why it matters

The OWASP Foundation has released the eighth edition of its influential "Top 10 Security Risks" list for 2025, introducing significant changes that reflect the evolving landscape of application securi

**📅 Jan 7, 2026** • **📰 GitLab Blog**

[**🔗 Read more**](https://about.gitlab.com/blog/2025-owasp-top-10-whats-changed-and-why-it-matters/)

### 📄 Harness AI December 2025 Updates: AI Governance That Scales

Discover how the latest Harness AI governance updates help platform, security, and developer teams ship faster with AI-generated OPA policies, compliant-by-default pipelines, real-time policy enforcem

**📅 Jan 7, 2026** • **📰 Harness Blog**

[**🔗 Read more**](https://www.harness.io/blog/harness-ai-december-2025-updates)

### 📄 Introducing pgpm: A Package Manager for Modular PostgreSQL

PostgreSQL has a rich ecosystem of extensions—versioned, installable components that extend the database engine itself. Extensions have enabled powerful capabilities such as custom data types, operato

**📅 Jan 7, 2026** • **📰 PostgreSQL News**

[**🔗 Read more**](https://www.postgresql.org/about/news/introducing-pgpm-a-package-manager-for-modular-postgresql-3196/)

### 📄 Red Hat Hybrid Cloud Console: Your questions answered

Managing a hybrid environment can feel like a balancing act between disparate sets of fragmented tools used for all the different platforms you interact with. If that sounds familiar, then your team n

**📅 Jan 6, 2026** • **📰 OpenShift Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/red-hat-hybrid-cloud-console-your-questions-answered)

---

## 💾 Databases

### 📄 Announcing larger managed database bundles for Amazon Lightsail

Amazon Lightsail now offers two larger database bundles with up to 8 vCPUs, 32GB memory, and 960GB SSD storage. The new database bundles are available in both standard and high-availability plans. You

**📅 Jan 9, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/01/larger-managed-database-bundles-lightsail/)

### 📄 Amazon RDS for SQL Server now supports cross-region read replica in additional AWS Regions

Amazon Relational Database Service (Amazon RDS) for SQL Server now supports setting up cross-region read replicas in 16 additional AWS Regions. Cross-region read replicas enable customers to provide a

**📅 Jan 9, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/01/amazon-rds-sql-server-cross-region-read-replica-in-additional-aws-regions/)

### 📄 Announcing ScyllaDB 2025.4, with Extended Tablets Support, DynamoDB Alternator Updates & Trie-Based Indexes

An overview of recent ScyllaDB changes, including extended tablets support, native vector search, Alternator enhancements, a new SSTable index format, and new instance support.

**📅 Jan 8, 2026** • **📰 ScyllaDB Blog**

[**🔗 Read more**](https://www.scylladb.com/2026/01/08/announcing-scylladb-2025-4/)

### 📄 Redis at AWS re: Invent 2025: Advancing cloud and AI workloads

AWS re:Invent 2025 has wrapped up. Redis showed up with a clear focus on customers, partners, and real world cloud workloads. As a Diamond Sponsor, we lit up the Venetian with packed sessions, a booth

**📅 Jan 8, 2026** • **📰 Redis Blog**

[**🔗 Read more**](https://redis.io/blog/redis-at-aws-re-invent-2025/)

### 📄 What’s new in two: December 2025 edition

Welcome to “What’s new in two,” your quick hit of Redis releases you might have missed in the past month. If you blinked, you missed it—so here’s the recap. We’re covering the latest developments from

**📅 Jan 8, 2026** • **📰 Redis Blog**

[**🔗 Read more**](https://redis.io/blog/whats-new-in-two-december-2025-edition/)

### 📄 The Taming of Collection Scans

Explore different ways to organize collections for efficient scanning, from arrays and lists to less obvious layouts

**📅 Jan 6, 2026** • **📰 ScyllaDB Blog**

[**🔗 Read more**](https://www.scylladb.com/2026/01/06/the-taming-of-collection-scans/)

### 📄 How the YugabyteDB Performance Team Harnesses the Power of AI

As performance infrastructure expands, so does the volume of data generated. This can make the review process challenging. Discover how the YugabyteDB performance team addressed this issue by building

**📅 Jan 5, 2026** • **📰 Yugabyte Blog**

[**🔗 Read more**](https://www.yugabyte.com/blog/yugabytedb-performance-team-power-of-ai/)

---

## 🌐 Platforms

### 📄 Keep Your Tech Flame Alive: Trailblazer Rachel Bayley

In this Akamai FLAME Trailblazer blog post, Rachel Bayley encourages women to step into the unknown and to be their authentic selves.

**📅 Jan 12, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/culture/2024/may/keep-your-tech-flame-alive-trailblazer-rachel-bayley)

### 📄 The Oracle of Delphi Will Steal Your Credentials

Our deception technology is able to reroute attackers into honeypots, where they believe that they found their real target. The attacks brute forced passwords for RDP credentials to connect to the vic

**📅 Jan 12, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/security/the-oracle-of-delphi-steal-your-credentials)

### 📄 The Nansh0u Campaign – Hackers Arsenal Grows Stronger

In the beginning of April, three attacks detected in the Guardicore Global Sensor Network (GGSN) caught our attention. All three had source IP addresses originating in South-Africa and hosted by Volum

**📅 Jan 12, 2026** • **📰 Linode Blog**

[**🔗 Read more**](https://www.akamai.com/blog/security/the-nansh0u-campaign-hackers-arsenal-grows-stronger)

### 📄 Amazon EMR Serverless adds support for job run level cost allocation

Amazon EMR Serverless now supports job run-level cost allocation that provides better visibility into charges for individual job runs by allowing you to configure granular billing attribution at the i

**📅 Jan 9, 2026** • **📰 CloudFormation Updates**

[**🔗 Read more**](https://aws.amazon.com/about-aws/whats-new/2026/01/amazon-emr-serverless-adds-job-run-level)

### 📄 Code And Let Live

The state of the art in agent isolation is a read-only sandbox. At Fly.io, we’ve been selling that story for years, and we’re calling it: ephemeral sandboxes are obsolete. Stop killing your sandboxes 

**📅 Jan 9, 2026** • **📰 Fly.io Blog**

[**🔗 Read more**](https://fly.io/blog/code-and-let-live/)

### 📄 Friday Five — January 9, 2026

Red Hat Expands Collaboration with NVIDIA to Pair Enterprise Open Source with Rack-Scale AI for Faster, Production-Ready InnovationRed Hat and NVIDIA have expanded their collaboration to launch Red Ha

**📅 Jan 9, 2026** • **📰 Red Hat Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/friday-five-january-9-2026-red-hat)

### 📄 A smart investment: FINRA builds a culture of improvement with DORA

FINRA, the Financial Industry Regulatory Authority, consistently seeks to achieve the highest standards in its technology practices. To elevate its software development lifecycle, FINRA — which overse

**📅 Jan 8, 2026** • **📰 Google Cloud Blog**

[**🔗 Read more**](https://cloud.google.com/blog/topics/financial-services/finra-builds-a-culture-of-improvement-with-dora-and-devops/)

### 📄 Building the Inference Cloud, and What Comes Next

2025 was a defining year for DigitalOcean, not only because we shipped more products and features than ever before, but because we solidified our vision about what the next era of cloud and AI will lo

**📅 Jan 7, 2026** • **📰 DigitalOcean Blog**

[**🔗 Read more**](https://www.digitalocean.com/blog/building-inference-cloud-what-comes-next)

### 📄 Build data analytics agents faster with BigQuery’s fully managed, remote MCP server

Connecting AI agents to your enterprise data shouldn't require complex custom integrations or weeks of development. With the release of fully managed, remote Model Context Protocol (MCP) servers for G

**📅 Jan 7, 2026** • **📰 Google Cloud Blog**

[**🔗 Read more**](https://cloud.google.com/blog/products/data-analytics/using-the-fully-managed-remote-bigquery-mcp-server-to-build-data-ai-agents/)

### 📄 Unstoppable Velocity: Why 2026 is the Year to Join DigitalOcean

In 2025, we were relentless in our drive to build the comprehensive agentic cloud, made possible through the hard work and dedication of over 1,500 DigitalOcean “Sharks” around the globe. As we kick o

**📅 Jan 6, 2026** • **📰 DigitalOcean Blog**

[**🔗 Read more**](https://www.digitalocean.com/blog/why-2026-is-the-year-to-join-digitalocean)

### 📄 A closer look at a BGP anomaly in Venezuela

There has been speculation about the cause of a BGP anomaly observed in Venezuela on January 2. We take a look at BGP route leaks, and dive into what the data suggests caused the anomaly in question.

**📅 Jan 6, 2026** • **📰 Cloudflare Blog**

[**🔗 Read more**](https://blog.cloudflare.com/bgp-route-leak-venezuela/)

### 📄 Canonical announces Ubuntu support for the NVIDIA Rubin platform

Official Ubuntu support for the NVIDIA Rubin platform, including the NVIDIA Vera Rubin NVL72 rack-scale systems, announced at CES 2026 CES 2026, Las Vegas. – Canonical, the publisher of Ubuntu, is ple

**📅 Jan 5, 2026** • **📰 Ubuntu Blog**

[**🔗 Read more**](https://ubuntu.com//blog/nvidia-vera-rubin-ubuntu-support)

---

## 📰 Misc

### 📄 Red Hat Performance and Scale Engineering

Red Hat's most recent posts about Performance, Scale, Chaos and more.LATEST BLOGSAutoscaling vLLM with OpenShift AI model serving: Performance validationNovember 26, 2025 Alberto PerdomoIn my previous

**📅 Jan 29, 2026** • **📰 Red Hat Blog**

[**🔗 Read more**](https://www.redhat.com/en/blog/red-hat-performance-and-scale-engineering)

### 📄 Meta Introduces Confucius Code Agent: A New Approach to AI-Powered Software Engineering

Explore the Confucius Code Agent by Meta and Harvard, designed to enhance productivity in software engineering with a focus on agent architecture and operational performance.

**📅 Jan 12, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/meta-introduces-confucius-code-agent-a-new-approach-to-ai-powered-software-engineering/)

### 📄 Five Great DevOps Job Opportunities

Discover DevOps career opportunities at top companies like DevAltus, Nityo Infotech Corp., CyberCoders, Pacific Life, and Stanley Black & Decker in our weekly jobs report.

**📅 Jan 12, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/five-great-devops-job-opportunities-171/)

### 📄 SRE Weekly Issue #505

View on sreweekly.com A message from our sponsor, Hopp: Paging at 2am? 🚨 Make incident triage feel like you’re at the same keyboard with Hopp. crisp, readable screen-sharing no more “can you zoom in?

**📅 Jan 12, 2026** • **📰 SRE Weekly**

[**🔗 Read more**](https://sreweekly.com/sre-weekly-issue-505/)

### 📄 When To Use GenAI: A Practical Decision Framework

As generative artificial intelligence (GenAI) capabilities evolve, software architects and developers face critical decisions about when to use GenAI-based solutions The post When To Use GenAI: A Prac

**📅 Jan 11, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/when-to-use-genai-a-practical-decision-framework/)

### 📄 The Key to Agentic Success? BASH Is All You Need

Agent builders are finding that sometimes the easiest way for an agent to do its job is to simply give The post The Key to Agentic Success? BASH Is All You Need appeared first on The New Stack.

**📅 Jan 11, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/the-key-to-agentic-success-let-unix-bash-lead-the-way/)

### 📄 Python: What’s Coming in 2026

If 2025 was “the year of type checking and language server protocols” for Python, will 2026 be the year of The post Python: What’s Coming in 2026 appeared first on The New Stack.

**📅 Jan 11, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/python-whats-coming-in-2026/)

### 📄 Build Cheaper, Safer, Auditable AI with SLMs and RAG

Enterprises experimenting with large language models (LLMs) often encounter the same challenges once pilot projects move into production. Infrastructure costs The post Build Cheaper, Safer, Auditable 

**📅 Jan 10, 2026** • **📰 The New Stack**

[**🔗 Read more**](https://thenewstack.io/build-cheaper-safer-auditable-ai-with-slms-and-rag/)

### 📄 DeepSeek to Unfurl AI Model with Enhanced Coding Capabilities in February: Report

DeepSeek is preparing to launch its next-generation artificial intelligence (AI) model, V4, in mid-February, according to a report in The Information, citing two people with direct knowledge of the co

**📅 Jan 9, 2026** • **📰 DevOps.com**

[**🔗 Read more**](https://devops.com/deepseek-to-unfurl-ai-model-with-enhanced-coding-capabilities-in-february-report/)

### 📄 London called, and the world answered: creating a Summit without borders

When we announced that the Ubuntu Summit 25.10 would be a remote event, we knew we were taking a big step. We asked ourselves: how can we capture the spirit of an in-person community event and convey 

**📅 Jan 9, 2026** • **📰 Ubuntu Blog**

[**🔗 Read more**](https://ubuntu.com//blog/london-called-and-the-world-answered-creating-a-summit-without-borders)

### 📄 Bringing Real Users Into a Product Team Gathering – A JetBrains Research Story

In product development, assumptions about how people will use a tool don’t always align with the practical reality. Last spring, during a gathering of our Junie team, we set out to bridge that gap by 

**📅 Jan 9, 2026** • **📰 JetBrains Blog**

[**🔗 Read more**](https://blog.jetbrains.com/research/2026/01/bringing-real-users-into-a-product-team-gathering-a-jetbrains-research-story/)

### 📄 How AI Is Rewriting DevOps: Practical Patterns for Faster, Safer Releases

DevOps has always sought to deliver software faster without breaking things — a balancing act between velocity and stability. Now, artificial intelligence is dramatically shifting that balance. AI-pow

**📅 Jan 9, 2026** • **📰 DZone DevOps**

[**🔗 Read more**](https://feeds.dzone.com/link/23568/17250043/how-ai-is-rewriting-devops-practical-patterns)
