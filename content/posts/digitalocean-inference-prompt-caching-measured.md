---
title: 'Prompt Caching on DigitalOcean Inference, Measured: What Breaks It and How Long It Lasts'
excerpt: 'We sent 867 requests with a long on-call runbook as the system prompt to three DigitalOcean-hosted models. With the runbook first and unchanged, the cache cut the input bill about 5 times on Llama 4 Maverick and more than 12 times on DeepSeek V4.1 Flash. One timestamp on the first line turned it off on all three. Here is what else turns it off, how long a cached prefix lasted, and what prompt_cache_key does.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-10-19'
publishedAt: '2026-10-19T09:00:00Z'
updatedAt: '2026-10-19T09:00:00Z'
readingTime: '15 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - DevOps
  - AI
  - LLM
  - Caching
  - FinOps
  - DigitalOcean
sponsorCampaign: 'digitalocean'
---

Most LLM features send the same long block of text on every request: a system prompt, a policy, a runbook, a list of tools. DigitalOcean Serverless Inference caches that repeated prefix automatically on the models it hosts, bills the cached part at a discount, and starts streaming sooner. You do not turn it on. You can turn it off by accident, and the request itself does not tell you.

We sent 867 requests to Llama 4 Maverick, DeepSeek V4.1 Flash and `gpt-oss-120b`, with an on-call runbook of up to about 67,000 tokens as the system prompt. With an 8,000-token runbook first and unchanged, the cache served **99.7 percent** of the prompt on Llama 4 Maverick after the first request and cut the input cost about **5 times**. On DeepSeek V4.1 Flash it cut it more than **12 times**. Then we put the current time on the first line of the system prompt, the way a lot of prompt templates do, and **every request after the first missed**, on all three models.

This post covers what we measured: which prompt layouts keep the cache and which break it, what a hit does to time to first token as the prompt grows, how long a cached prefix lasted on each model, what `prompt_cache_key` changes, and why `gpt-oss-120b` was the hardest to keep warm. Every token and cache number comes from the usage block the API returned, timings come from our client, and the harness and raw results are public.

```github
https://github.com/The-DevOps-Daily/do-inference-prompt-cache
```

## TL;DR

- With a stable 8k-token prefix, input cost per 1,000 requests went from $1.92 to $0.39 on Llama 4 Maverick and from $2.40 to $0.19 on DeepSeek V4.1 Flash. `gpt-oss-120b` went from $0.78 to $0.35 in one run and to $0.55 in another; the share of its prompt served from cache swung between 35 and 68 percent.
- A timestamp on the first line of the system prompt: all 57 requests after the first missed, across the three models. The same timestamp after the runbook: back to 99.5, 93.7 and 63.2 percent of tokens from cache. A user's name a quarter of the way in: only the part before it, 27 to 28 percent of the prompt, was cached.
- At 64k tokens, a cache hit cut the time to the first streamed token from 5.0 to 1.4 seconds on Llama 4 Maverick and from 3.1 to 0.9 seconds on DeepSeek V4.1 Flash. `gpt-oss-120b` never hit at 64k in 5 tries.
- How long a prefix stayed usable depended on the model. Llama 4 Maverick hit after a nominal 5 idle minutes and missed after 15. DeepSeek V4.1 Flash missed every prefix it had seen only once, and hit every prefix it had seen twice, up to 30 minutes later. `gpt-oss-120b` missed all 9 probes after a minute or more.
- `prompt_cache_key` kept caches apart: a second key on the same prefix missed 12 of 12 times. It did not change hit rates in our runs.

## Prerequisites

