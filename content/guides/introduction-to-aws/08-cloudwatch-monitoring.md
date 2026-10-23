---
title: 'CloudWatch: Monitoring Your Applications'
description: 'Monitor AWS with CloudWatch: built-in metrics, the CloudWatch agent for memory and logs, alarms with SNS email, Logs Insights queries and log retention.'
order: 8
---

**TLDR**: AWS services publish metrics to CloudWatch for free, but EC2 does not report memory or disk usage: install the CloudWatch agent for those and for log files. Create alarms on symptoms users feel (5xx errors, latency, unhealthy targets, a full disk) and send them to an SNS topic. Set a retention period on every log group, because the default is to keep logs forever. Use Logs Insights to search logs, and Embedded Metric Format to turn log lines into metrics.

Without monitoring, your users are your alerting system. Amazon CloudWatch collects metrics and logs from AWS services and your own code, draws them on dashboards, and raises alarms when something crosses a line.

In this part, the photo app gets the monitoring a small production service needs: memory and disk metrics from the servers, web server logs in CloudWatch Logs, alarms that email you, and queries to find out what went wrong.

## Prerequisites

- The load balancer and Auto Scaling group from [Part 7](/guides/introduction-to-aws/07-load-balancing) and the database from [Part 6](/guides/introduction-to-aws/06-rds-databases).
- An email address for alarm notifications.

## The Building Blocks

- **Metrics** are numbers over time, stored in a **namespace** (`AWS/EC2`, `AWS/ApplicationELB`, `AWS/RDS`, or your own) and identified by **dimensions** such as `InstanceId` or `TargetGroup`. You read them through a **statistic** (Average, Sum, Maximum, p99) over a **period** (1 minute, 5 minutes).
- **Logs** are text lines in **log streams** (usually one per instance or function), grouped into **log groups** (one per application or component). Retention and permissions are set per log group.
- **Alarms** watch one metric (or a math expression of several) and switch between `OK`, `ALARM` and `INSUFFICIENT_DATA`. On a change they notify an SNS topic, scale an Auto Scaling group, or stop, reboot or recover an instance.
- **Dashboards** put the graphs you need during an incident on one page.

## Metrics You Get for Free

| Service                    | Useful metrics                                                                                                    | Notes                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| EC2 (`AWS/EC2`)            | `CPUUtilization`, `NetworkIn`, `NetworkOut`, `StatusCheckFailed`                                                  | Every 5 minutes (basic monitoring); 1 minute costs extra (detailed monitoring) |
| EBS (`AWS/EBS`)            | `VolumeReadOps`, `VolumeWriteOps`, `VolumeQueueLength`                                                            | Per volume                                                                     |
| ALB (`AWS/ApplicationELB`) | `RequestCount`, `TargetResponseTime`, `HTTPCode_Target_5XX_Count`, `HTTPCode_ELB_5XX_Count`, `UnHealthyHostCount` | Per load balancer and target group                                             |
| RDS (`AWS/RDS`)            | `CPUUtilization`, `FreeStorageSpace`, `FreeableMemory`, `DatabaseConnections`, `ReadLatency`                      | Per DB instance                                                                |
| Lambda (`AWS/Lambda`)      | `Invocations`, `Errors`, `Duration`, `Throttles`                                                                  | Part 9                                                                         |
| S3 (`AWS/S3`)              | `BucketSizeBytes`, `NumberOfObjects`                                                                              | Once a day; request metrics are optional and paid                              |

What is missing: EC2 sees the virtual machine from the outside, so it cannot report **memory** or **disk space** used inside the operating system. That is the agent's job.

## Give the Private Servers a Way Out

The agent sends data to the CloudWatch and CloudWatch Logs APIs, and reads instance tags from the EC2 API for the Auto Scaling group dimension. The web servers from Part 7 run in private subnets whose only path out is the S3 gateway endpoint, so the agent cannot reach those APIs yet. Session Manager has the same problem. Pick one:

- **A NAT gateway** (Part 5). Create one with **Availability mode: Regional** in the `photo-app` VPC, then add a route `0.0.0.0/0` to the NAT gateway in the route tables of the `app-a` and `app-b` subnets. It also covers Session Manager and package updates from outside Amazon Linux.
- **Interface VPC endpoints** for `logs`, `monitoring` and `ec2`, plus `ssm`, `ssmmessages` and `ec2messages` for Session Manager, in the two app subnets with **private DNS** enabled. Give them a security group that allows HTTPS 443 from `photo-app-web`. Traffic stays inside AWS, but each endpoint is billed per hour in every AZ you enable it in.

Both cost money every hour. For this guide, a NAT gateway while you work through Parts 8 and 9, deleted afterwards, is the cheaper choice.

## Install the CloudWatch Agent

The agent runs on the instance and sends system metrics and log files to CloudWatch.

1. Attach the AWS managed policy `CloudWatchAgentServerPolicy` to the `photo-app-web` role.
2. Install the agent:

```bash
sudo dnf install -y amazon-cloudwatch-agent
```

3. Save this configuration as `/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json`:

```json
{
  "metrics": {
    "append_dimensions": {
      "InstanceId": "${aws:InstanceId}",
      "AutoScalingGroupName": "${aws:AutoScalingGroupName}"
    },
    "aggregation_dimensions": [["AutoScalingGroupName"]],
    "metrics_collected": {
      "mem": { "measurement": ["used_percent"] },
      "disk": { "measurement": ["used_percent"], "resources": ["/"] }
    }
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/httpd/access_log",
            "log_group_name": "photo-app/httpd-access",
            "log_stream_name": "{instance_id}",
            "retention_in_days": 30
          },
          {
            "file_path": "/var/log/httpd/error_log",
            "log_group_name": "photo-app/httpd-error",
            "log_stream_name": "{instance_id}",
            "retention_in_days": 30
          }
        ]
      }
    }
  }
}
```

4. Load the configuration and start the agent:

```bash
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config -m ec2 -s \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
```

Instances in an Auto Scaling group are replaced, not edited, so put steps 2 to 4 into a new version of the launch template's user data (write the configuration file with a heredoc), then start an instance refresh as in Part 7. To try it first, run the same commands on one instance in a Session Manager shell.

After a few minutes, `mem_used_percent` and `disk_used_percent` appear in the `CWAgent` namespace, per instance and aggregated per Auto Scaling group, and the two log groups fill with web server logs.

For many instances, store the configuration in Systems Manager Parameter Store and start the agent with `-c ssm:<parameter-name>`. Every new instance then reads the same configuration; after you change it, run `fetch-config` again on running instances (for example with Systems Manager Run Command) or replace them with an instance refresh.

## Create Your First Alarms

Alarms notify an **SNS topic**, and the topic delivers to email, SMS, chat tools or other services.

1. In **SNS**, create a standard topic `photo-app-alerts` and add an **email** subscription. Click the confirmation link in the email; until you do, nothing is delivered.
2. In **CloudWatch**, **Alarms**, **Create alarm**, pick a metric, a threshold and the topic.

Start with alarms that mean users are affected or soon will be:

| Alarm             | Metric                                   | Condition                    |
| ----------------- | ---------------------------------------- | ---------------------------- |
| Web errors        | `HTTPCode_Target_5XX_Count` (Sum, 1 min) | Above 10 for 3 of 5 minutes  |
| Unhealthy targets | `UnHealthyHostCount` (Maximum, 1 min)    | Above 0 for 5 minutes        |
| Slow responses    | `TargetResponseTime` (p95, 5 min)        | Above 1 second for 3 periods |
| Database disk     | `FreeStorageSpace` (Minimum, 5 min)      | Below 2 GB                   |
| Server disk       | `disk_used_percent` (Maximum, 5 min)     | Above 85                     |

