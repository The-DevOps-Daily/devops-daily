---
title: 'How to Nuke All AWS Resources in an AWS Account'
excerpt: 'Learn how to safely and efficiently delete all resources in an AWS account using tools like AWS CLI and Terraform.'
category:
  name: 'AWS'
  slug: 'aws'
date: '2024-10-30'
publishedAt: '2024-10-30T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - AWS
  - Automation
  - DevOps
  - Resource Management
---

## TLDR

To delete all resources in an AWS account, you can use tools like AWS CLI or third-party tools like `aws-nuke`. Be cautious when performing this operation, as it is irreversible and can lead to data loss.

---

There are scenarios where you might need to delete all resources in an AWS account, such as decommissioning an environment or cleaning up after testing. This guide will show you how to safely and efficiently nuke all AWS resources.

### Why Nuke All Resources?

- **Cost Management**: Remove unused resources to avoid unnecessary charges.
- **Environment Cleanup**: Decommission test or staging environments.
- **Account Reuse**: Prepare an account for a new project or team.

### Using AWS CLI

The AWS CLI provides commands to delete resources, but you'll need to script the process to handle all resource types.

#### Example: Deleting S3 Buckets

```bash
aws s3 ls | awk '{print $3}' | xargs -I {} aws s3 rb s3://{} --force
```

This command lists all S3 buckets and deletes them forcefully.

#### Example: Deleting EC2 Instances

```bash
aws ec2 describe-instances --query 'Reservations[*].Instances[*].InstanceId' --output text | xargs aws ec2 terminate-instances --instance-ids
```

This command terminates all EC2 instances in the account.

### Using `aws-nuke`

`aws-nuke` is a third-party tool designed to delete all resources in an AWS account. It is more comprehensive and easier to use than scripting with AWS CLI.

#### Step 1: Install `aws-nuke`

Follow the installation instructions from the [aws-nuke GitHub repository](https://github.com/rebuy-de/aws-nuke).

#### Step 2: Configure `aws-nuke`

Create a configuration file specifying the account and regions to target.

```yaml
regions:
  - 'us-east-1'
  - 'us-west-2'

account-blocklist:
  - '123456789012' # Add accounts you want to exclude

accounts:
  '123456789012': {}
```

#### Step 3: Run `aws-nuke`

Run the tool to delete all resources.

```bash
aws-nuke -c config.yaml --no-dry-run
```

### Best Practices

- **Use Dry Run**: Always perform a dry run before executing destructive commands.
- **Backup Data**: Ensure all critical data is backed up before nuking resources.
- **Restrict Access**: Limit access to the account to prevent accidental deletions.
- **Monitor Costs**: Use AWS Cost Explorer to verify that all resources have been deleted.

By following these steps, you can safely and efficiently delete all resources in an AWS account. Use caution and double-check your configurations to avoid unintended consequences.
