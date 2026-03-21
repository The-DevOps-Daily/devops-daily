---
title: 'How to Get the Current Working Directory in Terraform'
excerpt: "Learn how to reference file paths in Terraform using path.module, path.root, and path.cwd - and understand which one to use in different scenarios."
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2024-11-20'
publishedAt: '2024-11-20T11:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Infrastructure as Code
  - Paths
  - Best Practices
  - DevOps
---

When you need to reference files or directories in your Terraform configuration - like loading a template file, reading a shell script, or referencing a policy document - you need a way to get the correct path regardless of where Terraform is executed from. Terraform provides three built-in path variables for this: `path.module`, `path.root`, and `path.cwd`.

Understanding the differences between these paths is important for writing portable Terraform code that works reliably across different environments and repository structures.

**TLDR:** Use `path.module` to reference files relative to the current module (this is what you want 90% of the time). Use `path.root` to reference files relative to the root module where Terraform is executed. Use `path.cwd` sparingly - it refers to the actual shell working directory and can cause portability issues. For modules, always use `path.module` to make sure file references work regardless of how the module is called.

## The Three Path Variables

Terraform exposes three path variables you can use in your configurations:

```hcl
locals {
  module_path = path.module  # Path to the current module
  root_path   = path.root    # Path to the root module
  cwd_path    = path.cwd     # Current working directory
}
```

Let's understand what each one means with an example directory structure:

```
/home/user/infrastructure/
├── main.tf
├── variables.tf
└── modules/
    └── application/
        ├── main.tf
        ├── user-data.sh
        └── policy.json
```

If you run `terraform apply` from `/home/user/infrastructure/`, here's what each path variable resolves to:

In the root module (`/home/user/infrastructure/main.tf`):
- `path.module` = `/home/user/infrastructure`
- `path.root` = `/home/user/infrastructure`
- `path.cwd` = `/home/user/infrastructure`

In the child module (`/home/user/infrastructure/modules/application/main.tf`):
- `path.module` = `/home/user/infrastructure/modules/application`
- `path.root` = `/home/user/infrastructure`
- `path.cwd` = `/home/user/infrastructure`

Notice how `path.module` changes based on which module the code is in, while `path.root` and `path.cwd` stay the same.

## Using path.module for Module-Local Files

The most common use case is referencing files that live alongside your module code. Use `path.module` for this:

```hcl
# modules/application/main.tf

resource "aws_launch_template" "app" {
  name_prefix   = "app-server-"
  image_id      = var.ami_id
  instance_type = "t3.medium"

  # Load a shell script from the same directory as this module
  user_data = base64encode(file("${path.module}/user-data.sh"))
}

resource "aws_iam_role_policy" "app" {
  name = "app-policy"
  role = aws_iam_role.app.id

  # Load a policy JSON file from the module directory
  policy = file("${path.module}/policy.json")
}
```

The `${path.module}` prefix makes sure these files are loaded from the module's directory, not from wherever the person running Terraform happens to be.

This is critical for module reusability. If you wrote the path as just `file("user-data.sh")`, Terraform would look for it relative to the current working directory, which breaks when the module is called from different locations.

```
Without path.module:               With path.module:

Root module calls                  Root module calls
modules/application/                modules/application/
    |                                  |
    Looks for user-data.sh            Looks for user-data.sh
    in root directory (wrong!)        in modules/application/ (correct!)
```

## Using path.root for Root Module Resources

When you want to reference files from the root module directory regardless of which module you're in, use `path.root`:

```hcl
# modules/application/main.tf

locals {
  # Load a shared configuration file from the root module
  shared_config = yamldecode(file("${path.root}/config/shared.yaml"))

  # Reference a common script in the root module
  init_script = file("${path.root}/scripts/common-init.sh")
}
```

This is useful when you have shared resources at the root level that multiple modules need to access:

```
infrastructure/
├── main.tf
├── config/
│   └── shared.yaml          # Shared across all modules
├── scripts/
│   └── common-init.sh       # Shared across all modules
└── modules/
    ├── application/
    │   └── main.tf          # References ${path.root}/config/shared.yaml
    └── database/
        └── main.tf          # Also references ${path.root}/config/shared.yaml
```

Both modules can access the shared files using `${path.root}` even though they're in different directories.

## When path.cwd Can Cause Problems

`path.cwd` refers to the actual directory where you run the `terraform` command from. This sounds useful but can lead to unexpected behavior.

Consider this scenario:

```hcl
# BAD: Using path.cwd
resource "aws_iam_role_policy" "app" {
  policy = file("${path.cwd}/policy.json")
}
```

If you run Terraform from the root of your repository, it works fine. But if you run it from a subdirectory or from a CI/CD system that uses a different working directory, the path breaks:

```bash
# This works
cd /home/user/infrastructure
terraform apply

# This breaks - wrong working directory
cd /home/user/infrastructure/environments/prod
terraform apply  # ERROR: can't find policy.json
```

