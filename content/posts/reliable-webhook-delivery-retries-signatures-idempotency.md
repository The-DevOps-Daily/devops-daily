---
title: 'What It Actually Takes to Deliver a Webhook in Production'
excerpt: 'Sending a webhook is one HTTP POST. Delivering one is a retry schedule, a signature scheme, an idempotency story, and a way to answer "did you get it?" six hours later. Here is the whole problem, and a working Node implementation of both sides.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-07-30'
publishedAt: '2026-07-30T09:00:00Z'
updatedAt: '2026-07-30T09:00:00Z'
readingTime: '16 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - DevOps
  - Webhooks
  - Node.js
  - Security
  - API
  - Reliability
---

The first version of a webhook is always the same four lines:

```javascript
await fetch(customer.webhookUrl, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(event),
});
```

It works. You ship it. Then, over the following months, a series of tickets arrives that all turn out to be the same ticket.

A customer's endpoint was down for a deploy and they want the twelve events from that window. Someone asks how they can tell a request really came from you and not from anyone who read your docs and knows the payload shape. A customer's integration ran twice on one order and double-charged an end user. Someone's endpoint takes 40 seconds to respond and your worker pool is full of requests waiting on it. Someone asks, on a Tuesday, whether you sent event `evt_8813` last Friday, and you have no way to answer.

None of these are webhook problems. They are delivery problems, and they are the entire reason webhook infrastructure exists as a category.

## TL;DR

- A webhook sender is a queue with a retry policy, not an HTTP client. Budget for that up front.
- Retries need exponential backoff and a defined give-up point. Svix uses 8 attempts across roughly 27 hours.
- Sign payloads with HMAC over `id.timestamp.body`, and verify against the **raw** body. Parsed-then-restringified JSON will not match.
- Delivery is at-least-once, so receivers must deduplicate on a message ID that stays stable across retries.
- Retry your own API calls with an idempotency key so a network blip on your side does not produce two events.
- The feature customers ask for most is not retries, it is a log they can look at themselves.

## Prerequisites

