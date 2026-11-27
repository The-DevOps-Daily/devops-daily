---
title: 'RDS Alternatives for Postgres, Measured: What You Pay, How You Branch, How You Upgrade'
excerpt: 'We priced the same three Postgres sizes on RDS and ten alternatives, timed branches and major version upgrades, and checked what each service does with your planner statistics. With a standby in the price, RDS sits in the middle of the pack; branching and upgrades are where the choice gets made.'
category:
  name: 'Cloud'
  slug: 'cloud'
date: '2026-11-27'
publishedAt: '2026-11-27T15:00:00Z'
updatedAt: '2026-11-27T16:00:00Z'
readingTime: '22 min read'
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

Teams leave RDS for three reasons: the bill, the time it takes to get a copy of production for a test, and the major version upgrade they keep putting off. We checked all three across RDS and ten alternatives, and the first result surprised us. Once you compare plans that include a standby, RDS is not the expensive one. Google Cloud SQL, Crunchy Bridge, DigitalOcean and Azure all land between 8% below and about 10% above it at both sizes we priced with high availability. Most of the much cheaper options are cheaper because they sell you one node.

The differences that decide the choice are the other two. A Neon branch of a 1.58 GB database was queryable in 2.7 seconds, the same as a branch of a 0.16 GB one. On RDS, the same request is "restore a snapshot into a new instance". And a major version upgrade is four different procedures depending on where you run, with downtime that ranges from seconds to however long a dump and restore of your database takes.

This post has the prices at three sizes, the measured branch and upgrade times, and a table of what each provider does for branching, upgrades and free tiers, with links to their docs. The scripts, raw results and every price quote are in a public repo you can run.

## TLDR

- **Price.** With a standby that takes over on its own, a 2 vCPU / 8 GB / 200 GB database costs $266 to $319 a month on Cloud SQL, RDS, Crunchy Bridge, DigitalOcean and Azure (RDS: $289). An 8 vCPU / 32 GB / 1 TB one costs $1,126 to $1,275 on the same five (RDS: $1,198). If Crunchy Bridge bills HA storage twice, its rows rise to $320 and $1,320, about 10% above RDS.
- **Cheaper rows mostly have no standby.** Supabase ($150 and $549) is one node. Neon ($225 and $969, always on) has no standby compute either, but its storage is replicated across availability zones, so a failed compute is restarted on the same data: a short outage, not a failover to a copy. With scale to zero, a staging database at M that is busy 8 hours on weekdays costs about $107. Xata with one replica comes to $196 and $841, but it does not publish a replica price, so that row rests on our assumption. Aurora costs 1.4 to 2 times RDS, depending on how much I/O you do.
- **Branching.** Neon branches carried the parent's data and were queryable in a median 2.70 and 2.72 seconds at 0.16 GB and 1.58 GB. A Supabase Free project refused to branch (HTTP 402, Pro plan only), and Supabase branches are data-less by default. RDS, Azure, DigitalOcean, Aiven and Crunchy Bridge clone by restoring a backup into a new, fully billed instance.
- **Restore.** After a `DROP TABLE` on the 1.58 GB Neon database, an instant restore to 2 seconds before the drop brought the original data back on the same connection string in a median 9.71 seconds (8.42 to 15.32, 5 runs). RDS restores a point in time into a new DB instance; we did not time that.
- **Upgrades.** On our own server, stopping Postgres 17, running `pg_upgrade --link` and starting 18 took 3.4 seconds on a 4.71 GB database, and 15.8 seconds in copy mode. A dump and restore of the same data took 3 minutes 34 seconds. Neon and PlanetScale have no in-place upgrade; Supabase has one, but our new project had no target to upgrade to.
- **Statistics.** After a Postgres 17 to 18 `pg_upgrade`, the planner statistics were there. After `pg_dump`/`pg_restore` with default flags they were not, until we ran `ANALYZE` or added `--statistics` to `pg_dump`.

:::note
Neon and Supabase Free were run with the scripts in the repo. The other managed services were priced from their price lists and described from their docs, with a source for every claim in the repo.
:::

## Prerequisites

To read the post, nothing. To run the measurements yourself:

- Node.js 22 or newer and Docker
- About 25 GB of free disk for the largest local upgrade test
- Optional, for the cloud stages: a Neon API key on a paid plan (the scripts turn scale to zero off, which the Free plan does not allow) and a Supabase access token with a Free organization

```github
https://github.com/The-DevOps-Daily/rds-alternatives-measured
```

## What we measured and what we only read

We could only time services we could run for free or on accounts we already pay for, and we would not touch a production AWS account for a benchmark. So the work splits in three:

1. **Measured on managed services:** Neon (branching, point-in-time restore, and a 17 to 18 upgrade by dump and restore) and Supabase Free (what the API allows). Both in AWS eu-central-1, driven from a DigitalOcean droplet in Frankfurt, except the restore runs, which ran from Amsterdam (more on that below).
2. **Measured on our own server:** three of the four ways managed services do a major version upgrade (`pg_upgrade`, dump and restore, logical replication), with the same data, on Postgres 17.12 and 18.7 from the official Docker images. This shows what the upgrade step costs before a provider wraps it in snapshots and restarts. The fourth way, `pg_upgrade` on a hidden standby followed by a failover, we did not build.
3. **Read, not measured:** RDS, Aurora, Cloud SQL, Azure Flexible Server, DigitalOcean, Crunchy Bridge, Aiven, PlanetScale and Xata. Prices come from their price lists and pricing APIs, and mechanics from their docs, all fetched on 23 November 2026. Every price in the repo carries its URL and a one-line quote.

All stages ran one after the other on the same droplet, so no two measurements shared it. The dataset is one pgbench-style `accounts` table with a primary key and an 84-character filler of md5 hex, generated on the server: 1 million rows (0.16 GB), 10 million (1.58 GB) and 30 million (4.71 GB). A real schema has many more tables and indexes, and `pg_upgrade` time grows with the number of objects, so read our upgrade times as illustrative measurements for this host and a one-table schema.

## What you pay at three sizes

We picked three sizes that match real deployments:

- **S:** about 2 vCPU and 4 GB, 50 GB of storage, one node. A side project or an internal tool.
- **M:** about 2 vCPU and 8 GB, 200 GB, with a high-availability standby. A small production app.
- **L:** about 8 vCPU and 32 GB, 1 TB, with a standby. A busy production database.

The rule for every provider: the smallest plan with at least that many vCPUs and that much RAM (shared or burstable CPU allowed at S), and at least that much storage, rounded up to the provider's increments. Prices are US East, on demand, 730 hours a month, for compute and storage only: no egress, no discounts, and no separately billed backups or restore history (Cloud SQL, for example, charges $0.08 per GiB-month of backup storage used). Storage sizes are in GB; for providers that bill in GiB we converted, then rounded to their increments.

```chart
{
  "type": "bar",
  "title": "M: about 2 vCPU / 8 GB / 200 GB, monthly list price",
  "unit": "$",
  "caption": "Verified 23 Nov 2026 from each provider's price list or pricing API. US East, on demand, 730 h. 'One node' rows have no standby that takes over on its own. Neon has no standby compute either; its storage is replicated across availability zones and a failed compute is restarted. Xata: replica price not published, assumed equal to the primary. Aurora: r7g.large (16 GB) writer plus a replica; Standard excludes I/O charges. PlanetScale: PS-160 (16 GB), primary plus two replicas. Crunchy Bridge: $320 if HA doubles storage. Compute and storage only. Sources: prices/prices.json in the repo.",
  "rows": [
    { "label": "Supabase (one node)", "value": 150, "series": "One node" },
    { "label": "Xata (replica price assumed)", "value": 196, "series": "With standby" },
    { "label": "Neon Launch (one compute, always on)", "value": 225, "series": "One compute, replicated storage" },
    { "label": "Cloud SQL", "value": 266, "series": "With standby" },
    { "label": "RDS Multi-AZ", "value": 289, "series": "RDS" },
    { "label": "Crunchy Bridge", "value": 300, "series": "With standby" },
    { "label": "DigitalOcean", "value": 304, "series": "With standby" },
    { "label": "Azure Flexible Server", "value": 319, "series": "With standby" },
    { "label": "PlanetScale", "value": 357, "series": "With standby" },
    { "label": "Aurora Standard (before I/O)", "value": 423, "series": "With standby" },
    { "label": "Aiven", "value": 465, "series": "With standby" },
    { "label": "Aurora I/O-Optimized", "value": 569, "series": "With standby" }
  ],
  "series": [
    { "name": "RDS", "color": "#ff9900" },
    { "name": "With standby", "color": "#38bdf8" },
    { "name": "One node", "color": "#94a3b8" },
    { "name": "One compute, replicated storage", "color": "#a78bfa" }
  ]
}
```

| Provider                     | S, one node |   M, with standby |   L, with standby | Standby takes over on its own                             |
| ---------------------------- | ----------: | ----------------: | ----------------: | --------------------------------------------------------- |
| Cloud SQL                    |         $89 |              $266 |            $1,126 | Yes                                                       |
| RDS                          |         $53 |              $289 |            $1,198 | Yes                                                       |
| Crunchy Bridge               |         $75 |      $300 to $320 |  $1,220 to $1,320 | Yes                                                       |
| DigitalOcean                 |         $61 |              $304 |            $1,256 | Yes                                                       |
| Azure Flexible Server        |         $57 |              $319 |            $1,275 | Yes                                                       |
| PlanetScale Postgres         |        $101 |              $357 |            $1,506 | Yes (two replicas)                                        |
| Aurora Standard, before I/O  |         $58 |              $423 |            $1,715 | Yes                                                       |
| Aurora I/O-Optimized         |         $81 |              $569 |            $2,323 | Yes                                                       |
| Aiven                        |         $99 |              $465 |            $2,500 | Yes                                                       |
| Xata (replica price assumed) |         $49 |              $196 |              $841 | Yes, price not published                                  |
| Supabase                     |         $80 |    $150, one node |    $549, one node | No generally available standby                            |
| Neon Launch, always on       |        $172 | $225, one compute | $969, one compute | No standby compute; storage replicated, compute restarted |

