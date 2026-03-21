---
title: 'How to Concatenate Lists in Terraform Using concat()'
excerpt: "Learn how to combine multiple lists in Terraform using the concat() function, plus advanced patterns for merging and manipulating list data."
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2024-09-30'
publishedAt: '2024-09-30T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Infrastructure as Code
  - Functions
  - Lists
  - DevOps
---

When working with lists in Terraform, you'll often need to combine multiple lists into a single list. The `concat()` function is built specifically for this purpose. It takes two or more lists as arguments and returns a new list containing all the elements in order.

This is useful when you're combining configuration from multiple sources, merging subnet IDs from different availability zones, or building resource lists dynamically.

**TLDR:** Use `concat(list1, list2, ...)` to combine multiple lists in Terraform. It returns a new list containing all elements from the input lists in order. You can concatenate any number of lists, and it works with lists of strings, numbers, or objects. For more complex merging with deduplication, use `distinct(concat(...))`. To merge maps instead of lists, use `merge()`.

## Basic List Concatenation

The simplest use of `concat()` combines two lists:

```hcl
locals {
  list_a = ["item1", "item2"]
  list_b = ["item3", "item4"]

  combined = concat(local.list_a, local.list_b)
  # Result: ["item1", "item2", "item3", "item4"]
}

output "combined_list" {
  value = local.combined
}
```

The order matters - elements from the first list appear first, followed by elements from the second list, and so on.

## Concatenating Multiple Lists

You can pass more than two lists to `concat()`:

```hcl
locals {
  public_subnets  = ["subnet-111", "subnet-222"]
  private_subnets = ["subnet-333", "subnet-444"]
  database_subnets = ["subnet-555", "subnet-666"]

  all_subnets = concat(
    local.public_subnets,
    local.private_subnets,
    local.database_subnets
  )
  # Result: ["subnet-111", "subnet-222", "subnet-333", "subnet-444", "subnet-555", "subnet-666"]
}

resource "aws_security_group_rule" "allow_from_all_subnets" {
  type              = "ingress"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = [for subnet in local.all_subnets : data.aws_subnet.subnets[subnet].cidr_block]
  security_group_id = aws_security_group.app.id
}
```

This pattern is helpful when you have subnets organized by tier but need to reference all of them together.

## Combining Variable Lists With Fixed Values

You can mix variable lists with hardcoded lists:

```hcl
variable "additional_security_groups" {
  type    = list(string)
  default = []
}

locals {
  # Always include the default security group, plus any additional ones
  security_groups = concat(
    [aws_security_group.default.id],
    var.additional_security_groups
  )
}

resource "aws_instance" "app" {
  ami           = var.ami_id
  instance_type = "t3.medium"

  vpc_security_group_ids = local.security_groups
}
```

This ensures every instance has the default security group while still allowing additional groups to be specified.

## Concatenating Lists of Objects

`concat()` works with lists of any type, including objects:

```hcl
locals {
  app_containers = [
    {
      name  = "web"
      image = "nginx:latest"
      port  = 80
    },
    {
      name  = "api"
      image = "myapp/api:v1"
      port  = 8080
    }
  ]

  sidecar_containers = [
    {
      name  = "logging"
      image = "fluent/fluent-bit:latest"
      port  = 24224
    }
  ]

  all_containers = concat(local.app_containers, local.sidecar_containers)
  # Result: [{name="web",...}, {name="api",...}, {name="logging",...}]
}

resource "aws_ecs_task_definition" "app" {
  family = "my-app"

  container_definitions = jsonencode([
    for container in local.all_containers : {
      name  = container.name
      image = container.image
      portMappings = [{
        containerPort = container.port
      }]
    }
  ])
}
```

This pattern is useful for adding sidecar containers to your task definitions without duplicating the main container configurations.

## Removing Duplicates After Concatenation

If your lists might contain duplicate values, use `distinct()` after concatenating:

```hcl
locals {
  dev_users  = ["alice@example.com", "bob@example.com", "charlie@example.com"]
  prod_users = ["alice@example.com", "david@example.com"]

  # Without distinct - has duplicates
  all_users_with_dupes = concat(local.dev_users, local.prod_users)
  # Result: ["alice@example.com", "bob@example.com", "charlie@example.com", "alice@example.com", "david@example.com"]

  # With distinct - duplicates removed
  all_users = distinct(concat(local.dev_users, local.prod_users))
  # Result: ["alice@example.com", "bob@example.com", "charlie@example.com", "david@example.com"]
}

resource "aws_iam_group_membership" "developers" {
  name  = "developers"
  users = local.all_users
  group = aws_iam_group.developers.name
}
```

The `distinct()` function removes duplicate values, keeping only the first occurrence of each unique value.

## Conditional Concatenation

Sometimes you only want to concatenate lists when certain conditions are met:

```hcl
variable "environment" {
  type = string
}

variable "enable_monitoring" {
  type    = bool
  default = false
}

locals {
  base_security_groups = [
    aws_security_group.app.id,
    aws_security_group.database.id
  ]

  monitoring_security_groups = [
    aws_security_group.prometheus.id,
    aws_security_group.grafana.id
  ]

  prod_security_groups = [
    aws_security_group.waf.id
  ]

  # Build the list conditionally
  security_groups = concat(
    local.base_security_groups,
    var.enable_monitoring ? local.monitoring_security_groups : [],
    var.environment == "production" ? local.prod_security_groups : []
  )
}
```

The ternary operator `condition ? true_value : false_value` returns an empty list when the condition is false, which `concat()` handles gracefully.

## Flattening Nested Lists

When you have a list of lists and want a single flat list, combine `concat()` with the splat operator or `flatten()`:

```hcl
locals {
  availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]

  # Create subnets per AZ
  subnets_by_az = [
    for az in local.availability_zones : [
      "subnet-public-${az}",
      "subnet-private-${az}"
    ]
  ]
  # Result: [["subnet-public-us-east-1a", "subnet-private-us-east-1a"], [...], [...]]

  # Flatten to a single list
  all_subnet_ids = flatten(local.subnets_by_az)
  # Result: ["subnet-public-us-east-1a", "subnet-private-us-east-1a", "subnet-public-us-east-1b", ...]
}
```

While this example uses `flatten()`, you could also use `concat()` with the splat operator:

```hcl
locals {
  # Alternative approach with concat
  all_subnet_ids = concat(local.subnets_by_az...)
}
```

The `...` (splat) operator unpacks the list of lists into separate arguments for `concat()`.

## Concatenating Output From Multiple Modules

A common use case is combining outputs from multiple modules:

```hcl
module "vpc_us_east_1" {
  source = "./modules/vpc"

  region = "us-east-1"
  cidr   = "10.0.0.0/16"
}

module "vpc_us_west_2" {
  source = "./modules/vpc"

  region = "us-west-2"
  cidr   = "10.1.0.0/16"
}

locals {
  # Combine subnet IDs from both regions
  all_private_subnets = concat(
    module.vpc_us_east_1.private_subnet_ids,
    module.vpc_us_west_2.private_subnet_ids
  )

  all_public_subnets = concat(
    module.vpc_us_east_1.public_subnet_ids,
    module.vpc_us_west_2.public_subnet_ids
  )
}

output "all_subnets" {
  value = concat(local.all_private_subnets, local.all_public_subnets)
}
```

This lets you work with resources across multiple regions or modules uniformly.

## Building Lists Dynamically With for Expressions

Combine `concat()` with `for` expressions for more complex list building:

```hcl
variable "services" {
  type = map(object({
    port           = number
    additional_ports = list(number)
  }))

  default = {
    web = {
      port           = 80
      additional_ports = [443, 8080]
    }
    api = {
      port           = 3000
      additional_ports = [3001]
    }
  }
}

locals {
  # Build a flat list of all ports across all services
  all_ports = distinct(flatten([
    for service_name, service in var.services : concat(
      [service.port],
      service.additional_ports
    )
  ]))
  # Result: [80, 443, 8080, 3000, 3001]
}

resource "aws_security_group_rule" "allow_all_service_ports" {
  count = length(local.all_ports)

  type              = "ingress"
  from_port         = local.all_ports[count.index]
  to_port           = local.all_ports[count.index]
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.services.id
}
```

