# Neon Terminology Reference

Preferred terms and patterns for Neon documentation. Used by `/review-content` and `/humanize` for programmatic checks.

**Scope:** `content/docs/` and `content/changelog/` only. Does not apply to `content/postgresql/` (that section has its own conventions).

---

## The database is "Lakebase Postgres"

The database product is **Lakebase Postgres**. "Neon" is not the name of the database. It's the brand, the company, and the access path: the set of cloud backend primitives (Lakebase Postgres, Object Storage, Functions, Managed Better Auth, AI Gateway) reached through Neon, from Databricks, as part of the Databricks Platform.

The three terms:

1. **Lakebase Postgres** — the database product. Same technology whether accessed via Neon or via Databricks.
2. **lakebase architecture** (lowercase) — the category: OLTP built on cloud object storage, storage decoupled from compute. A category noun, not a proper noun. Never "the Neon architecture."
3. **Neon** — the complete set of cloud backend primitives built around Lakebase Postgres. Never "the database," never "a platform" / "the Neon platform" (because Neon is part of the Databricks platform)

| Use | Avoid | Notes |
| --- | --- | --- |
| Lakebase Postgres | Neon Postgres, Neon's database, our Postgres | The database product's name |
| the database / Postgres | Lakebase Postgres database (when wordy) | Shorten on repeat, unambiguous references |
| Lakebase Postgres (in full) | shortened forms | Name the product in full in each self-contained unit: summaries, subtitles, card descriptions, table rows, section ledes. Shorten to "the database" / "Postgres" only on repeat references within continuous body prose, to avoid awkward repetition. |
| lakebase architecture | the Neon architecture | Lowercase category term |
| Neon (brand / access path) | | Console, CLI, API, Auth, MCP Server keep "Neon" |
| Neon, a set of cloud backend primitives | the Neon platform, Neon is a platform | Neon is part of the Databricks platform |

Canonical line: "Neon is a complete set of cloud backend primitives built around Lakebase Postgres, for developers, startups, and agent platforms, from Databricks."

When it's genuinely just the database, say **Lakebase Postgres** (or "the database" / "Postgres" on repeat), never "Neon."

### Disambiguate the access path when a claim isn't true of both

Bare "Lakebase Postgres" is a claim about the database on **either** access path, so it's only correct when what you're saying holds on both Neon and Databricks. The moment a statement depends on one path, name it: **"Lakebase Postgres on Neon"** or **"Lakebase Postgres on Databricks."**

Add the qualifier when the sentence touches any of these:

- A Neon-only or Databricks-only feature (Managed Better Auth, Object Storage, Functions, AI Gateway, Data API, Claimable Postgres, Unity Catalog governance, high availability)
- Console or UI instructions, signup, or account creation
- Pricing, plans, credits, or free-tier limits
- A path-specific API, CLI, SDK, Terraform provider, or MCP Server
- A partner or marketplace integration that exists on only one path

Leave it bare for shared capabilities: branching, autoscaling, scale to zero, read replicas, instant restore, connection pooling, logical replication, extensions, Postgres version support, and the storage/compute architecture. Projects and branches are shared concepts too, so a bare "Lakebase Postgres project" is fine when you're describing the concept rather than telling the reader to go make one (for that case, see the procedural rule below).

- ✅ "Lakebase Postgres has instant point-in-time restore" (true on both)
- ✅ "Sign up for Lakebase Postgres on Neon" (signup is path-specific)
- ✅ "Export OTEL metrics from Lakebase Postgres on Neon" (path-specific tooling)
- ❌ "Sign up for Lakebase Postgres" (no shared signup exists)

**Don't over-qualify.** Adding "on Neon" to every mention makes shared capabilities look Neon-exclusive and undercuts the one-product framing. Default to bare "Lakebase Postgres"; add the path only where the claim actually narrows. When it's genuinely ambiguous, leave it bare.

### Renaming "Neon Postgres" must not delete the Neon signal

"Neon Postgres" carried two pieces of information: it's a database, and it's on Neon. Swapping in bare "Lakebase Postgres" keeps the first and silently drops the second, so a step that used to tell the reader where they're working no longer does.

When the sentence is a **step the reader performs**, reword around Neon instead of renaming the product:

- ❌ "Create a Lakebase Postgres database and connect it to your application"
- ✅ "Create a database on Neon and connect it to your application"
- ❌ "Set up a Lakebase Postgres project in seconds"
- ✅ "Set up a project on Neon in seconds"

Prefer plain "on Neon" phrasing over "Lakebase Postgres on Neon" in procedural text. "Create a database on Neon" reads like a human wrote it; "Create a Lakebase Postgres on Neon database" does not. Reserve the full "Lakebase Postgres on Neon" form for self-contained units where the product needs naming outright: titles, subtitles, summaries, card descriptions, table rows.

The test: after the rename, can a reader following the steps still tell which product they're working in? If not, you removed information instead of correcting it.

### Don't rename around the product name

The rename applies to the database, not to things whose names merely contain it:

- **Neon-owned product names keep "Neon":** Neon serverless driver, Neon Console, Neon CLI, Neon API, Neon Auth, Neon MCP Server, Data API. Never "Lakebase Postgres serverless driver."
- **Third-party titles, templates, and link text are quoted strings.** Leave them exactly as the third party publishes them.
- **Cross-page link text must match the target page's actual title.** If the target still reads "Neon Postgres Read Replicas," the link text says that too.
- **Renaming a heading changes its anchor.** Update every same-page and cross-page `#anchor` that pointed at the old slug.

