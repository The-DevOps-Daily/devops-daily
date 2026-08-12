---
title: 'HTTP QUERY Shipped. Your Cache Did Not Get the Memo'
excerpt: 'RFC 10008 gave HTTP its first new method since 2010: QUERY, a request that is safe and idempotent like GET but carries a body like POST. The semantics are the easy part. The hard part is that its cache key includes the request body, which is a change your CDN, your proxy and your browser have not made yet.'
category:
  name: 'Networking'
  slug: 'networking'
date: '2026-08-12'
publishedAt: '2026-08-12T09:00:00Z'
updatedAt: '2026-08-12T09:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Networking
  - HTTP
  - API Design
  - CDN
  - Caching
  - DevOps
---

You have hit this problem. A search endpoint takes a filter object too big and too structured to fit in a query string, so you make it a `POST`. It works. It is also now uncacheable, and every retry framework you own has to be told that this particular POST is actually safe to repeat.

[RFC 10008](https://www.rfc-editor.org/rfc/rfc10008.html), published in June 2026, fixes that with a new method called QUERY. It is the first genuinely new HTTP method since PATCH arrived in [RFC 5789](https://www.rfc-editor.org/rfc/rfc5789.html) in March 2010.

The summary going around is "a GET with a body", which is close enough to be useful and wrong in the way that matters. QUERY is not GET. It is a new method whose response is cacheable **using a cache key that includes the request body**, and that single sentence is why this is an infrastructure story rather than an API design story.

The spec is done. The caching is not. And the caching was the entire point.

## TL;DR

- QUERY is safe, idempotent and cacheable, and it carries a request body. It is a standards-track RFC, not a draft.
- The cache key **MUST** incorporate the request content. Your CDN and reverse proxy currently key on the URL, so they cannot cache QUERY without new code.
- `fetch()` already sends it. Neither Chrome nor Firefox caches the responses, so today you get the semantics without the benefit.
- Cross-origin QUERY triggers a **CORS preflight**, because QUERY is not safelisted. Switching a search box from POST to QUERY can add a round trip and save nothing.
- A gotcha that will cost someone an afternoon: `fetch` only uppercases six method names, and QUERY is not one of them. `method: 'query'` goes on the wire lowercase, and methods are case-sensitive.
- The real blocker is intermediaries. Load balancers, WAFs and proxies with method allowlists reject unknown methods long before your application sees them.

## Prerequisites

- Familiarity with HTTP methods and status codes
- Some exposure to caching headers, or a CDN configuration screen
- Nothing else. There is no tooling to install to follow along.

## What QUERY actually says

The normative text is short and worth reading directly rather than through a summary:

> A QUERY requests that the request target process the enclosed content in a safe and idempotent manner and then respond with the result of that processing.

Three properties come out of that, and each one buys you something concrete:

**Safe.** The RFC says "the client does not request or expect any change to the state of the target resource". Practically, this is what lets a crawler, a prefetcher or an aggressive proxy issue the request without being reckless.

**Idempotent.** "QUERY requests are idempotent; they can be retried or repeated when needed, for instance, after a connection failure." This is the one that quietly deletes code. Every retry policy you have written that carves out an exception for "this POST is actually fine to retry" becomes unnecessary.

**Cacheable.** "The response to a QUERY method is cacheable; a cache MAY use it to satisfy subsequent QUERY requests."

That third one sounds like the smallest of the three. It is the largest, and it is the one nobody has implemented.

## The sentence that makes this an ops problem

Here is the requirement that changes your infrastructure rather than your handlers:

> The cache key for a QUERY request MUST incorporate the request content and related metadata.

Every HTTP cache ever deployed keys on the request URL, plus a `Vary` on some headers. That is the entire model. A `GET /search?q=nginx` is one cache entry because the URL is one string.

QUERY breaks that assumption. Two requests to the identical path with different bodies are different queries and must be different cache entries. So a cache that wants to support QUERY has to read the body, hash it, and make that hash part of the key.

```diagram
{
  "type": "branch",
  "title": "why the cache key has to change",
  "nodes": [
    { "label": "Two requests arrive", "sub": "same path, different bodies", "icon": "net" }
  ],
  "branch": [
    { "label": "URL-only cache key", "sub": "the old model: both look identical, second request gets the first one's answer", "icon": "shield" },
    { "label": "Body-inclusive cache key", "sub": "what RFC 10008 requires: hash the body, two entries, correct answers", "icon": "check" }
  ]
}
```

That is not a configuration flag. It is a change to the hot path of a cache, and it comes with a cost that a URL-keyed cache never had: you must buffer and hash a body before you can decide whether you already have the answer.

## The correctness trap hiding inside it

The RFC flags a failure mode that deserves more attention than it is getting:

> Caches that normalize QUERY content incorrectly or in ways that are significantly different from how the resource processes the content can return an incorrect response.

Caches are permitted to normalise the body when generating the key, so that trivially different bodies are treated as the same query. Consider two requests whose JSON differs only in key order:

```json
{ "status": "active", "max_price": 100 }
{ "max_price": 100, "status": "active" }
```

Semantically identical to your application. A cache that normalises key order treats them as one entry, which is a useful optimisation. But if your server treats them differently for any reason, or if the cache normalises something your server considers significant, the cache now serves confidently wrong answers to real users.

This is the same class of bug as request smuggling and cache poisoning: two components in a chain disagreeing about what a request means. It is not theoretical, and it will be the source of the first serious QUERY incident.

:::warning
If you are building the cache layer, the safe default is to key on the exact bytes of the body and normalise nothing. You lose some hit rate. You do not get to serve one customer another customer's search results.
:::

## Where it stands right now

Being precise about status is the whole value of an article like this, so here is the state as of August 2026, with sources.

| Layer | Status |
| --- | --- |
| The specification | Done. Standards track, [RFC 10008](https://www.rfc-editor.org/rfc/rfc10008.html), June 2026 |
| `fetch()` sending it | Works today, in Chrome and Firefox |
| Browser caching of QUERY | Not implemented in either |
| The Fetch standard | [Open issue](https://github.com/whatwg/fetch/issues/1938), awaiting implementer interest |
| Node.js | Parses QUERY natively |
| CDNs and proxies | Mostly pass it through. Cache support is the gap |

The authorship is worth noticing: Julian Reschke, plus James Snell of Cloudflare and Mike Bishop of Akamai. Two of the three work at CDNs, which is a reasonable signal about where the first real cache implementations will appear.

## Three things that will bite you

### 1. The lowercase trap

This one is genuinely nasty because it fails at the wire level, not in your code. The Fetch standard normalises the case of exactly six method names: DELETE, GET, HEAD, OPTIONS, POST and PUT. QUERY is not among them, and [adding it is still an open question](https://github.com/whatwg/fetch/issues/1938).

HTTP methods are case-sensitive. So this:

```javascript
// Sends the method `query`, lowercase, on the wire.
// Your server is looking for `QUERY` and will answer 405 or 501.
fetch('/search', { method: 'query', body: JSON.stringify(filters) });
```

is not the same as this:

```javascript
fetch('/search', {
  method: 'QUERY',                                    // uppercase, always
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'active', max_price: 100 }),
});
```

With `POST` you can be sloppy about case and the browser fixes it for you. With QUERY it goes out exactly as you typed it.

### 2. The preflight you did not budget for

QUERY is not a CORS-safelisted method, and the RFC says so plainly:

> A QUERY request from user agents implementing Cross-Origin Resource Sharing (CORS) will require a "preflight" request, as QUERY does not belong to the set of CORS-safelisted methods.

If your search endpoint is on a different origin from your front end, every QUERY becomes two round trips: an `OPTIONS` preflight and then the request itself. Your server has to answer the preflight properly:

```text
Access-Control-Allow-Methods: GET, POST, QUERY, OPTIONS
```

Put that together with the fact that no browser caches QUERY responses yet, and a straight swap from POST to QUERY on a cross-origin search box today makes it **slower**, with no cache benefit to pay for the extra trip. The semantics improve. The user experience gets worse.

### 3. Your infrastructure has a method allowlist

This is the one that turns into a production incident rather than a slow page, and it is the reason this is a DevOps article.

Between a browser and your handler sits some combination of CDN, load balancer, WAF, reverse proxy and API gateway. Several of those default to rejecting methods they do not recognise, and plenty of hardened configurations explicitly allow a fixed list. An unknown method typically returns 405 or 501 from the edge, and your application logs show nothing at all, because the request never arrived.

Before writing any QUERY code, find out what your chain does with it:

```terminal
{
  "title": "does QUERY survive the trip?",
  "prompt": "$",
  "steps": [
    { "comment": "send a QUERY through the real path, from outside" },
    { "cmd": "curl -sS -o /dev/null -w '%{http_code}\\n' -X QUERY https://api.example.com/search -H 'Content-Type: application/json' -d '{\"status\":\"active\"}'", "output": "405" },
    { "comment": "405 from the edge, and nothing in the application log" },
    { "comment": "now bypass the edge and hit the service directly" },
    { "cmd": "curl -sS -o /dev/null -w '%{http_code}\\n' -X QUERY http://10.0.1.7:8080/search -H 'Content-Type: application/json' -d '{\"status\":\"active\"}'", "output": "200" },
    { "comment": "the application is fine. the proxy in front of it is not." }
  ]
}
```

Two curl commands, five minutes, and you know whether this is a project or a non-starter. Run it before you plan anything.

## So should you use it

A straight answer, split by what you are actually building.

**Server to server, inside your own network: yes, and soon.** This is where QUERY makes sense today. No CORS, no browser cache to wait for, and you control both ends. You get correct retry semantics for free, and you stop the eternal argument about whether a search POST can be safely repeated. If your services talk to each other over HTTP and one of them has a heavyweight search endpoint, this is a small change with a real payoff.

**Public API, alongside POST: yes, as an addition.** Accept QUERY on the same route, keep POST working, and let clients move when they can. Nothing breaks, and you are ready when caches arrive.

**Browser to server, replacing POST on a search box: not yet.** You inherit a preflight, you gain no caching, and you have added a failure mode at every intermediary. Wait for browser and CDN cache support, because that is the only reason to make this change in the first place.

**As a way to avoid URL length limits: this is the one honest quick win.** If you are currently base64-encoding a filter blob into a query string and fighting an 8KB header limit at your proxy, QUERY solves that today, regardless of caching.

:::tip
The test that decides it: if you cannot answer "what is my CDN's cache key for a QUERY request", you are not getting the benefit yet. Until then QUERY buys you cleaner semantics and better retries, which are worth something, but they are not the reason the method exists.
:::

## What to do this week

Nothing dramatic. Three small things that cost an hour in total and leave you ready.

Run the two curl commands above against your real edge and write down the answer. That number decides everything else.

If you own a service with an expensive search endpoint that is currently a POST, add QUERY as a second accepted method on the same handler. It is a routing change, not a rewrite, and it costs nothing while you wait.

Check your retry policy for POST carve-outs. Every "this POST is safe to retry, honestly" comment in your codebase is a place QUERY will eventually delete code rather than add it.

## Wrapping up

QUERY is a genuinely good addition, and the people who built it knew exactly which problem they were solving. Safe, idempotent, cacheable, with a body. It removes a category of awkwardness that has been in HTTP APIs for two decades.

It is also a useful reminder about how protocol changes actually land. Publishing an RFC is the beginning of the work, not the end. The method exists, browsers will send it, and your application can accept it this afternoon. But the property that makes QUERY worth adopting, a cache that keys on the request body, does not exist in the caches you use yet.

So read the announcements as what they are: the starting gun. The interesting question is not whether QUERY is standardised, because it is. The question is what your CDN does with it, and that one you can answer yourself with curl.
