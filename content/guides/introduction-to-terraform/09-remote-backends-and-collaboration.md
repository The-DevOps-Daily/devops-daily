---
title: 'Terraform Remote Backends: S3 Native Locking and Team Workflows'
description: 'Store Terraform state in S3 with native locking (use_lockfile), Azure, GCS, Postgres or HCP Terraform, migrate state between backends, and run plans in CI.'
order: 9
---

**TLDR**: A **backend** decides where Terraform keeps state and how it locks it. For teams, use a remote one: an S3 bucket with versioning, encryption and `use_lockfile = true` (S3 native locking, generally available since Terraform 1.11; the DynamoDB lock table is deprecated), an Azure storage container, a GCS bucket, PostgreSQL, or HCP Terraform. Move existing state with `terraform init -migrate-state`. Then let CI do the work: plan on every pull request, apply the reviewed plan after merge, with short-lived OIDC credentials instead of stored keys.

A state file on one laptop works until a second person, or a CI pipeline, needs it. This part sets up remote state the way most teams run it in October 2026, migrates a real project into a remote backend, encrypts state with OpenTofu, and builds a pull request workflow in GitHub Actions.

## Prerequisites

- State and locking from [Part 5](/guides/introduction-to-terraform/05-state-management).
- For the S3 sections: an AWS account. The Postgres and OpenTofu examples run locally.

## Why Remote State

Local state breaks down as soon as more than one person or machine runs Terraform:

- **Nobody else can see it.** A teammate who runs `apply` without your state file creates duplicates of everything.
- **It is easy to lose.** A dead laptop or a `git clean` takes the only record with it.
- **Locking only works on one machine.** Two people with copies of the state can apply at the same time.
- **It holds secrets on a laptop.** As [Part 5](/guides/introduction-to-terraform/05-state-management#h3-inside-terraformtfstate) showed, state contains passwords in plain text.
- **It has no history.** You cannot see what changed or roll back to yesterday's version.

A remote backend gives everyone one shared copy. Whether you also get locking, encryption, access control and history depends on the backend and how you set it up: S3 needs versioning on the bucket and `use_lockfile = true`, Azure and GCS need versioning, and Postgres needs database backups. The sections below set each one up properly.

```diagram
{
  "type": "graph",
  "columns": [
    [
      { "id": "dev1", "label": "Your laptop", "sub": "terraform plan", "icon": "cpu", "tone": "slate" },
      { "id": "dev2", "label": "Teammate", "sub": "terraform plan", "icon": "cpu", "tone": "slate" },
      { "id": "ci", "label": "CI pipeline", "sub": "plan and apply", "icon": "rocket", "tone": "green" }
    ],
    [
      { "id": "state", "label": "S3 bucket", "sub": "prod/terraform.tfstate", "icon": "database", "tone": "violet", "detail": "Versioned and encrypted. One object per state; old versions are kept for recovery." },
      { "id": "lock", "label": "Lock file", "sub": "prod/terraform.tfstate.tflock", "icon": "lock", "tone": "red", "detail": "Created with a conditional write while a run holds the lock, deleted when it finishes." }
    ]
  ],
  "edges": [["dev1", "state", "read"], ["dev2", "state", "read"], ["ci", "state", "read/write"], ["ci", "lock", "acquire"], ["dev1", "lock"], ["dev2", "lock"]]
}
```

## The S3 Backend With Native Locking

The `s3` backend is the most common choice, even for teams whose infrastructure is not on AWS. Since Terraform 1.10, it can lock state with a **lock file** next to the state object, using S3 conditional writes, so you no longer need a DynamoDB table. The feature became generally available in 1.11, and the DynamoDB arguments are deprecated.

### Create the State Bucket

The bucket needs some care: versioning for recovery, encryption, no public access, and protection against deletion. You can create it with a small Terraform configuration of its own (with local state, since the bucket does not exist yet):

```hcl
terraform {
  required_version = ">= 1.17"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.70"
    }
  }
}

provider "aws" {
  region = "eu-west-1"
}

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "state" {
  # Bucket names are global; adding the account ID keeps this one unique
  bucket = "acme-terraform-state-${data.aws_caller_identity.current.account_id}"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256" # S3-managed keys; see the KMS note below
    }
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket = aws_s3_bucket.state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Keep old state versions for 90 days, then let them expire
resource "aws_s3_bucket_lifecycle_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    id     = "expire-old-state-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

output "state_bucket" {
  value = aws_s3_bucket.state.bucket
}
```

New S3 buckets already block public access and encrypt objects with S3-managed keys by default; writing it down makes the intent visible and survives changes to account defaults. Every block in this part passes `terraform validate` with AWS provider 6.70.

### Configure the Backend

In every configuration that should use the bucket:

```hcl
terraform {
  backend "s3" {
    bucket       = "acme-terraform-state-123456789012"
    key          = "webapp/prod/terraform.tfstate"
    region       = "eu-west-1"
    encrypt      = true
    use_lockfile = true
  }
}
```

- **`key`** is the object path of this state. Use one key per environment and component, for example `network/prod/terraform.tfstate`.
- **`use_lockfile = true`** turns on locking. While a run holds the lock, Terraform keeps an object called `<key>.tflock` (here `webapp/prod/terraform.tfstate.tflock`) next to the state. Locking is off by default, so do not forget this line.
- **`encrypt = true`** makes Terraform request server-side encryption for the state and lock objects. Without `kms_key_id`, Terraform asks for S3-managed keys (AES256) on every write, whatever the bucket's default is. To use a KMS key, set `kms_key_id` to its ARN or alias here, and use the same key as the bucket default (`sse_algorithm = "aws:kms"` with `kms_master_key_id`).
- Backend blocks cannot use variables. Put settings that differ per environment in a `.tfbackend` file and pass it with `terraform init -backend-config=...` ([Part 8](/guides/introduction-to-terraform/08-working-with-multiple-environments#h3-per-environment-backend-settings)).
- The backend finds AWS credentials in the same places as the AWS CLI (environment variables, profiles, SSO sessions), and since Terraform 1.15 it also accepts `aws login` sessions. It can assume a role in another account with an `assume_role` block.

The identity that runs Terraform needs these S3 permissions on the state bucket:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::acme-terraform-state-123456789012"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": "arn:aws:s3:::acme-terraform-state-123456789012/webapp/prod/terraform.tfstate"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::acme-terraform-state-123456789012/webapp/prod/terraform.tfstate.tflock"
    }
  ]
}
```

With a KMS key, it also needs `kms:Encrypt`, `kms:Decrypt` and `kms:GenerateDataKey` on that key. Scoping the object permissions to one state key per role is what lets you give the dev pipeline access to dev state only. `s3:ListBucket` only reveals object names, and Terraform needs it to list workspaces.

### Moving From DynamoDB Locking

Older setups lock with a DynamoDB table (`dynamodb_table = "terraform-locks"`). Terraform 1.17 still accepts it but warns on every `init`. This run has no AWS credentials, so it stops at the credentials check right after the warning:

```hcl
terraform {
  backend "s3" {
    bucket         = "acme-terraform-state-123456789012"
    key            = "webapp/prod/terraform.tfstate"
    region         = "eu-west-1"
    dynamodb_table = "terraform-locks"
  }
}
```

```terminal
{
  "title": "the DynamoDB deprecation warning",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform init",
      "output": "Initializing the backend...\n\n╷\n│ Warning: Deprecated Parameter\n│\n│   on backend.tf line 6, in terraform:\n│    6:     dynamodb_table = \"terraform-locks\"\n│\n│ The parameter \"dynamodb_table\" is deprecated. Use parameter \"use_lockfile\"\n│ instead.\n╵\n╷\n│ Error: No valid credential sources found\n│\n│ Please see https://developer.hashicorp.com/terraform/language/backend/s3\n│ for more information about providing credentials.\n│\n│ Error: failed to refresh cached credentials, no EC2 IMDS role found,\n│ operation error ec2imds: GetMetadata, request canceled, context deadline\n│ exceeded\n│\n╵"
    }
  ]
}
```

To switch without a window where nothing is locked:

1. Add `use_lockfile = true` next to `dynamodb_table` and run `terraform init -reconfigure`. Terraform now takes both locks, so old and new configurations still exclude each other.
2. Once every pipeline and teammate uses the new configuration, remove `dynamodb_table` and run `terraform init -reconfigure` again.
3. Delete the DynamoDB table when no configuration refers to it anymore.

## Migrate State Into a Remote Backend

`terraform init` notices when the backend in the code differs from the one the working directory uses, and offers to copy the state. To see the whole flow without a cloud account, this example uses the `pg` backend, which stores state in PostgreSQL. The run used [PGlite](https://pglite.dev/) (PostgreSQL compiled to WebAssembly) listening on `127.0.0.1:54329`; a normal PostgreSQL server, for example `docker run -e POSTGRES_PASSWORD=... -p 5432:5432 postgres:18`, works the same way with a user and password in the connection string.

Start with a project that has local state:

```hcl
resource "random_pet" "app" {
  length = 2
}

