---
title: 'Is Valkey Ready to Replace Redis in 2026?'
excerpt: 'Valkey forked from Redis after the 2024 license change and has matured fast. Here is whether it is production-ready, how the migration works, and whether the AGPL question even applies to you.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-06-05'
publishedAt: '2026-06-05T09:00:00Z'
updatedAt: '2026-06-05T09:00:00Z'
readingTime: '11 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Valkey
  - Redis
  - Caching
  - Open Source
  - Migration
  - DevOps
---

If you run Redis in production, the last two years gave you a question you did not ask for: stay on Redis, or move to Valkey? In 2024 the answer was "wait and see." The fork was new, the feature gap was tiny, and nobody wanted to re-point their cache layer at a project with no track record.

In 2026 the picture is clear enough to act on. Valkey is on its 9.1 release, it is the default in-memory store on AWS ElastiCache, and it has its own performance roadmap. Redis, for its part, went back to an open-source license with Redis 8 and pulled the old Redis Stack modules into the core engine. This is no longer a simple fork-versus-original story.

This post answers the practical question directly. Is Valkey ready for production, where do the two projects actually differ now, does the AGPL license that Redis adopted affect you, and how does the migration work if you decide to move? For a side-by-side feature table, pricing, and a decision matrix, see our companion [Valkey vs Redis comparison](/comparisons/valkey-vs-redis).

## TLDR

- Valkey is production-ready in 2026. It is wire-compatible with Redis, governed by the Linux Foundation, on a steady release cadence (9.1 in May 2026), and is the default on AWS ElastiCache and MemoryDB.
- Redis is open source again under AGPLv3 since Redis 8, so "Redis is no longer open source" is out of date. The catch is that AGPL is copyleft, while Valkey stays on permissive BSD.
- The AGPL question only bites if you modify the Redis source and offer it to others over a network. If you just use Redis as a cache or database, it changes almost nothing.
- Migration from Redis 7.2.x is close to a drop-in: same protocol, same RDB and AOF files, and an in-place upgrade path on ElastiCache.
- The real divergence is features added after the fork. Redis 8 bundles JSON, search, time series, and vector sets into core. Valkey ships those as separate modules.

## Prerequisites

- A running Redis instance (self-hosted or managed) and access to its configuration
- The ability to take and restore an RDB snapshot, or to run a replica
- A staging environment where you can test before touching production
- Familiarity with `redis-cli` and your client library's connection settings

## How we got here: the license timeline

The decision makes more sense once you have the sequence straight.

```text
2009-2024   Redis ships under the permissive BSD license
Mar 2024    Redis Inc. relicenses to SSPLv1 + RSALv2 (source-available, not OSI open source)
Mar 2024    Linux Foundation forks Redis 7.2.4 as Valkey (BSD), backed by AWS, Google, Oracle, Snap
2024-2025   Valkey ships 8.0 and 8.1 with multi-threaded I/O and big throughput gains
May 2025    Redis 8 adds AGPLv3 as a third license; Redis Open Source is OSI open source again
2026        Valkey 9.1 (May) and Redis 8.2 (Feb) both shipping; both fast, both open source
```

Two things matter in that timeline. First, Valkey never carried the source-available license. It forked from the last BSD release, so its license has been permissive the whole time. Second, Redis did not stay source-available. Redis 8 added the OSI-approved AGPLv3, which means Redis is open source again, just under a copyleft license instead of the old permissive one.

## Is Valkey actually production-ready?

Yes, and the evidence is not subtle.

**Releases and stability.** Valkey shipped 8.0 and 8.1 through 2024 and 2025, then 9.0 and 9.1 in 2026. The 8.1 line is still maintained (8.1.8 landed in June 2026), so you get the same kind of long-lived release branches you expect from mature infrastructure software.

**Performance.** Valkey put most of its early effort into multi-core throughput. Valkey 9 added pipeline memory prefetching, zero-copy responses, and SIMD optimizations for commands like `BITCOUNT`. Valkey 9.1 reports around 2.1 million requests per second on 512-byte payloads. Redis 8 also added large gains, so both are fast; Valkey tends to pull ahead on many cores.

**Cloud adoption.** This is the strongest signal. AWS made Valkey the default for new ElastiCache and MemoryDB clusters and prices it below Redis OSS, roughly 20% lower on ElastiCache and about 30% lower on MemoryDB. Google Cloud offers Memorystore for Valkey, and Oracle supports it on OCI Cache. When the major clouds make a fork their default, the "will it survive" question is settled.

**Governance.** Valkey sits under the Linux Foundation with a multi-company steering model. No single vendor can relicense it, which is the exact failure mode that started this whole story.

## Where Valkey and Redis diverge now

Up to Redis 7.2.4 the two are the same code. After the fork they drew apart, and that is where your decision lives.

The biggest difference is the built-in feature set. Redis 8 folded the former Redis Stack into the core engine, so JSON, the Query Engine, time series, probabilistic types, and vector sets all ship in the box. Vector sets in particular, built by the original Redis creator, make Redis a strong default for AI and semantic-search features.

Valkey keeps the core lean and ships those capabilities as separate modules, such as `valkey-search` and `valkey-json`. You get similar functionality, but you assemble it rather than getting it bundled. If your workload is a plain cache, a session store, a rate limiter, or a queue, this difference does not touch you. If you want vector search inside the data store with no extra setup, Redis 8 is ahead today.

