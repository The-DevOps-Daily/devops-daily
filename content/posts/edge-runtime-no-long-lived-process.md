---
title: 'Where Your Code Runs When There Is No Region'
excerpt: 'The edge compatibility tax people still warn about has mostly been paid off. What is left is stranger and more interesting: you can keep your Node imports, but you cannot keep your process. Two measured demos of what that actually costs.'
category:
  name: 'Cloud'
  slug: 'cloud'
date: '2026-09-15'
publishedAt: '2026-09-15T09:00:00Z'
updatedAt: '2026-09-15T09:00:00Z'
readingTime: '13 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Cloud
  - Serverless
  - Edge
  - Cloudflare
  - Performance
---

Pick a region. Every deployment tool you have used starts there, and the choice carries a whole model with it: a machine, or something shaped like one, running your process, holding your connections, keeping whatever you put in memory until you deploy again.

Edge runtimes ask you to skip that step, and the interesting part is not the latency argument. It is that the thing you stopped choosing was never really the region. It was the process.

This post is about what that costs, measured rather than asserted, and about how the usual warning has quietly gone out of date.

## TLDR

- The compatibility tax is largely paid. On Cloudflare Workers, **Node compatibility is now on by default** for compatibility dates of **2026-08-04 or later**. `node:crypto`, `node:path`, `node:stream` and most of the rest are just there.
- What is still missing is not a list of libraries, it is a **process model**: `node:child_process`, `node:cluster`, `node:worker_threads` and `node:vm` are importable stubs that do not work.
- **A cold start is not slow, it is absent.** Measured below: the same handler answers in **0.003 ms** warm and takes **334 ms** when nothing is running.
- Module-level state, the cache every service builds once at import time, **is a coin flip**. Demonstrated below at a 90% hit rate and a 0% hit rate from identical code.
- The limits are the design document: **128 MB per isolate**, and the global scope must finish **within 1 second**.

## Prerequisites

- Node 18 or newer to run the two demos. Nothing else, no accounts, no cloud.
- Familiarity with deploying a long-running service, which is the thing being compared against.

## The warning that expired

For years the advice about edge runtimes was "you cannot use Node APIs there". It was true, and people built a lot of opinions on it.

Read Cloudflare's current documentation and that sentence no longer holds:

> For compatibility dates of `2026-08-04` or later, Workers enables both `nodejs_compat` and `nodejs_compat_v2` by default.

The supported list is long and boring in the best way: Buffer, Crypto, Events, Path, Process, Stream, URL, Zlib, the file system module, HTTP and HTTPS. If your objection to edge compute was that you would have to rewrite your imports, that objection has been paid off while you were not looking.

**The list that matters now is the other one.** These are importable and do not work:

```text
node:child_process    node:cluster
node:worker_threads   node:vm
node:dgram            node:http2
```

Look at what those five have in common. They are not libraries. **They are the process model**: fork a child, cluster across cores, spawn a thread, hold a UDP socket. The tax is no longer on your dependencies. It is on the assumption underneath them, that you are a long-lived process on a machine you were given.

## What the process was actually doing for you

Here is a handler that builds something at import time, the way every service does. A compiled lookup table, a parsed config, a warmed client:

```js
// work.mjs
import { createHash } from "node:crypto";

const table = new Map();
for (let i = 0; i < 20000; i++) {
  table.set(`key-${i}`, createHash("sha256").update(`key-${i}`).digest("hex"));
}

export function handle(key) {
  return table.get(key) ?? "miss";
}
```

Two harnesses, the same handler. One keeps a process alive and answers fifty requests from it. The other starts a fresh process per request, which is what "no long-lived process" means when you take it literally:

```terminal
{
  "title": "the cost of nothing running",
  "prompt": "$",
  "steps": [
    { "comment": "same handler, same machine, 50 requests each" },
    { "cmd": "node warm.mjs && node measure-cold.mjs", "output": "warm     n=50  median 0.003 ms  p95 0.014 ms\ncold     n=50  median 334.1 ms  p95 373.4 ms" }
  ]
}
```

**Five orders of magnitude.** Not because the work is hard, the work is a `Map.get`, but because the setup was being amortised across every request and now it is not.

Be careful what you take from those numbers. They are a Raspberry Pi 4 and Node 24, and they are the cost of a **process**, which is the expensive end of the range. An isolate is much cheaper than a process, which is the entire architectural argument for isolates. What the measurement shows is not "edge is slow", it is the size of the thing amortisation was hiding, and therefore how much you should care about what you do at import time.

That is also why the 1 second global-scope budget exists:

> A Worker must parse and execute its global scope (top-level code outside of handlers) within 1 second.

In a long-lived process, slow startup is a deploy-time annoyance you absorb once. Where there is no process, your import-time work is on a stopwatch.

## The cache that is not there

The subtler problem is not speed, it is that code which looks correct stops being correct.

