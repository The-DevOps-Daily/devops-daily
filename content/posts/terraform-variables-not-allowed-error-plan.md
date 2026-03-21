---
title: 'How to Fix Terraform "Variables Not Allowed" Error During Plan'
excerpt: "Learn why Terraform throws 'Variables not allowed' errors in certain contexts and how to resolve them using locals, data sources, or restructuring your configuration."
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2025-04-18'
publishedAt: '2025-04-18T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Infrastructure as Code
  - Troubleshooting
  - Variables
  - DevOps
---

When you run `terraform plan`, you might encounter an error saying "Variables not allowed" in certain contexts like backend configuration, provider configuration, or terraform blocks. This happens because Terraform evaluates some parts of your configuration before it processes variables, making them unavailable in these early-evaluation contexts.

Understanding where variables can and cannot be used is crucial for structuring your Terraform configurations correctly.

**TLDR:** Variables cannot be used in backend configuration blocks, terraform blocks, or provider aliases because these are evaluated before Terraform loads variables. Use hard-coded values, environment variables, `-backend-config` flags, or partial configuration files instead. For dynamic provider configuration, use locals or separate configuration files per environment. The error occurs because Terraform needs to know backend and provider details before it can process variables.

## Where Variables Cannot Be Used

Variables are not allowed in these contexts:

```hcl
# INVALID: Variables in terraform block
terraform {
  required_version = var.terraform_version  # ERROR: Variables not allowed
}

# INVALID: Variables in backend configuration
terraform {
  backend "s3" {
    bucket = var.state_bucket  # ERROR: Variables not allowed
    key    = var.state_key     # ERROR: Variables not allowed
    region = var.aws_region    # ERROR: Variables not allowed
  }
}

# INVALID: Variables in provider version constraints
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = var.aws_provider_version  # ERROR: Variables not allowed
    }
  }
}
```

These blocks are evaluated during Terraform's initialization phase, before variables are loaded.

## Understanding Terraform Evaluation Order

Terraform evaluates configuration in this order:

```
1. Terraform block (required_version, required_providers)
   ├─> Backend configuration
   └─> Provider source and version constraints

2. Provider configuration
   └─> Some provider settings can't use variables

3. Variables loaded
   └─> Default values from variables.tf
   └─> terraform.tfvars files
   └─> -var flags

4. Resources and modules
   └─> Variables available here
```

This is why variables aren't available in early-evaluation contexts.

## Solution 1: Backend Configuration With Partial Configuration

Instead of using variables in the backend block, use partial configuration:

```hcl
# backend.tf - only specify the backend type
terraform {
  backend "s3" {}
}
```

Provide the configuration via command-line flags:

```bash
terraform init \
  -backend-config="bucket=my-terraform-state" \
  -backend-config="key=prod/terraform.tfstate" \
  -backend-config="region=us-east-1"
```

Or create a backend configuration file:

```hcl
# backend-prod.hcl
bucket = "my-terraform-state"
key    = "prod/terraform.tfstate"
region = "us-east-1"
```

Reference it during init:

```bash
terraform init -backend-config=backend-prod.hcl
```

For multiple environments:

```
config/
├── backend-dev.hcl
├── backend-staging.hcl
└── backend-prod.hcl
```

```bash
# Initialize for production
terraform init -backend-config=config/backend-prod.hcl

# Initialize for dev
terraform init -backend-config=config/backend-dev.hcl
```

## Solution 2: Using Environment Variables

Backend configuration can read from environment variables:

```bash
# Set environment variables
export TF_CLI_ARGS_init="-backend-config=bucket=my-state-bucket -backend-config=key=terraform.tfstate"

# Or use AWS environment variables
export AWS_DEFAULT_REGION=us-east-1

terraform init
```

For the S3 backend specifically:

```bash
export AWS_REGION=us-east-1
export TF_BACKEND_BUCKET=my-terraform-state
export TF_BACKEND_KEY=prod/terraform.tfstate

terraform init \
  -backend-config="bucket=$TF_BACKEND_BUCKET" \
  -backend-config="key=$TF_BACKEND_KEY" \
  -backend-config="region=$AWS_REGION"
```

## Solution 3: Provider Configuration Workarounds

Some provider settings can't use variables. Here's how to work around it:

**Problem: Can't use variables in provider alias:**

```hcl
# INVALID
provider "aws" {
  alias  = var.provider_alias  # ERROR
  region = var.aws_region
}
```

**Solution: Use separate provider blocks:**

```hcl
# Define providers with hard-coded aliases
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

provider "aws" {
  alias  = "us_west_2"
  region = "us-west-2"
}

# Use variables to choose which provider
resource "aws_instance" "app" {
  provider = var.use_west_region ? aws.us_west_2 : aws.us_east_1

  ami           = var.ami_id
  instance_type = "t3.medium"
}
```

**Problem: Can't use variables in provider version constraints:**

```hcl
# INVALID
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = var.aws_version  # ERROR
    }
  }
}
```

**Solution: Hard-code version or use version files:**

```hcl
# versions.tf - committed to Git
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

For environment-specific versions, use separate configuration directories:

```
terraform/
├── environments/
│   ├── dev/
│   │   ├── versions.tf    # AWS provider ~> 4.0
│   │   └── main.tf
│   └── prod/
│       ├── versions.tf    # AWS provider ~> 5.0
│       └── main.tf
```

## Solution 4: Using Locals Instead of Variables

For values computed from variables that you need early in configuration:

```hcl
# Variables are loaded
variable "environment" {
  type = string
}

variable "aws_region" {
  type = string
}

# Locals are evaluated after variables
locals {
  state_key = "${var.environment}/terraform.tfstate"
  common_tags = {
    Environment = var.environment
    Region      = var.aws_region
    ManagedBy   = "terraform"
  }
}

