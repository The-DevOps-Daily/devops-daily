---
title: Data Types and Constraints in PostgreSQL
description: 'Pick PostgreSQL data types (bigint, numeric, text, timestamptz, jsonb, uuid, arrays) and enforce rules with NOT NULL, UNIQUE, CHECK and defaults.'
order: 5
---

**TLDR**: Use `bigint` identity columns for keys, `numeric` for money, `text` for strings, `timestamptz` for points in time, `boolean` for flags and `jsonb` for free-form documents. Then let the database enforce your rules: `NOT NULL`, `UNIQUE`, `CHECK`, foreign keys and defaults. A constraint stops bad data at the door, whichever application, script or person sends it.

Every column has a type, and the type decides what values are allowed, how much space they take, which operators and indexes work on them, and how they sort. Constraints add your own rules on top. This part walks through the types you will use most and the constraints that keep data clean, with the real messages PostgreSQL 18 prints when a rule is broken.

## Prerequisites

- PostgreSQL and `psql` ([Part 2](/guides/introduction-to-postgres/02-installation-and-setup)).
- Tables, primary keys and foreign keys from [Part 4](/guides/introduction-to-postgres/04-database-design-and-schemas).
- Any scratch database. Each example creates its own table.

Run the blocks in order to get the same output as shown. Blocks that start with `-- Not part of the walkthrough` show other forms of a statement; skip them, or your later results will differ.

## Numeric Types

### Integers

| Type       | Size    | Range                                     |
| ---------- | ------- | ----------------------------------------- |
| `smallint` | 2 bytes | -32,768 to 32,767                         |
| `integer`  | 4 bytes | -2,147,483,648 to 2,147,483,647           |
| `bigint`   | 8 bytes | about -9.2 quintillion to 9.2 quintillion |

Use `integer` for counts and quantities, and `bigint` for primary keys and anything that grows without a clear limit. PostgreSQL raises an error instead of wrapping around when a value does not fit:

```sql
SELECT 2147483647::integer + 1;
```

```text
ERROR:  integer out of range
```

