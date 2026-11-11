---
title: 'We Gave an AI Agent a read_only Neon Role. Here Is What It Blocked'
excerpt: 'A Neon read_only role blocked every INSERT, UPDATE, DELETE and schema change we sent, and the Neon MCP Server with a pinned role stopped every durable write. What still ran comes from standard Postgres defaults, and the real risk was a read that stalled a migration.'
category:
  name: 'Security'
  slug: 'security'
date: '2026-11-11'
publishedAt: '2026-11-11T12:00:00Z'
updatedAt: '2026-11-11T12:00:00Z'
readingTime: '15 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Neon
  - Postgres
  - MCP
  - AI Agents
  - Database Security
  - Least Privilege
  - Security
---

Teams now connect coding agents to their databases through the Neon MCP Server, and "read-only" is the control they reach for first. We wanted to know what that control stops. We created a `read_only` role with the Neon CLI and ran 40 one-statement probes against a Lakebase Postgres branch in four setups: a direct connection as that role, and three configurations of the Neon MCP Server. **Every `INSERT`, `UPDATE`, `DELETE` and schema change we sent failed in every read-only setup.** Over the direct connection, 23 of the 40 probes still ran, and 9 of them left something behind. Four were durable writes from a role named `read_only`: two rows written through a `SECURITY DEFINER` function (one of them through `EXPLAIN ANALYZE`), a large object, and a setting stored on the role itself. The combination in Neon's docs, the MCP Server's read-only mode with the role pinned, stopped all four.

The bigger risk was not a write. A 15-second read from the agent held a routine `ALTER TABLE` for 11.3 to 12.8 seconds, and all four of the app's writers were stuck behind it, the longest insert for just as long. Sending the same read to a read replica brought the migration down to 0.14 to 0.16 seconds. But nothing in the role or the MCP Server URL puts the agent on that replica: the URL can pin a role, not a compute.

## TLDR

- The Neon MCP Server with `readonly=true` and a pinned `read_only` role stopped every durable write we tried. That is the setup to give an agent.
- Almost everything that still ran over a direct connection comes from standard Postgres defaults granted to `PUBLIC`, not from Neon. The same probes behave the same way on any Postgres, and a few `REVOKE` statements close most of them.
- `neon roles create --access read_only` runs plain SQL as the database owner: `SELECT` on the tables that exist, `USAGE` on the schema, and default privileges for the owner's future tables. It does not touch what Postgres grants to `PUBLIC`.
- Over a direct connection, that role could still create temp tables, call a `SECURITY DEFINER` function that writes, create a large object, change its own role settings, send `NOTIFY`, take advisory locks, and read a signing key from a function body.
- The Neon MCP Server with `readonly=true&roleName=<role>` wraps each statement in a `READ ONLY` transaction and logs in as the pinned role. That blocked every durable write. `NOTIFY`, advisory locks and reading function source still worked.
- `readonly=true` without a role pin runs as the owner. It still cannot write, but it ran `REINDEX`, took an `ACCESS EXCLUSIVE` lock and could read the query text of every other session.
- The incident to plan for is lock queueing. Put agent reads on a read replica and give every migration a `lock_timeout`.

## Prerequisites

- A Neon account and an API key. The demo creates one throwaway project and deletes it at the end.
- Node.js 22 or newer.
- Basic Postgres privileges: roles, `GRANT`, and what `PUBLIC` means.
- A few cents of compute. Neon's consumption history API, which we read after the run, shows 0.39 CU-hours for our whole build, about $0.09 at the Scale list price, including three full runs of the matrix and the runs we threw away. That figure is not one of the repo's stamped results.

## Three layers, three different things

A Neon setup for an agent has three controls, and they work at different levels. Mixing them up is where the surprises in this post come from.

