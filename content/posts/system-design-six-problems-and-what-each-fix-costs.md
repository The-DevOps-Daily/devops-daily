---
title: 'Six System Design Problems, and the New Problem Each Fix Creates'
excerpt: 'Caching, read replicas, sharding, queues, WebSockets, retries, circuit breakers and CQRS each solve a real problem and hand you a new one. A practical map of the six problems every growing system meets, the usual fixes, and what each fix costs you.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-09-26'
publishedAt: '2026-09-26T09:00:00Z'
updatedAt: '2026-09-26T09:00:00Z'
readingTime: '15 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - DevOps
  - System Design
  - Scalability
  - Reliability
  - Databases
  - Architecture
---

Every system starts the same way: a client talks to a server, and the server talks to a database. That shape carries most products further than people expect. Then one of six things happens. Reads get too heavy, writes get too heavy, users want updates without refreshing, some requests take minutes, a dependency starts failing, or the way you write data stops matching the way you read it.

Each of those has well-known fixes, and most system design guides stop at naming them. The part that bites in production is what they leave out: every fix moves the problem somewhere else. A cache gives you invalidation. A read replica gives you lag. A queue gives you duplicates. This post walks through the six problems, the usual fixes for each, and the new problem each fix hands you, so you can pick the cheapest one that works and know what to watch for after you ship it.

```diagram
{
  "type": "flow",
  "title": "Where every system starts",
  "nodes": [
    { "label": "Client", "sub": "browser or app", "icon": "globe", "tone": "slate" },
    { "label": "Server", "sub": "your API", "icon": "server", "tone": "blue" },
    { "label": "Database", "sub": "one primary", "icon": "database", "tone": "violet" }
  ]
}
```

## TL;DR

- **Scale reads:** add the missing index first, then a cache, then read replicas. The costs: slower writes and locked tables while an index builds, stale data from the cache, and replica lag.
- **Scale writes:** batch first, move work off the request path second, shard last. The costs: batch latency, lost writes if the async path is not durable, and hot shards and cross-shard queries.
- **Real-time data:** server-sent events when only the server pushes, WebSockets when both sides talk, long polling as the fallback. The cost: long-lived connections, reconnect storms and missed messages.
- **Long-running jobs:** a queue and a worker pool, or a workflow engine for multi-step work. The cost: at-least-once delivery, so every handler must be safe to run twice.
- **Reliability:** retries with backoff and jitter, idempotency keys, circuit breakers and health checks. The cost: retries multiply load, and badly written health checks restart healthy servers.
- **Split reads and writes (CQRS):** a separate read model for queries. The cost: when the read store is updated asynchronously it lags behind the writes, and you now own two models.

## Prerequisites

- A web service backed by a relational database. The examples use Postgres, but the ideas carry over.
- Some metrics for that service: request latency, database CPU, query times. Every decision below starts with a measurement, not a guess.

## First, which problem do you actually have?

The most expensive system design mistake is solving the wrong problem. A team adds a cache to a slow page, and the page stays slow because the time was going into a lock wait, not a read. Before you pick a fix, match the symptom:

| What you see                                                                  | Likely problem                   | Start with                 |
| ----------------------------------------------------------------------------- | -------------------------------- | -------------------------- |
| Database CPU high, dominated by `SELECT`s; the same queries run over and over | Heavy reads                      | Indexes, then caching      |
| Inserts and updates queue up; lock waits; write I/O saturated                 | Heavy writes                     | Batching, async writes     |
| Clients poll every few seconds and still see stale data                       | Real-time updates                | SSE or WebSockets          |
| Requests time out doing work users do not need to wait for                    | Long-running work                | A queue and workers        |
| One slow dependency makes everything slow                                     | Missing isolation                | Timeouts, circuit breakers |
| One schema is forced to serve both the writes and very different reads        | Mismatched read and write shapes | A read model (CQRS-lite)   |

## 1. Scale reads

Reads are usually the first thing to hurt, because most applications read far more than they write. There are three standard moves, and the order matters because they get more expensive as you go.

```diagram
{
  "type": "graph",
  "title": "The read path, fully grown",
  "columns": [
    [{ "id": "app", "label": "App server", "icon": "server", "tone": "blue" }],
    [
      { "id": "cache", "label": "Cache", "sub": "hot keys in memory", "icon": "cpu", "tone": "amber", "detail": "A hit never reaches the database. A miss reads the database and fills the cache." },
      { "id": "primary", "label": "Primary", "sub": "all writes", "icon": "database", "tone": "violet", "detail": "Reads that must see the latest write go here." }
    ],
    [
      { "id": "r1", "label": "Replica 1", "sub": "async copy", "icon": "database", "tone": "slate", "detail": "Behind the primary by the replication lag." },
      { "id": "r2", "label": "Replica 2", "sub": "async copy", "icon": "database", "tone": "slate", "detail": "Add replicas for read volume, not for write volume." }
    ]
  ],
  "edges": [["app", "cache", "get"], ["app", "primary", "miss or write"], ["primary", "r1", "WAL"], ["primary", "r2", "WAL"]]
}
```

