---
title: 'Pre-commit Hooks for Security'
description: 'Implement security checks before code is committed using git hooks. Learn gitleaks, detect-secrets, and the pre-commit framework to catch vulnerabilities early.'
category:
  name: 'Security'
  slug: 'security'
publishedAt: '2025-01-24'
updatedAt: '2025-01-24'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Security
  - DevSecOps
  - Git
  - Pre-commit
  - Secrets Detection
---

Pre-commit hooks run automated checks on your code before it enters version control. They act as a first line of defense—catching secrets, security issues, and code quality problems before they become part of your repository's history.

Once a secret is committed to Git, it lives forever in the repository history. Even if you delete the file, the secret remains accessible through `git log`. Pre-commit hooks prevent this by blocking commits that contain sensitive data.

This guide covers the essential tools for implementing security-focused pre-commit hooks:

- **pre-commit framework** — Language-agnostic hook management
- **gitleaks** — Fast secrets detection with regex patterns
- **detect-secrets** — Baseline-aware secrets scanning from Yelp
- **Custom hooks** — Writing your own security checks

## What You'll Learn

This guide consists of the following parts:

1. Pre-commit Framework - Installation, configuration, and hook management
2. Gitleaks - Secrets detection, custom rules, and CI integration
3. Detect-secrets - Baseline management and plugin system
4. Custom Security Hooks - Building organization-specific checks

## Why Pre-commit Hooks Matter

Consider these real scenarios:

- An AWS access key gets committed and pushed—attackers scan GitHub for exactly this
- A database password in a config file makes it to the main branch
- An API token for a third-party service gets exposed in a test file
- A developer hardcodes credentials "just for testing" and forgets to remove them

Pre-commit hooks stop these mistakes at the source. They run locally, provide instant feedback, and prevent sensitive data from ever entering your repository.

## The Shift-Left Security Model

Pre-commit hooks embody the "shift-left" philosophy—finding problems as early as possible in the development lifecycle:

```
Development Timeline
--------------------

[Pre-commit] -> [CI Pipeline] -> [Code Review] -> [Staging] -> [Production]
     ^              ^                 ^              ^              ^
   Cheapest      Cheap           Moderate       Expensive      Very Expensive
   to fix        to fix          to fix         to fix         to fix
```

Catching a secret at the pre-commit stage costs seconds. Catching it after it's been pushed, reviewed, and deployed can cost hours of incident response and credential rotation.