- A DigitalOcean account with a Serverless Inference [model access key](https://docs.digitalocean.com/products/inference/how-to/manage-model-access-keys/)
- Node.js 22 or later (the harness has no dependencies)
- Optional: an API token with billing read access, for the invoice check in the repo
- About $2 of inference credit to rerun everything; our recorded requests cost about $1.06 at list prices

## How the cache works on DigitalOcean-hosted models

The [prompt caching guide](https://docs.digitalocean.com/products/inference/how-to/use-prompt-caching/) covers three families. Anthropic and OpenAI models have their own controls (`cache_control`, `prompt_cache_retention`). The open-weight models DigitalOcean hosts itself, which is what we tested, cache with no code change at all:

- The cache matches an exact token prefix, in blocks of up to 256 tokens depending on the model.
- Writing to the cache is free. Cached input tokens are billed at the model's cache read rate.
- Entries have no fixed expiry. They are evicted least-recently-used first, "and sooner under heavy load".
- The cache lives on the replica that served the earlier request. The platform routes matching prefixes back to that replica, but under very high load it may send a request elsewhere, which is a miss.
- Every response reports the cached part in `usage.prompt_tokens_details.cached_tokens` (and `cache_read_input_tokens`).

The discount differs a lot between models. These are the rates for the three we tested, from the [pricing page](https://docs.digitalocean.com/products/inference/details/pricing/) (last verified 15 October 2026) and our own invoice:

| Model               | Input, per 1M tokens | Cached input, per 1M | Discount |
| ------------------- | -------------------- | -------------------- | -------- |
| Llama 4 Maverick    | $0.25                | $0.05                | 80%      |
| DeepSeek V4.1 Flash | $0.30                | $0.006               | 98%      |
| `gpt-oss-120b`      | $0.10                | $0.02                | 80%      |

The pricing page lists no cache read rate for `gpt-oss-120b`; the $0.02 is the rate on the `Cache Read Input` line of our invoice preview. The caching guide says cached tokens are "discounted by up to 90%", but the pricing page and our invoice both show DeepSeek V4.1 Flash at 98 percent off.

## The test

The prompt is an on-call runbook for a made-up platform: 64 services, each with an owner, an SLO, its alerts and numbered first steps with real-looking commands (`deployctl rollback checkout-api`, `featurectl set checkout-api.degraded true`). A seeded script cuts it at section boundaries to nominal sizes of 1k, 4k, 8k, 16k and 64k tokens, at about four characters per token. Each model's tokenizer counts the same text a little differently: the 8k runbook is 7,700 to 8,000 tokens, and the 64k one 64,000 to 67,000. The runbook is the system prompt, and the user message is one of 40 on-call questions ("checkout-indexer is returning 5xx after a deploy 10 minutes ago. What is the first command to run?").

Every request is streamed with `stream_options: { include_usage: true }`, `temperature` 0 and `max_tokens` 48. We record the time to the first streamed token, total time and the usage block. For DeepSeek V4.1 Flash and `gpt-oss-120b` that first token is usually reasoning, not answer text, because both reason before they answer. Each experiment starts from a prefix the cache has never seen: a random revision id on the first line, the same for all requests in that experiment.

Two definitions matter for reading the numbers:

- A **hit** is a request where at least half the prompt came from the cache, and a **miss** is one where under 10 percent did. `gpt-oss-120b` reports 64 cached tokens on many requests that share nothing with an earlier one, which looks like its chat template, so "cached tokens above zero" does not mean a hit.
- Llama 4 Maverick answered `529 Platform overloaded` 55 times during the run. The harness retried each one, counted it and kept it out of the timings. The other two models refused nothing. So the 867 requests are the ones that succeeded: 922 attempts in all, plus a first run of 20 requests we discarded because it did not record its retries.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "00-build-prompts", "sub": "runbook 1k to 64k", "icon": "box", "tone": "slate" },
    { "label": "02-run", "sub": "one experiment, one model", "icon": "rocket", "tone": "blue" },
    { "label": "results/raw", "sub": "every usage block", "icon": "database", "tone": "violet" },
    { "label": "03-score", "sub": "hits, TTFT, cost", "icon": "activity", "tone": "green" }
  ]
}
```

## A stable prefix: what you get

The first experiment is the best case: the same 8k-token runbook on 20 requests in a row, a different question each time. This chart shows how much of each request's prompt came from the cache.

```chart
{
  "type": "line",
  "title": "Share of the prompt served from cache, 20 requests in a row",
  "unit": "%",
  "x": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  "series": [
    { "name": "Llama 4 Maverick", "data": [0, 99.6, 99.7, 99.8, 99.8, 99.8, 99.8, 99.8, 99.6, 99.6, 99.7, 99.8, 99.8, 99.8, 99.8, 99.8, 99.6, 99.6, 99.7, 99.8] },
    { "name": "DeepSeek V4.1 Flash", "data": [0, 0, 99.2, 99.3, 99.2, 99.2, 99.2, 99.2, 99.1, 99.1, 99.2, 99.2, 99.2, 99.2, 99.2, 99.2, 99.1, 99.1, 99.2, 99.2] },
    { "name": "gpt-oss-120b", "data": [0.8, 98.9, 0, 99.1, 0.8, 99.1, 99.1, 0, 0.8, 98.9, 99, 99.1, 99.1, 0, 99.1, 99.1, 99, 98.9, 0.8, 99.1] }
  ],
  "caption": "8k-token runbook as the system prompt, one new question per request, sent one after another. cached_tokens / prompt_tokens from each response. Run on 19 October 2026."
}
```

Three different behaviors from one feature:

- **Llama 4 Maverick** hit from the second request on and never missed again.
- **DeepSeek V4.1 Flash** missed the first two requests and hit every one after that. That was common, not universal. Counting every experiment that sent a new prefix twice within seconds, the second request missed 24 times out of 30, and the third request on the same prefix hit all 26 times we sent one.
- **`gpt-oss-120b`** missed 6 of the 19 requests after the first, scattered through the run. In a later run with the same layout, it hit only 10 of 28. A cached prefix lives on one replica, and the guide says requests can land on one that does not hold it. That fits what we saw, but the response does not say which replica served it, so we cannot confirm it.

Here is what that does to the input bill, per 1,000 requests at list prices:

```chart
{
  "type": "bar",
  "title": "Input cost per 1,000 requests, 8k-token prompt",
  "unit": "$",
  "rows": [
    { "label": "Llama 4 Maverick, no cache", "value": 1.92, "series": "Without the cache" },
    { "label": "Llama 4 Maverick, measured", "value": 0.39, "series": "Measured" },
    { "label": "DeepSeek V4.1 Flash, no cache", "value": 2.4, "series": "Without the cache" },
    { "label": "DeepSeek V4.1 Flash, measured", "value": 0.19, "series": "Measured" },
    { "label": "gpt-oss-120b, no cache", "value": 0.78, "series": "Without the cache" },
    { "label": "gpt-oss-120b, stable run", "value": 0.35, "series": "Measured" },
    { "label": "gpt-oss-120b, later run", "value": 0.55, "series": "Measured" }
  ],
  "series": [
    { "name": "Without the cache", "color": "#94a3b8" },
    { "name": "Measured", "color": "#0080ff" }
  ],
  "caption": "Average over requests 2 to 20 of the stable run, scaled to 1,000, so DeepSeek's second-request miss is included. Counting the first request too gives $0.47, $0.30 and $0.37. The gpt-oss-120b later run is the key-ab experiment (both arms, requests 2 to 8 on four prefixes each, about 36% of tokens from cache), priced the same way. Input only; output is capped at 48 tokens and not compared."
}
```

On list price, `gpt-oss-120b` is the cheap one: $0.10 per million input tokens against $0.30 for DeepSeek V4.1 Flash. With a stable prefix the order flips, because DeepSeek's cached tokens cost almost nothing and it hit far more often. If most of your tokens are a repeated prompt, compare models on cached cost and measured hit rate, not on the input price. Output is a separate sum: both models spent most of their 48 output tokens on reasoning in our runs, and DeepSeek's output costs $1.20 per million against $0.70.

## What breaks it

The guide lists the patterns that break the prefix match: a timestamp or request ID in the system prompt, per-user data before the shared instructions, tool definitions that change order. We tried three of those layouts on the same runbook, 20 requests each, each from a fresh prefix:

```text
stable           [revision][runbook .......................][question]
timestamp-first  [time][revision][runbook .................][question]
timestamp-last   [revision][runbook .................][time][question]
user-in-middle   [revision][runbook ...][name][runbook ....][question]
```

```chart
{
  "type": "bar",
  "title": "Share of the prompt from cache after the first request, by layout",
  "unit": "%",
  "rows": [
    { "label": "Llama 4 Maverick, stable", "value": 99.7, "series": "Llama 4 Maverick" },
    { "label": "Llama 4 Maverick, time first", "value": 0, "series": "Llama 4 Maverick" },
    { "label": "Llama 4 Maverick, time last", "value": 99.5, "series": "Llama 4 Maverick" },
    { "label": "Llama 4 Maverick, name in middle", "value": 27.4, "series": "Llama 4 Maverick" },
    { "label": "DeepSeek V4.1 Flash, stable", "value": 94, "series": "DeepSeek V4.1 Flash" },
    { "label": "DeepSeek V4.1 Flash, time first", "value": 0, "series": "DeepSeek V4.1 Flash" },
    { "label": "DeepSeek V4.1 Flash, time last", "value": 93.7, "series": "DeepSeek V4.1 Flash" },
    { "label": "DeepSeek V4.1 Flash, name in middle", "value": 26.5, "series": "DeepSeek V4.1 Flash" },
    { "label": "gpt-oss-120b, stable", "value": 67.9, "series": "gpt-oss-120b" },
    { "label": "gpt-oss-120b, time first", "value": 0.8, "series": "gpt-oss-120b" },
    { "label": "gpt-oss-120b, time last", "value": 63.2, "series": "gpt-oss-120b" },
    { "label": "gpt-oss-120b, name in middle", "value": 19.5, "series": "gpt-oss-120b" }
  ],
  "caption": "Cached tokens as a share of prompt tokens over requests 2 to 20 of each run. 8k-token runbook, 19 October 2026."
}
```

A timestamp on the first line changes the first tokens of every request, so nothing after it can match. All 57 requests after the first missed on all three models (the 0.8 percent on `gpt-oss-120b` is its 64 template tokens). The requests still succeeded, and the only sign in the response was the usage block. On Llama 4 Maverick that layout cost $1.93 per 1,000 requests instead of $0.39.

Moving the timestamp after the runbook brought the cached share back to the stable run's level on Llama 4 Maverick and DeepSeek V4.1 Flash (99.5 and 93.7 percent), and to 63.2 percent on `gpt-oss-120b`, inside its usual swing from run to run. The name a quarter of the way in shows how prefix matching degrades. When the cache was used, it served the part before the name, 27 to 28 percent of the prompt, and nothing after it. DeepSeek V4.1 Flash and `gpt-oss-120b` also missed outright on 1 and 6 of the 19 requests.

The fix is in the template, not the platform:

```javascript
// Breaks the cache: the first tokens change on every request.
const system = `Current time: ${new Date().toISOString()}\n\n${runbook}`;

