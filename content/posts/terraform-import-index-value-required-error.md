---
title: 'How to Fix Terraform Import "Index Value Required" Error for String Keys'
excerpt: "Learn how to resolve the 'Index value required' error when importing resources with for_each in Terraform, and understand the correct syntax for string-based resource keys."
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2024-11-28'
publishedAt: '2024-11-28T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Infrastructure as Code
  - Troubleshooting
  - Import
  - DevOps
---

When you try to import an existing resource into Terraform that was created with `for_each`, you might encounter an error like "Index value required" or "A reference to a resource type must be followed by at least one attribute access." This happens because Terraform needs to know which specific instance from the `for_each` map you're importing into.

Understanding how to properly reference `for_each` resources during import is essential for bringing existing infrastructure under Terraform management.

**TLDR:** When importing resources created with `for_each`, you must specify the key in square brackets with proper quoting: `terraform import 'aws_instance.servers["web"]' i-1234567890abcdef0`. The key must be quoted and the entire resource address should be wrapped in single quotes to prevent shell interpretation. For numeric keys, use `resource["0"]` syntax. The error occurs when you reference the resource without specifying which instance from the for_each map to import into.

## Understanding the Error

When you have a resource created with `for_each`:

```hcl
resource "aws_instance" "servers" {
  for_each = {
    web = {
      instance_type = "t3.medium"
    }
    api = {
      instance_type = "t3.large"
    }
  }

  ami           = var.ami_id
  instance_type = each.value.instance_type

  tags = {
    Name = each.key
  }
}
```

The resource `aws_instance.servers` is actually a map with keys `"web"` and `"api"`. When importing, you can't just reference `aws_instance.servers` - you need to specify which key you're importing.

If you try:

```bash
# This will fail
terraform import aws_instance.servers i-1234567890abcdef0
```

You'll get an error like:

```
Error: Index value required

A reference to a resource type must be followed by at least one attribute access, specifying the resource name.
```

## Correct Import Syntax for for_each Resources

The correct syntax uses square brackets to specify the key:

```bash
# Import the "web" instance
terraform import 'aws_instance.servers["web"]' i-1234567890abcdef0

# Import the "api" instance
terraform import 'aws_instance.servers["api"]' i-9876543210fedcba0
```

The single quotes around the resource address are important - they prevent your shell from interpreting the square brackets and quotes.

## Different Shell Quoting Requirements

Different shells handle quoting differently:

**Bash/Zsh (Linux/macOS):**

```bash
# Single quotes - recommended
terraform import 'aws_instance.servers["web"]' i-1234567890abcdef0

# Double quotes with escaping
terraform import "aws_instance.servers[\"web\"]" i-1234567890abcdef0
```

**PowerShell (Windows):**

```powershell
# Use backticks to escape quotes
terraform import "aws_instance.servers[\`"web\`"]" i-1234567890abcdef0

# Or single quotes for the whole thing
terraform import 'aws_instance.servers["web"]' i-1234567890abcdef0
```

**Windows Command Prompt:**

```cmd
# Double quotes without escaping inner quotes works
terraform import "aws_instance.servers[\"web\"]" i-1234567890abcdef0
```

## Importing Multiple for_each Instances

You need to import each instance separately:

```bash
# Import all instances from the for_each
terraform import 'aws_instance.servers["web"]' i-1234567890abcdef0
terraform import 'aws_instance.servers["api"]' i-9876543210fedcba0
terraform import 'aws_instance.servers["worker"]' i-abcdef1234567890
```

For many resources, create a script:

```bash
#!/bin/bash
# import-servers.sh

declare -A servers=(
  ["web"]="i-1234567890abcdef0"
  ["api"]="i-9876543210fedcba0"
  ["worker"]="i-abcdef1234567890"
)

for key in "${!servers[@]}"; do
  echo "Importing $key instance..."
  terraform import "aws_instance.servers[\"$key\"]" "${servers[$key]}"
done
```

Make it executable and run:

```bash
chmod +x import-servers.sh
./import-servers.sh
```

## Numeric String Keys

If your `for_each` uses numeric string keys, you still need quotes:

```hcl
resource "aws_subnet" "private" {
  for_each = {
    "0" = "10.0.1.0/24"
    "1" = "10.0.2.0/24"
    "2" = "10.0.3.0/24"
  }

  vpc_id     = aws_vpc.main.id
  cidr_block = each.value

  tags = {
    Name = "private-subnet-${each.key}"
  }
}
```

Import with quoted numeric keys:

```bash
terraform import 'aws_subnet.private["0"]' subnet-abc123
terraform import 'aws_subnet.private["1"]' subnet-def456
terraform import 'aws_subnet.private["2"]' subnet-ghi789
```

## Finding the Correct Key to Use

If you're not sure what keys exist in your configuration, check your Terraform code:

```bash
# Look at the for_each definition
grep -A 10 "for_each" main.tf

# Or use terraform console
terraform console
> keys(aws_instance.servers)
["api", "web", "worker"]
```

For resources already in state:

```bash
# List resources in state
terraform state list

# You'll see output like:
# aws_instance.servers["web"]
# aws_instance.servers["api"]
```

## Converting count to for_each Before Import

If you're migrating from `count` to `for_each`, you need to move resources in state:

```hcl
# Old configuration with count
resource "aws_instance" "servers" {
  count = 3

  ami           = var.ami_id
  instance_type = "t3.medium"
}

# New configuration with for_each
resource "aws_instance" "servers" {
  for_each = {
    web    = { type = "t3.medium" }
    api    = { type = "t3.large" }
    worker = { type = "t3.small" }
  }

  ami           = var.ami_id
  instance_type = each.value.type
}
```

Move existing resources to match new keys:

```bash
# Move from count index to for_each key
terraform state mv 'aws_instance.servers[0]' 'aws_instance.servers["web"]'
terraform state mv 'aws_instance.servers[1]' 'aws_instance.servers["api"]'
terraform state mv 'aws_instance.servers[2]' 'aws_instance.servers["worker"]'
```

## Import With Special Characters in Keys

If your keys contain special characters, they still need to be quoted:

```hcl
resource "aws_s3_bucket" "apps" {
  for_each = {
    "my-app.example.com" = {
      versioning = true
    }
    "api-v2.example.com" = {
      versioning = false
    }
  }

  bucket = each.key

  versioning {
    enabled = each.value.versioning
  }
}
```

Import with special characters:

```bash
# Dots, hyphens, and other characters need quoting
terraform import 'aws_s3_bucket.apps["my-app.example.com"]' my-app.example.com
terraform import 'aws_s3_bucket.apps["api-v2.example.com"]' api-v2.example.com
```

## Generating Import Statements Automatically

Create a script that generates import commands from existing AWS resources:

```bash
#!/bin/bash
# generate-imports.sh

# List all EC2 instances with a specific tag
aws ec2 describe-instances \
  --filters "Name=tag:ManagedBy,Values=terraform" \
  --query 'Reservations[*].Instances[*].[Tags[?Key==`Name`].Value|[0],InstanceId]' \
  --output text | \
while read name instance_id; do
  echo "terraform import 'aws_instance.servers[\"$name\"]' $instance_id"
done
```

This outputs import commands you can review and execute:

```bash
./generate-imports.sh
# Output:
# terraform import 'aws_instance.servers["web"]' i-1234567890abcdef0
# terraform import 'aws_instance.servers["api"]' i-9876543210fedcba0
```

## Using import Blocks (Terraform 1.5+)

Starting with Terraform 1.5, you can use `import` blocks instead of the CLI:

```hcl
# Define the import
import {
  to = aws_instance.servers["web"]
  id = "i-1234567890abcdef0"
}

import {
  to = aws_instance.servers["api"]
  id = "i-9876543210fedcba0"
}

# Your resource configuration
resource "aws_instance" "servers" {
  for_each = {
    web = { instance_type = "t3.medium" }
    api = { instance_type = "t3.large" }
  }

  ami           = var.ami_id
  instance_type = each.value.instance_type
}
```

Run terraform plan to see what will be imported:

```bash
terraform plan -generate-config-out=generated.tf
```

This generates the configuration for imported resources automatically.

## Debugging Import Issues

If imports are still failing, verify the resource address:

```bash
# Check if the resource exists in your config
terraform providers schema -json | jq '.provider_schemas'

# Validate your configuration
terraform validate

# Check what Terraform expects
terraform plan
```

For complex scenarios, use terraform console to test expressions:

```bash
terraform console
> aws_instance.servers
{
  "api" = { ... }
  "web" = { ... }
}
> aws_instance.servers["web"]
{ ... instance details ... }
```

## Common Mistakes

**Forgetting quotes around the key:**

```bash
# Wrong - shell interprets brackets
terraform import aws_instance.servers[web] i-1234567890abcdef0

# Correct
terraform import 'aws_instance.servers["web"]' i-1234567890abcdef0
```

**Using the wrong quote style:**

```bash
# Wrong - shell expands $key
terraform import "aws_instance.servers[$key]" i-1234567890abcdef0

# Correct
terraform import "aws_instance.servers[\"$key\"]" i-1234567890abcdef0
```

**Not matching the for_each key exactly:**

```hcl
# Configuration uses lowercase
for_each = {
  web = { ... }
}
```

```bash
# Wrong - case doesn't match
terraform import 'aws_instance.servers["Web"]' i-1234567890abcdef0

# Correct - exact match
terraform import 'aws_instance.servers["web"]' i-1234567890abcdef0
```

## Import Verification

After importing, verify it worked:

```bash
# Check state
terraform state show 'aws_instance.servers["web"]'

# Run a plan - should show no changes
terraform plan

# If there are changes, your config doesn't match the imported resource
```

If `terraform plan` shows changes after import, your configuration doesn't match the actual resource. Update your Terraform code to match the imported resource's current state.

## Bulk Import Script

For importing many resources:

```bash
#!/bin/bash
# bulk-import.sh

# Read from a CSV file: key,resource_id
# Example: web,i-1234567890abcdef0

while IFS=',' read -r key resource_id; do
  echo "Importing $key ($resource_id)..."

  if terraform import "aws_instance.servers[\"$key\"]" "$resource_id"; then
    echo "✓ Successfully imported $key"
  else
    echo "✗ Failed to import $key"
  fi

  sleep 1  # Rate limiting
done < servers.csv
```

Create `servers.csv`:

```csv
web,i-1234567890abcdef0
api,i-9876543210fedcba0
worker,i-abcdef1234567890
```

Run the script:

```bash
chmod +x bulk-import.sh
./bulk-import.sh
```

The "Index value required" error when importing for_each resources is straightforward to fix once you understand that Terraform needs to know which specific instance you're importing. Always use square bracket notation with proper quoting, and remember that the key must exactly match what's in your for_each expression.
