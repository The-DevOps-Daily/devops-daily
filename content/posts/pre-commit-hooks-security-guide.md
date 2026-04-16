---
title: 'Pre-commit Hooks for Security: Stop Secrets Before They Hit Your Repository'
excerpt: 'Once a secret is committed to Git, it lives forever in the history. Pre-commit hooks with gitleaks, detect-secrets, and custom checks catch credentials before that happens.'
category:
  name: 'Security'
  slug: 'security'
coverImage: '/images/posts/pre-commit-hooks-security-guide.png'
ogImage: '/images/posts/pre-commit-hooks-security-guide.svg'
date: '2025-01-24'
publishedAt: '2025-01-24T09:00:00Z'
readingTime: '10 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - security
  - git
  - pre-commit
  - secrets-detection
---

Last year a developer on a team I worked with committed an AWS access key in a config file "just for local testing." They pushed to a feature branch, opened a PR, and deleted the key in the next commit. Problem solved, right?

Wrong. Attackers scan GitHub constantly for exactly this pattern. The key was scraped within minutes, and by the time the team noticed unauthorized charges, someone had spun up crypto mining instances across three regions. The key existed in the git history for about 20 minutes. That was enough.

Once a secret is committed to Git, it lives in the repository history forever. Deleting the file does not help. Removing the line does not help. The secret is recoverable through `git log` until you rewrite history, and by then it is probably already compromised.

Pre-commit hooks stop this at the source. They run locally, check your staged changes before the commit is created, and block anything that looks like a credential. The cost is a few seconds per commit. The alternative is hours of incident response and credential rotation.

## Setting Up the Pre-commit Framework

The pre-commit framework is the standard tool for managing git hooks. It is language-agnostic, handles hook installation and updates, and runs everything from a single YAML config.

Install it:

```bash
pip install pre-commit

# Or with Homebrew
brew install pre-commit

# Verify
pre-commit --version
```

Create `.pre-commit-config.yaml` in your repository root with a security-focused configuration:

```yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: detect-private-key
      - id: check-added-large-files
        args: ['--maxkb=500']
      - id: check-merge-conflict
      - id: check-yaml
      - id: check-json

  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.1
    hooks:
      - id: gitleaks

  - repo: https://github.com/hadolint/hadolint
    rev: v2.12.0
    hooks:
      - id: hadolint
```

Then install the hooks:

```bash
pre-commit install
```

From this point forward, every `git commit` runs these checks on your staged files. If any hook fails, the commit is blocked and you see exactly what went wrong.

## Gitleaks: Fast Secrets Detection

Gitleaks is the industry standard for pre-commit secrets scanning. Written in Go, it scans thousands of files per second and comes with built-in rules for AWS keys, GCP API keys, Stripe tokens, database connection strings, private keys, JWTs, and dozens more.

### What It Looks Like When It Catches Something

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
```

The commit is blocked. The secret never enters your repository. You fix the file, restage, and commit again.

### Custom Rules and Allowlists

Real projects have false positives. Example API keys in documentation, test fixtures with fake credentials, placeholder values. Handle them with a `.gitleaks.toml` configuration:

```toml
title = "Custom Gitleaks Configuration"

[extend]
useDefault = true

# Add rules for internal token formats
[[rules]]
id = "internal-api-key"
description = "Internal API Key"
regex = '''INTERNAL_API_KEY_[A-Za-z0-9]{32}'''
tags = ["key", "internal"]

# Allowlist false positives
[allowlist]
paths = [
    '''tests/fixtures/.*''',
    '''docs/examples/.*''',
]
regexes = [
    '''EXAMPLE[A-Z0-9]+''',
    '''test_api_key_.*''',
]
```

Use allowlists in the config file, not inline `gitleaks:allow` comments scattered across your codebase. The config file is auditable and centralized.

### Scanning Existing History

Before enabling hooks, audit your repository for secrets that are already in the git history:

```bash
# Scan all commits
gitleaks detect --log-opts="--all"

