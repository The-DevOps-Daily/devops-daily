---
title: 'How Stripe Avoids Double-Charging Anyone'
excerpt: 'A payment request times out. Did the charge happen? Stripe answers that question with idempotency keys, and the design behind them is more than a cache of responses: locked key rows, recovery points, and a rule about which calls can be retried. Here is the design, a working Postgres implementation, and the run where our own version double-created rides.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-09-03'
publishedAt: '2026-09-03T09:00:00Z'
updatedAt: '2026-09-03T09:00:00Z'
readingTime: '16 min read'
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

Your checkout service sends `POST /v1/charges` and the socket dies before a response arrives. There are three possible worlds: the request never reached the payment provider, the provider charged the card and the response was lost, or the provider is still working on it. Your code cannot tell them apart, and the customer is waiting. Retry, and you might charge twice. Give up, and you might have taken money without recording an order.

Stripe processed over $1.9 trillion in payments in 2025. At that volume, "the connection dropped" is not an edge case but a steady stream of events, every one of them a potential double charge. The mechanism that keeps that from happening is the idempotency key, and it is one of the few pieces of distributed systems design that a small team can copy in an afternoon. The interesting part is not the header. It is what the server has to remember, in what order, and around which call.

This post walks through the design Stripe has described publicly, builds a working version in Node and Postgres, runs it against concurrent duplicates and a mid-request crash, and shows the run where our first attempt got it wrong.

## TL;DR

- A client generates a unique key per operation and sends it as `Idempotency-Key`. The server stores the first result under that key and replays it for any retry with the same key and the same parameters. Stripe keeps keys for 24 hours and caches the response whether it succeeded or failed.
- The response cache is the easy half. The hard half is a request that dies in the middle: the server has to know how far it got and resume from there without repeating the one step it cannot undo.
- The pattern is atomic phases and recovery points: group local database writes into transactions, put a marker after each, and treat any call to another system (a card network, an email API) as a boundary that must carry its own idempotency key.
- Concurrent duplicates are handled by locking the key row, not by hoping they arrive one at a time.
- The lock has to outlive your slowest request. Ours did not, and the demo created three rides for one charge until we fixed it. The output of that run is below.

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
- **Concurrent duplicates conflict.** A second request with the same key while the first is still running gets a `409 Conflict`, and Stripe does not save an idempotent result for it because no endpoint began executing. You can retry it.
- **Rate limiting runs before the idempotency layer.** A request that was rate limited with `429` can produce a different result on retry with the same key. The layers are ordered on purpose: a limiter that had to consult the key store would not be much of a limiter.
- **Keys expire after 24 hours.** After that a reused key is treated as a new request.
- **Only `POST` needs it.** Stripe tells you not to send keys on `GET` or `DELETE`, which are idempotent by definition.
- **Replays are labelled.** A replayed response carries `Idempotent-Replayed: true`, and a `Stripe-Should-Retry` header tells well-behaved clients whether retrying is even worth it. The official SDKs handle all of this once you set `max_network_retries`.

None of this is exotic. What makes Stripe's version instructive is the second post, on the same author's blog, that shows how the server side holds together when a request dies halfway through.

## What the server has to remember

Consider what "create a charge" means inside a payment company, or inside any service that calls one. It is never a single write. In the Rocket Rides example Stripe's engineer uses (a fictional jetpack rideshare), one API call means: record the ride, charge the customer's card through the card network, store the resulting charge id on the ride, and queue a receipt email. The card network call is the problem. It is a **foreign state mutation**: it changes state in a system whose transaction you do not control. You cannot roll it back with the rest of your work, and you cannot make it happen atomically with your own writes.

The design answer is to split the request into **atomic phases** separated by those foreign calls, and to write a **recovery point** after each phase so a retry knows where to pick up.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Claim key", "sub": "insert or lock row", "icon": "lock", "tone": "blue" },
    { "label": "Phase 1", "sub": "insert ride (tx)", "icon": "database", "tone": "blue" },
    { "label": "Charge card", "sub": "foreign call, own key", "icon": "cloud", "tone": "amber" },
    { "label": "Phase 2", "sub": "store charge id + response (tx)", "icon": "database", "tone": "blue" },
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

