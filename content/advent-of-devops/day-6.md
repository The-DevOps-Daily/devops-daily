---
title: 'Day 6 - Write a Small Terraform Module'
day: 6
excerpt: 'Create your first reusable Terraform module to provision cloud infrastructure. Learn infrastructure as code fundamentals.'
description: 'Build a practical Terraform module for AWS S3 bucket creation with proper configuration, variables, and outputs.'
publishedAt: '2026-12-06T00:00:00Z'
updatedAt: '2026-12-06T00:00:00Z'
difficulty: 'Intermediate'
category: 'Infrastructure as Code'
tags:
  - Terraform
  - AWS
  - IaC
  - Modules
---

## Description

Your team keeps copying and pasting Terraform code for creating S3 buckets. Each bucket needs versioning, encryption, and proper tagging, but the code is duplicated across multiple projects. It's time to create a reusable module.

## Task

Create a Terraform module for provisioning S3 buckets with best practices built-in.

**Requirements:**
- Module accepts customizable inputs
- Enforces security best practices
- Provides useful outputs
- Includes documentation
- Works across multiple environments

## Target

- ✅ Reusable module structure
- ✅ Variables for customization
- ✅ Security features enabled by default
- ✅ Clear outputs
- ✅ Successfully provisions bucket

## Sample App

### Directory Structure

```
terraform-aws-s3-bucket/
├── main.tf           # Main resource definitions
├── variables.tf      # Input variables
├── outputs.tf        # Output values
├── versions.tf       # Provider requirements
├── README.md         # Documentation
└── examples/
    └── basic/
        ├── main.tf
        └── variables.tf
```

## Solution

### Module Code

#### main.tf

```hcl
# S3 Bucket
resource "aws_s3_bucket" "this" {
  bucket = var.bucket_name

  tags = merge(
    var.tags,
    {
      Name        = var.bucket_name
      ManagedBy   = "Terraform"
      Environment = var.environment
    }
  )
}

# Versioning
resource "aws_s3_bucket_versioning" "this" {
  bucket = aws_s3_bucket.this.id

  versioning_configuration {
    status = var.versioning_enabled ? "Enabled" : "Suspended"
  }
}

# Encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  bucket = aws_s3_bucket.this.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = var.kms_key_id != null ? "aws:kms" : "AES256"
      kms_master_key_id = var.kms_key_id
    }
    bucket_key_enabled = var.kms_key_id != null ? true : false
  }
}

# Block Public Access
resource "aws_s3_bucket_public_access_block" "this" {
  bucket = aws_s3_bucket.this.id

  block_public_acls       = var.block_public_access
  block_public_policy     = var.block_public_access
  ignore_public_acls      = var.block_public_access
  restrict_public_buckets = var.block_public_access
}

# Lifecycle Rules (optional)
resource "aws_s3_bucket_lifecycle_configuration" "this" {
  count  = var.lifecycle_rules != null ? 1 : 0
  bucket = aws_s3_bucket.this.id

  dynamic "rule" {
    for_each = var.lifecycle_rules

    content {
      id     = rule.value.id
      status = rule.value.enabled ? "Enabled" : "Disabled"

      transition {
        days          = rule.value.transition_days
        storage_class = rule.value.storage_class
      }

      expiration {
        days = rule.value.expiration_days
      }
    }
  }
}

# Bucket Policy (optional)
resource "aws_s3_bucket_policy" "this" {
  count  = var.bucket_policy != null ? 1 : 0
  bucket = aws_s3_bucket.this.id
  policy = var.bucket_policy
}
```

#### variables.tf

