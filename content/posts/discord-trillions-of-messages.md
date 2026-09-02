---
title: 'How Discord Stores Trillions of Messages With a Tiny Team'
excerpt: 'Discord went from 12 database nodes to 177 to 72, while message volume went from billions to trillions. The interesting part is not the migration to ScyllaDB; it is what they built in front of the database, and what their three worst problems teach anyone running a hot datastore at any scale.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-08-29'
publishedAt: '2026-08-29T16:00:00Z'
updatedAt: '2026-08-29T16:00:00Z'
readingTime: '15 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Architecture
  - Databases
  - Scale
  - Cassandra
  - ScyllaDB
---

Some engineering stories are worth studying because the numbers are absurd, and some because the lessons transfer. Discord's message-storage story, told across their own engineering posts ([2017](https://discord.com/blog/how-discord-stores-billions-of-messages), [2023](https://discord.com/blog/how-discord-stores-trillions-of-messages)), is both: trillions of stored messages, migrated live in nine days, by a team small enough to fit around one table. All numbers below come from those two posts.

The arc in one paragraph: in 2017 Discord ran 12 Cassandra nodes storing billions of messages. By early 2022 that had grown to 177 nodes storing trillions, and the cluster was hurting in ways that paged humans. In 2022 they moved everything to ScyllaDB, ending at 72 nodes of 9TB each, with p99 read latency dropping from a wandering 40-125ms to a steady 15ms. Fewer nodes, more data, an order of magnitude calmer tail.

The migration headline is fun, but the durable lessons live in the data model, the three problems that forced the migration, and the thing they built that was not a database at all.

## First, the data model that carried them

The 2017 chapter starts where most scaling stories do: the original database hit a wall. Discord launched on a single MongoDB replica set, and by November 2015, at 100 million messages, the data and indexes no longer fit in RAM and latency went unpredictable. Their traffic made it worse than it sounds: reads and writes were roughly 50/50, and reads were highly random, which is the workload page caches hate most.

