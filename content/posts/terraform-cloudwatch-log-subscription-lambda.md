---
title: 'How to Configure CloudWatch Logs Subscription Filter to Lambda With Terraform'
excerpt: "Learn how to stream CloudWatch Logs to a Lambda function using Terraform, including proper permissions and error handling."
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2024-12-18'
publishedAt: '2024-12-18T15:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Terraform
  - AWS
  - CloudWatch
  - Lambda
  - Logging
  - DevOps
---

CloudWatch Logs subscription filters let you stream log events from a log group to other AWS services in real-time. One common pattern is sending logs to a Lambda function for processing, analysis, or forwarding to external systems like Elasticsearch, Datadog, or Splunk.

Setting this up with Terraform requires coordinating several resources: the Lambda function, its execution role, permissions for CloudWatch to invoke it, and the subscription filter itself. Miss any piece and you'll get permission errors or logs that silently don't arrive.

**TLDR:** To send CloudWatch Logs to Lambda with Terraform, you need four components: the Lambda function with its IAM role, a Lambda permission resource allowing CloudWatch Logs to invoke it, the subscription filter that defines which logs to send, and optionally a filter pattern to select specific log events. The key gotcha is that CloudWatch Logs needs explicit permission to invoke your Lambda via `aws_lambda_permission` with the correct source ARN.

## The Basic Setup

Here's a minimal configuration that streams all logs from a log group to a Lambda function:

```hcl
# The Lambda function that will process log events
resource "aws_lambda_function" "log_processor" {
  filename         = "lambda_function.zip"
  function_name    = "cloudwatch-log-processor"
  role            = aws_iam_role.lambda_execution.arn
  handler         = "index.handler"
  runtime         = "python3.11"
  source_code_hash = filebase64sha256("lambda_function.zip")

  environment {
    variables = {
      LOG_LEVEL = "INFO"
    }
  }
}

# IAM role for the Lambda function
resource "aws_iam_role" "lambda_execution" {
  name = "cloudwatch-log-processor-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

# Attach basic Lambda execution policy
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Permission for CloudWatch Logs to invoke the Lambda function
resource "aws_lambda_permission" "allow_cloudwatch" {
  statement_id  = "AllowExecutionFromCloudWatchLogs"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.log_processor.function_name
  principal     = "logs.amazonaws.com"
  source_arn    = "${aws_cloudwatch_log_group.application.arn}:*"
}

# The log group you want to stream from
resource "aws_cloudwatch_log_group" "application" {
  name              = "/aws/application/my-app"
  retention_in_days = 7
}

# The subscription filter that connects logs to Lambda
resource "aws_cloudwatch_log_subscription_filter" "lambda_subscription" {
  name            = "lambda-log-processor"
  log_group_name  = aws_cloudwatch_log_group.application.name
  filter_pattern  = ""  # Empty string means all log events
  destination_arn = aws_lambda_function.log_processor.arn

  # Make sure permission is in place before creating the subscription
  depends_on = [aws_lambda_permission.allow_cloudwatch]
}
```

The flow looks like this:

```
CloudWatch Log Group
       |
       | New log events
       ↓
Subscription Filter (with filter pattern)
       |
       | Matches filter? → Yes
       ↓
Lambda Permission Check
       |
       | Authorized? → Yes
       ↓
Lambda Function Invoked
       |
       | Process log data
       ↓
External system / Additional processing
```

## Understanding the Lambda Permission

The `aws_lambda_permission` resource is critical and often overlooked. Without it, CloudWatch Logs can't invoke your Lambda function:

```hcl
resource "aws_lambda_permission" "allow_cloudwatch" {
  statement_id  = "AllowExecutionFromCloudWatchLogs"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.log_processor.function_name
  principal     = "logs.amazonaws.com"

  # IMPORTANT: The source_arn must match the log group
  source_arn = "${aws_cloudwatch_log_group.application.arn}:*"
}
```

The `source_arn` specifies which log group can invoke the Lambda. The `:*` suffix is required because CloudWatch Logs appends additional information to the ARN during invocation.

If you have multiple log groups sending to the same Lambda, you have two options:

**Option 1: One permission per log group (more secure):**

```hcl
resource "aws_lambda_permission" "allow_cloudwatch_app" {
  statement_id  = "AllowExecutionFromAppLogs"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.log_processor.function_name
  principal     = "logs.amazonaws.com"
  source_arn    = "${aws_cloudwatch_log_group.application.arn}:*"
}

resource "aws_lambda_permission" "allow_cloudwatch_api" {
  statement_id  = "AllowExecutionFromApiLogs"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.log_processor.function_name
  principal     = "logs.amazonaws.com"
  source_arn    = "${aws_cloudwatch_log_group.api.arn}:*"
}
```

