---
title: 'RDS Alternatives for Postgres, Measured: What You Pay, How You Branch, How You Upgrade'
excerpt: 'We priced the same three Postgres sizes on RDS and ten alternatives, timed branches and major version upgrades, and checked what each service does with your planner statistics. With a standby in the price, RDS sits in the middle of the pack; branching and upgrades are where the choice gets made.'
category:
  name: 'Cloud'
  slug: 'cloud'
date: '2026-11-27'
publishedAt: '2026-11-27T15:00:00Z'
updatedAt: '2026-11-27T15:00:00Z'
readingTime: '17 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Cloud
  - PostgreSQL
  - AWS
  - RDS
  - Databases
  - Neon
  - Supabase
  - FinOps
---

Teams leave RDS for three reasons: the bill, the time it takes to get a copy of production for a test, and the major version upgrade they keep putting off. We checked all three across RDS and ten alternatives. The first result surprised us. Once you compare plans that include a standby, RDS is not the expensive one. Google Cloud SQL, Crunchy Bridge, Azure and DigitalOcean all land within 10% of it at both sizes we priced with high availability. The services that are much cheaper are cheaper because they sell you one node.

The differences that do decide the choice are the other two. A Neon branch of a 1.6 GB database was queryable in 2.8 seconds, the same as a branch of a 0.16 GB one. On RDS, the same request is "restore a snapshot into a new instance". And a major version upgrade is four different procedures depending on where you run, with downtime that ranges from seconds to however long a dump and restore of your database takes.

This post has the prices at three sizes, the measured branch and upgrade times, and a table of what each provider does for branching, upgrades and free tiers, with links to their docs. Everything we measured is in a public repo you can run.

## TLDR

- **Price.** With a standby that takes over on its own, a 2 vCPU / 8 GB / 200 GB database costs $270 to $319 a month on Cloud SQL, RDS, Crunchy Bridge, DigitalOcean and Azure (RDS: $292). An 8 vCPU / 32 GB / 1 TB one costs $1,149 to $1,275 on the same five (RDS: $1,214). Aurora is the outlier, at about twice that, partly because its smallest matching instance has twice the RAM.
- **Cheap rows have no standby.** Supabase ($150 and $549), Xata ($126 and $560) and Neon ($225 and $969, always on) are one compute. That can be the right trade; it is a different product, not a discount.
- **Branching.** Neon branches carried the parent's data and were queryable in a median 2.7 to 2.8 seconds at both 0.16 GB and 1.58 GB. A Supabase Free project refused to branch (HTTP 402, Pro plan only), and Supabase branches are data-less by default. RDS, Azure, DigitalOcean, Aiven and Crunchy Bridge clone by restoring a backup into a new, fully billed instance.
- **Upgrades.** `pg_upgrade` itself took 3.4 seconds in link mode on a 4.8 GB database, and 17.9 seconds in copy mode. A dump and restore of the same data took 2 minutes 24 seconds. Neon and PlanetScale have no in-place upgrade; Supabase has one but no target yet, because its newest Postgres is 17.
- **Statistics.** After a Postgres 17 to 18 `pg_upgrade`, the planner statistics were there. After `pg_dump`/`pg_restore` with default flags they were not, until we ran `ANALYZE` or added `--statistics` to `pg_dump`.

:::note
Neon sponsors other posts on DevOps Daily. This one is not sponsored, Neon was measured with the same scripts as everything else, and it loses on several rows below: the highest storage price in the table, no standby compute, and no in-place upgrade.
:::

## Prerequisites

To read the post, nothing. To run the measurements yourself:

- Node.js 22 or newer and Docker
- About 25 GB of free disk for the largest local upgrade test
- Optional: a Neon API key and a Supabase access token for the two cloud stages (both work on free plans except the 10M-row Neon stage, which needs more than the free 1 GB per project)

```github
https://github.com/The-DevOps-Daily/rds-alternatives-measured
```

## What we measured and what we only read

We could only time services we could run for free or on accounts we already pay for, and we would not touch a production AWS account for a benchmark. So the work splits in three:

1. **Measured on managed services:** Neon (branching, and a 17 to 18 upgrade by dump and restore) and Supabase Free (what the API allows). Both in AWS eu-central-1, driven from a DigitalOcean droplet in Frankfurt.
2. **Measured on our own servers:** every way managed services implement a major version upgrade, with the same data, on Postgres 17.12 and 18.7 from the official Docker images. This tells you what the upgrade step costs before a provider wraps it in snapshots and restarts.
3. **Read, not measured:** RDS, Aurora, Cloud SQL, Azure Flexible Server, DigitalOcean, Crunchy Bridge, Aiven, PlanetScale and Xata. Prices come from their price lists and APIs, and mechanics from their docs, all fetched on 23 November 2026. Every price in the repo carries its URL and a one-line quote.

The dataset is a pgbench-style `accounts` table, generated on the server: 1 million rows (0.16 GB), 10 million (1.58 GB) and 30 million (4.71 GB).

## What you pay at three sizes

We picked three sizes that match real deployments, and for each provider the nearest plan:

- **S:** about 2 vCPU and 4 GB, 50 GB of storage, one node. A side project or an internal tool.
- **M:** about 2 vCPU and 8 GB, 200 GB, with a high-availability standby. A small production app.
- **L:** about 8 vCPU and 32 GB, 1 TB, with a standby. A busy production database.

Prices are US East, on demand, 730 hours a month, with no egress and backups inside the free allowance. Where a provider has no plan of that shape, the table says what is different.

```chart
{
  "type": "bar",
  "title": "M: about 2 vCPU / 8 GB / 200 GB, monthly list price",
  "unit": "$",
  "caption": "Verified 23 Nov 2026 from each provider's price list or pricing API. US East, on demand, 730 h. 'One node' rows have no standby that takes over on its own. Aurora: r7g.large (16 GB) writer plus a replica, I/O-Optimized. PlanetScale: PS-160 (16 GB), primary plus two replicas. Sources: prices/prices.json in the repo.",
  "rows": [
    { "label": "Xata (one node)", "value": 126, "series": "One node" },
    { "label": "Supabase (one node)", "value": 150, "series": "One node" },
    { "label": "Neon (one compute, always on)", "value": 225, "series": "One node" },
    { "label": "Cloud SQL", "value": 270, "series": "With standby" },
    { "label": "RDS Multi-AZ", "value": 292, "series": "RDS" },
    { "label": "Crunchy Bridge", "value": 300, "series": "With standby" },
    { "label": "DigitalOcean", "value": 306, "series": "With standby" },
    { "label": "Azure Flexible Server", "value": 319, "series": "With standby" },
    { "label": "PlanetScale", "value": 361, "series": "With standby" },
    { "label": "Aiven", "value": 470, "series": "With standby" },
    { "label": "Aurora", "value": 569, "series": "With standby" }
  ],
  "series": [
    { "name": "RDS", "color": "#ff9900" },
    { "name": "With standby", "color": "#38bdf8" },
    { "name": "One node", "color": "#94a3b8" }
  ]
}
```

| Size                    | Cheapest                          | RDS              | Most expensive       | Cheapest without a standby |
| ----------------------- | --------------------------------- | ---------------- | -------------------- | -------------------------- |
| S (no standby anywhere) | PlanetScale PS-40, $34 (1/2 vCPU) | $53 (t4g.medium) | Aiven startup-4, $99 | every row                  |
| M                       | Cloud SQL, $270                   | $292             | Aurora, $569         | Xata large, $126           |
| L                       | Cloud SQL, $1,149                 | $1,214           | Aurora, $2,323       | Supabase 2XL, $549         |

For M and L, the first three columns count only plans with a standby. At L the order is almost the same: Cloud SQL $1,149, RDS $1,214, Crunchy Bridge $1,220, DigitalOcean $1,270, Azure $1,275, PlanetScale $1,510 (an 8 vCPU / 64 GB plan with two replicas), Aiven $1,640 (its nearest plan has 4 CPUs and 30 GB) and Aurora $2,323. The one-node rows at L are Supabase $549, Xata $560 and Neon $969 with an 8 CU compute always on.

