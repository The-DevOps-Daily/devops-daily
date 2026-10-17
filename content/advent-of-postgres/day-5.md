---
title: 'Day 5: The Slow Tail'
day: 5
excerpt: 'Averages hide the requests that make users angry. Find the service with the worst 95th percentile latency.'
difficulty: 'Intermediate'
skills:
  - Ordered-set aggregates
  - percentile_cont
schema: 'day05'
answerHash: '81da5be904ce4036060ee3c3f637a1d86cc72902fe12870984a732c47e6b392b'
answerFormat: 'A service name, for example sleigh-api'
starter: 'select service, count(*), avg(latency_ms) from requests group by service;'
hint: 'percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) gives the 95th percentile. Compare it with avg() to see the trap.'
publishedAt: '2026-12-05T00:00:00Z'
---

Tinsel sets the latency targets. "Nobody complains about the average request," Tinsel says. "They complain about the slow ones. Give me the service with the worst tail."

Every request on 5 December is in `requests`:

| Column       | Type          | Notes                    |
| ------------ | ------------- | ------------------------ |
| `id`         | `bigint`      | Primary key              |
| `service`    | `text`        | One of five services     |
| `started_at` | `timestamptz` | When the request started |
| `latency_ms` | `int`         | How long it took         |

The team measures the tail as the 95th percentile: the latency that 95% of requests stay under. One service has a few requests that took more than half a minute. That is not the same thing as a slow tail.

## Your task

Which service had the **highest 95th percentile latency** on 5 December?

Submit the service name.
