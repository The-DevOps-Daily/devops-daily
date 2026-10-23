---
title: 'Terraform Configuration Language (HCL) Basics'
description: 'Learn HCL: blocks, types, references, string templates, conditionals, for expressions, dynamic blocks and functions, tested in terraform console.'
order: 3
---

**TLDR**: Terraform code is written in HCL, the HashiCorp Configuration Language. A file is a list of **blocks** (`resource`, `variable`, `output`, `locals` and so on) that contain **arguments** (`name = value`). Values have types (string, number, bool, list, set, map, object, tuple), you refer to other objects with addresses like `var.region` or `aws_vpc.main.id`, and you compute values with operators, conditionals, `for` expressions and built-in functions. `terraform console` lets you try any expression before you put it in code.

You do not need to be a programmer to write Terraform, but you do need to read HCL fluently. This part covers the syntax you see in every configuration, and every expression output below comes from a real `terraform console` session with Terraform 1.17.

## Prerequisites

- Terraform installed ([Part 2](/guides/introduction-to-terraform/02-installation-and-setup)).
- An empty directory to experiment in. No cloud account is needed.

## Files and Directories

Terraform reads every file ending in `.tf` (or `.tf.json`, the same language in JSON form) in the **current directory** and treats them as one configuration. The order of files and of blocks inside them does not matter, and subdirectories are ignored unless you call them as [modules](/guides/introduction-to-terraform/07-modules). A few other file types have special meaning:

| File                                | Purpose                                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `*.tf`, `*.tf.json`                 | Configuration                                                                                                       |
| `terraform.tfvars`, `*.auto.tfvars` | Variable values, loaded automatically ([Part 6](/guides/introduction-to-terraform/06-variables-and-outputs))        |
| `*.tftest.hcl`                      | Tests for `terraform test` ([Part 10](/guides/introduction-to-terraform/10-best-practices-and-production-patterns)) |
| `.terraform.lock.hcl`               | Provider versions and checksums, written by `init`                                                                  |
| `override.tf`, `*_override.tf`      | Merged over the other files; rarely a good idea, because readers miss them                                          |

A common layout splits a small project into `main.tf`, `variables.tf`, `outputs.tf`, `providers.tf` and `versions.tf`. That is a convention for humans; Terraform does not care. The post [How to Split a Terraform File](/posts/how-to-split-terraform-file) shows the options.

## Blocks and Arguments

```hcl
# Block type "resource" with two labels: the resource type and a local name
resource "aws_instance" "web" {
  # Arguments: name = expression
  ami           = var.ami_id
  instance_type = "t3.micro"

  # A nested block
  root_block_device {
    volume_size = 20
  }

  # An argument whose value is a map
  tags = {
    Name = "web-server"
  }
}
```

- A **block** has a type (`resource`), zero or more labels (`"aws_instance"`, `"web"`) and a body in braces. Nested blocks such as `root_block_device` use the same syntax without `=`.
- An **argument** assigns the value of an expression to a name. Each argument appears once per block.
- **Identifiers** (names of arguments, blocks, variables) contain letters, digits, underscores and hyphens and do not start with a digit.
- **Comments**: `#` and `//` start a single-line comment, `/* ... */` spans lines. `#` is the idiomatic choice.

`terraform fmt` aligns the `=` signs, fixes indentation (two spaces) and normalizes spacing. Run it before every commit; `terraform fmt -check` fails in CI when a file needs formatting.

The top-level block types are:

| Block                           | Example                                             | Covered in                                                                                                                                                        |
| ------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `terraform`                     | `required_version`, `required_providers`, `backend` | [Part 2](/guides/introduction-to-terraform/02-installation-and-setup), [Part 9](/guides/introduction-to-terraform/09-remote-backends-and-collaboration)           |
| `provider`                      | `provider "aws" { region = "eu-west-1" }`           | [Part 4](/guides/introduction-to-terraform/04-resources-and-data-sources)                                                                                         |
| `resource`, `data`, `ephemeral` | infrastructure objects, lookups, temporary values   | [Part 4](/guides/introduction-to-terraform/04-resources-and-data-sources), [Part 10](/guides/introduction-to-terraform/10-best-practices-and-production-patterns) |
| `variable`, `output`, `locals`  | inputs, results, named expressions                  | [Part 6](/guides/introduction-to-terraform/06-variables-and-outputs)                                                                                              |
| `module`                        | reusable groups of resources                        | [Part 7](/guides/introduction-to-terraform/07-modules)                                                                                                            |
| `moved`, `import`, `removed`    | refactoring and adopting existing objects           | [Part 5](/guides/introduction-to-terraform/05-state-management)                                                                                                   |
| `check`, `action`               | assertions after apply, provider-defined operations | [Part 10](/guides/introduction-to-terraform/10-best-practices-and-production-patterns), [Part 4](/guides/introduction-to-terraform/04-resources-and-data-sources) |

