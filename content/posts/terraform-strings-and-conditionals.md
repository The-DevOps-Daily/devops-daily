---
title: 'Terraform Strings and Conditionals: The Complete Guide'
excerpt: 'Building strings, checking substrings, ternaries, optional attributes and conditional resources, in one place.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2026-08-06'
publishedAt: '2026-08-06T10:00:00Z'
updatedAt: '2026-08-06T10:00:00Z'
readingTime: '15 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Terraform
  - HCL
  - Infrastructure as Code
  - DevOps
---

Terraform has no `if` statement. It has no `for` loop in the sense most languages mean. What it has is expressions, and once you know the handful that matter, most of the "how do I do X in Terraform" questions collapse into the same few answers.

This covers building strings, testing them, and every flavour of conditional: values, attributes, resources and data sources.

## TL;DR

- Build strings with interpolation `"${var.a}-${var.b}"`, join lists with `join(",", list)`, split them back with `split()`.
- Substring test is `strcontains(str, sub)` on Terraform 1.5 and later, `can(regex(...))` before that. `contains()` is for list membership, not substrings, and mixing them up is the most common mistake here.
- There is no if/else. There is a ternary: `condition ? a : b`. Chain them for else-if.
- `&&`, `||` and `!` are the boolean operators. They do not short-circuit the way you might expect in every context, so keep both sides valid.
- Make a resource conditional with `count = var.enabled ? 1 : 0`, and remember it becomes a list, so reference it as `resource[0]` or with `one()`.
- Make an attribute conditional with `dynamic` blocks, or set it to `null` to leave it unset.
- Handle a value that might not exist with `try()`, `coalesce()` or `lookup()`, not with a conditional.

## Prerequisites

- Terraform 1.x installed
- Familiarity with `variable`, `locals`, `resource` and `output` blocks

## Building strings

### Interpolation

The everyday case. Anything inside `${}` is evaluated and its result inserted:

```hcl
variable "environment" {
  type    = string
  default = "dev"
}

variable "app_name" {
  type    = string
  default = "checkout"
}

locals {
  bucket_name = "${var.app_name}-${var.environment}-assets"
  # checkout-dev-assets
}
```

You do not need interpolation when the whole value is a single expression. This is redundant:

```hcl
name = "${var.app_name}"   # don't
name = var.app_name        # do
```

Terraform will warn you about it, and it is the single most common thing to clean up in an inherited codebase.

### format() for anything with structure

When you are padding numbers or repeating a value, `format()` is clearer than a wall of interpolation:

```hcl
locals {
  # web-001, web-002, web-003
  instance_names = [for i in range(1, 4) : format("web-%03d", i)]

  arn = format("arn:aws:s3:::%s-%s", var.app_name, var.environment)
}
```

`formatlist()` does the same across a list, which saves a `for` expression:

```hcl
locals {
  urls = formatlist("https://%s.example.com", ["api", "web", "admin"])
  # ["https://api.example.com", "https://web.example.com", "https://admin.example.com"]
}
```

### join() and split()

`join()` turns a list into a string. It is the answer to most "convert a list to a string" questions:

```hcl
locals {
  azs = ["eu-west-1a", "eu-west-1b", "eu-west-1c"]

  az_csv   = join(",", local.azs)    # eu-west-1a,eu-west-1b,eu-west-1c
  az_lines = join("\n", local.azs)   # one per line
}
```

`split()` goes the other way, which is how you accept a comma-separated variable from CI and turn it into a real list:

```hcl
variable "subnet_ids_csv" {
  type    = string
  default = "subnet-aaa,subnet-bbb"
}

locals {
  subnet_ids = split(",", var.subnet_ids_csv)
}
```

:::warning
`split(",", "")` returns `[""]`, a list with one empty string, not an empty list. If the variable might be empty, guard it:

```hcl
subnet_ids = var.subnet_ids_csv == "" ? [] : split(",", var.subnet_ids_csv)
```
:::

For machine-readable output, `jsonencode()` beats hand-built strings every time:

```hcl
policy = jsonencode({
  Version   = "2012-10-17"
  Statement = [{ Effect = "Allow", Action = "s3:GetObject", Resource = "${local.bucket_arn}/*" }]
})
```

## Testing strings

### Does this string contain that one

On Terraform 1.5 and later there is a function for it:

```hcl
locals {
  is_prod = strcontains(var.environment, "prod")
}
```

Before 1.5, the idiom was a regex wrapped so a non-match does not error:

```hcl
locals {
  is_prod = can(regex("prod", var.environment))
}
```

Or counting matches, which reads badly but works everywhere:

```hcl
locals {
  is_prod = length(regexall("prod", var.environment)) > 0
}
```

:::note
`contains()` is not the function you want here. `contains(list, value)` tests whether a **list** holds an exact element:

```hcl
contains(["dev", "staging"], var.environment)  # list membership, correct
contains("production", "prod")                 # error, not a substring test
```

This trips people up constantly because the names are so close.
:::

### Prefixes, suffixes and case

```hcl
locals {
  is_internal = startswith(var.hostname, "internal-")
  is_backup   = endswith(var.filename, ".bak")
  normalised  = lower(trimspace(var.user_input))
}
```

`startswith` and `endswith` also arrived in 1.5. Before that: `substr(s, 0, length(prefix)) == prefix`.

## Conditionals

### There is no if, there is a ternary

```hcl
locals {
  instance_type = var.environment == "production" ? "m6i.xlarge" : "t3.micro"
}
```

Both branches must return the same type. This fails, because one branch is a string and the other a number:

```hcl
value = var.enabled ? "yes" : 0   # error
```

### Else-if is a chain

There is no `elsif`. Nest the ternaries, and format them one per line or nobody will read it:

```hcl
locals {
  instance_type = (
    var.environment == "production" ? "m6i.xlarge" :
    var.environment == "staging"    ? "t3.large"   :
    "t3.micro"
  )
}
```

Past three branches, a map lookup is clearer and easier to extend:

```hcl
locals {
  sizes = {
    production = "m6i.xlarge"
    staging    = "t3.large"
    dev        = "t3.micro"
  }
  instance_type = lookup(local.sizes, var.environment, "t3.micro")
}
```

The third argument to `lookup()` is the default, and it is what stops an unknown environment blowing up the plan.

### and, or, not

```hcl
locals {
  needs_backup   = var.environment == "production" && var.data_tier
  is_lower_env   = var.environment == "dev" || var.environment == "staging"
  skip_approval  = !var.require_approval
}
```

Terraform evaluates both sides of `&&` and `||`. Do not rely on the left side guarding the right:

```hcl
# both sides get evaluated, so this still errors when the list is empty
var.items != [] && var.items[0] == "x"

# do the safe thing instead
length(var.items) > 0 ? var.items[0] == "x" : false
```

### When the value might not exist

This is where people reach for a conditional and should not. Three better tools:

```hcl
locals {
  # first non-null, non-empty value
  region = coalesce(var.region, var.default_region, "eu-west-1")

  # map key with a fallback
  owner = lookup(var.tags, "Owner", "unassigned")

  # swallow the error from an expression that might not resolve
  vpc_id = try(data.aws_vpc.selected.id, null)
}
```

`try()` takes expressions and returns the first that evaluates without error. It is the right answer for optional nested structures:

```hcl
port = try(var.config.network.port, 8080)
```

## Conditional attributes

### Setting an attribute to null unsets it

An attribute set to `null` behaves as though you never wrote it, which means you get the provider default:

```hcl
resource "aws_instance" "app" {
  ami           = var.ami_id
  instance_type = var.instance_type

  # only set when the caller supplied one, otherwise provider default
  key_name = var.ssh_key_name != "" ? var.ssh_key_name : null
}
```

This is much cleaner than duplicating the whole resource behind a conditional.

### dynamic blocks for optional nested blocks

You cannot put a ternary around a block. You can generate zero or more of them:

```hcl
resource "aws_security_group" "app" {
  name   = "${var.app_name}-sg"
  vpc_id = var.vpc_id

  # zero blocks when the list is empty, one per entry otherwise
  dynamic "ingress" {
    for_each = var.allowed_cidrs
    content {
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      cidr_blocks = [ingress.value]
    }
  }
}
```

For a single optional block, iterate over a list that is either empty or has one element:

```hcl
dynamic "logging" {
  for_each = var.enable_logging ? [1] : []
  content {
    target_bucket = var.log_bucket
    target_prefix = "logs/"
  }
}
```

That `? [1] : []` pattern is worth committing to memory. It is how you say "this block, but only sometimes".

## Conditional resources

### count for on/off

```hcl
resource "aws_cloudwatch_log_group" "app" {
  count = var.enable_logging ? 1 : 0

  name              = "/aws/app/${var.app_name}"
  retention_in_days = 30
}
```

The catch: the resource is now a **list**, so every reference changes:

```hcl
# wrong once count is present
log_group = aws_cloudwatch_log_group.app.name

# correct, but blows up when count is 0
log_group = aws_cloudwatch_log_group.app[0].name

# safe either way, returns null when the list is empty
log_group = one(aws_cloudwatch_log_group.app[*].name)
```

`one()` takes a list of zero or one element and returns the element or `null`. It is the cleanest way to reference an optionally created resource.

### for_each when there are several

`count` gets fragile when the set changes, because resources are addressed by index and removing the middle one re-indexes everything after it. `for_each` addresses by key instead:

```hcl
resource "aws_s3_bucket" "data" {
  for_each = toset(var.bucket_names)
  bucket   = "${var.app_name}-${each.key}"
}
```

Remove a name from the middle of the list and only that bucket is destroyed. With `count`, you would have destroyed and recreated everything after it.

:::warning
`for_each` keys must be known at plan time. If you build them from an attribute of another resource that does not exist yet, you get "Invalid for_each argument: the for_each value depends on resource attributes that cannot be determined until apply". Key off your input variables instead of computed attributes.
:::

### Conditional data sources

Same `count` trick, and the same list access on the way out:

```hcl
data "aws_ami" "custom" {
  count = var.custom_ami_id == "" ? 1 : 0

  most_recent = true
  owners      = ["self"]

  filter {
    name   = "name"
    values = ["${var.app_name}-*"]
  }
}

locals {
  ami_id = var.custom_ami_id != "" ? var.custom_ami_id : one(data.aws_ami.custom[*].id)
}
```

This is the standard shape for "look it up only if the caller did not tell me".

## The mistakes worth knowing about

**Type mismatch across ternary branches.** Both sides must agree. `var.x ? "a" : null` is fine because `null` fits any type; `var.x ? "a" : 1` is not.

**Forgetting the list after adding count.** Adding `count` to an existing resource changes its address from `aws_instance.app` to `aws_instance.app[0]`, and Terraform will plan a destroy and create unless you `terraform state mv` it.

**Using contains() for substrings.** Covered above, still the most common one.

**Assuming boolean short-circuit.** Both sides evaluate. Guard with a ternary rather than relying on `&&`.

**`split()` on an empty string.** Returns `[""]`, not `[]`.

**Building JSON by hand.** Use `jsonencode()`. Hand-built JSON breaks the first time a value contains a quote.

## Wrapping up

Almost every Terraform expression question reduces to one of these: interpolate or `format()` to build a string, `join`/`split` to move between strings and lists, `strcontains` or `can(regex(...))` to test one, a ternary or a map lookup to choose a value, `null` or a `dynamic` block to make an attribute optional, and `count`/`for_each` with `one()` to make a resource optional.

The two that save the most time in practice are `try()` for values that might not exist and `one()` for resources that might not exist. Both replace a conditional that would otherwise be wrong in some edge case.

For more Terraform, we have written about [running Terraform for a specific resource only](/posts/i-would-like-to-run-terraform-only-for-a-specific-resource), [removing a resource from state](/posts/how-can-i-remove-a-resource-from-terraform-state) and [Terraform best practices](/posts/terraform-best-practices).