The move to Cassandra came with the design decision the whole story rests on. Messages are identified by Snowflake IDs (Twitter's chronologically sortable 64-bit IDs), so the natural key was `(channel_id, message_id)`: all of a channel's messages in one partition, sorted by time for free. Then the import taught them the classic wide-partition lesson: big channels blew past 100MB per partition, and giant partitions meant GC pressure and compaction pain. Cassandra advertises support for 2GB partitions; Discord's write-up delivers one of the great one-liners of database operations: just because it can be done does not mean it should.

The fix was **time bucketing**. They measured their largest channels and found that 10 days of messages stayed comfortably under 100MB, so the key became `((channel_id, bucket), message_id)`, where the bucket is derived from the timestamp. Partition size is now bounded no matter how big a channel gets, and quiet channels just query a few sequential buckets.

That key design is the most reusable artifact in the whole saga. "Partition by tenant" is where everyone starts; "partition by tenant plus a bounded time window" is where high-write systems end up, and getting there before the import, rather than six months into production, is the cheap version.

## Problem 1: the hot partition

Discord partitions messages by channel (plus a time bucket), which distributes load beautifully as long as channels are similarly busy. They are not. A three-friend server generates orders of magnitude less traffic than a two-hundred-thousand-person community, and when something happens in a huge channel, a flood of concurrent reads lands on the one partition that holds it.

That is a **hot partition**, and its signature is the nasty part: the node serving the hot partition slows down, queues back up, and every other partition on that node gets slow too. Latency spreads sideways to users who have nothing to do with the busy channel. The failure is invisible in averages, obvious in the tail, and it is the same mechanism whether you run 177 nodes or a single Postgres with one viral customer row. (Our [latency percentiles simulator](https://devops-daily.com/games/latency-percentiles-simulator) shows exactly this signature: a healthy median over a growing tail.)

## Problem 2: the garbage collector

Discord's Cassandra cluster ran on the JVM, and the JVM stops the world to collect garbage. At their read/write volume, GC pauses produced latency spikes big enough to page people, and in bad cases nodes needed manual reboots to recover.

The general lesson is not "avoid Java". It is that at the tail, **your database's runtime is part of your latency budget**. p99 problems that correlate with nothing in your query patterns often live a layer down: GC, compaction, page cache pressure. ScyllaDB being a C++ rewrite of Cassandra with no GC was a major reason it was the destination; the shape of their p99 graph before and after says the diagnosis was right:

```chart
{
  "type": "bar",
  "title": "Message read latency, p99",
  "unit": "ms",
  "rows": [
    { "label": "Cassandra, worst observed p99", "value": 125, "series": "Cassandra" },
    { "label": "Cassandra, best observed p99", "value": 40, "series": "Cassandra" },
    { "label": "ScyllaDB p99", "value": 15, "series": "ScyllaDB" }
  ],
  "series": [
    { "name": "Cassandra", "color": "#38bdf8" },
    { "name": "ScyllaDB", "color": "#10b981" }
  ],
  "refs": [{ "value": 15, "label": "post-migration" }],
  "caption": "Numbers from Discord's 2023 engineering post: p99 reads went from a 40-125ms range on Cassandra to a steady 15ms on ScyllaDB. Inserts went from 5-70ms to a stable 5ms."
}
```

## Problem 3: maintenance that becomes a lifestyle

The third pain was compaction falling behind. Cassandra compacts SSTables in the background, and once a cluster falls behind under load, operators start doing what Discord called a gossip dance: pull a node out of rotation so it can compact in peace, bring it back, let it catch up on hints, repeat, node after node.

Every ops team knows some version of this: a routine background process that quietly becomes a manual, rotating chore. The lesson is diagnostic: **when babysitting a system becomes a recurring calendar event, the system is telling you its design no longer fits your load.** Discord's answer was not better runbooks; it was removing the reason the runbook existed.

## The tombstone wars

Deletes deserve their own chapter, because in log-structured databases a delete is not a removal, it is a **tombstone**: a marker written on top, reconciled at read time, cleaned up later by compaction. Discord ran into both of the classic tombstone disasters, five years apart.

The first was self-inflicted and invisible: their writer sent null values for unset columns, and Cassandra treats a null write as a delete. Result: about **12 tombstones written per average message**, pure overhead, fixed by simply not writing nulls. The generalizable habit is knowing what your driver actually emits, because ORMs and serializers make this class of mistake silently.

The second is the famous one. Six months after launch, a node started running ten-second stop-the-world GC pauses. The cause was one channel, a Puzzles & Dragons subreddit server, that had deleted its way down to **one visible message sitting on top of millions of tombstones**. Every load of that channel made Cassandra wade through the graveyard to find the survivor. The mitigation: cut tombstone lifetime from 10 days to 2 (with nightly repairs to make that safe) and track empty buckets so queries skip them entirely.

Tombstones also close the loop on the 2022 migration: the final blocker before the ScyllaDB migrator could finish was compacting gigantic tombstone ranges in Cassandra. The deletes of 2017 were still shaping operations five years later, which is the most honest definition of technical debt you will find.

## The part everyone skips: the layer in front

Here is the piece that transfers to every stack, at every scale. Before migrating anything, Discord built **data services**: a Rust layer that sits between the API and the database, whose star feature is **request coalescing**. When a thousand users request the same message row at once (exactly what a hot channel produces), the service makes one database query and fans the result out to all thousand waiters. Consistent hash routing by channel ID sends all traffic for a channel to the same service instance, so coalescing actually catches the duplicates.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "API clients", "sub": "1,000 identical reads", "icon": "globe", "tone": "slate" },
    { "label": "Data service", "sub": "Rust, coalesces to 1 query", "icon": "shield", "tone": "green" },
    { "label": "ScyllaDB", "sub": "sees 1 read, not 1,000", "icon": "database", "tone": "violet" },
    { "label": "Fan-out", "sub": "one result, 1,000 answers", "icon": "queue", "tone": "blue" }
  ]
}
```

Notice what this means: the hot-partition problem was partially solved **before the database changed**, by making the database see less of the load. That ordering is the real architecture lesson. The database swap fixed GC and compaction; the protective layer fixed the traffic shape. Teams reach for a migration first because it feels decisive, but the layer in front is cheaper, lower-risk, and usually where the win is. At normal scale this same idea is a cache with request deduplication, or a materialized read path; the principle is identical.

Their storage hardware story rhymes with this: cloud persistent disks had the durability but not the latency, so they built "super-disks": local NVMe for speed, RAID-mirrored to persistent disks for durability. Same pattern again: keep the slow-but-safe thing, put a fast layer in front of it.

### Coalescing is small enough to build yourself

The idea sounds exotic at Discord's scale and is almost embarrassingly small in code. Here is the whole mechanism, runnable as-is: keep a map of in-flight requests per key, and make duplicate callers await the existing one.

```python
import asyncio

