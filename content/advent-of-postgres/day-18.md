---
title: 'Day 18: The Lock Pile-Up'
day: 18
excerpt: 'Thirteen sessions are stuck waiting on locks. Follow the blocking chains back to the session that is really holding everyone up.'
difficulty: 'Advanced'
skills:
  - Recursive CTEs
  - Arrays
schema: 'day18'
answerHash: '494cdd636c50a2ad5c8f78412b2482b61ef90959f7b57fafd4308ff94f832321'
answerFormat: 'A process id, for example 105'
starter: 'select * from lock_snapshot order by pid;'
hint: 'unnest(blocked_by) turns the array into one row per blocker. Then walk the edges with a recursive CTE and count everyone each root is holding up.'
publishedAt: '2026-12-18T00:00:00Z'
---

At 03:12 the gift database froze. Pepper caught a snapshot of who was waiting on whom before restarting anything, and wants to know which session to cancel first.

The snapshot is in `lock_snapshot`, built from `pg_blocking_pids()`:

| Column       | Type    | Notes                                          |
| ------------ | ------- | ---------------------------------------------- |
| `pid`        | `int`   | Primary key: the session                       |
| `query`      | `text`  | What it was running                            |
| `blocked_by` | `int[]` | The sessions it was waiting for (can be empty) |

If session A waits for B, and B waits for C, then C is holding up both B and A. A session can wait for more than one other session.

## Your task

Which session **holds up the most other sessions**, directly or through a chain?

Submit its `pid`.
