---
title: 'How to Read a .env File in Terraform, and Where path.module Points'
excerpt: 'Terraform reads only TF_VAR_ environment variables and never a .env file. Learn how to load one safely, how path.module, path.root and path.cwd differ, and how to upload a local folder or create an empty folder in S3.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2024-11-08'
publishedAt: '2024-11-08T14:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Infrastructure as Code
  - Environment Variables
  - Configuration
  - AWS
  - DevOps
---

Sooner or later a Terraform configuration needs something from the local disk: values from a `.env` file, a script for `user_data`, a JSON policy, or a folder of files to upload. Terraform can read all of them, but each has a rule that is easy to get wrong. A `.env` file is never read on its own. A relative path in a module resolves against the wrong folder. An S3 "folder" is not a folder.

This post answers three questions: how to get values from a `.env` file into Terraform, how to build file paths that work from any directory, and how to create folders and upload files in S3.

## TLDR

| Question                                    | Short answer                                                                             |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Does Terraform read `.env` files?           | No. It reads only environment variables named `TF_VAR_<name>`                            |
| How do I load a `.env` file?                | Use `TF_VAR_` names in the file, then `set -a; . ./.env; set +a` before `terraform plan` |
| How do I point at a file next to my module? | `"${path.module}/scripts/init.sh"`                                                       |
| What does `path.cwd` return?                | The directory you ran Terraform from, even with `-chdir`. Avoid it in modules            |
| How do I create a folder in S3?             | You usually do not need to. For an empty folder, create an object whose key ends in `/`  |

## Prerequisites

- Terraform 1.5 or later. The `.env` parser below uses `strcontains()`, which was added in 1.5.
- A bash or zsh shell for the loading examples.
- For the S3 section, the AWS provider and credentials. The other examples ran on Terraform 1.15.8 without a cloud account.

## How Do I Read Environment Variables From a .env File in Terraform?

Terraform does not read `.env` files, and it has no function that reads arbitrary environment variables. The only environment variables that set input variables are named `TF_VAR_` plus the variable name. So the answer has two parts: use those names in the file, and export the file into your shell before you run Terraform.

```bash
# .env (keep it out of Git)
TF_VAR_region=eu-west-1
TF_VAR_db_port=5432
TF_VAR_tags='{ team = "web", env = "dev" }'
```

```hcl
variable "region" {
  type = string
}

variable "db_port" {
  type = number
}

variable "tags" {
  type = map(string)
}
```

```bash
set -a       # export every variable that the next commands set
. ./.env
set +a
terraform plan -input=false
```

The plan picks up all three values. `TF_VAR_db_port` arrives as a string and Terraform converts it to a number. For a map, list or object type, Terraform parses the value as HCL, so `{ team = "web", env = "dev" }` becomes a map.

Rules that cause most of the problems:

- **The name must match exactly.** `TF_VAR_Region` does not set `var.region` on Linux. An environment variable with no matching declaration is ignored without a warning.
- **Quote values that contain spaces.** The file is sourced by the shell. Without the single quotes, the tags line above runs `team` as a command (`team: command not found`) and `TF_VAR_tags` stays empty.
- **Use `-input=false` in scripts and CI.** If a value is missing, Terraform otherwise stops and waits for you to type it.
- **Values from `.tfvars` files and `-var` win.** Environment variables have lower precedence than `terraform.tfvars`, `*.auto.tfvars` and the command line. The full order is in the [variables, loops and outputs guide](/posts/terraform-variables-loops-and-outputs#h3-where-values-can-come-from-and-who-wins).

Avoid `export $(cat .env | xargs)`. It breaks on comments, quotes and values with spaces.

### Load the File for Every Run

A small wrapper keeps the loading in one place and fails early when the file is missing:

```bash
#!/usr/bin/env bash
# tf: run terraform with the values from .env.<environment>
set -euo pipefail

env_name=${1:?usage: tf <environment> <terraform arguments>}
shift
env_file=".env.${env_name}"
[[ -f "$env_file" ]] || { echo "missing $env_file" >&2; exit 1; }

set -a
. "./$env_file"
set +a

exec terraform "$@"
```

```bash
./tf dev plan -input=false
./tf prod apply
```

If you use `direnv`, put `dotenv .env` in `.envrc` and run `direnv allow`. direnv then exports the file when you enter the directory and removes the values when you leave.

### Parse a .env File Inside Terraform

When the file uses plain names (`AWS_REGION=...`) and you cannot change it, read it with `file()` and parse it in a local value. This version skips comments and empty lines, handles `export`, Windows line endings, quotes, and values that contain `=`:

```hcl
locals {
  env_lines = [
    for line in split("\n", replace(file("${path.module}/.env"), "\r", "")) :
    trimspace(line)
    if length(regexall("^\\s*(#|$)", line)) == 0 && strcontains(line, "=")
  ]

  env = {
    for line in local.env_lines :
    trimspace(trimprefix(split("=", line)[0], "export ")) =>
    trim(join("=", slice(split("=", line), 1, length(split("=", line)))), "\"'")
  }
}
```

With a file that has a comment, `ENVIRONMENT="development"`, a URL with `?sslmode=require` and `export TOKEN=abc`, `terraform console` returns:

```text
> local.env
{
  "AWS_REGION" = "us-east-1"
  "DB_URL" = "postgresql://u:p@h:5432/db?sslmode=require"
  "ENVIRONMENT" = "development"
  "TOKEN" = "abc"
}
```

Know the limits before you use this. It does not expand `${OTHER}` references or multi-line values, a duplicate key fails the plan, and `file()` reads the file when Terraform plans, so the file must exist on every machine and in CI. Any value that ends up in a resource argument is also stored in the state file.

The `external` data source is the other option: it runs a program that prints JSON. Its result must be a flat object whose values are all strings, so it cannot return numbers or nested objects. For a flat `.env` file, the HCL version above needs no extra program.

### Fail the Plan When a Value Is Missing

The simplest check is a variable with no default: Terraform will not plan without it. When you parse the file yourself, use a precondition. A `check` block is not enough, because a failed `check` assertion is only a warning:

```hcl
locals {
  missing = [for k in ["AWS_REGION", "DB_HOST"] : k if !contains(keys(local.env), k)]
}

resource "terraform_data" "env_check" {
  lifecycle {
    precondition {
      condition     = length(local.missing) == 0
      error_message = "Missing in .env: ${join(", ", local.missing)}"
    }
  }
}
```

On Terraform 1.15.8, the `check` block version printed `Warning: Check block assertion failed` and the plan went on. The precondition version stopped with `Error: Resource precondition failed`.

### Keep Secrets Out of the File and the State

A `.env` file on a laptop is fine for a region or an instance size. For passwords and tokens:

- In CI, set `TF_VAR_db_password` from the CI secret store, not from a file in the repository.
- Mark the variable `sensitive = true`, so plans and logs hide it.
- On Terraform 1.10 and later, mark it `ephemeral = true` if it only feeds a provider configuration or a write-only argument. Terraform then keeps it out of the plan and state. The [ephemeral variables section](/guides/introduction-to-terraform/06-variables-and-outputs#h2-ephemeral-variables) of our Terraform guide shows how.
- Add `.env` and `.env.*` to `.gitignore`, and commit a `.env.example` with placeholder values.

## How Do I Get the Current Working Directory in Terraform?

Terraform has three path values. Use `path.module` for files that belong to a module, `path.root` for files that belong to the root configuration, and avoid `path.cwd`:

| Value         | What it is                                  | Root module | Child module `./modules/app` |
| ------------- | ------------------------------------------- | ----------- | ---------------------------- |
| `path.module` | Folder of the module that contains the code | `.`         | `modules/app`                |
| `path.root`   | Folder of the root module                   | `.`         | `.`                          |
| `path.cwd`    | Directory you ran `terraform` from          | absolute    | absolute                     |

The values in the table come from a run on Terraform 1.15.8. `path.module` and `path.root` are relative paths, not absolute ones. That is on purpose: a value that ends up in a resource argument stays the same on every laptop and CI runner. `abspath(path.module)` gives the absolute path when a tool needs one.

`path.cwd` is the shell's directory. With `terraform -chdir=infra/prod plan`, it is still the directory you started in, not `infra/prod`. A module that uses it works for one person and breaks for the next.

```hcl
# modules/app/main.tf
resource "aws_launch_template" "app" {
  name_prefix   = "app-"
  image_id      = var.ami_id
  instance_type = "t3.medium"

  # the file sits next to this module, wherever the module is called from
  user_data = base64encode(templatefile("${path.module}/templates/user-data.sh.tftpl", {
    app_name    = var.app_name
    environment = var.environment
  }))
}
```

Without `path.module`, `file("user-data.sh")` looks in the directory you ran Terraform from. It works from the root of one project and fails everywhere else.

### Load Every File in a Folder

`fileset()` lists files that match a pattern, relative to the folder you give it. Combine it with `for_each` to create one resource per file:

```hcl
locals {
  policy_files = fileset("${path.module}/policies", "*.json")
}

resource "aws_iam_policy" "this" {
  for_each = local.policy_files

  name   = trimsuffix(each.value, ".json")
  policy = file("${path.module}/policies/${each.value}")
}
```

`fileset()` reads the disk when Terraform plans, like `file()`. Files that a resource creates during the same apply are not there yet.

`fileexists()` lets a module fall back to a default file:

```hcl
locals {
  config_file = fileexists("${path.module}/custom.yaml") ? "${path.module}/custom.yaml" : "${path.module}/default.yaml"
  config      = yamldecode(file(local.config_file))
}
```

`basename(path.module)` returns the folder name of a child module, but `.` in the root module, so do not use it to name resources there.

### Files Shared by Several Modules

`path.root` reaches files in the root configuration, for example `"${path.root}/config/tags.yaml"`. Use it sparingly, because the module then depends on a file outside itself. A cleaner design passes the content in as a variable: the root reads the file once with `yamldecode(file(...))` and passes the result to each module that needs it.

## How Do I Create a Folder in an S3 Bucket With Terraform?

S3 has no folders. An object key such as `reports/2026/summary.csv` contains slashes, and the S3 console shows the parts before the last slash as folders. When you upload an object with that key, the "folder" appears. You do not need to create it first.

To make an empty folder visible in the console, create a zero-byte object whose key ends in `/`. That is what the console's **Create folder** button does:

```hcl
resource "aws_s3_bucket" "data" {
  bucket = "acme-data-example"
}

resource "aws_s3_object" "reports_folder" {
  bucket  = aws_s3_bucket.data.id
  key     = "reports/"
  content = ""
}
```

Leave out `acl`. New buckets have ACLs turned off by default (Object Ownership set to "bucket owner enforced"), and the `acl` argument on `aws_s3_bucket` is deprecated in the AWS provider. Control access with a bucket policy or IAM instead. A policy that grants access to `arn:aws:s3:::acme-data-example/reports/*` works whether the `reports/` object exists or not.

### Upload a Local Folder to S3

To mirror a local folder into a bucket, combine `fileset()` with `for_each`:

```hcl
locals {
  site_files = fileset("${path.module}/site", "**")

  content_types = {
    html = "text/html"
    css  = "text/css"
    js   = "application/javascript"
    json = "application/json"
    png  = "image/png"
    svg  = "image/svg+xml"
  }
}

resource "aws_s3_object" "site" {
  for_each = local.site_files

  bucket       = aws_s3_bucket.data.id
  key          = "site/${each.value}"
  source       = "${path.module}/site/${each.value}"
  source_hash  = filemd5("${path.module}/site/${each.value}")
  content_type = lookup(local.content_types, reverse(split(".", each.value))[0], "application/octet-stream")
}
```

A new file adds an object, a deleted file removes it, and `source_hash` makes Terraform upload a file again when its content changes. Use `source_hash` rather than `etag` when the bucket uses SSE-KMS encryption, because S3 then returns an ETag that is not the MD5 of the file. Terraform is fine for a few hundred files. For thousands of files, or files that change on every deploy, `aws s3 sync` in the pipeline is faster and keeps them out of the state.

## Related Resources

- [Terraform Variables and Outputs](/guides/introduction-to-terraform/06-variables-and-outputs) in our Terraform guide, including `TF_VAR_` and precedence.
- [Rendering template files](/guides/introduction-to-terraform/03-configuration-language-basics#h3-rendering-template-files) with `templatefile()`.
- [Experimenting Locally With Terraform](/posts/experimenting-locally-with-terraform) for `terraform console` and a fast local loop.
- [Introduction to AWS: S3 storage](/guides/introduction-to-aws/04-s3-storage) for buckets, policies and lifecycle rules.
- [Terraform Basics flashcards](/flashcards/terraform-basics) to review the core terms.
