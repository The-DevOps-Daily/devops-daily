---
title: 'How to Migrate Terraform State Between Projects'
excerpt: 'Learn how to safely migrate Terraform state between projects using the `terraform state` command.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2024-05-05'
publishedAt: '2024-05-05T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - State Management
  - DevOps
---

## TLDR

To migrate Terraform state between projects, use the `terraform state pull` and `terraform state push` commands. This process involves exporting the state from the source project and importing it into the target project.

---

Terraform state files track the resources managed by your configurations. Migrating state between projects is necessary when splitting a monolithic configuration into smaller ones or consolidating multiple configurations. This guide will show you how to migrate Terraform state safely.

### Why Migrate State?

- **Modularity**: Split a large configuration into smaller, more manageable projects.
- **Collaboration**: Separate state files for different teams or environments.
- **Consolidation**: Merge multiple configurations into a single project.

### Steps to Migrate State

#### Step 1: Backup the State File

Before making any changes, create a backup of the state file to avoid accidental data loss.

```bash
terraform state pull > terraform.tfstate.backup
```

#### Step 2: Identify Resources to Migrate

List the resources in the state file to identify which ones need to be migrated.

```bash
terraform state list
```

#### Step 3: Remove Resources from the Source Project

Use the `terraform state rm` command to remove the resources from the source project.

```bash
terraform state rm aws_instance.example
```

#### Step 4: Import Resources into the Target Project

In the target project, use the `terraform import` command to add the resources to the new state file.

```bash
terraform import aws_instance.example i-1234567890abcdef0
```

#### Step 5: Verify the Migration

Run `terraform plan` in both projects to ensure the state migration was successful and no resources are missing.

### Best Practices

- **Use Remote State**: Store state files in a remote backend like S3 to simplify management.
- **Document Changes**: Keep a record of the migration process for future reference.
- **Test in Non-Production**: Validate the migration in a non-production environment before applying it to production.

By following these steps, you can safely migrate Terraform state between projects, ensuring a smooth transition and minimal disruption to your infrastructure.
