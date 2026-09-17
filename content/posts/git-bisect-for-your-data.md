---
title: 'Git Bisect for Your Data'
excerpt: 'You know the number is wrong today. Nobody knows when it started. git bisect answers that question for code by checking out old commits; the same search works on a database if you can read it as it was at an arbitrary moment. Here is a CLI that does it, measured against a real Postgres, and the one limit that decides whether it can help you at all.'
category:
  name: 'Cloud'
  slug: 'cloud'
date: '2026-09-17'
publishedAt: '2026-09-17T14:00:00Z'
updatedAt: '2026-09-17T14:00:00Z'
readingTime: '11 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Postgres
  - Neon
  - Debugging
  - Databases
  - Data Quality
---

Somebody notices the revenue number is wrong. Not catastrophically wrong, which would have been easier, just wrong enough that the finance export does not reconcile. Nobody knows when it started.

The next hour is familiar. You query the table sorted by `created_at`, if the table has one, and if the bug happened to touch it. You scroll through deploys looking for one that sounds plausible. You ask in Slack whether anyone changed anything on Tuesday.

For code we stopped doing this a long time ago. `git bisect` takes a commit where things worked, a commit where they did not, and finds the one that broke it in a handful of steps. Nobody scrolls through `git log` guessing any more.

The reason we still guess about data is that the search needs one thing a database does not usually give you: the ability to ask what the data looked like at an arbitrary moment. Not a backup from 3am. Any moment.

## TLDR

- **A bisect over time needs `parent_timestamp`, not a backup.** Branch the database as it was at a moment, run one query, throw the branch away.
- **One probe cost 1.7 seconds** against a real Neon project: 843 ms to create the branch, 837 ms to connect and query.
- **A 24 hour window at one minute precision is about 13 probes**, so roughly 20 seconds, against 1,440 for a scan.
- **The real run narrowed 12.5 minutes to a 47 second window in 6 probes and 14.2 seconds**, and the answer was checked against ground truth rather than believed.
- **The limit that decides everything: you cannot look further back than your history retention window.** 24 hours by default. If your data broke last week, this cannot help you, and the tool says so instead of guessing.
- Two ways a bisect lies: the range is already bad at the start, and the value broke more than once. Both are handled explicitly, because both produce a confident wrong answer otherwise.

## Prerequisites

- A Postgres with branch-at-a-timestamp. The tool here targets Neon because that is where `parent_timestamp` is a first-class API, but the idea transfers to anything that can reconstruct a past state cheaply.
- Node 20 or newer.
- A Neon API key, from the console under Account settings.

## What makes this possible

The expensive part of "show me the database as it was at 10:24" is normally the copy. Restoring a backup to answer one question is a job, not a command.

On Neon a branch is not a copy. Storage is separated from compute, and the storage layer already keeps the WAL for the retention window, so reconstructing a past state is a bookkeeping operation rather than a data movement one. You get a connection string to a database that holds exactly what yours held at that moment.

```bash
curl -X POST "$API/projects/$PROJECT/branches" \
  -H "Authorization: Bearer $NEON_API_KEY" \
  -d '{
    "branch": {
      "parent_id": "br-your-main",
      "parent_timestamp": "2026-09-17T10:24:00Z"
    },
    "endpoints": [{ "type": "read_write" }]
  }'
```

That is the whole primitive. Everything below is a binary search wrapped around it.

## What it costs, measured

Before writing a tool on top of this I wanted to know whether one probe costs one second or thirty, because that is the difference between a usable tool and a party trick.

Measured against a Neon project in `eu-central-1`, Postgres 18, from a client roughly 45 ms of round trip away:

```terminal
{
  "title": "one probe",
  "prompt": "$",
  "steps": [
    { "comment": "create a branch at a timestamp one hour ago" },
    { "cmd": "time curl -X POST .../branches -d '{\"branch\":{\"parent_timestamp\":\"...\"}}'", "output": "HTTP 201   wall 843 ms" },
    { "comment": "connect to it and run a query" },
    { "cmd": "node probe.mjs", "output": "connect+query: 837 ms\nserver says now() = 2026-09-17T10:10:59.104Z  pg 18.6" }
  ]
}
```

**About 1.7 seconds per probe.** A binary search over a 24 hour window to one-minute precision is 13 probes, so **roughly 20 seconds** to answer "when did this break". The same window scanned minute by minute would be 1,440 probes, or about forty minutes.

