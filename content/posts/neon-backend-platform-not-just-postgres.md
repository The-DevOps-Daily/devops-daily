---
title: 'Neon Is Becoming a Backend Platform, Not Just Postgres'
excerpt: 'In June 2026 Neon added serverless functions, S3-compatible object storage, and an AI gateway to its database. The interesting part is not any one feature, it is the through-line: everything branches with your data. Here is what shipped, what it competes with, and where the seams still show.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-06-26'
publishedAt: '2026-06-26T09:00:00Z'
updatedAt: '2026-06-26T09:00:00Z'
readingTime: '9 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - neon
  - postgres
  - serverless
  - platform-engineering
  - architecture
---

For most of its life, Neon had a one-sentence pitch: serverless Postgres that branches like Git. You got a database that scaled to zero, forked in milliseconds, and charged you for what you used. Everything else (your compute, your file storage, your AI calls, your auth) you wired up somewhere else and pointed at the connection string.

In June 2026 that sentence got longer. Neon shipped a private preview that adds three new surfaces around the database: serverless **Functions**, S3-compatible **Storage**, and an **AI Gateway** for model calls. A fourth, **Neon Auth**, shows up in the templates. None of these is novel on its own. Functions look like Lambda, storage looks like S3, an AI gateway looks like a dozen other AI gateways. The reason it is worth a closer look is the through-line connecting them, and that through-line is the same primitive Neon already built its name on: branching.

This is an analysis of what actually shipped, what it replaces, and where it is still clearly a preview. I created a new project and deployed against it while writing this, so the specifics below are from the real thing, not the marketing page.

## What shipped

Four pieces, all in private preview, all in AWS `us-east-2`, all for new projects only.

**Neon Functions** are Node.js compute deployed onto a database branch. You declare them in a `neon.ts` config file, write a standard Fetch-API handler (Hono is the recommended framework), and run `neonctl deploy`. Each branch gets its own function URL, the `DATABASE_URL` is injected automatically, and the function runs in the same region as the branch, so there is no cross-region hop to the database. They support streaming and long-lived connections (WebSockets, server-sent events), which is the deliberate split from request-scoped serverless: these are not for background jobs, they are for request/response and real-time work.

**Neon Storage** is S3-compatible object storage. Your existing AWS SDK, boto3, or `aws` CLI talk to it unchanged. The twist is that storage is scoped to a branch, so when you fork a database branch, its files fork with it.

**Neon AI Gateway** is a single credential that fronts models from Anthropic, OpenAI, Google, and a few open-source providers. The OpenAI and Anthropic SDKs work without code changes; you point them at a per-branch gateway endpoint. The published catalog lists around 25 models, priced per million tokens at what look like each provider's own list rates (Claude Haiku 4.5 at $1/$5 in/out, GPT-5 Nano at $0.05/$0.40, Gemini 2.5 Flash at $0.30/$2.50).

**Neon Auth** rounds it out with authentication that does not require standing up a separate identity service, used in the realtime-chat template alongside Next.js.

## The through-line is branching

Take those four features and the obvious read is "Neon is cloning Supabase," or "Neon is becoming Vercel with a database." Both are partly true and both miss the point. The organizing idea is that every one of these surfaces inherits database branching.

A Neon branch already gave you an isolated copy of your data in milliseconds, with copy-on-write so it was cheap. Now that same branch gives you:

- an isolated **function** at its own URL, running your latest code against that branch's data,
- an isolated **storage** namespace, so files written in a preview branch never touch production objects,
- an isolated **AI Gateway** endpoint, so model usage on a feature branch is its own thing.

That is the part you cannot easily assemble from separate vendors. You can stitch Lambda, S3, an AI gateway, and an auth provider together yourself, plenty of teams have. What you cannot easily do is make all of them fork in lockstep when you open a pull request, and then throw the whole set away when the branch merges. The preview environment stops being "a copy of the database plus a pile of shared, mutable infrastructure" and becomes a genuinely isolated copy of the backend.

If you have ever had a preview deployment write a test file into the production S3 bucket, or seen a staging job run up a bill against the same AI key as prod, you already understand why branch-scoped everything is the actual feature here.

## What it replaces, and the tax it removes

