---
title: 'How to Run Terraform From a Different Directory and in Scripts'
excerpt: 'Use terraform -chdir to run init, plan and apply against another folder, run Terraform without interactive prompts, limit a run to one resource with -target, and destroy everything except one resource without losing it.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2025-02-25'
publishedAt: '2025-02-25T10:15:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Infrastructure as Code
  - CLI
  - Automation
  - CI/CD
  - DevOps
---

Terraform works on the folder you run it in, and by default it asks before it changes anything. That is right for a person at a terminal. In scripts, Makefiles and CI pipelines you want the opposite: run against a folder you name, never wait for input, and change only what you meant to change.

This post covers the CLI options for that: `-chdir` to work on another folder, the flags that turn off prompts, `-target` to limit a run to one resource, and a safe way to destroy every resource except one.

## TLDR

| Question                                         | Short answer                                                                                  |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| How do I run `init` in another folder?           | `terraform -chdir=environments/prod init`. `-chdir` goes before the subcommand                |
| Where do `-out` and `-var-file` paths point?     | They are relative to the `-chdir` folder                                                      |
| How do I skip the "Enter a value: yes" prompt?   | `terraform apply tfplan` for a saved plan, or `-auto-approve`. Add `-input=false` in scripts  |
| How do I apply only one resource?                | `terraform apply -target=aws_instance.web`, for recovery only, then a full plan               |
| How do I destroy everything except one resource? | Replace its block with a `removed` block (`destroy = false`), apply, then `terraform destroy` |

## Prerequisites

- Terraform 0.14 or later for `-chdir`, and 1.7 or later for `removed` blocks.
- The outputs in this post come from Terraform 1.15.8 with the built-in `terraform_data` resource.

## How Do I Run Terraform Init From a Different Directory?

Use the global `-chdir` option. It changes the working folder before the subcommand runs, and your shell stays where it is:

```bash
terraform -chdir=environments/prod init
terraform -chdir=environments/prod plan -out=tfplan
terraform -chdir=environments/prod apply tfplan
```

`-chdir` must come before the subcommand. After it, the subcommand rejects it:

```text
$ terraform init -chdir=environments/prod
Error: Failed to parse command-line flags

flag provided but not defined: -chdir
```

The old form with the folder as the last argument was removed. On current versions, `terraform init environments/prod` fails with `Too many command line arguments. Did you mean to use -chdir?`.

### Paths Are Relative to the New Folder

Every relative path on the command line is resolved from the `-chdir` folder. That includes `-out`, `-var-file`, `-backend-config` and plan file names:

```bash
# writes environments/prod/tfplan
terraform -chdir=environments/prod plan -out=tfplan

# reads backends/prod.hcl from the folder you are in
terraform -chdir=environments/prod init -backend-config="$PWD/backends/prod.hcl"

# the same with a path relative to the target folder
terraform -chdir=environments/prod init -backend-config=../../backends/prod.hcl
```

