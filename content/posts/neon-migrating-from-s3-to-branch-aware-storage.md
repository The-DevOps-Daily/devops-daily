---
title: 'Migrating From S3 to Branch-Aware Storage'
excerpt: 'Neon object storage is S3-compatible, so moving to it is mostly a config change, not a rewrite. Your upload code, your presigned URLs, and your download paths all stay the same. Here is exactly what carries over, the small diff that changes, and a copy script to move the objects, with the honest list of what does not come along.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-07-10'
publishedAt: '2026-07-10T09:00:00Z'
updatedAt: '2026-07-10T09:00:00Z'
readingTime: '9 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - neon
  - object-storage
  - aws-sdk
  - migration
  - s3
  - serverless
---

If your files already live in Amazon S3, the pitch for storage that branches with your database is appealing but the word "migration" makes it sound like a project. It mostly is not. Neon's object storage speaks the S3 API, so the code you already wrote, the AWS SDK calls, the presigned URLs, the multipart uploads, keeps working. What changes is how you point the client and where the bucket comes from, and that is a small, mechanical diff. The actual data move is a copy loop you can run once.

This post is the practical version: what stays identical, the exact config that changes, a script to copy the objects across, and an honest list of the S3 features that do not have an equivalent so you know what to check before you commit. The [repo](https://github.com/The-DevOps-Daily/neon-storage-demo) with the working client is at the end.

## TL;DR

- Neon object storage is S3-compatible. Your `@aws-sdk/client-s3` code, `PutObject`, `GetObject`, `getSignedUrl`, multipart, works unchanged.
- The diff is the client config: point `endpoint` at the Neon storage endpoint, pin `region: 'us-east-2'`, set `forcePathStyle: true`. The bucket is declared in `neon.ts` instead of created in the console, and credentials are injected per branch.
- Move the data with a list-and-copy loop between two S3 clients (source AWS, destination Neon).
- What does not carry over: S3 bucket policies, event notifications and Lambda triggers, storage classes and Glacier transitions, and cross-region replication. Object CRUD and presigning do.
- The payoff is everything else in this series: once the files are on Neon, they branch with your database.

## Prerequisites

- An existing S3 bucket and credentials that can read it
- A Neon project on the platform preview with a declared bucket (`us-east-2`)
- The AWS SDK (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`)

## What stays the same

This is the reassuring part. The application code that touches storage does not change, because it is the S3 API on both sides. The same `PutObjectCommand`, `GetObjectCommand`, and `getSignedUrl` calls run against either store. The only thing that differs is which client you hand them to.

```tabs
{
  "title": "Same SDK calls, different client config",
  "tabs": [
    {
      "label": "Amazon S3",
      "lang": "typescript",
      "code": "import { S3Client } from '@aws-sdk/client-s3';\n\n// AWS: region is a real region, endpoint is inferred, virtual-hosted style.\nconst s3 = new S3Client({\n  region: 'us-east-1',\n});\n\n// ...every PutObject / GetObject / getSignedUrl call below is identical."
    },
    {
      "label": "Neon storage",
      "lang": "typescript",
      "code": "import { S3Client } from '@aws-sdk/client-s3';\n\n// Neon: explicit endpoint, pinned region, path-style. Credentials come from\n// the env the runtime injects; no long-lived keys in your config.\nconst s3 = new S3Client({\n  region: 'us-east-2',\n  endpoint: process.env.AWS_ENDPOINT_URL_S3,\n  forcePathStyle: true,\n});\n\n// ...same PutObject / GetObject / getSignedUrl calls as the AWS version."
    }
  ]
}
```

## The diff that changes

Three config differences and two operational ones:

- **`endpoint`.** AWS infers it from the region; for Neon you set it explicitly to the injected `AWS_ENDPOINT_URL_S3`.
- **`region`.** Pin it to `us-east-2`. The runtime injects an `AWS_REGION` that is actually the storage-cell host, which the SDK rejects as a region, so do not read it from the environment.
- **`forcePathStyle: true`.** Neon storage is path-style (`endpoint/bucket/key`), not virtual-hosted (`bucket.endpoint/key`).
- **Where the bucket comes from.** Instead of creating it in the AWS console or Terraform, you declare it in `neon.ts` under `preview.buckets`. It is provisioned with the branch.
- **Credentials.** Instead of long-lived access keys in your environment, the credentials are injected per branch by `neon deploy`. That is one fewer secret to rotate and store.

## Moving the objects

The data move is a list-and-copy loop: list the source bucket, stream each object from AWS, and put it into Neon. Two S3 clients, one reads, one writes.

```typescript
import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const source = new S3Client({ region: 'us-east-1' }); // AWS
const dest = new S3Client({
  region: 'us-east-2',
  endpoint: process.env.AWS_ENDPOINT_URL_S3, // Neon
  forcePathStyle: true,
});

const SRC_BUCKET = 'my-prod-bucket';
const DEST_BUCKET = 'files';

let ContinuationToken: string | undefined;
do {
  const page = await source.send(
    new ListObjectsV2Command({ Bucket: SRC_BUCKET, ContinuationToken }),
  );
  for (const obj of page.Contents ?? []) {
    const got = await source.send(new GetObjectCommand({ Bucket: SRC_BUCKET, Key: obj.Key }));
    await dest.send(
      new PutObjectCommand({
        Bucket: DEST_BUCKET,
        Key: obj.Key,
        Body: got.Body, // stream straight through
        ContentType: got.ContentType,
      }),
    );
    console.log(`copied ${obj.Key}`);
  }
  ContinuationToken = page.NextContinuationToken;
} while (ContinuationToken);
```

Run it once to backfill, keep dual-writing for a short window if you cannot take downtime, then cut reads over. The destination side of this loop, the `PutObject` into Neon, is exactly what the [demo](https://github.com/The-DevOps-Daily/neon-storage-demo) does on every upload, so it is the tested path; the source side is standard S3 you already run.

:::warning
Two things to verify before you cut over. First, if your database stores full S3 URLs rather than bare object keys, those rows point at the old host; migrate to storing keys, or rewrite the URLs. Second, keep the keys identical across the move so nothing else has to change; the loop above preserves them.
:::

## What does not carry over

Being honest about the edges saves you a surprise in production. The object operations port cleanly; the S3 platform features around them may not have an equivalent in the preview:

| Feature | Carries over? |
| --- | --- |
| `PutObject` / `GetObject` / `DeleteObject` | Yes |
| Presigned URLs (`getSignedUrl`) | Yes |
| Multipart upload | Yes |
| List, prefixes, pagination | Yes |
| Bucket policies / ACLs | Check; model differs |
| Event notifications, Lambda triggers | No direct equivalent |
| Storage classes, Glacier transitions | No |
| Cross-region replication | No (single region preview) |

If your app leans on S3 events to kick off processing, you will replace that with the function doing the work inline or enqueueing it after the write. If you depend on Glacier tiering, this is not that. For the common case, upload, store, serve, and now branch, the port is the config change above plus the copy loop.

## The repo

The working Neon storage client (the destination side of the migration, plus direct and presigned uploads) is here:

```github
https://github.com/The-DevOps-Daily/neon-storage-demo
```

## Wrapping up

S3 compatibility is what makes this a config change instead of a rewrite. Your upload and download code does not know the difference; you repoint the client, declare the bucket on the branch, drop the long-lived keys, and run a copy loop once. Check the short list of S3 platform features that do not come along, and if you are in the common case you are not, then the reward is that your files finally branch with your database like the rest of your state.
