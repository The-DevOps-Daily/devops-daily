---
title: 'ON CONFLICT DO SELECT: Get-or-Create in One Statement'
navTitle: 'ON CONFLICT DO SELECT'
description: 'PostgreSQL 19 adds INSERT ... ON CONFLICT DO SELECT. How it beats the no-op upsert and the CTE pattern, the race it removes, and what to check before you refactor.'
order: 6
---

**TLDR**: `INSERT ... ON CONFLICT (key) DO SELECT RETURNING ...` inserts a row, or returns the existing one if the key is taken, in one atomic statement. On 19.0 it ran 2.2 times faster than the no-op upsert (`DO UPDATE SET col = EXCLUDED.col`) and 1.6 times faster than the CTE fallback, and wrote 32 bytes of WAL per call against 1,015 for the upsert. It also removes the race where the CTE pattern returns zero rows for a key that exists. Before you refactor, check `UPDATE` triggers, the `SELECT` privilege, and how your code detects that a row was created.

Get-or-create appears wherever a row is keyed by something the caller already knows: users by email, tags by name, idempotency keys by request ID. Until 19, PostgreSQL offered two workarounds, each with a cost. PostgreSQL 19 adds a third arm to `ON CONFLICT` ([release notes](https://www.postgresql.org/docs/19/release-19.html), [`INSERT`](https://www.postgresql.org/docs/19/sql-insert.html)):

```sql
CREATE TABLE users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO users (email)
VALUES ('ada@example.com')
ON CONFLICT (email) DO SELECT
RETURNING id, email, created_at;
```

The first call inserts the row. The second call finds the conflict and returns the same row:

```text
 id |      email      |          created_at
----+-----------------+-------------------------------
  1 | ada@example.com | 2026-11-20 21:30:04.370047+00
```

## Prerequisites

- A PostgreSQL 19 server.
- `pgbench` for the benchmark. It ships with the server and is in the Docker image.

## The Two Old Workarounds

**The no-op upsert** uses `DO UPDATE` only so that `RETURNING` sees the row:

```sql
INSERT INTO users (email)
VALUES ('ada@example.com')
ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
RETURNING id;
```

It is race-free. The cost is hidden: `SET email = EXCLUDED.email` is a real `UPDATE`. PostgreSQL writes a new row version, logs it to WAL, fires `UPDATE` triggers, and leaves the old version for pruning and vacuum, even though nothing changed.

**The CTE fallback** tries the insert and falls back to a select:

```sql
WITH ins AS (
  INSERT INTO users (email)
  VALUES ('ada@example.com')
  ON CONFLICT (email) DO NOTHING
  RETURNING id
)
SELECT id FROM ins
UNION ALL
SELECT id FROM users WHERE email = 'ada@example.com'
LIMIT 1;
```

No dead tuples, but under concurrency it can return zero rows. The race section below shows it.

## What DO SELECT Does

On conflict, plain `DO SELECT` returns the existing row through `RETURNING`. It does not update the row, write a new row version, or lock the row. Because it uses the same speculative insertion as the other `ON CONFLICT` arms, there is no race window, and because the conflict check already found the row, there is no second lookup.

Some details checked on 19.0:

- **`RETURNING` is required.** `INSERT ... ON CONFLICT (email) DO SELECT;` without it fails with `ERROR:  ON CONFLICT DO SELECT requires a RETURNING clause`.
- **Sequences and defaults still run.** Identity values, defaults and `BEFORE INSERT` triggers are evaluated before the conflict check, so every call uses a sequence value even when it returns an existing row. In our test, eight calls for the same email returned the same row, and `users_id_seq` was at 8 with one user in the table.
- **A `WHERE` clause filters the returned row.** `... DO SELECT WHERE false RETURNING id` returned zero rows for an existing key.

If you will update the row later in the same transaction, lock it as you select it:

```sql
INSERT INTO users (email)
VALUES ('ada@example.com')
ON CONFLICT (email) DO SELECT FOR UPDATE
RETURNING id;
```

`FOR NO KEY UPDATE`, `FOR SHARE` and `FOR KEY SHARE` also work, with their usual lock strength.

### Was the Row Created?

The command tag says `INSERT 0 1` whether the statement inserted a row or returned an existing one, so drivers and ORMs that count affected rows cannot tell. The old `RETURNING (xmax = 0) AS inserted` trick from the `DO UPDATE` world does not work either. Plain `DO SELECT` does not touch `xmax`, so on 19.0 `RETURNING id, xmax` for an existing row returned `xmax = 0`, which the trick would read as "inserted".

The reliable way is the `old` row alias in `RETURNING`. `old` is all NULLs for a freshly inserted row and holds the existing row on conflict:

```sql
INSERT INTO users (email)
VALUES ('carol@example.com')
ON CONFLICT (email) DO SELECT
RETURNING id, (old.id IS NULL) AS inserted;
```

The first call returns `inserted = t`. The same statement again returns the same `id` with `inserted = f`.

## Benchmark: Three Patterns

The setup is a `users` table with 1,000,000 rows. Each `pgbench` client picks a random key from a range 10% wider than the table, so about 91% of calls hit a conflict at the start, rising as the run inserts the missing keys:

```sql
DROP TABLE IF EXISTS users CASCADE;
CREATE TABLE users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO users (email) SELECT 'user' || g || '@example.com' FROM generate_series(1, 1000000) g;
VACUUM ANALYZE users;
ALTER TABLE users SET (autovacuum_enabled = false);
```

The three `pgbench` scripts, saved as `upsert.sql`, `cte.sql` and `doselect.sql`:

```text
\set n random(1, 1100000)
INSERT INTO users (email) VALUES ('user' || :n || '@example.com')
ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
RETURNING id;
```

```text
\set n random(1, 1100000)
WITH ins AS (
  INSERT INTO users (email) VALUES ('user' || :n || '@example.com')
  ON CONFLICT (email) DO NOTHING
  RETURNING id
)
SELECT id FROM ins
UNION ALL
SELECT id FROM users WHERE email = 'user' || :n || '@example.com'
LIMIT 1;
```

```text
\set n random(1, 1100000)
INSERT INTO users (email) VALUES ('user' || :n || '@example.com')
ON CONFLICT (email) DO SELECT
RETURNING id;
```

We rebuilt the table and ran `CHECKPOINT` before each pattern, then ran it with four clients:

```bash
pgbench -U postgres -d lab -n -c 4 -j 2 -T 30 -f doselect.sql
```

WAL is the change in `pg_current_wal_lsn()` across the run, so it includes the new rows each pattern inserted. Results on 19.0, in a 2-CPU container, 30 seconds per pattern:

| Pattern                                 | Throughput | Row updates | Dead tuples after | WAL     | WAL per call |
| --------------------------------------- | ---------- | ----------- | ----------------- | ------- | ------------ |
| `DO UPDATE SET email = EXCLUDED.email`  | 5,564 tps  | 152,823     | 26,744            | 170 MB  | 1,015 B      |
| CTE with `DO NOTHING` + fallback select | 7,532 tps  | 0           | 0                 | 8.0 MB  | 35 B         |
| `DO SELECT`                             | 12,219 tps | 0           | 0                 | 11.9 MB | 32 B         |

The earlier measurements agree. On 19 beta 3, in a 1.5-CPU container with 60-second runs, the three patterns ran at 2,855, 3,700 and 5,422 tps. On an 8 vCPU NVMe droplet with a 5-million-row table and 16 clients, they ran at 14,963, 27,725 and 42,060 tps, and the upsert wrote 962 bytes of WAL per call against 31 for `DO SELECT`. All of these are single runs.

What the numbers say:

- **The no-op upsert writes about 30 times the WAL per call**, for the same returned data. That is WAL your standbys replay and your archive stores. We measured only WAL volume, not replica lag or checkpoint I/O.
- **The dead-tuple count understates the churn.** The upsert run made 152,823 row updates, 134,075 of them HOT, but only 26,744 dead tuples were left at the end. Page pruning cleaned up most of them during the run, in the foreground, on the pages the queries were reading.
- **`DO SELECT` beats the CTE at the same WAL per call.** The CTE plans and runs a second query and probes the unique index again for the fallback; `DO SELECT` returns the row the conflict check already found.

## The Race the CTE Pattern Loses

A statement runs with one snapshot. If another transaction inserted the key but has not committed when your statement starts, your `DO NOTHING` waits for it, sees the conflict once it commits, and skips the insert. But the committed row is not in your statement's snapshot, so the fallback `SELECT` cannot see it either. You get zero rows for a key that exists.

To reproduce it, use two `psql` sessions:

```sql
-- session A: insert the key and keep the transaction open
BEGIN;
INSERT INTO users (email) VALUES ('race1@example.com')
ON CONFLICT (email) DO NOTHING;
```

```sql
-- session B: the CTE pattern, started while A is open
WITH ins AS (
  INSERT INTO users (email) VALUES ('race1@example.com')
  ON CONFLICT (email) DO NOTHING RETURNING id
)
SELECT id FROM ins
UNION ALL
SELECT id FROM users WHERE email = 'race1@example.com'
LIMIT 1;
```

Session B blocks. Run `COMMIT;` in session A, and session B returns:

```text
 id
----
(0 rows)
```

The same test with `DO SELECT` and a new key:

```sql
-- session A
BEGIN;
INSERT INTO users (email) VALUES ('race2@example.com')
ON CONFLICT (email) DO NOTHING;
```

```sql
-- session B
INSERT INTO users (email) VALUES ('race2@example.com')
ON CONFLICT (email) DO SELECT RETURNING id, email;
```

After `COMMIT;` in session A, session B returns the committed row:

```text
 id |       email
----+-------------------
 20 | race2@example.com
```

## Isolation Levels: One Rule Did Not Change

Under `REPEATABLE READ`, `DO SELECT` follows the same rule as `DO UPDATE`. If the conflicting row was committed after your transaction took its snapshot, PostgreSQL refuses to return a row your snapshot cannot see:

```sql
BEGIN ISOLATION LEVEL REPEATABLE READ;
SELECT count(*) FROM users;
-- another session now inserts and commits 'race3@example.com'
INSERT INTO users (email) VALUES ('race3@example.com')
ON CONFLICT (email) DO SELECT RETURNING id;
ROLLBACK;
```

```text
ERROR:  could not serialize access due to concurrent update
```

If your get-or-create runs above `READ COMMITTED`, keep the retry loop for serialization failures. `DO SELECT` removes the zero-row race, not snapshot isolation. A `SERIALIZABLE` bug on this path, where a missing predicate lock let an anomaly commit without an error, was fixed before 19.0, and the fix was also back-patched for `DO NOTHING` and `DO UPDATE`. We did not retest `SERIALIZABLE` ourselves.

## What to Refactor

**Worth refactoring:**

- **No-op upserts**: any `ON CONFLICT ... DO UPDATE SET col = EXCLUDED.col` that exists only to make `RETURNING` work.
- **CTE get-or-create**: you remove the zero-row race and the retry code written for it.
- **Fetch-or-create followed by an update** in the same transaction: use `DO SELECT FOR UPDATE`.

**Leave alone:**

- **Real upserts.** If the `DO UPDATE` arm changes data (`SET last_seen = now()`, counters, merged payloads), it is doing its job. `DO SELECT` never changes the existing row.

## What to Check Before You Ship

- **Triggers.** On 19.0 we put a `BEFORE INSERT` row trigger, a `BEFORE UPDATE` row trigger and an `AFTER INSERT` statement trigger on `users`. On the conflict path, the no-op upsert fired all three. `DO SELECT` fired only the two `INSERT` triggers. Audit triggers, `updated_at` triggers and sync triggers keyed to updates stop firing on conflict after a refactor.
- **Privileges.** `DO SELECT` needs `SELECT` on the table. A role with only `INSERT` got `ERROR:  permission denied for table users`. The locking variants also need `UPDATE`: with `INSERT` and `SELECT` only, `DO SELECT FOR UPDATE` failed the same way. (So did `DO NOTHING` with a conflict target, which also reads the table.) Check the grants of roles that were trimmed to exactly what a statement needed.
- **Views and row-level security.** Through an automatically updatable view, a conflicting row that the view's `WHERE` hides raises an error instead of being returned. On 19.0, inserting through a view `WHERE email LIKE '%@example.com'` a key that existed in the table as `dave@other.org` gave `ERROR:  conflicting row is not visible through view "example_users"`. With row-level security, the existing row is checked against the `SELECT` policies (and the `UPDATE` policies for the locking variants), and a row that fails raises an error. These checks came with two security fixes in RC2 (CVE-2026-16237 and CVE-2026-120154). The no-op upsert raises the same errors for those rows, but the CTE fallback returns zero rows instead, so refactoring a CTE on a view or a table with policies turns an empty result into an error.
- **"Was it created?" logic.** Use `RETURNING (old.id IS NULL)`, not the command tag or `xmax`.
- **Version gates.** `ON CONFLICT DO SELECT` is a syntax error before 19. If a codebase supports several PostgreSQL versions, gate the new SQL on `server_version_num >= 190000`.

Idempotency keys are a common use. Our post on [how Stripe avoids double charging](/posts/how-stripe-avoids-double-charging-idempotency-keys) shows the get-or-create pattern behind them, and the [concurrency and race conditions quiz](/quizzes/concurrency-and-race-conditions-quiz) tests the snapshot rules from this part.

The next part covers another SQL addition that replaces a workaround: [COPY TO JSON](/guides/postgresql-19-field-notes/07-copy-to-json).