```hcl
variable "bucket_name" {
  description = "Name of the S3 bucket (must be globally unique)"
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]*[a-z0-9]$", var.bucket_name))
    error_message = "Bucket name must be lowercase alphanumeric with hyphens."
  }
}

variable "environment" {
  description = "Environment name (e.g., dev, staging, prod)"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "versioning_enabled" {
  description = "Enable versioning for the bucket"
  type        = bool
  default     = true
}

variable "block_public_access" {
  description = "Block all public access to bucket"
  type        = bool
  default     = true
}

variable "kms_key_id" {
  description = "KMS key ID for encryption (null uses AES256)"
  type        = string
  default     = null
}

variable "lifecycle_rules" {
  description = "Lifecycle rules for object management"
  type = list(object({
    id              = string
    enabled         = bool
    transition_days = number
    storage_class   = string
    expiration_days = number
  }))
  default = null
}

variable "bucket_policy" {
  description = "JSON policy document for bucket"
  type        = string
  default     = null
}

variable "tags" {
  description = "Additional tags for the bucket"
  type        = map(string)
  default     = {}
}
```

#### outputs.tf

```hcl
output "bucket_id" {
  description = "The name of the bucket"
  value       = aws_s3_bucket.this.id
}

output "bucket_arn" {
  description = "The ARN of the bucket"
  value       = aws_s3_bucket.this.arn
}

output "bucket_domain_name" {
  description = "The bucket domain name"
  value       = aws_s3_bucket.this.bucket_domain_name
}

output "bucket_regional_domain_name" {
  description = "The bucket regional domain name"
  value       = aws_s3_bucket.this.bucket_regional_domain_name
}

output "bucket_region" {
  description = "The AWS region this bucket resides in"
  value       = aws_s3_bucket.this.region
}
```

#### versions.tf

```hcl
terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}
```

### Example Usage

#### examples/basic/main.tf

```hcl
provider "aws" {
  region = "us-east-1"
}

module "app_bucket" {
  source = "../../"

  bucket_name         = "my-app-data-${var.environment}"
  environment         = var.environment
  versioning_enabled  = true
  block_public_access = true

  lifecycle_rules = [
    {
      id              = "archive-old-versions"
      enabled         = true
      transition_days = 30
      storage_class   = "STANDARD_IA"
      expiration_days = 90
    }
  ]

  tags = {
    Project = "MyApp"
    Owner   = "Platform Team"
  }
}

output "bucket_name" {
  value = module.app_bucket.bucket_id
}

output "bucket_arn" {
  value = module.app_bucket.bucket_arn
}
```

#### examples/basic/variables.tf

```hcl
variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}
```

## Explanation

### Module Structure

#### 1. Input Variables (variables.tf)

**Purpose:** Define configurable parameters

```hcl
variable "bucket_name" {
  description = "Name of the S3 bucket"
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]*[a-z0-9]$", var.bucket_name))
    error_message = "Bucket name must be lowercase alphanumeric."
  }
}
```

**Best practices:**
- Clear descriptions
- Appropriate types
- Validation rules
- Sensible defaults

#### 2. Resource Definitions (main.tf)

**Security by default:**
```hcl
resource "aws_s3_bucket_public_access_block" "this" {
  bucket = aws_s3_bucket.this.id

  block_public_acls       = true  # Default secure
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
```

#### 3. Outputs (outputs.tf)

**Expose useful information:**
```hcl
output "bucket_arn" {
  description = "The ARN of the bucket"
  value       = aws_s3_bucket.this.arn
}
```

Other modules can reference: `module.bucket.bucket_arn`

### Key Concepts

#### Dynamic Blocks

```hcl
dynamic "rule" {
  for_each = var.lifecycle_rules

  content {
    id     = rule.value.id
    status = rule.value.enabled ? "Enabled" : "Disabled"
  }
}
```

Allows flexible configuration without code duplication.

#### Conditional Resources

```hcl
resource "aws_s3_bucket_policy" "this" {
  count  = var.bucket_policy != null ? 1 : 0
  bucket = aws_s3_bucket.this.id
  policy = var.bucket_policy
}
```

Create resource only when needed.

#### Merged Tags

```hcl
tags = merge(
  var.tags,
  {
    Name      = var.bucket_name
    ManagedBy = "Terraform"
  }
)
```

Combine user tags with defaults.

## Result

### Deploy the Module

