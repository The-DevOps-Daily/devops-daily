---
title: 'Terraform: Error Creating IAM Role. MalformedPolicyDocument: Has Prohibited Field Resource'
excerpt: "Learn how to resolve the 'MalformedPolicyDocument: Has prohibited field Resource' error when creating an IAM role in Terraform."
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2024-12-15'
publishedAt: '2024-12-15T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - IAM
  - AWS
  - Troubleshooting
---

## TLDR

The "MalformedPolicyDocument: Has prohibited field Resource" error occurs when creating an IAM role with a policy that includes a `Resource` field in a `Condition` block. To fix this, remove the `Resource` field or adjust the policy structure.

---

When creating IAM roles in Terraform, you might encounter the error "MalformedPolicyDocument: Has prohibited field Resource." This error is caused by including a `Resource` field in a context where it is not allowed, such as within a `Condition` block. This guide will show you how to resolve this issue.

### Why Does This Error Occur?

- **Invalid Policy Structure**: The `Resource` field is not allowed in certain parts of an IAM policy, such as within a `Condition` block.
- **Misconfigured Policy**: The policy might include a `Resource` field where it is not required or expected.

### Steps to Fix the Error

To resolve the "MalformedPolicyDocument: Has prohibited field Resource" error, follow these steps:

#### Step 1: Review the Policy

Check the IAM policy for any `Resource` fields in invalid contexts. For example:

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
        },
        Condition = {
          StringEquals = {
            "aws:ResourceTag/Environment" = "production"
          }
        }
      }
    ]
  })
}
```

In this example, the `Resource` field is incorrectly placed in the `Condition` block.

#### Step 2: Remove or Adjust the `Resource` Field

Remove the `Resource` field from invalid contexts or adjust the policy structure. For example:

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

#### Step 3: Validate the Policy

Use the AWS IAM Policy Simulator or the `terraform validate` command to ensure the policy is valid.

```bash
terraform validate
```

### Best Practices

- **Use Policy Simulators**: Test your policies in the AWS IAM Policy Simulator to catch errors early.
- **Follow AWS Documentation**: Refer to the AWS IAM policy documentation for valid policy structures.
- **Validate Configuration**: Run `terraform validate` to check for syntax errors and misconfigurations.

By following these steps, you can resolve the "MalformedPolicyDocument: Has prohibited field Resource" error and create valid IAM roles in Terraform.
