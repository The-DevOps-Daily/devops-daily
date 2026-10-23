---
title: 'Terraform Best Practices for Production'
description: 'Terraform best practices for production: layout, version pinning, lock files, linting, terraform test, ephemeral secrets, CI checks and drift detection.'
order: 10
---

**TLDR**: Split state by environment and component, pin Terraform and provider versions and commit `.terraform.lock.hcl`, and run `fmt -check`, `validate`, TFLint, a security scanner and `terraform test` on every pull request. Keep secrets out of state with ephemeral resources and write-only arguments. Apply only from CI, from a reviewed plan, and run a scheduled `plan -detailed-exitcode` to catch drift. Upgrade Terraform and providers on purpose, one environment at a time.

The earlier parts showed how each feature works. This part is about running Terraform for years without surprises: how to structure the code, which checks to automate, how to keep secrets out of state, and how to upgrade. The tool output comes from real runs of Terraform 1.17 and TFLint 0.65.

## Prerequisites

- Everything from Parts 1 to 9, especially remote state and the CI workflow from [Part 9](/guides/introduction-to-terraform/09-remote-backends-and-collaboration).

## Structure the Code

**Small states.** Every `plan` reads every object in the state, every lock blocks everyone, and every mistake can reach everything in it. Split by environment first ([Part 8](/guides/introduction-to-terraform/08-working-with-multiple-environments)), then by component and rate of change: the network changes a few times a year, the application stack every week, DNS and IAM somewhere in between. A plan that takes minutes and shows hundreds of unchanged resources is a sign the state is too big.

```text
infra/
├── modules/                  # reusable modules, versioned or local
│   ├── network/
│   ├── app/
│   └── database/
└── live/
    ├── prod/
    │   ├── network/          # one state each
    │   ├── database/
    │   └── app/
    └── dev/
        ├── network/
        ├── database/
        └── app/
```

**Files inside a root module.** `versions.tf` (the `terraform` block and providers), `providers.tf`, `variables.tf`, `outputs.tf`, `locals.tf`, and resource files named by what they contain (`network.tf`, `dns.tf`, `iam.tf`). Terraform does not care; people searching for a resource do.

**Naming.** Resource names are `snake_case` and do not repeat the type: `aws_instance.web`, not `aws_instance.web_instance`. Use `this` for the single main resource of a module. Real-world names (tags, bucket names) come from a variable or local such as `"${var.project}-${var.environment}-web"`.

**Tags everywhere.** Set common tags once with the AWS provider's `default_tags` (the Google provider has `default_labels`; for Azure, merge a shared tags map into every resource or enforce tags with Azure Policy) so cost reports and incident responders can find the owner of every resource.

## Pin Versions and Commit the Lock File

```hcl
terraform {
  # Every person and pipeline must run 1.17.x
  required_version = "~> 1.17.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.70" # 6.70 or newer, below 7.0
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.9"
    }
  }
}
```

| Constraint  | Allows                         | Use it for                       |
| ----------- | ------------------------------ | -------------------------------- |
| `= 1.17.0`  | exactly 1.17.0                 | Rarely: you lose security fixes  |
| `~> 1.17.0` | 1.17.x                         | Terraform itself in root modules |
| `~> 6.70`   | 6.70 up to, not including, 7.0 | Providers in root modules        |
| `>= 6.28`   | any newer version              | Providers in reusable modules    |

The lock file records the exact version and checksums `init` chose. Commit it, and let CI install with `terraform init -lockfile=readonly` so nothing changes unless a pull request changes the lock file.

The lock file holds two kinds of checksums. `zh:` entries are the SHA-256 sums of the release zip files for every platform, copied from the registry's signed checksum list. `h1:` entries are hashes of the unpacked package, and `init` only records them for the platform it ran on. Some installs record or check only `h1:` hashes, for example installs from a provider mirror or from the plugin cache, and then a lock file made on a Mac can fail on a Linux CI runner. `terraform providers lock` adds `h1:` hashes for every platform your team and CI use. Here it runs in a small local project with this `versions.tf`, after a `terraform init` on a Linux arm64 machine:

