---
title: 'Why Your GitHub Actions Bill Keeps Growing, and What Each Fix Saves'
excerpt: "Per-job rounding, macOS minutes at ten times the Linux price, re-runs and storage add up quietly. We measured where one repository's minutes went in 30 days, then ran a mobile pull request pipeline 34 times on GitHub-hosted runners and on Bitrise Build Hub to see what faster machines change in time and money."
category:
  name: 'CI/CD'
  slug: 'ci-cd'
date: '2026-10-19'
publishedAt: '2026-10-19T09:00:00Z'
updatedAt: '2026-10-19T09:00:00Z'
readingTime: '20 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - CI/CD
  - GitHub Actions
  - FinOps
  - iOS
  - Android
  - Benchmarks
  - Bitrise
sponsorCampaign: 'bitrise'
---

A GitHub Actions bill rarely grows because of one decision. It grows a minute at a time: every job is rounded up to a whole minute, every matrix leg pays for its own checkout and setup, macOS minutes cost about ten times as much as Linux minutes, and artifacts stay in storage for 90 days unless you say otherwise. For a mobile team, the most expensive job is often the iOS build. In the pipeline we tested, it was a median 57% of GitHub's cost per run, although the Android build took longer.

We measured both halves of the problem. First, a read-only script that shows where one repository's minutes went in the last 30 days, and the free changes that act on what it finds. Then the runner question. We ran one mobile pull request pipeline (the iOS build and unit tests, the Android build and the Android unit tests, all started together) 17 times on GitHub-hosted runners and 17 times on [Bitrise Build Hub](https://bitrise.io/platform/build-hub), which runs GitHub Actions jobs on its own M4 Macs and AMD Linux machines.

**About the same cost at list price, less than half the wait.** With the Build Hub Linux pool allowed to run two machines at once, the pipeline finished in a median 18.5 minutes on Build Hub over 7 runs, against 43.5 minutes on GitHub over 17 runs. At list price, a run cost a median $1.69 on Build Hub and $1.79 on GitHub, over 17 runs each, and the ranges overlap. The iOS job is where the money moves: it ran 2.7 times faster on a 5 vCPU M4 and cost about a fifth as much per job. The two Android jobs ran about twice as fast on a 16 vCPU Linux machine and cost about twice as much per job.

## TLDR

- Run the audit script in this post on your busiest repository first. On ours, rounding each job up to a whole minute added a quarter to the billed minutes, and re-runs added almost nothing. Your mix will differ, and the script tells you which fix matters.
- Free fixes inside GitHub Actions: cancel superseded runs, filter by path inside the job (not at the workflow level, or required checks hang), set `timeout-minutes`, merge tiny jobs, and set `retention-days` on artifacts.
- macOS jobs are the clearest case for a different runner. The Wikipedia iOS app's build and tests took a median 922 s on GitHub's `macos-26` (3 vCPU M1) and 337 s on a Build Hub M4 Large (5 vCPU M4): $0.99 against $0.18 per job at list price.
- Heavy Linux jobs got faster on a bigger machine, not cheaper. The Thunderbird Android build took 2,604 s on GitHub's 4 vCPU runner and 1,244 s on Build Hub's 16 vCPU Linux XLarge, at $0.53 against $1.05 per job.
- Set the machine pool maximum to at least the number of jobs that start together. With a Linux pool maximum of 1, our second Android job waited a median 15 minutes for the first one, and the pipeline took a median 35.3 minutes.

## Prerequisites

