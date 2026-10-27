---
title: 'FinOps Metrics and a 90-Day Plan for DevOps Teams'
description: 'Track FinOps next to DORA with a few clear metrics, read the pricing mix in your bill, plan for AI and sustainability, and roll out this guide in 90 days.'
order: 7
---

**TLDR**: Measure a handful of things: how much spend is allocated to an owner, a unit cost per service, commitment coverage and utilization, the effective savings rate, idle spend, and how fast anomalies get a cause. Keep them next to the DORA metrics, so cost work never quietly costs reliability or speed. Treat AI spend and emissions with the same tools as the rest. Then roll the guide out in three 30-day steps: Inform, Optimize, Operate.

DevOps teams already measure delivery with deployment frequency, lead time for changes, change failure rate and time to restore service. FinOps adds a few numbers that show whether cloud spend is owned and efficient. The goal is better value per dollar without making the delivery numbers worse.

## Prerequisites

- `focus.duckdb` from [Part 1](/guides/finops-for-devops-engineers/01-principles).

## Metrics Worth Tracking

| Metric                     | Definition                                                                               | Where it comes from                                                                                                |
| -------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Allocated spend**        | Share of cost with a usable owner (team and service, or a team account)                  | Billing export and tags ([Part 2](/guides/finops-for-devops-engineers/02-challenges))                              |
| **Unit cost**              | Cost of a service per unit it delivers, such as cost per order                           | Billing export and application metrics ([Part 6](/guides/finops-for-devops-engineers/06-cultural-shift))           |
| **Commitment coverage**    | Share of eligible usage (for example, compute) covered by Savings Plans or reservations  | Cost Explorer coverage reports, or `PricingCategory` in FOCUS                                                      |
| **Commitment utilization** | Share of the commitments you pay for that your usage actually used                       | Cost Explorer utilization reports                                                                                  |
| **Effective savings rate** | (on-demand equivalent cost minus what you paid) divided by the on-demand equivalent cost | Billing export: `ListCost` against `EffectiveCost`                                                                 |
| **Idle spend**             | Cost of resources flagged as idle or unattached                                          | Compute Optimizer, Cost Optimization Hub, Cloud Custodian ([Part 3](/guides/finops-for-devops-engineers/03-tools)) |
| **Anomaly time to cause**  | Time from an anomaly alert to a known cause                                              | Your alert channel or incident tool                                                                                |
| **Forecast accuracy**      | How far each month's actual spend was from its forecast, as a percentage                 | Budgets and the billing export                                                                                     |

Coverage and utilization pull in opposite directions: buying more commitments raises coverage and risks lower utilization if usage falls. Watch both, and buy commitments only for the usage that is left after the cleanup work in the earlier parts.

The FOCUS sample shows how the rate side looks in data. This query splits AWS compute usage by how it was priced:

```sql
-- How AWS compute usage was priced: on-demand (Standard), covered by a
-- commitment (Committed) or Spot (Dynamic). ListCost is the public price.
SELECT PricingCategory AS pricing,
       round(sum(ListCost), 2) AS list_usd,
       round(sum(BilledCost), 2) AS billed_usd,
       round(100 * sum(ListCost) / sum(sum(ListCost)) OVER (), 1) AS share_pct
FROM focus
WHERE ProviderName = 'AWS'
  AND lower(ChargeCategory) = 'usage'
  AND ServiceCategory = 'Compute'
GROUP BY ALL
ORDER BY list_usd DESC;
```

```bash
duckdb focus.duckdb -f focus/pricing-mix.sql
```

```text
┌───────────┬──────────┬────────────┬───────────┐
│  pricing  │ list_usd │ billed_usd │ share_pct │
│  varchar  │  double  │   double   │  double   │
├───────────┼──────────┼────────────┼───────────┤
│ Standard  │  1665.49 │    1665.49 │      97.7 │
│ Committed │    36.96 │        0.0 │       2.2 │
│ Dynamic   │     2.78 │       1.13 │       0.2 │
└───────────┴──────────┴────────────┴───────────┘
```

- **Standard** (on demand) is 97.7 percent of the compute usage at list price, so commitment coverage in this sample is low.
- **Committed** usage, covered by the Compute Savings Plans from Part 1, has a `BilledCost` of zero: the plans' hourly fees appear on their own `Purchase` lines. That is why coverage and team reports need `EffectiveCost` or list-price comparisons, not `BilledCost`.
- **Dynamic** is Spot: USD 2.78 at list price was billed at USD 1.13, 59 percent less.

The sample is a random selection of rows, so read these numbers as an example of the method, not as a benchmark.

