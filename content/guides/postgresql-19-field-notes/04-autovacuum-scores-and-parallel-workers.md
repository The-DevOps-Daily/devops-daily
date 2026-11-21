---
title: 'Autovacuum Priority Scores and Parallel Index Vacuuming'
navTitle: 'Autovacuum priority'
description: 'PostgreSQL 19 autovacuum processes the most urgent table first and can vacuum indexes in parallel. How scores work, the new view, and how to enable parallel workers.'
order: 4
---

**TLDR**: Two autovacuum changes in PostgreSQL 19. First, an autovacuum worker now sorts the tables it has to process by a score, most urgent first, and the new `pg_stat_autovacuum_scores` view shows those scores. This is on by default. Second, autovacuum can use parallel workers for the index phases of a vacuum. This is off by default (`autovacuum_max_parallel_workers = 0`). On a 30-million-row table with seven indexes, two or four parallel workers cut the elapsed time of a vacuum from about 40 seconds to about 21 to 24 seconds on 19 beta 3.

Autovacuum advice has piled up over many releases: lower the scale factors, raise the cost limit, watch for wraparound. One thing you could not do was see or control which table a worker would pick next. Through PostgreSQL 18, a worker collected the tables that crossed their thresholds and processed them in the order it found them, so a table close to wraparound could wait behind routine cleanups. And autovacuum always processed a table's indexes one after another in a single process, even when manual `VACUUM (PARALLEL n)` could do better.

## Prerequisites

- A PostgreSQL 19 server. For the log lines below, set `log_autovacuum_min_duration = 0`, and in 19 also `log_autoanalyze_min_duration = 0`, because autovacuum's `ANALYZE` runs now have their own logging setting.
- About 1.5 GB of free disk for the parallel test.

## Change 1: Autovacuum Picks Tables by Score

