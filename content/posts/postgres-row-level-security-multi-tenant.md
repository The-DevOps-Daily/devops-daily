---
title: 'Your Tenant Isolation Is One Forgotten WHERE Clause Away'
excerpt: 'Most multi-tenant apps enforce isolation in application code, which means every query is a chance to leak. Postgres row-level security moves the boundary into the database. Here is a working schema, the six things that quietly break it, and how to prove your tests would actually catch a breach.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-09-19'
publishedAt: '2026-09-19T09:00:00Z'
updatedAt: '2026-09-19T09:00:00Z'
readingTime: '15 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Postgres
  - Security
  - Multi-tenancy
  - Database
  - Testing
  - DevOps
---

Every multi-tenant application has the same sentence buried in it somewhere:

```sql
SELECT * FROM documents WHERE tenant_id = $1
```

And every one of them is one forgotten `WHERE` clause away from showing customer A the data of customer B. Not through a clever attack. Through a junior developer adding a reporting query on a Friday, or an ORM helper that builds a filter from a variable that is `undefined`, or a `JOIN` where the condition was applied to the wrong side.

The uncomfortable part is that this failure is silent. Nothing errors. A page renders, with rows on it, and the rows belong to somebody else.

Postgres has had an answer since 9.5, and most teams still do not use it: **row-level security**. It moves the tenant boundary out of the application and into the table, so a missing `WHERE` clause returns nothing instead of everything.

This post is the working version of that, with the parts that are easy to get wrong. There is a repository to go with it:

```github
https://github.com/The-DevOps-Daily/rls-multi-tenant-starter
```

## TLDR

- **The application should not filter by tenant. It should say who it is**, and let the database decide what that identity can see.
- `ENABLE ROW LEVEL SECURITY` **does not bind the table's owner**. You want `FORCE` as well, and migrations run as the owner.
- **A superuser ignores all of it**, and so does any role with `BYPASSRLS`. One wrong connection string removes every guarantee.
- **`SET` cannot take a bind parameter.** Use `set_config('app.tenant_id', $1, true)`, and the `true` is what stops a pooled connection leaking a tenant into the next request.
- **Adding a second policy can undo the first.** Permissive policies combine with `OR`.
- **A passing isolation test suite is weak evidence.** Break the schema on purpose and check the suite notices. Mine did not, twice, until I did exactly that.

## Prerequisites

- A supported Postgres. Row-level security landed in 9.5, but run something still receiving fixes; the examples here are on 18.
- A multi-tenant schema, or the intention to build one.
- Docker, if you want to run the repository.

## The shape of the fix

```diagram
{
  "type": "branch",
  "nodes": [
    { "label": "Request", "sub": "tenant A", "icon": "globe", "tone": "slate" },
    { "label": "App", "sub": "sets identity, no filter", "icon": "box", "tone": "blue" },
    { "label": "Postgres", "sub": "policy decides", "icon": "database", "tone": "violet" }
  ],
  "branch": [
    { "label": "Tenant A rows", "variant": "good" },
    { "label": "Nothing, if identity is unset", "variant": "bad" }
  ]
}
```

The application stops being the thing that enforces isolation. It becomes the thing that *identifies* itself, and the database enforces.

## The schema

Three parts: a function that reads the current identity, policies that use it, and roles that cannot escape it.

```sql
-- Who am I? Set per transaction by the application, read by the policies.
--
-- The `true` in current_setting means "return NULL if unset" rather than
-- raising. That is deliberate: an unset tenant must produce no rows, not an
-- error that some middleware swallows into a 500 and a retry.
CREATE FUNCTION current_tenant() RETURNS uuid
LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('app.tenant_id', true), '')::uuid
$$;

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE  ROW LEVEL SECURITY;

CREATE POLICY documents_tenant_isolation ON documents
    USING      (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());
```

`USING` decides which rows are visible to `SELECT`, `UPDATE` and `DELETE`. `WITH CHECK` decides which rows may be written by `INSERT` and `UPDATE`.

Then the application adopts a tenant for the transaction:

```python
conn.execute("SELECT set_config('app.tenant_id', %s, true)", (tenant_id,))
```

That is the whole mechanism. What follows is the part that decides whether it works.

## Six things that quietly break it

### 1. `SET` cannot take a bind parameter

The obvious way to set the tenant is the one that does not work:

```sql
SET LOCAL app.tenant_id = $1;
-- ERROR:  syntax error at or near "$1"
```

`SET` takes a literal, not a parameter. So using it means building the statement as a string. That is safe if you quote properly, with psycopg's `sql.Literal` or your driver's equivalent. It stops being safe the moment somebody reaches for an f-string, **in the one statement whose entire job is the security boundary**.

`set_config()` is an ordinary function call. The value binds like any other parameter and the question never arises.

### 2. The third argument decides whether a pooled connection leaks

```python
set_config('app.tenant_id', tenant, True)   # transaction
set_config('app.tenant_id', tenant, False)  # session
```

With `False`, the value survives the commit. On a pooled connection it belongs to whoever is handed that connection next, which is a cross-tenant read caused by one boolean.

