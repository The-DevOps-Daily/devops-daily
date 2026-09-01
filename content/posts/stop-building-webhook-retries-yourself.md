---
title: 'Stop Building Webhook Retries Yourself'
excerpt: 'We pointed a webhook sender at a receiver designed to fail in every way production fails: outages, 429s, timeouts, dead endpoints, bad signatures. Then we watched the retries, the schedule, the signature checks, and the replay happen without writing any of it. Here is the whole run, with the code and the attempt logs.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-09-02'
publishedAt: '2026-09-02T09:00:00Z'
updatedAt: '2026-09-02T09:00:00Z'
readingTime: '14 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Webhooks
  - Reliability
  - Event-Driven
  - Node.js
  - DevOps
---

Teams that ship webhooks tend to write the code twice. First the happy path: an HTTP POST with a JSON body. Then, after the first customer outage, the real product: a retry table, a scheduler, exponential backoff, a place to store failed deliveries, a signature scheme, a way to replay a day of events for one customer, and a dashboard so support can answer "did you get it?" That second half is the expensive one, and it rarely appears in the original estimate.

We took the other route for this article. We built a receiver that fails on purpose in five common ways (returns 500s for a while, answers 429 with `Retry-After`, hangs past the timeout, stays dead, rejects bad signatures), pointed [Svix](https://link.svix.com/devopsdaily) at it, and recorded what happened, attempt by attempt, with timestamps from both sides. The receiver and the driver scripts are public:

```github
The-DevOps-Daily/webhook-retries-demo
```

Everything below is a real run on September 1, 2026. Where we quote a timing, it comes from the logs in that repo.

## TLDR

- A single message create fanned out to five endpoints, each modeling a failure. Svix retried the flaky one on its schedule (immediately, 5 seconds, 5 minutes) and it recovered on attempt three at 19:25:23, four minutes after the first failure, with no code on our side.
- The receiver's `Retry-After: 60` on a 429 was not honored: the retry arrived 11 seconds later, on the sender's schedule. If you rely on `Retry-After`, that is a real limitation to know.
- A hung endpoint was cut off at the 15-second timeout, recorded as `request timed out`, and retried.
- Every delivery carried Standard Webhooks headers; the receiver verified them with a 10-line handler and rejected tampered payloads with 401.
- Replay is an API call, not a project: resend one message, or recover everything that failed for one endpoint since a timestamp.

## Prerequisites

- Node.js 22 and a Svix account (the free tier covers this whole exercise)
- A public HTTPS URL for the receiver. Svix refuses plain-HTTP endpoint URLs, so on a fresh VM we used Caddy with automatic TLS on an `sslip.io` hostname (`157-230-57-75.sslip.io` resolves to that IP, and Let's Encrypt is happy to issue for it)
- `npm install` in the demo repo

## A receiver built to fail

The receiver is one file, one HTTP server, one path per failure mode. It records every request so we can compare its view with the sender's afterwards:

```javascript
switch (path) {
  case "/ok":
    record(path, msgId, 200, "accepted");
    res.writeHead(200); return res.end("ok");
  case "/flaky": {
    // Fail the first two attempts of every message, succeed on the third.
    if (n < 3) { res.writeHead(500); return res.end("temporary failure"); }
    res.writeHead(200); return res.end("ok");
  }
  case "/ratelimited": {
    // Push back with 429 + Retry-After on the first attempt only.
    if (n === 1) { res.writeHead(429, { "retry-after": "60" }); return res.end("slow down"); }
    res.writeHead(200); return res.end("ok");
  }
  case "/slow": {
    // Never answer within the sender's timeout on the first attempt.
    if (n === 1) return setTimeout(() => { res.writeHead(200); res.end("late"); }, 120_000);
    res.writeHead(200); return res.end("ok");
  }
  case "/dead":
    res.writeHead(503); return res.end("down");
}
```

`n` is the attempt count for this message id on this path, which the receiver tracks in memory so it can misbehave a fixed number of times per message. The `/ok` path also does the thing a production receiver must do with at-least-once delivery: it remembers every `svix-id` it has processed and acknowledges a redelivery without processing it again. Each case above also calls `record(...)` so the log at `/attempts` matches what the sender saw (trimmed here for length; the full file is in the repo).

We exercised the dedup path by sending a second message and then forcing a manual resend of it to `/ok`:

```terminal
{
  "title": "receiver-side dedup",
  "prompt": "$",
  "autoplay": true,
  "steps": [
    { "cmd": "node sender/replay.js resend /ok msg_3Ik0Jx7HzBt7aaXpgEe09l0InQV", "output": "resend requested for msg_3Ik0Jx7HzBt7aaXpgEe09l0InQV -> /ok" },
    { "cmd": "docker logs receiver | grep msg_3Ik0Jx | grep /ok | cut -c1-105" },
    { "output": "{\"at\":\"20:06:31.076Z\",\"path\":\"/ok\",\"status\":200,\"note\":\"accepted and processed\"}\n{\"at\":\"20:06:41.039Z\",\"path\":\"/ok\",\"status\":200,\"note\":\"duplicate svix-id, ignored\"}" }
  ]
}
```

Both deliveries got a 200, because from the sender's point of view both succeeded; only the first one did work. That is the shape of correct at-least-once consumption.

Before any of that runs, every request passes signature verification (more on that below). Bad signature, 401, no processing.

## Setting up the sender: three SDK methods

One application, one endpoint per path, then read back each endpoint's signing secret so the receiver can verify:

```javascript
await svix.application.create({ name: "Retries demo", uid: "retries-demo" });
for (const path of PATHS) {
  const uid = "ep" + path.replace("/", "-");
  await svix.endpoint.create("retries-demo", { url: PUBLIC_URL + path, uid });
  const { key } = await svix.endpoint.getSecret("retries-demo", uid);   // whsec_...
}
```

Sending is one call, with two different duplicate protections that are easy to confuse. `eventId` is a uniqueness guard: we tested it, and a second create with the same `eventId` is rejected with `msg_exists`. The `idempotencyKey` option (an `Idempotency-Key` header on the wire) is what makes the create call itself safe to retry after a network blip: we sent the same key twice and got the same message id back both times.

```javascript
const msg = await svix.message.create(
  "retries-demo",
  {
    eventType: "invoice.paid",
    eventId,                                    // unique per business event
    payload: { invoiceId: "inv_1042", amount: 4900, currency: "usd", sentAt: new Date().toISOString() },
  },
  { idempotencyKey: `send-${eventId}` },      // safe to retry the call
);
```

That single message fans out to all five endpoints. Here is what the receiver saw in the first eleven seconds:

```terminal
{
  "title": "receiver log",
  "prompt": "$",
  "autoplay": true,
  "steps": [
    { "cmd": "docker logs receiver | grep msg_3IjuoZ | cut -c1-110" },
    { "output": "{\"at\":\"19:21:14.552Z\",\"path\":\"/flaky\",\"status\":500,\"note\":\"attempt 1: simulated outage\"}\n{\"at\":\"19:21:14.555Z\",\"path\":\"/dead\",\"status\":503,\"note\":\"attempt 1: permanently down\"}\n{\"at\":\"19:21:14.567Z\",\"path\":\"/ok\",\"status\":200,\"note\":\"accepted\"}\n{\"at\":\"19:21:14.575Z\",\"path\":\"/slow\",\"status\":0,\"note\":\"attempt 1: holding the connection open (will time out)\"}\n{\"at\":\"19:21:14.578Z\",\"path\":\"/ratelimited\",\"status\":429,\"note\":\"attempt 1: 429 with Retry-After: 60\"}\n{\"at\":\"19:21:19.059Z\",\"path\":\"/flaky\",\"status\":500,\"note\":\"attempt 2: simulated outage\"}\n{\"at\":\"19:21:19.152Z\",\"path\":\"/dead\",\"status\":503,\"note\":\"attempt 2: permanently down\"}\n{\"at\":\"19:21:25.710Z\",\"path\":\"/ratelimited\",\"status\":200,\"note\":\"attempt 2: accepted after backoff\"}" }
  ]
}
```

Five endpoints hit within 26 milliseconds of each other, the two immediate failures retried about 4.5 seconds later, and the rate-limited endpoint accepted its second attempt 11 seconds after the 429. Nothing in our code scheduled any of it.

## The retry schedule, observed

Svix's documented schedule is immediate, then 5 seconds, 5 minutes, 30 minutes, 2 hours, 5 hours, 10 hours, and 10 hours more: eight attempts spread over roughly 27 hours. We let the run continue and pulled the sender's own attempt log per endpoint:

```terminal
{
  "title": "npm run report -- msg_3IjuoZxzSCwvwWsTpkqeZCF3zjD",
  "prompt": "$",
  "autoplay": true,
  "steps": [
    { "cmd": "node sender/report.js msg_3IjuoZxzSCwvwWsTpkqeZCF3zjD" },
    { "output": "/ok  (1 attempts)\n  19:21:14  http 200  success  trigger=scheduled\n\n/flaky  (3 attempts)\n  19:21:14  http 500  fail     trigger=scheduled\n  19:21:18  http 500  fail     trigger=scheduled\n  19:25:23  http 200  success  trigger=scheduled\n\n/ratelimited  (2 attempts)\n  19:21:14  http 429  fail     trigger=scheduled\n  19:21:25  http 200  success  trigger=scheduled\n\n/slow  (2 attempts)\n  19:21:14  http -    fail     trigger=scheduled  request timed out\n  19:22:49  http 200  success  trigger=scheduled\n\n/dead  (4 attempts)\n  19:21:14  http 503  fail     trigger=scheduled\n  19:21:18  http 503  fail     trigger=scheduled\n  19:26:17  http 503  fail     trigger=scheduled\n  19:56:45  http 503  fail     trigger=scheduled" }
  ]
}
```

Read the `/flaky` line: two failures, then success at the five-minute slot, and the receiver's own log agrees (`attempt 3: recovered`). This is the entire "transient outage" story, and it cost zero lines of retry code.

Two details matter more than the happy path.

**`Retry-After` was not honored.** Our receiver answered the first `/ratelimited` attempt with `429` and `Retry-After: 60`. The retry came 11 seconds later, on the sender's own schedule, not 60 seconds later. Svix documents no `Retry-After` support, and this run confirms it. What Svix offers instead is sender-side: a per-endpoint rate limit (messages per second) you configure, and as of late August 2026, receiver-side response headers `webhook-delivery: abort-message` (stop retrying this message) and `webhook-delivery: disable` (stop sending to this endpoint). Those solve "stop" and "slow down in general", not "come back in exactly N seconds". If your consumers lean on `Retry-After`, know this going in.

**Timeouts are counted as failures, at 15 seconds.** The `/slow` endpoint held the connection open. The sender gave up at its 15-second limit, logged `request timed out` with no HTTP status, and the retry landed at 19:22:49, about 95 seconds after the first attempt began. The second attempt succeeded because our receiver only misbehaves once per message. In production, a consumer that takes 20 seconds to process a webhook and then returns 200 has still failed from the sender's point of view; acknowledge fast, process later.

## Signatures: the handler you must not skip

Every delivery carries three headers: `svix-id`, `svix-timestamp`, and `svix-signature`. They are Svix-branded aliases of the [Standard Webhooks](https://www.standardwebhooks.com/) headers, so any Standard Webhooks library verifies them; the Svix SDK does too:

```javascript
import { Webhook } from "svix";

const wh = new Webhook(secret);           // whsec_... from endpoint.getSecret()
try {
  wh.verify(rawBody, {
    "svix-id": headers["svix-id"],
    "svix-timestamp": headers["svix-timestamp"],
    "svix-signature": headers["svix-signature"],
  });
} catch (err) {
  res.writeHead(401); return res.end("bad signature");
}
```

Two rules the SDK enforces that hand-rolled code usually gets wrong: verify the raw request body bytes, never a re-serialized JSON object (one reordered key and the HMAC fails), and reject timestamps outside a tolerance window so a captured request cannot be replayed later. The secret is per endpoint, which is why the setup script prints one `whsec_` per path.

We tested the negative path by posting a hand-built request with a forged `svix-signature` to `/ok`: the receiver logged `signature rejected: No matching signature found`, answered 401, and nothing downstream ran.

## Dead endpoints and what happens after retries run out

`/dead` returns 503 forever. We watched it take the first four scheduled attempts on the documented cadence: 19:21:14, 19:21:18 (5 s), 19:26:17 (5 min), and 19:56:45 (30 min); the 2-hour, 5-hour, and two 10-hour attempts were still ahead when we stopped recording. After the eighth failure the message is marked failed and Svix emits an operational webhook, `message.attempt.exhausted`, to *you*, the sender, so your own systems can react (open a ticket, email the customer). Endpoints that keep failing get disabled automatically, with an `endpoint.disabled` event: per the docs, once an endpoint has had failures spread across a 24-hour window, five further days of nothing but failures trips the switch. Both behaviors are configurable per environment.

Who carries that state is the difference between the two approaches. In the do-it-yourself version, every one of those transitions is a row you update, a job you schedule, and an alert you wire. Here it is a webhook you subscribe to.

## Replay: the feature you build third and need first

The expensive failure is rarely a single bounced webhook; it is the consumer that was misconfigured for an hour and missed thousands of them. That needs two operations, and both are one API call each:

```javascript
// resend one message to one endpoint
await svix.messageAttempt.resend(APP_UID, "msg_3IjuoZ...", "ep-dead");

// recover every failed message for this endpoint since a point in time
await svix.endpoint.recover(APP_UID, "ep-dead", { since: new Date("2026-09-01T19:00:00Z") });
```

We ran both against the dead endpoint at 19:58, right after its 30-minute attempt. Each produced a new delivery within seconds, and the attempt log tells them apart from the schedule:

```terminal
{
  "title": "replay",
  "prompt": "$",
  "autoplay": true,
  "steps": [
    { "cmd": "node sender/replay.js resend /dead msg_3IjuoZxzSCwvwWsTpkqeZCF3zjD", "output": "resend requested for msg_3IjuoZxzSCwvwWsTpkqeZCF3zjD -> /dead" },
    { "cmd": "node sender/replay.js recover /dead 2026-09-01T19:00:00Z", "output": "recover started for /dead since 2026-09-01T19:00:00Z: { task: 'endpoint.recover', status: 'running' }" },
    { "cmd": "node sender/report.js msg_3IjuoZxzSCwvwWsTpkqeZCF3zjD | grep -A7 /dead" },
    { "output": "/dead  (6 attempts)\n  19:21:14  http 503  fail  trigger=scheduled\n  19:21:18  http 503  fail  trigger=scheduled\n  19:26:17  http 503  fail  trigger=scheduled\n  19:56:45  http 503  fail  trigger=scheduled\n  19:58:40  http 503  fail  trigger=manual\n  19:58:50  http 503  fail  trigger=manual" }
  ]
}
```

Your customers get the same two operations in the embeddable App Portal (Resend on a message, and "Recover Failed Messages" from a date on an endpoint) without a support ticket, and the `trigger=manual` marker keeps the audit trail honest about who caused a delivery. In this run the endpoint was still dead, so the replays failed too, which is the correct outcome: recovery re-delivers, it does not pretend.

## What you did not have to build

Tally the run against the list from the introduction:

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "POST /msg", "sub": "your code: 1 call", "icon": "rocket", "tone": "green" },
    { "label": "Fan-out", "sub": "5 endpoints", "icon": "branch", "tone": "blue" },
    { "label": "Retry schedule", "sub": "8 attempts / 27h", "icon": "activity", "tone": "blue" },
    { "label": "Signatures", "sub": "Standard Webhooks", "icon": "lock", "tone": "violet" },
    { "label": "Replay + portal", "sub": "API + UI", "icon": "check", "tone": "green" }
  ]
}
```

- **Retry scheduler and state machine**: not built. Observed working across 500, 503, 429, and timeout.
- **Duplicate protection**: `eventId` uniqueness and `idempotencyKey` on the send call; `svix-id` dedup in the receiver, which stays your job under at-least-once delivery.
- **Signing and verification**: SDK, standard headers, tested negative path.
- **Failure escalation**: `message.attempt.exhausted` and `endpoint.disabled` operational webhooks.
- **Replay and recovery**: two API calls, also exposed to customers in the portal.
- **Attempt history for support**: `report.js` is a short loop over the attempts API; the portal shows the same to the customer.

What you still own: fast acknowledgement and `svix-id` deduplication on the receiving side, the decision of what to do when a customer's endpoint is exhausted, and, if your consumers need `Retry-After` semantics, that gap. What we wrote for this run was the deliberately broken receiver, the verification handler, and about sixty lines of driver scripts; none of it was retry logic.

## Build or buy, with the run in front of you

The DIY version is not hard to start and is hard to finish: the scheduler is small, the portal is not, and the operational edge cases (what does exhausted mean, who gets told, how does a customer self-serve a replay) are the part that keeps leaking into on-call. We covered the sender's side of this in depth in [what it actually takes to deliver a webhook in production](/posts/reliable-webhook-delivery-retries-signatures-idempotency), including a working DIY implementation, so you can compare the two approaches line by line.

If you also need the other direction, receiving other people's webhooks, the tradeoffs differ; our [Svix vs Hookdeck comparison](/comparisons/svix-vs-hookdeck) covers both directions and both vendors.

The demo repo runs in ten minutes against a free Svix account and a throwaway VM. Point it at your own receiver, break things your way, and read the attempt log. The retry code you were about to write is the part you can skip.
