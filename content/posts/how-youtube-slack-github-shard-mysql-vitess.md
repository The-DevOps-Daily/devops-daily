---
title: 'How YouTube, Slack and GitHub Shard MySQL: We Built the Vitess Pattern on Five Servers and Measured What It Costs'
excerpt: 'YouTube built Vitess, and Slack and GitHub use it for their largest MySQL workloads. We built the same primitives over five real MySQL servers and measured them: a scatter read took 4 shard queries and got a quarter of the throughput, every simulated half-finished cross-shard transfer lost money, an online split lost no rows, and a hot channel stayed hot at 128 shards.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-10-12'
publishedAt: '2026-10-12T09:00:00Z'
updatedAt: '2026-10-12T09:00:00Z'
readingTime: '16 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - DevOps
  - MySQL
  - Vitess
  - Sharding
  - Databases
  - Scalability
  - PlanetScale
---

Every large MySQL shop tells the same story with different numbers. [Vitess](https://vitess.io/docs/overview/history/) was created at YouTube in 2010, after replicas and application-level sharding stopped being enough, to put a routing layer in front of many MySQL servers. Slack moved [99% of its MySQL traffic](https://slack.engineering/scaling-datastores-at-slack-with-vitess/) onto Vitess, peaking at 2.3 million queries per second. GitHub split its main database by domain, and by 2023 reported [horizontally sharded Vitess clusters](https://github.blog/engineering/infrastructure/upgrading-github-com-to-mysql-8-0/) for the large domains that outgrew one primary.

The engineering blogs explain the architecture. What they rarely show is what each piece costs. So we built the core primitives ourselves, a hash vindex, a router, a lookup vindex and an online reshard, over five real MySQL 8.4 servers, loaded 200,000 chat messages and measured. The router is about 170 lines of Python, so you can read every decision.

## TLDR

- **The sharding key decides the price of a query.** Fetching one message by id with its channel known took 1 shard query, and our setup served 1,194 of those reads per second. Without the channel, the router had to ask all 4 shards: 307 reads per second, about a quarter.
- **A lookup vindex buys part of it back:** 2 shard queries per read and 710 reads per second, 2.3x the scatter version and 59% of the targeted one, at the cost of an extra write on every insert.
- **Cross-shard transactions without atomic commit can leave partial results.** We simulated a failure between the two commits in 52 of 2,000 transfers between accounts on different shards, and all 52 lost their 10 credits. The same failure on single-shard transfers lost nothing.
- **An online split lost nothing.** We split a shard in two, all three tables, while a writer kept inserting and a reader kept querying: 0 write errors, every one of 2,158 lookups found its message, 2,158 scatter reads returned no duplicates, and at the end every expected message id existed exactly once, on the right shard. Insert latency roughly doubled while the copy ran.
- **More shards do not fix a hot key.** The busiest channel held 12.3% of all messages. At 128 shards, where the ideal is 0.78% per shard, the busiest shard still held 14.6%.

## Prerequisites

- Familiarity with MySQL and with what replication and a primary are.
- To run the demo: Linux with `sudo`, `curl` and about 3 GB of disk. It builds an Ubuntu chroot with MySQL inside, so nothing is installed on your host. The setup downloads the `arm64` image (we used a Raspberry Pi 4); change `IMG` in `scripts/00-setup.sh` on x86.

```github
The-DevOps-Daily/mysql-shard-router
```

## Why these companies shard MySQL at all

Read replicas fix read load. Once writes or the dataset outgrow the biggest primary you can buy, after you have tuned what you can, horizontal sharding is what is left. The Vitess history page puts YouTube's problem in that order: replicas came first, then "write traffic became too high for the primary database to handle, requiring YouTube to shard data." Connections were the other pressure. The Vitess docs put each MySQL connection at between 256 KB and almost 3 MB of memory, and Vitess's answer was to multiplex many light client connections onto a small pool of real ones.

Resharding was the painful part. Sugu Sougoumarane, one of Vitess's creators, [told Percona](https://www.percona.com/blog/2016/03/10/percona-live-featured-talk-with-sugu-sougoumarane-vitess-the-complete-story/) about YouTube's first one: "It took an entire night of master downtime."

Slack's reason was a bad sharding key. Its original design put each workspace on one shard with all of its data. As big customers grew, their shards "reached the largest available hardware", while the fleet was "hitting some major hotspots, while also massively underutilizing the majority" of the databases. Slack re-sharded messages by channel id, migrating from the fall of 2016 to the end of 2020 with double writes and a parallel read-diffing system to compare old and new.

GitHub did the cheaper thing first. In 2021 it [described](https://github.blog/engineering/infrastructure/partitioning-githubs-relational-databases-scale/) splitting its main `mysql1` cluster by **schema domain**, groups of tables that are queried together, with linters that stopped a query from joining tables across domains. It moved its 130 busiest tables at once. In 2019 `mysql1` answered 950,000 queries per second; by 2021 the split clusters answered 1.2 million and the average load per host had halved. By 2023 GitHub ran 1,200+ MySQL hosts, 300+ TB and 5.5 million queries per second, with horizontally sharded Vitess clusters for the large domains that outgrew a single primary.

## The model: keyspace IDs, vindexes and ranges

Vitess does not hash a row straight to a server. It maps the sharding key to a **keyspace ID** (with a 64-bit hash vindex, as in our demo, that is 8 bytes), and each shard owns a range of that ID space. The function that does the mapping is a **vindex**. The primary vindex is to sharding what the primary key is to a table: every sharded table needs one.

Shard names are the ranges, in hex: `-40` owns IDs from `0x00` up to but not including `0x40`, and `c0-` owns `0xc0` to the end. Four equal shards are `-40`, `40-80`, `80-c0` and `c0-`. Splitting `c0-` gives `c0-e0` and `e0-`, and no row outside that range has to move. That is the property that makes resharding possible without rehashing everything.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "channel_id 1", "sub": "sharding key", "icon": "box", "tone": "slate" },
    { "label": "hash vindex", "sub": "8-byte keyspace ID", "icon": "gear", "tone": "violet" },
    { "label": "0xf6fc42…", "sub": "falls in c0-", "icon": "branch", "tone": "amber" },
    { "label": "shard c0-", "sub": "MySQL :3314", "icon": "database", "tone": "blue" }
  ]
}
```

## What we built

Five MySQL 8.4 servers, one per shard plus one spare for the reshard, all on one Raspberry Pi 4 inside an Ubuntu chroot. A Python router plays the part of VTGate: it hashes the key, picks the shard, and for queries without a key, sends the query to every shard in parallel and merges the results.

```diagram
{
  "type": "infra",
  "flow": [
    { "label": "client threads", "icon": "cpu", "tone": "slate" },
    { "label": "router", "sub": "vindex + shard map", "icon": "branch", "tone": "violet" }
  ],
  "groups": [
    {
      "label": "Raspberry Pi 4",
      "sub": "Ubuntu 26.04 chroot",
      "icon": "server",
      "tone": "red",
      "nodes": [
        { "label": "-40", "sub": "mysqld :3311", "icon": "database", "tone": "blue" },
        { "label": "40-80", "sub": "mysqld :3312", "icon": "database", "tone": "blue" },
        { "label": "80-c0", "sub": "mysqld :3313", "icon": "database", "tone": "blue" },
        { "label": "c0-", "sub": "mysqld :3314", "icon": "database", "tone": "blue" },
        { "label": "spare", "sub": "mysqld :3315", "icon": "database", "tone": "slate" }
      ]
    }
  ]
}
```

The data is a chat app, like Slack's messages keyspace: 200,000 messages in 2,000 channels, sharded by `channel_id`. Channel activity follows a Zipf curve, as real chat, ticket and order data does: the busiest channel has 12.3% of all messages, and the top 10 have 35.8%. The core of the router is short:

```python
def keyspace_id(key: int) -> bytes:
    # Stand-in for Vitess's hash/xxhash vindex: any stable, well-mixed 64-bit hash works.
    return hashlib.blake2b(str(key).encode(), digest_size=8).digest()

