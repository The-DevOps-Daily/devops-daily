---
title: 'How to Check if String Contains a Substring in Terraform Interpolation?'
excerpt: 'Learn how to check if a string contains a substring in Terraform using interpolation functions like `contains` and `regex`.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2025-02-23'
publishedAt: '2025-02-23T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Strings
  - Interpolation
  - Tutorials
---

## TLDR

To check if a string contains a substring in Terraform, use the `can` function with `regex` or the `contains` function for lists. These methods allow you to perform substring checks dynamically.

---

Terraform provides several ways to check if a string contains a substring, depending on your use case. This guide explains how to achieve this using practical examples.

## Step 1: Use the `regex` Function

The `regex` function allows you to match substrings using regular expressions.

### Example

```hcl
variable "example_string" {
  default = "hello world"
}

locals {
  contains_hello = can(regex("hello", var.example_string))
}

output "result" {
  value = local.contains_hello
}
```

### Explanation

- `regex("hello", var.example_string)`: Checks if the string contains the substring `hello`.
- `can`: Returns `true` if the regex matches, otherwise `false`.
- `local.contains_hello`: Stores the result of the check.

## Step 2: Use the `contains` Function for Lists

If you are working with a list of strings, use the `contains` function.

### Example

```hcl
variable "example_list" {
  default = ["hello", "world"]
}

locals {
  contains_hello = contains(var.example_list, "hello")
}

output "result" {
  value = local.contains_hello
}
```

### Explanation

- `contains(var.example_list, "hello")`: Checks if the list contains the string `hello`.
- `local.contains_hello`: Stores the result of the check.

## Step 3: Combine with Conditional Logic

Use the result of the substring check in conditional logic.

### Example

```hcl
variable "example_string" {
  default = "hello world"
}

locals {
  message = can(regex("hello", var.example_string)) ? "Substring found" : "Substring not found"
}

output "result" {
  value = local.message
}
```

### Explanation

- `can(regex("hello", var.example_string))`: Checks for the substring.
- `? "Substring found" : "Substring not found"`: Returns a message based on the result.

## Best Practices

- **Use Descriptive Variable Names**: Clearly indicate the purpose of each variable.
- **Validate Inputs**: Ensure strings are in the expected format before performing checks.
- **Document Logic**: Provide clear comments for complex expressions.

By following these steps, you can effectively check if a string contains a substring in Terraform, enabling dynamic and flexible configurations.
