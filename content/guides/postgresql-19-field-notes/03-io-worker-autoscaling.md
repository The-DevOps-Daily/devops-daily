---
title: 'Async I/O Workers That Scale Themselves: io_min_workers and io_max_workers'
navTitle: 'Async I/O workers'
description: 'PostgreSQL 19 replaces io_workers with a pool that grows and shrinks between io_min_workers and io_max_workers. What the ceiling is worth, and when io_method = sync wins.'
order: 3
---

**TLDR**: PostgreSQL 18 added asynchronous I/O with a fixed pool of `io_workers` (default 3). PostgreSQL 19 removes `io_workers` and sizes the pool itself between `io_min_workers` (2) and `io_max_workers` (8). On a cold-cache scan, the 19 beta 3 pool with default bounds was 41% faster than 18 with three workers, and capping the pool at two workers made it slower than turning async I/O off. A config file that still sets `io_workers` stops 19 from starting, so remove it before the upgrade.

PostgreSQL 18 introduced asynchronous I/O and `io_method = worker`. With it came a number you had to choose: `io_workers`, the size of a pool of processes that every backend shares for its reads. Three was the default, and only a benchmark on your hardware could tell you if three was right.

PostgreSQL 19 replaces the number with a range ([release notes](https://www.postgresql.org/docs/19/release-19.html), [resource settings](https://www.postgresql.org/docs/19/runtime-config-resource.html#GUC-IO-MIN-WORKERS)):

| Setting                     | Default | What it does                                                         |
| --------------------------- | ------- | -------------------------------------------------------------------- |
| `io_min_workers`            | 2       | Workers that always run                                              |
| `io_max_workers`            | 8       | The most workers the pool may start                                  |
| `io_worker_launch_interval` | 100 ms  | The shortest time between two new workers, so growth is rate-limited |
| `io_worker_idle_timeout`    | 1 min   | How long a worker above the minimum may sit idle before it exits     |

All four take a reload, not a restart. `io_method` itself still needs a restart.

## Prerequisites

- A PostgreSQL 19 server with the default `io_method = worker`.
- Root on the Docker host if you want to drop the page cache for cold-cache tests.

## What the Pool Looks Like

On PostgreSQL 18 there is one number:

```sql
SELECT name, setting, boot_val FROM pg_settings WHERE name LIKE 'io\_%' ORDER BY 1;
```

```text
         name         | setting | boot_val
----------------------+---------+----------
 io_combine_limit     | 16      | 16
 io_max_combine_limit | 16      | 16
 io_max_concurrency   | 64      | -1
 io_method            | worker  | worker
 io_workers           | 3       | 3
```

On 19.0 the same query returns the range, and `io_workers` is gone:

```text
           name            | setting | boot_val
---------------------------+---------+----------
 io_combine_limit          | 16      | 16
 io_max_combine_limit      | 16      | 16
 io_max_concurrency        | 64      | -1
 io_max_workers            | 8       | 8
 io_method                 | worker  | worker
 io_min_workers            | 2       | 2
 io_worker_idle_timeout    | 60000   | 60000
 io_worker_launch_interval | 100     | 100
```

```sql
SHOW io_workers;
```

```text
ERROR:  unrecognized configuration parameter "io_workers"
```

An idle server runs the minimum. Count the workers with:

```sql
SELECT backend_type, count(*) FROM pg_stat_activity GROUP BY 1 ORDER BY 1;
```

On an idle 19.0 server this shows `io worker | 2`, where 18 shows 3. An idle cluster costs one process less, and a cluster that suddenly reads a lot from disk may use more than three.

## Watch It Grow and Shrink

We built a 744 MB table (the `facts` table from the [JIT part](/guides/postgresql-19-field-notes/01-jit-off-by-default), 10 million rows), then for each run restarted the container to empty `shared_buffers` and dropped the host page cache:

```bash
docker restart pg19
sync; echo 3 > /proc/sys/vm/drop_caches   # on the Docker host, as root
```

Then we ran a serial scan and counted `io worker` processes in `pg_stat_activity` every 100 ms while it ran:

```sql
SET max_parallel_workers_per_gather = 0;
SELECT count(*) FROM facts;
```

On 19.0, in a container with 2 CPUs:

| Configuration         | Scan time (2 runs) | I/O workers seen during the scan |
| --------------------- | ------------------ | -------------------------------- |
| Defaults (2 to 8)     | 887 ms, 1024 ms    | grew from 2 to 5 or 6            |
| `io_max_workers = 2`  | 1122 ms, 1589 ms   | 2                                |
| `io_max_workers = 16` | 746 ms, 804 ms     | grew from 2 to 6 or 7            |
| `io_method = sync`    | 1519 ms, 1398 ms   | none                             |

The pool grew within a fraction of a second, limited by the 100 ms launch interval. After the scan it shrank slowly: a check right after a scan counted 6 workers, and 70 seconds later there were 5. A worker above the minimum exits after `io_worker_idle_timeout`, one at a time, so a pool that grew to its ceiling takes several minutes to get back to the minimum.

Changing the ceiling is a reload:

```sql
ALTER SYSTEM SET io_max_workers = 2;
SELECT pg_reload_conf();
```

## The Measurement on a Bigger Table

On 19 beta 3, on an 8 vCPU droplet with SSD storage and `shared_buffers = 2GB`, we ran a cold-cache scan of a 2.2 GB table (30 million rows), one run per configuration, with the page cache dropped and the server restarted before each run:

| Configuration                                                        | Time    |
| -------------------------------------------------------------------- | ------- |
| PostgreSQL 18, `io_method = worker`, fixed 3 workers                 | 3241 ms |
| PostgreSQL 19, defaults (`io_min_workers = 2`, `io_max_workers = 8`) | 1918 ms |
| PostgreSQL 19, `io_max_workers = 2`                                  | 2920 ms |
| PostgreSQL 19, `io_max_workers = 16`                                 | 1812 ms |
| PostgreSQL 19, `io_method = sync`                                    | 2428 ms |

Both runs point the same way:

- **The ceiling matters.** Two workers cost about a second on beta 3 and 0.2 to 0.6 seconds on 19.0, compared with the defaults.
- **Raising it past 8 bought little.** 16 workers were about 100 ms faster on beta 3 and about 200 ms on 19.0. These are one or two runs each, so they do not show a reliable gain, and on 19.0 the pool only grew to 6 or 7 workers, so the higher ceiling was not even used.
- **The version comparison is not a clean test.** 19 with two workers still beat 18 with three. Other changes between the versions, and run-to-run noise, are in that number too. Read the 18 row as context.

## io_method = sync Is the Number to Remember

The easiest row to skip is the most useful one. On beta 3, with async I/O turned off, the scan was faster than with a two-worker pool (2428 ms against 2920 ms). On 19.0 the two were within run-to-run noise (1519 and 1398 ms for `sync`, 1122 and 1589 ms for two workers). A pool too small for the queue does not reliably beat having no queue at all, because handing each read to another process has a cost. If you run `io_method = worker` with a low ceiling because of a process or memory budget, measure `sync` before you assume async I/O helps.

`io_method` needs a restart:

```sql
ALTER SYSTEM SET io_method = 'sync';
```

The third choice, `io_uring`, needs a recent Linux kernel and a server built with liburing. The `postgres:19` image has liburing, but Docker's default seccomp profile blocks io_uring. Starting the image with `-c io_method=io_uring` failed on 19.0 with:

```text
FATAL:  could not setup io_uring queue: Operation not permitted
HINT:  Check if io_uring is disabled via /proc/sys/kernel/io_uring_disabled.
```

The server does not start in that case. Test `io_uring` on a host or VM, not in a default container, and keep a way to edit the configuration without a running server.

## When to Change the Bounds

The autoscaled pool removes one number you had to guess. It does not find the right concurrency for your storage, and the ceiling is still yours:

- **Shared storage.** Lowering `io_max_workers` limits how many reads this cluster runs at once. It does not limit anything else that uses the same disk.
- **Mostly idle clusters.** `io_min_workers = 1` gives back one process. On 19.0, after a restart with that setting, the server ran one I/O worker. The first burst may be a little slower while the pool grows.
- **Warm data.** Nothing here helps a query that reads from `shared_buffers`. Every number above is a cold-cache read. `EXPLAIN (ANALYZE, BUFFERS)` shows how many blocks were found in `shared_buffers` (`hit=`) and how many had to be read into it (`read=`). A `read` can still come from the operating system's page cache, so it is a buffer miss, not proof of a disk read:

```sql
EXPLAIN (ANALYZE, BUFFERS) SELECT count(*) FROM facts;
```

The pool is shared by the whole server. `io_max_workers` is a server-wide ceiling, not an allowance per backend, so twenty backends scanning at once still draw from the same eight workers.

## What to Do When You Upgrade

1. Remove `io_workers` from `postgresql.conf`, `postgresql.auto.conf` and any include file before you start 19. The [upgrade checklist post](/posts/postgresql-19-upgrade-checklist#h2-step-2-clean-up-the-configuration) has a query to find it.
2. If you had raised `io_workers` on 18, start with the default bounds on 19 and measure before you raise `io_max_workers`.
3. If you run with a low worker ceiling, benchmark `io_method = sync` as well.
4. Benchmark with a workload like yours, at the cache state and concurrency you expect.

The next part moves from reading data to cleaning it up: [autovacuum priority scores and parallel index vacuuming](/guides/postgresql-19-field-notes/04-autovacuum-scores-and-parallel-workers).
