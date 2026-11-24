---
title: 'A Link Tracker on the Cloudflare Free Plan: 30 Days of Numbers Against Every Limit'
excerpt: 'Our link tracker runs on Workers and D1 on the free plan. Over 30 days it never used more than 4% of the daily request limit or 9% of the write limit. The limit that moved was D1 rows read: up to 45% on a day we spent reading reports, with a daily job whose reads grew 3.4 times in a month. Our only alert was watching requests.'
category:
  name: 'Cloud'
  slug: 'cloud'
date: '2026-12-01'
publishedAt: '2026-12-01T07:07:00Z'
updatedAt: '2026-12-01T07:07:00Z'
readingTime: '20 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Cloud
  - Cloudflare
  - Cloudflare Workers
  - D1
  - Serverless
  - FinOps
  - Free Tier
---

The link tracker behind our sponsor links runs on Cloudflare Workers and D1, on the free plan, and has since October. It answers every tracked link with a redirect, takes one beacon per page view with the logos that were on screen, rolls the raw rows up once an hour, and serves reports. We designed it around the free limits before writing any code: 100,000 requests a day, 10 ms of CPU per request, 100,000 D1 rows written a day.

After 30 days of production numbers, those were not the limits that moved. The busiest day used 3.9% of the request limit. Writes stayed under 9%. The number that climbed was **D1 rows read**: a median day read 821,000 rows, the worst read 2.26 million, 45% of the 5 million allowed, and a second Cloudflare dataset put a few days near 90%. Almost all of it came from us and the people we report to opening reports, not from readers clicking links. Our only alert was watching requests.

This post goes through each free-plan limit with our real numbers next to it, the design choices that keep the hot path cheap, what nearly broke, the alert we are adding, and when the $5 Workers Paid plan would be worth it. A small open-source version of the tracker comes with it, with a script that measures CPU and D1 rows per request locally.

## TLDR

- Requests: median 2,040 a day, peak 3,890, against 100,000. The limit is shared by every Worker on the account; for this one, the busiest day leaves about 25 times headroom.
- CPU: median 1.6 ms, but the daily p99 was over 10 ms on 21 of 30 days, and the analytics recorded zero errors. The free CPU limit is not a hard per-request cutoff.
- D1 rows written: median 3,400 a day, peak 8,701 on a day with a one-off import, against 100,000.
- D1 rows read: median 821,000 a day, peak 2.26 million, against 5 million. In the week we broke down by query, 97% of the reads were report queries. Clicks and beacons read almost nothing.
- The daily job that pulls every report into our dashboard read 250,000 rows on 2026-10-25 and 847,000 on 2026-11-24. On a straight line it reaches the whole daily limit by itself in about 7 months.
- Storage: 3.9 MB on 2026-11-23, against 500 MB per database.
- The design rule that worked: make every hot-path request about one D1 write and close to zero reads. The rule we missed: reads grow with history times report views, and nothing watched them.
- Cloudflare's usage numbers are sampled. On the same day, two D1 datasets disagreed by up to 2.7 times. Alert well below the limit.

## Prerequisites

- A Cloudflare account. Everything here runs on the free plan.
- Node.js 22 or later (wrangler 4.158 requires it).
- For the demo's local measurement, a Linux machine where `wrangler dev` runs. The stock `workerd` binary would not start on our Raspberry Pi's kernel (more on that below).
- For the usage alert, an API token with Account Analytics Read.

## What the tracker does

There are four kinds of work, and they have very different costs:

```diagram
{
  "type": "graph",
  "columns": [
    [
      { "id": "reader", "label": "Reader", "sub": "clicks a link", "icon": "globe", "tone": "slate" },
      { "id": "page", "label": "Page view", "sub": "logos on screen", "icon": "globe", "tone": "slate" },
      { "id": "cron", "label": "Cron", "sub": "hourly, :05", "icon": "gear", "tone": "amber" },
      { "id": "people", "label": "Reports", "sub": "people, a daily sync", "icon": "activity", "tone": "violet" }
    ],
    [
      { "id": "worker", "label": "Worker", "sub": "Workers Free", "icon": "cpu", "tone": "accent", "detail": "One Worker answers redirects, beacons, the cron and reports. Hot path: about one D1 write, almost no reads." }
    ],
    [
      { "id": "clicks", "label": "clicks", "sub": "one upsert per click", "icon": "database", "tone": "blue" },
      { "id": "raw", "label": "raw impressions", "sub": "one upsert per page view", "icon": "database", "tone": "blue" },
      { "id": "totals", "label": "totals", "sub": "per link, per day", "icon": "database", "tone": "green", "detail": "Reports read these. Rows read grow with history and with every report view." }
    ]
  ],
  "edges": [
    ["reader", "worker", "302"],
    ["page", "worker", "beacon"],
    ["cron", "worker", "rollup"],
    ["people", "worker", "read"],
    ["worker", "clicks"],
    ["worker", "raw"],
    ["worker", "totals"]
  ]
}
```

