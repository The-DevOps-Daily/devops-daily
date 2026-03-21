---
title: 'How to Create a Folder in an AWS S3 Bucket Using Terraform'
excerpt: 'Learn how to create a folder in an AWS S3 bucket using Terraform by leveraging the `aws_s3_object` resource.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2024-08-10'
publishedAt: '2024-08-10T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - AWS
  - S3
  - DevOps
---

## TLDR

To create a folder in an AWS S3 bucket using Terraform, use the `aws_s3_object` resource with a trailing slash (`/`) in the key name. This creates a folder-like structure in the bucket.

---

AWS S3 is an object storage service that doesn't have a native concept of folders. However, you can simulate folders by creating objects with keys that include a trailing slash (`/`). This guide will show you how to create a folder in an S3 bucket using Terraform.

### Why Create Folders in S3?

- **Organization**: Group related objects together for better management.
- **Access Control**: Apply permissions to specific prefixes (folders).
- **Integration**: Many tools and services expect folder-like structures in S3.

### Steps to Create a Folder

To create a folder in an AWS S3 bucket using Terraform, you can follow these steps. This example assumes you have basic knowledge of Terraform and AWS.

#### Step 1: Define the S3 Bucket

Start by creating an S3 bucket if it doesn't already exist.

```hcl
resource "aws_s3_bucket" "example" {
  bucket = "example-bucket"
  acl    = "private"
}
```

#### Step 2: Create the Folder

Use the `aws_s3_object` resource to create a folder by specifying a key with a trailing slash.

```hcl
resource "aws_s3_object" "example_folder" {
  bucket = aws_s3_bucket.example.bucket
  key    = "my-folder/"
  acl    = "private"
}
```

### Verifying the Folder

After applying the Terraform configuration, you can verify the folder in the AWS Management Console or using the AWS CLI:

```bash
aws s3 ls s3://example-bucket/
```

You should see the folder `my-folder/` listed.

### Best Practices

- **Use Descriptive Names**: Name your folders clearly to indicate their purpose.
- **Apply Access Controls**: Use S3 bucket policies or IAM policies to restrict access to specific folders.
- **Organize by Prefix**: Group related objects under a common prefix for easier management.

By following these steps, you can create folder-like structures in AWS S3 buckets using Terraform, making your object storage more organized and easier to manage.
