---
title: 'Running a Background Job That Must Not Be Lost'
excerpt: 'A queue gets your job to a worker, not to the finish line. What happens when the worker dies halfway, and a durable executor in 90 lines of TypeScript.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-08-03'
publishedAt: '2026-08-03T09:00:00Z'
updatedAt: '2026-08-03T09:00:00Z'
readingTime: '17 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - DevOps
  - Reliability
  - TypeScript
  - Architecture
  - Node.js
  - Queues
---

The first version of a background job is always the same:

```typescript
app.post('/signup', async (req, res) => {
  const user = await createUser(req.body.email);
  res.json({ id: user.id });

  // fire and forget
  sendWelcomeEmail(user.email);
});
```

Then someone points out that a crash between the response and the email loses the email, so you add a queue:

```typescript
await queue.add('welcome-email', { userId: user.id });
```

That is better. The job now survives a deploy, and it gets retried if the worker throws. What it does not survive is the thing that actually happens: the worker picks up the job, does two of the four things the job is supposed to do, and then the pod is evicted. The queue redelivers. The job starts again from the top. The user gets a second welcome email, and the charge that ran between the two failures runs again too.

The queue moved the work. It did not remember how far the work got.

## TL;DR

- A queue gives you at-least-once *delivery*. It does not give you at-least-once *progress*, so a job that dies halfway restarts from the beginning.
- Durable execution fixes this by journalling each completed step and replaying the function, returning recorded results instead of re-running the work.
- That requires your workflow code to be deterministic. `Date.now()`, `Math.random()` and unguarded I/O quietly break replay.
- Replay does not give you exactly-once side effects. A step can succeed and crash before its result is written, so effects still need idempotency keys.
- Durable timers are the feature that is genuinely hard to build yourself. A three-day sleep that survives a deploy is not a `setTimeout`.
- You can build a working executor in about 90 lines. Whether you should is a question about timers, visibility and versioning, not about the core loop.

## Prerequisites

- Comfortable with TypeScript and `async`/`await`
- Node.js 20 or newer to run the examples
- Some exposure to a job queue (BullMQ, SQS, Sidekiq, Celery, anything)
- Familiarity with idempotency helps but is not required

## Why a queue is not durability

A queue is a handoff. It takes a message, keeps it until a consumer acknowledges it, and redelivers if the acknowledgement never arrives. Everything it guarantees is about the *message*.

Your job is not a message. It is a sequence:

```text
1. charge the card
2. provision the account
3. send the receipt
4. notify the sales channel
```

The queue holds one message representing all four. When the worker dies after step 2, the queue knows only that the message was not acknowledged. It redelivers, and your handler starts at step 1. You get a second charge.

The usual patch is a status column:

```typescript
if (job.status === 'charged') {
  // skip the charge
}
```

This works, and it is where most teams stop. It also means every job grows its own bespoke state machine, every new step needs a new status value, and the "where did this get to" logic is spread across the handler in conditionals nobody wants to touch. You have written a workflow engine by accident, one `if` at a time, without the part that makes it reliable.

Durable execution is that same idea done once, generically.

## The failure modes that actually happen

Before the fix, the list worth designing against. These are the ones that show up in production, roughly in order of how often they bite:

- **The worker dies mid-job.** Deploy, OOM kill, spot reclaim, node drain. Partial side effects, full restart.
- **The job is redelivered while still running.** The visibility timeout expires because step 2 was slower than expected. Now two workers run the same job concurrently.
- **A downstream call is slow, not dead.** The payment API takes 40 seconds. Your handler times out at 30, the queue retries, and the original call completes anyway.
- **The job needs to wait.** Three days before a nudge email, an hour before a retry, until a human approves. A `setTimeout` in a process that gets deployed twice a day is not a wait.
- **A poison message.** One malformed payload fails forever, burns retry budget, and buries the rest of the queue.
- **The code changed underneath a running job.** You shipped a new version while 400 jobs were mid-flight against the old one.

