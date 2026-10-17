---
title: 'Day 23: The Tracking Sessions'
day: 23
excerpt: 'Children refresh the gift tracker in bursts. Turn a stream of page views into sessions with a 30-minute gap rule.'
difficulty: 'Advanced'
skills:
  - Sessionization
  - LAG
schema: 'day23'
answerHash: 'a53691347c5eb928a9e63ead0c88e8e0efa65a680762a6220d6b6ae53c93969c'
answerFormat: 'A number, for example 500'
starter: 'select * from page_views order by child_id, viewed_at limit 30;'
hint: "Compare each view with the same child's previous view (LAG, partitioned by child). A gap over 30 minutes, or no previous view at all, starts a session."
publishedAt: '2026-12-23T00:00:00Z'
---

The gift tracker is the busiest page at the North Pole on 23 December. Shinny wants to know how many visits it really gets, not how many page loads, to size the servers for tomorrow.

Every page view is in `page_views`:

| Column      | Type          | Notes                |
| ----------- | ------------- | -------------------- |
| `id`        | `bigint`      | Primary key          |
| `child_id`  | `int`         | Who was looking      |
| `viewed_at` | `timestamptz` | When the page loaded |

The team counts visits as sessions. A child's session starts with their first view. A new session starts when more than 30 minutes have passed since that child's previous view. Exactly 30 minutes is still the same session. Sessions do not stop at midnight or at the top of an hour.

## Your task

How many **sessions** are in the table?

Submit the number.
