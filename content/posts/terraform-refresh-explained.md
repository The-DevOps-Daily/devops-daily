---
title: 'What Does Terraform Refresh Really Do?'
excerpt: 'Understand the purpose and functionality of the `terraform refresh` command in Terraform workflows.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2025-02-27'
publishedAt: '2025-02-27T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Refresh
  - State Management
  - Tutorials
---

## TLDR

The `terraform refresh` command updates the Terraform state file to match the real-world infrastructure. It does not modify resources but ensures the state file reflects the current state of your infrastructure.

---

The `terraform refresh` command is a useful tool in Terraform workflows for synchronizing the state file with the actual state of your infrastructure. This guide explains what it does, when to use it, and its limitations.

## What Does `terraform refresh` Do?

The `terraform refresh` command reads the current state of your infrastructure from the provider and updates the Terraform state file to match it. This ensures that the state file accurately represents the real-world infrastructure.

### Key Points

- **Reads Current State**: Queries the provider for the current state of resources.
- **Updates State File**: Modifies the state file to reflect the actual state.
- **No Resource Changes**: Does not create, update, or delete resources.

## Step 1: Check the Current State

Before running `terraform refresh`, you can inspect the current state file.

### Command

```bash
terraform show
```

### Example Output

```plaintext
# aws_instance.example:
resource "aws_instance" "example" {
  ami           = "ami-12345678"
  instance_type = "t2.micro"
  tags = {
    Name = "example-instance"
  }
}
```

### Explanation

- `terraform show`: Displays the current state file.
- `aws_instance.example`: Shows the details of the resource in the state file.

## Step 2: Run `terraform refresh`

Use the `terraform refresh` command to update the state file.

### Command

```bash
terraform refresh
```

### Example Output

```plaintext
Refreshing Terraform state in-memory prior to plan...
aws_instance.example: Refreshing state... [id=i-0abcd1234efgh5678]
```

### Explanation

- `Refreshing state...`: Indicates that Terraform is querying the provider for the current state.
- `[id=i-0abcd1234efgh5678]`: Shows the resource ID retrieved from the provider.

## Step 3: Verify the Updated State

After running `terraform refresh`, inspect the updated state file.

### Command

```bash
terraform show
```

### Explanation

- Compare the output before and after running `terraform refresh` to see the changes in the state file.

## When to Use `terraform refresh`

- **State File Out of Sync**: Use when the state file does not match the real-world infrastructure.
- **Debugging Issues**: Helps identify discrepancies between the state file and actual resources.
- **Before Planning**: Ensures the state file is up-to-date before running `terraform plan`.

## Limitations

- **No Resource Changes**: Does not modify resources in the real world.
- **Manual Intervention**: May require manual updates if discrepancies are found.
- **Deprecated in Terraform 1.1**: The `terraform refresh` command is deprecated in favor of `terraform plan -refresh-only`.

### Alternative Command

```bash
terraform plan -refresh-only
```

### Explanation

- `-refresh-only`: Updates the state file without proposing changes to resources.

## Best Practices

- **Run Regularly**: Use `terraform refresh` or `terraform plan -refresh-only` to keep the state file accurate.
- **Automate State Management**: Integrate state refresh into CI/CD pipelines.
- **Backup State Files**: Always back up state files before making changes.

By understanding and using the `terraform refresh` command effectively, you can maintain accurate state files and streamline your Terraform workflows.
