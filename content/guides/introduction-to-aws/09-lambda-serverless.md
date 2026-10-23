---
title: 'Lambda: Serverless Functions'
description: 'Learn AWS Lambda: write a Python function, trigger it from S3 uploads, test it locally, and understand cold starts, limits, retries and pricing.'
order: 9
---

**TLDR**: A Lambda function is code that AWS runs when an event arrives: an S3 upload, a message on a queue, an HTTP request, a schedule. You pay per request and per GB-second of run time, nothing while idle. Functions run for at most 15 minutes on the standard compute, start with a short delay when no warm environment is ready (a cold start), and should be safe to run twice for the same event. Give each function its own execution role and set its log retention.

So far the photo app runs on servers that are on all day. Some work only needs to happen when something occurs: a photo is uploaded, a nightly report is due, a webhook arrives. AWS Lambda runs your code for exactly those moments. There is no server to patch or scale; AWS starts as many copies as the events need.

In this part you write a function that runs for every photo uploaded to the S3 bucket from Part 4, test it on your own machine, and deploy it.

:::note
In October 2026 AWS started calling classic, event-driven functions **Lambda Event Functions**, to tell them apart from the new **Lambda Web Functions**, which run an HTTP server (Node.js only at launch, in five Regions). The rename changes no APIs or code. This part covers event functions, which is what "a Lambda function" means in most documentation and tutorials.
:::

## Prerequisites

- The S3 bucket from [Part 4](/guides/introduction-to-aws/04-s3-storage) and the CloudWatch basics from [Part 8](/guides/introduction-to-aws/08-cloudwatch-monitoring).
- Python 3 on your computer, to run the function locally.

## How Lambda Runs Your Code

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Event", "sub": "S3, SQS, HTTP, schedule", "icon": "activity", "tone": "slate" },
    { "label": "Lambda service", "sub": "finds or starts an environment", "icon": "cloud", "tone": "amber" },
    { "label": "Init (cold start)", "sub": "load code, run module scope", "icon": "rocket", "tone": "violet" },
    { "label": "Handler", "sub": "your function runs", "icon": "cpu", "tone": "blue" },
    { "label": "Result and logs", "sub": "CloudWatch Logs", "icon": "check", "tone": "green" }
  ]
}
```

1. An event source invokes the function, either **synchronously** (the caller waits for the result: function URLs, API Gateway) or **asynchronously** (Lambda queues the event and retries on failure: S3, SNS, EventBridge). Queues and streams (SQS, Kinesis, DynamoDB Streams) are read by an **event source mapping** that hands your function batches of records.
2. If no idle **execution environment** exists, Lambda creates one: a small, isolated microVM with your runtime and code. Your module-level code runs once here. This is the **init phase**, or cold start.
3. The **handler** runs with the event. Afterwards the environment stays warm for a while and is reused for later events, so objects created at module level (SDK clients, database connections) are reused too.
4. Each environment handles one event at a time. More events at once means more environments: that is Lambda's **concurrency**.

## When to Use Lambda

**Good fits:**

- reacting to events: uploads, queue messages, database changes, webhooks;
- scheduled jobs: nightly cleanups, reports (with **EventBridge Scheduler**, the recommended scheduler; older scheduled rules live in EventBridge, which used to be called CloudWatch Events);
- glue between services, and APIs with spiky or low traffic.

**Poor fits:**

- work that runs longer than 15 minutes (use ECS, AWS Batch or Step Functions to split it);
- steady, high traffic around the clock, where a server or container is often cheaper;
- workloads that need a GPU, special hardware or full control of the OS.

## Limits Worth Knowing

| Setting        | Range                                                                                                                               |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Memory         | 128 MB to 10,240 MB (CPU grows with memory)                                                                                         |
| Timeout        | Up to 900 seconds (15 minutes); the default is 3 seconds. Lambda Managed Instances allow up to 90 minutes for some invocation types |
| `/tmp` storage | 512 MB to 10,240 MB                                                                                                                 |
| Package        | 50 MB zipped for direct upload, 250 MB unzipped; container images up to 10 GB                                                       |

New accounts start with lower concurrency and memory quotas, which grow with use or on request. See [Lambda quotas](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html).

**Runtimes**: use a current one, such as `python3.14` or `python3.13`, or `nodejs24.x` or `nodejs22.x`. AWS deprecates runtimes when the language version reaches end of life: `nodejs20.x` was deprecated on 30 April 2026 and `python3.10` is deprecated on 31 October 2026. After deprecation, functions keep running, but you stop getting security patches and later cannot create or update them. Choose the **arm64** architecture (Graviton) unless a dependency needs x86: it costs less per GB-second.

## Write the Function

The function runs for every upload under `uploads/` and records each one as a CloudWatch metric, using the Embedded Metric Format from Part 8. Create a folder named `lambda` and save the code as `lambda/handler.py`:

```python
import json
import time
from urllib.parse import unquote_plus


