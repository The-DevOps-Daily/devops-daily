---
title: 'Gitleaks - Secrets Detection'
description: 'Use gitleaks to detect hardcoded secrets, API keys, and credentials in your codebase before they get committed.'
---

Gitleaks is a fast, open-source tool for detecting hardcoded secrets in git repositories. It uses regular expressions to identify patterns that look like API keys, passwords, tokens, and other sensitive data.

## Why Gitleaks?

Gitleaks has become the industry standard for pre-commit secrets detection:

- **Fast** - Written in Go, scans thousands of files per second
- **Accurate** - Comprehensive rule set with low false-positive rate
- **Flexible** - Custom rules and allowlists
- **CI-ready** - Easy integration with GitHub Actions, GitLab CI, etc.

## Installation

```bash
# macOS
brew install gitleaks

# Linux (download binary)
wget https://github.com/gitleaks/gitleaks/releases/download/v8.18.1/gitleaks_8.18.1_linux_x64.tar.gz
tar -xzf gitleaks_8.18.1_linux_x64.tar.gz
sudo mv gitleaks /usr/local/bin/

# Using Go
go install github.com/gitleaks/gitleaks/v8@latest

# Using Docker
docker pull ghcr.io/gitleaks/gitleaks:latest

# Verify installation
gitleaks version
# gitleaks version 8.18.1
```

## Basic Usage

Scan a repository for secrets:

```bash
# Scan current directory
gitleaks detect

# Scan with verbose output
gitleaks detect -v

# Scan a specific directory
gitleaks detect --source /path/to/repo

# Output results to JSON
gitleaks detect -f json -r results.json
```

## What Gitleaks Detects

Gitleaks comes with built-in rules for common secret patterns:

| Category | Examples |
|----------|----------|
| Cloud Providers | AWS Access Keys, GCP API Keys, Azure Secrets |
| Version Control | GitHub Tokens, GitLab Tokens, Bitbucket Tokens |
| Communication | Slack Webhooks, Discord Tokens, Twilio Keys |
| Databases | MongoDB URIs, PostgreSQL Connection Strings |
| Payment | Stripe API Keys, PayPal Credentials |
| General | Private Keys, JWT Secrets, Generic Passwords |

## Pre-commit Integration

Add gitleaks to your `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.1
    hooks:
      - id: gitleaks
```

Now every commit is scanned before it's created:

```bash
$ git commit -m "Add config file"
gitleaks................................................................Failed
- hook id: gitleaks
- exit code: 1

Finding:     aws_access_key_id = AKIAIOSFODNN7EXAMPLE
Secret:      AKIAIOSFODNN7EXAMPLE
RuleID:      aws-access-key-id
Entropy:     3.684184
File:        config/settings.py
Line:        42
Commit:      (staged)
```

## Custom Configuration

Create a `.gitleaks.toml` file for custom rules and allowlists:

```toml
# .gitleaks.toml
title = "Custom Gitleaks Configuration"

# Extend the default rules
[extend]
useDefault = true

# Add custom rules
[[rules]]
id = "internal-api-key"
description = "Internal API Key"
regex = '''INTERNAL_API_KEY_[A-Za-z0-9]{32}'''
tags = ["key", "internal"]

[[rules]]
id = "custom-token"
description = "Custom Service Token"
regex = '''mycompany_token_[a-f0-9]{64}'''
tags = ["token", "custom"]

# Allowlist paths (false positives)
[allowlist]
paths = [
    '''tests/fixtures/.*''',
    '''docs/examples/.*''',
    '''.*_test\.go''',
]

# Allowlist specific commits
commits = [
    "abc123def456",  # Known false positive commit
]

# Allowlist specific strings
regexes = [
    '''EXAMPLE[A-Z0-9]+''',  # Example placeholders
    '''test_api_key_.*''',   # Test keys
]
```

Use the custom config:

```bash
gitleaks detect --config .gitleaks.toml
```

