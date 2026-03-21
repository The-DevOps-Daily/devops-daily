---
title: 'How to Reference Resources Created With for_each in Terraform'
excerpt: "Learn how to reference individual resources and attributes from for_each loops in other Terraform resources, including cross-resource dependencies and data extraction patterns."
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2024-10-12'
publishedAt: '2024-10-12T09:45:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Infrastructure as Code
  - for_each
  - Resources
  - DevOps
---

When you create multiple resources using `for_each`, those resources become a map rather than a single resource. This changes how you reference them in other parts of your Terraform configuration. Instead of accessing attributes directly, you need to specify which instance from the map you want to reference using its key.

Understanding how to properly reference `for_each` resources is essential for building complex infrastructure where resources depend on each other.

**TLDR:** Resources created with `for_each` become maps where the key is from your `for_each` expression. Reference individual instances with `resource_type.resource_name[key].attribute`. To reference all instances, use `resource_type.resource_name` (the map) or extract values with `for` expressions like `[for k, v in resource_type.resource_name : v.attribute]`. Use `values(resource_type.resource_name)` to get a list of all resource instances.

## Basic for_each Reference

When you create resources with `for_each`, each instance gets a unique key:

```hcl
variable "instances" {
  type = map(object({
    instance_type = string
    ami           = string
  }))

  default = {
    web = {
      instance_type = "t3.medium"
      ami           = "ami-12345678"
    }
    api = {
      instance_type = "t3.large"
      ami           = "ami-87654321"
    }
  }
}

resource "aws_instance" "servers" {
  for_each = var.instances

  instance_type = each.value.instance_type
  ami           = each.value.ami

  tags = {
    Name = each.key
  }
}
```

Now `aws_instance.servers` is a map with keys `"web"` and `"api"`. To reference a specific instance:

```hcl
# Reference the web server's ID
resource "aws_security_group_rule" "allow_web" {
  type              = "ingress"
  from_port         = 80
  to_port           = 80
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_instance.servers["web"].vpc_security_group_ids[0]
}

# Output the API server's private IP
output "api_server_ip" {
  value = aws_instance.servers["api"].private_ip
}
```

The syntax `aws_instance.servers["web"]` accesses the instance with key `"web"` from the map.

## Referencing in Another for_each Loop

When creating resources that depend on a `for_each` resource, you can iterate over the same map:

```hcl
resource "aws_instance" "servers" {
  for_each = var.instances

  instance_type = each.value.instance_type
  ami           = each.value.ami

  tags = {
    Name = each.key
  }
}

# Create an EIP for each instance
resource "aws_eip" "server_ips" {
  for_each = aws_instance.servers

  instance = each.value.id
  domain   = "vpc"

  tags = {
    Name = "${each.key}-eip"
  }
}
```

Here, `for_each = aws_instance.servers` iterates over the map of instances. Inside the loop:
- `each.key` is the instance name ("web", "api")
- `each.value` is the full instance resource object
- `each.value.id` accesses the instance ID

## Creating One Resource That References All for_each Instances

Sometimes you need a single resource that references all instances from a `for_each`:

```hcl
resource "aws_instance" "servers" {
  for_each = toset(["web", "api", "worker"])

  instance_type = "t3.medium"
  ami           = var.ami_id

  tags = {
    Name = each.key
  }
}

# Load balancer that includes all instances
resource "aws_lb_target_group_attachment" "servers" {
  for_each = aws_instance.servers

  target_group_arn = aws_lb_target_group.main.arn
  target_id        = each.value.id
  port             = 80
}
```

This creates a target group attachment for each instance, connecting all of them to the same load balancer.

## Extracting a List From for_each Resources

To get a list of values from all instances:

```hcl
resource "aws_instance" "servers" {
  for_each = var.instances

  instance_type = each.value.instance_type
  ami           = each.value.ami
}

# Get all instance IDs as a list
locals {
  instance_ids = [for k, v in aws_instance.servers : v.id]
  # Result: ["i-12345", "i-67890", ...]

  # Get all private IPs
  private_ips = [for k, v in aws_instance.servers : v.private_ip]
  # Result: ["10.0.1.10", "10.0.1.20", ...]

  # Create a map of names to IPs
  server_ips = {
    for k, v in aws_instance.servers : k => v.private_ip
  }
  # Result: { "web" = "10.0.1.10", "api" = "10.0.1.20" }
}

# Use the list in another resource
resource "aws_route53_record" "servers" {
  zone_id = var.zone_id
  name    = "servers.example.com"
  type    = "A"
  ttl     = 300
  records = local.private_ips
}
```

