---
title: 'How to Attach Multiple IAM Policies to IAM Roles Using Terraform'
excerpt: 'Learn how to attach multiple IAM policies to a single IAM role in Terraform to manage permissions effectively.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2024-11-05'
publishedAt: '2024-11-05T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - IAM
  - AWS
  - Security
  - DevOps
---

## TLDR

You can attach multiple IAM policies to a single IAM role in Terraform by using the `aws_iam_role_policy_attachment` resource. This approach allows you to manage permissions modularly and flexibly.

---

Managing permissions in AWS often requires attaching multiple IAM policies to a single IAM role. Terraform makes this process straightforward with the `aws_iam_role_policy_attachment` resource. This guide will show you how to attach multiple policies to a role effectively.

### Why Attach Multiple Policies?

- **Modularity**: Separate policies for different permissions make management easier.
- **Reusability**: Policies can be reused across multiple roles.
- **Scalability**: Adding or removing permissions is simpler when policies are modular.

### Example Setup

This example demonstrates how to attach multiple IAM policies to a single IAM role using Terraform. The process involves defining the IAM role, creating the policies, and then attaching them to the role.

#### Step 1: Define the IAM Role

Start by creating an IAM role. This role will be used to attach multiple policies.

```hcl
resource "aws_iam_role" "example" {
  name = "example-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = "sts:AssumeRole",
        Effect = "Allow",
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}
```

#### Step 2: Define IAM Policies

Create the policies you want to attach to the role. These can be managed policies or inline policies.

```hcl
resource "aws_iam_policy" "example_policy_1" {
  name        = "example-policy-1"
  description = "Policy 1 for example role"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action   = ["s3:ListBucket"],
        Effect   = "Allow",
        Resource = ["arn:aws:s3:::example-bucket"]
      }
    ]
  })
}

resource "aws_iam_policy" "example_policy_2" {
  name        = "example-policy-2"
  description = "Policy 2 for example role"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action   = ["ec2:DescribeInstances"],
        Effect   = "Allow",
        Resource = "*"
      }
    ]
  })
}
```

#### Step 3: Attach Policies to the Role

Use the `aws_iam_role_policy_attachment` resource to attach the policies to the role.

```hcl
resource "aws_iam_role_policy_attachment" "example_attachment_1" {
  role       = aws_iam_role.example.name
  policy_arn = aws_iam_policy.example_policy_1.arn
}

resource "aws_iam_role_policy_attachment" "example_attachment_2" {
  role       = aws_iam_role.example.name
  policy_arn = aws_iam_policy.example_policy_2.arn
}
```

### Best Practices

- **Use Managed Policies**: Whenever possible, use AWS-managed policies to reduce maintenance overhead.
- **Group Related Permissions**: Combine related permissions into a single policy for clarity.
- **Avoid Inline Policies**: Inline policies are harder to manage and reuse.
- **Use Descriptive Names**: Name your policies and attachments clearly to indicate their purpose.

By following these steps, you can effectively attach multiple IAM policies to a single IAM role in Terraform, making your infrastructure more modular and easier to manage.
