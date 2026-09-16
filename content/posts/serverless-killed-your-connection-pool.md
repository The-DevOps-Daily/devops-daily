---
title: 'Serverless Killed Your Connection Pool'
excerpt: 'A connection pool only works because a process outlives the request. Take the process away and it has nothing to amortise across. Measured against a real Postgres: what a cold connection costs, why the pooler barely helps latency, and the benchmark that makes pooling look pointless.'
category:
  name: 'Cloud'
  slug: 'cloud'
date: '2026-09-15'
publishedAt: '2026-09-15T14:00:00Z'
updatedAt: '2026-09-15T14:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Postgres
  - Serverless
  - Neon
  - Performance
  - Databases
---

A connection pool is one of those things you set up once and stop thinking about. Ten connections, reused forever, and the cost of opening one disappears into the noise because it happened at boot and never again.

That works because a process outlives the request. Every serverless and edge runtime takes the process away, and the pool goes with it. What is left is a per-invocation cost that used to be amortised across everything, and it is larger than most people expect.

This post measures it. Every number is from a real Postgres 18 instance, and the repository is at the end so you can run the same thing against yours.

## TLDR

- **A cold connection costs about eight times the query.** Measured: **341 ms** to connect, query and disconnect against **39 ms** through a reused pool.
- **The pooled connection string does not fix that.** It measured **313 ms**, saving 28 ms, because you still pay TCP, TLS and authentication to reach the pooler.
- **What the pooler fixes is the count.** Sixty concurrent invocations cost **60 Postgres backends** direct, and **3** through the pooler.
- **A module-scope pool is per execution environment, not per application.** `max: 10` means ten connections in each of however many environments your platform decides to run.
- **The HTTP driver is cheaper, but not free.** 43 ms once its connection is warm, and about 385 ms cold against 650 ms for a cold Postgres connect, both including roughly 334 ms of process startup. It still pays TCP and TLS; it just needs half the round trips.
- There is a benchmark that makes pooling look useless, and it is easy to write by accident. It is in here.

## Prerequisites

- A Postgres you can connect to. The numbers below are Neon because the pooler and the HTTP driver are both first-party there, but the shape applies to any managed Postgres with a pooler in front of it.
- Node 18 or newer, `pg`, and `@neondatabase/serverless` if you want the fourth row.

## What one connection actually costs

Four ways to run `select 1`. The unit is an **invocation**, meaning everything a serverless function does from cold, not just the query:

```js
// the serverless shape: connect, query, disconnect, every time
async function direct() {
  const c = new pg.Client({ connectionString: DIRECT });
  await c.connect();
  await c.query("select 1");
  await c.end();
}

// the long-lived process shape: one pool, reused
const pool = new pg.Pool({ connectionString: DIRECT, max: 10 });
async function pooled() {
  await pool.query("select 1");
}
```

Thirty invocations of each:

```terminal
{
  "title": "four ways to run select 1",
  "prompt": "$",
  "steps": [
    { "comment": "30 invocations each, real Postgres 18" },
    { "cmd": "DATABASE_URL=... npm run bench", "output": "cold connect (no pool)             median   341.1 ms   p95   477.7 ms   min   279.1 ms\ncold connect via Neon pooler       median   312.7 ms   p95   362.4 ms   min   290.3 ms\nHTTP driver (no connection)        median    43.2 ms   p95   340.5 ms   min    34.9 ms\nreused pool (long-lived process)   median    39.4 ms   p95    41.3 ms   min    36.4 ms" }
  ]
}
```

**The query is not the cost. The connection is.** 341 ms against 39 ms, for identical work, and the only difference is whether a socket was already open.

Two things before you read too much into the absolute numbers. These were measured from a machine in Bulgaria against a database in `eu-central-1`, so distance is in every row. A raw TCP handshake to that host measured **47 to 53 ms**, which is why the reused pool at 39 ms is the interesting number: it is *faster than a TCP handshake*, because it does not perform one.

## The pooled connection string is not the fix

Look at the second row again.

Managed Postgres providers offer a pooled endpoint, usually pgbouncer, usually the same hostname with `-pooler` in it. The advice to use it on serverless is everywhere, and the natural reading is that it makes connecting cheap.

