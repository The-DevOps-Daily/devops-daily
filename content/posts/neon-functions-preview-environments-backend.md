---
title: 'Preview Environments That Include the Backend, Not Just the Frontend'
excerpt: 'Every PR gets a frontend preview URL. The backend is almost always one shared staging database, so previews quietly lie to you. On Neon a branch is the database, its data, and the functions together, so each PR can get a real isolated backend. Here is the workflow, tested end to end.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-07-02'
publishedAt: '2026-07-02T15:00:00Z'
updatedAt: '2026-07-02T15:00:00Z'
readingTime: '9 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - neon
  - functions
  - postgres
  - preview-environments
  - ci-cd
  - serverless
---

Open a pull request and your frontend host hands you a preview URL. Vercel, Netlify, Cloudflare Pages all do it: every PR gets its own isolated build you can click through before merging. It is one of the genuinely great DevOps conveniences of the last decade.

Then you look at what that preview talks to. The API and the database behind it are almost always a single shared staging environment. Every open PR hits the same backend, runs migrations against the same schema, and reads and writes the same rows. So the preview is only half a preview. The frontend is isolated; the thing it depends on is a free-for-all.

Neon changes what a "branch" contains. A branch is not just a copy of your schema, it is a copy-on-write copy of the data too, and with Neon Functions the compute deploys onto that branch as well. So a branch is the database, its data, and the backend, forked together, each with its own URL. That makes a real per-PR backend cheap enough to create and throw away on every pull request. In this post I show the workflow and prove the isolation with a live function, then sketch how to wire it into CI.

## TL;DR

- Frontend previews are isolated per PR. The backend they call usually is not, so previews share one staging database and its migrations and data.
- A Neon branch copies the schema and the data (copy-on-write), and Neon Functions deploy onto the branch, so each branch is a full isolated backend with its own function URL.
- I tested it: branched a live todos API, the branch came up with a copy of main's rows, a write to the branch left main untouched, and the branch had its own URL.
- In CI this is: on PR open, create a branch and deploy the function; hand the frontend preview that branch's URL; on PR close, delete the branch and everything goes with it.
- Because branches are copy-on-write and functions scale to zero, a preview backend costs almost nothing while it sits idle.

## Prerequisites

- A Neon project on the platform preview (Functions, `us-east-2`) with a deployed function
- The Neon CLI (`npm i -g neon`, then `neon login`)
- A CI system that can run CLI commands on pull-request events (the example uses GitHub Actions)

## Why shared staging quietly hurts

A shared staging backend fails in ways that are easy to miss until they bite:

- **Migrations collide.** Two PRs each add a column, or one renames a table the other still reads. Whoever runs their migration second gets a broken staging environment, and now both previews are wrong.
- **Data bleeds between PRs.** One PR's test run creates records another PR's preview then displays. Bugs appear and vanish depending on who ran what, and nobody can reproduce them.
- **The preview is not like production.** To avoid touching real data, staging often runs a thin set of seed fixtures, so the preview never sees the shape or volume of real data and "works in preview" does not mean "works in prod."
- **Resetting is scary.** Because everyone shares it, nobody wants to be the one who wipes staging, so bad data accumulates for months.

None of this is a tooling failure on the frontend side. It is that the backend was never actually part of the preview.

## What a Neon branch gives you

A Neon branch is a copy-on-write fork of the database at a point in time. It starts with the parent's schema and data instantly, without physically copying the bytes, and it diverges only as you write to it. Neon Functions extend that: when you deploy, the function is applied to a branch, and every branch gets its own function URL of the form `https://<branch>-<function>.compute.<region>.aws.neon.tech`.

Put those together and a branch is a self-contained backend: its own database, its own copy of the data, and its own API endpoint. Nothing it does touches the parent.

## Proving the isolation

I have a small todos API (Hono + Drizzle on a Neon Function) already deployed on `main`, with a handful of rows. Here is the whole preview-backend lifecycle against it, with the real output.

