---
title: 'Day 2: The Error Budget'
day: 2
excerpt: 'Every service has an error budget. Find the service that burned the most of it on 2 December, without letting a tiny service or integer division fool you.'
difficulty: 'Beginner'
skills:
  - Aggregates
  - HAVING
  - Numeric division
schema: 'day02'
answerHash: '786b2a31707640d6b59eadd0e287f64962d2dfa6f50c2042d5d89228e3b312fd'
answerFormat: 'A service name, for example sleigh-api'
starter: 'select * from request_stats limit 10;'
hint: 'Integer divided by integer is an integer in Postgres. And check what the 10,000-request floor removes.'
publishedAt: '2026-12-02T00:00:00Z'
---

Bushy keeps the error budgets. Each service may fail a small share of its requests before the team stops shipping features and fixes reliability instead. The dashboard broke overnight, so Bushy needs the numbers from the database.

Every service writes one row per minute to `request_stats`:

| Column     | Type          | Notes                                    |
| ---------- | ------------- | ---------------------------------------- |
| `service`  | `text`        | Part of the primary key                  |
| `minute`   | `timestamptz` | The start of the minute, 2 December only |
| `requests` | `int`         | Requests served in that minute           |
| `errors`   | `int`         | How many of them returned a 5xx          |

Some minutes had no traffic at all. One service is a small export job that serves only a few thousand requests a day.

## Your task

The error rate of a service is its total errors divided by its total requests over the whole day. Counting only services that served **at least 10,000 requests** on 2 December, which service had the **highest error rate**?

Submit the service name.
