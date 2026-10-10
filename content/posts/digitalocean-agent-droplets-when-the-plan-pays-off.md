---
title: 'DigitalOcean Agent Droplets: When the $50 Plan Pays Off'
excerpt: 'Agent Droplets is a prepaid discount on DigitalOcean Managed Agents, not a server. We priced our real agent runs from a real invoice to find where the $50 and $200 plans start to save money, and found a rounding rule that made our runs cost more than the token math.'
category:
  name: 'FinOps'
  slug: 'finops'
date: '2026-10-12'
publishedAt: '2026-10-12T09:00:00Z'
updatedAt: '2026-10-12T09:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - FinOps
  - DigitalOcean
  - AI Agents
  - Pricing
  - Cloud
---

The $50 Agent Droplets plan is cheaper than paying as you go only when you would spend more than $50 a month on DigitalOcean Managed Agents anyway, and then it saves you at most $8.82. For the coding agent we built last month, $50 of usage is about 780 runs. We know what a run costs because we read the September invoice line by line. The invoice also showed something the token math hides: on our invoice, every session's token lines were rounded to the cent, with a one-cent minimum, so our five recorded runs were billed $0.32 for tokens worth $0.274.

[Agent Droplets](https://www.digitalocean.com/blog/introducing-agent-droplets) launched on 1 October 2026 as a public preview. The name suggests a server you rent. It is a monthly plan that prepays and discounts the usage you already pay for in [Managed Agents](https://docs.digitalocean.com/products/managed-agents/). This post shows the plan math, the real cost of our runs, the break-even for two kinds of agent work, and a calculator you can run with your own numbers.

## TLDR

- **Pro** costs $50 a month and covers $58.82 of usage at list price (15% off). **Team** costs $200 and covers $250 (20% off). After that, usage continues at list price.
- Pro beats pay as you go above **$50 a month** of discounted usage and saves at most **$8.82**. Team beats Pro above **$208.82** and saves at most **$50**.
- The discount covers compute, memory, storage, tools, egress and DigitalOcean-hosted models such as GLM-5.3 and Kimi K3. **Claude and GPT are not discounted.**
- Our five recorded issue-to-PR runs were billed **$0.064 per run**, $0.107 per merged pull request. At that rate, Pro is cheaper from about **782 runs a month**.
- On our invoice, every token line of every session matched **max(1 cent, amount rounded to the cent)**. That added 17% to our five runs and 25% to all 13 sessions on the invoice. Compute for sessions of about a minute was billed at **$0.00**.
- DigitalOcean's docs do not say whether unused plan balance rolls over. Check that before you subscribe.

## Prerequisites

- A DigitalOcean account. Nothing here needs a plan; we did not subscribe to one.
- Node 20 or later, to run the calculator from the [companion repo](https://github.com/The-DevOps-Daily/agent-droplets-break-even).
- Optional: an API token with billing read access, if you want to price your own invoice with the same scripts.

## What you actually buy

Managed Agents runs coding agents such as Claude Code, Codex and OpenCode in microVMs, and bills for the parts separately: compute, memory, storage, tool calls, egress and model tokens. Agent Droplets does not change any of that. It adds a monthly fee that funds a balance, and your usage draws from that balance at a discount.

| Plan | Monthly fee | Discount | Usage covered at list price |
| --- | --- | --- | --- |
| Free trial | $5 credit | none | $5 |
| Pro | $50 | 15% | $58.82 |
| Team | $200 | 20% | $250.00 |

The figures come from DigitalOcean's [Harness Runtime pricing page](https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/details/pricing/) and the [Agent Droplets pricing page](https://www.digitalocean.com/pricing/agent-droplets), both read on 10 October 2026.

Not everything is discounted. The docs list what is:

- Harness Runtime compute (CPU) and memory
- Session storage, snapshots and custom templates
- Inference on DigitalOcean-hosted models, such as Kimi K3 and GLM-5.3
- Action Gateway tools: code interpreter, browser automation, web search and web fetch
- Public internet egress

Third-party models such as Anthropic Claude and OpenAI GPT are billed at standard rates and do not draw down the plan balance at a discount. So if your agents run on Claude, the plan saves you nothing on the biggest part of the bill.

When the balance runs out, nothing stops. In DigitalOcean's words, "you just move from the discounted rate to list price for the rest of the month."

:::warning
We could not find what happens to unused balance at the end of the month. Neither pricing page says whether it rolls over. If it expires, a quiet month costs the full fee for less than the full amount of usage. Ask DigitalOcean before you subscribe to Team.
:::

## The math

Write your monthly **discount-eligible** usage at list price as U: compute, memory, storage, tools, egress and DigitalOcean-hosted models. Claude, GPT and other charges the plans do not discount are added to every line unchanged, so leave them out of U. Then:

```text
Pay as you go:  U
Pro:            50  + max(0, U - 58.82)
Team:           200 + max(0, U - 250)
```

Pro costs a flat $50 until your usage passes $58.82, then grows with usage again. So Pro is cheaper than pay as you go as soon as U is above $50, and the gap never grows past $58.82 - $50 = $8.82. Team overtakes Pro where Pro's cost reaches $200, at U = $208.82, and its saving against pay as you go is capped at $250 - $200 = $50.

```chart
{
  "type": "line",
  "title": "Monthly cost by plan",
  "unit": "$",
  "caption": "Monthly cost against monthly Managed Agents usage at list price. Only usage that the plans discount counts here; Claude and GPT tokens do not. Plan terms read 2026-10-10.",
  "x": ["$0", "$25", "$50", "$75", "$100", "$150", "$200", "$250", "$300", "$400"],
  "series": [
    { "name": "Pay as you go", "data": [0, 25, 50, 75, 100, 150, 200, 250, 300, 400] },
    { "name": "Pro ($50)", "data": [50, 50, 50, 66.18, 91.18, 141.18, 191.18, 241.18, 291.18, 391.18], "color": "#0080ff" },
    { "name": "Team ($200)", "data": [200, 200, 200, 200, 200, 200, 200, 200, 250, 350], "color": "#f59e0b" }
  ]
}
```

The shape is the whole story. Below $50, Pro costs more than it saves. Between $50 and $208.82, Pro is the cheapest, by at most $8.82. Above that, Team is cheapest, by at most $50 against pay as you go. A plan is worth it only once you know that your usage sits reliably above those lines.

The useful question is what $50 of usage looks like in agent runs. For that, we needed the real cost of a real run.

## What our agent runs actually cost

Last month we built an [issue-to-pull-request agent on Managed Agents](/posts/issue-to-pull-request-digitalocean-managed-agents): OpenCode on DeepSeek V4 Pro in a 2 vCPU / 4 GB microVM, one session per GitHub issue. That post estimated the model cost of each run from the token counts that the agent reported. The September invoice has now arrived, and it tells a different story.

The invoice API returns one line per session for compute, and one line per session for each kind of token: input, output and cache read. Stage 1 of the [companion repo](https://github.com/The-DevOps-Daily/agent-droplets-break-even) pulls those lines, and stage 2 prices them.

```github
https://github.com/The-DevOps-Daily/agent-droplets-break-even
```

These are the five recorded runs, matched to their invoice sessions by the session name in each run's log:

| Run | Outcome | Input / output / cache-read tokens | Exact list price | Billed |
| --- | --- | --- | --- | --- |
| Issue #1 | Merged | 8,989 / 1,028 / 61,696 | $0.0407 | $0.05 |
| Issue #2, first try | Closed in review | 15,136 / 1,852 / 105,472 | $0.0695 | $0.08 |
| Issue #2, second try | Push refused | 15,184 / 2,272 / 82,176 | $0.0629 | $0.07 |
| Issue #2, third try | Merged | 14,984 / 1,609 / 57,344 | $0.0516 | $0.06 |
| Issue #3 | Merged | 9,514 / 2,113 / 72,192 | $0.0490 | $0.06 |
| **Total** | 3 merged | | **$0.274** | **$0.32** |

Two things stand out.

**Cache-read tokens are most of the volume.** An agent sends its growing conversation to the model on every step, and the provider bills the repeated part as cache reads, at one fifth of the input price for this model. Our earlier post counted only input and output tokens, so it put the model cost at about two cents per run. With cache reads and the invoice's rounding, the real figure was five to eight cents. We have added a correction to that post.

**Each line was rounded to the cent, with a one-cent minimum.** We checked a rule against all 31 token lines on our September invoice: billed = max($0.01, exact amount rounded to the cent). All 31 match. That is a pattern on one pay-as-you-go invoice, not a published billing policy, but it is consistent. On a long session this hardly matters. On short agent runs it does. For our five runs it added 17%, and across all 13 sessions on the invoice, including short probes, it added 25%: $0.62 billed for $0.497 of tokens. A probe that produced four output tokens was billed a full cent for them.

```chart
{
  "type": "bar",
  "title": "Exact token cost vs billed, per run",
  "unit": "$",
  "caption": "DeepSeek V4 Pro at $1.74 / $3.48 / $0.348 per million input / output / cache-read tokens. Billed amounts are the invoice lines before account credits, September 2026.",
  "rows": [
    { "label": "Issue #1", "value": 0.0407, "series": "Exact" },
    { "label": "Issue #1", "value": 0.05, "series": "Billed" },
    { "label": "Issue #2 (1)", "value": 0.0695, "series": "Exact" },
    { "label": "Issue #2 (1)", "value": 0.08, "series": "Billed" },
    { "label": "Issue #2 (2)", "value": 0.0629, "series": "Exact" },
    { "label": "Issue #2 (2)", "value": 0.07, "series": "Billed" },
    { "label": "Issue #2 (3)", "value": 0.0516, "series": "Exact" },
    { "label": "Issue #2 (3)", "value": 0.06, "series": "Billed" },
    { "label": "Issue #3", "value": 0.049, "series": "Exact" },
    { "label": "Issue #3", "value": 0.06, "series": "Billed" }
  ],
  "series": [
    { "name": "Exact", "color": "#94a3b8" },
    { "name": "Billed", "color": "#0080ff" }
  ]
}
```

**Compute was billed at $0.00.** Compute is billed per second for the CPU a session actually uses, plus its peak memory. Even at full use, 2 vCPU and 4 GB list at $0.126 an hour, and the five sessions existed for 38 to 79 seconds each, so each one's compute was less than three tenths of a cent. The invoice shows $0.00 for every compute line. Unlike the token lines, compute lines below a cent were not raised to a cent.

So one recorded run cost **$0.064** on the bill, tokens and compute together. Two of the five runs did not end in a merged pull request, so a merged pull request cost **$0.107**.

## Turning $50 into runs

Stage 3 finds the first monthly volume at which each plan is cheaper. These are estimates: they assume a plan draws down its balance at the same charges our pay-as-you-go invoice showed, which we could not check without subscribing.

```terminal
{
  "title": "break-even",
  "steps": [
    {
      "cmd": "node scripts/03-break-even.mjs data/priced-2026-09.json",
      "output": "Pro is cheaper than pay as you go above $50.00 a month of discount-eligible usage at list price; it saves at most $8.82.\nTeam is cheaper than Pro above $208.82; it saves at most $50.\n\nworkload                       cost per unit  Pro cheaper from      Team cheaper than Pro from\nissue-to-PR run (2026-09)      $0.0640        782 runs/month        3263 runs/month\nmerged pull request (2026-09)  $0.1067        469 merged PRs/month  1958 merged PRs/month"
    }
  ]
}
```

782 runs a month is about 26 runs a day, every day. A team that points an agent at every new issue in a busy repository might get there. A team that uses it a few times a day will not, and pays $50 for less than $50 of usage.

LONG_SESSION_SECTION

## Where the plan makes sense

- **Agents that run for hours.** Long interactive sessions use far more tokens than our short runs, and a busy agent keeps the CPU working. Those workloads reach the $50 and $208.82 lines much faster.
- **Agents on DigitalOcean-hosted models.** GLM-5.3 at $1.40 / $4.40 per million input / output tokens and Kimi K3 at $3 / $15 are discounted. Claude Sonnet 5.5 at $2 / $10 is not, even though it is billed through the same account.
- **Many people sharing one account.** Every plan includes unlimited seats and agents, so the whole team's usage counts toward one balance. With short runs like ours, ten people would need about 11 runs each per day to pass $208.82; with long sessions, far fewer.

## Where it does not

- **Occasional or bursty use.** Below $50 a month, pay as you go is cheaper, and the free trial's $5 credit covers a lot of short runs.
- **Claude Code or Codex on their own vendors' models.** The model tokens are most of the bill, and the plan does not touch them.
- **Before you have a month of real usage.** Run pay as you go for a month, then price the invoice. The [scripts](https://github.com/The-DevOps-Daily/agent-droplets-break-even) do that for you.

## Price your own usage

Clone the repo and pass your own numbers:

```bash
git clone https://github.com/The-DevOps-Daily/agent-droplets-break-even
cd agent-droplets-break-even
node calc.mjs --runs 1500 --cost 0.064
```

```terminal
{
  "title": "calc",
  "steps": [
    {
      "cmd": "node calc.mjs --runs 1500 --cost 0.064",
      "output": "Discount-eligible usage at list price: $96.00 a month\n  Pay as you go  $96.00\n  Pro            $87.18\n  Team           $200.00\nCheapest: Pro."
    }
  ]
}
```

To price your own invoice instead, run stage 1 with a billing-read token and your invoice id (or `preview` for the current month), then stage 2 on the file it writes. Stage 2 also checks the rounding rule against every token line, so you can see whether your bill follows it too.

## What we could not conclude

- **How a plan invoice looks.** We stayed on pay as you go. We do not know whether the 15% discount is applied before or after the one-cent rounding, which matters for short runs.
- **Rollover.** As above, the docs do not say.
- **Speed.** Managed Agents is in preview, and DigitalOcean's preview terms treat benchmark results as confidential, so this post prices usage only.
- **Prices after the preview.** Plan terms and list prices can change before general availability. The repo keeps every price in one file with its source and the date we read it.

## Summary

Agent Droplets is a commitment discount, not a cheaper server. It pays off only once your discounted usage reliably passes $50 a month, and even then it saves at most $8.82 on Pro and $50 on Team. Our short issue-to-PR runs cost six cents each on the bill, so a team would need about 780 of them a month before Pro is worth it. Long, all-day sessions on DigitalOcean's own models reach the break-even much sooner. Whichever you run, read your invoice before you subscribe: it showed us cache-read tokens and a rounding rule that the token counts alone did not.
