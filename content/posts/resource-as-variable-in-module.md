---
title: 'Can a Resource Be Passed as a Variable into a Module?'
excerpt: 'Learn how to pass resources as variables into modules in Terraform for reusable and modular infrastructure.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2025-01-29'
publishedAt: '2025-01-29T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Modules
  - Variables
  - Tutorials
---

## TLDR

Yes, you can pass a resource as a variable into a module in Terraform. Use output values to expose resource attributes and pass them as input variables to the module.

---

Terraform modules allow you to encapsulate and reuse infrastructure code. Passing resources as variables into modules is a common practice to make your configurations more modular and flexible. This guide explains how to achieve this with practical examples.

## Step 1: Define the Resource

Create a resource in your Terraform configuration that you want to pass to a module.

### Example

```hcl
resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
  tags = {
    Name = "main-vpc"
  }
}
```

### Explanation

- `aws_vpc.main`: Creates a VPC with the specified CIDR block.
- `tags`: Adds a name tag to the VPC.

## Step 2: Expose the Resource as an Output

Use an output block to expose the resource attributes you want to pass to the module.

### Example

```hcl
output "vpc_id" {
  value = aws_vpc.main.id
}
```

### Explanation

- `output "vpc_id"`: Exposes the VPC ID as an output variable.
- `aws_vpc.main.id`: References the ID of the VPC resource.

## Step 3: Pass the Output to the Module

Use the output value as an input variable for the module.

### Example

```hcl
module "subnet" {
  source  = "./modules/subnet"
  vpc_id  = aws_vpc.main.id
}
```

### Explanation

- `module "subnet"`: Calls the subnet module.
- `vpc_id`: Passes the VPC ID to the module.

## Step 4: Use the Variable in the Module

Define an input variable in the module to accept the resource attribute.

### Example (Module Code)

```hcl
variable "vpc_id" {
  description = "The ID of the VPC."
  type        = string
}

resource "aws_subnet" "example" {
  vpc_id     = var.vpc_id
  cidr_block = "10.0.1.0/24"
  tags = {
    Name = "example-subnet"
  }
}
```

### Explanation

- `variable "vpc_id"`: Declares an input variable for the VPC ID.
- `aws_subnet.example`: Creates a subnet in the specified VPC.

## Best Practices

- **Use Descriptive Variable Names**: Clearly indicate the purpose of each variable.
- **Validate Inputs**: Use `validation` blocks to enforce constraints on input variables.
- **Document Outputs**: Clearly document the outputs of your modules for easier reuse.

By following these steps, you can effectively pass resources as variables into modules, making your Terraform configurations more modular and reusable.
