---
title: 'One Key for Claude, GPT, and Gemini: the Gateway Pattern'
excerpt: 'Using three model providers usually means three API keys, three SDKs, and three billing relationships sprayed across your code. An AI gateway collapses that to one credential and one OpenAI-compatible endpoint. I proved it on a Neon Function: the same call answered by GPT, Claude, and Gemini.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-07-12'
publishedAt: '2026-07-12T09:00:00Z'
updatedAt: '2026-07-12T09:00:00Z'
readingTime: '9 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - neon
  - ai-gateway
  - llm
  - serverless
  - functions
  - ai-agents
---

The moment an app talks to more than one model provider, the plumbing multiplies. OpenAI wants its key and its SDK. Anthropic wants a different key and a different SDK. Google wants a third of each. Now you have three secrets to store and rotate, three client libraries to keep updated, three billing relationships to reconcile, and conditional code that picks the right one. None of that is your product; it is the cost of wanting a choice of models.

The AI gateway pattern removes it. You talk to one endpoint with one credential, and the gateway routes to whichever model you name. Because the endpoint is OpenAI-compatible, the code you already wrote for OpenAI reaches Claude and Gemini too, just by changing the `model` string. On Neon, the gateway credential is injected straight into your function, so there is not even a key to manage. To make sure this is real and not a diagram, I sent the same request through a Neon Function to three providers and watched all three answer. The [repo](https://github.com/The-DevOps-Daily/neon-ai-gateway-demo) is at the end.

## TL;DR

- Multiple providers normally means multiple keys, SDKs, and bills. A gateway is one credential and one OpenAI-compatible endpoint that routes to any model.
- On Neon, set `aiGateway: true` in `neon.ts`; the runtime injects `NEON_AI_GATEWAY_TOKEN` and `NEON_AI_GATEWAY_BASE_URL` into the function.
- I tested it: the same `/chat` handler answered "Paris" through `gpt-5-nano`, `claude-haiku-4-5`, and `gemini-2-5-flash`, with the same code and the same credential.
- One gotcha: GPT-5 models want `max_completion_tokens`, others want `max_tokens`, and model IDs use dashes (`gemini-2-5-flash`, not `gemini-2.5-flash`).

## Prerequisites

- A Neon project on the platform preview with the AI gateway enabled (`us-east-2`)
- The Neon CLI (`npm i -g neon`, then `neon login`)
- Basic familiarity with calling an LLM chat-completions API

## What the gateway pattern is

A gateway sits between your code and the model providers. You send it an OpenAI-shaped chat request with a `model` field; it authenticates you once, forwards the request to the right provider, and returns an OpenAI-shaped response. Your application never holds a provider key and never imports a provider SDK. Adding a new model is choosing a different string, not onboarding a new vendor.

```diagram
{
  "type": "graph",
  "title": "one credential in, any model out",
  "columns": [
    [ { "id": "app", "label": "Your code", "sub": "OpenAI-shaped request", "icon": "box", "tone": "blue" } ],
    [ { "id": "gw", "label": "AI Gateway", "sub": "one credential", "icon": "net", "tone": "accent", "detail": "Authenticates you once and forwards to the provider named in the model field. Your code never holds a provider key or imports a provider SDK." } ],
    [
      { "id": "claude", "label": "Claude", "icon": "cpu", "tone": "violet" },
      { "id": "gpt", "label": "GPT", "icon": "cpu", "tone": "green" },
      { "id": "gemini", "label": "Gemini", "icon": "cpu", "tone": "amber" }
    ]
  ],
  "edges": [["app", "gw", "model: ..."], ["gw", "claude"], ["gw", "gpt"], ["gw", "gemini"]]
}
```

That is valuable anywhere, but on serverless it is especially clean, because the function has no long-lived config to hold the keys in. Neon injects the gateway credential at deploy time.

## On Neon: one line of config

Enable it in the branch config:

```typescript
// neon.ts
export default defineConfig({
  preview: {
    aiGateway: true, // injects NEON_AI_GATEWAY_TOKEN + NEON_AI_GATEWAY_BASE_URL
    functions: { chat: { name: 'ai gateway chat', source: 'src/index.ts' } },
  },
});
```

The call is a plain POST to an OpenAI-compatible endpoint. No SDK required:

```typescript
const GATEWAY_URL = `${process.env.NEON_AI_GATEWAY_BASE_URL}/ai-gateway/mlflow/v1/chat/completions`;

async function callGateway(model: string, prompt: string, maxTokens: number) {
  const res = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.NEON_AI_GATEWAY_TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      // GPT-5 models want max_completion_tokens; others want max_tokens.
      ...(model.startsWith('gpt-5')
        ? { max_completion_tokens: maxTokens }
        : { max_tokens: maxTokens }),
    }),
  });
  return res.json();
}
```

Because it is OpenAI-compatible, you can also point the official OpenAI SDK at the gateway's base URL and use it unchanged; the raw `fetch` above just makes the shape obvious.

## The proof: one credential, three providers

I deployed this as a `/chat` handler and asked the same question through three different models. Same code path, same token, three providers, three answers.

```terminal
{
  "title": "same request, three providers, one credential",
  "prompt": "$",
  "steps": [
    { "comment": "OpenAI" },
    { "cmd": "curl -s $URL/chat -d '{\"model\":\"gpt-5-nano\",\"prompt\":\"Capital of France in one word.\"}'", "output": "{ \"model\": \"gpt-5-nano\", \"content\": \"Paris\", \"usage\": { \"total_tokens\": 25 } }" },
    { "comment": "Anthropic" },
    { "cmd": "curl -s $URL/chat -d '{\"model\":\"claude-haiku-4-5\",\"prompt\":\"Capital of France in one word.\"}'", "output": "{ \"model\": \"claude-haiku-4-5\", \"content\": \"Paris\", \"usage\": { \"total_tokens\": 20 } }" },
    { "comment": "Google" },
    { "cmd": "curl -s $URL/chat -d '{\"model\":\"gemini-2-5-flash\",\"prompt\":\"Capital of France in one word.\"}'", "output": "{ \"model\": \"gemini-2-5-flash\", \"content\": \"Paris\", \"usage\": { \"total_tokens\": 37 } }" }
  ]
}
```

Three providers answered through the same handler with the same injected credential. The only thing that changed between calls was the `model` string. There is no OpenAI key, no Anthropic key, and no Google key anywhere in the function.

:::warning
Two real details the demo handles for you. First, the token-limit parameter is not uniform: GPT-5 models require `max_completion_tokens` (and enough of it, since they spend tokens on reasoning before answering), while Claude, Gemini, and `gpt-oss-*` use `max_tokens`. Normalize it per model family. Second, gateway model IDs use dashes: it is `gemini-2-5-flash`, not `gemini-2.5-flash`, and a wrong ID returns a `400 unknown model`.
:::

## Why it is worth adopting

- **One secret, not three.** There is a single credential to store and rotate, and on Neon you do not even hold it; it is injected.
- **No SDK sprawl.** One OpenAI-compatible client reaches every provider. Nothing new to add when you want to try a different one.
- **Trivial to experiment.** Swapping `gpt-5-nano` for `claude-haiku-4-5` is a one-word change, so comparing models on your own prompts costs almost nothing.
- **One bill.** Usage across providers goes through one place instead of three separate invoices to reconcile.

## The repo

The `/chat` function, plus fallback and a per-branch usage log, is here:

```github
https://github.com/The-DevOps-Daily/neon-ai-gateway-demo
```

## Wrapping up

The gateway pattern is a small idea with an outsized payoff: put one authenticated endpoint between your code and the model providers, and the per-provider keys, SDKs, and bills collapse into one of each. On Neon it is one line of config and an injected credential, and the same handler answers through GPT, Claude, and Gemini by changing a string. The rest of this series builds on that single credential: falling back between models, isolating spend per branch, and swapping models by the dozen.
