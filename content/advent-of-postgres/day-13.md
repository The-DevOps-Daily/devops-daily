---
title: 'Day 13: The Missing Hours'
day: 13
excerpt: 'A reading with no value and no reading at all are different problems. Find the hours when the reindeer collars went silent.'
difficulty: 'Intermediate'
skills:
  - generate_series
  - Gaps in time series
schema: 'day13'
answerHash: '04833c05bd3cbbf1137e9c87d7da9344150652fae16263be31ef3c8763bb3a71'
answerFormat: 'A number of hours, for example 3'
starter: "select date_trunc('hour', reported_at) as hour, count(*) from telemetry group by 1 order by 1;"
hint: 'GROUP BY can only show hours that have rows. Generate all 24 hours with generate_series and look for the ones with nothing.'
publishedAt: '2026-12-13T00:00:00Z'
---

The reindeer wear collars that report their heart rate every five minutes. Shinny suspects the uplink from the stables drops out for hours at a time, which would explain the gaps on the training charts.

The readings are in `telemetry`:

| Column        | Type          | Notes                                      |
| ------------- | ------------- | ------------------------------------------ |
| `service`     | `text`        | Always `reindeer-telemetry`                |
| `reported_at` | `timestamptz` | When the reading arrived                   |
| `heart_rate`  | `int`         | `null` when a sensor sent an empty reading |

An empty reading means a collar was online but its sensor failed. When the uplink is down, nothing arrives at all.

## Your task

How many hours of 13 December (UTC, counting from 00:00 to 24:00) had **no readings at all**?

Submit the number of hours.