It measured **313 ms** against 341 ms. Twenty-eight milliseconds, on a gap of three hundred.

That is not a disappointment, it is a category error on our part. The pooler is a separate process you connect to over the network. You still open a TCP connection to it, still negotiate TLS, still authenticate. Everything expensive about connecting is still there, just terminating somewhere else.

**The pooler was never a latency product.** It is a concurrency product, and the second experiment shows what it is actually doing.

## What the pooler is actually for

Sixty invocations at once. Each connects, runs a fast query, then stays connected and idle for half a second before disconnecting, which is what an ordinary request does while it renders a response or waits on something else.

A separate connection polls `pg_stat_activity` throughout and records the peak. The baseline is read in the same run, because pgbouncer grows and shrinks its own warm pool and only the difference means anything:

```terminal
{
  "title": "sixty at once",
  "prompt": "$",
  "steps": [
    { "comment": "connect, select 1, idle 500 ms, disconnect" },
    { "cmd": "DATABASE_URL=... npm run concurrency", "output": "straight to the compute    baseline    8   peak   68   added   60   wall 1.7s   failed 0\nthrough the pooler         baseline    9   peak   12   added    3   wall 1.7s   failed 0" }
  ]
}
```

**Sixty invocations, sixty backends.** Each one is a real Postgres process, forked, authenticated, given its memory, and torn down again. Through the pooler the same sixty cost three.

That is the ceiling nobody notices until they hit it. `max_connections` on this instance is 450. A long-lived service with a pool of ten never goes near it. A serverless function at sixty concurrent invocations is already using an eighth of the database's entire capacity, and concurrency is the one thing serverless platforms are happy to give you for free.

### The pool you kept is not one pool

Worth being exact here, because it is the part that surprises people who did everything right.

Putting the pool at module scope, outside the handler, is the **correct** thing to do. It is what every serverless provider's documentation tells you, and it is what lets the pool survive between invocations on a warm instance. Move it inside the handler and you are back to the 341 ms column.

But a module-scope pool is per **execution environment**, not per application. Your platform runs sixty concurrent invocations by starting sixty environments, and each one initialises its own module scope. `max: 10` does not mean ten connections. It means ten **per environment**, and you do not control how many of those exist.

```text
what you wrote          what runs at 60 concurrent
                        ┌── env 1  → pool(max 10)
const pool = new Pool(  ├── env 2  → pool(max 10)
  { max: 10 }           ├── ...
)                       └── env 60 → pool(max 10)
```

So the pool did not fail to work. It worked exactly as designed, sixty separate times. That is why the number in the table above is sixty backends rather than ten, and it is the same finding from the other direction: pooling is an optimisation that assumes a process outlives the request, and the platform quietly decides how many processes there are.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "60 invocations", "sub": "no process, no pool", "icon": "box", "tone": "amber" },
    { "label": "pgbouncer", "sub": "reclaims between transactions", "icon": "queue", "tone": "blue" },
    { "label": "3 backends", "sub": "instead of 60", "icon": "database", "tone": "green" }
  ]
}
```

## The benchmark that makes pooling look pointless

Here is the part worth the most, because I wrote this test wrong first and very nearly published the wrong conclusion.

My first version had each invocation hold its connection inside `select pg_sleep(0.5)` instead of idling. It seemed equivalent: either way the connection is held for half a second. The result:

```terminal
{
  "title": "the same test, done wrong",
  "prompt": "$",
  "steps": [
    { "comment": "connect, pg_sleep, disconnect: every client busy" },
    { "cmd": "BUSY=1 DATABASE_URL=... npm run concurrency", "output": "straight to the compute    baseline   12   peak   72   added   60   wall 1.9s   failed 0\nthrough the pooler         baseline   12   peak   70   added   58   wall 1.7s   failed 0" }
  ]
}
```

**The pooler saved two connections out of sixty.** On that evidence you would conclude pooling does nothing for serverless workloads and go and write a post about it.

The benchmark is wrong, not the pooler. A pooler in transaction mode hands the server connection back **between** transactions. When every client is inside a query there is nothing to hand back, so pgbouncer needs one server connection per busy client, exactly as the database would. Holding a connection *idle* and holding it *inside a query* are completely different things to a pooler, and only one of them is what real applications do.

The general version of that mistake: **a benchmark that keeps every resource busy will show no benefit from anything that recycles idle resources.** Worth remembering the next time a pooling, caching or connection-reuse layer measures as useless.

## The option that actually removes the connection

The third row of the first table is the interesting one: **43 ms**, close to the reused pool, with no pool and no process.

**That 43 ms needs an asterisk.** All four strategies in that table ran inside one Node process, and `fetch` keeps its TLS connection open between calls. So the HTTP driver paid its handshake once and reused it for the other twenty-nine, while `new Client()` closed its connection every time and paid in full on every one. The p95 of 340 ms in that row is the first call, and it is the honest one. The table compares a cold Postgres connect against a warm HTTP one.

That is the HTTP driver, `@neondatabase/serverless`. It does not open a Postgres connection. It sends the query over HTTPS to an endpoint that holds the connections on your behalf.

```js
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);

