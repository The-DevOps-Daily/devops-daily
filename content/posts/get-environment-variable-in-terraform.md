---
title: 'Getting an Environment Variable in Terraform Configuration'
excerpt: 'Learn how to retrieve and use environment variables in Terraform configurations using the `env` function and input variables.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2024-07-24'
publishedAt: '2024-07-24T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Environment Variables
  - Configuration Management
  - DevOps
---

## TLDR

To use environment variables in Terraform, you can pass them as input variables or use the `TF_VAR_` prefix. Alternatively, use the `env` function to access environment variables directly in your configuration.

---

Environment variables are a convenient way to pass dynamic values to Terraform configurations. This guide will show you how to retrieve and use environment variables effectively in Terraform.

### Why Use Environment Variables?

- **Dynamic Configurations**: Pass values that change between environments (e.g., dev, staging, prod).
- **Security**: Store sensitive data like API keys or credentials securely.
- **Automation**: Simplify CI/CD pipelines by using environment variables for configuration.

### Using Input Variables with `TF_VAR_` Prefix

Terraform automatically maps environment variables with the `TF_VAR_` prefix to input variables.

#### Example: Using `TF_VAR_`

Define an input variable in your configuration:

```hcl
variable "region" {
  description = "The AWS region to deploy resources in."
  type        = string
}
```

Set the environment variable:

```bash
export TF_VAR_region=us-east-1
```

Run Terraform commands, and the `region` variable will automatically use the value from the environment variable.

### Using the `env` Function

The `env` function allows you to access environment variables directly in your configuration.

#### Example: Using `env`

```hcl
variable "api_key" {
  default = "${env("API_KEY")}" # Replace "API_KEY" with your environment variable name
}

output "api_key" {
  value = var.api_key
}
```

Set the environment variable:

```bash
export API_KEY=your-api-key
```

Run Terraform commands, and the `api_key` variable will use the value from the environment variable.

### Best Practices

- **Use Secure Storage**: Store sensitive environment variables in a secure location, such as AWS Secrets Manager or HashiCorp Vault.
- **Validate Inputs**: Use `validation` blocks to enforce constraints on input variables.
- **Document Variables**: Clearly document which environment variables are required and their purpose.

By using environment variables in Terraform, you can create dynamic and secure configurations that adapt to different environments and workflows.
