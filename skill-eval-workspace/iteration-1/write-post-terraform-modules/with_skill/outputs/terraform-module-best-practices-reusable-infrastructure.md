---
title: 'Terraform Module Best Practices for Reusable Infrastructure'
excerpt: 'Learn how to design, structure, and publish Terraform modules that are genuinely reusable across teams and environments — covering input validation, versioning, testing, and composition patterns that hold up in production.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2026-03-20'
publishedAt: '2026-03-20T09:00:00Z'
updatedAt: '2026-03-20T09:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Terraform
  - Modules
  - Infrastructure as Code
  - DevOps
  - Reusability
  - HCL
---

Most Terraform codebases start small: a handful of resources in a single directory that one person understands. Then a second team needs a similar VPC, or a third environment appears, and suddenly you are copy-pasting hundreds of lines. Terraform modules solve this, but only if you design them for reuse from the start. A poorly written module is worse than no module at all — it adds indirection without flexibility.

This post walks through the practices that separate throwaway modules from ones your entire organization can depend on. You will learn how to structure directories, define clean interfaces with variables and outputs, validate inputs, version releases, compose modules together, and test everything before it reaches production.

## TL;DR

- Keep modules focused on a single logical resource group (one concern, one module).
- Define explicit `variable` blocks with types, descriptions, defaults, and validation rules.
- Expose every value a consumer might need through `output` blocks.
- Pin module sources to semantic versions, never to `main` or `latest`.
- Use composition (modules calling modules) instead of building monolithic mega-modules.
- Test modules with `terraform validate`, `terraform plan`, and a framework like Terratest.

## Prerequisites

- Terraform 1.5 or later installed
- Familiarity with core Terraform concepts (resources, providers, state)
- A basic understanding of HCL syntax
- Access to at least one cloud provider account for testing (examples use AWS)

## Anatomy of a Well-Structured Module

A reusable module follows a predictable file layout. Consumers should be able to open the directory and immediately understand what it does, what it expects, and what it returns.

```
modules/
  vpc/
    main.tf          # Core resource definitions
    variables.tf     # All input variables
    outputs.tf       # All output values
    versions.tf      # Required providers and Terraform version
    README.md        # Usage examples and variable reference
    examples/
      simple/
        main.tf      # Minimal working example
      complete/
        main.tf      # Full-featured example with all options
    tests/
      vpc_test.go    # Automated tests (Terratest, etc.)
```

A few rules make this layout effective:

- **One concern per module.** A VPC module creates a VPC, subnets, route tables, and NAT gateways. It does not create EC2 instances or RDS databases.
- **No hardcoded provider configuration.** The calling root module configures providers. The module declares only `required_providers` in `versions.tf`.
- **Examples are mandatory.** If you cannot show a working example in ten lines, the module interface is too complex.

### The versions.tf File

Every module should pin the minimum Terraform and provider versions it supports:

```hcl
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0.0, < 6.0.0"
    }
  }
}
```

Pinning a provider range (not an exact version) gives consumers flexibility while protecting against breaking changes in a new major release.

## Designing Clean Variable Interfaces

Variables are the public API of your module. Treat them with the same care you would give a function signature in application code.

### Always Specify Type, Description, and Default

```hcl
variable "vpc_cidr" {
  type        = string
  description = "The CIDR block for the VPC. Must be a /16 to /24 range."
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  type        = list(string)
  description = "List of AZs to deploy subnets into. Provide at least two for high availability."
  # No default — force the caller to be explicit about AZ selection
}

variable "tags" {
  type        = map(string)
  description = "A map of tags to apply to all resources created by this module."
  default     = {}
}
```

Omitting `description` is a common shortcut that makes modules opaque to anyone who did not write them. Future you counts as "anyone."

### Use Validation Blocks to Catch Mistakes Early

Terraform's `validation` block runs during `plan`, catching bad input before any API call happens:

```hcl
variable "vpc_cidr" {
  type        = string
  description = "The CIDR block for the VPC. Must be a /16 to /24 range."
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "The vpc_cidr value must be a valid CIDR block (e.g., 10.0.0.0/16)."
  }

  validation {
    condition = (
      tonumber(split("/", var.vpc_cidr)[1]) >= 16 &&
      tonumber(split("/", var.vpc_cidr)[1]) <= 24
    )
    error_message = "The vpc_cidr prefix length must be between /16 and /24."
  }
}

variable "environment" {
  type        = string
  description = "Deployment environment name."

  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be one of: dev, staging, production."
  }
}
```

### Use Object Types for Related Settings

When multiple variables always travel together, group them into an object:

```hcl
# Bad — five loosely related variables
variable "db_instance_class" { ... }
variable "db_engine" { ... }
variable "db_engine_version" { ... }
variable "db_allocated_storage" { ... }
variable "db_multi_az" { ... }

# Good — one structured variable with clear intent
variable "database" {
  type = object({
    instance_class    = string
    engine            = string
    engine_version    = string
    allocated_storage = number
    multi_az          = bool
  })
  description = "Database configuration for the RDS instance."

  default = {
    instance_class    = "db.t3.medium"
    engine            = "postgres"
    engine_version    = "15.4"
    allocated_storage = 50
    multi_az          = true
  }
}
```

This approach reduces variable sprawl and makes it clear which settings belong together.

## Writing Useful Outputs

Outputs are the other half of the module contract. A good rule: **output every identifier, ARN, and endpoint that a consumer might reference.** It costs nothing to add an output but can cost hours when someone has to fork your module just to expose a missing attribute.

```hcl
output "vpc_id" {
  description = "The ID of the VPC."
  value       = aws_vpc.this.id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs."
  value       = aws_subnet.private[*].id
}

output "public_subnet_ids" {
  description = "List of public subnet IDs."
  value       = aws_subnet.public[*].id
}

output "nat_gateway_ips" {
  description = "Elastic IP addresses associated with NAT gateways."
  value       = aws_eip.nat[*].public_ip
}

output "vpc_cidr_block" {
  description = "The CIDR block of the VPC."
  value       = aws_vpc.this.cidr_block
}
```

### Avoid Computed Outputs That Leak Implementation Details

Do not output internal resource names that are only meaningful inside the module. Consumers should depend on stable identifiers (IDs, ARNs) rather than names that might change if you refactor.

## Versioning and Source Pinning

When you consume a module — whether from a registry, a Git repository, or a local path — version pinning determines how stable your infrastructure is.

### Semantic Versioning for Git-Hosted Modules

Tag your module repository with semantic versions:

```bash
git tag -a v1.2.0 -m "Add support for IPv6 subnets"
git push origin v1.2.0
```

Consumers pin to that tag:

```hcl
module "vpc" {
  source  = "git::https://github.com/your-org/terraform-aws-vpc.git?ref=v1.2.0"

  vpc_cidr           = "10.0.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b"]
  environment        = "production"
}
```

### Registry Modules Use Version Constraints

For modules published to the Terraform Registry (public or private), use the `version` argument:

```hcl
module "vpc" {
  source  = "your-org/vpc/aws"
  version = "~> 1.2.0"  # Allows 1.2.x but not 1.3.0

  vpc_cidr           = "10.0.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b"]
}
```

### What Not to Do

```hcl
# Never point to an unversioned branch
module "vpc" {
  source = "git::https://github.com/your-org/terraform-aws-vpc.git?ref=main"
  # A push to main could break every environment simultaneously
}
```

## Composition Over Monoliths

The most maintainable Terraform architectures compose small, focused modules rather than building one giant module that does everything.

### The Monolith Anti-Pattern

```
modules/
  everything/          # Creates VPC, subnets, EKS cluster, RDS,
    main.tf            # ALB, Route53 records, IAM roles...
    variables.tf       # 80+ variables
    outputs.tf         # 60+ outputs
```

This module is impossible to reuse. A team that needs a VPC without EKS cannot use it. A team that needs EKS on an existing VPC cannot use it either.

### The Composition Pattern

```hcl
# Root module composes small, focused modules

module "vpc" {
  source  = "your-org/vpc/aws"
  version = "~> 1.2.0"

  vpc_cidr           = "10.0.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]
  environment        = var.environment
  tags               = var.common_tags
}

module "eks" {
  source  = "your-org/eks/aws"
  version = "~> 3.0.0"

  cluster_name = "my-app-${var.environment}"
  vpc_id       = module.vpc.vpc_id                    # Wire outputs to inputs
  subnet_ids   = module.vpc.private_subnet_ids         # Modules communicate through data
  tags         = var.common_tags
}

module "rds" {
  source  = "your-org/rds/aws"
  version = "~> 2.1.0"

  database   = var.database_config
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnet_ids
  tags       = var.common_tags
}
```

Each module is independently versioned, tested, and reusable. Teams pick only the building blocks they need.

## Handling Optional Features with Feature Flags

Real-world modules need to support optional behaviors. Use boolean variables as feature flags combined with `count` or `for_each`:

```hcl
variable "enable_nat_gateway" {
  type        = bool
  description = "Set to true to create NAT gateways for private subnet internet access."
  default     = true
}

variable "single_nat_gateway" {
  type        = bool
  description = "Set to true to create a single shared NAT gateway instead of one per AZ."
  default     = false
}

resource "aws_nat_gateway" "this" {
  count = var.enable_nat_gateway ? (var.single_nat_gateway ? 1 : length(var.availability_zones)) : 0

  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = merge(var.tags, {
    Name = "nat-${var.environment}-${count.index}"
  })
}
```

