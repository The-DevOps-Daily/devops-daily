---
title: 'Semgrep'
description: 'Learn Semgrep for fast, customizable security scanning. Write custom rules, use the registry, and integrate into your CI/CD pipeline.'
---

Semgrep is a fast, open-source static analysis tool that excels at pattern matching across codebases. Unlike tools that require complex setup, Semgrep runs quickly with minimal configuration—making it ideal for pre-commit hooks and rapid CI feedback.

## Why Semgrep?

Semgrep fills a unique niche:

| Feature | Semgrep | Traditional SAST |
|---------|---------|------------------|
| Setup time | Minutes | Hours/Days |
| Scan speed | Fast (pattern matching) | Slower (deep analysis) |
| Custom rules | Easy (YAML) | Complex (proprietary) |
| False positives | Lower (precise patterns) | Higher |
| Analysis depth | Pattern + data flow | Full data flow |

**Best for:**
- Pre-commit hooks (fast feedback)
- Enforcing coding standards
- Custom security rules for your frameworks
- Catching common vulnerability patterns

## Installation

```bash
# macOS
brew install semgrep

# pip (any platform)
pip install semgrep

# Docker
docker run -v "${PWD}:/src" semgrep/semgrep semgrep --config=auto /src
```

Verify installation:

```bash
semgrep --version
# semgrep 1.56.0
```

## Running Your First Scan

Semgrep can auto-detect your languages and apply relevant rules:

```bash
# Scan current directory with auto-detected rules
semgrep --config=auto .

# Use specific rule packs
semgrep --config=p/security-audit .
semgrep --config=p/owasp-top-ten .
semgrep --config=p/python .

# Combine multiple configs
semgrep --config=p/security-audit --config=p/secrets .
```

### Output Formats

```bash
# Default: human-readable
semgrep --config=auto .

# JSON for CI/CD processing
semgrep --config=auto --json .

# SARIF for GitHub Code Scanning
semgrep --config=auto --sarif > results.sarif

# JUnit XML for test reporting
semgrep --config=auto --junit-xml > results.xml
```

## Semgrep Rule Registry