The `for` expression extracts attributes from all instances into a list or map that can be used elsewhere.

## Using values() to Get All Resource Objects

The `values()` function converts a map to a list:

```hcl
resource "aws_instance" "servers" {
  for_each = var.instances

  instance_type = each.value.instance_type
  ami           = each.value.ami
}

# Get all instance objects as a list
locals {
  all_servers = values(aws_instance.servers)
  # This is a list of all instance resources
}

# Use with another for_each (requires converting back to map)
resource "aws_cloudwatch_metric_alarm" "cpu" {
  for_each = aws_instance.servers

  alarm_name          = "${each.key}-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "120"
  statistic           = "Average"
  threshold           = "80"

  dimensions = {
    InstanceId = each.value.id
  }
}
```

## Conditional References Based on Keys

You can conditionally reference instances based on their keys:

```hcl
resource "aws_instance" "servers" {
  for_each = var.instances

  instance_type = each.value.instance_type
  ami           = each.value.ami

  tags = {
    Name        = each.key
    Environment = each.key == "prod" ? "production" : "development"
  }
}

# Only create an alarm for the production instance
resource "aws_cloudwatch_metric_alarm" "prod_cpu" {
  count = contains(keys(aws_instance.servers), "prod") ? 1 : 0

  alarm_name          = "prod-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "120"
  statistic           = "Average"
  threshold           = "80"

  dimensions = {
    InstanceId = aws_instance.servers["prod"].id
  }
}
```

The `contains(keys(...), "key")` checks if a specific key exists in the map before referencing it.

## Referencing Nested Attributes

When instances have complex nested attributes:

```hcl
resource "aws_instance" "servers" {
  for_each = var.instances

  instance_type = each.value.instance_type
  ami           = each.value.ami

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
  }
}

# Access nested attributes
output "root_volume_ids" {
  value = {
    for k, v in aws_instance.servers :
    k => v.root_block_device[0].volume_id
  }
}
```

Use bracket notation `[0]` when the nested attribute is a list.

## Creating Security Group Rules for for_each Instances

A common pattern is creating security group rules that allow traffic between instances:

```hcl
resource "aws_instance" "servers" {
  for_each = var.instances

  instance_type = each.value.instance_type
  ami           = each.value.ami

  vpc_security_group_ids = [aws_security_group.servers[each.key].id]
}

# Security group for each instance
resource "aws_security_group" "servers" {
  for_each = var.instances

  name        = "${each.key}-sg"
  description = "Security group for ${each.key} server"
  vpc_id      = var.vpc_id
}

# Allow each server to talk to every other server
resource "aws_security_group_rule" "inter_server" {
  for_each = {
    for pair in setproduct(keys(var.instances), keys(var.instances)) :
    "${pair[0]}-to-${pair[1]}" => {
      source = pair[0]
      target = pair[1]
    }
    if pair[0] != pair[1]
  }

  type                     = "ingress"
  from_port                = 0
  to_port                  = 65535
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.servers[each.value.source].id
  security_group_id        = aws_security_group.servers[each.value.target].id
}
```

This creates rules allowing every server to communicate with every other server using `setproduct()` to generate all combinations.

## Referencing Specific Subset of for_each Resources

To reference only certain instances from a `for_each` resource:

```hcl
resource "aws_instance" "servers" {
  for_each = var.instances

  instance_type = each.value.instance_type
  ami           = each.value.ami

  tags = {
    Name = each.key
    Tier = each.value.tier
  }
}

locals {
  # Get only web tier instances
  web_servers = {
    for k, v in aws_instance.servers :
    k => v if v.tags["Tier"] == "web"
  }

  # List of IDs for web servers only
  web_server_ids = [for k, v in local.web_servers : v.id]
}

# Create a load balancer only for web servers
resource "aws_lb_target_group_attachment" "web" {
  for_each = local.web_servers

  target_group_arn = aws_lb_target_group.web.arn
  target_id        = each.value.id
  port             = 80
}
```

