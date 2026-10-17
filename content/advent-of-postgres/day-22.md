---
title: 'Day 22: The Fastest Route'
day: 22
excerpt: "Plan the sleigh's route through the relay stations. The route with the fewest stops is not the fastest one."
difficulty: 'Advanced'
skills:
  - Recursive CTEs
  - Shortest path
schema: 'day22'
answerHash: 'ce08ebb8b76d8a6e8229ee16d13e31f95ad4829a32d6c9ba201fedb13a00b2b6'
answerFormat: 'A number of minutes, for example 180'
starter: 'select * from hops order by from_stop, minutes;'
hint: 'Build every route with a recursive CTE that carries the total time and an array of visited stops (so it never loops), then take the minimum for oslo.'
publishedAt: '2026-12-22T00:00:00Z'
---

Two days to go. The sleigh flies from the North Pole to Oslo through a chain of relay stations, and the route planner broke in the last deploy. Alabaster needs the fastest route by hand.

The relay hops are in `hops`. Each hop is one way:

| Column      | Type   | Notes                    |
| ----------- | ------ | ------------------------ |
| `from_stop` | `text` | Where the hop starts     |
| `to_stop`   | `text` | Where it ends            |
| `minutes`   | `int`  | Flying time for this hop |

The sleigh starts at `north-pole` and can take any chain of hops. It never needs to visit a station twice.

## Your task

What is the **shortest total flying time from north-pole to oslo**, in minutes?

Submit the number.
