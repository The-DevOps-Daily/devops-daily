---
title: 'Neon vs Supabase Free Tiers: We Benchmarked Both So You Don''t Have To'
excerpt: 'We ran 320 timed operations against the Neon and Supabase free tiers from a same-region client: query latency, project creation, cold starts, and branching. The latency race is a tie, and the real differences are nothing like the marketing.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-06-10'
publishedAt: '2026-06-10T18:30:00Z'
updatedAt: '2026-06-10T21:45:00Z'
readingTime: '11 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - postgres
  - neon
  - supabase
  - databases
  - serverless
  - benchmarks
---

Pick any "Neon vs Supabase" thread on the internet and you will find the same spec-sheet ping pong: one side quotes storage limits, the other quotes monthly active users, and nobody has actually timed anything. Both platforms hand out free Postgres, both claim to be fast, and both free tiers have sharp edges that only show up when you run real operations against them.

So we ran real operations against them. 320 timed samples across nine operation types, both platforms in the same AWS region (eu-central-1, Frankfurt), measured from a client VM in the same metro so network distance could not put a thumb on the scale. Every raw sample, the harness that produced it, and a live dashboard are public, so you can check the math or rerun the whole thing yourself: explore the [live results dashboard](https://postgres-benchmarks.devops-daily.com/) or read the harness at [The-DevOps-Daily/serverless-postgres-benchmarks](https://github.com/The-DevOps-Daily/serverless-postgres-benchmarks).

This is the free tier piece. Paid-tier operations (read replicas, compute resizing, Supabase branching) get their own article once those runs land.

## TLDR

- **Query latency is a tie.** Every connection path on both platforms lands at a 25 to 30 ms median for a full connect + TLS + auth + query cycle from a same-region client. Do not pick either platform for single-query speed.
- **Project creation is closer than you think.** Neon: 5.7 s median to a queryable database. Supabase: 7.4 s. Both have outliers above 11 s.
- **The idle behavior is the real difference.** Neon free databases scale to zero after 5 minutes and wake automatically in about 570 ms. Supabase free projects pause after 7 days of inactivity and stay down until you log in and restore them by hand.
- **Branching only exists on one side.** Neon free includes copy-on-write branches that arrive carrying the parent's data, queryable in 2.2 s. Supabase branching requires a paid plan and starts without data.
- **Networking will surprise you.** Supabase free-tier direct connections are IPv6-only. From an IPv4 client (most CI runners, many VPSes, most home networks) you must use their pooler, and the TLS chain is signed by Supabase's own CA.

## How we measured

The harness is a small TypeScript runner that drives each platform's management API plus a regular `pg` connection. The rules:

- Both platforms in **aws eu-central-1**, measured from a 2 vCPU VM in Frankfurt (1 to 2 ms from both).
- Every operation runs repeatedly: 50 runs for latency paths, 20 for project creation and cold starts, 10 for branching. Reports use **median and p95**, never single runs.
- Latency samples use a **cold connection each time**: connect, TLS handshake, auth, `select 1`, disconnect. That is what a serverless function pays per invocation without a warm pool, and it is a fairer test than hammering one warm session.
- Every resource is created fresh, named `bench-*`, and deleted after the run.
- Raw samples are committed to the repo with region, plan, and client metadata. The numbers below link to data, not to memory.

Free plans on both sides, as of June 2026.

## Query latency: stop arguing about it

Five different connection paths, 50 cold-connection cycles each:

```chart
{
  "type": "bar",
  "title": "Query latency: cold connection, select 1 (median, 50 runs each)",
  "unit": "ms",
  "tickLabel": "p95",
  "caption": "Full connect + TLS + auth + query cycle from a same-metro client.",
  "rows": [
    {
      "label": "Neon, pooled",
      "value": 25.1,
      "tick": 36,
      "series": "Neon"
    },
    {
      "label": "Neon, direct",
      "value": 29.4,
      "tick": 63.3,
      "series": "Neon"
    },
    {
      "label": "Supabase, direct (IPv6)",
      "value": 27.9,
      "tick": 33.6,
      "series": "Supabase"
    },
    {
      "label": "Supabase, session pooler",
      "value": 29,
      "tick": 37.2,
      "series": "Supabase"
    },
    {
      "label": "Supabase, transaction pooler",
      "value": 29.9,
      "tick": 40.6,
      "series": "Supabase"
    }
  ]
}
```

That is a 5 ms spread across ten thousand-ish kilometers of marketing. At equal network distance, the free tiers are latency-equivalent for a single query. The spread between the fastest and slowest path on the *same* platform is bigger than the spread between platforms.

The percentile view makes the tails visible too. Every one of the 250 samples, ranked:

```chart
{
  "type": "cdf",
  "title": "Query latency percentiles (50 cold connections per path)",
  "unit": "ms",
  "caption": "Read p50 and p95 off the dashed lines. The long green tail is Neon direct.",
  "series": [
    {
      "name": "Neon pooler",
      "samples": [
        40.5,
        39,
        34.1,
        36,
        31,
        25,
        21.5,
        26.6,
        31.9,
        29.2,
        27.5,
        23.3,
        31.4,
        27.5,
        23.1,
        22,
        20.8,
        24.6,
        29.1,
        20.8,
        24.1,
        30.6,
        28.9,
        21.6,
        25.1,
        23,
        31.8,
        23.2,
        21.3,
        19.8,
        26.5,
        22.4,
        22.3,
        28.2,
        29.1,
        26.1,
        24.5,
        25.9,
        24.5,
        20.1,
        33,
        20.4,
        23,
        19.7,
        22.5,
        27.5,
        23.8,
        26.1,
        28.8,
        25.8
      ],
      "color": "#10b981"
    },
    {
      "name": "Neon direct",
      "dash": "6 5",
      "samples": [
        37,
        24.7,
        31.1,
        29.9,
        73.8,
        63.3,
        42.3,
        66.2,
        45.6,
        49.9,
        43.9,
        28.4,
        27.9,
        37.4,
        29,
        29,
        24.5,
        25,
        27,
        32.7,
        34.6,
        39.2,
        26.2,
        32.8,
        29.4,
        27.9,
        34.7,
        29.8,
        33.2,
        26.3,
        27.5,
        33,
        36.6,
        32.4,
        30,
        33.9,
        26.7,
        30.7,
        26.3,
        25.9,
        29,
        26.7,
        26.8,
        26,
        24.7,
        26.8,
        27.8,
        29.5,
        27.2,
        24.1
      ],
      "color": "#10b981"
    },
    {
      "name": "Supabase direct (IPv6)",
      "samples": [
        27,
        28.5,
        31.6,
        29.5,
        31.1,
        33.6,
        27.5,
        27.3,
        30.2,
        26.6,
        29.4,
        27.8,
        26.4,
        27.9,
        30,
        34.2,
        30.7,
        29.1,
        29.1,
        31.6,
        24.9,
        29.6,
        30.4,
        31.9,
        25,
        25.7,
        28,
        32.3,
        27.3,
        27.1,
        25.4,
        27.3,
        27.2,
        26.6,
        29.7,
        26.3,
        28.9,
        26.1,
        29.4,
        24.9,
        29.3,
        24.9,
        26.3,
        30.8,
        27.1,
        25.6,
        34.4,
        25.1,
        27.9,
        26.6
      ],
      "color": "#38bdf8"
    },
    {
      "name": "Supabase session",
      "dash": "6 5",
      "samples": [
        37.2,
        34.7,
        28.5,
        34.3,
        31.4,
        32.7,
        37.3,
        29,
        36,
        35.7,
        32.3,
        31.2,
        27.6,
        34.2,
        28.8,
        27.5,
        30.6,
        28.4,
        28.3,
        26.5,
        27.3,
        28.9,
        29.5,
        34.2,
        24.3,
        29.7,
        29.9,
        24.6,
        27.2,
        26.7,
        27.9,
        29.4,
        33,
        29.3,
        33.7,
        25.3,
        27.4,
        29.8,
        26.1,
        28.4,
        31.2,
        25.8,
        25.1,
        27,
        27,
        34.1,
        23.3,
        24.8,
        37.8,
        30.9
      ],
      "color": "#38bdf8"
    }
  ]
}
```

What this means in practice: latency should not be on your decision sheet at all. Region placement matters about 10x more than vendor choice, because every millisecond of client-to-region distance gets added to each of these numbers.

## Project creation: both are fast now

Time from the management API call to the first successful `select 1`, 20 runs each:

| Platform | Median | p95 | Range |
| --- | --- | --- | --- |
| Neon | 5.7 s | 8.8 s | 3.5 s to 13.6 s |
| Supabase | 7.4 s | 11.8 s | 6.5 s to 11.9 s |

Two things stood out. First, both are genuinely fast: a complete, queryable Postgres in single-digit seconds. Supabase used to take minutes to provision a project; that reputation is outdated. Second, neither is consistent: Neon's fastest run was 3.5 s and its slowest 13.6 s, nearly a 4x spread, so do not build automation that assumes the median.

```chart
{
  "type": "dots",
  "title": "Project creation: API call to first successful query",
  "unit": "ms",
  "caption": "20 runs each, aws eu-central-1, free plans, June 2026. Amber line is the median.",
  "series": [
    {
      "name": "Neon",
      "samples": [
        6088.4,
        5801.6,
        5593.9,
        5573.1,
        13558,
        6011.9,
        5474.2,
        5775.9,
        5683.7,
        5528.4,
        5705.2,
        8568.3,
        3571.7,
        5765,
        5718.4,
        3462,
        5491.3,
        3927.3,
        8751.6,
        8803.3
      ]
    },
    {
      "name": "Supabase",
      "samples": [
        7621.3,
        11884.2,
        7052.1,
        6492.8,
        8521.4,
        7380.4,
        6873.7,
        8101.3,
        9189,
        9933.4,
        6777.1,
        6947.2,
        7473.7,
        7936.5,
        6802.8,
        6921.1,
        7105.7,
        7337.1,
        11765,
        8402.1
      ]
    }
  ]
}
```

If your workflow creates databases programmatically (per-tenant databases, ephemeral test environments, agent-driven tooling), both free tiers can technically do it, but the caps differ wildly: Neon allows up to 100 projects on the free plan, Supabase allows 2 active projects per organization. For anything that creates databases in a loop, that single line of the spec sheet decides for you before any benchmark does.

## Idle behavior: a nap versus a coma

This is the section that should actually drive your decision for side projects, and it is the one spec sheets describe worst.

**Neon** free compute always scales to zero after 5 minutes of inactivity. You cannot turn that off on the free plan. The flip side: it wakes automatically on the next connection. We suspended and woke a database 20 times:

- Wake query (first query against suspended compute): **568 ms median, 1.06 s p95**, worst case 1.55 s.

```chart
{
  "type": "dots",
  "title": "Neon cold start: first query against suspended compute",
  "unit": "ms",
  "caption": "20 suspend/wake cycles. Neon documents 300-500 ms as typical.",
  "series": [
    {
      "name": "wake query",
      "samples": [
        576.9,
        580.3,
        1553.8,
        567.7,
        563.1,
        572.8,
        557.8,
        571,
        567.1,
        557.3,
        562.6,
        573.4,
        558.3,
        554.5,
        566.3,
        565.1,
        586.9,
        571.7,
        583.1,
        1061.9
      ]
    }
  ]
}
```

Neon's docs say cold starts are "typically a few hundred milliseconds" with 500 ms as the usual ceiling. Measured from a same-region client, reality is a bit slower: our median sat just above their typical ceiling, and the p95 crossed a full second. Not bad, just not quite the brochure. For a hobby app behind a page load, an occasional extra half second on the first request after a quiet stretch is invisible. For a latency-sensitive API that gets sparse traffic, it is a real consideration.

**Supabase** free compute never naps; your project runs a dedicated instance around the clock, so there are no cold starts at all. Instead, after 7 days without activity, the whole project is **paused**. A paused project does not wake on connection. You log into the dashboard and restore it manually, which takes on the order of minutes, and until you do, every connection fails outright.

So the trade is: Neon costs you ~570 ms after every 5 quiet minutes but never needs you; Supabase costs you nothing while active but a manual rescue if you ever leave it alone for a week. For a demo you show twice a month, that 7-day pause is the difference between "works when the customer clicks" and "dead link in your portfolio."

## Branching: only one of them brings the data

Database branching is the headline feature of serverless Postgres, and on free tiers it is not a comparison, because only Neon has it there. We branched a project carrying 100,000 seeded rows, 10 times:

- Writable branch, parent's full dataset included, queryable: **2.2 s median, 3.2 s p95**.

One honest nuance the marketing skips: the copy-on-write storage operation itself is effectively instant, but a usable branch needs its own compute endpoint, and provisioning that is where the 2 seconds go. "Branches in milliseconds" is true at the storage layer and false at the connection string. What you actually get is a full writable copy of a database, with data, in about the time it takes to read this sentence, which is still excellent and still the same primitive that makes per-PR preview databases and agent test loops practical.

Supabase shipped Branching 2.0 in 2025 (Git optional, branch from the dashboard or API), but it requires a paid plan, each branch bills as its own compute, and branches copy schema and config without production data. We will measure it properly in the paid-tier article.

## The networking fine print nobody tells you

Three things we hit while building the harness that will absolutely hit you too:

**1. Supabase free direct connections are IPv6-only.** `db.<ref>.supabase.co` has no A record, only AAAA. If your client is IPv4-only, and that includes most CI runners, many cloud VMs by default, and most home ISPs, you cannot reach the direct host at all. You connect through Supavisor instead: session mode on port 5432, transaction mode on 6543. Both pooler paths carry IPv4. (A dedicated IPv4 address for direct connections exists as a paid add-on.) Neon's endpoints answer on both stacks.

**2. The Supabase pooler hostname varies per project.** Our first project landed on `aws-1-eu-central-1.pooler.supabase.com` while the documented examples reference `aws-0-...`. Both exist. Do not hardcode the pooler host from a tutorial; read your project's connection info from the dashboard or the Management API.

**3. Supabase database TLS chains to Supabase's own CA.** The certs are not signed by a public authority, so a client that verifies certificates (which should be all of them) needs [their root certificate](https://supabase.com/docs/guides/platform/ssl-enforcement). And if you use node-postgres, there is a trap inside the trap: when your connection string contains `sslmode=require`, `pg` silently ignores the `ssl` options object where you so carefully loaded that CA file, and verification fails with `self-signed certificate in certificate chain`. Drop `sslmode` from the URL and configure TLS exclusively through the `ssl` option. That one cost us an hour; it is yours for free.

None of these are dealbreakers. All three are the kind of thing you want to know on a Tuesday afternoon rather than discover during a Friday deploy.

## The limits, side by side

The measured behavior above, plus the caps that matter, as of June 2026:

| | Neon free | Supabase free |
| --- | --- | --- |
| Database storage | 0.5 GB per project | 500 MB |
| Projects | up to 100 | 2 active |
| Compute | 100 CU-hours/project/month, autoscaling to 2 CU | dedicated Nano instance, always on |
| Idle behavior | scales to zero after 5 min, auto-wakes in ~570 ms | project pauses after 7 days, manual restore |
| Branching | 10 branches/project, data included, ~2.2 s | not available |
| Restore window | 6 hours | none (daily backups start on Pro) |
| Extras | | Auth (50K MAU), storage (1 GB), edge functions (500K), realtime |
| Direct connection | IPv4 + IPv6 | IPv6 only (pooler for IPv4) |

## Which free tier should you pick?

The latency tie makes this refreshingly simple: pick on shape, not speed.

**Pick Neon's free tier when the database is the product.** Side projects with irregular traffic (auto-wake beats manual restore), anything that needs many databases (100 projects vs 2), CI and preview environments (branching with data is free-tier-exclusive), and agent or automation workflows that create and destroy databases programmatically.

**Pick Supabase's free tier when you are shipping an app, not a database.** The bundled auth, storage, realtime, and auto-generated APIs replace three or four other free tiers you would otherwise stitch together, and 50K monthly active users of free auth is genuinely hard to beat. Just put a calendar reminder somewhere if the project might go quiet for a week.

One forward-looking note: in June 2026 Neon announced S3-compatible object storage that branches with the database, serverless functions, and an AI gateway, all marked coming soon. If those ship, the bundled-stack gap narrows; we will rerun this comparison when they do.

And if you are still torn, the structural differences run deeper than the free tiers: we maintain a full [Neon vs Supabase comparison](https://devops-daily.com/comparisons/neon-vs-supabase) covering architecture, pricing models, PITR, and the paid features side by side.

## Where the series goes next

This post is part one. The free tiers are where you start, but the interesting differences show up when money and production traffic enter the picture, so we kept going:

- [Part two: operational benchmarks](https://devops-daily.com/posts/neon-vs-supabase-operational-benchmarks) times the operations that page you: compute resize (and its downtime), branching at scale, read replicas, point-in-time restore, and 200-connection stampedes, on the paid tiers.
- [Part three: scaling costs](https://devops-daily.com/posts/neon-vs-supabase-scaling-costs) prices the same application through five growth stages on both platforms, with an open source cost model you can rerun on your own workload.

## Run it yourself

Every number in this post is the median of committed raw samples. The [live dashboard](https://postgres-benchmarks.devops-daily.com/) tracks every benchmark session (the charts there update as new runs land, including a latency-over-time view), and the harness behind it is about 600 lines of TypeScript: [The-DevOps-Daily/serverless-postgres-benchmarks](https://github.com/The-DevOps-Daily/serverless-postgres-benchmarks). Bring your own API keys, `npm run bench`, and argue with our data instead of someone's vibes.

These benchmarks are fully open source, and contributions are welcome. If you spot something off in the methodology, know a fairer way to measure an operation, or get different numbers from another region or another month, open an issue or send a pull request to [the repo](https://github.com/The-DevOps-Daily/serverless-postgres-benchmarks). The whole point of publishing the harness and every raw sample is that this comparison can be checked, challenged, and improved by anyone, instead of being remembered as a vibe.
