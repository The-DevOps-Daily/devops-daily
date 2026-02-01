---
title: 'Custom Security Hooks'
description: 'Learn to build custom pre-commit hooks for organization-specific security checks and validation rules.'
---

While tools like gitleaks and detect-secrets handle common cases, you'll often need custom hooks for organization-specific security requirements. This section covers building your own security-focused pre-commit hooks.

## Local Hooks

The pre-commit framework supports local hooks that run scripts from your repository:

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: check-security-headers
        name: Check security headers in configs
        entry: scripts/check-security-headers.sh
        language: script
        files: \.(yaml|yml|json)$
```

## Common Custom Hook Use Cases

### 1. Blocking Sensitive File Types

Prevent committing files that should never be in version control:

```bash
#!/bin/bash
# scripts/block-sensitive-files.sh

BLOCKED_PATTERNS=(
    '\.pem$'
    '\.key$'
    '\.p12$'
    '\.pfx$'
    '\.env$'
    '\.env\.local$'
    'id_rsa'
    'id_ed25519'
    '\.keystore$'
    '\.jks$'
)

exit_code=0

for file in "$@"; do
    for pattern in "${BLOCKED_PATTERNS[@]}"; do
        if [[ "$file" =~ $pattern ]]; then
            echo "ERROR: Blocked file type: $file"
            echo "  Files matching '$pattern' should not be committed."
            echo "  Add to .gitignore and use environment variables instead."
            exit_code=1
        fi
    done
done

exit $exit_code
```

Hook configuration:

```yaml
- repo: local
  hooks:
    - id: block-sensitive-files
      name: Block sensitive file types
      entry: scripts/block-sensitive-files.sh
      language: script
      types: [file]
```

### 2. Enforcing Secure Defaults in Configuration

Check that security settings are properly configured:

```python
#!/usr/bin/env python3
"""Check security settings in YAML configuration files."""

import sys
import yaml

REQUIRED_SECURITY_SETTINGS = {
    'tls': {'enabled': True, 'min_version': 'TLSv1.2'},
    'cors': {'allow_credentials': False},
    'rate_limiting': {'enabled': True},
}


def check_security_settings(filepath):
    """Verify required security settings are present."""
    errors = []

    with open(filepath, 'r') as f:
        try:
            config = yaml.safe_load(f)
        except yaml.YAMLError as e:
            return [f"Invalid YAML: {e}"]

    if not config:
        return []

    # Check TLS settings
    if 'server' in config:
        server = config['server']
        if server.get('tls', {}).get('enabled') is False:
            errors.append("TLS must be enabled in production configs")
        if server.get('tls', {}).get('min_version') == 'TLSv1.0':
            errors.append("TLS 1.0 is insecure, use TLSv1.2 minimum")

    # Check authentication settings
    if 'auth' in config:
        auth = config['auth']
        if auth.get('session_timeout', 0) > 86400:
            errors.append("Session timeout exceeds 24 hours")
        if auth.get('password_min_length', 0) < 12:
            errors.append("Password minimum length should be 12+ characters")

    # Check for insecure patterns
    if 'debug' in config and config['debug'] is True:
        errors.append("Debug mode should not be enabled")

    return errors


def main():
    exit_code = 0

    for filepath in sys.argv[1:]:
        if not filepath.endswith(('.yaml', '.yml')):
            continue

        errors = check_security_settings(filepath)
        if errors:
            print(f"\nSecurity issues in {filepath}:")
            for error in errors:
                print(f"  - {error}")
            exit_code = 1

    sys.exit(exit_code)


if __name__ == '__main__':
    main()
```

Hook configuration:

```yaml
- repo: local
  hooks:
    - id: check-security-config
      name: Check security configuration
      entry: python scripts/check-security-config.py
      language: python
      files: \.(yaml|yml)$
      additional_dependencies: ['pyyaml']
```

### 3. Validating Dockerfile Security

Check Dockerfiles for common security issues:

```bash
#!/bin/bash
# scripts/check-dockerfile-security.sh

