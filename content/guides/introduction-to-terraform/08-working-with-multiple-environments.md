---
title: 'Managing Multiple Environments with Terraform'
description: 'Run dev, staging and prod from one Terraform codebase: workspaces, a directory per environment, per-environment tfvars and backends, and Terragrunt.'
order: 8
---

**TLDR**: Every environment needs its own state. **Workspaces** give one configuration several states and are fine for short-lived copies (a feature branch, a test). For long-lived environments, use **one directory per environment** that calls shared modules, with its own variable values, its own backend settings and ideally its own cloud account. Tools such as Terragrunt and HCP Terraform Stacks remove the repetition when you have many environments. Promote changes the same way every time: plan and apply in dev, then staging, then prod.

Most teams run at least three copies of their infrastructure: development, staging and production. They should be as alike as possible, so a change that works in staging works in production, and as separate as possible, so a mistake in dev never touches production. This part compares the ways to get both, with real runs of workspaces, per-environment directories and Terragrunt.

## Prerequisites

- Modules from [Part 7](/guides/introduction-to-terraform/07-modules) and variables from [Part 6](/guides/introduction-to-terraform/06-variables-and-outputs).
- No cloud account: the examples write local files.

## Workspaces

A **workspace** is a named state for the same configuration. Every working directory starts in the `default` workspace; `terraform workspace new` creates another, and the code can read the current name from `terraform.workspace`. Try it in a new directory, `workspaces`, with this `main.tf`, after `terraform init`:

```hcl
locals {
  env = terraform.workspace

  replicas = {
    dev  = 1
    prod = 3
  }
}

resource "local_file" "app" {
  filename = "${path.module}/out/app-${local.env}.conf"
  content  = "environment=${local.env}\nreplicas=${lookup(local.replicas, local.env, 1)}\n"
}
```

```terminal
{
  "title": "terraform workspace",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform workspace show",
      "output": "default"
    },
    {
      "cmd": "terraform workspace new dev",
      "output": "Created and switched to workspace \"dev\"!\n\nYou're now on a new, empty workspace. Workspaces isolate their state,\nso if you run \"terraform plan\" Terraform will not see any existing state\nfor this configuration."
    },
    {
      "cmd": "terraform apply -auto-approve",
      "output": "Apply complete! Resources: 1 added, 0 changed, 0 destroyed."
    },
    {
      "cmd": "terraform workspace new prod",
      "output": "Created and switched to workspace \"prod\"!\n\nYou're now on a new, empty workspace. Workspaces isolate their state,\nso if you run \"terraform plan\" Terraform will not see any existing state\nfor this configuration."
    },
    {
      "cmd": "terraform apply -auto-approve",
      "output": "Apply complete! Resources: 1 added, 0 changed, 0 destroyed."
    },
    {
      "cmd": "terraform workspace list",
      "output": "  default\n  dev\n* prod"
    },
    {
      "cmd": "find . -name '*.tfstate' | sort",
      "output": "./terraform.tfstate.d/dev/terraform.tfstate\n./terraform.tfstate.d/prod/terraform.tfstate"
    }
  ]
}
```

The `prod` workspace started with an empty state, so `apply` created a second file with three replicas, while the `dev` state still tracks its own copy. With the local backend, each extra workspace keeps its state in `terraform.tfstate.d/<name>/`; remote backends store one state per workspace (the S3 backend under `env:/<name>/` in the bucket). Since Terraform 1.16, scripts can read the list as JSON:

```terminal
{
  "title": "workspaces for scripts",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform workspace list -json | jq -c '[.workspaces[].name]'",
      "output": "[\"default\",\"dev\",\"prod\"]"
    },
    {
      "cmd": "terraform workspace delete dev",
      "output": "╷\n│ Error: Workspace is not empty\n│\n│ Workspace \"dev\" is currently tracking the following resource instances:\n│   - local_file.app\n│\n│ Deleting this workspace would cause Terraform to lose track of any\n│ associated remote objects, which would then require you to delete them\n│ manually outside of Terraform. You should destroy these objects with\n│ Terraform before deleting the workspace.\n│\n│ If you want to delete this workspace anyway, and have Terraform forget\n│ about these managed objects, use the -force option to disable this safety\n│ check.\n╵"
    }
  ]
}
```

Terraform refuses to delete a workspace whose state still tracks objects, so you cannot orphan resources by accident, and it never deletes the workspace you are in. The clean way is `terraform workspace select dev`, `terraform destroy`, `terraform workspace select default`, then `terraform workspace delete dev`.

### When Workspaces Fit

