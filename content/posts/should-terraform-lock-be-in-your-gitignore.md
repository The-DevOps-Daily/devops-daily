---
title: 'Should .terraform.lock.hcl Be in .gitignore? (The Answer Might Surprise You)'
excerpt: 'The .terraform.lock.hcl file causes confusion for many Terraform users. Learn why you should commit it to version control and how to handle it properly.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2025-01-23'
publishedAt: '2025-01-23T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Version Control
  - Git
  - Infrastructure as Code
  - Best Practices
featured: true
---

If you've worked with Terraform for any length of time, you've probably encountered the `.terraform.lock.hcl` file and wondered: should this go in my `.gitignore` file alongside `.terraform/` directory?

The short answer is **no**, you should commit `.terraform.lock.hcl` to version control. But the reasoning behind this decision isn't immediately obvious, and getting it wrong can lead to frustrating deployment issues and inconsistent infrastructure across environments.

Let's explore why this file exists, what problems it solves, and how to handle it properly in your Terraform projects.

## Prerequisites

Before diving in, you should have:

- Basic knowledge of Terraform and Git
- Experience running `terraform init` and `terraform apply`
- Understanding of how dependency management works in other tools (like package.json in Node.js or requirements.txt in Python)

## What Is .terraform.lock.hcl?

The `.terraform.lock.hcl` file is Terraform's dependency lock file, introduced in Terraform 0.14. It records the exact versions of providers that Terraform selected during `terraform init`, similar to how `package-lock.json` works in Node.js projects.

Here's what a typical lock file looks like:

```hcl
# This file is maintained automatically by "terraform init".
# Manual edits may be lost in future updates.

provider "registry.terraform.io/hashicorp/aws" {
  version     = "4.67.0"
  constraints = "~> 4.16"
  hashes = [
    "h1:dCRc4GqsyfqHEMjgtlM1EiV9TiuTUu3DNrGDz4NB4L4=",
    "h1:xzpipYzqP0dTwotCNTD+4DsIPOGoXlYsX3nJDqHRrZM=",
    "zh:0843017ecc24385f2b45f2c5fce79dc25b258e50d516877b3affee3bef34f060",
    "zh:19876066cfa60de91834ec569a6448dab8c2518e8a6e2a8e8a6b5dd8b48f9e57",
    # More hashes...
  ]
}

provider "registry.terraform.io/hashicorp/random" {
  version = "3.5.1"
  hashes = [
    "h1:VSnd9ZIPyfKHOObuQCaKfnjIHRtR7qTw19Rz8tJxm+k=",
    "zh:04e3fbd610cb52c1017d282531364b9c53ef72b6bc533acb2a90671957324a64",
    # More hashes...
  ]
}
```

When you run `terraform init`, Terraform:

1. Reads your provider requirements from your configuration
2. Resolves the latest versions that match your constraints
3. Downloads the selected provider versions
4. Records the exact versions and their checksums in the lock file

## Why You Should Commit the Lock File

### Ensures Consistent Provider Versions

Without the lock file, each team member or CI/CD environment might select different provider versions, even with version constraints:

```terraform
# In your terraform configuration
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.16"
    }
  }
}
```

The `~> 4.16` constraint allows any version from 4.16.0 up to (but not including) 4.17.0. If you run `terraform init` today and get version 4.16.2, but your colleague runs it next week and gets 4.16.3, you might encounter subtle differences in behavior.

A real example from our experience: a client's staging environment used AWS provider 4.16.2, while production was accidentally deployed with 4.16.3. The newer version had different default security group behavior, causing connectivity issues that took hours to debug.

### Prevents Surprise Updates

Consider this scenario without a lock file:

```bash
# Developer A runs terraform init on Monday
$ terraform init
# Gets AWS provider 4.16.2

# Developer B runs terraform init on Wednesday
$ terraform init
# Gets AWS provider 4.16.4 (newly released)

# Developer B runs terraform plan
$ terraform plan
# Shows unexpected changes due to provider differences
```

With the lock file committed, both developers get the exact same provider version, eliminating this source of confusion.

### Provides Security Through Checksums

The lock file includes cryptographic checksums for each provider version:

```hcl
provider "registry.terraform.io/hashicorp/aws" {
  version = "4.67.0"
  hashes = [
    "h1:dCRc4GqsyfqHEMjgtlM1EiV9TiuTUu3DNrGDz4NB4L4=",
    "zh:0843017ecc24385f2b45f2c5fce79dc25b258e50d516877b3affee3bef34f060",
    # Additional checksums for different platforms
  ]
}
```

These checksums ensure that:

1. The provider binary hasn't been tampered with
2. You're getting the authentic provider from HashiCorp
3. Network issues don't result in corrupted downloads

