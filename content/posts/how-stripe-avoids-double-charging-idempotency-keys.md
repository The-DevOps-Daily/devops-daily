---
title: 'How Stripe Avoids Double-Charging Anyone'
excerpt: 'A payment request times out. Did the charge happen? Stripe answers that question with idempotency keys, and the design behind them is more than a cache of responses: locked key rows, recovery points, and a rule about which calls can be retried. Here is the design, a working Postgres implementation, the run where our own version double-created rides, and the constraint that caught it.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-09-03'
publishedAt: '2026-09-03T09:00:00Z'
updatedAt: '2026-09-03T09:00:00Z'
readingTime: '18 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Reliability
  - System Design
  - PostgreSQL
  - APIs
  - Node.js
  - DevOps
---

Take Stripe's own classic example: a service sends `POST /v1/charges` and the socket dies before a response arrives. There are three possible worlds: the request never reached the payment provider, the provider charged the card and the response was lost, or the provider is still working on it. Your code cannot tell them apart, and the customer is waiting. Retry, and you might charge twice. Give up, and you might have taken money without recording an order.

Businesses running on Stripe generated $1.9 trillion in total volume in 2025, by Stripe's own count. At that scale, dropped connections are routine, and every one is a potential double charge. Idempotency keys let clients retry an ambiguous failure safely, and the pattern is small enough to copy in an afternoon. Whether the promise holds is decided by the server-side state machine: what it remembers, in what order, and around which call.

This post combines Stripe's documented API behaviour with the separate Rocket Rides reference design that Brandur Leach published on his own site. We build a smaller Node and Postgres version, test it against concurrent duplicates and a mid-request crash, and look closely at the run where our first version failed.

## TL;DR

- A client generates a unique key per operation and sends it as `Idempotency-Key`. The server stores the first result under that key and replays it for any retry with the same key and the same parameters. Stripe's API v1 keeps a key for at least 24 hours and stores the first status and body once the endpoint starts executing, including `500`s; validation failures and concurrent conflicts are not stored.
- The response cache is the easy half. The hard half is a request that dies in the middle: the server has to know how far it got and resume from there without repeating the one step it cannot undo.
- The pattern is atomic phases and recovery points: group local database writes into transactions, put a marker after each, and treat any call to another system (a card network, an email API) as a boundary that must carry its own idempotency key.
- Concurrent duplicates are handled by locking the key row, not by hoping they arrive one at a time.
- A time-based lock is a lease. A two-second lease let our demo create three rides for one charge; ten seconds avoided the race in the recorded run, but correctness also needs lease renewal or fencing and invariants the database enforces. The output of both runs is below.

## Prerequisites

- Comfort with HTTP APIs and SQL transactions
- Node.js 20 or newer to run the demo
- Any Postgres connection string; the run below used a branch on Neon so the schema could be dropped and recreated freely
- Familiarity with the phrase "at-least-once delivery" helps; the [message queue simulator](/games/message-queue-simulator) is a five-minute refresher

## The problem, stated precisely

An operation is idempotent when doing it twice leaves the system in the same state as doing it once. `GET` is idempotent by nature. `DELETE` is too: deleting an already deleted thing changes nothing. `POST /charges` is not. Send it twice and you have two charges.

Retries are unavoidable. Stripe's engineering post on the subject, written by Brandur Leach in 2017, splits failures into two kinds. Some are "definitive enough that the client knows with good certainty that it's safe to simply retry": the connection was refused, DNS failed, nothing was ever sent. The dangerous kind is the failure in the middle: the request was sent, then the client timed out waiting for the answer. Now the client's knowledge of the world is stale, and a naive retry is a coin flip between "fine" and "charged twice".

Idempotency keys turn the coin flip into a lookup. The client picks a unique identifier before the first attempt, sends it in the `Idempotency-Key` header, and reuses it on every retry of that same operation. The server's job is to make sure that no matter how many times a request with that key arrives, the work happens once and every caller gets the same answer.

The rules Stripe documents for its own API are worth reading closely, because each one encodes a lesson:

- **Keys are client-generated.** Stripe suggests a V4 UUID or another random string with enough entropy; keys can be up to 255 characters. The other common strategy is deriving the key from a business object, such as a shopping cart id, which also protects against a user double-clicking "Pay".
- **Results are cached whether or not the request succeeded.** Stripe saves the status code and body of the first request for a key "regardless of whether it succeeds or fails", and that includes `500`s. Retrying a `500` with the same key returns the same `500`, because the original attempt may have had side effects that Stripe is still reconciling. The advice is to treat a `500` as indeterminate and let webhooks tell you what really happened.
- **Parameters are compared.** Reusing a key with a different request body is treated as a client bug and rejected, not silently replayed.
- **Concurrent conflicts are not stored.** If a request conflicts with another one executing at the same time, Stripe does not save an idempotent result for it, because no endpoint began executing. The client can retry it.
- **Rate limiting runs before the idempotency layer.** A request that was rate limited with `429` can produce a different result on retry with the same key. The layers are ordered on purpose: a limiter that had to consult the key store would not be much of a limiter.
- **Keys live at least 24 hours (API v1).** Stripe may prune a key once it is 24 hours old; a key reused after pruning starts a new request. Stripe's newer API v2 has its own retention and replay rules, so check the version you are on.
- **Only `POST` needs it.** In API v1 every `POST` accepts a key; on `GET` and `DELETE`, which are idempotent by definition, a key has no effect.
- **Replays are labelled.** A replayed response carries `Idempotent-Replayed: true`, and a `Stripe-Should-Retry` header tells well-behaved clients whether retrying is even worth it. The official SDKs generate keys and retry eligible network failures once you turn retries on (`maxNetworkRetries` in stripe-node); your code still has to treat an indeterminate `500` as unknown and reconcile through webhooks.

### From the client side

Most teams meet all of this as a Stripe customer, not as an API author, so here is what the rules look like from that side. Derive the key from the business event (the order, not the attempt), send it on every attempt of that operation, and let the SDK retry the failures that are safe to retry.

```tabs
{
  "title": "Send a key with the request",
  "tabs": [
    {
      "label": "curl",
      "lang": "bash",
      "code": "curl https://api.stripe.com/v1/payment_intents \\\n  -u \"$STRIPE_SECRET_KEY:\" \\\n  -H \"Idempotency-Key: order_8f1c2e_charge\" \\\n  -d amount=1900 -d currency=eur \\\n  -d \"payment_method_types[]=card\""
    },
    {
      "label": "stripe-node",
      "lang": "javascript",
      "code": "const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2 });\n\nconst intent = await stripe.paymentIntents.create(\n  { amount: 1900, currency: \"eur\", payment_method_types: [\"card\"] },\n  { idempotencyKey: `order_${order.id}_charge` },\n);"
    },
    {
      "label": "Python",
      "lang": "python",
      "code": "stripe.api_key = os.environ[\"STRIPE_SECRET_KEY\"]\nstripe.max_network_retries = 2\n\nintent = stripe.PaymentIntent.create(\n    amount=1900,\n    currency=\"eur\",\n    payment_method_types=[\"card\"],\n    idempotency_key=f\"order_{order.id}_charge\",\n)"
    }
  ]
}
```

The SDKs retry only network-level failures and responses that say they are retryable, with a short first pause and exponential backoff after that. If you write the loop yourself, keep the same key across attempts, back off exponentially, and add jitter so a fleet of clients recovering from the same blip does not retry in lockstep:

```javascript
async function withRetries(fn, attempts = 4) {
  for (let n = 0; ; n++) {
    try {
      return await fn(); // fn sends the same Idempotency-Key every time
    } catch (err) {
      const retryable = err.type === "StripeConnectionError" || err.statusCode === 429 || err.statusCode >= 500;
      if (!retryable || n === attempts - 1) throw err;
      const base = 200 * 2 ** n; // 200, 400, 800 ms ...
      await new Promise((r) => setTimeout(r, base / 2 + Math.random() * (base / 2)));
    }
  }
}
```

A `409` on a key that is still in progress belongs in the retryable set too: it means the first attempt is alive and will answer soon.

None of this is exotic. Brandur's separate Rocket Rides post shows one way to implement those semantics on the server when a request dies halfway through, and that is the design we build next.

