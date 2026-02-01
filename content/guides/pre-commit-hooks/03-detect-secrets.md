---
title: 'Detect-secrets - Baseline-Aware Scanning'
description: 'Learn to use Yelp detect-secrets for secrets detection with baseline management and plugin-based architecture.'
---

Detect-secrets is an open-source tool from Yelp for detecting secrets in codebases. Its key differentiator is the baseline-aware approach—it tracks known secrets and only alerts on new ones.

## Why Detect-secrets?

Detect-secrets excels in these scenarios:

- **Legacy codebases** - Baseline files let you adopt gradually
- **Plugin architecture** - Easy to add custom detectors
- **Audit trail** - Track when secrets were introduced
- **Python ecosystem** - Native integration with Python tools

## Installation

```bash
# Using pip
pip install detect-secrets

# Verify installation
detect-secrets --version
# detect-secrets 1.4.0
```

## Basic Usage

Scan for secrets:

```bash
# Scan all files in current directory
detect-secrets scan

# Scan specific files
detect-secrets scan src/config.py src/auth.py

# Scan and output to baseline file
detect-secrets scan > .secrets.baseline
```

## The Baseline Workflow

Detect-secrets uses a baseline file (`.secrets.baseline`) to track known secrets:

```
Baseline Workflow
-----------------

1. Initial scan     ->  Create baseline with existing findings
2. Review baseline  ->  Mark false positives, plan remediation
3. Enable hook      ->  Block commits with NEW secrets
4. Remediate        ->  Fix old secrets, update baseline
```

### Step 1: Create Initial Baseline

```bash
# Scan repository and create baseline
detect-secrets scan > .secrets.baseline

# View what was found
cat .secrets.baseline
```

The baseline is a JSON file:

```json
{
  "version": "1.4.0",
  "plugins_used": [
    {"name": "AWSKeyDetector"},
    {"name": "BasicAuthDetector"},
    {"name": "HighEntropyString", "limit": 3.5}
  ],
  "results": {
    "config/settings.py": [
      {
        "type": "AWS Access Key",
        "line_number": 42,
        "hashed_secret": "abc123..."  // Hashed, not plaintext
      }
    ]
  }
}
```

### Step 2: Audit the Baseline

Review findings interactively:

```bash
detect-secrets audit .secrets.baseline
```

This opens an interactive prompt:

```
Secret:      1 of 5
Filename:    config/settings.py
Secret Type: AWS Access Key
----------
40: # AWS Configuration
41: aws_region = "us-west-2"
42: aws_access_key = "AKIAIOSFODNN7EXAMPLE"
43: aws_secret_key = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
44:
----------
Is this a valid secret? (y)es, (n)o, (s)kip, (q)uit:
```

Mark each finding:
- **y** - Real secret (needs remediation)
- **n** - False positive (will be ignored)
- **s** - Skip for now

### Step 3: Enable Pre-commit Hook

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/Yelp/detect-secrets
    rev: v1.4.0
    hooks:
      - id: detect-secrets
        args: ['--baseline', '.secrets.baseline']
```

Now commits are blocked if they introduce NEW secrets not in the baseline.

### Step 4: Update Baseline After Remediation

After fixing secrets, regenerate the baseline:

```bash
# Regenerate baseline
detect-secrets scan > .secrets.baseline

# Or update existing baseline (preserves audit results)
detect-secrets scan --baseline .secrets.baseline
```

## Plugins (Detectors)

Detect-secrets uses plugins to detect different secret types:

| Plugin | Detects |
|--------|----------|
| AWSKeyDetector | AWS access key IDs |
| ArtifactoryDetector | Artifactory tokens |
| AzureStorageKeyDetector | Azure storage keys |
| BasicAuthDetector | Basic auth in URLs |
| CloudantDetector | Cloudant credentials |
| DiscordBotTokenDetector | Discord bot tokens |
| GitHubTokenDetector | GitHub personal access tokens |
| HighEntropyString | Generic high-entropy strings |
| IbmCloudIamDetector | IBM Cloud IAM keys |
| IbmCosHmacDetector | IBM COS HMAC credentials |
| JwtTokenDetector | JWT tokens |
| KeywordDetector | Secrets near keywords like "password" |
| MailchimpDetector | Mailchimp API keys |
| NpmDetector | npm tokens |
| PrivateKeyDetector | PEM private keys |
| SendGridDetector | SendGrid API keys |
| SlackDetector | Slack tokens and webhooks |
| SoftlayerDetector | Softlayer credentials |
| SquareOAuthDetector | Square OAuth tokens |
| StripeDetector | Stripe API keys |
| TwilioKeyDetector | Twilio API keys |

### Configuring Plugins

Specify which plugins to use:

```bash
# Use only specific plugins
detect-secrets scan --list-all-plugins

# Disable a plugin
detect-secrets scan --disable-plugin KeywordDetector

# Adjust high entropy threshold
detect-secrets scan --base64-limit 4.5 --hex-limit 3.0
```

## Custom Plugins

Create custom detectors for organization-specific secrets:

```python
# my_detector.py
import re
from detect_secrets.plugins.base import RegexBasedDetector


class MyCompanyTokenDetector(RegexBasedDetector):
    """Detect MyCompany API tokens."""

    secret_type = 'MyCompany Token'

    denylist = [
        # Pattern: myco_live_xxxx or myco_test_xxxx
        re.compile(r'myco_(live|test)_[a-zA-Z0-9]{32}'),
    ]
```

Use the custom plugin:

```bash
detect-secrets scan --plugin my_detector.MyCompanyTokenDetector
```

## Allowlisting

### Inline Comments

Mark specific lines as safe:

```python
# This is an example key, not real
EXAMPLE_KEY = "AKIAIOSFODNN7EXAMPLE"  # pragma: allowlist secret
```

### File-level Allowlist

In the baseline, you can mark entire files:

```bash
# Exclude files from scanning
detect-secrets scan --exclude-files '\.git/.*' --exclude-files 'tests/fixtures/.*'
```

### Regex Allowlist

Exclude patterns across all files:

```bash
detect-secrets scan --exclude-secrets 'EXAMPLE[A-Z0-9]+'
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/detect-secrets.yml
name: Detect Secrets

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  detect-secrets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install detect-secrets
        run: pip install detect-secrets

      - name: Run detect-secrets
        run: |
          detect-secrets scan --baseline .secrets.baseline
          detect-secrets audit --report --baseline .secrets.baseline
```

### Reporting

Generate audit reports:

```bash
# Text report
detect-secrets audit --report .secrets.baseline

# JSON report
detect-secrets audit --json --report .secrets.baseline
```

## Gitleaks vs Detect-secrets

Both tools are excellent. Here's when to choose each:

| Feature | Gitleaks | Detect-secrets |
|---------|----------|----------------|
| Speed | Faster (Go) | Slower (Python) |
| Git history scanning | Excellent | Limited |
| Baseline management | Basic | Comprehensive |
| Custom rules | TOML config | Python plugins |
| Interactive audit | No | Yes |
| Best for | New repos, CI | Legacy repos, Python shops |

**Recommendation:**
- Use **gitleaks** for speed and git history scanning
- Use **detect-secrets** for baseline management and gradual adoption
- Use **both** in different stages (detect-secrets locally, gitleaks in CI)

## Best Practices

1. **Commit your baseline** - It's safe (secrets are hashed) and needed by teammates
2. **Audit regularly** - Review findings monthly and update baseline
3. **Don't ignore forever** - False positives today might be real secrets tomorrow
4. **Combine with gitleaks** - Use both for defense in depth
5. **Document exceptions** - Add comments explaining why secrets are allowlisted