- A GitHub repository with some Actions history, and the [GitHub CLI](https://cli.github.com/) logged in with read access to it.
- Node.js 22 or later for the audit script.
- To repeat the runner test: a Bitrise Build Hub workspace, and an organization owner who can install the Build Hub GitHub App.

## Where the minutes go

GitHub bills hosted runners per job, per minute, at a rate set by the machine. These are the mechanisms that make a bill grow without anyone deciding to spend more. Prices are GitHub's list prices, [checked on 18 October 2026](https://docs.github.com/en/billing/reference/actions-runner-pricing).

| Mechanism        | What it does to the bill                                                                                                                                                                                                                                                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS rate       | The standard macOS runner (3 vCPU M1) costs $0.062 a minute. A 2-core Linux runner costs $0.006, so a macOS minute costs about 10 times as much. The 5 vCPU M2 Pro (`-xlarge`) costs $0.102.                                                                                                                                              |
| Per-job rounding | "GitHub rounds the minutes and partial minutes each job uses up to the nearest whole minute." A 20-leg matrix of 35-second jobs bills 20 minutes for 11.7 minutes of work.                                                                                                                                                                |
| Matrix fan-out   | Each leg repeats checkout, toolchain setup and cache restore, and pays its own rounding.                                                                                                                                                                                                                                                  |
| Larger runners   | Billed from the first minute. Included minutes do not apply to them, and they are not free in public repositories.                                                                                                                                                                                                                        |
| Re-runs          | "Re-run all jobs" pays for every job again. "Re-run failed jobs" pays only for the failed jobs and the jobs that depend on them.                                                                                                                                                                                                          |
| Artifact storage | $0.25 per GB-month, accrued hourly, with a 90-day default retention. Deleting an artifact does not refund what it has already accrued.                                                                                                                                                                                                    |
| Cache            | 10 GB per repository is free, and entries not used for 7 days are evicted. Since [20 November 2025](https://github.blog/changelog/2025-11-20-github-actions-cache-size-can-now-exceed-10-gb-per-repository/) you can pay for more at $0.07 per GB-month. A cache that is too small keeps evicting itself, and every miss is a cold build. |
| AI review        | Copilot code review [uses Actions minutes](https://github.blog/changelog/2026-04-27-github-copilot-code-review-will-start-consuming-github-actions-minutes-on-june-1-2026/) in private repositories since 1 June 2026.                                                                                                                    |
| Queueing         | Free, Pro and Team plans run at most 5 macOS jobs at the same time. Waiting does not cost minutes, but it costs the people who wait.                                                                                                                                                                                                      |

Flaky tests make re-runs a habit. GitHub's own engineering team [reported in 2020](https://github.blog/engineering/engineering-principles/reducing-flaky-builds-by-18x/) that "1 in 11 commits had at least one red build caused by a flaky test". Google [reported in 2016](https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html) "about 1.5% of all test runs reporting a 'flaky' result". Every one of those red builds is a full re-run if someone presses the wrong button.

## Measure your own bill

The list above says what can happen. Your run history says what did. This script reads the last 30 days of runs and jobs for one repository with `gh api`, rounds each job the way GitHub does, and prints where the minutes went. It only reads, and it runs fine on a laptop or a Raspberry Pi.

```javascript
#!/usr/bin/env node
// Where did this repository's GitHub Actions minutes go? Reads the run and job
// history with the gh CLI (read-only) and prints the billed minutes, the
// minutes added by per-job rounding, the minutes spent on re-runs, queue time,
// and the workflows that bill the most.
//
//   node audit.mjs owner/repo [days]      # default: the 30 full days before today
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const [repo, days = '30'] = process.argv.slice(2);
if (!repo) throw new Error('usage: node audit.mjs owner/repo [days]');
const run = promisify(execFile);
const gh = async (path) =>
  JSON.parse(
    (await run('gh', ['api', '--paginate', '--slurp', path], { maxBuffer: 1 << 28 })).stdout
  );

// One query per day: the runs endpoint returns at most 1,000 runs per search.
const runs = [];
for (let d = 1; d <= days; d++) {
  const day = new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);
  const pages = await gh(`repos/${repo}/actions/runs?created=${day}&per_page=100`);
  runs.push(...pages.flatMap((p) => p.workflow_runs).filter((r) => r.status === 'completed'));
}

// Jobs of every attempt (filter=all), eight requests at a time.
const jobs = [];
for (let i = 0; i < runs.length; i += 8) {
  const batch = runs.slice(i, i + 8).map(async (r) => {
    const js = (
      await gh(`repos/${repo}/actions/runs/${r.id}/jobs?filter=all&per_page=100`)
    ).flatMap((p) => p.jobs);
    return js.map((j) => ({ ...j, workflow: r.name }));
  });
  jobs.push(...(await Promise.all(batch)).flat());
}

const min = (a, b) => (Date.parse(b) - Date.parse(a)) / 60000;
const ran = jobs.filter(
  (j) =>
    j.started_at &&
    j.completed_at &&
    j.conclusion !== 'skipped' &&
    min(j.started_at, j.completed_at) > 0
);
const rows = ran.map((j) => {
  const used = min(j.started_at, j.completed_at);
  return {
    workflow: j.workflow,
    used,
    billed: Math.ceil(used),
    rerun: j.run_attempt > 1,
    queue: min(j.created_at, j.started_at) * 60,
    os: j.labels.join(' ').includes('macos') ? 'macOS' : 'other',
  };
});

if (rows.length === 0) {
  console.log(`${repo}: no jobs ran in the last ${days} days`);
  process.exit(0);
}

const sum = (xs, f) => xs.reduce((s, x) => s + f(x), 0);
const pct = (q, xs) =>
  [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(q * xs.length))];
const queues = rows.map((r) => r.queue);
const used = sum(rows, (r) => r.used);
const billed = sum(rows, (r) => r.billed);
const rerun = sum(
  rows.filter((r) => r.rerun),
  (r) => r.billed
);
const short = rows.filter((r) => r.used < 1).length;

console.log(`${repo}, last ${days} days: ${runs.length} runs, ${rows.length} jobs that ran`);
console.log(`minutes used   ${used.toFixed(0)}`);
console.log(
  `minutes billed ${billed}  (+${(billed - used).toFixed(0)} from rounding each job up, ${((billed / used - 1) * 100).toFixed(0)}%)`
);
console.log(
  `jobs under 1 minute: ${short} of ${rows.length} (${((short / rows.length) * 100).toFixed(0)}%), each billed as 1`
);
console.log(
  `re-run attempts: ${rows.filter((r) => r.rerun).length} jobs, ${rerun} billed minutes (${((rerun / billed) * 100).toFixed(1)}%)`
);
console.log(`queue: median ${pct(0.5, queues).toFixed(0)} s, p90 ${pct(0.9, queues).toFixed(0)} s`);
console.log(`macOS jobs: ${rows.filter((r) => r.os === 'macOS').length}`);
const byWorkflow = Object.entries(Object.groupBy(rows, (r) => r.workflow))
  .map(([name, rs]) => [name, sum(rs, (r) => r.billed), rs.length])
  .sort((a, b) => b[1] - a[1]);
console.log('top workflows by billed minutes:');
for (const [name, b, n] of byWorkflow.slice(0, 5))
  console.log(`  ${String(b).padStart(6)}  ${name.slice(0, 40)} (${n} jobs)`);
```

We ran it on the repository behind this site on 18 October 2026:

```terminal
{
  "title": "audit.mjs",
  "prompt": "$",
  "steps": [
    {
      "cmd": "node audit.mjs The-DevOps-Daily/devops-daily 30",
      "output": "The-DevOps-Daily/devops-daily, last 30 days: 1120 runs, 906 jobs that ran\nminutes used   1796\nminutes billed 2234  (+438 from rounding each job up, 24%)\njobs under 1 minute: 125 of 906 (14%), each billed as 1\nre-run attempts: 2 jobs, 6 billed minutes (0.3%)\nqueue: median 3 s, p90 4 s\nmacOS jobs: 0\ntop workflows by billed minutes:\n    1077  Tests (377 jobs)\n     813  Build Test (376 jobs)\n     110  IndexNow Submission (93 jobs)\n      26  npm_and_yarn in / for @next/third-partie (2 jobs)\n      22  npm_and_yarn in / for @next/third-partie (2 jobs)"
    }
  ]
}
```

The repository is public and runs only Linux jobs, so all of this was free, but the shape is common. Rounding added 438 minutes, a 24% markup on the 1,796 minutes the jobs used. The jobs are short: just under 2 minutes each on average, and 125 of them finished in under a minute and billed a full one. Re-runs were 0.3% of the billed minutes, and jobs waited 3 seconds for a runner. Both workflows that bill the most already cancel superseded runs. So of the things this script measures, rounding is the one worth fixing here, with fewer and longer jobs. Billed at the 2-core private-repository rate of $0.006, the rounding would be $2.63 of a $13.40 month. That is small money, but a repository with the same mix of short jobs and a bill a hundred times larger pays the same 24%.

Some limits of the script. It uses the job's start and end times, which is what GitHub bills, but it cannot see your plan's included minutes or discounts, so treat its numbers as list-price minutes. It selects runs by the day they were created, so a re-run attempt counts on the day of the original run, and a day with more than 1,000 runs is cut at 1,000. It does not look at artifact storage or cache hit rates. And it counts runs on self-hosted runners as if they were billed; filter them out by label if you have any.

## Free fixes inside GitHub Actions

None of these needs a new vendor. Start with the one your audit points at.

**Cancel runs that a newer push makes useless.** Every push to a pull request starts a full run. Without a concurrency group, the old run keeps going and bills to the end.

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  # Cancel superseded pull request runs, but let runs on main finish.
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```

**Filter by path inside the job, not at the workflow level.** A workflow-level `paths:` filter skips the whole workflow, and then [its checks stay "Pending"](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax), which blocks a pull request that requires them. A job skipped by its `if:` condition reports success instead, so put the decision in a small first job:

```yaml
# In a workflow that runs on pull_request.
permissions:
  contents: read
  pull-requests: read

jobs:
  changes:
    runs-on: ubuntu-24.04
    outputs:
      ios: ${{ steps.diff.outputs.ios }}
    steps:
      - id: diff
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          # List the files this pull request changes, without a checkout.
          # A failed API call fails this job, so make it a required check too.
          files=$(gh pr diff ${{ github.event.pull_request.number }} -R ${{ github.repository }} --name-only)
          if grep -q '^ios/' <<< "$files"; then
            echo "ios=true" >> "$GITHUB_OUTPUT"
          fi

  ios:
    needs: changes
    if: needs.changes.outputs.ios == 'true'
    runs-on: macos-26
    timeout-minutes: 45
    steps:
      - uses: actions/checkout@v7
      # ... build and test
```

Make both `changes` and `ios` required checks. If `changes` fails, `ios` is skipped, and a skipped job counts as passed. The `changes` job bills one Linux minute. Skipping one standard macOS job of 15 minutes saves $0.93.

**Set `timeout-minutes` on every job.** The default limit is 6 hours. One hung macOS job that runs to the limit bills 360 minutes, which is $22.32 at $0.062.

**Merge tiny jobs.** Three 20-second lint jobs bill 3 minutes. One job that runs all three bills 1. The same applies to matrix legs that only differ in a flag.

**Put light automation on the smallest runner.** `ubuntu-slim` is a 1 vCPU runner in a container at $0.002 a minute, with a 15-minute job limit and no Docker. It suits labelers, triage bots and other jobs that wait on an API. arm64 Linux runners are also cheaper than x64 at the same size: $0.005 against $0.006 for 2 cores, and $0.008 against $0.012 for 4 cores.

**Keep artifacts for days, not months.**

```yaml
- uses: actions/upload-artifact@v7
  with:
    name: test-results
    path: build/test-results
    retention-days: 5
```

At the 90-day default, an artifact accrues 18 times the GB-hours it accrues at 5 days.

**Re-run failed jobs, not all jobs.** And fix the flaky test that made you re-run. The audit's re-run line tells you whether this is worth your time.

## Moving the slow jobs to a faster runner

Some jobs are slow because the machine is small, and no workflow change fixes that. GitHub's standard macOS runner is a 3 vCPU M1 with 7 GB of memory. Its largest Apple silicon runner is a 5 vCPU M2 Pro with 14 GB.

Bitrise Build Hub keeps GitHub Actions as the orchestrator and supplies the machines. The jobs still appear in the Actions tab, with the same logs, secrets and triggers. Setup has three parts:

1. An organization owner installs the Bitrise Build Hub GitHub App, preferably only on the repositories that need it.
2. In the Bitrise workspace, you create a machine pool: an image, a machine type, and a maximum number of machines. Bitrise registers the machines with GitHub as runners in a runner group.
3. You change `runs-on` for the jobs you want to move. Bitrise adds a `bitrise-runner-<pool name>` label to each pool:

```yaml
jobs:
  ios:
    # Was: runs-on: macos-26
    runs-on: [bitrise-runner-ios-m4-large]
```

`runs-on` is set per job, so you can move the iOS job and keep everything else where it is.

Three things are different from GitHub-hosted runners, and all three mattered in our test:

- **The images are Bitrise stacks**, not GitHub's runner images. The Xcode 26.5 stack had the same Xcode build (17F42) and the same iPhone 17 simulator that we used on GitHub. The Ubuntu 24.04 Linux image did not have the Android SDK command-line tools or the OpenGL and X11 libraries that Thunderbird's Compose UI tests load, so our workflow installs them when they are missing: 2 to 7 seconds for the SDK tools and 9 to 14 seconds for four packages. Both steps run inside the job, so their time is in our results and in the cost.
- **The pool maximum is a setting you own.** A pool starts machines on demand, up to its maximum. With the Android pool at a maximum of 1, the two Android jobs of each pipeline ran one after the other, and the second one waited a median 15 minutes for the first (more on this below).
- **Billing is a monthly budget.** A Build Hub tier fee becomes your compute budget, and jobs use it at a per-minute rate per machine type. On 18 October 2026 the pricing FAQ said that when the budget runs out, "You won't be able to run more builds until the monthly cycle resets", and that pay-as-you-go overage is coming. Size the tier from your run count, and watch the balance.

The machines register like self-hosted runners, so the usual hygiene applies. Restrict the runner group to the repositories that need it, and require approval before workflows from forks run.

## The benchmark: one mobile pull request, 34 runs

We wanted a test that looks like a real team's pull request, not a synthetic compile.

```diagram
{
  "type": "graph",
  "columns": [
    [{ "id": "pr", "label": "Pull request", "sub": "one pipeline run", "icon": "branch", "tone": "slate" }],
    [
      { "id": "ios", "label": "iOS build + tests", "sub": "Wikipedia app", "icon": "cpu", "tone": "blue" },
      { "id": "ab", "label": "Android build", "sub": "Thunderbird", "icon": "box", "tone": "green" },
      { "id": "at", "label": "Android tests", "sub": "Thunderbird", "icon": "check", "tone": "green" }
    ],
    [{ "id": "done", "label": "Pipeline done", "sub": "last job finished", "icon": "rocket", "tone": "accent" }]
  ],
  "edges": [["pr", "ios"], ["pr", "ab"], ["pr", "at"], ["ios", "done"], ["ab", "done"], ["at", "done"]]
}
```

**The workloads.** Both apps are open source and pinned by full commit SHA, and every run starts cold, with no cache on either side.

- iOS: the [Wikipedia iOS app](https://github.com/wikimedia/wikipedia-ios) at `ca8aaeb9`, its "Run Unit Tests" job: resolve packages, `xcodebuild build-for-testing`, then `test-without-building` on an iPhone 17 simulator with iOS 26.5 and Xcode 26.5. All 503 unit tests pass on both sides.
- Android: [Thunderbird for Android](https://github.com/thunderbird/thunderbird-android) at `cf54b1fd`, with the commands of its own CI. The build job runs `./gradlew :app-thunderbird:assemble -Pci=true`. The test job runs `./gradlew testsOnCi --parallel`. Both use the project's CI Gradle settings, with one change: Gradle gets one worker per CPU (upstream pins 4, the size of a GitHub standard runner), and machines with more than 20 GB of memory give the Gradle daemon half of it.

**The machines.**

| Side                             | iOS job                                                       | Android jobs                                                                             |
| -------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| GitHub-hosted                    | `macos-26`: Apple M1 (virtual), 3 vCPU, 7 GB. $0.062 a minute | `ubuntu-24.04`: 4 vCPU, 16 GB. $0.012 a minute (the 4-core rate in a private repository) |
| Build Hub, self-serve Pro Tier 1 | M4 Large: Apple M4 (virtual), 5 vCPU, 14 GB. $0.03 a minute   | Linux XLarge: AMD EPYC Genoa, 16 vCPU, 64 GB. $0.05 a minute                             |

These are not same-size pairs. On GitHub we used the standard macOS runner and a 4 vCPU Linux runner, which a team gets without a larger-runner plan. On Build Hub we used the smallest M4 and the largest self-serve Linux machine. The Build Hub machines have more CPU and memory, and the results hold for these configurations only. Cost per run shows what the size difference costs. Build Hub prices are the rates at which jobs use the plan budget, read from [bitrise.io/pricing](https://bitrise.io/pricing) on 18 October 2026, unchanged since we first read them on 10 October.

**How we ran it.** Bitrise provided the Build Hub workspace for these tests. The workflows and every run are public in the benchmark repository. One workflow, `bench-mobile-pipeline.yml`, starts the three jobs together. We dispatched the GitHub and Build Hub runs in pairs, most of them seconds apart: 10 pairs from 16 October 15:24 to 17 October 12:15 UTC, then 7 more from 17 October 15:44 to 21:25 UTC. Every iOS job ran all 503 tests with no failures, and every Android build succeeded. One Android test task on GitHub (run 38985488530) failed on a network error: Robolectric could not download a dependency, and Gradle stopped after about 10 minutes. Actions still shows that job as green, because our workflow records a failed Gradle task in its result file instead of failing the job. So 16 of 17 GitHub test jobs and all 17 Build Hub test jobs ran the full suite. We kept that run. Leaving it out makes GitHub's medians slightly worse (45.1 minutes and $1.80 a run), so keeping it is the conservative choice. Pipeline time is from the moment the run is created to the end of its last job, so queueing and machine start-up count, as they do for the developer who waits. Cost is each job's time, rounded up to a whole minute, times the list price, added up per run. Bitrise does not publish how it rounds Build Hub usage, so we applied GitHub's rule to both sides. Three tiny planning jobs run on GitHub's runner on both sides and are left out of the cost.

```github
https://github.com/The-DevOps-Daily/gha-runner-benchmark
```

### Pipeline time

```chart
{
  "type": "dots",
  "title": "Mobile pipeline, run created to last job done",
  "unit": " min",
  "caption": "Every run. GitHub: macos-26 + ubuntu-24.04, 17 runs, 16 to 17 Oct 2026. Build Hub: M4 Large + Linux XLarge, 10 runs with the Android pool maximum at 1, then 7 at 2. Source: results/mobile-pipeline.json.",
  "series": [
    { "name": "GitHub (17 runs)", "samples": [52.9, 42.0, 55.8, 42.2, 47.7, 43.5, 32.8, 60.8, 41.2, 40.1, 51.8, 49.8, 56.9, 34.2, 55.1, 36.8, 42.4], "median": 43.5 },
    { "name": "Build Hub, pool max 2 (7 runs)", "samples": [18.0, 18.5, 21.4, 29.4, 17.1, 17.0, 25.9], "median": 18.5 },
    { "name": "Build Hub, pool max 1 (10 runs)", "samples": [46.4, 34.2, 30.2, 27.4, 26.2, 41.0, 52.1, 28.1, 38.9, 36.4], "median": 35.3 }
  ]
}
```

With the Android pool at a maximum of 2, the pipeline took a median 18.5 minutes (17.0 to 29.4) on Build Hub, against 43.5 minutes (32.8 to 60.8) on GitHub. That is about 2.4 times faster. We compare with all 17 GitHub runs because it is the conservative choice: the 7 GitHub runs paired with the pool-maximum-2 runs had a median of 49.8 minutes.

### The pool maximum mistake

Our first 10 Build Hub runs had the Android pool maximum at 1, a setting we chose and did not check. The first Android job started after a median 34 seconds. The second waited for the first to finish: a median 886 seconds, and up to 2,646 seconds. The pipeline took a median 35.3 minutes. After we set the maximum to 2, both Android jobs started after 32 to 34 seconds in every run. Not all of the drop to 18.5 minutes came from the setting: the Android builds were also faster in the later runs, a median 1,070 seconds against 1,592.

The rule: set each pool's maximum to at least the number of its jobs that start at the same time, and remember that a matrix starts all of its legs at once.

### Each job

| Job               | GitHub, median (range), 17 runs | Build Hub, median (range), 17 runs | Faster by |
| ----------------- | ------------------------------- | ---------------------------------- | --------- |
| iOS build + tests | 922 s (597 to 1,173)            | 337 s (314 to 471)                 | 2.7x      |
| Android build     | 2,604 s (1,956 to 3,638)        | 1,244 s (981 to 2,581)             | 2.1x      |
| Android tests     | 967 s (710 to 1,186)            | 467 s (400 to 587)                 | 2.1x      |

The job times are from all 17 runs per side. The pool maximum changes how long a job waits, not how long it runs, so it does not affect these numbers. Queue time is separate: on GitHub, jobs started after a median 3 seconds on Linux and 8 seconds on macOS. On Build Hub, where each pool starts a machine when a job arrives, they started after a median 33 to 34 seconds on Linux (at pool maximum 2) and 38 seconds on macOS.

The GitHub Android times move a lot. In the 17 runs, GitHub's 4 vCPU runner reported three different CPU models for the build and five for the tests. The two builds on an AMD EPYC 9V45 host took 1,780 and 1,892 seconds for the Gradle task, and the twelve on an EPYC 7763 took 1,979 to 3,426 seconds, so the host explains part of the spread but not all of it. Build Hub's Android build varied too, from 981 to 2,581 seconds for the job, on machines that all reported the same CPU. More cores did not always help on Build Hub either: in separate runs, a 32 vCPU machine from the Enterprise plan took 1,561 to 2,448 seconds for the Gradle build task, against 1,231 to 1,463 seconds on the 16 vCPU Linux XLarge (three runs each).

### Cost per run

```chart
{
  "type": "dots",
  "title": "List-price cost of each pipeline run",
  "unit": " USD",
  "caption": "Each job rounded up to a whole minute, times the list price: GitHub $0.062 macOS, $0.012 Linux 4-core; Build Hub $0.03 M4 Large, $0.05 Linux XLarge (budget rates, 18 Oct 2026). All 17 runs per side.",
  "series": [
    { "name": "GitHub", "samples": [1.96, 1.66, 2.03, 2.0, 1.85, 1.63, 1.41, 1.74, 1.66, 1.42, 1.88, 1.92, 1.45, 1.48, 1.81, 1.79, 1.84], "median": 1.79 },
    { "name": "Build Hub", "samples": [2.51, 1.88, 1.68, 1.53, 1.48, 2.21, 2.78, 1.58, 2.08, 1.98, 1.51, 1.48, 1.69, 2.03, 1.46, 1.48, 1.88], "median": 1.69 }
  ]
}
```

A run cost a median $1.69 on Build Hub (range $1.46 to $2.78) and $1.79 on GitHub ($1.41 to $2.03). The means point the other way, $1.84 on Build Hub against $1.74 on GitHub, because of a few slow Android builds on Build Hub: the $2.78 run had a 2,581-second build. So "about the same" is the right summary, not "cheaper".

These are list prices for the compute each run used, not two invoices. Build Hub is sold as a monthly tier, so budget you do not use makes the real price per run higher. Our GitHub runs cost nothing, because the repository is public. In a private repository, standard macOS minutes can come out of your plan's included minutes, while the 4-core Linux runner, a larger runner, is billed from the first minute.

We used all 17 Build Hub runs for cost because the pool maximum changes queue time, not billed minutes. The 7 runs at pool maximum 2 alone had a median cost of $1.51, mostly because their Android builds were faster (a median 1,070 seconds, against 1,592 seconds in the first 10 runs). Using that number would flatter Build Hub.

The cost per job shows where the money goes:

| Job               | GitHub, median per job              | Build Hub, median per job         |
| ----------------- | ----------------------------------- | --------------------------------- |
| iOS build + tests | $0.99 (16 billed minutes at $0.062) | $0.18 (6 billed minutes at $0.03) |
| Android build     | $0.53 (44 at $0.012)                | $1.05 (21 at $0.05)               |
| Android tests     | $0.20 (17 at $0.012)                | $0.40 (8 at $0.05)                |

The Macs save money and the 16 vCPU Linux machines cost more per job, and in this pipeline the two roughly cancel out. Each column is a median of its own, so the rows do not add up to the per-run medians above. A run used a median 79 billed minutes on GitHub and 37 on Build Hub: fewer minutes, at a higher price per Linux minute.

For budget sizing, use the mean, not the median: at $1.84 a run, Pro Tier 1's $210 monthly budget covers about 114 runs of this pipeline. Leave headroom, because builds stop when the budget runs out.

## What we could not conclude

- **The macOS pair is not equal in size.** We did not run GitHub's 5 vCPU M2 Pro (the `-xlarge` macOS runner), because larger runners cost money even in public repositories. Its price makes the cost question simple, though: at $0.102 a minute it would have to finish this job within one billed minute to cost less than Build Hub's $0.18.
- **The Android pair is not equal in size either.** We did not run GitHub's 16-core Linux larger runner. Per vCPU, its $0.042 a minute ($0.0026 per vCPU-minute) is cheaper than Build Hub's Linux XLarge at $0.05 ($0.0031). We do not know how fast it is on this build.
- **An 8 vCPU machine might be the better buy for Android.** Build Hub's Linux Large costs half the XLarge rate. We did not test it.
- **Cold builds only.** Both sides ran without a Gradle or Xcode cache. Teams with a warm cache will see shorter jobs on both sides, and we did not measure how the gap changes.
- **Our repository is public.** GitHub runs in public repositories are free, and its standard Linux runner there has 4 vCPU. In a private repository, `ubuntu-latest` has 2 vCPU at $0.006, and a 4 vCPU runner is a larger runner at $0.012 with no included minutes. We priced the GitHub side at the 4-core rate, the same size we ran.
- **Build Hub costs are our estimate.** Bitrise does not publish which interval it bills (job time, or machine time including start-up) or how it rounds, so we applied GitHub's rule to the job time. Our pools had a minimum of 0, so no machine waited idle between runs. Treat the Build Hub cost per run as an estimate until Bitrise confirms its billing.
- **Seven runs at pool maximum 2, in one evening.** The 18.5-minute median comes from 7 runs between 15:44 and 21:25 UTC on 17 October. The job times come from all 17 runs, spread over two days.
- **One app per platform.** Wikipedia and Thunderbird are real, busy projects, but two apps are not every app. Run the benchmark on your own slowest job before you move it.

## Which jobs to move

The decision is per job, and `runs-on` makes it a one-line change.

- **iOS and other macOS jobs: move them first.** This is where the test was both faster and cheaper: 2.7 times faster and about a fifth of the cost per job, on a newer and larger Mac than GitHub's standard runner.
- **Heavy Linux jobs, such as Android Gradle builds: move them if waiting costs you more than the minutes.** On a 16 vCPU machine they ran about twice as fast at about twice the cost per job. Measure an 8 vCPU machine too.
- **Light Linux jobs: keep them on GitHub.** Build Hub's smallest Linux machine has 4 vCPU at $0.0125 a minute. A lint or labeler job is cheaper on `ubuntu-slim` at $0.002 or a 2-core runner at $0.006.
- **Before any of that, run the audit.** Rounding, re-runs and storage are free to fix, and they shrink whatever runner bill you end up with.

For the full feature-by-feature view, including concurrency limits, images, caching and what happens when the budget runs out, see the [Bitrise Build Hub vs GitHub-hosted runners comparison](/comparisons/bitrise-build-hub-vs-github-hosted-runners).

## Summary

A GitHub Actions bill grows from small, measurable things: whole-minute rounding, runs nobody needed, artifacts kept for 90 days, and macOS minutes at about ten times the Linux price. The audit script shows what rounding and re-runs cost your repository, and most of the fixes are a few lines of YAML.

When the slow job is slow because the machine is small, a faster runner changes the picture. In our mobile pipeline, Build Hub cut the wait from a median 43.5 minutes to 18.5 minutes at about the same list-price cost per run. The iOS job was cheaper and faster. The Android jobs were faster and more expensive. Set the pool maximum to match the jobs that start together, measure your own slowest job on both sides, and move the jobs where the numbers say so.
