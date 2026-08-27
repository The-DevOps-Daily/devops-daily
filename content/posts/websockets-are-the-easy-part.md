---
title: 'WebSockets Are the Easy Part'
excerpt: 'Opening a WebSocket takes twenty lines. Reconnection, resume-from-cursor, presence, fan-out and backpressure are the actual product, and they are why realtime systems fail in month two instead of day one. Here is each problem, what it looks like in production, and an honest build-vs-buy section.'
category:
  name: 'Networking'
  slug: 'networking'
date: '2026-08-27'
publishedAt: '2026-08-27T09:00:00Z'
updatedAt: '2026-08-27T09:00:00Z'
readingTime: '17 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Networking
  - WebSockets
  - Streaming
  - Architecture
  - Scalability
  - Real-time
---

Every realtime feature starts the same way. Someone opens a pull request with a WebSocket endpoint, a `new WebSocket(url)` on the client, and a working demo: messages appear on one screen when you type on another. The PR gets merged, the feature ships, and for a few weeks everyone believes realtime is done.

Then a user rides an elevator. Their laptop sleeps and wakes. A deploy restarts the server and forty thousand clients reconnect in the same second. A dashboard falls behind a fast publisher and the process that hosts it eats memory until the kernel kills it. None of these are exotic events. They are Tuesday.

The uncomfortable truth is that the WebSocket itself, the upgrade handshake and the frames, is maybe five percent of a production realtime system. The other ninety-five percent is a set of problems that the protocol deliberately does not solve: reconnection, message recovery, ordering, presence, fan-out and backpressure. This article walks through each one, what breaks if you skip it, and what building it actually costs, so you can decide with open eyes whether to build or buy.

## TLDR

- A WebSocket gives you an ordered byte stream **while the connection lives**. Everything interesting happens when it dies, and it dies constantly.
- Reconnection needs **exponential backoff with jitter**, and heartbeats to detect half-open connections that TCP will happily keep "open" for minutes.
- Reconnecting is useless without **resume**: per-channel sequence numbers, a replay buffer on the server, and a defined answer for "your cursor is too old".
- **Ordering** survives a reconnect only if you build it: the new connection may land on a different node than the old one.
- **Presence** looks like a beginner feature and is the hardest thing on this list: it is distributed state with liveness, built on connections that lie about being alive.
- **Fan-out** is multiplication: 50 messages/second into a channel with 2,000 subscribers is 100,000 outbound messages per second. The cliff arrives earlier than you think.
- **Backpressure** is what stands between a slow client and an out-of-memory kill on the node that serves 10,000 healthy ones.
- Self-hosted servers (Centrifugo, Soketi) solve the protocol layer for you. Managed platforms (Ably, PubNub, Liveblocks) also take the 3 a.m. page. A plain HTTP poll every few seconds remains a legitimate answer more often than realtime vendors admit.

## Prerequisites

To get the most out of this article you should have:

- Working knowledge of HTTP and TCP basics
- Some experience with a WebSocket library on either side of the wire
- A rough idea of pub/sub messaging (Redis pub/sub level is plenty)
- No prior experience running realtime infrastructure, that is what this is for

## The five percent you get for free

A WebSocket starts life as an HTTP request with an `Upgrade` header. After the `101 Switching Protocols` response, the TCP connection stops speaking HTTP and both sides can send frames whenever they like. That is the entire pitch: a long-lived, bidirectional, ordered stream without request overhead.

What the protocol gives you ends there. Read RFC 6455 and you will find nothing about what happens to messages sent while a client was offline, nothing about identifying a returning client, nothing about how many subscribers a message should reach. HTTP has caching, retries and idempotency conventions layered on top of it by decades of practice. WebSockets hand you a raw stream and wish you luck.

This is why the demo works and the product does not. The demo never disconnects.

## Reconnection: the client you actually need

Connections drop for reasons you cannot prevent: cell handoffs, laptop lids, corporate proxies with 60-second idle timeouts, load balancer maintenance, your own deploys. A production client treats disconnection as the normal case.

The naive fix, `onclose = () => connect()`, creates a new problem. When a server restart disconnects 40,000 clients at once, all of them reconnect in the same 100 milliseconds, and the recovering server meets a synchronized stampede. The fix is old and boring: **exponential backoff with jitter**.

