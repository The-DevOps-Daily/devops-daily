---
title: 'EC2 Can Now Tell You Where IMDSv1 Is Still Enabled'
excerpt: 'AWS added a configuration metric for IMDSv1 on November 5. Here is how to separate migration gaps from active usage and retire tokenless metadata access safely.'
category:
  name: 'AWS'
  slug: 'aws'
date: '2026-11-10'
publishedAt: '2026-11-10T09:00:00Z'
updatedAt: '2026-11-10T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - AWS
  - EC2
  - Security
  - CloudWatch
  - DevOps
---

An EC2 instance can make no tokenless metadata requests all week and still allow them tomorrow. That distinction makes an IMDSv2 migration surprisingly easy to declare finished too early. AWS's new **ImdsV1Enabled** CloudWatch metric gives you a configuration signal to put beside your usage graphs. You can use it to find the remaining exceptions, test one workload at a time, and catch settings that drift back.

AWS [announced the metric on November 5, 2026](https://aws.amazon.com/about-aws/whats-new/2026/11/ec2-imdsv1enabled-cloudwatch-metric/), with availability in every AWS Region and no additional charge for the metric itself. It does not migrate instances for you. The useful change is that your migration dashboard can now answer whether IMDSv1 is still permitted, even when applications happen not to be using it.

## Prerequisites

- AWS CLI v2 configured for the account and Region you want to inspect.
- Permission to describe EC2 instances and read CloudWatch metrics.
- A staging instance that represents the application, agents, and scheduled jobs you run in production.
- A workload owner available before you change metadata settings. The inventory commands below are read-only; the final change command is not.

## Three signals, three different questions

AWS's [IMDSv2 transition guide](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instance-metadata-transition-to-version-2.html) defines the new metric as `1` when HTTP tokens are optional and `0` when they are required. Unlike the request counters, it is emitted from configuration rather than metadata access.

| Signal                    | Question it answers                                 | How to use it                       |
| ------------------------- | --------------------------------------------------- | ----------------------------------- |
| `ImdsV1Enabled`           | Does this instance still allow tokenless access?    | Find configuration exceptions.      |
| `MetadataNoToken`         | Did a tokenless request succeed?                    | Find callers that need migration.   |
| `MetadataNoTokenRejected` | Was a tokenless request rejected after enforcement? | Investigate compatibility problems. |

The two request metrics count successful tokenless calls and rejected attempts respectively; the [EC2 metrics reference](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/viewing_metrics_with_cloudwatch.html) documents both. A quiet request counter does not tell you which configuration is in place.

Consider a backup task that runs once a month. A five-day observation window might never execute it. My recommendation is to keep an explicit exception list with an owner, the workload's longest relevant execution cycle, and the next test date. That makes a migration gap actionable instead of turning it into another permanently yellow dashboard.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Find exceptions", "sub": "Configuration still permits v1", "icon": "server", "tone": "amber" },
    { "label": "Exercise callers", "sub": "Boot, jobs, agents, containers", "icon": "activity", "tone": "blue" },
    { "label": "Require tokens", "sub": "Verify health and rejected calls", "icon": "shield", "tone": "green" }
  ]
}
```

## Build an inventory before changing anything

Start with one account and Region. This example lists running and stopped instances whose metadata options still make tokens optional:

```bash
aws ec2 describe-instances \
  --region eu-west-1 \
  --filters \
    Name=instance-state-name,Values=running,stopped \
    Name=metadata-options.http-tokens,Values=optional \
  --query 'Reservations[].Instances[].{Id:InstanceId,State:State.Name,Endpoint:MetadataOptions.HttpEndpoint,Tokens:MetadataOptions.HttpTokens,HopLimit:MetadataOptions.HttpPutResponseHopLimit}' \
  --output table \
  --no-cli-pager
```

The [DescribeInstances API](https://docs.aws.amazon.com/cli/latest/reference/ec2/describe-instances.html) supports these filters and returns the metadata options. Keep the endpoint column: `HttpEndpoint=disabled` is a separate state, not proof of a working IMDSv2 migration. Record those instances separately rather than enabling metadata access just to make every row look alike.

Repeat the inventory for the accounts and Regions in your actual scope. An empty result in one Region is not a fleet-wide result. Include stopped instances in your review because they can return to service later.

Then discover the metric series available to your caller:

```bash
aws cloudwatch list-metrics \
  --region eu-west-1 \
  --metric-name ImdsV1Enabled \
  --output json \
  --no-cli-pager
```

This command lists series and their dimensions, not current values. Use the returned series in CloudWatch to inspect datapoints. AWS documents that [ListMetrics can take up to 15 minutes to show a new metric](https://docs.aws.amazon.com/cli/latest/reference/cloudwatch/list-metrics.html), and it omits series that have not reported in two weeks. An empty response is therefore a reason to check account, Region, visibility, and instance configuration, not a green migration result.

## Test the workload, then require IMDSv2

Choose one representative staging instance and run its real lifecycle: bootstrapping, service restart, deployment, scheduled maintenance, and credentials refresh. Include monitoring and backup agents. For containers, test from inside the container as well as from the host.

AWS notes that a metadata response hop limit of `1` [can cause problems in container environments](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-options.html). Do not change hop limits across the fleet just because a host-level test passed; investigate the affected network path separately.

Once the workload is ready, replace the example ID and apply the token requirement to that instance:

```bash
aws ec2 modify-instance-metadata-options \
  --region eu-west-1 \
  --instance-id i-0123456789abcdef0 \
  --http-tokens required \
  --no-cli-pager
```

The [modify command](https://docs.aws.amazon.com/cli/latest/reference/ec2/modify-instance-metadata-options.html) can return `pending` for a running instance. Verify that the setting reaches `applied`:

```bash
aws ec2 describe-instances \
  --region eu-west-1 \
  --instance-ids i-0123456789abcdef0 \
  --query 'Reservations[].Instances[].MetadataOptions' \
  --output json \
  --no-cli-pager
```

Expect `HttpTokens` to be `required` and `State` to be `applied`. The commands here are examples, not a transcript from a production account.

:::important
Do not pipe every inventory result straight into the modification command. First check application health and rejected tokenless requests on the staging instance. Keep any rollback scoped to the affected workload and record why it was necessary.
:::

## Keep replacement instances from undoing the work

Changing one running instance leaves a second question: what happens when Auto Scaling replaces it? Update the launch configuration your fleet actually uses, then launch a replacement in staging and inspect its effective metadata options.

AWS's [configuration precedence rules](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-options.html) put explicit launch settings ahead of account defaults, then AMI settings. Account defaults also do not rewrite existing instances. Review the launch template version your Auto Scaling group selects rather than assuming a newly edited template is already in use.

For the rollout, keep two views side by side: configuration exceptions and application health. Use `MetadataNoToken` during preparation and `MetadataNoTokenRejected` after enforcement. Keep missing telemetry visibly unknown, and assign each remaining exception an owner.

The useful finishing condition is specific: the intended instances require tokens, representative workloads still work, and replacement instances inherit the same setting. The new metric makes the configuration part easier to watch continuously.