## Scanning Git History

Gitleaks can scan your entire git history for leaked secrets:

```bash
# Scan all commits
gitleaks detect --log-opts="--all"

# Scan specific branch
gitleaks detect --log-opts="main"

# Scan commits since a date
gitleaks detect --log-opts="--since=2024-01-01"

# Scan a range of commits
gitleaks detect --log-opts="abc123..def456"
```

This is useful for auditing existing repositories before enabling pre-commit hooks.

## Baseline Files

For repositories with existing (known) secrets, create a baseline:

```bash
# Generate baseline of existing findings
gitleaks detect --baseline-path .gitleaks-baseline.json --report-path .gitleaks-baseline.json

# Future scans ignore baseline findings
gitleaks detect --baseline-path .gitleaks-baseline.json
```

This lets you adopt gitleaks gradually without fixing every historical issue immediately.

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/gitleaks.yml
name: Gitleaks

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  gitleaks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for scanning

      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### GitLab CI

```yaml
# .gitlab-ci.yml
gitleaks:
  stage: test
  image: ghcr.io/gitleaks/gitleaks:latest
  script:
    - gitleaks detect --source . --verbose
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == "main"
```

### Pre-receive Hook (Server-side)

For GitLab or self-hosted Git servers, you can add a pre-receive hook:

```bash
#!/bin/bash
# pre-receive hook

while read oldrev newrev refname; do
    # Skip deletions
    if [ "$newrev" = "0000000000000000000000000000000000000000" ]; then
        continue
    fi

    # Scan new commits
    if ! gitleaks detect --log-opts="$oldrev..$newrev" --verbose; then
        echo "ERROR: Secrets detected in push. Please remove them and try again."
        exit 1
    fi
done
```

## Handling False Positives

When gitleaks flags a false positive, you have several options:

### Option 1: Inline Comment (Not Recommended)

```python
# This triggers a false positive, avoid if possible
example_key = "AKIAIOSFODNN7EXAMPLE"  # gitleaks:allow
```

### Option 2: Allowlist in Config (Recommended)

```toml
# .gitleaks.toml
[allowlist]
regexes = [
    '''AKIAIOSFODNN7EXAMPLE''',  # AWS example key from docs
]
```

### Option 3: Path Exclusion

```toml
# .gitleaks.toml
[allowlist]
paths = [
    '''tests/fixtures/fake_credentials\.json''',
]
```

## Understanding Entropy

Gitleaks uses entropy calculation to reduce false positives. High entropy strings (random-looking) are more likely to be secrets:

```
Entropy Examples
----------------

"password123"           -> Low entropy (2.1)  -> Less likely a real secret
"aB3$kL9@mN2&pQ5^"      -> High entropy (4.0) -> More likely a real secret
"sk_live_4eC39HqLyjWDa" -> High entropy (3.8) -> Likely a Stripe key
```

You can adjust entropy thresholds in custom rules:

```toml
[[rules]]
id = "high-entropy-string"
description = "High entropy string that might be a secret"
regex = '''[A-Za-z0-9+/]{40,}'''
entropy = 4.5  # Only flag if entropy > 4.5
```

## Output Formats

Gitleaks supports multiple output formats:

```bash
# JSON (for programmatic processing)
gitleaks detect -f json -r report.json

# SARIF (for GitHub Security tab)
gitleaks detect -f sarif -r report.sarif

# CSV (for spreadsheets)
gitleaks detect -f csv -r report.csv

# Plain text (default)
gitleaks detect
```

## Best Practices

1. **Start with a baseline** - Don't try to fix every historical secret on day one
2. **Use allowlists carefully** - Document why each allowlist entry exists
3. **Scan in CI too** - Pre-commit can be bypassed, CI cannot
4. **Review findings regularly** - Some secrets slip through despite tooling
5. **Rotate exposed secrets immediately** - If a secret was ever committed, assume it's compromised