## AI Costs

AI is one of the technology categories in the 2026 FinOps Framework, and it behaves differently from servers: spend follows tokens, prompt length and retries more than provisioned capacity, and it can grow tenfold with a feature launch without a single infrastructure change. [Part 2](/guides/finops-for-devops-engineers/02-challenges) covers the practices: attribute token spend to features, put budgets and anomaly alerts on model APIs and GPUs, cache prompts and route simple tasks to smaller models. Two additions for measuring it:

- **A unit cost per AI feature**, such as cost per conversation or per document processed, built the same way as the unit costs in Part 6. It shows whether a prompt change or a model switch made the feature cheaper to run.
- **Cost per token for self-hosted models.** On Kubernetes, OpenCost now reports cost per million tokens for vLLM-based deployments, next to its namespace allocation.

## Sustainability

Sustainability is a FinOps capability too, and the two goals mostly agree: idle resources, oversized instances and data kept forever cost money and emit carbon. Each large provider reports estimated emissions for your usage: the AWS Customer Carbon Footprint Tool, carbon optimization in Azure (generally available since May 2025) and Google Cloud Carbon Footprint. Use them to compare Regions and to show the second benefit of a cleanup, not as a separate project.

## A 90-Day Plan

The guide in three steps, one for each FinOps phase. Each step builds on the one before.

**Days 1 to 30: Inform**

- Separate accounts or projects per environment, at least for production.
- Agree on the tag schema, add it to Terraform with validation and `default_tags`, and activate the tags for cost allocation ([Part 4](/guides/finops-for-devops-engineers/04-practical-examples)).
- A budget with forecast and actual alerts for every account and service, sent to the owning team.
- Anomaly detection on, with monitors per team or service.
- The FOCUS export enabled, and a first showback report by team ([Part 6](/guides/finops-for-devops-engineers/06-cultural-shift)).
- Remove the obvious waste from [Part 2](/guides/finops-for-devops-engineers/02-challenges): unattached volumes, unused addresses, forgotten environments.

**Days 31 to 60: Optimize**

- Right-size the ten most expensive resources, non-production first, using Compute Optimizer or your own metrics.
- Schedule non-production to office hours, and give each environment its own sizes.
- Move gp2 volumes to gp3, set retention on every log group, and add S3 gateway endpoints.
- Add the Conftest policy and the Infracost estimate to pull requests ([Part 5](/guides/finops-for-devops-engineers/05-cicd-integration)).
- Run OpenCost or Kubecost on shared clusters and fix the largest gaps between requests and usage.

**Days 61 to 90: Operate**

- A weekly 15-minute cost review in each team, with one improvement per week.
- A unit cost for each major service, reviewed monthly with product and finance.
- Cloud Custodian policies on a schedule, report-only first, then with actions.
- A short runbook for anomaly alerts, and a written rule for shared costs.
- The first commitment purchase, sized on the cleaned-up baseline, with coverage and utilization tracked from then on.

At the end, review the metrics above and decide what to improve next. FinOps does not finish; the loop from Part 1 starts again with every new service.

## Summary of the Guide

- **Part 1**: FinOps is a shared loop of Inform, Optimize and Operate. Know your cost columns, and read billing data in FOCUS format.
- **Part 2**: waste comes from oversized and idle resources, inconsistent tags, always-on non-production, networking, logs, Kubernetes requests and AI usage.
- **Part 3**: start with native tools and the FOCUS export; add Infracost, OpenCost and Cloud Custodian where they answer a question you have.
- **Part 4**: tags, sizes, schedules, budgets and anomaly alerts belong in the same Terraform as the resources.
- **Part 5**: pull requests show estimates and enforce a few clear rules; preview environments are destroyed on close.
- **Part 6**: ownership, showback, unit costs and short reviews make teams act on the numbers.

All of the code from the guide, and the workflow that produced its output, is in the companion repository:

```github
https://github.com/The-DevOps-Daily/guide-finops-demo-2026-10-27
```

## Keep Learning

- [Knowing What Your AI Feature Costs Before Finance Does](/posts/ai-feature-cost-before-finance-does)
- [Free Egress Has Fine Print: S3 vs R2, B2, Wasabi and More](/posts/object-storage-free-egress-fine-print)
- [How We Reduced Our AWS Bill by 73% While Actually Improving Performance](/posts/aws-cost-optimization)
- [Cloud Cost Optimization Quiz](/quizzes/cloud-cost-optimization-quiz)
- [Interview questions: Cloud Cost Optimization](/interview-questions/senior/cloud-cost-optimization)
