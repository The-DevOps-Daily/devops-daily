---
title: 'Zero-Downtime Database Migrations for PostgreSQL in Production'
excerpt: 'A single ALTER TABLE can take down a busy PostgreSQL database for minutes. This post shows why that happens and how to ship schema changes safely with lock timeouts, the expand-and-contract pattern, and copy-paste SQL recipes for indexes, columns, constraints, and type changes.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-06-01'
publishedAt: '2026-06-01T09:00:00Z'
updatedAt: '2026-06-01T09:00:00Z'
readingTime: '13 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - postgresql
  - database-migrations
  - zero-downtime
  - devops
  - sql
---

It is 2am. A deploy goes out that adds an index to the `orders` table. The migration looks harmless:

```sql
CREATE INDEX idx_orders_customer ON orders (customer_id);
```

Thirty seconds later the on-call phone goes off. The API is returning 500s. The connection pool is maxed out. Every request that touches `orders` is hanging. The database is up, CPU is fine, but nothing is moving.

What happened is that `CREATE INDEX` without `CONCURRENTLY` takes a lock that blocks every write to the table for the entire build. On a 40 million row table that build takes minutes, and during those minutes every `INSERT`, `UPDATE`, and `DELETE` on `orders` waits in line. The web workers hold their database connections while they wait, the pool drains, and now even reads that have nothing to do with `orders` cannot get a connection.

That is a self-inflicted outage from one line of SQL. This post is about how to never ship that line again.

## TL;DR

- A plain `ALTER TABLE` or `CREATE INDEX` takes a heavy lock. If it has to wait behind a slow query, it blocks every other query behind it too. One stuck statement stalls the whole table.
- Always set `lock_timeout` (and `statement_timeout`) before schema changes so a migration fails fast instead of queueing and taking the table down.
- Use `CREATE INDEX CONCURRENTLY` for indexes. It does not block writes.
- Use the **expand-and-contract** pattern for anything that changes existing columns: add the new shape, backfill, switch the app, then drop the old shape in a later deploy.
- Add constraints with `NOT VALID` first, then `VALIDATE CONSTRAINT` separately. The validation step does not block reads or writes.
- Backfill large tables in small batches that each commit, never one giant `UPDATE`.

## Prerequisites

- PostgreSQL 12 or newer. Most of this works on 11, but a few shortcuts (like skipping a table scan when setting `NOT NULL`) need 12+.
- A database you can connect to with `psql` and a role that can run DDL.
- Some way to deploy application code separately from migrations. The expand-and-contract pattern needs at least two deploys.
- A staging database with production-like row counts. Lock behavior that is instant on 1,000 rows is a 4-minute outage on 40 million.

## Why a "simple" migration takes down production

PostgreSQL uses table-level locks for schema changes. The two that bite people most:

- `CREATE INDEX` (without `CONCURRENTLY`) takes a `SHARE` lock. Reads still work, but every write to the table blocks until the index finishes building.
- Most forms of `ALTER TABLE` take an `ACCESS EXCLUSIVE` lock. That blocks everything, reads included, for as long as the statement runs.

For something like adding a column, the `ACCESS EXCLUSIVE` lock is held only for a moment, because on PostgreSQL 11+ adding a column with a constant default is a metadata change. So why do people still get outages from a fast `ALTER TABLE`?

The answer is the lock queue, and it is the part most people miss.

When your `ALTER TABLE` asks for an `ACCESS EXCLUSIVE` lock and some long-running `SELECT` is already holding an `ACCESS SHARE` lock on the table, your `ALTER TABLE` has to wait. That is fine on its own. The problem is that while it waits, it sits at the front of the lock queue, and every new query that needs a conflicting lock now queues behind it. A plain `SELECT` needs `ACCESS SHARE`, which conflicts with the pending `ACCESS EXCLUSIVE`, so the `SELECT` waits too.

So the chain is: one slow analytics query holds a read lock, your instant `ALTER TABLE` queues behind it, and then every normal query on that table queues behind your `ALTER TABLE`. The table is frozen until the slow query finishes, even though your schema change would have taken 5 milliseconds.

You can watch it happen. Open a second session during a migration and run:

```sql
SELECT pid, state, wait_event_type, left(query, 60) AS query
FROM pg_stat_activity
WHERE wait_event_type = 'Lock'
ORDER BY query_start;
```

```text
  pid  |        state        | wait_event_type |                           query
-------+---------------------+-----------------+------------------------------------------------------------
 18442 | active              | Lock            | ALTER TABLE orders ADD COLUMN region text
 18455 | active              | Lock            | SELECT * FROM orders WHERE id = $1
 18460 | active              | Lock            | SELECT * FROM orders WHERE id = $1
 18471 | active              | Lock            | UPDATE orders SET status = $1 WHERE id = $2
```