```diagram
{
  "type": "graph",
  "columns": [
    [
      { "id": "agent", "label": "Coding agent", "sub": "MCP client or a connection string", "icon": "cpu", "tone": "slate" }
    ],
    [
      { "id": "direct", "label": "Connection string", "sub": "logs in as agent_ro", "icon": "net", "tone": "amber", "detail": "Setup S1. Each statement is its own autocommit transaction. Only the role's privileges apply." },
      { "id": "mcp", "label": "Neon MCP Server", "sub": "readonly=true&roleName=agent_ro", "icon": "shield", "tone": "green", "detail": "Setup S3. Every SQL tool logs in as agent_ro. run_sql runs each statement in a READ ONLY transaction, and run_sql_transaction is not offered." }
    ],
    [
      { "id": "ro", "label": "READ ONLY transaction", "sub": "a Postgres transaction mode", "icon": "lock", "tone": "blue", "detail": "Blocks INSERT, UPDATE, DELETE, CREATE, ALTER, DROP and large object writes. Does not block NOTIFY, advisory locks, LOCK TABLE, REINDEX or SET." }
    ],
    [
      { "id": "role", "label": "Role privileges", "sub": "what --access read_only granted", "icon": "shield", "tone": "violet", "detail": "SELECT on the tables, USAGE on the schema, CONNECT on the database. PUBLIC still holds TEMP on the database and EXECUTE on functions." }
    ],
    [
      { "id": "db", "label": "Lakebase Postgres", "sub": "branch compute", "icon": "database", "tone": "violet" }
    ]
  ],
  "edges": [
    ["agent", "direct"],
    ["agent", "mcp"],
    ["mcp", "ro", "each run_sql"],
    ["ro", "role"],
    ["direct", "role", "autocommit"],
    ["role", "db"]
  ]
}
```

### The read_only role is SQL that the CLI runs

`--access` is a feature of the Neon CLI (8.18.0 and newer) and of `@neon/sdk`, not a field of the REST API, whose role request has only a name and a `no_login` flag. For a scoped role, the SDK connects as the database owner and creates the role with SQL, in one transaction. The role starts as `NOLOGIN` with a throwaway password, Neon's API then sets the real password, and only then does the SDK turn on login. This is the list from `roleAccessStatements()` in `@neon/sdk`, with our names filled in:

```sql
CREATE ROLE "agent_ro" NOLOGIN PASSWORD '<bootstrap>';
GRANT CONNECT ON DATABASE "neondb" TO "agent_ro";
GRANT USAGE ON SCHEMA "app" TO "agent_ro";
GRANT SELECT ON ALL TABLES IN SCHEMA "app" TO "agent_ro";
ALTER DEFAULT PRIVILEGES FOR ROLE "neondb_owner" IN SCHEMA "app"
  GRANT SELECT ON TABLES TO "agent_ro";
-- after Neon replaces the bootstrap password:
ALTER ROLE "agent_ro" LOGIN;
```

Without `--schema`, the schema is `public`. Without `--access`, the role joins `neon_superuser`, which is admin on every database. The SDK's own comment states the limit that matters later: default privileges "cover tables the owner creates later, not tables other roles own".

This is the real run. The CLI prints the new role's password, and our script drops that field before anything is written:

```terminal
{
  "title": "neon CLI 9.3.2",
  "steps": [
    { "cmd": "npx -y neon@9.3.2 roles create --project-id shy-bread-81087327 --branch br-green-rain-bdgi2170 --database neondb --name agent_ro --access read_only --schema app --output json", "output": "{\n  \"branch_id\": \"br-green-rain-bdgi2170\",\n  \"name\": \"agent_ro\",\n  \"protected\": false,\n  \"authentication_method\": \"password\",\n  \"created_at\": \"2026-11-11T07:44:31Z\",\n  \"updated_at\": \"2026-11-11T07:44:31Z\"\n}" }
  ]
}
```

The catalog afterwards matches the list exactly: no role memberships, `SELECT` on every table in `app`, one default ACL for the owner's future tables. The line that explains several results below is the database ACL, `=Tc/neondb_owner`. The empty name before `=` is `PUBLIC`, and `Tc` is `TEMPORARY` and `CONNECT`. Postgres grants those to every role by default, and it grants `EXECUTE` on new functions to `PUBLIC` too. The CLI does not revoke either, and it should not have to: changing database-wide defaults is not what "create a role" means.