What the chart hides is how much each row is not like the others:

- **Aurora** has no 8 GB instance class in this family, so its M row is an r7g.large with 16 GB, and its L row has 64 GB. We priced I/O-Optimized because Aurora Standard adds $0.20 per million I/O requests, which we cannot know for your workload. Standard is cheaper per hour.
- **Neon** couples CPU and memory: 1 CU is 1 vCPU and 4 GB, so there is no 2 vCPU / 4 GB compute, and the S row is a 1 CU compute. These are always-on prices; a database that idles scales to zero and costs a fraction of this. Its storage is also the most expensive here at $0.35 per GB-month, which is $350 of the $969 at 1 TB.
- **Azure** Premium SSD comes in fixed sizes, so 50 GB bills as 64 GiB and 200 GB as 256 GiB, and the provisioned IOPS of those disks (240 and 1,100) are lower than gp3's 3,000 baseline on RDS.
- **Supabase** has no generally available standby. A read replica exists, but it does not take over on its own.
- **PlanetScale** ties 8 GB of RAM to each vCPU, and its HA plans always run a primary and two replicas, with storage billed on all three.
- **DigitalOcean** now bills storage apart from compute, and its Standard 2 vCPU / 8 GB plan stops at 150 GiB, so M and L use the Advanced edition.
- **Crunchy Bridge** says HA "doubles the cluster price"; it does not say whether that includes storage, so we counted storage once.

### What actually grows an RDS bill

If RDS is in the middle on list price, the stories about RDS bills come from somewhere else. Three things in the price list do it:

1. **Multi-AZ doubles everything.** db.m7g.large is $0.168 an hour in one zone and $0.337 with a standby, and gp3 storage goes from $0.115 to $0.23 per GB-month. That is the same doubling Cloud SQL and Azure charge; it only looks like an RDS tax when the comparison is against a one-node service.
2. **Storage performance above the baseline.** gp3 on RDS gives 3,000 IOPS and 125 MiB/s below 400 GiB. Each extra provisioned IOPS is $0.02 a month in one zone and $0.04 with Multi-AZ.
3. **Extended Support.** When a major version leaves standard support, RDS enrolls the instance in paid Extended Support: $0.10 per vCPU-hour in years one and two, $0.20 in year three. For an 8 vCPU instance that is $584 a month, then $1,168, per instance. Cloud SQL and Azure have the same model; Supabase, Aiven, Crunchy Bridge and DigitalOcean upgrade you instead. We wrote about [the same charge on RDS for MySQL 8.0](/posts/aws-rds-extended-support-mysql-8-0-charges).

The third one connects price to upgrades: on the providers that charge for old versions, putting off the upgrade has a monthly cost.

## Branching: seconds or a new instance

A branch is a copy of the database you can break. Teams want one per pull request, one for a migration rehearsal, one for a support engineer who needs production-shaped data. How fast you get one, and whether it has data in it, is decided by how the service stores data.

### Neon: measured

We loaded the table into a Neon Postgres 17 project, created 10 branches with their own 1 CU compute, and timed each from the API request to the first query that read the last row of the parent's table through the branch. Then we scanned the whole table on the branch and compared a checksum with the parent's.

```chart
{
  "type": "bar",
  "title": "Neon branch: API request to first query on the parent's data",
  "unit": "s",
  "caption": "10 branches per size, each with its own 1 CU compute, aws-eu-central-1, client in DigitalOcean FRA1. Bar is the median, tick is the slowest run. Every branch passed a full-table checksum against the parent.",
  "rows": [
    { "label": "0.16 GB (1M rows)", "value": 2.73, "tick": 3.45 },
    { "label": "1.58 GB (10M rows)", "value": 2.76, "tick": 3.51 }
  ]
}
```

Ten times the data, the same time: a median of 2.73 seconds at 0.16 GB and 2.76 seconds at 1.58 GB. Of the median, about 0.5 seconds is the API call, 1.7 seconds is waiting for Neon's operations to finish (creating the branch and starting its compute), and 0.5 seconds is getting the connection string, connecting and running the query. The branch does not copy data; its compute reads the parent's pages from shared storage.

