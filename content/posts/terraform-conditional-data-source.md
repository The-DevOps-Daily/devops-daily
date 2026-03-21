---
title: 'How to Use Conditional Data Sources in Terraform'
excerpt: "Learn how to conditionally fetch data in Terraform using count, for_each, and conditional expressions to query external resources only when needed."
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2024-10-20'
publishedAt: '2024-10-20T13:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Infrastructure as Code
  - Data Sources
  - Conditionals
  - DevOps
---

Data sources in Terraform fetch information from external systems like cloud provider APIs, but sometimes you only want to query that data under certain conditions. For example, you might want to look up an existing VPC only when you're not creating a new one, or fetch AMI information only for specific environments.

Terraform provides several ways to make data sources conditional using `count`, `for_each`, and conditional expressions.

**TLDR:** Make data sources conditional using `count = condition ? 1 : 0`. When count is 0, the data source isn't queried. Reference conditional data sources with `data.type.name[0]` when they exist. Use `try()` or `one()` functions to safely reference potentially missing data sources. For more complex scenarios, use `for_each` with a set that's empty when you want to skip the data source.

## Basic Conditional Data Source With count

The most common pattern uses `count` with a conditional expression:

```hcl
variable "use_existing_vpc" {
  type    = bool
  default = false
}

# Only fetch existing VPC data if use_existing_vpc is true
data "aws_vpc" "existing" {
  count = var.use_existing_vpc ? 1 : 0

  filter {
    name   = "tag:Name"
    values = ["existing-vpc"]
  }
}

# Use the data source with index notation
resource "aws_subnet" "app" {
  vpc_id     = var.use_existing_vpc ? data.aws_vpc.existing[0].id : aws_vpc.new[0].id
  cidr_block = "10.0.1.0/24"
}
```

When `use_existing_vpc` is false, the data source isn't queried at all, saving API calls and avoiding errors if the resource doesn't exist.

## Referencing Conditional Data Sources

When using count with data sources, remember they become lists:

```hcl
variable "lookup_ami" {
  type    = bool
  default = true
}

data "aws_ami" "ubuntu" {
  count = var.lookup_ami ? 1 : 0

  most_recent = true
  owners      = ["099720109477"]  # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
}

resource "aws_instance" "app" {
  # Reference with [0] when it exists
  ami           = var.lookup_ami ? data.aws_ami.ubuntu[0].id : var.ami_id
  instance_type = "t3.medium"
}
```

The `[0]` index accesses the first (and only) element when count is 1.

## Using try() for Safe References

The `try()` function provides a cleaner way to reference conditional data sources:

```hcl
data "aws_vpc" "existing" {
  count = var.use_existing_vpc ? 1 : 0

  filter {
    name   = "tag:Name"
    values = ["production-vpc"]
  }
}

locals {
  vpc_id = try(data.aws_vpc.existing[0].id, aws_vpc.new.id)
}

resource "aws_subnet" "app" {
  vpc_id     = local.vpc_id
  cidr_block = "10.0.1.0/24"
}
```

If `data.aws_vpc.existing[0]` doesn't exist, `try()` moves to the next argument instead of erroring.

## Using one() for Single Optional Items

Terraform 1.5+ provides the `one()` function specifically for this pattern:

```hcl
data "aws_secretsmanager_secret" "app" {
  count = var.use_secrets_manager ? 1 : 0

  name = "app-secrets"
}

locals {
  # one() returns the single element or null if list is empty
  secret_arn = one(data.aws_secretsmanager_secret.app[*].arn)
}

resource "aws_ecs_task_definition" "app" {
  family = "app"

  container_definitions = jsonencode([{
    name = "app"

    secrets = local.secret_arn != null ? [
      {
        name      = "APP_SECRET"
        valueFrom = local.secret_arn
      }
    ] : []
  }])
}
```

The `one()` function returns `null` for an empty list, making conditionals cleaner.

## Conditional Data Source Based on Multiple Conditions

Combine multiple conditions using logical operators:

```hcl
variable "environment" {
  type = string
}

variable "use_existing_network" {
  type = bool
}

# Only lookup network in production when use_existing_network is true
data "aws_vpc" "existing" {
  count = var.environment == "production" && var.use_existing_network ? 1 : 0

  filter {
    name   = "tag:Name"
    values = ["production-vpc"]
  }
}

locals {
  vpc_id = var.environment == "production" && var.use_existing_network ? data.aws_vpc.existing[0].id : aws_vpc.new.id
}
```

