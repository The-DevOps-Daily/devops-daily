---
title: 'Correct way to attach AWS managed policies to a role?'
excerpt: 'Learn how to correctly attach AWS managed policies to an IAM role using the AWS Management Console, CLI, or Terraform.'
category:
  name: 'AWS'
  slug: 'aws'
date: '2025-01-02'
publishedAt: '2025-01-02T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - AWS
  - IAM
  - Policies
  - DevOps
---

Attaching AWS managed policies to an IAM role is a common task when setting up permissions for your AWS resources. Managed policies simplify permission management by providing pre-defined sets of permissions for common use cases.

## Why Use Managed Policies?

AWS managed policies are maintained by AWS and are designed to provide permissions for common tasks. They reduce the complexity of creating and managing custom policies.

## Methods to Attach Managed Policies

You can attach AWS managed policies to a role using the AWS Management Console, AWS CLI, or Infrastructure as Code tools like Terraform.

### Using the AWS Management Console

1. Open the [IAM Console](https://console.aws.amazon.com/iam/).
2. Navigate to **Roles** and select the role you want to modify.
3. Click **Add permissions** and choose **Attach policies**.
4. Search for the managed policy you want to attach (e.g., `AmazonS3ReadOnlyAccess`).
5. Select the policy and click **Attach policy**.

### Using the AWS CLI

Run the following command to attach a managed policy to a role:

```bash
aws iam attach-role-policy \
  --role-name MyRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess
```

### Using Terraform

In Terraform, you can use the `aws_iam_role_policy_attachment` resource to attach a managed policy to a role:

```hcl
resource "aws_iam_role" "example" {
  name = "example-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "example" {
  role       = aws_iam_role.example.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess"
}
```

## Best Practices

- Use the principle of least privilege: Attach only the policies necessary for the role's tasks.
- Regularly review attached policies to ensure they meet your security requirements.
- Use AWS CloudTrail to monitor changes to IAM roles and policies.

By following these methods, you can correctly attach AWS managed policies to your IAM roles and manage permissions effectively.
