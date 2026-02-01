---
title: 'Native Package Manager Tools'
description: 'Use built-in security scanning with npm audit, pip-audit, bundler-audit, and other language-specific vulnerability scanners.'
---

Every major package manager includes built-in security scanning. These native tools are free, require no setup, and integrate seamlessly with your existing workflow. While they lack some advanced features of dedicated tools like Snyk, they provide a solid baseline for dependency security.

## npm audit (JavaScript/Node.js)

npm's built-in security scanner checks your `package-lock.json` against the GitHub Advisory Database.

### Basic Usage

```bash
# Run audit
npm audit

# Output example:
# found 5 vulnerabilities (2 moderate, 2 high, 1 critical)
```

### Detailed Output

```bash
# Show full details
npm audit

# Example output:
# lodash  <4.17.21
# Severity: critical
# Prototype Pollution - https://github.com/advisories/GHSA-jf85-cpcp-j695
# fix available via `npm audit fix`
# node_modules/lodash
#   request > hawk > lodash
```

### Automatic Fixes

```bash
# Fix vulnerabilities automatically (safe updates only)
npm audit fix

# Force fixes (may include breaking changes)
npm audit fix --force

# Preview what would change
npm audit fix --dry-run
```

**Warning**: `--force` can introduce breaking changes by updating to major versions. Always test after running.

### Output Formats

```bash
# JSON for CI/CD processing
npm audit --json > audit-results.json

# Only production dependencies
npm audit --omit=dev

# Filter by severity
npm audit --audit-level=high  # Only show high and critical
```

### CI/CD Integration

```yaml
# GitHub Actions
- name: Security audit
  run: npm audit --audit-level=high
  # Exit code is non-zero if vulnerabilities found
```

### Limitations

- No automatic PR creation
- Cannot ignore specific vulnerabilities (use `.npmrc` workarounds)
- Only scans npm packages (not other ecosystems)

## Yarn Audit

Yarn 1.x and 2+ have built-in auditing:

```bash
# Yarn 1.x (Classic)
yarn audit

# Yarn 2+ (Berry)
yarn npm audit

# Filter by severity
yarn audit --level high

# JSON output
yarn audit --json
```

### Yarn Berry (2+) specifics

```bash
# Audit all workspaces in monorepo
yarn npm audit --all

# Recursive audit
yarn npm audit --recursive
```

## pnpm audit

pnpm includes similar auditing capabilities:

```bash
# Basic audit
pnpm audit

# Production only
pnpm audit --prod

# Fix vulnerabilities
pnpm audit --fix

# JSON output
pnpm audit --json
```

## pip-audit (Python)

pip-audit is a tool from the Python Packaging Authority (PyPA) for scanning Python dependencies.

### Installation

```bash
pip install pip-audit
```

### Basic Usage

```bash
# Scan installed packages
pip-audit

# Scan a requirements file
pip-audit -r requirements.txt

# Scan a project with pyproject.toml
pip-audit .
```

### Output Example

```
Found 2 known vulnerabilities in 2 packages
Name    Version  ID                   Fix Versions
------- -------- -------------------- ------------
django  3.2.5    PYSEC-2021-103       3.2.6
urllib3 1.26.4   GHSA-5phf-pp7p-xycp  1.26.5
```

### Output Formats

```bash
# JSON output
pip-audit --format json -o audit.json

# CycloneDX SBOM format
pip-audit --format cyclonedx-json -o sbom.json

# Markdown (for PRs/issues)
pip-audit --format markdown
```

### Fixing Vulnerabilities

```bash
# Auto-fix (updates requirements.txt)
pip-audit --fix

# Dry run
pip-audit --fix --dry-run
```

### CI/CD Integration

```yaml
# GitHub Actions
- name: Install pip-audit
  run: pip install pip-audit

- name: Run pip-audit
  run: pip-audit -r requirements.txt --strict
  # --strict fails on any vulnerability
```

### Using with Virtual Environments

```bash
# Audit packages in a specific virtual environment
pip-audit --path /path/to/venv

# Audit with Poetry
poetry export -f requirements.txt | pip-audit -r /dev/stdin

# Audit with Pipenv
pipenv requirements | pip-audit -r /dev/stdin
```

## Safety (Python Alternative)

Safety is another popular Python vulnerability scanner:

```bash
# Install
pip install safety

# Scan installed packages
safety check

# Scan requirements file
safety check -r requirements.txt

# JSON output
safety check --json
```

**Note**: Safety's free database is updated less frequently than pip-audit's OSV database. Consider pip-audit for most use cases.

## bundler-audit (Ruby)

bundler-audit scans Ruby Gemfiles for vulnerable gems.

### Installation

```bash
gem install bundler-audit
```

### Basic Usage

```bash
# Update vulnerability database first
bundle-audit update

# Run audit
bundle-audit check

# Or combined
bundle-audit check --update
```

### Output Example

