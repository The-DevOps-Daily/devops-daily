---
title: 'I Gave an AI Agent a Database, Compute, Storage, and Models From One CLI'
excerpt: 'An AI agent usually needs four accounts: a database, somewhere to run, object storage, and a model provider. I wired all four from a single Neon credential and had a deployed image-generating agent in a few minutes. Here is the actual build log, the config that ties it together, and the honest caveats.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-06-26'
publishedAt: '2026-06-26T13:00:00Z'
updatedAt: '2026-06-26T13:00:00Z'
readingTime: '10 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - neon
  - ai-agents
  - serverless
  - postgres
  - platform-engineering
---

A working AI agent has an unglamorous shopping list. It needs a database to remember things, somewhere to run that can stream tokens without timing out, object storage for whatever it produces, and access to a model. Assembled the usual way, that is four separate signups: a Postgres host, a compute platform, an S3 bucket, and an OpenAI or Anthropic account, each with its own credential to provision, inject, and rotate per environment.

Neon's June 2026 platform preview collapses that list. The pitch is that the database, the compute, the storage, and the model gateway all come from one account and branch together. I wanted to know if that was real or a slide, so I built the canonical example end to end: an image-generating agent that takes a prompt, calls a model, stores the result, and indexes it in Postgres. This is the build log, with the real commands and output, and the parts where the preview still shows.