```js
// cache.mjs, the pattern every Node service uses
const cache = new Map();

export function lookup(key) {
  if (cache.has(key)) { hits += 1; return cache.get(key); }
  misses += 1;
  const value = `computed:${key}`;
  cache.set(key, value);
  return value;
}
```

Ten requests for the same key, first from one process and then from a fresh process each time:

```terminal
{
  "title": "same code, two worlds",
  "prompt": "$",
  "steps": [
    { "comment": "ten requests for the same key" },
    { "cmd": "node state.mjs", "output": "One process handling ten requests for the same key:\n  {\"hits\":9,\"misses\":1,\"size\":1}\nThe same ten requests, each in a fresh process:\n   {\"hits\":0,\"misses\":1,\"size\":1}\n   {\"hits\":0,\"misses\":1,\"size\":1}\n   {\"hits\":0,\"misses\":1,\"size\":1}\n   {\"hits\":0,\"misses\":1,\"size\":1}" }
  ]
}
```

**Nine hits out of ten, or none.** The code did not change and it did not fail. It produced correct answers and a cache hit rate of zero.

This is the shape of the real bugs: not a crash, but a rate limiter that never limits because its counter resets, a deduplication check that never dedupes, a "warm up the connection pool at startup" that pays the warm-up on every request instead of amortising it.

And the honest version of this on a real edge runtime is worse than the demo, because it is neither of these two outcomes. An isolate **does** persist across requests, until it does not:

> When an isolate exceeds 128 MB, the Workers runtime lets in-flight requests complete and creates a new isolate for subsequent requests.

So your module-level cache works, most of the time, with a hit rate you did not choose and cannot predict. That is harder to reason about than either column above.

```diagram
{
  "type": "branch",
  "nodes": [
    { "label": "request", "sub": "arrives", "icon": "globe", "tone": "slate" },
    { "label": "isolate", "sub": "already warm?", "icon": "cpu", "tone": "amber" }
  ],
  "branch": [
    { "label": "reuses your module state", "variant": "good" },
    { "label": "fresh global scope, 1s budget", "variant": "bad" }
  ]
}
```

## The limits are the design document

Two numbers do more to shape an edge service than any tutorial:

| | |
|---|---|
| Memory per isolate | **128 MB**, JavaScript heap and WebAssembly together |
| Global scope execution | **1 second** |
| Worker size, uncompressed | 64 MiB |
| CPU time per request | 10 ms free, up to 5 minutes paid, 30 seconds by default |

The memory figure is the one that changes designs. 128 MB is not a per-request allowance you will casually exceed on a JSON response; it is the ceiling for everything your isolate holds, including the caches you were tempted to build in the previous section. It is why "just keep it in memory" stops being the cheap answer and an actual storage product starts being the answer.

The CPU figure is worth reading twice, because CPU time is not wall-clock time. Waiting on a fetch is not CPU. A 10 ms CPU budget is far more generous than it sounds for a service that mostly calls other services, and completely unworkable for one that does real computation.

## Where the vendors actually sit

The word "edge" is doing too much work in most of this market. It is more useful to sort by what happens between requests.

**[Cloudflare Workers](https://developers.cloudflare.com/workers/)** is the reference implementation of "no process": V8 isolates, no machine to think about, the limits above. **[Deno Deploy](https://deno.com/deploy)** takes the same isolate model and starts from a Web-standard API surface rather than arriving at it.

**[Vercel](https://vercel.com)** is the useful case to study because it offers both, and makes you choose per function. That choice is exactly the trade in this post, exposed as a config line.

**[Fly.io](https://fly.io)**, **[Railway](https://railway.app)** and **[Render](https://render.com)** are the other answer, and they are not edge runtimes pretending to be simpler. They give you the process back, in a container, in a region you pick, and they compete on making that pleasant rather than on removing it. Fly's machines can stop when idle and start on a request, which is a middle position worth understanding: you keep the process model and pay a real start-up cost when you have been quiet.

None of these is the upgrade of another. They are answers to "should there be a process" and that question has two defensible answers.

## What to do with this

- **Look at what your import-time code does**, because on an isolate that is on a stopwatch and it is not amortised the way you assume.
- **Grep your codebase for module-level mutable state.** Every `const cache = new Map()` at the top of a file is a correctness question, not a performance one.
- **Check whether you actually need the process model.** If nothing in your service forks, threads or holds a socket, the tax is smaller than the old advice suggests. If something does, that is your answer and no compatibility flag changes it.
- **Count your memory, not your response size.** 128 MB is everything the isolate holds.
- **Separate CPU time from wall-clock time** before deciding a limit is too low.

## Summary

The interesting thing about edge compute stopped being the API surface. Cloudflare turning Node compatibility on by default is the quiet end of an argument that ran for years.

What is left is a genuine architectural difference and it is not about regions at all. You are being asked to give up a long-lived process, and most of what you know about caching, warm-up and start-up cost was quietly built on having one. The two demos above take about five minutes to run and will tell you more about whether that trade suits your service than any latency map.
