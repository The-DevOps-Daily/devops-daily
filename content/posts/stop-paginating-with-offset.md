---
title: 'Stop Paginating With OFFSET: Keyset Pagination and the Deep-Page Cliff'
excerpt: 'LIMIT/OFFSET is the reflexive way to paginate, and it is fine on page one. But OFFSET makes the database generate and throw away every row before the page you want, so cost grows with page depth until deep pages fall off a cliff. Keyset pagination makes every page the same speed regardless of depth. Here is why OFFSET is slow, the fix, and the one tradeoff.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-07-03'
publishedAt: '2026-07-03T09:00:00Z'
updatedAt: '2026-07-03T09:00:00Z'
readingTime: '10 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - PostgreSQL
  - Databases
  - Performance
  - Pagination
  - Backend
  - DevOps
---

`LIMIT 20 OFFSET 40` is how almost everyone paginates, and on the first few pages it is perfectly fine. The problem is what `OFFSET` actually asks the database to do: produce every row in sorted order up to and including the offset, then throw the offset rows away and return the rest. Page one discards nothing. Page 5,000 at 20 rows per page tells the database to generate 100,000 rows in order and discard 99,980 of them, on every single request. Cost scales with how deep the page is, so pagination that feels instant in testing quietly falls off a cliff on the deep pages that infinite scroll, API consumers, and crawlers reach constantly.

The fix is keyset pagination (also called seek or cursor pagination), and the win is dramatic: instead of counting past rows you do not want, you remember where the last page ended and seek straight to the next one, so every page costs the same no matter how deep you are. This post shows why `OFFSET` gets slower with depth even with a perfect index, how keyset pagination works, the composite-key detail that makes it correct, and the one real tradeoff you are accepting.

## TL;DR

- `OFFSET n` makes the database walk and discard `n` rows before it can return your page, so query time grows with page depth. An index does not fix it; the rows still have to be walked.
- **Keyset pagination** replaces `OFFSET` with a `WHERE` clause on the last row's sort key: `WHERE (sort_key) > :last ORDER BY sort_key LIMIT n`. With an index on the sort key, every page is roughly the same cost regardless of depth.
- Order by a **unique** key (or a `(column, id)` tuple as a tiebreaker) or you will skip or duplicate rows at page boundaries.
- The tradeoff: keyset gives you next/previous, not "jump to page 47." It is ideal for infinite scroll and APIs, and a poor fit for a UI that needs numbered pages.
- Do not over-correct. On small tables or shallow pagination, `OFFSET` is fine. Reach for keyset when pages get deep or the table gets large.

## Prerequisites

- A SQL database (examples are PostgreSQL, but the idea applies to MySQL and others)
- A table you paginate with `ORDER BY ... LIMIT ... OFFSET ...`
- Comfort reading `EXPLAIN (ANALYZE)`
- An index on the column(s) you sort by

## Why OFFSET gets slower the deeper you page

The database cannot skip to the millionth row of a sorted result without first establishing which rows come before it. Even with an index on the `ORDER BY` column, `OFFSET 1000000` means the executor walks a million index entries (and, unless the scan is index-only, fetches their heap rows) purely to count them off, then starts returning yours. Without a usable index it is worse: a full sort of the matching set before anything is discarded.

```text
LIMIT 20 OFFSET 100000, ordered by created_at

  scan in sorted order ────────────────────────────▶
  [row 1][row 2] ... [row 100000][row 100001 ... 100020]
   \_________ walked and DISCARDED _________/  \__ returned __/
              100,000 rows of pure waste          20 rows
```

The 20 rows you keep are cheap. The 100,000 you discard are the whole cost, and they get re-discarded on every request for that page. This is why "add an index" is not the fix people expect: the index makes the walk ordered, but you are still walking.

## Seeing the cliff

Put numbers on it with `EXPLAIN (ANALYZE)` on a table of a few million rows, indexed on `created_at`. Page one is instant; a deep page is not, and keyset is instant at any depth.

```terminal
{
  "title": "OFFSET depth vs keyset, EXPLAIN (ANALYZE)",
  "prompt": "=>",
  "steps": [
    { "comment": "page 1: OFFSET 0, nothing to discard, fast" },
    { "cmd": "EXPLAIN (ANALYZE, COSTS OFF)\nSELECT * FROM events ORDER BY created_at DESC LIMIT 20 OFFSET 0;", "output": "Limit (actual time=0.021..0.028 rows=20)\n  ->  Index Scan Backward using events_created_at_idx on events\n        (actual rows=20)\n Execution Time: 0.049 ms" },
    { "comment": "deep page: OFFSET 1,000,000, walk and discard a million rows" },
    { "cmd": "EXPLAIN (ANALYZE, COSTS OFF)\nSELECT * FROM events ORDER BY created_at DESC LIMIT 20 OFFSET 1000000;", "output": "Limit (actual time=612.4..612.4 rows=20)\n  ->  Index Scan Backward using events_created_at_idx on events\n        (actual rows=1000020)\n Execution Time: 612.503 ms" },
    { "comment": "keyset: seek past the last row's key, same speed at any depth" },
    { "cmd": "EXPLAIN (ANALYZE, COSTS OFF)\nSELECT * FROM events WHERE created_at < '2026-05-01 09:00:00'\nORDER BY created_at DESC LIMIT 20;", "output": "Limit (actual time=0.024..0.031 rows=20)\n  ->  Index Scan Backward using events_created_at_idx on events\n        Index Cond: (created_at < '2026-05-01 09:00:00')\n        (actual rows=20)\n Execution Time: 0.053 ms" }
  ]
}
```

