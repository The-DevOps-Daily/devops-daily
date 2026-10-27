---
title: 'Building a Cost-Conscious Engineering Culture'
description: 'Make teams own their cloud costs: showback before chargeback, a fair split of shared costs, unit costs, weekly reviews, and cost in design and code review.'
order: 6
---

**TLDR**: Engineers act on costs they can see, attribute and change. Give every team a weekly view of its own spend (showback) before you move money between budgets (chargeback), and agree on one rule for shared and untagged costs. Track a unit cost, such as cost per order, so growth and waste can be told apart. Hold a 15-minute cost review each week, treat anomalies like small incidents, and add a cost section to design reviews and pull request templates. Celebrate fixes; do not rank teams by spend.

The tools from the earlier parts produce numbers. Whether anyone acts on them depends on who owns them, how often they see them and what happens when they do. That is the culture part of FinOps, and DevOps teams already know the pattern from reliability: clear ownership, fast feedback and blameless review.

## Prerequisites

- `focus.duckdb` with the `usage` view from [Part 2](/guides/finops-for-devops-engineers/02-challenges).

## Ownership First

Before any dashboard, make sure every cost has an owner:

- **Every resource has an `owner` and a `team` tag**, enforced as in [Part 4](/guides/finops-for-devops-engineers/04-practical-examples). Without an owner, nobody can be asked, and nobody dares to delete.
- **The team that creates a resource owns its cost**, in the same way it owns its alerts. Separate accounts or projects per team and environment make this visible without any tagging.
- **Cost is a requirement**, written down next to latency and availability: "checkout must stay under X per order" is something a team can design for; "keep costs down" is not.

## Showback and Chargeback

Two ways to report costs to teams:

|              | Showback                               | Chargeback                                                             |
| ------------ | -------------------------------------- | ---------------------------------------------------------------------- |
| What happens | Teams see their costs; no money moves  | Costs are charged to the team's budget or cost center                  |
| Needs        | Reasonable allocation, regular reports | Allocation that finance and teams trust, agreed rules for shared costs |
| Risk         | Easy to ignore if nobody reviews it    | Arguments about allocation instead of improvements                     |
| When to use  | Always, from the start                 | When most spend is allocated and the rules are settled                 |

Start with showback. Move to chargeback only when the allocation is good enough that a team would accept the number on its budget.

### Sharing Costs That Belong to Nobody

Some spend cannot be tagged to one team: support plans, shared clusters and networking, and anything that was never tagged. The common ways to split it:

- **Proportional**: each team gets a share in proportion to its own direct cost. Simple, and it keeps the report adding up to the bill.
- **Even split**: the same amount for each team. Fair for small fixed costs, unfair for large ones.
- **Fixed ratios**: an agreed percentage per team, reviewed each quarter.
- **By a usage metric**: requests, GB stored or CPU hours from OpenCost. The most accurate, and the most work to maintain.

This query from the companion repository builds a showback by environment from the FOCUS sample, and shares out the usage without a usable environment tag in proportion to each environment's direct cost:

```sql
-- Showback by environment. Usage without a usable environment tag is
-- shared out in proportion to each environment's tagged cost, so the
-- report still adds up to the total usage cost.
WITH direct AS (
  SELECT coalesce(env, 'untagged') AS environment,
         sum(BilledCost) AS cost
  FROM usage
  GROUP BY ALL
),
untagged AS (
  SELECT coalesce(sum(cost), 0) AS cost FROM direct WHERE environment = 'untagged'
)
SELECT d.environment,
       round(d.cost, 2) AS direct_usd,
       round(u.cost * d.cost / sum(d.cost) OVER (), 2) AS shared_usd,
       round(d.cost + u.cost * d.cost / sum(d.cost) OVER (), 2) AS showback_usd
FROM direct d, untagged u
WHERE d.environment <> 'untagged'
ORDER BY showback_usd DESC;
```

```bash
duckdb focus.duckdb -f focus/showback.sql
```

```text
┌─────────────┬────────────┬────────────┬──────────────┐
│ environment │ direct_usd │ shared_usd │ showback_usd │
│   varchar   │   double   │   double   │    double    │
├─────────────┼────────────┼────────────┼──────────────┤
│ dev         │    1668.02 │     372.33 │      2040.35 │
│ prod        │     469.29 │     104.75 │       574.04 │
└─────────────┴────────────┴────────────┴──────────────┘
```

The direct costs add up to USD 2,137.31 and the shared costs to USD 477.08, the usage that Part 2 found without a usable environment tag. Together they match the sample's total usage cost (USD 2,614.40 across the four providers in Part 2, give or take a cent of rounding), so nothing disappears from the report. (The tags in the sample are anonymized, so the split shows how the query works, not how a real company spends.)

Proportional sharing has a side effect worth using: teams that tag well pay part of the untagged spend. Show the shared amount as its own column, as above, so everyone sees how much untagged spend costs them, and the pressure to fix the tags goes where it belongs. Some teams prefer to report untagged spend as a separate line owned by the platform team until it is fixed; either works if the rule is written down.

## Unit Costs

A total that goes up is not good or bad on its own: it may be growth or it may be waste. A **unit cost**, the cost of one unit of what the business sells or serves, tells them apart:

```text
unit cost = cost of the service in a period / units delivered in the same period
```

