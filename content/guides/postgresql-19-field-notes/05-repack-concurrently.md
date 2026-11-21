---
title: 'REPACK CONCURRENTLY: Shrink a Bloated Table Without a Long Lock'
navTitle: 'REPACK CONCURRENTLY'
description: 'PostgreSQL 19 adds REPACK and REPACK (CONCURRENTLY). Measured locks, disk, WAL and the writer stall at the end, the eligibility rules, and how it compares with pg_repack.'
order: 5
---

**TLDR**: `REPACK` rewrites a table to give free space back to the operating system. With `CONCURRENTLY`, the table stays readable and writable during the copy, and an `ACCESS EXCLUSIVE` lock is held only at the end, to apply the last changes and swap the files. On a 31 GiB table on 19 beta 3, the run took 5 minutes 47 seconds with no load and shrank the table to 18 GiB. Under eight busy writers, the end-of-run lock stalled them for about two minutes, so the final lock is the part you plan for. You need a primary key or replica identity index, disk for a second copy, and you can run only one `REPACK (CONCURRENTLY)` at a time in the whole cluster.

Plain `VACUUM` makes dead space reusable but cannot return it to the operating system, except for empty pages at the very end of the file. Before PostgreSQL 19, the built-in commands that do shrink a table (`VACUUM FULL`, `CLUSTER` and rewriting forms of `ALTER TABLE`) hold an `ACCESS EXCLUSIVE` lock for the whole run. On a table that takes minutes or hours to rewrite, nothing can read or write it for that long. For years the answer was the external `pg_repack` extension.

