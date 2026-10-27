---
title: 'OWASP Top 10'
seoTitle: 'OWASP Top 10:2025 Explained: Each Risk With Code and Fixes'
description: 'The OWASP Top 10:2025 for developers and DevOps teams: what changed since 2021, each risk with vulnerable code and its fix, and tests and scanners for CI.'
category:
  name: 'Security'
  slug: 'security'
publishedAt: '2025-01-18'
updatedAt: '2026-10-27T09:00:00Z'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Security
  - OWASP
  - OWASP Top 10
  - Web Security
  - Application Security
  - DevSecOps
  - Node.js
---

The OWASP Top 10 is a short list of the most critical security risks to web applications, published by the Open Worldwide Application Security Project (OWASP). It is an awareness document: it tells developers, testers and the people who run applications where most real problems come from, so they know what to look for first.

The current edition is the **[OWASP Top 10:2025](https://owasp.org/Top10/2025/)**, the eighth since 2003. It was published as a release candidate in November 2025 and finalized in December 2025. The data behind it covers more than 2.8 million tested applications, and its ten categories group 248 CWEs (Common Weakness Enumeration entries, the standard names for types of software flaws). Eight categories come from that test data and two from a community survey, because some risks, such as supply chain attacks, are hard to find with automated tests and are therefore underrepresented in the data.

This guide explains each 2025 category with the vulnerable pattern, the fix, and the test or scanner that catches it before it ships. Most examples run in a small companion app; the rest are short snippets for patterns the app does not use, such as JSON Web Token validation. Every output you see comes from a real run.

## What Changed in the 2025 Edition

Two categories are new, one was merged into another, and three were renamed. Here is the 2025 list next to its 2021 position:

| 2025                                                                                                    | 2021                                           | Change                                                            |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------- |
| [A01 Broken Access Control](/guides/owasp-top-10/01-broken-access-control)                              | A01                                            | Still first; now includes SSRF                                    |
| [A02 Security Misconfiguration](/guides/owasp-top-10/05-security-misconfiguration)                      | A05                                            | Up three places                                                   |
| [A03 Software Supply Chain Failures](/guides/owasp-top-10/06-vulnerable-components)                     | A06 Vulnerable and Outdated Components         | Wider scope: builds, CI/CD, registries, developer tools           |
| [A04 Cryptographic Failures](/guides/owasp-top-10/02-cryptographic-failures)                            | A02                                            | Down two places                                                   |
| [A05 Injection](/guides/owasp-top-10/03-injection)                                                      | A03                                            | Down two places; still includes cross-site scripting              |
| [A06 Insecure Design](/guides/owasp-top-10/04-insecure-design)                                          | A04                                            | Down two places                                                   |
| [A07 Authentication Failures](/guides/owasp-top-10/07-authentication-failures)                          | A07 Identification and Authentication Failures | Renamed                                                           |
| [A08 Software or Data Integrity Failures](/guides/owasp-top-10/08-software-integrity-failures)          | A08 Software and Data Integrity Failures       | Renamed                                                           |
| [A09 Security Logging and Alerting Failures](/guides/owasp-top-10/09-logging-failures)                  | A09 Security Logging and Monitoring Failures   | Renamed: logs without alerts do not help                          |
| [A10 Mishandling of Exceptional Conditions](/guides/owasp-top-10/11-mishandling-exceptional-conditions) | A10 Server-Side Request Forgery (SSRF)         | New category; [SSRF](/guides/owasp-top-10/10-ssrf) moved into A01 |

A few points stand out in the [2025 introduction](https://owasp.org/Top10/2025/0x00_2025-Introduction/):

- **Root causes over symptoms.** The categories name what went wrong ("cryptographic failure"), not the result ("sensitive data exposure").
- **Supply chain attacks top the survey.** Half of the survey respondents ranked Software Supply Chain Failures first. It has the fewest occurrences in the test data but the highest average exploit and impact scores.
- **Configuration keeps growing.** More of an application's behavior now lives in configuration, and Security Misconfiguration rose from fifth to second.
- **Errors are a category of their own.** A10 collects failures around unexpected conditions: error messages that leak details, code that fails open, and transactions that stop halfway.

## Where the Risks Show Up

The categories are not all about application code. They map to different stages of how software gets built and run, which also tells you which team usually owns the fix:

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Design", "sub": "A06 insecure design", "icon": "branch", "tone": "violet" },
    { "label": "Build", "sub": "A03 supply chain, A08 integrity", "icon": "box", "tone": "amber" },
    { "label": "Configure", "sub": "A02 misconfiguration", "icon": "gear", "tone": "blue" },
    { "label": "Run", "sub": "A01, A04, A05, A07, A10", "icon": "server", "tone": "red" },
    { "label": "Watch", "sub": "A09 logging and alerting", "icon": "activity", "tone": "green" }
  ]
}
```

## The Companion App

The guide uses one small application throughout: an invoices API built with Express 5 on Node.js 24 LTS, with an in-memory SQLite database (Node's built-in `node:sqlite`). It has users, sessions, invoices, orders and accounts, which is enough to show every category in a realistic shape.

```github
https://github.com/The-DevOps-Daily/guide-owasp-top-10-demo-2026-10-27
```

The repository has two versions of the same routes:

- `vulnerable/` is the "before" version. Each route has the flaw that one part of this guide explains. It exists so you can see what tests and scanners report. Never deploy it.
- `src/` is the fixed version. Each part shows the relevant file and explains the change.

The `tests/` directory has one test file per category, and `APP=vulnerable` runs a test file against the vulnerable version. Both servers listen on `127.0.0.1` only. The scanner output in the guide (Semgrep, Trivy, zizmor and the ZAP baseline scan) comes from the repository's `guide.yml` workflow on GitHub-hosted runners; everything else ran locally on Node.js 24.22.1.

Set it up once; every part starts from this state:

```terminal
{
  "title": "set up the companion app",
  "prompt": "$",
  "steps": [
    {
      "cmd": "git clone https://github.com/The-DevOps-Daily/guide-owasp-top-10-demo-2026-10-27.git",
      "output": "Cloning into 'guide-owasp-top-10-demo-2026-10-27'..."
    },
    {
      "cmd": "cd guide-owasp-top-10-demo-2026-10-27"
    },
    {
      "cmd": "npm ci",
      "output": "added 81 packages, and audited 82 packages in 5s\n\nfound 0 vulnerabilities"
    },
    {
      "cmd": "npm test",
      "output": "  ✔ 3fff::1 is not public (0.289737ms)\n✔ SSRF: isPublicAddress (8.3735ms)\nℹ tests 53\nℹ suites 10\nℹ pass 53\nℹ fail 0\nℹ cancelled 0\nℹ skipped 0\nℹ todo 0\nℹ duration_ms 8398.825926"
    }
  ]
}
```

:::warning
The code in `vulnerable/` is deliberately insecure. Run it only on your own machine, and do not copy its routes into a real application. The fixed code in `src/` is written for teaching: use it to understand the patterns, and prefer well-maintained libraries and your framework's built-in features in production.
:::

## Prerequisites

- Node.js 24.7 or later (24 is the current LTS line; 24.7 added the built-in `crypto.argon2` that Part 5 uses), npm, git, `curl` and `jq`.
- Basic JavaScript and HTTP: routes, status codes, headers and JSON.
- Docker, if you want to run the Semgrep, Trivy and ZAP commands yourself. The guide shows their output from CI runs.

No security background is needed. Each part explains its terms as they come up.

## The Learning Path

The parts follow the 2025 order. Server-side request forgery is now part of A01, so it comes right after it.

1. **[A01:2025 Broken Access Control](/guides/owasp-top-10/01-broken-access-control)**: users reading or changing data that is not theirs, missing role checks, and tests that prove each check exists.
2. **[SSRF, part of A01:2025](/guides/owasp-top-10/10-ssrf)**: a server tricked into fetching internal URLs, and a fetch function that checks the address it connects to.
3. **[A02:2025 Security Misconfiguration](/guides/owasp-top-10/05-security-misconfiguration)**: default credentials, stack traces, missing headers and insecure container and cloud settings, found with ZAP and Trivy.
4. **[A03:2025 Software Supply Chain Failures](/guides/owasp-top-10/06-vulnerable-components)**: vulnerable and malicious dependencies, SBOMs, release-age delays and a hardened CI workflow.
5. **[A04:2025 Cryptographic Failures](/guides/owasp-top-10/02-cryptographic-failures)**: password hashing with Argon2id, authenticated encryption, key rotation, randomness and TLS with post-quantum key exchange.
6. **[A05:2025 Injection](/guides/owasp-top-10/03-injection)**: SQL, command and HTML injection, the fix for each, and what Semgrep finds.
7. **[A06:2025 Insecure Design](/guides/owasp-top-10/04-insecure-design)**: business logic flaws, abuse cases as tests, and design reviews that catch missing controls.
8. **[A07:2025 Authentication Failures](/guides/owasp-top-10/07-authentication-failures)**: credential stuffing, rate limits, breached-password checks, sessions, MFA and passkeys.
9. **[A08:2025 Software or Data Integrity Failures](/guides/owasp-top-10/08-software-integrity-failures)**: mass assignment, unsafe deserialization, Subresource Integrity, signatures and build provenance.
10. **[A09:2025 Security Logging and Alerting Failures](/guides/owasp-top-10/09-logging-failures)**: what to log, structured logs without secrets, and alerts that someone acts on.
11. **[A10:2025 Mishandling of Exceptional Conditions](/guides/owasp-top-10/11-mishandling-exceptional-conditions)**: failing closed, rolling back transactions, central error handling and limits.

## How to Use the List

The Top 10 is a starting point, not a standard. OWASP itself says so: it is a list of the most common and impactful risk categories, not a complete set of requirements, and nothing can be "OWASP Top 10 compliant" in a meaningful way. Use it like this:

- **Training and code review.** The categories give your team a shared vocabulary and a list of patterns to look for.
- **Threat modeling.** When you model a new feature, walk the ten categories as prompts. The [Threat Modeling guide](/guides/threat-modeling) shows how.
- **Test coverage.** For each category that applies to your application, ask which test or scanner would catch a regression. This guide pairs every category with one.
- **Requirements.** When you need verifiable requirements, use the [OWASP Application Security Verification Standard (ASVS)](https://owasp.org/www-project-application-security-verification-standard/), currently version 5.0, which the Top 10 references throughout.

## Keep Learning

- [SAST Tools guide](/guides/sast-tools): Semgrep, CodeQL and SonarQube in depth
- [Security Gates guide](/guides/security-gates): turning scanner results into pipeline decisions
- [Threat Modeling guide](/guides/threat-modeling): STRIDE, attack trees and design reviews
- [Interview questions: Security Architecture and DevSecOps](/interview-questions/senior/security-architecture)
