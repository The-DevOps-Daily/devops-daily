---
title: Advanced Queries and Joins
description: 'Combine PostgreSQL tables with INNER, LEFT, RIGHT and FULL joins, and answer reporting questions with subqueries, CTEs, window functions and LATERAL.'
order: 6
---

**TLDR**: `INNER JOIN` returns rows that match in both tables. `LEFT JOIN` keeps every row from the left table and fills the gaps with `NULL`. Subqueries and `EXISTS` filter by related data, CTEs (`WITH`) name intermediate results, and window functions (`OVER`) compute rankings and running values without collapsing rows. Watch for two traps: `NOT IN` with a `NULL`, and joins that multiply rows before you aggregate.

Normalized data lives in several tables, so most real questions need more than one of them: "posts with their author", "users who never posted", "each author's best post". This part shows the tools for those questions, with real output from PostgreSQL 18.6 for a small blog dataset.

## Prerequisites

- Primary and foreign keys from [Part 4](/guides/introduction-to-postgres/04-database-design-and-schemas).
- `SELECT`, `WHERE`, `GROUP BY` and aggregates from [Part 3](/guides/introduction-to-postgres/03-sql-basics-and-crud).

## Understanding Joins

Create three related tables. Note the last post: it was imported without an author, so its `user_id` is `NULL`. Carol has no posts at all.

```sql
CREATE TABLE users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE posts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint REFERENCES users (id),
  title text NOT NULL,
  views integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE comments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id bigint NOT NULL REFERENCES posts (id),
  user_id bigint NOT NULL REFERENCES users (id),
  body text NOT NULL
);

INSERT INTO users (username, created_at) VALUES
  ('alice', '2026-01-05 10:00+00'),
  ('bob',   '2026-02-11 09:30+00'),
  ('carol', '2026-03-20 16:45+00');

INSERT INTO posts (user_id, title, views, created_at) VALUES
  (1,    'Alice first post',  120, '2026-01-10 08:00+00'),
  (1,    'Alice second post',  80, '2026-02-02 08:00+00'),
  (2,    'Bob post',          200, '2026-02-15 12:00+00'),
  (NULL, 'Imported post',      15, '2026-03-01 07:00+00');

INSERT INTO comments (post_id, user_id, body) VALUES
  (1, 2, 'Great post!'),
  (1, 3, 'Thanks for sharing');
```

A join pairs rows from two tables using a condition, usually "this foreign key equals that primary key". The join type decides what happens to rows that have no partner.

## INNER JOIN

`INNER JOIN` (or just `JOIN`) returns only the pairs that match:

```sql
SELECT u.username, p.title
FROM users AS u
INNER JOIN posts AS p ON p.user_id = u.id;
```

```text
 username |       title
----------+-------------------
 alice    | Alice first post
 alice    | Alice second post
 bob      | Bob post
(3 rows)
```

Carol is missing because she has no posts, and the imported post is missing because it has no user. `u` and `p` are **table aliases**; they keep join queries readable.

## LEFT JOIN

`LEFT JOIN` returns every row from the left table. Where no right-side row matches, the right-side columns are `NULL`:

```sql
SELECT u.username, p.title
FROM users AS u
LEFT JOIN posts AS p ON p.user_id = u.id;
```

```text
 username |       title
----------+-------------------
 alice    | Alice first post
 alice    | Alice second post
 bob      | Bob post
 carol    |
(4 rows)
```

Carol now appears with an empty title. `psql` prints `NULL` as an empty cell; run `\pset null '(null)'` to see it:

```terminal
{
  "title": "make NULL visible",
  "prompt": "blog=#",
  "steps": [
    {
      "cmd": "\\pset null '(null)'",
      "output": "Null display is \"(null)\"."
    },
    {
      "cmd": "SELECT u.username, p.title\nFROM users AS u\nLEFT JOIN posts AS p ON p.user_id = u.id;",
      "output": " username |       title\n----------+-------------------\n alice    | Alice first post\n alice    | Alice second post\n bob      | Bob post\n carol    | (null)\n(4 rows)"
    }
  ]
}
```

