---
title: 'Terraform Modules: Write, Use and Version Them'
description: 'Build reusable Terraform modules: inputs and outputs, for_each on modules, registry and Git sources, version pinning, and moving resources into modules.'
order: 7
---

**TLDR**: A module is a directory of `.tf` files. The directory you run Terraform in is the **root module**; it calls **child modules** with `module` blocks, passes values in as variables and reads results through outputs. Modules can come from a local path, the Terraform Registry, Git or other sources; pin remote modules to a version. Keep modules small and focused, never configure providers inside them, and use `moved` blocks when you move existing resources into a module.

Once a configuration grows past a few hundred lines, or once you build the same thing twice, modules are how you keep it under control. This part writes a module, calls it several ways, pulls modules from the registry and from Git, and refactors existing resources into a module without recreating them. Every output comes from real runs with Terraform 1.17.

## Prerequisites

- Variables and outputs from [Part 6](/guides/introduction-to-terraform/06-variables-and-outputs).
- No cloud account for the examples; the AWS snippets are optional.

## What a Module Is

Every Terraform configuration is a module. The files in your working directory form the **root module**. A `module` block calls another directory, a **child module**, and creates everything in it under its own address prefix:

```text
modules-demo/
├── main.tf                 # root module: calls the child module
├── outputs.tf
└── modules/
    └── site/               # child module
        ├── main.tf         # resources
        ├── variables.tf    # inputs
        ├── outputs.tf      # return values
        ├── versions.tf     # required providers
        └── server.conf.tftpl
```

A child module only sees what you pass in. It cannot read the root module's variables or resources, and the root module can only read the child's outputs. That boundary is the point: the inputs and outputs are the module's interface, and everything else can change without breaking callers.

## Write a Module

This module renders an Nginx server block for one site and gives it a random ID, standing in for whatever your real module creates (a server, a bucket, a DNS zone).

`modules/site/variables.tf` declares the inputs:

```hcl
variable "domain" {
  description = "Domain name the site answers on"
  type        = string
}

variable "upstreams" {
  description = "Backend addresses (host:port) that serve the site"
  type        = list(string)

  validation {
    condition     = length(var.upstreams) > 0
    error_message = "A site needs at least one upstream."
  }
}

variable "output_dir" {
  description = "Directory to write the configuration to"
  type        = string
}
```

`modules/site/main.tf` holds the resources, and the template sits next to it:

```hcl
resource "random_id" "site" {
  byte_length = 4
}

resource "local_file" "server" {
  filename = "${var.output_dir}/${var.domain}.conf"
  content = templatefile("${path.module}/server.conf.tftpl", {
    domain    = var.domain
    upstreams = var.upstreams
    site_id   = random_id.site.hex
  })
}
```

```text
# site ${site_id}
upstream ${replace(domain, ".", "_")} {
%{ for u in upstreams ~}
    server ${u};
%{ endfor ~}
}

server {
    listen 80;
    server_name ${domain};
    location / {
        proxy_pass http://${replace(domain, ".", "_")};
    }
}
```

Inside a module, `path.module` is the module's own directory, so the template is found wherever the module is used. The outputs and the provider requirements complete it:

```hcl
output "config_path" {
  description = "Path of the generated configuration file"
  value       = local_file.server.filename
}

output "site_id" {
  description = "Random ID of the site"
  value       = random_id.site.hex
}
```

```hcl
terraform {
  required_providers {
    local = {
      source  = "hashicorp/local"
      version = ">= 2.5"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.6"
    }
  }
}
```

The module declares which providers it needs, with a **minimum** version, but no `provider` blocks. The root module configures providers and pins exact ranges; a module that sets its own provider configuration cannot be used with `count` or `for_each` and is hard to remove later. Reusable modules should also avoid tight upper bounds, so callers can upgrade providers without waiting for a new module release.

## Call the Module

The root module pins the provider versions for the whole configuration:

```hcl
terraform {
  required_version = ">= 1.17"

  required_providers {
    local = {
      source  = "hashicorp/local"
      version = "~> 2.9"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.9"
    }
  }
}
```

Then it calls the module twice:

```hcl
module "blog" {
  source = "./modules/site"

  domain     = "blog.example.com"
  upstreams  = ["10.0.1.10:8080"]
  output_dir = "${path.root}/out"
}

module "shop" {
  source = "./modules/site"

  domain     = "shop.example.com"
  upstreams  = ["10.0.1.20:8080", "10.0.1.21:8080"]
  output_dir = "${path.root}/out"
}

output "config_files" {
  value = [module.blog.config_path, module.shop.config_path]
}
```