Workspaces are simple, but every workspace shares the same code, the same backend and the same credentials. HashiCorp's own documentation says they are not a good fit for separating environments that need different credentials or strong isolation. They work well for:

- short-lived copies of the same infrastructure: one per pull request or per developer;
- testing a change against a throwaway copy before you merge it;
- identical environments that differ only in size, in the same account.

They are risky for dev and prod, because one forgotten `terraform workspace select` applies prod-sized changes to the wrong place, and nothing in the code shows which workspace is active. If you use them anyway, put the workspace name in your shell prompt and fail early on unexpected names with a `precondition` or a validation on `terraform.workspace`.

HCP Terraform also has "workspaces", but they are a different thing: each HCP Terraform workspace is a separate unit with its own state, variables, permissions and run history, closer to the directories below than to CLI workspaces.

## One Directory per Environment

The common layout for long-lived environments is a shared module plus a small root module per environment:

```text
envs-demo/
├── modules/
│   └── app/              # everything an environment contains
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
└── envs/
    ├── dev/
    │   ├── main.tf       # backend, providers, module call
    │   └── terraform.tfvars
    └── prod/
        ├── main.tf
        └── terraform.tfvars
```

Each environment directory is a separate root module with its own state, so `terraform apply` in `envs/dev` cannot touch production. It can also use different credentials (a different AWS account or a different Azure subscription), different provider versions while you test an upgrade, and different backend settings. The differences between environments live in `terraform.tfvars`, where a reviewer can see them.

The shared module:

```hcl
variable "environment" {
  type = string
}

variable "replicas" {
  type = number
}

variable "enable_alerts" {
  type    = bool
  default = false
}

resource "local_file" "app" {
  filename = "${path.root}/out/app.conf"
  content  = "environment=${var.environment}\nreplicas=${var.replicas}\n"
}

# Only some environments get alerts
resource "local_file" "alerts" {
  count    = var.enable_alerts ? 1 : 0
  filename = "${path.root}/out/alerts.conf"
  content  = "page_on_call=true\n"
}

output "files" {
  value = concat([local_file.app.filename], local_file.alerts[*].filename)
}
```

The production root module (dev is the same apart from its `terraform.tfvars`):

```hcl
terraform {
  required_version = ">= 1.17"

  required_providers {
    local = {
      source  = "hashicorp/local"
      version = "~> 2.9"
    }
  }

  # In a real project: backend "s3" { key = "prod/app.tfstate" ... } (Part 9)
}

variable "environment" {
  type = string
}

variable "replicas" {
  type = number
}

variable "enable_alerts" {
  type = bool
}

module "app" {
  source = "../../modules/app"

  environment   = var.environment
  replicas      = var.replicas
  enable_alerts = var.enable_alerts
}

output "files" {
  value = module.app.files
}
```

```hcl
environment   = "prod"
replicas      = 3
enable_alerts = true
```

`-chdir` runs Terraform in another directory without `cd`, which is handy in scripts and CI:

```terminal
{
  "title": "two environments, two states",
  "prompt": "$",
  "steps": [
    {
      "cmd": "cat envs/dev/terraform.tfvars",
      "output": "environment   = \"dev\"\nreplicas      = 1\nenable_alerts = false"
    },
    {
      "cmd": "terraform -chdir=envs/dev init"
    },
    {
      "cmd": "terraform -chdir=envs/dev apply -auto-approve",
      "output": "\nOutputs:\n\nfiles = [\n  \"./out/app.conf\",\n]"
    },
    {
      "cmd": "terraform -chdir=envs/prod init"
    },
    {
      "cmd": "terraform -chdir=envs/prod apply -auto-approve",
      "output": "\nOutputs:\n\nfiles = [\n  \"./out/app.conf\",\n  \"./out/alerts.conf\",\n]"
    },
    {
      "cmd": "find envs -name '*.tfstate' -o -name '*.conf' | sort",
      "output": "envs/dev/out/app.conf\nenvs/dev/terraform.tfstate\nenvs/prod/out/alerts.conf\nenvs/prod/out/app.conf\nenvs/prod/terraform.tfstate"
    }
  ]
}
```

Production got the alerts file and dev did not, from the same module. In AWS terms, `enable_alerts` would create CloudWatch alarms and an SNS topic only where you want them:

```hcl
variable "enable_alerts" {
  type    = bool
  default = false
}

resource "aws_sns_topic" "alerts" {
  count = var.enable_alerts ? 1 : 0
  name  = "webapp-alerts"
}

resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  count = var.enable_alerts ? 1 : 0

  alarm_name          = "webapp-high-cpu"
  namespace           = "AWS/EC2"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]
}
```

### Per-Environment Backend Settings