The clearest way to see the value is to count the moving parts in a typical "branchable AI app" today versus on this platform. Standing up one environment the assemble-it-yourself way usually means a database, a compute host, an object store, a few model-provider keys, and an auth service, each with its own account, credential, and region to keep in sync.

```chart
{
  "type": "bar",
  "title": "Distinct services and credentials to wire up per environment",
  "caption": "Illustrative count for a branchable AI app, not a benchmark.",
  "rows": [
    { "label": "Assemble it yourself", "value": 7 },
    { "label": "Neon platform", "value": 1 }
  ]
}
```

That count is illustrative, not measured: your stack may have more or fewer pieces. But the direction is the real claim. Every separate service is another credential to rotate, another thing to provision per preview environment, and another place for prod and staging to accidentally share state. Collapsing that to one account with auto-injected, per-branch credentials is less a feature than the removal of a tax you have been quietly paying.

There is a second, quieter tax it removes: distance. Because functions run in the same region as the branch, the function-to-database round trip is local. A lot of "serverless Postgres is slow" folklore is really "my Lambda in one region is talking to my database in another, over a connection it has to re-establish on every cold start." Co-locating the compute with the branch sidesteps that specific problem.

## Where the seams still show

This is a private preview, and it reads like one. Worth being clear-eyed about the limits before you plan anything around it.

:::warning
**One region, new projects only.** Everything is in AWS `us-east-2` and only works on projects created after the preview opened. Your existing Neon databases will not grow these features in place, which matters if you were hoping to bolt functions onto a production project.
:::

- **Functions are not a job runner.** They are explicitly request/response and real-time, not background jobs. Queued, retryable, cancellable work still belongs to something like QStash or Inngest. That is an honest scoping decision, but it means "move my whole backend here" is not yet on the table.
- **Fixed function sizing.** Memory is fixed (2048 MiB at preview), so this is not a knob-for-everything compute platform yet.
- **Billing is half-documented.** The per-model token prices are public and look like pass-through, but Neon has not publicly spelled out whether there is a markup or preview credits on the AI Gateway. For a side project that is noise; for a budget forecast it is a question to ask before you commit.
- **Lock-in is the real trade.** The whole pitch is integration: one config file, one credential, everything branching together. That convenience is also coupling. An S3-compatible API and standard SDKs keep the exit ramps wider than a fully proprietary stack would, but a `neon.ts` that declares your functions, buckets, and gateway is, by design, Neon-shaped.

## Who should actually care

If you run a large, already-wired backend with mature infrastructure-as-code, none of this is urgent. You have solved preview environments, even if the solution is a pile of Terraform and a shared staging bucket.

The teams this is aimed at are the ones for whom that pile is the problem. Specifically:

- **Anyone building agents.** An agent wants a database to remember things, compute that can stream tokens without a timeout, storage for what it generates, and model access. Getting all four from one CLI, branchable together, is a genuinely shorter path than assembling them. It is not a coincidence that the flagship templates are agents and MCP servers.
- **Teams that live in preview environments.** If every pull request should get a real, isolated backend and yours currently get a database copy plus shared everything-else, branch-scoped functions and storage close that gap.
- **Small teams shipping AI features.** The combination of "Postgres you already use" and "model calls without managing three provider accounts" removes a couple of the most annoying setup steps.

The honest framing is that Neon is making a bet: that the database, not the compute platform, is the right center of gravity for a backend, because the database is where your state and your branching already live. Vercel is making the opposite bet from the compute side, and Supabase has been making a similar bundled-backend bet for years. Whether "everything branches with your data" is a durable advantage or a feature others copy, the next year will tell.

For now, the thing to internalize is that "Neon" no longer means "a Postgres host." It means a database with compute, storage, and model access growing out of it, all sharing the one trick Neon was already good at. If you have only ever evaluated it as a place to put a connection string, it is worth a second look on those terms.

We benchmark Neon's database side in depth in our [Neon vs Supabase series](https://devops-daily.com/posts/neon-vs-supabase-free-tier-benchmarks), and keep a running [Neon vs Supabase comparison](https://devops-daily.com/comparisons/neon-vs-supabase) covering architecture and pricing side by side. As these platform features leave preview, we will put them through the same treatment: real projects, real numbers, and the harness published so you can argue with our data instead of someone's vibes.