`init` installs local modules too (it records where each one is), so run it whenever you add a `module` block. Terraform combines the constraints of the root module and every child module when it picks a provider version:

```terminal
{
  "title": "init and apply",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform init",
      "output": "Initializing the backend...\n\nInitializing modules...\n- blog in modules/site\n- shop in modules/site\n\nInitializing provider plugins...\n- Finding hashicorp/local versions matching \">= 2.5.0, ~> 2.9\"...\n- Finding hashicorp/random versions matching \">= 3.6.0, ~> 3.9\"...\n- Installing hashicorp/local v2.9.1...\n- Installed hashicorp/local v2.9.1 (signed by HashiCorp)\n- Installing hashicorp/random v3.9.1...\n- Installed hashicorp/random v3.9.1 (signed by HashiCorp)\n\nTerraform has created a lock file .terraform.lock.hcl to record the provider\nselections it made above. Include this file in your version control repository\nso that Terraform can guarantee to make the same selections by default when\nyou run \"terraform init\" in the future.\n\nTerraform has been successfully initialized!\n\nYou may now begin working with Terraform. Try running \"terraform plan\" to see\nany changes that are required for your infrastructure. All Terraform commands\nshould now work.\n\nIf you ever set or change modules or backend configuration for Terraform,\nrerun this command to reinitialize your working directory. If you forget, other\ncommands will detect it and remind you to do so if necessary."
    },
    {
      "cmd": "terraform apply -auto-approve",
      "output": "Apply complete! Resources: 4 added, 0 changed, 0 destroyed.\n\nOutputs:\n\nconfig_files = [\n  \"./out/blog.example.com.conf\",\n  \"./out/shop.example.com.conf\",\n]"
    },
    {
      "cmd": "terraform state list",
      "output": "module.blog.local_file.server\nmodule.blog.random_id.site\nmodule.shop.local_file.server\nmodule.shop.random_id.site"
    },
    {
      "cmd": "cat out/shop.example.com.conf",
      "output": "# site 6e3af234\nupstream shop_example_com {\n    server 10.0.1.20:8080;\n    server 10.0.1.21:8080;\n}\n\nserver {\n    listen 80;\n    server_name shop.example.com;\n    location / {\n        proxy_pass http://shop_example_com;\n    }\n}"
    }
  ]
}
```

Each resource's address starts with its module: `module.shop.local_file.server`. You refer to a module's outputs as `module.<name>.<output>`, as the `config_files` output does.

## Many Instances With for_each

Two nearly identical `module` blocks are a hint to use `for_each`, which works on modules exactly as on resources:

```hcl
variable "sites" {
  type = map(list(string))
  default = {
    "blog.example.com" = ["10.0.1.10:8080"]
    "shop.example.com" = ["10.0.1.20:8080", "10.0.1.21:8080"]
    "docs.example.com" = ["10.0.1.30:8080"]
  }
}

module "site" {
  source   = "./modules/site"
  for_each = var.sites

  domain     = each.key
  upstreams  = each.value
  output_dir = "${path.root}/out"
}

output "config_files" {
  value = { for domain, s in module.site : domain => s.config_path }
}
```

The two existing sites are already in the state as `module.blog` and `module.shop`. Without help, Terraform would destroy them and create `module.site["blog.example.com"]` and friends from scratch. Two `moved` blocks map the old addresses to the new ones:

```hcl
moved {
  from = module.blog
  to   = module.site["blog.example.com"]
}

moved {
  from = module.shop
  to   = module.site["shop.example.com"]
}
```

```terminal
{
  "title": "moving modules into for_each",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform init",
      "output": "Initializing the backend...\n\nInitializing modules...\n- site in modules/site\n"
    },
    {
      "cmd": "terraform plan -no-color | grep -E '^  #|^Plan'",
      "output": "  # module.blog.local_file.server has moved to module.site[\"blog.example.com\"].local_file.server\n  # module.blog.random_id.site has moved to module.site[\"blog.example.com\"].random_id.site\n  # module.site[\"docs.example.com\"].local_file.server will be created\n  # module.site[\"docs.example.com\"].random_id.site will be created\n  # module.shop.local_file.server has moved to module.site[\"shop.example.com\"].local_file.server\n  # module.shop.random_id.site has moved to module.site[\"shop.example.com\"].random_id.site\nPlan: 2 to add, 0 to change, 0 to destroy."
    }
  ]
}
```

