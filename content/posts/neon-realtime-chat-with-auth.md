---
title: 'Realtime Chat With Auth: Next.js, Neon Auth, and WebSockets'
excerpt: 'A WebSocket cannot carry an Authorization header, so how do you know who is on the other end? This build-log wires a realtime chat where every socket is authenticated with a Neon Auth JWT, verified before the connection is accepted, and fanned out across isolates with Postgres LISTEN/NOTIFY. Real code, the security gotcha that matters, and the test output that proves it.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-07-22'
publishedAt: '2026-07-22T09:00:00Z'
updatedAt: '2026-07-22T09:00:00Z'
readingTime: '9 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - neon
  - auth
  - websockets
  - realtime
  - nextjs
  - serverless
---

Realtime and auth are each straightforward on their own. Put them together and you hit a wall almost immediately: a browser cannot set an `Authorization` header on a WebSocket. The `WebSocket` constructor takes a URL and, optionally, a subprotocol, and that is it. So the moment you want a socket that only authenticated users can open, you have to answer a question that a normal HTTP request never asks: how does the server know who is on the other end of this connection, before it accepts it?

This post is a build-log for a realtime chat that answers it. It runs a [Neon Function](https://neon.com/docs/compute/functions/overview) as the WebSocket server, uses [Neon Auth](https://neon.com/docs/neon-auth/overview) for identity, and stores messages in the same Postgres. Every socket is authenticated with a Neon Auth JWT that the function verifies before it accepts the upgrade, the stored identity comes from the verified token rather than anything the client claims, and messages fan out across isolates with Postgres `LISTEN`/`NOTIFY`. If you have not seen how Neon Auth issues those tokens, the previous post, [auth for a Postgres app without a separate service](https://devops-daily.com/posts/neon-auth-without-a-separate-service), covers it. The full [repo](https://github.com/The-DevOps-Daily/neon-auth-demo) is at the end.

## TL;DR

- Browsers cannot set headers on a WebSocket, so the client passes its Neon Auth JWT as a `?token=` query parameter.
- The function exports `{ fetch, upgrade }`. The `upgrade` hook verifies the token against the Neon Auth JWKS and rejects with `401` before the socket is ever accepted.
- The identity written to each message is the `sub` from the verified token, never a name the client sends. That is the difference between "signed in as Alice" and "typed the name Alice".
- Broadcasting in-process only reaches clients on the same isolate. Postgres `LISTEN`/`NOTIFY` fans each message out to every isolate so the chat is genuinely shared.
- The client reconnects with backoff and re-mints a token on each attempt, because serverless isolates get evicted when idle.

## Prerequisites

- A [Neon](https://neon.com) project with Neon Auth enabled (`auth: true` in `neon.ts`, see [the previous post](https://devops-daily.com/posts/neon-auth-without-a-separate-service))
- Comfort with WebSockets and JWTs
- Node.js and the Neon CLI

## The shape of it

There are two backends and one browser. The Next.js app handles sign-in and serves chat history over HTTP; the Neon Function is the WebSocket server the browser talks to directly for live messages.

```diagram
{
  "type": "graph",
  "title": "two backends, one browser: HTTP history and an authenticated socket",
  "columns": [
    [ { "id": "b", "label": "Browser", "icon": "globe", "tone": "slate" } ],
    [
      { "id": "next", "label": "Next.js", "sub": "/api/messages", "icon": "box", "tone": "blue", "detail": "Handles sign-in and serves chat history over ordinary HTTP." },
      { "id": "fn", "label": "Neon Function", "sub": "WebSocket server", "icon": "shield", "tone": "accent", "detail": "The upgrade hook verifies the JWT against the Neon Auth JWKS and rejects with 401 before the socket is accepted. Stored identity is the token's sub, never a name the client sends." }
    ],
    [ { "id": "pg", "label": "Postgres", "sub": "messages + LISTEN/NOTIFY", "icon": "database", "tone": "violet" } ],
    [ { "id": "iso", "label": "Every isolate", "sub": "its own sockets", "icon": "gear", "tone": "green" } ]
  ],
  "edges": [
    ["b", "next", "history"],
    ["b", "fn", "wss ?token"],
    ["next", "pg", "read"],
    ["fn", "pg", "insert + notify"],
    ["pg", "iso", "fan-out"]
  ]
}
```

A Neon Function is a long-running Node.js handler, not a per-request lambda, which is what makes a WebSocket server possible at all. The function exports two entry points: `fetch` for ordinary HTTP, and `upgrade` for the WebSocket handshake.

```typescript
import { Hono } from 'hono';
import { WebSocketServer } from 'ws';

const app = new Hono();
app.get('/', (c) => c.text('Connect over WebSocket with ?token=<jwt>'));
const wss = new WebSocketServer({ noServer: true });

export default {
  fetch: (request: Request) => app.fetch(request),
  async upgrade(req, socket, head) {
    // ...this is where auth happens, before we accept the socket
  },
};
```

## Auth over a WebSocket

Because the browser cannot add a header, the token rides in the URL. The client mints a JWT from its Neon Auth session and opens the socket with it as a query parameter:

```typescript
const token = await getToken();           // from the Neon Auth session
const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
```

On the server, the `upgrade` hook reads that token and verifies it before doing anything else. Verification is the standard JWKS check from the previous post: fetch the auth server's public key, check the signature, check the issuer. If it fails, the connection is refused with a raw `401` and never becomes a WebSocket at all.

```typescript
import { createRemoteJWKSet, jwtVerify } from 'jose';

const jwks = createRemoteJWKSet(new URL(env.auth.jwksUrl));
const issuer = new URL(env.auth.baseUrl).origin;

async function verifyToken(token: string | null) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer });
    return { id: payload.sub as string, name: (payload.name as string) ?? 'anon' };
  } catch {
    return null;
  }
}

async upgrade(req, socket, head) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const identity = await verifyToken(url.searchParams.get('token'));
  if (!identity) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => onConnection(ws, identity));
}
```

Rejecting at the handshake matters. An unauthenticated client never gets an open socket, so there is no "connected but not yet authenticated" state to babysit, no first-message-must-be-a-token dance, and no window where an anonymous connection is holding a slot. The check is a precondition of the upgrade, not a step after it.

:::warning
Tokens in a URL are visible in server and proxy logs, so keep them short-lived. Neon Auth tokens expire quickly (about 15 minutes), and the client re-mints on every reconnect, so a leaked one is stale fast. This is the standard trade-off for WebSocket auth given that headers are off the table; the short TTL is what makes it acceptable.
:::

## The identity comes from the token, not the client

This is the part that is easy to get subtly wrong. Once the socket is open, the client sends message text. It would be tempting to also let it send a display name, or a user id, along with each message. Do not. The only trustworthy identity is the one inside the verified token. The message handler uses `identity` captured from the JWT at connection time, and takes only the message body from the wire:

```typescript
ws.on('message', async (data) => {
  const body = data.toString().slice(0, 2000).trim();
  if (!body) return;
  const [row] = await db
    .insert(messages)
    .values({ userId: identity.id, userName: identity.name, body }) // from the token
    .returning();
  await pool.query('SELECT pg_notify($1, $2)', [CHANNEL, JSON.stringify(row)]);
});
```

`userId` and `userName` come from the verified token; `body` is the only thing the client controls. That is the line between "signed in as Alice" and "sent a message with the name Alice attached". If you trusted a client-supplied id, any connected user could write a message as anyone else. Because the id is the `sub` claim, it is also the primary key of `neon_auth.user`, so every row is attributable to a real account you can join against, which is the whole point of the [previous post](https://devops-daily.com/posts/neon-auth-without-a-separate-service).

## Fan-out: why in-process broadcasting is not enough

Here is the gotcha that only shows up under load. The obvious way to broadcast is to keep the connected sockets in a `Set` and loop over them when a message arrives. That works perfectly with one server process. But a Neon Function, like most serverless runtimes, can run several isolates at once, each with its own set of connected clients. A message that arrives on isolate A and only loops over isolate A's sockets never reaches the users connected to isolate B. Your chat silently splits into rooms that cannot hear each other.

The fix is to route every message through Postgres. Each isolate holds its in-process `Set` for the final hop, but it also `LISTEN`s on a Postgres channel. When a message is inserted, the handler `NOTIFY`s that channel, and every isolate, including the one that received the message, gets the payload and broadcasts to its own sockets.

```typescript
const clients = new Set<WebSocket>();     // sockets on THIS isolate
const CHANNEL = 'chat_messages';

// A dedicated connection LISTENs; the DB is the fan-out bus.
const listener = new Client({ connectionString: env.postgres.databaseUrlUnpooled });
await listener.connect();
await listener.query(`LISTEN ${CHANNEL}`);
listener.on('notification', (msg) => {
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) ws.send(msg.payload);
  }
});
```

So the path of a message is: verify the sender at connect, insert the row on receive, `NOTIFY` the channel, every isolate hears it, each isolate sends to its own sockets. Postgres is doing double duty as the message store and the pub/sub bus, which means there is no Redis or separate broker to run. The database you already have is the fan-out layer.

## Proving it works

Claims about auth are cheap; the interesting question is whether the wall actually holds. The repo ships an end-to-end test that runs the whole flow against the deployed function: it tries to connect without a token, with a garbage token, and then with a real Neon Auth JWT, and finally checks that a message from one client reaches a second client and lands in Postgres under the verified identity.

```terminal
{
  "title": "npm test (against the deployed function)",
  "prompt": "$",
  "steps": [
    { "cmd": "CHAT_WS_URL=wss://<branch>-chat.compute.<region>.aws.neon.tech npm test", "output": "✓ no token: rejected with 401\n✓ garbage token: rejected with 401\n✓ minted a Neon Auth JWT\n✓ two authenticated clients connected\n✓ message from A reached B (user=Chat Test)\n✓ message persisted in Postgres as Chat Test\n\n6 checks passed" }
  ]
}
```

The two `401` lines are the important ones: they confirm the handshake refuses anything without a valid token. The last line confirms the row was stored under the identity from the JWT, not a name off the wire. The test signs a throwaway user up against Neon Auth and exchanges the session for a JWT exactly the way the browser does, so it exercises the real token path rather than a mock.

## Reconnecting like a serverless client should

One more reality of serverless: an idle isolate can be evicted, which closes your socket. The client treats that as normal and reconnects with exponential backoff, and, importantly, mints a fresh token on each attempt rather than reusing the one it opened with, since tokens expire.

```typescript
ws.onclose = () => {
  setConnected(false);
  if (!closed) timer = setTimeout(connect, Math.min(1000 * 2 ** retry++, 15000));
};
// connect() calls getToken() again every time, so a reconnect never
// replays an expired token.
```

That is what makes the short token TTL from earlier a non-issue in practice: the client is already re-authenticating on every reconnect, so nothing depends on a token living a long time.

## The repo

The full function, the Next.js app with Neon Auth, and the integration test are here:

```github
https://github.com/The-DevOps-Daily/neon-auth-demo
```

## Wrapping up

The hard part of realtime auth is not the cryptography, it is the handshake: a WebSocket cannot carry a header, so you pass the token in the URL and verify it before you accept the connection, refusing anything invalid with a `401` up front. From there the rules are ordinary but easy to skip under deadline: take identity from the verified token and never from the client, and remember that in-process broadcasting fragments across isolates, so route fan-out through the database with `LISTEN`/`NOTIFY`. Because Neon Auth issues the tokens and Postgres stores both the messages and the pub/sub, the whole thing is one project with nothing else to run, and the test suite proves the wall around it actually stands.
