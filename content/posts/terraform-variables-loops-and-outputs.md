---
title: 'Terraform Variables, Loops, and Outputs: The Complete Guide'
excerpt: 'Everything about moving values through Terraform in one place: declaring vs assigning variables, tfvars and TF_VAR_ precedence, locals, maps and lists, for_each and its pitfalls, splat outputs for counted resources, sensitive values, and the classic "variables may not be used here" error.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2026-08-25'
publishedAt: '2026-08-25T09:00:00Z'
updatedAt: '2026-08-25T09:00:00Z'
readingTime: '14 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Terraform
  - Infrastructure as Code
  - Variables
  - Best Practices
---

Most Terraform questions are not really about resources. They are about moving values around: getting a value in (variables, tfvars, environment), reshaping it (locals, maps, lists, loops), and getting it out (outputs). The pieces are simple; the confusion comes from how they interact, and from a handful of errors that make no sense until you know what the language is doing underneath.

This guide collects the whole value pipeline in one place, including the errors that bring most people here: `Invalid for_each argument`, `Variables may not be used here`, and the mystery of outputs on counted resources.

## TL;DR

- `variables.tf` **declares** inputs; `terraform.tfvars` **assigns** them. Precedence, lowest to highest: defaults, environment `TF_VAR_*`, `terraform.tfvars`, `*.auto.tfvars`, `-var`/`-var-file` flags.
- Variables cannot reference other variables. That is what **locals** are for.
- Grow lists with `concat()`, pick objects out of lists with `index()` or a `for` filter, and iterate lists of objects with `for_each` keyed on a stable attribute.
- `for_each` needs a map or set of strings **known at plan time**; resource-derived values trigger `Invalid for_each argument`.
- With `count`, output all instances with the splat `[*]`; with `for_each`, use `values()`.
- `sensitive = true` hides values in plans; `terraform output -json` or `nonsensitive()` reveals them deliberately.
- Backend blocks and provider `required_version` run before variables exist, hence `Variables may not be used here` during `terraform init`.

## Prerequisites

- Terraform 1.x installed
- A working configuration you can run `plan` against
- Basic familiarity with HCL resource syntax

## Declaring vs assigning: variables.tf and tfvars

The naming trips everyone at first: both files have "var" in them, but they do opposite jobs. `variables.tf` **declares** that an input exists, its type, and optionally a default. `terraform.tfvars` **assigns** values to those declarations:

```hcl
# variables.tf — the contract
variable "environment" {
  type        = string
  description = "Deployment environment"
}

variable "instance_count" {
  type    = number
  default = 1
}
```

```hcl
# terraform.tfvars — the values for this workspace
environment    = "production"
instance_count = 3
```

Assigning a variable that was never declared is an error; declaring without assigning falls back to the default or prompts interactively. Keep declarations stable in version control and vary the values per environment with `-var-file`:

```bash
terraform apply -var-file="environments/production.tfvars"
```

### Where values can come from, and who wins

Terraform merges values from several sources. Precedence from lowest to highest:

1. The `default` in the declaration
2. Environment variables prefixed `TF_VAR_` (`TF_VAR_environment=staging`)
3. `terraform.tfvars`
4. `*.auto.tfvars` (alphabetical order)
5. `-var` and `-var-file` command-line flags (last one wins)

The `TF_VAR_` prefix is the whole story for environment variables: there is no function that reads arbitrary environment variables inside a configuration, by design, so values stay declared and typed. In CI this makes secrets injection clean:

```bash
export TF_VAR_db_password="$SECRET_FROM_VAULT"
terraform apply    # picked up as var.db_password, never on the command line
```

For structured inputs from files, pull them in explicitly with `file()` plus a decoder, typically in a local:

```hcl
locals {
  settings = jsondecode(file("${path.module}/settings.json"))
  # yamldecode() works the same way for YAML
}
```

## Locals: the answer to "variables within variables"

Sooner or later you try this and it fails:

```hcl
variable "bucket_name" {
  default = "${var.environment}-assets"   # error: variables can't reference variables
}
```

Variable defaults must be static. Anything derived belongs in **locals**, which exist precisely to compose values:

```hcl
locals {
  bucket_name = "${var.environment}-assets"
  common_tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_s3_bucket" "assets" {
  bucket = local.bucket_name
  tags   = local.common_tags
}
```

The division of labor is clean: variables are the module's public inputs, locals are its private computed values. If you are copying an expression between resources, it should be a local.

Maps make locals genuinely powerful, and variable keys work with the lookup syntax:

```hcl
variable "instance_types" {
  type = map(string)
  default = {
    dev        = "t3.micro"
    production = "m5.large"
  }
}

locals {
  instance_type = var.instance_types[var.environment]
  # or with a fallback:
  # instance_type = lookup(var.instance_types, var.environment, "t3.micro")
}
```

## Lists and objects: append, pick, iterate

**Appending** is `concat()`, because lists are immutable values, not mutable arrays:

```hcl
locals {
  base_rules  = ["allow-ssh", "allow-https"]
  all_rules   = concat(local.base_rules, var.extra_rules, ["deny-all"])
}
```

**Picking one object out of a list** has two idioms. When you know the position, index it. When you know an attribute, filter with a `for` expression:

```hcl
locals {
  # by attribute — returns a list, take the first match
  admin_user = [for u in var.users : u if u.role == "admin"][0]

  # safer with a length guard if the match may not exist
  admin_or_null = length([for u in var.users : u if u.role == "admin"]) > 0 ? [for u in var.users : u if u.role == "admin"][0] : null
}
```

**Iterating a list of objects** to create resources is where `count` goes wrong and `for_each` goes right. With `count`, removing the first element shifts every index and Terraform wants to destroy and recreate everything after it. Key `for_each` on a stable attribute instead:

```hcl
variable "users" {
  type = list(object({
    name = string
    role = string
  }))
}

resource "aws_iam_user" "this" {
  for_each = { for u in var.users : u.name => u }   # list -> map keyed by name
  name     = each.value.name
  tags     = { role = each.value.role }
}
```

Now `aws_iam_user.this["alice"]` survives reordering, and removing one user touches one resource.

## The for_each error everyone hits

```text
Error: Invalid for_each argument
The "for_each" set includes values derived from resource attributes that
cannot be determined until apply...
```

`for_each` keys must be **known at plan time**, because they become resource addresses in the state. Two triggers cover nearly every case:

1. **Keys derived from another resource's attributes.** `for_each = toset(aws_instance.web[*].id)` cannot work: the IDs do not exist until apply. Key on something you already know (names, the input variable itself) and reference the resource attributes in the body instead.
2. **Wrong type.** `for_each` takes a map or a set of strings, not a list. Wrap lists: `for_each = toset(var.names)`.

The fix is almost always restating the loop over input data rather than over computed results:

```hcl
# broken: keyed on computed IDs
# for_each = toset(aws_subnet.private[*].id)

# works: keyed on the same input the subnets were built from
for_each  = var.private_subnet_cidrs          # a map like { a = "10.0.1.0/24", ... }
subnet_id = aws_subnet.private[each.key].id   # computed values are fine in the BODY
```

## Outputs: counted resources, loops, and sensitive values

**With `count`**, a bare reference is an error because the resource is a list. The splat expression outputs all of them:

```hcl
output "instance_ips" {
  value = aws_instance.web[*].private_ip     # all instances
}

output "first_ip" {
  value = aws_instance.web[0].private_ip     # or one of them
}
```

**With `for_each`**, the resource is a map, so shape the output with `values()` or a `for` expression:

```hcl
output "user_arns" {
  value = { for k, u in aws_iam_user.this : k => u.arn }
}
```

The same pattern applies to [module](/posts/organize-terraform-modules-multiple-environments) outputs: a module called with `for_each` is addressed as a map, and `values(module.env)[*].vpc_id` flattens it.

**Sensitive outputs** refuse to print in `terraform output` and show as `(sensitive value)` in plans. When you legitimately need the value:

```bash
terraform output -json db_password | jq -r    # -json bypasses redaction
```

Or, inside the configuration, wrap with `nonsensitive()` when you can justify that the derived value is safe. The redaction is a guardrail against accidental shoulder-surfing and CI logs, not encryption: anyone with state access can read the value, which is one more reason state files [do not belong in git](/posts/should-i-commit-tfstate-files-to-git).

## Two errors that are not about your syntax

**`Variables may not be used here`** during `terraform init` means you used `var.*` in a place Terraform evaluates *before* variables exist: the `backend` block, `required_version`, or provider version constraints. Init happens before variable processing, full stop. The options are partial backend config (`terraform init -backend-config=backend-prod.hcl`), a wrapper like Terragrunt, or accepting the duplication. No amount of syntax will make `bucket = var.state_bucket` legal in a backend block.

**Account-specific values you did not declare.** Needing the AWS account ID everywhere tempts people to add `variable "aws_account_id"`. Do not: it is derivable, and derived beats declared because it cannot drift from reality:

```hcl
data "aws_caller_identity" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  ecr_url    = "${local.account_id}.dkr.ecr.${var.region}.amazonaws.com"
}
```

The same "ask the provider, not the operator" pattern applies to region (`data.aws_region`), partition, and the caller's ARN.

## Attribute access, and reading error messages

One final habit that makes all of the above easier to debug: Terraform references always read `RESOURCE_TYPE.NAME.ATTRIBUTE` (`aws_instance.web.private_ip`), and with `count` or `for_each` an index or key sits in the middle (`aws_instance.web[0].private_ip`, `aws_iam_user.this["alice"].arn`). When an error says an attribute does not exist, `terraform console` is the fastest truth-teller: paste the reference and it prints the actual structure, which settles nine out of ten "why is this a tuple" arguments immediately.

```terminal
{
  "title": "terraform console",
  "prompt": ">",
  "steps": [
    { "cmd": "aws_instance.web", "output": "[\n  {\n    \"id\" = \"i-0abc123\"\n    \"private_ip\" = \"10.0.1.20\"\n    ...\n  },\n]" },
    { "comment": "a counted resource is a tuple: index it" },
    { "cmd": "aws_instance.web[0].private_ip", "output": "\"10.0.1.20\"" },
    { "cmd": "{ for k, u in aws_iam_user.this : k => u.arn }", "output": "{\n  \"alice\" = \"arn:aws:iam::123456789012:user/alice\"\n}" }
  ]
}
```

## Summary

- Declare in `variables.tf`, assign in tfvars, and remember the precedence chain ends at `-var` flags.
- `TF_VAR_` is the only door for environment variables; `file()` + `jsondecode()`/`yamldecode()` is the door for file data.
- Derived values live in locals, never in variable defaults.
- `concat()` to grow lists, `for` filters to pick from them, and `for_each` keyed on stable input attributes to iterate them.
- `for_each` keys must be plan-time-known maps or string sets; loop over inputs, not over computed results.
- Splat (`[*]`) for `count` outputs, `values()`/`for` for `for_each` outputs, `-json` when you need a sensitive value on purpose.
- Backend blocks evaluate before variables exist; account IDs come from data sources, not variables.

For the expression side of the language, strings, conditionals, and type juggling, the companion guide is [Terraform Strings and Conditionals](/posts/terraform-strings-and-conditionals).
