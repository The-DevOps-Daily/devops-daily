---
title: 'The No-Backend Backend: Neon Data API, RLS and 27 Attacks'
excerpt: 'A team task board with no server code: static React, Neon Auth, and the Neon Data API with row-level security as the only guard. A signed-in attacker tried 27 ways in. What held, the four mistakes that would have let her through, and the 15-minute gap.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-09-25'
publishedAt: '2026-09-25T09:00:00Z'
updatedAt: '2026-09-25T09:00:00Z'
readingTime: '14 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Neon
  - Postgres
  - Security
  - Row-Level Security
  - Data API
  - Multi-tenancy
  - JWT
---

We built a multi-tenant team task board with no backend. The browser loads static files, signs in with Neon Auth, and reads and writes through the Neon Data API. There is no API server, no serverless function and no middleware. The only thing deciding which team sees which rows is a set of row-level security policies in Postgres.

Then we gave a second team's owner, eve, a valid account and a script, and had her try 25 ways into the first team, plus two tries from the wrong role inside it: crafted filters, embedded joins, aggregate counts, forged tokens, `alg: none`, a token signed with her own key, bulk updates, upserts over the other team's ids. **All 27 were refused.** We then broke the security layer four realistic ways, one at a time. Three of them let specific attacks through, and the suite caught each one. The fourth, a sloppy `WITH CHECK (true)`, did nothing on its own, because a second layer stopped it.

The one thing the policies could not stop was time. **A member removed from a team kept reading its data for fifteen and a half minutes**, the life of the token they already held plus about thirty seconds. That one has a fix, and it costs nothing we could measure.

```github
The-DevOps-Daily/neon-data-api-rls
```

## TLDR

- **The architecture:** static React, Neon Auth organizations for teams, the Neon Data API for every query, row-level security as the only authorization layer. Zero server code.
- **The tenant comes from a signed token.** Neon Auth puts the active organization in the JWT, and `auth.organization_id()` reads it inside Postgres. Every policy is `org_id = auth.organization_id()`.
- **27 attacks, 27 refused.** Every write attempt was also checked against the real rows, so a "refusal" that quietly changed data would have failed.
- **Column grants are the second wall.** A policy with `WITH CHECK (true)` let nothing through, because the client is never granted the `org_id` column. Adding table-wide grants on top is what opened it.
- **Removal is not instant.** A removed member's old token worked for 900 seconds plus 29. Checking Neon Auth's member table inside the policies closed it with no measurable cost.
- **The Data API added about a millisecond.** A request took 42 ms at p50 over a network round trip that took 42 ms.

## Prerequisites

- A Neon project with Neon Auth enabled on the branch. Its organization plugin, which this uses for teams, is on by default.
- The Data API provisioned on the same branch with Neon Auth as the provider, in the Console or with `neon data-api create`.
- Node.js 20 or later for the scripts, and the repository above.
- Some familiarity with Postgres row-level security. [Your Tenant Isolation Is One Forgotten WHERE Clause Away](/posts/postgres-row-level-security-multi-tenant) covers the model this builds on.

## What "no backend" means here

In a usual stack, the browser calls your API, your API authenticates the user, works out their tenant and runs the query with a `WHERE tenant_id = ...` it wrote itself. Every one of those steps is code you own and can get wrong.

Here, three managed pieces replace it:

```diagram
{
  "type": "flow",
  "nodes": [
    {
      "label": "Browser",
      "sub": "static files only",
      "icon": "globe",
      "tone": "slate"
    },
    {
      "label": "Neon Auth",
      "sub": "sign in, token with the team",
      "icon": "lock",
      "tone": "violet"
    },
    {
      "label": "Data API",
      "sub": "verifies the token, runs as authenticated",
      "icon": "net",
      "tone": "blue"
    },
    {
      "label": "Postgres",
      "sub": "policies read auth.organization_id()",
      "icon": "database",
      "tone": "green"
    }
  ]
}
```

The Data API is PostgREST-compatible: `GET /tasks?select=id,title&done=eq.false` is a query, `POST /rpc/org_summary` calls a function. It checks the JWT on every request against Neon Auth's keys and runs the query as the `authenticated` role, with the token's claims available inside Postgres through the `auth` functions.

