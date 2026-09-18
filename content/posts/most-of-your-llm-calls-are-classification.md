---
title: 'Most of Your LLM Calls Are Classification Problems'
excerpt: 'Routing, tagging, triage and extraction are classification wearing a chat interface. A new model class is arguing that point loudly, with numbers worth reading carefully. Here is how to tell whether the argument applies to your pipeline, and how to read a 200x claim before you repeat it.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-09-18'
publishedAt: '2026-09-18T15:00:00Z'
updatedAt: '2026-09-18T15:00:00Z'
readingTime: '10 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - AI
  - LLM
  - Architecture
  - FinOps
  - Benchmarking
---

Look at where the model calls sit in your systems. Not the chat feature, the plumbing.

Something decides which team a ticket belongs to. Something decides whether a log line is a real failure or noise. Something reads an invoice and pulls out four fields. Something looks at a support message and picks one of six labels.

None of those are generation. Every one is a function from some text to a small set of outcomes, and you are paying a model that can write a sonnet to return the string `billing`.

That is the argument a new class of model is making, and it is worth taking seriously even if the specific product turns out not to matter. It is also an argument that arrives wrapped in some very large numbers, which is the part worth slowing down for.

## TLDR

- **Classification and generation are different jobs.** Most model calls in a production pipeline are the first kind, priced and latency-budgeted as though they were the second.
- **TypeSafe AI's Jev** is a "System One model", small and fast, built to return structured decisions. Their headline claims are **193.6x faster and 244.6x cheaper** than frontier models on their own workflow evals.
- **Read those numbers before repeating them.** Their benchmarks were, in their words, "generally run from our laptops on the West Coast", which measures network latency as much as inference.
- **There is no ground truth in their evals.** They compare predictions against other models' reference probabilities, not against correct answers, and report no accuracy percentages.
- **Type-safe is not the same as correct.** A guaranteed-valid enum that is the wrong enum is still wrong, and that distinction matters well beyond this one vendor.
- **The underlying point stands regardless.** Work out which of your calls are classification, then measure your own baseline before shopping.

## Prerequisites

- A system that calls a model somewhere in its pipeline.
- Access to your own latency and cost numbers for those calls. If you do not have them, that is the first job, and it is a bigger win than any model swap.

## The shape of the mismatch

A frontier model is a general-purpose engine. It can hold a conversation, write code, summarise a contract and, incidentally, tell you whether a support ticket is about billing.

That last capability is real, and it is also the cheapest thing it does, sold at the price of the most expensive thing it does.

The mismatch shows up three ways:

**Latency.** A classification in a request path has a budget measured in tens of milliseconds. A frontier model call, including the network, is usually measured in seconds. So the classification gets moved to a queue, and now you have a queue to operate.

**Cost.** Per call it looks like nothing. Multiply by every ticket, every log line, every inbound message, every retry, and it becomes a line item somebody asks about.

**Shape of the output.** You want one of six labels. You get prose that usually contains one of six labels, so you write a parser, and then you write a fallback for when the parser fails, and then you write a metric for how often the fallback fires. That code is not incidental. It is most of the integration.

If you have written that parser, you have felt the mismatch.

## What is being proposed

