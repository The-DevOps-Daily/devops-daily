---
title: 'Terraform Variables and Outputs'
description: 'Declare Terraform variables with types, defaults and validation, set them with tfvars files, -var or TF_VAR_ variables, and read outputs as text or JSON.'
order: 6
---

**TLDR**: Input variables (`variable` blocks) make a configuration reusable: you declare a type, an optional default and validation rules, and set values with `-var`, `-var-file`, `terraform.tfvars`, `*.auto.tfvars` or `TF_VAR_` environment variables. When several sources set the same variable, the command line wins, then `*.auto.tfvars`, then `terraform.tfvars`, then environment variables, then the default. Local values (`locals`) name expressions you use more than once. Outputs (`output` blocks) expose results to people, scripts and other modules; `terraform output -json` and `-raw` are made for scripts.

Variables, locals and outputs are the interface of every Terraform configuration and every module. Getting them right is what makes code reusable across environments and safe to hand to other people. Every output below comes from real Terraform 1.17 runs.

## Prerequisites

- Terraform installed ([Part 2](/guides/introduction-to-terraform/02-installation-and-setup)) and the HCL types from [Part 3](/guides/introduction-to-terraform/03-configuration-language-basics#h2-types-and-values).
- No cloud account for the examples; the AWS example at the end is optional.

## Declare Input Variables

A `variable` block declares an input. All of its arguments are optional, but a good variable has at least a description and a type. The examples in this part live in a new directory, `variables`, starting with this `variables.tf`:

```hcl
variable "environment" {
  description = "Deployment environment: dev, staging or prod"
  type        = string
  default     = "dev"
}

variable "replicas" {
  description = "Number of application instances"
  type        = number
  default     = 1
}

variable "site" {
  description = "The public site this environment serves"
  type = object({
    domain    = string
    port      = optional(number, 443)
    redirects = optional(list(string), [])
  })
}

variable "db_password" {
  description = "Database password, passed in from a secret store"
  type        = string
  sensitive   = true
}
```

- **`type`** rejects wrong values early: `"three"` for a `number` fails before anything else runs. Without a type, any value is accepted, and errors show up later in confusing places.
- **`default`** makes the variable optional. A variable without a default is **required**.
- **`optional(type, default)`** inside an `object` type lets callers leave attributes out. Here `site` only needs a `domain`.
- **`sensitive = true`** hides the value in plan and apply output. It does not encrypt it, and the value can still end up in the state.
- **`nullable = false`** (not shown) rejects an explicit `null`, so the default is used instead.

The configuration uses them through `var.<name>`:

```hcl
locals {
  name_prefix = "shop-${var.environment}"
  all_domains = concat([var.site.domain], var.site.redirects)
}

resource "local_file" "nginx" {
  filename = "${path.module}/out/${local.name_prefix}.conf"
  content  = <<-EOT
    # ${local.name_prefix}: ${var.replicas} replica(s)
    server {
        listen ${var.site.port} ssl;
        server_name ${join(" ", local.all_domains)};
    }
  EOT
}

resource "local_sensitive_file" "db" {
  filename = "${path.module}/out/${local.name_prefix}-db.env"
  content  = "DB_PASSWORD=${var.db_password}\n"
}
```

**Locals** are named expressions inside one module. Use them for values you compute once and use in several places (a name prefix, a merged tag map), and keep variables for things the caller must be able to change. A local cannot be set from outside.

## Set Variable Values

Run `terraform init` in the directory first. Then try a plan: a required variable without a value stops the run. With `-input=false` (as in CI) Terraform fails immediately; in a terminal it asks you to type the value:

```terminal
{
  "title": "a required variable without a value",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform plan -input=false",
      "output": "╷\n│ Error: No value for required variable\n│\n│   on variables.tf line 13:\n│   13: variable \"site\" {\n│\n│ The root module input variable \"site\" is not set, and has no default value.\n│ Use a -var or -var-file command line argument to provide a value for this\n│ variable.\n╵\n╷\n│ Error: No value for required variable\n│\n│   on variables.tf line 22:\n│   22: variable \"db_password\" {\n│\n│ The root module input variable \"db_password\" is not set, and has no default\n│ value. Use a -var or -var-file command line argument to provide a value for\n│ this variable.\n╵"
    }
  ]
}
```

You can set values in five ways:

```tabs
{
  "title": "Five ways to set a variable",
  "tabs": [
    {
      "label": "-var",
      "lang": "bash",
      "code": "terraform apply -var 'replicas=3' -var 'site={ domain = \"shop.example.com\" }'"
    },
    {
      "label": "-var-file",
      "lang": "bash",
      "code": "# Any file name; load it explicitly\nterraform apply -var-file=env/prod.tfvars"
    },
    {
      "label": "terraform.tfvars",
      "lang": "hcl",
      "code": "# Loaded automatically from the working directory\nenvironment = \"staging\"\nreplicas    = 2\n\nsite = {\n  domain    = \"staging.shop.example.com\"\n  redirects = [\"www.staging.shop.example.com\"]\n}"
    },
    {
      "label": "*.auto.tfvars",
      "lang": "hcl",
      "code": "# Every file named *.auto.tfvars (or *.auto.tfvars.json) is also loaded automatically\nreplicas = 2"
    },
    {
      "label": "TF_VAR_ env",
      "lang": "bash",
      "code": "# TF_VAR_<variable name>; good for secrets in CI\nexport TF_VAR_db_password=\"$(vault kv get -field=password secret/shop/db)\"\nterraform apply"
    }
  ]
}
```

`.tfvars` files use the same syntax as HCL arguments. Use `-var-file` with one file per environment (`env/dev.tfvars`, `env/prod.tfvars`), keep secrets out of them, and commit an `example.tfvars` that documents what is needed.

### Which Value Wins

When the same variable is set in several places, Terraform applies them in a fixed order, and **later sources override earlier ones**. This small project shows each step. It has one variable, `color`, with the default `"from-default"`:

```terminal
{
  "title": "variable precedence, lowest to highest",
  "prompt": "$",
  "steps": [
    {
      "cmd": "echo 'var.color' | terraform console",
      "output": "\"from-default\""
    },
    {
      "cmd": "export TF_VAR_color=from-env\necho 'var.color' | terraform console",
      "output": "\"from-env\""
    },
    {
      "cmd": "echo 'color = \"from-terraform-tfvars\"' > terraform.tfvars\necho 'var.color' | terraform console",
      "output": "\"from-terraform-tfvars\""
    },
    {
      "cmd": "echo 'color = \"from-auto-tfvars\"' > colors.auto.tfvars\necho 'var.color' | terraform console",
      "output": "\"from-auto-tfvars\""
    },
    {
      "cmd": "echo 'color = \"from-var-file\"' > custom.tfvars\necho 'var.color' | terraform console -var-file=custom.tfvars",
      "output": "\"from-var-file\""
    },
    {
      "cmd": "echo 'var.color' | terraform console -var-file=custom.tfvars -var color=from-cli",
      "output": "\"from-cli\""
    },
    {
      "cmd": "echo 'var.color' | terraform console -var color=from-cli -var-file=custom.tfvars",
      "output": "\"from-var-file\""
    }
  ]
}
```

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "default", "sub": "in the variable block", "tone": "slate" },
    { "label": "TF_VAR_ env", "sub": "environment", "tone": "slate" },
    { "label": "terraform.tfvars", "sub": "then .tfvars.json", "tone": "blue" },
    { "label": "*.auto.tfvars", "sub": "alphabetical", "tone": "blue" },
    { "label": "-var / -var-file", "sub": "in command-line order", "tone": "accent" }
  ]
}
```

The last two runs show the rule for the command line: `-var` and `-var-file` are processed in the order you type them, so the last one wins. Environment variables have the **lowest** priority of the explicit sources, which surprises people who expect an exported variable to override a file. If a `TF_VAR_` value seems to be ignored, look for a `.tfvars` file that sets the same variable.

## Validate Input

A `validation` block checks a value before Terraform plans anything. `condition` must be true; otherwise the run stops with your `error_message`. A variable can have several validation blocks, and since Terraform 1.9 a condition may refer to other variables:

```hcl
variable "max_replicas" {
  description = "Upper limit for autoscaling"
  type        = number
  default     = 4

  validation {
    condition     = var.max_replicas >= var.replicas
    error_message = "max_replicas (${var.max_replicas}) must not be lower than replicas (${var.replicas})."
  }
}

