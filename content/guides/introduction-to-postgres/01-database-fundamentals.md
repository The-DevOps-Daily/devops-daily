---
title: Understanding Database Fundamentals
description: 'Database fundamentals for developers: what relational databases solve, how tables, rows, and columns map to your data, and why integrity and ACID matter.'
order: 1
---

**TLDR**: Databases store and organize data so applications can find it quickly. Relational databases like PostgreSQL use tables with rows and columns, enforce relationships between data, and guarantee data integrity. They handle concurrent access, support complex queries, and prevent data loss better than files or simple storage.

Before diving into PostgreSQL specifically, you need to understand what databases solve and why relational databases became the standard for most applications.

## What Problems Do Databases Solve?

Imagine building a blog application. You could store posts in text files:

```
posts/
  post-1.txt
  post-2.txt
  post-3.txt
```

This works until you need to:

- Find all posts by a specific author
- Show posts sorted by date
- Count how many comments each post has
- Handle multiple users writing posts simultaneously
- Make sure you never lose data if the server crashes

File systems aren't built for these tasks. You'd end up writing code to:

- Parse every file to search for authors
- Track relationships between posts and comments
- Lock files so two users don't overwrite each other's changes
- Implement backup and recovery mechanisms

Databases solve these problems. They're built specifically for storing, querying, and managing data reliably.

## Relational Database Concepts

Relational databases organize data in tables, similar to spreadsheets but with strict rules.

### Tables, Rows, and Columns

A table holds data about one type of thing. A row represents one item. Columns represent attributes of that item.

```
users table:
┌────┬──────────┬─────────────────────┬─────────────────────┐
│ id │ username │ email               │ created_at          │
├────┼──────────┼─────────────────────┼─────────────────────┤
│ 1  │ alice    │ alice@example.com   │ 2024-01-15 10:23:00 │
│ 2  │ bob      │ bob@example.com     │ 2024-01-16 14:45:00 │
│ 3  │ carol    │ carol@example.com   │ 2024-01-17 09:12:00 │
└────┴──────────┴─────────────────────┴─────────────────────┘

posts table:
┌────┬─────────┬────────────────────┬─────────────────────┐
│ id │ user_id │ title              │ created_at          │
├────┼─────────┼────────────────────┼─────────────────────┤
│ 1  │ 1       │ Hello World        │ 2024-01-15 11:00:00 │
│ 2  │ 1       │ PostgreSQL Basics  │ 2024-01-16 10:30:00 │
│ 3  │ 2       │ My First Post      │ 2024-01-17 15:20:00 │
└────┴─────────┴────────────────────┴─────────────────────┘
```

Each table has columns with specific data types. The `id` column holds numbers, `username` holds text, `created_at` holds timestamps. The database enforces these types - you can't accidentally put a date in the username column.

### Primary Keys

Every table needs a way to uniquely identify each row. This is the primary key.

In the examples above, `id` is the primary key. No two users can have the same id. If you say "get user with id 1", the database knows exactly which row you mean.

Primary keys must be:
- Unique (no duplicates)
- Not null (every row must have one)
- Unchanging (don't change a row's primary key)

Most tables use auto-incrementing integers for primary keys, but you can use other values like UUIDs or natural keys (email addresses, product codes).

### Foreign Keys

Tables relate to each other through foreign keys. The `posts` table has a `user_id` column that references the `users` table's `id`.

```
     users                                posts
┌────────────────┐                  ┌──────────────────┐
│ id (PK)        │<─────────────────│ user_id (FK)     │
│ username       │                  │ id (PK)          │
│ email          │                  │ title            │
└────────────────┘                  └──────────────────┘
```

This relationship means:
- Each post belongs to one user
- Users can have many posts
- The database can verify that every `user_id` in posts points to a real user

If you try to delete a user who has posts, the database can prevent it or cascade the deletion to related posts. This maintains referential integrity - no orphaned data.

### Relationships

Tables connect in three ways:

**One-to-Many**: One user has many posts. Most common relationship.

```
User (1) ──────< Posts (many)
```

**Many-to-Many**: Posts have many tags, tags apply to many posts. Requires a join table.

```
Posts >────┬────< Tags
           │
      post_tags
```

**One-to-One**: A user has one profile. Less common, sometimes used to split large tables.

```
User (1) ────── Profile (1)
```

## How Relational Databases Work

Understanding the internals helps you use databases effectively.

### Storage

PostgreSQL stores data in files on disk. Each database is a directory, each table has files containing its rows.

