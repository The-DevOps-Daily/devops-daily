---
title: 'OWASP ZAP'
description: 'Master OWASP ZAP for automated security testing. Learn passive and active scanning, API testing, and CI/CD integration.'
---

# OWASP ZAP (Zed Attack Proxy)

OWASP ZAP is the world's most popular free and open-source DAST tool. It's maintained by the OWASP Foundation and designed for finding security vulnerabilities in web applications during development and testing.

## Why ZAP?

- **Free and open source**: No licensing costs, unlimited scans
- **CI/CD native**: Docker images and CLI tools for automation
- **Active development**: Regular updates, strong community support
- **Extensible**: 100+ add-ons for specialized testing
- **Multi-platform**: Windows, macOS, Linux, Docker

## Installation

### Docker (Recommended for CI/CD)

```bash
# Pull the stable image
docker pull ghcr.io/zaproxy/zaproxy:stable

# Run ZAP in daemon mode
docker run -u zap -p 8080:8080 \
  ghcr.io/zaproxy/zaproxy:stable zap.sh \
  -daemon -host 0.0.0.0 -port 8080 \
  -config api.addrs.addr.name=.* \
  -config api.addrs.addr.regex=true
```

### Desktop (For Manual Testing)

```bash
# macOS (Homebrew)
brew install --cask owasp-zap

# Linux (snap)
sudo snap install zaproxy --classic

# Windows (Chocolatey)
choco install zap
```

### CLI Scripts (For Automation)

ZAP provides three automation-friendly Docker images:

```bash
# 1. Baseline Scan (Passive only - safe for production)
docker run -v $(pwd):/zap/wrk/:rw \
  ghcr.io/zaproxy/zaproxy:stable zap-baseline.py \
  -t https://example.com -r report.html

# 2. Full Scan (Active - use on staging only)
docker run -v $(pwd):/zap/wrk/:rw \
  ghcr.io/zaproxy/zaproxy:stable zap-full-scan.py \
  -t https://staging.example.com -r report.html

# 3. API Scan (OpenAPI/GraphQL)
docker run -v $(pwd):/zap/wrk/:rw \
  ghcr.io/zaproxy/zaproxy:stable zap-api-scan.py \
  -t https://api.example.com/openapi.json \
  -f openapi -r report.html
```

## ZAP Scan Types

### 1. Baseline Scan (Passive)

**When**: Safe for production, quick checks
**Duration**: 1-5 minutes
**Risk**: None

```bash
# Minimal scan with passive rules only
zap-baseline.py -t https://example.com

# With additional options
zap-baseline.py \
  -t https://example.com \
  -r baseline-report.html \
  -J baseline-report.json \
  -w baseline-report.md
```

**Detects**:
- Missing security headers
- Insecure cookies
- Information disclosure
- Outdated libraries (banner grabbing)

### 2. Full Scan (Active)

**When**: Staging/test environments only
**Duration**: 30 minutes to several hours
**Risk**: High (sends attacks)

```bash
# Full active + passive scan
zap-full-scan.py \
  -t https://staging.example.com \
  -r full-report.html \
  -z "-config api.maxchildren=5"
```

**Detects**: All passive issues + active vulnerabilities (SQL injection, XSS, etc.)

### 3. API Scan

**When**: REST/GraphQL APIs
**Duration**: 10-30 minutes
**Risk**: Medium

```bash
# OpenAPI/Swagger
zap-api-scan.py \
  -t https://api.example.com/openapi.json \
  -f openapi \
  -r api-report.html

# GraphQL
zap-api-scan.py \
  -t https://api.example.com/graphql \
  -f graphql \
  -r api-report.html
```

## Configuration

### Authentication

ZAP can authenticate to test protected endpoints:

```python
# auth_config.py
from zapv2 import ZAPv2

zap = ZAPv2(apikey='your-api-key')

# Form-based authentication
zap.authentication.set_authentication_method(
    contextid=0,
    authmethodname='formBasedAuthentication',
    authmethodconfigparams='loginUrl=https://example.com/login&loginRequestData=username%3D%7B%25username%25%7D%26password%3D%7B%25password%25%7D'
)

# Set user credentials
zap.users.new_user(contextid=0, name='testuser')
zap.users.set_authentication_credentials(
    contextid=0,
    userid=0,
    authcredentialsconfigparams='username=test@example.com&password=testpass'
)
```

### Context File

Define scan scope and authentication in a context file:

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

Use it:

```bash
zap-full-scan.py \
  -t https://staging.example.com \
  -n zap-context.yaml \
  -r report.html
```

### Custom Rules

Disable noisy or irrelevant rules:

```bash
# Disable specific rules
zap-full-scan.py \
  -t https://staging.example.com \
  -c "rules-config.tsv" \
  -r report.html
```

**rules-config.tsv**:
```
10021	IGNORE	(X-Content-Type-Options)
10038	IGNORE	(Content Security Policy)
10055	FAIL	(CSP Scanner)
```

## Reports

ZAP supports multiple report formats:

```bash
zap-full-scan.py -t https://example.com \
  -r report.html \
  -J report.json \
  -w report.md \
  -x report.xml
```

**Format comparison**:
- **HTML** (`-r`): Human-readable, good for manual review
- **JSON** (`-J`): Machine-parsable, for CI/CD pipelines
- **Markdown** (`-w`): Lightweight, for GitHub Issues/PRs
- **XML** (`-x`): Enterprise tools integration

## CI/CD Integration

### GitHub Actions

```yaml
name: DAST Scan

on:
  push:
    branches: [main]
  pull_request:

jobs:
  zap_scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Start application
        run: |
          docker-compose up -d
          sleep 30  # Wait for app to be ready
      
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
zap_scan:
  stage: test
  image: ghcr.io/zaproxy/zaproxy:stable
  script:
    - zap-baseline.py -t https://staging.example.com -r zap-report.html
  artifacts:
    when: always
    paths:
      - zap-report.html
    expire_in: 1 week
  allow_failure: true
```

### Jenkins

```groovy
pipeline {
  agent any
  stages {
    stage('DAST Scan') {
      steps {
        script {
          docker.image('ghcr.io/zaproxy/zaproxy:stable').inside {
            sh 'zap-full-scan.py -t https://staging.example.com -r zap-report.html'
          }
        }
      }
    }
  }
  post {
    always {
      publishHTML([
        reportDir: '.',
        reportFiles: 'zap-report.html',
        reportName: 'ZAP Security Report'
      ])
    }
  }
}
```

## Best Practices

1. **Start with baseline scans** - Passive scanning is safe and fast
2. **Use context files** - Define authentication and scope
3. **Tune false positives** - Disable irrelevant rules for your stack
4. **Fail builds on high/critical** - Use `-l FAIL` to set thresholds
5. **Scan staging, not production** - Active scans can cause damage
6. **Monitor scan duration** - Set timeouts to prevent infinite scans
7. **Version control your ZAP configs** - Keep rules and context files in Git

## Troubleshooting

### Scan Takes Too Long

```bash
# Reduce threads
zap-full-scan.py -t URL -z "-config api.maxchildren=2"

# Set timeout
zap-full-scan.py -t URL -m 30  # 30 minutes max
```

### Too Many False Positives

```bash
# Use confidence level
zap-baseline.py -t URL -c rules.tsv

# Ignore specific alerts
echo "10021\tIGNORE" > rules.tsv
```

### Authentication Not Working

Check ZAP logs:

```bash
docker run -v $(pwd):/zap/wrk/:rw \
  ghcr.io/zaproxy/zaproxy:stable \
  zap-full-scan.py -t URL -d
```

## Next Steps

- **[Burp Suite](./03-burp-suite)** — Learn professional-grade manual testing
- **[CI/CD Integration](./04-cicd-integration)** — Advanced automation patterns