check "environment_name" {
  assert {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Unexpected environment ${var.environment}."
  }
}
```

Add the same kind of rule to `environment` in `variables.tf`:

```hcl
variable "environment" {
  description = "Deployment environment: dev, staging or prod"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging or prod."
  }
}
```

Then try some bad values:

```terminal
{
  "title": "validation errors",
  "prompt": "$",
  "steps": [
    {
      "cmd": "export TF_VAR_db_password=not-a-real-secret"
    },
    {
      "cmd": "terraform plan -var 'site={ domain = \"shop.example.com\" }' -var environment=production",
      "output": "Planning failed. Terraform encountered an error while generating this plan.\n\n╷\n│ Error: Invalid value for variable\n│\n│   on variables.tf line 1:\n│    1: variable \"environment\" {\n│     ├────────────────\n│     │ var.environment is \"production\"\n│\n│ environment must be dev, staging or prod.\n│\n│ This was checked by the validation rule at variables.tf:6,3-13.\n╵"
    },
    {
      "cmd": "terraform plan -var 'site={ domain = \"shop.example.com\" }' -var replicas=6",
      "output": "╷\n│ Error: Invalid value for variable\n│\n│   on validation.tf line 1:\n│    1: variable \"max_replicas\" {\n│     ├────────────────\n│     │ var.max_replicas is 4\n│     │ var.replicas is 6\n│\n│ max_replicas (4) must not be lower than replicas (6).\n│\n│ This was checked by the validation rule at validation.tf:6,3-13.\n╵"
    }
  ]
}
```

The first rule fails before planning starts. The second one refers to another variable, so Terraform checks it while it plans; the plan is printed (cut here) and then the run fails with the same kind of error, so nothing can be applied.

Useful conditions: `contains([...], var.x)` for allowed values, `can(regex("^[a-z0-9-]+$", var.name))` for formats, `can(cidrhost(var.cidr, 0))` for CIDR blocks, `length(var.list) > 0` for non-empty lists, and `alltrue([for p in var.ports : p > 0 && p < 65536])` for every element of a list.

The `check` block in the same file is different: its assertion runs at the end of every plan and apply and only **warns**. Use checks for things you want to know about without blocking the run, such as a certificate that expires soon or an endpoint that does not answer ([Part 10](/guides/introduction-to-terraform/10-best-practices-and-production-patterns#h3-check-blocks)).

## Sensitive Values

Apply with valid values:

```hcl
environment = "staging"
replicas    = 2

