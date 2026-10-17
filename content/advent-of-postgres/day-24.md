---
title: 'Day 24: The Launch Readiness Check'
day: 24
excerpt: 'The last check before the big night: which services met their availability target this month, with planned maintenance left out.'
difficulty: 'Advanced'
skills:
  - Availability math
  - Ranges
  - Anti-joins
schema: 'day24'
answerHash: '434cbd4f9d07df39d9deb8189e63f1737422e7e08a176987afe4f4dded4bd85b'
answerFormat: 'A number of services, for example 2'
starter: 'select service, count(*) filter (where not ok) as failed, count(*) as checks from checks group by service;'
hint: "Leave out every check that falls inside its own service's maintenance window (a range contains a timestamp with @>), then compare the share of ok checks with 0.9995."
publishedAt: '2026-12-24T00:00:00Z'
---

It is 24 December. Before the sleigh takes off, Alabaster runs one last check: every service promised 99.95% availability for December, and only the services that kept the promise get to stay live tonight without an elf watching them.

Every service was checked once a minute from 1 to 23 December, in `checks`:

| Column       | Type          | Notes                   |
| ------------ | ------------- | ----------------------- |
| `service`    | `text`        | Part of the primary key |
| `checked_at` | `timestamptz` | Every minute            |
| `ok`         | `boolean`     | `false` when it failed  |

Some services had planned work, announced in advance, in `planned_maintenance`:

| Column    | Type        | Notes                                   |
| --------- | ----------- | --------------------------------------- |
| `service` | `text`      | Which service                           |
| `window_` | `tstzrange` | `[start, end)`: the end is not included |

A service's availability is the share of its checks that passed, leaving out the checks inside its own planned maintenance windows. A service meets the target when that share is 99.95% (0.9995) or more.

## Your task

**How many services met the 99.95% target?**

Submit the number.
