---
title: 'Agentic AI Vocabulary for DevOps: 12 Terms You Already Operate Under Another Name'
excerpt: 'Every agentic AI glossary is written for executives. Read the same twelve terms as an infrastructure engineer and most of them describe control loops, sandboxes and admission policies you have run for a decade. The useful exercise is finding the three where that analogy breaks, because those are the ones that will page you.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-08-19'
publishedAt: '2026-08-19T14:00:00Z'
updatedAt: '2026-08-19T14:00:00Z'
readingTime: '14 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - AI
  - DevOps
  - SRE
  - MCP
  - Kubernetes
  - Security
---

There is a genre of infographic doing the rounds at the moment: twelve must-know agentic AI terms, a leader's guide to the language of agents. They are aimed at executives, and for that audience they are fine. The trouble is what happens next, which is that the executive brings the vocabulary to the platform team and asks how soon an agent can have production access.

If you run infrastructure, the honest reading of that list is not that twelve new things have arrived. It is that ten of them are concepts you already operate, under names you already use, and two of them are genuinely new and are the ones that will hurt you. An agent loop is a reconciliation loop. Guardrails are admission control. Sandboxing is what you have been doing to untrusted workloads since cgroups.

This post is the translation table, and then the part the infographics leave out: exactly where each analogy breaks. The breaks are the interesting bit. If an agent were just a controller, you would already know how to run one.

## TLDR

- **Ten of the twelve terms map cleanly onto infrastructure primitives** you already operate: control loops, IAM, sandboxes, admission policies, change gates, schedulers.
- **The agent loop is a reconciliation loop with a nondeterministic controller.** Same shape, and every operational assumption that depends on "same input, same output" stops holding.
- **Tool use is an IAM question, not an AI question.** An agent's blast radius is exactly the union of the credentials you handed its tools. Nothing about the model changes that.
- **Prompt injection is privilege escalation** with a content payload rather than a binary one, and your telemetry is a delivery channel for it.
- **The two genuinely new things are nondeterminism and unbounded runtime cost.** Neither has a good analogue in the infrastructure you already run.
- Ask the blast-radius question before the model question. Which credentials, which environments, and what does the audit trail actually record.

## Prerequisites

- Working familiarity with containers and some orchestrator, most likely Kubernetes
- Some exposure to IAM or RBAC, at any level of enthusiasm
- Having read one agentic AI explainer and come away unsure what was actually being claimed

## The translation table

Start here. This is the whole argument in one screen.

| The agentic term | What you already run | Where it lives in your stack |
| --- | --- | --- |
| Agent loop | A reconciliation loop | Kubernetes controllers, Argo CD sync |
| Tool use | An API client with credentials | IAM roles, service accounts, tokens |
| MCP | A plugin interface for tools | Like CSI or CNI, but for capabilities |
| Sandboxing | Workload isolation | Containers, seccomp, gVisor, network policy |
| Guardrails | Policy enforcement | OPA, Kyverno, admission webhooks, RBAC |
| Grounding | Reading real state before acting | Metrics, logs, traces, the actual API |
| Human-in-the-loop | A change approval gate | PR review, manual approval on a pipeline |
| Orchestrator | A scheduler and work queue | Kubernetes scheduler, Airflow, Temporal |
| Subagent | A worker process on a narrow job | A job, a sidecar, a lambda |
| Multi-agent | A distributed system | Every distributed system you have debugged |
| Memory | Persistent state | The thing that turns a Deployment into a StatefulSet |
| Context window | A resource limit | Like a memory limit, and it evicts the same way |

Ten of those twelve are re-labellings. That is not a criticism of the vocabulary. It is the reason infrastructure people are unusually well equipped to reason about agents, and unusually badly served by explainers pitched at executives.

Now the parts worth going into properly.

## The agent loop is a reconciliation loop with one crucial difference

Every agentic explainer draws the same cycle: perceive, plan, act, observe, repeat. If you have written a Kubernetes controller, you have drawn that cycle yourself and called it something else.

```diagram
{
  "type": "loop",
  "title": "The same loop, twice",
  "goal": "observe reality, compare to intent, act, observe again",
  "loopTop": "until desired state is reached",
  "loopBack": "re-observe after acting",
  "nodes": [
    { "label": "Observe", "sub": "watch the API, or read the context", "icon": "activity", "tone": "blue" },
    { "label": "Diff", "sub": "current vs desired, or plan a step", "icon": "activity", "tone": "violet" },
    { "label": "Act", "sub": "call the API, or call a tool", "icon": "gear", "tone": "amber" },
    { "label": "Verify", "sub": "read status, or observe the result", "icon": "check", "tone": "green" }
  ]
}
```

