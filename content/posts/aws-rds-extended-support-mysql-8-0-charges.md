---
title: 'RDS MySQL 8.0 Has Been Billing Extended Support Since August: Find It and Price It'
excerpt: 'RDS MySQL 8.0 passed standard support on July 31, 2026. Inventory every enrolled database, find the charge in billing data, and decide whether an 8.4 upgrade costs less than another year of support.'
category:
  name: 'FinOps'
  slug: 'finops'
date: '2026-11-17'
publishedAt: '2026-11-17T07:00:00Z'
updatedAt: '2026-11-17T07:00:00Z'
readingTime: '10 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - FinOps
  - AWS
  - RDS
  - MySQL
  - PostgreSQL
  - EKS
  - Cost Optimization
---

If an RDS for MySQL 8.0 instance is still running, its bill changed on August 1, 2026. RDS ended standard support for 8.0 on July 31 and now bills Extended Support by vCPU-hour in addition to the DB instance, storage, backup, and transfer charges. The easy mistake is treating that as an upgrade decision for later. It is already a recurring line item.

This post gives you a per-Region inventory, a billing-data path, a cost model, and the decision points for an 8.0 to 8.4 upgrade. The same inventory also exposes older PostgreSQL and Aurora versions that have crossed their own support boundaries.

## TL;DR