[TypeSafe AI](https://www.typesafe.ai/) released a model called Jev, which they describe as a **System One model**, borrowing Kahneman's split between fast intuitive thinking and slow deliberate reasoning. The pitch is a model built to make fast structured decisions that software consumes directly, rather than a general model persuaded to emit JSON.

Their published claims, all theirs and none verified by us:

| | claimed |
|---|---|
| Speed | 193.6x faster on their workflow evals; 70ms to 500ms end to end |
| Cost | 244.6x cheaper; $0.042 per million input tokens, output tokens free |
| Errors | Zero type errors, by construction |

**We have not tested it.** There is no access at the time of writing, so everything in that table is a vendor number and should be read as one.

The idea is not novel and that is a point in its favour: small specialised classifiers have always beaten general models on narrow tasks, on every axis except convenience. What is new is packaging that as a hosted API with typed output, which is the part that was previously your problem.

## How to read a 200x claim

This is the transferable skill, so it is worth doing properly on a live example rather than in the abstract.

TypeSafe published their methodology, which is more than many do, and it contains three things that change how much weight the headline can carry.

### Where was it run

> "generally run from our laptops on the West Coast"

A laptop measuring two hosted APIs is measuring **the network** at least as much as the inference. Their comparison figure for a frontier model on a classification task was **8.566 seconds**. That is not a plausible compute time for a short classification; it is a plausible round trip including queueing, cold paths and distance.

Move the laptop and both numbers move. That does not make the ratio meaningless, but it means the ratio belongs to that laptop on that day, not to the models.

We have hit exactly this in our own writing. A benchmark we published a few days ago compared a warm HTTP connection against a cold Postgres connect and made one look eight times faster than it was. The p95 column was screaming and nobody looked. **Measurement setups lie quietly, and they lie in the direction you were hoping.**

### What was it compared against

Their evals compare model predictions against **reference probabilities from other top-tier models**, on the assumption that a correct compute graph exists. There is no labelled ground truth.

That is a legitimate way to measure *agreement*. It is not a way to measure *accuracy*. If the reference models are wrong about a case, a model that agrees with them scores well.

The blog reports **no traditional accuracy percentages at all.** For a classifier, that is the number that decides whether anything else matters.

### What does "zero hallucinations" mean here

They are explicit, to their credit, that this rests on *"mathematical guarantees rather than empirical testing"*.

Read that carefully, because it is the most useful sentence in the whole announcement:

**A guarantee of type validity is not a guarantee of correctness.**

Constrained decoding can make it impossible to return anything but one of your six labels. That eliminates the parser, the fallback and the metric, which is genuine engineering value. It does nothing whatsoever about picking the wrong label. A classifier that confidently returns a valid `billing` for every message about refunds has zero type errors and is completely useless.

This applies to every structured-output feature you use, not just this one. Schema-constrained generation solves parsing. It does not solve being right.

To their credit again, TypeSafe say their workflow evals likely represent *"the higher end of real world gains."*

## What to do with this

The vendor question is undecided. The engineering question is not, and you can act on it today.

### 1. Find out which of your calls are classification

Go through your model call sites and sort them:

```text
generation      summarise this incident for the status page
                draft a reply the human will edit
                explain this failing test

classification  which team owns this ticket
                is this log line a real failure
                is this email spam
                which of these six categories
                extract these four fields
```

The second list is usually longer than people expect, and it is the list where a specialised model, a fine-tune, or in several cases a boring old classifier would do the job.

### 2. Measure your own baseline first

Before any of this is a purchasing decision, it is a measurement problem. For each classification call site you want:

```text
p50 and p95 latency, measured from where the caller sits
cost per 1,000 calls at your real token counts
accuracy against a set of examples you labelled yourself
how often the output needed reparsing or retrying
```

That last line is the hidden cost nobody puts in the business case, and the first three are what makes a vendor's ratio either relevant or irrelevant to you.

**If you cannot produce those four numbers today, that is the project.** Not the model swap.

### 3. Build the eval set before you shop

A hundred examples you labelled by hand, drawn from your real traffic, including the ambiguous ones. It is a dull afternoon and it is the only thing that will tell you whether a 200x faster model is 200x faster at being wrong.

It also outlives any particular vendor. Models will keep arriving; the eval set is the asset.

We built something close to this when we wrote about [explaining CI failures automatically](/posts/ci-log-triage-digitalocean-inference), and the lesson there was the same shape: the interesting engineering was not the model call, it was everything around it. Throwing away 92% of the log before sending it mattered more than which model read the remainder.

### 4. Then look at the price

Once you have a baseline and an eval set, a cheaper faster model is easy to evaluate: run it against your examples, compare accuracy to your current setup, and do the arithmetic with your own volumes.

At that point a vendor's benchmark is a hint about where to look, not evidence about your system. Which is all any vendor benchmark ever is.

## What I would watch for

If you are tracking this category rather than buying today, the things that would move it from interesting to credible:

- **An accuracy number on a public labelled benchmark**, not agreement with other models
- **Third-party measurement** from a machine that is not the vendor's laptop
- **A published failure mode.** Every classifier has inputs it is bad at, and a vendor who names theirs is telling you they have looked

None of those exist yet for this particular model. That is normal for a launch and it is also the reason to keep your money in your pocket for now.

## Summary

The interesting claim is not the speed. It is that a large fraction of production model calls are classification wearing a chat interface, priced and shaped as though they were generation.

That part is true regardless of who ends up selling the solution, and you can act on it this week without buying anything: find the call sites, measure them properly, and label a hundred examples.

Then, when something really is 200x faster, you will be one of the few people able to tell.

*All performance figures attributed to TypeSafe AI are their published claims. We have not tested Jev and had no access at the time of writing.*
