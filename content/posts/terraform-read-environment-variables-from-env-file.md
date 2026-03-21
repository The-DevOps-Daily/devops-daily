---
title: 'How to Read Environment Variables From a .env File in Terraform'
excerpt: "Learn different approaches for loading environment variables from .env files into Terraform, from shell scripts to external data sources."
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2024-11-08'
publishedAt: '2024-11-08T14:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Infrastructure as Code
  - Environment Variables
  - Configuration
  - DevOps
---

Terraform doesn't have built-in support for reading `.env` files directly. While it can access environment variables through the `TF_VAR_` prefix, you need to load the `.env` file into your environment first using shell tools, or use alternative approaches like reading the file as configuration data.

This guide covers several methods for working with `.env` files in Terraform, from simple shell-based approaches to more sophisticated parsing solutions.

**TLDR:** Terraform cannot directly read `.env` files. The most common approach is to load the `.env` file into environment variables using a shell tool (like `source`, `export`, or `dotenv`), then access them in Terraform with `var.variable_name` after defining variables. Alternatively, read the `.env` file as text and parse it with Terraform functions, or use the `external` data source with a script that reads and outputs the variables as JSON.

## Why Terraform Doesn't Read .env Files Directly

Terraform is designed to be deterministic and explicit about its inputs. Environment files can vary between systems and aren't tracked in version control (nor should they be, since they often contain secrets). Terraform prefers explicit configuration through:

- `.tfvars` files (committed to Git, no secrets)
- Environment variables with the `TF_VAR_` prefix
- Remote state backends for sensitive values
- Secrets management systems like Vault or AWS Secrets Manager

However, in development workflows where you're using `.env` files for local configuration, you'll want to integrate them with Terraform.

## Method 1: Load .env With Shell Commands

The simplest approach is loading the `.env` file into your shell environment before running Terraform:

```bash
# .env file
AWS_REGION=us-east-1
ENVIRONMENT=development
DB_HOST=localhost
DB_PORT=5432
```

Load it into your environment:

```bash
# Load the .env file (bash/zsh)
export $(cat .env | xargs)

# Or use source if your .env uses export statements
source .env

# Then run Terraform
terraform plan
```

Define Terraform variables that read from environment variables:

```hcl
# variables.tf

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "environment" {
  type = string
}

variable "db_host" {
  type = string
}

variable "db_port" {
  type = number
}
```

Set them from environment variables using `TF_VAR_` prefix:

```bash
# Convert .env to TF_VAR_ format
export $(cat .env | sed 's/^/TF_VAR_/' | tr '[:upper:]' '[:lower:]' | xargs)

terraform plan
```

Actually, that's complicated. Better approach:

```bash
# .env with TF_VAR_ prefix from the start
TF_VAR_aws_region=us-east-1
TF_VAR_environment=development
TF_VAR_db_host=localhost
TF_VAR_db_port=5432
```

Then simply:

```bash
source .env
terraform plan
```

Terraform automatically picks up any environment variables starting with `TF_VAR_`.

## Method 2: Using a Wrapper Script

Create a script that loads the `.env` file and runs Terraform:

```bash
#!/bin/bash
# tf-wrapper.sh

set -a  # Automatically export all variables
source .env
set +a  # Stop auto-export

# Run terraform with passed arguments
terraform "$@"
```

Make it executable and use it instead of calling `terraform` directly:

```bash
chmod +x tf-wrapper.sh

./tf-wrapper.sh plan
./tf-wrapper.sh apply
```

For a more robust version that handles comments and validation:

```bash
#!/bin/bash
# tf-wrapper.sh

if [ ! -f .env ]; then
  echo "Error: .env file not found"
  exit 1
fi

# Load .env, ignoring comments and empty lines
set -a
source <(grep -v '^#' .env | grep -v '^$')
set +a

# Validate required variables
REQUIRED_VARS=("TF_VAR_aws_region" "TF_VAR_environment")
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    echo "Error: Required variable $var not set in .env"
    exit 1
  fi
done

terraform "$@"
```

## Method 3: Using direnv for Automatic Loading

`direnv` is a tool that automatically loads environment variables when you enter a directory:

```bash
# Install direnv
# macOS: brew install direnv
# Linux: apt-get install direnv

# Add to your shell profile (~/.bashrc or ~/.zshrc)
eval "$(direnv hook bash)"  # or zsh
```