So the whole authorization story fits in two SQL files. Everything below is about whether those two files hold.

## The tenant is a signed claim

A team is a Neon Auth organization. When a user picks one, Neon Auth issues a token that names it in an `o` claim, and it only does that for an organization the user belongs to. Asking to make someone else's team active returns `403 User is not a member of the organization`, which is attack T6 below.

Inside Postgres, `auth.organization_id()` returns that claim. The tables default their tenant column to it, and every policy compares against it:

```sql
create table tasks (
  org_id     uuid not null default auth.organization_id(),
  id         uuid not null default gen_random_uuid(),
  title      text not null check (length(title) between 1 and 200),
  done       boolean not null default false,
  created_by text not null default auth.user_id(),
  created_at timestamptz not null default now(),
  primary key (org_id, id)
);

alter table tasks enable row level security;

create policy tasks_read on tasks for select
  using (org_id = auth.organization_id());

create policy tasks_insert on tasks for insert
  with check (org_id = auth.organization_id());

-- Only owners and admins delete. The role is in the same signed claim.
create policy tasks_delete on tasks for delete
  using (
    org_id = auth.organization_id()
    and auth.organization() ->> 'role' in ('owner', 'admin')
  );
```

If you read the RLS starter post, this is the same shape as its `tenant_id = current_tenant()`. The difference is where the tenant comes from. There, the application server wrote it into a session setting before each query, and a bug in that server could set it wrong. Here there is no server; the tenant arrives in a token that Neon Auth signed and the Data API verified.

The primary key is `(org_id, id)` for the reason the starter gives: with a globally unique id, a failed insert could tell eve that an id exists in another team. Scoped to the tenant, her copy of an id lands in her own team.

## Grants are the wall behind the wall

The Data API exposes whatever the grants allow. The policies decide which rows; the grants decide which tables, columns and functions. We made the grants as narrow as the app is:

```sql
grant select on tasks, task_comments to authenticated;
grant insert (title, done) on tasks to authenticated;
grant update (title, done) on tasks to authenticated;
grant delete on tasks to authenticated;

revoke all on tasks, task_comments from anonymous;
```

The client can insert a title and a done flag, and nothing else. It never sends `org_id` or `created_by`: the column defaults fill them from the token. An update cannot move a task to another team, whatever a policy says, because `org_id` is not an updatable column for this role.

That turned out to matter more than it looks, as the break section shows.

There is one RPC, a dashboard summary. It is `security definer`, which means it runs with the owner's rights and no policy applies inside it. Its `WHERE` clause is the only thing keeping it to the caller's team:

```sql
create function org_summary()
returns table (total bigint, done bigint, comments bigint)
language sql stable security definer set search_path = public, pg_temp as $$
  select count(*), count(*) filter (where t.done),
    (select count(*) from task_comments c where c.org_id = auth.organization_id())
  from tasks t
  where t.org_id = auth.organization_id()
$$;

-- Functions are executable by PUBLIC by default, which includes anonymous.
revoke execute on function org_summary() from public;
grant execute on function org_summary() to authenticated;
```

## A hostile client, 27 ways

The attack script signs in three users: alice owns Acme, bob is a member of Acme, and eve owns Evil Corp. Twenty-five of the attacks are eve's, all aimed at Acme; M1 and M2 are the wrong role inside Acme. The requests are raw HTTP, not a client library, because a library tidies up exactly the requests an attacker would not.

Each attack states what must happen. Then the harness reads Acme's rows through the owner connection and compares them with a fingerprint taken just before. An attack that returned an error but still changed a row fails.

