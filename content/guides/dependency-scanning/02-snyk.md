---
title: 'Snyk'
description: 'Learn to use Snyk for comprehensive dependency scanning, including CLI usage, CI/CD integration, and vulnerability remediation workflows.'
---

Snyk is one of the most popular developer security platforms, offering dependency scanning across multiple ecosystems along with container and infrastructure-as-code scanning. Its strength lies in developer-friendly workflows and actionable fix recommendations.

## Why Snyk?

| Feature | Benefit |
|---------|----------|
| **Multi-language support** | JavaScript, Python, Java, Go, Ruby, .NET, PHP, and more |
| **Fix PRs** | Automatically generates pull requests with fixes |
| **IDE plugins** | Catch vulnerabilities while coding |
| **Prioritization** | Ranks vulnerabilities by exploitability and reachability |
| **Container scanning** | Scans Docker images for OS and app vulnerabilities |

## Installation

### CLI Installation

```bash
# npm (recommended)
npm install -g snyk

# Homebrew (macOS)
brew install snyk

# Standalone binary (Linux)
curl -Lo snyk https://static.snyk.io/cli/latest/snyk-linux && chmod +x snyk
sudo mv snyk /usr/local/bin/
```

### Authentication

```bash
# Authenticate via browser
snyk auth

# Or use API token (for CI/CD)
export SNYK_TOKEN=your-api-token
snyk auth $SNYK_TOKEN
```

