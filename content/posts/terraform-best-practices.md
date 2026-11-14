---
title: 'Terraform Infrastructure as Code Best Practices'
excerpt: 'Practical Terraform best practices for 2026: repository layout, remote state with native S3 locking, version pins and the lock file, data sources instead of hardcoded IDs, secrets kept out of state, terraform test, and a CI pipeline that applies the plan you reviewed.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2024-06-08'
publishedAt: '2024-06-08T08:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '13 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: true
tags:
  - Terraform
  - IaC
  - Cloud
  - Best Practices
  - Infrastructure as Code
  - Data Sources
---

Terraform is easy to start with and hard to keep tidy. The first `main.tf` works. A year later the same project has three environments in one state file, provider versions that differ per laptop, an AMI ID that nobody can explain, and a pipeline that applies whatever the latest commit says.

The practices below prevent those problems. They cover where the code and the state live, how versions are pinned, how to look up existing infrastructure with data sources, how to keep secrets out of state, and how to test and apply changes in CI. Each section links to a longer post when you need the details.

## TLDR

- One root folder per environment and component, each with its own remote state. Reusable modules have no provider or backend blocks.
- On AWS, store state in S3 with versioning and `use_lockfile = true`. The DynamoDB lock table is deprecated.
- Pin `required_version` and provider versions, and commit `.terraform.lock.hcl`.
- Look up existing resources with **data sources** instead of hardcoding IDs.
- Keep secrets out of `.tf` files, `.tfvars` files in Git, and state. Use `sensitive`, ephemeral values and write-only arguments.
- Run `fmt`, `validate`, a linter and `terraform test` on every pull request. Apply the saved plan that was reviewed.

## Prerequisites

- Terraform 1.10 or later for `use_lockfile` and ephemeral values, 1.11 or later for write-only arguments. The examples use the AWS provider 6.x.
- A Git repository and a CI system. The pipeline example uses GitHub Actions.

## Structure the Code Around State

The structure of the repository decides how much one plan touches. Keep reusable code in `modules/`, and run Terraform in small root folders such as `environments/prod/network` and `environments/prod/app`. Each root folder has its own backend key, so a plan in one never reads or writes the state of another. Give each environment its own credentials and IAM scope as well: a state key is not a permission boundary.

```text
infrastructure/
├── modules/
│   ├── network/
│   └── database/
└── environments/
    ├── dev/
    │   ├── network/
    │   └── app/
    └── prod/
        ├── network/
        └── app/
```

Inside a folder, split the code by meaning: `terraform.tf`, `providers.tf`, `variables.tf`, `network.tf`, `outputs.tf`. [How to Organize a Terraform Repository](/posts/organizing-terraform-repository-with-subfolders) covers the layout, workspaces versus folders, and how to split `main.tf`.

## Keep State Remote, Locked and Versioned

Local state works for one person on one machine. As soon as a second person or a pipeline runs Terraform, the state must live in a shared backend with locking:

```hcl
terraform {
  backend "s3" {
    bucket       = "acme-terraform-state"
    key          = "prod/app/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true # S3-native locking, Terraform 1.10+
  }
}
```

