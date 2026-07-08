---
title: 'Per-Branch AI Endpoints: Isolating Model Spend Across Prod, Preview, and CI'
excerpt: 'When previews, CI, and production all call models with the same key, you cannot tell what a preview cost or notice a runaway test until the invoice. Because a Neon branch is its own deployment with a usage ledger that lives in the branch''s Postgres, model spend is attributed and isolated per environment. I proved it: a CI branch spent tokens while production stayed flat.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-07-16'
publishedAt: '2026-07-16T09:00:00Z'
updatedAt: '2026-07-16T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - neon
  - ai-gateway
  - finops
  - preview-environments
  - ci-cd
  - llm
---

AI spend is hard to see. In most setups the same gateway credential is used by production, every preview environment, CI, and whatever load test someone ran on Friday. All of that lands in one undifferentiated number. You cannot answer "what did that preview cost," you cannot cap a specific environment, and you find out a CI job went into a retry loop against an expensive model when the monthly invoice arrives, not when it happens.

The reason is that spend is attributed to a key, and the key is shared. Neon changes what is shared: each branch is its own deployment, and if you log usage to Postgres, that ledger lives on the branch too. So a preview or CI branch records its own spend in its own ledger, and none of it moves production's numbers. I tested it by running calls on a CI branch and watching production's ledger stay flat. The [repo](https://github.com/The-DevOps-Daily/neon-ai-gateway-demo) is at the end.

## TL;DR

- One shared gateway key means one undifferentiated bill: no per-environment attribution, no per-environment cap, and no early warning when a preview or CI job spends a lot.
- On Neon, each branch is its own deployment (its own function endpoint), and the usage log you keep in Postgres lives on the branch. Calls on a branch record against the branch's ledger.
- I tested it: two model calls on a `ci-run` branch raised the branch's token count while production's ledger stayed exactly where it was.
- Copy-on-write means a branch inherits production's ledger snapshot at branch time; the isolation is in what happens after, new spend on a branch never touches production.

## Prerequisites

- A Neon project with the AI gateway enabled (`us-east-2`)
- A usage table in Postgres (the demo logs every call), and branches for your environments

## The shared-key problem

When production and every ephemeral environment authenticate with the same credential, the provider's dashboard shows you one line. That has real consequences:

- **No attribution.** You cannot say what fraction of last month's tokens came from previews, from CI, or from real users.
- **No isolation.** A preview running a batch job, or a CI test that loops, spends against the same budget production draws on, and can exhaust a rate limit everyone shares.
- **No early signal.** The first time you learn a non-production environment burned money is the invoice.

Tagging requests helps a little, but it is bookkeeping bolted on after the fact, and it still shares one budget and one rate limit.

## The Neon model: spend rides the branch

```diagram
{
  "type": "infra",
  "title": "spend rides the branch, not a shared key",
  "groups": [
    {
      "label": "production",
      "sub": "flat while others spend",
      "icon": "branch",
      "tone": "slate",
      "nodes": [
        { "label": "Function", "sub": "gateway calls", "icon": "gear", "tone": "blue" },
        { "label": "usage_log", "sub": "its Postgres", "icon": "database", "tone": "violet" }
      ]
    },
    {
      "label": "CI or preview branch",
      "sub": "own deployment + own ledger",
      "icon": "branch",
      "tone": "green",
      "nodes": [
        { "label": "Function", "sub": "gateway calls", "icon": "gear", "tone": "blue" },
        { "label": "usage_log", "sub": "branch Postgres", "icon": "database", "tone": "green" }
      ]
    }
  ]
}
```

On Neon each branch is its own deployment with its own function URL, and because you log usage to Postgres and Postgres branches, the usage ledger is per branch too. A call made against a branch's function URL writes to that branch's `usage_log`, and that ledger is what makes spend attributable per environment: production's ledger is a different table on a different branch. The isolation demonstrated here is that per-branch ledger in Postgres, not a claim that Neon meters the gateway credential itself separately per branch. That distinction matters: the attribution you can rely on is the one you record yourself, in the branch's database.

The usage view is an ordinary query over that branch's log:

```typescript
// GET /usage: tokens grouped by model, from THIS branch's log
const rows = await db
  .select({
    model: usageLog.model,
    calls: sql`count(*)::int`,
    totalTokens: sql`sum(${usageLog.totalTokens})::int`,
  })
  .from(usageLog)
  .groupBy(usageLog.model);
```

## The proof: a CI branch spends, production does not move

I read production's usage, branched a `ci-run` environment, made two model calls against the branch, and read both ledgers.

```terminal
{
  "title": "spend on a branch stays on the branch",
  "prompt": "$",
  "steps": [
    { "comment": "production's ledger to start" },
    { "cmd": "curl -s $MAIN/usage", "output": "claude-haiku-4-5: 44 tokens | gemini-2-5-flash: 37 | gpt-5-nano: 25" },
    { "comment": "branch a CI environment and run two calls against it" },
    { "cmd": "neon branches create --name ci-run && neon deploy --branch ci-run", "output": "chat: https://br-red-butterfly-...-chat.compute..." },
    { "cmd": "curl -s $BRANCH/chat -d '{\"model\":\"gpt-5-nano\",\"prompt\":\"...\"}'  # x2", "output": "200\n200" },
    { "comment": "the branch's ledger grew..." },
    { "cmd": "curl -s $BRANCH/usage", "output": "gpt-5-nano: 71 tokens | claude-haiku-4-5: 44 | gemini-2-5-flash: 37" },
    { "comment": "...and production's did NOT move" },
    { "cmd": "curl -s $MAIN/usage", "output": "claude-haiku-4-5: 44 tokens | gemini-2-5-flash: 37 | gpt-5-nano: 25" },
    { "cmd": "neon branches delete ci-run", "output": "Deleted branch ci-run" }
  ]
}
```

The branch's `gpt-5-nano` total went from 25 to 71 as its two calls landed, while production stayed at 25. The CI run's spend was recorded against the CI branch and nowhere else, and deleting the branch takes its ledger with it.

:::note
Because storage is copy-on-write, a new branch inherits production's ledger as it was at branch time (that is why the branch started at 25, not 0). The isolation is in the delta: everything spent on the branch after it is created stays on the branch, and nothing the branch does changes production's numbers. For clean per-run attribution, read the branch's growth, or keep CI branches short-lived so their ledger is just that run.
:::

## What this buys you

- **Attribution.** Each environment's spend is a query against its own ledger, so "what did this preview cost" has an answer.
- **Containment.** A runaway CI job or a preview load test spends against its branch, not production's budget or rate limit.
- **Cleanup.** Delete the branch and its spend record goes with it; there is no separate accounting resource to prune.
- **Governance.** Because each environment records against its own branch ledger, you can reason about and bound non-production usage separately from the real thing.

## The repo

The gateway function with the per-branch usage log is here:

```github
https://github.com/The-DevOps-Daily/neon-ai-gateway-demo
```

## Wrapping up

Model spend is only invisible because it is attributed to a shared key. Move the usage ledger onto the branch and the picture inverts: every environment keeps its own record, a preview or CI run spends against itself, and production's numbers are unaffected by anything a branch does. You get per-environment attribution and containment for free, and cleanup is the same `delete a branch` that already tears down the rest of the preview.
