---
title: 'Serverless Killed Your Connection Pool'
excerpt: 'A connection pool only works because a process outlives the request. Take the process away and it has nothing to amortise across. Measured against a real Postgres: what a connection costs cold and warm, why the pooler barely touches latency, and the benchmark that makes pooling look pointless.'
category:
  name: 'Cloud'
  slug: 'cloud'
date: '2026-09-15'
publishedAt: '2026-09-15T14:00:00Z'
updatedAt: '2026-09-16T09:00:00Z'
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

- **Cold, nothing escapes the handshake.** One query in a fresh process measured **421 ms** straight to the database, **427 ms** through the pooler and **338 ms** over the HTTP driver. Same order of magnitude for all three.
- **Warm, the only question is whether the connection survives.** **35 ms** through a reused pool against **308 ms** if you rebuild the connection for every query. That gap is the entire subject of this post.
- **The pooled connection string does not make connecting faster.** It was within noise of the direct one in both conditions, because you still pay TCP, TLS and authentication to reach the pooler.
- **What the pooler fixes is the count.** Sixty concurrent invocations cost **60 Postgres backends** direct and **2** through the pooler.
- **A module-scope pool is per execution environment, not per application.** `max: 10` means ten connections in each of however many environments your platform decides to run.
- **The HTTP driver's win is not latency, it is backends.** The same sixty invocations added **zero** Postgres connections.
- There is a benchmark that makes pooling look useless, and it is easy to write by accident. It is in here.

## Prerequisites

- A Postgres you can connect to. The numbers below are Neon because the pooler and the HTTP driver are both first-party there, but the shape applies to any managed Postgres with a pooler in front of it.
- Node 18 or newer, `pg`, and `@neondatabase/serverless` if you want the fourth row.

## What one connection actually costs

Four ways to run `select 1`, and one question that decides all of them: does a usable connection already exist when the request arrives?

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

Two conditions, measured separately, because mixing them is how you get a wrong answer. I know, because the first version of this post did.

### Cold: nothing is reused by anybody

One query per process, a fresh process every time. That is the honest model of a function that starts, does its work and exits. The timer starts inside the child process, so Node's own startup is not in the number:

```terminal
{
  "title": "cold, a fresh process per query",
  "prompt": "$",
  "steps": [
    { "comment": "25 fresh processes per strategy, real Postgres 18" },
    { "cmd": "DATABASE_URL=... npm run bench:cold", "output": "cold: one query per process, nothing reused, n=25\n\nstraight to the compute    median   420.9 ms   p95   432.3 ms   min   402.5 ms\nthrough the pooler         median   427.1 ms   p95   460.9 ms   min   399.2 ms\nHTTP driver                median   338.4 ms   p95   347.7 ms   min   321.5 ms" }
  ]
}
```

**From a genuinely cold start, nothing escapes the handshake.** All three are a few hundred milliseconds. The HTTP driver is about 80 ms cheaper because it needs fewer round trips, which is worth explaining and is further down, but it is not a different category. If your function really does start from nothing on every request, a few hundred milliseconds is your floor and no client library moves it much.

These were measured from a machine in Bulgaria against a database in `eu-central-1`, so distance is in every row. Yours will differ. The comparison is the point, and every row pays the same network.

### Warm: the process survives

Same queries, one process, thirty calls each. Two rows keep their connection between calls. The other two throw it away and rebuild it every time, deliberately, to price that decision:

```terminal
{
  "title": "warm, one process, thirty calls",
  "prompt": "$",
  "steps": [
    { "comment": "30 calls each, same process throughout" },
    { "cmd": "DATABASE_URL=... npm run bench", "output": "warm process, n=30 calls each, query: select 1\n\nnew connection every query         median   308.5 ms   p95   743.8 ms   min   287.1 ms\nnew connection via pooler          median   304.5 ms   p95   528.0 ms   min   284.5 ms\nHTTP driver, reused                median    39.8 ms   p95   276.1 ms   min    35.4 ms\npool, reused                       median    35.4 ms   p95    38.8 ms   min    31.5 ms" }
  ]
}
```

**There is the eight-fold gap, and it has nothing to do with which client you picked.** Rows three and four keep a connection alive. Rows one and two do not. Identical query, identical network, 35 ms against 308 ms.

A raw TCP handshake to this host measured **47 to 53 ms**, which makes the reused pool the interesting row: at 35 ms it is *faster than a TCP handshake*, because it never performs one.

Notice that the HTTP driver and the pool land in the same place, 39.8 against 35.4 ms. The HTTP driver is not doing anything magic there. `fetch` keeps its TLS connection open between calls in the same process, which is the same trick a pool does, one layer up. **Reuse is the mechanism in both rows.** The difference between them shows up somewhere else entirely, and that is the last section.

## The pooled connection string is not the fix

Look at the pooler rows in both tables. Cold, 427 ms against 421 ms. Warm and rebuilding, 304 ms against 308 ms. In both conditions it is within the noise.

Managed Postgres providers offer a pooled endpoint, usually pgbouncer, usually the same hostname with `-pooler` in it. The advice to use it on serverless is everywhere, and the natural reading is that it makes connecting cheap.

