---
title: Indexes and Query Performance
description: 'Speed up PostgreSQL queries: read EXPLAIN ANALYZE plans and pick the right index (B-tree, GIN, GiST, BRIN, partial, expression or covering).'
order: 7
---

**TLDR**: Without an index, PostgreSQL reads the whole table to find matching rows. A B-tree index on the filtered column turns that into a few page reads. Use `EXPLAIN ANALYZE` to see what a query really does. Index foreign keys and the columns in your most frequent `WHERE`, `JOIN` and `ORDER BY` clauses. Use partial, expression and covering indexes for special cases, GIN for `jsonb` and arrays, and BRIN for huge append-only tables. Every index slows down writes, so drop the ones nobody uses.

A query that takes a millisecond on your laptop can take seconds in production once the table holds millions of rows. Most of the time the fix is an index, and the tool that tells you which index is `EXPLAIN`. This part builds a table with one million rows and shows the real plans PostgreSQL 18 chooses before and after each index.

## Prerequisites

- PostgreSQL 18 and `psql` ([Part 2](/guides/introduction-to-postgres/02-installation-and-setup)). The plans look slightly different on older versions; the differences are noted.
- Joins and `WHERE` clauses from [Part 3](/guides/introduction-to-postgres/03-sql-basics-and-crud) and [Part 6](/guides/introduction-to-postgres/06-advanced-queries-and-joins).
- A scratch database with some free disk space (the test tables below use about 250 MB): `CREATE DATABASE perf;` then `\c perf`.

Run the blocks in order to get the same output as shown. Blocks that start with `-- Not part of the walkthrough` show other forms of a statement; skip them, or your later results will differ. That matters here: an extra index can change the plans you see.

:::note
The plans in this part come from PostgreSQL 18.6 compiled to WebAssembly (PGlite) on a small ARM board, which is slower than a normal server. Compare the plan shapes, row counts and buffer numbers. Your milliseconds will differ.
:::

## Understanding Indexes

An index works like the index at the back of a book: instead of reading every page to find "PostgreSQL", you look up the word and jump to the pages it lists. A PostgreSQL B-tree index stores the indexed values in sorted order, and each entry points to the row's physical location in the table (the heap):

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "WHERE email = ...", "sub": "the query", "icon": "activity", "tone": "slate" },
    { "label": "B-tree root", "sub": "pick the right branch", "icon": "branch", "tone": "violet" },
    { "label": "Leaf page", "sub": "value -> row location", "icon": "box", "tone": "blue" },
    { "label": "Heap page", "sub": "read the row", "icon": "database", "tone": "green" }
  ]
}
```

Even for a million rows, the tree is only three or four levels deep, so a lookup reads a handful of 8 kB pages instead of thousands.

Create a table with one million users to experiment on:

```sql
CREATE TABLE users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL
);

-- 1,000,000 users: 90% active, 8% pending, 2% banned, one every 30 seconds
INSERT INTO users (email, status, created_at)
SELECT 'user' || n || '@example.com',
       CASE WHEN n % 50 = 0 THEN 'banned'
            WHEN n % 10 = 0 THEN 'pending'
            ELSE 'active' END,
       timestamptz '2025-01-01' + n * interval '30 seconds'
FROM generate_series(1, 1000000) AS n;

-- Update the planner statistics and the visibility map
VACUUM ANALYZE users;
```

## Types of Indexes

`CREATE INDEX` builds a B-tree unless you choose another method with `USING`.

### B-tree (Default)

B-tree handles equality, ranges, sorting, `IS NULL` and prefix matches with `LIKE 'abc%'` (for the latter, the column needs the `C` collation or a `text_pattern_ops` index). It is the right choice for most columns:

```sql
-- Not part of the walkthrough
CREATE INDEX users_created_at_idx ON users (created_at);

