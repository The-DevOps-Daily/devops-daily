---
title: Remote Backends and Team Collaboration
description: Learn how to store Terraform state remotely and work safely with teams using state locking and version control
order: 9
---

**TLDR**: Store state remotely (S3, Azure Blob, GCS, Terraform Cloud) so teams share the same state. Enable state locking to prevent concurrent modifications. Keep sensitive data encrypted. Use version control for configuration files (not state). Implement approval workflows for production changes.

When working alone, local state files work fine. For teams, remote backends are essential for collaboration, security, and reliability.

## Why Remote Backends Matter

Local state creates problems at scale:

**No collaboration**: Team members can't see what infrastructure exists or what changes others are making.

**Easy to lose**: If someone's laptop fails, the state file is gone. Recreating it is painful and error-prone.

**No locking**: Two people running `terraform apply` simultaneously corrupt state.

**Hard to secure**: State files contain sensitive data. Keeping them secure on individual laptops is difficult.

**No history**: You can't see what changed when or roll back to a previous state.

Remote backends solve these problems by storing state centrally with locking, encryption, and versioning.

## S3 Backend (AWS)

The most common remote backend uses AWS S3 for storage and DynamoDB for locking.

### Setting Up S3 Backend

Create an S3 bucket for state:

```bash
aws s3api create-bucket \
  --bucket mycompany-terraform-state \
  --region us-east-1

# Enable versioning for state history
aws s3api put-bucket-versioning \
  --bucket mycompany-terraform-state \
  --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket mycompany-terraform-state \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# Block public access
aws s3api put-public-access-block \
  --bucket mycompany-terraform-state \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

Create a DynamoDB table for locking:

```bash
aws dynamodb create-table \
  --table-name terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

Configure the backend in your Terraform code:

```hcl
# backend.tf
terraform {
  backend "s3" {
    bucket         = "mycompany-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}
```

> **Tip:** Starting in Terraform 1.10, the S3 backend supports native S3 state locking with `use_lockfile = true` (using S3 conditional writes to create a `.tflock` file alongside your state). On Terraform 1.10+, you can set `use_lockfile = true` instead of `dynamodb_table` to get state locking without provisioning and maintaining a separate DynamoDB table.

Initialize to migrate existing local state:

```bash
terraform init

# Terraform asks if you want to copy existing state to S3
# Type 'yes' to migrate
```

Your state is now stored remotely. Team members can access it by configuring the same backend.

### S3 Backend with Different Environments

Use different state files for each environment:

```hcl
# environments/dev/backend.tf
terraform {
  backend "s3" {
    bucket         = "mycompany-terraform-state"
    key            = "dev/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}
```

```hcl
# environments/prod/backend.tf
terraform {
  backend "s3" {
    bucket         = "mycompany-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}
```

This keeps environment states separate while using the same bucket.

### State Locking with DynamoDB

When someone runs `terraform apply`, Terraform acquires a lock in DynamoDB. Other operations wait until the lock releases.

```
Developer A                DynamoDB Lock Table          Developer B
    │                            │                          │
    │ terraform apply            │                          │
    ├───────────────────────────>│                          │
    │ Lock acquired              │                          │
    │<───────────────────────────┤                          │
    │ Making changes...          │  terraform apply         │
    │                            │<─────────────────────────┤
    │                            │ Lock held by A           │
    │                            ├─────────────────────────>│
    │                            │ Waiting for lock...      │
    │ Changes complete           │                          │
    ├───────────────────────────>│                          │
    │ Lock released              │                          │
    │                            ├─────────────────────────>│
    │                            │ Lock acquired            │
    │                            │<─────────────────────────┤
    │                            │ Making changes...        │
```

If Terraform crashes, the lock might not release. Force unlock:

```bash
terraform force-unlock LOCK_ID
```

Get `LOCK_ID` from the error message. Only do this if you're certain no one else is running Terraform.

## Azure Backend

