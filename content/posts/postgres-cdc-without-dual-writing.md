---
title: 'Getting a Row Change Out of Postgres Without Dual-Writing'
excerpt: 'Your service writes to Postgres and publishes to Kafka, and one day those two disagree. The fix is to make the database the only writer and read changes from its log: the outbox pattern, logical decoding, and the replication-slot failure mode that quietly fills your primary''s disk, demonstrated live with real numbers.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-09-01'
publishedAt: '2026-09-01T12:00:00Z'
updatedAt: '2026-09-01T12:00:00Z'
readingTime: '15 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Postgres
  - CDC
  - Kafka
  - Architecture
  - Streaming
---

Somewhere in your codebase there is probably a function that does two things: saves a row to Postgres, then publishes an event about it to Kafka, RabbitMQ, or a webhook. It works in the demo, it works for months, and then a deploy restarts the process between the two calls, and now your database says the order exists while your event stream says it never happened. Every downstream consumer is now wrong, and nothing corrects it until a human writes a reconciliation job.

That is the **dual-write problem**, and it is not a bug you fix with retries. It is an architecture problem: without a distributed transaction spanning both systems (possible via two-phase commit, practical almost never), code that writes to both will eventually disagree with itself. The fix is to stop writing twice: make the database the single place a change happens, and derive the event stream from the database's own record of changes. This post walks the two honest ways to do that, the failure mode the second one hides (with a live demonstration of it eating disk), and the tooling landscape around it.

## TLDR

- Dual writes fail because there is no transaction across Postgres and your broker. Some interleaving of crash and retry always produces disagreement.
- Fix one: the **transactional outbox**. Write the event into an outbox table in the same transaction as the data; a relay publishes from that table. The transaction buys agreement; the relay still needs retries and monitoring.
- Fix two: **logical decoding**, Postgres's built-in change stream. A replication slot plus a decoder turns every committed INSERT/UPDATE/DELETE into consumable messages; no application changes at all.
- The catch: a replication slot pins WAL until decoding no longer needs it. In our live demo, an idle slot went from **1,488 bytes to 45 MB of retained WAL** in under a minute, from traffic that had nothing to do with the tables it watched. Unmonitored, this fills the primary's disk.
- Guard with a `pg_replication_slots` alert and `max_slot_wal_keep_size`; then choose between running Debezium yourself or paying one of the managed CDC vendors.

## Prerequisites

