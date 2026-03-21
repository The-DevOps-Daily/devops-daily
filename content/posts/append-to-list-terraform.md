---
title: 'How to Append to a List in Terraform?'
excerpt: 'Learn how to append elements to a list in Terraform using functions like `concat` and dynamic blocks.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2025-02-16'
publishedAt: '2025-02-16T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Lists
  - Tutorials
---

## TLDR

To append elements to a list in Terraform, use the `concat` function or dynamic blocks for more complex scenarios. These methods allow you to manage lists dynamically and efficiently.

---

Terraform provides multiple ways to append elements to a list, depending on your use case. This guide explains how to achieve this with practical examples.

## Step 1: Use the `concat` Function

The `concat` function is the simplest way to append elements to a list.

### Example

```hcl
variable "example_list" {
  default = ["apple", "banana"]
}

locals {
  updated_list = concat(var.example_list, ["cherry"])
}

output "result" {
  value = local.updated_list
}
```

### Explanation

- `concat(var.example_list, ["cherry"])`: Appends the element `cherry` to the existing list.
- `local.updated_list`: Stores the updated list.

## Step 2: Use Dynamic Blocks for Complex Scenarios

Dynamic blocks can be used to append elements to a list when working with resources or modules.

### Example

```hcl
variable "example_list" {
  default = ["apple", "banana"]
}

resource "null_resource" "example" {
  count = length(var.example_list)

  triggers = {
    item = var.example_list[count.index]
  }
}

output "result" {
  value = [for r in null_resource.example : r.triggers.item] ++ ["cherry"]
}
```

### Explanation

- `null_resource`: Iterates over the existing list.
- `++ ["cherry"]`: Appends the element `cherry` to the list.

## Step 3: Combine with Conditional Logic

You can conditionally append elements to a list based on specific criteria.

### Example

```hcl
variable "example_list" {
  default = ["apple", "banana"]
}

locals {
  updated_list = var.example_list
  final_list   = var.example_list == [] ? ["default"] : concat(local.updated_list, ["cherry"])
}

output "result" {
  value = local.final_list
}
```

### Explanation

- `var.example_list == []`: Checks if the list is empty.
- `concat(local.updated_list, ["cherry"])`: Appends `cherry` if the list is not empty.

## Best Practices

- **Use Descriptive Variable Names**: Clearly indicate the purpose of each variable.
- **Validate Inputs**: Ensure lists are in the expected format before appending elements.
- **Document Logic**: Provide clear comments for complex expressions.

By following these steps, you can effectively append elements to a list in Terraform, enabling dynamic and flexible configurations.
