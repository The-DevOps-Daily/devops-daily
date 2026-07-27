---
title: 'What Sending a Developer Newsletter Actually Takes'
excerpt: 'A newsletter looks like a for-loop over an address list. It is not. Here is the infrastructure behind the DevOps Daily newsletter: sending domain and DNS, bounce and complaint handling, one-click unsubscribe, idempotent scheduling, and the Message-ID that makes any of it debuggable.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-07-27'
publishedAt: '2026-07-27T09:00:00Z'
updatedAt: '2026-07-27T09:00:00Z'
readingTime: '13 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - DevOps
  - Email
  - SMTP
  - Deliverability
  - Postgres
---

Sending a newsletter looks like the simplest job in the world. You have a list of addresses, you have some HTML, you loop.

Then you send the first one, and you find out that the loop is the only part of the problem that does not matter.

What matters is everything around it. Whether mailbox providers believe you are who you say you are. What happens to the 40 addresses that bounce. How someone gets off the list in one click at 2am without emailing you. What happens when the cron job fires twice because a deploy restarted the worker mid-run.

This is how the DevOps Daily newsletter actually goes out. It is not a vendor comparison and not a tutorial for something you have to buy. The mechanics are the same whether you are on SES directly, on a provider, or on a mail server you run yourself, and most of them are things you want in place before your first send rather than after your first bad one.

## TLDR

- The address list is the easy part. Reputation, list hygiene, and idempotency are the hard parts.
- Get SPF, DKIM and DMARC right before your first send, not after your first spam-folder complaint.
- Hard bounces and complaints must feed back into a suppression list automatically, and that list must be checked on every send.
- `List-Unsubscribe` with one-click support is not optional at any real volume.
- Store the RFC 5322 `Message-ID`. It is the only identifier that ties your logs to a recipient's mail server.
- Make the send idempotent. Cron fires twice more often than you think.

## Prerequisites

- A domain you control the DNS for
- Basic familiarity with SPF, DKIM and DMARC as concepts
- A database you can put a suppression table in
- Somewhere to run a scheduled job

## The shape of the problem

```diagram
{
  "type": "flow",
  "title": "What one newsletter send actually involves",
  "nodes": [
    { "label": "Build the issue from published content", "icon": "box" },
    { "label": "Resolve the audience, minus suppressions", "icon": "database" },
    { "label": "Render per-recipient (unsubscribe token, personalisation)", "icon": "gear" },
    { "label": "Hand each message to the sending backend", "icon": "rocket" },
    { "label": "Ingest bounce and complaint webhooks", "icon": "activity" },
    { "label": "Feed failures back into suppression", "icon": "shield" }
  ]
}
```

Only the fourth box is the for-loop. The rest is where the work lives, and where every bug that damages your sender reputation comes from.

## Sending domain and DNS

Mailbox providers do not know you. They know your domain's history and whether your DNS backs up your claims. Three records do that work.

**SPF** says which servers may send for your domain. It is a TXT record on the domain itself:

```text
v=spf1 include:amazonses.com -all
```

The `-all` at the end is a hard fail: anything not covered by the includes should be rejected. Plenty of guides suggest `~all` (soft fail) to be safe. Prefer `-all` once you are confident your includes are complete, because a soft fail tells receivers to accept mail you did not authorise.

**DKIM** cryptographically signs each message so a receiver can verify it was not altered in transit and that it came from someone holding your key. Your provider gives you the public keys to publish as CNAMEs or TXT records.

**DMARC** ties the two together and tells receivers what to do when neither passes:

```text
v=DMARC1; p=reject; rua=mailto:dmarc-reports@example.com
```

Start at `p=none` while you read the aggregate reports, then move to `quarantine`, then `reject`. Sitting on `p=none` forever is the common failure: it means you have the reporting but none of the protection, and anyone can spoof your domain.

:::warning
A DMARC pass requires **alignment**, not just an SPF or DKIM pass. The domain in the `From:` header has to line up with the domain that SPF or DKIM authenticated. Sending as `news@yourdomain.com` through a provider that signs as `provider.net` will pass DKIM and still fail DMARC. This is the single most common reason a technically correct setup lands in spam.
:::

## The audience is a query, not a list

The moment you store your subscribers in a file, you have already lost. The audience is the result of a query, and the important part of that query is what it excludes.

