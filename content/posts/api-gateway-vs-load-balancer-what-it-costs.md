---
title: 'API Gateway or Load Balancer? What Each Gateway Feature Costs, Measured'
excerpt: 'We put the same backend behind nginx, Kong and Tyk, turned on TLS, API keys, a rate limit and a header rewrite one at a time, and measured the latency and CPU each one added. nginx did all four for almost nothing. Kong spent most of its extra CPU on one line of its rate limiter, and the same 10 requests per second meant three different things.'
category:
  name: 'Networking'
  slug: 'networking'
date: '2026-11-27'
publishedAt: '2026-11-27T07:07:00Z'
updatedAt: '2026-11-27T07:07:00Z'
readingTime: '20 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Networking
  - API Gateway
  - Load Balancing
  - NGINX
  - Kong
  - Tyk
  - Rate Limiting
  - Performance
---

We put the same small JSON API behind three proxies: plain nginx, Kong Gateway OSS and Tyk Gateway OSS. On each one we turned on the features people buy a gateway for, one at a time: TLS, an API key check, a per-key rate limit and a header rewrite. Then we sent the same fixed load through every step and read each proxy's CPU time from its cgroup.

In this setup, nginx did all four for roughly the cost of the proxy hop itself. With every feature on at 2,000 requests per second, it used **117 ms of CPU per 1,000 requests** and answered at a median of **0.39 ms**. Kong needed **495 ms** of CPU for the same work and Tyk **482 ms**, about four times as much. Kong was close to the end of its single core, and Tyk built up a backlog: counting the time requests waited to be sent, its median was half a second. For Kong, two thirds of the gap came from one feature: its rate limiter added **259 to 473 ms per 1,000 requests**, because it counts every request in a new timer. With that one condition patched to count inline, the rate limit added 18 to 59 ms.

That does not make gateways a bad idea. It means the question "gateway or load balancer?" is mostly a question about **consumers**, not about requests: who holds the keys, who changes them, and who pays for which limit. The request-level features were cheap in nginx here, and you probably already have them.

```github
The-DevOps-Daily/api-gateway-vs-load-balancer
```

## TL;DR

- **One proxy hop added about 0.2 to 0.3 ms at the median, on one host with no network in between.** The backend on its own answered at 0.25 ms; behind nginx, Kong or Tyk with nothing turned on, at 0.43 to 0.56 ms (1,000 requests per second).
- **nginx's features were too small to separate from run-to-run variation.** TLS, a key check, a per-key `limit_req` and three header changes each moved its CPU by -43 to +54 ms per 1,000 requests, in both directions, while a single cell varied by up to 83 ms between runs.
- **Kong's rate limit was the most expensive feature in the test:** +259 ms per 1,000 requests at 2,000 per second and +473 ms at 1,000 per second, with p99 latency going from 8 ms to 47 ms. Kong 3.9 counts each request for the `local` policy in an `ngx.timer.at(0, ...)` timer; patched to count inline, the same limit added 18 to 59 ms.
- **Tyk's cost was in the key check** (+88 to +129 ms per 1,000 requests), and its rate limit was close to free. On one core it could not hold a schedule of 2,000 requests per second without long backlogs once keys were on: counting the time requests waited to be sent, its median was 7.5 ms with keys and 516 ms with every feature on. On two cores, 1.2 ms.
- **"10 requests per second" let through 1 to 2, exactly 10, or 10 to 20 requests** of 50 concurrent requests, depending on the proxy.
- **Anonymous memory under load:** nginx 6 MiB, Kong 170 to 176 MiB, Tyk 74 to 114 MiB plus about 5 MiB for Redis.
- **A classic nginx keepalive trap is fixed by the 1.30 defaults.** On nginx 1.28.3, one `proxy_set_header` in a location turned off upstream keepalive while every response stayed correct: a backend connection per request and 76 to 86 ms more CPU per 1,000 requests. nginx 1.29.7 made upstream keepalive the default, and the same config on 1.30.7 kept its connections.
- **At 1,000 requests per second, around the clock, AWS API Gateway's request charges alone would be $6,822 a month** for a REST API, which has API keys and usage plans, or $2,363 for an HTTP API, which does not. The same traffic used less than one core here.

## Prerequisites

- A rough idea of what a reverse proxy and a load balancer do.
- If you want to run the repo: a Linux x86_64 machine with 4 or more CPUs, Docker with Compose, and Python 3.10 or newer. The main run takes about 90 minutes on a quiet machine, and the extra tests about as long again.

## What a gateway adds that nginx does not

