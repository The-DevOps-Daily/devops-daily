---
title: 'Day 7 - Improve the Terraform Module'
day: 7
excerpt: 'Enhance your Terraform module with advanced features like testing, documentation, and CI/CD integration.'
description: 'Level up your Terraform module with comprehensive documentation, automated testing, and publishing to the Terraform Registry.'
publishedAt: '2025-12-07T00:00:00Z'
updatedAt: '2026-04-19T00:00:00Z'
difficulty: 'Advanced'
category: 'Infrastructure as Code'
tags:
  - Terraform
  - Testing
  - Documentation
  - CI/CD
---

## Description

Your S3 module from Day 6 works, but it lacks comprehensive documentation, automated testing, and CI/CD integration. To make it production-ready and shareable, you need to add these professional touches.

## Task

Enhance your Terraform module with documentation, testing, and automation.

**Requirements:**
- Comprehensive README with examples
- Automated validation in CI/CD
- Input/output documentation
- Multiple usage examples
- Pre-commit hooks

## Target

- ✅ Complete README.md with all module details
- ✅ CI/CD pipeline validates module
- ✅ Pre-commit hooks enforce standards
- ✅ Multiple example configurations
- ✅ Auto-generated documentation

## Sample App

### Enhanced Directory Structure

```
terraform-aws-s3-bucket/
├── .github/
│   └── workflows/
│       ├── validate.yml
│       └── release.yml
├── .pre-commit-config.yaml
├── examples/
│   ├── basic/
│   ├── with-lifecycle/
│   ├── encrypted/
│   └── complete/
├── test/
│   └── module_test.go
├── main.tf
├── variables.tf
├── outputs.tf
├── versions.tf
├── README.md
├── CHANGELOG.md
└── .terraform-docs.yml
```

## Solution

### Enhanced Documentation

#### README.md

```markdown
# AWS S3 Bucket Terraform Module

Production-ready Terraform module for creating AWS S3 buckets with security best practices.

## Features

- 🔒 **Security First**: Public access blocked by default
- 🔄 **Versioning**: Optional versioning support
- 🔐 **Encryption**: AES256 or KMS encryption
- 📋 **Lifecycle Rules**: Automated object management
- 🏷️ **Tagging**: Consistent resource tagging
- ✅ **Validated**: Automated testing and validation

## Usage

### Basic Example

```hcl
module "bucket" {
  source = "git::https://github.com/yourorg/terraform-aws-s3-bucket.git?ref=v1.0.0"

  bucket_name = "my-application-data"
  environment = "production"

  tags = {
    Project = "MyApp"
  }
}
```

### With Lifecycle Rules

```hcl
module "bucket_with_lifecycle" {
  source = "git::https://github.com/yourorg/terraform-aws-s3-bucket.git?ref=v1.0.0"

  bucket_name = "my-app-logs"
  environment = "production"

  lifecycle_rules = [
    {
      id              = "archive-logs"
      enabled         = true
      transition_days = 30
      storage_class   = "GLACIER"
      expiration_days = 365
    }
  ]
}
```

## Requirements

| Name | Version |
|------|---------|
| terraform | >= 1.5 |
| aws | ~> 5.0 |

## Providers

| Name | Version |
|------|---------|
| aws | ~> 5.0 |

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| bucket_name | Name of the S3 bucket | `string` | n/a | yes |
| environment | Environment name | `string` | `"dev"` | no |
| versioning_enabled | Enable versioning | `bool` | `true` | no |
| block_public_access | Block all public access | `bool` | `true` | no |
| kms_key_id | KMS key for encryption | `string` | `null` | no |
| lifecycle_rules | Lifecycle management rules | `list(object)` | `null` | no |
| tags | Additional resource tags | `map(string)` | `{}` | no |

## Outputs

| Name | Description |
|------|-------------|
| bucket_id | The name of the bucket |
| bucket_arn | The ARN of the bucket |
| bucket_domain_name | The domain name of the bucket |
| bucket_regional_domain_name | The regional domain name |
| bucket_region | The AWS region |

## Examples

- **Basic** - Simple bucket creation
- **With Lifecycle** - Lifecycle rules
- **Encrypted** - KMS encryption
- **Complete** - All features

## Development

### Prerequisites

```bash
# Install pre-commit
pip install pre-commit
pre-commit install

# Install terraform-docs
brew install terraform-docs

# Install tflint
brew install tflint
```

### Testing

```bash
# Validate
terraform validate

# Format
terraform fmt -recursive

# Lint
tflint --init
tflint

# Run tests
cd test && go test -v
```

## Contributing

See `CONTRIBUTING.md` in the repo for the contribution guidelines.

## License

MIT Licensed. See the `LICENSE` file in the repo.
```

### CI/CD Pipeline

#### .github/workflows/validate.yml