```javascript
class ReconnectingSocket {
  constructor(url) {
    this.url = url;
    this.attempt = 0;
    this.connect();
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.attempt = 0;
      this.startHeartbeat();
    };

    this.ws.onclose = () => {
      clearInterval(this.heartbeat);
      // Full jitter: sleep a random time up to the exponential cap.
      // Spreads a mass reconnect across the whole window instead of
      // letting every client pick the same instant.
      const cap = Math.min(30_000, 1_000 * 2 ** this.attempt);
      const delay = Math.random() * cap;
      this.attempt++;
      setTimeout(() => this.connect(), delay);
    };
  }

  startHeartbeat() {
    // Detect half-open connections: if the server misses two pings,
    // assume the connection is dead no matter what readyState says.
    this.missed = 0;
    this.heartbeat = setInterval(() => {
      if (this.missed >= 2) {
        this.ws.close(); // triggers onclose and the backoff path
        return;
      }
      this.missed++;
      this.ws.send(JSON.stringify({ type: 'ping' }));
    }, 15_000);
    // a 'pong' handler elsewhere resets this.missed to 0
  }
}
```

The heartbeat is not optional. TCP does not tell you a peer is gone; it tells you a send eventually failed. A phone that dropped off Wi-Fi leaves a **half-open connection** that both sides consider established. The server keeps it in its connection table and, worse, keeps counting it as present (more on presence below). Without application-level ping/pong, you find out a connection is dead minutes after it matters. Browsers do not expose protocol-level ping frames to JavaScript, so the heartbeat has to be your own message type.

Server-side you need the mirror image: a per-connection idle timer that closes anything that has not been heard from in, say, two heartbeat intervals.

So far this is well-trodden ground and a few hundred lines. The next part is where teams start underestimating.

## Resume: reconnecting is useless if you lost the middle

The connection dropped at 14:03:10 and came back at 14:03:26. Sixteen seconds of messages were published to the channels this client cares about. Where are they?

With a bare WebSocket server the answer is "gone". The client reconnects into the live stream and the gap is invisible: no error, just a chat with a hole in it, a dashboard that skipped a state transition, a collaborative document that silently diverged. Users do not file a bug that says "message 4182 missing". They file one that says "the app feels unreliable", months later, as they churn.

Fixing this requires three pieces working together:

