---
title: 'How to Reference a Resource Created by a Terraform Module'
excerpt: 'Reference resources created inside a Terraform module from the parent config. Covers defining outputs, accessing module outputs by name, and chaining modules.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2025-01-24'
publishedAt: '2025-01-24T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Modules
  - Resources
  - Tutorials
---

## TLDR

To reference a resource created by a Terraform module, use the module's output values. Define outputs in the module and access them using the `module.<module_name>.<output_name>` syntax.

---

Terraform modules encapsulate resources and logic, making configurations reusable and modular. Referencing resources created by a module is essential for integrating modules into larger configurations. This guide explains how to achieve this with practical examples.

## Step 1: Define Outputs in the Module

Start by defining output values in the module to expose the attributes of the resources you want to reference.

### Example (Module Code)

```hcl
resource "aws_instance" "example" {
  ami           = "ami-12345678"
  instance_type = "t2.micro"
  tags = {
    Name = "example-instance"
  }
}

output "instance_id" {
  value = aws_instance.example.id
}
```

### Explanation

- `resource "aws_instance" "example"`: Creates an EC2 instance.
- `output "instance_id"`: Exposes the instance ID as an output value.

## Step 2: Call the Module

Use the module in your root configuration and access its outputs.

### Example (Root Configuration)

```hcl
module "ec2_instance" {
  source = "./modules/ec2"
}

output "instance_id" {
  value = module.ec2_instance.instance_id
}
```

### Explanation

- `module "ec2_instance"`: Calls the module.
- `module.ec2_instance.instance_id`: References the `instance_id` output from the module.

## Step 3: Use the Referenced Resource

Use the referenced resource in other parts of your configuration.

### Example

```hcl
resource "aws_security_group_rule" "allow_ssh" {
  type        = "ingress"
  from_port   = 22
  to_port     = 22
  protocol    = "tcp"
  cidr_blocks = ["0.0.0.0/0"]
  security_group_id = module.ec2_instance.instance_id
}
```

### Explanation

- `module.ec2_instance.instance_id`: Provides the instance ID for the security group rule.

## Best Practices

- **Use Descriptive Output Names**: Clearly indicate the purpose of each output.
- **Document Outputs**: Provide clear documentation for module outputs.
- **Validate Outputs**: Ensure outputs are correctly defined and used.

By following these steps, you can effectively reference resources created by Terraform modules, enabling seamless integration and modular configurations.
