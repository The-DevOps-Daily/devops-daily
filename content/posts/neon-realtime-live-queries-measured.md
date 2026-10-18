---
title: 'Neon Realtime, Measured: Live SQL Queries Replace the LISTEN/NOTIFY Layer We Built by Hand'
excerpt: 'Neon Realtime turns a SQL query into a live subscription. We rebuilt our hand-made LISTEN/NOTIFY layer on it as a live order board and measured it on a real Neon project: 48,600 writes at up to 100 per second, which queries are re-sent in full on every write, what a reconnect delivers, scale to zero, and 14 attempts to tamper with a sealed query.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-10-19'
publishedAt: '2026-10-19T09:00:00Z'
updatedAt: '2026-10-19T09:00:00Z'
readingTime: '24 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Neon
  - Postgres
  - Realtime
  - Live Queries
  - Drizzle
  - WebSockets
  - Benchmarks
sponsorCampaign: 'neon'
---

In July we built realtime for a Neon app by hand: a Neon Function holding one server-sent events stream per browser, a Postgres `LISTEN` connection per function isolate, and a `pg_notify` call after every write. It kept one counter in sync. In August we did it again for a chat, with WebSockets in place of SSE and the same `LISTEN`/`NOTIFY` underneath.

[Neon Realtime](https://neon.com/docs/realtime/overview), in public beta since October 15, replaces all of that with a SQL query you subscribe to. We rebuilt the idea as a live order board on Drizzle and measured it on a real Neon project in `aws-eu-central-1`, from a client about 32 ms away.

**A plain live query kept pace with the write itself.** Across 16,200 writes at 1, 10 and 100 per second, the update reached the subscriber 35 to 43 ms (p50) after the write was issued, while the write's own commit took 34 to 40 ms to come back. Joins and aggregates were live too. All 48,600 writes in the matrix reached the subscriber, and every check we ran on the updates passed (which rows each one added, how many it removed, the size of every full result, the aggregate's total order count). We did not check every column value.

**But in this beta, most of the joins we tried, every aggregate and any `ORDER BY` were re-sent in full on every write.** The three-table join we first wrote for the board pulled 27 KB per write on a 200-row result, 52 times what the plain query used, and the cost grows with the result: 134 KB per write at 1,000 rows. At 100 writes per second, Neon kept up with those full results in our two complete raw-protocol runs. The Realtime SDK on our client needed about 9.4 ms of CPU for each one, and in one of our two SDK runs it fell about two seconds behind within a minute.

An open subscription let the compute scale to zero under it, and kept working when the next write woke it. The board did too, once its API stopped querying Postgres on every renewal. None of 11 tampered, forged or cross-branch attempts disclosed a victim row, an expired capability was refused, and a copied valid one kept working until it expired, which is how Neon documents it.

```github
The-DevOps-Daily/neon-realtime-measured
```

:::warning
Realtime is in public beta, and Neon publishes no benchmarks for it yet: its own docs say performance work is still under way. Every number here is a beta number from one project, one region and one client machine, recorded on October 16, 2026, with `@neon/realtime` 0.1.0.
:::

## TLDR

- **Setup is one deploy.** `neon deploy` with `preview: { realtime }` in `neon.ts` turned it on in about 19 seconds, with no waitlist. The primary's `wal_level` became `logical`; nothing else changed there that we could see.
- **A plain live query is about as fast as the write.** p50 35 to 43 ms from write issued to update applied, within 4 ms of the write's own acknowledgement, from a client 32 ms away. p99 53 to 85 ms.
- **All 48,600 writes arrived**, and every check on the updates passed: rows added, rows removed, result sizes and aggregate totals.
- **Most query forms we tried are re-sent whole on every write:** a join to `customers`, `EXISTS`, `IN`, aggregates, `ORDER BY` and `LIMIT`. That is about 134 bytes per row each time, 27 KB per write at 200 rows. Single-table filters and a membership join pinned to one row stay incremental.
- **At 100 full results a second, our client was the limit.** Two complete raw-protocol runs kept up. The SDK on our client needs about 9.4 ms of CPU per 200-row result, and one of two SDK runs fell two seconds behind.
- **Sessions end now and then, and a reconnect brings back the current result.** The server ended a session 11 times in an hour, and the SDK recovered in about 1.2 s each time. After a 75-second network cut, its backoff took 33 to 48 s to reconnect, and the result then held the same rows as the database.
- **Open subscriptions let the compute scale to zero**, unless the renew path queries Postgres: a membership lookup on every seal kept ours awake for the whole 300 s we watched.
- **Sealed queries held, and the access rule belongs in the query.** No tampered, forged or cross-branch attempt disclosed a victim row. A removed member's result was empty 8 ms after the removal, against 56 s of leaked orders with a check at seal time only.
- **Budget the bytes.** Neon's docs say network transfer is billed as usual, even though the project's meter showed far less than our test received.

## Prerequisites