```hcl
terraform {
  required_version = "~> 1.17.0"

  required_providers {
    local = {
      source  = "hashicorp/local"
      version = "~> 2.9"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.9"
    }
  }
}
```

```terminal
{
  "title": "lock checksums for other platforms",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform providers lock -platform=linux_amd64 -platform=linux_arm64 -platform=darwin_arm64 -platform=windows_amd64",
      "output": "- Fetching hashicorp/random 3.9.1 for linux_amd64...\n- Retrieved hashicorp/random 3.9.1 for linux_amd64 (signed by HashiCorp)\n- Fetching hashicorp/local 2.9.1 for linux_amd64...\n- Retrieved hashicorp/local 2.9.1 for linux_amd64 (signed by HashiCorp)\n- Fetching hashicorp/random 3.9.1 for linux_arm64...\n- Retrieved hashicorp/random 3.9.1 for linux_arm64 (signed by HashiCorp)\n- Fetching hashicorp/local 2.9.1 for linux_arm64...\n- Retrieved hashicorp/local 2.9.1 for linux_arm64 (signed by HashiCorp)\n- Fetching hashicorp/random 3.9.1 for darwin_arm64...\n- Retrieved hashicorp/random 3.9.1 for darwin_arm64 (signed by HashiCorp)\n- Fetching hashicorp/local 2.9.1 for darwin_arm64...\n- Retrieved hashicorp/local 2.9.1 for darwin_arm64 (signed by HashiCorp)\n- Fetching hashicorp/random 3.9.1 for windows_amd64...\n- Retrieved hashicorp/random 3.9.1 for windows_amd64 (signed by HashiCorp)\n- Fetching hashicorp/local 2.9.1 for windows_amd64...\n- Retrieved hashicorp/local 2.9.1 for windows_amd64 (signed by HashiCorp)\n- Obtained hashicorp/random checksums for windows_amd64; Additional checksums for this platform are now tracked in the lock file\n- Obtained hashicorp/random checksums for linux_amd64; Additional checksums for this platform are now tracked in the lock file\n- Obtained hashicorp/random checksums for linux_arm64; All checksums for this platform were already tracked in the lock file\n- Obtained hashicorp/random checksums for darwin_arm64; Additional checksums for this platform are now tracked in the lock file\n- Obtained hashicorp/local checksums for linux_amd64; Additional checksums for this platform are now tracked in the lock file\n- Obtained hashicorp/local checksums for linux_arm64; All checksums for this platform were already tracked in the lock file\n- Obtained hashicorp/local checksums for darwin_arm64; Additional checksums for this platform are now tracked in the lock file\n- Obtained hashicorp/local checksums for windows_amd64; Additional checksums for this platform are now tracked in the lock file\n\nSuccess! Terraform has updated the lock file.\n\nReview the changes in .terraform.lock.hcl and then commit to your\nversion control system to retain the new checksums."
    }
  ]
}
```

Upgrade on purpose: `terraform init -upgrade` picks the newest versions that match your constraints and rewrites the lock file, which then shows up in a pull request. Dependabot and Renovate both understand Terraform and open those pull requests for you:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: terraform
    directories: ['/infra/live/*/*', '/infra/modules/*']
    schedule:
      interval: weekly