- **Redirects.** `/<slug>` looks up the link, answers `302`, and records the click with `ctx.waitUntil()`, so the reader never waits for the write.
- **Beacons.** The site sends one `POST` per page view listing the tracked links that were at least half on screen for a second. The body is `text/plain` JSON, so the browser sends it without a CORS preflight. A preflight would double the requests.
- **The hourly cron.** It moves closed days of raw impressions into per-link daily totals and deletes the raw rows, at most a fixed number of rows per run.
- **Reports.** Each sponsor has a live report page, and an internal dashboard pulls every report once a day. Our production reports read only the totals, so impressions run up to yesterday. The demo adds the raw rows not rolled up yet, so it includes today.

## The limits we designed around

These are the Workers Free and D1 Free limits that matter for this shape of app, from Cloudflare's [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) and [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) pages, checked on 2026-11-24:

| Limit           | Workers Free                                                               | What happens past it                                                            |
| --------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Requests        | 100,000 a day, per account, reset at 00:00 UTC                             | Error 1027, or the request skips the Worker, depending on the route's fail mode |
| CPU time        | 10 ms per HTTP request and per cron run                                    | Some leniency, then the invocation is terminated                                |
| Subrequests     | 50 per invocation, 1,000 to Cloudflare services such as D1                 | The fetch throws                                                                |
| Cron Triggers   | 5 per account                                                              | Deploy fails                                                                    |
| D1 rows read    | 5,000,000 a day                                                            | "You will not be able to run queries against D1" until 00:00 UTC                |
| D1 rows written | 100,000 a day                                                              | Same                                                                            |
| D1 storage      | 500 MB per database, 5 GB per account                                      | Writes fail                                                                     |
| Workers Logs    | 0.5 GB a day, 7 days kept, from 2026-12-01 (was 200,000 events and 3 days) | Ingestion stops until 00:00 UTC                                                 |

The request limit is shared by every Worker on the account, so a second project eats into the same 100,000. The D1 limits are per account too.

Before launch we budgeted the worst case: one beacon per page view, bots included, plus clicks. On our traffic that came to a fair share of the request limit, which is why the beacon is one request with every logo in it instead of one request per logo, and why it skips the preflight.

## 30 days of real numbers

