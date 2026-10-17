---
title: 'Day 21: The Deleted Gifts'
day: 21
excerpt: 'A cleanup job deleted every wrapped gift three seconds after the data loaded. Go back in time with a Neon branch and count what was lost.'
difficulty: 'Advanced'
skills:
  - Neon point-in-time branches
  - Recovery
schema: 'day21'
answerHash: '804445ffbfa1bbb5eddf31e1391f84fb5df7e1ddf5f4903acdec27801d03188a'
answerFormat: 'A number of candy canes, for example 150000'
starter: 'select * from deploy_log;'
hint: "Create the branch from a point in time one or two seconds before deploy_log.deployed_at. Then use that branch's connection string here, or query it in the Neon SQL Editor."
publishedAt: '2026-12-21T00:00:00Z'
---

Three days before the big night, a cleanup job ran against the gift table. It was meant to remove test rows. Its filter was wrong, and it deleted every gift that was already wrapped. The deploy log says exactly when it ran.

Neon keeps the history of every change for a while (6 hours on the Free plan), so you can create a branch from any moment in that window. A branch from just before the job ran has all the gifts.

Today's data loads in three steps when you first run a query: the gifts, a pause of a few seconds, then the bad cleanup job. The tables:

| Table        | Columns                                      | Notes                                     |
| ------------ | -------------------------------------------- | ----------------------------------------- |
| `gifts`      | `id`, `child_id`, `item`, `value`, `wrapped` | `value` is in candy canes                 |
| `deploy_log` | `deployed_at`, `release`, `note`             | When the cleanup job ran, and what it was |

The steps, in this order:

1. If your database is not in your Neon account yet, press "Keep it for the month" and claim it. Neon resets the password during the move, so paste the new connection string when the page asks.
2. Run the starter query. Today's data loads, and a few seconds later the cleanup job runs.
3. Note the `deployed_at` time from `deploy_log`.
4. In the Neon Console, create a branch from a point in time one second before `deployed_at`, within the 6-hour history window. `neon branches create` with that timestamp as the parent does the same.
5. Point this page at the branch with "Use another connection string", or query the branch in the Neon SQL Editor.

## Your task

On a branch from just before the cleanup job, what was the **total value of all wrapped gifts**?

Submit the number of candy canes.