Create a `.envrc` file:

```bash
# .envrc
dotenv .env
```

Allow direnv to load it:

```bash
direnv allow
```

Now whenever you `cd` into this directory, `.env` is automatically loaded:

```bash
cd /path/to/terraform-project
# direnv: loading .envrc
# direnv: export +TF_VAR_aws_region +TF_VAR_environment

terraform plan  # Variables are already loaded
```

## Method 4: Reading .env as a File

You can read the `.env` file directly in Terraform and parse it:

```hcl
# locals.tf

locals {
  # Read the .env file
  env_file = file("${path.module}/.env")

  # Parse into a map
  env_vars = { for line in split("\n", local.env_file) :
    split("=", line)[0] => split("=", line)[1]
    if length(trim(line)) > 0 && !startswith(trim(line), "#")
  }
}

# Use the values
resource "aws_instance" "app" {
  ami           = var.ami_id
  instance_type = "t3.medium"

  tags = {
    Environment = local.env_vars["ENVIRONMENT"]
    Region      = local.env_vars["AWS_REGION"]
  }
}
```

This approach has limitations:
- Doesn't handle quoted values well
- Can't handle multi-line values
- Doesn't expand variable references

For more robust parsing:

```hcl
locals {
  env_file = file("${path.module}/.env")

  # Parse with better handling of edge cases
  env_vars = {
    for line in compact(split("\n", local.env_file)) :
    trimspace(split("=", line)[0]) => trimspace(join("=", slice(split("=", line), 1, length(split("=", line)))))
    if length(trimspace(line)) > 0 && !startswith(trimspace(line), "#") && length(regexall("=", line)) > 0
  }
}
```

This version:
- Handles values with `=` signs in them
- Trims whitespace
- Skips empty lines and comments
- Uses `compact()` to remove null entries

## Method 5: Using the External Data Source

For complex `.env` files, use an external script to parse and output JSON:

```python
#!/usr/bin/env python3
# scripts/read-env.py

import json
import os
import sys

def load_env(filepath):
    env_vars = {}
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            # Skip empty lines and comments
            if not line or line.startswith('#'):
                continue

            # Handle KEY=VALUE format
            if '=' in line:
                key, value = line.split('=', 1)
                # Remove quotes if present
                value = value.strip('"').strip("'")
                env_vars[key.strip()] = value

    return env_vars

if __name__ == '__main__':
    env_file = '.env'
    if len(sys.argv) > 1:
        env_file = sys.argv[1]

    try:
        env_vars = load_env(env_file)
        print(json.dumps(env_vars))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)
```

Use it in Terraform:

```hcl
data "external" "env" {
  program = ["python3", "${path.module}/scripts/read-env.py"]
}

locals {
  env_vars = data.external.env.result
}

resource "aws_instance" "app" {
  ami           = var.ami_id
  instance_type = "t3.medium"

  tags = {
    Environment = local.env_vars["ENVIRONMENT"]
    DBHost      = local.env_vars["DB_HOST"]
  }
}
```

This approach handles complex `.env` files with proper quote handling and multi-line support.

## Method 6: Converting .env to terraform.tfvars

Another approach is converting your `.env` file to `terraform.tfvars` format:

```bash
#!/bin/bash
# convert-env-to-tfvars.sh

INPUT_FILE=".env"
OUTPUT_FILE="terraform.tfvars"

# Clear the output file
> "${OUTPUT_FILE}"

# Read the .env file
while IFS='=' read -r key value; do
  # Skip empty lines and comments
  [[ -z "$key" || "$key" =~ ^#.*$ ]] && continue

  # Remove TF_VAR_ prefix if present
  key="${key#TF_VAR_}"

  # Convert to lowercase for Terraform variable names
  key=$(echo "$key" | tr '[:upper:]' '[:lower:]')

  # Remove quotes from value
  value=$(echo "$value" | sed 's/^"\(.*\)"$/\1/' | sed "s/^'\(.*\)'$/\1/")

  # Write to tfvars file
  echo "${key} = \"${value}\"" >> "${OUTPUT_FILE}"
done < "${INPUT_FILE}"

echo "Converted ${INPUT_FILE} to ${OUTPUT_FILE}"
```

