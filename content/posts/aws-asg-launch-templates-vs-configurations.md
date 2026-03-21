---
title: 'AWS ASG Launch Templates vs Launch Configurations'
excerpt: 'Understand the key differences between AWS Auto Scaling Group Launch Templates and Launch Configurations to make informed decisions for your infrastructure.'
category:
  name: 'AWS'
  slug: 'aws'
date: '2024-11-10'
publishedAt: '2024-11-10T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - AWS
  - Auto Scaling
  - Cloud Infrastructure
  - DevOps
---

## TLDR

AWS Auto Scaling Groups (ASGs) can use either Launch Templates or Launch Configurations to define instance settings. Launch Templates are more flexible and support advanced features like multiple instance types and spot instances, while Launch Configurations are simpler but more limited.

---

When setting up Auto Scaling Groups (ASGs) in AWS, you need to define how instances are launched. This can be done using either Launch Templates or Launch Configurations. While both serve the same basic purpose, they differ significantly in features and flexibility. This guide will help you understand these differences and choose the right option for your use case.

### What Are Launch Configurations?

Launch Configurations are a legacy way to define instance settings for ASGs. They include basic parameters like:

- AMI ID
- Instance type
- Key pair
- Security groups
- Block device mappings

#### Example: Launch Configuration

Here's how to define a Launch Configuration in Terraform:

```hcl
resource "aws_launch_configuration" "example" {
  name          = "example-launch-configuration"
  image_id      = "ami-0c55b159cbfafe1f0"
  instance_type = "t2.micro"
  key_name      = "my-key-pair"

  security_groups = ["sg-12345678"]

  lifecycle {
    create_before_destroy = true
  }
}
```

### What Are Launch Templates?

Launch Templates are a more modern and flexible alternative to Launch Configurations. They support all the features of Launch Configurations and add:

- Multiple instance types
- Spot instances
- T2/T3 Unlimited
- Elastic Graphics
- Placement groups
- Versioning

#### Example: Launch Template

Here's how to define a Launch Template in Terraform:

```hcl
resource "aws_launch_template" "example" {
  name          = "example-launch-template"
  image_id      = "ami-0c55b159cbfafe1f0"
  instance_type = "t2.micro"

  key_name = "my-key-pair"

  network_interfaces {
    associate_public_ip_address = true
    security_groups             = ["sg-12345678"]
  }

  tag_specifications {
    resource_type = "instance"

    tags = {
      Name = "example-instance"
    }
  }
}
```

### Key Differences

| Feature                 | Launch Configurations | Launch Templates |
| ----------------------- | --------------------- | ---------------- |
| Multiple Instance Types | No                    | Yes              |
| Spot Instances          | No                    | Yes              |
| Versioning              | No                    | Yes              |
| Elastic Graphics        | No                    | Yes              |
| Placement Groups        | No                    | Yes              |
| T2/T3 Unlimited         | No                    | Yes              |

### When to Use Launch Configurations

- **Simplicity**: If you need a straightforward setup without advanced features.
- **Legacy Systems**: If you're working with older infrastructure that already uses Launch Configurations.

### When to Use Launch Templates

- **Flexibility**: If you need advanced features like multiple instance types or spot instances.
- **Future-Proofing**: AWS recommends using Launch Templates for new setups.
- **Cost Optimization**: Spot instances and mixed instance policies can reduce costs.

### Migrating from Launch Configurations to Launch Templates

If you're currently using Launch Configurations, consider migrating to Launch Templates to take advantage of their advanced features. AWS provides tools and documentation to assist with this migration.

By understanding the differences between Launch Templates and Launch Configurations, you can make informed decisions that align with your infrastructure needs and goals.
