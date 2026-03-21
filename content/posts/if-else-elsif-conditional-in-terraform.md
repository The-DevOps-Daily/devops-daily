---
title: 'How to Write an if, else, elsif Conditional Statement in Terraform'
excerpt: 'Learn how to use if, else, and elsif conditional statements in Terraform to create dynamic configurations.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2024-04-21'
publishedAt: '2024-04-21T09:30:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Conditional Statements
  - DevOps
  - Infrastructure as Code
---

## TLDR

Terraform supports `if`, `else`, and `elsif` (via nested conditionals) for creating dynamic configurations. These are implemented using conditional expressions.

---

### Writing Conditional Statements in Terraform

Terraform does not have traditional `if`, `else`, or `elsif` statements like programming languages. Instead, it uses **conditional expressions** to achieve similar functionality.

#### Basic `if` Statement

A basic `if` statement in Terraform is written as a conditional expression:

```hcl
variable "is_production" {
  default = false
}

output "environment" {
  value = var.is_production ? "production" : "development"
}
```

In this example, if `is_production` is `true`, the output will be `"production"`. Otherwise, it will be `"development"`.

#### `if-else` Statement

The `if-else` logic is implemented using the same conditional expression:

```hcl
variable "enable_feature" {
  default = true
}

output "feature_status" {
  value = var.enable_feature ? "enabled" : "disabled"
}
```

Here, the `feature_status` output will be `"enabled"` if `enable_feature` is `true`, and `"disabled"` otherwise.

#### `if-elsif-else` Statement

Terraform does not have a direct `elsif` keyword, but you can achieve this using nested conditionals:

```hcl
variable "environment" {
  default = "staging"
}

output "env_message" {
  value = var.environment == "production" ? "Live Environment" : (var.environment == "staging" ? "Testing Environment" : "Development Environment")
}
```

In this example:

- If `environment` is `"production"`, the output will be `"Live Environment"`.
- If `environment` is `"staging"`, the output will be `"Testing Environment"`.
- Otherwise, it will be `"Development Environment"`.

### Best Practices

- **Keep It Simple**: Avoid deeply nested conditionals. Use variables to simplify complex logic.
- **Use Descriptive Variable Names**: Make your conditions self-explanatory.
- **Test Your Logic**: Use `terraform console` to validate your expressions before applying them.

By mastering conditional expressions, you can create highly dynamic and adaptable Terraform configurations.
