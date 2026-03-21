---
title: 'How can I remove a resource from Terraform state?'
excerpt: 'Learn how to safely remove a resource from Terraform state without affecting the actual infrastructure.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2024-06-17'
publishedAt: '2024-06-17T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '4 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - State Management
  - DevOps
---

Sometimes, you may need to remove a resource from Terraform state without deleting the actual resource. This is useful when you want Terraform to stop managing a resource.

## Why Remove a Resource from State?

There are several reasons you might want to remove a resource from Terraform state:

- **Manual Management**: You want to manage the resource manually outside of Terraform.
- **Resource Migration**: The resource is being moved to another Terraform configuration.
- **State Cleanup**: The resource is no longer relevant to your current configuration.

## Steps to Remove a Resource from State

To safely remove a resource from Terraform state, follow these steps:

### Step 1: Identify the Resource

Run the following command to list all resources in the state file:

```bash
terraform state list
```

This will display a list of all resources managed by Terraform. Note the name of the resource you want to remove.

### Step 2: Remove the Resource

Use the `terraform state rm` command to remove the resource from the state file:

```bash
terraform state rm aws_instance.example
```

### Step 3: Verify the State

Run `terraform plan` to ensure the resource is no longer managed by Terraform. The plan should not include any actions for the removed resource.

## Best Practices

- **Backup State Files**: Always back up your state file before making changes.
- **Document Changes**: Keep a record of resources removed from the state for future reference.
- **Use Remote Backends**: Store your state file in a remote backend for better security and collaboration.

By following these steps, you can safely remove resources from Terraform state without impacting your infrastructure.
