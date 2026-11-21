---
title: 'Logical Decoding Without a Restart: effective_wal_level'
navTitle: 'Logical decoding, no restart'
description: 'PostgreSQL 19 raises the WAL level to logical when you create the first logical slot. How to start CDC on a wal_level = replica server, and what to monitor.'
order: 9
---

**TLDR**: Before PostgreSQL 19, logical decoding needed `wal_level = logical`, and changing `wal_level` needs a restart. In 19, a server at the default `wal_level = replica` switches to logical WAL on its own when you create the first logical replication slot, and switches back after the last one is gone. The new read-only setting `effective_wal_level` tells you which level is in force. The catch: one forgotten slot now keeps the whole cluster at the logical level.

Change data capture (CDC) tools such as Debezium, a wal2json client or a native logical replication subscription all read changes through a **logical replication slot**. Logical decoding needs extra information in the WAL, which `wal_level = logical` adds. The default is `replica`, `wal_level` only changes at server start, and so on a database that nobody prepared, setting up CDC started with a restart in a maintenance window.

PostgreSQL 19 removes that restart ([release notes](https://www.postgresql.org/docs/19/release-19.html), [`effective_wal_level`](https://www.postgresql.org/docs/19/runtime-config-wal.html)).

## Prerequisites

- A PostgreSQL 19 server with the default `wal_level = replica`. The `postgres:19` image is.
- Optionally a PostgreSQL 18 server to see the old error.

## Create a Slot on a replica-Level Server

```sql
SHOW wal_level;
SHOW effective_wal_level;
CREATE TABLE notes (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, body text);
SELECT pg_create_logical_replication_slot('ondemand', 'test_decoding');
SHOW effective_wal_level;
```

On 19.0:

```text
 wal_level
-----------
 replica

 effective_wal_level
---------------------
 replica

 pg_create_logical_replication_slot
------------------------------------
 (ondemand,0/01BE5B80)

 effective_wal_level
---------------------
 logical
```

No restart and no error. The configured `wal_level` is still `replica`; the level in force is `logical`. Decoding works right away:

```sql
INSERT INTO notes (body) VALUES ('cdc without restart');
SELECT data FROM pg_logical_slot_get_changes('ondemand', NULL, NULL);
```

```text
                                  data
---------------------------------------------------------------------------
 BEGIN 665
 table public.notes: INSERT: id[bigint]:1 body[text]:'cdc without restart'
 COMMIT 665
```

The same `pg_create_logical_replication_slot` call on the `postgres:18` image fails as it did on every earlier release:

```text
ERROR:  logical decoding requires "wal_level" >= "logical"
```

## It Steps Back Down

Drop the last logical slot and the level goes back to `replica`:

```sql
SELECT pg_drop_replication_slot('ondemand');
SHOW effective_wal_level;
```

The switch back is asynchronous. Right after the drop, `effective_wal_level` can still say `logical`. On 19.0 it still read `logical` in the statement right after the drop and `replica` less than half a second later. The server log records both switches:

```text
LOG:  logical decoding is enabled upon creating a new logical replication slot
LOG:  logical decoding is disabled because there are no valid logical replication slots
```

While the configured `wal_level` is `replica`, any valid logical slot keeps the level at `logical`, even a slot that no consumer reads. A slot that has been invalidated (for example because the WAL it needed was removed) does not hold the level.

## What the Logical Level Costs

Two costs: the switch itself, and the extra WAL while the level is in force.

Creating the first slot, including the switch, took 14 ms on 19 beta 3 and 22 ms on 19.0, on quiet servers.

For the steady state, the documentation says what grows: with `REPLICA IDENTITY FULL`, and on update- and delete-heavy tables, logical WAL carries old row images ([WAL configuration](https://www.postgresql.org/docs/19/runtime-config-wal.html)). For simple keyed updates the difference is small. On 19 beta 3, a 30-second two-client upsert test wrote 11 MB of WAL at both levels, at 1,401 and 1,323 transactions per second (one run each, within the noise). On 19.0, the built-in `pgbench` simple-update test with two clients for 20 seconds wrote 154 MB at `replica` and 151 MB with a logical slot held, at 2,370 and 2,592 transactions per second. Measure your own write mix if it has wide rows or `REPLICA IDENTITY FULL`.

With on-demand decoding, you pay that cost only while a logical slot exists, plus the short time it takes to switch back.

## What Changes for Operations

**The restart leaves the CDC setup.** A new CDC consumer needs a slot, and creating it no longer needs a `wal_level` change planned in advance. Two other limits still apply:

- **Capacity.** `max_replication_slots` and `max_wal_senders` default to 10 each. That covers a first consumer, but raising either one still needs a restart.
- **Output plugins.** `output_plugin_libraries` lists the plugins a slot may use. The default is `pgoutput, test_decoding`. A third-party plugin such as wal2json must be installed and added to the list. The setting takes a reload, not a restart, and a superuser can also set it for one session ([replication settings](https://www.postgresql.org/docs/19/runtime-config-replication.html)). Keep the two built-in plugins in the list when you add one: removing `pgoutput` breaks subscriptions, and removing `test_decoding` breaks `pg_recvlogical` with its default plugin. This setting is not new in 19: it came to all supported versions in a 2026 minor release as a security fix (CVE-2026-6471), and `pg_upgrade --check` fails if the new cluster's list does not allow the plugins of the old cluster's slots.

On 19.0, a slot with a plugin that is not in the list fails before the library is even looked up:

```sql
SELECT pg_create_logical_replication_slot('w2j', 'wal2json');
```

```text
ERROR:  library "wal2json" may not be used as an output plugin
HINT:  If it is safe for all REPLICATION users to use this library as an output plugin, add it to "output_plugin_libraries" and reload the server configuration.
```

To allow it, keep the list syntax and reload:

```sql
ALTER SYSTEM SET output_plugin_libraries = 'pgoutput', 'test_decoding', 'wal2json';
SELECT pg_reload_conf();
```

The library itself must also be installed for the server's major version; on our stock image the next attempt failed with `could not access file "wal2json"`.

**"Just in case" settings can go.** A cluster that has run at `wal_level = logical` for years only to be ready for CDC can go back to `replica`. Changing the configured `wal_level` still needs one last restart. After that, `effective_wal_level` shows what you pay for at any moment.

**A forgotten slot now costs more.** A logical slot that nobody reads already keeps WAL and old catalog rows from being removed. In 19 it also keeps the whole cluster at the logical level. The two settings that would eventually invalidate such a slot are off by default: `max_slot_wal_keep_size = -1` and `idle_replication_slot_timeout = 0`. They only help if you set them.

## Monitor the Level and the Slots

Add `effective_wal_level` to monitoring next to the slot inventory. When it says `logical` for longer than a few seconds on a primary with `wal_level = replica`, some valid logical slot is holding it. One query lists them across all databases:

```sql
SELECT slot_name, database, active, inactive_since, restart_lsn, wal_status, invalidation_reason
FROM pg_replication_slots
WHERE slot_type = 'logical';
```

Read the rows in three groups:

- **Valid and `active`**: a consumer is streaming from it.
- **Valid and not active**: it holds the level and keeps all WAL from its `restart_lsn` on, which can be older than the moment the consumer went away. `inactive_since` tells you how long nobody has read it. Either its consumer will come back, or it is a leftover to drop.
- **`invalidation_reason` is not null**: it no longer holds the level. It is inventory to clean up, and the reason (`wal_removed`, `rows_removed`, `wal_level_insufficient`, `idle_timeout`) says what happened.

`wal_status` shows if the slot's WAL is still there. With `max_slot_wal_keep_size` set, `safe_wal_size` in the same view shows how much more WAL can be written before the slot is lost.

## Standbys and Failover

Two cases need a test before you rely on on-demand levels in a cluster with standbys:

- **Logical slots on standbys.** Per the [logical decoding documentation](https://www.postgresql.org/docs/19/logicaldecoding-explanation.html), with configured `wal_level = replica`, dropping the primary's last logical slot can invalidate logical slots on standbys. If you decode from a standby, test this.
- **Promotion.** A promoted standby that keeps logical decoding enabled at `wal_level = replica` waits at the end of recovery until every backend has picked up the new WAL state. That includes a standby whose only logical slot is a failover slot synchronized from the primary. While it waits, the startup process logs `still waiting for backend with PID nnn to accept ProcSignalBarrier` every 5 seconds. `pg_terminate_backend()` on that PID lets promotion finish. If the backend is stuck sending an error message to a client, close the client connection instead. Setting `tcp_user_timeout` on the standby ahead of time limits the wait. Promotion does not wait at `wal_level = logical` or when logical decoding is off after recovery.

We did not test either case. They come from the documentation and from fixes made before 19.0.

## What to Do When You Upgrade

1. If you kept `wal_level = logical` only to be ready for CDC, plan to set it back to `replica` at the restart that the upgrade gives you anyway.
2. Add `effective_wal_level` and the slot query above to monitoring.
3. Set `idle_replication_slot_timeout` or `max_slot_wal_keep_size` so a forgotten slot cannot hold WAL and the logical level forever. Pick values longer than your longest expected consumer outage.

Logical slots are also how sequence values can now travel to a subscriber. The next part shows [sequence replication and the failover step it needs](/guides/postgresql-19-field-notes/10-sequence-replication).
