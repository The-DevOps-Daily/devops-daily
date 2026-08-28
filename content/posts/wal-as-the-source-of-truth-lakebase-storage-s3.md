---
title: 'WAL as the Source of Truth: What Lakebase Storage on S3 Means for You'
excerpt: 'Neon published a deep dive on the storage engine behind Lakebase Postgres: the write-ahead log is the database, S3 holds the history, and Postgres itself runs stateless on top. This is the reader-level version, with a hands-on session where we watch LSNs move, delete a table, and branch back to the moment before the mistake in under a second.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-08-28'
publishedAt: '2026-08-28T12:00:00Z'
updatedAt: '2026-08-28T12:00:00Z'
readingTime: '13 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - neon
  - postgres
  - wal
  - storage
  - branching
  - architecture
---

Every Postgres you have ever run keeps two copies of the truth: the data files, and the write-ahead log that describes how the data files got that way. The log exists so the database can survive a crash, and it moonlights as the feed for replication and point-in-time backups. But in the classic design it is a means to an end: the data files are the database; the log protects them.

Neon's storage engine, the one now running under **Lakebase Postgres**, inverts that. The WAL is the database. The data pages you query are a derived artifact, materialized from the log on demand, and the durable home of everything is object storage. Neon wrote up the internals in [a deep dive worth your time](https://neon.com/blog/wal-s3-lakebase-storage-for-the-era-of-agents); this post is the reader-level version: what the architecture actually is, why running an OLTP database on S3 is not the latency disaster it sounds like, and what the design buys you day to day. Then we stop reading and try it: we watch the LSN move as we write, delete a table on purpose, and branch back to the moment before the mistake.

## TLDR

- Classic Postgres treats data files as the truth and the WAL as protection. This design flips it: **the WAL is the authoritative change stream**, pages are derived from it, and history is a first-class thing you can address.
- Three components split the work: **safekeepers** make commits durable by replicating WAL to a quorum, **pageservers** turn WAL into pages on demand, and **S3** stores the immutable history.
- S3 sits off the hot path: reads come from memory, local NVMe, or a pageserver, and commits land on replicated WAL. Only a pageserver cache miss reaches into object storage.
- Every read is "give me page X **as of LSN Y**". Current state is just the newest LSN, which is why reading last Tuesday costs the same as reading now.
- Branching and point-in-time restore stop being copy operations and become pointers to an LSN. In the hands-on session below, branching a database to a pre-mistake LSN took **0.46 seconds** over the API.

## Prerequisites

- Comfortable with basic Postgres and SQL
- A rough idea of what a write-ahead log does (we recap in one paragraph)
- For the hands-on part: any project on Neon (the free plan works) and either `psql` or a Postgres driver

## The recap you need: WAL and LSNs

Before Postgres touches a data page, it writes a record of the change to the write-ahead log. Each record has a **Log Sequence Number (LSN)**, a monotonically increasing position in that log. Crash recovery is just replaying the log from the last checkpoint. This is stock Postgres, running everywhere since forever.

Which means stock Postgres already contains a complete, ordered timeline of every change. It just throws the timeline away once it is safe to do so, because the architecture assumes the data files are the point. The whole Lakebase storage design comes from refusing to throw it away.

## Three components, one inversion

In this architecture, the Postgres you connect to is a **stateless compute**: parsing, planning, MVCC, locks, all standard, with no durable local disk. Durability and history live in a storage layer with three parts.

```diagram
{
  "type": "graph",
  "columns": [
    [
      { "id": "pg", "label": "Postgres compute", "sub": "stateless, standard PG", "icon": "box", "tone": "blue", "detail": "Parses, plans, executes. Streams WAL out; asks for pages by (page, LSN). No durable local state." }
    ],
    [
      { "id": "sk", "label": "Safekeepers", "sub": "WAL quorum", "icon": "shield", "tone": "green", "detail": "Paxos-based replication. A commit is durable once a quorum has the WAL record." },
      { "id": "ps", "label": "Pageserver", "sub": "GetPage@LSN", "icon": "server", "tone": "violet", "detail": "Materializes pages: finds the nearest image, replays WAL deltas up to the requested LSN." }
    ],
    [
      { "id": "s3", "label": "Object storage", "sub": "immutable history", "icon": "database", "tone": "amber", "detail": "Append-only image and delta layers. Files are created, merged, deleted; never overwritten." }
    ]
  ],
  "edges": [
    ["pg", "sk", "WAL stream"],
    ["pg", "ps", "GetPage@LSN"],
    ["sk", "ps", "WAL feed"],
    ["ps", "s3", "layers"]
  ]
}
```

