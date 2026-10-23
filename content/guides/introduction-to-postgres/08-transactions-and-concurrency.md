---
title: Transactions and Concurrency Control
description: 'PostgreSQL transactions explained: BEGIN, COMMIT and ROLLBACK, savepoints, isolation levels, MVCC, row locks, SKIP LOCKED queues and deadlocks.'
order: 8
---

**TLDR**: Group statements that must succeed or fail together between `BEGIN` and `COMMIT`. After an error, PostgreSQL rejects every statement until you roll back. Thanks to MVCC, readers never block writers. The default isolation level, Read Committed, is right for most work; use Repeatable Read or Serializable when a transaction's decisions depend on data that others might change, and retry on serialization errors. Lock rows with `SELECT ... FOR UPDATE`, build job queues with `SKIP LOCKED`, take locks in a consistent order to avoid deadlocks, and keep transactions short.

A database with one user is easy. Real applications have hundreds of sessions reading and writing the same rows at once, and servers that crash at the worst moment. Transactions are how PostgreSQL keeps data correct in both cases. This part covers how they behave, how PostgreSQL isolates concurrent sessions, and the locking patterns you need for counters, queues and money transfers.

## Prerequisites

- SQL basics from [Part 3](/guides/introduction-to-postgres/03-sql-basics-and-crud) and constraints from [Part 5](/guides/introduction-to-postgres/05-data-types-and-constraints).
- A scratch database (`CREATE DATABASE bank;` then `\c bank`), and two `psql` windows connected to it for the examples that show two sessions.

The single-session examples below are real `psql` output from PostgreSQL 18.6. The two-session examples show the standard behavior and messages; run them in two windows to see them yourself.

## What Are Transactions?

A transaction is a group of statements that PostgreSQL treats as one unit: either all of their changes become visible and permanent, or none do.

```sql
CREATE TABLE accounts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner text NOT NULL UNIQUE,
  balance numeric(12, 2) NOT NULL CHECK (balance >= 0)
);

INSERT INTO accounts (owner, balance) VALUES ('alice', 500.00), ('bob', 100.00);
```

Move 100 from Alice to Bob. Without a transaction, a crash between the two updates would destroy money:

```terminal
{
  "title": "a transfer",
  "prompt": "bank=#",
  "steps": [
    {
      "cmd": "BEGIN;",
      "output": "BEGIN"
    },
    {
      "prompt": "bank=*#",
      "cmd": "UPDATE accounts SET balance = balance - 100 WHERE owner = 'alice';",
      "output": "UPDATE 1"
    },
    {
      "prompt": "bank=*#",
      "cmd": "UPDATE accounts SET balance = balance + 100 WHERE owner = 'bob';",
      "output": "UPDATE 1"
    },
    {
      "prompt": "bank=*#",
      "cmd": "COMMIT;",
      "output": "COMMIT"
    },
    {
      "cmd": "SELECT owner, balance FROM accounts ORDER BY id;",
      "output": " owner | balance\n-------+---------\n alice |  400.00\n bob   |  200.00\n(2 rows)"
    }
  ]
}
```

Until `COMMIT`, other sessions still see the old balances. After `COMMIT`, they see both changes at once, never just one.

## Basic Transaction Commands

| Command                      | What it does                              |
| ---------------------------- | ----------------------------------------- |
| `BEGIN`                      | Start a transaction                       |
| `COMMIT`                     | Make all changes permanent and visible    |
| `ROLLBACK`                   | Throw all changes away                    |
| `SAVEPOINT name`             | Mark a point you can roll back to         |
| `ROLLBACK TO SAVEPOINT name` | Undo the changes made after the savepoint |

Without `BEGIN`, `psql` runs every statement in its own transaction and commits it automatically (**autocommit**). Drivers differ: node-postgres also autocommits each query, while psycopg opens a transaction implicitly and waits for you to call `commit()`. Check what yours does.

### Rollback on Error

When a statement fails inside a transaction, PostgreSQL marks the whole transaction as failed. It ignores every further statement, and `COMMIT` turns into a rollback:

```terminal
{
  "title": "an aborted transaction",
  "prompt": "bank=#",
  "steps": [
    {
      "cmd": "BEGIN;",
      "output": "BEGIN"
    },
    {
      "prompt": "bank=*#",
      "cmd": "INSERT INTO accounts (owner, balance) VALUES ('carol', 50);",
      "output": "INSERT 0 1"
    },
    {
      "prompt": "bank=*#",
      "cmd": "INSERT INTO accounts (owner, balance) VALUES ('carol', 75);",
      "output": "ERROR:  duplicate key value violates unique constraint \"accounts_owner_key\"\nDETAIL:  Key (owner)=(carol) already exists."
    },
    {
      "prompt": "bank=!#",
      "cmd": "SELECT count(*) FROM accounts;",
      "output": "ERROR:  current transaction is aborted, commands ignored until end of transaction block"
    },
    {
      "prompt": "bank=!#",
      "cmd": "COMMIT;",
      "output": "ROLLBACK"
    },
    {
      "cmd": "SELECT owner FROM accounts ORDER BY id;",
      "output": " owner\n-------\n alice\n bob\n(2 rows)"
    }
  ]
}
```

The `!` in the prompt marks a failed transaction. Carol's first insert was valid, but it is gone: the transaction is all or nothing. Note the reply to `COMMIT`: it says `ROLLBACK`. Application code must check for errors and roll back explicitly instead of assuming the commit worked.

## ACID Properties

Transactions give four guarantees, known as ACID.

### Atomicity

All of a transaction's changes happen, or none do. You saw it above: one failed statement undid Carol's valid insert.

### Consistency

Every committed transaction leaves the data valid according to your constraints. The `CHECK (balance >= 0)` on `accounts` means no transaction can commit a negative balance, whatever the application does.

### Isolation

Concurrent transactions do not see each other's uncommitted changes. How much they can see of each other's _committed_ changes depends on the isolation level, covered below.

### Durability

Once `COMMIT` returns, the change survives a crash or power loss. PostgreSQL first writes every change to the **write-ahead log (WAL)** and flushes the WAL to disk at commit. After a crash, it replays the WAL to restore every committed transaction.

`synchronous_commit = off` makes commits faster by returning before the WAL flush, at the risk of losing the last fraction of a second of commits after a crash (the data stays consistent). It can be set per transaction for data you can afford to lose, such as analytics events.

## How PostgreSQL Isolates Transactions: MVCC

PostgreSQL uses **multiversion concurrency control (MVCC)**. An `UPDATE` does not overwrite a row. It writes a new version of the row and marks the old version as replaced. Each transaction reads the versions that were committed when its **snapshot** was taken. That is why a plain `SELECT` never waits for a writer, and a writer never waits for a plain `SELECT`. (Locking reads such as `SELECT ... FOR UPDATE`, and schema changes that take an exclusive table lock, are the exceptions.)

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "UPDATE", "sub": "a row changes", "icon": "activity", "tone": "blue" },
    { "label": "New version", "sub": "xmin = this transaction", "icon": "box", "tone": "green" },
    { "label": "Old version", "sub": "xmax = this transaction", "icon": "box", "tone": "amber" },
    { "label": "Old snapshots", "sub": "still read the old version", "icon": "activity", "tone": "slate" },
    { "label": "VACUUM", "sub": "frees it when no one needs it", "icon": "gear", "tone": "violet" }
  ]
}
```

You can see the versions through the hidden system columns `ctid` (the physical location), `xmin` (the transaction that created the version) and `xmax` (the transaction that deleted or replaced it):

```terminal
{
  "title": "an update writes a new row version",
  "prompt": "bank=#",
  "steps": [
    {
      "cmd": "SELECT ctid, xmin, xmax, owner, balance FROM accounts WHERE owner = 'alice';",
      "output": " ctid  | xmin | xmax | owner | balance\n-------+------+------+-------+---------\n (0,3) |  754 |    0 | alice |  400.00\n(1 row)"
    },
    {
      "cmd": "UPDATE accounts SET balance = balance + 1 WHERE owner = 'alice';",
      "output": "UPDATE 1"
    },
    {
      "cmd": "SELECT ctid, xmin, xmax, owner, balance FROM accounts WHERE owner = 'alice';",
      "output": " ctid  | xmin | xmax | owner | balance\n-------+------+------+-------+---------\n (0,7) |  756 |    0 | alice |  401.00\n(1 row)"
    }
  ]
}
```

After the update, the row lives at a new location with a new `xmin`. The old version is now a **dead tuple**. `VACUUM`, usually run by autovacuum, reclaims dead tuples once no open snapshot can see them. This is why long-running transactions cause table bloat: they keep old versions alive ([Part 10](/guides/introduction-to-postgres/10-production-best-practices) covers vacuum).

## Isolation Levels

The isolation level decides which snapshot a transaction reads and which anomalies can happen:

| Level                    | Dirty read         | Non-repeatable read | Phantom read       | Serialization anomaly |
| ------------------------ | ------------------ | ------------------- | ------------------ | --------------------- |
| Read Uncommitted         | No (in PostgreSQL) | Possible            | Possible           | Possible              |
| Read Committed (default) | No                 | Possible            | Possible           | Possible              |
| Repeatable Read          | No                 | No                  | No (in PostgreSQL) | Possible              |
| Serializable             | No                 | No                  | No                 | No                    |

The two-session examples below use their own small table, so they do not disturb the accounts data used elsewhere in this part:

```sql
CREATE TABLE stock (
  id integer PRIMARY KEY,
  qty integer NOT NULL CHECK (qty >= 0)
);