The first one from the CLI (the load balancer dimension value is an example; copy yours from the metric in the console):

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name photo-app-web-5xx \
  --namespace AWS/ApplicationELB \
  --metric-name HTTPCode_Target_5XX_Count \
  --dimensions Name=LoadBalancer,Value=app/photo-app-alb/50dc6c495c0c9188 \
  --statistic Sum --period 60 \
  --evaluation-periods 5 --datapoints-to-alarm 3 \
  --threshold 10 --comparison-operator GreaterThanThreshold \
  --treat-missing-data notBreaching \
  --alarm-actions arn:aws:sns:us-east-1:111122223333:photo-app-alerts \
  --ok-actions arn:aws:sns:us-east-1:111122223333:photo-app-alerts
```

Three settings decide whether an alarm is useful or noisy:

- **Evaluation periods and datapoints to alarm** ("3 out of 5"): one bad minute does not wake anyone; a sustained problem does.
- **Missing data**: a 5xx count has no data points when there are no errors, so treat missing data as `notBreaching`. For a heartbeat-style metric, missing data should be `breaching`.
- **OK actions**: a notification when the problem clears saves you from checking.

Avoid alarms on causes that do not hurt anyone, such as one instance at 90 percent CPU in a group that scales. Target tracking (Part 7) already reacts to that. Combine related alarms into a **composite alarm** to send one notification instead of five.

## Search Logs with Logs Insights

**CloudWatch Logs Insights** queries one or more log groups over a time range you pick in the console. A few queries for the photo app:

Recent errors from the web server:

```text
fields @timestamp, @logStream, @message
| filter @message like /error/
| sort @timestamp desc
| limit 50
```

Requests by HTTP status, parsed from the Apache access log:

```text
fields @message
| parse @message /"(?<method>[A-Z]+) (?<path>\S+) HTTP\/[\d.]+" (?<status>\d{3})/
| stats count() as requests by status
| sort requests desc
```

Server errors per five minutes, to see when a problem started:

```text
parse @message /" (?<status>\d{3}) /
| filter status like /^5/
| stats count() as errors by bin(5m)
```

The time range comes from the console's time picker, not from the query. Logs Insights charges per GB scanned, so narrow the time range and the log groups. Besides its own query language, Logs Insights also accepts SQL and OpenSearch PPL.

## Set Log Retention

New log groups keep data **forever** by default, and stored logs are billed every month. The agent configuration above already sets 30 days for its log groups. Log groups that AWS services create for you (Lambda, VPC Flow Logs, RDS exports) need it set separately, for example for the function you create in Part 9, once it has run and its log group exists:

```bash
aws logs put-retention-policy \
  --log-group-name /aws/lambda/process-upload \
  --retention-in-days 30
```

## Publish Your Own Metrics

Business metrics such as photo uploads or failed logins tell you more than CPU graphs. There are two ways to send them:

- **`PutMetricData`** API calls from your code (through the SDK). Each call is a request, and requests cost money at volume.
- **Embedded Metric Format (EMF)**: your code writes a structured JSON log line, and CloudWatch Logs extracts the metric from it. No API calls, no extra latency in the request path, and the log line keeps the context. Lambda and the CloudWatch agent both support it.

An EMF line is ordinary JSON on standard output:

```python
import json
import time


def emit_metric(name, value, unit="Count", **dimensions):
    """Print one CloudWatch Embedded Metric Format record."""
    print(json.dumps({
        "_aws": {
            "Timestamp": int(time.time() * 1000),
            "CloudWatchMetrics": [{
                "Namespace": "PhotoApp",
                "Dimensions": [list(dimensions)],
                "Metrics": [{"Name": name, "Unit": unit}],
            }],
        },
        **dimensions,
        name: value,
    }))


