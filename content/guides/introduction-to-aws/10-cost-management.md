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

Then check **Cost Explorer** grouped by service for the last few days, and **EC2 Global View** for anything left in other Regions. Tools such as aws-nuke can delete everything in an account, which is useful for sandbox accounts and dangerous anywhere else; see [How to Nuke All AWS Resources in an AWS Account](/posts/nuke-all-aws-resources).

If you will not use the account again, close it from the **Account** page. On the free plan, it closes by itself when the plan ends.

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
- [What Is FinOps? A Beginner's Guide to Cloud Cost Management](/posts/what-is-finops-a-beginners-guide-to-cloud-cost-management)
- [FinOps for DevOps Engineers](/guides/finops-for-devops-engineers)
- [Cloud Cost Optimization Quiz](/quizzes/cloud-cost-optimization-quiz)
- [AWS Well-Architected Review Checklist](/checklists/aws-well-architected)
