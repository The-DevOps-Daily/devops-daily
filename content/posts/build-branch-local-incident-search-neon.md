---
title: 'Deploy a Complete AI Incident Backend on One Neon Branch'
excerpt: 'Build and verify a disposable incident-search backend with Neon Auth, Object Storage, Functions, AI Gateway, and Lakebase Postgres—then remove the complete environment with one guarded command.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-09-22'
publishedAt: '2026-09-22T09:00:00Z'
updatedAt: '2026-09-22T09:00:00Z'
readingTime: '16 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - neon
  - DevOps
  - serverless
  - postgres
  - ai-gateway
  - incident-response
---

A preview environment is only isolated if all of its state follows the preview. Giving a pull request its own application deployment and database branch does not help much when its writes still reach production identity, file, or model endpoints.

This tutorial deploys **Incident Atlas**, a small incident-response backend whose database, Auth state, stored reports, Function, and AI Gateway endpoint all belong to one disposable Neon branch. You will create the branch, exercise every service against a real postmortem, inspect the isolation boundaries, and delete the environment without touching the parent branch.

The React interface runs locally. The complete **backend**, not the frontend site, is what lives on Neon.

## TL;DR

After the one-time setup, the workflow is four commands:

```bash
npm run demo:up
npm run demo:test
npm run demo:open
npm run demo:down
```

They exercise five Neon backend primitives:

- **Lakebase Postgres** stores incident metadata and the search index.
- **Neon Auth**, Neon's managed Better Auth service, signs the operator in.
- **Object Storage** keeps the original report in a private bucket.
- A **Neon Function** named **Incident Atlas** exposes the backend API.
- **Neon AI Gateway** gives the Function branch-scoped access to the configured model.

The important feature is their shared lifecycle. After a branch is created, changes to its database, Auth records, stored objects, Function, and AI Gateway endpoint stay on that child. Deleting the child removes that environment; the parent project and its default branch remain.

A Neon branch is not necessarily empty. A normal child starts as a copy-on-write snapshot of its parent: database rows and schema are present immediately, and existing Auth and Object Storage state branches with them. Later child writes do not change the parent. This tutorial assumes that the default branch belongs to a new, demo-safe project; use the schema-only option described in Neon's [database branching workflow primer](https://neon.com/docs/get-started-with-neon/workflow-primer) when a preview must not inherit sensitive rows.

