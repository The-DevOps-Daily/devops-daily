---
title: 'Five Production Bugs You Can Reproduce in a Browser Tab'
excerpt: "A cache can leak a cart, one packet can pause an HTTP/2 page, and a shared DataLoader can disclose another user's data. Learn the mechanism, the production check, and a small lab reproduction for five failures worth recognizing before an incident."
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-11-13'
publishedAt: '2026-11-13T15:00:00Z'
updatedAt: '2026-11-13T15:00:00Z'
readingTime: '13 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - DevOps
  - HTTP
  - CDN
  - Email
  - APIs
  - GraphQL
  - Networking
---

Many production failures are easy to name after the fact and hard to see while you are building: a cache key contains too little or too much, a retry creates a second payment, or a request cache outlives the request. The details differ, but each failure starts with an assumption about what a protocol, intermediary, or library remembers.

The five free DevOps Daily labs linked below make those assumptions visible. This is not a tour of the labs. Each section starts with the operational symptom, explains the protocol rule, gives you a check to run against your own system, then provides a compact reproduction. You can use the post without opening a lab.

## TL;DR

| Failure                                     | First thing to inspect                                | Safe default                                            |
| ------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------- |
| A shared cache returns personal content     | `Cache-Control`, `Vary`, and the cache key            | Mark personal responses `private` or `no-store`         |
| One lost packet delays a page               | negotiated HTTP version and loss-sensitive waterfalls | Test HTTP/2 and HTTP/3 on the links your users have     |
| A legitimate message fails DMARC            | `Authentication-Results` and alignment                | Align either SPF or DKIM with visible `From`            |
| A retry creates another operation           | idempotency key, request fingerprint, saved response  | One key per intended operation, reused only for retries |
| Nested GraphQL fields make too many queries | resolver SQL and DataLoader scope                     | Batch per request, never across requests                |

## Prerequisites

- A terminal with `curl` and `dig` (from `bind9-dnsutils` or `bind-utils`).
- Read access to one of your own HTTP endpoints, one sending domain, and one API that accepts retries.
- A modern browser for the labs. They are free and run in the browser.

## A shared cache serves a cart to the wrong person

The frightening version of this bug is a user seeing somebody else's cart, profile, or account page. The quieter version is a cache hit ratio that collapses because every campaign link has a distinct tracking query string. Both are cache-key errors: the cache either treats two different representations as the same object, or one representation as too many objects.