Run before Terraform:

```bash
./convert-env-to-tfvars.sh
terraform plan
```

Add to `.gitignore`:

```bash
# .gitignore
.env
terraform.tfvars
```

## Handling Different Environments

For multiple environments, use different `.env` files:

```bash
# .env.dev
TF_VAR_environment=development
TF_VAR_aws_region=us-east-1
TF_VAR_instance_type=t3.micro

# .env.staging
TF_VAR_environment=staging
TF_VAR_aws_region=us-west-2
TF_VAR_instance_type=t3.small

# .env.prod
TF_VAR_environment=production
TF_VAR_aws_region=us-east-1
TF_VAR_instance_type=t3.large
```

Load the appropriate file:

```bash
# For development
source .env.dev
terraform plan

# For production
source .env.prod
terraform plan
```

Or use a wrapper script:

```bash
#!/bin/bash
# tf-env.sh

ENVIRONMENT=$1
shift

if [ -z "$ENVIRONMENT" ]; then
  echo "Usage: $0 <environment> <terraform-command>"
  exit 1
fi

ENV_FILE=".env.${ENVIRONMENT}"

if [ ! -f "${ENV_FILE}" ]; then
  echo "Error: ${ENV_FILE} not found"
  exit 1
fi

set -a
source "${ENV_FILE}"
set +a

terraform "$@"
```

Use it like:

```bash
./tf-env.sh dev plan
./tf-env.sh prod apply
```

## Security Considerations

`.env` files often contain sensitive information. Follow these practices:

```bash
# .gitignore - NEVER commit .env files
.env
.env.*
*.tfvars
!*.tfvars.example
```

Create example files for documentation:

```bash
# .env.example
TF_VAR_aws_region=us-east-1
TF_VAR_environment=development
TF_VAR_db_password=CHANGE_ME
TF_VAR_api_key=CHANGE_ME
```

Commit the example but not the actual `.env` file:

```bash
git add .env.example
git add .gitignore
git commit -m "Add environment variable template"
```

For truly sensitive values, use a secrets manager instead of `.env` files:

```hcl
# Read secrets from AWS Secrets Manager instead of .env
data "aws_secretsmanager_secret_version" "db_password" {
  secret_id = "production/database/password"
}

resource "aws_db_instance" "main" {
  password = data.aws_secretsmanager_secret_version.db_password.secret_string
  # ... other configuration
}
```

## Using .env in CI/CD

In CI/CD pipelines, don't use `.env` files. Instead, use the platform's secret management:

```yaml
# GitHub Actions
jobs:
  terraform:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Terraform Plan
        env:
          TF_VAR_aws_region: ${{ secrets.AWS_REGION }}
          TF_VAR_environment: production
          TF_VAR_db_password: ${{ secrets.DB_PASSWORD }}
        run: terraform plan
```

```yaml
# GitLab CI
terraform:
  script:
    - terraform plan
  variables:
    TF_VAR_aws_region: $AWS_REGION
    TF_VAR_environment: production
    TF_VAR_db_password: $DB_PASSWORD
```

The secret values come from your CI/CD platform's secure environment variable storage, not from files.

## Validation and Error Handling

Add validation when reading `.env` files:

```hcl
locals {
  required_env_vars = [
    "AWS_REGION",
    "ENVIRONMENT",
    "DB_HOST"
  ]

  # Check if all required variables exist
  missing_vars = [
    for var in local.required_env_vars :
    var if !contains(keys(local.env_vars), var)
  ]
}

# This will fail the plan if variables are missing
resource "null_resource" "validate_env" {
  count = length(local.missing_vars) > 0 ? 1 : 0

  provisioner "local-exec" {
    command = "echo 'Missing required environment variables: ${join(", ", local.missing_vars)}' && exit 1"
  }
}
```

Actually, use a cleaner validation with `check` blocks (Terraform 1.5+):

```hcl
check "required_env_vars" {
  assert {
    condition     = length(local.missing_vars) == 0
    error_message = "Missing required environment variables: ${join(", ", local.missing_vars)}"
  }
}
```

While Terraform doesn't directly support `.env` files, you have multiple options for integrating them into your workflow. Choose the approach that best fits your use case - simple shell loading for development, external scripts for complex parsing, or preferably, using proper secrets management for production deployments.
