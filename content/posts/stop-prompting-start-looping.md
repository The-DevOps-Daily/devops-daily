---
title: 'Stop Prompting, Start Looping: Agentic Loops Explained'
excerpt: 'The best engineers stopped hand-writing prompts and started writing loops. Here is what an agentic loop actually is, the plan-build-judge pattern behind it, why the judge has to be a separate agent, and how to try it in an interactive simulator.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-07-08'
publishedAt: '2026-07-08T09:00:00Z'
updatedAt: '2026-07-08T09:00:00Z'
readingTime: '9 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: true
tags:
  - AI
  - Agents
  - DevOps
  - Automation
  - Claude Code
---

The people who build coding agents have quietly changed how they work. They do not sit and type one prompt, read the reply, and type the next one. They write a loop, hand it a goal, and walk away while the agent works. Boris Cherny, who built Claude Code, has said he does not really prompt anymore. He has loops running that prompt the model and decide what to do next, sometimes hundreds of agents at once, overnight.

That sounds like a productivity hack. It is actually a different mental model, and it is worth understanding whether or not you ever run an agent unattended. This post explains what an agentic loop is, the three-agent pattern that makes it reliable, and why the single most important piece is the one most people skip. There is an interactive simulator at the end so you can watch it happen step by step.

## TLDR

- An **agentic loop** is a cycle: gather context, take an action, check the result against the goal, then repeat until the goal is met. The loop, not the model, is what lets an agent finish multi-step work on its own.
- The reliable version uses **three roles**: a planner picks the next step, a builder does it, and a judge grades the result. It cycles until the judge approves.
- The judge should be a **separate agent**. An agent grading its own work is too lenient and will stop the moment the tests go green, even when the goal is not actually met.
- **Cost compounds** because the whole context is re-sent every loop. Long loops get expensive fast, which is why you set stop conditions.

## Prerequisites

- You have used an AI coding tool at least once (Claude Code, Cursor, Copilot, or similar).
- You are comfortable with the idea of tests and a spec as a definition of done.
- No agent framework required. The point is the pattern, not any one tool.

## What an agentic loop is

A plain language model answers once and stops. You ask, it replies, the interaction is over. An agentic loop wraps that single call in a cycle so the agent can keep going:

1. **Gather context.** Pull together the goal, the relevant files, and the result of the last action.
2. **Take an action.** Call one tool: read a file, edit code, run a command, run the tests.
3. **Verify.** Check whether that action moved closer to the goal. If yes, stop. If no, loop.

Most real tasks finish in three to eight of these iterations. Simple lookups take one or two. A gnarly multi-step change can take fifteen or more. The important shift is that the model is no longer the whole system. It is one step inside a loop that carries state forward and decides when the work is done.

```terminal
{
  "title": "a loop in one line",
  "prompt": "$",
  "steps": [
    { "comment": "run the agent over and over until the tests pass" },
    { "cmd": "until npm test; do claude -p \"fix the failing tests\"; done", "output": "loop 1: 1 failing\nloop 2: 1 failing\nloop 3: all tests pass" }
  ]
}
```

That one-liner is a real, if crude, agentic loop. The shell provides the loop and the stop condition (`npm test` passing), and the agent provides the step. Everything past this is about making the loop smarter and safer.

## The pattern that actually works: plan, build, judge

The version that engineering teams are settling on splits the work across three roles instead of one agent doing everything:

- **Plan.** A planner decides the single next step toward the goal.
- **Build.** A builder carries it out with tools, reading and editing files and running commands.
- **Judge.** A separate judge grades the result against the goal and the spec, then decides whether to loop or stop.

The Claude Code team demoed building a full app this way: three agents, one to plan, one to build, one to judge, cycling until the app actually worked. The loop is the same gather-act-verify cycle, but giving each phase its own agent makes the hand-offs explicit and, crucially, keeps the judge honest.

:::note
This is why the industry language shifted from "prompt engineering" to "loop engineering." The skill is no longer phrasing one perfect request. It is designing the loop: what the goal is, what each agent does, and what condition ends it.
:::

## The part everyone skips: the judge has to be separate

Here is the failure that separates a demo from a system. If the agent that wrote the code also decides whether the code is good, it will be too easy on itself. It sees the tests pass and declares victory, even when "tests pass" is not the same as "goal met."

Picture a task: add a signup endpoint that hashes the password and returns a 201. A self-checking agent adds the hashing, runs the tests, sees green, and stops. But the endpoint returns 200, not the 201 the spec asked for. Nobody checked the spec. The loop finished confident and wrong.

