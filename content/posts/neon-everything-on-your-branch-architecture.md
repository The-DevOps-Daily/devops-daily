---
title: 'The Everything-on-Your-Branch Architecture'
excerpt: 'For a decade "branch the database" has meant a copy of the schema and rows. But your app is also files, backend code, and model config. Neon now forks all of it on one branch: Postgres, object storage, functions, and the AI gateway, together and isolated. I branched a full-stack project to prove it.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-07-02'
publishedAt: '2026-07-02T19:00:00Z'
updatedAt: '2026-07-02T19:00:00Z'
readingTime: '10 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - neon
  - postgres
  - branching
  - preview-environments
  - storage
  - platform-engineering
---

Database branching is one of the best ideas serverless Postgres brought to the mainstream. Fork the database at a point in time, get an isolated copy with all the data, run something risky against it, throw it away. It made preview databases and safe migrations feel routine.

But a real application is not just a database. It is a database, plus the files it stores in object storage, plus the backend code that serves it, plus, increasingly, the model and gateway config it calls for AI. When you branch only the database, those other three stay shared. Your "branch" points at the same S3 bucket, the same deployed backend, and the same AI configuration as everything else. So it is half a copy, and the half it leaves out is where a lot of the interesting bugs and the scary migrations live.

Neon's platform preview changes what a branch contains. A branch now forks the database and its data, the object storage and its files, the functions that run your backend, and the AI gateway config, all at the same point in time, all isolated. A branch stops being a database copy and becomes a whole environment. To make sure that is a real claim and not a diagram, I took a full-stack project, branched it, and checked every layer. Here is what happened.

## TL;DR

- Elsewhere, "branch" means the database only. Object storage, backend deploys, and AI config stay shared, so you bolt on scripts to fake per-branch versions of them.
- A Neon branch forks all four together: Postgres + data, object storage + files, functions (each branch gets its own URL), and the AI gateway.
- I proved it: branched a project with a DB, a bucket of files, a function, and the gateway. The branch came up with a copy of the rows, a copy of the files on its own storage endpoint, its own function URL, and the gateway. A write to the branch left `main` untouched, and deleting the branch removed all of it.
- That makes a branch a real environment: true preview stacks, whole-state bug reproduction, and disposable sandboxes for agents.
- Copy-on-write storage and scale-to-zero compute keep an idle branch close to free, which is what makes one-per-PR or one-per-experiment practical.

## Prerequisites

- A Neon project on the platform preview (Functions, object storage, AI gateway; `us-east-2`)
- The Neon CLI (`npm i -g neon`, then `neon login`)
- Comfort with Postgres, S3-style object storage, and serverless functions

## What branches today, and what doesn't

Database branching is now common. What is not common is branching everything around the database. In a typical stack:

- The **database** branches. Good.
- The **object storage** does not. Your branch reads and writes the same real bucket, so a preview can overwrite or delete production files, and you cannot fork the files to match the forked rows.
- The **backend** does not. The branch talks to whatever backend is deployed, usually shared staging, so the code and the data are versioned separately.
- The **AI / model config** does not. Keys, model routing, and spend are shared, so a preview's experiments bill against the same budget and there is no per-branch isolation.

Teams paper over this with scripts: a bucket-prefix-per-branch convention, a bespoke deploy step, a separate set of keys. It works, sort of, and it is a pile of glue nobody wants to own.

## What a Neon branch forks now

On Neon's platform preview, one branch carries the whole stack:

```diagram
{
  "type": "infra",
  "title": "one branch carries the whole stack",
  "flow": [
    { "label": "Production", "sub": "main branch", "icon": "database", "tone": "slate" },
    { "label": "Fork", "sub": "instant, copy-on-write", "icon": "branch", "tone": "green" }
  ],
  "groups": [
    {
      "label": "A Neon branch",
      "sub": "isolated, disposable",
      "icon": "branch",
      "tone": "green",
      "nodes": [
        { "label": "Postgres", "sub": "copy of rows", "icon": "database", "tone": "violet" },
        { "label": "Storage", "sub": "copy of files", "icon": "box", "tone": "blue" },
        { "label": "Functions", "sub": "own API URL", "icon": "gear", "tone": "amber" },
        { "label": "AI Gateway", "sub": "model config", "icon": "net", "tone": "green" }
      ]
    }
  ]
}
```

The database and storage are copy-on-write, so the branch starts as a reference to the parent's state and only stores what you change. The function redeploys onto the branch with its own URL. The gateway config comes along. Delete the branch and every layer goes with it.

## Proving it, layer by layer

I used a small AI image-agent project that exercises all four services: a Postgres table, an `images` object-storage bucket with real files in it, an `imagegen` function, and the AI gateway. Then I branched it and inspected each layer. Every line below is from the real run.

