---
title: 'Top 5 AI Agent Frameworks in 2026'
excerpt: 'Five frameworks worth shipping production agents on, ranked against stated criteria, with the GitHub and npm numbers behind the ranking and an honest note on where each one loses.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-08-11'
publishedAt: '2026-08-11T09:00:00Z'
updatedAt: '2026-08-11T09:00:00Z'
readingTime: '14 min read'
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
- **[Vercel AI SDK](#4-vercel-ai-sdk)** is the best streaming UI layer by a distance, and is not really an agent framework.
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

Collected on 11 August 2026. Stars measure attention rather than quality, and npm figures cover the JavaScript package only, so they are not comparable across a Python-first project.

| Framework | GitHub stars | npm downloads/week | Primary language |
| --- | --- | --- | --- |
| CrewAI | 56,938 | n/a | Python |
| LangGraph | 39,447 | 3,237,897 | Python, TS port |
| OpenAI Agents SDK | 28,559 | 1,545,612 | Python and TS |
| Mastra | 27,101 | 1,336,248 | TypeScript |
| Vercel AI SDK | 26,129 | 20,559,238 | TypeScript |
| Google ADK | 21,072 | n/a | Python |
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

**Where it wins:** one dependency instead of four, with the pieces already fitted together. Local development has a Studio for inspecting runs and traces, which removes the usual print-statement phase. Model-neutral, so switching provider is configuration.

**Where it loses:** it is younger than LangGraph and the ecosystem around it is correspondingly smaller. If you want a pre-built integration for something unusual, you are more likely to find it in LangChain's ecosystem, and more likely to write it yourself here. It is also TypeScript-first, so a Python shop should look further down this list.

**Adoption:** 27,101 stars and 1.3M weekly downloads of `@mastra/core`, with production use reported at Replit, PayPal, Sanity and Brex. Founded by the Gatsby and Netlify cofounders, YC W25.

## 2. LangGraph

**Best for: complex, stateful workflows where you want to define the graph yourself.**

Repo: [langchain-ai/langgraph](https://github.com/langchain-ai/langgraph)

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

**Where it loses:** you write more of the plumbing yourself, and the graph is a real abstraction to learn rather than an API to call. The TypeScript port trails the Python original, so a JavaScript team is a second-class citizen in a way they are not with Mastra.

## 3. OpenAI Agents SDK

**Best for: teams already committed to OpenAI who want the shortest path.**

Repo: [openai/openai-agents-python](https://github.com/openai/openai-agents-python)

A small, well-made library covering agents, handoffs, guardrails and sessions, in Python and TypeScript. If your models come from OpenAI and your needs are a tool loop with some structure, this is less code than anything else here and the built-in tracing is genuinely good.

**Where it wins:** minimal surface area, excellent tracing, first-party support for OpenAI's own features on the day they ship.

**Where it loses:** the gravity is toward one provider. It does support others, but you are building on a vendor's SDK, and the day pricing moves is the day that matters. Durable execution is not the built-in story it is in Mastra or LangGraph.

## 4. Vercel AI SDK

**Best for: streaming model output into a React interface.**

Repo: [vercel/ai](https://github.com/vercel/ai)

At 20.5 million weekly downloads it is by far the most used package in this article, and it is worth being precise about why: it is the best streaming and UI layer in the JavaScript ecosystem, and it is not really an agent framework. There is a tool loop, but no durable workflow engine and no first-class memory.

That is not a criticism. It does one job extremely well, and the sensible pattern in 2026 is to use it for what it is good at while something else runs the agent. Mastra reuses it at the UI edge for exactly this reason.

**Where it wins:** streaming, generative UI, and the smoothest React integration available.

**Where it loses:** the moment your agent has to survive a restart, remember a conversation across sessions, or be evaluated, you are building that yourself.

## 5. PydanticAI

**Best for: Python teams who want types to mean something.**

Repo: [pydantic/pydantic-ai](https://github.com/pydantic/pydantic-ai)

From the Pydantic team, and it shows. Structured outputs are validated properly, dependency injection is a first-class idea, and the whole thing feels like a library written by people who ship production Python rather than demos.

**Where it wins:** validation you can trust, clean testing story, and the FastAPI-shaped ergonomics that a lot of Python teams already think in.

**Where it loses:** younger and smaller than LangGraph, and it deliberately does less. If you want a large orchestration framework, this is not trying to be one.

## Why CrewAI and Google ADK are not in the five

Leaving out the most-starred project in the category needs a reason.

**CrewAI** has 56,938 stars, more than anything else here, and it is genuinely the fastest way to express a team of role-playing agents that collaborate. The reason it is not ranked is that the crew metaphor is a strong opinion about *how* your agents should be organised, and most production systems I see are one agent doing one job carefully rather than a simulated team. When the metaphor fits, it fits well.

**Google ADK** at 21,072 stars is a solid framework and an obvious pick if you are on Vertex AI and want the platform alignment. That alignment is also the argument against it as a general recommendation.

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
Whichever you choose, build the boring parts first: a trace you can read, and one evaluation that fails when the agent gets worse. Every framework here supports both, and teams that skip them end up rewriting prompts by feel and arguing about whether it improved.
:::

## What this ranking does not tell you

Being honest about the limits of a list like this:

- **These are not benchmarks.** No agent was built five ways and timed. The ranking weighs documented capability and stated criteria, not measured performance.
- **Stars and downloads measure attention, not fit.** They are in the table because they are checkable, not because they are decisive.
- **This market moves faster than the article.** Every number has a date on it for that reason.
- **Your constraints beat this ranking.** A team with deep LangChain experience should probably use LangGraph regardless of what is written here.

The genuinely useful exercise is to build the same small thing twice, in your language, with your model, and see which one you would rather maintain. We are planning to do exactly that next, with an on-call agent.

For related reading, we have written about [running a background job that must not be lost](/posts/running-a-background-job-that-must-not-be-lost), which is the same durability problem agents face, and about [what one merge costs in CI](/posts/what-does-one-merge-cost-in-ci) for measuring things rather than guessing.
