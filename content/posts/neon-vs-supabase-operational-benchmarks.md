---
title: 'Neon vs Supabase in Production: We Benchmarked the Operations That Page You at 3am'
excerpt: 'Two benchmark sessions against Neon and Supabase Pro measured what spec sheets never show: compute resizes cost 39 seconds of real downtime on one platform and zero on the other, read replicas differ by 23x, and branch creation has a tail you should know about.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-06-11'
publishedAt: '2026-06-11T16:00:00Z'
updatedAt: '2026-06-11T16:00:00Z'
readingTime: '12 min read'
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
  - sre
---

Free tiers are where you evaluate a database. Paid tiers are where you operate one, and operating means the unglamorous verbs: resize the compute because traffic doubled, add a read replica because the dashboard queries are hurting, branch the database for a preview environment, restore because someone ran the wrong migration. Vendor documentation describes these operations. It rarely tells you how long they take, and it almost never tells you what they cost in downtime.

So we measured them. This is part two of our Neon vs Supabase series ([part one covered the free tiers](https://devops-daily.com/posts/neon-vs-supabase-free-tier-benchmarks)), now on the plans you would actually run production on: Supabase Pro against the equivalent Neon tier. Same methodology as before: both platforms in AWS eu-central-1, timed from a client VM in the same metro, every operation run repeatedly across two separate benchmark sessions on different days, raw samples committed, and everything reproducible from [the open source harness](https://github.com/The-DevOps-Daily/serverless-postgres-benchmarks) with a [live dashboard](https://postgres-benchmarks.devops-daily.com/) tracking every session since.

## TLDR

- **Compute resize is the starkest difference we have ever measured between two managed databases.** Changing compute size on Supabase took 39 seconds of API time and caused 39 seconds of real SQL downtime per change, measured by probing the database every 250ms. The same operation on Neon: 2.4 seconds to apply, zero failed probes.
- **You also cannot resize Supabase twice in a row**: the platform throttles consecutive compute changes for minutes ("We are still processing addon changes, please try again in 3 minutes").
- **Read replicas are an architecture lesson in two numbers**: 8 seconds on Neon (a new compute attaches to existing shared storage) vs 181 seconds on Supabase (a full database clone), with Supabase also requiring Small compute or larger on the primary.
- **Branching held its free-tier shape**: a Neon branch arrives carrying the parent's 100k rows in 1.7s; a Supabase branch arrives schema-only in 6.2-6.7s. Supabase's API now has a with_data flag, but every attempt returned 406 "Failed to fetch latest physical backup" on a fresh project: data branches have infrastructure prerequisites.
- **Under connection stampedes the platforms are twins**: 50, 100, and 200 simultaneous cold connections produced near-identical wave times and zero refusals on both.

## How we measured

Every number below is the median of repeated runs (10 per operation per session for management operations, 5 waves per concurrency level), collected in two independent sessions on consecutive days. The two sessions agreed within single-digit percentages on every operation, which is the property that makes medians worth publishing. The client sat 1-2ms from both platforms. Resources were created fresh and torn down after every run.

One honest note on plans: the Supabase side ran on Pro ($25/month). The Neon side ran on a Scale-plan account, but every operation measured here (branching, resize, replicas, restore) behaves identically on Launch; plan tier changes quotas and retention windows, not the mechanics we timed.

## Compute resize: the 3am operation

You sized the database for launch traffic. Launch went well. Now you need the next compute size, and the question that matters is not "can the platform do it" but "what happens to my users while it does".

We resized each platform's compute up and back down, ten cycles per session, while a probe ran `select 1` against the database every 250 milliseconds. Two numbers per resize: how long until the management API reported the change applied, and how long SQL actually failed.

```chart
{
  "type": "bar",
  "title": "Compute resize: API apply time vs actual SQL outage (median)",
  "unit": "ms",
  "caption": "10 resize cycles per provider per session, alternating up and down. Outage measured by probing select 1 every 250ms through the change.",
  "rows": [
    {
      "label": "Neon, apply",
      "value": 2383.9,
      "series": "Neon"
    },
    {
      "label": "Neon, SQL outage",
      "value": 0,
      "series": "Neon"
    },
    {
      "label": "Supabase, apply",
      "value": 39218.3,
      "series": "Supabase"
    },
    {
      "label": "Supabase, SQL outage",
      "value": 38879.7,
      "series": "Supabase"
    }
  ]
}
```

Neon applies an autoscaling-limit change in 2.4 seconds, and across forty resize cycles in two sessions, **the probe never failed once**. The compute reconfigures behind the same endpoint without dropping the connection path. Supabase restarts the database to change compute: 39 seconds of apply time, and effectively all of it is real downtime; their docs say resizes are "usually applied with less than 2 minutes of downtime", and our measurements land comfortably inside that promise while still being 39 seconds of failed queries per change.

The second finding is subtler and bit us during the benchmark itself: **Supabase refuses back-to-back compute changes**. Issue two resizes in quick succession and the API returns "We are still processing addon changes, please try again in 3 minutes", and the project reports an unhealthy state between changes. For a production runbook this means a Supabase resize is a planned, serialized event with a maintenance-window mindset. On Neon it is closer to a config tweak.

If your workload's compute needs change often (and on serverless-adjacent platforms, that is the promise), this section is the comparison.

## Branching: same story, sharper edges

Part one covered free-tier branching; the paid tiers sharpen it. A Neon branch is a copy-on-write reference to the parent's storage: it arrives carrying all data. A Supabase branch is a freshly provisioned project that replays schema and config: it arrives empty of data, on Pro as on free.

```chart
{
  "type": "dots",
  "title": "Branch to queryable: Neon copies 100k rows, Supabase copies schema only",
  "unit": "ms",
  "caption": "Session 2 runs shown; session 1 medians within 8%. One session-1 Supabase branch took 146 seconds, see the text.",
  "series": [
    {
      "name": "Neon (with data)",
      "color": "#10b981",
      "samples": [
        1712.7,
        1746.6,
        1678.7,
        1659.5,
        1704.8,
        1704.2,
        1701.4,
        1705.1,
        1677.6,
        1690.8
      ]
    },
    {
      "name": "Supabase (schema only)",
      "color": "#38bdf8",
      "samples": [
        7213.8,
        6151.7,
        10287.8,
        6207,
        6842.3,
        6311.6,
        5946.2,
        6147.4,
        5977.8,
        5860.3
      ]
    }
  ]
}
```

Medians: 1.7 seconds for a Neon branch with 100,000 rows of parent data, 6.2-6.7 seconds for a Supabase schema-only branch. Both respectable. Two asterisks worth your attention though:

**The tail.** In session one, nine Supabase branches took 6-8 seconds and one took **146 seconds**, with nothing different about the request. Session two had no such outlier, which is exactly why we run multiple sessions. If your CI creates a branch per pull request, a 2.5-minute outlier is the kind of thing that makes a developer rerun the pipeline and file a flaky-infra ticket.

**The with_data flag.** Supabase's branch API accepts `with_data: true`, which on paper would close the data gap. In practice, every attempt on our freshly created projects failed with 406 "Failed to fetch latest physical backup": data branches require the project to already have physical backups, which fresh projects do not have and which normally arrives with the PITR add-on. For the create-test-destroy loop that makes branching valuable, data-included branches on Supabase have prerequisites that defeat the purpose today.

## Read replicas: attach vs clone

Adding a read replica is where the two architectures stop being abstract diagrams and start being your wait time.

```chart
{
  "type": "dots",
  "title": "Read replica to first query",
  "unit": "ms",
  "caption": "Neon attaches compute to shared storage; Supabase clones the database (Small compute minimum).",
  "series": [
    {
      "name": "Neon",
      "color": "#10b981",
      "samples": [
        8219.8,
        8171.9,
        8018.9,
        8018,
        8043.2,
        8047,
        7984.8,
        9149.2
      ]
    },
    {
      "name": "Supabase",
      "color": "#38bdf8",
      "samples": [
        183306.8,
        181922.1,
        174655.8,
        181425.2
      ]
    }
  ]
}
```

Neon: 8 seconds median to a replica answering queries. There is nothing to copy; a read-only compute attaches to the same shared storage as the primary, so replica creation is compute provisioning, full stop. It also means no replication lag in the classic sense and no extra storage bill.

Supabase: 181 seconds median, remarkably consistent (our session-one runs landed within a 2-second band of each other), because each replica is a physical clone of the database with WAL streaming, the way RDS would do it. Two operational prerequisites we hit: the primary must run Small compute or larger (the API rejects replicas on Micro with "Read replicas require a minimum size of small"), and replica disk bills at 1.25x the primary's size.

Neither approach is wrong. Clones isolate replicas from primary storage performance; shared storage makes replicas instant and cheap. But if your scaling playbook says "add a replica when read latency climbs", one platform executes that play in seconds and the other in minutes, and the minutes version also costs a compute-size bump if you started small.

## The connection stampede: a tie worth publishing

Serverless platforms fail in bursts: two hundred function invocations wake at once and all of them want a connection. We simulated exactly that through each platform's transaction pooler: N simultaneous cold connections, each performing connect, TLS, auth, one query, disconnect.

```chart
{
  "type": "bar",
  "title": "Connection stampede: N simultaneous cold connections through the pooler (median wave)",
  "unit": "ms",
  "caption": "5 waves per level per provider. Zero refused connections at any level on either platform.",
  "rows": [
    {
      "label": "Neon, 50 clients",
      "value": 313,
      "series": "Neon"
    },
    {
      "label": "Supabase, 50 clients",
      "value": 308,
      "series": "Supabase"
    },
    {
      "label": "Neon, 100 clients",
      "value": 610,
      "series": "Neon"
    },
    {
      "label": "Supabase, 100 clients",
      "value": 522,
      "series": "Supabase"
    },
    {
      "label": "Neon, 200 clients",
      "value": 1109,
      "series": "Neon"
    },
    {
      "label": "Supabase, 200 clients",
      "value": 1058,
      "series": "Supabase"
    }
  ]
}
```

Both platforms absorb a 200-connection stampede in about a second, scaling near-linearly from 50 to 200 clients, with **zero refused connections at any level on either platform**. Supabase's Supavisor was a hair faster at every level; the margin is noise. After the resize and replica sections, it would be easy to expect Neon to win everything; this is the result that says the comparison is about architecture, not quality. Both teams have built excellent poolers.

## Restore: the operation you hope never to time

We restored Neon branches to a point 60 seconds in the past, with 100k rows of data, eight runs per session: **5.6 to 6.9 seconds median** until the management API confirmed completion and SQL answered on the restored state. That is point-in-time recovery at interactive speed, and it comes included.

On Supabase, point-in-time recovery is a $100/month add-on (per 7-day retention window, Small compute minimum), so we documented it rather than benchmarked it; daily backups are included on Pro but a daily backup is a very different promise from PITR when the bad migration ran at 14:47. If sub-minute-granularity recovery matters to your operation, price the add-on into the comparison.

## What failed, and what it taught us

A benchmark that reports only clean numbers is hiding something. Ours hit three walls worth knowing about:

- Supabase's addon pipeline throttling (above) means resize benchmarks, and resize automation, must wait minutes between changes.
- Supabase Management API mutations sometimes return empty response bodies, and replica setup reports no status; readiness means polling the pooler config until a READ_REPLICA entry appears. Automation against these APIs needs more defensive plumbing than Neon's operations API, which returns explicit operation objects with terminal states.
- A long-running idle Postgres connection on either platform will emit asynchronous errors when the server restarts under it (compute resize, for instance). If your Node service holds connections through a Supabase resize, handle the `error` event on your clients or the restart will take your process down with it. Ask us how we know.

## Verdict

The free-tier conclusion was "pick on shape, not speed". The production-tier conclusion is sharper: **the operational gap is real, and it favors Neon almost everywhere it exists**. Resize without downtime vs a 39-second outage with a minutes-long cooldown; replicas in 8 seconds vs 3 minutes with compute prerequisites; branches with data vs without; included interactive PITR vs a $100/month add-on. The one place the platforms tie (connection stampedes) is the one place most teams assumed serverless Postgres would struggle, and neither does.

What this verdict does not say: Supabase Pro still bundles auth, storage, realtime, and edge functions that Neon does not have today (announced, not shipped), and part one's conclusion stands: teams shipping a v1 product buy real velocity with that bundle. But if the database is the load-bearing component of your operation and you expect to resize, replicate, branch, and occasionally restore it, the operational benchmarks have a clear winner.

Every number above links to raw committed samples, the [live dashboard](https://postgres-benchmarks.devops-daily.com/) updates with every benchmark session, and the [harness is open source](https://github.com/The-DevOps-Daily/serverless-postgres-benchmarks): if you see something off in the methodology or get different numbers, open an issue or a pull request, corrections are welcome and credited. Part three prices all of this against a growing application, including the cost crossover points nobody talks about.
