---
title: 'Managing Your AWS Costs'
description: 'Keep your AWS bill predictable: budgets, Cost Explorer, anomaly detection, the usual surprise charges, Savings Plans, Spot and a cleanup checklist.'
order: 10
---

**TLDR**: Set budgets with alerts, enable Cost Explorer (which also turns on Cost Anomaly Detection), and tag everything. The usual surprises are NAT gateways, idle load balancers, public IPv4 addresses, leftover EBS volumes and snapshots, log groups without retention, and resources in another Region. Right-size before you commit; then cover steady usage with Savings Plans and use Spot for work that can be interrupted. When you finish the guide, delete everything in the order below.

AWS bills for what exists and what moves, every hour, in every Region. That is what makes it cheap for small experiments and expensive for forgotten ones. This part shows how to see where the money goes, stop surprises early, pay less for what you keep, and clean up the photo app when you are done.

## Prerequisites

- The account and budget from [Part 1](/guides/introduction-to-aws/01-account-setup).
- Whatever you built in Parts 3 to 9; the cleanup checklist covers all of it.

## How AWS Bills You

- **Pay as you go**: each service has its own meters, such as instance hours, GB-months stored, requests, GB transferred and LCUs.
- **Monthly invoice**: charges accumulate during the month and are billed after it ends. Estimated charges in the console update at least once a day.
- **Free plan accounts** (created on or after 15 July 2025) are never charged: credits pay for usage, and the account closes when the six months or the credits run out, unless you upgrade.
- **Paid plan accounts** use credits first, then pay normal prices. Accounts created before 15 July 2025 had a 12-month Free Tier, which has ended for all of them; always-free allowances, such as Lambda's, continue for every account.

On the free plan, the **Credits** page and the **Free Tier** page in the Billing console show how fast you are using up the credits. On the paid plan, the tools below are what keep the bill under control.

## The Cost Tools

| Tool                                                | What it does                                                                                                                               | Cost                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| **Budgets**                                         | Alerts when actual or forecast cost or usage crosses a threshold; budget actions can apply a policy or stop instances                      | Budgets without actions are free; the first two action-enabled budgets are free |
| **Cost Explorer**                                   | Charts and tables of cost by service, Region, usage type, tag; up to 13 months of history plus the current month, and an 18-month forecast | Free in the console; the API is charged per request                             |
| **Cost Anomaly Detection**                          | Machine-learning monitors that flag unusual spend and email a summary                                                                      | Free                                                                            |
| **Cost Optimization Hub** and **Compute Optimizer** | Recommendations: idle resources, right-sizing, Graviton migration, Savings Plans                                                           | Free to opt in; some enhanced features are paid                                 |
| **Trusted Advisor**                                 | Best-practice checks; on Basic Support, only service limit checks and selected security and fault tolerance checks, no cost checks         | Included with the support plan                                                  |

**Enable Cost Explorer** now (Billing and Cost Management, **Cost Explorer**). It takes up to 24 hours to prepare data, and enabling it also configures Cost Anomaly Detection with a monitor for all AWS services and a daily email summary of anomalies.

## Budgets That Help

Part 1 created a zero-spend or small monthly budget. Add a forecast alert, so you hear about a problem early in the month rather than at the end:

```json
{
  "BudgetName": "monthly-20-usd",
  "BudgetLimit": { "Amount": "20", "Unit": "USD" },
  "TimeUnit": "MONTHLY",
  "BudgetType": "COST"
}
```

```json
[
  {
    "Notification": {
      "NotificationType": "ACTUAL",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 50,
      "ThresholdType": "PERCENTAGE"
    },
    "Subscribers": [{ "SubscriptionType": "EMAIL", "Address": "you@example.com" }]
  },
  {
    "Notification": {
      "NotificationType": "FORECASTED",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 100,
      "ThresholdType": "PERCENTAGE"
    },
    "Subscribers": [{ "SubscriptionType": "EMAIL", "Address": "you@example.com" }]
  }
]
```

```bash
aws budgets create-budget \
  --account-id 111122223333 \
  --budget file://budget.json \
  --notifications-with-subscribers file://notifications.json
```

You get an email when actual spend passes USD 10 and when AWS forecasts that the month will end above USD 20. For teams, create budgets per project or environment with a tag filter, and send them to the people who own those resources.

## Where the Money Goes

In **Cost Explorer**, start with **Group by: Service**, then switch to **Usage type** for the service at the top. Usage types are specific: `USE1-NatGateway-Hours`, `USE1-PublicIPv4:InUseAddress`, `USE1-TimedStorage-ByteHrs`. They tell you exactly which meter is running.

The same query from the CLI, reduced to one line per service with `--query` (example output):

