---
title: 'How we built a DevOps interview-prep platform on Neon'
excerpt: 'A build-log of a real learning product on Neon: Postgres and branching for a disposable database per lab, Neon Auth, the AI Gateway for mock interviews, and object storage, with the tradeoffs we hit along the way.'
category:
  name: 'Cloud'
  slug: 'cloud'
date: '2026-07-10'
publishedAt: '2026-07-10T09:00:00Z'
updatedAt: '2026-07-10T09:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Neon
  - Postgres
  - Cloud
  - Architecture
  - AI
  - DevOps
---

We built a DevOps interview-prep product: AI mock interviews, quizzes graded on the spot, and hands-on labs where every learner gets a real Postgres to run commands against. The interesting part is not the product, it is the backend. Instead of stitching together a managed database, a separate auth vendor, an object store, a pile of AI provider SDKs, and some scheme for handing each learner their own database, we put almost all of it on one platform: Neon.

This is the build-log. What each Neon service does in the app, the code that wires it, the numbers that made a service worth it, and the sharp edges we hit so you can skip them.

## TL;DR

- **Postgres** is the backbone, through Prisma and the serverless driver.
- **Branching** gives every lab session its own disposable database in seconds, copy-on-write, then throws it away.
- **Neon Auth** replaced a self-hosted auth stack, email and password, no separate vendor.
- **The AI Gateway** runs the mock interviews and the skill assessment through one credential, and lets us dial cost per interview by swapping the model name.
- **Object storage** holds avatars and generated certificates, S3-compatible, no bucket-per-environment busywork.
- The app itself is a plain Next.js server on our own host. You adopt the data services without adopting a new compute model.

## Prerequisites

- Comfort with Postgres and a Node or Next.js backend.
- A Neon account. Branching, Auth, the AI Gateway, and object storage are on the newer platform, currently `us-east-2`.
- Familiarity with the AWS S3 SDK helps for the storage section.

## The shape of it

```diagram
{
  "type": "infra",
  "title": "One platform behind the whole product",
  "flow": [
    { "label": "Learner", "sub": "browser", "icon": "net", "tone": "slate" },
    { "label": "Next.js app", "sub": "self-hosted", "icon": "gear", "tone": "slate" }
  ],
  "groups": [
    {
      "label": "Neon",
      "sub": "one account, one bill",
      "icon": "database",
      "tone": "green",
      "nodes": [
        { "label": "Postgres", "sub": "app data (Prisma)", "icon": "database", "tone": "violet" },
        { "label": "Branching", "sub": "a DB per lab", "icon": "branch", "tone": "green" },
        { "label": "Neon Auth", "sub": "email + password", "icon": "gear", "tone": "amber" },
        { "label": "AI Gateway", "sub": "mock interviews", "icon": "net", "tone": "green" },
        { "label": "Object storage", "sub": "avatars, certs", "icon": "box", "tone": "blue" }
      ]
    }
  ]
}
```

The app is an ordinary server. Everything stateful lives in Neon. That is the whole point: five concerns that usually mean five vendors collapse into one platform and, for the AI part, one credential.

## Postgres, the boring backbone

Nothing exotic here, and that is a feature. All the product data (users, progress, quiz attempts, spaced-repetition state, certificates) is Postgres, accessed through Prisma with the Neon serverless adapter so it works cleanly from a serverless-friendly runtime.

The reason to start here is that everything else in this post branches, forks, or attaches to this database. When your primary store is the same platform as your auth, your files, and your AI config, "give me an isolated copy of the whole thing" becomes one command instead of a project.

## A real database for every lab, via branching

The labs are the feature that would normally be a nightmare. We promise learners a real `psql` session on a real Postgres, seeded with a sample schema, where they can break things and get a clean one back on the next try. The naive version of that is "run a Postgres container per user," which means provisioning time, storage per user, and cleanup you will get wrong.

Branching turns it into a copy-on-write fork. Each lab session creates a branch from a seeded parent, hands the learner its connection string, and drops the branch when they are done. The branch starts as a reference to the parent and only stores what the learner changes, so a hundred concurrent labs are not a hundred full copies.

```text
parent branch (seeded sample schema, read-only to learners)
        │  create branch  (copy-on-write, seconds)
        ▼
lab-session-abc123  ──►  learner gets its own connection string
        │  learner runs DROP TABLE, INSERT, whatever
        │  main is untouched; other learners are untouched
        ▼
   session ends  ──►  delete branch, storage goes with it
```