```yaml
name: Validate

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  validate:
    name: Terraform Validate
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: 1.6.0

      - name: Terraform Format Check
        run: terraform fmt -check -recursive

      - name: Terraform Init
        run: terraform init -backend=false

      - name: Terraform Validate
        run: terraform validate

  lint:
    name: TFLint
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - uses: terraform-linters/setup-tflint@v4
        with:
          tflint_version: latest

      - name: Init TFLint
        run: tflint --init

      - name: Run TFLint
        run: tflint --format compact

  security:
    name: Security Scan
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Run Checkov
        uses: bridgecrewio/checkov-action@master
        with:
          directory: .
          framework: terraform
          quiet: false
          soft_fail: true

  docs:
    name: Documentation
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.ref }}

      - name: Generate Terraform docs
        uses: terraform-docs/gh-actions@v1.0.0
        with:
          working-dir: .
          output-file: README.md
          output-method: inject
          git-push: true

  examples:
    name: Validate Examples
    runs-on: ubuntu-latest
    strategy:
      matrix:
        example: [basic, with-lifecycle, encrypted, complete]

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3

      - name: Init Example
        run: terraform init -backend=false
        working-directory: examples/${{ matrix.example }}

      - name: Validate Example
        run: terraform validate
        working-directory: examples/${{ matrix.example }}
```

### Pre-commit Configuration

#### .pre-commit-config.yaml

```yaml
repos:
  - repo: https://github.com/antonbabenko/pre-commit-terraform
    rev: v1.83.5
    hooks:
      - id: terraform_fmt
        name: Terraform format
        description: Format Terraform files

      - id: terraform_validate
        name: Terraform validate
        description: Validate Terraform configuration

      - id: terraform_docs
        name: Terraform docs
        description: Update documentation
        args:
          - --args=--lockfile=false

      - id: terraform_tflint
        name: TFLint
        description: Lint Terraform files
        args:
          - --args=--config=__GIT_WORKING_DIR__/.tflint.hcl

      - id: terraform_checkov
        name: Checkov
        description: Security scanning
        args:
          - --args=--quiet
          - --args=--framework terraform

  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files
      - id: check-merge-conflict
```

### Terraform Docs Configuration

#### .terraform-docs.yml

```yaml
formatter: "markdown table"

version: ""

header-from: main.tf

content: |-
  {{ .Header }}

  ## Usage

  {{ include "examples/basic/main.tf" }}

  {{ .Requirements }}

  {{ .Providers }}

  {{ .Inputs }}

  {{ .Outputs }}

  ## Examples

  - [Basic](./examples/basic) - Simple bucket creation
  - [With Lifecycle](./examples/with-lifecycle) - Lifecycle rules
  - [Encrypted](./examples/encrypted) - KMS encryption
  - [Complete](./examples/complete) - All features

  {{ .Footer }}

output:
  file: README.md
  mode: inject
  template: |-
    <!-- BEGIN_TF_DOCS -->
    {{ .Content }}
    <!-- END_TF_DOCS -->

sort:
  enabled: true
  by: name

settings:
  anchor: true
  color: true
  default: true
  description: true
  escape: true
  hide-empty: false
  html: true
  indent: 2
  lockfile: true
  read-comments: true
  required: true
  sensitive: true
  type: true
```

### TFLint Configuration

#### .tflint.hcl

```hcl
plugin "aws" {
  enabled = true
  version = "0.28.0"
  source  = "github.com/terraform-linters/tflint-ruleset-aws"
}

config {
  module = true
  force = false
}

rule "terraform_naming_convention" {
  enabled = true
}

rule "terraform_documented_variables" {
  enabled = true
}

rule "terraform_documented_outputs" {
  enabled = true
}

rule "terraform_unused_declarations" {
  enabled = true
}

rule "terraform_deprecated_interpolation" {
  enabled = true
}
```

### Additional Examples

#### examples/encrypted/main.tf

```hcl
provider "aws" {
  region = "us-east-1"
}

# KMS key for encryption
resource "aws_kms_key" "bucket" {
  description             = "KMS key for S3 bucket encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = {
    Purpose = "S3 Encryption"
  }
}

resource "aws_kms_alias" "bucket" {
  name          = "alias/s3-bucket-key"
  target_key_id = aws_kms_key.bucket.key_id
}

module "encrypted_bucket" {
  source = "../../"

  bucket_name         = "encrypted-data-${var.environment}"
  environment         = var.environment
  versioning_enabled  = true
  block_public_access = true
  kms_key_id          = aws_kms_key.bucket.arn

  tags = {
    Project    = "SecureApp"
    Encryption = "KMS"
  }
}

output "bucket_arn" {
  value = module.encrypted_bucket.bucket_arn
}

output "kms_key_id" {
  value = aws_kms_key.bucket.id
}
```

#### examples/complete/main.tf

