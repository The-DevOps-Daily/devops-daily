---
title: 'A Postgres Branch Per Learner: Building on Neon'
excerpt: 'Every hands-on lab gets its own Postgres branch, AI generation runs outside the request cycle, and cleanup is core infrastructure rather than a chore.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-08-04'
publishedAt: '2026-08-04T09:00:00Z'
updatedAt: '2026-08-04T09:00:00Z'
readingTime: '19 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - DevOps
  - Postgres
  - Neon
  - Next.js
  - Architecture
  - AI
---

Teaching Postgres by showing someone a code block is a waste of everybody's time. They need a database they can break.

That requirement is what shaped most of the architecture behind [DevOps Daily Pro](https://learning.devops-daily.com), our paid learning platform. Learners get quizzes, AI-graded mock interviews, spaced repetition and progress tracking, but the part that actually costs engineering effort is the hands-on labs: a real PostgreSQL database, per learner, that they can run real SQL against and then throw away.

This is a write-up of how that works, what Neon does for us in each part of it, and the decisions we would defend if you disagreed with them.

## TL;DR

- Every hands-on lab gets its own Neon branch cloned from a seeded parent. Learners run real SQL, not simulated output.
- Branch cleanup is not a nice-to-have. An orphaned branch costs money for as long as it exists, so the cleanup job is core infrastructure.
- Slow AI generation runs in a Neon Function outside the request cycle. The status row is claimed with a conditional `UPDATE`, which is what makes retries safe.
- Generated content is cached and reused by topic. The cheapest model call is the one you do not make.
- Durable learner progress lives in Postgres and never depends on the disposable branch.
- Neon does not handle billing. Stripe does, and the boundary is deliberate.

## Prerequisites

- Familiarity with Next.js App Router and TypeScript
- Working knowledge of Postgres and connection strings
- Some exposure to Prisma helps but is not required

## Why Neon fit

The product needs three things from a database platform that a single managed Postgres instance does not give you.

**Cheap, fast, isolated databases on demand.** A lab is a database that lives for twenty minutes. Provisioning a fresh instance per learner is far too slow and far too expensive. Branching gives you a copy-on-write clone of a seeded parent in seconds.

**A place to run slow work that is not our web server.** AI generation takes tens of seconds. Neon Functions let that run next to the database without us operating a queue and a worker fleet.

**An AI endpoint that does not need another vendor relationship.** The AI Gateway is an OpenAI-compatible endpoint, so the model call is a base URL and a key rather than a new integration.

The honest version: we could have built all of this on plain Postgres plus a queue plus a container platform. It would have taken longer and we would be running more things.

## High-level architecture

```diagram
{
  "type": "flow",
  "title": "Request path and the services behind it",
  "nodes": [
    { "label": "Browser", "sub": "Next.js App Router", "tone": "slate" },
    { "label": "App server", "sub": "route handlers, session, entitlements", "tone": "blue" },
    { "label": "Neon Postgres", "sub": "durable state via Prisma", "tone": "green" },
    { "label": "Neon Branches", "sub": "one throwaway DB per lab", "tone": "violet" },
    { "label": "Neon Function", "sub": "prepworker, async generation", "tone": "amber" },
    { "label": "AI Gateway", "sub": "OpenAI-compatible model calls", "tone": "accent" }
  ]
}
```

Stripe sits alongside this rather than inside it. More on that later.

| Neon service | What it is responsible for |
| --- | --- |
| Postgres | All durable state: users, subscriptions, prep sets, questions, attempts, XP, certificates, lab session records |
| Auth | Identity, sign-in screens, sessions |
| Branches | One disposable database per hands-on lab and per SQL terminal session |
| Functions | `prepworker`, which generates practice sets outside the request cycle |
| AI Gateway | Model calls for generation and interview grading |
| Object storage | Optional avatar and media uploads over an S3-compatible API |

## Durable state, and what is allowed to be disposable

The single most useful rule in the codebase is this: **learner progress never lives in the thing we are about to delete.**

A lab branch holds an e-commerce-style schema the learner is querying. It does not hold the record that they completed lesson four. That record is a row in our main Postgres database, written through Prisma, and it survives the branch being destroyed thirty seconds later.

This sounds obvious written down. It is easy to get wrong, because the tempting shortcut when you already have a database in front of the learner is to record progress there.

Everything else is relational and lives in one place. Users mirrored from Auth, subscriptions, generated prep sets and their questions, quiz results, interview sessions and attempts, XP and achievements, certificates, lab session metadata, admin audit records. We deliberately did not spread this across specialised stores. Learner progress is full of joins (which questions has this user seen, which are due for review, which of their attempts belong to a session that belongs to a path), and those joins are the entire value. Postgres is good at joins.

## Authentication, behind an abstraction

Neon Auth is the identity source of truth. The Next.js app proxies auth calls through a catch-all route:

```typescript
// src/app/api/auth/[...path]/route.ts
import { auth } from "@/lib/auth/server";

// Proxies the client auth calls (sign-in, sign-up, session, sign-out,
// password reset) to the Neon Auth server.
export const { GET, POST } = auth.handler();
```

The application then mirrors each authenticated identity into its own `User` table. Every product relationship (attempts, XP, certificates, lab sessions) uses a normal foreign key to that row rather than a string from an external provider.

The tradeoff is real. You now have two representations of a user and a sync point where they can drift. What you get in exchange is that every product query is a plain join, foreign keys actually constrain, and swapping the auth provider does not mean rewriting every table that references a user.

The rest of the app never imports the auth SDK. It calls a session abstraction:

```typescript
const user = await getSessionUser();
if (!user?.id) {
  return NextResponse.json({ error: "Please log in." }, { status: 401 });
}
```

That one indirection is what keeps provider coupling to a single file.

## Cached AI content, or: the cheapest call is the one you skip

Generating a good practice set costs real money and takes real time. Generating the same set about Kubernetes networking for the four hundredth time costs four hundred times as much and is not four hundred times better.

So before generating anything, we look for something reusable:

```typescript
const reusable = await findReusablePrepSet(input);
if (reusable) {
  await Promise.all([
    recordPrepSetUse(user.id, reusable.id),
    logReusedGeneration({ userId: user.id, goal: input.goal, topic: topicSlug, ... }),
  ]);
  return NextResponse.json({ set: reusable, reused: true });
}
```

Topics are normalised to a slug before lookup, so "k8s networking", "Kubernetes networking" and "kubernetes  networking" land on the same cached set instead of generating three near-identical ones.

Two things worth being explicit about. First, `reused: true` goes back to the client, because the frontend should not pretend it did work it did not do. Second, this means **not every learner gets a unique set, by design**. Popular topics converge on a curated, high-quality set. That is a better outcome than a fresh mediocre generation each time, and it is much cheaper. If you want per-learner uniqueness, this architecture is the wrong one.

Reuse still costs a database read, so even the cache path is rate limited at 120 lookups an hour per user.

## Moving generation out of the request cycle

AI generation is too slow to sit inside an HTTP request. So it does not.

```diagram
{
  "type": "flow",
  "title": "Asynchronous practice-set generation",
  "nodes": [
    { "label": "POST /api/prep", "sub": "validate, check entitlement, check cache", "tone": "blue" },
    { "label": "GenerationRequest", "sub": "row written as PENDING", "tone": "green" },
    { "label": "Dispatch", "sub": "request id to prepworker, Bearer secret", "tone": "amber" },
    { "label": "Neon Function", "sub": "claims the row, calls the gateway", "tone": "violet" },
    { "label": "PrepSet + Questions", "sub": "written back to Postgres", "tone": "green" },
    { "label": "Client polls", "sub": "GET /api/prep/[id] until COMPLETED", "tone": "slate" }
  ]
}
```

The function is declared as configuration rather than deployed by hand:

```typescript
// neon.ts
export default defineConfig({
  preview: {
    functions: {
      prepworker: {
        name: "Prep generation worker",
        source: "./functions/prep-worker.ts",
        env: {
          WORKER_SECRET: process.env.NEON_FUNCTION_SECRET!,
          AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY!,
          AI_GATEWAY_BASE_URL: process.env.AI_GATEWAY_BASE_URL!,
          AI_MODEL: process.env.AI_MODEL ?? "gpt-5-nano",
        },
      },
    },
  },
});
```

The worker authenticates on a shared secret and returns immediately, before doing any work:

```typescript
export default {
  async fetch(request: Request) {
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
    if (request.headers.get("authorization") !== `Bearer ${process.env.WORKER_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }
    // ... kick off the work
    return Response.json({ accepted: true }, { status: 202 });
  },
};
```

### The line that makes retries safe

This is the most important statement in the whole worker:

```sql
UPDATE "GenerationRequest"
   SET status = 'PROCESSING', "startedAt" = now(), attempts = attempts + 1
 WHERE id = $1 AND status = 'PENDING'
