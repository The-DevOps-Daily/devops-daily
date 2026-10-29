---
title: '15 Minutes to 5: What Happens When You Move iOS CI From M1 to M4'
excerpt: "The Wikipedia iOS app's build and 503 unit tests took a median 15.4 minutes on GitHub's M1 runner and 5.6 minutes on an M4. We split the time by phase, priced each run, and checked whether a bigger Mac is worth it."
category:
  name: 'CI/CD'
  slug: 'ci-cd'
date: '2026-10-29'
publishedAt: '2026-10-29T09:00:00Z'
updatedAt: '2026-10-29T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - CI/CD
  - iOS
  - Xcode
  - macOS
  - GitHub Actions
  - Bitrise
sponsorCampaign: 'bitrise'
---

The Wikipedia iOS app's build and its 503 unit tests took a median **922 seconds (15.4 minutes)** on GitHub's standard `macos-26` runner, an Apple M1 with 3 vCPU. The same job, with the same Xcode, simulator and `xcodebuild` commands, took a median **337 seconds (5.6 minutes)** on a Bitrise Build Hub M4 Large with 5 vCPU. That is 2.7 times faster, over 17 runs on each side, every run cold.

In our [first article](/posts/github-actions-bill-keeps-growing) this was one row in a pipeline benchmark. Here we look only at the iOS job: which phase gets faster, what a run costs at list price, whether a bigger Mac helps, and what you change in a workflow to move it.

```github
https://github.com/The-DevOps-Daily/gha-runner-benchmark
```

## TLDR

- **The build gained the most minutes:** 538 s on the M1 against 145 s on the M4 Large (3.7x). The unit tests went from 370 s to 86 s (4.3x).
- **Cost per run at list price:** a median $0.99 on GitHub (16 billed minutes at $0.062) and $0.21 on the M4 Large (7 billed minutes at $0.03).
- **A bigger M4 adds little:** the 10 vCPU M4 XLarge was 9% faster than the M4 Large and costs twice as much per minute. The 14 vCPU M4 Pro XLarge took 23% less time, and it is on the Enterprise plan only.
- **Machines start on demand:** iOS jobs waited a median 38 seconds for a Build Hub machine, against 8 seconds on GitHub.
- **The workflow change is the `runs-on` line:** it points at a Build Hub pool. The setup around it is a GitHub App, a pool and an image with your Xcode. GitHub Actions still schedules the job and keeps the logs and secrets.

## Prerequisites

- An iOS project that already builds in GitHub Actions with `xcodebuild`
- A way to read job times: the Actions tab, or the `gh` CLI for many runs
- For Build Hub: a Bitrise workspace and the Build Hub GitHub App installed on the repository

## The setup

| Side                             | Runner     | Machine                           | List price      |
| -------------------------------- | ---------- | --------------------------------- | --------------- |
| GitHub-hosted                    | `macos-26` | Apple M1 (virtual), 3 vCPU, 7 GB  | $0.062 a minute |
| Build Hub, self-serve Pro Tier 1 | M4 Large   | Apple M4 (virtual), 5 vCPU, 14 GB | $0.03 a minute  |

These are not same-size machines: the M4 Large has more cores and twice the memory. We compared the standard macOS runner on GitHub with the smallest Mac on Build Hub: the default choice on each side.