### Enables Reproducible Infrastructure

Infrastructure as Code means your infrastructure should be reproducible. The lock file is essential for this:

```bash
# Any team member can reproduce the exact same environment
$ git clone your-terraform-repo
$ terraform init  # Uses locked versions
$ terraform apply # Deploys with consistent provider behavior
```

This reproducibility is crucial for:

- Disaster recovery scenarios
- Debugging production issues in development
- Ensuring compliance and audit requirements

## How to Handle the Lock File Properly

### Your .gitignore Should Look Like This

```gitignore
# Terraform files to ignore
.terraform/
*.tfstate
*.tfstate.*
*.tfvars
.terraform.tfstate.lock.info

# DO NOT ignore .terraform.lock.hcl
# This file should be committed to version control
```

Notice that `.terraform.lock.hcl` is **not** in the `.gitignore` file.

### Updating Provider Versions

When you want to update providers, use the `-upgrade` flag:

```bash
# Update providers to latest versions matching constraints
terraform init -upgrade

# Check what changed
git diff .terraform.lock.hcl

# Commit the updated lock file
git add .terraform.lock.hcl
git commit -m "Update AWS provider to 4.67.0"
```

This approach makes provider updates explicit and trackable in your version control history.

### Working with Multiple Platforms

If your team uses different operating systems or architectures, you might need to update the lock file to include hashes for all platforms:

```bash
# Add hashes for additional platforms
terraform providers lock \
  -platform=windows_amd64 \
  -platform=darwin_amd64 \
  -platform=linux_amd64
```

This ensures the lock file works for team members on Windows, macOS, and Linux.

## When You Might Consider Ignoring It (Rare Cases)

There are very few legitimate reasons to ignore the lock file:

### Experimental or Learning Projects

If you're just experimenting with Terraform locally and want to always get the latest provider versions:

```gitignore
# Only for experimental projects
.terraform.lock.hcl
```

But even for learning, we recommend keeping the lock file to understand how Terraform version management works.

### Template Repositories

If you're creating a Terraform template that others will use as a starting point, you might exclude the lock file so users generate their own based on current provider versions. However, most template users would benefit from known-good provider versions.

## Common Issues and Solutions

### Lock File Conflicts During Merges

When multiple developers update providers simultaneously, you might get merge conflicts in the lock file:

```bash
# Resolve by regenerating the lock file
$ rm .terraform.lock.hcl
$ terraform init
$ git add .terraform.lock.hcl
$ git commit -m "Resolve provider lock file conflict"
```

### CI/CD Consistency Issues

Ensure your CI/CD pipeline uses the same Terraform version and doesn't ignore the lock file:

```yaml
# GitHub Actions example
- name: Setup Terraform
  uses: hashicorp/setup-terraform@v2
  with:
    terraform_version: 1.5.0 # Pin Terraform version too

- name: Terraform Init
  run: terraform init # Uses lock file automatically
```

### Platform-Specific Issues

If you encounter platform-specific hash errors, update the lock file to include your platform:

```bash
# Error: could not verify provider hashes
terraform providers lock -help

# Add your platform
terraform providers lock -platform=darwin_arm64
```

## Comparing with Other Tools

This approach mirrors other dependency management tools:

| Tool      | Lock File           | Should Commit? |
| --------- | ------------------- | -------------- |
| Node.js   | package-lock.json   | ✅ Yes         |
| Python    | poetry.lock         | ✅ Yes         |
| Ruby      | Gemfile.lock        | ✅ Yes         |
| Terraform | .terraform.lock.hcl | ✅ Yes         |

The pattern is consistent across the industry: lock files should be committed to ensure reproducible builds and deployments.

## Best Practices Summary

1. **Always commit** `.terraform.lock.hcl` to version control
2. **Use `terraform init -upgrade`** when you want to update providers
3. **Review lock file changes** in pull requests to catch unexpected updates
4. **Include multiple platform hashes** if your team uses different operating systems
5. **Pin your Terraform version** in addition to provider versions for maximum consistency

## Real-World Impact

A fintech company we worked with learned this lesson the hard way. They initially ignored the lock file because they "wanted the latest security updates." During a critical deployment, their production environment ended up with a different AWS provider version than staging, causing new resources to be created with different default settings. This resulted in a security group misconfiguration that exposed sensitive services.

After implementing proper lock file management, they eliminated environment drift and could confidently deploy knowing their infrastructure would behave consistently across all environments.

The `.terraform.lock.hcl` file isn't just another file to manage, it's a crucial component of reproducible infrastructure. By committing it to version control, you ensure that your team can collaborate effectively and your infrastructure behaves predictably across all environments.

Remember: infrastructure as code means your infrastructure should be as predictable and reproducible as your application code. The lock file is essential for achieving this goal.