```sql
SELECT c.email, c.first_name
  FROM contacts c
  LEFT JOIN suppressions s
    ON s.email = c.email
   AND s.team_id = c.team_id
 WHERE c.subscribed = true
   AND s.id IS NULL;
```

Two details in that join are worth dwelling on.

First, the suppression check is part of the query that builds the audience, not a filter applied later in application code. If it is a later step, some future code path will skip it.

Second, the join is scoped. If your system has any notion of multiple owners (teams, workspaces, projects), the suppression list belongs to one of them, and matching on email alone will either leak one tenant's unsubscribes into another's list or silently fail to apply them. We got this wrong: our suppression uniqueness was keyed on the user rather than the owning team, so a second team's unsubscribes could quietly land against the first team's rows and never take effect. The fix was a unique key on `(team_id, email)` instead of `(user_id, email)`. Worth checking in your own schema, because the symptom is invisible until someone who unsubscribed tells you they are still receiving mail.

## Bounces and complaints have to close the loop

A **hard bounce** means the address does not exist. A **complaint** means someone hit "report spam". Both are signals mailbox providers watch closely. Continuing to send to either is the fastest way to poison a sending domain.

Your provider will deliver these as webhooks. The job of that webhook handler is short and unglamorous:

```diagram
{
  "type": "loop",
  "title": "The feedback loop that protects your domain",
  "nodes": [
    { "label": "Provider posts a bounce or complaint webhook", "icon": "net" },
    { "label": "Verify the signature, look up the message", "icon": "lock" },
    { "label": "Write a suppression row for that address", "icon": "database" },
    { "label": "Next send's audience query excludes it automatically", "icon": "check" }
  ]
}
```

Two rules that are easy to get wrong:

- **Suppress hard bounces, not soft ones.** A full mailbox or a temporary server failure is a soft bounce and will often deliver next time. Suppressing on soft bounces will shrink your list for no reason.
- **Suppress every complaint, permanently.** Someone who marked you as spam is never a re-engagement opportunity. Treat it as final.

Keep the diagnostic code from the bounce alongside the suppression row. When a domain starts rejecting you in bulk, the SMTP status text is the only thing that tells you why.

## One-click unsubscribe

Gmail and Yahoo require one-click unsubscribe for bulk senders. Beyond compliance, it is the single best protection you have: a reader who cannot find the unsubscribe link will use the spam button instead, and that costs you far more.

Two headers:

```text
List-Unsubscribe: <https://example.com/api/unsubscribe?t=SIGNED_TOKEN>, <mailto:unsubscribe@example.com>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
```

The token needs to be signed, not a raw contact id. An HMAC over the recipient and list, with your server-side secret:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

export function unsubscribeToken(email: string, listId: string): string {
  return createHmac("sha256", process.env.UNSUBSCRIBE_SECRET!)
    .update(`${email}:${listId}`)
    .digest("base64url");
}

export function verifyUnsubscribeToken(
  email: string,
  listId: string,
  token: string,
): boolean {
  const expected = Buffer.from(unsubscribeToken(email, listId));
  const given = Buffer.from(token);
  // Length check first: timingSafeEqual throws on a length mismatch.
  return expected.length === given.length && timingSafeEqual(expected, given);
}
```

Without the signature, anyone can enumerate ids and unsubscribe your entire list. With it, the token is useless for any address but the one it was minted for.

:::important
`List-Unsubscribe-Post` means mailbox providers will send a **POST** to that URL with no human involved, including for spam-filter probing. The endpoint must be idempotent, must not require a session, and must not render a confirmation page as its only action. Unsubscribe on the POST itself.
:::

## Store the Message-ID

Every message you send gets an RFC 5322 `Message-ID` header. It looks like this:

```text
Message-ID: <9f2c1e7a-4c3b-4a2f-9d61-8f0b7c2a1d55@yourdomain.com>
```

Most senders generate one, put it on the wire, and throw the value away. That is a mistake you notice the first time a reader forwards you a bounce message from their IT department, or your provider asks which message a complaint refers to. The `Message-ID` is the identifier that both sides can see. Your internal database id is not.

Generate it on your own domain, store it against the send record, and index it:

```ts
import { randomUUID } from "node:crypto";

function generateMessageId(fromDomain: string): string {
  return `<${randomUUID()}@${fromDomain}>`;
}
```

Using your own domain rather than the provider's matters: if you change sending backends later, historical ids stay meaningful and stay yours.

## Make the send idempotent

Scheduled jobs fire twice. A deploy restarts a worker mid-run, a retry policy is more aggressive than you remembered, someone runs the job by hand to test it. If a double fire means a double send, you will find out from your readers.

The fix is a uniqueness constraint, not a careful code path:

```sql
CREATE UNIQUE INDEX newsletter_issue_recipient_key
    ON newsletter_deliveries (issue_id, contact_id);
