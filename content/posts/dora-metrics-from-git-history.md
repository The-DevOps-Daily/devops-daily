---
title: 'DORA Metrics From Git History: The Definition Picks Your Tier'
excerpt: 'We computed deployment frequency, lead time, change failure rate and recovery time from one year of Kubernetes, uv, Go and Prometheus history, once per common definition. The definition alone moved every project across two or three DORA performance levels, and the merge button decides whether Git still knows when the work started.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-10-14'
publishedAt: '2026-10-14T09:00:00Z'
updatedAt: '2026-10-14T09:00:00Z'
readingTime: '14 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - DORA Metrics
  - Engineering Metrics
  - Git
  - Kubernetes
  - Go
  - DevOps
---

Most DORA dashboards start from the same raw material: your Git history, your tags and your pipeline events. We wanted to know how much of the final number comes from that data and how much comes from the definitions the tool picks for you. So we computed the four DORA metrics for one year of four open-source projects, under several definitions a script or tool could use, and placed the deployment frequency and lead time results in the performance levels of the 2024 DORA report.

The definition alone moved every project across at least two levels. From the same Kubernetes history, deployment frequency is **Medium** (42 final releases, 0.81 a week), **High** (63 tags with the alpha, beta and rc tags, 1.21 a week) or **Elite** (3,286 landings on master, 63 a week). Lead time is **High** (5.2 days) if a landing on master counts as the deploy, **Medium** (25.9 days) to the first tag, and **Low** (76.6 days) to the first final release. For uv, which squash-merges, the lead time from first commit to landing is 0.0 hours, because its squash commits keep no record of when the work started.

## TL;DR

- **A deploy is a definition.** Every project lands in **Elite** for deployment frequency if each landing on the default branch counts, and in **Medium** or **High** if releases count.
- **Lead time depends on where the clock starts and stops.** Kubernetes ranges from 5.2 days to 81.9 days on the same history, depending on the start timestamp, the event that stops the clock, and whether backports count.
- **The merge button can erase history.** In 3,090 of uv's 3,132 landings, the author date is within a minute of the commit date. Prometheus uses both buttons: changes landed with a merge commit show 48.2 hours from first commit to landing, single-commit landings (squashed or pushed) show 0.0 hours.
- **Change failure rate is the least stable of the four.** uv is at 86.1%, 19.8% or 5.0% depending on whether a failure is a quick patch release, any revert, or a revert of a change that shipped.
- **What to do:** write the definitions down, keep them fixed, and compare a team with its own past, not with a level chart or another tool.

## Prerequisites

