---
title: 'Realtime Without a WebSocket Service'
excerpt: 'Live counters, presence, notifications: the reflex is to add a websocket service to run and pay for. But if your data already lives in Postgres, it has a pub/sub built in. Here is realtime fan-out with Postgres LISTEN/NOTIFY and SSE on a Neon Function, tested with two live subscribers.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-07-02'
publishedAt: '2026-07-02T17:00:00Z'
updatedAt: '2026-07-02T17:00:00Z'
readingTime: '9 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - neon
  - functions
  - postgres
  - realtime
  - sse
  - serverless
---

The moment a feature needs to update live, a live counter, a presence indicator, a "new message" badge, an activity feed, the reflex is to reach for a websocket service. Pusher, Ably, a Socket.IO server, a stateful Node process parked next to your stateless app. That is one more thing to deploy, scale, secure, and pay for, and it exists mostly to move small events from one place to a bunch of connected browsers.

If your data already lives in Postgres, you already have a message bus for that. Postgres ships with `LISTEN` and `NOTIFY`, a lightweight publish/subscribe system built into the database. Pair it with server-sent events from a serverless function and you can fan realtime updates out to every connected client without standing up any realtime infrastructure at all. In this post I build exactly that on a Neon Function, explain the one part that is subtle on serverless, and prove it works with two live subscribers. The [repo](https://github.com/The-DevOps-Daily/neon-realtime-demo) is at the end.

## TL;DR

- Postgres `LISTEN`/`NOTIFY` is a built-in pub/sub. `NOTIFY channel, 'payload'` delivers to every connection that has run `LISTEN channel`.
- A serverless function holds each browser's SSE connection open and keeps one Postgres `LISTEN` connection. On a write, the app calls `pg_notify`, and every isolate pushes the event to its SSE clients.
- The subtle part on serverless: the runtime runs several isolates, each with its own in-memory set of clients. `LISTEN`/`NOTIFY` is what fans an event across all of them; an in-process broadcast alone would only reach one isolate's clients.
- One real gotcha: `LISTEN` needs a session, so it must use a direct (unpooled) connection, not the transaction pooler.
- It is fan-out for small live events, not a durable queue. For guaranteed delivery or bidirectional low-latency you still want a real broker or websockets.

## Prerequisites

- A Neon project on the platform preview (Functions, `us-east-2`)
- The Neon CLI (`npm i -g neon`, then `neon login`)
- Familiarity with Postgres and with SSE / `EventSource` on the client

## The two pieces

**Postgres LISTEN/NOTIFY** is a pub/sub channel inside the database. A connection subscribes with `LISTEN counter_updates`, and any connection (from anywhere) that runs `NOTIFY counter_updates, '42'` causes Postgres to deliver that payload to every subscriber. No extra service, no broker to run; it is a feature of the database you already have.

**Server-sent events (SSE)** are the other half. SSE is a long-lived HTTP response that streams `data:` frames to the browser, consumed with the built-in `EventSource` API. It is one-directional (server to client), which is exactly the shape of most realtime UI: the server has news, the browser wants it. And because it is just an HTTP response, a serverless function can serve it.

Put them together: the function streams SSE to browsers and relays anything it hears on a Postgres channel.

## The part that is subtle on serverless

Here is the trap. A function under load does not run as one process; the runtime spins up several isolates in parallel. Each isolate has its own memory, so each keeps its own set of open SSE connections. If you only broadcast in-process, a client connected to isolate A never sees an event triggered through isolate B.

`LISTEN`/`NOTIFY` is what closes that gap. Every isolate opens its own `LISTEN` connection to Postgres. When any code anywhere calls `NOTIFY`, Postgres delivers it to all of those connections, so every isolate gets the event and pushes it to its own clients. Postgres is the shared fan-out point that the isolates do not otherwise have.

```diagram
{
  "type": "graph",
  "title": "Postgres fans one NOTIFY out to every isolate",
  "columns": [
    [ { "id": "write", "label": "A write", "sub": "calls pg_notify", "icon": "box", "tone": "amber" } ],
    [ { "id": "pg", "label": "Postgres", "sub": "LISTEN / NOTIFY", "icon": "database", "tone": "violet" } ],
    [
      { "id": "iso1", "label": "Isolate A", "sub": "its SSE clients", "icon": "gear", "tone": "blue" },
      { "id": "iso2", "label": "Isolate B", "sub": "its SSE clients", "icon": "gear", "tone": "blue" }
    ],
    [
      { "id": "b1", "label": "Browsers", "sub": "EventSource", "icon": "globe", "tone": "green" },
      { "id": "b2", "label": "Browsers", "sub": "EventSource", "icon": "globe", "tone": "green" }
    ]
  ],
  "edges": [["write", "pg", "pg_notify"], ["pg", "iso1", "LISTEN"], ["pg", "iso2", "LISTEN"], ["iso1", "b1", "SSE"], ["iso2", "b2", "SSE"]]
}
```

```typescript
// One dedicated LISTEN connection per isolate. LISTEN needs a real session,
// so use the DIRECT (unpooled) URL, not the transaction pooler.
const listener = new Client({ connectionString: env.postgres.databaseUrlUnpooled });
await listener.connect();
await listener.query('LISTEN counter_updates');

// SSE connections held open by THIS isolate.
const clients = new Set<ReadableStreamDefaultController<Uint8Array>>();

listener.on('notification', (msg) => {
  const frame = new TextEncoder().encode(`data: ${msg.payload}\n\n`);
  for (const c of clients) c.enqueue(frame); // push to this isolate's browsers
});
```

The write path is a normal query plus a `NOTIFY`:

```typescript
app.post('/increment', async (c) => {
  const [row] = await db
    .insert(counters)
    .values({ id: 1, value: 1 })
    .onConflictDoUpdate({ target: counters.id, set: { value: sql`${counters.value} + 1` } })
    .returning({ value: counters.value });
  // Fan the new value out to every isolate, and thus every browser.
  await pool.query('SELECT pg_notify($1, $2)', ['counter_updates', String(row.value)]);
  return c.json({ value: row.value });
});
```

And the SSE endpoint just registers the browser and streams:

```typescript
app.get('/events', async (c) => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      clients.add(controller);
      // send the current value immediately so a new tab is correct on load
      readCount().then((v) => controller.enqueue(encode(`data: ${v}\n\n`)));
    },
    cancel() {
      /* remove this controller from clients */
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
});
```

:::warning
`LISTEN` holds a session-level subscription, which the transaction pooler (PgBouncer in transaction mode) does not support. Use the direct, unpooled connection string for the listener (Neon injects it as `DATABASE_URL_UNPOOLED`). Keep using the pooled URL for your normal queries. Getting this wrong is the usual reason "notifications never arrive."
:::

## Proving it works

I deployed the counter as a Neon Function and connected two independent SSE subscribers, then fired three increments. Every subscriber should see its starting value on connect and then each new value as it happens. Here is the actual run:

```terminal
{
  "title": "two subscribers, one NOTIFY each",
  "prompt": "$",
  "steps": [
    { "comment": "two browsers (A and B) open EventSource on /events; both get the current value" },
    { "cmd": "node realtime-test.mjs $URL", "output": "start count: 0\n[A] <- 0\n[B] <- 0" },
    { "comment": "POST /increment writes the row and calls pg_notify once" },
    { "cmd": "curl -X POST $URL/increment", "output": "{ \"value\": 1 }" },
    { "comment": "both subscribers receive it live, from the single NOTIFY" },
    { "cmd": "", "output": "[A] <- 1\n[B] <- 1" },
    { "cmd": "curl -X POST $URL/increment  # x2 more", "output": "[A] <- 2\n[B] <- 2\n[A] <- 3\n[B] <- 3" },
    { "comment": "final tally from the two independent streams" },
    { "cmd": "", "output": "A received: 0, 1, 2, 3\nB received: 0, 1, 2, 3" }
  ]
}
```

Both streams saw every value. Neither subscriber talked to the other, and there is no websocket server anywhere in this picture; the events traveled browser → function → Postgres `NOTIFY` → every function isolate → every browser.

## WebSocket service vs LISTEN/NOTIFY + SSE

| | Dedicated websocket service | LISTEN/NOTIFY + SSE on a function |
| --- | --- | --- |
| Extra infrastructure | A service to run, scale, secure | None; uses Postgres + the function |
| Direction | Bidirectional | Server to client (SSE) |
| Fan-out bus | The service | Postgres `NOTIFY` |
| Delivery | Often buffered / retried | Best-effort; dropped if no listener |
| Best for | Chat, cursors, games, huge fan-out | Live counters, feeds, notifications, presence |

## Where this stops being enough

This pattern is a genuine "delete a service" win for a large class of realtime features, but be honest about its edges:

- **It is not a durable queue.** `NOTIFY` is fire-and-forget. If nobody is listening at that instant, the message is gone. That is fine for a live UI that re-reads state on reconnect; it is not fine for guaranteed delivery or work queues.
- **Payloads are small.** Postgres caps a `NOTIFY` payload at 8000 bytes. Send an id or a small value and let clients fetch details, rather than shipping large blobs through the channel.
- **SSE is one-way.** For low-latency bidirectional traffic (multiplayer, live cursors, collaborative editing) a websocket is still the right tool.
- **At very high scale** a dedicated broker earns its keep. This shines at the small-to-medium fan-out that most apps actually need, without the standing infrastructure.

## The repo

The full counter, backend function plus a small web client, is here:

```github
https://github.com/The-DevOps-Daily/neon-realtime-demo
```

## Wrapping up

Realtime does not always mean a websocket service. For the common cases, a live number, a badge, a feed, an activity stream, Postgres `LISTEN`/`NOTIFY` is a pub/sub you already run, and SSE from a serverless function is enough to get those events to the browser. On Neon the function lives on the branch next to Postgres, so the listener connection is a local hop and the whole realtime path is one deploy, no separate service to operate. Reach for a real broker or websockets when you need durability or two-way low latency; reach for this when you just want the UI to update and would rather not run another box to make it happen.