That has a cost that shows up later. A full scan of the 10M-row table on a fresh branch took a median 5.7 seconds, because none of it was in the branch compute's cache yet. A branch is cheap to create, and its first heavy queries are cold.

### What the others do

For comparison, a clone that copies the files: `CREATE DATABASE ... TEMPLATE` on our own Postgres 18 server, with the faster `file_copy` strategy, took a median 0.28 seconds at 0.16 GB, 2.99 seconds at 1.58 GB and 12.36 seconds at 4.71 GB. On a local SSD that is quick at these sizes, but it grows with the data, at about 2.6 seconds per GB, and the copy-on-write branch does not. A managed restore adds provisioning a new instance on top of the copy.

| Provider              | How you get a copy                                                                                                                 | Carries data                            | On the free tier         |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------ |
| RDS                   | Restore a snapshot or a point in time into a new instance; blocks lazy-load from S3                                                | Yes                                     | No branching on any tier |
| Aurora                | Fast clone, copy-on-write on the cluster volume; the 16th clone of a source is a full copy                                         | Yes                                     | Not stated               |
| Cloud SQL             | Clone into a new instance; "fast clone" in the same zone is metadata-only, a standard clone is "proportional to the database size" | Yes                                     | No free tier             |
| Azure Flexible Server | Point-in-time restore into a new server with the source's size                                                                     | Yes                                     | Not stated               |
| DigitalOcean          | Fork a cluster from any point in the last 7 days                                                                                   | Yes                                     | No free tier             |
| Crunchy Bridge        | Fork from a backup or a point in time in a 10-day window                                                                           | Yes                                     | No free tier             |
| Aiven                 | Fork a service from its latest backup or a point in time                                                                           | Yes                                     | Free plan cannot fork    |
| Supabase              | Preview branch: a new project, schema rebuilt from your migrations                                                                 | Not by default; optional "Include data" | No: Pro plan and up      |
| PlanetScale Postgres  | New branch with no schema or data, or a branch restored from a backup at the parent's size                                         | Only from a backup                      | No free tier             |
| Xata                  | Copy-on-write branch with the parent's schema and data                                                                             | Yes                                     | No free tier             |
| Neon                  | Copy-on-write branch, current or past state                                                                                        | Yes                                     | Yes, 10 per project      |

Sources for every row are in `research/mechanics.json` in the repo.

On Supabase we asked the API directly. A new Free project, Postgres 17.12, answered the branch request with:

```text
HTTP 402 {"message":"Branching is supported only on the Pro plan or above"}
```

We measured Supabase Pro branches in June: [they arrived in about 6.5 seconds, schema only](/posts/neon-vs-supabase-operational-benchmarks), and the `with_data` option failed on a fresh project. If your preview environments need production-shaped data, check that path before you commit to it. The [Neon vs Supabase comparison](/comparisons/neon-vs-supabase) has the rest of that matchup.

A restore-based clone is not useless. It is a full, independent copy you can resize and keep, and on RDS it can be from any second in your retention window. It is the wrong tool for one database per pull request, which is where copy-on-write wins.

## Major version upgrades: four procedures

Every managed Postgres service does a major upgrade in one of four ways:

```diagram
{
  "type": "branch",
  "nodes": [
    { "label": "Postgres 17", "sub": "your database", "icon": "database", "tone": "blue" },
    { "label": "Pick a method", "sub": "the provider picks for you", "icon": "gear", "tone": "slate" }
  ],
  "branch": [
    { "label": "pg_upgrade in place: RDS, Cloud SQL, Azure, DigitalOcean, Aiven, Supabase", "variant": "good" },
    { "label": "pg_upgrade on a hidden standby, then fail over: Crunchy Bridge", "variant": "good" },
    { "label": "Logical replication to a new server (blue/green): RDS, Aurora", "variant": "good" },
    { "label": "New project plus dump and restore or replication: Neon, PlanetScale", "variant": "bad" }
  ]
}
```

To see what each costs before a provider wraps it, we ran all of them on one 4 vCPU droplet with local SSD, Postgres 17.12 to 18.7, three runs at each size. For the in-place methods, a client opened a new connection every 250 ms the whole time and recorded the outage.

