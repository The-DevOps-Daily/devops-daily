---
title: Production Best Practices and Operations
description: 'Run PostgreSQL in production: scram-sha-256 and TLS, memory tuning, PgBouncer, monitoring, autovacuum, Patroni failover and major upgrades.'
order: 10
---

**TLDR**: Give applications their own least-privilege roles, require `scram-sha-256` and TLS, and allow only known networks in `pg_hba.conf`. Watch connections, cache hit ratio, slow queries, replication lag, dead rows and transaction ID age. Size `shared_buffers` and `work_mem` for your hardware, and put PgBouncer in front of the database when you have many clients. Keep autovacuum on and tune it for big tables. Use Patroni for automatic failover, test every change in staging, and upgrade major versions with `pg_upgrade`.

Running PostgreSQL in production is mostly about the boring parts: who can connect, what you watch, what happens when a disk fills up or a server dies, and how you upgrade without surprises. This last part collects the practices and runbooks that keep a PostgreSQL 18 server healthy, with the configuration snippets you need.

## Prerequisites

- Everything from the earlier parts, especially [backups and replication](/guides/introduction-to-postgres/09-backup-and-recovery) and [indexes](/guides/introduction-to-postgres/07-indexes-and-performance).
- A server you administer. Paths are for Debian and Ubuntu; see [Part 2](/guides/introduction-to-postgres/02-installation-and-setup#h2-understanding-postgresqls-structure) for other platforms.

If you use a managed service (Amazon RDS, Cloud SQL, Azure Database for PostgreSQL, Neon and others), the provider handles installation, backups, failover and minor upgrades. Roles, query performance, connection pooling, vacuum health and major upgrades stay your job.

## Security

### Authentication

On Linux packages, the `postgres` superuser has no password and can only log in through the local socket with peer authentication. Keep it that way: administrators run `sudo -u postgres psql` on the server, and nothing connects as `postgres` over the network.

Each application gets two roles: one that owns the schema and runs migrations, and one that the running application uses, with only the privileges it needs:

```sql
CREATE ROLE app_migrator WITH LOGIN PASSWORD 'long-random-password-1';
CREATE ROLE app_user WITH LOGIN PASSWORD 'long-random-password-2';
GRANT CONNECT ON DATABASE myapp TO app_migrator, app_user;

\c myapp
CREATE SCHEMA app AUTHORIZATION app_migrator;
GRANT USAGE ON SCHEMA app TO app_user;

-- Tables that app_migrator creates from now on are readable and writable by app_user
ALTER DEFAULT PRIVILEGES FOR ROLE app_migrator IN SCHEMA app
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER ROLE app_user SET search_path = app;
```

Default privileges apply to objects created by the role named in `FOR ROLE` (without it, by the role running the command), so name the migration role explicitly. The application role cannot create, alter or drop tables. For read-only users, grant `pg_read_all_data`.

New passwords are stored as SCRAM-SHA-256 hashes by default. MD5 is deprecated in PostgreSQL 18; find roles that still have an MD5 hash and reset their passwords:

```sql
SELECT rolname FROM pg_authid WHERE rolpassword LIKE 'md5%';
```

### SSL/TLS Connections

Encrypt every connection that leaves the server. In `postgresql.conf`:

```ini
ssl = on
ssl_cert_file = '/etc/postgresql/18/main/server.crt'
ssl_key_file = '/etc/postgresql/18/main/server.key'
ssl_min_protocol_version = 'TLSv1.2'   # the default; use TLSv1.3 if all clients support it
```

The key file must be owned by the `postgres` user and not readable by others (`chmod 600`). Debian and Ubuntu enable SSL out of the box with a self-signed "snakeoil" certificate; replace it with one from your certificate authority.

Use `hostssl` lines in `pg_hba.conf` so non-TLS connections from the network are refused:

```text
hostssl    myapp    app_user    10.0.1.0/24    scram-sha-256
```

On the client, `sslmode=require` encrypts but does not check who you are talking to. Use `verify-full` with the CA certificate so a man in the middle cannot pose as your server:

```bash
psql "host=db.example.com dbname=myapp user=app_user sslmode=verify-full sslrootcert=/etc/ssl/certs/db-ca.pem"
```

### Network Security

Allow only the networks that need access, and end `pg_hba.conf` with an explicit `reject`:

```text
# TYPE    DATABASE  USER       ADDRESS          METHOD
local     all       postgres                    peer
hostssl   myapp     app_user   10.0.1.0/24      scram-sha-256
hostssl   all       all        0.0.0.0/0        reject
hostssl   all       all        ::/0             reject
```

Put a firewall in front as a second layer:

```bash
# UFW: allow the app subnet, deny everyone else
sudo ufw allow from 10.0.1.0/24 to any port 5432 proto tcp
sudo ufw deny 5432/tcp
```

Never expose PostgreSQL to the whole internet. If people need access from outside, use a VPN or a bastion host.

### Audit Logging

Log connection attempts and changes to the schema:

```ini
# postgresql.conf
log_connections = 'receipt,authentication,authorization'   # PostgreSQL 17 and older: on
log_disconnections = on
log_statement = 'ddl'                  # CREATE, ALTER, DROP
log_min_duration_statement = '1s'      # plus every statement slower than 1 second
```

In PostgreSQL 18, `log_connections` takes a list of what to log (`receipt`, `authentication`, `authorization`, `setup_durations`, or `all`); `on` still works. `log_statement = 'all'` logs every query, including any secret values in them, and can produce huge logs on a busy server. For a real audit trail with per-object rules, use the [pgAudit](https://www.pgaudit.org/) extension.

### Row-Level Security

Row-level security (RLS) filters rows per user inside the database, which protects multi-tenant data even when application code forgets a `WHERE` clause:

```sql
CREATE TABLE documents (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id bigint NOT NULL,
  content text
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON documents
  FOR ALL
  TO app_user
  USING (tenant_id = current_setting('app.tenant_id')::bigint)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::bigint);

-- The application sets the tenant at the start of each transaction:
BEGIN;
SET LOCAL app.tenant_id = '123';
SELECT * FROM documents;  -- only tenant 123's rows
COMMIT;
```

Superusers and roles with `BYPASSRLS` always bypass RLS. Table owners bypass it too, unless you run `ALTER TABLE documents FORCE ROW LEVEL SECURITY;`. Use `SET LOCAL` (transaction scope) rather than `SET` when you connect through a pooler, so one client's tenant id cannot leak to the next client on the same server connection.

## Monitoring

### Key Metrics

**Connections**, compared with the limit:

```sql
SELECT count(*) AS connections,
       current_setting('max_connections')::int AS max_connections
FROM pg_stat_activity
WHERE backend_type = 'client backend';

-- What the connections are doing
SELECT state, count(*) FROM pg_stat_activity GROUP BY state;
```

Alert well before the limit. Many connections `idle in transaction` point to an application bug.

**Database size**:

```sql
SELECT datname, pg_size_pretty(pg_database_size(datname)) AS size
FROM pg_database
ORDER BY pg_database_size(datname) DESC;
```

**Largest tables**, including indexes and TOAST:

```sql
SELECT schemaname, relname,
       pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 20;
```

**Cache hit ratio** for table reads:

```sql
SELECT round(sum(heap_blks_hit) / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0), 4) AS ratio
FROM pg_statio_user_tables;
```

For an OLTP workload this is usually above 0.99. A falling ratio means the working set no longer fits in memory. A "read" here may still come from the operating system's page cache, so also look at disk I/O on the host.

**Long-running queries and transactions**:

```sql
SELECT pid, usename, state,
       now() - query_start AS query_age,
       now() - xact_start AS xact_age,
       left(query, 80) AS query
FROM pg_stat_activity
WHERE state <> 'idle'
  AND now() - xact_start > interval '5 minutes'
ORDER BY xact_start;
```

Cancel a query with `SELECT pg_cancel_backend(pid);`, or end the whole session with `SELECT pg_terminate_backend(pid);`.

**Dead rows and vacuum progress**:

```sql
SELECT relname, n_live_tup, n_dead_tup, last_autovacuum, last_autoanalyze
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC
LIMIT 10;
```

**Transaction ID age**. PostgreSQL transaction IDs are 32-bit and wrap around. Vacuum "freezes" old rows to prevent that. If freezing falls too far behind, PostgreSQL stops accepting writes to protect your data:

```sql
SELECT datname, age(datfrozenxid) AS xid_age
FROM pg_database
ORDER BY xid_age DESC;
```

Autovacuum forces a freeze at 200 million by default (`autovacuum_freeze_max_age`). Alert if the age passes about 1 billion; the hard stop comes a little before 2^31 (about 2.1 billion).

**Replication lag** (see [Part 9](/guides/introduction-to-postgres/09-backup-and-recovery#h2-monitoring-replication)):

```sql
SELECT application_name, replay_lag FROM pg_stat_replication;
```

### Monitoring Tools

- **pg_stat_statements**: per-query call counts and timings ([Part 7](/guides/introduction-to-postgres/07-indexes-and-performance#h3-pg_stat_statements)). Install it on every production server.
- **pg_stat_io** (PostgreSQL 16+): reads, writes and fsyncs by backend type, for finding where I/O comes from.
- **Prometheus with postgres_exporter**, plus Grafana dashboards: the common open-source stack.
- **Hosted monitoring** such as Datadog, pganalyze or your cloud provider's database insights, if you prefer not to run the stack yourself.
- **The server log**: errors, slow queries, checkpoints (`log_checkpoints` is on by default) and autovacuum runs (`log_autovacuum_min_duration`).

## Performance Tuning

### Configuration

The defaults are sized for a small machine. A starting point for a dedicated server with 16 GB of RAM and SSD storage:

```ini
# Memory
shared_buffers = 4GB                 # about 25% of RAM
effective_cache_size = 12GB          # planner hint: RAM available for caching
work_mem = 32MB                      # per sort or hash operation, see below
maintenance_work_mem = 1GB           # VACUUM, CREATE INDEX
huge_pages = try                     # use huge pages if the OS provides them

# Connections
max_connections = 200                # keep it modest; use a pooler

# Planner and I/O, for SSDs
random_page_cost = 1.1               # default 4.0 assumes spinning disks
effective_io_concurrency = 200       # default 16 in PostgreSQL 18 (1 before)
io_method = worker                   # PostgreSQL 18 default; io_uring on Linux builds that support it

# WAL and checkpoints
max_wal_size = 4GB                   # fewer, larger checkpoints
min_wal_size = 1GB
checkpoint_timeout = 15min

# Logging
log_min_duration_statement = '1s'
log_line_prefix = '%m [%p] %q%u@%d '
```

`work_mem` is the most misunderstood setting: it applies **per operation**, not per connection. One complex query can use several multiples of it at once (hash operations may use twice as much, see `hash_mem_multiplier`), and every connection can do the same. Raise it for reporting roles only (`ALTER ROLE reporting SET work_mem = '256MB';`) rather than globally. When a query spills to disk, `EXPLAIN ANALYZE` shows `Sort Method: external merge  Disk: ...`.

`shared_buffers`, `max_connections`, `huge_pages` and `io_method` need a restart; the other settings above need a reload:

```bash
sudo systemctl restart postgresql@18-main
```

Change one thing at a time and measure. Tools such as PGTune give a reasonable first draft for your hardware.

### Connection Pooling

Each PostgreSQL connection is a separate operating system process with its own memory. Thousands of connections waste memory and CPU on context switches, even when most of them are idle. A pooler lets many clients share a few server connections:

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "App instances", "sub": "hundreds of client connections", "icon": "box", "tone": "blue" },
    { "label": "PgBouncer :6432", "sub": "pool_mode = transaction", "icon": "queue", "tone": "amber" },
    { "label": "PostgreSQL :5432", "sub": "about 25 server connections", "icon": "database", "tone": "violet" }
  ]
}
```

PgBouncer is the most widely used pooler:

```bash
sudo apt install -y pgbouncer
```

```ini
; /etc/pgbouncer/pgbouncer.ini
[databases]
myapp = host=127.0.0.1 port=5432 dbname=myapp

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 2000
default_pool_size = 25
```

`userlist.txt` holds one line per role: `"app_user" "SCRAM-SHA-256$4096:..."`, where the secret is the `rolpassword` value from `pg_authid` (or the plain-text password). Applications connect to port 6432 instead of 5432.

PgBouncer connects to PostgreSQL from `127.0.0.1`, so `pg_hba.conf` needs a line for it, for example `host myapp app_user 127.0.0.1/32 scram-sha-256`. If clients reach PgBouncer over the network, turn on TLS between them as well (`client_tls_sslmode = require` plus `client_tls_cert_file` and `client_tls_key_file`); PgBouncer does not enable it by default.

In **transaction** mode, a client holds a server connection only for the duration of a transaction. That gives the best reuse, but session state does not survive between transactions: `SET` (use `SET LOCAL`), session-level advisory locks, `LISTEN`, and temporary tables do not work as expected. PgBouncer 1.21 and later support protocol-level prepared statements in transaction mode (`max_prepared_statements`, 200 by default since 1.24).

### Vacuum and Analyze

Because of MVCC ([Part 8](/guides/introduction-to-postgres/08-transactions-and-concurrency#h2-how-postgresql-isolates-transactions-mvcc)), every update and delete leaves a dead row version behind. `VACUUM` makes that space reusable and freezes old rows; `ANALYZE` refreshes the statistics the planner uses. **Autovacuum** does both in the background, and it must stay on.

```sql
VACUUM (VERBOSE) users;    -- reclaim space for reuse; reads and writes continue
ANALYZE users;             -- refresh statistics
VACUUM (ANALYZE) users;    -- both
```

Plain `VACUUM` can briefly take a stronger lock at the end, to give empty pages at the end of the table back to the operating system; it skips that step if the lock is not free. `VACUUM FULL` rewrites the whole table to return space, but it holds an `ACCESS EXCLUSIVE` lock the whole time: nothing can read or write the table. On a live system, use the `pg_repack` extension instead.

The default autovacuum thresholds start a vacuum when 20% of a table's rows are dead. On a table with 500 million rows, that is 100 million dead rows. PostgreSQL 18 adds a cap, `autovacuum_vacuum_max_threshold` (100 million by default). Tune big, busy tables individually:

```sql
ALTER TABLE events SET (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_analyze_scale_factor = 0.01
);
```

If autovacuum cannot keep up, give it more resources rather than less: raise `autovacuum_vacuum_cost_limit`, and `autovacuum_max_workers` for many busy tables. Long-running transactions block cleanup no matter how you tune it.

### Reindex

Indexes on heavily updated tables can bloat. Rebuild them without blocking writes:

```sql
REINDEX INDEX CONCURRENTLY users_email_idx;
REINDEX TABLE CONCURRENTLY users;
```

Plain `REINDEX DATABASE` blocks writes to each table while its indexes are rebuilt; avoid it on a live system.

## Capacity Planning

### Disk Space

Watch disk usage on the host:

```bash
df -h /var/lib/postgresql
```

Alert at 80% and act before 90%. Running out of disk stops the server: PostgreSQL cannot write WAL. Remember the space that `pg_wal` needs during write bursts, failed archiving and inactive replication slots.

Record database sizes over time so you can forecast growth:

```sql
CREATE TABLE db_size_history (
  recorded_at timestamptz NOT NULL DEFAULT now(),
  database_name text NOT NULL,
  size_bytes bigint NOT NULL
);

-- Run daily, for example with cron or the pg_cron extension
INSERT INTO db_size_history (database_name, size_bytes)
SELECT datname, pg_database_size(datname) FROM pg_database WHERE NOT datistemplate;
```

### Connection Limits

If you hit `max_connections`:

1. **Add a connection pooler.** This is the real fix.
2. **Fix the application**: close idle connections, size its own pool to what it needs, set `idle_in_transaction_session_timeout`.
3. **Raise `max_connections`** only as a last step. Each connection costs memory, and many active connections compete for CPU.

### Read Replicas

Scale reads by sending them to streaming replicas ([Part 9](/guides/introduction-to-postgres/09-backup-and-recovery#h2-streaming-replication)) and writes to the primary. Replicas are slightly behind, so read-your-own-writes paths (for example, showing a user the comment they just posted) should read from the primary.

## High Availability

### Automatic Failover

Promoting a standby by hand works, but someone has to notice the failure at 3 AM, make sure the old primary is really gone, and repoint the applications. **Patroni** automates that. It runs next to PostgreSQL on every node and uses a distributed configuration store (etcd, Consul or ZooKeeper) to elect exactly one leader:

```diagram
{
  "type": "infra",
  "flow": [
    { "label": "Application", "icon": "box", "tone": "blue" },
    { "label": "HAProxy :5000 / :5001", "sub": "routes by Patroni health checks", "icon": "net", "tone": "amber" }
  ],
  "groups": [
    {
      "label": "PostgreSQL nodes",
      "sub": "Patroni on each node",
      "icon": "server",
      "tone": "violet",
      "nodes": [
        { "label": "node1", "sub": "primary", "icon": "database", "tone": "green", "status": "ok" },
        { "label": "node2", "sub": "replica", "icon": "database", "tone": "slate", "status": "ok" },
        { "label": "node3", "sub": "replica", "icon": "database", "tone": "slate", "status": "ok" }
      ]
    },
    {
      "label": "etcd cluster",
      "sub": "leader lock and cluster state",
      "icon": "gear",
      "tone": "slate",
      "nodes": [
        { "label": "etcd1", "icon": "gear", "tone": "slate" },
        { "label": "etcd2", "icon": "gear", "tone": "slate" },
        { "label": "etcd3", "icon": "gear", "tone": "slate" }
      ]
    }
  ]
}
```

A minimal Patroni configuration for one node:

```yaml
# /etc/patroni/patroni.yml
scope: pg-cluster
name: node1

restapi:
  listen: 0.0.0.0:8008
  connect_address: 10.0.1.11:8008

etcd3:
  hosts: 10.0.1.21:2379,10.0.1.22:2379,10.0.1.23:2379

bootstrap:
  dcs:
    ttl: 30
    loop_wait: 10
    retry_timeout: 10
    maximum_lag_on_failover: 1048576
    postgresql:
      use_pg_rewind: true

postgresql:
  listen: 0.0.0.0:5432
  connect_address: 10.0.1.11:5432
  data_dir: /var/lib/postgresql/18/main
  bin_dir: /usr/lib/postgresql/18/bin
  authentication:
    superuser:
      username: postgres
      password: change-me
    replication:
      username: replicator
      password: change-me
  pg_hba:
    - local all all peer
    - hostssl replication replicator 10.0.1.0/24 scram-sha-256
    - hostssl all all 10.0.1.0/24 scram-sha-256
```

Use the `etcd3` section with current etcd releases; etcd 3.6 removed the old v2 API that the `etcd` section talks to. Patroni then owns PostgreSQL: start and stop the Patroni service with `systemctl`, use `patronictl` for switchovers, restarts and configuration changes, and do not manage the PostgreSQL instance directly with `pg_ctlcluster`. The `pg_hba` list above lets the nodes replicate from each other; Patroni writes it into `pg_hba.conf` on every node.

### Load Balancers

Applications need to find the current primary after a failover. HAProxy can route connections using Patroni's REST API: `/primary` returns 200 only on the leader, and `/replica` only on healthy replicas:

```text
# /etc/haproxy/haproxy.cfg
listen postgres_primary
    bind *:5000
    option httpchk HEAD /primary
    http-check expect status 200
    default-server inter 3s fall 3 rise 2 on-marked-down shutdown-sessions
    server node1 10.0.1.11:5432 maxconn 100 check port 8008
    server node2 10.0.1.12:5432 maxconn 100 check port 8008
    server node3 10.0.1.13:5432 maxconn 100 check port 8008

listen postgres_replicas
    bind *:5001
    balance roundrobin
    option httpchk HEAD /replica
    http-check expect status 200
    default-server inter 3s fall 3 rise 2 on-marked-down shutdown-sessions
    server node1 10.0.1.11:5432 maxconn 100 check port 8008
    server node2 10.0.1.12:5432 maxconn 100 check port 8008
    server node3 10.0.1.13:5432 maxconn 100 check port 8008
```

Writes go to port 5000, reads that tolerate a little lag go to port 5001. Alternatively, libpq can do simple failover itself: list several hosts and ask for the primary with `postgresql://app@10.0.1.11,10.0.1.12,10.0.1.13/myapp?target_session_attrs=read-write`.

## Common Production Issues

### Query Performance

**Symptom**: pages get slow, CPU or I/O climbs.

**Diagnosis**:

```sql
-- Which queries cost the most time in total?
SELECT left(query, 80) AS query, calls,
       round(total_exec_time::numeric) AS total_ms,
       round(mean_exec_time::numeric, 1) AS mean_ms
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;
```

Then run `EXPLAIN ANALYZE` on the worst ones.

**Fix**: add or change indexes, rewrite the query, refresh statistics with `ANALYZE`, or raise `work_mem` for queries that spill to disk.

### Connection Exhaustion

**Symptom**: new connections fail with:

```text
FATAL:  sorry, too many clients already
FATAL:  remaining connection slots are reserved for roles with the SUPERUSER attribute
```

**Diagnosis**:

```sql
SELECT usename, application_name, state, count(*)
FROM pg_stat_activity
GROUP BY 1, 2, 3
ORDER BY count(*) DESC;
```

**Fix**: put a pooler in front, fix connection leaks in the application, end idle sessions (`idle_session_timeout`, `idle_in_transaction_session_timeout`). The few slots reserved by `superuser_reserved_connections` (3 by default) let an administrator still log in to clean up.

### Disk Full

**Symptom**: writes fail with `could not extend file` or `No space left on device`, or the server shuts down because it cannot write WAL.

**Diagnosis**:

```bash
df -h
sudo du -sh /var/lib/postgresql/18/main/pg_wal
```

```sql
-- Inactive replication slots that hold WAL
SELECT slot_name, active, pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn))
FROM pg_replication_slots;

-- Failing WAL archiving
SELECT failed_count, last_failed_wal, last_failed_time FROM pg_stat_archiver;
```

**Fix**: free space outside the data directory first (old logs and backups), drop abandoned replication slots, fix the archive command, and grow the volume.

:::warning
Never delete files in `pg_wal` (or anything else in the data directory) by hand to free space. PostgreSQL needs those WAL segments to recover, and removing them can leave the cluster unable to start or silently corrupt data.
:::

### Replication Lag

**Symptom**: replicas return stale data, or lag alerts fire.

**Diagnosis**:

```sql
SELECT application_name,
       pg_size_pretty(pg_wal_lsn_diff(sent_lsn, replay_lsn)) AS replay_behind,
       replay_lag
FROM pg_stat_replication;
```

**Fix**: look for long queries on the replica that hold back replay (`max_standby_streaming_delay`), saturated replica disks, or network limits. Heavy write bursts on the primary (bulk loads, big index builds) produce lag that recovers on its own.

## Upgrade Procedures

### Minor Version Upgrades

Minor releases (18.5 to 18.6) contain only bug and security fixes and keep the data format. Install the new packages and restart:

```bash
sudo apt update
sudo apt install --only-upgrade postgresql-18
sudo systemctl restart postgresql@18-main
```

Read the release notes first: some releases ask you to reindex certain index types or run a specific command afterward. Apply minor releases promptly. They come out every three months, and some contain security fixes. Restart replicas before the primary.

### Major Version Upgrades

A major upgrade (17 to 18) changes the on-disk format. On Debian and Ubuntu, `pg_upgradecluster` wraps the whole process:

```bash
sudo apt install -y postgresql-18

# The package created an empty 18/main cluster: drop it so the upgrade can use the name
sudo pg_dropcluster --stop 18 main

# Upgrade with pg_upgrade (the default method is a slower dump and restore)
sudo pg_upgradecluster -m upgrade 17 main

# After testing the new cluster, remove the old one
sudo pg_dropcluster 17 main
```

The old cluster moves to a free port and is set not to start at boot, so you can go back to it if something fails. Use `-m link` for a much faster upgrade that hard-links data files instead of copying them; you then cannot start the old cluster again after the new one has run.

On other systems, run `pg_upgrade` directly. Always start with `--check`, which reports problems without changing anything:

```bash
sudo systemctl stop postgresql-17
sudo -u postgres /usr/pgsql-18/bin/pg_upgrade \
  --old-datadir=/var/lib/pgsql/17/data \
  --new-datadir=/var/lib/pgsql/18/data \
  --old-bindir=/usr/pgsql-17/bin \
  --new-bindir=/usr/pgsql-18/bin \
  --check
```

Then run the same command without `--check`. Add `--link` (hard links) or, new in PostgreSQL 18, `--swap` (moves files from the old data directory into the new one) to avoid copying the data. Both are much faster than the default copy, but the old cluster cannot be used again afterwards (with `--swap`, as soon as the file transfer starts), so take a backup first.

Things to know for an upgrade to PostgreSQL 18:

- **Data checksums**: `initdb` enables them by default since PostgreSQL 18, and `pg_upgrade` requires both clusters to match. If the old cluster has no checksums, create the new one with `initdb --no-data-checksums` (on RHEL: `PGSETUP_INITDB_OPTIONS="--no-data-checksums" /usr/pgsql-18/bin/postgresql-18-setup initdb`), or enable checksums on the stopped old cluster first with `pg_checksums --enable`. Debian's `pg_upgradecluster` matches the old cluster's setting for you.
- **Planner statistics**: `pg_upgrade` now keeps them, so the new cluster performs well right away. Extended statistics are not kept; run `vacuumdb --all --analyze-in-stages --missing-stats-only` after the upgrade.
- **Extensions**: install the PostgreSQL 18 build of every extension you use before upgrading, then run `ALTER EXTENSION ... UPDATE` where needed.
- **MD5 passwords** still work but print deprecation warnings when set; plan the move to SCRAM.

Test the upgrade on a copy of production first (a restored backup works), and make sure you have a fresh backup before you start. For near-zero downtime, upgrade with logical replication instead: replicate into a new PostgreSQL 18 cluster and switch over.

## Disaster Recovery Runbooks

Write runbooks for the failures you can predict:

- Primary server failure
- Data corruption
- Accidental data deletion
- Disk full
- Security breach
- Sudden performance drop

Example runbook (for a setup without Patroni):

```text
RUNBOOK: Primary database server failure

1. Confirm the primary is down:
   - Check monitoring alerts and try: pg_isready -h primary.internal
   - Make sure it is really down, not just unreachable from one place.

2. Fence the old primary:
   - Stop it, or block its port, so it cannot accept writes if it comes back.

3. Promote the standby:
   ssh replica.internal
   sudo pg_ctlcluster 18 main promote

4. Point the application at the new primary:
   - Update DNS or the connection string, then restart or reload the app.

5. Verify:
   - Application logs show successful queries.
   - SELECT pg_is_in_recovery(); returns f on the new primary.

6. Restore redundancy:
   - Rebuild the old primary as a standby (pg_basebackup or pg_rewind).
   - Confirm backups and WAL archiving run against the new primary.

7. Afterwards:
   - Write up what happened and update this runbook.
```

## Checklist for Production PostgreSQL

- [ ] Applications use dedicated least-privilege roles, never `postgres`
- [ ] Passwords use `scram-sha-256`; no MD5 hashes remain
- [ ] TLS on for network connections, `hostssl` in `pg_hba.conf`
- [ ] Only known networks allowed; firewall in place
- [ ] Automated backups with WAL archiving, stored off the server
- [ ] Restores tested and timed on a schedule
- [ ] Monitoring and alerting for connections, disk, lag, slow queries, XID age
- [ ] `pg_stat_statements` installed
- [ ] Connection pooling in place
- [ ] Autovacuum on and tuned for large tables
- [ ] Standby replica and a tested failover procedure
- [ ] Timeouts set for application roles
- [ ] Staging environment that mirrors production
- [ ] Minor upgrades applied within weeks; major upgrade plan before end of life
- [ ] Runbooks written and practiced

## Common Mistakes

- **Exposing port 5432 to the internet** or allowing `0.0.0.0/0` in `pg_hba.conf`.
- **Applications connecting as a superuser.**
- **Turning off autovacuum** because it "uses resources". Dead rows pile up, queries slow down, and transaction ID wraparound can stop writes.
- **Raising `max_connections` to thousands** instead of adding a pooler.
- **Setting a large global `work_mem`.** It is per operation, and many sessions can run at once.
- **Running `VACUUM FULL` or plain `CREATE INDEX` on busy tables** during business hours.
- **Ignoring minor releases**, and with them security fixes.
- **Running an end-of-life version.** PostgreSQL 13 is already unsupported, and PostgreSQL 14 reaches end of life in November 2026.

## Summary

Running PostgreSQL well comes down to a few habits: least privilege and encrypted connections, monitoring the metrics that warn you early, keeping vacuum healthy, pooling connections, having a failover plan you have practiced, and upgrading on schedule.

That completes this guide. You have gone from [database fundamentals](/guides/introduction-to-postgres/01-database-fundamentals) and [installing PostgreSQL](/guides/introduction-to-postgres/02-installation-and-setup) through SQL, schema design, indexes, transactions and backups to production operations. From here, explore what makes PostgreSQL stand out: extensions such as PostGIS for geographic data and pg_cron for scheduled jobs, full-text search, logical replication, and partitioning for very large tables. The [PostgreSQL documentation](https://www.postgresql.org/docs/current/) is excellent, and the community mailing lists and forums are friendly to newcomers. Go back to the [guide overview](/guides/introduction-to-postgres) at any time.