Semgrep maintains a curated registry of rules at [semgrep.dev/explore](https://semgrep.dev/explore).

### Popular Rule Packs

| Pack | Description | Rules |
|------|-------------|-------|
| `p/security-audit` | Comprehensive security rules | 500+ |
| `p/owasp-top-ten` | OWASP Top 10 vulnerabilities | 100+ |
| `p/secrets` | Hardcoded secrets detection | 50+ |
| `p/ci` | Rules optimized for CI (high confidence) | 200+ |
| `p/python` | Python-specific rules | 150+ |
| `p/javascript` | JavaScript/TypeScript rules | 150+ |
| `p/java` | Java rules | 100+ |

```bash
# See all available rules in a pack
semgrep --config=p/security-audit --dry-run .
```

## Writing Custom Rules

Semgrep rules are written in YAML. The pattern syntax is similar to the target language, making rules intuitive to write.

### Basic Rule Structure

```yaml
# my-rules/hardcoded-secrets.yaml
rules:
  - id: hardcoded-api-key
    patterns:
      - pattern: $VAR = "AKIA..."
    message: "Hardcoded AWS access key detected"
    severity: ERROR
    languages:
      - python
      - javascript
    metadata:
      category: security
      cwe: "CWE-798"
      owasp: "A07:2021 - Identification and Authentication Failures"
```

Run your custom rule:

```bash
semgrep --config=my-rules/hardcoded-secrets.yaml .
```

### Pattern Syntax

Semgrep patterns look like the code they match:

```yaml
# Match any eval() call
pattern: eval(...)

# Match specific function with arguments
pattern: subprocess.call($CMD, shell=True)

# Match string concatenation in SQL
pattern: cursor.execute("..." + $VAR + "...")
```

**Metavariables:**
- `$VAR` — Matches any single expression
- `$...ARGS` — Matches zero or more arguments
- `$_` — Matches anything (wildcard)

### Pattern Operators

#### pattern-either (OR)

Match any of several patterns:

```yaml
rules:
  - id: dangerous-exec
    pattern-either:
      - pattern: eval($X)
      - pattern: exec($X)
      - pattern: os.system($X)
    message: "Dangerous code execution function"
    severity: WARNING
    languages: [python]
```

#### patterns (AND)

Require all patterns to match:

```yaml
rules:
  - id: sql-injection-flask
    patterns:
      - pattern: cursor.execute($QUERY)
      - pattern-inside: |
          @app.route(...)
          def $FUNC(...):
            ...
    message: "SQL query in Flask route - check for injection"
    severity: WARNING
    languages: [python]
```

#### pattern-not (exclusion)

Exclude safe patterns:

```yaml
rules:
  - id: unparameterized-query
    patterns:
      - pattern: cursor.execute($QUERY)
      - pattern-not: cursor.execute($QUERY, $PARAMS)
    message: "SQL query without parameters - potential injection"
    severity: ERROR
    languages: [python]
```

#### pattern-inside (context)

Limit matches to specific code contexts:

```yaml
rules:
  - id: hardcoded-password-in-function
    patterns:
      - pattern: password = "..."
      - pattern-inside: |
          def $FUNC(...):
            ...
    message: "Hardcoded password in function"
    severity: ERROR
    languages: [python]
```

### Real-World Example: Flask Security Rules

```yaml
# flask-security.yaml
rules:
  - id: flask-debug-mode
    pattern: app.run(..., debug=True, ...)
    message: "Flask debug mode should not be enabled in production"
    severity: WARNING
    languages: [python]
    metadata:
      category: security
      cwe: "CWE-489"

  - id: flask-secret-key-hardcoded
    patterns:
      - pattern-either:
          - pattern: app.secret_key = "..."
          - pattern: app.config["SECRET_KEY"] = "..."
    message: "Flask secret key should not be hardcoded"
    severity: ERROR
    languages: [python]
    metadata:
      category: security
      cwe: "CWE-798"

  - id: flask-sql-injection
    patterns:
      - pattern-either:
          - pattern: |
              db.execute(f"...{$VAR}...")
          - pattern: |
              db.execute("..." + $VAR + "...")
          - pattern: |
              db.execute("..." % $VAR)
          - pattern: |
              db.execute("...".format($VAR))
      - pattern-not: |
          db.execute($QUERY, $PARAMS)
    message: "Potential SQL injection - use parameterized queries"
    severity: ERROR
    languages: [python]
    metadata:
      category: security
      cwe: "CWE-89"
      owasp: "A03:2021 - Injection"
```

### Taint Tracking (Advanced)

Semgrep Pro supports taint tracking to trace data flow:

```yaml
rules:
  - id: flask-xss
    mode: taint
    pattern-sources:
      - pattern: request.args.get(...)
      - pattern: request.form.get(...)
    pattern-sinks:
      - pattern: return $X
    pattern-sanitizers:
      - pattern: escape($X)
      - pattern: Markup.escape($X)
    message: "User input flows to response without sanitization - XSS risk"
    severity: ERROR
    languages: [python]
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/semgrep.yml
name: Semgrep

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  semgrep:
    runs-on: ubuntu-latest
    container:
      image: semgrep/semgrep
    steps:
      - uses: actions/checkout@v4

      - name: Run Semgrep
        run: semgrep scan --config=p/security-audit --error
        env:
          SEMGREP_APP_TOKEN: ${{ secrets.SEMGREP_APP_TOKEN }}
```

### Pre-commit Hook

Add to `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: https://github.com/semgrep/semgrep
    rev: v1.56.0
    hooks:
      - id: semgrep
        args: ['--config', 'p/security-audit', '--error']
```

### GitLab CI

```yaml
# .gitlab-ci.yml
semgrep:
  stage: test
  image: semgrep/semgrep
  script:
    - semgrep scan --config=p/security-audit --error --sarif > semgrep.sarif
  artifacts:
    reports:
      sast: semgrep.sarif
  rules:
    - if: $CI_MERGE_REQUEST_IID
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

## Ignoring False Positives

### Inline Ignores

```python
# Safe use of eval for configuration loading
result = eval(config_string)  # nosemgrep: dangerous-eval

# Or with rule ID
result = eval(config_string)  # nosemgrep: python.lang.security.audit.eval-detected
```

### File-Level Ignores

Create `.semgrepignore`:

```
# Ignore test files
tests/

# Ignore generated code
**/generated/

# Ignore specific files
legacy_code.py

# Ignore patterns
*.min.js
```

### Rule-Level Configuration

Create `semgrep.yaml` in your project root:

```yaml
# semgrep.yaml
rules:
  - id: my-org-rules
    pattern: ...
    paths:
      include:
        - src/
      exclude:
        - src/vendor/
        - src/generated/
```

## Performance Optimization

### Targeting Specific Directories

```bash
# Only scan source directories
semgrep --config=p/security-audit src/ lib/

# Exclude test directories
semgrep --config=p/security-audit --exclude='**/test/**' .
```

### Limiting Rules

```bash
# Use high-confidence rules only
semgrep --config=p/ci .

# Exclude slow rules
semgrep --config=p/security-audit --exclude-rule='*taint*' .
```

### Caching

Semgrep caches results between runs:

```bash
# Enable caching (default in CI)
export SEMGREP_SEND_METRICS=off
semgrep --config=p/security-audit --metrics=off .
```

## Semgrep vs. Other Tools

| Aspect | Semgrep | CodeQL | SonarQube |
|--------|---------|--------|----------|
| Speed | Very fast | Slow | Medium |
| Custom rules | Easy (YAML) | Complex (QL) | Medium |
| Free tier | Generous | Free for OSS | Community Edition |
| Taint analysis | Pro only | Yes | Yes |
| IDE integration | Yes | Limited | Yes |

**Use Semgrep when:**
- You need fast feedback in pre-commit or CI
- You want to write custom rules easily
- You're enforcing team coding standards

**Use CodeQL when:**
- You need deep semantic analysis
- You're auditing for complex vulnerabilities
- You have time for thorough scans

## Key Takeaways

1. **Semgrep is fast and easy** — Minutes to set up, seconds to run
2. **Pattern syntax is intuitive** — Rules look like the code they match
3. **Registry has 2000+ rules** — Start with `p/security-audit` or `p/ci`
4. **Great for pre-commit** — Fast enough to run on every commit
5. **Custom rules are powerful** — Enforce your team's security standards

Next, we'll explore CodeQL for deep semantic analysis and GitHub integration.
