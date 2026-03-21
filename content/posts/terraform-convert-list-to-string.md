---
title: 'How to Convert a List to a String in Terraform'
excerpt: "Learn different methods for converting lists to strings in Terraform using join(), jsonencode(), and format() functions for various use cases."
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2024-12-30'
publishedAt: '2024-12-30T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Infrastructure as Code
  - Functions
  - String Manipulation
  - DevOps
---

Terraform often requires converting lists to strings for various purposes like building command-line arguments, creating comma-separated values for tags, or formatting output for external tools. While Terraform works primarily with structured data types, many resources and outputs need string representations of list data.

Understanding the different functions and techniques for list-to-string conversion helps you handle diverse data transformation scenarios.

**TLDR:** Use `join(separator, list)` to convert a list to a string with elements separated by a delimiter. For comma-separated values, use `join(",", list)`. For JSON representation, use `jsonencode(list)`. For more complex formatting, combine join with other string functions. The join function is the most common and straightforward method for list-to-string conversion in Terraform.

## Basic List to String With join()

The `join()` function is the primary way to convert a list to a string:

```hcl
locals {
  availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]

  # Convert to comma-separated string
  az_string = join(",", local.availability_zones)
  # Result: "us-east-1a,us-east-1b,us-east-1c"
}

output "availability_zones_string" {
  value = local.az_string
}
```

The first argument is the separator, and the second is the list.

## Different Separators

Use different separators depending on your needs:

```hcl
locals {
  servers = ["web-1", "web-2", "api-1"]

  # Comma-separated
  comma_separated = join(",", local.servers)
  # Result: "web-1,web-2,api-1"

  # Space-separated
  space_separated = join(" ", local.servers)
  # Result: "web-1 web-2 api-1"

  # Newline-separated
  newline_separated = join("\n", local.servers)
  # Result: "web-1\nweb-2\napi-1"

  # Pipe-separated
  pipe_separated = join("|", local.servers)
  # Result: "web-1|web-2|api-1"

  # No separator (concatenate)
  concatenated = join("", local.servers)
  # Result: "web-1web-2api-1"
}
```

## Converting for Resource Tags

A common use case is creating tag strings from lists:

```hcl
locals {
  environment_list = ["production", "web", "critical"]

  # Convert to comma-separated string for tags
  environment_tags = join(",", local.environment_list)
}

resource "aws_instance" "app" {
  ami           = var.ami_id
  instance_type = "t3.medium"

  tags = {
    Name         = "app-server"
    Environments = local.environment_tags  # "production,web,critical"
  }
}
```

## Creating Command-Line Arguments

Build command-line argument strings from lists:

```hcl
variable "allowed_ips" {
  type    = list(string)
  default = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

locals {
  # Create space-separated IP list for command
  ip_args = join(" ", [
    for ip in var.allowed_ips : "--allow-ip=${ip}"
  ])
  # Result: "--allow-ip=10.0.1.0/24 --allow-ip=10.0.2.0/24 --allow-ip=10.0.3.0/24"
}

resource "null_resource" "configure" {
  provisioner "local-exec" {
    command = "configure-firewall ${local.ip_args}"
  }
}
```

## JSON String Representation

For JSON format, use `jsonencode()`:

```hcl
locals {
  security_groups = ["sg-123", "sg-456", "sg-789"]

  # Convert to JSON array string
  sg_json = jsonencode(local.security_groups)
  # Result: "[\"sg-123\",\"sg-456\",\"sg-789\"]"
}

resource "aws_ssm_parameter" "security_groups" {
  name  = "/app/security-groups"
  type  = "String"
  value = local.sg_json
}
```

## Formatting With Custom Prefixes and Suffixes

Add formatting around each element before joining:

```hcl
locals {
  bucket_names = ["logs", "backups", "archives"]

  # Add ARN prefix to each bucket name
  bucket_arns = join(",", [
    for name in local.bucket_names :
    "arn:aws:s3:::${name}"
  ])
  # Result: "arn:aws:s3:::logs,arn:aws:s3:::backups,arn:aws:s3:::archives"
}
```

## Quoted CSV Format

Create a properly quoted CSV string:

```hcl
locals {
  usernames = ["alice", "bob", "charlie"]

  # Create quoted CSV
  quoted_csv = join(",", [
    for user in local.usernames :
    "\"${user}\""
  ])
  # Result: "\"alice\",\"bob\",\"charlie\""
}
```

## Converting List of Objects

When working with lists of objects, extract specific fields first:

```hcl
variable "instances" {
  type = list(object({
    name = string
    ip   = string
  }))

  default = [
    { name = "web-1", ip = "10.0.1.10" },
    { name = "web-2", ip = "10.0.1.20" },
    { name = "api-1", ip = "10.0.2.10" }
  ]
}

locals {
  # Extract IP addresses and convert to string
  ip_list = join(",", [
    for instance in var.instances : instance.ip
  ])
  # Result: "10.0.1.10,10.0.1.20,10.0.2.10"

  # Create name=ip pairs
  instance_pairs = join(" ", [
    for instance in var.instances :
    "${instance.name}=${instance.ip}"
  ])
  # Result: "web-1=10.0.1.10 web-2=10.0.1.20 api-1=10.0.2.10"
}
```

## Creating SQL IN Clause

Format a list for SQL queries:

```hcl
locals {
  user_ids = [123, 456, 789]

  # Create SQL IN clause
  sql_in_clause = "IN (${join(",", local.user_ids)})"
  # Result: "IN (123,456,789)"

  # For string values, add quotes
  usernames = ["alice", "bob", "charlie"]

  sql_in_usernames = "IN (${join(",", [
    for user in local.usernames : "'${user}'"
  ])})"
  # Result: "IN ('alice','bob','charlie')"
}
```

## Environment Variable Format

Create environment variable strings:

```hcl
variable "env_vars" {
  type = map(string)
  default = {
    DATABASE_URL = "postgresql://localhost/mydb"
    API_KEY      = "secret-key"
    DEBUG        = "true"
  }
}

locals {
  # Convert to KEY=VALUE format, joined by spaces
  env_string = join(" ", [
    for key, value in var.env_vars :
    "${key}=${value}"
  ])
  # Result: "DATABASE_URL=postgresql://localhost/mydb API_KEY=secret-key DEBUG=true"

  # Or newline-separated for .env file format
  env_file = join("\n", [
    for key, value in var.env_vars :
    "${key}=${value}"
  ])
}
```

## Converting Nested Lists

Flatten and convert nested lists:

```hcl
locals {
  subnets_by_az = {
    "us-east-1a" = ["subnet-111", "subnet-222"]
    "us-east-1b" = ["subnet-333", "subnet-444"]
    "us-east-1c" = ["subnet-555", "subnet-666"]
  }

  # Flatten to single list, then convert to string
  all_subnets = join(",", flatten([
    for az, subnets in local.subnets_by_az : subnets
  ]))
  # Result: "subnet-111,subnet-222,subnet-333,subnet-444,subnet-555,subnet-666"
}
```

## Empty List Handling

Handle empty lists gracefully:

```hcl
variable "tags" {
  type    = list(string)
  default = []
}

locals {
  # join returns empty string for empty list
  tags_string = join(",", var.tags)
  # Result: "" (empty string)

  # Provide a default value for empty lists
  tags_with_default = length(var.tags) > 0 ? join(",", var.tags) : "untagged"
}
```

## Formatting for URL Query Parameters

Create URL query parameter strings:

```hcl
variable "filters" {
  type = map(string)
  default = {
    status = "active"
    region = "us-east-1"
    type   = "web"
  }
}

locals {
  # Create URL query string
  query_params = join("&", [
    for key, value in var.filters :
    "${key}=${urlencode(value)}"
  ])
  # Result: "status=active&region=us-east-1&type=web"

  full_url = "https://api.example.com/instances?${local.query_params}"
}
```

## Converting for CloudFormation Parameters

Format list values for CloudFormation:

```hcl
locals {
  availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]

  # CloudFormation expects comma-delimited strings
  az_parameter = join(",", local.availability_zones)
}

resource "aws_cloudformation_stack" "vpc" {
  name = "vpc-stack"

  parameters = {
    AvailabilityZones = local.az_parameter
  }

  template_body = file("${path.module}/vpc-template.yaml")
}
```

## Creating Terraform Output

Format lists for readable output:

```hcl
locals {
  instance_ids = ["i-123", "i-456", "i-789"]

  # Pretty formatted output
  formatted_instances = join("\n  - ", concat([""], local.instance_ids))
  # Result: "\n  - i-123\n  - i-456\n  - i-789"
}

output "instance_list" {
  value       = "Created instances:${local.formatted_instances}"
  description = "List of created instance IDs"
}
```

The output appears as:

```
Created instances:
  - i-123
  - i-456
  - i-789
```

## Combining Multiple Lists

Join multiple lists before converting to string:

```hcl
locals {
  public_ips  = ["1.2.3.4", "5.6.7.8"]
  private_ips = ["10.0.1.10", "10.0.1.20"]

  # Combine and convert
  all_ips = join(",", concat(local.public_ips, local.private_ips))
  # Result: "1.2.3.4,5.6.7.8,10.0.1.10,10.0.1.20"
}
```

## Using format() for Complex Strings

For more control, use `format()`:

```hcl
locals {
  servers = ["web-1", "web-2", "api-1"]

  # Create formatted string with brackets
  formatted = format("[%s]", join(", ", local.servers))
  # Result: "[web-1, web-2, api-1]"

  # Create numbered list
  numbered = join("\n", [
    for i, server in local.servers :
    format("%d. %s", i + 1, server)
  ])
  # Result: "1. web-1\n2. web-2\n3. api-1"
}
```

## Type Conversion Before Joining

Convert non-string elements before joining:

```hcl
locals {
  port_numbers = [80, 443, 8080]

  # Convert numbers to strings, then join
  ports_string = join(",", [
    for port in local.port_numbers : tostring(port)
  ])
  # Result: "80,443,8080"

  # Also works with booleans
  flags = [true, false, true]

  flags_string = join(",", [
    for flag in local.flags : tostring(flag)
  ])
  # Result: "true,false,true"
}
```

## Conditional List to String

Convert lists to strings based on conditions:

```hcl
variable "environment" {
  type = string
}

locals {
  dev_servers    = ["dev-1", "dev-2"]
  prod_servers   = ["prod-1", "prod-2", "prod-3"]

  active_servers = var.environment == "production" ? local.prod_servers : local.dev_servers

  servers_string = join(",", local.active_servers)
}
```

The `join()` function is the primary tool for converting lists to strings in Terraform. Choose your separator based on the target format - commas for CSV, spaces for command arguments, newlines for file formats, or no separator for concatenation. For structured formats like JSON, use `jsonencode()`. Combine join with for expressions to add formatting or transformations before conversion.
