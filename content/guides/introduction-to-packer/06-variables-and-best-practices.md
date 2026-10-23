---
title: 'Packer Variables, Var Files and Best Practices'
description: 'Use Packer variables, locals, .pkrvars.hcl and auto var files, PKR_VAR_ environment variables and sensitive values, then test and build images in CI.'
order: 6
---

**TLDR**: Declare inputs with `variable` blocks and compute derived values in `locals`. Set values with `PKR_VAR_<name>` environment variables, `*.auto.pkrvars.hcl` files (loaded automatically), `-var-file` and `-var`, in that order of increasing priority. Every variable you set must be declared, and every variable you use must have a value. Mark secrets `sensitive`, keep templates split into files in one directory, check them with `packer fmt -check` and `packer validate` on every change, and build in CI with short-lived credentials.

Variables let you write a template once and use it for different regions, environments, versions or clouds. This part covers variables in depth, with real output for the errors you are most likely to hit, and then the practices that keep an image pipeline maintainable: project layout, testing, versioning, CI/CD and security.

## Prerequisites

- A working template ([Part 3](/guides/introduction-to-packer/03-writing-your-first-template)).
- For the CI/CD section, a GitHub or GitLab repository and an AWS role you can assume from CI.

## Defining Variables

Declare each input in a `variable` block. By convention, variables go in a `variables.pkr.hcl` file next to the template:

```hcl
variable "region" {
  type        = string
  default     = "us-east-1"
  description = "AWS region to build in"
}

variable "app_version" {
  type        = string
  description = "Application version baked into the image"
  # No default: the value must be provided for every build

  validation {
    condition     = can(regex("^[0-9]+\\.[0-9]+\\.[0-9]+$", var.app_version))
    error_message = "The app_version must be a semantic version such as 1.4.0."
  }
}

variable "instance_type" {
  type    = string
  default = "t3.micro"
}

variable "enable_monitoring" {
  type    = bool
  default = true
}

variable "extra_packages" {
  type    = list(string)
  default = ["curl", "jq"]
}

variable "tags" {
  type = map(string)
  default = {
    Team      = "platform"
    ManagedBy = "packer"
  }
}

variable "api_token" {
  type      = string
  sensitive = true
  default   = ""
}
```

To try these variables without a cloud account, put this `build.pkr.hcl` in the same directory. It uses the built-in `null` builder and only prints three of the values. Most local runs in this part use this directory:

```hcl
source "null" "app" {
  communicator = "none"
}

build {
  sources = ["source.null.app"]

  provisioner "shell-local" {
    inline = ["echo app_version=${var.app_version} region=${var.region} token=${var.api_token}"]
  }
}
```

The supported types are `string`, `number`, `bool`, `list(...)`, `set(...)`, `map(...)`, `object({...})` and `tuple([...])`. Since Packer 1.16, object attributes can be marked `optional()`, optionally with a default, so callers can leave them out:

```hcl
variable "disk" {
  type = object({
    size_gb = number
    type    = optional(string, "gp3")
  })
  default = { size_gb = 20 }
}
```

```terminal
{
  "title": "an optional() attribute with a default",
  "prompt": "$",
  "steps": [
    {
      "cmd": "echo 'var.disk' | packer console -var app_version=1.4.0 .",
      "output": "{\n  \"size_gb\" = 20\n  \"type\" = \"gp3\"\n}"
    }
  ]
}
```

## Using Variables

Reference a variable as `var.<name>`, on its own or inside a string:

```hcl
source "amazon-ebs" "app" {
  region        = var.region
  instance_type = var.instance_type
  ami_name      = "app-${var.app_version}-${local.timestamp}"
  tags          = var.tags
}

build {
  sources = ["source.amazon-ebs.app"]

  provisioner "shell" {
    environment_vars = [
      "APP_VERSION=${var.app_version}",
      "MONITORING=${var.enable_monitoring}",
    ]
    inline = ["sudo apt-get install -y ${join(" ", var.extra_packages)}"]
  }
}
```