For the full side-by-side across licensing, performance, modules, and managed-service cost, the [Valkey vs Redis comparison](/comparisons/valkey-vs-redis) lays it out in a table.

## The AGPL question: does it actually affect you?

This is the part that gets the most confused commentary, so be precise about it.

AGPLv3 is a copyleft license with a network clause. The obligation it adds, on top of the GPL, is this: if you modify the software and let users interact with it over a network, you have to make your modified source available to those users. That is the whole of it.

Walk it through your own setup:

```text
Do you modify the Redis source code?
        |
        +-- No --> AGPL changes nothing for you. Use Redis 8 freely.
        |
        Yes
        |
Do you offer that modified Redis to others over a network
(for example, as part of a hosted product)?
        |
        +-- No (internal use only) --> No source-disclosure obligation in practice.
        |
        +-- Yes --> You may have to publish your modifications. This is the
                    case where teams choose Valkey's BSD license instead.
```

For the large majority of teams, the honest answer is that AGPL does not affect them. You pull the official image, run it as a cache or database, and never touch the source. Nothing is triggered. The teams that genuinely care are the ones building a product on top of a modified engine, especially anyone offering a hosted data-store service. For them, Valkey's permissive BSD license removes the question entirely, which is exactly why several vendors standardized on Valkey.

## Migrating from Redis to Valkey

Here is the good news that makes the decision low-risk: for Redis 7.2.x and earlier, moving to Valkey is close to a drop-in. The two speak the same RESP protocol and read the same on-disk formats.

### Step 1: confirm your version and features

Check what you are running and whether you use any Redis 8 core modules.

```bash
redis-cli INFO server | grep redis_version
# redis_version:7.2.5

# If you use modules, list them. Valkey core will not have Redis 8 modules.
redis-cli MODULE LIST
```

If `MODULE LIST` is empty and you are on 7.2.x, you are in the easy path. If you depend on Redis Query Engine, JSON, or vector sets, plan to add the matching Valkey modules or keep those workloads on Redis.

### Step 2: back up your data

Take an RDB snapshot before anything else.

```bash
# Trigger a snapshot and copy the file off the box
redis-cli SAVE
cp /var/lib/redis/dump.rdb /backup/dump.rdb.$(date +%F)
```

### Step 3: stand up Valkey and load the snapshot

Valkey reads the same `dump.rdb`, so you can point a fresh Valkey instance at it.

```bash
# Run Valkey 9.1 in a container, mounting the existing RDB
docker run -d --name valkey \
  -p 6379:6379 \
  -v /backup:/data \
  valkey/valkey:9.1 valkey-server --dir /data --dbfilename dump.rdb.2026-06-05

# Verify it came up and loaded your keys
valkey-cli DBSIZE
```

The CLI is `valkey-cli`, but `redis-cli` works against Valkey too, since the protocol is identical.

### Step 4: cut over clients

You do not need a new client library. Point your existing Redis client at the Valkey endpoint. The connection settings and commands are the same.

```text
# Before
REDIS_URL=redis://redis.internal:6379

# After (same scheme, same port, new host)
REDIS_URL=redis://valkey.internal:6379
```

On AWS, the path is even shorter. ElastiCache offers an in-place upgrade from supported Redis OSS versions to Valkey, so you can switch the engine on an existing cluster without standing up new infrastructure.

### Step 5: test on staging first

Run your full test suite against Valkey in staging before production. Pay attention to anything that calls a command added after the 7.2.4 fork, or any module you assumed was present. A clean migration behaves identically because the command surface is the same.

## Should you switch? A quick framework

There is no single right answer, so match the choice to your situation.

**Move to Valkey** if you self-host and want a permissive license that cannot be changed under you, if you want to cut managed cache costs on AWS or Google Cloud, or if you build a product on top of the engine and want to avoid the AGPL network clause.

**Stay on or choose Redis 8** if you need the bundled core modules, especially vector sets and the Query Engine for AI features, or if you rely on Redis Enterprise capabilities like active-active replication and a vendor support contract.

**It is a tie, so do not rush** if you run a managed cache, never modify the engine, and are happy with your costs. Both are open source, both are fast, and the migration stays easy. Switch the day cost or features change the math, not before.

## Summary

The Valkey question is settled enough to act on in 2026. Valkey is production-ready, wire-compatible, governed by a foundation, and cheaper on managed services. Redis answered the criticism that started the fork by returning to open source with Redis 8, and it now ships a richer core with search and vector sets built in.

The mental model to keep:

- The license split is real but narrower than the headlines: BSD (Valkey) versus AGPL copyleft (Redis). AGPL only matters if you modify and serve the engine.
- The migration is easy and low-risk for Redis 7.2.x: same protocol, same files, and an in-place path on ElastiCache.
- The divergence to watch is post-fork features. Redis 8 bundles modules into core; Valkey keeps them separate.

Decide on what you actually need, the license terms, the managed cost, and the built-in features, rather than on which project has the louder story. For the head-to-head table, the [Valkey vs Redis comparison](/comparisons/valkey-vs-redis) covers it point by point.