Unless you have a specific reason to depend on the shell's working directory (which is rare), avoid `path.cwd`. Use `path.module` or `path.root` instead for consistent behavior.

## Loading Template Files

A common pattern is using template files with variable substitution. Use `path.module` to reference the template:

```hcl
# modules/application/main.tf

resource "aws_instance" "web" {
  ami           = var.ami_id
  instance_type = "t3.medium"

  user_data = templatefile("${path.module}/templates/user-data.tpl", {
    app_name     = var.app_name
    environment  = var.environment
    database_url = var.database_url
  })
}
```

The template file lives next to your module:

```bash
# modules/application/templates/user-data.tpl

#!/bin/bash
echo "Starting ${app_name} in ${environment}"
export DATABASE_URL="${database_url}"

# Application startup commands
/usr/local/bin/start-app
```

The `templatefile` function loads the file, replaces the placeholder variables, and returns the rendered content.

## Reading Multiple Files From a Directory

Sometimes you need to load multiple files from a directory. Combine `path.module` with `fileset`:

```hcl
# modules/policies/main.tf

locals {
  # Find all JSON files in the policies directory
  policy_files = fileset("${path.module}/policies", "*.json")

  # Load each file and create a map
  policies = {
    for filename in local.policy_files :
    trimsuffix(filename, ".json") => file("${path.module}/policies/${filename}")
  }
}

resource "aws_iam_policy" "policies" {
  for_each = local.policies

  name   = each.key
  policy = each.value
}
```

This pattern loads all JSON files from the `policies` subdirectory and creates an IAM policy for each one. The structure looks like:

```
modules/policies/
├── main.tf
└── policies/
    ├── s3-read.json
    ├── dynamodb-write.json
    └── lambda-invoke.json
```

Each JSON file becomes an IAM policy with the filename (minus `.json`) as its name.

## Combining Paths With Other Functions

You can combine path variables with other Terraform functions for more complex scenarios:

```hcl
# modules/application/main.tf

locals {
  # Get the module directory name
  module_name = basename(path.module)

  # Build a path relative to the root module
  config_file = "${path.root}/environments/${var.environment}/config.yaml"

  # Check if a file exists before trying to load it
  has_custom_config = fileexists("${path.module}/custom-config.yaml")

  # Load custom config if it exists, otherwise use defaults
  config = local.has_custom_config ? file("${path.module}/custom-config.yaml") : file("${path.module}/default-config.yaml")
}
```

The `basename` function extracts just the directory name from the full path, which can be useful for naming resources.

## Path Variables in Module Outputs

You can expose path information through module outputs if needed:

```hcl
# modules/application/outputs.tf

output "module_path" {
  description = "Path to this module's directory"
  value       = path.module
}

output "module_name" {
  description = "Name of this module"
  value       = basename(path.module)
}
```

This can be helpful for debugging or for building file paths dynamically in the calling module.

## Best Practices for File References

Always use `path.module` in reusable modules. This makes the module portable and allows it to be called from anywhere:

```hcl
# GOOD: Portable module
resource "aws_instance" "app" {
  user_data = file("${path.module}/scripts/init.sh")
}

# BAD: Breaks when called from different locations
resource "aws_instance" "app" {
  user_data = file("scripts/init.sh")
}
```

Use `path.root` when you need to access shared files that live at the root of your Terraform project:

```hcl
# Accessing a shared configuration file
locals {
  shared_tags = yamldecode(file("${path.root}/config/tags.yaml"))
}
```

Keep related files close to where they're used. If a script is only used by one module, put it in that module's directory rather than in a shared location. This makes dependencies obvious and keeps modules self-contained.

For files that truly are shared across multiple modules, consider creating a dedicated module for them:

```
infrastructure/
├── main.tf
└── modules/
    ├── shared-config/
    │   ├── main.tf
    │   ├── outputs.tf
    │   └── files/
    │       ├── shared-policy.json
    │       └── common-tags.yaml
    ├── application/
    │   └── main.tf
    └── database/
        └── main.tf
```

The `shared-config` module loads the files and exposes them as outputs:

```hcl
# modules/shared-config/main.tf

output "common_policy" {
  value = file("${path.module}/files/shared-policy.json")
}

output "common_tags" {
  value = yamldecode(file("${path.module}/files/common-tags.yaml"))
}
```

Other modules can then reference these outputs:

```hcl
# main.tf

module "shared" {
  source = "./modules/shared-config"
}

module "application" {
  source = "./modules/application"

  common_policy = module.shared.common_policy
  tags          = module.shared.common_tags
}
```

This approach keeps file paths managed in one place and creates explicit dependencies.

Understanding these path variables helps you write Terraform code that works consistently regardless of directory structure or where commands are executed. Stick to `path.module` for module-local files and `path.root` for shared root-level files, and you'll avoid most path-related issues.
