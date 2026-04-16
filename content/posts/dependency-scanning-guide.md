---
title: 'Dependency Scanning: Finding Vulnerabilities Before Attackers Do'
excerpt: 'A practical guide to dependency scanning with Snyk, Dependabot, and native package manager tools. Learn how to detect vulnerable dependencies, automate fixes, and integrate scanning into your CI/CD pipeline.'
category:
  name: 'Security'
  slug: 'security'
coverImage: '/images/posts/dependency-scanning-guide.png'
ogImage: '/images/posts/dependency-scanning-guide.svg'
date: '2025-01-24'
publishedAt: '2025-01-24T09:00:00Z'
updatedAt: '2025-01-24T09:00:00Z'
readingTime: '10 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Security
  - Dependencies
  - Snyk
  - Dependabot
---

Most of your application is code you did not write. Somewhere between 80 and 90 percent of a typical codebase consists of third-party packages. That is a massive attack surface, and if you are not scanning those dependencies for known vulnerabilities, you are flying blind.

The Equifax breach in 2017 came from an unpatched Apache Struts vulnerability. Log4Shell in 2021 affected millions of applications through a single logging library. The event-stream incident in 2018 showed that even popular npm packages can be hijacked with malicious code. All of these were known vulnerabilities in dependencies that could have been caught with the right tooling.

**TLDR**: This guide walks through the three main approaches to dependency scanning: Snyk for deep analysis and multi-platform support, GitHub Dependabot for free automated PRs, and native package manager tools like `npm audit` and `pip-audit` for quick baseline checks. Pick at least one and integrate it into your CI/CD pipeline today.

## How Dependency Scanning Actually Works

Dependency scanners do not analyze your source code. They follow a simple three-step process:

1. **Parse your lock files** (`package-lock.json`, `Pipfile.lock`, `pom.xml`) to build a dependency graph
2. **Query vulnerability databases** to find matches against your dependency versions
3. **Generate a report** with vulnerable packages, severity scores, and remediation advice

This means scanning is fast, but it also means zero-day vulnerabilities will not be detected until someone catalogs them in a database. The major databases include the National Vulnerability Database (NVD), the GitHub Advisory Database, Google's OSV, and Snyk's own curated database.

### Direct vs. Transitive Dependencies

Here is where things get tricky. You install `express`, but express depends on `body-parser`, which depends on `raw-body`, which depends on `iconv-lite`. A vulnerability in `iconv-lite` affects your app even though you never installed it directly.

```
Your App
|
|-- express (direct - you installed this)
|   |-- body-parser (transitive)
|   |   +-- raw-body
|   |       +-- iconv-lite (vulnerable!)
|   +-- cookie
|
+-- lodash (direct)
```

Transitive dependencies often outnumber direct ones by 10x or more. They are your biggest risk because they are hidden and numerous.

When a transitive dependency is vulnerable, you have a few options. You can update the parent package if they have bumped the dependency. You can use overrides to force a specific version. Or you can replace the parent package entirely if it is unmaintained.

```json
{
  "overrides": {
    "iconv-lite": "0.6.3"
  }
}
```

### Severity Scoring: Beyond the Numbers

CVSS scores rate vulnerabilities from 0.0 to 10.0, but the number alone does not tell you what to do. A critical score of 9.0+ means fix it immediately. High (7.0-8.9) means fix within days. Medium (4.0-6.9) gives you weeks. Low (0.1-3.9) means fix when convenient.

But context matters more than the raw score. Ask three questions: Is there public exploit code? Is it being actively exploited in the wild? Does your application actually call the vulnerable function? A critical vulnerability in a function you never use is less urgent than a high-severity one in your hot path.

## Snyk: The Developer-Friendly Option

Snyk supports over 10 languages, generates automatic fix PRs, integrates with every major CI/CD platform, and has IDE plugins that catch vulnerabilities while you code. The free tier gives you 200 tests per month, which is enough for small teams.

### Getting Started

