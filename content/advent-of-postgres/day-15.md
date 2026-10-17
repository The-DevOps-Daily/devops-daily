---
title: 'Day 15: The Postmortem Archive'
day: 15
excerpt: 'Search a year of postmortems for certificate renewals. Full-text search finds every form of a word; LIKE does not.'
difficulty: 'Intermediate'
skills:
  - Full-text search
  - tsvector
schema: 'day15'
answerHash: 'c014158437298f913d3e7ccc14fdadd1dca523100897704ff6da6a4438ce9934'
answerFormat: 'A number, for example 40'
starter: 'select id, title, left(body, 120) from postmortems limit 10;'
hint: "to_tsvector('english', ...) @@ to_tsquery('english', 'certificate & renewal') matches renewed and renewing too, because both words are reduced to their stems."
publishedAt: '2026-12-15T00:00:00Z'
---

Alabaster is sure that expired certificates cause half the incidents at the North Pole. Before the next planning meeting, she wants a number from the postmortem archive.

Every postmortem from 2026 is in `postmortems`:

| Column         | Type   | Notes                                  |
| -------------- | ------ | -------------------------------------- |
| `id`           | `int`  | Primary key                            |
| `title`        | `text` | For example `Incident 12: gift-router` |
| `body`         | `text` | A few sentences                        |
| `published_on` | `date` | When it was published                  |

The elves do not write the same way twice. A postmortem can talk about a renewal, say that nobody renewed a certificate, or mention a job that was renewing something. All of these count.

## Your task

Use Postgres full-text search with the `english` configuration on the title and body together. How many postmortems **match both certificate and renewal**, in any form of those words?

Submit the number.
