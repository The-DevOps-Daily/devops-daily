---
title: 'Where to Run AI Agents: 8 Managed Agent Runtimes Compared'
excerpt: 'DigitalOcean Managed Agents, Cloudflare, AWS AgentCore, Google, Microsoft Foundry, E2B, Vercel and Modal, compared on isolation, state, tool access, limits and price, with one cost scenario worked out on every platform.'
category:
  name: 'Cloud'
  slug: 'cloud'
date: '2026-09-28'
publishedAt: '2026-09-28T09:00:00Z'
updatedAt: '2026-09-28T15:00:00Z'
readingTime: '14 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Cloud
  - AI Agents
  - DigitalOcean
  - Cloudflare
  - AWS
  - Sandboxes
  - MCP
---

An agent that only runs while your laptop is open is a demo. The moment it has to work through a backlog overnight, react to a webhook, or run for fifty users at once, it needs somewhere else to live: a sandbox it cannot escape, state that survives a pause, a way to reach tools without holding every credential, and a bill that does not surprise you.

In 2026 that "somewhere else" became a product category. DigitalOcean put Managed Agents into public preview on 21 September, AWS shipped AgentCore Runtime V2 three days earlier, Microsoft made Foundry hosted agents generally available in July, Google renamed Vertex AI Agent Engine to Agent Runtime, and Cloudflare took Containers and its Sandbox SDK to GA in April. This post compares eight of them on the things that decide whether an agent survives production, and works out one cost scenario on every platform from list prices.

## TLDR

- **Best overall for running coding and tool-using agents today: DigitalOcean Managed Agents.** Claude Code, Codex CLI and OpenCode start with one command, each session gets its own Firecracker microVM, checkpoints capture live memory, sessions have no 8 or 24 hour limit, and 16,000+ tools sit behind one MCP endpoint. It also has the lowest vCPU list price in the group. It is a public preview in one US region, and its network is open by default until you set an allowlist.
- **Best for many small stateful agents: Cloudflare.** Durable Objects give every agent its own storage and schedule, a hibernating agent is not billed for duration, and the Sandbox SDK adds a VM-isolated Linux box when an agent needs a shell.
- **Best inside an enterprise cloud: AWS AgentCore, Google Agent Runtime or Microsoft Foundry,** depending on which cloud already holds your identity, network and audit trail.
- **Best when you run the agent loop yourself: E2B, Vercel Sandbox or Modal.** They sell the sandbox, not the agent.

## Prerequisites

- An agent you want to host: a coding CLI such as Claude Code or Codex, a framework agent (LangGraph, ADK, Agents SDK), or your own loop.
- A rough idea of your workload: session length, how much of the time the agent waits on a model, and which tools it calls.
- Familiarity with the Model Context Protocol (MCP) helps for the tool-access sections.

## What we compared

Every platform here promises "run your agent in the cloud". They differ on six things that matter once real work runs through them:

1. **Isolation.** Can agent-written code reach anything it should not? A microVM per session is the strongest common answer.
2. **State.** Can a session pause and resume where it was, including running processes? Can you checkpoint it and try two approaches in parallel?
3. **Tool access.** How does the agent reach GitHub, a CRM or a database, and where do the credentials live?
4. **Time to first agent.** How much packaging stands between you and a running session?
5. **Limits.** Largest sandbox, longest session, regions.
6. **Price.** List prices, and what they are billed on.

The platforms fall into four groups, and the ranking makes more sense once you see them:

```diagram
{
  "type": "infra",
  "title": "Four kinds of agent runtime",
  "groups": [
    {
      "label": "Hosts for agents and coding CLIs",
      "sub": "bring a harness, get a microVM",
      "icon": "rocket",
      "tone": "blue",
      "nodes": [
        { "label": "DigitalOcean", "sub": "Managed Agents", "icon": "cloud", "tone": "blue" },
        { "label": "AWS", "sub": "AgentCore Runtime", "icon": "cloud", "tone": "amber" }
      ]
    },
    {
      "label": "Framework runtimes",
      "sub": "deploy an agent built on their SDK",
      "icon": "gear",
      "tone": "violet",
      "nodes": [
        { "label": "Google", "sub": "Agent Runtime", "icon": "cloud", "tone": "green" },
        { "label": "Microsoft", "sub": "Foundry hosted agents", "icon": "cloud", "tone": "slate" }
      ]
    },
    {
      "label": "Edge stateful agents",
      "sub": "one durable object per agent",
      "icon": "globe",
      "tone": "amber",
      "nodes": [
        { "label": "Cloudflare", "sub": "Agents SDK + Sandbox", "icon": "globe", "tone": "amber" }
      ]
    },
    {
      "label": "Sandboxes for your own loop",
      "sub": "you orchestrate, they isolate",
      "icon": "box",
      "tone": "green",
      "nodes": [
        { "label": "E2B", "icon": "box", "tone": "green" },
        { "label": "Vercel Sandbox", "icon": "box", "tone": "slate" },
        { "label": "Modal", "icon": "box", "tone": "violet" }
      ]
    }
  ]
}
```

## At a glance

List prices on 28 September 2026. "Active" means CPU is billed only while it is in use.

| Platform                         | Status  | Isolation           | vCPU-hour         | Memory-hour          | Largest sandbox               | Longest session                       | Regions      |
| -------------------------------- | ------- | ------------------- | ----------------- | -------------------- | ----------------------------- | ------------------------------------- | ------------ |
| DigitalOcean Managed Agents      | Preview | Firecracker microVM | $0.044 (see note) | $0.0095 per GB, peak | 16 vCPU / 32 GB               | No stated limit                       | 1 (Richmond) |
| Cloudflare Containers / Sandbox  | GA      | VM per container    | $0.072, active    | $0.009 per GiB       | 4 vCPU / 12 GiB               | Not stated                            | Global       |
| AWS AgentCore Runtime (V1 rates) | GA      | microVM             | $0.0895, active   | $0.00945 per GB      | 2 vCPU / 8 GB                 | 8 h (14 days on Instances)            | 22           |
| Google Agent Runtime             | GA      | Container           | $0.085            | $0.009 per GiB       | 8 vCPU / 32 GiB               | "Days"                                | 23           |
| Microsoft Foundry hosted agents  | GA      | VM per session      | $0.0994           | $0.0118 per GiB      | 2 vCPU / 4 GiB                | Not stated (idle timeout 2 to 60 min) | 31           |
| E2B                              | GA      | Firecracker microVM | $0.0504           | $0.0162 per GiB      | 8 vCPU / 8 GiB (Hobby)        | 24 h (Pro)                            | Not stated   |
| Vercel Sandbox                   | GA      | Firecracker microVM | $0.128, active    | $0.0212 per GB       | 8 vCPU (Pro), 32 (Enterprise) | 24 h (Pro)                            | About 20     |
| Modal Sandboxes                  | GA      | gVisor              | about $0.071      | $0.024 per GiB       | Not stated                    | 24 h                                  | Not stated   |

Note on DigitalOcean: its price is quoted per vCPU-hour of actual use, but active-CPU billing is "coming soon". Until then it bills 25% of the vCPUs you allocate, whatever the agent does. Microsoft's public pricing page shows placeholders; its rates above come from Microsoft's Azure Retail Prices API.

## 1. DigitalOcean Managed Agents