**Safekeepers own durability.** When your transaction commits, compute streams the WAL records to several safekeepers using a Paxos-based protocol, and the commit is acknowledged once a quorum has them. Durability comes from replication consensus, not from one machine's fsync. This is the part that lets compute be stateless: the moment the quorum acknowledges, the transaction survives anything that happens to the Postgres process.

**Pageservers own materialization.** A pageserver consumes the WAL feed and, asynchronously and off the commit path, turns it into page versions persisted to object storage. Its second job is the read side, which is where the design gets interesting.

**Object storage owns history.** Pages in S3 are never overwritten in place. The history is an append-only collection of files that get created, merged, and eventually deleted, but never mutated.

## GetPage@LSN: every read is a history read

When compute needs a page it does not find in memory or in its local NVMe cache, it asks the pageserver for it, and the request names two things: the page, and the **LSN it wants the page as of**. The pageserver finds the most recent stored image of that page at or before the LSN, collects the WAL records between that image and the LSN, replays them, and returns exactly the version requested.

Sit with what that implies. There is no special "time travel mode". Reading the current state of the database is the ordinary case of the same operation: current state is just the newest LSN. A query against last Tuesday's data walks the same code path and, when the layers it needs are warm, costs roughly the same as a query against now; a cold historical read pays extra to fetch layers, like any cache miss.

To keep that lookup fast across millions of stored files, the storage is organized in two layer types: **image layers** (a snapshot of every key in a range, at one LSN) and **delta layers** (the changes within a key range and LSN range). Finding the right layers uses a persistent search tree that is copied rather than mutated as new layers land, so the index itself has a version per LSN, matching the data it indexes.

## The obvious objection: is S3 not slow?

An OLTP database with commits or point reads waiting on object storage would be unusable, and this design has neither.

On the write path, a commit waits for the safekeeper quorum, which is a network round trip to replicated disks, comparable to any synchronous-replication Postgres. Uploading materialized pages to S3 happens later, asynchronously, and no transaction waits for it.

On the read path, your query touches Postgres shared buffers, then the compute's local NVMe cache, then the pageserver, which itself keeps hot layers local. S3 is consulted inside the pageserver when it needs a layer it does not have, which is exactly the access pattern object storage is good at: bulk reads of immutable files. A cold read that misses every cache does wait on that fetch, the same way any cold cache costs you once.

So the counterintuitive summary holds: the durable, authoritative home of your database is S3, and in the common case your queries never notice.

## Hands-on: watch the log become the database

