---
title: 'Common Cloud Cost Challenges for DevOps Teams'
description: 'Where cloud money leaks: oversized instances, idle resources, missing or inconsistent tags, always-on dev, NAT and data transfer, logs, Kubernetes and AI.'
order: 2
---

**TLDR**: Most cloud waste comes from a short list: instances sized for a peak that never comes, resources nobody remembers, costs nobody can attribute, non-production environments built like production and left on all night, traffic through NAT gateways and across zones, logs kept forever, Kubernetes requests far above real use, and AI usage that grows with every request. This part shows how to spot each one, with real AWS prices and the tag problems in real billing data. Later parts fix them in code.

None of these problems come from carelessness. They come from fast delivery with no feedback: a team ships, the bill arrives a month later, aggregated, on someone else's desk. Each section below names the pattern, shows how to find it, and points to the part of the guide that fixes it.

## Prerequisites

- `focus.duckdb` from [Part 1](/guides/finops-for-devops-engineers/01-principles), for the tag queries.
- For the AWS checks: AWS CLI v2 and credentials with read-only access to the account. The commands only describe resources; none of them change anything.

## Oversized Instances

Teams pick sizes before they have data, and they pick generously: nobody gets paged for an instance that is too big. Sizes then get copied from service to service and from production to every other environment.

The price difference is large. These are on-demand Linux prices for one instance running a full month (730 hours) in US East (N. Virginia):

```chart
{
  "type": "bar",
  "title": "One instance for a month, on demand",
  "unit": "$",
  "caption": "Hourly on-demand Linux prices in us-east-1 from the AWS Price List (EC2 offer published 23 October 2026), times 730 hours. 2 vCPU for t4g and *.large, 4 vCPU for xlarge, 8 vCPU for 2xlarge.",
  "rows": [
    { "label": "t4g.small", "value": 12.26, "series": "Graviton" },
    { "label": "t4g.medium", "value": 24.53, "series": "Graviton" },
    { "label": "m8g.large", "value": 65.52, "series": "Graviton" },
    { "label": "m7i.large", "value": 73.58, "series": "Intel" },
    { "label": "m7i.xlarge", "value": 147.17, "series": "Intel" },
    { "label": "m7i.2xlarge", "value": 294.34, "series": "Intel" }
  ],
  "series": [
    { "name": "Graviton", "color": "#f59e0b" },
    { "name": "Intel", "color": "#0080ff" }
  ]
}
```

Three `m7i.2xlarge` instances cost USD 883.01 a month. If the service runs fine on `m7i.large`, three of those cost USD 220.75, and the difference is USD 662.26 a month, or about USD 7,947 a year, for one service in one environment. Moving to Graviton (`m8g.large`, USD 65.52 a month each) saves another 11 percent, if your software runs on arm64.

**How to find it:**

