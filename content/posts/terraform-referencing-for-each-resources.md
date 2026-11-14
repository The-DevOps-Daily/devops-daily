---
title: 'How to Reference for_each Resources in Terraform: Keys, Indexes and Import'
excerpt: 'A resource with for_each is a map of instances. Learn how to reference one instance or all of them, how to get a list index inside for_each, and how to import existing objects into for_each addresses without quoting errors.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2024-10-12'
publishedAt: '2024-10-12T09:45:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Infrastructure as Code
  - for_each
  - Import
  - Resources
  - DevOps
---

When you add `for_each` to a resource, the resource stops being one object. It becomes a map of instances, one for each key. Every reference to it changes, `terraform import` needs a key in the address, and there is no `count.index` to tell you the position. This post answers the three questions that come from that change: how to reference the instances, how to get an index, and how to import existing objects into them.

## TLDR

| Question                                    | Short answer                                                                                       |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| How do I reference one instance?            | `aws_instance.servers["web"].private_ip`                                                           |
| How do I reference all instances?           | `{ for k, s in aws_instance.servers : k => s.private_ip }` or `values(aws_instance.servers)[*].id` |
| Is there a `count.index` for `for_each`?    | No. Convert the list to a map with `{ for i, v in list : i => v }` and use `each.key`              |
| How do I import into a `for_each` resource? | An `import` block with `to = aws_instance.servers["web"]`, or `for_each` on the import block       |
| Why "Index value required" on import?       | The shell removed the quotes around the key. Quote the whole address                               |

## Prerequisites

- Terraform 1.5 or later for `import` blocks, and 1.7 or later for `for_each` inside an `import` block.
- The error messages and plan output in this post come from Terraform 1.15.8 with the built-in `terraform_data` resource, so you can repeat them without a cloud account. The AWS examples need the AWS provider and credentials.

## How Do I Reference a Resource Created With for_each?

Put the key in square brackets after the resource name, then the attribute: `<type>.<name>[<key>].<attribute>`. The key is the map key, or the string itself when `for_each` is a set.

```hcl
variable "instances" {
  type = map(object({
    instance_type = string
    ami           = string
  }))
  default = {
    web = { instance_type = "t3.medium", ami = "ami-12345678" }
    api = { instance_type = "t3.large", ami = "ami-87654321" }
  }
}

resource "aws_instance" "servers" {
  for_each = var.instances

  ami           = each.value.ami
  instance_type = each.value.instance_type

  tags = {
    Name = each.key
  }
}

output "api_private_ip" {
  value = aws_instance.servers["api"].private_ip
}
```

`aws_instance.servers` is now a map with the keys `"web"` and `"api"`. A reference without a key fails at validate time:

```text
Error: Missing resource instance key

  on main.tf line 6, in output "x":
   6:   value = terraform_data.servers.id

Because terraform_data.servers has "for_each" set, its attributes must be
accessed on specific instances.

For example, to correlate with indices of a referring resource, use:
    terraform_data.servers[each.key]
```

A key that is not in the map fails at plan time with `The given key does not identify an element in this collection value.` Keys are case sensitive, so `"Web"` and `"web"` are different instances.

### Reference All Instances

Use a `for` expression when you need an attribute from every instance. A map keeps the key next to each value, which makes outputs easier to read:

```hcl
locals {
  # list of IDs, in key order
  instance_ids = [for k, s in aws_instance.servers : s.id]

  # map of name => private IP
  private_ips = { for k, s in aws_instance.servers : k => s.private_ip }
}
```

`values(aws_instance.servers)` turns the map into a list of objects, and a splat then picks one attribute: `values(aws_instance.servers)[*].id`. A splat directly on the map (`aws_instance.servers[*].id`) does not work, because splat expressions only work on lists, sets and tuples.

### Create One Resource per Instance of Another

Pass the first resource to `for_each` of the second one. The keys stay the same, and `each.value` is the full instance object:

```hcl
resource "aws_eip" "servers" {
  for_each = aws_instance.servers

  instance = each.value.id
  domain   = "vpc"

  tags = {
    Name = "${each.key}-eip"
  }
}
```

This is also the answer when Terraform says a single attribute such as `instance` needs one ID and you passed the whole map. Either pick one key (`aws_instance.servers["web"].id`) or repeat the loop.

### Use Only Some Instances

Filter on the input data, not on the created resources. Input values are known at plan time, so you can use them in `for_each` and `count`:

```hcl
variable "instances" {
  type = map(object({
    instance_type = string
    ami           = string
    tier          = string
  }))
}

locals {
  web_keys = toset([for k, v in var.instances : k if v.tier == "web"])
}

resource "aws_lb_target_group_attachment" "web" {
  for_each = local.web_keys

  target_group_arn = aws_lb_target_group.web.arn
  target_id        = aws_instance.servers[each.key].id
  port             = 80
}
```

If you build the keys from attributes that only exist after apply, such as instance IDs, the plan fails with `Invalid for_each argument`. The [variables, loops and outputs guide](/posts/terraform-variables-loops-and-outputs#h2-the-for_each-error-everyone-hits) explains that error.

### When a Key May Not Exist

Use `try()` to get `null` instead of an error:

```hcl
output "db_ip" {
  value = try(aws_instance.servers["database"].private_ip, null)
}
```

To create something only when a key exists, test the input variable: `count = contains(keys(var.instances), "prod") ? 1 : 0`.

### Sets Have No Index

Some attributes are sets, for example `vpc_security_group_ids` on `aws_instance`. You cannot index a set with `[0]`:

```text
Error: Invalid index

  on main.tf line 10, in output "sg":
  10:   value = terraform_data.servers["web"].output.sgs[0]
    ├────────────────
    │ terraform_data.servers["web"].output.sgs is a set of string

Elements of a set are identified only by their value and don't have any
separate index or key to select with, so it's only possible to perform
operations across all elements of the set.
```

Reference the security group resource directly, or convert with `tolist()` if any element will do. `tolist()` sorts strings, so "the first element" is the first in sort order, not the one you added first.

## How Do I Get the List Index When Using for_each?

`for_each` has no index. It gives you `each.key` and `each.value`. To get a position, convert the list to a map whose keys are the positions:

```hcl
variable "availability_zones" {
  type    = list(string)
  default = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

locals {
  az_by_index = { for i, az in var.availability_zones : i => az }
  # { "0" = "us-east-1a", "1" = "us-east-1b", "2" = "us-east-1c" }
}

resource "aws_subnet" "private" {
  for_each = local.az_by_index

  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, tonumber(each.key))
  availability_zone = each.value
}
```

Map keys are always strings, so `each.key` is `"0"`, not `0`. Terraform converts it automatically where a number is required, but `tonumber(each.key)` makes the intent clear.

### Why for_each Has No Index

`for_each` exists so that an instance does not depend on its position. Here is what happens with `count` when you remove the middle item of `["web", "api", "worker"]`, run on Terraform 1.15.8:

```text
  # terraform_data.srv[1] will be updated in-place
      ~ input  = "api" -> "worker"
  # terraform_data.srv[2] will be destroyed
  # (because index [2] is out of range for count)
      - input  = "worker" -> null

Plan: 0 to add, 1 to change, 1 to destroy.
```

Terraform does not delete `api`. It changes instance `[1]` into `worker` and destroys instance `[2]`. For a real server, changing an attribute such as `ami` forces a replacement, so you lose a server that you wanted to keep. With `for_each = toset(["web", "api", "worker"])`, the same change destroys only `aws_instance.app["api"]`.

So a key made from a position, like the `az_by_index` map above, has the same problem as `count`. Prefer a key that means something:

```hcl
locals {
  # key by the AZ name, keep the position as a value
  subnets = {
    for i, az in var.availability_zones : az => {
      index = i
      cidr  = cidrsubnet(var.vpc_cidr, 8, i)
    }
  }
}

resource "aws_subnet" "private" {
  for_each = local.subnets

  vpc_id            = aws_vpc.main.id
  availability_zone = each.key
  cidr_block        = each.value.cidr

  tags = {
    Name = "private-${each.value.index + 1}"
  }
}
```

Now removing an AZ from the middle of the list removes one subnet, and the others keep their keys. Their CIDRs are still calculated from the position, though, so pin the CIDRs in the input if the list can change.

### Combine Two Lists

`zipmap()` builds a map from a list of keys and a list of values:

```hcl
locals {
  instance_types = zipmap(
    ["web-1", "web-2", "api-1"],
    ["t3.medium", "t3.medium", "t3.large"],
  )
  # { "api-1" = "t3.large", "web-1" = "t3.medium", "web-2" = "t3.medium" }
}
```

The two lists must have the same length, and a duplicate key keeps the last value. A list of objects, keyed with `{ for app in var.apps : app.name => app }`, is easier to keep correct than two lists that must stay in step.

### When count Is the Better Choice

Use `count` for N copies of the same thing that you add and remove only at the end, and for on/off switches (`count = var.enabled ? 1 : 0`). Use `for_each` for a set of different things that each need a stable address. The [resources and meta-arguments chapter](/guides/introduction-to-terraform/04-resources-and-data-sources#h3-count-and-for_each) of our Terraform guide compares them on a local project.

## How Do I Import Into a for_each Resource?

Put the key in the import address. With an `import` block (Terraform 1.5 and later) you write the address as HCL, so there are no shell quotes to get wrong:

```hcl
import {
  to = aws_instance.servers["web"]
  id = "i-1234567890abcdef0"
}
```

From Terraform 1.7, an `import` block takes `for_each`, so one block imports every instance:

```hcl
locals {
  existing = {
    web = "i-1234567890abcdef0"
    api = "i-0fedcba9876543210"
  }
}

import {
  for_each = local.existing
  to       = aws_instance.servers[each.key]
  id       = each.value
}
```

Run `terraform plan` to see the imports, then `terraform apply`. On a test with `terraform_data`, the plan shows each instance:

```text
  # terraform_data.servers["web"] will be imported
    resource "terraform_data" "servers" {
        id = "id-web"
    }

Plan: 2 to import, 0 to add, 0 to change, 0 to destroy.
```

The import blocks can stay in the code after the apply, or you can remove them. Terraform 1.16 and later also accept `import` blocks inside child modules.

### Fix "Index value required" With terraform import

The `terraform import` command still works, but the shell processes the address first. If the shell removes the double quotes, Terraform gets `aws_instance.servers[web]` and stops:

```text
Error: Index value required

  on <import-address> line 1:
   1: terraform_data.servers[web]

Index brackets must contain either a literal number or a literal string.
```

Quote the address so the double quotes reach Terraform. The Terraform documentation gives these forms:

```bash
# Linux, macOS, WSL (bash, zsh)
terraform import 'aws_instance.servers["web"]' i-1234567890abcdef0

# PowerShell
terraform import 'aws_instance.servers[\"web\"]' i-1234567890abcdef0

# Windows cmd.exe
terraform import aws_instance.servers[\"web\"] i-1234567890abcdef0
```

In a bash loop, put the variable inside escaped double quotes: `terraform import "aws_instance.servers[\"$key\"]" "$id"`. Numeric string keys need quotes too: `aws_subnet.private["0"]`.

Two other errors look similar:

- `Configuration for import target does not exist` means the address has no key, for example `aws_instance.servers`, or the key is not in the `for_each` map.
- `Invalid address ... Resource specification must include a resource type and name` means you gave only the type.

### Generate Configuration for for_each Imports

`terraform plan -generate-config-out=generated.tf` writes resource blocks for import targets that have no configuration. It does not work with instance keys:

```text
Error: Configuration for import target does not exist

The given import block is not compatible with config generation. The
-generate-config-out option cannot be used with import blocks which use
for_each, or resources which use for_each or count.
```

Generate the configuration for one plain address such as `aws_instance.imported`, copy the arguments into your `for_each` resource, and then import with keys.

### Change count to for_each Without Recreating

Use `moved` blocks instead of `terraform state mv`. They are part of the code, so the change goes through review and runs in CI like any other change:

```hcl
resource "aws_instance" "servers" {
  for_each = toset(["web", "api", "worker"])
  # ...
}

moved {
  from = aws_instance.servers[0]
  to   = aws_instance.servers["web"]
}

moved {
  from = aws_instance.servers[1]
  to   = aws_instance.servers["api"]
}

moved {
  from = aws_instance.servers[2]
  to   = aws_instance.servers["worker"]
}
```

The plan shows `(moved from aws_instance.servers[0])` next to each instance. Check that it has no destroy before you apply. The [state management chapter](/guides/introduction-to-terraform/05-state-management#h2-refactor-without-destroying-anything) of the guide covers `moved` and `removed` blocks in more detail.

After any import, run `terraform plan`. A plan with changes means your configuration does not match the real object yet. Change the code until the plan is empty.

## Related Resources

- [Terraform Variables, Loops, and Outputs](/posts/terraform-variables-loops-and-outputs) for `for` expressions, splats and outputs of counted resources.
- [Import existing objects](/guides/introduction-to-terraform/05-state-management#h2-import-existing-objects) in the Terraform guide.
- [Terraform terminal simulator](/games/terraform-terminal-simulator) to practice `plan`, `apply` and `state` commands in the browser.
- [Terraform Fundamentals Quiz](/quizzes/terraform-quiz) and [Terraform Basics flashcards](/flashcards/terraform-basics) to check what you know.
