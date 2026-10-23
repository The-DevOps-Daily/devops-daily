---
title: Understanding Database Fundamentals
description: 'How relational databases like PostgreSQL work: tables, keys, relationships, ACID transactions, the write-ahead log, and how a query is planned and run.'
order: 1
---

**TLDR**: A database stores data so many users can read and change it safely and quickly. Relational databases like PostgreSQL keep data in tables of rows and columns, link tables with keys, and enforce rules about what data is valid. Transactions make groups of changes all-or-nothing, the write-ahead log makes committed data survive crashes, and the query planner finds a fast way to answer each question you ask in SQL.

Before you install PostgreSQL, it helps to know what problems a database solves and how a relational database is organized. This part explains the concepts the rest of the guide builds on: tables and keys, relationships, transactions, and what happens inside PostgreSQL when your application sends a query.

## Prerequisites

- No database experience. If you have used a spreadsheet, you already know rows and columns.
- Some programming or command line experience helps you follow the examples, but you do not need to run anything in this part.

## What Problems Do Databases Solve?

Imagine building a blog application. You could store posts in text files:

```text
posts/
  post-1.txt
  post-2.txt
  post-3.txt
```

This works until you need to:

- find all posts by one author;
- show posts sorted by date;
- count the comments on each post;
- let two people edit at the same time without overwriting each other;
- make sure nothing is lost when the server crashes halfway through a save.

With files, you would end up writing that code yourself: parsing every file to search it, tracking which comment belongs to which post, locking files, and building backup and recovery. A database does all of this for you, and it has been tested against far more failure cases than your own code ever will be.

## Relational Database Concepts

Relational databases organize data in tables, similar to spreadsheets but with strict rules.

### Tables, Rows, and Columns

A table holds one kind of thing. Each row is one item, and each column is one attribute of that item:

```text
users
 id | username | email             | created_at
----+----------+-------------------+------------------------
  1 | alice    | alice@example.com | 2026-01-15 10:23:00+00
  2 | bob      | bob@example.com   | 2026-01-16 14:45:00+00
  3 | carol    | carol@example.com | 2026-01-17 09:12:00+00

posts
 id | user_id | title             | created_at
----+---------+-------------------+------------------------
  1 |       1 | Hello World       | 2026-01-15 11:00:00+00
  2 |       1 | PostgreSQL Basics | 2026-01-16 10:30:00+00
  3 |       2 | My First Post     | 2026-01-17 15:20:00+00
```

Every column has a data type. `id` holds integers, `username` holds text, `created_at` holds timestamps. The database enforces the types: you cannot put a date into an integer column by accident.

### Primary Keys

Every table needs a way to identify each row uniquely: its **primary key**. Here, `id` is the primary key of both tables. "The user with id 1" always means exactly one row.

A primary key must be:

- unique (no two rows share a value);
- not null (every row has one);
- stable (you should never need to change it).