The shape is identical. A controller watches the API server, compares actual state to the spec, acts to close the gap, and observes the result. An agent reads its context, plans a step, calls a tool, and observes the output. If you want the mechanics of the first one in detail, [Write a Simple Kubernetes Operator](/posts/write-simple-kubernetes-operator) builds one from scratch, and everything in it transfers. For the loop from the agent side, including why the thing that judges the work has to be separate from the thing that does it, see [Stop Prompting, Start Looping](/posts/stop-prompting-start-looping).

Here is the difference, and it is not a small one. **A controller is deterministic and an agent is not.**

Give a controller the same cluster state twice and it produces the same action twice. That single property is load-bearing for almost everything you know about operating control loops. It is why you can test a controller, why you can reason about a stuck reconcile, why a rerun is a diagnostic tool rather than a gamble, and why "it did something different this time" is a bug report rather than expected behaviour.

An agent given identical inputs may take a different path. Not usually a wildly different one, but different enough that the following all stop being reliable:

- **Reproducing a failure.** Running it again is not a controlled experiment.
- **Testing coverage.** Passing once does not establish that the path is safe.
- **Post-incident analysis.** "Why did it do that" may have no better answer than "it sampled a different token".

Everything else in this post follows from that one property. The infrastructure analogies hold right up until they depend on determinism, and then they stop.

## Tool use is an IAM problem wearing a new hat

This is the term that causes the most confused conversation, and it is the one with the cleanest answer.

An agent cannot do anything except through a tool. The model produces text. Text becomes an action only when something on your side takes that text and calls an API. So the question "what can this agent do to my infrastructure" has an exact answer, and it is not a question about the model at all:

> An agent's blast radius is the union of the permissions held by every tool you gave it.

That is an IAM audit, and you already know how to do one. If the agent has a tool that calls `kubectl` with a kubeconfig bound to `cluster-admin`, then the agent is `cluster-admin`. No amount of instruction in a system prompt changes that, in the same way that telling an intern to be careful is not an access control mechanism.

The practical consequence is that the safety conversation should start with credentials, not with the model:

```bash
# The only question that actually bounds what an agent can do.
kubectl auth can-i --list --as=system:serviceaccount:agents:incident-responder
```

If that output frightens you, the model choice is irrelevant. If it is tightly scoped, then a bad plan produces a rejected API call rather than an outage.

:::tip
The useful mental model is that an agent is a user, not a service. Give it its own identity, scope it to exactly what it needs, and make its actions attributable in the audit log. An agent sharing your platform team's service account is the same mistake as a CI pipeline sharing a human's credentials, and it fails in the same way at the same time: during the incident review.
:::

## MCP is a plugin interface, and it inherits plugin-interface problems

Model Context Protocol is the term most likely to be presented as more novel than it is. It is a protocol for exposing tools, data and prompts to an agent through a consistent interface, so a capability written once can be used by any client that speaks it.

Structurally, that is the same idea as CSI for storage or CNI for networking: a stable interface so that vendors write one implementation instead of one per consumer. We have written about [when to reach for MCP versus a plain CLI](/posts/cli-vs-mcp-when-to-use-each), and the short version is that the answer is usually both.

What matters operationally is that a plugin interface is a supply chain. Each MCP server is code, from someone, running with access to whatever you gave it. That is the same trust question as a Helm chart, a Terraform provider or a GitHub Action, with the added wrinkle that an MCP server's tool descriptions are themselves text that reaches the model. Our writeup of the [MCP design flaw and the RCE it enabled](/posts/mcp-design-flaw-rce-supply-chain-risk) covers where that went wrong in practice.

Treat MCP servers the way you treat any third-party admission webhook or CSI driver: pin versions, read what you install, and do not run one you cannot attribute.

## Guardrails are admission control, and they belong outside the agent

"Guardrails" in most explainers means rules and policies that limit unsafe actions. Written down like that, it sounds like something you configure inside the AI product.

The version that survives contact with production is the one you already run: **policy enforced at the boundary the agent cannot reach past.** An admission webhook does not ask the workload to behave. It rejects the request. RBAC does not trust the client's intent. It evaluates the call.

