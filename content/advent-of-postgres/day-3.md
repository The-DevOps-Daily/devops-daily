---
title: 'Day 3: Who Was On Call?'
day: 3
excerpt: 'Match every incident to the elf who held the pager when it started. The shifts are ranges, and the handovers are where it gets interesting.'
difficulty: 'Beginner'
skills:
  - Range types
  - Joins
schema: 'day03'
answerHash: '244262037dcecbc02576fcc61e6a2e7e22e096c168cace13fd4073bbee032d6a'
answerFormat: 'An elf name, for example alabaster'
starter: 'select * from oncall order by lower(shift);'
hint: 'A range has an operator that checks if it contains a timestamp, and it respects the [ ) bounds. BETWEEN does not.'
publishedAt: '2026-12-03T00:00:00Z'
---

The on-call rota has been rough this week, and Pepper wants to thank whoever took the most pages. The rota and the incident list are both in the database, so you offer to work it out.

The rota is in `oncall`. Each row is one 8-hour shift, stored as a range:

| Column  | Type        | Notes                                                 |
| ------- | ----------- | ----------------------------------------------------- |
| `elf`   | `text`      | Who held the pager                                    |
| `shift` | `tstzrange` | `[start, end)`: the shift owns its start, not its end |

The incidents are in `incidents`:

| Column       | Type          | Notes                      |
| ------------ | ------------- | -------------------------- |
| `id`         | `int`         | Primary key                |
| `service`    | `text`        | Where it happened          |
| `started_at` | `timestamptz` | When the first alert fired |
| `severity`   | `int`         | 1 is the worst             |

Shifts hand over at 00:00, 08:00 and 16:00 UTC. Some alerts fire exactly at a handover.

## Your task

Count each incident once, for the elf whose shift contains the moment it started. Which elf was **on call for the most incidents**?

Submit the elf's name.
