---
title: 'Day 12: The Noisy Alerts'
day: 12
excerpt: 'Every team gets to silence its three noisiest alert rules. Rank the rules per team, not across the whole company.'
difficulty: 'Intermediate'
skills:
  - row_number
  - Top N per group
schema: 'day12'
answerHash: 'c0cf099ba8c3642d00092ef9cb8445653589a93a5d873c62a537c3740b87486d'
answerFormat: 'A number, for example 250'
starter: 'select team, rule, count(*) from alerts group by team, rule order by team, count(*) desc;'
hint: 'Count per team and rule first, then use row_number() OVER (PARTITION BY team ORDER BY count DESC, rule).'
publishedAt: '2026-12-12T00:00:00Z'
---

Alert fatigue is real at the North Pole. The new policy: each team may silence its three noisiest alert rules for the rest of December. Sugarplum wants to know how many alerts that would have removed on 12 December.

Every alert that fired on 12 December (UTC) is in `alerts`, and nothing else is, so count every row:

| Column     | Type          | Notes                       |
| ---------- | ------------- | --------------------------- |
| `id`       | `int`         | Primary key                 |
| `team`     | `text`        | The team that owns the rule |
| `rule`     | `text`        | The alert rule that fired   |
| `fired_at` | `timestamptz` | When it fired               |

A rule's noise is how many times it fired. If two rules of a team fired the same number of times, the one whose name comes first alphabetically ranks higher.

## Your task

Take **each team's three noisiest rules**. How many alerts did those rules fire in total?

Submit the number.
