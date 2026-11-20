---
title: 'PostgreSQL 19 Field Notes'
seoTitle: 'PostgreSQL 19 New Features, Tested on the 19.0 Release'
description: 'PostgreSQL 19 features tested on 19.0: REPACK CONCURRENTLY, ON CONFLICT DO SELECT, parallel autovacuum, COPY TO JSON, pg_plan_advice, WAIT FOR LSN and the new defaults.'
category:
  name: Databases
  slug: databases
publishedAt: '2026-11-20'
updatedAt: '2026-11-20'
author:
  name: DevOps Daily Team
  slug: devops-daily-team
tags:
  - PostgreSQL
  - PostgreSQL 19
  - Databases
  - Performance
  - Replication
  - DevOps
---

PostgreSQL 19.0 came out on 19 November 2026. The release notes list each feature in a paragraph or two. They do not tell you what a feature costs on a real table, which rule stops it from working the first time, or which part of your runbook it changes. This guide does. We tested eleven PostgreSQL 19 features on beta and release candidate builds over three months, measured the ones where speed or locking matters, and then ran every SQL statement and command in the guide again on the 19.0 release.

Each part covers one feature. It explains what changed, shows it working on a small lab you can build with Docker, gives the numbers we measured, and ends with what to do about it when you upgrade.

## What You'll Learn

The first three parts cover defaults that change the day you upgrade. The next five cover new commands and tools. The last three cover replication.

1. **[JIT Is Off by Default](/guides/postgresql-19-field-notes/01-jit-off-by-default)**: what JIT was worth on an analytics query, and how to turn it back on for one role or one transaction.
2. **[LZ4 TOAST Compression by Default](/guides/postgresql-19-field-notes/02-lz4-toast-compression)**: what the new default saves, and why `VACUUM FULL`, `CLUSTER` and `REPACK` do not convert your old pglz values.
3. **[Async I/O Workers That Scale Themselves](/guides/postgresql-19-field-notes/03-io-worker-autoscaling)**: `io_min_workers` and `io_max_workers` replace `io_workers`, and when `io_method = sync` is the faster choice.
4. **[Autovacuum Priority Scores and Parallel Index Vacuuming](/guides/postgresql-19-field-notes/04-autovacuum-scores-and-parallel-workers)**: how autovacuum now picks the most urgent table first, the `pg_stat_autovacuum_scores` view, and parallel workers for big indexes.
5. **[REPACK CONCURRENTLY](/guides/postgresql-19-field-notes/05-repack-concurrently)**: shrink a bloated table while it stays readable and writable, and measure the short exclusive lock at the end.
6. **[ON CONFLICT DO SELECT](/guides/postgresql-19-field-notes/06-on-conflict-do-select)**: get-or-create in one statement, without the dead tuples of a no-op upsert or the empty result of the CTE pattern.
7. **[COPY TO JSON](/guides/postgresql-19-field-notes/07-copy-to-json)**: native JSON exports, where they differ from `row_to_json`, and how to feed them to jq and DuckDB.
8. **[pg_plan_advice](/guides/postgresql-19-field-notes/08-pg-plan-advice)**: capture the planner's decisions as text and use them to hold a plan in place while you fix the statistics.
9. **[Logical Decoding Without a Restart](/guides/postgresql-19-field-notes/09-logical-decoding-without-restart)**: start change data capture on a server that runs at `wal_level = replica`.
10. **[Sequence Replication and Safe Failover](/guides/postgresql-19-field-notes/10-sequence-replication)**: replicate sequence values with logical replication, and the refresh step your cutover needs.
11. **[Read-Your-Writes on Standbys with WAIT FOR LSN](/guides/postgresql-19-field-notes/11-wait-for-lsn)**: let a read on a standby wait until it can see the user's last write.

## Who This Guide Is For

- DevOps engineers and DBAs who plan a PostgreSQL 19 upgrade and want to know what changes in production.
- Developers who want to use the new SQL features and need to know their limits first.
- Anyone who wants to try PostgreSQL 19 on a laptop before reading the release notes in full.

You should know basic SQL and `psql`. If you are new to PostgreSQL, start with our [Introduction to PostgreSQL](/guides/introduction-to-postgres) guide. If you are planning the upgrade itself, read [PostgreSQL 19 Is Out: What to Check Before You Upgrade](/posts/postgresql-19-upgrade-checklist) first: it covers the changes that block `pg_upgrade` or stop the new server from starting. This guide covers what you get after the upgrade.

## How We Tested

We wrote the first versions of these parts on PostgreSQL 19 beta 3 in August and September 2026, and kept them up to date through beta 4, RC1 and RC2. The features that are about speed or locks were measured on beta 3, most of them on a DigitalOcean droplet with 8 vCPUs, 16 GB of RAM and NVMe storage, some in a Docker container limited to 1.5 CPUs. Each part says which build and machine a number comes from.

Four features that were in the betas were removed before the release: SQL/PGQ property graphs, `ALTER TABLE ... SPLIT PARTITION` and `MERGE PARTITIONS`, `UPDATE`/`DELETE ... FOR PORTION OF`, and online enabling of data checksums. None of the parts below depends on them. Our post on [why PostgreSQL 19 was delayed](/posts/postgres-19-delay-pulled-features) explains what happened.

On 20 November 2026 we checked every part against the `REL_19_0` tag: the [release notes](https://www.postgresql.org/docs/19/release-19.html), the setting names and defaults in `guc_parameters.dat`, and the grammar. Then we ran the SQL statements and shell commands of every part on the official `postgres:19` Docker image (PostgreSQL 19.0, Debian build), mostly in containers limited to 2 CPUs and 3 GB of memory. Steps that need two sessions or two servers ran from a small test script that follows the order in the text. Where that run gave different output or a new number, the part shows the 19.0 result. Timings from that run are small-scale checks, and each part says so.

## Set Up a Lab

Every part works on a stock PostgreSQL 19 server. The quickest way to get one is the official Docker image:

```bash
docker run -d --name pg19 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=lab \
  postgres:19
until docker exec pg19 pg_isready -h localhost -q; do sleep 1; done   # first start runs initdb
docker exec -it pg19 psql -U postgres -d lab
```

```sql
SELECT version();
```

```text
                                                      version
--------------------------------------------------------------------------------------------------------------------
 PostgreSQL 19.0 (Debian 19.0-1.pgdg13+1) on x86_64-pc-linux-gnu, compiled by gcc (Debian 14.2.0-19) 14.2.0, 64-bit
(1 row)
```

The Debian build in the image includes everything the guide uses: LLVM for JIT, lz4, liburing, and the contrib modules `pg_plan_advice`, `pg_stash_advice`, `pgstattuple` and `pg_prewarm`. Some parts need more than one server, for example a standby or a subscriber. Those parts give the extra `docker` commands. Some parts compare against PostgreSQL 18, which you can start the same way with `postgres:18`.

If you would rather not run Docker, Neon has offered PostgreSQL 19 since release day: [create a project](https://neon.com/docs/manage/projects#create-a-project) and pick 19 as the Postgres version. A new major version means a new project, so load a copy of your schema into it, and use a [branch](https://neon.com/docs/introduction/branching) of that project for each experiment that rewrites tables, so you can throw the result away.

Start with [JIT Is Off by Default](/guides/postgresql-19-field-notes/01-jit-off-by-default), or jump to the feature you need.