---

## Postgres vs PostgreSQL

Use **Postgres** in almost all cases.

Use **PostgreSQL** only when:
- Referring specifically to the open source project ("the PostgreSQL project", "the PostgreSQL community")
- Citing an official version release ("PostgreSQL 17", "PostgreSQL 16.2")
- Making a formal reference to the official software product

When in doubt, use Postgres.

---

## Product UI and surfaces

| Use | Avoid | Notes |
| --- | --- | --- |
| Neon Console | dashboard, admin panel, control panel, the UI | Always capitalize |
| SQL Editor | query editor, SQL tool | Capitalize both words |

---

## Core concepts

| Use | Avoid | Notes |
| --- | --- | --- |
| compute | instance, server, container, pod | Lowercase noun. "A compute" or "the compute" is correct. |
| branch | copy, clone, fork | Lowercase. Avoid conflating with git branches in mixed contexts. |
| project | workspace, environment, app | A Neon project is a specific resource — don't use generically |
| endpoint | | Lowercase. Has a specific meaning in Neon architecture — don't use loosely to mean "URL" or "connection" |
| read replica | replica, standby, read-only instance | Lowercase, two words, no hyphen |
| connection pooling | | Lowercase. PgBouncer powers this in Neon. |
| connection string | connection URL, DSN, connection URI | Neon standardizes on "connection string" |
| compute unit | | Lowercase when written out. Abbreviate as "CU" after first mention. |
| CU | vCPU (as a synonym for CU) | Standard abbreviation for compute unit |

---

## Official Neon feature names

**Capitalization rule:** Capitalize a feature name when you're explicitly referring to the named feature ("Neon's Autoscaling feature", "configure Scale to Zero"). Use lowercase when you're describing the concept in general prose ("your compute autoscales", "the branch scales to zero", "create a read replica").

Named features that are always capitalized regardless of context — these are proper nouns, not concepts:

| Always capitalize | Notes |
| --- | --- |
| Neon Console | The web UI |
| Neon Auth | Not "Neon Authentication" |
| Neon CLI | "Neon CLI" in prose; `neonctl` only in code |
| Neon MCP Server | Full name on first mention; "the MCP Server" after. Never "Neon Postgres MCP Server" — drop "Postgres"; the product name does not contain the database name. |
| Neon Serverless Driver | The `@neondatabase/serverless` package |
| Data API | Neon's PostgREST-based API |
| Import Data Assistant | |
| IP Allow | Not "IP allowlist" as the feature name |

Feature names — capitalize when referring to the feature, lowercase in general prose:

| Feature name | Lowercase in prose example |
| --- | --- |
| Autoscaling | "your compute autoscales automatically" |
| Scale to Zero | "the compute scales to zero after inactivity" |
| Branching | "create a branch", "use branching in your workflow" |
| Read Replicas | "create a read replica", "use read replicas for analytics" |
| Logical Replication | "set up logical replication" |
| High Availability | "configure high availability for your project" |
| Branch Restore | "restore a branch to a previous state" |
| Backup & Restore | Ampersand, not "and" |
| Private Networking | "connect via private networking" |

---

## Postgres-ecosystem terminology

| Use | Avoid | Notes |
| --- | --- | --- |
| Postgres | PostgreSQL (in general prose) | See rule above |
| psql | PSQL, Psql | Always lowercase |
| pgvector | PgVector, pg_vector, pgVector | Lowercase, one word |
| PgBouncer | pgbouncer, pg_bouncer | Capital P, capital B — this is the official name |
| pg_dump | pg-dump, pgdump | Lowercase with underscore |
| pg_restore | pg-restore, pgrestore | Lowercase with underscore |

---

## Connection strings

Use `postgresql://` not `postgres://` in examples. Standard format:

```
postgresql://[user]:[password]@[neon_hostname]/[dbname]
```

Always include `?sslmode=require` in examples unless demonstrating a specific non-SSL scenario.

---

## Words and phrases to avoid

| Avoid | Use instead | Notes |
| --- | --- | --- |
| utilize | use | |
| leverage | use, or be specific | |
| seamlessly | cut, or describe what actually happens | |
| robust | cut, or be specific | |
| powerful | cut, or be specific | |
| comprehensive | cut, or be specific | |
| straightforward | cut | |
| easy, simple, quick (before steps) | cut — let the steps speak | |
| simply, just (before an action) | cut | |
| out of the box | by default | |
| sanity check | verify, confirm | |
| whitelist | allowlist | |
| blacklist | blocklist | |
| master (branch name in examples) | main | |

---

## Capitalization rules

- Capitalize feature names when explicitly referring to the named feature; use lowercase when describing the concept in prose
- Proper brand names are always capitalized: Neon Console, Neon Auth, Neon CLI, Data API, etc.
- Generic concepts are always lowercase in prose: compute, branch, project, endpoint, database, table, role
- Postgres extensions are lowercase: pgvector, pg_stat_statements, postgis
- "Neon" is always capitalized — never "neon"
- Third-party names follow official style: Vercel, GitHub, Prisma, Drizzle, SQLAlchemy, Next.js, PgBouncer