Two limits to know: a variable's `default` cannot refer to other variables (use a local for derived values), and the `packer` block, including `required_plugins`, cannot use variables at all.

## Providing Variable Values

You can set a variable in five ways. When the same variable is set in several places, the later source in this list wins:

1. the `default` in the `variable` block;
2. an environment variable named `PKR_VAR_<name>`, such as `PKR_VAR_region`;
3. any `*.auto.pkrvars.hcl` (or `*.auto.pkrvars.json`) files in the directory, in alphabetical order of their names;
4. each `-var-file=<file>` on the command line, in the order you give them (a later file wins);
5. each `-var name=value` on the command line, which beats every var file, wherever it appears on the command line.

Here is the order in action, in a new directory with a single `region` variable (default `us-east-1`), a `null` build like the one above, and a `prod.pkrvars.hcl` file that sets `region = "eu-central-1"`. `packer console` prints the value of an expression without building anything:

```terminal
{
  "title": "which value wins",
  "prompt": "$",
  "steps": [
    {
      "cmd": "echo 'var.region' | packer console .",
      "output": "us-east-1"
    },
    {
      "cmd": "echo 'var.region' | PKR_VAR_region=us-west-2 packer console .",
      "output": "us-west-2"
    },
    {
      "comment": "an auto var file beats the environment variable",
      "cmd": "echo 'region = \"eu-west-1\"' > defaults.auto.pkrvars.hcl"
    },
    {
      "cmd": "echo 'var.region' | PKR_VAR_region=us-west-2 packer console .",
      "output": "eu-west-1"
    },
    {
      "comment": "-var-file and -var beat both",
      "cmd": "echo 'var.region' | packer console -var-file=prod.pkrvars.hcl .",
      "output": "eu-central-1"
    },
    {
      "cmd": "echo 'var.region' | packer console -var-file=prod.pkrvars.hcl -var region=ap-southeast-2 .",
      "output": "ap-southeast-2"
    },
    {
      "comment": "-var wins even when it comes before -var-file",
      "cmd": "echo 'var.region' | packer console -var region=ap-southeast-2 -var-file=prod.pkrvars.hcl .",
      "output": "ap-southeast-2"
    }
  ]
}
```

### Variable Files

A variable file (`.pkrvars.hcl`) contains only assignments, no blocks:

```hcl
region        = "us-east-1"
app_version   = "2.0.0"
instance_type = "t3.small"

tags = {
  Team        = "platform"
  ManagedBy   = "packer"
  Environment = "production"
}
```

Pass one or more of them with `-var-file`; later files override earlier ones, so a common pattern is a shared file plus one per environment:

```bash
packer build -var-file=common.pkrvars.hcl -var-file=production.pkrvars.hcl .
```

### The Default Variable File: `*.auto.pkrvars.hcl`

Unlike Terraform's `terraform.tfvars`, Packer has no single default variable file name. Instead, it loads **every file whose name ends in `.auto.pkrvars.hcl`** (or `.auto.pkrvars.json`) in the template directory automatically, without a flag. Use them for values everybody on the team shares, or for personal overrides that you keep out of Git. Because they load silently, they can surprise people; when a value is not what you expect, check for an auto file first.

### Every Value Needs a Declaration

Packer warns when a variable file sets a name that no `variable` block declares, which usually means a typo:

```terminal
{
  "title": "a typo in a var file",
  "prompt": "$",
  "steps": [
    {
      "cmd": "packer validate -var-file=typo.pkrvars.hcl .",
      "output": "Warning: Undefined variable\n\nThe variable \"regoin\" was set but was not declared as an input variable.\nTo declare variable \"regoin\" place this block in one of your .pkr.hcl files,\nsuch as variables.pkr.hcl\n\nvariable \"regoin\" {\n  type    = string\n  default = null\n}\n\n\nThe configuration is valid."
    }
  ]
}
```

