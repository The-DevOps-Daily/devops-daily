---
title: 'HTTP QUERY Shipped. Your Cache Did Not Get the Memo'
excerpt: 'RFC 10008 gave HTTP its first new method since 2010: QUERY, a request that is safe and idempotent like GET but carries a body like POST. The semantics are the easy part. The hard part is that its cache key includes the request body, which is not something your CDN or browser does by default yet, and the RFC quietly ships a workaround for exactly that.'
category:
  name: 'Networking'
  slug: 'networking'
date: '2026-08-12'
publishedAt: '2026-08-12T09:00:00Z'
updatedAt: '2026-08-12T09:00:00Z'
readingTime: '14 min read'
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

You have hit this problem. A search endpoint takes a filter object too big and too structured to fit in a query string, so you make it a `POST`. It works, and then every retry policy you own needs an exception saying that this particular POST is actually safe to repeat.

[RFC 10008](https://www.rfc-editor.org/rfc/rfc10008.html), published in June 2026, addresses that with a new method called QUERY. It is the first genuinely new HTTP method since PATCH arrived in [RFC 5789](https://www.rfc-editor.org/rfc/rfc5789.html) in March 2010.

The summary going around is "a GET with a body", which is close enough to be useful and wrong in the way that matters. QUERY is a new method whose response is cacheable **using a cache key that includes the request body**, and that single requirement is why this is an infrastructure story rather than an API design story.

The spec is done. The body-keyed caching is not on by default in the places you deploy. And the RFC anticipated that, which is the part almost nobody is talking about.

## TL;DR

- QUERY is safe, idempotent and cacheable, and it carries a request body. Standards track, not a draft.
- The cache key **MUST** incorporate the request content **and related metadata**. Not just the bytes.
- Browsers send it today but do not cache it. Managed CDNs largely do not accept it yet: CloudFront, for one, allows a fixed list of seven methods and QUERY is not among them.
- The RFC ships an escape hatch: answer with `Location` or `Content-Location` and clients repeat the query with a plain GET, which every cache you own already understands.
- Cross-origin QUERY needs a preflight, but so does the JSON POST you are replacing, and preflights are cached. This costs less than people are claiming.
- Servers **MUST** fail a QUERY with a missing or inconsistent `Content-Type`. There is also an `Accept-Query` response header for advertising support.
- In browsers, `method: 'query'` goes on the wire lowercase and fails. Node's fetch normalises it. Same code, different behaviour.

## Prerequisites

- Familiarity with HTTP methods and status codes
- Some exposure to caching headers, or a CDN configuration screen
- Nothing to install to follow along

## What QUERY actually says

The normative text is short and worth reading directly:

> A QUERY requests that the request target process the enclosed content in a safe and idempotent manner and then respond with the result of that processing.

**Safe.** "The client does not request or expect any change to the state of the target resource." This is what lets a prefetcher or proxy issue the request without being reckless.

**Idempotent.** "QUERY requests are idempotent; they can be retried or repeated when needed, for instance, after a connection failure."

**Cacheable.** "The response to a QUERY method is cacheable; a cache MAY use it to satisfy subsequent QUERY requests."

Two requirements that are easy to miss and will fail your integration tests:

> Servers MUST fail the request if the Content-Type request field is missing or is inconsistent with the request content.

That is a MUST, not a nicety. And for discovery, the RFC defines a response header:

> The "Accept-Query" response header field can be used by a resource to directly signal support for the QUERY method while identifying the specific query format media types that may be used.

So a resource can advertise both that it speaks QUERY and which body formats it accepts. If you are adding QUERY to an API, send `Accept-Query`.

## The requirement that makes this an ops problem

> The cache key for a QUERY request MUST incorporate the request content and related metadata.

RFC 9111 defines a cache's primary key as the request method plus the target URI. In practice most caches you meet are GET-shaped: the URL is the key, with a `Vary` on a few headers. `GET /search?q=nginx` is one entry because the URL is one string.

QUERY does not fit that. Two requests to the same path with different bodies are different queries and need different entries. A cache supporting QUERY has to read the request content before it can decide whether it already holds the answer.

```diagram
{
  "type": "branch",
  "title": "why the cache key has to change",
  "nodes": [
    { "label": "Two requests arrive", "sub": "same path, different bodies", "icon": "net" }
  ],
  "branch": [
    { "label": "URL-only cache key", "sub": "the GET-shaped model: both look identical, so the second request gets the first one's answer", "icon": "shield" },
    { "label": "Content-inclusive key", "sub": "what RFC 10008 requires: the content and its metadata are part of the key", "icon": "check" }
  ]
}
```

Note "and related metadata". Identical bytes under a different `Content-Type` or content coding can mean a different query, so the bytes alone are not a sufficient key.

This pattern is not unprecedented. Varnish has supported hashing request bodies into the cache key for POST for years, with an explicit size cap before it gives up. So the honest claim is not that nobody can do this. It is that **no browser and few managed CDNs do it by default today**, and the ones that adopt it will need a bounded buffering policy, because the bodies QUERY exists to carry are large by definition.

## The correctness trap hiding inside it

The RFC flags a failure mode worth taking seriously:

> Caches that normalize QUERY content incorrectly or in ways that are significantly different from how the resource processes the content can return an incorrect response.

Caches may normalise the body when generating a key, so trivially different bodies hit the same entry. Two requests whose JSON differs only in key order:

```json
{ "status": "active", "max_price": 100 }
{ "max_price": 100, "status": "active" }
```

Semantically identical to most applications, and normalising them into one entry is a useful optimisation. But if the cache normalises something your server treats as significant, it now serves confidently wrong answers.

This is cache key confusion: two components in a chain disagreeing about what a request means.

:::warning
Keying on the exact bytes is a safer default than clever normalisation, but do not mistake it for a security control. The RFC requires content **and related metadata**, and everything in RFC 9111 still applies on top: `Vary`, authorization, `private`, and freshness. Two users can send byte-identical bodies and be entitled to different answers because of a cookie, a token, or content negotiation. If a response depends on who is asking, that must be expressed with `Vary` and the appropriate cache directives, exactly as it would be for GET.
:::

## Where it stands right now

Status sections age badly, so here is what is measured, what is reported, and what is neither. Checked August 2026.

| Layer | Status | Basis |
| --- | --- | --- |
| The specification | Done. Standards track, June 2026 | [RFC 10008](https://www.rfc-editor.org/rfc/rfc10008.html) |
| `fetch()` sending QUERY | Works | QUERY is neither forbidden nor normalised away |
| Browser caching of QUERY | Not implemented in Chrome or Firefox | Reported in the Fetch issue below; Safari untested |
| Fetch standard integration | [Open, awaiting implementer interest](https://github.com/whatwg/fetch/issues/1938) | The issue itself |
| `<form method="query">` | Not integrated into HTML | Still a proposal |
| Node.js | The parser knows QUERY; recent undici normalises it | llhttp method table, undici release notes |
| Managed CDNs | Method allowlists are the blocker. CloudFront permits seven methods, and QUERY is not one | CloudFront allowed-methods docs |

The authorship is a useful signal: Julian Reschke, plus James Snell of Cloudflare and Mike Bishop of Akamai. Two of three work at CDNs, which suggests where the first real cache implementations will land.

## The escape hatch the RFC built in

Here is the part that changes the advice, and it is missing from most coverage.

The RFC does not require you to wait for body-keyed caching. It explicitly offers a handoff to GET:

> A successful response can include a `Content-Location` header containing an identifier for a resource corresponding to the results of the operation; a client can send a GET request for the indicated URI to retrieve the results of the query operation just performed.

And `Location` can point at an equivalent resource so a client can "send a GET request to the indicated URI to repeat the query operation just performed without resending the query content". A `303` sends the client to a plain GET for the result.

So the pattern that works with today's infrastructure is: accept the QUERY, do the work, and answer with a `Content-Location` pointing at a cacheable GET URL for those results. The follow-up traffic is ordinary GET, which every cache, CDN and browser has understood for thirty years.

One redirect detail worth knowing, because it differs from POST: `301` and `302` do **not** rewrite QUERY into GET the way user agents historically did with POST. QUERY is preserved across `301`, `302`, `307` and `308`. Only `303` moves you to GET, which is exactly what `303` has always meant.

## Three things that will bite you

### 1. The lowercase trap, in browsers

The Fetch standard normalises the case of exactly six method names: DELETE, GET, HEAD, OPTIONS, POST and PUT. QUERY is not among them, and [adding it is an open question](https://github.com/whatwg/fetch/issues/1938). HTTP methods are case-sensitive, so in a browser:

```javascript
// Browser: sends the method `query`, lowercase, on the wire.
// Your server is looking for `QUERY` and answers 405 or 501.
fetch('/search', { method: 'query', body: JSON.stringify(filters) });
```

Write it uppercase and always include `Content-Type`, which the RFC requires:

```javascript
fetch('/search', {
  method: 'QUERY',                                    // uppercase, always
  headers: { 'Content-Type': 'application/json' },    // MUST be present and accurate
  body: JSON.stringify({ status: 'active', max_price: 100 }),
});
```

The wrinkle: recent undici, which backs Node's `fetch`, added QUERY to its normalisation. So the same lowercase code can work server-side in Node and fail in a browser. Uppercase it everywhere and the difference stops mattering.

### 2. The preflight, which costs less than you have been told

QUERY is not CORS-safelisted:

> A QUERY request from user agents implementing Cross-Origin Resource Sharing (CORS) will require a "preflight" request, as QUERY does not belong to the set of CORS-safelisted methods.

True, and widely reported as "every QUERY costs two round trips". That overstates it twice over.

First, preflight results are cached. Set `Access-Control-Max-Age` and subsequent requests skip the `OPTIONS`.

Second, and more important: the POST you are replacing almost certainly triggered a preflight already. `application/json` is not a safelisted content type, so a cross-origin JSON POST has always needed a preflight. Swapping it for QUERY usually adds no new preflight at all.

Your preflight response needs more than the methods line:

```text
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: QUERY, POST
Access-Control-Allow-Headers: Content-Type
Access-Control-Max-Age: 86400
```

`Access-Control-Allow-Headers: Content-Type` matters, since QUERY always carries one.

### 3. Your infrastructure has a method allowlist

This is the one that becomes an incident, and the reason this is a DevOps article.

Between the client and your handler sits some combination of CDN, load balancer, WAF, reverse proxy and API gateway. Several reject methods they do not recognise, and hardened configurations often allow a fixed list. CloudFront is a concrete example: it permits a fixed set of seven methods, and QUERY is not one of them. An unknown method typically returns 405 or 501 at the edge, and **your application logs show nothing**, because the request never arrived.

Find out before you write any code:

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

Two commands, five minutes, and you know whether this is a project or a non-starter.

## So should you use it

**Server to server, inside your own network: yes, and soon.** No CORS, no browser cache to wait for, and you control both ends. Retries become semantically clean and you stop arguing about whether a search POST can be repeated.

**Public API, alongside POST: yes, as an addition.** Accept QUERY on the same route, advertise it with `Accept-Query`, keep POST working. Nothing breaks and you are ready when caches arrive.

**Browser to server: only with the GET handoff.** A straight POST-to-QUERY swap gains you nothing today, because no browser caches the response. Answer with `Content-Location` and let the follow-up be a GET, and you get real caching from infrastructure that already exists.

**To escape URL length limits: yes, today.** If you are base64-encoding a filter blob into a query string and fighting an 8KB header limit, QUERY solves that now, caching or not.

:::tip
The question that decides it: can you say what your CDN does with a QUERY request? If the answer is "it returns 405", that is your first task, not the client code. If it is "it passes through but does not cache", reach for `Content-Location` and hand the caching to GET.
:::

## A note on retries

QUERY makes an automatic retry semantically permissible. It does not implement one for you.

Your client still has to know that QUERY is idempotent, decide which failures qualify, enforce limits and hold a replayable body, and a streaming body may not be replayable at all. Undici needed explicit work to classify QUERY as retryable. RFC 9110 already permitted retrying a POST when the client knew it was idempotent; what QUERY changes is that the guarantee is now in the method rather than in a comment in your code. That is worth having, but it is a clarity win, not free behaviour.

## Wrapping up

QUERY is a good addition, and the people who built it knew exactly which problem they were solving. It removes a category of awkwardness that has sat in HTTP APIs for two decades.

It is also a lesson in how protocol changes actually land. Publishing an RFC is the start of the work. The method exists, browsers will send it, and your application can accept it this afternoon, but the property that makes QUERY worth adopting, a cache that keys on the request content, is not switched on in the places you deploy.

The good news is that the authors saw that coming and gave you `Content-Location`. You can adopt the cleaner semantics now and hand the caching to GET, which every cache in the world already understands. That is a better answer than waiting, and it is sitting in section 2 of the RFC where nobody quoting the announcement has bothered to look.