output "app_name" {
  value = random_pet.app.id
}
```

```terminal
{
  "title": "a project with local state",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform init"
    },
    {
      "cmd": "terraform apply -auto-approve",
      "output": "\nOutputs:\n\napp_name = \"unbiased-escargot\""
    }
  ]
}
```

Add a backend block. The `pg` backend reads the connection string from `PG_CONN_STR`, which keeps the password out of the code:

```hcl
terraform {
  backend "pg" {}
}
```

```terminal
{
  "title": "terraform init -migrate-state",
  "prompt": "$",
  "steps": [
    {
      "cmd": "export PG_CONN_STR=\"postgres://postgres@127.0.0.1:54329/terraform_state?sslmode=disable\""
    },
    {
      "cmd": "terraform init -migrate-state",
      "output": "Initializing the backend...\nDo you want to copy existing state to the new backend?\n  Pre-existing state was found while migrating the previous \"local\" backend to the\n  newly configured \"pg\" backend. No existing state was found in the newly\n  configured \"pg\" backend. Do you want to copy this state to the new \"pg\"\n  backend? Enter \"yes\" to copy and \"no\" to start with an empty state.\n\n  Enter a value: yes\n\n\nSuccessfully configured the backend \"pg\"! Terraform will automatically\nuse this backend unless the backend configuration changes.\n\nInitializing provider plugins...\n- Reusing version 3.9.1 of hashicorp/random from the dependency lock file\n- Using previously-installed hashicorp/random v3.9.1\n\nTerraform has been successfully initialized!\n\nYou may now begin working with Terraform. Try running \"terraform plan\" to see\nany changes that are required for your infrastructure. All Terraform commands\nshould now work.\n\nIf you ever set or change modules or backend configuration for Terraform,\nrerun this command to reinitialize your working directory. If you forget, other\ncommands will detect it and remind you to do so if necessary."
    },
    {
      "cmd": "terraform state list",
      "output": "random_pet.app"
    },
    {
      "cmd": "terraform output app_name",
      "output": "\"unbiased-escargot\""
    }
  ]
}
```

The state now lives in the database (the backend creates a `terraform_remote_state` schema with a `states` table on first use), and every command reads it from there. Terraform leaves the old `terraform.tfstate` in the directory; delete it once you have checked the migration, so nobody uses it by mistake. In automation, `-force-copy` answers the question with yes.

Workspaces work with remote backends too; with `pg`, each workspace is a row:

```terminal
{
  "title": "workspaces in a remote backend",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform workspace new staging",
      "output": "Created and switched to workspace \"staging\"!\n\nYou're now on a new, empty workspace. Workspaces isolate their state,\nso if you run \"terraform plan\" Terraform will not see any existing state\nfor this configuration."
    },
    {
      "cmd": "terraform workspace list",
      "output": "  default\n* staging"
    }
  ]
}
```

The same command moves state between other backends too, for example from local state to S3 or from S3 to Azure. `terraform init -reconfigure` is the opposite: it switches the backend without copying anything, for when the state is already where you point. Moving to HCP Terraform works differently: after you add the `cloud` block (below), run a plain `terraform init`, which asks whether to migrate the state; it does not accept `-migrate-state`, `-force-copy` or `-reconfigure`.

## Other Backends

| Backend                                             | Locking                                          | Notes                                                                               |
| --------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `s3`                                                | Lock file with `use_lockfile = true`             | Most common; works with S3-compatible storage too                                   |
| `azurerm`                                           | Blob leases, always on                           | Use `use_azuread_auth = true` to authenticate with Entra ID instead of storage keys |
| `gcs`                                               | Built in, always on                              | Turn on object versioning on the bucket                                             |
| `pg`                                                | PostgreSQL advisory locks                        | One schema per configuration; good when you already run Postgres                    |
| `remote` and the `cloud` block                      | Managed by HCP Terraform or Terraform Enterprise | Also runs plans remotely, stores history, enforces policies                         |
| `http`, `consul`, `kubernetes`, `oss`, `cos`, `oci` | Varies                                           | Special cases; check the docs before you choose one                                 |

The Azure and Google Cloud equivalents of the S3 block:

```hcl
terraform {
  backend "azurerm" {
    resource_group_name  = "rg-terraform-state"
    storage_account_name = "acmetfstate"
    container_name       = "tfstate"
    key                  = "webapp/prod.tfstate"
    use_azuread_auth     = true
  }
}
```

```hcl
terraform {
  backend "gcs" {
    bucket = "acme-terraform-state"
    prefix = "webapp/prod"
  }
}
```

For `azurerm`, the identity needs the **Storage Blob Data Contributor** role on the container. For `gcs`, create the bucket with uniform bucket-level access and versioning (`gcloud storage buckets create gs://acme-terraform-state --location=EU --uniform-bucket-level-access`, then `gcloud storage buckets update gs://acme-terraform-state --versioning`).

