---
title: 'Pre-commit Framework'
description: 'Learn to install and configure the pre-commit framework for managing git hooks across your development team.'
---

The pre-commit framework is a language-agnostic tool for managing git hooks. It handles installation, updates, and execution of hooks from a simple YAML configuration file.

## Installation

Install pre-commit using pip (Python's package manager):

```bash
# Install pre-commit
pip install pre-commit

# Verify installation
pre-commit --version
# pre-commit 3.6.0
```

Alternative installation methods:

```bash
# Using Homebrew (macOS/Linux)
brew install pre-commit

# Using pipx (isolated environment)
pipx install pre-commit

# Using conda
conda install -c conda-forge pre-commit
```

## Basic Configuration

Create a `.pre-commit-config.yaml` file in your repository root:

```yaml
# .pre-commit-config.yaml
repos:
  # Built-in hooks from pre-commit
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files
        args: ['--maxkb=500']
      - id: check-merge-conflict
      - id: detect-private-key
```

Install the hooks into your git repository:

```bash
# Install hooks defined in .pre-commit-config.yaml
pre-commit install

# Output: pre-commit installed at .git/hooks/pre-commit
```

## How Pre-commit Works

When you run `git commit`, pre-commit intercepts the command and runs your configured hooks:

```
Commit Flow with Pre-commit
---------------------------

git commit -m "message"
        |
        v
[pre-commit hook triggered]
        |
        v
[Run each configured hook]
        |
    +---+---+
    |       |
  Pass    Fail
    |       |
    v       v
[Commit   [Commit blocked,
proceeds]  show errors]
```

Hooks only run on staged files by default, making them fast even in large repositories.

## Security-Focused Configuration

Here's a comprehensive configuration for security-focused pre-commit hooks:

```yaml
# .pre-commit-config.yaml
repos:
  # Standard pre-commit hooks
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: detect-private-key
      - id: check-added-large-files
      - id: check-merge-conflict
      - id: check-yaml
        args: [--unsafe]  # Allow custom tags
      - id: check-json
      - id: check-xml
      - id: check-toml

  # Secrets detection with gitleaks
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.1
    hooks:
      - id: gitleaks

  # Alternative: detect-secrets from Yelp
  - repo: https://github.com/Yelp/detect-secrets
    rev: v1.4.0
    hooks:
      - id: detect-secrets
        args: ['--baseline', '.secrets.baseline']

  # Security linting for Python
  - repo: https://github.com/PyCQA/bandit
    rev: 1.7.7
    hooks:
      - id: bandit
        args: ['-c', 'pyproject.toml']
        additional_dependencies: ['bandit[toml]']

  # Dockerfile security
  - repo: https://github.com/hadolint/hadolint
    rev: v2.12.0
    hooks:
      - id: hadolint
```

## Running Hooks Manually

You can run hooks without committing:

```bash
# Run all hooks on all files
pre-commit run --all-files

# Run a specific hook
pre-commit run gitleaks --all-files

# Run hooks on specific files
pre-commit run --files src/config.py src/auth.py

# Run hooks on staged files only (default behavior)
pre-commit run
```

## Updating Hooks

Keep your hooks up to date to get the latest security rules:

```bash
# Update all hooks to latest versions
pre-commit autoupdate

# Update a specific repo
pre-commit autoupdate --repo https://github.com/gitleaks/gitleaks
```

## Skipping Hooks (When Necessary)

Sometimes you need to bypass hooks (use sparingly):

```bash
# Skip all hooks for this commit
git commit --no-verify -m "Emergency fix"
# Or use the short flag
git commit -n -m "Emergency fix"

# Skip specific hooks
SKIP=gitleaks git commit -m "Commit with known false positive"

# Skip multiple hooks
SKIP=gitleaks,bandit git commit -m "Commit message"
```

**Warning:** Skipping hooks should be rare and documented. Consider using allowlists instead of skipping entirely.

## Team-Wide Installation

Ensure everyone on your team uses pre-commit:

### Option 1: Document in README

```markdown
## Development Setup

1. Install pre-commit: `pip install pre-commit`
2. Install hooks: `pre-commit install`
```

### Option 2: Makefile Target

```makefile
# Makefile
.PHONY: setup
setup:
	pip install pre-commit
	pre-commit install
	pre-commit install --hook-type commit-msg
```

### Option 3: Post-clone Hook Script

```bash
#!/bin/bash
# scripts/setup-dev.sh

echo "Setting up development environment..."

# Install pre-commit if not present
if ! command -v pre-commit &> /dev/null; then
    echo "Installing pre-commit..."
    pip install pre-commit
fi

# Install hooks
pre-commit install
pre-commit install --hook-type commit-msg

echo "Pre-commit hooks installed successfully!"
```

## CI Integration

Run pre-commit in your CI pipeline as a backup:

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

This catches any commits where developers bypassed local hooks.

## Hook Stages

Pre-commit supports different git hook stages:

```yaml
repos:
  - repo: local
    hooks:
      # Runs before commit (default)
      - id: unit-tests
        name: Run unit tests
        entry: pytest tests/unit -q
        language: system
        stages: [commit]

      # Runs before push
      - id: integration-tests
        name: Run integration tests
        entry: pytest tests/integration
        language: system
        stages: [push]

      # Validates commit message format
      - id: commit-msg-check
        name: Check commit message
        entry: scripts/check-commit-msg.sh
        language: script
        stages: [commit-msg]
```

Install hooks for different stages:

```bash
# Install pre-push hooks
pre-commit install --hook-type pre-push

# Install commit-msg hooks
pre-commit install --hook-type commit-msg
```

## Caching and Performance

Pre-commit caches hook environments to speed up subsequent runs:

```bash
# View cache location
pre-commit --cache-dir
# Default: ~/.cache/pre-commit

# Clear cache if hooks misbehave
pre-commit clean

# Reinstall hook environments
pre-commit install-hooks
```

For large repositories, use `files` and `exclude` patterns:

```yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.1
    hooks:
      - id: gitleaks
        # Only scan source files, not generated code
        exclude: '^(vendor/|node_modules/|dist/)'
```

## Troubleshooting

### Hook Fails with No Output

Run in verbose mode:

```bash
pre-commit run --verbose
```

### Hook Environment Issues

Reinstall the hook environment:

```bash
pre-commit clean
pre-commit install-hooks
```

### Hook Runs Too Slowly

Check which files are being scanned:

```bash
pre-commit run --verbose --all-files 2>&1 | head -50
```

Add exclusions for large generated files or vendor directories.

