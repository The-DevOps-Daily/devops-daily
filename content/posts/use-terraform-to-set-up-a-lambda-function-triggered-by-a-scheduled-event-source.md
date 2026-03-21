---
title: 'Use Terraform to set up a Lambda function triggered by a scheduled event source'
excerpt: 'Learn how to use Terraform to create an AWS Lambda function triggered by a scheduled event source, such as a cron job.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2025-01-20'
publishedAt: '2025-01-20T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - AWS Lambda
  - Scheduled Events
  - DevOps
---

AWS Lambda functions can be triggered by scheduled events, such as cron jobs, using Amazon EventBridge (formerly CloudWatch Events). Terraform makes it easy to set up this integration.

## Prerequisites

- An AWS account with appropriate permissions.
- Terraform installed on your system.

## Steps to Set Up a Lambda Function with a Scheduled Event

### Step 1: Write the Lambda Function Code

Create a simple Python script for the Lambda function. Save it as `lambda_function.py`:

```python
def lambda_handler(event, context):
    print("Scheduled event triggered")
    return {
        'statusCode': 200,
        'body': 'Success'
    }
```

### Step 2: Create a Terraform Configuration

Define the resources needed for the Lambda function and the scheduled event.

```hcl
resource "aws_iam_role" "lambda_role" {
  name = "lambda_execution_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = "sts:AssumeRole",
        Effect = "Allow",
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_policy" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "example" {
  filename         = "lambda_function.zip"
  function_name    = "example_lambda"
  role             = aws_iam_role.lambda_role.arn
  handler          = "lambda_function.lambda_handler"
  runtime          = "python3.9"
  source_code_hash = filebase64sha256("lambda_function.zip")
}

resource "aws_cloudwatch_event_rule" "schedule" {
  name                = "example-schedule"
  schedule_expression = "rate(5 minutes)"
}

resource "aws_cloudwatch_event_target" "lambda_target" {
  rule      = aws_cloudwatch_event_rule.schedule.name
  target_id = "lambda"
  arn       = aws_lambda_function.example.arn
}

resource "aws_lambda_permission" "allow_cloudwatch" {
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.example.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.schedule.arn
}
```

### Step 3: Deploy the Configuration

1. Zip the Lambda function code:

   ```bash
   zip lambda_function.zip lambda_function.py
   ```

2. Initialize Terraform:

   ```bash
   terraform init
   ```

3. Apply the configuration:

   ```bash
   terraform apply
   ```

### Step 4: Verify the Setup

Check the AWS Management Console to ensure the Lambda function and scheduled event are set up correctly. The function should trigger every 5 minutes.

## Best Practices

- Use environment variables to configure your Lambda function dynamically.
- Monitor your Lambda function with Amazon CloudWatch Logs.
- Use Terraform modules to organize your code for reusability.

By following these steps, you can efficiently set up a Lambda function triggered by a scheduled event using Terraform.
