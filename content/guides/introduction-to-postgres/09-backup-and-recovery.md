---
title: Backup, Recovery, and Replication
description: 'Back up PostgreSQL with pg_dump and pg_basebackup, restore with pg_restore, archive WAL for point-in-time recovery, and stream to a replica.'
order: 9
---

**TLDR**: Use `pg_dump -Fc` for logical backups of one database and `pg_restore` to load them. Use `pg_basebackup` plus WAL archiving for physical backups that can restore the whole cluster to any point in time. In production, let a tool such as pgBackRest or WAL-G manage this. Streaming replication gives you a standby that can take over in seconds, but it is not a backup: a dropped table is dropped on the replica too. A backup you have never restored is a hope, not a backup, so test restores on a schedule.

Sooner or later something deletes data you need: a migration with a bug, a `DELETE` without `WHERE`, a failed disk, or ransomware. What you can recover depends on decisions you make now. This part covers the three tools PostgreSQL gives you (logical dumps, physical backups with WAL archiving, and replication), how to restore from each, and how to check that your backups work.

## Prerequisites

- A PostgreSQL server you control (the paths below are for PostgreSQL 18 on Debian or Ubuntu; [Part 2](/guides/introduction-to-postgres/02-installation-and-setup) lists the paths for other platforms).
- Shell access as a user that can run `sudo`, and the client tools (`pg_dump`, `pg_restore`, `pg_basebackup`).

Before you choose tools, write down two numbers for each database:

- **RPO (recovery point objective)**: how much recent data you can afford to lose. A nightly dump means up to 24 hours.
- **RTO (recovery time objective)**: how long you can be down while you restore.

These decide which of the approaches below you need:

```diagram
{
  "type": "graph",
  "title": "Three ways to protect a PostgreSQL database",
  "columns": [
    [
      { "id": "primary", "label": "Primary", "sub": "PostgreSQL 18", "icon": "database", "tone": "blue", "detail": "Every approach starts from the running primary server." }
    ],
    [
      { "id": "dump", "label": "pg_dump", "sub": "logical, one database", "icon": "box", "tone": "green", "detail": "SQL-level copy. Portable across major versions and architectures. RPO = time since the last dump." },
      { "id": "base", "label": "pg_basebackup", "sub": "physical, whole cluster", "icon": "server", "tone": "violet", "detail": "Copy of the data directory. Combined with archived WAL it can restore to any moment." },
      { "id": "wal", "label": "WAL archive", "sub": "every change, continuously", "icon": "queue", "tone": "amber", "detail": "archive_command or a backup tool copies each finished 16 MB WAL segment off the server." },
      { "id": "stream", "label": "WAL streaming", "sub": "replication", "icon": "net", "tone": "slate", "detail": "Sends WAL to standbys as it is written. Copies mistakes too." }
    ],
    [
      { "id": "restore", "label": "pg_restore", "sub": "new or empty database", "icon": "check", "tone": "green", "detail": "Loads the dump. Can restore single tables and run in parallel with -j." },
      { "id": "pitr", "label": "PITR", "sub": "restore + replay WAL", "icon": "activity", "tone": "violet", "detail": "Restore the base backup, then replay WAL up to a timestamp just before the mistake." },
      { "id": "standby", "label": "Standby", "sub": "read-only, can be promoted", "icon": "database", "tone": "slate", "detail": "Takes over in seconds when the primary fails. Not a backup." }
    ]
  ],
  "edges": [
    ["primary", "dump"],
    ["primary", "base"],
    ["primary", "wal"],
    ["primary", "stream"],
    ["dump", "restore"],
    ["base", "pitr"],
    ["wal", "pitr"],
    ["stream", "standby"]
  ]
}
```

## Logical Backups with pg_dump

`pg_dump` connects like any client and writes the database's schema and data as SQL or as an archive. It reads from one consistent snapshot, so the dump is consistent even while the application keeps writing. It does not block normal reads and writes, but schema changes such as `ALTER TABLE` on the tables being dumped wait until it finishes.

```bash
# Custom format: compressed, restorable selectively and in parallel (recommended)
pg_dump -Fc -f blog.dump blog

# Directory format: like custom, but dumps several tables in parallel
pg_dump -Fd -j 4 -f blog_dir blog

# Plain SQL: readable, restored with psql
pg_dump -f blog.sql blog

# Only some tables, or everything except some tables
pg_dump -Fc -t users -t posts -f partial.dump blog
pg_dump -Fc --exclude-table=audit_log -f blog.dump blog

# Schema only, or data only
pg_dump --schema-only -f schema.sql blog
pg_dump --data-only -Fc -f data.dump blog
```

