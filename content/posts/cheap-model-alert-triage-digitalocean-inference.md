---
title: 'Page, Ticket or Ignore: Is the Cheap Model Good Enough for Alert Triage?'
excerpt: 'We gave six models on DigitalOcean Serverless Inference one written on-call policy and 200 alerts, three times each. A model at $0.16 per 1,000 alerts made every call the same way as one at $1.64. The real differences were latency, missed pages and a bug in our own test data that the models caught.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-10-14'
publishedAt: '2026-10-14T09:00:00Z'
updatedAt: '2026-10-19T09:00:00Z'
readingTime: '14 min read'
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

We gave six models on DigitalOcean Serverless Inference the same written on-call policy and the same 200 alerts, three times each, and asked one question per alert: page, ticket or ignore. DeepSeek V4 Flash made the policy's call on all 600 for an estimated **$0.16 per 1,000 alerts**. Qwen3.8-Max, the most expensive model we tested, also got all 600, for **$1.64 per 1,000**. Routing on the alert's own `severity` label, with no model at all, got 102 of 200, but we built that label to mislead.

So on this test the cheap model was good enough. That is not the whole answer. DeepSeek V4 Flash took 4.4 seconds at the median and once took a full minute. Two other cheap models each let through alerts the policy says must page. And 200 clean results still leave room for a real error rate of 1.5 percent. The most useful thing we learned came from a bug in our own test data: most of the models found it, and our second reviewer did not.

## TL;DR

- With a clear written policy, DeepSeek V4 Flash and Qwen3.8-Max made the policy's call on all 600 alert runs. `gpt-oss-120b` got 599 (one empty reply). Qwen3.8-Max costs about ten times as much per alert as DeepSeek V4 Flash, and it answered about three times faster.
- Llama 4 Maverick failed to page on 2 different page-level alerts (3 times in all) and `gpt-oss-20b` on 3 (once each). Ministral 3 14B missed 4.7 page-level alerts per run out of 50, and 17 of its 600 replies contained two different decisions.
- DeepSeek V4 Flash spends most of its output on reasoning: p95 latency of 10.7 seconds, 33 calls over 10 seconds and one at 60.6 seconds.
- At 10,000 alerts a month, the token cost is about $1.57 for the cheap model and $16.40 for the expensive one. Choose on missed pages and latency, not on price.

## Prerequisites

- A DigitalOcean account with a Serverless Inference model access key
- Node.js 20 or later (the scripts have no dependencies)
- About $1.50 of inference if you rerun all six models

The code, the alerts, every recorded decision and reply, and the scoring are in the repository:

```github
https://github.com/The-DevOps-Daily/alert-triage-bench
```

## The task: one policy, three answers

The simplest way to route alerts is the `severity` label. Whoever wrote the alert rule decided that `KubePodCrashLooping` is a warning and `EndpointDown` is critical, and the route pages on critical. That works until the label and the situation disagree: a critical alert from a sandbox, a warning on a checkout outage, a probe that still fires for a service you turned off last month.

The question here is narrower than "can a model run on-call". Give a model the alert and a written policy, and ask it to make the one call a human makes first. The policy is short on purpose, the kind a team could actually keep up to date. In summary:

```text
Page    production, and customer impact now or within 1 hour:
        a tier 1 service down, >2% errors for 5+ min or p99 >2 s for 10+ min,
        a tier 1 SLO burning at 14x or faster,
        a database, cache or queue full within 1 hour,
        a public cert expiring in under 24 h, the primary DB unreachable,
        confirmed unauthorized access
Ticket  a real problem with no customer impact within the hour:
        tier 2 problems, tier 1 problems below the page thresholds,
        capacity gone in more than 1 hour but less than 7 days,
        certs expiring in 1 to 14 days,
        one pod or node failing while the service is fine,
        failed backups and jobs, staging problems that block a release
Ignore  non-production (unless it blocks a release),
        alerts that resolved within 5 minutes with no customer impact,
        heartbeats, deploy and autoscaling notices,
        maintenance windows and decommissioned or test targets
        (these two win even over a page)
        The severity label is a hint only.
```

The full text, including the list of tier 1 services, is in `POLICY.md`. Every model got the whole policy as its system prompt and one alert as the user message, about 720 input tokens per call, and was told to reply with one JSON object, `{"decision": ..., "reason": ...}`, and nothing else.

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

The alerts are generated, not collected. Real alert payloads would not come with a known correct answer, and hand-labelling 200 of them would test our labelling as much as the models. Instead, a seeded script uses 31 scenario templates. Each template has the decision the policy gives it, and draws its numbers (service, error rate, minutes firing, hours to expiry) from ranges that keep that decision. The text the models see is rendered from the same fields. Writing templates by hand can put mistakes in the text or the label, and one of ours did, as you will see.

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