```

## Format, Validate and Lint

Three fast checks catch most mistakes before a plan touches a cloud API:

```terminal
{
  "title": "fmt, validate and TFLint",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform fmt -check -diff; echo \"exit code: $?\"",
      "output": "main.tf\n--- old/main.tf\n+++ new/main.tf\n@@ -3,10 +3,10 @@\n }\n\n variable \"unused_region\" {\n-  type = string\n+  type    = string\n   default = \"eu-west-1\"\n }\n\n resource \"random_pet\" \"app\" {\n-  prefix = \"${var.environment}\"\n+  prefix = var.environment\n }\nexit code: 3"
    },
    {
      "cmd": "terraform validate",
      "output": "Success! The configuration is valid."
    },
    {
      "cmd": "tflint",
      "output": "2 issue(s) found:\n\nWarning: [Fixable] variable \"unused_region\" is declared but not used (terraform_unused_declarations)\n\n  on main.tf line 5:\n   5: variable \"unused_region\" {\n\nReference: https://github.com/terraform-linters/tflint-ruleset-terraform/blob/v0.15.0/docs/rules/terraform_unused_declarations.md\n\nWarning: [Fixable] Interpolation-only expressions are deprecated in Terraform v0.12.14 (terraform_deprecated_interpolation)\n\n  on main.tf line 11:\n  11:   prefix = \"${var.environment}\"\n\nReference: https://github.com/terraform-linters/tflint-ruleset-terraform/blob/v0.15.0/docs/rules/terraform_deprecated_interpolation.md"
    }
  ]
}
```

- **`terraform fmt -check`** exits with a non-zero code when a file is not formatted; `-diff` shows what would change. Run `terraform fmt -recursive` before you commit, or in a pre-commit hook.
- **`terraform validate`** checks syntax, types and references. It does not call any API, so it runs without credentials.
- **[TFLint](https://github.com/terraform-linters/tflint)** finds what `validate` accepts but a reviewer would not: unused variables, deprecated syntax, missing version constraints and, with a provider plugin such as `tflint-ruleset-aws`, invalid instance types or regions. It ran here with its built-in Terraform rules; enable more in a `.tflint.hcl` file and install plugins with `tflint --init`. Install TFLint with `brew install terraform-linters/tap/tflint`, `winget install -e --id TerraformLinters.tflint`, or from its releases page.

### Security Scanners

Static scanners read your code (or a plan) and flag insecure settings: public buckets, unencrypted volumes, security groups open to the world, IAM policies with `*`.

```bash
# Trivy: misconfiguration checks for Terraform (it absorbed tfsec)
trivy config .

# Checkov: a similar set of checks, plus custom policies in Python or YAML
checkov -d .

# Either can scan a plan, which sees values that only exist after variables are resolved
terraform plan -out=tfplan && terraform show -json tfplan > tfplan.json
checkov -f tfplan.json
```

These commands are shown without output because the result depends entirely on your code. Start by failing the build only on high-severity findings, and suppress a finding in code only with a comment that says why.

## Test Your Code

`terraform test` (since Terraform 1.6) runs `.tftest.hcl` files from the `tests/` directory. Each `run` block plans or applies the module with some variables and checks `assert` conditions. With **mock providers** (since 1.7), tests run without credentials and create nothing, but `terraform init` must still install the providers so Terraform knows their schemas. Here is a module and its tests, in a new directory called `testing`:

```hcl
variable "environment" {
  type = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging or prod."
  }
}

variable "domain" {
  type = string
}

resource "random_id" "suffix" {
  byte_length = 4
}

resource "local_file" "config" {
  filename = "${path.module}/out/${var.environment}.conf"
  content  = "server_name ${var.domain};\n# deployment ${random_id.suffix.hex}\n"
}

output "filename" {
  value = local_file.config.filename
}
```

```hcl
# Replace the real providers: nothing is written to disk
mock_provider "local" {}

mock_provider "random" {
  mock_resource "random_id" {
    defaults = {
      hex = "abcd1234"
    }
  }
}

variables {
  environment = "dev"
  domain      = "dev.shop.example.com"
}

run "file_name_follows_environment" {
  command = plan

  assert {
    condition     = local_file.config.filename == "./out/dev.conf"
    error_message = "Unexpected file name ${local_file.config.filename}."
  }
}

