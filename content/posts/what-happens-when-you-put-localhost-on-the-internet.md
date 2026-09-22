---
title: 'We Put Localhost on the Internet and Watched Who Turned Up'
excerpt: 'A Cloudflare quick tunnel gives you a public URL for a port on your laptop in one command and no account. We ran one in front of a server that logs everything and answers nothing, to find out how long it takes the internet to find you, and what the thing actually costs.'
category:
  name: 'Networking'
  slug: 'networking'
date: '2026-09-22'
publishedAt: '2026-09-22T12:00:00Z'
updatedAt: '2026-09-22T12:00:00Z'
readingTime: '10 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Networking
  - Cloudflare
  - Security
  - Webhooks
  - DevOps
---

You need somebody outside your network to reach something running on your machine. A webhook from Stripe, a designer who wants to click through the branch you are on, a mobile app that will not talk to `localhost`.

One command does it:

```bash
cloudflared tunnel --url http://localhost:3000
```

No account, no signup, no DNS. Thirty seconds later you have `https://something-random-words.trycloudflare.com` pointing at your laptop, with a valid certificate.

That is the whole how-to and you can stop reading if that is what you came for. The interesting question is the one nobody publishes an answer to: **once that URL exists, what finds it, and how fast?**

So we ran one for fourteen hours in front of a server that logs every request and serves a fixed 404, and watched.

## TLDR

- First unsolicited request arrived **1 hour 14 minutes** after the tunnel came up.
- In **13.8 hours** there were **two** unsolicited requests, both a bare `HEAD /` from the same source. No `.env` probing, no `/wp-admin`, no vulnerability scanning.
- We expected minutes and a flood. That is not what the internet does to an unpublished hostname, and the scare version of this article would have been wrong.
- **The real risk is not discovery, it is the URL itself.** It is a bearer token. Anything that sees it can reach your machine, and it goes in plain text into Slack, issue trackers and browser history.
- Measured latency from a Frankfurt server through the tunnel to a Raspberry Pi on a home connection: **188ms p50**. Our own production site behind the same CDN answered in 201ms from the same place.

## What we built

Deliberately inert. A server that reads no files, runs nothing, reflects no input, and answers every request identically:

```javascript
const server = createServer((req, res) => {
  appendFileSync(LOG, JSON.stringify({
    at: new Date().toISOString(),
    method: req.method,
    path: (req.url || "").slice(0, 300),
    ua: (req.headers["user-agent"] || "").slice(0, 300),
    // Cloudflare adds the visitor's address; without it we would only ever
    // see Cloudflare's own edge.
    ip: req.headers["cf-connecting-ip"] || null,
    country: req.headers["cf-ipcountry"] || null,
  }) + "\n");

  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found\n");
});

// Loopback only. The only way in is through the tunnel, so every line in the
// log arrived by the route being measured.
server.listen(PORT, "127.0.0.1");
```

Binding to `127.0.0.1` is the part that makes the measurement mean something. `cloudflared` runs on the same host and connects locally, so nothing can reach the server except through the tunnel.

Then:

```terminal
{
  "title": "bringing it up",
  "prompt": "$",
  "steps": [
    { "cmd": "node honeypot.mjs &", "output": "logging on 127.0.0.1:8477" },
    { "cmd": "cloudflared tunnel --url http://127.0.0.1:8477", "output": "Your quick Tunnel has been created! Visit it at:\nhttps://lynn-poultry-understand-connectivity.trycloudflare.com" }
  ]
}
```

## What turned up

Nothing, for over an hour.

```text
tunnel up                     21:27 UTC
first unsolicited request     22:41 UTC   (1h 14m later)
                              HEAD /   Chrome user agent   US
second, same source           same minute
total in 13.8 hours           2
```

Two requests. Both `HEAD /`, both a desktop Chrome user agent, both from the United States, both within the same minute.

That is not a scanner. A scanner asks for things: `/.env`, `/wp-login.php`, `/.git/config`, `/actuator/health`. This asked for the root, with `HEAD`, and did not come back. It reads like a link checker or a preview fetcher.

**We expected the opposite.** The hypothesis going in was that hostnames appear in certificate transparency logs the moment a tunnel comes up, that people watch those logs continuously, and that the first probe would land in minutes. The first part is true. The rest did not happen.

:::note
Fourteen hours and two requests is one sample, on one hostname, on one day. It is enough to say the first probe is not instant. It is not enough to say it never happens, and a tunnel left up for a week would be a better number than ours.
:::

## So what is the actual risk?

Not discovery. **The URL.**

