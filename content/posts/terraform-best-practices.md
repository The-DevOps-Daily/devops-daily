---
title: 'Terraform Infrastructure as Code Best Practices'
excerpt: 'Terraform best practices for writing scalable, maintainable infrastructure as code - covering directory structure, state management, modules, and security.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2024-06-08'
publishedAt: '2024-06-08T08:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - IaC
  - Cloud
  - Best Practices
  - Infrastructure as Code
featured: true
---

Terraform has become the industry standard for infrastructure as code (IaC), allowing teams to provision and manage cloud resources through declarative configuration files. However, as your infrastructure grows, maintaining Terraform code can become challenging without following proper practices.

In this guide, you'll learn practical, battle-tested best practices for organizing, writing, and managing Terraform code that scales with your infrastructure needs.

## Use a Consistent Directory Structure

Organize your Terraform code with a logical directory structure to enhance maintainability:

```
terraform-project/
├── environments/
│   ├── dev/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── terraform.tfvars
│   ├── staging/
│   └── production/
├── modules/
│   ├── networking/
│   ├── compute/
│   └── database/
└── .gitignore
```

This structure separates your environments from your reusable modules, allowing for clear organization and consistent deployments across environments.

## Split Resources into Logical Modules

Instead of defining all resources in a single file, organize them into logical modules:

```terraform
# modules/networking/main.tf
resource "aws_vpc" "main" {
  cidr_block = var.vpc_cidr

  tags = {
    Name        = "${var.project}-vpc"
    Environment = var.environment
    Terraform   = "true"
  }
}

resource "aws_subnet" "public" {
  count             = length(var.public_subnet_cidrs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.public_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name        = "${var.project}-public-subnet-${count.index}"
    Environment = var.environment
    Terraform   = "true"
  }
}

# Additional networking resources...
```

Each module should represent a logical component of your infrastructure and handle a specific concern. This approach makes your code more maintainable and reusable.

## Use Variables for Configuration

Define variables for all configurable parameters to make your modules flexible:

```terraform
# modules/database/variables.tf
variable "instance_class" {
  description = "The instance type of the RDS instance"
  type        = string
  default     = "db.t3.micro"
}

variable "allocated_storage" {
  description = "The allocated storage in gigabytes"
  type        = number
  default     = 20
}

variable "engine_version" {
  description = "The engine version to use"
  type        = string
  default     = "13.7"
}

variable "database_name" {
  description = "The name of the database to create"
  type        = string
}

variable "environment" {
  description = "The deployment environment (dev, staging, prod)"
  type        = string
}
```

Always include a description, type, and (when appropriate) a default value for each variable. This documentation helps other team members understand the purpose and requirements of each parameter.

## Implement Consistent Naming and Tagging Conventions

Consistent naming and tagging greatly improve resource management and organization:

```terraform
# Create a standardized tagging function
locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    Owner       = var.team
    ManagedBy   = "Terraform"
  }
}

resource "aws_s3_bucket" "logs" {
  bucket = "${var.project_name}-${var.environment}-logs"

  tags = merge(local.common_tags, {
    Name        = "${var.project_name}-${var.environment}-logs"
    Description = "Bucket for application logs"
  })
}
```

Define a standard naming pattern for each resource type and consistently apply it throughout your infrastructure. This makes resources easily identifiable and simplifies operations and troubleshooting.

## Use Data Sources to Reference External Resources

Use data sources instead of hardcoding values when referencing existing resources:

```terraform
# Instead of hardcoding AMI IDs
data "aws_ami" "ubuntu" {
  most_recent = true

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-focal-20.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  owners = ["099720109477"] # Canonical's AWS account ID
}

resource "aws_instance" "web" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.instance_type

  # Other instance configuration...
}
```

This makes your code more flexible and easier to maintain as external resources change over time.

## Keep Your Backend Configuration Consistent

Store your Terraform state in a remote backend with proper locking to enable team collaboration:

```terraform
# environments/dev/backend.tf
terraform {
  backend "s3" {
    bucket         = "company-terraform-states"
    key            = "dev/terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "terraform-state-locks"
  }
}
```

Use a consistent pattern for state file paths across environments. For example:

- `dev/terraform.tfstate`
- `staging/terraform.tfstate`
- `production/terraform.tfstate`

## Version Your Providers and Modules

Always specify versions for providers and modules to ensure reproducible infrastructure:

```terraform
terraform {
  required_version = ">= 1.0.0, < 2.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.16.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 3.18.0"
    }
  }
}
```

For modules, specify versions in the source attribute:

```terraform
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "3.14.0"

  # Module parameters...
}
```

This prevents unexpected changes when new provider or module versions are released.

## Use Loops and Conditionals for DRY Code

Use Terraform's `for_each`, `count`, and conditional expressions to avoid repetitive code:

```terraform
# Create multiple similar resources
resource "aws_security_group_rule" "ingress" {
  for_each = {
    http  = { port = 80, cidr = ["0.0.0.0/0"] }
    https = { port = 443, cidr = ["0.0.0.0/0"] }
    ssh   = { port = 22, cidr = ["10.0.0.0/8"] }
  }

  type              = "ingress"
  security_group_id = aws_security_group.web.id

  from_port   = each.value.port
  to_port     = each.value.port
  protocol    = "tcp"
  cidr_blocks = each.value.cidr

  description = "Allow ${each.key} traffic"
}

# Conditional resource creation
resource "aws_route53_record" "www" {
  count = var.create_dns_record ? 1 : 0

  zone_id = var.zone_id
  name    = "www.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.cdn.domain_name
    zone_id                = aws_cloudfront_distribution.cdn.hosted_zone_id
    evaluate_target_health = false
  }
}
```

This approach makes your code more concise and easier to maintain.

## Implement Automated Testing

Add automated tests to validate your Terraform code before deploying:

```terraform
# testing/main.tf
module "test_vpc" {
  source = "../../modules/networking"

  project     = "test"
  environment = "dev"
  vpc_cidr    = "10.0.0.0/16"

  # Other required variables...
}

# Output test results
output "validation" {
  value = {
    vpc_created = module.test_vpc.vpc_id != ""
    num_subnets = length(module.test_vpc.subnet_ids)
  }
}
```

Use tools like Terratest, kitchen-terraform, or simple shell scripts to test your configurations. Automated testing helps catch issues early and builds confidence in your infrastructure changes.

## Use Workspaces Wisely

Terraform workspaces can be helpful for managing small variations, but they're not a substitute for proper environment separation:

```bash
# Better approach for managing environments
# Each environment has its own directory and state file
$ cd environments/dev
$ terraform apply

# Less ideal approach using workspaces
# All environments share module code but have different state files
$ terraform workspace select dev
$ terraform apply
```

For production infrastructure, prefer separate environment directories with their own state files over workspaces.

## Secure Your Terraform Configuration

Always follow security best practices:

1. Store sensitive values in secure variable sources:

```terraform
# Use variables for sensitive values, DON'T hardcode them
variable "database_password" {
  description = "Password for database access"
  type        = string
  sensitive   = true
}

# Reference from environment variables or secure input
# TF_VAR_database_password="secure-password" terraform apply
```

2. Use IAM roles with least privilege principles for Terraform execution

3. Implement appropriate security groups and network ACLs:

```terraform
resource "aws_security_group" "database" {
  name        = "${var.project}-${var.environment}-db-sg"
  description = "Security group for database instances"
  vpc_id      = var.vpc_id

  # Only allow access from application servers on the database port
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.app_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

## Document Your Infrastructure

Add meaningful comments and documentation to your Terraform code:

```terraform
# modules/database/README.md
# Database Module

This module provisions an RDS PostgreSQL database with appropriate security groups
and backup configurations.
```

## Usage

```terraform
module "database" {
  source = "../modules/database"

  project      = "ecommerce"
  environment  = "production"
  instance_class = "db.r5.large"

  # See variables.tf for all available options
}
```

## Inputs

| Name              | Description                 | Type     | Default         | Required |
| ----------------- | --------------------------- | -------- | --------------- | :------: |
| instance_class    | The RDS instance type       | `string` | `"db.t3.micro"` |    no    |
| allocated_storage | The allocated storage in GB | `number` | `20`            |    no    |
| ...               | ...                         | ...      | ...             |   ...    |

## Outputs

| Name                 | Description                              |
| -------------------- | ---------------------------------------- |
| db_instance_endpoint | The connection endpoint for the database |
| db_instance_id       | The RDS instance ID                      |

Good documentation helps team members understand how to use your modules and reduces the learning curve.

## Implement a CI/CD Pipeline

Automate your Terraform workflow with CI/CD:

1. Validate syntax and format on pull requests
2. Run `terraform plan` to check for potential changes
3. Apply changes automatically (after approval)

Example GitHub Actions workflow:

```yaml
name: 'Terraform CI/CD'

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

jobs:
  terraform:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v3

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v2
        with:
          terraform_version: 1.2.3

      - name: Terraform Format
        id: fmt
        run: terraform fmt -check -recursive

      - name: Terraform Init
        id: init
        run: |
          cd environments/dev
          terraform init

      - name: Terraform Validate
        id: validate
        run: |
          cd environments/dev
          terraform validate -no-color

      - name: Terraform Plan
        id: plan
        if: github.event_name == 'pull_request'
        run: |
          cd environments/dev
          terraform plan -no-color
        continue-on-error: true

      # Add approval and apply steps for production environments
```

This helps ensure that your Terraform changes are properly reviewed and tested before deployment.

## Conclusion

Following these best practices will help you create Terraform code that is maintainable, scalable, and secure. Remember that infrastructure as code is not just about automating deployments, it's about creating infrastructure that can evolve with your needs while maintaining reliability and security.

Start by implementing these practices incrementally in your existing projects. Focus first on modularization, consistent naming, and proper state management, then gradually adopt the more advanced practices like automated testing and CI/CD integration.

Happy infrastructure building!
