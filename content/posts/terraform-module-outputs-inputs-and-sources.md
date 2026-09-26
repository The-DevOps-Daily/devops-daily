---
title: 'Terraform Module Outputs, Inputs and Sources: How Modules Pass Data to Each Other'
excerpt: 'How to get a value out of a Terraform module, pass a resource into another module, chain modules with for_each, pin a Git branch or tag as a module source, and fix the "Provider configuration not present" error that shows up when you refactor. All examples were run on Terraform 1.15.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2026-09-26'
publishedAt: '2026-09-26T09:00:00Z'
updatedAt: '2026-09-26T09:00:00Z'
readingTime: '11 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Terraform
  - Terraform Modules
  - Infrastructure as Code
  - HCL
  - DevOps
---

A Terraform module is a box with a very small door. Everything inside it (resources, locals, data sources) is private. The only way in is an input variable, and the only way out is an output. Once that clicks, most module questions answer themselves: "how do I reference the instance my module created?", "how do I give this module my VPC?", "why can't I see `module.app.aws_instance.web`?"

This post walks through the module questions that come up most in real projects: outputs, passing values and whole resources between modules, modules with `for_each`, Git sources pinned to a branch or tag, and the provider error people hit when they refactor old modules. Every command in the terminal blocks was run on Terraform 1.15.8 with the built-in `terraform_data` resource and the `random` provider, so you can repeat them without a cloud account.

## TLDR

- A module exposes values only through `output` blocks. From the caller you read them as `module.<name>.<output>`. You cannot reach into a module's resources directly.
- To pass data into a module, declare a `variable` in the module and set it in the `module` block. That is how you "pass a resource" too: pass its attributes, or the whole object with a typed variable.
- Referencing `module.network.vpc_id` from another module creates the dependency automatically. No `depends_on` needed.
- A module with `for_each` becomes a map of instances: `module.network["production"].vpc_id`, or a `for` expression to collect them all.
- Git module sources take `?ref=` with a branch, tag or commit. Use tags or commits for anything shared, branches only while developing.
- "Provider configuration not present" means Terraform needs a provider configuration that is gone, most often because a module with its own `provider` block was removed while its resources are still in state. Move provider blocks to the root, apply, then remove the module.

## Prerequisites

- Terraform 1.4 or later for the examples (they use the built-in `terraform_data` resource; we ran them on 1.15), and 1.7 or later for the `removed` block mentioned at the end
- A root configuration with at least one local module, or the [Terraform terminal simulator](/games/terraform-terminal-simulator) to practice the basics first
- For the Git source section, access to a Git repository that holds a module

## The layout used in this post

```text
.
├── main.tf              # root module: calls the child modules
└── modules
    ├── network
    │   └── main.tf      # creates a "VPC", outputs its id and CIDR
    └── app
        └── main.tf      # takes a vpc_id input, creates a "server"
```

```diagram
{
  "type": "graph",
  "title": "Data only crosses a module boundary through variables and outputs",
  "columns": [
    [{ "id": "root", "label": "Root module", "sub": "main.tf", "icon": "gear", "tone": "slate" }],
    [
      { "id": "net", "label": "module.network", "sub": "for_each: staging, production", "icon": "net", "tone": "blue" },
      { "id": "app", "label": "module.app", "sub": "var.vpc_id", "icon": "server", "tone": "green" }
    ],
    [{ "id": "out", "label": "Root outputs", "sub": "vpc_ids, app_server", "icon": "check", "tone": "amber" }]
  ],
  "edges": [
    ["root", "net", "cidr, name"],
    ["net", "app", "vpc_id output"],
    ["net", "out", "vpc_id"],
    ["app", "out", "server_id"]
  ]
}
```

## Get a value out of a module: outputs

Inside the module, an `output` block decides what the caller can see:

```hcl
# modules/network/main.tf
variable "name" { type = string }
variable "cidr" { type = string }

resource "terraform_data" "vpc" {
  input = { name = var.name, cidr = var.cidr }
}

output "vpc_id" {
  description = "ID of the network, for modules that need to attach to it"
  value       = terraform_data.vpc.id
}

output "cidr" {
  value = var.cidr
}
```

In the caller, the module's outputs are attributes of `module.<name>`. That is the only view you get. Try to reach past it, to the resource itself, and Terraform refuses:

```terminal
{
  "title": "reaching inside a module",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    { "comment": "an output that tries to read a resource inside module.app" },
    { "cmd": "terraform plan", "output": "Error: Unsupported attribute\n  on extra.tf line 2, in output \"direct\":\n   2:   value = module.app.terraform_data.server.id\n    ├────────────────\n    │ module.app is object with 1 attribute \"server_id\"\nThis object does not have an attribute named \"terraform_data\"." }
  ]
}
```

The error message is the whole lesson: `module.app is object with 1 attribute "server_id"`. If the caller needs something, the module has to output it.

A few habits make outputs easier to live with:

