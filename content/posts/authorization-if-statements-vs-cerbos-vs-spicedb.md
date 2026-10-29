---
title: 'Moving Authorization Out of Your App Code: If-Statements vs Cerbos vs SpiceDB, Measured'
excerpt: 'We built one permission model as if-statements, as Cerbos policies and as a SpiceDB relationship graph, grew it through roles, teams, sharing and a late contractor rule, and checked 84 hand-written decisions at every step. Here is what each design cost in latency, in list queries and in lines of code.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-10-27'
publishedAt: '2026-10-27T09:00:00Z'
updatedAt: '2026-10-27T09:00:00Z'
readingTime: '18 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Authorization
  - Security
  - Architecture
  - Cerbos
  - SpiceDB
  - DevOps
---

Many products rebuild their permissions three times: first roles, then teams, then per-document sharing. Somewhere after that, a rule arrives that nobody planned for. The usual advice is to move authorization out of the application code before that happens, into a policy engine or a Zanzibar-style relationship graph. We wanted to know what that move costs and what it buys, so we built the same permission model three ways and grew it in four steps:

1. **if-statements** in the application, with a SQL query for lists.
2. **Cerbos** policy files, evaluated by a local Cerbos policy decision point (PDP).
3. **SpiceDB**, an open source implementation of Google's [Zanzibar](https://research.google/pubs/zanzibar-googles-consistent-global-authorization-system/) design: a schema plus relationships.

A hand-written table of 84 expected decisions checked all three at every step. Then we timed them on a Raspberry Pi 4 with 10,000 documents. The numbers describe this setup: a Pi, one request at a time, the app database in the same process. Both the milliseconds and the ratios between the designs belong to this setup; a network, a different database or other hardware can change either.

What we found:

- **A single check is cheap only in-process.** The if-statements answered in 0.14 ms. Cerbos took 3.8 ms and SpiceDB 10.8 ms (median p50). On this Pi a call to either server that does no authorization work already costs about 2.4 ms, and Cerbos's own log puts its handling time at 0.63 ms. By the bar we set before measuring (p99 under 5 ms), a check through either engine is not cheap on this machine.
- **Listing is where they really differ.** "Which of these 10,000 documents can this member view?" took 4.4 ms as SQL, 11.9 to 31.6 ms through a Cerbos query plan turned into SQL (depending on two lines of our own adapter), and 404 ms through SpiceDB when its cache was cold (77 ms warm). For an admin who can view all 10,000, SpiceDB took 3.3 seconds cold.
- **The late rule cost little code in every design:** 22 changed lines in one file for the if-statements, 15 in two files for Cerbos, 13 in two files for SpiceDB. It never stayed out of the application: Cerbos needed a new attribute in every request, and SpiceDB needed a new relationship synced from the database. In SpiceDB it also made a cold list about 3.5 times slower.
- **Leave out part of the late rule and every design fails open.** The table caught each of the three faults we injected, and it also caught SpiceDB returning duplicate documents in a list.

## TLDR

- Same model, three designs, four steps, one table of 84 hand-written decisions. All three matched it at every step.
- Single check, median p50 and p99: if-statements 0.14 / 0.24 ms, Cerbos 3.8 / 7.9 ms, SpiceDB 10.8 / 19.4 ms on new checks and 2.8 ms p50 on repeated ones, because SpiceDB caches results.
- List for a typical member (1,020 of 10,000 visible): SQL 4.4 ms, Cerbos 11.9 to 31.6 ms, SpiceDB 77 ms warm to 404 ms cold. SpiceDB's own docs suggest a different pattern above about 10,000 results, and for an admin's first page it took 18 ms.
- Lines changed over the four steps: 83 for if-statements, 211 for Cerbos, 187 for SpiceDB. The engines cost more up front; by step 4 a new rule cost them fewer lines than the if-statements (15 and 13 against 22).
- The engines did not remove application changes. Every new rule needed data, and the data lives in your app.
- Keep the if-statements while one app owns the rules and you can test them as a table. Move out when several services need the same answer or the relationships nest deeply.

## Prerequisites

- Node.js 22.13 or later (the demo uses the built-in `node:sqlite`)
- Linux on arm64 or amd64. The demo downloads pinned Cerbos and SpiceDB release binaries and checks their SHA-256. No Docker.
- Basic familiarity with role-based access control and SQL joins
- The demo repository, which contains every commit, script and recorded run in this post:

```github
The-DevOps-Daily/authz-three-ways
```

## The model and the four steps

The app has users, teams, documents and shares in SQLite. The actions are `view`, `edit` and `delete`. We wrote the rules for all four steps into `CLAIM.md` before writing any code, together with what result would prove our claim wrong:

| Step         | Rule                                                                                                                                     |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Roles     | Each user has one org role. `viewer` can view every document, `editor` can view and edit, `admin` can view, edit and delete.             |
| 2. Teams     | Each document belongs to a team. `viewer` and `editor` now apply only to documents of the user's own teams. `admin` is unchanged.        |
| 3. Sharing   | A document can be shared with one user as `view` or `edit`, whatever that user's teams are. A share never grants delete.                 |
| 4. Late rule | Contractors get no access at all to documents outside their own teams. This overrides every earlier grant, including `admin` and shares. |

We picked the late rule before implementing anything. It is a realistic one: security asks for it after an audit, and it cuts across every grant that already exists, so it tests whether a design can say "no" over the top of many "yes" paths.

The expected-decisions table, `fixture/expected.csv`, has seven users, two teams, four documents and four shares, and one row per (user, action, document) with the expected answer at each step:

```text
user,action,document,step1,step2,step3,step4
cora,view,d4,allow,deny,allow,deny
kai,delete,d1,allow,allow,allow,deny
nell,view,d2,allow,deny,allow,allow
```

Cora is an editor in `eng` and a contractor, with an edit share on `d4`, a `sales` document. Kai is an admin and a contractor in `sales`. Nell is a viewer with no team and a view share on `d2`. `harness/correctness.js` runs every row against each design at each step, and also asks each design for the full list of documents each user can view, which must match the table's `view` rows.

## Three designs

```diagram
{
  "type": "infra",
  "groups": [
    {
      "label": "if-statements",
      "sub": "everything in the app",
      "icon": "box",
      "tone": "green",
      "nodes": [
        { "label": "check()", "sub": "JavaScript, up to 4 queries", "icon": "gear", "tone": "green" },
        { "label": "list()", "sub": "one SQL query", "icon": "database", "tone": "green" },
        { "label": "SQLite", "sub": "the app's own tables", "icon": "database", "tone": "slate" }
      ]
    },
    {
      "label": "Cerbos",
      "sub": "stateless policy engine",
      "icon": "shield",
      "tone": "blue",
      "nodes": [
        { "label": "App", "sub": "reads attributes from SQLite", "icon": "box", "tone": "slate" },
        { "label": "Cerbos PDP", "sub": "policy YAML, gRPC", "icon": "shield", "tone": "blue" },
        { "label": "Plan to SQL", "sub": "PlanResources, your adapter", "icon": "database", "tone": "blue" }
      ]
    },
    {
      "label": "SpiceDB",
      "sub": "Zanzibar-style graph",
      "icon": "lock",
      "tone": "amber",
      "nodes": [
        { "label": "App", "sub": "syncs rows to relationships", "icon": "box", "tone": "slate" },
        { "label": "SpiceDB", "sub": "schema, gRPC", "icon": "lock", "tone": "amber" },
        { "label": "Relationships", "sub": "SpiceDB's own copy", "icon": "database", "tone": "amber" }
      ]
    }
  ]
}
```

The three designs put the rule and the data in different places, and that difference explains almost every number below.

- **if-statements** (`approaches/ifs/index.js`): one `check()` function that reads the user, the document, the team membership and any share from SQLite, and one `list()` function that is a SQL query. The rule is written twice: once in JavaScript and once in SQL.
- **Cerbos** (`approaches/cerbos/`): the rules live in YAML policies, with derived roles such as `team_editor` and `shared_viewer`. Cerbos stores no application data, so for every check the app reads the same rows from SQLite and sends them as principal and resource attributes. For lists, Cerbos's PlanResources API returns a condition tree, and our `plan-to-sql.js` turns it into a SQL `WHERE`.
- **SpiceDB** (`approaches/spicedb/`): the rules live in a schema, and the data lives in SpiceDB as relationships such as `document:d1#team@team:eng`. `sync.js` copies the app's rows into SpiceDB. A check is one CheckPermission call with no database read in the app. A list is LookupResources.

