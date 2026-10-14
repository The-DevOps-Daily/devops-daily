---
title: 'Page, Ticket or Ignore: Is the Cheap Model Good Enough for Alert Triage?'
excerpt: 'We gave eight models on DigitalOcean Serverless Inference one written on-call policy and 200 alerts, three times each. A model at $0.16 per 1,000 alerts got every call right, the same as one at $1.64. The router picked the expensive one. The real differences were in latency, missed pages and a bug in our own test data that the models caught.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-10-14'
publishedAt: '2026-10-14T09:00:00Z'
updatedAt: '2026-10-14T09:00:00Z'
readingTime: '13 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - DevOps
  - AI
  - LLM
  - Alerting
  - On-call
  - DigitalOcean
sponsorCampaign: 'digitalocean'
---

We gave eight models on DigitalOcean Serverless Inference the same written on-call policy and the same 200 alerts, three times each, and asked one question per alert: page, ticket or ignore. DeepSeek V4 Flash got all 600 answers right for **$0.16 per 1,000 alerts**. Qwen3.8-Max, the most expensive model our account could call, also got all 600 right, for **$1.64 per 1,000**. Routing on the alert's own `severity` label, with no model at all, got 102 of 200.

So for this task the cheap model was good enough. That is not the whole answer. DeepSeek V4 Flash took 4.4 seconds at the median and once took a full minute. Two other cheap models each missed real pages. And 200 clean results still leave room for a real error rate of 1.5 percent. The most useful thing we learned came from a bug in our own test data: most of the models found it, and our second reviewer did not.

## TL;DR

- With a clear written policy, DeepSeek V4 Flash, `gpt-oss-120b` and Qwen3.8-Max made the same calls on 200 alerts. Qwen3.8-Max costs about ten times as much per alert, and it was also the fastest of the three.
- `router:general` sent 571 of 600 calls to Qwen3.8-Max, so it cost almost exactly what Qwen3.8-Max costs. `router:software-engineering` chose DeepSeek V4 Flash for most calls and got 4 alerts wrong at least once.
- `llama-4-maverick` and `gpt-oss-20b` each missed a real page in some runs. Ministral 3 14B missed 4.7 pages per run out of 50 and is not good enough.
- DeepSeek V4 Flash spends most of its output on reasoning: p95 latency of 10.7 seconds, 33 calls over 10 seconds and one at 60.6 seconds.
- At 10,000 alerts a month, the cheap model costs $1.57 and the expensive one $16.40. Choose on missed pages and latency, not on price.

## Prerequisites

- A DigitalOcean account with a Serverless Inference model access key
- Node.js 20 or later (the scripts have no dependencies)
- About $3 of inference if you rerun all eight models

The code, the alerts, every model answer and the scoring are in the repository:

```github
https://github.com/The-DevOps-Daily/alert-triage-bench
```

## The task: one policy, three answers

Most alert routing today is a rule on the `severity` label. Whoever wrote the alert rule decided that `KubePodCrashLooping` is a warning and `EndpointDown` is critical, and Alertmanager pages on critical. That works until the label and the situation disagree: a critical alert from a sandbox, a warning on a checkout outage, a probe that still fires for a service you turned off last month.

The question here is narrower than "can a model run on-call". Give a model the alert and a written policy, and ask it to make the one call a human makes first. The policy is short on purpose, the kind a team could actually keep up to date. In summary:

```text
Page    production, and customer impact now or within 1 hour:
        tier 1 down, >2% errors for 5+ min, p99 >2 s for 10+ min,
        SLO burn at 14x or faster, a database/cache/queue full within 1 hour,
        public cert expiring in <24 h, primary DB unreachable,
        confirmed unauthorized access
Ticket  a real problem with no customer impact within the hour:
        tier 2 problems, tier 1 below the page thresholds,
        capacity gone in 1 hour to 7 days, certs expiring in 1 to 14 days,
        one pod or node failing while the service is fine,
        failed backups and jobs, staging problems that block a release
Ignore  non-production (unless it blocks a release), self-resolved flaps,
        heartbeats, deploy and autoscaling notices, maintenance windows,
        decommissioned or test targets
        The severity label is a hint only.
```

The full text, including the list of tier 1 services, is in `POLICY.md`. Every model got the whole policy as its system prompt and one alert as the user message, about 720 input tokens per call, and had to answer with `{"decision": ..., "reason": ...}`.

A typical hard case looks like this. The service is tier 1 and the restart count is alarming, but one pod out of eight is not an outage:

```text
status: firing
labels: alertname=KubePodCrashLooping env=production service=search severity=warning team=discovery
summary: Pod search-ad1 is crash looping
description: 1 of 8 search pods has restarted 21 times in the last hour (OOMKilled). The other 7 replicas are healthy and the service error ratio is 0.16%.
startsAt: 2026-10-15T03:41:00Z
maintenance window: none
```

