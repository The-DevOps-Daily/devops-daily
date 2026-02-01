---
title: 'Static Application Security Testing (SAST)'
description: 'Master Static Application Security Testing (SAST) with SonarQube, Semgrep, and CodeQL. Learn to detect vulnerabilities in source code before they reach production.'
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
  - SAST
  - SonarQube
  - Semgrep
  - CodeQL
---

Static Application Security Testing (SAST) analyzes source code to find security vulnerabilities without executing the application. Unlike dynamic testing that requires a running application, SAST can catch issues early in development—when they're cheapest to fix.

SAST tools scan your codebase for patterns that indicate security weaknesses: SQL injection, cross-site scripting, hardcoded secrets, insecure cryptography, and hundreds of other vulnerability classes. They integrate into your IDE, CI/CD pipeline, and code review process to provide continuous security feedback.

This guide covers three of the most popular SAST tools, each with different strengths:

- **SonarQube** — Comprehensive code quality and security platform
- **Semgrep** — Fast, customizable pattern matching for security rules
- **CodeQL** — Powerful semantic code analysis from GitHub

## What You'll Learn

This guide consists of the following parts:

1. SAST Fundamentals - How static analysis works, types of analysis, limitations
2. SonarQube - Setup, configuration, quality gates, and CI/CD integration
3. Semgrep - Writing custom rules, registry usage, and pipeline integration
4. CodeQL - Query language basics, security queries, and GitHub integration

## Why SAST Matters for DevOps

Consider these scenarios:

- A SQL injection vulnerability ships to production because no one noticed the string concatenation
- Hardcoded AWS credentials in a config file get committed and exposed
- A junior developer uses MD5 for password hashing, unaware it's insecure
- An open redirect vulnerability sits in the codebase for months before discovery

SAST tools catch these issues automatically during development, not after deployment. They provide a safety net that scales with your team—every commit gets the same thorough security review.

## Prerequisites

This guide assumes you have:

- Basic understanding of common vulnerabilities (SQL injection, XSS, etc.)
- Familiarity with CI/CD pipelines (GitHub Actions, GitLab CI, Jenkins)
- Experience with at least one programming language
- Docker installed (for running SonarQube locally)

## Who This Guide Is For

This guide is designed for:

- DevOps engineers implementing security in CI/CD pipelines
- Security engineers evaluating or deploying SAST tools
- Developers wanting to catch security issues earlier
- Teams building a DevSecOps practice from scratch

Let's start finding vulnerabilities before attackers do!
