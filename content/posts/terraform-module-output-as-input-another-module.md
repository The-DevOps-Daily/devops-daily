---
title: 'How to Use Terraform Module Output as Input for Another Module'
excerpt: "Learn how to chain Terraform modules together by passing outputs from one module as inputs to another, creating organized and reusable infrastructure configurations."
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2024-12-22'
publishedAt: '2024-12-22T08:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Infrastructure as Code
  - Modules
  - Best Practices
  - DevOps
---

One of Terraform's strengths is composing infrastructure from reusable modules. Often, you need to pass information from one module to another - like using VPC IDs from a networking module in a compute module, or passing database endpoints to an application module. This is accomplished by defining outputs in the source module and referencing them as inputs in the dependent module.

Understanding this pattern is fundamental to building modular, maintainable infrastructure configurations.

**TLDR:** Pass module outputs to other modules using `module.<module_name>.<output_name>` as the input value. The source module must explicitly define outputs using `output` blocks. Reference these outputs in your root module and pass them to other modules through their input variables. Terraform automatically handles the dependency ordering, applying the source module before any module that depends on its outputs.

## Basic Module Output and Input Pattern

Here's the fundamental pattern for passing data between modules:

```hcl
# Root module main.tf

# First module creates a VPC
module "networking" {
  source = "./modules/vpc"

  cidr_block = "10.0.0.0/16"
  environment = "production"
}

# Second module uses VPC outputs
module "compute" {
  source = "./modules/ec2"

  vpc_id     = module.networking.vpc_id
  subnet_ids = module.networking.private_subnet_ids
  environment = "production"
}
```

The networking module defines these outputs:

```hcl
# modules/vpc/outputs.tf

output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value       = aws_subnet.private[*].id
}

output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value       = aws_subnet.public[*].id
}
```

The compute module declares these as input variables:

```hcl
# modules/ec2/variables.tf

variable "vpc_id" {
  description = "VPC ID where instances will be created"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs for instance placement"
  type        = list(string)
}

variable "environment" {
  description = "Environment name"
  type        = string
}
```

Terraform understands that `compute` depends on `networking` because it references `module.networking.vpc_id`, so it creates resources in the correct order.

## Multiple Modules Chaining Together

You can chain multiple modules, with each depending on the previous:

```hcl
# Create networking infrastructure
module "networking" {
  source = "./modules/vpc"

  cidr_block = "10.0.0.0/16"
  environment = var.environment
}

# Create database in the VPC
module "database" {
  source = "./modules/rds"

  vpc_id            = module.networking.vpc_id
  subnet_ids        = module.networking.private_subnet_ids
  security_group_id = module.networking.database_security_group_id
  instance_class    = "db.t3.medium"
}

# Create application servers that connect to the database
module "application" {
  source = "./modules/app"

  vpc_id              = module.networking.vpc_id
  subnet_ids          = module.networking.private_subnet_ids
  database_endpoint   = module.database.endpoint
  database_port       = module.database.port
  database_name       = module.database.database_name
  security_group_id   = module.networking.app_security_group_id
}

# Create load balancer for the application
module "load_balancer" {
  source = "./modules/alb"

  vpc_id                = module.networking.vpc_id
  subnet_ids            = module.networking.public_subnet_ids
  target_instance_ids   = module.application.instance_ids
  security_group_id     = module.networking.alb_security_group_id
}
```

The dependency chain:

```
networking
    ├─> database (uses networking outputs)
    ├─> application (uses networking + database outputs)
    └─> load_balancer (uses networking + application outputs)
```

Terraform determines the correct order automatically based on these references.

## Passing Complex Objects Between Modules

Modules can output complex objects that get passed to other modules:

```hcl
# modules/vpc/outputs.tf

output "vpc_config" {
  description = "Complete VPC configuration object"
  value = {
    vpc_id             = aws_vpc.main.id
    cidr_block         = aws_vpc.main.cidr_block
    private_subnet_ids = aws_subnet.private[*].id
    public_subnet_ids  = aws_subnet.public[*].id
    nat_gateway_ids    = aws_nat_gateway.main[*].id
    route_table_ids = {
      private = aws_route_table.private[*].id
      public  = aws_route_table.public.id
    }
  }
}
```

Use the entire object or specific fields:

```hcl
# Root module

module "networking" {
  source = "./modules/vpc"
  cidr_block = "10.0.0.0/16"
}

module "database" {
  source = "./modules/rds"

  # Pass the entire config object
  vpc_config = module.networking.vpc_config

  # Or extract specific fields
  vpc_id     = module.networking.vpc_config.vpc_id
  subnet_ids = module.networking.vpc_config.private_subnet_ids
}
```

The database module accepts the complex object:

```hcl
# modules/rds/variables.tf

variable "vpc_config" {
  description = "VPC configuration object"
  type = object({
    vpc_id             = string
    private_subnet_ids = list(string)
    cidr_block         = string
  })
}
```

## Conditional Module Dependencies

Sometimes you only want to pass outputs if certain conditions are met:

```hcl
module "networking" {
  source = "./modules/vpc"
  cidr_block = "10.0.0.0/16"
}

module "database" {
  source = "./modules/rds"
  count  = var.create_database ? 1 : 0

  vpc_id     = module.networking.vpc_id
  subnet_ids = module.networking.private_subnet_ids
}

module "application" {
  source = "./modules/app"

  vpc_id            = module.networking.vpc_id
  subnet_ids        = module.networking.private_subnet_ids

  # Conditional database endpoint
  database_endpoint = var.create_database ? module.database[0].endpoint : var.external_db_endpoint
  database_port     = var.create_database ? module.database[0].port : var.external_db_port
}
```

When using `count` with modules, remember to index the module like `module.database[0]` when accessing outputs.

## Using for_each With Module Outputs

When a module is created with `for_each`, its outputs become maps:

```hcl
module "regional_vpcs" {
  for_each = toset(["us-east-1", "us-west-2", "eu-west-1"])
  source   = "./modules/vpc"

  region     = each.key
  cidr_block = "10.${index(["us-east-1", "us-west-2", "eu-west-1"], each.key)}.0.0/16"
}

# Access specific region's VPC
module "app_us_east" {
  source = "./modules/app"

  vpc_id     = module.regional_vpcs["us-east-1"].vpc_id
  subnet_ids = module.regional_vpcs["us-east-1"].private_subnet_ids
}

# Create resources in all regions
module "monitoring" {
  for_each = module.regional_vpcs

  source = "./modules/monitoring"

  vpc_id     = each.value.vpc_id
  region     = each.key
}
```

The `for_each` on `module.monitoring` iterates over all VPC modules, using their outputs.

## Aggregating Outputs From Multiple Modules

You can collect outputs from multiple module instances:

```hcl
module "web_servers" {
  for_each = var.availability_zones
  source   = "./modules/ec2"

  subnet_id     = module.networking.subnet_ids[each.key]
  instance_type = "t3.medium"
}

locals {
  # Collect all instance IDs into a list
  all_instance_ids = [
    for k, instance in module.web_servers : instance.instance_id
  ]

  # Create a map of AZ to instance IP
  instance_ips_by_az = {
    for k, instance in module.web_servers :
    k => instance.private_ip
  }
}

# Use the aggregated data
module "load_balancer" {
  source = "./modules/alb"

  vpc_id              = module.networking.vpc_id
  target_instance_ids = local.all_instance_ids
}
```

## Root Module Exposing Nested Module Outputs

Your root module can expose outputs from child modules:

```hcl
# Root module main.tf

module "networking" {
  source = "./modules/vpc"
  cidr_block = "10.0.0.0/16"
}

module "database" {
  source = "./modules/rds"
  vpc_id     = module.networking.vpc_id
  subnet_ids = module.networking.private_subnet_ids
}

# Expose nested module outputs at root level
output "vpc_id" {
  description = "VPC ID from networking module"
  value       = module.networking.vpc_id
}

output "database_endpoint" {
  description = "Database endpoint from database module"
  value       = module.database.endpoint
  sensitive   = true
}

output "full_infrastructure_config" {
  description = "Complete infrastructure configuration"
  value = {
    networking = {
      vpc_id     = module.networking.vpc_id
      subnet_ids = module.networking.private_subnet_ids
    }
    database = {
      endpoint = module.database.endpoint
      port     = module.database.port
    }
  }
  sensitive = true
}
```

These root-level outputs can be consumed by other Terraform configurations using `terraform_remote_state`.

## Using Remote State to Pass Data Between Root Modules

For completely separate Terraform projects, use remote state:

```hcl
# First project: networking

module "vpc" {
  source = "./modules/vpc"
  cidr_block = "10.0.0.0/16"
}

output "vpc_id" {
  value = module.vpc.vpc_id
}

output "private_subnet_ids" {
  value = module.vpc.private_subnet_ids
}
```

