---
title: 'CI Passed 6 of 6 Migrations. A Neon Branch of Production Passed 1'
excerpt: 'How to test Postgres migrations before production: branch production on Neon in seconds, run each migration while an app keeps reading and writing, and gate on errors, failed queries, lock stalls and lost rows. The six migrations that passed on our fixture database failed five times on the branch.'
category:
  name: 'CI/CD'
  slug: 'ci-cd'
date: '2026-09-24'
publishedAt: '2026-09-24T09:00:00Z'
updatedAt: '2026-09-24T09:00:00Z'
readingTime: '17 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Neon
  - Postgres
  - Database Migrations
  - CI/CD
  - GitHub Actions
  - Database Branching
---

We wrote six ordinary Postgres migrations: a new column, a unique index, a reporting index, a wider integer, a `NOT NULL`, and a job that archives old orders. We ran them the way many CI pipelines do, against a database with the production schema and a handful of clean test rows. **All six passed.**

Then we ran the same six on a Neon branch of production: a copy-on-write copy of a 453 MB database, usually ready in about two seconds, with a small app reading and writing while each migration ran. **One passed.** Two failed on data the test rows did not have. Two locked the orders table long enough to stall the app for 2.2 and 8.8 seconds. The last one completed without a single error and deleted 2,133,579 orders it never archived.

This post shows how we set that up, what each rehearsal caught, how close the branch timings came to production itself, and the GitHub Action that runs the rehearsal on every pull request that touches a migration.

```github
The-DevOps-Daily/neon-migration-rehearsal
```

## TL;DR

- **A small, clean fixture database cannot fail the way production fails.** Ours had no volume, no history and no dirty rows, so the same app traffic had nothing to wait for, and that is where these migrations broke.
- **A Neon branch of production is a cheap place to find out.** Branching is copy-on-write, so a branch of our 453 MB database was usually ready in about 2.3 seconds (2.3 to 3.1 across 20 branches), and a full rehearsal of one migration, from creating the branch to deleting it, took 13 to 30 seconds.
- **Four gates:** the migration completes, the app's queries keep working, no app query waits more than one second, and no rows go missing. Neon's `branches schema-diff` shows what changed.
- **Results:** 1 of 6 passed on production branches, the same in three full runs. 6 of 6 passed on schema-only branches with fixtures and the same app traffic. The fixed versions (`CREATE INDEX CONCURRENTLY`, and a `DELETE ... RETURNING` move) passed.
- **Branch timings were close to production's, in a small sample.** The table rewrite stalled the app for 8.3 to 9.0 seconds across five branch runs and 8.2 to 8.5 seconds across three runs on production itself. That is the right size of problem, not a forecast of the exact seconds.

## Prerequisites

- A Neon project, and an API key that can create branches in it (a project-scoped key is enough).
- Node 20.19 or newer to run the repo. The Neon CLI, used for the schema diff, is pinned in its lockfile.
- Migrations written as plain SQL files. The idea works with any migration tool that can run against a connection string.

## Why the fixture database says yes

Many migration tests run against one of two databases: a container with the schema and some factory rows, or a copy of the schema with no rows at all. Neon can make the second kind directly: a **schema-only branch** has production's tables, indexes and constraints and none of its data. We used one as the "CI database" and seeded it the way test suites often do: 50 customers and 200 orders, all clean, all created in the last few hours.

Everything that made these migrations dangerous was missing from it:

- **Volume.** Each migration took about 100 ms on 200 rows. An index build over 4 million rows takes seconds, and a plain one blocks writes for all of them.
- **History.** Rows written years ago under older rules: duplicate emails with different capitals, customers who signed up before phone numbers were required.
- **Old data.** A `DELETE` with a date condition matches nothing when every test row was created today.
- **Something to wait for.** Locks only hurt when a query is waiting for them, and a lock held for 100 ms makes few queries wait.

So the fixture database said yes to all six migrations, in 95 to 121 ms each, and it was right about everything it could see. Nothing stops a CI job from testing volume, history and traffic too; it just needs a database that has them, which is the rest of this post.

## The production we rehearsed against

The demo production database is a shop on the project's `main` branch:

```text
drop old tables                              0.0s
create schema                                0.1s
insert 500,000 customers                     2.1s  (500,000 rows)
insert 4,000,000 orders                      64.6s  (4,000,000 rows)
analyze                                      0.5s
{
  customers: '500000',
  orders: '4000000',
  duplicate_emails: '1250',
  null_phones: '15000',
  orders_size: '395 MB',
  database_size: '453 MB'
}
```

The seed builds in the flaws real data has: one signup in 400 reused an address with different capitals, the first 15,000 customers have no phone number, and orders spread evenly over three years. The production compute and every branch compute were fixed at 1 compute unit (CU), so each rehearsal ran on the same size of machine as production.

## A rehearsal in four steps

For each migration file, `scripts/rehearse.mjs` does four things.

**1. Branch production.** One API call. The branch gets an expiry time, so if the runner crashes Neon deletes the branch on its own:

```javascript
const created = await api('POST', `/projects/${projectId}/branches`, {
  branch: {
    name,
    parent_id: production.id,
    expires_at: new Date(Date.now() + 120 * 60_000).toISOString(),
    // init_source: 'schema-only' gives the fixture-style branch instead
  },
  endpoints: [{ type: 'read_write', autoscaling_limit_min_cu: 1, autoscaling_limit_max_cu: 1 }],
});
```

Because branching is copy-on-write, nothing is copied up front: the branch shares production's pages until it writes its own. In our production rehearsals the branch and its compute were ready in 2.3 to 3.1 seconds, and in most runs in about 2.3. The schema-only branches we used for the fixture runs took longer, 5.0 to 5.8 seconds, before seeding.

**2. Run the migration while an app uses the branch.** Two app connections keep working throughout, each running one query about every 100 ms: one inserts orders, one reads an order by id. They use the branch's pooled connection string, as most apps on Neon do. The migration uses the direct connection string, as Neon advises for schema changes, and runs inside `BEGIN ... COMMIT`, the way most migration tools run it, unless the file opts out with `-- no-transaction`. One more direct connection samples `pg_stat_activity` every 200 ms for app queries waiting on a lock.

:::warning
**Ask for the direct connection string by name.** We asked Neon's `connection_uri` API for a branch's connection string without the `pooled` parameter, and it returned the pooled one (PgBouncer, transaction mode). So our first measured runs sent every migration through the pooler, and our lock sampler, which looked for the app's sessions by backend PID, recorded nothing: through a transaction pooler a client does not keep one backend. Pass `pooled=false` for migrations. To find the app's queries in `pg_stat_activity`, set an `application_name`, which the pooler passes on. Do not use the PID your driver reports either: on Neon, even on a direct connection, `client.processID` in node-postgres was not `pg_backend_pid()`. The repo's `scripts/check-connection-strings.mjs` shows both on a throwaway branch. We re-ran every measurement in this post after the fix.
:::

**3. Check the gates.**

- **runs**: the migration completed without an error.
- **app**: none of the app's reads or writes failed.
- **blocking**: no app read or write took longer than 1,000 ms while the migration ran.
- **rows**: no table lost rows, not counting what the app inserted. A migration that moves rows says so in a comment (`-- rehearse: moves orders -> orders_archive`), and then the number of rows that left one table must equal the number that arrived in the other.

**4. Show the schema diff, then delete the branch.** The Neon CLI compares the branch's schema with production's:

```bash
npx neonctl branches schema-diff main rehearse-001-add-order-source-muecz12b \
  --project-id "$NEON_PROJECT_ID" --database neondb
```

```diff
@@ -57,9 +57,10 @@
     id bigint NOT NULL,
     customer_id bigint NOT NULL,
     amount_cents integer NOT NULL,
     status text NOT NULL,
-    created_at timestamp with time zone DEFAULT now() NOT NULL
+    created_at timestamp with time zone DEFAULT now() NOT NULL,
+    source text DEFAULT 'web'::text NOT NULL
 );
```

The whole cycle, from creating the branch to deleting it, took 13 to 30 seconds per migration on production branches.

## What the branch caught

Here is the first of the three production runs, as the runner printed it:

```terminal
{
  "title": "neon-migration-rehearsal",
  "steps": [
    { "comment": "schema diffs and passing gate lines trimmed" },
    {"cmd": "node scripts/rehearse.mjs", "output": "001_add_order_source.sql on a branch of production\n  branch rehearse-001-add-order-source-muee2qj8 ready in 2.6s\n  PASS  ran in 0.1s\n\n002_unique_customer_email.sql on a branch of production\n  branch rehearse-002-unique-customer-email-muee35xh ready in 2.3s\n  FAIL  ran in 0.4s\n    FAIL runs     could not create unique index \"customers_email_lower_key\" (Key (lower(email))=(user129199@example.com) is duplicated.)\n\n003_index_orders_created_at.sql on a branch of production\n  branch rehearse-003-index-orders-created-at-muee3gvp ready in 2.3s\n  FAIL  ran in 2.3s\n    FAIL blocking worst write 2186 ms, worst read 49 ms (limit 1000 ms)\n    waiting on a lock, query age 1937 ms  relation: INSERT INTO orders (customer_id, amount_cents, status) VALUES ($1, $2,\n\n004_widen_amount.sql on a branch of production\n  branch rehearse-004-widen-amount-muee3yjf ready in 3.0s\n  FAIL  ran in 9.0s\n    FAIL blocking worst write 8841 ms, worst read 8847 ms (limit 1000 ms)\n    waiting on a lock, query age 8799 ms  relation: SELECT id, status FROM orders WHERE id = $1\n    waiting on a lock, query age 8796 ms  relation: INSERT INTO orders (customer_id, amount_cents, status) VALUES ($1, $2,\n\n005_require_customer_phone.sql on a branch of production\n  branch rehearse-005-require-customer-phone-muee4lwu ready in 2.3s\n  FAIL  ran in 0.1s\n    FAIL runs     column \"phone\" of relation \"customers\" contains null values\n\n006_archive_refunded_orders.sql on a branch of production\n  branch rehearse-006-archive-refunded-orders-muee4wag ready in 2.3s\n  FAIL  ran in 4.9s\n    FAIL rows     orders lost 2666909 rows but orders_archive gained 533330: 2133579 rows unaccounted for\n\n1 of 6 passed on production"}
  ]
}
```

The same six on schema-only branches with fixtures all passed, each in 95 to 121 ms, with the app's slowest query at 50 ms.

```chart
{
  "type": "bar",
  "title": "Longest time an app query took while each migration ran",
  "unit": "ms",
  "caption": "Slowest read or write from the traffic loop during the migration, first run of each (data/rehearsal/production and data/rehearsal/fixtures). 002 and 005 failed on production data within half a second, so they show no stall. The gate limit is 1,000 ms.",
  "rows": [
    { "label": "001 add column", "value": 33, "series": "Fixtures branch" },
    { "label": "001 add column", "value": 42, "series": "Production branch" },
    { "label": "003 CREATE INDEX", "value": 40, "series": "Fixtures branch" },
    { "label": "003 CREATE INDEX", "value": 2186, "series": "Production branch" },
    { "label": "004 int to bigint", "value": 32, "series": "Fixtures branch" },
    { "label": "004 int to bigint", "value": 8847, "series": "Production branch" },
    { "label": "006 archive", "value": 40, "series": "Fixtures branch" },
    { "label": "006 archive", "value": 108, "series": "Production branch" }
  ],
  "series": [
    { "name": "Fixtures branch", "color": "#94a3b8" },
    { "name": "Production branch", "color": "#f59e0b" }
  ]
}
```

Taking them one at a time:

- **001, add a column with a default: passed.** Since Postgres 11, adding a column with a constant default only changes the catalog, so it took 122 to 165 ms on 4 million rows. It still needs a brief `ACCESS EXCLUSIVE` lock, though, and behind a long-running transaction that lock request would wait and hold up every query queued after it. Our traffic had no long transactions; on a real system, set `lock_timeout` for migrations like this and retry.
- **002, unique index on `lower(email)`: failed.** 1,250 addresses appear twice once capitals are ignored. The fixtures were all lower case, so the problem did not exist there. On production, the deploy fails halfway through. Note the `DETAIL` in the error: it quotes a value from the table. That is harmless with our generated data, and it is why the script reports only the SQLSTATE code in anything public, like a CI log or a pull request comment.
- **003, `CREATE INDEX` on `orders(created_at)`: an app write took 2.2 seconds.** A plain index build takes a `SHARE` lock, which lets reads through but makes every `INSERT` wait, and the lock sampler caught the app's `INSERT` waiting on the relation lock. On the 200 fixture rows the whole migration took 95 ms.
- **004, `amount_cents` from integer to bigint: app reads and writes took 8.8 seconds.** Changing the column type rewrites the whole table under an `ACCESS EXCLUSIVE` lock, so reads waited as long as writes, and the sampler saw both the `SELECT` and the `INSERT` waiting on the lock.
- **005, `phone SET NOT NULL`: failed.** 15,000 early customers have no phone number. Every fixture had one.
- **006, archive refunded orders older than a year: lost 2,133,579 orders.** The migration copies the refunded ones into `orders_archive` and then deletes everything older than a year, refunded or not: the status filter was dropped when the `DELETE` was written. It raised no error and blocked nothing for long, and it is the one that would have cost the most. On the fixture database it passed, because no fixture row was a year old.

