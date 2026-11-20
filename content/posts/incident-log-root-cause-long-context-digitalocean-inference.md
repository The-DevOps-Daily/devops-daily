---
title: 'Paste the Whole Incident Log: Where Do Models Stop Seeing the Error?'
excerpt: 'We pasted incident logs of 10k to 200k tokens into six models on DigitalOcean Serverless Inference and asked for the one line that caused the outage. Length was not where they failed. DeepSeek V4 Flash found the cause in all 75 logs, at about $0.03 for a 200k-token paste. The two models that failed already failed at 10k, and most of the time they named the first error of the outage.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-11-20'
publishedAt: '2026-11-20T07:07:00Z'
updatedAt: '2026-11-20T07:07:00Z'
readingTime: '18 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - DevOps
  - AI
  - LLM
  - Incident Response
  - Logging
  - On-call
  - DigitalOcean
sponsorCampaign: 'digitalocean'
---

During an incident, a quick thing to try is to paste the whole log into a model and ask what broke. The usual advice is not to: models "lose things in the middle" of long inputs, so you should cut the log down first. We gave that advice ourselves in our [CI log triage post](/posts/ci-log-triage-digitalocean-inference), where we threw away 92 percent of a job log before sending it.

So we measured it. We built 75 incident logs from 10,000 to 200,000 tokens, each with one planted line that started the outage, and asked six models on DigitalOcean Serverless Inference for that line. We expected the answers to get worse as the logs got longer. For the good models, they did not. **DeepSeek V4 Flash found the exact line in all 75 logs**, including all 15 at 200k tokens, for **$0.029 per 200k-token paste**. GLM-5.3 Flash also found all 75. DeepSeek V4 Pro found 49 of 50 at about ten times the price, and its one miss quoted the right line with a line number one off.

The two models that failed were failing already at the shortest length: `gpt-oss-120b` and Ministral 3 14B each missed 4 of 15 logs at 10k tokens. `gpt-oss-120b` also got worse as the logs grew, though 60 logs can only just show that. When `gpt-oss-120b` missed, it blamed the outage itself: all 27 of its misses pointed at a line from after the outage began, and 20 of them at the very first one.

## TL;DR

- Exact line found: DeepSeek V4 Flash 75 of 75, GLM-5.3 Flash 75 of 75, DeepSeek V4 Pro 49 of 50, Nemotron 3.5 Super VL 44 of 45 (it stops at 50k), Ministral 3 14B 41 of 60 and `gpt-oss-120b` 33 of 60 (both stop at 100k).
- For the four strong models we saw no drop with length, across the lengths each one could take (200k for three of them, 50k for Nemotron). For `gpt-oss-120b`, accuracy fell from 11 of 15 at 10k to 6 of 15 at 100k, a trend at the edge of what 60 logs can show (p = 0.049).
- The weak models did best when the cause sat right before the outage (10 of 12 for `gpt-oss-120b`) and worst when it sat in the middle of the log (16 of 36). They failed almost every time when the cause was a paused queue consumer: 0 of 12 and 2 of 12.
- A 200k-token paste cost $0.029 on DeepSeek V4 Flash and $0.276 on DeepSeek V4 Pro, with the first token after 7.6 and 11.9 seconds at the median. Ministral 3 14B took 71 seconds at the median for a 100k log.
- Cutting the log first: a grep for errors dropped the cause in 4 of 5 shapes. A grep that also kept change lines matched the whole log on DeepSeek V4 Flash at a seventh of the cost and lifted `gpt-oss-120b` from 6 to 13 of 15 at 100k, but we picked its words knowing the causes. Our chunking setup helped `gpt-oss-120b` and was slower and dearer on DeepSeek V4 Flash.

## Prerequisites

