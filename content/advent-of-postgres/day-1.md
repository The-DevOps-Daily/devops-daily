---
title: 'Day 1: The Failed Deploys'
day: 1
excerpt: 'The change freeze starts soon. Find the riskiest service to deploy from two weeks of deploy logs written by four different tools.'
difficulty: 'Beginner'
skills:
  - GROUP BY
  - Text cleanup
schema: 'day01'
answerHash: '62984a62b17384404b9a421353c9a5a6dff361ada380fbdfb0c2be5bca3f22cf'
answerFormat: 'A service name, for example sleigh-api'
starter: 'select * from deploys limit 10;'
hint: 'Look at every distinct value in the status column before you filter on it.'
publishedAt: '2026-12-01T00:00:00Z'
---

The North Pole platform team is getting ready for the busiest night of the year. Alabaster, who runs the team, wants to start the change freeze with the riskiest service. "Show me which service breaks most often when we ship it," she says, and points you at the deploy log.

The log is in the `deploys` table:

| Column        | Type          | Notes                          |
| ------------- | ------------- | ------------------------------ |
| `id`          | `int`         | Primary key                    |
| `service`     | `text`        | One of eight services          |
| `deployed_at` | `timestamptz` | When the deploy finished       |
| `status`      | `text`        | What the deploy tool reported  |
| `author`      | `text`        | The elf who pressed the button |

The log covers 24 November to 7 December. Not every service is deployed with the same tool, and the tools do not agree on how to write things down.

## Your task

Which service had the **most failed deploys from 1 December to 7 December 2026**, both days included, in UTC?

Submit the service name.