That is the number that decides the whole idea. At 1.7 seconds this is a tool. At 30 seconds a probe it would be a blog post about a nice idea.

## The tool

```bash
git clone https://github.com/The-DevOps-Daily/pg-timemachine
cd pg-timemachine && npm install
export NEON_API_KEY=...
```

```bash
pg-timemachine bisect \
  --project my-project \
  --branch  br-my-main \
  --query   "select count(*) from orders where total_cents < 0" \
  --expect-good 0 \
  --since -6h
```

The query has to return **exactly one row with one column**. That restriction is the most important design decision in the thing, and it is worth saying why: a bisect built on an ambiguous verdict does not fail, it returns a confident wrong answer. Two rows, or two columns, and the tool refuses rather than picking one.

## A bug worth finding

To test it on something real I seeded a scenario rather than an assertion. `demo/seed.mjs` writes orders steadily, twenty a minute. Eight minutes in, a "bad deploy" starts applying a loyalty discount without a floor, so roughly one order in six lands with a negative total.

That shape matters. The table is never obviously broken. The bad rows are a minority and each one looks like an ordinary row. This is what survives code review and a smoke test, and it is why nobody notices until the month-end export.

The seeder prints the exact moment the first bad row appeared, which is the point: the bisect's answer can then be **checked**, not believed.

```
seeded 280 orders, 24 of them negative
ground truth, the first bad row: 2026-09-17T10:24:08.719Z
window seeded: 2026-09-17T10:16:08.339Z -> 2026-09-17T10:29:09.049Z
```

## The search

```terminal
{
  "title": "pg-timemachine bisect",
  "prompt": "$",
  "steps": [
    { "cmd": "pg-timemachine bisect --query \"select count(*) from orders where total_cents < 0\" --expect-good 0 --since 10:16:30Z --until 10:29:00Z", "output": "pg-timemachine bisect\n  range      2026-09-17T10:16:30.000Z -> 2026-09-17T10:29:00.000Z  (12m 30s)\n  precision  1m\n  retention  1d\n  query      select count(*) from orders where total_cents < 0\n  expecting  good = 0\n  about 6 probes, one branch each\n\n  good  2026-09-17T10:16:30.000Z         0  2313ms\n   bad  2026-09-17T10:29:00.000Z        20  1811ms\n  good  2026-09-17T10:22:45.000Z         0  1811ms\n   bad  2026-09-17T10:25:52.500Z         8  2164ms\n   bad  2026-09-17T10:24:18.750Z         4  1810ms\n  good  2026-09-17T10:23:31.875Z         0  2366ms\n\nFound it.\n  last good   2026-09-17T10:23:31.875Z\n  first bad   2026-09-17T10:24:18.750Z\n  window      47s\n\n  6 probes in 14.2s" }
  ]
}
```

Ground truth was `10:24:08.719Z`. The reported window is `10:23:31.875Z` to `10:24:18.750Z`. **The real answer sits inside it.**

Twelve and a half minutes narrowed to 47 seconds, in six probes and fourteen seconds. It predicted six probes before starting and used six.

The count column is worth reading on its own:

```
0, 20, 0, 8, 4, 0
```

That is not noise, it is the corruption spreading through the table, sampled at the moments the search happened to care about. Each of those numbers came from a real database that existed for about two seconds and was then deleted.

## The limit that decides whether this helps you

**You cannot look further back than your history retention window.**

On Neon that is `history_retention_seconds`. The default on most plans is 24 hours. If your revenue number broke nine days ago and you keep a day of history, no tool built on this primitive can help you, because the information is gone.

This is the first thing the post should say rather than the last, so the tool says it too:

```
This project keeps 1d of history, so the earliest moment it can reconstruct is
2026-09-16T10:35:50.191Z. You asked for 2026-09-10T00:00:00.000Z. Raise
history_retention_seconds on the project for next time; the data for this
window is already gone.
```

It reads the project's retention before the first probe and refuses a range it cannot answer. The alternative is a confusing API error partway through a search that was never going to work.

**The practical advice is unglamorous: raise your retention now.** Retention costs storage, and storage is cheap next to an afternoon of five people guessing which deploy broke the export. Neon lets you set it per project, up to 30 days on paid plans. Pick a number that covers the gap between a bug shipping and someone noticing, which in my experience is longer than anyone admits.

## Two ways a bisect lies

`git bisect` assumes the answer changes exactly once across the range. So does this. Data does not always oblige, and both failure modes produce a confident wrong answer rather than an error, which is the dangerous kind of bug for a debugging tool to have.

