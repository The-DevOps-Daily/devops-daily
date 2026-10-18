---
title: 'What Keeps a Neon Compute Awake, and What It Costs'
excerpt: 'We watched Neon computes through the API to see which clients stop scale to zero. Idle connections do not. An open transaction, a monitoring agent and a health check every 5 minutes do, and that health check keeps the smallest compute running 180 CU-hours a month.'
category:
  name: 'FinOps'
  slug: 'finops'
date: '2026-10-21'
publishedAt: '2026-10-21T09:00:00Z'
updatedAt: '2026-10-21T09:00:00Z'
readingTime: '18 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Neon
  - Postgres
  - Scale to Zero
  - Serverless
  - FinOps
  - Connection Pooling
  - Monitoring
sponsorCampaign: 'neon'
---

We pointed a health check at a Neon compute every 5 minutes, the same as Neon's default scale-to-zero timeout. The compute never suspended. In 40 minutes it took 8 checks, woke once for the first one, and stayed awake the whole time. Over 30 days that is 180 CU-hours at the smallest compute size: about $19 on the Launch plan, $40 on Scale, and on the Free plan it uses up the 100 CU-hour allowance by day 17.

The suspect most people reach for first, an idle connection left open by the app, does not keep a compute awake at all. We held idle connections, direct and pooled, and the compute suspended every time, about 15 seconds later than with nothing open. What it did do was cut those connections, including the pooled ones.

This post measures which ordinary clients keep a Neon compute running and which do not, how long a compute takes to suspend, what your app sees when it does, and what each pattern costs per month. Everything runs against real computes in one Neon project, watched through the Neon API, and the scripts are public so you can run them on your own account.

## TL;DR

- **Idle connections do not stop scale to zero.** With a 60-second timeout the compute suspended 66 to 75 seconds after the last query with nothing open, and 81 to 83 seconds with an idle direct or pooled connection held. The suspend dropped every held connection, pooled ones included.
- **An open transaction keeps it awake indefinitely.** A session left `idle in transaction`, direct or through the pooler, kept the compute up for the whole 6-minute window, 4 runs out of 4. Setting `idle_in_transaction_session_timeout = '30s'` let it suspend again.
- **A monitoring agent that queries every 20 seconds keeps it awake**, even when it only reads `pg_stat_database` on the `postgres` database.
- **A `LISTEN` connection does not keep it awake.** It is dropped on suspend, and a notification sent after the suspend never reached it (2 of 2 runs).
- **Health checks are the expensive one.** With the default 5-minute timeout, a check every 5 minutes kept the compute awake 100% of the time, because the suspend comes 12 to 27 seconds after the timeout. A check every 6 minutes still kept it awake 90.5% of the time, and every 10 minutes 52.2%.
- **A wake costs well under a second.** Checks that woke the compute had medians of 847 to 1,134 ms per run; checks on an awake compute took 308 to 339 ms, from a client 48 ms from the region.

## Prerequisites

- A Neon account and an API key (Account settings > API keys). The 60-second timeout used in part of the test needs a plan that lets you change it (Scale); everything with the default 5-minute timeout works on any plan.
- Node.js 22 or newer.
- Basic Postgres knowledge: sessions, transactions, `pg_stat_activity`.

## How Neon decides a compute is idle

Neon's documentation says a compute scales to zero after 5 minutes of inactivity, that you can change the timeout on paid plans, and that a connected logical replication subscriber prevents the suspend. It does not say what counts as activity.

The answer is in the compute's own code. Every compute runs `compute_ctl`, and its [activity monitor](https://github.com/neondatabase/neon/blob/f3a0e4f255/compute_tools/src/monitor.rs#L205-L350) checks Postgres every 500 ms. It reports the compute as active when:

1. Any client backend is in a state other than `idle`. That includes `active` (a query is running) and `idle in transaction` (a transaction is open but doing nothing).
2. Otherwise, the most recent `state_change` of the idle backends counts as the last activity ([the backend check](https://github.com/neondatabase/neon/blob/f3a0e4f255/compute_tools/src/monitor.rs#L444-L497)). An idle connection does not refresh it.
3. A logical replication walsender exists, an active logical replication subscription exists, or an autovacuum worker is running.

Backends of Neon's own `cloud_admin` role are left out. The control plane reads the last activity time and suspends the compute once the timeout has passed. This is the open-source code at commit `f3a0e4f255`; the version running in production may differ, which is one more reason to measure.

So the code predicts that an idle connection should not keep a compute awake, and an open transaction should. The rest of this post checks those predictions and puts numbers on them.

## How we measured

```github
https://github.com/The-DevOps-Daily/neon-keep-awake
```

One Neon project in `aws-eu-central-1` running Lakebase Postgres (PostgreSQL 17), every compute fixed at 0.25 CU so CU-hours are easy to read off. Each experiment gets its own branch, and each branch has its own compute, so experiments running side by side do not affect each other.

The compute's state comes from `GET /projects/{id}/endpoints/{id}`, which returns `current_state` and `suspended_at`. That is a control-plane call: it never touches the compute, so watching cannot keep it awake. The scripts read it every 2 to 3 seconds.

We checked the polling against Neon's own record. The project's operations log lists every `start_compute` and `suspend_compute` with a timestamp. For the health-check runs, the awake time from the log and the awake time from our polling differed by at most 0.5 percentage points.

That check caught one bug of ours. A poll taken a moment after a check woke the compute can still show the previous suspend, and our first summary ended the awake period there. The fix is to ignore a poll whose `suspended_at` is older than the wake, and even that went wrong at first: Neon's timestamps are whole seconds (`17:57:46Z`) and ours have milliseconds (`17:57:46.649Z`), and compared as strings `46Z` sorts after `46.649Z`. The bug cost two runs 3 to 4 seconds of awake time each, small but in the direction that makes the bill look smaller. The summary now compares timestamps as dates.

The scripts are split by stage, and each writes JSON lines stamped with a hash of the code that wrote it:

```terminal
{
  "title": "neon-keep-awake",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    { "cmd": "npm run setup", "output": "project odd-poetry-65586042, main branch br-icy-recipe-b91wrumq, compute ep-weathered-shadow-b91petoo" },
    { "comment": "stage 1: idle clients, 60 s timeout" },
    { "cmd": "npm run idle-clients", "output": "none #1: suspended at 2026-10-18T17:52:15Z (wake 694 ms)\nnone #2: suspended at 2026-10-18T17:53:30Z (wake 947 ms)\nnone #3: suspended at 2026-10-18T17:54:46Z (wake 907 ms)\nidle-direct #1: suspended at 2026-10-18T17:56:16Z (wake 815 ms)\nidle-direct #2: suspended at 2026-10-18T17:57:46Z (wake 805 ms)\nidle-direct #3: suspended at 2026-10-18T17:59:16Z (wake 793 ms)\nidle-pooled #1: suspended at 2026-10-18T18:00:45Z (wake 774 ms)\nidle-pooled #2: suspended at 2026-10-18T18:02:17Z (wake 787 ms)\nidle-pooled #3: suspended at 2026-10-18T18:03:46Z (wake 804 ms)\nidle-in-transaction-direct #1: still active after 360s (wake 815 ms)\nidle-in-transaction-direct #2: still active after 360s (wake 1020 ms)\nidle-in-transaction-pooled #1: still active after 360s (wake 940 ms)\nidle-in-transaction-pooled #2: still active after 360s (wake 792 ms)\nidle-in-transaction-with-timeout #1: suspended at 2026-10-18T18:34:31Z (wake 1080 ms)\nidle-in-transaction-with-timeout #2: suspended at 2026-10-18T18:36:16Z (wake 895 ms)\nlisten-direct #1: suspended at 2026-10-18T18:37:46Z (wake 876 ms)\nlisten-direct #2: suspended at 2026-10-18T18:39:16Z (wake 296 ms)\nmonitor-postgres-db-20s #1: still active after 360s (wake 263 ms)" }
  ]
}
```

The `wake` figure in that log is the time to connect and run `SELECT 1` at the start of each run. Most runs started right after a suspend, so it is usually a cold start. The last two started on a compute that something else had just woken, which is why they are near 300 ms.

## Idle connections do not keep it awake, and they do not survive the suspend

Stage 1 sets the suspend timeout to 60 seconds, wakes the compute, leaves one kind of client open, and times the suspend from our last query.

| What was left open                     | Runs | Suspended | Seconds from the last query to the suspend |
| -------------------------------------- | ---- | --------- | ------------------------------------------ |
| Nothing                                | 3    | 3 of 3    | 75, 68, 66                                 |
| One idle direct connection             | 3    | 3 of 3    | 82, 81, 83                                 |
| One idle pooled connection (PgBouncer) | 3    | 3 of 3    | 81, 83, 81                                 |
| A `LISTEN` connection                  | 2    | 2 of 2    | 83, 79                                     |

An idle connection did not stop the suspend. It did push it back by 10 to 15 seconds compared with nothing open, which three runs per row are enough to see but not to explain. Either way, a compute with a 60-second timeout went to sleep in under a minute and a half with connections still open.

Look at what happened to those connections. Five seconds after each suspend, the script ran `SELECT 1` on the connection it had held:

```text
idle direct:  'error' event: Connection terminated unexpectedly
              next query:    Client has encountered a connection error and is not queryable
idle pooled:  'error' event: Connection terminated unexpectedly
              next query:    Client has encountered a connection error and is not queryable
```

Every held connection was dead, 6 out of 6, pooled ones included, and the `LISTEN` connections in the last row died the same way. The pooler did not keep its client connections open across the suspend, so a pooled connection string does not protect your app from one.

For most apps the fix is to make sure a dropped connection costs one retry, not an error page. With `node-postgres`, use `Pool`, not a single long-lived `Client`, and handle the pool's `error` event. Without a listener, an idle client that loses its socket throws an unhandled error and can crash the process:

```javascript
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  // Close idle clients before the compute's suspend timeout closes them for you.
  idleTimeoutMillis: 30_000,
});

// An idle client whose socket closed (for example, the compute suspended).
// The pool removes it; this listener stops it from crashing the process.
pool.on('error', (err) => console.warn('idle client dropped:', err.message));

export async function query(sql, params) {
  try {
    return await pool.query(sql, params);
  } catch (err) {
    // One retry for a connection that died between checkout and use.
    if (/Connection terminated/.test(err.message)) return pool.query(sql, params);
    throw err;
  }
}
```

Only retry statements that are safe to run twice. A `SELECT` is; an `INSERT` without an idempotency key is not.

### LISTEN does not keep it awake either

A connection waiting on `LISTEN` sits in the `idle` state, so the monitor treats it like any idle connection. Both runs suspended on schedule. After each suspend the script opened a new connection, which woke the compute, and sent `NOTIFY keep_awake, 'after-suspend'`. The listener never got it, in either run, because its connection had been closed by the suspend.

If you use `LISTEN/NOTIFY` for cache invalidation or live updates on a compute that scales to zero, the listener must reconnect and run `LISTEN` again, and it must not assume it saw every notification sent while it was gone. Read the current state after each reconnect.

## An open transaction keeps it awake indefinitely

The monitor counts any backend that is not `idle` as activity, and a session that ran `BEGIN` and then stopped is `idle in transaction`. That is the classic leaked transaction: a request handler that checks out a client, starts a transaction, and returns on an error path without `COMMIT` or `ROLLBACK`.

| What was left open                                           | Runs | Suspended within 6 minutes                | After the transaction ended |
| ------------------------------------------------------------ | ---- | ----------------------------------------- | --------------------------- |
| `BEGIN` on a direct connection, then nothing                 | 2    | 0 of 2                                    | suspended 65 and 72 s later |
| `BEGIN` on a pooled connection, then nothing                 | 2    | 0 of 2                                    | suspended 68 and 72 s later |
| The same, with `idle_in_transaction_session_timeout = '30s'` | 2    | 2 of 2, 102 and 98 s after the last query |                             |

Through the pooler it behaves the same way. In transaction mode, PgBouncer pins a server connection to the client for as long as the transaction is open, so Postgres still sees a backend `idle in transaction`.

With the timeout set, Postgres ended the leaked session after 30 seconds, and the compute suspended about 70 seconds after that, the same delay as with nothing open. That setting is the one line worth adding to every Neon project that scales to zero, at the database or role level so it applies to every connection:

```sql
-- Ends sessions that hold a transaction open with nothing running.
ALTER DATABASE neondb SET idle_in_transaction_session_timeout = '60s';
```

We checked this form too, with `30s`: the database owner role that Neon creates is allowed to run it, a new connection reported `30s` without setting anything itself, and a transaction leaked on that connection no longer kept the compute up. It suspended 101 seconds after the last query (`scripts/07-database-timeout.mjs`).

Pick a value longer than any legitimate pause inside your transactions. A leaked transaction is a bug anyway: it holds locks and stops vacuum from cleaning up. On a compute that scales to zero, it also bills you for every hour it stays open.

## A monitoring agent keeps it awake

Monitoring agents such as `postgres_exporter` keep a connection open and run queries on a timer. We ran the same pattern: one connection to the `postgres` database, reading `pg_stat_database` every 20 seconds.

The compute stayed awake for the whole 6-minute window and suspended 63 seconds after the agent stopped. One run only, but it matches the code: a running query puts the backend in the `active` state, and that counts, whichever database the query runs in.

So a database scrape every 15 or 30 seconds keeps the compute awake around the clock. If you want monitoring and scale to zero together, scrape less often than the suspend timeout and accept gaps, or read compute state from the Neon API, which does not wake the compute. That is how every number in this post was collected.

## Health checks: the interval decides everything

Uptime monitors, load balancer probes and Kubernetes readiness probes often run a query to prove the database is reachable. Stage 2 runs exactly that: every N seconds, open a new pooled connection, run `SELECT 1`, close it. Each configuration gets its own compute, starts from a suspended state, and runs for 12 to 60 minutes while the script records when the compute is awake.

| Suspend timeout | Check every | Minutes | Checks | Checks that woke it | Awake | CU-hours per 30 days at 0.25 CU |
| --------------- | ----------- | ------- | ------ | ------------------- | ----- | ------------------------------- |
| 60 s            | 30 s        | 12      | 24     | 1                   | 100%  | 180                             |
| 60 s            | 90 s        | 15      | 10     | 10                  | 82.2% | 148                             |
| 60 s            | 120 s       | 16      | 8      | 8                   | 70.2% | 126                             |
| 60 s            | 180 s       | 18      | 6      | 6                   | 40.5% | 73                              |
| 300 s           | 60 s        | 30      | 31     | 1                   | 100%  | 180                             |
| 300 s           | 300 s       | 40      | 8      | 1                   | 100%  | 180                             |
| 300 s           | 360 s       | 42      | 7      | 7                   | 90.5% | 163                             |
| 300 s           | 420 s       | 42      | 6      | 6                   | 74.7% | 135                             |
| 300 s           | 600 s       | 60      | 7      | 7                   | 52.2% | 94                              |

"Checks that woke it" counts the checks that found the compute suspended. When that number is 1, only the very first check of the run had to wake the compute, and every later check found it already awake.

```chart
{
  "type": "bar",
  "title": "Share of time the compute was awake, by health-check interval",
  "unit": "%",
  "caption": "A new pooled connection and SELECT 1 every N seconds, one 0.25 CU compute per row, 12 to 60 minutes each. Measured by polling the Neon API, and matching Neon's operations log within 0.5 points. Data: results/summary.json in The-DevOps-Daily/neon-keep-awake.",
  "rows": [
    { "label": "60 s timeout, check every 30 s", "value": 100, "series": "60 s suspend timeout" },
    { "label": "60 s timeout, check every 90 s", "value": 82.2, "series": "60 s suspend timeout" },
    { "label": "60 s timeout, check every 120 s", "value": 70.2, "series": "60 s suspend timeout" },
    { "label": "60 s timeout, check every 180 s", "value": 40.5, "series": "60 s suspend timeout" },
    { "label": "5 min timeout, check every 1 min", "value": 100, "series": "5 min suspend timeout (default)" },
    { "label": "5 min timeout, check every 5 min", "value": 100, "series": "5 min suspend timeout (default)" },
    { "label": "5 min timeout, check every 6 min", "value": 90.5, "series": "5 min suspend timeout (default)" },
    { "label": "5 min timeout, check every 7 min", "value": 74.7, "series": "5 min suspend timeout (default)" },
    { "label": "5 min timeout, check every 10 min", "value": 52.2, "series": "5 min suspend timeout (default)" }
  ],
  "series": [
    { "name": "60 s suspend timeout", "color": "#38bdf8" },
    { "name": "5 min suspend timeout (default)", "color": "#f59e0b" }
  ]
}
```

The reason a 5-minute check beats a 5-minute timeout is the time between a wake and the suspend that follows it. Where the compute suspended between checks, we can time that cycle exactly:

- With the 60-second timeout, a compute woken by a single check suspended 71 to 87 seconds later (24 cycles, median 74 s).
- With the 5-minute timeout, it suspended 312 to 327 seconds later (19 cycles, median 314 s).

So with the default timeout, a check that arrives within 312 seconds of the previous one always finds the compute still up and starts the clock again. A check every 300 seconds lands at least 12 seconds before the suspend, every time.

Make the interval a little longer and the compute does get to sleep between checks, but not for long. Every check pays for a full cycle of about 5 minutes and 15 seconds, so every 6 minutes it was awake 90.5% of the time and every 7 minutes 74.7%. A check every 10 minutes woke the compute 7 times out of 7 and kept it up 313 seconds each time, for a query that took about a second. That is 52% of the hour, for a database that did nothing else.

### What a wake costs your users

Letting the compute sleep has a price too: the first request after a quiet stretch waits for the compute to start.

|                                                    | Median                  | Max      | Checks            |
| -------------------------------------------------- | ----------------------- | -------- | ----------------- |
| Check that found the compute awake                 | 308 to 339 ms per run   |          | 60 checks, 3 runs |
| Check that had to wake it                          | 847 to 1,134 ms per run | 1,878 ms | 47 wakes, 9 runs  |
| Plain TCP connect to the region (no TLS, no query) | 48 ms                   |          | 10                |

Every check opens a new TLS connection and authenticates, which is why even a warm check takes about 300 ms from a client 48 ms away. Waking the compute added about 0.5 to 0.8 seconds to the median, and the slowest wake took 1.9 seconds. None of the 107 checks failed. This matches what we saw in our [Neon free tier benchmarks](https://devops-daily.com/posts/neon-vs-supabase-free-tier-benchmarks), where cold starts had a median of 568 ms and a p95 of 1.06 s from a client in the same region.

For a health check, half a second does not matter. For the first user request of the morning it might, and that is the real trade-off you are making when you decide how long the compute may sleep.

## What it costs

Neon bills compute in CU-hours: compute size times the hours it runs. A compute that stays awake runs at its minimum size, so for a keep-awake pattern the cost is the minimum CU times the hours awake. With list prices from [Neon's pricing page](https://neon.com/pricing) ($0.106 per CU-hour on Launch, $0.222 on Scale) and the Free plan's 100 CU-hours per project per month:

| What keeps it awake                             | Awake                    | CU-hours per 30 days at 0.25 CU | Launch       | Scale        | Free plan                                       |
| ----------------------------------------------- | ------------------------ | ------------------------------- | ------------ | ------------ | ----------------------------------------------- |
| Health check every 1 or 5 min, default timeout  | 100%                     | 180                             | $19.08       | $39.96       | allowance used up after 400 hours, about day 17 |
| Health check every 6 min, default timeout       | 90.5%                    | 163                             | $17.27       | $36.16       | used up around day 19                           |
| Health check every 10 min, default timeout      | 52.2%                    | 94                              | $9.95        | $20.85       | fits, with 6 CU-hours left for real traffic     |
| Leaked transaction, monitoring agent every 20 s | 100% while it lasts      | up to 180                       | up to $19.08 | up to $39.96 | as above                                        |
| Idle connections, `LISTEN`                      | no effect on the suspend | 0                               | $0           | $0           | no effect                                       |

On the Free plan, Neon's plans page says that when a project runs out of CU-hours, its compute is suspended until the next billing period. A 5-minute health check on a Free project does not cost money; it takes the database down for the last 13 days of the month.

Two things make these numbers bigger in practice:

- **Minimum size.** We fixed every compute at 0.25 CU. If your compute's autoscaling minimum is 1 CU, multiply by four: an always-awake 1 CU compute is 720 CU-hours a month, $76 on Launch and $160 on Scale.
- **Branches.** Every branch with a compute has its own suspend timer. A preview environment per pull request, each with its own health check, keeps each preview branch's compute awake. Ten open previews with a 5-minute check are ten always-on computes.

## Does Neon wake it on its own?

A May 2026 thread in Neon's GitHub discussions, [neondatabase/neon#12900](https://github.com/neondatabase/neon/discussions/12900), describes Launch projects at 0.25 CU that each used about 6 CU-hours a day whatever their traffic, which is a compute awake around the clock. One reply blamed `check_availability`, an operation that Neon's control plane runs to [check that a compute can start on a branch](https://neon.com/docs/manage/operations). If that operation kept computes awake, scale to zero would not work for anyone, so we looked for it in two places.

- **Our test project.** Stage 3 watched the main branch's compute, which nothing ever connected to, for {{WATCH_HOURS}} hours after it suspended. It never woke, and the project's operations log shows no `check_availability` in that time.
- **An older project of ours.** Its compute suspended on 23 September and nothing used the project afterwards. Its operations log shows one `check_availability` on 24 September, 929 ms long, and no `start_compute` after it. The compute's `suspended_at` still reads 23 September. Two weeks later Neon archived the idle branch.

That matches Neon's own description. The operations page says the check verifies that a compute _can_ start, and a [2023 changelog entry](https://neon.com/docs/changelog/2023-08-28) says the availability checker runs on 0.25 CU computes and can use pre-started ones. In our data, Neon did not wake a suspended compute by itself. We cannot tell what kept the computes in that thread awake, but every pattern in this post can do it.

## What to change

1. **Keep the database out of liveness checks.** A liveness probe should check that the process is up, not that Postgres answers. If you must check the database, do it less often than the suspend timeout plus a margin: with the default 5-minute timeout, every 10 minutes or more.
2. **Check compute state through the API instead of with a query.** `GET /projects/{project_id}/endpoints/{endpoint_id}` returns `current_state` without waking anything. A monitor that alerts on the API's view of the compute, and only queries the database when a user is actually using it, keeps scale to zero working.
3. **Set `idle_in_transaction_session_timeout` at the database level.** It ends leaked transactions, which keep the compute awake indefinitely otherwise, and they are a bug anyway.
4. **Scrape metrics less often than the timeout, or not from the database.** A monitoring agent that queries every 15 to 30 seconds turns scale to zero off.
5. **Expect connections to drop.** Idle and `LISTEN` connections, direct or pooled, are closed when the compute suspends. Use a pool, handle its `error` event, retry safe queries once, and re-run `LISTEN` after a reconnect.
6. **If you want it awake, say so.** On paid plans you can raise the suspend timeout or turn scale to zero off. For a production database with steady traffic, that is often the right call, and it is cheaper to decide it on purpose than to pay for it by accident through a health check.

## What we could not conclude

- **Sample sizes are small.** Three runs for each idle-connection row, two for the transaction and `LISTEN` rows, one for the monitoring agent and one for the database-level timeout check. The results agree with the activity-monitor code, which is why we trust them, but the 10-to-15-second delay that idle connections added to the suspend is not explained.
- **One region, one compute size.** Everything ran in `aws-eu-central-1` at 0.25 CU. The time from a wake to the suspend (71 to 87 seconds with a 60-second timeout, 312 to 327 seconds with 5 minutes) may differ in other regions or under load. It also differed between computes in the same project: with the 5-minute timeout, one compute's cycles took 325 to 327 seconds every time while the others took 312 to 314. We do not know why.
- **Cost is computed, not billed.** Neon's per-branch usage counters (`active_time_seconds`, `compute_time_seconds`) stayed at 0 for our short-lived branches, so we could not check CU-hours against Neon's meter. We checked the awake time against Neon's operations log instead, and converted with list prices.
- **Health checks were on a precise schedule.** A real uptime service has some jitter. With the default timeout, one whose gaps sometimes go past 312 seconds might let the compute suspend now and then; we did not test that.
- **We did not test logical replication or autovacuum.** The code says both keep a compute awake, and Neon's docs say so for replication subscribers.

## Summary

Scale to zero on Neon works the way the compute's own activity monitor says it does. Idle connections, pooled or direct, and `LISTEN` connections do not hold a compute up; they are cut when it suspends. Anything that is not idle does hold it up: a leaked transaction, a monitoring agent, a health check that runs more often than about 312 seconds with the default timeout. That last one is the expensive surprise. It costs a 0.25 CU compute 180 CU-hours a month, which is about $19 on Launch, $40 on Scale, or two weeks of downtime on Free.

Run the scripts against your own project to see which of these you have:

```bash
git clone https://github.com/The-DevOps-Daily/neon-keep-awake
cd neon-keep-awake && cp .env.example .env   # add a Neon API key
npm install && npm run setup && npm run health-checks
```