`pg_restore -l` lists what an archive contains without restoring it:

```terminal
{
  "title": "dump and inspect",
  "prompt": "$",
  "steps": [
    {
      "cmd": "pg_dump -Fc -f blog.dump blog"
    },
    {
      "cmd": "pg_restore -l blog.dump",
      "output": ";\n; Archive created at 2026-10-23 14:11:24 UTC\n;     dbname: blog\n;     TOC Entries: 17\n;     Compression: gzip\n;     Dump Version: 1.16-0\n;     Format: CUSTOM\n;     Integer: 4 bytes\n;     Offset: 8 bytes\n;     Dumped from database version: 18.6\n;     Dumped by pg_dump version: 18.6 (Debian 18.6-1.pgdg12+2)\n;\n;\n; Selected TOC Entries:\n;\n222; 1259 16399 TABLE public posts postgres\n221; 1259 16398 SEQUENCE public posts_id_seq postgres\n220; 1259 16385 TABLE public users postgres\n219; 1259 16384 SEQUENCE public users_id_seq postgres\n2583; 0 16399 TABLE DATA public posts postgres\n2581; 0 16385 TABLE DATA public users postgres\n2591; 0 0 SEQUENCE SET public posts_id_seq postgres\n2592; 0 0 SEQUENCE SET public users_id_seq postgres\n2431; 2606 16408 CONSTRAINT public posts posts_pkey postgres\n2427; 2606 16395 CONSTRAINT public users users_pkey postgres\n2429; 2606 16397 CONSTRAINT public users users_username_key postgres\n2432; 2606 16409 FK CONSTRAINT public posts posts_user_id_fkey postgres"
    }
  ]
}
```

The list shows the tables, sequences, data and constraints in the order `pg_restore` will create them. Constraints and indexes come after the data, which makes restores faster.

Plain SQL dumps start with a few settings and a `\restrict` line (added in 2025 security releases), which is a `psql` meta-command. Load plain dumps with `psql`, not with other SQL tools:

```terminal
{
  "title": "the start of a plain dump",
  "prompt": "$",
  "steps": [
    {
      "cmd": "pg_dump --schema-only blog | head -8",
      "output": "--\n-- PostgreSQL database dump\n--\n\n\\restrict oLifcIFF4k85qZPPWQCLjEXKS1OfilbfZ8jgGmaEyZrhXcIfpfQEffE4lX0vXtW\n\n-- Dumped from database version 18.6\n-- Dumped by pg_dump version 18.6 (Debian 18.6-1.pgdg12+2)"
    }
  ]
}
```

:::tip
Use a `pg_dump` at least as new as the server. A newer `pg_dump` can dump older servers, which is how you move data to a new major version; an older one refuses to dump a newer server.
:::

### Restoring from pg_dump

```bash
# Plain SQL dump (it does not create the database itself)
createdb blog_restored
psql -d blog_restored -f blog.sql

# Custom or directory format: create the database, then restore in parallel
createdb blog_restored
pg_restore -d blog_restored -j 4 blog.dump

# Replace the objects in an existing database
pg_restore -d blog --clean --if-exists blog.dump

# Restore a single table
pg_restore -d blog_restored -t users blog.dump

# Into a server where the original roles do not exist
pg_restore -d blog_restored --no-owner --no-privileges blog.dump
```

`pg_restore` keeps going after errors by default and reports them at the end. Add `--exit-on-error` in scripts so a failed restore fails loudly, and `--single-transaction` if you want all or nothing.

### Backup All Databases

`pg_dump` covers one database. Roles and tablespaces belong to the whole cluster, so dump them separately with `pg_dumpall`:

```bash
# Roles and tablespaces only (pair this with pg_dump per database)
pg_dumpall --globals-only -f globals.sql

# Everything, as one plain SQL script
pg_dumpall -f all_databases.sql
psql -d postgres -f all_databases.sql
```

Logical dumps are easy and portable, but they have limits: the restore must rebuild every index, which is slow for large databases, and you can only go back to the moment of a dump.

## Physical Backups with pg_basebackup

