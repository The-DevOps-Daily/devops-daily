---
title: 'Static Application Security Testing (SAST)'
seoTitle: 'SAST Tools Guide: SonarQube, Semgrep and CodeQL Compared'
description: 'Learn SAST with SonarQube, Semgrep and CodeQL: how static analysis finds vulnerabilities, custom rules and queries, and CI/CD quality gates.'
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
  - SAST
  - SonarQube
  - Semgrep
  - CodeQL
---

Static Application Security Testing (SAST) reads your source code and reports security bugs without running the application: SQL injection, command injection, hard-coded secrets, weak cryptography and hundreds of other weaknesses. Because it needs only the code, you can run it in the editor, on every pull request and on a schedule, and each finding points to a file and a line while the change is still fresh in the developer's mind.

This guide explains how SAST tools work and shows three of the most widely used ones on the same small, deliberately vulnerable Flask app, so you can see what each one finds and misses:

- **SonarQube**: a code quality and security platform with dashboards and quality gates.
- **Semgrep**: a fast pattern matcher with rules that look like the code they find.
- **CodeQL**: GitHub's semantic analysis engine, behind GitHub code scanning.

```diagram
{
  "type": "graph",
  "columns": [
    [
      { "id": "code", "label": "Code in Git", "sub": "pull request", "icon": "branch", "tone": "slate", "detail": "Every push and pull request triggers the scans." }
    ],
    [
      { "id": "sonar", "label": "SonarQube", "sub": "rules + quality gate", "icon": "gear", "tone": "blue", "detail": "Scanner in CI, results and quality gate on SonarQube Server, Community Build or Cloud." },
      { "id": "semgrep", "label": "Semgrep", "sub": "YAML rules", "icon": "shield", "tone": "green", "detail": "Registry packs plus your own rules; diff-aware scans on pull requests." },
      { "id": "codeql", "label": "CodeQL", "sub": "QL queries", "icon": "database", "tone": "violet", "detail": "Default or advanced setup on GitHub; follows data across functions and files." }
    ],
    [
      { "id": "gate", "label": "Pass or fail", "sub": "required checks", "icon": "check", "tone": "amber", "detail": "Block the merge on new, high-confidence findings." },
      { "id": "alerts", "label": "Alerts", "sub": "triage and fix", "icon": "activity", "tone": "red", "detail": "SARIF results in GitHub code scanning, GitLab or the SonarQube dashboard." }
    ]
  ],
  "edges": [["code", "sonar"], ["code", "semgrep"], ["code", "codeql"], ["sonar", "gate"], ["semgrep", "gate"], ["semgrep", "alerts", "SARIF"], ["codeql", "alerts", "SARIF"], ["sonar", "alerts"]]
}
```

## What You'll Learn

1. **[SAST Fundamentals](/guides/sast-tools/01-sast-fundamentals)**: how static analysis works, pattern rules and taint analysis, why tools miss bugs and report false ones, SARIF, and where scans belong in a pipeline.
2. **[SonarQube](/guides/sast-tools/02-sonarqube)**: the 2025 product names and editions, a Docker Compose setup, scanning a project, security rules and taint analysis, quality gates, and GitHub Actions, GitLab CI and Jenkins.
3. **[Semgrep](/guides/sast-tools/03-semgrep)**: registry rules, writing and testing your own rules, taint mode, the Opengrep fork, diff-aware scans and CI/CD.
4. **[CodeQL](/guides/sast-tools/04-codeql)**: default and advanced setup for GitHub code scanning, the CodeQL CLI, and custom queries with tests.

## SonarQube vs Semgrep vs CodeQL

|                               | SonarQube                                                   | Semgrep                                                                 | CodeQL                                                   |
| ----------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------- |
| How it analyses               | Built-in rules plus a taint engine                          | Pattern matching, taint mode                                            | Code extracted into a database, queried with QL          |
| Your own rules                | Plugins written in Java; most teams tune the built-in rules | YAML rules, easy to write and test                                      | QL queries, powerful but a language to learn             |
| Follows data across functions | Developer edition and up, and Cloud                         | With the Pro engine (Semgrep AppSec Platform); Opengrep within one file | Yes, across functions and files                          |
| Free option                   | Community Build (no taint analysis), Cloud Free             | Community Edition                                                       | Public repositories; open source and research            |
| Paid option                   | Server editions, Cloud Team and Enterprise                  | Semgrep AppSec Platform                                                 | GitHub Code Security, $30 per active committer per month |
| Beyond security               | Code quality, coverage, duplication                         | Any code rule you can express                                           | Code quality queries                                     |
| Best for                      | One dashboard and gate for quality and security             | Fast pull request checks and team-specific rules                        | Deep data-flow analysis on GitHub                        |

Most teams combine two of them: for example Semgrep for fast, custom checks in pull requests and pre-commit hooks, plus CodeQL or SonarQube for deeper data-flow analysis and a dashboard.