- `git` and `python3` (standard library only), plus `bc` for the merge-style demo
- A repository whose tags mark releases with version numbers
- The companion repo [dora-from-git](https://github.com/The-DevOps-Daily/dora-from-git), which holds every script and every recorded result in this post

## How we measured

We took one year, 1 October 2025 to 1 October 2026, and four projects that merge in different ways:

| Repo                            | How changes land                                                    | What marks a release                        |
| ------------------------------- | ------------------------------------------------------------------- | ------------------------------------------- |
| kubernetes/kubernetes           | merge commits                                                       | `vX.Y.Z` tags, plus alpha, beta and rc tags |
| astral-sh/uv                    | squash                                                              | `X.Y.Z` tags                                |
| golang/go (go.googlesource.com) | rebase through Gerrit, almost linear history                        | `goX.Y.Z` tags, plus beta and rc tags       |
| prometheus/prometheus           | mixed: 626 merge commits and 615 squashed or pushed commits on main | `vX.Y.Z` tags, plus rc tags                 |

The scripts use plain Git and nothing else. Go is hosted on Gerrit, not GitHub, and the same code reads it. Treeless clones keep every commit and tag but no file contents, which is enough for metadata: the four repos take 132 MB, and a full run took 137 seconds on a Raspberry Pi 4 (`results/benchmark.txt`).

The pipeline is four stages, each writing a file the next one reads:

1. `00-clone.sh` clones each repo and records its head commit.
2. `01-extract.py` records, for every tag in the window, the commits it shipped for the first time, every first-parent commit on the default branch with the commits it brought in, and every revert with the commit or Gerrit change its message names.
3. `02-metrics.py` computes each metric under each definition.
4. `03-tiers.py` places the results in the 2024 levels.

Before we trusted the extract, `check-method.py` compared it with plain Git on seeded random samples. The commits each merge brought in matched `git rev-list --no-merges <first-parent>..<merge>` on 58 of 58 merges, and the first final release that shipped a commit matched `git tag --contains` on 60 of 60 commits.

The levels come from the [2024 Accelerate State of DevOps report](https://dora.dev/research/2024/dora-report/) (version 2024.3, page 13):

| Level  | Change lead time                 | Deployment frequency                             | Change fail rate | Failed deployment recovery time |
| ------ | -------------------------------- | ------------------------------------------------ | ---------------- | ------------------------------- |
| Elite  | Less than one day                | On demand (multiple deploys per day)             | 5%               | Less than one hour              |
| High   | Between one day and one week     | Between once per day and once per week           | 20%              | Less than one day               |
| Medium | Between one week and one month   | Between once per week and once per month         | 10%              | Less than one day               |
| Low    | Between one month and six months | Between once per month and once every six months | 40%              | Between one week and one month  |

The report describes these as clusters of survey answers, not as thresholds. We use the ranges the way a dashboard does, as bands. We place only deployment frequency and lead time, because change fail rate is a single value per level and is not in order: Medium (10%) sits below High (20%).

:::note
These projects ship releases, not production deploys, so a tag stands in for a deploy. That makes them a fair test of the definitions, and an unfair basis for ranking the projects. Nothing here says one project is better run than another.
:::

## What counts as a deploy

Four definitions: every tag, every final release, every day with a final release, and every landing on the default branch (a merge, a squash or a direct commit). A tool that reads only the Git host sees no deploys, so the last one is the event it can count.

| Repo       | Every tag         | Final releases    | Release days      | Landings on default branch |
| ---------- | ----------------- | ----------------- | ----------------- | -------------------------- |
| Kubernetes | 1.21/week, High   | 0.81/week, Medium | 0.29/week, Medium | 63.0/week, Elite           |
| uv         | 1.94/week, High   | 1.94/week, High   | 1.78/week, High   | 60.1/week, Elite           |
| Go         | 0.69/week, Medium | 0.58/week, Medium | 0.29/week, Medium | 65.6/week, Elite           |
| Prometheus | 0.75/week, Medium | 0.50/week, Medium | 0.46/week, Medium | 23.8/week, Elite           |

Kubernetes shows how much the choice matters. It cut 42 final releases in the year, but only on 15 days, because it patches several release lines on the same day. Count tags, releases or release days and you get three different numbers from the same calendar. Count landings and every project is Elite, including Go, whose master branch is not a release.

Your company has the same choice, with different names: every merge to main, every pipeline run, every rollout to production, or every release train. Pick one and write it down.

## Where the lead time clock starts and stops

Lead time has two ends, and Git offers several timestamps for each.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "First commit", "sub": "author date", "icon": "branch", "tone": "slate" },
    { "label": "Last rebase or amend", "sub": "committer date", "icon": "gear", "tone": "slate" },
    { "label": "Lands on main", "sub": "merge or submit", "icon": "check", "tone": "blue" },
    { "label": "First tag", "sub": "alpha, beta or rc", "icon": "box", "tone": "amber" },
    { "label": "Final release", "sub": "the deploy", "icon": "rocket", "tone": "green" }
  ]
}
```

Here is Kubernetes, from the same history, seven ways. The rows do not cover identical sets of changes: a landing-based row counts what landed in the window, a release-based row counts what releases in the window shipped, and each stop event picks up a slightly different set.

| Clock starts                                  | Clock stops                              | Changes | Median | Level  |
| --------------------------------------------- | ---------------------------------------- | ------: | -----: | ------ |
| first commit of the change                    | landing on master, if that is the deploy |   3,286 |  5.2 d | High   |
| commit author date                            | first tag, alpha to rc included          |   6,812 | 25.9 d | Medium |
| landing on master (commit date for backports) | first final release                      |   3,734 | 60.6 d | Low    |
| commit committer date                         | first final release                      |   6,091 | 63.1 d | Low    |
| commit author date                            | first final release                      |   6,091 | 76.6 d | Low    |
| first commit of the change                    | first final release                      |   3,734 | 77.0 d | Low    |
| commit author date, backports left out        | first final release                      |   5,486 | 81.9 d | Low    |

```chart
{
  "type": "bar",
  "title": "Kubernetes change lead time, same history, seven definitions",
  "unit": " days",
  "caption": "Median days. 1 Oct 2025 to 1 Oct 2026. Source: results/summary.md in The-DevOps-Daily/dora-from-git.",
  "rows": [
    { "label": "Landing is the deploy", "value": 5.2, "series": "High" },
    { "label": "To first tag (alpha to rc)", "value": 25.9, "series": "Medium" },
    { "label": "Landing to final release", "value": 60.6, "series": "Low" },
    { "label": "Committer date to final", "value": 63.1, "series": "Low" },
    { "label": "Author date to final", "value": 76.6, "series": "Low" },
    { "label": "First commit of change to final", "value": 77.0, "series": "Low" },
    { "label": "Author date, no backports", "value": 81.9, "series": "Low" }
  ],
  "series": [
    { "name": "High", "color": "#10b981" },
    { "name": "Medium", "color": "#f59e0b" },
    { "name": "Low", "color": "#ef4444" }
  ]
}
```

Four choices do most of the moving:

- **Which release stops the clock.** Kubernetes cuts alpha tags from master, so a commit reaches its first tag 25.9 days after it is written, and its first final release 76.6 days after. If your release candidates never serve users, they are not deploys.
- **Author date or committer date.** The committer date changes every time a commit is rebased or amended, the author date does not. On Kubernetes, switching to the committer date moves the median from 76.6 to 63.1 days.
- **Backports.** For 605 of the 6,091 commits that Kubernetes final releases shipped, we found no landing on master between October 2024 and October 2026. They were made on release branches: mostly cherry-picked fixes, plus the release commits themselves. `git cherry-pick` keeps the original author date, so a cherry-pick counts the time since the fix was first written. Leaving these commits out moves the median from 76.6 to 81.9 days.
- **Per commit or per change.** We count a change as one landing on the default branch, so a pull request merged with a merge commit counts once, while a rebased pull request with ten commits counts ten times, and a commit with no landing on master counts on its own, from its commit date. On Kubernetes, per commit and per change barely differ (76.6 against 77.0 days). The unit matters more where pull requests are large.

Go is Low in every release-based definition, from 69.1 days (to the first tag, beta and rc included) to 138.0 days (to the final release, backports left out). It ships a feature release every six months, and in our window go1.26.0 was tagged on 10 February 2026 and go1.27.0 on 19 August 2026. Count a landing on master as the deploy and the same project is High, at 4.1 days.

The other repos show smaller spreads. Prometheus is Low (31.9 to 40.5 days) in every release-based definition. uv releases about twice a week, so it is High (28.6 to 30.1 hours) in all of them.

## The merge button decides what Git remembers

This is the part we did not expect to be so clean. With the default behaviour of each button, the way a change lands rewrites its timestamps, and the lead time follows. `demo-date-rewrite.sh` writes two commits on Monday and Wednesday, lands them on Friday three ways, and reads the result back:

```terminal
{
  "title": "one change, three merge buttons",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    { "cmd": "./scripts/demo-date-rewrite.sh", "output": "merge commit:\n  feature: part 2 | author 2026-09-09T15:00:00+00:00 | committer 2026-09-09T15:00:00+00:00\n  feature: part 1 | author 2026-09-07T10:00:00+00:00 | committer 2026-09-07T10:00:00+00:00\n  lead time from author date 102.0 h, from committer date 102.0 h\n\nsquash:\n  feature (squashed) | author 2026-09-11T16:00:00+00:00 | committer 2026-09-11T16:00:00+00:00\n  lead time from author date   0.0 h, from committer date   0.0 h\n\nrebase:\n  feature: part 2 | author 2026-09-09T15:00:00+00:00 | committer 2026-09-11T16:00:00+00:00\n  feature: part 1 | author 2026-09-07T10:00:00+00:00 | committer 2026-09-11T16:00:00+00:00\n  lead time from author date 102.0 h, from committer date   0.0 h" }
  ]
}
```

A merge commit keeps the original commits and their dates. A squash writes one new commit dated at the landing. A rebase keeps the author dates but resets the committer dates. Git lets you override both dates, so these are defaults, not laws, and a commit date is not proof of when a commit was pushed.

The real repos behave the same way:

- **uv** lands every change as a single commit. In 3,090 of its 3,132 landings, the author date is within 60 seconds of the commit date, so "first commit to landing" is 0.0 hours at the median and at the 75th percentile. Git cannot tell how long a uv pull request was open.
- **Prometheus** uses both buttons. The 626 changes it landed with a merge commit took 48.2 hours from first commit to merge at the median. The 615 squashed or pushed ones show 0.0 hours, and in 612 of them the author date is within a minute of the commit date. Same project, same maintainers, same year.
- **Go** submits through Gerrit, which rebases but keeps the author date. None of its 3,414 single-commit landings has an author date within 60 seconds of the commit date, and the median from author date to submit is 99.0 hours (4.1 days).

So with these defaults, a team that squash-merges looks Elite on "first commit to landing" lead time however long its reviews take, and a team that switches from merge commits to squash improves that number overnight without changing anything else.

## Three rules for a failed deploy

Git has no incidents, so a Git-only tool has to infer failures. We tested three rules a Git-only tool can apply:

| Repo       | Next patch within 7 days | Release ships any revert | A later release reverts a change it shipped |
| ---------- | ------------------------ | ------------------------ | ------------------------------------------- |
| Kubernetes | 0 of 42 (0.0%)           | 4 of 42 (9.5%)           | 1 of 42 (2.4%)                              |
| uv         | 87 of 101 (86.1%)        | 20 of 101 (19.8%)        | 5 of 101 (5.0%)                             |
| Go         | 4 of 30 (13.3%)          | 2 of 30 (6.7%)           | 1 of 30 (3.3%)                              |
| Prometheus | 5 of 26 (19.2%)          | 7 of 26 (26.9%)          | 1 of 26 (3.8%)                              |

Each rule fails in its own way:

- **The hotfix rule reads a version scheme as failures.** uv increments the patch number for nearly every release and shipped 101 in the year, so the next patch almost always follows within a week: 86.1%. Kubernetes publishes patch releases monthly, so the same rule never fires: 0.0%. Neither number says anything about failures.
- **"Ships a revert" counts reverts that users never saw.** Many reverts undo a change before it reaches a release. In Kubernetes, 34 reverts that shipped in a final release undid a change that had not shipped in an earlier release in the window: either it was never released, or it shipped before the window.
- **"Reverts a shipped change" needs the revert to name its target in a form a script can read.** Our parser looks for "reverts commit <hash>" and "reverts CL <number>". It could not resolve 21 Kubernetes reverts and 19 uv reverts: their messages name no commit that way, sometimes none at all, so this rule cannot match them. Go writes "This reverts CL 847405" instead of a commit hash, and the script resolves those through the `Reviewed-on` trailer that Gerrit adds. Your conventions decide what this rule can see.

The strict rule finds one failure each in Kubernetes, Go and Prometheus. With one event, the rate is noise: one more revert would double it.

Recovery time inherits all of this. Under the hotfix rule it is the time to the next patch: 3.0 days for uv, 5.2 for Prometheus, 6.0 for Go. It can never be longer than 7 days, because the rule only counts a failure when the fix came within 7 days. The number measures the rule, not the recovery.

## What a dashboard adds, and what it does not

The script shows what Git alone supports. A full engineering-metrics tool (vendors in this space include LinearB, Swarmia, Jellyfish, DX, Sleuth and Faros AI) can read other systems, and those systems hold data Git does not:

- **When the work started.** The forge API knows when a pull request was opened and when its first commit was pushed, which is exactly what a squash merge removes from Git.
- **Real deploy events.** A CD pipeline knows when a version reached production, per environment. A tag is a stand-in.
- **Real failures.** Linking deploys to incidents, rollbacks and pages measures failure directly instead of inferring it from reverts or patch numbers.
- **Ownership and trends.** Mapping repos and paths to services and teams, and recomputing the same way every week.

What a tool does not remove is the choice of definition. Before you compare a number across teams or tools, ask which event counts as a deploy, which timestamp starts lead time, whether backports and release candidates count, and what counts as a failure. If the answers differ, the numbers do not compare.

## What we could not conclude

- **These projects do not deploy.** Tags stand in for deploys. The results test the definitions, not the projects.
- **The levels are survey clusters.** The report presents them as groups of answers, and the band edges are our reading.
- **The failure numbers are small.** The strict revert rule found one failure in three of the four projects, so its rates move a lot with one release.
- **Unshipped work is left out.** Lead time counts only commits that reached a release before the window closed, so the medians describe completed work. Go's work since the go1.27 freeze is not in them.
- **Tag dates differ.** uv and Go use lightweight tags, dated by the tagged commit. Kubernetes and Prometheus use annotated tags, dated by the tagger. A release can be published hours after its tag.

## Run it on your repositories

```bash
git clone https://github.com/The-DevOps-Daily/dora-from-git.git
cd dora-from-git
./run.sh
cat results/summary.md
```

To measure your own repositories, edit `repos.json`. Each entry needs a clone URL, the default branch, and a regular expression for your release tags, with groups for major, minor and patch and, if you tag release candidates, a fourth group for the prerelease suffix:

```json
{
  "name": "payments-api",
  "url": "git@gitlab.example.com:platform/payments-api.git",
  "branch": "main",
  "merge_style": "squash",
  "tag_pattern": "^v(\\d+)\\.(\\d+)\\.(\\d+)(-rc\\.\\d+)?$"
}
```

If your deploys are not tagged, have your pipeline tag each production deploy with a version that the pattern matches, for example `v1.42.0`, and the same scripts measure deploys instead of releases. The hotfix rule reads the patch number, so it only means something if a patch bump marks a fix.

```github
https://github.com/The-DevOps-Daily/dora-from-git
```

## Summary

- The same Git history put each of the four projects in two or three different DORA levels, depending only on the definition.
- What counts as a deploy moved deployment frequency by up to two levels, and every project is Elite if a landing on the default branch counts.
- Where the clock starts and stops moved Kubernetes lead time from 5.2 to 81.9 days on the same history.
- With default settings, squash merges and rebases rewrite the timestamps lead time depends on, so the merge button can change the metric without changing the work.
- Change failure rate inferred from Git measured version schemes and commit message habits more than failures.
- Write the definitions down, keep them fixed, record the unit (commit or change), and compare a team with its own past.