db_queries = 0

async def db_read(key):
    global db_queries
    db_queries += 1
    await asyncio.sleep(0.05)          # one slow database read
    return f"row:{key}"

class Coalescer:
    def __init__(self):
        self.inflight = {}

    async def read(self, key):
        if key in self.inflight:        # someone already asked: wait for theirs
            return await asyncio.shield(self.inflight[key])
        task = asyncio.create_task(db_read(key))
        self.inflight[key] = task
        try:
            return await task
        finally:
            del self.inflight[key]
```

Fire a hot-channel burst at it, with and without coalescing (this is a real run, not sketched output):

```terminal
{
  "title": "request coalescing",
  "prompt": "$",
  "steps": [
    { "cmd": "python3 coalesce.py" },
    { "comment": "1,000 concurrent reads of the same key, through the coalescer" },
    { "output": "clients served: 1000, database queries: 1" },
    { "comment": "same 1,000 reads, no coalescing" },
    { "output": "clients served: 1000, database queries: 1000" }
  ]
}
```

One thousand callers, one database query. In Go this is `singleflight` from the standard extended library; in most stacks it is twenty lines. If your system has any hot-key read pattern, this is among the highest ratio of latency saved to code written that exists.

## The migration itself

The plan was to migrate with ScyllaDB's Spark-based migrator, estimated at three months. They did not want to babysit a migration for a quarter, so they rewrote the migrator in Rust, and the estimate fell to **nine days**, running at up to 3.2 million messages per second, with the last obstacle being enormous tombstone ranges in Cassandra that needed compacting before they would move.

Two things worth keeping from that: first, migration tooling is code, and investing engineer-weeks in it can buy back engineer-months of supervised risk. Second, the messages moved while Discord kept running; the era where a migration of this size implied a maintenance window is simply over, and your users' expectations know it.

Worth stealing from the 2017 playbook too: before Cassandra went primary, they ran a **dark launch**, double-writing to MongoDB and Cassandra while reads still came from the old system. It surfaced a genuinely subtle bug before users could: concurrent edits and deletes, racing under Cassandra's last-write-wins conflict resolution, could resurrect corpses of deleted messages as corrupted rows with only a primary key and text. The fix (delete any message missing required columns like the author) is less important than the pattern: double-write early, read-compare quietly, and let the race conditions introduce themselves while the blast radius is zero.

## What this means if you are not Discord

- **Find your hot partitions before they find you.** Whatever your store, some key is orders of magnitude hotter than the median. Know which, and know what happens to neighbors when it spikes.
- **Chase tail latency into the runtime.** If p99 spikes do not correlate with queries, look at GC, compaction, and background maintenance. The database's internals are part of your SLO.
- **Build the protective layer before the migration.** Coalescing, caching, and read-path shaping change what the database experiences, at a fraction of a migration's risk.
- **Treat recurring manual maintenance as a design signal**, not an ops failure.
- **If a migration is unavoidable, make the tooling fast enough to be boring.** Nine supervised days beat ninety.

The deeper pattern in this story is that storage-engine design decides operational reality: Discord's pain (GC, compaction, tombstones) and Discord's wins (coalescing, super-disks) all live below the query layer. If that angle interests you, we recently went deep on another example of it: [how Lakebase Postgres, the storage architecture you get on Neon, makes the WAL itself the database](https://devops-daily.com/posts/wal-as-the-source-of-truth-lakebase-storage-s3), where the same kind of architectural bet makes branching and point-in-time restore nearly free instead of heroic.

Discord's own posts are worth reading in full: [2017's billions](https://discord.com/blog/how-discord-stores-billions-of-messages) for the data-model thinking, and [2023's trillions](https://discord.com/blog/how-discord-stores-trillions-of-messages) for everything above. For the hands-on version of the concepts, our [message queue](https://devops-daily.com/games/message-queue-simulator) and [database scaling](https://devops-daily.com/games/database-replication-sharding-scaling) simulators let you cause lag, hot spots and rebalances on purpose, which is considerably cheaper than learning them at a trillion messages.
