---
title: 'How to Share Providers and Variables Across Terraform Modules'
excerpt: "Learn the right way to configure providers and pass variables when working with Terraform modules, avoiding common pitfalls with provider inheritance and variable scoping."
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2025-03-20'
publishedAt: '2025-03-20T08:30:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Infrastructure as Code
  - Modules
  - Best Practices
  - DevOps
---

When you start building reusable Terraform modules, one of the first challenges you'll face is figuring out how providers and variables work across module boundaries. The way Terraform handles provider configuration in modules has evolved over time, and there are some important patterns you need to know to avoid errors and build maintainable infrastructure code.

This guide covers the recommended approaches for sharing providers and passing variables to modules, along with common mistakes to avoid.

**TLDR:** Providers are automatically inherited by child modules in Terraform, so you don't need to declare provider blocks inside modules unless you need custom configuration. For variables, explicitly pass them from the root to each module - there's no automatic sharing. Use `required_providers` in modules to document which providers they need, and use configuration aliases when a module needs multiple configurations of the same provider (like deploying to multiple AWS regions).

## How Provider Inheritance Works

By default, Terraform passes provider configurations from your root module down to any child modules you call. This means if you configure the AWS provider in your root `main.tf`, all modules you reference will automatically use that same provider configuration.

```hcl
# Root module main.tf

provider "aws" {
  region = "us-east-1"
}

module "networking" {
  source = "./modules/vpc"
  # This module automatically uses the AWS provider configured above
  vpc_cidr = "10.0.0.0/16"
}

module "database" {
  source = "./modules/rds"
  # This module also uses the same AWS provider
  subnet_ids = module.networking.private_subnet_ids
}
```

Both the `networking` and `database` modules will create resources in `us-east-1` without needing their own provider blocks. This is the most common and recommended pattern.

Inside the module, you don't need a provider block at all:

```hcl
# modules/vpc/main.tf

# No provider block needed - inherited from root

resource "aws_vpc" "this" {
  cidr_block = var.vpc_cidr
  enable_dns_hostnames = true
}

resource "aws_subnet" "private" {
  count = 3
  vpc_id = aws_vpc.this.id
  cidr_block = cidrsubnet(var.vpc_cidr, 8, count.index)
}
```

The module works with whatever provider configuration the calling module (root module) provides.

## Declaring Required Providers in Modules

Even though providers are inherited, it's good practice to declare which providers your module expects using a `required_providers` block. This serves as documentation and helps Terraform understand version requirements:

```hcl
# modules/vpc/versions.tf

terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}
```

This tells anyone using your module:
- Which provider(s) the module needs
- The minimum version required
- Where to find the provider (the source)

The actual provider configuration still comes from the root module, but this declaration ensures version compatibility.

## Passing Variables to Modules

Unlike providers, variables are never automatically shared between modules. Each module has its own isolated variable scope, and you must explicitly pass values when calling a module.

```hcl
# Root module main.tf

variable "environment" {
  type = string
}

variable "vpc_cidr" {
  type = string
}

module "networking" {
  source = "./modules/vpc"

  # Explicitly pass each variable the module needs
  environment = var.environment
  vpc_cidr = var.vpc_cidr
}
```

The module declares which variables it accepts:

```hcl
# modules/vpc/variables.tf

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
}
```

This explicit passing might feel redundant, but it makes dependencies clear and keeps modules self-contained. You can see exactly what inputs each module requires just by looking at the module block.

## Pattern: Using Local Values to Reduce Repetition

When you're passing the same values to multiple modules, use local values to avoid repetition:

```hcl
# Root module main.tf

locals {
  common_tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
    Project     = "infrastructure"
  }

  region = "us-east-1"
}

module "networking" {
  source = "./modules/vpc"

  vpc_cidr = var.vpc_cidr
  region   = local.region
  tags     = local.common_tags
}

module "database" {
  source = "./modules/rds"

  vpc_id     = module.networking.vpc_id
  subnet_ids = module.networking.private_subnet_ids
  region     = local.region
  tags       = local.common_tags
}

module "application" {
  source = "./modules/ecs"

  vpc_id     = module.networking.vpc_id
  subnet_ids = module.networking.private_subnet_ids
  region     = local.region
  tags       = local.common_tags
}
```

This way you define values like `region` and `tags` once and reference them everywhere. If you need to change the region, you only update it in one place.

## Working With Multiple Provider Configurations

Sometimes a module needs to interact with multiple provider configurations. The most common example is creating resources in multiple AWS regions or AWS accounts.

Let's say you want to create a primary VPC in `us-east-1` and a DR VPC in `us-west-2`:

```hcl
# Root module main.tf

provider "aws" {
  alias  = "primary"
  region = "us-east-1"
}

provider "aws" {
  alias  = "dr"
  region = "us-west-2"
}

module "primary_vpc" {
  source = "./modules/vpc"

  providers = {
    aws = aws.primary
  }

  vpc_cidr = "10.0.0.0/16"
  environment = "prod"
}

module "dr_vpc" {
  source = "./modules/vpc"

  providers = {
    aws = aws.dr
  }

  vpc_cidr = "10.1.0.0/16"
  environment = "prod-dr"
}
```

The `providers` argument in the module block explicitly maps which provider configuration the module should use. Both modules use the same source code but create resources in different regions.

```
Root Module (main.tf)
    |
    |-- provider "aws" (alias: primary) --> us-east-1
    |-- provider "aws" (alias: dr)      --> us-west-2
    |
    |-- module "primary_vpc"
    |       |-- uses aws.primary
    |       `-- creates VPC in us-east-1
    |
    `-- module "dr_vpc"
            |-- uses aws.dr
            `-- creates VPC in us-west-2