```
Name: actionpack
Version: 6.0.3
CVE: CVE-2021-22885
Criticality: High
URL: https://nvd.nist.gov/vuln/detail/CVE-2021-22885
Title: Possible Information Disclosure in Action Pack
Solution: upgrade to ~> 5.2.4.6, >= 5.2.6, ~> 6.0.3.7, >= 6.1.3.2

Vulnerabilities found!
```

### CI/CD Integration

```yaml
# GitHub Actions
- name: Run bundler-audit
  run: |
    gem install bundler-audit
    bundle-audit check --update
```

### Ignoring Vulnerabilities

```bash
# Ignore specific CVEs
bundle-audit check --ignore CVE-2021-22885

# Or use .bundler-audit.yml
echo "ignore:
  - CVE-2021-22885" > .bundler-audit.yml
bundle-audit check
```

## cargo-audit (Rust)

cargo-audit scans Rust dependencies using the RustSec Advisory Database.

### Installation

```bash
cargo install cargo-audit
```

### Basic Usage

```bash
# Run audit
cargo audit

# JSON output
cargo audit --json

# Fix vulnerabilities (updates Cargo.toml)
cargo audit fix

# Dry run
cargo audit fix --dry-run
```

### Output Example

```
    Fetching advisory database from `https://github.com/RustSec/advisory-db`
      Loaded 650 security advisories (from rustsec.org)
    Scanning Cargo.lock for vulnerabilities (320 crate dependencies)

Crate:     regex
Version:   1.5.4
Title:     Regex denial of service
Date:      2022-03-08
ID:        RUSTSEC-2022-0013
URL:       https://rustsec.org/advisories/RUSTSEC-2022-0013
Solution:  Upgrade to >=1.5.5

error: 1 vulnerability found!
```

### CI/CD Integration

```yaml
# GitHub Actions
- name: Install cargo-audit
  run: cargo install cargo-audit

- name: Run audit
  run: cargo audit
```

## govulncheck (Go)

govulncheck is the official Go vulnerability scanner, developed by the Go team.

### Installation

```bash
go install golang.org/x/vuln/cmd/govulncheck@latest
```

### Basic Usage

```bash
# Scan current module
govulncheck ./...

# Scan a specific package
govulncheck ./cmd/myapp

# JSON output
govulncheck -json ./...
```

### Output Example

```
Scanning your code and 234 packages across 45 modules for known vulnerabilities...

Vulnerability #1: GO-2023-1571
  Due to a flaw in net/http, a malicious HTTP/2 server can...
  More info: https://pkg.go.dev/vuln/GO-2023-1571
  Module: golang.org/x/net
    Found in: golang.org/x/net@v0.0.0-20220722155237-a158d28d115b
    Fixed in: golang.org/x/net@v0.7.0
    Call stacks in your code:
      main.go:15:2: myapp.main calls http.ListenAndServe
```

**Key feature**: govulncheck analyzes your actual code to determine if vulnerable functions are called, reducing false positives.

### CI/CD Integration

```yaml
# GitHub Actions
- name: Install govulncheck
  run: go install golang.org/x/vuln/cmd/govulncheck@latest

- name: Run govulncheck
  run: govulncheck ./...
```

## Comparison Table

| Tool | Ecosystem | Auto-Fix | Database | Reachability Analysis |
|------|-----------|----------|----------|----------------------|
| npm audit | JavaScript | Yes | GitHub Advisory | No |
| yarn audit | JavaScript | No | GitHub Advisory | No |
| pnpm audit | JavaScript | Yes | GitHub Advisory | No |
| pip-audit | Python | Yes | OSV, PyPI | No |
| safety | Python | No | Safety DB | No |
| bundler-audit | Ruby | No | Ruby Advisory | No |
| cargo-audit | Rust | Yes | RustSec | No |
| govulncheck | Go | No | Go Vuln DB | **Yes** |

## Multi-Language Projects

For projects with multiple ecosystems, consider:

### Trivy (Universal Scanner)

```bash
# Install
brew install trivy  # or docker, apt, etc.

# Scan filesystem (detects package managers automatically)
trivy fs .

# Scan specific types
trivy fs --scanners vuln .

# JSON output
trivy fs --format json -o results.json .
```

Trivy supports: npm, pip, Bundler, Cargo, Go, Maven, Gradle, Composer, and more.

### OSV-Scanner (Google)

```bash
# Install
go install github.com/google/osv-scanner/cmd/osv-scanner@latest

# Scan directory
osv-scanner -r /path/to/project

# Scan lockfiles
osv-scanner --lockfile=package-lock.json --lockfile=requirements.txt
```

## Key Takeaways

1. **Start with native tools**—they're free, require no setup, and cover basics
2. **npm audit + pip-audit + bundler-audit** cover most web projects
3. **govulncheck is special**—it's the only one with reachability analysis
4. **Use Trivy or OSV-Scanner** for multi-language projects
5. **Always update databases first**—`bundle-audit update`, etc.