```bash
# Navigate to example
cd examples/basic

# Initialize Terraform
terraform init

# Review plan
terraform plan

# Expected output:
# Terraform will perform the following actions:
#
#   # module.app_bucket.aws_s3_bucket.this will be created
#   + resource "aws_s3_bucket" "this" {
#       + bucket = "my-app-data-dev"
#       + tags   = {
#           + "Environment" = "dev"
#           + "ManagedBy"   = "Terraform"
#         }
#     }
#
# Plan: 5 to add, 0 to change, 0 to destroy.

# Apply changes
terraform apply -auto-approve

# Outputs:
# bucket_arn  = "arn:aws:s3:::my-app-data-dev"
# bucket_name = "my-app-data-dev"
```

### Verify Creation

```bash
# List bucket with AWS CLI
aws s3 ls | grep my-app-data

# Check bucket versioning
aws s3api get-bucket-versioning --bucket my-app-data-dev
# {
#     "Status": "Enabled"
# }

# Check encryption
aws s3api get-bucket-encryption --bucket my-app-data-dev

# Check public access block
aws s3api get-public-access-block --bucket my-app-data-dev
```

## Validation

### Test Checklist

```bash
# 1. Module validates successfully
terraform validate
# Success! The configuration is valid.

# 2. Plan shows expected resources
terraform plan | grep "will be created"
# Should list 4-5 resources

# 3. Apply succeeds
terraform apply -auto-approve
# Apply complete! Resources: 5 added, 0 changed, 0 destroyed.

# 4. Bucket exists and is configured
aws s3api head-bucket --bucket my-app-data-dev
# Should return without error

# 5. Security settings applied
aws s3api get-public-access-block --bucket my-app-data-dev
# Should show all blocks enabled

# 6. Outputs are correct
terraform output
# bucket_arn = "arn:aws:s3:::my-app-data-dev"

# 7. Clean up
terraform destroy -auto-approve
```

## Advanced Features

### Remote State Backend Module

```hcl
# Include remote state configuration
variable "enable_state_backend" {
  description = "Configure bucket for Terraform state"
  type        = bool
  default     = false
}

resource "aws_s3_bucket_logging" "this" {
  count  = var.enable_state_backend ? 1 : 0
  bucket = aws_s3_bucket.this.id

  target_bucket = var.logging_bucket
  target_prefix = "state-logs/"
}
```

### Testing with Terratest

```go
// test/bucket_test.go
package test

import (
    "testing"
    "github.com/gruntwork-io/terratest/modules/terraform"
    "github.com/stretchr/testify/assert"
)

func TestS3Module(t *testing.T) {
    terraformOptions := &terraform.Options{
        TerraformDir: "../examples/basic",
    }

    defer terraform.Destroy(t, terraformOptions)
    terraform.InitAndApply(t, terraformOptions)

    bucketID := terraform.Output(t, terraformOptions, "bucket_name")
    assert.NotEmpty(t, bucketID)
}
```

## Best Practices

### ✅ Do's

1. **Use variables for flexibility**: Make modules configurable
2. **Set secure defaults**: Security should be opt-out, not opt-in
3. **Validate inputs**: Catch errors early with validation rules
4. **Document everything**: README with usage examples
5. **Version your modules**: Use semantic versioning

### ❌ Don'ts

1. **Don't hardcode values**: Use variables instead
2. **Don't skip validation**: Prevent invalid configurations
3. **Don't forget outputs**: Expose useful information
4. **Don't ignore state**: Manage state properly
5. **Don't create god modules**: Keep modules focused

## Links

- [Terraform Module Documentation](https://developer.hashicorp.com/terraform/language/modules)
- [AWS S3 Terraform Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket)
- [Terraform Registry](https://registry.terraform.io/)
- [Module Best Practices](https://developer.hashicorp.com/terraform/tutorials/modules/pattern-module-creation)
- [Terratest](https://terratest.gruntwork.io/)

## Share Your Success

Created your first Terraform module? Share it!

**Tag [@thedevopsdaily](https://x.com/thedevopsdaily)** on X with:
- Your module's purpose
- Number of resources it manages
- Link to GitHub repo (if public)
- What you learned

Use hashtags: **#AdventOfDevOps #Terraform #IaC #Day6**
