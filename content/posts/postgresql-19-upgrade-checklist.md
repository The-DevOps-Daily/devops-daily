---
title: 'PostgreSQL 19 Is Out: What to Check Before You Upgrade'
excerpt: 'PostgreSQL 19 removes io_workers and RADIUS, turns JIT off by default, changes how many locks max_locks_per_transaction allows, and makes pg_upgrade refuse some btree_gist indexes. Here is what can stop your upgrade or change behavior after it, with queries to run on your 18 cluster first.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-11-19'
publishedAt: '2026-11-19T15:00:00Z'
updatedAt: '2026-11-19T15:00:00Z'
readingTime: '22 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - PostgreSQL
  - Databases
  - DevOps
  - Upgrades
  - Monitoring
---

PostgreSQL 19.0 was released on 19 November 2026 ([release notes](https://www.postgresql.org/docs/19/release-19.html), [`REL_19_0` tag](https://github.com/postgres/postgres/tree/REL_19_0)). Most of its new features change nothing until you use them: `REPACK`, parallel autovacuum, logical replication of sequences, `WAIT FOR` on standbys. The changes that cause trouble during an upgrade are in one section of the release notes, [Migration to Version 19](https://www.postgresql.org/docs/19/release-19.html#RELEASE-19-MIGRATION), and in a few items elsewhere in the notes. Some of them make `pg_upgrade --check` fail. Some stop the new server from starting. Others change query results, log volume or dashboards after the upgrade is done.

This post sorts those changes by when they affect you. It gives you queries to run on your PostgreSQL 18 cluster now, and it ends with an upgrade path for `pg_upgrade` and for logical replication. Each change links to its release note item or documentation page, so you can check it yourself.

## TLDR

- **pg_upgrade refuses three things:** btree_gist indexes on `inet` or `cidr` columns; database, role or tablespace names that contain a carriage return or line feed; and databases in the `MULE_INTERNAL` encoding. Fix them on 18.
- **The 19 server does not start** if a config file still sets `io_workers` or `escape_string_warning`, sets `standard_conforming_strings = off`, or if `pg_hba.conf` uses `radius`. The same settings stored with `ALTER ROLE ... SET` pass `pg_upgrade --check` and then make the real `pg_upgrade` run fail.
- **Defaults change:** JIT is off, `max_locks_per_transaction` is 128 and a custom value now holds about half as many locks as before, `log_lock_waits` is on, TOAST compression is lz4 where the build has it, and `wal_compression = on` picks zstd first.
- **Results change after the upgrade:** some text search, pg_trgm and fuzzystrmatch indexes need a rebuild, several Snowball stemmers produce different stems, and `JSON_ARRAY(query)` returns `[]` instead of NULL when the query returns no rows.
- **Monitoring queries break** on renamed objects: `pg_stat_subscription_stats.sync_error_count`, the `BufferPin` wait event type and event, and the `BufferContent` wait event.
- **Features pulled before the release** (SQL/PGQ, `FOR PORTION OF`, online checksums, `MERGE`/`SPLIT PARTITION`) are not in 19 at all.

## Prerequisites

- A PostgreSQL 18 cluster you plan to upgrade, and a copy of it to rehearse on
- `psql` and a superuser role (some queries read `pg_authid`, `pg_file_settings` and `pg_hba_file_rules`)
- The PostgreSQL 19 binaries and a 19 build of every extension you use, for `pg_upgrade --check`
- `standard_conforming_strings = on` in the session that runs the queries (the default; run `SET standard_conforming_strings = on;` first if your cluster turns it off)

We tested this post on release day. On a throwaway Ubuntu 24.04 server we installed PostgreSQL 18.7 from the PGDG packages and built 19.0 from the `REL_19_0` tag with lz4, zstd and ICU, because no 19.0 packages or Docker image were published yet. We built an 18 cluster that has each problem in this post, ran every check query on it, ran `pg_upgrade --check` and `pg_upgrade --link` to 19.0, and then ran the post-upgrade steps, the config and login checks, and the logical replication cutover. The outputs and errors quoted below come from those runs.

## What is not in 19

Twelve features left the release notes after beta 1, including SQL/PGQ graph queries, `UPDATE`/`DELETE ... FOR PORTION OF`, online data checksum changes and `ALTER TABLE ... MERGE`/`SPLIT PARTITION`. [Postgres 19 Slipped to November: Every Pulled Feature and Why](/posts/postgres-19-delay-pulled-features) covers each one, what to use instead, and a script that finds code written against a beta that uses them.

Two items from that post matter for the upgrade itself. If a cluster ran a 19 beta or RC1 and you plan to keep it, drop or redefine expression indexes, generated columns and partition keys that use `JSON_ARRAY()` or `JSON_OBJECT()` over arrays, composite types or ranges. The [RC2 announcement](https://www.postgresql.org/about/news/postgresql-187-1712-1616-1520-1425-and-19-rc-2-released-3442/) says `pg_dump`/`pg_restore` and `pg_upgrade` will fail to recreate them. And `REPACK (CONCURRENTLY)` runs one at a time across the whole cluster, as the revert message quoted in that post says, so plan a queue, not parallel runs.

The rest of this post is about what did ship.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Patch 18", "sub": "18.7 + post-update steps", "icon": "database", "tone": "blue" },
    { "label": "Run the checks", "sub": "queries below", "icon": "activity", "tone": "violet" },
    { "label": "Fix blockers", "sub": "indexes, names, config", "icon": "gear", "tone": "amber" },
    { "label": "pg_upgrade --check", "sub": "19 binaries", "icon": "check", "tone": "green" },
    { "label": "Upgrade", "sub": "pg_upgrade or logical", "icon": "rocket", "tone": "accent" },
    { "label": "After", "sub": "stats, extensions, reindex", "icon": "shield", "tone": "slate" }
  ]
}
```

## Step 1: Fix what blocks pg_upgrade

### Patch 18 first

`pg_upgrade` creates new system catalogs and reuses your existing data files, as its [documentation](https://www.postgresql.org/docs/19/pgupgrade.html) explains. Indexes come across as they are. So if your 18 cluster needs a reindex from a minor release, the 19 cluster needs it too.

The latest 18 minor release is 18.7, out on 12 November with RC2. Its [announcement](https://www.postgresql.org/about/news/postgresql-187-1712-1616-1520-1425-and-19-rc-2-released-3442/) lists these post-update steps:

- Reindex GIN indexes that you suspect of corruption.
- Reindex GiST indexes that use `gist_trgm_ops`.
- Reindex B-tree indexes on `bpchar` columns that were declared without a length.
- Check `NOT NULL NO INHERIT` constraints on partitioned tables.
- Take a new full backup if you use incremental backups.

Do these on 18 before you upgrade. Minor releases can bring their own surprises, as [PostgreSQL 18.2 breaking standbys](/posts/postgres-18-2-standby-regression-upgrade-footguns) showed, so read the notes of the minor release you install.

### btree_gist indexes on inet and cidr

The `gist_inet_ops` and `gist_cidr_ops` operator classes in btree_gist can miss rows that a query should return. The [btree_gist documentation for 19](https://www.postgresql.org/docs/19/btree-gist.html#BTREE-GIST-INET-INDEXES) calls the problem unfixable without changing the contents of the indexes. So 19 makes the built-in GiST `inet_ops` class the default for `inet` and `cidr`, and `pg_upgrade` refuses to upgrade a cluster that has indexes on the old classes ([release note](https://www.postgresql.org/docs/19/release-19.html#RELEASE-19-MIGRATION)).

You can have these indexes without knowing it. On 18, with btree_gist installed, `CREATE INDEX ... USING gist (client_ip)` picks `gist_inet_ops` because it is the default class there. Exclusion constraints that combine an address with a time range, like `EXCLUDE USING gist (client_ip WITH =, during WITH &&)`, use it too. Run this in every database:

```sql
-- btree_gist inet/cidr indexes that pg_upgrade refuses (run in each database)
SELECT i.indrelid::regclass AS table_name,
       i.indexrelid::regclass AS index_name,
       oc.opcname,
       con.conname AS backs_constraint
FROM pg_index i
JOIN pg_opclass oc ON oc.oid = ANY (i.indclass)
JOIN pg_am am ON am.oid = oc.opcmethod
LEFT JOIN pg_constraint con ON con.conindid = i.indexrelid
WHERE am.amname = 'gist'
  AND oc.opcname IN ('gist_inet_ops', 'gist_cidr_ops');
```

It matches the operator classes by name, which is the same test that `pg_upgrade` uses. On our test database it finds two plain indexes and one exclusion constraint:

```text
 table_name |       index_name        |    opcname    |  backs_constraint
------------+-------------------------+---------------+---------------------
 sessions   | sessions_no_overlap     | gist_inet_ops | sessions_no_overlap
 sessions   | sessions_net_gist       | gist_cidr_ops |
 sessions   | sessions_client_ip_gist | gist_inet_ops |
(3 rows)
```

For a plain index, build the replacement next to the old one and swap them without blocking writes. The built-in `inet_ops` class works for both `inet` and `cidr` columns:

```sql
CREATE INDEX CONCURRENTLY sessions_client_ip_inet
  ON sessions USING gist (client_ip inet_ops);
DROP INDEX CONCURRENTLY sessions_client_ip_gist;
ALTER INDEX sessions_client_ip_inet RENAME TO sessions_client_ip_gist;
```

An index that backs an exclusion constraint cannot be swapped like that. Drop the constraint and add it again with the class named. Adding a constraint takes an `ACCESS EXCLUSIVE` lock on the table while the new index builds ([ALTER TABLE](https://www.postgresql.org/docs/19/sql-altertable.html)), so do it in a quiet window:

```sql
BEGIN;
ALTER TABLE sessions DROP CONSTRAINT sessions_no_overlap;
ALTER TABLE sessions ADD CONSTRAINT sessions_no_overlap
  EXCLUDE USING gist (client_ip inet_ops WITH =, during WITH &&);
COMMIT;
```

The built-in class supports `=`, so the constraint still rejects overlapping rows. We checked that on 18 after the swap. If you are new to building indexes without downtime, the [zero-downtime Postgres migrations checklist](/checklists/zero-downtime-postgres-migrations) covers `CONCURRENTLY` and lock timeouts.

### Names with CR or LF, and the MULE_INTERNAL encoding

19 no longer allows carriage returns or line feeds in database, role and tablespace names, and `pg_upgrade` refuses a cluster that has them. This was changed to avoid security problems. 19 also removes the `MULE_INTERNAL` encoding; a database that uses it must be dumped and restored with another encoding, such as UTF8 ([release notes](https://www.postgresql.org/docs/19/release-19.html#RELEASE-19-MIGRATION)). One query finds both:

```sql
-- Names with CR or LF, and databases in the removed MULE_INTERNAL encoding
SELECT 'database' AS kind, datname AS name FROM pg_database WHERE datname ~ '[\r\n]'
UNION ALL
SELECT 'role', rolname FROM pg_roles WHERE rolname ~ '[\r\n]'
UNION ALL
SELECT 'tablespace', spcname FROM pg_tablespace WHERE spcname ~ '[\r\n]'
UNION ALL
SELECT 'MULE_INTERNAL database', datname FROM pg_database
WHERE pg_encoding_to_char(encoding) = 'MULE_INTERNAL';
```

Rename the objects with CR or LF in their names with `ALTER ROLE ... RENAME TO`, `ALTER DATABASE ... RENAME TO` or `ALTER TABLESPACE ... RENAME TO`, and update the connection strings that use the old names. Renaming does not help a `MULE_INTERNAL` database: dump it and restore it into a new database with another encoding.

### Extensions built for 19

`pg_upgrade --check` stops when the old cluster uses a shared library that the new installation does not have. Every C extension needs a build for 19. Two items in the migration section are for extension authors: index access methods now return a static `IndexAmRoutine` structure, and the planner hook `get_relation_info_hook` is gone. An extension that uses either needs a release made for 19, not only a rebuild. List what each database uses:

```sql
-- Extensions installed in this database (run in each database)
SELECT extname, extversion FROM pg_extension ORDER BY extname;
```

For each extension that does not ship with PostgreSQL, check that its project lists 19 support and that your package source has the build. The bundled ones that get a new version in 19 are btree_gin (1.4), btree_gist (1.9), pg_buffercache (1.7), pg_stat_statements (1.13) and postgres_fdw (1.3). You update them with `ALTER EXTENSION ... UPDATE` after the upgrade.

## Step 2: Clean up the configuration

At startup, PostgreSQL treats any error in its configuration files as fatal ([the check in guc.c](https://github.com/postgres/postgres/blob/REL_19_0/src/backend/utils/misc/guc.c#L603-L611)). An unknown parameter is an error, and so is a value that a parameter rejects. A failed load of `pg_hba.conf` also stops the server at startup. So four changes in 19 can stop the server from starting:

- **`io_workers` is removed.** It is replaced by [`io_min_workers` and `io_max_workers`](https://www.postgresql.org/docs/19/runtime-config-resource.html#GUC-IO-MIN-WORKERS) (defaults 2 and 8), plus `io_worker_idle_timeout` and `io_worker_launch_interval`. With `io_method = worker`, the pool now grows and shrinks on its own between the two limits. Delete the old line. If you had set `io_workers` above 8, set `io_max_workers` to that value.
- **`escape_string_warning` is removed.** It did nothing while `standard_conforming_strings` was on.
- **[`standard_conforming_strings`](https://www.postgresql.org/docs/19/runtime-config-compatible.html#GUC-STANDARD-CONFORMING-STRINGS) can only be `on`.** Setting it to `off` is an error.
- **RADIUS authentication is removed.** PostgreSQL only supported RADIUS over UDP, which the release notes call "unfixably insecure". A `radius` line in `pg_hba.conf` is now an invalid authentication method.

All four come from the [migration section](https://www.postgresql.org/docs/19/release-19.html#RELEASE-19-MIGRATION). These queries find them on 18. `pg_file_settings` covers `postgresql.conf`, `postgresql.auto.conf` (where `ALTER SYSTEM` writes) and included files:

```sql
-- Lines in the config files that stop a 19 server from starting (superuser)
SELECT sourcefile, sourceline, name, setting
FROM pg_file_settings
WHERE name IN ('io_workers', 'escape_string_warning')
   OR (name = 'standard_conforming_strings'
       AND lower(setting) NOT IN ('on', 'true', 'yes', '1'));

-- Per-role and per-database settings for the same parameters
SELECT coalesce(r.rolname, '(all roles)') AS role,
       coalesce(d.datname, '(all databases)') AS database,
       cfg
FROM pg_db_role_setting s
LEFT JOIN pg_roles r ON r.oid = s.setrole
LEFT JOIN pg_database d ON d.oid = s.setdatabase
CROSS JOIN LATERAL unnest(s.setconfig) AS cfg
WHERE split_part(cfg, '=', 1) = 'escape_string_warning'
   OR (split_part(cfg, '=', 1) = 'standard_conforming_strings'
       AND lower(split_part(cfg, '=', 2)) NOT IN ('on', 'true', 'yes', '1'));

-- pg_hba.conf lines that use RADIUS (superuser)
SELECT file_name, line_number, database, user_name, auth_method
FROM pg_hba_file_rules
WHERE auth_method = 'radius';
```

Remove the per-role and per-database settings too, with `ALTER ROLE ... RESET`, `ALTER DATABASE ... RESET`, or `ALTER ROLE ... IN DATABASE ... RESET` for a setting that is scoped to both. They name a parameter that 19 does not have or a value that it rejects, and `pg_upgrade --check` does not look at them. In our test, an 18 cluster with `ALTER ROLE app_user SET escape_string_warning = off` passed the check with "Clusters are compatible", and the real run then stopped at "Restoring global objects in the new cluster":

```text
ALTER ROLE "app_user" SET "escape_string_warning" TO 'off';
ERROR:  unrecognized configuration parameter "escape_string_warning"
```

After that failure you must run `initdb` for the new cluster again. On 19, `ALTER ROLE ... SET standard_conforming_strings = off` fails too, with `non-standard string literals are not supported`, so a per-role `off` breaks the restore in the same way. Move RADIUS users to another method before the upgrade.

### Defaults that change

Next, look at the settings whose meaning or default changes. This query shows your current value and where it comes from, with the values you set yourself first:

```sql
-- Settings that 19 removes or changes, with where your value comes from
WITH changed(name, in_19) AS (
  VALUES
    ('io_workers',                  'removed: use io_min_workers / io_max_workers'),
    ('escape_string_warning',       'removed'),
    ('standard_conforming_strings', 'always on; off is an error'),
    ('max_locks_per_transaction',   'default 128; double a custom value'),
    ('jit',                         'default off'),
    ('log_lock_waits',              'default on'),
    ('wal_compression',             'on picks zstd, then lz4, then pglz'),
    ('default_toast_compression',   'default lz4 if the build has it'),
    ('log_autovacuum_min_duration', 'no longer covers autovacuum ANALYZE')
)
SELECT c.name, s.setting, s.unit, s.source, c.in_19
FROM changed c
JOIN pg_settings s USING (name)
ORDER BY s.source = 'default', c.name;
```

**`max_locks_per_transaction`** goes from 64 to 128 ([docs](https://www.postgresql.org/docs/19/runtime-config-locks.html#GUC-MAX-LOCKS-PER-TRANSACTION)). The default did not simply grow. The shared lock tables are now sized without the safety margins they had before, so the same setting holds fewer locks than in 18. The release notes say settings "must now be doubled to match their capacity in previous releases", and the [commit](https://github.com/postgres/postgres/commit/79534f90657c37c5238e5341a111dedd26d9c0fb) gives the same rule of thumb. If you set 256 on 18 because of "out of shared memory" errors on queries that touch many partitions, set 512 on 19. A standby must have the same value as its primary or a higher one, so change it there too.

**JIT is off by default** ([`jit`](https://www.postgresql.org/docs/19/runtime-config-query.html#GUC-JIT)). The [commit](https://github.com/postgres/postgres/commit/7f8c88c2b872cb74882ab93dcb05529dab2a10bc) explains why: the cost check that decides when to compile is simple, and a few more rows in a table can push a fast query over the threshold, where compiling takes longer than running the query. For most OLTP workloads the new default avoids that sudden slowdown. If you run large analytical queries that benefit from JIT, turn it on only where you need it:

```sql
ALTER DATABASE analytics SET jit = on;
-- or for one role
ALTER ROLE reporting SET jit = on;
```

To see which queries used JIT on 18, and how much time it cost them, ask `pg_stat_statements`:

```sql
-- Queries that used JIT on 18 (needs pg_stat_statements)
SELECT queryid,
       calls,
       round(mean_exec_time) AS mean_ms,
       round((jit_generation_time + jit_inlining_time
              + jit_optimization_time + jit_emission_time) / calls) AS jit_ms_per_call,
       left(query, 60) AS query
FROM pg_stat_statements
WHERE jit_functions > 0
ORDER BY jit_ms_per_call DESC
LIMIT 20;
```

These numbers show what JIT cost, not what it saved. A query where `jit_ms_per_call` is a large part of `mean_ms` is likely to gain from the new default, and a long analytical query may lose. Time both kinds on your 19 copy with JIT on and off before you decide. One known bug can skew the JIT side: with JIT on, hash joins and hash aggregates on more than one key could get many hash collisions and run slowly. It affects 18 and 19.0, and the [fix](https://github.com/postgres/postgres/commit/0c6d95e134) was committed after 19.0 was stamped, so it ships in the next minor releases (11 February 2027 on the [roadmap](https://www.postgresql.org/developer/roadmap/)).

**[`log_lock_waits`](https://www.postgresql.org/docs/19/runtime-config-logging.html#GUC-LOG-LOCK-WAITS) is on by default.** The server logs a line each time a session waits longer than `deadlock_timeout` (1 second by default) for a lock. That is useful when you look for blocked migrations or long transactions, but it adds log volume on a busy cluster. Make sure your log shipping and alerting can take it, or set it to `off`.

**Autovacuum logging is split.** [`log_autovacuum_min_duration`](https://www.postgresql.org/docs/19/runtime-config-logging.html#GUC-LOG-AUTOVACUUM-MIN-DURATION) now covers only vacuum runs. Analyze runs by autovacuum have their own setting, [`log_autoanalyze_min_duration`](https://www.postgresql.org/docs/19/runtime-config-logging.html#GUC-LOG-AUTOANALYZE-MIN-DURATION), with a default of 10 minutes. If you set the first one to 0 to log every autovacuum action, set the second one to 0 too.

**`wal_compression = on` now picks the best method in the build.** In 18, `on` meant pglz. In 19 it selects the first of zstd, lz4 and pglz that the build supports ([docs](https://www.postgresql.org/docs/19/runtime-config-wal.html#GUC-WAL-COMPRESSION)). That changes CPU use and WAL size. If you want the 18 behavior, set `wal_compression = pglz`. The default is still `off`. After `SET wal_compression = on`, `SHOW wal_compression` returns the method that was picked: `zstd` on our build.

**TOAST compression defaults to lz4** when PostgreSQL was built with lz4, and to pglz otherwise ([`default_toast_compression`](https://www.postgresql.org/docs/19/runtime-config-client.html#GUC-DEFAULT-TOAST-COMPRESSION)). This only affects values written after the upgrade. Values already stored with pglz stay as they are and read fine. Run `SHOW default_toast_compression;` on the new cluster to see which one you got.

**Parallel VACUUM shares one cost limit.** Before 19, the leader and each parallel worker slept based only on their own cost, so a parallel vacuum could use several times the `vacuum_cost_limit` budget. In 19 they share it, and the release notes warn that `VACUUM` with parallel workers and cost-based delay "might run slower" ([release note](https://www.postgresql.org/docs/19/release-19.html#RELEASE-19-MIGRATION)). Manual `VACUUM` has no delay unless you set `vacuum_cost_delay`, so this mostly affects scripted `VACUUM (PARALLEL n)` runs with a delay, and parallel autovacuum if you turn it on with [`autovacuum_max_parallel_workers`](https://www.postgresql.org/docs/19/runtime-config-vacuum.html#GUC-AUTOVACUUM-MAX-PARALLEL-WORKERS) (default 0). This change was committed on 2 November, after RC1 was released, so repeat any vacuum timings that you made on RC1.

**Wraparound warnings start earlier.** Clients and the server log now get a warning when transaction ID or multixact wraparound is less than 100 million away, instead of 40 million ([release notes, Monitoring](https://www.postgresql.org/docs/19/release-19.html)). If you alert on those warnings, expect them sooner. That is a good thing, but it can look like a new problem.

## Step 3: Check logins and clients

**MD5 passwords now warn on every login.** 18 marked MD5 passwords as deprecated. 19 also sends a warning after each successful MD5 password authentication, controlled by [`md5_password_warnings`](https://www.postgresql.org/docs/19/runtime-config-connection.html#GUC-MD5-PASSWORD-WARNINGS) (default `on`). Applications and drivers that log server warnings will start to show it.

**Passwords that are about to expire warn too.** The new setting [`password_expiration_warning_threshold`](https://www.postgresql.org/docs/19/runtime-config-connection.html#GUC-PASSWORD-EXPIRATION-WARNING-THRESHOLD) (default 7 days) makes the server warn at login when a role's `VALID UNTIL` date is closer than that. This query lists the roles to review. Whether a role sees a warning also depends on how it logs in: the MD5 warning comes only after a successful MD5 password login.

```sql
-- Login roles to review for the new MD5 and password-expiry warnings (superuser)
SELECT rolname,
       rolpassword LIKE 'md5%' AS md5_password,
       rolvaliduntil
FROM pg_authid
WHERE rolcanlogin
  AND (rolpassword LIKE 'md5%'
       OR (rolpassword IS NOT NULL
           AND rolvaliduntil BETWEEN now() AND now() + interval '7 days'));
```

The real fix for MD5 is to move to SCRAM: make sure `password_encryption` is `scram-sha-256` (the default since PostgreSQL 14) and set the password again. You can do it one role at a time, because a `pg_hba.conf` line with `md5` [uses SCRAM automatically](https://www.postgresql.org/docs/19/auth-password.html) for roles whose stored password is SCRAM. Change the lines to `scram-sha-256` when no MD5 passwords are left.

**Applications that turn off `standard_conforming_strings` now get an error.** Search your application code and connection settings for `standard_conforming_strings` and `escape_string_warning`. The [commit](https://github.com/postgres/postgres/commit/45762084545ec14dbbe66ace1d69d7e89f8978ac) keeps the parameter itself, because client code still reads it. It also says `pg_upgrade` works even if the old cluster used `off`. Dumps are different: a dump made by a pre-19 `pg_dump` from a server with `standard_conforming_strings = off` does not load correctly into 19. Use the 19 `pg_dump` and `pg_dumpall` for any dump that goes into a 19 server, which is good practice for major upgrades anyway.

**Protocol "grease" was only in the betas.** libpq in 19 betas 1 to 3 sent a test protocol version that no server supports, to find proxies and poolers that do not handle protocol negotiation. It [stopped](https://github.com/postgres/postgres/commit/408a28c49a6744715a954bd817141ba562e28341) on 1 September, and the release notes say 19.0 does not send it ([libpq section](https://www.postgresql.org/docs/19/release-19.html)). If beta clients failed to connect through a pooler and you added `max_protocol_version=3.0` to connection strings, you can keep it. 3.0 is still the [default](https://www.postgresql.org/docs/19/libpq-connect.html#LIBPQ-CONNECT-MAX-PROTOCOL-VERSION).

## Step 4: Plan for changed results

These changes do not stop the upgrade. They change what queries return or what indexes contain, so test them on your copy.

**Text search and pg_trgm in databases that do not use libc.** 19 parses text for full text search and pg_trgm with the database's own locale provider. Before, it always used libc. In databases with the ICU or builtin provider whose locale behaves differently from `LC_CTYPE` (in particular an `LC_CTYPE` of `C`), the output of some functions can change. The release notes recommend that you reindex all indexes that use full text search and pg_trgm after `pg_upgrade`, and recompute stored `tsvector` values ([release note](https://www.postgresql.org/docs/19/release-19.html#RELEASE-19-MIGRATION)).

**fuzzystrmatch.** `dmetaphone()` and `dmetaphone_alt()` now upper-case their input with the database's default collation, and `soundex()`, `metaphone()` and `difference()` treat only ASCII letters as letters. Reindex indexes that use these functions after the upgrade.

**Snowball stemmers.** The Dutch stemmer uses a new algorithm in 19. The English, French, German, Lithuanian, Norwegian, Spanish, Swedish and Turkish stemmers were also updated and produce different stems for some words ([release notes, Functions](https://www.postgresql.org/docs/19/release-19.html), [stemmer list](https://www.postgresql.org/docs/19/textsearch-dictionaries.html#TEXTSEARCH-SNOWBALL-DICTIONARY)). A `tsvector` stored or indexed on 18 keeps the stems that 18 produced, while a query on 19 stems its words with the new rules. On 18.7, `to_tsvector('english', 'organization')` gives `'organ'`. On 19.0 it gives `'organiz'`, so `to_tsquery('english', 'organization')` on 19 does not match the `'organ'` stored on 18. If you use these configurations, rebuild the same list of indexes and columns.

The old Dutch algorithm is still available as the Snowball language `dutch_porter`, but 19 has no ready-made configuration for it. The built-in `dutch` configuration uses the new stemmer. To keep the old stems, create a dictionary and a configuration and use that configuration in your queries and indexes:

```sql
CREATE TEXT SEARCH DICTIONARY dutch_porter_stem (TEMPLATE = snowball, LANGUAGE = dutch_porter);
CREATE TEXT SEARCH CONFIGURATION dutch_porter (COPY = dutch);
ALTER TEXT SEARCH CONFIGURATION dutch_porter
  ALTER MAPPING FOR asciiword, word, hword, hword_part, asciihword, hword_asciipart
  WITH dutch_porter_stem;
```

On 19.0, `to_tsvector('dutch_porter', 'lichamelijk mogelijkheden')` returns `'licham':1 'mogelijk':2`, the same as `dutch` on 18. The new `dutch` configuration returns `'lichamelijk':1 'molijk':2`.

These queries find candidates. Run the first one once and the others in each database. A database with the ICU or builtin provider is only a candidate, because the change matters where its locale and `LC_CTYPE` classify characters differently. The index query matches function names in index expressions, so it does not find an index that calls these functions through a wrapper function of your own.

```sql
-- Databases to review: text search and pg_trgm now use their locale provider
SELECT datname, datlocprovider, datlocale, datctype
FROM pg_database
WHERE datlocprovider <> 'c';

-- Candidate indexes to rebuild: text search, pg_trgm, fuzzystrmatch
WITH p(re) AS (
  VALUES ('\m(\w*to_tsvector|\w*to_tsquery|\w*similarity|soundex|metaphone|dmetaphone\w*|difference)\(')
)
SELECT DISTINCT i.indrelid::regclass AS table_name,
       i.indexrelid::regclass AS index_name
FROM pg_index i
JOIN pg_opclass oc ON oc.oid = ANY (i.indclass)
CROSS JOIN p
WHERE oc.opcintype = 'tsvector'::regtype
   OR oc.opcname IN ('gin_trgm_ops', 'gist_trgm_ops')
   OR pg_get_expr(i.indexprs, i.indrelid) ~ p.re
   OR pg_get_expr(i.indpred, i.indrelid) ~ p.re;

-- Stored tsvector columns (relkind: r table, p partitioned table, m materialized view)
SELECT a.attrelid::regclass AS relation,
       c.relkind,
       a.attname AS column_name,
       a.attgenerated = 's' AS generated
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
WHERE a.atttypid = 'tsvector'::regtype
  AND a.attnum > 0 AND NOT a.attisdropped
  AND a.attgenerated <> 'v'
  AND c.relkind IN ('r', 'p', 'm') AND NOT c.relispartition;
```

On 19, rebuild each index with `REINDEX INDEX CONCURRENTLY <name>;` so writes keep working. An index that backs an exclusion constraint cannot be rebuilt concurrently ([REINDEX](https://www.postgresql.org/docs/19/sql-reindex.html)), so use plain `REINDEX INDEX` for it in a quiet window. To recompute stored values:

- For a plain `tsvector` column, write it again from its source text, the same way your application fills it.
- For a stored generated column, an `UPDATE` that sets its source column to itself (`SET body = body`) computes it again. On a large table, do it in batches.
- For a materialized view, run `REFRESH MATERIALIZED VIEW`.

**`JSON_ARRAY(query)` on an empty result.** When the subquery returns no rows, [`JSON_ARRAY()`](https://www.postgresql.org/docs/19/functions-json.html) now returns an empty JSON array. Before, it returned NULL. `SELECT JSON_ARRAY(SELECT 1 WHERE false);` returns NULL on 18.7 and `[]` on 19.0. Code that wraps the call in `coalesce(..., '[]')` keeps working, but code that tests for NULL to mean "no rows" does not.

**postgres_fdw and read-only transactions.** Transactions now pass their `READ ONLY` and `DEFERRABLE` status to [postgres_fdw](https://www.postgresql.org/docs/19/postgres-fdw.html) sessions. A direct `INSERT` into a foreign table was already rejected in a `READ ONLY` transaction. What changes is remote work that writes. In our test, a foreign table pointed at a remote view that calls a function which inserts an audit row. Inside `BEGIN READ ONLY`, a `SELECT` on it returned its rows and wrote the audit rows on 18.7. On 19.0 the same `SELECT` fails with `cannot execute INSERT in a read-only transaction`, raised by the remote server.

**Smaller items.** `COPY FROM ... WHERE` no longer accepts system columns. The GB18030 encoding moves from the 2000 to the 2022 version of the standard, which changes the mapping of 18 characters. If you use GB18030 as a client encoding, read the [commit message](https://github.com/postgres/postgres/commit/5334620eef8f7b429594e6cf9dc97331eda2a8bd) for the exact code points.

## Step 5: Update monitoring

Some names that monitoring queries use are different in 19:

| In 18                                                           | In 19                                                                     | Where                                                                                                               |
| --------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `sync_error_count`                                              | `sync_table_error_count` (and a new `sync_seq_error_count`)               | [`pg_stat_subscription_stats`](https://www.postgresql.org/docs/19/monitoring-stats.html#PG-STAT-SUBSCRIPTION-STATS) |
| wait event type `BufferPin`                                     | wait event type `Buffer`                                                  | `pg_stat_activity.wait_event_type`                                                                                  |
| wait event `BufferPin`                                          | `BufferCleanup`                                                           | `pg_stat_activity.wait_event`                                                                                       |
| wait event `BufferContent` (type `LWLock`)                      | `BufferShared`, `BufferShareExclusive`, `BufferExclusive` (type `Buffer`) | `pg_stat_activity.wait_event`                                                                                       |
| autovacuum analyze runs logged by `log_autovacuum_min_duration` | `log_autoanalyze_min_duration`                                            | server log                                                                                                          |

The renames are in the [migration section](https://www.postgresql.org/docs/19/release-19.html#RELEASE-19-MIGRATION). A dashboard that filters on an old name shows nothing after the upgrade, and an alert on it stays quiet, so search for them in your monitoring and config code:

```bash
grep -rnE 'sync_error_count|BufferPin|BufferContent|io_workers|escape_string_warning' \
  dashboards/ alerts/ ansible/
```

The pattern is case-sensitive on purpose: `confl_bufferpin` in `pg_stat_database_conflicts` still exists in 19 and does not match.

Two `pg_stat_statements` changes affect query statistics. `FETCH` statements of different sizes now share one entry, and version 1.13 adds counters for generic and custom plans. You see the counters after `ALTER EXTENSION pg_stat_statements UPDATE`.

19 also adds views worth putting on a dashboard: [`pg_stat_lock`](https://www.postgresql.org/docs/19/monitoring-stats.html#PG-STAT-LOCK-VIEW) for statistics per lock type, `pg_stat_recovery` for recovery status, `pg_stat_autovacuum_scores` for how autovacuum ranks tables, and `pg_stat_progress_repack` for `REPACK`, `CLUSTER` and `VACUUM FULL` progress.

## Step 6: Upgrade

### With pg_upgrade

The [Introduction to PostgreSQL guide](/guides/introduction-to-postgres/10-production-best-practices#h3-major-version-upgrades) walks through a major upgrade with `pg_upgradecluster` on Debian and Ubuntu and with `pg_upgrade` elsewhere. Major upgrades are the weak spot that the [PostgreSQL vs MySQL comparison](/comparisons/postgresql-vs-mysql) lists for Postgres, and most of the work is the checking above. For 19 the order is:

1. Update 18 to 18.7 and do its post-update steps.
2. Run the queries in this post and fix what they find.
3. Install the 19 binaries and the 19 builds of your extensions. Create the new cluster with `initdb` options that match the old one (encoding, locale, data checksums).
4. Bring your settings over, without `io_workers` and `escape_string_warning`, with `max_locks_per_transaction` doubled if you had changed it, and with a decision about JIT.
5. Run `pg_upgrade --check` with the 19 binaries. It reports problems and does not change your data. It stops at the first check that fails: on our test cluster it reported only the `MULE_INTERNAL` database, not the role name with a line feed or the btree_gist indexes. So fix everything the queries find before you run it, or expect several rounds. It also does not check per-role settings (see Step 2).
6. Stop the old cluster and run `pg_upgrade` for real. `--link`, `--clone` and `--swap` are much faster than the default copy mode, and the [pg_upgrade docs](https://www.postgresql.org/docs/19/pgupgrade.html) explain what each one means for going back to the old cluster.

```bash
# Paths follow the PGDG packages on Debian and Ubuntu; adjust them for your system.
# Run as the postgres user.
/usr/lib/postgresql/19/bin/pg_upgrade --check \
  --old-bindir=/usr/lib/postgresql/18/bin \
  --new-bindir=/usr/lib/postgresql/19/bin \
  --old-datadir=/var/lib/postgresql/18/main \
  --new-datadir=/var/lib/postgresql/19/main \
  --old-options='-c config_file=/etc/postgresql/18/main/postgresql.conf' \
  --new-options='-c config_file=/etc/postgresql/19/main/postgresql.conf'
```

If the 18 cluster is itself a publisher or a subscriber, read the [logical replication upgrade notes](https://www.postgresql.org/docs/19/logical-replication-upgrade.html) first. `pg_upgrade` can carry logical slots and subscriptions over from 17 and later, but only under the conditions listed there.

After the new cluster starts, rebuild the statistics that `pg_upgrade` does not carry over, as the end of its output tells you:

```bash
vacuumdb --all --analyze-in-stages --missing-stats-only --jobs 4
vacuumdb --all --analyze-only --jobs 4
```

In 19, `vacuumdb --analyze-only` and `--analyze-in-stages` also analyze partitioned tables when you do not name any tables ([release notes, Server Applications](https://www.postgresql.org/docs/19/release-19.html)). Both commands can take longer than they did on your last upgrade.

Then, in each database, update the extensions and rebuild the indexes from Step 4. In `psql`, `\gexec` runs each row of the result as a statement:

```sql
-- On 19, in each database: update extensions that are still at the old version
SELECT format('ALTER EXTENSION %I UPDATE;', name)
FROM pg_available_extensions
WHERE installed_version <> default_version
\gexec
```

If you want to practice `psql` meta-commands like `\gexec` before you need them, the [PostgreSQL terminal simulator](/games/postgres-terminal-simulator) runs in the browser.

### With logical replication

Logical replication keeps downtime to a short cutover, as [Upgrading Data via Replication](https://www.postgresql.org/docs/19/upgrading.html#UPGRADING-VIA-REPLICATION) describes. Three details are specific to an 18 to 19 move:

- The publisher is still 18, so it needs `wal_level = logical`, and changing that on 18 needs a restart. From 19 on, a server with `wal_level = replica` turns on logical decoding when you create a logical slot (see [`effective_wal_level`](https://www.postgresql.org/docs/19/runtime-config-preset.html#GUC-EFFECTIVE-WAL-LEVEL)), so your next upgrade will not need that restart.
- 19 can replicate sequences, but [sequence synchronization](https://www.postgresql.org/docs/19/logical-replication-sequences.html) requires the publisher to run 19 or later. From 18 you copy sequence values yourself at cutover.
- The schema is not replicated ([restrictions](https://www.postgresql.org/docs/19/logical-replication-restrictions.html)). Copy it with the 19 `pg_dump --schema-only`, and keep DDL frozen until the cutover.

```sql
-- On 18, in each database
CREATE PUBLICATION pg19_upgrade FOR ALL TABLES;

-- On 19, after you load the schema
CREATE SUBSCRIPTION pg19_upgrade
  CONNECTION 'host=pg18.internal dbname=app user=replicator'
  PUBLICATION pg19_upgrade;
```

At cutover, stop writes on 18 and wait for the subscriber to catch up. Then generate one `setval()` call per sequence on 18 and run them on 19 before you move traffic. Save this query as `sequences.sql`:

```sql
-- On 18, after writes stop: one setval() call per sequence, to run on 19
SELECT format('SELECT setval(%L, %s, %s);',
              format('%I.%I', n.nspname, c.relname),
              s.last_value, s.is_called::text)
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN LATERAL pg_get_sequence_data(c.oid) AS s
WHERE c.relkind = 'S'
  AND s.last_value IS NOT NULL;
```

```bash
psql -h pg18.internal -d app -v ON_ERROR_STOP=1 -At -f sequences.sql > setval.sql
psql -h pg19.internal -d app -v ON_ERROR_STOP=1 -f setval.sql
```

[`pg_get_sequence_data()`](https://www.postgresql.org/docs/19/functions-sequence.html#FUNC-PG-GET-SEQUENCE-DATA) exists in 18 and is documented from 19 on. It returns both `last_value` and `is_called`, so a sequence that was restarted or never used gets the same next value on 19 as it would have on 18. It returns NULL for a sequence that you cannot read, so run the query as a superuser.

## Summary

- **Before the upgrade, on 18:** patch to 18.7 and do its post-update steps, replace btree_gist `inet`/`cidr` indexes with `inet_ops`, rename objects with CR or LF in their names, move `MULE_INTERNAL` databases to UTF8, remove RADIUS, and get a 19 build of every extension.
- **In the config:** delete `io_workers` and `escape_string_warning`, never set `standard_conforming_strings = off`, double a custom `max_locks_per_transaction`, decide where you want JIT, and check `log_lock_waits`, `wal_compression` and the new autoanalyze logging setting.
- **After the upgrade:** run the two `vacuumdb` commands, update extensions, rebuild text search, pg_trgm and fuzzystrmatch indexes where the release notes say so, recompute stored `tsvector` values, and expect warnings for MD5 and expiring passwords.
- **In monitoring:** rename `sync_error_count` and the buffer wait events in dashboards and alerts.
- **If you replicate to upgrade:** copy sequence values at cutover, because 19 only synchronizes sequences from a publisher that already runs 19.

Sources: the [PostgreSQL 19 release notes](https://www.postgresql.org/docs/19/release-19.html) and the 19 documentation pages linked above, the [`REL_19_0` tag](https://github.com/postgres/postgres/tree/REL_19_0) (commit `5c839a2a08`, stamped 16 November 2026) for configuration defaults and `pg_upgrade` checks, the commits linked in each section, and the [18.7 and 19 RC2 announcement](https://www.postgresql.org/about/news/postgresql-187-1712-1616-1520-1425-and-19-rc-2-released-3442/).
