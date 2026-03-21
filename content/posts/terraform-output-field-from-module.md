---
title: 'How to Output a Field From a Terraform Module'
excerpt: "Learn how to properly expose resource attributes from Terraform modules using outputs, and how to access nested values from complex data structures."
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2025-02-10'
publishedAt: '2025-02-10T14:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - Infrastructure as Code
  - Modules
  - Outputs
  - DevOps
---

When you create resources in a Terraform module, those resources and their attributes aren't automatically accessible to the code that calls the module. You need to explicitly expose values through output blocks. This design keeps module interfaces clean and controlled, but it means you need to know how to properly define and access outputs.

This guide shows you how to output simple values, complex objects, and nested fields from Terraform modules, plus how to work with outputs from resources created with `count` or `for_each`.

**TLDR:** Define an output block in your module's `outputs.tf` file to expose resource attributes. Access module outputs using `module.<name>.<output_name>` in the calling code. For nested fields in complex objects, use dot notation or bracket notation. For resources created with `count`, outputs become lists; with `for_each`, they become maps. Use the splat operator `[*]` to extract attributes from all instances at once.

## Basic Output Definition

Inside a module, you define outputs in an `outputs.tf` file (by convention, though the filename doesn't technically matter). Each output block specifies a value to expose:

```hcl
# modules/vpc/outputs.tf

output "vpc_id" {
  description = "The ID of the VPC"
  value       = aws_vpc.main.id
}

output "vpc_cidr" {
  description = "The CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}

output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value       = aws_subnet.public[*].id
}
```

The `description` field is optional but recommended - it helps document what the output represents and appears in `terraform output` listings.

From your root module or another module, you access these outputs by referencing the module name:

```hcl
# main.tf

module "networking" {
  source = "./modules/vpc"

  cidr_block = "10.0.0.0/16"
  environment = "production"
}

# Use the module outputs
resource "aws_security_group" "app" {
  name   = "app-sg"
  vpc_id = module.networking.vpc_id  # Accessing the vpc_id output
}

resource "aws_instance" "app" {
  count = 3

  ami           = var.ami_id
  instance_type = "t3.medium"
  subnet_id     = module.networking.public_subnet_ids[count.index]
}
```

The syntax `module.<module_name>.<output_name>` gives you access to whatever value was defined in that output block.

## Outputting Entire Resource Objects

Sometimes you want to expose an entire resource object instead of individual attributes. This gives the caller flexibility to access any attribute they need:

```hcl
# modules/database/outputs.tf

output "db_instance" {
  description = "The full RDS instance object"
  value       = aws_db_instance.main
  sensitive   = true  # Mark as sensitive since it contains connection info
}
```

The caller can then access any attribute of that resource:

```hcl
# main.tf

module "database" {
  source = "./modules/rds"

  allocated_storage = 100
  instance_class    = "db.t3.medium"
}

# Access specific attributes from the full object
resource "aws_ssm_parameter" "db_endpoint" {
  name  = "/app/database/endpoint"
  type  = "String"
  value = module.database.db_instance.endpoint
}

resource "aws_ssm_parameter" "db_port" {
  name  = "/app/database/port"
  type  = "String"
  value = module.database.db_instance.port
}

resource "aws_ssm_parameter" "db_arn" {
  name  = "/app/database/arn"
  type  = "String"
  value = module.database.db_instance.arn
}
```

This approach is convenient but has a downside: it exposes every attribute of the resource, including ones you might not want external code to depend on. For a cleaner interface, explicitly output only the attributes you want to expose.

## Accessing Nested Fields From Complex Objects

Many Terraform resources have complex nested structures. To output a specific nested field, use dot notation to traverse the structure:

```hcl
# modules/eks/outputs.tf

output "cluster_endpoint" {
  description = "Endpoint for the EKS cluster"
  value       = aws_eks_cluster.main.endpoint
}

output "cluster_certificate" {
  description = "Certificate authority data for the cluster"
  value       = aws_eks_cluster.main.certificate_authority[0].data
  sensitive   = true
}

output "cluster_security_group_id" {
  description = "Security group ID attached to the EKS cluster"
  value       = aws_eks_cluster.main.vpc_config[0].cluster_security_group_id
}
```

Notice how `certificate_authority[0].data` and `vpc_config[0].cluster_security_group_id` use array indexing with `[0]` because these attributes are lists (even though they typically contain only one element).

When working with complex nested structures, run `terraform show` or `terraform state show <resource>` to see the exact structure of a resource's attributes:

```bash
terraform state show module.eks.aws_eks_cluster.main
```

This shows you the full attribute structure, making it easier to know what path to use in your output.

## Outputs From Resources Created With Count

When you create multiple resource instances using `count`, the resource becomes a list. Your outputs need to handle this:

```hcl
# modules/instances/main.tf

resource "aws_instance" "app" {
  count = var.instance_count

  ami           = var.ami_id
  instance_type = var.instance_type
  subnet_id     = var.subnet_ids[count.index]

  tags = {
    Name = "app-server-${count.index + 1}"
  }
}
```

To output all instance IDs, use the splat operator:

```hcl
# modules/instances/outputs.tf

output "instance_ids" {
  description = "List of all instance IDs"
  value       = aws_instance.app[*].id
}

output "private_ips" {
  description = "List of private IP addresses"
  value       = aws_instance.app[*].private_ip
}

# Output the entire list of instances
output "instances" {
  description = "Full list of instance objects"
  value       = aws_instance.app[*]
}
```

The `[*]` splat operator extracts the specified attribute from all instances in the list.

In the calling module, these outputs are lists:

```hcl
# main.tf

module "app_servers" {
  source = "./modules/instances"

  instance_count = 3
  ami_id         = "ami-12345678"
}

# Access individual instances by index
resource "aws_route53_record" "app_server_1" {
  zone_id = var.zone_id
  name    = "app1.example.com"
  type    = "A"
  ttl     = 300
  records = [module.app_servers.private_ips[0]]
}

# Or iterate over all instances
resource "aws_route53_record" "app_servers" {
  count = length(module.app_servers.instance_ids)

  zone_id = var.zone_id
  name    = "app${count.index + 1}.example.com"
  type    = "A"
  ttl     = 300
  records = [module.app_servers.private_ips[count.index]]
}
```

## Outputs From Resources Created With for_each

Resources created with `for_each` become maps (objects) rather than lists. Outputs need to reflect this structure:

```hcl
# modules/s3-buckets/main.tf

resource "aws_s3_bucket" "buckets" {
  for_each = var.bucket_configs

  bucket = each.value.name

  tags = merge(
    var.common_tags,
    {
      Purpose = each.value.purpose
    }
  )
}

resource "aws_s3_bucket_versioning" "buckets" {
  for_each = aws_s3_bucket.buckets

  bucket = each.value.id

  versioning_configuration {
    status = "Enabled"
  }
}
```

Output the map of buckets:

```hcl
# modules/s3-buckets/outputs.tf

output "bucket_ids" {
  description = "Map of bucket keys to bucket IDs"
  value       = { for k, bucket in aws_s3_bucket.buckets : k => bucket.id }
}

output "bucket_arns" {
  description = "Map of bucket keys to bucket ARNs"
  value       = { for k, bucket in aws_s3_bucket.buckets : k => bucket.arn }
}

output "buckets" {
  description = "Full map of bucket objects"
  value       = aws_s3_bucket.buckets
}
```

When calling the module, access specific buckets by their key:

```hcl
# main.tf

module "storage" {
  source = "./modules/s3-buckets"

  bucket_configs = {
    logs = {
      name    = "app-logs-bucket"
      purpose = "Application logs"
    }
    assets = {
      name    = "app-static-assets"
      purpose = "Static website assets"
    }
    backups = {
      name    = "app-backups"
      purpose = "Database backups"
    }
  }
}

# Access specific buckets by key
resource "aws_iam_role_policy" "logs_writer" {
  name = "logs-writer"
  role = aws_iam_role.app.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:PutObject",
        "s3:GetObject"
      ]
      Resource = "${module.storage.bucket_arns["logs"]}/*"
    }]
  })
}
```

You can also iterate over the map:

```hcl
# Create CloudWatch alarms for each bucket
resource "aws_cloudwatch_metric_alarm" "bucket_size" {
  for_each = module.storage.bucket_ids

  alarm_name          = "${each.key}-bucket-size"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "BucketSizeBytes"
  namespace           = "AWS/S3"
  period              = "86400"
  statistic           = "Average"
  threshold           = "1000000000"  # 1GB

  dimensions = {
    BucketName = each.value
  }
}
```

## Conditional Outputs

Sometimes you only want to output a value if a resource exists. Use conditional expressions:

```hcl
# modules/alb/outputs.tf

output "alb_dns_name" {
  description = "DNS name of the load balancer (if created)"
  value       = var.create_alb ? aws_lb.main[0].dns_name : null
}

output "target_group_arn" {
  description = "ARN of the target group (if created)"
  value       = var.create_alb ? aws_lb_target_group.main[0].arn : null
}
```

When the module is called with `create_alb = false`, these outputs will be `null` rather than causing an error trying to access a non-existent resource.

The calling code can check for `null` before using the value:

```hcl
# main.tf

module "load_balancer" {
  source = "./modules/alb"

  create_alb = var.environment == "production"
  vpc_id     = module.networking.vpc_id
  subnet_ids = module.networking.public_subnet_ids
}

# Only create the Route53 record if the ALB was created
resource "aws_route53_record" "app" {
  count = module.load_balancer.alb_dns_name != null ? 1 : 0

  zone_id = var.zone_id
  name    = "app.example.com"
  type    = "CNAME"
  ttl     = 300
  records = [module.load_balancer.alb_dns_name]
}
```

## Transforming Output Values

You can use Terraform functions to transform values before outputting them:

```hcl
# modules/networking/outputs.tf

output "subnet_ids" {
  description = "List of all subnet IDs (public and private)"
  value       = concat(
    aws_subnet.public[*].id,
    aws_subnet.private[*].id
  )
}

output "subnet_cidrs" {
  description = "Map of subnet IDs to their CIDR blocks"
  value = merge(
    { for subnet in aws_subnet.public : subnet.id => subnet.cidr_block },
    { for subnet in aws_subnet.private : subnet.id => subnet.cidr_block }
  )
}

output "availability_zones" {
  description = "Unique list of AZs where subnets exist"
  value = distinct(concat(
    aws_subnet.public[*].availability_zone,
    aws_subnet.private[*].availability_zone
  ))
}
```

These transformations make the outputs more useful for the calling code by restructuring or combining values.

## Sensitive Outputs

Mark outputs containing sensitive information with `sensitive = true`:

```hcl
# modules/database/outputs.tf

output "db_password" {
  description = "Master password for the database"
  value       = random_password.db_password.result
  sensitive   = true
}

output "connection_string" {
  description = "Full database connection string"
  value       = "postgresql://${aws_db_instance.main.username}:${random_password.db_password.result}@${aws_db_instance.main.endpoint}/${aws_db_instance.main.db_name}"
  sensitive   = true
}
```

Sensitive outputs are hidden in Terraform's CLI output and logs, but they're still stored in the state file. The calling code can still use them normally:

```hcl
# main.tf

module "database" {
  source = "./modules/rds"

  instance_class = "db.t3.medium"
}

# The sensitive output can still be used in resources
resource "aws_ssm_parameter" "db_connection" {
  name  = "/app/database/connection-string"
  type  = "SecureString"
  value = module.database.connection_string  # Using the sensitive output
}
```

## Depends_on With Module Outputs

If you have resources that depend on a module completing but don't explicitly reference any of its outputs, you can't use `depends_on` with the module directly. Instead, reference one of its outputs to create an implicit dependency:

```hcl
# main.tf

module "networking" {
  source = "./modules/vpc"
  cidr_block = "10.0.0.0/16"
}

module "security" {
  source = "./modules/security-baseline"
  vpc_id = module.networking.vpc_id
}

# This resource needs security baselines in place first
resource "aws_instance" "app" {
  ami           = var.ami_id
  instance_type = "t3.medium"

  # Create implicit dependency by referencing an output
  # Even if we don't use this value directly, it forces the dependency
  subnet_id = module.networking.public_subnet_ids[0]

  # This ensures security module completes before instance creation
  vpc_security_group_ids = [module.security.default_sg_id]
}
```

For Terraform 0.13 and later, you can use `depends_on` with modules:

```hcl
resource "aws_instance" "app" {
  ami           = var.ami_id
  instance_type = "t3.medium"

  depends_on = [
    module.networking,
    module.security
  ]
}
```

But explicitly referencing outputs creates clearer dependencies and is often better for readability.

Well-designed module outputs create a clean interface between modules, making it clear what values are meant to be shared and how different parts of your infrastructure depend on each other. Output only what external code needs to reference, and use descriptive names and descriptions to document the interface.
