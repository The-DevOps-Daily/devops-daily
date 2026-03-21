---
title: 'How to Run Terraform Init From a Different Directory'
excerpt: "Learn how to initialize and manage Terraform configurations from outside their directory using -chdir, working directories, and automation patterns."
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2025-02-25'
publishedAt: '2025-02-25T10:15:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Infrastructure as Code
  - CLI
  - Automation
  - DevOps
---

By default, Terraform operates on the configuration in your current directory. But sometimes you need to run Terraform commands against configurations in other directories - like managing multiple environments from a central location, running Terraform in CI/CD pipelines, or automating multi-project deployments.

Terraform provides the `-chdir` flag specifically for this purpose, though there are other approaches depending on your use case.

**TLDR:** Use `terraform -chdir=/path/to/config init` to run Terraform against a configuration in a different directory. The `-chdir` flag must come before the subcommand (init, plan, apply). Alternatively, use shell commands like `cd /path && terraform init` for simple cases, or `terraform -chdir=path plan -out=path/tfplan` to save output files in the target directory. The `-chdir` flag is the recommended modern approach over older methods.

## Using the -chdir Flag

The `-chdir` flag changes Terraform's working directory before executing the command:

```bash
# Initialize Terraform in another directory
terraform -chdir=./environments/production init
```

This is equivalent to:

```bash
cd ./environments/production
terraform init
```

But with `-chdir`, your shell's working directory doesn't change, which can be useful in scripts.

The flag must come before the subcommand:

```bash
# Correct
terraform -chdir=./prod init
terraform -chdir=./prod plan
terraform -chdir=./prod apply

# Incorrect - won't work
terraform init -chdir=./prod
```

## Running Multiple Commands

When running multiple Terraform commands, specify `-chdir` for each one:

```bash
# Initialize, plan, and apply
terraform -chdir=./environments/staging init
terraform -chdir=./environments/staging plan -out=tfplan
terraform -chdir=./environments/staging apply tfplan
```

Or create a shell function to reduce repetition:

```bash
# Add to your shell profile
tf() {
  local dir=$1
  shift
  terraform -chdir="$dir" "$@"
}

# Use it
tf ./environments/staging init
tf ./environments/staging plan
tf ./environments/staging apply
```

## Absolute vs Relative Paths

You can use both absolute and relative paths:

```bash
# Relative path (from current directory)
terraform -chdir=./terraform/prod init

# Absolute path
terraform -chdir=/home/user/infrastructure/terraform/prod init

# Using environment variable
export TF_DIR="/home/user/infrastructure/terraform/prod"
terraform -chdir="${TF_DIR}" init
```

Relative paths are resolved from your current working directory, not from where the `terraform` binary is located.

## Managing Multiple Environments

For projects with multiple environments, use `-chdir` to operate on each:

```
infrastructure/
├── environments/
│   ├── dev/
│   │   ├── main.tf
│   │   └── terraform.tfvars
│   ├── staging/
│   │   ├── main.tf
│   │   └── terraform.tfvars
│   └── prod/
│       ├── main.tf
│       └── terraform.tfvars
└── modules/
    └── vpc/
        └── main.tf
```

Initialize all environments from the root:

```bash
#!/bin/bash
# init-all-envs.sh

for env in dev staging prod; do
  echo "Initializing $env environment..."
  terraform -chdir="environments/$env" init
done
```

Plan all environments:

```bash
#!/bin/bash
# plan-all-envs.sh

for env in dev staging prod; do
  echo "Planning $env environment..."
  terraform -chdir="environments/$env" plan -out="tfplan-$env"
done
```

## File Paths and -chdir

When using `-chdir`, file paths in the output are relative to the target directory:

```bash
terraform -chdir=./environments/prod plan -out=tfplan
```

The `tfplan` file is created in `./environments/prod/tfplan`, not in your current directory.

To save files in your current directory, use absolute paths or path references:

```bash
# Save plan in current directory
terraform -chdir=./environments/prod plan -out="$(pwd)/prod-tfplan"
```

Or use relative paths from the target directory:

```bash
# Save plan one level up
terraform -chdir=./environments/prod plan -out=../prod-tfplan
```

## Using cd vs -chdir in Scripts

Both approaches work, but have different characteristics:

**Using cd:**

```bash
#!/bin/bash
# Approach 1: Using cd

cd /path/to/terraform/config || exit 1
terraform init
terraform plan
terraform apply
```

Pros:
- Simple and familiar
- All subsequent commands operate in the target directory
- Easier to read for simple scripts

Cons:
- Changes your script's working directory
- Need error handling (`|| exit`) if directory doesn't exist
- Can cause issues if script continues after Terraform commands

**Using -chdir:**

```bash
#!/bin/bash
# Approach 2: Using -chdir

terraform -chdir=/path/to/terraform/config init
terraform -chdir=/path/to/terraform/config plan
terraform -chdir=/path/to/terraform/config apply
```

Pros:
- Doesn't change the script's working directory
- More explicit about which directory is targeted
- Safer in complex scripts

Cons:
- More verbose
- Need to repeat the flag for each command

**Best of both worlds:**

```bash
#!/bin/bash
# Approach 3: Subshell with cd

(
  cd /path/to/terraform/config || exit 1
  terraform init
  terraform plan
  terraform apply
)

# Script continues here in the original directory
echo "Deployment complete"
```

The subshell `()` isolates the `cd` command, so when it exits, you're back in your original directory.

## CI/CD Pipeline Patterns

In CI/CD, you often need to run Terraform from different directories:

```yaml
# GitHub Actions
name: Terraform
on:
  push:
    branches: [main]

jobs:
  terraform-prod:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v2

      - name: Terraform Init
        run: terraform -chdir=environments/prod init

      - name: Terraform Plan
        run: terraform -chdir=environments/prod plan

      - name: Terraform Apply
        run: terraform -chdir=environments/prod apply -auto-approve
```

For multiple environments:

```yaml
jobs:
  terraform:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        environment: [dev, staging, prod]
    steps:
      - uses: actions/checkout@v3

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v2

      - name: Terraform Init
        run: terraform -chdir=environments/${{ matrix.environment }} init

      - name: Terraform Plan
        run: terraform -chdir=environments/${{ matrix.environment }} plan
```

## Working With Modules

When your configuration uses local modules, `-chdir` affects how module paths are resolved:

```hcl
# environments/prod/main.tf

module "vpc" {
  source = "../../modules/vpc"  # Relative to this file's location

  cidr_block = "10.0.0.0/16"
}
```

Running from the root directory:

```bash
terraform -chdir=environments/prod init
```

Terraform resolves the module path `../../modules/vpc` relative to `environments/prod`, which correctly points to `modules/vpc`.

## Handling Backend Configuration

Backend configuration files are also resolved relative to the target directory:

```bash
# Backend config in the target directory
terraform -chdir=./environments/prod init -backend-config=backend.hcl
```

This looks for `./environments/prod/backend.hcl`.

To use a backend config from your current directory:

```bash
# Backend config in current directory
terraform -chdir=./environments/prod init -backend-config="$(pwd)/backend.hcl"
```

Or with a relative path from the target:

```bash
# Backend config one level up
terraform -chdir=./environments/prod init -backend-config=../backend.hcl
```

## Automating Multi-Directory Operations

Here's a script that initializes and plans multiple Terraform directories:

```bash
#!/bin/bash
# terraform-multi-init.sh

set -e

TERRAFORM_DIRS=(
  "infrastructure/networking"
  "infrastructure/compute"
  "infrastructure/database"
  "infrastructure/monitoring"
)

for dir in "${TERRAFORM_DIRS[@]}"; do
  echo "========================================="
  echo "Processing: $dir"
  echo "========================================="

  if [ ! -d "$dir" ]; then
    echo "Warning: Directory $dir does not exist, skipping..."
    continue
  fi

  echo "Running terraform init..."
  terraform -chdir="$dir" init

  echo "Running terraform validate..."
  terraform -chdir="$dir" validate

  echo "Running terraform plan..."
  terraform -chdir="$dir" plan -out="tfplan"

  echo ""
done

echo "All directories processed successfully!"
```

Make it executable and run:

```bash
chmod +x terraform-multi-init.sh
./terraform-multi-init.sh
```

## Using -chdir With Terraform Workspaces

When working with Terraform workspaces:

```bash
# Initialize in a specific directory
terraform -chdir=./infrastructure init

# List workspaces in that directory
terraform -chdir=./infrastructure workspace list

# Select a workspace
terraform -chdir=./infrastructure workspace select production

# Run plan for that workspace
terraform -chdir=./infrastructure plan
```

The workspace is scoped to the configuration directory, so `-chdir` must be consistent across commands.

## Debugging Path Issues

If you encounter path-related errors, verify what Terraform sees:

```bash
# Show the current working directory from Terraform's perspective
terraform -chdir=./environments/prod version

# Show detailed output including paths
terraform -chdir=./environments/prod init -upgrade
```

Add debugging to your scripts:

```bash
#!/bin/bash

TARGET_DIR="./environments/prod"

echo "Current directory: $(pwd)"
echo "Target directory: $TARGET_DIR"
echo "Resolved path: $(cd "$TARGET_DIR" && pwd)"

terraform -chdir="$TARGET_DIR" init
```

## Alternative: Using -c Flag (Older Versions)

In very old Terraform versions (pre-0.14), there was no `-chdir` flag. The workaround was always using `cd`:

```bash
# Old approach (before Terraform 0.14)
(cd /path/to/config && terraform init)
```

If you're on Terraform 0.14 or later (you should be), always use `-chdir` instead.

## Environment Variables and -chdir

Environment variables like `TF_DATA_DIR` are still relative to the target directory:

```bash
# .terraform directory will be created inside target dir
terraform -chdir=./environments/prod init

# Override the data directory location
TF_DATA_DIR="$(pwd)/.terraform-prod" \
  terraform -chdir=./environments/prod init
```

This creates the `.terraform` directory in your current directory rather than the target.

## Using Make for Multi-Directory Management

For complex setups, use Make to manage Terraform commands:

```makefile
# Makefile

.PHONY: init-all plan-all apply-all

ENVS := dev staging prod

init-all:
	@for env in $(ENVS); do \
		echo "Initializing $$env..."; \
		terraform -chdir=environments/$$env init; \
	done

plan-all:
	@for env in $(ENVS); do \
		echo "Planning $$env..."; \
		terraform -chdir=environments/$$env plan -out=tfplan; \
	done

apply-all:
	@for env in $(ENVS); do \
		echo "Applying $$env..."; \
		terraform -chdir=environments/$$env apply tfplan; \
	done

# Target specific environment
init-%:
	terraform -chdir=environments/$* init

plan-%:
	terraform -chdir=environments/$* plan

apply-%:
	terraform -chdir=environments/$* apply
```

Use it:

```bash
# Initialize all environments
make init-all

# Plan specific environment
make plan-prod

# Apply specific environment
make apply-staging
```

The `-chdir` flag is the cleanest way to run Terraform commands against configurations in other directories. It keeps your scripts simple and explicit about which configuration is being operated on, without changing your shell's working directory or creating complex path resolution logic.