Each environment's state goes to its own key, often its own bucket in its own account. To avoid copying backend blocks around, leave the settings out of the code (a **partial configuration**) and pass a file to `init`:

```hcl
terraform {
  backend "s3" {}
}
```

```hcl
# envs/prod/prod.s3.tfbackend
bucket       = "acme-terraform-state-prod"
key          = "webapp/terraform.tfstate"
region       = "eu-west-1"
use_lockfile = true
```

```bash
terraform -chdir=envs/prod init -backend-config=prod.s3.tfbackend
```

The `-backend-config` path is relative to the `-chdir` directory. [Part 9](/guides/introduction-to-terraform/09-remote-backends-and-collaboration) explains the S3 settings, including `use_lockfile`.

### Keep Environments Alike

Separate directories make drift between environments easy: someone adds a resource to `envs/prod/main.tf` and forgets dev. Keep the root modules thin (backend, providers, one or a few module calls), put every resource in shared modules, and let the `.tfvars` files carry the differences. A pull request that changes only `prod/terraform.tfvars` is easy to review; one that changes resource blocks in one environment only deserves a second look.

## Promote Changes Through Environments

Whatever the layout, use the same path for every change:

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Pull request", "sub": "plan for every environment", "icon": "branch", "tone": "slate" },
    { "label": "Apply dev", "sub": "after merge", "icon": "rocket", "tone": "blue" },
    { "label": "Apply staging", "sub": "tests pass", "icon": "check", "tone": "violet" },
    { "label": "Approve prod", "sub": "review the saved plan", "icon": "shield", "tone": "amber" },
    { "label": "Apply prod", "sub": "the reviewed plan", "icon": "rocket", "tone": "green" }
  ]
}
```

When a shared module comes from a registry or Git (not a local path), you can also promote **versions**: dev uses `version = "2.4.0"` of the module while prod stays on `2.3.1` until the new version has proven itself. With local paths, every environment uses the module code of the commit you check out, so the order of applies is your safety net. [Part 9](/guides/introduction-to-terraform/09-remote-backends-and-collaboration#h2-team-workflow-plan-in-pull-requests-apply-after-review) shows a CI workflow for this.

## Share Data Between Configurations

Split configurations sometimes need each other's values: the application needs the network's subnet IDs. There are three common ways:

1. **Look the objects up with data sources** (`data "aws_vpc"` with a tag filter). No coupling to the other team's state; the objects just have to exist.
2. **Publish values in a parameter store** (AWS SSM Parameter Store, Consul, a key-value store) from one configuration and read them in the other.
3. **Read the other state's outputs** with the `terraform_remote_state` data source. It only needs read access to that state, but read access to a state means access to every secret in it, so use it inside one team.

Here is the third option with the local backend, in a directory `remote-state` with two configurations. `network/main.tf` stands in for the network configuration and publishes an output (a real one would create the subnets):

```hcl
output "subnet_ids" {
  value = ["subnet-0a1b2c", "subnet-3d4e5f"]
}
```

```terminal
{
  "title": "apply the network configuration",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform -chdir=network init"
    },
    {
      "cmd": "terraform -chdir=network apply -auto-approve",
      "output": "Outputs:\n\nsubnet_ids = [\n  \"subnet-0a1b2c\",\n  \"subnet-3d4e5f\",\n]"
    }
  ]
}
```

`app/main.tf` reads that state:

```hcl
data "terraform_remote_state" "network" {
  backend = "local"
  config = {
    path = "${path.module}/../network/terraform.tfstate"
  }
}

output "first_subnet" {
  value = data.terraform_remote_state.network.outputs.subnet_ids[0]
}
```

```terminal
{
  "title": "terraform_remote_state",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform -chdir=app init"
    },
    {
      "cmd": "terraform -chdir=app apply -auto-approve",
      "output": "\nOutputs:\n\nfirst_subnet = \"subnet-0a1b2c\""
    }
  ]
}
```

With S3 you set `backend = "s3"` and the bucket, key and region of the other state instead of `path`. Only root module outputs are visible, so the producing configuration decides what it shares.

## Terragrunt

When you have many environments and components, the per-environment directories repeat the same backend and provider blocks over and over. **Terragrunt**, a separate open source tool from Gruntwork, generates those blocks from one root file and runs Terraform or OpenTofu across many directories at once. Version 1.0 and later use a root file called `root.hcl`:

```hcl
# One state file per directory, under state/ (with S3, see below)
remote_state {
  backend = "local"
  config = {
    path = "${get_parent_terragrunt_dir()}/state/${path_relative_to_include()}/terraform.tfstate"
  }
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
}