- A Neon project in a Realtime region: `aws-us-east-1`, `aws-us-east-2`, `aws-eu-central-1` or `aws-ap-southeast-1` during the beta. There is no waitlist.
- The Neon CLI (`npm i -g neon`) and Node.js 22.18 or later (the repo's scripts run as TypeScript with Node's type stripping).
- The [companion repository](https://github.com/The-DevOps-Daily/neon-realtime-measured), if you want to rerun anything. Every script writes its raw output to `results/`.
- Our earlier posts for context: [Realtime Without a WebSocket Service](/posts/neon-functions-realtime-without-websockets) and [Realtime Chat With Auth](/posts/neon-realtime-chat-with-auth).

## What we are replacing

The July layer had three moving parts, all ours:

1. A Neon Function holding one server-sent events stream open per browser.
2. One `LISTEN counter_updates` connection per function isolate, on the direct connection string, because the transaction pooler cannot hold a session.
3. A `pg_notify` call after every write, carrying the new value.

Its own limits section said where it stopped. `NOTIFY` is fire-and-forget, so a browser that is offline at that moment misses the event. Payloads are capped at 8,000 bytes. And the app decides what each event means for the screen: a notify says "something changed", not "here is the new result".

With Realtime, the subscription is the query the screen shows. There is no function, listener or notify call in the app:

```tabs
{
  "title": "The live part of the app, before and after",
  "tabs": [
    {
      "label": "July: LISTEN/NOTIFY + SSE",
      "lang": "typescript",
      "code": "// Function: one LISTEN connection per isolate, on the unpooled URL\nconst listener = new Client({ connectionString: env.postgres.databaseUrlUnpooled })\nawait listener.connect()\nawait listener.query('LISTEN counter_updates')\nlistener.on('notification', (msg) => {\n  for (const c of clients) c.enqueue(encode(`data: ${msg.payload}\\n\\n`))\n})\n\n// Every write path has to remember to notify\nawait pool.query('SELECT pg_notify($1, $2)', ['counter_updates', String(row.value)])\n\n// Browser\nconst events = new EventSource('/events')\nevents.onmessage = (e) => render(Number(e.data))"
    },
    {
      "label": "Now: a sealed live query",
      "lang": "typescript",
      "code": "// API: seal the query the board shows, scoped by the user id from the verified token\napp.post('/api/board/live', async (c) => {\n  const userId = await requireUser(c)\n  const { storeId } = await c.req.json()\n  return c.json(await realtime.seal({ query: openOrdersQuery(db, userId, storeId) }))\n})\n\n// Writes are ordinary writes. There is nothing to notify.\n\n// Browser (React)\nconst { data, status } = useLiveQuery(sealedQuery, { refreshQuery })"
    }
  ]
}
```

The browser never sees SQL. The API builds the query with the user id from a verified Neon Auth token, and `realtime.seal()` encrypts the SQL, the parameters and the database name into a capability that expires after 60 seconds. The client can subscribe to it but cannot read or change it, and it renews by asking the API again.

## Setup

Realtime is enabled per branch. In `neon.ts` it sits next to Neon Auth, which the board uses for sign-in:

```ts
import { defineConfig } from '@neon/config/v1';

export default defineConfig({
  auth: true,
  preview: {
    // Browsers may connect only from these origins. Servers and scripts
    // that send no Origin header are not restricted by this list.
    realtime: { allowedOrigins: ['http://localhost:5173'] },
  },
});
```

One deploy applied both and wrote the variables the app needs:

```terminal
{
  "title": "one deploy enables Neon Auth and Realtime on the branch",
  "prompt": "$",
  "steps": [
    {
      "cmd": "npx neon deploy",
      "output": "→ Applying to branch main (br-frosty-queen-baejcesa)\nApplied changes\n  + Neon Auth\n  + Realtime\n\nUtilized services: Postgres, Neon Auth, Realtime\nPulled 7 Neon variables into .env\n  Postgres        DATABASE_URL, DATABASE_URL_UNPOOLED\n  Branch          NEON_BRANCH\n  Neon Auth       NEON_AUTH_BASE_URL, NEON_AUTH_JWKS_URL\n  Realtime        NEON_REALTIME_URL, NEON_REALTIME_SECRET"
    }
  ]
}
```

We read the primary before and after:

- `wal_level` went from `replica` to `logical`, because Realtime consumes logical replication.
- In three checks (before, after, and while live queries were open), the primary showed no new replication slot, publication or WAL sender. The Neon API still listed a single read-write compute.

Neon's FAQ says the incremental work "is incurred on a replica". We found no replica we could query, so we could not measure its lag on its own. What we measured is the time from a write to the update arriving, which includes it.

The CLI is the quickest way to see a live query. Here is a join, subscribed in one terminal while another made three transactions:

```terminal
{
  "title": "a join as a live query, from the CLI",
  "prompt": "$",
  "steps": [
    {
      "comment": "terminal 1: subscribe to a join"
    },
    {
      "cmd": "npx neon realtime subscribe \"SELECT o.id, o.status, o.total_cents, c.name AS customer FROM orders o JOIN customers c ON c.id = o.customer_id\"",
      "output": "Live query\nProject   purple-term-17791629\nBranch    main (br-frosty-queen-baejcesa)\nDatabase  neondb\nMode      Materialized result\nQuery     SELECT o.id, o.status, o.total_cents, c.name AS customer FROM orders o JOIN customers c ON c.id = o.customer_id\n[2026-10-16T14:46:41.545Z] Connecting…\n\n[2026-10-16T14:46:43.904Z] Initial snapshot · 0 rows\nQuery returned no rows.\n[2026-10-16T14:46:43.905Z] Live — waiting for changes."
    },
    {
      "comment": "terminal 2: seed a store, then three transactions three seconds apart"
    },
    {
      "cmd": "node scripts/smoke-write.ts",
      "output": "[2026-10-16T14:46:48.851Z] insert order { id: 1, txid: '1052' }\n[2026-10-16T14:46:51.906Z] update order { id: 1, txid: '1053' }\n[2026-10-16T14:46:54.947Z] insert + update in one transaction { new_id: 2, txid: '1054' }"
    },
    {
      "comment": "terminal 1: each transaction arrives as a complete new result (Rows), not as a change"
    },
    {
      "cmd": "",
      "output": "[2026-10-16T14:46:48.844Z] Rows · 0 rows\nQuery returned no rows.\n\n[2026-10-16T14:46:48.862Z] Rows · 1 row\nID  Status  Total Cents  Customer\n1   new     1250         Ada\n\n[2026-10-16T14:46:51.913Z] Rows · 1 row\nID  Status     Total Cents  Customer\n1   preparing  1250         Ada\n\n[2026-10-16T14:46:54.952Z] Rows · 2 rows\nID  Status  Total Cents  Customer\n1   ready   1250         Ada\n2   new     830          Grace"
    }
  ]
}
```

Each transaction came back as a complete new result (`Rows`), not as a change. In a second run with `--changes`, the same three kinds of transaction against a plain `SELECT ... FROM orders WHERE store_id = 1` arrived as small change sets, `Transaction 1056 · 1 upsert, 0 removals` and so on. That difference turned out to matter more than anything else in this post.

## How we measured

Everything ran from one client machine against the project in `aws-eu-central-1`. `SELECT 1` over a direct connection took 31 to 39 ms (p50 per run, median 32 ms), and a WebSocket ping to the Live SQL API 34 to 45 ms (median 41 ms). That round trip is the floor under every latency below.

**The workload.** Each run creates a fresh store with 200 orders. The writer is open-loop: it issues writes on a fixed schedule (1, 10 or 100 per second) whether or not earlier ones have finished, over a pool of 12 direct connections. When its timer runs late it catches up, and latency counts from the moment each write was actually issued, including any wait for a free connection. Each write is one transaction that inserts an order and deletes the store's oldest one, so the live result stays at 200 rows for the whole run, and the three shapes are compared at the same size. Each write returns its own transaction id from `pg_current_xact_id()`.

**Three query shapes**, written with Drizzle and sealed by the SDK's server half:

- plain: `orders` filtered by `store_id`
- join: `orders` joined to `customers` for the customer's name and to `store_members` for access
- aggregate: count and revenue per status for the store

**Matching updates to writes.** The subscriber runs the browser client (`createRealtimeClient`, with the `ws` package as its WebSocket) in a separate process on the same machine, and both processes stamp events from the same clock. An incremental update carries the ids of the transactions it covers, so it matches directly. A full result carries no ids, but the wire protocol opens each new result with the Postgres snapshot it was read at (`xmin`, `xmax`, `xip`), and the scorer applies Postgres's own visibility rule to work out which writes it includes. Latency runs from the moment the writer issued a statement to the moment the SDK handed over the first update that included it.

**Checking answers, not only timing.** Every update is checked against the writes. An incremental batch must add exactly the rows its transactions inserted (by the sequence number each write stamps on its row) and remove one row for each write that deleted one. A full result must hold every stamped row the visible writes leave in the window, and exactly as many rows as the window should have. An aggregate's order counts must add up to the window. These checks do not cover which seed or deleted rows were involved, per-status counts, revenue or other column values. A self-test corrupts copies of recorded runs (a dropped update, a wrong row, a missing row, an aggregate off by one, a stall, a line from another run) and checks that the scorer reports each one.

**Separating our own client.** In our first recording of the matrix, other jobs on the client machine pushed it into swap, and our recorder processes froze for up to 11 seconds at a time. A frozen recorder looks exactly like a slow server in the timestamps. So the recorders now log every gap of more than 60 ms in their own event loops, the scorer sets apart writes whose window overlaps one, and the first recording stays in the repo marked as superseded. Each configuration ran twice, in two rounds with the shape order rotated.

## The latency

```chart
{
  "type": "line",
  "title": "Write issued to update applied, p50",
  "unit": "ms",
  "caption": "Neon Realtime beta, aws-eu-central-1, client about 32 ms away. Each point pools two runs: 600 writes at 1/s, 3,600 at 10/s, 12,000 at 100/s. The live result is held at 200 rows. Dashed: how long the write itself took to be acknowledged, all shapes.",
  "x": [
    "1 write/s",
    "10 writes/s",
    "100 writes/s"
  ],
  "series": [
    {
      "name": "plain",
      "data": [
        41.9,
        42.8,
        34.7
      ]
    },
    {
      "name": "join",
      "data": [
        56.2,
        53.6,
        60.4
      ]
    },
    {
      "name": "aggregate",
      "data": [
        47.2,
        42.4,
        40.7
      ]
    },
    {
      "name": "write acknowledged",
      "data": [
        42.5,
        38.4,
        35
      ],
      "dash": "6 5"
    }
  ]
}
```

All 18 runs, 48,600 writes:

| Shape     | Writes/s | Writes | p50  | p90  | p99   | max   | After the commit ack, p50 |
| --------- | -------- | ------ | ---- | ---- | ----- | ----- | ------------------------- |
| plain     | 1        | 600    | 41.9 | 44.8 | 52.6  | 1,423 | 3.5                       |
| plain     | 10       | 3,600  | 42.8 | 46.9 | 58.6  | 938   | 2.7                       |
| plain     | 100      | 12,000 | 34.7 | 37.5 | 85.0  | 1,011 | 1.7                       |
| join      | 1        | 600    | 56.2 | 64.9 | 90.3  | 105   | 12.2                      |
| join      | 10       | 3,600  | 53.6 | 59.8 | 94.4  | 1,335 | 17.5                      |
| join      | 100      | 12,000 | 60.4 | 244  | 2,083 | 2,320 | 23.8                      |
| aggregate | 1        | 600    | 47.2 | 50.7 | 63.0  | 176   | 3.9                       |
| aggregate | 10       | 3,600  | 42.4 | 44.9 | 120   | 1,220 | 4.0                       |
| aggregate | 100      | 12,000 | 40.7 | 47.6 | 648   | 1,374 | 7.2                       |

All times are in milliseconds, from the write being issued to the update that included it. The last column is the same, measured from the moment the writer got its commit acknowledged; the update usually arrived within a few milliseconds of the writer hearing back, and sometimes before.

Three things in that table need explaining.

**The plain query is about as fast as the network allows.** Its p50 is within 4 ms of the write's own acknowledgement at every rate. Both the writes and the updates got faster as the rate went up, by about 7 ms between 1 and 100 writes per second. The likely reason is our client, not Neon: its Wi-Fi saves power when traffic is light (more on that at the end).

**The join costs 11 to 26 ms more than the plain query at p50,** and the reason is not the join itself. It is that every write re-sends the whole result, which the next section is about. At 100 writes per second its tail is our client falling behind, also below.

**The maximums of about one second at most rates are the server ending the session.** Eleven times in 59 minutes of subscriptions, a subscription received `connection_error: backend_session_lost` ("live query session ended; reconnect required"). Every time, the SDK reconnected and was live again 0.95 to 1.51 s later (median 1.2 s), with a complete fresh result. The scorer tied 233 writes slower than 300 ms to these episodes, 66 of them at 1 or 10 writes per second, and they account for every maximum above 900 ms at those rates. All eleven came at the same second past the minute (:42 or :43), as if a task on a 60-second cycle sometimes ends sessions. Our first, superseded recording had nine more. We cannot see the cause from the client.

At 100 writes per second, our own client stalled during part of the plain and aggregate runs (107 and 433 writes overlap a stall); without those writes, the p99 is 46 ms for the plain query and 92 ms for the aggregate. Treat those two as diagnostics, not corrected Neon numbers: a slow write has more chances to overlap a stall, and at high rates the SDK's own work causes some of the stalls.

## Most queries are re-sent whole on every write

Neon's CLI docs say "some queries, such as ones with `ORDER BY`, can get a complete replacement for a change". In our tests, most query forms got one on every write. We subscribed to several forms of the same question at once, on a store with 300 orders, and made three single-row inserts:

| Query form (300 orders in the store)               | Rows in result | On each insert     | Bytes per write |
| -------------------------------------------------- | -------------- | ------------------ | --------------- |
| `WHERE store_id = $1`                              | 300            | incremental change | 479             |
| `... ORDER BY id DESC LIMIT 20`                    | 20             | full result again  | 2,947           |
| `JOIN customers` for the name                      | 300            | full result again  | 37,346          |
| `JOIN store_members`, pinned to one user and store | 300            | incremental change | 472             |
| `EXISTS (SELECT 1 FROM store_members ...)`         | 300            | full result again  | 33,245          |
| `store_id IN (SELECT ... FROM store_members ...)`  | 300            | full result again  | 33,245          |
| `count(*) ... GROUP BY status`                     | 3              | full result again  | 977             |
| `count(*)`                                         | 1              | full result again  | 760             |

Of these forms, only two stayed incremental: a single-table filter, and a join to `store_members` whose `WHERE` clause pins it to one row. Everything else, including `EXISTS` and `IN`, which are the obvious ways to write a membership check, was re-sent in full: 110 to 125 bytes per row on every write, whether the write touched one row or all of them.

A second set, against the board's own queries and three kinds of write:

| Query form                                                    | Order insert          | Order marked done     | Customer insert       |
| ------------------------------------------------------------- | --------------------- | --------------------- | --------------------- |
| Board: open orders (`JOIN store_members`, `status <> 'done'`) | change, 396 B         | change, 354 B         | nothing sent          |
| Board: customers (`JOIN store_members`)                       | nothing sent          | nothing sent          | change, 389 B         |
| Board: counts per status (`GROUP BY`)                         | full result, 885 B    | full result, 986 B    | nothing sent          |
| `JOIN customers`, both tables filtered to the store           | full result, 37,180 B | full result, 37,175 B | full result, 37,175 B |
| `ORDER BY id`, no `LIMIT`                                     | full result, 33,104 B | full result, 33,099 B | nothing sent          |
| `LIMIT 50`, no `ORDER BY`                                     | full result, 5,978 B  | full result, 5,972 B  | nothing sent          |
| `SELECT DISTINCT status`                                      | full result, 868 B    | full result, 965 B    | nothing sent          |
| `WHERE store_id = $1` (control)                               | change, 387 B         | change, 388 B         | nothing sent          |

Two useful details are in there. A write to a table a query does not read sends that subscriber nothing at all. And sorting alone is enough to lose incremental updates: `ORDER BY id` with no `LIMIT` re-sent all 300 rows on every write. Sort in the client instead.

The cost of a full result grows with the result. The join, at 1 write per second for 60 seconds, at four result sizes, with a 5,000-row plain query as the control:

| Live query | Rows in result | Bytes per write | p50      | p90      |
| ---------- | -------------- | --------------- | -------- | -------- |
| join       | 10             | 1,980           | 48.1 ms  | 52.1 ms  |
| join       | 100            | 13,953          | 52.9 ms  | 62.8 ms  |
| join       | 1,000          | 134,225         | 99.2 ms  | 111.9 ms |
| join       | 5,000          | 668,496         | 225.1 ms | 273.4 ms |
| plain      | 5,000          | 572             | 42.6 ms  | 45.6 ms  |

That is linear: about 134 bytes per row, re-sent on every write that changes anything in the result. Neon's docs say egress from Realtime is billed as usual (Free includes 5 GB per project per month; Launch and Scale include 500 GB, then $0.10 per GB). One browser tab watching that 1,000-row join while the table takes a steady 10 writes per second receives about 4.8 GB (decimal) an hour. Twenty tabs for an 8-hour day, 22 working days a month, is about 17 TB, or roughly $1,650 a month past the Launch allowance, if nothing else in the project uses that allowance. The plain query in the same setting comes to about 73 GB.

One thing we cannot square with that. When we read Neon's consumption API at 19:26 UTC, it showed 16.2 MB of public network transfer for the project for 15:00 to 18:00 UTC, three hours in which our bench recorders alone received at least 862 MB of Realtime messages. We did not find out why. Realtime is free during the beta, but the docs say the waiver does not cover network transfer, so plan on paying for the bytes above rather than going by the meter's current reading.

## At 100 writes per second, the client falls behind first

A full result has to be decoded and applied by the client. For the 200-row join at 100 writes per second, that is 100 full results a second, about 2.7 MB/s.

```chart
{
  "type": "line",
  "title": "The 200-row join at 100 writes/s, p50 per 5 seconds",
  "unit": "ms",
  "caption": "Every write re-sends the whole 200-row result (about 27 KB). The raw recorder speaks the wire protocol without decoding rows; the SDK client decodes and applies each full result. Same project, same writer.",
  "x": [
    "0s",
    "5s",
    "10s",
    "15s",
    "20s",
    "25s",
    "30s",
    "35s",
    "40s",
    "45s",
    "50s",
    "55s"
  ],
  "series": [
    {
      "name": "SDK client, round A",
      "data": [
        51.6,
        50.4,
        51.7,
        59.2,
        60.5,
        60,
        61.1,
        60.8,
        62.3,
        70.7,
        745.8,
        1787.3
      ]
    },
    {
      "name": "SDK client, round B",
      "data": [
        49.8,
        50.2,
        51.8,
        59.1,
        59.1,
        59.3,
        60,
        53.4,
        61.3,
        61.4,
        64.4,
        64.1
      ]
    },
    {
      "name": "raw recorder, run D1",
      "data": [
        40.8,
        40.2,
        40.2,
        48.9,
        47.8,
        48.4,
        50.7,
        48.8,
        48.4,
        48.7,
        48.9,
        48.7
      ],
      "dash": "6 5"
    },
    {
      "name": "raw recorder, round B",
      "data": [
        45.6,
        45.3,
        45.8,
        53.4,
        53.4,
        53.2,
        52.2,
        53.7,
        48.7,
        52.5,
        52,
        53.3
      ],
      "dash": "6 5"
    }
  ]
}
```

To find out which side was falling behind, we wrote a second recorder that speaks the wire protocol directly and never decodes the rows. With it, at the same rate, the join held a p50 of 44 to 49 ms and a p99 of 73 to 114 ms over two complete runs of 6,000 writes, with no backlog. A third raw run started badly: 220 writes in its first five seconds were delayed by up to 957 ms, with no recorded client stall overlapping those delays, and a session loss then cut it off 16 seconds in, because the raw recorder does not reconnect. The two complete runs kept up; the third had update-path delays we cannot explain before the server ended its session.

The SDK client is the slow part, on our machine. In a separate benchmark at 20 updates a second, with a materialized subscription, it used 2.1 ms of CPU per update for the plain query, 2.0 ms for the aggregate and 9.4 ms for each 200-row join result. If that cost held at 100 a second, it would take about 94% of one core. In one of our two SDK runs at that rate it fell behind and never caught up (p50 1.8 s in the last five seconds); in the other it held on, with stalls of up to 470 ms. We did not measure other hardware. Either way, the work grows with result size times write rate, on every subscriber.

All four runs in the chart, raw and SDK alike, stepped up by 7 to 9 ms about 15 seconds in and stayed there. We did not find out why.

## What a reconnect delivers

Our July layer had no answer for a dropped connection: whatever `NOTIFY` fired while a browser was away was gone. Realtime's answer is a fresh copy of the result. We watched two live queries (the plain one and the join) while a writer added an order every 500 ms, then cut the network twice: every socket destroyed, and new connections sent to an address that never answers. The second cut lasted 75 seconds, longer than a sealed query lives, and renewal failed during it, as it would for a browser that is offline:

```terminal
{
  "title": "cutting the network for 5 s, then for 75 s",
  "prompt": "$",
  "steps": [
    {
      "comment": "two live queries, plain and join, on one store; a writer adds an order every 500 ms"
    },
    {
      "cmd": "node scripts/reconnect.ts",
      "output": "   0.57s  plain state live \n   0.92s  join  state live \n   0.92s  setup both live: plain 100 rows, join 100 rows \n   8.92s  net   short: cut for 5 s \n   8.94s  join  state connecting \n   8.94s  plain state connecting \n  13.93s  net   short: restored; 10 orders were written during the cut \n  16.72s  plain state live \n  16.77s  join  state live \n  20.60s  plain short +2 s: 134 rows, database 134, missing 0, extra 0 {\"status\":\"live\"}\n  20.65s  join  short +2 s: 134 rows, database 134, missing 0, extra 0 {\"status\":\"live\"}\n  28.65s  net   long: cut for 75 s \n  28.65s  join  state connecting \n  28.65s  plain state connecting \n  49.85s  join  renew failed: offline "
    },
    {
      "comment": "107 more renewal failures follow, one a second for each subscription, until the network returns"
    },
    {
      "cmd": "",
      "output": " 103.65s  net   long: restored; 140 orders were written during the cut \n 136.93s  plain renewed \n 137.02s  plain state live \n 151.87s  join  renewed \n 151.97s  join  state live \n 153.92s  plain renewed \n 153.94s  join  renewed \n 156.06s  plain long +2 s: 382 rows, database 382, missing 0, extra 0 {\"status\":\"live\"}\n 156.14s  join  long +2 s: 382 rows, database 382, missing 0, extra 0 {\"status\":\"live\"}\n 159.73s  plain final: 382 rows, database 382, missing 0, extra 0 {\"status\":\"live\"}\n 159.78s  join  final: 382 rows, database 382, missing 0, extra 0 {\"status\":\"live\"}\n 159.79s  plain state closed \n 159.79s  join  state closed "
    }
  ]
}
```

After both cuts, the first thing to arrive was a complete result (130 rows, then 351 and 378), not a replay of the changes that were missed, and both live results held exactly the same rows as the database. That is what you want for a screen. It is not a durable event log: if your app needs to see every intermediate state, Realtime will not give it to you after a gap, and neither did `NOTIFY`.

The wait after the long cut is the part to plan for. The SDK reconnects with jittered exponential backoff (a 1-second base, capped at 60 seconds), and version 0.1.0 does not listen for the browser's `online` event (we checked the source). So after a long outage the network can be back for half a minute or more before the board is. Show the subscription's `status` in the UI rather than assuming it is live. The short cut cost 2.8 seconds.

## Sealed queries: what we could and could not forge

A sealed query is an AES-256-GCM encrypted capability (a compact JWE) that holds the SQL, its parameters and the database name, and expires after 60 seconds. The browser holds it but cannot read it, and the Live SQL API checks it without calling your server. We tried to get rows we were not sealed for. The attacker holds a valid sealed query for their own store, as any signed-in user of the board would, and wants another store's orders. The script speaks the wire protocol directly, because an attacker is not bound to use the SDK. Each attempt has one expected outcome, and anything else (another error or a timeout) counts as a failure, as does a single row from the victim's store, except in the documented stolen-query case. The control, the stolen-query case and the renewal attack each include a write during the attempt, so incremental changes are checked for leaks as well as first results:

| Attempt                                                                                                           | Result                                                           |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Control: the attacker's own sealed query, then an order in their store                                            | delivered: the attacker's 5 rows, then the new order as a change |
| One character changed in the ciphertext, the tag or the IV                                                        | `authorization_failed`                                           |
| Header and IV from one capability, ciphertext and tag from another                                                | `authorization_failed`                                           |
| Ciphertext truncated                                                                                              | `authorization_failed`                                           |
| The victim's query sealed with a guessed secret in the right format                                               | `authorization_failed`                                           |
| Header rewritten to `alg: none`                                                                                   | `authorization_failed`                                           |
| A `sql` field added to the subscribe message                                                                      | `connection_error: invalid_payload`                              |
| Renewing a live subscription with a forged capability for the victim's query, then an order in the victim's store | `renewal_failed`, and nothing from the victim's store            |
| A query sealed with a child branch's secret, sent to the parent branch                                            | `authorization_failed`                                           |
| A query sealed with the parent's secret, sent to the child branch                                                 | `authorization_failed`                                           |
| The attacker's own sealed query, 65 seconds after sealing                                                         | `authorization_expired`                                          |
| The victim's real sealed query, copied, then an order in the victim's store                                       | **delivered: all 30 victim rows, then the new order**            |

All 14 outcomes were as expected, in a first run and again in this stricter one after review. No tampered, forged or cross-branch attempt disclosed a victim row or change, and the expired capability was refused. A child branch got its own Realtime URL and its own secret, so a preview branch's capabilities do not open production. To check that the harness could fail, a self-test swaps one attack's payload for the victim's real sealed query; the checks then report that attack as a leak.

The last row is the documented catch: **a sealed query is a bearer token.** Anyone who holds one can subscribe until it expires. Expiry closes that window within 60 seconds of sealing; it does not take back rows already received. Keep sealed queries out of URLs, logs and persistent browser storage, as Neon's docs say.

## Scoping per user without row-level security

Realtime has no row-level security yet. Neon's guidance is to authorize in the request handler and put the authorization inside the query: take the user id from a verified token, and join through the membership table so the query itself only matches rows that user may see. We tested that against two weaker designs, through the board's API, with real Neon Auth users. These runs used a version of the API that also looked the user up in `store_members` before sealing, which is why renewals were refused after a removal; the board in the repo now skips that lookup (see the next two sections) and seals a query whose membership join simply returns nothing for a non-member:

| Design                                                                    | After the user lost access                                                                                                                                           |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Membership join inside the live query (the board)                         | Their result was empty **8 ms** after the removal was acknowledged (one test, checked every 5 ms). 0 of 6 orders added afterwards reached them.                      |
| Membership checked when sealing, but the query only filters by `store_id` | **12 of 18** new orders still reached them. The last one was added 56 s after the removal. It stopped when the sealed query expired and the API refused to renew it. |
| A member's sealed query copied to a non-member                            | **12 of 18** new orders reached the non-member. The last one was added 56 s after sealing. The API refused the non-member's renewal.                                 |

So the pattern works, and the join is what makes it work. A check at seal time alone leaves a window of up to one sealed-query lifetime, and only because the renewal goes back through your API, which refuses it. Put the access rule in the query, with the user id sealed in from a verified token, and a removal reaches the live result with the next update, without waiting for the sealed query to expire.

One more consequence of the full-result rule: the obvious ways to write that access check, `EXISTS` and `IN (SELECT ...)`, are re-sent whole on every write. The join to `store_members`, pinned to one row by the `WHERE` clause, is not.

## The board

The live order board in the repo is a Vite and React app with a Hono API, Drizzle for the schema and the queries, and Neon Auth for sign-in. Its first version used the three-table join from the measurements, which re-sends every order on every write. The version in the repo subscribes to three queries instead, each scoped by a join to `store_members` on the user id from the verified token:

```typescript
// Open orders: incremental. The customer name is not joined in here.
export function openOrdersQuery(db: Db, userId: string, storeId: number) {
  return db
    .select({
      id: orders.id,
      customer_id: orders.customer_id,
      status: orders.status,
      total_cents: orders.total_cents,
      created_at: orders.created_at,
    })
    .from(orders)
    .innerJoin(storeMembers, eq(storeMembers.store_id, orders.store_id))
    .where(
      and(eq(storeMembers.user_id, userId), eq(orders.store_id, storeId), ne(orders.status, 'done'))
    );
}

// Customers: incremental, and an order write sends this subscription nothing.
export function storeCustomersQuery(db: Db, userId: string, storeId: number) {
  return db
    .select({ id: customers.id, name: customers.name })
    .from(customers)
    .innerJoin(storeMembers, eq(storeMembers.store_id, customers.store_id))
    .where(and(eq(storeMembers.user_id, userId), eq(customers.store_id, storeId)));
}

// The header: an aggregate, re-sent whole on every write, which is fine at four rows.
export function statusCountsQuery(db: Db, userId: string, storeId: number) {
  /* GROUP BY status */
}
```

The browser joins the first two with a `Map` from customer id to name, and sorts on its own side, because `ORDER BY` in the live query would re-send everything. Status changes are optimistic: the card moves at once with React's `useOptimistic`, the API's `UPDATE ... RETURNING pg_current_xact_id()` returns the transaction id, and `awaitTxId()` on the live query holds the optimistic state until that transaction arrives.

The API's seal endpoint verifies the Neon Auth token and seals, and that is all: sealing is local crypto, so a renewal never touches Postgres. It does not look the user up in `store_members` first. That lookup would only turn a non-member's empty board into a 403, because the join inside each query is what keeps them out, and it would cost a database query on every renewal of every subscription. The next section shows what that does to scale to zero.

A scripted run through the same API and SDK calls the app makes (`scripts/board-check.ts`) passed every check. A new order appeared on the board 99 ms after the POST was sent, moving it to `preparing` showed up in 70 ms, and marking it `done` took it off the board in 54 ms, each measured to the moment `awaitTxId` resolved. A user from another store got an empty board from the same endpoint, and a 403 when adding an order to it.

## Scale to zero: open subscriptions let the compute sleep

Neon's docs say holding a subscription open does not keep the database awake, but starting one can wake it. We checked both, with the suspend timeout shortened to 60 seconds through the Neon API and the compute's state polled every 5 seconds:

| Step                                                       | What happened                                                                                                                                                                                                        |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Control: nothing open                                      | The compute suspended 65 s after we started watching.                                                                                                                                                                |
| A live query started while the compute was suspended       | First result in 0.98 s. The compute was active again 0.3 s later.                                                                                                                                                    |
| That subscription held open, renewed every 50 s, no writes | The compute suspended 75 s later, and was still suspended 60 s after that. The subscription stayed `live` the whole time.                                                                                            |
| A write while suspended, subscription still open           | Connecting to the waking compute took 853 ms and the insert 247 ms (1.14 s in all, closing the connection included). The open subscription received the change 1.12 s after the write was issued, with no reconnect. |
| A second live query started from a suspended compute       | First result in 1.84 s, and it woke the compute.                                                                                                                                                                     |

So an open subscription costs no compute while nothing writes, and it survives the compute going to sleep under it. The cost is on the first write or the first new subscriber after a quiet spell: about a second, the same cold start any query pays. We could not see the replica that Neon says does the incremental work, so we cannot say whether it suspends too; Neon does not charge for it during the beta.

**The board itself is another matter, because its renewals go through your API.** We ran alice's three board queries with the browser's renewal timing (10 seconds before each 60-second expiry), sealed and renewed through the board's API, with the suspend timeout at 60 seconds:

| Board API                                                 | Compute while the board sat open with no writes                   |
| --------------------------------------------------------- | ----------------------------------------------------------------- |
| Looks the user up in `store_members` on every seal        | Never suspended in 300 s. 18 renewals, each one a database query. |
| Seals without touching Postgres (the version in the repo) | Suspended 75 s after the board opened.                            |

The membership lookup looks harmless, and it cost scale to zero entirely: with it, each open tab made three database queries roughly every 50 seconds while its renewals succeeded, one every 17 seconds on average, and that kept the compute awake for the whole 300 seconds we watched. Keep the renew path free of database calls. Signing in, and refreshing the Neon Auth token (it lasts about 15 minutes), go through Neon Auth, which keeps its tables in the same database; we did not measure whether a token refresh wakes the compute.

## Writes on the primary, with and without 100 live queries

Neon's FAQ says Realtime has "zero impact on the write-latency, write-throughput or write-compute of your primary database". We ran a writer at 20 writes per second for the whole test and switched 100 live queries on and off in alternating 60-second blocks: off, on, off, on, off, on. Each query belonged to a different user and every write touched all 100 of them: nominally 2,000 updates a second (20 writes times 100 queries) to the subscriber process. Writes during each switch and for 20 seconds after it were left out.

|                                                                            | 100 live queries off | 100 live queries on |
| -------------------------------------------------------------------------- | -------------------- | ------------------- |
| Write execution time on the primary (`pg_stat_statements`, mean per block) | 0.157 to 0.164 ms    | 0.150 to 0.166 ms   |
| Write latency on the client, p50 per block                                 | 34.3 to 39.4 ms      | 32.3 to 33.8 ms     |
| Write latency on the client, p99 (all blocks)                              | 47.6 ms              | 42.5 ms             |
| Writes                                                                     | 3,603                | 3,603               |

On the server, the write's own execution time did not move. On the client, the pooled median write was about 2.5 ms faster with the live queries on, and each on block had a lower median than the off block before it, which is the opposite of a slowdown. We think that is our client and not Neon: it is on Wi-Fi with power saving on, and the extra incoming traffic keeps the radio awake. We did not test that explanation. A first version of this test let the CPU clock follow the load, tagged some switching time to the wrong block, and lacked an index that keeps the write's `DELETE` cheap (its execution time jumped from 0.3 to 3.2 ms partway through). It showed the same direction and is kept in the repo as superseded. Both versions ran with Realtime enabled throughout, so neither measures what turning Realtime on (`wal_level = logical`) costs.

So under this workload we saw no slowdown of writes on the primary with 100 subscriptions open, which matches Neon's claim. `pg_stat_statements` does not include commit time, though, and our client's own noise is larger than a millisecond, so "no slowdown we could measure" is as far as this goes.

## What we could not conclude

- **The replica's lag on its own.** Neon says the incremental work runs on a replica. We could not see one in the project, the Neon API or the primary's replication views, so every number here is end to end.
- **Why the server ends sessions.** Twenty `backend_session_lost` errors across both recordings, most of them at the same second past the minute, as if on a 60-second cycle. The SDK handled every one, but we cannot see the cause.
- **Why the four join runs at 100 writes per second in the chart got 7 to 9 ms slower about 15 seconds in,** the raw recorder's included.
- **What the SDK costs on other hardware.** We measured it on one client, a Raspberry Pi on Wi-Fi with power saving on, and nowhere else. The Wi-Fi also shaves a few milliseconds off everything when traffic is heavy, which is the likely reason most numbers improved at higher write rates.
- **More than 100 subscribers, or more than one client.** Neon says thundering-herd protection is built in; we did not test a reconnect storm.
- **The bill.** Realtime is free during the beta and its network transfer is documented as billed, but the project's transfer meter showed far less than our Realtime traffic, so we cannot tell you what this test would have cost.
- **Whether any of this survives the beta.** Neon calls the protocol unstable and the performance work unfinished. The full-result behaviour in particular may change; rerun `scripts/explore-incremental.ts` before you design around it.

## Wrapping up

For a live order board, Neon Realtime replaces everything our July layer did and covers what it could not. There is no function holding connections, no `LISTEN` session, and no `NOTIFY` call to forget on a write path. A reconnect brings back the right result instead of losing events, and the board shows a query result rather than an event the app has to interpret. A plain live query arrived as fast as the write's own acknowledgement, and none of the 48,600 writes went missing.

The part to design for is the full re-send. Write the live queries as single-table filters, or join only to a membership table pinned to one row. Do the other joins and all sorting in the client, and keep live aggregates to a handful of groups. Check each query with the CLI's `--changes` flag: a `Rows` line on every write means the whole result is coming back each time. Put the access rule inside the query, and budget for the bytes a full result costs on every write, times every subscriber.

The [repo](https://github.com/The-DevOps-Daily/neon-realtime-measured) has the board, every script, and the raw output of every run, including the ones we superseded.