**Option 2: Allow all log groups in the account (less secure):**

```hcl
resource "aws_lambda_permission" "allow_cloudwatch_all" {
  statement_id  = "AllowExecutionFromAllCloudWatchLogs"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.log_processor.function_name
  principal     = "logs.amazonaws.com"

  # No source_arn means any log group in the account can invoke
}
```

The first option follows the principle of least privilege and is recommended for production.

## Using Filter Patterns

Filter patterns let you selectively send only matching log events to Lambda. This reduces Lambda invocations and costs:

```hcl
# Only send ERROR level logs
resource "aws_cloudwatch_log_subscription_filter" "errors_only" {
  name            = "error-log-processor"
  log_group_name  = aws_cloudwatch_log_group.application.name
  filter_pattern  = "[level=ERROR*, ...]"
  destination_arn = aws_lambda_function.log_processor.arn
  depends_on      = [aws_lambda_permission.allow_cloudwatch]
}
```

Common filter patterns:

```hcl
# All log events (no filtering)
filter_pattern = ""

# Log events containing "ERROR"
filter_pattern = "ERROR"

# JSON logs with specific fields
filter_pattern = "{ $.level = \"ERROR\" }"

# Multiple conditions
filter_pattern = "{ $.level = \"ERROR\" && $.statusCode >= 500 }"

# Pattern matching with variables
filter_pattern = "[time, request_id, level=ERROR*, ...]"
```

For structured JSON logs, the JSON filter syntax is powerful:

```hcl
# Send logs where user is from specific domains
resource "aws_cloudwatch_log_subscription_filter" "security_events" {
  name            = "security-event-processor"
  log_group_name  = aws_cloudwatch_log_group.application.name
  filter_pattern  = "{ $.eventType = \"login_failed\" || $.eventType = \"access_denied\" }"
  destination_arn = aws_lambda_function.security_processor.arn
  depends_on      = [aws_lambda_permission.allow_cloudwatch_security]
}
```

## Processing Logs in Lambda

The Lambda function receives log data in a specific format. Here's a Python example that decodes the log events:

```python
# lambda_function.py
import json
import gzip
import base64

def handler(event, context):
    # CloudWatch Logs data is base64 encoded and gzipped
    compressed_payload = base64.b64decode(event['awslogs']['data'])
    uncompressed_payload = gzip.decompress(compressed_payload)
    log_data = json.loads(uncompressed_payload)

    log_group = log_data['logGroup']
    log_stream = log_data['logStream']
    log_events = log_data['logEvents']

    print(f"Processing {len(log_events)} events from {log_group}/{log_stream}")

    for log_event in log_events:
        timestamp = log_event['timestamp']
        message = log_event['message']

        # Try to parse as JSON if applicable
        try:
            structured_log = json.loads(message)
            process_structured_log(structured_log)
        except json.JSONDecodeError:
            process_plain_text_log(message)

    return {
        'statusCode': 200,
        'body': json.dumps(f'Processed {len(log_events)} events')
    }

def process_structured_log(log):
    # Your processing logic here
    if log.get('level') == 'ERROR':
        print(f"Error detected: {log.get('message')}")

def process_plain_text_log(message):
    # Your processing logic here
    print(f"Log: {message}")
```

The corresponding Terraform for packaging this Lambda:

```hcl
# Create the Lambda deployment package
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_file = "${path.module}/lambda_function.py"
  output_path = "${path.module}/lambda_function.zip"
}

resource "aws_lambda_function" "log_processor" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "cloudwatch-log-processor"
  role            = aws_iam_role.lambda_execution.arn
  handler         = "lambda_function.handler"
  runtime         = "python3.11"
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  timeout         = 60  # Give enough time to process batches

  environment {
    variables = {
      LOG_LEVEL = "INFO"
    }
  }
}
```

## Subscribing Multiple Log Groups to One Lambda

When you have multiple log groups that should all go to the same Lambda, use `for_each`:

```hcl
variable "log_groups" {
  type = map(string)
  default = {
    application = "/aws/application/my-app"
    api         = "/aws/api/my-api"
    worker      = "/aws/worker/my-worker"
  }
}

resource "aws_cloudwatch_log_group" "services" {
  for_each = var.log_groups

  name              = each.value
  retention_in_days = 7
}

resource "aws_lambda_permission" "allow_cloudwatch" {
  for_each = aws_cloudwatch_log_group.services

  statement_id  = "AllowExecutionFrom${each.key}"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.log_processor.function_name
  principal     = "logs.amazonaws.com"
  source_arn    = "${each.value.arn}:*"
}

resource "aws_cloudwatch_log_subscription_filter" "all_services" {
  for_each = aws_cloudwatch_log_group.services

  name            = "${each.key}-log-processor"
  log_group_name  = each.value.name
  filter_pattern  = ""
  destination_arn = aws_lambda_function.log_processor.arn

  depends_on = [aws_lambda_permission.allow_cloudwatch]
}
```

This pattern makes it easy to add new log groups by just adding them to the `log_groups` variable.

## Adding Additional IAM Permissions

If your Lambda needs to write processed logs elsewhere or interact with other AWS services, add those permissions to the role:

```hcl
# Additional policy for writing to S3
resource "aws_iam_role_policy" "lambda_s3" {
  name = "lambda-s3-access"
  role = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:PutObject",
        "s3:PutObjectAcl"
      ]
      Resource = "${aws_s3_bucket.log_archive.arn}/*"
    }]
  })
}

# Or for sending to another log group
resource "aws_iam_role_policy" "lambda_logs" {
  name = "lambda-cloudwatch-logs"
  role = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ]
      Resource = "arn:aws:logs:*:*:*"
    }]
  })
}
```

## Cross-Account Log Delivery

For sending logs from one AWS account to a Lambda in another account, you need to adjust permissions:

```hcl
# In the Lambda account
resource "aws_lambda_permission" "allow_cloudwatch_cross_account" {
  statement_id  = "AllowExecutionFromOtherAccount"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.log_processor.function_name
  principal     = "logs.amazonaws.com"

  # Specify the source account
  source_account = "123456789012"

  # And the log group ARN from the other account
  source_arn = "arn:aws:logs:us-east-1:123456789012:log-group:/aws/application/my-app:*"
}
```

You'll also need to set up appropriate IAM roles in the source account, but the Lambda permission is the key piece on the destination side.

## Monitoring Subscription Filter Health

Create CloudWatch alarms to monitor that your subscription filter is working:

```hcl
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "log-processor-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "Alert when log processor Lambda has errors"

  dimensions = {
    FunctionName = aws_lambda_function.log_processor.function_name
  }
}

resource "aws_cloudwatch_metric_alarm" "lambda_throttles" {
  alarm_name          = "log-processor-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "Alert when log processor Lambda is throttled"

  dimensions = {
    FunctionName = aws_lambda_function.log_processor.function_name
  }
}
```

## Handling High Volume Log Groups

For log groups with high volume, configure appropriate Lambda settings:

```hcl
resource "aws_lambda_function" "log_processor" {
  filename         = "lambda_function.zip"
  function_name    = "cloudwatch-log-processor"
  role            = aws_iam_role.lambda_execution.arn
  handler         = "index.handler"
  runtime         = "python3.11"
  source_code_hash = filebase64sha256("lambda_function.zip")

  # Increase timeout for processing large batches
  timeout = 300  # 5 minutes (max)

  # Increase memory for faster processing
  memory_size = 1024  # MB

  # Control concurrent executions to prevent overwhelming downstream systems
  reserved_concurrent_executions = 10

  # Enable function URL for direct testing (optional)
  environment {
    variables = {
      LOG_LEVEL       = "INFO"
      BATCH_SIZE      = "100"
      DESTINATION_URL = "https://example.com/logs"
    }
  }
}
```

You can also add a Dead Letter Queue to capture failed invocations:

```hcl
resource "aws_sqs_queue" "lambda_dlq" {
  name = "log-processor-dlq"

  message_retention_seconds = 1209600  # 14 days
}

resource "aws_lambda_function" "log_processor" {
  # ... other configuration ...

  dead_letter_config {
    target_arn = aws_sqs_queue.lambda_dlq.arn
  }
}

# Allow Lambda to send to DLQ
resource "aws_iam_role_policy" "lambda_dlq" {
  name = "lambda-dlq-access"
  role = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "sqs:SendMessage"
      Resource = aws_sqs_queue.lambda_dlq.arn
    }]
  })
}
```

Setting up CloudWatch Logs subscription filters to Lambda with Terraform requires coordinating several resources, but once you understand the pattern, it's straightforward to replicate across multiple log groups. The key is making sure the Lambda permission is in place before creating the subscription filter, and using appropriate filter patterns to control which logs get sent to your function.
