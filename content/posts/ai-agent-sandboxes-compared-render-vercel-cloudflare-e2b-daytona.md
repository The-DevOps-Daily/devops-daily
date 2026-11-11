---
title: 'AI Agent Sandboxes Compared: Render, Vercel, Cloudflare, E2B and Daytona'
excerpt: 'A sandbox for a one-shot code interpreter is not automatically a home for a coding agent. Compare limits, pause behavior, persistence, network controls, and list-price billing across Render, Vercel, Cloudflare, E2B, and Daytona.'
category:
  name: 'Cloud'
  slug: 'cloud'
date: '2026-11-16'
publishedAt: '2026-11-16T15:00:00Z'
updatedAt: '2026-11-16T15:00:00Z'
readingTime: '14 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Cloud
  - AI Agents
  - Sandboxes
  - E2B
  - Daytona
  - Vercel
  - Cloudflare
  - Render
---

A one-shot code interpreter can disappear the moment it has returned a result. A coding agent often cannot: it may hold a development server, wait for a human to review a diff, or return to the same repository tomorrow. That difference turns timeout semantics, snapshot contents, idle billing, and egress controls into architecture decisions.

This is a sandbox-only comparison of Render, Vercel, Cloudflare, E2B, and Daytona. If you are choosing a broader agent runtime with identity, memory, tool gateways, and an agent loop, start with [our managed-agent runtime comparison](/posts/managed-agent-runtimes-compared-2026). Here, the question is narrower: where should your agent's shell, files, and processes live?

## TLDR