INSERT INTO stock VALUES (1, 10), (2, 10);
```

Set the level when you start the transaction:

```sql
BEGIN ISOLATION LEVEL REPEATABLE READ;
-- ...
COMMIT;
```

`SET TRANSACTION` also works, but only inside a transaction block. Outside one it does nothing except print a warning:

```terminal
{
  "title": "SET TRANSACTION needs a transaction",
  "prompt": "bank=#",
  "steps": [
    {
      "cmd": "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;",
      "output": "WARNING:  SET TRANSACTION can only be used in transaction blocks\nSET"
    },
    {
      "cmd": "BEGIN ISOLATION LEVEL REPEATABLE READ;",
      "output": "BEGIN"
    },
    {
      "prompt": "bank=*#",
      "cmd": "SHOW transaction_isolation;",
      "output": " transaction_isolation\n-----------------------\n repeatable read\n(1 row)"
    },
    {
      "prompt": "bank=*#",
      "cmd": "COMMIT;",
      "output": "COMMIT"
    }
  ]
}
```

### Read Uncommitted

PostgreSQL accepts the name but runs the transaction as Read Committed. It never shows uncommitted data.

### Read Committed (Default)

Each **statement** sees the data committed before that statement started. Two `SELECT`s in the same transaction can return different results if another session commits in between (example with two sessions):

```text
-- Session A                                   -- Session B
BEGIN;
SELECT qty FROM stock WHERE id = 1;
-- 10
                                               UPDATE stock SET qty = 7 WHERE id = 1;
                                               -- (autocommit)
SELECT qty FROM stock WHERE id = 1;
-- 7: the second statement sees B's commit
COMMIT;
```

This is fine for most application work, where each statement stands on its own.

### Repeatable Read

The whole **transaction** sees one snapshot, taken at its first statement. Repeated reads return the same data. If the transaction tries to update a row that another session changed after the snapshot, PostgreSQL stops it (example with two sessions):

```text
-- Session A                                   -- Session B
BEGIN ISOLATION LEVEL REPEATABLE READ;
SELECT qty FROM stock WHERE id = 1;
-- 7
                                               UPDATE stock SET qty = 5 WHERE id = 1;