This gives consumers control without forking the module. A dev environment can skip NAT gateways entirely, a staging environment can use a single NAT gateway to save cost, and production can have one per AZ for resilience.

## Testing Modules

An untested module is a liability. There are several layers of testing you should apply.

### Layer 1: Static Validation

Run these on every pull request. They are fast and catch syntax and configuration errors:

```bash
# Format check — fails CI if formatting is wrong
terraform fmt -check -recursive

# Validate configuration without accessing providers
terraform init -backend=false
terraform validate
```

### Layer 2: Plan-Based Checks

Use `terraform plan` to verify that expected resources appear without actually creating anything:

```bash
cd modules/vpc/examples/simple
terraform init
terraform plan -out=tfplan

# Use terraform show to inspect the plan programmatically
terraform show -json tfplan | jq '.resource_changes | length'
# Expected output: 12 (or whatever your module creates)
```

### Layer 3: Integration Tests with Terratest

For critical modules, use **Terratest** to create real infrastructure, validate it, and tear it down:

```go
package test

import (
    "testing"

    "github.com/gruntwork-io/terratest/modules/terraform"
    "github.com/stretchr/testify/assert"
)

func TestVpcModule(t *testing.T) {
    t.Parallel()

    terraformOptions := &terraform.Options{
        TerraformDir: "../examples/simple",
        Vars: map[string]interface{}{
            "vpc_cidr":           "10.99.0.0/16",
            "availability_zones": []string{"us-east-1a", "us-east-1b"},
            "environment":        "test",
        },
    }

    // Clean up resources when test completes
    defer terraform.Destroy(t, terraformOptions)

    // Create the infrastructure
    terraform.InitAndApply(t, terraformOptions)

    // Verify outputs
    vpcId := terraform.Output(t, terraformOptions, "vpc_id")
    assert.NotEmpty(t, vpcId)

    privateSubnets := terraform.OutputList(t, terraformOptions, "private_subnet_ids")
    assert.Equal(t, 2, len(privateSubnets))
}
```

### Layer 4: Policy-as-Code

Use tools like **Open Policy Agent (OPA)** or **Checkov** to enforce security and compliance rules against your plan output:

```bash
# Run Checkov against your module
checkov -d modules/vpc/ --framework terraform

# Or validate the plan with OPA
terraform show -json tfplan > plan.json
opa eval --data policies/ --input plan.json "data.terraform.deny"
```

## Documentation That Stays Current

Module documentation rots fast if it is maintained by hand. Use **terraform-docs** to auto-generate variable and output tables from your HCL:

```bash
# Install terraform-docs
brew install terraform-docs

# Generate a markdown table and inject it into README.md
terraform-docs markdown table --output-file README.md --output-mode inject modules/vpc/
```

Add a pre-commit hook so docs update automatically:

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/terraform-docs/terraform-docs
    rev: v0.18.0
    hooks:
      - id: terraform-docs-go
        args: ["markdown", "table", "--output-file", "README.md", "--output-mode", "inject"]
```

This eliminates the "docs are outdated" problem entirely.

## Common Mistakes to Avoid

**Hardcoding provider configuration inside modules.** Let the root module configure providers. A module with a hardcoded `region` cannot be reused across regions.

```hcl
# Wrong — locks the module to a single region
provider "aws" {
  region = "us-east-1"
}

# Right — no provider block in the module at all.
# The calling root module passes the provider implicitly.
```

**Using `terraform.workspace` inside modules.** Workspace names are a root-level concern. Pass the environment as a variable instead.

**Exposing too many knobs.** Not every resource argument needs a corresponding variable. Start with the settings that actually vary between environments. You can always add more variables later — removing them is a breaking change.

**Skipping `description` on variables and outputs.** Six months from now, `variable "enable_thing"` with no description is a mystery. Two seconds of typing saves hours of archaeology.

## Summary

Building reusable Terraform modules comes down to treating infrastructure code with the same discipline you apply to application code:

- **Single responsibility** — one module, one concern
- **Clear interfaces** — typed variables with descriptions, validation, and sensible defaults
- **Complete outputs** — expose everything consumers need
- **Strict versioning** — semantic versions, pinned references, no floating branches
- **Composition** — small modules wired together, not monoliths
- **Testing at every layer** — from `terraform validate` to full integration tests
- **Automated documentation** — generated from code, never stale

Start with these practices on your next module, even if it feels like overkill for something small. The habits compound, and six months from now your team will thank you when they can spin up a new environment by composing existing, tested building blocks instead of copy-pasting and praying.

To generate the OG image for this post, run:

```bash
npm run generate:images:parallel
npm run convert:svg-to-png:parallel
```