### Indexes: the cheapest fix, with a sharp edge

An index lets the database jump to the rows it needs instead of scanning the table. If `EXPLAIN` shows a sequential scan on a large table for a selective query you run constantly, an index is the cheapest fix you will ever ship. (A scan is not always wrong: when a query needs a large part of the table, reading it all can be cheaper.)

**What it costs:**

- **Writes get more expensive.** Inserts, and most updates, must also update each index. Postgres can skip that for an update that changes no indexed column (a HOT update), but an index that no query uses is mostly overhead, unless it enforces uniqueness.
- **Building one can lock the table.** A plain `CREATE INDEX` in Postgres takes a lock that lets reads through but makes every `INSERT` and `UPDATE` wait until its transaction ends, which inside a migration can be later than the end of the build. In our [migration rehearsals](/posts/rehearse-migrations-on-a-neon-branch), a plain index build on a 4-million-row table held the application's writes for about 2.2 seconds. `CREATE INDEX CONCURRENTLY` avoided that stall. It scans the table twice and cannot run inside a transaction, but writes keep flowing while it builds.

```sql
-- Blocks writes for the whole build:
CREATE INDEX orders_created_at_idx ON orders (created_at);

-- Builds without blocking writes (not allowed inside a transaction):
CREATE INDEX CONCURRENTLY orders_created_at_idx ON orders (created_at);
```

Primary key choice matters here too. Random UUIDs scatter inserts across the whole index, while time-ordered keys keep them together; we covered that in [uuidv7 primary keys](/posts/postgres-18-uuidv7-primary-keys).

### Caching: fast, until the data changes

A cache keeps hot data in memory, so repeat reads never reach the database. The usual pattern is cache-aside: read the cache, and on a miss read the database and fill the cache.

```python
def get_product(product_id):
    key = f"product:{product_id}"
    cached = redis.get(key)
    if cached:
        return json.loads(cached)
    row = db.fetch_one("SELECT * FROM products WHERE id = %s", [product_id])
    # A TTL with jitter, so a thousand keys filled together do not expire together
    redis.set(key, json.dumps(row), ex=300 + random.randint(0, 60))
    return row
```

**What it costs:**

- **Invalidation.** When the row changes, the cache is wrong until something deletes or refreshes the key. Pick a rule and write it down: delete on write, short TTLs, or both. Stale data is a product decision, so ask how stale each screen can be.
- **Stampedes.** A popular key expires and a thousand requests miss at once and all hit the database. Jittered TTLs and letting only one request refill a key keep that under control.
- **Caching the wrong thing.** A cache returns whatever you stored for that key, so a key that is too broad serves one user's answer to another. A semantic cache makes this easy to get wrong, as we measured in [a semantic cache answers the question next door](/posts/semantic-cache-answers-the-wrong-question).

### Read replicas: more read capacity, a little behind

A read replica is a copy of the database that follows the primary's write-ahead log and serves reads. It adds read capacity without touching your queries.

**What it costs:**

- **Replication lag.** A replica is behind the primary by some milliseconds normally, and by much more under load. A user who saves a form and then reads from a replica may not see their own change. The reliable fix is to send reads that must see the latest write to the primary, or to check that the replica has replayed that write first. Sending a user's reads to the primary for a few seconds after they write only makes the problem less likely.
- **Replicas do not help writes.** Every write still goes through one primary.
- **More connections.** Each replica is another pool to size. If you run serverless functions, read [serverless killed your connection pool](/posts/serverless-killed-your-connection-pool) before you multiply your connection count.

## 2. Scale writes

Writes are harder to spread out than reads, because every copy has to agree. The three moves are batching, taking the write off the request path, and sharding, in that order of cost.

### Batching: many writes, one round trip

Ten thousand single-row inserts sent one by one are ten thousand round trips, and ten thousand commits if each runs in its own transaction. One multi-row `INSERT`, or `COPY` for bulk loads, does the same work with a fraction of the overhead.

```sql
INSERT INTO events (user_id, kind, created_at) VALUES
  (1, 'click', now()),
  (2, 'view',  now()),
  (3, 'click', now());
```

