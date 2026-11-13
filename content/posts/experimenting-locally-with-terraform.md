---
title: 'Experimenting Locally With Terraform, and Re-Running on File Changes'
excerpt: 'Try Terraform changes without touching shared state: providers that need no account, terraform console, local backends via override files, mock providers, local AWS emulators, and what to do instead of a watch mode when files change.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2025-04-10'
publishedAt: '2025-04-10T09:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '11 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Local Development
  - Testing
  - LocalStack
  - Automation
  - DevOps
---

Most Terraform mistakes are cheap to find on a laptop and expensive to find in production. A typo in a `for` expression, a module input with the wrong type, or a plan that wants to replace a database: all of them show up before anything is created, if you have a fast way to try the change.

This post shows a local loop for Terraform: what you can run without any cloud account, how to keep experiments out of shared state, how to emulate AWS APIs, and how to test modules with mock providers. The last part answers a question that comes up once the loop is fast: can Terraform watch a folder and run again when files change?

## TLDR

- Expressions, modules and outputs can be tested with **no cloud account**: `terraform console`, the built-in `terraform_data` resource, and the `local` and `random` providers.
- Put a `backend_override.tf` with a local backend in your experiment folder, so `init` never touches the shared state. Do not commit it.
- `terraform test` with `mock_provider` (Terraform 1.7 and later) runs module tests without credentials.
- For AWS APIs on your machine, use an emulator such as AWS Emulator, Moto or LocalStack (which needs an auth token since March 2026).
- Terraform has **no watch mode**. Use file hashes so the next plan sees changed files, `watchexec` or `entr` to re-run `plan` locally, and CI to apply.

## Prerequisites

- Terraform 1.7 or later. The examples ran on Terraform 1.15.8.
- Docker, if you want to run an AWS emulator.
- No cloud credentials for most of the post. Never point local experiments at production credentials.

## How Do I Experiment With Terraform Locally?

Start with the parts of Terraform that need no provider at all, then add emulators or sandbox accounts only when you need real API behavior.

### Test Expressions in terraform console

`terraform console` evaluates expressions against your configuration, including variables, locals and anything already in the state. It is the fastest way to check a `for` expression or a function:

```terminal
{
  "title": "terraform console",
  "prompt": ">",
  "steps": [
    { "cmd": "{ for i, az in [\"us-east-1a\", \"us-east-1b\"] : az => cidrsubnet(\"10.0.0.0/16\", 8, i) }", "output": "{\n  \"us-east-1a\" = \"10.0.0.0/24\"\n  \"us-east-1b\" = \"10.0.1.0/24\"\n}" },
    { "cmd": "cidrsubnet(\"10.0.0.0/16\", 4, 16)", "output": "Error: Error in function call\n\n  on <console-input> line 1:\n  (source code not available)\n\nCall to function \"cidrsubnet\" failed: prefix extension of 4 does not\naccommodate a subnet numbered 16." }
  ]
}
```