A separate judge, ideally a different model with its own instructions, catches exactly this. It is not grading its own homework, so it reads the spec and rejects the 200. The loop goes back to the planner, the status code gets fixed, and only then does it stop.

:::warning
An unattended loop without a real verifier is a machine that ships bugs with confidence. The most common and most expensive mistake in loop engineering is letting the builder judge itself. Make the judge a separate agent, and give it the spec, not just the tests.
:::

## Why cost compounds

Loops are not free, and the cost does not grow linearly. Every iteration re-sends the whole context: the goal, the files, and everything the agent has learned so far. As the context window grows loop over loop, each turn costs more than the last. A loop that runs for hours can burn through tokens faster than almost anyone expects.

That is not a reason to avoid loops. It is the reason you always give a loop a stop condition and a budget: a goal that can be checked, a maximum number of turns, or both. A loop that cannot end is not autonomy. It is an open tab.

## Loops come in more than one shape

Plan, build, judge is the general shape, but you will meet it wearing different clothes. A few worth knowing:

**The fix-until-green loop.** The simplest useful loop. The goal is a passing test suite, the action is an edit, the verifier is the test runner, and it ends when the suite is green. This is the loop most people meet first, and the one-liner above is exactly it.

**The experiment loop.** When the goal is "make this better" instead of "make this pass," the verifier becomes a metric instead of a test. Read the current code, propose one change, run a short measurement, and keep the change only if the number improved, otherwise roll it back. Andrej Karpathy has described tuning models this way: many small, cheap experiments running overnight, keeping the handful that help and throwing the rest away. The pattern generalizes to anything you can score, from query latency to bundle size.

```text
read  ->  propose one change  ->  measure  ->  better?
                                              |-- yes --> keep the change
                                              +-- no  --> roll back
                                              then repeat
```

**The overnight triage loop.** The autonomous version starts with a discovery step: read the CI failures, the open issues, and the recent commits to find the work. Then, for each item, it plans a fix, makes it in an isolated git worktree so parallel agents cannot collide, verifies against tests, and opens a PR. You wake up to a queue of reviewed changes instead of a blank editor.

**The research loop.** Loops are not only for code. Give an agent a question and it can loop too: gather sources, read one, ask "do I have enough to answer confidently," and either search for more or write the answer. Same cycle, no compiler in sight.

:::note
One mechanic ties all of these together: the agent forgets. Each turn starts fresh, so a loop needs somewhere outside the model to remember what it has learned. In practice that is a state file, a markdown scratchpad, or an issue tracker that the loop reads at the start of every iteration and writes back to at the end. The loop is the engine. The state file is the memory.
:::

## Try it: watch a loop run

Reading about a loop only gets you so far. We built an interactive simulator that runs one task through the full plan-build-judge loop, slowly, one phase at a time, so you can see the hand-offs, the decision to loop or stop, the context window growing, and the token cost climbing.

The most useful control is the "separate judge" toggle. Turn it off and watch the same loop finish with the wrong status code, the confident bug a real judge would have caught.

:::tip
Open the [Agentic Loop Simulator](https://devops-daily.com/games/agentic-loop-simulator) and press Play. Then flip the judge off and run it again. The difference is the whole lesson.
:::

## How this maps to Claude Code

If you want to build this for real rather than watch it:

- **Plan and Judge** are work you hand to a subagent, often a different model, so the judge is independent of the builder.
- **Build** is the main agent using its Read, Edit, and Bash tools to change the code.
- **The loop** runs until a goal condition or a turn limit, the same way a harness keeps an agent going until the work is genuinely done.
- **Isolation** matters once you run more than one loop at a time. Give each agent its own git worktree so parallel edits cannot collide.

## Where this is heading

The people closest to this are not subtle about it. NVIDIA's Jensen Huang put it as "nobody writes prompts anymore, the new job is to write and handle loops." Andrew Ng has said essentially all of his own tasks now run through agents. Boris Cherny frames overnight fleets of looping agents as simply how engineering is done now.

You do not have to accept the strongest version of that to take the useful part. Whether you run one loop by hand or a hundred unattended, the same rules hold: give the loop a checkable goal, split the builder from the judge, and put a limit on it. Get those three right and a loop stops being a party trick and starts being a reliable way to get work done.

## Summary

An agentic loop is the cycle that turns a model that answers once into an agent that finishes the job: plan, build, judge, repeat until the goal is met. The reliable version keeps the judge as a separate agent so the loop cannot pass its own bad work, and it always carries a stop condition because cost compounds as the context grows. Prompting is not dead, but it is no longer the whole skill. The new skill is designing the loop around it. Go [watch one run](https://devops-daily.com/games/agentic-loop-simulator), then build your own.