The template is still valid, and `region` keeps its old value. A `-var` on the command line for an undeclared name is an error, not a warning.

## The "Unset Variable" Error

A variable without a default must get a value from one of the sources above. If it does not, `packer validate` and `packer build` fail with an error that names the variable:

```terminal
{
  "title": "a required variable without a value",
  "prompt": "$",
  "steps": [
    {
      "cmd": "packer validate .",
      "output": "Error: Unset variable \"app_version\"\n\nA used variable must be set or have a default value; see\nhttps://packer.io/docs/templates/hcl_templates/syntax for details."
    },
    {
      "cmd": "packer validate -var app_version=1.4.0 .",
      "output": "The configuration is valid."
    }
  ]
}
```

To fix it, pass the value (`-var`, a var file or `PKR_VAR_app_version`), or give the variable a `default` if it is not required.

## Splitting a Template Into Files

Packer treats all `.pkr.hcl` files in a directory as one configuration. A common layout is `variables.pkr.hcl`, `sources.pkr.hcl` and `build.pkr.hcl`. Always run Packer on the **directory**. If you pass a single file, Packer reads only that file and does not see the variables declared in the others:

```terminal
{
  "title": "a file versus the whole directory",
  "prompt": "$",
  "steps": [
    {
      "cmd": "packer validate -var app_version=1.4.0 build.pkr.hcl",
      "output": "Error: Undefined -var variable\n\nA \"app_version\" variable was passed in the command line but was not found in\nknown variables. To declare variable \"app_version\", place this block in one of\nyour .pkr files, such as variables.pkr.hcl"
    },
    {
      "cmd": "packer validate -var app_version=1.4.0 .",
      "output": "The configuration is valid."
    }
  ]
}
```

## Validation Rules

A `validation` block rejects bad values before a build starts. The condition must be true for valid values, and `can()` turns an error (such as a regular expression that does not match) into `false`:

```terminal
{
  "title": "a value that fails validation",
  "prompt": "$",
  "steps": [
    {
      "cmd": "packer validate -var app_version=latest .",
      "output": "Error: Invalid value for cmd variable\n\n  on  line 0:\n  (source code not available)\n\nThe app_version must be a semantic version such as 1.4.0.\n\nThis was checked by the validation rule at variables.pkr.hcl:12,3-13."
    }
  ]
}
```

Validate everything that ends up in names and tags: AWS, Azure and Google Cloud each have their own rules for image names, and it is better to fail in a second than after a ten-minute build.

## Sensitive Variables

Mark secrets with `sensitive = true`. Packer then replaces their value with `<sensitive>` everywhere in its output:

```terminal
{
  "title": "a sensitive value in the build output",
  "prompt": "$",
  "steps": [
    {
      "cmd": "packer build -var app_version=1.4.0 -var api_token=s3cr3t-value .",
      "output": "null.app: output will be in this color.\n\n==> null.app: Running local shell script: /tmp/packer-shell170191755\n==> null.app: app_version=1.4.0 region=us-east-1 token=<sensitive>\nBuild 'null.app' finished after 21 milliseconds 330 microseconds.\n\n==> Wait completed after 21 milliseconds 633 microseconds\n\n==> Builds finished. The artifacts of successful builds are:\n--> null.app: Did not export anything. This is the null builder"
    },
    {
      "cmd": "packer inspect -var app_version=1.4.0 -var api_token=s3cr3t-value . | head -12",
      "output": "Packer Inspect: HCL2 mode\n\n> input-variables:\n\nvar.api_token: \"<sensitive>\"\nvar.app_version: \"1.4.0\"\nvar.disk: \"{\\n  \\\"size_gb\\\" = 20\\n  \\\"type\\\" = \\\"gp3\\\"\\n}\"\nvar.enable_monitoring: \"true\"\nvar.extra_packages: \"[\\n  \\\"curl\\\",\\n  \\\"jq\\\",\\n]\"\nvar.instance_type: \"t3.micro\"\nvar.region: \"us-east-1\"\nvar.tags: \"{\\n  \\\"ManagedBy\\\" = \\\"packer\\\"\\n  \\\"Team\\\" = \\\"platform\\\"\\n}\""
    }
  ]
}
```

