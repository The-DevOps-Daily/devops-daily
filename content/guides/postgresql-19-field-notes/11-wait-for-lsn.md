---
title: 'Read-Your-Writes on Standbys with WAIT FOR LSN'
description: 'PostgreSQL 19 adds the WAIT FOR LSN command: a read on a standby can wait until it has replayed the user last write. The pattern, the timeouts, and the rules that reject it.'
order: 11
---

**TLDR**: A user saves something, the next page reads from an asynchronous standby that has not replayed the write yet, and the row is missing. PostgreSQL 19 adds `WAIT FOR LSN '...'`, which blocks until the standby has replayed up to a given WAL position. The writer captures its LSN after commit and passes it along; the reader runs the wait before its query. On a caught-up standby the wait took about 0.3 to 0.8 ms on 19.0. Always set `TIMEOUT`, and run the wait as the first statement, outside any lock or snapshot.

Teams handle stale reads on standbys (read replicas) in a few ways: send reads that follow a write to the primary, poll `pg_last_wal_replay_lsn()` in application code, or set `synchronous_commit = remote_apply` so commits wait for the standby to replay them. The last one makes every commit pay for reads that may never happen.

PostgreSQL 19 adds the [`WAIT`](https://www.postgresql.org/docs/19/sql-wait.html) command, written `WAIT FOR LSN ...` ([release notes](https://www.postgresql.org/docs/19/release-19.html)). The read that needs fresh data pays for it, and only that read.

```text
WAIT FOR LSN 'lsn' [ WITH ( option [, ...] ) ]

option: MODE 'mode' | TIMEOUT 'timeout' | NO_THROW
mode:   standby_replay | standby_write | standby_flush | primary_flush
```

The default mode is `standby_replay`: return once the standby has replayed WAL up to the target, so a query run after it sees the data. This part uses that mode.

## Prerequisites

- A PostgreSQL 19 primary and a streaming standby. With Docker:

```bash
docker network create pg19net
echo 'echo "host replication all all scram-sha-256" >> "$PGDATA/pg_hba.conf"' > hba.sh
docker run -d --name pg19p --network pg19net \
  -v "$PWD/hba.sh:/docker-entrypoint-initdb.d/hba.sh" \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=lab postgres:19
docker run -d --name pg19s --network pg19net -e PGPASSWORD=postgres \
  --user postgres --entrypoint bash postgres:19 \
  -c 'until pg_isready -h pg19p -q; do sleep 1; done; pg_basebackup -h pg19p -U postgres -D /var/lib/postgresql/19/docker -R -X stream && exec postgres -D /var/lib/postgresql/19/docker'
```

The `hba.sh` script runs once during the primary's first start and allows replication connections. The standby container waits until the primary accepts TCP connections, copies it with `pg_basebackup`, and starts. `-R` writes the connection settings and `standby.signal`, so the second container starts as a standby. Its log shows `started streaming WAL from primary`. For a production setup, see [Backup, Recovery, and Replication](/guides/introduction-to-postgres/09-backup-and-recovery).

## Reproduce the Stale Read

On the primary, create a table:

```sql
CREATE TABLE notes (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, body text);
```

On the standby, pause replay to stand in for replication lag, and confirm it paused (`pg_wal_replay_pause()` only requests the pause):

```sql
SELECT pg_wal_replay_pause();
SELECT pg_get_wal_replay_pause_state();
```

```text
 pg_get_wal_replay_pause_state
-------------------------------
 paused
```

On the primary, write and capture the position of the write:

```sql
INSERT INTO notes (body) VALUES ('hello from primary');
SELECT pg_current_wal_insert_lsn();
```

```text
 pg_current_wal_insert_lsn
---------------------------
 0/03037028
```

On the standby, the immediate read is the bug your users report:

```sql
SELECT count(*) FROM notes WHERE body = 'hello from primary';
```

```text
 count
-------
     0
```

## The Fix in One Statement

Run the wait first, with a timeout:

```sql
WAIT FOR LSN '0/03037028' WITH (MODE 'standby_replay', TIMEOUT '2s');
```

While the standby is behind, it says so, with both positions:

```text
ERROR:  timed out while waiting for target LSN 0/03037028 to be replayed; current standby_replay LSN 0/03036EA0
```

With `NO_THROW`, a timeout is a result row instead of an error, which is easier to branch on in application code:

```sql
WAIT FOR LSN '0/03037028' WITH (MODE 'standby_replay', TIMEOUT '2s', NO_THROW);
```

```text
 status
---------
 timeout
```

Resume replay on the standby and wait again:

```sql
SELECT pg_wal_replay_resume();
WAIT FOR LSN '0/03037028' WITH (MODE 'standby_replay', TIMEOUT '2s');
SELECT count(*) FROM notes WHERE body = 'hello from primary';
```

The wait returned `success` in 0.3 ms on 19.0, and the count was 1.

## The Application Pattern

1. After a write commits on the primary, the writer runs `SELECT pg_current_wal_insert_lsn()` and returns the LSN with its response, for example in a session or a response header.
2. A later read that must see that write runs `WAIT FOR LSN '<lsn>' WITH (TIMEOUT '...', NO_THROW)` on the standby, then its query, on the same connection.
3. On `success`, read from the standby. On `timeout`, read from the primary or retry. On `not in recovery`, you are not on a standby, or it was promoted, possibly before it received the write. That is a failover, not a successful wait: the write may be lost, so drop the LSN and let your failover policy decide what the user sees.

Reads without an LSN skip the wait. That is the difference from `remote_apply`: the cost lands only on requests that carry a write to see.

## What It Costs

With the standby caught up and a two-client `pgbench` write load on the primary, five waits on fresh LSNs took 0.55, 0.61, 0.78, 0.61 and 0.66 ms on 19.0 (two containers on one host). Beta 3 gave 0.54 to 0.74 ms in the same setup. By design, the wait costs the replay gap at that moment plus a fraction of a millisecond, so the number to study on your systems is the distribution of replay lag under load.

We also timed 30-commit batches on beta 3 with `synchronous_commit` set to `remote_apply` (4.7 ms), `on` (4.5 ms) and `off` (19.5 ms). One batch per setting cannot rank them, so we report those only as recorded.

## Rules That Reject the Wait

Each of these is from 19.0.

**Only on a standby.** `standby_replay`, `standby_write` and `standby_flush` need a server in recovery. On the primary:

```text
ERROR:  recovery is not in progress
HINT:  Waiting for the standby_replay LSN can only be executed during recovery.
```

With `NO_THROW`, the primary returns `not in recovery` instead. Because the default mode is `standby_replay`, a bare `WAIT FOR LSN '...'` on the primary fails the same way. `primary_flush` is the mode that runs on a primary: it waits until the primary has flushed WAL to that position, and returned `success` there.

**No snapshot.** The transaction must not hold a snapshot. At `READ COMMITTED`, every statement takes a new one, so this rule does not get in the way (the lock rule below still can). At `REPEATABLE READ` or `SERIALIZABLE`, it works only before the first query, whether or not the target has been reached:

```sql
BEGIN ISOLATION LEVEL REPEATABLE READ;
SELECT 1;
WAIT FOR LSN '0/03037028' WITH (MODE 'standby_replay', TIMEOUT '2s');
ROLLBACK;
```

```text
ERROR:  WAIT cannot be executed while the current transaction holds a snapshot
DETAIL:  This transaction runs at an isolation level higher than READ COMMITTED, so it holds a snapshot from its first query until it ends.
```

With the wait as the first statement of a `REPEATABLE READ` transaction, it returned `success` and the next query saw the row. That order makes sense anyway: a snapshot taken before the wait could not see the new row. A cursor or an exported snapshot blocks the wait at any level.

**No locks.** A session that holds a lock cannot wait for replay that has not happened yet, because replay could end up waiting for that session. To see the error, pause replay again and use a new target from the primary:

```sql
BEGIN;
LOCK TABLE notes IN ACCESS SHARE MODE;
WAIT FOR LSN '0/03037028' WITH (MODE 'standby_replay', TIMEOUT '1s', NO_THROW);
ROLLBACK;
```

```text
ERROR:  cannot wait for a standby LSN while holding locks
DETAIL:  This session holds a lock on relation 16386 of database 16384, which could make recovery wait for this session while this session waits for recovery.
HINT:  Release the locks, or execute WAIT before acquiring them.
```

`NO_THROW` does not turn this into a status. A wait whose target has already been replayed returns `success` even while the session holds locks, so the error shows up only when the standby is behind, which is exactly when you need the wait. A lock taken by an earlier statement stays until the transaction ends, so run the wait outside a transaction block or as its first statement.

**Top level only.** It cannot run in a function, procedure or `DO` block:

```text
ERROR:  WAIT can only be executed as a top-level statement
DETAIL:  WAIT cannot be used within a function, procedure, or DO block.
```

Put it in application code.

## Rules You Have to Enforce Yourself

- **Always set `TIMEOUT`.** Without it, a wait on a stalled standby holds the request and its pool slot until the stall ends, unless a statement or request timeout catches it.
- **LSNs have no timeline check.** The comparison is numeric. An LSN from before a failover, or from another cluster, can satisfy a wait without meaning what you think. Keep LSN tokens scoped to one primary, and drop them on promotion.
- **Wait and read on the same standby.** A wait that succeeded on one standby says nothing about another. With transaction pooling across several standbys, PgBouncer can send two autocommit statements to different servers. Put the wait and the read in one explicit `READ COMMITTED` transaction, with the wait first, and continue only after `success`.
- **Keep exception handling** for recovery conflicts and other errors that `NO_THROW` does not cover.

One fix in RC2 matters for the timeout you choose. A physical WAL sender could miss a wakeup and sleep with flushed WAL still unsent until something else woke it, about ten seconds in the reported case. During such a stall, a two-second wait times out on a healthy standby. The fix is in 19.0 and was back-patched to 16, so if you measured a long tail of replay lag on an older minor release, measure again.

## What to Do When You Upgrade

1. Find the places where your application sends reads to the primary only because of replication lag. Those are the candidates.
2. Return the commit LSN from the write path, and add the wait, with a timeout and a fallback to the primary, to the read path.
3. Monitor replay lag on the standbys (`pg_stat_replication` on the primary) and the share of waits that time out.
4. Test failover: promote a standby and check that the application drops old LSN tokens.

That is the last part of the guide. For the upgrade itself, go back to [PostgreSQL 19 Is Out: What to Check Before You Upgrade](/posts/postgresql-19-upgrade-checklist), and to test your understanding of replication lag and consistency, try the [distributed systems fundamentals quiz](/quizzes/distributed-systems-fundamentals-quiz).