def port_for(self, key):
    ksid = keyspace_id(key)
    for name, port in shards.items():      # {"-40": 3311, "40-80": 3312, ...}
        if in_range(ksid, name):
            return port
```

All five servers share one machine and one SD card, so the absolute numbers are higher and noisier than on real hosts, and every shard competes for the same four CPU cores. Read the ratios, not the milliseconds.

## 1. The sharding key decides the price of every query

We measured two access patterns. **A** fetches one message by id, from the same 2,000 random ids in all three variants: with the channel known (targeted), through a lookup vindex, or by scattering to every shard. **B** fetches the latest 50 messages, by channel (the sharding key, with channels picked by the same Zipf weights as the data) or by user (not the sharding key, so scatter and merge). For latency, each type ran 1,000 times, interleaved in random order after a warm-up. For throughput, each type ran for 15 seconds on 8 client threads:

| Query | Shard queries | p50 | p99 | Queries/s |
|---|---|---|---|---|
| A. one message by id, channel known | 1 | 1.27 ms | 2.27 ms | 1,194 |
| A. one message by id, lookup vindex | 2 | 2.12 ms | 3.67 ms | 710 |
| A. one message by id, scatter | 4 | 3.06 ms | 5.75 ms | 307 |
| B. latest 50 by channel | 1 | 4.90 ms | 7.39 ms | 253 |
| B. latest 50 by user, scatter + merge | 4 | 5.87 ms | 9.37 ms | 157 |

```chart
{
  "type": "bar",
  "title": "One message by id: queries per second on 4 shards",
  "caption": "8 client threads for 15 s per query type, the same 2,000 message ids in all three cases, four MySQL 8.4 shards and the router on one Raspberry Pi 4. Total shard queries per second stayed between 1,194 and 1,419 in all three cases; the difference is how many of them each read needs.",
  "rows": [
    { "label": "channel known (1 shard)", "value": 1194, "series": "targeted" },
    { "label": "lookup vindex (2 shard queries)", "value": 710, "series": "lookup" },
    { "label": "scatter (4 shards)", "value": 307, "series": "scatter" }
  ],
  "series": [
    { "name": "targeted", "color": "#10b981" },
    { "name": "lookup", "color": "#38bdf8" },
    { "name": "scatter", "color": "#f59e0b" }
  ]
}
```

The latency gap is modest because the router asks the shards in parallel. The throughput gap is not. Whatever the query type, the whole setup handled between 1,194 and 1,419 shard queries per second. A scatter read spends four of them, so the same setup serves about a quarter as many reads. Add shards and a scatter read gets more expensive, not less, which is the opposite of why you sharded.

Be clear about what the ceiling is here: the router, its 8 client threads, its 8-worker scatter pool and all four MySQL servers share one 4-core Pi, so we measured the capacity of that whole system, not of MySQL alone. On separate hosts the arithmetic is the same in kind: every scatter read still takes a query slot on every shard host.

Ordered scatter queries can also over-fetch. "Latest 50 by user" asks each shard for up to 50 rows, so for a busy user it can fetch 200 and discard 150 in the merge. (Our users average 40 messages each, so most of these reads returned fewer.) Vitess has to do the same for `ORDER BY ... LIMIT` across shards.

This is how a scatter query took Slack down. In its [February 2022 incident](https://slack.engineering/slacks-incident-on-2-22-22/), a client boot query read a keyspace "sharded by user" without the sharding key, and Vitess ran it as a scatter query, which "sends the query to every shard". When a cache problem pushed more of those reads to the database, every shard took the load at once.

## 2. A lookup vindex buys part of it back

Sometimes you need to find a row by something other than the sharding key: a message by its id, an order by its number. Vitess's answer is a **lookup vindex**, a table that maps the other key to the keyspace ID. In our router it is `message_lookup`, sharded by message id, holding the channel:

```python
def by_id_lookup(self, mid):
    row = self.run(self.port_for(mid), "SELECT channel_id FROM message_lookup WHERE id=%s", (mid,))
    return self.run(self.port_for(row[0][0]), f"SELECT {COLS} FROM messages WHERE id=%s", (mid,))
