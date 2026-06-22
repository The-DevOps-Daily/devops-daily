---
title: 'Your First Serverless LLM Call on DigitalOcean in 10 Minutes'
excerpt: 'DigitalOcean''s Inference Engine gives you an OpenAI-compatible endpoint with pay-per-token pricing and no GPU to manage. Here is the fastest path from zero to a working call, with curl, Python, and Node, every snippet run against the live API.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-06-22'
publishedAt: '2026-06-22T14:00:00Z'
updatedAt: '2026-06-22T14:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - ai
  - digitalocean
  - llm
  - inference
  - tutorial
---

> In partnership with DigitalOcean. The walkthrough below is hands-on and unedited: every request and response was run against the live Inference Engine while writing this.

Most "get started with AI" guides assume you want to stand up a GPU, pick a serving framework, and babysit it. For a lot of real work you do not. You want to send a prompt and get a completion back, pay for the tokens you used, and move on. That is what DigitalOcean's **Inference Engine** (part of its AI-Native Cloud) gives you: an OpenAI-compatible endpoint, a catalog of hosted models, pay-per-token billing, and no GPU to provision or scale.

Because the API speaks the OpenAI dialect, the practical version of "getting started" is mostly changing a base URL. This post takes you from nothing to a working call in about ten minutes, with curl, the OpenAI Python SDK, and the OpenAI Node SDK. Every snippet here was run against the live endpoint, so the responses and token counts you see are real.

## What you need

- A DigitalOcean account.
- A couple of minutes to create a model access key.
- curl, or Python 3, or Node, depending on which example you follow.

That is the whole list. There is no GPU Droplet to create for this; serverless inference pools GPU capacity behind the endpoint and you pay only for tokens.

## Step 1: Create a model access key

In the DigitalOcean Control Panel, open the AI / Inference area and go to **Model Access Keys**, then **Create model access key**. Give it a name, and choose **All models** so the key can call any model in the catalog (you can scope a key to specific models later for production).

One setting is worth understanding before you click create: a model access key can be **bound to a VPC**. A VPC-scoped key only works for requests that originate from inside that DigitalOcean private network, which is exactly what you want in production (a leaked key is useless from the public internet). For this walkthrough, where you are calling from your laptop, leave the VPC restriction off, or you will get a `403 Forbidden` no matter how correct the rest of your request is. More on that in the troubleshooting note at the end.

Copy the key when it is shown and keep it somewhere safe. Then put it in your shell so the examples can read it:

```bash
export DO_INFERENCE_KEY="paste-your-key-here"
```

Treat this like any other secret: environment variable or secrets manager, never committed to a repo or pasted into frontend code.

## Step 2: Your first call with curl

The endpoint lives at `https://inference.do-ai.run/v1` and mirrors the OpenAI chat completions API. We will use `openai-gpt-oss-20b`, the cheapest text model in the catalog, which is plenty for a first call:

```bash
curl https://inference.do-ai.run/v1/chat/completions \
  -H "Authorization: Bearer $DO_INFERENCE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai-gpt-oss-20b",
    "messages": [
      {"role": "system", "content": "You are a concise assistant."},
      {"role": "user", "content": "In one sentence, what is a reverse proxy?"}
    ],
    "max_tokens": 80
  }'
```

The response is the standard OpenAI shape. Here is the real one this returned, trimmed for readability:

```json
{
  "object": "chat.completion",
  "model": "openai-gpt-oss-20b",
  "choices": [
    {
      "index": 0,
      "finish_reason": "stop",
      "message": {
        "role": "assistant",
        "content": "A reverse proxy is a server that sits between clients and backend servers, receiving client requests and forwarding them to appropriate internal services while returning the responses, thereby abstracting and protecting the internal infrastructure."
      }
    }
  ],
  "usage": {
    "prompt_tokens": 87,
    "completion_tokens": 74,
    "total_tokens": 161
  }
}
```

That is the entire round trip. No GPU, no model download, no cold-start wait you had to manage.

## Step 3: The same call with the OpenAI Python SDK

Because the API is OpenAI-compatible, you use the official `openai` library and point it at DigitalOcean by setting `base_url`. Nothing else about your code changes.

```bash
pip install openai
```

```python
import os
from openai import OpenAI

client = OpenAI(
    base_url="https://inference.do-ai.run/v1",
    api_key=os.environ["DO_INFERENCE_KEY"],
)

resp = client.chat.completions.create(
    model="openai-gpt-oss-20b",
    messages=[
        {"role": "system", "content": "You are a concise assistant."},
        {"role": "user", "content": "In one sentence, what is a reverse proxy?"},
    ],
    max_tokens=80,
)

print(resp.choices[0].message.content)
print(resp.usage.prompt_tokens, "in /", resp.usage.completion_tokens, "out")
```