- Look at CPU and memory over two to four weeks, at the 95th percentile or the maximum, not the average. A service that idles at night and peaks at noon has a low average and still needs its peak capacity.
- EC2 does not report memory by default. Install the CloudWatch agent, or use your existing metrics stack, before you decide memory is unused.
- Opt in to [AWS Compute Optimizer](https://docs.aws.amazon.com/compute-optimizer/latest/ug/what-is-compute-optimizer.html) (Azure Advisor and Google Cloud's Recommender do the same job). It analyzes the last 14 days of CloudWatch metrics at no charge; the paid enhanced infrastructure metrics option extends that to 93 days. It lists over-provisioned instances:

```bash
aws compute-optimizer get-ec2-instance-recommendations \
  --filters name=Finding,values=Overprovisioned \
  --query 'instanceRecommendations[].[instanceArn,currentInstanceType,recommendationOptions[0].instanceType]' \
  --output text
```

Right-size in non-production first, watch latency and error rates for a week, then change production. [Part 4](/guides/finops-for-devops-engineers/04-practical-examples) puts the size of each environment in one Terraform map, so a right-sizing change is a reviewed one-line diff.

## Idle and Forgotten Resources

Many resources keep billing when nothing uses them. They survive because nobody is sure what they belong to, and deleting the wrong thing feels worse than paying for it.

| Resource                    | Why it lingers                                                              | Price in us-east-1                        | Per month (730 hours)        |
| --------------------------- | --------------------------------------------------------------------------- | ----------------------------------------- | ---------------------------- |
| Unattached EBS volume (gp3) | Instance terminated with `delete_on_termination = false`                    | USD 0.08 per GB-month                     | USD 8 for 100 GB             |
| EBS snapshot                | Backups with no expiry, AMIs nobody deregistered                            | USD 0.05 per GB-month                     | USD 5 for 100 GB             |
| Public IPv4 address         | Elastic IP kept "just in case"; every public IPv4 is billed, in use or idle | USD 0.005 per hour                        | USD 3.65 per address         |
| NAT gateway                 | Created with a VPC template for a test environment                          | USD 0.045 per hour, plus USD 0.045 per GB | USD 32.85 before any traffic |
| Stopped EC2 instance        | Stopped instead of terminated; its volumes keep billing                     | Volume prices above                       | Depends on the volumes       |
| Feature environment         | Branch merged, `terraform destroy` never ran                                | Everything it contains                    | Often the largest item       |

_Prices from the AWS Price List: EC2 offer published 23 October 2026, VPC offer published 16 October 2026._

The last row is the expensive one. A per-branch Terraform workspace keeps all of its resources until someone destroys them, and deleting the branch in Git does nothing to the cloud. Tear the environment down before you delete the workspace:

```bash
terraform workspace select feature-payment-flow
terraform destroy -var-file=env/dev.tfvars
terraform workspace select default
terraform workspace delete feature-payment-flow
```

Terraform refuses to delete a workspace that still tracks resources unless you add `-force`, and `-force` leaves the resources running with nothing tracking them. Do not use it to make the error go away.

**How to find candidates:** each of these commands lists one kind of resource in the current Region. The first two print only leftovers (and nothing when there are none). The snapshot and NAT gateway lists include resources in use, so check each one before you delete it: a snapshot may be a backup someone must keep, and a NAT gateway is idle only if its `BytesOutToDestination` metric in CloudWatch stays near zero.

```bash
# EBS volumes that are not attached to an instance
aws ec2 describe-volumes --filters Name=status,Values=available \
  --query 'Volumes[].[VolumeId,Size,CreateTime]' --output text

# Elastic IP addresses that are not associated with anything
aws ec2 describe-addresses --query 'Addresses[?AssociationId==null].[PublicIp,AllocationId]' --output text

# Your snapshots, oldest first
aws ec2 describe-snapshots --owner-ids self \
  --query 'sort_by(Snapshots,&StartTime)[].[SnapshotId,VolumeSize,StartTime]' --output text

# NAT gateways, with their VPC
aws ec2 describe-nat-gateways --filter Name=state,Values=available \
  --query 'NatGateways[].[NatGatewayId,VpcId,CreateTime]' --output text
```

Run them in every Region you use. [Part 3](/guides/finops-for-devops-engineers/03-tools) turns these checks into Cloud Custodian policies that run on a schedule, and [Part 5](/guides/finops-for-devops-engineers/05-cicd-integration) destroys preview environments when their pull request closes.

## Costs Nobody Can Attribute

If a cost has no owner, nobody acts on it. Attribution fails in three ways: resources without tags, tags that disagree, and costs that cannot be tagged at all.

The second one is the hardest to see. The FOCUS sample from Part 1 shows it well, because it is anonymized real-world data from several providers. This query lists every tag key that means "environment" and the usage cost behind each value:

```sql
-- Every tag key that means "environment", with its values and the usage
-- cost behind each. The quotes make stray spaces in a key visible.
SELECT ProviderName AS provider,
       '"' || tag_key || '"' AS tag_key,
       json_extract_string(Tags, '$."' || tag_key || '"') AS tag_value,
       round(sum(BilledCost), 2) AS usage_usd
FROM (
  SELECT ProviderName, Tags, BilledCost, unnest(json_keys(Tags)) AS tag_key
  FROM focus
  WHERE lower(ChargeCategory) = 'usage'
)
WHERE lower(trim(tag_key)) IN ('env', 'environment')
GROUP BY ALL
ORDER BY provider, tag_key, tag_value;
```

```bash
duckdb focus.duckdb -f focus/tag-keys.sql
```

```text
┌───────────┬───────────────┬─────────────┬───────────┐
│ provider  │    tag_key    │  tag_value  │ usage_usd │
│  varchar  │    varchar    │   varchar   │  double   │
├───────────┼───────────────┼─────────────┼───────────┤
│ AWS       │ "environment" │ dev         │   1640.54 │
│ AWS       │ "environment" │ prod        │    240.38 │
│ Microsoft │ "ENV"         │ StorSimple  │       0.2 │
│ Microsoft │ "Environment" │             │       0.0 │
│ Microsoft │ "Environment" │ Dev         │      2.38 │
│ Microsoft │ "Environment" │ DevTest     │       0.0 │
│ Microsoft │ "Environment" │ Development │       0.0 │
│ Microsoft │ "env"         │ Dev         │      -0.5 │
│ Microsoft │ "env"         │ Production  │       0.0 │
│ Microsoft │ "env"         │ dev         │      14.4 │
│ Microsoft │ "env"         │ prod        │    220.68 │
│ Microsoft │ "env"         │ trey        │      5.74 │
│ Oracle    │ "environment" │ dev         │     11.19 │
│ Oracle    │ "environment" │ prod        │      8.23 │
└───────────┴───────────────┴─────────────┴───────────┘
  14 rows                                   4 columns
```

In the AWS and Oracle data, every environment tag uses the key `environment` and the values `dev` and `prod`. The Azure data has three keys for the same idea (`env`, `ENV` and `Environment`) and values such as `Dev`, `dev`, `Production`, `DevTest`, and two that are not environments at all: `trey` and `StorSimple`. A report that groups by `environment` sees none of the Azure spend. Elsewhere in the same data, `"org"` and `" org"` (with a leading space) are two different keys.

You can repair some of this at query time. This view accepts the spellings found in the data and maps the values onto a fixed list (`DevTest` and the non-environment values stay unmapped):

```sql
-- Usage charges with one environment column for every provider. The
-- category is compared in lower case (Google Cloud writes "usage"), the
-- key spellings found in the data are accepted, and the values are
-- mapped onto a fixed list.
CREATE OR REPLACE VIEW usage AS
SELECT *,
       CASE lower(trim(coalesce(
              json_extract_string(Tags, '$.environment'),
              json_extract_string(Tags, '$.Environment'),
              json_extract_string(Tags, '$.env'),
              json_extract_string(Tags, '$.ENV'))))
         WHEN 'prod' THEN 'prod'
         WHEN 'production' THEN 'prod'
         WHEN 'dev' THEN 'dev'
         WHEN 'development' THEN 'dev'
       END AS env
FROM focus
WHERE lower(ChargeCategory) = 'usage';
```

```bash
duckdb focus.duckdb -f focus/usage-view.sql
```

Now compare the share of usage cost that has a usable environment, first with the schema's key alone, then with the cleaned-up column:

```sql
-- Share of usage cost with a usable environment tag: first with the one
-- key the schema asks for, then with the env column from usage-view.sql.
SELECT ProviderName AS provider,
       round(sum(BilledCost), 2) AS usage_usd,
       round(100 * coalesce(sum(BilledCost) FILTER (
         WHERE json_extract_string(Tags, '$.environment') IS NOT NULL), 0) / sum(BilledCost), 1) AS schema_key_pct,
       round(100 * coalesce(sum(BilledCost) FILTER (WHERE env IS NOT NULL), 0) / sum(BilledCost), 1) AS cleaned_pct
FROM usage
GROUP BY ALL
ORDER BY usage_usd DESC;
```

```bash
duckdb focus.duckdb -f focus/tag-coverage.sql
```

```text
┌──────────────┬───────────┬────────────────┬─────────────┐
│   provider   │ usage_usd │ schema_key_pct │ cleaned_pct │
│   varchar    │  double   │     double     │   double    │
├──────────────┼───────────┼────────────────┼─────────────┤
│ AWS          │   2027.75 │           92.8 │        92.8 │
│ Microsoft    │    567.21 │            0.0 │        41.8 │
│ Oracle       │     19.42 │          100.0 │       100.0 │
│ Google Cloud │      0.02 │            0.0 │         0.0 │
└──────────────┴───────────┴────────────────┴─────────────┘
```

With the agreed key alone, none of the Azure usage can be split by environment. After the cleanup, 41.8 percent can, and the rest has no usable environment tag at all. AWS stays at 92.8 percent: its tags are consistent, but 7.2 percent of its usage cost has no environment tag (in this sample, those lines carry no tags at all). The two Google Cloud lines, USD 0.02, have none either.

Query-time cleanup is a stopgap, and every report has to repeat it. The fix is to make bad tags impossible to create:

- Agree on one schema with lowercase keys and a fixed list of values. The [cost allocation tags post](/posts/cloud-cost-allocation-tags-aws-gcp-azure) has a schema that works across AWS, Google Cloud and Azure; this guide uses it.
- Use separate accounts, projects or subscriptions per environment. An account boundary attributes every cost in it, including costs that cannot be tagged.
- Enforce the schema when resources are created. [Part 4](/guides/finops-for-devops-engineers/04-practical-examples) does it in Terraform and with AWS tag policies, and Part 5 checks it in CI.
- Decide how to split costs that cannot be tagged, such as support plans, shared networking and some data transfer. [Part 6](/guides/finops-for-devops-engineers/06-cultural-shift) shares them out by a rule.

## Non-Production Built Like Production

Development and staging often copy production's configuration, because it is the easiest way to make them work. They then cost almost as much as production while serving a handful of engineers.

The database is a common case. In us-east-1, a PostgreSQL `db.m8g.large` costs USD 0.168 an hour as a single instance and USD 0.336 an hour as Multi-AZ, because Multi-AZ runs a standby. A development database built like production costs USD 245.28 a month; a single-AZ `db.t4g.micro` (USD 0.016 an hour) costs USD 11.68.

Then there are the hours. A development environment that runs from 08:00 to 19:00 on weekdays runs 55 of the 168 hours in a week, which removes 67 percent of its compute hours. Storage, snapshots and any NAT gateway keep billing while it is off, so the saving on the total is smaller.

_RDS prices from the AWS Price List, RDS offer published 26 October 2026._

Part 4 gives every environment its own sizes in one map, and schedules the `dev` Auto Scaling group to office hours.

## Data Transfer and NAT Gateways

Networking charges rarely show up in a design review because they depend on traffic, not on what you create. In us-east-1:

- A **NAT gateway** costs USD 0.045 an hour and USD 0.045 for every GB it processes. Two TB a month of S3 downloads through a NAT gateway is USD 92.16 in processing charges alone.
- A **gateway endpoint** for S3 or DynamoDB has no hourly or per-GB charge and takes that traffic off the NAT gateway. Add one to every VPC that talks to S3.
- **Traffic between Availability Zones** costs USD 0.01 per GB in each direction. Chatty services spread across zones, and replication between them, pay it on every byte.
- **Interface endpoints** for other AWS services cost USD 0.01 an hour per endpoint per zone plus USD 0.01 per GB. If you keep the NAT gateway anyway, each GB moved to the endpoint saves USD 0.035, so an endpoint in one zone (USD 7.30 a month) pays for itself above about 209 GB a month of that service's traffic.

To see where the money goes, group Cost Explorer by **Usage type** and look for `NatGateway-Bytes`, `DataTransfer-Regional-Bytes` and `DataTransfer-Out-Bytes`. VPC Flow Logs tell you which workloads send the bytes.

## Logs and Metrics

Observability data grows with traffic and with every debug statement. CloudWatch Logs charges USD 0.50 per GB ingested in the Standard log class and USD 0.03 per GB-month stored, and a new log group keeps data forever unless you set a retention period. As a worked example, a service that writes 10 GB of logs a day ingests about 300 GB a month: USD 150 a month before storage.

Custom metrics are priced per metric (USD 0.30 per metric-month for the first 10,000), and every unique combination of dimensions is a separate metric. Putting a user ID or a request ID in a dimension creates thousands of them.

Set a retention period on every log group, keep debug logging off in production, sample high-volume logs, and keep high-cardinality values in logs or traces rather than in metric dimensions.

_CloudWatch prices from the AWS Price List, CloudWatch offer published 7 October 2026._

## Kubernetes: You Pay for Requests

A cloud provider bills Kubernetes nodes, not pods. The scheduler places pods by their resource **requests**, and the cluster autoscaler adds nodes when pending pods' requests do not fit. A pod that requests 2 CPUs and uses 0.1 keeps 1.9 CPUs of a node you pay for empty.

The cloud bill shows only the nodes, so you need a tool that splits node cost by namespace and workload and compares requests with usage. Part 3 runs OpenCost on a local cluster with one over-requested workload and one under-requested one. For fixing requests, see [Right-Sizing Kubernetes Resources with VPA and Karpenter](/posts/right-sizing-kubernetes-resources-vpa-karpenter).

## AI and GPU Spend

AI features add two new kinds of cost. Model APIs charge per token, so spend grows with traffic, prompt length and retries: a longer system prompt or a retry loop multiplies the bill without any infrastructure change. GPU instances are among the most expensive instances you can run, and a GPU that waits between batch jobs bills at full price.

Treat both like any other usage: attribute token spend to features (separate API keys or projects per feature make this possible), put budgets and anomaly alerts on them, cache repeated prompts, and route simple tasks to smaller models. [Knowing What Your AI Feature Costs Before Finance Does](/posts/ai-feature-cost-before-finance-does) covers the measurement side.

## Summary

- Size from the 95th percentile of real CPU and memory data, not from fear; right-size non-production first.
- Volumes, snapshots, public IPv4 addresses, NAT gateways and forgotten environments bill whether or not anything uses them.
- Inconsistent tags hide spend as well as missing ones do: in the FOCUS sample, no Azure usage matched the agreed key.
- Give non-production its own sizes and schedule it; office hours remove two thirds of the compute hours.
- Networking, logs, Kubernetes requests and AI tokens all grow with traffic, so watch them continuously, not only in design reviews.

Next, [Part 3](/guides/finops-for-devops-engineers/03-tools) covers the tools that find these problems for you.

## Keep Learning

- [How to Set Up Cloud Cost Allocation Tags Across AWS, GCP, and Azure](/posts/cloud-cost-allocation-tags-aws-gcp-azure)
- [Why Your Kafka Bill Is Mostly Network](/posts/why-your-kafka-bill-is-mostly-network)
- [Your Logs Cost More Than the Service That Emits Them](/posts/your-logs-cost-more-than-the-service)
- [Cloud Cost Allocation Tags Quiz](/quizzes/cloud-cost-allocation-tags-quiz)
- [Interview questions: Essential Tags for Multi-Cloud Cost Allocation](/interview-questions/mid/essential-cloud-cost-tags)