Most lists of gateway features are mostly load balancer features: TLS termination, routing by host and path, retries, header rewrites. nginx does all of them. It also does more of the gateway list than many people expect. The nginx config in the repo checks a static API key with a `map`, limits each key with `limit_req`, removes the key before the request reaches the backend, and rewrites headers in both directions. It passes the same functional checks as Kong and Tyk.

What nginx does not give you is the part that is about **consumers** rather than requests:

| Need                                              | nginx (open source)                                                                                                          | Kong Gateway OSS 3.9                                                             | Tyk Gateway OSS 5.16                                                             |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Static API keys                                   | a `map` in the config, reload to change                                                                                      | yes                                                                              | yes                                                                              |
| Issue and revoke keys at runtime                  | no                                                                                                                           | Admin API with a database, or new declarative config in DB-less mode             | control API, keys stored in Redis                                                |
| Named consumers with their own limits and plugins | no                                                                                                                           | yes                                                                              | yes, per key and per policy                                                      |
| Quotas, such as requests per month                | no                                                                                                                           | rate-limiting windows up to a year                                               | quotas per key                                                                   |
| JWT validation                                    | no built-in module; the official [`auth_jwt`](https://nginx.org/en/docs/http/ngx_http_auth_jwt_module.html) needs NGINX Plus | `jwt` plugin                                                                     | built in                                                                         |
| Per-route and per-consumer metrics                | `stub_status` counts the whole server only                                                                                   | Prometheus plugin                                                                | analytics through Redis and Tyk Pump                                             |
| Developer portal                                  | no                                                                                                                           | [Konnect](https://developer.konghq.com/dev-portal/), not the open source gateway | [paid product](https://tyk.io/docs/tyk-open-source), not the open source gateway |

The first row is the dividing line. If your keys change twice a year and nobody outside your company calls the API, nginx or the load balancer you already run covers it. If you give keys to customers, revoke them when a payment fails, and sell plans with different limits, every row after the first is code you would otherwise write yourself.

If you are choosing a reverse proxy rather than a gateway, the [nginx vs Traefik comparison](/comparisons/nginx-vs-traefik) covers that decision, and the [load balancing chapter](/guides/networking-fundamentals/05-load-balancing) of the networking guide covers the basics.

## How we measured it

Everything ran on one 4 vCPU DigitalOcean droplet, with each part pinned to its own vCPU. Pinning does not keep other processes off those vCPUs, so the bench also measured how much CPU everything else used during each run (more on that below):

```diagram
{
  "type": "infra",
  "flow": [
    { "label": "vegeta", "sub": "fixed rate, up to 64 in flight", "icon": "activity", "tone": "slate" },
    { "label": "proxy under test", "sub": "nginx, Kong or Tyk", "icon": "shield", "tone": "accent" },
    { "label": "backend", "sub": "Go JSON API", "icon": "box", "tone": "blue" }
  ],
  "groups": [
    {
      "label": "4 vCPU droplet",
      "sub": "Docker Compose, host networking",
      "icon": "server",
      "tone": "slate",
      "nodes": [
        { "label": "core 0", "sub": "load generator", "icon": "activity", "tone": "slate" },
        { "label": "core 1", "sub": "the proxy, one at a time", "icon": "shield", "tone": "accent" },
        { "label": "core 2", "sub": "backend", "icon": "box", "tone": "blue" },
        { "label": "core 3", "sub": "Redis, for Tyk", "icon": "database", "tone": "red" }
      ]
    }
  ]
}
```

- **The proxies:** nginx 1.30.7 with one worker, Kong Gateway OSS 3.9.5 in DB-less mode with one worker, and Tyk Gateway OSS 5.16.0 with `GOMAXPROCS=1` and its Redis on a separate core. Access logs were off on all three, with TLS 1.3 only and HTTP/1.1. As of November 2026, the open source Kong image on Docker Hub is still on the 3.9 line, and newer Kong releases ship as Enterprise images.
- **The ladder:** five routes on each proxy, each adding one feature to the one before. `plain` is the proxy only, over HTTP. `tls` adds TLS from the client. `auth` adds an API key check and strips the key before the backend. `ratelimit` adds a per-key limit set far above the test rate, so it counts every request and refuses none. `transform` adds a request header, removes a response header and adds another.
- **The load:** vegeta 12.13.0 at a fixed 1,000 and 2,000 requests per second for 30 seconds, after a 10-second warm-up, with at most 64 requests and 64 keepalive connections in flight. A fixed rate matters: a closed-loop tool slows down when the proxy slows down, and the proxy's own latency disappears from the result. The cap of 64 brings a little of that back, because when all 64 are waiting, the next request is sent late. We measured that lag separately; it is in the latency section below.
- **The CPU:** read from each container's cgroup (`cpu.stat`) before and after the window and divided by the number of requests. Tyk's numbers include its Redis, which used 1 to 4 ms per 1,000 requests. Memory is the anonymous memory of each container (`memory.stat`) at the end of each run, not a peak.
- **Repeats:** three passed runs per cell (two for Tyk with its rate limit at 2,000 per second), in a new random order each round. Each feature's cost below is the difference between the median of its cell and the median of the cell below, with the widest range the runs allow.

The cap on connections came from a failed first attempt. Our first smoke runs let vegeta open as many connections as it wanted. When a proxy slowed down for a moment, vegeta opened more connections to keep the rate, each new one cost the proxy a TLS handshake, and the proxy slowed down further. Within seconds, nginx with TLS at 3,000 requests per second had a 500 ms median, and Kong logged `1024 worker_connections are not enough`. That is a real failure mode, a retry storm in miniature, but it measures the client, not the proxy. A fixed pool is closer to a fleet of app servers with connection pools. Those smoke runs were not kept, so the two numbers above come from the console output we saw at the time, not from a file in the repo.

A run counted only if every request got a 200, the backend's own count of requests matched the client's count of 200s, the proxy logged no errors other than clients dropping a connection during the TLS handshake (Tyk logged 48 of those across 1.29 million requests in its passed runs; none of them was a failed request), the load generator had CPU to spare, and at least 99% of the scheduled requests were sent. The lowest accepted run, Tyk with its rate limit at 2,000 per second, sent 59,443 of 60,000. Before any timing, `verify.py` checks every step on every proxy with exact expectations: 200 with the key, 401 without it, the key gone before the backend, the response header removed, the new headers added, and a 10-per-second limit that lets some of 50 concurrent requests through and refuses most of them. If the auth step let every request through, the numbers would mean nothing. One gap: on Tyk, the limit test route uses an API-wide limit, while the benchmarked rate limit step uses the per-key limit, so the check does not prove that the per-key limiter counted.

The droplet is shared with other work, and twice during the run another job used one to two cores. So `bench.py` waits until the rest of the machine has been idle for 5 seconds before each run, measures what everything else used during the run (whole host, minus our containers and the load generator), and fails any run where that was more than 0.3 cores. Failed cells were run again in later rounds, up to six rounds. 95 runs passed and 19 failed: 16 for contention, and 3 because fewer than 99% of the scheduled requests were sent. Tyk with its rate limit at 2,000 requests per second sent 58,309 and 59,332 of 60,000 requests in two runs, and nginx with every feature on sent 55,613 in one run with 5.5% hypervisor steal. Those three are count failures, and the tables only show the runs that passed. Every run from the published benchmark invocations, including the failed ones, is in `results/`.

## The cost of each step

Median latency first, at 2,000 requests per second. The bar is the median, the tick is p99:

```chart
{
  "type": "bar",
  "title": "Median latency per step at 2,000 requests/s (tick: p99)",
  "unit": "ms",
  "caption": "Median of 3 passed runs per cell (Tyk with rate limit: 2). 30 s at a fixed rate, at most 64 requests in flight, one core per proxy. Backend alone: 0.23 ms median, 0.86 ms p99. Source: results/main-b57582404be80918/summary.json.",
  "rows": [
    { "label": "nginx plain", "value": 0.37, "tick": 2.07, "series": "nginx" },
    { "label": "nginx +TLS", "value": 0.39, "tick": 9.26, "series": "nginx" },
    { "label": "nginx +auth", "value": 0.42, "tick": 9.91, "series": "nginx" },
    { "label": "nginx +rate limit", "value": 0.42, "tick": 2.6, "series": "nginx" },
    { "label": "nginx +transform", "value": 0.39, "tick": 3.03, "series": "nginx" },
    { "label": "Kong plain", "value": 0.45, "tick": 2.05, "series": "Kong" },
    { "label": "Kong +TLS", "value": 0.56, "tick": 3.39, "series": "Kong" },
    { "label": "Kong +auth", "value": 0.59, "tick": 8.43, "series": "Kong" },
    { "label": "Kong +rate limit", "value": 1.68, "tick": 47.32, "series": "Kong" },
    { "label": "Kong +transform", "value": 1.78, "tick": 52.79, "series": "Kong" },
    { "label": "Tyk plain", "value": 0.61, "tick": 41.8, "series": "Tyk" },
    { "label": "Tyk +TLS", "value": 0.69, "tick": 45.97, "series": "Tyk" },
    { "label": "Tyk +auth", "value": 7.43, "tick": 70.28, "series": "Tyk" },
    { "label": "Tyk +rate limit", "value": 17.36, "tick": 71.42, "series": "Tyk" },
    { "label": "Tyk +transform", "value": 22.13, "tick": 80.67, "series": "Tyk" }
  ],
  "series": [
    { "name": "nginx", "color": "#10b981" },
    { "name": "Kong", "color": "#0ea5e9" },
    { "name": "Tyk", "color": "#f59e0b" }
  ]
}
```

nginx's median stayed between 0.37 and 0.42 ms from the first step to the last. Kong stayed under 0.6 ms until the rate limit, then went to 1.7 ms with a p99 of 47 ms. Tyk's medians of 7 to 22 ms at the top of its ladder are most likely queueing rather than work per request: it used 0.83 to 0.96 of its core on those steps, and its CPU per request rose far less than its latency did. Its median across the three passed runs with keys on ranged from 1.1 to 18.7 ms, so it was sitting right at the edge, and the send lag below shows how far behind it fell.

Those are the latencies vegeta measured, and for the slowest steps they are too kind. vegeta never had more than 64 requests in flight. When all 64 were waiting on a slow proxy, the next request went out late, and the time it spent waiting to be sent is not part of its measured latency. This is coordinated omission. `lag.py` estimates it from the raw results: it takes the first recorded request as the start of the schedule, compares each later request's send time with its slot (one every 0.5 ms at 2,000 per second), and adds the difference to that request's latency. It is an estimate: it only covers requests that were sent, and it cannot say how an unlimited client would have behaved. For nginx and for Kong without its rate limit, the cell medians of the p99 send lag stayed under 2 ms, though single runs had tails (one nginx run with keys reached 121 ms). For the steps near a full core, the lag was large:

| At 2,000 requests/s | Send lag, p99 | p99 as measured | p99 with the lag added back | Median with the lag added back |
| ------------------- | ------------- | --------------- | --------------------------- | ------------------------------ |
| Kong + rate limit   | 99 ms         | 47 ms           | 131 ms                      | 2.0 ms                         |
| Kong + transform    | 60 ms         | 53 ms           | 92 ms                       | 2.0 ms                         |
| Tyk plain           | 64 ms         | 42 ms           | 97 ms                       | 0.6 ms                         |
| Tyk + key check     | 298 ms        | 70 ms           | 330 ms                      | 7.5 ms                         |
| Tyk + rate limit    | 200 ms        | 71 ms           | 234 ms                      | 22 ms                          |
| Tyk + transform     | 1,089 ms      | 81 ms           | 1,123 ms                    | 516 ms                         |

Medians over the passed runs (`results/main-b57582404be80918/lag.json`). Even small scheduling jitter moves medians in this table, by anywhere from nothing to about 0.4 ms (the backend alone goes from 0.23 to 0.65 ms), so compare medians within this table, not with the chart above. The last row is the one to remember: with every feature on, Tyk on one core fell up to 1.8 seconds behind the schedule, and its three runs had adjusted medians of 10 ms, 516 ms and 1.2 seconds. Our pass rule (at least 99% of the requests sent within the run) did not catch that: it counts requests, it does not time them, and vegeta caught up by the end of each run. On two cores, the same step had a 1.2 ms median and a 55 ms p99 with the lag added back.

Latency at this rate mostly shows how close each proxy is to running out of CPU. The CPU itself is the cleaner number:

```chart
{
  "type": "bar",
  "title": "CPU per 1,000 requests at 2,000 requests/s",
  "unit": "ms",
  "caption": "Proxy CPU time from its cgroup divided by requests, median of 3 passed runs (Tyk with rate limit: 2). Tyk includes its Redis (1 to 2 ms). 1,000 ms per 1,000 requests at 1,000 requests/s is one full core. Source: results/main-b57582404be80918/summary.json.",
  "rows": [
    { "label": "nginx plain", "value": 102, "series": "nginx" },
    { "label": "nginx +TLS", "value": 123, "series": "nginx" },
    { "label": "nginx +auth", "value": 131, "series": "nginx" },
    { "label": "nginx +rate limit", "value": 126, "series": "nginx" },
    { "label": "nginx +transform", "value": 117, "series": "nginx" },
    { "label": "Kong plain", "value": 158, "series": "Kong" },
    { "label": "Kong +TLS", "value": 199, "series": "Kong" },
    { "label": "Kong +auth", "value": 233, "series": "Kong" },
    { "label": "Kong +rate limit", "value": 492, "series": "Kong" },
    { "label": "Kong +transform", "value": 495, "series": "Kong" },
    { "label": "Tyk plain", "value": 279, "series": "Tyk" },
    { "label": "Tyk +TLS", "value": 328, "series": "Tyk" },
    { "label": "Tyk +auth", "value": 416, "series": "Tyk" },
    { "label": "Tyk +rate limit", "value": 439, "series": "Tyk" },
    { "label": "Tyk +transform", "value": 482, "series": "Tyk" }
  ],
  "series": [
    { "name": "nginx", "color": "#10b981" },
    { "name": "Kong", "color": "#0ea5e9" },
    { "name": "Tyk", "color": "#f59e0b" }
  ]
}
```

At 2,000 requests per second, 500 ms per 1,000 requests is one full core. Kong with its rate limit on (0.98 of a core) and Tyk with the whole ladder on (0.96) were both close to it. nginx with everything on used about a quarter of its core.

Here is what each feature added: the median of its cell minus the median of the cell below it.

| Feature            | nginx     | Kong            | Tyk        |
| ------------------ | --------- | --------------- | ---------- |
| + TLS (keepalive)  | +21 / -24 | +40 / +150      | +48 / +23  |
| + API key check    | +8 / -1   | +34 / -41       | +88 / +129 |
| + rate limit       | -6 / +54  | **+259 / +473** | +22 / -3   |
| + header transform | -9 / -43  | +3 / +44        | +43 / +57  |

The numbers are ms of CPU per 1,000 requests, at 2,000 / 1,000 requests per second. Three runs per cell cannot pin down small costs: nginx's plain step alone ranged from 146 to 229 ms at 1,000 per second, while Kong's TLS step stayed within 365 to 367. So read each value together with its range in `results/main-b57582404be80918/summary.md` (the lowest and highest difference the runs allow, which is a description, not a confidence interval). Kong's TLS step at 2,000 per second (+31 to +54) is a real cost; nginx's rate limit at 1,000 per second (-39 to +68) is not something three runs can settle, and neither are the negative values.

Two things in this table do not fit the "gateways are slow" story. Tyk's rate limiter was almost free. That matches its design: by default Tyk uses a [distributed rate limiter](https://tyk.io/docs/api-management/rate-limit) that keeps the counters in each gateway's memory, and Redis did not get busier when the limit was on (1 to 3 ms per 1,000 requests at every step). And Kong without its rate limit is not far from nginx. With TLS and keys on at 2,000 requests per second it used 233 ms against nginx's 131 ms. Most of the gap between Kong and nginx is one plugin.

### Why CPU per request falls as the rate rises

Every proxy used less CPU per request at 2,000 requests per second than at 1,000. nginx with nothing on went from 183 ms to 102 ms per 1,000 requests, and Kong from 217 to 158. We did not profile this. The likely reason is that at a lower rate each request more often finds the process asleep and pays for the wakeup and the event loop round on its own, while at a higher rate those costs are shared. So "CPU per 1,000 requests" is a number for a given rate, and the same table at 200 or 20,000 requests per second would differ. The comparison between the proxies held at both rates we measured.

## Kong's rate limit: one timer per request

A feature that costs as much as Kong's whole proxy path is worth reading. This is the end of the `access` handler in Kong 3.9.5's rate-limiting plugin, copied from the image we ran:

```lua
  if conf.sync_rate ~= SYNC_RATE_REALTIME and conf.policy == "redis" then
    increment(false, conf, limits, identifier, current_timestamp, 1)

  else
    local ok, err = timer_at(0, increment, conf, limits, identifier, current_timestamp, 1)
    if not ok then
      kong.log.err("failed to create timer: ", err)
    end
  end
```

For the `local` policy, the default for a single node, every request that passes the check schedules a new `ngx.timer.at(0, ...)` timer that runs the counter update after the request has moved on. An OpenResty timer is not free: each one runs its callback in a new light thread with its own coroutine, outside the request.

Deferring the count may have a second effect: requests that arrive together can all read the counter before any of them has updated it. That is consistent with the burst tests below, where stock Kong let up to 20 of 50 concurrent requests through a limit of 10, but a burst that crosses a one-second window boundary can also do that, and our test did not record which window each request landed in.

To check that this line is the cost, `explain-kong-timer.sh` copies the handler out of the image, changes the condition so the `local` policy counts inline, mounts the patched file into a second Kong container, and times both side by side:

| Kong 3.9.5, at 1,000 / 2,000 requests/s | CPU per 1,000 requests | Median         | p99            |
| --------------------------------------- | ---------------------- | -------------- | -------------- |
| stock: key check only                   | 310 / 210 ms           | 0.59 / 0.54 ms | 2.5 / 3.1 ms   |
| stock: + rate limit                     | 739 / 480 ms           | 1.07 / 1.58 ms | 19.3 / 46.8 ms |
| patched: key check only                 | 308 / 216 ms           | 0.59 / 0.59 ms | 2.7 / 4.3 ms   |
| patched: + rate limit                   | 326 / 275 ms           | 0.59 / 0.64 ms | 3.7 / 38.9 ms  |

Three passed runs per cell, both containers pinned to the same core and run one at a time in a shuffled order (`results/explain-kong-timer-de3b51401329efe5`). In stock Kong the rate limit added 429 / 270 ms per 1,000 requests; in the patched one, 18 / 59 ms. The patch removed about 96% of the CPU the rate limit added at 1,000 requests per second and 78% at 2,000, and the median returned close to the key-check-only baseline.

It did not explain everything. At 2,000 requests per second, p99 with the patch stayed at 39 ms, against 4 ms with the key check alone, and we did not find the cause of that tail. The burst test changed too: the patched Kong let exactly 10 requests through in each of five bursts, while the stock one, in the same session, let through 20, 11, 10, 10 and 10. Five bursts are too few to say how often the stock version overshoots, only that the patched one did not in this test.

We are not suggesting you patch your gateway. Kong probably defers the count so that a slow `redis` or `cluster` policy never holds up the request, and the code path is shared. The point is narrower: if you rate limit in Kong on one node, most of the cost is in the deferred counting, not in the check, and a one-line change made that visible.

## "10 requests per second" means three different things

Each proxy had a test route limited to 10 requests per second. In nginx the limit is keyed on the API key, in Kong on the consumer, and in Tyk it is the route's `global_rate_limit`; with one key, all three count the same requests. We sent five bursts of 50 concurrent requests, each on its own new TLS connection, three seconds apart, and then a steady 25 requests per second for 20 seconds:

| Proxy                              | Passed in each burst of 50 | Passed at a steady 25/s for 20 s | Per second |
| ---------------------------------- | -------------------------- | -------------------------------- | ---------- |
| nginx `limit_req rate=10r/s`       | 2, 2, 1, 1, 1              | 167 of 500                       | 8.35       |
| Kong `rate-limiting second: 10`    | 10, 12, 13, 13, 11         | 207 of 500                       | 10.35      |
| Tyk `global_rate_limit` 10 per 1 s | 10, 10, 10, 10, 10         | 200 of 500                       | 10.00      |

Everything that did not pass got a 429, and the backend's count matched the passed requests exactly (`results/limit-semantics.json`). In the second session, run for the Kong patch above, stock Kong passed 20, 11, 10, 10 and 10.

All three are behaving as written; they implement different algorithms. nginx's `limit_req` is a leaky bucket that allows one request per 100 ms, and without a `burst` setting it refuses everything that arrives faster. At a steady 25 per second, requests arrive every 40 ms, so the first free slot after each accepted one is 120 ms later: 8.3 per second, below the limit. Kong counts a fixed window of one second, so a burst that crosses a second boundary can get two windows' worth, and the deferred counting above may let a few extra through. Tyk let through exactly 10 every time.

None of these is wrong, but they are different contracts. If you move from one to another, or document a limit for customers, test the burst behaviour rather than trusting the number. The [rate limit simulator](/games/rate-limit-simulator) shows the token bucket, leaky bucket and window algorithms side by side, and [designing rate limiting for APIs](/posts/designing-rate-limiting-for-apis) covers which to choose.

## The nginx keepalive trap, and the version that removed it

There is a well-known way to make nginx look expensive by accident. The `http` block sets the headers that upstream keepalive needs:

```nginx
proxy_http_version 1.1;
proxy_set_header Connection "";
proxy_set_header Host $host;
```

Then a location strips the API key before the backend:

```nginx
location /auth {
    if ($key_ok = 0) { return 401; }
    proxy_set_header apikey "";      # drops the inherited proxy_set_header lines
    proxy_pass http://backend;
}
```

nginx inherits `proxy_set_header` from the outer block **only if the inner block sets none of its own**. One `proxy_set_header` in a location throws away all the inherited ones, including `Connection ""`. Every response is still correct, so a functional check passes.

Our config repeats the lines in every location that sets its own header. To measure what the mistake costs, the repo also keeps a broken copy, `nginx/nginx-broken-keepalive.conf`, and the backend counts every new connection it accepts. On nginx 1.30.7, the broken copy did not break: over 12 runs of 30,000 to 60,000 requests, the backend saw 17 to 80 new connections per run, against 1 to 73 for the correct config, and the CPU was the same within noise (`results/break-keepalive-de3b51401329efe5`). [nginx 1.29.7](https://nginx.org/en/CHANGES-1.30) changed the defaults: upstream keepalive is on by default, `proxy_http_version` defaults to 1.1, and nginx no longer sends a `Connection` header upstream unless you set one. So on 1.30 this particular failure, losing keepalive by losing `Connection ""`, no longer happens with the defaults. The inheritance rule itself has not changed: the broken file still drops the inherited `Host` line.

Older nginx is still common, so we ran the same file on nginx 1.28.3:

| nginx 1.28.3, same broken file, at 1,000 / 2,000 requests/s | New backend connections per run        | nginx CPU per 1,000 requests | Backend CPU       | Median         |
| ----------------------------------------------------------- | -------------------------------------- | ---------------------------- | ----------------- | -------------- |
| `/plain` (no `proxy_set_header` of its own)                 | 25 to 54                               | 167 / 127 ms                 | 0.15 / 0.20 cores | 0.47 / 0.43 ms |
| `/auth` (one `proxy_set_header`)                            | **one per request** (30,000 or 60,000) | 244 / 213 ms                 | 0.21 / 0.33 cores | 0.57 / 0.59 ms |

Three passed runs per cell (`results/break-keepalive-1.28-7e81865a8157dadd`). Every response was a correct 200, so the client side looked fine. On nginx 1.28, the broken `/auth` route used 76 to 86 ms more nginx CPU per 1,000 requests than `/plain` in the same file, more than any nginx feature in the main test, and the backend used about 40% to 70% more CPU, because it now had to accept a TCP connection for every request. `/auth` also checks the key and strips a header, so this comparison is not only the connections, but on 1.30 those two cost nothing we could measure. The backend's count of new connections includes the one request we made to read it.

If you run nginx older than 1.29.7, repeat the inherited `proxy_set_header` lines in every location that sets its own, or keep them in a file that each location includes.

## Where one core ran out

The last test sent requests as fast as 64 connections would carry them, for 15 seconds per step, to see where each proxy tops out on one core.

| Step               | nginx                                           | Kong                      | Tyk                    |
| ------------------ | ----------------------------------------------- | ------------------------- | ---------------------- |
| plain (HTTP)       | 18,267 (18,258 to 19,008), load generator limit | 10,736 (10,556 to 11,938) | 3,961 (3,355 to 5,085) |
| + TLS              | 6,338 (5,324 to 9,882)                          | 7,785 (7,726 to 9,707)    | 3,976 (3,702 to 4,809) |
| + API key check    | 6,772 (5,738 to 10,405)                         | 6,189 (5,714 to 8,428)    | 2,918 (2,678 to 3,076) |
| + rate limit       | 6,201 (6,138 to 7,566)                          | 2,936 (2,673 to 4,029)    | 2,915 (2,213 to 2,986) |
| + header transform | 6,019 (5,604 to 10,463)                         | 3,070 (2,620 to 3,453)    | 2,252 (2,177 to 2,392) |

Requests per second, median of three 15-second runs (`results/max-de3b51401329efe5`), with the range of the three. This is the least reliable table in the post, for two reasons. First, our load generator had one core, and it ran out at about 18,000 requests per second over plain HTTP, so nginx's first row is a limit of the test, not of nginx. With TLS on, the load generator also did TLS work and used up to 97% of its core in some nginx runs. Second, nginx's TLS rows varied a lot and seemed to fall into two clusters: some runs reached about 10,000 requests per second at about 90 ms of CPU per 1,000 requests, others 5,300 to 7,600 at 127 to 186 ms, with the same config. We did not find the cause. The vCPUs are virtual, and the host may place two of them on one physical core, which we cannot see from inside the droplet. So we do not rank nginx against Kong for TLS throughput from this.

The gateway rows are clearer, because the load generator had spare CPU there, except in one Kong plain run where it used 86% of its core. On one core, Kong went from about 6,200 requests per second with keys to about 2,900 once its rate limit was on, and Tyk's medians were between 2,250 and 4,000 on every step. That matches the fixed-rate runs: those were the configurations that were already near a full core at 2,000 per second.

## What the gateway costs in money

The software here is free. The cost is compute, and your time to run it.

At 1,000 requests per second around the clock, which is 2.59 billion requests in a 30-day month, Kong with every feature on used about 0.84 of a core in our test, and nginx about 0.17. Even with two machines for redundancy, that is a small droplet bill. The same traffic through a managed gateway that bills per request would cost this in request charges alone, at [AWS API Gateway's US East list prices](https://aws.amazon.com/api-gateway/pricing/), before data transfer, authorizers, logs or anything else:

| Monthly requests                | HTTP API | REST API |
| ------------------------------- | -------- | -------- |
| 26 million (10 per second)      | $26      | $91      |
| 259 million (100 per second)    | $259     | $907     |
| 2.59 billion (1,000 per second) | $2,363   | $6,822   |

HTTP APIs cost $1.00 per million for the first 300 million requests and $0.90 after that. REST APIs cost $3.50 per million for the first 333 million, $2.80 for the next 667 million and $2.38 after that. Free-tier allowances and promotional credits are left out. The REST column is the fair one for this post: API keys and usage plans with per-client limits are [REST API features](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-vs-rest.html), and an HTTP API would need you to build those yourself.

At 10 requests per second the managed gateway is cheaper than any time you would spend running your own. At 1,000 per second the bill is large enough to pay for someone's time. The crossover depends on your traffic and on what your team's hours cost, not on the gateway's CPU.

## When to skip the gateway

From these numbers and the feature table, a rough guide:

- **Skip it** when your API has internal callers, a handful of static keys, and limits per client IP or per key that rarely change. nginx did TLS, a key check, a limit and header changes in our test for a cost we could not separate from noise. HAProxy and Envoy have the same request-level features, though we did not measure them. Put the money and the operational work elsewhere.
- **Use one** when you give keys to outside consumers and need to issue, revoke and change them at runtime, when you sell plans with quotas, when several teams publish APIs behind one entry point and need the same policies everywhere, or when you need per-consumer metrics. That is real code you would otherwise write and maintain.
- **If you run one, profile the plugins you turn on, not the gateway.** On Kong, the rate limiter cost more than the proxy, TLS and key check together. On Tyk, it was the key check. A plugin list that grows over the years can cost more than the hop that the gateway adds.
- **Give it more than one core.** Tyk warns at startup that one CPU is too few for production, and both gateways ran out of headroom at 2,000 requests per second on one core, where nginx used a quarter of its own. With two cores, Tyk's full ladder at 2,000 per second went from a 22 ms median to under 1 ms as measured (1.2 ms with the send lag added back), at the price of 24% more CPU per request.

If your services run on Kubernetes, the same choice comes up as Ingress, Gateway API and a service mesh. [Ingress vs load balancer in Kubernetes](/posts/ingress-vs-load-balancer-kubernetes) and the [ingress-nginx to Gateway API migration](/posts/ingress-nginx-eol-gateway-api-migration) cover that layer.

## What we could not conclude

- **One machine, loopback networking.** No request crossed a real network. The 0.2 to 0.3 ms per hop is an end-to-end difference on this host, which includes the proxy's work plus the kernel's loopback networking and scheduling. Across a real network, each hop adds a round trip on top.
- **One core per proxy, synthetic load.** Kong and Tyk scale across cores (Kong with nginx workers, Tyk with Go's scheduler), and the ratios between them may change with more. We reran Tyk's first and last steps with two cores (`GOMAXPROCS=2`, `results/tyk-two-cores-93f5d68a8a9258be`): with everything on at 2,000 requests per second, its median fell from 22.1 to 0.94 ms and p99 from 81 to 37 ms, but it used 599 ms of CPU per 1,000 requests instead of 482. The extra core greatly reduced the queueing, though not all of it (the p99 send lag was still 23 ms), and the work per request went up. For that run Redis moved from its own core to the backend's, to free a second core for Tyk.
- **One small response body, GET only, HTTP/1.1, keepalive.** We did not test request body transforms, large bodies, HTTP/2, gRPC, or clients that open a new TLS connection for every request, where the handshake would dominate.
- **Default plugin settings, one hot key.** Kong added its latency and rate-limit headers, Tyk had analytics off. Turning on Tyk analytics or Kong's Prometheus plugin would add cost we did not measure. Every request used the same key, so key lookups always hit a warm cache, and the benchmarked nginx limit had `burst=2000 nodelay` so that it never refused a request (the limit test route had no burst).
- **Run-to-run variation of up to about 80 ms per 1,000 requests in some cells.** With three runs per cell, small costs cannot be pinned down, and that includes all of nginx's features. We can say nginx's features were small here; we cannot rank them.
- **Not Kong vs Tyk in general.** These are two open source gateways on one core with one set of plugins. Kong's paid rate limiter, Tyk with more cores, or either one with a database would give different numbers.

## Summary

In this test, a gateway on its own cost about the same as any other proxy hop. The features cost something in specific places: Kong's rate limiter, which schedules a timer for every request, and Tyk's key check. nginx did TLS, key checks, per-key limits and header rewrites for an amount we could not separate from noise. So for these features the choice is less about latency than about which plugins you turn on and how many cores you give them. Use a gateway when you need what is in the bottom rows of the feature table: keys that change at runtime, consumers, quotas and per-consumer metrics. If you do not, the load balancer in front of your services already does the rest.
