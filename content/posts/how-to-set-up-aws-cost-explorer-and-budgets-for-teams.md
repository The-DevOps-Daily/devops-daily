---
title: 'How to Set Up AWS Cost Explorer and Budgets for Teams'
excerpt: "Learn how to set up AWS Cost Explorer and Budgets to track cloud spending, prevent cost overruns, and keep your team informed about AWS expenses."
category:
  name: 'AWS'
  slug: 'aws'
date: '2025-11-22'
publishedAt: '2025-11-22T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - AWS
  - Cost Management
  - Cloud
  - FinOps
  - Budgets
---

Cloud costs can spiral out of control quickly if you're not paying attention. AWS Cost Explorer and Budgets give you the tools to track spending, identify cost drivers, and set up alerts before things get expensive.

This guide walks you through setting up both services for your team, from initial configuration to creating useful budgets and reports.

## What You'll Need

Before you start, make sure you have:

- AWS account with billing access (IAM permissions for `ce:*` and `budgets:*`)
- Root account access or an IAM user with appropriate permissions
- A clear understanding of your team's cost structure and spending patterns

## Understanding AWS Cost Explorer

AWS Cost Explorer is a visualization tool that lets you analyze your AWS costs and usage over time. You can view data at different levels of granularity, filter by service, region, or tags, and create custom reports.

The service is free to use for basic features, though there's a charge for more advanced API calls and saving custom reports.

## Enabling AWS Cost Explorer

Cost Explorer isn't enabled by default on all AWS accounts. Here's how to turn it on:

1. Log into the AWS Console with an account that has billing permissions
2. Navigate to the **Billing and Cost Management** dashboard
3. In the left sidebar, click **Cost Explorer**
4. Click **Enable Cost Explorer**

AWS will take up to 24 hours to prepare your cost data. You'll receive an email when it's ready. During this time, AWS analyzes your historical billing data (up to 12 months) and creates the initial dataset.

## Setting Up Cost Explorer for Your Team

Once enabled, you'll want to configure Cost Explorer to provide useful insights for your team.

### Create Custom Cost Reports

Start by creating reports that match how your team thinks about costs:

1. Go to **Cost Explorer** in the Billing console
2. Click **Create report**
3. Choose a report type:
   - **Cost and usage** - Shows spending over time
   - **Reservation utilization** - Tracks Reserved Instance usage
   - **Reservation coverage** - Shows how much of your usage is covered by reservations

For most teams, start with a cost and usage report.

### Filter by Service and Time Period

Configure the report to show relevant data:

- **Time range**: Select the period you want to analyze (last month, last 3 months, etc.)
- **Granularity**: Choose daily, monthly, or hourly views
- **Group by**: Organize costs by Service, Region, or Linked Account
- **Filters**: Add filters for specific services, tags, or usage types

### Use Tags for Better Cost Allocation

Tags are crucial for tracking costs by team, project, or environment. Set up a tagging strategy:

1. Define required tags (e.g., `Team`, `Project`, `Environment`)
2. Apply tags to all AWS resources
3. Enable **Cost Allocation Tags** in the Billing console:
   - Go to **Billing** > **Cost Allocation Tags**
   - Activate the tags you want to track
   - Wait 24 hours for tag data to appear in Cost Explorer

Once activated, you can group costs by these tags in Cost Explorer.

## Creating AWS Budgets

While Cost Explorer helps you analyze past spending, AWS Budgets lets you set spending limits and get alerts when you approach them.

### Access AWS Budgets

Navigate to **AWS Budgets** from the Billing dashboard:

1. Open the **Billing and Cost Management** console
2. Click **Budgets** in the left sidebar
3. Click **Create budget**

### Choose a Budget Type

AWS offers several budget types:

- **Cost budget** - Track spending against a dollar amount
- **Usage budget** - Monitor specific service usage (e.g., EC2 hours)
- **Reservation budget** - Track Reserved Instance or Savings Plans utilization
- **Savings Plans budget** - Monitor Savings Plans coverage

For most teams, start with a **Cost budget**.

### Set Up a Monthly Cost Budget

Here's how to create a basic monthly budget:

1. Select **Cost budget** and click **Next**
2. Give your budget a name (e.g., "Production Environment Monthly Budget")
3. Set the budget period to **Monthly**
4. Choose between:
   - **Fixed budget** - Same amount each month
   - **Planned budget** - Different amounts for different months

For a fixed budget, enter your monthly spending limit.

### Add Filters to Scope Your Budget

Don't create one budget for everything. Instead, create specific budgets for different parts of your infrastructure:

Apply filters to narrow the budget scope:

- **Services** - Limit to specific services like EC2, RDS, or S3
- **Tags** - Track budgets by team or project
- **Linked accounts** - Monitor spending in specific AWS accounts

For example, create separate budgets for:
- Development environment
- Production environment
- Specific team or project
- High-cost services (EC2, RDS, data transfer)

### Configure Budget Alerts

Alerts are what make budgets useful. Set up notifications at different thresholds:

1. In the **Configure alerts** section, add alert thresholds
2. Set alerts at useful percentages:
   - 50% - Early warning
   - 80% - Action needed
   - 100% - Budget exceeded
   - 110% - Serious overspend

3. Enter email addresses for notifications
4. You can also configure SNS topics for integration with Slack, PagerDuty, or other tools

## Best Practices for Team Cost Management

### 1. Create Budgets at Multiple Levels

Don't rely on a single company-wide budget. Create budgets for:

- Each environment (dev, staging, production)
- Each team or department
- Each major project
- High-cost services individually

This gives you better visibility into where money is going.

### 2. Set Up a Tagging Policy

Enforce tagging from day one:

- Define required tags before deploying resources
- Use AWS Config Rules to enforce tagging compliance
- Review untagged resources regularly
- Automate tagging with Infrastructure as Code tools

### 3. Review Cost Explorer Weekly

Make cost review a regular habit:

- Check Cost Explorer every Monday
- Look for unexpected spikes or trends
- Identify resources that can be optimized
- Share findings with your team

### 4. Use Forecasting

Cost Explorer includes forecasting based on historical data:

1. In Cost Explorer, select a time range
2. Click **Forecast** to see predicted costs
3. Use this to adjust budgets before overspending occurs

### 5. Set Up Cost Anomaly Detection

AWS offers anomaly detection that uses machine learning to spot unusual spending:

1. Go to **Cost Anomaly Detection** in the Billing console
2. Create a monitor for your services
3. Configure alerts for anomalies
4. Review detected anomalies weekly

## Setting Up Budget Alerts for Slack

To get budget alerts in Slack:

1. Create an SNS topic for budget notifications
2. Create a Lambda function that posts to Slack webhooks
3. Subscribe the Lambda to your SNS topic
4. Configure your budget to send alerts to the SNS topic

This keeps your team informed in real-time when budgets are approaching limits.

## Granting Team Access to Cost Data

Not everyone needs full billing access. Use IAM to grant appropriate permissions:

### Create a Cost Explorer Read-Only Role

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ce:Get*",
        "ce:Describe*",
        "ce:List*"
      ],
      "Resource": "*"
    }
  ]
}
```

This lets team members view cost data without modifying budgets or accessing other billing information.

### Create a Budget Manager Role

For team leads who need to manage budgets:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "budgets:*",
        "ce:*"
      ],
      "Resource": "*"
    }
  ]
}
```

## Monitoring Long-Term Trends

Beyond daily monitoring, track long-term trends:

1. Export cost data to S3 for analysis
2. Create monthly cost reports
3. Compare month-over-month changes
4. Identify seasonal patterns
5. Plan for growth

Use the **Cost and Usage Report** feature to export detailed billing data to S3, then analyze it with tools like Amazon Athena or QuickSight.

## Common Pitfalls to Avoid

### Not Acting on Alerts

Budget alerts are only useful if you respond to them. When an alert fires:

- Investigate immediately
- Identify the cause
- Take corrective action
- Document what happened

### Setting Budgets Too High

If your budget is set too high, you won't get early warnings. Start conservative and adjust based on actual usage.

### Ignoring Unutilized Resources

Cost Explorer shows you what you're paying for. Use it to find:

- Idle EC2 instances
- Unused Elastic IPs
- Old snapshots
- Unattached EBS volumes

Schedule regular cleanup sessions to remove these resources.

### Not Using Savings Plans or Reserved Instances

If you have predictable workloads, Reserved Instances and Savings Plans can reduce costs by 30-70%. Use Cost Explorer's recommendations to identify opportunities.

## Next Steps

Once you have Cost Explorer and Budgets configured:

1. Set up regular cost review meetings
2. Create a runbook for responding to budget alerts
3. Implement automated responses to common cost issues
4. Track cost optimization efforts over time
5. Share cost data with stakeholders regularly

Cost management is an ongoing process. The tools AWS provides give you visibility, but you need to act on the insights they provide.

Start with simple budgets and reports, then refine them as you learn more about your spending patterns. Your future self (and your finance team) will thank you.