Two conditions come with `True`, and both have bitten people:

- The setting and the queries it protects must be **in the same transaction**. In autocommit mode, a lone `set_config(..., true)` has already expired by the next statement.
- A transaction-local value restores the **session** value underneath it, not an empty one. If anything ever set a session-level tenant, it comes back after the commit. The way to stay safe is to never set one.

### 3. `ENABLE` does not bind the table's owner

This is the one that surprises people, because the schema looks right.

```sql
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
```

The owner of a table is exempt from its own policies. Migrations run as the owner. Admin scripts run as the owner. The `psql` session where somebody investigates a support ticket at 2am runs as the owner. That is precisely where an ad-hoc query is most likely to touch every tenant at once.

`ALTER TABLE documents FORCE ROW LEVEL SECURITY` closes it.

It is worth being clear about what `FORCE` is for: it constrains an owner who is behaving, not one who is not. The owner can still drop the policies. It is a guard against the accidental session, not against a hostile migration.

### 4. A superuser ignores all of it, and so does `BYPASSRLS`

`FORCE` does not apply to a superuser. It sees every tenant, with no setting, no policy evaluation, and nothing to opt out of.

The same is true of any role granted `BYPASSRLS`, which requires no superuser status at all and is very easy to grant to "the analytics user" without thinking about it.

So the schema in the repository creates two ordinary roles, an owner for migrations and an unprivileged role for the application, and uses `postgres` for neither. If your application's connection string is a superuser, everything above is decoration.

There is a related detail worth knowing. `SET row_security = off` is not an escape hatch for a role that cannot bypass policies. Postgres accepts the `SET` and then **refuses the query**:

```
psycopg.errors.InsufficientPrivilege:
  query would be affected by row-level security policy for table "documents"
```

Note where the failure lands. The `SET` succeeds; the `SELECT` fails. Code that checks whether a statement raised, rather than whether a query returned, would read that as having turned the policies off. It did not.

### 5. Omitting `WITH CHECK` is safe. Writing a weak one is not

I had this backwards, and writing a test is what corrected me.

I assumed `USING` alone would let a tenant insert rows into another tenant. It does not: **when `WITH CHECK` is absent, Postgres reuses the `USING` expression for writes.** Dropping the clause entirely changed nothing.

The hazard is the opposite. `WITH CHECK (true)` reads like a formality, passes review, and lets any tenant insert rows belonging to any other.

### 6. A second policy can undo the first

This is the one I would most expect to cause a real incident, because it arrives as a feature request.

**Permissive policies combine with `OR`.** Every policy that applies to a command is evaluated, and a row is visible if *any* of them allows it. So somebody adds a reasonable-sounding policy six months later:

```sql
-- "support staff need to read everything"
CREATE POLICY documents_support_read ON documents
    FOR SELECT USING (current_setting('app.role', true) = 'support');
```

and tenant isolation is now conditional on an unrelated setting, for every role, on every query. The original policy still exists and still looks correct. Nothing in the migration mentions tenants.

Measured against the repository's two tenants, four documents, with Acme's identity set:

| policies on `documents` | Acme sees |
|---|---|
| tenant policy only | **2** |
| tenant policy **+** a permissive `USING (true)` | **4** |
| tenant policy made `AS RESTRICTIVE`, permissive one kept | **2** |
| the restrictive tenant policy **alone** | **0** |

The second row is the incident. The third is the fix: **restrictive policies combine with `AND`**, so no later permissive policy can talk its way past them.

The fourth row is why you cannot simply mark the tenant policy restrictive and stop. A restrictive policy **cannot grant access**, only remove it, so something permissive has to allow the row first:

```sql
-- Permissive: allows rows at all.
CREATE POLICY documents_readable ON documents
    FOR ALL USING (true) WITH CHECK (true);

-- Restrictive: ANDs with every permissive policy, now and in future.
CREATE POLICY documents_tenant_isolation ON documents
    AS RESTRICTIVE
    USING      (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());
```

That pair is more typing than a single permissive policy, and it is the version where a well-meaning policy added next year cannot widen access. The repository uses the single permissive policy, because it is the shape most people start from and the one the mutations are written against.

### And one that is not a bug, but surprises people: joins

Policies apply per table reference, not per query. Being allowed to see a document does not imply being allowed to see the tenant row it points at.

So an inner join between two protected tables returns the intersection of what each policy allows. If a row is hidden on one side, the joined row disappears, and the effect looks like missing data rather than a permission error. A `LEFT JOIN` keeps the left row with nulls on the right, until a `WHERE` condition on a right-hand column removes it again.

Row-level security also does not make related rows belong to the same tenant. If that relationship has to hold, express it in the schema with a tenant-aware foreign key:

```sql
FOREIGN KEY (tenant_id, document_id) REFERENCES documents (tenant_id, id)
```

which is a second reason for the composite primary key.

## The part most guides skip: proving the tests work

Here is the thing about an isolation test suite. This passes:

```python
def test_tenant_a_cannot_see_tenant_b(conn):
    as_tenant(conn, ACME)
    assert titles(conn) == ["Acme Q3 revenue", "Acme staff list"]
```

