---
title: 'pg_plan_advice: Hold a Query Plan Without Changing the SQL'
navTitle: 'pg_plan_advice'
description: 'PostgreSQL 19 ships pg_plan_advice and pg_stash_advice. Capture the planner decisions as text, apply them per session or by query ID, and avoid the setup traps.'
order: 8
---

**TLDR**: The new `pg_plan_advice` module prints the planner's decisions (join order, join methods, scans, parallelism) as a short text, and lets you feed that text back to steer the planner. `pg_stash_advice` stores advice by query identifier so that every session gets it without an SQL change. On 19 beta 3, hash-join advice cut a query that had flipped to a bad nested loop from 10.9 s to 6.5 s while the statistics were still stale. On 19.0 the same kind of advice made a healthy query slower, which is the main lesson: advice is a tool for an incident, checked with `EXPLAIN ANALYZE`, not a setting you leave in place.

PostgreSQL has never shipped query hints. The project's position, recorded on the [community wiki](https://wiki.postgresql.org/wiki/OptimizerHintsDiscussion), is that hints freeze one moment's workaround into application SQL and hide the statistics problem underneath. PostgreSQL 19 ships something close in two contrib modules ([release notes](https://www.postgresql.org/docs/19/release-19.html)): [`pg_plan_advice`](https://www.postgresql.org/docs/19/pgplanadvice.html) generates and applies advice, and [`pg_stash_advice`](https://www.postgresql.org/docs/19/pgstashadvice.html) applies stored advice across sessions.

## Prerequisites

- A PostgreSQL 19 server where you can set `shared_preload_libraries` and restart.
- Superuser access for the stash functions, or `EXECUTE` on them granted by a superuser.

With Docker, pass the setting on the command line:

```bash
docker run -d --name pg19 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=lab \
  postgres:19 -c shared_preload_libraries=pg_plan_advice,pg_stash_advice
```

On a server you manage, put it in `postgresql.conf` and restart:

```text
shared_preload_libraries = 'pg_plan_advice, pg_stash_advice'
```

You can also `LOAD 'pg_plan_advice'` in one session to try the first half of this part without a restart.

## Build the Lab

```sql
CREATE TABLE customers (customer_id int PRIMARY KEY, region text NOT NULL);
CREATE TABLE orders (
  order_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id int NOT NULL REFERENCES customers,
  created_at timestamptz NOT NULL
);
INSERT INTO customers
SELECT g, (ARRAY['eu', 'us', 'ap'])[g % 3 + 1] FROM generate_series(1, 500000) g;
INSERT INTO orders (customer_id, created_at)
SELECT (g % 500000) + 1, now() - interval '2 hours' - (g % 2592000) * interval '1 second'
FROM generate_series(1, 3000000) g;
CREATE INDEX orders_created_at_idx ON orders (created_at);
ANALYZE customers, orders;
```

## Generate Advice

The module adds a `PLAN_ADVICE` option to `EXPLAIN`:

```sql
EXPLAIN (PLAN_ADVICE, COSTS OFF)
SELECT c.region, count(*)
FROM orders o JOIN customers c USING (customer_id)
WHERE o.created_at > now() - interval '1 hour'
GROUP BY 1;
```

On 19.0:

```text
 GroupAggregate
   Group Key: c.region
   ->  Sort
         Sort Key: c.region
         ->  Nested Loop
               ->  Index Scan using orders_created_at_idx on orders o
                     Index Cond: (created_at > (now() - '01:00:00'::interval))
               ->  Index Scan using customers_pkey on customers c
                     Index Cond: (customer_id = o.customer_id)
 Generated Plan Advice:
   JOIN_ORDER(o c)
   NESTED_LOOP_PLAIN(c)
   INDEX_SCAN(o public.orders_created_at_idx c public.customers_pkey)
   NO_GATHER(o c)
```

No orders are in the last hour, so the planner drives a nested loop from the timestamp index. For a 30-day window it picks a parallel hash join over sequential scans, and the advice says so:

```text
 Generated Plan Advice:
   JOIN_ORDER(o c)
   HASH_JOIN(c)
   SEQ_SCAN(o c)
   GATHER_MERGE((o c))
```

The advice covers join order, join methods, scan methods, parallelism, materialization, memoization and semijoin handling. It is not a full plan: aggregation strategy, for example, cannot be advised.

## Apply Advice in a Session

The `pg_plan_advice.advice` setting supplies advice when a query is planned:

```sql
SET pg_plan_advice.advice = 'JOIN_ORDER(c o) HASH_JOIN(o) SEQ_SCAN(c o)';
EXPLAIN (COSTS OFF)
SELECT c.region, count(*)
FROM orders o JOIN customers c USING (customer_id)
WHERE o.created_at > now() - interval '30 days'
GROUP BY 1;
```

`EXPLAIN` reports, per element, whether it applied:

```text
                     ->  Parallel Hash Join
                           Hash Cond: (c.customer_id = o.customer_id)
                           ->  Parallel Seq Scan on customers c
                           ->  Parallel Hash
                                 ->  Parallel Seq Scan on orders o
 Supplied Plan Advice:
   SEQ_SCAN(c) /* matched */
   SEQ_SCAN(o) /* matched */
   JOIN_ORDER(c o) /* matched */
   HASH_JOIN(o) /* matched */
```

The setting applies to every statement the session plans until you change it. With the same advice still set, the one-hour query also got a hash join over sequential scans instead of its nested loop. In a shared session, use `SET LOCAL` inside the transaction that runs the target query, or `RESET pg_plan_advice.advice` right after it.

Advice limits the planner to plans it already considers. It is not a command. An element can come back `matched`, `inapplicable`, `conflicting` or `failed`. To get failures in the log too, turn on `pg_plan_advice.feedback_warnings` (off by default). With advice that names an index that does not exist:

```sql
SET pg_plan_advice.feedback_warnings = on;
SET pg_plan_advice.advice = 'INDEX_SCAN(o public.orders_dropped_idx)';
EXPLAIN (COSTS OFF)
SELECT c.region, count(*)
FROM orders o JOIN customers c USING (customer_id)
WHERE o.created_at > now() - interval '1 hour'
GROUP BY 1;
RESET pg_plan_advice.advice;
```

```text
 Supplied Plan Advice:
   INDEX_SCAN(o public.orders_dropped_idx) /* matched, inapplicable, failed */

WARNING:  supplied plan advice was not enforced
DETAIL:  advice INDEX_SCAN(o public.orders_dropped_idx) feedback is "matched, inapplicable, failed"
```

Alert on that warning if you use advice in production: it tells you when a schema change has made an advice string stale. Per the documentation, advice that cannot be satisfied can leave the planner choosing among disabled plans, and the result can be worse than no advice, so look at the plan whenever an element fails.

## A Plan Flip, and What Advice Did About It

The incident this module is for: a plan that was right yesterday flips because the statistics are wrong today. To stage one, we inserted 2 million new orders in the last half hour with autovacuum off for the table and no `ANALYZE`:

```sql
ALTER TABLE orders SET (autovacuum_enabled = false);
INSERT INTO orders (customer_id, created_at)
SELECT (g % 500000) + 1, now() - (g % 1800) * interval '1 second'
FROM generate_series(1, 2000000) g;
```

**On 19 beta 3**, on a larger `orders` table in a 1.5-CPU container, the stale statistics made the planner pick a nested loop driven by the timestamp index: two million index probes into `customers`, finishing in 10,872 ms. With hash-join advice set in a dedicated session, the same query ran in 6,508 ms, 40% faster, with no change to the statistics or the application. One timing each.

**On 19.0**, on the lab above, the flip did not happen. The planner still estimated 7,614 rows for the last hour against 2,000,000 actual, but it chose a parallel hash join with a bitmap index scan anyway, and ran in 1.5 s. Forcing sequential scans with the same advice made it slower:

```sql
BEGIN;
SET LOCAL pg_plan_advice.advice = 'JOIN_ORDER(c o) HASH_JOIN(o) SEQ_SCAN(c o)';
EXPLAIN (ANALYZE)
SELECT c.region, count(*)
FROM orders o JOIN customers c USING (customer_id)
WHERE o.created_at > now() - interval '1 hour'
GROUP BY 1;
COMMIT;
```

| Plan                                   | Time, 3 runs        |
| -------------------------------------- | ------------------- |
| Planner's own choice, stale statistics | 1152, 1012, 1004 ms |
| With the advice                        | 1184, 1188, 1104 ms |

`EXPLAIN (ANALYZE)` put the advised plan at 2125 ms against 1507 ms for the planner's own. After `ANALYZE orders`, the planner chose a parallel hash join on its own and ran in 971 ms.

Both results are useful. Advice helps when you have confirmed that the planner's choice is the problem. It does not help, and can hurt, when you guess. The fix for stale statistics is still `ANALYZE`; advice holds the line while that happens. We did not test advice across major upgrades, and query identifiers are not guaranteed to be stable across major versions.

## Apply Advice to Every Session with pg_stash_advice

`SET` in one session does nothing for the application's other connections. `pg_stash_advice` stores advice strings in shared memory, keyed by query identifier, and applies them when any session plans that query. The recipe on 19.0:

```sql
CREATE EXTENSION pg_stash_advice;
SELECT pg_create_advice_stash('pinned');
EXPLAIN (VERBOSE, COSTS OFF)
SELECT c.region, count(*)
FROM orders o JOIN customers c USING (customer_id)
WHERE o.created_at > now() - interval '1 hour'
GROUP BY 1;
```

The last line of the `EXPLAIN (VERBOSE)` output is the identifier:

```text
 Query Identifier: 3080867309469276767
```

The identifier depends on the parse tree, including table OIDs, so yours will be a different number. Store the advice for it, then turn the stash on for the database:

```sql
SELECT pg_set_stashed_advice('pinned', 3080867309469276767,
  'JOIN_ORDER(c o) HASH_JOIN(o) SEQ_SCAN(c o)');
ALTER DATABASE lab SET pg_stash_advice.stash_name = 'pinned';
SELECT * FROM pg_get_advice_stash_contents('pinned');
```

```text
 stash_name |      query_id       |               advice_string
------------+---------------------+--------------------------------------------
 pinned     | 3080867309469276767 | JOIN_ORDER(c o) HASH_JOIN(o) SEQ_SCAN(c o)
```

A new session that runs the query, with no `SET`, now shows the `Supplied Plan Advice` block with every element `matched`. Things to know:

- **The stash name is the on switch.** `pg_stash_advice.stash_name` is empty by default, and an empty name means no stash applies. You can set it per database, per role or per session, which gives you a gradual rollout: one role first.
- **Query identifiers must be computed.** `compute_query_id = auto` (the default) is enough, because loading `pg_stash_advice` turns computation on.
- **Constants do not count.** The identifier ignores constants, so `interval '1 hour'` and `interval '7 days'` are the same query. On 19.0 the stash entry above also forced the hash join onto the 7-day query. One entry means the same advice for every value the application passes, even where the planner would choose differently. (Decisions the advice does not cover can still differ: the 7-day plan above used a different aggregation step.)
- **Stashes persist.** With `pg_stash_advice.persist = on` (the default), a background worker writes them to disk every `pg_stash_advice.persist_interval` seconds (30). After a container restart on 19.0, the entry was still there. For a short time after each start, while the worker loads the file, no stash is visible.
- **Changing a stash needs superuser**, or `EXECUTE` on the stash functions, which are revoked from `PUBLIC`.

### Cached Plans Do Not See New Advice

Advice is read when a query is planned. A prepared statement or a PL/pgSQL function that already has a cached plan keeps using it. On 19.0:

```sql
SET plan_cache_mode = force_generic_plan;
PREPARE recent AS SELECT c.region, count(*) FROM orders o JOIN customers c USING (customer_id) WHERE o.created_at > now() - interval '1 hour' GROUP BY 1;
EXPLAIN (COSTS OFF) EXECUTE recent;
SET pg_stash_advice.stash_name = 'pinned';
EXPLAIN (COSTS OFF) EXECUTE recent;
DISCARD PLANS;
EXPLAIN (COSTS OFF) EXECUTE recent;
```

The first two `EXPLAIN`s showed the same bitmap index scan plan: turning on the stash did not change the cached plan. After `DISCARD PLANS`, the prepared statement was planned again and got the stashed hash join with sequential scans. `DISCARD PLANS` works only in the session that runs it. With a connection pool, every pooled connection must run it or be replaced before a new stash entry reaches all of them.

### Remove an Entry When You Are Done

A stale entry keeps steering plans after the problem is fixed. `RESET pg_plan_advice.advice` does not touch the stash. Remove the entry explicitly:

```sql
SELECT pg_set_stashed_advice('pinned', 3080867309469276767, NULL);
SELECT pg_drop_advice_stash('pinned');
```

Review `pg_get_advice_stash_contents('pinned')` as part of change review, the same way you review migrations.

## The ALTER SYSTEM List Trap

`session_preload_libraries` and `shared_preload_libraries` are lists. `ALTER SYSTEM` with the whole list in one pair of quotes stores it as one library name:

```sql
ALTER SYSTEM SET session_preload_libraries = 'pg_plan_advice,pg_stash_advice';
SELECT pg_reload_conf();
```

On 19.0, every new connection after the reload failed:

```text
psql: error: connection to server on socket "/var/run/postgresql/.s.PGSQL.5432" failed: FATAL:  could not access file "pg_plan_advice,pg_stash_advice": No such file or directory
```

The session that was already open still worked, so it could fix the setting. Use list syntax, with each name quoted on its own:

```sql
ALTER SYSTEM SET session_preload_libraries = 'pg_plan_advice', 'pg_stash_advice';
SELECT pg_reload_conf();
```

New connections worked again. Keep one session open while you change preload settings. The same mistake in `shared_preload_libraries` is worse: it applies at server start, so the server does not come up until you edit `postgresql.auto.conf` by hand.

## Limits

- **Advice does not change estimates or costs.** The estimates that caused a bad plan are still wrong until `ANALYZE` runs.
- **Advice can be partly applied.** Read the feedback on every element.
- **Compared with `pg_hint_plan`** or `enable_*` switches, the difference is that the planner generates the advice from a plan you have seen, it is plain text you can review, and it reports per element whether it applied.

## What to Do When You Upgrade

1. Add `pg_plan_advice` and `pg_stash_advice` to `shared_preload_libraries` at the upgrade restart if you want them available in an incident. Loading them does nothing until advice is set.
2. Write a short runbook: capture `EXPLAIN (PLAN_ADVICE)` from the good plan, test the advice in one session with `EXPLAIN ANALYZE`, stash it, roll it out per role, run `DISCARD PLANS` or recycle pooled connections, and remove the entry after `ANALYZE` has fixed the estimate.
3. Alert on `supplied plan advice was not enforced` if you turn on `feedback_warnings`.

The next three parts cover replication, starting with [logical decoding without a restart](/guides/postgresql-19-field-notes/09-logical-decoding-without-restart).
