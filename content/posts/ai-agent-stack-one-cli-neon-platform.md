---
title: 'I Gave an AI Agent a Database, Compute, Storage, and Models From One CLI'
excerpt: 'An AI agent usually needs four accounts: a database, somewhere to run, object storage, and a model provider. I wired all four from a single Neon credential and had a deployed image-generating agent in a few minutes. Here is the actual build log, the config that ties it together, and the honest caveats.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-06-26'
publishedAt: '2026-06-26T13:00:00Z'
updatedAt: '2026-11-25T10:00:00Z'
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
sponsorCampaign: 'neon'
---

:::note
**Updated 25 November 2026:** OpenAI ends API access to GPT-5, GPT-5 mini, GPT-5 nano, GPT-5 pro, o3 and o3-pro on 11 December 2026, so requests that name `gpt-5-nano` or `gpt-5-mini` will fail after that date. The gateway call examples below now use `gpt-6-luna`, a small OpenAI model in the gateway catalog ($0.10 input, $0.50 output per million tokens). The image agent in the [repo](https://github.com/The-DevOps-Daily/neon-ai-agent) now runs on `gpt-5-4-mini` instead of `gpt-5-mini`, because the gateway catalog lists image generation for it. The response and the price chart below are from June and still show `gpt-5-nano`.

**Updated 23 November 2026:** this build ran on the June 2026 private preview. On 17 September 2026 [Functions, Object Storage, the AI Gateway, and Managed Better Auth became generally available](https://neon.com/blog/neon-backend-is-ga), on every plan including Free. The `us-east-2`, new-projects-only limits below are gone: Functions, Object Storage, and the AI Gateway now run in four AWS regions (N. Virginia, Ohio, Frankfurt, Singapore; see [availability by region](https://neon.com/docs/introduction/regions)), and AI Gateway pricing is now documented as provider list prices with no markup. The build log itself is unchanged.
:::

A working AI agent has an unglamorous shopping list. It needs a database to remember things, somewhere to run that can stream tokens without timing out, object storage for whatever it produces, and access to a model. Assembled the usual way, that is four separate signups: a Postgres host, a compute platform, an S3 bucket, and an OpenAI or Anthropic account, each with its own credential to provision, inject, and rotate per environment.

Neon's June 2026 preview of its backend services collapses that list. The pitch is that the database, the compute, the storage, and the model gateway all come from one account and branch together. I wanted to know if that was real or a slide, so I built the canonical example end to end: an image-generating agent that takes a prompt, calls a model, stores the result, and indexes it in Postgres. This is the build log, with the real commands and output, and the parts where the preview still shows.

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

`neon link` creates and attaches a Neon project. When I built this in June 2026, these features were a private preview with two constraints: everything was in AWS `us-east-2`, and it only worked on projects created inside the preview. Both limits were lifted at GA in September 2026; today you create the project in one of the four regions that run Functions, Object Storage, and the AI Gateway.

Then `neon deploy` reads `neon.ts` and provisions the declared services. Here is the whole sequence, link through deploy:

```terminal
{
  "title": "link + deploy",
  "steps": [
    { "comment": "create the project (us-east-2 in June 2026)" },
    { "cmd": "neonctl link --project-name ai-agent --region-id aws-us-east-2", "output": "Created project (\"ai-agent\") in aws-us-east-2 and linked .neon on branch main" },
    { "comment": "read neon.ts and provision everything it declares" },
    { "cmd": "neonctl deploy", "output": "Applied changes\n  create  service  bucket:images\n  create  service  function:imagegen\n\nFunction URLs\n  imagegen: https://br-green-star-...-imagegen.compute.c-3.us-east-2.aws.neon.tech/\n\nUtilized services: Postgres, Object Storage, Functions, AI Gateway\nPulled 11 Neon variables into .env.local" }
  ]
}
```

That last line is the actual product. Eleven environment variables (the `DATABASE_URL`, the S3 access key/secret/endpoint, and the AI gateway token and base URL) all written for me, all scoped to this branch. The four credentials I would normally collect from four dashboards arrived from one `deploy`.

## The model call: one credential, any provider

The AI Gateway is OpenAI-compatible. Your existing SDK works by changing only the base URL, so the same chat completion against a cheap catalog model looks like this in whatever you already use:

```tabs
{
  "title": "Same gateway call, three SDKs (only the base URL changes)",
  "tabs": [
    { "label": "curl", "lang": "bash", "code": "curl \"$NEON_AI_GATEWAY_BASE_URL/ai-gateway/mlflow/v1/chat/completions\" \\\n  -H \"Authorization: Bearer $NEON_AI_GATEWAY_TOKEN\" \\\n  -d '{\"model\":\"gpt-6-luna\",\"messages\":[\n        {\"role\":\"user\",\"content\":\"What is Neon branching?\"}]}'" },
    { "label": "Python", "lang": "python", "code": "from openai import OpenAI\n\nclient = OpenAI(base_url=GATEWAY_URL, api_key=GATEWAY_TOKEN)\nclient.chat.completions.create(\n    model=\"gpt-6-luna\",\n    messages=[{\"role\": \"user\", \"content\": \"What is Neon branching?\"}],\n)" },
    { "label": "Node", "lang": "javascript", "code": "import OpenAI from 'openai';\n\nconst client = new OpenAI({ baseURL: GATEWAY_URL, apiKey: GATEWAY_TOKEN });\nawait client.chat.completions.create({\n  model: 'gpt-6-luna',\n  messages: [{ role: 'user', content: 'What is Neon branching?' }],\n});" }
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

From an empty directory to a deployed agent that generates an image, stores it, and indexes it in Postgres took a few minutes and exactly one credential. The model call, the file write, and the database insert were all wired by Neon, not by me.

## Where it showed the preview

The build was smooth, but in June 2026 it was a private preview, and a few seams were worth knowing before you plan around it. Where that changed since, it says so.

:::warning
**One region, new projects only (June 2026).** Everything was in AWS `us-east-2` and only worked on projects created inside the preview. That limit was lifted at GA: check [product availability by region](https://neon.com/docs/introduction/regions) for where each service runs, since a project's region cannot be changed.
:::

- **Functions are request/response, not a job runner.** Great for the agent's synchronous loop and streaming; queues and retries still belong to something like Inngest or QStash. Schedules no longer do: since September 2026 [Function Triggers](https://neon.com/docs/compute/functions/triggers/overview) run a function on a cron schedule or when a file lands in a bucket.
- **Two gateway dialects, and it matters.** The `OPENAI_BASE_URL` Neon injects points at the OpenAI *Responses* API route. A plain chat-completions call needs the `mlflow` dialect route instead. I hit a `404` until I switched routes. The SKILL docs the template ships actually explain this, which is the kind of detail that saves you ten minutes if you read it first.
- **Billing was half-public at preview.** It is documented now: Neon's [plans page](https://neon.com/docs/introduction/plans) says AI Gateway prices match each provider's list prices with no markup, drawn from prepaid credits.
- **The convenience is also coupling.** One config file declaring your functions, buckets, and gateway is, by design, Neon-shaped. The S3-compatible API and standard SDKs keep the exit ramps wide, but this is a bet on one vendor for four things you used to buy separately.

## So is it real?

Yes. The asterisk for "preview" is gone since September 2026. The useful part is not any single feature, it is that the four pieces an agent needs arrive together, branch together, and authenticate with one credential. If you have ever spent the first afternoon of an AI side project wiring a database to a compute host to an S3 bucket to a model provider, collapsing that into one `neon.ts` and one `deploy` is a real reduction in moving parts.

Whether you should build on it depends on your appetite for vendor consolidation. But as a statement of direction, an agent stack from one CLI is a clear one. We dig into the strategy behind it in [Neon is becoming a backend platform, not just Postgres](https://devops-daily.com/posts/neon-backend-platform-not-just-postgres), and we benchmark the database side in the [Neon vs Supabase series](https://devops-daily.com/posts/neon-vs-supabase-free-tier-benchmarks). These features left preview in September 2026, and we keep testing them the same way: real projects, real output, and the demo code published so you can run it yourself.

The full project is on GitHub. Clone it, point `neonctl` at a new project in a [region that runs Functions](https://neon.com/docs/introduction/regions) (we used `us-east-2`), and `deploy`:

```github
https://github.com/The-DevOps-Daily/neon-ai-agent
```
