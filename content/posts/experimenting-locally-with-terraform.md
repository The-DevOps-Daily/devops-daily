---
title: 'Experimenting Locally with Terraform'
excerpt: 'Practical techniques for running, testing, and iterating on Terraform locally before you push changes to remote state or CI.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2025-04-10'
publishedAt: '2025-04-10T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Local Development
  - Testing
  - DevOps
---

## TLDR

You can safely iterate on Terraform configurations locally by using a local backend, workspaces, plan files, and tools like `terraform console` and `terraform fmt`. For cloud provider behavior, combine LocalStack or provider-specific emulators with a short-lived remote backend for realistic testing. This guide shows lightweight patterns that let you move fast without putting production state at risk.

---

Working on Terraform does not have to be slow or risky. When you experiment locally you can iterate faster, catch issues earlier, and keep production state untouched. Below are practical patterns I use when developing modules or trying configuration changes.

## Prerequisites

- Terraform 1.0 or later installed.
- Docker available if you want to run LocalStack for AWS emulation.
- AWS CLI or provider credentials configured when testing real cloud resources.

## 1. Start with a local backend for quick experiments

Before the code: use the local backend to keep state in a file instead of a remote store. This is useful for prototype runs that you do not want in shared state.

```hcl
# backend-local.tf
terraform {
  backend "local" {
    path = "./terraform.tfstate"
  }
}
```

- What this does: writes state to `terraform.tfstate` in the current folder.
- Why it matters: you can run `terraform apply` repeatedly without affecting shared state or remote backends.

Tip: delete the local state file when you want to start fresh: `rm terraform.tfstate terraform.tfstate.backup`.

## 2. Use workspaces for isolated experiments

Before the code: create a workspace when you want multiple isolated state copies in the same directory.

```bash
# create and switch to a workspace
terraform workspace new play-01
terraform workspace select play-01
```

- What this does: keeps state in a separate workspace namespace when using supported backends.
- Why it matters: workspaces are handy for ephemeral experiments, but do not replace separate environment directories for production workloads.

## 3. Produce a plan file and inspect it safely

Before the code: generate a plan file that records the proposed changes. You can review or apply that plan later.

```bash
# create a plan file
terraform plan -out=tfplan.binary -var-file=example.tfvars

# show the planned changes in human readable form
terraform show -json tfplan.binary | jq '.'
```

- What this does: saves a binary plan to `tfplan.binary` and prints it in JSON for inspection.
- Why it matters: you can review every change and share the plan artifact with automation pipelines.

## 4. Use `terraform console` to evaluate expressions

Before the code: open the Terraform console to evaluate interpolations and debug complex expressions.

```bash
terraform console
> var.my_map["key1"]
> length(module.vpc.public_subnet_ids)
```

- What this does: lets you run Terraform expressions against current state and variables.
- Why it matters: it's a fast way to validate how variables, locals, and outputs resolve without running apply.

## 5. Emulate cloud APIs with LocalStack (AWS example)

Before the code: run LocalStack with Docker when you need a local AWS-like API for S3, DynamoDB, SSM, and other services.

```bash
# run LocalStack in Docker for quick AWS emulation
docker run --rm -it -p 4566:4566 -e SERVICES=s3,sts,ssm localstack/localstack
```

- What this does: starts LocalStack and exposes AWS-compatible endpoints on port 4566.
- Why it matters: you can point Terraform's AWS provider at LocalStack to test resource creation without touching real AWS.

Example provider configuration to target LocalStack:

```hcl
# provider-localstack.tf
provider "aws" {
  region                      = "us-west-2"
  access_key                  = "test"
  secret_key                  = "test"
  s3_force_path_style         = true
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  endpoints {
    s3  = "http://localhost:4566"
    sts = "http://localhost:4566"
  }
}
```

- What this does: directs AWS provider calls to LocalStack's endpoints.
- Why it matters: you get realistic API behavior for many services without cloud costs.

## 6. Keep formatting, validation, and linting fast

Before the code: run the built-in Terraform format and validate steps before committing changes.

```bash
terraform fmt -recursive && terraform validate
```

- What this does: formats code consistently and checks for basic configuration errors.
- Why it matters: it catches syntax and provider issues early and keeps your repo readable.

For policy checks, run `tflint` or `checkov` locally to surface security and best-practice issues before CI.

## 7. Use small example projects to test modules

Before the code: create an `examples/` folder where each module has a minimal composition you can run locally.

```hcl
# examples/simple-vpc/main.tf
module "vpc" {
  source = "../../modules/vpc"
  environment = "local-test"
  vpc_cidr = "10.99.0.0/16"
  public_subnet_cidrs = ["10.99.1.0/24"]
  availability_zones = ["us-west-2a"]
}
```

- What this does: provides a tiny real-world configuration that exercises the module.
- Why it matters: you can run quick iterations against module boundaries without bootstrapping a full environment.

## 8. When to use a short-lived remote backend

Sometimes local emulation is not enough. For higher fidelity tests, point your environment at a short-lived remote backend (an S3 bucket or Terraform Cloud workspace) with restricted credentials.

Before the code: a backend snippet you can copy into an env-level `backend.tf` for temporary testing.

```hcl
terraform {
  backend "s3" {
    bucket = "company-terraform-test-state"
    key    = "sandbox/play-01/terraform.tfstate"
    region = "us-west-2"
  }
}
```

- What this does: stores state remotely under a sandbox path.
- Why it matters: you test provider interactions and state locking without risking production state. Make sure the bucket and IAM policy used are restricted to sandbox activities.

## Conclusion

Start small: use the local backend and workspaces for first-pass experiments, then move to LocalStack for API-level checks, and finally to a short-lived remote backend when you need locking and real-provider behavior. Keep formatting, validation, and linting in your local loop so CI only verifies already-clean changes.

Next steps you can explore: add automated tests with Terratest, run policy checks in pre-commit hooks, and wire sandbox runs into your CI pipeline for consistent promotion to staging and production.