A queue plus a status column handles the first one badly and the rest not at all.

## What durable execution actually means

The idea is small enough to state in one paragraph.

Every side-effecting operation is wrapped in a `step`. When a step completes, its name and its return value are appended to a journal that is persisted before the workflow continues. If the process dies, the workflow function is called again *from the top*, but this time each step checks the journal first: if there is a recorded result at this position, return it and do not run the work. Execution fast-forwards through everything already done and resumes at the first step with no record.

The function re-runs. The work does not.

```diagram
{
  "type": "flow",
  "title": "What replay does when the worker dies mid-run",
  "nodes": [
    { "label": "Run starts", "sub": "journal empty", "tone": "slate" },
    { "label": "create-user", "sub": "executes, result recorded", "tone": "green" },
    { "label": "welcome-email", "sub": "executes, result recorded", "tone": "green" },
    { "label": "Worker dies", "sub": "process gone, journal on disk", "tone": "red", "status": "down" },
    { "label": "Replay", "sub": "both steps return recorded results", "tone": "blue" },
    { "label": "check-activation", "sub": "first unrecorded step, executes", "tone": "amber" }
  ]
}
```

This is the same trick as event sourcing, pointed at control flow instead of at domain state. The journal is the source of truth about progress, and the function body is a pure-ish projection of it.

## Building one, so you know what you are buying

Roughly 90 lines, no dependencies, a JSON file per run. Small enough to read in one sitting and complete enough to survive a `kill -9`.

### The journal

```typescript
// durable/journal.ts
import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';

export interface JournalEntry {
  seq: number;
  name: string;
  status: 'completed' | 'sleeping';
  result?: unknown;
  wakeAt?: number;
}

export interface RunState {
  runId: string;
  status: 'running' | 'completed';
  entries: JournalEntry[];
  output?: unknown;
}

const DIR = join(process.cwd(), '.runs');

export function load(runId: string): RunState {
  const file = join(DIR, `${runId}.json`);
  if (!existsSync(file)) return { runId, status: 'running', entries: [] };
  return JSON.parse(readFileSync(file, 'utf8')) as RunState;
}

export function save(state: RunState): void {
  mkdirSync(DIR, { recursive: true });
  const file = join(DIR, `${state.runId}.json`);
  // Write then rename: a crash mid-write must not leave a truncated journal,
  // because a truncated journal is worse than no journal at all.
  writeFileSync(`${file}.tmp`, JSON.stringify(state, null, 2));
  renameSync(`${file}.tmp`, file);
}
```

A file per run is obviously not what you would deploy. Swap it for a table with a primary key on `(run_id, seq)` and the rest of the code is unchanged. The property that matters is that a completed step is durable before the next line of workflow code runs.

### The context

This is where replay lives.

```typescript
// durable/context.ts
import type { RunState } from './journal';

/** Unwinds the workflow when it hits a sleep that has not elapsed yet. */
export class Suspend extends Error {
  constructor(public readonly wakeAt: number) {
    super(`suspended until ${new Date(wakeAt).toISOString()}`);
  }
}

export class Context {
  private cursor = 0;

  /** Exposed so steps can derive idempotency keys from it. */
  readonly runId: string;

  constructor(
    private readonly state: RunState,
    private readonly persist: () => void,
  ) {
    this.runId = state.runId;
  }

  async step<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const seq = this.cursor++;
    const recorded = this.state.entries[seq];

    if (recorded) {
      // The name check is what turns a silent corruption into a loud error.
      if (recorded.name !== name) {
        throw new Error(
          `Non-deterministic replay at position ${seq}: ` +
            `journal has "${recorded.name}", code asked for "${name}"`,
        );
      }
      return recorded.result as T;
    }

    const result = await fn();
    this.state.entries[seq] = { seq, name, status: 'completed', result };
    this.persist();
    return result;
  }

  async sleep(name: string, ms: number): Promise<void> {
    const seq = this.cursor++;
    const recorded = this.state.entries[seq];

    if (!recorded) {
      const wakeAt = Date.now() + ms;
      this.state.entries[seq] = { seq, name, status: 'sleeping', wakeAt };
      this.persist();
      throw new Suspend(wakeAt);
    }
    if (recorded.status === 'completed') return;
    if (Date.now() >= recorded.wakeAt!) {
      recorded.status = 'completed';
      this.persist();
      return;
    }
    throw new Suspend(recorded.wakeAt!);
  }
}
```