The data source is only queried when both conditions are true.

## for_each With Conditional Data Sources

Use `for_each` when you want multiple conditional instances:

```hcl
variable "environments" {
  type    = set(string)
  default = ["dev", "staging"]
}

variable "fetch_prod_data" {
  type    = bool
  default = false
}

locals {
  # Add "prod" to the set conditionally
  all_environments = var.fetch_prod_data ? setunion(var.environments, ["prod"]) : var.environments
}

data "aws_vpc" "envs" {
  for_each = local.all_environments

  filter {
    name   = "tag:Environment"
    values = [each.key]
  }
}

output "vpc_ids" {
  value = { for env, vpc in data.aws_vpc.envs : env => vpc.id }
}
```

When `fetch_prod_data` is false, the prod VPC data isn't fetched.

## Conditionally Loading Secrets

A common use case is fetching secrets only when not using default values:

```hcl
variable "use_custom_credentials" {
  type    = bool
  default = false
}

data "aws_secretsmanager_secret_version" "db_password" {
  count = var.use_custom_credentials ? 1 : 0

  secret_id = "production/db-password"
}

resource "aws_db_instance" "main" {
  identifier = "myapp-db"
  engine     = "postgres"

  username = var.use_custom_credentials ? "admin" : "default_user"

  password = var.use_custom_credentials ? (
    data.aws_secretsmanager_secret_version.db_password[0].secret_string
  ) : (
    var.default_password
  )
}
```

This avoids querying Secrets Manager when using default credentials.

## Conditional AMI Lookup by Region

Fetch different data based on runtime conditions:

```hcl
variable "aws_region" {
  type = string
}

locals {
  # Only lookup AMI for specific regions
  should_lookup_ami = contains(["us-east-1", "us-west-2"], var.aws_region)
}

data "aws_ami" "amazon_linux" {
  count = local.should_lookup_ami ? 1 : 0

  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}

resource "aws_instance" "app" {
  ami = local.should_lookup_ami ? (
    data.aws_ami.amazon_linux[0].id
  ) : (
    var.custom_ami_id
  )

  instance_type = "t3.medium"
}
```

The AMI lookup only happens in specific regions.

## Avoiding Circular Dependencies

Be careful with conditional data sources that depend on resources:

```hcl
# Problem: Circular dependency
resource "aws_vpc" "new" {
  count = var.create_new_vpc ? 1 : 0

  cidr_block = "10.0.0.0/16"
}

data "aws_vpc" "target" {
  count = var.create_new_vpc ? 0 : 1

  id = var.existing_vpc_id
}

# This creates a circular dependency if not careful
resource "aws_subnet" "app" {
  vpc_id = var.create_new_vpc ? (
    aws_vpc.new[0].id  # Depends on resource
  ) : (
    data.aws_vpc.target[0].id  # Depends on data
  )
}
```

Solution: Use locals to clarify dependencies:

```hcl
locals {
  vpc_id = var.create_new_vpc ? aws_vpc.new[0].id : data.aws_vpc.target[0].id
}

resource "aws_subnet" "app" {
  vpc_id     = local.vpc_id
  cidr_block = "10.0.1.0/24"
}
```

## Conditional Data Source With Dynamic Filters

Apply filters conditionally within the data source:

```hcl
variable "filter_by_environment" {
  type    = bool
  default = true
}

variable "environment" {
  type = string
}

data "aws_instances" "app" {
  dynamic "filter" {
    for_each = var.filter_by_environment ? [1] : []

    content {
      name   = "tag:Environment"
      values = [var.environment]
    }
  }

  filter {
    name   = "instance-state-name"
    values = ["running"]
  }
}
```

The environment filter is only applied when `filter_by_environment` is true.

## Multiple Exclusive Data Sources

When you need one of several possible data sources:

```hcl
variable "network_source" {
  type = string
  validation {
    condition     = contains(["vpc", "subnet", "none"], var.network_source)
    error_message = "network_source must be vpc, subnet, or none"
  }
}

data "aws_vpc" "selected" {
  count = var.network_source == "vpc" ? 1 : 0
  id    = var.vpc_id
}

data "aws_subnet" "selected" {
  count = var.network_source == "subnet" ? 1 : 0
  id    = var.subnet_id
}

locals {
  vpc_id = (
    var.network_source == "vpc" ? data.aws_vpc.selected[0].id :
    var.network_source == "subnet" ? data.aws_subnet.selected[0].vpc_id :
    null
  )
}
```

Only one data source is queried based on the source type.

## Conditional Data Source in Modules

Modules can expose variables to make data sources conditional:

```hcl
# modules/network/main.tf

variable "use_existing_vpc" {
  type = bool
}

variable "existing_vpc_id" {
  type    = string
  default = ""
}

data "aws_vpc" "existing" {
  count = var.use_existing_vpc ? 1 : 0

  id = var.existing_vpc_id
}

resource "aws_vpc" "new" {
  count = var.use_existing_vpc ? 0 : 1

  cidr_block = "10.0.0.0/16"
}

locals {
  vpc_id = var.use_existing_vpc ? data.aws_vpc.existing[0].id : aws_vpc.new[0].id
}

output "vpc_id" {
  value = local.vpc_id
}
```

Call the module:

```hcl
module "network" {
  source = "./modules/network"

  use_existing_vpc  = true
  existing_vpc_id   = "vpc-12345678"
}
```

## Avoiding Unnecessary API Calls

Conditional data sources help reduce API calls and costs:

```hcl
variable "enable_monitoring" {
  type    = bool
  default = false
}

# Only fetch CloudWatch log groups if monitoring is enabled
data "aws_cloudwatch_log_groups" "app" {
  count = var.enable_monitoring ? 1 : 0

  log_group_name_prefix = "/aws/app/"
}

resource "aws_cloudwatch_dashboard" "app" {
  count = var.enable_monitoring ? 1 : 0

  dashboard_name = "app-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      for log_group in data.aws_cloudwatch_log_groups.app[0].log_group_names : {
        type = "log"
        properties = {
          query  = "fields @timestamp, @message | sort @timestamp desc"
          region = "us-east-1"
          title  = log_group
        }
      }
    ]
  })
}
```

Monitoring-related data is only fetched when monitoring is enabled.

## Error Handling With Conditional Data Sources

Handle cases where conditional data sources might not exist:

```hcl
data "aws_ssm_parameter" "db_endpoint" {
  count = var.use_ssm_parameters ? 1 : 0
  name  = "/app/db/endpoint"
}

locals {
  db_endpoint = var.use_ssm_parameters ? (
    try(data.aws_ssm_parameter.db_endpoint[0].value, var.default_db_endpoint)
  ) : (
    var.default_db_endpoint
  )
}
```

If the SSM parameter doesn't exist, fall back to the default value.

## depends_on With Conditional Data Sources

Sometimes data sources need to wait for resources to be created:

```hcl
resource "aws_s3_bucket" "app" {
  count = var.create_bucket ? 1 : 0

  bucket = "my-app-bucket"
}

data "aws_s3_bucket" "app" {
  count = var.create_bucket ? 1 : 0

  bucket = aws_s3_bucket.app[0].id

  depends_on = [aws_s3_bucket.app]
}
```

The data source waits for the bucket to be created before querying it.

## Testing Conditional Data Sources

Validate that conditional logic works:

```hcl
# Test that VPC data source is only used when expected
output "debug_vpc_source" {
  value = var.use_existing_vpc ? "using existing VPC data source" : "creating new VPC"
}

output "vpc_id_source" {
  value = var.use_existing_vpc ? (
    "vpc ID from data source: ${try(data.aws_vpc.existing[0].id, "not found")}"
  ) : (
    "vpc ID from resource: ${try(aws_vpc.new[0].id, "not created")}"
  )
}
```

Run plan with different variable values to verify behavior:

```bash
# Test with existing VPC
terraform plan -var="use_existing_vpc=true" -var="existing_vpc_id=vpc-123"

# Test with new VPC
terraform plan -var="use_existing_vpc=false"
```

Conditional data sources give you fine-grained control over when external data is fetched. Use `count` for simple on/off conditionals, `try()` or `one()` for safer references, and `for_each` when you need multiple conditional instances. This approach reduces unnecessary API calls, avoids errors from missing resources, and keeps your configurations flexible.