`pg_basebackup` copies the whole data directory of a running cluster over a replication connection. The role it uses needs the `REPLICATION` attribute (or be a superuser), and `pg_hba.conf` needs a `replication` line for it.

```bash
# Compressed tar files, WAL included, with a progress bar
pg_basebackup -h localhost -U replicator -D /backup/base -Ft -z -P

# Check the copy against its manifest
pg_verifybackup -n /backup/base
```

- `-D`: target directory (must be empty or not exist).
- `-Ft -z`: write gzip-compressed tar files (`base.tar.gz` and `pg_wal.tar.gz`).
- `-P`: show progress.
- WAL needed to make the copy consistent is included by default (`-X stream`).
- A `backup_manifest` file lists every file and checksum. `pg_verifybackup` checks the backup against it. For tar-format backups it requires `-n`, which skips WAL parsing.

Physical backups restore much faster than dumps for large databases, because no index is rebuilt. They only restore to the same PostgreSQL major version and CPU architecture.

### Restoring from Base Backup

:::warning
These steps replace a cluster's data directory. Move the old directory aside instead of deleting it until the restored server is verified; it may hold the only copy of recent data.
:::

```bash
# Stop the cluster
sudo systemctl stop postgresql@18-main

# Keep the old data directory, create an empty one
sudo mv /var/lib/postgresql/18/main /var/lib/postgresql/18/main.old
sudo install -d -o postgres -g postgres -m 700 /var/lib/postgresql/18/main

# Unpack the base backup and its WAL
sudo -u postgres tar -xzf /backup/base/base.tar.gz -C /var/lib/postgresql/18/main
sudo -u postgres tar -xzf /backup/base/pg_wal.tar.gz -C /var/lib/postgresql/18/main/pg_wal

# Start it
sudo systemctl start postgresql@18-main
```

The restored server contains the data as of the end of the backup. To get closer to the moment of a failure, you need archived WAL.

## Continuous Archiving and Point-in-Time Recovery (PITR)

PostgreSQL writes every change to the WAL in 16 MB segment files. If you copy every finished segment somewhere safe, you can restore a base backup and replay the WAL to any moment after it: one second before someone ran `DROP TABLE`, for example.

### Setup WAL Archiving

In `postgresql.conf`:

```ini
wal_level = replica          # the default
archive_mode = on            # needs a restart
archive_command = 'test ! -f /mnt/wal_archive/%f && cp %p /mnt/wal_archive/%f'
archive_timeout = 60         # force a segment switch at least every 60 seconds
```

`%p` is the path of the segment to archive and `%f` its file name. The command must return 0 only when the file is safely stored; PostgreSQL keeps the segment and retries until it does. The `test ! -f` guard refuses to overwrite an existing file, which protects the archive if two servers point at the same place.

`archive_timeout` bounds your RPO on a quiet server: a segment is archived when it is full, and an idle server can take a long time to fill 16 MB.

:::warning
If archiving fails, PostgreSQL keeps every unarchived WAL segment in `pg_wal`, and the disk fills up until the server stops. Monitor `pg_stat_archiver` (below) and alert on failures. Copying to a local directory protects against nothing; the archive must be on another machine or in object storage. That is why most teams use pgBackRest or WAL-G instead of a hand-written `archive_command`.
:::

Restart PostgreSQL after changing `archive_mode`:

```bash
sudo systemctl restart postgresql@18-main
```

### Create Base Backup for PITR

Take a base backup as shown above. It marks the starting point from which WAL can be replayed:

```bash
pg_basebackup -h localhost -U replicator -D /backup/base_$(date +%F) -Ft -z -P
```

Backup tools that copy files themselves use the low-level API: `SELECT pg_backup_start('label');`, copy the data directory, then `SELECT * FROM pg_backup_stop();` in the **same** session. `pg_backup_stop()` returns the contents of a `backup_label` file (and a `tablespace_map` if you use tablespaces), which you must save into the backup; without them, it cannot be restored. PostgreSQL 15 renamed these functions from `pg_start_backup` and `pg_stop_backup` and removed the old exclusive backup mode, so older tutorials that call them no longer work.

### Restore to Point in Time

Say someone dropped a table at 14:31 UTC. Restore the latest base backup taken before that, and replay WAL up to 14:30:

```bash
sudo systemctl stop postgresql@18-main
sudo mv /var/lib/postgresql/18/main /var/lib/postgresql/18/main.old
sudo install -d -o postgres -g postgres -m 700 /var/lib/postgresql/18/main
sudo -u postgres tar -xzf /backup/base_2026-10-22/base.tar.gz -C /var/lib/postgresql/18/main
```

On Debian, `postgresql.conf` lives in `/etc/postgresql/18/main/`. Add the recovery settings there:

```ini
restore_command = 'cp /mnt/wal_archive/%f %p'
recovery_target_time = '2026-10-23 14:30:00+00'
recovery_target_action = 'promote'
```

Create `recovery.signal` in the data directory to start in recovery mode, then start the server:

```bash
sudo -u postgres touch /var/lib/postgresql/18/main/recovery.signal
sudo systemctl start postgresql@18-main
```

PostgreSQL fetches each WAL segment with `restore_command`, replays it, stops at the target time, and then (because of `recovery_target_action = 'promote'`) ends recovery and accepts writes. It removes `recovery.signal` itself. Follow progress in the server log, then:

1. Check the data: is the dropped table back, and is nothing newer than the target there?
2. Remove `restore_command` and the `recovery_target_*` settings from `postgresql.conf`, so a later restart does not try to recover again.
3. Take a new base backup. The server is now on a new **timeline**. Older backups can still reach it only if the archive holds the timeline history file and every WAL segment in between, so a fresh base backup is the simpler starting point.

The default `recovery_target_action` is `pause`, which stops at the target and keeps the server read-only, so you can check the data before you call `SELECT pg_wal_replay_resume();` to promote it.

### Incremental Backups (PostgreSQL 17+)

Since PostgreSQL 17, `pg_basebackup` can take **incremental** backups that copy only the blocks changed since an earlier backup. Enable WAL summaries first:

```ini
summarize_wal = on
```

Then take a full backup, followed by incremental ones that point at the previous backup's manifest:

```bash
pg_basebackup -D /backup/full -c fast
pg_basebackup -D /backup/incr1 --incremental=/backup/full/backup_manifest
pg_basebackup -D /backup/incr2 --incremental=/backup/incr1/backup_manifest
```

To restore, `pg_combinebackup` merges the chain into one ordinary data directory:

```bash
pg_combinebackup -o /var/lib/postgresql/18/restored /backup/full /backup/incr1 /backup/incr2
```

## Streaming Replication

A **standby** server receives the primary's WAL as it is written and replays it continuously. It can serve read-only queries and can be promoted to primary in seconds.

### Setup Primary Server

The defaults in PostgreSQL 18 already allow replication (`wal_level = replica`, `max_wal_senders = 10`). You only need the standby to be able to connect. In `postgresql.conf`:

```ini
listen_addresses = '*'
```

In `pg_hba.conf`, allow the standby's address to use the replication protocol:

```text
host    replication     replicator      10.0.1.20/32        scram-sha-256
```

Create the replication role:

```sql
CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD 'use-a-long-random-password';
```

Restart the primary to pick up `listen_addresses`:

```bash
sudo systemctl restart postgresql@18-main
```

### Setup Replica Server

On the standby, with the same PostgreSQL major version installed:

```bash
# Stop the cluster the package created and set its data directory aside
sudo systemctl stop postgresql@18-main
sudo mv /var/lib/postgresql/18/main /var/lib/postgresql/18/main.empty

# Clone the primary
sudo -u postgres pg_basebackup -h 10.0.1.10 -U replicator \
  -D /var/lib/postgresql/18/main \
  -R -X stream -C -S replica1 -P

sudo systemctl start postgresql@18-main
```

- `-R` writes `standby.signal` and the connection settings (`primary_conninfo`) into `postgresql.auto.conf`.
- `-X stream` streams the WAL needed during the copy.
- `-C -S replica1` creates a **replication slot** on the primary, so the primary keeps WAL until this standby has received it.

:::warning
A replication slot keeps WAL on the primary for as long as its standby is gone. If a standby is removed without dropping its slot, the primary's disk fills up. Set `max_slot_wal_keep_size` to cap it, and drop unused slots with `SELECT pg_drop_replication_slot('replica1');`.
:::

Check the result. On the primary:

```sql
SELECT client_addr, state, sync_state, replay_lag FROM pg_stat_replication;
```

On the standby, `SELECT pg_is_in_recovery();` returns `t`.

### Promote Replica to Primary

If the primary fails, promote the standby:

```bash
sudo pg_ctlcluster 18 main promote
```

Or from SQL on the standby: `SELECT pg_promote();`. Then point the application at the new primary. Make sure the old primary cannot come back and accept writes at the same time (fence it), or you end up with two diverging primaries. To turn the old primary into a standby of the new one, rebuild it with `pg_basebackup` or rewind it with `pg_rewind`. Tools such as Patroni automate failover ([Part 10](/guides/introduction-to-postgres/10-production-best-practices#h2-high-availability)).

:::important
Replication is not a backup. A `DROP TABLE` or a bad `UPDATE` reaches every standby within milliseconds. You still need backups with WAL archiving for point-in-time recovery.
:::

## Backup Strategies

### Daily Backups

A small, honest backup script: it stops at the first error, dumps roles separately, and removes old backups only after a new one succeeded:

```bash
#!/usr/bin/env bash
# /usr/local/bin/pg-daily-backup.sh, run as the postgres OS user
set -euo pipefail

BACKUP_ROOT=/backups/postgres
TODAY=$(date +%F)
DEST="$BACKUP_ROOT/$TODAY"
mkdir -p "$DEST"

# Roles and tablespaces
pg_dumpall --globals-only -f "$DEST/globals.sql"

# One custom-format dump per database. Fetch the list first, so a failing
# psql stops the script (set -e does not see failures inside for ... in $(...))
DBS=$(psql -At -c "SELECT datname FROM pg_database WHERE NOT datistemplate AND datname <> 'postgres'")
[ -n "$DBS" ] || { echo "no databases found" >&2; exit 1; }
for db in $DBS; do
  pg_dump -Fc -f "$DEST/$db.dump" "$db"
done

# Keep 14 days of backups
find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime +14 -exec rm -rf {} +
```

Schedule it with cron for the `postgres` user (`sudo crontab -u postgres -e`). On Debian and Ubuntu, `/var/log/postgresql` is writable by that user:

```text
0 2 * * * /usr/local/bin/pg-daily-backup.sh >> /var/log/postgresql/pg-daily-backup.log 2>&1
```

Alert when the job fails or when the newest backup is older than a day. A cron job that silently stopped working months ago is a common way to lose data.

### Backup to Cloud Storage

Copy backups off the server, preferably to a different account or provider:

```bash
#!/usr/bin/env bash
set -euo pipefail

FILE="/tmp/blog_$(date +%F).dump"
pg_dump -Fc -f "$FILE" blog
aws s3 cp "$FILE" "s3://example-db-backups/postgres/$(basename "$FILE")"
rm -f "$FILE"
```

Give the server's credentials permission to upload but not to delete, and turn on S3 Object Lock (or your provider's equivalent) so that nobody can delete or overwrite a backup during its retention period. Versioning alone is not enough: anyone allowed to delete object versions can still remove them. Set a lifecycle rule to expire old backups.

### Incremental Backups with pgBackRest

For databases where a nightly dump is too slow or loses too much data, use a backup tool. **pgBackRest** handles full, differential and incremental backups, parallel compression, WAL archiving to S3, GCS or Azure, encryption, and point-in-time restores. Barman and WAL-G are common alternatives. (WAL-E, which older guides mention, is no longer maintained.)

A minimal pgBackRest setup on the database server:

```ini
# /etc/pgbackrest/pgbackrest.conf
[global]
repo1-path=/var/lib/pgbackrest
repo1-retention-full=2
start-fast=y

[main]
pg1-path=/var/lib/postgresql/18/main
```

Point WAL archiving at it in `postgresql.conf` and restart:

```ini
archive_mode = on
archive_command = 'pgbackrest --stanza=main archive-push %p'
```

Then, as the `postgres` user:

```bash
pgbackrest --stanza=main stanza-create
pgbackrest --stanza=main check
pgbackrest --stanza=main --type=full backup
pgbackrest --stanza=main --type=incr backup
pgbackrest --stanza=main info

# Point-in-time restore (server stopped)
pgbackrest --stanza=main --delta \
  --type=time "--target=2026-10-23 14:30:00+00" --target-action=promote restore
```

In production, set `repo1-type=s3` (or `gcs`, `azure`) so the repository lives off the server.

## Testing Restores

**Untested backups are worthless.** Restore them on a schedule, check the result, and alert if anything fails:

```bash
#!/usr/bin/env bash
# Monthly restore test on a separate server
set -euo pipefail

LATEST=$(ls -1d /backups/postgres/*/ | tail -n 1)

dropdb --if-exists restore_test
createdb restore_test
pg_restore --exit-on-error -d restore_test -j 4 "$LATEST/blog.dump"

# Sanity checks: the table has rows, and the newest one is less than 2 days old
ROWS=$(psql -d restore_test -At -c "SELECT count(*) FROM users")
FRESH=$(psql -d restore_test -At -c "SELECT max(created_at) > now() - interval '2 days' FROM users")
[ "$ROWS" -gt 0 ] || { echo "restore test failed: users is empty" >&2; exit 1; }
[ "$FRESH" = "t" ] || { echo "restore test failed: newest user is too old" >&2; exit 1; }

dropdb restore_test
echo "restore test passed for $LATEST"
```

Record how long the restore took. That number is your real RTO, and it grows with the database.

## Monitoring Replication

On the primary, check each standby:

```sql
SELECT application_name,
       client_addr,
       state,
       sync_state,
       write_lag,
       flush_lag,
       replay_lag,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn)) AS replay_behind
FROM pg_stat_replication;
```

On a standby, see how far behind replay is in time:

```sql
SELECT now() - pg_last_xact_replay_timestamp() AS replication_delay;
```

On an idle primary this value grows even when the standby is fully caught up, because no new transactions arrive; compare WAL positions for an exact answer.

Check slots and archiving too:

```sql
-- Slots that hold WAL for a disconnected standby
SELECT slot_name, active, wal_status,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS retained_wal
FROM pg_replication_slots;

-- Archiving failures
SELECT archived_count, last_archived_wal, failed_count, last_failed_wal, last_failed_time
FROM pg_stat_archiver;
```

Alert when lag grows beyond what your RPO allows, when a slot is inactive, and when `failed_count` increases.

## Disaster Recovery Plan

Write the procedure down before you need it:

1. **Identify the failure**: hardware, corruption, accidental deletion, or an attack.
2. **Stop the damage**: pause the application or revoke write access if bad writes are still happening.
3. **Find the point in time**: when did the problem start? Application logs and `pg_stat_statements` help.
4. **Choose the recovery method**:
   - Primary down, data intact: promote a standby.
   - Data deleted or corrupted: point-in-time recovery to just before the event.
   - One table lost: restore a dump or PITR copy to a separate server and copy the table back.
5. **Execute the documented steps**, preferably by someone who has practiced them.
6. **Verify the data** with queries that you prepared in advance.
7. **Resume operations** and point the application at the recovered database.
8. **Run a post-mortem** and update this plan.

## Backup Best Practices

**Follow 3-2-1**: three copies of the data, on two different kinds of storage, one of them off-site.

**Automate everything**, including the alerts when a backup or an archive command fails.

**Test restores** at least monthly, and time them.

**Encrypt backups** and keep the keys somewhere you can reach when the main systems are down.

**Protect backups from deletion**: separate credentials, versioned or immutable storage.

**Keep several generations**, so a problem noticed a week late is still recoverable.

**Document the procedure** so anyone on call can restore, not only the person who set it up.

## Common Mistakes

- **Treating replication as a backup.** Standbys copy mistakes instantly.
- **Never testing a restore.** Many teams find out that backups are empty, incomplete or unreadable during an incident.
- **Keeping backups on the database server.** One disk failure or one compromised account removes both.
- **Forgetting roles.** `pg_dump` does not include them; dump them with `pg_dumpall --globals-only`.
- **Unmonitored WAL archiving.** A failing `archive_command` fills the disk; a missing segment breaks point-in-time recovery after that point.
- **Abandoned replication slots.** They retain WAL until the primary runs out of disk.
- **Following old tutorials** that call `pg_start_backup()` or edit `recovery.conf`. Both were replaced (in PostgreSQL 15 and 12).

## Summary

You can now take logical backups with `pg_dump` and restore them with `pg_restore`, take physical backups with `pg_basebackup`, archive WAL for point-in-time recovery, use incremental backups on PostgreSQL 17 and later, and set up a streaming standby. You also have scripts for daily backups and restore tests, and a plan for the day you need them.

Next, in [Production Best Practices and Operations](/guides/introduction-to-postgres/10-production-best-practices), you will secure, tune, monitor and upgrade PostgreSQL in production.