// Keeps it: the runbook is a fixed prefix and the time comes after it.
const system = `${runbook}\n\nCurrent time: ${new Date().toISOString()}`;

// Better still: keep the system prompt byte-identical and put
// per-request data in the user message.
const messages = [
  { role: 'system', content: runbook },
  { role: 'user', content: `On-call engineer: ${name}\nTime: ${now}\n\n${question}` },
];
```

"Byte-identical" includes things that are easy to miss: a JSON blob serialized with keys in a different order, a tool list built from a `Set`, trailing whitespace from a template engine. If you build the prefix in code, hash it and log the hash. Two hashes for one prompt version is a cache problem waiting to show up on the bill.

## Bigger prompts, bigger latency win

We ran the same comparison at four more prompt sizes: 5 requests on a fresh prefix each (all misses), and 6 requests on one prefix per size, where requests 2 to 6 that hit give the hit column. Medians of the time to the first streamed token; each miss cell is 5 requests, and each hit cell is 5 unless marked:

| Prompt size | Llama 4 Maverick, miss / hit | DeepSeek V4.1 Flash, miss / hit | `gpt-oss-120b`, miss / hit |
| ----------- | ---------------------------- | ------------------------------- | -------------------------- |
| ~1k tokens  | 940 / 773 ms                 | 707 / 524 ms (4 hits)           | 599 / 564 ms (3 hits)      |
| ~4k tokens  | 939 / 807 ms                 | 642 / 546 ms                    | 848 / 519 ms (4 hits)      |
| ~16k tokens | 1,458 / 878 ms               | 1,032 / 626 ms                  | 1,169 / 609 ms (2 hits)    |
| ~64k tokens | 5,015 / 1,444 ms             | 3,068 / 911 ms                  | 4,770 ms / no hit          |

```chart
{
  "type": "bar",
  "title": "Time to first streamed token, nominal 64k-token prompt",
  "unit": "ms",
  "rows": [
    { "label": "Llama 4 Maverick, miss", "value": 5015, "series": "Miss" },
    { "label": "Llama 4 Maverick, hit", "value": 1444, "series": "Hit" },
    { "label": "DeepSeek V4.1 Flash, miss", "value": 3068, "series": "Miss" },
    { "label": "DeepSeek V4.1 Flash, hit", "value": 911, "series": "Hit" },
    { "label": "gpt-oss-120b, miss", "value": 4770, "series": "Miss" }
  ],
  "series": [
    { "name": "Miss", "color": "#94a3b8" },
    { "name": "Hit", "color": "#10b981" }
  ],
  "caption": "Median of 5 requests each. gpt-oss-120b did not hit on any of 5 requests at this size. Run on 19 October 2026."
}
```

At 1k to 4k tokens the medians differed by 35 to 330 milliseconds. At 64k they differed by 2.2 seconds on DeepSeek V4.1 Flash and 3.6 seconds on Llama 4 Maverick, seconds in which nothing streams back. If you put whole documents or long tool output in the prompt, this can matter more than the discount. The groups are small and were collected a few minutes apart rather than paired, so read the shape, not the exact milliseconds.

## How long a cached prefix lasts

The guide says entries have no fixed expiry and are evicted when the space is needed. We wanted to know what that means in minutes. Each prefix was sent once or twice, left alone, and asked again. The minute gaps are nominal: we counted them from the start of priming, so the real idle time was up to 35 seconds shorter (the raw data has the exact times).

| Asked again after             | Llama 4 Maverick | DeepSeek V4.1 Flash | `gpt-oss-120b` |
| ----------------------------- | ---------------- | ------------------- | -------------- |
| 5 to 45 seconds (sent twice)  | 8 of 8 hit       | 8 of 8 hit          | 4 of 8 hit     |
| 1 minute, sent once / twice   | hit / hit        | miss / hit          | miss / miss    |
| 5 minutes, sent once / twice  | hit / hit        | miss / hit          | miss / miss    |
| 15 minutes, sent once / twice | miss / miss      | miss / hit          | miss / miss    |
| 30 minutes, sent once / twice | miss / miss      | miss / hit          | miss / miss    |
| 60 minutes, sent once         | miss             | miss                | miss           |

Each cell is one request (two per gap for the seconds row), so this is a sketch of one afternoon, not a guarantee. A miss also does not prove the entry was evicted; the request may have gone to a replica that never had it. It still says three useful things:

- **Llama 4 Maverick** hit at the nominal 5-minute probes and missed at 15 minutes, whether it had seen the prefix once or twice. It was also the model returning 529 overload errors, and the guide says eviction comes sooner under heavy load.
- **DeepSeek V4.1 Flash** missed every prefix it had seen only once, even after one minute, and hit every prefix it had seen twice, up to 30 minutes later. That is the same pattern as the second-request misses above, so it may have nothing to do with time: on this model, the cache paid off from the third request.
- **`gpt-oss-120b`** hit about half the time within 45 seconds and missed all 9 probes at a minute or more.

For traffic that repeats every few seconds, all three caches work. For a prefix used once every 15 minutes or so, such as a per-tenant prompt on a quiet tenant or a nightly job, plan on paying full price.

## Bursts on a cold prefix

What happens when a deploy or a queue drain sends ten requests at once with a prefix nobody has sent before? We sent ten at once on a cold prefix, then ten more:

- DeepSeek V4.1 Flash hit on 8 of the first 10 and `gpt-oss-120b` on 7, even though none of them had seen the prefix before the burst started.
- Llama 4 Maverick refused 5 of the first 10 with 529 (9 refusals in all) and the harness retried them a few seconds later, so its number mixes concurrent and later requests. Of the 5 that went through on the first try, 4 hit.
- The second wave of ten hit 10 of 10 on all three models.
- One request alone and then ten at once on another new prefix: 10, 9 and 9 of the ten hit.

So a cold burst does not pay full price ten times. The responses do not show how the server scheduled the requests, only that most of them reported cached tokens.

## What prompt_cache_key does

`prompt_cache_key` is an optional field on the request. The guide describes it as a way to keep cached context apart inside one account, for different tenants or workloads, and as a cache reset when you roll out a new prompt. Caches are already isolated between accounts.

We checked the separation. On four fresh prefixes per model, we sent key A twice, then key B, then key A again, then no key at all, then key B a second time:

```terminal
{
  "title": "node 03-score.mjs (cache-key rows)",
  "prompt": "$",
  "steps": [
    { "comment": "a-1, a-2: key A twice. b-1: key B. a-3: key A again. none: no key. b-2: key B again." },
    { "cmd": "STAMPS_OK=... node 03-score.mjs | grep cache-key", "output": "  cache-key        a-1 0/4, a-2 4/4, b-1 0/4, a-3 4/4, none 0/4, b-2 4/4\n  cache-key        a-1 0/4, a-2 3/4, b-1 0/4, a-3 4/4, none 0/4, b-2 3/4\n  cache-key        a-1 0/4, a-2 2/4, b-1 0/4, a-3 1/4, none 0/4, b-2 1/4" }
  ]
}
```

The rows are Llama 4 Maverick, DeepSeek V4.1 Flash and `gpt-oss-120b`. The first request with key B missed 12 of 12 times across the three models, on a prefix that had just hit under key A in 9 of those 12 trials. The same prefix with no key also missed 12 of 12, so in our runs "no key" behaved as a namespace of its own. Key A kept hitting after B was used on Llama 4 Maverick and DeepSeek V4.1 Flash (8 of 8); `gpt-oss-120b` hit 1 of 4, in line with its usual misses.

Does a key also improve hit rates, by keeping related requests together? We ran two new prefixes side by side, one with a key and one without, 8 requests each, four times per model. Llama 4 Maverick hit 28 of 28 later requests either way, DeepSeek V4.1 Flash 24 of 28 either way, and `gpt-oss-120b` 10 of 28 either way. The guide says the key does not pin requests to a replica, and it made no difference here.

Use `prompt_cache_key` for what it is for: separating tenants that share a prompt template, and forcing a clean start when you ship a new prompt version. Use a value that is stable per tenant or workload. A request ID as the key gives every request its own empty cache.

## Watch the cached share in production

The cache never fails loudly. A template change that puts a timestamp first looks exactly like a working deploy, until the invoice arrives. The usage block on every response is enough to catch it:

```javascript
// After each streamed response, with stream_options: { include_usage: true }
const prompt = usage.prompt_tokens;
const cached = usage.prompt_tokens_details?.cached_tokens ?? usage.cache_read_input_tokens ?? 0;