It does not, and that is a category error on our part rather than a disappointment. The pooler is a separate process you connect to over the network. You still open a TCP connection to it, still negotiate TLS, still authenticate. Everything expensive about connecting is still there, just terminating somewhere else.

**The pooler was never a latency product.** It is a concurrency product, and the next experiment is the one that shows it.

## What the pooler is actually for

Sixty invocations at once. Each connects, runs a fast query, then stays connected and idle for half a second before disconnecting, which is what an ordinary request does while it renders a response or waits on something else.

A separate connection polls `pg_stat_activity` throughout and records the peak. The baseline is read in the same run, because pgbouncer grows and shrinks its own warm pool and only the difference means anything:

```terminal
{
  "title": "sixty at once",
  "prompt": "$",
  "steps": [
    { "comment": "connect, select 1, idle 500 ms, disconnect" },
    { "cmd": "DATABASE_URL=... npm run concurrency", "output": "60 at once. \"added\" is what the invocations cost on top of what was already open.\n\nstraight to the compute    baseline   29   peak   89   added   60   wall 1.8s   failed 0\nthrough the pooler         baseline   29   peak   31   added    2   wall 1.6s   failed 0\nthe HTTP driver            baseline   31   peak   31   added    0   wall 1.7s   failed 0" }
  ]
}
```

**Sixty invocations, sixty backends.** Each one is a real Postgres process, forked, authenticated, given its memory, and torn down again. Through the pooler the same sixty cost two. Over the HTTP driver they cost none at all.

That is the ceiling nobody notices until they hit it. `max_connections` on this instance is 450. A long-lived service with a pool of ten never goes near it. A serverless function at sixty concurrent invocations is already using an eighth of the database's entire capacity, and concurrency is the one thing serverless platforms are happy to give you for free.

### The pool you kept is not one pool

Worth being exact here, because it is the part that surprises people who did everything right.

Putting the pool at module scope, outside the handler, is the **correct** thing to do. It is what every serverless provider's documentation tells you, and it is what lets the pool survive between invocations on a warm instance. Move it inside the handler and you are back to the 308 ms row.

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

Back to the last row of the concurrency table, because it is the one that earns its place: **sixty invocations, zero Postgres backends.**

That is the HTTP driver, `@neondatabase/serverless`. It does not open a Postgres connection at all. It sends the query over HTTPS to an endpoint that holds the connections on your behalf.

```js
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);

// no connect, no end, no pool
const rows = await sql`select 1`;
```

**It is worth being precise about what this buys you, because it is easy to oversell.** On latency it is a modest win: about 80 ms cold, and a tie with a reused pool once warm. If you arrived hoping for an order of magnitude, the tables above say no.

What it changes is the resource. A pool moves connections around. A pooler concentrates them. The HTTP driver means your function never holds one, so the number of Postgres backends stops being a function of how many invocations your platform decided to run. That is the constraint that actually breaks serverless applications, and it is the only option here that removes it rather than managing it.

### Where the 80 ms comes from

The cold gap is real and has a specific cause, which is round trips:

| | round trips before your query runs |
|---|---|
| Postgres over TLS | TCP, then an `SSLRequest` and its reply **before TLS can begin**, then the TLS handshake, then a startup message and a multi-step SCRAM challenge and response. Six or seven. |
| HTTPS | TCP, TLS 1.3, then one request that carries the auth inside it. About three. |

Postgres negotiates TLS inside its own protocol rather than using a dedicated TLS port, which costs a round trip before encryption even starts, and SCRAM authentication is a conversation rather than a header.

This also explains the pooler rows properly. Routing through pgbouncer removes none of those round trips, it only terminates them somewhere else, which is why it saved nothing measurable rather than saving hundreds of milliseconds.

**HTTP is not free and never was.** It pays TCP and TLS like anything else. It just needs about half the trips to get to the point where it can run your query.

You give things up for it. It is one statement at a time, so interactive transactions need the WebSocket driver instead, and you are talking to their endpoint rather than speaking the Postgres wire protocol to your own database. But if your function does one or two queries and returns, which is most functions, it takes the connection out of your process entirely.

It is also the clearest statement of what the trade is. The long-lived process was holding your connections. Something has to, and your options are: keep a process, rent a pooler, or stop using connections.

## What to do with this

- **Measure your own connect time before choosing anything.** It is a `Date.now()` either side of `connect()`, and on a cold invocation it is probably the largest number in your request.
- **Do not reach for the pooled connection string expecting speed.** Reach for it because you are about to run out of backends, which is the thing it genuinely prevents.
- **Count your worst-case concurrency against `max_connections`**, not your average. Serverless platforms scale concurrency without asking.
- **If your functions are one or two queries, look at the HTTP driver.** Not for the latency, which is a modest win. For the fact that your invocations stop consuming backends.
- **Check what your benchmark keeps busy, and check what it quietly reuses.** Both mistakes are in this post's own history.

## Summary

Connection pooling was invisible infrastructure for twenty years because the assumption underneath it, that a process outlives a request, was true everywhere. Serverless broke the assumption quietly, and the cost shows up as latency you did not have before and a connection count you were never close to.

The repository has both scripts. Point them at your own database and you will have your own version of these numbers in about two minutes.

```github
https://github.com/The-DevOps-Daily/neon-connection-pool-demo
```
