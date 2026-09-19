---
title: 'We Measured the 200x Claim, and Got It Wrong Twice First'
excerpt: 'Last week we told you to measure a vendor claim on your own workload instead of repeating it. Then we got access, did exactly that, and produced two confident numbers that were both artefacts of our own bad method. Here is the real result, and the two mistakes, which are more useful than the result.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-09-19'
publishedAt: '2026-09-19T15:00:00Z'
updatedAt: '2026-09-19T15:00:00Z'
readingTime: '14 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - AI
  - LLM
  - Benchmarking
  - Jev
  - Observability
  - FinOps
---

Last week we wrote about [the classification problem hiding in your LLM bill](/posts/most-of-your-llm-calls-are-classification), and about how to read a "193.6x faster" claim before repeating it. The post ended with a line admitting we had no access to the model in question, so every figure in it was the vendor's.

We have access now. So we ran it against a real production workload, next to that workload, with the same inputs going to both models.

The headline result is fine and slightly boring. The interesting part is that we produced two confident, wrong numbers before we got there, and one of them was the exact mistake we had criticised the vendor for a week earlier.

## TLDR

- On our workload, end to end, the new model was **12x faster** at the median. Adjust for the fact that our old model also writes three paragraphs nobody reads and it is closer to **3x**, depending on how you do the adjusting.
- It looked **7x cheaper**, but **83% of our current bill is output billing** and the new model's published tariff prices input only. That is not a like for like comparison, and we say so rather than quoting the 7x.
- The result that mattered was not speed. It was **variance**: 38ms of spread against 2353ms, on a call a human sits and waits for.
- Typed output removed a real defect. **Three replies in fifty** came back as prose our parser could not read, and on this route a parse failure is an error page.
- **We got the method wrong twice.** Once by not reading how the API works, once by scoring a feature against accounts it had never seen. Both produced numbers that looked like findings.

## Prerequisites

- A workload of your own to measure. This post is not useful applied to someone else's benchmark.
- Somewhere to run the test that is near the thing being tested, not your laptop.
- A way to tell whether an answer was right, that is not another model's opinion.

## What we were measuring

The workload is real and small enough to describe completely. A transactional email service has an admin page with a button on it: review what this account has been sending. Pressing it gathers aggregate counts and short samples of an account's recent mail, hands them to a model, and gets back a classification from a fixed list, a confidence, and a few sentences of reasoning.

Two things make it a good test subject. It is a bounded decision, which is exactly the shape the new model class claims to be built for. And the button `await`s the model inside the request handler, so the admin sits there until it answers. Latency is not an abstraction, it is someone tapping a desk.

The comparison is between the model we already run, a mid-size open model on a serverless inference endpoint, and Jev, from TypeSafe AI. Not a frontier model, which matters when reading their published multiple.

## Mistake one: not reading the shape of the tool

The API takes a state object and a set of typed questions. We asked it two: which category is this account, and what should the operator do about it. Each question gets a list of options and returns one of them with a probability for each.

The first run looked spectacular. It caught every bad account in the sample. A hundred percent.

It also recommended suspending an account it had, in the same response, classified as a developer running test sends. That is not a borderline call. It is incoherent, and incoherent results are a gift, because they are impossible to talk yourself into.

The documentation says it plainly: questions in one request run in parallel and cannot see one another's answers. It is in their [guidance on composing questions](https://docs.typesafe.ai/concepts/how-to-build-with-system-one.md), alongside the advice to keep policy in code and raw judgments reusable, which is the fix we ended up applying. Our second question was choosing an action without knowing the verdict, so it was guessing from the raw state every time, and its guess skewed hard toward the severe option.

The model we already run does not hit this particular failure, because it produces its verdict and its action in one pass of generated text, so the action is written after the verdict. That is not a guarantee of consistency, it just removes the way we broke it here.

The fix is the one their own guidance recommends: keep the policy in code.

```ts
// The rule the text model gets in its prompt, written out instead of asked for.
function deriveAction(verdict: Verdict, confidence: number): Action {
  if (verdict === "spam" || verdict === "phishing") {
    return confidence >= 80 ? "suspend" : "hold_sends";
  }
  if (verdict === "suspicious" || verdict === "unclear") return "watch";
  return "none";
}
```

Ask the model for the judgment. Derive the decision yourself. It is faster, one question instead of two, it is auditable, and it cannot contradict itself.

The general lesson is not about this API. It is that a benchmark comparing two tools has to give both of them their best shape. We had accidentally handed one of them a question it could only answer blind, and the result was a number flattering enough that we nearly wrote it down.