PostgreSQL 19 builds the capability in as the [`REPACK`](https://www.postgresql.org/docs/19/sql-repack.html) command ([release notes](https://www.postgresql.org/docs/19/release-19.html)).

## Prerequisites

- A PostgreSQL 19 server. The examples use `pgstattuple` to measure bloat, which is in the `postgres:19` image.
- Free disk for at least the size of the table plus its indexes.
- `MAINTAIN` privilege on the table (the owner and superusers have it).

## What REPACK Does

```sql
REPACK orders;                  -- like VACUUM FULL: ACCESS EXCLUSIVE for the whole run
REPACK (CONCURRENTLY) orders;   -- table stays usable until the final swap
REPACK orders USING INDEX orders_pkey;   -- like CLUSTER: rewrite in index order
```

Plain `REPACK` behaves like the old commands. `REPACK (CONCURRENTLY)` works like this:

1. It builds a new copy of the table and its indexes while the old one stays in use, holding only a `SHARE UPDATE EXCLUSIVE` lock, the same level as `VACUUM`.
2. It captures changes made during the copy with logical decoding, through a temporary replication slot, and applies them to the new copy.
3. It takes an `ACCESS EXCLUSIVE` lock, applies the changes that arrived while it waited for that lock, and swaps the files.

`ACCESS EXCLUSIVE` conflicts with every other lock, so during step 3 readers wait too, not only writers. Other options are `VERBOSE` and `ANALYZE`.

## Build a Bloated Table

```sql
CREATE EXTENSION pgstattuple;
CREATE TABLE orders (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id int NOT NULL,
  status text NOT NULL,
  payload text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO orders (customer_id, status, payload)
SELECT g % 500000, (ARRAY['done', 'shipped', 'pending'])[1 + g % 3], repeat(md5(g::text), 8)
FROM generate_series(1, 3000000) g;
CREATE INDEX ON orders (customer_id);
CREATE INDEX ON orders (created_at);
DELETE FROM orders WHERE id % 5 IN (1, 3);
VACUUM orders;
SELECT pg_size_pretty(pg_table_size('orders')) AS table_size,
       pg_size_pretty(pg_total_relation_size('orders')) AS with_indexes,
       round(approx_free_percent::numeric, 1) AS free_pct
FROM pgstattuple_approx('orders');
```

```text
 table_size | with_indexes | free_pct
------------+--------------+----------
 938 MB     | 1054 MB      |     41.0
```

`VACUUM` cleaned up the deleted rows, but the file is the same size: 41% of it is free space in the middle.

## Run It and Watch the Locks

In one terminal, start a write load. Save this as `upd.sql`:

```text
\set id random(1, 3000000)
UPDATE orders SET status = 'touched' WHERE id = :id;
```

```bash
pgbench -U postgres -d lab -n -c 4 -j 2 -T 120 -P 1 -f upd.sql
```

In a second terminal, run the repack:

```sql
\timing on
REPACK (CONCURRENTLY) orders;
```

In a third, poll the locks and the progress view every half second:

```sql
SELECT (SELECT string_agg(DISTINCT mode, ',') FROM pg_locks
        WHERE relation = 'orders'::regclass AND granted
          AND pid IN (SELECT pid FROM pg_stat_progress_repack)) AS repack_locks,
       (SELECT count(*) FROM pg_locks
        WHERE relation = 'orders'::regclass AND NOT granted) AS waiters,
       (SELECT phase FROM pg_stat_progress_repack LIMIT 1) AS phase,
       (SELECT string_agg(slot_name, ',') FROM pg_replication_slots) AS slots;
```

On 19.0, in a 2-CPU container, the repack took 8.3 seconds and the table went from 938 MB to 586 MB (3% free). The poll showed each phase in turn, always with the weaker lock and no waiting session:

```text
 repack_locks             | waiters | phase             | slots
--------------------------+---------+-------------------+---------------
 ShareUpdateExclusiveLock |       0 | seq scanning heap | pg_repack_124
 ShareUpdateExclusiveLock |       0 | rebuilding index  | pg_repack_124
 ShareUpdateExclusiveLock |       0 | catch-up          | pg_repack_124
```

`pg_repack_124` is the temporary logical slot. Monitoring that alerts on unknown replication slots will see it, and like any slot it keeps WAL until the run ends.

The writers kept going, but slower: `pgbench` went from about 13,000 transactions per second to between 300 and 2,000 while the copy ran, and back to 13,000 a few seconds after. On two CPUs the copy and the four clients competed for the same cores. The final lock was too short for a half-second poll to catch.

## The Measurement on a Big Table

On 19 beta 3, on an 8 vCPU NVMe droplet with 16 GB of RAM (`shared_buffers = 4GB`, `max_wal_size = 16GB`, `maintenance_work_mem = 1GB`), we built the same table with 100 million rows and deleted 40% of them:

| Metric                  | Value                                 |
| ----------------------- | ------------------------------------- |
| Table before            | 31 GiB, 34 GiB with indexes, 41% free |
| Table after             | 18 GiB, 20 GiB with indexes           |
| Duration, no other load | 5 min 47 s                            |
| Extra disk at peak      | 21.2 GiB                              |
| WAL written             | 21 GiB                                |

While it ran we polled `pg_locks` every 10 seconds: every sample showed `ShareUpdateExclusiveLock` and nothing stronger. Three minutes in, a probe `UPDATE` by primary key took 51 ms and a `SELECT` on an indexed column 34 ms.

Plan for two costs:

- **Disk.** Our run without ordering used about the size of the compacted table plus indexes. The documentation asks for at least the table plus its indexes, plus up to the table size again for a sort when `USING INDEX` sorts. The old files are freed only after the swap.
- **WAL.** About the size of the new table. Standbys and WAL archives receive all of it. If you pay for cross-region traffic or have a small archive, scale this to your table.

## The Stall at the End

Then we ran the repack again on the compacted 18 GiB table while eight `pgbench` clients updated random rows. It took 12 minutes 8 seconds. For most of the run the writers kept working. At the end, all eight waited on the table for about two minutes:

```text
19:54:56 waiters_on_orders=0
19:54:58 waiters_on_orders=8
...
19:57:04 waiters_on_orders=8
19:57:06 waiters_on_orders=0
```

```text
progress: 611.0 s, 6063.9 tps, lat 1.318 ms stddev 1.440, 0 failed
progress: 621.0 s, 0.0 tps, lat 0.000 ms stddev 0.000, 0 failed
...
progress: 746.0 s, 0.0 tps, lat 0.000 ms stddev 0.000, 0 failed
progress: 747.0 s, 6706.7 tps, lat 154.127 ms stddev 4428.687, 0 failed
```

That is 126 seconds by the lock log and up to 135 seconds by the `pgbench` buckets. In the two minutes before it, the clients ran 4,500 to 7,400 updates per second, so the backlog to apply under the lock was large. On a 2 vCPU host with two clients the stall was at least 11 seconds.

What the stall covers, per the documentation: waiting for the `ACCESS EXCLUSIVE` lock (new writers queue behind the waiting lock request), applying the changes that arrived during that wait, and the swap. Changes from the long copy phase are applied before the lock is requested, so a long copy does not mean a long lock. The documentation counts the wait for the lock as part of the `catch-up` phase, so a long `catch-up` in `pg_stat_progress_repack` can be lock waiting.

What makes the stall longer: a high write rate at the end, and anything that delays the lock, such as a long transaction that holds a lock on the table. Our logs show when writers started and stopped waiting, not how the two minutes split between those parts.

### Bound the Wait with lock_timeout

`lock_timeout` limits how long the repack waits for its final lock, and so how long it queues other sessions behind it. We tested it on 19.0. One session opened a transaction and read one row, which holds an `ACCESS SHARE` lock until commit:

```sql
BEGIN;
SELECT count(*) FROM orders WHERE id = 10;
-- keep the transaction open
```

A second session ran the repack with a timeout:

```sql
SET lock_timeout = '5s';
REPACK (CONCURRENTLY) orders;
SELECT pg_size_pretty(pg_table_size('orders'));
```

```text
ERROR:  canceling statement due to lock timeout
CONTEXT:  waiting for AccessExclusiveLock on relation 16433 of database 16384
```

It failed after 12 seconds: about 7 seconds of copying and 5 seconds of waiting. The table was still 482 MB, the old copy stayed in place, and the temporary slot was gone. So `lock_timeout` turns a long stall into a failed run that you can retry. It does not limit the catch-up and swap once the lock is granted. Keep long transactions away from the table, and schedule the run when writes are low.

## Eligibility Rules

`REPACK (CONCURRENTLY)` depends on logical decoding, which brings rules `VACUUM FULL` never had. All of these errors are from 19.0:

```sql
CREATE TABLE nopk (a int);
INSERT INTO nopk SELECT generate_series(1, 1000);
REPACK (CONCURRENTLY) nopk;
```

```text
ERROR:  cannot execute REPACK (CONCURRENTLY) on relation "nopk"
DETAIL:  Relation "nopk" has no identity index.
```

- **It needs a primary key or a replica identity index.** Append-only event and staging tables, which are often the ones that bloat, may not have one. Add one before you need it.
- **Unlogged tables are rejected**: `DETAIL:  This operation is only supported for permanent relations.`
- **Partitioned tables are rejected**: `ERROR:  REPACK (CONCURRENTLY) is not supported for partitioned tables` with `HINT:  Consider running the command on individual partitions.` Plain `REPACK` on a partitioned table works and repacks each partition.
- **No transaction blocks**: `ERROR:  REPACK (CONCURRENTLY) cannot run inside a transaction block`. The same applies to `REPACK (ANALYZE)`.
- **No invalid indexes.** Any `REPACK`, concurrent or not, refuses a table with an invalid index, for example one left by a failed `CREATE INDEX CONCURRENTLY`:

```text
ERROR:  cannot execute REPACK on relation "dup"
DETAIL:  An invalid index cannot be processed correctly: "dup_v_key".
HINT:  Use DROP INDEX or REINDEX.
```

- **Heap tables only**, and not user catalog tables. If the replica identity index was dropped, it refuses the table instead of falling back to the primary key.
- **A limit on concurrent changes.** The documentation says the command fails if more than about 104 million rows are updated or deleted while it runs. The decoded changes go to temporary files, which count against `temp_file_limit`; in 19.0 the decoding worker uses the value from the `REPACK` session, so a superuser can raise it there with `SET temp_file_limit`.
- **An MVCC caveat.** A transaction with an older snapshot that first reads the table after the swap can see it as empty. A long `REPEATABLE READ` report that starts before the repack and reads the table after it is the case to look for. We did not reproduce this; it is from the [MVCC caveats page](https://www.postgresql.org/docs/19/mvcc-caveats.html).

### One at a Time in the Whole Cluster

Only one `REPACK (CONCURRENTLY)` runs at a time across all databases of a cluster. A change that would have allowed more was reverted before beta 1, and our post on [the PostgreSQL 19 delay](/posts/postgres-19-delay-pulled-features#h3-plan-repack-concurrently-one-table-at-a-time) has the history. `max_repack_replication_slots` (default 5) does not lift this limit, and the `REPACK` page does not mention it.

We tested it on 19.0 with two 2-million-row tables, `t1` and `t2`. A repack of `t1` alone took 3.0 seconds. Then we deleted more rows from `t1`, started `REPACK (CONCURRENTLY)` on `t1`, started a second one on `t2` half a second later, and sampled `pg_stat_activity` and `pg_stat_progress_repack`:

```text
 pid | query                     | wait_event_type | wait_event         | phase
-----+---------------------------+-----------------+--------------------+-------------------
 112 | REPACK (CONCURRENTLY) t1; | LWLock          | WALWrite           | seq scanning heap
 125 | REPACK (CONCURRENTLY) t2; | IPC             | RepackWorkerExport | initializing
```

The second one did not fail. It sat in the `initializing` phase, waiting on `RepackWorkerExport`, until the first was almost done, and then ran. The `t1` run took 2.1 seconds and the `t2` run 4.2 seconds, so `t2` spent about half its time waiting. So a second run queues behind the first instead of running next to it.

If you planned to repack several tables in parallel in one maintenance window, plan a queue instead.

## REPACK Compared with the Exclusive-Lock Options

On a 2 vCPU host on beta 3, with a smaller copy of `orders` and a single-row `SELECT` issued 5 seconds into each run:

| Command                 | Table before -> after     | Duration   | The `SELECT`     |
| ----------------------- | ------------------------- | ---------- | ---------------- |
| `VACUUM FULL`           | 3.69 GiB -> 2.44 GiB      | 53 s       | blocked for 48 s |
| `REPACK` (plain)        | 2.44 GiB -> 2.09 GiB      | 42 s       | blocked for 37 s |
| `REPACK (CONCURRENTLY)` | 31 GiB -> 18 GiB (8 vCPU) | 5 min 47 s | 34 ms            |

On 19.0 the same held at small scale: with a plain `REPACK` running, a `SELECT` with `lock_timeout = '3s'` failed with `canceling statement due to lock timeout` while waiting for `AccessShareLock`. With `VACUUM FULL` and plain `REPACK`, every reader and writer waits for the whole run. `CONCURRENTLY` trades that for a stall at the end, plus extra WAL, a replication slot and the rules above.

## What About pg_repack?

The extension does the same copy, catch-up and swap with a trigger and a log table instead of logical decoding. The built-in command needs no separate binary matched to your server version, adds no objects to your database, and reports progress in `pg_stat_progress_repack`.

The extension still has options the command lacks: rebuild only the indexes (`--only-indexes`, `--index`), build indexes in parallel (`--jobs`), order by any columns (`--order-by`), and after `--wait-timeout` it cancels conflicting sessions unless you pass `--no-kill-backend`. `REPACK` waits like any other lock request. At the time of writing, the latest tagged pg_repack release is 1.5.3, which came out before PostgreSQL 19, so check the project for 19 support before you plan around it. List the options your current jobs use before you switch them. If you also run online schema changes, the [zero-downtime Postgres migrations checklist](/checklists/zero-downtime-postgres-migrations) covers the lock rules for those.

## Checklist Before a Production Run

- **Disk**: free space for at least the table plus its indexes, more with `USING INDEX`.
- **WAL**: about the size of the new table, sent to every standby and archive.
- **Locks**: `SHARE UPDATE EXCLUSIVE` during the copy, one `ACCESS EXCLUSIVE` at the end that blocks reads and writes. Run it when writes are low, keep long transactions away, and set `lock_timeout` so a blocked run fails instead of queueing everyone.
- **Eligibility**: identity index, no invalid indexes, not partitioned or unlogged, one concurrent run per cluster.
- **Long snapshots**: check for long `REPEATABLE READ` jobs that could read the table after the swap.
- **Rehearse** on a copy with a realistic write load, and measure the stall there.

REPACK also does not convert old pglz TOAST values, as the [LZ4 part](/guides/postgresql-19-field-notes/02-lz4-toast-compression) showed. The next part moves to application SQL: [ON CONFLICT DO SELECT](/guides/postgresql-19-field-notes/06-on-conflict-do-select).
