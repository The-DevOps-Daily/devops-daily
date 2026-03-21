---
title: 'terraform.tfvars vs variables.tf: What is the Difference?'
excerpt: 'Understand the difference between terraform.tfvars and variables.tf in Terraform and how to use them effectively.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2025-01-20'
publishedAt: '2025-01-20T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Variables
  - Configuration Management
  - DevOps
---

## TLDR

The `variables.tf` file defines input variables and their types, while the `terraform.tfvars` file provides values for those variables. Use `variables.tf` for declarations and `terraform.tfvars` for environment-specific values.

---

Terraform uses variables to make configurations dynamic and reusable. Two common files for managing variables are `variables.tf` and `terraform.tfvars`. This guide will explain the difference between these files and how to use them effectively.

### What is `variables.tf`?

The `variables.tf` file is used to declare input variables and their types. It defines the structure and constraints for variables.

#### Example: `variables.tf`

Generally, `variables.tf` contains variable declarations with descriptions and types. Here's a simple example:

```hcl
variable "region" {
  description = "The AWS region to deploy resources in."
  type        = string
}

variable "instance_type" {
  description = "The type of EC2 instance."
  type        = string
  default     = "t2.micro"
}
```

### What is `terraform.tfvars`?

The `terraform.tfvars` file is used to provide values for the variables declared in `variables.tf`. It is typically used for environment-specific configurations.

#### Example: `terraform.tfvars`

A `terraform.tfvars` file contains key-value pairs that correspond to the variables declared in `variables.tf`. Here's an example:

```hcl
region         = "us-east-1"
instance_type  = "t3.medium"
```

### Key Differences

| Feature              | `variables.tf`                     | `terraform.tfvars`            |
| -------------------- | ---------------------------------- | ----------------------------- |
| Purpose              | Declares variables and their types | Provides values for variables |
| Required in Project  | Yes                                | No                            |
| Environment-Specific | No                                 | Yes                           |
| Default Values       | Can define defaults                | Overrides defaults            |

### How Terraform Uses These Files

1. **Declaration**: Terraform reads `variables.tf` to understand the variables and their constraints.
2. **Value Assignment**: Terraform reads `terraform.tfvars` to assign values to the variables.
3. **Override**: Command-line flags or environment variables can override values in `terraform.tfvars`.

### Best Practices

- **Use `variables.tf` for Declarations**: Keep all variable declarations in `variables.tf` for consistency.
- **Use `terraform.tfvars` for Environment-Specific Values**: Store values that change between environments in `terraform.tfvars`.
- **Avoid Hardcoding**: Do not hardcode values in `variables.tf`. Use `terraform.tfvars` or other methods to provide values.
- **Document Variables**: Add descriptions to all variables in `variables.tf` for better maintainability.

By understanding the difference between `variables.tf` and `terraform.tfvars`, you can manage variables in Terraform more effectively, making your configurations dynamic and reusable.
