---
title: 'Conditional Resource Creation in Terraform Based on .tfvars Variables'
excerpt: 'Learn how to conditionally create Terraform resources using variables from .tfvars files. Learn count, for_each, and dynamic blocks for flexible infrastructure.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2025-01-22'
publishedAt: '2025-01-22T11:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Infrastructure as Code
  - Variables
  - Conditional Logic
  - Configuration Management
featured: true
---

One of Terraform's most powerful features is the ability to create resources conditionally based on input variables. This lets you build flexible infrastructure configurations that adapt to different environments, requirements, or feature flags without duplicating code.

Whether you're deploying optional monitoring resources, creating environment-specific infrastructure, or building reusable modules that work across different scenarios, conditional resource creation is essential for writing maintainable Terraform code.

Let's explore the different approaches to conditional resource creation and when to use each one.

## Prerequisites

Before we dive in, you should have:

- Basic understanding of Terraform resources and variables
- Experience with `.tfvars` files for configuration
- Familiarity with Terraform's `count` and `for_each` meta-arguments
- A working Terraform setup (version 0.12 or later)

## Method 1: Simple Boolean Conditions with count

The most straightforward approach uses a boolean variable with the `count` meta-argument.

### Basic Boolean Conditional

```terraform
# variables.tf
variable "create_monitoring" {
  description = "Whether to create monitoring resources"
  type        = bool
  default     = false
}

# main.tf
resource "aws_cloudwatch_dashboard" "app_dashboard" {
  count          = var.create_monitoring ? 1 : 0
  dashboard_name = "application-metrics"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ApplicationELB", "RequestCount"]
          ]
          region = "us-west-2"
          title  = "Request Count"
        }
      }
    ]
  })
}
```

In your `.tfvars` file, you control whether the dashboard gets created:

```hcl
# production.tfvars
create_monitoring = true

# development.tfvars
create_monitoring = false
```

When `create_monitoring` is `true`, Terraform creates one dashboard. When `false`, it creates zero dashboards.

### Environment-Based Conditional Creation

A common pattern is creating resources only in specific environments:

```terraform
# variables.tf
variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "enable_backup" {
  description = "Enable automated backups"
  type        = bool
  default     = true
}

# main.tf
resource "aws_db_instance" "primary" {
  identifier = "${var.environment}-database"
  engine     = "postgres"
  # Other database configuration...
}

resource "aws_db_automated_backups_replication" "replica" {
  count                    = var.environment == "production" && var.enable_backup ? 1 : 0
  source_db_instance_arn   = aws_db_instance.primary.arn
  destination_region       = "us-east-1"
}
```

This creates backup replication only for production environments when backups are enabled:

```hcl
# production.tfvars
environment = "production"
enable_backup = true

# staging.tfvars
environment = "staging"
enable_backup = false
```

## Method 2: Using for_each for Complex Conditions

While `count` works well for simple on/off scenarios, `for_each` provides more flexibility for complex conditional logic.

### Conditional Resource Sets

```terraform
# variables.tf
variable "environments" {
  description = "Map of environments and their configurations"
  type = map(object({
    instance_type = string
    enable_https  = bool
    backup_days   = number
  }))
  default = {}
}

# main.tf
resource "aws_instance" "app_servers" {
  for_each      = var.environments
  ami           = data.aws_ami.ubuntu.id
  instance_type = each.value.instance_type

  tags = {
    Name        = "${each.key}-app-server"
    Environment = each.key
  }
}

resource "aws_ebs_volume" "backup_storage" {
  for_each = {
    for env, config in var.environments : env => config
    if config.backup_days > 0
  }

  availability_zone = aws_instance.app_servers[each.key].availability_zone
  size             = 20

  tags = {
    Name = "${each.key}-backup-volume"
  }
}
```

Your `.tfvars` file defines which environments get created and their specific configurations:

```hcl
# terraform.tfvars
environments = {
  development = {
    instance_type = "t3.micro"
    enable_https  = false
    backup_days   = 0  # No backup volume created
  }
  staging = {
    instance_type = "t3.small"
    enable_https  = true
    backup_days   = 7  # Backup volume created
  }
  production = {
    instance_type = "t3.large"
    enable_https  = true
    backup_days   = 30  # Backup volume created
  }
}
```

This approach creates app servers for all environments but only creates backup volumes for environments where `backup_days > 0`.

## Method 3: Dynamic Blocks for Conditional Configuration

Sometimes you need to conditionally create parts of a resource rather than the entire resource. Dynamic blocks are perfect for this:

```terraform
# variables.tf
variable "security_rules" {
  description = "Security rules configuration"
  type = object({
    allow_http    = bool
    allow_https   = bool
    allow_ssh     = bool
    ssh_cidrs     = list(string)
  })
}

# main.tf
resource "aws_security_group" "web" {
  name        = "web-security-group"
  description = "Security group for web servers"

  dynamic "ingress" {
    for_each = var.security_rules.allow_http ? [1] : []
    content {
      from_port   = 80
      to_port     = 80
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
      description = "HTTP access"
    }
  }

  dynamic "ingress" {
    for_each = var.security_rules.allow_https ? [1] : []
    content {
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
      description = "HTTPS access"
    }
  }

  dynamic "ingress" {
    for_each = var.security_rules.allow_ssh ? [1] : []
    content {
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      cidr_blocks = var.security_rules.ssh_cidrs
      description = "SSH access"
    }
  }
}
```

