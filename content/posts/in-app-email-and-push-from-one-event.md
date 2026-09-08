---
title: 'In-App, Email and Push From One Event'
excerpt: 'An order ships. The user wants a badge in the app, a digest email later, no push at all, and their own webhook endpoint pinged. The design that handles that without duplicates: an outbox keyed by event, user and channel, preferences evaluated at send time, digest windows, and provider feedback wired back in. With a runnable model and a build-or-buy verdict.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-09-08'
publishedAt: '2026-09-08T09:00:00Z'
updatedAt: '2026-09-08T09:00:00Z'
readingTime: '15 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - System Design
  - Notifications
  - Webhooks
  - Email
  - PostgreSQL
  - APIs
  - DevOps
---

The first notification in a product is one line: the order ships, so call the email provider. The second is a push. Then support asks for an in-app inbox so people stop emailing to ask what happened, a customer asks for a webhook so their warehouse system can react, and someone in marketing wants a weekly summary instead of forty emails. By then the handler that started as one line is a hundred, every channel has its own retry logic, and a retried event sends the customer the same email twice while their muted push channel keeps ringing.

We wrote earlier about [what it takes to deliver a webhook in production](/posts/reliable-webhook-delivery-retries-signatures-idempotency) and about [background jobs that must not be lost](/posts/running-a-background-job-that-must-not-be-lost). Notifications are the layer above both. One event has to fan out to several channels with different guarantees, filtered by preferences the user set months ago, sometimes collapsed with other events into a digest, and reported back so the product knows what was seen. This post is the design that holds up: three nouns, one outbox table, preferences evaluated late, digest windows keyed by user and channel, and a status record that the providers fill in. There is a small runnable model in the middle, and an honest section on when to stop building and use a notification platform.

## TL;DR

- Separate three nouns: an **event** (something happened), a **notification** (a person should know), and a **delivery** (one message on one channel, however many attempts it takes). Keeping them apart prevents duplicate sends and ambiguous delivery state.
- Every channel has a different guarantee. In-app must be exact and reversible. Email can be submitted more than once and cannot be unsent. Push is best-effort and expires. A customer webhook needs signing and retries.
- Fan out through an outbox: a `deliveries` row per (event, user, channel), written in the same transaction as the event, claimed by a worker. Its primary key is the idempotency key for an immediate send; a digest uses its batch key.
- Evaluate preferences when you send, not when you ingest. Preferences change, and a queued notification should respect the new setting.
- Digest by (user, kind, channel, window). Steps before the digest run immediately; steps after it run once when the window closes.
- The providers talk back. Bounces, complaints, invalid device tokens and failing endpoints are inputs to your preference and suppression state, not just log lines.
- Build the event contract and the outbox yourself, always. Consider buying the orchestration (workflows, preference center, provider adapters, logs) once you have more than two or three channels or a preference UI to ship.

## Prerequisites

- Comfort with Postgres or any relational database; the examples use SQL and a small Python script with SQLite so you can run them anywhere.
- Familiarity with at least one transactional email API and one push service.
- Optional: the two earlier posts linked above, which cover retries and idempotency in more depth than this one.

## Three nouns, not one

Most notification code has one noun, "notification," and it means whichever of these three the author was thinking about at the time:

- **Event.** A fact from the domain: `order.shipped`, `comment.created`, `invoice.overdue`. It has an id, a kind, a subject, a payload, and it happened once. Events do not know about channels.
- **Notification.** A decision that a specific person should be told about an event. One event can produce zero notifications (nobody follows that thread) or thousands (a status page incident). A notification does not know how it will be delivered yet.
- **Delivery.** One message to one person on one channel: this email, this push, this inbox row, this webhook POST. A delivery may take several attempts; it has a provider id, an attempt count and a terminal state.

The fan-out factor between them is the whole problem. A single `comment.created` on a busy thread is one event, fifty notifications, and a hundred and fifty deliveries across three channels. If your code models that as fifty calls to `notify()` that each call three providers, then a retry of the event is a hundred and fifty duplicate messages, a user muting email halfway through gets half of them anyway, and nobody can answer "did Maria see this?"

## Channels do not share a guarantee

Before designing the plumbing, write down what each channel promises, because the differences drive the schema.

