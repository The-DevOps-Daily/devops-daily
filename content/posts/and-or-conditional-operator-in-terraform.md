---
title: 'Is there an AND/OR Conditional Operator in Terraform?'
excerpt: 'Learn how to use AND/OR conditional operators in Terraform to create dynamic configurations.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2024-06-21'
publishedAt: '2024-06-21T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Conditional Operators
  - DevOps
  - Infrastructure as Code
---

## TLDR

Terraform supports AND (`&&`) and OR (`||`) conditional operators for creating dynamic configurations. These operators are used in expressions to evaluate multiple conditions.

---

### Using AND/OR Conditional Operators in Terraform

In Terraform, you can use logical operators to combine multiple conditions. These operators are particularly useful when defining resource conditions, variable defaults, or dynamic blocks.

#### AND Operator (`&&`)

The `&&` operator returns `true` if **both** conditions are true. Here's an example:

```hcl
variable "enable_feature" {
  default = true
}

variable "is_production" {
  default = false
}

output "should_enable" {
  value = var.enable_feature && var.is_production
}
```

In this example, the `should_enable` output will only be `true` if both `enable_feature` and `is_production` are `true`.

#### OR Operator (`||`)

The `||` operator returns `true` if **either** condition is true. Here's an example:

```hcl
variable "enable_feature" {
  default = true
}

variable "is_production" {
  default = false
}

output "should_enable" {
  value = var.enable_feature || var.is_production
}
```

In this case, the `should_enable` output will be `true` if either `enable_feature` or `is_production` is `true`.

### Combining AND and OR

You can combine `&&` and `||` operators to create more complex conditions. Use parentheses to ensure the correct order of operations:

```hcl
output "complex_condition" {
  value = (var.enable_feature && var.is_production) || var.enable_feature
}
```

### Best Practices

- **Use Parentheses**: Always use parentheses to make complex conditions more readable and avoid logical errors.
- **Keep Conditions Simple**: Break down complex conditions into smaller, reusable variables for better readability.
- **Test Your Logic**: Use `terraform console` to test your expressions before applying them.

By understanding and using AND/OR operators effectively, you can create more dynamic and flexible Terraform configurations.