site = {
  domain    = "staging.shop.example.com"
  redirects = ["www.staging.shop.example.com"]
}
```

```terminal
{
  "title": "plan with a sensitive variable",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "terraform plan -no-color | sed -n '/local_sensitive_file.db will be created/,/^    }/p'",
      "output": "  # local_sensitive_file.db will be created\n  + resource \"local_sensitive_file\" \"db\" {\n      + content              = (sensitive value)\n      + content_base64sha256 = (known after apply)\n      + content_base64sha512 = (known after apply)\n      + content_md5          = (known after apply)\n      + content_sha1         = (known after apply)\n      + content_sha256       = (known after apply)\n      + content_sha512       = (known after apply)\n      + directory_permission = \"0700\"\n      + file_permission      = \"0700\"\n      + filename             = \"./out/shop-staging-db.env\"\n      + id                   = (known after apply)\n    }"
    },
    {
      "cmd": "terraform apply -auto-approve",
      "output": "Apply complete! Resources: 2 added, 0 changed, 0 destroyed."
    },
    {
      "cmd": "cat out/shop-staging.conf",
      "output": "# shop-staging: 2 replica(s)\nserver {\n    listen 443 ssl;\n    server_name staging.shop.example.com www.staging.shop.example.com;\n}"
    }
  ]
}
```

Terraform also **propagates** sensitivity: anything computed from a sensitive value is sensitive too. If you try to output it without saying so, the plan fails:

```terminal
{
  "title": "an output that leaks a sensitive value",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform plan",
      "output": "╷\n│ Error: Output refers to sensitive values\n│\n│   on outputs.tf line 1:\n│    1: output \"db_env\" {\n│\n│ To reduce the risk of accidentally exporting sensitive data that was\n│ intended to be only internal, Terraform requires that any root module\n│ output containing sensitive data be explicitly marked as sensitive, to\n│ confirm your intent.\n│\n│ If you do intend to export this data, annotate the output value as\n│ sensitive by adding the following argument:\n│     sensitive = true\n╵"
    }
  ]
}
```

The fix is to mark the output `sensitive = true` as well, or, better, not to output secrets at all.

## Outputs

Replace `outputs.tf` with useful outputs:

```hcl
output "config_file" {
  description = "Path of the generated Nginx configuration"
  value       = local_file.nginx.filename
}