We pulled these from Cloudflare's GraphQL Analytics API for the 30 full days from 2026-10-25 to 2026-11-23, plus 72 hours of Workers Observability events for the per-request split. The aggregate numbers are in the [demo repo's `production/` folder](https://github.com/The-DevOps-Daily/free-plan-link-tracker/tree/main/production).

```chart
{
  "type": "bar",
  "title": "Share of each free daily limit used, median day vs busiest day",
  "unit": "%",
  "caption": "30 full days, 2026-10-25 to 2026-11-23. Requests: this Worker against 100,000. Writes: the 8.7% day includes a one-off import; the next highest was 5.5%. Rows read against 5,000,000. Source: Cloudflare GraphQL Analytics (sampled).",
  "rows": [
    { "label": "Workers requests", "value": 2.0, "series": "Median day" },
    { "label": "Workers requests", "value": 3.9, "series": "Busiest day" },
    { "label": "D1 rows written", "value": 3.4, "series": "Median day" },
    { "label": "D1 rows written", "value": 8.7, "series": "Busiest day" },
    { "label": "D1 rows read", "value": 16.4, "series": "Median day" },
    { "label": "D1 rows read", "value": 45.2, "series": "Busiest day" }
  ],
  "series": [
    { "name": "Median day", "color": "#38bdf8" },
    { "name": "Busiest day", "color": "#f59e0b" }
  ]
}
```

| Limit                          |      Free plan | Median day | Highest day |          Used at peak |
| ------------------------------ | -------------: | ---------: | ----------: | --------------------: |
| Workers requests (this Worker) |        100,000 |      2,040 |       3,890 |                  3.9% |
| CPU p50                        |          10 ms |     1.6 ms |      3.6 ms |                       |
| CPU p99                        |          10 ms |    10.8 ms |     20.6 ms | over on 21 of 30 days |
| D1 rows written                |        100,000 |      3,401 |       8,701 |                  8.7% |
| D1 rows read                   |      5,000,000 |    821,166 |   2,261,164 |                 45.2% |
| D1 storage                     |         500 MB |            |      3.9 MB |                  0.8% |
| Subrequests to the internet    | 50 per request |          0 |           0 |                       |
| Worker errors (reported)       |                |          0 |           0 |                       |

Two rows in that table are worth a closer look: CPU, because the p99 is over the limit and no errors were reported, and rows read, because it is the only one that got anywhere near its limit.

### CPU: over 10 ms on most days, and no errors

The daily CPU p99 was above 10 ms on 21 of the 30 days, and reached 20.6 ms on 2026-11-19. The invocation analytics reported zero errors, and every invocation's status was success. Cloudflare's limits page describes this: "Each isolate has some built-in flexibility to allow for cases where your Worker infrequently runs over the configured limit." A Worker that runs over consistently gets terminated.

The 72 hours of Observability events show which requests run long:

| Request                        | Requests in 72 h | CPU p50 |  p90 |  p99 |   Max | Over 10 ms |
| ------------------------------ | ---------------: | ------: | ---: | ---: | ----: | ---------: |
| Beacon                         |            3,614 |    3 ms | 6 ms | 9 ms | 15 ms |         17 |
| Redirect, HEAD (link checkers) |            2,000 |    1 ms | 3 ms | 7 ms | 11 ms |          1 |
| Root and robots.txt            |            1,151 |    0 ms | 0 ms | 1 ms |  2 ms |          0 |
| Redirect, GET                  |              955 |    0 ms | 5 ms | 8 ms | 14 ms |          4 |
| Reports and dashboards         |              410 |    0 ms | 1 ms | 4 ms |  6 ms |          0 |
| Hourly cron                    |               72 |    4 ms | 6 ms | 9 ms |  9 ms |          0 |
| All fetch requests             |            8,130 |    1 ms | 5 ms | 9 ms | 15 ms |         22 |

Observability reports CPU in whole milliseconds, so treat the small values as rough. Three things stand out:

1. **The beacon is the most expensive request**, not the redirect. It reads and parses a JSON body, checks it against cached lists (and reloads them when the cache is cold), hashes the visitor on sponsored pages, and writes. That is the code path to keep small.
2. **HEAD requests outnumber GET redirects two to one.** Nobody browses with HEAD; these are almost certainly link checkers and email security scanners. They count as automated clicks, and each one uses request budget like a real click.
3. **Report requests use little CPU, even though reports are where the reads are.** The 404 dashboard API requests in this window used at most 5 ms of CPU each, and the six report page views at most 6 ms. Separately, the three 04:00 UTC sync hours in the same window read about 800,000 rows each. These exports do not pair each request's CPU with its rows read, but no request in that class came close to 10 ms. The SQL runs inside D1, not in your isolate, so D1 query time is not Worker CPU time. A heavy report is a rows-read problem, not a CPU problem.

22 of 8,130 requests went over 10 ms, 0.27%. That is the "infrequently" the docs allow. If a code change pushed the beacon's p50 toward 10 ms, it would stop being infrequent.

### Rows read: the limit nobody was watching

```chart
{
  "type": "line",
  "title": "D1 rows read per day",
  "caption": "30 full days, 2026-10-25 to 2026-11-23, from d1AnalyticsAdaptiveGroups (sampled). The free limit is 5,000,000 rows a day.",
  "x": ["10-25", "10-26", "10-27", "10-28", "10-29", "10-30", "10-31", "11-01", "11-02", "11-03", "11-04", "11-05", "11-06", "11-07", "11-08", "11-09", "11-10", "11-11", "11-12", "11-13", "11-14", "11-15", "11-16", "11-17", "11-18", "11-19", "11-20", "11-21", "11-22", "11-23"],
  "series": [
    { "name": "Rows read", "data": [277266, 1977750, 794976, 648790, 753587, 672256, 358883, 371117, 446048, 1950511, 1411747, 610595, 1788441, 603739, 723194, 915428, 1048469, 1159599, 961680, 1201187, 693495, 702934, 740072, 772950, 2261164, 1672901, 1705241, 1237686, 847356, 933141], "color": "#f59e0b" }
  ],
  "refs": [{ "value": 5000000, "label": "free limit" }]
}
```

The shape is the interesting part. In the week to 2026-11-24, the median hour read about 3,000 rows. Twelve hours out of 168 carried 90% of the week's reads, and the 04:00 to 05:00 UTC hour of each day, seven hours in all, carried 57%. That is when our internal dashboard pulls every report once a day. The other big hours were working hours when someone opened reports.

D1's query insights (also sampled) split the same week by query:

| Query kind                                                          | Share of rows read |
| ------------------------------------------------------------------- | -----------------: |
| Report queries                                                      |              96.9% |
| Per-isolate cache loads on beacons (active links, registered pages) |               2.7% |
| Writes and the hourly rollup                                        |               0.2% |
| Redirect lookups (about 1 row each)                                 |         under 0.1% |

So the traffic itself is close to free in reads. A report is not. One full report for a busy campaign reads tens of thousands of rows across its queries, because it covers impressions by day, placement, page section and country over the whole history. Rows read grow with **history times report views**, and both only go up.

The days that got close were 2026-11-18 to 11-20, when we were building new report sections and reloading reports to check them. The main D1 dataset shows 1.7 to 2.3 million rows read on those days. D1's query insights dataset, for the same database and days, shows 4.2 to 4.6 million, which is 84% to 91% of the limit.

### Two datasets, two answers

Both numbers come from Cloudflare and both are sampled. On hours under 20,000 rows read they agree closely: a median difference of 7%, and 19% at the 90th percentile. On hours with a few huge queries they do not, in either direction: for 11:00 to 12:00 UTC on 2026-11-19 one says 750,000 rows read and the other 4.37 million. In the query insights data for that hour, the biggest report query shows 92 executions with a sample interval of 92: one sampled execution that read 20,159 rows, counted 92 times.

| Day        | d1AnalyticsAdaptiveGroups | d1QueriesAdaptiveGroups |
| ---------- | ------------------------: | ----------------------: |
| 2026-11-18 |                 2,261,164 |               4,434,202 |
| 2026-11-19 |                 1,672,901 |               4,553,990 |
| 2026-11-20 |                 1,705,241 |               4,188,793 |
| 2026-11-21 |                 1,237,686 |                 467,858 |
| 2026-11-22 |                   847,356 |                 320,563 |

The main dataset looks like the steadier of the two. The daily sync runs the same queries every morning, and the main dataset shows its hour reading a smooth, rising number every day, while query insights reports anywhere from 3,799 to 3.01 million rows for the same hour. We do not know which one Cloudflare's enforcement follows, and we could not find it documented. The practical answer is to alert on the main dataset early. If the true number could be twice the reported one, an alert at 50% would fire with nothing left, so we alert at 40%. That is a judgment, not a measured error bound.

### The job that grows every day

That smooth number is the clearest trend in all of our data:

```chart
{
  "type": "line",
  "title": "D1 rows read by the daily report sync (04:00 to 05:00 UTC)",
  "caption": "d1AnalyticsAdaptiveGroups (sampled), the 04:00 UTC hour of each day, 2026-10-25 to 2026-11-24. The step on 11-07 follows a one-off import of older rows on 11-06. Little else runs in that hour.",
  "x": ["10-25", "10-26", "10-27", "10-28", "10-29", "10-30", "10-31", "11-01", "11-02", "11-03", "11-04", "11-05", "11-06", "11-07", "11-08", "11-09", "11-10", "11-11", "11-12", "11-13", "11-14", "11-15", "11-16", "11-17", "11-18", "11-19", "11-20", "11-21", "11-22", "11-23", "11-24"],
  "series": [
    { "name": "Rows read in the sync hour", "data": [249949, 258450, 274069, 290479, 306120, 317966, 330502, 337268, 348524, 364504, 384918, 407255, 425741, 503815, 521781, 537819, 567379, 592799, 611523, 629805, 649454, 661206, 675505, 690900, 711692, 738020, 760000, 781475, 793414, 817374, 847289], "color": "#a855f7" }
  ],
  "refs": [{ "value": 2500000, "label": "50% of the free limit" }]
}
```

The sync reads every campaign's report over its whole history, so each day of history adds rows to every run after it. It read 250,000 rows on 2026-10-25 and 847,000 on 2026-11-24, about 20,000 more each day. On a straight line, this one job crosses 50% of the daily limit in about 83 days, in February 2027, and the whole limit in about 209 days, in June 2027, before anyone opens a single report. The line is more likely to bend up than down, because new campaigns add history too.

## What one request costs, measured locally

Production numbers tell you what happened. They do not tell you what one more request costs, or what the design choices save. For that we wrote a small, generic version of the tracker and measured it under `wrangler dev`.

```github
https://github.com/The-DevOps-Daily/free-plan-link-tracker
```

It has the same shape: redirects with a per-isolate link cache, a `text/plain` beacon that writes one row per page view, an hourly rollup into per-link totals in chunks of 1,000 rows, and reports. A `METRICS=1` mode adds up `rows_read` and `rows_written` from the meta D1 returns with every query and puts them in response headers. The measure script sends 400 requests of each kind (50 for reports), five times over, and reads the CPU time of the local `workerd` processes from `/proc` before and after. The seed is 400 days of synthetic history for 12 links, and a third run starts from raw rows only and rolls them up with the real rollup.

```terminal
{
  "title": "free-plan-link-tracker",
  "prompt": "$",
  "steps": [
    { "comment": "three runs on fresh local databases: rolled-up seed, raw seed, raw seed rolled up by the real rollup" },
    { "cmd": "scripts/run-all.sh 400 5", "output": "wrote results/measure-naive.json\nwrote results/measure-pipeline.json\nCode d31efd00bb483f52, Intel(R) Xeon(R) Platinum 8280 CPU @ 2.70GHz (4 cores), Node v24.22.3, 5 repeats, medians." },
    { "comment": "every report must match, before and after the real rollup" },
    { "cmd": "grep -A4 'Report check' results/summary.md", "output": "Report check (link-01 and the all-links dashboard, 365 days): the same numbers in every run\n- totals: {\"human\":910685,\"automated\":276432} impressions, {\"human\":1946,\"automated\":851} clicks, fefe64e32916\n- naive: {\"human\":910685,\"automated\":276432} impressions, {\"human\":1946,\"automated\":851} clicks, fefe64e32916\n- pipeline: {\"human\":910685,\"automated\":276432} impressions, {\"human\":1946,\"automated\":851} clicks, fefe64e32916\n- pipeline after rollup: {\"human\":910685,\"automated\":276432} impressions, {\"human\":1946,\"automated\":851} clicks, fefe64e32916" }
  ]
}
```

| Request                                   | Rows read | Rows written | Local CPU, net of `/healthz` |
| ----------------------------------------- | --------: | -----------: | ---------------------------: |
| Redirect, cached link                     |         0 |            1 |                      1.70 ms |
| Redirect, HEAD                            |         0 |            1 |                      1.65 ms |
| Unknown link (uncached lookup, 404)       |         0 |            0 |                      1.68 ms |
| Beacon, 3 links seen                      |         0 |            1 |                      1.30 ms |
| Report, one link, 30 days                 |       507 |            0 |                      3.13 ms |
| Report, one link, 365 days                |     3,471 |            0 |                      6.72 ms |
| Dashboard, all links, 365 days            |    41,383 |            0 |                        11 ms |
| The same dashboard from raw rows          |   134,712 |            0 |                        50 ms |
| Hourly rollup, 1,000 raw rows (gross CPU) |    11,130 |        1,817 |                  about 10 ms |

Medians of 5 runs on a 4 vCPU cloud VM, wrangler 4.158.0, Node.js 24.22.3. Full table: [`results/summary.md`](https://github.com/The-DevOps-Daily/free-plan-link-tracker/blob/main/results/summary.md). The rollup row is the median of 24 single runs, with no baseline subtracted, and `/proc` counts CPU in 10 ms ticks, so read it as "about 10 ms". A lookup that misses reads 0 rows locally; in production a link lookup that finds its row reads about 1.

Read the two halves of that table differently:

- **D1 rows are exact counts.** They come from D1's own result meta for this fixture and runtime, not from sampled analytics, and they do not depend on the machine. A redirect for a cached link writes 1 row and reads none. So does a beacon. That stays true on day 400: the hot path does not get more expensive as history grows.
- **Local CPU is only good for comparing requests on one machine.** Local D1 runs SQLite inside the same `workerd` process, so local CPU includes query work. That is why the dashboard from raw rows shows 50 ms locally, while in production no dashboard API request used more than 5 ms of Worker CPU, in the same 72 hours that the sync read about 800,000 rows a day. The local number would have pointed at the wrong risk.

One method bug is worth passing on. Our first full run was on a shared development box, and the script summed the CPU of every `workerd serve` process on the machine, including unrelated ones. The rows were identical to the final run, because they come from D1's meta, but some CPU spreads went negative, which is how we noticed. The script now counts only the `workerd` binaries from its own checkout and records their PIDs and the load average, and the numbers above come from an otherwise idle VM.

### What the rollup buys, and what it costs

The rollup is the reason a report reads totals instead of raw rows. For one link over 365 days, the whole report request reads 3,471 rows when it uses the totals and 75,437 when it unpacks the raw rows, 22 times fewer. Every run returns the same numbers, including one that starts from raw rows only and is rolled up by the real rollup; the script checks that before and after.

```chart
{
  "type": "bar",
  "title": "D1 rows read per report, rolled-up totals vs raw rows",
  "caption": "One link, 12 links in total, 400 days of synthetic history (seed 42), 60 sets of links seen per day. Exact counts from D1 result meta, wrangler 4.158.0. The all-links dashboard over 7 days is cheaper from the raw rows, because their key starts with the day.",
  "rows": [
    { "label": "one link, 7 days", "value": 301, "series": "Totals" },
    { "label": "one link, 7 days", "value": 1468, "series": "Raw rows" },
    { "label": "one link, 30 days", "value": 507, "series": "Totals" },
    { "label": "one link, 30 days", "value": 6233, "series": "Raw rows" },
    { "label": "one link, 365 days", "value": 3471, "series": "Totals" },
    { "label": "one link, 365 days", "value": 75437, "series": "Raw rows" },
    { "label": "all links, 7 days", "value": 24847, "series": "Totals" },
    { "label": "all links, 7 days", "value": 8268, "series": "Raw rows" },
    { "label": "all links, 365 days", "value": 41383, "series": "Totals" },
    { "label": "all links, 365 days", "value": 134712, "series": "Raw rows" }
  ],
  "series": [
    { "name": "Totals", "color": "#10b981" },
    { "name": "Raw rows", "color": "#f59e0b" }
  ]
}
```

The all-links rows are the surprise. The totals table's primary key starts with the link, because the common report is one link. A dashboard that asks for every link over the last 7 days cannot use that key, and neither can its click query, so it scans every row of both tables (18,421 totals and 5,761 click rows) plus today's raw rows: 24,847 rows read per request for 7 days, more than the 8,268 the raw rows need, whose key starts with the day. An index on the day would help. On D1, an index adds a written row for every write that touches the indexed column, so it is cheap on the totals, which only the hourly cron writes, and expensive on the click rows, which every click writes. An index on the totals alone fixes only part of the scan. We have not measured that variant.

The rollup has its own cost: a run over 1,000 raw rows read 11,130 rows and wrote 1,817 (the inserts and updates into totals plus the deletes), at the median of 24 runs. Rolling up the 399 closed days took 24 runs; today's 58 raw rows stay until tomorrow. Once an hour, on a day's worth of rows, that is small. The chunk size is there so that a backlog, or a flood of forged beacons, drains over several runs instead of spending a day of writes in one.

### The cache that mostly missed

The demo shows a beacon reading 0 rows, because the measure script warms the per-isolate cache and then hits the same isolate 400 times. Production disagrees. The beacon refreshes its cached list of active links once a minute per isolate. In the same 72 hours as the CPU table, query insights estimates 2,683 loads of that list, against 3,614 beacons. Roughly three in four beacons paid for a cache load.

Beacons averaged about 0.84 a minute in that window, spread across Cloudflare's network. The load count is what you would expect if most beacons land on an isolate that has not seen one in the last minute, though these exports do not show isolate reuse directly. A per-isolate cache saves a lot at high traffic and little at low traffic, which is exactly when you are on the free plan. In the separate seven-day query breakdown, the three list-loading queries together were about 2.7% of estimated reads, because the lists are small. If the list were large, the [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/) per data center would be the better place for it.

## The design choices that keep it inside

Each of these came from a limit:

- **About one write per hot-path request.** A click is one upsert into a row keyed by link, day and placement. A page view is one upsert keyed by day and the sorted set of links seen, so a post with four logos on screen is still one write. In production, a view of a sponsored page adds a second row for its page views.
- **No secondary indexes on hot tables.** An index adds a written row whenever a write includes its indexed column. The click table has only its primary key.
- **The reader never waits.** Writes go through `ctx.waitUntil()`, and a failed write never blocks the redirect. If the lookup itself fails (D1 down or over its limit), the redirect uses a copy of the link up to 10 minutes old or sends the reader to the site, never to an error page. The demo does the same.
- **The beacon always answers 204.** A sender learns nothing about what was counted, and the browser has nothing to retry.
- **Allowlists before writes.** Placements and page sections come from fixed lists, and links must be active. That keeps unknown values out of the tables and out of every report. It does not stop forged traffic from writing valid combinations or using up the daily writes; only a rate limit would.
- **One cron, chunked.** The free plan allows five Cron Triggers per account. One hourly trigger does all the housekeeping, and each run handles a bounded number of rows.
- **Reports read totals.** Never the raw rows, and only the campaign's own links.

And what we chose not to use:

- **KV** for counters. Workers KV on the free plan allows 1,000 writes a day to different keys. Our median day writes 3,400 rows.
- **Analytics Engine.** It keeps data for three months, and a sponsor renewal conversation needs longer.
- **A WAF rate limiting rule** on the beacon. The free plan includes one rule, and it would stop a flood before it reaches the Worker. We have not added it yet; the request numbers do not call for it.
- **Turnstile on the beacon.** It is on the forms, where a person is present. A beacon has no person to ask.

If you are weighing Cloudflare against other platforms for the static side of a site, the [Vercel vs Netlify vs Cloudflare Pages comparison](/comparisons/vercel-vs-netlify-vs-cloudflare-pages) covers the free-tier differences there. D1 is SQLite underneath, so the trade-offs in [SQLite vs PostgreSQL](/comparisons/sqlite-vs-postgresql) apply to the query side.

## What would break first, and the alert

Ranked by how close each limit is, with our current traffic:

1. **D1 rows read**, on a day of heavy report use, and a little closer every day because of the sync. It has already reached 45% by the main dataset and possibly more. The fix is cheap: precompute the all-time report numbers in the hourly cron, cache a rendered report for a few minutes, and give the dashboard sync an index it can use. Each of those trades a few writes for a lot of reads.
2. **CPU**, if the beacon grows. It runs at 3 ms median and 9 ms p99 today, already brushing the limit at the tail. Anything heavy added to the beacon path (more hashing, larger bodies, a slow regular expression) would make the overruns frequent.
3. **Requests**, only at about 25 times this Worker's busiest day (less if other Workers on the account grow), or with a flood. A flood also burns rows written, which is why the rollup is chunked and the beacon has allowlists.

When either daily D1 row allowance is used up, the redirects still work, by falling back, but clicks and impressions for the rest of the UTC day are lost and reports fail. When the request limit is hit, the links themselves stop working until midnight UTC. For a sponsor link that is the worst outcome, which is why the alert matters more than the headroom.

Our only alert before this post watched Workers requests at 60% of the daily limit. It never fired. The alert we are adding is `scripts/free-plan-usage.mjs` in the demo repo. It reads today's numbers for the whole account from the GraphQL API and exits 1 when requests, rows read or rows written pass a threshold (50% by default; we pass 40%). Schedule it with anything that tells you about a non-zero exit: cron with `MAILTO`, a scheduled CI job, or a monitor. Here it is against our account at 11:54 UTC on 2026-11-24:

```terminal
{
  "title": "free-plan-usage",
  "prompt": "$",
  "steps": [
    { "cmd": "node scripts/free-plan-usage.mjs --threshold 0.4", "output": "2026-11-24 UTC, 50% of the day gone\nWorkers requests        2,859 / 100,000  2.9% now, ~6% by midnight\nD1 rows read          895,225 / 5,000,000  17.9% now, ~36% by midnight\nD1 rows written         4,111 / 100,000  4.1% now, ~8% by midnight\nWorker errors     0\nCPU p99 (worst Worker) 9.0 ms against the 10 ms free limit\nunder 40%" }
  ]
}
```

The token comes from the environment, never the command line, and only needs Account Analytics Read. The straight-line "by midnight" guess is printed but never triggers the alert: rows read arrive in a few bursts a day, so only the threshold does.

## When $5 would be worth it

[Workers Paid](https://developers.cloudflare.com/workers/platform/pricing/) costs a $5 monthly minimum per account and includes 10 million requests and 30 million CPU milliseconds a month. D1 on the paid plan includes 25 billion rows read and 50 million rows written a month. CPU goes up to 5 minutes per request, and D1 Time Travel keeps 30 days instead of 7. At our size, every number in this post would be a rounding error.

We have not paid, and these are the signals that would change that:

- **Rows read regularly above the 40% alert** after the cheap fixes above. With a 2x disagreement between Cloudflare's own datasets, that is closer to a lost day than it looks.
- **Requests above about 50,000 on ordinary days.** That leaves no room for a launch day or a post that spreads.
- **A growing share of requests over 10 ms**, not just a tail of a fraction of a percent, or any CPU-limit errors. Cloudflare does not publish how often is too often; its wording is "consistently", and the result is terminated requests.
- **A tracked link that earns more than $5 a day.** If a lost afternoon of sponsor clicks costs more than a month of the plan, the plan is insurance, not a cost.

Until then, the free plan plus one alert is enough. If you are comparing what "free" means across providers, our look at [object storage with free egress](/posts/object-storage-free-egress-fine-print) found the same pattern on the storage side: the headline limit is rarely the one that catches you.

## What we could not conclude

- **Which dataset Cloudflare enforces against.** We saw the two D1 datasets disagree by up to 2.7 times on a day. We do not know which one the limit uses.
- **The sync projection.** Thirty days of a straight line is a trend, not a forecast. It assumes the same reports and the same campaigns.
- **Why the beacon's tail reaches 15 ms.** Observability does not mark cold starts, and these measurements do not identify the cause.
- **Local CPU as a prediction.** Local CPU includes SQLite work that Cloudflare does not bill as Worker CPU, and the local run includes the dev proxy, which we subtract with a `/healthz` baseline. Use it to compare request kinds, not to predict production milliseconds.
- **A viral day.** Thirty days without a spike tells you about ordinary days. The 25x headroom on requests is arithmetic, not a test.
- **The local tests on our own dev box.** The stock `workerd` binary would not start on our Raspberry Pi, whose kernel gives processes a 39-bit virtual address space. We ran the demo on throwaway cloud VMs and deleted them afterwards.

For how the 10 ms budget and the missing long-lived process shape edge code in general, see [Where Your Code Runs When There Is No Region](/posts/edge-runtime-no-long-lived-process). For another Workers-native design measured end to end, see [A Repo per Agent: What Cloudflare Artifacts Changes About Git](/posts/cloudflare-artifacts-repo-per-agent).

## Summary

On the Cloudflare free plan, a link tracker's hot path can cost about one D1 write and almost no reads per request, and ours used less than 4% of the request limit and under 9% of the write limit over 30 days. CPU ran over 10 ms at the p99 on most days with no reported errors, because the limit allows infrequent overruns. The limit that moved was D1 rows read, driven by report views times history, and it was the one limit nothing watched.

If you build on the free plan:

1. Budget every hot-path request in rows written and rows read, and keep both near one.
2. Expect reads to grow with history and with how often people look. Precompute what reports need.
3. Pick primary keys for your most common read, and put indexes on tables that are written rarely.
4. Alert on requests, rows read and rows written well below the limit (we use 40%), because the numbers are sampled.
5. Pay the $5 when a lost day costs more than $5, not when a chart looks scary.