Filter on a right-side column being `NULL` to find rows with no match, such as users who never posted:

```sql
SELECT u.username
FROM users AS u
LEFT JOIN posts AS p ON p.user_id = u.id
WHERE p.id IS NULL;
```

```text
 username
----------
 carol
(1 row)
```

## RIGHT JOIN

`RIGHT JOIN` is the mirror image: every row from the right table is kept. Most people rewrite it as a `LEFT JOIN` with the tables swapped, so queries read the same way.

## FULL OUTER JOIN

`FULL JOIN` keeps unmatched rows from both sides. Here is every join type on the same data, side by side:

```tabs
{
  "title": "One query, four join types",
  "tabs": [
    {
      "label": "INNER",
      "lang": "sql",
      "code": "SELECT u.username, p.title\nFROM users AS u\nINNER JOIN posts AS p ON p.user_id = u.id;\n\n username |       title\n----------+-------------------\n alice    | Alice first post\n alice    | Alice second post\n bob      | Bob post\n(3 rows)"
    },
    {
      "label": "LEFT",
      "lang": "sql",
      "code": "SELECT u.username, p.title\nFROM users AS u\nLEFT JOIN posts AS p ON p.user_id = u.id;\n\n username |       title\n----------+-------------------\n alice    | Alice first post\n alice    | Alice second post\n bob      | Bob post\n carol    | (null)\n(4 rows)"
    },
    {
      "label": "RIGHT",
      "lang": "sql",
      "code": "SELECT u.username, p.title\nFROM users AS u\nRIGHT JOIN posts AS p ON p.user_id = u.id;\n\n username |       title\n----------+-------------------\n alice    | Alice first post\n alice    | Alice second post\n bob      | Bob post\n (null)   | Imported post\n(4 rows)"
    },
    {
      "label": "FULL",
      "lang": "sql",
      "code": "SELECT u.username, p.title\nFROM users AS u\nFULL JOIN posts AS p ON p.user_id = u.id;\n\n username |       title\n----------+-------------------\n alice    | Alice first post\n alice    | Alice second post\n bob      | Bob post\n (null)   | Imported post\n carol    | (null)\n(5 rows)"
    }
  ]
}
```

`FULL JOIN` is rare in application code, but it is the right tool for reconciliation: comparing two lists and finding entries that exist on only one side.

## Multiple Joins

Chain joins to follow several relationships. The same table can appear twice with different aliases, here once as the post's author and once as the commenter:

```sql
SELECT p.title AS post,
       author.username AS author,
       c.body AS comment,
       commenter.username AS commenter
FROM posts AS p
JOIN users AS author ON author.id = p.user_id
JOIN comments AS c ON c.post_id = p.id
JOIN users AS commenter ON commenter.id = c.user_id
ORDER BY c.id;
```

```text
       post       | author |      comment       | commenter
------------------+--------+--------------------+-----------
 Alice first post | alice  | Great post!        | bob
 Alice first post | alice  | Thanks for sharing | carol
(2 rows)
```

## Self Joins

A table can join itself when rows refer to other rows of the same table, such as employees and their managers:

```sql
CREATE TABLE employees (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  manager_id bigint REFERENCES employees (id)
);

INSERT INTO employees (name, manager_id) VALUES
  ('CEO', NULL),
  ('VP Sales', 1),
  ('VP Engineering', 1),
  ('Sales Rep', 2),
  ('Developer', 3);
```

```sql
SELECT e.name AS employee, m.name AS manager
FROM employees AS e
LEFT JOIN employees AS m ON m.id = e.manager_id
ORDER BY e.id;
```

```text
    employee    |    manager
----------------+----------------
 CEO            | (null)
 VP Sales       | CEO
 VP Engineering | CEO
 Sales Rep      | VP Sales
 Developer      | VP Engineering
(5 rows)
```

A self join goes one level up. To walk the whole tree, use a recursive CTE (below).

## Subqueries

A subquery is a query inside another query.

