---
title: 'We Built an On-Call Agent in Mastra: Where It Won and Where It Would Not'
excerpt: 'Most agent tutorials stop at the happy path. We built a real on-call agent on Mastra, then killed the process with SIGKILL at the exact moment it rolled back a deploy. It recovered the run. It also rolled the deploy back a second time. Here is what durable execution actually guarantees, and the code that makes it safe.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-08-12'
publishedAt: '2026-08-12T09:00:00Z'
updatedAt: '2026-08-12T09:00:00Z'
readingTime: '16 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - DevOps
  - AI
  - Agents
  - TypeScript
  - SRE
  - incident-response
---

Every article about agent frameworks agrees that durable execution is the feature that matters. Almost none of them kill the process to find out what durable actually means.

So we built one and killed it. The agent is an on-call responder: it takes an alert, triages it, gathers evidence, proposes a fix, waits for a human to approve, performs the action, and writes the handover note. Then we sent it `SIGKILL` at the worst possible instant, the moment after it rolled back a production deploy and before the step finished.

It recovered. It also rolled the deploy back a second time.

That is the useful finding, and this post is mostly about it: what Mastra gave us for free, what it did not, and the roughly ten lines that make the difference between an agent that is crash-safe and one that only looks crash-safe. Everything here is reproducible from [the repo](https://github.com/The-DevOps-Daily/mastra-oncall-agent).

## TL;DR

- The **approval gate is the real win**. A step suspends, the process exits, and a different process hours later resumes the run exactly where it stopped. Without a framework you build this yourself, and you will build it worse.
- After a `SIGKILL` mid-action, storage showed the run stuck: every earlier step `success`, the dying step `running` forever, and `suspendedPaths` empty, so `resume()` could not help it.
- `restartAllActiveWorkflowRuns()` recovered it and drove the run to completion. **It also re-executed the interrupted step**, so the rollback happened twice.
- Durable execution is **at-least-once, not exactly-once**. That is true of Temporal, DBOS and Restate as well. It is a property of the model, not a defect in Mastra.
- An idempotency key derived from the run id fixes it. Same crash, same recovery, action runs once.
- A small eval caught a plausible prompt "improvement" that silently stopped paging for a customer-facing outage. Same result on three different models.

## Prerequisites

- Comfort with TypeScript and `async`/`await`
- A rough idea of what an LLM tool call is
- Node.js 22+ if you want to run the repo (it uses native type stripping)

## What we built

Six steps. Two of them call a model, one waits for a human, one has a side effect that hurts if it happens twice.

```diagram
{
  "type": "flow",
  "title": "the incident workflow",
  "nodes": [
    { "label": "triage", "sub": "model: how bad is this?", "icon": "activity" },
    { "label": "gather", "sub": "deploys, error rates", "icon": "database" },
    { "label": "propose", "sub": "model: first action", "icon": "cpu" },
    { "label": "approve", "sub": "suspends, waits for a human", "icon": "lock" },
    { "label": "act", "sub": "the side effect", "icon": "rocket" },
    { "label": "writeup", "sub": "model: handover note", "icon": "check" }
  ]
}
```

The world it investigates is a fixture: fixed alerts, fixed deploy history, fixed error rates. That is deliberate. It means the only non-determinism in the system is the model itself, so a run differs in wording but never in facts.

Here is the agent doing its job. The alert says checkout p99 is 14.2 seconds, and there was a deploy eight minutes ago:

```terminal
{
  "title": "npm run incident",
  "prompt": "$",
  "steps": [
    { "cmd": "npm run incident checkout-latency", "output": "[7079ms] status=suspended" },
    { "comment": "it stopped and asked, rather than acting" },
    { "cmd": "", "output": "suspended at approve:\n{\n  \"question\": \"Approve this action on checkout?\",\n  \"proposal\": \"Roll back the most recent deploy (4f21ab9 by dana, 8 minutes\n     ago) (The incident started within minutes of the deploy, making a\n     causal link highly probable, and rolling back is the safest, fastest\n     way to restore service.)\"\n}" },
    { "comment": "approve it, and the run continues from step four" },
    { "cmd": "", "output": "[9423ms] after resume: status=success\n\nseverity: page\nacted:    true" }
  ]
}
```

It reached the right answer: page, not ticket, because customers are affected right now, and roll back the deploy that landed immediately before the spike. Nine and a half seconds end to end on `deepseek-v4-pro`, of which seven were spent reaching the approval gate.

## Where it won

### The approval gate is worth the whole framework

This is the step that justifies the dependency:

```typescript
const approve = createStep({
  id: 'approve',
  inputSchema: proposed,
  outputSchema: approved,
  suspendSchema: z.object({ question: z.string(), proposal: z.string() }),
  resumeSchema: z.object({ approved: z.boolean() }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      return await suspend({
        question: `Approve this action on ${inputData.service}?`,
        proposal: inputData.proposal,
      });
    }
    return { ...inputData, approved: resumeData.approved };
  },
});
```

`suspend()` writes the entire run state to storage and returns. The process can exit. Tomorrow morning, a completely different process picks the run up by id and resumes it, and the agent carries on from step four with everything the first three steps learned still intact.

Think about building that yourself. You need to serialise the whole conversation, the tool results and the position in the flow, store it, then reconstruct it. It is a weekend of work, and the version you write will have bugs the framework has already found.

### The types actually hold

Each step declares its input and output schema, and the next step's input is literally the previous step's output type:

```typescript
const gathered = triaged.extend({
  evidence: z.object({
    recentDeploy: z.string().nullable(),
    errorRate: z.number(),
    baseline: z.number(),
  }),
});
```

Rename a field in step two and step three stops compiling. For a pipeline where the interesting bugs are shape mismatches four steps downstream, that is not a small thing.

### The evals earn their place immediately

We wrote a three-case eval, then made a prompt edit that any of us might have committed on a Friday. The original instructions say "be conservative: if customers are currently affected, it is a page". The "improvement" says "page: only for total outages of the entire platform" and "avoid paging people unless absolutely unavoidable".

That reads like a reasonable response to alert fatigue. Here is what it does:

```terminal
{
  "title": "npm run eval",
  "prompt": "$",
  "steps": [
    { "cmd": "npm run eval", "output": "current instructions: 3/3\n  PASS  checkout-latency: expected page, got page\n  PASS  disk-warn: expected ticket, got ticket\n  PASS  cert-expiry: expected ticket, got ticket" },
    { "cmd": "", "output": "after a plausible \"improvement\": 2/3\n  FAIL  checkout-latency: expected page, got ticket\n  PASS  disk-warn: expected ticket, got ticket\n  PASS  cert-expiry: expected ticket, got ticket" },
    { "cmd": "", "output": "The eval caught it: the score dropped from 3/3 to 2/3." }
  ]
}
```

The one case that broke is the one that matters: a live customer-facing outage quietly downgraded from a page to a ticket. Nobody gets woken up. You find out from customers.

We ran the same eval on three different models and got the identical 3/3 to 2/3 result each time, which says the regression is a property of the prompt change rather than a quirk of one model.

## Where it would not

Now the part that made the post worth writing.

### The setup

We gave the `act` step a window: it writes to a ledger, then stays busy for a few seconds. The harness watches that ledger and sends `SIGKILL` the instant the side effect lands. That timing is not a guess. The process always dies inside the dangerous window, after the action has really happened and before the step has recorded that it finished.

Then a completely fresh process asks storage what it thinks happened.

```terminal
{
  "title": "npm run crash-test",
  "prompt": "$",
  "steps": [
    { "comment": "1. start: runs to the approval gate" },
    { "cmd": "npm run crash-test", "output": "runId=a7f0cd3c-3c5f-4aee-b560-2cc5f2fd7932 status=suspended\nledger after start: 0" },
    { "comment": "2. approve in a second process, kill it mid-action" },
    { "cmd": "", "output": "child exited code=null signal=SIGKILL (killed mid-action=true)\nledger after crash: 1" },
    { "comment": "3. a third process inspects storage" },
    { "cmd": "", "output": "status: running\ntriage: success   gather: success\npropose: success  approve: success\nact: running\nsuspendedPaths: {}" }
  ]
}
```

Read that last block carefully, because it is the whole problem.

The run is **orphaned**. Four steps are safely recorded as `success`, which is genuinely valuable: we know exactly how far it got. But the step that was in flight is marked `running`, and it will stay `running` forever, because the only process that could have finished it is dead. And `suspendedPaths` is empty, so the run is not suspended, which means `resume()` has nothing to resume.

Nothing recovers this on its own. The incident is half-handled and silent.

### Recovery works, and costs you a second rollback

Mastra has an API for exactly this situation. It picks up runs that storage still believes are active and drives them to completion:

```typescript
await wf.restartAllActiveWorkflowRuns();
```

It worked. The run went to `success`, the writeup was generated, the incident closed properly.

And the ledger went from one entry to two.

```terminal
{
  "title": "the summary line",
  "prompt": "$",
  "steps": [
    { "cmd": "", "output": "idempotency guard: off\nside effects recorded: 2\nDUPLICATED: the action ran 2 times. Recovery re-executed the step." }
  ]
}
```

We rolled back the deploy, crashed, recovered, and rolled it back again. In a real system that is a second rollback fired at a service someone may already be repairing by hand.

:::warning
This is not a Mastra bug, and it is worth being precise about that. Recovery re-runs the interrupted step from the beginning, because a step is the unit of replay and there is no way for any engine to know how far through your `execute` function the process got. Temporal, DBOS and Restate all behave the same way. **Durable execution gives you at-least-once, not exactly-once.** Idempotency stays your job.
:::

The reason this deserves a section rather than a footnote is that "durable execution" is marketed in a way that strongly implies the opposite. If you read the feature list and assume your side effects are protected, you will ship exactly this bug, and you will only find it during an incident, which is the worst possible time to discover that your incident tooling has a bug.

### The fix is small, and you have to know to write it

Derive a key from something stable across the restart, and make the action a no-op the second time:

```typescript
export function recordOnce(key: string, entry: LedgerInput) {
  if (entries().some((e) => e.key === key)) return null;   // already done
  appendFileSync(LEDGER, JSON.stringify({ ...entry, key }) + '\n');
}

// in the step, `runId` survives the crash, so the key does too
recordOnce(`${runId}:act`, { runId, action: inputData.proposal, target: inputData.service });
```

The critical detail is where the key comes from. It has to be derived from the run id, which storage remembers, and not generated inside the step, which would produce a fresh key on every attempt and guard nothing.

Same experiment, same `SIGKILL`, same recovery call:

```chart
{
  "type": "bar",
  "title": "Times the rollback executed, after one crash and one recovery",
  "unit": " runs",
  "caption": "Identical conditions: SIGKILL sent the moment the side effect lands, then restartAllActiveWorkflowRuns(). Mastra 1.57.0, deepseek-v4-pro. Reproducible with npm run crash-test.",
  "rows": [
    { "label": "no idempotency key", "value": 2, "series": "unsafe" },
    { "label": "idempotency key on the action", "value": 1, "series": "safe" }
  ],
  "series": [
    { "name": "unsafe", "color": "#ef4444" },
    { "name": "safe", "color": "#f59e0b" }
  ]
}
```

Ten lines, and the difference between an agent that is crash-safe and one that merely appears to be.

### Three smaller things that cost us time

**The restart call returns before the work finishes.** `restartAllActiveWorkflowRuns()` resolves immediately, not when the restarted runs complete. Our first version of the harness read the ledger straight after it and reported the wrong answer. You need to poll storage until the run leaves the `running` state.

**Orphan recovery is not automatic.** Nothing sweeps up stuck runs for you. If your process can die, something in your deployment has to call the restart path on boot, and that something is your code.

**The API has moved.** We first installed `@mastra/core@0.10` because that is what a plain semver range resolved to, then pinned `1.57.0` for everything here. Between those two versions, `createRunAsync()` became `createRun()`, and `getWorkflowRunById()` returns the run flattened rather than under a `snapshot` key.

How fast is fast? `1.58.0` shipped overnight while this article was being finished. That is not a complaint, an actively developed library is what you want here, but it does mean you should pin your version and read the changelog rather than trusting a blog post, including this one.

## What the framework is actually buying you

To make the comparison concrete rather than rhetorical, we built the same triage against the same endpoint as a plain tool loop, no framework at all:

```typescript
for (let i = 0; i < 6; i++) {
  const reply = await chat(messages);
  messages.push(reply);
  if (!reply.tool_calls?.length) break;      // done
  for (const tc of reply.tool_calls) {
    const out = callTool(tc.function.name, JSON.parse(tc.function.arguments));
    messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(out) });
  }
}
```

It works. It reaches the same conclusion, page plus roll back `4f21ab9`, in three model turns. If your agent is one model with a few tools and no state between calls, this is genuinely the right answer and a framework is overhead.

What it cannot do is everything this post has been about. There is no approval gate, because there is nowhere to put a run while a human thinks. There is no recovery, because there is no record. If that process dies, the run is simply gone, and no amount of idempotency keys helps because there is nothing left to restart.

That is the honest trade. You adopt a framework at the point where runs must outlive processes, and not before.

## Would we use it again

Yes, for this shape of problem, with the caveat above written on the wall.

The parts that made it worth the dependency were the suspend and resume across processes, which is the hard part done properly, and the step-level record in storage, which meant that after an ugly crash we could see precisely which steps had committed and which had not. Debugging that same crash in a hand-rolled loop means reading logs and guessing.

The part to internalise is that durable execution protects your **workflow**, not your **side effects**. Mastra remembered where the run had got to, which is exactly what it promises. It could not know whether the rollback we fired had reached the deploy system, because nothing outside our own code could know that. That boundary is where your idempotency keys go, and no framework will draw it for you.

```github
https://github.com/The-DevOps-Daily/mastra-oncall-agent
```

## What we did not test

Being clear about the edges of this:

- **One workload, one shape.** An incident responder with a human gate. Nothing here says how it behaves with high concurrency, long-running memory, or hundreds of parallel runs.
- **SQLite storage.** We used LibSQL on one machine. A Postgres-backed store under real contention may behave differently, particularly around the orphaned-run case.
- **One failure mode.** We killed the process. We did not test network partitions, storage failures mid-write, or a model provider going down between steps.
- **Not a framework comparison.** We did not build this five ways and time them. If you want the survey, we wrote [the top five agent frameworks in 2026](/posts/top-5-ai-agent-frameworks-2026) separately, and this post is the hands-on half of that one.
- **An open model, not a frontier one.** Everything ran on `deepseek-v4-pro` through an OpenAI-compatible gateway. The crash results are independent of the model, but the triage quality would likely improve on a larger one.

If the agent loop itself is the part that still feels like magic, our [agentic loop simulator](/games/agentic-loop-simulator) walks through plan, build, verify and repeat one step at a time.

## The one thing to take away

If you are putting an agent anywhere near a system that can change production, write the crash test before you write the demo. It took us an afternoon, it is about eighty lines, and it turned a comfortable assumption into a measured fact.

The assumption was that durable execution meant our actions were safe. The fact is that it meant our workflow was safe, and our actions were exactly as safe as we had made them.