```

The module itself doesn't need to know about aliases - it just uses the provider normally:

```hcl
# modules/vpc/main.tf

resource "aws_vpc" "this" {
  cidr_block = var.vpc_cidr
  # This will be created in whichever region the calling module specified
}
```

## Multi-Provider Modules

If your module needs to work with multiple providers simultaneously (not just multiple configurations of the same provider), declare them in the module's `required_providers`:

```hcl
# modules/dns-with-monitoring/versions.tf

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
    datadog = {
      source  = "datadog/datadog"
      version = ">= 3.0"
    }
  }
}
```

Then use both providers in the module:

```hcl
# modules/dns-with-monitoring/main.tf

resource "aws_route53_zone" "this" {
  name = var.domain_name
}

resource "datadog_monitor" "dns" {
  name    = "DNS health check for ${var.domain_name}"
  type    = "query alert"
  message = "DNS is not responding"
  query   = "avg(last_5m):avg:dns.response_time{domain:${var.domain_name}} > 1000"
}
```

When calling this module, make sure you've configured both providers in your root module:

```hcl
# Root module main.tf

provider "aws" {
  region = "us-east-1"
}

provider "datadog" {
  api_key = var.datadog_api_key
  app_key = var.datadog_app_key
}

module "dns_monitoring" {
  source = "./modules/dns-with-monitoring"

  domain_name = "example.com"
}
```

Both provider configurations are automatically inherited by the module.

## Variable Validation and Type Constraints

When designing modules, use variable validation to catch configuration errors early:

```hcl
# modules/vpc/variables.tf

variable "environment" {
  description = "Environment name"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block."
  }
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)

  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "At least 2 availability zones are required for high availability."
  }
}
```

These validations run when you call the module, providing clear error messages if someone passes invalid values. This is much better than getting cryptic errors from the provider later in the apply process.

## Sharing Provider Configuration Without Hard-Coding

Sometimes you want your module to be flexible about provider configuration but still provide sensible defaults. Use input variables for provider-specific settings:

```hcl
# modules/s3-bucket/variables.tf

variable "aws_region" {
  description = "AWS region where the bucket will be created"
  type        = string
  default     = null  # null means use the provider's default region
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
```

However, you cannot dynamically configure providers inside a module based on variables. This won't work:

```hcl
# This is INVALID - providers cannot use variables in the module

provider "aws" {
  region = var.aws_region  # ERROR: Cannot use variables here
}
```

Provider configuration must happen in the root module. If you need different configurations, use provider aliases as shown earlier.

## Module Outputs for Provider Information

When you need to pass provider-specific information between modules, use outputs:

```hcl
# modules/vpc/outputs.tf

output "vpc_id" {
  description = "ID of the created VPC"
  value       = aws_vpc.this.id
}

output "vpc_cidr" {
  description = "CIDR block of the VPC"
  value       = aws_vpc.this.cidr_block
}

output "private_subnet_ids" {
  description = "IDs of private subnets"
  value       = aws_subnet.private[*].id
}

output "aws_region" {
  description = "AWS region where resources were created"
  value       = data.aws_region.current.name
}
```

To get the current region, use a data source:

```hcl
# modules/vpc/data.tf

data "aws_region" "current" {}

data "aws_caller_identity" "current" {}
```

Then other modules can reference these outputs:

```hcl
# Root module main.tf

module "networking" {
  source = "./modules/vpc"
  vpc_cidr = "10.0.0.0/16"
}

module "database" {
  source = "./modules/rds"

  vpc_id     = module.networking.vpc_id
  subnet_ids = module.networking.private_subnet_ids

  # Use the same region as the VPC
  backup_region = module.networking.aws_region
}
```

This creates an explicit dependency chain that Terraform can track.

## Common Mistakes to Avoid

Don't declare provider blocks inside reusable modules unless you specifically need a hard-coded configuration. This makes the module less flexible:

```hcl
# BAD: Hard-coded provider in module

# modules/vpc/main.tf
provider "aws" {
  region = "us-east-1"  # Now this module can ONLY work in us-east-1
}
```

Instead, let the caller control the provider configuration and just use `required_providers` for documentation.

Don't assume variables from the root module are accessible in child modules:

```hcl
# BAD: This won't work

# Root module
variable "environment" {
  type = string
}

# Module trying to use root variable directly
resource "aws_vpc" "this" {
  tags = {
    Environment = var.environment  # ERROR: variable not declared in this module
  }
}
```

You must explicitly pass the variable to the module:

```hcl
# GOOD: Explicit passing

module "networking" {
  source = "./modules/vpc"
  environment = var.environment  # Pass it explicitly
}
```

Don't try to configure providers dynamically based on module variables. Providers must be configured in the root module before any modules are evaluated.

## Testing Module Behavior Across Providers

When developing modules, test them with different provider configurations to make sure they work correctly:

```hcl
# test/fixtures/main.tf

provider "aws" {
  region = "us-west-2"
}

module "test_vpc" {
  source = "../../modules/vpc"

  vpc_cidr = "10.99.0.0/16"
  environment = "test"
}

output "vpc_id" {
  value = module.test_vpc.vpc_id
}
```

Run this in a separate directory with `terraform plan` to verify the module behaves correctly without actually creating infrastructure.

Understanding provider inheritance and variable passing is essential for building clean, reusable Terraform modules. Keep providers configured at the root level, explicitly pass all variables that modules need, and use outputs to share information between modules. This keeps dependencies clear and makes your infrastructure code easier to maintain as it grows.