```

The `AND status = 'PENDING'` is the entire concurrency design. If the dispatch is retried, if two invocations arrive, if a network blip causes a duplicate call, exactly one of them updates a row. The others match zero rows and stop. There is no lock to manage and no queue to deduplicate against, just a conditional write against a status column.

`attempts` increments on every claim, which gives you a natural place to give up. The request ends as `COMPLETED` with a `prepSetId`, or `FAILED` with a `rejectionReason` that is safe to show a human.

One detail worth calling out: the worker talks to Postgres with a plain `pg` Pool, not Prisma. It is a small piece of code doing a handful of statements, and the client is lighter without the ORM.

### Falling back when the function is not there

Local development and CI do not have a deployed function. Rather than making that an error, the app checks:

```typescript
export function prepWorkerConfigured(): boolean {
  return Boolean(process.env.NEON_PREP_FUNCTION_URL && process.env.NEON_FUNCTION_SECRET);
}
```

If it is not configured, generation runs synchronously in the request instead. Slower, and fine, because the alternative is a codebase you cannot run without production credentials.

:::tip
Every optional integration in this app follows the same shape: a `somethingConfigured()` predicate, and a degraded path behind it. Object storage does it too, so avatar uploads simply switch off when storage is absent rather than throwing at import time.
:::

## Disposable databases as the actual product

Here is the part that made Neon worth choosing.

```diagram
{
  "type": "flow",
  "title": "Lab provisioning and teardown",
  "nodes": [
    { "label": "Start lab", "sub": "entitlement + rate limit checked", "tone": "blue" },
    { "label": "Tear down existing", "sub": "one active lab per learner", "tone": "amber" },
    { "label": "Create branch", "sub": "clone of the seeded parent", "tone": "violet" },
    { "label": "Initialize schema", "sub": "lab setup SQL", "tone": "green" },
    { "label": "Learner runs SQL", "sub": "validated, size-checked", "tone": "accent" },
    { "label": "Branch deleted", "sub": "on end, or by the cleanup job", "tone": "red" }
  ]
}
```

Before a branch is created, the route enforces three things in order: the learner is signed in, they are entitled to a lab, and they have not started fifteen labs in the last hour.

Then it does something that matters more than it looks:

```typescript
// One active lab per user: tear down any existing branches first (bounds cost).
const active = await prisma.labSession.findMany({
  where: { userId: user.id, status: { in: ["PROVISIONING", "READY"] } },
});
for (const s of active) {
  if (s.neonBranchId) {
    try {
      await endLabBranch(s.neonBranchId);
    } catch {
      // best-effort teardown
    }
  }
}
```

One active lab per learner is a cost control disguised as a product rule. Without it, a learner who opens six tabs owns six live databases. With it, starting a new lab is also a cleanup event, which means the common path cleans up after itself and the scheduled job only handles the exceptions.

## The SQL terminal

The SQL terminal is the same mechanism pointed at a different experience: a seeded e-commerce schema, a lesson list, and a prompt. The learner writes real SQL, Postgres executes it, and they see what Postgres actually said, including the errors.

Lesson completion is tracked separately from the branch. Close the terminal, lose the database, keep the progress.

It is worth being precise about what is real here, because the platform also ships Linux, Docker, Git and Kubernetes terminals, and **those are simulators**. They replay scripted behaviour. The SQL terminal and the PostgreSQL labs are the ones backed by a real database on a real branch. Conflating the two in marketing copy would be a lie, and learners would discover it in about four minutes.

## Safety, isolation and cost control

Handing someone a live Postgres connection means thinking about what they can do with it.

**A statement timeout, which is the control doing most of the work.** Every lab connection is opened with one:

```typescript
const pool = new Pool({ connectionString: connString, statement_timeout: 5000 });
```

Five seconds per statement. That single setting handles the entire category of runaway queries: an accidental cartesian join, a deliberate `pg_sleep`, a `generate_series` with too many zeroes. Postgres cancels it and the learner gets an error instead of us getting a bill.

**A statement denylist, as a second layer.** Before anything reaches the database, a pattern check rejects statements in a few categories: server-side file access, privilege and role changes, cross-database links, and process control. The learner gets a plain message rather than a Postgres error.

Note what is deliberately *not* rejected: `DROP TABLE`, `DELETE` without a `WHERE`, anything else destructive within their own schema. That is their sandbox to ruin, and ruining it is educational.

:::warning
A pattern-based denylist is a mitigation, not a boundary. It is the weakest layer here and it is behind two stronger ones: the branch is disposable and isolated, and the statement timeout bounds anything that does get through. If you need a real boundary, use a restricted Postgres role and let the database enforce it. That is on our list.
:::

**Size limits.** After a learner's query, we measure the database:

```typescript
const sizeBytes = await getDatabaseSizeBytes(session.connString);
if (sizeBytes !== null && sizeBytes > maxBytes) {
  // close the session and free the branch
  return NextResponse.json(
    { error: "This lab exceeded its storage limit and was closed." },
    { status: 413 },
  );
}
```

`generate_series` is a one-line way to write a hundred million rows. Checking after execution rather than trying to predict cost before it is both simpler and more reliable.

**Connection strings are short-lived internal values.** They live on the session row while it is active and are nulled out the moment it ends.

**Rate limits everywhere.** Lab starts, terminal executions and even cache lookups are each capped per user per hour. Rejected generation attempts are logged with a hashed IP, so abuse patterns are visible without storing raw addresses.

## Cleanup is infrastructure, not housekeeping

If you take one thing from this article, take this: **on branch-based infrastructure, the cleanup job is a core component, not a chore.**

A branch nobody deleted is a branch you are paying for. Not a leaked temp file, an ongoing bill. Failure modes that would be harmless elsewhere become financial ones here: the process dies between creating a branch and saving its ID, the learner closes the tab, provisioning fails halfway.

So there is a scheduled endpoint that sweeps three distinct kinds of debris:

```typescript
const sessions = await prisma.labSession.findMany({
  where: {
    OR: [
      { status: "READY", expiresAt: { lte: now } },                                  // expired
      { status: "PROVISIONING", createdAt: { lte: staleProvisioning } },             // never finished
      { status: "FAILED", neonBranchId: { not: null }, createdAt: { lte: staleProvisioning } }, // failed holding a branch
    ],
  },
  orderBy: { createdAt: "asc" },
  take: 100,
});
```

Design notes that took a while to get right:

- **`take: 100`.** The job is bounded. A backlog drains over several runs rather than one run timing out and achieving nothing.
- **Per-session `try`/`catch`.** One branch that refuses to delete must not stop the other ninety-nine. Failures are counted and logged, not thrown.
- **Oldest first.** The longest-running waste goes first.
- **The status update is conditional**, the same trick as the worker, so a session already ended by the normal path is not clobbered.

Cleanup runs about every ten minutes. Daily review runs once a day. Both are plain authenticated endpoints behind a shared secret, called on a schedule by Coolify.

Being HTTP endpoints rather than in-process timers means they work identically whether the app runs as one instance or several, and you can trigger one by hand during an incident.

:::warning
Cleanup is not infallible and we do not pretend otherwise. If the Neon API is down when the job runs, those branches survive until the next pass. The job is designed to converge over repeated runs, not to guarantee a clean state after any single one.
:::

## Where Stripe stops and Neon starts

Stripe owns Checkout, recurring billing, the customer portal and webhooks. Neon owns none of it.

What crosses the boundary is subscription state, reflected into Postgres by the webhook handler. Every paid API then checks entitlement server-side against our own database:

```typescript
const allowed =
  input.kind === "QUIZ"
    ? await hasQuizAccess(user.id)     // free allowance
    : await hasActiveAccess(user.id);  // paid only