## What the server has to remember

Consider what "create a ride and charge for it" means inside any service that calls a payment provider. It is never a single write. In Brandur's Rocket Rides example (a fictional jetpack rideshare), one API call records a ride, calls Stripe to create a charge, stores the charge id on the ride, and stages a receipt email. The Stripe call is the problem. It is a **foreign state mutation**: it changes state in a system whose transaction you do not control. You cannot roll it back with the rest of your work, and you cannot make it happen atomically with your own writes.

The design answer is to split the request into **atomic phases** separated by those foreign calls, and to write a **recovery point** after each phase so a retry knows where to pick up.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Phase 1", "sub": "claim the key row", "icon": "lock", "tone": "blue" },
    { "label": "Phase 2", "sub": "insert ride (tx)", "icon": "database", "tone": "blue" },
    { "label": "Charge card", "sub": "foreign call, own key", "icon": "cloud", "tone": "amber" },
    { "label": "Phase 3", "sub": "store charge id + response (tx)", "icon": "database", "tone": "blue" },
    { "label": "Reply", "sub": "or replay on retry", "icon": "check", "tone": "green" }
  ]
}
```

The key row is the memory. In the published design it carries:

- the key itself and the user or account it belongs to, unique together, because two customers may pick the same UUID
- `locked_at`, set while a request holds the key, so a concurrent duplicate can be told to wait
- `recovery_point`, the name of the last completed phase (`started`, `ride_created`, `charge_created`, `finished`)
- a fingerprint of the request (method, path, parameters) so a mismatched reuse can be rejected
- the response code and body once the request has finished

Three supporting processes complete the picture: an **enqueuer** that drains staged jobs once their transaction has committed, an optional **completer** that pushes unfinished requests through their remaining phases when the client has stopped retrying, and a **reaper** that deletes old keys so the table does not grow without bound. Brandur suggests about 72 hours of retention for the reference design; Stripe's API v1 may prune keys once they are at least 24 hours old.

As a result, a retry does not need special-case code. It claims the key, reads the recovery point, and runs whatever phases are left. If the process died after the card was charged but before the charge id was stored, the retry sees `recovery_point = ride_created`, calls the card network again with the same downstream idempotency key, receives the same charge back, and finishes. The customer is charged once.

```diagram
{
  "type": "flow",
  "nodes": [
    {
      "label": "Retry arrives",
      "sub": "same key, same body",
      "icon": "activity",
      "tone": "slate"
    },
    {
      "label": "Claim key",
      "sub": "lease free or expired",
      "icon": "lock",
      "tone": "blue"
    },
    {
      "label": "Read recovery point",
      "sub": "ride_created: skip phase 2",
      "icon": "database",
      "tone": "violet"
    },
    {
      "label": "Charge again",
      "sub": "same derived key",
      "icon": "cloud",
      "tone": "amber"
    },
    {
      "label": "Provider replays",
      "sub": "same charge id",
      "icon": "check",
      "tone": "green"
    },
    {
      "label": "Phase 3",
      "sub": "store id, save response",
      "icon": "database",
      "tone": "blue"
    }
  ]
}
```

That last sentence hides a requirement: the downstream call must itself be idempotent, keyed by something you derive from your key. Stripe's API gives you that. If you call an API that does not, you are back to guessing.

## A Postgres state machine

We wrote a small version of this in Node with plain `pg` and ran it against a Postgres branch. The whole thing is one server file, one schema file, and a script that tries to break it. The repo is public:

```github
The-DevOps-Daily/idempotency-keys-demo
```

The "payment provider" is a second endpoint in the same process that the rides API calls over HTTP. It models one Stripe property, the one that matters for this story: repeated requests with the same key return the same charge. It deliberately leaves out parameter checks, retention, cached errors and replay headers. It lives in the same database only so you need one connection string.

What the demo does and does not claim, next to Stripe's documented behaviour:

| | Stripe API v1 | This demo |
|---|---|---|
| Key scope | per account, up to 255 chars | per user, up to 255 chars |
| Retention | at least 24 hours, then pruned | never pruned (no reaper) |
| Same key, different parameters | rejected | rejected with `409` |
| Concurrent duplicate | conflict, not stored, retryable | `409` while the lease is held |
| Endpoint `500` | stored and replayed | not stored; lease expires and the retry resumes |
| Replay signal | `Idempotent-Replayed: true` header | `replayed: true` field in the body |
| Recovery of a half-done request | Stripe reconciles internally, fires webhooks | recovery point resumes the remaining phases |
| Downstream call | the card networks | a second endpoint in the same process |

### The tables

```sql
CREATE TABLE idempotency_keys (
  id              bigserial PRIMARY KEY,
  user_id         text        NOT NULL,
  key             text        NOT NULL CHECK (char_length(key) <= 255),
  request_hash    text        NOT NULL,
  locked_at       timestamptz,
  recovery_point  text        NOT NULL DEFAULT 'started',
  response_code   int,
  response_body   jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)          -- keys are scoped to the account
);

