---
title: 'COPY TO JSON: Native JSON Exports'
navTitle: 'COPY TO JSON'
description: 'PostgreSQL 19 adds COPY TO (FORMAT json) and FORCE_ARRAY. It matches the row_to_json pipeline byte for byte on plain data, runs faster, and differs on escaping and generated columns.'
order: 7
---

**TLDR**: `COPY table TO 'file' (FORMAT json)` writes one JSON object per row. On a 2-million-row table it produced a file byte-identical to the old `COPY (SELECT row_to_json(t) FROM t)` pipeline, and was about a second faster on 19 beta 3 and on 19.0. `FORCE_ARRAY` wraps the output in one JSON array. The two forms differ when values contain backslashes (the old form doubles them, so the strings change) or newlines inside `json` values (the old form becomes invalid JSON), and for generated columns and inheritance. There is no `COPY FROM (FORMAT json)`.

Exporting a table as JSON has had the same shape for years:

```sql
COPY (SELECT row_to_json(f) FROM f) TO '/tmp/f.json';
```

It works, but every export carries a subquery whose only job is to turn rows into JSON, and the output goes through text-format `COPY` escaping on the way out. PostgreSQL 19 adds `FORMAT json` to `COPY TO` ([release notes](https://www.postgresql.org/docs/19/release-19.html), [`COPY`](https://www.postgresql.org/docs/19/sql-copy.html)):

```sql
COPY f TO '/tmp/f.json' (FORMAT json);
```

## Prerequisites

- A PostgreSQL 19 server.
- `COPY ... TO 'file'` writes on the **server's** filesystem. It needs superuser or the `pg_write_server_files` role, and a directory the `postgres` process can write to. Other roles get `ERROR:  permission denied to COPY to a file`. From a client, use `psql`'s `\copy` with a path on your machine.
- Optionally `jq` and the DuckDB CLI on your machine.

## The Output

A test table with 2 million rows:

```sql
CREATE TABLE f (id bigint, region text, amount numeric(12,2), qty int);
INSERT INTO f
SELECT g, (array['eu-central','us-east','ap-south'])[1 + g % 3],
       ((g % 9973) / 7.0)::numeric(12,2), 1 + (g % 17)
FROM generate_series(1, 2000000) g;
VACUUM ANALYZE f;
```

`COPY` also takes a query, and `TO STDOUT` prints to `psql`, which is the easiest way to look at the format:

```sql
COPY (SELECT * FROM f WHERE id <= 2) TO STDOUT (FORMAT json);
```

```text
{"id":1,"region":"us-east","amount":0.14,"qty":2}
{"id":2,"region":"ap-south","amount":0.29,"qty":3}
```

One object per line, no wrapper: the format called newline-delimited JSON (NDJSON). Keys come from the column names, and with a query from its column aliases:

```sql
COPY (SELECT id AS order_id, region AS r FROM f WHERE id <= 2) TO STDOUT (FORMAT json);
```

```text
{"order_id":1,"r":"us-east"}
{"order_id":2,"r":"ap-south"}
```

`FORCE_ARRAY` writes one JSON array instead:

```sql
COPY (SELECT * FROM f WHERE id <= 2) TO STDOUT (FORMAT json, FORCE_ARRAY true);
```

```text
[
 {"id":1,"region":"us-east","amount":0.14,"qty":2}
,{"id":2,"region":"ap-south","amount":0.29,"qty":3}
]
```

A column list works on the table form, and a query is what you use to filter rows:

```sql
COPY f (id, region) TO '/tmp/ids.json' (FORMAT json);
COPY (SELECT id, region FROM f WHERE qty > 8) TO '/tmp/big.json' (FORMAT json);
```

## Same File, Faster

We exported the whole table three times with each form:

```sql
COPY f TO '/tmp/a1.json' (FORMAT json);
COPY f TO '/tmp/b1.json' (FORMAT json, FORCE_ARRAY true);
COPY (SELECT row_to_json(f) FROM f) TO '/tmp/c1.txt';
```

The native export and the `row_to_json` pipeline produced the same file, on beta 3 and again on 19.0:

```text
fd627707d4c54f3ac2d857a3cb09213b  a1.json
fd627707d4c54f3ac2d857a3cb09213b  c1.txt
```

Both are 118,936,569 bytes. The `FORCE_ARRAY` file is 2,000,004 bytes larger: a comma before every row after the first, a leading space, two brackets and two newlines.

| Form                                         | 19 beta 3, 8 vCPU   | 19.0, 2 CPUs        |
| -------------------------------------------- | ------------------- | ------------------- |
| `COPY f TO ... (FORMAT json)`                | 3250, 3479, 3442 ms | 2994, 2817, 2993 ms |
| `COPY f TO ... (FORMAT json, FORCE_ARRAY)`   | 3333, 3426, 3677 ms | 2561, 2871, 3756 ms |
| `COPY (SELECT row_to_json(f) FROM f) TO ...` | 4650, 4125, 4303 ms | 3679, 3932, 3871 ms |

The plain native form was faster than every `row_to_json` run in both sets, by about a second. It skips the query that builds a `json` value per row and the text escaping on the way out; the timings do not say how the saving splits between the two. `FORCE_ARRAY` overlaps the plain form, so it costs nothing you can measure here.

## Where the Two Forms Differ

The byte-for-byte match above holds for this data. It does not hold in general. A small table shows three differences:

```sql
CREATE TABLE edge (id int, note text, doc json, total int GENERATED ALWAYS AS (id * 10) STORED);
INSERT INTO edge VALUES (1, 'C:\temp\new', '{"a":
 1}');
COPY edge TO STDOUT (FORMAT json);
COPY (SELECT row_to_json(edge) FROM edge) TO STDOUT;
```

```text
{"id":1,"note":"C:\\temp\\new","doc":{"a":
 1}}
{"id":1,"note":"C:\\\\temp\\\\new","doc":{"a":\n 1},"total":10}
```

- **Escaping.** `FORMAT json` applies JSON escaping only, so `C:\temp\new` comes out as the correct JSON string `"C:\\temp\\new"`. The old pipeline adds text-format `COPY` escaping on top. The doubled backslashes are still valid JSON, but the string a parser reads back is `C:\\temp\\new`, which is the wrong value. The newline inside the `json` value is worse: it becomes the two characters `\n` outside any string, which a JSON parser rejects. On data with backslashes or multi-line `json` values, the native form is the correct one.
- **Newlines inside values.** A `json` column keeps its own formatting, newlines included. The native line above is split over two lines, so "one object per line" is only true if your `json` values have no newlines. Check before you write a line-based consumer. (`jsonb` values are printed without newlines.)
- **Generated columns.** `COPY table TO` exports only the table's stored, non-generated columns by default, so `total` is missing. `row_to_json` includes it. Name the columns, or use a query, if you need them.

**Inheritance** is a fourth difference. `COPY parent TO` exports only the rows stored in `parent` itself, while `SELECT * FROM parent` includes the child tables:

```sql
CREATE TABLE parent (id int);
CREATE TABLE child () INHERITS (parent);
INSERT INTO child VALUES (1);
COPY parent TO STDOUT (FORMAT json);
COPY (SELECT * FROM parent) TO STDOUT (FORMAT json);
```

The first prints nothing; the second prints `{"id":1}`. (Partitioned tables are different: 19 also allows `COPY TO` on a partitioned table, which exports all partitions.)

If you switch a pipeline over, compare exports taken from the same snapshot, and sort both before you diff them: neither form promises a row order.

## Types

JSON types come from the column types. A finite `numeric` becomes a JSON number and keeps every digit; a consumer that reads numbers into 64-bit floats can still lose precision on a wide one. Non-finite values and dates become strings:

```sql
COPY (SELECT 'NaN'::numeric AS n, 12345678901234567890.123::numeric AS wide, now()::date AS d) TO STDOUT (FORMAT json);
```

```text
{"n":"NaN","wide":12345678901234567890.123,"d":"2026-11-20"}
```

That is the same as `row_to_json` has always done. One security fix in RC2 applies to both forms: when a column's type has a cast to `json`, the conversion now checks `EXECUTE` privilege on the cast function, so an export by a role without it fails with `permission denied for function ...` (CVE-2026-116303). Built-in types do not go through such a cast.

## It Does Not Import

There is no matching import:

```sql
COPY f FROM STDIN (FORMAT json);
```

```text
ERROR:  COPY FORMAT JSON is not supported for COPY FROM
```

Loading JSON stays what it was: a staging table with a `jsonb` column, `jsonb_populate_recordset` and the other JSON functions, or a tool outside the database. If you load JSON lines with the default text `COPY`, remember that it interprets backslash escapes, so raw JSON with backslashes is not safe to feed it unchanged; the `csv` format with a quote and delimiter that never appear in the data is a common workaround.

## Export from a Client

`\copy` runs `COPY ... TO STDOUT` and writes the file on your side, with no server file privileges:

```bash
psql -U postgres -d lab -c "\copy (SELECT * FROM f WHERE qty > 16) TO 'big.json' (FORMAT json)"
wc -l big.json
```

```text
COPY 117647
117647 big.json
```

## Feed It to jq and DuckDB

The files from the server export are on the server. With the Docker lab, copy them out first:

```bash
docker cp pg19:/tmp/a1.json a1.json
docker cp pg19:/tmp/b1.json b1.json
```

Use the newline-delimited form by default: it is what tools in this space expect. `jq` reads it one object at a time:

```bash
jq -c 'select(.qty == 17) | .id' a1.json | head -3
```

```text
16
33
50
```

A grouping needs all the records in memory, which `-s` does by collecting them into an array first, so limit the input when you try it:

```bash
head -200000 a1.json | jq -c -s 'group_by(.region)[] | {region: .[0].region, n: length}'
```

```text
{"region":"ap-south","n":66667}
{"region":"eu-central","n":66666}
{"region":"us-east","n":66667}
```

DuckDB reads the file directly. Name the format so it does not have to guess:

```sql
SELECT region, count(*) n, round(sum(amount), 2) total
FROM read_json_auto('a1.json', format='newline_delimited')
GROUP BY 1 ORDER BY 2 DESC;
```

```text
┌────────────┬────────┬──────────────┐
│   region   │   n    │    total     │
│  varchar   │ int64  │    double    │
├────────────┼────────┼──────────────┤
│ ap-south   │ 666667 │ 474269225.24 │
│ us-east    │ 666667 │ 474269442.96 │
│ eu-central │ 666666 │ 474269660.66 │
└────────────┴────────┴──────────────┘
```

That ran on DuckDB 1.1.3. `read_json_auto('b1.json', format='array')` reads the `FORCE_ARRAY` file in the same way.

Use `FORCE_ARRAY` when the consumer needs one valid JSON document: an API that takes an array body, or a parser without a streaming mode. A parser that loads the whole array can use several times the file's 121 MB in memory, so check that it streams before you send it an export this size.

## What to Do When You Upgrade

1. Replace `COPY (SELECT row_to_json(t) FROM t) TO ...` with `COPY t TO ... (FORMAT json)` where you want valid JSON with plain JSON escaping.
2. Before you switch, check for generated columns, inheritance children and backslashes in the data, and compare one export from each form.
3. Keep your JSON import path as it is.

The next part is about holding the planner's decisions in place: [pg_plan_advice](/guides/postgresql-19-field-notes/08-pg-plan-advice).