## Mistake two: the population that never existed

With the harness fixed, we needed to know whether the answers were any good, not just fast.

Ground truth was the part we were pleased with. Not another model's opinion, which is the thing we criticised in the last post, but real outcomes: accounts a human administrator had actually suspended, and accounts still running normally. Independent of both models, because this feature is advisory and has never suspended anyone.

The result came back stark. Across the eight human-suspended accounts that both models scored, neither ever reached the two verdicts that trigger action, spam or phishing, except twice from Jev. The model we run reached them zero times.

That reads as a strong finding. It says the feature does not work, and that swapping the model would only make a broken thing faster. We said so, twice, with some confidence.

It was wrong, for two reasons that compound.

The feature had its first run on 7 September. Of the fourteen suspended accounts on record, twelve were suspended between May and August, before it existed. Ten of those fourteen were suspended by a human; the rest were automatic reputation suspensions, which are a different question. The models scored eight of the human ones.

And the sample they receive counts volume over a trailing thirty day window. For eight of the ten human-suspended accounts, every counter read zero:

```text
volume: { last24h: 0, last7d: 0, last30d: 0, sampled: 50 }
```

Both models were being asked to judge accounts that had not sent anything in a month, and both answered that nothing much was happening. Which is correct. A dormant account is not a threat.

That input does not occur in production, because reviews only fire on accounts that are actively sending. We had built a test population that cannot exist, then drawn a conclusion about a feature from how two models behaved on it.

There is a second problem with how we counted. We had defined a catch as reaching spam or phishing. But the model we run called four of those eight accounts **suspicious**, and a suspicious verdict already raises an alert for an administrator. Under the definition that matches what the system actually does, it was not silent at all. We had picked a threshold that made it look silent.

Only two of the accounts were suspended after the feature existed and still had real recent volume, so only two were a fair test. On the first, Jev said phishing and recommended suspension, and our model returned one of its three unreadable replies, so it gave no verdict at all. On the second, both said suspicious, which alerts.

Two cases do not prove a feature works. What they do is remove the evidence that it was broken, which is the claim we had been about to publish.

This is the same mistake as benchmarking from a laptop on the other side of the country. Not identical in mechanism, identical in kind: a measurement taken in conditions that do not match the thing you are claiming to describe.

## What the numbers actually are

Fifty accounts, one call to each model per account, identical state, run on the same host as the workload rather than from a laptop.

Three of the fifty are missing from every figure below, because our existing model answered with text the parser could not read and the harness recorded no timing for those attempts. Two were accounts a human had suspended and one was an automatic reputation suspension, so all three come from the half of the sample we most wanted to see it handle. The latency and cost numbers therefore describe our model only on the calls where it succeeded. We cannot say which way that biases them, because we have no measurements for the calls it failed. Forty-seven complete pairs remain.

```chart
{
  "type": "bar",
  "title": "Time to answer, same workload, same inputs",
  "unit": "ms",
  "caption": "47 complete pairs out of 50 accounts, one call each, run on the application host. The 3 excluded are calls our existing model answered unparseably, with no timing recorded. Lower is better.",
  "rows": [
    { "label": "median", "value": 7326, "series": "existing model" },
    { "label": "p95", "value": 11517, "series": "existing model" },
    { "label": "worst", "value": 12713, "series": "existing model" },
    { "label": "median", "value": 605, "series": "Jev" },
    { "label": "p95", "value": 671, "series": "Jev" },
    { "label": "worst", "value": 687, "series": "Jev" }
  ],
  "series": [
    { "name": "existing model", "color": "#64748b" },
    { "name": "Jev", "color": "#f59e0b" }
  ]
}
```

Twelve times faster at the median. Before repeating that, do to it what we told you to do to the vendor's number.

Our existing model writes prose as well as a verdict: a median of 459 output tokens per call, against 138. So it is doing more work, and some of the 12x is that rather than speed.

Divide latency by output tokens and the gap narrows to roughly **3x**. Roughly, because how you average changes the answer:

- take the per-call rate for each request, then compare the medians: **3.2x** (14.0ms against 4.4ms per output token)
- take the median latency and the median token count, then divide those: **3.6x**

We are quoting the first, which is the more conservative of the two. Neither is wrong. The point is that two reasonable methods land 14% apart on the same data, which is worth knowing before anyone quotes a decimal place back at you.

Be careful what this adjusted figure means. It is not a measure of raw model speed: it still contains the network, the queueing and the time to read the input, none of which scale with output length. It says the workload as we run it is 12x, and that a meaningful part of that is our own choice to ask for paragraphs. It does not prove we would get most of that back by shortening the prompt. We have not run that test, so we are not claiming it.