def lambda_handler(event, context):
    records = event.get("Records", [])
    for record in records:
        bucket = record["s3"]["bucket"]["name"]
        # Object keys arrive URL-encoded: "my cat.jpg" arrives as "my+cat.jpg".
        key = unquote_plus(record["s3"]["object"]["key"])
        size = record["s3"]["object"].get("size", 0)

        # One Embedded Metric Format line per upload (see Part 8).
        print(json.dumps({
            "_aws": {
                "Timestamp": int(time.time() * 1000),
                "CloudWatchMetrics": [{
                    "Namespace": "PhotoApp",
                    "Dimensions": [["Service"]],
                    "Metrics": [
                        {"Name": "PhotoUploads", "Unit": "Count"},
                        {"Name": "UploadBytes", "Unit": "Bytes"},
                    ],
                }],
            },
            "Service": "upload-processor",
            "PhotoUploads": 1,
            "UploadBytes": size,
            "bucket": bucket,
            "key": key,
        }))

    return {"processed": len(records)}
```

- `lambda_handler(event, context)` is the entry point. `event` is the JSON document from the source; `context` has details such as the remaining time (`context.get_remaining_time_in_millis()`).
- The S3 event already contains the bucket, key and size, so this function needs no S3 permissions at all.
- Anything printed goes to CloudWatch Logs.

## Test It Locally

A handler is a plain function, so you can call it with a sample event before deploying anything. This is a trimmed S3 event in the format S3 sends (the console's **Test** tab has full templates). Save it as `lambda/s3-event.json`:

```json
{
  "Records": [
    {
      "eventSource": "aws:s3",
      "awsRegion": "us-east-1",
      "eventName": "ObjectCreated:Put",
      "s3": {
        "bucket": { "name": "photo-app-uploads-example" },
        "object": { "key": "uploads/my+cat.jpg", "size": 184213 }
      }
    }
  ]
}
```

Then run the handler from inside the `lambda` folder:

```terminal
{
  "title": "run the handler with the sample event (Python 3.11, local)",
  "prompt": "$",
  "steps": [
    {
      "cmd": "python3 -c 'import json, handler; print(handler.lambda_handler(json.load(open(\"s3-event.json\")), None))'",
      "output": "{\"_aws\": {\"Timestamp\": 1792770543382, \"CloudWatchMetrics\": [{\"Namespace\": \"PhotoApp\", \"Dimensions\": [[\"Service\"]], \"Metrics\": [{\"Name\": \"PhotoUploads\", \"Unit\": \"Count\"}, {\"Name\": \"UploadBytes\", \"Unit\": \"Bytes\"}]}]}, \"Service\": \"upload-processor\", \"PhotoUploads\": 1, \"UploadBytes\": 184213, \"bucket\": \"photo-app-uploads-example\", \"key\": \"uploads/my cat.jpg\"}\n{'processed': 1}"
    }
  ]
}
```

The key comes out decoded as `uploads/my cat.jpg`. Forgetting `unquote_plus` is a classic bug: the function then fails for every file name with a space or special character. For bigger projects, keep tests like this in your test suite, and use the AWS SAM CLI (`sam local invoke`) when you need to run the function in a Lambda-like container.

## Deploy It

In the **Lambda** console, choose **Create function**:

1. **Author from scratch**, name `process-upload`, runtime **Python 3.14**, architecture **arm64**.
2. **Execution role**: **Create a new role with basic Lambda permissions**. This role can write to CloudWatch Logs and nothing else, which is all this function needs.
3. Replace the sample code with `handler.py`, rename the file to match the handler setting (`lambda_function.lambda_handler` by default, or change it to `handler.lambda_handler`), and choose **Deploy**.
4. **Add trigger**: **S3**, bucket `photo-app-uploads-example`, event types **All object create events**, prefix `uploads/`. Acknowledge the recursive invocation warning.

From the CLI, the same function looks like this (the role must already exist):

```bash
# Still inside the lambda folder
zip function.zip handler.py