### Subquery in WHERE

`EXISTS` asks "is there at least one matching row?". It stops at the first match, and it handles `NULL` correctly:

```sql
SELECT username
FROM users AS u
WHERE EXISTS (SELECT 1 FROM posts AS p WHERE p.user_id = u.id);
```

```text
 username
----------
 alice
 bob
(2 rows)
```

Be careful with `NOT IN`. If the subquery returns a single `NULL`, `NOT IN` matches nothing, because `x NOT IN (1, NULL)` is never true. The imported post has a `NULL` `user_id`, so this query returns no rows:

```sql
SELECT username FROM users WHERE id NOT IN (SELECT user_id FROM posts);
```

```text
 username
----------
(0 rows)
```

`NOT EXISTS` gives the answer you meant:

```sql
SELECT username
FROM users AS u
WHERE NOT EXISTS (SELECT 1 FROM posts AS p WHERE p.user_id = u.id);
```

```text
 username
----------
 carol
(1 row)
```

### Subquery in SELECT

A scalar subquery returns one value per row:

```sql
SELECT u.username,
       (SELECT count(*) FROM posts AS p WHERE p.user_id = u.id) AS post_count
FROM users AS u
ORDER BY u.id;
```

```text
 username | post_count
----------+------------
 alice    |          2
 bob      |          1
 carol    |          0
(3 rows)
```

It runs once per outer row, so on large tables a join with `GROUP BY` is usually faster.

### Subquery in FROM

A subquery in `FROM` acts like a temporary table. Since PostgreSQL 16 the alias is optional, but naming it keeps the outer query readable:

```sql
SELECT stats.username, stats.post_count
FROM (
  SELECT u.username, count(p.id) AS post_count
  FROM users AS u
  LEFT JOIN posts AS p ON p.user_id = u.id
  GROUP BY u.username
) AS stats
WHERE stats.post_count > 0;
```

## Common Table Expressions (CTEs)

A CTE gives a subquery a name with `WITH`, so you can read a long query from top to bottom. Here it computes per-user totals once and then joins them back to every user:

```sql
WITH post_counts AS (
  SELECT user_id, count(*) AS posts, sum(views) AS total_views
  FROM posts
  WHERE user_id IS NOT NULL
  GROUP BY user_id
)
SELECT u.username,
       coalesce(pc.posts, 0) AS posts,
       coalesce(pc.total_views, 0) AS total_views
FROM users AS u
LEFT JOIN post_counts AS pc ON pc.user_id = u.id
ORDER BY total_views DESC, u.username;
```

```text
 username | posts | total_views
----------+-------+-------------
 alice    |     2 |         200
 bob      |     1 |         200
 carol    |     0 |           0
(3 rows)
```

Since PostgreSQL 12, the planner inlines a CTE that is referenced once, is not recursive and has no side effects, so such a CTE usually costs no more than the equivalent subquery. Add `AS MATERIALIZED` to force it to be computed once, or `AS NOT MATERIALIZED` to allow inlining of a CTE referenced several times.

### Recursive CTEs

`WITH RECURSIVE` repeats a query until it finds no new rows. It is the standard way to walk trees such as org charts, category hierarchies or threaded comments:

```sql
WITH RECURSIVE chain AS (
  SELECT id, name, 1 AS depth, name AS path
  FROM employees
  WHERE manager_id IS NULL
  UNION ALL
  SELECT e.id, e.name, c.depth + 1, c.path || ' > ' || e.name
  FROM employees AS e
  JOIN chain AS c ON e.manager_id = c.id
)
SELECT depth, path FROM chain ORDER BY path;
```

```text
 depth |               path
-------+----------------------------------
     1 | CEO
     2 | CEO > VP Engineering
     3 | CEO > VP Engineering > Developer
     2 | CEO > VP Sales
     3 | CEO > VP Sales > Sales Rep
(5 rows)
```

The first `SELECT` is the starting point (the CEO). The second joins the rows found so far to their direct reports, and repeats until no reports are left.

## Window Functions

