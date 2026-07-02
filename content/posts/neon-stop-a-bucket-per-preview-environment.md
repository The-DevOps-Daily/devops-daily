---
title: 'Stop Standing Up an S3 Bucket Per Preview Environment'
excerpt: 'Giving every preview environment isolated file storage usually means provisioning a real bucket per environment: policies, IAM, lifecycle rules, credentials, and a teardown job that leaves orphans anyway. When the bucket rides the database branch, that whole apparatus disappears. Here is the difference, tested.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-07-08'
publishedAt: '2026-07-08T09:00:00Z'
updatedAt: '2026-07-08T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - neon
  - object-storage
  - preview-environments
  - finops
  - ci-cd
  - platform-engineering
---

If your app stores files and you want real preview environments, you eventually hit the same wall: each preview needs its own storage, so you start provisioning a bucket per environment. That sounds cheap until you write it down. For every ephemeral environment you create a bucket, attach a policy, mint an IAM role or access keys, set CORS, add a lifecycle rule so it eventually cleans up, wire the credentials into the preview's config, and register a teardown step for when the PR closes. Then you find the orphaned buckets the teardown missed, months later, still billing.

The reason this is painful is that the bucket is a separate resource from the database, so it needs its own lifecycle. Neon collapses that: the bucket is declared as part of the branch, so it is created and destroyed with the branch and needs no per-environment provisioning at all. This post compares the two approaches and shows the branch version working with no bucket-management code in sight. The [repo](https://github.com/The-DevOps-Daily/neon-storage-demo) is at the end.

## TL;DR

- Isolated storage per preview usually means provisioning a bucket per environment: policy, IAM, CORS, lifecycle, credential wiring, teardown. It is slow, it drifts, and it leaves orphaned buckets that keep costing money.
- On Neon the bucket is declared once in `neon.ts`. Creating a branch brings the bucket (with a copy-on-write copy of the files) and injects scoped credentials; deleting the branch removes it.
- There is no per-environment bucket to create, no IAM role to mint, and nothing to orphan.
- Copy-on-write means fifty preview buckets do not cost fifty times the storage, only what each one changes.

## Prerequisites

- A Neon project on the platform preview (object storage, `us-east-2`)
- The Neon CLI, and a CI system that opens/closes preview environments
- Familiarity with S3 buckets and IAM if you have done the manual version

## The per-environment bucket, written out

Here is what "just give the preview its own bucket" actually expands to, per environment:

1. Create a bucket with a unique name (and hope the name is free).
2. Attach a bucket policy and block public access appropriately.
3. Create an IAM role or access keys scoped to that bucket.
4. Configure CORS so the preview frontend can upload.
5. Add a lifecycle rule so it expires if teardown fails.
6. Inject the bucket name and credentials into the preview's environment.
7. On PR close, delete the objects, then the bucket, then the IAM principal.

That is a Terraform module plus a CI job plus a cleanup job, and step 7 is the one that silently fails and leaves buckets and access keys lying around. Multiply by every open PR.

## The Neon version: nothing per environment

On Neon, the bucket is part of the branch. You declare it once:

```typescript
// neon.ts — the ONLY storage configuration, shared by every branch
import { defineConfig } from '@neon/config/v1';

export default defineConfig({
  preview: {
    buckets: { files: {} },
    functions: { files: { name: 'files api', source: 'src/index.ts' } },
  },
});
```

There is no per-environment bucket module, no IAM step, no CORS block, no lifecycle rule, and no teardown script for storage. Creating a branch provisions the bucket with a copy of the parent's files and injects scoped credentials into the function. Deleting the branch removes the bucket. The preview's storage lifecycle is the branch's lifecycle.

```terminal
{
  "title": "no bucket to provision, nothing to orphan",
  "prompt": "$",
  "steps": [
    { "comment": "open a preview: one command brings DB + a bucket with a copy of the files" },
    { "cmd": "neon branches create --name pr-142", "output": "Created branch pr-142 (br-long-sound-...)" },
    { "cmd": "neon deploy --branch pr-142", "output": "Utilized services: Postgres, Object Storage, Functions\n  files: https://br-long-sound-...-files.compute.c-3.us-east-2.aws.neon.tech/" },
    { "comment": "the preview already has its files, no bucket was created, no IAM role minted" },
    { "cmd": "curl -s $BRANCH/files | jq length", "output": "3" },
    { "comment": "close the preview: bucket + files + credentials gone in one step" },
    { "cmd": "neon branches delete pr-142", "output": "Deleted branch pr-142" }
  ]
}
```

I ran this against the files demo: the branch came up with a copy of the three files already in it, no bucket-creation or IAM step anywhere, and the delete took the storage with it. There is nothing left to orphan.

## Bucket-per-environment vs branch-scoped bucket

| | A bucket per environment | Bucket on the branch |
| --- | --- | --- |
| Provisioning per preview | Create bucket, policy, IAM, CORS, lifecycle | None; declared once in `neon.ts` |
| Credentials | Mint and inject per environment | Injected automatically, scoped to the branch |
| Data in the preview | Empty, or a copy script | Copy-on-write copy of the files |
| Teardown | Delete objects, bucket, IAM (often missed) | Delete the branch |
| Orphan risk | High (failed teardowns) | None |
| Storage cost of N previews | N full buckets | Only what each branch changes |

## The cost angle

Two things keep the cost of many preview buckets down. Copy-on-write means a branch does not duplicate the files on disk; it stores only what that branch adds or modifies, so a preview that just reads production's files costs almost nothing in storage. And because the compute scales to zero, an idle preview is not paying for a running service either. That combination is what makes one isolated storage environment per PR reasonable instead of a line item someone has to defend.

:::tip
The biggest hidden cost of the manual approach is not the buckets you have, it is the ones you forgot. Failed teardown jobs leave buckets and long-lived access keys behind, which is both a bill and a security surface. Tying storage to the branch means "delete the branch" is the only cleanup, so there is nothing to leak or forget.
:::

## The repo

The files API this is built on (Postgres metadata + a branch-scoped bucket) is here:

```github
https://github.com/The-DevOps-Daily/neon-storage-demo
```

## Wrapping up

Provisioning a bucket per preview environment is one of those tasks that is individually small and collectively a mess: a module, a couple of CI jobs, a pile of IAM principals, and a slow accumulation of orphans. It exists only because the bucket is a separate resource with its own lifecycle. Put the bucket on the branch and the per-environment apparatus evaporates, one command brings a preview's storage with a copy of the data, and one command takes it away. The cheapest infrastructure to run is the infrastructure you never had to stand up.