Two numbers in that output need explaining. "Hard" marks alerts where a shortcut gives the wrong answer: the severity label points the wrong way, or the alert name sounds worse than the policy says it is. And 98 of the 200 severity labels are wrong **on purpose**. That makes the no-model baseline deliberately weak: it scores 51 percent and lets 14 of the 50 page-level alerts through. It measures whether a model reads the alert instead of the label. It says nothing about how a model compares with a well-written rules engine, which we did not test.

To check that the text carries what the labels assume, we gave one AI second reader, Codex, only `POLICY.md` and the 200 rendered alerts, never the labels, and asked it to label them. It agreed on all 200. Hold on to that number, because it turned out to be wrong in an interesting way.

## Results

Six models, three runs each, 3,600 calls. All six are open-weight models. Our account's key returned `403 this model is not available for your subscription tier` for the GPT-5 and Claude models we tried, so they are not in this test (the check is saved in the repo). DigitalOcean's Inference Router is in public preview, and its preview terms do not allow publishing test results without DigitalOcean's written consent, so this post covers the direct models only.

| Configuration            | Correct (of 600) | Page-level alerts missed in any run (of 50) | False pages per run | $ per 1,000 alerts | p50   | p95    |
| ------------------------ | ---------------- | ------------------------------------------- | ------------------- | ------------------ | ----- | ------ |
| DeepSeek V4 Flash        | 600              | 0                                           | 0                   | 0.157              | 4.4 s | 10.7 s |
| Qwen3.8-Max              | 600              | 0                                           | 0                   | 1.640              | 1.3 s | 2.6 s  |
| `gpt-oss-120b`           | 599              | 0                                           | 0                   | 0.194              | 3.1 s | 5.1 s  |
| Llama 4 Maverick         | 597              | 2                                           | 0                   | 0.189              | 1.9 s | 3.3 s  |
| `gpt-oss-20b`            | 595              | 3                                           | 0                   | 0.144              | 2.4 s | 5.3 s  |
| Ministral 3 14B          | 532              | 8                                           | 6.0                 | 0.149              | 0.8 s | 1.8 s  |
| Severity label, no model | 102 of 200       | 14                                          | 39                  | 0                  |       |        |

Costs are estimates: recorded token usage times DigitalOcean's list prices on 2026-10-14.

```chart
{
  "type": "bar",
  "title": "Wrong answers out of 600 (200 alerts, 3 runs)",
  "caption": "Lower is better. An empty reply counts as wrong. Ministral 3 14B got 68 of 600 wrong and is left out so the rest stay readable. Source: results/summary.json in the repo.",
  "rows": [
    { "label": "DeepSeek V4 Flash", "value": 0, "series": "direct" },
    { "label": "Qwen3.8-Max", "value": 0, "series": "direct" },
    { "label": "gpt-oss-120b", "value": 1, "series": "direct" },
    { "label": "Llama 4 Maverick", "value": 3, "series": "direct" },
    { "label": "gpt-oss-20b", "value": 5, "series": "direct" }
  ],
  "series": [{ "name": "direct", "color": "#0080ff" }]
}
```

```chart
{
  "type": "bar",
  "title": "Estimated cost per 1,000 alerts",
  "unit": "$",
  "caption": "Recorded token usage times DigitalOcean list prices checked 2026-10-14.",
  "rows": [
    { "label": "gpt-oss-20b", "value": 0.144, "series": "direct" },
    { "label": "Ministral 3 14B", "value": 0.149, "series": "direct" },
    { "label": "DeepSeek V4 Flash", "value": 0.157, "series": "direct" },
    { "label": "Llama 4 Maverick", "value": 0.189, "series": "direct" },
    { "label": "gpt-oss-120b", "value": 0.194, "series": "direct" },
    { "label": "Qwen3.8-Max", "value": 1.64, "series": "direct" }
  ],
  "series": [{ "name": "direct", "color": "#0080ff" }]
}
```

Two models scored 600 of 600, three more got between one and five wrong, and one is clearly not good enough. Ministral 3 14B is the fastest and among the cheapest, but it got 42 of the 200 alerts wrong in at least one run, missed 4.7 page-level alerts per run and gave the same answer in all three runs for only 80 percent of the alerts. It also ignored the format: 593 of its 600 replies had text around the JSON, and 17 contained two different decisions, typically an answer followed by a "correction".

That raises a scoring question, so here is the rule: the scorer takes the first decision in the reply, because an automated router would act on the first answer it can parse, and an empty reply counts as wrong. The repo records the first 400 characters of each reply from this run. The runner now keeps the full text for future runs.

