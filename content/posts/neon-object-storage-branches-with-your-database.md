---
title: 'Object Storage That Branches With Your Database'
excerpt: 'Database branching gives you a throwaway copy of your rows. But your app also stores files in object storage, and those normally stay in one shared bucket. On Neon a branch forks the bucket too, so each branch gets its own copy of the files. I built a small files API to prove it.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-07-04'
publishedAt: '2026-07-04T09:00:00Z'
updatedAt: '2026-07-04T09:00:00Z'
readingTime: '9 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - neon
  - object-storage
  - postgres
  - branching
  - preview-environments
  - serverless
---

Database branching solved a real problem: you can fork your database at a point in time, get an isolated copy with all the rows, and run something risky against it without touching production. Preview databases and safe migrations came out of that.

But most applications do not keep everything in Postgres. The rows point at files, user uploads, generated images, exported reports, that live in object storage. When you branch the database, those files stay put in one shared bucket. So a branched database and the real database read and write the same objects. Your isolated copy of the rows is pointing at a very much not-isolated pile of files.

Neon's object storage branches with the database. You declare a bucket as part of your branch configuration, and when you create a branch, the bucket forks too, copy-on-write, just like the rows. Each branch gets its own copy of the files and its own storage endpoint. To make sure that is real, I built a small files API where the metadata lives in Postgres and the bytes live in the bucket, then branched it and watched the files come along. The [repo](https://github.com/The-DevOps-Daily/neon-storage-demo) is at the end.

## TL;DR

- Database branching forks your rows. If your files live in a shared object-storage bucket, a branch still points at the real files.
- On Neon you declare a bucket in `neon.ts`; it becomes part of the branch and forks with it, copy-on-write. Each branch gets its own copy of the objects and its own storage endpoint.
- I tested it: a files API with 3 files on `main`. Branching gave the branch a copy of all 3, a file written on the branch never appeared on `main`, and deleting the branch removed its files.
- That gives you point-in-time copies of the whole state, the rows and the files they reference together, which is what makes previews and repro cases actually faithful.

## Prerequisites

- A Neon project on the platform preview (object storage on new `us-east-2` projects)
- The Neon CLI (`npm i -g neon`, then `neon login`)
- Familiarity with Postgres and S3-style object storage

## The gap: forking the rows but not the files

Picture a normal app. A `documents` table has a row per upload, and each row stores an object key pointing at the file in an S3 bucket. Branch the database and you get a copy of the `documents` rows. But the object keys in those copied rows still point at the one real bucket. Three things follow, and all of them are quietly bad:

- A preview environment can **overwrite or delete real files**, because its rows reference the same objects the production rows do.
- You cannot get a **consistent snapshot**. The rows are frozen at branch time; the files keep changing underneath them.
- Your "isolated" copy is only half isolated, so the confidence branching was supposed to give you is not really there.

People work around this with a bucket-prefix-per-branch convention and a script to copy objects. It is glue, and it is glue that has to stay correct.

## How a Neon branch forks the bucket

On Neon, the bucket is declared alongside the database and the functions, so it is part of what a branch is:

```typescript
// neon.ts
import { defineConfig } from '@neon/config/v1';

export default defineConfig({
  preview: {
    // Declared here, the bucket forks with the database branch.
    buckets: { files: {} },
    functions: {
      files: { name: 'files api', source: 'src/index.ts' },
    },
  },
});
```

Create a branch and the bucket forks with copy-on-write semantics: the branch starts as a reference to the parent's objects and only stores what you add or change. Each branch also gets its own storage endpoint, so a branch is not the same bucket with a different prefix; it is an isolated bucket that happens to start as a copy.

Inside the function, this is the ordinary AWS S3 SDK pointed at the branch's storage endpoint:

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: 'us-east-2',
  endpoint: process.env.AWS_ENDPOINT_URL_S3, // the branch's storage endpoint
  forcePathStyle: true,
});

// Writing a file is a normal PutObject; the row goes to Postgres alongside it.
await s3.send(new PutObjectCommand({ Bucket: 'files', Key: key, Body: bytes }));
```

## Proving it

The demo is a files API: `POST /files` to upload, `GET /files` to list. I put three files on `main`, branched it, and inspected the branch. Every number below is from the real run.

```terminal
{
  "title": "the bucket forks with the branch",
  "prompt": "$",
  "steps": [
    { "comment": "main has three files" },
    { "cmd": "curl -s $MAIN/files | jq length", "output": "3" },
    { "comment": "branch the project and deploy the function onto the branch" },
    { "cmd": "neon branches create --name pr-preview", "output": "Created branch pr-preview (br-long-sound-...)" },
    { "cmd": "neon deploy --branch pr-preview", "output": "files: https://br-long-sound-...-files.compute.c-3.us-east-2.aws.neon.tech/" },
    { "comment": "the branch already lists a copy of main's three files" },
    { "cmd": "curl -s $BRANCH/files | jq length", "output": "3" },
    { "comment": "upload a file on the branch" },
    { "cmd": "curl -s -X POST $BRANCH/files -H 'x-filename: branch-only.txt' --data-binary 'preview'", "output": "{ \"id\": 4, \"filename\": \"branch-only.txt\" }" },
    { "comment": "branch has four, main still has three" },
    { "cmd": "curl -s $BRANCH/files | jq length && curl -s $MAIN/files | jq length", "output": "4\n3" },
    { "comment": "delete the branch: its files go with it" },
    { "cmd": "neon branches delete pr-preview", "output": "Deleted branch pr-preview" }
  ]
}
```

The branch came up with a copy of the three files, the upload landed only on the branch, `main` stayed at three, and the delete cleaned up the branch's copy. The rows and the files branched together and stayed isolated together.

## Shared bucket vs branch-scoped bucket

| | One shared bucket | Bucket on the branch |
| --- | --- | --- |
| A branch's files | The real production objects | A copy-on-write copy |
| Preview can corrupt prod files | Yes | No |
| Point-in-time snapshot of rows + files | No | Yes |
| Per-branch setup | Prefix convention + copy script | None; declared once in `neon.ts` |
| Cleanup | Manual object deletion | Delete the branch |

## Why this matters

The payoff is that a branch is a faithful copy of your whole state, not just the database half. A preview environment shows the rows and the exact files those rows point at. A bug that only reproduces when a specific record references a specific uploaded object can be reproduced by branching, because branching brings the object. And a migration that rewrites how files are referenced can be tested against a real copy of both the rows and the files before it goes near production.

:::note
This is Neon's platform preview: object storage is available on new `us-east-2` projects. One thing to know when you wire up the S3 client: pin `region: 'us-east-2'`. The runtime injects the storage endpoint and credentials, but the injected `AWS_REGION` is the storage-cell host, which the AWS SDK will not accept as a region.
:::

## The repo

The files API used here (Postgres metadata + a branch-scoped bucket, direct and presigned uploads) is here:

```github
https://github.com/The-DevOps-Daily/neon-storage-demo
```

## Wrapping up

Branching taught us to treat the database as forkable and disposable. The files an app stores are part of its state too, and leaving them in a shared bucket means a branch was never a full copy. When the bucket forks with the branch, copy-on-write and isolated, you get point-in-time copies of everything an app depends on, and the previews and repro cases built on top of that stop lying to you about what production actually looks like.