```terminal
{
  "title": "one branch, the whole stack",
  "prompt": "$",
  "steps": [
    { "comment": "main's bucket has real files" },
    { "cmd": "aws s3 ls s3://images --endpoint $MAIN_S3", "output": "flagship/on-main.txt\ngenerated/73cd0ad7-....jpg\ngenerated/78c8994d-....jpg\n... (6 objects)" },
    { "comment": "branch the project: forks DB + storage + functions + gateway" },
    { "cmd": "neon branches create --name flagship-preview", "output": "Created branch flagship-preview (br-sparkling-sound-...)" },
    { "cmd": "neon deploy --branch flagship-preview", "output": "Applied changes\n  update  function:imagegen\n  imagegen: https://br-sparkling-sound-...-imagegen.compute.c-3.us-east-2.aws.neon.tech/\nUtilized services: Postgres, Object Storage, Functions, AI Gateway" },
    { "comment": "the branch has its OWN storage endpoint, with a copy of the files" },
    { "cmd": "aws s3 ls s3://images --endpoint $BRANCH_S3", "output": "flagship/on-main.txt\ngenerated/73cd0ad7-....jpg\n... (same 6 objects)" },
    { "comment": "write a file on the branch..." },
    { "cmd": "aws s3 cp branch-only.txt s3://images/flagship/ --endpoint $BRANCH_S3", "output": "upload: ./branch-only.txt" },
    { "comment": "...it is NOT on main (storage is isolated, just like the rows)" },
    { "cmd": "aws s3 ls s3://images/flagship/ --endpoint $MAIN_S3", "output": "on-main.txt        (branch-only.txt absent)" },
    { "comment": "PR done: one delete removes DB, files, function, and URL" },
    { "cmd": "neon branches delete flagship-preview", "output": "Deleted branch flagship-preview" }
  ]
}
```

The parts that matter: the deploy reported `Utilized services: Postgres, Object Storage, Functions, AI Gateway`, so all four came along. The branch got a **separate** storage endpoint from `main` (not the same bucket with a prefix, an actual isolated endpoint) carrying a copy of the files. It got its own function URL. And the file I wrote to the branch never appeared on `main`, the same isolation the rows get. Deleting the branch took the whole environment with it.

I used the AWS CLI shape above for readability; in the actual run I drove object storage with the S3 SDK against the branch-scoped `AWS_ENDPOINT_URL_S3` that `neon deploy` writes into `.env.local`. The credentials and endpoint are per branch.

## Why an environment beats a database copy

Once a branch is the whole stack, a few things that used to need real infrastructure become one command:

- **Preview environments that are actually complete.** Every PR can get its own database, its own files, and its own backend URL, not a frontend pointed at shared staging. (This is the [preview-backend workflow](https://devops-daily.com/posts/neon-functions-preview-environments-backend) from earlier in the series, now including storage and models too.)
- **Whole-state bug reproduction.** Fork production's database and its files together and you can reproduce a bug that depends on a specific row pointing at a specific uploaded object. Branching the DB alone would leave the file behind.
- **Migrations you can trust.** Test a schema change against a copy of the data and the files it references, on a throwaway backend, before it touches production.
- **Disposable sandboxes for agents.** Give an AI agent a branch and it gets a full environment (data, files, compute, models) it cannot use to damage anything real. Delete it when the task is done.

## The mental model shift

The useful reframe is to stop thinking of a branch as "a copy of my database" and start thinking of it as "a copy of my environment." Because storage and database are copy-on-write, that environment does not duplicate anything on disk until it diverges, and because functions scale to zero, an idle branch costs almost nothing. That combination is what makes it reasonable to spin up a full environment per pull request, per experiment, or per agent task and delete it without a second thought.

:::note
This is Neon's platform preview: object storage, functions, and the AI gateway are available on new `us-east-2` projects. The database-branching half works everywhere; the "everything else branches too" half is what the preview adds.
:::

## The repo

The full-stack demo used here (Postgres + object storage + function + AI gateway, from one CLI) is the companion to the earlier flagship in this series:

```github
https://github.com/The-DevOps-Daily/neon-ai-agent
```

## Wrapping up

Branching taught us to treat a database as something you can fork and throw away. The catch was always that the database was only part of the application, so a branch was only part of a copy. When the branch also carries the files, the backend, and the model config, it becomes a real, disposable environment, and the workflows that used to justify a pile of staging infrastructure, preview stacks, safe migrations, faithful bug repro, agent sandboxes, collapse into `create a branch` and `delete a branch`. That is the shift worth paying attention to: not a better database copy, but a forkable environment.