A quick tunnel URL is an unauthenticated bearer token that happens to look like a web address. There is no password on it. Anything that reaches that string can reach the port on your machine, and that string is going to end up in more places than you think:

- The Slack message where you send it to a colleague, which Slack then unfurls by fetching it
- The issue tracker where you paste it as a reproduction step
- Your browser history, and your colleague's
- Any request your service makes with the URL in a `Referer` header

Look at our result again with that in mind. The thing that found the tunnel in 74 minutes behaved exactly like an automated link fetcher following a URL from somewhere. We never published the hostname anywhere. That leaves certificate transparency, and it means **the first thing to arrive was a machine reading a public log of every certificate issued**, which is the mechanism that should worry you, not a hacker scanning the internet.

The practical rules that follow:

1. **Treat the URL like a password**, because it is one.
2. **Put nothing behind it that you would not put on a public web server.** Not your dev database admin, not a service with your production credentials in its environment.
3. **Stop the tunnel when you stop working.** A quick tunnel dies with the process, which is the one good security property of the disposable kind.
4. **If it needs to live longer than an afternoon, use a named tunnel with Access in front of it.** That is a different product, it needs an account, and it can require a login before the request reaches you.

## What it costs in latency

The measurement everybody skips. From a server in Frankfurt, through Cloudflare, down the tunnel to a Raspberry Pi on a domestic connection, twenty requests:

```chart
{
  "type": "bar",
  "title": "Round trip from a Frankfurt VM, p50 milliseconds",
  "unit": "ms",
  "caption": "The tunnelled Pi is on a home broadband connection. The production site is a real application behind the same CDN. Different work, same vantage point.",
  "rows": [
    { "label": "loopback, no tunnel", "value": 2.4, "series": "local" },
    { "label": "through the quick tunnel", "value": 188, "series": "tunnel" },
    { "label": "our production site, same CDN", "value": 201, "series": "reference" }
  ],
  "series": [
    { "name": "local", "color": "#10b981" },
    { "name": "tunnel", "color": "#f59e0b" },
    { "name": "reference", "color": "#8b5cf6" }
  ]
}
```

188ms at p50, 399ms at p95.

The number worth noticing is the third bar. **A quick tunnel to a Raspberry Pi in somebody's house answered slightly faster than our production application behind the same CDN.** Those are different amounts of work so it is not a clean comparison, but it puts the overhead in perspective: the tunnel is not what makes your page slow.

For the use case people actually reach for this with, receiving webhooks in development, 188ms is irrelevant. The provider does not care and neither do you.

## The use case it is genuinely good at

Webhooks. This is the reason most people install `cloudflared` and it is worth showing properly rather than as a hello world.

You are building against a provider that posts events to a URL. You cannot give it `localhost`. Historically you either deployed to a staging box on every change, or you pasted payloads into a file and replayed them, which tests your parser and nothing else.

```bash
# terminal one
npm run dev                                   # your app on :3000

# terminal two
cloudflared tunnel --url http://localhost:3000
# -> https://sudden-forest-moth-quiet.trycloudflare.com
```

Then point the provider's webhook at `https://sudden-forest-moth-quiet.trycloudflare.com/webhooks/email` and you are debugging real deliveries, with real signatures, against a breakpoint in your editor.

Signature verification is the part that makes this worth doing. A replayed payload from a file will not have a valid signature, so the one piece of code most likely to be wrong is the piece you cannot test without a real request arriving.

Two things to know:

- **The hostname changes every time.** Quick tunnels are disposable by design, so you will be updating the webhook URL on every restart. That is the trade for not needing an account.
- **The provider will retry.** If your app throws while you are stepping through a breakpoint, you will get the same event again, which is either useful or confusing depending on whether you were expecting it.

## What we would do differently

Run it for a week rather than a night. Two requests is a real observation and a thin one, and the interesting question we cannot answer from it is whether the arrival rate changes once a hostname has been seen once.

Publish the hostname somewhere deliberately, in a second run, and measure how the picture changes when the URL leaks the way it leaks in real life. That is the experiment that matches the actual risk, and it is the one we will do next.

## Summary

One command puts a port on the internet with a valid certificate and no account, and that is genuinely useful for webhooks and for showing someone your branch.

The internet did not immediately find it. In fourteen hours, two requests, both harmless looking, the first after 74 minutes. The scare story about scanners racing certificate transparency logs to your laptop did not happen.

The risk that is real is duller and worse. The URL is the only thing standing between the internet and your process, it has no password, and you are about to paste it into Slack.