Three normal queries stuck behind one `ALTER TABLE` that is itself stuck behind something else. That is your outage.

## Always set a lock timeout

This is the single highest-value habit. Before any schema change, tell PostgreSQL to give up if it cannot get the lock quickly:

```sql
SET lock_timeout = '3s';
SET statement_timeout = '0';  -- keep this off for long index builds

ALTER TABLE orders ADD COLUMN region text;
```

Now if the lock is not available within 3 seconds, the migration fails instead of queueing:

```text
ERROR:  canceling statement due to lock timeout
```

A failed migration is annoying. A frozen production table is an incident. The failed migration is the outcome you want, because it means the table kept serving traffic the entire time. You retry the migration later, ideally when no long-running query is holding the table.

Set this in your migration tool, not by hand. Most frameworks let you configure it. For raw SQL files, put the `SET lock_timeout` line at the top of every migration. Some teams set it in `postgresql.conf` for the migration role so it cannot be forgotten.

One caveat: `lock_timeout` only covers the wait to acquire the lock. A `CREATE INDEX CONCURRENTLY` that runs for 10 minutes is not affected, because it is doing work, not waiting. That is fine. The danger is the waiting, not the working.

## Build indexes concurrently

Never build an index on a live table without `CONCURRENTLY`:

```sql
-- Wrong: blocks all writes for the whole build
CREATE INDEX idx_orders_customer ON orders (customer_id);

-- Right: writes keep working
CREATE INDEX CONCURRENTLY idx_orders_customer ON orders (customer_id);
```

`CONCURRENTLY` scans the table twice and takes longer, but it does not block reads or writes. The tradeoffs you need to know:

- It cannot run inside a transaction block. Many migration tools wrap every migration in a transaction by default. You have to turn that off for this migration (Rails has `disable_ddl_transaction!`, others have similar flags).
- If it fails partway, it leaves an invalid index behind. This is the gotcha that surprises people.

A common failure is building a unique index on data that turns out not to be unique:

```text
ERROR:  could not create unique index "idx_users_email"
DETAIL:  Key (email)=(jane@example.com) is duplicated.
```

The build failed, but PostgreSQL did not clean up after itself. You now have a leftover index marked invalid. Find it:

```sql
SELECT indexrelid::regclass AS index, indrelid::regclass AS table
FROM pg_index
WHERE NOT indisvalid;
```

```text
        index        |  table
---------------------+---------
 idx_users_email     | users
```

Drop it (also concurrently, so the drop does not block writes either) and fix your data before retrying:

```sql
DROP INDEX CONCURRENTLY idx_users_email;
```

## The expand-and-contract pattern

Indexes are the easy case. The hard case is changing a column that the application already reads and writes. Renaming a column, changing its type, making it `NOT NULL`, or splitting it into two columns all break the running application the instant the schema changes, because the old code still expects the old shape.

The fix is to never change a column in place while code depends on it. You split the change across multiple deploys. This is the expand-and-contract pattern, sometimes called parallel change.

```text
  Deploy 1: EXPAND     Deploy 2: MIGRATE      Deploy 3: CONTRACT
  add new shape        backfill + dual-write   drop old shape
  (additive only)      switch reads to new     (additive removal)

  old col ───────────────────────────────────────► dropped
  new col      ◄──── added ───────► written ──────► sole source
```

The rule that makes it safe: every individual deploy is backward compatible with the code that is still running. At no point does new schema require new code or new code require new schema.

Say you want to rename `users.name` to `users.full_name`. A plain `ALTER TABLE ... RENAME COLUMN` breaks every running instance of the old code that still selects `name`. Do this instead:

**Deploy 1 (expand).** Add the new column. Nothing reads it yet.

```sql
SET lock_timeout = '3s';
ALTER TABLE users ADD COLUMN full_name text;
```

Update the application to write to both columns on every insert and update. Reads still come from `name`.

**Deploy 2 (migrate).** Backfill the existing rows (see the batching section below), then switch reads to `full_name`. Now both columns are kept in sync and the app reads the new one.

**Deploy 3 (contract).** Once you are sure no running code reads `name`, drop it:

```sql
SET lock_timeout = '3s';
ALTER TABLE users DROP COLUMN name;
```

Three deploys to rename a column feels like a lot. It is also the difference between a routine change and a customer-facing outage. The same pattern handles type changes (add `id_bigint`, backfill, swap), splitting columns, and moving data between tables.

## Adding a NOT NULL column safely

Adding a nullable column is cheap. Making a column `NOT NULL` is where people get caught, because a naive `SET NOT NULL` scans the whole table under an `ACCESS EXCLUSIVE` lock.

Do it in steps. First add the column nullable and backfill it. Then add a `CHECK` constraint as `NOT VALID`, which is instant because it only applies to new rows:

```sql
ALTER TABLE users ADD COLUMN email_verified boolean;

-- backfill here (see next section), then:

SET lock_timeout = '3s';
ALTER TABLE users
  ADD CONSTRAINT users_email_verified_not_null
  CHECK (email_verified IS NOT NULL) NOT VALID;
```

Now validate it in a separate statement. `VALIDATE CONSTRAINT` scans the table, but it takes only a `SHARE UPDATE EXCLUSIVE` lock, which allows reads and writes to continue:

```sql
ALTER TABLE users VALIDATE CONSTRAINT users_email_verified_not_null;
```

On PostgreSQL 12+ you can then promote it to a real `NOT NULL` and PostgreSQL skips the table scan, because the validated `CHECK` already proves no nulls exist:

```sql
ALTER TABLE users ALTER COLUMN email_verified SET NOT NULL;
ALTER TABLE users DROP CONSTRAINT users_email_verified_not_null;
```

The same `NOT VALID` then `VALIDATE` trick works for foreign keys. Adding a foreign key normally locks both tables while it checks every existing row. Split it:

```sql
ALTER TABLE orders
  ADD CONSTRAINT orders_customer_fk
  FOREIGN KEY (customer_id) REFERENCES customers (id) NOT VALID;

ALTER TABLE orders VALIDATE CONSTRAINT orders_customer_fk;
```

## Backfill in small, committing batches

When you backfill a column on a large table, do not run one big `UPDATE`. A single `UPDATE users SET email_verified = false WHERE email_verified IS NULL` on 40 million rows holds locks for the whole run, builds a huge transaction, and bloats the table with dead rows that vacuum has to clean up later.

Batch it. Each batch updates a few thousand rows and commits, so transactions stay short and other queries keep moving. A stored procedure with `COMMIT` inside the loop (PostgreSQL 11+) is the cleanest copy-paste version:

```sql
CREATE PROCEDURE backfill_email_verified()
LANGUAGE plpgsql AS $$
DECLARE
  affected integer;
BEGIN
  LOOP
    UPDATE users
    SET email_verified = false
    WHERE id IN (
      SELECT id FROM users
      WHERE email_verified IS NULL
      LIMIT 5000
    );
    GET DIAGNOSTICS affected = ROW_COUNT;
    EXIT WHEN affected = 0;  -- nothing left to update
    COMMIT;                  -- commit each batch, release locks
  END LOOP;
END;
$$;

CALL backfill_email_verified();
```

If the backfill is putting too much load on the database, add a small `PERFORM pg_sleep(0.1)` before the `COMMIT` to slow it down. Five thousand rows per batch is a reasonable starting point. Tune it based on row size and how much replication lag you can tolerate, because every batch ships to your replicas too.

When the backfill finishes, drop the procedure:

```sql
DROP PROCEDURE backfill_email_verified;
```

## A migration checklist before you ship

Run through this before any production migration:

- Does every statement set `lock_timeout`?
- Is every index built with `CONCURRENTLY`, outside a transaction block?
- Does any statement rewrite or scan a large table while holding `ACCESS EXCLUSIVE`? If so, split it with `NOT VALID` plus `VALIDATE`, or move to expand-and-contract.
- Is the migration backward compatible with the code currently running? It has to be, because old and new code run side by side during a deploy.
- Did you test it against a staging database with production-like row counts and a long-running query in another session to trigger the lock queue?

## Next steps

Pick your worst offender and fix it this week. Grep your migration history for `CREATE INDEX` without `CONCURRENTLY` and for `ADD COLUMN ... NOT NULL`. Those two patterns cause most of the outages.

Then make the safe path the default so people do not have to remember it:

- Set `lock_timeout` in `postgresql.conf` (or per-role) for the account your migrations run as, so a forgotten `SET` does not cost you an outage.
- Add a linter to CI that fails the build on unsafe DDL. If you use Rails, the [strong_migrations](https://github.com/ankane/strong_migrations) gem flags these patterns before they merge. Django, Flyway, and Liquibase have similar checks or plugins. For raw SQL, [squawk](https://github.com/sbdchd/squawk) lints migration files directly.
- Put a slow query holding a read lock into your staging test suite so a missing `lock_timeout` shows up before production does.

The goal is not to memorize every lock level. It is to make the table stay online no matter what a migration does. Set the timeout, build concurrently, expand before you contract, and backfill in batches. Do those four things and the 2am index that took down `orders` becomes a migration that fails loudly in staging and ships quietly to production.

Sources:
- [PostgreSQL: Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html)
- [PostgreSQL: ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)
- [PostgreSQL: CREATE INDEX (CONCURRENTLY)](https://www.postgresql.org/docs/current/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY)