```bash
aws ce get-cost-and-usage \
  --time-period Start=2026-10-01,End=2026-10-23 \
  --granularity MONTHLY \
  --metrics UnblendedCost \
  --group-by Type=DIMENSION,Key=SERVICE \
  --query 'ResultsByTime[].Groups[].[Keys[0],Metrics.UnblendedCost.Amount]' \
  --output text
```

```text
Amazon Elastic Compute Cloud - Compute	4.1873216
Amazon Virtual Private Cloud	2.64
```

In this example, the USD 2.64 under Amazon Virtual Private Cloud is what one public IPv4 address costs over 22 days (528 hours at USD 0.005 an hour): the kind of small, steady charge this part is about. Cost Explorer data is estimated until the month closes.

If you activated the `Project` tag as a **cost allocation tag** (Billing, **Cost allocation tags**), you can also group by `Project` and see what the photo app costs on its own. Activation applies to new costs, and you can request a backfill of up to 12 months, but only for resources that already carried the tag at the time. That is why Part 1 started tagging early.

## The Usual Surprise Charges

| What                          | Why it surprises people                                                                             | What to do                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **NAT gateways**              | Billed every hour, plus per GB processed, even with no traffic                                      | Delete when not needed; use gateway endpoints for S3 and DynamoDB |
| **Load balancers**            | Billed every hour, with or without targets                                                          | Delete test load balancers                                        |
| **Public IPv4 addresses**     | Every public IPv4 is billed per hour, in use or idle, including Elastic IPs and the ALB's addresses | Release unused Elastic IPs; keep servers private; consider IPv6   |
| **EBS volumes and snapshots** | Survive instance termination when not set to delete; snapshots and AMIs pile up                     | Delete `available` volumes, old snapshots and AMIs                |
| **Stopped RDS instances**     | Restart on their own after seven days; storage is billed while stopped                              | Delete with a final snapshot instead                              |
| **CloudWatch Logs**           | Log groups keep data forever by default                                                             | Set retention on every log group                                  |
| **Data transfer**             | Out to the internet, between Regions, and between AZs                                               | Keep chatty components in one AZ where safe; use CloudFront       |
| **Old database versions**     | RDS Extended Support adds charges after standard support ends                                       | Upgrade major versions on time                                    |
| **Other Regions**             | Resources there do not show in your usual console view                                              | Check EC2 Global View and Resource Explorer                       |
| **Leaked credentials**        | Someone else runs expensive instances on your account                                               | No access keys (Part 2), MFA everywhere, anomaly detection on     |

A few CLI checks for the most common leftovers (they print nothing when you are clean):

```bash
# Elastic IPs not attached to anything
aws ec2 describe-addresses --query 'Addresses[?AssociationId==null].PublicIp' --output text

# EBS volumes not attached to an instance
aws ec2 describe-volumes --filters Name=status,Values=available \
  --query 'Volumes[].[VolumeId,Size,CreateTime]' --output text

# Log groups without a retention period
aws logs describe-log-groups \
  --query 'logGroups[?retentionInDays==null].logGroupName' --output text
```

These check one Region at a time. Add `--region` or loop over Regions for a complete picture.

## Pay Less for What You Keep

Work through these in order. Committing before you right-size locks in waste.

