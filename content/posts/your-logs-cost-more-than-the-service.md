---
title: 'Your Logs Cost More Than the Service That Emits Them'
excerpt: 'Log ingestion is priced per gigabyte and indexing is priced per event, which means a service emitting small lines pays far more than its byte count suggests. Here is the arithmetic on a real server, why the usual advice to "log less" misses, and the five levers that actually move the bill.'
category:
  name: 'FinOps'
  slug: 'finops'
date: '2026-09-19'
publishedAt: '2026-09-19T10:00:00Z'
updatedAt: '2026-09-19T10:00:00Z'
readingTime: '13 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - FinOps
  - Observability
  - Logging
  - Monitoring
  - Cost Optimization
---

There is a moment in the life of most engineering teams when somebody in finance asks why the observability bill is larger than the compute bill for the thing being observed.

The usual answer is "we log too much", followed by a sprint of deleting debug statements, followed by the bill not moving very much.

The reason it does not move is often that the team is optimising the wrong unit. **On the event-priced platforms, ingestion is charged by the gigabyte and indexing by the event.** Those two pull in completely different directions, and which one dominates depends on a property of your logs nobody looks at: the average line length.

That model is Datadog's, and the arithmetic below uses its published prices. It is not the only model. Grafana Cloud Logs prices ingestion and retention by volume, and some Splunk plans bill by ingest or by workload, and on those a smaller log line is a smaller bill. **Check which one you are on before acting on any of this**, because the right move is the opposite depending on the answer.

## TLDR

- **On Datadog, ingestion is per GB and indexing is per event**: `$0.10` per ingested GB against `$1.70` per million indexed events. **This is not universal.** Grafana Cloud and some Splunk plans price by volume throughout, where trimming bytes does help.
- A real server measured for this post averages **209 bytes per log line**. At that size, one gibibyte is **5.14 million events**.
- So that gibibyte costs **`$0.10` to ingest and `$8.75` to index**. **Indexing is about 87 times the ingestion cost**, and the ingestion number is the one people quote.
- **Shortening log lines makes this worse**, not better: same number of events, fewer gigabytes, and you optimised the cheap half.
- The lever that matters is **event count**: aggregate before shipping, sample the boring paths, and route the rest to storage you search rarely.

## Prerequisites

- A service that produces logs and a bill that mentions them.
- Access to the raw log files, or to the platform's usage breakdown. You need bytes **and** line counts.

## The measurement

One small DigitalOcean droplet. Seven applications, an email service, a quiz API, two smaller apps and their background workers, behind nginx.

```terminal
{
  "title": "what one small server emits in a day",
  "prompt": "$",
  "steps": [
    { "comment": "nginx access log, since the last rotation" },
    { "cmd": "stat -c%s /var/log/nginx/access.log && wc -l < /var/log/nginx/access.log",
      "output": "7167642\n34341" },
    { "comment": "window covered by those lines" },
    { "cmd": "head -1 access.log; tail -1 access.log",
      "output": "18/Sep/2026:00:00:07\n18/Sep/2026:21:44:54" },
    { "comment": "size of every log file touched in the last 24h (an upper bound, not bytes written)" },
    { "cmd": "find /var/log ~/.pm2/logs -type f -newermt '-24 hours' | xargs du -cb | tail -1",
      "output": "643,000,000  total" }
  ]
}
```

Three numbers come out of that, and the third is the one that matters:

- **about 640 MB of log files touched in 24 hours.** That is an upper bound rather than a measurement of bytes written, because it is the current size of every file modified in the window. Good enough for order of magnitude, which is all it is used for here.
- **37,894 requests a day**, extrapolated from 34,341 lines in 21 hours 45 minutes
- **208.72 bytes per line**, which is just `7167642 / 34341`. Rounded to 209 below.

That last one is the whole article, and it is the only one of the three that is measured exactly.

## The arithmetic

Datadog's published list prices, as of September 2026: **`$0.10` per ingested or scanned GB per month**, and **`$1.70` per million log events per month** at 15-day retention, billed annually. On-demand indexing is `$2.55`.

