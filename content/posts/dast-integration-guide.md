---
title: 'How to Integrate DAST Into Your CI/CD Pipeline (With OWASP ZAP Examples)'
excerpt: 'A practical guide to Dynamic Application Security Testing. Learn how DAST works, set up OWASP ZAP scans, compare it with Burp Suite, and automate security testing in your CI/CD pipeline with quality gates.'
category:
  name: 'Security'
  slug: 'security'
date: '2025-01-24'
publishedAt: '2025-01-24T09:00:00Z'
updatedAt: '2025-01-24T09:00:00Z'
readingTime: '10 min read'
coverImage: '/images/posts/dast-integration-guide.png'
ogImage: '/images/posts/dast-integration-guide.svg'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Security
  - DAST
  - OWASP ZAP
  - Penetration Testing
---

Most teams treat security testing as something that happens right before a release, if it happens at all. They run a scanner once, get a 200-page PDF report, and then ignore it because the deadline is tomorrow. This is not security. This is theater.

Dynamic Application Security Testing (DAST) is a "black box" approach that tests your running application from the outside, exactly like an attacker would. Unlike static analysis that reads your code, DAST sends real requests and analyzes real responses. It finds SQL injection, XSS, authentication flaws, and misconfigurations that only show up at runtime.

The real power of DAST comes when you automate it. Put it in your CI/CD pipeline, set quality gates, and stop vulnerabilities before they reach production. That is what this guide covers.

## How DAST Actually Works

A DAST scanner follows four steps. Understanding them helps you tune scans and interpret results.

**Step 1: Discovery (Crawling).** The scanner explores your application to map every endpoint. It follows links, submits forms, and executes JavaScript to find all possible entry points.

**Step 2: Passive Scanning.** While crawling, the scanner observes responses for issues without attacking anything. It checks for missing security headers (CSP, HSTS, X-Frame-Options), exposed sensitive information like stack traces and version numbers, insecure cookies missing HttpOnly or Secure flags, and weak SSL/TLS configurations.

**Step 3: Active Scanning.** The scanner sends attack payloads to each endpoint:

```bash
# SQL Injection test
GET /api/users?id=1' OR '1'='1

# XSS test
GET /search?q=<script>alert('XSS')</script>

# Path Traversal test
GET /files?path=../../../../etc/passwd
```

It analyzes responses to detect vulnerabilities. Database errors mean SQL injection is possible. Script content reflected back means XSS. Sensitive file content means path traversal.

**Step 4: Reporting.** Results get categorized by severity (Critical through Informational), confidence level, CWE/CVE identifiers, and OWASP Top 10 mapping.

## When to Use Each Scan Type

Not every scan belongs in every environment.

**Passive scans** observe traffic without attacking. They are safe for production, fast (1-5 minutes), and catch missing headers, insecure cookies, and information disclosure. Run these everywhere.

**Active scans** send attack payloads. They belong in staging and test environments only. They take 30 minutes to several hours and can cause real damage to databases and trigger security alerts.

**API scans** test REST and GraphQL endpoints using OpenAPI or Swagger specs. Medium risk, medium duration. Perfect for microservice architectures.

## Setting Up OWASP ZAP

OWASP ZAP is free, open-source, and built for automation. It is the best starting point for most teams.

### Installation via Docker

```bash
# Pull the stable image
docker pull ghcr.io/zaproxy/zaproxy:stable

# Baseline Scan (passive only, safe for production)
docker run -v $(pwd):/zap/wrk/:rw \
  ghcr.io/zaproxy/zaproxy:stable zap-baseline.py \
  -t https://example.com -r report.html

# Full Scan (active, staging only)
docker run -v $(pwd):/zap/wrk/:rw \
  ghcr.io/zaproxy/zaproxy:stable zap-full-scan.py \
  -t https://staging.example.com -r report.html

# API Scan (OpenAPI/GraphQL)
docker run -v $(pwd):/zap/wrk/:rw \
  ghcr.io/zaproxy/zaproxy:stable zap-api-scan.py \
  -t https://api.example.com/openapi.json \
  -f openapi -r report.html
```

### Configuring Authentication

Most applications require authentication to test protected endpoints. ZAP handles this with context files:

```yaml
# zap-context.yaml
env:
  contexts:
    - name: "My App"
      urls:
        - "https://staging.example.com"
      includePaths:
        - "https://staging.example.com/.*"
      excludePaths:
        - "https://staging.example.com/logout"
      authentication:
        method: "form"
        parameters:
          loginUrl: "https://staging.example.com/login"
          loginRequestData: "username={%username%}&password={%password%}"
        verification:
          method: "response"
          loggedInRegex: "\\QWelcome\\E"
          loggedOutRegex: "\\QLogin\\E"
      users:
        - name: "test_user"
          credentials:
            username: "test@example.com"
            password: "testpass123"
```

Then reference it in your scan:

```bash
zap-full-scan.py \
  -t https://staging.example.com \
  -n zap-context.yaml \
  -r report.html
```

### Tuning False Positives

Noisy scanners get ignored. Tune yours with a rules file:

```
# rules-config.tsv
10021	IGNORE	(X-Content-Type-Options)
10038	IGNORE	(Content Security Policy)
10055	FAIL	(CSP Scanner)
40012	FAIL	(Cross Site Scripting)
40018	FAIL	(SQL Injection)
```

```bash
zap-full-scan.py \
  -t https://staging.example.com \
  -c rules-config.tsv \
  -r report.html
```

## Where Burp Suite Fits In

Burp Suite is the industry standard for manual penetration testing. While ZAP excels at automation, Burp Suite shines when a human is driving.

**Use Burp Suite for:**
- Deep manual testing with the Proxy, Repeater, and Intruder tools
- Out-of-band vulnerability detection via Burp Collaborator
- Advanced attack techniques like brute forcing and parameter fuzzing
- Professional penetration test engagements

**Use ZAP for:**
- Automated CI/CD scans
- Baseline security checks on every PR
- API scanning with OpenAPI specs
- Any situation where you need free and repeatable scans

The best approach is to use both. ZAP handles your automated pipeline scans. Burp Suite handles periodic manual deep dives. They complement each other well.

## CI/CD Integration

This is where DAST stops being a checkbox and starts preventing real vulnerabilities.

### The Strategy

Run different scan types at different stages:

- **Pull Requests**: Quick baseline scan (5-10 minutes, passive only)
- **Staging Deploy**: Full active scan (30-60 minutes)
- **Production**: Passive monitoring only, never active scans

### GitHub Actions

```yaml
# .github/workflows/dast.yml
name: DAST Scan

on:
  pull_request:
  push:
    branches: [main]

jobs:
  zap_scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Start Application
        run: |
          docker-compose up -d
          timeout 60 bash -c 'until curl -f http://localhost:3000/health; do sleep 2; done'

      - name: ZAP Baseline Scan
        uses: zaproxy/action-baseline@v0.10.0
        with:
          target: 'http://localhost:3000'
          rules_file_name: '.zap/rules.tsv'
          cmd_options: '-a'

      - name: Upload ZAP Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: zap-report
          path: report_html.html
```

### GitLab CI

```yaml
dast_scan:
  stage: security
  image: ghcr.io/zaproxy/zaproxy:stable
  script:
    - zap-baseline.py -t $TARGET_URL -r gl-dast-report.html -J gl-dast-report.json
  artifacts:
    when: always
    reports:
      dast: gl-dast-report.json
    paths:
      - gl-dast-report.html
    expire_in: 1 week
  allow_failure: false
```

### Quality Gates That Actually Work

A scan without a quality gate is just noise. Parse results and fail builds when it matters:

```bash
#!/bin/bash
# parse-zap-results.sh

REPORT="zap-report.json"

CRITICAL=$(jq '[.site[].alerts[] | select(.riskcode=="3" and .confidence=="3")] | length' $REPORT)
HIGH=$(jq '[.site[].alerts[] | select(.riskcode=="3")] | length' $REPORT)
MEDIUM=$(jq '[.site[].alerts[] | select(.riskcode=="2")] | length' $REPORT)

echo "Critical: $CRITICAL | High: $HIGH | Medium: $MEDIUM"

if [ $CRITICAL -gt 0 ]; then
  echo "::error::Found $CRITICAL critical vulnerabilities"
  exit 1
elif [ $HIGH -gt 5 ]; then
  echo "::error::Found $HIGH high-severity vulnerabilities (threshold: 5)"
  exit 1
elif [ $MEDIUM -gt 20 ]; then
  echo "::warning::Found $MEDIUM medium-severity vulnerabilities (threshold: 20)"
fi

echo "Security scan passed"
```