- A [DigitalOcean account](https://m.do.co/c/2a9bba940f39) (referral link) with a Serverless Inference model access key
- Node.js 22 or later (the scripts have no dependencies)
- About $0.85 of inference to rerun one cheap model on all 75 logs; our whole run, pilots and baselines included, came to about $12.13 in recorded usage

```github
https://github.com/The-DevOps-Daily/incident-log-needle
```

## The test: one log, one cause, a lot of noise

A seeded generator writes the combined log of a small shop on Kubernetes: nginx ingress, four APIs, a worker, Postgres, PgBouncer, Redis, RabbitMQ, Kubernetes events and audit lines, cert-manager and a config agent. One event per line, an ISO timestamp, the source, and a line number at the front, as if someone ran `cat -n` before pasting.

Each log has five kinds of lines, in time order:

- **Background**: requests, jobs, checkpoints, autovacuum, Redis saves, batch-job events, controller reads.
- **Harmless noise**, about 3.7 percent of lines: a retry that succeeds a few lines later, deprecation warnings, a job that fails and passes on retry, a Redis reconnect, a slow query, a `FailedScheduling` that is scheduled a few lines later.
- **Harmless changes** of the same kind as the cause: another PgBouncer pool resized, another certificate renewed, another HPA raised, a search-api deploy.
- **The root cause**: one line, somewhere before the outage.
- **The outage**: symptoms from a fixed start time, plus one **decoy**, a loud line a few seconds after the start that looks like a cause and is meant as a consequence of it.

There are five incident shapes, and each one appears three times at every length and every depth:

| Shape | Root cause (one line)                                   | Logged as | What the symptoms say                            |
| ----- | ------------------------------------------------------- | --------- | ------------------------------------------------ |
| pool  | PgBouncer reload: pool `orders` resized from 50 to 6    | LOG       | `db acquire timeout pool=orders`, HTTP 504       |
| cert  | cert-manager: renewal of `payments-gateway-tls` failed  | error     | `x509: certificate has expired`, HTTP 502        |
| hpa   | Kubernetes audit: `maxReplicas 24 -> 2` on checkout-api | audit     | `ScalingLimited`, `request queue full`, HTTP 503 |
| redis | config agent: `maxmemory 4gb -> 64mb`, `noeviction`     | info      | `OOM command not allowed`, HTTP 500              |
| queue | worker: consumer paused on `payment-confirmations`      | info      | `queue length limit reached`, HTTP 500           |

Only one of the five causes is an error line. That is on purpose. In a real incident the cause is often a change logged at info level, minutes or hours before anything fails, and the first error you see is a symptom.

This is the pool shape in a 10k-token log, with the lines in between removed:

```text
   110	2026-11-14T14:59:49.105Z pgbouncer[812]: LOG RELOAD: pool "reporting" reserve_pool_size changed 0 -> 1 (config rev 731aa91)
   115	2026-11-14T15:00:18.821Z pgbouncer[812]: LOG RELOAD: pool "orders" default_pool_size changed 50 -> 6 (config rev ce67815)
   118	2026-11-14T15:00:34.630Z pgbouncer[812]: LOG RELOAD: pool "analytics" default_pool_size changed 10 -> 12 (config rev 43f89a2)
   154	2026-11-14T15:02:29.639Z pgbouncer[812]: WARNING pool "orders": 114 clients waiting, server connections 6/6 in use, longest wait 22.6s
   155	2026-11-14T15:02:31.069Z checkout-api level=error msg="db acquire timeout" pool=orders waited_ms=5000 path=/api/checkout trace_id=be851eab499fd1d2
   160	2026-11-14T15:02:37.641Z k8s-event Warning OOMKilling pod/checkout-api-c6qjrhqz4-drnh5 Memory cgroup out of memory: Killed process 1 (checkout-api) total-vm:2214556kB, anon-rss:1048576kB
   165	2026-11-14T15:02:39.771Z alertmanager [firing] CheckoutErrorRate severity=page summary="5xx ratio 0.9 on POST /api/checkout"
```

Line 115 is the answer. Lines 110 and 118 are harmless changes to other pools. Line 154 is the first symptom, and line 160, the OOM kill, is the decoy: it comes 8 seconds after the outage started.

The grid has five lengths (10k, 25k, 50k, 100k and 200k tokens) and five depths. **Depth** is where the cause sits in the part of the log before the outage: 0% is line 1 and 100% is the line just before the first symptom. The symptoms are always at the end, because that is when someone pulls the log, so depth is also the distance between the cause and the first error. Each of the 25 cells has three different logs, each with its own seed, so a model sees 75 different logs, not one log three times.

## We checked the test data before the models

In our [alert triage test](/posts/cheap-model-alert-triage-digitalocean-inference), a bug in our own test data made strong models look wrong, and our second reviewer agreed with the bad labels. So this time the checks came first:

- A checker reads every log the way a person would, with regular expressions on the text, and rebuilds each one from its seed. The cause is on exactly one line, at the stated depth, before the outage. The decoy is on exactly one line, after the outage started, in another component. No symptom and no failing checkout request appears before the outage. No line hints at another shape's cause. Every warning or error before the outage belongs to a known harmless family, and every harmless failure recovers within 8 lines.
- A second script plants eight generator bugs in copies of real logs, such as the decoy moved before the outage or the truth file one line off, and asserts the checker reports each one. It caught all eight.
- We read one 10k log end to end (185 lines) and the key lines of 10 more, two per shape at 10k and 200k: the cause, every harmless change, every warning or error before the outage, the first 12 lines of the outage and the decoy.

This is the real output of both checks on the final logs:

```terminal
{
  "title": "checking the test data",
  "prompt": "$",
  "steps": [
    { "cmd": "node scripts/02-check-haystacks.mjs", "output": "Checked 75 haystacks (cert 15, hpa 15, redis 15, queue 15, pool 15).\nProblems: 0\nwrote 10 hand-check files to results/hand-check/" },
    { "cmd": "node scripts/02b-break-checker.mjs", "output": "CAUGHT  needle planted twice (t025k-d050-r2): 2 problem(s); first: needle key found on 2 lines\nCAUGHT  decoy before the outage (t025k-d050-r2): 3 problem(s); first: needle at index 212, depth 0.5 gives 213\nCAUGHT  symptom before the outage (t025k-d050-r2): 3 problem(s); first: needle at index 212, depth 0.5 gives 213\nCAUGHT  unexplained error before the outage (t025k-d050-r2): 1 problem(s); first: unexplained warning or error before the outage on line 41: 2026-11-12T14:34:30.032Z orders-db[2231]: FATAL:  sorry, too many clients already\nCAUGHT  noise without its recovery (t025k-d000-r2): 1 problem(s); first: noise on line 92 has no recovery within 8 lines\nCAUGHT  truth points one line off (t025k-d050-r2): 3 problem(s); first: needle is on line 213, truth says 214\nCAUGHT  failing checkout request before the outage (t025k-d050-r2): 2 problem(s); first: failing requests before the outage on lines 31\nCAUGHT  a second scenario cause in the log (t025k-d050-r2): 2 problem(s); first: lines 51 match the cert cause pattern\nUnbroken copies of 5 haystacks: 0 problems" }
  ]
}
```

Moving a line also moves the cause by one line, so some breaks report a depth problem first. Each break is counted as caught only if the specific problem it plants is in the list.

That reading found things the checker could not. The first version renewed the same certificate twice in an hour, resized the `analytics` pool "from 10 to 14" right after "from 10 to 16", and logged a Redis startup warning a dozen times in one afternoon. None of that changed which line was the cause, but a reader who knows these systems would stop trusting the log. We fixed the first two and made the third much rarer before the main run; it still shows up three to five times in some 200k logs.

## Six models, and the context they really accept

We probed 17 chat models with one tiny request each on 18 November ([the probe output](https://github.com/The-DevOps-Daily/incident-log-needle/tree/main/results/access)), and 16 answered. We kept to open-weight models and picked six across price and size, from Ministral 3 14B to DeepSeek V4 Pro. Kimi K2.6 only accepts temperature 1, so it is not here. MiniMax models are in public preview, and we did not test them.

| Model                             | Input $ / 1M tokens | Output $ / 1M | Context in `/v1/models` | Longest log we sent |
| --------------------------------- | ------------------- | ------------- | ----------------------- | ------------------- |
| `openai-gpt-oss-120b`             | 0.10                | 0.70          | 128,000                 | 100k                |
| `deepseek-v4-flash-0731`          | 0.14                | 0.28          | 1,048,576               | 200k                |
| `glm-5.3-flash`                   | 0.15                | 0.50          | 1,048,576               | 200k                |
| `mistral-3-14B` (Ministral 3 14B) | 0.20                | 0.20          | 262,144                 | 100k                |
| `nemotron-3.5-super-vl`           | 0.30                | 0.65          | 1,048,576               | 50k                 |
| `deepseek-v4-pro-0813`            | 1.32                | 3.96          | 1,048,576               | 200k                |

Prices are from DigitalOcean's [pricing page](https://docs.digitalocean.com/products/inference/details/pricing/), "Last verified 17 Nov 2026", read on 18 November.

Two things in that table cost us a pilot run:

- **The same log is a different number of tokens on each model.** Our lengths are DeepSeek V4 tokens. `gpt-oss-120b` counts the same text as 0.99 times as many, GLM-5.3 Flash 1.05 times, and Ministral and Nemotron 1.37 times. Log lines are full of hex IDs, timestamps and IP addresses, and some tokenizers split those into many small pieces. Our "200k" log is about 275k tokens for Ministral, more than its 262,144 context, so Ministral stops at 100k.
- **The listed context is not always what the server accepts.** `/v1/models` lists 1,048,576 tokens for Nemotron 3.5 Super VL. In the pilot, a log of about 115k Nemotron tokens came back with HTTP 400: `This model's maximum context length is 131072 tokens`. So Nemotron stops at 50k (about 70k of its tokens plus a 16,384-token output budget).

Every call used the same system prompt, temperature 0, and the output budget each model needs: 16,384 tokens for the reasoning models, 4,096 for `gpt-oss-120b` (its maximum) and 2,048 for Ministral, which does not reason. The reply had to be JSON:

```json
{ "line": 115, "quote": "<the log line, copied exactly>", "reason": "<one short sentence>" }
```

The user message is one line about the incident, the numbered log, and the question again:

```text
Incident: Checkout (POST /api/checkout) started timing out with HTTP 504 at about 15:02 UTC on 2026-11-14.

Log:
     1	2026-11-14T14:53:35.614Z checkout-api level=info msg="order placed" ...
   ...
Which line caused the outage? Reply with the JSON only.
```

The system prompt asks for "the root cause (the change or failure that started it), not a symptom and not a later error." We wrote it once and did not tune it on the results.

Only the exact line number counts as found. If the quote is the right line and the number is wrong, we count it separately, but not as found: during an incident, a wrong line number sends you to the wrong place.

## Results

![Six panels, one per model, each a grid of log length (10k to 200k tokens) against the position of the cause (0 to 100 percent). DeepSeek V4 Flash and GLM-5.3 Flash are green in every cell up to 200k. DeepSeek V4 Pro is green except one cell at 100k. Nemotron is green to 50k except one cell at 10k. gpt-oss-120b and Ministral 3 14B have amber and orange cells at every length, with their best column at 100 percent.](../../public/images/posts/incident-log-root-cause-long-context-digitalocean-inference/accuracy-grid.svg)

| Model                 | 10k   | 25k   | 50k   | 100k     | 200k     | All (95% CI)       |
| --------------------- | ----- | ----- | ----- | -------- | -------- | ------------------ |
| DeepSeek V4 Flash     | 15/15 | 15/15 | 15/15 | 15/15    | 15/15    | 75/75 (95 to 100%) |
| GLM-5.3 Flash         | 15/15 | 15/15 | 15/15 | 15/15    | 15/15    | 75/75 (95 to 100%) |
| DeepSeek V4 Pro       | 10/10 | 10/10 | 10/10 | 9/10     | 10/10    | 49/50 (90 to 100%) |
| Nemotron 3.5 Super VL | 14/15 | 15/15 | 15/15 | too long | too long | 44/45 (88 to 100%) |
| Ministral 3 14B       | 11/15 | 11/15 | 11/15 | 8/15     | too long | 41/60 (56 to 79%)  |
| `gpt-oss-120b`        | 11/15 | 9/15  | 7/15  | 6/15     | too long | 33/60 (42 to 67%)  |

367 recorded calls on 18 November 2026: 365 in the grid, plus 2 GLM-5.3 Flash calls that failed after four attempts with HTTP 529 "Platform overloaded" and were run again a few minutes later. The intervals are Wilson 95 percent intervals.

What stands out:

- **We saw no drop with length for the strong models.** The four strong models got 243 of 245 calls exactly right, and both misses were near misses. DeepSeek V4 Pro quoted the right line and gave its number as 435 instead of 436. Nemotron found the right line on a 10k log, then went back and forth over two timestamps until it ran out of its 16,384-token output budget without an answer.
- **We cannot rank the strong models.** On the logs they both saw, any two of them differ on at most one log (sign test p = 1.0 for every pair). We cannot rank the two weak ones either: `gpt-oss-120b` got 3 logs that Ministral missed, and Ministral got 11 that `gpt-oss-120b` missed (p = 0.057).
- **The weak models were weak at 10k.** `gpt-oss-120b` and Ministral 3 14B each missed 4 of 15 logs at the shortest length. `gpt-oss-120b` then fell to 6 of 15 at 100k. A trend test puts that at p = 0.049, but 10k against 100k on its own could be chance (Fisher p = 0.14). Ministral went 11, 11, 11, 8 (no clear trend, p = 0.26).
- **For the weak models, the position of the cause mattered.** With the cause just before the outage, `gpt-oss-120b` got 10 of 12 and Ministral 11 of 12. With the cause at 25 to 75 percent of the log, they got 16 of 36 and 22 of 36 (Fisher p = 0.023 and 0.073).
- **So did the shape of the cause.** The only error-level cause, the failed certificate renewal, was the easiest: 10 of 12 for `gpt-oss-120b`, 12 of 12 for Ministral. The paused queue consumer, an info line, was the hardest: 0 of 12 and 2 of 12. The four strong models found it in 48 of 49 logs, and the one miss was Nemotron running out of output budget after it had found the line.
- **The decoy fooled only `gpt-oss-120b`,** 4 times in 60.

The p-values above are exploratory: we ran several tests and did not correct for that. Nemotron wrote invalid JSON 6 times (for example a `reason` without quotes). The scorer reads the line number with a fallback in that case, and in all 6 the quoted line was the right one.

The numbers for each cell, each model and each miss are in [`results/summary.md`](https://github.com/The-DevOps-Daily/incident-log-needle/blob/main/results/summary.md), and the tests behind the p-values are in [`results/stats.md`](https://github.com/The-DevOps-Daily/incident-log-needle/blob/main/results/stats.md).

## How the misses look

**`gpt-oss-120b` blames the first error.** All 27 of its misses pointed at a line from after the outage began: 20 at the very first line of the outage, 4 at the decoy and 3 at other lines of the outage. Its reasoning text, which the API returns next to the answer, shows how. On this 25k log, the cause is the `orders` pool change on line 319, about seven minutes before the outage. These are excerpts from the recorded reasoning, in order:

```text
However root cause may be earlier: maybe a config reload changed pool size? Look at line 135, 136 earlier (14:45) but not near 15:06.
[...]
The root cause is the pgbouncer pool "orders" being saturated, likely due to a change in pool size earlier? Look at line 135 (14:45:52) pool "reporting" changed, not orders. Line 136 changed analytics. No orders.
[...]
The first error is line 426. So answer line 426.
```

It asked the right question. It found the two harmless pool changes, checked them, and correctly set them aside. It never found line 319, which sits between them and the outage, so it fell back to the first error.

**Ministral 3 14B blames a deploy.** Seven of its 19 misses named the same kind of harmless change: a deploy of search-api, which nothing in the log ties to checkout. Its reason for one of them:

```json
{
  "line": 7,
  "quote": "k8s-audit user=deploy-bot verb=patch resource=deployments ns=shop name=search-api diff=\"image: search-api:4.1 -> search-api:4.2\"",
  "reason": "Deployment of a new search-api version (4.2) triggered a breaking change or incompatibility in the checkout flow."
}
```

"What deployed last?" is a good first question during an incident. It is not an answer.

**A right quote with a wrong line number.** Three times a model quoted the root-cause line and gave the wrong number. DeepSeek V4 Pro was off by one. Ministral 3 14B said line 820 for a cause on line 430, and line 1464 for one on line 864. If you act on the number, you open the wrong place in the log. If your tool asks for both, check that the quote is really on that line before you show it to anyone. Our scorer counts these three as misses. Once it went the other way: Ministral gave the right number, 1293, with the quote of a harmless Redis change, and the scorer counts that as found because it scores the number.

## What a paste costs, and how long you wait

All prices are list prices times the tokens the API reported, with every prompt token at the full input rate, because a pasted incident log is new text. Latency is the time of the attempt that succeeded. Retries after HTTP 529 are not in it.

```chart
{
  "type": "line",
  "title": "Cost per 1,000 pastes of the whole log",
  "unit": " USD",
  "log": true,
  "x": ["10k", "25k", "50k", "100k", "200k"],
  "caption": "List prices from DigitalOcean's pricing page (last verified 17 Nov 2026) times the tokens each API call reported, with all prompt tokens at the input rate. Means over 15 logs per length (10 for DeepSeek V4 Pro). Lines stop where the log no longer fits the model. Log scale.",
  "series": [
    { "name": "gpt-oss-120b", "data": [1.39, 2.93, 5.54, 10.73] },
    { "name": "DeepSeek V4 Flash", "data": [1.65, 3.76, 7.28, 14.48, 28.86] },
    { "name": "GLM-5.3 Flash", "data": [1.98, 4.4, 8.96, 17.19, 33.02] },
    { "name": "Ministral 3 14B", "data": [2.96, 7.12, 14.07, 28.22] },
    { "name": "Nemotron 3.5 Super VL", "data": [5.59, 11.32, 21.76] },
    { "name": "DeepSeek V4 Pro", "data": [19.1, 39.89, 71.15, 141.66, 275.65] }
  ]
}
```

```chart
{
  "type": "line",
  "title": "Time to the first streamed token, median",
  "unit": "s",
  "x": ["10k", "25k", "50k", "100k", "200k"],
  "caption": "Time to the first streamed token of any kind, reasoning or answer, measured by our client on 18 November 2026. Eight calls served from the prompt cache are left out (see below).",
  "series": [
    { "name": "gpt-oss-120b", "data": [1.0, 1.8, 3.4, 8.7] },
    { "name": "DeepSeek V4 Flash", "data": [0.8, 1.2, 1.9, 3.6, 7.6] },
    { "name": "GLM-5.3 Flash", "data": [0.9, 1.5, 2.5, 4.5, 8.7] },
    { "name": "Ministral 3 14B", "data": [1.4, 3.8, 11.5, 40.6] },
    { "name": "Nemotron 3.5 Super VL", "data": [0.8, 1.2, 2.0] },
    { "name": "DeepSeek V4 Pro", "data": [1.3, 2.1, 3.6, 6.1, 11.9] }
  ]
}
```

| Model                 | Length | Prompt tokens | $ per paste | First token, p50 | Whole answer, p50 / p90 |
| --------------------- | ------ | ------------- | ----------- | ---------------- | ----------------------- |
| DeepSeek V4 Flash     | 200k   | 204,724       | 0.029       | 7.6 s            | 9.1 s / 10.8 s          |
| GLM-5.3 Flash         | 200k   | 214,585       | 0.033       | 8.7 s            | 18.7 s / 39.5 s         |
| DeepSeek V4 Pro       | 200k   | 204,680       | 0.276       | 11.9 s           | 19.6 s / 24.6 s         |
| `gpt-oss-120b`        | 100k   | 101,815       | 0.011       | 8.7 s            | 20.1 s / 27.1 s         |
| Ministral 3 14B       | 100k   | 140,729       | 0.028       | 40.6 s           | 71.4 s / 84.6 s         |
| Nemotron 3.5 Super VL | 50k    | 70,028        | 0.022       | 2.0 s            | 8.6 s / 12.5 s          |

Prompt tokens are medians as each model counted them.

- **The cost per paste is small.** Even DeepSeek V4 Pro costs 28 cents for a 200k paste. Ten pastes per incident on DeepSeek V4 Flash cost less than 30 cents. What you pay for is the wait.
- **The wait grows with the log.** Time to the first token grew with the prompt on every model: DeepSeek V4 Flash went from 0.8 seconds at 10k to 7.6 at 200k. Ministral 3 14B was the slowest by far: 40.6 seconds before the first token of a 100k log, and 71 seconds for an answer of about 100 tokens.
- **GLM-5.3 Flash was busy.** It answered HTTP 529 "Platform overloaded" 45 times. 27 of its 77 calls needed at least one retry, and two failed all four attempts and were run again later. Its p90 for the whole answer at 100k was 68 seconds, even with the retry waits left out. No other model returned an HTTP error in the main run.

**The pilot warmed the cache for eight calls.** Our pilot sent four of the 75 logs to the models (fewer to the ones with short context limits) a few minutes to a quarter of an hour before the same logs came up in the main run. When the main run sent the same logs again, eight calls were served from DigitalOcean's [prompt cache](/posts/digitalocean-inference-prompt-caching-measured). DeepSeek V4 Flash started answering a 200k log after 0.7 seconds instead of about 7.6. A pasted incident log is new text, so we priced those eight calls as if nothing was cached and left them out of the latency numbers. Both corrections make the numbers worse, not better. The verdicts did not change: each of the eight got the same verdict as the pilot's answer on the same log. The cache can still help during an incident. It works on the shared start of the prompt ([we measured that here](/posts/digitalocean-inference-prompt-caching-measured)), so a follow-up question asked after the same unchanged log should get the same benefit. We did not test follow-ups in this run.

## The cheaper alternatives: grep first, or chunk

The usual advice is to cut the log down before you send it. We tried three ways on the 30 logs at 100k and 200k, with the cheapest model (`gpt-oss-120b`) and the best cheap one (DeepSeek V4 Flash):

- **grep-errors**: keep only lines that look like errors or warnings (error, fail, timeout, `level=warn`, 5xx and so on), then ask with the same prompt. This is what most of us type first, in a terminal or in the search box of Kibana or Grafana ([ELK or Loki and Grafana](/comparisons/elk-stack-vs-loki-grafana) both make it one query).
- **grep-changes**: keep those lines plus lines that look like a change (changed, patch, applied, reload, config, scaled, paused, `->` and so on). We picked these words knowing what our five causes look like, so this is the best case for grep, not a fair test of it.
- **chunks**: split the log into parts of about 20k tokens, ask for up to three candidate lines per part, then send the real text of every candidate plus the last 40 lines of the log to a final call with the main prompt.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "200k-token log", "sub": "11 parts of ~20k", "icon": "database", "tone": "slate" },
    { "label": "Map", "sub": "up to 3 candidates per part", "icon": "cpu", "tone": "blue" },
    { "label": "Candidates", "sub": "the real text of each line", "icon": "queue", "tone": "violet" },
    { "label": "Reduce", "sub": "candidates + last 40 lines", "icon": "cpu", "tone": "blue" },
    { "label": "One line", "sub": "same JSON as the main test", "icon": "check", "tone": "green" }
  ]
}
```

| Model             | Length | Method       | Exact | Cause reached the final call | $ per query | Wall time, p50 |
| ----------------- | ------ | ------------ | ----- | ---------------------------- | ----------- | -------------- |
| `gpt-oss-120b`    | 100k   | whole log    | 6/15  | 15/15                        | 0.011       | 20.1 s         |
| `gpt-oss-120b`    | 100k   | grep-errors  | 3/15  | 3/15                         | 0.001       | 6.1 s          |
| `gpt-oss-120b`    | 100k   | grep-changes | 13/15 | 15/15                        | 0.002       | 7.7 s          |
| `gpt-oss-120b`    | 100k   | chunks       | 11/15 | 11/15                        | 0.014       | 26.3 s         |
| `gpt-oss-120b`    | 200k   | grep-errors  | 3/15  | 3/15                         | 0.002       | 7.6 s          |
| `gpt-oss-120b`    | 200k   | grep-changes | 13/15 | 15/15                        | 0.003       | 7.7 s          |
| DeepSeek V4 Flash | 100k   | whole log    | 15/15 | 15/15                        | 0.014       | 5.0 s          |
| DeepSeek V4 Flash | 100k   | grep-errors  | 3/15  | 3/15                         | 0.002       | 19.7 s         |
| DeepSeek V4 Flash | 100k   | grep-changes | 15/15 | 15/15                        | 0.002       | 2.1 s          |
| DeepSeek V4 Flash | 100k   | chunks       | 14/15 | 14/15                        | 0.023       | 43.1 s         |
| DeepSeek V4 Flash | 200k   | whole log    | 15/15 | 15/15                        | 0.029       | 9.1 s          |
| DeepSeek V4 Flash | 200k   | grep-errors  | 3/15  | 3/15                         | 0.003       | 26.8 s         |
| DeepSeek V4 Flash | 200k   | grep-changes | 15/15 | 15/15                        | 0.004       | 2.6 s          |
| DeepSeek V4 Flash | 200k   | chunks       | 14/15 | 14/15                        | 0.047       | 68.8 s         |

"Whole log" rows are from the main run. Wall time for chunks is the parallel map pass plus the final call. The full table, with the verdict for every log, is in [`results/two-step-summary.md`](https://github.com/The-DevOps-Daily/incident-log-needle/blob/main/results/two-step-summary.md).

- **An error filter throws the cause away.** It kept the root-cause line only in the certificate shape, the one cause logged as an error, so no model could find more than 3 of 15, and both found exactly those 3. With the cause gone, DeepSeek V4 Flash kept reasoning until it hit its 8,192-token output budget in 9 of 30 calls, which is why it was slower on less text. (The baseline gave it 8,192 output tokens, half of the main run's budget; it cannot change the exact count, because the cause was not in the text.)
- **A filter that keeps changes works, if you know what your changes look like.** It lifted `gpt-oss-120b` from 6 of 15 to 13 of 15 at 100k: 7 logs right only with the filter, none right only with the whole log (sign test p = 0.016). It cost DeepSeek V4 Flash about 7 times less than the whole 200k log and answered in 2.6 seconds instead of 9.1. But we chose those words knowing our five causes. Your changes may be logged as "rolled out", "set", "updated" or not at all, and the filter is one more thing to keep up to date.
- **Chunking helped the weak model and cost the strong one.** `gpt-oss-120b` went from 6 to 11 of 15 at 100k (5 logs right only with chunks, none the other way, p = 0.063: an improvement with a lot of uncertainty). DeepSeek V4 Flash dropped from 15 to 14 of 15 at both lengths, paid 1.6 times as much and took 43 to 69 seconds instead of 5 to 9.
- **Our chunk setup has a weak spot.** 105 of DeepSeek V4 Flash's 255 map calls reasoned until they used the whole 8,192-token output budget and returned nothing. That is half of the main run's budget, and it is part of why its chunk runs were slow and expensive. So read the chunk rows as a result for this setup, not for chunking in general. When the cause did reach the final call, the final call picked it every time (28 of 28 for DeepSeek V4 Flash, 14 of 14 for `gpt-oss-120b`).
- **The losses were mostly the quiet cause.** 5 of the 6 causes lost in the map step were the paused queue consumer. `gpt-oss-120b` lost three of them with no truncated map call, which fits a simple explanation: a part of the log far from the outage has no symptoms in it, and "consumer paused by operator" does not look like a cause until you know the queue filled up. For DeepSeek V4 Flash we cannot tell that apart from the budget problem.
- **Two machines.** Our client machine restarted during the baselines, so the DeepSeek V4 Flash chunk runs ran from a second machine with the same code. Their wall times are not from the same client as the other rows.
- **`gpt-oss-120b` hit a daily limit.** At 200k, our account got HTTP 429 `Rate limit exceeded: tokens_per_day` after about 6.9 million recorded `gpt-oss-120b` tokens that day, with 3 of the 15 chunked logs done (all 3 right). We left that row out. If you plan to paste large logs into one model many times a day, find out its daily token limit before an incident does.

## What 75 logs cannot tell you

- **It is a planted, deliberately clear cause.** The checker makes sure exactly one line matches each shape's cause, and the harmless changes touch other resources. So the task is closer to finding one unambiguous line than to a full root-cause analysis.
- **The clock is not always realistic.** At depth 100 percent the change lands seconds before the outage, and some symptom lines quote waits longer than that, such as a 27.5-second wait 2 seconds after the pool shrank. A careful reader, or model, could notice. The strong models found every one of those causes anyway.
- **The links in our logs are clear.** In every shape, the symptoms name the thing that changed: the `orders` pool, the certificate's expiry time, the replica limit, `maxmemory`, the `payment-confirmations` queue. Real incidents can be much less direct, with a cause in one system and the first error three systems away. A model that follows a clear link at 200k tokens may still miss a faint one at 10k.
- **One cause per log.** Real outages often have two or three contributing changes. We scored one line.
- **The logs are ours.** One made-up shop, five shapes, a fixed set of services and our own wording. The queue result in particular may be partly about how our worker phrases a pause.
- **Line numbers were in the paste.** Most people paste raw logs. Without numbers, ask for the quote instead and search for it yourself.
- **The sample is small.** 15 logs per model per length and 3 per cell. Within this synthetic test, "75 of 75" still allows a true miss rate of up to 5 percent; it says nothing about logs we did not generate. DeepSeek V4 Pro had 2 logs per cell instead of 3 to stay inside our $14 budget.
- **"200k" is in DeepSeek tokens.** The same log is 0.99 to 1.37 times as many tokens on the other models, so a cell is the same text for every model, not the same token count.
- **One prompt, one day, temperature 0.** The models DigitalOcean served on 18 November 2026. We did not try a prompt that makes the model list every change before the outage first. That might help the weak models a lot, and we have not measured it.
- **Open-weight models only.** On 18 November our key could also call GPT and Claude models, which returned HTTP 403 for this account in October ([the October check](https://github.com/The-DevOps-Daily/alert-triage-bench/blob/main/results/model-access-2026-10-14.txt)). They are not in this test.

## What we would do during an incident

- **Paste the whole window into a strong model.** On our logs, DeepSeek V4 Flash and GLM-5.3 Flash did not get worse up to 200k tokens, and a 200k paste cost about 3 cents. Length was not the problem. The model was.
- **Do not grep for errors first.** Four of our five causes were not errors, and an error filter threw them away every time. A filter that also keeps changes (config reloads, audit patches, deploys, scaling, pauses) matched the whole log on DeepSeek V4 Flash for a seventh of the price, but only because we knew what our changes look like. Without a filter you have tested on your own incidents, keep the log whole.
- **Know which model you are asking.** `gpt-oss-120b` and Ministral 3 14B missed 27 and 19 of 60 logs, 4 of 15 each already at 10k, mostly by naming the first error of the outage or an unrelated deploy.
- **Ask for the line and the quote, and check that they match.** Three answers quoted the right line with the wrong number. A tool that shows the number should first check that the quoted text is really on that line.
- **Keep the log first and unchanged when you ask follow-ups.** The prompt cache works on the shared start of the prompt. A repeated 200k log made DeepSeek V4 Flash start answering in 0.7 seconds instead of 7.6; we did not test changed follow-up questions.
- **Test it on your own postmortems before you rely on it.** Our logs are clean, and the links in them are clear. Yours may not be. And keep the model on the investigation side: finding the line is the part [AI SRE tools do well](/posts/ai-sre-agents-what-they-fix-and-break), and acting on it is still yours.

## Run it on your own logs

Each stage writes a file that the next one reads. Every recorded call is stamped with a hash of the runner, the prompt, the model settings, the generator and the truth file, and the scorers refuse unstamped, mixed or stale files. The runners stop before their own estimate of spend passes a cap ($14 by default). It is an estimate from the prompt size, not a hard limit.

```bash
git clone https://github.com/The-DevOps-Daily/incident-log-needle
cd incident-log-needle
cp .env.example .env                          # add your model access key

node scripts/01-build-haystacks.mjs           # 75 logs + data/truth.jsonl
node scripts/02-check-haystacks.mjs           # check every log against the truth file
node scripts/02b-break-checker.mjs            # prove the checker catches 8 planted bugs
mkdir ../ours && mv results/raw results/two-step ../ours/   # keep our run outside results/
node scripts/03-run-models.mjs --models deepseek-v4-flash-0731
node scripts/04-score.mjs                     # results/summary.md
node scripts/05-two-step.mjs --models deepseek-v4-flash-0731 --methods chunks
node scripts/05b-score-two-step.mjs
```

The better test is your own incidents. Take three postmortems where you know the line that started it, export the logs from the hour (or the day) before, and paste them into the model you would use at 3 a.m. If it points at the first error, you have learned what our weak models do, on your data.