```

Two shard queries instead of four took throughput from 307 to 710 reads per second: 2.3x the scatter version, but still only 59% of the targeted read, because the lookup is a second round trip. The cost moves to writes: the [Vitess docs](https://vitess.io/docs/reference/features/vindexes/) say a lookup vindex needs "an extra write to the lookup table for insert and delete operations". In our demo that write usually lands on a different shard than the message, so keeping the two consistent is its own problem; Vitess documents consistent lookup vindexes for that. Add lookup vindexes for the few access paths that are hot, not for every column.

## 3. Cross-shard transactions without two-phase commit lose data

Once data lives on several servers, a transaction that touches two shards is two transactions. Vitess's default transaction mode, `multi`, commits them one after the other with, in the [docs' words](https://vitess.io/docs/reference/features/distributed-transaction/), "no atomicity". We tested what that means with credit transfers between accounts. With a 2% probability per transfer, we simulate a failure between the two steps: the script commits the debit and rolls back the credit, as if the process had died after the first commit. For single-shard transfers, the same failure means rolling back the one transaction before it commits. This is a simulation of the failure, not a crash-recovery test.

```json
{
  "same-shard":  { "transfers": 2000, "injected_failures": 32, "credits_before": 1000000,
                   "credits_after": 1000000, "credits_lost": 0, "p50_ms": 3.26, "p99_ms": 484.49 },
  "cross-shard": { "transfers": 2000, "injected_failures": 52, "credits_before": 1000000,
                   "credits_after": 999480, "credits_lost": 520, "p50_ms": 5.91, "p99_ms": 467.95 }
}
```

Every simulated cross-shard failure lost money: 52 failures (2.6% of transfers in this run), 520 credits gone, because the debit had committed and the credit never did. On one shard, the 32 failures rolled back cleanly. The cross-shard version also took longer at the median, 5.9 ms against 3.3 ms, because it waits for two commits.

Vitess has an atomic two-phase commit mode (`TWOPC`). When the [Vitess 21 announcement](https://vitess.io/blog/2024-10-29-announcing-vitess-21/) reintroduced it in 2024 it was "currently in an experimental state"; check the current docs for its status. The docs also warn that it "does not provide isolation", so other readers can see a half-finished transfer, and that it adds commit latency. Teams that have written about sharding with Vitess designed around cross-shard transactions. Shopify's Shop app [removed all cross-shard transactions](https://shopify.engineering/horizontally-scaling-the-rails-backend-of-shop-app-with-vitess) as part of sharding by user id. Cash App [kept each customer's "entity group"](https://developer.squareup.com/blog/sharding-cash/) together on one shard through every split. The rule that falls out: pick a sharding key that keeps the rows a transaction touches on the same shard, and use an idempotent, retried workflow or two-phase commit, with its costs, for the rest.

## 4. Resharding online, without the night of downtime

This is the operation that cost YouTube a night. Vitess now does it online with VReplication: copy the rows in chunks from a consistent snapshot, stream the changes that happen meanwhile from the binlog, compare both sides, then switch traffic. We did an insert-only version in miniature, splitting `c0-` into `c0-e0` (staying on port 3314) and `e0-` (moving to the spare on 3315). All three tables moved: messages (keyed by channel), the lookup table (keyed by message id) and accounts. A writer thread inserted messages and their lookup rows the whole time, one at a time with a 5 ms pause between them. A reader thread looked up random seeded messages through the lookup vindex and checked that each was found, and ran scatter reads by user and checked them for duplicate rows:

1. **Mirror:** inserts for the moving range `e0-` go to both the old and the new shard. This stands in for VReplication's change stream, and it is the same double-write approach Slack used for its migration. Unlike VReplication it handles only inserts: no ordering of updates and deletes, and no replay after a crash.
2. **Copy:** existing `e0-` rows move in chunks of 2,000. These are plain reads, not a consistent snapshot, which is safe here only because rows are never updated.
3. **Verify:** for messages, the row count and an XOR of per-row CRC32 values (over id, channel, user and body) up to a watermark id must match on both sides; for the lookup and accounts rows, the count and a hash of the sorted rows. This is the job [VDiff](https://vitess.io/docs/reference/vreplication/movetables/) does, more thoroughly.
4. **Switch:** one atomic change to the router's in-memory shard map routes `e0-` to the new server. Scatter reads keep only rows inside each shard's range, so rows still sitting on the old shard are not returned twice. The script then waits 3 seconds before cleanup instead of draining in-flight requests, so the safety of the hand-over depends on timing; Vitess fences and buffers traffic during `SwitchTraffic` instead.
5. **Clean up:** delete the moved rows from the old shard, then check the end state.

From `results/reshard.json`:

```text
copy            44,937 messages, 24,796 lookup rows, 129 accounts in 23.4 s
verify          44,963 messages up to the watermark: count and CRC32 XOR match;
                lookup and accounts rows identical
