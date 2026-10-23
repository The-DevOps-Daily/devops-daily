---
title: SQL Basics and CRUD Operations
description: 'Hands-on PostgreSQL SQL tutorial: SELECT, WHERE, ORDER BY and LIMIT, INSERT with RETURNING and upserts, UPDATE, DELETE and GROUP BY, with real output.'
order: 3
---

**TLDR**: `SELECT` reads rows, `INSERT` adds them, `UPDATE` changes them and `DELETE` removes them. Filter with `WHERE`, sort with `ORDER BY`, page with `LIMIT`. Add `RETURNING` to get back the rows you changed, and `ON CONFLICT` to turn an insert into an upsert. Summarize with `count`, `avg` and `GROUP BY`. Test risky changes inside a transaction first.

SQL is how you talk to PostgreSQL. This part covers the four operations behind almost every application, often called CRUD (create, read, update, delete), plus the filtering, sorting and aggregate functions you combine them with. Every output below comes from running the statements in `psql` against PostgreSQL 18.6, so you can type along and compare.

## Prerequisites

You need a running PostgreSQL server and `psql` (see [How to Install PostgreSQL 18 and psql](/guides/introduction-to-postgres/02-installation-and-setup)). One example uses `RETURNING old` and `new`, which needs PostgreSQL 18.

Create a practice database and a `users` table with some sample rows:

```sql
CREATE DATABASE learn_sql;
\c learn_sql
```

```sql
CREATE TABLE users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username text NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  age integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO users (username, email, age, created_at) VALUES
  ('alice', 'alice@example.com', 28, '2026-09-01 09:15:00+00'),
  ('bob',   'bob@example.com',   32, '2026-09-03 14:02:00+00'),
  ('carol', 'carol@example.com', 24, '2026-09-10 08:30:00+00'),
  ('dave',  'dave@example.com',  19, '2026-09-18 19:45:00+00'),
  ('erin',  'erin@example.com',  NULL, '2026-10-02 11:20:00+00'),
  ('frank', 'frank@example.com', 45, '2026-10-05 16:05:00+00'),
  ('grace', 'grace@gmail.com',   32, '2026-10-12 10:00:00+00'),
  ('heidi', 'heidi@gmail.com',   67, '2026-10-20 07:55:00+00');
```

Erin has no age on purpose. Missing values (`NULL`) behave differently from normal values, and you will see where that matters.

Run the blocks in order to get the same output as shown. Blocks that start with `-- Not part of the walkthrough` show other forms of a statement; skip them, or your later results will differ.

## SELECT: Retrieving Data

`SELECT` reads data. It is the statement you will run most.

### Basic SELECT

```sql
SELECT * FROM users;
```

```text
 id | username |       email       | age |       created_at
----+----------+-------------------+-----+------------------------
  1 | alice    | alice@example.com |  28 | 2026-09-01 09:15:00+00
  2 | bob      | bob@example.com   |  32 | 2026-09-03 14:02:00+00
  3 | carol    | carol@example.com |  24 | 2026-09-10 08:30:00+00
  4 | dave     | dave@example.com  |  19 | 2026-09-18 19:45:00+00
  5 | erin     | erin@example.com  |     | 2026-10-02 11:20:00+00
  6 | frank    | frank@example.com |  45 | 2026-10-05 16:05:00+00
  7 | grace    | grace@gmail.com   |  32 | 2026-10-12 10:00:00+00
  8 | heidi    | heidi@gmail.com   |  67 | 2026-10-20 07:55:00+00
(8 rows)
```

`*` means every column. It is handy in `psql`, but name the columns in application code: you fetch less data, and adding a column later does not change what your code receives.

```sql
-- Only the columns you need
SELECT username, email FROM users;

-- Unique values only
SELECT DISTINCT age FROM users;
```

### Filtering with WHERE

`WHERE` keeps only the rows for which the condition is true:

```sql
SELECT username, age FROM users WHERE age > 30;
```

```text
 username | age
----------+-----
 bob      |  32
 frank    |  45
 grace    |  32
 heidi    |  67
(4 rows)
```