The answer is ticket. So is a staging outage that blocks a release, even though staging is otherwise ignored. A `severity=critical` alert showing 42 percent errors on `search` in staging, with no release waiting, is ignore.

## How the 200 alerts were built and checked

The alerts are generated, not collected. Real alert payloads from our own systems would not have a known correct answer, and hand-labelling 200 of them would test our labelling as much as the models. Instead, a seeded script builds each alert from structured fields (service, environment, the measured value, how long it has fired, the maintenance window) and labels it by applying the policy to those fields. The text the models see is rendered from the same fields.

```terminal
{
  "title": "alert-triage-bench",
  "prompt": "$",
  "steps": [
    { "cmd": "node scripts/01-generate-alerts.mjs", "output": "alerts: 200\n  page   50 (hard 14)\n  ticket 84 (hard 40)\n  ignore 66 (hard 54)\n  severity label points the wrong way: 98" },
    { "cmd": "node scripts/03b-baseline-severity.mjs", "output": "severity-label baseline: 102 of 200 correct" }
  ]
}
```

Two numbers in that output need explaining. "Hard" marks alerts where a shortcut gives the wrong answer: the severity label points the wrong way, or the alert name sounds worse than the policy says it is. And 98 of the 200 severity labels are wrong **on purpose**. That is why the no-model baseline scores 51 percent and misses 14 of the 50 real pages. Your labels are probably better than ours. The point of the mismatch is that a model has to read the alert, not the label.

To check that the text carries what the labels assume, we gave Codex only `POLICY.md` and the 200 rendered alerts, never the labels, and asked it to label them. It agreed on all 200. Hold on to that number, because it turned out to be wrong in an interesting way.

## Results

Eight models, three runs each, 4,800 calls. The six direct models are the open-weight models our account tier can call: it returns `403 this model is not available for your subscription tier` for the GPT-5 and Claude models, so they are not in this test. The two routers are DigitalOcean's Inference Router, in public preview, which picks a model per request and reports which one it used.

| Model | Correct (of 600) | Page alerts missed in any run (of 50) | False pages per run | $ per 1,000 alerts | p50 | p95 |
|---|---|---|---|---|---|---|
| DeepSeek V4 Flash | 600 | 0 | 0 | 0.157 | 4.4 s | 10.7 s |
| Qwen3.8-Max | 600 | 0 | 0 | 1.640 | 1.3 s | 2.6 s |
| `router:general` | 600 | 0 | 0 | 1.565 | 1.8 s | 3.5 s |
| `gpt-oss-120b` | 599 | 0 | 0 | 0.194 | 3.1 s | 5.1 s |
| Llama 4 Maverick | 597 | 2 | 0 | 0.189 | 1.9 s | 3.3 s |
| `router:software-engineering` | 596 | 0 | 0.7 | 0.339 | 4.2 s | 8.9 s |
| `gpt-oss-20b` | 595 | 3 | 0 | 0.144 | 2.4 s | 5.3 s |
| Ministral 3 14B | 532 | 8 | 6.0 | 0.149 | 0.8 s | 1.8 s |
| Severity label, no model | 102 of 200 | 14 | 39 | 0 | | |

```chart
{
  "type": "bar",
  "title": "Wrong answers out of 600 (200 alerts, 3 runs)",
  "caption": "Lower is better. Ministral 3 14B got 68 of 600 wrong and is left out so the rest stay readable. Source: results/summary.json in the repo.",
  "rows": [
    { "label": "DeepSeek V4 Flash", "value": 0, "series": "direct" },
    { "label": "Qwen3.8-Max", "value": 0, "series": "direct" },
    { "label": "router:general", "value": 0, "series": "router" },
    { "label": "gpt-oss-120b", "value": 1, "series": "direct" },
    { "label": "Llama 4 Maverick", "value": 3, "series": "direct" },
    { "label": "router:software-engineering", "value": 4, "series": "router" },
    { "label": "gpt-oss-20b", "value": 5, "series": "direct" }
  ],
  "series": [
    { "name": "direct", "color": "#0080ff" },
    { "name": "router", "color": "#f59e0b" }
  ]
}
```

```chart
{
  "type": "bar",
  "title": "Cost per 1,000 alerts",
  "unit": "$",
  "caption": "Real token usage times DigitalOcean list prices checked 2026-10-14. A routed call is billed at the price of the model that served it; the router itself is free during the public preview.",
  "rows": [
    { "label": "gpt-oss-20b", "value": 0.144, "series": "direct" },
    { "label": "Ministral 3 14B", "value": 0.149, "series": "direct" },
    { "label": "DeepSeek V4 Flash", "value": 0.157, "series": "direct" },
    { "label": "Llama 4 Maverick", "value": 0.189, "series": "direct" },
    { "label": "gpt-oss-120b", "value": 0.194, "series": "direct" },
    { "label": "router:software-engineering", "value": 0.339, "series": "router" },
    { "label": "router:general", "value": 1.565, "series": "router" },
    { "label": "Qwen3.8-Max", "value": 1.64, "series": "direct" }
  ],
  "series": [
    { "name": "direct", "color": "#0080ff" },
    { "name": "router", "color": "#f59e0b" }
  ]
}
```

