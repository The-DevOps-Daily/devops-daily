---
title: 'How to Organize Terraform Modules for Multiple Environments'
excerpt: 'Learn effective patterns for structuring Terraform modules to manage dev, staging, and production environments without duplicating code.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2025-03-18'
publishedAt: '2025-03-18T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Modules
  - DevOps
  - Infrastructure as Code
---

## TLDR

Organize Terraform modules by keeping reusable, focused modules in a central `modules/` folder and placing environment-specific composition and configuration under `environments/` (or `live/`). Use variables and tfvars files to customize behavior, keep state backends separate per environment, version your modules, and test changes in isolated environments before promoting to production.

Good organization prevents duplicated code, reduces accidental cross-environment changes, and makes collaboration easier. Below you'll find a practical layout, concrete examples, and recommended workflows you can adapt to AWS, Azure, or GCP.

Why this matters - poorly organized Terraform leads to copy-pasted modules, hard-to-track state, and risky production changes. The patterns here help you scale safely.

## Recommended repository layout

Use a clear separation between reusable modules and environment-specific configurations.

```
terraform/
├── modules/           # reusable modules: vpc, ecs, rds, iam
│   ├── vpc/
│   ├── ec2/
│   └── rds/
├── environments/      # environment compositions and backends
│   ├── dev/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── terraform.tfvars
│   ├── staging/
│   └── prod/
└── shared/            # optional shared configs (backend configs, providers)
```

This clear separation keeps modules focused and makes environment-level decision-making explicit.

## Design modules for reuse and clarity

A good module has a single responsibility, well-documented inputs and outputs, and sensible defaults. Avoid embedding provider or backend configuration inside modules - keep those at the environment level.

Example - a concise VPC module (core parts only):

Before the code: this module creates a VPC and subnets. It accepts parameterized CIDRs and availability zones so each environment can pass different networks.

```hcl
# modules/vpc/main.tf
resource "aws_vpc" "this" {
  cidr_block = var.vpc_cidr
  tags = {
    Name = "${var.environment}-vpc"
  }
}

resource "aws_subnet" "public" {
  count = length(var.public_subnet_cidrs)
  vpc_id = aws_vpc.this.id
  cidr_block = var.public_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]
  tags = { Name = "${var.environment}-public-${count.index + 1}" }
}
```

Explain why: keep resource logic simple and expose only the variables consumers need. That makes the module reusable in different regions and environments.

Also include variables and outputs in the module so environment compositions can wire things together.

```hcl
# modules/vpc/variables.tf
variable "environment" { type = string }
variable "vpc_cidr" { type = string }
variable "public_subnet_cidrs" { type = list(string) }
variable "availability_zones" { type = list(string) }

# modules/vpc/outputs.tf
output "vpc_id" { value = aws_vpc.this.id }
output "public_subnet_ids" { value = aws_subnet.public[*].id }
```

## Compose environments from modules

Each environment directory contains the Terraform root that composes modules and configures providers and backends. This is where you choose sizes, counts, and other environment-specific settings.

Before the code: the following `main.tf` shows how the dev environment composes the VPC module and configures a remote S3 backend.

```hcl
# environments/dev/main.tf
terraform {
  backend "s3" {
    bucket = "company-terraform-state"
    key    = "dev/terraform.tfstate"
    region = "us-west-2"
  }
}

provider "aws" { region = var.aws_region }

module "vpc" {
  source = "../../modules/vpc"
  environment = "dev"
  vpc_cidr = var.vpc_cidr
  public_subnet_cidrs = var.public_subnet_cidrs
  availability_zones = var.availability_zones
}
```

Use a `variables.tf` and `terraform.tfvars` in the environment folder to hold values unique to that environment. That keeps the module generic and the environment-specific choices easy to review.

## Use tfvars and variable files for environment differences

Before the code: `terraform.tfvars` holds concrete values for a given environment so `terraform plan` and `apply` use those inputs automatically.

```hcl
# environments/dev/terraform.tfvars
aws_region = "us-west-2"
vpc_cidr = "10.0.0.0/16"
public_subnet_cidrs = ["10.0.1.0/24","10.0.2.0/24"]
availability_zones = ["us-west-2a","us-west-2b"]
```

This pattern avoids embedding environment values in modules and makes it easy to change an environment by editing a single file.

## Keep state isolated per environment

Before the code: remote state backends should use unique keys per environment so state is not shared accidentally.

```hcl
# environments/prod/main.tf (backend snippet)
terraform {
  backend "s3" {
    bucket = "company-terraform-state"
    key    = "prod/terraform.tfstate"
    region = "us-west-2"
  }
}
```

Make sure your CI runs operate in the correct environment directory and use the matching backend configuration so production state cannot be modified from development runs.

## Version and test modules

- Version modules with Git tags and reference them via source = "git::ssh://...//modules/vpc?ref=v1.2.0" when you want stable, pinned behavior.
- Keep an `examples/` or `test/` folder where you can instantiate modules in isolation for testing.
- Use unit and integration test tools like Terratest to validate module behavior where appropriate.

## Workflows and quick commands

Before the code: example local workflow for deploying to dev. Run these commands from the environment folder.

```bash
cd terraform/environments/dev
terraform init
terraform plan -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars
```

For CI, run the same steps but make sure the runner checks out the correct git ref for modules and uses automation accounts with limited privileges.

## Alternatives and when to use workspaces

Workspaces can be useful for small projects or when environments are nearly identical and you prefer a single root. However, workspaces share the same configuration and can lead to accidental cross-environment changes if you are not careful. For teams and complex environments, separate environment folders are safer.

## Practical tips and naming conventions

- Prefix resource names or tags with the environment name so you can identify resources quickly, for example `dev-db-01`.
- Keep modules small and focused - one responsibility per module.
- Document expected inputs and outputs in a `README.md` inside each module.
- Use consistent variable names across modules to reduce mental overhead.

```
      Modules
  ┌─────────────┐
  │ vpc   ec2   │
  │ rds   iam   │
  └────┬────────┘
       │
  ┌────▼────┐  ┌─────────┐  ┌────────┐
  │ dev     │  │ staging │  │ prod   │
  │ (env)   │  │ (env)   │  │ (env)  │
  └─────────┘  └─────────┘  └────────┘
```

## Short practical conclusion

Start by extracting repeated resources into modules, then create an environment folder for each deployment target and move backend and provider configuration there. Test changes in dev or staging, pin module versions, and promote changes to production only after validation.

Next steps you can explore: add automated validation with Terratest, include policy checks with Sentinel or OPA, and wire Terraform runs into a CI/CD pipeline for safe promotions.