The misses from the near-perfect models are worth reading, because they are the errors that hurt. Llama 4 Maverick called a Postgres database that would run out of connections in about 34 minutes a ticket, twice. Once it answered ticket for a public certificate expiring in 16 hours, then wrote "Wait, the correct response should be based on the given policy" and started a second answer, which we score as the ticket it gave first. `gpt-oss-20b` let three different Redis memory alerts through, all in its second run. Each of those replies would have suppressed a page that the policy requires.

## Latency is where the cheap model pays

DeepSeek V4 Flash matched Qwen3.8-Max's accuracy at about a tenth of the token cost. Latency goes the other way. It is a reasoning model, and 81 percent of its output tokens were reasoning, a median of 143 output tokens per call against Qwen3.8-Max's 33 tokens of plain JSON.

```chart
{
  "type": "bar",
  "title": "Latency per alert: p50 bar, p95 marker",
  "unit": "s",
  "caption": "Wall-clock time of the final attempt of each call, 600 calls per model; retries are not included (only Ministral 3 14B needed any, on 11 calls). The models ran one after another with 4 to 6 calls in flight, so service conditions may have differed between them.",
  "rows": [
    { "label": "Ministral 3 14B", "value": 0.8, "tick": 1.8 },
    { "label": "Qwen3.8-Max", "value": 1.3, "tick": 2.6 },
    { "label": "Llama 4 Maverick", "value": 1.9, "tick": 3.3 },
    { "label": "gpt-oss-20b", "value": 2.4, "tick": 5.3 },
    { "label": "gpt-oss-120b", "value": 3.1, "tick": 5.1 },
    { "label": "DeepSeek V4 Flash", "value": 4.4, "tick": 10.7 }
  ]
}
```

DeepSeek V4 Flash had 33 calls over 10 seconds and one at 60.6 seconds. For a ticket, four seconds does not matter. For a page, a minute does. If you put a model in front of your pager, give each call a timeout and decide in advance what a timeout means. The safe default is to page: a model that is slow or down should never be the reason an outage goes unheard.

## The bug the models found

In the first run, nobody scored 600. Qwen3.8-Max and `gpt-oss-120b` "got wrong" the same two alerts every time. This was one of them:

```text
status: firing
labels: alertname=PostgresPrimaryUnreachable env=production service=postgres-orders severity=critical team=platform
summary: postgres-orders primary not responding
description: The primary of postgres-orders has not answered health checks for 7 minutes.
startsAt: 2026-10-23T05:35:00Z
maintenance window: active until 05:00 UTC, change CHG-4200 (major version upgrade of postgres-orders)
```

Our label said ignore, because the alert carries a maintenance window. But the window, read as ending at 05:00 that morning, ended before the alert started at 05:35. Our generator picked the start time and the window separately and never checked that one was inside the other. Here is what three models said about this alert in run 1, copied from the run logs:

```text
qwen3.8-max:
{"decision": "page", "reason": "Production primary database unreachable for 7 minutes and the maintenance window ended at 05:00 UTC, so the page criteria apply."}

openai-gpt-oss-120b:
{"decision":"page","reason":"Production primary database is unreachable and no active maintenance window"}

llama-4-maverick:
{"decision": "ignore", "reason": "service is in an active maintenance window"}
```

Across the two broken alerts and three runs, Qwen3.8-Max and `gpt-oss-120b` paged all 6 times. Llama 4 Maverick and Ministral 3 14B trusted the word "active" all 6 times. DeepSeek V4 Flash paged three times, ignored twice and once used up its 2,000-token allowance on reasoning without giving a decision. `gpt-oss-20b` paged four times and ignored twice. The second reader that "agreed on all 200" had trusted the word too. After the fix, it labelled the two corrected alerts ignore, which matches their labels.

Three lessons from that:

1. **Agreement between two readers is not proof the labels are right.** Both can take the same shortcut. Here, the disagreements between models found what our check missed, so read them before you trust a score.
2. **A score is only as good as its labels.** With the bug in place, Llama 4 Maverick ranked first (99.5 percent) and Qwen3.8-Max third (99.0 percent), marked down for reading the timestamps.
3. **Real alerts can contain this kind of contradiction.** A silence that expired, a maintenance flag that nobody cleared. The models that read the times treated stale context the way an engineer should.

We fixed the inputs, not the labels: the generator now keeps maintenance alerts inside their window, only those two alerts changed (their start times moved to 03:00 and 04:35), and we reran them on every configuration. This correction came after we had seen the results, so treat the final numbers as exploratory rather than a clean holdout. The original two alerts and every configuration's answers to them are in `results/v1-maintenance-bug/` in the repo. The window text still has an end time but no date, which a stronger dataset would fix.