### What each tool found in the sample app

Every part scans the same Flask app, `notes-api`, which has six flaws and one safe query ([Part 1](/guides/sast-tools/01-sast-fundamentals#h2-the-sample-app-used-in-this-guide) lists them). The Semgrep and CodeQL columns are real results from Parts 3 and 4. SonarQube was not run for this guide; its column shows the Sonar way rule that covers each flaw:

| Flaw (line)                                      | Semgrep CE, `p/python`            | Semgrep CE, own rules | CodeQL, `security-extended`      | SonarQube rule                         |
| ------------------------------------------------ | --------------------------------- | --------------------- | -------------------------------- | -------------------------------------- |
| Hard-coded secret key (8)                        | Missed                            | Found                 | Missed (a custom query finds it) | `python:S6779`                         |
| SQL injection (19)                               | Found                             | Found                 | Found                            | `pythonsecurity:S3649`, taint analysis |
| Command injection (33)                           | Found                             | Found                 | Found                            | `pythonsecurity:S2076`, taint analysis |
| Command injection through a helper function (44) | Only by a broad `shell=True` rule | Missed                | Found                            | `pythonsecurity:S2076`, taint analysis |
| MD5 for passwords (48)                           | Found                             | No rule written       | Found                            | `python:S4790`, `python:S5344`         |
| Flask debug mode (52)                            | Found                             | Found                 | Found                            | `python:S4507`                         |
| Parameterized query (26), safe                   | Not reported                      | Not reported          | Not reported                     |                                        |

No tool found everything out of the box, and the difference between lines 33 and 44 (the same bug, with or without a function call in between) is the clearest example of why the analysis engine matters as much as the rule list.

## Which Versions This Guide Uses

The examples were run in October 2026 with **Semgrep 1.182.0**, **Opengrep 1.32.0** and **CodeQL CLI 2.27.3** (Python queries 1.8.13) on Linux, and their output in the guide is from those real runs. GitHub Actions workflows were checked with actionlint. SonarQube (**Community Build 26.10** and **Server 2026.5 LTA**) needs a Java server with several GB of memory and was not run; its configuration follows SonarSource's documentation and source code, and its output is shown as labelled examples.

If you learned SAST tools from older tutorials, these changes matter:

| Change                                                                               | Since         | What it means for you                                                             |
| ------------------------------------------------------------------------------------ | ------------- | --------------------------------------------------------------------------------- |
| SonarQube renamed: Server, Community Build, Cloud, for IDE                           | 2025          | Community Edition is now Community Build; SonarCloud is SonarQube Cloud           |
| SonarQube Security Hotspots phased out                                               | Server 2026.4 | Former hotspot rules raise security issues; Sonar way still checks hotspot review |
| Semgrep OSS renamed Semgrep Community Edition; rules under the Semgrep Rules License | December 2024 | Registry rules are for internal use; some output fields need a login              |
| Opengrep forked from Semgrep CE                                                      | January 2025  | An LGPL alternative with cross-function taint inside a file                       |
| GitHub Advanced Security split into Code Security and Secret Protection              | April 2025    | Private repositories buy CodeQL code scanning as Code Security                    |
| `github/codeql-action` v4                                                            | October 2025  | v3 is deprecated in December 2026; upload SARIF with `upload-sarif@v4`            |
| Copilot Autofix for code scanning                                                    | 2024          | Fix suggestions for CodeQL alerts, without a Copilot licence                      |

## Prerequisites

- Experience with at least one programming language. The examples are in Python, and the ideas carry over to other languages.
- Basic knowledge of common web vulnerabilities; the [OWASP Top 10 guide](/guides/owasp-top-10) covers them.
- A CI/CD system: GitHub Actions, GitLab CI or Jenkins.
- For the hands-on parts: Python 3.10 or newer for Semgrep, Docker for SonarQube, and a GitHub repository for CodeQL code scanning.

## Who This Guide Is For

- DevOps and platform engineers who add security scanning to CI/CD pipelines.
- Security engineers who choose, tune and run SAST tools.
- Developers who want to understand the findings on their pull requests and write rules for their own code.

Start with [Part 1: SAST Fundamentals](/guides/sast-tools/01-sast-fundamentals), or jump to the tool you use.

## Keep Learning

- [Security Gates guide](/guides/security-gates), to turn scan results into pipeline policies
- [Dependency Scanning: Finding Vulnerabilities Before Attackers Do](/posts/dependency-scanning-guide), for the code SAST does not cover
- [How to Integrate DAST Into Your CI/CD Pipeline](/posts/dast-integration-guide)
- [Threat Modeling guide](/guides/threat-modeling), to decide what to scan for first
- [Interview question: security architecture and DevSecOps](/interview-questions/senior/security-architecture)