- **Short tool calls:** Cloudflare fits event-driven work when a Worker already owns the request. Its instance can stop after the work, but save files yourself before it does. [Cloudflare documents the lifecycle and snapshot boundary.](https://developers.cloudflare.com/sandbox/concepts/lifetime/)
- **Long-running coding agents:** Render is the clearest fit when a process must survive a human wait. It can disable both timeouts and its runtime snapshots retain memory and processes. [It is a public beta.](https://render.com/docs/sandboxes-creating)
- **Pause for review, then resume in place:** Daytona VM sandboxes and E2B can preserve memory and processes through a pause. Daytona charges disk while paused; E2B says a pause can preserve filesystem and memory. [Daytona billing](https://www.daytona.io/docs/billing) and [E2B security documentation](https://e2b.dev/security) describe those states.
- **Cheapest idle:** Render stops CPU and memory charges when a sandbox is suspended, leaving snapshot storage at [\$0.08 per GB-month](https://render.com/pricing). Daytona VM pauses bill reserved disk, and Vercel bills its filesystem snapshot at the same \$0.08 per GB-month. [Render's launch post describes that billing boundary.](https://render.com/blog/introducing-render-sandboxes)

## Prerequisites

- A workload description: how long a task actively computes, how long it waits, and whether a running process must survive the wait.
- An account with the plan and regional availability needed by the provider you choose.
- A place to persist the work product outside the sandbox when deletion would be unacceptable.

## What we compared

The four columns below are deliberately operational: how long the machine exists, what a pause means, what is billed, and what survives. “Not documented” means we could not find the detail in current official vendor material, not that the vendor necessarily lacks the feature.

| Provider                 | Runtime limits                                                                                                                                                                                                                                                                                                                                                                                                              | Suspend or resume                                                                                                                                                                                                 | Pricing and idle state                                                                                                                                                                                                                                                                                                | What persists                                                                                                                                                                                                                                                                                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Render**               | Default runtime timeout [24 hours](https://render.com/docs/sandboxes-creating); set [60 seconds to 30 days](https://render.com/docs/sandboxes-creating), or `0` to disable. Default idle timeout [15 minutes](https://render.com/docs/sandboxes-creating). Up to [8 CPU, 16 GB RAM, 40 GB writable disk](https://render.com/docs/sandboxes-limits), [1,000 concurrent](https://render.com/docs/sandboxes-limits) per group. | Idle suspension keeps the filesystem and can resume within [30 days](https://render.com/docs/sandboxes-creating). Runtime snapshots keep filesystem, memory, and CPU state; filesystem snapshots keep files only. | [Active CPU plus allocated memory](https://render.com/blog/introducing-render-sandboxes); suspended means snapshot-storage only. List rates: [\$0.12 per active CPU-hour plus \$0.038 per hour per 2 GB of memory (\$0.076/hour for 2c-4g), and \$0.08 per GB-month of snapshot storage](https://render.com/pricing). | Runtime snapshot preserves files, processes, and memory. Termination permanently deletes the filesystem unless exported or snapshotted. [Outbound policy can allow all, allow a domain list, or deny all.](https://render.com/blog/introducing-render-sandboxes)                                                                                     |
| **Vercel**               | Session default [5 minutes](https://vercel.com/kb/guide/vercel-sandbox-duration-and-persistence), maximum [45 minutes on Hobby and 24 hours on Pro and Enterprise](https://vercel.com/kb/guide/vercel-sandbox-duration-and-persistence). Up to [4, 8, or 32 vCPU by plan](https://vercel.com/sandbox), with [2 GB per vCPU](https://vercel.com/sandbox).                                                                    | There is no in-memory pause. Persistent sandboxes stop, snapshot the filesystem, then boot a new session on use.                                                                                                  | [\$0.128 active CPU-hour and \$0.0212 GB-hour provisioned memory](https://vercel.com/docs/sandbox/pricing), plus [\$0.08 GB-month snapshot storage](https://vercel.com/docs/sandbox/pricing). CPU waiting on I/O is not billed, but memory is billed while the session runs.                                          | Persistent is the default: filesystem and installed packages return, processes do not. A [Drive](https://vercel.com/kb/guide/vercel-sandbox-duration-and-persistence) can outlive a sandbox. A [sandbox firewall](https://vercel.com/docs/sandbox/concepts/firewall) can allow all, deny all, or apply a user-defined policy, changeable at runtime. |
| **Cloudflare Sandboxes** | No guaranteed runtime duration. Inactivity can be set to [up to 6 hours](https://developers.cloudflare.com/sandbox/concepts/lifetime/); a platform event can stop an instance. Largest container is [4 vCPU, 12 GiB, 20 GB](https://developers.cloudflare.com/containers/platform/pricing/).                                                                                                                                | No pause. Stop ends memory, processes, and disk. A beta snapshot is filesystem-only and must be restored by your application.                                                                                     | Containers bill per [10 ms while running](https://developers.cloudflare.com/containers/platform/pricing/): active CPU, provisioned memory, and disk. Workers Paid includes [375 vCPU-minutes, 25 GiB-hours, and 200 GB-hours monthly](https://developers.cloudflare.com/containers/platform/pricing/).                | A Durable Object keeps its storage until code deletes it. Snapshots expire [30 days after creation or last restore](https://developers.cloudflare.com/sandbox/concepts/lifetime); mounted R2 objects outlive instances. Network egress pricing is [documented by region](https://developers.cloudflare.com/containers/platform/pricing/).            |
| **E2B**                  | Hobby sessions up to [1 hour](https://e2b.dev/pricing); Pro up to [24 hours](https://e2b.dev/pricing). Hobby has [10 concurrent](https://e2b.dev/pricing); Pro has [100, expandable to 1,100](https://e2b.dev/pricing). Default size is [2 vCPU and 4 GiB](https://e2b.dev/pricing); a larger official per-sandbox maximum is not documented.                                                                               | Pause can preserve filesystem and memory for resume.                                                                                                                                                              | E2B charges per second of a **running** sandbox: [2 vCPU is \$0.000028/s and 4 GiB is \$0.000018/s](https://e2b.dev/pricing). Pro has a [\$150/month minimum](https://e2b.dev/pricing). Pause-storage pricing: not documented.                                                                                        | E2B says [timeout or shutdown destroys sandboxes](https://e2b.dev/security); pause can preserve filesystem and memory. Retention and storage pricing for paused sandboxes: not documented in the sources reviewed.                                                                                                                                   |
| **Daytona**              | Default auto-stop is [15 minutes](https://www.daytona.io/docs/sandboxes); VM sandboxes default to [60-minute auto-pause](https://www.daytona.io/docs/sandboxes) if neither interval is set. Both can be disabled. Default VM snapshots go up to [4 vCPU, 8 GiB, 10 GiB](https://www.daytona.io/docs/sandboxes); per-sandbox and organization limits are on the [limits page](https://www.daytona.io/docs/limits).           | VM `pause()` freezes running processes and retains memory. Containers do not support pause.                                                                                                                       | Per-second resources: [\$0.0504/vCPU-hour, \$0.0162/GiB-hour, and \$0.000108/GiB-hour storage after the first 5 GiB](https://www.daytona.io/). Paused and stopped VM sandboxes bill disk only.                                                                                                                        | VM pause preserves memory and filesystem; stop clears memory. Containers can archive filesystem to object storage. [TTL and auto-delete can remove a sandbox.](https://www.daytona.io/docs/sandboxes)                                                                                                                                                |

Checked against official docs on 2026-11-11; prices in USD, list prices.

All five expose a programmatic sandbox, but their isolation differs where documented: Render and Vercel use [Firecracker microVMs](https://render.com/blog/introducing-render-sandboxes) and [Firecracker microVMs](https://vercel.com/docs/sandbox) respectively, E2B uses a [Firecracker microVM with its own kernel](https://e2b.dev/security), and Cloudflare describes a container instance as a Linux VM. [Daytona publishes container, Linux VM, Windows, and GPU sandbox classes.](https://www.daytona.io/docs/sandboxes) SDK coverage differs too: Render and Vercel document TypeScript and Python SDKs, and Daytona documents [Python, TypeScript, Ruby, Go, and Java](https://www.daytona.io/docs/sandboxes). Render is [Oregon-only](https://render.com/docs/sandboxes-limits) during the beta, Daytona documents `us` and `eu` targets, and Vercel lists its sandbox regions on its [pricing page](https://vercel.com/docs/sandbox/pricing).

## Render: a runtime snapshot is a real checkpoint

Render Sandboxes entered [public beta on November 4, 2026](https://render.com/blog/introducing-render-sandboxes), which is the newest official status even though older pages may describe early access. The distinction that matters is its two snapshot kinds. A runtime snapshot captures writable files, memory, and CPU state, so a restored sandbox resumes running processes. A filesystem snapshot captures files and installed tools but not a process. [A runtime snapshot must restore to the same compute plan.](https://render.com/docs/sandboxes-snapshots)

That makes Render unusually direct for a coding agent waiting on a reviewer: its default 15-minute idle timer snapshots and suspends, a command or file transfer resumes it, and background processes do **not** count as activity. [Render defines idle as no command execution or file transfer.](https://render.com/docs/sandboxes-creating) If a test run is working only inside the sandbox, either keep an external interaction alive or disable idle suspension. A runtime timeout also resets after a suspend and resume.

There are beta gaps to plan for. Sandboxes do not yet have private networking to other Render services or public URLs, and credential brokering is not generally available. [Those are listed as beta limitations.](https://render.com/docs/sandboxes)

## Vercel: persistence is filesystem persistence

Vercel separates a long-lived named sandbox from the VM session inside it. When a persistent sandbox stops, it snapshots the filesystem, and the next operation boots a new session from that snapshot. [The default is persistent.](https://vercel.com/kb/guide/vercel-sandbox-duration-and-persistence) It is convenient for a workspace that needs `node_modules`, source edits, and configuration to return. It is not a pause: a development server, process memory, open terminal, and connection state are gone.

Vercel also has the most flexible network control of the five: the [sandbox firewall](https://vercel.com/docs/sandbox/concepts/firewall) can switch from allow-all to deny-all or a user-defined policy at runtime without restarting the process, and it can broker credentials so secrets never enter the sandbox. For cost work, do not treat active CPU as the whole bill. Vercel excludes I/O wait from CPU metering, but provisioned memory is still measured for the time the session is running. [Its own example explains both meters.](https://vercel.com/docs/sandbox/pricing)

## Cloudflare: an instance is not the durable object

Cloudflare's design is useful when the agent's durable control plane is a Worker and Durable Object, and a Linux machine is an attached execution unit. The Durable Object can retain a session record or snapshot identifier after the instance stops, but the instance's files, memory, and processes do not survive that stop. [Cloudflare documents this split explicitly.](https://developers.cloudflare.com/sandbox/concepts/lifetime/)

The sharp edge is activity. A Worker request, stream, WebSocket, or alarm can keep the Durable Object active. Work running only _inside_ the instance does not. So a build can receive `SIGTERM` when the inactivity timer ends even while it is still working. [Use an alarm that checks work more frequently than the inactivity timeout, or arrange for the process to finish before the timeout.](https://developers.cloudflare.com/sandbox/concepts/lifetime/)

Snapshot when files matter, and restart the process after restore. Cloudflare says snapshots are public beta, filesystem-only, application-managed, and not restored automatically. Mounted R2 is the better fit for files that must outlive a workspace or be shared.

## E2B: pause holds the machine state

E2B is a direct microVM sandbox service. Its official security material says each sandbox has its own Firecracker microVM and that filesystem and memory state can be preserved through pause and resume. [That is the capability a human-review workflow needs.](https://e2b.dev/security) Its pricing page bills a running sandbox per second, rather than publishing separate active-CPU and provisioned-memory notions.

The important plan boundary is time: the free Hobby tier allows sessions up to one hour, while Pro allows up to 24 hours and starts at $150 per month. E2B's Enterprise offering is where it advertises multi-day and persistent sessions. [Those are plan statements, not an implied retention guarantee for every paused sandbox.](https://e2b.dev/pricing)

E2B's current official material reviewed here does not give a public price for storage while paused or a public maximum resource size above the listed configuration options. Treat those as a sales or console question before using it as a low-cost work queue.

## Daytona: choose VM if you mean pause

Daytona has more lifecycle states than the others, and the sandbox class changes what each state means. A Linux VM sandbox can pause, freezing processes and retaining memory. A container sandbox cannot pause, but can stop and later archive its filesystem. [The lifecycle documentation distinguishes the two.](https://www.daytona.io/docs/sandboxes)

The default timer is another operational trap. Daytona's auto-stop fires after 15 minutes of no qualifying events, and an internal long-running process does not count. VM-capable sandboxes instead default to a 60-minute auto-pause when neither timer is supplied. [Daytona calls out this exact failure mode in troubleshooting.](https://www.daytona.io/docs/en/troubleshooting/) Have the controller call `refreshActivity()` or configure the lifecycle deliberately.

Paused VM state is not billed for CPU or RAM, but it is billed for reserved disk. That makes Daytona a strong review-pause option, not automatically the cheapest idle option. Use archive for a container filesystem that can tolerate a cold return; archived containers stop billing, while snapshots remain billed storage. [Daytona's billing table is explicit on each state.](https://www.daytona.io/docs/billing)

## Worked cost: 40 active minutes, then an 8-hour review

Assume the agent actively uses both vCPUs for 30 minutes, pauses or stops for 8 hours, then uses both vCPUs for 10 more minutes. The arithmetic below excludes network, creation, and storage retained beyond the stated resources. It also assumes no included allowance or account credit.

- **Render: $0.21 plus snapshot storage.** `(2 vCPU x 2/3 h x $0.12) + (2/3 h x $0.076 memory for 2c-4g) = $0.2107`. The 8-hour suspended period has no CPU or memory charge; snapshot storage is $0.08 per GB-month, so a 10 GB snapshot held for 8 hours adds under one cent.
- **Vercel: $0.23 plus snapshot storage and two creation events.** `(2 x 2/3 x $0.128) + (4 x 2/3 x $0.0212) = $0.2272`. Stop, then let persistence restore the filesystem for the second session. Its 8-hour stored snapshot is charged by size at [$0.08/GB-month](https://vercel.com/docs/sandbox/pricing), under one cent for 10 GB over 8 hours.
- **Cloudflare: not computable for exactly 2 vCPU and 4 GiB.** Cloudflare sells fixed instance types, and its 2-vCPU type has [8 GiB and 16 GB disk](https://developers.cloudflare.com/containers/platform/pricing), not 4 GiB. A saved workspace also needs a separately sized snapshot or R2 object.
- **E2B: $0.1104 in running compute, plus the Pro plan minimum and any unpriced paused storage.** `2,400 seconds x ($0.000028 + $0.000018) = $0.1104`; the 8-hour pause has no published storage rate, while the session duration pushes this workflow beyond Hobby's one-hour limit.
- **Daytona: $0.1104 for CPU and RAM, plus disk during all 8 hours and 40 minutes.** `(2 x 2/3 x $0.0504) + (4 x 2/3 x $0.0162) = $0.1104`. The result cannot include disk without choosing a disk size. The first 5 GiB are free, then the published disk rate applies.

```chart
{
  "type": "bar",
  "title": "Known compute cost for the review-pause scenario",
  "unit": "$",
  "caption": "40 active minutes at 2 vCPU and 4 GiB, then 8 hours paused or stopped. Values exclude snapshot and disk storage, which depend on size (under one cent per 10 GB for 8 hours at Render and Vercel). Render assumes both vCPUs are active. E2B excludes its $150/month Pro minimum. Official list prices checked November 11 to 13, 2026.",
  "rows": [
    { "label": "E2B compute only", "value": 0.1104, "series": "known compute" },
    { "label": "Daytona CPU + RAM", "value": 0.1104, "series": "known compute" },
    { "label": "Render before snapshot storage", "value": 0.2107, "series": "known compute" },
    { "label": "Vercel before snapshot storage", "value": 0.2272, "series": "known compute" }
  ],
  "series": [
    { "name": "known compute", "color": "#0080ff" }
  ]
}
```

The chart is not a lowest-price ranking. It is a warning that idle semantics move cost between CPU, memory, snapshot storage, disk storage, and plan minimums. A model call that waits for a response can be cheap in active-CPU systems, while a running session with provisioned memory continues to accrue memory cost.

## The smallest useful SDK shape

The following calls follow current official examples. They are deliberately lifecycle examples, not a production authorization model. Cloudflare and E2B are omitted because their current examples require application-specific Durable Object setup, or because we could not verify a current TypeScript pause call without relying on a beta SDK reference.

```tabs
{
  "title": "Create, run, then suspend or stop",
  "tabs": [
    {
      "label": "Render",
      "lang": "typescript",
      "code": "import { Render } from '@renderinc/sdk';\n\nconst sandboxes = new Render().sandboxes;\nconst sandbox = await sandboxes.create({\n  timeoutSeconds: 300,\n  wait: true,\n});\n\nconst events = await sandboxes.exec(sandbox.id, 'echo hello');\nfor await (const event of events) console.log(event);\n\nawait sandboxes.terminate(sandbox.id);"
    },
    {
      "label": "Vercel",
      "lang": "typescript",
      "code": "import { Sandbox } from '@vercel/sandbox';\n\nconst sandbox = await Sandbox.create();\nawait sandbox.runCommand({\n  cmd: 'node',\n  args: ['-e', 'console.log(\\\"hello\\\")'],\n});\n\n// Persistent sandboxes snapshot their filesystem on stop.\nawait sandbox.stop();"
    },
    {
      "label": "Daytona",
      "lang": "typescript",
      "code": "import { Daytona } from '@daytona/sdk';\n\nconst daytona = new Daytona();\nconst sandbox = await daytona.create({\n  snapshot: 'daytona-vm-medium',\n  autoStopInterval: 0,\n});\n\nconst result = await sandbox.process.executeCommand('echo hello');\nconsole.log(result.result);\n\n// VM sandboxes preserve memory and running processes on pause.\nawait sandbox.pause();"
    }
  ]
}
```

## How to pick

Choose **Render** if preserving a process through an idle wait is the defining requirement, and the beta status plus Oregon placement are acceptable. Choose **Vercel** if you need a named workspace whose filesystem resumes cleanly, and a restarted process is fine. Choose **Cloudflare** when the Worker and Durable Object are your durable agent control plane, with the sandbox treated as replaceable compute. Choose **E2B** when you want a focused microVM service with pause and resume, but price the Pro minimum and verify persistence retention. Choose **Daytona VM sandboxes** when a true pause matters and disk-only pause billing fits the workload.

Do not use an auto-stop default as job completion. For every option, persist a task checkpoint outside process memory before a timeout, a stop, or a platform event. If an agent can reach a production system, also constrain egress and give it a narrowly scoped identity. [Our guide to agent prompt-injection controls](/posts/prompt-injection-ops-agent-measured) explains why that boundary belongs outside the model prompt.

## What we could not confirm

- A Render retention time for an automatically suspended sandbox beyond the stated 30-day resumability period.
- A Vercel in-memory pause (its persistence is filesystem-only).
- A Cloudflare fixed maximum instance lifetime or an exact 2 vCPU / 4 GiB configuration.
- E2B's public price while paused, a public maximum resource size, and public retention rules for its persistent volumes.
- Daytona's public retention duration for a paused VM sandbox and per-sandbox, rather than organization-pool, resource maximums.