For even more targeted filtering, block specific vulnerability types:

```bash
#!/bin/bash
# Block specific CWEs: SQL Injection, XSS, Path Traversal, OS Command Injection
BLOCKLIST=("89" "79" "22" "78")

for CWE in "${BLOCKLIST[@]}"; do
  COUNT=$(jq "[.site[].alerts[] | select(.cweid==\"$CWE\")] | length" zap-report.json)
  if [ $COUNT -gt 0 ]; then
    echo "::error::Found $COUNT instances of CWE-$CWE"
    exit 1
  fi
done
```

### Advanced: Full Scan With PR Comments

For staging deployments, run a full scan and post results directly to the PR:

```yaml
- name: Run ZAP Full Scan
  run: |
    docker run -v $(pwd):/zap/wrk/:rw \
      ghcr.io/zaproxy/zaproxy:stable zap-full-scan.py \
      -t ${{ env.STAGING_URL }} \
      -r zap-report.html \
      -J zap-report.json \
      -w zap-report.md \
      -z "-config api.maxchildren=5"

- name: Comment PR with Results
  if: always() && github.event_name == 'pull_request'
  uses: actions/github-script@v7
  with:
    script: |
      const fs = require('fs');
      const report = fs.readFileSync('zap-report.md', 'utf8');
      github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: `## DAST Scan Results\n\n${report}`
      });
```

## Troubleshooting Common Issues

**Scan takes too long.** Reduce threads and set a timeout:

```bash
zap-full-scan.py -t URL -z "-config api.maxchildren=2" -m 30
```

**Too many false positives.** Use a rules.tsv file to IGNORE irrelevant alerts. Exclude paths like `/logout`, `/static/`, and `/health` from your context.

**Authentication not working.** Enable debug mode to see what ZAP is doing:

```bash
docker run -v $(pwd):/zap/wrk/:rw \
  ghcr.io/zaproxy/zaproxy:stable \
  zap-full-scan.py -t URL -d
```

**Out of memory.** Increase Docker memory and reduce thread count:

```bash
docker run -m 4g ghcr.io/zaproxy/zaproxy:stable \
  zap-full-scan.py -t URL -z "-config scanner.threadPerHost=1"
```

## What DAST Does Not Catch

DAST is one layer of defense, not a silver bullet. It misses code-level flaws like buffer overflows and race conditions (use SAST for those). It struggles with complex multi-step business logic attacks. It cannot test endpoints behind authentication without proper setup. And it will not find client-side vulnerabilities in mobile or desktop apps.

The best security testing strategy combines SAST for early detection during development, DAST for runtime validation in staging, and IAST for comprehensive coverage during testing. Add dependency scanning and infrastructure security on top and you have real defense in depth.

## Getting Started

If you are not running DAST today, start small:

1. Add a ZAP baseline scan to one project's CI pipeline. This takes 15 minutes to set up.
2. Run it for a week and review the findings. Tune false positives with a rules file.
3. Add a quality gate that blocks critical vulnerabilities.
4. Expand to full active scans on staging deployments.
5. Track metrics over time: vulnerability density, false positive rate, and mean time to remediate.

The goal is not to catch every vulnerability on day one. The goal is to build a security feedback loop that gets better over time. Start with passive scans, tune the noise, and gradually increase coverage.

---

## Related Security Posts

- [Dependency Scanning: Finding Vulnerabilities Before Attackers Do](/posts/dependency-scanning-guide) - Catch known CVEs in your libraries before DAST even runs, so your scans focus on application-level flaws
- [Secure Coding Practices Every DevOps Engineer Should Know](/posts/secure-coding-practices-guide) - Fix the root causes DAST finds: input validation, output encoding, and proper error handling
- [CI/CD Pipeline Hardening](/posts/cicd-pipeline-hardening-guide) - Secure the pipeline that runs your DAST scans so attackers cannot tamper with results or skip security gates

For guidance on setting pass/fail thresholds in your pipeline, see our guide on [security gates](/guides/security-gates).