Both existing sites move without changes, and only `docs` is new. The same technique moves plain resources into a module when you extract one from a growing root module: `from = aws_instance.web`, `to = module.web.aws_instance.this`.

## Module Sources

The `source` argument says where the module code comes from. `terraform init` downloads remote modules into `.terraform/modules`.

| Source                           | Example                                                       | Version pinning           |
| -------------------------------- | ------------------------------------------------------------- | ------------------------- |
| Local path                       | `./modules/site`                                              | Same commit as the caller |
| Terraform Registry               | `terraform-aws-modules/vpc/aws`                               | `version = "~> 6.7"`      |
| Private registry (HCP Terraform) | `app.terraform.io/acme/vpc/aws`                               | `version = "~> 2.1"`      |
| Git over HTTPS or SSH            | `git::https://github.com/acme/tf-modules.git//vpc?ref=v2.1.0` | `?ref=` tag or commit     |
| GitHub shorthand                 | `github.com/acme/tf-modules//vpc?ref=v2.1.0`                  | `?ref=`                   |
| S3, GCS, HTTP archive            | `s3::https://s3.amazonaws.com/acme-modules/vpc.zip`           | Object name or version    |

A double slash (`//vpc`) selects a subdirectory inside the repository or archive. Only registry sources accept the `version` argument; other sources pin with the reference in the URL. Pin to a tag at least, or to a full commit SHA if you want to be sure nobody can move the tag under you.

Here are both remote kinds in practice: the registry module `hashicorp/dir/template`, which renders a directory of templates and needs no provider, and the same module straight from its Git repository:

Both read a `static` directory with two files, the template `static/index.html.tmpl` and the plain file `static/robots.txt`. The module renders files whose names end in `.tmpl` as templates (and drops the suffix) and passes the others through unchanged:

```html
<h1>Welcome to ${site_name}</h1>
```

```text
User-agent: *
Allow: /
```

The module calls:

```hcl
module "static_files" {
  source  = "hashicorp/dir/template"
  version = "1.0.2"

  base_dir      = "${path.root}/static"
  template_vars = { site_name = "shop.example.com" }
}

module "static_files_git" {
  source = "git::https://github.com/hashicorp/terraform-template-dir.git?ref=v1.0.2"

  base_dir      = "${path.root}/static"
  template_vars = { site_name = "blog.example.com" }
}

output "static_files" {
  value = { for path, f in module.static_files.files : path => f.content_type }
}
```

```terminal
{
  "title": "downloading modules",
  "prompt": "$",
  "steps": [
    {
      "cmd": "terraform get",
      "output": "Downloading registry.terraform.io/hashicorp/dir/template 1.0.2 for static_files...\n- static_files in .terraform/modules/static_files\nDownloading git::https://github.com/hashicorp/terraform-template-dir.git?ref=v1.0.2 for static_files_git...\n- static_files_git in .terraform/modules/static_files_git"
    },
    {
      "cmd": "terraform apply -auto-approve",
      "output": "  \"shop.example.com\" = \"./out/shop.example.com.conf\"\n}\nstatic_files = {\n  \"index.html\" = \"text/html; charset=utf-8\"\n  \"robots.txt\" = \"text/plain; charset=utf-8\"\n}"
    }
  ]
}
```

`terraform get` downloads modules only; `terraform init` does that plus providers and the backend. To pick up newer versions that still match your constraints, run `terraform get -update` (modules only) or `terraform init -upgrade` (modules and providers).

### Registry Modules

The public registry has thousands of modules. The `terraform-aws-modules` collection is maintained by the community and widely used; its VPC module replaces a page of networking code:

```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 6.7"

  name = "webapp-dev"
  cidr = "10.0.0.0/16"

  azs             = ["eu-west-1a", "eu-west-1b"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = true # one NAT gateway saves money outside production

  tags = {
    Environment = "dev"
  }
}

output "private_subnet_ids" {
  value = module.vpc.private_subnets
}
```

Before you adopt a public module, check who maintains it, when it was last released, how many open issues it has, and read its code: you are running it with your cloud credentials. Each module's registry page lists its inputs, outputs and the provider versions it requires; version 6 of this one needs AWS provider 6.28 or later.

## Providers and Modules