In 19 a worker builds its list of tables that need work and sorts it by score, highest first ([release notes](https://www.postgresql.org/docs/19/release-19.html), [vacuum settings](https://www.postgresql.org/docs/19/runtime-config-vacuum.html)). A table's score is the **highest of five weighted components**:

| Component             | Grows with                                       | Weight setting                             |
| --------------------- | ------------------------------------------------ | ------------------------------------------ |
| `vacuum_score`        | dead tuples compared with the vacuum threshold   | `autovacuum_vacuum_score_weight`           |
| `vacuum_insert_score` | inserts compared with the insert threshold       | `autovacuum_vacuum_insert_score_weight`    |
| `analyze_score`       | changed rows compared with the analyze threshold | `autovacuum_analyze_score_weight`          |
| `xid_score`           | transaction ID age                               | `autovacuum_freeze_score_weight`           |
| `mxid_score`          | multixact ID age                                 | `autovacuum_multixact_freeze_score_weight` |

For the first three, a component is a ratio times its weight. With the default weight of 1.0, a table exactly at its dead-tuple threshold has a vacuum component of 1, and a table fifty times past it has 50. The two age components are ratios too, but the documentation says they grow sharply once a table passes the failsafe ages, so tables near wraparound move to the top. All weights default to 1.0, accept 0 to 10, and take a reload. Setting all five to 0 gives you the old unsorted order.

### See the Scores

`pg_stat_autovacuum_scores` computes the scores on demand from the current statistics, so it can differ a little from what a worker saw a moment earlier. To try it, build three tables in states you can recognize, with autovacuum off so the scores stay put:

```sql
CREATE TABLE hot_updates (id int PRIMARY KEY, v int) WITH (autovacuum_enabled = false);
CREATE TABLE bulk_inserts (id int, v text) WITH (autovacuum_enabled = false);
CREATE TABLE needs_analyze (id int, v int) WITH (autovacuum_enabled = false);
INSERT INTO hot_updates SELECT g, 0 FROM generate_series(1, 100000) g;
UPDATE hot_updates SET v = 1 WHERE id % 2 = 0;
INSERT INTO bulk_inserts SELECT g, md5(g::text) FROM generate_series(1, 500000) g;
INSERT INTO needs_analyze SELECT g, g FROM generate_series(1, 50000) g;
DELETE FROM needs_analyze WHERE id % 4 = 0;
SELECT pg_stat_force_next_flush();
```

The last line makes the session send its statistics now. Without it, the view can miss the last changes for a short time; on RC1 we saw `needs_analyze` at 0.0 for that reason. Then, in a new session:

```sql
SELECT relname, round(score::numeric, 1) AS score,
       round(vacuum_score::numeric, 1) AS vac,
       round(vacuum_insert_score::numeric, 1) AS ins,
       round(analyze_score::numeric, 1) AS ana
FROM pg_stat_autovacuum_scores
WHERE relname IN ('hot_updates', 'bulk_inserts', 'needs_analyze')
ORDER BY score DESC;
```

On 19.0, with the same values as on beta 3 and RC1:

```text
    relname    |  score  |  vac   |  ins  |   ana
---------------+---------+--------+-------+---------
 bulk_inserts  | 10000.0 |    0.0 | 500.0 | 10000.0
 hot_updates   |  3000.0 | 1000.0 | 100.0 |  3000.0
 needs_analyze |  1250.0 |  250.0 |  50.0 |  1250.0
```

Read the numbers as threshold multiples. `bulk_inserts` is 10,000 times past its analyze threshold, because half a million rows arrived and it has never been analyzed. For a freshly loaded table, the most urgent work is statistics.

The view also has `xid_score`, `mxid_score`, and three flags: `do_vacuum`, `do_analyze` and `for_wraparound`.

### Change the Weights

To see the ranking by vacuum need alone, set the analyze weight to zero:

```sql
ALTER SYSTEM SET autovacuum_analyze_score_weight = 0;
SELECT pg_reload_conf();
```

Run the scores query again:

```text
    relname    | score  |  vac   |  ins  | ana
---------------+--------+--------+-------+-----
 hot_updates   | 1000.0 | 1000.0 | 100.0 | 0.0
 bulk_inserts  |  500.0 |    0.0 | 500.0 | 0.0
 needs_analyze |  250.0 |  250.0 |  50.0 | 0.0
```

The weights are cluster-wide policy, so treat this as a diagnostic, not a tuning step. Put the default back:

```sql
ALTER SYSTEM RESET autovacuum_analyze_score_weight;
SELECT pg_reload_conf();
```

### Watch the Order

Turn autovacuum back on for all three tables at once:

```sql
ALTER TABLE hot_updates SET (autovacuum_enabled = true);
ALTER TABLE bulk_inserts SET (autovacuum_enabled = true);
ALTER TABLE needs_analyze SET (autovacuum_enabled = true);
```

One worker (process 109) took all three in score order on 19.0, within 0.3 seconds:

```text
21:23:38.042 UTC [109] LOG:  automatic vacuum of table "lab.public.bulk_inserts": index scans: 0
21:23:38.208 UTC [109] LOG:  automatic analyze of table "lab.public.bulk_inserts"
21:23:38.264 UTC [109] LOG:  automatic vacuum of table "lab.public.hot_updates": index scans: 1
21:23:38.299 UTC [109] LOG:  automatic analyze of table "lab.public.hot_updates"
21:23:38.311 UTC [109] LOG:  automatic vacuum of table "lab.public.needs_analyze": index scans: 0
21:23:38.324 UTC [109] LOG:  automatic analyze of table "lab.public.needs_analyze"
```

These are completion lines. With one worker processing back to back, they show the order it chose. Afterwards all three scored 0.0 with `for_wraparound = f`.

### What It Means for Your Tuning

- **Per-table threshold settings still matter.** The components divide activity by the thresholds, so a lower `autovacuum_vacuum_scale_factor` on a table raises its score. What changed is that you can now see the effect.
- **Tuple churn can outscore mild age.** Our demo tables scored in the thousands on churn alone. Only past the failsafe ages do the age components jump.
- **Baseline before you alert.** The scores are normalized by thresholds, not by table size, so learn what your top scores look like on a normal day before you page on them. They measure trigger ratios, so keep your bloat queries too.
- **`for_wraparound = true` is a watch signal, not a page.** It marks a table as due for an anti-wraparound vacuum, which happens in routine operation too. Escalate when a flagged table's age keeps rising or its vacuum cannot finish.

## Change 2: Parallel Index Vacuuming in Autovacuum

Manual `VACUUM (PARALLEL n)` exists since PostgreSQL 13. In 19 an autovacuum worker can also use parallel workers, for the index vacuuming and index cleanup phases. The heap scan is never parallel. It is off by default:

```sql
ALTER SYSTEM SET autovacuum_max_parallel_workers = 2;
SELECT pg_reload_conf();
```

The table storage parameter `autovacuum_parallel_workers` decides which tables use it:

- **-1 (the default)**: inherit `autovacuum_max_parallel_workers`. Raising the global setting turns parallel autovacuum on for every eligible table at once.
- **0**: never use parallel workers for this table.
- **A positive number**: use at most that many.

So decide first between "on everywhere, with exclusions" and "only where I opt in" (set the global value, then set `0` everywhere except the chosen tables).

More limits apply. An index gets a parallel worker only if it is larger than `min_parallel_index_scan_size` (512 kB by default), at least two indexes must qualify, each qualifying index gets at most one worker, and the workers come from the shared `max_parallel_workers` pool (default 8), so an autovacuum burst competes with parallel queries.

### Check It on 19.0

We built two copies of a 3-million-row table with five indexes, turned on parallel autovacuum globally, and excluded one copy:

```sql
CREATE TABLE av_test (id bigint PRIMARY KEY, a int, b int, c int, s text) WITH (autovacuum_enabled = false);
INSERT INTO av_test SELECT g, g % 1000, g % 777, g % 555, md5(g::text) FROM generate_series(1, 3000000) g;
CREATE INDEX ON av_test (a); CREATE INDEX ON av_test (b); CREATE INDEX ON av_test (c); CREATE INDEX ON av_test (s);
CREATE TABLE av_off (LIKE av_test INCLUDING ALL) WITH (autovacuum_enabled = false);
INSERT INTO av_off SELECT * FROM av_test;
DELETE FROM av_test WHERE id % 4 = 0;
DELETE FROM av_off WHERE id % 4 = 0;
ALTER TABLE av_off SET (autovacuum_parallel_workers = 0);
ALTER TABLE av_test SET (autovacuum_enabled = true);
ALTER TABLE av_off SET (autovacuum_enabled = true);
```

The log shows the difference. `av_test` had no storage parameter, so it inherited the global value:

```text
LOG:  automatic vacuum of table "lab.public.av_off": index scans: 1
LOG:  automatic vacuum of table "lab.public.av_test": index scans: 1
	parallel workers: index vacuum: 2 planned, 2 launched in total
```

While a vacuum runs, `pg_stat_progress_vacuum` shows its phase and how many indexes are done:

```sql
SELECT pid, relid::regclass AS table_name, phase, indexes_total, indexes_processed
FROM pg_stat_progress_vacuum;
```

### What It Was Worth

We measured on 19 beta 3, on an 8 vCPU NVMe droplet with 16 GB of RAM, `shared_buffers = 4GB` and `autovacuum_vacuum_cost_delay = 0`, with a table built for the purpose: 30 million rows, 2.9 GB of heap, seven indexes with 3.9 GB in total. Before each run we deleted 3.75 million rows, warmed the cache with `pg_prewarm`, and sampled `pg_stat_progress_vacuum` every second:

| Run (in order)     | Index vacuuming | Total elapsed |
| ------------------ | --------------- | ------------- |
| Serial             | 39 s            | 43.6 s        |
| 4 parallel workers | 20 s            | 24.1 s        |
| Serial             | 34 s            | 37.2 s        |
| 2 parallel workers | 18 s            | 21.0 s        |

The heap phases took a few seconds; index vacuuming was about nine tenths of a serial run. That is the case parallel autovacuum is for. Compared with the serial run before it, each parallel run took about 0.55 times as long. On a smaller table where many rows had already been removed, four workers took 8.0 s against 18.4 s serial.

These are single runs. A stray `pgbench` from another test may have overlapped the first pair, and two more runs (four and six workers) overlapped a checkpoint that flushed 1.5 GB and were much slower, so we do not use them. Read the numbers as a direction, not a benchmark.

Two workers came close to four on seven indexes. That fits the rule that each index gets at most one worker: the phase cannot finish before the largest index is done. A table with one huge index and several small ones gains little.

### The Shared Cost Limit

We set `autovacuum_vacuum_cost_delay = 0` to measure the work, not the throttling. The default is 2 ms, so production autovacuum is throttled. In 19.0, the leader and its parallel workers share one cost limit. Before this change, which landed in November 2026 just before the release, each process slept only for its own cost, so a parallel vacuum could use several times the `vacuum_cost_limit` budget. The release notes now say that `VACUUM` with parallel workers and cost-based delay "might run slower than in previous releases". When the cost limit is what bounds a vacuum, more workers do not add budget, so expect less gain than in the table above unless you raise the limit too.

## What to Do When You Upgrade

1. **Ordering changes on day one, capacity does not.** Scores are on with weights of 1.0. If a table gets attention earlier than it did on 18, the view explains why.
2. **Add `pg_stat_autovacuum_scores` to monitoring** next to your bloat queries, and baseline the top scores before you alert.
3. **Keep your per-table thresholds.** They still raise a table's score.
4. **Turn on parallel vacuum on purpose.** Choose between global with exclusions and per-table opt-in before you touch `autovacuum_max_parallel_workers`. Start with tables whose indexes are as large as their heap, and watch `max_parallel_workers`, CPU, I/O, WAL volume and replica lag. Our runs did not measure the effect on other queries.
5. **Leave the weights alone** unless you have a specific reason and a test.

A vacuum makes space reusable but does not give it back to the operating system. For that, the next part covers [REPACK CONCURRENTLY](/guides/postgresql-19-field-notes/05-repack-concurrently).