```chart
{
  "type": "line",
  "title": "Postgres 17 to 18 on one server: how long writes stopped",
  "unit": "s",
  "caption": "Median of 3 runs per point, 4 vCPU droplet with local SSD, Postgres 17.12 to 18.7. pg_upgrade rows: stop, upgrade, start, until a new connection gets an answer. Dump-restore: pg_dump -Fd -j4 plus pg_restore -j4, writes must stop for all of it. Logical replication is not shown: writes stopped for 38 to 66 ms after a 39.5 s initial copy at 1.58 GB.",
  "x": ["0.16 GB", "1.58 GB", "4.71 GB"],
  "series": [
    { "name": "pg_upgrade --link", "data": [3.1, 4.1, 3.4] },
    { "name": "pg_upgrade --swap", "data": [3.2, 3.9, 3.2] },
    { "name": "pg_upgrade --copy", "data": [3.5, 7.8, 17.9] },
    { "name": "pg_dump + pg_restore", "data": [4.7, 47.4, 143.6] }
  ]
}
```

| Method                                           | 0.16 GB |                            1.58 GB | 4.71 GB | Old server usable after     | Statistics after |
| ------------------------------------------------ | ------: | ---------------------------------: | ------: | --------------------------- | ---------------- |
| `pg_upgrade --link`                              |   3.1 s |                              4.1 s |   3.4 s | No, once the new one starts | Kept             |
| `pg_upgrade --swap`                              |   3.2 s |                              3.9 s |   3.2 s | No, once the new one starts | Kept             |
| `pg_upgrade --copy`                              |   3.5 s |                              7.8 s |  17.9 s | Yes                         | Kept             |
| `pg_dump` + `pg_restore` (writes stopped)        |   4.7 s |                             47.4 s | 143.6 s | Yes, it never stopped       | None             |
| Logical replication (writes stopped at cut-over) |         | 51 ms, after a 39.5 s initial copy |         | Yes                         | None             |

Times are the median of three runs; the spread within each size was under 1.5 seconds for the `pg_upgrade` modes and under 8 seconds for dump and restore. Every run passed a full-table checksum, and the logical replication runs lost no rows.

What the numbers say:

- **`pg_upgrade --link` barely depends on size.** It hard-links the data files instead of copying them, so the time is the catalog: 3.1, 4.1 and 3.4 seconds at 0.16, 1.58 and 4.71 GB. Copy mode grows with the data: 3.5, 7.8 and 17.9 seconds. Swap mode, new in Postgres 18, moves the directories and behaved like link mode.
- **Link and swap trade the rollback.** Once the new server starts, the old data directory is no longer usable. Copy mode leaves the old cluster untouched, which is why it needs twice the disk.
- **Dump and restore grows with the data, and writes stop for the whole time**: 4.7 seconds, 47.4 seconds and 2 minutes 24 seconds at the three sizes.
- **Logical replication moves the wait out of the outage.** The initial copy of 10M rows took a median 39.5 seconds while the old server kept taking writes, and the cut-over itself stopped writes for a median 51 ms with no lost rows. That cut-over is our script on one machine, not a managed switchover; AWS says an RDS Blue/Green switchover "typically takes under a minute". Logical replication does not copy DDL or sequence values, which is why the script moves the sequence by hand.

These are the floors. A managed in-place upgrade adds snapshots before and after, pre-checks and an instance restart, and the providers' own estimates are in minutes, not seconds: Supabase says a small project is offline for about 15 minutes, and Crunchy Bridge and Snowflake Postgres say "a few minutes". DigitalOcean says the time "isn't predictable in advance".

### Neon: measured

Neon "doesn't upgrade a project to a new major version in place, and doesn't support pg_upgrade", in its own words. You create a project on the new version and move the data with its Import Data Assistant (under 10 GB), `pg_dump`/`pg_restore`, or logical replication. We did the dump and restore of the 10M-row table from a Postgres 17 project into a Postgres 18 project, from the droplet in the same region:

```chart
{
  "type": "bar",
  "title": "Neon: Postgres 17 project to Postgres 18 project, 1.58 GB",
  "unit": "s",
  "caption": "Median of 3 runs per row. pg_dump -Fd -j4 from the 17 project to the droplet, then pg_restore -j4 into a new database on the 18 project. 2 CU computes, aws-eu-central-1, client in DigitalOcean FRA1. Writes must stop for dump plus restore.",
  "rows": [
    { "label": "pg_dump", "value": 16.9, "series": "default flags" },
    { "label": "pg_restore", "value": 16.9, "series": "default flags" },
    { "label": "pg_dump --statistics", "value": 16.7, "series": "--statistics" },
    { "label": "pg_restore", "value": 11.9, "series": "--statistics" }
  ]
}
```

The new Postgres 18 project was ready in 3.4 seconds. Dump plus restore of the 1.58 GB database stopped writes for a median 34.1 seconds with pg_dump's default flags, and every run passed the checksum. That is faster than the same job on our single droplet (47.4 seconds), because the dump, the restore and the server were not sharing four CPUs. The `--statistics` runs came second, into a project that had already done three restores, so do not read their faster restore as an effect of the flag. Expect the time to grow with the data, as it did locally: about 2 minutes 24 seconds for 4.71 GB on one machine.

If you can stop writes for that long, it is simple, and the old project stays as your rollback until you delete it. If you cannot, the logical replication path is the one to rehearse, and a branch is a good place to [rehearse the migration](/posts/rehearse-migrations-on-a-neon-branch) first.

### Supabase: no target yet

The Supabase Management API answered our new Free project's upgrade check with `"eligible": false` and an empty list of targets. The new project came up on Postgres 17.12, and 17 is the newest major Supabase offers. Supabase does have an in-place upgrade (a button, or the experimental `/upgrade` endpoints), which it will need when 18 arrives; we could not time it.

### Your planner statistics

After a major upgrade, the planner needs statistics, and without them it can pick bad plans until autovacuum gets to each table. The docs disagree on whether you get them:

- RDS, Aurora, Cloud SQL and Azure tell you to run `ANALYZE` after the upgrade.
- Aiven runs `ANALYZE` for you, and Crunchy Bridge runs `vacuumdb --analyze-in-stages`.

On stock Postgres, the answer depends on the method. With autovacuum off on the new server, so that it could not fill them in:

- After `pg_upgrade` from 17 to 18, all four columns of the table had statistics, in every run at every size. Postgres 18's `pg_upgrade` carries them over.
- After `pg_dump`/`pg_restore` with default flags, and after logical replication, there were none.
- After `pg_dump --statistics`, there were, on Neon as well as locally.

Whether your provider's upgrade keeps them depends on how it calls `pg_upgrade`, and we could not see that. `ANALYZE` on the 30M-row table took 0.9 to 1.2 seconds. Run it.

### A trap if you upgrade your own servers

Postgres 18's `initdb` turns data checksums on by default, and Postgres 17's did not. A `pg_upgrade --check` from a default 17 cluster to a default 18 cluster stops with:

```text
old cluster does not use data checksums but the new one does
```

Create the new cluster with `--no-data-checksums` (or enable checksums on the old one first). Managed services handle this; a self-managed upgrade, or a container image that runs `initdb` for you, has to.

| Provider              | Major upgrade                                                        | Newest major today               | Rollback after success                                                     |
| --------------------- | -------------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------- |
| RDS                   | In place with `pg_upgrade`, or Blue/Green                            | 18 (19 RC in preview only)       | Restore the pre-upgrade snapshot into a new instance                       |
| Aurora                | In place, or Blue/Green                                              | 18                               | Restore the pre-upgrade snapshot                                           |
| Cloud SQL             | In place with `pg_upgrade`; HA does not fail over to hide it         | 18                               | Restore the pre-upgrade backup into a new instance                         |
| Azure Flexible Server | In place with `pg_upgrade`; HA off during it, replicas deleted first | 18 (19 in preview in one region) | Not stated                                                                 |
| DigitalOcean          | In place on the primary                                              | 18                               | None: "you cannot restore the PostgreSQL instance to the previous version" |
| Crunchy Bridge        | `pg_upgrade` on a hidden standby, then fail over                     | 18                               | Detach a replica beforehand                                                |
| Aiven                 | In place with `pg_upgrade --link`, then `ANALYZE`                    | 19 (in its version table)        | None                                                                       |
| Supabase              | In place with `pg_upgrade`, project offline                          | 17                               | Not stated                                                                 |
| Neon                  | New project, then migrate                                            | 19                               | The old project, until you delete it                                       |
| PlanetScale Postgres  | New database, then online import                                     | 18                               | The old database                                                           |
| Xata                  | Minor versions only                                                  | 18                               | Not applicable                                                             |

