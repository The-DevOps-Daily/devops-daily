---
title: 'Introduction to AWS'
seoTitle: 'Introduction to AWS: How AWS Works and Its Core Services'
description: 'A beginner introduction to AWS: how AWS works (accounts, regions, APIs), then IAM, EC2, S3, VPC, RDS, load balancing, Lambda and cost control.'
category:
  name: 'AWS'
  slug: 'aws'
publishedAt: '2025-05-28T10:00:00Z'
updatedAt: '2026-10-23T09:00:00Z'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - AWS
  - Cloud Computing
  - Infrastructure
  - Beginner
---

Amazon Web Services (AWS) rents you computers, storage, databases and networks by the second or by the request, in data centers around the world. You do not buy hardware. You call an API, and a few seconds later you have a server, a bucket for files or a managed database.

AWS has more than 200 services, and the console can feel like a shop where every shelf looks important. This introduction to AWS starts with how AWS works, then teaches the dozen or so services that almost every application uses. You build one small web application step by step, so each service has a clear job.

## How AWS Works

Four ideas explain most of what you see in AWS.

**1. Everything is an API call.** The web console, the `aws` command line tool, the SDKs in your code, and tools such as Terraform and CloudFormation all call the same AWS APIs. Each request is signed with credentials (public content such as a public S3 object is the exception), IAM checks whether the caller may do it, and CloudTrail keeps a record of management calls such as creating or deleting resources. Anything you can click in the console, you can also script.

```diagram
{
  "type": "graph",
  "columns": [
    [
      { "id": "console", "label": "Console", "sub": "web browser", "icon": "globe", "tone": "slate" },
      { "id": "cli", "label": "AWS CLI", "sub": "aws ...", "icon": "activity", "tone": "slate" },
      { "id": "sdk", "label": "SDKs and IaC", "sub": "boto3, Terraform", "icon": "box", "tone": "slate" }
    ],
    [
      { "id": "iam", "label": "IAM", "sub": "who are you, is it allowed?", "icon": "shield", "tone": "amber", "detail": "Every request is signed. IAM authenticates the caller and evaluates the policies before the service does anything." }
    ],
    [
      { "id": "ec2", "label": "EC2", "sub": "servers", "icon": "server", "tone": "blue" },
      { "id": "s3", "label": "S3", "sub": "objects", "icon": "database", "tone": "green" },
      { "id": "rds", "label": "RDS", "sub": "databases", "icon": "database", "tone": "violet" }
    ]
  ],
  "edges": [
    ["console", "iam", "HTTPS"],
    ["cli", "iam", "HTTPS"],
    ["sdk", "iam", "HTTPS"],
    ["iam", "ec2"],
    ["iam", "s3"],
    ["iam", "rds"]
  ]
}
```

**2. Resources live in Regions and Availability Zones.** A **Region** is a geographic area, such as `us-east-1` (US East, N. Virginia) or `eu-west-1` (Europe, Ireland). Each Region contains several **Availability Zones** (AZs): one or more data centers with their own power and networking, many kilometers apart but close enough (within about 100 km) for fast private links between them. Most resources belong to one Region, and many (a server, a database, a subnet) belong to one AZ. If you spread your application across two or more AZs, it survives the loss of one data center.

**3. Your account is the boundary.** An AWS account holds your resources and receives the bill. IAM users, roles and policies decide who can do what inside it. A few services are global (IAM, Route 53, CloudFront), but most are regional, which is why a resource "disappears" when the console is set to another Region.

**4. You pay for what you use.** Prices are per second, per hour, per GB stored, per request or per GB transferred out. Nothing costs money until you create it, and most things keep costing money until you delete them. [Part 10](/guides/introduction-to-aws/10-cost-management) shows how to keep this predictable.

AWS also follows a **shared responsibility model**: AWS secures the data centers, hardware and the software that runs its services; you secure what you put on top, such as your IAM permissions, the operating system on your servers, your security group rules and your data.

## What You'll Build

Across the ten parts you build the infrastructure for a small photo-sharing web application, and grow it from one server to a load-balanced, self-healing setup across two Availability Zones:

```diagram
{
  "type": "infra",
  "flow": [
    { "label": "Users", "icon": "globe", "tone": "slate" },
    { "label": "Load balancer", "sub": "HTTPS, two AZs", "icon": "net", "tone": "amber" },
    { "label": "Web servers", "sub": "Auto Scaling group", "icon": "server", "tone": "blue" }
  ],
  "groups": [
    {
      "label": "photo-app VPC",
      "sub": "public and private subnets in two AZs",
      "icon": "cloud",
      "tone": "slate",
      "nodes": [
        { "label": "EC2", "sub": "app servers, private subnets", "icon": "server", "tone": "blue" },
        { "label": "RDS PostgreSQL", "sub": "private subnets", "icon": "database", "tone": "violet" }
      ]
    },
    {
      "label": "Regional services",
      "sub": "outside the VPC, reached over AWS APIs",
      "icon": "globe",
      "tone": "green",
      "nodes": [
        { "label": "S3", "sub": "uploaded photos", "icon": "database", "tone": "green" },
        { "label": "Lambda", "sub": "processes uploads", "icon": "cpu", "tone": "accent" },
        { "label": "CloudWatch", "sub": "metrics, logs, alarms", "icon": "activity", "tone": "red" }
      ]
    }
  ]
}
```

The application itself stays minimal (a static page and a small function), so the focus stays on the AWS services. Each part explains why the service exists, what it replaces in traditional hosting, the commands or console steps to set it up, and what it costs.

## The Learning Path

1. **[Getting Started with Your AWS Account](/guides/introduction-to-aws/01-account-setup)**: create the account, pick the free or paid plan, protect the root user, set a budget, and install the AWS CLI.
2. **[IAM: Users, Roles and Policies](/guides/introduction-to-aws/02-iam-security)**: sign in without long-lived access keys, read and write policies, and give servers roles instead of passwords.
3. **[EC2: Launch Your First Virtual Server](/guides/introduction-to-aws/03-ec2-servers)**: choose an instance type and AMI, launch a web server, connect to it and understand the public IPv4 charge.
4. **[S3: Cloud Object Storage](/guides/introduction-to-aws/04-s3-storage)**: buckets and objects, the secure defaults, storage classes, lifecycle rules and presigned URLs.
5. **[VPC: Build Your Private Network](/guides/introduction-to-aws/05-vpc-networking)**: subnets, route tables, internet and NAT gateways, security groups and VPC endpoints.
6. **[RDS: Managed Databases](/guides/introduction-to-aws/06-rds-databases)**: run PostgreSQL or MySQL with backups, patching and Multi-AZ failover handled for you.
7. **[Load Balancing and Auto Scaling](/guides/introduction-to-aws/07-load-balancing)**: put an Application Load Balancer in front of an Auto Scaling group and add HTTPS.
8. **[CloudWatch: Monitoring Your Applications](/guides/introduction-to-aws/08-cloudwatch-monitoring)**: metrics, logs, alarms and dashboards, and the agent for memory and log files.
9. **[Lambda: Serverless Functions](/guides/introduction-to-aws/09-lambda-serverless)**: run code on events without servers, and know when not to.
10. **[Managing Your AWS Costs](/guides/introduction-to-aws/10-cost-management)**: budgets, Cost Explorer, the common surprise charges, and how to clean up.

Each part builds on the previous ones, but you can jump to the topic you need.

## Prerequisites

- A computer with a terminal (Linux, macOS or Windows).
- A credit or debit card and a phone number for the AWS sign-up.
- Basic web knowledge: what a server, a database and a domain name are.

You do not need to be a programmer. The few code samples are short, and each one is explained.

## About AWS Costs and the Free Tier

AWS changed its Free Tier for accounts created on or after 15 July 2025. A new account receives USD 100 in credits at sign-up and can earn up to USD 100 more by completing activities in the console. You choose one of two plans:

- **Free plan**: you are never charged. The plan ends after six months or when the credits run out, whichever comes first. Then the account closes unless you upgrade to the paid plan within 90 days. Some services that could use up the credits quickly are not available.
- **Paid plan**: all services are available. Credits pay for usage first, and you pay normal prices after that.

Accounts created before 15 July 2025 had the older 12-month Free Tier (for example 750 hours a month of `t2.micro` or `t3.micro`), which has now ended for all of them. Every account still gets the "always free" monthly allowances of some services, such as 1 million AWS Lambda requests a month. See the [AWS Free Tier documentation](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier.html) for the current details.

Each part says which resources cost money. [Part 1](/guides/introduction-to-aws/01-account-setup) sets up a budget alert before you create anything, and [Part 10](/guides/introduction-to-aws/10-cost-management) shows how to clean up at the end.

:::tip
Delete what you create when you finish a part, or at least stop it. A forgotten load balancer, NAT gateway or database is the most common source of a surprise bill for learners.
:::

## Practice Hands-On

- Build a network in the browser with the [AWS VPC simulator](/games/aws-vpc-simulator), no account needed.
- Test yourself with the [AWS Cloud Services Quiz](/quizzes/aws-quiz) and the [AWS Essentials flashcards](/flashcards/aws-essentials).
- When you finish the guide, review your account with the [AWS Security Checklist](/checklists/aws-security).

Ready? Start with [Getting Started with Your AWS Account](/guides/introduction-to-aws/01-account-setup).
