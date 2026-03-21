---
title: 'Using a Git Branch as a Source for Terraform Modules'
excerpt: 'Learn how to use a specific Git branch as the source for Terraform modules to manage versioning and development workflows.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2024-07-26'
publishedAt: '2024-07-26T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Modules
  - Git
  - DevOps
---

## TLDR

To use a Git branch as the source for a Terraform module, specify the branch name in the `source` argument using the `?ref=` query parameter. This allows you to manage module versions dynamically.

---

Terraform modules are reusable configurations that simplify infrastructure management. By using a Git branch as the source for a module, you can manage versions and collaborate on module development effectively. This guide will show you how to use a Git branch as a module source.

### Why Use a Git Branch as a Module Source?

- **Version Control**: Use branches to manage different versions of a module.
- **Collaboration**: Share module updates with your team during development.
- **Flexibility**: Test changes in a branch before merging them into the main branch.

### Specifying a Git Branch as a Module Source

Use the `source` argument in your module block to specify the Git repository and branch. The `?ref=` query parameter allows you to select a specific branch.

#### Example: Using a Git Branch

```hcl
module "example" {
  source = "git::https://github.com/your-org/your-module.git?ref=feature-branch"

  # Module inputs
  region = "us-east-1"
  name   = "example"
}
```

In this example, the `feature-branch` branch is used as the source for the module.

### Using SSH for Private Repositories

If the repository is private, use the SSH URL instead of HTTPS.

#### Example: Using SSH

For private repositories, you can specify the source using SSH:

```hcl
module "example" {
  source = "git::ssh://git@github.com/your-org/your-module.git?ref=feature-branch"

  # Module inputs
  region = "us-east-1"
  name   = "example"
}
```

Ensure your SSH key is configured for authentication.

### Best Practices

- **Pin to Specific Branches**: Use branches for development and testing, but pin to tags for production.
- **Use Version Tags**: Prefer version tags for stable releases to ensure consistency.
- **Document Module Inputs**: Clearly document the inputs and outputs of your module.
- **Test Changes**: Validate module changes in a non-production environment before merging them into the main branch.

By using a Git branch as a source for Terraform modules, you can streamline development workflows and manage module versions effectively.
