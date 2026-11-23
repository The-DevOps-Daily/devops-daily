---
title: "DevOps Weekly Digest - Week 48, 2026"
date: "2026-11-23"
summary: "PostgreSQL 19 is out, nginx2root and Java4Shell need patching, kube-proxy IPVS gets a removal date, plus 22 more DevOps updates from week 48."
---

## 📌 This week in short

<!-- editor-intro: 2-4 plain lines from the editor go between these markers. Empty renders nothing. -->
A patch-heavy week. PostgreSQL 19 is out (our upgrade checklist is below), and nginx2root, Java4Shell and ruby2shell all need attention if you run nginx, Java or Ruby.

If you still use the IPVS mode of kube-proxy, Kubernetes has now scheduled its removal, so plan the move to iptables or nftables.
<!-- /editor-intro -->

**[Amazon CloudWatch EKS Container Insights now offers built-in monitoring for open source Kubernetes tools](https://aws.amazon.com/about-aws/whats-new/2026/11/cloudwatch-eks-kubernetes-tools/)**
AWS What's New · Nov 20
Today, Amazon CloudWatch announces built-in monitoring for open source tools running on your Amazon EKS clusters, including Karpenter, KEDA, vLLM, KServe, SGLang, Ray and Knative Serving.

**[When a sync window closes: How Argo CD self-heal skipped the migration hook](https://www.cncf.io/blog/2026/11/20/when-a-sync-window-closes-how-argo-cd-self-heal-skipped-the-migration-hook/)**
CNCF Blog · Nov 20
The uncomfortable question A few days ago, a customer asked me a question that sounded simple: “Argo CD said the sync succeeded, so why didn’t our migration run?”

**[Introducing in-place migration to GKE Dataplane V2](https://cloud.google.com/blog/products/networking/gke-dataplane-v2-in-place-migration/)**
Google Cloud Blog · Nov 19
GKE Dataplane V2 is Google Cloud’s next-generation networking dataplane for Google Kubernetes Engine (GKE), built on extended Berkeley Packet Filter (eBPF) and open-source Cilium to replace...

## 🚀 Releases

- **PostgreSQL** [19](https://www.postgresql.org/about/news/postgresql-19-released-3449/)
- **Docker Compose** [5.8.0](https://github.com/docker/compose/releases/tag/v5.8.0) (also 5.7.2)
- **Moby (Docker Engine)** [29.10.0](https://github.com/moby/moby/releases/tag/docker-v29.10.0)
- **Helm** [4.3.2](https://github.com/helm/helm/releases/tag/v4.3.2) (also 4.3.1)
- **Argo CD** [3.6.2](https://github.com/argoproj/argo-cd/releases/tag/v3.6.2) (also 3.5.8 and 3.4.14)
- **Cilium** [1.20.5](https://github.com/cilium/cilium/releases/tag/1.20.5) (also 1.19.11 and 1.18.17)

## ⚓ Kubernetes

**[Announcing the general availability of a new AWS Local Zone in Bogotá, Colombia](https://aws.amazon.com/about-aws/whats-new/2026/11/aws-local-zone-bogota-colombia/)**
AWS What's New · Nov 20
Today, AWS announces the general availability of a new Local Zone in Bogotá, Colombia, bringing AWS infrastructure closer to end users for applications that require single-digit millisecond latency.

**[Scheduling the removal of the kube-proxy IPVS backend](https://kubernetes.io/blog/2026/11/16/ipvs-removal/)**
Kubernetes Blog · Nov 16
The ipvs backend for kube-proxy was an experiment in providing a service proxy implementation with better performance than the iptables backend.

**[How to support your app on Kubernetes environments you don’t control](https://www.cncf.io/blog/2026/11/19/how-to-support-your-app-on-kubernetes-environments-you-dont-control/)**
CNCF Blog · Nov 19
Running an application in Kubernetes is one thing, but supporting that application in Kubernetes environments your customers run is something else entirely.

## ☁️ Cloud Native

**[AWS Lambda adds support for Python 3.15](https://aws.amazon.com/about-aws/whats-new/2026/11/aws-lambda-python-315/)**
AWS What's New · Nov 20
AWS Lambda now supports creating serverless applications using Python 3.15. Python 3.15 is generally available for Lambda Event Functions and is available in public preview for Lambda Web Functions.

**[etcd Patch Releases: v3.7.4, v3.6.17, v3.5.36](https://etcd.io/blog/2026/nov-17-patch-release/)**
etcd Blog · Nov 17
SIG-etcd has published patch releases for all three supported versions of etcd v3.7.4, v3.6.17 and v3.5.36. These updates improve recovery behavior and concurrency safety, and include additional version-specific fixes.

**[Docker patches Java4Shell and the NGINX HTTP/2 with Docker Hardened Images](https://www.docker.com/blog/docker-patches-java4shell-and-the-nginx-http-2-with-docker-hardened-images/)**
Docker Blog · Nov 19
Docker publishes fixed images for both Java4Shell and the NGINX HTTP/2 in the Docker Hardened Images (DHI) catalog.

**[Meet the New Docker: Built to Run on Trust](https://www.docker.com/blog/meet-the-new-docker-built-to-run-on-trust/)**
Docker Blog · Nov 19
Docker launches a new brand built on trust. Learn why Docker is evolving for AI agents, what stays the same, and how to run agents securely with Docker.

**[The Trust Layer: Securing Agentic AI with Docker AI Governance](https://www.docker.com/blog/agentic-ai-security-docker-governance/)**
Docker Blog · Nov 18
Learn how Docker AI Governance secures agentic AI with sandbox policies, MCP tool governance, and audit visibility to support controlled AI agent workflows.

## 🔄 CI/CD

**[The best things in open source are built together](https://github.blog/open-source/maintainers/the-best-things-in-open-source-are-built-together/)**
GitHub Blog · Nov 19
Introducing Replica and the Open Source Accessibility Framework, new open source projects for collaboration and inclusion.

**[gt 2.0.0: a quarter of the tokens for AI agents, and flags like gh](https://blog.gitea.com/release-of-gitea-cli-2.0.0/)**
Gitea Blog · Nov 18
We are releasing gitea-cli 2.0.0. Just over two weeks after \[1.0.0\](/release-of-gitea-cli-1.0.0/), this major release makes \`gt\` much cheaper to use from AI coding agents: the log of a failed run now costs about a quarter of the tokens...

**[Cut your vulnerability backlog with agentic remediation](https://about.gitlab.com/blog/gitlab-agentic-remediation/)**
GitLab Blog · Nov 19
Vulnerability backlogs are growing faster than teams can clear them. AI writes more code and finds more flaws, while fixes still move at human speed.

## 📊 Observability

**[How Cloudflare WAF protects against ruby2shell (CVE-2026-132825)](https://blog.cloudflare.com/ruby2shell-waf-protection/)**
Cloudflare Blog · Nov 20
ruby2shell lets attackers corrupt memory in default Rails and Sinatra apps without logging in. Cloudflare WAF blocks it for every customer, including Free plans. Upgrade Ruby now, and use the WAF to cover the gap.

**[Updates to our blog policy](https://opentelemetry.io/blog/2026/blog-policy-update/)**
OpenTelemetry Blog · Nov 17
The OpenTelemetry blog is one of our most valuable communication avenues with our community. The web is changing, though, and we need to change with it.

## 🔐 Security

**[ARMORY CASTLE Exploits vSphere](https://cloud.google.com/blog/topics/threat-intelligence/armory-castle-exploits-vsphere/)**
Google Cloud Blog · Nov 19
Written by: Jayson Frost, Bryce Greathouse, Dhanesh Kizhakkinan, John Palmisano, Steve Rasch, Daniel Sislo, John Wolfram Introduction On Oct.

**[How Cloudflare WAF helps protect against Java4Shell (CVE-2026-114938)](https://blog.cloudflare.com/java4shell-waf-protection/)**
Cloudflare Blog · Nov 18
Java4Shell is a critical memory-corruption flaw in OpenJDK's Base64 decoder that can lead to remote code execution. Cloudflare has released six WAF managed rules for paid plans that logs matching requests by default.

**[Virtualization, Responsible Disclosure, and CVE-2026-99312](https://www.digitalocean.com/blog/cve-2026-99312-kvm-patch)**
DigitalOcean Blog · Nov 19
The wall between you and your neighbor Every cloud customer gets the same promise: a bright-line boundary between your workload and your neighbors.

## 💾 Databases

**[WAL-G 3.0.10 released](https://www.postgresql.org/about/news/wal-g-3010-released-3448/)**
PostgreSQL News · Nov 18
The WAL-G team is pleased to announce the release of WAL-G 3.0.10. WAL-G is an open-source backup and recovery tool for PostgreSQL, Apache Cloudberry, MySQL/MariaDB, MongoDB, Redis, and other databases.

**[Reducing database incident MTTR by 73% with a custom AWS DevOps Agent Skill](https://aws.amazon.com/blogs/devops/reducing-database-incident-mttr-by-73-with-a-custom-aws-devops-agent-skill/)**
AWS DevOps Blog · Nov 17
Database incidents routinely take 45 to 60 minutes to triage.

## 🌐 Platforms

**[Copilot Code Reviews for Azure Repos is generally available](https://devblogs.microsoft.com/devops/copilot-code-reviews-for-azure-repos-is-generally-available/)**
Azure DevOps Blog · Nov 20
Copilot Code Review for Azure Repos is now generally available. Use GitHub Copilot to review pull requests, identify issues, and suggest code changes.

**[What’s new in Managed Service for Apache Spark 4.0](https://cloud.google.com/blog/products/data-analytics/whats-new-in-managed-service-for-apache-spark-4-0/)**
Google Cloud Blog · Nov 20
As organizations move from reactive analytics to proactive systems of action powered by autonomous AI agents, data platforms face a new set of demands.

**[nginx2root: Five new nginx vulnerabilities, and how Cloudflare protects origins from the worst of them](https://blog.cloudflare.com/nginx2root/)**
Cloudflare Blog · Nov 20
Five memory corruption bugs in nginx, called nginx2root, can let an unauthenticated attacker run code on a server. Here’s how they work, and why origins behind Cloudflare's proxy are shielded from the most serious of these bugs.

## 📰 Misc

**[Visual Studio Code 1.147](https://code.visualstudio.com/updates/v1_147)**
VS Code Blog · Nov 18
Learn what's new in Visual Studio Code 1.147

## ✍️ From DevOps Daily this week

- [JavaScript Promises, Visualized: The Event Loop Behind Node.js](/posts/javascript-promises-event-loop-visualized)
- [Paste the Whole Incident Log: Where Do Models Stop Seeing the Error?](/posts/incident-log-root-cause-long-context-digitalocean-inference)
- [PostgreSQL 19 Is Out: What to Check Before You Upgrade](/posts/postgresql-19-upgrade-checklist)
- [OAuth for MCP Servers on Neon: 4 AI Clients Connect Without DCR](/posts/neon-mcp-server-oauth)
- [The DevOps Knowledge Map: 12 Areas, in the Order to Learn Them](/posts/devops-knowledge-map)
- [nginx2root: Five nginx CVEs, One Pre-Auth Path to Root, and How to Tell If Your Config Is Exposed](/posts/nginx2root-five-nginx-cves-http2-rce)