`sensitive` only hides the value in Packer's output. It does not encrypt anything, and if a provisioner writes the value to a file, it is in the image. Commands on the build machine can print it too, for example with `set -x`.

## Locals

**Locals** are values computed from variables, functions and other locals. They keep long expressions out of your sources:

```hcl
variable "app_name" {
  type    = string
  default = "web"
}

variable "app_version" {
  type    = string
  default = "1.4.0"
}

variable "git_commit" {
  type    = string
  default = "unknown"
}

locals {
  build_time = formatdate("YYYYMMDD-hhmm", timestamp())
  image_name = "${var.app_name}-${replace(var.app_version, ".", "-")}-${local.build_time}"

  common_tags = {
    Application = var.app_name
    Version     = var.app_version
    GitCommit   = var.git_commit
    BuildTime   = local.build_time
  }
}
```

`packer console` is the quickest way to check an expression before you put it in a template:

```terminal
{
  "title": "test expressions with packer console",
  "prompt": "$",
  "steps": [
    {
      "cmd": "echo 'local.image_name' | packer console .",
      "output": "web-1-4-0-20261023-1607"
    },
    {
      "cmd": "echo 'local.common_tags' | packer console -var git_commit=3f2a9c1 .",
      "output": "{\n  \"Application\" = \"web\"\n  \"BuildTime\" = \"20261023-1607\"\n  \"GitCommit\" = \"3f2a9c1\"\n  \"Version\" = \"1.4.0\"\n}"
    },
    {
      "cmd": "echo 'upper(var.app_name)' | packer console .",
      "output": "WEB"
    }
  ]
}
```

The time in the output is the moment of the run, in UTC. Packer evaluates a local once per run, so every source that uses `local.build_time` gets the same value. Call `timestamp()` in one local rather than in each source.

## Secrets: `env()`, Vault and AWS Secrets Manager

Never write secrets into templates or committed var files. Packer has three ways to fetch them at run time:

```hcl
# 1. From the environment, in a variable default
variable "api_token" {
  type      = string
  sensitive = true
  default   = env("API_TOKEN")
}

# 2. From HashiCorp Vault (reads VAULT_ADDR and VAULT_TOKEN)
locals {
  db_password = vault("secret/data/packer/db", "password")
}

# 3. From AWS Secrets Manager with a data source
data "amazon-secretsmanager" "registry" {
  name = "packer/registry"
  key  = "password"
}
```

`vault()` works in locals (as above) but not in variable defaults. Packer evaluates locals even for `packer validate`, so a template that calls `vault()` needs Vault access to validate. `env()` is the opposite: it only works in a variable's `default`. Anywhere else, Packer does not know it:

```terminal
{
  "title": "env() outside a variable default",
  "prompt": "$",
  "steps": [
    {
      "cmd": "grep -n 'env(' env.pkr.hcl",
      "output": "9:    inline = [\"echo ${env(\"HOME\")}\"]"
    },
    {
      "cmd": "packer validate .",
      "output": "Error: Failed preparing provisioner-block \"shell-local\" \"\"\n\n  on env.pkr.hcl line 8:\n  (source code not available)\n\nenv.pkr.hcl:9,23-26: Call to unknown function; There is no function named \"env\"."
    }
  ]
}
```

Read the value into a variable (`default = env("HOME")`) and use `var.home` instead. For anything secret, prefer a secrets manager over environment variables, and give the build machine only the secrets that a step really needs.

`packer validate` does not run data sources, so their values are unknown during validation, and a few checks reject unknown values (for example, `environment_vars` reports `Environment variable not in format 'key=value': <unknown>`). Add `-evaluate-datasources` to resolve them during validation; it calls the cloud API, so it needs credentials.

## Project Structure

