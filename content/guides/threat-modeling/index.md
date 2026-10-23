---
title: 'Threat Modeling'
seoTitle: 'Threat Modeling Guide: STRIDE, DREAD, Attack Trees and Exercises'
description: 'Learn threat modeling on one worked example: data flow diagrams, STRIDE, risk rating beyond DREAD, attack trees, LINDDUN, LLM threats and exercises.'
category:
  name: 'Security'
  slug: 'security'
publishedAt: '2025-01-24'
updatedAt: '2026-10-23'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Security
  - DevSecOps
  - Threat Modeling
  - STRIDE
  - DREAD
  - Attack Trees
---

The [Threat Modeling Manifesto](https://www.threatmodelingmanifesto.org/) defines threat modeling as "analyzing representations of a system to highlight concerns about security and privacy characteristics". In practice you draw how a system works, ask what can go wrong, decide what to do about it, and check that you did a good enough job. You can do it before any code exists, when changing the design costs least, and it finds problems that scanners cannot see: a webhook nobody verifies, a refund that leaves the ticket valid, a queue that trusts every message.

This guide teaches the methods on one example system, a small ticket shop with an API, a database, a job queue and a third-party payment provider, so that every diagram, table, score and tree refers to the same components.

Most teams organize the work around four questions, popularized by Adam Shostack as the **Four Question Framework**:

```diagram
{
  "type": "loop",
  "goal": "Threat modeling: find and fix design problems before attackers do",
  "loopBack": "the design changes: model the change",
  "nodes": [
    { "label": "What are we working on?", "sub": "data flow diagram, trust boundaries", "variant": "soft" },
    { "label": "What can go wrong?", "sub": "STRIDE, LINDDUN, attack trees", "variant": "soft" },
    { "label": "What are we going to do about it?", "sub": "prioritize, mitigate, own", "variant": "solid" },
    { "label": "Did we do a good enough job?", "sub": "review, test, revisit", "variant": "accent" }
  ]
}
```

## What You'll Learn

1. **[STRIDE](/guides/threat-modeling/01-stride)**: draw a data flow diagram with trust boundaries, then find threats in six categories (spoofing, tampering, repudiation, information disclosure, denial of service, elevation of privilege), with mitigations for each. Also LINDDUN for privacy threats.
2. **[DREAD and what to use instead](/guides/threat-modeling/02-dread)**: how DREAD scores work, why Microsoft stopped using them, and how teams prioritize today: likelihood times impact, a bug bar, and CVSS 4.0 for confirmed vulnerabilities.
3. **[Attack trees](/guides/threat-modeling/03-attack-trees)**: break an attacker's goal into AND and OR steps, find the cheapest attack path, and see which fix raises it most.
4. **[Practical exercises](/guides/threat-modeling/04-practical-exercises)**: how to run a session, six exercises with solutions (including an AI support assistant), and threat modeling as code with OWASP pytm.

## The Example Used in Every Part

The ticket shop sells tickets for live events. Customers order through the API, pay on the payment provider's hosted checkout page, and get QR-code tickets once the provider's webhook confirms the payment and a worker issues them. Staff use admin pages in the same app. The boxes below are the trust zones that [Part 1](/guides/threat-modeling/01-stride#h3-trust-boundaries) turns into trust boundaries; the row on top is the purchase path.

```diagram
{
  "type": "infra",
  "flow": [
    { "label": "Customer", "sub": "order", "icon": "globe", "tone": "red" },
    { "label": "API", "sub": "hold seats", "icon": "server", "tone": "blue" },
    { "label": "Provider", "sub": "hosted checkout", "icon": "cloud", "tone": "amber" },
    { "label": "API", "sub": "signed webhook", "icon": "server", "tone": "blue" },
    { "label": "Worker", "sub": "issue tickets", "icon": "gear", "tone": "violet" }
  ],
  "groups": [
    {
      "label": "Internet",
      "sub": "untrusted",
      "icon": "globe",
      "tone": "red",
      "nodes": [
        { "label": "Customer", "sub": "browser or app", "icon": "globe", "tone": "red" },
        { "label": "Staff admin", "sub": "/admin pages", "icon": "globe", "tone": "red" }
      ]
    },
    {
      "label": "Your cloud account",
      "icon": "cloud",
      "tone": "blue",
      "groups": [
        {
          "label": "Public app tier",
          "sub": "behind the load balancer",
          "icon": "net",
          "tone": "blue",
          "nodes": [{ "label": "API", "sub": "web app + JSON API", "icon": "server", "tone": "blue" }]
        },
        {
          "label": "Private network",
          "sub": "no inbound Internet access",
          "icon": "lock",
          "tone": "violet",
          "nodes": [
            { "label": "Postgres", "sub": "users, orders, tickets", "icon": "database", "tone": "violet" },
            { "label": "Job queue", "sub": "Redis", "icon": "queue", "tone": "violet" },
            { "label": "Worker", "sub": "issues tickets", "icon": "gear", "tone": "violet" }
          ]
        }
      ]
    },
    {
      "label": "Payment provider",
      "sub": "third party",
      "icon": "cloud",
      "tone": "amber",
      "nodes": [
        { "label": "Hosted checkout", "sub": "card details", "icon": "lock", "tone": "amber" },
        { "label": "Webhooks", "sub": "payment.succeeded", "icon": "cloud", "tone": "amber" },
        { "label": "API", "sub": "checkout sessions, refunds", "icon": "cloud", "tone": "amber" }
      ]
    }
  ]
}
```

## What Changed Since Older Tutorials

Many threat modeling tutorials, including the first version of this guide, still teach a 2000s workflow. These changes matter if you learned it that way:

| Change                                                                 | Since         | What it means for you                                                                                                 |
| ---------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------- |
| Microsoft moved from DREAD to a bug bar                                | Late 2000s    | DREAD scores are inconsistent between people; use likelihood times impact with reasons, or a bug bar                  |
| Threat Modeling Manifesto                                              | 2020          | A shared definition and values: collaboration over tools, continuous refinement over a single delivery                |
| CVSS v4.0                                                              | November 2023 | New Attack Requirements metric, threat metrics instead of temporal ones, and CVSS-B, CVSS-BT, CVSS-BE, CVSS-BTE names |
| OWASP Top 10 for LLM Applications 2025                                 | November 2024 | Prompt injection, excessive agency and unbounded consumption belong in threat models of AI features                   |
| OWASP Top 10 for Agentic Applications                                  | December 2025 | Risks for AI agents that plan and call tools                                                                          |
| Threat modeling as code (pytm 1.4.0 adds an LLM element and LLM rules) | July 2026     | Keep the model in the repository and review it in pull requests                                                       |

## Tools

You can threat model with a whiteboard, and the methods matter more than the tool. When you want one:

| Tool                           | What it does                                                               | Runs on                                        |
| ------------------------------ | -------------------------------------------------------------------------- | ---------------------------------------------- |
| OWASP Threat Dragon 2.6        | Draw DFDs and record threats with STRIDE, LINDDUN, CIA, CIA-DIE or PLOT4ai | Desktop app for Windows, macOS, Linux; web app |
| Microsoft Threat Modeling Tool | Draw DFDs from templates and generate STRIDE threats per element           | Windows only (version 7.3, November 2025)      |
| OWASP pytm 1.4                 | Model as Python code; generates a DFD and a threat list from 114 rules     | Python 3.11+, Graphviz for diagrams            |
| Threagile                      | Model as YAML; runs risk rules and produces reports                        | Docker image                                   |
| Deciduous                      | Attack and decision trees with mitigations                                 | Web app                                        |
| Markdown and Mermaid           | A threat register and diagrams next to the code, reviewed in pull requests | Any Git host that renders Mermaid              |

[Part 4](/guides/threat-modeling/04-practical-exercises#h2-keep-the-threat-model-in-the-repository-with-pytm) runs pytm on the ticket shop and shows what a rule-based tool finds and what it misses.

## When to Threat Model

- When you design a new service, before the code is written.
- When a change moves a trust boundary: a new public endpoint, a new third party, a new kind of personal data, a change to authentication or authorization.
- When you add an AI feature that reads untrusted text or can call tools.
- After an incident or a penetration test finding that the model did not predict.

A full session for a small system takes 60 to 90 minutes. Modeling a single change often takes 15 minutes in a design review.

## Prerequisites

- You know how a web application, a database and an external API talk to each other.
- You know the common web vulnerabilities by name. The [OWASP Top 10 guide](/guides/owasp-top-10) covers them.
- No prior threat modeling experience. Python 3 is optional, for the scripts in Parts 2 to 4.

## Who This Guide Is For

- DevOps and platform engineers who review designs and run the systems they describe.
- Developers who want to design features that are hard to abuse.
- Security engineers who want a lightweight, repeatable process for their teams.
- Students preparing for exams or interviews that ask about STRIDE, DREAD and attack trees.

Start with [Part 1: STRIDE](/guides/threat-modeling/01-stride).

## Keep Learning

- [Security Principles guide](/guides/security-principles), for the properties threats break
- [SAST guide](/guides/sast-tools), to find the code-level bugs behind many threats
- [Security Gates guide](/guides/security-gates), to enforce decisions in CI/CD
- [Security-Focused Code Reviews](/posts/security-focused-code-reviews)
- [Interview question: security architecture and DevSecOps](/interview-questions/senior/security-architecture)
