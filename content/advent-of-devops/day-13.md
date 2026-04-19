---
title: 'Day 13 - Security Scan'
day: 13
excerpt: 'Scan container images and infrastructure code for security vulnerabilities and misconfigurations.'
description: 'Learn container and infrastructure security scanning with Trivy, Checkov, and automated security checks in CI/CD pipelines.'
publishedAt: '2025-12-13T00:00:00Z'
updatedAt: '2026-04-19T00:00:00Z'
difficulty: 'Intermediate'
category: 'Security'
tags:
  - Security
  - Container Scanning
  - Infrastructure Security
  - DevSecOps
---

## Description

Your containers and infrastructure code might have security vulnerabilities hiding in dependencies, base images, or misconfigurations. Before these issues hit production, you need to scan and fix them.

## Task

Scan container images and infrastructure code for security issues.

**Requirements:**
- Scan Docker images for vulnerabilities
- Scan Terraform/Kubernetes configs for misconfigurations
- Integrate scanning into CI/CD pipeline
- Fix identified critical issues
- Generate security reports

## Target

- ✅ No critical vulnerabilities in images
- ✅ No high-severity misconfigurations
- ✅ Automated scanning in CI/CD
- ✅ Security report generated
- ✅ Remediation plan documented

## Sample App

### Vulnerable Dockerfile

```dockerfile
# Vulnerable Dockerfile
FROM node:14  # Old version with known vulnerabilities

WORKDIR /app

# Running as root (bad practice)
# No USER directive

COPY package*.json ./
RUN npm install  # May install vulnerable dependencies

COPY . .

EXPOSE 3000

# Sensitive info in environment (bad)
ENV API_KEY="super-secret-key-12345"
ENV DB_PASSWORD="password123"

CMD ["node", "server.js"]
```

### Vulnerable Terraform

```hcl
# vulnerable.tf
resource "aws_s3_bucket" "data" {
  bucket = "my-data-bucket"

  # No encryption!
  # No versioning!
  # No access logging!
}

resource "aws_security_group" "web" {
  name = "web-sg"

  ingress {
    from_port   = 0
    to_port     = 65535
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # Open to world!
  }
}

resource "aws_db_instance" "main" {
  engine         = "postgres"
  instance_class = "db.t3.micro"

  # Publicly accessible!
  publicly_accessible = true

  # No encryption
  storage_encrypted = false

  # Hardcoded password
  password = "password123"
}
```

## Solution

### 1. Install Security Scanning Tools

```bash
# Install Trivy (container & IaC scanner)
# macOS
brew install aquasecurity/trivy/trivy

# Linux
wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | sudo apt-key add -
echo "deb https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" | sudo tee /etc/apt/sources.list.d/trivy.list
sudo apt-get update
sudo apt-get install trivy

# Install Checkov (IaC scanner)
pip3 install checkov

# Install Snyk (optional)
npm install -g snyk
```

### 2. Scan Container Images

```bash
# Scan Docker image
trivy image node:14

# Scan with severity filter
trivy image --severity HIGH,CRITICAL node:14

# Scan and fail on critical
trivy image --exit-code 1 --severity CRITICAL node:14

# Scan your custom image
docker build -t my-app:latest .
trivy image my-app:latest

# Generate JSON report
trivy image --format json --output report.json my-app:latest

# Scan for specific vulnerability types
trivy image --vuln-type os,library my-app:latest

# Ignore unfixed vulnerabilities
trivy image --ignore-unfixed my-app:latest
```

### 3. Scan Infrastructure Code

```bash
# Scan Terraform with Trivy
trivy config ./terraform

# Scan with Checkov
checkov -d ./terraform

# Scan specific file
checkov -f terraform/main.tf

# Scan and fail on high severity
checkov -d ./terraform --check CRITICAL,HIGH

# Scan Kubernetes manifests
trivy config ./kubernetes

# Scan Dockerfile
trivy config Dockerfile

# Generate detailed report
checkov -d . --output json > security-report.json
```

### 4. Fixed Dockerfile

```dockerfile
# Secure Dockerfile
FROM node:20-alpine  # Latest stable, minimal image

WORKDIR /app

# Install security updates
RUN apk update && apk upgrade

# Copy package files first (better caching)
COPY package*.json ./

# Audit dependencies
RUN npm audit fix

# Install production dependencies only
RUN npm ci --only=production

# Copy application code
COPY --chown=node:node . .

# Remove unnecessary files
RUN rm -rf tests/ docs/ .git/

# Use non-root user
USER node

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js || exit 1

# Read-only root filesystem
# Configure in deployment: readOnlyRootFilesystem: true

CMD ["node", "server.js"]
```

### 5. Fixed Terraform

