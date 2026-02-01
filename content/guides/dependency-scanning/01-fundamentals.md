---
title: 'Dependency Scanning Fundamentals'
description: 'Understand how dependency scanning works, vulnerability databases, severity scoring, and the difference between direct and transitive dependencies.'
---

Before diving into specific tools, you need to understand how dependency scanning works and the ecosystem that powers it. This knowledge helps you interpret scan results, prioritize fixes, and configure tools effectively.

## How Dependency Scanning Works

Dependency scanners follow a consistent process:

```
1. Parse Lock Files
   package-lock.json, Pipfile.lock, pom.xml → Dependency Graph

2. Query Vulnerability Databases
   Dependency versions → CVE/advisory lookup → Matches

3. Generate Report
   Vulnerable packages + severity + remediation advice
```

**Key insight**: Scanners don't analyze your code—they compare your dependency versions against known vulnerability databases. This makes scanning fast but means zero-day vulnerabilities won't be detected until they're catalogued.

## Vulnerability Databases

Multiple databases track known vulnerabilities:

| Database | Scope | Maintained By |
|----------|-------|---------------|
| **NVD** (National Vulnerability Database) | All software | NIST (US Government) |
| **GitHub Advisory Database** | Open source packages | GitHub + Community |
| **OSV** (Open Source Vulnerabilities) | Open source | Google |
| **Snyk Vulnerability DB** | Open source + containers | Snyk |
| **npm Advisory Database** | JavaScript/Node.js | GitHub (formerly npm) |
| **PyPI Advisory Database** | Python | Python Packaging Authority |

Most tools aggregate multiple databases. Snyk and GitHub maintain their own curated databases with additional context and fix recommendations.

## Understanding CVEs and Severity

### CVE Identifiers

CVE (Common Vulnerabilities and Exposures) provides unique identifiers for vulnerabilities:

```
CVE-2021-44228 (Log4Shell)
    |    |    |
    |    |    +-- Sequential number
    |    +------ Year discovered/published
    +---------- CVE prefix
```

### CVSS Scoring

CVSS (Common Vulnerability Scoring System) rates severity from 0.0 to 10.0:

| Score | Severity | Action |
|-------|----------|--------|
| 9.0 - 10.0 | **Critical** | Fix immediately |
| 7.0 - 8.9 | **High** | Fix within days |
| 4.0 - 6.9 | **Medium** | Fix within weeks |
| 0.1 - 3.9 | **Low** | Fix when convenient |

**CVSS v3.1 example** (Log4Shell):

```
Base Score: 10.0 (Critical)

Attack Vector: Network (remotely exploitable)
Attack Complexity: Low (easy to exploit)
Privileges Required: None
User Interaction: None
Impact: Complete system compromise
```

### Beyond CVSS: Exploitability

CVSS alone doesn't tell the whole story. Consider:

- **Exploit availability** — Is there public exploit code?
- **Active exploitation** — Is it being exploited in the wild?
- **Your exposure** — Is the vulnerable function actually used in your code?

Tools like Snyk add "Exploit Maturity" ratings:
- **Mature**: Weaponized exploits available
- **Proof of Concept**: PoC code exists
- **No Known Exploit**: Theoretical vulnerability

## Direct vs. Transitive Dependencies

Understanding your dependency tree is crucial:

```
Your App
|
|-- express (direct dependency - you installed this)
|   |-- body-parser (transitive - express needs this)
|   |   +-- raw-body
|   |       +-- iconv-lite (vulnerable!)
|   +-- cookie
|
+-- lodash (direct dependency)
```

**Direct dependencies**: Packages you explicitly install (`npm install express`)

**Transitive dependencies**: Packages your dependencies depend on (often 10-100x more than direct)

### Why This Matters

A vulnerability in `iconv-lite` affects your app even though you never installed it directly. Fixing it might require:

1. Updating `express` (if they've updated their dependency)
2. Waiting for `body-parser` to update (if express hasn't)
3. Using dependency overrides (forcing a specific version)

```json
// package.json - forcing a transitive dependency version
{
  "overrides": {
    "iconv-lite": "0.6.3"
  }
}
```

## Lock Files: Your Source of Truth

Lock files pin exact versions of all dependencies (direct + transitive):

| Ecosystem | Lock File | Purpose |
|-----------|-----------|----------|
| npm | `package-lock.json` | Exact versions + integrity hashes |
| Yarn | `yarn.lock` | Exact versions |
| pnpm | `pnpm-lock.yaml` | Exact versions |
| Python | `Pipfile.lock`, `poetry.lock` | Exact versions + hashes |
| Ruby | `Gemfile.lock` | Exact versions |
| Go | `go.sum` | Checksums (versions in go.mod) |
| Java | `pom.xml` (with versions) | Declared versions |

**Always commit lock files.** They ensure:
- Reproducible builds
- Accurate vulnerability scanning
- Protection against dependency confusion attacks

## Remediation Strategies

When a vulnerability is found, you have several options:

### 1. Update the Package

The ideal solution—update to a patched version:

```bash
# npm
npm update lodash
npm audit fix

# pip
pip install --upgrade requests

# bundler
bundle update nokogiri
```

### 2. Override Transitive Dependencies

When the direct dependency hasn't updated yet:

```json
// npm (package.json)
{
  "overrides": {
    "vulnerable-package": "^2.0.0"
  }
}
```

```yaml
# Yarn (package.json)
{
  "resolutions": {
    "vulnerable-package": "^2.0.0"
  }
}
```

### 3. Ignore with Justification

Sometimes a vulnerability doesn't affect your usage:

```yaml
# .snyk file
ignore:
  SNYK-JS-LODASH-1234:
    - '*':
        reason: 'Prototype pollution not exploitable - we never use user input with lodash.merge'
        expires: 2024-12-31
```

**Document why** you're ignoring—auditors will ask.

### 4. Replace the Package

If a package is unmaintained or repeatedly vulnerable:

```bash
# Find alternatives
npx npm-check-updates --doctor

# Or check https://snyk.io/advisor for package health scores
```

## Scanning in CI/CD

Dependency scanning belongs in your CI/CD pipeline:

```yaml
# GitHub Actions example
name: Security Scan

on:
  push:
    branches: [main]
  pull_request:
  schedule:
    - cron: '0 6 * * *'  # Daily at 6 AM

jobs:
  dependency-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Snyk
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high
```

### When to Block Builds

| Severity | PR Checks | Main Branch | Production |
|----------|-----------|-------------|------------|
| Critical | Block | Block | Block |
| High | Warn | Block | Block |
| Medium | Warn | Warn | Block |
| Low | Info | Info | Warn |

Be pragmatic—blocking every medium vulnerability will frustrate developers and lead to ignored warnings.

## Key Takeaways

1. **Dependency scanning compares versions against vulnerability databases**—it doesn't analyze code
2. **Transitive dependencies are your biggest risk**—they're hidden and numerous
3. **CVSS scores need context**—exploitability and your exposure matter
4. **Always commit lock files**—they're essential for accurate scanning
5. **Scan continuously**—new vulnerabilities are discovered daily