This pattern extracts all ports from a complex configuration structure into a simple flat list.

## Concatenating With Empty Lists

`concat()` handles empty lists gracefully - they simply don't contribute any elements:

```hcl
locals {
  list_a = ["a", "b"]
  list_b = []
  list_c = ["c"]

  result = concat(local.list_a, local.list_b, local.list_c)
  # Result: ["a", "b", "c"]
}
```

This makes it safe to use conditional expressions that might return empty lists.

## Comparing concat() With Other Functions

**concat() vs merge():**
- `concat()` is for lists: `concat(["a"], ["b"])` → `["a", "b"]`
- `merge()` is for maps: `merge({a=1}, {b=2})` → `{a=1, b=2}`

**concat() vs flatten():**
- `concat()` joins multiple lists: `concat(["a"], ["b"])` → `["a", "b"]`
- `flatten()` unpacks nested lists: `flatten([["a"], ["b"]])` → `["a", "b"]`

**concat() vs union():**
- `concat()` keeps duplicates: `concat(["a", "b"], ["b", "c"])` → `["a", "b", "b", "c"]`
- `union()` removes duplicates: `union(["a", "b"], ["b", "c"])` → `["a", "b", "c"]`

Actually, `union()` is the same as `distinct(concat(...))`:

```hcl
locals {
  list_a = ["a", "b"]
  list_b = ["b", "c"]

  # These are equivalent
  using_distinct = distinct(concat(local.list_a, local.list_b))
  using_union    = union(local.list_a, local.list_b)
  # Both result in: ["a", "b", "c"]
}
```

## Practical Example: Combining Tags

A common pattern is merging tags from multiple sources:

```hcl
variable "common_tags" {
  type = map(string)
  default = {
    ManagedBy = "terraform"
    Project   = "my-app"
  }
}

variable "environment_tags" {
  type = map(string)
  default = {
    Environment = "production"
    CostCenter  = "engineering"
  }
}

locals {
  # Note: This uses merge() for maps, not concat() for lists
  all_tags = merge(
    var.common_tags,
    var.environment_tags
  )
}

resource "aws_instance" "app" {
  ami           = var.ami_id
  instance_type = "t3.medium"

  tags = local.all_tags
}
```

Wait, that example uses `merge()` for maps. For lists of tags (less common), you'd use `concat()`:

```hcl
locals {
  base_tag_specs = [
    {
      resource_type = "instance"
      tags = {
        Name = "app-server"
      }
    }
  ]

  volume_tag_specs = [
    {
      resource_type = "volume"
      tags = {
        Name = "app-volume"
      }
    }
  ]

  all_tag_specifications = concat(
    local.base_tag_specs,
    local.volume_tag_specs
  )
}

resource "aws_launch_template" "app" {
  name = "app-template"

  dynamic "tag_specifications" {
    for_each = local.all_tag_specifications
    content {
      resource_type = tag_specifications.value.resource_type
      tags          = tag_specifications.value.tags
    }
  }
}
```

## Error Handling

`concat()` requires all arguments to be lists. Passing a non-list value causes an error:

```hcl
locals {
  # ERROR: concat() requires all arguments to be lists
  invalid = concat(["a", "b"], "c")
}
```

If you have a single value you want to add to a list, wrap it in brackets:

```hcl
locals {
  # Correct: wrap the string in brackets to make it a list
  valid = concat(["a", "b"], ["c"])
  # Result: ["a", "b", "c"]
}
```

The `concat()` function is straightforward but essential for building dynamic infrastructure configurations. Use it whenever you need to combine lists from multiple sources, and combine it with `distinct()`, `flatten()`, or conditional expressions for more advanced list manipulation.
