---
title: 'A Practical Guide to FinOps for DevOps Engineers'
seoTitle: 'FinOps for DevOps Engineers: A Practical Cloud Cost Guide'
description: 'FinOps for DevOps engineers: read FOCUS billing data, tag and allocate cloud costs, set budgets and anomaly alerts, and add cost checks to CI/CD.'
category:
  name: 'FinOps'
  slug: 'finops'
publishedAt: '2025-01-15T09:00:00Z'
updatedAt: '2026-10-27T09:00:00Z'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - FinOps
  - Cloud Costs
  - DevOps
  - Cost Optimization
  - Cloud Native
  - Terraform
  - AWS
  - Azure
  - GCP
---

Every pull request that changes infrastructure is also a spending decision. A bigger instance type, a NAT gateway in a test VPC, a log level left at debug: each one shows up on a bill weeks later, usually on someone else's desk. FinOps is the practice that closes that gap. The FinOps Foundation describes it as an operational framework and cultural practice that maximizes the business value of technology, through timely, data-driven decisions and collaboration between engineering, finance and business teams.

For a DevOps engineer, that turns into concrete work: tags and accounts that say who owns each resource, budgets and anomaly alerts that reach the right team, cost checks in pull requests, and the habit of treating cost like latency or error rate, as one more number you watch and improve. This guide teaches that work with real tools and real data.

## How Cloud Costs Reach a Decision

Cost data moves in a loop. An engineering change creates usage, the provider meters it and bills it, the billing data is grouped by owner, and someone with the right context decides what to do. FinOps calls the three stages of the loop **Inform**, **Optimize** and **Operate**.

```diagram
{
  "type": "loop",
  "nodes": [
    { "label": "Inform", "sub": "who spends what, and on what", "variant": "soft" },
    { "label": "Optimize", "sub": "use less, pay less per unit", "variant": "solid" },
    { "label": "Operate", "sub": "budgets, policies, reviews", "variant": "accent" }
  ],
  "loopBack": "repeat for each new service and each new bill",
  "goal": "spend that matches the value it creates"
}
```

DevOps teams sit in the middle of this loop. You write the Terraform that creates the resources, run the pipelines that change them and own the dashboards that show their behavior. Adding cost to those tools is cheaper than asking a separate team to reverse-engineer a bill.

## What You'll Build

The guide follows one example: `checkout`, a service owned by the `payments` team, running on AWS in `us-east-1` with `dev`, `staging` and `prod` environments. Across the parts you:

- read anonymized real billing data in the FOCUS format with DuckDB, and find the tag problems in it;
- find idle resources with Cloud Custodian and over-requested Kubernetes workloads with OpenCost;
- write Terraform with a tag schema that fails a plan when an owner is missing, environment sizes, an office-hours schedule for `dev`, a budget per environment and an anomaly alert per service;
- check every Terraform plan against a cost policy in CI, and estimate pull request costs with Infracost;
- build a showback report and the metrics and habits that keep costs owned.

All of the code is in the companion repository. Its workflow ran every command whose output the guide shows, on a GitHub-hosted runner, so that output is real, and none of those runs needed a cloud account: Terraform plans with mock credentials, and Cloud Custodian runs against a local AWS emulator. Commands that only make sense against a real account, such as the AWS CLI checks, were run without credentials to confirm that they parse, and the CI workflows that need an AWS role or an Infracost account are included but switched off.

```github
https://github.com/The-DevOps-Daily/guide-finops-demo-2026-10-27
```

## Prerequisites

- Basic experience with one cloud provider (the examples use AWS; Parts 3 and 4 show the Azure and Google Cloud equivalents).
- Terraform basics: variables, `plan` and `apply`. The [Introduction to Terraform guide](/guides/introduction-to-terraform) covers them.
- A pull request workflow in GitHub Actions or a similar CI system.
- A Linux or macOS shell, or WSL on Windows, to run the examples.

You do not need a finance background. The guide explains the billing terms as they come up.

## The Learning Path

1. **[FinOps Principles and the Operating Model](/guides/finops-for-devops-engineers/01-principles)**: the principles, phases and roles, the cost columns on a bill, and a first look at FOCUS billing data.
2. **[Common Cloud Cost Challenges](/guides/finops-for-devops-engineers/02-challenges)**: oversized and idle resources, missing and inconsistent tags, always-on environments, data transfer, logs, Kubernetes and AI spend.
3. **[Essential FinOps Tools](/guides/finops-for-devops-engineers/03-tools)**: native tools on each cloud, FOCUS exports with DuckDB, Infracost, OpenCost, Cloud Custodian and commercial platforms.
4. **[Tags, Budgets and Alerts as Code](/guides/finops-for-devops-engineers/04-practical-examples)**: the `checkout` Terraform, from tag validation to budgets and anomaly alerts.
5. **[FinOps in CI/CD Pipelines](/guides/finops-for-devops-engineers/05-cicd-integration)**: cost estimates and policy checks on pull requests, approvals for big changes, and cleanup of preview environments.
6. **[A Cost-Conscious Engineering Culture](/guides/finops-for-devops-engineers/06-cultural-shift)**: showback, shared costs, unit costs and the reviews that make teams own their spend.
7. **[Metrics and Next Steps](/guides/finops-for-devops-engineers/07-conclusion)**: what to measure, AI and sustainability costs, and a 90-day plan.

Prices in the guide are AWS on-demand list prices for US East (N. Virginia), taken from the AWS Price List files published in October 2026. Your prices depend on the Region, your discounts and the date, so check them before you rely on a number.
