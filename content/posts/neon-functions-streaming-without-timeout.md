---
title: 'Streaming an AI Agent Without a Function Timeout'
excerpt: 'Long agent loops and long token streams run into the same wall: a serverless function that hits its execution cap and cuts the connection. Neon Functions hold long-lived streaming connections by default. I deployed two endpoints to prove it: one streamed for 90 seconds, the other streamed an agent token by token starting at 466 ms.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-06-27'
publishedAt: '2026-06-27T14:00:00Z'
updatedAt: '2026-06-27T14:00:00Z'
readingTime: '9 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - neon
  - serverless
  - ai-agents
  - streaming
  - functions
---

An AI agent and a serverless function want different things. The agent wants to think, call a tool, stream some tokens, call another tool, and keep the connection open the whole time, which can be tens of seconds or more. A lot of serverless tiers want the opposite: do your work quickly and return, because the invocation has an execution cap. Put them together and you get the failure everyone who has shipped an agent has seen at least once: the response is still streaming when the platform decides time is up and closes the socket.

This is the second post in our series on [Neon Functions](https://neon.com/docs/compute/functions/overview). The first was about [where your compute runs relative to your data](https://devops-daily.com/posts/neon-functions-compute-on-your-database-branch); this one is about how long it is allowed to keep talking. Neon Functions are built to hold long-lived streaming connections, so a slow agent or a long stream is a normal request, not a fight with a timeout. To show it rather than assert it, I deployed two endpoints and measured them.

(Companion repo, deploy it yourself: [The-DevOps-Daily/neon-streaming-demo](https://github.com/The-DevOps-Daily/neon-streaming-demo).)

## Two endpoints, one config

The whole backend is a single Hono function with the AI Gateway switched on in `neon.ts`:

```ts
import { defineConfig } from '@neondatabase/config/v1';

export default defineConfig({
  preview: {
    aiGateway: true,
    functions: {
      stream: { name: 'streaming demo', source: 'src/index.ts' },
    },
  },
});
```

```terminal
{
  "title": "deploy the streaming function",
  "steps": [
    { "cmd": "neonctl link --project-name streaming --region-id aws-us-east-2", "output": "Created project (\"streaming\") in aws-us-east-2 and linked .neon" },
    { "cmd": "neonctl deploy", "output": "Applied changes\n  create  service  function:stream\n\nFunction URLs\n  stream: https://br-...-stream.compute.c-3.us-east-2.aws.neon.tech/\n\nUtilized services: Postgres, Functions, AI Gateway\nPulled 7 Neon variables into .env.local" }
  ]
}
```

The streaming itself is ordinary Hono. The first endpoint holds a server-sent-events connection open and emits a tick every second, for as many seconds as you ask:

```ts
import { streamSSE } from 'hono/streaming';

app.get('/long-stream', (c) => {
  const seconds = Math.min(600, Math.max(1, Number(c.req.query('seconds') ?? '90')));
  const start = Date.now();
  return streamSSE(c, async (stream) => {
    for (let i = 1; i <= seconds; i++) {
      await stream.writeSSE({ event: 'tick', data: JSON.stringify({ tick: i, elapsed_ms: Date.now() - start }) });
      await stream.sleep(1000);
    }
    await stream.writeSSE({ event: 'done', data: JSON.stringify({ ticks: seconds }) });
  });
});
```

## It streamed for 90 seconds without being asked twice

I called `/long-stream?seconds=90` and let it run. It ticked once a second, on the second, for a minute and a half, and closed cleanly on its own terms:

```terminal
{
  "title": "curl -N .../long-stream?seconds=90",
  "prompt": ">",
  "steps": [
    { "output": "event: tick   data: {\"tick\":1,\"elapsed_ms\":0}" },
    { "output": "event: tick   data: {\"tick\":10,\"elapsed_ms\":9012}" },
    { "output": "event: tick   data: {\"tick\":30,\"elapsed_ms\":29034}" },
    { "output": "event: tick   data: {\"tick\":60,\"elapsed_ms\":59066}" },
    { "output": "event: tick   data: {\"tick\":90,\"elapsed_ms\":89099}" },
    { "output": "event: done   data: {\"ticks\":90,\"total_ms\":90099}" }
  ]
}
```

Ninety seconds is not a magic number; I picked it because it is comfortably past the execution cap a lot of serverless functions ship with by default, and the function did not care. No special mode, no config flag, no "streaming response" opt-in. The handler just held the connection.

:::note
To be precise about the comparison: this is about defaults and design, not "infinite versus finite." Traditional serverless functions cap a single invocation low by default (Vercel's Hobby tier at 10 seconds, Pro at 60), which is exactly where a slow agent gets cut off. Platforms do offer longer runs when you reach for them: Vercel's Fluid Compute extends to 300 to 1800 seconds, and AWS Lambda allows up to 15 minutes. The point is that long-lived streaming is the default behaviour of a Neon Function, not a setting you discover after your agent times out in production.
:::

## Now stream an actual agent

A ticking clock proves the connection lasts. The real workload is a model streaming tokens. The second endpoint sends the prompt to the [Neon AI Gateway](https://neon.com/docs/ai-gateway/overview) with `stream: true` and relays each token to the caller as it arrives:

```ts
const upstream = await fetch(`${process.env.NEON_AI_GATEWAY_BASE_URL}/ai-gateway/mlflow/v1/chat/completions`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${process.env.NEON_AI_GATEWAY_TOKEN}`, 'content-type': 'application/json' },
  body: JSON.stringify({ model: 'gpt-5-nano', stream: true, messages }),
});
// ...parse the upstream SSE and re-emit each delta as it lands
await stream.writeSSE({ event: 'token', data: JSON.stringify({ delta }) });
```

Calling it with a small prompt, the first token came back at **466 ms** and the full 62-token reply finished at about **2.0 seconds**. The reader sees the answer forming almost immediately instead of waiting two seconds for a wall of text:

```chart
{
  "type": "bar",
  "title": "Streaming vs waiting: when you see the agent's reply",
  "unit": "s",
  "caption": "POST /agent, gpt-5-nano through the Neon AI Gateway, 62 tokens. Streaming means the first token lands at ~0.47s; without streaming the reader waits for the whole ~2.0s reply. The gap grows with longer answers and multi-step agents.",
  "rows": [
    { "label": "First token visible (streaming)", "value": 0.47 },
    { "label": "Whole reply (no streaming)", "value": 2.0 }
  ]
}
```

Two seconds is short because the model and the prompt are small. The reason this matters is that real agents are not short: they make several model calls, run tools between them, and a full run is routinely tens of seconds. On a platform that caps invocations at 10 or 60 seconds, that run is a gamble against the clock. On a function built to hold the stream, it is just a request that takes a while.

## What it is, and what it is not

:::warning
**Private preview, one region, new projects only.** Everything is in AWS `us-east-2` and only works on projects created inside the preview. Plan accordingly before building on it.
:::

Two more things worth knowing before you reach for this:

- **It is request/response, even when the response is long.** These functions answer a caller and can keep streaming to it for a long time, including over WebSockets and SSE. They are not a background job runner. Work that should outlive the request (queues, retries, scheduled tasks) belongs to something like Inngest or QStash.
- **Idle functions can be evicted.** A long *active* stream is fine; a function sitting idle may be scaled to zero and cold-start on the next call. That is the usual serverless tradeoff, not a streaming-specific one.

## Who this is for

If you are shipping anything agentic (a chat assistant, a tool-using agent, a long generation, an MCP server holding a session), the timeout is the wall you hit first, and the usual workaround is to learn your platform's extended-duration mode and hope you configured it right. A function that holds the stream by default removes that whole category of "why did my response get cut off" debugging.

The full demo, both endpoints, is here. The streaming logic is about 80 lines:

```github
https://github.com/The-DevOps-Daily/neon-streaming-demo
```

Next in the series: a Postgres-backed MCP server in about twenty lines, and preview environments that include the backend, not just the frontend. The strategy behind all of it is in [Neon is becoming a backend platform, not just Postgres](https://devops-daily.com/posts/neon-backend-platform-not-just-postgres).
