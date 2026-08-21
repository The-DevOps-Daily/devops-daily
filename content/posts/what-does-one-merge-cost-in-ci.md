---
title: 'What Does One Merge Actually Cost You in CI?'
excerpt: 'Wall-clock time and machine minutes are different numbers, and most teams track only one. Here is how to get both from your own repo.'
category:
  name: 'CI/CD'
  slug: 'ci-cd'
date: '2026-08-06'
publishedAt: '2026-08-06T09:00:00Z'
updatedAt: '2026-08-06T09:00:00Z'
readingTime: '13 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - CI/CD
  - GitHub Actions
  - FinOps
  - DevOps
  - Docker
---

Ask a team how long their CI takes and you will get an answer. Ask what one merge costs and you usually get a pause.

The pause is reasonable, because there are two numbers and they are not the same. One is how long a developer sits waiting. The other is how many machine minutes you are billed for. They start out close, and then every time you make CI feel faster by running more things at once, they drift further apart.

I pulled a week of real runs from this site's repository to show what that looks like, and the script is at the end so you can do the same to yours.

## TL;DR

- **Wall clock** is what the developer waits. **Machine minutes** is what you pay. Parallelising jobs improves the first and increases the second.
- On our repo, the median trigger costs 2.5 minutes of waiting and 4.5 minutes of billed compute. That is **1.84x**.
- At p90 the gap is worse: 2.9 minutes of waiting, 9.2 minutes of compute.
- Queue time is a separate number again, and it is the one that goes bad quietly.
- 4% of our machine time went on runs that did not succeed.
- Our CI is genuinely fast, so this post is mostly about the method. The numbers you get from your own repo are the point.

## Prerequisites

- A repo using GitHub Actions, and the `gh` CLI authenticated
- Python 3 for the analysis

## The two numbers

A push triggers a set of workflows. If three jobs run in parallel and each takes four minutes, the developer waits four minutes. You are billed for twelve.

That is the whole idea, and it has an uncomfortable consequence: **the standard advice for making CI feel fast is the same action that makes it cost more.** Splitting a slow test suite into four shards is a good idea. It is also a decision to pay roughly four times as much for that stage, in exchange for the developer getting their answer sooner.

Neither number is the right one to optimise on its own. Wall clock is what your engineers experience and what determines whether they context-switch away and lose twenty minutes. Machine minutes is what finance sees. If you only track one, you will make a decision that looks great on that axis and terrible on the other.

There is a third number, and it is the sneaky one: **queue time**, the gap between a run being created and a runner picking it up. It is invisible in most dashboards because it is not part of the job duration. It sits at zero for a long time and then, once you add concurrency limits or move to a fixed pool of self-hosted runners, it becomes the largest component of the wait without a single job getting slower.

## Getting your own numbers

One command to collect, one script to analyse:

```bash
gh run list --limit 200 \
  --json databaseId,name,status,conclusion,createdAt,startedAt,updatedAt,event \
  > runs.json
```

The three timestamps are what matter, and it is worth being precise about them:

- `createdAt` is when the run was created by the trigger
- `startedAt` is when a runner actually picked it up
- `updatedAt` is when it finished

So **queue time is `startedAt - createdAt`**, and **run time is `updatedAt - startedAt`**. Most people compute one duration from `createdAt` to `updatedAt` and never notice they have silently blended a scheduling problem into their build times.

To get per-merge figures rather than per-workflow ones, group the runs that share a trigger. Grouping by creation minute is a decent approximation:

```python
groups = defaultdict(list)
for r in runs:
    groups[r["createdAt"][:16]].append((r["name"], run_seconds(r)))

wall = [max(s for _, s in v) for v in groups.values()]   # developer waits
machine = [sum(s for _, s in v) for v in groups.values()] # you are billed
```

`max` for wall clock because parallel jobs overlap. `sum` for machine minutes because you are charged for all of them.

## Our numbers, honestly

200 completed runs from 30 July to 6 August 2026 on this site's repo, which resolved to 73 trigger events. Median two workflows per trigger, occasionally seven.

| Measure | Median | p90 |
| --- | --- | --- |
| Wall clock per trigger | 2.5 min | 2.9 min |
| Machine minutes per trigger | 4.5 min | 9.2 min |

