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

Teams leave RDS for three reasons: the bill, the wait for a copy of production to test on, and the major version upgrade they keep putting off. We checked all three across RDS and ten alternatives.

The first result surprised us. With a standby in the price, RDS is not the expensive one: Google Cloud SQL, Crunchy Bridge, DigitalOcean and Azure land between 8% below and about 10% above it at both sizes we priced with high availability. Most of the much cheaper options sell you one node.

The other two decide the choice. A Neon branch of a 1.58 GB database was queryable in 2.7 seconds, the same as for 0.16 GB. On RDS, the same request is "restore a snapshot into a new instance". A major version upgrade is four different procedures, with downtime from seconds to however long a dump and restore of your database takes.

The scripts, raw results and every price quote are in a public repo you can run.

## TLDR

- **Price.** With a standby that takes over on its own, a 2 vCPU / 8 GB / 200 GB database costs $266 to $319 a month on Cloud SQL, RDS, Crunchy Bridge, DigitalOcean and Azure (RDS: $289). At 8 vCPU / 32 GB / 1 TB it is $1,126 to $1,275 (RDS: $1,198). If HA bills storage twice, Crunchy Bridge rises to $320 and $1,320.
- **Cheaper rows mostly have no standby.** Supabase ($150 and $549) is one node. Neon ($225 and $969, always on) is one compute on storage replicated across zones: a failed compute restarts, a short outage, not a failover. Scaled to zero, a 2 vCPU staging database busy 8 hours on weekdays costs about $107.
- **Branching.** Neon branches had the parent's data and were queryable in a median 2.70 s at 0.16 GB and 2.72 s at 1.58 GB. Supabase branches need Pro and are data-less by default. RDS, Azure, DigitalOcean, Aiven and Crunchy Bridge restore a backup into a new, fully billed instance.
- **Restore.** After a `DROP TABLE` on 1.58 GB, Neon's instant restore brought the data back on the same connection string in a median 9.71 s. RDS restores into a new DB instance; we did not time that.
- **Upgrades.** On our server, stopping Postgres 17, running `pg_upgrade --link` and starting 18 took 3.4 s on 4.71 GB and kept the planner statistics. A dump and restore took 3 min 34 s, with no statistics until `ANALYZE` or `pg_dump --statistics`.

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

We only timed services we could run for free or already pay for, and we would not touch a production AWS account for a benchmark:

| Stage                        | Services                                                                                              | What and where                                                                                                                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Measured on managed services | Neon, Supabase Free                                                                                   | Neon: branching, point-in-time restore, a 17 to 18 upgrade by dump and restore. Supabase: what the API allows. AWS eu-central-1, client on a DigitalOcean droplet in Frankfurt (Amsterdam for the restore). |
| Measured on our own server   | Postgres 17.12 and 18.7, official Docker images, same data                                            | Three of the four upgrade methods: `pg_upgrade`, dump and restore, logical replication. Not built: `pg_upgrade` on a hidden standby plus failover.                                                          |
| Read, not measured           | RDS, Aurora, Cloud SQL, Azure Flexible Server, DigitalOcean, Crunchy Bridge, Aiven, PlanetScale, Xata | Price lists, pricing APIs and docs, fetched 23 November 2026. Every price in the repo has its URL and a one-line quote.                                                                                     |

Stages ran one after the other on the same droplet, so no two shared it. The data is one pgbench-style `accounts` table with a primary key and an 84-character md5-hex filler, generated on the server: 1 million rows (0.16 GB), 10 million (1.58 GB) and 30 million (4.71 GB).

Real schemas have many more tables and indexes, and `pg_upgrade` time grows with the object count. Treat our upgrade times as illustrative for this host and a one-table schema.

## What you pay at three sizes

Three sizes that match real deployments:

- **S:** about 2 vCPU and 4 GB, 50 GB of storage, one node. A side project or an internal tool.
- **M:** about 2 vCPU and 8 GB, 200 GB, with a high-availability standby. A small production app.
- **L:** about 8 vCPU and 32 GB, 1 TB, with a standby. A busy production database.

