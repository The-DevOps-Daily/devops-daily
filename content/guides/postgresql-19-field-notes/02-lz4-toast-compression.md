---
title: 'LZ4 TOAST Compression by Default, and Why Your Old Rows Stay pglz'
description: 'PostgreSQL 19 compresses new TOAST values with lz4. What it saves, why VACUUM FULL, CLUSTER and REPACK keep old pglz values, and how to find and convert them.'
order: 2
---

**TLDR**: `default_toast_compression` is now `lz4` when the server is built with lz4, which the common packages and the Docker image are. On 19.0, loading 200,000 compressible text values took 1.35 s with lz4 and 8.0 s with pglz on the same server, and the values took 25% less space. Values written before the upgrade keep pglz. `VACUUM FULL`, `CLUSTER`, `REPACK`, `ALTER COLUMN ... TYPE` to the same type and `UPDATE SET col = col` all leave them as they are. Only an expression that computes a new value converts them.

Large `text`, `jsonb` and `bytea` values are stored with **TOAST**: PostgreSQL compresses a value when a row gets too big, and moves it to a side table if it is still too big. Since PostgreSQL 14 you could choose the compression method, pglz or lz4, with `default_toast_compression`. The default was pglz. PostgreSQL 19 makes it lz4 ([release notes](https://www.postgresql.org/docs/19/release-19.html), [`default_toast_compression`](https://www.postgresql.org/docs/19/runtime-config-client.html#GUC-DEFAULT-TOAST-COMPRESSION)).

None of this is new capability. You could set the same parameter on 14 to 18. What is new is that every upgraded cluster now writes two compression methods side by side, and the obvious maintenance commands do not change that.

## Prerequisites

- A PostgreSQL 19 server built with lz4. The `postgres:19` Docker image is. A server you build from source needs `--with-lz4` with Autoconf; Meson enables it when it finds the library.
- A few hundred MB of free disk.

## Check the Default

```sql
SHOW default_toast_compression;
SELECT name, setting, boot_val, reset_val, source
FROM pg_settings WHERE name = 'default_toast_compression';
```

On 19.0:

```text
           name            | setting | boot_val | reset_val | source
---------------------------+---------+----------+-----------+---------
 default_toast_compression | lz4     | lz4      | lz4       | default
```

On the `postgres:18` image the same query says `pglz`.

## What the New Default Saves

The test loads 200,000 rows of repeated JSON-like text, about 6 KB each before compression, which is the kind of data TOAST compression is good at:

```sql
CREATE TABLE docs (id int PRIMARY KEY, body text);
INSERT INTO docs
SELECT g, repeat(format('{"order":%s,"customer":"Customer name %s","status":"shipped","note":"delivered to the front desk"} ', g, g), 60)
FROM generate_series(1, 200000) g;
```

To compare the two methods on the same 19.0 server, we ran the load twice with each method, setting it for the session first with `SET default_toast_compression = pglz` or `lz4`, and measured the result with this query:

```sql
SELECT pg_size_pretty(sum(pg_column_size(body))) AS values_size,
       pg_size_pretty(pg_total_relation_size('docs')) AS total
FROM docs;
SELECT pg_column_compression(body) AS stored_with, count(*)
FROM docs GROUP BY 1 ORDER BY 2 DESC;
```

| Method | Load time (2 runs) | `sum(pg_column_size(body))` | `pg_total_relation_size` |
| ------ | ------------------ | --------------------------- | ------------------------ |
| pglz   | 8286 ms, 8008 ms   | 36 MB                       | 48 MB                    |
| lz4    | 1364 ms, 1346 ms   | 27 MB                       | 39 MB                    |

That is a 2-CPU container on 19.0. On 19 beta 3 with an 8 vCPU droplet, the same load took 8692 ms on 18.6 with pglz and 1517 ms on 19 with lz4, with the same sizes.

Some notes on these numbers:

- The values are 25% smaller and the whole table 19% smaller. The total includes the primary key and row overhead, which compression does not touch.
- The TOAST side table stayed empty in both cases. Each value compressed small enough to stay in the main table, so this measures inline compression.
- Compression runs in the backend while the `INSERT` waits, so the method affects write latency. On this data lz4 was about six times faster to write.

## Old Values Keep pglz

PostgreSQL records the method per value. After an upgrade, a table that is still being written holds both. To see it, build such a table on purpose:

```sql
CREATE TABLE mixed (id int PRIMARY KEY, body text);
SET default_toast_compression = pglz;
INSERT INTO mixed SELECT g, repeat(format('{"order":%s,"note":"delivered to the front desk"} ', g), 60) FROM generate_series(1, 20000) g;
SET default_toast_compression = lz4;
INSERT INTO mixed SELECT g, repeat(format('{"order":%s,"note":"delivered to the front desk"} ', g), 60) FROM generate_series(20001, 40000) g;
SELECT pg_column_compression(body) AS stored_with, count(*) FROM mixed GROUP BY 1 ORDER BY 2 DESC;
```

```text
 stored_with | count
-------------+-------
 lz4         | 20000
 pglz        | 20000
```

The natural next step is to rewrite the table. With the default already lz4, we ran each of these on 19.0 and counted the methods after each one:

| Command                                           | Result after it       |
| ------------------------------------------------- | --------------------- |
| `VACUUM FULL mixed;`                              | 20000 lz4, 20000 pglz |
| `CLUSTER mixed USING mixed_pkey;`                 | 20000 lz4, 20000 pglz |
| `REPACK mixed;`                                   | 20000 lz4, 20000 pglz |
| `ALTER TABLE mixed ALTER COLUMN body TYPE text;`  | 20000 lz4, 20000 pglz |
| `UPDATE mixed SET body = body;`                   | 20000 lz4, 20000 pglz |
| `UPDATE mixed SET body = body \|\| '' WHERE ...;` | 40000 lz4             |

A physical rewrite copies the compressed value as it is. It does not decompress and compress again, which is the right choice for a maintenance command, but it means `VACUUM FULL`, `CLUSTER` and `REPACK` are wasted work if conversion is what you want. `UPDATE SET body = body` passes the same stored value through, so it does not convert either.

The `ALTER TABLE` row needs a note: changing a `text` column to `text` is a no-op that never rewrites the table. It still takes an `ACCESS EXCLUSIVE` lock, so do not run it hoping for a conversion.

What converts a value is computing a new one. Concatenating an empty string does it, and you can limit the update to the rows that need it:

```sql
UPDATE mixed SET body = body || '' WHERE pg_column_compression(body) = 'pglz';
SELECT pg_column_compression(body) AS stored_with, count(*) FROM mixed GROUP BY 1 ORDER BY 2 DESC;
```

```text
 stored_with | count
-------------+-------
 lz4         | 40000
```

This is a normal `UPDATE`: every converted row gets a new row version, writes WAL, and leaves a dead tuple for vacuum. On a large table, do it in batches by primary key range and let autovacuum keep up, or plan a rewrite with [REPACK](/guides/postgresql-19-field-notes/05-repack-concurrently) afterwards to give the space back.

A dump and restore also converts, as long as the restored column uses lz4. `pg_dump` writes column-level settings such as `ALTER TABLE ONLY public.docs ALTER COLUMN body SET COMPRESSION pglz;`, and `pg_dump --no-toast-compression` leaves those lines out, so the restore uses the server default.

## Find Out Where You Stand

```sql
SELECT pg_column_compression(body) AS stored_with, count(*)
FROM docs GROUP BY 1 ORDER BY 2 DESC;
```

Run it on the tables that hold your large text and JSON columns. On a big table, add a `TABLESAMPLE SYSTEM (1)` clause after the table name to read 1% of the pages instead of all of them.

A row can come back with an empty `stored_with`. That means the value is not compressed (short values are never compressed) or it is NULL. On 19.0, inserting `'short'` and `NULL` into `mixed` added two such rows. They are not pglz values waiting to be converted.

Whether to convert is a decision per table. Measure what lz4 saves on that table and whether reads get faster, and compare it with what the update costs in time, WAL and bloat. A table that is mostly rewritten by your application anyway converts on its own over time.

## A Column Setting Beats the Default

The parameter is a default, not a rule. A column can have its own method:

```sql
ALTER TABLE docs ALTER COLUMN body SET COMPRESSION pglz;
\d+ docs
```

```text
 Column |  Type   | Collation | Nullable | Default | Storage  | Compression | Stats target | Description
--------+---------+-----------+----------+---------+----------+-------------+--------------+-------------
 id     | integer |           | not null |         | plain    |             |              |
 body   | text    |           |          |         | extended | pglz        |              |
```

An empty `Compression` column in `\d+` means the column follows `default_toast_compression`. To go back to the default:

```sql
ALTER TABLE docs ALTER COLUMN body SET COMPRESSION default;
```

Check `\d+` before you decide a table "did not pick up" the new default. The setting can also come from the configuration file, `ALTER DATABASE`, `ALTER ROLE` or the session, and any of those still saying pglz keeps pglz.

## Do Not Read the Default from the Sample File

The sample configuration file in the 19.0 image still names the old default:

```text
/usr/share/postgresql/19/postgresql.conf.sample:805:#default_toast_compression = pglz       # pglz or lz4
/var/lib/postgresql/19/docker/postgresql.conf:805:#default_toast_compression = lz4        # pglz or lz4
```

`initdb` writes the value the server was built with into the generated `postgresql.conf`, so the sample is a template, not a statement of the default. Both lines are comments and change nothing. This matters only if your upgrade review diffs sample files between versions, or a tool reads the sample to learn defaults. Ask the server instead: `SHOW default_toast_compression` for the value in effect, and `pg_settings.boot_val` for the built-in default.

## What to Do When You Upgrade

1. After the upgrade, run `SHOW default_toast_compression` and check that no configuration file, database or role still sets pglz.
2. Run the `pg_column_compression()` query on your biggest text and JSON tables, so you know how much pglz data you have.
3. Do not schedule `VACUUM FULL`, `CLUSTER` or `REPACK` to convert values. They will not.
4. If you stay on 14 to 18 for a while, you can set `default_toast_compression = lz4` there now. It takes a reload, and only new values use it.

The next part covers another changed default: the [async I/O worker pool](/guides/postgresql-19-field-notes/03-io-worker-autoscaling), which now sizes itself.