## HCP Terraform

**HCP Terraform** (called Terraform Cloud until 2024) is HashiCorp's hosted service. Besides state storage and locking, it runs plans and applies on its own workers, keeps a history of every run, manages variables and secrets, has a private module registry, enforces policies (Sentinel or OPA), and runs Stacks ([Part 8](/guides/introduction-to-terraform/08-working-with-multiple-environments#h2-hcp-terraform-projects-and-stacks)). You connect a configuration with a `cloud` block:

```hcl
terraform {
  cloud {
    organization = "acme"

    workspaces {
      project = "webapp"
      name    = "webapp-prod"
    }
  }
}
```

```bash
terraform login   # opens a browser and stores an API token in ~/.terraform.d/credentials.tfrc.json
terraform init    # connects the working directory to the HCP Terraform workspace
```

Pricing is per **managed resource**: each instance of a `resource` block in a state, except `terraform_data` and `null_resource` (data sources do not count either). The free tier covers up to 500 managed resources with one concurrent run, and the old user-based free plan ended on 31 March 2026; organizations on it were moved to the resource-based free tier. Paid tiers (Essentials, Standard, Premium) are billed per managed resource per month; Essentials starts at $0.10. Check the [current pricing](https://www.hashicorp.com/en/pricing?tab=terraform) before you plan around a number, because it has changed several times. Alternatives with similar features include Spacelift, env0, Scalr and the open source Atlantis, which runs plans from pull request comments on your own servers.

## Encrypt State With OpenTofu

S3, Azure and GCS encrypt state at rest, but anyone who can read the object reads the secrets in it. OpenTofu (since 1.7) can encrypt the state **before** it leaves your machine, with a passphrase or a key from AWS KMS, GCP KMS or OpenBao. Terraform has no equivalent. This example uses a passphrase from an environment variable:

```hcl
variable "state_passphrase" {
  type      = string
  sensitive = true
}

terraform {
  encryption {
    key_provider "pbkdf2" "main" {
      passphrase = var.state_passphrase # at least 16 characters
    }

    method "aes_gcm" "main" {
      keys = key_provider.pbkdf2.main
    }

    state {
      method   = method.aes_gcm.main
      enforced = true # refuse to write unencrypted state
    }

    plan {
      method   = method.aes_gcm.main
      enforced = true
    }
  }
}

resource "random_password" "db" {
  length = 20
}
```

```terminal
{
  "title": "encrypted state with OpenTofu 1.13",
  "prompt": "$",
  "steps": [
    {
      "cmd": "export TF_VAR_state_passphrase=\"correct-horse-battery-staple-2026\""
    },
    {
      "cmd": "tofu init"
    },
    {
      "cmd": "tofu apply -auto-approve",
      "output": "Apply complete! Resources: 1 added, 0 changed, 0 destroyed."
    },
    {
      "cmd": "jq 'keys' terraform.tfstate",
      "output": "[\n  \"encrypted_data\",\n  \"encryption_version\",\n  \"lineage\",\n  \"meta\",\n  \"serial\"\n]"
    },
    {
      "cmd": "tofu state list",
      "output": "random_password.db"
    },
    {
      "cmd": "tofu state list -var state_passphrase=a-wrong-passphrase-123",
      "output": "╷\n│ Error: Error refreshing the state\n│\n│ Failed to load state: decryption failed for all provided methods\n│ attempted decryption failed for state: decryption failed: cipher: message\n│ authentication failed\n╵"
    }
  ]
}
```

The file now holds only `encrypted_data` plus the metadata needed to derive the key; the password is unreadable without the passphrase. The passphrase variable can be used in the `encryption` block because OpenTofu evaluates variables early (since 1.8). In production, use a KMS key provider instead of a passphrase, and keep a copy of the key material: encrypted state without the key is lost state. The `encryption` block works with every backend, and the post [OpenTofu in 2026: Should You Switch from Terraform](/posts/opentofu-2026-switch-from-terraform) covers the other differences.

## Team Workflow: Plan in Pull Requests, Apply After Review

With remote state, the safest workflow takes `apply` off laptops entirely:

1. Change the code on a branch and open a pull request.
2. CI runs `fmt -check`, `validate` and `plan`, and shows the plan to reviewers.
3. Reviewers read the plan, not just the code.
4. After merge, CI makes the plan again, saves it, waits for an approval for production, and applies exactly that saved plan.

Here is that workflow for GitHub Actions. It authenticates to AWS with **OpenID Connect**: GitHub issues a short-lived token for each run, and AWS exchanges it for temporary credentials of a role, so no access keys are stored anywhere:

```yaml
# .github/workflows/terraform.yml
name: terraform

on:
  pull_request:
    paths: ['infra/**']
  push:
    branches: [main]
    paths: ['infra/**']

permissions:
  contents: read
  id-token: write # lets the job request an OIDC token

# Runs for main wait for each other; queue: max keeps up to 100 pending runs
# instead of only the newest. Each pull request gets its own group.
concurrency:
  group: terraform-${{ github.event_name == 'push' && 'prod' || github.ref }}
  queue: max

defaults:
  run:
    working-directory: infra/live/prod/app

jobs:
  plan:
    runs-on: ubuntu-24.04
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

      - run: terraform fmt -check -recursive
      - run: terraform init -input=false -lockfile=readonly
      - run: terraform validate
      - run: terraform plan -input=false -lock-timeout=5m -out=tfplan
      - run: terraform show -no-color tfplan > plan.txt

      - uses: actions/upload-artifact@v7
        with:
          name: tfplan
          path: |
            infra/live/prod/app/tfplan
            infra/live/prod/app/plan.txt
          retention-days: 3

  apply:
    needs: plan
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-24.04
    environment: production # required reviewers approve here
    steps:
      - uses: actions/checkout@v7

      - uses: aws-actions/configure-aws-credentials@v6
        with:
          role-to-assume: arn:aws:iam::123456789012:role/terraform-apply
          aws-region: eu-west-1

      - uses: hashicorp/setup-terraform@v4
        with:
          terraform_version: 1.17.0
          terraform_wrapper: false

      - uses: actions/download-artifact@v8
        with:
          name: tfplan
          path: infra/live/prod/app

      - run: terraform init -input=false -lockfile=readonly
      - run: terraform apply -input=false -lock-timeout=5m tfplan
```

Why each piece is there:

- **Two roles.** `terraform-plan` can read everything but change nothing (plus write the lock file); `terraform-apply` can change things, and its trust policy only accepts tokens from the `production` environment of this repository. A malicious pull request can run a plan but never an apply.
- **`-lockfile=readonly`** fails when the lock file does not cover what `init` would install, so CI never upgrades providers silently.
- **The saved plan.** `terraform apply tfplan` applies exactly what was planned, or fails if the state changed in between. The plan file contains secrets, so keep the artifact retention short and the repository private.
- **`concurrency` and `-lock-timeout`** queue runs instead of failing on the state lock. Without `queue: max`, a concurrency group keeps only the newest pending run and cancels the others, so a quick second merge could replace a deployment that was waiting. With it, up to 100 runs wait and start in the order they joined the queue.
- **`environment: production`** with required reviewers in the repository settings is the approval gate.

The IAM side, in Terraform, for the apply role. The plan role is the same with a read-only policy, and its `sub` condition lists the subjects of the runs that plan: `repo:acme/webapp:pull_request` for pull requests and `repo:acme/webapp:ref:refs/heads/main` for pushes to `main` and the scheduled drift check in [Part 10](/guides/introduction-to-terraform/10-best-practices-and-production-patterns#h2-detect-drift):

```hcl
resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

data "aws_iam_policy_document" "github_apply" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # Only the production environment of this repository may assume the role
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:acme/webapp:environment:production"]
    }
  }
}

resource "aws_iam_role" "terraform_apply" {
  name               = "terraform-apply"
  assume_role_policy = data.aws_iam_policy_document.github_apply.json
}
```

The subjects above use the repository name. Repositories created after 15 July 2026 (and older ones that opt in, or that are renamed or transferred after that date) get **immutable subjects** that also contain the owner and repository IDs, such as `repo:acme@123456/webapp@456789:environment:production`. Check which format your repository uses in its OIDC settings, or print the claims of a test run, and put that exact string in the condition.

If you would rather not build this yourself, HCP Terraform, Atlantis and the other services above provide the same flow. Whatever runs it, the rules are the same: plans for every change, applies only from the pipeline, and nobody with standing write access to production state from a laptop.

## Common Mistakes

- **S3 backend without `use_lockfile` (or DynamoDB).** State is shared but not locked, and concurrent applies corrupt it.
- **No versioning on the state bucket.** A bad write or a deleted object is unrecoverable.
- **One bucket policy for everyone.** Dev pipelines should not read production state; scope permissions by key prefix or use separate buckets.
- **Committing `.tfbackend` files with secrets.** Bucket names are fine; access keys and connection strings with passwords are not.
- **Applying from laptops "just this once".** It bypasses review and the approval gate, and the next CI run may undo it.
- **Long-lived cloud keys in CI secrets.** Use OIDC.

## Summary

- Remote backends share state; set them up so they also lock it, encrypt it and keep its history.
- S3 with `use_lockfile = true` is the standard AWS setup; the DynamoDB table is deprecated.
- `terraform init -migrate-state` moves state between backends; `-reconfigure` switches without copying.
- HCP Terraform adds remote runs, policies and Stacks, with a free tier of 500 managed resources.
- OpenTofu can encrypt state client-side; Terraform relies on the backend's encryption.
- Plan in pull requests, apply the saved plan after review, with OIDC credentials.

In [Part 10](/guides/introduction-to-terraform/10-best-practices-and-production-patterns) you put everything together into practices for production.

## Keep Learning

- [How to Fix Common Terraform S3 Backend Configuration Errors](/posts/terraform-s3-backend-configuration-errors)
- [How to Store Terraform Azure State File in a Different Subscription](/posts/terraform-azure-state-file-different-subscription)
- [Terraform State: Remove, Move and Migrate Resources, and Set Up a Remote Backend](/posts/terraform-state-remove-move-migrate-backend)
- [Gate Your Terraform Plans: Rules Decide, the Model Explains](/posts/terraform-plan-gate-digitalocean-inference)
