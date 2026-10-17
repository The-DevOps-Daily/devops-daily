---
title: 'Day 7: The Duplicate Events'
day: 7
excerpt: 'The queue delivers some events twice. Find the latest status of every order before you add anything up.'
difficulty: 'Intermediate'
skills:
  - DISTINCT ON
  - Deduplication
schema: 'day07'
answerHash: '6d90e409673803778775c361abf4d2a39f4d57d73b94f834e3ac5abe85562078'
answerFormat: 'A number, for example 120000'
starter: 'select * from order_events order by order_id, received_at limit 20;'
hint: 'DISTINCT ON keeps the first row of each group in the ORDER BY order, so order the newest event first.'
publishedAt: '2026-12-07T00:00:00Z'
---

The gift dashboard says the workshop shipped far more than the warehouse remembers. Shinny suspects the event queue: when a consumer times out, the queue delivers the same event again.

Every event is in `order_events`:

| Column        | Type          | Notes                                        |
| ------------- | ------------- | -------------------------------------------- |
| `event_id`    | `bigint`      | Primary key                                  |
| `order_id`    | `int`         | The order the event is about                 |
| `status`      | `text`        | `placed`, `packed`, `shipped` or `cancelled` |
| `gift_value`  | `int`         | The order's value, in candy canes            |
| `received_at` | `timestamptz` | When the event arrived                       |

An order's current status is the status of its most recent event. A duplicate has the same order and status as another event.

## Your task

What is the **total gift value of all orders whose current status is shipped**?

Submit the number.