For auto-generated keys, use `bigint GENERATED ALWAYS AS IDENTITY` (see [Part 4](/guides/introduction-to-postgres/04-database-design-and-schemas#h3-auto-incrementing-integers)). `SERIAL` and `BIGSERIAL` still work but are the older form.

### Decimal Numbers

| Type                        | Exact? | Use for                                        |
| --------------------------- | ------ | ---------------------------------------------- |
| `numeric(p, s)` / `decimal` | Yes    | Money, quantities that must add up exactly     |
| `real`                      | No     | Sensor data, about 6 significant digits        |
| `double precision`          | No     | Scientific values, about 15 significant digits |

Floating point types store binary approximations, so simple decimal sums are not exact:

```sql
SELECT 0.1::double precision + 0.2::double precision AS float_sum,
       0.1::numeric + 0.2::numeric AS numeric_sum;
```

```text
      float_sum      | numeric_sum
---------------------+-------------
 0.30000000000000004 |         0.3
(1 row)
```

Store money as `numeric(12, 2)` (12 digits in total, 2 after the point), or as an integer number of cents. Avoid the `money` type: its output depends on the server's locale setting.

## Character Types

| Type         | Behavior                                           |
| ------------ | -------------------------------------------------- |
| `text`       | Any length                                         |
| `varchar(n)` | Up to `n` characters; longer values raise an error |
| `char(n)`    | Exactly `n` characters, padded with spaces         |

In PostgreSQL, `text` and `varchar` are stored the same way and perform the same. Use `text` by default. When you need a length limit, `varchar(n)` works, and so does `text` with a `CHECK (length(col) <= n)` constraint that you can change later without touching the column type.

```terminal
{
  "title": "length limits and padding",
  "prompt": "$",
  "steps": [
    {
      "cmd": "CREATE TABLE t_codes (code varchar(5));",
      "output": "CREATE TABLE"
    },
    {
      "cmd": "INSERT INTO t_codes VALUES ('too long for five');",
      "output": "ERROR:  value too long for type character varying(5)"
    },
    {
      "cmd": "SELECT 'abc'::char(5) || '|' AS char_value, 'abc'::varchar(5) || '|' AS varchar_value;",
      "output": " char_value | varchar_value\n------------+---------------\n abc|       | abc|\n(1 row)"
    }
  ]
}
```

`char(n)` pads values with spaces and ignores trailing spaces in comparisons, which surprises people. You rarely need it; even fixed-length codes such as country codes work fine as `text` with a `CHECK`.

## Date and Time Types

| Type          | Example value            | Notes                               |
| ------------- | ------------------------ | ----------------------------------- |
| `date`        | `2026-02-14`             | Calendar date                       |
| `time`        | `14:30:00`               | Time of day, no date                |
| `timestamp`   | `2026-02-14 14:30:00`    | Date and time with **no** time zone |
| `timestamptz` | `2026-02-14 19:30:00+00` | A point in time                     |
| `interval`    | `2 days 03:00:00`        | A duration                          |

**Use `timestamptz` for anything that happened at a moment in time.** PostgreSQL converts the input to UTC for storage and converts it back to the session's time zone for display. A plain `timestamp` stores the wall-clock digits you gave it and forgets which time zone they were in.

The difference shows when the session time zone changes:

```sql
CREATE TABLE events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  starts_at timestamptz NOT NULL,
  local_naive timestamp
);
```

```terminal
{
  "title": "same moment, different time zones",
  "prompt": "$",
  "steps": [
    {
      "cmd": "SET timezone = 'America/New_York';",
      "output": "SET"
    },
    {
      "cmd": "INSERT INTO events (name, starts_at, local_naive)\nVALUES ('Launch', '2026-02-14 14:30:00', '2026-02-14 14:30:00');",
      "output": "INSERT 0 1"
    },
    {
      "cmd": "SELECT name, starts_at, local_naive FROM events;",
      "output": "  name  |       starts_at        |     local_naive\n--------+------------------------+---------------------\n Launch | 2026-02-14 14:30:00-05 | 2026-02-14 14:30:00\n(1 row)"
    },
    {
      "cmd": "SET timezone = 'Europe/London';",
      "output": "SET"
    },
    {
      "cmd": "SELECT name, starts_at, local_naive FROM events;",
      "output": "  name  |       starts_at        |     local_naive\n--------+------------------------+---------------------\n Launch | 2026-02-14 19:30:00+00 | 2026-02-14 14:30:00\n(1 row)"
    },
    {
      "cmd": "SELECT starts_at AT TIME ZONE 'Asia/Tokyo' AS tokyo_wall_clock FROM events;",
      "output": "  tokyo_wall_clock\n---------------------\n 2026-02-15 04:30:00\n(1 row)"
    }
  ]
}
```

`starts_at` is the same instant both times, shown in the session's zone. `local_naive` shows the same digits whatever the zone, so you can no longer tell when the launch happened. `AT TIME ZONE` converts a `timestamptz` to the local wall-clock time in any zone.

## Boolean Type

`boolean` holds `true`, `false` or `NULL`. PostgreSQL accepts several spellings on input:

```sql
SELECT 'yes'::boolean, 'off'::boolean, 't'::boolean;
```

```text
 bool | bool | bool
------+------+------
 t    | f    | t
(1 row)
```

```sql
CREATE TABLE accounts_flags (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  is_active boolean NOT NULL DEFAULT true,
  email_verified boolean NOT NULL DEFAULT false
);

SELECT * FROM accounts_flags WHERE is_active AND NOT email_verified;
```

Make flags `NOT NULL` with a default, unless "we do not know yet" is a real third state.

## JSON Types

PostgreSQL has two JSON types. `json` stores the input text as is. `jsonb` stores a parsed binary form: it is faster to query, supports indexes, and drops duplicate keys and whitespace:

```sql
SELECT '{"a": 1, "a": 2, "b": [1,2]}'::json AS as_json,
       '{"a": 1, "a": 2, "b": [1,2]}'::jsonb AS as_jsonb;
```

```text
           as_json            |       as_jsonb
------------------------------+-----------------------
 {"a": 1, "a": 2, "b": [1,2]} | {"a": 2, "b": [1, 2]}
(1 row)
```

Use `jsonb` unless you must keep the exact original text.

```sql
CREATE TABLE documents (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  metadata jsonb NOT NULL
);

INSERT INTO documents (metadata) VALUES
  ('{"name": "Ada", "age": 36, "tags": ["developer", "postgres"]}'),
  ('{"name": "Linus", "age": 28, "tags": ["kernel"]}');
```

`->` returns a JSON value, `->>` returns text, and `@>` tests whether the document contains another document:

```terminal
{
  "title": "query jsonb",
  "prompt": "$",
  "steps": [
    {
      "cmd": "SELECT metadata->>'name' AS name,\n       (metadata->>'age')::int AS age,\n       metadata->'tags' AS tags\nFROM documents;",
      "output": " name  | age |           tags\n-------+-----+---------------------------\n Ada   |  36 | [\"developer\", \"postgres\"]\n Linus |  28 | [\"kernel\"]\n(2 rows)"
    },
    {
      "cmd": "SELECT metadata->>'name' AS name\nFROM documents\nWHERE metadata @> '{\"tags\": [\"postgres\"]}';",
      "output": " name\n------\n Ada\n(1 row)"
    }
  ]
}
```

A GIN index makes `@>` fast on large tables ([Part 7](/guides/introduction-to-postgres/07-indexes-and-performance)). `jsonb` is good for data with a shape you do not control: API payloads, settings, event properties. When a field matters to your queries or needs constraints, give it a real column.

## Array Types

Any type can be an array:

```sql
CREATE TABLE posts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}'
);

INSERT INTO posts (title, tags) VALUES
  ('PostgreSQL Guide', ARRAY['database', 'tutorial']),
  ('Docker Tips', '{containers}');
```

```sql
SELECT title, tags, tags[1] AS first_tag, cardinality(tags) AS n
FROM posts
WHERE 'database' = ANY (tags);
```

```text
      title       |        tags         | first_tag | n
------------------+---------------------+-----------+---
 PostgreSQL Guide | {database,tutorial} | database  | 2
(1 row)
```

Arrays start at index 1. They are fine for short lists that you read together with the row. If you need to join on the values, count them across rows, or attach data to each one, use a separate table instead.

## UUID Type

`uuid` stores 128-bit identifiers in 16 bytes. Generate them with the built-in `gen_random_uuid()` (random, version 4) or `uuidv7()` (time-ordered, new in PostgreSQL 18):

```sql
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id bigint NOT NULL,
  data jsonb
);
```

You do not need the `uuid-ossp` extension that older tutorials install. [Part 4](/guides/introduction-to-postgres/04-database-design-and-schemas#h3-uuids) compares UUIDs with integer keys.

## Constraints

Constraints are rules that the database checks on every write. They protect the data no matter which client writes it.

### NOT NULL

Require a value:

```sql
CREATE TABLE accounts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username text NOT NULL,
  email text NOT NULL UNIQUE,
  bio text  -- optional
);
```

```sql
INSERT INTO accounts (bio) VALUES ('My bio');
```

```text
ERROR:  null value in column "username" of relation "accounts" violates not-null constraint
DETAIL:  Failing row contains (1, null, null, My bio).
```

Make columns `NOT NULL` by default and allow `NULL` only where "unknown" or "not applicable" is a real state.

### UNIQUE

Prevent duplicates in a column or a combination of columns:

```terminal
{
  "title": "unique email",
  "prompt": "$",
  "steps": [
    {
      "cmd": "INSERT INTO accounts (username, email) VALUES ('alice', 'alice@example.com');",
      "output": "INSERT 0 1"
    },
    {
      "cmd": "INSERT INTO accounts (username, email) VALUES ('alice2', 'alice@example.com');",
      "output": "ERROR:  duplicate key value violates unique constraint \"accounts_email_key\"\nDETAIL:  Key (email)=(alice@example.com) already exists."
    }
  ]
}
```

```sql
CREATE TABLE enrollments (
  student_id bigint NOT NULL,
  course_id bigint NOT NULL,
  UNIQUE (student_id, course_id)  -- one enrollment per student per course
);
```

By default, `NULL` values never conflict, so a unique column can hold many `NULL`s. Since PostgreSQL 15, `NULLS NOT DISTINCT` treats them as equal:

```sql
CREATE TABLE subscriptions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text,
  CONSTRAINT one_null_email UNIQUE NULLS NOT DISTINCT (email)
);
```

```sql
INSERT INTO subscriptions (email) VALUES (NULL), (NULL);
```

```text
ERROR:  duplicate key value violates unique constraint "one_null_email"
DETAIL:  Key (email)=(null) already exists.
```

A `UNIQUE` constraint is case-sensitive. For case-insensitive uniqueness, use a unique index on `lower(email)`.

### CHECK

Validate values with any boolean expression:

```sql
CREATE TABLE products (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  price numeric(10, 2) NOT NULL CHECK (price >= 0),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  discount_percent integer CHECK (discount_percent BETWEEN 0 AND 100)
);
```

```sql
INSERT INTO products (name, price) VALUES ('Widget', -10.00);
```

```text
ERROR:  new row for relation "products" violates check constraint "products_price_check"
DETAIL:  Failing row contains (1, Widget, -10.00, 0, null).
```

A check can compare columns. Name your constraints, because the name appears in the error message your application logs:

```sql
CREATE TABLE bookings (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  start_date date NOT NULL,
  end_date date NOT NULL,
  CONSTRAINT end_after_start CHECK (end_date >= start_date)
);
```

```sql
INSERT INTO bookings (start_date, end_date) VALUES ('2026-10-10', '2026-10-01');
```

```text
ERROR:  new row for relation "bookings" violates check constraint "end_after_start"
DETAIL:  Failing row contains (1, 2026-10-10, 2026-10-01).
```

A `CHECK` passes when the expression is `NULL`, so `discount_percent` can still be `NULL` here. Add `NOT NULL` if the column must have a value.

### DEFAULT

Set the value used when an insert leaves the column out:

```sql
CREATE TABLE drafts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  views integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO drafts (title) VALUES ('My post');  -- status, views and created_at use defaults
```

### PRIMARY KEY

A primary key is `UNIQUE` plus `NOT NULL`, and a table can have only one:

```sql
CREATE TABLE order_items (
  order_id bigint,
  product_id bigint,
  quantity integer NOT NULL,
  PRIMARY KEY (order_id, product_id)  -- composite key
);
```

### FOREIGN KEY

A foreign key keeps references valid ([Part 4](/guides/introduction-to-postgres/04-database-design-and-schemas#h2-foreign-keys) covers the details):

```sql
CREATE TABLE comments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id bigint NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  body text NOT NULL
);
```

## Generated Columns

A generated column is computed from other columns in the same row. PostgreSQL 18 supports two kinds:

- **Virtual** (the default since PostgreSQL 18): computed when you read it, takes no storage.
- **Stored**: computed on write and saved on disk. Use it when the expression is expensive or you want to index it.

```sql
CREATE TABLE prices (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  net numeric(10, 2) NOT NULL,
  tax_rate numeric(4, 3) NOT NULL DEFAULT 0.075,
  gross numeric(10, 2) GENERATED ALWAYS AS (round(net * (1 + tax_rate), 2)) STORED,
  gross_virtual numeric GENERATED ALWAYS AS (net * (1 + tax_rate))
);
```

```terminal
{
  "title": "generated columns",
  "prompt": "$",
  "steps": [
    {
      "cmd": "INSERT INTO prices (net) VALUES (100.00);",
      "output": "INSERT 0 1"
    },
    {
      "cmd": "SELECT * FROM prices;",
      "output": " id |  net   | tax_rate | gross  | gross_virtual\n----+--------+----------+--------+---------------\n  1 | 100.00 |    0.075 | 107.50 |     107.50000\n(1 row)"
    },
    {
      "cmd": "INSERT INTO prices (net, gross) VALUES (10, 99);",
      "output": "ERROR:  cannot insert a non-DEFAULT value into column \"gross\"\nDETAIL:  Column \"gross\" is a generated column."
    }
  ]
}
```

You cannot write to a generated column, so the computed value can never disagree with its inputs. On PostgreSQL 17 and older, every generated column must say `STORED`.

## Altering Tables

Change constraints and columns on existing tables with `ALTER TABLE`:

```sql
-- Not part of the walkthrough
-- Add a column (fast, even with a constant default)
ALTER TABLE accounts ADD COLUMN phone text;

-- Add and drop constraints
ALTER TABLE accounts ADD CONSTRAINT accounts_username_key UNIQUE (username);
ALTER TABLE products ADD CONSTRAINT positive_stock CHECK (stock >= 0);
ALTER TABLE accounts DROP CONSTRAINT accounts_username_key;

-- Defaults and NOT NULL
ALTER TABLE drafts ALTER COLUMN status SET DEFAULT 'draft';
ALTER TABLE accounts ALTER COLUMN email SET NOT NULL;

-- Rename and retype
ALTER TABLE accounts RENAME COLUMN phone TO phone_number;
ALTER TABLE accounts ALTER COLUMN phone_number TYPE varchar(20);
```

A new constraint is checked against the existing rows, and fails if any row breaks it:

```sql
ALTER TABLE accounts ALTER COLUMN bio SET NOT NULL;
```

```text
ERROR:  column "bio" of relation "accounts" contains null values
```

:::warning
On a large table in production, many `ALTER TABLE` forms take an `ACCESS EXCLUSIVE` lock that blocks reads and writes while they run. Changing a column's type usually rewrites the whole table. Adding a `CHECK` or foreign key scans every row. Add constraints as `NOT VALID` first (new writes are checked at once, with a short lock), then run `VALIDATE CONSTRAINT`, which checks old rows without blocking writes. Set `lock_timeout` so a migration gives up instead of queueing behind a long query and blocking everyone after it.
:::

```terminal
{
  "title": "add a constraint without a long lock",
  "prompt": "$",
  "steps": [
    {
      "cmd": "ALTER TABLE accounts ADD CONSTRAINT bio_length CHECK (length(bio) <= 500) NOT VALID;",
      "output": "ALTER TABLE"
    },
    {
      "cmd": "ALTER TABLE accounts VALIDATE CONSTRAINT bio_length;",
      "output": "ALTER TABLE"
    }
  ]
}
```

PostgreSQL 18 also accepts `NOT VALID` for `NOT NULL` constraints (`ALTER TABLE accounts ADD CONSTRAINT bio_not_null NOT NULL bio NOT VALID;`), so you can enforce `NOT NULL` on new rows before you have fixed the old ones.

## Choosing the Right Type

| Data                       | Type                                                             |
| -------------------------- | ---------------------------------------------------------------- |
| Primary keys               | `bigint GENERATED ALWAYS AS IDENTITY`, or `uuid` with `uuidv7()` |
| Money                      | `numeric(12, 2)` or integer cents                                |
| Counts and quantities      | `integer` (`bigint` if it can pass 2 billion)                    |
| Names, emails, any text    | `text` (with a `CHECK` if you need a limit)                      |
| Points in time             | `timestamptz`                                                    |
| Calendar dates (birthdays) | `date`                                                           |
| Durations                  | `interval`                                                       |
| Flags                      | `boolean NOT NULL DEFAULT ...`                                   |
| Free-form documents        | `jsonb`                                                          |
| A fixed set of states      | `text` with a `CHECK`, or an enum type                           |

## Common Patterns

### Email validation

A full email address check is better done in the application, but a basic shape check catches obvious garbage:

```sql
ALTER TABLE accounts ADD CONSTRAINT valid_email
  CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
```

```sql
INSERT INTO accounts (username, email) VALUES ('bob', 'not-an-email');
```

```text
ERROR:  new row for relation "accounts" violates check constraint "valid_email"
DETAIL:  Failing row contains (4, bob, not-an-email, null).
```

### Enum-like constraints

Limit a column to a fixed set of values with a `CHECK`:

```sql
CREATE TABLE orders (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'shipped', 'delivered', 'cancelled'))
);
```

Or define an enum type. Enums are compact and sort in the order you declare them, but removing a value later is hard, while a `CHECK` is easy to replace:

```sql
CREATE TYPE order_status AS ENUM ('pending', 'paid', 'shipped', 'cancelled');

CREATE TABLE shipments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  status order_status NOT NULL DEFAULT 'pending'
);
```

```sql
INSERT INTO shipments (status) VALUES ('refunded');
```

```text
ERROR:  invalid input value for enum order_status: "refunded"
LINE 1: INSERT INTO shipments (status) VALUES ('refunded');
                                               ^
```

### Phone numbers

Store phone numbers as `text`, never as a number: leading zeros and `+` signs matter. A check can enforce the international E.164 format:

```sql
CREATE TABLE contacts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  phone_number text CHECK (phone_number ~ '^\+[1-9][0-9]{1,14}$')
);
```

## Common Mistakes

- **Using `timestamp` instead of `timestamptz`.** You lose the information about which moment a value means. Converting later is error-prone.
- **Storing money in `real` or `double precision`.** Rounding errors add up. Use `numeric`.
- **`varchar(255)` everywhere.** The number has no special meaning in PostgreSQL. Use `text`, and add a limit only where the business rule needs one.
- **Numbers or dates stored as text.** You lose validation, sorting and date arithmetic.
- **Leaving columns nullable by default.** Every nullable column needs `NULL` handling in every query. Add `NOT NULL` unless missing data is valid.
- **Putting everything in `jsonb`.** You give up types, constraints and simple queries. Use real columns for fields you filter, join or validate.
- **Adding constraints to big tables in one blocking step.** Use `NOT VALID` plus `VALIDATE CONSTRAINT`.

## Summary

You can now pick a fitting type for each column (integers, `numeric`, `text`, `timestamptz`, `boolean`, `jsonb`, arrays and UUIDs) and protect the data with `NOT NULL`, `UNIQUE`, `CHECK`, defaults, keys and generated columns. You also saw how to add constraints to a live table without a long lock.

Next, in [Advanced Queries and Joins](/guides/introduction-to-postgres/06-advanced-queries-and-joins), you will combine tables with joins and answer harder questions with subqueries, CTEs and window functions.