Look at `actual rows` on the index scan: the deep `OFFSET` reads **1,000,020** rows to return 20, while keyset reads **20**. The timings are illustrative, but the shape is the mechanism, not luck: `OFFSET` work grows with depth, keyset work does not.

## Keyset pagination

The idea is to stop describing a page by "how many rows to skip" and start describing it by "where the last page ended." You order by a key, return a page, and remember the last row's key. The next page asks for rows past that key:

```sql
-- first page
SELECT id, created_at, title
FROM events
ORDER BY created_at DESC
LIMIT 20;

-- next page: seek past the last row you showed (created_at = :last_seen)
SELECT id, created_at, title
FROM events
WHERE created_at < :last_seen
ORDER BY created_at DESC
LIMIT 20;
```

Because there is a `WHERE` on the indexed sort column, the database uses the index to jump straight to the starting position and reads only the 20 rows it returns. Page 1 and page 50,000 do the same amount of work. That is the entire trick.

## Make the sort key unique, or you will skip rows

There is a correctness catch that trips people up. `created_at` is almost never unique: many rows can share a timestamp. If two rows at a page boundary have the same `created_at`, a plain `created_at < :last_seen` can skip or duplicate them. The fix is to order by a tuple that is guaranteed unique, normally the sort column plus the primary key, and seek on the whole tuple with a row-value comparison:

```sql
-- stable total order: (created_at, id); seek on the tuple
SELECT id, created_at, title
FROM events
WHERE (created_at, id) < (:last_created_at, :last_id)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

PostgreSQL compares row values left to right, and a composite index on `(created_at, id)` serves this directly. Now the ordering is a total order with no ties, so no boundary row is ever skipped or repeated. In practice you hand the client an opaque **cursor**, usually the last `(created_at, id)` encoded as a base64 token, and it passes that back for the next page instead of a page number.

:::warning
Keyset only works if the ordering is deterministic and total. Order by something unique, or append a unique tiebreaker like the primary key. And make sure an index covers the exact `ORDER BY` you seek on (`(created_at, id)` here); without it, keyset loses its whole advantage and you are back to scanning.
:::

## The tradeoff, and when OFFSET is fine

Keyset is not a free lunch, and pretending otherwise is how you pick the wrong tool.

- **No random page access.** You get next and previous, not "jump to page 200." There is no cheap way to land on an arbitrary numbered page, because you do not know the key that page starts at without walking there. If your UI shows `1 2 3 ... 200` and users click around, keyset does not fit; classic numbered pagination needs `OFFSET` (or a different design).
- **Total counts are still expensive.** Keyset does not give you "page X of Y" for free. If you need an exact total, that is a separate `count(*)`, and on a big table you may want an estimate instead.
- **Small or shallow cases do not need it.** On a table of a few thousand rows, or an admin screen nobody pages past screen three, `OFFSET` is simpler and completely fine. Do not add cursor plumbing to a list that never gets deep.

:::note
The sweet spot for keyset is exactly where `OFFSET` hurts: infinite scroll, "load more" feeds, public APIs whose consumers page through everything, and any endpoint a crawler will walk to the end. Those are deep-pagination workloads by nature, and they rarely need to jump to an arbitrary page.
:::

## How to adopt it

1. **Find the deep-pagination endpoints.** Look for `ORDER BY ... LIMIT ... OFFSET ...` on large tables, especially anything feeding infinite scroll or a public API.
2. **Pick a total ordering.** Choose your sort column plus a unique tiebreaker (usually the primary key), and add or confirm a composite index on exactly that.
3. **Switch skip to seek.** Replace `OFFSET` with a `WHERE (sort_cols) </> (:cursor)` on that tuple, keeping `ORDER BY` aligned with the index.
4. **Return a cursor, not a page number.** Encode the last row's key as an opaque token the client sends back for the next page.
5. **Measure at depth.** Compare `EXPLAIN (ANALYZE)` on a deep page before and after, and watch `actual rows` collapse from `offset + limit` down to `limit`.

:::tip
Want to practice the `EXPLAIN` and `ORDER BY` mechanics behind this hands-on? The [PostgreSQL Terminal Simulator](/games/postgres-terminal-simulator) runs `EXPLAIN` before and after an index in the browser, and the [SQL Terminal Simulator](/games/sql-terminal-simulator) lets you write and run the queries against a sample schema.
:::

## Wrapping up

`OFFSET` is not broken, it is just doing exactly what it says: skipping rows by counting past them, which costs more the deeper you go. On shallow pages nobody notices; on the deep pages that real traffic reaches, that linear cost is a latency cliff you cannot index your way out of. Keyset pagination trades random page access, which most feeds and APIs never needed, for pages that cost the same at any depth. Find your deep-pagination endpoints, give them a unique ordering with an index to match, and seek instead of skip. The reward is pagination that stays fast at row one and row ten million alike.