The comparison that made the decision for us was not raw speed, it was what you have to build and pay for to give each learner isolation.

```chart
{
  "type": "bar",
  "title": "What it takes to give every learner an isolated database",
  "unit": "",
  "caption": "Illustrative. Container-per-user assumes you build provisioning, seeding, and teardown yourself and pay for a full copy per active user. Branching is copy-on-write and scales to zero.",
  "rows": [
    { "label": "Provisioning code to maintain", "value": 3, "series": "Container per user" },
    { "label": "Provisioning code to maintain", "value": 1, "series": "Neon branch" },
    { "label": "Storage per idle user", "value": 3, "series": "Container per user" },
    { "label": "Storage per idle user", "value": 0, "series": "Neon branch" },
    { "label": "Time to a ready DB (relative)", "value": 3, "series": "Container per user" },
    { "label": "Time to a ready DB (relative)", "value": 1, "series": "Neon branch" }
  ],
  "series": [
    { "name": "Container per user", "color": "#64748b" },
    { "name": "Neon branch", "color": "#10b981" }
  ]
}
```

The chart is deliberately relative, not a benchmark. The honest point is the shape: branching removes the provisioning code, removes the idle storage, and removes the teardown bugs, because deleting the branch deletes every byte it held.

## Auth without a separate vendor

The app started on a self-hosted email-and-password stack. It worked, but it meant we owned password hashing, reset flows, and session security, all the parts of auth that are boring until they are a breach.

Neon Auth is Better Auth running against the same Postgres, so we moved to it. Email and password only, no external identity vendor to configure. The migration was small because the whole app reads the current user through one seam. Every page and API route calls the same helper, so swapping the provider meant rewriting that file, not every caller.

```typescript
// The one seam the rest of the app uses. Swapping auth providers changed
// this file, not the hundred places that call it.
export async function getSessionUser(): Promise<SessionUser | null> {
  const { data: session } = await auth.getSession();
  const u = session?.user;
  if (!u?.id) return null;

  // Mirror the identity into our own users table (id = the auth user id) so
  // every existing foreign key (progress, certs, XP, referrals) keeps working.
  const existing = await prisma.user.findUnique({ where: { id: u.id } });
  if (existing) return existing;
  return prisma.user.create({ data: { id: u.id, email: u.email, name: u.name } });
}
```

The mirror pattern is worth calling out. Auth owns identity, but we still keep a `users` row of our own, keyed to the auth user id, so all the relationships we already had do not need to move. On first sign-in we create that row and fire the welcome email and referral credit from there.

:::note
Neon Auth's SDK wanted a newer Next.js than we were on, which forced a framework bump. Budget for that: read the peer requirements before you start the swap, not after.
:::

## One credential for the mock interviews

The mock interviews and the skill assessment are the AI features. A model reads an open-ended answer, scores the reasoning, and adapts. We did not want to hold accounts with three AI providers and juggle three SDKs, so this goes through the Neon AI Gateway: one OpenAI-compatible endpoint, one credential, and the model is a string you pass.

```typescript
// Same call for every model. Switching providers is a one-word change.
const res = await fetch(`${GATEWAY_BASE_URL}/chat/completions`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${GATEWAY_TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "claude-haiku-4-5", // or gpt-5-nano, gemini-2-5-flash, ...
    messages,
  }),
});
```

That one-word change has a real cost dimension. Grading a mock interview is a handful of model calls, and the per-call price swings a lot across models. Being able to route cheap-by-default and reserve the pricier models for where they earn it is the whole reason the gateway pattern is worth it.

```chart
{
  "type": "bar",
  "title": "Estimated model cost per mock interview",
  "unit": "$",
  "caption": "Estimate: ~5k input + ~2k output tokens to grade one interview (roughly six open answers). Prices are Neon's listed per-token rates as of July 2026. Your token count will vary with prompt and answer length.",
  "rows": [
    { "label": "gpt-5-nano", "value": 0.0011, "series": "nano" },
    { "label": "gemini-2-5-flash", "value": 0.0065, "series": "gemini" },
    { "label": "claude-haiku-4-5", "value": 0.015, "series": "haiku" }
  ],
  "series": [
    { "name": "nano", "color": "#10b981" },
    { "name": "gemini", "color": "#38bdf8" },
    { "name": "haiku", "color": "#f59e0b" }
  ]
}
```