```terminal
{
  "title": "attack.mjs",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "node scripts/attack.mjs --json",
      "output": "id   attack                                         status rows result\nR1   list every task                                200    2    held\nR2   filter on Acme's org_id                        200    0    held\nR3   ask for Acme's task ids directly               200    0    held\nR4   OR the filter with her own org                 200    2    held\nR5   embed comments inside tasks                    200    2    held\nR6   read comments on an Acme task                  200    0    held\nR7   exact count of Acme's tasks                    200    0    held\nR8   aggregate count() over all tasks               200    1    held\nR9   the org_summary RPC                            200    1    held\nR10  Neon Auth's user table via Accept-Profile      404    -    held\nR11  Neon Auth's membership table                   404    -    held\nW1   insert a task with Acme's org_id               403    -    held\nW2   update every task in Acme                      200    0    held\nW3   move her task into Acme                        403    -    held\nW4   delete Acme's tasks                            200    0    held\nW5   upsert over an Acme task id                    403    -    held\nW6   comment on an Acme task                        409    -    held\nW7   comment as someone else                        403    -    held\nM1   bob (member) deletes an Acme task              200    0    held\nM2   alice (owner) edits bob's comment              200    0    held\nT1   no token at all                                400    -    held\nT2   no token, call the RPC                         400    -    held\nT3   her token with the org claim edited to Acme    400    -    held\nT4   alg none with the org claim set to Acme        400    -    held\nT5   signed by her own key, with the real kid       400    -    held\nT6   ask Neon Auth to make Acme her active org      403    -    held\nT7   ask Neon Auth to change her role claim         200    -    held\n\n27 of 27 held"
    }
  ]
}
```

A few of these are worth reading closely.

**R7 and R8 ask for counts, not rows.** `Prefer: count=exact` and `select=count()` are how a PostgREST client learns totals. Both counted only what the policy let eve see: zero Acme tasks, and exactly her own.

**W2 and W4 return 200 with no rows.** Row-level security does not raise an error when a statement touches rows you may not see; it leaves them out. An `UPDATE` across all of Acme succeeds and updates nothing. That is correct, and it is also why the app treats an empty result from a delete as the refusal. We come back to this in the gotchas.

**W1, W3, W5 and W7 never reached a policy.** They tried to set `org_id`, `id` or `created_by`, and the column grants refused them with `403 permission denied for table`.

**T1 to T5 never reached Postgres.** No token, an edited claim, `alg: none` and a token signed with eve's own key were all rejected at the Data API with `400`, as `missing authentication credentials`, `signature error` or `missing key id`. A request without a valid token never reached Postgres.

**T7 asked Neon Auth to change her role claim.** The Data API picks the Postgres role from the token's `role` claim, so a user who could set it would pick their own database role. Neon Auth ignored the request: the stored role stayed `user` and the token still said `authenticated`.

## Four ways to break it

A test suite that has only ever passed proves little. The break script applies one realistic mistake, runs all 27 attacks against it, and restores:

```terminal
{
  "title": "break.mjs",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "node scripts/break.mjs",
      "output": "weak-with-check: tasks_insert says WITH CHECK (true), everything else unchanged\n  still held: all 27\n\nweak-with-check-and-default-grants: the same policy, plus the table-wide grants the Data API can add for you\n  BROKEN 1: W1 (insert a task with Acme's org_id)\n\ndefiner-without-filter: org_summary() loses its WHERE clause\n  BROKEN 1: R9 (the org_summary RPC)\n\ntable-without-rls: task_comments ships with row-level security off\n  BROKEN 2: R6 (read comments on an Acme task), M2 (alice (owner) edits bob's comment)\n\nrestored: 27 of 27 held again"
    }
  ]
}
```

**`WITH CHECK (true)` on its own let nothing through.** This is the mistake the RLS starter post warns about, and with a server in front it would let a client write into any tenant. Here the client cannot choose `org_id` at all, so the weak policy had nothing to wave through. The column grants caught it.

**The same policy plus table-wide grants opened it.** The Data API setup offers to grant `SELECT, INSERT, UPDATE, DELETE` on every table in `public` to `authenticated`. That is convenient, and it is exactly what turned a harmless mistake into eve inserting tasks into Acme. If you take the default grants, your policies are the only wall, and every `WITH CHECK` has to be right.

**A `security definer` function without its filter leaked counts.** No policy applies inside it, so the `WHERE` clause is everything. This is the mistake most likely to survive review, because the function looks like a harmless dashboard query.