// no connect, no end, no pool
const rows = await sql`select 1`;
```

### So measure it cold

One query per process, nothing reused, which is the fair comparison:

```terminal
{
  "title": "cold, in a fresh process each time",
  "prompt": "$",
  "steps": [
    { "comment": "10 runs each, one query per process" },
    { "cmd": "for i in $(seq 10); do node pg-cold.mjs; done", "output": "  pg direct   median 650.3 ms   min 426.1" },
    { "cmd": "for i in $(seq 10); do node http-cold.mjs; done", "output": "  http        median 385.3 ms   min 346.2" }
  ]
}
```

Roughly **334 ms of both numbers is Node starting up**, measured separately, so the work itself is about **51 ms for HTTP against about 316 ms for a Postgres connect**.

**HTTP is not free and never was.** It pays TCP and TLS like anything else. What it does not pay is the rest of the Postgres startup, and that is where the difference lives:

| | round trips before your query runs |
|---|---|
| Postgres over TLS | TCP, then an `SSLRequest` and its reply **before TLS can begin**, then the TLS handshake, then a startup message and a multi-step SCRAM challenge and response. Six or seven. |
| HTTPS | TCP, TLS 1.3, then one request that carries the auth inside it. About three. |

Postgres negotiates TLS inside its own protocol rather than using a TLS port, which costs a round trip before encryption even starts, and SCRAM authentication is a conversation rather than a header. At the 48 ms round trip measured to this region, needing twice the trips is most of the gap.

That also explains the pooler row properly. Routing through pgbouncer does not remove any of those round trips, it just terminates them somewhere else, which is why it saved 28 ms and not 280.

You give things up for it. It is one statement at a time, so interactive transactions need the WebSocket driver instead, and you are on their endpoint rather than speaking the Postgres wire protocol to your own database. But if your function does one or two queries and returns, which is most functions, it removes the entire problem this post is about rather than making it cheaper.

It is also the clearest statement of what the trade is. The long-lived process was holding your connections. Something has to, and your options are: keep a process, rent a pooler, or stop using connections.

## What to do with this

- **Measure your own connect time before choosing anything.** It is a `Date.now()` either side of `connect()`, and it is probably the largest number in your request.
- **Do not reach for the pooled connection string expecting speed.** Reach for it because you are about to run out of backends, which is the thing it genuinely prevents.
- **Count your worst-case concurrency against `max_connections`**, not your average. Serverless platforms scale concurrency without asking.
- **If your functions are one or two queries, look at the HTTP driver.** It is the only option here that removes the cost instead of relocating it.
- **Check what your benchmark keeps busy.** If everything is busy all the time you have built a test that cannot show you a pooling benefit.

## Summary

Connection pooling was invisible infrastructure for twenty years because the assumption underneath it, that a process outlives a request, was true everywhere. Serverless broke the assumption quietly, and the cost shows up as latency you did not have before and a connection count you were never close to.

The repository has both scripts. Point them at your own database and you will have your own version of these numbers in about two minutes.

```github
https://github.com/The-DevOps-Daily/neon-connection-pool-demo
```