aws lambda create-function \
  --function-name process-upload \
  --runtime python3.14 \
  --architectures arm64 \
  --handler handler.lambda_handler \
  --role arn:aws:iam::111122223333:role/process-upload-role \
  --zip-file fileb://function.zip \
  --timeout 10 --memory-size 256

# Wait until the new function is Active, then invoke it once with the sample event
aws lambda wait function-active-v2 --function-name process-upload
aws lambda invoke \
  --function-name process-upload \
  --cli-binary-format raw-in-base64-out \
  --payload file://s3-event.json \
  response.json
```

Connecting the bucket from the CLI takes two more steps: `aws lambda add-permission` (so S3 may invoke the function) and `aws s3api put-bucket-notification-configuration`. The console does both for you. In real projects, describe functions, roles and triggers with AWS SAM, the CDK or Terraform.

:::warning
Never let a function write to the same bucket and prefix that triggers it. A function that saves a thumbnail into `uploads/` triggers itself again, and again. Write results to a different prefix (`thumbnails/`) or bucket, and filter the trigger by prefix.
:::

Upload a photo to `uploads/` and watch the logs:

```bash
aws logs tail /aws/lambda/process-upload --follow
```

Each invocation logs a `START` line, your output, an `END` line and a `REPORT` line (example output):

```text
2026-10-23T10:21:07.412000+00:00 2026/10/23/[$LATEST]6b1c2f0e9a8d4e57b3a1c0d9e8f7a6b5 START RequestId: 0f3e7c2a-5b1d-4c8e-9a7f-2d6b8e1c4a90 Version: $LATEST
2026-10-23T10:21:07.415000+00:00 2026/10/23/[$LATEST]6b1c2f0e9a8d4e57b3a1c0d9e8f7a6b5 {"_aws": {"Timestamp": 1792750867414, ...}, "Service": "upload-processor", "PhotoUploads": 1, "UploadBytes": 184213, "bucket": "photo-app-uploads-example", "key": "uploads/my cat.jpg"}
2026-10-23T10:21:07.417000+00:00 2026/10/23/[$LATEST]6b1c2f0e9a8d4e57b3a1c0d9e8f7a6b5 END RequestId: 0f3e7c2a-5b1d-4c8e-9a7f-2d6b8e1c4a90
2026-10-23T10:21:07.417000+00:00 2026/10/23/[$LATEST]6b1c2f0e9a8d4e57b3a1c0d9e8f7a6b5 REPORT RequestId: 0f3e7c2a-5b1d-4c8e-9a7f-2d6b8e1c4a90 Duration: 2.31 ms Billed Duration: 112 ms Memory Size: 256 MB Max Memory Used: 39 MB Init Duration: 109.42 ms
```

The `REPORT` line is your bill and your performance data in one: `Init Duration` appears only on a cold start, and since August 2025 the init phase is billed for on-demand functions packaged as ZIP files with managed runtimes, which is why `Billed Duration` includes it. Set a retention period on the `/aws/lambda/process-upload` log group (Part 8).

## Triggers

| Source                    | How it invokes                   | Notes                                                        |
| ------------------------- | -------------------------------- | ------------------------------------------------------------ |
| S3 event notifications    | Asynchronous                     | Filter by prefix and suffix                                  |
| SQS queue                 | Event source mapping, in batches | Report partial batch failures so only failed messages return |
| EventBridge Scheduler     | Asynchronous                     | Cron or rate expressions, with time zones                    |
| Function URL              | Synchronous HTTPS                | A dedicated endpoint, with IAM auth or none                  |
| API Gateway (HTTP API)    | Synchronous HTTPS                | Routes, JWT authorizers, throttling, custom domains          |
| DynamoDB Streams, Kinesis | Event source mapping             | Ordered per shard or partition                               |

## Failures, Retries and Idempotency

- **Asynchronous** invocations (S3, SNS, EventBridge) are retried up to two more times on error. Configure an **on-failure destination** (an SQS queue or SNS topic) so events that still fail are kept for inspection instead of dropped.
- **Queue** sources retry until the message succeeds or reaches the queue's dead-letter queue.
- Events can be delivered **more than once**. Make the handler **idempotent**: processing the same upload twice must give the same result (for example, write the thumbnail under a key derived from the original, or record processed event IDs).

## Configuration and Secrets

- **Environment variables** for settings such as table names and feature flags.
- **Secrets** (API keys, database passwords) belong in Secrets Manager or Parameter Store, read at init time and cached, not in environment variables in plain text.
- **Memory** also sets CPU. A CPU-bound function often gets faster and no more expensive with more memory, because it runs for less time; measure with the `REPORT` lines.
- **Reserved concurrency** caps how many copies run at once, which protects a small database behind the function. For relational databases, use **RDS Proxy** so hundreds of functions do not open hundreds of connections.
- **VPC access**: attach the function to private subnets only if it must reach private resources such as RDS. It then needs a NAT gateway or VPC endpoints to reach the internet and other AWS services.

## Cold Starts

A cold start adds the init time to the first request on a new environment: typically from under 100 milliseconds to a second or more, depending on the runtime, package size and what your module scope does. To keep it short:

- keep the package small and import only what you use;
- create SDK clients and connections at module level, so warm invocations reuse them;
- use **SnapStart** (Java, Python 3.12 and later, .NET), which restores a snapshot of an initialized environment;
- use **provisioned concurrency** for latency-critical paths: environments stay initialized, for a fee.

For a function that processes uploads in the background, cold starts usually do not matter.

## What It Costs

Lambda event functions charge per request and per GB-second (memory times duration), with a lower GB-second price on arm64. The always-free allowance is 1 million requests and 400,000 GB-seconds a month, and requests cost USD 0.20 per million beyond it (per the [Lambda pricing page](https://aws.amazon.com/lambda/pricing/), checked 23 October 2026). A function like `process-upload`, running a few milliseconds per upload, stays inside the free allowance for a long time. CloudWatch Logs ingestion is billed separately, and for chatty functions it can cost more than Lambda itself.

## Beyond the Basics

- **Step Functions** coordinate several functions and services into a workflow with retries and branches.
- **Lambda durable functions** (launched December 2025) let one function run multi-step work that checkpoints its progress and can wait for up to a year.
- **Lambda Managed Instances** (launched November 2025) run functions on EC2 capacity you choose, for steady, high-volume workloads where EC2 pricing options pay off.
- **Container images** package functions with large dependencies, such as image processing libraries for real thumbnails.

## Common Mistakes

- **The default 3-second timeout** for anything that calls another service. Set it to what the work needs, with a margin.
- **Recursive triggers** through the same bucket or queue.
- **Not decoding S3 keys** with `unquote_plus`.
- **Non-idempotent handlers** that charge a card or send an email twice on a retry.
- **Opening a database connection per invocation** without RDS Proxy.
- **Logs kept forever** in `/aws/lambda/...` log groups.

## Clean Up

First remove the event notification from the bucket (**S3**, the bucket, **Properties**, **Event notifications**): deleting the function does not remove it. Then delete the function, its execution role and its log group. Lambda costs nothing while idle, but the log group keeps its data until you delete it or it expires.

## Summary

- Lambda runs code per event, scales by running more environments, and bills per request and GB-second.
- The handler receives the event; module-level code runs once per environment, at init.
- Test handlers locally with sample events; decode S3 keys; make handlers idempotent.
- Use current runtimes on arm64, set timeouts, retention and an on-failure destination.
- Use servers or containers for long-running or steady high-traffic work.

Next: [Managing Your AWS Costs](/guides/introduction-to-aws/10-cost-management), the final part, where you find out what all of this costs and clean it up.

## Keep Learning

- [AWS Lambda cold start optimization flashcards](/flashcards/aws-lambda-cold-start-optimization)
- [Use Terraform to set up a Lambda function triggered by a scheduled event source](/posts/use-terraform-to-set-up-a-lambda-function-triggered-by-a-scheduled-event-source)
- [The provided execution role does not have permissions to call DescribeNetworkInterfaces on EC2](/posts/the-provided-execution-role-does-not-have-permissions-to-call-describenetworkinterfaces-on-ec2)