**A table without row-level security leaked its rows.** `task_comments` with RLS off let eve read Acme's comments by task id. New tables are where this happens, because `enable row level security` is a separate statement nobody remembers until it is missing. It also broke M2 inside Acme: the rule that only a comment's author can edit it disappeared with the policy.

## The fifteen minutes

Policies decide what a token may do. They do not decide how long a token lives.

The revocation script signs bob in, removes him from Acme through Neon Auth, and keeps using the token he already had:

```terminal
{
  "title": "revocation.mjs, token only",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "comment": "about 16 minutes: it waits for the old token to die"
    },
    {
      "cmd": "node scripts/revocation.mjs",
      "output": "   1s bob's token: org Acme, expires in 900s\n   1s before removal, bob's token reads 3 Acme tasks\n   2s alice removes bob from Acme: 200\n   2s a new token for bob now carries org: none\n   2s right after removal, bob's OLD token reads 3 Acme tasks (HTTP 200)\n 931s the old token is refused (HTTP 400), 31s after its exp\n      the last request it served was 29s after its exp\n 933s bob invited back into Acme"
    }
  ]
}
```

A new token for bob carries no team the moment he is removed. The old one keeps reading Acme's tasks for the rest of its 900-second life, and the Data API honoured it until 29 seconds past its `exp`, which is ordinary clock-skew leeway. If "removed from the team" has to mean "cannot read the team's data", fifteen and a half minutes is a long time.

The fix is to ask a second question in every policy: is this user still a member right now? Neon Auth keeps memberships in `neon_auth.member`, which the `authenticated` role cannot read, so a `security definer` function looks it up:

```sql
create function current_org_role() returns text
language sql stable security definer set search_path = pg_catalog, pg_temp as $$
  select m.role from neon_auth.member m
  where m."organizationId" = auth.organization_id()
    and m."userId" = auth.user_id()::uuid
$$;

alter policy tasks_read on tasks
  using (org_id = auth.organization_id() and (select current_org_role()) is not null);
```

The `(select ...)` makes Postgres evaluate it once per statement instead of once per row. The delete policy uses the looked-up role too, so a demoted owner loses delete at once, not in fifteen minutes. The RPC needs the same condition in its `WHERE` clause, because policies do not apply inside it.

With it on, the same test:

```terminal
{
  "title": "revocation.mjs, strict",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "node scripts/strict.mjs",
      "output": "strict mode on: policies also check Neon Auth's member table"
    },
    {
      "cmd": "node scripts/revocation.mjs",
      "output": "   2s bob's token: org Acme, expires in 900s\n   2s before removal, bob's token reads 3 Acme tasks\n   2s alice removes bob from Acme: 200\n   2s a new token for bob now carries org: none\n   2s right after removal, bob's OLD token reads 0 Acme tasks (HTTP 200)\n   2s the old token got nothing after the removal (HTTP 200, 0 rows), 899s before its exp\n   2s bob invited back into Acme"
    }
  ]
}
```

All 27 attacks still hold with it on, and it did not move the latency numbers:

```chart
{
  "type": "bar",
  "title": "Request time at p50, token only against strict",
  "unit": "ms",
  "caption": "100 sequential requests of each kind over a kept-alive connection, from a client 42 ms from the Data API endpoint. Strict adds a Neon Auth membership lookup to every policy. Differences are within run-to-run noise on these small tables.",
  "rows": [
    {
      "label": "TCP connect",
      "value": 41.9,
      "series": "Token only"
    },
    {
      "label": "TCP connect",
      "value": 40.5,
      "series": "Strict"
    },
    {
      "label": "GET /tasks",
      "value": 42.7,
      "series": "Token only"
    },
    {
      "label": "GET /tasks",
      "value": 42.3,
      "series": "Strict"
    },
    {
      "label": "RPC",
      "value": 42.5,
      "series": "Token only"
    },
    {
      "label": "RPC",
      "value": 42.6,
      "series": "Strict"
    },
    {
      "label": "PATCH",
      "value": 41.8,
      "series": "Token only"
    },
    {
      "label": "PATCH",
      "value": 41.6,
      "series": "Strict"
    }
  ],
  "series": [
    {
      "name": "Token only",
      "color": "#0080ff"
    },
    {
      "name": "Strict",
      "color": "#10b981"
    }
  ]
}
```