CREATE TABLE rides (
  id                  bigserial PRIMARY KEY,
  user_id             text NOT NULL,
  idempotency_key_id  bigint NOT NULL REFERENCES idempotency_keys(id),
  amount_cents        int  NOT NULL,
  charge_id           text,
  created_at          timestamptz NOT NULL DEFAULT now()
);
-- One ride per key, enforced by the database (added after the run below).
CREATE UNIQUE INDEX rides_one_per_key ON rides (idempotency_key_id);

-- Stands in for the payments provider.
CREATE TABLE provider_charges (
  id               text PRIMARY KEY,
  idempotency_key  text UNIQUE NOT NULL,
  amount_cents     int NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
```

### Claiming the key

The key-claim transaction is the first concurrency guard. Insert the key row if it does not exist, lock it, and then decide what this request is: a replay, a conflict, or the one that gets to do the work. The reference schema also has a unique constraint tying a ride to its key. The first version of this demo did not, which is how the expired-lease failure below became visible; the final schema has it, and the last run shows what it changes.

```javascript
// Phase 1 (atomic): claim the key. SELECT ... FOR UPDATE serialises
// concurrent duplicates; whoever comes second sees what the first left behind.
const claim = await tx(async (c) => {
  await c.query(
    `INSERT INTO idempotency_keys (user_id, key, request_hash)
     VALUES ($1, $2, $3) ON CONFLICT (user_id, key) DO NOTHING`,
    [userId, key, requestHash],
  );
  const { rows: [k] } = await c.query(
    `SELECT * FROM idempotency_keys WHERE user_id = $1 AND key = $2 FOR UPDATE`,
    [userId, key],
  );
  // Same key, different request: a client bug, not a retry.
  if (k.request_hash !== requestHash) return { reply: [409, { error: "This Idempotency-Key was used with different parameters" }] };
  // Already finished: replay the stored answer.
  if (k.response_code) return { reply: [k.response_code, { ...k.response_body, replayed: true }] };
  // Take the lock only if nobody holds a live one. clock_timestamp() moves
  // inside a transaction, unlike now(), so the lock time is real.
  const { rowCount } = await c.query(
    `UPDATE idempotency_keys SET locked_at = clock_timestamp()
     WHERE id = $1 AND (locked_at IS NULL OR locked_at < clock_timestamp() - make_interval(secs => $2))`,
    [k.id, LOCK_TTL_MS / 1000],
  );
  if (rowCount === 0) return { reply: [409, { error: "A request with this Idempotency-Key is still in progress" }] };
  return { key: k };
});
if (claim.reply) return json(res, ...claim.reply);
```

Three things to notice. After loading the row, the hash of the request body is compared first, so a reused key with a different body never takes the lock. (The demo hashes `JSON.stringify(body)`; production code should hash a canonical form that includes the endpoint and every input that changes the result, and nothing volatile.) The replay check comes next, so a finished request answers instantly. And the row lock serialises claimants, while the conditional `UPDATE` evaluates lease expiry in database time and its `rowCount` says whether this claimant got the lease.

### The phases

```javascript
// Phase 2 (atomic): local bookkeeping, then move the recovery point.
if (k.recovery_point === "started") {
  await tx(async (c) => {
    await c.query(`INSERT INTO rides (user_id, idempotency_key_id, amount_cents) VALUES ($1, $2, $3)`,
      [userId, k.id, params.amount_cents]);
    await c.query(`UPDATE idempotency_keys SET recovery_point = 'ride_created' WHERE id = $1`, [k.id]);
  });
  k.recovery_point = "ride_created";
}

// Foreign state mutation: the charge. Not inside any of our transactions,
// so it carries its own idempotency key derived from ours. A retry after a
// crash asks the provider for the same charge and gets the same answer.
if (k.recovery_point === "ride_created") {
  const r = await fetch(`http://127.0.0.1:${PORT}/provider/charges`, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": `${userId}:${key}:charge` },
    body: JSON.stringify({ amount_cents: params.amount_cents }),
  });
  const charge = await r.json();
  if (!r.ok) throw new Error(`provider said ${r.status}`);
  if (crash === "after_charge") throw new Error("simulated crash after the provider charged the card");

  // Phase 3 (atomic): record the charge and the response, release the lock.
  await tx(async (c) => {
    const { rows: [ride] } = await c.query(
      `UPDATE rides SET charge_id = $1 WHERE idempotency_key_id = $2 RETURNING id, amount_cents, charge_id`,
      [charge.id, k.id]);
    const body = { ride_id: ride.id, amount_cents: ride.amount_cents, charge_id: ride.charge_id };
    await c.query(
      `UPDATE idempotency_keys
         SET recovery_point = 'finished', response_code = 201, response_body = $2, locked_at = NULL
       WHERE id = $1`, [k.id, body]);
  });
}
```

The `crash` query parameter exists only so the demo can die at the worst possible moment: after the provider has the money, before we have the charge id. On failure the handler returns a `500` and leaves the row locked with its recovery point intact. This is a deliberate departure from Stripe, which stores an endpoint's `500` and replays it; the demo treats the failure as recoverable instead, so the lease expires and the next retry resumes from `ride_created`.

The provider endpoint is eight lines and one `INSERT ... ON CONFLICT`. Its whole contract is: same key, same charge.

```javascript
const row = await pool.query(
  `INSERT INTO provider_charges (id, idempotency_key, amount_cents) VALUES ($1, $2, $3)
   ON CONFLICT (idempotency_key) DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
   RETURNING id, amount_cents, (xmax = 0) AS created`,
  [id, key, body.amount_cents],
);
```

(The `DO UPDATE` that sets a column to itself is a Postgres idiom to make `RETURNING` produce the existing row on conflict; `xmax = 0` tells you whether this call inserted it.)

## One winner, nineteen conflicts

The demo script fires three scenarios at the API: twenty concurrent requests with one key, a reuse of that key with a different amount, and a request that crashes after the charge followed by retries. Here is the run, unedited, against a Postgres branch on Neon from a Raspberry Pi:

```terminal
{
  "title": "npm run demo",
  "prompt": "$",
  "steps": [
    { "cmd": "npm run schema", "output": "schema ready" },
    { "cmd": "npm start &", "output": "rides api on :4100 (lock ttl 10000 ms)" },
    { "cmd": "npm run demo", "output": "# 1. Twenty clients retry the same request at once (same Idempotency-Key)\nstatuses: {\"201\":1,\"409\":19}\n201 bodies all name the same charge: true (ch_bbf48cd47263)\nreplayed responses: 0, first-time: 1\nstats: {\"rides\":1,\"rides_with_charge\":1,\"provider_charges\":1,\"provider_cents\":1900}\n\n# 2. Same key, different amount: a client bug, not a retry\n{\"status\":409,\"body\":{\"error\":\"This Idempotency-Key was used with different parameters\"}}\n\n# 3. Crash after the card was charged but before we recorded it\nfirst attempt:  {\"status\":500,\"body\":{\"error\":\"simulated crash after the provider charged the card\",\"recovery_point\":\"ride_created\"}}\nstats now:      {\"rides\":2,\"rides_with_charge\":1,\"provider_charges\":2,\"provider_cents\":6100}  <- provider has the money, we have no charge_id\nretry at once:  {\"status\":409,\"body\":{\"error\":\"A request with this Idempotency-Key is still in progress\"}}\nwaiting for the lock to expire (10 s)...\nretry later:    {\"status\":201,\"body\":{\"ride_id\":\"2\",\"amount_cents\":4200,\"charge_id\":\"ch_165363a6ef7d\"}}\nretry again:    {\"status\":201,\"body\":{\"ride_id\":\"2\",\"charge_id\":\"ch_165363a6ef7d\",\"amount_cents\":4200,\"replayed\":true}}\nstats: {\"rides\":2,\"rides_with_charge\":2,\"provider_charges\":2,\"provider_cents\":6100}" }
  ]
}
```

Reading the three scenarios:

1. **The burst.** Twenty requests, one winner. The other nineteen arrived while the winner held the lease and got `409`. Stripe likewise treats a concurrent conflict on a key as retryable and does not store a result for it. One ride, one provider charge, 1900 cents. A client that received a `409` here should back off and retry with the same key; by then it will get the replayed `201`.
2. **The reuse.** Same key, 2900 cents instead of 1900. Rejected at the hash check before any lock or write. Silently replaying the 1900-cent result would have been worse than an error: the client thinks it charged 2900.
3. **The crash.** The first attempt charges the card (the provider now holds 6100 cents across two charges) and dies before storing the charge id. The immediate retry finds the row still locked and gets `409`. After the lease expires, the retry resumes at `ride_created`, asks the provider for the charge with the same derived key, receives `ch_165363a6ef7d` again, stores it, and returns `201`. A further retry returns the stored body plus a demo-only `replayed` flag; Stripe keeps the body untouched and signals the replay in the `Idempotent-Replayed` header instead. Two rides, two charges, one per customer intent. Nobody was charged twice.

## The run that went wrong

The output above is the second run. The first one looked like this:

```terminal
{
  "title": "npm run demo (lock ttl 2000 ms)",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    { "cmd": "npm run demo", "output": "# 1. Twenty clients retry the same request at once (same Idempotency-Key)\nstatuses: {\"201\":3,\"409\":17}\n201 bodies all name the same charge: true (ch_6c15fd603155)\nreplayed responses: 0, first-time: 3\nstats: {\"rides\":3,\"rides_with_charge\":3,\"provider_charges\":1,\"provider_cents\":1900}" }
  ]
}
```

Three first-time `201`s and three rides for one provider charge. The row locking behaved as written; the two-second lease assumption did not. It was chosen so the crash scenario would not make readers wait. A database query afterwards showed `created_at` values of 24.7 seconds past the minute for the key row and 28.0, 28.3 and 29.5 for the three rides. Postgres's `now()` records transaction start rather than the exact insert instant, so these are not precise, but together with the output they are consistent with one picture: under twenty concurrent requests on a cold connection pool, the winner took longer than the lease to get from claiming the key to inserting its ride, and two waiting requests acquired the expired lease while the committed recovery point still said `started`.

The provider's own idempotency saved the money: all three rides point at the same charge, and the customer paid once. The application data was still wrong, and in a system where the ride-creation phase did something with a side effect (reserved inventory, sent a confirmation), the customer would have noticed.

The lesson generalises past this demo. **A lock timeout shorter than your slowest honest request is a duplicate generator.** The reference design also lets a retry acquire an expired lock; its optional completer exists for unfinished requests whose clients stopped retrying, and it does not remove the risk of an old worker and a takeover running at the same time. Raising the lease to 10 seconds is what made the recorded run clean, and it is not a fix: no fixed timeout is guaranteed to outlast every pause. Production needs a conservative lease plus renewal or a fencing token, database constraints for every local invariant (here, one ride per key), and alerts for stale work.

### The constraint, run

Prose is cheap, so we added the constraint (`CREATE UNIQUE INDEX rides_one_per_key ON rides (idempotency_key_id)`), put the lease back to 2 seconds, and ran the burst again:

```terminal
{
  "title": "npm run demo (lock ttl 2000 ms, one ride per key)",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "npm run demo",
      "output": "# 1. Twenty clients retry the same request at once (same Idempotency-Key)\nstatuses: {\"201\":1,\"409\":17,\"500\":2}\n201 bodies all name the same charge: true (ch_de1965ba9783)\nreplayed responses: 0, first-time: 1\nstats: {\"rides\":1,\"rides_with_charge\":1,\"provider_charges\":1,\"provider_cents\":1900}"
    }
  ]
}
```

Same race, different outcome. The winner still finishes with one ride and one charge. The two requests that took over the expired lease now fail on the unique index when they try to insert their ride and return `500`, which is the honest answer: something went wrong with their attempt, nothing was duplicated, and their client will retry with the same key and get the winner's replayed `201`. Loud failure beat silent duplication; that is the whole point of putting the invariant where a lease cannot reach it.

## The pattern beyond payments

- **Stripe** is the reference. Current stripe-node retries eligible failures once by default; `maxNetworkRetries` changes that count, and the library adds idempotency keys where appropriate. `Idempotent-Replayed: true` marks a cached server response.
- **Webhook senders** need it in both directions. [Svix](https://link.svix.com/devopsdaily) accepts an `Idempotency-Key` on its `POST` endpoints and returns the first result for up to 12 hours; on the receiving side you deduplicate on the message id, as covered in [what it actually takes to deliver a webhook in production](/posts/reliable-webhook-delivery-retries-signatures-idempotency).
- **Transactional email** is a foreign state mutation with a human on the other end. The [smtpfast](https://smtpfa.st) send API takes an `Idempotency-Key` and returns the original email id on a retry, which is what let us build a reply feature in that product without a "did the retry send twice?" path.
- **Job queues** deliver at least once. [Running a background job that must not be lost](/posts/running-a-background-job-that-must-not-be-lost) is the same idea from the worker's side.

## A checklist for your own API

If you are adding idempotency to a `POST` endpoint, here is the list we would review against:

1. **Scope keys to the caller.** The unique constraint is `(account, key)`, never `key` alone.
2. **Hash and compare the request.** Reject the same key when the canonical method, path or any outcome-affecting parameter differs, and document the status you return. Include recipients, amounts and scheduling; leave out volatile transport headers such as tracing ids. A partial fingerprint turns a client bug into a silent wrong answer.
3. **Claim the key atomically, and let the second caller lose.** `SELECT ... FOR UPDATE` plus a conditional update gets you there. Return `409` for an in-flight duplicate and let clients back off and retry.
4. **Treat the lock as a lease.** Make it longer than your slowest request measured under load, renew it or fence it with a token, and enforce the one-operation invariant with a unique constraint so a takeover cannot duplicate work even when the lease is wrong.
5. **Write a recovery point after every local phase**, before the next foreign call. The phase before a foreign call must be committed, or a retry will repeat it.
6. **Give every foreign call its own key derived from yours.** If the downstream API is not idempotent, you have not made your endpoint idempotent, only your database.
7. **Store the final response and replay it verbatim**, including errors that were the endpoint's answer. Label replays so clients can tell.
8. **Decide what happens before the idempotency layer.** Authentication and rate limiting usually run first, and a `429` or `401` is therefore not cached. Document it, as Stripe does.
9. **Reap old keys.** Pick a window longer than your clients' retry and reconciliation period; Stripe's API v1 keeps keys at least 24 hours, which suits an API that gets retried in seconds and reconciled in hours. Make the window explicit in your docs so clients know how long a retry is safe.
10. **Never put personal data in a key.** Keys end up in logs on both sides. Stripe's docs say this outright.

## The guarantee lives in the state machine

Idempotency keys look like a caching feature and are really a small state machine. The header buys you nothing on its own; the guarantees come from persisted progress, serialised claims, parameter matching, safe foreign calls, and invariants the database enforces. The demo above is about 200 lines because the idea is small. What is not small is the number of ways to get the details slightly wrong, and the two-second run shows why the header and a response cache are not enough on their own.

To try the behaviour, break a receiver in the [webhook delivery simulator](/games/webhook-delivery-simulator) and watch retries and deduplication play out, or point the [demo repo](https://github.com/The-DevOps-Daily/idempotency-keys-demo) at your own database.