```chart
{
  "type": "bar",
  "title": "What a developer waits, against what you are billed",
  "unit": "min",
  "caption": "73 trigger events on the devops-daily repo, 30 July to 6 August 2026. Wall clock is the longest job in the group; machine minutes is the sum of all of them.",
  "rows": [
    { "label": "median", "value": 2.5, "series": "wall clock" },
    { "label": "median", "value": 4.5, "series": "machine minutes" },
    { "label": "p90", "value": 2.9, "series": "wall clock" },
    { "label": "p90", "value": 9.2, "series": "machine minutes" }
  ],
  "series": [
    { "name": "wall clock", "color": "#f59e0b" },
    { "name": "machine minutes", "color": "#0080ff" }
  ]
}
```

At the median we pay for 1.84 times what a developer experiences. At p90 that stretches to more than three times, because the heavier triggers fan out to more workflows.

Per workflow:

| Workflow | Runs | Median | p90 |
| --- | --- | --- | --- |
| Build Test | 79 | 1.9 min | 2.2 min |
| Tests | 78 | 2.5 min | 2.8 min |
| Check Links | 15 | 1.9 min | 2.0 min |
| IndexNow Submission | 15 | 0.4 min | 0.5 min |
| Docker Validation | 5 | 0.4 min | 0.4 min |

:::note
I should be straight about this: our CI is not slow. Two minutes median, no queueing, on a static site with a modest test suite. I am not going to pretend otherwise to make a better headline. The reason to publish the numbers is that they show the method working, and they give you a small-repo reference point to compare against.
:::

Converting to money needs a rate. GitHub's listed price for a standard Linux 2-core runner on private repos was $0.008 per minute when this was written, so at the median our trigger would be about **$0.036**. A thousand merges a month lands near **$36**. Our repo is public, so we actually pay nothing, which is exactly why the wall-clock number is the one that matters to us and the machine-minute number might be the one that matters to you.

Do not copy my rate. Put your own in, because runner size changes it by a multiple: a 16-core runner is eight times the per-minute cost of a 2-core one, and a job that does not use the cores runs no faster on it.

## Queue time, and why yours will not stay at zero

Our median queue time is 0 seconds, and so is p90. GitHub-hosted runners on a public repo, no concurrency limits, no contention.

That number is the first one to go bad when a team grows, and it goes bad in a way that does not show up in any job duration:

- You add `concurrency` groups to stop redundant runs, and now pushes wait behind each other
- You move to self-hosted runners for cost or network access, and you now own a fixed pool with a queue in front of it
- Your team doubles, everyone pushes between 10am and noon, and the pool is sized for the average rather than the peak

If your builds have not got slower but people say CI feels worse, measure `startedAt - createdAt` before you touch anything else.

## The failure tax

Nine of our 200 runs did not succeed, 4%. Those runs burned 15 machine-minutes out of 408, which is also about 4%.

That is a healthy ratio, and it is worth measuring because an unhealthy one is invisible. A flaky test that fails 30% of the time and gets re-run does not appear on any dashboard as a cost. It appears as a slightly annoying thing everyone has learned to click past, while quietly consuming a third of your CI spend and considerably more of your engineers' patience.

## When CI actually is slow, this is usually why

Our numbers are small, so this section is from experience rather than from the data above. In rough order of how often it is the answer:

**The cache is not being hit.** Not missing, *not hit*. Someone configured caching, it restores a key that no longer matches, and every build silently does a cold install. Check the cache-hit line in the logs rather than trusting that the step exists.

**Docker layers rebuild from scratch.** A `COPY . .` before `RUN npm ci` invalidates every layer below it on any file change. Copy the lockfile, install, then copy the source.

**You are cross-compiling for ARM on x86 emulation.** QEMU-based multi-arch builds can be several times slower than native. Native ARM runners are the fix, and this is one of the clearest wins available right now.

**The runner is too big or too small.** Too small and you swap. Too big and you pay for idle cores because the job is single-threaded anyway. Both are common, and both are one line to test.

**Everything is serial.** A job graph that could fan out but does not. This is the one case where the fix genuinely improves wall clock, and it is also the one where you should watch your machine minutes afterwards.

