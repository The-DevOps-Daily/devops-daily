---
title: 'Refactoring modules: Error: Provider configuration not present'
excerpt: "Learn how to resolve the 'Provider configuration not present' error when refactoring Terraform modules."
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2024-06-19'
publishedAt: '2024-06-19T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Modules
  - Errors
  - DevOps
---

When refactoring Terraform modules, you might encounter the error: `Provider configuration not present`. This error occurs when a module does not have access to the required provider configuration.

## Why This Happens

Terraform modules are isolated from the root configuration. If a module requires a provider, you must explicitly pass the provider configuration to the module.

## How to Fix It

Let's go through the steps to resolve this error and ensure your module can access the necessary provider configuration.

### Step 1: Define the Provider in the Root Configuration

Ensure the provider is defined in your root configuration:

```hcl
provider "aws" {
  region = "us-east-1"
}
```

### Step 2: Pass the Provider to the Module

Use the `providers` argument to pass the provider configuration to the module:

```hcl
module "example" {
  source = "./modules/example"

  providers = {
    aws = aws
  }
}
```

### Step 3: Declare the Provider in the Module

In the module, declare the required provider:

```hcl
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}
```

### Step 4: Test the Configuration

Run the following commands to test your configuration:

```bash
terraform init
terraform plan
```

Ensure there are no errors related to the provider configuration.

## Best Practices

- Use explicit provider configurations to avoid ambiguity.
- Keep your modules reusable by not hardcoding provider details.
- Regularly update your provider versions to benefit from the latest features and fixes.

By following these steps, you can resolve the `Provider configuration not present` error and refactor your Terraform modules effectively.
