---
title: 'Firebase Alternatives in 2026: Choose by Why You Are Leaving, Not by a Ranking'
excerpt: 'Most "Firebase alternatives" lists rank tools you cannot compare, because Firebase is five products in a trench coat. The useful question is which part you are replacing and why you are leaving: the Firestore bill that scales with reads, or the data model you cannot port. Here is an honest map of Supabase, Appwrite, Convex, PocketBase, Nhost, Amplify and the rest, grouped by the reason you are actually switching.'
category:
  name: 'Cloud'
  slug: 'cloud'
date: '2026-07-02'
publishedAt: '2026-07-02T15:00:00Z'
updatedAt: '2026-07-02T15:00:00Z'
readingTime: '11 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - cloud
  - firebase
  - supabase
  - baas
  - postgres
  - serverless
---

"What is a good Firebase alternative?" is a harder question than it looks, because Firebase is not one product. It is authentication, a realtime document database (Firestore), serverless functions, hosting, file storage, push messaging, and analytics, all behind one SDK. When someone asks for an alternative, they almost never want to replace all of that. They want to replace the one piece that is hurting, usually because of a bill or a wall they hit.

So a ranked list of "the 10 best Firebase alternatives" is close to useless: it compares tools that do not do the same job. This post organizes the decision the way it actually happens. First, the two reasons people genuinely leave Firebase, because those reasons determine what "alternative" even means. Then the real options, grouped by the reason you are switching, with the tradeoffs stated honestly rather than sold.

## TL;DR

- Firebase is five services in one SDK. Pick your alternative by which service is hurting, not by a leaderboard.
- People leave for two reasons: the **Firestore bill scales with reads and writes, not users**, so cost tracks your query patterns and surprises you at 6 to 12 months; and the **document data model does not port**, so the longer you stay the more expensive leaving gets.
- The most direct swap is **Supabase** (Postgres, auth, realtime, storage, functions behind a Firebase-like SDK). If you want to own the whole thing, **Appwrite** or **PocketBase**. If realtime reactivity is the point, **Convex**. GraphQL-first, **Nhost**. All-in on a hyperscaler, **AWS Amplify** or the **Cloudflare** stack.
- The real cost of leaving is re-modeling your data from documents to relations. Decide NoSQL-shaped or SQL-shaped first; everything else follows.

## Prerequisites

- Knowing which Firebase products you actually use (auth? Firestore? functions? hosting?)
- A rough sense of your read/write pattern, because that is what Firestore bills
- Willingness to trade some managed convenience for less lock-in, or not

## Why people actually leave Firebase

Two forces do almost all the pushing.

**The bill scales with reads, not users.** Firestore's Blaze plan charges per document read, write, and delete. That sounds fine until you notice that cost is now a property of your *query patterns*, not your user count. A list screen that re-reads a collection on every render, a missing composite index, a fan-out write that touches fifty documents, any of these can turn one user action into thousands of billed operations. The generous free (Spark) tier hides this for the first few months, then real traffic arrives and the bill steps off a cliff somewhere around the 6-to-12-month mark. The uncomfortable part is that you cannot easily model it in advance, because it depends on architecture you have not written yet.

**The data model does not port.** Firestore is a NoSQL document store. Your data ends up shaped around Firestore's access patterns: denormalized, duplicated across documents, structured to minimize reads rather than to reflect relationships. That shape is the lock-in. It does not map cleanly onto a relational database or onto another document store, so migrating is not an export and import; it is a re-architecture of how your data is modeled, plus a rewrite of every query and your auth rules. This is why leaving Firebase gets more expensive the longer you wait, and why the decision is worth making deliberately rather than under a bill emergency.

Everything else (Google/GCP coupling, NoSQL-only, the closed source) matters, but these two are what actually move teams.

## The real decision: documents or relations

Before you look at a single alternative, answer one question: are you staying document-shaped or moving to relational?

Firestore taught your app to think in documents. Two migration paths follow from that:

- **Stay document-shaped.** Move to another document/BaaS model (Appwrite, PocketBase, or Firebase-like layers) and the mental shift is small, but you keep the class of problems that came with documents: manual denormalization, no joins, consistency you enforce in application code.
- **Go relational.** Move to Postgres-backed platforms (Supabase, Nhost, Neon) and you get joins, transactions, constraints, and SQL, but you pay a one-time re-modeling cost to turn your denormalized documents back into normalized tables.