| Channel | Guarantee you can offer | Reversible? | What the provider tells you |
| --- | --- | --- | --- |
| In-app inbox | Exactly once, ordered per user | Yes, you own the row | The row exists; read state is separate |
| Email | At-least-once submission; delivery is not guaranteed | No | Accepted now; delivered, bounced or complained arrive later by webhook |
| Push (APNs, FCM) | Best effort, time-limited | No, but it can expire unseen | Platform accepted the token; display is not confirmed |
| SMS | At-least-once submission, expensive | No | Carrier delivery report, sometimes |
| Customer webhook | At least once with retries, signed | No, the receiver decides | Endpoint returned 2xx |

Two consequences fall out immediately. Because in-app is the only channel you fully control, it is the one that should be exact: one row per (event, user), no duplicates, updateable when the underlying thing changes. And because email and SMS are irreversible and can be submitted twice, the idempotency key you give the provider is not optional. It is the only thing standing between a worker crash and a customer receiving the same "your order shipped" twice.

The customer webhook is the odd one out: it is your product notifying another system rather than a person, but it belongs in the same fan-out because it is triggered by the same event and governed by the same idea of a subscription. It also carries the most operational detail of the five: signing, retries with backoff, endpoint health and an attempt log the customer can read. A webhook delivery service such as Svix exists to handle that part, so the same code is not written a fourth time.

## Preferences: the model and the moment

A preference answers "does this person want this kind of thing on this channel?" The model that survives contact with a product team has three axes and a few overrides:

- **Kind** (the event type, often grouped into categories such as "billing" or "activity").
- **Channel** (in-app, email, push, SMS, webhook).
- **Scope**: a default per kind and channel, overridable per user, and in multi-tenant products overridable per tenant, so a workspace admin can turn off email for the whole team.

On top of that come the modifiers users ask for: quiet hours, a per-kind digest ("send me shipping updates once a day"), and a mute on a specific object ("stop notifying me about this thread").

Knock's documentation describes the same shape from the platform side: preferences at the workflow, category and channel level, evaluated when a workflow runs, with per-tenant and object-level overrides. Whether you build or buy, the structure is the same.

Defaults per kind and channel belong in code or a small `notification_kinds` table, tenant overrides in a table keyed by tenant, and user choices in a table like this one. Precedence at send time is user, then tenant, then default:

```sql
create table notification_preferences (
  id           bigint generated always as identity primary key,
  user_id      uuid not null,
  tenant_id    uuid,                       -- null = the user's personal setting
  kind         text not null,              -- 'order.shipped', or a category like 'billing'
  channel      text not null,              -- 'inapp' | 'email' | 'push' | 'sms' | 'webhook'
  enabled      boolean not null default true,
  digest_secs  integer not null default 0, -- 0 = immediate
  quiet_start  time,                       -- optional quiet hours in the user's zone
  quiet_end    time,
  updated_at   timestamptz not null default now(),
  unique nulls not distinct (user_id, tenant_id, kind, channel)   -- Postgres 15+
);
```

The moment matters more than the model. Evaluate preferences when a delivery is about to be sent, not when the event is ingested. A notification can sit in a digest window for a day. If the user mutes email in the meantime, the digest should not go out. Late evaluation also lets you change defaults for everyone without replaying a queue. The cost is one extra query per delivery, which is nothing next to the provider call.

## The outbox: one row per event, user and channel

The transactional outbox pattern, familiar from webhooks and job queues, is the backbone here. The difference is the key.

```sql
create table notification_deliveries (
  event_id     text not null,
  user_id      uuid not null,
  channel      text not null,
  status       text not null default 'queued',   -- queued | batched | sending | sent | failed | suppressed
  batch_key    text,                             -- set when the delivery joined a digest window
  attempts     integer not null default 0,
  next_attempt timestamptz not null default now(),
  provider_ref text,                             -- the provider's message id once accepted
  last_error   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (event_id, user_id, channel)
);

create index on notification_deliveries (status, next_attempt)
  where status in ('queued', 'sending');
```

Three properties do the work:

1. **The primary key is the idempotency key.** `(event_id, user_id, channel)` identifies one delivery forever. An event replayed by an upstream retry hits `insert ... on conflict do nothing` and produces no new rows. For an immediate send, the string `event_id:user_id:channel` is what you pass to the email provider as its idempotency key and to the webhook service as the message id; for a digest it is the batch key. A crash between "provider accepted" and "row updated" then resends a request the provider recognizes and drops, for as long as the provider remembers the key. That window is theirs, not yours: Svix, for example, documents idempotency as a per-request option with retention of up to 12 hours, and email APIs vary.
2. **The rows are written in the same transaction as the event.** The event insert and its fan-out land together or not at all. There is no window where the order is marked shipped but the deliveries were never created because the process died.
3. **Workers claim rows, they do not poll a provider.** `select ... for update skip locked` on the partial index above gives you concurrent workers that never claim the same row twice, and `next_attempt` gives you backoff without a separate scheduler. It does not make the provider call atomic with the row update; the crash case in point 1 is covered by the provider-side key, not the lock. Digest batches are claimed as a whole, by batch key, never row by row.

