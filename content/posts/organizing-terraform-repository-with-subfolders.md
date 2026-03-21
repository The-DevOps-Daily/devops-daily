---
title: 'How to Organize a Terraform Repository with Multiple Subfolders'
excerpt: "Learn how to structure a Terraform repository with multiple environments, modules, and configurations in a way that scales with your infrastructure needs."
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2024-12-05'
publishedAt: '2024-12-05T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Infrastructure as Code
  - Best Practices
  - DevOps
  - Repository Structure
---

As your infrastructure grows, keeping all your Terraform code in a single directory becomes unwieldy. You'll want to separate environments, create reusable modules, and organize configurations logically. But there's no single "correct" way to structure a Terraform repository - the right approach depends on your team size, infrastructure complexity, and deployment workflow.

This guide walks through several proven patterns for organizing Terraform repositories, from simple environment separation to full module-based architectures.

**TLDR:** Structure your Terraform repository based on your infrastructure scale and team workflow. For smaller projects, separate environments into folders with shared modules. For larger projects, use a monorepo with environment-specific folders or split environments into separate repositories. Always keep reusable infrastructure components in modules, use consistent naming conventions, and avoid duplicating code across environments.

## The Basic Multi-Environment Structure

The most common starting point is organizing by environment. This works well for small to medium-sized projects where you have distinct deployment environments like development, staging, and production.

```
terraform-infrastructure/
├── environments/
│   ├── dev/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── terraform.tfvars
│   ├── staging/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── terraform.tfvars
│   └── prod/
│       ├── main.tf
│       ├── variables.tf
│       ├── outputs.tf
│       └── terraform.tfvars
├── modules/
│   ├── networking/
│   ├── database/
│   └── application/
└── README.md
```

Each environment folder contains its own Terraform configuration that references shared modules. This keeps environment-specific values separate while reusing common infrastructure patterns.

Here's what a typical environment configuration looks like:

```hcl
# environments/prod/main.tf

terraform {
  backend "s3" {
    bucket = "company-terraform-state"
    key    = "prod/terraform.tfstate"
    region = "us-east-1"
  }
}

module "networking" {
  source = "../../modules/networking"

  vpc_cidr = var.vpc_cidr
  environment = "prod"
  availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

module "database" {
  source = "../../modules/database"

  vpc_id = module.networking.vpc_id
  subnet_ids = module.networking.private_subnet_ids
  instance_class = "db.r6g.xlarge"
  environment = "prod"
}
```

The `terraform.tfvars` file in each environment holds environment-specific values:

```hcl
# environments/prod/terraform.tfvars

vpc_cidr = "10.0.0.0/16"
environment = "prod"
db_instance_count = 3
enable_backup = true
```

This separation means you can modify production settings without touching development, and vice versa. Each environment manages its own state file, reducing the risk of accidentally affecting the wrong infrastructure.

## Organizing by Resource Type

For teams managing complex infrastructure, grouping by resource type or service can make more sense than environment-based separation. This is common when different teams own different parts of the infrastructure.

```
terraform-infrastructure/
├── networking/
│   ├── vpc/
│   ├── subnets/
│   └── security-groups/
├── compute/
│   ├── ec2/
│   ├── autoscaling/
│   └── load-balancers/
├── data/
│   ├── rds/
│   ├── elasticache/
│   └── s3/
└── security/
    ├── iam/
    ├── kms/
    └── secrets-manager/
```

Each folder contains Terraform configurations for that specific service or resource type. Inside each folder, you might have separate files for different environments:

```hcl
# networking/vpc/main.tf

resource "aws_vpc" "main" {
  for_each = var.environments

  cidr_block = each.value.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support = true

  tags = {
    Name = "${each.key}-vpc"
    Environment = each.key
  }
}
```

This approach works well when you have:
- Multiple teams managing different infrastructure layers
- Resources that span multiple environments but need centralized management
- Infrastructure that doesn't fit the traditional dev/staging/prod model

The trade-off is that changes affecting multiple resource types require coordinating across multiple directories.

