---
title: 'How to Execute Terraform Actions Without the Interactive Prompt'
excerpt: 'Learn how to automate Terraform workflows by bypassing the interactive prompt for commands like apply and destroy.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2024-11-20'
publishedAt: '2024-11-20T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Automation
  - DevOps
  - Infrastructure as Code
---

## TLDR

You can bypass Terraform's interactive prompts by using the `-auto-approve` flag for `apply` and `destroy` commands. This is useful for automation and CI/CD pipelines.

---

Terraform's interactive prompts are designed to prevent accidental changes to your infrastructure. However, in automated workflows, such as CI/CD pipelines, these prompts can be a hindrance. This guide will show you how to execute Terraform actions without the interactive prompt.

### Why Automate Terraform Actions?

- **Efficiency**: Automating Terraform actions saves time and reduces manual effort.
- **Consistency**: Ensures that infrastructure changes are applied in a predictable manner.
- **Integration**: Necessary for CI/CD pipelines and other automated workflows.

### Using the `-auto-approve` Flag

The `-auto-approve` flag skips the interactive approval step for `terraform apply` and `terraform destroy`. This is particularly useful in scripts and pipelines.

#### Example: Applying Changes

To apply changes without confirmation, use the following command:

```bash
terraform apply -auto-approve
```

This command applies the Terraform configuration without asking for confirmation.

#### Example: Destroying Resources

To destroy resources without confirmation, use:

```bash
terraform destroy -auto-approve
```

This command destroys all resources managed by the Terraform configuration without requiring confirmation.

### Automating Variable Inputs

In addition to bypassing prompts, you may need to provide variable values non-interactively. Use a `.tfvars` file or the `-var` flag.

#### Using a `.tfvars` File

Create a file named `terraform.tfvars` with your variable values:

```hcl
aws_region = "us-east-1"
instance_type = "t2.micro"
```

Terraform automatically loads this file during execution.

#### Using the `-var` Flag

You can also pass variables directly in the command:

```bash
terraform apply -var="aws_region=us-east-1" -var="instance_type=t2.micro" -auto-approve
```

### Disabling Interactive Prompts Globally

If you want to disable interactive prompts for all Terraform commands, set the `TF_INPUT` environment variable to `false`.

#### Example

Here's how to set the environment variable and run Terraform commands:

```bash
export TF_INPUT=false
terraform apply -auto-approve
```

This approach is useful for environments where you want to enforce non-interactive behavior.

### Best Practices

- **Use with Caution**: Skipping prompts can lead to unintended changes. Always review your plan before applying.
- **Combine with `terraform plan`**: Run `terraform plan` to preview changes before applying them.
- **Secure Variable Files**: If using `.tfvars` files, ensure they are not exposed in version control.

By automating Terraform actions and bypassing interactive prompts, you can streamline your workflows and integrate Terraform into your CI/CD pipelines effectively.
