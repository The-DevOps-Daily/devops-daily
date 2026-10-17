---
title: 'Day 6: The Quick Rollbacks'
day: 6
excerpt: 'A release that goes back to the version before it is a rollback. Count the fast ones, per service, with window functions.'
difficulty: 'Intermediate'
skills:
  - LAG
  - PARTITION BY
schema: 'day06'
answerHash: 'f4dc1612c3778d0075f86fc7788051bc31cb78c3ddce3ca276f6ed7ce2dc7c73'
answerFormat: 'A number, for example 7'
starter: 'select * from releases order by service, released_at limit 20;'
hint: 'lag(version, 2) and lag(released_at) need a window that is partitioned by service.'
publishedAt: '2026-12-06T00:00:00Z'
---

Wunorse thinks the team ships too fast. "Half our releases get rolled back before lunch," Wunorse claims. You decide to check.

Every release is in `releases`:

| Column        | Type          | Notes                                 |
| ------------- | ------------- | ------------------------------------- |
| `id`          | `int`         | Primary key                           |
| `service`     | `text`        | Each service has its own version line |
| `version`     | `text`        | For example `4.12`                    |
| `released_at` | `timestamptz` | When the release went live            |

For one service, a release is a **quick rollback** when its version is the same as the version released two releases earlier, and it went out no more than 60 minutes after the release before it. Releases of different services do not affect each other.

## Your task

How many **quick rollbacks** are in the table?

Submit the number.
