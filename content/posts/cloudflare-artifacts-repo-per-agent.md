---
title: 'A Repo per Agent: What Cloudflare Artifacts Changes About Git'
excerpt: 'Cloudflare Artifacts gives every agent, session or task its own Git repository. We measured why one shared branch falls apart as agents multiply, walked through the Workers API, and priced the pattern so you can decide where it fits.'
category:
  name: 'Git'
  slug: 'git'
date: '2026-10-03'
publishedAt: '2026-10-03T09:00:00Z'
updatedAt: '2026-10-03T09:00:00Z'
readingTime: '11 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Git
  - Cloudflare
  - AI Agents
  - Cloudflare Workers
  - Platform Engineering
---

Git was designed for a few hundred people working on one project. It assumes that most changes come from humans, arrive at human speed, and get reviewed by other humans. Coding agents break all three assumptions. A team that runs fifty agents in parallel does not have fifty developers; it has fifty processes that all want to write to the same branch in the same minute.

On October 1, 2026, Cloudflare put a product in front of that problem: **Artifacts**, a Git-compatible store that you drive from Cloudflare Workers, now in open beta. Its core idea is easy to say and has big consequences: stop sharing one repository between workers, and give each unit of work its own. This post explains what Artifacts is, measures why a shared branch stops working as agents multiply, shows the repo-per-agent pattern in code, and works out what it costs.

## TL;DR

- Artifacts is a Git-compatible repository store you create and control from a Worker. Any Git client can clone and push with a short-lived bearer token.
- Cloudflare's own guidance is one repo per unit of autonomous work: 10,000 agents, 10,000 repos. Repos are cheap to create and fork.
- On a single shared branch, push collisions grow with the square of the agent count. In our test, 40 agents pushing at once produced about 700 rejected pushes.
- A repo per agent removes the collisions but moves the hard part to merging the work back. Cloudflare left that layer open and is running a contest for it.
- Pricing: 10,000 operations and 1 GB free per month, then $0.15 per 1,000 operations and $0.50 per GB-month. Each repo is capped at 1 GB.

## Prerequisites

To follow the code:

- A Cloudflare account on the **Workers Paid** plan (Artifacts is not available on the free plan)
- Wrangler 4.145.0 or later, so `wrangler types` knows the Artifacts binding
- Git 2.x on the machine that clones and pushes
- Basic familiarity with Workers bindings and `wrangler.toml`

The push experiment below needs only Git and Bash.

## What Artifacts is

An Artifacts **namespace** holds repositories. Each **repository** is a real Git remote: you get an HTTPS URL of the form `https://<ACCOUNT_ID>.artifacts.cloudflare.net/git/<namespace>/<repo>.git`, and any Git client can talk to it. Authentication is a bearer token passed as an extra HTTP header, so the token never lands in `.git/config`:

```bash
# Clone and push with a repo-scoped token; nothing is written to the remote URL
git -c http.extraHeader="Authorization: Bearer $ARTIFACTS_TOKEN" clone "$ARTIFACTS_REMOTE"
git -c http.extraHeader="Authorization: Bearer $ARTIFACTS_TOKEN" push -u origin main
```

What makes it different from a hosted Git server is the control plane. A Worker gets a binding with methods to create, import, fork, list and delete repositories, mint read or write tokens with a lifetime in seconds, and read history and files without cloning:

| Need                               | Binding call                                                  |
| ---------------------------------- | ------------------------------------------------------------- |
| New empty repo                     | `env.ARTIFACTS.create(name)`                                  |
| Copy from GitHub or another remote | `env.ARTIFACTS.import({ source: { url }, target: { name } })` |
| Branch off a reviewed baseline     | `repo.fork(name, { defaultBranchOnly: true })`                |
| Credentials for one agent          | `repo.createToken("write", 900)`                              |
| Inspect what an agent did          | `repo.log({ ref: "main" })`, `repo.readFile({ ref, path })`   |
| Clean up                           | `env.ARTIFACTS.delete(name)`                                  |

A few more pieces make it a platform rather than storage:

- **Workers Builds** can deploy a Worker from an Artifacts repo. Pushes to `main` run the deploy command, and pushes to other branches can produce preview URLs. Only `main` can be the production branch for now.
- **Repository events** (creates, forks, pushes, clones and so on) can be delivered to Workers Queues, so a push can start a test run or a review agent.
- **Jurisdictions** keep a namespace's data in the US or the EU.
- **Metrics** per repository: operations, pulls, pushes and error rates.