Keep one directory per image and share scripts and files between them:

```text
packer-images/
├── images/
│   ├── base/                    # hardened base image, built weekly
│   │   ├── build.pkr.hcl
│   │   ├── sources.pkr.hcl
│   │   ├── variables.pkr.hcl
│   │   └── production.pkrvars.hcl
│   └── web/                     # application image, built from base
│       ├── build.pkr.hcl
│       ├── sources.pkr.hcl
│       ├── variables.pkr.hcl
│       ├── staging.pkrvars.hcl
│       └── production.pkrvars.hcl
├── scripts/
│   ├── install-nginx.sh
│   └── cleanup.sh
├── files/
│   ├── nginx.conf
│   └── app.service
├── ansible/
│   ├── playbook.yml
│   └── roles/
├── tests/
│   └── test-image.sh
├── .github/workflows/packer.yml
└── Makefile
```

Paths in a template are relative to the directory you run Packer from, not to the template file. Use `${path.root}` to make them relative to the template directory instead, for example `script = "${path.root}/../../scripts/cleanup.sh"`.

A Makefile keeps the commands the same for everybody:

```makefile
IMAGE ?= web
ENV   ?= staging
DIR    = images/$(IMAGE)

.PHONY: init fmt validate build test-local

init:
	packer init $(DIR)

fmt:
	packer fmt -recursive .

validate: init
	packer fmt -check -recursive .
	packer validate -var-file=$(DIR)/$(ENV).pkrvars.hcl $(DIR)

build: validate
	packer build -var-file=$(DIR)/$(ENV).pkrvars.hcl $(DIR)

test-local: init
	packer build -only='docker.*' -var-file=$(DIR)/$(ENV).pkrvars.hcl $(DIR)
```

## Testing Images

Test at three levels, from cheapest to most thorough.

**1. Before the build**: `packer fmt -check -recursive .` and `packer validate` catch formatting, syntax, unset variables and invalid settings in seconds. For templates like the ones in this guide they need no cloud credentials, because validation skips data sources; functions such as `vault()` in locals are the exception. Run them on every pull request.