It also passes against a table with **no policies at all**, if the seed silently failed and the table is empty. It passes if you connected as a role that bypasses RLS and there happens to be one tenant. It passes if the assertion was written to match whatever the code returned on the day.

A test suite for a security boundary has to be checked, not trusted. So the repository has a second script that breaks the schema on purpose and asserts the suite notices:

```terminal
{
  "title": "./verify-suite.sh",
  "prompt": "$",
  "steps": [
    { "comment": "expecting the suite to pass unmodified, and to fail for every mutation" },
    { "cmd": "./verify-suite.sh",
      "output": "  ok    baseline                             18 passed in 0.72s\n  ok    RLS disabled on documents            14 failed, 4 passed\n  ok    RLS disabled on tenants               2 failed, 16 passed\n  ok    FORCE removed, owner exempt again     2 failed, 16 passed\n  ok    WITH CHECK weakened to true           1 failed, 17 passed\n  ok    policy weakened to USING (true)      12 failed, 6 passed\n  ok    restored                             18 passed in 0.67s\n\nevery mutation was caught." }
  ]
}
```

Be careful about what that table proves. **Five deliberate schema regressions were detected by this suite.** That is real evidence about those five checks. It is not evidence of complete coverage, and it says nothing about a tenant id assigned wrongly in application code, a role that differs in production, or a table added next month.

Within that limit, the counts are still informative:

- Removing `FORCE` trips exactly **two** tests, the ones about the table owner. A narrow failure tells you what broke; a suite where everything goes red tells you much less.
- Weakening `WITH CHECK` trips exactly **one**, the insert test. If that number had been zero, it would mean this suite does not detect that particular regression, which is worth knowing before you rely on it.
- Disabling RLS on `tenants` trips **two**, and those two tests only exist because a review pointed out that nothing covered that table. Without them, someone could disable row-level security on the customer list and the entire suite would still be green.

**This is where I found my own mistakes.** The first version of that script printed its results without asserting them, which made it exactly the kind of check nobody notices failing. The first version of the test suite never touched the `tenants` table at all.

## Two things you will hit in production

**PgBouncer in transaction mode.** This is the common deployment and it works, but only if the shape is right: begin a transaction, set the tenant on it, run every protected query on that same transaction, commit. PgBouncer holds the backend for the life of the transaction, which is exactly the guarantee `set_config(..., true)` needs.

What does not work is setting the identity once per request, or in a connection-initialisation hook. A request that opens two transactions gets two different backends, and the second has no identity. A retried transaction has to set it again.

And do not rely on the pool to tidy up after you: in transaction mode PgBouncer does not normally run `server_reset_query`. Session-level state persists because nothing removes it. That is the risk, rather than an inevitability, and it is why "never set a session-level tenant" is the rule that keeps the transaction-level one honest.

**Migrations and backfills.** Once `FORCE` is on, the owner is inside the policy too, so a backfill that does not set a tenant updates **zero rows** and reports success. A loop over tenants, setting the identity for each, is the usual answer. Where a maintenance job genuinely needs to cross tenants, that is a deliberate, separately authorised thing, not a side effect of running as the owner.

## What row-level security does not do

It filters rows. It does not make another tenant's data unknowable, and it is worth keeping those apart before "the database enforces isolation" quietly becomes "nothing can be inferred".

**Constraints are checked outside the policy.** If `documents.id` were a globally unique primary key that callers can supply, inserting a guessed id and getting a unique violation tells you another tenant holds it. You never read the row, but you learned it exists. The repository uses a tenant-scoped primary key, `PRIMARY KEY (tenant_id, id)`, which removes that channel and puts the tenant column first in the index that every query filters on anyway.

**`EXPLAIN ANALYZE` reports rows removed by a filter**, which is a count of somebody else's data. Planner estimates and timings carry information too. None of that reaches a normal API response, but it is a reason not to hand out a SQL console.

## What to do on Monday

1. **Find out whether your application's database role is a superuser**, or has `BYPASSRLS`. This takes one query and it decides whether anything else is worth doing.

   ```sql
   SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolcanlogin;
   ```

2. **Pick one table and add a policy**, with `FORCE`. Not the whole schema. One table, and see what breaks in your test suite, because whatever breaks is a query that was relying on being able to see everything.

3. **Write the negative test before the positive one.** "Tenant A sees its two rows" is comfortable. "Tenant A sees nothing when the tenant is unset" is the one that catches a real bug.

4. **Then break it on purpose.** Disable the policy, run your tests, and count the failures. Zero failures means those tests do not detect that regression, which is the one thing you cannot learn from a green run. Check the failures are real assertions about rows, not fixtures falling over, because a connection error is not the same evidence.

## Summary

Row-level security moves tenant isolation from something every query has to remember into something the table guarantees. The mechanism is small: a setting, a function, two policies and a role that cannot escape them.

The care is all in the details around it. The owner exemption, the superuser bypass, the pooling scope of a boolean, and the difference between a test suite that passes and one you have watched fail.

The repository runs in one command, and the second command tells you whether the first one means anything.
