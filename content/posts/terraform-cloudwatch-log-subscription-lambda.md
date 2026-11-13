---
title: 'How to Configure CloudWatch Logs Subscription Filter to Lambda With Terraform'
excerpt: 'Learn how to stream CloudWatch Logs to a Lambda function using Terraform, including permissions and error handling, and how to run a Lambda function on a schedule with EventBridge.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2024-12-18'
publishedAt: '2024-12-18T15:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '11 min read'
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
  role             = aws_iam_role.lambda_execution.arn
  handler          = "index.handler"
  runtime          = "python3.13"
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
  filter_pattern  = "" # Empty string means all log events
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
  role             = aws_iam_role.lambda_execution.arn
  handler          = "lambda_function.handler"
  runtime          = "python3.13"
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  timeout          = 60 # Give enough time to process batches

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
  role             = aws_iam_role.lambda_execution.arn
  handler          = "index.handler"
  runtime          = "python3.13"
  source_code_hash = filebase64sha256("lambda_function.zip")

  # Increase timeout for processing large batches
  timeout = 300 # seconds; the Lambda maximum is 900 (15 minutes)

  # Increase memory for faster processing
  memory_size = 1024 # MB

  # Control concurrent executions to prevent overwhelming downstream systems
  reserved_concurrent_executions = 10

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

  message_retention_seconds = 1209600 # 14 days
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

## How Do I Run a Lambda Function on a Schedule With Terraform?

Create an EventBridge schedule that targets the function. There are two ways to do that, and both start with the same function:

```hcl
data "archive_file" "job" {
  type        = "zip"
  source_file = "${path.module}/src/job.py"
  output_path = "${path.module}/build/job.zip"
}

resource "aws_iam_role" "job" {
  name = "nightly-job"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "job_logs" {
  role       = aws_iam_role.job.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "job" {
  function_name    = "nightly-job"
  role             = aws_iam_role.job.arn
  runtime          = "python3.13"
  handler          = "job.handler"
  filename         = data.archive_file.job.output_path
  source_code_hash = data.archive_file.job.output_base64sha256
  timeout          = 60
}
```

```python
# src/job.py
def handler(event, context):
    print("scheduled run", event.get("time"))
    return {"ok": True}
```

`archive_file` builds the zip during the plan, and `source_code_hash` makes Terraform update the function when the code changes. Older examples use `python3.9`, which Lambda deprecated in December 2025. Use a supported runtime such as `python3.13`.

### Option 1: EventBridge Scheduler

EventBridge Scheduler is the newer service for schedules, and the one AWS recommends for new work. It supports time zones, one-time schedules and retries. It invokes the function with a role that you give it:

```hcl
resource "aws_iam_role" "scheduler" {
  name = "nightly-job-scheduler"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "scheduler.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "scheduler_invoke" {
  name = "invoke-nightly-job"
  role = aws_iam_role.scheduler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "lambda:InvokeFunction"
      Resource = aws_lambda_function.job.arn
    }]
  })
}

resource "aws_scheduler_schedule" "nightly" {
  name                         = "nightly-job"
  schedule_expression          = "cron(0 2 * * ? *)" # 02:00 every day
  schedule_expression_timezone = "Europe/Berlin"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_lambda_function.job.arn
    role_arn = aws_iam_role.scheduler.arn

    retry_policy {
      maximum_retry_attempts = 2
    }
  }
}
```

The scheduler needs no `aws_lambda_permission`, because it calls the function with its own role.

### Option 2: An EventBridge Rule

The older way is an EventBridge rule with a schedule. It is still supported and common in existing code. Here the function needs a resource-based permission that lets EventBridge invoke it:

```hcl
resource "aws_cloudwatch_event_rule" "every_5_minutes" {
  name                = "nightly-job-every-5-minutes"
  schedule_expression = "rate(5 minutes)"
}

resource "aws_cloudwatch_event_target" "job" {
  rule = aws_cloudwatch_event_rule.every_5_minutes.name
  arn  = aws_lambda_function.job.arn
}

resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.job.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.every_5_minutes.arn
}
```

Rule schedules run in UTC. If the permission is missing, the rule shows failed invocations in its metrics and the function never runs, which is the most common problem with this setup.

### Schedule Expressions

Both services support `rate()` and `cron()` expressions, and EventBridge Scheduler also supports one-time `at()` expressions, for example `at(2026-12-01T09:00:00)`:

- `rate(5 minutes)`, `rate(1 hour)`, `rate(7 days)`: the unit is singular for a value of 1 (`rate(1 hour)`) and plural otherwise.
- `cron(minutes hours day-of-month month day-of-week year)`: six fields, unlike Unix cron. One of day-of-month and day-of-week must be `?`. `cron(0 6 ? * MON-FRI *)` runs at 06:00 on weekdays.

To check that it runs, follow the function's log group: `aws logs tail /aws/lambda/nightly-job --follow`. Our [cron expression simulator](/games/cron-expression-simulator) explains cron fields, and the [Lambda chapter](/guides/introduction-to-aws/09-lambda-serverless#h2-triggers) of our AWS guide covers other triggers.

## Summary

Setting up CloudWatch Logs subscription filters to Lambda with Terraform requires coordinating several resources, and once the pattern works for one log group, you can repeat it for many. The key is making sure the Lambda permission is in place before creating the subscription filter, and using appropriate filter patterns to control which logs get sent to your function. For scheduled functions, prefer EventBridge Scheduler with its own invoke role, and remember the `aws_lambda_permission` when you use an EventBridge rule instead.