**2. A local build**: add a `docker` source with `discard = true` next to the cloud sources (see [Part 4](/guides/introduction-to-packer/04-builders-and-platforms#h2-building-for-several-platforms)) and run `packer build -only='docker.*' .`. Your provisioning scripts run in a container in about a minute, with no cloud costs.

**3. After the build**: launch an instance from the new image and check that it does its job. A small script is enough to start with:

```bash
#!/usr/bin/env bash
# tests/test-image.sh: launch the newest AMI from manifest.json and check that Nginx answers
set -euo pipefail

ARTIFACT=$(jq -r '.builds[-1].artifact_id' manifest.json) # region:ami-id
export AWS_REGION=${ARTIFACT%%:*} AWS_DEFAULT_REGION=${ARTIFACT%%:*}
AMI_ID=${ARTIFACT#*:}

INSTANCE_ID=$(aws ec2 run-instances \
  --image-id "$AMI_ID" \
  --instance-type t3.micro \
  --subnet-id "$TEST_SUBNET_ID" \
  --security-group-ids "$TEST_SG_ID" \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Purpose,Value=image-test}]' \
  --query 'Instances[0].InstanceId' --output text)

# Always terminate the test instance, even when a check fails
trap 'aws ec2 terminate-instances --instance-ids "$INSTANCE_ID" >/dev/null' EXIT

aws ec2 wait instance-status-ok --instance-ids "$INSTANCE_ID"

IP=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].PrivateIpAddress' --output text)

# Retry for up to a minute while services start
for i in $(seq 1 12); do
  if curl -fsS --max-time 5 "http://$IP/" | grep -q '<h1>Hello from Packer</h1>'; then
    echo "image $AMI_ID passed"
    exit 0
  fi
  sleep 5
done

echo "image $AMI_ID failed: no response from Nginx" >&2
exit 1
```

The script runs from a CI runner or host inside the VPC, so it can reach the private IP. For deeper checks (packages, users, open ports, file permissions), use a server testing tool such as Goss or Testinfra, either as the last provisioner in the build or against the test instance.

## Versioning and Tracking Images

Every image should answer three questions: what is in it, where did it come from, and is it the latest good one?

- **Name**: application, version and build time, as in `local.image_name` above. Names must be unique, and a sortable time stamp makes the newest one easy to find.
- **Tags or labels**: version, Git commit, base image and build time. Pass the commit from CI with `-var git_commit=$GITHUB_SHA`.
- **Manifest**: add your own fields to `manifest.json` so later pipeline steps can read them:

```hcl
post-processor "manifest" {
  output     = "manifest.json"
  strip_path = true
  custom_data = {
    git_commit = var.git_commit
    version    = var.app_version
  }
}
```

- **Promotion**: do not let every build replace production. Mark an image as approved (a tag such as `Status=approved`, an Azure gallery version, a Google image family, or an HCP Packer channel) after it passes the tests, and let Terraform deploy only approved images.

### HCP Packer

**HCP Packer** is HashiCorp's hosted registry for image metadata. It does not store the images, only where they are and how they were built. Builds publish to a **bucket** per image, you assign versions to **channels** such as `production`, and other Packer templates read the image ID for a channel with the `hcp-packer-version` and `hcp-packer-artifact` data sources. Terraform does the same with the HCP provider's `hcp_packer_version` and `hcp_packer_artifact` data sources. Since Packer 1.13, the `hcp_packer_registry` block goes at the top level of the template:

```hcl
hcp_packer_registry {
  bucket_name = "web"
  description = "Nginx web server image"
  bucket_labels = {
    team = "platform"
  }
  build_labels = {
    os = "ubuntu-24.04"
  }
}
```

A build with this block needs HCP credentials, from the `HCP_CLIENT_ID` and `HCP_CLIENT_SECRET` environment variables or a credentials file, or it fails before it starts. If you do not use HCP, the manifest file and your cloud's own tags give you most of the same tracking.

## CI/CD Integration

Run the cheap checks on every pull request and the real build on a tag or on the main branch. Use OpenID Connect (OIDC), so the pipeline assumes a cloud role with short-lived credentials and no access keys are stored in CI.

### GitHub Actions

```yaml
name: Build image

on:
  pull_request:
    paths: ['images/**', 'scripts/**', 'files/**']
  push:
    tags: ['v*']

permissions:
  contents: read
  id-token: write # needed for OIDC

env:
  PACKER_VERSION: '1.16.2'
  IMAGE_DIR: images/web

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: hashicorp/setup-packer@v3
        with:
          version: ${{ env.PACKER_VERSION }}
      - run: packer init "$IMAGE_DIR"
      - run: packer fmt -check -recursive .
      - run: packer validate -var-file="$IMAGE_DIR/production.pkrvars.hcl" -var app_version=0.0.0 "$IMAGE_DIR"

  build:
    if: startsWith(github.ref, 'refs/tags/v')
    needs: validate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: hashicorp/setup-packer@v3
        with:
          version: ${{ env.PACKER_VERSION }}
      - uses: aws-actions/configure-aws-credentials@v6
        with:
          role-to-assume: arn:aws:iam::123456789012:role/packer-ci
          aws-region: us-east-1
      - run: packer init "$IMAGE_DIR"
      - name: Build
        run: |
          packer build \
            -var-file="$IMAGE_DIR/production.pkrvars.hcl" \
            -var app_version="${GITHUB_REF_NAME#v}" \
            -var git_commit="$GITHUB_SHA" \
            "$IMAGE_DIR"
      - uses: actions/upload-artifact@v7
        with:
          name: manifest
          path: manifest.json
```

The IAM role `packer-ci` trusts GitHub's OIDC provider for this repository only and has the permissions from [Part 2](/guides/introduction-to-packer/02-installation-and-setup#h3-aws). The versions above are the current major versions in October 2026; for supply-chain safety, pin third-party actions to a full commit SHA.

### GitLab CI

```yaml
stages: [validate, build]

variables:
  PACKER_VERSION: '1.16.2'
  IMAGE_DIR: images/web

default:
  image:
    name: hashicorp/packer:${PACKER_VERSION}
    entrypoint: [''] # the image's entrypoint is /bin/packer; GitLab needs a shell

validate:
  stage: validate
  script:
    - packer init "$IMAGE_DIR"
    - packer fmt -check -recursive .
    - packer validate -var-file="$IMAGE_DIR/production.pkrvars.hcl" -var app_version=0.0.0 "$IMAGE_DIR"

build:
  stage: build
  rules:
    - if: $CI_COMMIT_TAG
  id_tokens:
    AWS_ID_TOKEN:
      aud: sts.amazonaws.com
  script:
    - echo "$AWS_ID_TOKEN" > /tmp/web-identity-token
    - export AWS_WEB_IDENTITY_TOKEN_FILE=/tmp/web-identity-token
    - export AWS_ROLE_ARN=arn:aws:iam::123456789012:role/packer-ci
    - packer init "$IMAGE_DIR"
    - packer build -var-file="$IMAGE_DIR/production.pkrvars.hcl" -var app_version="${CI_COMMIT_TAG#v}" -var git_commit="$CI_COMMIT_SHA" "$IMAGE_DIR"
  artifacts:
    paths: [manifest.json]
```

The `hashicorp/packer` image's entrypoint is the `packer` binary, so GitLab cannot run a script in it until you reset the entrypoint. The `id_tokens` block gives the job an OIDC token, and the AWS SDK inside the Amazon plugin exchanges it for role credentials through `AWS_WEB_IDENTITY_TOKEN_FILE` and `AWS_ROLE_ARN`.

## Security Best Practices

- **No long-lived keys.** Use OIDC in CI, SSO profiles on laptops, and instance roles on build servers. Give the build identity only the permissions from [Part 2](/guides/introduction-to-packer/02-installation-and-setup#h3-aws).
- **No secrets in the image.** Fetch them at boot from a secrets manager, not at build time into a file.
- **Lock down the build machine**: restrict the temporary SSH rule to your IP, or use private subnets with SSM ([Part 4](/guides/introduction-to-packer/04-builders-and-platforms#h3-build-without-opening-ssh)), and require IMDSv2.
- **Encrypt images** (`encrypt_boot` on AWS) and share them only with the accounts that need them.
- **Start from official base images** and rebuild often, so security updates reach production through new images rather than in-place patching.
- **Scan and record what you ship**: scan the test instance or image with your vulnerability scanner, and keep a software bill of materials (SBOM) per image.

Packer 1.16 can also write a signed record of how an image was built. The new `provenance` post-processor creates an in-toto statement in the SLSA provenance format, with the artifact's digest, the Packer version and the build name, and it can sign it with a local key, a cloud KMS key or Sigstore. Here it runs unsigned on the built-in `file` builder, which turns a file into an artifact:

```hcl
source "file" "artifact" {
  content = "hello image"
  target  = "image.txt"
}

build {
  sources = ["source.file.artifact"]

  post-processor "provenance" {}
}
```

```terminal
{
  "title": "an unsigned provenance statement",
  "prompt": "$",
  "steps": [
    {
      "cmd": "packer build .",
      "output": "file.artifact: output will be in this color.\n\n==> file.artifact: Running post-processor:  (type provenance)\n==> file.artifact (provenance): Wrote attestation to artifact.image.txt.provenance.json\nBuild 'file.artifact' finished after 29 milliseconds 406 microseconds.\n\n==> Wait completed after 29 milliseconds 516 microseconds\n\n==> Builds finished. The artifacts of successful builds are:\n--> file.artifact: Stored file: image.txt\n--> file.artifact: Stored file: image.txt"
    },
    {
      "cmd": "cat artifact.image.txt.provenance.json",
      "output": "{\n  \"_type\": \"https://in-toto.io/Statement/v1\",\n  \"subject\": [\n    {\n      \"name\": \"image.txt\",\n      \"digest\": {\n        \"sha256\": \"84d8fd5280a5162aaf5c5d9aeb069b2660500eabeeda58ce2bb10595827e08ad\"\n      }\n    }\n  ],\n  \"predicateType\": \"https://slsa.dev/provenance/v1\",\n  \"predicate\": {\n    \"buildDefinition\": {\n      \"buildType\": \"https://packer.io/buildtypes/hcl2/v1\",\n      \"externalParameters\": {},\n      \"internalParameters\": {\n        \"packerBuildName\": \"artifact\",\n        \"packerBuilderType\": \"file\",\n        \"packerVersion\": \"1.16.2\"\n      }\n    },\n    \"runDetails\": {\n      \"builder\": {\n        \"id\": \"https://packer.io/local-build\",\n        \"version\": {\n          \"packer\": \"1.16.2\"\n        }\n      },\n      \"metadata\": {\n        \"invocationId\": \"aab0f2c4-5fd2-8758-4a25-c6caa5120a3e\"\n      }\n    }\n  }\n}"
    }
  ]
}
```

In a real pipeline, set `signing_mode` to `key`, `kms` or `keyless` so consumers can verify the statement with `packer verify-attestation`.

## Performance Tips

- **Use a bigger build instance.** A build runs for minutes, so a faster instance type costs little extra and saves time. Instances launched from the image can be any compatible size.
- **Layer your images.** Build a hardened base image weekly, and quick application images on top of it, so most builds skip the slow OS updates.
- **Avoid repeated large downloads**: mirror artifacts in an S3 bucket or registry in the same region as the build.
- **Let independent platforms build in parallel**, and use `-parallel-builds` to limit it when a CI runner or provider quota is the bottleneck.
- **Test provisioning with the Docker builder** instead of waiting for cloud builds while you develop scripts.

## Common Mistakes

- **Running `packer build file.pkr.hcl`** when variables live in another file. Run Packer on the directory.
- **Committing secrets in `.pkrvars.hcl` files.** Commit only non-secret var files, and read secrets with `env()`, Vault or a data source.
- **Forgetting about auto var files**, then wondering where a value comes from.
- **Using `-force` in production pipelines**, which deregisters the existing AMI of the same name.
- **No retention policy**: image storage grows with every build. Delete old images and their snapshots on a schedule.

## Summary

- Declare inputs with `variable` blocks (types, defaults, validation, `sensitive`), and derive values with `locals`.
- Values come from defaults, `PKR_VAR_` variables, `*.auto.pkrvars.hcl` files, `-var-file` and `-var`, with the later ones winning.
- Run Packer on directories, test expressions with `packer console`, and check every change with `fmt -check` and `validate`.
- Test images after the build, version and tag them, and promote only images that passed.
- Build in CI with OIDC credentials and pinned Packer and plugin versions.

A good next step is to wire the AMI ID from `manifest.json` (or an HCP Packer channel) into a Terraform launch template, so deployments always use your latest tested image.

## Keep Learning

- [Terraform Infrastructure as Code Best Practices](/posts/terraform-best-practices)
- [CI/CD Pipeline Hardening: A Practical Guide to Securing Your Build Infrastructure](/posts/cicd-pipeline-hardening-guide)
- [Secrets Management Guide: Vault, AWS Secrets Manager, and Azure Key Vault](/posts/secrets-management-guide)
- [CI/CD Pipeline Setup Checklist](/checklists/cicd-pipeline-setup) and [HashiCorp Vault Secrets Management Checklist](/checklists/hashicorp-vault-secrets-management)
- [Complete CI/CD Pipeline with GitHub Actions](/exercises/ci-cd-github-actions) (exercise)
- [Interview question: secrets management](/interview-questions/mid/secrets-management)