1. **Sequence numbers.** Every message published to a channel gets a monotonically increasing sequence, assigned at publish time by a single authority per channel. The client remembers the last sequence it processed, its **cursor**.
2. **A replay buffer.** The server keeps the last N messages (or last T minutes) per channel, in something like a Redis Stream or an in-memory ring buffer.
3. **A resume protocol.** On reconnect the client sends its cursor; the server replays everything after it, then splices the client into the live stream without dropping or duplicating whatever was published during the replay itself. That splice is the fiddly part, and it is exactly where naive implementations double-deliver.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Disconnect", "sub": "cursor = 4181", "icon": "activity", "tone": "red" },
    { "label": "Backoff + jitter", "sub": "random delay", "icon": "gear", "tone": "slate" },
    { "label": "Reconnect", "sub": "send cursor", "icon": "net", "tone": "blue" },
    { "label": "Replay", "sub": "4182 to 4207", "icon": "queue", "tone": "violet" },
    { "label": "Live stream", "sub": "no gap, no dupes", "icon": "check", "tone": "green" }
  ]
}
```

Then comes the question that defines your storage bill: **how long do you keep the buffer?** Whatever you pick, some client will come back later than that. A laptop reopened on Monday morning cannot be caught up from a two-minute buffer, and replaying a weekend of messages would be worse than useless. So the protocol needs a second path: when the cursor is older than the buffer, the server must say so explicitly, and the client must fall back to a **full resync** from your API or database, then rejoin the stream. If you skip the explicit signal, stale clients hang forever waiting for a replay that will never come.

:::warning
Resume also quietly changes your delivery guarantee. Replay plus live-splice edge cases means the same message can occasionally arrive twice, so consumers must treat delivery as **at-least-once** and deduplicate by sequence number. If your client code assumes exactly-once, the bug will surface in production, rarely, and only under reconnect load.
:::

## Ordering: the part that breaks when you scale to two nodes

On a single server, ordering is free: one process, one channel, one write order. The moment you run two nodes behind a load balancer, a reconnecting client can land on a different node than the one it left. If each node timestamps or numbers messages independently, two clients in the same channel can observe different orders, and a client that reconnected can see message 4207 before 4206.

The fix is the same discipline databases use: **one authority assigns the order**. Route each channel's publishes through a single sequencer (a Redis `INCR` per channel is the classic minimal version) and treat the sequence as the truth everywhere: in the replay buffer, in the client cursor, in deduplication. Wall clocks do not work; two nodes disagree about time by more than a message interval, permanently.

Note what you have just built, though: every publish now takes a round trip to a coordination point, and that point needs its own availability story. This is the recurring shape of realtime infrastructure. Each fix is individually reasonable, and each one adds a moving part that can be the thing that pages you.

## Presence: the hardest easy-looking feature

"Show who is online" reads like a junior ticket. It is the most genuinely distributed problem on this list, because it is **shared mutable state with liveness semantics**, built on top of connections that lie about being alive.

Track presence naively, add on connect and remove on disconnect, and every failure mode on this page feeds straight into it:

- Half-open connections produce **ghosts**: users who show online for minutes after their train entered a tunnel, because no clean close ever arrived.
- A user with the app open in three tabs is one presence entry, not three, so you are tracking sessions per user with reference counts.
- A flaky mobile connection cycling every few seconds turns into join/leave spam for everyone else in the channel unless you debounce transitions.
- On a multi-node cluster, the member list lives across nodes, so either every node gossips its share or you centralize the map and accept the coordination cost.
- When a node dies without cleanup, its entire share of the presence map is ghosts until something expires them.

The standard shape that survives all of this: presence entries live in a shared store with a **TTL**, refreshed by the same heartbeats that detect dead connections, keyed by user with a session count, and changes are debounced for a few seconds before broadcasting. Liveness comes from expiry, not from disconnect events, because disconnect events are exactly what you cannot rely on.

Budget accordingly: teams that estimate presence at two days routinely spend two weeks, then revisit it after the first incident involving a dead node and ten thousand ghosts.

## Fan-out: the multiplication you signed up for

Everything so far concerns one client. The economics of realtime live in the multiplication: **outbound rate equals publish rate times subscribers**. It is embarrassing arithmetic, and it is the single most common way realtime systems fall over.

```chart
{
  "type": "line",
  "title": "Outbound messages/sec for one channel at 50 publishes/sec",
  "x": ["10 subs", "100 subs", "1,000 subs", "5,000 subs", "20,000 subs"],
  "series": [
    { "name": "Outbound msg/s", "data": [500, 5000, 50000, 250000, 1000000], "color": "#f59e0b" }
  ],
  "caption": "Pure arithmetic: outbound = publish rate x subscribers. A busy channel with 20k viewers turns 50 msg/s into a million sends per second, before serialization cost."
}
```

A single Node.js process delivers a broadcast by iterating its socket list and serializing per send. Somewhere between a few thousand and a few tens of thousands of connections, depending on message rate and size, one process stops being enough, and you grow a **fan-out tier**: multiple WebSocket nodes, a pub/sub backbone (Redis pub/sub is the usual first choice) carrying each message once to each node, and each node delivering to its local subscribers.

```diagram
{
  "type": "infra",
  "flow": [
    { "label": "Publisher API", "icon": "box", "tone": "blue" },
    { "label": "Pub/sub backbone", "icon": "queue", "tone": "violet" },
    { "label": "WS nodes", "icon": "server", "tone": "green" },
    { "label": "Clients", "icon": "globe", "tone": "slate" }
  ],
  "groups": [
    {
      "label": "Realtime cluster",
      "icon": "cloud",
      "tone": "slate",
      "groups": [
        {
          "label": "Coordination",
          "icon": "database",
          "tone": "violet",
          "nodes": [
            { "label": "Redis", "sub": "pub/sub + sequences + presence TTLs", "icon": "database", "tone": "violet" }
          ]
        },
        {
          "label": "Delivery",
          "icon": "server",
          "tone": "green",
          "nodes": [
            { "label": "ws-node-1", "sub": "20k conns", "icon": "server", "tone": "green" },
            { "label": "ws-node-2", "sub": "20k conns", "icon": "server", "tone": "green" },
            { "label": "ws-node-3", "sub": "draining", "icon": "server", "tone": "amber", "status": "warn" }
          ]
        }
      ]
    }
  ]
}
```

The tier brings its own homework. The load balancer needs to handle long-lived connections, and least-connections beats round-robin when connection lifetimes vary wildly. Deploys become mass-disconnect events, so nodes must **drain**: stop accepting, tell clients to reconnect gradually, and rely on the jitter you built earlier to spread the herd. Redis pub/sub itself is fire-and-forget with no replay, which is fine here precisely because your replay buffer, not the backbone, is the recovery mechanism. And autoscaling behaves differently than with HTTP: scaling up does not move existing connections, so a hot node stays hot until its clients churn, and scaling down without draining is a self-inflicted incident.

## Backpressure: the slow client that kills the fast server

Here is the failure that takes down realtime systems that survived everything above. One subscriber on a congested mobile link stops reading. TCP fills its windows, the kernel buffer fills, and your process keeps cheerfully calling `send()`. Those bytes queue in application memory. A dashboard channel publishing 50 messages a second to a client that reads zero of them grows that queue without bound, and the node eventually dies of memory exhaustion, taking its 20,000 healthy connections with it.

The `ws` library in Node exposes the queue as `bufferedAmount`. Production servers check it and enforce a policy:

```javascript
const MAX_BUFFERED = 1 * 1024 * 1024; // 1 MB per connection