[RFC 9111](https://www.rfc-editor.org/rfc/rfc9111) says a cache key normally includes the request method and target URI. A cache that stores a response selected by `Vary` must also use the nominated request-field values to choose a matching response. The response controls matter just as much: `private` prohibits storage in a shared cache, and `no-store` says not to store it. [RFC 5861](https://www.rfc-editor.org/rfc/rfc5861#section-3) defines `stale-while-revalidate`, which lets a cache serve a stale response while it validates in the background.

Start with a response that must be private and an asset that should be reusable:

```bash
curl -sI https://app.example.com/api/cart
curl -sI https://app.example.com/assets/app.8d42c.js
```

The cart response should show `Cache-Control: private` or `Cache-Control: no-store`. A content-addressed asset can use a long `max-age`. For a cacheable response, read `Age`, `Vary`, and `ETag`; these are standardized response fields, though any vendor cache-status header is not. Then test validation with the actual entity tag you received:

```bash
post_etag='"replace-with-the-etag-value"'
curl -sSI \
  -H "If-None-Match: ${post_etag}" \
  https://app.example.com/index.html
```

For an unchanged representation, the expected shape is `HTTP/... 304` with an `ETag`. A `304` confirms conditional validation, not that every edge has the same object. Review whether your CDN intentionally removes tracking parameters from its cache key before deciding that `/pricing?utm_source=...` and `/pricing` are equivalent.

:::tip
**[Reproduce it in the CDN Edge Cache Lab](/games/cdn-edge-cache-lab)**

1. Select `/api/cart` and press **Send traffic**. Observe the `BYPASS` results when its response is private or no-store.
2. Turn on **utm\_ links**, send traffic, and inspect the multiple cached keys.
3. Turn on **Ignore utm\_ in cache key**, then send traffic again to see later visitors get `HIT`.
4. Select `/index.html`, send traffic, choose **Wait 61 s**, and send traffic again to expose a `304` revalidation.

The lab models one origin and three CDN edges. Its latency values are illustrative estimates, and it deliberately does not apply heuristic freshness when an explicit lifetime is absent.
:::

## One lost packet pauses every active HTTP/2 stream

HTTP/2 usually removes the browser-side request queues that made HTTP/1.1 pages painful: it multiplexes streams on one connection. The tradeoff is lower in the stack. HTTP/2 runs over TCP, and TCP delivers bytes in order. If a TCP packet containing bytes for one stream is missing, later bytes for all active streams on that connection wait for recovery. On a lossy high-latency path, that can make HTTP/2 slower than several HTTP/1.1 connections carrying independent TCP flows.

[RFC 9113](https://www.rfc-editor.org/rfc/rfc9113) defines HTTP/2 streams and multiplexed framing. [RFC 9114](https://www.rfc-editor.org/rfc/rfc9114#section-1) describes HTTP/3 as HTTP semantics over QUIC and calls out avoiding TCP head-of-line blocking. QUIC streams have independent delivery and loss recovery under [RFC 9000](https://www.rfc-editor.org/rfc/rfc9000#section-2.2), so a lost packet holds up only the streams whose data it carried, while streams with data in other packets keep moving. That removes TCP's connection-wide head-of-line blocking, not every stall.

Check what your endpoint actually negotiates before drawing conclusions from an application dashboard:

```bash
curl -sI --http2 -w '%{http_version}\n' -o /dev/null https://app.example.com
curl -sI --http3-only -w '%{http_version}\n' -o /dev/null https://app.example.com
curl -sI https://app.example.com | grep -i '^alt-svc:'
curl -V
```

The first two commands print the negotiated version, such as `2` or `3`. Use `--http3-only` for the check: plain `--http3` falls back to an earlier version when QUIC cannot be set up, which hides the answer you are looking for. The `Alt-Svc` header can advertise an `h3` alternative service. The HTTP/3 command only works when the installed curl was compiled with HTTP/3 support, which `curl -V` reports. Test on representative networks as well as a clean office connection: protocol choice is a latency and loss question, not a permanent leaderboard.

```diagram
{
  "type": "branch",
  "nodes": [
    { "label": "One packet lost", "sub": "during app.js", "icon": "net", "tone": "amber" },
    { "label": "Recover loss", "sub": "retransmission needed", "icon": "activity", "tone": "blue" }
  ],
  "branch": [
    { "label": "HTTP/2 over TCP: active streams wait for in-order delivery", "variant": "bad" },
    { "label": "HTTP/3 over QUIC: streams in the lost packet wait, others progress", "variant": "good" }
  ]
}
```

:::tip
**[Reproduce it in the HTTP Versions Lab](/games/http-versions-lab)**

1. Select **HTTP/2**, set **250 ms RTT**, turn on **Lose one packet**, and press **Play all**.
2. Read the waterfall and the loss explanation: multiple receiving streams stall behind the TCP retransmission.
3. Switch to **HTTP/3**, keep **Lose one packet** on, and press **Play all**.
4. Compare the stalled stream count and the setup steps with **Next**.

This is a deterministic page-load model, not a browser trace. It excludes DNS, server work, congestion control, priorities, caches, header compression, server push, and QUIC 0-RTT resumption.
:::

## A valid-looking email fails DMARC after forwarding

An order confirmation can leave your sender with SPF, DKIM, and DMARC all passing, then fail after a forwarder or a mailing list touches it. The customer sees a rejected message or a spam-folder delivery, while the sending system sees a successful SMTP handoff. The common mistake is treating three authentication results as interchangeable.

[RFC 7208](https://www.rfc-editor.org/rfc/rfc7208) specifies SPF for the SMTP MAIL FROM identity and the connecting IP address. [RFC 6376](https://www.rfc-editor.org/rfc/rfc6376) specifies DKIM signatures over selected headers and the message body, verified using a selector key in DNS. Current DMARC is [RFC 9989](https://www.rfc-editor.org/rfc/rfc9989), which requires SPF or DKIM to pass **and** align with the visible `From` domain. A forwarder changes the connecting IP, so SPF often fails; a mailing list that changes a signed body can invalidate DKIM. Rewriting `From` is one way a list can preserve DMARC when it modifies a message.

Inspect the records and one delivered message rather than guessing from a provider UI:

```bash
dig +short TXT example.com
dig +short TXT selector._domainkey.example.com
dig +short TXT _dmarc.example.com
```

Then open the delivered message source and locate an `Authentication-Results` header. Its useful shape names the evaluated identities and results, for example `spf=pass smtp.mailfrom=...`, `dkim=pass header.d=...`, and `dmarc=pass header.from=...`. Confirm the domain in `header.from` aligns with either the SPF MAIL FROM domain or the DKIM `d=` domain. The earlier [DMARCbis guide](/posts/dmarcbis-what-changed-new-dmarc) covers the record migration in more detail: DMARCbis replaced RFC 7489 and removed its `pct` tag.

:::tip
**[Reproduce it in the Email Authentication Lab](/games/email-auth-lab)**

1. Select `d=shop.example` for **DKIM signing domain**, publish the selector, and choose a DMARC policy.
2. Send the **Direct** path, then send the **Forwarded** path (the forwarder does not use SRS) and compare the SPF, DKIM, and DMARC verdicts.
3. Select the mailing-list path, turn on **List rewrites From and sets Reply-To**, and send again.
4. Change **SPF alignment** or **DKIM alignment** from relaxed to strict and read the receiver result.

The lab checks the MAIL FROM identity, not HELO, and does not model SRS or ARC. Its percentage control deliberately demonstrates the retired RFC 7489 `pct` behavior; do not use it as a model of current DMARCbis policy.
:::

## An ambiguous retry creates a second payment

The failure looks like a double charge, duplicate order, or two provisioned resources. Often the first request did succeed, but its response was lost after the server committed work. Retrying is the correct client action after an ambiguous failure. Retrying it as a new operation is not.

[Stripe's idempotent requests documentation](https://docs.stripe.com/api/idempotent_requests) describes the pattern: the API saves the status code and body of the first request for a key and returns them for later requests with the same key, and it rejects a reuse of the key with different parameters. The IETF is standardizing the header itself in [The Idempotency-Key HTTP Header Field](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/), which is still an Internet-Draft, not an RFC. A key identifies one intended operation, not one customer or one retry attempt. Store a request fingerprint beside the key, reject a payload mismatch, and distinguish an in-progress duplicate from a completed replay.

Here is the client side. It keeps one generated key for every retry and applies full jitter to retryable failures:

```javascript
import { randomUUID } from 'node:crypto';

const idempotencyKey = randomUUID(); // One intended order, not one HTTP attempt.
const retryableStatuses = new Set([409, 429, 500, 502, 503, 504]);

async function createOrder() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await fetch('https://api.example.com/orders', {
        method: 'POST',
        // Stripe documents a bare value; the IETF draft defines a quoted string.
        // Use the serialization your API documents.
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        signal: AbortSignal.timeout(10_000), // a stalled request must reach the retry path
        body: JSON.stringify({ sku: 'pro-monthly', customerId: 'cus_123' }),
      });
      if (response.ok || !retryableStatuses.has(response.status)) return response;
      // A 409 is retryable here only because this API uses it for an in-progress key.
    } catch (error) {
      if (attempt === 4) throw error;
    }

    if (attempt === 4) throw new Error('Idempotent request did not complete after five attempts');
    const ceilingMs = Math.min(5_000, 100 * 2 ** attempt);
    await new Promise((resolve) => setTimeout(resolve, Math.random() * ceilingMs));
  }
}
```

On the server, make the uniqueness boundary visible. Scope keys to the authenticated caller, so one client's key can never replay another client's saved response, and save the fingerprint and final response before a later retry can replay it:

```sql
CREATE TABLE idempotency_responses (
  account_id uuid NOT NULL,          -- from authentication, never from the request body
  idempotency_key text NOT NULL,
  request_fingerprint text NOT NULL,
  status_code integer,
  response_body jsonb,
  completed_at timestamptz,
  PRIMARY KEY (account_id, idempotency_key)
);
```

Every lookup, insert and replay filters on both columns. The [Idempotency-Key draft](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/) calls out data leaks from shared keys for the same reason.

Use a transaction or equivalent concurrency control to insert the key, create the order, and save the response. A matching completed row returns `status_code` and `response_body`; a differing fingerprint returns a client error; a matching unfinished row should tell the client the first request is still processing. The same pattern matters for webhooks, where a delivery can be retried after your handler completes. See [how Stripe avoids double charging](/posts/how-stripe-avoids-double-charging-idempotency-keys) and [reliable webhook delivery](/posts/reliable-webhook-delivery-retries-signatures-idempotency).

:::tip
**[Reproduce it in the Idempotency and Retry Lab](/games/idempotency-retry-lab)**

1. Choose **Run duplicate checkout** and inspect the ledger after the lost response.
2. Choose **Run keyed checkout** and find the saved result in **Idempotency store** instead of another charge.
3. Press **Reuse key with new amount**, then **Send two at once**, and compare the mismatch and in-progress outcomes.
4. Run **Run no backoff** and **Run full jitter**, then use **Run down API job** to inspect the dead letter.

The outage chart is a simplified deterministic model of client arrivals, not a production measurement. Its dead-letter jobs retain a key and final error and do not retry themselves.
:::

## A shared DataLoader exposes data from the previous request

GraphQL makes N+1 look harmless. `posts { author { name } }` reads like one query, but a resolver that fetches every author separately can produce one posts query plus one author query per post. Add nested comments and comment authors, and the work grows at each resolver level.

The [DataLoader README](https://github.com/graphql/dataloader#batching) describes batching loads that occur in the same execution frame and caching values in a loader instance. The cache is intentionally not a shared application cache. The README's [per-request caching guidance](https://github.com/graphql/dataloader#caching-per-request) says to create new loader instances for each request because authorization or other request-specific context can differ.

Create loaders in the GraphQL context, not at module scope. This Apollo Server pattern puts the loader beside the authenticated request context:

```typescript
import { ApolloServer } from '@apollo/server';
import DataLoader from 'dataloader';
import { startStandaloneServer } from '@apollo/server/standalone';

const server = new ApolloServer({ typeDefs, resolvers });

await startStandaloneServer(server, {
  context: async ({ req }) => {
    const viewer = await authenticate(req.headers.authorization);
    return {
      viewer,
      // A new loader per request: its cache dies with the request.
      userById: new DataLoader(async (ids) => {
        // Authorization lives in the data access: only rows this viewer may see.
        const users = await loadUsersVisibleTo(viewer, ids);
        return ids.map((id) => users.find((user) => user.id === id) ?? null);
      }),
    };
  },
});
```

`loadUsersVisibleTo` stands in for your own query, for example `SELECT id, name FROM users WHERE id = ANY($1::uuid[])` plus the viewer's visibility rule. A per-request loader stops one request's cache from serving the next; it does not authorize reads inside a request, so the permission check has to be in the batch function.

Without the loader, resolver logs often show repeated `SELECT ... WHERE id = $1` statements. With it, same-tick loads become one `WHERE id IN (...)` query or its parameterized equivalent. Deduplication reduces repeated keys in that batch, but it does not authorize the cached result for another request. Log query count and the request ID together so a shared cache is visible before it becomes a data exposure.

:::tip
**[Reproduce it in the GraphQL N+1 and DataLoader Lab](/games/graphql-dataloader-lab)**

1. Leave **Post authors** on, keep **Use User DataLoader** off, and press **Run query**. Inspect the SQL panel.
2. Turn on **Comments** and **Comment authors**, then run again to see the nested resolver work.
3. Turn on **Use User DataLoader** and **Use Comments DataLoader** to see the batched `IN (...)` queries.
4. Set **Loader scope** to **Shared by all requests**, run as Ada, then run as Bo. Set it back to **Per request** and run Bo again.

The lab has a small deterministic data set. It models one event-loop tick per resolver level; `await` calls between loads can split real DataLoader batches.
:::

## Keep the state boundary explicit

These bugs look unrelated until you name the state boundary. A CDN decides which request fields identify a response. TCP decides which bytes must arrive before later bytes are delivered. DMARC decides which authenticated identifier may stand for `From`. An idempotency store decides whether a retry is an earlier operation. DataLoader decides how long a loaded value remains valid.

Use the checks before an incident, then use the labs to make the failure shape memorable.

| Bug                               | Mechanism                                             | One-line fix                                              | Lab                                                             |
| --------------------------------- | ----------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------- |
| Personal content at the edge      | Shared cache key or directives allow storage          | Send `private` or `no-store` for personalized responses   | [CDN Edge Cache Lab](/games/cdn-edge-cache-lab)                 |
| HTTP/2 page stalls on loss        | TCP in-order delivery blocks active streams           | Test QUIC and HTTP/3 where loss and RTT warrant it        | [HTTP Versions Lab](/games/http-versions-lab)                   |
| DMARC fails after an intermediary | SPF or DKIM no longer passes and aligns               | Preserve an aligned identity through forwarding and lists | [Email Authentication Lab](/games/email-auth-lab)               |
| Duplicate work after retry        | New key makes a retry a new operation                 | Reuse one key and replay its saved response               | [Idempotency and Retry Lab](/games/idempotency-retry-lab)       |
| GraphQL data leak or query storm  | Loader cache crosses requests, or loads are unbatched | Instantiate loaders in request context                    | [GraphQL N+1 and DataLoader Lab](/games/graphql-dataloader-lab) |