Under the hood, Cloudflare describes each repo as a single logical instance that it can route to from any region, with data replicated synchronously across data centers and copied to object storage in the background. It has not published how concurrent pushes to the same ref are ordered, which matters for the next section.

## Why one shared branch falls apart

Git protects a branch with a compare-and-swap. A push says "move `main` from commit A to commit B". If someone else moved `main` first, the server refuses, because B was built on a history that is no longer the tip. Two agents are enough to see it:

```terminal
{
  "title": "two agents, one branch",
  "prompt": "$",
  "steps": [
    {
      "comment": "both agents cloned the same baseline and made one commit each"
    },
    {
      "cmd": "git push origin main   # in agent-a",
      "output": "To ../shared.git\n   35bfd50..11799a8  main -> main"
    },
    {
      "cmd": "git push origin main   # in agent-b",
      "output": "To ../shared.git\n ! [rejected]        main -> main (fetch first)\nerror: failed to push some refs to '../shared.git'\nhint: Updates were rejected because the remote contains work that you do\nhint: not have locally. This is usually caused by another repository pushing\nhint: to the same ref. You may want to first integrate the remote changes\nhint: (e.g., 'git pull ...') before pushing again.\nhint: See the 'Note about fast-forwards' in 'git push --help' for details."
    }
  ]
}
```

Agent B now has to fetch, rebase and try again. That is fine for two humans. To see what happens with more writers, we ran a small experiment: N agents each commit one file (no two agents touch the same file, so every rebase succeeds) and push to `main` of one shared repository at the same moment, retrying with `git pull --rebase` until the push lands.

```bash
#!/usr/bin/env bash
# N agents each commit one file and push to the same branch of one shared repo,
# retrying with fetch + rebase until the push lands. Prints total attempts.
set -u
N=$1; W=$(mktemp -d); cd "$W"
git init -q --bare -b main shared.git
git clone -q shared.git seed 2>/dev/null
(cd seed && git -c user.email=s@x -c user.name=seed commit -q --allow-empty -m baseline && git push -q origin main)
for i in $(seq 1 "$N"); do git clone -q shared.git "a$i"; done
agent() {
  cd "a$1"
  echo "$1" > "agent-$1.txt"; git add .; git -c user.email=a@x -c user.name="agent-$1" commit -q -m "agent-$1"
  tries=0
  until git push -q origin main 2>/dev/null; do
    tries=$((tries+1))
    git -c user.email=a@x -c user.name="agent-$1" pull -q --rebase origin main 2>/dev/null
  done
  echo "$tries" > ../fails-$1
}
for i in $(seq 1 "$N"); do agent "$i" & done; wait
total=$(cat fails-* | paste -sd+ | bc); max=$(cat fails-* | sort -n | tail -1)
commits=$(git --git-dir=shared.git rev-list --count main)
echo "agents=$N failed_pushes=$total worst_agent_retries=$max commits_on_main=$commits"
rm -rf "$W"
```

We ran it three times for each size on a 4-core Raspberry Pi 4 with Git 2.39 and a bare repository on local disk:

```terminal
{
  "title": "race.sh, three runs per size",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "for n in 5 10 20 40; do for run in 1 2 3; do ./race.sh $n; done; done",
      "output": "agents=5 failed_pushes=10 worst_agent_retries=4 commits_on_main=6\nagents=5 failed_pushes=10 worst_agent_retries=4 commits_on_main=6\nagents=5 failed_pushes=10 worst_agent_retries=4 commits_on_main=6\nagents=10 failed_pushes=45 worst_agent_retries=9 commits_on_main=11\nagents=10 failed_pushes=45 worst_agent_retries=9 commits_on_main=11\nagents=10 failed_pushes=45 worst_agent_retries=9 commits_on_main=11\nagents=20 failed_pushes=190 worst_agent_retries=19 commits_on_main=21\nagents=20 failed_pushes=186 worst_agent_retries=19 commits_on_main=21\nagents=20 failed_pushes=190 worst_agent_retries=19 commits_on_main=21\nagents=40 failed_pushes=711 worst_agent_retries=36 commits_on_main=41\nagents=40 failed_pushes=716 worst_agent_retries=37 commits_on_main=41\nagents=40 failed_pushes=702 worst_agent_retries=38 commits_on_main=41"
    }
  ]
}
```

`commits_on_main` is the baseline plus one commit per agent, so every agent's work landed in the end. The cost is in the retries.