### readonly=true wraps each statement in a READ ONLY transaction

On the hosted Neon MCP Server, `readonly=true` (or the older `x-read-only` header) makes `run_sql` send the agent's statement through the Neon serverless driver as a one-statement transaction with `readOnly: true`. Postgres then refuses writes with SQLSTATE `25006`. The server also removes `run_sql_transaction` in this mode, because several caller statements in one shared transaction could end the read-only transaction early. In our runs, the read-only connection listed 59 tools and did not include `run_sql_transaction`. The `read_write` connection listed 140.

`READ ONLY` is a transaction mode, not a privilege boundary. The Postgres docs list what it blocks: data changes, `CREATE`, `ALTER` and `DROP`, `COMMENT`, `GRANT`, `REVOKE`, `TRUNCATE`, and `EXPLAIN ANALYZE` or `EXECUTE` of any of those. They call it "a high-level notion of read-only that does not prevent all writes to disk". The list does not mention `NOTIFY`, advisory locks, `LOCK TABLE`, `REINDEX` or `SET`.

### roleName pins every SQL tool to one role

`roleName=agent_ro` on the server URL makes every SQL tool log in as that role. There is no fallback: a `role_name` argument that names another role is refused, and with a pin in place the server also refuses to create scoped roles, because that runs SQL as the owner. The pin covers SQL only, so Neon's docs suggest combining it with `readonly=true` and `category` to limit the Management API tools as well. The same page says: "We recommend MCP for development and testing only, not production environments."

One gap in the controls: `run_sql` also takes a `compute_id`. In the server source, the URL options are `readonly`, `category`, `projectId` and `roleName`, so a compute cannot be pinned there. The agent chooses whether to read from the primary or from a replica, and your configuration cannot make it use the replica.

## The probe matrix

We seeded a small fake SaaS database (500 customers, 5,000 orders, 10,098 order items, an audit log, a `SECURITY DEFINER` function that writes to it, and a function with a fake webhook signing key in its body). Then we ran 40 probes in four setups:

- **S1**: a direct connection as `agent_ro`, what an agent gets if you hand it a connection string.
- **S2**: the Neon MCP Server with `readonly=true` and no role pin, so it runs as the owner.
- **S3**: `readonly=true&roleName=agent_ro`, the combination Neon's docs show.
- **S4**: `roleName=agent_rw`, a `--access read_write` role with writes on, as a baseline.

The MCP probes go through the hosted server with the MCP SDK client and an API key, the same calls an agent makes. No model is involved, so every probe is exactly the statement we wrote.

Each probe declared its expected result for each setup before the run: allowed, or denied with an exact SQLSTATE. A result that did not match was a harness failure, not a pass. After each probe, an owner connection checked for a trace: a new row in the audit log, a new large object, a new role setting, or a `NOTIFY` that a listening session received. Temp tables and session advisory locks were checked inside the probe's own session on the direct connection.

The final run matched its declared expectations in all 160 probe-runs. Two earlier complete runs are kept in `results/discarded/`, and `scripts/compare-matrix-runs.mjs` shows that all three agree on every probe's result in all four setups: allowed or refused, the SQLSTATE, and the trace.

```chart
{
  "type": "bar",
  "title": "40 probes per setup: not blocked, and how many left a trace",
  "unit": " probes",
  "tickLabel": "left a trace",
  "caption": "Bars: probes that ran without an error. Ticks: probes that left a trace (a durable write, a temp table or advisory lock, or a NOTIFY another session received). In S2 to S4, temp-table and advisory-lock traces are inferred from a successful call. Final run, Lakebase Postgres 18, aws-us-east-2.",
  "rows": [
    { "label": "S1 direct, read_only role", "value": 23, "tick": 9, "series": "direct" },
    { "label": "S2 MCP readonly, no role pin", "value": 21, "tick": 3, "series": "MCP" },
    { "label": "S3 MCP readonly + roleName", "value": 18, "tick": 3, "series": "MCP" },
    { "label": "S4 MCP read_write role", "value": 27, "tick": 8, "series": "write baseline" }
  ],
  "series": [
    { "name": "direct", "color": "#f59e0b" },
    { "name": "MCP", "color": "#10b981" },
    { "name": "write baseline", "color": "#94a3b8" }
  ]
}
```

