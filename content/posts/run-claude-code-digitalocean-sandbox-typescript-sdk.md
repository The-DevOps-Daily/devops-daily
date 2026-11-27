---
title: 'Run Claude Code in a DigitalOcean Sandbox from TypeScript, Then Check Its Work'
excerpt: 'A step-by-step build with the DoTs SDK: create a Harness Runtime session, clone a repo, let Claude Code fix a real bug, verify the fix in a second sandbox, open the app through a port-forward, and clean up so the model key dies too. With the four runs that broke first and what each one taught us.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-12-01'
publishedAt: '2026-12-01T15:00:00Z'
updatedAt: '2026-12-01T15:00:00Z'
readingTime: '18 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - DevOps
  - DigitalOcean
  - AI Agents
  - AI
  - TypeScript
  - Sandboxes
  - Security
---

Claude Code fixed a real bug inside a DigitalOcean microVM, and the whole thing was driven from a handful of small TypeScript scripts on the [DoTs SDK](https://www.npmjs.com/package/@digitalocean/dots) 1.28.0. No Anthropic key was involved: the model was Claude Haiku 5.5 served by DigitalOcean, through a model key the API minted for that one session. We did not take the agent's word that the fix worked. A second, fresh sandbox ran the agent's file against 220 inputs and our own reference answers, and all 220 matched. Then the app answered through a port-forward, and the cleanup script proved the session, its saved config and its model key were gone.

That was the fifth Claude Code session. The first two broke in ways the docs do not warn you about, and the next two worked but had approval and verify code that a security review took apart. Those failures are the useful part of this post. The `name` you pass to `sessions.create` is ignored. Files you clone with `exec` belong to root, and Claude Code runs as a different user, so every edit fails. The model key the agent holds still authenticated from our machine after the session was destroyed. And the cost the SDK reports for each run matched Opus 5.5 list prices, about 36 times what Haiku 5.5 tokens cost, though every usage event said Haiku.

Everything here is in a public repo, including the runs that failed:

```github
The-DevOps-Daily/do-sandbox-coding-agent
```

:::note
Harness Runtime is a **public preview**, and its preview terms do not allow publishing benchmarks. So this post has no speed or latency numbers of our own. It reports what worked, what broke, and what the API says each run cost.
:::

## TLDR

- `@digitalocean/dots/harness-runtime` covers the whole loop: `sessions.create`, `session.run` with streamed text and approval callbacks, `exec`, `spawn`, `files`, `portForward` and `destroy`.
- Put `name:` in the manifest. The `name` option of `sessions.create({ manifest, name })` is ignored, and so is the `?name=` query on the API.
- `exec` runs as root and Claude Code runs as user `agent` (uid 10001). Hand the agent only the folder it should edit.
- The managed model key is a plain environment variable in the sandbox. It worked from outside the sandbox, and it kept working after the session was destroyed, until the saved config was deleted too.
- Verify outside the agent's reach. Our verdict comes from a second sandbox and our own reference answers, not from tests that run next to the agent's code.
- There is no per-session spend limit on Harness Runtime. Cap spend with a dedicated prepaid balance, a model key with a spend threshold, or a provider key from a workspace with a spend limit, and keep `idle_timeout` short.

## Prerequisites

- A DigitalOcean account with funds or credits in a balance ([referral link](https://m.do.co/c/2a9bba940f39); new accounts get a sign-up credit as described in DigitalOcean's docs). Harness Runtime [only runs while a balance has funds](https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/how-to/pay-for-harness-runtime/).
- A **full-access** personal access token. The [public token scope list](https://docs.digitalocean.com/reference/api/scopes/) has no Harness Runtime scope, and a custom-scoped token we tried got `403` on the Harness Runtime endpoints.
- Node 20 or later (we used Node 24) and npm.
- About 20 minutes. The SDK reported $0.14 to $0.25 per agent run here (see [What the run cost](#what-the-run-cost)); the sandbox itself cost cents.

## How the pieces fit

The demo is six small scripts. Each one writes its result to `runs/<run id>/`, and the next reads it, so you can re-run one stage without starting over.

```diagram
{
  "type": "graph",
  "columns": [
    [{ "id": "you", "label": "Your machine", "sub": "6 TypeScript stages", "icon": "cpu", "tone": "slate" }],
    [
      { "id": "api", "label": "Harness Runtime API", "sub": "RIC1", "icon": "cloud", "tone": "blue", "detail": "Creates sessions, mints the session's model key, streams events, runs exec and port-forward." }
    ],
    [
      { "id": "agent", "label": "Agent sandbox", "sub": "Claude Code, mars-2vcpu-4gb", "icon": "box", "tone": "violet", "detail": "Clones the repo, fixes fixture/src/format.js. Egress allowlist: github.com plus platform hosts." },
      { "id": "checker", "label": "Checker sandbox", "sub": "harness: none, 1 vCPU", "icon": "shield", "tone": "green", "detail": "Fresh clone at the original commit plus the agent's one file. Prints answers; asserts nothing." }
    ],
    [
      { "id": "infer", "label": "DO inference", "sub": "Claude Haiku 5.5", "icon": "activity", "tone": "amber" },
      { "id": "gh", "label": "github.com", "sub": "clone only, no token", "icon": "branch", "tone": "slate" }
    ]
  ],
  "edges": [
    ["you", "api", "SDK calls"],
    ["api", "agent", "create, run, exec"],
    ["api", "checker", "create, exec"],
    ["agent", "infer", "managed key"],
    ["agent", "gh", "git clone"],
    ["checker", "gh", "git clone"]
  ]
}
```

## Step 1: describe the session

A session starts from a manifest, the same YAML that `doctl` takes. This is the one the demo uses, from the [environment spec reference](https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/reference/environment-spec/):

```yaml
harness: claude-code
size: mars-2vcpu-4gb
# Pause after 10 idle minutes instead of the default 15, in case a script dies.
idle_timeout: 10m
labels:
  app: do-sandbox-coding-agent
env:
  HARNESS_INFERENCE_MODEL: anthropic-claude-5.5-haiku
# Naming any host turns the allowlist on. The platform adds its own hosts,
# the adapter's hosts and the inference endpoint.
egress:
  - github.com
permissions:
  default: ask
  rules:
    - tool: file.read
      action: allow
    - tool: file.write
      action: allow
    - tool: bash
      action: ask
    - tool: bash
      match: { command: 'git push*' }
      action: deny
```

Four choices matter:

- **The model comes from DigitalOcean.** `HARNESS_INFERENCE_MODEL` names a model from the [Serverless Inference catalog](https://docs.digitalocean.com/products/inference/details/models/). There is no `HARNESS_INFERENCE_API_KEY` under `secrets`, so the SDK asks the API to mint a model key for this session. The adapter starts Claude Code with `--model anthropic-claude-5.5-haiku`; we checked its command line inside the sandbox.
- **Egress is an allowlist.** Without an `egress` field, the sandbox can reach anything. With one host named, everything else is denied, and the platform merges in what the session needs to run.
- **Every shell command asks.** File reads and writes are allowed, and the script answers each `bash` request (Step 4).
- **`idle_timeout`** pauses a session that nobody is using, so compute billing stops if your script dies after a run. It does not stop a run that is still going: cancel or destroy does that.

## Step 2: create the session

```bash
npm i @digitalocean/dots@1.28.0 ws@8.23.0
export DIGITALOCEAN_ACCESS_TOKEN=...   # from a secrets manager, not typed into argv
```

```typescript
import { readFileSync } from 'node:fs';
import WebSocket from 'ws';
import { HarnessRuntime } from '@digitalocean/dots/harness-runtime';

// Node's built-in WebSocket cannot send an Authorization header; port-forward needs `ws`.
const hr = new HarnessRuntime({
  webSocketFactory: (url, headers) => new WebSocket(url, { headers }) as never,
});

const name = `dd-sandbox-agent-${Math.random().toString(36).slice(2, 10)}`;
// The API ignores the `name` option for a manifest create, so the name goes in the manifest.
const manifest = `name: ${name}\n` + readFileSync('agent.yaml', 'utf8');

// Polls every 2 s until READY. A session that fails is destroyed before this throws.
const session = await hr.sessions.create({ manifest });
console.log(session.id, session.info.configId);
```

Our first session came back as `session-claude-code-20261127-180748` although we passed `name`. A raw `POST /v2/harness-runtime/sessions?name=...` with a YAML body ignored the name too. That matters more than it looks: the cleanup sweep finds leftovers by name prefix, and a made-up name hides them. Keep the `configId` as well. The API saved your manifest as a config for this session, and you will need to delete it (Step 7).

## Step 3: clone the repository, and give the agent the files

`repos:` in the manifest [does not clone anything](https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/examples/refactor-a-repository/), so the script clones with `exec`. The sandbox is Ubuntu 24.04 with 2 vCPUs, 3,939 MB of memory, Node 24.22.1, git 2.43.0 and Claude Code 2.1.330.

```typescript
await session.exec(['git', 'clone', '--depth', '1', REPO_URL, 'repo'], { cwd: '/workspace' });
// exec runs as root; Claude Code runs as `agent`. Hand over only the folder it should edit.
await session.exec(['chown', '-R', 'agent:agent', '/workspace/repo/fixture/src']);
const baseline = await session.exec(['runuser', '-u', 'agent', '--', 'node', '--test'], {
  cwd: '/workspace/repo/fixture',
});
```

The chown line exists because our second session failed without it. Claude Code read the code, found both bugs, and then every edit failed with `EACCES: permission denied` on a temp file in `src/`. Its final answer said so, and asked us to make the folder writable instead of working around it with `chmod` or `sudo`. That is the behavior you want, but it took a probe to find the cause: `ps` showed `claude` running as `agent`, and `stat` showed the clone owned by root.

Only `fixture/src` goes to the agent's user. `.git` and the tests stay root-owned, so the agent cannot plant git hooks or config there, or edit the tests it is graded against.

The fixture is a small HTTP service with a `formatBytes` function and six tests. Three fail: `1024` prints as `1024 B` instead of `1.0 KiB`, and `1048575` prints as `1024.0 KiB` instead of `1.0 MiB`.

## Step 4: run Claude Code and answer its approvals

```typescript
const result = await session.run(PROMPT, {
  timeoutMs: 15 * 60_000, // stops the wait, not the run: cancel or destroy stops the run
  onText: (text) => process.stdout.write(text),
  onEvent: (event) => log(event),
  onApproval: async (req) => {
    const command = commandIn(req.details); // abbreviated: see 03-agent.ts
    const { approve, reason } = decide(command); // lib/approve.ts
    if (approve) await req.approve();
    else
      await req.reject(
        `${reason}. Allowed: node --test <file>, ls, cat, grep with absolute paths.`
      );
  },
});
console.log(result.status, result.usage); // tokens in, tokens out, cost in micro-USD
```

`decide()` is an allowlist with about a dozen rules. It approves `node --test` with test files under `/workspace/repo/fixture/test`, and `ls`, `cat`, `head`, `tail`, `wc`, `grep` and `pwd`, all with absolute paths under `/workspace/repo`, alone or joined with `&&`. A trailing `2>&1` is the one redirect it accepts. It rejects everything else: `cd`, relative paths, pipes, other redirects, globs, `$(...)`, control characters (tab aside), and every other program. The repo has 43 tests for it, including `sh -c`, `git -c ... push` and a newline that smuggles a second command.

It took three tries to get here, and each one is in the repo:

1. **A denylist** (no `curl`, no `git push`, in the repo's first commit) looked fine until a review listed the bypasses: `/usr/bin/curl`, `sh -c`, `python3 -c`.
2. **An allowlist with `cd`** rejected bare `node --test`. The approval request carries no working directory, while Claude Code's shell keeps the directory of an earlier `cd`. Tracking `cd` in the script fixed that, but a review pointed out that the two can drift apart.
3. **Absolute paths only.** The prompt tells the agent the exact test command, and the rules never depend on a working directory.

In the measured run, Claude Code asked twice, both times for the exact test command, and both were approved:

```terminal
{
  "title": "npx tsx 03-agent.ts",
  "prompt": "$",
  "steps": [
    { "cmd": "npx tsx 03-agent.ts", "output": "[approval] Bash: node --test /workspace/repo/fixture/test/format.test.js -> approve\n[approval] Bash: node --test /workspace/repo/fixture/test/format.test.js -> approve\nAll six tests pass when I run `node --test /workspace/repo/fixture/test/format.test.js`.\n\nThe bug was the unit-promotion loop in `fixture/src/format.js`. It promoted only when `value > 1024`, so an exact 1024 never moved up. [...] I changed only `src/format.js` and nothing under `test/`.\n\ncompleted: 10 tokens in, 4008 out, cost 143300 micro-USD" }
  ]
}
```

Two things in that last line need reading carefully. "10 tokens in" is not the prompt size: `run.completed` reports cache reads (93,777 tokens) and cache writes (8,869) in separate fields that `result.usage` leaves out. The cost is the other surprise, covered under [What the run cost](#what-the-run-cost).

The approval gate is not the security boundary. File writes are allowed, and `node --test` runs whatever test files exist, so an agent that wanted to run code could write a test file. The sandbox and its egress allowlist are the boundary. The gate keeps the run honest and the log readable. For why the boundary has to sit outside the agent, see [our prompt-injection measurements on an ops agent](/posts/prompt-injection-ops-agent-measured).

## Step 5: verify outside the agent's control

The agent said "All six tests pass". It was right, but its sandbox is agent-controlled: its files, its `node`, anything a test imports. A check that runs there can be fooled. A review of our first version found three ways: git as root in a tree whose `.git` the agent could write, tests running in the same process as the agent's code (which can patch `assert` or `process.exit`), and parsing `sha256sum` output that a crafted file name can spoof.

The version that survived is simpler. `04-verify.ts`:

1. Lists the regular files under `fixture/` in the agent's sandbox, downloads each one and hashes it on our machine. It compares the hashes with the same files from our own git at the commit the agent started from. Result: one file changed, `fixture/src/format.js`, and the tests were untouched. No git runs in the agent's sandbox.
2. Creates a **second sandbox** with `harness: none`, clones the original commit, and copies in only the agent's `format.js`.
3. Runs `verify/probe.mjs` there, our own script. It loads the agent's function in its own process, calls it on 220 inputs and prints the answers as JSON. The inputs are the boundaries around KiB, MiB and GiB, `NaN`, `-1`, `Infinity` and 200 random sizes from a new seed, so a table of hard-coded answers would have to guess them.
4. Compares the answers on our machine with `lib/reference.ts`, our own correct implementation.

```terminal
{
  "title": "npx tsx 04-verify.ts",
  "prompt": "$",
  "steps": [
    { "cmd": "npx tsx 04-verify.ts", "output": "agent sandbox changed: changed fixture/src/format.js\nreference check (seed 207020979): 220/220 answers match\noriginal tests (record only, hashes match): 6 pass, 0 fail\nVERIFIED: fixed" }
  ]
}
```

The original tests still run in the checker, for the record only, with the TAP report written to a file outside the repo. The verdict ignores them. The agent's change:

```diff
-  while (value > 1024 && unit < UNITS.length - 1) {
+  // For KiB and above, compare the value as it will be displayed, so that
+  // e.g. 1023.99 KiB (shown as "1024.0 KiB") moves up to the next unit.
+  while (
+    unit < UNITS.length - 1 &&
+    (unit === 0 ? value >= 1024 : Number(value.toFixed(1)) >= 1024)
+  ) {
```

Its comment and final message also mention a case the tests do not cover, fractional byte counts below 1 KiB. Our inputs are whole numbers, so we did not check that part.

This check proves something specific: for 220 inputs, 200 of them random from a seed the agent never saw, the answers the probe printed matched our reference. It is not tamper-proof. The probe loads the agent's module into its own process, as root, in a throwaway sandbox that holds no keys, and that module could rewrite what the probe prints. To pass, it would still have to print the right answers. The verdict in `04-verify.ts` is the answer match; the file hashes are reported next to it.

## Step 6: preview the app through a port-forward

Harness Runtime has no public preview URL. The [limits page](https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/details/limits/) says live preview is not available, and the SDK README says the API answers `501` for public ingress. You reach a port with `session.portForward`, which opens one WebSocket tunnel per TCP connection. A local `net` server turns that into a normal port:

```typescript
// The server runs the agent's code, so it runs as the agent's user, not as root.
const server = await session.spawn(
  ['runuser', '-u', 'agent', '--', 'env', 'PORT=8080', 'node', 'src/server.js'],
  { cwd: '/workspace/repo/fixture', onStdout: (t) => process.stdout.write(t) }
);

createServer(async (socket) => {
  const tunnel = await session.portForward(8080, (bytes) => socket.write(bytes));
  socket.on('data', (chunk) => tunnel.send(new Uint8Array(chunk)));
  socket.on('close', () => tunnel.close());
  tunnel.closed.then(() => socket.end());
}).listen(18080, '127.0.0.1');
```

```terminal
{
  "title": "npx tsx 05-preview.ts",
  "prompt": "$",
  "steps": [
    { "cmd": "npx tsx 05-preview.ts", "output": "[sandbox] size-service listening on :8080\nforwarding 127.0.0.1:18080 -> sandbox :8080\nGET /healthz -> 200 ok\nGET /size?bytes=1024 -> 200 {\"bytes\":1024,\"human\":\"1.0 KiB\"}\nGET /size?bytes=1048575 -> 200 {\"bytes\":1048575,\"human\":\"1.0 MiB\"}\nGET /size?bytes=-5 -> 400 {\"error\":\"bytes must be a non-negative number\"}" }
  ]
}
```

Nothing is published to the internet, and the tunnel authenticates with your API token. A `spawn`ed command has the same 15-minute limit as a streamed `exec`, so a long-lived dev server needs restarting or a different approach.

## Step 7: lifecycle and cleanup

`idle_timeout: 10m` worked as described. `07-idle.ts` left the session alone after the preview and polled `sessions.get`, which reads the record without counting as activity. The session went from `SESSION_STATUS_READY` to `SESSION_STATUS_PAUSED` with `pauseReason: "idle"`. A paused session runs nothing, so a background job you started there [stops too](https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/how-to/run-sandbox/). An `exec` on the paused session woke it: the command ran, the status went back to `READY`, and the agent's edit was still in `format.js`. Paused sessions still count toward the per-team session limit, so pausing is not cleanup.

Cleanup takes two deletes, not one. `06-cleanup.ts` looks the session up with `sessions.get`, as any separate cleanup job would, and that is where the SDK's convenience ends: `destroy()` deletes the saved config only for a `Session` object that came from `sessions.create()` in the same process. A session you find later loses only its sandbox. So the script deletes the config by id, then checks both are gone.

The model key is tied to the config, not to the session. Before cleanup, the script read `HARNESS_INFERENCE_API_KEY` inside the sandbox (into memory only) and called DigitalOcean's inference API with it from our machine:

| Moment                          | `GET /v1/models` with the key, from outside the sandbox  |
| ------------------------------- | -------------------------------------------------------- |
| Before destroy                  | HTTP 200                                                 |
| After the session was destroyed | HTTP 200                                                 |
| After the config was deleted    | HTTP 401 (one run needed a second try, 10 seconds later) |

We saw the same order in all five Claude Code sessions. Two lessons follow. Anything the agent can run can read the key and send it to any host egress allows, so keep egress tight. And a cleanup job that only destroys sessions leaves live keys behind, so delete the config too, or create sessions with `await using` in the process that owns them:

```typescript
{
  await using sandbox = await hr.sessions.create({ manifest });
  // ... work ...
} // destroyed here, and the config the API saved for it is deleted
```

`sweep.ts` destroys every session and config whose name starts with the demo's prefix. Run it after a crash, and on a schedule if you automate this. After the last run it found nothing, and the account's session list was empty.

## Spend limits and tokens

The [pricing page](https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/details/pricing/) is explicit: "There is no per-session or per-product spend limit for Harness Runtime." These are the levers that do exist:

- **A separate prepaid balance.** Usage draws from an Agent Droplets subscription balance if you have one, then promotional credits, then the Inference and Agents balance, then the account prepayment. When every balance is empty, [running sessions pause and nothing new starts](https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/how-to/pay-for-harness-runtime/). A [dedicated team](https://docs.digitalocean.com/platform/teams/how-to/create/) with its own Inference and Agents balance and auto-reload off is the closest thing to a cap on running work. The team has to sit outside an organization to keep its own balance, promotional credits keep sessions running even at a zero balance, and snapshot and checkpoint storage keeps accruing after the balances run out.
- **Your own model key with a spend threshold.** Put `HARNESS_INFERENCE_API_KEY` under `secrets`, and the API no longer mints a key. The SDK sends the manifest as given and does not expand `${...}` placeholders the way `doctl` does, so build the manifest in code with the real value, held in memory and never logged. A model access key can have a [monthly budget that pauses it at 100%](https://docs.digitalocean.com/products/inference/how-to/manage-model-access-keys/), in public preview, with a lag: "requests made between the key reaching its budget and the pause taking effect are processed and billed." Keys and thresholds are created in the Control Panel only, so we did not test the pause. The trade-off is lifetime: a managed key dies with its config, your own key lives until you rotate it, and both are readable inside the sandbox.
- **An Anthropic key from a capped workspace.** To bill Claude to Anthropic instead, declare `ANTHROPIC_API_KEY` under `secrets`, drop the two `HARNESS_INFERENCE_*` fields, and pass `manageModelAccessKey: false` to `sessions.create`, or the SDK still asks for a managed key. Anthropic workspaces can have a [monthly spend limit](https://platform.claude.com/docs/en/manage-claude/workspaces). We did not run this path.
- **Limits in your own code.** `timeoutMs` on `run` stops the wait, and `session.cancel(runId)` or `destroy()` stops the run. Set `idle_timeout` short, never `keep_warm` for batch work, and run the sweep.

The DigitalOcean API token is the weak spot. With no Harness Runtime scope in the public scope list, the token that drives your sessions is a full-access token. Keep it out of the sandbox (the demo never passes it in) and out of command lines, where `ps` can read it.

## What the run cost

The SDK returns `usage.costMicros` from the `run.completed` event. Every `run.usage_recorded` event in all four runs said `model_id: claude-haiku-5-5`, and the sandbox ran Claude Code with `--model anthropic-claude-5.5-haiku`. But the reported costs match [Opus 5.5 list prices](https://docs.digitalocean.com/products/inference/details/pricing/) once rounded to whole micro-dollars, about 36 times the Haiku 5.5 price for the same tokens:

```chart
{
  "type": "bar",
  "title": "Cost per run: what run.completed reported vs Haiku 5.5 list price",
  "unit": "$",
  "caption": "Token totals from each run.completed event (input, output, cache read, 5-minute cache write), priced at DigitalOcean's published Haiku 5.5 rates ($0.10 / $0.50 / $0.01 / $0.125 per million). The reported cost equals the same totals at Opus 5.5 rates ($4 / $20 / $0.20 / $5) in all four runs. Runs of 27 November 2026.",
  "rows": [
    { "label": "Run 1 reported", "value": 0.2464, "series": "reported" },
    { "label": "Run 1 at Haiku 5.5 rates", "value": 0.0069, "series": "Haiku 5.5 list price" },
    { "label": "Run 2 reported", "value": 0.1835, "series": "reported" },
    { "label": "Run 2 at Haiku 5.5 rates", "value": 0.005, "series": "Haiku 5.5 list price" },
    { "label": "Run 3 reported", "value": 0.1197, "series": "reported" },
    { "label": "Run 3 at Haiku 5.5 rates", "value": 0.0034, "series": "Haiku 5.5 list price" },
    { "label": "Measured run reported", "value": 0.1433, "series": "reported" },
    { "label": "Measured run at Haiku 5.5 rates", "value": 0.0041, "series": "Haiku 5.5 list price" }
  ],
  "series": [
    { "name": "reported", "color": "#f59e0b" },
    { "name": "Haiku 5.5 list price", "color": "#0080ff" }
  ]
}
```

For the measured run: `10 x $4 + 4,008 x $20 + 93,777 x $0.20 + 8,869 x $5`, per million tokens, is $0.1433004, which rounds to the reported 143,300 micro-dollars. At Haiku 5.5 rates the same tokens cost $0.0041. We cannot tell from the events which number the invoice will use. The invoice preview had not picked up these runs when we wrote this, so check yours, and do not build a budget alert on `costMicros` alone until the two agree.

The sandbox is cheap next to that. At [list price](https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/details/pricing/), memory on `mars-2vcpu-4gb` costs $0.038 per hour ($0.0095 per GB-hour), and CPU bills on use at $0.044 per vCPU-hour. The measured session existed for under 12 minutes, the idle wait included, which puts its memory under one cent. CPU bills on use, and even both vCPUs at full load for that long would be under two cents. The checker sandboxes are the smallest size, `mars-1vcpu-1gb`.

## What breaks

- **`name` is ignored** on a create from a manifest, both in the SDK and in the raw API. Put it in the manifest.
- **Root versus `agent`.** `exec`, `spawn` and file uploads act as root, and the agent cannot edit root-owned files. Run the agent's code as `agent` too (`runuser -u agent --`), not as root.
- **Blocked egress does not say it was blocked.** In a sandbox whose allowlist named only `github.com`, `npm view` failed with `403 Forbidden ... forbidden by your security policy`, `pip download` said `No matching distribution found for requests`, and `curl` printed `CONNECT tunnel failed, response 403`. None of them names the Harness Runtime egress allowlist: npm's "security policy" wording is generic, and pip's reads like a missing package. [The docs warn about this](https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/concepts/egress/), and a package manager reporting a missing package is the version that costs you an afternoon.
- **`destroy()` after `sessions.get()`** leaves the saved config, and with it a working model key.
- **`usage.tokensIn`** excludes cached tokens, which were almost all of the input here.
- **Buffered `exec` has 240 seconds**, and its output is cut at 1 MiB. Pass `onStdout` to stream instead, which allows 15 minutes.
- **One region.** The regions endpoint returned only `ric1` for our team.
- **Persistent workspaces** are documented as a free public preview, but our team got `403`: "persistent workspaces are in limited availability. Contact DigitalOcean support to request access".

## The safety rules this demo keeps

- The agent's shell commands go through an allowlist with absolute paths only; egress allows `github.com` and platform hosts, and the sandbox holds no GitHub token, so it cannot push.
- The agent owns only `fixture/src`; `.git` and the tests stay root-owned, and the agent's code runs as `agent` in its own sandbox. It runs as root only in the throwaway checker, which holds no keys.
- The verdict comes from a second sandbox and our own reference answers, never from the agent's tree or a process that loads its code next to the assertions.
- The records the scripts write to `runs/` pass through value-based redaction, the account's email in `run.started` events is dropped, and we scanned the repo for every key value before publishing.

## What we could not conclude

- **Speed.** The preview terms rule out publishing timings, so there are none here. DigitalOcean publishes its own numbers in its [launch post](https://www.digitalocean.com/blog/managed-agents-public-preview).
- **Which cost is billed.** The reported cost and the Haiku list price differ by a factor of about 36, and the invoice will settle it.
- **How a run behaves at scale.** This was one small task, five sessions, one agent and one model. The [sandboxes comparison](/posts/ai-agent-sandboxes-compared-render-vercel-cloudflare-e2b-daytona) and the [managed agent runtimes comparison](/posts/managed-agent-runtimes-compared-2026) cover how the platform stacks up on limits and price.

## Summary

The SDK does what it says: a session, a streamed run, approvals, commands, files, a port-forward and cleanup are each a few lines. The work is in the parts around it. Name sessions in the manifest. Give the agent's user only the files it should change. Treat the agent's sandbox as agent territory, and verify somewhere else. Delete the config along with the session, or the key outlives both. And until the reported cost and the Haiku price agree, trust the invoice, not `costMicros`.