Before any of these, our [zero-downtime Postgres migrations checklist](/checklists/zero-downtime-postgres-migrations) covers the schema side.

## Free tiers

| Provider                                        | Free tier                                                                                                         |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Neon                                            | 100 CU-hours a month and 1 GB per project, up to 100 projects, scales to zero after 5 minutes, branching included |
| Supabase                                        | 500 MB database, 2 active projects, paused after a week without activity, no branching, no backups                |
| Aiven                                           | 1 CPU, 1 GB RAM, 1 GB storage, no region choice, no forking, powered off when idle                                |
| Azure                                           | 12 months of a B1MS server (750 hours), 32 GB storage, for new accounts                                           |
| AWS                                             | New accounts since July 2025: a 6-month Free plan with $100 to $200 in credits, RDS on micro instances            |
| Google Cloud                                    | No free Cloud SQL; $300 in credits and a 30-day trial instance                                                    |
| DigitalOcean, Crunchy Bridge, PlanetScale, Xata | None (PlanetScale starts at $5, Crunchy Bridge Hobby at $9)                                                       |

The two free tiers you can keep running are Neon's and Supabase's, and they are different shapes: Neon gives many small projects that sleep when idle, Supabase gives two that pause after a week. Aiven's free plan is a real Postgres server, but it powers off if you do not use it.

## What we could not measure

- **No managed upgrade was timed.** Neon has no in-place upgrade, Supabase had no target, and every service with an in-place upgrade costs money to run. The local numbers are the `pg_upgrade` floor, not the managed downtime.
- **No branch or clone on RDS, Aurora, Cloud SQL, Azure, DigitalOcean, Crunchy Bridge, Aiven, PlanetScale or Xata was timed.** The table describes them from their docs.
- **Price is list price only.** No egress, no reserved or committed-use discounts, no support plans, no backup storage beyond the free allowance. A one-year RDS reservation changes the RDS row; we did not model it.
- **One shared droplet.** The Neon branch stage ran on the same droplet while the local upgrade stage was loading and upgrading the two smaller databases. The branch time is mostly Neon's control plane and network, but the client was not idle.
- **One region, one day.** The Neon numbers come from one session in aws-eu-central-1. The branch times were tight (2.2 to 3.5 seconds across all 20 runs), but another region or another day can differ.
- **Sizes do not match exactly.** Every mismatch is in the notes above and in `prices/plans.mjs`.

## So which one

- **You want RDS without RDS:** Cloud SQL, Azure, Crunchy Bridge and DigitalOcean cost about the same with a standby. Pick on the cloud you already use and on how the upgrade works: On Crunchy Bridge, writes stop while `pg_upgrade` runs on a hidden standby and during the failover, and if the upgrade fails they resume on the original server; DigitalOcean's in-place upgrade has no rollback once it starts.
- **You want branches with data for every pull request:** Neon and Xata do copy-on-write, and so does Aurora up to 15 clones per source. On Supabase and PlanetScale, plan for data-less branches or restores.
- **You are cost-bound and can live without a standby:** Supabase and Xata cost about half the HA price at M and L, and an always-on Neon compute about three quarters, less when it scales to zero. Know what happens when the one node fails, and test it.
- **You are on an old major version:** price the Extended Support months on RDS, Cloud SQL or Azure against an upgrade you will have to do anyway.

Whichever you pick, rehearse the next major upgrade before you need it. That is the operation the price list does not show, and the one most likely to decide whether you move again.