Get your API token from [snyk.io/account](https://snyk.io/account).

## Basic Scanning

### Scan a Project

```bash
# Navigate to your project
cd my-project

# Run a scan
snyk test
```

**Example output:**

```
Testing /path/to/my-project...

Tested 847 dependencies for known issues, found 3 issues, 1 critical.

Issues to fix by upgrading:

  Upgrade lodash@4.17.15 to lodash@4.17.21 to fix
  ✘ Prototype Pollution [Critical Severity][https://snyk.io/vuln/SNYK-JS-LODASH-1040724]
    introduced by lodash@4.17.15

  Upgrade axios@0.21.0 to axios@0.21.1 to fix
  ✘ Server-Side Request Forgery [High Severity][https://snyk.io/vuln/SNYK-JS-AXIOS-1038255]
    introduced by axios@0.21.0
```

### Scan Options

```bash
# Only show high and critical issues
snyk test --severity-threshold=high

# Output as JSON (for CI/CD processing)
snyk test --json > snyk-results.json

# Scan a specific manifest file
snyk test --file=backend/package.json

# Scan all projects in a monorepo
snyk test --all-projects

# Include dev dependencies
snyk test --dev

# Fail only on fixable issues
snyk test --fail-on=upgradable
```

## Monitoring Projects

`snyk test` is point-in-time. For continuous monitoring:

```bash
# Add project to Snyk dashboard for ongoing monitoring
snyk monitor

# Monitor with a custom project name
snyk monitor --project-name="my-app-production"

# Monitor specific environment
snyk monitor --target-reference=production
```

Once monitored, Snyk will:
- Email you when new vulnerabilities affect your dependencies
- Show trends on the Snyk dashboard
- Optionally create fix PRs automatically

## Fixing Vulnerabilities

### Interactive Fix Wizard

```bash
snyk wizard
```

The wizard walks you through each vulnerability and offers:
- Upgrade to fixed version
- Patch (Snyk-maintained patches for unpatchable packages)
- Ignore (with expiration and reason)

### Automated Fixes

```bash
# Automatically apply upgrades where possible
snyk fix

# Preview what would be fixed
snyk fix --dry-run
```

**Note**: `snyk fix` modifies your `package.json` and lock file. Review changes before committing.

## Ignoring Vulnerabilities

Not every vulnerability needs immediate action. Use `.snyk` policy files:

```yaml
# .snyk
version: v1.25.0
ignore:
  SNYK-JS-LODASH-1040724:
    - '*':
        reason: 'Only used in build scripts, not production code'
        expires: 2024-06-01T00:00:00.000Z
        created: 2024-01-15T10:30:00.000Z
  
  SNYK-JS-MINIMIST-2429795:
    - 'mocha > yargs > minimist':
        reason: 'Dev dependency only, not exploitable in test context'
        expires: 2024-03-01T00:00:00.000Z
```

**Best practices for ignoring:**
- Always set an expiration date
- Document the reason clearly
- Review ignores regularly
- Prefer path-specific ignores over wildcards

## CI/CD Integration

### GitHub Actions

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
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run Snyk
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high --fail-on=upgradable
          
      - name: Upload results to GitHub Code Scanning
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: snyk.sarif
```

### GitLab CI

```yaml
snyk-scan:
  image: node:20
  stage: test
  before_script:
    - npm install -g snyk
    - snyk auth $SNYK_TOKEN
  script:
    - npm ci
    - snyk test --severity-threshold=high
  allow_failure: false
  only:
    - merge_requests
    - main
```

### Jenkins

```groovy
pipeline {
    agent any
    
    environment {
        SNYK_TOKEN = credentials('snyk-api-token')
    }
    
    stages {
        stage('Security Scan') {
            steps {
                sh 'npm ci'
                sh 'snyk test --severity-threshold=high'
            }
        }
        
        stage('Monitor') {
            when {
                branch 'main'
            }
            steps {
                sh 'snyk monitor'
            }
        }
    }
}
```

## Container Scanning

Snyk also scans Docker images:

```bash
# Scan a local image
snyk container test my-app:latest

# Scan from a Dockerfile
snyk container test --file=Dockerfile .

# Scan and get base image recommendations
snyk container test my-app:latest --platform=linux/amd64
```

**Example output:**

```
Testing my-app:latest...

Organization: my-org
Package manager: deb
Target file: Dockerfile
Project name: my-app
Docker image: my-app:latest
Platform: linux/amd64
Base image: node:18-bullseye

✘ Critical severity vulnerability found in openssl/libssl1.1
  Description: Buffer Overflow
  Introduced through: openssl/libssl1.1@1.1.1n-0+deb11u3
  From: openssl/libssl1.1@1.1.1n-0+deb11u3
  Fixed in: 1.1.1n-0+deb11u4

Recommendations:
  Base image upgrade: node:18-bullseye-slim
  This would fix 12 vulnerabilities
```

## IDE Integration

Install Snyk plugins for real-time scanning:

- **VS Code**: Search "Snyk" in Extensions
- **IntelliJ/WebStorm**: Settings → Plugins → Search "Snyk"
- **Eclipse**: Help → Eclipse Marketplace → Search "Snyk"

The IDE plugin highlights vulnerable imports as you code:

```javascript
// VS Code shows inline warning:
import _ from 'lodash';  // ⚠️ Prototype Pollution (SNYK-JS-LODASH-1040724)
```

## Snyk Dashboard

The web dashboard ([app.snyk.io](https://app.snyk.io)) provides:

- **Project overview**: All monitored projects and their vulnerability counts
- **Priority Score**: Combines CVSS, exploit maturity, and reachability
- **Fix PRs**: One-click pull request generation
- **Reports**: Compliance and trend reports
- **Policies**: Organization-wide ignore rules and severity thresholds

## Pricing Tiers

| Tier | Cost | Tests/Month | Features |
|------|------|-------------|----------|
| **Free** | $0 | 200 | Basic scanning, limited projects |
| **Team** | $52/dev/mo | Unlimited | Priority support, advanced reports |
| **Enterprise** | Custom | Unlimited | SSO, custom policies, SLA |

The free tier is sufficient for small projects and learning.

## Troubleshooting

### "No supported target files found"

```bash
# Specify the manifest file explicitly
snyk test --file=package.json

# For monorepos, use --all-projects
snyk test --all-projects
```

### Authentication Issues

```bash
# Re-authenticate
snyk auth

# Verify token is set
snyk config get api

# Test authentication
snyk whoami
```

### Rate Limiting

Free tier has 200 tests/month. In CI/CD:

```yaml
# Only run on main branch and PRs, not every commit
on:
  push:
    branches: [main]
  pull_request:
```

## Key Takeaways

1. **Use `snyk test` for point-in-time scans**, `snyk monitor` for continuous monitoring
2. **Set severity thresholds** to avoid alert fatigue (`--severity-threshold=high`)
3. **Document ignores** with reasons and expiration dates in `.snyk` files
4. **Integrate with CI/CD** to catch vulnerabilities before merge
5. **Use the IDE plugin** for shift-left security—catch issues while coding