-- All of these can use it:
SELECT * FROM users WHERE created_at = '2025-03-01';
SELECT * FROM users WHERE created_at >= '2025-03-01' AND created_at < '2025-04-01';
SELECT * FROM users ORDER BY created_at DESC LIMIT 20;
```

### Hash

Hash indexes support only `=`. They can be smaller than a B-tree for long values such as URLs, but they cannot enforce uniqueness, sort or answer range queries. A B-tree is almost always the better default.

```sql
-- Not part of the walkthrough
CREATE INDEX users_email_hash_idx ON users USING hash (email);
```

### GIN (Generalized Inverted Index)

GIN indexes the elements inside a value: the keys of a `jsonb` document, the items of an array, or the words of a text search vector. Use it for containment and search queries:

```sql
CREATE TABLE articles (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX articles_tags_idx ON articles USING gin (tags);
CREATE INDEX articles_metadata_idx ON articles USING gin (metadata);
CREATE INDEX articles_title_fts_idx ON articles USING gin (to_tsvector('english', title));

SELECT * FROM articles WHERE tags @> ARRAY['postgres'];
SELECT * FROM articles WHERE metadata @> '{"status": "published"}';
SELECT * FROM articles WHERE to_tsvector('english', title) @@ to_tsquery('english', 'index & tuning');
```

GIN indexes are slower to update than B-trees, which matters on tables with heavy write traffic.

### GiST (Generalized Search Tree)

GiST handles values that overlap or have a distance: ranges, geometric types, network addresses, and PostGIS geometries. It also powers **exclusion constraints**, which say "no two rows may overlap". This one stops double bookings:

```sql
CREATE TABLE room_bookings (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  during tstzrange NOT NULL,
  EXCLUDE USING gist (during WITH &&)
);
```

```terminal
{
  "title": "an exclusion constraint",
  "prompt": "perf=#",
  "steps": [
    {
      "cmd": "INSERT INTO room_bookings (during) VALUES ('[2026-10-23 09:00+00, 2026-10-23 10:00+00)');",
      "output": "INSERT 0 1"
    },
    {
      "cmd": "INSERT INTO room_bookings (during) VALUES ('[2026-10-23 09:30+00, 2026-10-23 11:00+00)');",
      "output": "ERROR:  conflicting key value violates exclusion constraint \"room_bookings_during_excl\"\nDETAIL:  Key (during)=([\"2026-10-23 09:30:00+00\",\"2026-10-23 11:00:00+00\")) conflicts with existing key (during)=([\"2026-10-23 09:00:00+00\",\"2026-10-23 10:00:00+00\"))."
    }
  ]
}
```

To combine a range with an equality column (one booking per _room_), install the `btree_gist` extension and use `EXCLUDE USING gist (room_id WITH =, during WITH &&)`.

### BRIN (Block Range Index)

BRIN stores only the minimum and maximum value for each range of table pages. It is tiny, and it works well when the column's values follow the physical order of the table, as timestamps do in an append-only log:

```sql
CREATE TABLE page_views (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  path text NOT NULL,
  viewed_at timestamptz NOT NULL
);

INSERT INTO page_views (path, viewed_at)
SELECT '/posts/' || (n % 500), timestamptz '2026-01-01' + n * interval '10 seconds'
FROM generate_series(1, 1000000) AS n;

CREATE INDEX page_views_viewed_at_brin ON page_views USING brin (viewed_at);
CREATE INDEX page_views_viewed_at_btree ON page_views (viewed_at);
VACUUM ANALYZE page_views;
```

Compare the sizes of the two indexes on the same column:

```sql
SELECT indexrelname AS index,
       pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE relname = 'page_views'
ORDER BY pg_relation_size(indexrelid) DESC;
```

```text
           index            | size
----------------------------+-------
 page_views_pkey            | 21 MB
 page_views_viewed_at_btree | 21 MB
 page_views_viewed_at_brin  | 24 kB
(3 rows)
```

The B-tree on `viewed_at` takes 21 MB; the BRIN index takes 24 kB. After dropping the B-tree, the planner uses the BRIN index for a one-day range. The **lossy** heap blocks show the trade-off: BRIN only knows which page ranges _might_ contain matches, so PostgreSQL rechecks every row in those pages:

```sql
EXPLAIN ANALYZE
SELECT count(*) FROM page_views
WHERE viewed_at >= '2026-02-01' AND viewed_at < '2026-02-02';
```

```text
                                                                             QUERY PLAN
--------------------------------------------------------------------------------------------------------------------------------------------------------------------
 Aggregate  (cost=7647.37..7647.38 rows=1 width=8) (actual time=62.968..62.979 rows=1.00 loops=1)
   Buffers: shared hit=133
   ->  Bitmap Heap Scan on page_views  (cost=14.19..7625.80 rows=8625 width=0) (actual time=6.927..41.574 rows=8640.00 loops=1)
         Recheck Cond: ((viewed_at >= '2026-02-01 00:00:00+00'::timestamp with time zone) AND (viewed_at < '2026-02-02 00:00:00+00'::timestamp with time zone))
         Rows Removed by Index Recheck: 8768
         Heap Blocks: lossy=128
         Buffers: shared hit=133
         ->  Bitmap Index Scan on page_views_viewed_at_brin  (cost=0.00..12.03 rows=17241 width=0) (actual time=1.623..1.626 rows=1280.00 loops=1)
               Index Cond: ((viewed_at >= '2026-02-01 00:00:00+00'::timestamp with time zone) AND (viewed_at < '2026-02-02 00:00:00+00'::timestamp with time zone))
               Index Searches: 1
               Buffers: shared hit=5
 Planning:
   Buffers: shared hit=18 read=1 written=1
 Planning Time: 2.263 ms
 Execution Time: 63.813 ms
(15 rows)
```

If rows are inserted in random order, every page range covers almost every value and BRIN stops helping.

## EXPLAIN: Understanding Query Plans

`EXPLAIN` shows the plan the planner picked, without running the query. Look for one user by email:

```sql
EXPLAIN SELECT * FROM users WHERE email = 'user500000@example.com';
```

```text
                        QUERY PLAN
----------------------------------------------------------
 Seq Scan on users  (cost=0.00..21846.00 rows=1 width=45)
   Filter: (email = 'user500000@example.com'::text)
(2 rows)
```

Read it like this:

- **Seq Scan on users**: PostgreSQL reads the whole table.
- **cost=0.00..21846.00**: the planner's estimated cost to return the first row and all rows, in arbitrary units (roughly "pages read"). Only compare costs between plans for the same query.
- **rows=1**: the estimated number of result rows.
- **width=45**: the estimated average row size in bytes.

### EXPLAIN ANALYZE

`EXPLAIN ANALYZE` runs the query and adds what really happened. In PostgreSQL 18 it also reports buffer usage by default (on older versions, add `BUFFERS`):

```sql
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'user500000@example.com';
```

```text
                                                QUERY PLAN
-----------------------------------------------------------------------------------------------------------
 Seq Scan on users  (cost=0.00..21846.00 rows=1 width=45) (actual time=343.909..576.296 rows=1.00 loops=1)
   Filter: (email = 'user500000@example.com'::text)
   Rows Removed by Filter: 999999
   Buffers: shared hit=4644 read=4702 written=98
 Planning Time: 0.291 ms
 Execution Time: 576.408 ms
(6 rows)
```

- **actual time=start..end**: milliseconds until the first and the last row.
- **rows**: rows actually returned (PostgreSQL 18 prints two decimals because it averages over `loops`).
- **Rows Removed by Filter: 999999**: the scan read a million rows to keep one. That line is your hint that an index is missing.
- **Buffers: shared hit**: 8 kB pages found in PostgreSQL's cache. `read` means pages fetched from the operating system or disk.

Now add an index and run the same query again:

```terminal
{
  "title": "add the index",
  "prompt": "perf=#",
  "steps": [
    {
      "cmd": "CREATE INDEX users_email_idx ON users (email);",
      "output": "CREATE INDEX"
    },
    {
      "cmd": "EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'user500000@example.com';",
      "output": "                                                        QUERY PLAN\n---------------------------------------------------------------------------------------------------------------------------\n Index Scan using users_email_idx on users  (cost=0.42..8.44 rows=1 width=45) (actual time=0.310..0.320 rows=1.00 loops=1)\n   Index Cond: (email = 'user500000@example.com'::text)\n   Index Searches: 1\n   Buffers: shared hit=1 read=3 written=3\n Planning:\n   Buffers: shared hit=16 read=1 written=1\n Planning Time: 2.829 ms\n Execution Time: 0.480 ms\n(8 rows)"
    }
  ]
}
```

The plan switches to an **Index Scan**, reads 4 pages instead of more than 9,000, and the execution time drops from hundreds of milliseconds to under a millisecond. `Index Searches: 1` is new in PostgreSQL 18: it counts how many times the scan descended the index.

:::warning
`EXPLAIN ANALYZE` really executes the statement. For `INSERT`, `UPDATE` or `DELETE`, wrap it in a transaction and roll back: `BEGIN; EXPLAIN ANALYZE DELETE ...; ROLLBACK;`
:::

Other plan nodes you will meet:

| Node                        | Meaning                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------- |
| `Index Only Scan`           | All needed columns are in the index, so the table is not read                      |
| `Bitmap Heap Scan`          | Collect matching row locations from an index first, then read pages in order       |
| `Nested Loop`               | For each outer row, look up matching inner rows (good for few rows)                |
| `Hash Join`                 | Build a hash table from one side, probe it with the other                          |
| `Merge Join`                | Walk two sorted inputs together                                                    |
| `Sort`, `Hash`, `Aggregate` | Sorting, hashing and grouping steps; watch for "external" sorts that spill to disk |

When estimated and actual row counts differ by a lot, the planner is working with bad statistics. Run `ANALYZE table_name;` and check again.

## When to Create Indexes

Create indexes for:

**Foreign keys**, which PostgreSQL does not index automatically:

```sql
CREATE INDEX posts_user_id_idx ON posts (user_id);
```

**Columns you filter on often**:

```sql
-- For: SELECT * FROM orders WHERE status = 'pending';
CREATE INDEX orders_status_idx ON orders (status);
```

**Join columns**:

```sql
-- For: SELECT ... FROM orders AS o JOIN customers AS c ON o.customer_id = c.id;
CREATE INDEX orders_customer_id_idx ON orders (customer_id);
```

**Columns you sort and limit on**:

```sql
-- For: SELECT * FROM posts ORDER BY created_at DESC LIMIT 20;
CREATE INDEX posts_created_at_idx ON posts (created_at);
```

A B-tree can be read in both directions, so one index serves `ASC` and `DESC`.

Indexes rarely help when a query returns a large share of the table. For `WHERE status = 'active'` on a table that is 90% active, a sequential scan is cheaper, and the planner knows that.

:::warning
A plain `CREATE INDEX` blocks inserts, updates and deletes on the table until it finishes, which can take minutes on a large table. In production, use `CREATE INDEX CONCURRENTLY`. It takes longer and cannot run inside a transaction block, but writes continue. If it fails, it leaves an `INVALID` index behind: drop it and try again.
:::

## Composite Indexes

A composite index covers several columns, sorted by the first column, then by the second within each value of the first:

```terminal
{
  "title": "a two-column index",
  "prompt": "perf=#",
  "steps": [
    {
      "cmd": "CREATE INDEX users_status_created_idx ON users (status, created_at);",
      "output": "CREATE INDEX"
    },
    {
      "cmd": "EXPLAIN ANALYZE\nSELECT id FROM users\nWHERE status = 'pending'\n  AND created_at >= '2025-06-01' AND created_at < '2025-06-02';",
      "output": "                                                                                       QUERY PLAN\n-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------\n Index Scan using users_status_created_idx on users  (cost=0.42..589.14 rows=232 width=8) (actual time=0.383..2.459 rows=230.00 loops=1)\n   Index Cond: ((status = 'pending'::text) AND (created_at >= '2025-06-01 00:00:00+00'::timestamp with time zone) AND (created_at < '2025-06-02 00:00:00+00'::timestamp with time zone))\n   Index Searches: 1\n   Buffers: shared read=32 written=32\n Planning:\n   Buffers: shared hit=19 read=1 written=1\n Planning Time: 1.174 ms\n Execution Time: 2.891 ms\n(8 rows)"
    }
  ]
}
```

Put columns you compare with `=` first and the range or sort column last. That way the matching rows sit next to each other in the index, and one search finds them all.

What if a query filters only on the second column? Before PostgreSQL 18, a B-tree could not jump into the middle of the sort order, so this query needed another index or a full scan. PostgreSQL 18 adds **skip scan**: when the first column has few distinct values, the scan jumps from one value of `status` to the next and searches the `created_at` range within each. `Index Searches: 7` shows those repeated descents into the index (a normal index scan shows 1):

```sql
EXPLAIN ANALYZE
SELECT id FROM users
WHERE created_at >= '2025-06-01' AND created_at < '2025-06-02';
```

```text
                                                                           QUERY PLAN
----------------------------------------------------------------------------------------------------------------------------------------------------------------
 Bitmap Heap Scan on users  (cost=79.18..6233.30 rows=2877 width=8) (actual time=4.453..9.835 rows=2880.00 loops=1)
   Recheck Cond: ((created_at >= '2025-06-01 00:00:00+00'::timestamp with time zone) AND (created_at < '2025-06-02 00:00:00+00'::timestamp with time zone))
   Heap Blocks: exact=28
   Buffers: shared hit=42 read=22 written=22
   ->  Bitmap Index Scan on users_status_created_idx  (cost=0.00..78.46 rows=2877 width=0) (actual time=4.343..4.346 rows=2880.00 loops=1)
         Index Cond: ((created_at >= '2025-06-01 00:00:00+00'::timestamp with time zone) AND (created_at < '2025-06-02 00:00:00+00'::timestamp with time zone))
         Index Searches: 7
         Buffers: shared hit=14 read=22 written=22
 Planning Time: 0.468 ms
 Execution Time: 13.905 ms
(10 rows)
```

Skip scan is a fallback, not a design goal. If an important query filters on `created_at` alone, give it its own index.

## Partial Indexes

A partial index covers only the rows that match a `WHERE` clause. If you often query a small subset, such as banned users, the index stays small:

```sql
CREATE INDEX users_banned_created_idx ON users (created_at)
WHERE status = 'banned';
```

```sql
SELECT indexrelname AS index,
       pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE relname = 'users'
ORDER BY pg_relation_size(indexrelid) DESC;
```

```text
          index           |  size
--------------------------+--------
 users_email_idx          | 39 MB
 users_status_created_idx | 30 MB
 users_pkey               | 21 MB
 users_banned_created_idx | 456 kB
(4 rows)
```

The planner uses it when the query's `WHERE` clause implies the index condition:

```sql
EXPLAIN SELECT email FROM users
WHERE status = 'banned' AND created_at > '2025-12-01';
```

```text
                                        QUERY PLAN
------------------------------------------------------------------------------------------
 Index Scan using users_banned_created_idx on users  (cost=0.29..35.24 rows=740 width=22)
   Index Cond: (created_at > '2025-12-01 00:00:00+00'::timestamp with time zone)
(2 rows)
```

Partial indexes are also the way to enforce "unique among active rows" (see soft deletes in [Part 4](/guides/introduction-to-postgres/04-database-design-and-schemas#h3-soft-deletes)).

## Unique Indexes

A unique index enforces uniqueness and speeds up lookups at the same time:

```sql
-- Not part of the walkthrough
CREATE UNIQUE INDEX users_email_key ON users (email);
```

A `UNIQUE` constraint creates exactly such an index. Prefer the constraint for plain uniqueness, because it documents intent and foreign keys can reference it. Use a unique index when you need an expression or a `WHERE` clause, for example `CREATE UNIQUE INDEX ON users (lower(email));`.

## Index Maintenance

### View Indexes

```sql
-- In psql: the table description lists its indexes
\d users

-- Or with SQL
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'users';
```

### Drop Indexes

```sql
-- Not part of the walkthrough
DROP INDEX CONCURRENTLY users_email_hash_idx;
```

### Reindex

Indexes can bloat over time when rows are updated and deleted often. Rebuild one without blocking writes:

```sql
-- Not part of the walkthrough
REINDEX INDEX CONCURRENTLY users_email_idx;
REINDEX TABLE CONCURRENTLY users;
```

Plain `REINDEX` (without `CONCURRENTLY`) locks out writes while it runs. Most indexes never need a rebuild; check bloat before you schedule one.

## Query Optimization Techniques

### Use Indexes Wisely

A function on the column hides it from a normal index:

```sql
EXPLAIN SELECT * FROM users WHERE lower(email) = 'user500000@example.com';
```

```text
                         QUERY PLAN
-------------------------------------------------------------
 Seq Scan on users  (cost=0.00..24346.00 rows=5000 width=45)
   Filter: (lower(email) = 'user500000@example.com'::text)
(2 rows)
```

Index the expression itself:

```terminal
{
  "title": "an expression index",
  "prompt": "perf=#",
  "steps": [
    {
      "cmd": "CREATE INDEX users_email_lower_idx ON users (lower(email));",
      "output": "CREATE INDEX"
    },
    {
      "cmd": "EXPLAIN SELECT * FROM users WHERE lower(email) = 'user500000@example.com';",
      "output": "                                       QUERY PLAN\n-----------------------------------------------------------------------------------------\n Bitmap Heap Scan on users  (cost=139.18..8305.02 rows=5000 width=45)\n   Recheck Cond: (lower(email) = 'user500000@example.com'::text)\n   ->  Bitmap Index Scan on users_email_lower_idx  (cost=0.00..137.93 rows=5000 width=0)\n         Index Cond: (lower(email) = 'user500000@example.com'::text)\n(4 rows)"
    },
    {
      "cmd": "ANALYZE users;",
      "output": "ANALYZE"
    },
    {
      "cmd": "EXPLAIN SELECT * FROM users WHERE lower(email) = 'user500000@example.com';",
      "output": "                                     QUERY PLAN\n------------------------------------------------------------------------------------\n Index Scan using users_email_lower_idx on users  (cost=0.42..8.44 rows=1 width=45)\n   Index Cond: (lower(email) = 'user500000@example.com'::text)\n(2 rows)"
    }
  ]
}
```

Right after `CREATE INDEX`, the planner has no statistics for the expression and guesses 5,000 rows. After `ANALYZE` it knows the values are unique, estimates 1 row and picks a plain index scan. Run `ANALYZE` after creating expression indexes.

Simpler still: store emails in lowercase when you write them, and index the plain column.

### Avoid SELECT *

```sql
-- Reads and sends every column, including large text fields
SELECT * FROM posts WHERE user_id = 42;

-- Reads only what the page shows
SELECT id, title, created_at FROM posts WHERE user_id = 42;
```

Fewer columns mean less data over the network, and they make index-only scans possible.

### Use LIMIT

If you show 20 rows, ask for 20. With an index on the `ORDER BY` column, PostgreSQL stops after reading 20 index entries:

```sql
SELECT id, title FROM posts ORDER BY created_at DESC LIMIT 20;
```

### Covering Indexes

`INCLUDE` adds columns to the index leaf entries without making them part of the key. If every column a query needs is in the index, PostgreSQL can answer from the index alone:

```terminal
{
  "title": "an index-only scan",
  "prompt": "perf=#",
  "steps": [
    {
      "cmd": "CREATE INDEX users_email_status_idx ON users (email) INCLUDE (status);",
      "output": "CREATE INDEX"
    },
    {
      "cmd": "VACUUM users;",
      "output": "VACUUM"
    },
    {
      "cmd": "EXPLAIN ANALYZE SELECT status FROM users WHERE email = 'user42@example.com';",
      "output": "                                                              QUERY PLAN\n--------------------------------------------------------------------------------------------------------------------------------------\n Index Only Scan using users_email_status_idx on users  (cost=0.42..4.44 rows=1 width=7) (actual time=1.180..1.202 rows=1.00 loops=1)\n   Index Cond: (email = 'user42@example.com'::text)\n   Heap Fetches: 0\n   Index Searches: 1\n   Buffers: shared hit=1 read=3 written=3\n Planning:\n   Buffers: shared hit=3\n Planning Time: 0.640 ms\n Execution Time: 1.609 ms\n(9 rows)"
    }
  ]
}
```

`Heap Fetches: 0` means the table was not touched. Index-only scans depend on the visibility map, which `VACUUM` (and autovacuum) keep up to date. On a table with many recent changes, you will see more heap fetches.

## Common Performance Issues

### N+1 Queries

The most common performance bug lives in application code, not in SQL:

```python
# 1 query for the users, then 1 more query per user: N+1 round trips
users = db.execute("SELECT id, username FROM users LIMIT 100").fetchall()
for user in users:
    posts = db.execute(
        "SELECT title FROM posts WHERE user_id = %s", (user.id,)
    ).fetchall()
```

Each round trip adds network latency. Fetch everything in one query instead:

```python
rows = db.execute("""
    SELECT u.id, u.username, p.title
    FROM users AS u
    LEFT JOIN posts AS p ON p.user_id = u.id
    WHERE u.id IN (SELECT id FROM users ORDER BY id LIMIT 100)
""").fetchall()
```

ORMs have a setting for this, usually called eager loading (`select_related`, `includes`, `joinedload`).

### Inefficient WHERE Clauses

```sql
-- Bad: the function hides created_at from the index
SELECT * FROM posts WHERE extract(year FROM created_at) = 2025;

-- Good: a range on the bare column can use the index
SELECT * FROM posts
WHERE created_at >= '2025-01-01' AND created_at < '2026-01-01';
```

The same applies to casts and arithmetic on the column: `WHERE created_at::date = '2025-06-01'` cannot use a plain index on `created_at`.

### Missing Indexes on Foreign Keys

Joins on an unindexed foreign key scan the child table, and so does every delete of a parent row. Find foreign keys without a matching index with the queries on the PostgreSQL wiki, or check each `REFERENCES` column when you review a migration.

## Monitoring Query Performance

### pg_stat_statements

`pg_stat_statements` records every query's call count and timing. It ships with PostgreSQL but must be loaded at server start. Add it to `postgresql.conf` and restart:

```ini
shared_preload_libraries = 'pg_stat_statements'
```

Then enable it in your database and look for the queries that cost the most time in total:

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

SELECT left(query, 60) AS query,
       calls,
       round(total_exec_time::numeric, 1) AS total_ms,
       round(mean_exec_time::numeric, 2) AS mean_ms,
       rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;
```

Sort by `total_exec_time` first: a 5 ms query that runs a million times a day costs more than a 2-second report that runs once.

### Auto Explain

`auto_explain` logs the plan of every query slower than a threshold, so you can see plans from production without guessing:

```ini
# postgresql.conf (needs a restart)
shared_preload_libraries = 'pg_stat_statements,auto_explain'
auto_explain.log_min_duration = '1s'
auto_explain.log_analyze = on
```

For a single session, `LOAD 'auto_explain';` followed by `SET auto_explain.log_min_duration = '1s';` works too (as a superuser). `log_analyze` instruments every query, not only the slow ones it logs, so a high threshold does not remove the overhead. On busy servers, set `auto_explain.log_timing = off` or log only a sample with `auto_explain.sample_rate`.

## Practical Indexing Strategy

1. **Start with the indexes you know you need**: primary keys, unique constraints and foreign keys.
2. **Find the slow queries** with `pg_stat_statements` and your application's metrics.
3. **Read their plans** with `EXPLAIN ANALYZE` on production-like data. Look for sequential scans that remove most rows, and for estimates that are far off.
4. **Add one index at a time** (`CONCURRENTLY` in production), and confirm the plan changed.
5. **Remove indexes nobody uses**. Every index costs disk space, memory and time on every write:

```sql
SELECT relname AS table_name,
       indexrelname AS index_name,
       idx_scan,
       pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
ORDER BY idx_scan, pg_relation_size(indexrelid) DESC;
```

Indexes with `idx_scan = 0` since the last statistics reset are candidates for removal. Check replicas too (the counters are per server), and keep indexes that back a constraint.

## Common Mistakes

- **Running a plain `CREATE INDEX` on a busy production table.** Use `CONCURRENTLY`.
- **Indexing every column "just in case".** Writes slow down, and the planner gains nothing.
- **Wrapping the indexed column in a function** (`lower(email)`, `created_at::date`). Use an expression index or rewrite the condition.
- **Wrong column order in a composite index.** Equality columns first, range or sort column last.
- **Testing on a tiny table.** With a few hundred rows, a sequential scan is the best plan, so `EXPLAIN` tells you nothing about production.
- **Trusting stale statistics.** After a bulk load, run `ANALYZE`.

## Summary

You can now read `EXPLAIN` and `EXPLAIN ANALYZE` output, choose between B-tree, GIN, GiST and BRIN, and use composite, partial, expression and covering indexes. You also know how to find slow queries with `pg_stat_statements` and unused indexes with `pg_stat_user_indexes`.

Fast queries are half of a healthy database. The other half is correctness when many sessions read and write at once. Next, in [Transactions and Concurrency Control](/guides/introduction-to-postgres/08-transactions-and-concurrency), you will see how PostgreSQL keeps data consistent under concurrent access.
