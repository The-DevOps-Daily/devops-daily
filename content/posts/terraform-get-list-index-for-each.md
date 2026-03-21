---
title: 'How to Get List Index When Using for_each in Terraform'
excerpt: "Learn how to access the index or position when iterating over lists with for_each in Terraform, and understand the differences between for_each and count."
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2024-10-25'
publishedAt: '2024-10-25T10:30:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Infrastructure as Code
  - for_each
  - Loops
  - DevOps
---

When you use `for_each` to create multiple resource instances in Terraform, you're working with maps or sets rather than simple lists. Unlike `count`, which gives you `count.index` to access the position, `for_each` doesn't directly provide an index. This is by design - `for_each` uses keys from your map or set, not numeric positions.

However, there are several ways to get index-like behavior when you need it. This guide shows you how to work with positions and indices when using `for_each`, and when it makes sense to use `count` instead.

**TLDR:** `for_each` doesn't provide a numeric index like `count.index` because it works with map keys or set values, not positions. To get index behavior, convert your list to a map with numeric keys using a `for` expression, or use `count` if you need simple numeric iteration. Use `each.key` to access the map key and `each.value` for the corresponding value. Choose `for_each` over `count` when removing items from the middle of a list shouldn't recreate all subsequent resources.

## Why for_each Doesn't Have an Index

With `count`, you iterate over a numeric sequence. You get `count.index` to tell you the position:

```hcl
resource "aws_instance" "app" {
  count = 3

  ami           = var.ami_id
  instance_type = "t3.medium"

  tags = {
    Name = "app-server-${count.index}"  # 0, 1, 2
  }
}
```

With `for_each`, you iterate over a map or set. Instead of an index, you get `each.key` and `each.value`:

```hcl
resource "aws_instance" "app" {
  for_each = toset(["web", "api", "worker"])

  ami           = var.ami_id
  instance_type = "t3.medium"

  tags = {
    Name = each.key  # "web", "api", "worker"
  }
}
```

The key difference: `for_each` identifies resources by their keys (strings) rather than their position (numbers). This makes it more resilient to changes in the middle of a collection.

If you remove "api" from the set, only the "api" instance gets destroyed. With `count`, removing the second item would cause Terraform to destroy and recreate the third item because its index changed from 2 to 1.

```
count (removing index 1):            for_each (removing "api"):
[0: web, 1: api, 2: worker]         {web: web, api: api, worker: worker}
         ↓                                    ↓
[0: web, 1: worker]                 {web: web, worker: worker}
         ↓                                    ↓
worker moves from index 2 to 1      worker stays unchanged
terraform recreates worker!         only api is destroyed
```

## Converting a List to a Map With Indices

If you have a list and need to use `for_each` with numeric indices, convert the list to a map:

```hcl
variable "availability_zones" {
  type    = list(string)
  default = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

locals {
  # Convert list to map with numeric string keys
  az_map = { for idx, az in var.availability_zones : idx => az }
  # Result: { "0" = "us-east-1a", "1" = "us-east-1b", "2" = "us-east-1c" }
}

resource "aws_subnet" "private" {
  for_each = local.az_map

  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, each.key)
  availability_zone = each.value

  tags = {
    Name = "private-subnet-${each.key}"  # private-subnet-0, private-subnet-1, etc.
    AZ   = each.value
  }
}
```

The `for idx, az in var.availability_zones` syntax gives you both the index (`idx`) and the value (`az`). You then create a map where the index becomes the key.

Now you can use `each.key` as your index and `each.value` as the original list item.

## Converting String Keys to Numbers