Both engines ran on 127.0.0.1 and were called over gRPC through their official Node clients, one client each for the whole run, without TLS: Cerbos 0.57.0 with policies on disk, and SpiceDB 1.57.0 with its in-memory datastore, which its [docs](https://authzed.com/docs/spicedb/concepts/datastores) describe as intended for testing integrations. Each design has one commit per step in the repo, tagged `step<N>-ifs`, `step<N>-cerbos` and `step<N>-spicedb`, so every line count below comes from `git diff --numstat`.

## The same rule, three ways

Here is the late rule, "contractors get nothing outside their own teams", as each design wrote it. These are excerpts from the step 4 commits; `// ...` marks lines left out.

```tabs
{
  "title": "Step 4: contractors get nothing outside their own teams",
  "tabs": [
    {
      "label": "if-statements: check()",
      "lang": "javascript, approaches/ifs/index.js",
      "code": "const inTeam = Boolean(isMember.get(doc.team_id, userId));\n// Contractors get nothing outside their own teams, whatever else grants it.\nif (user.contractor && !inTeam) return false;\n// A share grants access whatever the user's role and teams are.\nconst share = getShare.get(docId, userId);\nif (share && SHARE_ACTIONS[share.level].includes(action)) return true;\n// Roles other than admin apply only to documents of the user's teams.\nif (user.role !== 'admin' && !inTeam) return false;\nreturn ROLE_ACTIONS[user.role].includes(action);"
    },
    {
      "label": "if-statements: list()",
      "lang": "javascript + SQL, same file",
      "code": "// Contractors see only documents of their own teams.\nconst contractorFilter = `(:contractor = 0 OR d.team_id IN\n  (SELECT team_id FROM team_members WHERE user_id = :user))`;\nconst allDocs = db.prepare(`SELECT d.id FROM documents d WHERE ${contractorFilter}`);\nconst visibleDocs = db.prepare(`\n  SELECT d.id FROM documents d\n  JOIN team_members m ON m.team_id = d.team_id\n  WHERE m.user_id = :user\n  UNION\n  SELECT s.document_id FROM shares s\n  JOIN documents d ON d.id = s.document_id\n  WHERE s.user_id = :user AND ${contractorFilter}`);"
    },
    {
      "label": "Cerbos: policy",
      "lang": "yaml, approaches/cerbos/policies/document.yaml",
      "code": "# Contractors get nothing outside their own teams, whatever else grants it.\n- actions: [\"*\"]\n  effect: EFFECT_DENY\n  roles: [\"*\"]\n  condition:\n    match:\n      all:\n        of:\n          - expr: request.principal.attr.contractor == true\n          - expr: \"!(request.resource.attr.team in request.principal.attr.teams)\""
    },
    {
      "label": "Cerbos: app",
      "lang": "javascript, approaches/cerbos/index.js",
      "code": "const getUser = db.prepare('SELECT id, role, contractor FROM users WHERE id = ?');\n// ...\nreturn { id: user.id, roles: [user.role], attr: { teams, contractor: user.contractor === 1 } };"
    },
    {
      "label": "SpiceDB: schema",
      "lang": "zed, approaches/spicedb/schema.zed",
      "code": "definition org {\n    // ...\n    relation contractor: user\n}\n\ndefinition document {\n    // ...\n    // Contractors get nothing outside their own teams, whatever else grants it.\n    permission outside_contractor = org->contractor - team->member\n\n    permission view = (org->admin + team->view_docs + viewer + editor) - outside_contractor\n    permission edit = (org->admin + team->edit_docs + editor) - outside_contractor\n    permission delete = org->delete_docs - outside_contractor\n}"
    },
    {
      "label": "SpiceDB: sync",
      "lang": "javascript, approaches/spicedb/sync.js",
      "code": "for (const u of db.prepare('SELECT id, role, contractor FROM users').all()) {\n  out.push(touch('org', ORG, u.role, 'user', u.id));\n  if (u.contractor) out.push(touch('org', ORG, 'contractor', 'user', u.id));\n}"
    }
  ]
}
```

Three things stand out:

- **The if-statements wrote the rule more than once:** in `check()`, and again in each list query that can return a document from outside the user's teams (the admin query and the shares branch). Miss one and the list leaks while every check passes.
- **Cerbos needed no change to the plan adapter.** The planner folds the principal's side of the condition into constants, so for Cora the deny rule becomes an `eq` on `request.resource.attr.team` with the value `eng`, ANDed with her grants, which the adapter already handled (`results/final/plans-step4.json`). It did need one more attribute from the app.
- **SpiceDB's rule is one line of schema,** an exclusion: `org->contractor - team->member`. But SpiceDB knows only what the app writes into it, so `sync.js` needed a new relationship type too.

## What each step cost in code

```chart
{
  "type": "line",
  "title": "Lines changed in each design, per step",
  "unit": " lines",
  "x": [
    "1: roles",
    "2: teams",
    "3: sharing",
    "4: contractors"
  ],
  "series": [
    {
      "name": "if-statements",
      "data": [
        29,
        12,
        20,
        22
      ],
      "color": "#10b981"
    },
    {
      "name": "Cerbos",
      "data": [
        73,
        82,
        41,
        15
      ],
      "color": "#0080ff"
    },
    {
      "name": "SpiceDB",
      "data": [
        133,
        31,
        10,
        13
      ],
      "color": "#f59e0b"
    }
  ],
  "caption": "Lines added plus deleted in each design's own commit, from git diff --numstat. The shared data-model commits (29, 26, 9, 5 lines) are the same for all three and not counted. Step 2 for SpiceDB includes the de-duplication fix the table forced (8 of its 31 lines)."
}
```

| Step         | if-statements    | Cerbos            | SpiceDB            |
| ------------ | ---------------- | ----------------- | ------------------ |
| 1. Roles     | 1 file, 29 lines | 3 files, 73 lines | 3 files, 133 lines |
| 2. Teams     | 1 file, 12 lines | 4 files, 82 lines | 3 files, 31 lines  |
| 3. Sharing   | 1 file, 20 lines | 4 files, 41 lines | 2 files, 10 lines  |
| 4. Late rule | 1 file, 22 lines | 2 files, 15 lines | 2 files, 13 lines  |
| Total        | 83 lines         | 211 lines         | 187 lines          |

The shapes differ more than the totals. The if-statements were cheapest to start, and from step 2 on each rule cost more than the last (12, 20, 22 lines), because every rule touched both `check()` and the list query. Cerbos paid most at step 2, when the first condition appeared and we had to write the 43-line plan-to-SQL adapter. SpiceDB paid most at step 1: client setup, paging for LookupResources and the sync code. After that, sharing cost SpiceDB 10 lines.

Two caveats keep these numbers honest. Line counts depend on style, so read the diffs in the repo rather than trusting a total. And our if-statements are the best case: one module with one `check()`. If your checks are spread over many handlers, the late rule is many edits.

## A single check

```chart
{
  "type": "bar",
  "title": "One permission check, 10,000 documents (median p50, tick at p99)",
  "unit": "ms",
  "tickLabel": "p99",
  "rows": [
    {
      "label": "if-statements, in-process",
      "value": 0.14,
      "tick": 0.24,
      "series": "if-statements"
    },
    {
      "label": "Cerbos over gRPC",
      "value": 3.83,
      "tick": 7.91,
      "series": "Cerbos"
    },
    {
      "label": "SpiceDB over gRPC, new checks",
      "value": 10.78,
      "tick": 19.37,
      "series": "SpiceDB"
    },
    {
      "label": "SpiceDB over gRPC, repeated checks",
      "value": 2.83,
      "tick": 15.62,
      "series": "SpiceDB"
    },
    {
      "label": "No-op call to Cerbos",
      "value": 2.4,
      "tick": 6,
      "series": "No-op call"
    },
    {
      "label": "No-op call to SpiceDB",
      "value": 2.44,
      "tick": 6.31,
      "series": "No-op call"
    }
  ],
  "series": [
    {
      "name": "if-statements",
      "color": "#10b981"
    },
    {
      "name": "Cerbos",
      "color": "#0080ff"
    },
    {
      "name": "SpiceDB",
      "color": "#f59e0b"
    },
    {
      "name": "No-op call",
      "color": "#94a3b8"
    }
  ],
  "caption": "Raspberry Pi 4, step 4 model, concurrency 1. Checks: median across 3 runs of 10,000 each. No-op calls: one run of 5,000 each. \"New checks\" are random (user, action, document) triples; \"repeated checks\" draw from 100 triples, so SpiceDB's cache answers most of them. A no-op call does no authorization work. Absolute numbers are from a Pi: compare the bars with each other."
}
```

We timed 10,000 random (user, action, document) checks per run, three runs, one at a time, with the three designs interleaved on every sample so that anything else on the Pi slowed all of them equally. All three gave the same answer on every sample that completed.

At the median, the in-process check (0.144 ms) was about 27 times faster than Cerbos (3.83 ms) and about 75 times faster than SpiceDB (10.8 ms). Where that time goes:

- A request to either server that does no authorization work (Cerbos `ServerInfo`, SpiceDB `ReadSchema`) took 2.40 and 2.44 ms at the median on this Pi. A Node-to-Node TCP echo between two processes took 0.33 ms, so most of that is request handling in the gRPC client and server, not the loopback network.
- Cerbos logs its own handling time for each request. Its median was 0.63 ms, against 3.8 ms seen by the client.
- So for Cerbos, a request that does nothing already costs most of what a check costs. For SpiceDB on new checks, it is about a quarter of the 10.8 ms. We did not measure where the rest goes inside SpiceDB, and a `ReadSchema` call is only a reference point, not the same work as a check minus the graph.
- SpiceDB's cache removes most of that difference. When the same 100 checks repeated, as they do when people reopen the same documents, its p50 dropped to 2.8 ms, close to the no-op call, while Cerbos stayed at 3.8 ms.

One thing the chart hides: the if-statements' check runs up to four queries against SQLite in the same process. With Postgres across a network, each of those queries is a network round trip. The Cerbos design pays the same queries and the PDP call on top. The SpiceDB design reads nothing from the app database for a check. In that layout the gap between the in-process design and the engines could be smaller than it is here. We did not measure it.

One of 60,000 SpiceDB checks failed with `UNAVAILABLE: Stream closed with error code NGHTTP2_REFUSED_STREAM`. SpiceDB closes client connections after 30 seconds by default (`--grpc-max-conn-age`), which is our best explanation, and the Node client did not retry it. We counted the failure and left it out of the timings. In production, give the client a retry policy for `UNAVAILABLE`.

## Listing what a user can see

This is the question every list page asks, and the designs answer it in completely different ways:

- **if-statements:** a SQL query with a `UNION` of team documents and shared documents, filtered for contractors.
- **Cerbos:** PlanResources returns a condition tree for this user, our adapter turns it into a `WHERE`, and SQLite runs it.
- **SpiceDB:** LookupResources walks the graph backwards from the user and streams document IDs. The app then fetches those rows from its own database, a step we did not time.

```chart
{
  "type": "bar",
  "title": "List the documents a typical member can view (1,020 of 10,000)",
  "unit": "ms",
  "rows": [
    {
      "label": "if-statements: SQL",
      "value": 4.4,
      "series": "if-statements"
    },
    {
      "label": "Cerbos: plan to SQL, IN subquery",
      "value": 11.9,
      "series": "Cerbos"
    },
    {
      "label": "Cerbos: plan to SQL, as committed",
      "value": 31.6,
      "series": "Cerbos"
    },
    {
      "label": "SpiceDB: LookupResources, warm",
      "value": 77.2,
      "series": "SpiceDB"
    },
    {
      "label": "SpiceDB: LookupResources, cold",
      "value": 403.9,
      "series": "SpiceDB"
    }
  ],
  "series": [
    {
      "name": "if-statements",
      "color": "#10b981"
    },
    {
      "name": "Cerbos",
      "color": "#0080ff"
    },
    {
      "name": "SpiceDB",
      "color": "#f59e0b"
    }
  ],
  "caption": "Median ms on a Raspberry Pi 4, step 4 model. \"As committed\" turns each share condition into a correlated EXISTS; the IN-subquery variant changes only those two lines. SpiceDB bars come from a separate cache experiment with one unlimited LookupResources call: \"cold\" is the first call in a new 5 s revision window, \"warm\" repeats it at the same revision."
}
```

| 10,000 documents | Visible | if-statements | Cerbos (as committed) | SpiceDB, warm | SpiceDB, cold |
| ---------------- | ------- | ------------- | --------------------- | ------------- | ------------- |
| Admin            | 10,000  | 25.3 ms       | 29.9 ms               | 691 ms        | 3,279 ms      |
| Member           | 1,020   | 4.4 ms        | 31.6 ms               | 77 ms         | 404 ms        |
| Contractor       | 510     | 2.4 ms        | 9.6 ms                | 41 ms         | 247 ms        |

The SQL and Cerbos columns are medians of the run medians from `results/final/list-*.json`. The SpiceDB columns come from a separate cache experiment, `harness/spicedb-list-cache.js`, which separates the two cases on purpose, because SpiceDB's list time depends on its cache more than on anything else. It differs from our adapter's list call in two ways: it makes one LookupResources call with no limit instead of pages of 1,000, and it reads with `minimize_latency` and then `at_exact_snapshot` instead of `at_least_as_fresh`. Timed through the adapter itself, the member's list had a median of 75 ms and the admin's 803 ms, mostly warm calls; see below.

```terminal
{
  "title": "SpiceDB LookupResources, step 4, 10,000 documents",
  "steps": [
    {
      "cmd": "nice -n 19 node harness/spicedb-list-cache.js --tree=.steps/step4 --out=results/final/spicedb-list-cache.json",
      "output": "admin      visible 10000  first in a new 5 s window: median 3278.544 ms  same revision again: median 691.44 ms\nmember     visible 1020  first in a new 5 s window: median 403.896 ms  same revision again: median 77.2 ms\ncontractor visible 510  first in a new 5 s window: median 246.668 ms  same revision again: median 41.139 ms\nproblems (wrong answers or a reused revision): 0"
    }
  ]
}
```

SpiceDB caches results per revision. By default it reads at a revision rounded to a 5-second window (`--datastore-revision-quantization-interval`), and the in-memory datastore's revisions are timestamps, so every 5 seconds the read revision moves and the cache starts cold, even with no writes. Which case a request gets depends on timing. In our runs of 20 back-to-back admin lists (`results/final/list-*.json`), most found a warm cache, with a median of about 800 ms, and the slowest took about 3.7 s.

Four more things we measured about lists:

- **Our Cerbos adapter was the slow part, not Cerbos.** The committed adapter turns "this user is in the document's `viewers`" into a correlated `EXISTS`, which SQLite runs once per document. Changing those two adapter lines to an uncorrelated `d.id IN (SELECT document_id FROM shares WHERE ...)` cut the member list from 31.6 ms to 11.9 ms, with the same answers (`scripts/variant.js`). The plan is only as fast as the SQL you turn it into, and that SQL is yours to write. Cerbos publishes [reference adapters](https://docs.cerbos.dev/cerbos/latest/api/) for Prisma, Drizzle, SQLAlchemy and others; we used none, because we used plain SQLite.
- **Page size matters for LookupResources.** Our list code asks LookupResources for pages of 1,000, the default of SpiceDB's `--max-lookup-resources-limit` flag, and follows the cursor. For the admin that took 0.8 seconds over 11 calls. Pages of 100 took 7.2 seconds over 106 calls, and a single call with no limit took 0.7 seconds (`results/final/lookup-pages.json`).
- **SpiceDB's docs already say this.** Its guide to [protecting a list endpoint](https://authzed.com/docs/spicedb/modeling/protecting-a-list-endpoint) suggests LookupResources when a user can see fewer than about 10,000 resources, and otherwise fetching a page of candidates from your own database and filtering them with CheckBulkPermissions. We timed that for "the first 50 documents in ID order", against our adapter listing every visible ID with LookupResources, sorting them and keeping 50 (`harness/spicedb-page.js`). For the admin the bulk checks took 18 ms with one call, against 786 ms for the full LookupResources list. For the contractor, who can see 5% of the documents, it took 167 ms over 11 bulk calls, against 37 ms. So the right pattern depends on how much of the data each user can see.
- **The late rule made SpiceDB's cold lists about 3.5 times slower.** We ran the cold and warm list test against the code of every step (`results/steps/step<N>-spicedb-list-cache.json`). From step 3 to step 4, the admin's cold list went from 928 to 3,204 ms, the member's from 108 to 390 ms and the contractor's from 64 to 227 ms. The warm lists did not move (686 to 696, 73 to 70, 42 to 38 ms). Thirteen lines of schema and sync were cheap to write; the exclusion they added is not cheap to evaluate.

## What the table caught

The 84-row table was the most useful file in the repo. It caught two things we would otherwise have shipped.

**SpiceDB returns duplicates.** At step 2, Kai, an admin who is also a member of `sales`, got `d3` and `d4` twice from our adapter's paged LookupResources calls: once through the admin path and once through the team path. This is expected behaviour: an [issue in the SpiceDB repository](https://github.com/authzed/spicedb/issues/3190) explains that two paths to the same resource can produce two results, calls duplicates a known limitation of cursored calls, and recommends de-duplicating on the client. We added a `Set` and recorded the failing run in `results/caught/`.

**Every design fails open when part of the late rule is missing.** `scripts/break.js` leaves out one part of the step 4 change in each design and runs the table again:

```terminal
{
  "title": "leave out part of the late rule",
  "steps": [
    {
      "cmd": "node scripts/break.js > results/breaks.txt"
    },
    {
      "cmd": "grep -v '^     ' results/breaks.txt",
      "output": "ifs-forgot-the-list-query      mismatches 2 (list) caught\ncerbos-forgot-the-attribute    mismatches 10 (check, list) caught\nspicedb-forgot-the-sync        mismatches 10 (check, list) caught"
    }
  ]
}
```

- **if-statements:** `check()` has the rule, but `list()` kept its step 3 query. Every check passes, and Cora's list still shows the `sales` document shared with her.
- **Cerbos:** the policy has the deny rule, but the app does not send `contractor`. The condition cannot match a missing attribute, so the deny never fires. Cerbos can [validate attributes](https://docs.cerbos.dev/cerbos/latest/policies/schemas) against a JSON schema; with `reject` enforcement, its docs say every action of an invalid request is denied. With `contractor` marked as required, that would turn this failure from open to closed. We did not test it.
- **SpiceDB:** the schema has the exclusion, but `sync.js` does not write `org#contractor`. With no relationship there is nothing to exclude.

None of the three designs made these omissions safe. The table of expected decisions caught all three, which is why we would run it against every change.

## The costs this benchmark leaves out

- **Keeping SpiceDB in sync.** `sync.js` copies the whole database at start. A real app must write every change, such as a new share or a new contractor, to both its database and SpiceDB, and a crash between the two writes leaves them disagreeing. AuthZed calls this [the dual-write problem](https://authzed.com/blog/the-dual-write-problem) and lists ways to handle it, from a transactional outbox to making SpiceDB the source of truth. Cerbos and the if-statements read the app's data at request time, so they do not have this problem.
- **Running a server.** Both engines are another service to deploy, monitor, upgrade and keep available, or a hosted product to pay for.
- **A real datastore.** SpiceDB on Postgres or CockroachDB will have different numbers from the in-memory datastore.
- **Fetching the rows.** SpiceDB's list returns IDs. A list page then needs a second query for titles and dates.

## When the if-statements are the right answer

In this repo the if-statements were the fastest design on every timing we took for all three, and the smallest in total code. They are the right answer more often than vendor pages suggest. Keep them when:

- **One application owns the rules.** Everything lives in one codebase and one database, and one team changes both. A policy engine earns its keep when several services must answer the same question the same way.
- **Your rules are mostly filters on your own tables.** Teams, owners and shares are joins. SQL already plans them, and your list endpoint keeps pagination, sorting and search.
- **You can keep the checks in one module.** Our `ifs` design is one file with one `check()` and one `list()`. That is the best case. If your checks are spread over fifty handlers, the late rule is fifty edits, and our line counts do not apply to you.
- **You test the rules as data.** The expected-decisions table is what made each step safe, and it works for if-statements as well as for policies.

The if-statements stop being enough when:

- **More than one service or language needs the same answer.** Copying the rules into each one is how they drift apart.
- **People outside the team need to read or change the rules,** for example a security review of what contractors can see. A separate policy file or schema may be easier for them to review than a SQL `UNION` inside a JavaScript function, depending on what they already read.
- **You need a record of decisions.** Cerbos can write [decision logs](https://docs.cerbos.dev/cerbos/latest/configuration/audit) (off by default, and off in our runs). Homemade code has none unless you build it.
- **The relationships nest,** such as folders inside folders or groups inside groups. Walking a graph is what SpiceDB is built for, and it is awkward to write and to index in SQL. Our model has no nesting, so this test does not cover it.

## The hosted options

Several companies offer managed authorization services or control planes, some built on these engines and some on others. Some run the decision service for you; others manage policies while evaluation stays in your environment. We did not test any of them, so this is only what their own documentation says they offer:

- **Cerbos Hub** is a control plane for the open source Cerbos PDP. Per its [docs](https://docs.cerbos.dev/cerbos-hub/), it tests, signs and distributes policy bundles to your PDPs, which keep running in your own network, and it offers an embedded PDP compiled to WebAssembly for evaluation in browsers, edge functions and other JavaScript environments.
- **AuthZed** sells hosted SpiceDB. Per its [docs](https://authzed.com/docs/authzed/guides/picking-a-product), AuthZed Cloud is a self-service platform with usage-based pricing, and AuthZed Dedicated is a private deployment in the cloud provider and regions you choose. For lists too large for LookupResources, its [list guide](https://authzed.com/docs/spicedb/modeling/protecting-a-list-endpoint) describes AuthZed Materialize: its Event Streams feature, in early access for Dedicated customers at the time of writing, lets your service keep a local table of permissions so that filtering becomes a JOIN.
- **Oso Cloud** is Oso's authorization service, with policies written in the Polar language. Its [local authorization](https://www.osohq.com/docs/authorization-data/local-authorization) mode returns SQL, including conditions that filter a list query, which your application runs against its own PostgreSQL or MySQL database; Oso does not read that data.
- **Permit.io** offers a managed cloud PDP, or a PDP container that you run next to your services and that evaluates policies with OPA or Cedar, per its [docs](https://docs.permit.io/). It lists RBAC, ABAC and ReBAC models, and bulk checks for lists and tables.
- **WorkOS FGA** extends WorkOS RBAC with roles scoped to resources in a parent-child hierarchy, per its [docs](https://workos.com/docs/fga). Your app registers resources with WorkOS, and the API checks access and lists the resources a user can access.

The trade we measured carries over to each of them: wherever the rule lives, it has to meet the data it needs. Either the data travels with every request, or someone keeps a copy in sync, or, as Oso's local authorization does, the rule becomes a query that runs where the data already is.

## What we could not conclude

- **Production latency.** Everything ran on one Raspberry Pi 4, at concurrency 1, with the app database in the same process. Neither the milliseconds nor the ratios predict a production system; they show how the designs differ under the same conditions.
- **Tuned servers.** We did not tune either engine. Both ran with their defaults, except that we turned off telemetry and SpiceDB's metrics endpoint and set SpiceDB's log level to `warn`. Cerbos, at its default `info` level, writes two log lines per request; we did not measure what that costs it. Everything, servers included, ran at the lowest CPU priority (`nice -n 19`) on a Pi shared with other work, and each timed run first waited for a quiet machine: a 1-minute load average under 1.25 for the step 4 runs and under 1.5 for the per-step runs, giving up after 10 and 15 minutes. Each result file records the load average it started at.
- **Throughput.** We measured one request at a time. We did not measure how many checks per second each design sustains.
- **Deep hierarchies.** Our model has no nested folders or groups, which is where a relationship graph should do best and recursive SQL is hardest. This test does not cover it.
- **Why the exclusion costs SpiceDB so much on a cold list.** We measured that it does, not where the time goes inside SpiceDB.
- **The cause of the one failed SpiceDB call.** The 30-second connection age is our best explanation; we did not confirm it.

## Summary

We set out to show that a single check is cheap in all three designs and that listing and the late rule separate them. By the rules we wrote in `CLAIM.md` before measuring, that claim is wrong, because its first half failed. A single check is cheap only in-process: through either engine it cost a network call, and on this Pi that call alone was about 2.4 ms. The second half held. For the member, a Cerbos plan turned into SQL took 2.7 to 7 times as long as the hand-written SQL, and SpiceDB's LookupResources 18 to 92 times as long, warm to cold. The cache, the page size and our own SQL adapter moved those numbers as much as the engines did. The late rule cost every design 13 to 22 lines and still needed a change in the application, because every rule needs data and the data lives in your app.

If one app owns the rules, keep them in code, keep them in one module, and test them with a table like `fixture/expected.csv`. When you do move them out, plan the data path first: what each request must carry for Cerbos, what must be kept in sync for SpiceDB, and how your list pages will get their answers.

For deny-by-default routes and a test for every access check, see [A01:2025 Broken Access Control](/guides/owasp-top-10/01-broken-access-control) in our OWASP Top 10 guide.