```chart
{
  "type": "line",
  "title": "Rejected pushes when N agents share one branch",
  "x": ["5 agents", "10 agents", "20 agents", "40 agents"],
  "series": [
    { "name": "Measured (median of 3 runs)", "data": [10, 45, 190, 711], "color": "#f59e0b" },
    { "name": "N(N-1)/2", "data": [10, 45, 190, 780], "dash": "6 5" }
  ],
  "caption": "race.sh on a Raspberry Pi 4, Git 2.39, local bare repository. No agents edited the same file, so every rebase succeeded; real conflicts make it worse."
}
```

The numbers follow N(N-1)/2 almost exactly: every push that lands invalidates every other agent's pending push, so the last agent retries N-1 times. At 40 agents it falls slightly below the formula because when several pushes land while an agent is rebasing, the agent catches up on all of them in one retry. Extrapolate to 1,000 agents and the worst case is about half a million rejected pushes for 1,000 commits.

This test is the best case. The repository was on local disk, so a retry cost milliseconds. Against a hosted server, every retry is a network round trip, and the API calls an agent fleet makes around Git count against limits too: GitHub documents a secondary limit of 80 content-generating REST requests per minute and 500 per hour, and 100 concurrent requests. And because no two agents touched the same file, nothing ever failed to rebase. Real agents editing the same code would add merge conflicts that a retry loop cannot fix.

The usual answer is to give each agent its own branch in the shared repo. That removes the race on `main`, but the repository is still one shared object for permissions, rate limits, clone size and blast radius. A token that can push to the repo can usually push to every unprotected branch in it.

## The repo-per-agent pattern

Artifacts makes the next step cheap: a fork per session. A reviewed **baseline** repo holds the code you trust. Every agent session gets its own fork, a write token that only works on that fork and expires in minutes, and nothing else.

```diagram
{
  "type": "graph",
  "columns": [
    [{ "id": "base", "label": "baseline", "sub": "reviewed main", "icon": "database", "tone": "green" }],
    [
      { "id": "f1", "label": "agent-a-s41", "sub": "fork + 15 min token", "icon": "branch", "tone": "blue" },
      { "id": "f2", "label": "agent-b-s42", "sub": "fork + 15 min token", "icon": "branch", "tone": "blue" },
      { "id": "f3", "label": "agent-c-s43", "sub": "fork + 15 min token", "icon": "branch", "tone": "blue" }
    ],
    [{ "id": "orch", "label": "Orchestrator", "sub": "tests, review, merge", "icon": "gear", "tone": "amber" }]
  ],
  "edges": [["base", "f1", "fork"], ["base", "f2", "fork"], ["base", "f3", "fork"], ["f1", "orch", "push event"], ["f2", "orch", "push event"], ["f3", "orch", "push event"]]
}
```

The Worker that hands out sessions is short. Configure the binding:

```toml
name = "agent-sessions"
main = "src/index.ts"
compatibility_date = "2026-10-02"

[[artifacts]]
binding = "ARTIFACTS"
namespace = "agents"
```

Then fork the baseline per session and return a scoped, short-lived token:

```typescript
// src/index.ts: one fork and one 15-minute write token per agent session
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') return new Response('POST only', { status: 405 });
    // This endpoint hands out write tokens: only your orchestrator may call it.
    // ORCHESTRATOR_SECRET is a Worker secret (wrangler secret put ORCHESTRATOR_SECRET).
    if (request.headers.get('Authorization') !== `Bearer ${env.ORCHESTRATOR_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }
    const { agent, session } = (await request.json()) as { agent: string; session: string };

    // Name repos by agent and session so two sessions can never collide
    const name = `${agent}-${session}`;

    // `using` disposes the repo handle when the block ends, as the binding requires
    using baseline = await env.ARTIFACTS.get('baseline');
    const fork = await baseline.fork(name, { defaultBranchOnly: true });

    using repo = await env.ARTIFACTS.get(name);
    const credentials = await repo.createToken('write', 900); // 900 s = 15 minutes

    return Response.json({ remote: fork.remote, credentials });
  },
};
```

The agent clones the remote, works, and pushes with the token. When it is done, the orchestrator does not need to clone anything to see what happened:

```typescript
// Inspect a finished session without cloning it
async function summarize(env: Env, name: string) {
  using repo = await env.ARTIFACTS.get(name);
  const commits = await repo.log({ ref: 'main', limit: 20 }); // newest first
  const plan = await repo.readFile({ ref: 'main', path: 'PLAN.md' });
  return { commits, plan: plan ? await plan.text() : null };
}
```

Cloudflare's best-practice notes add three habits worth copying:

1. **Mint the narrowest token for the shortest time.** Read tokens for indexing and review, write tokens only for the agent doing the work.
2. **Fork from a reviewed baseline** instead of copying files into each new repo, so every session starts from the same known state.
3. **Keep run metadata out of the tree.** Attach prompts, model output and run IDs with `git notes`, so the commit holds the work and the notes hold the context.

And one of our own: delete forks once their work is merged or rejected. Storage is billed, and a pile of abandoned agent repos is the 2026 version of a pile of abandoned feature branches.

## Getting the work back is the hard part

A repo per agent does not make conflicts go away. It moves them from push time, where they cost retries, to integration time, where something has to decide what lands. That is a better place for them, because you can be deliberate there, but someone still has to build it. Cloudflare says so directly: Artifacts is the storage primitive, and its contest asks developers to build the coordination, review and merge layer on top.

The options teams use today, from simplest to most ambitious:

- **Orchestrator merges in order.** One process fetches finished forks, rebases each onto the baseline, runs the tests and pushes. It is a merge queue with exactly one writer to the baseline, so the race from the experiment above cannot happen.
- **Human review gate.** Each fork's push event creates a review item. With Workers Builds, a branch push can also produce a preview URL to look at before anything merges.
- **Agent reviewers.** A second agent with a read-only token reviews the diff and either approves it into the queue or sends it back. Keep the merge itself with the orchestrator, so no reviewing agent ever holds a write token to the baseline.
- **Best-of-N.** Fork several sessions from the same baseline for the same task, test them all, and merge only the winner. Forks are cheap enough that this stops being wasteful.

None of these are new ideas. What changes is that the per-session repository, its credentials and its cleanup are now an API call instead of something you script around a hosted Git service.

## What it costs

Artifacts bills two things. The numbers below are from the pricing page, with billing starting on October 14, 2026:

| Dimension                                          | Included each month | Then               |
| -------------------------------------------------- | ------------------- | ------------------ |
| Operations (create, push, pull, clone and similar) | 10,000              | $0.15 per 1,000    |
| Storage                                            | 1 GB-month          | $0.50 per GB-month |

To size it, assume one agent session costs seven operations: a fork, a clone, three pushes, one fetch by the reviewer and a delete. That is an assumption, not a published figure; count your own workflow before you budget.

```chart
{
  "type": "bar",
  "title": "Estimated monthly operations cost by agent sessions per day",
  "unit": "$",
  "rows": [
    { "label": "100/day", "value": 1.65 },
    { "label": "1,000/day", "value": 30 },
    { "label": "10,000/day", "value": 313.5 },
    { "label": "100,000/day", "value": 3148.5 }
  ],
  "caption": "Assumes 7 billable operations per session, 30 days, and the 10,000 free operations a month. Storage not included: with forks deleted after merge, it stays small."
}
```

Storage depends on your repos and how quickly you delete forks. Cloudflare has not documented whether a fork shares objects with its parent or counts its full size, so measure that in the beta before you plan around hundreds of long-lived forks.

## Limits and open questions

Know these before you commit:

- **1 GB per repository** and **32 MB per file**. Monorepos and repos with large binaries do not fit. Account storage is 1 TB by default and can be raised.
- **Rate limits** of 2,000 requests per 10 seconds per namespace for the control plane, and 2,000 Git requests per 10 seconds per repository. Split busy workloads across namespaces.
- **Open beta.** The API and limits can still change, and it requires the Workers Paid plan.
- **Production deploys from `main` only** in the Workers Builds integration.
- **Undocumented so far:** how concurrent pushes to one ref are ordered, whether forks share storage, and the exact semantics of event delivery. Test them yourself before you rely on them.

:::note
The contest runs until October 14, 2026. Entries need a 5 to 10 minute demo video, open source code under MIT, Apache or BSD, and instructions to run it. The top three teams are flown to Cloudflare Connect in San Francisco, and first place also gets $25,000 in Cloudflare credits. Details are on [Cloudflare's announcement](https://blog.cloudflare.com/next-git-platform-on-cloudflare/).
:::

## Summary

Shared branches assume few writers. Our experiment shows what happens when that assumption fails: rejected pushes grow with the square of the number of agents, before a single real conflict appears. The fix is not a faster retry loop. It is isolation, and Artifacts makes isolation an API call: fork a reviewed baseline per session, hand the agent a 15-minute token that works on nothing else, and read its work back without cloning.

What Artifacts does not give you is the decision about what merges. Plan that layer first. A single-writer merge queue plus tests is enough to start, and it is the part where your team's judgment matters most. If you want to start small, move one agent workflow, such as dependency updates or test generation, to forks of a baseline and watch the error rate and the bill for a month. The [Artifacts documentation](https://developers.cloudflare.com/artifacts/) covers the binding, tokens and Workers Builds setup.