```
data/
└── base/
    └── 16384/          # Database ID
        ├── 16385       # Table file
        ├── 16385_fsm   # Free space map
        └── 16385_vm    # Visibility map
```

Data is organized in 8KB pages. When you query a table, PostgreSQL reads pages from disk into memory (the buffer cache). Queries then work with in-memory data, which is much faster.

Changes are first written to the Write-Ahead Log (WAL), then applied to data files. This ensures durability - even if PostgreSQL crashes mid-write, it can replay the WAL to recover.

### Query Processing

When you execute a query, PostgreSQL:

1. **Parses** the SQL to check syntax
2. **Plans** how to execute it (which indexes to use, in what order to join tables)
3. **Optimizes** the plan based on statistics about your data
4. **Executes** the plan and returns results

```
SQL Query
    │
    ↓
Parser ──→ Parse Tree
    │
    ↓
Planner ──→ Query Plan
    │
    ↓
Executor ──→ Results
```

The planner is smart. For "find all posts by user 123", it might:

- Use an index on `user_id` if one exists (fast)
- Scan the entire table if there's no index (slow for large tables)

You can see the plan with `EXPLAIN`:

```sql
EXPLAIN SELECT * FROM posts WHERE user_id = 123;
```

This shows whether the query is efficient or needs optimization.

### Indexes

Indexes are data structures that make lookups fast. Without an index, finding user 123's posts means reading every row.

With an index on `user_id`:

```
Index on user_id:
┌────────┬──────────────┐
│ user_id│ row location │
├────────┼──────────────┤
│ 1      │ page 1, row 1│
│ 1      │ page 1, row 2│
│ 2      │ page 2, row 3│
│ 123    │ page 5, row 7│
│ 123    │ page 5, row 8│
└────────┴──────────────┘
```

PostgreSQL jumps directly to rows with `user_id = 123`. This is the difference between milliseconds and minutes on large tables.

Indexes speed up reads but slow down writes (the index must be updated). You add indexes for columns you frequently search, sort, or join on.

### Transactions

Transactions group multiple operations into one atomic unit. Either all operations succeed or all fail.

```sql
BEGIN;
  UPDATE accounts SET balance = balance - 100 WHERE id = 1;
  UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;
```

