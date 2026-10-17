---
title: 'Day 16: The Error of the Hour'
day: 16
excerpt: 'One bad hour can make an error code look like the biggest problem of the day. Find the code that leads the most hours instead.'
difficulty: 'Intermediate'
skills:
  - mode()
  - Two-level aggregation
schema: 'day16'
answerHash: 'c24ff2cb62e9c504a28e7bd0b8d739aae1a6177267282234e67a394bb4f4488e'
answerFormat: 'An error code, for example E404'
starter: 'select code, count(*) from errors group by code order by 2 desc;'
hint: "mode() WITHIN GROUP (ORDER BY code) gives the most common code per group, and picks the code that sorts first on a tie. Group by date_trunc('hour', occurred_at, 'UTC') first, then count the winners."
publishedAt: '2026-12-16T00:00:00Z'
---

The error dashboard shows one huge bar for 16 December, and Bushy wants to fix that error first. Tinsel is not so sure. "One bad hour does not make a pattern," Tinsel says. "Which error is the problem hour after hour?"

Every error on 16 December is in `errors`:

| Column        | Type          | Notes                        |
| ------------- | ------------- | ---------------------------- |
| `id`          | `bigint`      | Primary key                  |
| `occurred_at` | `timestamptz` | When it happened             |
| `code`        | `text`        | For example `E429` or `E503` |

For each hour of the day (UTC), the error of the hour is the code that occurred most often in that hour. If two codes tie in an hour, the code that sorts first alphabetically wins that hour.

## Your task

Which code was the **error of the hour in the most hours**?

Submit the code.