A window function computes a value across a set of related rows (the "window") but, unlike `GROUP BY`, keeps every row in the result. The `OVER (...)` clause defines the window.

### ROW_NUMBER

```sql
SELECT username,
       created_at::date AS joined,
       row_number() OVER (ORDER BY created_at) AS signup_order
FROM users;
```

```text
 username |   joined   | signup_order
----------+------------+--------------
 alice    | 2026-01-05 |            1
 bob      | 2026-02-11 |            2
 carol    | 2026-03-20 |            3
(3 rows)
```

### RANK and DENSE_RANK

The three ranking functions differ only in how they handle ties:

```sql
SELECT name, score,
       row_number() OVER (ORDER BY score DESC) AS row_number,
       rank()       OVER (ORDER BY score DESC) AS rank,
       dense_rank() OVER (ORDER BY score DESC) AS dense_rank
FROM (VALUES ('ana', 90), ('ben', 85), ('cho', 85), ('dev', 70)) AS t(name, score);
```

```text
 name | score | row_number | rank | dense_rank
------+-------+------------+------+------------
 ana  |    90 |          1 |    1 |          1
 ben  |    85 |          2 |    2 |          2
 cho  |    85 |          3 |    2 |          2
 dev  |    70 |          4 |    4 |          3
(4 rows)
```

`row_number` never repeats, `rank` leaves a gap after a tie (1, 2, 2, 4), and `dense_rank` does not (1, 2, 2, 3).

An empty `OVER ()` makes the whole result the window, which is handy for percentages of a total:

```sql
SELECT title, views,
       round(100.0 * views / sum(views) OVER (), 1) AS pct_of_all_views
FROM posts
ORDER BY views DESC;
```

```text
       title       | views | pct_of_all_views
-------------------+-------+------------------
 Bob post          |   200 |             48.2
 Alice first post  |   120 |             28.9
 Alice second post |    80 |             19.3
 Imported post     |    15 |              3.6
(4 rows)
```

### PARTITION BY

`PARTITION BY` splits the window into groups, like `GROUP BY` without merging the rows:

```sql
SELECT u.username, p.title, p.views,
       round(avg(p.views) OVER (PARTITION BY u.id), 1) AS user_avg_views
FROM posts AS p
JOIN users AS u ON u.id = p.user_id
ORDER BY u.username, p.views DESC;
```

```text
 username |       title       | views | user_avg_views
----------+-------------------+-------+----------------
 alice    | Alice first post  |   120 |          100.0
 alice    | Alice second post |    80 |          100.0
 bob      | Bob post          |   200 |          200.0
(3 rows)
```

Each post keeps its own row and also shows its author's average.

### LAG and LEAD

`lag` reads a value from the previous row in the window, and `lead` from the next one. They answer "how long since the last event?":

```sql
SELECT title,
       created_at::date AS published,
       created_at::date - lag(created_at::date) OVER (ORDER BY created_at) AS days_since_previous
FROM posts
ORDER BY created_at;
```

```text
       title       | published  | days_since_previous
-------------------+------------+---------------------
 Alice first post  | 2026-01-10 |              (null)
 Alice second post | 2026-02-02 |                  23
 Bob post          | 2026-02-15 |                  13
 Imported post     | 2026-03-01 |                  14
(4 rows)
```

The first row has no previous row, so the result is `NULL` (shown as `(null)` because of the `\pset` above).

## LATERAL Joins

"Top N per group" questions, such as each user's most viewed post, are awkward with plain joins. A `LATERAL` subquery runs once per row of the table before it and can refer to that row:

```sql
SELECT u.username, top.title, top.views
FROM users AS u
CROSS JOIN LATERAL (
  SELECT p.title, p.views
  FROM posts AS p
  WHERE p.user_id = u.id
  ORDER BY p.views DESC
  LIMIT 1
) AS top
ORDER BY u.username;
```

```text
 username |      title       | views
----------+------------------+-------
 alice    | Alice first post |   120
 bob      | Bob post         |   200
(2 rows)
```