exit_code=0

for file in "$@"; do
    # Check for root user
    if grep -q '^USER root' "$file" && ! grep -q '^USER [^r]' "$file"; then
        echo "WARNING: $file runs as root. Add a non-root USER."
        exit_code=1
    fi

    # Check for latest tag
    if grep -qE '^FROM .+:latest' "$file"; then
        echo "ERROR: $file uses :latest tag. Pin to specific version."
        exit_code=1
    fi

    # Check for ADD with URL (prefer COPY + curl)
    if grep -qE '^ADD https?://' "$file"; then
        echo "WARNING: $file uses ADD with URL. Use COPY + curl for better caching."
    fi

    # Check for exposed secrets in ENV
    if grep -qiE '^ENV.*(password|secret|key|token)=' "$file"; then
        echo "ERROR: $file may contain secrets in ENV. Use build args or secrets mount."
        exit_code=1
    fi

    # Check for missing HEALTHCHECK
    if ! grep -q '^HEALTHCHECK' "$file"; then
        echo "INFO: $file has no HEALTHCHECK. Consider adding one."
    fi
done

exit $exit_code
```

### 4. Preventing Debug Code

Block common debugging patterns from being committed:

```python
#!/usr/bin/env python3
"""Block debug code patterns from being committed."""

import re
import sys

DEBUG_PATTERNS = [
    (r'console\.log\(', 'JavaScript console.log'),
    (r'debugger;', 'JavaScript debugger statement'),
    (r'import pdb', 'Python pdb import'),
    (r'pdb\.set_trace\(', 'Python pdb breakpoint'),
    (r'breakpoint\(\)', 'Python breakpoint()'),
    (r'binding\.pry', 'Ruby binding.pry'),
    (r'byebug', 'Ruby byebug'),
    (r'print_r\(.*\);\s*die', 'PHP print_r/die'),
    (r'var_dump\(', 'PHP var_dump'),
    (r'dd\(', 'Laravel dd()'),
    (r'TODO:\s*remove', 'TODO remove marker'),
    (r'FIXME:\s*debug', 'FIXME debug marker'),
]

ALLOWED_PATTERNS = [
    r'//\s*eslint-disable',
    r'#\s*noqa',
    r'//\s*nolint',
]


def check_file(filepath):
    """Check file for debug patterns."""
    issues = []

    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
    except Exception:
        return []

    for line_num, line in enumerate(lines, 1):
        # Skip if line has an allowed pattern
        if any(re.search(p, line) for p in ALLOWED_PATTERNS):
            continue

        for pattern, description in DEBUG_PATTERNS:
            if re.search(pattern, line, re.IGNORECASE):
                issues.append((line_num, description, line.strip()[:60]))

    return issues


def main():
    exit_code = 0

    for filepath in sys.argv[1:]:
        issues = check_file(filepath)
        if issues:
            print(f"\nDebug code found in {filepath}:")
            for line_num, desc, snippet in issues:
                print(f"  Line {line_num}: {desc}")
                print(f"    {snippet}")
            exit_code = 1

    sys.exit(exit_code)


if __name__ == '__main__':
    main()
```

### 5. Enforcing Security Headers in Code

Check that HTTP responses include required security headers:

```python
#!/usr/bin/env python3
"""Check for security headers in HTTP response code."""

import re
import sys

REQUIRED_HEADERS = [
    'X-Content-Type-Options',
    'X-Frame-Options',
    'Content-Security-Policy',
    'Strict-Transport-Security',
]

# Patterns that indicate HTTP response handling
RESPONSE_PATTERNS = [
    r'res\.set\(',           # Express.js
    r'response\.headers',    # Various frameworks
    r'Response\(',           # Django, Flask
    r'HttpResponse',         # Django
    r'render_template',      # Flask
]


def check_file(filepath):
    """Check if file handles HTTP responses and includes security headers."""
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    # Check if this file handles HTTP responses
    handles_responses = any(
        re.search(p, content) for p in RESPONSE_PATTERNS
    )

    if not handles_responses:
        return []  # Not a response handler

    # Check for security headers
    missing = []
    for header in REQUIRED_HEADERS:
        if header.lower() not in content.lower():
            missing.append(header)

    return missing


