---
title: 'Stop Using Random UUIDs as Primary Keys: uuidv7() Lands in PostgreSQL 18'
excerpt: 'Random UUIDv4 primary keys quietly wreck insert speed and bloat indexes on large tables. PostgreSQL 18 ships a native time-ordered uuidv7() that keeps the upsides of UUIDs without the B-tree penalty. Here are the numbers and how to adopt it.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-06-30'
publishedAt: '2026-06-30T15:00:00Z'
updatedAt: '2026-06-30T15:00:00Z'
readingTime: '10 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - PostgreSQL
  - Databases
  - Performance
  - UUID
  - Backend
  - DevOps
---

If you reach for `gen_random_uuid()` every time you need a primary key, you have probably never measured what it costs. On a small table, nothing. On a table with tens of millions of rows, random UUIDs turn every insert into a random write into the middle of your primary-key index, and that quietly drags down insert throughput, inflates index size, and burns through cache and WAL.

PostgreSQL 18 fixes the root cause with a native `uuidv7()` function. UUIDv7 is time-ordered, so new keys land at the right-hand edge of the B-tree like a sequential `bigint` would, while keeping the properties teams pick UUIDs for in the first place: generate them anywhere, no central sequence, no coordination. This post explains why the random version is slow, what changes with v7, the benchmark numbers on a 50-million-row table, the one real tradeoff, and how to adopt it without rewriting your schema.

## TL;DR