Configure which ports are open in your `.tfvars` file:

```hcl
# production.tfvars
security_rules = {
  allow_http  = true
  allow_https = true
  allow_ssh   = true
  ssh_cidrs   = ["10.0.0.0/8"]  # Only internal networks
}

# development.tfvars
security_rules = {
  allow_http  = true
  allow_https = false
  allow_ssh   = true
  ssh_cidrs   = ["0.0.0.0/0"]  # Open SSH for development
}
```

## Method 4: Feature Flags with Multiple Variables

For complex conditional logic, combine multiple variables to create feature flag systems:

```terraform
# variables.tf
variable "features" {
  description = "Feature flags for optional components"
  type = object({
    monitoring    = bool
    auto_scaling  = bool
    cdn          = bool
    cache        = bool
  })
  default = {
    monitoring   = false
    auto_scaling = false
    cdn         = false
    cache       = false
  }
}

variable "environment" {
  description = "Deployment environment"
  type        = string
}

# main.tf
locals {
  # Combine environment and feature flags for complex conditions
  create_advanced_monitoring = var.features.monitoring && var.environment == "production"
  create_cdn = var.features.cdn && (var.environment == "production" || var.environment == "staging")
}

resource "aws_cloudwatch_log_group" "app_logs" {
  count             = var.features.monitoring ? 1 : 0
  name              = "/aws/application/${var.environment}"
  retention_in_days = var.environment == "production" ? 30 : 7
}

resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  count               = local.create_advanced_monitoring ? 1 : 0
  alarm_name          = "${var.environment}-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "120"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors ec2 cpu utilization"
}

resource "aws_cloudfront_distribution" "app_cdn" {
  count = local.create_cdn ? 1 : 0

  origin {
    domain_name = aws_lb.main.dns_name
    origin_id   = "app-origin"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # CDN configuration...
  default_cache_behavior {
    target_origin_id       = "app-origin"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  enabled = true
}
```

Your `.tfvars` files can then enable different feature combinations:

```hcl
# production.tfvars
environment = "production"
features = {
  monitoring   = true
  auto_scaling = true
  cdn         = true
  cache       = true
}

# staging.tfvars
environment = "staging"
features = {
  monitoring   = true
  auto_scaling = false
  cdn         = true
  cache       = false
}

# development.tfvars
environment = "development"
features = {
  monitoring   = false
  auto_scaling = false
  cdn         = false
  cache       = false
}
```

## Common Patterns and Best Practices

### Use Descriptive Variable Names

Instead of generic names, use descriptive variables that clearly indicate their purpose:

```terraform
# Poor naming
variable "flag1" {
  type = bool
}

# Better naming
variable "enable_ssl_termination" {
  description = "Enable SSL termination at the load balancer"
  type        = bool
  default     = true
}
```

### Provide Sensible Defaults

Set defaults that work for the most common use case:

```terraform
variable "backup_retention_days" {
  description = "Number of days to retain backups (0 to disable)"
  type        = number
  default     = 7

  validation {
    condition     = var.backup_retention_days >= 0 && var.backup_retention_days <= 35
    error_message = "Backup retention must be between 0 and 35 days."
  }
}
```

### Use locals for Complex Conditions

When conditional logic becomes complex, move it to locals for readability:

```terraform
locals {
  # Complex conditional logic in locals
  enable_high_availability = var.environment == "production" && var.multi_az_enabled
  backup_schedule = var.environment == "production" ? "daily" : "weekly"

  # Derived configurations
  instance_count = local.enable_high_availability ? var.min_instances * 2 : var.min_instances
}

resource "aws_instance" "app" {
  count         = local.instance_count
  instance_type = var.instance_type
  # Other configuration...
}
```

## Real-World Example: Multi-Environment Application Stack

Here's a comprehensive example showing how to build a flexible application stack:

```terraform
# variables.tf
variable "app_config" {
  description = "Application configuration"
  type = object({
    name         = string
    environment  = string
    domain       = string
    features = object({
      https_redirect    = bool
      waf_protection   = bool
      auto_scaling     = bool
      database_backup  = bool
      monitoring       = bool
    })
    scaling = object({
      min_instances = number
      max_instances = number
      target_cpu    = number
    })
  })
}

# main.tf
locals {
  is_production = var.app_config.environment == "production"

  # Production gets enhanced features
  enable_waf = var.app_config.features.waf_protection && local.is_production
  enable_advanced_monitoring = var.app_config.features.monitoring && local.is_production

  # Database backup enabled for production and staging
  enable_database_backup = var.app_config.features.database_backup &&
                          contains(["production", "staging"], var.app_config.environment)
}

# Application Load Balancer (always created)
resource "aws_lb" "main" {
  name               = "${var.app_config.name}-${var.app_config.environment}"
  internal           = false
  load_balancer_type = "application"
  subnets            = data.aws_subnets.public.ids

  enable_deletion_protection = local.is_production
}

# WAF (only for production with feature enabled)
resource "aws_wafv2_web_acl" "main" {
  count = local.enable_waf ? 1 : 0
  name  = "${var.app_config.name}-waf"
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "rate-limit"
    priority = 1

    override_action {
      none {}
    }

    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "rateLimitRule"
      sampled_requests_enabled   = true
    }

    action {
      block {}
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.app_config.name}WAF"
    sampled_requests_enabled   = true
  }
}

# Auto Scaling Group (conditional)
resource "aws_autoscaling_group" "app" {
  count               = var.app_config.features.auto_scaling ? 1 : 0
  name                = "${var.app_config.name}-asg"
  vpc_zone_identifier = data.aws_subnets.private.ids
  target_group_arns   = [aws_lb_target_group.app.arn]
  health_check_type   = "ELB"

  min_size         = var.app_config.scaling.min_instances
  max_size         = var.app_config.scaling.max_instances
  desired_capacity = var.app_config.scaling.min_instances

  launch_template {
    id      = aws_launch_template.app.id
    version = "$Latest"
  }

  tag {
    key                 = "Name"
    value               = "${var.app_config.name}-instance"
    propagate_at_launch = true
  }
}

# Database backup (conditional)
resource "aws_db_automated_backups_replication" "main" {
  count                  = local.enable_database_backup ? 1 : 0
  source_db_instance_arn = aws_db_instance.main.arn
  destination_region     = "us-east-1"
}
```

Your environment-specific `.tfvars` files then control exactly what gets deployed:

```hcl
# production.tfvars
app_config = {
  name        = "myapp"
  environment = "production"
  domain      = "myapp.com"
  features = {
    https_redirect   = true
    waf_protection  = true
    auto_scaling    = true
    database_backup = true
    monitoring      = true
  }
  scaling = {
    min_instances = 3
    max_instances = 10
    target_cpu    = 70
  }
}

# development.tfvars
app_config = {
  name        = "myapp"
  environment = "development"
  domain      = "dev.myapp.com"
  features = {
    https_redirect   = false
    waf_protection  = false
    auto_scaling    = false
    database_backup = false
    monitoring      = false
  }
  scaling = {
    min_instances = 1
    max_instances = 2
    target_cpu    = 80
  }
}
```

## Common Pitfalls and Solutions

### Avoid count with Complex Objects

```terraform
# Problematic - changing the condition can cause unwanted resource recreation
resource "aws_instance" "app" {
  count = var.create_instance ? 1 : 0
  # Complex configuration that's expensive to recreate...
}

# Better - use for_each with a set
resource "aws_instance" "app" {
  for_each = var.create_instance ? toset(["instance"]) : toset([])
  # Same configuration, but more predictable behavior
}
```

### Handle Empty Collections Gracefully

```terraform
# This can cause errors if the list is empty
resource "aws_security_group_rule" "ingress" {
  count = length(var.ingress_rules)
  # Configuration...
}

# Better approach with validation
variable "ingress_rules" {
  type = list(object({
    from_port = number
    to_port   = number
    protocol  = string
  }))
  default = []

  validation {
    condition = alltrue([
      for rule in var.ingress_rules :
      rule.from_port >= 0 && rule.from_port <= 65535
    ])
    error_message = "Port numbers must be between 0 and 65535."
  }
}
```

### Test Different Configurations

Always test your conditional logic with different variable combinations:

```bash
# Test with minimal configuration
terraform plan -var-file="minimal.tfvars"

# Test with full configuration
terraform plan -var-file="production.tfvars"

# Test edge cases
terraform plan -var-file="edge-cases.tfvars"
```

## Performance Considerations

### Use for_each Over count for Complex Resources

When dealing with multiple similar resources that might change, `for_each` is generally more efficient than `count`:

```terraform
# Less efficient - changing order can cause resource recreation
variable "databases" {
  type = list(string)
  default = ["users", "products", "orders"]
}

resource "aws_db_instance" "app_databases" {
  count      = length(var.databases)
  identifier = var.databases[count.index]
  # Other configuration...
}

# More efficient - resources are identified by key, not index
variable "databases" {
  type = map(object({
    allocated_storage = number
    instance_class    = string
  }))
  default = {
    users = {
      allocated_storage = 20
      instance_class    = "db.t3.micro"
    }
    products = {
      allocated_storage = 50
      instance_class    = "db.t3.small"
    }
  }
}

resource "aws_db_instance" "app_databases" {
  for_each          = var.databases
  identifier        = each.key
  allocated_storage = each.value.allocated_storage
  instance_class    = each.value.instance_class
  # Other configuration...
}
```

Conditional resource creation is a powerful pattern that makes your Terraform code more flexible and reusable. By combining boolean variables, complex objects, and conditional expressions, you can create infrastructure that adapts to different requirements without code duplication.

The key is to start simple with basic boolean conditions and gradually add complexity as your needs grow. Always prioritize readability and maintainability over clever conditional logic – your future self and teammates will thank you.

Remember to test your conditional logic thoroughly across different variable combinations, and use descriptive variable names that make your intentions clear.