output "domains" {
  description = "Every domain the site answers on"
  value       = local.all_domains
}

output "site_port" {
  description = "HTTPS port"
  type        = number
  value       = var.site.port
}

output "db_env_file" {
  description = "Environment file with the database password"
  value       = local_sensitive_file.db.filename
}
```

```terminal
{
  "title": "reading outputs",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform apply -auto-approve",
      "output": "Apply complete! Resources: 0 added, 0 changed, 0 destroyed.\n\nOutputs:\n\nconfig_file = \"./out/shop-staging.conf\"\ndb_env_file = \"./out/shop-staging-db.env\"\ndomains = [\n  \"staging.shop.example.com\",\n  \"www.staging.shop.example.com\",\n]\nsite_port = 443"
    },
    {
      "cmd": "terraform output domains",
      "output": "[\n  \"staging.shop.example.com\",\n  \"www.staging.shop.example.com\",\n]"
    },
    {
      "cmd": "terraform output -raw config_file",
      "output": "./out/shop-staging.conf"
    },
    {
      "cmd": "terraform output -json | jq -c 'map_values(.value)'",
      "output": "{\"config_file\":\"./out/shop-staging.conf\",\"db_env_file\":\"./out/shop-staging-db.env\",\"domains\":[\"staging.shop.example.com\",\"www.staging.shop.example.com\"],\"site_port\":443}"
    }
  ]
}
```

- `terraform output` prints all outputs; `terraform output NAME` prints one in HCL syntax.
- `-raw` prints a string without quotes, for shell scripts: `ssh ubuntu@$(terraform output -raw public_ip)`.
- `-json` prints every output with its type and sensitivity. Sensitive outputs are shown in full in JSON, so be careful where you send it.
- An output can have a `type` constraint since Terraform 1.15, as `site_port` does. Outputs can also have `precondition` blocks and `depends_on`.

Outputs are also how a module returns values to its caller (`module.network.vpc_id`) and how one configuration reads another's results through the `terraform_remote_state` data source ([Part 8](/guides/introduction-to-terraform/08-working-with-multiple-environments#h2-share-data-between-configurations)).

## Deprecate Variables and Outputs

Renaming a variable breaks every caller. Since Terraform 1.15, you can keep the old variable for a while and mark it deprecated; callers who still set it get a warning:

```hcl
variable "domain" {
  description = "Old name for site.domain"
  type        = string
  default     = null
  deprecated  = "Set site.domain instead. This variable will be removed in version 3.0."
}
```

```terminal
{
  "title": "a deprecated variable",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform plan -var domain=shop.example.com",
      "output": "local_file.nginx: Refreshing state... [id=314518892b5546316bbec97947ae80716b691cc1]\nlocal_sensitive_file.db: Refreshing state... [id=f0a098591c595734fb14d6de19be649fd5da5d86]\n\nNo changes. Your infrastructure matches the configuration.\n\nTerraform has compared your real infrastructure against your configuration\nand found no differences, so no changes are needed.\n╷\n│ Warning: Deprecated variable got a value\n│\n│   on deprecated.tf line 5, in variable \"domain\":\n│    1: variable \"domain\" {\n│    2:   description = \"Old name for site.domain\"\n│    3:   type        = string\n│    4:   default     = null\n│    5:   deprecated  = \"Set site.domain instead. This variable will be removed in version 3.0.\"\n│\n│ Set site.domain instead. This variable will be removed in version 3.0.\n╵"
    }
  ]
}
```

Outputs accept `deprecated` too, which warns modules that still refer to them.

## Ephemeral Variables

A variable with `ephemeral = true` (Terraform 1.10 and later) is never written to the plan file or the state. Terraform only lets you use it in places that are not stored either: provider configuration, other ephemeral values, and write-only arguments of resources. That makes it the right type for credentials a provider needs only while Terraform runs. [Part 10](/guides/introduction-to-terraform/10-best-practices-and-production-patterns#h2-keep-secrets-out-of-state) shows ephemeral values and write-only arguments together.

## Example: One Configuration, Three Environments

Here is the same pattern on AWS. A map holds the sizes per environment, a `validation` block guards the environment name, and the outputs give a person or a script what they need next:

```hcl
variable "environment" {
  description = "dev, staging or prod"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging or prod."
  }
}