run "content_includes_domain_and_id" {
  # apply with mock providers: values are mocked, nothing real is created
  command = apply

  assert {
    condition     = strcontains(local_file.config.content, "server_name dev.shop.example.com;")
    error_message = "The configuration does not set server_name."
  }

  assert {
    condition     = strcontains(local_file.config.content, "abcd1234")
    error_message = "The deployment ID is missing."
  }
}

run "rejects_unknown_environment" {
  command = plan

  variables {
    environment = "qa"
  }

  expect_failures = [var.environment]
}
```

```terminal
{
  "title": "terraform test",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform test",
      "output": "tests/config.tftest.hcl... in progress\n  run \"file_name_follows_environment\"... pass\n  run \"content_includes_domain_and_id\"... pass\n  run \"rejects_unknown_environment\"... pass\ntests/config.tftest.hcl... tearing down\ntests/config.tftest.hcl... pass\n\nSuccess! 3 passed, 0 failed."
    },
    {
      "cmd": "ls",
      "output": "main.tf\ntests\nversions.tf"
    }
  ]
}
```

After `terraform init`, all three runs pass, and `ls` shows that no `out/` directory was created: the mocks stood in for the providers. Some guidelines:

- **Unit tests** use `command = plan` or mock providers. They are fast and free, so run them on every pull request: naming rules, conditional resources, `for_each` keys, variable validation (`expect_failures`).
- **Integration tests** use the real providers with `command = apply` and create real resources in a test account; `terraform test` destroys them at the end. Run them nightly or before a module release, not on every commit.
- `override_resource`, `override_data` and `override_module` blocks replace single objects instead of a whole provider.
- For tests in Go that need more logic (call the deployed endpoint, retry), Terratest is the established library.

### Check Blocks

A `check` block asserts something about the deployed infrastructure at the end of every plan and apply, and **warns** instead of failing. A check can have its own data source, which is read only for the check. Typical uses are an HTTPS endpoint that should answer, a certificate that should not expire soon, or a quota that should not be near its limit:

```hcl
check "site_is_up" {
  data "http" "home" {
    url = "https://shop.example.com/healthz"
  }

  assert {
    condition     = data.http.home.status_code == 200
    error_message = "https://shop.example.com/healthz returned ${data.http.home.status_code}."
  }
}
```

Combine checks with the scheduled drift detection below, and the same job tells you about drift and about broken endpoints.

## Keep Secrets Out of State

As [Part 5](/guides/introduction-to-terraform/05-state-management#h3-inside-terraformtfstate) showed, state stores secrets in plain text, and `sensitive = true` only hides them in the output. Terraform 1.10 and 1.11 added two features that keep secrets out of state and plan files entirely:

- **Ephemeral resources** (`ephemeral` blocks) produce values that exist only while Terraform runs: a generated password, a private key, a secret read from a vault. They are never saved.
- **Write-only arguments** (by convention, names ending in `_wo`) accept those values and pass them to the provider, which does not save them either. Because Terraform cannot compare a value it never stored, providers usually pair a write-only argument with a version argument (`_wo_version`): the provider updates the real object only when that number changes, so you increase it to roll out a new secret.

This real example creates a certificate authority. The private key is ephemeral and goes to the certificate through the write-only `private_key_pem_wo` argument of the `tls` provider:

```hcl
terraform {
  required_providers {
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.4"
    }
  }
}

variable "ca_validity_hours" {
  type    = number
  default = 8760
}

# Generated on every run, never stored in the plan or the state
ephemeral "tls_private_key" "ca" {
  algorithm   = "ECDSA"
  ecdsa_curve = "P256"
}

