---
title: 'Neon vs Supabase Pricing: What the Same App Costs From Launch to Scale'
excerpt: 'We priced one application through five growth stages on both platforms using verified June 2026 list prices. The result is three distinct cost regimes, two crossover points, and a surprise: at scale the biggest line item is not the database.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-06-11'
publishedAt: '2026-06-11T18:00:00Z'
updatedAt: '2026-06-11T18:00:00Z'
readingTime: '10 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - postgres
  - neon
  - supabase
  - databases
  - pricing
  - finops
---

Pricing pages answer the question "what does a unit cost". They are conspicuously silent on the question you actually have: "what will my application cost in a year, when it has real users?" The honest answer depends on workload shape, and workload shape changes as you grow, which is why the same two platforms can each be the cheap option at different points in the same product's life.

This is part three of our Neon vs Supabase series ([free tiers](https://devops-daily.com/posts/neon-vs-supabase-free-tier-benchmarks), [operational benchmarks](https://devops-daily.com/posts/neon-vs-supabase-operational-benchmarks)). Instead of benchmarking operations, we built a cost model: one application, five growth stages, priced on Neon Launch and Supabase Pro using list prices we verified against both pricing pages this week. The model is [open source in the same repo](https://github.com/The-DevOps-Daily/serverless-postgres-benchmarks) as the benchmarks (`npm run costs`), every price carries its source, and you can change the workload assumptions and rerun it for your own product.

## TLDR

- There are **three cost regimes, not one winner**: Neon wins early (scale-to-zero means a quiet app costs almost nothing), Supabase wins the middle (a flat fee beats usage billing once the database runs hot but small), and Neon wins at scale by a wide margin.
- The two **crossover points** sit roughly where your app stops sleeping (Supabase becomes competitive) and where your user count passes Supabase's included 100k monthly active users (Supabase stops being competitive, fast).
- The scale-stage surprise: on Supabase, **the database is not the bill**. Metered auth MAU is. Our scale stage prices at $1,213/month on Supabase Pro, of which $975 is MAU overage; the same stage on Neon Launch is $278, because Neon Auth carries no per-MAU meter up to 1M users.
- This comparison assumes you use each platform's bundled auth. If you bring your own auth provider, the picture changes substantially in Supabase's favor, and we show you where.

## The application and its growth

The model prices one hypothetical B2B SaaS through five stages, with the workload dimensions both platforms bill on: average compute demand, how much of the month the database is actually active, database size, monthly active users on auth, preview branches created by CI, and egress.

| Stage | Compute (avg) | Active time | DB size | MAU | Branches/mo | Egress |
| --- | --- | --- | --- | --- | --- | --- |
| Launch month | 0.25 CU | 20% | 1 GB | 500 | 10 | 5 GB |
| First customers | 0.25 CU | 45% | 5 GB | 5k | 30 | 25 GB |
| Product-market fit | 0.5 CU | 75% | 20 GB | 30k | 60 | 100 GB |
| Growth | 1 CU | 95% | 60 GB | 120k | 120 | 400 GB |
| Scale | 2 CU | 100% | 200 GB | 400k | 200 | 1.5 TB |

Disagree with the assumptions? Good: they are parameters, not conclusions. Clone the repo, edit the scenario, rerun. The shape of the findings survives reasonable changes to the numbers; your exact crossover points will differ.

## The curves

```chart
{
  "type": "line",
  "title": "Monthly cost of the same application as it grows",
  "unit": "$",
  "caption": "List prices June 2026, verified against both pricing pages. Model and assumptions are open source; rerun with your own workload.",
  "x": [
    "launch month",
    "first customers",
    "product-market fit",
    "growth",
    "scale"
  ],
  "series": [
    {
      "name": "Neon (Launch)",
      "color": "#10b981",
      "data": [
        5.28,
        15.23,
        48.74,
        119.95,
        277.76
      ]
    },
    {
      "name": "Supabase (Pro)",
      "color": "#38bdf8",
      "data": [
        25.54,
        27.42,
        32.95,
        127.94,
        1213.39
      ]
    }
  ]
}
```

**Regime one, the quiet months.** At launch, Neon costs $5 to Supabase's $26. Nothing clever: Supabase Pro is a $25 flat fee plus always-on compute, while Neon bills compute only when the database is awake, and an early-stage app sleeps most of the month. If you are pre-revenue, this gap is your hosting budget.

**Regime two, the flat-fee window.** By product-market fit the picture inverts: Supabase $33, Neon $49. The database now runs three-quarters of the month, so scale-to-zero stops paying, while Supabase's fixed fee covers a Small instance running around the clock with most usage inside included quotas. This is the regime Supabase's pricing is designed for, and in it, the design works. The growth stage is nearly a tie ($128 vs $120), which is itself useful information: between roughly 30k and 120k users, price should not be the deciding factor at all; pick on the [operational differences](https://devops-daily.com/posts/neon-vs-supabase-operational-benchmarks) instead.

**Regime three, the meters.** At scale the curves split violently: $278 on Neon, $1,213 on Supabase. To see why, look at where the Supabase dollars go:

```chart
{
  "type": "bar",
  "title": "Where the money goes at the scale stage (Supabase Pro, $1213.39/mo total)",
  "unit": "$",
  "caption": "The database is not the bill. Metered monthly active users on auth dominate once you pass the included 100k.",
  "rows": [
    {
      "label": "Pro base (per org)",
      "value": 25,
      "series": "Supabase"
    },
    {
      "label": "compute (medium, 24/7, after $10 credits)",
      "value": 50.01,
      "series": "Supabase"
    },
    {
      "label": "storage beyond 8 GB included",
      "value": 24,
      "series": "Supabase"
    },
    {
      "label": "MAU beyond 100,000 included",
      "value": 975,
      "series": "Supabase"
    },
    {
      "label": "200 preview branches (10h each, no credits…",
      "value": 26.88,
      "series": "Supabase"
    },
    {
      "label": "egress beyond 250 GB included",
      "value": 112.5,
      "series": "Supabase"
    }
  ]
}
```

## The MAU surprise

That chart is the article. At 400k monthly active users, the compute (a Medium instance, $50 after credits) and even 200 GB of storage ($24) are rounding errors next to **$975 of MAU overage**: Supabase Auth includes 100k monthly active users on Pro and bills $0.00325 for each one beyond. Auth, the feature that felt free when you started, becomes 80% of the bill precisely when your product succeeds.

Neon's side has no equivalent meter: Neon Auth (in beta) carries no per-MAU billing up to one million users on the paid plans, so the scale stage is honest compute and storage: $155 + $70 + $53 of always-active database, branches included.

Now the fairness flip, because this cuts both ways: **the comparison above assumes you use the bundled auth.** Plenty of teams run Clerk, Auth0, WorkOS, or their own auth regardless of database, and at 400k MAU those run hundreds to thousands of dollars a month on their own. If you bring your own auth, delete the MAU line from the Supabase column, and the scale stage becomes roughly $238 vs $278: a near-tie that Supabase arguably wins. The platform decision and the auth decision are one decision wearing two coats; make them together.

## What the model deliberately leaves out

- **The PITR add-on** ($100/month on Supabase per 7-day window): add it if sub-minute recovery is a requirement; part two explains what you get on each platform without it.
- **Replacement costs for the rest of the bundle**: if you would otherwise pay for storage, realtime, or edge functions separately, Supabase's flat fee is buying more than a database. Neon announced its own storage and functions in June 2026, but they have not shipped.
- **Committed-use and enterprise discounts**, support tiers, and the Team/Scale tiers above these plans: that comparison is coming later in this series.
- **Egress shape**: we model it linearly; a media-heavy product will not be linear, and Supabase's $0.09/GB beyond 250 GB deserves your own modeling if that is you.

## How to actually use this

1. Find your regime. Mostly-idle side project or pre-launch: Neon by default. Steady small production app, happy inside included quotas: Supabase's flat fee is genuinely good value. Past 100k MAU on bundled auth: do the math before the bill does it for you.
2. Watch the crossovers, not the platforms. The first crossover arrives when your database stops sleeping; the second when your user count crosses the included-MAU line. Both are visible in your own metrics months before they hit the invoice.
3. Decide auth and database together. The single biggest line in this entire analysis is an auth meter on a database platform.

Every price in the model links to its source and was verified against both pricing pages in June 2026 (prices change; the [repo](https://github.com/The-DevOps-Daily/serverless-postgres-benchmarks) holds the dated record). Like the benchmarks, the model is open source and contributions are welcome: if a price moved or an assumption looks wrong, open an issue or PR and we will rerun the curves. The [live dashboard](https://postgres-benchmarks.devops-daily.com/) carries the measured performance data this series is built on, and part four will close the series with something nobody has benchmarked properly yet: what it costs in AI agent tokens to build the same application on each platform.