Pick a unit that the team's work changes and that product people care about: orders for `checkout`, API requests for a platform API, GB processed for a data pipeline, active customers for a SaaS product. The cost side comes from the billing data, filtered by the service tag; the units come from your application metrics or database.

With the FOCUS export loaded and a table of monthly order counts from your application, the calculation is one join:

```sql
WITH monthly AS (
  SELECT date_trunc('month', ChargePeriodStart) AS month,
         sum(EffectiveCost) AS cost
  FROM focus
  WHERE lower(ChargeCategory) = 'usage'
    AND json_extract_string(Tags, '$.service') = 'checkout'
  GROUP BY ALL
)
SELECT m.month,
       round(m.cost, 2) AS cost_usd,
       o.orders,
       round(m.cost / o.orders, 4) AS cost_per_order_usd
FROM monthly m
JOIN orders o USING (month)
ORDER BY m.month;
```

Watch the trend, not one value. If cost per order falls while total cost rises, the service is growing efficiently. If both rise, something got less efficient, and the team should find out what. Shared costs need the same rule here as in showback, or unit costs drift when the allocation changes.

## Habits That Keep Costs Owned

**A weekly cost review per team, 15 minutes.** Put it in an existing meeting, not a new one. A fixed agenda keeps it short:

1. The five largest changes in the team's costs since last week, and their cause.
2. Budget and anomaly alerts since the last review, and what was done about them.
3. Untagged or unowned spend in the team's accounts.
4. One improvement to do before the next review, with an owner.

**A monthly review with finance and product.** Forecast against actual, planned launches and migrations that change the forecast, unit cost trends, and the usage baseline for any commitment purchase.

**Anomalies as small incidents.** When an anomaly alert fires, the owner finds the cause the same day, fixes it or explains it, and writes two lines in the team channel. Blameless, like any incident review: the question is what made the mistake easy, and how to make it harder.

## Cost in Design and Code Review

Design reviews already ask about failure modes and scaling. Add a short cost section to the template:

```markdown
## Cost

- Estimated monthly cost per environment, with the assumptions (traffic, data size, retention)
- The main cost drivers, and how each one scales with traffic
- Cheaper alternatives considered, and why this design wins on value
- How the cost will be tracked: tags, budget, anomaly monitor, unit cost
- How it is turned off: cleanup for temporary resources, retention for data
```

For pull requests that change infrastructure, a few checklist items in the pull request template keep cost in the conversation without slowing reviews:

```markdown
## Cost checklist (infrastructure changes)

- [ ] New resources carry the cost tags (the CI policy checks most of them)
- [ ] Sizes come from the environment map, not hard-coded values
- [ ] Non-production resources can be scheduled or scaled to zero
- [ ] Temporary resources have a cleanup path
- [ ] The Infracost comment matches what I expected, or I explained why not
```

## Incentives That Work, and Ones That Backfire

What works:

- **Make fixes visible.** Post the before and after numbers of a cost fix in the team channel or changelog, like a performance improvement.
- **Let teams keep part of what they save**, for example as budget for a project they want, so saving is not only a sacrifice.
- **Give engineers direct access** to their cost data, in the tools they already use.
- **Put cost in the definition of done** for infrastructure work: tagged, budgeted, with a cleanup path.

What backfires:

- **Leaderboards that rank teams by spend or savings.** They punish teams that are growing and reward cuts that hurt reliability, and they invite gaming the allocation.
- **Blame for anomalies.** People stop reporting their own mistakes, and the anomalies get bigger.
- **Cost targets without value.** "Cut 20 percent" without context leads to cuts in the wrong places; tie targets to unit costs.

## Working With Finance

Finance needs predictability more than a low bill. Help them by telling them early about launches, migrations and experiments that will change spend; by explaining variances in plain words ("the new search index doubled storage, as planned"); and by giving a usage forecast before commitments are bought, so a Savings Plan matches what the services will really use. Use the same data on both sides: the FOCUS export and the cost columns from [Part 1](/guides/finops-for-devops-engineers/01-principles), so nobody argues about whose number is right.

## Common Mistakes

- **Dashboards without owners.** A report that nobody reviews changes nothing.
- **Chargeback too early.** Charging teams on poor allocation starts arguments about tags instead of improvements.
- **No rule for shared costs.** Every month becomes a negotiation; write the rule down once.
- **Only total cost.** Without a unit cost, growth looks like waste and waste hides inside growth.
- **Rankings and blame.** They teach teams to hide costs, not to reduce them.

## Summary

- Ownership comes first: every resource has an owner, every team sees its own costs.
- Start with showback; move to chargeback when allocation is trusted.
- Share untagged and shared costs by one written rule, and show the shared part separately.
- Unit costs separate growth from waste.
- Short weekly reviews, anomaly follow-ups and a cost section in design and code reviews make cost part of normal engineering work.

Next, [Part 7](/guides/finops-for-devops-engineers/07-conclusion) covers the metrics to track and a 90-day plan to put the guide into practice.

## Keep Learning

- [Your Cloud Bill Is an Organizational Problem, Not a Technical One](/posts/cloud-bill-organizational-problem)
- [Why Most FinOps Initiatives Fail (and What Actually Works)](/posts/why-finops-initiatives-fail)
- [Interview questions: Chargeback Design for Shared and Untaggable Costs](/interview-questions/senior/chargeback-shared-untaggable-costs)
- [Interview questions: FinOps and Cloud Cost Management](/interview-questions/senior/finops-cost-management)