resource "tls_self_signed_cert" "ca" {
  private_key_pem_wo         = ephemeral.tls_private_key.ca.private_key_pem
  private_key_pem_wo_version = 1 # increase to issue a certificate for a new key

  subject {
    common_name = "Learn Terraform CA"
  }

  is_ca_certificate     = true
  validity_period_hours = var.ca_validity_hours
  allowed_uses          = ["cert_signing", "crl_signing"]
}
```

```terminal
{
  "title": "an ephemeral key and a write-only argument",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform init"
    },
    {
      "cmd": "terraform plan -no-color | grep -E 'will be created|_wo|^Plan'",
      "output": "  # tls_self_signed_cert.ca will be created\n      + private_key_pem_wo         = (write-only attribute)\n      + private_key_pem_wo_version = 1\nPlan: 1 to add, 0 to change, 0 to destroy."
    },
    {
      "cmd": "terraform apply -auto-approve",
      "output": "ephemeral.tls_private_key.ca: Opening...\nephemeral.tls_private_key.ca: Opening complete after 0s\ntls_self_signed_cert.ca: Creating...\ntls_self_signed_cert.ca: Creation complete after 0s [id=255368495373961532084702312673072874487]\nephemeral.tls_private_key.ca: Closing...\nephemeral.tls_private_key.ca: Closing complete after 0s\n\nApply complete! Resources: 1 added, 0 changed, 0 destroyed."
    },
    {
      "cmd": "jq -c '[.resources[] | {mode, type}]' terraform.tfstate",
      "output": "[{\"mode\":\"managed\",\"type\":\"tls_self_signed_cert\"}]"
    },
    {
      "cmd": "grep -c \"PRIVATE KEY\" terraform.tfstate",
      "output": "0"
    }
  ]
}
```

The plan shows the write-only argument as `(write-only attribute)` and the ephemeral resource is opened and closed during the run, the state has the certificate but no ephemeral resource, and `grep` finds no private key in it (in a real CA you would also store the key somewhere safe, for example in a secrets manager through another write-only argument). Terraform enforces the rules: an ephemeral value cannot go into a normal argument, an output of the root module or anything else that is stored:

```terminal
{
  "title": "Terraform refuses to store an ephemeral value",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform plan",
      "output": "╷\n│ Error: Invalid use of ephemeral value\n│\n│   with terraform_data.copy,\n│   on leak.tf line 2, in resource \"terraform_data\" \"copy\":\n│    2:   input = ephemeral.tls_private_key.ca.private_key_pem\n│\n│ Ephemeral values are not valid for \"input\", because it is not a write-only\n│ attribute and must be persisted to state.\n╵"
    }
  ]
}
```

The big providers support the same pattern. On AWS, for example, you can let RDS manage the master password in Secrets Manager, or generate one ephemerally and pass it as a write-only argument:

```hcl
# Option 1: RDS creates and rotates the password in Secrets Manager
resource "aws_db_instance" "app" {
  identifier                  = "app-prod"
  engine                      = "postgres"
  instance_class              = "db.t4g.micro"
  allocated_storage           = 20
  username                    = "app"
  manage_master_user_password = true
  skip_final_snapshot         = true
}

# Option 2: generate the password ephemerally and pass it write-only
ephemeral "random_password" "reports_db" {
  length  = 32
  special = false
}

resource "aws_db_instance" "reports" {
  identifier          = "reports-prod"
  engine              = "postgres"
  instance_class      = "db.t4g.micro"
  allocated_storage   = 20
  username            = "reports"
  password_wo         = ephemeral.random_password.reports_db.result
  password_wo_version = 1
  skip_final_snapshot = true
}

