---
title: 'How do you do simple string concatenation in Terraform?'
excerpt: 'Learn how to perform string concatenation in Terraform using interpolation and the join function.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2024-11-15'
publishedAt: '2024-11-15T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '4 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - String Manipulation
  - DevOps
  - Infrastructure as Code
---

String concatenation is a common task in Terraform, often used to dynamically construct resource names, tags, or other configuration values. Terraform provides several ways to concatenate strings, making it easy to handle various use cases.

## Using Interpolation

The simplest way to concatenate strings in Terraform is by using interpolation. Interpolation allows you to embed variables and expressions directly into strings.

### Example

```hcl
variable "environment" {
  default = "dev"
}

output "bucket_name" {
  value = "my-app-${var.environment}-bucket"
}
```

### Explanation

- `${var.environment}`: Embeds the value of the `environment` variable into the string.
- The resulting value will be `my-app-dev-bucket` if the `environment` variable is set to `dev`.

## Using the `join` Function

The `join` function is another way to concatenate strings, especially when working with lists.

### Example

```hcl
variable "tags" {
  default = ["Environment:Dev", "Team:Engineering"]
}

output "tags_string" {
  value = join(", ", var.tags)
}
```

### Explanation

- `join(", ", var.tags)`: Joins the elements of the `tags` list into a single string, separated by a comma and a space.
- The resulting value will be `Environment:Dev, Team:Engineering`.

## Best Practices

- Use interpolation for simple concatenation tasks.
- Use the `join` function for lists to improve readability and maintainability.
- Avoid hardcoding values; use variables to make your configuration more flexible.

By understanding these techniques, you can efficiently handle string concatenation in Terraform and create dynamic, reusable configurations.