function deliver(client, message) {
  if (client.ws.bufferedAmount > MAX_BUFFERED) {
    // This client is not keeping up. Never let it grow the heap.
    if (client.mode === 'state') {
      // Conflation: for "latest value wins" data (tickers, dashboards,
      // cursors) keep only the newest message per key and send it
      // when the socket drains.
      client.pending.set(message.key, message);
    } else {
      // For event streams, disconnect. The client reconnects with its
      // cursor and replays the gap through the resume path, which
      // holds history far more cheaply than a per-socket send queue.
      client.ws.close(1013, 'slow consumer');
    }
    return;
  }
  client.ws.send(message.encoded);
}
```

The two policies matter more than the threshold. **Conflation** (drop intermediate values, deliver the latest) is correct for state-shaped data where nobody needs every tick. **Disconnect-and-resume** is correct for event-shaped data where completeness matters, because you already built recovery for reconnects, so the cheapest response to an overflowing queue is to make it the resume path's problem. What is never correct is the default: buffering forever and letting one phone in a tunnel decide your node's memory profile.

Notice how the pieces interlock. Backpressure leans on resume, resume leans on sequencing, sequencing leans on a coordination point, and everything leans on reconnection behaving well under load. That interlocking is the real reason "just use WebSockets" underestimates the work: you cannot build ninety percent of it.

## What this costs, honestly

Counting only what this article covers, a from-scratch build that handles reconnects, resume, ordering, presence, fan-out and backpressure is a few months of an experienced engineer's time to first production version. That is not the expensive part. The expensive part is that realtime infrastructure is **operationally load-bearing forever**: it pages, it needs capacity planning around connection counts rather than request rates, and every incident in it is user-visible within seconds. The build-vs-buy question is really "do we want to own this pager".

**Build on a self-hosted realtime server.** [Centrifugo](https://centrifugal.dev/) is the strongest open source option here: a standalone server (Go) that ships reconnection, sequence-numbered history with recovery-on-reconnect, presence with TTLs and Redis-based fan-out, while your application stays a plain HTTP backend that publishes into it. [Soketi](https://soketi.app/) is a lighter option speaking the Pusher protocol, a good fit when you want the Pusher SDK ecosystem without the Pusher bill, though history/resume stays your problem. You still run the servers and own the pager, but the protocol-layer engineering above is done, and done by people who have seen the edge cases.

**Buy the whole problem.** [Ably](https://ably.com/) and [PubNub](https://www.pubnub.com/) sell globally distributed delivery with connection recovery, history, presence and ordering guarantees as the product, priced per message and per connection. [Liveblocks](https://liveblocks.io/) sits a level higher, selling collaboration primitives (presence, documents, comments) rather than raw channels, which is worth a look when what you are actually building is multiplayer document editing rather than generic push. The tradeoffs are the usual ones for managed infrastructure: per-message pricing that needs modeling at your fan-out numbers before you commit, and a vendor in your critical path. What you get is that every problem in this article, including the 3 a.m. ones, is contractually someone else's.

**Do not use WebSockets at all.** Genuinely underrated. If your data flows one way, server to client, **Server-Sent Events** ride plain HTTP, reconnect natively with `Last-Event-ID` (a built-in cursor, which is more resume than raw WebSockets give you), and pass through proxies that mangle upgrades. And if your realtime requirement is honestly "the dashboard should be current-ish", polling an HTTP endpoint every few seconds is cacheable, stateless, debuggable with curl, and scales with the boring infrastructure you already run. Realtime push earns its complexity at high frequency, low latency or true bidirectionality. Below that bar, the simplest system that meets the requirement wins.

## Summary

The WebSocket protocol solves transport. The product is everything above transport:

- **Reconnection** with backoff, jitter and heartbeats, because connections die constantly and half-open ones lie about it.
- **Resume** with sequence numbers, a bounded replay buffer, and an explicit too-stale path into full resync.
- **Ordering** from a single sequencing authority, because two nodes and a reconnect are enough to break it.
- **Presence** as TTL-based shared state, debounced, session-counted, immune to nodes that die without saying goodbye.
- **Fan-out** as a tier of delivery nodes over a pub/sub backbone, with draining deploys and load-balancer awareness.
- **Backpressure** with per-connection budgets and a deliberate policy, conflate or disconnect, never buffer forever.

If those six words are on your roadmap under the single line item "add WebSockets", the estimate is wrong. Build them deliberately, adopt a server that has them built, or buy the whole problem, but decide it as an infrastructure decision, not a client-side detail. The socket really is the easy part.