Two things worth pausing on.

The `cursor` is positional. Step identity is "the third step in this function", not "the step called welcome-email". That is what makes the name check load-bearing: if you insert a step in the middle of a workflow that has runs in flight, every position after it shifts, and the mismatch is caught instead of silently returning the wrong recorded value. This positional model is also exactly why versioning is hard, which we will come back to.

The sleep does not block. It records when to wake and throws, unwinding the stack out of the workflow entirely. The process is free to exit. Nothing is holding a timer.

### The runner

```typescript
// durable/run.ts
import { Context, Suspend } from './context';
import { load, save, type RunState } from './journal';

export type Workflow<I, O> = (ctx: Context, input: I) => Promise<O>;

export type RunResult<O> =
  | { done: true; output: O }
  | { done: false; wakeAt: number };

export async function run<I, O>(
  runId: string,
  workflow: Workflow<I, O>,
  input: I,
): Promise<RunResult<O>> {
  const state: RunState = load(runId);

  // Replaying a finished run must be free and must not re-execute anything.
  if (state.status === 'completed') {
    return { done: true, output: state.output as O };
  }

  const ctx = new Context(state, () => save(state));

  try {
    const output = await workflow(ctx, input);
    state.status = 'completed';
    state.output = output;
    save(state);
    return { done: true, output };
  } catch (err) {
    if (err instanceof Suspend) return { done: false, wakeAt: err.wakeAt };
    // A real failure. Completed steps stay in the journal, so the retry
    // resumes at the failed step rather than at the top of the workflow.
    throw err;
  }
}
```

### The workflow

Now the part an application developer writes. It reads like ordinary code, which is the entire point.

```typescript
// onboarding.ts
import type { Context } from './durable/context';
import { createUser, sendEmail, hasActivated } from './services';

const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

export async function onboarding(ctx: Context, input: { email: string }) {
  const user = await ctx.step('create-user', () => createUser(input.email));
  await ctx.step('welcome-email', () => sendEmail(user.email, 'welcome'));

  await ctx.sleep('wait-3-days', THREE_DAYS);

  const activated = await ctx.step('check-activation', () => hasActivated(user.id));
  if (!activated) {
    await ctx.step('nudge-email', () => sendEmail(user.email, 'nudge'));
  }

  return { userId: user.id, nudged: !activated };
}
```

The `if` is safe because `activated` came out of a step. On replay it is read from the journal, so the branch resolves the same way it did the first time, forever. Had it been written as `if (!(await hasActivated(user.id)))`, the replay would call a live service whose answer may have changed, take the other branch, and desynchronise from the journal.

That is the rule in one line: **every value the control flow depends on has to come from a step.**

### Watching it survive a crash

```terminal
{
  "title": "durable run",
  "prompt": "$",
  "steps": [
    { "comment": "start the run, kill the worker once two steps are durable" },
    { "cmd": "node worker.js run-8f21", "output": "step create-user       -> executed\n   (side effect: welcome email actually sent)\nstep welcome-email     -> executed\n!! worker dies (journal is durable)" },
    { "comment": "the journal outlived the process" },
    { "cmd": "cat .runs/run-8f21.json", "output": "{\n  \"runId\": \"run-8f21\",\n  \"status\": \"running\",\n  \"entries\": [\n    { \"seq\": 0, \"name\": \"create-user\", \"status\": \"completed\" },\n    { \"seq\": 1, \"name\": \"welcome-email\", \"status\": \"completed\" }\n  ]\n}" },
    { "comment": "restart: neither step executes again" },
    { "cmd": "node worker.js run-8f21", "output": "step create-user       -> replayed\nstep welcome-email     -> replayed\n{\"done\":false,\"wakeAt\":1785752131165}" },
    { "comment": "two processes, one user created, one email sent, and the sleep outlived both" }
  ]
}
```