**What it costs:** a batch adds latency, because items wait for the batch to fill or for a timer. A larger transaction also holds its locks longer, and if one row fails you have to decide whether the whole batch fails. Keep batches small enough that a failed batch is cheap to retry.

### Async writes: acknowledge now, persist later

If the caller does not need the result right away, accept the request, put the work on a queue, and answer immediately. The API gets fast, and bursts are absorbed by the queue instead of the database.

**What it costs:** the acknowledgement is a promise. If the process dies between answering "accepted" and handing the work to a durable queue, the work is gone and the caller thinks it succeeded. Writing to the database and then publishing to a queue as two separate steps has the same hole: one can succeed without the other.

The standard fix is the **outbox pattern**. Write the business row and an outbox row in the same database transaction, and answer the caller only after that transaction commits. A separate dispatcher moves outbox rows to the queue, retries until the queue confirms, and only then marks the row done. Either both rows exist or neither does, so nothing you accepted can be lost. The cost moves again: the dispatcher can publish a row twice, so consumers must handle duplicates.

```diagram
{
  "type": "flow",
  "title": "The outbox: accept durably, publish separately",
  "nodes": [
    { "label": "Request", "sub": "POST /orders", "icon": "globe", "tone": "slate" },
    { "label": "One transaction", "sub": "order row + outbox row", "icon": "database", "tone": "violet" },
    { "label": "Dispatcher", "sub": "polls the outbox", "icon": "gear", "tone": "amber" },
    { "label": "Queue", "sub": "durable", "icon": "queue", "tone": "blue" },
    { "label": "Workers", "sub": "do the work", "icon": "cpu", "tone": "green" }
  ]
}
```

Reading the database's own change log is the other way to get the same guarantee without a dispatcher; we built that in [getting a row change out of Postgres without dual-writing](/posts/postgres-cdc-without-dual-writing).

### Sharding: the last resort

Sharding splits the data across several databases by a key, such as a customer id, so each database takes a share of the writes.

**What it costs:**

- **Hot keys.** If one customer produces half your traffic, their shard is the bottleneck and the others sit idle.
- **Cross-shard work.** Queries, joins and transactions that span shards get slow, or stop being possible.
- **Resharding.** Adding a shard means moving data, and the key-to-shard mapping decides how much moves. Consistent hashing keeps the move small; we measured how the number of points on the ring changes the balance in [hash ring points in nginx, HAProxy and Envoy](/posts/hash-ring-points-nginx-haproxy-envoy).

Before you shard, exhaust the cheaper options: a bigger machine, partitioned tables, archiving old data, and the batching and async moves above. [How Discord stores trillions of messages](/posts/discord-trillions-of-messages) shows what it looks like when sharding really is the answer, and how much engineering it takes.

## 3. Real-time data

Users expect to see changes without refreshing: a new message, a finished job, a price that moved. There are three ways to get data to a client as it happens, and the choice follows one question: who needs to talk?

```diagram
{
  "type": "branch",
  "title": "Pick the transport by who talks",
  "nodes": [{ "label": "Does the client send often?", "icon": "globe" }],
  "branch": [
    { "label": "Yes, both sides talk: WebSockets", "variant": "good" },
    { "label": "No, only the server pushes: SSE", "variant": "good" },
    { "label": "Neither works through your network: long polling", "variant": "bad" }
  ]
}
```

- **Server-sent events (SSE)** are a one-way stream over plain HTTP. The browser's `EventSource` reconnects on its own after a dropped connection, and if the server gave each event an `id`, it sends the last one back in a `Last-Event-ID` header. The server can then resend what the client missed, provided it kept those events. SSE suits notifications, progress updates and dashboards. On HTTP/1.1, browsers limit how many connections one site can hold open at once, so serve SSE over HTTP/2.
- **WebSockets** are a two-way, always-open connection. Use them when the client also sends often, as in chat, collaborative editing or games.
- **Long polling** holds a normal request open until there is news, then the client asks again. It works through almost any proxy, which makes it a good fallback, but every response costs a new request (one response can carry several messages).