## A Playground With terraform console

`terraform console` evaluates expressions against your configuration. Create a directory with this `main.tf`. It declares one provider, two variables and some local values, and creates nothing:

```hcl
terraform {
  required_providers {
    local = {
      source  = "hashicorp/local"
      version = "~> 2.9"
    }
  }
}

variable "environment" {
  type    = string
  default = "staging"
}

variable "servers" {
  type = map(object({
    size = string
    zone = string
  }))
  default = {
    "web-1" = { size = "small", zone = "a" }
    "web-2" = { size = "small", zone = "b" }
    "db-1"  = { size = "large", zone = "a" }
  }
}

locals {
  name_prefix = "shop-${var.environment}"
  ports       = [80, 443, 8080]
}
```

Run `terraform init` once (the provider is used for one example below), then start the console. Each line you type at the `>` prompt is evaluated and the result printed. Type `exit` or press Ctrl+D to leave.

```terminal
{
  "title": "terraform console",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "terraform console"
    },
    {
      "prompt": ">",
      "cmd": "local.name_prefix",
      "output": "\"shop-staging\""
    },
    {
      "prompt": ">",
      "cmd": "var.servers[\"db-1\"]",
      "output": "{\n  \"size\" = \"large\"\n  \"zone\" = \"a\"\n}"
    },
    {
      "prompt": ">",
      "cmd": "var.servers[\"db-1\"].size",
      "output": "\"large\""
    },
    {
      "prompt": ">",
      "cmd": "local.ports[0]",
      "output": "80"
    }
  ]
}
```

## Types and Values

Every value has a type. Terraform converts between compatible types automatically (the string `"8080"` becomes a number where a number is expected), and errors out on everything else.

| Type            | Example                          | Notes                                                 |
| --------------- | -------------------------------- | ----------------------------------------------------- |
| `string`        | `"t3.micro"`                     | Double quotes only. Escapes: `\n`, `\t`, `\"`, `\\`   |
| `number`        | `20`, `0.5`                      | One numeric type for integers and decimals            |
| `bool`          | `true`, `false`                  |                                                       |
| `list(...)`     | `["a", "b"]`                     | Ordered, indexed from 0, values of one type           |
| `set(...)`      | `toset(["a", "b"])`              | Unordered, no duplicates; you cannot index it         |
| `map(...)`      | `{ Name = "web", Env = "dev" }`  | Keys are strings, values of one type                  |
| `object({...})` | `{ size = "small", zone = "a" }` | Fixed attribute names, each with its own type         |
| `tuple([...])`  | `["web", 2, true]`               | Fixed length, each element with its own type          |
| `null`          | `null`                           | "Not set": the argument behaves as if you left it out |

You write `list(string)`, `map(number)` or `object({ name = string, port = number })` in **type constraints** on variables, covered in [Part 6](/guides/introduction-to-terraform/06-variables-and-outputs). Literal values in code are tuples and objects, which convert to lists and maps when the context asks for them.

One more kind of value matters later: **unknown** values. An attribute that only exists after creation, such as a new server's IP address, is unknown during the plan and shows as `(known after apply)`. Most expressions accept unknown values, but a few places, such as `count` and `for_each`, need values Terraform knows at plan time.

## References

You refer to other objects by address:

| Expression                                      | Refers to                                                                                                      |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `var.<name>`                                    | an input variable                                                                                              |
| `local.<name>`                                  | a local value                                                                                                  |
| `<type>.<name>.<attribute>`                     | a managed resource, for example `aws_vpc.main.id`                                                              |
| `data.<type>.<name>.<attribute>`                | a data source, for example `data.aws_ami.ubuntu.id`                                                            |
| `module.<name>.<output>`                        | an output of a child module                                                                                    |
| `path.module`, `path.root`, `path.cwd`          | the module's directory, the root module's directory, the working directory                                     |
| `terraform.workspace`                           | the current workspace name ([Part 8](/guides/introduction-to-terraform/08-working-with-multiple-environments)) |
| `count.index`, `each.key`, `each.value`, `self` | only inside resources that use `count`, `for_each` or provisioners                                             |