Two background processes complete the picture. A **completer** looks for keys that are locked but old and pushes them through their remaining phases, so a request whose process died does not stay half-done forever. A **reaper** deletes keys after a retention window (Stripe uses 24 hours for its API; the blog design suggests 72) so the table does not grow without bound.

The elegant consequence is that a retry does not need special-case code. It claims the key, reads the recovery point, and runs whatever phases are left. If the process died after the card was charged but before the charge id was stored, the retry sees `recovery_point = ride_created`, calls the card network again with the same downstream idempotency key, receives the same charge back, and finishes. The customer is charged once.

That last sentence hides a requirement: the downstream call must itself be idempotent, keyed by something you derive from your key. Stripe's API gives you that. If you call an API that does not, you are back to guessing.

## Building it

We wrote a small version of this in Node with plain `pg` and ran it against a Postgres branch. The whole thing is one server file, one schema file, and a script that tries to break it. The repo is public:

```github
The-DevOps-Daily/idempotency-keys-demo
```

To keep the demo honest, the "payment provider" is a second endpoint in the same process that honours its own `Idempotency-Key` the way Stripe does, and the rides API talks to it over HTTP. It lives in the same database only so you need one connection string.

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

-- Stands in for the payments provider.
CREATE TABLE provider_charges (
  id               text PRIMARY KEY,
  idempotency_key  text UNIQUE NOT NULL,
  amount_cents     int NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
```

### Claiming the key

Everything about concurrency lives in the first transaction. Insert the key row if it does not exist, lock it, and then decide what this request is: a replay, a conflict, or the one that gets to do the work.

```javascript
// Phase 0 (atomic): claim the key. SELECT ... FOR UPDATE serialises
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

Three things to notice. The request hash is compared before anything else, so a reused key with a different body never touches the lock. The replay check comes next, so a finished request answers instantly. And the lock is taken with a conditional `UPDATE` rather than by reading `locked_at` in JavaScript and deciding, which closes the gap between reading and writing.

### The phases

```javascript
// Phase 1 (atomic): local bookkeeping, then move the recovery point.
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

  // Phase 2 (atomic): record the charge and the response, release the lock.
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

The `crash` query parameter exists only so the demo can die at the worst possible moment: after the provider has the money, before we have the charge id. On failure the handler returns a `500` and deliberately leaves the row locked with its recovery point intact. The lock will expire, and the next retry (or a completer, which this demo does not include) resumes from `ride_created`.

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

## Running it

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

1. **The burst.** Twenty requests, one winner. The other nineteen arrived while the winner held the lock and got `409`, which is exactly what Stripe returns in the same situation. One ride, one provider charge, 1900 cents. A client that received a `409` here should back off and retry with the same key; by then it will get the replayed `201`.
2. **The reuse.** Same key, 2900 cents instead of 1900. Rejected at the hash check before any lock or write. Silently replaying the 1900-cent result would have been worse than an error: the client thinks it charged 2900.
3. **The crash.** The first attempt charges the card (the provider now holds 6100 cents across two charges) and dies before storing the charge id. The immediate retry finds the row still locked and gets `409`. After the lock expires, the retry resumes at `ride_created`, asks the provider for the charge with the same derived key, receives `ch_165363a6ef7d` again, stores it, and returns `201`. A further retry is a plain replay. Two rides, two charges, one per customer intent. Nobody was charged twice.

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

Three first-time `201`s and three rides for one provider charge. The claim logic was correct. The lock TTL was 2 seconds, chosen so the crash scenario would not make readers wait. Under twenty concurrent requests on a cold connection pool, the winner took a little over 3 seconds to get from claiming the key to inserting its ride. By then the lock had expired, two of the waiting requests took it over, read a recovery point that still said `started`, and each inserted a ride of their own.

The provider's own idempotency saved the money: all three rides point at the same charge, and the customer paid once. The application data was still wrong, and in a system where phase 1 did something with a side effect (reserved inventory, sent a confirmation), the customer would have noticed.

The lesson generalises past this demo. **A lock timeout shorter than your slowest honest request is a duplicate generator.** Stripe's design sidesteps the question with the completer: an expired lock is not taken over by whichever retry arrives first, it is handed to a background process that runs the remaining phases with the current recovery point. If you skip the completer and let retries take over stale locks, as this demo does, the TTL has to be generous, and phase boundaries have to be written before you do anything a takeover could repeat. We raised the TTL to 10 seconds for the fixed run; a production service would use a minute or more and alert on locks older than that.

## Where you already meet this pattern

Once you know the shape, you see it in most APIs that mutate money or state on your behalf.

- **Stripe** is the reference. Set `max_network_retries` in the SDK and it generates keys and retries with backoff for you; look for `Idempotent-Replayed: true` to know when you got a cached answer.
- **Webhook senders** need the same thing in both directions. [Svix](https://link.svix.com/devopsdaily) accepts an `Idempotency-Key` on its `POST` endpoints and returns the first result for up to 12 hours, so "send this message" is safe to retry; on the receiving side, the message id in the payload is what you deduplicate on. We covered that half in [what it actually takes to deliver a webhook in production](/posts/reliable-webhook-delivery-retries-signatures-idempotency).
- **Transactional email** is a foreign state mutation with a human on the other end. The [smtpfast](https://smtpfa.st) send API takes an `Idempotency-Key` and returns the original email id for 24 hours, which is what let us write the reply feature in that product without a "did the retry send twice?" path. The same 24-hour window as Stripe is not a coincidence; it is long enough to cover any sane retry policy and short enough that the key table stays small.
- **Job queues** deliver at least once. Our post on [running a background job that must not be lost](/posts/running-a-background-job-that-must-not-be-lost) is the same idea from the worker's side: durable steps with a recorded position, so a restart resumes rather than repeats.

The demo itself ran against a branch on Neon, created for the run and deleted after, which is a pleasant way to do "drop the schema and start again" ten times in an hour without touching anything shared.

## A checklist for your own API

If you are adding idempotency to a `POST` endpoint, here is the list we would review against:

1. **Scope keys to the caller.** The unique constraint is `(account, key)`, never `key` alone.
2. **Hash and compare the request.** Same key, different body, `409`. Include everything that changes the outcome: recipients, amounts, scheduling, headers. A partial fingerprint turns a client bug into a silent wrong answer.
3. **Lock the row, and let the second caller lose.** `SELECT ... FOR UPDATE` plus a conditional update is enough. Return `409` for an in-flight duplicate and let clients back off and retry.
4. **Make the lock TTL longer than your slowest request**, and measure that under load, not on a warm laptop. Better still, hand expired locks to a completer instead of the next retry.
5. **Write a recovery point after every local phase**, before the next foreign call. The phase before a foreign call must be committed, or a retry will repeat it.
6. **Give every foreign call its own key derived from yours.** If the downstream API is not idempotent, you have not made your endpoint idempotent, only your database.
7. **Store the final response and replay it verbatim**, including errors that were the endpoint's answer. Label replays so clients can tell.
8. **Decide what happens before the idempotency layer.** Authentication and rate limiting usually run first, and a `429` or `401` is therefore not cached. Document it, as Stripe does.
9. **Reap old keys.** 24 hours is the common choice. Make the window explicit in your docs so clients know how long a retry is safe.
10. **Never put personal data in a key.** Keys end up in logs on both sides. Stripe's docs say this outright.

## Wrapping up

Idempotency keys look like a caching feature and are really a small state machine. The header buys you nothing on its own; the guarantees come from a row that remembers how far a request got, a lock that keeps duplicates from racing, a fingerprint that keeps reused keys from lying, and a discipline about which calls sit at phase boundaries. Stripe published this design because it is the part of payments infrastructure that every integrator eventually has to reinvent, and the demo above is about 200 lines because the idea is small. What is not small is the number of ways to get the details slightly wrong. Our 2-second lock is one; most teams find their own.

If you want to feel the retry behaviour rather than read about it, the [webhook delivery simulator](/games/webhook-delivery-simulator) lets you break a receiver and watch retries and deduplication play out, and the [demo repo](https://github.com/The-DevOps-Daily/idempotency-keys-demo) is there to point at your own database.