def main():
    exit_code = 0

    for filepath in sys.argv[1:]:
        # Only check relevant file types
        if not filepath.endswith(('.py', '.js', '.ts', '.go', '.rb')):
            continue

        missing = check_file(filepath)
        if missing:
            print(f"\n{filepath} handles HTTP but may be missing headers:")
            for header in missing:
                print(f"  - {header}")
            print("  Consider adding these headers or using security middleware.")
            # Warning only, don't fail

    sys.exit(exit_code)


if __name__ == '__main__':
    main()
```

## Hook Configuration Options

Pre-commit hooks support many configuration options:

```yaml
- repo: local
  hooks:
    - id: my-security-check
      name: My Security Check
      entry: scripts/security-check.sh
      language: script

      # File filtering
      files: \.(py|js|ts)$          # Only these extensions
      exclude: ^tests/               # Skip test files
      types: [python]               # Or use file types
      types_or: [python, javascript]

      # Execution
      pass_filenames: true          # Pass files as arguments
      always_run: false             # Only run if files match
      require_serial: false         # Can run in parallel
      verbose: false                # Show output even on success

      # Dependencies
      additional_dependencies: ['requests', 'pyyaml']
```

## Writing Hooks in Different Languages

### Python Hook

```yaml
- repo: local
  hooks:
    - id: python-security-check
      name: Python security check
      entry: python scripts/check.py
      language: python
      files: \.py$
      additional_dependencies: ['bandit']
```

### Node.js Hook

```yaml
- repo: local
  hooks:
    - id: js-security-check
      name: JavaScript security check
      entry: node scripts/check.js
      language: node
      files: \.(js|ts)$
      additional_dependencies: ['eslint']
```

### Go Hook

```yaml
- repo: local
  hooks:
    - id: go-security-check
      name: Go security check
      entry: go run scripts/check.go
      language: golang
      files: \.go$
```

### Docker Hook

Run security tools in containers:

```yaml
- repo: local
  hooks:
    - id: trivy-scan
      name: Trivy vulnerability scan
      entry: docker run --rm -v "$(pwd):/src" aquasec/trivy fs /src
      language: system
      pass_filenames: false
      always_run: true
```

## Testing Your Hooks

Before rolling out to the team, test thoroughly:

```bash
# Run on all files
pre-commit run my-hook-id --all-files

# Run with verbose output
pre-commit run my-hook-id --all-files --verbose

# Test on specific files
pre-commit run my-hook-id --files src/config.py

# Debug hook environment
pre-commit run my-hook-id --all-files --verbose 2>&1 | head -50
```

## Publishing Custom Hooks

Share hooks across repositories by creating a hooks repository:

```yaml
# In your hooks repo: .pre-commit-hooks.yaml
- id: company-secrets-check
  name: Company Secrets Check
  entry: scripts/check-secrets.sh
  language: script
  files: ''

- id: security-config-validator
  name: Security Config Validator
  entry: scripts/validate-config.py
  language: python
  files: \.(yaml|yml)$
  additional_dependencies: ['pyyaml>=6.0']
```

Use in other repositories:

```yaml
# In consuming repo: .pre-commit-config.yaml
repos:
  - repo: https://github.com/mycompany/security-hooks
    rev: v1.2.0
    hooks:
      - id: company-secrets-check
      - id: security-config-validator
```

## Best Practices for Custom Hooks

1. **Keep hooks fast** - Aim for under 5 seconds per hook
2. **Provide clear error messages** - Tell developers exactly what's wrong and how to fix it
3. **Support allowlisting** - Not every rule applies everywhere
4. **Test on multiple platforms** - macOS, Linux, Windows (if applicable)
5. **Version your hooks** - Use semantic versioning in your hooks repo
6. **Document exceptions** - Make it easy to bypass hooks when legitimately needed