```

Insert the delivery row first, then send. If the insert violates the constraint, that recipient already got this issue and the job moves on. The database enforces "once per recipient per issue" whatever your application code does.

```terminal
{
  "title": "sending an issue",
  "prompt": "$",
  "steps": [
    { "comment": "dry run first: resolve the audience without sending" },
    { "cmd": "newsletter send --issue 2026-07-27 --dry-run", "output": "audience: 4812 contacts\nsuppressed: 137 (94 hard bounce, 43 complaint)\nto send: 4675" },
    { "comment": "same command, for real" },
    { "cmd": "newsletter send --issue 2026-07-27", "output": "queued 4675 messages in 12.4s" },
    { "comment": "run it again by accident" },
    { "cmd": "newsletter send --issue 2026-07-27", "output": "queued 0 messages (4675 already delivered)" }
  ]
}
```

That last line is the whole point. The safety is structural.

## Warm up, then watch

A domain with no sending history that suddenly emits several thousand messages looks exactly like a compromised account. Ramp instead: a few hundred on the first send, roughly double each time, and watch the bounce and complaint rates before increasing again.

The numbers worth alerting on, from Google's published Postmaster thresholds and general industry practice:

| Signal | Healthy | Investigate | Emergency |
|---|---|---|---|
| Hard bounce rate | under 2% | 2-5% | over 5% |
| Complaint rate | under 0.1% | 0.1-0.3% | over 0.3% |
| Delivery rate | over 98% | 95-98% | under 95% |

The complaint number is the one people misread, because of how small it is:

```chart
{
  "type": "bar",
  "title": "Complaints on a 5,000-address send",
  "unit": " people",
  "caption": "Google Postmaster Tools treats a 0.3% complaint rate as the point where throttling starts. On a 5,000-address list that is 15 people.",
  "rows": [
    { "label": "Healthy (0.1%)", "value": 5, "series": "ok" },
    { "label": "Investigate (0.3%)", "value": 15, "series": "warn" },
    { "label": "Throttled (0.5%)", "value": 25, "series": "bad" }
  ],
  "series": [
    { "name": "ok", "color": "#10b981" },
    { "name": "warn", "color": "#f59e0b" },
    { "name": "bad", "color": "#ef4444" }
  ]
}
```

Fifteen people out of five thousand hitting "report spam" is the difference between fine and throttled. That is the entire argument for making the unsubscribe link easy to find: every reader who cannot find it has exactly one other button available, and it is far more expensive to you.

## The setup behind this newsletter

Concretely, for the DevOps Daily newsletter:

- **Content** comes out of the same repo the site is built from. An issue is assembled from posts published since the last send, so there is no separate copy to keep in sync.
- **Sending** goes through [smtpfast](https://smtpfa.st), with SES underneath it. The parts we care about are the ones above: bounce and complaint webhooks that write suppressions, `List-Unsubscribe` handled at the API level, and a stored `Message-ID` per message.
- **Contacts and suppressions** live in Postgres, because the audience is a join and the suppression list needs a unique constraint doing real work.
- **Scheduling** is a cron job with the uniqueness constraint above as its safety net, not a carefully written script.

The interesting thing about that list is how little of it is about sending. One bullet moves the bytes. The rest is bookkeeping that decides whether the bytes arrive.

## What this adds up to

None of the individual pieces are difficult. The reason "just send an email" turns into a project is that the pieces are load-bearing in a way that is invisible until one fails:

- DNS you got right months ago is what makes today's send land.
- The suppression join is what stops a bounce from becoming a blocklisting.
- The signed token is what stops your list from being emptied by a script.
- The unique index is what stops a retried cron job from mailing everyone twice.
- The stored `Message-ID` is what lets you answer "what happened to this message" at all.

If you are building this yourself, build the feedback loop before you build the templates. Pretty emails that quietly destroy your sender reputation are worth considerably less than plain ones that keep landing in the inbox.

If you want the [full SMTP conversation](/posts/send-an-email-by-hand-raw-smtp) underneath all of this, we typed one out by hand byte by byte, which is a good way to understand what every email API is doing on your behalf.