We would turn it on for anything where removal matters, which is most things. It lives in the repository as `db/optional/live_membership.sql`, applied with `npm run strict`.

## What it costs

**Per request, about a millisecond.** 100 sequential requests of each kind over a kept-alive connection, from a client 42 ms from the endpoint:

| | p50 | p95 |
|---|---|---|
| TCP connect (one network round trip) | 41.9 ms | 292.4 ms |
| `GET /tasks` with embedded comment counts | 42.7 ms | 49.1 ms |
| `POST /rpc/org_summary` | 42.5 ms | 48.8 ms |
| `PATCH` one task | 41.8 ms | 47.2 ms |

A read with embedded counts, an RPC and a write all took the same time as a bare TCP connect to the same host. JWT verification, the policies and the query together fit inside run-to-run noise here. The tables are tiny, though: a policy that has to join or scan grows with the data, and this does not measure that.

**On the page, the SDK.** The built app is 600 KB of static files, 587 KB of it JavaScript, 161 KB gzipped. Most of that is `@neondatabase/neon-js`, which carries the auth client, the organization plugin and the PostgREST client.

**In operations, nothing to run.** There is no server to deploy, patch or scale. The trade is that your security review moves into SQL, and SQL is where the four breaks above live.

## Gotchas we hit

- **`security invoker` functions cannot see the token.** The `auth` schema belongs to `cloud_admin`, and `authenticated` has no `USAGE` on it, which your owner role cannot grant: ours tried, and the grant had no effect. A `security invoker` function that calls `auth.user_id()` fails with `permission denied for schema auth`. Policies still work, because a policy stores the function itself rather than its name, and `security definer` functions work because they run as the owner.
- **New functions need a schema refresh.** The Data API caches the schema. After adding a function, some requests returned `404` until we ran `neon data-api refresh-schema`.
- **An empty result is the refusal.** A delete that RLS blocks returns `200` and zero rows, not an error. The app checks the returned rows and tells the user.
- **Switching teams means a new token.** The client caches a token for up to a minute, and the old one names the old team. Our app reloads after switching.
- **Scripts must look like a browser to Neon Auth.** Sign-in from Node fails with `Origin header is required` until you send one, and Neon Auth rate-limits sign-ins, so the test harness reuses sessions.
- **Listing your own invitations returned 403 for our unverified test users.** In our app that call failed and, because we loaded it alongside the team list with `Promise.all`, took the team list down with it. Each call now fails on its own.

## What we could not conclude

- **Performance at scale.** Five tasks and one comment say nothing about how a policy with a subquery behaves over millions of rows. The latency numbers are about the request path, not the data.
- **Whether fifteen minutes is fixed.** We measured the token lifetime we were given. We did not look for a way to shorten it, and a shorter one would narrow the gap without closing it.
- **Anything about the anonymous role.** It has no grants here, so we tested that it gets nothing, not how to design public data safely.
- **The limits of Neon itself.** This tests an application's security layer through the Data API. It is not a penetration test of Neon Auth or the Data API.
- **Browser behaviour beyond Chromium.** The session cookie is a partitioned third-party cookie. We drove the app in headless Chromium only, and did not test Firefox or Safari.

## What we would do

1. **Take the tenant from the token and default the column to it.** `default auth.organization_id()` means the client never names a tenant, so it cannot name the wrong one.
2. **Grant columns, not tables.** It is what turned our weakest policy into a non-event. Skip the table-wide default grants unless you are sure every `WITH CHECK` is right.
3. **Treat every `security definer` function as a policy of its own.** Put the tenant filter in it, revoke it from `public`, and test it with a hostile token.
4. **Check live membership in the policies.** One indexed lookup per statement closes a fifteen-minute gap.
5. **Keep a hostile client in the repository.** Twenty-seven requests take seconds to run. The break script is what proves they would notice.

The schema, the attacks, the breaks and every recorded run are in the repository.