Conditions combine with `AND`, `OR` and `NOT`, and PostgreSQL has the usual operators:

| Operator                 | Meaning                              |
| ------------------------ | ------------------------------------ |
| `=`, `<>` (or `!=`)      | Equal, not equal                     |
| `<`, `>`, `<=`, `>=`     | Comparisons                          |
| `BETWEEN 20 AND 30`      | Inclusive range                      |
| `IN ('a', 'b')`          | Value is in a list                   |
| `LIKE`, `ILIKE`          | Pattern match (`ILIKE` ignores case) |
| `IS NULL`, `IS NOT NULL` | Missing or present value             |

In `LIKE` patterns, `%` matches any number of characters and `_` matches exactly one:

```sql
SELECT username, email FROM users WHERE email LIKE '%@gmail.com';
```

```text
 username |      email
----------+-----------------
 grace    | grace@gmail.com
 heidi    | heidi@gmail.com
(2 rows)
```

```sql
SELECT * FROM users WHERE age BETWEEN 20 AND 30;
SELECT * FROM users WHERE username IN ('alice', 'bob');
SELECT * FROM users WHERE username LIKE '____';      -- exactly four characters
SELECT * FROM users WHERE age < 18 OR age > 65;
```

`NULL` means "unknown", so `age = NULL` is never true, not even for Erin. Use `IS NULL`:

```terminal
{
  "title": "NULL needs IS NULL",
  "prompt": "learn_sql=#",
  "steps": [
    {
      "cmd": "SELECT username FROM users WHERE age = NULL;",
      "output": " username\n----------\n(0 rows)"
    },
    {
      "cmd": "SELECT username FROM users WHERE age IS NULL;",
      "output": " username\n----------\n erin\n(1 row)"
    }
  ]
}
```

### Sorting Results

`ORDER BY` sorts the result. Ascending is the default; add `DESC` for descending. Watch where the `NULL` goes:

```terminal
{
  "title": "NULLs sort first in descending order",
  "prompt": "learn_sql=#",
  "steps": [
    {
      "cmd": "SELECT username, age FROM users ORDER BY age DESC;",
      "output": " username | age\n----------+-----\n erin     |\n heidi    |  67\n frank    |  45\n bob      |  32\n grace    |  32\n alice    |  28\n carol    |  24\n dave     |  19\n(8 rows)"
    },
    {
      "cmd": "SELECT username, age FROM users ORDER BY age DESC NULLS LAST;",
      "output": " username | age\n----------+-----\n heidi    |  67\n frank    |  45\n bob      |  32\n grace    |  32\n alice    |  28\n carol    |  24\n dave     |  19\n erin     |\n(8 rows)"
    }
  ]
}
```

PostgreSQL treats `NULL` as larger than every value, so it comes last in ascending order and first in descending order. Add `NULLS LAST` or `NULLS FIRST` when the default is not what you want.

Sort by several columns to break ties: `ORDER BY age DESC, username`.

### Limiting Results

`LIMIT` caps the number of rows, and `OFFSET` skips rows first. Together with `ORDER BY` they give you pages:

```sql
SELECT id, username FROM users ORDER BY id LIMIT 3 OFFSET 3;
```

```text
 id | username
----+----------
  4 | dave
  5 | erin
  6 | frank
(3 rows)
```

`OFFSET` still reads and throws away every skipped row, so page 10,000 is slow. For large tables, use **keyset pagination**: remember the last `id` you showed and ask for the rows after it. With an index on the sort column, every page costs the same:

```sql
SELECT id, username FROM users WHERE id > 3 ORDER BY id LIMIT 3;
```

```text
 id | username
----+----------
  4 | dave
  5 | erin
  6 | frank
(3 rows)
```

## INSERT: Adding Data

`INSERT` adds rows.

### Basic INSERT

```sql
-- Not part of the walkthrough
-- One row
INSERT INTO users (username, email, age)
VALUES ('judy', 'judy@example.com', 30);

-- Several rows in one statement (faster than one statement per row)
INSERT INTO users (username, email, age)
VALUES
  ('mallory', 'mallory@example.com', 35),
  ('oscar',   'oscar@example.com',   27);
```