A reference also creates a dependency: if `aws_subnet.public` refers to `aws_vpc.main.id`, Terraform creates the VPC first.

## Strings and Templates

`${...}` inserts the result of an expression into a string. `%{ ... }` adds `if` and `for` directives:

```terminal
{
  "title": "string templates",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": ">",
      "cmd": "\"${local.name_prefix}-web-${2 + 1}\"",
      "output": "\"shop-staging-web-3\""
    },
    {
      "prompt": ">",
      "cmd": "\"Ports: %{ for p in local.ports }${p} %{ endfor }\"",
      "output": "\"Ports: 80 443 8080 \""
    },
    {
      "prompt": ">",
      "cmd": "\"Mode: %{ if var.environment == \"prod\" }strict%{ else }relaxed%{ endif }\"",
      "output": "\"Mode: relaxed\""
    }
  ]
}
```

A reference on its own needs no quotes: write `subnet_id = aws_subnet.public.id`, not `"${aws_subnet.public.id}"`. The quoted form still works, but it is a leftover from Terraform 0.11.

For multi-line text, use a **heredoc**. The `<<-` form strips the indentation, so the text can follow your code's indentation:

```hcl
locals {
  user_data = <<-EOT
    #!/bin/bash
    apt-get update
    apt-get install -y nginx
  EOT
}
```

For anything longer than a few lines, put the text in a separate template file and render it with `templatefile()` (shown below).

## Operators and Conditionals

Arithmetic (`+ - * / %`), comparison (`== != < > <= >=`) and logic (`&& || !`) work as in most languages. The conditional expression is `condition ? value_if_true : value_if_false`:

```terminal
{
  "title": "operators and conditionals",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": ">",
      "cmd": "var.environment == \"prod\" ? \"t3.large\" : \"t3.micro\"",
      "output": "\"t3.micro\""
    },
    {
      "prompt": ">",
      "cmd": "length(local.ports) > 2 && var.environment != \"dev\"",
      "output": "true"
    },
    {
      "prompt": ">",
      "cmd": "7 % 3",
      "output": "1"
    }
  ]
}
```

Both results of a conditional must have compatible types. `var.enabled ? 1 : 0` is the classic way to create a resource only sometimes (`count = var.enabled ? 1 : 0`), shown in [Part 4](/guides/introduction-to-terraform/04-resources-and-data-sources).

## for Expressions and Splats

A `for` expression builds a new list (in `[ ]`) or map (in `{ }`) from another collection, with an optional `if` filter:

```terminal
{
  "title": "for expressions",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": ">",
      "cmd": "[for p in local.ports : \"port-${p}\"]",
      "output": "[\n  \"port-80\",\n  \"port-443\",\n  \"port-8080\",\n]"
    },
    {
      "prompt": ">",
      "cmd": "{ for name, s in var.servers : name => s.zone }",
      "output": "{\n  \"db-1\" = \"a\"\n  \"web-1\" = \"a\"\n  \"web-2\" = \"b\"\n}"
    },
    {
      "prompt": ">",
      "cmd": "[for name, s in var.servers : name if s.size == \"small\"]",
      "output": "[\n  \"web-1\",\n  \"web-2\",\n]"
    },
    {
      "prompt": ">",
      "cmd": "{ for name, s in var.servers : s.zone => name... }",
      "output": "{\n  \"a\" = [\n    \"db-1\",\n    \"web-1\",\n  ]\n  \"b\" = [\n    \"web-2\",\n  ]\n}"
    },
    {
      "prompt": ">",
      "cmd": "values(var.servers)[*].size",
      "output": "tolist([\n  \"large\",\n  \"small\",\n  \"small\",\n])"
    }
  ]
}
```

- Iterating over a map gives you the key and the value (`name, s`). Map keys come out in lexical order, which is why `db-1` is first.
- The `...` after the value in the fourth expression **groups** values with the same key into a list. Without it, two servers in zone `a` would be an error.
- `[*]` is a **splat**: `list[*].attr` is short for `[for x in list : x.attr]`. You see it often with `count`, for example `aws_instance.web[*].id`.
- The console writes `tolist([...])` when a value is a real list, as opposed to the tuple that a `[ ]` literal or a `for` expression produces. In code you rarely have to care: Terraform converts between the two.

