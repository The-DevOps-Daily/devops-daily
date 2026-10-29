---
title: 'Security Principles'
seoTitle: 'Security Principles: CIA Triad, Defense in Depth, Least Privilege, Zero Trust'
description: 'The CIA triad, defense in depth, least privilege and zero trust, each tested on a small app on Linux and Kubernetes with real commands and output.'
category:
  name: 'Security'
  slug: 'security'
publishedAt: '2025-01-18'
updatedAt: '2026-10-27'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Security
  - DevSecOps
  - CIA Triad
  - Defense in Depth
  - Least Privilege
  - Zero Trust
  - Kubernetes
---

Every security control you configure answers a question. A backup schedule answers "what if the data is gone?", an IAM policy answers "who may do this?", a NetworkPolicy answers "who may talk to whom?". Four principles give you those questions in a form you can apply to any system: the **CIA triad** tells you what you are protecting, **defense in depth** tells you not to rely on one control, **least privilege** tells you how much access to give, and **zero trust** tells you how to decide each request.

This guide does not stop at definitions. You apply each principle to one small but realistic system and test it with real commands: secrets leaking through process lists and Git history, an SSH setting that loses to a cloud-init file, a SQL injection stopped by a database role, a Kubernetes deploy account that can read Secrets it is not allowed to read, and a pod that copies a label to get past a network policy until mutual TLS identity stops it.

## How the Parts Fit Together

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "CIA triad", "sub": "Part 1: what to protect", "icon": "lock", "tone": "blue" },
    { "label": "Defense in depth", "sub": "Part 2: more than one layer", "icon": "shield", "tone": "green" },
    { "label": "Least privilege", "sub": "Part 3: how much access", "icon": "gear", "tone": "amber" },
    { "label": "Zero trust", "sub": "Part 4: verify every request", "icon": "check", "tone": "violet" }
  ]
}
```

1. [The CIA Triad](/guides/security-principles/01-cia-triad): confidentiality, integrity and availability, how to classify data, and controls for each: secrets handling, signed commits, digests, probes, spread replicas, rate limits and immutable backups.
2. [Defense in Depth](/guides/security-principles/02-defense-in-depth): one SQL injection followed through the edge, network, host, application, data and detection layers, with security groups, NetworkPolicies, SSH, AIDE, parameterized queries, a hardened container, a WAF and encryption.
3. [Least Privilege](/guides/security-principles/03-least-privilege): Postgres roles, systemd sandboxing, Kubernetes RBAC and its escalation paths, Pod Security, IAM policies, just-in-time access and access reviews.
4. [Zero Trust Architecture](/guides/security-principles/04-zero-trust): why labels and IP addresses are not identity, mTLS and identity-based policy with Istio ambient mode, JWTs at the edge, devices, and OIDC for CI/CD.

## The Example System

All four parts use the ticket shop from the [Threat Modeling guide](/guides/threat-modeling/01-stride#h2-the-example-system-a-ticket-shop): customers buy tickets through an **API**, a **payment provider** takes the payments and sends signed webhooks, a **worker** issues the tickets, and **Postgres** stores users, orders and tickets. Threat modeling finds what can go wrong with it; this guide builds the controls. In the lab, the API is a small Python stand-in and everything runs on a local kind cluster in a namespace called `shop`, plus an Ubuntu machine for the host and database examples.

## What Changed Recently

If you learned these principles a few years ago, the ideas are the same but the tools moved:

- **NIST Cybersecurity Framework 2.0** (February 2024) added a sixth function, **Govern**, to Identify, Protect, Detect, Respond and Recover: security decisions now explicitly need owners and risk appetite.
- **NIST SP 800-63-4** (July 2025) requires verifiers to offer a phishing-resistant MFA option at AAL2 and accepts synced passkeys there. **NIST SP 1800-35** (June 2025) documents 19 working zero trust implementations.
- **The OWASP Top 10:2025** keeps **Broken Access Control** at A01 and folds server-side request forgery into it: least privilege is still the most common failure.
- **OpenSSH 9.8+** blocks repeated failed logins by default (`PerSourcePenalties`), and `Protocol 2` lines in old hardening guides have done nothing since 2016.
- **Kubernetes** enforces the Pod Security Standards with a built-in admission controller, the ingress-nginx controller was retired in March 2026 in favour of the Gateway API, and kind enforces NetworkPolicies out of the box.
- **Istio's ambient mode** (generally available since 1.24) gives workloads mTLS identity without sidecars.
- **GitHub Actions OIDC** tokens for new repositories include immutable owner and repository IDs in the subject claim (since July 2026), which changes cloud trust policies.

## Prerequisites

- Comfort with a Linux shell, Git and basic Kubernetes (`kubectl apply`, pods, Deployments).
- An **Ubuntu or Debian machine** where you can use `sudo`, ideally a throwaway VM, for the host, SSH, systemd and Postgres examples. The outputs come from Ubuntu 26.04 LTS.
- **Docker, [kind](https://kind.sigs.k8s.io/docs/user/quick-start/) 0.33 and kubectl 1.37** for the Kubernetes examples (Kubernetes 1.37), and about 4 GB of free memory once Istio runs in Part 4.
- **No cloud account.** The AWS and Terraform examples are shown for reading; the companion repository checks their syntax without credentials.

Clone the companion repository. Every file in the guide is in it, under `part01` to `part04`:

```bash
git clone https://github.com/The-DevOps-Daily/guide-security-principles-demo-2026-10-27.git ~/security-principles-demo
```

```github
https://github.com/The-DevOps-Daily/guide-security-principles-demo-2026-10-27
```

Its GitHub Actions workflow runs every Linux and Kubernetes command in this guide on Ubuntu 26.04 runners (kind 0.33 with Kubernetes 1.37, Istio 1.31.3, PostgreSQL 18.6, OpenSSH 10.2, AIDE 0.19) and checks the AWS CLI, Terraform and workflow examples for syntax. All output shown in the guide comes from those runs.

## Who This Guide Is For

- DevOps and platform engineers who configure the controls and want to know which ones matter.
- Developers who want to see what happens below their code when something goes wrong.
- Anyone preparing for security interviews or audits who prefers examples to definitions.

## Keep Learning

- [Threat Modeling](/guides/threat-modeling): find what can go wrong before you choose controls
- [Cryptography Essentials](/guides/cryptography-essentials): the encryption, hashing, TLS and PKI behind confidentiality and integrity
- [OWASP Top 10](/guides/owasp-top-10): the application-level failures these principles prevent
- [Networking Fundamentals](/guides/networking-fundamentals): firewalls, segmentation and cloud networks in depth
- [Security Gates](/guides/security-gates): enforcing these rules in CI/CD
- [Interview questions: security architecture and DevSecOps](/interview-questions/senior/security-architecture)