Pipe an expression in when you want the result in a script: `echo 'local.subnets' | terraform console`. From Terraform 1.16, `terraform console -scope=module.network` evaluates expressions inside a child module. The [console playground](/guides/introduction-to-terraform/03-configuration-language-basics#h2-a-playground-with-terraform-console) in our guide has more examples.

### Build With Resources That Need No Account

`terraform_data` is built into Terraform and creates nothing outside the state. Combined with the `local` and `random` providers, it lets you test modules, `for_each`, `moved` blocks and outputs end to end:

```hcl
module "network" {
  source   = "./modules/network"
  for_each = toset(["staging", "production"])
  name     = each.key
}

resource "terraform_data" "server" {
  for_each = module.network
  input    = "server in ${each.value.vpc_id}"
}
```

When the module uses a cloud provider, run the plan only. A plan of new resources often works with fake credentials and the provider's `skip_*` settings, because nothing exists to read yet.

### Keep Experiments Out of Shared State

If the folder you experiment in has an S3 or HCP Terraform backend, a careless `init` and `apply` writes to the shared state. Add an override file instead of editing the backend block:

```hcl
# backend_override.tf (in .gitignore)
terraform {
  backend "local" {
    path = "local.tfstate"
  }
}
```

Terraform merges files that end in `_override.tf` over the normal configuration, so `terraform init -reconfigure` now uses a local state file. On Terraform 1.15.8, this replaced an S3 backend block without any other change. Add `*_override.tf` and `*.tfstate*` to `.gitignore`, and delete the local state when you start over.

Workspaces are another option in the same folder (`terraform workspace new play-01`), but they still use the shared backend and the same credentials. Use them for short-lived copies, not as protection for production.

### Save Plans and Read Them as JSON

```bash
terraform plan -out=tfplan
terraform show -json tfplan | jq -r '.resource_changes[] | "\(.change.actions | join(",")) \(.address)"'
```

The `jq` filter prints one line per resource, such as `delete,create aws_instance.web`, which makes replacements easy to spot. [How to Save Terraform Plan and Apply Output to a File](/posts/terraform-save-plan-apply-output-to-file) covers plan files in detail.

### Test Modules With Mock Providers

`terraform test` runs `.tftest.hcl` files. With `mock_provider`, the provider returns generated values and never calls an API, so the test needs no credentials:

```hcl
# tests/network.tftest.hcl
mock_provider "aws" {}

variables {
  name     = "test"
  vpc_cidr = "10.99.0.0/16"
}

run "subnets_use_the_vpc_range" {
  command = plan

  assert {
    condition     = alltrue([for s in aws_subnet.public : startswith(s.cidr_block, "10.99.")])
    error_message = "Every subnet must be inside the VPC range."
  }
}
```

Mocks show whether your logic is right. They do not show whether AWS accepts the request, so keep a few tests against a real sandbox account.

### Emulate AWS APIs on Your Machine

For tests that need real API calls without an AWS account, point the AWS provider at a local emulator. There are three common choices in late 2026:

- **AWS Emulator**, released by AWS in November 2026. Our [hands-on test](/posts/aws-emulator-hands-on-test) found that it passed our workflow checks but needs care with some provider versions.
- **Moto** in server mode, open source and free.
- **LocalStack**. Since March 2026 the `localstack/localstack` image needs an auth token, and the free plan is for non-commercial use.

The provider configuration is the same idea for all of them. This one targets LocalStack's default port:

```hcl
# provider_override.tf, for local runs only
provider "aws" {
  region     = "us-east-1"
  access_key = "test"
  secret_key = "test"

  s3_use_path_style           = true
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true

  endpoints {
    s3       = "http://localhost:4566"
    sts      = "http://localhost:4566"
    dynamodb = "http://localhost:4566"
    sqs      = "http://localhost:4566"
  }
}
```

Older examples use `s3_force_path_style`. The AWS provider replaced it with `s3_use_path_style`, so the old name fails on current versions. Pin the emulator version and the provider version together, and check the emulator's docs for the services you use.

### Keep the Loop Fast

```bash
terraform fmt -recursive && terraform validate && tflint
```

Run this before every commit. `validate` needs `terraform init`, but `init -backend=false` is enough when you only want to validate. When you do need real cloud behavior, use a sandbox account with its own state bucket and a role that cannot reach production.

## Can Terraform Watch a Directory for Changes?

No. Terraform has no watch mode, and it never runs on its own. Every change goes through `plan` and `apply` when you, or a pipeline, start them. What you can do is:

1. Make sure the **next plan notices** when a file changes.
2. **Re-run the plan** automatically while you edit, on your machine.
3. **Apply on commit** in CI, after review.

### Make File Changes Show Up in the Plan

`file()`, `templatefile()` and `fileset()` read the disk at every plan, so a changed file changes the arguments that use it. When a resource has no argument that contains the file, add a hash:

```hcl
data "archive_file" "lambda" {
  type        = "zip"
  source_dir  = "${path.module}/src"
  output_path = "${path.module}/build/lambda.zip"
}

resource "aws_lambda_function" "processor" {
  function_name    = "data-processor"
  role             = aws_iam_role.lambda.arn
  runtime          = "python3.13"
  handler          = "main.handler"
  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256
}
```

To replace a resource when any file in a folder changes, hash the folder into a `terraform_data` resource and point `replace_triggered_by` at it:

```hcl
resource "terraform_data" "app_source" {
  triggers_replace = sha256(join("", [
    for f in sort(fileset("${path.module}/app", "**/*.py")) : filesha256("${path.module}/app/${f}")
  ]))
}

resource "aws_instance" "worker" {
  # ...
  lifecycle {
    replace_triggered_by = [terraform_data.app_source]
  }
}
```

We tested the pattern on Terraform 1.15.8 with a second `terraform_data` resource named `deploy` in place of the instance. After one Python file changed, the plan showed both actions:

```text
  # terraform_data.app_source must be replaced
  # terraform_data.deploy will be replaced due to changes in replace_triggered_by
Plan: 2 to add, 0 to change, 2 to destroy.
```

With the configuration above, the second line reads `aws_instance.worker will be replaced due to changes in replace_triggered_by`.

`replace_triggered_by` accepts only managed resources, which is why the hash lives in `terraform_data` and not in a local value.

### Re-Run the Plan While You Edit

A file watcher can run `terraform plan` every time you save:

```bash
# watchexec: re-run the plan when a .tf, .tfvars or .py file changes
watchexec --exts tf,tfvars,py -- terraform plan -input=false -compact-warnings

# entr: watches only the files it gets on stdin; -c clears the screen first
find . \( -name '*.tf' -o -name '*.tfvars' \) -not -path './.terraform/*' | entr -c terraform plan -input=false
```

`entr` does not see files that are created after it starts, so restart it when you add a file. Every plan refreshes state and calls the provider APIs, and it takes the state lock. Keep this for local state or a sandbox. Do not add `--restart` to a command that applies: if a file changes during an apply, the watcher stops Terraform in the middle, and you can end up with partly applied changes and a stale lock. Do not run an auto-apply watcher against anything that matters.

### Apply on Commit Instead

For shared environments, the trigger should be a reviewed commit, not a saved file. In GitHub Actions, a `paths` filter starts the pipeline only when Terraform or its data files change:

```yaml
on:
  push:
    branches: [main]
    paths:
      - 'infra/**'
      - 'config/*.json'
  pull_request:
    paths:
      - 'infra/**'
      - 'config/*.json'
```

HCP Terraform does the same with VCS-driven workspaces: each push to the connected branch starts a plan, and you can limit runs to changes in chosen paths. [Terraform Best Practices](/posts/terraform-best-practices#h2-apply-the-plan-you-reviewed) has a full plan-and-apply workflow.

### When the Data Changes More Often Than the Infrastructure

If you want a watch mode because a configuration file changes many times a day, the data probably does not belong in Terraform. Let Terraform create the place where the data lives, such as an SSM parameter or an S3 bucket, and let the application or a small deploy script update the data. Then a data change is not an infrastructure change, and nobody has to run `apply` for it.

## Related Resources

- [Terraform terminal simulator](/games/terraform-terminal-simulator) to practice the CLI in the browser.
- [Terraform Puzzle](/games/terraform-puzzle) to put resources and dependencies in order.
- [Your first configuration, no cloud account needed](/guides/introduction-to-terraform/02-installation-and-setup#h2-your-first-configuration-no-cloud-account-needed) in our Terraform guide.
- [Test your code](/guides/introduction-to-terraform/10-best-practices-and-production-patterns#h2-test-your-code) for more `terraform test` patterns.
- [Deploy a DigitalOcean Droplet with Terraform](/exercises/terraform-digitalocean-droplet), a beginner exercise with a real provider.
