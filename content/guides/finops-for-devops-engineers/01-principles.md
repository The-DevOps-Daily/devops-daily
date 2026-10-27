---
title: 'FinOps Principles and the Operating Model'
description: 'The FinOps Framework in engineering terms: six principles, the Inform, Optimize and Operate phases, the cost columns on a bill, and a first FOCUS query.'
order: 1
---

**TLDR**: FinOps is a shared practice, not a cost-cutting project. The FinOps Foundation's framework gives you six principles, three phases (Inform, Optimize, Operate) and a list of capabilities; engineers own the ones that touch infrastructure, such as allocation, anomaly response and usage optimization. Cost is usage times rate: engineers mostly control usage, while rates are usually bought centrally. Learn the cost columns on a bill (list, billed, effective), then look at real billing data in the FOCUS format with DuckDB.

The FinOps Foundation, part of the Linux Foundation, maintains the FinOps Framework that most teams use as a reference. It changes every year; this part uses the [2026 version](https://www.finops.org/insights/2026-finops-framework/) (published March 2026) and translates it into what you do as an engineer.

## Prerequisites

- A shell on Linux, macOS or Windows (WSL) with `curl`.
- About 80 MB of free disk space for the sample data and DuckDB.
- No cloud account is needed for this part.

## The Six Principles

The framework rests on six principles. Each one has a direct meaning for a DevOps team:

| Principle                                                  | What it means for you                                                                                                        |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Teams need to collaborate**                              | Finance, product and engineering look at the same numbers. You bring the technical context that explains a cost.             |
| **Business value drives technology decisions**             | The goal is the best value per dollar, not the lowest bill. A cost increase that brings more revenue can be the right call.  |
| **Everyone takes ownership for their technology usage**    | The team that creates a resource owns its cost, in the same way it owns its uptime.                                          |
| **FinOps data should be accessible, timely, and accurate** | Cost data reaches engineers within a day, in their tools, attributed to their services. A monthly PDF is too late.           |
| **FinOps should be enabled centrally**                     | A central team sets standards, buys commitments and negotiates rates, so every team does not do it differently.              |
| **Take advantage of the variable cost model of the cloud** | You can scale down, turn off and resize at any time. Use that, instead of sizing everything for the busiest day of the year. |

## The Phases: Inform, Optimize, Operate

FinOps work runs in a loop of three phases:

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Inform", "sub": "allocate costs, report, forecast", "icon": "activity", "tone": "blue" },
    { "label": "Optimize", "sub": "right-size, schedule, commit", "icon": "gear", "tone": "amber" },
    { "label": "Operate", "sub": "budgets, policies, reviews", "icon": "check", "tone": "green" }
  ]
}
```

- **Inform**: make costs visible and attributed. Which team, service and environment spent what, and is that more or less than planned? Tagging, account structure, cost reports and anomaly detection live here.
- **Optimize**: act on what you found. Delete idle resources, right-size what is too big, schedule what does not need to run all the time, and then buy commitments for the steady base.
- **Operate**: make the improvements stick. Budgets with alerts, policies in CI, cost reviews in the team's regular meetings, and runbooks for anomalies.

You do not go through the loop once. Each new service, each cost spike and each monthly bill starts another round, and different capabilities can sit in different phases at the same time.

## Domains and Capabilities

The framework groups the work into four **domains**, each with a set of **capabilities**. The 2026 update added Executive Strategy Alignment and renamed several capabilities (for example, Workload Optimization became Usage Optimization, and Architecting for Cloud became Architecting & Workload Placement). The capabilities a DevOps team usually leads are in bold:

| Domain                         | Capabilities                                                                                                                                                                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Understand Usage & Cost**    | Data Ingestion, **Allocation**, Reporting & Analytics, **Anomaly Management**                                                                                                                                                 |
| **Quantify Business Value**    | **Planning & Estimating**, Forecasting, Budgeting, KPIs & Benchmarking, Unit Economics                                                                                                                                        |
| **Optimize Usage & Cost**      | **Architecting & Workload Placement**, **Usage Optimization**, Rate Optimization, Licensing & SaaS, Sustainability                                                                                                            |
| **Manage the FinOps Practice** | Executive Strategy Alignment, FinOps Practice Operations, **Governance, Policy & Risk**, FinOps Education & Enablement, Invoicing & Chargeback, FinOps Assessment, **Automation, Tools & Services**, Intersecting Disciplines |

FinOps is no longer only about public cloud. The framework names five **technology categories**: Public Cloud, SaaS, Data Center, Data Cloud Platforms and AI. A **scope** is a slice of that spending tied to a business construct, such as a product, a cost center or an environment. "The `checkout` service in production" is a scope; AWS belongs to the Public Cloud category.

## Who Does What

The framework lists core personas: the FinOps team, Engineering, Finance, Leadership, Procurement and Product. In practice, the split of work for a team like `payments` looks like this:

| Decision                                        | Leads                    | Helps                     |
| ----------------------------------------------- | ------------------------ | ------------------------- |
| Instance types, scaling and architecture        | Engineering              | FinOps team               |
| Tag schema and account structure                | FinOps team              | Engineering (enforces it) |
| Responding to a budget or anomaly alert         | Engineering (the owner)  | FinOps team               |
| Savings Plans, reservations and discounts       | FinOps team, Procurement | Engineering (forecasts)   |
| Budgets per product or team                     | Finance, Product         | Engineering               |
| Unit cost targets (for example, cost per order) | Product, Leadership      | Engineering (measures)    |

The pattern: engineers own **usage** decisions and the response to alerts; the central team owns **rates** and standards.

## Crawl, Walk, Run

The FinOps Foundation describes maturity as crawl, walk and run, and applies it per capability, not to the whole company. For allocation, it might look like this:

- **Crawl**: separate accounts or projects per environment, a few required tags, and a monthly cost report by team.
- **Walk**: tags enforced in CI, cost data refreshed daily, weekly showback per service, anomaly alerts routed to owners.
- **Run**: almost all spend allocated automatically, shared costs split by a rule everyone agreed on, and unit costs per product that drive planning.

Being at "run" everywhere is not the goal. Move a capability up when its current level stops answering the questions people ask.

## Two Levers: Usage and Rate

Every cloud charge is a quantity times a price:

```text
cost = usage (hours, GB, requests) x rate (price per unit)
```

**Usage optimization** reduces the quantity: delete what nobody uses, right-size what is too big, turn off what is idle at night, and pick architectures that do less work. This is mostly engineering work.

**Rate optimization** reduces the price: Savings Plans, reservations and committed use discounts, Spot or preemptible capacity, and negotiated discounts. Commitments are usually bought centrally, because they span many teams.

Do usage first. A commitment locks in your current usage for one or three years, so committing before you clean up turns waste into a contract.

## The Numbers on a Cloud Bill

A single line of billing data has several cost figures, and reports that mix them up disagree. The FinOps Open Cost and Usage Specification (**FOCUS**) gives them standard names:

| FOCUS column       | Meaning                                                                                | Closest AWS term                                     |
| ------------------ | -------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **ListCost**       | The usage at public list prices, before any discount                                   | Public on-demand cost (in the Cost and Usage Report) |
| **ContractedCost** | The usage at your negotiated prices, before commitment discounts                       |                                                      |
| **BilledCost**     | What the invoice charges for the line; a commitment purchase is billed on its own line | Unblended cost                                       |
| **EffectiveCost**  | The cost after discounts, with commitment purchases spread over the usage they cover   | Amortized cost                                       |

Each line also has a **ChargeCategory**: `Usage`, `Purchase` (for example, a Savings Plan fee), `Tax`, `Credit` or `Adjustment`.

Use **EffectiveCost** (amortized) for team reports, so a team that benefits from a Savings Plan sees its usage at the discounted rate rather than at zero. Use **BilledCost** (unblended) to reconcile with the invoice. Avoid AWS's **blended** cost for team reports: it averages rates across the accounts in an organization, so one team's numbers move when another team buys a reservation.

## A First Look at Real Billing Data

FOCUS is an open specification for billing data, maintained under the FinOps Foundation. Version 1.4 was ratified on 4 June 2026, and AWS, Microsoft Azure and Google Cloud all export FOCUS data (version 1.2 on the [FOCUS site](https://focus.finops.org/) in October 2026). Because the columns are the same everywhere, one SQL query works on every provider's export.

You do not need an account to try it. The FinOps Foundation publishes [anonymized real FOCUS data](https://github.com/FinOps-Open-Cost-and-Usage-Spec/FOCUS-Sample-Data) (CC BY 4.0) from AWS, Azure, Oracle and Google Cloud for September 2024. The guide uses its 100,000-row sample: a random selection of rows, so the totals are much smaller than a real monthly bill.

Install the DuckDB command line tool, a small analytical database that queries CSV and Parquet files directly:

```tabs
{
  "title": "Install DuckDB 2.0",
  "tabs": [
    { "label": "Linux and macOS", "lang": "bash", "code": "curl https://install.duckdb.org | bash" },
    { "label": "Windows", "lang": "powershell", "code": "powershell -NoExit -ExecutionPolicy Bypass -Command \"irm https://install.duckdb.org/install.ps1 | iex\"" }
  ]
}
```

Clone the companion repository:

```bash
git clone https://github.com/The-DevOps-Daily/guide-finops-demo-2026-10-27.git
cd guide-finops-demo-2026-10-27
```

Download the sample from a fixed commit and check its SHA-256 sum (on macOS, use `shasum -a 256 -c` instead of `sha256sum -c`):

```terminal
{
  "title": "Get the FOCUS sample",
  "prompt": "$",
  "steps": [
    {
      "cmd": "curl -fsSLO https://raw.githubusercontent.com/FinOps-Open-Cost-and-Usage-Spec/FOCUS-Sample-Data/adbdd17a132984d6e8583c149c236d2199c3f5bc/FOCUS-1.0/focus_sample_100000.csv.gz"
    },
    {
      "cmd": "echo '76e9158659d40cdef0fecfe6fbc8b874a438ef9fb440205b9190ed1600bf6f8a  focus_sample_100000.csv.gz' | sha256sum -c",
      "output": "focus_sample_100000.csv.gz: OK"
    },
    {
      "cmd": "duckdb --version",
      "output": "v2.0.0 (Cyanoptera) d54cbbe3df"
    }
  ]
}
```

The first query loads the file into a table in `focus.duckdb` and counts the charges by provider and category:

```sql
-- Load the FOCUS sample into a table. sample_size = -1 makes DuckDB scan
-- every row before it picks the column types: SubAccountId holds numbers
-- for AWS and text for Oracle, so a partial scan guesses wrong.
CREATE OR REPLACE TABLE focus AS
SELECT *
FROM read_csv('focus_sample_100000.csv.gz', nullstr = 'NULL', sample_size = -1);

