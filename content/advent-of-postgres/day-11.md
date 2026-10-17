---
title: 'Day 11: The Cloud Bill'
day: 11
excerpt: 'Finance wants to know the day one team blew through its December budget. A running total answers it, if the window is right.'
difficulty: 'Intermediate'
skills:
  - Window functions
  - Running totals
schema: 'day11'
answerHash: '55976df6df2776c6a44a6583881e7b9cec2964f585843ac358598de9d3466e6d'
answerFormat: 'A date, for example 2026-12-03'
starter: 'select * from daily_costs order by team, day limit 20;'
hint: 'sum(cost) OVER (ORDER BY day) is a running total. Filter to one team first, or partition by team.'
publishedAt: '2026-12-11T00:00:00Z'
---

Every team has a December cloud budget of 10,000 candy canes. The wrapping team had a rough first week, and finance wants the exact day the team went over.

Each team's spend per day is in `daily_costs`:

| Column | Type   | Notes                      |
| ------ | ------ | -------------------------- |
| `team` | `text` | Part of the primary key    |
| `day`  | `date` | 1 to 24 December           |
| `cost` | `int`  | Candy canes spent that day |

The table already has the planned spend for the rest of the month, so the answer can be later than today.

## Your task

On which day did the **wrapping team's running December total first reach 10,000** candy canes or more?

Submit the date as `YYYY-MM-DD`.
