---
title: 'Variable Keys in Terraform Maps'
excerpt: 'Use variable keys in Terraform maps to build dynamic, reusable configurations. Covers map syntax, dynamic lookups, and merging values across environments.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2025-02-28'
publishedAt: '2025-02-28T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Variables
  - Maps
  - Tutorials
---

## TLDR

Terraform maps allow you to define key-value pairs for dynamic configurations. You can use variable keys to make your maps more flexible and reusable.

---

Maps in Terraform are a powerful way to manage key-value pairs for dynamic configurations. This guide explains how to use variable keys in Terraform maps to create flexible and reusable infrastructure code.

## Step 1: Define a Map Variable

Start by defining a map variable in your Terraform configuration.

### Example

```hcl
variable "instance_types" {
  description = "Map of instance types for different environments."
  type        = map(string)
  default = {
    dev  = "t2.micro"
    prod = "t2.large"
  }
}
```

### Explanation

- `variable "instance_types"`: Declares a map variable.
- `type = map(string)`: Specifies that the map contains string values.
- `default`: Provides default key-value pairs for the map.

## Step 2: Access Map Values

Use the map variable to access values dynamically based on keys.

### Example

```hcl
resource "aws_instance" "example" {
  ami           = "ami-12345678"
  instance_type = var.instance_types["dev"]
}
```

### Explanation

- `var.instance_types["dev"]`: Accesses the value for the `dev` key in the map.
- `instance_type`: Sets the instance type dynamically based on the map value.

## Step 3: Use Dynamic Keys

Pass dynamic keys to access map values based on other variables.

### Example

```hcl
variable "environment" {
  description = "Deployment environment."
  type        = string
  default     = "dev"
}

resource "aws_instance" "example" {
  ami           = "ami-12345678"
  instance_type = var.instance_types[var.environment]
}
```

### Explanation

- `var.environment`: Specifies the key dynamically based on the environment variable.
- `var.instance_types[var.environment]`: Accesses the map value for the specified environment.

## Step 4: Validate Keys

Use validation blocks to ensure only valid keys are used.

### Example

```hcl
variable "environment" {
  description = "Deployment environment."
  type        = string

  validation {
    condition     = contains(keys(var.instance_types), var.environment)
    error_message = "Invalid environment. Must be one of: dev, prod."
  }
}
```

### Explanation

- `validation`: Ensures the environment variable matches a valid key in the map.
- `keys(var.instance_types)`: Retrieves all keys from the map.
- `contains`: Checks if the key exists in the map.

## Best Practices

- **Use Descriptive Keys**: Clearly indicate the purpose of each key.
- **Validate Inputs**: Use validation blocks to enforce constraints on keys.
- **Document Maps**: Provide clear documentation for map variables and their keys.

By following these steps, you can effectively use variable keys in Terraform maps to create dynamic and flexible configurations.