Note what did *not* print on the second run: the side-effect line. The workflow function ran start to finish twice; `sendEmail` was called once.

## The part the demo gets wrong

Look at `step` again, specifically these two lines:

```typescript
const result = await fn();
this.state.entries[seq] = { seq, name, status: 'completed', result };
```

There is a gap between them. If the process dies in that gap, the work happened and the journal does not know. Replay re-runs it. The user gets two welcome emails.

This is not hypothetical. Move the crash a few microseconds earlier, into the gap, and the same executor produces a duplicate:

```terminal
{
  "title": "the gap",
  "prompt": "$",
  "steps": [
    { "comment": "die after the email is sent but before the journal write" },
    { "cmd": "node worker.js run-b", "output": "step create-user       -> executed\n   (side effect: welcome email actually sent)\n!! worker dies before the journal write" },
    { "comment": "replay has no record of it, so it sends again" },
    { "cmd": "node worker.js run-b", "output": "step create-user       -> replayed\n   (side effect: welcome email actually sent)\nstep welcome-email     -> executed" },
    { "comment": "two emails, one workflow" }
  ]
}
```

You cannot close this gap. Committing the journal entry before running the step is worse, because then a failure loses the work entirely. Committing both atomically would require the side effect and your database to share a transaction, which they do not, because one of them is someone else's HTTP API.

:::warning
Durable execution gives you at-least-once step execution, not exactly-once. Every platform in this category has this property, whatever the marketing says. The window is small, but small windows are what you hit at volume.
:::

The fix is the same one that makes webhook receivers safe: give the side effect a key derived from something stable, and let the far end deduplicate.

```typescript
await ctx.step('welcome-email', () =>
  sendEmail(user.email, 'welcome', {
    // Stable across replays because runId and step name are both stable.
    idempotencyKey: `${ctx.runId}:welcome-email`,
  }),
);
```

Stripe, most payment APIs and any well-built internal service accept a key like this. For services that do not, you need your own dedupe table written in the same transaction as the effect. If neither is possible, you are choosing between a duplicate and a loss, and you should choose deliberately rather than discover the choice in an incident. We went through the same reasoning from the receiving side in [what it actually takes to deliver a webhook in production](/posts/reliable-webhook-delivery-retries-signatures-idempotency).

## Determinism, and the ways you break it

Replay assumes that running the function again produces the same sequence of steps. Anything that can change between the first run and the replay is a hazard. The common ones:

```typescript
// Breaks: a different value on every replay
const requestedAt = Date.now();
const token = crypto.randomUUID();
const shard = Math.floor(Math.random() * 4);

// Fine: recorded once, replayed forever
const requestedAt = await ctx.step('now', async () => Date.now());
const token = await ctx.step('token', async () => crypto.randomUUID());
const shard = await ctx.step('shard', async () => Math.floor(Math.random() * 4));
```

Less obvious, and more likely to reach production:

- **Reading config or feature flags directly.** A flag that flips between the original run and the replay takes the other branch. Read flags inside a step.
- **Iterating something unordered.** `Object.keys()` on an object built from a `Map` populated by concurrent writes, or a `SELECT` with no `ORDER BY`, can come back in a different order and fan out steps in a different sequence.
- **`Promise.race` against a timeout.** Whichever side wins is a wall-clock accident.
- **Reading from the database outside a step.** The row changed. That is what rows do.
- **Library upgrades that change behaviour inside your workflow body.** Rare, extremely annoying.

The name check in `step` catches the *structural* version of these. Insert a step into a workflow that already has runs in flight and it fires immediately:

```text
step a                  -> replayed
Error: Non-deterministic replay at position 1: journal has "b", code asked for "INSERTED"
```