Object Storage, Functions, Neon Auth, and AI Gateway are generally available. The [Neon backend GA announcement](https://neon.com/blog/neon-backend-is-ga) describes the current product set and Free Plan allowances.

## Prerequisites

- Node.js 24 LTS
- A Neon project in a region that supports the complete Neon backend
- A project-scoped Neon API key
- AI Gateway credits or an applicable account allowance
- The [Incident Atlas companion repository](https://github.com/The-DevOps-Daily/neon-incident-atlas)

This walkthrough was tested in AWS US East (Ohio), whose Neon region ID is `aws-us-east-2`. At publication time, Neon also supports the complete backend in AWS Europe (Frankfurt). Using Ohio reproduces the environment behind the commands in this article.

“Hosted in AWS” does not mean that you install Neon in your AWS account. You choose the provider and region when creating the project in the Neon Console, and Neon operates the infrastructure. You do not supply credentials for your AWS account. Neon later generates `AWS_*` values for its S3-compatible Object Storage endpoint; those values belong to the disposable Neon branch.

From the companion repository, install dependencies and create the ignored environment file:

```bash
cd neon-incident-atlas
npm install
cp .env.example .env.local
```

Add the project ID and API key:

```dotenv
NEON_API_KEY=your_project_scoped_key
NEON_PROJECT_ID=your_project_id
```

Those are the only two values you put into `.env.local`. Deployment writes the temporary branch's connection strings and service credentials into that same ignored file.

:::important
The demo consumes metered resources and AI Gateway credits. Charges depend on your plan and remaining allowances. The child branch expires after six hours, but `npm run demo:down` is the primary cleanup mechanism.
:::

## Understand the request path first

**Neon Functions** is the product name. This project deploys a single Function whose display name is **Incident Atlas**. “One Function” is not a Neon product or service name.

Neon Auth does not invoke the Function. The browser first creates an Auth session, then requests a JWT and carries that token to the protected backend routes:

```diagram
{
  "type": "flow",
  "title": "How a protected request reaches the Incident Atlas Function",
  "nodes": [
    { "label": "React app", "sub": "1. submit sign-in", "icon": "globe", "tone": "slate" },
    { "label": "Neon Auth", "sub": "2. create session", "icon": "lock", "tone": "green" },
    { "label": "React app", "sub": "3. request JWT", "icon": "shield", "tone": "green" },
    { "label": "Incident Atlas Function", "sub": "4. verify JWT + run route", "icon": "gear", "tone": "blue" }
  ]
}
```

For each protected API call, the React client sends a credentialed request to Neon Auth's `/token` endpoint to obtain a bearer token from the current session. The Function verifies the JWT signature and issuer against the branch's Auth JWKS before accessing user data.

The Function has seven routes. `GET /health` is intentionally public so deployment automation can detect the running release; the other six require a valid JWT.

Across those protected routes, the Function coordinates the other branch-local services:

```diagram
{
  "type": "graph",
  "title": "What the Incident Atlas Function calls",
  "columns": [
    [
      { "id": "function", "label": "Incident Atlas Function", "sub": "six protected routes", "icon": "gear", "tone": "blue" }
    ],
    [
      { "id": "objects", "label": "Object Storage", "sub": "sign, inspect, read, delete", "icon": "box", "tone": "amber" },
      { "id": "postgres", "label": "Lakebase Postgres", "sub": "metadata + Lakebase Search", "icon": "database", "tone": "violet" },
      { "id": "ai", "label": "AI Gateway", "sub": "branch-scoped model access", "icon": "cpu", "tone": "green" }
    ]
  ],
  "edges": [
    ["function", "objects", "files"],
    ["function", "postgres", "data"],
    ["function", "ai", "model calls"]
  ]
}
```

The UI remains local for this tutorial because Neon Functions host backend logic, not frontend sites. In production, deploy the React application to your usual frontend host.

## Declare the branch-local backend

The repository describes the backend in `neon.ts`:

```typescript
import { defineConfig } from '@neon/config/v1';
import { INCIDENT_ATLAS_RELEASE } from './release.js';

export default defineConfig({
  auth: true,
  dataApi: false,
  aiGateway: true,
  buckets: {
    'incident-files': {}, // Private by default
  },
  functions: {
    app: {
      name: 'Incident Atlas',
      source: './functions/app.ts',
      env: {
        ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173',
        INCIDENT_ATLAS_BUCKET: process.env.INCIDENT_ATLAS_BUCKET ?? 'incident-files',
        INCIDENT_ATLAS_AI_MODEL: process.env.INCIDENT_ATLAS_AI_MODEL ?? 'gpt-5-mini',
        INCIDENT_ATLAS_RELEASE,
      },
      dev: { port: 8787 },
    },
  },
});
```

The service declarations are top-level because Object Storage, Functions, and AI Gateway are GA. Older examples place them under a `preview` object; the current config package accepts that shape only as a deprecated compatibility path.

`neon.ts` states what should exist on the target branch. The Neon CLI supplies the Terraform-like workflow: `neon config plan` previews the changes, and `neon config apply` reconciles them.

## Bring up the disposable backend

Run:

```bash
npm run demo:up
```

The deployment performs four stages:

1. It creates `incident-atlas-codex-<timestamp>` from the project's default branch and gives it a six-hour expiry.
2. It plans and deploys Neon Auth, the private bucket, the Incident Atlas Function, and AI Gateway.
3. It allows localhost and registers `http://localhost:5173` as an Auth domain.
4. It installs Lakebase Search's `lakebase_text` extension through the direct database connection, then creates the table and BM25 index. The migration explicitly uses `sslmode=verify-full`, so the PostgreSQL driver continues to verify the certificate and hostname when its defaults change.

On the validated run, the CLI reported `+ bucket incident-files`, `+ function app`, and the unchanged service line `Utilized services: Postgres, Neon Auth, Object Storage, Functions, AI Gateway`. The helper ended with `Applied migrations/001_incident_atlas.sql` and `Incident Atlas is ready.`

The helper discovers the deployed Function URL and stores it as `INCIDENT_APP_URL`; you do not copy service URLs between commands.

The lifecycle script treats its local state as untrusted. Before reusing or deleting a recorded branch, it checks the project, branch ID, branch name, parent, and protection flags. If deployment fails after branch creation, it attempts cleanup automatically.

## Upload one report

Start the local UI:

```bash
npm run demo:open
```

Open `http://localhost:5173`, then follow one path:

1. Create an account through Neon Auth.
2. Upload `fixtures/checkout-timeout-postmortem.md`.
3. Wait for the status to move through `queued` and `processing` to `ready`.
4. Search for `checkout 504`.
5. Replace the search text with `Why did checkout time out?` and select **Ask with citations**.

The report does not pass through the Function during upload. The protected presign route creates an owner-scoped object key and returns a five-minute signed URL; the browser then sends the file directly to Object Storage.

When the browser confirms the upload, the Function checks that:

- the key begins with the authenticated user's `users/<owner>/` namespace;
- the stored byte count exactly matches the signed request;
- the stored content type matches the allowlisted type.

Only then does it create the `queued` database row. The object key is unique, so retrying the confirmation returns the existing incident instead of creating a duplicate or deleting its file. If a new insert fails and the database can confirm that no row references the object, the Function makes a best-effort cleanup attempt. If the database is unavailable, it preserves the object for later reconciliation rather than risk deleting referenced data.

`waitUntil()` allows the Function to return HTTP `202 Accepted` while a bounded promise reads the private object and calls `gpt-5-mini` through Neon AI Gateway. The second read rechecks the size and content type and rejects invalid UTF-8. The model extracts a title, severity, summary, systems, and tags, and the Function stores the original text for retrieval. A failed read or model call moves the incident to `failed` instead of leaving it stuck in `queued`.

Incident Atlas accepts only Markdown, plain text, and JSON reports up to 32 KiB. That bound lets the Function send the complete report to the model instead of silently truncating a larger file. Browsers sometimes omit the MIME type for Markdown, so the UI falls back to the filename extension before the server enforces the same allowlist.

## Search with Lakebase Search, then ask the model

**Lakebase Search** is the search product. This demo uses its `lakebase_text` Postgres extension, whose `lakebase_bm25` index access method provides BM25 keyword ranking.

The migration creates a generated search column over the title, AI-generated summary, and original report:

```sql
content_tsv tsvector GENERATED ALWAYS AS (
  to_tsvector(
    'english',
    coalesce(title, '') || ' ' ||
    coalesce(summary, '') || ' ' ||
    coalesce(content, '')
  )
) STORED
```

It then creates the BM25 index:

```sql
CREATE INDEX incidents_bm25_idx
  ON incidents USING lakebase_bm25 (content_tsv tsvector_bm25_ops)
  WITH (default_limit = 50);
```

Search ranks the complete generated column but returns a query-relevant `ts_headline` excerpt. That distinction matters: returning the first 1,600 characters can rank the right report while hiding the matching evidence from both the reader and the model.

The `/ask` route takes at most four ranked reports, numbers their excerpts, and calls the model through Neon AI Gateway. Its system instruction requires citations such as `[1]`, restricts the answer to the supplied reports, and treats report text as untrusted data rather than instructions.

AI Gateway remains behind the Function. The browser receives neither its credential nor the raw model request. Neon explains the same boundary in [LLMs belong in your backend](https://neon.com/blog/llms-belong-in-your-backend).

## Prove what actually works

A zero exit code from a deployment command does not prove that the services work together. Run:

```bash
npm run demo:test
```

The smoke test:

1. waits for the expected Function release;
2. proves a protected route rejects an anonymous request;
3. creates a Neon Auth session and verifies its JWT against the branch JWKS;
4. uploads the real fixture and proves an unsigned read is denied;
5. repeats upload confirmation and proves it returns the same incident;
6. confirms the Function reads the object and completes AI enrichment;
7. checks that Lakebase Search returns the incident with a relevant excerpt;
8. checks that the model answer identifies the reported cause and cites the returned source inline;
9. deletes the incident, then verifies both the database row and stored object are gone.

```terminal
{
  "title": "real branch smoke test",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    { "cmd": "npm run demo:test", "output": "\n> neon-incident-atlas@0.1.0 demo:test\n> tsx scripts/live-smoke.ts\n\n◇ injected env (15) from .env.local\nPASS Neon Auth issued a JWT verified against the branch JWKS\nPASS Object Storage accepted the upload and denied an unsigned read\nPASS the Incident Atlas Function read the object and used AI Gateway\nPASS Lakebase Search returned the incident with a relevant excerpt\nPASS the model returned a supported answer with an inline citation\nCLEANED smoke-test incident and stored object" }
  ]
}
```

That is a live test against the deployed branch, not a mocked integration test. The temporary Auth identity remains inside the disposable branch and is removed during final branch teardown.

## Keep user data isolated twice

The Function uses the verified JWT `sub` claim as the owner. Every database operation starts a transaction and sets that identity locally:

```sql
SELECT set_config('app.user_id', $1, true);
```

The table also enables and forces row-level security:

```sql
CREATE POLICY incidents_owner_policy ON incidents
  USING (owner_id = current_setting('app.user_id', true))
  WITH CHECK (owner_id = current_setting('app.user_id', true));
```

Explicit owner predicates make application intent visible. Forced RLS adds a database-enforced boundary using the same verified identity. The transaction-local setting is essential because Function requests reuse pooled database connections.

Object Storage applies the same owner ID in `users/<owner>/<uuid>/...`. A valid user cannot confirm another user's object key, and deletion can only obtain an object key through an owner-filtered database query.

Deletion removes the object before the database row. Object deletion is idempotent, so if the subsequent database operation fails, the caller can retry instead of leaving an unreachable object behind.

## Tear down the complete backend

Stop the local UI and run:

```bash
npm run demo:down
```

The cleanup script refuses to proceed unless:

- the state file belongs to `NEON_PROJECT_ID`;
- the branch name starts with `incident-atlas-codex-`;
- the remote branch ID, name, and parent match the recorded branch;
- the branch is neither default nor protected.

It then deletes the child branch, polls until Neon reports it absent, removes the local state file, and prunes generated branch credentials from `.env.local`. Your project ID and API key remain for another run.

Deleting the child removes its Function alongside its database state, Auth identity, stored objects, and AI Gateway endpoint. The Neon project and default branch are not deleted. [Neon Functions: backend logic next to your data](https://neon.com/blog/neon-functions-backend-logic-next-to-your-data) describes how Functions inherit branch identity and lifecycle.

## What this demo intentionally leaves out

Incident Atlas proves the backend lifecycle, but it is not a production incident-management service. A production version still needs:

- invitation or organization controls around account creation;
- rate limits for uploads, search, and model requests;
- malware scanning and stricter content processing;
- a durable workflow system for independent retries;
- reconciliation for objects uploaded but never confirmed;
- stricter validation and policy checks around model-generated output;
- audit logs, retention policies, and structured observability;
- recovery or reconciliation for every cross-service partial failure.

`waitUntil()` is appropriate for this bounded demonstration. It is not a durable job queue: the request starts the work, and there is no independent retry schedule if the runtime disappears.

## Wrapping up

The useful lesson is not that five products fit into one demo. It is that their state shares one operational boundary.

You create one child branch, deploy an authenticated backend, upload a private report, search it with Lakebase Search, call a model without exposing its credential, verify the complete request path, and delete the environment. The workflow stays approachable because the application code is already present and the four commands focus on the lifecycle a DevOps reader actually needs to understand.