- RDS MySQL 8.0 entered paid Extended Support on **August 1, 2026**. Year 3 pricing begins August 1, 2028, and support ends July 31, 2029. [AWS's MySQL release calendar](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/MySQL.Concepts.VersionMgmt.html) also says MySQL 5.7 and 8.0 are now only available under Extended Support.
- Use `EngineLifecycleSupport` to see enrollment, but combine it with engine version and support dates. Enrollment alone does not mean a charge until standard support has ended.
- RDS charges provisioned MySQL Extended Support per vCPU-hour. AWS says it also applies to Multi-AZ standby instances and to read replicas on the same version, so count every one.
- A new CLI or API-created instance defaults to Extended Support enabled if you omit the setting. Specify `open-source-rds-extended-support-disabled` if automatic upgrade or creation failure is preferable to silent enrollment.
- EKS has the same financial shape at the control-plane level: $0.10 per cluster-hour during standard support and $0.60 in extended support. Set its upgrade policy to `STANDARD` only when you accept AWS automatically upgrading it at the end of standard support.

## Prerequisites

- AWS CLI v2 credentials able to call RDS, EC2, EKS, and Cost Explorer in the intended accounts.
- Billing permission for `ce:GetCostAndUsage`. For organization-wide results, run it from the AWS Organizations management account or a role there; member accounts see only their own [Cost Explorer data](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-access.html).
- A current RDS pricing view for each Region you operate in. Rates and support calendars are Region and date sensitive.
- An upgrade test environment and an application owner before changing an engine version or lifecycle setting.

## What changed, and what RDS is charging

AWS lists these RDS for MySQL dates: MySQL 8.0 community end of life was April 30, 2026, RDS standard support ended July 31, 2026, Year 1 pricing began August 1, 2026, Year 3 begins August 1, 2028, and Extended Support ends July 31, 2029. [MySQL 5.7's calendar](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/MySQL.Concepts.VersionMgmt.html) is already in Year 3: it began charging March 1, 2024, stepped up March 1, 2026, and ends June 30, 2029. MySQL 8.4 remains in standard support until July 31, 2029.

The other calendars deserve the same review. RDS for PostgreSQL 11, 12, and 13 started paid Extended Support on April 1, 2024, March 1, 2025, and March 1, 2026. PostgreSQL 14 reaches the boundary after standard support ends February 28, 2027, with Year 1 pricing from March 1, 2027. Those dates come from the [RDS PostgreSQL release calendar](https://docs.aws.amazon.com/AmazonRDS/latest/PostgreSQLReleaseNotes/postgresql-release-calendar.html). Aurora has a different schedule: Aurora MySQL 3, compatible with MySQL 8.0, remains in standard support until April 30, 2028, while [Aurora PostgreSQL's calendar](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraPostgreSQLReleaseNotes/aurorapostgresql-release-calendar.html) shows the same paid dates as RDS PostgreSQL for 11 through 14. Do not apply the RDS MySQL 8.0 deadline to Aurora MySQL 3.

For provisioned RDS for MySQL, the pricing page describes Extended Support as **per vCPU per hour**. The vCPU count is the instance class's published vCPU count, not the CPU percentage you happened to use. AWS's [DB instance class tables](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.DBInstanceClass.Summary.html) are the source of record for the class. The charge applies to Multi-AZ standby instances, according to the [Extended Support charges guide](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/extended-support-charges.html), so a traditional Multi-AZ deployment has more billable vCPUs than its primary alone. Include every read replica too: the [pricing page](https://aws.amazon.com/rds/mysql/pricing/) says replicas running a version past standard support are charged as well, each with its own class and vCPU count.

AWS documents Aurora Serverless v2 capacity in ACUs, but the RDS MySQL pricing page's vCPU formula is for provisioned RDS for MySQL. Do not convert ACUs to vCPUs for an invoice forecast unless the Aurora price page for the exact engine and Region supplies that rate.

## Inventory every Region before estimating

Start with a read-only snapshot of RDS instances and clusters. `EngineLifecycleSupport` reports enrollment using `open-source-rds-extended-support` or `open-source-rds-extended-support-disabled`; it is not a substitute for checking the version.

```bash
for region in $(aws ec2 describe-regions \
  --query 'Regions[].RegionName' --output text --no-cli-pager); do
  echo "### $region: DB instances"
  aws rds describe-db-instances --region "$region" \
    --query 'DBInstances[].{Id:DBInstanceIdentifier,Engine:Engine,Version:EngineVersion,Class:DBInstanceClass,MultiAZ:MultiAZ,Source:ReadReplicaSourceDBInstanceIdentifier,Support:EngineLifecycleSupport}' \
    --output table --no-cli-pager

  echo "### $region: clusters, including Aurora"
  aws rds describe-db-clusters --region "$region" \
    --query 'DBClusters[].{Id:DBClusterIdentifier,Engine:Engine,Version:EngineVersion,Mode:EngineMode,Members:DBClusterMembers[].DBInstanceIdentifier,Support:EngineLifecycleSupport}' \
    --output table --no-cli-pager
done
```

`describe-db-clusters` covers Aurora and Multi-AZ DB clusters. For Aurora, lifecycle setting lives at the cluster level, then the `Members` list tells you which DB instances to count. The [RDS creation documentation](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/extended-support-creating-db-instance.html) confirms that members of a cluster share this setting.

Use the service's support-date response rather than copying a calendar into automation:

```bash
aws rds describe-db-major-engine-versions \
  --engine mysql \
  --major-engine-version 8.0 \
  --query 'DBMajorEngineVersions[].{Engine:Engine,Major:MajorEngineVersion,Lifecycles:SupportedEngineLifecycles}' \
  --output json --no-cli-pager
```

The [support-date API guide](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/extended-support-viewing-support-dates.html) documents `SupportedEngineLifecycles`, including its support name and start and end timestamps. Repeat it for `postgres`, `aurora-mysql`, and `aurora-postgresql` where those engines are in scope.

## Find the charge in Cost Explorer

First discover the usage-type values in _your_ bill, and do not hard-code a filter before you have seen the returned values. This query groups all RDS usage by usage type, then `jq` narrows the returned group names locally:

```bash
aws ce get-cost-and-usage \
  --time-period Start=2026-10-01,End=2026-11-01 \
  --granularity MONTHLY \
  --metrics UnblendedCost UsageQuantity \
  --filter '{"Dimensions":{"Key":"SERVICE","Values":["Amazon Relational Database Service"]}}' \
  --group-by Type=DIMENSION,Key=USAGE_TYPE \
  --output json \
| jq '.ResultsByTime[].Groups[]
      | select(.Keys[0] | test("extended|support"; "i"))'
```

Inspect the result before adding a Cost Category, budget, CUR query, or saved Cost Explorer filter. The point is to prove the actual usage type in the billing account, not to make a dashboard look complete with a guessed string. For detailed allocation, query the cost and usage data export using the service, usage-type, usage amount, and cost columns that appear in your exported schema. Data Exports schemas vary by export choice, so copy column names from the [table's own definition](https://docs.aws.amazon.com/cur/latest/userguide/dataexports-table-dictionary.html) rather than borrowing an Athena query from a different export. Pair this with [cost-allocation tags](/posts/cloud-cost-allocation-tags-aws-gcp-azure) if a team needs to own the upgrade decision.

```tabs
{
  "title": "Three ways to keep the inventory current",
  "tabs": [
    {
      "label": "CLI inventory",
      "lang": "bash",
      "code": "aws rds describe-db-instances --region us-east-1 \\\n  --query 'DBInstances[].{Id:DBInstanceIdentifier,Engine:Engine,Version:EngineVersion,Class:DBInstanceClass,Support:EngineLifecycleSupport}' \\\n  --output table --no-cli-pager"
    },
    {
      "label": "Cost Explorer",
      "lang": "bash",
      "code": "aws ce get-cost-and-usage \\\n  --time-period Start=2026-10-01,End=2026-11-01 \\\n  --granularity MONTHLY --metrics UnblendedCost \\\n  --group-by Type=DIMENSION,Key=USAGE_TYPE"
    },
    {
      "label": "Terraform",
      "lang": "hcl",
      "code": "resource \"aws_db_instance\" \"app\" {\n  identifier               = \"app-mysql\"\n  engine                   = \"mysql\"\n  engine_version           = \"8.4\"\n  instance_class           = \"db.r6g.large\"\n  username                    = \"appadmin\"\n  manage_master_user_password = true\n  engine_lifecycle_support    = \"open-source-rds-extended-support-disabled\"\n}"
    }
  ]
}
```

## Put a monthly number on MySQL 8.0

The formula is simple once the inventory is right:

```text
Extended Support per month = billable vCPUs x billed hours x rate per vCPU-hour
```

As checked November 11, 2026, AWS's [RDS for MySQL pricing page](https://aws.amazon.com/rds/mysql/pricing/) shows $0.100 per vCPU-hour for Years 1 and 2 and $0.200 for Year 3 in its US East rate table, and its FAQ example for a US East (N. Virginia) db.r5.large uses the same $0.100 Year 1 rate. AWS says the actual price depends on MySQL version, Region, and calendar year, so confirm the selected Region and engine in the current pricing view before treating this as a purchase forecast.

For a transparent planning example, assume two **single-AZ** `db.r6g.2xlarge` MySQL 8.0 instances in US East (N. Virginia), 8 vCPUs each, at 730 hours per month. That is 16 billable vCPUs. The Extended Support addition is `16 x 730 x $0.100 = $1,168` in Years 1 and 2. At the Year 3 rate it is `$2,336`. This excludes the instance's normal price, storage, I/O, backups, and transfer. Add the standby vCPUs before using this calculation for Multi-AZ.

```chart
{
  "type": "bar",
  "title": "Monthly RDS Extended Support addition for two db.r6g.2xlarge instances",
  "unit": "$",
  "caption": "16 billable vCPUs x 730 hours. Uses the US East (N. Virginia) $0.100 Year 1-2 and $0.200 Year 3 per-vCPU-hour example on AWS RDS for MySQL pricing, checked November 11, 2026. Single-AZ only, excludes normal RDS charges.",
  "rows": [
    { "label": "Years 1-2", "value": 1168, "series": "Extended Support" },
    { "label": "Year 3", "value": 2336, "series": "Extended Support" }
  ],
  "series": [
    { "name": "Extended Support", "color": "#f59e0b" }
  ]
}
```

## EKS has a smaller, separate support timer

EKS charges per cluster-hour, not per vCPU. AWS lists $0.10 per cluster-hour during standard support and $0.60 in extended support. A Kubernetes version gets 14 months of standard support and 12 months of extended support. Check each cluster's version and policy:

```bash
aws eks describe-cluster --name platform-prod --region us-east-1 \
  --query 'cluster.{version:version,support:upgradePolicy.supportType}' \
  --output table --no-cli-pager
```

The `supportType` field is `STANDARD` or `EXTENDED`. AWS's [upgrade policy guide](https://docs.aws.amazon.com/eks/latest/userguide/view-upgrade-policy.html) says `STANDARD` causes an automatic upgrade at the end of standard support, while `EXTENDED` keeps the version in extended support. Change it only after validating the next Kubernetes version:

```bash
aws eks update-cluster-config --name platform-prod --region us-east-1 \
  --upgrade-policy supportType=STANDARD \
  --no-cli-pager
```

The [EKS pricing page](https://aws.amazon.com/eks/pricing/) has the current rates. This setting avoids the extended-support choice by accepting automatic control-plane version movement, not by making an old version free.

## Decide whether to upgrade or pay knowingly

For RDS MySQL, 8.0 to 8.4 is a supported major upgrade path. Outside the lifecycle behavior described below, AWS does not automatically apply major upgrades, because they can break compatibility. Its [major-upgrade guide](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_UpgradeDBInstance.MySQL.Major.html) says RDS runs mandatory 8.0 to 8.4 prechecks before stopping the instance. Failures are logged in `PrePatchCompatibility.log`, so treat that log as an upgrade backlog, not a reason to ignore the charge.

Test three classes of problems before a production cutover:

- `mysql_native_password` is disabled by default in MySQL 8.4, so accounts and old clients that rely on it need a deliberate plan. [MySQL's documentation](https://dev.mysql.com/doc/refman/8.4/en/native-pluggable-authentication.html) describes the change and its connection failures.
- MySQL 8.4 changes defaults including `innodb_adaptive_hash_index` from `ON` to `OFF`, `innodb_change_buffering` from `all` to `none`, and `innodb_io_capacity` from 200 to 10000. Review parameter groups and performance expectations against [MySQL's changed-defaults table](https://dev.mysql.com/doc/refman/8.4/en/upgrading-from-previous-series.html).
- RDS prechecks reject obsolete types or functions, invalid trigger definers or creation context, new reserved-word collisions, overlapping `mysql` system-table names, and obsolete `sql_mode` settings.

For a production path, use an RDS Blue/Green deployment when its prerequisites fit the database. It creates a green staging copy that stays in sync with blue, permits testing before cutover, and AWS says switchover is usually under one minute, although workload conditions can make it longer. See the [RDS Blue/Green overview](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/blue-green-deployments-overview.html) and [creation guide](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/blue-green-deployments-creating.html). The method is supported for RDS MySQL 8.0 and 8.4. It is a better place to find application and parameter incompatibilities than the maintenance window.

:::warning
Disabling Extended Support on an existing instance or cluster already past standard support does not leave it on the old version without a charge. AWS states that it automatically upgrades to the next supported major version. Treat that change as an upgrade operation, with testing and an owner, not as a FinOps toggle.
:::

## Prevent the next surprise

For new CLI-created RDS DB instances and Multi-AZ DB clusters, omitting lifecycle support defaults to enabled. Add the explicit opt-out to creation automation:

```bash
aws rds create-db-instance \
  --db-instance-identifier app-mysql \
  --engine mysql \
  --engine-version 8.4 \
  --db-instance-class db.r6g.large \
  --allocated-storage 100 \
  --master-username appadmin \
  --manage-master-user-password \
  --no-publicly-accessible \
  --db-subnet-group-name app-private \
  --vpc-security-group-ids sg-0123456789abcdef0 \
  --engine-lifecycle-support open-source-rds-extended-support-disabled \
  --no-cli-pager
```

After a support boundary has passed, that setting makes a new instance creation fail rather than enroll it. Before the boundary, a disabled instance is automatically upgraded on or shortly after the end of standard support. The [RDS lifecycle documentation](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/extended-support-creating-db-instance.html) defines both behaviors.

Terraform exposes the equivalent `engine_lifecycle_support` argument on [`aws_db_instance`](https://github.com/hashicorp/terraform-provider-aws/blob/main/website/docs/r/db_instance.html.markdown) and [`aws_rds_cluster`](https://github.com/hashicorp/terraform-provider-aws/blob/main/website/docs/r/rds_cluster.html.markdown). Make it explicit in modules, then add a policy check that rejects the enabled value where the organization expects an upgrade instead. The site's [Terraform best-practices guide](/posts/terraform-best-practices) has useful patterns for keeping that module input visible in review. For enforcement outside Terraform, use a custom AWS Config rule that you have tested in your own account.

The decision record should have three fields: the affected version, the monthly Extended Support addition, and either a named upgrade date or an approved end date for paid support. That turns an automatic charge into a time-bounded engineering choice. If you need a rehearsal pattern for the release itself, the site's [blue-green deployment guide](/posts/deployment-strategies-guide) is a useful companion.