[Managed Agents](https://docs.digitalocean.com/products/managed-agents/) is two services that work together: **Harness Runtime**, which runs each agent session in its own Firecracker microVM, and **Action Gateway**, a managed MCP endpoint in front of more than 16,000 tools. It went to public preview for all users on 21 September 2026 after a private preview in August.

**Why it is first.** It is the only platform here where the agents most teams already use are first-class citizens. Claude Code, Codex CLI, OpenCode, Hermes and LangGraph are built-in adapters, and a custom container image covers the rest. Starting one is a single command:

```bash
doctl harness-runtime launch --harness claude-code --name repo-helper
```

The rest of the package is what a long-running agent needs:

- **Real pause and resume.** Pausing "freezes the sandbox in place. Processes, memory, and the workspace filesystem are all preserved", and idle sessions pause themselves after 15 minutes by default. A paused session costs nothing for compute.
- **Checkpoints with live memory.** A checkpoint captures the workspace and memory. From it you can fork up to four copies to try different approaches (on the Claude Code, Codex CLI and OpenCode adapters), or roll back in place. Fly.io Sprites restores files only; Daytona forks only its VM sandboxes.
- **Room to work.** Sizes go from 1 vCPU / 1 GB up to 16 vCPU / 32 GB with a 500 GB disk, more than AWS (2 vCPU / 8 GB), Microsoft (2 / 4) or Cloudflare (4 / 12) give a single session. There is no 8 or 24 hour session limit, only a cap of 744 active hours per session per month.
- **Tools without credentials in the sandbox.** Action Gateway exposes its catalog through three meta tools (search, invoke, and a code runner) instead of flooding the model's context. Its OAuth connections are resolved at the gateway, so the key never enters the sandbox. It also works on its own, from a Claude Code or Codex on your laptop.
- **One policy layer.** The coding adapters share the same `allow`, `ask` and `deny` rules, with approvals from the terminal or with `doctl harness-runtime approve`. Support varies in the details: Codex CLI cannot use `default: deny`, and triggered runs must not use `ask`.
- **One key for every model.** Instead of an Anthropic or OpenAI key, a session can use DigitalOcean serverless inference through `HARNESS_INFERENCE_MODEL` and `HARNESS_INFERENCE_API_KEY`, billed on the same DigitalOcean account.

A session is described in YAML. This one follows the [environment spec reference](https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/reference/environment-spec/) and locks down the two defaults you most likely want to change, the open network and the permission rules:

```yaml
name: repo-helper
agent: claude-code
size: mars-2vcpu-4gb
idle_timeout: 10m
env:
  HARNESS_INFERENCE_MODEL: anthropic-claude-5-sonnet
secrets:
  HARNESS_INFERENCE_API_KEY: ${DO_MODEL_ACCESS_KEY}
# Naming one host turns egress into a deny-by-default allowlist
egress:
  - api.github.com
permissions:
  default: ask
  rules:
    - tool: file.read
      action: allow
    - tool: bash
      action: ask
```

One catch from our hands-on run: `doctl` 1.175.0 still asks for a real Anthropic API key when you create a `claude-code` session, even with the inference fields above, and which models your DigitalOcean inference key may use depends on your account's tier. [Issue to Pull Request with DigitalOcean Managed Agents](/posts/issue-to-pull-request-digitalocean-managed-agents) walks through the setup we got working, with OpenCode and DeepSeek V4 Pro.

**Price.** $0.044 per vCPU-hour and $0.0095 per GB-hour of peak memory, the lowest vCPU list price in this comparison. Action Gateway calls cost $0.10 per 1,000, and the Exa search tool $10.10 per 1,000.

**What to watch.**

- It is a **public preview**: no SLA, support on weekday business hours (Pacific time), no data durability guarantee, and the terms warn that the API and spec may change without notice.
- It runs in **one region**, Richmond (RIC1), and data is processed in the US.
- **Egress is open by default** until you name a host, and ordinary secrets are readable inside the sandbox. Scoped secrets, which keep the real key at the egress proxy, are "not yet enabled everywhere".
- Billing runs from a **prepaid balance** shared with your other DigitalOcean products, with no per-session spend cap, and paused sessions still count toward the limit of up to 100 sessions per team.

**Pick it if** you want Claude Code, Codex or OpenCode working in the cloud this week, need sessions up to 16 vCPU with no fixed time limit, or want a large tool catalog without hosting MCP servers yourself.

## 2. Cloudflare Agents SDK, Durable Objects and Sandbox

Cloudflare approaches the problem from the other end. The [Agents SDK](https://developers.cloudflare.com/agents/) turns each agent into a Durable Object with "a durable identity, local SQL storage, real-time connections, scheduled work, and recoverable execution", running in V8 isolates on Cloudflare's global network. When an agent needs a real Linux shell, the [Sandbox SDK](https://developers.cloudflare.com/sandbox/) starts a container where "each sandbox runs in a separate VM". Containers and Sandbox went GA on 13 April 2026.

**Why it is second.** For agents that are many, small and long-lived (a support agent per customer, an email agent per inbox, a webhook agent per repository), it is built for exactly this. A Durable Object that hibernates is not billed for duration, CPU on Containers is billed only while active, Workers and Durable Objects run on Cloudflare's global network, and Containers can be placed by region or jurisdiction, including `eu` and FedRAMP. The 2026 egress controls add host allow and deny lists plus credential injection, so a sandbox can call an API without holding the key.

**Price.** Workers Paid ($5 a month), then Containers at $0.072 per active vCPU-hour and $0.009 per GiB-hour of provisioned memory. Durable Objects cost $0.15 per million requests and $12.50 per million GB-seconds of duration.

**What to watch.**

- The largest container is 4 vCPU, 12 GiB and 20 GB, and container disk is ephemeral (there is a backup and restore API). Heavy coding agents outgrow it.
- An agent handles 30 seconds of compute per request or message; long work goes into scheduled tasks or a sandbox.
- There is no hosted tool catalog. You build and host MCP servers yourself, and `McpAgent` is deprecated in favour of `createMcpHandler`.
- The `agents` package is still pre-1.0 (0.24.0).

**Pick it if** you run lots of stateful, mostly idle agents close to users, or want to host remote MCP servers at the edge.

## 3. AWS Bedrock AgentCore

[AgentCore](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/) is AWS's set of agent building blocks: Runtime, Gateway, Identity, Memory, Code Interpreter and Browser. Each Runtime session "receives its own dedicated microVM", and Runtime V2, launched on 18 September 2026, restores sessions from snapshots with a P75 cold start of 1.9 to 2.0 seconds in AWS's own numbers.

**Strengths.** Runtime, Gateway and Identity run in 22 regions including GovCloud (V2 is in five so far), with IAM and VPC throughout. On V1 pricing, CPU "scales to zero during I/O wait". The Gateway turns your OpenAPI specs, Lambdas and MCP servers into tools for $0.005 per 1,000 calls. An **Instances** option runs sessions on EC2 capacity in your account for up to 14 days, with GPUs.

**What to watch.** A microVM session tops out at 2 vCPU and 8 GB and eight hours. Coding CLIs work (AWS has a walkthrough for Claude Code, Codex and others), but you package and push each one as a container yourself. The Gateway wraps your own APIs rather than shipping a SaaS catalog.

**Pick it if** your identity, data and audit trail already live in AWS.

## 4. Google Agent Runtime (formerly Vertex AI Agent Engine)

Google renamed Vertex AI Agent Engine to **Agent Runtime on Gemini Enterprise Agent Platform** in April 2026. It is a managed runtime for containerized agents, with full integration for Google's ADK and templates for LangGraph, LangChain, AG2 and LlamaIndex, plus Sessions and Memory Bank for state.

**Strengths.** $0.085 per vCPU-hour and $0.009 per GiB-hour, and "idle time spent waiting for the next prompt between turns is not billed", which suits chat-style agents that sit waiting for users. Containers go up to 8 vCPU and 32 GiB, in 23 regions, with Agent Gateway for MCP and A2A governance.

**What to watch.** It is a framework runtime, not a host for third-party coding CLIs. The Code Execution sandbox has "no network access" and does not let you install your own libraries.

**Pick it if** you build on ADK or LangGraph and already run on Google Cloud.

## 5. Microsoft Foundry hosted agents

Foundry Agent Service is GA, and its **hosted agents** reached general availability on 9 July 2026. Hosted agents use "per-session VM-isolated sandboxes" with persistent home directories, and a Toolbox puts curated tools (code interpreter, web search, OpenAPI, MCP and A2A) "behind one managed MCP-compatible endpoint".

**Strengths.** Entra identity, VNet integration, publishing to Teams and Microsoft 365, and 31 regions.

**What to watch.** Sessions are small (0.5 vCPU / 1 GiB up to 2 vCPU / 4 GiB, with up to 20 GiB of disk), idle timeouts run from 2 to 60 minutes, and hosted agents are Python and C# only. Hosted compute lists at $0.0994 per vCPU-hour and $0.0118 per GiB-hour in Microsoft's retail price API.

**Pick it if** your agents serve people who live in Microsoft 365.

## 6. E2B

[E2B](https://e2b.dev/) sells the sandbox, not the agent: "every E2B sandbox runs in its own Firecracker microVM with its own kernel", driven from its open source (Apache-2.0) SDKs while your code runs the loop.

**Strengths.** Pause saves "both the sandbox's filesystem and memory state", resumes in about a second, and a paused sandbox "is kept indefinitely". An MCP gateway inside the sandbox offers 200+ tools from the Docker MCP Catalog. Compute is $0.0504 per vCPU-hour and $0.0162 per GiB-hour.

**What to watch.** Continuous runtime is capped at 1 hour on the free Hobby plan and 24 hours on Pro ($150 a month plus usage), and compute is billed per second on the sandbox size while it runs.

**Pick it if** you are building a product with a code interpreter or coding agent inside it and want to own the orchestration.

## 7. Vercel Sandbox

[Vercel Sandbox](https://vercel.com/docs/sandbox) went GA in January 2026, and "each sandbox runs in its own Firecracker microVM with a dedicated kernel". Sessions can now run for 24 hours on Pro, persistence is on by default, and it is available in Vercel's compute regions.

**Strengths.** CPU is billed only while active ($0.128 per hour), so time spent waiting on a model is not counted, and the firewall "injects credentials into egressing traffic. The secrets never enter the sandbox." The default image ships with Node, Python and coding agents.

**What to watch.** No first-party MCP gateway that we found, a 45-minute session limit on Hobby, and memory at $0.0212 per GB-hour, more than twice DigitalOcean's.

**Pick it if** your agents are TypeScript and AI SDK code that already deploys to Vercel.

## 8. Modal Sandboxes

[Modal](https://modal.com/docs/guide/sandboxes) runs sandboxes on gVisor, with VM sandboxes in beta, and is at its best for Python workloads and GPUs.

**Strengths.** Very high fan-out (Modal claims 100,000+ concurrent sandboxes), GPU support, and egress controls down to a domain allowlist. Good for RL, evals and batch agents.

**What to watch.** Billing is "whichever is higher: your resource request or your actual usage", sandboxes cost about three times Modal Functions, memory snapshots are alpha, and there is no first-party MCP gateway that we found.

**Pick it if** you run many short Python agents or need GPUs next to the sandbox.

## One hour on every platform

To put the price lists side by side, take the example from DigitalOcean's launch post: one hour on a 2 vCPU / 4 GB sandbox, with the agent averaging 25% CPU. Platforms that bill active CPU pay for half a vCPU-hour; the rest pay for the full allocation. Memory is billed on whatever basis each platform uses. Free tiers, plan fees, storage, tool calls and model tokens are left out.

```chart
{
  "type": "bar",
  "title": "One hour at 2 vCPU and about 4 GB, 25% average CPU",
  "unit": "$",
  "caption": "Derived from list prices on 28 September 2026, not quotes. Cloudflare uses its predefined standard-3 type (2 vCPU / 8 GiB). Google counts the whole hour as active; its runtime does not bill idle time between turns, so a chatty agent can cost much less. Microsoft is left out because its billing basis is not confirmed.",
  "rows": [
    { "label": "DigitalOcean", "value": 0.06, "series": "DigitalOcean" },
    { "label": "AWS AgentCore (V1)", "value": 0.083, "series": "Others" },
    { "label": "Cloudflare", "value": 0.108, "series": "Others" },
    { "label": "Vercel Sandbox", "value": 0.149, "series": "Others" },
    { "label": "E2B", "value": 0.166, "series": "Others" },
    { "label": "Google Agent Runtime", "value": 0.206, "series": "Others" },
    { "label": "Modal", "value": 0.238, "series": "Others" }
  ],
  "series": [
    { "name": "DigitalOcean", "color": "#0080ff" },
    { "name": "Others", "color": "#94a3b8" }
  ]
}
```

The arithmetic for the first two, so you can redo it with your own numbers:

```text
DigitalOcean  2 vCPU x 25% x $0.044  +  4 GB x $0.0095   = $0.022 + $0.038 = $0.060
AWS V1        0.5 vCPU-h x $0.0895   +  4 GB x $0.00945  = $0.045 + $0.038 = $0.083
```

Microsoft's retail rates imply about $0.246 if the full allocation is billed for the hour, but we could not confirm how hosted agents are billed.

Two things matter more than the hourly rate. First, a session that never pauses runs for 744 hours in a 31-day month: a medium DigitalOcean session costs $44.64 for that before storage, which is why auto-pause matters. Second, model tokens are billed on top of every number here. Price them before you optimise the sandbox.

## How to pick

| Your situation                                                       | Pick                                                                                                         |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Run Claude Code, Codex or OpenCode in the cloud with the least setup | DigitalOcean Managed Agents                                                                                  |
| Long-running sessions that need more than 8 vCPU                     | DigitalOcean Managed Agents                                                                                  |
| Many small, mostly idle agents close to users                        | Cloudflare                                                                                                   |
| Everything must stay in AWS, with IAM and VPC                        | AWS AgentCore                                                                                                |
| ADK or LangGraph agents on Google Cloud                              | Google Agent Runtime                                                                                         |
| Agents for Teams and Microsoft 365 users                             | Microsoft Foundry                                                                                            |
| A code interpreter inside your own product                           | E2B                                                                                                          |
| TypeScript agents already on Vercel                                  | Vercel Sandbox                                                                                               |
| Python fan-out, evals or GPUs                                        | Modal                                                                                                        |
| Health or card data (PHI, PCI)                                       | Not DigitalOcean while it is in preview (its terms forbid it); check each GA platform's compliance programme |

## What we could not confirm

- Cloudflare does not name the hypervisor behind its container VMs, and Google does not name the sandboxing technology behind Agent Runtime.
- Microsoft's public pricing page for hosted agents shows placeholders; the rates here come from its retail price API.
- DigitalOcean's docs disagree with themselves in places: the limits page says VPC connections are not supported while the spec documents a `vpc_uuid` field, and resume is quoted as 200 ms in marketing and 305 ms in the launch benchmark.
- Prices and preview terms change fast in this category. Check each vendor's page before you commit.

## Summary

The category split into two ideas in 2026. One says "give us your agent and we will run it": DigitalOcean, AWS, Google and Microsoft. The other says "we give you a sandbox, you run the agent": E2B, Vercel, Modal, and Cloudflare with its own twist of one durable object per agent.

For most teams that want an agent like Claude Code or Codex working in the cloud now, DigitalOcean Managed Agents is the shortest path: one command to a microVM, pause and resume with memory, sandboxes up to 16 vCPU / 32 GB, a large tool catalog, and the lowest vCPU price on the list. Go in knowing it is a preview in one region, set an egress allowlist on day one, and keep an eye on the prepaid balance. If you need GA guarantees, multiple regions or a specific cloud's identity model, Cloudflare and the hyperscalers are close behind, and the decision table above tells you which.
