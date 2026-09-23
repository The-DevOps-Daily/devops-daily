---
title: 'Cloudflare Had Too Many Hash Ring Points. Your Proxy May Have Too Few'
excerpt: 'Cloudflare got back 100 TB of RAM partly by cutting 90% of the points on its consistent hash rings. We measured the other end of the same curve: a million keys through nginx and HAProxy to 100 backends, and Envoy rebuilt from its source. The busiest server ranged from 1.05x to 2x its fair share, and the points per server explained most of it.'
category:
  name: 'Networking'
  slug: 'networking'
date: '2026-09-23'
publishedAt: '2026-09-23T09:00:00Z'
updatedAt: '2026-09-23T09:00:00Z'
readingTime: '16 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Networking
  - Load Balancing
  - Consistent Hashing
  - NGINX
  - HAProxy
  - Envoy
  - Istio
---

Last week Cloudflare [explained how it got back 100 TB of RAM](https://blog.cloudflare.com/saving-100-tb-of-ram-with-math/) by changing how it does consistent hashing. Its internal load balancer gave each server on the order of 100,000 points on its hash rings: 160 base points multiplied by a weight based on disk size. They packed each point into 6 bytes instead of 8, and a short piece of math showed that a tenth of the points did the same job, so they cut 90% of them. Together, the two changes gave back the memory.

The same math has a second half that the story does not need: what happens when a server has **too few** points. That is the case most of us are in, because the number is set by a default we never looked at. We sent a million keys through nginx and HAProxy to 100 backends, rebuilt all three proxies' rings from their source, and measured how much work the busiest server gets compared to a fair share.

With consistent hashing turned on and the point counts left at their defaults, nginx's busiest server got **1.21x** its share. HAProxy's got **1.42x**. Envoy's ring hash, which is also what Istio's `consistentHash` uses unless told otherwise, gives each of 100 hosts 11 points. Our port of its code puts the busiest host at **2.02x** and the quietest at a third of the average. Our ports of nginx and HAProxy predicted the backend for every key the real proxies served, so we trust the Envoy port too, but it is still a port and not a run. One line of config fixes each of them.

```github
The-DevOps-Daily/hash-ring-points
```

## TL;DR

- **Spread is set mostly by points per server.** Cloudflare's formula, `CV = sqrt((N-1)/(N*k+1))`, is close to `1/sqrt(k)`. Our simulation agreed closely with it at all seven point counts we tried, from 1 to 100,000.
- **The defaults differ by 10x.** nginx places 160 points per server, HAProxy 16 (at the default weight of 1), and Envoy splits a ring of at least 1,024 entries across all hosts, which is 11 each at 100 hosts and 1 each above 1,024.
- **Measured, 1,000,000 keys, 100 backends:** nginx busiest server 1.211x the mean, HAProxy 1.417x at weight 1, 1.128x at weight 10, 1.048x at weight 100.
- **HAProxy does better than its point count suggests.** It sends a key to the nearest point in either direction, not only the next one, which cuts the spread by about the square root of two.
- **The ports match the real proxies key by key.** Rebuilt from their source, the nginx and HAProxy rings agreed with the real proxies on all 4.8 million key lookups across eight clean runs.
- **Few points also hurt when a server leaves.** With HAProxy's default, 25 servers absorbed the removed server's keys and one of them took 15.2%. With nginx, 79 servers shared them and none took more than 4.8%.
- **The Envoy numbers are computed, not measured.** Envoy's arm64 build does not start on our Raspberry Pi's kernel. The repo includes the port and a command that checks it key by key on a machine where Envoy runs.

## Prerequisites

- A basic idea of consistent hashing: servers and keys are hashed onto the same ring, and a key goes to a server near it.
- If you want to run the repo: Node 20.18.1 or newer, `nginx` and `haproxy` on your `PATH`, and about 6 minutes per million keys on a small machine.

## The formula Cloudflare used

A consistent hash ring gives each server some points on a circle of hash values. A key is hashed onto the same circle and served by the owner of the next point. With one point per server, the gaps between points are random, so some servers own huge arcs and others own almost nothing. Adding more points per server averages those gaps out.

Cloudflare wrote the spread down exactly. For N servers with k random points each, the coefficient of variation of a server's share (its standard deviation divided by the fair share) is:

```text
CV = sqrt( (N - 1) / (N * k + 1) )      which is close to 1 / sqrt(k)
```

We did not want to trust that on faith, so `simulate.mjs` builds rings with k random points for 100 servers, computes every server's exact share of the circle (no requests, no sampling), and repeats it up to 400 times per k. The chart shows the root mean square of the per-ring CVs:

```chart
{
  "type": "line",
  "title": "Spread of server shares against ring points per server, 100 servers",
  "unit": "%",
  "caption": "CV of the share each server owns. Formula: Cloudflare's CV_k. Simulated: exact arc lengths, 3 to 400 random rings per k (data/simulate.json). Nearest point: the same rings with HAProxy's lookup rule.",
  "x": ["1", "11", "16", "160", "1,600", "10,000", "100,000"],
  "series": [
    { "name": "Formula", "data": [99.0, 29.99, 24.87, 7.87, 2.49, 0.99, 0.31], "color": "#94a3b8" },
    { "name": "Simulated, next point", "data": [99.52, 30.05, 25.04, 7.82, 2.48, 1.02, 0.3], "color": "#f59e0b" },
    { "name": "Simulated, nearest point", "data": [69.89, 21.25, 17.73, 5.53, 1.75, 0.71, 0.21], "color": "#0ea5e9" }
  ]
}
```

The simulation stays within a few percent of the formula at every point count (at 100,000 points, from only three rings, it is 0.30% against 0.31%). CV is abstract, so here is the number that pages people, the busiest server's load compared to the average, from the same simulated rings:

| Points per server | CV    | Busiest server, average of the runs |
| ----------------- | ----- | ----------------------------------- |
| 1                 | 99.5% | 5.17x                               |
| 11                | 30.0% | 1.93x                               |
| 16                | 25.0% | 1.75x                               |
| 160               | 7.8%  | 1.20x                               |
| 1,600             | 2.5%  | 1.06x                               |
| 10,000            | 1.0%  | 1.03x                               |
| 100,000           | 0.3%  | 1.01x                               |

Each 10x in points buys about a 3x smaller spread, and the curve flattens fast. That is Cloudflare's point. In our simulation, going from 10,000 to 100,000 points takes the busiest server from 1.03x to 1.01x, which is not worth the memory across dozens of rings. At the other end of the table, the difference between 11 and 160 points is the difference between a server doing twice its share and one doing a fifth more.

## What your proxy gives each server

The docs rarely state these counts directly ([nginx's](https://nginx.org/en/docs/http/ngx_http_upstream_module.html#hash) says its method is compatible with a Perl client set to `ketama_points` 160), so we read the source. The exact commits are in the repo's `data/sources.txt`.

| Proxy         | Setting                            | Points per server             | Where it comes from                                                                                                                                       |
| ------------- | ---------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| nginx         | `hash $key consistent;`            | 160 x weight                  | `npoints = peer->weight * 160` in `ngx_http_upstream_hash_module.c`                                                                                       |
| HAProxy       | `hash-type consistent`             | 16 x weight, default weight 1 | `lb_nodes_tot = uweight * BE_WEIGHT_SCALE` in `lb_chash.c`, with `BE_WEIGHT_SCALE 16`                                                                     |
| Envoy         | `lb_policy: RING_HASH`             | ceil(1024 / hosts)            | `minimum_ring_size` defaults to 1,024 entries for the whole ring, in `ring_hash_lb.cc`                                                                    |
| Istio         | `consistentHash` with no algorithm | same as Envoy                 | falls back to `RING_HASH` with a minimum ring of 1,024 in `cluster_traffic_policy.go`                                                                     |
| Envoy Gateway | `ConsistentHash`                   | Maglev table                  | its xDS translator configures Envoy's Maglev balancer, 65,537 slots by default ([docs](https://gateway.envoyproxy.io/docs/tasks/traffic/load-balancing/)) |

Two of these scale badly without anyone noticing. HAProxy's count is per unit of weight, and weight defaults to 1, so a config that never mentions weight gets 16 points per server. HAProxy's own docs suggest starting weights "between 10 and 100", but a pool of identical servers gives you no reason to set one.

Envoy's count is per ring, not per host. The ring gets at least 1,024 entries and they are split across equal-weight hosts: 103 each for 10 hosts, 11 each for 100, and one each once you pass 1,024 hosts. Istio users meet this through `DestinationRule`: a `consistentHash` block with a header or cookie, no `ringHash` or `maglev` field, and no deprecated `minimumRingSize` gets a ring of this size.

## A million keys through each proxy

The harness is plain. One nginx process listens on 100 ports, 9001 to 9100, and every port answers with its own number. The proxy under test sits in front, hashing the request path. A client sends one million distinct keys (`/objects/<16 hex chars>`, generated from a fixed seed) and records which backend answered each one.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Client", "sub": "1,000,000 keys", "icon": "cpu", "tone": "slate" },
    { "label": "Proxy under test", "sub": "hashes the path", "icon": "net", "tone": "amber" },
    { "label": "100 backends", "sub": "ports 9001-9100", "icon": "server", "tone": "blue" },
    { "label": "Mapping", "sub": "key -> backend", "icon": "database", "tone": "violet" }
  ]
}
```

A run only counts if every request returns a 200 from a live backend, if the first 10,000 keys land on the same backend when they are sent a second time, and, for nginx, if its error log has no upstream errors (the last section explains why). Consistent hashing is switched on in every config; what we left alone is the point count. Here are the recorded runs:

```terminal
{
  "title": "hash-ring-points",
  "steps": [
    { "comment": "nginx 1.22.1, hash $request_uri consistent (progress lines trimmed)" },
    { "cmd": "node scripts/measure.mjs --variant nginx", "output": "nginx: 1,000,000 keys in 314s, 0 errors, recheck 10000/10000 same server\n  busiest 1.211x mean, quietest 0.835x mean, CV 7.6%" },
    { "comment": "HAProxy 2.6.12, balance uri + hash-type consistent, weight left at its default of 1" },
    { "cmd": "node scripts/measure.mjs --variant haproxy-default", "output": "haproxy-default: 1,000,000 keys in 325s, 0 errors, recheck 10000/10000 same server\n  busiest 1.417x mean, quietest 0.630x mean, CV 16.0%" },
    { "comment": "the same HAProxy config with weight 10 on every server" },
    { "cmd": "node scripts/measure.mjs --variant haproxy-weight-10", "output": "haproxy-weight-10: 1,000,000 keys in 353s, 0 errors, recheck 10000/10000 same server\n  busiest 1.128x mean, quietest 0.867x mean, CV 5.7%" }
  ]
}
```

```chart
{
  "type": "bar",
  "title": "Busiest backend's load compared to the average, 100 backends",
  "unit": "x",
  "caption": "Measured: 1,000,000 keys per run (data/report.txt). Computed: Envoy's ring rebuilt from its source and every key looked up (data/envoy-ring.txt), not measured on a running Envoy.",
  "rows": [
    { "label": "nginx, 160 points", "value": 1.211, "series": "Measured" },
    { "label": "HAProxy weight 1, 16 points", "value": 1.417, "series": "Measured" },
    { "label": "HAProxy weight 10, 160 points", "value": 1.128, "series": "Measured" },
    { "label": "HAProxy weight 100, 1,600 points", "value": 1.048, "series": "Measured" },
    { "label": "Envoy defaults, 11 points", "value": 2.025, "series": "Computed" },
    { "label": "Envoy ring 16,000, 160 points", "value": 1.223, "series": "Computed" }
  ],
  "series": [
    { "name": "Measured", "color": "#f59e0b" },
    { "name": "Computed", "color": "#94a3b8" }
  ]
}
```

With a million keys, each backend gets about 10,000, so counting keys adds about 1% of noise on top of the ring's own spread. nginx at 7.6% sits close to where the formula puts 160 random points plus that noise (7.9%).

The three proxies also hash keys differently (CRC32 in nginx, SDBM plus an avalanche step in HAProxy, XXH64 in Envoy) and look them up differently, so this chart is not a pure test of point count. The HAProxy weight sweep is: same proxy, same hashing, only the points change, and the busiest server goes from 1.42x to 1.13x to 1.05x.

## HAProxy's nearest-point rule

HAProxy at weight 1 measured a CV of 16.0%. The formula for 16 points says 24.9%. A result that is better than theory is still a result we cannot explain, so before trusting it we read `chash_get_server_hash()` in HAProxy's `lb_chash.c`:

```c
dp = hash - prev->key;
dn = next->key - hash;

if (dp <= dn) {
        next = prev;
        nsrv = psrv;
}
```

HAProxy does not just take the next point after the key. It looks at the points on both sides and picks the **nearer** one. Each point then owns half of the gap before it and half of the gap after it, and averaging two gaps roughly halves the variance (roughly, because neighbouring gaps are not fully independent). The simulation above has the same rule as a third line, and it sits at the next-point spread divided by about 1.41 at every k.

To check that this is the whole story, `haproxy-ring.mjs` rebuilds HAProxy 2.6's actual ring for our 100 servers: point `i` of server `puid` sits at `full_hash(puid * 4096 + i)`, and the nearest point wins. Then it computes each server's share of the 32-bit hash space, with both lookup rules on the same points:

```terminal
{
  "title": "haproxy-ring",
  "steps": [
    { "cmd": "node scripts/haproxy-ring.mjs", "output": "weight   1 (16 points): nearest-point rule busiest 1.439x CV 16.0%   next-point rule on the same points busiest 1.589x CV 22.3%\nweight  10 (160 points): nearest-point rule busiest 1.122x CV 5.4%   next-point rule on the same points busiest 1.181x CV 7.6%\nweight 100 (1600 points): nearest-point rule busiest 1.048x CV 1.7%   next-point rule on the same points busiest 1.062x CV 2.5%" }
  ]
}
```

The rebuilt ring predicts 16.0% at weight 1, and the real HAProxy measured 16.0%. Matching one summary number could be luck, so `predict.mjs` goes further: it ports the key side too (SDBM over the path, then `full_hash`) and predicts the backend for every key. Against the real proxy it got **1,000,000 of 1,000,000** right at each of the three weights, and 200,000 of 200,000 with one backend down. The same check on nginx's port (CRC32 points, first point at or after the key) also matched every key. That is agreement on these keys and this setup (equal weights, one backend removed at most), not a proof that the ports cover every code path.

So HAProxy's 16 points behave like about 32 points on a next-point ring. That is better than it looks, and still far from nginx's 160. The current development branch (3.5) keeps the same default placement, the same count and the same nearest-point rule; it adds other `hash-key` choices for placing points.

## Envoy and Istio: 11 points per host

Envoy was supposed to be the third measured proxy. The official arm64 build exits at startup on the Raspberry Pi we ran everything on:

```text
$ grep CONFIG_ARM64_VA_BITS= /boot/config-$(uname -r)
CONFIG_ARM64_VA_BITS=39
$ bin/envoy --version
... MmapAligned() failed - unable to allocate with tag (hint=0xe7740000000, size=1073741824, alignment=1073741824) - is something limiting address placement?
... Note: the allocation may have failed because TCMalloc assumes a 48-bit virtual address space size; ...
```

The tcmalloc in the official build expects a 48-bit address space, and this Pi's kernel gives 39. So we did for Envoy what had just worked for the other two: port its ring from `ring_hash_lb.cc` and look up every key. A host's point `i` is `XXH64("127.0.0.1:9001_i")`, the ring size comes from `minimum_ring_size`, the lookup is Envoy's port of ketama's binary search, and the request's key is `XXH64` of the path, as Envoy's header hash policy computes it. Our XXH64 matches the reference test vectors (`data/xxh64-vectors.txt`).

```text
envoy-default     ring 1100 (11-11 per host): busiest 2.025x, quietest 0.319x, CV 30.5%
envoy-ring-16000  ring 16000 (160-160 per host): busiest 1.223x, quietest 0.805x, CV 8.2%
```

With defaults, 100 hosts get 11 points each. On this ring the busiest host gets 2.02 times its share and the quietest gets under a third of it. The simulation says that is normal for 11 points, not bad luck: the average busiest server over 400 random rings was 1.93x.

This is what an Istio `DestinationRule` that hashes on a user ID header gets by default. With 100 equal-weight pods it has 11 points per pod, and a ring like this one gives one pod about twice the key space of an average pod. How much traffic that becomes depends on your users, and locality or priority settings can change which hosts are in the ring. Past 1,024 pods, each pod has a single point: on an ideal random ring with one point each and 1,025 pods, the expected busiest pod owns about 7.5 times the average share.

The computed numbers carry a label in the chart for a reason: they are our port of Envoy's code, not a run of it. The repo has the command to close that gap on a machine where Envoy starts: `measure.mjs --variant envoy-default` measures it the same way as the others, and `predict.mjs` compares the result with the prediction key by key.

## When a server leaves the ring

The spread at rest is half the story. The other half is where a removed server's keys go. On a next-point ring, each of the removed server's points hands its arc to the point after it. With 160 points, that is up to 160 different neighbours, each taking a sliver. With 11 points, it is at most 11, and one of them can take a large piece.

We marked backend 9042 as down in the config (`down` in nginx, `disabled` in HAProxy so the other servers keep their IDs), restarted the proxy, sent the first 200,000 keys again, and compared. This measures where keys go once the proxy knows a server is gone, not how fast it notices. For Envoy, the port rebuilt the ring without that host:

| Setup                                | Keys on the removed server | Servers that took them | Largest share one server took | Other keys that moved |
| ------------------------------------ | -------------------------- | ---------------------- | ----------------------------- | --------------------- |
| nginx, 160 points                    | 2,173                      | 79                     | 4.8%                          | 0                     |
| HAProxy weight 1, 16 points          | 1,786                      | 25                     | 15.2%                         | 0                     |
| HAProxy weight 10, 160 points        | 1,923                      | 90                     | 4.2%                          | 0                     |
| HAProxy weight 100, 1,600 points     | 1,947                      | 99                     | 1.8%                          | 0                     |
| Envoy defaults, 11 points (computed) | 1,367                      | 9                      | 39.1%                         | 6                     |
| Envoy ring 16,000 (computed)         | 2,034                      | 82                     | 4.9%                          | 2,352                 |

HAProxy's 25 receivers are more than its 16 points would suggest, again because of the nearest-point rule: a removed point's region splits between the neighbours on both sides.

For a cache tier, the "largest share" column is the one to read. When a cache node dies, its keys become misses on the servers that inherit them. With Envoy's defaults, one surviving host took 39% of the removed host's keys. The second, which took another 28%, was already carrying 1.36x its share before.

The last row is the one we did not expect. When a host leaves an Envoy ring, Envoy recomputes the points per host for everyone. With a 16,000-entry ring, 100 hosts get 160 points each, but 99 hosts get `ceil(16000 / 99) = 162`. Every surviving host gains two points, and those points take keys from other survivors: 2,352 keys moved that were never on the removed host, more than the removed host's own 2,034. Consistent hashing is supposed to move only the removed server's keys. Envoy's ring keeps that promise only when the per-host count does not change, which with defaults at 100 and 99 hosts it almost does (11 either way, apart from one host that gets a 12th point from floating-point rounding, hence the 6). This is from the port, so it is the first thing we would check on a real Envoy.

## The run we threw away

Our first nginx run looked clean: a million requests, zero errors, and the recheck passed. Then we took one backend down, compared the mappings, and found that **291 keys that were never on the down backend had changed server.** Consistent hashing should not do that.

We had already overwritten that run's nginx log with a re-run, so we reproduced it on purpose: same config, same keys, now kept in the repo as the `nginx-keepalive-64` variant. It failed the same way:

```terminal
{
  "title": "reproduce-keepalive-failure",
  "steps": [
    { "comment": "the measurement part of the output; the kernel log and conntrack samples are in data/discarded-run/" },
    { "cmd": "scripts/reproduce-keepalive-failure.sh", "output": "nginx-keepalive-64: 1,000,000 keys in 814s, 0 errors, recheck 10000/10000 same server\n  nginx logged 160 upstream errors (kept in data/nginx-keepalive-64-nginx-error.log)\n  busiest 1.218x mean, quietest 0.842x mean, CV 7.6%" },
    { "cmd": "node scripts/analyze-keepalive-failure.mjs", "output": "keys sent: 1,000,000, client errors: 0\nkeys served by a different backend than the ring predicts: 6,172 (0.62%)\n  of those, served by the next live server on the ring: 5,595\n  backends whose keys were moved: 57\nnginx error log: 160 lines, 80 \"temporarily disabled\" for 57 backends, from 2026/09/23 17:34:40 to 2026/09/23 17:45:14" }
  ]
}
```

The client saw a million 200s. The port, which had matched every key of the clean runs, said 6,172 of them went to the wrong backend. The 160 log lines are 80 connect timeouts, each logged as a warning and an error, across 57 backends. During the run the kernel logged 779 `table full` messages, and the connection tracking count, sampled every 5 seconds, sat at its limit of 65,536:

```text
[warn] ... upstream server temporarily disabled while connecting to upstream ... upstream: "http://127.0.0.1:9099/..."
[error] ... upstream timed out (110: Connection timed out) while connecting to upstream ... upstream: "http://127.0.0.1:9099/..."
nf_conntrack: nf_conntrack: table full, dropping packet
```

The client held 32 connections to nginx. nginx ran two workers, and `keepalive 64` lets each worker keep at most 64 idle upstream connections, for 100 backends. On top of that, the default upstream `keepalive_requests` of 1,000 closes a kept connection after a thousand requests. So nginx kept closing upstream connections and opening new ones, every closed connection stayed in the conntrack table for a while, and the table filled at 65,536 entries. From there we are inferring, not tracing packets: with the table full, the kernel dropped new connection attempts, some connects timed out, and nginx did what it is built to do. The worker that saw the failure marked that backend unavailable for `fail_timeout` (10 seconds by default), tried the next point on the ring for the keys that belonged to it, and returned a 200. The destinations fit that: 5,595 of the 6,172 keys went exactly where skipping their expected backend would send them. The other 577 did not, and we did not trace each one.

On a cache tier in production, the symptom would be a burst of misses with nothing in the client's error metrics. That is worth knowing on its own: **nginx's passive health checks quietly re-home keys**, and the mapping is only consistent while every backend answers.

The fix for the benchmark was to keep upstream connections open (`keepalive 512`, `keepalive_requests 1000000`) and to make the harness fail if nginx logs any upstream error. The nginx numbers in this post come from the re-runs, which matched the port on every key. HAProxy's runs matched on every key too. Without `option redispatch`, HAProxy retries a failed connect on the same server, so a dropped SYN costs time, not placement.

## How many points is enough

Points cost memory and build time, which is Cloudflare's side of the curve. At the sizes most of us run, the cost is small:

- **Memory.** An Envoy ring entry is a 64-bit hash plus a shared pointer to the host, 24 bytes on a typical 64-bit build, so the entries of a 160,000-entry ring (1,600 points for 100 hosts) come to about 3.8 MB. That is the ring's own array, not the whole load balancer. nginx's point is a 32-bit hash plus a pointer, 16 bytes with padding. Cloudflare's problem was 100,000 points per server, thousands of servers, and dozens of rings for different feature combinations, which reached 6 GB in some cases.
- **Collisions.** If the point hashes behave like random 32-bit numbers, expect about `M^2 / 2^33` colliding pairs for M points. For 16,000 points, that is under 0.03 pairs. For 2,048 servers at 100,000 points each, the case Cloudflare simulated, it is about 4.9 million pairs, and about 2.3% of the points land on a value another point already holds. Cloudflare's simulation showed the error rising again between 10,000 and 100,000 points. Envoy uses 64-bit hashes, so this does not apply to it.
- **Lookup time.** nginx and Envoy find the point with a binary search, HAProxy with a tree lookup, so 10x more points costs about three more comparisons per request.

In our 100-server simulation, going from 160 to 1,600 points per server takes the busiest server from about 1.2x to about 1.06x its share, and past about 10,000 points the gains are in the second decimal place.

## What to change

For nginx, nothing: 160 points per unit of weight is a reasonable default. For HAProxy and Envoy, one setting each. Any of these changes adds points, and new points take keys from existing servers, so on a cache tier expect a one-time wave of misses when you roll it out:

```tabs
{
  "title": "More points per server",
  "tabs": [
    { "label": "HAProxy", "lang": "haproxy", "code": "backend cache\n  balance uri\n  hash-type consistent\n  # 16 points per unit of weight: weight 10 = 160 points, weight 100 = 1,600\n  default-server weight 100\n  server c1 10.0.0.11:8080\n  server c2 10.0.0.12:8080\n  # optional: bounded loads, about 1.5x the average concurrent requests per server\n  hash-balance-factor 150" },
    { "label": "Envoy", "lang": "yaml", "code": "# on the route: what to hash (without a hash policy, requests are spread at random)\nroute:\n  cluster: cache\n  hash_policy:\n  - header: { header_name: \":path\" }\n\n# on the cluster: how many ring entries\nclusters:\n- name: cache\n  lb_policy: RING_HASH\n  ring_hash_lb_config:\n    # entries for the WHOLE ring; aim for hosts x 160 or more\n    minimum_ring_size: 16384\n# or, for a table balanced by construction:\n#  lb_policy: MAGLEV" },
    { "label": "Istio", "lang": "yaml", "code": "apiVersion: networking.istio.io/v1\nkind: DestinationRule\nmetadata:\n  name: cache\nspec:\n  host: cache.default.svc.cluster.local\n  trafficPolicy:\n    loadBalancer:\n      consistentHash:\n        httpHeaderName: x-user-id\n        ringHash:\n          minimumRingSize: 16384\n        # or replace ringHash with:  maglev: {}" }
  ]
}
```

A few notes on those:

- **HAProxy weights are relative.** If all your servers had the same weight, setting every one to 100 keeps them equal and only raises the point count; if they differ, multiply each by the same factor. The actual shares do change, because the ring does: that is the point, and it is also the one-time remap. The maximum weight is 256, which is 4,096 points.
- **`hash-balance-factor` solves a different problem.** It bounds concurrent requests per server relative to the average (with rounding, and every server always allowed at least one), so it also limits the damage from one hot key. A request that spills to another server loses its affinity. More points fixes the key space; the balance factor limits the damage from uneven traffic.
- **Envoy's `minimum_ring_size` is for the whole ring,** so it has to grow with the number of hosts. 16,384 gives about 164 per host at 100 equal-weight hosts, and 17 at 1,000. The maximum is 8,388,608.
- **Maglev** fills a fixed table of 65,537 slots, with hosts taking turns, so equal-weight hosts end up with nearly the same number of slots. Equal slots are not equal traffic: hot keys still land where they land. It is what Envoy Gateway uses for consistent hashing. We did not measure it; its trade-off, per the [Maglev paper](https://research.google/pubs/maglev-a-fast-and-reliable-software-network-load-balancer/), is that a host change moves some keys between surviving hosts too.

## What we could not conclude

- **Envoy was not run.** Our Envoy numbers come from a port of its ring code. The same method was exact for nginx and HAProxy, but the Envoy port itself is checked only against XXH64 test vectors and the source (pinned in `data/sources.txt`). A run where Envoy starts would confirm or refute it key by key.
- **Uniform keys are the easy case.** Every key here was requested once. Real traffic has hot keys, and one very hot key on one server outweighs any ring imbalance. The ring decides how the key space is split, not how much traffic each key brings.
- **One ring per setup.** A ring's layout depends on server addresses and IDs. A different set of 100 backends would pick a different busiest server; the simulation shows how wide that range is (for 11 points, the busiest server was between 1.68x and 2.33x in 90% of rings).
- **Versions.** HAProxy 2.6.12 and nginx 1.22.1 from Debian 12. The point counts, default placement and lookup rules are unchanged in their current source.
- **We measured spread, not latency.** The Pi's request rate says nothing about how these proxies perform.
- **Removal, not failure.** The removed-server runs mark the server down in the config. They say nothing about how quickly each proxy notices a real failure, or what it does in the meantime.

## Summary

Cloudflare's post is about having too many points and paying for it in memory. The same formula says that most of us have the opposite problem, and pay for it in the busiest server. With 100 backends and the default point counts, the busiest server got 1.21x its share behind nginx, 1.42x behind HAProxy and, by our port of its code, 2.02x behind Envoy's ring hash, which Istio uses by default. HAProxy at weight 10 (160 points) measured 1.13x, and at weight 100 (1,600 points) 1.05x; the Envoy port at 160 points per host gives 1.22x. The memory for rings that size is measured in megabytes.

Check the point count your proxy actually uses: `weight` for HAProxy, `minimum_ring_size` for Envoy and Istio, nothing for nginx. Then, if you run a cache tier behind it, take one node down in staging and watch where its keys go. And if you use nginx's `hash ... consistent` in front of caches, keep in mind that a backend that fails a connect can be skipped for `fail_timeout` (10 seconds by default) while clients keep getting 200s.
