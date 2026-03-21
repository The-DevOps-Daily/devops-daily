---
title: 'Modules + Output from for_each'
excerpt: 'Learn how to use for_each with modules in Terraform to dynamically create resources and manage outputs.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2024-02-18'
publishedAt: '2024-02-18T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Modules
  - for_each
  - Infrastructure as Code
---

Using `for_each` with modules in Terraform allows you to dynamically create multiple instances of a module and manage their outputs effectively. This is particularly useful for scaling and managing similar resources.

## Why Use `for_each` with Modules?

- **Dynamic Resource Creation**: Create multiple instances of a module with different configurations.
- **Simplified Code**: Reduce repetition in your Terraform configuration.
- **Centralized Management**: Manage similar resources through a single module.

## Example: Creating Multiple VPCs

Here's how to use `for_each` with a module to create multiple VPCs:

### Step 1: Define the Module

Create a module for VPC creation in `modules/vpc/main.tf`:

```hcl
resource "aws_vpc" "example" {
  cidr_block = var.cidr_block

  tags = {
    Name = var.name
  }
}

variable "cidr_block" {}
variable "name" {}
```

### Step 2: Use the Module with `for_each`

In your main configuration, use `for_each` to create multiple VPCs:

```hcl
module "vpcs" {
  source = "./modules/vpc"

  for_each = {
    vpc1 = { cidr_block = "10.0.0.0/16", name = "VPC1" }
    vpc2 = { cidr_block = "10.1.0.0/16", name = "VPC2" }
  }

  cidr_block = each.value.cidr_block
  name       = each.value.name
}
```

### Step 3: Output the Results

Use outputs to expose information about the created VPCs:

```hcl
output "vpc_ids" {
  value = { for k, v in module.vpcs : k => v.id }
}
```

### Explanation

- `for_each`: Iterates through a map of VPC configurations.
- `each.value`: Accesses the current map value in the iteration.
- `output`: Dynamically generates a map of VPC IDs.

## Best Practices

- Use descriptive keys in your `for_each` map for better readability.
- Validate input data to ensure it meets your requirements.
- Keep modules reusable by parameterizing them with variables.

By using `for_each` with modules, you can efficiently manage dynamic resources and outputs in Terraform.