Pricing rules, the same for every provider:

- The smallest plan with at least those vCPUs and that RAM (shared or burstable CPU allowed at S) and at least that storage, rounded up to the provider's increments.
- US East, on demand, 730 hours a month.
- Compute and storage only: no egress, discounts, or separately billed backups or restore history (Cloud SQL, for one, charges $0.08 per GiB-month of backup storage used).
- Storage in GB; for GiB-billed providers we converted, then rounded to their increments.

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

### What the table hides

The rows are not like for like:

| Provider       | The catch                                                                                                                                                 |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aurora         | No 8 GB class in this family: M is an r7g.large (16 GB), L has 64 GB. Standard adds $0.20 per million I/O requests. 1.4 to 2 times RDS, depending on I/O. |
| Neon           | 1 CU is 1 vCPU and 4 GB, so 2 vCPU brings 8 GB and S is its priciest row. Always-on Launch prices, no standby compute (next section).                     |
| Xata           | No published replica price. We assumed it equals the primary and counted storage once.                                                                    |
| Aiven          | No 8 CPU / 32 GB plan. L is business-64 with 61 GB.                                                                                                       |
| Crunchy Bridge | HA "doubles the cluster price", storage not specified, so M and L are ranges.                                                                             |
| PlanetScale    | 8 GB RAM per vCPU. HA is always a primary and two replicas, storage billed on all three (less 10 GB each).                                                |
| Azure          | Fixed Premium SSD sizes: 50 GB bills as 64 GiB, 200 GB as 256 GiB, with 240 and 1,100 IOPS. gp3 on RDS has a 3,000 IOPS baseline.                         |
| DigitalOcean   | Storage billed apart. New Standard clusters cannot exceed 4 GiB of RAM or have a standby, so M and L use Advanced.                                        |
| Supabase       | No generally available standby. Read replicas do not take over on their own.                                                                              |

<details>
<summary>More detail on Aurora, Xata, Aiven, Crunchy Bridge and DigitalOcean</summary>

- **Aurora:** I/O-Optimized has no I/O charge and is the cheaper of the two above about 731 million requests a month at M and about 3 billion at L.
- **Xata:** its docs say replicas "provide high availability, automated failover". Xata is joining ClickHouse and says it will eventually move customers to ClickHouse's managed Postgres.
- **Aiven:** business-32 (4 CPUs, 30 GB) plus storage would be about $1,580.
- **Crunchy Bridge:** S is Hobby-4, listed with 2 burstable cores in Crunchy's docs and 1 on its pricing page. With 2 dedicated cores (Standard-8, 8 GB), S is $145.
- **DigitalOcean:** the Standard limit applies to new accounts since 15 October 2026 and to all accounts from 30 November.

</details>

### Neon: one compute on replicated storage

The Neon rows are always-on Launch plan prices. What moves them:

- **Scale to zero.** Compute bills only while it runs. A staging or preview database at M, busy 8 hours on weekdays, runs about 174 hours a month (8 hours × about 21.75 weekdays): 2 CU × 174 h × $0.106 per CU-hour is $36.89 of compute, plus $70 for 200 GB at $0.35 per GB-month. About $107 a month instead of $225. The 5 minutes the compute stays up after the last query each day add about $0.38 a month.
- **An uptime SLA.** Launch has none. On the Scale plan, which has one, M is $394 and L is $1,646.
- **Restore history** ($0.20 per GB-month of changes) is not included. At $0.35 per GB-month, storage is $350 of the $969 at L.

Neon has no standby compute, and a compute runs in one availability zone at a time. The storage is what is replicated.