# Every unit gets the same provider requirements
generate "versions" {
  path      = "versions.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<-EOF
    terraform {
      required_providers {
        local = {
          source  = "hashicorp/local"
          version = "~> 2.9"
        }
      }
    }
  EOF
}
```

Each environment is a **unit**: a `terragrunt.hcl` that includes the root file, names the module and sets its inputs:

```hcl
include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../modules/app"
}

inputs = {
  environment   = "prod"
  replicas      = 3
  enable_alerts = true
}
```

`terragrunt run --all` runs a Terraform command in every unit below the current directory, in parallel where the units do not depend on each other. Terragrunt prefixes each line with a timestamp and the unit name; the output below is cut to Terraform's summary lines:

```terminal
{
  "title": "terragrunt run --all plan",
  "prompt": "$",
  "steps": [
    {
      "cmd": "cd live"
    },
    {
      "comment": "Terragrunt runs tofu by default; select terraform instead",
      "cmd": "export TG_TF_PATH=terraform"
    },
    {
      "cmd": "terragrunt run --all plan",
      "output": "23:09:19.585 STDOUT [dev] terraform:   # local_file.app will be created\n23:09:19.585 STDOUT [dev] terraform: Plan: 1 to add, 0 to change, 0 to destroy.\n23:09:20.153 STDOUT [prod] terraform:   # local_file.alerts[0] will be created\n23:09:20.153 STDOUT [prod] terraform:   # local_file.app will be created\n23:09:20.154 STDOUT [prod] terraform: Plan: 2 to add, 0 to change, 0 to destroy."
    }
  ]
}
```

With S3, the `remote_state` block in `root.hcl` becomes:

```hcl
remote_state {
  backend = "s3"
  config = {
    bucket       = "acme-terraform-state"
    key          = "${path_relative_to_include()}/terraform.tfstate"
    region       = "eu-west-1"
    encrypt      = true
    use_lockfile = true
  }
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
}
```

Terragrunt also models dependencies between units (`dependency` blocks that read another unit's outputs) and, with `terragrunt.stack.hcl` files, generates whole sets of units. It adds a tool to learn and to keep updated, so reach for it when the repetition hurts, not on day one.

## HCP Terraform Projects and Stacks

If you run Terraform through HCP Terraform, each environment is usually a separate HCP Terraform workspace, grouped into **projects** for permissions. **Terraform Stacks**, generally available in HCP Terraform since HashiConf 2025, go further: you describe the components once in `.tfcomponent.hcl` files and each environment (a **deployment**) in a `.tfdeploy.hcl` file, and HCP Terraform plans and applies them in order, passing values between components. Stacks run only in HCP Terraform, not with the plain CLI, and are not available on the legacy team plans.

## Choosing an Approach

| Situation                                             | Approach                                                                                   |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Learning, or temporary copies per branch or developer | CLI workspaces                                                                             |
| Two or three long-lived environments, one team        | One directory per environment with shared modules                                          |
| Many environments, accounts or regions                | Directories plus Terragrunt, or HCP Terraform Stacks                                       |
| Environments owned by different teams                 | Separate configurations and states, sharing data through data sources or a parameter store |

Whichever you choose, give production its own cloud account or subscription. Separate state protects you from Terraform mistakes; separate accounts also protect you from everything else.

## Common Mistakes

- **dev and prod in workspaces of the same configuration.** One wrong `select` and prod gets dev's changes, with nothing in the code to warn you.
- **Copy-pasted environments that slowly diverge.** Keep root modules thin and differences in `.tfvars`.
- **One state for all environments.** A plan for dev reads and locks production too.
- **Cross-environment references.** Dev must never depend on prod's state; if they share something, give it its own configuration.
- **Skipping staging for "small" changes.** The changes that break production are the ones nobody expected to.

## Summary

- Every environment needs its own state; workspaces and directories are two ways to get it.
- Workspaces suit short-lived copies; directories with shared modules suit long-lived environments.
- Keep differences in `.tfvars` files and backend config files, and resources in shared modules.
- `terraform_remote_state`, data sources and parameter stores share values between configurations.
- Terragrunt and HCP Terraform Stacks remove repetition at scale.

In [Part 9](/guides/introduction-to-terraform/09-remote-backends-and-collaboration) you move state into a remote backend so a team can work on it safely.

## Keep Learning

- [Managing Different Environments in Terraform](/posts/different-environments-in-terraform)
- [How to Organize Terraform Modules for Multiple Environments](/posts/organize-terraform-modules-multiple-environments)
- [How to Run Terraform Init From a Different Directory](/posts/terraform-run-init-from-different-folder)
- [Terraform Repository Structure Checklist](/checklists/terraform-repo-structure)
