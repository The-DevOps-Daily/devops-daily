---
title: 'How to Fix Terraform Not Deploying API Gateway Stage'
excerpt: "Learn why Terraform might not deploy your AWS API Gateway stage and how to properly configure deployments with automatic triggering on configuration changes."
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2025-01-12'
publishedAt: '2025-01-12T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - AWS
  - API Gateway
  - Troubleshooting
  - DevOps
---

When working with AWS API Gateway in Terraform, you might encounter a situation where your stage isn't being deployed or updated even though you've changed your API configuration. This happens because API Gateway requires an explicit deployment resource to publish changes, and Terraform needs triggers to know when to create new deployments.

Understanding the relationship between `aws_api_gateway_deployment` and `aws_api_gateway_stage` is key to getting automatic deployments working correctly.

**TLDR:** API Gateway stages don't automatically update when you change API resources. You need an `aws_api_gateway_deployment` resource with triggers that detect changes to your API configuration. Use a hash of your API resources (routes, integrations, methods) as the deployment trigger, or reference the deployment in your stage configuration. Without proper triggers, Terraform won't create new deployments when you modify your API.

## Understanding the Problem

API Gateway has a multi-step process to make changes live:

```
1. Define API resources (routes, methods, integrations)
   ↓
2. Create a deployment (snapshot of current API config)
   ↓
3. Associate deployment with a stage
   ↓
4. Stage is now live with the new configuration
```

If you only define the stage without creating new deployments, changes to your API won't appear.

## Basic API Gateway Configuration

Here's what doesn't work:

```hcl
# This creates the API structure but doesn't deploy it
resource "aws_api_gateway_rest_api" "api" {
  name = "my-api"
}

resource "aws_api_gateway_resource" "resource" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "users"
}

resource "aws_api_gateway_method" "method" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.resource.id
  http_method   = "GET"
  authorization = "NONE"
}

# Stage alone doesn't deploy changes
resource "aws_api_gateway_stage" "prod" {
  deployment_id = aws_api_gateway_deployment.prod.id  # References deployment
  rest_api_id   = aws_api_gateway_rest_api.api.id
  stage_name    = "prod"
}

# Missing: Deployment with proper triggers!
```

This configuration has a stage but won't update when you change the API.

## Proper Deployment Configuration

Add an `aws_api_gateway_deployment` resource with triggers:

```hcl
resource "aws_api_gateway_rest_api" "api" {
  name = "my-api"
}

resource "aws_api_gateway_resource" "users" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "users"
}

resource "aws_api_gateway_method" "get_users" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.users.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_users" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.users.id
  http_method = aws_api_gateway_method.get_users.http_method

  type = "MOCK"
}

# Deployment with triggers
resource "aws_api_gateway_deployment" "prod" {
  rest_api_id = aws_api_gateway_rest_api.api.id

  # Trigger redeployment when API configuration changes
  triggers = {
    redeployment = sha256(jsonencode([
      aws_api_gateway_resource.users.id,
      aws_api_gateway_method.get_users.id,
      aws_api_gateway_integration.get_users.id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "prod" {
  deployment_id = aws_api_gateway_deployment.prod.id
  rest_api_id   = aws_api_gateway_rest_api.api.id
  stage_name    = "prod"
}
```

The `triggers` block causes a new deployment when any referenced resource changes.

## Using depends_on for Deployment

An alternative approach uses `depends_on`:

```hcl
resource "aws_api_gateway_deployment" "prod" {
  rest_api_id = aws_api_gateway_rest_api.api.id

  depends_on = [
    aws_api_gateway_method.get_users,
    aws_api_gateway_integration.get_users,
  ]

  lifecycle {
    create_before_destroy = true
  }
}
```

However, this doesn't automatically trigger redeployment when you change integration settings or add new methods. The triggers approach is more reliable.

## Creating Triggers From Multiple Resources

For complex APIs, create a comprehensive trigger hash:

```hcl
locals {
  # Collect all API configuration IDs
  api_config = {
    resources = [
      aws_api_gateway_resource.users.id,
      aws_api_gateway_resource.posts.id,
    ]
    methods = [
      aws_api_gateway_method.get_users.id,
      aws_api_gateway_method.post_users.id,
      aws_api_gateway_method.get_posts.id,
    ]
    integrations = [
      aws_api_gateway_integration.get_users.id,
      aws_api_gateway_integration.post_users.id,
      aws_api_gateway_integration.get_posts.id,
    ]
  }
}

resource "aws_api_gateway_deployment" "prod" {
  rest_api_id = aws_api_gateway_rest_api.api.id

  triggers = {
    redeployment = sha256(jsonencode(local.api_config))
  }

  lifecycle {
    create_before_destroy = true
  }
}
```

Any change to resources, methods, or integrations triggers a new deployment.

## Dynamic Trigger With File Hash

If your API configuration comes from OpenAPI/Swagger files:

```hcl
resource "aws_api_gateway_rest_api" "api" {
  name = "my-api"

  body = file("${path.module}/openapi.yaml")
}

resource "aws_api_gateway_deployment" "prod" {
  rest_api_id = aws_api_gateway_rest_api.api.id

  triggers = {
    # Redeploy when OpenAPI file changes
    redeployment = filemd5("${path.module}/openapi.yaml")
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "prod" {
  deployment_id = aws_api_gateway_deployment.prod.id
  rest_api_id   = aws_api_gateway_rest_api.api.id
  stage_name    = "prod"
}
```

Changes to the OpenAPI file automatically trigger redeployment.

## Forcing Deployment With Timestamp

To force a new deployment every time:

```hcl
resource "aws_api_gateway_deployment" "prod" {
  rest_api_id = aws_api_gateway_rest_api.api.id

  triggers = {
    # Always redeploy
    redeployment = timestamp()
  }

  lifecycle {
    create_before_destroy = true
  }
}
```

This creates a new deployment on every `terraform apply`, which might be excessive for production but useful during development.

## Stage Variables and Settings

Configure stage-specific settings:

```hcl
resource "aws_api_gateway_stage" "prod" {
  deployment_id = aws_api_gateway_deployment.prod.id
  rest_api_id   = aws_api_gateway_rest_api.api.id
  stage_name    = "prod"

  # Stage variables
  variables = {
    environment = "production"
    lambda_alias = "prod"
  }

  # Enable CloudWatch logging
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway.arn
    format         = "$context.requestId $context.error.message $context.error.messageString"
  }

  # Enable X-Ray tracing
  xray_tracing_enabled = true

  # Throttling settings
  throttle_settings {
    burst_limit = 5000
    rate_limit  = 10000
  }
}
```

Changes to stage settings don't require redeployment, but changes to the API itself do.

## Multiple Stages

Deploy the same API to multiple stages:

```hcl
resource "aws_api_gateway_deployment" "main" {
  rest_api_id = aws_api_gateway_rest_api.api.id

  triggers = {
    redeployment = sha256(jsonencode(local.api_config))
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Development stage
resource "aws_api_gateway_stage" "dev" {
  deployment_id = aws_api_gateway_deployment.main.id
  rest_api_id   = aws_api_gateway_rest_api.api.id
  stage_name    = "dev"

  variables = {
    environment = "development"
  }
}

# Production stage
resource "aws_api_gateway_stage" "prod" {
  deployment_id = aws_api_gateway_deployment.main.id
  rest_api_id   = aws_api_gateway_rest_api.api.id
  stage_name    = "prod"

  variables = {
    environment = "production"
  }

  # Enable caching in production
  cache_cluster_enabled = true
  cache_cluster_size    = "0.5"
}
```

Both stages use the same deployment but can have different settings.

## Handling Deployment Failures

If deployment fails, add description for debugging:

```hcl
resource "aws_api_gateway_deployment" "prod" {
  rest_api_id = aws_api_gateway_rest_api.api.id

  # Add description for visibility
  description = "Deployment at ${timestamp()}"

  triggers = {
    redeployment = sha256(jsonencode(local.api_config))
  }

  lifecycle {
    create_before_destroy = true
  }
}
```

Check deployment history in AWS Console or via AWS CLI:

```bash
aws apigateway get-deployments --rest-api-id <api-id>
```

## Preventing Accidental Deletions

Protect important stages from accidental deletion:

```hcl
resource "aws_api_gateway_stage" "prod" {
  deployment_id = aws_api_gateway_deployment.prod.id
  rest_api_id   = aws_api_gateway_rest_api.api.id
  stage_name    = "prod"

  lifecycle {
    prevent_destroy = true
  }
}
```

This prevents `terraform destroy` from removing the production stage.

## Complete Working Example

Here's a complete example that properly handles deployments:

```hcl
# API Gateway REST API
resource "aws_api_gateway_rest_api" "api" {
  name        = "my-api"
  description = "My API Gateway"

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

# Resources
resource "aws_api_gateway_resource" "users" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "users"
}

# Methods
resource "aws_api_gateway_method" "get_users" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.users.id
  http_method   = "GET"
  authorization = "NONE"
}

# Integration
resource "aws_api_gateway_integration" "get_users" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.users.id
  http_method = aws_api_gateway_method.get_users.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.users.invoke_arn
}

# Lambda permission
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.users.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

# Deployment with proper triggers
resource "aws_api_gateway_deployment" "prod" {
  rest_api_id = aws_api_gateway_rest_api.api.id

  triggers = {
    redeployment = sha256(jsonencode([
      aws_api_gateway_resource.users.id,
      aws_api_gateway_method.get_users.id,
      aws_api_gateway_integration.get_users.id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_api_gateway_integration.get_users,
  ]
}

# Stage
resource "aws_api_gateway_stage" "prod" {
  deployment_id = aws_api_gateway_deployment.prod.id
  rest_api_id   = aws_api_gateway_rest_api.api.id
  stage_name    = "prod"

  variables = {
    lambda_alias = "prod"
  }

  xray_tracing_enabled = true
}

# Output API endpoint
output "api_endpoint" {
  value = "${aws_api_gateway_stage.prod.invoke_url}/users"
}
```

This configuration properly deploys changes whenever you modify the API structure.

## Troubleshooting Deployment Issues

If deployments aren't working:

**1. Check if deployment resource exists:**

```bash
terraform state list | grep aws_api_gateway_deployment
```

**2. Verify triggers are configured:**

```bash
terraform state show aws_api_gateway_deployment.prod
```

Look for the `triggers` attribute.

**3. Check deployment history:**

```bash
aws apigateway get-deployments --rest-api-id <api-id> --query 'items[*].[id,createdDate]' --output table
```

**4. Manually trigger deployment:**

```bash
terraform taint aws_api_gateway_deployment.prod
terraform apply
```

**5. Enable Terraform debug logging:**

```bash
export TF_LOG=DEBUG
terraform apply
```

The key to API Gateway stage deployments is the `aws_api_gateway_deployment` resource with proper triggers. Without triggers that detect API changes, Terraform won't create new deployments and your stage won't reflect configuration updates. Always include a trigger hash based on your API resources, and use `create_before_destroy` lifecycle to prevent downtime during deployments.
