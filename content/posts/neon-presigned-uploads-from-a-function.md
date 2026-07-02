---
title: 'Presigned-URL Uploads From a Serverless Function'
excerpt: 'Streaming user uploads through your API means the bytes cross your server twice, and serverless functions have request-size limits that make it worse. Presigned URLs let the browser upload straight to object storage while your function just hands out permission. Here it is on a Neon Function, tested end to end.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-07-06'
publishedAt: '2026-07-06T09:00:00Z'
updatedAt: '2026-07-06T09:00:00Z'
readingTime: '9 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - neon
  - object-storage
  - serverless
  - functions
  - aws-sdk
  - uploads
---

The naive way to accept file uploads is to POST them to your API, let the server read the bytes, and write them to object storage. It works until the files get large or the traffic gets real. Now every upload crosses your infrastructure twice, once from the client to your server and once from your server to storage, and your server holds the whole file in memory or on disk while it does. On a serverless function it is worse, because functions have request-size and duration limits that a big upload runs straight into.

Presigned URLs are the standard fix, and they predate serverless by a decade. Your server does not move the bytes; it hands the client a short-lived, pre-authorized URL and the client uploads directly to object storage. The server only issues permission and records metadata. On a Neon Function this is the same AWS S3 SDK you already use, pointed at the branch's storage endpoint. This post builds it and tests the whole round trip. The [repo](https://github.com/The-DevOps-Daily/neon-storage-demo) is at the end.

## TL;DR

- Proxying uploads through a function sends the bytes across it, burning bandwidth and memory and hitting request-size limits.
- A presigned URL is a time-limited, pre-authorized link to one object key. The client PUTs the bytes straight to storage; the function never touches them.
- On Neon Functions you generate it with `getSignedUrl` from `@aws-sdk/s3-request-presigner`, the same code as any S3-compatible store.
- I tested the full flow: presign, the client PUT straight to storage returned `200`, a metadata record was saved, and downloading the object returned the exact bytes.
- One gotcha to pin: the injected `AWS_REGION` is the storage-cell host, not a region, so set `region: 'us-east-2'` on the client.

## Prerequisites

- A Neon project on the platform preview with a declared bucket (object storage, `us-east-2`)
- The AWS SDK: `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`
- Familiarity with S3-style object storage and HTTP `PUT`

## Why not just proxy the upload

Sending the file through the function has three costs that all get worse with size:

- **Bandwidth doubles.** The bytes travel client → function → storage. You pay for both hops.
- **The function holds the file.** It buffers the body to forward it, so memory scales with upload size and concurrency.
- **Limits bite.** Serverless request-body caps and duration limits turn a large upload into a failed request, not a slow one.

The presigned pattern removes all three, because the large transfer never involves the function.

## The flow

```text
1. client  ── "I want to upload notes.txt" ─────────►  function
2. function ── presigned PUT url (valid 1h) ────────►  client
3. client  ── PUT the bytes straight to storage ───►  object storage
4. client  ── "done, here's the key + size" ───────►  function ── writes metadata row ──► Postgres
```

Steps 1, 2, and 4 are tiny JSON requests to the function. Step 3, the only large transfer, goes directly to storage and never touches your code.

## The code

Issuing the URL is one call. `getSignedUrl` signs a `PutObjectCommand` with an expiry; the client then uses that URL as a plain HTTP `PUT`.

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';

// The runtime injects the storage endpoint and credentials. Pin the region:
// the injected AWS_REGION is the storage-cell host, not a usable region.
const s3 = new S3Client({
  region: 'us-east-2',
  endpoint: process.env.AWS_ENDPOINT_URL_S3,
  forcePathStyle: true,
});

