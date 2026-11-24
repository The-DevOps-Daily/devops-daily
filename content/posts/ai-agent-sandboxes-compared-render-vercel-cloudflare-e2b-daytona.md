---
title: 'AI Agent Sandboxes Compared: Render, Vercel, Cloudflare, E2B, Daytona and DigitalOcean'
excerpt: 'A sandbox for a one-shot code interpreter is not automatically a home for a coding agent. Compare limits, pause behavior, persistence, network controls, and list-price billing across Render, Vercel, Cloudflare, E2B, Daytona, and DigitalOcean Harness Runtime.'
category:
  name: 'Cloud'
  slug: 'cloud'
date: '2026-11-16'
publishedAt: '2026-11-16T15:00:00Z'
updatedAt: '2026-12-02T07:07:00Z'
readingTime: '18 min read'
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
  - DigitalOcean
---

A one-shot code interpreter can disappear the moment it has returned a result. A coding agent often cannot: it may hold a development server, wait for a human to review a diff, or return to the same repository tomorrow. That difference turns timeout semantics, snapshot contents, idle billing, and egress controls into architecture decisions.

This is a sandbox-only comparison of Render, Vercel, Cloudflare, E2B, Daytona, and DigitalOcean. If you are choosing a broader agent runtime with identity, memory, tool gateways, and an agent loop, start with [our managed-agent runtime comparison](/posts/managed-agent-runtimes-compared-2026). Here, the question is narrower: where should your agent's shell, files, and processes live?

:::note
**Updated 2 December 2026:** added DigitalOcean Harness Runtime (public preview) to every section, including a first run of a bare sandbox through `doctl`. DigitalOcean facts come from its public docs, pricing page, and launch post, checked on 24 November 2026. The other five providers were re-checked the same day.
:::

## TLDR