SELECT qty FROM stock WHERE id = 1;
-- 7: still the same snapshot
UPDATE stock SET qty = qty - 1 WHERE id = 1;
-- ERROR:  could not serialize access due to concurrent update
ROLLBACK;
```

Repeatable Read is a good fit for reports that run several queries and need them to agree with each other.

### Serializable

The strongest level. PostgreSQL guarantees that the result is the same as if the committed transactions had run one at a time, in some order. It tracks what each transaction read and aborts one when a conflict could produce a result that no serial order allows:

```text
ERROR:  could not serialize access due to read/write dependencies among transactions
DETAIL:  Reason code: Canceled on identification as a pivot, during commit attempt.
HINT:  The transaction might succeed if retried.
```

The hint is literal: with Repeatable Read and Serializable, your application **must** catch serialization failures (SQLSTATE `40001`) and retry the whole transaction. Serializable is the simplest way to get correct results for complex business rules, such as "a doctor may only go off call if another doctor stays on call", at the cost of more retries under load.

You can change the default per database or per role:

```sql
ALTER DATABASE bank SET default_transaction_isolation = 'repeatable read';
```

## Savepoints

A savepoint lets you undo part of a transaction without losing the rest:

```terminal
{
  "title": "roll back to a savepoint",
  "prompt": "bank=#",
  "steps": [
    {
      "cmd": "BEGIN;",
      "output": "BEGIN"
    },
    {
      "prompt": "bank=*#",
      "cmd": "INSERT INTO accounts (owner, balance) VALUES ('dave', 20);",
      "output": "INSERT 0 1"
    },
    {
      "prompt": "bank=*#",
      "cmd": "SAVEPOINT before_risky_insert;",
      "output": "SAVEPOINT"
    },
    {
      "prompt": "bank=*#",
      "cmd": "INSERT INTO accounts (owner, balance) VALUES ('erin', -5);",
      "output": "ERROR:  new row for relation \"accounts\" violates check constraint \"accounts_balance_check\"\nDETAIL:  Failing row contains (6, erin, -5.00)."
    },
    {
      "prompt": "bank=!#",
      "cmd": "ROLLBACK TO SAVEPOINT before_risky_insert;",
      "output": "ROLLBACK"
    },
    {
      "prompt": "bank=*#",
      "cmd": "COMMIT;",
      "output": "COMMIT"
    },
    {
      "cmd": "SELECT owner, balance FROM accounts ORDER BY id;",
      "output": " owner | balance\n-------+---------\n alice |  401.00\n bob   |  200.00\n dave  |   20.00\n(3 rows)"
    }
  ]
}
```

Dave's insert survived; Erin's failed insert was undone, and the transaction could continue. PostgreSQL has no nested transactions; savepoints are the way to get the same effect. Each savepoint has a cost, so do not create one per row in a large batch.

## Handling Concurrent Access

MVCC handles readers and writers. When two transactions want to **write** the same row, the second one waits until the first commits or rolls back. Under Read Committed, it then re-reads the row and applies its change to the new version.

### Row-Level Locking

Sometimes you must read a row, decide, and then write, without anyone changing it in between. `SELECT ... FOR UPDATE` locks the rows it returns until the transaction ends:

```sql
BEGIN;
SELECT quantity FROM inventory WHERE product_id = 1 FOR UPDATE;
-- Other transactions that try to lock or update this row wait here.
-- The application checks the quantity, then:
UPDATE inventory SET quantity = quantity - 1 WHERE product_id = 1;
COMMIT;
```

Without `FOR UPDATE`, two sessions could both read "1 left" and both sell it.

When the decision fits in one statement, you do not need an explicit lock. This update locks the row only while it runs, and it cannot oversell:

```sql
UPDATE inventory SET quantity = quantity - 1
WHERE product_id = 1 AND quantity > 0;
-- UPDATE 0 means sold out
```

### Lock Types

| Clause              | Blocks                                              | Use it when                               |
| ------------------- | --------------------------------------------------- | ----------------------------------------- |
| `FOR UPDATE`        | All other row locks and updates                     | You will update or delete the row         |
| `FOR NO KEY UPDATE` | Like `FOR UPDATE`, but lets foreign key checks pass | You will update non-key columns           |
| `FOR SHARE`         | Updates and exclusive locks                         | The row must not change while you read it |
| `FOR KEY SHARE`     | Only deletes and key changes                        | Taken by foreign key checks               |

Two modifiers change what happens when a row is already locked:

```sql
-- Fail immediately instead of waiting
SELECT * FROM products WHERE id = 1 FOR UPDATE NOWAIT;

-- Skip locked rows and return the others
SELECT * FROM jobs WHERE status = 'queued' FOR UPDATE SKIP LOCKED LIMIT 10;
```

`SKIP LOCKED` is the building block for job queues: each worker gets different rows instead of waiting for each other (see the pattern below).

### Advisory Locks

Advisory locks lock an arbitrary number that your application chooses, not a row. Use them to make sure only one process runs a task, such as a cron job or a migration:

```terminal
{
  "title": "advisory locks",
  "prompt": "bank=#",
  "steps": [
    {
      "cmd": "SELECT pg_try_advisory_lock(42);",
      "output": " pg_try_advisory_lock\n----------------------\n t\n(1 row)"
    },
    {
      "cmd": "SELECT pg_advisory_unlock(42);",
      "output": " pg_advisory_unlock\n--------------------\n t\n(1 row)"
    }
  ]
}
```

`pg_try_advisory_lock` returns `false` instead of waiting if another session holds the lock. Session-level advisory locks stay until you unlock them or disconnect, even across transactions. The transaction-level variant, `pg_advisory_xact_lock(42)`, releases itself at commit or rollback, so you cannot forget it. Through a connection pooler in transaction mode, use only the transaction-level variant.

## Deadlocks

A deadlock happens when two transactions each wait for a lock the other holds (example with two sessions):

```text
-- Session A                                   -- Session B
BEGIN;
UPDATE stock SET qty = qty - 1 WHERE id = 1;
                                               BEGIN;
                                               UPDATE stock SET qty = qty - 1 WHERE id = 2;