Neither is wrong. But this choice, not the brand, is what determines how painful the move is and what your life looks like afterward. The same "get a user's recent orders" is a different shape in each world:

```tabs
{
  "title": "the same read, two data models",
  "tabs": [
    { "label": "Firestore (document)", "lang": "javascript", "code": "// orders are often duplicated onto the user doc or\n// fetched from a subcollection, denormalized to avoid joins\nconst snap = await getDocs(\n  query(collection(db, `users/${uid}/orders`),\n        orderBy('createdAt', 'desc'),\n        limit(10))\n);\nconst orders = snap.docs.map(d => d.data());\n// each doc read is billed; joins to product data mean more reads" },
    { "label": "Postgres (relational)", "lang": "sql", "code": "-- one query, a real join, billed as compute + not per-row-read\nselect o.id, o.created_at, p.name, p.price\nfrom orders o\njoin products p on p.id = o.product_id\nwhere o.user_id = $1\norder by o.created_at desc\nlimit 10;" }
  ]
}
```

The Firestore version avoids the join because joins are expensive in reads; the Postgres version does the join because that is what relational databases are for. Migrating means rewriting the left column into the right, which is the actual work behind the word "migration."

## The alternatives, grouped by why you are leaving

### You want the closest possible swap: Supabase

[Supabase](https://supabase.com) is the most direct Firebase alternative, and honestly the default recommendation for most teams. It bundles Postgres, authentication, realtime subscriptions, file storage, and edge functions behind a client SDK that feels familiar if you came from Firebase. The difference that matters is underneath: your data lives in real Postgres, so you get joins, transactions, SQL, Row Level Security for multi-tenant apps, and `pgvector` when you need embeddings for AI features.

The tradeoffs to go in with eyes open: you are adopting Postgres, which means learning RLS policies (powerful, but a real learning curve) and thinking relationally instead of in documents. It is open source and self-hostable, so you are not locked to the hosted product the way you were with Firestore.

### You want a database-first platform with a killer dev workflow: Neon

[Neon](https://neon.com) comes at this from the opposite direction to a bundled BaaS. Its core is serverless Postgres with one standout feature Firebase never had: **branching**. You can fork the entire database, schema and data, in seconds, so every pull request or preview environment gets its own isolated copy to run migrations against and throw away. For teams whose pain with Firebase was as much about testing and environments as about the bill, that workflow is the reason to look.

Be honest about what it is today, though. Neon started as the database layer, not a full Firebase replacement, so on its own it does not give you auth, functions, or storage the way Supabase does. What is changing is that Neon's [platform preview](https://devops-daily.com/posts/neon-backend-platform-not-just-postgres) is adding exactly those pieces, functions that run on a database branch, S3-compatible object storage that branches with your data, and Neon Auth, which moves it from "just Postgres" toward a fuller backend. So the honest positioning in 2026: reach for Neon when the database and the branching workflow are what you care about most, and treat the surrounding platform as promising and worth watching, with the preview caveats that implies, rather than a like-for-like swap for all of Firebase yet.

### You want to own the whole thing: Appwrite or PocketBase

If the lesson you took from Firebase is "never again build on something I cannot run myself," two options stand out.

[**Appwrite**](https://appwrite.io) is the batteries-included, self-hostable BaaS. It ships auth, databases, storage, functions (with many language runtimes), realtime, a messaging service for email/SMS/push, and integrated hosting, and you can run the whole stack on a small VPS or a Kubernetes cluster. It is the closest thing to "Firebase's feature surface, but on infrastructure you own." The cost is the DevOps: you are now responsible for running, scaling, and backing up that stack.

[**PocketBase**](https://pocketbase.io) is the opposite end of the spectrum: a single Go binary with an embedded SQLite database, auth, file storage, and a realtime API, no Docker and no dependencies. You download it, run it, and you have a backend. It is a genuinely great fit for solo developers, prototypes, and apps that comfortably fit on one server, and a poor fit for anything that needs to scale horizontally across many nodes. Its simplicity is the whole point and also its ceiling.

### You want to keep the realtime magic: Convex

If the thing you loved about Firebase was that data changes just appeared in your UI, [**Convex**](https://convex.dev) leans harder into that than anything else. It is a reactive backend where your queries are TypeScript functions and the client re-runs them automatically when the underlying data changes. You trade SQL and database control for a simpler, end-to-end reactive model. Convex went open source in 2024 and added self-hosting in early 2025 (it stores data in SQLite or Postgres and deploys via Docker), so the old "great DX but proprietary" objection is weaker than it used to be. Pick it when realtime reactivity is the center of your app and you are willing to adopt its paradigm rather than bring your own database.

### You want GraphQL: Nhost

[**Nhost**](https://nhost.io) is Postgres plus Hasura, which gives you an instant GraphQL API over your schema, alongside auth, storage, functions, and realtime subscriptions. If you liked Supabase's Postgres foundation but your team is GraphQL-first, this is the shape you want. The tradeoff is that you are now committed to the Hasura/GraphQL way of doing things, which is a strong opinion to adopt.

### You are all-in on a hyperscaler: Amplify or Cloudflare

If your constraint is "it has to be on the cloud we already use," two very different answers:

- [**AWS Amplify**](https://aws.amazon.com/amplify/) (Gen 2) is a TypeScript-first way to stand up auth, APIs, storage, and hosting that is really an on-ramp to the wider AWS catalog. It fits AWS shops that cannot pull in outside services, at the price of AWS's complexity leaking into what should be a simple backend.
- The **Cloudflare** stack (Workers, D1, R2, KV, Durable Objects) is the "assemble your own BaaS at the edge" option. It is not a single integrated product like Firebase; it is a set of primitives you compose. Great for edge-first, latency-sensitive apps if you are comfortable wiring the pieces together yourself.

### You only need one slice

Often "replace Firebase" really means "replace one Firebase feature," and the best tool is a focused one, not another all-in-one:

- **Auth only:** Clerk, WorkOS, or Supabase Auth (usable standalone).
- **Realtime only:** Ably, Pusher, or Liveblocks bolted onto whatever database you already run.
- **Database only:** a managed Postgres like Neon or Supabase, wired to whatever auth and realtime you pick separately (see the Neon note above if branch-per-environment is the workflow you want).

Composing focused tools is more wiring than adopting one BaaS, but it avoids trading one lock-in for another and lets each piece be best-in-class.

## A rough decision table

| If your top priority is... | Start with | Why |
| --- | --- | --- |
| Closest Firebase-like DX, but relational | Supabase | Postgres + familiar SDK, RLS, realtime |
| Database + a branch-per-PR workflow | Neon | Serverless Postgres with branching; platform preview adding functions/storage/auth |
| Owning and self-hosting everything | Appwrite | Full BaaS surface on your own infra |
| Dead-simple, single-server, cheap | PocketBase | One Go binary, SQLite, zero ops |
| Realtime reactivity as the core | Convex | Reactive TS queries, now self-hostable |
| GraphQL-first team | Nhost | Postgres + Hasura GraphQL |
| Committed to AWS | Amplify Gen 2 | TS-first on-ramp to AWS services |
| Edge-first, compose-your-own | Cloudflare | Workers + D1 + R2 + Durable Objects |
| Just one missing piece | Clerk / WorkOS / Ably | Best-in-class single slice |

:::warning
Treat any migration estimate that ignores the data model as fiction. Moving the *code* off Firebase's SDK is the easy week. Re-modeling denormalized documents into whatever your target expects, rewriting every query, and porting your security rules is the real project. Scope that first, and it will tell you whether a document-shaped target (less re-modeling) or a relational one (more up front, better afterward) is right for you.
:::

## How to actually choose

Three questions, in order, get most teams to an answer:

1. **Which Firebase pieces am I really replacing?** If it is just auth or just the database, stop looking at all-in-one BaaS platforms and pick a focused tool.
2. **Documents or relations?** This decides your migration cost and your day-to-day afterward more than any feature checklist. Most teams leaving Firestore for cost or query-flexibility reasons are really deciding to go relational.
3. **Managed or self-hosted?** Be honest about whether you want to own uptime and backups. Appwrite and PocketBase give you control and hand you the pager; Supabase, Convex, and the hyperscalers keep more of that off your plate.

## Wrapping up

Firebase gets replaced one service at a time, for one of two reasons: a Firestore bill that grows with your queries instead of your users, or a data model that gets more expensive to leave the longer you stay. Once you name which of those is pushing you and which piece you are actually replacing, the field narrows fast. Supabase is the safe default for a relational, Firebase-shaped swap; Appwrite and PocketBase if you want to own the stack; Convex if reactivity is the whole point; focused tools if you only need one slice. The winning move is not picking the top of a list, it is being honest about why you are leaving and letting that choose for you.
