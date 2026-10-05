---
title: 'Knowing What Your AI Feature Costs Before Finance Does'
excerpt: 'The model invoice has one line per model, and finance wants one line per feature. We ran three features on one key and recorded every usage block: a one-word alert label cost a third to a half of a full incident investigation, because of reasoning tokens nobody reads. Here is how to measure that per request and tag it per feature.'
category:
  name: 'FinOps'
  slug: 'finops'
date: '2026-10-05'
publishedAt: '2026-10-05T09:00:00Z'
updatedAt: '2026-10-05T09:00:00Z'
readingTime: '14 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - FinOps
  - AI
  - LLM
  - OpenTelemetry
  - Cost Allocation
  - DigitalOcean
  - Observability
---

The invoice for your model provider arrives with one line per model. Finance reads it and asks a fair question: which feature spent that? If three features share one API key, the invoice cannot tell you, and neither can the provider dashboard. You find out the hard way, when one of them grows.

We wanted to know how far off the obvious guesses are, so we measured. Three features on one key, two models on [DigitalOcean Serverless Inference](https://www.digitalocean.com/products/inference-engine), 151 recorded calls, and every number below comes from the `usage` block the provider returned. The feature we expected to be expensive was not the problem. The one-word classifier was.

## TLDR

- On Kimi K2.6, an incident answer the engineer read was about 100 tokens long. The request billed about 2,900 tokens, and 928 of them were reasoning tokens that nobody reads.
- A one-word alert label used a median of 566.5 reasoning tokens on Kimi K2.6 and 184.5 on DeepSeek V4.1 Flash, with single calls as high as 1,590 and 1,783. **On mean costs, one label cost between 32 and 48 percent of a full incident investigation.**
- Turning reasoning off for the label (`reasoning_effort: "none"` on Kimi K2.6) cut the cost per 1,000 labels 41 times at list price. It also changed 6 of the 20 labels.
- The agent loop was not the multiplier we expected. In 19 of 20 runs the model asked for all four tools in one step, so an investigation took two calls, not the ten we had feared.
- The same prompt used anywhere from 551 to 1,652 reasoning tokens across ten runs. Per-request cost is a distribution, not a number.
- The fix is one wrapper: every call carries the feature and tenant that caused it, and writes the provider's usage in OpenTelemetry GenAI attribute names.

## Prerequisites

- Node.js 20 or later
- An API key for an OpenAI-compatible endpoint that returns a `usage` block (we used DigitalOcean Serverless Inference)
- A rough idea of per-token pricing: you pay one rate for input tokens and a higher rate for output tokens

The scripts, the fixtures, every raw response's usage and the report are in the companion repo:

```github
https://github.com/The-DevOps-Daily/ai-feature-cost-ledger
```

## The invoice has the wrong shape

A cloud bill has the same problem, and the cloud answer is [cost allocation tags](/posts/cloud-cost-allocation-tags-aws-gcp-azure). Model spend has no tags. The provider sees an API key and a model name, so that is what it bills by. Everything you would want to group by, such as the feature, the customer and the environment, exists only in your code at the moment you make the call.

There is a second problem, and it is the one that surprised us. Even per request, what a user sees has little to do with what you pay for. A request bills four things:

- **Input tokens**: the system prompt, the conversation so far, tool definitions and tool results, every time
- **Cached input tokens**: the part of the input the provider served from its prompt cache, at a lower rate
- **Output tokens**: the answer
- **Reasoning tokens**: thinking the model does before it answers, billed as output and usually never shown

The first and last are the ones people underestimate. So we built three small features that share one key and measured each.

## The three features

All three run on the same key, which is the point: the provider sees one stream of calls.

1. **Incident assistant.** An engineer asks why `checkout-api` is returning 502s. The assistant has four tools: list pods, read logs, list recent deploys and read metrics. The tools return fixed text describing pods that are OOM-killed after a deploy raised a cache size, so every run sees the same incident. We ran it two ways: as a tool-calling agent, and single-shot with all four tool outputs pasted into one prompt. The system prompt asks for at most three short sentences.
2. **Ticket summary.** Two sentences for an account manager from a nine-message support thread.
3. **Alert classifier.** One word, `page`, `ticket` or `ignore`, for 20 different alert lines.

Each incident condition ran 10 times on each of two models, DeepSeek V4.1 Flash and Kimi K2.6. The classifier ran all 20 alerts under four settings. Both models report reasoning tokens and cached tokens separately in `usage`, which is why we picked them. All 40 incident answers identified the intended root cause (a keyword check for the memory exhaustion and the cache change behind it), so the cost comparisons below are between answers that found the right cause.

Prices are DigitalOcean's published Standard rates per million tokens, read from the [pricing page](https://docs.digitalocean.com/products/inference/details/pricing/) on 5 October 2026:

| Model               | Input | Cached input | Output |
| ------------------- | ----- | ------------ | ------ |
| DeepSeek V4.1 Flash | $0.30 | $0.006       | $1.20  |
| Kimi K2.6           | $0.95 | $0.19        | $4.00  |

## What one answer actually billed

Here is the single-shot incident answer on Kimi K2.6, straight from the report file:

```terminal
{
  "title": "ai-feature-cost-ledger",
  "prompt": "$",
  "steps": [
    { "comment": "one incident answer on Kimi K2.6, median of 10 runs" },
    { "cmd": "jq '.incident[\"kimi-k2.6 single\"] | {medianInput, medianOutput, medianReasoning, medianVisibleAnswer, medianBilledPerVisible}' data/report.json", "output": "{\n  \"medianInput\": 1893,\n  \"medianOutput\": 1023.5,\n  \"medianReasoning\": 927.5,\n  \"medianVisibleAnswer\": 102,\n  \"medianBilledPerVisible\": 30.6\n}" }
  ]
}
```

The engineer read a 102-token answer. The request billed a median of 1,893 input tokens and 1,024 output tokens, and 928 of the output tokens were reasoning. For every token the engineer read, the request billed about 30 (the median of the ten per-run ratios). On DeepSeek V4.1 Flash the same question billed about 17 tokens per token read, because it reasoned less: a median of 126 reasoning tokens against Kimi's 928.

```chart
{
  "type": "bar",
  "title": "One incident answer: what was billed vs what was read",
  "unit": " tokens",
  "caption": "Kimi K2.6, single-shot, median of 10 runs. Each bar is its own median, so the bars need not add up. Source: data/report.json in the companion repo.",
  "rows": [
    { "label": "Input (prompt and tool output)", "value": 1893, "series": "Billed" },
    { "label": "Reasoning (billed as output)", "value": 927.5, "series": "Billed" },
    { "label": "Answer the engineer read", "value": 102, "series": "Read" }
  ],
  "series": [
    { "name": "Billed", "color": "#f59e0b" },
    { "name": "Read", "color": "#10b981" }
  ]
}
```

:::warning
Reasoning tokens are in `completion_tokens`, and you pay the output rate for them. If you estimate cost by counting the tokens in the answer text, you miss most of the output bill on a reasoning model. Read `usage.completion_tokens_details.reasoning_tokens` where the provider reports it.
:::

## The agent loop was not the problem

We expected the agent to be the expensive version. An agent resends the whole conversation on every step: system prompt, tool definitions, every earlier tool result. Ten sequential steps means paying for the first prompt ten times.

That is not what happened. In 19 of the 20 agent runs, the model asked for all four tools in its first step, received the results, and answered in the second. The one exception, a Kimi run, asked for three tools, then the fourth, then answered: three calls. With two calls, the resend costs one extra copy of a short prompt.

| Model               | Single-shot, median | Agent, median | Agent / single-shot |
| ------------------- | ------------------- | ------------- | ------------------- |
| DeepSeek V4.1 Flash | $0.000926           | $0.001518     | 1.64x               |
| Kimi K2.6           | $0.005892           | $0.005871     | 1.00x               |

Those are list prices with no cache discount, which is the fair comparison here (the cache section explains why). On Kimi the agent was no dearer at all, because it reasoned less once the tool results were in front of it.

This does not mean agent loops are cheap. It means the step count decides, and the step count belongs to the model and the task, not to you. A model that calls one tool per step, or a task where each tool result decides the next call, turns two calls into eight. Measure steps per request as its own number, and alert on it.

## The one-word answer that cost the most

The classifier is the feature nobody worries about. The prompt is roughly 50 to 90 tokens and the answer is one word. At list price, it cost $0.48 per 1,000 labels on DeepSeek V4.1 Flash with default settings, and $2.45 on Kimi K2.6.

Almost all of that is reasoning. The answer was 2 to 4 tokens every time. The reasoning was not:

```chart
{
  "type": "dots",
  "title": "Reasoning tokens spent on a one-word alert label",
  "unit": " tokens",
  "caption": "20 alerts per setting, one call each. The visible answer was 2 to 4 tokens every time. Source: data/feature-runs.jsonl.",
  "series": [
    { "name": "DeepSeek V4.1 Flash, default", "samples": [52, 59, 62, 77, 85, 86, 89, 121, 126, 158, 211, 216, 221, 241, 507, 585, 799, 882, 1218, 1783], "median": 184.5 },
    { "name": "DeepSeek V4.1 Flash, effort=low", "samples": [46, 47, 52, 52, 64, 68, 74, 95, 95, 99, 116, 122, 147, 167, 176, 186, 191, 245, 832, 1138], "median": 107.5 },
    { "name": "Kimi K2.6, default", "samples": [154, 213, 226, 261, 286, 288, 312, 480, 514, 547, 586, 634, 665, 708, 717, 809, 821, 931, 1168, 1590], "median": 566.5 },
    { "name": "Kimi K2.6, effort=none", "samples": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "median": 0 }
  ]
}
```

The tail is where the money goes. A DNS failure rate of 14 percent for three minutes drew 1,783 reasoning tokens from DeepSeek before it said `ticket`. A node memory-pressure alert drew 1,218. On DeepSeek at default settings, 14 of the 20 alerts used between 50 and 250. Nothing in the request tells you in advance which call will be the expensive one.

Put next to the incident assistant, this is the number that changes priorities. Comparing mean costs, **one label cost 32 to 48 percent of a full agent investigation**: 32 percent on DeepSeek at list price, 48 percent on Kimi with the cache discounts both features got. A feature that runs on every alert is billed at a third to a half of a feature that runs when an engineer is paged.

## Turning reasoning down, and what it changes

Both models accept a `reasoning_effort` parameter on this endpoint, but not the same values, and the values do not mean the same thing. DeepSeek V4.1 Flash rejected `none` and `minimal` (`reasoning_effort must be one of [low high xhigh max] for this model`) and accepted `low`. Kimi K2.6 accepted all three, but on the probe alert `low` and `minimal` used more reasoning than the default (1,210 and 1,021 tokens against 656), and only `none` turned it off. That is one call each, recorded in `data/effort-probe.json`, so read it as "check what the setting does", not as a rule.

```terminal
{
  "title": "ai-feature-cost-ledger",
  "prompt": "$",
  "steps": [
    { "comment": "the alert classifier on Kimi K2.6, default vs reasoning_effort none" },
    { "cmd": "jq '.classifier[\"kimi default\"] | {runs, medianOutput, medianReasoning, maxOutput, medianVisible, costPer1000}' data/report.json", "output": "{\n  \"runs\": 20,\n  \"medianOutput\": 569.5,\n  \"medianReasoning\": 566.5,\n  \"maxOutput\": 1593,\n  \"medianVisible\": 3,\n  \"costPer1000\": 2.4195\n}" },
    { "cmd": "jq '.classifier[\"kimi effort=none\"] | {runs, medianOutput, medianReasoning, costPer1000, agreesWithDefault}' data/report.json", "output": "{\n  \"runs\": 20,\n  \"medianOutput\": 2,\n  \"medianReasoning\": 0,\n  \"costPer1000\": 0.0381,\n  \"agreesWithDefault\": 14\n}" }
  ]
}
```

```chart
{
  "type": "bar",
  "title": "Cost per 1,000 alert labels",
  "unit": "$",
  "caption": "Mean cost of 20 real calls per setting, scaled to 1,000, at DigitalOcean list prices on 5 Oct 2026 with no cache discount (costPer1000NoCache). Source: data/report.json.",
  "rows": [
    { "label": "Kimi K2.6, default", "value": 2.4451, "series": "Kimi K2.6" },
    { "label": "Kimi K2.6, effort=none", "value": 0.06, "series": "Kimi K2.6" },
    { "label": "DeepSeek V4.1 Flash, default", "value": 0.4812, "series": "DeepSeek V4.1 Flash" },
    { "label": "DeepSeek V4.1 Flash, effort=low", "value": 0.2671, "series": "DeepSeek V4.1 Flash" }
  ]
}
```

With reasoning off, Kimi produced 2 output tokens per label. At list price, the cost per 1,000 labels fell from $2.45 to $0.06, 41 times less. As billed, with the cache discounts some of those calls got, it fell from $2.42 to $0.04, 63 times less. DeepSeek at `low` saved 1.8 times either way, and its tail did not go away: one call still used 1,138 reasoning tokens.

The catch is in the last field. Without reasoning, Kimi gave a different label on 6 of the 20 alerts. Four moved up to `page`: the disk at 91 percent, a node under memory pressure, a CI queue delay and a single OOM-killed pod. The other two moved from `ignore` to `ticket`. DeepSeek at `low` changed 2 labels. Each alert ran once per setting, so these are observed differences, not a measured rate, and we have no ground truth for the alerts, so we cannot say which setting was right. We can say that "turn reasoning off" is a product decision about who gets woken up, not a free saving. Run your own labelled set through both settings before you flip it.

## Caching is a discount you cannot schedule

Prompt caching is the other big lever. DeepSeek V4.1 Flash bills cached input at $0.006 per million tokens against $0.30 uncached, 50 times less. On the nine single-shot runs that hit the cache, the median cost was $0.000342, against $0.000925 for the same tokens at list price.

Two things stop you from budgeting on that number:

- **The first call always paid full price.** The first call of every incident condition had zero cached tokens, and so did the first call of the second Kimi agent run, even though the run before it had just sent the same prefix.
- **What repeats in our test does not repeat in production.** We sent the identical incident ten times, so later runs found almost the entire single-shot prompt in cache (1,984 of 2,019 tokens on DeepSeek). A real incident brings new logs and new metrics. Only the shared prefix (system prompt and tool definitions, 576 tokens on DeepSeek here) can repeat across different incidents, which is why the agent comparison above uses list prices.

Record `cache_read` tokens per call and watch the hit rate as its own metric. Put the stable part of every prompt first and the per-request part last, so the prefix the cache can match is as long as possible. Then budget at list price and treat the cache as a discount, not a plan.

## Tag every call with the feature that caused it

None of the numbers above helps finance unless each call says which feature it belongs to. The fix is boring, and that is the point. Every model call goes through one function. The function knows the feature and the tenant, reads the `usage` block from the response, prices it, and writes one row:

```javascript
// src/ledger.mjs, trimmed
import { appendFileSync } from 'node:fs';
import { chat } from './client.mjs';
import { costUsd, splitUsage } from './cost.mjs';

export async function meteredChat({ feature, tenant, ledger }, body) {
  const res = await chat(body);
  const s = splitUsage(res.data.usage);
  const row = {
    ts: new Date().toISOString(),
    'app.feature': feature, // who caused this call
    'app.tenant': tenant, // who you would bill or rate limit
    'gen_ai.operation.name': 'chat',
    'gen_ai.provider.name': 'digitalocean',
    'gen_ai.request.model': body.model,
    'gen_ai.response.model': res.data.model,
    'gen_ai.usage.input_tokens': s.input, // includes cached tokens
    'gen_ai.usage.cache_read.input_tokens': s.cached,
    'gen_ai.usage.output_tokens': s.output, // includes reasoning tokens
    'gen_ai.usage.reasoning.output_tokens': s.reasoning,
    'app.cost_usd': costUsd(body.model, res.data.usage),
  };
  appendFileSync(ledger, JSON.stringify(row) + '\n');
  return res;
}
```

And the pricing function it calls, which is where most homemade cost trackers go wrong:

```javascript
// src/cost.mjs, trimmed
export function splitUsage(u = {}) {
  const input = u.prompt_tokens ?? 0;
  const cached = u.prompt_tokens_details?.cached_tokens ?? u.cache_read_input_tokens ?? 0;
  const output = u.completion_tokens ?? 0;
  const reasoning = u.completion_tokens_details?.reasoning_tokens ?? 0;
  return { input, cached, uncached: input - cached, output, reasoning };
}

export function costUsd(model, usage) {
  const p = pricing.models[model]; // USD per million tokens, with source and date
  const s = splitUsage(usage);
  const cachedRate = p.cachedInput ?? p.input;
  return (s.uncached * p.input + s.cached * cachedRate + s.output * p.output) / 1e6;
}
```

Three details matter more than the rest.

- **Use the provider's numbers, not your own estimate.** The `usage` block is what you are billed for. A tokenizer on your side counts the text you sent; it does not see reasoning tokens or what the cache served.
- **Split before you price.** `prompt_tokens` already includes cached tokens and `completion_tokens` already includes reasoning tokens. Add them on top and you bill yourself twice for the same tokens.
- **Name the fields the way OpenTelemetry does.** The [GenAI semantic conventions](https://github.com/open-telemetry/semantic-conventions-genai) define `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.usage.cache_read.input_tokens` and `gen_ai.usage.reasoning.output_tokens`, and state that the cached and reasoning counts are included in the totals, the same rule as above. The conventions are still marked Development, so pin the version you emit. The names still mean a JSON line today can become a span attribute later without a rename.

Once every row carries `app.feature`, the roll-up is a `GROUP BY`. The 151 calls in this experiment cost $0.19 as billed and $0.22 at list price. As billed, the 80 classifier calls cost more than the 41 agent calls; at list price, the agent calls were slightly ahead:

| Feature                          | Calls | As billed | List price | Reasoning tokens |
| -------------------------------- | ----- | --------- | ---------- | ---------------- |
| alert-classifier                 | 80    | $0.0641   | $0.0651    | 23,500           |
| incident-assistant (agent)       | 41    | $0.0619   | $0.0713    | 7,948            |
| incident-assistant (single-shot) | 20    | $0.0566   | $0.0733    | 11,831           |
| ticket-summary                   | 10    | $0.0053   | $0.0066    | 2,958            |

The mix of calls here is our test plan, not a production workload, so the shares mean nothing on their own. The shape is the lesson: the feature with the shortest answers spent the most reasoning tokens.

## Where a gateway fits

You can stop at the wrapper. It is about 30 lines, it lives in your code, and it adds no one who sees your prompts beyond the inference provider. Keeping it consistent gets harder when the calls come from many services in several languages, and it reports spend without enforcing a budget. That is the problem the AI gateway and LLM observability vendors sell into, and they solve the tagging part in similar ways:

- [Portkey](https://portkey.ai/docs/product/observability/metadata) takes an `x-portkey-metadata` header with any keys you choose, such as `feature` and `_user`, and has budget limits in front of the provider.
- [Helicone](https://docs.helicone.ai/features/advanced-usage/custom-properties) uses one header per property, `Helicone-Property-<Name>`, and lets you segment requests and cost by them.
- [Langfuse](https://langfuse.com/docs/observability/features/token-and-cost-tracking) records usage and cost per generation. It infers cost from model definitions it ships for OpenAI, Anthropic and Google models, so for a model like DeepSeek V4.1 Flash on DigitalOcean you add your own definition with the prices, or send usage and cost yourself. Ingested values take priority over inferred ones, and you should send them.
- [Braintrust](https://www.braintrust.dev/docs/observe) logs traces with token counts, cost and metadata alongside its evaluations, which fits the question this post leaves open: whether a cheaper reasoning setting still labels alerts correctly.

The trade-offs are the usual ones. A proxy gateway adds a network hop to every model call, and a hosted one is another company that sees your prompts. Helicone, Langfuse and Portkey's gateway all publish source you can run yourself, which answers the second point and makes the first your problem. Whichever you pick, check that it records the provider's reported usage, including reasoning and cached tokens, rather than estimating from the text. Counting only what the user saw would have put the incident assistant's token bill far too low in this test: the median billed-to-read ratio per condition ran from 17 to 40, and single investigations from 14 to 50.

## What we could not conclude

- **Whether failed attempts are billed.** The 151 recorded calls all succeeded on the first attempt, so the client's retries for 429 and 5xx never fired in the record. A request that fails or times out on the client side may still reach the provider and be billed, and nothing we recorded can show whether it was.
- **Which classifier labels were right.** We have no ground truth for the 20 alerts, so the 6 changed labels are a difference, not an error rate.
- **Whether reasoning helps the incident answers.** All 40 identified the intended root cause by our keyword check, which is not a full accuracy review, so we cannot price the accuracy reasoning buys on this task. A harder incident might change that.
- **Anything about other models.** Two models, one endpoint, one day. Others reason more or less, and the OpenAI GPT-5 models on the same pricing page were not available on our account tier, so we could not include them.
- **Steady-state cache hit rates.** Our repeated prompts overstate hits for anything that changes per request.

## Summary

- Price every request from the provider's `usage` block. The answer text is not the bill.
- On reasoning models, reasoning tokens can be most of the output bill, even for a one-word answer. Track `reasoning_tokens` as its own metric and look at the tail, not the median.
- Steps per request decides what an agent costs. The median was 2 here: 19 investigations took two calls and one took three. Measure it and alert when it climbs.
- `reasoning_effort` is a large lever and a product decision. Test the labels it changes before you ship it.
- Budget at list price. Treat the prompt cache as a discount, put the stable prefix first, and watch the hit rate.
- Wrap every model call once, tag it with the feature and tenant, and use the OpenTelemetry GenAI names. Then finance gets one line per feature, and you get it before they ask.

For two other ways a model bill grows quietly, see [why most LLM calls are classification](/posts/most-of-your-llm-calls-are-classification) and [what a semantic cache really saves](/posts/semantic-cache-answers-the-wrong-question).
