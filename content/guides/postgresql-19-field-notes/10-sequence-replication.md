---
title: 'Sequence Replication and Safe Failover'
navTitle: 'Sequence replication'
description: 'PostgreSQL 19 logical replication can copy sequence values with ALL SEQUENCES and REFRESH SEQUENCES. When values move, the duplicate key it prevents, and the cutover order.'
order: 10
---

**TLDR**: Through PostgreSQL 18, logical replication copied rows but not sequence values, so a promoted subscriber handed out IDs that the old primary had already used. PostgreSQL 19 adds `ALL SEQUENCES` to publications and `ALTER SUBSCRIPTION ... REFRESH SEQUENCES`. Values are copied at specific moments, not continuously: at subscription creation, and when you run the refresh. A cutover runbook must run the refresh inside the write freeze and check the result. The same release adds `FOR ALL TABLES EXCEPT (TABLE ...)`.

An identity column advances its sequence on the publisher with every insert. Through 18, the subscriber's copy of that sequence stayed at its start value. Nothing reads the subscriber's sequences during normal replication, so nobody notices until the subscriber is promoted, in a failover or at the end of a logical-replication upgrade, and the application starts inserting there. The first new rows then collide with IDs the old primary already gave out.

PostgreSQL 19 adds sequence synchronization to logical replication ([release notes](https://www.postgresql.org/docs/19/release-19.html), [replicating sequences](https://www.postgresql.org/docs/19/logical-replication-sequences.html)).

## Prerequisites

- Two PostgreSQL 19 servers, a publisher and a subscriber. The publisher must run 19 for sequence synchronization. From an 18 publisher, you still copy sequence values yourself, as the [upgrade checklist post](/posts/postgresql-19-upgrade-checklist#h3-with-logical-replication) shows.
- The publisher does not need `wal_level = logical` any more: creating the subscription's slot raises the level on its own, as the [previous part](/guides/postgresql-19-field-notes/09-logical-decoding-without-restart) showed. On our publisher, `effective_wal_level` read `logical` right after the subscription was created.

With Docker, put two containers on one network:

```bash
docker network create pg19net
docker run -d --name pg19pub --network pg19net \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=lab postgres:19
docker run -d --name pg19sub --network pg19net \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=lab postgres:19
until docker exec pg19sub pg_isready -h localhost -q; do sleep 1; done
```

## Set Up a Publication with Sequences

On the publisher:

```sql
CREATE TABLE invoices (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  amount numeric NOT NULL
);
CREATE TABLE audit_log (id int PRIMARY KEY, note text);
INSERT INTO invoices (amount) SELECT 100 FROM generate_series(1, 2000);
CREATE PUBLICATION billing
  FOR ALL TABLES EXCEPT (TABLE audit_log), ALL SEQUENCES;
SELECT tablename FROM pg_publication_tables WHERE pubname = 'billing' ORDER BY 1;
SELECT * FROM pg_publication_sequences WHERE pubname = 'billing';
```

```text
 tablename
-----------
 invoices

 pubname | schemaname |  sequencename
---------+------------+-----------------
 billing | public     | invoices_id_seq
```

The "all" forms go together and cannot be mixed with a list of single tables. `CREATE PUBLICATION mixed FOR ALL TABLES, TABLE invoices;` fails with `syntax error at or near "TABLE"`. `FOR ALL TABLES` and `ALL SEQUENCES` need superuser.

On the subscriber, create the same table and subscribe:

```sql
CREATE TABLE invoices (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  amount numeric NOT NULL
);
CREATE SUBSCRIPTION billing_sub
  CONNECTION 'host=pg19pub dbname=lab user=postgres password=postgres'
  PUBLICATION billing;
```

Wait until every relation has state `r` (ready), then compare:

```sql
SELECT srrelid::regclass, srsubstate FROM pg_subscription_rel ORDER BY 1;
SELECT count(*), max(id) FROM invoices;
SELECT last_value, is_called FROM invoices_id_seq;
```

```text
     srrelid     | srsubstate
-----------------+------------
 invoices_id_seq | r
 invoices        | r

 count | max
-------+------
  2000 | 2000

 last_value | is_called
------------+-----------
       2000 | t
```

The sequence is listed next to the table, and its value came over with the initial copy. On 18 the subscriber's sequence would still be at 1.

## Reproduce the Classic Incident

Insert 500 more rows on the publisher:

```sql
INSERT INTO invoices (amount) SELECT 100 FROM generate_series(1, 500);
```

On the subscriber, the rows arrive, but the sequence does not move:

```text
 count | max
-------+------
  2500 | 2500

 last_value | is_called
------------+-----------
       2000 | t
```

Now act like the application after a cutover and insert on the subscriber:

```sql
INSERT INTO invoices (amount) VALUES (999) RETURNING id;
```

```text
ERROR:  duplicate key value violates unique constraint "invoices_pkey"
DETAIL:  Key (id)=(2001) already exists.
```

IDs 2001 to 2500 were used on the old primary and replicated as rows, and the subscriber's sequence hands them out again. With gaps, deletes or explicit IDs in real data, the collision may come later than the first insert, but it comes.

## When Values Move

Per the documentation, sequence values are copied at three points:

1. At `CREATE SUBSCRIPTION` with `copy_data` on (the default), which is why the first comparison matched.
2. At `ALTER SUBSCRIPTION ... REFRESH PUBLICATION`, for sequences newly added to the publication.
3. At an explicit refresh of the sequences the subscription already has:

```sql
ALTER SUBSCRIPTION billing_sub REFRESH SEQUENCES;
```

The refresh starts a synchronization worker and returns. On 19.0, right after the command, `pg_subscription_rel` showed the sequence in state `i` (being synchronized) with the old value, and less than half a second later in state `r` with 2500. A runbook should wait for that, then confirm the value, instead of trusting the command's return:

```sql
SELECT srrelid::regclass, srsubstate FROM pg_subscription_rel WHERE srrelid = 'invoices_id_seq'::regclass;
SELECT last_value, is_called FROM invoices_id_seq;   -- on both sides: they must match
```

For an identity column that counts up by one, as here, this query also checks that the next value is past the table's highest ID:

```sql
SELECT (SELECT max(id) FROM invoices) AS max_id,
       s.last_value, s.is_called,
       CASE WHEN s.is_called THEN s.last_value + 1 ELSE s.last_value END AS next_value
FROM invoices_id_seq s;
```

```text
 max_id | last_value | is_called | next_value
--------+------------+-----------+------------
   2500 |       2500 | t         |       2501
```

The same insert that failed now returns `id = 2501`.

Between refreshes, the subscriber's sequences fall behind again as soon as the publisher inserts. That gives two rules:

- **In a planned cutover**, run `REFRESH SEQUENCES` right before you promote, inside the write freeze, wait for state `r`, and compare the values on both sides.
- **In an unplanned failover**, the publisher may be gone and no refresh can help. The fallback is the same as before 19: advance each sequence past the highest replicated ID with `setval()`.

The documentation also warns that equal sequence LSNs do not prove equal values. PostgreSQL writes a WAL record for a sequence only once per 32 values (it logs ahead), so advances inside that range leave the LSN the same. Check values against the table, not LSNs against each other.

## The Cutover Order

1. Stop application writes on the publisher and let open transactions finish.
2. Check that the subscriber has applied everything. A sequence refresh says nothing about rows. Compare the publisher's position with the subscriber's origin:

```sql
SELECT pg_current_wal_lsn();                                       -- on the publisher
SELECT external_id, remote_lsn FROM pg_replication_origin_status;  -- on the subscriber
```

On 19.0 both read `0/01C48258` once the subscriber had caught up. Also count the rows of the tables that matter most.

3. Run `ALTER SUBSCRIPTION ... REFRESH SEQUENCES` on the subscriber.
4. Wait until each critical sequence is in state `r` in `pg_subscription_rel`, and check that its value matches the publisher's.
5. Only then point application writes at the subscriber.

Practice it with realistic timing. A drill that promotes a subscriber right after its initial copy passes, because the copy synchronized the sequences. The failure needs publisher inserts after the copy and an application insert after the cutover. In our run that was 500 inserts, then one insert on the subscriber.

## Setup Rules We Hit

- **The subscriber needs every published sequence.** With `ALL SEQUENCES`, adding a sequence on the publisher that the subscriber does not have makes the next refresh fail. On 19.0, after `CREATE SEQUENCE orphan_seq` on the publisher, `ALTER SUBSCRIPTION billing_sub REFRESH PUBLICATION` failed with `ERROR:  relation "public.orphan_seq" does not exist`. Your schema tooling must create sequences on the subscriber along with tables. The synchronization worker also checks that the definitions match.
- **Create the subscriber's table before rows arrive.** `ALL TABLES` publishes a new table as soon as it exists on the publisher. When we inserted into a new `receipts` table there before creating it on the subscriber, the apply worker logged `logical replication target relation "public.receipts" does not exist` and retried until the table existed.
- **A subscription to the same cluster hangs** while it creates its slot, because the slot creation waits for the transaction that runs `CREATE SUBSCRIPTION`. The [`CREATE SUBSCRIPTION` documentation](https://www.postgresql.org/docs/19/sql-createsubscription.html) gives the workaround: create the slot first with `pg_create_logical_replication_slot()` and subscribe with `create_slot = false`. This only matters when both databases are on one server, as in CI.
- **A sequence sync error names the sequence.** If the worker fails, for example because the subscription owner cannot `SET ROLE` to the sequence owner, it exits and retries like the apply worker, and the log's `CONTEXT` line names the sequence and the subscription.

## FOR ALL TABLES EXCEPT

Before 19, a publication could list tables (`FOR TABLE`), whole schemas (`FOR TABLES IN SCHEMA`, since 15), or every table (`FOR ALL TABLES`). 19 adds exclusions to the last form, as in the publication above. New tables join it with no `ALTER PUBLICATION`:

```sql
CREATE TABLE receipts (id int PRIMARY KEY);
SELECT tablename FROM pg_publication_tables WHERE pubname = 'billing' ORDER BY 1;
```

```text
 tablename
-----------
 invoices
 receipts
```

DDL still does not replicate. Create the table on the subscriber, then pick up the new member:

```sql
CREATE TABLE receipts (id int PRIMARY KEY);
ALTER SUBSCRIPTION billing_sub REFRESH PUBLICATION;
```

After that, the row we had inserted on the publisher arrived. `\dRp+ billing` in `psql` lists the exclusions under `Except tables:`.

One fix before 19.0 matters for `FOR ALL TABLES` publications on partitioned tables. If `ALTER TABLE ... DETACH PARTITION ... CONCURRENTLY` was interrupted, the partition stayed "detach pending", and decoding a change to it crashed the WAL sender in a loop. In 19 the change that added `EXCEPT` made every `FOR ALL TABLES` publication reach this path. It is fixed in 19.0. On a release candidate, run `DETACH PARTITION ... FINALIZE` as soon as a concurrent detach is interrupted.

## What to Do When You Upgrade

1. If you use logical replication between 19 servers, add `ALL SEQUENCES` to the publication (or recreate it) and make sure the subscriber has every sequence.
2. Add `REFRESH SEQUENCES` and the check query to your cutover runbook, inside the write freeze.
3. Keep the `setval()` step for unplanned failovers, and for the upgrade from 18 itself, because an 18 publisher cannot publish sequences.
4. Replace long `FOR TABLE` lists with `FOR ALL TABLES EXCEPT (TABLE ...)` where that is what you meant.

The last part covers the other direction of replication lag: [read-your-writes on physical standbys with WAIT FOR LSN](/guides/postgresql-19-field-notes/11-wait-for-lsn).
