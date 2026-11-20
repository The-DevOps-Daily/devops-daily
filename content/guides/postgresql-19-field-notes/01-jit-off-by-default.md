---
title: 'JIT Is Off by Default: What It Costs and How to Turn It Back On'
description: 'PostgreSQL 19 sets jit = off. What JIT was worth on an analytics query, which queries lose with it, and how to enable it per role, session or transaction.'
order: 1
---

**TLDR**: PostgreSQL 19 changes the default of `jit` from `on` to `off`. On our 30-million-row analytics query, JIT saved 8% on 19 beta 3. On a 10-million-row copy on 19.0 with 2 CPUs, the difference was smaller than the noise between runs. Most applications lose nothing with the new default. If you run reports, measure one with JIT on and off, then enable it for the reporting role, not for the whole cluster.

`jit = on` has been the default since PostgreSQL 12. JIT (just-in-time compilation) compiles parts of a query, such as expressions and tuple deforming, into machine code with LLVM. The planner decides to use it when the estimated cost of a query is above `jit_above_cost`. The problem is that this decision uses the cost estimate, not the real run time. A query with a bad row estimate can cross the threshold, spend tens of milliseconds compiling, and then run for two milliseconds. A plan that was fine yesterday becomes slow today because an estimate moved.

PostgreSQL 19 turns JIT off by default ([release notes](https://www.postgresql.org/docs/19/release-19.html#RELEASE-19-MIGRATION), [`jit` setting](https://www.postgresql.org/docs/19/runtime-config-query.html#GUC-JIT)). This part shows what that costs and how to turn it back on where it helps.

## Prerequisites

- A PostgreSQL 19 server built with LLVM. The `postgres:19` Docker image has it. See [Set Up a Lab](/guides/postgresql-19-field-notes#h2-set-up-a-lab).
- About 1 GB of free disk for the test table.

## Check What You Have

```sql
SHOW jit;
SHOW jit_provider;
SELECT pg_jit_available();
```

On a stock 19.0 server:

```text
 jit
-----
 off

 jit_provider
--------------
 llvmjit

 pg_jit_available
------------------
 f
```

`pg_jit_available()` returns false here even though the LLVM provider is installed. It returns false whenever `jit` is off. To check if the provider loads, turn JIT on first:

```sql
SET jit = on;
SELECT pg_jit_available();
```

```text
 pg_jit_available
------------------
 t
```

`SHOW jit_provider` only prints the configured name. It does not prove the library can load, so use the `SET` and `pg_jit_available()` pair when you check a new server.

## What JIT Was Worth on an Analytics Query

The test table is a fact table with a timestamp, a region and some numeric columns:

```sql
CREATE TABLE facts (
  id bigint, ts timestamptz, customer int, region text,
  amount numeric(12,2), qty int, discount numeric(5,4), flag boolean
);
INSERT INTO facts
SELECT g,
       now() - (g % 900) * interval '1 day',
       (g % 50000),
       (array['eu-west','eu-central','us-east','us-west','ap-south'])[1 + g % 5],
       ((g % 9973) / 7.0)::numeric(12,2),
       1 + (g % 17),
       ((g % 97) / 1000.0)::numeric(5,4),
       (g % 3 = 0)
FROM generate_series(1, 10000000) g;
VACUUM ANALYZE facts;
```

The query is the kind JIT is meant to help: five aggregates with arithmetic on numerics, a `FILTER` and a `CASE`, all evaluated for every row:

```sql
SELECT region,
       count(*) AS rows,
       sum(amount * qty * (1 - discount)) AS net,
       avg(amount) FILTER (WHERE flag) AS avg_flagged,
       max(amount * (1 + discount)) AS peak,
       sum(CASE WHEN qty > 8 THEN amount ELSE 0 END) AS bulk
FROM facts
WHERE ts > now() - interval '400 days'
GROUP BY region ORDER BY net DESC;
```

We first measured it on 19 beta 3 and 18 side by side, on an 8 vCPU droplet with `shared_buffers = 2GB` and the table at 30 million rows. Warm cache, best of three runs:

| Configuration                               | Time    |
| ------------------------------------------- | ------- |
| PostgreSQL 18, `jit = on` (its default)     | 5974 ms |
| PostgreSQL 18, `jit = off`                  | 6285 ms |
| PostgreSQL 19 beta 3, `jit = off` (default) | 6161 ms |
| PostgreSQL 19 beta 3, `jit = on`            | 5663 ms |

On 19, turning JIT on cut the time by 8.1%, from 6161 ms to 5663 ms. That is one query on one machine.

On 19.0 we ran the same query on the 10-million-row table above, in a container with 2 CPUs and `shared_buffers = 1GB`, three runs each, alternating:

| Run | `jit = off` | `jit = on` |
| --- | ----------- | ---------- |
| 1   | 3639 ms     | 3517 ms    |
| 2   | 3603 ms     | 3716 ms    |
| 3   | 4188 ms     | 3905 ms    |

Here the two ranges overlap, so this run does not show a gain or a loss. Neither measurement shows a large gain from JIT on this query. The new default gives up gains of this size to avoid the large losses on short queries with high estimates.

## Read the JIT Section in EXPLAIN

`EXPLAIN (ANALYZE)` prints a JIT section when compilation happened:

```sql
SET jit = on;
EXPLAIN (ANALYZE, BUFFERS)
SELECT region,
       count(*) AS rows,
       sum(amount * qty * (1 - discount)) AS net,
       avg(amount) FILTER (WHERE flag) AS avg_flagged,
       max(amount * (1 + discount)) AS peak,
       sum(CASE WHEN qty > 8 THEN amount ELSE 0 END) AS bulk
FROM facts
WHERE ts > now() - interval '400 days'
GROUP BY region ORDER BY net DESC;
```

The end of the 19.0 output:

```text
 Planning Time: 0.680 ms
 JIT:
   Functions: 36
   Options: Inlining false, Optimization false, Expressions true, Deforming true
   Timing: Generation 4.106 ms (Deform 1.105 ms), Inlining 0.000 ms, Optimization 1.741 ms, Emission 39.325 ms, Total 45.172 ms
 Execution Time: 4220.293 ms
```

The estimated cost (about 229,000) is above `jit_above_cost` (100,000) but below `jit_inline_above_cost` and `jit_optimize_above_cost` (both 500,000), so PostgreSQL compiled expressions and deforming without inlining or optimization. The thresholds keep their old values in 19. Only the main switch changed.

Do not judge JIT from its share of the run time. 45 ms out of 4220 ms says what compiling cost, not what the compiled code saved. Time the whole statement with `jit` on and off and compare the totals.

Two traps when you look for the JIT section:

- **`COSTS OFF` hides it.** `EXPLAIN (ANALYZE, COSTS OFF)` with `jit = on` printed no JIT section on 19.0, even for a query that crossed the threshold. Keep costs on when you check JIT.
- **A cached generic plan keeps its JIT decision.** On 19.0 we prepared an aggregate over the table with `plan_cache_mode = force_generic_plan` while `jit` was off, then ran `SET jit = on` and executed it again with `EXPLAIN (ANALYZE)`: no JIT section. After `DEALLOCATE` and a new `PREPARE`, the same query showed `JIT: Functions: 36`. When you test, get a fresh plan instead of reusing a prepared statement.

## Which Queries Lose with JIT

Queries that gain from JIT are long and CPU-bound: they cross the cost threshold, and they spend enough time in the executor for compiled code to pay back the compile time. Wide scans that deform many columns from many rows also gain, even without heavy arithmetic.

Queries that lose are the ones with an inflated cost estimate, often from a bad row estimate on a join, that cross the threshold but touch few rows. Compiled code is not cached between executions, so such a query pays the compile time on every run. JIT can also lose on a query with good estimates when compiling costs more than the execution it speeds up.

Queries with an estimated cost below `jit_above_cost` see no change either way. Eligibility depends on the estimate, so a query that runs in 20 ms can still be eligible if its estimate is high.

To see which queries used JIT on your 18 cluster, and how much compile time they paid, the [upgrade checklist post](/posts/postgresql-19-upgrade-checklist#h3-defaults-that-change) has a `pg_stat_statements` query for that.

## Turn It Back On, Narrowest First

Pick the narrowest scope that covers your case. A cluster-wide setting cannot tell the query that JIT helps from the query it hurts, which is why the default changed.

**Per transaction**, for one known statement:

```sql
BEGIN;
SET LOCAL jit = on;   -- for the rest of this transaction
SELECT region,
       count(*) AS rows,
       sum(amount * qty * (1 - discount)) AS net,
       avg(amount) FILTER (WHERE flag) AS avg_flagged,
       max(amount * (1 + discount)) AS peak,
       sum(CASE WHEN qty > 8 THEN amount ELSE 0 END) AS bulk
FROM facts
WHERE ts > now() - interval '400 days'
GROUP BY region ORDER BY net DESC;
COMMIT;
```

`SET LOCAL` outside a transaction block does nothing. On 19.0 it prints `WARNING:  SET LOCAL can only be used in transaction blocks`, and `SHOW jit` still says `off`.

**Per session**, from a reporting tool or a batch job:

```sql
SET jit = on;
```

Set it before the statement is planned, for the reason in the previous section.

**Per role**, which fits most teams, because the reporting user and the application user want different answers:

```sql
CREATE ROLE analytics LOGIN PASSWORD 'analytics';
GRANT SELECT ON facts TO analytics;
ALTER ROLE analytics SET jit = on;
```

A new connection that logs in as `analytics` gets `jit = on`. Two things to know:

- Existing connections keep the old value, so a connection pool must open new connections before the change reaches them.
- A pool that logs in as another role and then runs `SET ROLE analytics` does not pick it up. On 19.0, `SET ROLE analytics` followed by `SHOW jit` printed `off`. Role settings apply at login.

**Per cluster**, if the server only runs analytics. Run these as a superuser, as two separate statements outside a transaction block:

```sql
ALTER SYSTEM SET jit = on;
SELECT pg_reload_conf();
```

After the reload, `pg_settings` shows `source = configuration file` for `jit`. To undo it:

```sql
ALTER SYSTEM RESET jit;
SELECT pg_reload_conf();
```

## What Has Not Changed

- **The thresholds.** `jit_above_cost` (100000), `jit_inline_above_cost` (500000) and `jit_optimize_above_cost` (500000) are the same as in 18.
- **The build requirement.** Without LLVM support, `jit = on` does nothing unless another provider is installed.
- **Explicit settings win.** If the configuration you bring to 19 says `jit = on`, or a role or database has it, the new default never reaches you. `pg_upgrade` does not copy `postgresql.conf` for you, so whatever you put in the new cluster's files is what applies.

## What to Do When You Upgrade

1. After the upgrade, run `SELECT name, setting, source FROM pg_settings WHERE name = 'jit';` to see the effective value and where it comes from.
2. If your workload is an application with short queries, do nothing. You may see fewer latency spikes.
3. If you run reports, take one representative report query, time it with `jit` on and off on 19, and enable JIT for the reporting role if it helps. Our 8% is from one query on one machine; yours will be different.

The next part covers the other default that changes how new data is stored: [LZ4 TOAST compression](/guides/postgresql-19-field-notes/02-lz4-toast-compression).