## The Module-Centric Approach

As your infrastructure matures, you'll want to create reusable modules that encapsulate common patterns. This structure emphasizes modules as first-class components:

```
terraform-infrastructure/
├── live/
│   └── prod/
│       ├── us-east-1/
│       │   ├── vpc/
│       │   │   └── terragrunt.hcl
│       │   ├── eks/
│       │   │   └── terragrunt.hcl
│       │   └── rds/
│       │       └── terragrunt.hcl
│       └── eu-west-1/
│           └── vpc/
│               └── terragrunt.hcl
└── modules/
    ├── vpc/
    │   ├── main.tf
    │   ├── variables.tf
    │   └── outputs.tf
    ├── eks-cluster/
    │   ├── main.tf
    │   ├── variables.tf
    │   └── outputs.tf
    └── rds-postgres/
        ├── main.tf
        ├── variables.tf
        └── outputs.tf
```

This example uses Terragrunt, but the principle applies to plain Terraform too. Each module is a self-contained unit that gets instantiated in specific environments and regions.

A module represents a logical grouping of resources that should be deployed together:

```hcl
# modules/vpc/main.tf

resource "aws_vpc" "this" {
  cidr_block = var.cidr_block
  enable_dns_hostnames = var.enable_dns_hostnames
  enable_dns_support = var.enable_dns_support

  tags = merge(
    var.tags,
    {
      Name = var.vpc_name
    }
  )
}

resource "aws_subnet" "private" {
  count = length(var.private_subnet_cidrs)

  vpc_id = aws_vpc.this.id
  cidr_block = var.private_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = merge(
    var.tags,
    {
      Name = "${var.vpc_name}-private-${count.index + 1}"
      Type = "private"
    }
  )
}

resource "aws_subnet" "public" {
  count = length(var.public_subnet_cidrs)

  vpc_id = aws_vpc.this.id
  cidr_block = var.public_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = merge(
    var.tags,
    {
      Name = "${var.vpc_name}-public-${count.index + 1}"
      Type = "public"
    }
  )
}
```

The corresponding variables file defines the module's interface:

```hcl
# modules/vpc/variables.tf

variable "cidr_block" {
  description = "CIDR block for the VPC"
  type        = string
}

variable "vpc_name" {
  description = "Name of the VPC"
  type        = string
}

variable "availability_zones" {
  description = "List of availability zones to create subnets in"
  type        = list(string)
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
}

variable "enable_dns_hostnames" {
  description = "Enable DNS hostnames in the VPC"
  type        = bool
  default     = true
}

variable "enable_dns_support" {
  description = "Enable DNS support in the VPC"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
```

Then you instantiate the module in your environment-specific configuration:

```hcl
# live/prod/us-east-1/vpc/main.tf

module "vpc" {
  source = "../../../../modules/vpc"

  vpc_name = "production-vpc"
  cidr_block = "10.0.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]

  private_subnet_cidrs = [
    "10.0.1.0/24",
    "10.0.2.0/24",
    "10.0.3.0/24"
  ]

  public_subnet_cidrs = [
    "10.0.101.0/24",
    "10.0.102.0/24",
    "10.0.103.0/24"
  ]

  tags = {
    Environment = "production"
    ManagedBy = "terraform"
    Team = "platform"
  }
}
```

This pattern keeps your modules generic and reusable while maintaining environment-specific configurations in the `live` directory.

## Mono-Repo vs Multi-Repo

You'll eventually need to decide whether to keep all infrastructure code in one repository (mono-repo) or split it across multiple repositories.

A mono-repo structure looks like:

```
terraform-infrastructure/
├── .github/
│   └── workflows/
│       ├── dev-deploy.yml
│       ├── staging-deploy.yml
│       └── prod-deploy.yml
├── environments/
│   ├── dev/
│   ├── staging/
│   └── prod/
├── modules/
└── scripts/
```

Benefits of mono-repo:
- Single source of truth for all infrastructure
- Easier to share modules and maintain consistency
- Simplified dependency management
- One place for CI/CD configuration