The conditional `if` clause filters the map to only include instances matching the criteria.

## Depending on All for_each Resources

Sometimes a resource needs to wait for all `for_each` instances to be created:

```hcl
resource "aws_instance" "servers" {
  for_each = var.instances

  instance_type = each.value.instance_type
  ami           = each.value.ami
}

# This runs after all instances are created
resource "null_resource" "post_deploy" {
  # Implicit dependency on all instances
  triggers = {
    instance_ids = join(",", [for k, v in aws_instance.servers : v.id])
  }

  provisioner "local-exec" {
    command = "echo 'All servers deployed: ${self.triggers.instance_ids}'"
  }
}
```

The trigger includes data from all instances, creating an implicit dependency on the entire `for_each` resource.

You can also use `depends_on`:

```hcl
resource "null_resource" "post_deploy" {
  depends_on = [aws_instance.servers]

  provisioner "local-exec" {
    command = "echo 'All servers are ready'"
  }
}
```

When using `depends_on` with a `for_each` resource, Terraform waits for all instances to be created.

## Dynamic Blocks With for_each Resource References

You can use dynamic blocks to create multiple sub-resources based on `for_each` resources:

```hcl
resource "aws_instance" "servers" {
  for_each = var.instances

  instance_type = each.value.instance_type
  ami           = each.value.ami
}

resource "aws_route53_zone" "main" {
  name = "example.com"
}

resource "aws_route53_record" "servers" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "servers.example.com"
  type    = "A"
  ttl     = 300

  # Create a record for each server's IP
  records = [for k, v in aws_instance.servers : v.private_ip]
}

# Or create individual records
resource "aws_route53_record" "server_individual" {
  for_each = aws_instance.servers

  zone_id = aws_route53_zone.main.zone_id
  name    = "${each.key}.example.com"
  type    = "A"
  ttl     = 300
  records = [each.value.private_ip]
}
```

## Errors and Troubleshooting

**Error: "This object does not have an attribute named"**

This happens when you try to access a `for_each` resource without specifying a key:

```hcl
# Wrong - servers is a map, not a single resource
output "instance_id" {
  value = aws_instance.servers.id  # ERROR
}

# Correct - specify which instance
output "instance_id" {
  value = aws_instance.servers["web"].id
}
```

**Error: "The given key does not identify an element in this collection"**

This means you're trying to access a key that doesn't exist:

```hcl
# Error if "database" key doesn't exist
output "db_ip" {
  value = aws_instance.servers["database"].private_ip
}

# Safe approach with lookup
output "db_ip" {
  value = lookup(aws_instance.servers, "database", null) != null ? aws_instance.servers["database"].private_ip : null
}
```

**Reference: "Can't access attributes of entire map"**

Some operations require a specific instance, not the entire map:

```hcl
# Wrong - trying to pass entire map where single value expected
resource "aws_eip" "server" {
  instance = aws_instance.servers  # ERROR - needs single instance ID
}

# Correct - specify which instance
resource "aws_eip" "server" {
  instance = aws_instance.servers["web"].id
}

# Or use for_each to create one EIP per instance
resource "aws_eip" "servers" {
  for_each = aws_instance.servers

  instance = each.value.id
}
```

## Converting Between for_each and count

If you need to reference `for_each` resources in a context that expects a list:

```hcl
resource "aws_instance" "servers" {
  for_each = var.instances

  instance_type = each.value.instance_type
  ami           = each.value.ami
}

# Convert to list for use with count
resource "aws_route53_health_check" "servers" {
  count = length(keys(aws_instance.servers))

  ip_address = values(aws_instance.servers)[count.index].private_ip
  port       = 80
  type       = "HTTP"
}
```

Though usually it's better to stick with `for_each` throughout:

```hcl
resource "aws_route53_health_check" "servers" {
  for_each = aws_instance.servers

  ip_address = each.value.private_ip
  port       = 80
  type       = "HTTP"
}
```

Referencing `for_each` resources requires understanding that they're maps, not single resources. Always specify the key when accessing individual instances, and use `for` expressions or `values()` when you need to work with all instances collectively. This gives you flexible, maintainable infrastructure configurations that scale as your needs grow.
