---
title: 'How to Configure ECS Fargate Task Execution Roles With Terraform'
excerpt: "Learn how to properly set up IAM execution roles for ECS Fargate task definitions in Terraform, including permissions for ECR, CloudWatch Logs, and Secrets Manager."
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2025-01-28'
publishedAt: '2025-01-28T09:30:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - AWS
  - ECS
  - Fargate
  - IAM
  - DevOps
---

When you create an ECS Fargate task definition in Terraform, you need to specify an execution role. This role is what ECS uses to pull container images from ECR, write logs to CloudWatch, and retrieve secrets from Secrets Manager or Systems Manager Parameter Store. Without the proper execution role, your tasks won't start or will fail to access required resources.

The execution role is different from the task role - the execution role is for the ECS agent itself, while the task role is for the application running in your container. Understanding this distinction and configuring both correctly is essential for secure and functional Fargate deployments.

**TLDR:** An ECS Fargate execution role is an IAM role that allows the ECS agent to pull container images, send logs to CloudWatch, and retrieve secrets on behalf of your task. Create it with `aws_iam_role` allowing `ecs-tasks.amazonaws.com` to assume it, attach the managed policy `AmazonECSTaskExecutionRolePolicy`, and add any additional permissions for secrets or custom registries. Reference it in your task definition's `execution_role_arn` field. The task role (`task_role_arn`) is separate and grants permissions to your application code.

## Understanding Execution Role vs Task Role

Before diving into the configuration, it's important to understand the two IAM roles used with Fargate:

```
ECS Fargate Task Lifecycle:

1. ECS Agent starts task
   ├─> Uses Execution Role to:
   │   ├─> Pull image from ECR
   │   ├─> Retrieve secrets from Secrets Manager
   │   └─> Create CloudWatch log streams
   │
2. Container runs application
   └─> Uses Task Role to:
       ├─> Access S3 buckets
       ├─> Query DynamoDB tables
       └─> Call other AWS services
```

The execution role acts during task startup and shutdown, while the task role is available to your application code throughout the task's lifecycle.

## Basic Execution Role Configuration

Here's a minimal execution role setup for Fargate:

```hcl
# Create the execution role
resource "aws_iam_role" "ecs_task_execution" {
  name = "ecs-task-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
    }]
  })
}

# Attach the AWS managed policy for basic ECS task execution
resource "aws_iam_role_policy_attachment" "ecs_task_execution_policy" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Create the task definition using the execution role
resource "aws_ecs_task_definition" "app" {
  family                   = "my-app"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn

  container_definitions = jsonencode([{
    name  = "app"
    image = "123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app:latest"

    portMappings = [{
      containerPort = 8080
      protocol      = "tcp"
    }]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/my-app"
        "awslogs-region"        = "us-east-1"
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])
}
```

The `AmazonECSTaskExecutionRolePolicy` managed policy includes permissions for:
- Pulling images from ECR
- Creating and writing to CloudWatch Logs
- Basic ECS API calls

This is sufficient for simple use cases where your image is in ECR and you're using CloudWatch for logging.

## Adding Secrets Manager Permissions

When your task needs to retrieve secrets from AWS Secrets Manager (common for database passwords or API keys), add permissions to the execution role:

```hcl
# Create the execution role
resource "aws_iam_role" "ecs_task_execution" {
  name = "ecs-task-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
    }]
  })
}

# Attach the base execution policy
resource "aws_iam_role_policy_attachment" "ecs_task_execution_policy" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Add Secrets Manager permissions
resource "aws_iam_role_policy" "secrets_access" {
  name = "secrets-manager-access"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue"
      ]
      Resource = [
        aws_secretsmanager_secret.db_password.arn,
        aws_secretsmanager_secret.api_key.arn
      ]
    }]
  })
}

# Reference secrets in the task definition
resource "aws_ecs_task_definition" "app" {
  family                   = "my-app"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn

  container_definitions = jsonencode([{
    name  = "app"
    image = "123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app:latest"

    # Environment variables from secrets
    secrets = [
      {
        name      = "DB_PASSWORD"
        valueFrom = aws_secretsmanager_secret.db_password.arn
      },
      {
        name      = "API_KEY"
        valueFrom = aws_secretsmanager_secret.api_key.arn
      }
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/my-app"
        "awslogs-region"        = "us-east-1"
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])
}
```

This pattern restricts the execution role to only the specific secrets your task needs, following the principle of least privilege.

## Using Systems Manager Parameter Store

Parameter Store is another common option for storing configuration values:

```hcl
# Add Parameter Store permissions to execution role
resource "aws_iam_role_policy" "parameter_store_access" {
  name = "parameter-store-access"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameters",
          "ssm:GetParameter"
        ]
        Resource = [
          "arn:aws:ssm:us-east-1:123456789012:parameter/app/*"
        ]
      },
      {
        # For SecureString parameters, you also need KMS access
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = [
          aws_kms_key.parameter_encryption.arn
        ]
      }
    ]
  })
}

resource "aws_ecs_task_definition" "app" {
  family                   = "my-app"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn

  container_definitions = jsonencode([{
    name  = "app"
    image = "123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app:latest"

    # Reference Parameter Store values
    secrets = [
      {
        name      = "DATABASE_URL"
        valueFrom = "arn:aws:ssm:us-east-1:123456789012:parameter/app/database-url"
      },
      {
        name      = "REDIS_URL"
        valueFrom = "arn:aws:ssm:us-east-1:123456789012:parameter/app/redis-url"
      }
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/my-app"
        "awslogs-region"        = "us-east-1"
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])
}
```