UPDATE stock SET qty = qty + 1 WHERE id = 2;
-- waits for B
                                               UPDATE stock SET qty = qty + 1 WHERE id = 1;
                                               -- waits for A: deadlock
```

After `deadlock_timeout` (1 second by default), PostgreSQL detects the cycle and aborts one of the transactions with an error like this:

```text
ERROR:  deadlock detected
DETAIL:  Process 4242 waits for ShareLock on transaction 1001; blocked by process 4243.
Process 4243 waits for ShareLock on transaction 1000; blocked by process 4242.
HINT:  See server log for query details.
```

The other transaction continues. Handle deadlocks the same way as serialization failures: catch SQLSTATE `40P01` and retry the transaction.

Prevent them by taking locks in the same order everywhere. For a transfer between two accounts, lock both rows in id order before changing either:

```sql
SELECT id, owner FROM accounts WHERE id IN (2, 1) ORDER BY id FOR UPDATE;
```

```text
 id | owner
----+-------
  1 | alice
  2 | bob
(2 rows)
```

(Run inside a transaction, these locks last until `COMMIT`.)

A retry loop in application code looks like this (Python with psycopg 3). The connection must be in autocommit mode, so that `conn.transaction()` starts a new transaction (and a fresh snapshot) on every attempt instead of a savepoint inside an older one:

```python
import psycopg
from psycopg import errors

conn = psycopg.connect("postgresql://app_user@localhost/bank", autocommit=True)

def run_with_retry(conn, work, attempts=5):
    for attempt in range(attempts):
        try:
            with conn.transaction():
                return work(conn)
        except (errors.SerializationFailure, errors.DeadlockDetected):
            if attempt == attempts - 1:
                raise
```

## Long-Running Transactions

Do not keep transactions open while you wait for something else:

```sql
-- Bad: the transaction stays open while a user decides, or an API call runs
BEGIN;
SELECT * FROM orders WHERE id = 42 FOR UPDATE;
-- ... minutes pass ...
UPDATE orders SET status = 'paid' WHERE id = 42;
COMMIT;
```

A long transaction:

- holds its locks, so other sessions queue behind it;
- keeps its snapshot, so `VACUUM` cannot remove any row version that became dead after it started, and tables bloat;
- in the state **idle in transaction**, uses a connection slot while doing nothing.

Do the slow work first, then open a short transaction for the writes. Set timeouts as a safety net, per role or in `postgresql.conf`:

```sql
ALTER ROLE app_user SET idle_in_transaction_session_timeout = '30s';
ALTER ROLE app_user SET statement_timeout = '15s';
ALTER ROLE app_user SET lock_timeout = '5s';
ALTER ROLE app_user SET transaction_timeout = '5min';  -- PostgreSQL 17 and later
```

All four are off (`0`) by default. Find transactions that are open too long:

```sql
SELECT pid, usename, state,
       now() - xact_start AS xact_age,
       left(query, 60) AS last_query
FROM pg_stat_activity
WHERE xact_start IS NOT NULL
ORDER BY xact_start
LIMIT 10;
```

## Practical Transaction Patterns

### Transfer Money

Put the rules in one place. This PL/pgSQL function rejects amounts that are not positive (otherwise a negative amount would move money the wrong way), checks the balance as part of the update, and raises an error when a rule fails. The error aborts the caller's transaction, so a half-done transfer is impossible:

```sql
CREATE FUNCTION transfer(from_id bigint, to_id bigint, amount numeric)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive, got %', amount;
  END IF;

  UPDATE accounts SET balance = balance - amount
  WHERE id = from_id AND balance >= amount;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient funds in account %', from_id;
  END IF;

  UPDATE accounts SET balance = balance + amount WHERE id = to_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'account % does not exist', to_id;
  END IF;
