---
title: "Compliance Gates"
description: "Enforce regulatory requirements and security standards in CI/CD pipelines"
---

# Compliance Gates

Compliance gates ensure infrastructure and applications meet regulatory requirements (PCI-DSS, SOC 2, HIPAA, CIS Benchmarks) before deployment.

## Overview

Regulatory compliance is mandatory for industries like:

- **Finance**: PCI-DSS (payment card data), SOX (financial reporting)
- **Healthcare**: HIPAA (patient data), HITRUST
- **Government**: FedRAMP, NIST SP 800-53
- **General**: SOC 2 (security controls), ISO 27001

### Real-World Impact

**Target Breach (2013)**
- Attackers entered via HVAC contractor credentials
- Failed to segment network per PCI-DSS requirements
- 40 million credit cards compromised
- **Cost**: $18.5 million fine + $202 million in settlements
- **Prevention**: Network segmentation compliance gates would have blocked deployment

**Capital One Breach (2019)**
- Misconfigured AWS WAF allowed SSRF attack
- Failed CIS AWS Foundations Benchmark controls
- 100 million customer records stolen
- **Cost**: $80 million OCC fine + $190 million class action
- **Prevention**: IaC compliance scanning would have detected misconfigured firewall rules

## Compliance Frameworks

### CIS Benchmarks

Industry-consensus security standards for:

- **Operating Systems**: Linux, Windows, macOS
- **Cloud**: AWS, Azure, GCP, Kubernetes
- **Databases**: MySQL, PostgreSQL, MongoDB
- **Applications**: Docker, NGINX, Apache

**Levels:**
- **Level 1**: Basic security (production-ready)
- **Level 2**: Defense-in-depth (high-security environments)

### PCI-DSS 4.0

Payment Card Industry Data Security Standard:

- **Requirement 1-2**: Network segmentation and firewall configuration
- **Requirement 3-4**: Data encryption at rest and in transit
- **Requirement 6**: Secure application development
- **Requirement 8**: Strong authentication (MFA)
- **Requirement 10**: Logging and monitoring

### SOC 2

AICPA Trust Services Criteria:

- **Security**: Protection against unauthorized access
- **Availability**: System uptime and reliability
- **Processing Integrity**: Complete, valid, timely processing
- **Confidentiality**: Data protection beyond security
- **Privacy**: PII collection, use, retention, disclosure

## Checkov for IaC Compliance

### Installation

```bash
# Install with pip
pip install checkov

# Or use Docker
docker pull bridgecrew/checkov
```

### Basic Usage

```bash
# Scan Terraform
checkov -d /path/to/terraform --framework terraform

# Scan Kubernetes YAML
checkov -f k8s-deployment.yaml --framework kubernetes

# Scan Dockerfile
checkov -f Dockerfile --framework dockerfile

# Fail on high severity only
checkov -d . --check HIGH,CRITICAL --compact --quiet
```

### Compliance-Specific Scans

```bash
# CIS AWS Foundations Benchmark
checkov -d . --framework terraform --check CKV_AWS_*

# PCI-DSS compliance
checkov -d . --compact --check POLICY_COMPLIANCE_PCI

# HIPAA compliance
checkov -d . --compact --check POLICY_COMPLIANCE_HIPAA

# SOC 2 controls
checkov -d . --compact --check POLICY_COMPLIANCE_SOC2
```

### Example Terraform Violations

```hcl
# FAIL: CKV_AWS_18 - S3 bucket without access logging
resource "aws_s3_bucket" "data" {
  bucket = "company-data"
  # Missing: logging configuration
}

# PASS: Fixed with logging
resource "aws_s3_bucket" "data" {
  bucket = "company-data"
}

resource "aws_s3_bucket_logging" "data" {
  bucket = aws_s3_bucket.data.id
  target_bucket = aws_s3_bucket.logs.id
  target_prefix = "s3-access-logs/"
}
```

```hcl
# FAIL: CKV_AWS_19 - S3 bucket encryption disabled
resource "aws_s3_bucket" "data" {
  bucket = "company-data"
}

# PASS: Fixed with encryption
resource "aws_s3_bucket" "data" {
  bucket = "company-data"
}

resource "aws_s3_bucket_server_side_encryption_configuration" "data" {
  bucket = aws_s3_bucket.data.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}
```

## GitHub Actions Example

```yaml
name: Compliance Gate

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  compliance-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Checkov for Terraform
        uses: bridgecrewio/checkov-action@master
        with:
          directory: terraform/
          framework: terraform
          output_format: sarif
          output_file_path: reports/checkov.sarif
          soft_fail: false  # Fail build on violations
          check: HIGH,CRITICAL
      
      - name: Upload results to GitHub Security
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: reports/checkov.sarif
      
      - name: Run Checkov for Kubernetes
        run: |
          pip install checkov
          checkov -d k8s/ --framework kubernetes --compact --quiet
```

## GitLab CI Example