- **Output IDs and names, not whole resources, by default.** Callers then depend on a small, stable interface instead of every attribute of a resource type.
- **Add `description`.** It shows up in module documentation generators and in the registry.
- **Mark secrets `sensitive = true`.** Terraform then hides the value in plan and apply output. The value is still stored in state, so that does not make it safe to share state.
- **You can output a whole object when the caller genuinely needs many attributes:** `value = aws_instance.web` gives the caller `module.app.web.private_ip`, `module.app.web.arn` and so on, at the cost of a wider interface.

## Pass a resource into a module: inputs

There is no way to hand a module "the resource" as a live link. You pass values through variables, and Terraform tracks the dependency for you.

The common case is a single attribute:

```hcl
# modules/app/main.tf
variable "vpc_id" {
  description = "Network the server attaches to"
  type        = string
}

resource "terraform_data" "server" {
  input = "server in ${var.vpc_id}"
}

output "server_id" {
  value = terraform_data.server.id
}
```

```hcl
# main.tf
module "app" {
  source = "./modules/app"
  vpc_id = module.network["production"].vpc_id # an output of another module
}
```

When a module needs several attributes of the same resource, pass them together as an object instead of five separate variables:

```hcl
variable "network" {
  type = object({
    id   = string
    cidr = string
  })
}
```

```hcl
module "app" {
  source  = "./modules/app"
  network = {
    id   = module.network["production"].vpc_id
    cidr = module.network["production"].cidr
  }
}
```

You can even pass a whole resource object into a variable, as long as the object type matches its attribute names. An `aws_vpc` has `id` and `cidr_block`, so the variable would be `object({ id = string, cidr_block = string })` and the caller writes `network = aws_vpc.main`; Terraform keeps the attributes the type names and discards the rest. `type = any` also works. The typed object is better: it documents exactly which attributes the module relies on, and the error messages are clearer when something does not fit.

## Chain modules: one module's output as another's input

The `module "app"` block above already chains two modules. Because it reads `module.network["production"].vpc_id`, Terraform knows that everything in `module.app` that uses the value depends on the network. You do not need `depends_on`. Reach for `depends_on` on a module only for dependencies Terraform cannot see from references, and even then prefer passing a real value: `depends_on` on a module makes every resource in it wait for everything it depends on, which can make plans noisier.

The pattern scales to longer chains, network to database to application, with each module taking the previous one's outputs as inputs. Keep the chain in the root module. A child module that calls another module to get at a third one's outputs is usually a sign that the boundaries are wrong.

## Modules with for_each: outputs become a map

Put `for_each` on a module block and you get one instance per key:

```hcl
module "network" {
  source   = "./modules/network"
  for_each = {
    staging    = "10.10.0.0/16"
    production = "10.20.0.0/16"
  }
  name = each.key
  cidr = each.value
}

output "vpc_ids" {
  value = { for env, net in module.network : env => net.vpc_id }
}

output "app_server" {
  value = module.app.server_id
}
```

`module.network` is now a map of module instances. Index it with a key to read one (`module.network["production"].vpc_id`), or loop over it with a `for` expression to collect an output from every instance. Here is the whole configuration applied:

```terminal
{
  "title": "module outputs with for_each",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    { "cmd": "terraform apply -auto-approve", "output": "...\nApply complete! Resources: 3 added, 0 changed, 0 destroyed.\n\nOutputs:\n\napp_server = \"cc4f60a8-1f31-ee53-d88b-403eda671809\"\nvpc_ids = {\n  \"production\" = \"5f6dd161-90ed-1b1b-7d7f-046be2e59622\"\n  \"staging\" = \"6b7f90ae-73b6-e693-25e1-a661428b3cfc\"\n}" }
  ]
}
```

The same `for` expression works for `count` modules with a list instead of a map: `[for net in module.network : net.vpc_id]`. If you need the values as a list from a `for_each` module, wrap it: `values(module.network)[*].vpc_id`.

## Module sources: pin a Git branch, tag or commit

Local paths are fine inside one repository. When several repositories share a module, keep it in Git and point `source` at it. The `ref` query parameter selects what to check out:

```hcl
module "network" {
  # a release tag: what production should use (if your tags are never moved)
  source = "git::https://github.com/acme/terraform-modules.git//network?ref=v1.4.0"
}

module "network_dev" {
  # a branch: moves every time someone pushes, fine while you develop the module
  source = "git::https://github.com/acme/terraform-modules.git//network?ref=feature/ipv6"
}

module "network_pinned" {
  # a full commit SHA: cannot move at all
  source = "git::https://github.com/acme/terraform-modules.git//network?ref=4f2a9c1e8b7d6a5f4e3d2c1b0a9f8e7d6c5b4a39"
}
```

Details that trip people up:

- **The double slash** (`.git//network`) selects a subdirectory of the repository. Without it, Terraform uses the repository root.
- **Private repositories over SSH** use `git::ssh://git@github.com/acme/terraform-modules.git//network?ref=v1.4.0`, or the shorter `git@github.com:acme/terraform-modules.git//network?ref=v1.4.0`. The machine running Terraform (including CI) needs a key that can read the repository.
- **Branch sources do not update on their own.** A repeat `terraform init` keeps the modules already in `.terraform/modules` as long as their `source` is unchanged. To pick up new commits on the branch, run `terraform get -update` (modules only) or `terraform init -upgrade` (modules, and it also reconsiders provider versions). A fresh checkout, like a CI runner, downloads whatever the branch points at right now. That is exactly why production should not point at a branch: two runs of the same commit of your root configuration can use different module code.
- **Tags can move.** Git lets someone delete a tag and create it again on another commit. If nobody in your organisation re-tags releases, a tag is a good pin; if you cannot be sure, pin the full commit SHA.
- **Version constraints (`version = "~> 1.4"`) only work with registry sources**, not with Git URLs. With Git, the `ref` is your version pin.

## "Provider configuration not present" when you refactor modules

This one surprises people because it appears after deleting code, not adding it. Older modules often declared their own `provider` block inside the module. Here is one:

```hcl
# modules/legacy/main.tf
terraform {
  required_providers {
    random = { source = "hashicorp/random" }
  }
}

# a provider block inside a child module: the legacy pattern
provider "random" {}

resource "random_pet" "name" {}
```

Everything works until you remove the `module "legacy"` block from the root to get rid of it. Terraform wants to destroy `random_pet.name`, but the provider configuration it needs to do that lived inside the module you just deleted:

```terminal
{
  "title": "removing a module that had its own provider block",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    { "cmd": "terraform plan", "output": "Error: Provider configuration not present\nTo work with module.legacy.random_pet.name (orphan) its original provider\nconfiguration at\nmodule.legacy.provider[\"registry.terraform.io/hashicorp/random\"] is required,\nbut it has been removed. This occurs when a provider configuration is removed\nwhile objects created by that provider still exist in the state. Re-add the\nprovider configuration to destroy module.legacy.random_pet.name (orphan),\nafter which you can remove the provider configuration again." }
  ]
}
```

The fix is to separate the two changes. First move the provider configuration to the root and delete the `provider` block from the module. Child modules inherit the root's default provider configurations automatically, so the module keeps working. Apply that on its own:

```hcl
# main.tf (root)
provider "random" {}

module "legacy" {
  source = "./modules/legacy"
}
```

```terminal
{
  "title": "step 1: provider moved to the root",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    { "cmd": "terraform plan", "output": "No changes. Your infrastructure matches the configuration." },
    { "cmd": "terraform apply -auto-approve", "output": "Apply complete! Resources: 0 added, 0 changed, 0 destroyed." },
    { "comment": "step 2: now delete the module block" },
    { "cmd": "terraform plan", "output": "  # module.legacy.random_pet.name will be destroyed\n  # (because random_pet.name is not in configuration)\nPlan: 0 to add, 0 to change, 1 to destroy." }
  ]
}
```

Now removing the module is a normal destroy. If you want Terraform to forget the resources instead of destroying them, put a `removed` block in place of the module (`from = module.legacy` with `destroy = false`); our [Terraform state post](/posts/terraform-state-remove-move-migrate-backend) covers `removed` and `moved` in detail.

Two rules keep you out of this for good:

1. **No `provider` blocks in reusable modules.** A module declares what it needs in `required_providers`; the root decides how providers are configured.
2. **When a module needs a non-default provider**, for example a second AWS region, pass it explicitly from the root:

```hcl
provider "aws" {
  alias  = "eu"
  region = "eu-west-1"
}

module "backup_bucket" {
  source = "./modules/bucket"
  providers = {
    aws = aws.eu
  }
}
```

For the bigger picture of sharing providers and variables between many modules, see [how to share providers and variables across Terraform modules](/posts/terraform-provider-variable-sharing-modules).

## Summary

| Question                                             | Answer                                                          |
| ---------------------------------------------------- | --------------------------------------------------------------- |
| How do I read a value from a module?                 | Add an `output` in the module, read `module.<name>.<output>`    |
| Can I reference a resource inside a module directly? | No, only its outputs                                            |
| How do I pass a resource into a module?              | Pass its attributes, or a typed object, through a `variable`    |
| Do chained modules need `depends_on`?                | No, references create the dependency                            |
| How do I read outputs from a `for_each` module?      | `module.x["key"].output`, or a `for` expression over `module.x` |
| Branch, tag or commit as a Git source?               | Tag or commit for shared code, branch only while developing     |
| "Provider configuration not present"?                | Move the provider to the root, apply, then remove the module    |

Modules stay pleasant to work with when their interface is small and explicit: a few typed variables in, a few described outputs out, no provider blocks inside. For the language features that go into those interfaces, [Terraform variables, loops and outputs](/posts/terraform-variables-loops-and-outputs) is the next read, and for laying modules out across environments, see [how to organize Terraform modules for multiple environments](/posts/organize-terraform-modules-multiple-environments).