# But you still can't use locals in backend config
# This won't work:
# backend "s3" {
#   key = local.state_key  # ERROR: Not allowed
# }
```

Locals don't solve the backend configuration problem but are useful elsewhere.

## Solution 5: Dynamic Provider Configuration

While you can't use variables in some provider settings, you can use them in most:

```hcl
variable "aws_region" {
  type = string
}

variable "assume_role_arn" {
  type = string
}

# This is fine - most provider arguments accept variables
provider "aws" {
  region = var.aws_region

  assume_role {
    role_arn = var.assume_role_arn
  }

  default_tags {
    tags = {
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
```

What you can't do is make the provider block itself conditional or use variables in the provider alias.

## Solution 6: Separate Configuration Per Environment

For significantly different environments, use separate directories:

```
infrastructure/
├── global/
│   └── versions.tf
├── dev/
│   ├── backend.tf
│   ├── provider.tf
│   ├── main.tf
│   └── terraform.tfvars
├── staging/
│   ├── backend.tf
│   ├── provider.tf
│   ├── main.tf
│   └── terraform.tfvars
└── prod/
    ├── backend.tf
    ├── provider.tf
    ├── main.tf
    └── terraform.tfvars
```

Each environment has its own backend configuration:

```hcl
# dev/backend.tf
terraform {
  backend "s3" {
    bucket = "company-terraform-state-dev"
    key    = "dev/terraform.tfstate"
    region = "us-east-1"
  }
}

# prod/backend.tf
terraform {
  backend "s3" {
    bucket = "company-terraform-state-prod"
    key    = "prod/terraform.tfstate"
    region = "us-east-1"
  }
}
```

This eliminates the need for dynamic backend configuration.

## Solution 7: Terraform Wrapper Scripts

Create scripts that set up the environment before running Terraform:

```bash
#!/bin/bash
# deploy.sh

ENVIRONMENT=$1

if [ -z "$ENVIRONMENT" ]; then
  echo "Usage: $0 <environment>"
  exit 1
fi

# Set backend config based on environment
case $ENVIRONMENT in
  dev)
    BACKEND_BUCKET="terraform-state-dev"
    BACKEND_KEY="dev/terraform.tfstate"
    ;;
  staging)
    BACKEND_BUCKET="terraform-state-staging"
    BACKEND_KEY="staging/terraform.tfstate"
    ;;
  prod)
    BACKEND_BUCKET="terraform-state-prod"
    BACKEND_KEY="prod/terraform.tfstate"
    ;;
  *)
    echo "Unknown environment: $ENVIRONMENT"
    exit 1
    ;;
esac

# Initialize with dynamic backend config
terraform init \
  -backend-config="bucket=$BACKEND_BUCKET" \
  -backend-config="key=$BACKEND_KEY" \
  -backend-config="region=us-east-1"

# Apply with environment-specific vars
terraform apply -var-file="environments/${ENVIRONMENT}.tfvars"
```

Use it:

```bash
./deploy.sh prod
```

## Common Scenarios and Solutions

**Scenario: Different backend per environment**

```bash
# Don't use variables in backend block
# Instead, use -backend-config

terraform init -backend-config=backend-${ENV}.hcl
```

**Scenario: Different AWS accounts per environment**

```hcl
# Variables work fine in provider configuration
variable "aws_account_id" {
  type = string
}

provider "aws" {
  region = var.aws_region

  assume_role {
    role_arn = "arn:aws:iam::${var.aws_account_id}:role/TerraformRole"
  }
}
```

**Scenario: Need to compute backend key from variables**

```bash
# Use shell variables to construct backend config
ENV="production"
BACKEND_KEY="${ENV}/terraform.tfstate"

terraform init -backend-config="key=$BACKEND_KEY"
```

## Debugging Variables Not Allowed Errors

When you see this error, check:

1. **Where the variable is used:**

```bash
# Find variable usage
grep -r "var\." *.tf
```

2. **The exact error message:**

```
Error: Variables not allowed

  on backend.tf line 4, in terraform:
   4:     bucket = var.state_bucket

Variables may not be used here.
```

The error shows exactly which file and line has the problem.

3. **Check Terraform block contents:**

```hcl
# Review your terraform blocks
terraform {
  # No variables allowed anywhere in here
  required_version = ">= 1.5"

  backend "s3" {
    # No variables allowed in backend config
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"  # Must be hard-coded
    }
  }
}
```

## Terraform Cloud Workspaces Alternative

If using Terraform Cloud, workspace variables can replace backend configuration:

```hcl
# No backend configuration needed with Terraform Cloud
terraform {
  cloud {
    organization = "my-org"

    workspaces {
      name = "production"  # Hard-coded workspace name
    }
  }
}
```

Configure different workspaces for each environment in the Terraform Cloud UI, avoiding the need for dynamic backend configuration.

## Using Data Sources for Dynamic Values

While you can't use variables in terraform blocks, you can use data sources to fetch dynamic values for use in resources:

```hcl
# Fetch current AWS account info
data "aws_caller_identity" "current" {}

# Fetch current region
data "aws_region" "current" {}

resource "aws_s3_bucket" "state" {
  bucket = "terraform-state-${data.aws_caller_identity.current.account_id}"

  tags = {
    Region = data.aws_region.current.name
  }
}
```

This doesn't help with backend configuration but is useful for making other parts of your config dynamic.

The "Variables not allowed" error is Terraform enforcing its evaluation order. Backend and provider configuration happen before variables are loaded, so they must use hard-coded values, command-line flags, or environment variables. Structure your configuration to work with these constraints rather than trying to work around them.