Per [Neon's high availability docs](https://neon.com/docs/introduction/high-availability), the safekeepers that receive the WAL "are distributed across multiple Availability Zones", secondary pageservers keep copies of the data, and the long-term copy is in object storage. A failed compute is restarted or moved to another node, on the same storage. Typical times, per the docs:

| Failure        | What happens                                       |
| -------------- | -------------------------------------------------- |
| Postgres crash | Restarted "within a few seconds"                   |
| Failed node    | Its computes move to another node in "1-2 minutes" |
| Zone outage    | Computes move to a healthy zone in "1-10 minutes"  |

Compute failures "don't affect your data", Neon says, but connections, temporary tables and the compute's cache are lost. Plan for a short outage, not a failover.

### What grows an RDS bill

If RDS is mid-pack on list price, the big RDS bills come from three lines in the price list:

1. **Multi-AZ doubles everything.** db.m7g.large is $0.168 an hour in one zone and $0.337 with a standby; gp3 goes from $0.115 to $0.23 per GB-month. Cloud SQL and Azure double the same way. It only looks like an RDS tax next to a one-node service.
2. **IOPS above the baseline.** gp3 on RDS gives 3,000 IOPS and 125 MiB/s below 400 GiB. Each extra provisioned IOPS is $0.02 a month, or $0.04 with Multi-AZ.
3. **Extended Support.** Once a major version leaves standard support, RDS enrolls the instance in paid Extended Support: $0.10 per vCPU-hour in years one and two, $0.20 in year three.
   - One 8 vCPU instance pays $584 a month, then $1,168. The Multi-AZ standby is charged too, so L pays $1,168, then $2,336.
   - Cloud SQL and Azure charge for extended support too, at their own rates.
   - Supabase, Aiven and Crunchy Bridge upgrade you automatically instead. DigitalOcean publishes end-of-life dates and mentions scheduled upgrades, with no timing we could confirm.
   - We covered [the same charge on RDS for MySQL 8.0](/posts/aws-rds-extended-support-mysql-8-0-charges).

Where old versions cost extra, putting off the upgrade has a monthly cost.

## Branching: seconds or a new instance

A branch is a copy of the database you can break: one per pull request, one for a migration rehearsal, one for a support engineer who needs production-shaped data. How fast you get one, and whether it has data, depends on how the service stores data:

```diagram
{
  "type": "graph",
  "columns": [
    [
      { "id": "parent", "label": "Neon parent", "sub": "its own compute", "icon": "cpu", "tone": "blue" },
      { "id": "branch", "label": "Neon branch", "sub": "new 1 CU compute", "icon": "branch", "tone": "green", "detail": "No data is copied at creation. Queryable in a median 2.70 s at 0.16 GB and 2.72 s at 1.58 GB." },
      { "id": "rds", "label": "RDS instance", "sub": "the source", "icon": "server", "tone": "amber" }
    ],
    [
      { "id": "store", "label": "Shared storage", "sub": "copy-on-write", "icon": "database", "tone": "violet" },
      { "id": "s3", "label": "Snapshot and logs", "sub": "in S3", "icon": "cloud", "tone": "slate" }
    ],
    [
      { "id": "copy", "label": "New RDS instance", "sub": "new endpoint, billed in full", "icon": "server", "tone": "amber", "detail": "Available before all blocks are loaded; the rest load from S3 in the background. We did not time this." }
    ]
  ],
  "edges": [
    ["parent", "store", "reads"],
    ["branch", "store", "reads"],
    ["rds", "s3", "backups"],
    ["s3", "copy", "restore"]
  ]
}
```

### Neon: measured

We loaded the table into a Postgres 17 project on Neon and created 10 branches, each with its own 1 CU compute. The clock ran from the API request to the first query that read the parent's last row through the branch. Then we read the whole branch table and compared the row count and a sum of per-row hashes over every column with the parent's.

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

Ten times the data, the same time: a median 2.70 s at 0.16 GB and 2.72 s at 1.58 GB, all 20 runs between 2.6 and 3.5 s. A Neon branch copies no data at creation; its compute reads pages from storage it shares with the parent.

Of the median, about 0.5 s is the API call, 1.7 s is waiting for Neon's operations (creating the branch, starting its compute), and 0.5 s is getting the connection string, connecting and querying.

The full-table check on a new branch took a median 12.3 s at 1.58 GB on 1 CU. We did not time it on the parent, so we cannot split it into uncached reads on the branch's compute and the hashing itself.

### What the others do

For a sense of what copying costs, we timed `CREATE DATABASE ... TEMPLATE` on our own Postgres 18 server, which copies every file of the source. With the faster `file_copy` strategy: a median 0.21 s, 2.37 s and 11.42 s at the three sizes, on local SSD. Quick at these sizes, but it grows with the data; the copy-on-write branch did not.

It is not a model of a managed restore. Those provision a new instance, and RDS, for one, makes it available first and loads blocks from S3 in the background.

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

We measured Supabase Pro branches in June: [about 6.5 seconds, schema only](/posts/neon-vs-supabase-operational-benchmarks), and `with_data` failed on a fresh project. If preview environments need production-shaped data, check that path first. The [Neon vs Supabase comparison](/comparisons/neon-vs-supabase) has the rest of that matchup.

A restore-based clone is still useful: a full, independent copy you can resize and keep, billed as a full instance, and on RDS from any second in your retention window. It is the wrong tool for one database per pull request, where copy-on-write wins.

### Neon: measured restore

The same storage design answers the other question: how fast can you undo a bad change? We loaded the 1.58 GB table into a new Postgres 17 project in aws-eu-central-1. Five times, we read the server's clock, waited 2 seconds, ran `DROP TABLE accounts`, and asked Neon's [instant restore](https://neon.com/docs/guides/branch-restore) API to restore the branch to that timestamp.

The clock ran from the API request to the first query that read the original table's last row, through the branch's pre-restore connection string. Then we compared the row count and per-row hash sum with the values from before the drop.

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

On RDS, a point-in-time restore means "creating a new DB instance without modifying the source DB instance" ([AWS docs](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PIT.html)). We did not time it. Side by side:

|                         | Neon instant restore (measured)                                                                                    | RDS point-in-time restore (docs)                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| What you get            | The same branch, at the timestamp                                                                                  | A new DB instance; the source is not modified                              |
| Connection string       | Unchanged; existing connections are interrupted                                                                    | The new instance's endpoint; repoint the application                       |
| Time                    | Median 9.71 s at 1.58 GB (8.42 to 15.32 s, 5 runs)                                                                 | Not timed; volumes keep loading blocks from S3 after it is available       |
| Restore point           | We used 2 s before the drop                                                                                        | Up to `LatestRestorableTime`; transaction logs go to S3 every five minutes |
| Writes after that point | On a backup branch of the pre-restore state; copy them back from there                                             | Still on the untouched source; compare the two before you switch           |
| How far back            | History window: up to 7 days on Launch, 30 on Scale; Launch bills restore history at $0.20 per GB-month of changes | Any second in your retention window                                        |

Notes on the Neon runs:

- **Where the time went.** Of the median, about 0.4 s was the API call, 8.2 s waiting for Neon's operations, and 1.1 s connecting and querying.
- **Why slower than a branch (2.72 s).** The operations stop and start the branch's own compute, which a new branch does not need. That is the likely reason, and it is why, as Neon's docs say, existing connections are interrupted.
- **Run order.** The first run, right after the load, was the slowest; each later run was a little faster.
- **Checks.** The first connection after the operations worked in every run, and every run matched the original data. The full-table check after the restore took a median 14.3 s on 1 CU.
- **Setup.** Scale plan account, default 1-day window. The client was in Amsterdam because Frankfurt had no droplet sizes available that day.

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

To price the steps before a provider wraps them, we ran three on one 4 vCPU droplet with local SSD, Postgres 17.12 to 18.7, three runs per size. For `pg_upgrade`, the clock runs from stopping the old server to the first answered connection on the new one, with a separate client opening a connection every 250 ms.

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

Times are medians of three runs. Every run matched the source row count and per-row hash sum; the logical replication runs lost 0 acknowledged rows with 0 failed writes.

<details>
<summary>Run-to-run spread, and the pg_upgrade command on its own</summary>

- The largest spread between runs at one size was 7.1 seconds for the `pg_upgrade` modes and 32.3 seconds for dump and restore.
- The `pg_upgrade` command alone took 3.0 s, 2.7 s, 2.9 s in link mode and 3.1 s, 5.5 s, 15.4 s in copy mode. The rest is stopping and starting the servers.

</details>

What the numbers say:

- **`pg_upgrade --link` barely depends on size.** It hard-links the data files, so most of the time is the catalog: 3.5 s, 3.6 s, 3.4 s from stop to first answer. Copy mode grows with the data: 3.5 s, 6.7 s, 15.8 s. Swap mode, new in Postgres 18, moves the directories and behaved like link mode.
- **Link and swap trade away the rollback.** The old data directory is unusable once the new server starts (link) or once `pg_upgrade` starts moving files (swap). Copy mode leaves the old cluster untouched, so it needs twice the disk.
- **Dump and restore grows with the data:** 7.3 s, 1 min 7 s, 3 min 34 s. No writer ran, so this estimates the transfer part of a write freeze, not an observed outage. Switching the application over comes on top.
- **Logical replication moves the wait out of the outage.** The initial copy of 10M rows took a median 40.2 s while the old server kept taking writes. At cut-over, the gap from the last write on the old server to the first on the new one was a median 102 ms (up to 50 ms of it the writer's own pause between inserts). No acknowledged row was lost.
  - One writer, one table, one machine: this is the order of magnitude for a caught-up subscriber, not a managed switchover. AWS says an RDS Blue/Green switchover "typically takes under a minute".
  - It does not copy DDL or sequence values, so the script moves the sequence by hand.

These numbers are for this host and one-table schema; other hardware and more objects change them. A managed in-place upgrade adds snapshots before and after, pre-checks and a restart, and the providers estimate minutes, not seconds:

- Supabase says a small project is offline for about 15 minutes.
- Crunchy Bridge and Snowflake Postgres say "a few minutes".
- DigitalOcean says the time "isn't predictable in advance".

### Neon: measured

Neon "doesn't upgrade a project to a new major version in place, and doesn't support pg_upgrade", in its own words. You create a project on the new version and move the data with its Import Data Assistant (under 10 GB), `pg_dump`/`pg_restore`, or logical replication.

We dumped the 10M-row table from a Postgres 17 project and restored it into a Postgres 18 project, from the droplet in the same region: three runs with default flags and three with `--statistics`, alternating.

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

The new 18 project was ready in a few seconds. Dump plus restore took a median 58.4 s with default flags and 57.6 s with `--statistics` (timed separately and added). Every run matched the source's row count and per-row hash sum.

Most of it was the dump, which compresses on the client; we did not check whether client CPU was the limit. As an estimate, writes would stop for that long, plus the time to switch your application over.

Our test deleted the source project before creating the target, because the account had one free project slot. In a real migration, keep the old project until the new one has taken over. It is then a copy as of the cut-over, not a rollback: writes made on the new project are not in it, so going back means reconciling or replicating them back.

If you cannot stop writes that long, rehearse the logical replication path, and a branch is a good place to [rehearse the migration](/posts/rehearse-migrations-on-a-neon-branch) first.

### Supabase: no target for our project

The Supabase Management API answered our new Free project's upgrade check with `"eligible": false` and an empty list of targets. The project came up on Postgres 17.12, and we found no Postgres 18 in Supabase's docs or API. Supabase does have an in-place upgrade (a button, or the experimental `/upgrade` endpoints); we could not time it.

### Your planner statistics

After a major upgrade the planner needs statistics; without them it can pick bad plans until autovacuum reaches each table. Who runs `ANALYZE` differs:

- RDS, Aurora, Cloud SQL and Azure tell you to run it after the upgrade.
- Aiven runs `ANALYZE` for you, and Crunchy Bridge runs `vacuumdb --analyze-in-stages`.

On stock Postgres it depends on the method. We counted the table's rows in `pg_stats` right after each upgrade, with autovacuum off on the new local server so it could not fill them in:

- After `pg_upgrade` from 17 to 18, all four columns had statistics, in every run at every size. Postgres 18's `pg_upgrade` carries them over.
- After `pg_dump`/`pg_restore` with default flags, and after logical replication, there were none.
- After `pg_dump --statistics`, all four columns had them, locally and on Neon. On Neon we did not turn autovacuum off, but it had not added statistics in the default-flag runs either.

We checked that statistics were present, not identical to the old ones. Whether your provider's upgrade keeps them depends on how it calls `pg_upgrade`, which we could not see. `ANALYZE` on the 30M-row table took 1.3 to 4.2 s across all runs. Run it.

### A trap if you upgrade your own servers

Postgres 18's `initdb` enables data checksums by default; 17's did not. So `pg_upgrade --check` from a default 17 cluster to a default 18 cluster stops with:

```text
old cluster does not use data checksums but the new one does
```

Create the new cluster with `--no-data-checksums`, or enable checksums on the old one first. Managed services handle this. A self-managed upgrade, or a container image that runs `initdb` for you, has to.

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

Three free tiers have no end date, in different shapes: Neon gives many small projects that sleep when idle, Supabase two that pause after a week, and Aiven one small server that powers off when unused.

## What we could not measure

- **No managed in-place upgrade was timed.** Neon has none (we timed its dump-and-restore path), our Supabase Free project had no eligible target, and we did not benchmark the others. The local numbers are the `pg_upgrade` step on one host, not a managed service's downtime.
- **No branch, clone or point-in-time restore outside Neon was timed.** RDS, Aurora, Cloud SQL, Azure, DigitalOcean, Crunchy Bridge, Aiven, PlanetScale and Xata are described from their docs. The Neon restore was timed at one size, so it says nothing about how restore time grows with data.
- **List price only.** No egress, reserved or committed-use discounts, support plans, separately billed backup storage or restore history. A one-year RDS reservation changes the RDS row; we did not model it.
- **One region, two days.** Neon branch and upgrade numbers come from one session in aws-eu-central-1, restore numbers from a second session four days later with the client in Amsterdam. Branch times were tight (2.6 to 3.5 s over 20 runs), but another region or day can differ.
- **One table.** Upgrade times grow with tables and indexes, which our dataset lacks.
- **Sizes do not match exactly.** Every mismatch is in the notes above and in `prices/plans.mjs`.

We also threw away a first full run, fixed three problems, and reran every stage:

- `pg_dump` and `pg_restore` used `sslmode=require`, which encrypts but does not check the server's certificate (found by a security review of the repo).
- The data check summed only two columns (found by our fact check).
- The filler, one repeated character, made dumps compress unrealistically well (also the fact check).

The first run's files are in `results/run1-superseded/`. The biggest proportional change was the Neon dump, from 17 to 47 seconds, most likely because the new filler compresses far less (the first run did not record dump size).

## So which one

| If you                                         | Look at                                                         | Why                                                                                                                                                                                                          |
| ---------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Want RDS without RDS                           | Cloud SQL, Crunchy Bridge, DigitalOcean, Azure                  | About the same price with a standby. Pick on your cloud and the upgrade method (below).                                                                                                                      |
| Want branches with data for every pull request | Neon, Xata (copy-on-write); Aurora (up to 15 clones per source) | On Supabase and PlanetScale, plan for data-less branches or restores.                                                                                                                                        |
| Are cost-bound and can live without a standby  | Supabase, Neon                                                  | Supabase (one node) is about half the RDS HA total at M and L. Always-on Neon Launch is 78% to 81% of it before restore history, and about $107 at M scaled to zero for a database busy 8 hours on weekdays. |
| Are on an old major version                    | Extended Support on RDS, Cloud SQL or Azure                     | Price those months against the upgrade you will have to do anyway.                                                                                                                                           |

Before you commit, check two things:

- **The upgrade path.** On Crunchy Bridge, writes stop while `pg_upgrade` runs on a hidden standby and during the failover; if the upgrade fails, they resume on the original server. DigitalOcean's in-place upgrade has no rollback once it starts.
- **A compute failure.** Neon is one compute on storage replicated across zones; Neon says a failed compute is restarted or moved on the same storage, typically in seconds to minutes. No standby compute, and no uptime SLA on Launch. On Supabase or Neon, know what happens when the compute fails, and test it.

Whichever you pick, rehearse the next major upgrade before you need it. That is the operation the price list does not show, and the one most likely to decide whether you move again.