Carol is missing because her subquery returns nothing. Use `LEFT JOIN LATERAL (...) AS top ON true` to keep her with `NULL` values. With an index on `posts (user_id, views)`, each lookup reads only the rows it returns.

## UNION and UNION ALL

`UNION` stacks the results of two queries with the same number and types of columns:

```sql
SELECT username AS name, 'user' AS kind FROM users
UNION ALL
SELECT title, 'post' FROM posts WHERE views > 100;
```

```text
       name       | kind
------------------+------
 alice            | user
 bob              | user
 carol            | user
 Alice first post | post
 Bob post         | post
(5 rows)
```

`UNION` removes duplicate rows, which needs a sort or hash step. `UNION ALL` keeps every row and is faster, so use it unless you need the de-duplication.

## Practical Examples

### Top authors by views

```sql
SELECT u.username,
       count(p.id) AS post_count,
       sum(p.views) AS total_views
FROM users AS u
JOIN posts AS p ON p.user_id = u.id
GROUP BY u.id, u.username
ORDER BY total_views DESC
LIMIT 10;
```

### Posts with the most comments

```sql
SELECT p.title,
       u.username AS author,
       count(c.id) AS comment_count
FROM posts AS p
LEFT JOIN users AS u ON u.id = p.user_id
LEFT JOIN comments AS c ON c.post_id = p.id
GROUP BY p.id, p.title, u.username
ORDER BY comment_count DESC
LIMIT 5;
```

### User activity summary

Joining two independent child tables (posts and comments) multiplies their rows, so aggregate each one separately first:

```sql
WITH post_stats AS (
  SELECT user_id, count(*) AS posts FROM posts GROUP BY user_id
),
comment_stats AS (
  SELECT user_id, count(*) AS comments FROM comments GROUP BY user_id
)
SELECT u.username,
       coalesce(ps.posts, 0) AS posts,
       coalesce(cs.comments, 0) AS comments,
       coalesce(ps.posts, 0) + coalesce(cs.comments, 0) AS total_activity
FROM users AS u
LEFT JOIN post_stats AS ps ON ps.user_id = u.id
LEFT JOIN comment_stats AS cs ON cs.user_id = u.id
ORDER BY total_activity DESC;
```

## Common Mistakes

**Aggregating after a join that multiplies rows.** Alice's first post has two comments, so joining comments repeats that post twice. Count and sum over the joined rows, and the totals are wrong:

```sql
SELECT u.username, count(p.id) AS posts, sum(p.views) AS total_views
FROM users AS u
JOIN posts AS p ON p.user_id = u.id
JOIN comments AS c ON c.post_id = p.id
GROUP BY u.username;
```

```text
 username | posts | total_views
----------+-------+-------------
 alice    |     2 |         240
(1 row)
```

Alice has one post with comments and 120 views on it, not 2 posts and 240 views. Aggregate in a CTE first (as in the activity summary above), or use `count(DISTINCT ...)` for counts.

**Using `NOT IN` with a subquery that can return `NULL`.** You get zero rows. Use `NOT EXISTS`.

**Filtering the right table of a LEFT JOIN in WHERE.** `LEFT JOIN posts AS p ... WHERE p.views > 100` drops the users without posts again, because `NULL > 100` is not true. Put that condition in the `ON` clause if you want to keep them.

**Forgetting the join condition.** `FROM users, posts` without a condition is a cross join: every user paired with every post.

**Unindexed join columns.** Joins on foreign keys need an index on the foreign key column ([Part 7](/guides/introduction-to-postgres/07-indexes-and-performance)).

## Summary

You can now combine tables with inner, outer and self joins, filter with `EXISTS` and `NOT EXISTS`, structure long queries with CTEs, walk hierarchies with recursive CTEs, rank and compare rows with window functions, and pick the top rows per group with `LATERAL`.

These queries are fast on a few rows. On millions of rows, they depend on indexes. Next, in [Indexes and Query Performance](/guides/introduction-to-postgres/07-indexes-and-performance), you will learn to read query plans and add the right indexes.