A cent or so per interview at the low end, more when we want a sharper grader. The point is that this is a routing decision in a config value, not a rewrite.

### Then we stopped calling it for the catalog at all

The gateway is great for per-user, on-demand work. It is the wrong tool for filling a catalog of standard content that every user sees. Early on, seeding the question bank generated everything through the gateway, which meant seeding cost money, was non-deterministic, and could not run in CI without a key.

So we pre-baked the whole catalog: curated quizzes and interviews for every module topic live in the codebase, and seeding just loads them. On-demand generation still exists for anything off the beaten path, and those results are cached, but the common case now costs nothing.

```chart
{
  "type": "bar",
  "title": "AI gateway calls to seed the standard catalog",
  "unit": "",
  "caption": "The curated catalog (58 topics, quizzes and interviews) is now committed to the repo and loaded directly. On-demand generation for long-tail topics still uses the gateway and caches the result.",
  "rows": [
    { "label": "Before (generate on seed)", "value": 116, "series": "calls" },
    { "label": "After (pre-baked)", "value": 0, "series": "calls" }
  ],
  "series": [
    { "name": "calls", "color": "#f59e0b" }
  ]
}
```

Use the AI gateway for what only a model can do per user. Do not use it as a content pipeline for things that never change.

## Object storage for avatars and certificates

Profiles have avatars and the product issues shareable certificates, so we needed somewhere to put files. Neon's object storage is S3-compatible, which means the standard AWS SDK works. Because the app is self-hosted rather than running inside a Neon Function, we provisioned a bucket and a scoped credential over the API and passed the values in as environment variables.

There is one gotcha that will cost you an afternoon if you miss it. The SDK expects a real AWS region, but the value the platform hands you is a host, which the SDK rejects. Pin the region yourself, set the endpoint explicitly, and use path-style addressing.

```typescript
import { S3Client } from "@aws-sdk/client-s3";

// The three settings that make an S3-compatible endpoint behave:
// a pinned region, an explicit endpoint, and path-style URLs.
const s3 = new S3Client({
  region: "us-east-2",
  endpoint: process.env.STORAGE_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY as string,
  },
});
```

Uploads go through a small server route that validates the file and stores it under an `avatars/` prefix, and reads go through a media route that only serves that prefix, so a private object like a certificate can never be fetched through the public path. With the credential wired, a full round-trip worked first try:

```terminal
{
  "title": "storage round-trip",
  "prompt": "$",
  "steps": [
    { "comment": "put, get, delete against the bucket with the SDK config above" },
    { "cmd": "node scripts/storage-healthcheck.mjs", "output": "PUT   avatars/_healthcheck.txt  ok\nGET   avatars/_healthcheck.txt  read back: ok 1783693977944\nDELETE avatars/_healthcheck.txt  ok" }
  ]
}
```

## What we would tell you before you build this

- **The platform services are `us-east-2`, new-projects-only right now.** If your existing project is elsewhere, you are making a new one to use branching-with-storage, Auth, and the gateway together.
- **The storage endpoint is per-branch.** The S3 endpoint contains the branch id, so if you fork the project the branch gets its own bucket view. Convenient for preview environments, but pin the endpoint per environment.
- **Keep an auth seam.** The reason our provider swap was a morning and not a week is that nothing called the auth library directly. One `getSessionUser()` helper, and every page went through it.
- **Pre-bake anything that is not per-user.** The AI gateway is for on-demand, per-learner work. Standard content belongs in your repo, generated once and reviewed.
- **You do not have to move your compute.** We kept a normal Next.js server. Branching, Auth, the gateway, and storage are data-plane services you attach to, not a runtime you have to migrate onto.

## Wrap-up

The pitch for putting all of this on one platform is not "fewer logos." It is that the hard, isolation-shaped problems get easy. A real database per learner is a branch. An isolated preview of the whole app, data and files included, is a branch. Auth and AI stop being integrations you own and become services you call. We still write ordinary application code; the platform absorbs the parts that used to be their own projects.

If you are building something that needs a database per user, or per tenant, or per preview, that is the capability to reach for first. The rest of the platform is what makes it worth staying.