The fan-out itself is a join at ingest time: for this event's kind and audience, which (user, channel) pairs are enabled? That query reads the preferences table above. Reading it here and again at send time is deliberate. At ingest you decide the candidate set; at send you confirm it is still wanted.

On the database side, this is an ordinary Postgres workload with one sharp edge: the deliveries table grows with every event times every recipient times every channel, and it is hot on both insert and update. Archive terminal rows aggressively, but keep the event ids (or a compact dedupe table) for as long as an upstream retry can still arrive, or the replay protection leaves with them. Declarative partitioning by month is possible, but it forces the partition column into the primary key, so decide that before the table is large. If you develop against a hosted Postgres such as Neon, a branch is a convenient way to try a partitioning change or a preference migration against a copy of real data first.

## Digests: collapsing a burst into one message

A digest is the feature that turns forty emails into one, and it is where a naive queue design breaks, because the unit of sending stops being "one delivery."

The rule that keeps it simple: a delivery that belongs to a digest gets a `batch_key` of `(user_id, kind, channel, window_id)` where `window_id` is the current time divided by the window length. Every delivery in the same window shares a key, and each row stores the window's end. When a window has ended, a scheduler flips its `batched` rows to `queued`, and the sender treats one batch key as one message. Later events land in a new window; a closed batch never grows.

Novu's digest step documents the semantics you want: events are collected instead of flowing downstream, grouped per subscriber and optionally per grouping key, and "steps placed before the Digest step execute in real time. Steps placed after the Digest step execute only when the digest duration is completed." That sentence is the whole design. The in-app row is a step before the digest, so it appears instantly. The email is a step after, so it waits.

Which channels digest is a product decision with a technical constraint: only digest what can be rendered as a list. Shipping updates, comment activity and mentions digest well. A password reset does not, and neither does anything a person is waiting for right now. Give each kind a default and let the user shorten or lengthen the window per channel.

## A runnable model

Here is the design in about 100 lines of Python and SQLite. It ingests two `order.shipped` events plus a replay of the first, fans them out according to preferences where push is muted and email is digested, runs the sender while the digest window is still open, then closes the window and sends again. The provider calls are stubs that return a message id; the keys, the transaction boundaries and the batching are real, but the script does not test a crash or a provider's deduplication.