That distinction is the whole game. There are two places to put a guardrail:

1. **In the prompt.** "Never delete a production namespace." This is a strong suggestion to a nondeterministic system, and it is defeated by anything that alters the model's context, including a malicious log line.
2. **In the enforcement layer.** No delete permission on production namespaces. This is defeated by nothing, because the capability does not exist.

Prompt-level rules are worth having, in the same way that documentation and linting are worth having. They are not controls. If a guardrail matters, it belongs in RBAC, in OPA or Kyverno, in a network policy, or in the absence of a credential.

:::warning
The failure mode to watch for is a guardrail that is described in a system prompt and nowhere else, then presented in a design review as a control. Ask where it is enforced. If the answer is "we told it not to", it is documentation.
:::

## Grounding is observability, and it is also an attack surface

Grounding means connecting the model's output to real data instead of what it inferred. For infrastructure work, "real data" is your telemetry: metrics, logs, traces, and the live state of the API.

The upside is genuine, and it is the part of AI operations that is actually working today. An agent that reads real metrics before proposing a cause is doing what a good on-call engineer does. Our assessment of [what AI SRE agents fix and break](/posts/ai-sre-agents-what-they-fix-and-break) found the investigation half to be the solid half, and grounding is why.

The part the infographic cannot fit in a box is that grounding makes your telemetry an input to a decision-making system. Logs are attacker-influenced data. A log line is written by a request, and a request can be crafted. Once an agent reads logs and can act on them, a string in a log becomes a potential instruction.

This is prompt injection, and for infrastructure people the clearest framing is that **it is privilege escalation with a content payload**. The classic escalation path is untrusted input reaching a privileged interpreter. Here the interpreter is the model and the input is anything it reads: log lines, ticket text, commit messages, alert annotations, HTTP user agents.

The mitigations are the ones you would expect from that framing, and none of them are AI-specific:

- Keep the privileged action behind a check the model does not control
- Treat everything the agent reads as untrusted, including your own telemetry
- Scope credentials so a successful injection is bounded
- Log what the agent read as well as what it did, or you cannot reconstruct the escalation

## Human-in-the-loop is a change gate, with the same failure mode

Human review and approval before sensitive actions. You run this already: pull request review, a manual approval step on a deploy pipeline, a break-glass procedure with a second pair of eyes.

Which means you already know how it fails. **Approval gates decay into rubber stamps in direct proportion to how often they fire and how little context they carry.** A reviewer facing the fortieth "agent wants to restart a pod" prompt of the day is not reviewing, they are clicking.

The lesson from change management transfers exactly:

- **Gate on blast radius, not on action count.** Restarting a stateless pod does not need a human. Anything touching persistent data or production networking does.
- **Give the approver the diff, not the intent.** "I will scale the deployment" is not reviewable. `replicas: 3 -> 30` is.
- **Make rejection cheap and normal.** A gate nobody ever rejects is measuring nothing.

If your agent's approval prompt does not contain enough information to make an informed no, it is theatre with an audit trail.

## Orchestrator, subagent, multi-agent: you have debugged this before

The last group is presented as the frontier: a manager layer that assigns tasks, specialised workers with narrow jobs, several agents collaborating on a workflow.

That is a distributed system. Specifically it is a scheduler, a set of workers, and shared state, which is the architecture of nearly everything you already operate.

So the fun part is that you can predict the failure modes without having run one:

- **Partial failure.** One subagent fails, the orchestrator does not notice, the workflow reports success. You have seen this in every job runner ever written.
- **Duplicated work.** Two agents assigned overlapping tasks both act, and the second undoes the first.
- **Coordination cost exceeding the work.** Passing context between agents costs tokens, and past a certain point the orchestration is more expensive than doing it in one place.
- **No idempotency.** Retrying a failed step re-runs a side effect. Same bug as a webhook without a deduplication key.

The design questions are the ones you would ask of any worker pool. What happens when a worker dies halfway? Is the unit of work idempotent? Where is the shared state, and what happens when two workers write it? Our [on-call agent built on Mastra](/posts/we-built-an-on-call-agent-in-mastra) was killed with SIGKILL at the worst possible moment specifically to answer those, which is the right instinct to bring.

## Memory and context window: state, and a resource limit

These two get flattened together in most explainers and they are quite different.