```bash
npm install -g snyk
snyk auth
cd my-project
snyk test
```

That is it. Snyk parses your project, checks its vulnerability database, and outputs something like this:

```
Tested 847 dependencies for known issues, found 3 issues, 1 critical.

Issues to fix by upgrading:

  Upgrade lodash@4.17.15 to lodash@4.17.21 to fix
  ✘ Prototype Pollution [Critical Severity]

  Upgrade axios@0.21.0 to axios@0.21.1 to fix
  ✘ Server-Side Request Forgery [High Severity]
```

### Useful CLI Options

```bash
# Only show high and critical issues
snyk test --severity-threshold=high

# Scan all projects in a monorepo
snyk test --all-projects

# Fail only on issues that have a fix available
snyk test --fail-on=upgradable

# Output as JSON for CI/CD processing
snyk test --json > snyk-results.json
```

The `--fail-on=upgradable` flag is particularly useful in CI. It only breaks the build when there is actually something you can do about the vulnerability, which prevents the frustration of blocking merges over issues with no available fix.

### Continuous Monitoring

`snyk test` is a point-in-time scan. For ongoing monitoring, use `snyk monitor`:

```bash
snyk monitor --project-name="my-app-production"
```

This adds your project to the Snyk dashboard and emails you when new vulnerabilities affect your dependencies. It can also create fix PRs automatically.

### Ignoring Vulnerabilities the Right Way

Sometimes a vulnerability does not affect your usage. Document it in a `.snyk` policy file:

```yaml
version: v1.25.0
ignore:
  SNYK-JS-LODASH-1040724:
    - '*':
        reason: 'Only used in build scripts, not production code'
        expires: 2024-06-01T00:00:00.000Z
```

Always set an expiration date and always document the reason. Your future self (and your auditors) will thank you.

### CI/CD Integration

```yaml
name: Security
on:
  push:
    branches: [main]
  pull_request:

jobs:
  snyk:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - name: Run Snyk
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high --fail-on=upgradable
```

Snyk also scans Docker images, which is worth setting up if you ship containers:

```bash
snyk container test my-app:latest
```

It will flag vulnerable OS packages in your base image and recommend slimmer alternatives.

## GitHub Dependabot: Free and Built-In

If you are on GitHub, Dependabot should be your first line of defense. It is free, requires minimal setup, and automatically creates pull requests to fix vulnerable dependencies.

Dependabot does three things: alerts you about vulnerable dependencies, creates security update PRs to fix them, and optionally keeps all your dependencies up to date with version update PRs.

### Enabling It

For public repos, alerts are on by default. For private repos, go to Settings, then Code security and analysis, and enable the Dependency graph, Dependabot alerts, and Dependabot security updates.

### Configuring Version Updates

Create `.github/dependabot.yml` to keep all dependencies current, not just vulnerable ones:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 10
    groups:
      eslint:
        patterns:
          - "eslint*"
          - "@typescript-eslint/*"
      testing:
        patterns:
          - "jest*"
          - "@testing-library/*"
      minor-and-patch:
        update-types:
          - "minor"
          - "patch"

  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

Grouping related updates is important. Without it, Dependabot will open a separate PR for every single package update, and your team will drown in notifications.

### Auto-Merging Safe Updates

Patch updates from Dependabot are generally safe to auto-merge if your tests pass:

```yaml
name: Dependabot Auto-Merge
on: pull_request

permissions:
  contents: write
  pull-requests: write

jobs:
  auto-merge:
    runs-on: ubuntu-latest
    if: github.actor == 'dependabot[bot]'
    steps:
      - name: Fetch Dependabot metadata
        id: metadata
        uses: dependabot/fetch-metadata@v2
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}

      - name: Auto-merge patch updates
        if: steps.metadata.outputs.update-type == 'version-update:semver-patch'
        run: gh pr merge --auto --squash "$PR_URL"
        env:
          PR_URL: ${{ github.event.pull_request.html_url }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Make sure you have branch protection with required status checks enabled. Auto-merge without tests is a bad idea.

### Dependabot vs. Snyk

Use both. Dependabot is free and covers the basics on GitHub. Snyk adds deeper analysis with exploit maturity ratings, reachability analysis (does your code actually call the vulnerable function?), container scanning, and support for non-GitHub platforms. Start with Dependabot, layer in Snyk when you need more.

## Native Package Manager Tools

Every major package manager ships with built-in audit commands. They are free, require zero setup, and work everywhere.

### npm audit

```bash
npm audit                        # Run audit
npm audit --audit-level=high     # Only high and critical
npm audit fix                    # Auto-fix safe updates
npm audit fix --force            # Force fixes (may break things)
npm audit --omit=dev             # Skip dev dependencies
```

A word of caution on `--force`: it can introduce breaking changes by jumping to major versions. Always test after running it.

### pip-audit (Python)

```bash
pip install pip-audit
pip-audit -r requirements.txt
pip-audit --fix                  # Auto-fix
pip-audit --format json -o audit.json
```

For Poetry or Pipenv users:

```bash
poetry export -f requirements.txt | pip-audit -r /dev/stdin
pipenv requirements | pip-audit -r /dev/stdin
```

### bundler-audit (Ruby)

```bash
gem install bundler-audit
bundle-audit check --update      # Update DB and scan
```

### cargo-audit (Rust)

```bash
cargo install cargo-audit
cargo audit                      # Scan
cargo audit fix                  # Auto-fix
```

### govulncheck (Go)

Go's official scanner is special because it performs reachability analysis. It checks whether your code actually calls the vulnerable functions, which dramatically reduces false positives.

```bash
go install golang.org/x/vuln/cmd/govulncheck@latest
govulncheck ./...
```

### Trivy for Multi-Language Projects

If your project spans multiple ecosystems, Trivy scans everything at once:

```bash
trivy fs .                       # Auto-detects all package managers
trivy fs --scanners vuln .       # Vulnerabilities only
trivy fs --format json -o results.json .
```

Trivy covers npm, pip, Bundler, Cargo, Go, Maven, Gradle, Composer, and more. It also scans container images and IaC files.

## When to Block Builds

Be pragmatic with your CI policies:

| Severity | PR Checks | Main Branch | Production |
|----------|-----------|-------------|------------|
| Critical | Block | Block | Block |
| High | Warn | Block | Block |
| Medium | Warn | Warn | Block |
| Low | Info | Info | Warn |

Blocking every medium vulnerability will frustrate developers and lead to ignored warnings. Set a high bar for what breaks the build, and track everything else in your security backlog.

## The Practical Takeaway

Start with whatever tool is easiest to adopt. If you are on GitHub, enable Dependabot today. It takes five minutes and costs nothing. Add `npm audit` or `pip-audit` to your CI pipeline as a second layer. When you need deeper analysis or multi-platform support, bring in Snyk.

The goal is not zero vulnerabilities. The goal is knowing what you are shipping and making informed decisions about risk. Always commit your lock files, scan on every PR and on a daily schedule, document your ignores with reasons and expiration dates, and prioritize based on exploitability rather than raw CVSS scores.

Your dependencies are your responsibility, even the ones you did not choose directly.

---

## Related Security Posts

- [Software Supply Chain Security: SBOMs, Sigstore, and SLSA in Practice](/posts/software-supply-chain-security) - Generate SBOMs from your dependency tree and verify that nothing was injected between build and deploy
- [How to Integrate DAST Into Your CI/CD Pipeline](/posts/dast-integration-guide) - Complement your dependency scans with runtime testing that finds vulnerabilities in how your app actually behaves
- [Secure Coding Practices Every DevOps Engineer Should Know](/posts/secure-coding-practices-guide) - Even with clean dependencies, your own code can introduce injection flaws and broken auth

For a deeper look at choosing and configuring static analysis tools, see our guide on [SAST tools](/guides/sast-tools).
