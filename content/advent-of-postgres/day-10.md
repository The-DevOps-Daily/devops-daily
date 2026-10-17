---
title: 'Day 10: The Maintenance Windows'
day: 10
excerpt: 'Two services in maintenance at the same time is how the night shift gets paged. Count the overlapping windows, and know what "touching" means for a range.'
difficulty: 'Intermediate'
skills:
  - Range types
  - Self-joins
schema: 'day10'
answerHash: 'b608f7d7e89d3084bb1d64194a6031747820961dac2405783cefa1e29c8ef154'
answerFormat: 'A number, for example 30'
starter: 'select * from maintenance order by lower(window_) limit 20;'
hint: '&& is the overlap operator for ranges. Join the table to itself and keep each pair once.'
publishedAt: '2026-12-10T00:00:00Z'
---

The rule is simple: two services should not be in maintenance at the same time. Bushy has the schedule for 10 December and a bad feeling about it.

The schedule is in `maintenance`:

| Column    | Type        | Notes                                   |
| --------- | ----------- | --------------------------------------- |
| `id`      | `int`       | Primary key                             |
| `service` | `text`      | Who is doing maintenance                |
| `window_` | `tstzrange` | `[start, end)`: the end is not included |

A window that ends at 10:00 and another that starts at 10:00 only touch. They do not overlap. Two windows of the same service never count.

## Your task

How many **pairs of windows from different services overlap**? Count each pair once.

Submit the number.
