---
title: 'Model Fallback and Routing Without a Provider SDK Each'
excerpt: 'Models have outages, rate limits, and bad minutes. A resilient app falls back to another one, but building that across providers normally means a different SDK and error shape for each. Through one OpenAI-compatible gateway, fallback is a loop over model names. Here it is, tested against a real failure.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-07-14'
publishedAt: '2026-07-14T09:00:00Z'
updatedAt: '2026-07-14T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - neon
  - ai-gateway
  - llm
  - resilience
  - serverless
  - functions
---

Model providers go down. They rate-limit you, they have capacity blips, a specific model gets deprecated, and sometimes a request just fails. If a model call is on a path your users care about, you want a fallback: if the first model errors, try another, ideally from a different provider so a single vendor's bad day does not become yours.

The problem is that building that fallback the usual way means owning the differences between providers. Each has its own SDK with its own client setup, its own error classes, and its own idea of what a retryable failure looks like. Your fallback logic ends up as a stack of provider-specific `try/catch` blocks that all have to stay correct. Through an OpenAI-compatible gateway, the differences are gone: every model is the same request shape and the same HTTP error, so fallback is a plain loop over model names. I built it on a Neon Function and tested it against a real failing model. The [repo](https://github.com/The-DevOps-Daily/neon-ai-gateway-demo) is at the end.

## TL;DR

- Cross-provider fallback with per-provider SDKs means different client setup and different error handling for each. It is fragile and it is a lot of code.
- Through one gateway, every model is the same request and the same HTTP status, so fallback is a loop: try the next model when the current one errors.
- I tested it: a request to `["not-a-real-model", "claude-haiku-4-5"]` failed the first, fell back to Claude, and returned the answer plus a record of what it tried.
- The same loop is a routing primitive: try a cheap model first and escalate, or order the chain by cost, latency, or capability.

## Prerequisites

- A Neon project with the AI gateway enabled (`us-east-2`)
- Familiarity with calling a chat-completions API and with basic retry logic

## The usual way, and why it hurts

Suppose you want "try GPT, fall back to Claude." With provider SDKs, that is two clients, two ways of reading an error, and two mental models:

```typescript
// The shape you end up with when each provider has its own SDK.
try {
  return await openai.chat.completions.create({ model: 'gpt-5-nano', messages });
} catch (err) {
  if (isRetryable(err)) {
    // Different SDK, different client, different error type, different options.
    return await anthropic.messages.create({ model: 'claude-haiku-4-5', ... });
  }
  throw err;
}
```

Add a third provider and it gets worse, not linearly but combinatorially, because each new fallback target is a new SDK with new error semantics to special-case. The logic that decides whether to fall back is now tangled up with the logic of talking to each vendor.

## The gateway way: a loop

Through the gateway, every model is the same POST and the same HTTP status code, so the decision to fall back is uniform. Order your models, try them in turn, and stop at the first success:

```typescript
async function chatWithFallback(models: string[], prompt: string, maxTokens: number) {
  const tried: { model: string; status: number }[] = [];
  for (const model of models) {
    const result = await callGateway(model, prompt, maxTokens); // same call for every model
    tried.push({ model, status: result.status });
    if (result.ok) return { model, content: result.content, usage: result.usage, tried };
  }
  throw new Error(`all models failed: ${JSON.stringify(tried)}`);
}
```

There is one `callGateway` for every provider, so there is one place errors can come from and one place to handle them. Adding a fourth or fifth fallback is adding a string to the array.

## The proof: a real failure and recovery

I sent a request whose first model does not exist, followed by a real one. The gateway returned a `400` for the bad model, the loop moved on, and Claude answered. The response includes what it tried, so the fallback is observable.

```terminal
{
  "title": "primary fails, fall back to the next",
  "prompt": "$",
  "steps": [
    { "comment": "first model is bogus, second is real; ask for a fallback chain" },
    { "cmd": "curl -s $URL/chat -d '{\"models\":[\"not-a-real-model\",\"claude-haiku-4-5\"],\"prompt\":\"Say hi in 3 words.\"}'", "output": "{\n  \"model\": \"claude-haiku-4-5\",\n  \"content\": \"Hi, how are you?\",\n  \"usage\": { \"total_tokens\": 24 },\n  \"tried\": [\n    { \"model\": \"not-a-real-model\", \"status\": 400 },\n    { \"model\": \"claude-haiku-4-5\", \"status\": 200 }\n  ]\n}" }
  ]
}
```

The `tried` array is the important part. The first model returned `400`, the loop advanced, and the second returned `200` with the answer. In production that `tried` record is what tells you a fallback happened, so you can alert on how often you are running on the backup.

## Fallback is just routing

Once "pick a model from an ordered list" is a loop, you have a routing primitive, not only a failure handler. The same shape covers:

- **Cost-first.** Put the cheapest capable model first and only escalate when it fails. Most requests never reach the expensive one.
- **Latency-first.** Put the fastest model first for interactive paths.
- **Capability-first.** Route long-context or tool-use requests to a bigger model and everything else to a small one, by choosing the order per request.

The chain is data, so the routing policy can live in config or be computed per request without touching the call site.

:::tip
Two things to keep honest. Fallback hides failures by design, so log the `tried` record and alert when the backup is used a lot; a silent fallback is a silent outage. And fall back to a comparable model, not a much weaker one, or your users get a quietly worse answer during the incident instead of an error they would have noticed.
:::

## The repo

The fallback loop and the single `callGateway` it uses are here:

```github
https://github.com/The-DevOps-Daily/neon-ai-gateway-demo
```

## Wrapping up

Cross-provider fallback earns its reputation for being fiddly only because each provider brings its own SDK and error model. Put a gateway in front and that goes away: one request shape, one status code, and fallback becomes a loop over an ordered list of model names. That same list is a routing knob, cost, latency, or capability first, so the resilience you added for outages doubles as the mechanism for sending each request to the right model.