Three models are perfect on this set, three more are within five wrong answers of perfect, and one is clearly not good enough. Ministral 3 14B is the fastest and among the cheapest, but it got 42 of the 200 alerts wrong in at least one run, missed 4.7 real pages per run and gave the same answer across all three runs for only 80 percent of the alerts. A model that changes its mind on one alert in five is not routing pages.

The misses from the near-perfect models are worth reading, because they are the errors that hurt. Llama 4 Maverick called a Postgres database that would run out of connections in about 34 minutes a ticket, twice, and did the same once with a public certificate expiring in 16 hours. `gpt-oss-20b` missed three different Redis memory alerts, all in its second run. Each one of those is an outage that nobody hears about until customers do.

## What the routers picked

The Inference Router reports the model that served each call in the response's `model` field, so you can see exactly what it chose:

- **`router:general`** sent 571 calls to Qwen3.8-Max and 29 to DeepSeek V4 Flash. It got every alert right and cost $1.57 per 1,000 alerts, within 5 percent of calling Qwen3.8-Max directly. For this task, the general router is the expensive model.
- **`router:software-engineering`** sent 537 calls to DeepSeek V4 Flash (465 to the `0731` version, 72 to a model it reported as `deepseek-4-flash`) and 63 to Qwen3.8-Max. It cost $0.34 per 1,000, but it got 4 alerts wrong at least once, including two false pages in one run. With that mix you might expect it to score exactly like DeepSeek V4 Flash. It did not, and its p95 latency was 8.9 seconds.

The router is free during the preview, and the routed price is just the price of whatever it picked. That makes it easy to reason about: if you already know which model is good enough, calling that model directly is never more expensive, and here it was also more accurate than the router that chose it most of the time.

## Latency is where the cheap model pays

Accuracy and cost both favour DeepSeek V4 Flash. Latency does not. It is a reasoning model, and 81 percent of its output tokens were reasoning, a median of 143 output tokens per call against Qwen3.8-Max's 33 tokens of plain JSON.

```chart
{
  "type": "bar",
  "title": "Latency per alert: p50 bar, p95 marker",
  "unit": "s",
  "caption": "Wall-clock time per call from the Pi that ran the test, 600 calls per model, 6 calls in flight. DeepSeek V4 Flash had 33 calls over 10 s and one at 60.6 s.",
  "rows": [
    { "label": "Ministral 3 14B", "value": 0.8, "tick": 1.8 },
    { "label": "Qwen3.8-Max", "value": 1.3, "tick": 2.6 },
    { "label": "router:general", "value": 1.8, "tick": 3.5 },
    { "label": "Llama 4 Maverick", "value": 1.9, "tick": 3.3 },
    { "label": "gpt-oss-20b", "value": 2.4, "tick": 5.3 },
    { "label": "gpt-oss-120b", "value": 3.1, "tick": 5.1 },
    { "label": "router:software-engineering", "value": 4.2, "tick": 8.9 },
    { "label": "DeepSeek V4 Flash", "value": 4.4, "tick": 10.7 }
  ]
}
```

For a ticket, four seconds does not matter. For a page, a minute does. If you put a model in front of your pager, give each call a timeout and decide in advance what a timeout means. The safe default is to page: a model that is slow or down should never be the reason an outage goes unheard.

## The bug the models found

In the first run, nobody scored 100 percent. Qwen3.8-Max, `gpt-oss-120b` and both routers "got wrong" the same two alerts every time, and DeepSeek V4 Flash got them "wrong" half the time. This was one of them:

```text
status: firing
labels: alertname=PostgresPrimaryUnreachable env=production service=postgres-orders severity=critical team=platform
summary: postgres-orders primary not responding
description: The primary of postgres-orders has not answered health checks for 7 minutes.
startsAt: 2026-10-23T05:35:00Z
maintenance window: active until 05:00 UTC, change CHG-4200 (major version upgrade of postgres-orders)
```

Our label said ignore, because the alert carries a maintenance window. But the window ended at 05:00 and the alert started at 05:35. Our generator picked the start time and the window independently and never checked that one was inside the other. Here is what the models said about this alert, copied from the run logs:

```text
qwen3.8-max:
{"decision": "page", "reason": "Production primary database unreachable for 7 minutes and the maintenance window ended at 05:00 UTC, so the page criteria apply."}

openai-gpt-oss-120b:
{"decision":"page","reason":"Production primary database is unreachable and no active maintenance window"}

llama-4-maverick:
{"decision": "ignore", "reason": "service is in an active maintenance window"}
```

Across the two broken alerts and three runs, Qwen3.8-Max, `gpt-oss-120b` and both routers paged all 6 times. Llama 4 Maverick and Ministral 3 14B trusted the word "active" all 6 times. DeepSeek V4 Flash and `gpt-oss-20b` were split. The second reader that "agreed on all 200" had trusted the word too.

Three lessons from that:

1. **Agreement between two readers is not proof the labels are right.** Both can take the same shortcut. The disagreements between models found what our check missed, so read them before you trust a score.
2. **A score is only as good as its labels.** With the bug in place, Llama 4 Maverick ranked first and Qwen3.8-Max tied for third, marked down for reading the timestamps correctly.
3. **Real alerts contain this kind of contradiction.** A silence that expired, a maintenance flag that nobody cleared. The models that read the times treated stale context the way an engineer should.

We fixed the generator so that maintenance alerts always start inside their window, checked that only those two alerts changed, and reran them on every model. The original alerts and every model's answers to them are in `results/v1-maintenance-bug/` in the repo.

## What 200 alerts cannot tell you

Perfect scores on 200 alerts do not mean a perfect model. Alerts are the independent unit here (three runs of one alert are not three samples), and a one-sided 95 percent binomial bound gives the worst case each result still allows:

| Model | Alerts wrong in any run (of 200) | True error rate could still be up to | Page alerts missed in any run (of 50) | True miss rate could still be up to |
|---|---|---|---|---|
| DeepSeek V4 Flash, Qwen3.8-Max, `router:general` | 0 | 1.5% | 0 | 5.8% |
| `gpt-oss-120b` | 1 | 2.3% | 0 | 5.8% |
| Llama 4 Maverick | 2 | 3.1% | 2 | 12.1% |
| `gpt-oss-20b` | 5 | 5.2% | 3 | 14.8% |
| Ministral 3 14B | 42 | 26.3% | 8 | 27.0% |

So "missed no pages" really means "missed none of these 50, which still allows missing up to about one in seventeen". Among the top six, a paired bootstrap against Qwen3.8-Max puts every accuracy difference between 0 and 0.8 percentage points. We cannot rank DeepSeek V4 Flash, Qwen3.8-Max and `gpt-oss-120b` against each other at all, and the gap to Llama 4 Maverick and `gpt-oss-20b` is a handful of alerts.

There is also what this test does not cover:

- **The alerts carry their own context.** Ours say which service is affected, whether a release is waiting and whether a maintenance window is active. Real alerts usually do not, and the hard part of using a model here is getting that context into the prompt. Without it, every model would do worse.
- **One policy, one invented company.** A messier policy, or one with judgement calls ("page if it looks bad"), would separate the models more.
- **Only the models our account could call.** We did not test the GPT-5 or Claude models.

## Cost in perspective

Each call used about 720 input tokens and a median of 20 to 200 output tokens, depending on the model. At 10,000 alerts a month, which is a busy on-call rotation, DeepSeek V4 Flash costs $1.57 and Qwen3.8-Max $16.40. The whole test, 4,800 calls plus the reruns, cost $2.65.

That changes the question. Neither bill matters next to a single missed page, so price should be the last thing you choose on. Pick the model by its missed pages on your own alerts, then by latency, and only then by cost. On this set, that puts Qwen3.8-Max first for a pager (perfect, and the fastest of the three perfect models) and DeepSeek V4 Flash first for tickets and digests, where a 10-second answer is fine.

## Run it on your own alerts

The generator is the part to replace. Export a few hundred real alerts from Alertmanager, write the decision a senior on-call engineer would make next to each one, and run the same scripts:

```bash
git clone https://github.com/The-DevOps-Daily/alert-triage-bench
cd alert-triage-bench
cp .env.example .env   # add your model access key
set -a; . ./.env; set +a

node scripts/03-run-models.mjs --runs 3 --budget 5   # stops at $5
node scripts/04-score.mjs                            # writes results/summary.md
```

What we would do with the results:

- **Write the policy down first.** Every model in this test, even the weak one, did far better than the severity label, and all of them were reading the same 31 lines of policy.
- **Score missed pages separately from accuracy.** A model can be 99 percent accurate and still miss the one alert that mattered.
- **Run each alert more than once.** One run hides models that change their mind.
- **Read the cases where the models disagree with your labels.** In our test, those were the label bugs.
- **Time out to a page, not to silence.** The model is a filter in front of your pager, never a reason for it to stay quiet.

For this task, with this policy, the cheap model was good enough. The price difference was never the thing to worry about. The latency, the missed pages and the labels were.
