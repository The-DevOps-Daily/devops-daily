---
title: 'Managing Different Environments in Terraform'
excerpt: 'Learn how to manage different environments in Terraform using workspaces, variable files, and directory structures.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2025-01-30'
publishedAt: '2025-01-30T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Environments
  - Configuration Management
  - DevOps
---

## TLDR

To manage different environments in Terraform, use workspaces, variable files, or separate directory structures. Each approach has its pros and cons, so choose the one that best fits your workflow.

---

Managing different environments, such as development, staging, and production, is a common requirement in Terraform projects. This guide will show you how to handle multiple environments effectively.

### Why Manage Different Environments?

- **Isolation**: Keep resources for different environments separate.
- **Flexibility**: Use different configurations for each environment.
- **Collaboration**: Enable teams to work on multiple environments simultaneously.

### Approach 1: Using Workspaces

Terraform workspaces allow you to manage multiple environments within a single configuration.

#### Example: Creating Workspaces

To create workspaces for different environments, use the following commands:

```bash
terraform workspace new dev
terraform workspace new staging
terraform workspace new prod
```

#### Example: Using Workspaces in Configuration

To reference the current workspace in your configuration, you can use the `terraform.workspace` variable. This allows you to customize resource names or configurations based on the active workspace.

```hcl
resource "aws_s3_bucket" "example" {
  bucket = "example-bucket-${terraform.workspace}"
  acl    = "private"
}
```

### Approach 2: Using Variable Files

Use separate variable files for each environment and specify them with the `-var-file` flag.

#### Example: Variable Files

Create variable files for each environment, such as `dev.tfvars`, `staging.tfvars`, and `prod.tfvars`.

`dev.tfvars`:

```hcl
region = "us-east-1"
instance_type = "t2.micro"
```

`prod.tfvars`:

```hcl
region = "us-west-2"
instance_type = "t3.large"
```

#### Example: Applying Configuration

To apply the configuration for a specific environment, use the `-var-file` option:

```bash
terraform apply -var-file=dev.tfvars
terraform apply -var-file=prod.tfvars
```

### Approach 3: Using Directory Structures

Organize your configurations into separate directories for each environment.

#### Example: Directory Structure

A common approach is to create a directory for each environment, each containing its own `main.tf`, `variables.tf`, and `terraform.tfvars` files.

```
terraform-project/
├── dev/
│   ├── main.tf
│   ├── variables.tf
│   └── terraform.tfvars
├── staging/
│   ├── main.tf
│   ├── variables.tf
│   └── terraform.tfvars
└── prod/
    ├── main.tf
    ├── variables.tf
    └── terraform.tfvars
```

### Best Practices

- **Use Remote State**: Store state files in a remote backend to avoid conflicts.
- **Document Configurations**: Clearly document the purpose of each environment.
- **Test Changes**: Validate changes in non-production environments before applying them to production.

By using these approaches, you can effectively manage different environments in Terraform, ensuring isolation and flexibility for your infrastructure.