1. **Delete** what is not used. The cheapest resource is the one that does not exist.
2. **Right-size**: Compute Optimizer compares instances, EBS volumes, Lambda functions and RDS with their actual use. An instance that never passes 10 percent CPU is a candidate to downsize; check its memory, network and disk needs before you do.
3. **Pick efficient types**: Graviton (`g`) instances and current generations usually cost less for the same work; gp3 instead of gp2 volumes.
4. **Schedule** non-production: stop development instances at night and at weekends with EventBridge Scheduler or the Instance Scheduler on AWS solution.
5. **Commit** for steady usage ([Savings Plans types](https://docs.aws.amazon.com/savingsplans/latest/userguide/plan-types.html), checked 23 October 2026):
   - **Compute Savings Plans** (one or three years) apply across EC2 instance families and Regions, Fargate and Lambda, at up to 66 percent off On-Demand.
   - **EC2 Instance Savings Plans** (one or three years) are tied to one instance family in one Region, at up to 72 percent off.
   - **Database Savings Plans** (launched December 2025, one-year term) cover RDS, Aurora, DynamoDB, ElastiCache and other database services, at up to 35 percent off.
   - **Reserved Instances** still exist for several services, but Savings Plans are the more flexible choice where they apply.
   - Free plan accounts cannot buy either; commitments are for production on the paid plan.
6. **Use Spot** for work that can be interrupted: CI runners, batch jobs, stateless workers in an Auto Scaling group with several instance types. Spot uses spare capacity at a steep discount (up to 90 percent off On-Demand, per the [Spot Instances page](https://aws.amazon.com/ec2/spot/)), but AWS can reclaim it. The two-minute interruption notice is best effort, so design the work to survive a sudden stop.

Serverless helps when usage is spiky: a Lambda function that runs a few thousand times a day costs a tiny fraction of a server that waits all day for the same requests. For constant high load, the reverse is often true.

### How Do I Lower an AWS Bill Without Making the App Slower?

Measure first, then change one thing at a time and compare. Record the numbers your users feel, such as p95 latency and error rate from Part 8, next to CPU, memory and cost, before and after each change. EC2 does not report memory on its own: install the CloudWatch agent, which Compute Optimizer also uses for better recommendations. These changes usually save money without hurting performance, as long as you check the trade-off that each one has:

- **gp2 to gp3 volumes.** AWS prices gp3 up to 20 percent lower per GB, and every gp3 volume gets 3,000 IOPS and 125 MiB/s as a baseline, whatever its size. A gp2 volume gets a baseline of 3 IOPS per GiB (at least 100) and bursts above it on credits, so small volumes get a much higher sustained baseline after the change. A gp2 volume larger than 1 TiB has more than 3,000 IOPS: set `--iops` and `--throughput` on gp3 to match it. The change works on a volume in use, and you can modify a volume up to four times in 24 hours:

```bash
aws ec2 modify-volume --volume-id vol-0123456789abcdef0 --volume-type gp3
aws ec2 describe-volumes-modifications --volume-ids vol-0123456789abcdef0 \
  --query 'VolumesModifications[].[ModificationState,Progress]' --output text
```

- **Burstable instances only for spiky load.** T3, T3a and T4g instances start in **unlimited** mode. When their average CPU over 24 hours stays above the baseline, AWS charges a flat rate per vCPU-hour for the extra, and a busy T instance can cost more than a general purpose one. Watch the `CPUSurplusCreditsCharged` metric; if it is often above zero, move to an `m` or `c` instance.
- **Lifecycle rules for S3 data you rarely read.** Move old objects to Standard-IA or Glacier Flexible Retrieval and expire what you do not need. Read the minimums first: Standard-IA bills at least 30 days and at least 128 KB per object, Glacier Flexible Retrieval at least 90 days, reads from both cost extra, and every transition is a billed request. Since September 2024, lifecycle rules do not move objects smaller than 128 KB by default. When you do not know how often objects are read, S3 Intelligent-Tiering moves them between tiers for a small monitoring fee per object; objects smaller than 128 KB stay in its frequent access tier.

```json
{
  "Rules": [
    {
      "ID": "old-logs",
      "Filter": { "Prefix": "logs/" },
      "Status": "Enabled",
      "Transitions": [
        { "Days": 30, "StorageClass": "STANDARD_IA" },
        { "Days": 90, "StorageClass": "GLACIER" }
      ],
      "Expiration": { "Days": 365 },
      "NoncurrentVersionExpiration": { "NoncurrentDays": 30 }
    }
  ]
}
```

```bash
aws s3api put-bucket-lifecycle-configuration --bucket photo-app-uploads-example \
  --lifecycle-configuration file://lifecycle.json
```

- **One load balancer for several services.** Every Application Load Balancer bills per hour and for its public IPv4 addresses. One ALB can route to many target groups with host and path rules ([Part 7](/guides/introduction-to-aws/07-load-balancing#h2-route-by-path-or-host)), up to 100 rules by default. Keep separate load balancers where teams, security rules or blast radius must stay apart.
- **CloudFront in front of static and cacheable content.** Data transfer from AWS origins to CloudFront is free, and every cache hit is a request your servers do not handle.

Some savings cost reliability, so make them on purpose. One NAT gateway for all AZs is cheaper than one per AZ, but instances in the other AZs then send their traffic across AZs, which is billed, and lose internet access when that one AZ fails. Keep one per AZ in production. The [cloud cost optimization quiz](/quizzes/cloud-cost-optimization-quiz) and the [cost optimization interview questions](/interview-questions/topic/cloud#cloud-cost-optimization) test the trade-offs.

## Clean Up the Photo App

When you have finished the guide, delete the resources in this order (dependencies first). Check each Region you used.

1. **Auto Scaling group** `photo-app-web` (terminates its instances), then the **load balancer**, the **target group** and the **launch template**.
2. **EC2 instances** you launched by hand (Part 3), then **Volumes**, **Snapshots** and **AMIs** you no longer need.
3. **RDS**: delete `photo-app-db` (take a final snapshot only if you want to keep the data), then old manual snapshots. The managed master user secret is deleted with the instance; delete the application's own secret in **Secrets Manager** yourself.
4. **NAT gateways** and **interface endpoints**, then **release Elastic IPs**.
5. **Lambda** function `process-upload`, its execution role and its log group.
6. **S3**: empty the bucket (including old versions) and delete it.
7. **CloudWatch** alarms and dashboards, the **SNS** topic, and log groups.
8. **VPC** `photo-app`: deleting the VPC from the console also removes its subnets, route tables, internet gateway, gateway endpoints and security groups.
9. **IAM**: delete the `photo-app-web` role and any test users or policies. Keep your admin user.

Then check **Cost Explorer** grouped by service for the last few days, and **EC2 Global View** for anything left in other Regions.

### How Do I Delete Every Resource in an AWS Account?

If you will not use the account again, close it from the **Account** page instead of deleting resources one by one. On the free plan, it closes by itself when the plan ends. Closing stops the charges for most services; Reserved Instances and Savings Plans keep billing until their term ends. For 90 days after closing you can reopen the account; after that, AWS deletes its content and resources. In an organization with all features enabled, the management account can close a member account:

```bash
aws organizations close-account --account-id 111122223333
```

To keep the account but empty it, for example a sandbox that you reset every week, use **aws-nuke**. The maintained version is [ekristen/aws-nuke](https://github.com/ekristen/aws-nuke) (version 3); the original `rebuy-de/aws-nuke` is archived. It has safety checks on purpose: it refuses to run without a non-empty `blocklist` of accounts it must never touch, without an account alias, or against an alias that contains `prod`, and it only lists what it would delete until you add `--no-dry-run`.

```yaml
# nuke-config.yaml
blocklist:
  - '999999999999' # production: aws-nuke refuses to run against it

regions:
  - global # IAM and other global resources
  - us-east-1
  - eu-west-1

accounts:
  '111122223333': # the sandbox account to empty
    filters:
      IAMRole:
        - 'OrganizationAccountAccessRole'
      IAMRolePolicyAttachment:
        - 'OrganizationAccountAccessRole -> AdministratorAccess'
```

The filters keep the role that you use to get into the account. Run it once without deleting anything, read the whole list, then run it for real:

```bash
aws-nuke run --config nuke-config.yaml
aws-nuke run --config nuke-config.yaml --no-dry-run
```

Shell one-liners are not a replacement. `aws s3 rb --force` does not remove old object versions, so deleting a versioned bucket fails, and `aws ec2 terminate-instances` with IDs from `describe-instances` covers one Region and stops at instances with termination protection. Whatever you use, finish with **Cost Explorer** grouped by service and by Region: a resource that still costs money shows up there.

## Habits That Keep Bills Boring

- Tag everything with `Project`, `Environment` and `Owner`, and activate the tags for cost allocation.
- Before creating something, know how you will delete it, ideally with infrastructure as code so `terraform destroy` removes it all.
- Look at Cost Explorer once a week while learning; it takes a minute.
- Keep experiments in a separate account from anything real. AWS Organizations makes extra accounts free to create, but joining an organization ends the account's Free Tier credits.
- Treat a budget alert as an incident: find the resource and decide, the same day.

## Summary

- Budgets alert, Cost Explorer explains, Cost Anomaly Detection catches the unexpected; turn all three on.
- The common surprises are hourly resources that sit idle: NAT gateways, load balancers, public IPv4 addresses, volumes, snapshots and log storage.
- Delete, right-size and modernize before you commit to Savings Plans or Reserved Instances; use Spot for interruptible work.
- Clean up in dependency order and check every Region.

## Where to Go Next

You now know the core of AWS: accounts and IAM, compute, storage, networking, databases, scaling, monitoring, serverless and cost. The next step is to stop clicking:

- describe the whole photo app as code with the [Introduction to Terraform guide](/guides/introduction-to-terraform);
- package the web app in containers with the [Introduction to Docker guide](/guides/introduction-to-docker);
- build machine images for the launch template with the [Introduction to Packer guide](/guides/introduction-to-packer);
- deploy it automatically with the [Introduction to CI/CD guide](/guides/introduction-to-cicd).

## Keep Learning

- [How to Set Up AWS Cost Explorer and Budgets for Teams](/posts/how-to-set-up-aws-cost-explorer-and-budgets-for-teams)
- [FinOps Principles and the Operating Model](/guides/finops-for-devops-engineers/01-principles)
- [FinOps for DevOps Engineers](/guides/finops-for-devops-engineers)
- [Cloud Cost Optimization Quiz](/quizzes/cloud-cost-optimization-quiz)
- [AWS Well-Architected Review Checklist](/checklists/aws-well-architected)
