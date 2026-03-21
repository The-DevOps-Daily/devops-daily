---
title: 'How to for_each through a list(objects) in Terraform'
excerpt: 'Learn how to use the for_each construct in Terraform to iterate through lists of objects and dynamically create resources.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2024-11-15'
publishedAt: '2024-11-15T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - for_each
  - Infrastructure as Code
  - DevOps
---

Terraform's `for_each` construct allows you to iterate through lists or maps to dynamically create resources. This is particularly useful when you need to manage multiple similar resources with different configurations.

## Why Use `for_each`?

Using `for_each` simplifies your Terraform configuration by reducing repetition. Instead of defining multiple resources manually, you can define a single resource block and use `for_each` to create multiple instances dynamically.

## Example: Iterating Through a List of Objects

Let's say you want to create multiple AWS S3 buckets with different names and tags. Here's how you can do it using `for_each`:

### Step 1: Define the List of Objects

In your Terraform configuration, define a variable that holds the list of objects. Each object can represent a bucket's configuration:

```hcl
variable "buckets" {
  default = [
    {
      name = "bucket-one"
      tags = {
        Environment = "Dev"
        Team        = "Engineering"
      }
    },
    {
      name = "bucket-two"
      tags = {
        Environment = "Prod"
        Team        = "Marketing"
      }
    }
  ]
}
```

### Step 2: Use `for_each` in the Resource Block

Use the `for_each` argument to iterate through the list of objects and create an S3 bucket for each one:

```hcl
resource "aws_s3_bucket" "example" {
  for_each = { for idx, bucket in var.buckets : bucket.name => bucket }

  bucket = each.value.name

  tags = each.value.tags
}
```

### Explanation

- `for_each`: Iterates through the list of objects. The `for` expression converts the list into a map where the key is the bucket name.
- `each.value`: Refers to the current object in the iteration.
- `bucket`: Sets the bucket name dynamically.
- `tags`: Assigns tags to the bucket based on the object properties.

### Step 3: Apply the Configuration

Run the following commands to apply the configuration:

```bash
terraform init
terraform apply
```

Terraform will create an S3 bucket for each object in the list.

## Best Practices

- Use descriptive keys in your `for_each` maps to make your configuration easier to understand.
- Validate your input data to ensure it meets your requirements.
- Keep your Terraform code DRY (Don't Repeat Yourself) by leveraging constructs like `for_each`.

By using `for_each`, you can efficiently manage multiple resources in Terraform, making your infrastructure code more maintainable and scalable.
