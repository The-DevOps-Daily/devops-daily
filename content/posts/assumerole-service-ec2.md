---
title: 'What Does AssumeRole: Service: ec2 Do?'
excerpt: 'Understand the role of AssumeRole with Service: ec2 in AWS IAM policies and how it integrates with Terraform.'
category:
  name: 'AWS'
  slug: 'aws'
date: '2024-12-01'
publishedAt: '2024-12-01T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - AWS
  - IAM
  - Terraform
  - EC2
  - Security
---

## TLDR

The `AssumeRole` action with `Service: ec2` in AWS Identity and Access Management (IAM) allows EC2 instances to assume roles and gain temporary access to AWS resources. This is commonly used to grant EC2 instances permissions to interact with other AWS services securely. In this guide, you'll learn how it works, why it's important, and how to implement it using Terraform.

---

When working with AWS, you often need to grant EC2 instances access to other AWS services, such as S3, DynamoDB, or CloudWatch. Instead of embedding long-term credentials in your application, AWS provides a secure way to achieve this using IAM roles and the `AssumeRole` action.

### What is `AssumeRole` with `Service: ec2`?

The `AssumeRole` action allows a trusted entity - in this case, the EC2 service - to assume an IAM role. This means that EC2 instances can temporarily inherit the permissions defined in the role, enabling them to interact with AWS services securely.

Here's a breakdown of the key components:

- **IAM Role**: A set of permissions that define what actions are allowed or denied.
- **Trust Policy**: A JSON document that specifies which entities can assume the role. For EC2, this includes the `Service: ec2.amazonaws.com` principal.
- **Temporary Credentials**: When an EC2 instance assumes a role, it receives temporary credentials to access AWS services.

### Why Use `AssumeRole` with EC2?

Using `AssumeRole` with EC2 has several benefits:

1. **Security**: Avoids hardcoding credentials in your application.
2. **Granular Permissions**: Grants only the permissions needed for the task.
3. **Automatic Rotation**: Temporary credentials are automatically rotated by AWS.

### Example: Setting Up `AssumeRole` for EC2 with Terraform

Let's walk through an example of creating an IAM role for EC2 and attaching a trust policy using Terraform.

#### Step 1: Define the IAM Role

The IAM role will include a trust policy that allows EC2 to assume the role.

```hcl
resource "aws_iam_role" "ec2_role" {
  name = "ec2_assume_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Principal = {
          Service = "ec2.amazonaws.com"
        },
        Action = "sts:AssumeRole"
      }
    ]
  })
}
```

- **What this does**: Defines an IAM role with a trust policy that allows EC2 to assume it.
- **Why it matters**: This is the foundation for granting EC2 instances access to AWS services.

#### Step 2: Attach a Policy to the Role

Next, attach a policy to the role to define what the EC2 instance can do.

```hcl
resource "aws_iam_role_policy" "ec2_policy" {
  name   = "ec2_policy"
  role   = aws_iam_role.ec2_role.name

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = [
          "s3:ListBucket",
          "s3:GetObject"
        ],
        Resource = [
          "arn:aws:s3:::example-bucket",
          "arn:aws:s3:::example-bucket/*"
        ]
      }
    ]
  })
}
```

- **What this does**: Grants the EC2 instance permissions to list and retrieve objects from an S3 bucket.
- **Why it matters**: This ensures the instance has the necessary permissions to perform its tasks.

#### Step 3: Associate the Role with an EC2 Instance

Finally, associate the IAM role with an EC2 instance profile.

```hcl
resource "aws_iam_instance_profile" "ec2_instance_profile" {
  name = "ec2_instance_profile"
  role = aws_iam_role.ec2_role.name
}

resource "aws_instance" "example" {
  ami           = "ami-0c55b159cbfafe1f0" # Replace with your AMI ID
  instance_type = "t2.micro"

  iam_instance_profile = aws_iam_instance_profile.ec2_instance_profile.name
}
```

- **What this does**: Links the IAM role to the EC2 instance.
- **Why it matters**: This enables the instance to assume the role and access AWS services securely.

---

By following these steps, you can securely grant your EC2 instances access to AWS services using IAM roles and the `AssumeRole` action. This approach enhances security, simplifies credential management, and ensures your applications can interact with AWS services seamlessly.