emit_metric("PhotoUploads", 1, Service="web")
```

```terminal
{
  "title": "an EMF record (Python, local run)",
  "prompt": "$",
  "steps": [
    {
      "cmd": "python3 emf.py",
      "output": "{\"_aws\": {\"Timestamp\": 1792770338307, \"CloudWatchMetrics\": [{\"Namespace\": \"PhotoApp\", \"Dimensions\": [[\"Service\"]], \"Metrics\": [{\"Name\": \"PhotoUploads\", \"Unit\": \"Count\"}]}]}, \"Service\": \"web\", \"PhotoUploads\": 1}"
    }
  ]
}
```

When a line like this reaches CloudWatch Logs (from Lambda, or through the agent), the metric `PhotoUploads` appears in the `PhotoApp` namespace with the dimension `Service=web`.

:::warning
Every unique combination of metric name and dimension values is a separate custom metric, billed per month. Never use high-cardinality values such as user IDs, request IDs or full URLs as dimensions. Put them in the log line as plain fields instead, where Logs Insights can still query them.
:::

## Dashboards

Each service console has **automatic dashboards**. For the photo app, build one custom dashboard with what you would look at during an incident: ALB requests, 5xx counts and p95 latency; healthy hosts; ASG instance count; RDS CPU, connections and free storage; and the Logs Insights error query as a widget. Keep it to one screen.

## What It Costs

CloudWatch has an always-free allowance each month, per the [CloudWatch pricing page](https://aws.amazon.com/cloudwatch/pricing/) (checked 23 October 2026):

- basic monitoring metrics from AWS services;
- 10 custom or detailed monitoring metrics and 10 alarm metrics;
- 1 million API requests (not counting `GetMetricData` and a few others);
- 5 GB of log data ingested, archived and scanned by Logs Insights;
- 3 custom dashboards with up to 50 metrics each.

Beyond that you pay per metric, per alarm, per GB of logs ingested and stored, and per GB scanned. Log ingestion is where bills grow: a chatty debug log can cost more than the servers that write it. Keep log levels sensible in production and set retention everywhere.

## A Quick Incident Walkthrough

The "Web errors" alarm emails you. Then:

1. **Dashboard**: when did the 5xx count rise? Did healthy hosts drop, did latency rise, did the instance count change?
2. **Database**: do RDS connections or CPU jump at the same moment?
3. **Logs Insights**: run the error query over that time window. Is it one instance (`@logStream`) or all of them?
4. **Changes**: did an instance refresh, a deployment or a configuration change (CloudTrail event history) happen just before?

The answer is usually in the correlation between two graphs.

## Common Mistakes

- **No memory or disk metrics**, because the agent was never installed.
- **Logs kept forever** at full price.
- **Alarm emails that nobody confirmed**, so the SNS subscription stays pending.
- **Alerting on CPU spikes** instead of on user-facing symptoms; people learn to ignore the noise.
- **High-cardinality dimensions** in custom metrics.
- **Health checks and alarms that test the same thing in different ways**, so one outage sends ten emails. Use composite alarms.

## Summary

- AWS metrics are free and automatic; memory, disk and log files need the CloudWatch agent.
- Alarm on symptoms, with "M out of N" datapoints and the right missing-data setting, and send them to SNS.
- Logs Insights finds the needle; set retention on every log group.
- Embedded Metric Format turns structured log lines into metrics without API calls; keep dimensions low-cardinality.

Next: [Lambda: Serverless Functions](/guides/introduction-to-aws/09-lambda-serverless), where code runs only when something happens, such as a photo upload.

## Keep Learning

- [Your Logs Cost More Than the Service That Emits Them](/posts/your-logs-cost-more-than-the-service)
- [How to Configure CloudWatch Logs Subscription Filter to Lambda With Terraform](/posts/terraform-cloudwatch-log-subscription-lambda)
- [Monitoring Golden Signals interview questions](/interview-questions/junior/monitoring-golden-signals)
