---
title: 'Swapping Across 25 Models With One Line'
excerpt: 'Choosing a model is usually a commitment: an SDK, a key, an integration. Through the gateway it is a string, so you can shop the whole catalog per task. And the catalog spans a 100x price range, which turns model choice into your biggest cost lever. Here is the swap, the price spread, and a real multi-model run.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-07-18'
publishedAt: '2026-07-18T09:00:00Z'
updatedAt: '2026-07-18T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - neon
  - ai-gateway
  - llm
  - finops
  - serverless
  - functions
---

Picking a model usually feels like a decision you have to live with. You install that provider's SDK, wire in its key, learn its quirks, and the choice is baked into your code. Switching later is a small migration, so most teams pick one model and stick with it even when a cheaper or better one would suit a given task.

Through an AI gateway, the model is just a string in the request. The gateway exposes around 25 models across OpenAI, Anthropic, and Google, and moving between any of them is a one-token change with the same code and the same credential. That matters more than convenience, because the catalog spans a roughly 100x price range. When swapping is free, model choice stops being a one-time architecture decision and becomes a per-task cost lever. This post shows the swap, the price spread that makes it worth caring about, and a real run across several models. The [repo](https://github.com/The-DevOps-Daily/neon-ai-gateway-demo) is at the end.

## TL;DR

- Through the gateway, changing model is changing the `model` string. Same code, same credential, roughly 25 models across three providers.
- The catalog spans about 100x in price, from cheap small models to flagship ones, so which model you pick is usually your biggest cost knob.
- The move is to route by task: a cheap model for classification and extraction, a strong one for hard reasoning, all behind one call.
- Same code does not mean same output. Swapping is trivial; validating that a cheaper model is good enough for your prompt is the actual work.

## Prerequisites

- A Neon project with the AI gateway enabled (`us-east-2`)
- Familiarity with chat-completions requests

## The swap is one line

Every model is the same request; only the `model` field changes:

```typescript
// Same function, same credential. The model is data.
await callGateway('gpt-5-nano', prompt, maxTokens);       // OpenAI, cheapest
await callGateway('gemini-2-5-flash', prompt, maxTokens); // Google
await callGateway('claude-haiku-4-5', prompt, maxTokens); // Anthropic
await callGateway('claude-opus-4-5', prompt, maxTokens);  // Anthropic, flagship
```

Because the chain is data, the model can come from config, a per-tenant setting, or a routing decision made at request time. Nothing about the integration changes when you pick a different one.

## Why the swap is worth caring about: the price spread

Convenience alone would be a footnote. The reason to actually use this is that the models are priced across a huge range, so the same request can cost wildly different amounts depending on which one you send it to.

```chart
{
  "type": "bar",
  "title": "Gateway model prices, per 1M tokens",
  "unit": "$",
  "caption": "List prices from models.dev/providers/neon, per 1M input / output tokens (subject to change). Note the ~100x spread from nano to opus.",
  "rows": [
    { "label": "gpt-5-nano", "value": 0.05, "series": "input" },
    { "label": "gpt-5-nano", "value": 0.40, "series": "output" },
    { "label": "gemini-2-5-flash", "value": 0.30, "series": "input" },
    { "label": "gemini-2-5-flash", "value": 2.50, "series": "output" },
    { "label": "claude-haiku-4-5", "value": 1.0, "series": "input" },
    { "label": "claude-haiku-4-5", "value": 5.0, "series": "output" },
    { "label": "claude-opus-4-5", "value": 5.0, "series": "input" },
    { "label": "claude-opus-4-5", "value": 25.0, "series": "output" }
  ],
  "series": [
    { "name": "input", "color": "#94a3b8" },
    { "name": "output", "color": "#f59e0b" }
  ]
}
```

Output tokens on the flagship run about 60x the cheapest small model. So a high-volume, low-difficulty workload, classifying support tickets, extracting fields, tagging content, that you route to a flagship out of habit is potentially a large bill for no benefit, and routing it to a small model is a one-word change.

## The proof: one prompt, several models

I sent the same question through several models on the deployed function. Same code, same credential, just a different `model` each time, with the real token counts the gateway returned.

```terminal
{
  "title": "same prompt, swap the model",
  "prompt": "$",
  "steps": [
    { "cmd": "curl -s $URL/chat -d '{\"model\":\"gpt-5-nano\",\"prompt\":\"Capital of France?\"}'", "output": "{ \"model\": \"gpt-5-nano\", \"content\": \"Paris\", \"usage\": { \"total_tokens\": 25 } }" },
    { "cmd": "curl -s $URL/chat -d '{\"model\":\"gemini-2-5-flash\",\"prompt\":\"Capital of France?\"}'", "output": "{ \"model\": \"gemini-2-5-flash\", \"content\": \"Paris\", \"usage\": { \"total_tokens\": 37 } }" },
    { "cmd": "curl -s $URL/chat -d '{\"model\":\"claude-haiku-4-5\",\"prompt\":\"Capital of France?\"}'", "output": "{ \"model\": \"claude-haiku-4-5\", \"content\": \"Paris\", \"usage\": { \"total_tokens\": 20 } }" }
  ]
}
```

For a trivial prompt like this, all three give the same answer, which is exactly the point: when a small model is good enough, the swap is the whole optimization. The harder your task, the more the model matters, and the gateway lets you find where the line is by trying, cheaply, on your own prompts.

## How to actually use it

- **Default cheap, escalate deliberately.** Send the common case to a small model; route the genuinely hard requests to a bigger one. Because the split is a string per request, the policy is easy to change.
- **Benchmark on your prompts.** The only way to know a cheaper model holds up is to run your real prompts through it. Swapping being free is what makes that measurement cheap.
- **Keep the choice in config.** Put the model per task or per tenant in config so you can retune without a deploy.

:::warning
Same code is not same behavior. Models differ in output quality, formatting, instruction-following, and latency, so a swap that saves money can quietly cost accuracy. Treat a model change like any other change: measure it on your prompts before you ship it. And remember the mechanics from earlier in this series, GPT-5 models use `max_completion_tokens` while others use `max_tokens`, and IDs use dashes.
:::

## The repo

The function that makes the model a request field is here:

```github
https://github.com/The-DevOps-Daily/neon-ai-gateway-demo
```

## Wrapping up

The gateway turns model choice from an architecture decision into a request parameter, and the 100x price spread across the catalog is what makes that worth using rather than just neat. Route each task to the cheapest model that is good enough, escalate the hard ones on purpose, and keep the policy in config so you can retune as prices and models move. The swap is one line; the work that pays off is measuring, cheaply now, which line to draw.