If the second update fails (maybe account 2 doesn't exist), the first update rolls back. You never end up with money deducted but not added.

Transactions provide ACID guarantees:

- **Atomicity**: All or nothing
- **Consistency**: Database moves from one valid state to another
- **Isolation**: Concurrent transactions don't interfere
- **Durability**: Committed changes survive crashes

These guarantees make databases reliable for critical data like financial records, user accounts, and inventory.

## PostgreSQL vs Other Databases

Understanding where PostgreSQL fits helps you choose the right tool.

### PostgreSQL vs MySQL

Both are popular open-source relational databases.

PostgreSQL strengths:
- Stricter SQL standards compliance
- More advanced features (arrays, JSON, full-text search)
- Better handling of complex queries
- More extension options

MySQL strengths:
- Simpler setup for basic use cases
- Slightly better performance for simple read-heavy workloads
- More common in older PHP applications

For new projects, PostgreSQL is usually the better choice unless you have specific MySQL requirements.

### PostgreSQL vs MongoDB (NoSQL)

MongoDB is a document database storing JSON-like objects instead of rows.

Use MongoDB when:
- Schema changes constantly and unpredictably
- You're storing truly nested document structures
- You need horizontal scaling out of the box

Use PostgreSQL when:
- Data has clear relationships
- You need complex queries and joins
- Data integrity is critical
- You want SQL's mature ecosystem

PostgreSQL's JSONB support blurs this line - you can store flexible JSON documents in PostgreSQL while keeping relational features for structured data.

### PostgreSQL vs Redis

Redis is an in-memory key-value store.

Redis is for:
- Caching
- Session storage
- Real-time counters
- Pub/sub messaging

PostgreSQL is for:
- Persistent data storage
- Complex queries
- Transactional integrity

Use both together - Redis for temporary fast data, PostgreSQL for permanent important data.

## When to Use Relational Databases

Relational databases like PostgreSQL excel when:

**Data has relationships**: Users have posts, posts have comments, comments have authors. Relational databases model this naturally.

**Integrity matters**: Financial transactions, user accounts, inventory - data that must be accurate and consistent.

**Complex queries needed**: "Show me last month's top 10 customers by total order value, grouped by region." SQL handles this elegantly.

**Multiple users**: Many people reading and writing simultaneously. Databases manage concurrency safely.

**Ad-hoc analysis**: Business users running reports. SQL's flexibility lets them explore data without custom code.

They're not ideal when:

**Massive scale with simple access patterns**: Billions of rows with only key-value lookups. NoSQL might be simpler.

**Constantly changing schema**: If structure changes daily, flexible document stores might fit better (though PostgreSQL's JSONB helps here).

**Extreme write performance**: Logging millions of events per second. Time-series databases are optimized for this.

## Database Normalization

Normalization is organizing data to reduce redundancy.

Unnormalized (bad):

```
orders table:
┌────┬───────────┬────────────────┬────────────────────┐
│ id │ customer  │ customer_email │ products           │
├────┼───────────┼────────────────┼────────────────────┤
│ 1  │ Alice     │ a@example.com  │ Widget, Gadget     │
│ 2  │ Alice     │ a@example.com  │ Thing              │
│ 3  │ Bob       │ b@example.com  │ Widget             │
└────┴───────────┴────────────────┴────────────────────┘
```

Problems:
- Alice's email is duplicated (if it changes, must update multiple rows)
- Products are stored as text (can't query individual products easily)
- Can't add products without an order

Normalized (good):

```
customers:
┌────┬───────────┬────────────────┐
│ id │ name      │ email          │
├────┼───────────┼────────────────┤
│ 1  │ Alice     │ a@example.com  │
│ 2  │ Bob       │ b@example.com  │
└────┴───────────┴────────────────┘

orders:
┌────┬─────────────┐
│ id │ customer_id │
├────┼─────────────┤
│ 1  │ 1           │
│ 2  │ 1           │
│ 3  │ 2           │
└────┴─────────────┘

products:
┌────┬─────────┐
│ id │ name    │
├────┼─────────┤
│ 1  │ Widget  │
│ 2  │ Gadget  │
│ 3  │ Thing   │
└────┴─────────┘

order_items:
┌──────────┬────────────┐
│ order_id │ product_id │
├──────────┼────────────┤
│ 1        │ 1          │
│ 1        │ 2          │
│ 2        │ 3          │
│ 3        │ 1          │
└──────────┴────────────┘
```

Benefits:
- Each piece of data stored once
- Easy to update (change Alice's email in one place)
- Can query products independently
- Maintains data integrity

Normalization has levels (1NF, 2NF, 3NF). The key idea: don't repeat yourself. Store each fact once, reference it elsewhere.

## SQL: The Language of Relational Databases

SQL (Structured Query Language) is how you talk to relational databases. It's declarative - you describe what you want, not how to get it.

Basic SQL operations:

```sql
-- Create a table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert data
INSERT INTO users (username, email)
VALUES ('alice', 'alice@example.com');

-- Query data
SELECT username, email FROM users WHERE id = 1;

-- Update data
UPDATE users SET email = 'newemail@example.com' WHERE id = 1;

-- Delete data
DELETE FROM users WHERE id = 1;
```

SQL is powerful because the same concepts work across operations:

- `WHERE` filters rows
- `ORDER BY` sorts results
- `JOIN` combines tables
- `GROUP BY` aggregates data

Learn SQL once, use it everywhere. The syntax is similar across all relational databases.

## Understanding How Data Flows

When your application uses a database:

```
Application                PostgreSQL
    │                          │
    │  1. Connection           │
    ├─────────────────────────→│
    │                          │
    │  2. SQL Query            │
    ├─────────────────────────→│
    │                          │  3. Parse & Plan
    │                          │  4. Execute
    │                          │  5. Fetch Data
    │                          │
    │  6. Results              │
    │←─────────────────────────┤
    │                          │
    │  7. More Queries         │
    ├─────────────────────────→│
    │←─────────────────────────┤
    │                          │
    │  8. Close Connection     │
    ├─────────────────────────→│
```

Applications typically:
1. Connect to the database (often using a connection pool)
2. Send SQL queries
3. Process results
4. Close the connection when done

Connection pooling reuses connections instead of creating new ones for each query. This is much faster.

## Common Database Terms

**Schema**: The structure of your database (what tables exist, what columns they have). Also sometimes means a namespace within a database.

**Query**: A request for data (SELECT statement).

**Transaction**: A group of operations that execute together.

**Index**: A data structure for fast lookups.

**Constraint**: A rule enforced by the database (unique emails, non-null usernames).

**View**: A saved query that looks like a table.

**Trigger**: Code that runs automatically when data changes.

**Stored Procedure**: A function stored in the database.

Understanding these fundamentals gives you a foundation for working with PostgreSQL. Next, we'll install PostgreSQL and connect to it, seeing these concepts in practice.