What it cannot catch is a step returning a different value, because the whole point is that it never runs the step again. Structural drift is loud; value drift is silent. Keep values in steps.

## Versioning a workflow that is already running

This is the problem most teams meet on week three, and it is a direct consequence of positional identity.

You have 400 runs paused in `wait-3-days`. You want to add a step before the nudge email. Insert it, deploy, and every paused run resumes into a journal whose positions no longer line up. If you were lucky you wrote the name check and they all fail loudly. If you were not, they silently return the wrong values to the wrong steps.

Three strategies, in increasing order of effort:

**Append only.** Add steps at the end. Never insert, never reorder, never delete. Free, and restrictive enough that it stops working eventually.

**Version gates.** Record a version at the top of the workflow and branch on it.

```typescript
const version = await ctx.step('version', async () => 2);

if (version >= 2) {
  await ctx.step('score-lead', () => scoreLead(user.id));
}
await ctx.step('nudge-email', () => sendEmail(user.email, 'nudge'));
```

Runs that started before the change recorded `1` and skip the new step. New runs record `2` and take it. The cost is that the gates accumulate, and someone has to delete them once the old runs drain.

**Drain and cut over.** Register the new workflow under a new name, route new runs to it, let the old one finish. Cleanest, and it needs you to tolerate two versions in flight for as long as the longest sleep, which for a 30-day trial workflow is a month.

Every hosted platform in this space ships some form of the second or third option. It is a real part of the product and it is worth pricing in when you compare building against buying.

## Waiting for the outside world

Sleeps handle time. The other kind of wait is an external event: a payment confirms, a human approves, a webhook lands. Same mechanism, different wake condition.

```typescript
const approval = await ctx.waitForSignal('manager-approval', { timeout: SEVEN_DAYS });

if (approval.timedOut) {
  await ctx.step('escalate', () => escalate(request.id));
}
```

The implementation mirrors `sleep`: record that the run is waiting on a named signal, throw `Suspend`, and have the signal delivery endpoint write the payload into the journal and re-enqueue the run. It is maybe another 30 lines on top of what is above.

This is also where the "just use a queue and a status column" approach fully falls apart. A workflow that waits seven days for a human, then escalates, then waits again, is a state machine that nobody wants to hand-maintain in conditionals.

## Where the hosted platforms change the tradeoff

The executor above is real and it works. What it is missing is everything around the loop:

- **A scheduler for durable timers at scale.** One `wakeAt` in a JSON file is easy. Ten million pending wake-ups, fairly scheduled, without a thundering herd at midnight, is a system.
- **Visibility.** When someone asks why order 8f21 never shipped, you want to open a page showing every step, its input, its output, and where it is stuck. Building that UI is more work than building the executor.
- **Concurrency and rate control.** "At most 5 of these per customer, at most 500 globally, and back off when the vendor 429s" is fiddly to get right and easy to get subtly wrong.
- **Versioning tooling**, per the section above.
- **Somebody else's on-call.** Your workflow engine failing is a total outage of every background job you have.

The same onboarding workflow across the main options:

```tabs
{
  "title": "The same workflow, four ways",
  "tabs": [
    {
      "label": "Temporal",
      "lang": "typescript",
      "code": "import { proxyActivities, sleep } from '@temporalio/workflow';\nimport type * as activities from './activities';\n\nconst { createUser, sendEmail, hasActivated } = proxyActivities<typeof activities>({\n  startToCloseTimeout: '1 minute',\n});\n\nexport async function onboarding(email: string): Promise<string> {\n  const user = await createUser(email);\n  await sendEmail(user.email, 'welcome');\n\n  await sleep('3 days');\n\n  if (!(await hasActivated(user.id))) {\n    await sendEmail(user.email, 'nudge');\n  }\n  return user.id;\n}"
    },
    {
      "label": "Inngest",
      "lang": "typescript",
      "code": "export const onboarding = inngest.createFunction(\n  { id: 'onboarding', triggers: { event: 'app/signup.completed' } },\n  async ({ event, step }) => {\n    const user = await step.run('create-user', () => createUser(event.data.email));\n    await step.run('welcome-email', () => sendEmail(user.email, 'welcome'));\n\n    await step.sleep('wait-3-days', '3 days');\n\n    const activated = await step.run('check-activation', () => hasActivated(user.id));\n    if (!activated) {\n      await step.run('nudge-email', () => sendEmail(user.email, 'nudge'));\n    }\n    return { userId: user.id };\n  },\n);"
    },
    {
      "label": "Trigger.dev",
      "lang": "typescript",
      "code": "import { task, wait } from '@trigger.dev/sdk';\n\nexport const onboarding = task({\n  id: 'onboarding',\n  run: async (payload: { email: string }) => {\n    const user = await createUser(payload.email);\n    await sendEmail(user.email, 'welcome');\n\n    // Waits over 5 seconds are checkpointed, so this costs no compute.\n    await wait.for({ days: 3 });\n\n    if (!(await hasActivated(user.id))) {\n      await sendEmail(user.email, 'nudge');\n    }\n    return { userId: user.id };\n  },\n});"
    },
    {
      "label": "Ours",
      "lang": "typescript",
      "code": "export async function onboarding(ctx: Context, input: { email: string }) {\n  const user = await ctx.step('create-user', () => createUser(input.email));\n  await ctx.step('welcome-email', () => sendEmail(user.email, 'welcome'));\n\n  await ctx.sleep('wait-3-days', THREE_DAYS);\n\n  const activated = await ctx.step('check-activation', () => hasActivated(user.id));\n  if (!activated) {\n    await ctx.step('nudge-email', () => sendEmail(user.email, 'nudge'));\n  }\n  return { userId: user.id, nudged: !activated };\n}"
    }
  ]
}
```

They differ in where the checkpoint boundary sits. Inngest makes it explicit: `step.run` is the unit, and code outside a step re-executes on every replay. Temporal draws the line at the workflow/activity split, where activities are separately-registered functions and the workflow body is the deterministic part. Trigger.dev checkpoints the run itself, which is why its version reads as plain async code with no step wrappers at all. Hatchet and Restate sit at different points on the same axis.

That boundary is the thing to evaluate. Explicit steps are more typing and much more obvious about what re-runs. Implicit checkpointing is prettier and asks you to hold more in your head about what is safe to put where.

:::tip
If you are evaluating these, write the workflow that waits three days and then branches on a value fetched after the wait. It exercises durable timers, replay determinism and branch stability in about fifteen lines, and it is where the differences between these tools actually show up.
:::

## When you should not reach for this

Durable execution is not free. It adds a deployment, a mental model and a class of bug (non-determinism) that your team has not had before. Skip it when:

- **The job is short and idempotent already.** Resizing an image does not need a journal. Retry the whole thing.
- **Throughput is high and each item is cheap.** A million clickstream events a minute want a queue and a consumer group, not a journal per event.
- **Loss is acceptable.** Cache warming, non-critical analytics. Fire it, forget it, mean it.
- **You need sub-100ms.** Replay and journalling add latency by design. This is for work measured in seconds to weeks.

The signal that you *do* want it: your handler has a status column with more than about three values, and somebody has already written a comment explaining what happens if it crashes between two of them.

## Wrapping up

The core mechanism is small. Journal each completed step, replay the function, return recorded results instead of re-running work. You can hold all of it in your head, and the 90 lines above are enough to prove it to yourself.

What is not small is the surrounding system: durable timers at scale, a UI that answers "where is this stuck", concurrency controls, and a versioning story for workflows that outlive the code that started them. That is the real build-versus-buy line, and it is worth being honest that the executor is the easy part.

Whichever way you go, two things travel with you. Every value your control flow depends on has to come from a step, or replay will quietly take a different path. And step execution is at-least-once no matter what you buy, so side effects still need idempotency keys. Get those two right and the rest is a question of how much of the surrounding system you want to own.
