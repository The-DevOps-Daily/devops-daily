---
title: 'Day 14: The Late-Night Deploys'
day: 14
excerpt: "Office hours depend on where the office is. Count the deploys made outside working hours in each elf's own time zone."
difficulty: 'Intermediate'
skills:
  - Time zones
  - AT TIME ZONE
schema: 'day14'
answerHash: '048109727848513665cadc1ee0e75873af497ac5c8b4d3a63d5bd4588ee4b1e5'
answerFormat: 'A number, for example 100'
starter: 'select * from elves;'
hint: 'deployed_at AT TIME ZONE e.time_zone turns a timestamptz into the local time of that office. Then check the weekday and the hour.'
publishedAt: '2026-12-14T00:00:00Z'
---

The platform team works from six offices around the world. Bushy thinks too many deploys happen at night or on weekends, when nobody is around to fix them. The team agreed on one rule: deploy only on weekdays, between 09:00 and 17:00 in your own office's time zone.

The elves and their offices are in `elves`:

| Column      | Type   | Notes                                       |
| ----------- | ------ | ------------------------------------------- |
| `name`      | `text` | Primary key                                 |
| `time_zone` | `text` | An IANA time zone, for example `Asia/Tokyo` |

The deploys from 7 December 00:00 UTC to 14 December 00:00 UTC are in `deploys`. Count every row in the table:

| Column        | Type          | Notes                    |
| ------------- | ------------- | ------------------------ |
| `id`          | `int`         | Primary key              |
| `author`      | `text`        | References `elves(name)` |
| `deployed_at` | `timestamptz` | When the deploy happened |

A deploy at exactly 17:00 local time is outside working hours. Saturday and Sunday are not weekdays. One of the offices is on summer time in December.

## Your task

How many deploys were made **outside working hours, in the author's own time zone**?

Submit the number.