The verdicts were the same in all three production runs. The stalls moved a little: 2.2 to 2.4 seconds for 003 across three runs, and 8.3 to 9.0 seconds for 004 across five.

## The fixes, rehearsed

Two of the migrations have straightforward fixes, and we rehearsed those too:

```sql
-- 003, fixed: builds the index without blocking writes
-- no-transaction
CREATE INDEX CONCURRENTLY orders_created_at_idx ON orders (created_at);

-- 006, fixed: the DELETE decides which rows move, and the INSERT takes exactly those
WITH moved AS (
  DELETE FROM orders
  WHERE status = 'refunded' AND created_at < now() - interval '1 year'
  RETURNING id, customer_id, amount_cents, status, created_at
)
INSERT INTO orders_archive SELECT * FROM moved;
```

Both passed on a branch of production. The concurrent index build took about the same 2.4 seconds, and the app's slowest write was 85 ms. The archive moved 533,332 rows, and `orders_archive` gained exactly that many. (The count creeps up slightly between runs because the one-year boundary moves forward.) Run in order on a single branch, the way a deploy applies them, the pair passed too.

The other three need a change in approach rather than in syntax, and we did not rehearse them here:

- **002 and 005 need the data fixed first.** Merge or rename the duplicate accounts before creating the unique index. For the phone number, backfill the NULLs, add `CHECK (phone IS NOT NULL) NOT VALID`, then `VALIDATE CONSTRAINT`, which does not block reads or writes; on Postgres 12 and later, `SET NOT NULL` can then use the validated constraint instead of scanning the table under its lock.
- **004 needs the expand and contract pattern.** Add a new `bigint` column, backfill it in batches, switch the application over, then drop the old column.

Each of those is a series of migrations, and each step is the kind of change a branch rehearsal is good at checking.

## Is a branch a fair stand-in for production?

A rehearsal is only useful if the branch behaves like production, so we checked. `scripts/check-on-production.mjs` runs a migration on production itself, with the same traffic and gates, and then undoes it with Neon's point-in-time restore. The script writes the restore point to disk before it changes anything, the restore runs even if the measurement fails, and afterwards the script compares production's column names, base types (without length or precision), nullability and defaults, its constraints, index definitions and every row count with the restore point, and stops if they differ:

```terminal
{
  "title": "check-on-production",
  "steps": [
    { "comment": "passing gate lines trimmed" },
    {"cmd": "node scripts/check-on-production.mjs migrations/003_index_orders_created_at.sql migrations/004_widen_amount.sql migrations/004_widen_amount.sql migrations/004_widen_amount.sql", "output": "003_index_orders_created_at.sql on production itself\n  FAIL  ran in 2.3s\n    FAIL blocking worst write 2156 ms, worst read 48 ms (limit 1000 ms)\n    waiting on a lock, query age 1908 ms  relation: INSERT INTO orders (customer_id, amount_cents, status) VALUES ($1, $2,\n  restored production to 2026-09-23T17:52:04.566Z in 8.2s; columns, constraints, indexes and row counts match the restore point\n\n004_widen_amount.sql on production itself\n  FAIL  ran in 8.5s\n    FAIL blocking worst write 8472 ms, worst read 8471 ms (limit 1000 ms)\n    waiting on a lock, query age 8358 ms  relation: INSERT INTO orders (customer_id, amount_cents, status) VALUES ($1, $2,\n    waiting on a lock, query age 8355 ms  relation: SELECT id, status FROM orders WHERE id = $1\n  restored production to 2026-09-23T17:52:31.701Z in 8.3s; columns, constraints, indexes and row counts match the restore point\n\n004_widen_amount.sql on production itself\n  FAIL  ran in 8.5s\n    FAIL blocking worst write 8241 ms, worst read 8237 ms (limit 1000 ms)\n    waiting on a lock, query age 8109 ms  relation: INSERT INTO orders (customer_id, amount_cents, status) VALUES ($1, $2,\n    waiting on a lock, query age 8109 ms  relation: SELECT id, status FROM orders WHERE id = $1\n  restored production to 2026-09-23T17:53:04.194Z in 8.7s; columns, constraints, indexes and row counts match the restore point\n\n004_widen_amount.sql on production itself\n  FAIL  ran in 8.4s\n    FAIL blocking worst write 8257 ms, worst read 8334 ms (limit 1000 ms)\n    waiting on a lock, query age 8073 ms  relation: SELECT id, status FROM orders WHERE id = $1\n    waiting on a lock, query age 7989 ms  relation: INSERT INTO orders (customer_id, amount_cents, status) VALUES ($1, $2,\n  restored production to 2026-09-23T17:53:35.918Z in 8.8s; columns, constraints, indexes and row counts match the restore point"}
  ]
}
```