```python
import sqlite3, json, uuid

db = sqlite3.connect(":memory:", isolation_level=None)   # explicit transactions below
db.executescript("""
create table events (
  event_id text primary key, kind text, user_id text, payload text, received_at real);
create table preferences (
  user_id text, kind text, channel text, enabled int, digest_seconds int,
  primary key (user_id, kind, channel));
create table deliveries (
  event_id text, user_id text, channel text, status text, attempts int default 0,
  provider_ref text, batch_key text, batch_end real,
  primary key (event_id, user_id, channel));
""")
db.executemany("insert into preferences values (?,?,?,?,?)", [
    ("u_42", "order.shipped", "inapp", 1, 0),
    ("u_42", "order.shipped", "email", 1, 300),     # digest shipping mail, 5 min window
    ("u_42", "order.shipped", "push",  0, 0),       # muted
    ("u_42", "order.shipped", "webhook", 1, 0),     # the customer's own endpoint
])

def ingest(event_id, kind, user_id, payload, now):
    """Event and fan-out land in one transaction; a replay changes nothing."""
    db.execute("begin")
    try:
        db.execute("insert into events values (?,?,?,?,?)",
                   (event_id, kind, user_id, json.dumps(payload), now))
    except sqlite3.IntegrityError:
        db.execute("rollback")
        return "duplicate event, nothing to do"
    rows = db.execute("select channel, digest_seconds from preferences "
                      "where user_id=? and kind=? and enabled=1", (user_id, kind)).fetchall()
    for channel, digest in rows:
        window = int(now // digest) if digest else None
        batch = f"{user_id}:{kind}:{channel}:{window}" if digest else None
        end = (window + 1) * digest if digest else None
        db.execute("insert or ignore into deliveries"
                   "(event_id,user_id,channel,status,batch_key,batch_end) values (?,?,?,?,?,?)",
                   (event_id, user_id, channel, "batched" if digest else "queued", batch, end))
    db.execute("commit")
    return f"queued {len(rows)} deliveries"

def close_digests(now):
    """Release only windows that have ended; later events start a new window."""
    out = []
    for key, n in db.execute("select batch_key, count(*) from deliveries "
                             "where status='batched' and batch_end<=? group by batch_key", (now,)):
        db.execute("update deliveries set status='queued' where batch_key=? and status='batched'", (key,))
        out.append(f"window closed: {key} ({n} events, one message)")
    return out

def provider_send(channel, key, payload):
    """Stub. A real call carries key as the idempotency key and returns a message id."""
    return f"{channel}_{uuid.uuid4().hex[:8]}"

def send_queued():
    """One provider call per delivery, or per closed digest batch."""
    sent, done = [], set()
    rows = db.execute("select event_id, user_id, channel, batch_key from deliveries "
                      "where status='queued'").fetchall()
    for eid, uid, ch, batch in rows:
        key = batch or f"{eid}:{uid}:{ch}"
        if key in done:
            continue
        done.add(key)
        ref = provider_send(ch, key, None)
        if batch:
            n = db.execute("update deliveries set status='sent', attempts=attempts+1, provider_ref=? "
                           "where batch_key=? and status='queued'", (ref, batch)).rowcount
            sent.append(f"{ch:8s} {ref}  digest of {n} events")
        else:
            db.execute("update deliveries set status='sent', attempts=attempts+1, provider_ref=? "
                       "where event_id=? and user_id=? and channel=? and status='queued'",
                       (ref, eid, uid, ch))
            sent.append(f"{ch:8s} {ref}  {eid}")
    return sent

t0 = 1_800_000_000.0
print(ingest("evt_1001", "order.shipped", "u_42", {"order": "A-1"}, t0))
print(ingest("evt_1002", "order.shipped", "u_42", {"order": "A-2"}, t0 + 40))
print(ingest("evt_1001", "order.shipped", "u_42", {"order": "A-1"}, t0 + 41), "(retry of evt_1001)")
print("-- worker runs now: immediate channels go out, the email window is still open")
for line in send_queued(): print("sent", line)
print("-- five minutes later the scheduler closes the window")
print("\n".join(close_digests(t0 + 301)))
for line in send_queued(): print("sent", line)
print("\ndeliveries table:")
for row in db.execute("select event_id, channel, status, attempts, provider_ref "
                      "from deliveries order by channel, event_id"):
    print("  ", row)
```

The run:

```terminal
{
  "title": "one_event.py",
  "prompt": "$",
  "steps": [
    {
      "cmd": "python3 one_event.py",
      "output": "queued 3 deliveries\nqueued 3 deliveries\nduplicate event, nothing to do (retry of evt_1001)\n-- worker runs now: immediate channels go out, the email window is still open\nsent inapp    inapp_63f8a0bf  evt_1001\nsent webhook  webhook_b10ed588  evt_1001\nsent inapp    inapp_45193e5d  evt_1002\nsent webhook  webhook_075010b0  evt_1002\n-- five minutes later the scheduler closes the window\nwindow closed: u_42:order.shipped:email:6000000 (2 events, one message)\nsent email    email_76e4ee17  digest of 2 events\n\ndeliveries table:\n   ('evt_1001', 'email', 'sent', 1, 'email_76e4ee17')\n   ('evt_1002', 'email', 'sent', 1, 'email_76e4ee17')\n   ('evt_1001', 'inapp', 'sent', 1, 'inapp_63f8a0bf')\n   ('evt_1002', 'inapp', 'sent', 1, 'inapp_45193e5d')\n   ('evt_1001', 'webhook', 'sent', 1, 'webhook_b10ed588')\n   ('evt_1002', 'webhook', 'sent', 1, 'webhook_075010b0')"
    }
  ]
}
```

Four things to notice. Push produced no rows at all, because the preference was evaluated before fan-out and the channel was off. The replayed event produced no extra rows and no extra sends, because the event id is the primary key of `events` and `(event_id, user_id, channel)` is the primary key of `deliveries`. The in-app and webhook deliveries went out on the first worker run while the email window was still open, which is the "steps before the digest run now" rule. And when the window closed, two shipping events became one email with one provider id shared by both rows.

The script skips the parts that are boring in a demo and essential in production: `for update skip locked` claiming, backoff via `next_attempt`, the second preference check at send time, and a real provider that remembers idempotency keys across a crash. Add them and the shape does not change.

## The providers talk back

A delivery is not finished when the provider accepts it. Every channel has a feedback path, and the design is only complete when that feedback changes future behaviour.