Here is every probe. `ok` means it ran, `ok*` means it ran and left a trace, and a code means it was refused with that SQLSTATE. Durable writes and `NOTIFY` were checked from an owner session in every setup. Temp tables and advisory locks were checked inside the session only on the direct connection (S1). In S2 to S4 those two marks are inferred from a successful call.

| Probe                                                              | S1 direct  | S2 no pin   | S3 pin     | S4 rw      |
| ------------------------------------------------------------------ | ---------- | ----------- | ---------- | ---------- |
| `INSERT`, `UPDATE`, `DELETE` a row                                 | 42501      | 25006       | 25006      | ok         |
| `TRUNCATE`                                                         | 42501      | 25006       | 25006      | 42501      |
| `CREATE TABLE`, `ALTER TABLE`, `DROP INDEX`                        | 42501      | 25006       | 25006      | 42501      |
| `nextval()`                                                        | 42501      | 25006       | 42501      | ok         |
| `setval()`                                                         | 42501      | 25006       | 42501      | 42501      |
| `CREATE TEMP TABLE` (2 probes)                                     | ok*        | 25006       | 25006      | ok*        |
| `SECURITY DEFINER` function that writes                            | ok*        | 25006       | 25006      | ok*        |
| Same, through `EXPLAIN ANALYZE`                                    | ok*        | 25006       | 25006      | ok*        |
| `lo_from_bytea()` large object                                     | ok*        | 25006       | 25006      | ok*        |
| `ALTER ROLE agent_ro SET statement_timeout = 0`                    | ok*        | 25006       | 25006      | 42501      |
| `NOTIFY`, `pg_notify()` (2 probes)                                 | ok*        | ok*         | ok*        | ok*        |
| `pg_advisory_lock()`                                               | ok*        | ok*         | ok*        | ok*        |
| Other advisory lock calls (3 probes)                               | ok         | ok          | ok         | ok         |
| `LOCK TABLE ... ACCESS SHARE`                                      | 25P01      | ok          | ok         | 25P01      |
| `LOCK TABLE ... ACCESS EXCLUSIVE`                                  | 25P01      | ok          | 42501      | 25P01      |
| `SELECT ... FOR UPDATE`                                            | 42501      | 25006       | 25006      | ok         |
| Function body with the signing key (`pg_proc.prosrc`)              | ok         | ok          | ok         | ok         |
| Customer emails, role list, settings (4 probes)                    | ok         | ok          | ok         | ok         |
| Other sessions' query text                                         | ok, 0 rows | ok, 11 rows | ok, 0 rows | ok, 0 rows |
| `SET statement_timeout = 0`, `SET work_mem`, `RESET ALL`, `LISTEN` | ok         | ok          | ok         | ok         |
| `generate_series` sum over 2 million rows                          | ok         | ok          | ok         | ok         |
| `SET ROLE neondb_owner`                                            | 42501      | ok          | 42501      | 42501      |
| `pg_read_file()`, `pg_ls_dir()`                                    | 42501      | 42501       | 42501      | 42501      |
| `CREATE EXTENSION`                                                 | 42501      | 25006       | 25006      | 42501      |
| `REINDEX TABLE`                                                    | 42501      | ok          | 42501      | 42501      |

### What the direct connection left open

S1 is the case to worry about, because a connection string is the easiest thing to give an agent and the hardest to take back. The role blocked what it was built to block: every row write, every schema change, sequences, `SELECT ... FOR UPDATE`, and every route to more privilege (`SET ROLE`, server files, extensions). Most of the 23 probes that ran are reads and session settings that a read-only role is expected to allow.

The nine traces are the interesting part:

- **Four durable writes.** `app.record_touch()` is a `SECURITY DEFINER` function owned by the owner, and `PUBLIC` can execute it. Calling it wrote a row to `app.audit_log` with no table privilege at all. `EXPLAIN ANALYZE` runs the statement it explains, so the same call through `EXPLAIN` wrote a second row. `lo_from_bytea()` created a large object, which needs no grant by default. And `ALTER ROLE agent_ro SET statement_timeout = 0` stored a setting on the role in the catalog, where it applies to every future session of that role.
- **Three session effects.** Two temp tables (one filled with 100 order IDs) and a session-level advisory lock. They disappear when the session ends, but a long-lived agent session can hold an advisory lock that blocks your app's own locks for as long as it likes.
- **Two signals.** `NOTIFY` and `pg_notify()` reached a session that was listening on the channel. If your app uses `LISTEN` for job queues or cache invalidation, a read-only agent can trigger it.

There was also one disclosure without a trace: the function body with `signing_key text := 'whsec_demo_...'` came back from `pg_proc.prosrc`. Postgres makes the `pg_proc` catalog readable by every role by default, so a secret in a function body is readable by any role that can connect. Ours came back in all four setups.

None of this is a Neon bug. Each item is standard Postgres behavior: `PUBLIC` holds `TEMP` on the database and `EXECUTE` on functions by default, a large object needs no grant, the `NOTIFY` statement needs no privilege, and `pg_notify()` and the advisory-lock functions run on the `EXECUTE` that `PUBLIC` holds on built-in functions. It took a `SECURITY DEFINER` function in our schema to turn `EXECUTE` into a write, and many real schemas have one. The role does what it says on the label; it just does not say "sandbox".

### What the MCP read-only mode closed, and what it did not

S3 refused all four durable writes and both temp tables with `25006`. The pinned role kept the privilege checks too: `nextval()`, `ACCESS EXCLUSIVE` and `SET ROLE` failed with `42501` before the read-only check ran. Three traces remained. The two `NOTIFY` probes reached our listening session. `pg_advisory_lock()` succeeded, and since that function returns only once it holds the lock, the lock was taken. We did not observe it from another session, because each `run_sql` call is a separate request to the MCP Server and we had no way to look while it was held.

The function body with the signing key came back in S3 as well.

### Without a role pin, readonly=true runs as the owner

S2 shows why Neon pairs `readonly=true` with `roleName`. Without a pin, the server logs in as the database owner, and only the transaction mode stands between the agent and your data. It still refused every `INSERT`, `UPDATE`, `DELETE` and schema change we sent, and all four probes that wrote durably over the direct connection. But as the owner, the agent could run `REINDEX TABLE`, take an `ACCESS EXCLUSIVE` lock and `SET ROLE` to the owner. The owner is also a member of `pg_read_all_stats`, so `pg_stat_activity` showed it the query text of every other client session, the app's and the `read_only` agent's included. Our probe counted 11 visible rows for other sessions, some of them background processes with no query. The direct `read_only` role saw none. Query text often holds literal values: emails in a `WHERE` clause, tokens in an `INSERT`.

### We got 9 predictions wrong

Our first runs disagreed with our declared expectations in 9 cells. Each disagreement is a small lesson about Postgres:

- `LOCK TABLE` needs a transaction block. As a single autocommit statement, on the direct connection or the `read_write` MCP connection, it fails with `25P01`. The read-only MCP wrapper supplies the transaction, so there it runs, and the privilege decides.
- `REINDEX` is not on the list a `READ ONLY` transaction blocks, so the owner ran it in S2.
- The order of checks differs by statement. With the pinned role, `nextval()` fails the privilege check (`42501`) first, while `CREATE EXTENSION` fails the read-only check (`25006`) first.
- `SELECT ... FOR UPDATE` takes row locks, so `READ ONLY` refuses it even for the owner.

We changed the predictions, never the outcomes, and the reason for each is a comment in `lib/probes.mjs`. Two other mismatches were harness bugs: a `DELETE` that hit a foreign key, and an `INSERT` that collided with a row from the previous run. We fixed the probe and added cleanup, and neither one hid a result.