// POST /files/presign  ->  { key, uploadUrl }
app.post('/files/presign', async (c) => {
  const { filename, contentType } = await c.req.json();
  const key = `uploads/${randomUUID()}-${filename}`;
  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: 'files', Key: key, ContentType: contentType }),
    { expiresIn: 3600 }, // one hour
  );
  return c.json({ key, uploadUrl });
});
```

After the client uploads, it tells the function to record the file. That is an ordinary insert; the bytes are already in storage.

```typescript
// POST /files/confirm  ->  saved row
app.post('/files/confirm', async (c) => {
  const { key, filename, contentType, bytes } = await c.req.json();
  const [row] = await db.insert(files).values({ key, filename, contentType, bytes }).returning();
  return c.json(row, 201);
});
```

The three moving parts, from the browser's side, look like this:

```tabs
{
  "title": "The presigned upload, step by step",
  "tabs": [
    {
      "label": "1. get a URL",
      "lang": "javascript",
      "code": "const res = await fetch('/files/presign', {\n  method: 'POST',\n  headers: { 'content-type': 'application/json' },\n  body: JSON.stringify({ filename: file.name, contentType: file.type }),\n});\nconst { key, uploadUrl } = await res.json();"
    },
    {
      "label": "2. upload to storage",
      "lang": "javascript",
      "code": "// The bytes go straight to object storage, not through the function.\nawait fetch(uploadUrl, {\n  method: 'PUT',\n  headers: { 'content-type': file.type },\n  body: file,\n});"
    },
    {
      "label": "3. confirm",
      "lang": "javascript",
      "code": "await fetch('/files/confirm', {\n  method: 'POST',\n  headers: { 'content-type': 'application/json' },\n  body: JSON.stringify({ key, filename: file.name, contentType: file.type, bytes: file.size }),\n});"
    }
  ]
}
```

## The tested round trip

I ran the whole sequence against the deployed function. The key line is the direct `PUT` to storage returning `200` without the function in the path, and the downloaded object matching what was uploaded.

```terminal
{
  "title": "presign, upload direct, confirm, download",
  "prompt": "$",
  "steps": [
    { "comment": "ask the function for a presigned URL" },
    { "cmd": "curl -s -X POST $URL/files/presign -d '{\"filename\":\"notes.txt\",\"contentType\":\"text/plain\"}'", "output": "{ \"key\": \"uploads/de501bdd-...-notes.txt\", \"uploadUrl\": \"https://...storage.../uploads/...?X-Amz-Signature=...\" }" },
    { "comment": "PUT the bytes STRAIGHT to storage (no function in the path)" },
    { "cmd": "curl -s -X PUT \"$UPLOAD_URL\" --data-binary 'uploaded straight to storage' -w '%{http_code}'", "output": "200" },
    { "comment": "record the metadata" },
    { "cmd": "curl -s -X POST $URL/files/confirm -d '{\"key\":\"...\",\"filename\":\"notes.txt\",\"bytes\":51}' -w '%{http_code}'", "output": "201" },
    { "comment": "download it back through a presigned GET; bytes match" },
    { "cmd": "curl -sL $URL/files/3", "output": "uploaded straight to storage" }
  ]
}
```

## Downloads work the same way

The reverse direction is identical: presign a `GetObjectCommand` and either redirect the client to it or return it. The bytes stream from storage to the client, not through the function, and the URL expires. The demo's `GET /files/:id` does exactly that.

:::warning
Presigned URLs are capability tokens. Two things to get right: keep `expiresIn` short (minutes, not days) so a leaked URL is not useful for long, and never presign a key taken raw from user input. Generate the key server-side (the demo uses a UUID prefix) so a caller cannot request a URL for someone else's object. If you need to cap upload size, presign with a content-length condition.
:::

## The repo

The full files API, direct upload plus this presigned flow, is here:

```github
https://github.com/The-DevOps-Daily/neon-storage-demo
```

## Wrapping up

Presigned URLs are one of those patterns that stay correct no matter where the code runs, and serverless is exactly where they pay off most, because the function's request limits make proxying large uploads a non-starter. On Neon Functions it is the same S3 SDK you already know, pointed at the branch's storage endpoint, with one config line to pin the region. The function hands out permission, the bytes go straight to storage, and your metadata stays in Postgres next to everything else.