```hcl
# secure.tf
resource "aws_s3_bucket" "data" {
  bucket = "my-data-bucket"
}

# Enable versioning
resource "aws_s3_bucket_versioning" "data" {
  bucket = aws_s3_bucket.data.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Enable encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "data" {
  bucket = aws_s3_bucket.data.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Block public access
resource "aws_s3_bucket_public_access_block" "data" {
  bucket = aws_s3_bucket.data.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable logging
resource "aws_s3_bucket_logging" "data" {
  bucket = aws_s3_bucket.data.id

  target_bucket = aws_s3_bucket.logs.id
  target_prefix = "access-logs/"
}

# Secure security group
resource "aws_security_group" "web" {
  name        = "web-sg"
  description = "Security group for web servers"

  # Specific ports only
  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Egress restricted
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "web-security-group"
  }
}

# Secure RDS
resource "aws_db_instance" "main" {
  engine         = "postgres"
  engine_version = "15.3"
  instance_class = "db.t3.micro"

  # Not publicly accessible
  publicly_accessible = false

  # Enable encryption
  storage_encrypted = true
  kms_key_id       = aws_kms_key.rds.arn

  # Use secrets manager for password
  master_password = data.aws_secretsmanager_secret_version.db_password.secret_string

  # Enable backup
  backup_retention_period = 7

  # Enable auto minor version upgrade
  auto_minor_version_upgrade = true

  # Enable enhanced monitoring
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  # Enable deletion protection
  deletion_protection = true

  tags = {
    Name = "main-database"
  }
}
```

### 6. CI/CD Integration

#### GitHub Actions Workflow

```yaml
# .github/workflows/security-scan.yml
name: Security Scan

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
  schedule:
    - cron: '0 0 * * 0'  # Weekly scan

jobs:
  trivy-image-scan:
    name: Trivy Image Scan
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Build image
        run: docker build -t ${{ github.repository }}:${{ github.sha }} .

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ github.repository }}:${{ github.sha }}
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'CRITICAL,HIGH'

      - name: Upload Trivy results to GitHub Security
        uses: github/codeql-action/upload-sarif@v2
        if: always()
        with:
          sarif_file: 'trivy-results.sarif'

      - name: Fail on critical vulnerabilities
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ github.repository }}:${{ github.sha }}
          exit-code: '1'
          severity: 'CRITICAL'

  trivy-config-scan:
    name: Trivy Config Scan
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run Trivy config scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'config'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-config.sarif'

      - name: Upload results
        uses: github/codeql-action/upload-sarif@v2
        if: always()
        with:
          sarif_file: 'trivy-config.sarif'

  checkov-scan:
    name: Checkov IaC Scan
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run Checkov
        uses: bridgecrewio/checkov-action@master
        with:
          directory: .
          framework: terraform,kubernetes,dockerfile
          output_format: cli,sarif
          output_file_path: console,checkov-results.sarif
          soft_fail: false

      - name: Upload results
        uses: github/codeql-action/upload-sarif@v2
        if: always()
        with:
          sarif_file: checkov-results.sarif

  dependency-scan:
    name: Dependency Scan
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Run npm audit
        run: npm audit --audit-level=high

      - name: Check for outdated packages
        run: npm outdated || true
```

### 7. Security Scanning Script

```bash
#!/bin/bash
# security-scan.sh

set -e

echo "=== Security Scanning ==="
echo

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

IMAGE_NAME="${1:-my-app:latest}"
REPORT_DIR="security-reports"

mkdir -p "$REPORT_DIR"

echo "Scanning Docker image: $IMAGE_NAME"
echo

# 1. Scan Docker image with Trivy
echo -e "${YELLOW}[1/4] Scanning Docker image for vulnerabilities...${NC}"
trivy image \
  --severity HIGH,CRITICAL \
  --format json \
  --output "$REPORT_DIR/image-vulnerabilities.json" \
  "$IMAGE_NAME"

CRITICAL_VULNS=$(jq '[.Results[].Vulnerabilities[]? | select(.Severity == "CRITICAL")] | length' "$REPORT_DIR/image-vulnerabilities.json")
HIGH_VULNS=$(jq '[.Results[].Vulnerabilities[]? | select(.Severity == "HIGH")] | length' "$REPORT_DIR/image-vulnerabilities.json")

echo -e "Found: ${RED}$CRITICAL_VULNS CRITICAL${NC}, ${YELLOW}$HIGH_VULNS HIGH${NC} vulnerabilities"
echo

# 2. Scan Dockerfile
echo -e "${YELLOW}[2/4] Scanning Dockerfile...${NC}"
trivy config Dockerfile --format json --output "$REPORT_DIR/dockerfile-scan.json"
echo "✓ Dockerfile scan complete"
echo

# 3. Scan Terraform
if [ -d "terraform" ]; then
  echo -e "${YELLOW}[3/4] Scanning Terraform code...${NC}"
  checkov -d terraform \
    --output json \
    --output-file "$REPORT_DIR/terraform-scan.json" \
    --quiet || true
  echo "✓ Terraform scan complete"
  echo
fi

# 4. Scan Kubernetes manifests
if [ -d "kubernetes" ]; then
  echo -e "${YELLOW}[4/4] Scanning Kubernetes manifests...${NC}"
  trivy config kubernetes \
    --format json \
    --output "$REPORT_DIR/k8s-scan.json"
  echo "✓ Kubernetes scan complete"
  echo
fi

# Generate summary
echo "=== Scan Summary ==="
echo "Reports saved to: $REPORT_DIR/"
echo

# Exit with error if critical vulnerabilities found
if [ "$CRITICAL_VULNS" -gt 0 ]; then
  echo -e "${RED}FAILED: Critical vulnerabilities found!${NC}"
  exit 1
else
  echo -e "${GREEN}PASSED: No critical vulnerabilities found${NC}"
fi
```