Reading about LSNs is one thing. Watching your own writes move one is better. Everything below ran against a project on Neon (the same one from [our migrate:fresh recovery post](https://devops-daily.com/posts/someone-ran-migrate-fresh-on-production)), and every number is as recorded.

First, make some history and watch the LSN advance:

```terminal
{
  "title": "psql on the main branch",
  "prompt": "neondb=>",
  "steps": [
    { "cmd": "CREATE TABLE lsn_demo(id serial PRIMARY KEY, note text, at timestamptz DEFAULT now());", "output": "CREATE TABLE" },
    { "cmd": "SELECT pg_current_wal_insert_lsn();", "output": " 0/28AF008" },
    { "cmd": "INSERT INTO lsn_demo(note) SELECT 'row ' || g FROM generate_series(1,1000) g;", "output": "INSERT 0 1000" },
    { "cmd": "SELECT pg_current_wal_insert_lsn();", "output": " 0/28EE470" },
    { "cmd": "SELECT pg_size_pretty(pg_wal_lsn_diff('0/28EE470','0/28AF008'));", "output": " 253 kB" }
  ]
}
```

Our insert moved the insert LSN from `0/28AF008` to `0/28EE470`, which is 253 kB of WAL (the rows plus their index entries and transaction bookkeeping; the counter is server-wide). In the architecture above, those 253 kB are not a byproduct of our insert. They **are** the insert, quorum-replicated by the safekeepers, on their way to becoming immutable layers in S3. `0/28EE470` is now an addressable name for "the database at the moment those rows existed", valid for as long as the retention window keeps that history.

Now the mistake:

```terminal
{
  "title": "still on main",
  "prompt": "neondb=>",
  "steps": [
    { "cmd": "DELETE FROM lsn_demo;", "output": "DELETE 1000" },
    { "cmd": "SELECT count(*) FROM lsn_demo;", "output": " 0" },
    { "comment": "in page-based storage, those rows are now a restore job away" }
  ]
}
```

In a conventional setup this is where you go find last night's backup and replay archives toward the moment before the delete, with a restore time proportional to database size. Here, the pre-delete state never stopped existing. It is addressable at `0/28EE470`, so we ask for a branch pointed there:

```terminal
{
  "title": "Neon API",
  "prompt": "$",
  "steps": [
    { "cmd": "curl -s -X POST https://console.neon.tech/api/v2/projects/$PROJECT/branches \\\n  -H \"Authorization: Bearer $NEON_API_KEY\" -H \"Content-Type: application/json\" \\\n  -d '{\"branch\": {\"name\": \"before-the-delete\", \"parent_id\": \"br-square-block-axy3u6gc\", \"parent_lsn\": \"0/28EE470\"}, \"endpoints\": [{\"type\": \"read_write\"}]}'", "output": "branch br-polished-lake-axkyow40 created at parent_lsn 0/28EE470\napi round trip: 0.46s" },
    { "comment": "connect to the new branch endpoint" },
    { "cmd": "SELECT count(*) FROM lsn_demo;", "output": " 1000" },
    { "cmd": "SELECT note FROM lsn_demo ORDER BY id LIMIT 3;", "output": " row 1\n row 2\n row 3" }
  ]
}
```

The branch request returned in **0.46 seconds**, and the first cold connection to its compute took about a second. Nothing was copied: the branch is a pointer to `0/28EE470` with copy-on-write semantics, so the rows are all there, the parent branch felt nothing, and nothing about the operation scales with data size: a terabyte database branches the same way, by pointer. The size-independence is the point, and it falls directly out of GetPage@LSN: a branch is just an LSN the storage already knows how to serve.

:::note
The LSNs, timings, branch IDs, and outputs above are from a real session on a small demo project. Your absolute numbers will differ; the shape will not.
:::

The whole session is packaged as a runnable script, cleanup included, if you want to watch it against your own project:

```github
The-DevOps-Daily/neon-wal-lsn-demo
```

## What the inversion buys you

Everything users experience as a feature is a corollary of "history is addressable":

- **Branching** is a pointer plus copy-on-write. You pay for what a branch changes and what history you retain, not for a copy, so per-developer, per-preview and per-agent branches stop being a storage cost conversation. This is the primitive behind [the everything-on-your-branch workflow](https://devops-daily.com/posts/neon-everything-on-your-branch-architecture) we have covered before.
- **Instant restore** is the branch trick pointed at a rescue: recovery time stops scaling with database size, because there is no restore, only a pointer. What you pay for is the retention window of history kept, not the size of the data.
- **Time travel queries** let you read a past LSN directly within retention, which is the calm way to answer "what exactly did the migration change" before you decide whether to restore at all.
- **Read replicas** attach a fresh compute to the same storage, a metadata operation rather than a data-provisioning one.
- **Scale to zero** falls out of stateless compute: nothing durable lives on the Postgres node, so suspending an idle compute is safe, and Neon quotes reactivation within a few hundred milliseconds. In our session the first connection to a brand-new branch compute, TLS included, took just over a second.

The "era of agents" framing in Neon's title is really about this bundle. An agent that wants to try a risky migration wants a cheap disposable copy, an undo button, and a database that costs nothing while the agent thinks. Those are the three corollaries above. But the same bundle is just as useful when the agent is a human with a Friday deploy, which is why this deep dive matters beyond the AI story.

One more corollary is aimed at your data team: because the durable record is in object storage anyway, the pageserver also transcodes materialized pages into columnar form. An analytical engine can then read the same single copy of the data (mostly columnar from object storage, plus the freshest changes from the pageserver) without a CDC pipeline mirroring Postgres into a warehouse. Neon calls the pattern LTAP, with parts of the analytical path still in preview; the operational win it aims at is one copy of the truth instead of two systems drifting apart.

## What this means for you

1. **Recalibrate restore expectations.** If your recovery plan budgets hours for restoring a large database, an architecture where restore is a pointer changes the math. We walked a real rescue in [the migrate:fresh postmortem](https://devops-daily.com/posts/someone-ran-migrate-fresh-on-production); the mechanism is the LSN addressing you just watched.
2. **Treat branches as disposable.** Creating one costs neither a copy nor meaningful time. Create one per experiment, per PR, per agent run, and delete them without ceremony; what you pay for is changed data and retained history.
3. **Know your retention window.** History you can address is history within retention. That window, not disk size, is your real recovery configuration on Lakebase Postgres, so set it deliberately.
4. **Keep the mental model.** One sentence carries the whole architecture: the log is the database, pages are a cache, and S3 remembers everything. Every feature above is that sentence wearing a different hat.

The deep dive itself has more on the layer index internals and the analytical path, and it is unusually readable for a storage-engine post: [WAL and S3: Lakebase storage for the era of agents](https://neon.com/blog/wal-s3-lakebase-storage-for-the-era-of-agents).