Now take one gibibyte of logs that look like the ones above. Units matter here: a decimal GB gives 4.81 million events and `$8.17`, so the ratio moves between 82 and 87 depending on the convention. Neither changes the argument.

```chart
{
  "type": "bar",
  "title": "Cost of one gibibyte of 209-byte log lines",
  "unit": "$",
  "caption": "Datadog list prices, September 2026: $0.10 per ingested GB; $1.70 per million indexed events at 15-day retention, billed annually. 1 GiB at 209 bytes per line is 5.14 million events. Binary units throughout.",
  "rows": [
    { "label": "Ingest 1 GiB", "value": 0.1, "series": "Ingestion" },
    { "label": "Index the same GiB", "value": 8.75, "series": "Indexing" }
  ],
  "series": [
    { "name": "Ingestion", "color": "#0080ff" },
    { "name": "Indexing", "color": "#f59e0b" }
  ]
}
```

**One gibibyte. Ten cents to ingest, eight dollars and seventy-five cents to index.**

It falls out of the pricing model: when you are billed per event, the cost of a gigabyte is set by how many lines it was cut into. A gibibyte of 209-byte access logs is 5.14 million billable events. The same gibibyte as 20 KiB stack traces is about 52,400 events, and costs about nine cents to index.

**The same data volume, at a 98-fold difference in indexing cost, decided entirely by line length.**

## Why "log less" does not work

The instinct is to make logs smaller. Trim the JSON, drop a few fields, shorten the message.

Look at what that does:

| change | GB ingested | events indexed | ingestion cost | indexing cost |
|---|---|---|---|---|
| baseline, 209 B/line | 1.00 | 5.14M | `$0.10` | `$8.75` |
| halve the line length | 0.50 | 5.14M | `$0.05` | `$8.75` |
| halve the number of lines | 0.50 | 2.57M | `$0.05` | `$4.37` |

Halving the size of every log line saves **five cents**. Halving the number of lines saves **four dollars and thirty-seven cents**.

A sprint spent making log lines terser is a sprint spent on the cheap half of the bill. It also makes the remaining logs worse to read, which is a real cost that never shows up anywhere.

## The five levers that do work

### 1. Use the cost controls you are already paying for

Before buying anything, check what your existing platform can already drop.

Datadog has index exclusion filters: logs are ingested and archived, and you choose which ones get the expensive indexing. A filter that excludes `status:ok` access logs from indexing removes the `$1.70`-per-million charge while keeping the data available to rehydrate.

That is the cheapest fix available, it takes an afternoon, and it needs no new vendor, no new agent and no new pipeline to operate. **If the numbers above are right about your estate, this alone is most of the saving.** Everything below is what you do when you have already done this and still need more.

### 2. Aggregate before shipping, not after

The single biggest source of event count in most systems is the access log: one event per request, forever, for requests that were fine.

A health check every ten seconds from four monitors is **1.04 million events a month**, about `$1.76` to index, for lines that say `200` and will never be read. Over a year that is 12.6 million events from four monitors doing nothing.

The fix is not to stop logging them. It is to count them where they are produced and ship the count: one event a minute carrying "24 checks, all 200, p95 14ms" instead of 24 events. On a busy endpoint serving 3,600 requests a minute the same trade is 3,600 events down to one.

Be honest about what that costs you, though. A count is not a request. You lose the individual identifiers, the ordering, and the full latency distribution, and you cannot go back and ask a question the summary did not anticipate. That is a fine trade for health checks and a bad one for payments.

This is the core of what an **observability pipeline** does, and the category exists because of this exact arithmetic: **Cribl Stream**, **Edge Delta** and **Mezmo** sit between the emitters and the platform, aggregating, dropping and reshaping before the data reaches the thing charging per event. Edge Delta does more of it at the agent, before it crosses the network at all.

**They are not free, and the saving is a net number.** Cribl charges for the data it processes; all three need hosting, or a subscription, and somebody to own the config. Run the arithmetic on what you would still be billed downstream, plus the pipeline, plus the engineering time, against what you pay now. If your problem is one noisy service, an exclusion filter is cheaper than a platform.