metrics.counter('llm_prompt_tokens_total', prompt, { feature, model });
metrics.counter('llm_cached_tokens_total', cached, { feature, model });
// Alert on sum(cached) / sum(prompt) per feature and model, over 15 minutes,
// against that feature's normal rate. A drop right after a deploy points at the prompt first.
```

The DigitalOcean control panel shows the hit rate per model too (Serverless Inference, Analyze tab). Per-feature numbers from your own logs are more useful, because one model usually serves several features and only one of them will break.

## What we could not conclude

- **One afternoon, one account.** All 867 recorded requests ran between 12:48 and 13:55 UTC on 19 October 2026. Hit rates and eviction depend on load: the share of `gpt-oss-120b`'s prompt served from cache went from 68 to 36 percent between two runs about an hour apart.
- **Small samples where it hurts.** The idle table is one request per cell, and the latency table is 5 misses and at most 5 hits per cell. They show direction, not exact values.
- **No view of replicas.** The response does not say which replica served it, so the DeepSeek second-request pattern and the `gpt-oss-120b` misses are described, not explained.
- **The bill check is not done yet.** The repo compares the token counts from the API with the change in the invoice preview. A snapshot taken right after the last request, 68 minutes after the first one, showed no change yet (it is in the repo), so this post uses list prices and the cache read rates from our invoice, not a measured bill.
- **First streamed token, not first answer word.** For the two reasoning models, the latency numbers measure the first reasoning token.
- **Synthetic prompts, ungraded answers.** The runbook is generated, and answers were capped at 48 tokens. This measures input caching, not answer quality.

## What to do with this

1. Put everything static first and keep it byte-identical: system prompt, policies, tool definitions, reference documents. Put the time, request IDs, user names and retrieved passages after it, or in the user message.
2. Log `cached_tokens / prompt_tokens` per feature and model, and alert when it drops. The response does not warn you any other way.
3. Budget at list price and treat the cache as a discount you have to keep earning. On `gpt-oss-120b`, and on prefixes that repeat less than every few minutes, it may not be there.
4. When you compare models for a long-prompt workload, compare cached cost and measured hit rate. On our runbook, DeepSeek V4.1 Flash had the higher input price and the lower input bill.
5. Use `prompt_cache_key` per tenant or per prompt version, never per request.
6. If your prompts are tens of thousands of tokens, the latency win is worth more than the discount: on our 64k prompt, a hit reached the first streamed token about 3.5 times faster on Llama 4 Maverick and 3.4 times faster on DeepSeek V4.1 Flash.

The cache is free, automatic and easy to break. Five minutes with the usage block tells you whether yours is working, and the [harness](https://github.com/The-DevOps-Daily/do-inference-prompt-cache) runs the same tests on your own prompt if you replace the runbook. If you want the per-feature cost side of this, [Knowing What Your AI Feature Costs Before Finance Does](/posts/ai-feature-cost-before-finance-does) shows how to tag usage by feature on one key.