**What it costs:** the transport is the easy part. Long-lived connections pin state to a server, so a message produced on one server must reach clients connected to another, usually through a pub/sub layer. A deploy disconnects clients too; unless you drain connections and roll servers gradually, everyone reconnects at the same moment. A client that was offline for ten seconds needs the messages it missed, which means resuming from a cursor, not just reconnecting. We went through each of these in [WebSockets are the easy part](/posts/websockets-are-the-easy-part). For another route, [realtime without a WebSocket service](/posts/neon-functions-realtime-without-websockets) streams changes over SSE from a function, and [Figma's multiplayer post](/posts/figma-multiplayer-dumber-algorithm) shows that the conflict-resolution algorithm matters as much as the pipe.

## 4. Long-running jobs

Some work does not fit in a request: generating a report, sending a campaign, processing a video. A request that runs for minutes ties up a server, hits load-balancer timeouts, and if the client disconnects it never gets the result, even though the work may carry on or stop halfway.

```diagram
{
  "type": "graph",
  "title": "Queue and worker pool",
  "columns": [
    [{ "id": "api", "label": "API", "sub": "returns 202 + job id", "icon": "server", "tone": "blue" }],
    [{ "id": "q", "label": "Queue", "sub": "buffers the work", "icon": "queue", "tone": "amber", "detail": "Absorbs bursts: the API stays fast even when workers are busy." }],
    [
      { "id": "w1", "label": "Worker", "icon": "cpu", "tone": "green" },
      { "id": "w2", "label": "Worker", "icon": "cpu", "tone": "green" },
      { "id": "w3", "label": "Worker", "icon": "cpu", "tone": "green" }
    ],
    [{ "id": "dlq", "label": "Dead-letter queue", "sub": "after N failures", "icon": "shield", "tone": "red", "detail": "A job that keeps failing lands here for a human, instead of retrying for ever." }]
  ],
  "edges": [["api", "q", "enqueue"], ["q", "w1"], ["q", "w2"], ["q", "w3"], ["w3", "dlq", "gave up"]]
}
```

- **Message queues** buffer the work. The API puts a job on the queue and returns `202 Accepted` with a job id, and the client checks the status or gets notified when it is done.
- **Worker pools** take jobs off the queue in parallel. You scale them on queue depth, not on request rate.
- **Workflow engines**, such as Temporal or AWS Step Functions, run durable multi-step jobs. They record each step, so a crash resumes at the step that failed instead of starting over. They are worth it when a job has many steps, waits for outside events, or runs for hours.

**What it costs:**

- **Duplicates.** Most queues deliver at least once: a worker that crashes mid-job, or takes longer than the queue's lease, gets its job handed to another worker. Every handler has to be safe to run twice. That is the same idempotency problem as retries in the next section.
- **Poison messages.** A job that always fails will retry for ever unless you cap attempts and move it to a dead-letter queue that someone watches.
- **Leases.** A job is hidden from other workers for a visibility timeout or lease. If a job runs longer than that, another worker picks it up and it runs twice; if the lease is very long, a crashed worker's job waits that long before anyone retries it. The usual answer is a short lease that the worker keeps renewing while it works, and handlers that still tolerate a second run.
- **Workflow engines are another system to run,** and their workflow code has rules, such as determinism and versioning of in-flight workflows, that your team has to learn.

If one event fans out into several kinds of work, such as an in-app notification, an email and a push, the same queue design applies; [in-app, email and push from one event](/posts/in-app-email-and-push-from-one-event) walks through it.

## 5. Reliability

Everything above adds network calls, and network calls fail. Reliability patterns decide what happens when they do.

### Retries with backoff and jitter

Retry transient failures, wait longer after each attempt, and add randomness so clients do not retry in lockstep:

```python
import random, time

def call_with_retries(fn, attempts=4, base=0.2, cap=5.0):
    for attempt in range(attempts):
        try:
            return fn()
        except TransientError:
            if attempt == attempts - 1:
                raise
            # "Full jitter": sleep a random time up to the exponential ceiling
            time.sleep(random.uniform(0, min(cap, base * 2 ** attempt)))
```

**What it costs:** retries multiply load, and they multiply across layers. If three services in a chain each try a call up to three times, one failing request at the bottom can turn into 3 × 3 × 3 = 27 attempts. Retry at one layer, keep a retry budget, and never retry an operation that is not safe to repeat.

### Idempotency

A retried payment must not charge twice. The client sends an idempotency key with the request, and the server stores the result under that key and returns it for any repeat. [How Stripe avoids double-charging anyone](/posts/how-stripe-avoids-double-charging-idempotency-keys) covers the design and the races, and [what it takes to deliver a webhook](/posts/reliable-webhook-delivery-retries-signatures-idempotency) covers the receiving side.

### Circuit breakers

When a dependency is failing, calling it again only adds load to a service that is already down, and makes your own callers wait for timeouts. A circuit breaker counts failures and, past a threshold, stops calling for a while:

```diagram
{
  "type": "loop",
  "title": "Circuit breaker states",
  "goal": "fail fast while a dependency is down, then test it gently",
  "loopTop": "calls fail past the threshold",
  "loopBack": "the trial call succeeds",
  "nodes": [
    { "label": "Closed", "sub": "calls go through; failures counted", "icon": "check", "tone": "green" },
    { "label": "Open", "sub": "calls fail at once; no load sent", "icon": "shield", "tone": "red" },
    { "label": "Half-open", "sub": "after a wait, one trial call", "icon": "activity", "tone": "amber" }
  ]
}
```

**What it costs:** thresholds need tuning, or the breaker trips on normal noise or never trips at all. You also need an answer for what to return while the circuit is open: cached data, a degraded response, or a clear error. A service mesh gives you related tools at the network layer: Istio, through Envoy, limits connections and pending requests and ejects hosts that keep failing (outlier detection), which is not exactly the three-state breaker above but serves the same purpose; see [Istio traffic management](/posts/istio-traffic-management-routing-retries-circuit-breaking).

### Self-healing

Health checks let the platform replace broken instances without a human. Kubernetes uses a readiness probe to decide whether an instance gets traffic, and a liveness probe to decide whether to restart it.

**What it costs:** a liveness probe that checks your dependencies is a trap. If the probe fails whenever the database is slow, a database incident restarts every healthy app server at once, and the restarts make recovery slower. Liveness should answer "is this process stuck?". Put dependency checks in readiness, which only takes the instance out of rotation.

## 6. Split reads and writes (CQRS)

Sometimes the problem is not volume but shape. The schema that keeps writes correct (normalized tables, constraints, transactions) is the wrong shape for the reads you need (a search index, a dashboard with twenty aggregates, a feed). Command Query Responsibility Segregation (CQRS) gives each side its own model: commands go to the write model and queries go to a read model built for them. The two models can share one database, but the version that pays off at scale gives the read model its own store, kept up to date by a sync process.

```diagram
{
  "type": "graph",
  "title": "CQRS: separate write and read models",
  "columns": [
    [{ "id": "client", "label": "Client", "icon": "globe", "tone": "slate" }],
    [
      { "id": "wm", "label": "Write model", "sub": "commands", "icon": "server", "tone": "blue" },
      { "id": "rm", "label": "Read model", "sub": "queries", "icon": "server", "tone": "green" }
    ],
    [
      { "id": "wdb", "label": "Write DB", "sub": "normalized, constrained", "icon": "database", "tone": "violet" },
      { "id": "rdb", "label": "Read DB", "sub": "shaped for queries", "icon": "database", "tone": "amber", "detail": "Rebuilt from the write side's changes. When the sync is asynchronous, it lags behind." }
    ]
  ],
  "edges": [["client", "wm", "commands"], ["client", "rm", "queries"], ["wm", "wdb"], ["rm", "rdb"], ["wdb", "rdb", "sync"]]
}
```

**What it costs:**

- **A separate read store lags behind.** With an asynchronous sync, a user saves something and the list page does not show it yet; under load the gap can grow. The interface has to handle that, for example by showing the saved item optimistically.
- **Two models to maintain,** plus the sync between them, and a way to rebuild the read model from scratch when its shape changes or it drifts.
- **It is often more than you need.** A read replica, a materialized view, or a search index fed by change data capture gives you most of the benefit for a fraction of the work. Reach for full CQRS when the read and write shapes really have nothing in common.

The sync is usually change data capture or domain events; the [CDC post](/posts/postgres-cdc-without-dual-writing) shows the plumbing.

## Summary

| Problem                          | First move                                                   | What the fix costs you                              |
| -------------------------------- | ------------------------------------------------------------ | --------------------------------------------------- |
| Heavy reads                      | The missing index, then a cache                              | Write overhead, index-build locks, stale cache data |
| More read volume                 | Read replicas                                                | Replication lag, read-your-own-writes               |
| Heavy writes                     | Batching, then async writes with an outbox                   | Batch latency, duplicate deliveries to handle       |
| Writes past one machine          | Sharding, as late as possible                                | Hot keys, cross-shard queries, resharding           |
| Real-time updates                | SSE, or WebSockets for two-way                               | Connection state, reconnect storms, missed messages |
| Long-running work                | A queue and a worker pool                                    | At-least-once delivery, poison messages, leases     |
| Failing dependencies             | Timeouts, retries with jitter, idempotency, circuit breakers | Retry amplification, tuning, fallbacks              |
| Mismatched read and write shapes | A read model (CQRS)                                          | Read-store lag, two models                          |

Three habits make these choices cheaper. Measure before you pick a fix, because the symptom table above is where most wasted work starts. Take the cheapest fix that solves the problem you measured, not the most impressive one. And before you ship any of them, write down the new problem it creates and how you will notice it, whether that is stale reads, replica lag, duplicate jobs or retry storms. The fix is never the end of the story; it is the start of a different one.