## Built-in Functions

Terraform has more than a hundred built-in functions, grouped into string, numeric, collection, encoding, filesystem, date and time, hash and crypto, IP network, and type conversion functions. You cannot write your own in plain HCL, but providers can ship extra ones (below). These are the ones you use most:

```terminal
{
  "title": "common functions",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": ">",
      "cmd": "upper(var.environment)",
      "output": "\"STAGING\""
    },
    {
      "prompt": ">",
      "cmd": "format(\"%s-%03d\", \"web\", 7)",
      "output": "\"web-007\""
    },
    {
      "prompt": ">",
      "cmd": "join(\",\", local.ports)",
      "output": "\"80,443,8080\""
    },
    {
      "prompt": ">",
      "cmd": "split(\"-\", \"web-app-server\")",
      "output": "tolist([\n  \"web\",\n  \"app\",\n  \"server\",\n])"
    },
    {
      "prompt": ">",
      "cmd": "merge({ Team = \"platform\" }, { Env = var.environment })",
      "output": "{\n  \"Env\" = \"staging\"\n  \"Team\" = \"platform\"\n}"
    },
    {
      "prompt": ">",
      "cmd": "concat([\"a\", \"b\"], [\"c\"])",
      "output": "[\n  \"a\",\n  \"b\",\n  \"c\",\n]"
    },
    {
      "prompt": ">",
      "cmd": "contains(keys(var.servers), \"web-2\")",
      "output": "true"
    },
    {
      "prompt": ">",
      "cmd": "try(var.servers[\"web-9\"].size, \"none\")",
      "output": "\"none\""
    },
    {
      "prompt": ">",
      "cmd": "cidrsubnet(\"10.0.0.0/16\", 8, 2)",
      "output": "\"10.0.2.0/24\""
    },
    {
      "prompt": ">",
      "cmd": "cidrsubnets(\"10.0.0.0/16\", 8, 8, 4)",
      "output": "tolist([\n  \"10.0.0.0/24\",\n  \"10.0.1.0/24\",\n  \"10.0.16.0/20\",\n])"
    },
    {
      "prompt": ">",
      "cmd": "jsonencode({ name = \"web\", ports = local.ports })",
      "output": "\"{\\\"name\\\":\\\"web\\\",\\\"ports\\\":[80,443,8080]}\""
    },
    {
      "prompt": ">",
      "cmd": "yamldecode(\"replicas: 3\\nzones: [a, b]\")",
      "output": "{\n  \"replicas\" = 3\n  \"zones\" = [\n    \"a\",\n    \"b\",\n  ]\n}"
    }
  ]
}
```

Some notes on these:

- `merge` combines maps; later maps win on duplicate keys. It is how you add resource-specific tags to a set of common tags.
- `try` returns the first argument that does not produce an error. Use it for optional attributes, not to hide real mistakes. Its sibling `can` returns `true` or `false` and is useful in [variable validation](/guides/introduction-to-terraform/06-variables-and-outputs#h2-validate-input).
- `cidrsubnet(prefix, newbits, netnum)` carves subnets out of a network: 8 extra bits turn a `/16` into `/24`s, and `netnum` picks which one. `cidrsubnets` allocates several consecutive ranges of different sizes at once, here two `/24`s and then a `/20` that starts at the next free `/20` boundary.
- `lookup(map, key, default)` still exists, but `var.map[key]` or `try(var.map[key], default)` reads better. The concatenation of lists is covered in more detail in [How to Concatenate Lists in Terraform](/posts/terraform-concatenate-lists-concat-function).

### Rendering Template Files

`templatefile(path, vars)` reads a file and renders it with the variables you pass. The template can use `${...}` and `%{ for }` directives:

```text
server {
    listen 80;
    server_name ${domain};
%{ for port in backend_ports ~}
    # backend on port ${port}
%{ endfor ~}
}
```

The `~` in `%{ for ... ~}` strips the newline after the directive, so the output has no blank lines where the directives were:

```terminal
{
  "title": "templatefile",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": ">",
      "cmd": "templatefile(\"${path.module}/nginx.conf.tftpl\", { domain = \"shop.example.com\", backend_ports = [8080, 8081] })",
      "output": "<<EOT\nserver {\n    listen 80;\n    server_name shop.example.com;\n    # backend on port 8080\n    # backend on port 8081\n}\n\nEOT"
    }
  ]
}
```

Name template files `*.tftpl` so editors recognize them. Use `templatefile` for user data scripts, configuration files and policy documents, and `jsonencode` or `yamlencode` when the output is JSON or YAML: building JSON by string concatenation breaks on the first quote in a value.

### Provider-Defined Functions

Since Terraform 1.8, providers can ship their own functions. You call them with `provider::<provider name>::<function>` and the provider must be in `required_providers`. The `local` provider has `direxists`:

```terminal
{
  "title": "a provider-defined function",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": ">",
      "cmd": "provider::local::direxists(path.module)",
      "output": "true"
    }
  ]
}
```

Bigger providers ship more useful ones, for example `provider::aws::arn_parse()` and `provider::aws::arn_build()` in the AWS provider.

## Dynamic Blocks

Some resources take repeated nested blocks. A `dynamic` block generates them from a collection:

```hcl
variable "ingress_ports" {
  type    = list(number)
  default = [80, 443]
}

resource "aws_security_group" "web" {
  name   = "web-sg"
  vpc_id = var.vpc_id

  dynamic "ingress" {
    for_each = var.ingress_ports
    content {
      description = "Allow TCP ${ingress.value}"
      from_port   = ingress.value
      to_port     = ingress.value
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

The label of the `dynamic` block (`ingress`) is the name of the nested block to generate, and inside `content` the iterator has the same name: `ingress.value` is the current element (and `ingress.key` its index or map key). Use dynamic blocks sparingly: a plain list of nested blocks is easier to read when the number of items is fixed.

For AWS security groups specifically, the provider now recommends one resource per rule (`aws_vpc_security_group_ingress_rule` and `aws_vpc_security_group_egress_rule`) over inline `ingress` and `egress` blocks, because inline rules and separate rule resources fight each other. You create those with `for_each`, shown in [Part 4](/guides/introduction-to-terraform/04-resources-and-data-sources#h2-a-web-server-on-aws).

## Common Mistakes

The console reports errors the same way `plan` does, which makes it a quick way to understand them:

```terminal
{
  "title": "two common errors",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": ">",
      "cmd": "\"web-\" + 1",
      "output": "╷\n│ Error: Invalid operand\n│\n│   on <console-input> line 1:\n│   (source code not available)\n│\n│ Unsuitable value for left operand: a number is required.\n╵"
    },
    {
      "prompt": ">",
      "cmd": "var.servers[\"web-9\"].size",
      "output": "╷\n│ Error: Invalid index\n│\n│   on <console-input> line 1:\n│   (source code not available)\n│\n│ The given key does not identify an element in this collection value.\n╵"
    }
  ]
}
```

- **Using `+` to join strings.** `+` is only for numbers. Use a template: `"web-${count.index}"`.
- **Reading a key that may not exist.** Indexing a map with a missing key is an error. Use `try()` or check with `contains(keys(...), key)`.
- **Single quotes.** HCL strings use double quotes only.
- **Mixing up lists and sets.** `for_each` needs a set or a map, so wrap a list in `toset()`. You cannot index a set with `[0]`.
- **Building JSON or YAML with string templates.** Use `jsonencode` and `yamlencode`.

## Summary

- HCL is blocks with labels and arguments; `terraform fmt` keeps the style consistent.
- Values have types, and some values are unknown until apply.
- References such as `var.x`, `local.y` and `aws_vpc.main.id` connect blocks and define the order.
- Templates, conditionals, `for` expressions, splats and functions compute values; `terraform console` is the place to try them.
- `dynamic` blocks generate repeated nested blocks from a collection.

In [Part 4](/guides/introduction-to-terraform/04-resources-and-data-sources) you use this language to create real resources.

## Keep Learning

- [Terraform Strings and Conditionals: The Complete Guide](/posts/terraform-strings-and-conditionals)
- [Terraform Variables, Loops, and Outputs: The Complete Guide](/posts/terraform-variables-loops-and-outputs)
- [How to Get the Current Working Directory in Terraform](/posts/get-current-working-directory-terraform)
- [Terraform Fundamentals Quiz](/quizzes/terraform-quiz)