**The workload.** The [Wikipedia iOS app](https://github.com/wikimedia/wikipedia-ios) at commit `ca8aaeb9`, its own "Run Unit Tests" job: resolve Swift packages, `xcodebuild build-for-testing`, then `test-without-building` on an iPhone 17 simulator with iOS 26.5 and Xcode 26.5. In the separate runs below, all 503 tests passed every time, and in the pipeline runs every iOS job succeeded. Every run started cold, with no DerivedData or package cache on either side. Cold runs compare the whole environment, not only the chip: the images, macOS patch versions, storage and network also differ.

**How we ran it.** Bitrise provided the Build Hub workspace for these tests. The 17 runs per side come from the pipeline benchmark on 16 and 17 October 2026, dispatched in pairs. The phase split and the bigger Macs come from separate runs of the same job on 15 and 16 October: 7 on GitHub and 3 on each Build Hub machine. Those are fewer samples, so compare their rows with each other, not with the 17-run numbers. All runs and the raw results are in the repository above.

## Where the minutes go

```chart
{
  "type": "bar",
  "title": "Wikipedia iOS job by phase, median seconds",
  "unit": "s",
  "caption": "Separate runs of the iOS job on 15 and 16 October 2026: GitHub macos-26 7 runs, Build Hub M4 Large 3 runs. Cold, no cache. Source: results/ios-wikipedia-unit-tests.json.",
  "rows": [
    { "label": "Resolve packages", "value": 64, "series": "GitHub M1 3 vCPU" },
    { "label": "Resolve packages", "value": 27, "series": "Build Hub M4 Large" },
    { "label": "Build for testing", "value": 538, "series": "GitHub M1 3 vCPU" },
    { "label": "Build for testing", "value": 145, "series": "Build Hub M4 Large" },
    { "label": "Unit tests", "value": 370, "series": "GitHub M1 3 vCPU" },
    { "label": "Unit tests", "value": 86, "series": "Build Hub M4 Large" }
  ],
  "series": [
    { "name": "GitHub M1 3 vCPU", "color": "#64748b" },
    { "name": "Build Hub M4 Large", "color": "#f59e0b" }
  ]
}
```

| Phase             | GitHub M1, 3 vCPU | Build Hub M4 Large, 5 vCPU | Faster by |
| ----------------- | ----------------- | -------------------------- | --------- |
| Resolve packages  | 64 s              | 27 s                       | 2.4x      |
| Build for testing | 538 s             | 145 s                      | 3.7x      |
| Unit tests        | 370 s             | 86 s                       | 4.3x      |

The build is where most of the minutes are, and it is where most of them were saved: 393 seconds per run. Compiling Swift is CPU work, and the M4 Large has a newer chip and two more cores. The unit tests gained the most in relative terms. They run in the iOS simulator, which needs CPU and memory too, and the M1 runner has 7 GB for Xcode, the simulator and the test host together. We did not measure memory pressure, so that is a possible factor, not a finding.

Package resolution gained least. It downloads the same packages on both sides, and we did not time the network part separately. The phases do not add up to the whole job: checkout, Xcode selection and the other steps take the rest, a median 87 seconds per run on GitHub and 69 seconds on the M4 Large.

## What a run costs

At list price, each job's billed time is rounded up to a whole minute and multiplied by the per-minute price. Build Hub bills per started minute and includes the machine's start-up, which the job's timestamps do not show, so we estimated it from the wait before each job, as in the first article. That is why the M4 Large bills 7 minutes for a 337 second job. Over the 17 pipeline runs per side:

| Side               | Median job time | Billed minutes | Cost per run |
| ------------------ | --------------- | -------------- | ------------ |
| GitHub `macos-26`  | 922 s           | 16             | $0.99        |
| Build Hub M4 Large | 337 s           | 7              | $0.21        |

Two things to keep in mind:

- **On GitHub, public repositories pay nothing** for standard runners. In a private repository, standard macOS minutes come out of your plan's included minutes first; the $0.99 is the price after those are used.
- **Build Hub is sold as a monthly tier.** If you do not use the budget you pay for, the real price per run is higher than $0.21.

A team that runs the iOS job 20 times a day would, at these list prices, spend about $20 a day on GitHub and about $4 on Build Hub, and use about 3 hours less job time. That is total job time, not the time any one person waits: jobs run in parallel, and other jobs may be slower. Check your own run count before you trust that number: rounding makes short jobs cost more than they look.

## Is a bigger Mac worth it?

We ran the same job on the larger Build Hub Macs too.

| Machine                                  | Plan       | Runs | Median job time        | Cost per run              |
| ---------------------------------------- | ---------- | ---- | ---------------------- | ------------------------- |
| GitHub `macos-26`: M1, 3 vCPU, 7 GB      | GitHub     | 7    | 1,026 s (805 to 1,305) | $1.12 (18 billed minutes) |
| Build Hub M4 Large: M4, 5 vCPU, 14 GB    | Self-serve | 3    | 323 s (314 to 335)     | $0.18 (6 billed minutes)  |
| Build Hub M4 XLarge: M4, 10 vCPU, 28 GB  | Self-serve | 3    | 295 s (293 to 301)     | $0.36 (6 billed minutes)  |
| Build Hub M4 Pro XLarge: M4 Pro, 14 vCPU | Enterprise | 3    | 250 s (246 to 251)     | No per-minute list price  |

Twice the cores and twice the memory, from the M4 Large to the M4 XLarge, saved 28 seconds (9%) and doubled the cost per run. For this app, the Large gave most of the gain at half the XLarge's cost per run. The M4 Pro XLarge, with the M4 Pro chip and 14 vCPU, took 73 seconds less than the Large (23%). It is on the Enterprise plan, which Bitrise sells by concurrency and not by minutes, so we cannot give a list price per run for it. Billed minutes for the Build Hub rows include the estimated machine start-up, as above.

Your app may be different. A project with many independent modules can use more cores than the Wikipedia app did. Run your own job three times on each size before you pick one.

## Moving one job

GitHub Actions still runs the workflow: it schedules the job, streams the logs and passes the secrets. The work is in the setup, and the workflow itself changes little.

1. Install the Build Hub GitHub App on the repository, and create a pool in your Bitrise workspace with the machine type and an image that has your Xcode version.
2. Point `runs-on` at the pool's label. Ours was `bitrise-runner-ios-m4-large`.
3. Select the Xcode version in the job, so that both sides use the same one.

Images name the Xcode app differently (`Xcode_26.5.app`, `Xcode-26.5.app` or `Xcode.app`), so our job picks the app by the version it reports, and fails if it is not there:

```yaml
jobs:
  ios-tests:
    runs-on: [bitrise-runner-ios-m4-large] # was: macos-26
    env:
      XCODE_VERSION: '26.5'
    steps:
      - name: Select Xcode
        run: |
          for app in /Applications/Xcode*.app; do
            if [ "$(DEVELOPER_DIR="$app/Contents/Developer" xcodebuild -version 2>/dev/null | head -1)" = "Xcode $XCODE_VERSION" ]; then
              sudo xcode-select -s "$app/Contents/Developer"
              break
            fi
          done
          test "$(xcodebuild -version | head -1)" = "Xcode $XCODE_VERSION"
```

The `xcodebuild` steps did not change at all. Two checks are worth adding before the first real run:

- **The simulator exists.** `xcrun simctl list devices available` should list the device and the iOS version in your `-destination`. If the image lacks the runtime, the job fails, so check it before the first real run.
- **Expect a short wait for a machine.** A self-serve pool starts a machine when a job arrives. Our iOS jobs waited a median 38 seconds before they started, which is not in the job times above.

## What we could not conclude

- **Chip or cores.** The M1 runner has 3 vCPU and the M4 Large has 5. We did not run a 3 vCPU M4, so we cannot say how much of the 2.7x comes from the chip and how much from the cores and the memory. Going from 5 to 10 M4 cores, with twice the memory, saved only 9%, so beyond 5 cores the size did little for this app.
- **Warm builds.** Every run was cold. With a DerivedData or package cache, both sides get faster, and the gap may shrink. We did not measure that.
- **Other apps.** This is one app at one commit. A smaller app saves fewer minutes, and a larger one may save more.
- **GitHub's larger Mac runners.** GitHub also sells larger macOS runners on paid plans. We compared the standard one, which every team gets.

## Summary

Moving the Wikipedia iOS job from GitHub's M1 runner to a Build Hub M4 Large took it from 15.4 to 5.6 minutes and from $0.99 to $0.21 per run at list price, with the same workflow steps. Most of the time came out of the build and the simulator tests. A bigger M4 added little; the M4 Pro XLarge took 23% less time than the M4 Large. If your iOS job is the slowest one in your pipeline, measure it on one larger machine before you change anything else, and keep the Xcode version pinned so the comparison stays fair.

The workflows, the dispatch scripts and every result are in the [benchmark repository](https://github.com/The-DevOps-Daily/gha-runner-benchmark). The setup for Build Hub is in [Bitrise's documentation](https://bitrise.io/platform/build-hub).