## Incident one: a read that stalls a migration

A read takes an `ACCESS SHARE` lock on every table it touches and holds it until its transaction ends. `ALTER TABLE ... ADD COLUMN` needs `ACCESS EXCLUSIVE`, so it waits for the read. Then Postgres queues every new lock request on that table behind the waiting `ALTER`, including the app's ordinary inserts. The agent never writes anything, and your app still stops writing.

The setup: four app writers insert into `app.orders` through the pooled connection string, one insert per writer every 50 ms. At 2 seconds the agent runs a 15-second read on `app.orders` through `run_sql` (S3). At 4 seconds the owner runs `ALTER TABLE app.orders ADD COLUMN note text` without a `lock_timeout`. A direct owner connection samples `pg_locks` every 250 ms. We ran three variants three times each:

| Variant                                       | Migration                   | Longest app insert | Inserts over 1 s | Backends waiting | Inserts completed |
| --------------------------------------------- | --------------------------- | ------------------ | ---------------- | ---------------- | ----------------- |
| Agent reads on the primary                    | 11.32 to 12.80 s            | 11.29 to 12.70 s   | 4 per run        | 5                | 104 to 124        |
| Agent reads on a read replica                 | 0.14 to 0.16 s              | 0.17 to 0.51 s     | 0                | 0                | 350 to 378        |
| Primary, migration with `lock_timeout = '2s'` | gave up at 2.13 s (`55P03`) | 2.02 to 2.10 s     | 4 per run        | 5                | 331 to 357        |

Ranges are over three runs of each variant. With nothing in the way, one insert took 128 to 167 ms at the median, which is the round trip from our test machine to aws-us-east-2 through the pooler. "Backends waiting" is the most lock requests on `app.orders` that `pg_locks` showed as not yet granted: the `ALTER` and all four app writers.

```chart
{
  "type": "bar",
  "title": "Longest app insert while the agent's 15-second read ran",
  "unit": "s",
  "tickLabel": "migration time",
  "caption": "Median of 3 runs per variant. Bars: longest single insert from 4 app writers. Ticks: how long the ALTER TABLE took (or waited before lock_timeout gave up). Lakebase Postgres 18, aws-us-east-2.",
  "rows": [
    { "label": "Agent reads on the primary", "value": 12.39, "tick": 12.43, "series": "primary" },
    { "label": "Migration with lock_timeout 2s", "value": 2.09, "tick": 2.13, "series": "lock_timeout" },
    { "label": "Agent reads on a read replica", "value": 0.17, "tick": 0.16, "series": "replica" }
  ],
  "series": [
    { "name": "primary", "color": "#ef4444" },
    { "name": "lock_timeout", "color": "#f59e0b" },
    { "name": "replica", "color": "#10b981" }
  ]
}
```

The replica fix works because a read replica is a separate compute: a lock taken there is not a lock on the primary. It moves the conflict, it does not remove it. The `ALTER` still has to be replayed on the replica, where it waits for the agent's read or cancels it. In all 3 replica runs, the agent's read finished without being cancelled.

`lock_timeout` is the fix on the migration side. The `ALTER` gave up after 2.1 seconds with `55P03` instead of holding the app for 12.8, and the migration tool can retry. The app still waited about 2 seconds, which is the price of finding out. This is the same advice as in [rehearsing migrations on a Neon branch](/posts/rehearse-migrations-on-a-neon-branch): every migration should set a `lock_timeout`.

Our first version of this test got the incident wrong. The app writers inserted into a side table, not `app.orders`, so their latency during the stall matched the baseline and the run seemed to show that only the migration waited. The migration numbers were right, the app numbers measured the wrong table. That run is kept in `results/discarded/` in the repo.

## Incident two: one heavy read is cheap, and nothing bounds a loop