**Memory** is persistence. An agent with memory carries information between runs, which means it has state, which means all your stateful-workload instincts apply. Where does it live, what happens when it is lost, who can read it, and is it in your backup. The [Deployment versus StatefulSet](/posts/kubernetes-deployments-vs-statefulsets) distinction is exactly the right lens: an agent with memory is not a stateless replica you can reschedule freely, and if that memory holds anything derived from production data, it inherits the same handling requirements as the data itself.

**Context window** is a resource limit. It is the amount the model can consider at once, and the operational behaviour when you exceed it is familiar: things get evicted. Early context drops out, and the agent forgets a constraint it was given at the start, in exactly the way a process forgets nothing gracefully when it hits a memory limit.

The practical consequence is that **an instruction given early in a long-running agent session is not a durable constraint.** It is a value in a buffer that is being evicted. This is another reason enforcement belongs outside the model: a rule in RBAC is still there on hour six, and a rule in the opening prompt may not be.

## What is actually new

Strip out the re-labelled concepts and two things remain that have no clean equivalent in the infrastructure you already run.

**Nondeterminism in the control loop.** Every operational practice you have for control loops assumes reproducibility. Testing, staged rollout, incident reproduction, "revert and see if it stops" all lean on it. An agent breaks that assumption, and the honest response is not to pretend otherwise but to move the guarantees somewhere deterministic: enforce in policy, verify with checks the agent cannot influence, and treat its output as a proposal until something deterministic has validated it.

**Runtime cost as a variable.** A controller's cost is roughly fixed and predictable. An agent's cost is a function of how much it reads and how many times it loops, both of which vary per run and can be influenced by the input. A pathological case is not just slow, it is expensive, and there is no equivalent of a `resources.limits` block that the loop cannot argue with. Budget caps and iteration limits are not optimisations here, they are the same category of control as a memory limit.

## The questions to ask before an agent touches production

None of this needs a policy document. It needs five answers.

1. **Which credentials?** Run the `can-i --list` for its identity. That output is the blast radius, and everything else is commentary.
2. **Enforced where?** For each safety rule, name the enforcement point. If the answer is the system prompt, it is not a control.
3. **What does it read?** Everything in that list is untrusted input, including your own logs and tickets.
4. **What does the audit trail record?** Actions alone are not enough. Without what it read, an injection is unreconstructable.
5. **What is the cost ceiling?** Per run and per day, enforced by something outside the loop.

Answer those and the model choice becomes what it should have been all along: an implementation detail you can change later.

## Summary

The vocabulary is not the hard part, and it is mostly not new. An agent loop is a reconciliation loop, tool use is an IAM boundary, guardrails are admission control, grounding is observability, human-in-the-loop is a change gate, and orchestrators with subagents are a worker pool with all the partial-failure problems that implies.

Reading it that way does two useful things. It tells you that your existing instincts mostly transfer, which is more than most explainers will tell you. And it isolates the two places where they do not: a control loop that is not reproducible, and a running cost that is not bounded.

Those two are where the work is. Everything else you have been doing for years.

## FAQ

**Is an agent really just a control loop?**
Structurally, yes, and the comparison holds until it depends on determinism. A controller given the same state acts the same way; an agent may not. Testing, reproduction and rollback all rest on that property, so they all need rethinking.

**What is the single most useful control to add first?**
A scoped identity. Most agent risk is credential risk, and giving the agent its own least-privilege service account bounds the damage from every other mistake, including a successful prompt injection.

**Are prompt-level guardrails worthless then?**
Not worthless, but they belong in the same category as documentation and linting: they improve the common case and they do not stop the adversarial one. Anything that must not happen belongs in RBAC, policy or the absence of a credential.

**How is prompt injection different from ordinary injection?**
Mostly in the payload. It is untrusted input reaching a privileged interpreter, which is a shape you already defend against. The awkward part is that the interpreter has no reliable syntax boundary between instructions and data, so escaping and parameterisation, the usual fixes, are not available.

**Do I need a multi-agent setup?**
Usually not at first. It is a distributed system, and it brings coordination overhead, partial-failure handling and token cost. Start with one agent and narrow tools, and split only when a single loop is demonstrably the bottleneck.

**Where does MCP fit if we already have CLIs?**
MCP standardises capability exposure across clients, and a CLI is often cheaper in tokens and already known to the model. [Our comparison](/posts/cli-vs-mcp-when-to-use-each) goes through the tradeoff properly; in practice most teams end up running both.