Inside the configuration, `path.module` and `path.root` point at the target folder, and local module sources such as `../../modules/vpc` resolve from it. The exception is `path.cwd`: it still returns the folder you started in, which is one more reason not to use it. [Where path.module points](/posts/terraform-read-environment-variables-from-env-file#h2-how-do-i-get-the-current-working-directory-in-terraform) shows the values side by side.

The `.terraform` folder is created inside the target folder. If you set `TF_DATA_DIR` to move it, set the same value for every command that uses that folder, because a later `plan` without it will not find the providers that `init` installed.

### Run Several Folders From One Script

A loop with `-chdir` is enough for a handful of root folders:

```bash
#!/usr/bin/env bash
set -euo pipefail

for dir in environments/dev/network environments/dev/app; do
  echo "== $dir"
  terraform -chdir="$dir" init -input=false
  terraform -chdir="$dir" validate
  terraform -chdir="$dir" plan -input=false -out=tfplan
done
```

`cd` in a subshell does the same and is fine too: `(cd "$dir" && terraform plan)`. The parentheses keep the `cd` from affecting the rest of the script. A Makefile target such as `plan-%:` with `terraform -chdir=environments/$* plan` gives you `make plan-prod`.

In GitHub Actions, a matrix runs each folder as its own job:

```yaml
jobs:
  plan:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        dir: [environments/dev/app, environments/staging/app, environments/prod/app]
    steps:
      - uses: actions/checkout@v7
      - uses: hashicorp/setup-terraform@v4
        with:
          terraform_version: 1.17.2
      - run: terraform -chdir=${{ matrix.dir }} init -input=false
      - run: terraform -chdir=${{ matrix.dir }} plan -input=false -no-color -out=tfplan
```

Each job also needs credentials for its environment, ideally a separate role per environment.

## How Do I Run Terraform Without the Interactive Prompt?

There are two prompts, and each has its own switch:

- **The approval prompt** (`Enter a value:` before apply or destroy). Apply a saved plan, `terraform apply tfplan`, which never asks. Or pass `-auto-approve` to `apply` or `destroy`.
- **Questions for missing variables.** Pass `-input=false`, or set `TF_INPUT=0`. Terraform then stops with an error instead of waiting for someone to type a value.

The safe pattern for automation saves the plan and applies exactly that plan:

```bash
export TF_IN_AUTOMATION=1   # shorter output, no "run terraform apply next" hints

terraform init -input=false
terraform plan -input=false -out=tfplan
# review or approve the plan here
terraform apply -input=false tfplan
```

`terraform apply tfplan` refuses to run if the state changed after the plan was made, so you never apply a plan that is out of date. `terraform apply -auto-approve` without a plan file makes a new plan and applies it at once, so nobody sees what it will do. Keep `-auto-approve` for throwaway environments and for `destroy` in test pipelines.

With `TF_INPUT=0` and a required variable without a value, Terraform stops at once:

```text
Error: No value for required variable

  on main.tf line 1:
   1: variable "name" {
```

Give variable values with `-var-file`, `TF_VAR_<name>` environment variables, or an `*.auto.tfvars` file. Add `-lock-timeout=5m` when two pipelines can run against the same state, so the second one waits for the lock instead of failing. [How to Save Terraform Plan and Apply Output to a File](/posts/terraform-save-plan-apply-output-to-file) shows how to keep the plan and the logs as artifacts.

## How Do I Run Terraform Only for a Specific Resource?

Pass `-target` with the resource address to `plan` or `apply`:

```bash
terraform plan -target=aws_instance.web -out=tfplan
terraform apply tfplan

# for_each and count instances need the key, in quotes
terraform apply -target='aws_instance.servers["web"]'

# a whole module
terraform apply -target=module.network
```

Terraform includes the resources that the target depends on, so a target on an instance also creates its security group if it does not exist yet. With `destroy`, `-target` also destroys everything that depends on the target. Here is the start of a targeted apply where `terraform_data.app` depends on `terraform_data.net`:

```text
  # terraform_data.app will be created
  # terraform_data.net will be created
Plan: 2 to add, 0 to change, 0 to destroy.
...
Warning: Resource targeting is in effect

You are creating a plan with the -target option, which means that the result
of this plan may not represent all of the changes requested by the current
configuration.

The -target option is not for routine use, and is provided only for
exceptional situations such as recovering from errors or mistakes, or when
Terraform specifically suggests to use it as part of an error message.
```

Take the warning seriously. A targeted run skips every other change in the configuration, so the state and the code drift apart until someone runs a full plan. Use `-target` to recover, for example when one broken resource blocks the whole apply, and run a full `terraform plan` afterwards to see what is still pending. If you need `-target` every week, the configuration is too big: split it into smaller root folders with their own state.

Two related flags are often what you want instead:

- `-replace=aws_instance.web` replaces one resource that is in a bad state, as part of a normal full plan. It is the replacement for the deprecated `terraform taint` command.
- `-refresh-only` updates the state from the real objects without changing them. [Who Owns the State File](/posts/who-owns-the-terraform-state-file#h3-what-does-terraform-refresh-do) explains when that helps.

## How Do I Delete All Resources Except One?

Tell Terraform to forget the resource you want to keep, then destroy the rest. On Terraform 1.7 and later, do the first step with a `removed` block, so it is part of the code and shows up in review:

```hcl
# The block for terraform_data.db is deleted from the code and replaced with:
removed {
  from = terraform_data.db

  lifecycle {
    destroy = false
  }
}
```

```bash
terraform apply     # forgets terraform_data.db, changes nothing else
terraform destroy   # destroys every resource that is still in the state
```

The plan for the first step says what will happen:

```text
  # terraform_data.db will no longer be managed by Terraform, but will not be destroyed
  # (destroy = false is set in the configuration)

Plan: 0 to add, 0 to change, 0 to destroy.

Warning: Some objects will no longer be managed by Terraform
```

After that, `terraform destroy` showed `Plan: 0 to add, 0 to change, 2 to destroy.` and the kept object was not part of it. To manage the kept object again, in this configuration or another one, write its resource block and an `import` block with its ID.

Before you run the destroy, check the dependencies:

- **The kept resource may depend on resources you destroy.** A database in a subnet that you destroy either blocks the destroy (AWS refuses to delete a subnet that is in use) or loses its network. Keep those resources too, or move the database first.
- **`prevent_destroy` does not help here.** It makes the whole `terraform destroy` fail with `Instance cannot be destroyed`. It does not skip the resource.
- **`terraform state rm` does the same as the `removed` block** in one command, but nothing records it in Git. Use it only when you cannot change the code.
- **Terraform 1.16 and later** also accept `destroy = false` in a resource's own `lifecycle` block. Terraform then removes that resource from the state instead of destroying it. Read your version's documentation before you rely on it, and check the plan.

If only a few resources must go, the reverse is simpler: `terraform destroy -target=...` for each of them, followed by removing their blocks from the code. The [state management chapter](/guides/introduction-to-terraform/05-state-management#h3-stop-managing-an-object-without-deleting-it) of our Terraform guide covers `removed` blocks, and [Terraform State: Remove, Move and Migrate Resources](/posts/terraform-state-remove-move-migrate-backend) shows moving resources between state files.

## Related Resources

- [Terraform terminal simulator](/games/terraform-terminal-simulator) to practice `init`, `plan`, `apply` and `state` commands.
- [Targeting and forcing replacement](/guides/introduction-to-terraform/04-resources-and-data-sources#h2-targeting-and-forcing-replacement) in our Terraform guide.
- [Plan in pull requests, apply after review](/guides/introduction-to-terraform/09-remote-backends-and-collaboration#h2-team-workflow-plan-in-pull-requests-apply-after-review), a full CI workflow.
- [How to Organize a Terraform Repository](/posts/organizing-terraform-repository-with-subfolders) for the folder layout that `-chdir` runs against.
