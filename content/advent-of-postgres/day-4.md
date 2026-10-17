---
title: 'Day 4: The Longest Outage'
day: 4
excerpt: 'Health checks run every minute. Find the longest unbroken run of failures, not the service that failed the most in total.'
difficulty: 'Intermediate'
skills:
  - Window functions
  - Gaps and islands
schema: 'day04'
answerHash: '40e89e08eb072211373c4b0c551d130308b4eb8d9e422211964a2a4859bda4b5'
answerFormat: 'A number of minutes, for example 12'
starter: 'select * from health_checks order by service, checked_at limit 20;'
hint: 'Number the checks per service, and number them again per service and ok value. The difference stays the same inside a run.'
publishedAt: '2026-12-04T00:00:00Z'
---

Sugarplum is writing the outage report for 4 December. The status page has to show the single worst outage of the day, and the health checker is the only record.

The checker writes one row per service per minute to `health_checks`:

| Column       | Type          | Notes                         |
| ------------ | ------------- | ----------------------------- |
| `service`    | `text`        | Part of the primary key       |
| `checked_at` | `timestamptz` | Every minute on 4 December    |
| `ok`         | `boolean`     | `false` when the check failed |

An outage is a run of failed checks in a row for one service. One passing check ends it. Each failed check counts as one minute, so 12 failed checks in a row is a 12-minute outage. A service can have many short outages and still not have the longest one.

## Your task

How many minutes long was the **longest outage** of the day, across all services?

Submit the number of minutes.
