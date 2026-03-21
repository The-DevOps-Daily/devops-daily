---
title: 'How to Retrieve a Secret in Terraform from AWS Secret Manager'
excerpt: 'Learn how to securely retrieve secrets from AWS Secret Manager using Terraform in your infrastructure as code workflows.'
category:
  name: 'AWS'
  slug: 'aws'
date: '2024-11-20'
publishedAt: '2024-11-20T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - AWS
  - Terraform
  - Secrets Management
  - Security
---

## TLDR

This guide explains how to retrieve secrets from AWS Secret Manager using Terraform. You'll learn how to securely access sensitive information, such as API keys or database credentials, and integrate them into your Terraform-managed infrastructure.

---

Managing sensitive information like API keys, database credentials, or tokens is a critical part of infrastructure as code. AWS Secret Manager provides a secure way to store and retrieve secrets, and Terraform makes it easy to integrate this into your workflows.

### Why Use AWS Secret Manager with Terraform?

AWS Secret Manager allows you to securely store and manage sensitive information. By integrating it with Terraform, you can:

1. **Centralize Secrets Management**: Keep all your secrets in one secure location.
2. **Automate Access**: Retrieve secrets dynamically during Terraform runs.
3. **Enhance Security**: Avoid hardcoding sensitive information in your Terraform code.

### Prerequisites

Before you begin, make sure you have:

- An AWS account with Secret Manager enabled.
- Terraform installed (version 1.0 or later).
- AWS CLI configured with appropriate permissions.

### Example: Retrieving a Secret in Terraform

Let's walk through an example of retrieving a secret from AWS Secret Manager using Terraform.

#### Step 1: Create a Secret in AWS Secret Manager

First, create a secret in AWS Secret Manager. You can do this via the AWS Management Console or AWS CLI.

```bash
aws secretsmanager create-secret \
  --name MySecret \
  --secret-string '{"username":"admin","password":"P@ssw0rd"}'
```

- **What this does**: Creates a secret named `MySecret` with a JSON string containing a username and password.
- **Why it matters**: This is the secret you'll retrieve in Terraform.

#### Step 2: Retrieve the Secret in Terraform

Use the `aws_secretsmanager_secret` and `aws_secretsmanager_secret_version` data sources to retrieve the secret.

```hcl
data "aws_secretsmanager_secret" "example" {
  name = "MySecret"
}

data "aws_secretsmanager_secret_version" "example" {
  secret_id = data.aws_secretsmanager_secret.example.id
}

output "retrieved_secret" {
  value = jsondecode(data.aws_secretsmanager_secret_version.example.secret_string)
}
```

- **What this does**:
  - Retrieves the secret metadata using `aws_secretsmanager_secret`.
  - Fetches the secret value using `aws_secretsmanager_secret_version`.
  - Decodes the JSON string to extract the username and password.
- **Why it matters**: This approach keeps your secrets secure and avoids hardcoding them in your Terraform code.

#### Step 3: Use the Secret in Your Terraform Configuration

You can use the retrieved secret in other Terraform resources. For example, to configure an RDS instance:

```hcl
resource "aws_db_instance" "example" {
  allocated_storage    = 20
  engine               = "mysql"
  instance_class       = "db.t2.micro"
  name                 = "exampledb"
  username             = jsondecode(data.aws_secretsmanager_secret_version.example.secret_string).username
  password             = jsondecode(data.aws_secretsmanager_secret_version.example.secret_string).password
  skip_final_snapshot  = true
}
```

- **What this does**: Configures an RDS instance using the username and password retrieved from AWS Secret Manager.
- **Why it matters**: This ensures your database credentials are securely managed and dynamically retrieved.

---

By following these steps, you can securely retrieve and use secrets from AWS Secret Manager in your Terraform configurations. This approach enhances security, simplifies secrets management, and integrates seamlessly with your infrastructure as code workflows.