The role does not limit how much a read may scan. We gave the agent one legal heavy read: a parallel scan of a 2-million-row, 137 MB table with a chain of 20 `md5()` calls per row. It ran through the MCP Server as `agent_ro`, first on the primary, allowed to autoscale from 0.25 to 4 CU, and then on a read replica capped at 1 CU. An owner connection on the same compute read `num_cpus()` from the `neon_utils` extension about once a second.

| Compute                    | Read time | Peak vCPU | vCPU-seconds, at most | Scale cost, at most | Launch cost, at most |
| -------------------------- | --------- | --------- | --------------------- | ------------------- | -------------------- |
| Primary, 0.25 to 4 CU      | 25.8 s    | 2         | 32.84                 | $0.00203            | $0.00097             |
| Read replica, 0.25 to 1 CU | 29.2 s    | 1         | 31.71                 | $0.00196            | $0.00093             |

The primary reported 1 vCPU for most of the read and 2 vCPU only in the last four samples, about a second apart. `num_cpus()` rounds up to a whole vCPU, so a compute at 0.25 CU reports 1. That makes these figures an upper bound: we multiply by Neon's list price of $0.222 per CU-hour on Scale ($0.106 on Launch) and assume every "1" was a full CU. We did not use the consumption API, because it lags a run by minutes.

So one heavy read costs a fraction of a cent, and the capped replica was about 3 seconds slower for about the same cost. That is not the risk. The risk is that nothing in the role bounds how often the agent runs that read or how long a session stays open. The matrix showed that the agent can run `SET statement_timeout = 0`, and on the direct connection it can store that on its own role. An agent that polls also keeps the compute from suspending; we measured that effect in [what keeps a Neon compute awake](/posts/what-keeps-a-neon-compute-awake). A capped replica for agents bounds the size of the compute, and a role-level `statement_timeout` bounds the common case, as long as you remember that the session can lower it.

## Drift: when the role stops matching your schema

A `read_only` role is a snapshot of the grants at the moment it was created. Two ordinary changes moved the schema away from it. Both failed closed, which is the safe direction, but both are the kind of thing that ends with someone granting more than they meant to.

1. **A table created by another role.** Many teams run migrations as a separate role. We created a `migrator` role and had it create `app.migrator_table`. `agent_ro` got `42501 permission denied`, because the default privileges from `--access read_only` are `FOR ROLE neondb_owner`: they cover the owner's new tables and nobody else's. After `ALTER DEFAULT PRIVILEGES FOR ROLE migrator IN SCHEMA app GRANT SELECT ON TABLES TO agent_ro`, the migrator's next table was readable. The table it had already created still returned `42501`, because default privileges apply only to objects created after them. You need both the default privileges for the migration role and a one-time `GRANT` for what already exists.
2. **A new schema.** `app2.secrets` returned `42501 permission denied for schema app2`, because the role was created with `--schema app`. An agent that cannot see a schema may report that the data does not exist, which is a wrong answer rather than a leak. Pass `--schema` once per schema, or re-run the grants when you add one.

## Hardening, then the re-run

This is the hardening we applied as the owner, from `schema/harden.sql`:

```sql
-- TEMP and EXECUTE are PUBLIC defaults; take them back for everyone
-- and grant them only to the roles that run the app.
REVOKE TEMPORARY ON DATABASE neondb FROM PUBLIC;
GRANT TEMPORARY ON DATABASE neondb TO neondb_owner, agent_rw;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA app
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.record_touch(text) TO neondb_owner, agent_rw;

-- Bounds for the agent role. These are defaults: a session can still
-- change statement_timeout with SET.
ALTER ROLE agent_ro CONNECTION LIMIT 5;
ALTER ROLE agent_ro SET statement_timeout = '30s';
ALTER ROLE agent_ro SET lock_timeout = '2s';
ALTER ROLE agent_ro SET idle_in_transaction_session_timeout = '15s';
```

Revoking `TEMPORARY` from `PUBLIC` affects every role that relied on the default, not only the agent, so grant it back to the roles that need it before you run this in production. The same goes for `EXECUTE`.