```terminal
{
  "title": "a branch is a full backend",
  "prompt": "$",
  "steps": [
    { "comment": "main has four todos, served by the main branch's function URL" },
    { "cmd": "curl -s $MAIN/todos | jq length", "output": "4" },
    { "comment": "create a branch for a pull request: copies schema AND data, instantly" },
    { "cmd": "neon branches create --name pr-142-preview", "output": "Created branch pr-142-preview (br-crimson-truth-...)" },
    { "comment": "deploy the function onto that branch: it gets its own URL" },
    { "cmd": "neon deploy --branch pr-142-preview", "output": "Applied changes\n  todos: https://br-crimson-truth-...-todos.compute.c-3.us-east-2.aws.neon.tech/" },
    { "comment": "the branch already serves a copy of main's data" },
    { "cmd": "curl -s $BRANCH/todos | jq length", "output": "4" },
    { "comment": "write something risky on the branch" },
    { "cmd": "curl -s -X POST $BRANCH/todos -d '{\"text\":\"risky migration test\"}'", "output": "{ \"id\": 5, \"text\": \"risky migration test\" }" },
    { "comment": "the branch has it..." },
    { "cmd": "curl -s $BRANCH/todos | jq length", "output": "5" },
    { "comment": "...and main is untouched" },
    { "cmd": "curl -s $MAIN/todos | jq length", "output": "4" },
    { "comment": "PR closed: delete the branch, backend and data go with it" },
    { "cmd": "neon branches delete pr-142-preview", "output": "Deleted branch pr-142-preview" }
  ]
}
```

That is the whole point in one sequence. The branch came up with its own function URL and a copy of main's four rows, a write landed only on the branch, main stayed at four, and deleting the branch cleaned up the database, the data, and the endpoint in one step. Every number there is from the real run.

## Wire it into CI

The manual commands map directly onto pull-request automation. On open or update, create a branch named after the PR and deploy the function; expose the branch's function URL to your frontend preview as its API base; on close, delete the branch.

```yaml
# .github/workflows/preview-backend.yml
name: preview-backend
on:
  pull_request:
    types: [opened, synchronize, reopened, closed]

jobs:
  preview:
    runs-on: ubuntu-latest
    env:
      NEON_API_KEY: ${{ secrets.NEON_API_KEY }}
      BRANCH: pr-${{ github.event.number }}-preview
    steps:
      - uses: actions/checkout@v4

      # Create-or-update the branch and (re)deploy the function to it.
      - if: github.event.action != 'closed'
        run: |
          npx neon branches create --name "$BRANCH" || echo "branch exists"
          npx neon deploy --branch "$BRANCH"
          # Expose the branch's function URL to the frontend preview, e.g. as
          # an env var on the Vercel/Netlify deploy for this PR.

      # Tear it all down when the PR closes.
      - if: github.event.action == 'closed'
        run: npx neon branches delete "$BRANCH"
```

Now the frontend preview and the backend preview live and die together. Reviewers click a preview that is running that PR's real code against that PR's own database, seeded from a real copy of production data, and none of it can affect anyone else.

## Shared staging vs a branch per PR

| | Shared staging backend | Branch per PR |
| --- | --- | --- |
| Isolation | One database for all PRs | Own database + data + URL per PR |
| Migrations | Collide across PRs | Run only against that branch |
| Data realism | Thin seed fixtures | Copy-on-write copy of real data |
| Teardown | Manual, scary, shared | Delete the branch, everything goes |
| Idle cost | An always-on staging box | Copy-on-write storage + scale-to-zero compute |

:::tip
Because a branch is copy-on-write, it does not duplicate your data on disk; it stores only what diverges. Combined with functions that scale to zero when idle, a preview backend for a PR that nobody is actively clicking costs close to nothing, which is what makes one-per-PR practical rather than a budget conversation.
:::

## The repo

The todos API used here (Hono + Drizzle on a Neon Function) is the same one from the first post in this series:

```github
https://github.com/The-DevOps-Daily/neon-functions-demo
```

## Wrapping up

Preview environments earned their reputation on the frontend, where every PR gets a clean, clickable, isolated build. The backend got left behind on shared staging, and that is where the confusing bugs and the migration standoffs come from. Because a Neon branch carries the schema, the data, and now the function together, you can give each pull request a real backend of its own and delete it on merge. The frontend preview finally talks to something as disposable and isolated as it is.
