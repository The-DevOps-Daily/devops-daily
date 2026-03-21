---
title: 'How to Ignore Change of an Attribute in Terraform Blocks'
excerpt: 'Learn how to use the `lifecycle` block with the `ignore_changes` argument to ignore changes to specific attributes in Terraform.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2024-12-09'
publishedAt: '2024-12-09T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Configuration Management
  - DevOps
---

## TLDR

To ignore changes to a specific attribute in Terraform, use the `lifecycle` block with the `ignore_changes` argument. This is useful for attributes managed outside of Terraform or for temporary overrides.

---

Terraform's `lifecycle` block allows you to control how resources are managed. The `ignore_changes` argument is particularly useful for ignoring changes to specific attributes, such as those managed by external systems or temporary overrides.

### Why Ignore Changes?

- **External Management**: Some attributes are managed outside of Terraform, such as by a cloud provider or another tool.
- **Temporary Overrides**: Ignore changes to attributes that are temporarily modified.
- **Avoid Unnecessary Updates**: Prevent Terraform from overwriting changes made outside of its control.

### Using `ignore_changes`

The `ignore_changes` argument is part of the `lifecycle` block. You can specify one or more attributes to ignore.

#### Example: Ignoring a Single Attribute

```hcl
resource "azurerm_virtual_machine" "example" {
  name                  = "example-vm"
  location              = azurerm_resource_group.example.location
  resource_group_name   = azurerm_resource_group.example.name
  network_interface_ids = [azurerm_network_interface.example.id]
  vm_size               = "Standard_DS1_v2"

  lifecycle {
    ignore_changes = ["vm_size"]
  }
}
```

In this example, changes to the `vm_size` attribute are ignored.

#### Example: Ignoring Multiple Attributes

Here's how to ignore multiple attributes:

```hcl
resource "aws_instance" "example" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t2.micro"
  tags = {
    Name = "example-instance"
  }

  lifecycle {
    ignore_changes = ["tags[\"Name\"]", "instance_type"]
  }
}
```

In this example, changes to the `Name` tag and `instance_type` are ignored.

### Best Practices

- **Use Sparingly**: Only ignore changes when absolutely necessary to avoid configuration drift.
- **Document Reasons**: Clearly document why changes are being ignored.
- **Monitor Resources**: Regularly review ignored attributes to ensure they are still relevant.

By using the `ignore_changes` argument, you can manage resources more flexibly in Terraform, avoiding unnecessary updates and conflicts.
