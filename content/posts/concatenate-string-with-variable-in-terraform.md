---
title: 'Concatenate a String with a Variable in Terraform'
excerpt: 'Learn how to concatenate strings with variables in Terraform to create dynamic configurations.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2024-02-21'
publishedAt: '2024-02-21T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '4 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - String Concatenation
  - DevOps
  - Infrastructure as Code
---

## TLDR

In Terraform, you can concatenate strings with variables using interpolation syntax (`${}`) or the `join` function for more complex cases.

---

### Concatenating Strings with Variables in Terraform

String concatenation is a common requirement in Terraform configurations, such as dynamically constructing resource names or paths.

#### Using Interpolation Syntax

The simplest way to concatenate a string with a variable is by using interpolation syntax:

```hcl
variable "environment" {
  default = "production"
}

output "bucket_name" {
  value = "my-app-${var.environment}-bucket"
}
```

In this example, the `bucket_name` output will be `"my-app-production-bucket"` if the `environment` variable is set to `"production"`.

#### Using the `join` Function

For more complex concatenations, you can use the `join` function:

```hcl
variable "tags" {
  default = ["app", "web", "prod"]
}

output "tag_string" {
  value = join("-", var.tags)
}
```

This will produce a single string: `"app-web-prod"`.

#### Combining Interpolation and Functions

You can combine interpolation and functions for advanced use cases:

```hcl
variable "region" {
  default = "us-east-1"
}

output "resource_id" {
  value = "resource-${join("-", [var.region, "123"])}"
}
```

The `resource_id` output will be `"resource-us-east-1-123"`.

### Best Practices

- **Use Meaningful Names**: Ensure variable names clearly indicate their purpose.
- **Avoid Hardcoding**: Use variables for dynamic values instead of hardcoding strings.
- **Test Outputs**: Use `terraform console` to verify concatenated strings before applying changes.

By mastering string concatenation, you can create more dynamic and reusable Terraform configurations.