For Azure-based infrastructure, use Azure Blob Storage:

```bash
# Create resource group
az group create --name terraform-state-rg --location eastus

# Create storage account
az storage account create \
  --name mycompanytfstate \
  --resource-group terraform-state-rg \
  --location eastus \
  --sku Standard_LRS \
  --encryption-services blob

# Create container
az storage container create \
  --name tfstate \
  --account-name mycompanytfstate
```

Configure the backend:

```hcl
terraform {
  backend "azurerm" {
    resource_group_name  = "terraform-state-rg"
    storage_account_name = "mycompanytfstate"
    container_name       = "tfstate"
    key                  = "prod.terraform.tfstate"
  }
}
```

Azure automatically handles locking through blob leases.

## Google Cloud Backend

For GCP:

```bash
# Create bucket
gsutil mb gs://mycompany-terraform-state

# Enable versioning
gsutil versioning set on gs://mycompany-terraform-state
```

Configure the backend:

```hcl
terraform {
  backend "gcs" {
    bucket = "mycompany-terraform-state"
    prefix = "prod"
  }
}
```

GCS automatically provides locking.

## Terraform Cloud

Terraform Cloud (formerly Terraform Enterprise) is HashiCorp's managed service. It provides remote state, locking, a web UI, and CI/CD integration.

### Setting Up Terraform Cloud