The KMS decrypt permission is only needed if you're using SecureString parameters, which encrypt the values.

## Creating the Task Role for Application Permissions

The task role is separate from the execution role and grants permissions to your application code:

```hcl
# Task role - used by the application
resource "aws_iam_role" "ecs_task" {
  name = "ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
    }]
  })
}

# Grant the application access to S3
resource "aws_iam_role_policy" "app_s3_access" {
  name = "app-s3-access"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:GetObject",
        "s3:PutObject"
      ]
      Resource = [
        "${aws_s3_bucket.app_data.arn}/*"
      ]
    }]
  })
}

# Grant access to DynamoDB
resource "aws_iam_role_policy" "app_dynamodb_access" {
  name = "app-dynamodb-access"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ]
      Resource = [
        aws_dynamodb_table.app_data.arn
      ]
    }]
  })
}

resource "aws_ecs_task_definition" "app" {
  family                   = "my-app"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"

  # Both roles specified
  execution_role_arn = aws_iam_role.ecs_task_execution.arn
  task_role_arn      = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name  = "app"
    image = "123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app:latest"

    portMappings = [{
      containerPort = 8080
      protocol      = "tcp"
    }]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/my-app"
        "awslogs-region"        = "us-east-1"
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])
}
```

The task role is what your application uses when making AWS SDK calls. The execution role never appears in your application code - it's only used by ECS infrastructure.

## Pulling from Private ECR in Another Account

If your container images are in an ECR repository in a different AWS account, add cross-account permissions:

```hcl
resource "aws_iam_role_policy" "cross_account_ecr" {
  name = "cross-account-ecr-access"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage"
      ]
      Resource = "*"
    }]
  })
}
```

The `ecr:GetAuthorizationToken` action requires `Resource = "*"` because it doesn't operate on a specific repository.

You'll also need to configure the ECR repository in the other account to allow access:

```hcl
# In the account hosting the ECR repository
resource "aws_ecr_repository_policy" "allow_cross_account" {
  repository = aws_ecr_repository.app.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        AWS = "arn:aws:iam::${var.ecs_account_id}:role/ecs-task-execution-role"
      }
      Action = [
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:BatchCheckLayerAvailability"
      ]
    }]
  })
}
```

## Using a Module for Reusable Role Configuration

When you have multiple services, create a module for execution role management:

```hcl
# modules/ecs-execution-role/main.tf

variable "service_name" {
  type = string
}

variable "secrets_arns" {
  type    = list(string)
  default = []
}

variable "additional_policies" {
  type    = list(string)
  default = []
}

resource "aws_iam_role" "execution" {
  name = "${var.service_name}-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "base" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "secrets" {
  count = length(var.secrets_arns) > 0 ? 1 : 0

  name = "${var.service_name}-secrets-access"
  role = aws_iam_role.execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = var.secrets_arns
    }]
  })
}

resource "aws_iam_role_policy_attachment" "additional" {
  count = length(var.additional_policies)

  role       = aws_iam_role.execution.name
  policy_arn = var.additional_policies[count.index]
}

output "arn" {
  value = aws_iam_role.execution.arn
}

output "name" {
  value = aws_iam_role.execution.name
}
```

Use the module for each service:

```hcl
module "app_execution_role" {
  source = "./modules/ecs-execution-role"

  service_name = "my-app"
  secrets_arns = [
    aws_secretsmanager_secret.db_password.arn,
    aws_secretsmanager_secret.api_key.arn
  ]
}

resource "aws_ecs_task_definition" "app" {
  family                   = "my-app"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = module.app_execution_role.arn

  container_definitions = jsonencode([{
    name  = "app"
    image = "123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app:latest"

    secrets = [
      {
        name      = "DB_PASSWORD"
        valueFrom = aws_secretsmanager_secret.db_password.arn
      }
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/my-app"
        "awslogs-region"        = "us-east-1"
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])
}
```

## Common Errors and Troubleshooting

**Error: "CannotPullContainerError: pull image manifest has been retried"**

This usually means the execution role doesn't have permissions to pull from ECR. Verify:
- The execution role has the `AmazonECSTaskExecutionRolePolicy` attached
- Your ECR repository exists and the image tag is correct
- If using a custom KMS key for ECR, the execution role has decrypt permissions

**Error: "ResourceInitializationError: unable to pull secrets or registry auth"**

The execution role can't access Secrets Manager or Parameter Store. Check:
- The execution role has `secretsmanager:GetSecretValue` permissions
- The secret ARN in the task definition matches the actual secret
- For Parameter Store, you have `ssm:GetParameters` permissions
- For SecureString parameters, you have KMS decrypt permissions

**Error: "LogDriver: Failed to create cloudwatch logs"**

The execution role can't create CloudWatch log streams. Make sure:
- The log group exists (create it with Terraform first)
- The execution role has `logs:CreateLogStream` and `logs:PutLogEvents` permissions
- The log group ARN in permissions matches what's in your task definition

## Creating CloudWatch Log Groups

Don't forget to create the log group referenced in your task definition:

```hcl
resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/my-app"
  retention_in_days = 7

  tags = {
    Application = "my-app"
  }
}

# If you need custom permissions beyond the managed policy
resource "aws_iam_role_policy" "cloudwatch_logs" {
  name = "cloudwatch-logs-access"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ]
      Resource = "${aws_cloudwatch_log_group.app.arn}:*"
    }]
  })
}
```

The execution role is a critical component of ECS Fargate tasks. Set it up correctly from the start with appropriate permissions for your container registry, logging destination, and secrets management approach. Keep the execution role minimal - it should only have permissions needed for task infrastructure, not for your application's business logic.