---
title: 'How to Split a Terraform File (main.tf) into Several Files (No Modules)'
excerpt: 'Organizing Terraform configurations by splitting a single main.tf file into multiple files can improve readability and maintainability. Learn how to do this without using modules.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2024-12-01'
publishedAt: '2024-12-01T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Configuration Management
  - DevOps
  - Infrastructure as Code
---

## TLDR

Splitting a `main.tf` file into multiple files helps organize your Terraform configuration. You can separate resources, variables, outputs, and providers into their own files. Terraform automatically loads all `.tf` files in the same directory, so no additional configuration is needed.

---

When working with Terraform, a single `main.tf` file can quickly become unwieldy as your infrastructure grows. Splitting this file into multiple files improves readability and makes collaboration easier. This guide will show you how to split your Terraform configuration into logical parts without using modules.

### Why Split Your Terraform File?

- **Readability**: Smaller files are easier to read and navigate.
- **Collaboration**: Teams can work on different parts of the configuration without conflicts.
- **Maintainability**: Changes are easier to track and manage.

### How Terraform Handles Multiple Files

Terraform automatically loads all `.tf` files in the same directory. The order of loading is not guaranteed, but this usually doesn't matter because Terraform builds a dependency graph to determine the correct order of operations.

### Steps to Split Your Terraform File

To split your `main.tf` file into several files, follow these steps:

#### 1. Separate Providers

Move provider configurations into a dedicated file, such as `providers.tf`. This keeps your provider setup isolated.

```hcl
# providers.tf
provider "aws" {
  region = "us-east-1"
}

provider "google" {
  project = "my-gcp-project"
  region  = "us-central1"
}
```

#### 2. Isolate Variables

Place all variable definitions in a `variables.tf` file. This makes it easier to manage inputs to your configuration.

```hcl
# variables.tf
variable "aws_region" {
  description = "The AWS region to deploy resources in."
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "The type of EC2 instance."
  type        = string
  default     = "t2.micro"
}
```

#### 3. Extract Outputs

Move output definitions to an `outputs.tf` file. This keeps your outputs organized and separate from the main logic.

```hcl
# outputs.tf
output "instance_id" {
  description = "The ID of the EC2 instance."
  value       = aws_instance.my_instance.id
}

output "bucket_name" {
  description = "The name of the S3 bucket."
  value       = aws_s3_bucket.my_bucket.bucket
}
```

#### 4. Organize Resources

Keep resource definitions in a `resources.tf` file. If you have many resources, consider creating separate files for each type of resource (e.g., `ec2.tf`, `s3.tf`).

```hcl
# resources.tf
resource "aws_instance" "my_instance" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = var.instance_type
}

resource "aws_s3_bucket" "my_bucket" {
  bucket = "my-unique-bucket-name"
  acl    = "private"
}
```

#### 5. Use a Terraform State File

All `.tf` files in the same directory share the same state file. You don't need to configure anything extra for this to work.

### Best Practices

- **Use Comments**: Add comments to explain the purpose of each file and resource.
- **Validate Regularly**: Run `terraform validate` to check for syntax errors.
- **Plan Before Applying**: Always run `terraform plan` to preview changes.

### Example Directory Structure

Here's an example of how your directory might look after splitting the `main.tf` file:

```
my-terraform-project/
├── providers.tf
├── variables.tf
├── outputs.tf
├── resources.tf
```

This structure keeps your configuration clean and organized.

By splitting your Terraform configuration into multiple files, you can make your infrastructure code more manageable and easier to work with. Good luck with your Terraform projects!
