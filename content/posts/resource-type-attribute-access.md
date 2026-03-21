---
title: 'Fixing "A Reference to Resource Type Must Be Followed by At Least One Attribute Access" in Terraform'
excerpt: "Learn how to resolve the error 'A reference to resource type must be followed by at least one attribute access' in Terraform."
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2024-08-15'
publishedAt: '2024-08-15T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Troubleshooting
  - DevOps
---

## TLDR

The error "A reference to resource type must be followed by at least one attribute access" occurs when you reference a resource type without specifying a resource name or attribute. To fix this, ensure you include both the resource name and the attribute in your reference.

---

Terraform requires that all resource references include both the resource name and an attribute. If you omit either, you'll encounter the error "A reference to resource type must be followed by at least one attribute access." This guide will show you how to resolve this issue.

### Why Does This Error Occur?

This error typically occurs when:

- You reference a resource type without specifying a resource name.
- You reference a resource name without specifying an attribute.

For example, the following code will trigger the error:

```hcl
output "example" {
  value = aws_instance
}
```

### How to Fix the Error

#### Step 1: Specify the Resource Name

Ensure you include the resource name in your reference. For example:

```hcl
output "example" {
  value = aws_instance.my_instance
}
```

#### Step 2: Specify an Attribute

Include an attribute to access a specific property of the resource. For example:

```hcl
output "example" {
  value = aws_instance.my_instance.id
}
```

### Common Scenarios

#### Referencing a Resource in Outputs

When defining outputs, always include both the resource name and an attribute:

```hcl
output "instance_id" {
  value = aws_instance.my_instance.id
}
```

#### Using Resources in Variables

When passing a resource to a variable, ensure you specify an attribute:

```hcl
variable "instance_id" {
  default = aws_instance.my_instance.id
}
```

### Best Practices

- **Use Descriptive Names**: Name your resources clearly to avoid confusion.
- **Validate Configuration**: Run `terraform validate` to catch errors early.
- **Review Documentation**: Check the Terraform documentation for the resource type to understand its attributes.

By following these steps, you can resolve the "A reference to resource type must be followed by at least one attribute access" error and ensure your Terraform configurations are correct.