```diagram
{
  "type": "loop",
  "goal": "Delivery state and preferences updated by what the channels report",
  "nodes": [
    { "label": "Event", "variant": "soft" },
    { "label": "Fan out to deliveries", "variant": "soft" },
    { "label": "Send via provider", "variant": "solid" },
    { "label": "Provider callback", "variant": "accent" }
  ],
  "loopBack": "bounce, complaint, bad token, failing endpoint",
  "loopTop": "suppress or adjust preference"
}
```

- **Email.** Transactional providers report accepted, delivered, bounced, complained, opened and clicked through webhooks. A hard bounce or a spam complaint has to suppress that address for that kind of mail, and ideally for all marketing mail, before the next digest goes out. Providers with an account-level suppression list, smtpfast among them, will refuse a later send to a complained address on their side, but your deliveries table should record `suppressed` rather than treating the refusal as a retryable failure.
- **Push.** APNs and FCM return a specific error for a token that no longer exists. APNs sends a timestamp with that error; remove the registration only if it is older than the timestamp, or you delete a token the device has since re-registered. Retrying a dead token is wasted work either way.
- **Customer webhooks.** A failing endpoint is a customer problem that becomes your problem when the retry backlog grows. Webhook services such as Svix retry with backoff, expose the attempt log to the customer, and disable an endpoint after sustained failure; if you run your own, you need the same three behaviours and a notification, on another channel, telling the customer their endpoint is down.
- **In-app.** The feedback is the read receipt. Store it on the notification, not the delivery, because one notification can be shown on several devices.

Provider callbacks find their delivery row, or the members of their batch, through `provider_ref`, which is why the row keeps the provider's message id; read receipts update the notification and dead tokens update the device record. When support asks "did Maria get the shipping email," the answer is a query, not a search through three dashboards.

## Rendering: one event, five templates

Each channel renders the same event differently, and the differences are not cosmetic. An in-app row is a sentence and a link. A push is a title and a body of a hundred characters with a deep link. An email is a full document with a plain-text alternative. A webhook is a JSON body with a schema version. A digest email is a list of events rendered by a different template than the single-event one.

Keep the templates keyed by (kind, channel, locale) and render them at send time from the event payload, so a template fix applies to queued deliveries too. Put the user's locale and time zone on the notification when it is created, because the user may travel before the digest closes and you want the summary in the zone they set, not the one they are in. Links in email and push should carry a signed, single-purpose token that lands the user on the right object without a full login when the product allows it, and that token should expire; a delivery record tells you when it was sent, which is the right anchor for the expiry.

## When to stop building

Everything above is a few tables, two workers and a scheduler. The parts that consume months are the ones with a user interface and a long tail of providers:

- A **preference center** users can understand, with categories, per-channel toggles, digest choices and quiet hours, embedded in your product with your look.
- **Workflow authoring** for product managers: "send in-app now, wait two hours, email if unread, escalate to SMS for billing failures," without a deploy per change.
- **Provider adapters** for every regional SMS gateway, every push platform variant, Slack, Teams and chat channels, each with their own rate limits and error semantics.
- **Delivery logs and analytics** someone other than an engineer can read.

That is the product the notification platforms sell. Knock's model is workflows with a preference set evaluated at run time and per-tenant overrides; Novu is open source with the digest step described above; Courier covers similar ground. What they abstract is the orchestration and the adapters. What they do not abstract is your event contract, your idea of who should be told, and the outbox that ties a delivery back to a business fact in your own database. Build those regardless, then decide.

A reasonable rule: with one or two channels and no preference UI, build it all; the outbox is the hard part and you already have it. Past three channels, or the day a preference center appears on the roadmap, price the platform against the engineer-months, and remember that the platform's per-notification fee scales with exactly the fan-out factor that made this hard.

## A checklist

- Three tables, three nouns: events, notifications (or a deliveries table that implies them), deliveries.
- `(event_id, user_id, channel)` is the primary key of a delivery and the idempotency key for an immediate send; a digest uses its batch key.
- Fan-out rows are written in the same transaction as the event.
- Preferences are evaluated at send time, with defaults per kind and channel and overrides per user and per tenant.
- Digests are keyed by (user, kind, channel, window); in-app is before the digest step, email is after.
- Every provider callback updates a delivery row and, when it is a bounce, complaint or dead token, a suppression or preference.
- Templates are keyed by (kind, channel, locale) and rendered at send time.
- The deliveries table is partitioned or archived before it becomes the biggest table you own.
- A customer-facing webhook channel gets signing, retries, an attempt log and endpoint disabling, whether you write them or use a service.