```yaml
compliance-gate:
  stage: security
  image: bridgecrew/checkov:latest
  script:
    - checkov -d terraform/ --framework terraform --compact --output-file-path console,results.json
    - checkov -d k8s/ --framework kubernetes --compact
  artifacts:
    reports:
      sast: results.json
    paths:
      - results.json
  only:
    - merge_requests
    - main
```

## Docker Bench Security

CIS Docker Benchmark automated checker:

```bash
# Clone Docker Bench Security
git clone https://github.com/docker/docker-bench-security.git
cd docker-bench-security

# Run checks
sudo sh docker-bench-security.sh

# Run specific checks
sudo sh docker-bench-security.sh -c container_images

# Export results
sudo sh docker-bench-security.sh -l /tmp/docker-bench.log
```

### CI/CD Integration

```yaml
name: Docker CIS Benchmark

on: [push, pull_request]

jobs:
  docker-bench:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Build Docker image
        run: docker build -t myapp:test .
      
      - name: Run Docker Bench Security
        run: |
          docker run --rm \
            --net host \
            --pid host \
            --userns host \
            --cap-add audit_control \
            -v /var/lib:/var/lib \
            -v /var/run/docker.sock:/var/run/docker.sock \
            -v /etc:/etc \
            docker/docker-bench-security
```

## CIS Kubernetes Benchmark

### kube-bench

```bash
# Install kube-bench
curl -L https://github.com/aquasecurity/kube-bench/releases/download/v0.7.0/kube-bench_0.7.0_linux_amd64.tar.gz -o kube-bench.tar.gz
tar -xvf kube-bench.tar.gz

# Run as job in cluster
kubectl apply -f https://raw.githubusercontent.com/aquasecurity/kube-bench/main/job.yaml

# View results
kubectl logs -f job/kube-bench

# Run specific version
kube-bench run --benchmark cis-1.8
```

### Example Kubernetes Violations

```yaml
# FAIL: Pod running as root
apiVersion: v1
kind: Pod
metadata:
  name: insecure-pod
spec:
  containers:
  - name: app
    image: nginx
    # Missing: securityContext with runAsNonRoot

# PASS: Fixed with security context
apiVersion: v1
kind: Pod
metadata:
  name: secure-pod
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    fsGroup: 2000
  containers:
  - name: app
    image: nginx
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop:
        - ALL
```

## Custom Compliance Policies

### OPA Policy for PCI-DSS Network Segmentation

```rego
# pci-dss-network.rego
package terraform.pci_dss

import rego.v1

# PCI-DSS Requirement 1.3: Prohibit direct public access to cardholder data
deny contains msg if {
    resource := input.resource.aws_security_group[_]
    rule := resource.ingress[_]
    
    # Check if allows 0.0.0.0/0 access
    rule.cidr_blocks[_] == "0.0.0.0/0"
    
    # Check if accessing sensitive ports (database)
    rule.from_port <= 3306
    rule.to_port >= 3306
    
    msg := sprintf("Security group '%s' allows public access to MySQL port 3306 (PCI-DSS 1.3 violation)", [resource.name])
}

# PCI-DSS Requirement 8.3: Implement MFA for remote access
deny contains msg if {
    resource := input.resource.aws_iam_user[_]
    not resource.force_destroy
    not has_mfa_device(resource.name)
    
    msg := sprintf("IAM user '%s' does not have MFA enabled (PCI-DSS 8.3 violation)", [resource.name])
}

has_mfa_device(user_name) if {
    input.resource.aws_iam_user_mfa_device[_].user == user_name
}
```

Use with Checkov:

```bash
checkov -d terraform/ --external-checks-dir ./policies/
```

## Compliance Reporting

### Generate Compliance Report

```bash
#!/bin/bash
# compliance-report.sh

set -e

REPORT_DIR="reports/$(date +%Y-%m-%d)"
mkdir -p "$REPORT_DIR"

echo "Running compliance scans..."

# Terraform compliance
echo "[1/4] Scanning Terraform..."
checkov -d terraform/ --framework terraform \
  --output json > "$REPORT_DIR/terraform-compliance.json"

# Kubernetes compliance
echo "[2/4] Scanning Kubernetes..."
checkov -d k8s/ --framework kubernetes \
  --output json > "$REPORT_DIR/k8s-compliance.json"

# Docker compliance
echo "[3/4] Scanning Dockerfiles..."
checkov -f Dockerfile --framework dockerfile \
  --output json > "$REPORT_DIR/docker-compliance.json"

# Generate summary
echo "[4/4] Generating summary..."
python3 << EOF
import json
import os

report_dir = "$REPORT_DIR"
frameworks = ['terraform', 'k8s', 'docker']

print("\\n=== Compliance Summary ===")
for fw in frameworks:
    with open(f"{report_dir}/{fw}-compliance.json") as f:
        data = json.load(f)
        summary = data.get('summary', {})
        passed = summary.get('passed', 0)
        failed = summary.get('failed', 0)
        print(f"{fw.upper()}: {passed} passed, {failed} failed")
EOF

echo "\nReports saved to: $REPORT_DIR"
```

