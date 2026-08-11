---
title: 'Top 5 AI Agent Frameworks in 2026'
excerpt: 'Five frameworks worth shipping production agents on, ranked against stated criteria, with the GitHub and npm numbers behind the ranking and an honest note on where each one loses.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-08-11'
publishedAt: '2026-08-11T09:00:00Z'
updatedAt: '2026-08-11T09:00:00Z'
readingTime: '18 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - DevOps
  - AI
  - Agents
  - TypeScript
  - Python
---

Every framework in this list can call a model in a loop and hand it some tools. That part stopped being interesting a while ago.

What separates them now is what happens on the second day: when the process restarts halfway through a run, when a tool needs a human to approve it, when someone asks why the agent did that, and when you need to prove a prompt change made things better rather than worse.

This ranks five frameworks on that basis. The criteria are stated below so you can disagree with the ranking rather than guess at it, and every number comes from GitHub and npm on 11 August 2026 rather than from anyone's marketing page.

## TL;DR

- **[Mastra](#1-mastra)** takes first place for TypeScript teams that want one integrated stack: durable workflows, memory, evals and tracing without assembling four libraries.
- **[LangGraph](#2-langgraph)** wins on control and ecosystem depth. Pick it when you need to define the graph yourself.
- **[OpenAI Agents SDK](#3-openai-agents-sdk)** is the shortest path if you have already committed to OpenAI.
- **[Vercel AI SDK](#4-vercel-ai-sdk)** owns the streaming and UI edge, and now has real agent primitives, but still no durable workflow engine.
- **[PydanticAI](#5-pydanticai)** is the one to reach for if your team is Python and cares about types.
- Popularity is not the ranking. The most-starred project in this space is not in the top five, and the reason is explained below.

## Prerequisites

- Familiarity with calling an LLM API and the idea of tool or function calling
- Node.js 20+ or Python 3.10+ depending on which you try

## The criteria

A ranking without criteria is just an opinion with numbers attached. These are mine, weighted for teams putting an agent in front of real users:

1. **Durable execution.** If the process dies mid-run, does the agent resume, or does the user lose their work?
2. **Memory that is not a hand-rolled array.** Conversation and working memory as a supported concept with real storage behind it.
3. **Evaluation.** Can you tell whether a change made the agent better, before shipping it?
4. **Observability.** Traces you can read when someone asks what happened.
5. **Type safety and developer experience**, because agents are mostly plumbing and plumbing benefits enormously from a compiler.
6. **Model neutrality.** How expensive is it to change provider when pricing moves?

Nothing here scores frameworks on how quickly you can build a demo. They are all fine at that.

## The numbers

Collected on 11 August 2026 from `api.github.com/repos/<owner>/<repo>` and `api.npmjs.org/downloads/point/last-week/<package>`, so you can re-run them and check. Stars measure attention rather than quality. The npm figures cover the JavaScript package only, which is why a Python-first project shows `n/a` rather than a zero, and why the two columns should not be compared against each other.

| Framework | GitHub stars | npm downloads/week | Primary language |
| --- | --- | --- | --- |
| CrewAI | 56,938 | n/a | Python |
| LangGraph | 39,447 | 3,237,897 | Python, TS port |
| OpenAI Agents SDK | 28,559 | 1,545,612 | Python and TS |
| Mastra | 27,101 | 1,336,248 | TypeScript |
| Vercel AI SDK | 26,129 | 20,559,238 | TypeScript |
| Google ADK | 21,072 | n/a | Python, TS, Go, Java, Kotlin |
| PydanticAI | 19,224 | n/a | Python |

```chart
{
  "type": "bar",
  "title": "GitHub stars, agent frameworks",
  "unit": " stars",
  "caption": "GitHub API, 11 August 2026. Stars track attention, not suitability: the order here is deliberately not the order of the ranking below.",
  "rows": [
    { "label": "CrewAI", "value": 56938, "series": "not ranked" },
    { "label": "LangGraph", "value": 39447, "series": "ranked" },
    { "label": "OpenAI Agents SDK", "value": 28559, "series": "ranked" },
    { "label": "Mastra", "value": 27101, "series": "ranked" },
    { "label": "Vercel AI SDK", "value": 26129, "series": "ranked" },
    { "label": "Google ADK", "value": 21072, "series": "not ranked" },
    { "label": "PydanticAI", "value": 19224, "series": "ranked" }
  ],
  "series": [
    { "name": "ranked", "color": "#f59e0b" },
    { "name": "not ranked", "color": "#52525b" }
  ]
}
```

Notice that the ranking below is not this chart sorted. If it were, this article would be a popularity contest and you could have got it from GitHub yourself.

## How they score against the criteria

The distinction that matters in this table is **built in** versus **available**. Almost everything here is available somewhere, if you are willing to add a dependency and wire it up. What separates them is how much of that wiring you do yourself.

| | Durable execution | Memory | Evals | Tracing | Language | Model neutral |
| --- | --- | --- | --- | --- | --- | --- |
| **Mastra** | Built in (workflows) | Built in | Built in | Built in | TypeScript | Yes |
| **LangGraph** | Built in (checkpointer) | Built in (store) | LangSmith | LangSmith | Python, TS port | Yes |
| **OpenAI Agents SDK** | Sessions only | Built in (sessions) | Separate product | Built in | Python, TS | Mostly |
| **Vercel AI SDK** | No | Documented patterns | No | OpenTelemetry hook | TypeScript | Yes |
| **PydanticAI** | Temporal, DBOS, Prefect, Restate | Message history | `pydantic-evals` | Logfire | Python | Yes |

Two things in that table are worth saying out loud, because they cut against the ranking.

**PydanticAI's durability story is better than its position suggests.** It supports [four co-maintained durable execution backends](https://pydantic.dev/docs/ai/integrations/durable_execution/overview/) (Temporal, DBOS, Prefect and Restate), plus Kitaru and Airflow. That is more choice than anyone else here offers. The tradeoff is that you are running Temporal, which is a real piece of infrastructure to operate, where Mastra's durability needs nothing extra on day one.

**Vercel AI SDK's row of "no" is not a failing grade.** It is a different product, and the section below explains why it is still on the list.



## 1. Mastra

**Best for: a TypeScript team building a production agent on a deadline.**

```github
https://github.com/mastra-ai/mastra
```

Mastra is the one that treats the second-day problems as the product rather than as extensions. Durable workflows, memory, evals, tracing and MCP support are in the box and designed together, which is the difference between a framework and a collection.

The workflow primitive is the part worth understanding. Steps are typed, composable and resumable, so a run that dies at step four resumes at step four rather than at the beginning:

```typescript
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

const triage = createStep({
  id: 'triage',
  inputSchema: z.object({ alert: z.string() }),
  outputSchema: z.object({ severity: z.enum(['page', 'ticket', 'ignore']) }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent('oncall');
    const res = await agent.generate(`Classify: ${inputData.alert}`);
    return { severity: parseSeverity(res.text) };
  },
});

export const incidentWorkflow = createWorkflow({ id: 'incident' })
  .then(triage)
  .then(notify)
  .commit();
```

The schemas are the point. Each step declares what it takes and returns, so the compiler catches a mismatch between step three and step four rather than production catching it.

The memory work is the part with numbers attached, and it is the strongest single argument for the top spot. Mastra's Observational Memory runs background observer and reflector agents that maintain a dense observation log, replacing raw message history as a conversation grows. On [LongMemEval](https://mastra.ai/research/observational-memory), published February 2026, it reports:

| Model | LongMemEval score |
| --- | --- |
| gpt-5-mini | 94.87% |
| gemini-3-pro-preview | 93.27% |
| gemini-3-flash-preview | 89.20% |
| gpt-4o (the benchmark's standard model) | 84.23% |

The number to compare is the gpt-4o one, because that is what other published results use. The previous openly reproducible best was Supermemory at 81.60%.

Two caveats, because a vendor benchmark deserves them. This is Mastra measuring Mastra, and a benchmark is not your workload. What makes it worth citing anyway is that [the implementation and the benchmark runner are both open source](https://github.com/mastra-ai/mastra/tree/main/explorations/longmemeval), so the claim is checkable rather than asserted. It also needs no vector database, which removes a piece of infrastructure most memory designs assume.

**Where it wins:** one dependency instead of four, with the pieces already fitted together. Local development has a Studio for inspecting runs and traces, which removes the usual print-statement phase. Model-neutral, so switching provider is configuration.

**Where it loses:** it is younger than LangGraph and the ecosystem around it is correspondingly smaller. If you want a pre-built integration for something unusual, you are more likely to find it in LangChain's ecosystem, and more likely to write it yourself here. It is also TypeScript-first, so a Python shop should look further down this list.

**Adoption:** 27,101 stars and 1.3M weekly downloads of `@mastra/core`, with production use reported at Replit, PayPal, Sanity and Brex. Founded by Sam Bhagwat, Abhi Aiyer and Shane Thomas, who built Gatsby and stayed on through its acquisition by Netlify. YC W25.

## 2. LangGraph

**Best for: complex, stateful workflows where you want to define the graph yourself.**

```github
https://github.com/langchain-ai/langgraph
```

LangGraph models an agent as an explicit state machine. You define nodes and edges, and control flows exactly where you put it. When the branching is genuinely complicated, that explicitness is worth a great deal, and nothing else here gives you the same grip on the details.

```python
from langgraph.graph import StateGraph, END

graph = StateGraph(AgentState)
graph.add_node("triage", triage_node)
graph.add_node("remediate", remediate_node)
graph.add_conditional_edges(
    "triage",
    lambda s: "remediate" if s["severity"] == "page" else END,
)
graph.set_entry_point("triage")
app = graph.compile(checkpointer=checkpointer)
```

That `checkpointer` is durable execution, and it was in LangGraph before most of the field took the problem seriously.

**Where it wins:** control, maturity, and the largest ecosystem in the category. If an integration exists anywhere, it probably exists here first.

**Where it loses:** you write more of the plumbing yourself, and the graph is a real abstraction to learn rather than an API to call. The JavaScript library is a real one, with durable execution, interrupts, memory and both the graph and functional APIs, so "Python only" would be unfair. The softer and still true version is that Python is where the project's centre of gravity sits: the examples, the integrations and the community answers you will search for are disproportionately Python.

## 3. OpenAI Agents SDK

**Best for: teams already committed to OpenAI who want the shortest path.**

```github
https://github.com/openai/openai-agents-python
```

A small, well-made library covering agents, handoffs, guardrails and sessions, in Python and TypeScript. If your models come from OpenAI and your needs are a tool loop with some structure, this is less code than anything else here and the built-in tracing is genuinely good.

Handoffs are the idea worth borrowing. Instead of one agent with twelve tools, you give each agent a narrow job and let it pass control:

```python
from agents import Agent, Runner

escalation = Agent(
    name="escalation",
    instructions="Page the on-call engineer and summarise the alert.",
)

triage = Agent(
    name="triage",
    instructions="Classify the alert. Hand off anything user-facing.",
    handoffs=[escalation],
)

result = await Runner.run(triage, "checkout latency p99 is 14s")
```

The handoff is a tool call under the hood, so the model decides when to escalate and the trace shows you why.

**Where it wins:** minimal surface area, excellent tracing, first-party support for OpenAI's own features on the day they ship.

**Where it loses:** the gravity is toward one provider. It does support others, but you are building on a vendor's SDK, and the day pricing moves is the day that matters. Durable execution is not the built-in story it is in Mastra or LangGraph.

## 4. Vercel AI SDK

**Best for: streaming model output into a React interface.**

```github
https://github.com/vercel/ai
```

At 20.5 million weekly downloads it is by far the most used package in this article, and it has moved a long way from being only a streaming helper. It now ships `ToolLoopAgent` and `WorkflowAgent`, subagents, memory guidance, policy-based tool approvals, and `HarnessAgent` for driving preconfigured harnesses like Claude Code or Codex. Anyone still describing it as "just the UI layer", as an earlier draft of this article did, is working from a stale picture.

The distinction that survives is narrower and still decisive: there is no durable workflow engine. The loop runs in your process. If that process dies at step four, nothing brings it back to step four, and the documented workflow patterns are conditionals and functions in your own code rather than a checkpointed state machine.

That is a design choice, not a defect. The pattern that works well in 2026 is to use it for the edge it is unmatched at while something else owns durability. Mastra reuses it at the UI boundary for exactly this reason.

The API is about as small as this gets, and swapping provider really is one line:

```typescript
import { streamText, tool } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

const result = streamText({
  model: anthropic('claude-sonnet-5'), // swap for openai(...) and nothing else changes
  prompt: 'Summarise the last deploy',
  tools: {
    getDeploy: tool({
      description: 'Fetch the most recent deploy',
      inputSchema: z.object({ service: z.string() }),
      execute: async ({ service }) => fetchDeploy(service),
    }),
  },
});

return result.toUIMessageStreamResponse(); // straight into a React hook
```

That last line is the reason people reach for it. Getting tokens onto the screen, with tool calls rendered as they happen, is genuinely hard, and this makes it a one-liner.

**Where it wins:** streaming, generative UI, and the smoothest React integration available.

**Where it loses:** durability and evaluation. A run that dies is gone, and there is no eval story in the box, so both are yours to build or to borrow from another library.

## 5. PydanticAI

**Best for: Python teams who want types to mean something.**

```github
https://github.com/pydantic/pydantic-ai
```

From the Pydantic team, and it shows. Structured outputs are validated properly, dependency injection is a first-class idea, and the whole thing feels like a library written by people who ship production Python rather than demos.

The output type is the contract, and the agent is re-prompted until it satisfies it:

```python
from typing import Literal

from pydantic import BaseModel
from pydantic_ai import Agent

class Triage(BaseModel):
    severity: Literal['page', 'ticket', 'ignore']
    reason: str

agent = Agent('anthropic:claude-sonnet-5', output_type=Triage)

result = await agent.run('checkout latency p99 is 14s')
print(result.output.severity)  # a validated Triage, not a string to parse
```

You get a typed object or an error. There is no branch where the agent returns prose and you write a regex to rescue it.

**Where it wins:** validation you can trust, a clean testing story, and the FastAPI-shaped ergonomics that a lot of Python teams already think in. Durability is a genuine strength too: four co-maintained backends is more choice than anything else on this list.

**Where it loses:** it deliberately does less itself. Durability, observability and evals all come from separate pieces (Temporal or DBOS, Logfire, `pydantic-evals`), which is more assembly than Mastra asks for, and more infrastructure to run. If you want one integrated framework, this is not trying to be one.

## Why CrewAI and Google ADK are not in the five

Leaving out the most-starred project in the category needs a reason.

**CrewAI** has 56,938 stars, more than anything else here, and it is genuinely the fastest way to express a team of role-playing agents that collaborate. The usual dismissal, that the crew metaphor is too strong an opinion about how your agents should be organised, only addresses half the product: CrewAI also has Flows, a more controlled API with persistent state, resume and human-in-the-loop triggers, which is much closer to what LangGraph offers. The narrower reason it is not ranked is that the framework asks you to choose between those two models up front, and its centre of gravity is still the crew. When that metaphor fits your problem, it fits well, and it should be on your shortlist.

**Google ADK** at 21,072 stars is the closest call on this list, and the easy dismissal of it is wrong. It is not Python-only (Python, TypeScript, Go, Java and Kotlin are all supported) and it is not Gemini-only (there are adapters for Claude, OpenAI, Ollama, vLLM and LiteLLM). The honest reason it is not ranked is narrower: its centre of gravity is Google Cloud, where the managed deployment, Cloud Trace observability and auth story are clearly the intended path. If you are already there, move it up your own list.

Both belong on a longer list. Neither changes the answer for most teams.

## Choosing between them

```diagram
{
  "type": "branch",
  "title": "Which one, in practice",
  "nodes": [
    { "label": "What are you actually building?", "sub": "start here, not from the star count", "icon": "gear" }
  ],
  "branch": [
    { "label": "Mastra", "sub": "TypeScript, needs durability and memory", "icon": "rocket" },
    { "label": "LangGraph", "sub": "complex branching you want to control", "icon": "branch" },
    { "label": "OpenAI Agents SDK", "sub": "committed to OpenAI, want minimal code", "icon": "check" },
    { "label": "Vercel AI SDK", "sub": "streaming model output into React", "icon": "globe" },
    { "label": "PydanticAI", "sub": "Python, and types matter", "icon": "shield" }
  ]
}
```

:::tip
Whichever you choose, build the boring parts first: a trace you can read, and one evaluation that fails when the agent gets worse. How much you get for free varies (Mastra bundles both, LangGraph and PydanticAI point you at a companion product, Vercel AI SDK leaves evals to you), so check the table above before assuming it is included. Teams that skip these end up rewriting prompts by feel and arguing about whether it improved.
:::

If the loop itself is the part that still feels like magic, our [agentic loop simulator](/games/agentic-loop-simulator) steps through plan, build, verify and repeat one stage at a time, including what happens when you let the agent grade its own work.

## Common questions

**Do I need an agent framework at all?**

Often not. If you are calling one model with three tools and no state between calls, a plain SDK call in a loop is perfectly reasonable and easier to debug. The frameworks start paying for themselves at the point you need runs to survive a restart, conversations to persist, and changes to be evaluated rather than eyeballed. Adopt one when you hit that, not before.

**Which is best for a TypeScript team?**

Mastra, in most cases, because durability, memory, evals and tracing arrive together. Vercel AI SDK if the hard part is the interface rather than the agent, and the two are frequently used together. LangGraph's JavaScript library is fully capable, but most of its examples and community answers are written in Python.

**Which is best for Python?**

LangGraph if the complexity is in the control flow and you want to hold the graph yourself. PydanticAI if the complexity is in the data and you want validated outputs, with durability supplied by Temporal or DBOS.

**Is CrewAI a bad choice because it is not in the top five?**

No. It is the most-starred project in the category and it is very good at what it does, which is teams of role-playing agents collaborating on a task. It is not ranked here because that metaphor is a strong assumption about how your system is shaped, and most production agents are one agent doing one job carefully.

**How hard is it to switch later?**

Easier than it feels, if you keep your tools as plain functions and your prompts out of the framework's types. The tool implementations and the domain logic port with little friction. What does not port is the orchestration layer, so the switching cost is roughly the cost of rewriting your workflow definitions.

**Are these rankings based on benchmarks?**

No, with one exception. The ranking weighs documented capability against the criteria at the top of this article. The only measured numbers here are the GitHub and npm figures, and Mastra's LongMemEval results, which are Mastra's own published benchmark rather than an independent one.

## What this ranking does not tell you

Being honest about the limits of a list like this:

- **These are mostly not benchmarks.** No agent was built five ways and timed. The ranking weighs documented capability against the stated criteria. The one measured result quoted here, Mastra's LongMemEval score, is Mastra's own published benchmark, not an independent test.
- **Stars and downloads measure attention, not fit.** They are in the table because they are checkable, not because they are decisive.
- **This market moves faster than the article.** Every number has a date on it for that reason.
- **Your constraints beat this ranking.** A team with deep LangChain experience should probably use LangGraph regardless of what is written here.

The genuinely useful exercise is to build the same small thing twice, in your language, with your model, and see which one you would rather maintain. We are planning to do exactly that next, with an on-call agent.

For related reading, we have written about [running a background job that must not be lost](/posts/running-a-background-job-that-must-not-be-lost), which is the same durability problem agents face, and about [what one merge costs in CI](/posts/what-does-one-merge-cost-in-ci) for measuring things rather than guessing.