Run against the live endpoint (tested with `openai` 2.43.0), this printed:

```text
A reverse proxy is a server that lies between clients and backend servers,
forwarding client requests to those servers and returning the servers' responses
back to the clients.
87 in / 91 out
```

If you have an existing app built on the OpenAI SDK, this is the whole migration: change `base_url`, change the API key, change the model name.

## Step 4: The same call with the OpenAI Node SDK

Identical story in JavaScript. Install the SDK and set `baseURL`:

```bash
npm install openai
```

```javascript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://inference.do-ai.run/v1",
  apiKey: process.env.DO_INFERENCE_KEY,
});

const resp = await client.chat.completions.create({
  model: "openai-gpt-oss-20b",
  messages: [
    { role: "system", content: "You are a concise assistant." },
    { role: "user", content: "In one sentence, what is a reverse proxy?" },
  ],
  max_tokens: 80,
});

console.log(resp.choices[0].message.content);
console.log(resp.usage.prompt_tokens, "in /", resp.usage.completion_tokens, "out");
```

Tested with `openai` 6.44.0 for Node, this returned:

```text
A reverse proxy is a server that sits between clients and backend servers,
forwarding client requests to the appropriate server and returning the server's
response, often providing load balancing, SSL termination, or caching.
87 in / 62 out
```

## Reading the response

Two fields are worth knowing about beyond the obvious `content`:

- **`usage`** is how you reason about cost. Every call reports `prompt_tokens`, `completion_tokens`, and `total_tokens`. Billing is per token, so this object is your meter.
- The `gpt-oss` models also return a `reasoning_content` field alongside `content`, holding the model's intermediate reasoning. You usually render `content` to users and keep `reasoning_content` for debugging or logging.

To see the full catalog of model slugs you can pass as `model`, hit the models endpoint:

```bash
curl https://inference.do-ai.run/v1/models \
  -H "Authorization: Bearer $DO_INFERENCE_KEY"
```

At the time of writing that returns 67 models, spanning OpenAI (`openai-gpt-5.5`, `openai-gpt-4o-mini`, the open `openai-gpt-oss-20b` and `openai-gpt-oss-120b`), Anthropic (`anthropic-claude-opus-4.8`, `anthropic-claude-4.6-sonnet`, `anthropic-claude-haiku-4.5`), Meta Llama, Mistral, DeepSeek, NVIDIA Nemotron, and embedding and image models. Switching models is a one-string change.

## What it costs

The model we used, `gpt-oss-20b`, is billed at **$0.05 per 1M input tokens and $0.45 per 1M output tokens**. The call in Step 2 used 87 input and 74 output tokens, which works out to about four thousandths of a cent. You can run this tutorial hundreds of times before it rounds up to a penny.

The pricing model matters as much as the number. You pay per token, not per GPU-hour, because serverless inference pools GPU capacity across customers, so an idle app costs nothing. DigitalOcean also applies a small off-peak discount on eligible open models during overnight hours, which is worth knowing if you run large batch jobs you can schedule.

## A note on that 403 (VPC scoping)

If your very first call comes back as `403 Forbidden` even though the key is correct and has access to all models, check whether the key is bound to a VPC. A VPC-scoped key is rejected for any request that does not originate inside that private network. That is a feature, not a bug: in production you want your inference key locked to your VPC so it cannot be used from anywhere else. For local testing from your laptop, create a key with no VPC restriction (and delete it when you are done), or run your test from a Droplet inside the VPC.

It is a good habit to adopt the moment you go past experimenting: scope the production key to your VPC, scope it to only the models you actually call, and set an expiration date.

## Where to go next

You now have a working, OpenAI-compatible LLM call with nothing to operate. From here:

- **Swap the model** to match the task. Use a small open model like `gpt-oss-20b` for cheap, high-volume work and a frontier model for the hard prompts, changing one string.
- **Add retrieval** with DigitalOcean's Knowledge Bases and managed Weaviate when you need answers grounded in your own data.
- **Reach for dedicated inference** if you need predictable latency for a single model under steady load, rather than the pooled serverless tier.
- **Build an agent** when a single call is not enough. If you go that route, our take on [what AI SRE agents actually fix and what they break](https://devops-daily.com/posts/ai-sre-agents-what-they-fix-and-break) is worth reading before you give one access to anything that matters.

The thing that makes this approachable is the same thing that makes it easy to leave if you ever want to: it is just the OpenAI API with a different base URL. Start with the cheap model and a curl command, and grow into the rest only when a real requirement asks for it.
