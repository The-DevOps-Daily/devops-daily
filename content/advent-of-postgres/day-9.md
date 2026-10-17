---
title: 'Day 9: The Blast Radius'
day: 9
excerpt: 'If the DNS service goes down, what else breaks? Walk the dependency graph with a recursive query, and mind the loop.'
difficulty: 'Intermediate'
skills:
  - Recursive CTEs
  - Graphs
schema: 'day09'
answerHash: '5fa0e48ce9240ac3554b616f763ab7743bbbadd2aaed3d8afe70494b8c257783'
answerFormat: 'A number, for example 5'
starter: 'select * from dependencies order by service;'
hint: 'A recursive CTE with UNION, not UNION ALL, stops when it finds no new rows. That is what keeps the loop from running forever.'
publishedAt: '2026-12-09T00:00:00Z'
---

The DNS servers for chimney lookups are getting a risky upgrade tonight. Before Alabaster signs off, she wants to know how many services could go down with it.

Every call between services is in `dependencies`:

| Column       | Type   | Notes              |
| ------------ | ------ | ------------------ |
| `service`    | `text` | This service       |
| `depends_on` | `text` | A service it calls |

If a service goes down, every service that calls it goes down too, and so on up the chain. Somewhere in the table there is an old loop that nobody cleaned up.

## Your task

If `chimney-dns` goes down, **how many other services go down with it**, directly or through other services?

Submit the number.