map update      0.026 ms (the in-process shard-map swap, not a client cutover)
cleanup         moved rows deleted from the old shard in 23.7 s
writer          994 inserts during the run, 0 errors
reader          2,158 lookups all found; 2,158 scatter reads, no duplicates
end state       every expected message id exactly once (200,994), 200,994 lookup
                rows, 1,000 accounts, 0 rows on the wrong shard or with a wrong ksid
```

Nothing was lost and no write failed. Because the writer waited for each insert before sending the next, a slower write simply meant fewer writes; this does not show how a system with a fixed incoming rate would queue. The cost showed up as latency: the writer's median insert (a message plus its lookup row, across all shards) went from 8.3 ms before the move to 16.5 ms during the copy and 21.3 ms during the cleanup. The copy and the deletes most likely competed with it for the shared SD card. Vitess ships a throttler that VReplication uses to limit exactly this kind of impact.

For comparison, the simple way is to stop writes, copy, switch and start again. We did not measure that. Our online copy took 23.4 seconds for about 70,000 rows while sharing the machine with the writer and reader, and copy time grows with the size of the shard.

## 5. More shards do not fix a hot key

Hashing spreads keys evenly, not load. Every message in a channel has the same sharding key, so a busy channel is a busy shard, however many shards you have. We took the real per-channel row counts and worked out the busiest shard's share for 2 to 128 equal shards:

```chart
{
  "type": "line",
  "title": "Share of all messages on the busiest shard",
  "unit": "%",
  "caption": "200,000 messages, 2,000 channels with Zipf activity; the busiest channel holds 12.3%. Equal keyspace ranges. 'Hot channel bucketed' splits that one channel's messages over 16 sharding keys.",
  "x": ["2", "4", "8", "16", "32", "64", "128"],
  "series": [
    { "name": "ideal (1/n)", "data": [50, 25, 12.5, 6.25, 3.12, 1.56, 0.78], "color": "#94a3b8" },
    { "name": "busiest shard", "data": [55.27, 31.03, 22.42, 17.52, 15.67, 15.19, 14.58], "color": "#f59e0b" },
    { "name": "hot channel bucketed", "data": [50.1, 29.61, 16.87, 11.64, 9.88, 9.21, 8.34], "color": "#10b981" }
  ]
}
```

At 128 shards, where an even split would put 0.78% on each, the busiest shard still held 14.6%, because the busiest channel alone is 12.3%. We also modeled splitting that one channel's messages evenly over 16 sharding keys (for example, channel plus `message_id % 16`). That brought the busiest shard down to 8.3%, and the next-busiest channel, 6.1% of messages, became the new floor. Bucketing has its own cost: a read of the whole channel now has to ask up to 16 places and merge, which is the scatter problem from section 1 on a smaller scale.

Slack wrote up a related failure in 2023. In [The Query Strikes Again](https://slack.engineering/the-query-strikes-again/), about an incident in October 2022, one shard "contained 6% of the user's subscription data", and write load on it made the tablets run out of memory until "the kernel OOM-killed the MySQL process." That was a concentration of load on one shard during a bulk operation, not necessarily a single hot key, but the shape is the same: one shard takes far more than its share. The Vitess docs' advice for hot shards is to [split shards](https://vitess.io/docs/reference/features/sharding/), and that works for a hot range of many keys. For a single hot key, the fix is in the data model: bucket the key, or pick a different one.

## When to shard, and how to pick the key

- **Do the cheap things first.** Read replicas for read load. Functional partitioning by domain, as GitHub did, buys a lot of headroom before you need horizontal sharding at all, and it is easier to undo.
- **Shard when one primary cannot take the writes or hold the data.** That is the point YouTube, Slack and GitHub each reached.
- **Pick the key from your most common queries.** PlanetScale's guidance is to optimize for "the most common queries with the goal of avoiding cross-shard and cross-keyspace queries". Our numbers show why: a query with the key used 1 shard query, one without it used all of them.
- **Keep transactions on one shard.** Choose a key that groups the rows a transaction touches, like Cash App's entity groups, and do the rest with idempotent workflows.
- **Measure key skew before you choose.** Count rows and traffic per key value. If one value is a large share, consider bucketing it, and weigh that against the extra fan-out on reads of that key.

## Vitess, PlanetScale and TiDB

- **Vitess** is the open source layer all of this comes from, a CNCF graduated project since November 2019. You run VTGate, VTTablet and the MySQL servers yourself, often on Kubernetes. HubSpot [reported](https://product.hubspot.com/blog/improving-reliability) over 750 Vitess shards per data center, each a 3-instance MySQL cluster, all inside Kubernetes.
- **PlanetScale** runs Vitess as a managed service and says it builds its product "on top of Vitess, which provides a transparent sharding solution for MySQL". You get the same primitives, keyspaces, vindexes and online resharding workflows, without operating the layer.
- **TiDB** takes a different route. It is a distributed SQL database with a MySQL-compatible protocol, and its storage layer, TiKV, splits data into Regions automatically: [when a Region grows past 384 MiB](https://docs.pingcap.com/tidb/stable/tikv-overview/) by default, it splits. You do not choose a sharding key or run reshards yourself. We did not test how it handles a single hot key.

## What we could not conclude

- **Absolute performance.** Five servers on one Raspberry Pi with an SD card is not a production fleet. Commits wait on the card, which put write p99 in the hundreds of milliseconds throughout, before, during and after the reshard.
- **Vitess's own overhead.** Our router is Python, not VTGate. Real VTGate adds query planning and connection pooling, and we did not measure how its scatter queries compare with ours.
- **Large reshards.** We moved about 45,000 messages, or 70,000 rows across three tables. At hundreds of millions, copy throughput, replica lag and throttling dominate, and we did not test them.
- **Real two-phase commit.** We tested the default mode's failure, not Vitess's atomic mode.

## Summary

- Sharding is a routing problem first. A query the router can send to one shard costs one shard; a query it cannot narrow down costs all of them. On our four shards, that was 1,194 against 307 reads per second for the same message.
- A lookup vindex more than doubles the throughput of the scatter read for one access path, at the price of an extra write and a second round trip.
- Without two-phase commit, a cross-shard transaction that dies between commits leaves partial data every time. Design keys so transactions stay on one shard.
- Online resharding (mirror, copy, verify, switch) moved about 70,000 rows across three tables with zero write errors and zero lost rows, while lookups kept finding their rows. The cost was higher insert latency while it ran.
- Hashing does not fix a hot key. Measure skew before you pick the key, and bucket hot values.
