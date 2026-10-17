---
title: 'Day 8: The JSON Logs'
day: 8
excerpt: 'The logs are JSON, and the field you need is three levels deep. Find where the gold-tier users hit errors.'
difficulty: 'Intermediate'
skills:
  - JSONB
  - Path operators
schema: 'day08'
answerHash: '17f8c724031f7830951651911fd0502fcc248c23386b1572087afab7a4f19469'
answerFormat: 'A region, for example us-east'
starter: 'select id, ts, jsonb_pretty(body) from logs limit 5;'
hint: "->> returns text, and #>> takes a path like '{ctx,user,tier}'. Lines without a user block return NULL there."
publishedAt: '2026-12-08T00:00:00Z'
---

Gold-tier users are the elves who pay for priority gift tracking, and support has a pile of complaints from them. Pepper wants to know which region to look at first.

All service logs for 8 December are in `logs`:

| Column | Type          | Notes                     |
| ------ | ------------- | ------------------------- |
| `id`   | `bigint`      | Primary key               |
| `ts`   | `timestamptz` | When the line was written |
| `body` | `jsonb`       | The structured log line   |

A typical `body`:

```json
{
  "level": "error",
  "service": "gift-router",
  "msg": "request handled",
  "ctx": { "region": "eu-north", "user": { "id": "u42", "tier": "gold" } }
}
```

Anonymous requests have no `user` block at all.

## Your task

Which region had the **most error-level log lines from gold-tier users**?

Submit the region.