```hcl
provider "aws" {
  region = "us-east-1"
}

# Logging bucket
resource "aws_s3_bucket" "logs" {
  bucket = "app-logs-${var.environment}"
}

resource "aws_s3_bucket_acl" "logs" {
  bucket = aws_s3_bucket.logs.id
  acl    = "log-delivery-write"
}

# Complete configuration
module "complete_bucket" {
  source = "../../"

  bucket_name         = "complete-example-${var.environment}"
  environment         = var.environment
  versioning_enabled  = true
  block_public_access = true

  lifecycle_rules = [
    {
      id              = "transition-to-ia"
      enabled         = true
      transition_days = 30
      storage_class   = "STANDARD_IA"
      expiration_days = 0
    },
    {
      id              = "transition-to-glacier"
      enabled         = true
      transition_days = 90
      storage_class   = "GLACIER"
      expiration_days = 0
    },
    {
      id              = "expire-old-data"
      enabled         = true
      transition_days = 0
      storage_class   = "GLACIER"
      expiration_days = 365
    }
  ]

  tags = {
    Project     = "CompleteExample"
    CostCenter  = "Engineering"
    Compliance  = "Required"
  }
}

# Enable logging
resource "aws_s3_bucket_logging" "complete" {
  bucket = module.complete_bucket.bucket_id

  target_bucket = aws_s3_bucket.logs.id
  target_prefix = "access-logs/"
}

output "bucket_arn" {
  value = module.complete_bucket.bucket_arn
}
```

## Explanation

### Why These Improvements Matter

#### 1. Automated Validation

**Before:**
- Manual testing
- Inconsistent formatting
- Missed errors

**After:**
```yaml
on: [push, pull_request]  # Automatic validation
```
- Every change validated
- Consistent standards
- Early error detection

#### 2. Documentation Generation

**Manual docs drift over time**

**Automated docs stay current:**
```yaml
- name: Generate Terraform docs
  uses: terraform-docs/gh-actions@v1.0.0
```

Always reflects actual code.

#### 3. Pre-commit Hooks

**Catch issues before commit:**
```yaml
hooks:
  - id: terraform_fmt
  - id: terraform_validate
  - id: terraform_docs
```

Ensures quality at source.

#### 4. Security Scanning

**Checkov finds security issues:**
```yaml
- name: Run Checkov
  uses: bridgecrewio/checkov-action@master
```

Prevents misconfigurations.

### Module Maturity Levels

| Level | Features |
|-------|----------|
| **Basic** | Working code, manual testing |
| **Good** | Documentation, examples |
| **Better** | Validation, formatting |
| **Best** | CI/CD, testing, security scans |

## Result

### Setup and Validate

```bash
# Install pre-commit
pip install pre-commit
pre-commit install

# Install dependencies
brew install terraform-docs tflint

# Run all checks locally
pre-commit run --all-files

# Output:
# Terraform format...........Passed
# Terraform validate.........Passed
# Terraform docs.............Passed
# TFLint.....................Passed
# Checkov....................Passed
```

### CI/CD Pipeline Results

```
✓ Terraform Validate  (15s)
✓ TFLint             (12s)
✓ Security Scan      (23s)
✓ Documentation      (8s)
✓ Validate Examples  (45s)

All checks passed!
```

### Generated Documentation

README.md automatically updated with:
- Current inputs/outputs
- Version requirements
- Usage examples
- Provider information

## Validation

### Quality Checklist

```bash
# 1. Pre-commit hooks installed
pre-commit run --all-files
# Should show all checks passing

# 2. CI/CD pipeline configured
git push origin feature-branch
# Check GitHub Actions for green checkmarks

# 3. Documentation current
terraform-docs markdown table . --output-file README.md
git diff README.md
# Should show no changes (already current)

# 4. Examples validate
for dir in examples/*/; do
  (cd "$dir" && terraform init -backend=false && terraform validate)
done
# All examples should validate

# 5. Security scan passes
checkov -d . --framework terraform
# Should show no HIGH or CRITICAL issues

# 6. Formatting consistent
terraform fmt -check -recursive
# Should return 0 (already formatted)
```

## Best Practices

### ✅ Do's

1. **Automate everything**: CI/CD for all checks
2. **Generate documentation**: Keep docs in sync
3. **Use pre-commit hooks**: Catch issues early
4. **Security scan**: Find vulnerabilities
5. **Multiple examples**: Show various use cases
6. **Version semantically**: Clear version progression

### ❌ Don'ts

1. **Don't skip testing**: Quality suffers
2. **Don't write docs manually**: They'll drift
3. **Don't ignore security**: Scan regularly
4. **Don't forget examples**: Users need them
5. **Don't skip formatting**: Consistency matters

## Links

- [Terraform Docs](https://terraform-docs.io/)
- [Pre-commit Terraform](https://github.com/antonbabenko/pre-commit-terraform)
- [TFLint](https://github.com/terraform-linters/tflint)
- [Checkov](https://www.checkov.io/)
- [Terraform Registry Publishing](https://developer.hashicorp.com/terraform/registry/modules/publish)
- [Module Testing](https://developer.hashicorp.com/terraform/tutorials/modules/automate-terraform)

## Share Your Success

Enhanced your module? Share the improvements!

**Tag [@thedevopsdaily](https://x.com/thedevopsdaily)** on X with:
- Before/after comparison
- CI/CD pipeline screenshot
- Documentation quality improvement
- Link to module repo

Use hashtags: **#AdventOfDevOps #Terraform #IaC #Day7**