The multi-repo approach separates concerns:

```
Company GitHub Organization:
├── terraform-modules/           (Shared, versioned modules)
├── terraform-networking/        (Network infrastructure)
├── terraform-security/          (IAM, KMS, security groups)
├── terraform-data/             (Databases, caches)
└── terraform-applications/     (App-specific infrastructure)
```

Benefits of multi-repo:
- Better access control (different teams own different repos)
- Independent versioning and release cycles
- Smaller repositories are easier to navigate
- Reduced blast radius when things go wrong

For most teams starting out, a mono-repo is simpler. You can always split it later if access control or team boundaries require it.

## Managing Shared Configuration

Regardless of your folder structure, you'll have configuration that needs to be shared across environments. Here are common patterns for handling this.

Use a `shared` or `common` folder for variables that apply everywhere:

```hcl
# shared/tags.tf

locals {
  common_tags = {
    ManagedBy = "terraform"
    Team = "platform"
    Repository = "terraform-infrastructure"
  }
}
```

Reference it from your environment configurations:

```hcl
# environments/prod/main.tf

locals {
  environment_tags = {
    Environment = "production"
    CostCenter = "engineering"
  }

  # Merge common tags with environment-specific ones
  tags = merge(
    local.common_tags,
    local.environment_tags
  )
}
```

For provider configuration, consider using a shared `provider.tf` that gets symlinked or copied:

```hcl
# shared/provider.tf

terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}
```

## Naming Conventions and File Organization

Consistent naming makes navigation easier across a large codebase. Here's a pattern that works well:

Within each configuration directory:
- `main.tf` - Primary resource definitions
- `variables.tf` - Input variable declarations
- `outputs.tf` - Output value declarations
- `versions.tf` - Terraform and provider version constraints
- `data.tf` - Data source definitions
- `locals.tf` - Local value definitions

For larger configurations, split resources into logical files:

```
environments/prod/
├── main.tf              # Core infrastructure setup
├── networking.tf        # VPC, subnets, routing
├── compute.tf          # EC2, ASG, ECS
├── database.tf         # RDS, ElastiCache
├── security.tf         # Security groups, IAM
├── monitoring.tf       # CloudWatch, alarms
├── variables.tf
├── outputs.tf
└── versions.tf
```

This makes it easier to find resources and reduces merge conflicts when multiple people work on the same environment.

Module names should clearly describe what they create:

```
modules/
├── vpc-with-nat/
├── eks-cluster/
├── rds-postgres-ha/
├── s3-static-website/
└── cloudfront-distribution/
```

Avoid generic names like `network` or `database`. Be specific about what the module provisions.

## Handling Secrets and Sensitive Values

Never commit secrets directly to your repository. Use one of these patterns instead.

Reference secrets from a secret management system:

```hcl
# environments/prod/main.tf

data "aws_secretsmanager_secret_version" "db_password" {
  secret_id = "prod/database/master-password"
}

module "database" {
  source = "../../modules/rds-postgres"

  master_password = data.aws_secretsmanager_secret_version.db_password.secret_string
  # ... other configuration
}
```

For local development, use a `.tfvars` file that's excluded from version control:

```bash
# .gitignore
*.tfvars
!terraform.tfvars.example
.terraform/
```

Provide an example file that shows the expected structure:

```hcl
# terraform.tfvars.example

db_username = "admin"
db_password = "CHANGE_ME"
api_key = "CHANGE_ME"
```

Team members copy this to `terraform.tfvars` and fill in their actual values.

## Scaling Your Structure Over Time

Start simple and add complexity only when needed. A single-folder configuration is fine for small projects. As you grow:

1. Separate environments when you have more than one deployment target
2. Extract modules when you're duplicating resource blocks across environments
3. Split by resource type when different teams manage different infrastructure layers
4. Move to multi-repo when access control or team autonomy requires it

Your folder structure isn't permanent. Terraform makes it relatively easy to refactor by moving configurations and updating module sources. The important part is having a structure that your team understands and can navigate efficiently.