The index build blocked writes for 2.2 seconds on production; the branches measured 2.2 to 2.4. For the table rewrite, here is every run of it:

```chart
{
  "type": "dots",
  "title": "004 (integer to bigint): longest app wait, every run",
  "unit": "s",
  "caption": "Slowest app query while the migration ran. Branch: five rehearsals, three in full runs and two of 004 alone. Production: three runs on main, each undone with point-in-time restore.",
  "series": [
    { "name": "Branch of production", "samples": [8.8, 9.0, 8.4, 8.3, 8.3], "color": "#f59e0b" },
    { "name": "Production itself", "samples": [8.5, 8.2, 8.3], "color": "#38bdf8" }
  ]
}
```

The ranges overlap: 8.3 to 9.0 seconds on branches, 8.2 to 8.5 seconds on production, with the branch runs a little slower on average. Five and three runs are a small sample, and we did not control the compute caches or anything else that might move the numbers. So a branch rehearsal answered the question that matters: this migration blocks the app for seconds, not milliseconds, and here for about eight or nine of them. Do not treat the exact figure as a forecast. The four restores took 8.2 to 8.8 seconds, and after each one the checked properties and every row count matched the restore point.

## Rehearsal on every pull request

The repo includes a GitHub Actions workflow that rehearses the `.sql` files a pull request adds, changes or renames directly in `migrations/`, in order on one branch, and posts the gate table as a comment. Like a deploy, the sequence stops at the first migration that errors, and the rest are reported as not run. The key detail is where the code comes from:

```yaml
on:
  pull_request:
    paths: ['migrations/**']

jobs:
  rehearse:
    # Pull requests from forks get no secrets, so only rehearse this repository's branches
    if: github.event.pull_request.head.repo.full_name == github.repository
    # The key is an environment secret; a reviewer approves each run
    environment: migration-rehearsal
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          ref: ${{ github.event.pull_request.base.sha }} # trusted code from the base branch
          fetch-depth: 0
          persist-credentials: false
      # ... setup-node, npm ci --ignore-scripts (the lockfile pins neonctl) ...
      # then copy ONLY the pull request's changed migrations/*.sql files out of its head commit,
      # listed NUL-separated, renames followed, unexpected file names failing the job
      - name: Rehearse on a Neon branch of production
        env:
          NEON_API_KEY: ${{ secrets.NEON_API_KEY }} # project-scoped
          NEON_PROJECT_ID: ${{ vars.NEON_PROJECT_ID }}
          FILES: ${{ steps.changed.outputs.files }}
        run: node scripts/rehearse.mjs --sequence $FILES --markdown "$RUNNER_TEMP/rehearsal.md"
```

A few choices keep the key out of reach:

- **The code comes from the base branch.** The workflow checks out the base commit, installs its dependencies with `--ignore-scripts`, including the pinned Neon CLI, and takes only the SQL of the pull request's migrations. A pull request cannot change the script, or a `package.json`, that runs with the key.
- **An approval before the key is used.** A pull request from a branch of this repository can still change the workflow file itself, and GitHub runs the changed workflow. So the key is not a repository secret: it is a secret of a GitHub environment that needs a reviewer to approve each run. Read the pull request's workflow diff before you approve.
- **A project-scoped API key.** Neon can issue a key limited to one project: it cannot reach other projects or delete this one. Inside the project it has editor access, which includes production's connection string, so treat it as a production secret.
- **`pull_request`, not `pull_request_target`.** Pull requests from forks never see the secret.
- **No error text in public output.** Postgres error messages can quote values: the `DETAIL` above quoted an email address, and a failed cast prints the value it could not cast. On GitHub Actions the script reports errors as SQLSTATE codes only, such as `23505 unique_violation`. The schema diff is still posted. Only SQL written to copy data into the schema, such as dynamic SQL that names a table after a row value, could put row values there, and more generally the migration SQL runs against production data. So only rehearse pull requests from people you would trust with that data, and read the SQL before you approve the run.
- **Branch expiry.** Every rehearsal branch is created with `expires_at`, so a cancelled job cannot leave branches behind.

We opened [a pull request](https://github.com/The-DevOps-Daily/neon-migration-rehearsal/pull/1) with one new migration, `CREATE INDEX orders_status_idx ON orders (status)`, approved the run in the environment, and got this comment:

```text
| Migration                   | Result | Ran for | App | Blocking                                                   |
| 007_index_orders_status.sql | FAIL   | 4.1 s   | ok  | fail: worst write 3733 ms, worst read 137 ms (limit 1000 ms) |
```

We changed it to `CREATE INDEX CONCURRENTLY` and pushed again:

```text
| Migration                   | Result | Ran for | App | Blocking                                                   |
| 007_index_orders_status.sql | PASS   | 4.1 s   | ok  | ok: worst write 131 ms, worst read 158 ms (limit 1000 ms)  |
```

The runner was on GitHub's infrastructure, not our machine, and told the same story: the blocking build flagged, the concurrent build clean.

## What it costs

Each rehearsal holds one branch and one compute of the same size as production for 13 to 30 seconds, and then deletes both. The branch starts out sharing all of production's data, and only the pages the migration writes take new storage. A rewrite like 004 writes the whole table on the branch, so for those few seconds the branch holds a second copy of the orders table.

The larger cost is the time it adds to a pull request. In the demo, the job itself, from checkout to the comment, took 36 and 30 seconds for one migration; the approval adds however long the reviewer takes. That is a better trade than learning about the lost orders from the support queue.

## What we could not conclude

- **Timing is close, not a forecast.** Branch and production stalls for the same migration overlapped in a handful of runs. Earlier versions of our harness, which sent the migration through the pooler, saw the same rewrite stall for anywhere from 8.0 to 14.7 seconds across branch and production runs, and we cannot say whether the pooler or something else caused that spread.
- **One compute size, one data shape.** Every number here is for 1 CU and a 453 MB database with a simple schema. Bigger tables make the stalls longer; the gates do not change.
- **The traffic is small.** Two connections, each running a query about every 100 ms, find locks, but they do not recreate production load or long-running transactions, so they cannot show a lock queue building up behind a slow statement.
- **The app gate only knows two queries.** It catches a migration that breaks those, not one that breaks a query your real application runs. That still needs your tests.
- **The row gate counts rows; it does not compare them.** A declared move passes if the counts match, even if different rows arrived.
- **The data flaws were planted.** We built duplicates and NULLs into the seed on purpose. Your production has its own, which is the argument for rehearsing against it rather than against data you made up.

## Summary

A small fixture database checks that a migration's SQL is valid. It cannot show what the migration does to 4 million rows that are three years old and in use. A Neon branch of production can, in seconds, for the price of a small compute for about half a minute.

The setup is four steps: branch production with an expiry time, run the migration while something keeps using the database, gate on errors, failed queries, lock stalls and row counts, and read Neon's schema diff before deleting the branch. In our runs that caught two data failures, two multi-second stalls and one migration that would have deleted more than two million orders, none of which the fixture database could show. Put the same run on every pull request, with the code coming from the base branch and a project-scoped key behind an approval, and the next `CREATE INDEX` without `CONCURRENTLY` gets flagged on the pull request, as it did in our demo.

Related reading: [Someone ran migrate:fresh on production](/posts/someone-ran-migrate-fresh-on-production) covers the other half, getting the data back with Neon's point-in-time restore once a migration has already gone wrong.