List the columns you insert. Columns you leave out get their default (`id` and `created_at` here) or `NULL`.

### Returning Data After INSERT

`RETURNING` gives you values from the inserted rows, such as the generated `id`, without a second query:

```sql
INSERT INTO users (username, email, age)
VALUES ('ivan', 'ivan@example.com', 41)
RETURNING id, username;
```

```text
 id | username
----+----------
  9 | ivan
(1 row)

INSERT 0 1
```

### Handling Conflicts

Inserting a value that breaks a unique constraint fails:

```sql
INSERT INTO users (username, email)
VALUES ('alice', 'alice2@example.com');
```

```text
ERROR:  duplicate key value violates unique constraint "users_username_key"
DETAIL:  Key (username)=(alice) already exists.
```

`ON CONFLICT` tells PostgreSQL what to do instead. `DO NOTHING` skips the row, so `INSERT 0 0` reports zero rows inserted:

```sql
INSERT INTO users (username, email, age)
VALUES ('alice', 'alice2@example.com', 29)
ON CONFLICT (username) DO NOTHING;
```

```text
INSERT 0 0
```

`DO UPDATE` changes the existing row instead. This is an **upsert**: insert if new, update if it exists. `EXCLUDED` is the row you tried to insert:

```sql
INSERT INTO users (username, email, age)
VALUES ('alice', 'alice@example.com', 29)
ON CONFLICT (username)
DO UPDATE SET age = EXCLUDED.age
RETURNING id, username, age;
```

```text
 id | username | age
----+----------+-----
  1 | alice    |  29
(1 row)

INSERT 0 1
```

The conflict target (`(username)`) must match a unique constraint or unique index. An upsert is atomic: two sessions running the same upsert at the same time cannot both insert.

## UPDATE: Modifying Data

`UPDATE` changes existing rows.

### Basic UPDATE

```sql
-- Not part of the walkthrough
-- One column
UPDATE users SET age = 29 WHERE username = 'alice';

-- Several columns
UPDATE users SET email = 'bob@example.org', age = 33 WHERE username = 'bob';

-- Every row in the table (no WHERE)
UPDATE users SET age = age + 1;
```

Without `WHERE`, `UPDATE` changes every row. `psql` reports the count (`UPDATE 8`), so read it before you commit anything important.

### UPDATE with Conditions

```sql
-- Not part of the walkthrough
-- Normalize email addresses that are not lowercase yet
UPDATE users SET email = lower(email) WHERE email <> lower(email);

-- Different values for different rows
UPDATE users
SET age = CASE
  WHEN age < 18 THEN 18
  WHEN age > 120 THEN NULL
  ELSE age
END
WHERE age IS NOT NULL;
```

### Returning Updated Rows

`UPDATE` supports `RETURNING` too. Since PostgreSQL 18, you can return the value before and after the change with `old` and `new`, which is handy for audit logs:

```sql
UPDATE users SET age = age + 1
WHERE username = 'bob'
RETURNING username, old.age AS old_age, new.age AS new_age;
```

```text
 username | old_age | new_age
----------+---------+---------
 bob      |      32 |      33
(1 row)

UPDATE 1
```

## DELETE: Removing Data

`DELETE` removes rows.

### Basic DELETE

```sql
-- Not part of the walkthrough
-- One row
DELETE FROM users WHERE username = 'judy';

-- Every row matching a condition
DELETE FROM users WHERE created_at < now() - interval '2 years';

-- Every row in the table (do not run this one on the practice data)
DELETE FROM users;
```

To empty a large table, `TRUNCATE users;` is much faster than `DELETE FROM users;` because it does not scan the rows. It takes a stronger lock, though, and it does not fire `ON DELETE` triggers.

### Safe Deletion Patterns

Run the same `WHERE` clause as a `SELECT` first, and check the rows and the count:

```sql
-- Not part of the walkthrough
SELECT id, username FROM users WHERE age < 25;
-- If that is what you want to remove:
DELETE FROM users WHERE age < 25;
```

For data that people might want back, a **soft delete** marks rows instead of removing them:

```sql
-- Not part of the walkthrough
ALTER TABLE users ADD COLUMN deleted_at timestamptz;

-- "Delete"
UPDATE users SET deleted_at = now() WHERE id = 5;

-- Normal queries skip deleted rows
SELECT * FROM users WHERE deleted_at IS NULL;
```

Soft deletes make every query a bit more complex and keep personal data that privacy laws may require you to erase. Use them where undo matters, not everywhere.

### DELETE with RETURNING

`RETURNING` shows exactly what you removed:

```sql
DELETE FROM users WHERE username = 'ivan'
RETURNING id, username;
```

```text
 id | username
----+----------
  9 | ivan
(1 row)

DELETE 1
```

## Aggregate Functions

Aggregate functions turn many rows into one value.

### COUNT

```sql
SELECT count(*) AS all_rows,
       count(age) AS with_age,
       count(DISTINCT age) AS distinct_ages
FROM users;
```

```text
 all_rows | with_age | distinct_ages
----------+----------+---------------
        8 |        7 |             7
(1 row)
```

`count(*)` counts rows. `count(age)` counts non-NULL values, which is why it is one lower: Erin has no age.

### SUM, AVG, MIN, MAX

`avg` of integers returns a `numeric` with many decimal places:

```sql
SELECT avg(age) FROM users;
```

```text
         avg
---------------------
 35.5714285714285714
(1 row)
```

Round it for display, and combine several aggregates in one query:

```sql
SELECT round(avg(age), 1) AS avg_age,
       min(age) AS youngest,
       max(age) AS oldest
FROM users;
```

```text
 avg_age | youngest | oldest
---------+----------+--------
    35.6 |       19 |     67
(1 row)
```

Aggregates skip `NULL`. The average is over seven users, not eight. If a missing age should count as something else, say so explicitly with `coalesce(age, ...)`.

### GROUP BY

`GROUP BY` splits the rows into groups and runs the aggregate once per group. Here, users per age decade:

```sql
SELECT (age / 10) * 10 AS decade, count(*) AS users
FROM users
WHERE age IS NOT NULL
GROUP BY decade
ORDER BY decade;
```

```text
 decade | users
--------+-------
     10 |     1
     20 |     2
     30 |     2
     40 |     1
     60 |     1
(5 rows)
```