- `uuidv4()` (random) primary keys scatter inserts across the whole index. On large tables that means constant page splits, low page density, fragmentation, and write amplification.
- PostgreSQL 18 adds `uuidv7()`, a time-ordered UUID per [RFC 9562](https://datatracker.ietf.org/doc/html/rfc9562). New rows append at the index's right edge, like a sequential key.
- In one published 50M-row benchmark, the initial bulk insert finished in about 1.8 minutes with v7 versus about 20 minutes with v4, and the index was roughly 25 percent smaller. Range scans by id ran about 3x faster.
- The one real catch: a v7 value embeds its creation time, so do not hand it out as a public identifier if creation time is sensitive.
- `bigint` is still smaller and faster than any UUID. Use `uuidv7()` when you actually need UUID properties, not as a reflex.

## Prerequisites

- PostgreSQL 18 (the `uuidv7()` function is built in; no extension needed)
- Basic familiarity with B-tree indexes and primary keys
- A schema where you are choosing or reconsidering a primary-key type
- Optional: `pg_stat_statements` and `\timing` if you want to measure on your own data

## Why random UUIDs are slow as primary keys

A primary key in PostgreSQL is backed by a B-tree index, and a B-tree stays sorted by key. Where a new key lands in that sorted structure is the whole story.

A `bigint` from a sequence always sorts after the previous one, so every insert lands at the right-hand edge of the tree. That rightmost page stays hot in memory, fills up, and splits cleanly. A random UUIDv4 has no order at all, so each insert lands at a random leaf page somewhere in the index.

```text
UUIDv4 (random)                       UUIDv7 / bigint (ordered)
inserts scatter across the tree       inserts append at the right edge

      [ root ]                              [ root ]
     /   |   \                             /   |   \
  [p1] [p2] [p3] ...                    [p1] [p2] [p3] [hot]
   ^    ^      ^                                        ^
  write write write                              every write here
  (cold pages pulled in,                         (one hot page, stays
   split, half-empty)                             in cache, fills, splits clean)
```

That random-write pattern has three compounding costs on a large table:

- **Page splits and low density.** Inserting into the middle of a full page splits it, leaving both halves partly empty. Your index ends up larger than the data it indexes and full of slack.
- **Cache misses.** The working set is the entire index, not a hot tail. Once the index no longer fits in `shared_buffers`, every insert risks a random read from disk to fetch the target page.
- **WAL and full-page-image amplification.** The first write to a page after a checkpoint logs the whole page. More distinct pages touched per second means more full-page images and more WAL.

None of this shows up at 10,000 rows. It shows up exactly when the table gets big enough to matter.

## What uuidv7() changes

A UUIDv7 is laid out so the most significant bits are a timestamp. PostgreSQL 18 builds it from a 48-bit Unix millisecond timestamp, then a sub-millisecond fraction, then random bits, following RFC 9562. Because the timestamp is at the front and UUIDs sort lexically as 128-bit values, a v7 generated now always sorts after one generated a moment ago.

The result is that v7 keys behave like a sequence for index-locality purposes. Inserts append at the right edge, the hot page stays in cache, and pages fill before they split. You get the write pattern of a `bigint` with the generate-anywhere property of a UUID.

PostgreSQL 18 exposes three functions. The names are now explicit about the version:

```sql
-- Version 4, random. These two are equivalent.
SELECT gen_random_uuid();      -- 5b30857f-0bfa-48b5-ac0b-5c64e28078d1
SELECT uuidv4();               -- b42410ee-132f-42ee-9e4f-09a6485c95b8

-- Version 7, time-ordered. New in PostgreSQL 18.
SELECT uuidv7();               -- 019535d9-3df7-79fb-b466-fa907fa17f9e

-- Optional interval shift, handy for backfilling historical rows
-- with timestamps in the past.
SELECT uuidv7(shift => '-7 days'::interval);
```

One useful detail: within a single backend session, PostgreSQL guarantees each `uuidv7()` it generates is strictly greater than the last, by spending some of the random bits on extra clock precision. So even a tight insert loop produces monotonic keys rather than occasionally colliding on the same millisecond.

## The numbers

The performance argument is not subtle. Credativ published a [detailed comparison on PostgreSQL 18](https://www.credativ.de/en/blog/postgresql-en/a-deeper-look-at-old-uuidv4-vs-new-uuidv7-in-postgresql-18/) using a single-column UUID primary key and 50 million rows. The initial bulk load is the headline:

```chart
{
  "type": "bar",
  "title": "Time to insert 50M rows into an empty table",
  "unit": "min",
  "caption": "PostgreSQL 18, single UUID primary key, 50M rows. Source: credativ benchmark (2026). Lower is better.",
  "rows": [
    { "label": "UUIDv4 (random)", "value": 20, "series": "v4" },
    { "label": "UUIDv7 (time-ordered)", "value": 1.8, "series": "v7" }
  ],
  "series": [
    { "name": "v4", "color": "#94a3b8" },
    { "name": "v7", "color": "#f59e0b" }
  ]
}
```

The index size gap is just as real, and it widens when you insert into a table that already holds data, which is the normal case in production:

```chart
{
  "type": "bar",
  "title": "Primary-key index size after inserting 50M rows",
  "unit": "MB",
  "caption": "PostgreSQL 18, single UUID primary key. Source: credativ benchmark (2026). Lower is better.",
  "rows": [
    { "label": "Into empty table", "value": 1981, "series": "UUIDv4" },
    { "label": "Into empty table", "value": 1504, "series": "UUIDv7" },
    { "label": "Into 50M existing", "value": 3956, "series": "UUIDv4" },
    { "label": "Into 50M existing", "value": 3008, "series": "UUIDv7" }
  ],
  "series": [
    { "name": "UUIDv4", "color": "#94a3b8" },
    { "name": "UUIDv7", "color": "#f59e0b" }
  ]
}
```

Reads benefit too. In the same benchmark, a range scan ordered by the id column ran roughly three times faster on v7 (about 113 ms versus 318 ms for a million-row `ORDER BY id`) and needed on the order of 100 times fewer buffer hits, because rows created near each other in time also sit near each other on disk. That locality is something a random UUID can never give you.

Two caveats on the numbers. They come from one benchmark on a synthetic single-column table, so treat the exact figures as directional rather than a promise for your workload. And the gap is smallest on tiny tables and largest on big ones, which is the whole point: this is a problem that scales with you.

## uuidv7 vs uuidv4 vs bigint

`uuidv7()` is not automatically the right choice. It sits between the other two options.

| | bigint sequence | uuidv4 (random) | uuidv7 (time-ordered) |
| --- | --- | --- | --- |
| Size | 8 bytes | 16 bytes | 16 bytes |
| Insert locality | Sequential (best) | Random (worst) | Sequential |
| Generate without the DB | No | Yes | Yes |
| Reveals row count or order | Yes | No | Partially (creation time) |
| Leaks creation time | No | No | Yes |

The short version:

- **Reach for `bigint`** when a single database owns the sequence and you do not need to generate ids elsewhere. It is half the size of any UUID and the fastest option. The downside is that sequential integers leak how many rows you have and are trivially enumerable.
- **Reach for `uuidv7()`** when you want UUIDs: ids generated by clients or multiple services, merged across shards, or created before a row reaches the database. It gives you that with almost none of the write penalty of v4.
- **Reach for `uuidv4()`** only when you specifically need an identifier that reveals nothing, including when the row was created.

## The one real catch: v7 leaks creation time

Because the timestamp sits in the high bits, anyone holding a v7 value can read roughly when it was generated. That is fine for an internal primary key. It is not fine if you expose the same value as a public identifier and the creation time is sensitive, for example a user id where signup time is private, or an order id where a competitor could infer your daily volume by diffing two ids.

:::warning
Do not assume a UUID is opaque just because it looks random. A `uuidv7()` embeds a millisecond timestamp you can decode in seconds. If an identifier is shown to users or third parties and its creation time is sensitive, keep `uuidv7()` as the internal primary key and expose a separate `uuidv4()` (or another opaque token) externally.
:::

This is a design decision, not a reason to avoid v7. Most primary keys never leave the backend, and for those the timestamp is a feature, not a leak.

## How to adopt it

For new tables, set the column default and move on:

```sql
CREATE TABLE orders (
    id          uuid PRIMARY KEY DEFAULT uuidv7(),
    customer_id uuid NOT NULL,
    total_cents integer NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO orders (customer_id, total_cents)
VALUES (uuidv7(), 4999)
RETURNING id;
```

For an existing table that already uses random UUIDs, you do not need a risky rewrite. The existing rows keep their v4 values and stay scattered, but every new row inserted with a v7 default lands in order, so the index stops degrading from that point forward. Switch the default:

```sql
-- New rows get time-ordered ids; old rows are untouched.
ALTER TABLE orders ALTER COLUMN id SET DEFAULT uuidv7();
```

If you want the full benefit on historical data, you can rebuild the table or index during a maintenance window so the existing rows are stored in key order, but for many teams simply changing the default and letting the table grow in order is enough.

A few adoption notes:

- **Application-side generation still works.** If your services generate ids before inserting, switch the client library to a UUIDv7 generator. Most language ecosystems now have one, and the database does not care who produced the value as long as it is a valid v7.
- **ORMs are catching up.** Check whether your ORM lets you set a database default expression for the id column; if so, `DEFAULT uuidv7()` is the cleanest path. If it generates ids in application code, point it at a v7 library.
- **You do not need PostgreSQL 18 to start.** If you are on 14 to 17, you can adopt UUIDv7 today by generating it in the application or with a small SQL function, then the upgrade to 18 just lets you drop that shim for the native function. Plenty of managed Postgres is already on 18 as well (Neon, for example, defaults new projects to Postgres 18), so you can try `uuidv7()` on a fresh database without upgrading anything yourself.

## Key takeaways

- Random UUIDv4 primary keys are a silent scaling tax: random index writes mean page splits, bloated indexes, cache misses, and extra WAL once a table gets large.
- PostgreSQL 18's `uuidv7()` is time-ordered, so inserts append at the index edge like a sequence while keeping the generate-anywhere property of a UUID. Published benchmarks show large insert-time and index-size wins on 50M rows.
- `bigint` is still the smallest and fastest key when one database owns the sequence; use `uuidv7()` when you genuinely need UUIDs, and `uuidv4()` only when you must hide creation time.
- Adopting it is a one-line default change for new rows, with no rewrite required for existing tables. The main thing to design around is that v7 embeds a decodable timestamp, so keep it off public-facing identifiers when that matters.
