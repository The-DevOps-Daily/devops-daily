---
title: 'Terraform Failing with Invalid for_each Argument / The Given "for_each" Argument Value is Unsuitable'
excerpt: 'Learn how to troubleshoot and fix the "Invalid for_each argument" error in Terraform.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2024-03-29'
publishedAt: '2024-03-29T10:30:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - for_each
  - Troubleshooting
  - DevOps
  - Infrastructure as Code
---

## TLDR

The "Invalid for_each argument" error in Terraform occurs when the value provided to `for_each` is not a valid map or set. Learn how to troubleshoot and resolve this issue.

---

### Understanding the Error

The `for_each` meta-argument in Terraform requires a map or a set of strings. If the provided value does not meet these criteria, Terraform will throw an error like:

```
Error: Invalid for_each argument

The given "for_each" argument value is unsuitable.
```

This error often occurs due to:

- Using a list instead of a set.
- Providing a value that is not iterable.
- Incorrect data types.

### Common Scenarios and Fixes

As you work with Terraform, you may encounter the "Invalid for_each argument" error. This typically happens when the value provided to `for_each` is not a valid map or set. Here are some common scenarios and how to fix them:

#### 1. Using a List Instead of a Set

Terraform requires a set or map for `for_each`. If you use a list, you need to convert it to a set:

```hcl
variable "instances" {
  default = ["web", "db", "cache"]
}

resource "aws_instance" "example" {
  for_each = toset(var.instances)

  ami           = "ami-12345678"
  instance_type = "t2.micro"
  tags = {
    Name = each.key
  }
}
```

Here, `toset` converts the list to a set, making it compatible with `for_each`.

#### 2. Using a Map for Key-Value Pairs

If you need to iterate over key-value pairs, use a map:

```hcl
variable "instance_types" {
  default = {
    web   = "t2.micro",
    db    = "t2.small",
    cache = "t2.medium"
  }
}

resource "aws_instance" "example" {
  for_each = var.instance_types

  ami           = "ami-12345678"
  instance_type = each.value
  tags = {
    Name = each.key
  }
}
```

#### 3. Handling Null or Empty Values

If the value for `for_each` is null or empty, Terraform will throw an error. Use a default value to handle this:

```hcl
variable "instances" {
  default = null
}

resource "aws_instance" "example" {
  for_each = var.instances != null ? toset(var.instances) : {}

  ami           = "ami-12345678"
  instance_type = "t2.micro"
}
```

#### 4. Debugging Data Types

Use `terraform console` to inspect the data type of your variable:

```bash
> var.instances
> toset(var.instances)
```

This helps identify issues with the input data.

### Best Practices

- **Validate Input Data**: Use `validation` blocks in variables to ensure correct data types.
- **Use Default Values**: Provide sensible defaults to avoid null or empty values.
- **Test Iterations**: Use `terraform console` to test your `for_each` logic before applying changes.

By understanding and addressing the root cause of the "Invalid for_each argument" error, you can create more robust and error-free Terraform configurations.
