---
title: 'Terraform - Delete All Resources Except One'
excerpt: 'Learn how to delete all resources managed by Terraform except for a specific resource by using targeted commands and state manipulation.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2024-04-22'
publishedAt: '2024-04-22T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Resource Management
  - DevOps
---

## TLDR

To delete all resources except one in Terraform, use the `terraform state rm` command to remove the resource from the state file temporarily, then run `terraform destroy` to delete the remaining resources.

---

Terraform's `destroy` command deletes all resources managed by the state file. However, there are scenarios where you might want to delete all resources except one. This guide will show you how to achieve this safely.

### Why Delete All Resources Except One?

- **Cost Management**: Decommission unused resources while keeping critical ones.
- **Environment Cleanup**: Reset an environment without affecting essential resources.
- **Migration**: Prepare for resource migration by retaining specific resources.

### Steps to Delete All Resources Except One

To delete all resources managed by Terraform except for a specific resource, you can follow these steps:

#### Step 1: Identify the Resource to Keep

Use the `terraform state list` command to list all resources in the state file and identify the one you want to keep.

```bash
terraform state list
```

#### Step 2: Remove the Resource from the State File

Use the `terraform state rm` command to remove the resource from the state file temporarily. This prevents Terraform from managing or deleting it.

```bash
terraform state rm aws_instance.example
```

#### Step 3: Destroy Remaining Resources

Run the `terraform destroy` command to delete all other resources managed by the state file.

```bash
terraform destroy
```

#### Step 4: Reimport the Resource

After the destruction is complete, reimport the resource into the state file using the `terraform import` command.

```bash
terraform import aws_instance.example i-1234567890abcdef0
```

### Best Practices

- **Backup State File**: Always create a backup of the state file before making changes.
- **Use Remote State**: Store the state file in a remote backend to simplify management.
- **Test in Non-Production**: Validate the process in a non-production environment before applying it to production.

By following these steps, you can delete all resources managed by Terraform except for a specific resource, ensuring a clean and controlled environment.