What the table hides is how much each row is not like the others:

- **Aurora** has no 8 GB instance class in this family, so its M row is an r7g.large with 16 GB, and its L row has 64 GB. Aurora Standard adds $0.20 per million I/O requests on top of the price shown; I/O-Optimized has no I/O charge and becomes the cheaper of the two above about 731 million requests a month at M and about 3 billion at L.
- **Neon** couples CPU and memory: 1 CU is 1 vCPU and 4 GB, so 2 vCPU comes with 8 GB, which is why its S row is the most expensive. These are always-on prices on the Launch plan. With scale to zero you pay for compute only while it runs: a staging or preview database at the M size that is busy 8 hours on weekdays runs about 174 hours a month (8 hours on about 21.75 weekdays), so 2 CU × 174 h × $0.106 per CU-hour is $36.89 of compute, plus $70 for 200 GB of storage at $0.35 per GB-month, about $107 a month instead of $225. Each day also adds the 5 minutes the compute stays up after the last query before it suspends, about $0.38 a month. Neon has no standby compute, and a compute runs in one availability zone at a time. What is replicated is the storage: per [Neon's high availability docs](https://neon.com/docs/introduction/high-availability), the safekeepers that receive the WAL "are distributed across multiple Availability Zones", secondary pageservers keep copies of the data, and its long-term copy is in object storage. When a compute fails, it is restarted or moved to another node, on the same storage. The docs give typical times: a Postgres crash is restarted "within a few seconds", a failed node's computes move to another node in "1-2 minutes", and in a zone outage computes move to a healthy zone in "1-10 minutes". Neon says compute failures "don't affect your data", but connections, temporary tables and the compute's cache are lost, so plan for a short outage, not a failover. Launch has no uptime SLA; on the Scale plan, which has one, M is $394 and L is $1,646. Restore history ($0.20 per GB-month of changes) is not included. Storage is $0.35 per GB-month, so $350 of the $969 at L is storage.
- **Xata** replicas "provide high availability, automated failover", per its docs, but the pricing page lists no replica price. We assumed a replica costs the same as the primary and counted storage once. Xata is also joining ClickHouse and says it will eventually move its customers to ClickHouse's managed Postgres.
- **Aiven** has no 8 CPU / 32 GB plan. Its L row is business-64 with 61 GB; business-32 (4 CPUs, 30 GB) plus storage would be about $1,580.
- **Crunchy Bridge** says HA "doubles the cluster price" and does not say whether that includes storage, so its M and L rows are ranges. Its S row is Hobby-4, which Crunchy's docs list with 2 burstable cores and its pricing page with 1; with 2 dedicated cores (Standard-8, 8 GB) S is $145.
- **PlanetScale** ties 8 GB of RAM to each vCPU, and its HA plans always run a primary and two replicas, with storage billed on all three (less 10 GB each).
- **Azure** Premium SSD comes in fixed sizes, so 50 GB bills as 64 GiB and 200 GB as 256 GiB, and those disks provision 240 and 1,100 IOPS, below the 3,000 IOPS baseline of gp3 on RDS.
- **DigitalOcean** bills storage apart from compute. New Standard edition clusters cannot have more than 4 GiB of RAM or a standby (for new accounts since 15 October 2026, for all accounts from 30 November), so M and L use the Advanced edition.
- **Supabase** has no generally available standby. A read replica exists, but it does not take over on its own.

### What grows an RDS bill

If RDS is in the middle on list price, the stories about RDS bills come from somewhere else. Three things in the price list do it:

1. **Multi-AZ doubles everything.** db.m7g.large is $0.168 an hour in one zone and $0.337 with a standby, and gp3 storage goes from $0.115 to $0.23 per GB-month. Cloud SQL and Azure double the same way; it only looks like an RDS tax when the comparison is against a one-node service.
2. **Storage performance above the baseline.** gp3 on RDS gives 3,000 IOPS and 125 MiB/s below 400 GiB. Each extra provisioned IOPS is $0.02 a month in one zone and $0.04 with Multi-AZ.
3. **Extended Support.** When a major version leaves standard support, RDS enrolls the instance in paid Extended Support: $0.10 per vCPU-hour in years one and two, $0.20 in year three. For one 8 vCPU instance that is $584 a month, then $1,168, and AWS charges it on the Multi-AZ standby too, so the L configuration pays $1,168 and then $2,336 a month. Cloud SQL and Azure have paid extended support as well, at their own rates. Supabase, Aiven and Crunchy Bridge upgrade you automatically instead, and DigitalOcean publishes end-of-life dates and mentions scheduled upgrades, without a timing we could confirm. We wrote about [the same charge on RDS for MySQL 8.0](/posts/aws-rds-extended-support-mysql-8-0-charges).

The third one connects price to upgrades: on the providers that charge for old versions, putting off the upgrade has a monthly cost.

## Branching: seconds or a new instance

A branch is a copy of the database you can break. Teams want one per pull request, one for a migration rehearsal, one for a support engineer who needs production-shaped data. How fast you get one, and whether it has data in it, depends on how the service stores data.

### Neon: measured

We loaded the table into a Neon Postgres 17 project, created 10 branches with their own 1 CU compute, and timed each from the API request to the first query that read the last row of the parent's table through the branch. Then we read the whole table on the branch and compared the row count and a sum of per-row hashes over every column with the parent's.

```chart
{
  "type": "bar",
  "title": "Neon branch: API request to first query on the parent's data",
  "unit": "s",
  "caption": "10 branches per size, each with its own 1 CU compute, aws-eu-central-1, client in DigitalOcean FRA1. Bar is the median, tick is the slowest run. Every branch matched the parent's row count and per-row hash sum.",
  "rows": [
    { "label": "0.16 GB (1M rows)", "value": 2.70, "tick": 3.39 },
    { "label": "1.58 GB (10M rows)", "value": 2.72, "tick": 3.46 }
  ]
}
```

Ten times the data, the same time: a median of 2.70 seconds at 0.16 GB and 2.72 seconds at 1.58 GB, with all 20 runs between 2.6 and 3.5 seconds. Of the median, about 0.5 seconds is the API call, 1.7 seconds is waiting for Neon's operations to finish (creating the branch and starting its compute), and 0.5 seconds is getting the connection string, connecting and running the query. A Neon branch does not copy the data at creation; its compute reads pages from the storage it shares with the parent.

The full-table check on a new branch took a median 12.3 seconds at 1.58 GB on a 1 CU compute. We did not time the same check on the parent separately, so we cannot say how much of that was data not yet cached on the branch's compute and how much was the hashing itself.

### What the others do

For a sense of what copying costs, we timed `CREATE DATABASE ... TEMPLATE` on our own Postgres 18 server, which copies every file of the source database. With the faster `file_copy` strategy it took a median 0.21 seconds, 2.37 seconds and 11.42 seconds at the three sizes, on local SSD. That is quick at these sizes, but it grows with the data, and the copy-on-write branch did not. It is not a model of a managed restore: those provision a new instance, and RDS, for one, makes the instance available first and loads blocks from S3 in the background.

| Provider              | How you get a copy                                                                                                                 | Carries data                            | On the free tier          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------- |
| RDS                   | Restore a snapshot or a point in time into a new instance; blocks lazy-load from S3                                                | Yes                                     | No branching on any tier  |
| Aurora                | Fast clone, copy-on-write on the cluster volume; the 16th clone of a source is a full copy                                         | Yes                                     | Not stated                |
| Cloud SQL             | Clone into a new instance; "fast clone" in the same zone is metadata-only, a standard clone is "proportional to the database size" | Yes                                     | No free tier              |
| Azure Flexible Server | Point-in-time restore into a new server with the source's size                                                                     | Yes                                     | Not stated                |
| DigitalOcean          | Fork a cluster from any point in the last 7 days                                                                                   | Yes                                     | No free tier              |
| Crunchy Bridge        | Fork from a backup or a point in time in a 10-day window                                                                           | Yes                                     | No free tier              |
| Aiven                 | Fork a service from its latest backup or a point in time                                                                           | Yes                                     | A fork cannot be on Free  |
| Supabase              | Preview branch: a new project, schema rebuilt from your migrations                                                                 | Not by default; optional "Include data" | No: Pro plan and up       |
| PlanetScale Postgres  | New branch with no schema or data, or a branch restored from a backup at the parent's size                                         | Only from a backup                      | No free tier              |
| Xata                  | Copy-on-write branch with the parent's schema and data                                                                             | Yes                                     | No free tier (trial only) |
| Neon                  | Copy-on-write branch, current or past state                                                                                        | Yes                                     | Yes, 10 per project       |

Sources for every row are in `research/mechanics.json` in the repo.

On Supabase we asked the API directly. A new Free project, Postgres 17.12, answered the branch request with:

```text
HTTP 402 {"message":"Branching is supported only on the Pro plan or above"}
```

We measured Supabase Pro branches in June: [they arrived in about 6.5 seconds, schema only](/posts/neon-vs-supabase-operational-benchmarks), and the `with_data` option failed on a fresh project. If your preview environments need production-shaped data, check that path before you commit to it. The [Neon vs Supabase comparison](/comparisons/neon-vs-supabase) has the rest of that matchup.

A restore-based clone is not useless. It is a full, independent copy you can resize and keep, and on RDS it can be from any second in your retention window. It is the wrong tool for one database per pull request, which is where copy-on-write wins.

### Neon: measured restore

The same storage design answers the other question teams ask of a copy: how fast can you undo a bad change? We loaded the 1.58 GB table into a new Postgres 17 project in aws-eu-central-1 and did this five times: read the server's clock, waited 2 seconds, ran `DROP TABLE accounts`, and asked Neon's [instant restore](https://neon.com/docs/guides/branch-restore) API to restore the branch to that timestamp. The clock ran from the API request to the first query that read the last row of the original table through the connection string the branch had before the restore. Then we compared the row count and per-row hash sum with the values from before the drop.

```chart
{
  "type": "dots",
  "title": "Neon instant restore after DROP TABLE, 1.58 GB: API request to first query on the original data",
  "unit": "s",
  "caption": "5 runs, restore to 2 s before the drop, 1 CU compute, Postgres 17, aws-eu-central-1, client in DigitalOcean AMS3, 27 Nov 2026. Every run matched the original row count and per-row hash sum. Source: results/09-neon-restore.jsonl in the repo.",
  "series": [
    { "name": "Instant restore", "samples": [15.32, 10.53, 9.71, 9.01, 8.42], "median": 9.71 }
  ]
}
```

The restore took a median 9.71 seconds, from 8.42 to 15.32 seconds. The first run, right after the load, was the slowest, and each run after it was a little faster. Of the median, about 0.4 seconds was the API call, 8.2 seconds was waiting for Neon's operations to finish, and 1.1 seconds was connecting and running the query. The operations include stopping and starting the branch's own compute, which a new branch does not need. That is the likely reason a restore took longer than creating a branch (2.72 seconds at the same size), and it is why, as Neon's docs say, existing connections are interrupted. The first connection after the operations finished worked in every run, the connection string did not change, and every run matched the original data. The full-table check after the restore took a median 14.3 seconds on the 1 CU compute.

Neon keeps the branch as it was just before the restore as a backup branch, so writes made after the restore point are not gone: you can copy them back from there. How far back you can restore is the history window: up to 7 days on Launch and 30 on Scale, billed on Launch as restore history at $0.20 per GB-month of changes. Our account is on the Scale plan, the project used the default 1-day window, and the client was a droplet in Amsterdam because Frankfurt had no droplet sizes available that day.

On RDS, a point-in-time restore means "creating a new DB instance without modifying the source DB instance", in the words of the [AWS docs](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PIT.html). You then point the application at the new instance's endpoint, and its volumes keep loading blocks from S3 in the background after it becomes available. RDS uploads transaction logs to S3 every five minutes, and the newest point you can restore to is the instance's `LatestRestorableTime`. We did not time an RDS restore. Leaving the source untouched has a use: you can compare the two side by side before you switch.

## Major version upgrades: four procedures

Every managed Postgres service does a major upgrade in one of four ways:

```diagram
{
  "type": "branch",
  "nodes": [
    { "label": "Postgres 17", "sub": "your database", "icon": "database", "tone": "blue" },
    { "label": "Upgrade method", "sub": "the provider picks it", "icon": "gear", "tone": "slate" }
  ],
  "branch": [
    { "label": "pg_upgrade in place: RDS, Cloud SQL, Azure, DigitalOcean, Aiven, Supabase", "variant": "good" },
    { "label": "pg_upgrade on a hidden standby, then fail over: Crunchy Bridge", "variant": "good" },
    { "label": "Logical replication to a new server (blue/green): RDS, Aurora", "variant": "good" },
    { "label": "New project plus dump and restore or replication: Neon, PlanetScale", "variant": "bad" }
  ]
}
```

To see what the steps cost before a provider wraps them, we ran three of them on one 4 vCPU droplet with local SSD, Postgres 17.12 to 18.7, three runs at each size. For `pg_upgrade`, the clock runs from stopping the old server to the first answered connection on the new one, and a separate client opened a new connection every 250 ms the whole time.

```chart
{
  "type": "line",
  "title": "Postgres 17 to 18 on one server: pg_upgrade downtime and dump plus restore duration",
  "unit": "s",
  "caption": "Median of 3 runs per point, 4 vCPU droplet with local SSD, Postgres 17.12 to 18.7. pg_upgrade: from stopping the old server to the first answered connection on the new one. Dump and restore: pg_dump -Fd -j4 plus pg_restore -j4 with no writer running, an estimate of how long writes would have to stop. Logical replication is not shown: after a 40.2 s initial copy at 1.58 GB, the gap between the last write on the old server and the first on the new was 52 to 367 ms.",
  "x": [
    "0.16 GB",
    "1.58 GB",
    "4.71 GB"
  ],
  "series": [
    {
      "name": "pg_upgrade --link",
      "data": [
        3.5,
        3.6,
        3.4
      ]
    },
    {
      "name": "pg_upgrade --swap",
      "data": [
        3.2,
        3.4,
        3.1
      ]
    },
    {
      "name": "pg_upgrade --copy",
      "data": [
        3.5,
        6.7,
        15.8
      ]
    },
    {
      "name": "pg_dump + pg_restore",
      "data": [
        7.3,
        66.8,
        214.2
      ]
    },
    {
      "name": "pg_dump --statistics + pg_restore",
      "data": [
        7.4,
        71.8,
        217.6
      ]
    }
  ]
}
```

| Method                                | 0.16 GB |                                1.58 GB | 4.71 GB | Old server usable after         | Statistics after |
| ------------------------------------- | ------: | -------------------------------------: | ------: | ------------------------------- | ---------------- |
| `pg_upgrade --link`                   |   3.5 s |                                  3.6 s |   3.4 s | No, once the new one starts     | Kept             |
| `pg_upgrade --swap`                   |   3.2 s |                                  3.4 s |   3.1 s | No, once pg_upgrade moves files | Kept             |
| `pg_upgrade --copy`                   |   3.5 s |                                  6.7 s |  15.8 s | Yes                             | Kept             |
| `pg_dump` + `pg_restore`              |   7.3 s |                                 66.8 s | 214.2 s | Yes, it never stopped           | None             |
| `pg_dump --statistics` + `pg_restore` |   7.4 s |                                 71.8 s | 217.6 s | Yes, it never stopped           | Kept             |
| Logical replication                   |         | 102 ms gap after a 40.2 s initial copy |         | Yes, it never stopped           | None             |

Times are medians of three runs. The largest spread between runs at one size was 7.1 seconds for the `pg_upgrade` modes and 32.3 seconds for dump and restore. The `pg_upgrade` command alone took 3.0 s, 2.7 s, 2.9 s in link mode and 3.1 s, 5.5 s, 15.4 s in copy mode; the rest is stopping and starting the servers. Every run matched the source row count and per-row hash sum, and the logical replication runs lost 0 acknowledged rows with 0 failed writes.

What the numbers say:

- **`pg_upgrade --link` barely depends on size.** It hard-links the data files instead of copying them, so most of the time is the catalog: 3.5 s, 3.6 s, 3.4 s at 0.16, 1.58 and 4.71 GB from stop to first answer. Copy mode grows with the data: 3.5 s, 6.7 s, 15.8 s. Swap mode, new in Postgres 18, moves the directories and behaved like link mode.
- **Link and swap trade the rollback.** In link mode the old data directory is unusable once the new server starts; in swap mode, once `pg_upgrade` starts moving files. Copy mode leaves the old cluster untouched, which is why it needs twice the disk.
- **Dump and restore grows with the data**: 7.3 seconds, 1 minute 7 seconds, 3 minutes 34 seconds at the three sizes for dump plus restore. No writer ran during these runs, so this is an estimate of the transfer part of a write freeze, not an observed outage; switching the application over comes on top.
- **Logical replication moves the wait out of the outage.** The initial copy of 10M rows took a median 40.2 seconds while the old server kept taking writes. At the cut-over, the gap between the last write on the old server and the first on the new one was a median 102 ms, of which up to 50 ms is the writer's own pause between inserts, and no acknowledged row was lost. This is one writer on one table on one machine, so it shows the order of magnitude for a subscriber that has caught up, not what a managed switchover takes; AWS says an RDS Blue/Green switchover "typically takes under a minute". Logical replication does not copy DDL or sequence values, which is why the script moves the sequence by hand.

These numbers are for this host and this one-table schema; other hardware and more objects change them. A managed in-place upgrade adds snapshots before and after, pre-checks and an instance restart, and the providers' own estimates are in minutes, not seconds: Supabase says a small project is offline for about 15 minutes, and Crunchy Bridge and Snowflake Postgres say "a few minutes". DigitalOcean says the time "isn't predictable in advance".

### Neon: measured

Neon "doesn't upgrade a project to a new major version in place, and doesn't support pg_upgrade", in its own words. You create a project on the new version and move the data with its Import Data Assistant (under 10 GB), `pg_dump`/`pg_restore`, or logical replication. We did the dump and restore of the 10M-row table from a Postgres 17 project into a Postgres 18 project, from the droplet in the same region, three times with pg_dump's default flags and three times with `--statistics`, alternating:

```chart
{
  "type": "bar",
  "title": "Neon: Postgres 17 project to Postgres 18 project, 1.58 GB",
  "unit": "s",
  "caption": "Median of 3 runs per row. pg_dump -Fd -j4 from the 17 project to the droplet (about 275 MiB on disk), then pg_restore -j4 into a new database on the 18 project. 2 CU computes, aws-eu-central-1, client in DigitalOcean FRA1.",
  "rows": [
    { "label": "pg_dump", "value": 46.8, "series": "default flags" },
    { "label": "pg_restore", "value": 11.7, "series": "default flags" },
    { "label": "pg_dump --statistics", "value": 45.7, "series": "--statistics" },
    { "label": "pg_restore", "value": 11.7, "series": "--statistics" }
  ]
}
```

The new Postgres 18 project was ready in a few seconds. Each dump plus its restore took a median 58.4 seconds with default flags and 57.6 seconds with `--statistics` (the two were timed separately and added), and every run matched the source's row count and per-row hash sum. Most of it was the dump, which compresses on the client; we did not measure whether the client's CPU was the limit. As an estimate, writes would have to stop for that long, plus the time to switch your application over.

In our test the source project was deleted before the target was created, because the account had one free project slot. In a real migration, keep the old project until the new one has taken over. It is then a copy of your data as of the cut-over, not a rollback: writes made on the new project after the switch are not in it, so going back means reconciling them or replicating them back. If you cannot stop writes for the dump and restore, the logical replication path is the one to rehearse, and a branch is a good place to [rehearse the migration](/posts/rehearse-migrations-on-a-neon-branch) first.

### Supabase: no target for our project

The Supabase Management API answered our new Free project's upgrade check with `"eligible": false` and an empty list of targets. The project came up on Postgres 17.12, and we found no Postgres 18 in Supabase's docs or API. Supabase does have an in-place upgrade (a button, or the experimental `/upgrade` endpoints); we could not time it.

### Your planner statistics

After a major upgrade, the planner needs statistics, and without them it can pick bad plans until autovacuum gets to each table. The docs differ on who runs `ANALYZE`:

- RDS, Aurora, Cloud SQL and Azure tell you to run it after the upgrade.
- Aiven runs `ANALYZE` for you, and Crunchy Bridge runs `vacuumdb --analyze-in-stages`.

On stock Postgres, the answer depends on the method. We counted the table's rows in `pg_stats` right after each upgrade, with autovacuum off on the new local server so it could not fill them in:

- After `pg_upgrade` from 17 to 18, all four columns had statistics, in every run at every size. Postgres 18's `pg_upgrade` carries them over.
- After `pg_dump`/`pg_restore` with default flags, and after logical replication, there were none.
- After `pg_dump --statistics`, all four columns had them, locally and on Neon. On Neon we did not turn autovacuum off, but it had not added statistics in the default-flag runs either.

We checked that the statistics were present, not that they were identical to the old ones. Whether your provider's upgrade keeps them depends on how it calls `pg_upgrade`, and we could not see that. `ANALYZE` on the 30M-row table took 1.3 to 4.2 seconds across all runs. Run it.

### A trap if you upgrade your own servers

Postgres 18's `initdb` turns data checksums on by default, and Postgres 17's did not. A `pg_upgrade --check` from a default 17 cluster to a default 18 cluster stops with:

```text
old cluster does not use data checksums but the new one does
```

Create the new cluster with `--no-data-checksums` (or enable checksums on the old one first). Managed services handle this; a self-managed upgrade, or a container image that runs `initdb` for you, has to.

| Provider              | Major upgrade                                                               | Newest major we found               | After a successful upgrade                                                 |
| --------------------- | --------------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------- |
| RDS                   | In place with `pg_upgrade`, or Blue/Green                                   | 18 (19 RC in a preview environment) | Restore the pre-upgrade snapshot into a new instance                       |
| Aurora                | In place, or Blue/Green                                                     | 18                                  | Restore the pre-upgrade snapshot                                           |
| Cloud SQL             | In place with `pg_upgrade`; HA does not fail over to hide it                | 18                                  | Restore the pre-upgrade backup into a new instance                         |
| Azure Flexible Server | In place with `pg_upgrade`; HA off during it, replicas deleted first        | 18 (19 in preview in one region)    | Not stated                                                                 |
| DigitalOcean          | In place on the primary                                                     | 18                                  | None: "you cannot restore the PostgreSQL instance to the previous version" |
| Crunchy Bridge        | `pg_upgrade` on a hidden standby, then fail over                            | 18                                  | Detach a replica beforehand                                                |
| Aiven                 | In place with `pg_upgrade --link`, then `ANALYZE`                           | 19 (in its version table)           | None                                                                       |
| Supabase              | In place with `pg_upgrade`, project offline                                 | 17                                  | Not stated                                                                 |
| Neon                  | New project, then migrate                                                   | 19                                  | The old project, as of the cut-over                                        |
| PlanetScale Postgres  | New database, then online import                                            | 18                                  | The old database, as of the cut-over                                       |
| Xata                  | Not through branch settings (minor versions only); other paths not verified | 18 (in its extensions list)         | Not applicable                                                             |

Before any of these, our [zero-downtime Postgres migrations checklist](/checklists/zero-downtime-postgres-migrations) covers the schema side.

## Free tiers

| Provider                                        | Free tier                                                                                                                                                        |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Neon                                            | Per project: 100 CU-hours a month and 1 GB of storage; up to 100 projects and 20 GB of storage in total; scales to zero after 5 minutes, 10 branches per project |
| Supabase                                        | 500 MB database, 2 active projects, paused after a week without activity, no branching, no backups                                                               |
| Aiven                                           | 1 CPU, 1 GB RAM, 1 GB storage, no region choice, powered off when idle and can be powered on again, no time limit                                                |
| Azure                                           | 12 months of a B1MS server (750 hours), 32 GB storage, for new accounts                                                                                          |
| AWS                                             | New accounts since July 2025: a 6-month Free plan with $100 to $200 in credits, RDS on micro instances                                                           |
| Google Cloud                                    | No free Cloud SQL; $300 in credits and a 30-day trial instance                                                                                                   |
| DigitalOcean, Crunchy Bridge, PlanetScale, Xata | None (PlanetScale starts at $5, Crunchy Bridge Hobby at $9, Xata has a trial)                                                                                    |

Three free tiers have no end date: Neon's, Supabase's and Aiven's. They are different shapes. Neon gives many small projects that sleep when idle, Supabase gives two that pause after a week, and Aiven gives one small server that powers off when you stop using it.

## What we could not measure

- **No managed in-place upgrade was timed.** Neon has no in-place upgrade (we timed its dump-and-restore path), our Supabase Free project had no eligible target, and the other providers were not benchmarked. The local numbers show the `pg_upgrade` step on one host, not a managed service's downtime.
- **No branch, clone or point-in-time restore on RDS, Aurora, Cloud SQL, Azure, DigitalOcean, Crunchy Bridge, Aiven, PlanetScale or Xata was timed.** The tables describe them from their docs. The Neon restore was timed at one size only, so it says nothing about how restore time grows with the data.
- **Price is list price only.** No egress, no reserved or committed-use discounts, no support plans, no separately billed backup storage or restore history. A one-year RDS reservation changes the RDS row; we did not model it.
- **One region, two days.** The Neon branch and upgrade numbers come from one session in aws-eu-central-1, and the restore numbers from a second session four days later, with the client in Amsterdam. The branch times were tight (2.6 to 3.5 seconds across all 20 runs), but another region or another day can differ.
- **One table.** Upgrade times grow with the number of tables and indexes, which our dataset does not have.
- **Sizes do not match exactly.** Every mismatch is in the notes above and in `prices/plans.mjs`.

We also threw away a first full run. A security review of the repo found that `pg_dump` and `pg_restore` connected with `sslmode=require`, which encrypts but does not check the server's certificate, and our own fact check found that the data check summed only two columns, and that the filler (one repeated character) made dumps compress unrealistically well. We fixed all three and ran every stage again. The first run's files are in `results/run1-superseded/` for comparison; the change in proportion was largest for the Neon dump, from 17 to 47 seconds, most likely because the new filler compresses far less (the first run did not record dump size).

## So which one

- **You want RDS without RDS:** Cloud SQL, Crunchy Bridge, DigitalOcean and Azure cost about the same with a standby. Pick on the cloud you already use and on how the upgrade works. On Crunchy Bridge, writes stop while `pg_upgrade` runs on a hidden standby and during the failover, and if the upgrade fails they resume on the original server. DigitalOcean's in-place upgrade has no rollback once it starts.
- **You want branches with data for every pull request:** Neon and Xata do copy-on-write, and so does Aurora up to 15 clones per source. On Supabase and PlanetScale, plan for data-less branches or restores.
- **You are cost-bound and can live without a standby:** Supabase, one node, costs about half the RDS HA total at M and L. The always-on Neon Launch configuration costs 78% to 81% of it, before restore history, and less when it scales to zero: about $107 at M for a database busy 8 hours on weekdays. Neon is one compute on storage replicated across zones: a failed compute is restarted or moved on the same storage, which Neon says typically takes seconds to minutes. There is no standby compute, and no uptime SLA on Launch. On either, know what happens when the compute fails, and test it.
- **You are on an old major version:** price the Extended Support months on RDS, Cloud SQL or Azure against an upgrade you will have to do anyway.

Whichever you pick, rehearse the next major upgrade before you need it. That is the operation the price list does not show, and the one most likely to decide whether you move again.