# Read an existing secret without storing it, for example for a provider configuration
ephemeral "aws_secretsmanager_secret_version" "api" {
  secret_id = "prod/api-token"
}
```

In option 2, the application still needs the password, so you would also write it to a secret store, again with a write-only argument such as `secret_string_wo` on `aws_secretsmanager_secret_version`. For variables, `ephemeral = true` gives you the same guarantee ([Part 6](/guides/introduction-to-terraform/06-variables-and-outputs#h2-ephemeral-variables)). And never put secrets in `.tf` or committed `.tfvars` files, whatever else you do.

## Policy as Code

Reviewers miss things, so encode the rules that must never break (no public buckets, encryption on every volume, only approved regions, tags on everything) and check every plan against them:

- **HCP Terraform and Terraform Enterprise** run Sentinel or OPA policies between plan and apply, and can block the apply.
- **Any CI system** can run [OPA](https://www.openpolicyagent.org/) through Conftest against the JSON plan (`terraform show -json tfplan`), or Checkov with custom policies.
- **Terraform Policy** is HashiCorp's newer framework with policies written in HCL. Since Terraform 1.17, `plan` and `apply` accept a `-policies` flag in normal releases; it needs HashiCorp's policy plugin (`tfpolicy-plugin`) on the machine. Check the [Terraform Policy documentation](https://developer.hashicorp.com/terraform/policy) for its status in HCP Terraform.

Start with a handful of rules that would have prevented real incidents, and grow from there. The post [Gate Your Terraform Plans: Rules Decide, the Model Explains](/posts/terraform-plan-gate-digitalocean-inference) shows a plan gate built this way.

## Detect Drift

Drift accumulates quietly: an emergency console change, an autoscaler, another tool. Find it with a scheduled plan. `-detailed-exitcode` turns the result into an exit code: **0** means no changes, **1** an error, **2** changes present:

```terminal
{
  "title": "plan -detailed-exitcode",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform plan -detailed-exitcode > /dev/null; echo \"exit code: $?\"",
      "output": "exit code: 0"
    },
    {
      "cmd": "terraform plan -detailed-exitcode -var ca_validity_hours=4380 > /dev/null; echo \"exit code: $?\"",
      "output": "exit code: 2"
    }
  ]
}
```

The exit code has one trap: a `check` block with its own data source (like the health check above) makes every plan report a pending read, so `-detailed-exitcode` returns 2 even when nothing changed, with or without `-refresh-only`. A drift job is therefore more reliable when it reads the saved plan as JSON, which lists drift (`resource_drift`), planned changes (`resource_changes`) and check results (`checks`) separately. A scheduled GitHub Actions job built on that (credentials and setup as in the [Part 9 workflow](/guides/introduction-to-terraform/09-remote-backends-and-collaboration#h2-team-workflow-plan-in-pull-requests-apply-after-review)):

```yaml
# .github/workflows/drift.yml
name: drift
on:
  schedule:
    - cron: '17 6 * * 1-5' # weekdays, 06:17 UTC

permissions:
  contents: read
  id-token: write

jobs:
  drift:
    runs-on: ubuntu-24.04
    defaults:
      run:
        working-directory: infra/live/prod/app
    steps:
      - uses: actions/checkout@v7
      - uses: aws-actions/configure-aws-credentials@v6
        with:
          role-to-assume: arn:aws:iam::123456789012:role/terraform-plan
          aws-region: eu-west-1
      - uses: hashicorp/setup-terraform@v4
        with:
          terraform_version: 1.17.0
          terraform_wrapper: false
      - run: terraform init -input=false -lockfile=readonly
      - name: Plan
        run: |
          # A failed plan (exit code 1) fails the job
          terraform plan -input=false -lock=false -no-color -out=drift.tfplan > plan.txt 2>&1 \
            || { cat plan.txt; exit 1; }
          cat plan.txt
          terraform show -json drift.tfplan > plan.json

          drifted=$(jq '[.resource_drift[]?] | length' plan.json)
          pending=$(jq '[.resource_changes[]? | select(.mode == "managed" and .change.actions != ["no-op"])] | length' plan.json)
          failed=$(jq '[.checks[]? | select(.status == "fail" or .status == "error")] | length' plan.json)

          if [ "$drifted" -gt 0 ]; then echo "::warning::$drifted resources changed outside Terraform"; fi
          if [ "$pending" -gt 0 ]; then echo "::warning::$pending resources would change on the next apply"; fi
          if [ "$failed" -gt 0 ]; then echo "::warning::$failed checks failed"; fi