Every column in the select list must be in `GROUP BY`, inside an aggregate, or functionally dependent on the grouped columns (grouping by a table's primary key lets you select its other columns). Otherwise PostgreSQL cannot know which of the group's values to show:

```sql
SELECT age, email, count(*) FROM users GROUP BY age;
```

```text
ERROR:  column "users.email" must appear in the GROUP BY clause or be used in an aggregate function
LINE 1: SELECT age, email, count(*) FROM users GROUP BY age;
                    ^
```

### HAVING

`WHERE` filters rows before grouping. `HAVING` filters groups after aggregation:

```sql
SELECT (age / 10) * 10 AS decade, count(*) AS users
FROM users
WHERE age IS NOT NULL
GROUP BY decade
HAVING count(*) >= 2
ORDER BY decade;
```

```text
 decade | users
--------+-------
     20 |     2
     30 |     2
(2 rows)
```

## String Functions

```sql
SELECT upper(username), lower(email) FROM users;
SELECT username || ' <' || email || '>' AS contact FROM users;
SELECT length(username) FROM users;
SELECT split_part(email, '@', 2) AS domain FROM users;
SELECT replace(email, '@example.com', '@example.org') FROM users;
SELECT trim('  padded  ');
```

```sql
SELECT username, upper(username), length(username), split_part(email, '@', 2) AS domain
FROM users
ORDER BY id
LIMIT 3;
```

```text
 username | upper | length |   domain
----------+-------+--------+-------------
 alice    | ALICE |      5 | example.com
 bob      | BOB   |      3 | example.com
 carol    | CAROL |      5 | example.com
(3 rows)
```

## Date and Time Functions

`now()` returns the start time of the current transaction as a `timestamptz`. Intervals let you do date arithmetic:

```sql
SELECT username, created_at, created_at + interval '7 days' AS week_later
FROM users
WHERE username = 'alice';
```

```text
 username |       created_at       |       week_later
----------+------------------------+------------------------
 alice    | 2026-09-01 09:15:00+00 | 2026-09-08 09:15:00+00
(1 row)
```

For date ranges, compare the column itself with a half-open range (`>=` start, `<` end). It catches every timestamp on the last day, and an index on `created_at` can serve it:

```sql
SELECT username FROM users
WHERE created_at >= '2026-10-01' AND created_at < '2026-11-01';
```

```text
 username
----------
 erin
 frank
 grace
 heidi
(4 rows)
```

`date_trunc` rounds timestamps down, which makes it the usual tool for "per day" or "per month" reports:

```sql
SELECT date_trunc('month', created_at) AS month, count(*) AS signups
FROM users
GROUP BY month
ORDER BY month;
```

```text
         month          | signups
------------------------+---------
 2026-09-01 00:00:00+00 |       4
 2026-10-01 00:00:00+00 |       4
(2 rows)
```

Other functions you will meet: `extract(year FROM created_at)`, `to_char(created_at, 'YYYY-MM-DD')`, `age(timestamp)` and `current_date`.

## Aliasing

`AS` renames a column or a table in the query result:

```sql
SELECT username AS name, email AS contact FROM users;

-- Table aliases keep longer queries short (Part 6 uses them for joins)
SELECT u.username, u.email FROM users AS u WHERE u.age > 25;
```

An alias must be quoted if it has spaces or capitals: `AS "Signup Date"`. Unquoted identifiers are folded to lowercase.

## CASE Expressions

`CASE` is the SQL `if`/`else`. The first matching `WHEN` wins:

```sql
SELECT username, age,
  CASE
    WHEN age IS NULL THEN 'unknown'
    WHEN age < 25 THEN 'under 25'
    WHEN age < 65 THEN '25-64'
    ELSE '65+'
  END AS age_group
FROM users
ORDER BY id;
```

```text
 username | age | age_group
----------+-----+-----------
 alice    |  29 | 25-64
 bob      |  33 | 25-64
 carol    |  24 | under 25
 dave     |  19 | under 25
 erin     |     | unknown
 frank    |  45 | 25-64
 grace    |  32 | 25-64
 heidi    |  67 | 65+
(8 rows)
```

Combine `CASE` with aggregates to count several categories in one pass:

```sql
SELECT count(*) FILTER (WHERE age < 25) AS under_25,
       count(*) FILTER (WHERE age >= 25) AS age_25_plus,
       count(*) FILTER (WHERE age IS NULL) AS unknown
FROM users;
```

`FILTER` is PostgreSQL's cleaner way to write `count(CASE WHEN ... THEN 1 END)`.

## NULL Handling

Any arithmetic or `||` with `NULL` gives `NULL`. `concat()` treats `NULL` as an empty string:

```sql
SELECT 5 + NULL AS sum, 'Hello ' || NULL AS concat_op, concat('Hello ', NULL) AS concat_fn;
```

```text
 sum | concat_op | concat_fn
-----+-----------+-----------
     |           | Hello
(1 row)
```

psql shows `NULL` as an empty cell. Run `\pset null '(null)'` to make it visible.

`coalesce` returns its first non-NULL argument, and `nullif(a, b)` returns `NULL` when `a = b`:

```sql
SELECT username, coalesce(age, 0) AS age FROM users WHERE username IN ('dave', 'erin');
```

```text
 username | age
----------+-----
 dave     |  19
 erin     |   0
(2 rows)
```

## Practical Examples

### User Registration Report

```sql
SELECT date_trunc('day', created_at) AS signup_day,
       count(*) AS new_users,
       round(avg(age), 1) AS avg_age
FROM users
WHERE created_at >= current_date - interval '30 days'
GROUP BY signup_day
ORDER BY signup_day DESC;
```

### Find Duplicates

A unique constraint on `email` does not stop `Alice@Example.com` and `alice@example.com` from both existing. Find them case-insensitively:

```sql
SELECT lower(email) AS email, count(*) AS copies
FROM users
GROUP BY lower(email)
HAVING count(*) > 1;
```

### Clean Up Data

```sql
-- Not part of the walkthrough
-- Trim and lowercase email addresses
UPDATE users SET email = lower(trim(email))
WHERE email <> lower(trim(email));

-- Remove soft-deleted accounts after 30 days
DELETE FROM users
WHERE deleted_at < now() - interval '30 days';
```

### Export Data

`\copy` runs on the client, so it writes the file on your machine and needs no server file access:

```sql
\copy (SELECT id, username, email, created_at FROM users ORDER BY id) TO 'users.csv' WITH (FORMAT csv, HEADER)
```

## Common Mistakes

**Forgetting WHERE in UPDATE or DELETE.** The statement changes every row. Write the `WHERE` clause first, or test inside a transaction (below).

**Comparing with `= NULL`.** It never matches. Use `IS NULL` and `IS NOT NULL`.

**Expecting a stable order without ORDER BY.** Rows come back in whatever order is cheapest. After the updates and deletes above, the same `LIMIT 3` query no longer starts with alice:

```sql
SELECT username FROM users LIMIT 3;
```

```text
 username
----------
 carol
 dave
 erin
(3 rows)
```

Updated rows are written as new row versions further back in the table, so the physical order changed. Always add `ORDER BY` when order matters, especially for pagination.

**Forgetting where NULLs sort.** `ORDER BY ... DESC` puts `NULL` first. Add `NULLS LAST` for "top 10" lists.

**Paging with large OFFSET values.** Use keyset pagination for deep pages.

**Ignoring NULL in aggregates.** `avg` and `count(column)` skip `NULL`. Decide whether that is what the report should mean.

**Building SQL with string concatenation in application code.** Use parameters (`$1`, `%s`) so input can never become SQL.

## Testing Queries Safely

Wrap a risky change in a transaction, look at the result, and roll back if it is wrong:

```terminal
{
  "title": "try it, check it, undo it",
  "prompt": "learn_sql=#",
  "steps": [
    {
      "cmd": "BEGIN;",
      "output": "BEGIN"
    },
    {
      "prompt": "learn_sql=*#",
      "cmd": "DELETE FROM users WHERE age < 25;",
      "output": "DELETE 2"
    },
    {
      "prompt": "learn_sql=*#",
      "cmd": "SELECT count(*) FROM users;",
      "output": " count\n-------\n     6\n(1 row)"
    },
    {
      "prompt": "learn_sql=*#",
      "cmd": "ROLLBACK;",
      "output": "ROLLBACK"
    },
    {
      "cmd": "SELECT count(*) FROM users;",
      "output": " count\n-------\n     8\n(1 row)"
    }
  ]
}
```

The `*` in the `learn_sql=*#` prompt means a transaction is open. Nothing is visible to other sessions, or permanent, until you run `COMMIT`. [Part 8](/guides/introduction-to-postgres/08-transactions-and-concurrency) covers transactions in depth.

For exploration on a production database, open a read-only transaction so a typo cannot change data:

```sql
BEGIN TRANSACTION READ ONLY;
SELECT * FROM users WHERE age < 25;
ROLLBACK;
```

## Summary

You can now read data with `SELECT`, filter it with `WHERE`, sort and page it, add rows with `INSERT` (including upserts and `RETURNING`), change them with `UPDATE`, remove them with `DELETE`, and summarize them with aggregates and `GROUP BY`. You also saw the `NULL` rules that cause most surprises.

So far everything lived in one table. Next, in [Database Design and Schema Modeling](/guides/introduction-to-postgres/04-database-design-and-schemas), you will split data into related tables with primary and foreign keys, so it stays consistent as your application grows.