### The range is already bad at the start

If the breakage predates your range, every midpoint is bad, and a naive binary search converges on the very first moment and reports it as the transition. You get a precise, plausible, completely wrong timestamp, and you go and read the deploy log for the wrong hour.

So the endpoints are probed first, before any searching:

```js
const first = await probe(since);
if (first.verdict === "bad") {
  return {
    outcome: "bad_at_start",
    message: "The query was already failing at the start of the range. " +
             "Whatever broke, broke before this point.",
  };
}
```

Given a 24 hour retention window, this is the answer a lot of people will get. It had better be honest.

### It broke, was fixed, and broke again

A bisect over a value that broke at 10:00, was fixed at 11:00, and broke again at 14:00 will confidently return one of those transitions and say nothing about the others. Which one depends on where the midpoints land, which is to say: chance.

There is no way to make binary search see this, because seeing it requires the linear scan the search exists to avoid. What you can do is check the assumption cheaply, by sampling:

```bash
pg-timemachine check --query "..." --expect-good 0 --since -6h --samples 8
```

```
  good  10:16:30Z  0        good  10:23:38Z  0
  good  10:18:17Z  0         bad  10:25:25Z  8
  good  10:20:04Z  0         bad  10:27:12Z  16
  good  10:21:51Z  0         bad  10:29:00Z  20

Monotonic. The verdict changes at most once across the samples,
so a bisect result is meaningful.
```

Eight probes, about fourteen seconds, and now the bisect result means something. When it is not monotonic it says so and names the transitions it saw.

## Looking at one moment

The same primitive answers a smaller question: what did this look like then?

```terminal
{
  "title": "before and after",
  "prompt": "$",
  "steps": [
    { "cmd": "pg-timemachine at --query \"select count(*) as orders, sum(total_cents) as revenue_cents from orders\" --at 2026-09-17T10:22:00Z", "output": "orders\trevenue_cents\n120\t617078" },
    { "cmd": "pg-timemachine at --query \"...\" --at 2026-09-17T10:29:00Z", "output": "orders\trevenue_cents\n260\t1277680" }
  ]
}
```

140 more orders brought in 660,602 cents. An average of **4,719** against the **5,142** the first 120 averaged, a drop of about 8%.

That is the number nobody notices. It is not a spike, it is not an error rate, it is a slightly worse average buried in a growing total. On a dashboard the revenue line keeps going up.

## Notes from building it

**The search has no database in it.** `bisect.mjs` takes a `probe` callback and knows nothing about Postgres or HTTP, which is why all 37 tests run in under a second without creating a single branch. The cases worth testing are exactly the dishonest answers described above, and testing those against a real database would be slow, expensive and flaky.

**Interrupts leak money.** A `finally` cleans up the branch when a probe returns or throws. Ctrl-C does neither: it ends the process, and the branch stays. That is a compute you are paying for until somebody notices. Live branches are tracked and removed by a signal handler, and there is a `sweep` command for whatever still slips through.

**Everything needs a timeout.** `pg` waits for ever by default. One unreachable compute would stall the whole search with a branch live the entire time, so connect and query are bounded, with a matching `statement_timeout` so a slow query is cancelled server-side rather than left running on a branch that is about to be deleted.

```github
https://github.com/The-DevOps-Daily/pg-timemachine
```

## What to do with this

- **Raise `history_retention_seconds` before you need it.** This is the whole ballgame. Everything else here is a convenience; retention is the difference between a question you can answer and one you cannot.
- **Write the query that would have caught it.** `select count(*) from orders where total_cents < 0` is a data quality check as much as a bisect predicate. If you have the query, run it on a schedule and the bisect becomes unnecessary.
- **Check monotonicity before trusting a bisect**, on anything that has been deployed to more than once in the window.
- **Remember that it tells you when, not what.** That is usually enough. A timestamp points at a deploy, a migration or a cron run, and from there you know what to read.

## Summary

`git bisect` is not a clever algorithm. It is binary search, and the reason it changed how we debug code is that Git made "check out an arbitrary past state" cheap enough to do fifteen times in a row.

Databases are getting that same property, and the interesting consequence is not time travel for its own sake. It is that a whole class of question we answer by guesswork becomes a search you can run in the time it takes to read the Slack thread asking about it.

Twelve and a half minutes to 47 seconds, in fourteen seconds of wall clock. The limit is not the search. It is how much history you kept.