Second project reads the first project's state:

```hcl
# Second project: application

data "terraform_remote_state" "networking" {
  backend = "s3"
  config = {
    bucket = "my-terraform-state"
    key    = "networking/terraform.tfstate"
    region = "us-east-1"
  }
}

module "application" {
  source = "./modules/app"

  # Use outputs from remote state
  vpc_id     = data.terraform_remote_state.networking.outputs.vpc_id
  subnet_ids = data.terraform_remote_state.networking.outputs.private_subnet_ids
}
```

This allows completely independent Terraform projects to share data.

## Transforming Module Outputs Before Passing

Sometimes you need to transform outputs before passing them:

```hcl
module "networking" {
  source = "./modules/vpc"
  cidr_block = "10.0.0.0/16"
}

locals {
  # Transform the subnet list - only use the first two subnets
  limited_subnets = slice(module.networking.private_subnet_ids, 0, 2)

  # Add additional metadata to the VPC ID
  vpc_config = {
    id         = module.networking.vpc_id
    cidr       = module.networking.cidr_block
    managed_by = "terraform"
    created_at = timestamp()
  }
}

module "database" {
  source = "./modules/rds"

  vpc_id     = local.vpc_config.id
  subnet_ids = local.limited_subnets
}
```

Locals allow you to transform, filter, or enrich module outputs before passing them along.

## Handling Sensitive Outputs

When passing sensitive data between modules:

```hcl
# modules/rds/outputs.tf

output "master_password" {
  description = "Database master password"
  value       = random_password.master.result
  sensitive   = true
}

output "connection_string" {
  description = "Full database connection string"
  value       = "postgresql://${aws_db_instance.main.username}:${random_password.master.result}@${aws_db_instance.main.endpoint}/${aws_db_instance.main.db_name}"
  sensitive   = true
}
```

Pass sensitive outputs to other modules:

```hcl
module "database" {
  source = "./modules/rds"
  vpc_id = module.networking.vpc_id
}

module "application" {
  source = "./modules/app"

  # Sensitive values can be passed but won't appear in logs
  database_password = module.database.master_password
  db_connection_string = module.database.connection_string
}
```

The `sensitive = true` flag prevents Terraform from displaying the value in plan/apply output.

## Debugging Module Dependencies

If modules aren't applying in the expected order, you can explicitly declare dependencies:

```hcl
module "networking" {
  source = "./modules/vpc"
  cidr_block = "10.0.0.0/16"
}

module "security" {
  source = "./modules/security"

  # Explicit dependency even without using outputs
  depends_on = [module.networking]

  vpc_id = module.networking.vpc_id
}
```

Though usually explicit dependencies aren't needed - Terraform infers them from output references.

To visualize dependencies:

```bash
terraform graph | dot -Tpng > graph.png
```

This creates a visual diagram showing how modules depend on each other.

## Module Output Best Practices

**Output everything that might be needed:**

```hcl
# modules/vpc/outputs.tf

# Output core infrastructure
output "vpc_id" {
  value = aws_vpc.main.id
}

# Output derived information
output "vpc_cidr" {
  value = aws_vpc.main.cidr_block
}

# Output collections
output "all_subnet_ids" {
  value = concat(
    aws_subnet.public[*].id,
    aws_subnet.private[*].id
  )
}

# Output structured data
output "subnet_config" {
  value = {
    public  = { for s in aws_subnet.public : s.availability_zone => s.id }
    private = { for s in aws_subnet.private : s.availability_zone => s.id }
  }
}
```

**Use clear, descriptive output names:**

```hcl
# Good output names
output "private_subnet_ids" { ... }
output "database_security_group_id" { ... }
output "nat_gateway_elastic_ips" { ... }

# Poor output names
output "subnets" { ... }  # Which subnets?
output "sg" { ... }        # What security group?
output "ips" { ... }       # IPs for what?
```

**Document outputs:**

```hcl
output "vpc_id" {
  description = "ID of the VPC created by this module. Use this when creating resources that need to be placed in the VPC."
  value       = aws_vpc.main.id
}
```

Passing outputs between modules is a fundamental pattern in Terraform. Define clear outputs in your modules, reference them explicitly when calling dependent modules, and let Terraform handle the dependency ordering automatically. This creates modular, reusable infrastructure configurations that are easy to understand and maintain.
