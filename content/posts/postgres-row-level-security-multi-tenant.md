---
title: 'Your Tenant Isolation Is One Forgotten WHERE Clause Away'
excerpt: 'Most multi-tenant apps enforce isolation in application code, which means every query is a chance to leak. Postgres row-level security moves the boundary into the database. Here is a working schema, the things that quietly break it, and why the role in your Neon connection string reads every tenant no matter what your policies say.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-09-19'
publishedAt: '2026-09-19T09:00:00Z'
updatedAt: '2026-09-21T09:00:00Z'
readingTime: '18 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Postgres
  - Neon
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
- **On Neon that wrong connection string is the one the console gives you.** `neondb_owner` holds `BYPASSRLS`. With a tenant set and `FORCE` on the table, it still read all four rows across both tenants.
- **`SET` cannot take a bind parameter.** Use `set_config('app.tenant_id', $1, true)`, and the `true` is what stops a pooled connection leaking a tenant into the next request.
- **Adding a second policy can undo the first.** Permissive policies combine with `OR`.
- **A passing isolation test suite is weak evidence.** Break the schema on purpose and check the suite notices. Mine did not, twice, until I did exactly that.

## Prerequisites

- A supported Postgres. Row-level security landed in 9.5, but run something still receiving fixes; everything here was run on Postgres 18.
- A multi-tenant schema, or the intention to build one.
- A Neon account, if you want to run the repository the way it was measured. Each run makes a branch, applies the schema to it and deletes it afterwards, so it costs nothing and touches nothing else. Docker works too, offline.

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

The fourth row is why marking the tenant policy restrictive is not enough on its own. A restrictive policy **cannot grant access**, only remove it, so something permissive has to allow the row first:

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

## What changes when it runs on Neon

Everything above is plain Postgres and holds anywhere. Then I moved the repository onto Neon, which is where most people reading this will actually run it, and four things needed changing before the schema would even apply. Each one is a consequence of a managed Postgres having no superuser and a connection pooler in front of the compute. Together they are the difference between a policy that protects a tenant and a policy that decorates one.

### The role in the connection string reads every tenant

This is the one to act on.

`neondb_owner` is the role in the connection string the Neon console shows you. It is the one that ends up in `DATABASE_URL`, because it is the one you were given. It holds `BYPASSRLS`:

```sql
SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = current_user;
--  neondb_owner | t
```

Same schema as above, `FORCE ROW LEVEL SECURITY` on the table, `app.tenant_id` set to Acme, same query. The only difference between these two lines is which role ran it:

```text
role=neondb_owner  bypassrls=true   rows=4  -> Acme Q3 revenue, Acme staff list, Globex Q3 revenue, Globex staff list
role=app_user      bypassrls=false  rows=2  -> Acme Q3 revenue, Acme staff list
```

`FORCE` does not save you. `FORCE` binds the table's *owner*, and has nothing to say about a role that skips policy evaluation altogether. There is no policy you can write that this role will obey.

This is not a Neon defect. `neondb_owner` is the administrative role for your project and wants to be able to see everything. It is a defect in the very reasonable assumption that the connection string you were handed is the one your application should use.

:::warning
If you are on Neon and you have row-level security, run this now:

```sql
SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = current_user;
```

If it says `t`, your policies are not enforcing anything on that connection.
:::

The fix is the same as the fix everywhere else: the application gets its own unprivileged role. The repository creates `app_user` and `app_owner` and uses neither the role Neon gave it nor the table owner for the application. On a Postgres you installed yourself this is advice. On Neon it is the difference between the feature working and not.

### A session setting on the pooled endpoint reaches the next client

Neon gives you two hosts for the same compute: the direct one, and the same name with `-pooler` in it. The pooled one is the right default for a serverless application, and it hands one server connection to many clients.

So the third argument to `set_config` stops being a style preference.

Measured on the pooled endpoint. Client A sets a session-scoped value and reads it back four times. Client B connects afterwards and never sets anything:

```text
client A query 1 -> setting=11111111  documents visible=2
client A query 2 -> setting=11111111  documents visible=2
client A query 3 -> setting=11111111  documents visible=2
client A query 4 -> setting=11111111  documents visible=2
client B (never set it) -> setting=11111111
```

Client B read client A's tenant identity. With `app.tenant_id` that is one customer's request adopting another customer's identity, decided by which pooled connection it happened to get.

The same test with `set_config(..., true)`, after restarting the compute so nothing was left over from the run above:

```text
fresh connection, nothing set -> setting=null  visible=0
inside the transaction        -> visible=2
after the commit              -> setting=      visible=0
another client                -> setting=
```

Gone at the commit, and invisible to the next client. The connection goes back to the pool carrying nothing. That is the entire difference between the two runs, and it is one boolean.

Worth noticing the first line of that second block: a fresh connection with no tenant set sees **zero** documents, not all of them. The policy fails closed. That is the behaviour you want from a security boundary, and it is why an unset tenant returning `NULL` rather than raising is deliberate.

### Creating a role gives you the admin option but not `SET ROLE`

The remaining two are smaller, and they are why the schema file has lines in it that look superstitious.

`ALTER TABLE ... OWNER TO app_owner` requires that the current user be able to `SET ROLE` to the new owner. Creating a role normally grants that implicitly. On Neon the membership comes back like this:

```text
role        granted_to      admin_option  inherit_option  set_option
app_owner   neondb_owner    true          false           false
```

Admin yes, `SET ROLE` no. So the statement fails:

```text
ERROR:  must be able to SET ROLE "app_owner"
```

The admin option is there, so the role can hand itself the part it is missing:

```sql
GRANT app_owner TO CURRENT_USER WITH SET TRUE;
```

The same check appears again on the way out: `DROP OWNED BY app_user` fails with `permission denied to drop objects` until the same grant is made.

### Two checks a local superuser skips

`ALTER TABLE ... OWNER TO` also requires the *new owner* to hold `CREATE` on the schema. A superuser skips that check, which is why this never comes up on a local Docker Postgres and fails immediately on Neon:

```text
ERROR:  permission denied for schema public
```

One line fixes it:

```sql
GRANT CREATE ON SCHEMA public TO app_owner;
```

And the passwords have to be real ones. Neon validates them in its control plane, so a demo role fails the statement before Postgres sees it:

```text
ERROR:  Received HTTP code 400 from control plane:
        {"error":"insecure password, try including more special characters,
         using uppercase letters, using numbers or using a longer password"}
```

That is four changes to make a textbook schema apply to a managed database, and none of them are in the textbook. The repository carries all four, each as a comment on the line it explains, guarded so the Docker path is unaffected.

### Why a branch is the right place to test this

The repository tests on a Neon branch rather than a shared database, and for this particular subject the reason is more than convenience.

A branch is a copy-on-write copy of its parent, so making one costs nothing and deleting it takes everything with it. This suite creates two login roles, rewrites table ownership and, in the verification script, deliberately disables row-level security on a table five times in a row. Doing that to a long-lived database means a window where the isolation you are demonstrating is switched off, and a cleanup step you have to get right. Doing it on a branch means the window is on a copy nobody is using, and cleanup is a delete.

```bash
export NEON_API_KEY=...
export NEON_PROJECT_ID=...
./run-on-neon.sh
```

```text
==> creating branch rls-test-1789987162
==> applying schema and seed
==> running the suite
22 passed in 13.89s
==> deleting branch br-billowing-voice-b2pp3j4i
```

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
  "title": "./run-on-neon.sh verify",
  "prompt": "$",
  "steps": [
    { "comment": "expecting the suite to pass unmodified, and to fail for every mutation" },
    { "cmd": "./run-on-neon.sh verify",
      "output": "  ok    baseline                             22 passed in 13.89s\n  ok    RLS disabled on documents            16 failed, 6 passed\n  ok    RLS disabled on tenants               2 failed, 20 passed\n  ok    FORCE removed, owner exempt again     2 failed, 20 passed\n  ok    WITH CHECK weakened to true           1 failed, 21 passed\n  ok    policy weakened to USING (true)      14 failed, 8 passed\n  ok    restored                             22 passed in 11.78s\n\nevery mutation was caught." }
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

**Transaction pooling.** Neon's pooled endpoint, and PgBouncer in transaction mode generally, works with all of this, but only if the shape is right: begin a transaction, set the tenant on it, run every protected query on that same transaction, commit. The pooler holds one backend for the life of the transaction, which is exactly the guarantee `set_config(..., true)` needs.

What does not work is setting the identity once per request, or in a connection-initialisation hook. A request that opens two transactions gets two different backends, and the second has no identity. A retried transaction has to set it again.

And do not rely on the pool to tidy up after you. In transaction mode the pooler does not normally reset session state, so it persists because nothing removes it. That is not a theory: the measurement above is a second client reading the first client's tenant id on Neon's pooled host. "Never set a session-level tenant" is the rule that keeps the transaction-level one honest.

If your framework sets session variables in a connection hook, which several do for exactly this pattern, that is the thing to go and look at first.

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

   On Neon, expect `neondb_owner` to come back with `rolbypassrls` set. If that is the role in your `DATABASE_URL`, make an unprivileged one and move the application to it before writing a single policy, because until you do, no policy you write is being enforced.

2. **Pick one table and add a policy**, with `FORCE`. Not the whole schema. One table, and see what breaks in your test suite, because whatever breaks is a query that was relying on being able to see everything.

3. **Write the negative test before the positive one.** "Tenant A sees its two rows" is comfortable. "Tenant A sees nothing when the tenant is unset" is the one that catches a real bug.

4. **Then break it on purpose.** Disable the policy, run your tests, and count the failures. Zero failures means those tests do not detect that regression, which is the one thing you cannot learn from a green run. Check the failures are real assertions about rows, not fixtures falling over, because a connection error is not the same evidence.

## Summary

Row-level security moves tenant isolation from something every query has to remember into something the table guarantees. The mechanism is small: a setting, a function, two policies and a role that cannot escape them.

The care is all in the details around it. The owner exemption, the bypass, the pooling scope of a boolean, and the difference between a test suite that passes and one you have watched fail.

On a managed Postgres two of those stop being details. The role you were handed reads every tenant, and the pooled endpoint will carry a session setting into somebody else's request. Neither is exotic. Both are the default path, which is what makes them worth the paragraph.

The repository runs in one command, and the second command tells you whether the first one means anything.