```

`-lock=false` is acceptable here because the plan is never applied. "Changed outside Terraform" is drift in the strict sense; "would change" also catches code that was merged but never applied. A failed check shows up only in `checks` (and as `Warning: Check block assertion failed` in the text output), because checks never fail a plan. Send the warning wherever your team looks (an issue, a chat message), and decide each time: revert the drift with an apply, or accept it by changing the code.

## Upgrade Deliberately

- **Terraform.** Read the changelog of each minor version, upgrade CI and laptops together, and bump `required_version`. Within 1.x, newer versions read older state, but older versions may not read state written by newer ones ([Part 5](/guides/introduction-to-terraform/05-state-management#h2-upgrading-terraform-and-the-state)).
- **Providers.** Patch and minor versions are usually safe; Dependabot or Renovate keep you current. Major versions (AWS 5 to 6, azurerm 4 to 5, google 7 to 8) remove and rename arguments: read the provider's upgrade guide, upgrade one environment, run a plan, and expect **no changes** before you continue.
- **Modules.** Pin, read the release notes, upgrade dev first.
- **OpenTofu.** Switching is mostly `tofu init` in place of `terraform init`, as long as you have not used features only one tool has. Decide it per repository, not per developer.

## Production Checklist

- [ ] One state per environment and component, in a versioned, encrypted remote backend with locking (`use_lockfile = true` on S3).
- [ ] `required_version` and provider constraints set; `.terraform.lock.hcl` committed with checksums for every platform.
- [ ] `fmt -check`, `validate`, TFLint, a security scanner and `terraform test` run on every pull request.
- [ ] Plans are posted for review; applies run only from CI, from the saved plan, after approval for production.
- [ ] CI uses OIDC; nobody has long-lived cloud keys.
- [ ] No secrets in code or committed `.tfvars`; ephemeral resources and write-only arguments where providers support them.
- [ ] `prevent_destroy` plus the provider's own deletion protection on stateful resources.
- [ ] A scheduled drift check that someone reads.
- [ ] A README per root module: what it manages, how to apply it, who owns it.

The [Terraform Repository Structure Checklist](/checklists/terraform-repo-structure) covers the repository side in more detail.

## Common Mistakes

- **One state for everything.** Slow plans, big blast radius, constant lock contention.
- **Unpinned versions.** A new provider release changes behaviour on the next `init`.
- **`apply -auto-approve` from laptops.** No review, no record, no approval.
- **Secrets in variables files, outputs or state.** Use ephemeral values and a secret store.
- **Tests and checks nobody runs.** Wire them into CI from the first day, or they rot.
- **`-target` as a habit.** It hides the rest of the plan; use it for recovery only.

## Summary

- Keep states small and split by environment and component.
- Pin versions, commit the lock file, and upgrade through pull requests.
- Automate formatting, validation, linting, security scanning and `terraform test`.
- Ephemeral resources and write-only arguments keep secrets out of state.
- Policies and reviews gate applies; scheduled plans catch drift.

That completes the guide. You can now write, test and run Terraform the way production teams do. Go back to the [guide overview](/guides/introduction-to-terraform) for the list of parts, or test yourself with the [Terraform quiz](/quizzes/terraform-quiz).

## Keep Learning

- [Terraform Infrastructure as Code Best Practices](/posts/terraform-best-practices)
- [How to Retrieve a Secret in Terraform from AWS Secret Manager](/posts/retrieve-secret-terraform-aws-secret-manager)
- [SOC 2 Evidence From GitHub and Terraform](/posts/soc2-evidence-from-github-and-terraform)
- [Interview question: Infrastructure as Code patterns](/interview-questions/mid/infrastructure-as-code-patterns)
- [OpenTofu 1.13 Re-Encodes base64gzip and Drops WinRM](/posts/opentofu-1-13-upgrade-base64gzip-winrm)
