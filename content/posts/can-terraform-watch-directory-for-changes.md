---
title: 'Can Terraform Watch a Directory for Changes? Working With Dynamic Files'
excerpt: "Learn how to handle scenarios where you need Terraform to respond to file changes, and explore alternatives to automatic directory watching."
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2025-04-05'
publishedAt: '2025-04-05T13:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Infrastructure as Code
  - Automation
  - File Watching
  - DevOps
---

Terraform doesn't have a built-in watch mode that automatically detects file changes and re-applies your configuration. Unlike development tools that continuously monitor files and reload on changes, Terraform follows a deliberate, explicit workflow where you decide when to plan and apply changes.

However, there are several patterns for working with files that change frequently, and ways to set up automated workflows that respond to changes in your Terraform configurations or data files.

**TLDR:** Terraform itself doesn't watch directories for changes - it's designed for explicit, controlled infrastructure updates. You can detect file changes using file hashes with `filemd5()` or `sha256()` functions to trigger resource updates when files change. For automation, use CI/CD pipelines triggered by Git commits, file watchers with tools like `watchexec` or `entr`, or Terraform Cloud's VCS integration. For frequently changing data, consider using data sources or external systems instead of files.

## Why Terraform Doesn't Watch Files

Terraform is designed for deliberate infrastructure management. Every change goes through a plan phase where you review what will happen before applying it. This prevents accidental changes and gives you control over when infrastructure updates occur.

```
Traditional watch mode:              Terraform workflow:
File changes → Auto reload           Edit files → Review plan → Apply
      ↓                                    ↓            ↓          ↓
  Instant update                      Explicit      Safe     Controlled
  (risky for infra)                   decision    review     update
```

Automatically applying infrastructure changes when files change would bypass this review step and could lead to costly mistakes or outages.

That said, you often need to respond to file changes. The question is how to do it safely and appropriately for your use case.

## Detecting File Changes With Hashes

Terraform can detect when file content changes by using hash functions. This triggers resource updates only when the file actually changes:

```hcl
resource "aws_lambda_function" "processor" {
  filename         = "${path.module}/lambda/function.zip"
  function_name    = "data-processor"
  role            = aws_iam_role.lambda.arn
  handler         = "index.handler"
  runtime         = "python3.11"

  # Terraform detects changes to the zip file and updates the Lambda
  source_code_hash = filebase64sha256("${path.module}/lambda/function.zip")
}
```

The `source_code_hash` attribute tells AWS Lambda when the code has changed. Terraform recalculates the hash every time you run `terraform plan`, and if the file content changed, it knows to update the Lambda function.

For other resources, you can use similar patterns:

```hcl
resource "aws_s3_object" "config" {
  bucket = aws_s3_bucket.configs.id
  key    = "app/config.json"
  source = "${path.module}/configs/app-config.json"

  # Update the S3 object whenever the source file changes
  etag = filemd5("${path.module}/configs/app-config.json")
}

resource "aws_instance" "app" {
  ami           = var.ami_id
  instance_type = "t3.medium"

  # Update user data when the script changes
  user_data = file("${path.module}/scripts/init.sh")

  # Force replacement when user data changes
  user_data_replace_on_change = true

  tags = {
    # Include the script hash in tags so you can track versions
    ScriptVersion = filemd5("${path.module}/scripts/init.sh")
  }
}
```

These functions recalculate on every plan, so Terraform always knows if files have changed since the last apply.

## Loading Multiple Files Dynamically

When you have a directory of files that might change, you can load them all dynamically:

```hcl
locals {
  # Find all JSON config files
  config_files = fileset("${path.module}/configs", "*.json")

  # Load each file and create a map
  configs = {
    for filename in local.config_files :
    trimsuffix(filename, ".json") => jsondecode(file("${path.module}/configs/${filename}"))
  }
}

# Create an S3 object for each config file
resource "aws_s3_object" "configs" {
  for_each = local.config_files

  bucket = aws_s3_bucket.configs.id
  key    = "configs/${each.value}"
  source = "${path.module}/configs/${each.value}"
  etag   = filemd5("${path.module}/configs/${each.value}")

  content_type = "application/json"
}
```

If you add, remove, or modify files in the `configs` directory, the next `terraform plan` will detect the changes:
- New files → new resources created
- Removed files → corresponding resources destroyed
- Modified files → resources updated (detected via `etag`)

This gives you dynamic behavior without needing a watch mode.

## Using Triggers for File-Based Updates

Sometimes you want a resource to be recreated whenever certain files change. Use `terraform_data` (or `null_resource` in older Terraform versions) with triggers:

```hcl
# This resource is recreated whenever any Python file changes
resource "terraform_data" "app_version" {
  triggers_replace = [
    for f in fileset("${path.module}/app", "**/*.py") :
    filemd5("${path.module}/app/${f}")
  ]
}

resource "aws_ecs_task_definition" "app" {
  family = "app"

  container_definitions = jsonencode([{
    name  = "app"
    image = "${aws_ecr_repository.app.repository_url}:${terraform_data.app_version.id}"
    # ... other config
  }])

  # Force new task definition when app files change
  lifecycle {
    replace_triggered_by = [terraform_data.app_version]
  }
}
```

Whenever any Python file in the `app` directory changes, `terraform_data.app_version` is replaced, which triggers the `aws_ecs_task_definition` to be recreated.

## Automating Terraform With File Watchers

If you need automatic execution when files change during development, use a file watcher tool that runs Terraform for you:

```bash
# Using watchexec (install with: brew install watchexec)
watchexec --exts tf,tfvars --restart 'terraform plan'
```

This watches for changes to `.tf` and `.tfvars` files and runs `terraform plan` whenever they change. You still need to manually run `terraform apply` after reviewing the plan.

For a more complete workflow:

```bash
# Watch Terraform files and automatically plan + apply
watchexec --exts tf --restart 'terraform plan -out=tfplan && terraform apply tfplan'
```

This automatically applies changes, which is useful for development but dangerous for production. Only use auto-apply in isolated development environments.

Another option is `entr`:

```bash
# Install: brew install entr (macOS) or apt-get install entr (Linux)

# Watch all Terraform files and run plan
find . -name "*.tf" | entr -c terraform plan
```

The `-c` flag clears the screen before each run, making output easier to read.

## CI/CD Integration for Production

For production infrastructure, don't rely on local file watching. Use a CI/CD pipeline that triggers on Git commits:

```yaml
# .github/workflows/terraform.yml

name: Terraform
on:
  push:
    branches: [main]
    paths:
      - 'terraform/**'
      - 'configs/**'
  pull_request:
    branches: [main]
    paths:
      - 'terraform/**'
      - 'configs/**'

jobs:
  terraform:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v2

      - name: Terraform Init
        run: terraform init
        working-directory: ./terraform

      - name: Terraform Plan
        run: terraform plan -out=tfplan
        working-directory: ./terraform

      - name: Terraform Apply
        if: github.ref == 'refs/heads/main' && github.event_name == 'push'
        run: terraform apply -auto-approve tfplan
        working-directory: ./terraform
```

This workflow runs whenever Terraform or config files change in the specified paths. It automatically applies changes on the main branch after review via pull request.

You can also trigger based on specific file patterns:

```yaml
on:
  push:
    paths:
      - 'terraform/modules/networking/**'
      - 'terraform/environments/prod/**'
      - 'configs/*.json'
```

## Terraform Cloud VCS Integration

Terraform Cloud automatically watches your Git repository and runs plans when you push changes:

```hcl
terraform {
  cloud {
    organization = "my-company"

    workspaces {
      name = "production-infrastructure"
    }
  }
}
```

With VCS integration configured, every commit to your connected repository triggers a Terraform plan. You can configure auto-apply for automatic deployment or require manual approval:

```
Git Push → Terraform Cloud → Automatic Plan → Review → Manual/Auto Apply
```

This gives you continuous infrastructure deployment without running Terraform locally.

You can also configure path-based triggers:

```hcl
# In Terraform Cloud workspace settings (via UI or API)
# Specify which paths should trigger runs:
# - terraform/
# - configs/
# - modules/networking/
```

## Handling Frequently Changing Data

If you're tempted to watch files because your data changes frequently, consider whether Terraform is the right tool:

```hcl
# AVOID: Frequently changing data in files
locals {
  # This requires running Terraform every time the file changes
  current_config = jsondecode(file("${path.module}/latest-config.json"))
}
```

Better alternatives:

**Use data sources to fetch current state:**

```hcl
# Fetch current configuration from an API
data "http" "current_config" {
  url = "https://api.example.com/config/current"
}

locals {
  config = jsondecode(data.http.current_config.body)
}
```

**Use Systems Manager Parameter Store or Secrets Manager:**

```hcl
data "aws_ssm_parameter" "app_config" {
  name = "/app/config"
}

resource "aws_instance" "app" {
  user_data = templatefile("${path.module}/init.sh", {
    config = data.aws_ssm_parameter.app_config.value
  })
}
```

**Separate configuration management from infrastructure management:**

```hcl
# Terraform creates the infrastructure
resource "aws_s3_bucket" "config" {
  bucket = "app-configs"
}

# A separate process (not Terraform) updates config files in the bucket
# Your application reads from the bucket directly
```

This separation means Terraform manages the infrastructure (the bucket) while another tool manages the data (config files). Your application fetches the latest config without requiring Terraform to run.

## Using External Programs for Dynamic Data

The `external` data source lets you run a program that fetches current data:

```hcl
data "external" "latest_config" {
  program = ["python3", "${path.module}/scripts/fetch-config.py"]
}

resource "aws_lambda_function" "app" {
  environment {
    variables = data.external.latest_config.result
  }
}
```

The external program runs every time Terraform plans, so you get fresh data without watching files. The script must output JSON to stdout:

```python
#!/usr/bin/env python3
import json
import requests

# Fetch latest config from somewhere
config = requests.get('https://api.example.com/config').json()

# Output as JSON
print(json.dumps(config))
```

This pattern works well when your data source is an API, database, or other external system.

## Development Workflow With Auto-Refresh

For local development, you might want a workflow that continuously shows you what would change:

```bash
#!/bin/bash
# save as: watch-terraform.sh

while true; do
  clear
  echo "=== Terraform Plan ($(date)) ==="
  terraform plan -compact-warnings
  sleep 5
done
```

This doesn't auto-apply, but it gives you continuous feedback as you edit files. You can manually apply when ready.

Or use `watch`:

```bash
watch -n 5 terraform plan -compact-warnings
```

This reruns `terraform plan` every 5 seconds and highlights changes.

While Terraform doesn't have built-in file watching, you can achieve similar outcomes using hash-based change detection, file watcher tools, CI/CD pipelines, or Terraform Cloud's VCS integration. Choose the approach that fits your workflow - manual control for production, automated watching for development, or CI/CD for team environments.