Most tables use a generated integer, a UUID, or occasionally a natural identifier such as an ISO country code. [Part 4](/guides/introduction-to-postgres/04-database-design-and-schemas#h2-primary-keys) compares the options.

### Foreign Keys

Tables refer to each other through **foreign keys**. The `user_id` column in `posts` refers to `id` in `users`:

```text
     users                          posts
┌────────────────┐            ┌──────────────────┐
│ id (PK)        │<───────────│ user_id (FK)     │
│ username       │            │ id (PK)          │
│ email          │            │ title            │
└────────────────┘            └──────────────────┘
```

This means:

- each post belongs to one user;
- a user can have many posts;
- the database refuses a post whose `user_id` does not match an existing user.

If you try to delete a user who still has posts, the database can block the delete or delete the posts too, depending on how you define the key. Either way, you never end up with posts that point to nobody. This is called **referential integrity**.

### Relationships

Tables connect in three ways:

**One-to-many**: one user has many posts. This is the most common relationship.

```text
User (1) ──────< Posts (many)
```

**Many-to-many**: a post has many tags, and a tag belongs to many posts. This needs a third table, often called a junction table, with one row per pair:

```text
Posts >────┬────< Tags
           │
      post_tags
```

**One-to-one**: a user has one profile. It is less common, and is used to split optional or rarely used columns into their own table.

```text
User (1) ────── Profile (1)
```

## How Relational Databases Work

You can use PostgreSQL without knowing its internals, but a rough picture explains a lot of its behavior: why connections are expensive, why committed data survives a crash, and why indexes matter.

### Processes and Memory

PostgreSQL runs as a group of processes. A main server process accepts connections and starts one **backend process** per client connection. Background processes handle work that does not belong to any single query. They all share one block of memory that holds cached data pages (**shared buffers**) and recent log records:

```diagram
{
  "type": "infra",
  "flow": [
    { "label": "Application", "sub": "one connection each", "icon": "box", "tone": "blue" },
    { "label": "postgres", "sub": "main server process", "icon": "server", "tone": "violet" }
  ],
  "groups": [
    {
      "label": "Backend processes",
      "sub": "one per client connection",
      "icon": "cpu",
      "tone": "blue",
      "nodes": [
        { "label": "backend", "sub": "runs your queries", "icon": "activity", "tone": "blue" },
        { "label": "backend", "sub": "runs your queries", "icon": "activity", "tone": "blue" }
      ]
    },
    {
      "label": "Shared memory",
      "sub": "used by every process",
      "icon": "database",
      "tone": "green",
      "nodes": [
        { "label": "shared buffers", "sub": "cached 8 kB pages", "icon": "database", "tone": "green" },
        { "label": "WAL buffers", "sub": "recent log records", "icon": "queue", "tone": "green" }
      ]
    },
    {
      "label": "Background processes",
      "sub": "housekeeping",
      "icon": "gear",
      "tone": "slate",
      "nodes": [
        { "label": "WAL writer", "icon": "gear", "tone": "slate" },
        { "label": "checkpointer", "icon": "gear", "tone": "slate" },
        { "label": "autovacuum", "icon": "gear", "tone": "slate" },
        { "label": "I/O workers", "sub": "PostgreSQL 18", "icon": "gear", "tone": "slate" }
      ]
    }
  ]
}
```

Because every connection is a full operating system process, opening a new connection costs time and memory. That is why production setups use connection pools ([Part 10](/guides/introduction-to-postgres/10-production-best-practices#h3-connection-pooling)).

### Storage

PostgreSQL stores each table and index in files inside its **data directory**. Each database is a directory under `base/`, and each table has at least one file:

```text
data/
└── base/
    └── 16384/          # one database (named by its internal ID)
        ├── 16385       # a table's data
        ├── 16385_fsm   # its free space map
        └── 16385_vm    # its visibility map
```

You can ask PostgreSQL where a table lives and how big its pages are:

```sql
SELECT pg_relation_filepath('users') AS file, current_setting('block_size') AS block_size;
```

```text
     file     | block_size
--------------+------------
 base/5/16385 | 8192
(1 row)
```

Files are divided into 8 kB **pages** (blocks). To read a row, PostgreSQL loads its page into shared buffers. Queries then work on the cached copy, which is much faster than going to disk every time.

### Write-Ahead Logging

When you change data, PostgreSQL does not rewrite the table file right away. It first records the change in the **write-ahead log (WAL)**, and at `COMMIT` it makes sure that log record is on disk. The changed page stays in memory and is written to the table file later, in the background:

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "INSERT / UPDATE", "sub": "your change", "icon": "activity", "tone": "blue" },
    { "label": "Shared buffers", "sub": "page changed in memory", "icon": "database", "tone": "green" },
    { "label": "WAL on disk", "sub": "flushed at COMMIT", "icon": "queue", "tone": "amber" },
    { "label": "Checkpoint", "sub": "dirty pages written to files", "icon": "server", "tone": "violet" }
  ]
}
```

Writing the log sequentially is fast, and it makes commits durable: if the server crashes, PostgreSQL replays the WAL on startup and restores every committed change. The same log feeds replication and point-in-time recovery ([Part 9](/guides/introduction-to-postgres/09-backup-and-recovery)).

### Query Processing

When you send a query, PostgreSQL:

1. **parses** the SQL text into a tree and checks the syntax;
2. **rewrites** it, for example by expanding views into the queries behind them;
3. **plans** it: the planner considers different ways to run the query (which index, which join order, which join method) and estimates the cost of each using statistics about your data;
4. **executes** the cheapest plan and returns the rows.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "SQL text", "icon": "activity", "tone": "slate" },
    { "label": "Parser", "sub": "syntax and names", "icon": "gear", "tone": "blue" },
    { "label": "Rewriter", "sub": "views and rules", "icon": "gear", "tone": "blue" },
    { "label": "Planner", "sub": "cheapest plan", "icon": "branch", "tone": "violet" },
    { "label": "Executor", "sub": "rows back", "icon": "rocket", "tone": "green" }
  ]
}
```

For "find all posts by user 123", the planner might use an index on `user_id` if one exists, or read the whole table if it does not. `EXPLAIN` shows the plan it chose:

```sql
EXPLAIN SELECT * FROM posts WHERE user_id = 123;
```

```text
                      QUERY PLAN
-------------------------------------------------------
 Seq Scan on posts  (cost=0.00..22.12 rows=5 width=56)
   Filter: (user_id = 123)
(2 rows)
```