If you need the numeric value of `each.key` for calculations (since it's stored as a string), convert it with `parseint`:

```hcl
locals {
  subnets = { for idx, az in var.availability_zones : idx => az }
}

resource "aws_subnet" "private" {
  for_each = local.subnets

  vpc_id     = aws_vpc.main.id

  # Convert each.key from string to number for CIDR calculation
  cidr_block = cidrsubnet(var.vpc_cidr, 8, tonumber(each.key))

  # Or use parseint for more control
  # cidr_block = cidrsubnet(var.vpc_cidr, 8, parseint(each.key, 10))

  availability_zone = each.value

  tags = {
    Name     = "private-subnet-${each.key}"
    Position = tonumber(each.key) + 1  # 1, 2, 3 instead of 0, 1, 2
  }
}
```

The `tonumber()` function converts string numeric keys back to integers for calculations. `parseint(string, base)` gives you more control if you need to specify the numeric base.

## Creating a Map With Custom Keys and Index Values

Sometimes you want meaningful keys but also need access to the position. Create a map that includes both:

```hcl
variable "environments" {
  type = list(string)
  default = ["dev", "staging", "prod"]
}

locals {
  # Create a map with environment name as key and an object containing index as value
  env_map = {
    for idx, env in var.environments :
    env => {
      name     = env
      index    = idx
      priority = idx + 1
    }
  }
  # Result: {
  #   "dev"     = { name = "dev",     index = 0, priority = 1 }
  #   "staging" = { name = "staging", index = 1, priority = 2 }
  #   "prod"    = { name = "prod",    index = 2, priority = 3 }
  # }
}

resource "aws_security_group_rule" "app_access" {
  for_each = local.env_map

  type              = "ingress"
  from_port         = 8000 + each.value.index  # 8000, 8001, 8002
  to_port           = 8000 + each.value.index
  protocol          = "tcp"
  cidr_blocks       = ["10.${each.value.index}.0.0/16"]
  security_group_id = aws_security_group.app[each.key].id

  description = "Access for ${each.value.name} environment (priority ${each.value.priority})"
}
```

This pattern gives you the best of both worlds: meaningful keys for stable resource addresses, plus numeric indices when you need them for calculations.

## When for_each Key Order Matters

Maps in Terraform are unordered collections. If you need to maintain a specific order, you can't rely on map iteration order. However, you can embed order information in your values:

```hcl
variable "deployment_stages" {
  type = map(object({
    order       = number
    environment = string
    wait_time   = number
  }))

  default = {
    "alpha" = {
      order       = 1
      environment = "dev"
      wait_time   = 0
    }
    "beta" = {
      order       = 2
      environment = "staging"
      wait_time   = 300
    }
    "production" = {
      order       = 3
      environment = "prod"
      wait_time   = 600
    }
  }
}

resource "aws_codedeploy_deployment_group" "stages" {
  for_each = var.deployment_stages

  app_name              = aws_codedeploy_app.main.name
  deployment_group_name = each.key
  service_role_arn      = aws_iam_role.codedeploy.arn

  deployment_style {
    deployment_type = "BLUE_GREEN"
  }

  blue_green_deployment_config {
    terminate_blue_instances_on_deployment_success {
      action                           = "TERMINATE"
      termination_wait_time_in_minutes = each.value.wait_time
    }
  }

  auto_rollback_configuration {
    enabled = each.value.order > 1  # Enable rollback for all stages after alpha
    events  = ["DEPLOYMENT_FAILURE"]
  }

  tags = {
    Stage = each.key
    Order = each.value.order
    Env   = each.value.environment
  }
}
```

The `order` field in each object lets you include position-dependent logic even though the map itself isn't ordered.

## Using zipmap for Parallel Lists

If you have two parallel lists and need to iterate over them together, `zipmap` creates a map from them:

```hcl
variable "instance_names" {
  type    = list(string)
  default = ["web-1", "web-2", "api-1", "api-2"]
}

variable "instance_types" {
  type    = list(string)
  default = ["t3.medium", "t3.medium", "t3.large", "t3.large"]
}

locals {
  # Combine the lists into a map
  instance_config = zipmap(var.instance_names, var.instance_types)
  # Result: {
  #   "web-1" = "t3.medium"
  #   "web-2" = "t3.medium"
  #   "api-1" = "t3.large"
  #   "api-2" = "t3.large"
  # }
}

resource "aws_instance" "servers" {
  for_each = local.instance_config

  ami           = var.ami_id
  instance_type = each.value  # The instance type from the second list

  tags = {
    Name = each.key  # The instance name from the first list
  }
}
```

This works well when you have corresponding data in multiple lists that should stay synchronized.

## Combining Multiple Attributes With Index

For complex scenarios where you need multiple attributes plus an index, build a more elaborate map:

```hcl
variable "applications" {
  type = list(object({
    name = string
    port = number
    replicas = number
  }))

  default = [
    { name = "frontend", port = 3000, replicas = 3 },
    { name = "backend",  port = 8080, replicas = 5 },
    { name = "worker",   port = 9000, replicas = 2 }
  ]
}

locals {
  # Convert to a map with index information
  apps_with_index = {
    for idx, app in var.applications :
    app.name => merge(app, {
      index = idx
      priority = idx + 1
      cidr_offset = idx * 16
    })
  }
  # Result: {
  #   "frontend" = { name = "frontend", port = 3000, replicas = 3, index = 0, priority = 1, cidr_offset = 0 }
  #   "backend"  = { name = "backend",  port = 8080, replicas = 5, index = 1, priority = 2, cidr_offset = 16 }
  #   "worker"   = { name = "worker",   port = 9000, replicas = 2, index = 2, priority = 3, cidr_offset = 32 }
  # }
}

resource "aws_ecs_service" "apps" {
  for_each = local.apps_with_index

  name            = each.value.name
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.apps[each.key].arn
  desired_count   = each.value.replicas

  network_configuration {
    subnets = [aws_subnet.app[each.key].id]
    security_groups = [aws_security_group.app[each.key].id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.apps[each.key].arn
    container_name   = each.value.name
    container_port   = each.value.port
  }

  tags = {
    Application = each.value.name
    Priority    = each.value.priority
    Index       = each.value.index
  }
}

resource "aws_subnet" "app" {
  for_each = local.apps_with_index

  vpc_id     = aws_vpc.main.id
  cidr_block = cidrsubnet(var.vpc_cidr, 4, each.value.cidr_offset)

  tags = {
    Name = "${each.value.name}-subnet"
    App  = each.value.name
  }
}
```

This gives each resource access to the original attributes plus computed index-based values.

## When to Use count Instead

If all you need is a simple numeric sequence and you don't plan to remove items from the middle, `count` is simpler:

```hcl
# Simple case: just need N identical resources
resource "aws_instance" "workers" {
  count = var.worker_count

  ami           = var.ami_id
  instance_type = "t3.medium"

  tags = {
    Name = "worker-${count.index + 1}"
  }
}
```

Use `for_each` when:
- You're iterating over a collection of distinct items (not just numbers)
- Items might be added or removed from the middle
- Each resource needs a stable identifier beyond its position
- You want to reference resources by meaningful keys like `aws_instance.app["web"]` instead of `aws_instance.app[0]`

Use `count` when:
- You just need N identical or nearly-identical resources
- The number might change, but you'll only add/remove from the end
- You don't need meaningful identifiers for each instance

## Accessing Other Instances in a for_each Loop

Sometimes you need to reference other instances created in the same `for_each` loop. You can't use `each.key` to reference another instance directly during creation, but you can use the full resource map:

```hcl
locals {
  servers = {
    web    = { type = "t3.medium", subnet = 0 }
    api    = { type = "t3.large",  subnet = 1 }
    worker = { type = "t3.small",  subnet = 2 }
  }
}

resource "aws_instance" "servers" {
  for_each = local.servers

  ami           = var.ami_id
  instance_type = each.value.type
  subnet_id     = var.subnet_ids[each.value.subnet]

  tags = {
    Name = each.key
  }
}

# Create security group rules that reference all instances
resource "aws_security_group_rule" "server_mesh" {
  for_each = local.servers

  type                     = "ingress"
  from_port                = 443
  to_port                  = 443
  protocol                 = "tcp"
  source_security_group_id = aws_instance.servers[each.key].vpc_security_group_ids[0]
  security_group_id        = aws_security_group.app.id

  description = "Allow ${each.key} server to access the app"
}
```

The key is that `aws_instance.servers` is a map of all instances, so you can reference any instance using bracket notation: `aws_instance.servers[each.key]`, `aws_instance.servers["web"]`, etc.

While `for_each` doesn't give you a numeric index by default, you can easily create one when needed by converting your list to a map with numeric keys. Most of the time though, using meaningful string keys makes your infrastructure code more maintainable and resilient to changes.