- Comfortable SQL and a rough idea of what the write-ahead log is (our [WAL deep dive](https://devops-daily.com/posts/wal-as-the-source-of-truth-lakebase-storage-s3) is the perfect warm-up; this post is its practical sequel)
- A Postgres you can experiment on, with `wal_level = logical` (we ran everything below on a scratch project on Neon, where it is a project setting)
- No Kafka required to follow along

## Why dual-writing always loses

The failing pattern, in its natural habitat:

```python
def create_order(order):
    db.execute("INSERT INTO orders ...")   # write 1
    db.commit()
    kafka.produce("orders", order_event)   # write 2, and the lie begins
```

Walk the interleavings. Crash after commit, before produce: database has the order, stream does not. Produce first instead? Crash after produce, before commit: stream announces an order that does not exist. Wrap it in retries: now a timeout that actually succeeded gets retried and the event publishes twice, or the retry queue dies with the pod. No ordering of two non-transactional writes survives every crash, because the two systems share no notion of "this happened".

```diagram
{
  "type": "branch",
  "nodes": [
    { "label": "INSERT order", "icon": "database", "tone": "blue" },
    { "label": "COMMIT", "icon": "check", "tone": "green" },
    { "label": "publish event", "icon": "queue", "tone": "violet" }
  ],
  "branch": [
    { "label": "All three happen: consistent", "variant": "good" },
    { "label": "Crash between commit and publish: DB and stream disagree forever", "variant": "bad" }
  ]
}
```

Teams discover this the slow way: a reconciliation script somebody writes "temporarily" in year one that is load-bearing by year three. The permanent fixes both follow one principle: **the database is the only writer, the stream is derived**.

## Fix one: the transactional outbox

The outbox pattern moves the second write inside the transaction:

```sql
BEGIN;
INSERT INTO orders (customer, total, status) VALUES ('ada', 42.50, 'pending');
INSERT INTO outbox (topic, payload)
  VALUES ('orders', '{"event": "order_created", "customer": "ada", "total": 42.50}');
COMMIT;
```

One transaction, so either both rows exist or neither does. A small relay process polls the outbox (or, foreshadowing, tails it via CDC), publishes each row to the broker, and marks it done. Consumers must tolerate duplicates, because the relay can crash between publishing and marking, but duplicates are a solvable problem (idempotency keys); disagreement is not.

The outbox is the right first tool: no exotic infrastructure, trivially auditable, and the event schema is explicit and versioned by you rather than mirroring your table structure. Be honest about what it buys, though: the transaction guarantees the outbox row matches the data, not that broker delivery is exactly-once. The relay still needs retries, ordering rules, cleanup, and monitoring, and the pattern only captures what your application chooses to record.

## Fix two: the database's own change stream

Postgres already maintains a record of every committed row change to regular tables: the WAL. **Logical decoding** exposes it as a consumable stream: you create a **replication slot**, attach a decoder plugin, and Postgres hands you every committed change, in commit order, exactly where you left off.

This is the part worth seeing rather than reading about. Everything below is a real recorded session:

```terminal
{
  "title": "psql, wal_level = logical",
  "prompt": "neondb=>",
  "steps": [
    { "cmd": "CREATE TABLE orders_cdc(id serial PRIMARY KEY, customer text, total numeric, status text);", "output": "CREATE TABLE" },
    { "cmd": "SELECT slot_name, lsn FROM pg_create_logical_replication_slot('cdc_demo', 'test_decoding');", "output": " cdc_demo | 0/2990C78" },
    { "cmd": "INSERT INTO orders_cdc(customer, total, status) VALUES ('ada', 42.50, 'pending');", "output": "INSERT 0 1" },
    { "cmd": "UPDATE orders_cdc SET status = 'shipped' WHERE customer = 'ada';", "output": "UPDATE 1" },
    { "cmd": "DELETE FROM orders_cdc WHERE customer = 'ada';", "output": "DELETE 1" },
    { "cmd": "SELECT lsn, data FROM pg_logical_slot_peek_changes('cdc_demo', NULL, NULL);", "output": "0/2990EC8 | BEGIN 4098\n0/2990F68 | table public.orders_cdc: INSERT: id[integer]:1 customer[text]:'ada' total[numeric]:42.50 status[text]:'pending'\n0/29910C8 | COMMIT 4098\n0/29910C8 | BEGIN 4099\n0/29910C8 | table public.orders_cdc: UPDATE: id[integer]:1 ... status[text]:'shipped'\n0/2991160 | COMMIT 4099\n0/2991160 | BEGIN 4100\n0/2991160 | table public.orders_cdc: DELETE: id[integer]:1\n0/29911D8 | COMMIT 4100" }
  ]
}
```

There it is: three ordinary SQL statements came back out as a structured, ordered, transaction-delimited change stream, without the application writing a single event.

The `test_decoding` plugin above is the built-in demo decoder; real pipelines use `pgoutput` (the protocol-native one) or `wal2json`. Same session with a `wal2json` slot, and the same insert becomes machine-readable (also real output):

```terminal
{
  "title": "wal2json: the same stream as JSON",
  "prompt": "neondb=>",
  "steps": [
    { "cmd": "SELECT data FROM pg_logical_slot_peek_changes('json_demo', NULL, NULL, 'format-version', '2');", "output": "{\"action\":\"B\"}\n{\"action\":\"I\",\"schema\":\"public\",\"table\":\"orders_cdc\",\"columns\":[{\"name\":\"id\",\"type\":\"integer\",\"value\":1},{\"name\":\"customer\",\"type\":\"text\",\"value\":\"grace\"},...]}\n{\"action\":\"C\"}" }
  ]
}
```

Two function families matter here: `peek_changes` reads without consuming (we used it above so the demos are re-runnable), while `get_changes` consumes, advancing the slot's acknowledged position, which is what a real consumer does on every poll. One honest subtlety we hit while testing: after consuming, `restart_lsn` (and so the retained-WAL number) does not drop instantly; Postgres advances it lazily once decoding no longer needs the older segments. Do not panic-tune based on a retention figure measured seconds after a catch-up. If you read [our WAL post](https://devops-daily.com/posts/wal-as-the-source-of-truth-lakebase-storage-s3), those LSNs are old friends: the stream's cursor is just a position in the log.

One more piece the stream does not give you: the past. A slot starts at creation time, so a new consumer needs the **initial snapshot problem** solved: copy the existing table contents first, then apply changes from the stream without a gap. Postgres supports this handoff properly (a slot creation can export a consistent snapshot to read the baseline from), and it is precisely the fiddly part that Debezium and the managed vendors have production-hardened; if you hand-roll a consumer, this is where the subtle bugs live.

CDC's superpower over the outbox is completeness: every committed change to the captured tables, including the UPDATE someone runs by hand during an incident. The fine print: DDL and sequences are not part of the stream, UPDATE/DELETE detail depends on the table's REPLICA IDENTITY, a crash can redeliver recent changes (consumers still deduplicate), and you inherit the table schema as your event schema. Plus one sharp operational edge.

## The slot that eats your primary's disk

A replication slot is a promise: Postgres keeps every WAL segment from the slot's `restart_lsn` forward, the point decoding would need to resume, so a slow consumer can always catch up. (That can trail the consumer's acknowledged position when long transactions are open, which is why an actively streaming slot can still pin WAL.) Read it as an ops engineer: **a slot that is not advancing forbids WAL cleanup, no matter whose WAL it is.**

Watch it happen. Same session, same idle `cdc_demo` slot, and the traffic we generate touches a completely different table (a slot is database-scoped; even consumers that filter to a publication still cause all WAL to be retained until they advance):

```terminal
{
  "title": "the retained-WAL trap, live",
  "prompt": "neondb=>",
  "steps": [
    { "cmd": "SELECT slot_name, active, pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS retained FROM pg_replication_slots WHERE slot_name = 'cdc_demo';", "output": " cdc_demo | f | 1488 bytes" },
    { "comment": "20,000 rows into a completely unrelated table" },
    { "cmd": "INSERT INTO bulk_junk(payload) SELECT repeat('x', 1000) FROM generate_series(1, 20000);", "output": "INSERT 0 20000" },
    { "cmd": "SELECT ... retained ...;", "output": " cdc_demo | f | 23 MB" },
    { "cmd": "UPDATE bulk_junk SET payload = repeat('y', 1000);", "output": "UPDATE 20000" },
    { "cmd": "SELECT ... retained ...;", "output": " cdc_demo | f | 45 MB" }
  ]
}
```

From 1,488 bytes to 45 MB of pinned WAL in under a minute, on a toy workload, from unrelated traffic. Now scale that to a production write rate and a CDC consumer that crashed on Friday evening: the primary's disk fills at your full WAL generation rate all weekend, and the incident that pages you says "database out of disk", nowhere near the actual culprit. This exact anatomy, a stalled consumer plus an unmonitored slot, is one of the classic self-inflicted Postgres outages.

Two guards, both cheap:

```sql
-- Alert on this. An inactive slot with growing retention is a countdown.
SELECT slot_name, active,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS retained_wal
FROM pg_replication_slots;

-- Postgres 13+: cap how much WAL slots may pin (enforced at checkpoints,
-- so treat it as a strong limit, not an exact one). A slot that exceeds it
-- is invalidated instead of the primary dying; the consumer typically
-- re-snapshots, which is a bad day but not an outage.
ALTER SYSTEM SET max_slot_wal_keep_size = '10GB';
SELECT pg_reload_conf();
```

When diagnosing, look past `active`: an active-but-lagging consumer pins WAL too. `wal_status` and `safe_wal_size` in `pg_replication_slots` tell you how close to the cliff each slot is, and Postgres 18 adds `idle_replication_slot_timeout` for automatic cleanup of abandoned slots.

And the operational rule behind both: **a replication slot is a consumer contract, not a fire-and-forget resource.** Create it when the consumer exists, monitor it like a queue, drop it when the consumer is decommissioned. (We dropped ours right after the recording; the demo project thanks us.)

## The landscape: run it or rent it

The protocol layer is standard Postgres, so the build-vs-buy question is about the pipeline around it: snapshotting existing data, schema change handling, delivery into your broker or warehouse, and babysitting the slots.

**Run it yourself: [Debezium](https://debezium.io/)** is the open source standard: usually a Kafka Connect connector, though Debezium Server delivers to non-Kafka sinks too. It handles initial snapshots and the common schema-change cases, and has seen every edge case in production somewhere. The cost is operating that machinery, and the slot monitoring above becomes your pager's problem.

**Rent the pipeline** (examples, not a census; the build/rent line blurs since several offer self-hosted versions): [Estuary](https://estuary.dev/) does real-time CDC into warehouses and streams with a managed backfill story; [Sequin](https://sequinstream.com/) is Postgres-native CDC aimed at developers who want changes as HTTP/streams without Kafka at all; [Artie](https://www.artie.com/) focuses on low-latency Postgres-to-warehouse replication; [Striim](https://www.striim.com/) sells the enterprise end with decades of database-replication lineage; and [Airbyte](https://airbyte.com/) wraps Debezium for the batch-leaning integration crowd. They differentiate on destinations, latency, and how much of the slot babysitting they absorb; all of them exist because that babysitting is real work. (Confluent's managed connectors and the clouds' native CDC services compete here too.)

The honest decision guide: if the events feed one warehouse nightly, a plain `updated_at` polling job is still legitimate and nobody should shame you for it. If your application needs to emit domain events it controls, start with the outbox. If you need every change, or changes from tables your code does not own, that is CDC, and the choice between Debezium and a managed pipeline is the choice of who wakes up for the slot alert.

## What to do with this

1. **Find your dual writes.** Grep for commit-then-publish patterns; each one is a consistency bug with an unknown detonation date.
2. **Adopt the outbox for domain events.** Same transaction or it did not happen.
3. **If you deploy CDC, deploy the slot monitor the same day.** The `pg_replication_slots` query above, alerted at a threshold well below your disk headroom, plus `max_slot_wal_keep_size` as the backstop.
4. **Treat slots as consumer contracts** with a lifecycle, an owner, and a decommissioning step.
5. And if Kafka entered the chat while you read this: [our guide to when you actually need it](https://devops-daily.com/posts/kafka-use-cases) pairs well here, because "transport for CDC events" is one of the six cases where it genuinely earns its keep.