- Node.js 20 or newer, for the examples
- Comfort with HTTP semantics: status codes, timeouts, request bodies
- A rough idea of HMAC (a keyed hash; same input plus same key gives the same digest)
- Optional: a free [Svix](https://www.svix.com/?ref=devops-daily) account, if you want to run the sending half against the real API

## Why a POST is not a delivery

The gap between the two is that a POST is an event and a delivery is a *state machine*. Once you accept that a customer's endpoint can be slow, down, or wrong, the send has to outlive the request that triggered it.

```diagram
{
  "type": "loop",
  "title": "One webhook delivery, as a state machine",
  "loopTop": "each attempt is a separate scheduled job, not a retry loop inside a request",
  "loopBack": "wait out the backoff, then attempt again",
  "nodes": [
    { "label": "Event created", "detail": "your app writes the event and returns to the user immediately", "tone": "blue" },
    { "label": "Queued", "detail": "durable: it survives a process restart", "tone": "violet" },
    { "label": "Attempt", "detail": "POST with a signature, a timeout, and a per-endpoint rate limit", "tone": "amber" },
    { "label": "2xx?", "detail": "success ends the chain; 5xx, 429 and timeouts schedule the next attempt", "tone": "green" }
  ]
}
```

The important word is *durable*. If your retry logic is a `for` loop with a `sleep` in the request handler, then a deploy in the middle of the backoff drops the event permanently, and you will not find out, because the process that knew about it is gone. Any real implementation writes the pending delivery down first.

This is the same shape as the problem in our [message queue simulator](/games/message-queue-simulator), and it is worth internalising the reason: a webhook is a message queue where the consumer is a stranger who is under no obligation to be up, fast, or correct.

## Failure modes, and what each one means

Not all failures are the same, and treating them the same is the most common mistake. What matters is whether retrying could plausibly help.

| What happened | Retry? | Why |
| --- | --- | --- |
| `500`, `502`, `503` | Yes | The endpoint is broken now and might not be in five minutes |
| Connection refused, DNS failure, TLS error | Yes | Same, plus this is often a deploy in progress |
| Timeout | Yes, carefully | The receiver may have processed it anyway. See below |
| `429 Too Many Requests` | Yes, and slow down | You are the problem. Back off and rate-limit this endpoint |
| `400`, `422` | No | The payload is wrong. Ten more identical attempts will be wrong too |
| `401`, `403` | No | Their auth is misconfigured. Retrying cannot fix credentials |
| `404`, `410` | No | The URL is gone. Retrying is noise, and `410` is an explicit "stop" |

The timeout row is the interesting one, and it is the reason idempotency is not optional. A timeout means you do not know the outcome. The receiver may have taken the request, written it to their database, spent 35 seconds sending a confirmation email, and then failed to answer you in time. If you retry, they get it twice. If you do not retry, you might have dropped it. There is no third option that avoids both, which is why the industry settled on "retry, and make the receiver's side safe to run twice".

:::warning
Do not retry `4xx` responses other than `429` and `408`. It is tempting to treat everything non-2xx the same, but hammering a `400` for 27 hours turns a customer's misconfiguration into your outbound traffic problem, and it buries the real failures in your logs.
:::

## Retries and backoff

Linear retries are worse than no retries when an endpoint is genuinely down. Retrying every 30 seconds for an hour produces 120 requests, all of which fail, and if you have a thousand customers behind that same broken endpoint you have built a small load generator pointed at someone else's recovering database.

Exponential backoff fixes the shape: try fast a couple of times to ride out a blip, then spread the rest out so a long outage costs you a handful of attempts rather than thousands.

Svix's [retry schedule](https://docs.svix.com/retries) is a concrete, published example, which makes it useful to reason about:

```text
attempt 1   immediately
attempt 2   +5 seconds
attempt 3   +5 minutes
attempt 4   +30 minutes
attempt 5   +2 hours
attempt 6   +5 hours
attempt 7   +10 hours
attempt 8   +10 hours
```

Eight attempts, and the last one lands about 27 hours and 35 minutes after the first. Their docs give a worked example that is a good sanity check on how to read the table: a message that fails three times before succeeding is delivered "roughly 35 minutes and 5 seconds following the first attempt", which is `5s + 5m + 30m`. The intervals are gaps between attempts, not offsets from the start.

Here is what that curve looks like against the linear alternative:

```chart
{
  "type": "line",
  "title": "Cumulative delay before each attempt",
  "unit": "min",
  "caption": "Svix's published schedule (immediately, 5s, 5m, 30m, 2h, 5h, 10h, 10h) against a naive fixed 30-second retry. The linear line stops at attempt 8 for comparison but in practice it would keep going, which is the problem.",
  "x": ["1", "2", "3", "4", "5", "6", "7", "8"],
  "series": [
    { "name": "Exponential (Svix)", "data": [0, 0.08, 5.08, 35.08, 155.08, 455.08, 1055.08, 1655.08], "color": "#2c70ff" },
    { "name": "Fixed 30s", "data": [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], "color": "#64748b" }
  ]
}
```

Two design questions matter more than the exact numbers.

**Where do you give up?** You need a terminal state, or failed deliveries accumulate forever. Svix marks the message `Failed` and then sends *you* a webhook about it, `message.attempt.exhausted`, which is a nice touch: your webhook system tells you about its own failures through the same channel your customers use.

**When do you stop trying an endpoint entirely?** An endpoint that has been dead for a week should not receive a fresh 8-attempt schedule for every event. Svix auto-disables an endpoint after repeated failures spanning 5 days (with at least 12 hours between the first and last failure in a 24-hour window) and fires an `EndpointDisabledEvent`. If you build this yourself, some version of this circuit breaker is load-bearing, because without it one abandoned customer integration generates traffic and log volume indefinitely.

## Signatures: proving the request came from you

A webhook endpoint is a public URL that accepts POSTs and does something consequential. Anyone can find it and anyone can call it. Shared-secret-in-a-header works, but leaks the secret to every intermediary and every log that captures headers, and gives you nothing to rotate against.

The standard answer is an HMAC signature. Svix implements the [Standard Webhooks](https://www.standardwebhooks.com/) spec, which is worth learning once because a growing number of providers use it.

Three headers arrive with each request:

```text
svix-id: msg_2Xg8kFmqLxKp4v9rNtQwYbCdEf
svix-timestamp: 1785350000
svix-signature: v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=
```

The signature covers the ID, the timestamp, and the body, joined with periods:

```text
signedContent = `${svix_id}.${svix_timestamp}.${body}`
```

Including the ID and timestamp in the signed content is what makes the signature resistant to replay: an attacker who captures a valid request cannot change the timestamp without invalidating it, so a receiver that rejects old timestamps has a bounded replay window.

In practice you call a library, and it is two lines:

```tabs
{
  "title": "Verify an incoming webhook",
  "tabs": [
    {
      "label": "Node (svix)",
      "lang": "typescript",
      "code": "import { Webhook } from 'svix';\n\nconst wh = new Webhook(process.env.SVIX_WEBHOOK_SECRET!);\n\n// Throws WebhookVerificationError on a bad signature,\n// a missing header, or a timestamp outside tolerance.\nconst event = wh.verify(rawBody, {\n  'svix-id': req.header('svix-id')!,\n  'svix-timestamp': req.header('svix-timestamp')!,\n  'svix-signature': req.header('svix-signature')!,\n});"
    },
    {
      "label": "Node (manual)",
      "lang": "typescript",
      "code": "import crypto from 'node:crypto';\n\nfunction verify(rawBody: string, id: string, ts: string, header: string, secret: string) {\n  // The secret is base64 AFTER the whsec_ prefix. Decode it to bytes;\n  // HMAC-ing the printable form gives a different, wrong digest.\n  const key = Buffer.from(secret.split('_')[1], 'base64');\n\n  const expected = crypto\n    .createHmac('sha256', key)\n    .update(`${id}.${ts}.${rawBody}`)\n    .digest('base64');\n\n  // The header can hold several space-delimited signatures during a secret\n  // rotation. Any one of them matching is a pass.\n  const expectedBuf = Buffer.from(expected);\n  return header.split(' ').some((part) => {\n    const [version, sig] = part.split(',');\n    if (version !== 'v1' || !sig) return false;\n    const sigBuf = Buffer.from(sig);\n    // Length check first: timingSafeEqual throws on a length mismatch.\n    return (\n      sigBuf.length === expectedBuf.length &&\n      crypto.timingSafeEqual(sigBuf, expectedBuf)\n    );\n  });\n}"
    },
    {
      "label": "Python",
      "lang": "python",
      "code": "from svix.webhooks import Webhook, WebhookVerificationError\n\nwh = Webhook(os.environ[\"SVIX_WEBHOOK_SECRET\"])\n\ntry:\n    event = wh.verify(raw_body, dict(request.headers))\nexcept WebhookVerificationError:\n    return \"\", 400"
    }
  ]
}
```

Four details in that manual version account for most of the bugs people hit:

**Use the raw body.** This is the one that costs people an afternoon. `express.json()` parses the body and throws away the bytes, and `JSON.stringify` of the parsed object is not guaranteed to reproduce them: key order, whitespace, and unicode escaping can all differ. The signature is over bytes, so you need the bytes. In Express that means `express.raw({ type: 'application/json' })` on the webhook route specifically.

**Decode the secret.** `whsec_MfKQ9r8...` is a prefix plus base64. HMAC with the decoded bytes, not the string.

**Compare in constant time.** `crypto.timingSafeEqual`, not `===`. And check lengths first, because `timingSafeEqual` throws rather than returning false when the buffers differ in length, which turns a signature mismatch into a 500.

**Handle multiple signatures.** The header can carry more than one, space-delimited, which is how secret rotation works: for a window, both the old and new secrets produce valid signatures. Accept any match.

On timestamps: the official libraries enforce the tolerance for you. The `standardwebhooks` package that the Node SDK depends on sets `WEBHOOK_TOLERANCE_IN_SECONDS = 5 * 60`, so a request whose timestamp is more than five minutes from your clock is rejected. Worth knowing if you ever debug a verification failure on a box with drifting time, because the error looks identical to a wrong secret.

:::warning
Verify before you parse, and verify before you act. A surprising number of handlers parse the JSON, look up the customer, apply the change, and then check the signature at the end. At that point the signature check is decoration.
:::

## Duplicates and idempotency

Webhook delivery is at-least-once. Every provider worth using tells you this plainly, and the reason is the timeout case from earlier: the sender cannot distinguish "you did not get it" from "you got it and did not tell me". Given that choice, delivering twice is the safer failure.

So the receiver has to be safe to run twice. There are two halves to get right, and they are easy to conflate.

**Receiver side: deduplicate on the message ID.** The `svix-id` header (`webhook-id` in the unbranded Standard Webhooks naming) identifies the *message*, and it stays the same across every retry of that message. That property is what makes it usable as a dedup key. Svix's docs suggest caching seen IDs with a 24-hour expiry, which lines up with the ~27-hour retry window.

```typescript
// Cheap version: a unique index does the work, no cache to keep warm.
// The insert fails if we have seen this message before, which is the signal.
try {
  await db.processedWebhook.create({ data: { id: svixId } });
} catch (err) {
  if (isUniqueViolation(err)) {
    // Already handled. Acknowledge so the sender stops retrying.
    return res.status(200).send('duplicate, ignored');
  }
  throw err;
}

await handleEvent(event); // now safe: exactly one of these runs
```

The subtlety is *when* you write the dedup row. Write it before the work and a crash mid-handler means the event is marked processed but is not; write it after and two concurrent deliveries both pass the check. Doing the insert and the work in one transaction is the version that holds up.

**Sender side: use an idempotency key on your API calls.** This is the mirror image and it is separate. When *your* service calls the webhook API and the connection drops, you do not know whether the event was created. Retry blindly and your customer may get the same event twice from a single business action.

Svix supports [`Idempotency-Key`](https://docs.svix.com/idempotency) on POSTs. Send the same key and you get the original response back rather than a second event. Keys are retained for up to 12 hours. In the Node SDK it is a third argument:

```typescript
import { Svix } from 'svix';

const svix = new Svix(process.env.SVIX_AUTH_TOKEN!);

await svix.message.create(
  'customer-a1b2c3',
  {
    eventType: 'invoice.paid',
    eventId: `invoice.paid.${invoice.id}`, // your own stable ID, useful for lookups
    payload: {
      type: 'invoice.paid',
      invoiceId: invoice.id,
      amountCents: invoice.amountCents,
      currency: invoice.currency,
    },
  },
  // Derive it from the business event, not randomly, so a retry of the
  // same operation reuses it. randomUUID() here would defeat the point.
  { idempotencyKey: `invoice-paid-${invoice.id}` },
);
```

That key derivation is the part worth staring at. An idempotency key generated fresh on each attempt is just a random string and buys you nothing. It has to be a deterministic function of the thing that happened.

## Ordering, and why you probably should not want it

"Can you deliver these in order?" is a reasonable-sounding request that costs more than it looks.

Svix's regular endpoints send in order on a best-effort basis: messages are queued and picked up in order, but a slow or failing delivery does not hold the line, so a message that needs three retries arrives after messages created later. For strict ordering they offer [FIFO endpoints](https://docs.svix.com/advanced-endpoints/fifo-endpoints), and the tradeoff is explicit in their own docs: a delivery failure blocks the whole endpoint until it succeeds, and per-message network latency of 40 to 50 ms caps throughput around 20 messages per second unless you batch.

That is head-of-line blocking, and it is inherent rather than an implementation weakness. Strict ordering means one stuck message stops everything behind it.

The alternative that usually costs less: make events carry enough information to be ordered by the receiver. A monotonic sequence number or the resource's `updatedAt`, and a receiver that ignores an event older than the state it already has. That handles reordering *and* duplicates with the same check, and it does not couple your throughput to your slowest endpoint.

## Rate limiting, from both directions

Two different concerns share the name.

Your customers can be overwhelmed by you. A batch job that updates 50,000 records should not turn into 50,000 POSTs at once against a customer running one small container. Svix lets you set a [rate limit](https://docs.svix.com/rate-limit) in messages per second per application or per endpoint, and throttles to hold that rate rather than dropping.

And you can be rate-limited by them, which arrives as `429`. Treat it as a retryable failure *and* as a signal: back off, and if it keeps happening, lower that endpoint's configured rate. Our [rate limit simulator](/games/rate-limit-simulator) covers the algorithms if you want to see how the different bucket strategies behave under bursts.

## Observability, which is the actual product

Here is the thing that surprises people who build this internally: the retry engine is the part you plan for, and the delivery log is the part customers actually ask for.

When a customer says "we did not get the event", you need to answer, quickly, some version of: we attempted it at 14:02:11, your endpoint returned 503 with this body, we retried at 14:07:16 and got 200. Without that, every integration question becomes an engineer reading production logs, and you will get those questions weekly forever.

What you need to be able to answer:

- Was the event created at all? (Distinguishes your bug from theirs)
- Which endpoints was it fanned out to?
- Every attempt: timestamp, response status, response body, duration
- The exact payload as sent, so signature debugging is possible
- The current state: delivered, retrying with the next attempt at a known time, or exhausted

The multiplier is letting *customers* see it themselves. Svix's angle here is [Svix Portal](https://docs.svix.com/app-portal), an embeddable UI where your customer manages their own endpoints, reads their own delivery log, and replays their own failures without opening a ticket. That is worth pricing honestly if you are considering building: it is a whole small product, and it is the difference between "we have retries" and "our customers can debug their own integration".

## A working example, both halves

Two files. The sender goes through Svix; the receiver is what you would hand a customer.

### The sender

```typescript
// sender.ts
import { Svix } from 'svix';

const svix = new Svix(process.env.SVIX_AUTH_TOKEN!);

// One Svix "application" per customer. The uid is your own customer ID,
// which means you never have to store a mapping.
export async function onboardCustomer(customerId: string, webhookUrl: string) {
  await svix.application.create({ name: `Customer ${customerId}`, uid: customerId });

  const endpoint = await svix.endpoint.create(customerId, {
    url: webhookUrl,
    description: 'Primary endpoint',
    // Subscribe to specific event types; omit for everything.
    filterTypes: ['invoice.paid', 'invoice.payment_failed'],
  });

  // Show this to the customer once. They need it to verify signatures.
  const { key } = await svix.endpoint.getSecret(customerId, endpoint.id);
  return { endpointId: endpoint.id, signingSecret: key };
}

export async function emitInvoicePaid(customerId: string, invoice: Invoice) {
  return svix.message.create(
    customerId,
    {
      eventType: 'invoice.paid',
      eventId: `invoice.paid.${invoice.id}`,
      payload: {
        type: 'invoice.paid',
        invoiceId: invoice.id,
        amountCents: invoice.amountCents,
        currency: invoice.currency,
        paidAt: invoice.paidAt.toISOString(),
      },
    },
    { idempotencyKey: `invoice-paid-${invoice.id}` },
  );
}
```

Note what is absent: no queue, no attempt table, no backoff scheduler, no dead-letter handling. That is the part being bought.

### The receiver

```typescript
// receiver.ts
import express from 'express';
import { Webhook, WebhookVerificationError } from 'svix';

const app = express();
const wh = new Webhook(process.env.SVIX_WEBHOOK_SECRET!);

// express.raw, NOT express.json. The signature is over the bytes.
app.post(
  '/webhooks/billing',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    let event: BillingEvent;
    try {
      event = wh.verify(req.body, req.headers as Record<string, string>) as BillingEvent;
    } catch (err) {
      if (err instanceof WebhookVerificationError) {
        // 400, not 401: this is a malformed request, and a 4xx tells the
        // sender not to waste 27 hours of retries on it.
        return res.status(400).send('invalid signature');
      }
      throw err;
    }

    const messageId = req.header('svix-id')!;

    try {
      // Dedup row and the work in one transaction, so a crash rolls back
      // both and the retry gets a clean shot.
      await db.$transaction(async (tx) => {
        await tx.processedWebhook.create({ data: { id: messageId } });
        await applyBillingEvent(tx, event);
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        // Seen it. 200 so the sender stops retrying.
        return res.status(200).send('duplicate');
      }
      // Anything else: 500 on purpose, so this gets retried.
      console.error({ messageId, err }, 'webhook handler failed');
      return res.status(500).send('handler failed');
    }

    res.status(200).send('ok');
  },
);
```

The status codes are doing real work here, and they are the part most handlers get wrong. A `400` on a bad signature stops the retries. A `500` on a handler error invites them. A `200` on a duplicate ends a chain that would otherwise run its full schedule. Answering "what should this endpoint return?" correctly is most of what makes a receiver well-behaved.

:::tip
Return 2xx fast and do the work in the background. Anything over a couple of seconds risks the sender's timeout, and a timeout means a retry, which means a duplicate. Verify, persist, return 200, then process from your own queue.
:::

### Testing it locally

The awkward part of webhook development is that you need a public URL. [Svix Play](https://www.svix.com/play/) gives you a throwaway one that shows you exactly what arrived, headers included, which is the fastest way to check what you are sending. For the receiving side, the Svix CLI forwards to localhost:

```terminal
{
  "title": "local webhook loop",
  "prompt": "$",
  "steps": [
    { "comment": "no account needed for this part: it just proxies to localhost" },
    { "cmd": "svix listen http://localhost:3000/webhooks/billing", "output": "Webhook Relay is now listening at:\nhttps://play.svix.com/in/c_tSdQhb4Q5PTF5m2juiWu8qFREqE/\n\nAll requests on this endpoint will be forwarded to your local URL:\nhttp://localhost:3000/webhooks/billing" },
    { "comment": "in another shell, send a real message (payload is positional JSON)" },
    { "cmd": "svix message create app_29TqmR7XkLvB8wPdYsNzGhFj '{\"eventType\":\"invoice.paid\",\"payload\":{\"type\":\"invoice.paid\",\"invoiceId\":\"inv_991\"}}'", "output": "{\n  \"id\": \"msg_2Xg8kFmqLxKp4v9rNtQwYbCdEf\",\n  \"eventType\": \"invoice.paid\",\n  \"timestamp\": \"2026-07-30T09:14:02Z\"\n}" },
    { "comment": "the receiver verifies the signature and handles it" },
    { "cmd": "", "output": "POST /webhooks/billing 200 - 14ms\nhandled invoice.paid inv_991" },
    { "comment": "now prove the dedup path: resend the SAME message, so svix-id repeats" },
    { "cmd": "svix message-attempt resend app_29TqmR7XkLvB8wPdYsNzGhFj msg_2Xg8kFmqLxKp4v9rNtQwYbCdEf ep_1a2bYcXwVuTsRqPoNmLk", "output": "POST /webhooks/billing 200 - 3ms\nduplicate" }
  ]
}
```

That last step is the one worth doing deliberately. `resend` reuses the original message ID, which is exactly what a real retry does, so it exercises the dedup path for real. Most webhook receivers have never had a duplicate delivered to them on purpose, which means that path has never run outside of a unit test.

## Where Svix changes the tradeoff

The useful thing about Svix Dispatch is not that it can send an HTTP request. It turns the operational surface around that request into one product: durable delivery, automatic retries, signing and secret rotation, per-endpoint rate limits, event filtering, searchable attempt logs, manual replay, and a customer-facing portal. Those are the pieces that tend to appear one support ticket at a time after a home-grown sender ships.

**Building is reasonable when:**

- You have one internal consumer, or a handful, and you control them. Then it is not webhooks, it is a queue with an HTTP consumer, and you already run a queue.
- Volume is low and the events are not consequential. A Slack notification that occasionally does not arrive is not an incident.
- You have a strong existing job system. If you already run Temporal, Sidekiq, or River, the retry-with-backoff-and-give-up part is a config away, and that is genuinely most of the engine.

**Dispatch starts to win when the consumers are customers.** That is the line. The moment the endpoints belong to people who can open tickets, the surface expands past the retry engine into things that are individually small and collectively a product. Teams consistently underestimate that list because they scope the engine and forget the operations around it.

A useful way to decide: write down what a customer will ask you when an event does not arrive, and then work out who answers it. If the answer is "an engineer greps production logs", you have found the real cost, and it recurs weekly for as long as the integration exists.

## Wrapping up

The delivery problems are the same everywhere, so the checklist is portable whether you build or buy:

1. **Persist before you send.** A pending delivery that only exists in a running process is a delivery you will lose on your next deploy.
2. **Back off exponentially, and define where you stop.** Both per message and per endpoint.
3. **Classify failures.** Retry `5xx`, timeouts, `429`. Do not retry `400`, `401`, `404`.
4. **Sign with HMAC over `id.timestamp.body`, verify raw bytes, compare in constant time.** Support two valid secrets so rotation is possible.
5. **Assume at-least-once in both directions.** Dedup on the message ID at the receiver; use an idempotency key derived from the business event at the sender.
6. **Prefer sequence numbers over strict ordering.** Strict FIFO buys you head-of-line blocking.
7. **Build the log before you need it,** and let customers read it.

If you would rather watch these mechanics behave than read about them, our [webhook delivery simulator](/games/webhook-delivery-simulator) runs the whole thing in the browser: pick how the endpoint responds, watch the backoff between attempts, break the signature four different ways to see which check catches it, and redeliver a message to watch the dedup path run. The signatures it shows are real HMAC, so you can verify one yourself with the code above.

If those mechanics are product infrastructure rather than your product, [Svix Dispatch](https://www.svix.com/?ref=devops-daily) packages them behind one API and gives your customers a polished place to configure endpoints, inspect attempts, and replay failures themselves. It also builds on the [Standard Webhooks](https://www.standardwebhooks.com/) signing model, so receivers get a documented verification contract instead of a proprietary signature scheme. Their [docs](https://docs.svix.com/) publish the operational details, including retry timing and ordering tradeoffs, which makes the service easier to evaluate against a home-grown implementation.

For related reading on the same underlying problem, our post on [designing automation with failure in mind](/posts/designing-automation-with-failure-in-mind) covers the general pattern, and the [message queue simulator](/games/message-queue-simulator) is a good way to build intuition for at-least-once delivery before you have to debug it in production.