## Explanation

### Security Scanning Tools

#### 1. Trivy

**What:** Comprehensive vulnerability scanner

**Scans:**
- Container images
- Filesystem
- Git repositories
- Kubernetes configs
- Terraform/CloudFormation

**Usage:**
```bash
trivy image nginx:latest
trivy fs .
trivy config .
```

#### 2. Checkov

**What:** Static code analysis for IaC

**Scans:**
- Terraform
- CloudFormation
- Kubernetes
- Helm
- Dockerfiles

**Usage:**
```bash
checkov -d ./terraform
checkov -f Dockerfile
```

#### 3. Snyk

**What:** Developer-first security platform

**Scans:**
- Dependencies
- Container images
- IaC

**Usage:**
```bash
snyk test
snyk container test my-app:latest
snyk iac test
```

### Common Vulnerabilities

| Category | Examples | Fix |
|----------|----------|-----|
| **Base Image** | Old OS packages | Use latest stable image |
| **Dependencies** | Vulnerable npm packages | Run `npm audit fix` |
| **Secrets** | Hardcoded passwords | Use secrets management |
| **Configuration** | Open ports, root user | Follow security best practices |
| **Permissions** | World-readable files | Proper file permissions |

## Result

### Run Security Scans

```bash
# Build image
docker build -t my-app:latest .

# Run comprehensive scan
chmod +x security-scan.sh
./security-scan.sh my-app:latest

# Output:
# === Security Scanning ===
#
# Scanning Docker image: my-app:latest
#
# [1/4] Scanning Docker image for vulnerabilities...
# Found: 3 CRITICAL, 12 HIGH vulnerabilities
#
# [2/4] Scanning Dockerfile...
# ✓ Dockerfile scan complete
#
# [3/4] Scanning Terraform code...
# ✓ Terraform scan complete
#
# [4/4] Scanning Kubernetes manifests...
# ✓ Kubernetes scan complete
#
# === Scan Summary ===
# Reports saved to: security-reports/
```

### View Detailed Results

```bash
# View image vulnerabilities
trivy image my-app:latest

# View specific vulnerability
trivy image --severity CRITICAL my-app:latest | grep CVE-2023-

# Check specific package
trivy image my-app:latest | grep openssl
```

## Validation

### Security Checklist

```bash
# 1. No critical vulnerabilities
trivy image --exit-code 1 --severity CRITICAL my-app:latest
# Should exit 0

# 2. Dockerfile follows best practices
trivy config Dockerfile --severity HIGH,CRITICAL --exit-code 1
# Should exit 0

# 3. Infrastructure is secure
checkov -d ./terraform --check CRITICAL,HIGH
# Should show all passed

# 4. No hardcoded secrets
grep -r "password\|api.key\|secret" --exclude-dir=.git .
# Should be empty or only test values

# 5. Running as non-root
docker inspect my-app:latest | jq '.[0].Config.User'
# Should not be empty or "root"

# 6. Dependencies up to date
npm audit
# Should show 0 vulnerabilities
```

## Best Practices

### ✅ Do's

1. **Scan early**: Include in CI/CD pipeline
2. **Fail builds**: On critical vulnerabilities
3. **Regular scans**: Schedule periodic scans
4. **Update dependencies**: Keep packages current
5. **Use minimal base images**: Alpine when possible
6. **Run as non-root**: Never run containers as root
7. **Scan IaC**: Catch misconfigurations before deployment

### ❌ Don'ts

1. **Don't ignore warnings**: They can become critical
2. **Don't hardcode secrets**: Use secret management
3. **Don't use :latest**: Pin versions
4. **Don't expose everything**: Minimize attack surface
5. **Don't skip updates**: Old = vulnerable

## Links

- [Trivy Documentation](https://aquasecurity.github.io/trivy/)
- [Checkov Documentation](https://www.checkov.io/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Docker Security Best Practices](https://docs.docker.com/develop/security-best-practices/)
- [CIS Benchmarks](https://www.cisecurity.org/cis-benchmarks/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

## Share Your Success

Secured your containers? Share your wins!

**Tag [@thedevopsdaily](https://x.com/thedevopsdaily)** on X with:
- Number of vulnerabilities fixed
- Security improvements made
- Tools you found most useful
- Before/after scan results

Use hashtags: **#AdventOfDevOps #Security #DevSecOps #Day13**