# Scan since a specific date
gitleaks detect --log-opts="--since=2024-01-01"

# Output to JSON for processing
gitleaks detect -f json -r results.json
```

For repositories with existing known secrets, create a baseline so future scans only flag new findings:

```bash
gitleaks detect --baseline-path .gitleaks-baseline.json \
  --report-path .gitleaks-baseline.json
```

## Detect-secrets: Baseline-Aware Scanning

Detect-secrets from Yelp takes a different approach. Instead of scanning git history, it maintains a baseline file that tracks known secrets and only alerts on new ones. This makes it better suited for legacy codebases where fixing every historical secret on day one is not realistic.

### The Baseline Workflow

```bash
# Step 1: Create initial baseline
detect-secrets scan > .secrets.baseline

# Step 2: Audit interactively - mark each finding as real or false positive
detect-secrets audit .secrets.baseline

# Step 3: Add the hook to pre-commit config
# Step 4: Update baseline as you remediate
detect-secrets scan --baseline .secrets.baseline
```

The audit step is where detect-secrets shines. It walks you through each finding and asks whether it is a real secret or a false positive. Your answers are stored in the baseline, so the tool never flags the same false positive twice.

The baseline file is safe to commit. Secrets are stored as hashes, not plaintext.

### Pre-commit Integration

```yaml
repos:
  - repo: https://github.com/Yelp/detect-secrets
    rev: v1.4.0
    hooks:
      - id: detect-secrets
        args: ['--baseline', '.secrets.baseline']
```

With this in place, the hook only blocks commits that introduce new secrets not already in the baseline.

### Custom Plugins

Detect-secrets supports Python plugins for organization-specific secret formats:

```python
import re
from detect_secrets.plugins.base import RegexBasedDetector

class MyCompanyTokenDetector(RegexBasedDetector):
    """Detect MyCompany API tokens."""
    secret_type = 'MyCompany Token'
    denylist = [
        re.compile(r'myco_(live|test)_[a-zA-Z0-9]{32}'),
    ]
```

### When to Use Gitleaks vs Detect-secrets

Both tools are solid. Here is when to pick each:

| Scenario | Best tool |
|----------|-----------|
| New repo, clean history | Gitleaks |
| Legacy codebase with known secrets | Detect-secrets |
| Speed is critical | Gitleaks (Go vs Python) |
| Need interactive audit workflow | Detect-secrets |
| Git history scanning | Gitleaks |
| Python-heavy team | Detect-secrets |

The best setup uses both: detect-secrets locally for the baseline workflow, gitleaks in CI as a backstop.

## Custom Security Hooks

Off-the-shelf tools cover common cases, but every organization has specific needs. The pre-commit framework supports local hooks that run your own scripts.

### Block Sensitive File Types

Prevent `.pem`, `.key`, `.env`, and SSH key files from being committed:

```bash
#!/bin/bash
# scripts/block-sensitive-files.sh

BLOCKED_PATTERNS=(
    '\.pem$' '\.key$' '\.p12$' '\.pfx$'
    '\.env$' '\.env\.local$'
    'id_rsa' 'id_ed25519'
    '\.keystore$' '\.jks$'
)

exit_code=0
for file in "$@"; do
    for pattern in "${BLOCKED_PATTERNS[@]}"; do
        if [[ "$file" =~ $pattern ]]; then
            echo "ERROR: Blocked file type: $file"
            echo "  Add to .gitignore and use environment variables instead."
            exit_code=1
        fi
    done
done
exit $exit_code
```

```yaml
- repo: local
  hooks:
    - id: block-sensitive-files
      name: Block sensitive file types
      entry: scripts/block-sensitive-files.sh
      language: script
      types: [file]
```

### Check Dockerfile Security

Catch common Dockerfile security mistakes before they make it into review:

```bash
#!/bin/bash
# scripts/check-dockerfile-security.sh