You can also build a first cut yourself, and for a small estate you probably should. A Vector or Fluent Bit config that aggregates access logs and forwards only the summary is an afternoon of work, and it tells you whether the saving is real before you buy anything.

### 3. Sample the paths that are boring, keep the ones that are not

Not all events deserve equal treatment, and the deciding factor is usually the status code.

A defensible default:

- **Keep every 4xx and 5xx.** These are the ones you will search for.
- **Keep every request from a traced or flagged session.**
- **Sample successful requests** at 1 in 100, or 1 in 1000 for high-traffic read paths.

Uniform sampling is the weaker default: it discards errors at the same rate as successes, so the rare events you most want are the ones most likely to be missing. Status-aware sampling keeps them.

It is not free either. A sampled success log cannot answer "what did this specific user see at 14:02", and a `200` can still hide an application-level failure or something a security review will want. Sample the paths where you are confident the aggregate is enough, not everything that returned 200.

### 4. Split retention from indexing

Most platforms now separate "searchable immediately" from "stored and searchable slowly". Datadog's Flex Storage is **`$0.05` per million events stored** against `$1.70` per million indexed.

Read that carefully before quoting the ratio: the storage charge **recurs for each 30 days retained**, there is a 30-day minimum, and query compute is billed separately. Six months of retention is around `$0.30` per million in storage alone, before anyone runs a search. It is still far cheaper than indexing; it is not 34 times cheaper in total.

Almost nothing needs 15-day hot indexing. The honest retention policy for most teams is:

- **Hot, indexed, days:** errors, auth events, payments, anything an on-call engineer greps at 3am.
- **Cold, stored, months:** everything else, searchable slowly when an audit or an incident review needs it.

Getting that split right is usually a bigger saving than any amount of volume reduction, and it costs nothing in signal.

### 5. Find out what you are actually paying per service

The reason this persists is that the bill arrives as one number and the logs arrive from forty services.

Until you can say "the payments service costs `$400` a month in logs and the image resizer costs `$3,000`", every conversation about it is guesswork. Most platforms can break usage down by tag; the work is making sure everything is tagged by service in the first place.

**The result is almost always surprising**, and it is almost always one or two services producing most of the events. Those are the ones to fix. The other thirty-eight do not matter and should be left alone.

## What this does not mean

**It does not mean logs are a waste of money.** An incident where nobody can see what happened costs more than a year of the bill. The argument is about paying for signal rather than volume.

**And shortening log lines is not useless**, it is just badly targeted. The table above shows it saving five cents where cutting event count saves four dollars. If you are on a volume-priced platform, that ordering reverses.

**It does not mean self-hosting is cheaper.** Running Loki or OpenSearch moves the cost from an invoice to a team. That can work out well at scale and badly at small scale, and the failure mode is that the cost stops being visible rather than stops existing. Do it because you want the control, not because you compared a licence to a server and stopped there.

**And the numbers here are one server.** 613 MB a day is not a large estate; it is a droplet. The point is the ratio, which does not change with scale: at a hundred times the volume, the indexing line is still roughly 88 times the ingestion line, and it is still the one nobody is looking at.

## Summary

Log bills are confusing because the visible number, gigabytes, is not the expensive number.

- Measure **bytes and line count**. The ratio between them tells you which half of your bill is real.
- At 208 bytes a line, **indexing costs about 88 times what ingestion costs**.
- Therefore **reduce events, not bytes**. Aggregate, sample by status rather than uniformly, and move cold data out of the index.
- And attribute the bill per service before optimising anything, because it is almost never spread evenly.

The one command worth running today:

```bash
# bytes per line, per log file
for f in /var/log/nginx/*.log; do
  lines=$(wc -l < "$f")
  [ "$lines" -gt 0 ] || continue
  awk -v b="$(stat -c%s "$f")" -v l="$lines" \
      -v n="$f" 'BEGIN { printf "%s  %.1f bytes/line\n", n, b/l }'
done
```

If that number is small, your bill is about event count, and no amount of trimming fields will fix it.