Create an account at [app.terraform.io](https://app.terraform.io).

Create an organization and workspace through the web UI.

Generate an API token:

```bash
terraform login
```

This creates `~/.terraform.d/credentials.tfrc.json` with your token.

Configure the backend:

```hcl
terraform {
  cloud {
    organization = "mycompany"

    workspaces {
      name = "production"
    }
  }
}
```

Initialize and migrate state:

```bash
terraform init
```

Terraform Cloud provides:

- Web UI for viewing resources and state
- Remote execution (runs in Terraform Cloud, not locally)
- Policy as code with Sentinel
- Cost estimation
- Private module registry
- Team access controls
- Run history and audit logs

For teams, Terraform Cloud simplifies collaboration significantly.

## Version Control Best Practices

Store Terraform configuration in Git, but never commit state files or credentials.

### .gitignore

Always use a proper `.gitignore`:

```gitignore
# Local state files
*.tfstate
*.tfstate.*

# Crash log files
crash.log
crash.*.log

# Exclude override files
override.tf
override.tf.json
*_override.tf
*_override.tf.json

# CLI configuration
.terraformrc
terraform.rc

# Variable files with secrets
*.tfvars
!example.tfvars

# Lock file (some teams commit this, others don't)
# .terraform.lock.hcl

# Terraform cache
.terraform/
.terraform.lock.info
```

### What to Commit

Commit:

- `*.tf` configuration files
- `*.tfvars.example` with example variables
- `README.md` documentation
- Module code
- Scripts for automation

Don't commit:

- `*.tfstate` state files
- `*.tfvars` files with real values
- Credentials or API keys
- `.terraform/` directory

### Example Variables File

Provide an example showing what variables are needed:

```hcl
# terraform.tfvars.example
aws_region         = "us-east-1"
environment        = "production"
instance_type      = "t3.large"
database_password  = "CHANGE_ME"
allowed_ssh_cidrs  = ["YOUR_IP/32"]
```

Team members copy this to `terraform.tfvars` and fill in real values (which aren't committed).

## Team Workflow

Establish a workflow for safe collaboration:

### Pull Request Workflow

1. **Create a branch** for infrastructure changes
2. **Make changes** to Terraform configuration
3. **Run `terraform plan`** and save the output
4. **Create a pull request** with the plan output
5. **Team reviews** the changes
6. **Merge** after approval
7. **Apply** the changes in the main branch

Automate this with CI/CD:

```yaml
# .github/workflows/terraform.yml
name: Terraform

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  terraform:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v2
        with:
          terraform_version: 1.6.5

      - name: Terraform Init
        run: terraform init
        working-directory: environments/prod

      - name: Terraform Format
        run: terraform fmt -check
        working-directory: environments/prod

      - name: Terraform Validate
        run: terraform validate
        working-directory: environments/prod

      - name: Terraform Plan
        if: github.event_name == 'pull_request'
        run: terraform plan -no-color
        working-directory: environments/prod
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}

      - name: Terraform Apply
        if: github.ref == 'refs/heads/main' && github.event_name == 'push'
        run: terraform apply -auto-approve
        working-directory: environments/prod
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

This workflow:

- Runs `plan` on pull requests (preview changes)
- Runs `apply` when merging to main (apply changes)
- Makes infrastructure changes visible in pull requests
- Requires approval before changes happen

### State Locking Best Practices

**Never force-unlock unless necessary**. Check with the team first.

**Keep applies short**. Long-running applies hold locks longer.

**Use workspaces or separate directories** for environments to avoid lock contention.

**Monitor for stuck locks**. If someone's laptop dies mid-apply, manually unlock.

## Access Control

Control who can modify infrastructure:

### AWS IAM Policies

Create an IAM policy for Terraform:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::mycompany-terraform-state"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::mycompany-terraform-state/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:DeleteItem"
      ],
      "Resource": "arn:aws:dynamodb:us-east-1:*:table/terraform-locks"
    }
  ]
}
```

Attach this to IAM users or roles that run Terraform.

For production, use separate IAM roles with stricter permissions and require MFA.

### Terraform Cloud Teams

Terraform Cloud provides team-based access control:

- **Read**: View runs and state
- **Plan**: Run plans but not applies
- **Write**: Run plans and applies
- **Admin**: Manage workspace settings

Assign team members appropriate permissions based on their role.

## Migrating State Between Backends

Moving from one backend to another is straightforward:

```hcl
# Change backend configuration
terraform {
  backend "s3" {
    bucket = "new-bucket"
    key    = "terraform.tfstate"
    region = "us-east-1"
  }
}
```

Run init to migrate:

```bash
terraform init -migrate-state
```

Terraform copies state to the new backend. Verify the migration:

```bash
terraform plan
```

If the plan shows no changes, migration succeeded.

## Handling Sensitive Data

State files contain sensitive information. Protect them:

**Encrypt state at rest**: Use S3 encryption, Azure encryption, or Terraform Cloud (encrypted by default).

**Encrypt state in transit**: Use HTTPS for S3/Azure/GCS access.

**Restrict access**: Use IAM policies to limit who can read state.

**Use sensitive variables**: Mark secrets as sensitive so they don't appear in logs:

```hcl
variable "database_password" {
  type      = string
  sensitive = true
}
```

**Consider external secret management**: Store secrets in AWS Secrets Manager, Vault, or similar:

```hcl
data "aws_secretsmanager_secret_version" "db_password" {
  secret_id = "prod/database/password"
}

resource "aws_db_instance" "main" {
  password = data.aws_secretsmanager_secret_version.db_password.secret_string
  # ...
}
```

## Practical Example: Complete Remote Backend Setup

Here's a full example with S3 backend and team workflow:

```hcl
# bootstrap/main.tf - Run this once to create the backend
terraform {
  required_version = "~> 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

resource "aws_s3_bucket" "terraform_state" {
  bucket = "mycompany-terraform-state"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_dynamodb_table" "terraform_locks" {
  name         = "terraform-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }
}

output "s3_bucket_name" {
  value = aws_s3_bucket.terraform_state.id
}

output "dynamodb_table_name" {
  value = aws_dynamodb_table.terraform_locks.name
}
```

After creating the backend infrastructure, configure it in your main Terraform code:

```hcl
# environments/prod/backend.tf
terraform {
  backend "s3" {
    bucket         = "mycompany-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}
```

Remote backends and proper team workflows are what make Terraform viable for production use. Next, we'll cover best practices and patterns for maintaining large-scale Terraform projects.