### The number we did not expect

The spread. Across 47 calls, Jev's slowest was 687ms and its fastest 526ms, a standard deviation of 38ms. Our existing model ranged from 3.9 to 12.7 seconds, a standard deviation of 2353ms.

For a background job, nobody cares. For a button a person is waiting on, the p95 is the experience, and a p95 of 11.5 seconds is a button people learn not to press. Predictability turned out to matter more than the average, which is not what we went looking for.

### Cost, which is mostly not about the model

At published prices, $0.055 per million input tokens and $0.85 per million output for our current model, and $42 per billion input tokens for Jev:

- existing model: **$0.52 per 1000 reviews**
- Jev: **$0.07 per 1000 reviews**

That is 7x, and it is the number we trust least in this post.

Split our own bill and the reason is obvious: **$0.089 of input and $0.435 of output** per 1000 calls. Output is 83% of it, because output costs 15.5x input on that provider.

Now the problem. The tariff we were given for Jev prices **input only**, and we could not find a published output price. So the comparison above charges one model for what it writes and the other not at all. Per input token, the side we can actually compare, the list prices are $0.055 and $0.042, which is **1.31x**. On this run the input spend came out 1.18x apart, because Jev's structured state used about 10% more input tokens than our rendered prompt did.

So the honest version is: on the part that is comparable they are close, and the 7x depends on an output price we do not have. If you are making a purchasing decision on this, get that number first.

So it is cheaper because it says less. Any vendor comparison where one side is answering a different question is really a comparison of the questions.

### The defect that was worth more than the speed

Three of fifty calls to our existing model returned text our JSON parser could not read. On this route a parse failure becomes an error page, so roughly one press in sixteen ended in a failure rather than an answer.

We cannot tell you how long those three waited. The harness recorded no timing for a call it could not parse, which is a hole in our instrumentation rather than a finding. A successful call takes 7.3 seconds at the median, so the wait was probably in that region, but probably is not measured and we are not going to print a number we do not have.

A model whose API contract is "return one of these options" cannot fail that way. Not "fails less often". Per their [API reference](https://docs.typesafe.ai/api.md) the answer is one of the values you supplied, or the request errors and you handle it. We validate the returned value against our own list anyway, because a contract is a promise about an interface and not a reason to stop checking. That was the most concrete improvement of the day and it had nothing to do with being fast.

Typed output still guarantees only the interface. A valid category that is the wrong category is still wrong, and no schema will tell you. But the class of failure where the model writes a perfectly good paragraph into a field expecting an enum goes away entirely.

## What we changed

The admin button now calls the fast model and comes back in about 600ms with a verdict and a probability for every category. The written reasoning became a second button, because it costs several seconds and the reader usually does not want it.

Showing the distribution instead of prose turned out to be an improvement on its own. Four well-formed sentences read as confidence whatever the model actually thought. This does not:

```text
phishing        83%
testing          8%
suspicious       7%
spam             2%
```

Background reviews, where nobody is waiting, still use the existing model. And the choice lives in a settings row rather than an environment variable, so going back is one request with no deploy. If you are trialling a vendor in a path that matters, build the way back before you need it.

## What to take from this

The numbers are ours and they will not be yours. The method is transferable.

**Measure next to the workload.** We said this last week about someone else's laptop benchmark. It is easy to agree with and easy to skip.

**Give both tools their best shape.** We asked one side a question it could only answer blind, then scored it on the answer. That measures our misunderstanding of the interface, not the tool.

**Check that your test population can actually occur.** This is the one we would have caught if we had asked a single question earlier: does this input ever reach the thing in production? Eight of our ten cases could not have.

**Divide the headline by what is actually different.** 12x became about 3x once we accounted for output volume, and the 7x on cost fell apart once we noticed we were charging one model for its output and the other not at all. Neither of those makes the tool worse. They move the credit to the right place, and they tell you which number to go and get next.

**Be suspicious of a result that flatters you.** Both of our wrong numbers were interesting. A 100% catch rate was interesting. "The feature is broken" was interesting. What survived checking is duller: about 3x once you adjust, a cost comparison we cannot complete, and no evidence either way about detection. Dull is not proof of correctness, but interesting is a reason to look twice.

We published a checklist last week for reading other people's numbers. Most of it applies to your own, and your own are the ones you are most likely to believe.

*Performance figures here are our measurements on one workload on 19 September 2026, run on the application host. TypeSafe AI's published claims are their own, measured differently, against different models. Our raw harness is in the repository that produced these numbers.*