**You install the same toolchain every run.** Container images with the toolchain baked in turn two minutes of `apt-get` into a pull.

## Where the vendors change the tradeoff

There is a category of company selling faster CI: [Depot](https://depot.dev), [Blacksmith](https://blacksmith.sh), [Namespace](https://namespace.so) and [WarpBuild](https://warpbuild.com) among them. What they mostly sell is drop-in runners with better hardware, persistent caches that actually persist, and native ARM so you stop emulating.

The honest version of the build-versus-buy question is this. The fixes in the previous section are free and you should do them first, because if your cache is misconfigured you will pay a vendor to run a cold build faster rather than running a warm build at all. Once those are done, you are choosing between engineering time spent maintaining runner infrastructure and a per-minute rate.

The number that decides it is the one from the top of this article. If a merge costs you three minutes of waiting, halving it saves ninety seconds per merge, and you can multiply that by your merge rate and your loaded engineering cost to get a figure worth arguing about. If you do not have that number, any vendor conversation is vibes.

## Do these first

1. Run the script. Get wall clock, machine minutes and queue time for your repo.
2. Find whether your caches are actually hitting.
3. Check whether you are emulating ARM.
4. Look at your failure rate and what it is costing.
5. Only then talk about faster runners, with numbers in hand.

## The script

```python
import json, statistics as st
from collections import defaultdict
from datetime import datetime

runs = json.load(open("runs.json"))
ts = lambda x: datetime.fromisoformat(x.replace("Z", "+00:00"))

rows, groups = [], defaultdict(list)
for r in runs:
    if r["status"] != "completed" or not r.get("startedAt"):
        continue
    queue = max((ts(r["startedAt"]) - ts(r["createdAt"])).total_seconds(), 0)
    run = (ts(r["updatedAt"]) - ts(r["startedAt"])).total_seconds()
    if run < 0:
        continue
    rows.append({"wf": r["name"], "queue": queue, "run": run, "ok": r["conclusion"] == "success"})
    # Runs sharing a creation minute almost always share a trigger.
    groups[r["createdAt"][:16]].append(run)

pct = lambda xs, p: sorted(xs)[max(int(len(xs) * p) - 1, 0)]
wall = [max(v) for v in groups.values()]
machine = [sum(v) for v in groups.values()]

print(f"{len(rows)} runs, {len(groups)} triggers")
print(f"wall clock   median {st.median(wall)/60:5.1f}m  p90 {pct(wall,.9)/60:5.1f}m")
print(f"machine min  median {st.median(machine)/60:5.1f}m  p90 {pct(machine,.9)/60:5.1f}m")
print(f"ratio        {st.median(machine)/st.median(wall):.2f}x")
print(f"queue        median {st.median([r['queue'] for r in rows]):4.0f}s  "
      f"p90 {pct([r['queue'] for r in rows],.9):4.0f}s")

failed = [r for r in rows if not r["ok"]]
total = sum(r["run"] for r in rows)
print(f"failures     {len(failed)}/{len(rows)} = {100*len(failed)/len(rows):.0f}%, "
      f"{sum(r['run'] for r in failed)/60:.0f}m of {total/60:.0f}m burned")

RATE = 0.008  # your runner's per-minute rate, not mine
print(f"cost         ${st.median(machine)/60*RATE:.3f}/merge, "
      f"${st.median(machine)/60*RATE*1000:.0f} per 1000 merges")
```

## What this does not cover

- One repo, one week, 200 runs. A static site with a small test suite is not a monorepo.
- Grouping by creation minute is an approximation. Two unrelated pushes in the same minute merge into one event.
- GitHub reports whole-minute billing per job, so real invoices round up and will exceed these figures.
- Self-hosted runners change the cost model entirely: you pay for the machine whether or not it is building.

The method transfers even when the numbers do not. Run it on your repo, and if your machine-to-wall ratio is worse than 2x, you now know something about your pipeline that you did not know this morning.

For more on getting CI to tell you what went wrong, we wrote about [triaging CI logs automatically](/posts/ci-log-triage-digitalocean-inference), and there is a [pipeline hardening guide](/posts/cicd-pipeline-hardening-guide) covering the security side.