variable "sizes" {
  description = "Instance size and count per environment"
  type = map(object({
    instance_type = string
    count         = number
  }))
  default = {
    dev     = { instance_type = "t3.micro", count = 1 }
    staging = { instance_type = "t3.small", count = 2 }
    prod    = { instance_type = "m7i.large", count = 3 }
  }
}

variable "allowed_ssh_cidrs" {
  description = "CIDR blocks allowed to connect with SSH; empty means no SSH"
  type        = list(string)
  default     = []

  validation {
    condition     = alltrue([for c in var.allowed_ssh_cidrs : can(cidrhost(c, 0))])
    error_message = "Every entry must be a valid CIDR block, such as 203.0.113.0/24."
  }
}

variable "vpc_id" {
  description = "VPC to deploy into"
  type        = string
}

variable "subnet_id" {
  description = "Subnet for the instances"
  type        = string
}

variable "ami_id" {
  description = "Machine image for the instances, from your image pipeline"
  type        = string
}
```

```hcl
locals {
  size = var.sizes[var.environment]
  name = "webapp-${var.environment}"
}

resource "aws_security_group" "web" {
  name_prefix = "${local.name}-"
  vpc_id      = var.vpc_id
}

resource "aws_vpc_security_group_ingress_rule" "ssh" {
  for_each = toset(var.allowed_ssh_cidrs)

  security_group_id = aws_security_group.web.id
  cidr_ipv4         = each.value
  ip_protocol       = "tcp"
  from_port         = 22
  to_port           = 22
}

resource "aws_instance" "web" {
  count = local.size.count

  ami                    = var.ami_id
  instance_type          = local.size.instance_type
  subnet_id              = var.subnet_id
  vpc_security_group_ids = [aws_security_group.web.id]

  tags = {
    Name = "${local.name}-${count.index + 1}"
  }
}
```

```hcl
output "instance_ids" {
  description = "IDs of the web instances"
  value       = aws_instance.web[*].id
}

output "private_ips" {
  description = "Private IP address of each instance, by name"
  value       = { for i in aws_instance.web : i.tags.Name => i.private_ip }
}
```

Each environment gets a variable file with its own values:

```hcl
# env/prod.tfvars
environment = "prod"
vpc_id      = "vpc-0a1b2c3d4e5f60718"
subnet_id   = "subnet-0f1e2d3c4b5a69788"
ami_id      = "ami-0c1d2e3f4a5b6c7d8"
```

`terraform apply -var-file=env/prod.tfvars` creates three `m7i.large` instances, and the same code with `env/dev.tfvars` (with `environment = "dev"` and the dev network) creates one `t3.micro`. The IDs above are placeholders; use the IDs from your account, or the outputs of the network configuration. [Part 8](/guides/introduction-to-terraform/08-working-with-multiple-environments) shows how to keep the state of each environment separate.

## Common Mistakes

- **Variables without types.** You lose early error messages and documentation. Always set `type`.
- **Expecting `TF_VAR_` to override a tfvars file.** It does not; files and flags win.
- **Secrets in `.tfvars` files in Git.** Pass them through `TF_VAR_` from a secret store or CI secrets, or read them with an ephemeral resource.
- **Thinking `sensitive` means encrypted.** It only hides values in output; the state still has them.
- **Outputs nobody uses.** Every output of a module is part of its interface. Export what callers need, not every attribute.
- **Using variables where locals fit.** If nobody should change a value from outside, make it a local.

## Summary

- Declare every variable with a description and a type; use `optional()` for flexible objects and `validation` for rules.
- Values come from defaults, `TF_VAR_`, `terraform.tfvars`, `*.auto.tfvars`, then `-var` and `-var-file` in order; the last one wins.
- Locals name computed values; they cannot be set from outside.
- Outputs expose results; `-raw` and `-json` are for scripts.
- `sensitive` hides values, `ephemeral` keeps them out of state, `deprecated` helps you rename inputs safely.

In [Part 7](/guides/introduction-to-terraform/07-modules) you package configurations into reusable modules.

## Keep Learning

- [Terraform Variables, Loops, and Outputs: The Complete Guide](/posts/terraform-variables-loops-and-outputs)
- [How to Read Environment Variables From a .env File in Terraform](/posts/terraform-read-environment-variables-from-env-file)
- [How to Fix Terraform "Variables Not Allowed" Error During Plan](/posts/terraform-variables-not-allowed-error-plan)
- [How to Save Terraform Plan and Apply Output to a File](/posts/terraform-save-plan-apply-output-to-file)