exit_code=0
for file in "$@"; do
    if grep -q '^USER root' "$file" && ! grep -q '^USER [^r]' "$file"; then
        echo "WARNING: $file runs as root. Add a non-root USER."
        exit_code=1
    fi
    if grep -qE '^FROM .+:latest' "$file"; then
        echo "ERROR: $file uses :latest tag. Pin to specific version."
        exit_code=1
    fi
    if grep -qiE '^ENV.*(password|secret|key|token)=' "$file"; then
        echo "ERROR: $file may contain secrets in ENV. Use build args or secrets mount."
        exit_code=1
    fi
done
exit $exit_code
```

### Block Debug Code

Prevent `console.log`, `pdb.set_trace()`, `binding.pry`, and other debugging leftovers from reaching production:

```yaml
- repo: local
  hooks:
    - id: no-debug-code
      name: Block debug code
      entry: python scripts/check-debug-code.py
      language: python
      files: \.(py|js|ts|rb)$
```

The script checks staged files for common debug patterns and blocks the commit if any are found. Keep an allowlist for legitimate uses like logging libraries.

## Running Pre-commit in CI

Local hooks can be bypassed with `git commit --no-verify`. That is fine for emergencies, but you need a backstop. Run pre-commit in CI to catch anything that slipped through:

```yaml
# .github/workflows/pre-commit.yml
name: Pre-commit

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  pre-commit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - uses: pre-commit/action@v3.0.1
```

For gitleaks specifically, run it with full history scanning in CI:

```yaml
jobs:
  gitleaks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Rolling This Out to Your Team

The biggest challenge with pre-commit hooks is adoption. If developers see them as annoying friction, they will bypass them. Here is what works:

**Automate the setup.** Add a Makefile target or setup script:

```makefile
.PHONY: setup
setup:
	pip install pre-commit
	pre-commit install
	pre-commit install --hook-type commit-msg
```

**Start with a few hooks.** Do not enable 15 hooks on day one. Start with `detect-private-key` and `gitleaks`. Add more once the team is used to the workflow.

**Keep hooks fast.** If hooks take more than 10 seconds, developers will start using `--no-verify`. Use `exclude` patterns to skip vendor directories and generated code:

```yaml
- repo: https://github.com/gitleaks/gitleaks
  rev: v8.18.1
  hooks:
    - id: gitleaks
      exclude: '^(vendor/|node_modules/|dist/)'
```

**Update regularly.** New secret patterns emerge constantly. Run `pre-commit autoupdate` monthly to get the latest detection rules.

## What to Do When a Secret Leaks Anyway

No tool catches everything. When a secret does get committed:

1. **Rotate the credential immediately.** Assume it is compromised the moment it was pushed, regardless of whether the repo is public or private.
2. **Remove the secret from the current code** and commit the fix.
3. **Do not just rewrite git history** and call it done. If the secret was pushed to a remote, it may have been cached, forked, or scraped.
4. **Check access logs** for the compromised credential to determine if it was used.
5. **Add the pattern to your gitleaks config** so the same type of secret is caught next time.

Pre-commit hooks are not a silver bullet. They are one layer in a defense-in-depth strategy. Combine them with CI scanning, secret rotation policies, and OIDC-based authentication to minimize both the likelihood and impact of credential exposure.

The cost of adding pre-commit hooks to your workflow is about 30 minutes of setup and a few seconds per commit. The cost of not having them is one leaked credential away from becoming very real.

---

## Related Security Posts

- [Secrets Management Guide: Vault, AWS Secrets Manager, and Azure Key Vault](/posts/secrets-management-guide) - What to do after you stop leaking secrets: rotate automatically, use dynamic credentials, and eliminate .env files
- [Dependency Scanning: Finding Vulnerabilities Before Attackers Do](/posts/dependency-scanning-guide) - Extend your pre-commit safety net by scanning every dependency for known CVEs in CI
- [Security-Focused Code Reviews](/posts/security-focused-code-reviews) - The human layer that catches logic flaws, auth bypasses, and injection patterns your hooks will miss

For static analysis beyond secrets detection, see our guide on [SAST tools](/guides/sast-tools).
