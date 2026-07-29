---
title: 'Your CI Log Is 4,000 Lines. The Answer Is 26 of Them.'
excerpt: 'We built a GitHub Action that reads a failing job log and tells you what broke, using DigitalOcean serverless inference. The interesting part was not the model call. It was throwing away 92% of the log before sending it.'
category:
  name: 'CI/CD'
  slug: 'ci-cd'
date: '2026-07-29'
publishedAt: '2026-07-29T09:00:00Z'
updatedAt: '2026-07-29T09:00:00Z'
readingTime: '11 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - CI/CD
  - GitHub Actions
  - AI
  - DigitalOcean
  - DevOps
---

A CI job fails. You open the run, scroll past four hundred lines of dependency resolution, past the tests that passed, past the warnings you have been ignoring for a year, and somewhere near the bottom you find the twelve lines that actually matter.

You do this several times a week. It is not hard, it is just tedious, and it is exactly the shape of problem that cheap inference is good at: a lot of text, a small answer, no need for the model to be clever.

So we built it. A GitHub Action that takes a failing job's log and posts what broke, why, and what to try first. It runs on [DigitalOcean's serverless inference](https://docs.digitalocean.com/products/gradient-ai-platform/), the code is [on GitHub](https://github.com/The-DevOps-Daily/ci-log-triage), and the whole thing is about 400 lines.

The interesting part turned out not to be the model call. That was twenty lines. The interesting part was everything we did before it.

```github
https://github.com/The-DevOps-Daily/ci-log-triage
```

## TLDR

- Sending the whole log works and is the wrong instinct. Reducing it first cut 92.5% of the bytes and made the answers better.
- Stripping GitHub's per-line timestamp prefix alone moved the reduction from 86% to 92.5%, because it repeats on every single line.
- DigitalOcean's inference API is OpenAI-compatible, so any OpenAI client works against `https://inference.do-ai.run/v1`.
- Reasoning models fail in a way that looks exactly like a broken API key. Budget for it.
- A tool that explains failing builds must never fail a build. Ours exits 0 no matter what.

## Prerequisites

- A DigitalOcean account with a model access key and a prepaid balance
- A repository with CI that fails sometimes, which is all of them
- Node 20 or newer if you want to run the CLI locally

## The naive version works, and you should not ship it

The first version of anything like this is four lines:

```js
const log = await fetchJobLog(runId);
const answer = await model.chat(`Why did this fail?\n\n${log}`);
```

This works. It also sends 25KB of mostly-irrelevant text on every failure, and the answer is worse than it needs to be, because the actual error is buried in four hundred lines of `npm info resolving`.

Both problems have the same fix.

## Reducing the log

Here is the shape of a real failing deploy log, one of ours:

```text
272 lines
25,534 characters
of which roughly 26 lines explain the failure
```

The reduction runs in three passes.

**Strip the per-line prefixes.** This one is worth more than it looks. GitHub prefixes every line with an ISO timestamp, and `gh run view --log` prefixes it further with the job and step name:

```text
deploy	Deploy to DigitalOcean VPS	2026-07-27T13:57:14.3928847Z ERROR: relation "Segment" does not exist
```

That is 62 characters of prefix on a 48-character message, repeated on every line in the file. Stripping it took our reduction from 86% to 92.5% on its own. ANSI colour codes go the same way.

**Keep a window around anything that looks like a failure.** Error, failed, exception, panic, traceback, exit code, permission denied. Keep eight lines either side, because the line that says `Error:` is rarely the line that tells you why.

**Always keep the tail.** Some failures end quietly, with a non-zero exit and nothing dramatic. The last 25 lines come along regardless.

```js
export function extractRelevant(raw, opts = {}) {
  const { context = 8, tail = 25, maxLines = 160 } = opts;
  const all = raw.split('\n').map(cleanLine);
  const keep = new Set();

  all.forEach((line, i) => {
    if (isNoise(line) || !isSignal(line)) return;
    for (let j = Math.max(0, i - context); j <= Math.min(all.length - 1, i + context); j++) {
      keep.add(j);
    }
  });

  for (let i = Math.max(0, all.length - tail); i < all.length; i++) keep.add(i);
  // ...
}
```

One detail that matters more than it should: mark the gaps.

```text
Applying migration `20260727130000_team_scoped_unique_constraints`
... 41 lines omitted ...
ERROR: relation "Segment" does not exist
```

Without the marker the model sees two adjacent lines and reasons about them as if they happened in sequence. With it, it knows something was cut and says so when it matters.

On our example: **25,534 characters down to 1,926. 272 lines down to 26.**

## Calling DigitalOcean inference

The API is OpenAI-compatible, so there is nothing to learn:

```js
const res = await fetch('https://inference.do-ai.run/v1/chat/completions', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'openai-gpt-oss-20b',
    messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: log }],
    max_tokens: 1200,
  }),
});
```

Any OpenAI SDK works if you point `baseURL` at it. We used plain `fetch` so the Action has no dependencies to install, which keeps the job fast.

At the time of writing there are 74 models on the endpoint, and serverless inference is billed per token from a prepaid balance rather than by reserved GPU hours, which is the model that makes a per-CI-failure tool sensible in the first place.

:::warning
**Commercial models are gated by subscription tier.** Requesting an Anthropic model on a base account returns `403 this model is not available for your subscription tier`. The open-source models work without that. Worth finding out before you design around a specific one.
:::

## The prompt is a format, not a request

The difference between a useful answer and a paragraph of hedging is telling the model exactly what shape to produce:

```text
**What failed:** one sentence naming the step and the proximate cause.

**Why:** two or three sentences on the underlying reason. If the log does not
say, write what it would take to find out. Never invent a cause.

**Try this first:** one concrete action.

Rules:
- Quote the exact error string once, in backticks.
- If several things failed, address the earliest one that could have caused the rest.
- If the log is truncated or inconclusive, say so plainly instead of guessing.
```

"If the log does not say, write what it would take to find out" is the line that earns its place. Without it you get confident guesses. With it you get a model that says the log is inconclusive, which is a genuinely useful answer.

## The gotcha that cost us an hour

Our first call returned HTTP 200, a valid response body, and an empty string.

`openai-gpt-oss-20b` is a reasoning model. It puts its thinking in `reasoning_content` and the answer in `content`. We had set `max_tokens` low while testing, so the model spent the entire budget reasoning and had nothing left for the answer:

```json
{
  "finish_reason": "length",
  "message": { "content": null, "reasoning_content": "The user says..." }
}
```

An empty string with a 200 status looks exactly like a broken API key, which is what we spent the first ten minutes checking. The fix is to give it room, and to detect the case explicitly:

```js
if (!content && choice?.finish_reason === 'length') {
  throw new InferenceError(
    'Model returned no content: the token budget was consumed by reasoning. ' +
      'Raise max_tokens or use a non-reasoning model.',
  );
}
```

If you are comparing models, note that reasoning shows up in your completion tokens. On the same log, `openai-gpt-oss-20b` used 527 completion tokens against `llama3.3-70b-instruct`'s 229, because one of them thinks first.

## Wiring it into a workflow

The Action runs as a separate job that only fires when the build fails:

```yaml
  triage:
    needs: build
    if: always() && needs.build.result == 'failure'
    runs-on: ubuntu-latest
    permissions:
      actions: read          # to read the failing job's log
      pull-requests: write   # only if you want a PR comment
    steps:
      - uses: The-DevOps-Daily/ci-log-triage@main
        with:
          do-api-key: ${{ secrets.DO_INFERENCE_KEY }}
          pr-number: ${{ github.event.pull_request.number }}
```

It fetches the failed job's log through the GitHub API, triages it, writes the report to the job summary and the log, and upserts a single PR comment rather than stacking one per run.

:::important
**The triage step exits 0 even when it fails.** A tool that explains broken builds should never be the reason a build breaks. If the API is down, the key is wrong, or the log is empty, it says so and exits cleanly. The build is already red; adding a second red X helps nobody.
:::

## What it actually says

From the demo workflow, which fails on purpose:

```text
### Why `build` failed

**What failed:** The `db.test.js` test step failed because it could not
connect to the database at `127.0.0.1:5432`.

**Why:** `connect ECONNREFUSED 127.0.0.1:5432` means the test attempted a
TCP connect to that port and was rejected, indicating no PostgreSQL process
was listening there. In the CI log we see no step that starts a database
server, so the test likely ran before Postgres was available.

**Try this first:** Add an explicit step to start PostgreSQL before running
tests.
```

The second paragraph is the part worth noticing. "We see no step that starts a database server" is not pattern-matching the error string. It is a statement about what is *absent* from the rest of the log, which is the kind of thing the reduction step preserved by keeping context rather than just the error line.

We also pointed it at a real failure from our own repo: a Prisma migration that died with `relation "Segment" does not exist`. It named the error, then suggested the cause might be "a naming or schema mismatch between the Prisma schema and the database". That was exactly right, and it took a human two wrong turns to get there.

## What it costs

Per failure, measured:

```chart
{
  "type": "bar",
  "title": "Tokens per triage, same failing log",
  "unit": " tokens",
  "caption": "One real 25KB deploy log, reduced to 1.9KB before sending. Prompt tokens differ slightly because the two runs reduced marginally different logs.",
  "rows": [
    { "label": "gpt-oss-20b prompt", "value": 753, "series": "prompt" },
    { "label": "gpt-oss-20b completion", "value": 527, "series": "completion" },
    { "label": "llama3.3-70b prompt", "value": 733, "series": "prompt" },
    { "label": "llama3.3-70b completion", "value": 229, "series": "completion" }
  ],
  "series": [
    { "name": "prompt", "color": "#0080ff" },
    { "name": "completion", "color": "#f59e0b" }
  ]
}
```

Roughly 1,300 tokens per failure on the reasoning model, about 960 on the non-reasoning one, and 5 to 9 seconds end to end. Without the reduction step the prompt alone would have been closer to 7,000 tokens.

Latency varied between runs on the same model and log, from 4.3 to 8.5 seconds. It is a shared pool, so treat any single measurement as an anecdote.

## Would we leave it on?

For a repo where CI fails a few times a week, yes. The cost is small enough not to think about, the report lands in the job summary before you have finished switching tabs, and the failure mode is that it says something unhelpful, which costs you nothing.

For a monorepo failing forty times a day, we would want a cheaper model and probably a filter so it only triages the first failure on a branch.

The thing we would not change is the reduction step. It is the difference between a tool that costs almost nothing and one that costs enough to argue about, and it made the answers better rather than worse. Sending everything and letting the model sort it out is the obvious approach, and it is worse in both directions at once.

Code is at [The-DevOps-Daily/ci-log-triage](https://github.com/The-DevOps-Daily/ci-log-triage). It is MIT, the log reduction is a pure function with tests, and it will work against any OpenAI-compatible endpoint if you would rather point it somewhere else.