### Upload to Compliance Dashboard

```bash
#!/bin/bash
# upload-compliance.sh

REPORT_FILE="$1"
COMPLIANCE_API="https://compliance.company.com/api/reports"

curl -X POST "$COMPLIANCE_API" \
  -H "Authorization: Bearer $COMPLIANCE_TOKEN" \
  -H "Content-Type: application/json" \
  --data @"$REPORT_FILE"
```

## Exception Management

### Temporary Exception with Expiry

```yaml
# .checkov.yaml
soft-fail: true  # Don't fail build, just report

skip-check:
  - CKV_AWS_18  # S3 access logging
    # Reason: Legacy bucket, migration scheduled
    # Approved by: security-team@company.com
    # Expires: 2025-06-01
    # Jira: SEC-1234
```

### Automated Exception Expiry Check

```python
#!/usr/bin/env python3
# check-exceptions.py

import yaml
from datetime import datetime

with open('.checkov.yaml') as f:
    config = yaml.safe_load(f)

skipped_checks = config.get('skip-check', [])
expired = []

for check in skipped_checks:
    if isinstance(check, dict) and 'expires' in check:
        expires = datetime.strptime(check['expires'], '%Y-%m-%d')
        if expires < datetime.now():
            expired.append(check)

if expired:
    print("ERROR: Expired compliance exceptions found:")
    for check in expired:
        print(f"  - {check}")
    exit(1)

print("All compliance exceptions are valid.")
```

## Best Practices

### 1. Shift Left Compliance

```
Development → PR → Build → Deploy
     ↓         ↓      ↓       ↓
  IDE check  Gate   Gate   Audit
```

- **IDE**: Pre-commit hooks with Checkov
- **PR**: Automated scans in CI
- **Build**: Block on critical violations
- **Deploy**: Runtime compliance monitoring

### 2. Progressive Rollout

```yaml
# Week 1-2: Report-only mode
checkov -d . --soft-fail

# Week 3-4: Block critical only
checkov -d . --check HIGH,CRITICAL

# Week 5+: Full enforcement
checkov -d . --compact
```

### 3. Regular Audits

```yaml
# cronjob-compliance-audit.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: compliance-audit
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: checkov
            image: bridgecrew/checkov:latest
            command:
            - sh
            - -c
            - |
              checkov -d /workspace --framework terraform --output json > /reports/$(date +%Y-%m-%d).json
              # Upload to central compliance dashboard
              curl -X POST "$COMPLIANCE_API/upload" -H "Authorization: Bearer $TOKEN" --data @/reports/$(date +%Y-%m-%d).json
          restartPolicy: OnFailure
```

### 4. Compliance as Code Repository

```
compliance/
├── policies/
│   ├── pci-dss.rego
│   ├── soc2.rego
│   └── hipaa.rego
├── exceptions/
│   ├── exceptions.yaml
│   └── README.md
├── reports/
│   └── .gitkeep
└── scripts/
    ├── check-exceptions.py
    ├── generate-report.sh
    └── upload-compliance.sh
```

## Metrics to Track

- **Compliance Score**: Percentage of checks passing
- **Time to Remediate**: Average time from violation detection to fix
- **Exception Rate**: Percentage of checks with approved exceptions
- **Audit Frequency**: How often compliance scans run

## Troubleshooting

### "Too Many False Positives"

**Problem**: Checkov flags non-applicable resources.

**Solution**: Use skip annotations in IaC:

```hcl
# Skip specific check for this resource
resource "aws_s3_bucket" "public_assets" {
  #checkov:skip=CKV_AWS_18:Public assets bucket doesn't need logging
  bucket = "public-assets"
}
```

### "Compliance Scan Takes Too Long"

**Problem**: Checkov scans block CI pipeline.

**Solution**: Scan changed files only:

```bash
# Get changed files
CHANGED_FILES=$(git diff --name-only origin/main)

# Scan only changed .tf files
for file in $CHANGED_FILES; do
  if [[ $file == *.tf ]]; then
    checkov -f "$file"
  fi
done
```

### "Conflicting Compliance Requirements"

**Problem**: PCI-DSS and SOC 2 have different encryption requirements.

**Solution**: Use framework-specific policies:

```bash
# PCI-DSS environment
checkov -d . --framework terraform --check POLICY_COMPLIANCE_PCI

# SOC 2 environment
checkov -d . --framework terraform --check POLICY_COMPLIANCE_SOC2
```

## Next Steps

- [CI/CD Integration](/guides/security-gates/04-cicd-integration) - Complete pipeline examples
- [Policy as Code](/guides/security-gates/01-policy-as-code) - OPA and Kyverno policies
- [Vulnerability Gates](/guides/security-gates/02-vulnerability-gates) - CVE scanning
