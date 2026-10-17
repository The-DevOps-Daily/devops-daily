---
title: 'Day 19: The Disk That Fills Up'
day: 19
excerpt: 'Fit a line to two weeks of disk usage and find the host that runs out of space first. The fullest disk today is not the answer.'
difficulty: 'Advanced'
skills:
  - regr_slope
  - Forecasting
schema: 'day19'
answerHash: 'e6923e4ddb93506d750756e512e15faf6c4f5c1a0eed9448afa14a134aee7822'
answerFormat: 'A host name, for example db-1'
starter: 'select host, max(size_gb) as size_gb, min(used_gb), max(used_gb) from disk_usage group by host;'
hint: 'regr_slope(used_gb, extract(epoch from measured_at)) is the growth in GB per second. Divide the free space at the last measurement by it.'
publishedAt: '2026-12-19T00:00:00Z'
---

Nobody wants a full disk on 24 December. Wunorse asks you which host will run out of space first if things keep growing the way they have for the last two weeks.

Every host reports its disk usage every six hours to `disk_usage`:

| Column        | Type           | Notes                          |
| ------------- | -------------- | ------------------------------ |
| `host`        | `text`         | Part of the primary key        |
| `measured_at` | `timestamptz`  | Every 6 hours, from 5 December |
| `used_gb`     | `numeric(8,2)` | Space used                     |
| `size_gb`     | `int`          | Size of the disk               |

The measurements are noisy, so use the least-squares line through all of a host's points as its growth rate. The free space is the size minus the usage at the host's last measurement.

## Your task

At its own growth rate, **which host runs out of disk space first**?

Submit the host name.