## What 200 alerts cannot tell you

Perfect scores on 200 alerts do not mean a perfect model. Alerts are the unit here (three runs of one alert are not three independent samples), so we count the alerts a model got wrong in at least one run and compute a one-sided 95 percent upper confidence limit on that share. These limits assume the alerts are a random sample, and they are not: they come from 31 templates. Read them as a sense of scale, not as a bound on production error rates:

| Configuration                  | Alerts wrong in any run (of 200) | Upper 95% limit | Page-level alerts missed in any run (of 50) | Upper 95% limit |
| ------------------------------ | -------------------------------- | --------------- | ------------------------------------------- | --------------- |
| DeepSeek V4 Flash, Qwen3.8-Max | 0                                | 1.5%            | 0                                           | 5.8%            |
| `gpt-oss-120b`                 | 1                                | 2.3%            | 0                                           | 5.8%            |
| Llama 4 Maverick               | 2                                | 3.1%            | 2                                           | 12.1%           |
| `gpt-oss-20b`                  | 5                                | 5.2%            | 3                                           | 14.8%           |
| Ministral 3 14B                | 42                               | 26.3%           | 8                                           | 27.0%           |

So "missed no pages" means "missed none of these 50", which is still consistent with missing about one in seventeen. Compared with Qwen3.8-Max, the other models except Ministral 3 14B were between 0 and 0.83 percentage points less accurate. A paired bootstrap over alerts puts `gpt-oss-20b` at -0.83 (95% interval -1.67 to -0.17), while the intervals for `gpt-oss-120b` and Llama 4 Maverick reach zero. When two models made identical calls, the bootstrap has nothing to resample, and that is not evidence that they are equivalent. We cannot rank DeepSeek V4 Flash and Qwen3.8-Max against each other from this data.

There is also what this test does not cover:

- **The alerts carry their own context.** Ours say which service is affected, whether a release is waiting and whether a maintenance window is active. Real alerts often do not, and getting that context into the prompt may be the hard part. We did not test alerts without it.
- **One policy, one invented company.** A messier policy, or one with judgement calls ("page if it looks bad"), may separate the models more. We did not test that either.
- **Only the models our key could call.** We did not test the GPT-5 or Claude models.

## Cost in perspective

Each call used about 720 input tokens and a median of 20 to 200 output tokens, depending on the model. At 10,000 alerts a month, which is a busy on-call rotation, the estimated token cost is $1.57 for DeepSeek V4 Flash and $16.40 for Qwen3.8-Max. The whole test, 3,600 scored calls plus 36 reruns, came to an estimated $1.50.

That changes the question. Neither bill matters next to a single missed page, so price should be the last thing you choose on. We tested each model on all three decisions, not a cascade where cheap rules or a cheap model sort alerts first and only some go to a second model. On this test, DeepSeek V4 Flash and Qwen3.8-Max made the same calls. Qwen3.8-Max answered in 1.3 seconds at the median and never took more than 6.6. DeepSeek V4 Flash cost a tenth as much and sometimes took ten seconds or more. If a few extra seconds before a page are acceptable to you, the cheap model is the better buy. Either way, test it on your own alerts first.

## Run it on your own alerts

The generator is the part to replace. Export a few hundred real alerts from Alertmanager, write the decision a senior on-call engineer would make next to each one in the same JSON shape as `data/alerts.jsonl`, and run the same scripts on a clean results directory. The runner skips any call it already has on disk, so leftover results from our run would be reused:

```bash
git clone https://github.com/The-DevOps-Daily/alert-triage-bench
cd alert-triage-bench
cp .env.example .env   # add your model access key
set -a; . ./.env; set +a

rm -rf results/raw && mkdir results/raw                # start clean
node scripts/03-run-models.mjs --runs 3 --budget 5     # stops near $5
node scripts/04-score.mjs                              # writes results/summary.md
```

The budget is checked after each call, so the calls already in flight can take it a little past the limit.

What we would do with the results:

- **Write the policy down first.** Every model in this test, even the weak one, beat a deliberately misleading severity label by a wide margin, and all of them were reading the same 31 non-blank lines of policy.
- **Score missed pages separately from accuracy.** A model can be 99 percent accurate and still miss the one alert that mattered.
- **Run each alert more than once.** One run hides models that change their mind.
- **Read the cases where the models disagree with your labels.** In our test, some of them exposed contradictions in our own inputs.
- **Time out to a page, not to silence.** The model is a filter in front of your pager, never a reason for it to stay quiet.

On this test, with this policy, the cheap model was good enough. The price difference was never the thing to worry about. The latency, the missed pages and the labels were.