- **Short tool calls:** Cloudflare fits event-driven work when a Worker already owns the request. Its instance can stop after the work, but save files yourself before it does. [Cloudflare documents the lifecycle and snapshot boundary.](https://developers.cloudflare.com/sandbox/concepts/lifetime/)
- **Long-running coding agents:** Render is the clearest fit when a process must survive a human wait. It can disable both timeouts and its runtime snapshots retain memory and processes. [It is a public beta.](https://render.com/docs/sandboxes-creating)
- **Pause for review, then resume in place:** Daytona VM sandboxes and E2B can preserve memory and processes through a pause. Daytona charges disk while paused; E2B says a pause can preserve filesystem and memory. [Daytona billing](https://www.daytona.io/docs/billing) and [E2B security documentation](https://e2b.dev/security) describe those states. DigitalOcean's pause also [keeps processes, memory, and the workspace](https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/concepts/sessions/), and our first run showed a background process survive it.
- **Bursty agents that wait on models:** DigitalOcean bills CPU on [actual consumption, not allocation](https://www.digitalocean.com/pricing/harness-runtime), at the lowest per-vCPU list rate here. It is a public preview in one region (Richmond, `RIC1`), and it [only runs while you have funds or credits in a balance](https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/how-to/pay-for-harness-runtime/).
- **Cheapest idle:** E2B's [homepage](https://e2b.dev/) labels a paused sandbox as unbilled. Render stops CPU and memory charges when a sandbox is suspended, leaving snapshot storage at [\$0.08 per GB-month](https://render.com/pricing); Vercel bills its filesystem snapshot at the same rate, Daytona VM pauses bill reserved disk, and DigitalOcean bills retained snapshots and checkpoints at [\$0.05 per GiB-month](https://www.digitalocean.com/pricing/harness-runtime). All of these are cents for an overnight wait; plan fees matter more.

## Prerequisites

- A workload description: how long a task actively computes, how long it waits, and whether a running process must survive the wait.
- An account with the plan and regional availability needed by the provider you choose.
- A place to persist the work product outside the sandbox when deletion would be unacceptable.

## What we compared

The four dimensions in the table below are deliberately operational: how long the machine exists, what a pause means, what is billed, and what survives. “Not documented” means we could not find the detail in current official vendor material, not that the vendor necessarily lacks the feature.

| Provider                 | Runtime limits                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Suspend or resume                                                                                                                                                                                                                                                                                                                                                                                                                    | Pricing and idle state                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | What persists                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Render**               | Default runtime timeout [24 hours](https://render.com/docs/sandboxes-creating); set [60 seconds to 30 days](https://render.com/docs/sandboxes-creating) or `0` to disable. Default idle timeout [15 minutes](https://render.com/docs/sandboxes-creating). Up to [8 CPU, 16 GB RAM, 40 GB writable disk](https://render.com/docs/sandboxes-limits), [1,000 concurrent per group on Pro and above, 100 on Hobby](https://render.com/docs/sandboxes-limits).                                                                                                                                                                                                                                                                                                                                                                                                         | Idle suspension keeps the filesystem and can resume within [30 days](https://render.com/docs/sandboxes-creating). Runtime snapshots keep filesystem, memory, and CPU state; filesystem snapshots keep files only.                                                                                                                                                                                                                    | [Active CPU plus allocated memory](https://render.com/blog/introducing-render-sandboxes); suspended means snapshot-storage only. List rates: [\$0.12 per active CPU-hour plus \$0.038 per hour per 2 GB of memory (\$0.076/hour for 2c-4g), and \$0.08 per GB-month of snapshot storage](https://render.com/pricing).                                                                                                                                                                                                                                                                                 | Runtime snapshot preserves files, processes, and memory. Termination permanently deletes the filesystem unless exported or snapshotted. [Outbound policy can allow all, allow a domain list, or deny all.](https://render.com/blog/introducing-render-sandboxes)                                                                                                                                                                                          |
| **Vercel**               | Session default [5 minutes](https://vercel.com/kb/guide/vercel-sandbox-duration-and-persistence), maximum [45 minutes on Hobby and 24 hours on Pro and Enterprise](https://vercel.com/kb/guide/vercel-sandbox-duration-and-persistence). Up to [4, 8, or 32 vCPU by plan](https://vercel.com/sandbox), with [2 GB per vCPU](https://vercel.com/sandbox).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | There is no in-memory pause. Persistent sandboxes stop, snapshot the filesystem, then boot a new session on use.                                                                                                                                                                                                                                                                                                                     | [\$0.128 active CPU-hour and \$0.0212 GB-hour provisioned memory](https://vercel.com/docs/sandbox/pricing), plus [\$0.08 GB-month snapshot storage](https://vercel.com/docs/sandbox/pricing). CPU waiting on I/O is not billed, but memory is billed while the session runs.                                                                                                                                                                                                                                                                                                                          | Persistent is the default: filesystem and installed packages return, processes do not. A [Drive](https://vercel.com/kb/guide/vercel-sandbox-duration-and-persistence) can outlive a sandbox. A [sandbox firewall](https://vercel.com/docs/sandbox/concepts/firewall) can allow all, deny all, or apply a user-defined policy, changeable at runtime.                                                                                                      |
| **Cloudflare Sandboxes** | No guaranteed runtime duration. Inactivity can be set to [up to 6 hours](https://developers.cloudflare.com/sandbox/concepts/lifetime/); a platform event can stop an instance. Default per-instance maximum is [4 vCPU, 12 GiB, 20 GB](https://developers.cloudflare.com/containers/platform/limits/), raisable on request, and [custom instance types](https://developers.cloudflare.com/containers/platform/limits/#custom-instance-types) can set vCPU, memory, and disk directly.                                                                                                                                                                                                                                                                                                                                                                             | No pause. Stop ends memory, processes, and disk. A beta snapshot is filesystem-only and must be restored by your application.                                                                                                                                                                                                                                                                                                        | Containers bill per [10 ms while running](https://developers.cloudflare.com/containers/platform/pricing/): active CPU, provisioned memory, and disk. Workers Paid includes [375 vCPU-minutes, 25 GiB-hours, and 200 GB-hours monthly](https://developers.cloudflare.com/containers/platform/pricing/).                                                                                                                                                                                                                                                                                                | A Durable Object keeps its storage until code deletes it. Snapshots expire [30 days after creation or last restore](https://developers.cloudflare.com/sandbox/concepts/lifetime); mounted R2 objects outlive instances. Network egress pricing is [documented by region](https://developers.cloudflare.com/containers/platform/pricing/).                                                                                                                 |
| **E2B**                  | Hobby sessions up to [1 hour](https://e2b.dev/pricing); Pro up to [24 hours](https://e2b.dev/pricing). Hobby has [10 concurrent](https://e2b.dev/pricing); Pro has [100, expandable to 1,100](https://e2b.dev/pricing). Default size is [2 vCPU and 4 GiB](https://e2b.dev/pricing) on the pricing page, though the [billing docs](https://docs.e2b.dev/billing) give 512 MiB RAM as the default; Hobby tops out at 8 vCPU and 8 GiB, Pro at "8+".                                                                                                                                                                                                                                                                                                                                                                                                                | Pause can preserve filesystem and memory for resume.                                                                                                                                                                                                                                                                                                                                                                                 | E2B charges per second of a **running** sandbox: [2 vCPU is \$0.000028/s and 4 GiB is \$0.000018/s](https://e2b.dev/pricing). Pro has a [\$150/month base fee on top of usage](https://e2b.dev/pricing). Its [homepage](https://e2b.dev/) labels the paused state as unbilled.                                                                                                                                                                                                                                                                                                                        | E2B says [timeout or shutdown destroys sandboxes](https://e2b.dev/security); pause can preserve filesystem and memory. Retention and storage pricing for paused sandboxes: not documented in the sources reviewed.                                                                                                                                                                                                                                        |
| **Daytona**              | Default auto-stop is [15 minutes](https://www.daytona.io/docs/sandboxes); VM sandboxes default to [60-minute auto-pause](https://www.daytona.io/docs/sandboxes) if neither interval is set. Both can be disabled. Sandboxes default to [1 vCPU, 1 GB RAM, and 3 GiB disk](https://www.daytona.io/docs/sandboxes), with a per-sandbox maximum of 4 vCPUs, 8 GB RAM, and 10 GB disk; organization limits are on the [limits page](https://www.daytona.io/docs/limits).                                                                                                                                                                                                                                                                                                                                                                                              | VM `pause()` freezes running processes and retains memory. Containers do not support pause.                                                                                                                                                                                                                                                                                                                                          | Per-second resources: [\$0.0504/vCPU-hour, \$0.0162/GiB-hour, and \$0.000108/GiB-hour storage after the first 5 GiB](https://www.daytona.io/). Paused and stopped VM sandboxes bill disk only.                                                                                                                                                                                                                                                                                                                                                                                                        | VM pause preserves memory and filesystem; stop clears memory. Containers can archive filesystem to object storage. [TTL and auto-delete can remove a sandbox.](https://www.daytona.io/docs/sandboxes)                                                                                                                                                                                                                                                     |
| **DigitalOcean**         | No published maximum session length; each session has a [744-hour monthly active compute cap](https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/details/limits/). Idle pause after [15 minutes by default](https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/details/limits/), changed with `idle_timeout` or turned off with [`keep_warm`](https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/reference/environment-spec/#keep_warm). Sizes from 1 vCPU and 1 GB up to [16 vCPU, 32 GB, and 500 GB](https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/details/features/#sandbox-sizes); [up to 100 concurrent sessions per team](https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/details/limits/), depending on account tier. | Pause freezes the microVM: [processes, memory, and the workspace filesystem are preserved](https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/concepts/sessions/). An `exec`, new input, or a port-forward resumes it. [Checkpoints capture the whole machine](https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/how-to/checkpoint-fork-rollback-sessions/) for fork or rollback. | [\$0.044 per vCPU-hour of CPU actually consumed and \$0.0095 per GB-hour of allocated memory](https://www.digitalocean.com/pricing/harness-runtime), billed per second; a paused session has no compute charge. Snapshots and checkpoints [\$0.05 per GiB-month](https://www.digitalocean.com/pricing/harness-runtime), egress [\$0.01 per GiB](https://www.digitalocean.com/pricing/harness-runtime). No plan minimum, but sessions [need funds in a prepaid, credit, or plan balance](https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/how-to/pay-for-harness-runtime/). | Pause keeps files, processes, and memory; removing a session ends its sandbox. [Persistent workspaces](https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/how-to/use-persistent-workspaces/) (public preview, free during the preview) keep `/workspace` after removal. Egress is [unrestricted unless the spec sets an allowlist](https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/details/limits/). |

First checked against official docs on 2026-11-11, re-checked and DigitalOcean added on 2026-11-24; prices in USD, list prices.

All six expose a programmatic sandbox, but their isolation differs where documented: Render and Vercel use [Firecracker microVMs](https://render.com/blog/introducing-render-sandboxes) and [Firecracker microVMs](https://vercel.com/docs/sandbox) respectively, E2B uses a [Firecracker microVM with its own kernel](https://e2b.dev/security), DigitalOcean runs [each session in a dedicated Firecracker microVM](https://www.digitalocean.com/blog/managed-agents-public-preview), and Cloudflare describes a container instance as a Linux VM. [Daytona publishes container, Linux VM, Windows, and GPU sandbox classes.](https://www.daytona.io/docs/sandboxes) Daytona also lists [macOS sandboxes, with OS pricing of $0.0082 per core-hour](https://www.daytona.io/pricing) on top of compute. SDK coverage differs too: Render and Vercel document TypeScript and Python SDKs, and Daytona documents [Python, TypeScript, Ruby, Go, and Java](https://www.daytona.io/docs/sandboxes). DigitalOcean covers Harness Runtime in `doctl`, the REST API, and its [PyDo, Godo, and DoTs client libraries](https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/reference/sdk/) (Python, Go, TypeScript). Render is [Oregon-only](https://render.com/docs/sandboxes-limits) during the beta, DigitalOcean is [`RIC1`-only](https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/details/availability/) during its preview, Daytona documents `us` and `eu` targets, and Vercel lists its sandbox regions on its [pricing page](https://vercel.com/docs/sandbox/pricing).

## Render: a runtime snapshot is a real checkpoint

Render Sandboxes entered [public beta on November 4, 2026](https://render.com/blog/introducing-render-sandboxes), which is the newest official status even though older pages may describe early access. The distinction that matters is its two snapshot kinds. A runtime snapshot captures writable files, memory, and CPU state, so a restored sandbox resumes running processes. A filesystem snapshot captures files and installed tools but not a process. [A runtime snapshot must restore to the same compute plan.](https://render.com/docs/sandboxes-snapshots)

That makes Render unusually direct for a coding agent waiting on a reviewer: its default 15-minute idle timer snapshots and suspends, a command or file transfer resumes it, and background processes do **not** count as activity. [Render defines idle as no command execution or file transfer.](https://render.com/docs/sandboxes-creating) If a test run is working only inside the sandbox, either keep an external interaction alive or disable idle suspension. A runtime timeout also resets after a suspend and resume.

There are beta gaps to plan for. Sandboxes do not yet have private networking to other Render services or public URLs, and credential brokering is not generally available. [Those are listed as beta limitations.](https://render.com/docs/sandboxes)

## Vercel: persistence is filesystem persistence

Vercel separates a long-lived named sandbox from the VM session inside it. When a persistent sandbox stops, it snapshots the filesystem, and the next operation boots a new session from that snapshot. [The default is persistent.](https://vercel.com/kb/guide/vercel-sandbox-duration-and-persistence) It is convenient for a workspace that needs `node_modules`, source edits, and configuration to return. It is not a pause: a development server, process memory, open terminal, and connection state are gone.

Vercel's [sandbox firewall](https://vercel.com/docs/sandbox/concepts/firewall) can switch from allow-all to deny-all or a user-defined policy at runtime without restarting the process, and it can broker credentials so secrets never enter the sandbox. For cost work, do not treat active CPU as the whole bill. Vercel excludes I/O wait from CPU metering, but provisioned memory is still measured for the time the session is running. [Its own example explains both meters.](https://vercel.com/docs/sandbox/pricing)

## Cloudflare: an instance is not the durable object

Cloudflare's design is useful when the agent's durable control plane is a Worker and Durable Object, and a Linux machine is an attached execution unit. The Durable Object can retain a session record or snapshot identifier after the instance stops, but the instance's files, memory, and processes do not survive that stop. [Cloudflare documents this split explicitly.](https://developers.cloudflare.com/sandbox/concepts/lifetime/)

The sharp edge is activity. A Worker request, stream, WebSocket, or alarm can keep the Durable Object active. Work running only _inside_ the instance does not. So a build can receive `SIGTERM` when the inactivity timer ends even while it is still working. [Use an alarm that checks work more frequently than the inactivity timeout, or arrange for the process to finish before the timeout.](https://developers.cloudflare.com/sandbox/concepts/lifetime/)

Snapshot when files matter, and restart the process after restore. Cloudflare says snapshots are public beta, filesystem-only, application-managed, and not restored automatically. Mounted R2 is the better fit for files that must outlive a workspace or be shared.

## E2B: pause holds the machine state

E2B is a direct microVM sandbox service. Its official security material says each sandbox has its own Firecracker microVM and that filesystem and memory state can be preserved through pause and resume. [That is the capability a human-review workflow needs.](https://e2b.dev/security) Its pricing page bills a running sandbox per second, rather than publishing separate active-CPU and provisioned-memory notions.

The important plan boundary is time: the free Hobby tier allows sessions up to one hour, while Pro allows up to 24 hours and costs a $150 monthly base fee plus usage. The session limit is a continuous-runtime limit, and pausing resets it. E2B's Enterprise offering is where it advertises multi-day and persistent sessions. [Those are plan statements on the pricing page.](https://e2b.dev/pricing)

E2B's homepage marks the paused state as unbilled, which makes it a cheap place for a sandbox to wait. E2B now documents that [a paused sandbox is kept indefinitely, with no automatic deletion](https://docs.e2b.dev/sandbox/persistence). What it still does not publish is a storage price for paused sandboxes, so ask before you build a long review queue on them.

## Daytona: choose VM if you mean pause

Daytona has more lifecycle states than the others, and the sandbox class changes what each state means. A Linux VM sandbox can pause, freezing processes and retaining memory. A container sandbox cannot pause, but can stop and later archive its filesystem. [The lifecycle documentation distinguishes the two.](https://www.daytona.io/docs/sandboxes)

The default timer is another operational trap. Daytona's auto-stop fires after 15 minutes of no qualifying events, and an internal long-running process does not count. VM-capable sandboxes instead default to a 60-minute auto-pause when neither timer is supplied. [Daytona calls out this exact failure mode in troubleshooting.](https://www.daytona.io/docs/en/troubleshooting/) Have the controller call `refreshActivity()` or configure the lifecycle deliberately.

Paused VM state is not billed for CPU or RAM, but it is billed for reserved disk. That makes Daytona a strong review-pause option, not automatically the cheapest idle option. Use archive for a container filesystem that can tolerate a cold return; archived containers stop billing, while snapshots remain billed storage. [Daytona's billing table is explicit on each state.](https://www.daytona.io/docs/billing) Stopped, paused, and archived sandboxes are [kept until you delete them](https://www.daytona.io/docs/en/persistence), with auto-delete off by default, so clean up or set a TTL.

## DigitalOcean: a full pause, with CPU billed on use

DigitalOcean's sandbox is **Harness Runtime**, one half of [Managed Agents](https://www.digitalocean.com/blog/managed-agents-public-preview), in public preview since September 2026. Each session gets its own Firecracker microVM, and DigitalOcean's docs say [isolation is enforced by the hypervisor rather than by container namespaces](https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/concepts/architecture/). A session can run a coding agent or framework, or nothing at all: the `harness` field picks [Codex CLI, Claude Code, OpenCode, Hermes, LangGraph, CrewAI, OpenHands, a custom image, or `none`](https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/concepts/agent-adapters/). With `none` you get a bare sandbox that you drive with `exec`, `upload`, `download`, and `port-forward`, which is the shape the other five providers sell. We covered the agent side in [our issue-to-pull-request build on Managed Agents](/posts/issue-to-pull-request-digitalocean-managed-agents); this section is about the sandbox.

**Lifecycle.** Pause is a real freeze. The sessions page says [processes, memory, and the workspace filesystem are all preserved](https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/concepts/sessions/), and compute charges stop. On top of that, a **checkpoint** captures the whole machine, files and live memory, so you can [fork it into parallel copies or roll the session back in place](https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/how-to/checkpoint-fork-rollback-sessions/). Fork and rollback need the Environment Config that `create` saves for you.

The idle timer has the same trap as Render and Daytona. A bare sandbox pauses after 15 minutes without an `exec` call or a port-forward, and [a paused sandbox runs nothing, including a command you started in the background](https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/how-to/run-sandbox/). For a long build, set `keep_warm: true` or a longer `idle_timeout`, or poll it. Agent sessions never auto-pause in the middle of a run.

**Persistent workspaces** are a separate public preview, free while it lasts. A workspace of 1 to 100 GiB mounts at `/workspace` and is saved when you remove the session or take a checkpoint. Read the limits before you rely on it: [pausing does not save the workspace, and fork and rollback are not available on a session that has one](https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/details/limits/#persistent-workspaces).

**Preview URLs.** There are none. The limits page says [live preview of a running app is not available](https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/details/limits/). Instead, `doctl harness-runtime port-forward` opens a local listener and tunnels it into the sandbox over an authenticated WebSocket. [Nothing is published to the internet, and the tunnel cannot be shared with an unauthenticated user](https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/how-to/forward-ports/). That is a safe default for an agent's dev server, but if a reviewer needs a link, you have to build the proxy yourself.

**Custom images.** Bring-your-own-template takes a `linux/amd64` OCI image from your DigitalOcean Container Registry, and DigitalOcean [rebases it onto a base template](https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/how-to/use-custom-template/) such as `claude-code-base` or `codex-base`. Your image adds tools and dependencies; it does not replace the agent, and the agent runs as UID `10001`. Stored templates cost [\$0.05 per GiB-month](https://www.digitalocean.com/pricing/harness-runtime).

**Billing.** CPU is billed on actual consumption, memory on allocation, per second. DigitalOcean's own example: [two vCPUs averaging 25% for an hour with a 4 GB memory peak cost \$0.060, against \$0.126 for the full allocation](https://www.digitalocean.com/blog/managed-agents-public-preview). There is no plan minimum, but Harness Runtime [needs funds in at least one balance](https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/how-to/pay-for-harness-runtime/) (prepaid, promotional credit, or plan), and there is no per-session spend limit. Sessions pause when every balance is empty. The optional Agent Droplets plans (\$50 and \$200 a month) discount eligible usage by 15% and 20% until the month's subscription balance runs out, then usage bills at standard rates; [our Agent Droplets break-even post](/posts/digitalocean-agent-droplets-when-the-plan-pays-off) works out when they pay off.

**What DigitalOcean says about speed.** Its launch post reports, from [its own benchmark of 21 September 2026](https://www.digitalocean.com/blog/managed-agents-public-preview), that a session becomes ready in 886 ms and resumes to readiness in 305 ms. Those are DigitalOcean's numbers. We did not time the preview, and nothing in this post is a benchmark of it.

**Limits to plan around.** One region (`RIC1`). [No VPC access or VPC peering, and no webhook notifications for run events](https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/details/limits/). Paused sessions still count toward the concurrent-session limit; only removing a session frees the slot.

### First run: a bare sandbox through doctl

We ran the [bare-sandbox how-to](https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/how-to/run-sandbox/) end to end on the smallest size with `doctl` 2.8.0. The spec is four lines:

```yaml
name: dd-sandbox-115
harness: none
size: mars-1vcpu-1gb
idle_timeout: 10m
```

One gotcha first: the older `doctl` 1.175.0 we had installed rejected this spec with `flat manifest requires top-level "agent"`. Upgrade `doctl` before you try `harness: none`.

```terminal
{
  "title": "harness-runtime, bare sandbox",
  "prompt": "$",
  "steps": [
    {
      "cmd": "doctl harness-runtime create --spec sandbox.yaml",
      "output": "Creating sandbox session\n• Validating configuration…\n✓ Session created · dd-sandbox-115\n✓ Sandbox is ready"
    },
    {
      "cmd": "doctl harness-runtime exec dd-sandbox-115 -- sh -c 'whoami; pwd; . /etc/os-release; echo $PRETTY_NAME'",
      "output": "root\n/workspace\nUbuntu 24.04.5 LTS"
    },
    {
      "comment": "move a file in, process it, take the result out"
    },
    {
      "cmd": "doctl harness-runtime upload dd-sandbox-115 --local-file ./input.csv --workspace-path input.csv",
      "output": "Upload complete\n  Path     input.csv\n  Bytes    40"
    },
    {
      "cmd": "doctl harness-runtime exec dd-sandbox-115 -- python3 -c \"import csv,json; …; print('wrote report.json')\"",
      "output": "wrote report.json"
    },
    {
      "cmd": "doctl harness-runtime download dd-sandbox-115 --workspace-path report.json --save-to ./report.json",
      "output": "✓ Downloaded 24 bytes to ./report.json"
    },
    {
      "comment": "a background python3 -c loop holds a random token in memory and writes a counter every second"
    },
    {
      "cmd": "doctl harness-runtime exec dd-sandbox-115 -- sh -c 'pgrep -af \"python3 -c\"; cat /workspace/counter.txt'",
      "output": "535 python3 -c  import time,os secret=os.urandom(4).hex() …\n7 c5790fa6"
    },
    {
      "cmd": "doctl harness-runtime pause dd-sandbox-115",
      "output": "✓ Session 01a20d3e-… paused"
    },
    {
      "comment": "wait about a minute, then resume"
    },
    {
      "cmd": "doctl harness-runtime resume dd-sandbox-115",
      "output": "✓ Session 01a20d3e-… resumed"
    },
    {
      "cmd": "doctl harness-runtime exec dd-sandbox-115 -- sh -c 'pgrep -af \"python3 -c\"; cat /workspace/counter.txt'",
      "output": "535 python3 -c  import time,os secret=os.urandom(4).hex() …\n14 c5790fa6"
    },
    {
      "comment": "a server in the sandbox, reached through a local tunnel"
    },
    {
      "cmd": "doctl harness-runtime port-forward dd-sandbox-115 18080:8080 &",
      "output": "Forwarding 127.0.0.1:18080 -> port 8080 in session 01a20d3e-…\nReady. Press Ctrl-C to stop."
    },
    {
      "cmd": "curl -s http://127.0.0.1:18080/index.html",
      "output": "hello from the sandbox"
    },
    {
      "comment": "clean up: the session, then the Environment Config that create saved"
    },
    {
      "cmd": "doctl harness-runtime remove dd-sandbox-115",
      "output": "✓ Session 01a20d3e-… removed"
    },
    {
      "cmd": "doctl harness-runtime config delete 01a20d3e-bd12-…",
      "output": "✓ Deleted agent config 01a20d3e-bd12-…"
    }
  ]
}
```

Output is trimmed where you see `…`, and the two `python3 -c` scripts are shortened. What the run showed:

- **Commands run as root in `/workspace`** on Ubuntu 24.04 with Python 3.12, Git, and `gh`, as documented. The image had Node.js 24, where the how-to says Node.js 20, so check versions in your own template rather than trusting the page.
- **Upload, exec, and download** succeeded. Each `exec` is a separate call, so working directory and shell state do not carry over.
- **Pause kept the process.** After a manual pause, a wait of about a minute, and a resume, the background process had the same PID and the same random token it generated at start, so it was the same process with the same memory, not a restart. Its one-second counter had not counted the paused minute.
- **Port forwarding** worked: a `python3 -m http.server` started in the sandbox answered on `127.0.0.1` through `doctl harness-runtime port-forward`.
- **Checkpoint and rollback** worked too. A file written after the checkpoint was gone after `rollback`, and the background processes came back with it.
- **Cleanup takes two steps.** `remove` deletes the session, but the Environment Config that `create` saved stays until you delete it, as [the how-to warns](https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/how-to/run-sandbox/). We also deleted the checkpoint before removing the session.

The whole run took under ten minutes on the 1 vCPU and 1 GB size, which is under one cent at list price.

## Worked cost: 40 active minutes, then an 8-hour review

Assume the agent actively uses both vCPUs for 30 minutes, pauses or stops for 8 hours, then uses both vCPUs for 10 more minutes. The arithmetic below excludes network, creation, and storage retained beyond the stated resources. It also assumes no included allowance or account credit.

- **Render: $0.21 plus snapshot storage.** `(2 vCPU x 2/3 h x $0.12) + (2/3 h x $0.076 memory for 2c-4g) = $0.2107`. The 8-hour suspended period has no CPU or memory charge; snapshot storage is $0.08 per GB-month, so a 10 GB snapshot held for 8 hours adds under one cent.
- **Vercel: $0.23 plus snapshot storage and one creation event.** `(2 x 2/3 x $0.128) + (4 x 2/3 x $0.0212) = $0.2272`. Stop, then let persistence restore the filesystem for the second session. Its 8-hour stored snapshot is charged by size at [$0.08/GB-month](https://vercel.com/docs/sandbox/pricing), under one cent for 10 GB over 8 hours.
- **Cloudflare: $0.12 plus disk, with a custom instance type.** `(2 x 2,400 s x $0.000020) + (4 x 2,400 s x $0.0000025) = $0.12`. Cloudflare's predefined 2-vCPU type has 8 GiB, but [custom instance types](https://developers.cloudflare.com/containers/platform/limits/#custom-instance-types) can be sized at 2 vCPU and 4 GiB. CPU [bills on active usage, memory and disk on what is provisioned](https://developers.cloudflare.com/containers/platform/pricing/), and the instance is assumed stopped during the wait. A saved workspace also needs a separately sized snapshot or R2 object.
- **E2B: $0.1104 in running compute, plus the Pro base fee.** `2,400 seconds x ($0.000028 + $0.000018) = $0.1104`; E2B labels the 8-hour pause as unbilled. We assume Pro because the workflow spans more than Hobby's one-hour session limit; E2B says [pausing and resuming resets the continuous runtime limit](https://docs.e2b.dev/sandbox/persistence).
- **Daytona: $0.1104 for CPU and RAM, plus disk during all 8 hours and 40 minutes.** `(2 x 2/3 x $0.0504) + (4 x 2/3 x $0.0162) = $0.1104`. The result cannot include disk without choosing a disk size. The first 5 GiB are free, then the published disk rate applies.
- **DigitalOcean: $0.0840 for CPU and memory, plus storage.** `(2 x 2/3 x $0.044) + (4 x 2/3 x $0.0095) = $0.0840`, which is the default `mars-2vcpu-4gb` size. The 8-hour pause has no compute charge; session and snapshot storage bill at [\$0.05 per GiB-month](https://www.digitalocean.com/pricing/harness-runtime), under one cent for 10 GB over 8 hours. Because CPU bills on use, an agent that spends part of those 40 minutes waiting on a model costs less than this.

```chart
{
  "type": "bar",
  "title": "Known compute cost for the review-pause scenario",
  "unit": "$",
  "caption": "40 active minutes at 2 vCPU and 4 GiB (4 GB at DigitalOcean), then 8 hours paused or stopped. Values exclude snapshot and disk storage, which depend on size (under one cent per 10 GB for 8 hours at Render and Vercel). Render and DigitalOcean assume both vCPUs are fully active. E2B excludes its $150/month Pro base fee. Official list prices checked November 24, 2026.",
  "rows": [
    { "label": "DigitalOcean CPU + memory", "value": 0.084, "series": "known compute" },
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

The chart is not a lowest-price ranking. It is a warning that idle semantics move cost between CPU, memory, snapshot storage, disk storage, and plan fees. A model call that waits for a response can be cheap in active-CPU systems, while a running session with provisioned memory continues to accrue memory cost.

## The smallest useful SDK shape

The following calls follow current official examples. They are deliberately lifecycle examples, not a production authorization model. Cloudflare and E2B are omitted because their current examples require application-specific Durable Object setup, or because we could not verify a current TypeScript pause call without relying on a beta SDK reference. DigitalOcean is shown with `doctl`, the path we ran. Its [DoTs TypeScript client](https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/reference/dots/) gained a hand-written `HarnessRuntime` layer in version 1.25.0 (18 November 2026), which we have not tested yet.

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
      "code": "import { Daytona } from '@daytona/sdk';\n\nconst daytona = new Daytona();\n// SDK 2.x exposes the sandbox API as daytona.v0\nconst sandbox = await daytona.v0.create({\n  snapshot: 'daytona-vm-medium',\n  autoStopInterval: 0,\n});\n\nconst result = await sandbox.process.executeCommand('echo hello');\nconsole.log(result.result);\n\n// VM sandboxes preserve memory and running processes on pause.\nawait sandbox.pause();"
    },
    {
      "label": "DigitalOcean",
      "lang": "bash",
      "code": "# sandbox.yaml: name: my-sandbox, harness: none\ndoctl harness-runtime create --spec sandbox.yaml\ndoctl harness-runtime exec my-sandbox -- echo hello\n\n# Pause keeps processes and memory; exec or resume wakes it.\ndoctl harness-runtime pause my-sandbox\ndoctl harness-runtime remove my-sandbox"
    }
  ]
}
```

## How to pick

Choose **Render** if preserving a process through an idle wait is the defining requirement, and the beta status plus Oregon placement are acceptable. Choose **Vercel** if you need a named workspace whose filesystem resumes cleanly, and a restarted process is fine. Choose **Cloudflare** when the Worker and Durable Object are your durable agent control plane, with the sandbox treated as replaceable compute. Choose **E2B** when you want a focused microVM service with pause and resume, but price the Pro base fee and the storage behind long pauses. Choose **Daytona VM sandboxes** when a true pause matters and disk-only pause billing fits the workload. Choose **DigitalOcean** when you want a full pause, checkpoints you can fork, and CPU billed only while it is used, and a public preview in one US region that runs on prepaid funds or credits is acceptable. It also ships managed adapters for Claude Code, Codex CLI, and OpenCode, so the same sandbox can run the agent under permission policies and approvals, not only your own commands.

Do not use an auto-stop default as job completion. For every option, persist a task checkpoint outside process memory before a timeout, a stop, or a platform event. If an agent can reach a production system, also constrain egress and give it a narrowly scoped identity. [Our guide to agent prompt-injection controls](/posts/prompt-injection-ops-agent-measured) explains why that boundary belongs outside the model prompt.

## What we could not confirm

- A Render retention time for an automatically suspended sandbox beyond the stated 30-day resumability period.
- A Vercel in-memory pause (its persistence is filesystem-only).
- A Cloudflare fixed maximum instance lifetime.
- E2B's storage price for paused sandboxes, and a Pro per-sandbox maximum beyond "8+" vCPU and memory.
- DigitalOcean's retention period for a paused session, and a maximum session lifetime beyond the 744-hour monthly active compute cap.
- How DigitalOcean sizes a checkpoint or pause snapshot for storage billing (the pricing page bills "storage retained").
- An E2B-compatible API. DigitalOcean's [May 2026 Deploy post](https://www.digitalocean.com/blog/powering-the-inference-era) calls its Managed Sandboxes "E2B-compatible", but the current Harness Runtime docs do not document one.