SELECT ProviderName AS provider,
       ChargeCategory AS charge,
       count(*) AS rows,
       round(sum(BilledCost), 2) AS billed_usd
FROM focus
GROUP BY ALL
ORDER BY provider, charge;
```

```bash
duckdb focus.duckdb -f focus/load.sql
```

```text
┌──────────────┬────────────┬───────┬────────────┐
│   provider   │   charge   │ rows  │ billed_usd │
│   varchar    │  varchar   │ int64 │   double   │
├──────────────┼────────────┼───────┼────────────┤
│ AWS          │ Credit     │   282 │   -1196.45 │
│ AWS          │ Purchase   │     3 │       2.32 │
│ AWS          │ Tax        │     6 │        0.0 │
│ AWS          │ Usage      │ 94060 │    2027.75 │
│ Google Cloud │ usage      │     2 │       0.02 │
│ Microsoft    │ Usage      │  4964 │     567.21 │
│ Oracle       │ Adjustment │   256 │       6.67 │
│ Oracle       │ Usage      │   427 │      19.42 │
└──────────────┴────────────┴───────┴────────────┘
```

Three things stand out, and all three are normal in real billing data:

- **Credits are large.** The AWS rows include USD 1,196.45 of credits (AWS open source promotional credits) against USD 2,027.75 of usage, so the AWS lines in this sample net to about USD 834. A report that adds up only `Usage` overstates what was paid, and one that adds up everything hides how much the workloads really use.
- **A Savings Plan appears as a `Purchase`.** The three AWS `Purchase` lines are Compute Savings Plan charges: two hourly fees of USD 1.159 for a No Upfront plan, and a zero line for an All Upfront plan. The usage those plans cover has a `BilledCost` of zero (Part 7 shows it), which is why team reports need `EffectiveCost`.
- **Providers fill the columns differently.** Google Cloud writes `usage` in lower case. FOCUS 1.0 data from different exporters is not perfectly consistent yet, so check the values before you filter on them.

Later parts reuse `focus.duckdb`: Part 2 looks for tag problems, Part 3 compares services across providers and Part 6 builds a showback report.

:::note
The queries in this guide use `BilledCost` for usage totals. In this anonymized sample, the AWS `EffectiveCost` values are rounded to whole dollars per line, so `BilledCost` is the more precise column here. With your own export, prefer `EffectiveCost` for team reports.
:::

## Common Mistakes

- **Treating FinOps as a one-off savings project.** Costs drift back within months unless budgets, reviews and policies keep them in place.
- **Committing before cleaning up.** Right-size and delete first, then buy Savings Plans for what is left.
- **Reporting blended or billed cost to teams.** Use amortized (effective) cost, or teams with commitments see confusing zeros and spikes.
- **Making one central team do everything.** The central team sets standards and buys rates; the teams that create resources own their usage.
- **Waiting for the invoice.** Monthly data is too late to act on. Daily data and anomaly alerts let you fix a mistake while it is still small.

## Summary

- FinOps is a loop of Inform, Optimize and Operate, run per capability and repeated with every new service and bill.
- Engineers own usage decisions and alert responses; the central FinOps team owns rates and standards.
- Cost is usage times rate. Reduce usage first, then commit for the steady base.
- Know your cost columns: list, contracted, billed (unblended) and effective (amortized). Use effective cost for team reports.
- FOCUS gives every provider's billing data the same columns, and DuckDB queries it on a laptop.

Next, [Part 2](/guides/finops-for-devops-engineers/02-challenges) looks at where cloud money usually goes to waste, using the same sample data.

## Keep Learning

- [What Is FinOps? A Beginner's Guide to Cloud Cost Management](/posts/what-is-finops-a-beginners-guide-to-cloud-cost-management)
- [Why Most FinOps Initiatives Fail (and What Actually Works)](/posts/why-finops-initiatives-fail)
- [Your Cloud Bill Is an Organizational Problem, Not a Technical One](/posts/cloud-bill-organizational-problem)
- [Interview questions: FinOps and Cloud Cost Management](/interview-questions/senior/finops-cost-management)