(Companion repo: [The-DevOps-Daily/neon-ai-agent](https://github.com/The-DevOps-Daily/neon-ai-agent). Everything below ran against a fresh project created while writing.)

## One command to scaffold the whole stack

Neon ships starter templates through its CLI. The image agent is one of them:

```bash
neonctl bootstrap ./ai-agent --template ai-sdk
```

That scaffolds 26 files: a Hono function, a Drizzle schema, a `neon.ts` config, and (a nice touch) a `.agents/skills/` directory with skill docs for the AI assistant you are probably using to edit the project. Neon bundles agent instructions for its own products, which tells you who this template is aimed at.

The file that matters is `neon.ts`. It is the entire backend declared in one object:

```ts
import { defineConfig } from '@neondatabase/config/v1';

export default defineConfig({
  preview: {
    aiGateway: true,
    buckets: {
      images: {},
    },
    functions: {
      imagegen: {
        name: 'AI SDK image agent',
        source: 'src/index.ts',
      },
    },
  },
});
```

Three lines of intent: turn on the AI gateway, give me a bucket called `images`, and deploy `src/index.ts` as a function. No connection strings, no bucket ARNs, no model API keys. Those get filled in later, automatically.

## Linking creates the project, deploying creates everything else

`neon link` creates and attaches a Neon project. The new platform features are private preview, so there are two constraints worth stating up front: everything is in AWS `us-east-2`, and it only works on projects created inside the preview. Your existing Neon databases do not grow these features in place.

Then `neon deploy` reads `neon.ts` and provisions the declared services. Here is the whole sequence, link through deploy:

```terminal
{
  "title": "link + deploy",
  "steps": [
    { "comment": "create the project (us-east-2, preview only)" },
    { "cmd": "neonctl link --project-name ai-agent --region-id aws-us-east-2", "output": "Created project (\"ai-agent\") in aws-us-east-2 and linked .neon on branch main" },
    { "comment": "read neon.ts and provision everything it declares" },
    { "cmd": "neonctl deploy", "output": "Applied changes\n  create  service  bucket:images\n  create  service  function:imagegen\n\nFunction URLs\n  imagegen: https://br-green-star-...-imagegen.compute.c-3.us-east-2.aws.neon.tech/\n\nUtilized services: Postgres, Object Storage, Functions, AI Gateway\nPulled 11 Neon variables into .env.local" }
  ]
}
```

That last line is the actual product. Eleven environment variables (the `DATABASE_URL`, the S3 access key/secret/endpoint, and the AI gateway token and base URL) all written for me, all scoped to this branch. The four credentials I would normally collect from four dashboards arrived from one `deploy`.

## The model call: one credential, any provider

The AI Gateway is OpenAI-compatible. Your existing SDK works by changing only the base URL, so the same chat completion against the cheapest catalog model looks like this in whatever you already use:

```tabs
{
  "title": "Same gateway call, three SDKs (only the base URL changes)",
  "tabs": [
    { "label": "curl", "lang": "bash", "code": "curl \"$NEON_AI_GATEWAY_BASE_URL/ai-gateway/mlflow/v1/chat/completions\" \\\n  -H \"Authorization: Bearer $NEON_AI_GATEWAY_TOKEN\" \\\n  -d '{\"model\":\"gpt-5-nano\",\"messages\":[\n        {\"role\":\"user\",\"content\":\"What is Neon branching?\"}]}'" },
    { "label": "Python", "lang": "python", "code": "from openai import OpenAI\n\nclient = OpenAI(base_url=GATEWAY_URL, api_key=GATEWAY_TOKEN)\nclient.chat.completions.create(\n    model=\"gpt-5-nano\",\n    messages=[{\"role\": \"user\", \"content\": \"What is Neon branching?\"}],\n)" },
    { "label": "Node", "lang": "javascript", "code": "import OpenAI from 'openai';\n\nconst client = new OpenAI({ baseURL: GATEWAY_URL, apiKey: GATEWAY_TOKEN });\nawait client.chat.completions.create({\n  model: 'gpt-5-nano',\n  messages: [{ role: 'user', content: 'What is Neon branching?' }],\n});" }
  ]
}
```

Hitting it once returns exactly what you would expect from the model:

```json
{
  "model": "gpt-5-nano-2025-08-07",
  "choices": [{ "message": { "role": "assistant",
    "content": "Neon Postgres branching creates lightweight, independent
      clones of a running database that can be developed in isolation..." }}]
}
```

The same token reaches around 25 models across Anthropic, OpenAI, Google, and a few open-source providers. You move between them by changing one `model` string. There is no separate OpenAI or Anthropic account in this project. The published prices look like each provider's own list rate, so the gateway reads as pass-through with the convenience of a single credential:

```chart
{
  "type": "bar",
  "title": "Output price per 1M tokens, a few AI Gateway models",
  "unit": "$",
  "caption": "List prices from the Neon AI Gateway catalog (models.dev), June 2026. One endpoint and one credential reach all of them; you change a single model field to move across this range.",
  "rows": [
    { "label": "gpt-5-nano", "value": 0.40 },
    { "label": "gemini-2.5-flash", "value": 2.50 },
    { "label": "claude-haiku-4.5", "value": 5.00 },
    { "label": "claude-opus-4.5", "value": 25.00 }
  ]
}
```

The point is not the specific numbers, it is that "use a cheap model in CI and a frontier model in prod" becomes a config value rather than a second vendor integration.

## Storage that the function can reach with the normal S3 SDK

The `images` bucket is plain S3 as far as your code is concerned. The injected `AWS_*` variables point the standard AWS SDK at a branch-scoped endpoint, so this just works inside the function with no custom client:

```ts
const s3 = new S3Client({ forcePathStyle: true });
await s3.send(new PutObjectCommand({
  Bucket: 'images', Key: key, Body: jpeg, ContentType: 'image/jpeg',
}));
const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: 'images', Key: key }));
```

I confirmed it directly: a `PutObject` then `GetObject` round-tripped, and the presigned URL came back on a host scoped to the branch (`br-green-star-….storage.c-3.us-east-2.aws.neon.tech`). That branch scoping is the part you cannot get by bolting an external S3 bucket onto a database: open a branch and its files fork with it, so a preview environment never writes into production's objects.

## Putting it together: the agent runs

The function is a small handler. It streams a model response, and when the model calls its image-generation tool, it uploads the JPEG to the bucket, inserts a row in Postgres, and returns a presigned URL. Calling the deployed agent:

```bash
curl -X POST "$IMAGEGEN_URL" -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user",
       "content":"Draw a small minimalist server rack icon, flat style"}]}'
```

The response streams back as the agent narrates and draws, and afterward the side effects are all there. The object is in the bucket, and the row is in Postgres pointing at it:

```
 id |              prompt               |             bucket_key              | bytes
----+-----------------------------------+-------------------------------------+-------
  2 | Draw a small minimalist server... | generated/ed49b102-…-f8c46e2f8c16.jpg | 47372
  1 | Draw a small minimalist server... | generated/9125d5b4-…-63b54a892695.jpg | 47372
```

From an empty directory to a deployed agent that generates an image, stores it, and indexes it in Postgres took a few minutes and exactly one credential. The model call, the file write, and the database insert were all wired by the platform, not by me.

## Where it still shows the preview

The build was smooth, but it is private preview and a few seams are worth knowing before you plan around it.

:::warning
**One region, new projects only.** Everything is in AWS `us-east-2` and only works on projects created inside the preview. You cannot bolt these features onto an existing production database today.
:::

- **Functions are request/response, not a job runner.** Great for the agent's synchronous loop and streaming; background work (queues, retries, schedules) still belongs to something like Inngest or QStash.
- **Two gateway dialects, and it matters.** The `OPENAI_BASE_URL` Neon injects points at the OpenAI *Responses* API route. A plain chat-completions call needs the `mlflow` dialect route instead. I hit a `404` until I switched routes. The SKILL docs the template ships actually explain this, which is the kind of detail that saves you ten minutes if you read it first.
- **Billing is half-public.** Per-model token prices are listed, but whether there is a markup or preview credits on top is not spelled out. Fine for a demo, a question to ask before a budget.
- **The convenience is also coupling.** One config file declaring your functions, buckets, and gateway is, by design, Neon-shaped. The S3-compatible API and standard SDKs keep the exit ramps wide, but this is a bet on one vendor for four things you used to buy separately.

## So is it real?

Yes, with an asterisk for "preview." The genuinely useful part is not any single feature, it is that the four pieces an agent needs arrive together, branch together, and authenticate with one credential. If you have ever spent the first afternoon of an AI side project wiring a database to a compute host to an S3 bucket to a model provider, collapsing that into one `neon.ts` and one `deploy` is a real reduction in moving parts.

Whether you should build on it today depends on your appetite for a private preview and for vendor consolidation. But as a statement of direction, an agent stack from one CLI is a clear one. We dig into the strategy behind it in [Neon is becoming a backend platform, not just Postgres](https://devops-daily.com/posts/neon-backend-platform-not-just-postgres), and we benchmark Neon's database side in the [Neon vs Supabase series](https://devops-daily.com/posts/neon-vs-supabase-free-tier-benchmarks). As these features leave preview, we will keep testing them the same way: real projects, real output, and the demo code published so you can run it yourself.