Turn on bucket versioning, so you can restore an earlier state version, and restrict who can read the bucket, because state holds every attribute of every resource. Older examples add `dynamodb_table` for locking. That option still works but is deprecated, so new projects should not add a lock table. [Who Owns the State File](/posts/who-owns-the-terraform-state-file) covers locking, splitting and drift, and the [remote backends chapter](/guides/introduction-to-terraform/09-remote-backends-and-collaboration#h2-the-s3-backend-with-native-locking) of our guide shows how to create the bucket with Terraform.

## Pin Versions and Commit the Lock File

```hcl
terraform {
  required_version = "~> 1.17.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0" # any 6.x, never 7.0
    }
  }
}
```

`~> 6.0` allows 6.1, 6.2 and so on, but not 7.0. The exact version that `terraform init` picked goes into `.terraform.lock.hcl`, so commit that file, and update providers on purpose with `terraform init -upgrade`. Pin module versions too: `version = "~> 6.5"` for registry modules, `?ref=v1.4.0` for Git sources. [Should .terraform.lock.hcl Be in .gitignore?](/posts/should-terraform-lock-be-in-your-gitignore) explains the lock file and the checksum errors it can produce.

## Name and Tag Resources the Same Way Everywhere

Build names from a few inputs in one place, and let the provider add the common tags:

```hcl
locals {
  name_prefix = "${var.project}-${var.environment}"
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

resource "aws_s3_bucket" "logs" {
  bucket = "${local.name_prefix}-logs"
}
```

`default_tags` reaches every resource that the AWS provider creates and that supports tags, so modules do not need a `tags` variable just for the common set. Resources that AWS creates on its own, such as instances launched by an Auto Scaling group, are not covered: set `tag` blocks with `propagate_at_launch` on the group, or tags in the launch template. Add resource-specific tags with the resource's own `tags` argument.

## How Are Data Sources Used in Terraform?

A data source reads information about something that already exists, without managing it. Use one whenever you would otherwise paste an ID, ARN or account number into the code. You declare it with a `data` block and read it as `data.<type>.<name>.<attribute>`.

```hcl
# The newest Ubuntu 24.04 image from Canonical
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }
}

# A VPC that another team manages, found by its tag
data "aws_vpc" "shared" {
  tags = {
    Name = "platform-prod"
  }
}

# The account and region the provider is using
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

resource "aws_instance" "web" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = "t3.small"
  subnet_id     = var.subnet_id

  tags = {
    Name = "web-${data.aws_region.current.region}"
  }
}
```

How data sources behave:

- **Terraform reads them during the plan.** If an argument depends on a value that is only known after apply, Terraform reads the data source during apply instead, and the plan shows `(known after apply)` for everything that uses it.
- **A singular data source must match exactly one object.** No match, or several matches for a data source that expects one, fails the plan. Plural data sources such as `aws_subnets` return a list, and `most_recent = true` on `aws_ami` picks the newest of several matches. That is useful: a renamed VPC stops the plan instead of creating resources in the wrong place.
- **`most_recent = true` changes over time.** A new AMI release changes the ID, and Terraform plans to replace the instance. Pin the AMI ID in a variable, or add `ignore_changes = [ami]`, if a replacement on every image release is not what you want.
- **In AWS provider 6, use `region`, not `name`,** on `data.aws_region`. The `name` attribute is deprecated.

Data sources are also the safer way to share values between root folders: the reader needs permission to describe one resource, not access to another team's whole state file. The [data sources section](/guides/introduction-to-terraform/04-resources-and-data-sources#h2-data-sources) of our guide has a runnable example.

## Use for_each, count and Conditionals Instead of Copies

Repeat resources with `for_each` keyed on stable names, and switch a resource on or off with `count`:

```hcl
locals {
  ingress = {
    http  = { port = 80, cidr = "0.0.0.0/0" }
    https = { port = 443, cidr = "0.0.0.0/0" }
    ssh   = { port = 22, cidr = "10.0.0.0/8" }
  }
}

resource "aws_vpc_security_group_ingress_rule" "web" {
  for_each = local.ingress

  security_group_id = aws_security_group.web.id
  description       = "Allow ${each.key}"
  ip_protocol       = "tcp"
  from_port         = each.value.port
  to_port           = each.value.port
  cidr_ipv4         = each.value.cidr
}

resource "aws_route53_record" "www" {
  count = var.create_dns_record ? 1 : 0

  zone_id = var.zone_id
  name    = "www.${var.domain_name}"
  type    = "CNAME"
  ttl     = 300
  records = [var.origin_hostname]
}
```

The AWS provider recommends `aws_vpc_security_group_ingress_rule` and `aws_vpc_security_group_egress_rule` over the older `aws_security_group_rule`, because each rule is its own resource with its own ID. [How to Reference for_each Resources](/posts/terraform-referencing-for-each-resources) and [Terraform Strings and Conditionals](/posts/terraform-strings-and-conditionals) cover the expressions.

## Keep Secrets Out of Code and State

- Never put a secret in a `.tf` file or in a `.tfvars` file that is in Git.
- Declare secret inputs with `sensitive = true`, and set them from your CI secret store as `TF_VAR_<name>`.
- `sensitive` only hides values in output. The value is still in the state. To keep it out of state, read it with an **ephemeral resource** and pass it to a **write-only argument** (Terraform 1.11 and later):

```hcl
ephemeral "aws_secretsmanager_secret_version" "db" {
  secret_id = "prod/app/db-password"
}

resource "aws_db_instance" "app" {
  # ...
  password_wo         = ephemeral.aws_secretsmanager_secret_version.db.secret_string
  password_wo_version = 1 # increase to send a new password
}
```

For RDS you can also set `manage_master_user_password = true` and let RDS create and rotate the password in Secrets Manager. [How to Apply SQL Scripts to RDS With Terraform](/posts/terraform-apply-sql-scripts-rds#h2-how-do-i-retrieve-a-secret-from-aws-secrets-manager-in-terraform) compares the options.

## Test Before You Apply

Run these on every pull request, in this order:

1. `terraform fmt -check -recursive` for formatting.
2. `terraform validate` for syntax and types.
3. A linter such as TFLint, and a security scanner such as Trivy or Checkov.
4. `terraform test` for your own rules.

`terraform test` (Terraform 1.6 and later) runs `.tftest.hcl` files. A plan-only test needs no infrastructure, and with `mock_provider "aws" {}` (1.7 and later) it does not even need credentials:

```hcl
# tests/naming.tftest.hcl
mock_provider "aws" {}

variables {
  project     = "acme"
  environment = "dev"
}

run "bucket_name_includes_environment" {
  command = plan

  assert {
    condition     = aws_s3_bucket.logs.bucket == "acme-dev-logs"
    error_message = "The log bucket name must include the environment."
  }
}
```

The same file with a `terraform_data` resource instead of the bucket passed on Terraform 1.15.8 (`Success! 1 passed, 0 failed.`). For a fast local loop before you push, see [Experimenting Locally With Terraform](/posts/experimenting-locally-with-terraform).

## Apply the Plan You Reviewed

A pipeline should plan on every pull request so reviewers see the changes, and after the merge apply a saved plan that a person approved. Use two jobs with two roles:

```yaml
name: terraform
on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read
  id-token: write # OIDC login to the cloud, no long-lived keys

defaults:
  run:
    working-directory: environments/dev/app

jobs:
  plan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: hashicorp/setup-terraform@v4
        with:
          terraform_version: 1.17.2
      - uses: aws-actions/configure-aws-credentials@v6
        with:
          role-to-assume: arn:aws:iam::123456789012:role/terraform-dev-plan # read-only, plus the state lock
          aws-region: us-east-1
      - run: terraform fmt -check -recursive
      - run: terraform init -input=false
      - run: terraform validate -no-color
      - run: terraform plan -input=false -no-color -out=tfplan
      - uses: actions/upload-artifact@v7
        with:
          name: tfplan
          path: environments/dev/app/tfplan
          retention-days: 1

  apply:
    needs: plan
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: dev # add required reviewers to this environment to approve each apply
    steps:
      - uses: actions/checkout@v7
      - uses: hashicorp/setup-terraform@v4
        with:
          terraform_version: 1.17.2
      - uses: aws-actions/configure-aws-credentials@v6
        with:
          role-to-assume: arn:aws:iam::123456789012:role/terraform-dev-apply
          aws-region: us-east-1
      - run: terraform init -input=false
      - uses: actions/download-artifact@v8
        with:
          name: tfplan
          path: environments/dev/app
      - run: terraform apply -input=false tfplan
```

The plan on a pull request is for review. After the merge, the `plan` job makes a new saved plan from the merged commit, the run stops at the `dev` environment until a reviewer approves it, and the `apply` job applies exactly that file. `terraform apply tfplan` does not ask for confirmation, and it refuses to run if the state changed after the plan was made. A saved plan can contain secret values, so keep the artifact short-lived. [How to Save Terraform Plan and Apply Output to a File](/posts/terraform-save-plan-apply-output-to-file) shows how to post the plan on the pull request, and [Who Owns the State File](/posts/who-owns-the-terraform-state-file#h2-question-4-how-does-a-plan-get-reviewed) covers plan review in more depth.

## Give Terraform Only the Permissions It Needs

The role that Terraform uses can usually change almost anything in the account. Use separate roles per environment, a read-only role for plans, and policies scoped to the services each root folder manages. [Least privilege for Terraform's own role](/posts/terraform-fargate-task-definition-execution-role#h2-what-are-the-minimum-aws-permissions-for-terraform) shows how to find the actions a configuration needs.

## Document Modules

Give every variable and output a `description`, and generate the module README with `terraform-docs`:

```bash
terraform-docs markdown table --output-file README.md modules/network
```

The generated table lists inputs, types, defaults and outputs, and stays in sync when you run it again in CI.

## Related Resources

- [Terraform Best Practices for Production](/guides/introduction-to-terraform/10-best-practices-and-production-patterns), the last chapter of our Terraform guide.
- [Terraform Repository Structure Checklist](/checklists/terraform-repo-structure) to review a repository.
- [Terraform Fundamentals Quiz](/quizzes/terraform-quiz) to check what you know.
- [Terraform vs OpenTofu](/comparisons/terraform-vs-opentofu) if you are choosing between the two.