END;
$$;
```

```terminal
{
  "title": "transfers that fail cleanly",
  "prompt": "bank=#",
  "steps": [
    {
      "cmd": "SELECT transfer(1, 2, 50);",
      "output": " transfer\n----------\n\n(1 row)"
    },
    {
      "cmd": "SELECT transfer(2, 1, 10000);",
      "output": "ERROR:  insufficient funds in account 2\nCONTEXT:  PL/pgSQL function transfer(bigint,bigint,numeric) line 10 at RAISE"
    },
    {
      "cmd": "SELECT transfer(1, 99, 10);",
      "output": "ERROR:  account 99 does not exist\nCONTEXT:  PL/pgSQL function transfer(bigint,bigint,numeric) line 15 at RAISE"
    },
    {
      "cmd": "SELECT transfer(1, 2, -50);",
      "output": "ERROR:  amount must be positive, got -50\nCONTEXT:  PL/pgSQL function transfer(bigint,bigint,numeric) line 4 at RAISE"
    },
    {
      "cmd": "SELECT owner, balance FROM accounts ORDER BY id;",
      "output": " owner | balance\n-------+---------\n alice |  351.00\n bob   |  250.00\n dave  |   20.00\n(3 rows)"
    }
  ]
}
```

The last call failed after it had already debited Alice, and the error undid that debit too: her balance shows only the first, successful transfer. `IF NOT FOUND` works only inside PL/pgSQL. In application code, check the row count that the driver returns for each `UPDATE` and roll back when it is zero.

### Process Queue Items

A table-based job queue where many workers can claim jobs at the same time without blocking each other or taking the same job:

```sql
CREATE TABLE jobs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO jobs (payload) VALUES ('{"task": "send_email"}'), ('{"task": "resize_image"}');
```

```sql
UPDATE jobs
SET status = 'running'
WHERE id = (
  SELECT id FROM jobs
  WHERE status = 'queued'
  ORDER BY id
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
RETURNING id, payload;
```

```text
 id |        payload
----+------------------------
  1 | {"task": "send_email"}
(1 row)

UPDATE 1
```

Each worker runs this statement, does the work, and then marks the job `done` (or back to `queued` on failure). Add a partial index on `(id) WHERE status = 'queued'` so claiming stays fast as finished jobs pile up.

### Atomic Counters

A single `UPDATE` is already atomic. Concurrent increments queue on the row lock and none are lost, so no explicit transaction is needed:

```sql
UPDATE page_stats
SET view_count = view_count + 1, updated_at = now()
WHERE page_id = 123;
```

The bug to avoid is read-modify-write in application code: `SELECT view_count`, add one in the app, then `UPDATE ... SET view_count = 43`. Two sessions doing that at once lose an increment.

## Transaction Best Practices

**Keep transactions short.** Read, decide, write, commit. Never wait for user input or a network call inside one.

**Always handle errors.** Roll back on any error, and retry on `40001` and `40P01`.

**Use the default isolation level** unless a transaction's correctness depends on data that others can change between its statements.

**Lock in a consistent order** to avoid deadlocks.

**Prefer single atomic statements** (`UPDATE ... WHERE quantity > 0`, upserts) over read-then-write.

**Index foreign keys.** Deleting a parent row, or changing its key, makes PostgreSQL look up the referencing child rows while holding locks. Without an index on the child column, that lookup is a full table scan.

**Watch for lock waits.** This query shows who is blocked and by whom:

```sql
SELECT pid,
       usename,
       pg_blocking_pids(pid) AS blocked_by,
       wait_event_type,
       left(query, 60) AS query
FROM pg_stat_activity
WHERE cardinality(pg_blocking_pids(pid)) > 0;
```

## Common Mistakes

- **Ignoring errors inside a transaction.** After one error, every statement fails and `COMMIT` rolls back. Check results and roll back explicitly.
- **Not retrying serialization failures and deadlocks.** They are expected under Repeatable Read, Serializable and concurrent locking. Retry the whole transaction.
- **Read-modify-write in application code.** Use a single `UPDATE` with an expression, or `SELECT ... FOR UPDATE`.
- **Long or idle transactions.** They hold locks and block vacuum. Set `idle_in_transaction_session_timeout`.
- **`SET TRANSACTION` before `BEGIN`.** It has no effect. Use `BEGIN ISOLATION LEVEL ...`.
- **Session-level advisory locks behind a transaction-mode pooler.** The lock stays with a server connection that other clients reuse. Use `pg_advisory_xact_lock`.

## Summary

You now know how transactions make a group of statements all-or-nothing, how PostgreSQL's MVCC lets readers and writers work in parallel, what each isolation level guarantees, and how to lock rows, run job queues with `SKIP LOCKED`, and avoid or recover from deadlocks.

Transactions protect data from concurrent sessions and crashes, but not from a dropped table, a bad migration or a failed disk. Next, in [Backup, Recovery, and Replication](/guides/introduction-to-postgres/09-backup-and-recovery), you will make copies you can restore from.