A child module inherits the default provider configurations of its caller. When a module needs a different configuration, such as a second Region, pass it explicitly with `providers`:

```hcl
provider "aws" {
  alias  = "dr"
  region = "eu-central-1"
}

module "vpc_dr" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 6.7"

  providers = {
    aws = aws.dr
  }

  name = "webapp-dr"
  cidr = "10.1.0.0/16"
  azs  = ["eu-central-1a", "eu-central-1b"]
}
```

The key (`aws`) is the provider name inside the module, and the value is the configuration in the caller. A module that needs two configurations of the same provider declares them with `configuration_aliases` in its `required_providers` block. More examples are in [How to Share Providers and Variables Across Terraform Modules](/posts/terraform-provider-variable-sharing-modules).

## Design Good Modules

- **One purpose per module.** A network, a database, a service. A module called `everything` is a root module in disguise.
- **No thin wrappers.** A module that wraps one resource and passes every argument through adds a layer without adding value. Write a module when it encodes a decision: secure defaults, naming, tagging, a group of resources that belong together.
- **Small, typed interface.** Few required variables, sensible defaults, `validation` blocks, descriptions on everything. Output what callers need: IDs, ARNs, endpoints.
- **No provider blocks, minimum provider versions.** As above.
- **Document it.** A `README.md` with an example call. `terraform-docs` generates the inputs and outputs tables from your code.
- **Test it.** An `examples/` directory with a working call, plus `terraform test` files ([Part 10](/guides/introduction-to-terraform/10-best-practices-and-production-patterns#h2-test-your-code)).
- **Version it.** Tag releases with semantic versions (`v1.4.0`) and write down breaking changes. Renaming a variable or an output is a breaking change; adding an optional variable is not. Mark old variables `deprecated` for a release before you remove them ([Part 6](/guides/introduction-to-terraform/06-variables-and-outputs#h2-deprecate-variables-and-outputs)).
- **Keep nesting shallow.** A module that calls modules that call modules is hard to debug. One or two levels is plenty.

To publish on the public registry, the repository must be public on GitHub, named `terraform-<PROVIDER>-<NAME>` (for example `terraform-aws-webserver`), and have semantic version tags. HCP Terraform has a private registry with the same workflow.

Since Terraform 1.15, `source` and `version` can use variables and locals, for example to point every module call at an internal mirror. Terraform evaluates them during `terraform init`, so a variable used there must be declared with `const = true`, and locals may only build on such variables and literals:

```hcl
variable "module_registry" {
  type    = string
  default = "app.terraform.io/acme"
  const   = true # allowed in module source and version
}

module "vpc" {
  source  = "${var.module_registry}/vpc/aws"
  version = "~> 2.1"
}
```

Without `const = true`, `init` stops with "Only literal values and const variables can be evaluated during init". A `const` variable cannot also be `sensitive` or `ephemeral`.

## Common Mistakes

- **Unpinned remote modules.** A Git source without `?ref=` or a registry module without `version` changes under you on the next `init -upgrade`.
- **Refactoring into modules without `moved` blocks.** The plan destroys and recreates everything you moved.
- **Provider blocks inside modules.** They block `for_each` on the module and make it impossible to delete the module cleanly.
- **Too many variables.** If every argument of every resource is a variable, the module is not hiding anything. Decide the defaults.
- **Hard-coded names inside modules.** A module that names its resources `web-sg` can only be called once per account. Build names from an input.

## Summary

- A module is a directory; the root module calls child modules with `module` blocks.
- Inputs are variables, results are outputs, and nothing else crosses the boundary.
- `for_each` and `count` work on modules; `moved` blocks keep refactors free of replacements.
- Sources can be local, a registry, Git or object storage; pin every remote source.
- Modules declare provider requirements but leave provider configuration to the caller.

In [Part 8](/guides/introduction-to-terraform/08-working-with-multiple-environments) you use modules to run the same infrastructure in several environments.

## Keep Learning

- [Terraform Module Outputs, Inputs and Sources: How Modules Pass Data to Each Other](/posts/terraform-module-outputs-inputs-and-sources)
- [How to Organize a Terraform Repository with Multiple Subfolders](/posts/organizing-terraform-repository-with-subfolders)
- [Terraform Repository Structure Checklist](/checklists/terraform-repo-structure)
- [Terraform vs Pulumi](/comparisons/terraform-vs-pulumi), if you would rather write modules in a general-purpose language