if (!allowed) {
  return NextResponse.json({ error: "This needs an active subscription." }, { status: 402 });
}
```

Two reasons for reflecting state rather than asking Stripe: an entitlement check on every request would put a third-party API in the hot path, and it lets the freemium split (quizzes free, interviews paid) be a database query.

Webhooks are treated as at-least-once, because they are.

## Failure modes and what we do about them

| Failure | Mitigation |
| --- | --- |
| Branch created, process dies before the ID is saved | Cleanup job sweeps `PROVISIONING` sessions older than ten minutes |
| Learner abandons a lab | `expiresAt` on the session; cleanup sweeps expired `READY` sessions |
| Learner opens many labs | One active lab per user, enforced by tearing down existing ones on start |
| Runaway `INSERT` fills the branch | Post-execution `pg_database_size` check, session closed with 413 |
| Runaway or long-running query | `statement_timeout` cancels it after five seconds |
| Dangerous SQL | Denylist before execution, with branch isolation and the timeout behind it |
| Duplicate generation dispatch | Conditional claim `WHERE status = 'PENDING'` |
| AI Gateway unavailable | Generation fails with a readable reason; grading falls back to local scoring |
| Neon Function not deployed | `prepWorkerConfigured()` is false, generation runs synchronously |
| Object storage absent | Uploads disabled, app boots normally |
| Stripe webhook delivered twice | Handler written to be idempotent against subscription state |
| Neon API down during cleanup | Job counts the failure and retries on the next run |

## What we deliberately did not put in Neon

- **Billing.** Stripe. Reflecting subscription state into Postgres is not the same as owning it.
- **Learner progress inside lab branches.** Progress belongs in durable Postgres. The branch is scratch space.
- **Static content.** Simulated terminals, lesson definitions and question banks are TypeScript files in the repo, versioned with the code, no database round-trip.
- **Secrets.** Environment configuration, not rows.
- **The simulated terminals.** No infrastructure at all, and no reason for any.

## Lessons from building on disposable infrastructure

**Deletion is a feature with a budget.** On traditional infrastructure, forgetting to clean up wastes disk. Here it spends money continuously. That changes cleanup from hygiene into a component with its own failure handling, its own bounds and its own logging.

**Make the happy path clean up too.** The most reliable cleanup is the one on the path everyone takes. Starting a lab tears down the previous one, so the scheduled job handles exceptions rather than the bulk of the work.

**Conditional writes beat coordination.** `WHERE status = 'PENDING'` replaced everything we might have built with locks or a queue. On a system that already has transactions, use them.

**Optional integrations need a predicate, not a try/catch.** `prepWorkerConfigured()` and `isStorageConfigured()` are what let the app run in CI with neither. Discovering a missing integration through an exception at request time is worse in every way.

**Waiting is part of the product.** When generation takes thirty seconds, the polling UI is not a detail, it is the experience. A status row with `PENDING`, `PROCESSING`, `COMPLETED` and `FAILED` plus a human-readable `rejectionReason` gives the frontend something honest to show.

**Results must be revisitable.** Interview results and quiz outcomes are persisted rows with their own pages, not client state. People close tabs, and a result that only existed in React state is a result you destroyed.

## What we would improve next

- Cleanup currently sweeps on a fixed interval. Reacting to branch-level signals would close the window further.
- The SQL denylist should become a restricted Postgres role, so the database enforces the boundary rather than a regex in front of it.
- Generation cost is estimated per request but not yet aggregated into a spend view worth putting in front of an admin.
- The `User` mirror has no reconciliation job. Drift between Auth and our table is currently theoretical rather than monitored.

## What transfers to other products

Very little of this is specific to teaching DevOps. The reusable shape is:

**A durable core plus disposable compute.** Any product that hands users a real environment (coding sandboxes, technical assessments, interactive docs, preview environments per pull request) wants durable state in one place and throwaway infrastructure somewhere else, with a hard rule that nothing important lives in the disposable half.

**A status row as the coordination primitive.** Long-running work, a conditional claim, a polling client. No queue required until you actually need one.

**Cache by normalised intent.** If generation is expensive and inputs cluster, normalise the input to a key and reuse aggressively. Uniqueness is usually worth less than quality plus cost control.

**Predicates for every optional service.** It is what makes a system with six integrations still runnable on a laptop with none of them.

The branch-per-user pattern in particular is worth stealing. Any time you would otherwise write "we can't let users run that against our database", a disposable branch turns the answer into "sure, here's one of your own".
