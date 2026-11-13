---
title: 'How to Organize a Terraform Repository: Environments, Modules, Files'
excerpt: 'A practical layout for a Terraform repository: one root folder per environment and component, small reusable modules, and clear file names. Also covers dev, staging and production, workspaces, and how to split main.tf into several files.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2024-12-05'
publishedAt: '2024-12-05T09:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '13 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Infrastructure as Code
  - Repository Structure
  - Modules
  - Environments
  - Best Practices
---

A Terraform project usually starts as one folder with one `main.tf`. Then a staging copy appears, a second team adds its own resources, and a plan for a one-line change takes ten minutes. The structure of the repository decides how big each plan is, who can change what, and how far a mistake can spread.

There is no single correct layout, but the good ones follow the same few rules. This post shows a layout that holds up, then answers the questions that come with it: how to handle dev, staging and production, how to organize modules across environments, and how to split a large `main.tf` into several files.

## TLDR

| Question                                 | Short answer                                                                                             |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| What layout should I use?                | `modules/` for reusable code, and one root folder per environment and component, each with its own state |
| Workspaces or folders for environments?  | Folders with separate backends for long-lived environments. Workspaces for short-lived copies            |
| Where do provider and backend blocks go? | In the root folders only, never in reusable modules                                                      |
| How do I version shared modules?         | Git tags or a module registry, referenced with `?ref=` or `version`                                      |
| How do I split `main.tf`?                | Move blocks into more `.tf` files in the same folder. Terraform loads them all, in any order             |

## Prerequisites

- Terraform 1.x. The `use_lockfile` backend option needs 1.10 or later, and `terraform test` needs 1.6 or later.
- Basic knowledge of modules and remote state. Our [Terraform guide](/guides/introduction-to-terraform) covers both.

## How Should I Organize a Terraform Repository?

Separate two kinds of folders. **Modules** are reusable code with inputs and outputs. **Root folders** (also called live configurations or stacks) are where you run `terraform plan`: each one calls modules, configures providers and the backend, and has its own state file.

```text
infrastructure/
├── modules/                      # reusable, no provider or backend blocks
│   ├── network/
│   ├── database/
│   └── service/
├── environments/                 # root folders: run Terraform here
│   ├── dev/
│   │   ├── network/
│   │   └── app/
│   ├── staging/
│   │   ├── network/
│   │   └── app/
│   └── prod/
│       ├── network/
│       └── app/
└── .github/workflows/            # plan on pull requests, apply after review
```

A root folder is small. It configures the backend and providers, calls modules, and sets the values that make this environment different:

```hcl
# environments/prod/network/main.tf
terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  backend "s3" {
    bucket       = "acme-terraform-state"
    key          = "prod/network/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = {
      Environment = "prod"
      ManagedBy   = "terraform"
    }
  }
}

module "network" {
  source = "../../../modules/network"

  name               = "prod"
  vpc_cidr           = "10.0.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]
}
```

Rules that make this layout work:

- **One state per root folder, and credentials to match.** Every root folder has its own backend `key`, so a plan in `dev/app` never reads or writes the state of `prod/network`. The state key is not a permission boundary, though: give each environment its own credentials and IAM scope, so dev code cannot reach production resources either.
- **Split by owner and by rate of change.** Networking changes rarely and often belongs to a platform team. Application resources change daily. Different owners and different speeds mean different root folders. [Who Owns the State File](/posts/who-owns-the-terraform-state-file#h2-question-2-how-is-state-split) explains how to choose the split.
- **Pass values between root folders on purpose.** Use data sources that look up resources by name or tag, or publish selected values to a store such as SSM Parameter Store. `terraform_remote_state` works too, but the reader needs access to the whole state file of the other folder.
- **Keep environments alike.** If prod and staging call the same modules with different inputs, a change that works in staging tells you something about prod.

### Grow the Layout in Steps

Start simple and add structure only when you need it:

1. **One folder** for a small project with one environment.
2. **One folder per environment** when a second environment appears.
3. **One folder per component inside each environment** when plans get slow or a second team joins.
4. **Several repositories** when teams need separate access control or release cycles, for example a `terraform-modules` repository with tagged releases and one repository per team for the root folders.

Moving resources between root folders later is possible but takes work: `removed` blocks in one state and `import` blocks in the other. Pick a split that fits the next year, not the next five.

### Share Common Settings Without Copying Them

Every root folder is a separate configuration. A `locals` block in a `shared/` folder is not visible from `environments/prod`, because Terraform only reads the `.tf` files of the folder it runs in and the modules it calls. To share settings:

- **Put them in a small module** that only has outputs, and call it from each root folder:

```hcl
# modules/conventions/main.tf
variable "environment" {
  type = string
}

output "tags" {
  value = {
    Environment = var.environment
    ManagedBy   = "terraform"
    Repository  = "acme/infrastructure"
  }
}
```

```hcl
# environments/prod/app/main.tf
module "conventions" {
  source      = "../../../modules/conventions"
  environment = "prod"
}

provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = module.conventions.tags
  }
}
```

- **Use the provider's `default_tags`** for tags that every resource should have, as above, instead of passing a tags map to every module. Resources that AWS creates for you, such as instances launched by an Auto Scaling group, still need their own tag propagation settings.
- **Symlink one file** such as `versions.tf` into each root folder if you want identical version constraints. It works, but it is easy to miss in review, so a module is usually clearer.

### Mono-Repo or Multi-Repo?

A single repository is simpler to start with: one place to search, one CI setup, and a module change and its use land in the same pull request. Several repositories give each team its own access rules and release cycle, and force shared modules to be versioned. Most teams start with one repository and split it when access control requires it.

## How Do I Manage Dev, Staging and Production in Terraform?

Use one root folder per environment, each with its own backend configuration and its own credentials. Use workspaces only for short-lived copies of the same stack, such as a test copy per branch.

| Approach                                                      | Separate state     | Separate credentials             | Good for                               |
| ------------------------------------------------------------- | ------------------ | -------------------------------- | -------------------------------------- |
| One folder per environment                                    | Yes                | Yes, per folder                  | Long-lived environments, production    |
| One folder, `-var-file` and `-backend-config` per environment | Yes                | Possible, but easy to mix up     | Environments that are almost identical |
| Workspaces                                                    | Yes (same backend) | No, same backend and credentials | Short-lived copies, feature branches   |

Workspaces keep a separate state file per workspace under the same backend, and the code reads the name from `terraform.workspace`:

```hcl
resource "aws_s3_bucket" "assets" {
  bucket = "acme-assets-${terraform.workspace}"
}
```

```bash
terraform workspace new feature-login
terraform apply
terraform destroy && terraform workspace select default && terraform workspace delete feature-login
```

The problem with workspaces for production is that nothing separates the environments except the selected workspace. The same credentials can write every state, and a `destroy` in the wrong workspace destroys the wrong environment.

The single-folder approach with per-environment files looks like this:

```bash
terraform init -reconfigure -backend-config=backends/prod.hcl
terraform plan -var-file=env/prod.tfvars -out=prod.tfplan
```

It avoids copying code, but every command must pair the right backend file with the right variable file. A wrapper script or CI job that sets both from one environment name removes most of that risk. The [multiple environments chapter](/guides/introduction-to-terraform/08-working-with-multiple-environments) of our Terraform guide compares the three approaches and Terragrunt in more detail.

## How Do I Organize Terraform Modules for Multiple Environments?

Write modules that know nothing about environments. The environment is an input, and the root folder decides it:

```hcl
# modules/network/variables.tf
variable "name" {
  description = "Prefix for resource names, for example the environment"
  type        = string
}

variable "vpc_cidr" {
  type = string

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "vpc_cidr must be a valid CIDR block."
  }
}

variable "availability_zones" {
  type = list(string)
}
```

```hcl
# modules/network/main.tf
resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true

  tags = {
    Name = "${var.name}-vpc"
  }
}

resource "aws_subnet" "public" {
  for_each = { for i, az in var.availability_zones : az => i }

  vpc_id            = aws_vpc.this.id
  availability_zone = each.key
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, each.value)

  tags = {
    Name = "${var.name}-public-${each.key}"
  }
}

# modules/network/outputs.tf
output "vpc_id" {
  value = aws_vpc.this.id
}

output "public_subnet_ids" {
  value = [for s in aws_subnet.public : s.id]
}
```

Guidelines for the modules folder:

- **No `provider` or `backend` blocks in modules.** A module declares what it needs in `required_providers`, and the root folder configures it. A module with its own provider block cannot be used with `count`, `for_each` or `depends_on`. [Module outputs, inputs and sources](/posts/terraform-module-outputs-inputs-and-sources#h2-provider-configuration-not-present-when-you-refactor-modules) shows what goes wrong when you remove one.
- **One job per module.** A `network` module and a `database` module are easier to reuse than one `platform` module with forty inputs.
- **Version shared modules.** When several root folders or repositories use a module, release it with Git tags and pin it: `source = "git::https://github.com/acme/terraform-modules.git//network?ref=v1.4.0"`. Promote a new version through dev and staging before prod points at it.
- **Test modules on their own.** Keep an `examples/` folder with a minimal root configuration per module, and add `terraform test` files (Terraform 1.6 and later). With `mock_provider` (1.7 and later), tests can run without cloud credentials.
- **Document inputs and outputs.** A `description` on every variable and output, plus a README generated with `terraform-docs`, is enough.

## How Do I Split main.tf Into Several Files?

Move blocks into more `.tf` files in the same folder. Terraform loads every `.tf` and `.tf.json` file in the folder and treats them as one configuration. The file names and the order of the files do not matter, and moving a block to another file does not change the state or the plan.

A common split:

```text
app/
├── terraform.tf      # terraform block: required_version, required_providers, backend
├── providers.tf      # provider blocks
├── variables.tf      # variable blocks
├── locals.tf         # locals
├── main.tf           # the main resources, or split by area:
├── network.tf
├── database.tf
├── iam.tf
├── outputs.tf        # output blocks
└── terraform.tfvars  # values, not code
```

Things to know:

- **Subfolders are not loaded.** A `.tf` file in `app/network/` is a separate module. Terraform only uses it if a `module` block points at it.
- **Names must stay unique across files.** Two `resource "aws_instance" "web"` blocks in different files are a duplicate, and `terraform validate` reports it.
- **Files ending in `_override.tf` are special.** Terraform merges them into the other blocks instead of adding new ones. Do not name a normal file that way.
- **Split by meaning, not by size.** `network.tf`, `database.tf` and `iam.tf` are easy to find. `main1.tf` and `main2.tf` are not.

When one folder holds hundreds of resources, more files only hide the problem. That is the point where you split the configuration into separate root folders with separate states, as described at the start of this post.

## Related Resources

- [Terraform Repository Structure Checklist](/checklists/terraform-repo-structure) to review an existing repository.
- [Managing multiple environments](/guides/introduction-to-terraform/08-working-with-multiple-environments) and [Terraform modules](/guides/introduction-to-terraform/07-modules) in our Terraform guide.
- [Fix the Network Module](/challenges/fix-the-network-module), a challenge where you repair a broken VPC module.
- [AWS VPC with Terraform](/exercises/terraform-aws-vpc), an exercise that builds a module-based network.
- [Terraform Best Practices](/posts/terraform-best-practices) for versions, testing and CI.