Then we ran S1 and S3 again. On the direct connection, four probes flipped from allowed to `42501`: both temp tables, the `SECURITY DEFINER` write and its `EXPLAIN ANALYZE` twin. That took S1 from 23 probes that ran to 19, and from four durable writes to two. The two that stayed open have no grant to revoke: `lo_from_bytea()` still created a large object, and `ALTER ROLE agent_ro SET statement_timeout = 0` still ran. `NOTIFY`, the advisory locks and the function body with the signing key were unchanged too: the `NOTIFY` statement needs no privilege, the hardening revoked `EXECUTE` only in the `app` schema and not on built-in functions such as `pg_notify()` and `pg_advisory_lock()`, and `pg_proc` stays readable.

On the pinned MCP connection, nothing opened or closed. The `READ ONLY` wrapper already refused everything the hardening addresses, and the only difference was the error: the `SECURITY DEFINER` calls now failed with `42501` (no `EXECUTE`) instead of `25006`, because the privilege check runs first.

So the hardening matters for the connection-string case, and it is not enough on its own there. The two durable writes it cannot close are why a connection string is weaker than the same role behind the read-only MCP Server. One note on the re-run: the probe runner clears the role's `statement_timeout` before it starts, so the 30-second default was not in place during the re-run. No probe depends on it.

## What we could not conclude

- **One region, one Postgres version, one schema.** Lakebase Postgres 18 in aws-us-east-2, a small fake schema. A schema with more functions, extensions or roles has more `PUBLIC` defaults to check.
- **The pooled connection string was not probed.** Our direct probes used the unpooled host. Through the pooler (PgBouncer in transaction mode), session effects such as `SET`, temp tables and session advisory locks behave differently, because a session does not keep one backend.
- **No escape attempts.** We probed what single statements can do. We did not try to get around the `READ ONLY` wrapper or the role pin, beyond checking that `run_sql_transaction` is gone and that `SET ROLE` is refused.
- **No model in the loop.** The probes are what a careless or misled agent could send, not what a given model chooses to send.
- **Small samples for the incidents.** Three runs per lock variant, one run per compute for cost. The direction is clear, but the exact seconds are not a benchmark. The cost figures are upper bounds because `num_cpus()` rounds up.

## What to do

1. Give agents the MCP Server with `readonly=true&roleName=<a read_only role>`, not a connection string. In our runs that combination stopped every durable write.
2. If an agent must have a connection string, revoke `TEMPORARY` and `EXECUTE` from `PUBLIC` in the app's schemas first, and keep secrets out of function bodies.
3. Keep agent reads on a read replica, and set a `lock_timeout` in every migration. A lock taken on the replica is not a lock on the primary, and `lock_timeout` makes a migration give up after a set time, so the writes queued behind it wait at most that long. The MCP URL cannot pin a compute, so the replica takes agent instructions that pass its `compute_id`, or your own layer in front of the database. We did not run the probe matrix on a replica.
4. Re-check grants after migrations that a different role runs, and pass `--schema` for every schema the agent should read.

## Run it yourself

```github
https://github.com/The-DevOps-Daily/neon-read-only-agent
```

The repository has one script per stage, and each stage writes JSON lines to `results/`, stamped with a hash of the code that produced them. `npm run verify-stamps` checks every file against the commit in `results/STAMPED_AT`.

```bash
cp .env.example .env      # add a Neon API key
npm install
npm test                  # offline tests, no database
npm run project           # one throwaway project, Postgres 18
npm run seed              # fake orders schema and data
npm run roles             # neon roles create --access read_only / read_write
npm run matrix            # 40 probes x 4 setups
npm run lock-stall        # incident one
npm run cost              # incident two
npm run drift
npm run harden
npm run rerun             # S1 and S3 again after hardening
npm run summarize
npm run verify-stamps
npm run teardown          # deletes the project
```

The run is cheap: the incident stages are a few minutes of a 0.25 CU compute, and the cost stage briefly allows 4 CU. Run `teardown` when you are done, because the read replica and the primary both count toward CU-hours while they are awake.