`Seq Scan` means PostgreSQL reads every row of the table. On a large table, that is the signal to add an index. [Part 7](/guides/introduction-to-postgres/07-indexes-and-performance) teaches you to read these plans.

### Indexes

An index is a separate data structure that maps column values to the rows that contain them. Without an index on `user_id`, finding user 123's posts means reading every row. With one, PostgreSQL looks up 123 in the index and jumps straight to the matching rows:

```text
index on posts.user_id
 user_id | row location
---------+--------------
       1 | page 1, item 1
       1 | page 1, item 2
       2 | page 2, item 3
     123 | page 5, item 7
     123 | page 5, item 8
```

On large tables, this is the difference between milliseconds and seconds or minutes. The cost: every insert, update and delete must also update the index, and the index uses disk space. You add indexes for the columns you search, join and sort on most.

### Transactions

A transaction groups several changes into one unit that either completely happens or does not happen at all:

```sql
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;
```

If the second update fails, the first one is undone too. You never end up with money taken from one account and not added to the other.

Transactions provide the **ACID** guarantees:

- **Atomicity**: all or nothing.
- **Consistency**: the data moves from one valid state to another; constraints always hold.
- **Isolation**: concurrent transactions do not see each other's unfinished work.
- **Durability**: once committed, a change survives a crash.

PostgreSQL implements isolation with **MVCC** (multiversion concurrency control): an update writes a new version of the row instead of overwriting it, so readers keep seeing a consistent snapshot and never wait for writers. [Part 8](/guides/introduction-to-postgres/08-transactions-and-concurrency) covers transactions and MVCC in detail.

## PostgreSQL vs Other Databases

Knowing where PostgreSQL fits helps you choose the right tool.

### PostgreSQL vs MySQL

Both are mature, open source relational databases, and either can run a large production system.

PostgreSQL strengths:

- close adherence to the SQL standard and strict data validation;
- rich data types: `jsonb`, arrays, ranges, UUIDs, network addresses;
- advanced SQL: window functions, recursive queries, `RETURNING`, `MERGE`;
- many index types (B-tree, GIN, GiST, BRIN) and a large extension ecosystem (PostGIS, pgvector, TimescaleDB);
- transactional DDL: schema changes can be rolled back.

MySQL strengths:

- a long history in web hosting and the LAMP stack, so many hosts and older applications expect it;
- simple setup of basic replication;
- some large companies run very large MySQL fleets and share their tooling.

For a new project without a specific reason to use MySQL, PostgreSQL is a safe default.

### PostgreSQL vs MongoDB (NoSQL)

MongoDB is a document database: it stores JSON-like documents instead of rows.

MongoDB fits when:

- your data is naturally one nested document per item and rarely needs joins;
- the structure changes often and differs between documents;
- you want sharding across many machines built in.

PostgreSQL fits when:

- your data has clear relationships between entities;
- you need joins, aggregates and ad-hoc queries;
- data integrity matters (constraints, transactions across many rows and tables);
- you want one system for both structured and semi-structured data.

PostgreSQL's `jsonb` type blurs the line: you can store and index flexible JSON documents next to normal relational tables.

### PostgreSQL vs Redis

Redis is an in-memory data store.

Redis is good for:

- caching;
- sessions;
- counters and rate limits;
- simple queues and pub/sub messaging.

PostgreSQL is good for:

- the durable system of record;
- complex queries;
- transactional integrity.

Many applications use both: Redis for fast, temporary data and PostgreSQL for the data that must not be lost.

## When to Use Relational Databases

Relational databases like PostgreSQL work best when:

**Data has relationships**: users have posts, posts have comments, comments have authors.

**Integrity matters**: payments, accounts, inventory, anything that must be correct.

**Questions change**: "show last month's top 10 customers by order value, per region" is one SQL query, even if nobody planned for it when the schema was designed.

**Many users write at once**: the database handles concurrency for you.

They are a weaker fit when:

**You only need key-value lookups at huge scale**: a dedicated key-value store can be simpler to scale.

**The data is a stream of measurements**: time-series databases (or PostgreSQL extensions built for it) store and compress them more efficiently.

**You need full-text search across a large document collection with complex relevance tuning**: PostgreSQL's built-in search works well for many applications, but a dedicated search engine offers more.

## Database Normalization

Normalization means organizing data so each fact is stored once.

Unnormalized:

```text
orders
 id | customer | customer_email | products
----+----------+----------------+----------------
  1 | Alice    | a@example.com  | Widget, Gadget
  2 | Alice    | a@example.com  | Thing
  3 | Bob      | b@example.com  | Widget
```

Problems:

- Alice's email is repeated; if it changes, you must update every row, and missing one leaves the data inconsistent.
- Products are stored as text, so you cannot count how many widgets were sold.
- You cannot store a product that nobody has ordered yet.

Normalized:

```text
customers
 id | name  | email
----+-------+---------------
  1 | Alice | a@example.com
  2 | Bob   | b@example.com

orders
 id | customer_id
----+-------------
  1 |           1
  2 |           1
  3 |           2

products
 id | name
----+--------
  1 | Widget
  2 | Gadget
  3 | Thing

order_items
 order_id | product_id
----------+------------
        1 |          1
        1 |          2
        2 |          3
        3 |          1
```

Now each fact lives in one place, changing Alice's email is a single update, and products exist on their own. Normalization has formal levels (1NF, 2NF, 3NF) that [Part 4](/guides/introduction-to-postgres/04-database-design-and-schemas#h2-normalization) walks through. The short version: store each fact once and refer to it by key everywhere else.

## SQL: The Language of Relational Databases

SQL (Structured Query Language) is how you talk to a relational database. It is **declarative**: you describe the result you want, and the planner decides how to get it.

```sql
-- Create a table
CREATE TABLE users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username text NOT NULL,
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Insert a row
INSERT INTO users (username, email)
VALUES ('alice', 'alice@example.com');

-- Read rows
SELECT username, email FROM users WHERE id = 1;

-- Change rows
UPDATE users SET email = 'alice@example.org' WHERE id = 1;

-- Remove rows
DELETE FROM users WHERE id = 1;
```

A few building blocks combine into almost every query:

- `WHERE` filters rows;
- `ORDER BY` sorts them;
- `JOIN` combines tables;
- `GROUP BY` summarizes them.

The core of SQL is the same across relational databases, so what you learn here transfers to MySQL, SQL Server or SQLite, with differences in data types and extra features.

## Understanding How Data Flows

When your application uses PostgreSQL, a request follows this path:

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Application", "sub": "driver, e.g. psycopg or pg", "icon": "box", "tone": "blue" },
    { "label": "Connection pool", "sub": "reuses open connections", "icon": "queue", "tone": "amber" },
    { "label": "Backend process", "sub": "parse, plan, execute", "icon": "cpu", "tone": "violet" },
    { "label": "Shared buffers", "sub": "pages from cache or disk", "icon": "database", "tone": "green" },
    { "label": "Result rows", "sub": "sent back to the app", "icon": "check", "tone": "slate" }
  ]
}
```

1. The application takes a connection from its pool (or opens one).
2. It sends SQL, with values passed as separate parameters.
3. The backend process parses, plans and executes the query, reading pages through shared buffers.
4. The rows go back to the application, and the connection returns to the pool for the next request.

Opening a connection involves a network handshake, authentication and a new process, so reusing connections through a pool makes a big difference for busy applications.

## Common Database Terms

**Cluster**: one PostgreSQL server instance with its data directory. A cluster holds many databases. (This is PostgreSQL's term; it does not mean several machines.)

**Database**: a named collection of schemas and tables inside a cluster. A connection always goes to one database.

**Schema**: either the overall structure of your tables, or, in PostgreSQL, a namespace inside a database that holds tables (the default one is called `public`).

**Role**: a user or group that can own objects and be granted privileges.

**Query**: a request for data, usually a `SELECT`.

**Transaction**: a group of statements that succeed or fail together.

**Index**: a data structure that speeds up lookups.

**Constraint**: a rule the database enforces, such as "email is unique" or "price is not negative".

**View**: a saved query that you can select from like a table.

**Trigger**: a function that runs automatically when rows change.

**Function and procedure**: code stored in the database, in SQL, PL/pgSQL or other languages.

**WAL**: the write-ahead log that makes commits durable and powers replication.

**VACUUM**: maintenance that cleans up old row versions left behind by updates and deletes.

## Common Mistakes

- **Treating the database as a file store.** Putting lists into text columns or whole objects into one blob gives up the queries and integrity checks that make a database useful.
- **Enforcing rules only in application code.** Another script, a migration or a manual fix will eventually bypass them. Put essential rules in constraints.
- **Ignoring transactions.** Related changes that are not in one transaction can be left half-done by any error or crash.
- **Choosing a database by trend.** Start from your data and its relationships, then pick the tool.

## Summary

You now know what a relational database does, how tables, keys and relationships organize data, and what happens inside PostgreSQL when a query arrives: a backend process plans it, reads pages through shared buffers, and commits changes durably through the write-ahead log.

Next, in [How to Install PostgreSQL 18 and psql](/guides/introduction-to-postgres/02-installation-and-setup), you will install PostgreSQL on your machine (or only the `psql` client), connect to it, and create your first database.
