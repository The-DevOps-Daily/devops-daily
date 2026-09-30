---
title: 'GitHub Started Enforcing Self-Hosted Runner Versions. We Tested What Happens'
excerpt: "GitHub started enforcing self-hosted runner versions on September 29. We tried four runner versions against a free github.com organization and asked GitHub's own API about every release. One was refused, one connected and then exited while its job waited in the queue, and the API scheduled every version's end about nine weeks after its successor."
category:
  name: 'CI/CD'
  slug: 'ci-cd'
date: '2026-09-30'
publishedAt: '2026-09-30T09:00:00Z'
updatedAt: '2026-09-30T09:00:00Z'
readingTime: '14 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - CI/CD
  - GitHub Actions
  - Self-Hosted Runners
  - Kubernetes
  - DevOps
---

On September 29, GitHub started enforcing minimum versions for self-hosted Actions runners. The announcement gives one number, 2.329.0, and one rule: install each new runner release within 30 days. Neither tells you what happens to the runner you pinned in a Docker image last spring, or how long you really have before it stops. So we asked GitHub's own API about every runner release and tried to register four real runners, one version each, against a free github.com organization. The expired one did not fail loudly. It registered, connected, logged one error line and exited with code 0, and its job waited in the queue.

This post shows the data, what each runner did, and how to find every runner in your fleet before one of them goes quiet.

## TLDR

- **We saw it on a free github.com organization.** The API reports our test org's plan as `free`, and both the registration check and the job check fired. GitHub says Enterprise Server is not affected.
- **Registration floor:** runner 2.328.0 was refused with "The minimum runner version required to register with GitHub Actions is now 2.329.0."
- **Job floor:** runner 2.335.1 registered fine, then exited with "Runner version v2.335.1 is deprecated and cannot receive messages." The probe job stayed queued.
- **The exit looks clean:** `run.sh` exited with code 0. With `ACTIONS_RUNNER_RETURN_VERSION_DEPRECATED_EXIT_CODE=1` set, the same runner exited with code 7, which a supervisor can see.
- **The scheduled window:** for the 18 versions with a runtime deprecation date and a later release, GitHub's API put the date 62 to 70 whole days after that next release (median 64.5). The documentation says 30.
- **The floor is not a safe version:** 2.329.0, the registration minimum, has an API runtime deprecation date of January 23, 2026, which has passed.
- **On September 30, 2026, only 2.336.0 (date November 5) and 2.337.0 (no date yet) were inside their schedule, and both ran our probe job.**

## Prerequisites

- Self-hosted runners on github.com, on VMs, bare metal, or Kubernetes with Actions Runner Controller (ARC)
- The [GitHub CLI](https://cli.github.com/) (`gh`), logged in as an admin of at least one repository
- For the fleet check: shell access to your runner hosts, or `kubectl` access to the cluster that runs them

## What GitHub announced

The enforcement has a long history, according to GitHub's changelog. GitHub first set the 2.329.0 minimum for March 16, 2026, then [paused it](https://github.blog/changelog/2026-03-13-self-hosted-runner-minimum-version-enforcement-paused/) three days before. In June it published a [new timeline](https://github.blog/changelog/2026-06-12-github-actions-minimum-version-enforcement-timeline-for-self-hosted-runners/): July 31 for Enterprise Cloud with data residency, September 25 for Enterprise Cloud. The last [changelog post](https://github.blog/changelog/2026-09-28-self-hosted-runner-version-enforcement-date-has-moved/) moved that to September 29.

The June post has the part that matters most, and it is easy to miss:

- **2.329.0 is only the registration minimum.** It is the oldest runner the new Actions backend will accept.
- **Running jobs is a moving target.** A runner has to install each new release within 30 days, or "the GitHub Actions service will stop queuing jobs to it."
- **Pinned runners are on their own.** "A runner pinned to `2.329.0` that never updates again will not pick up jobs."

In early September GitHub also shipped a [REST API for runner version deprecations](https://github.blog/changelog/2026-09-03-github-actions-early-september-2026-updates/): `GET /actions/runners/deprecations/{version}` at repository, organization, or enterprise level. It is the source for the numbers below.

## What GitHub's API says about every release

We listed all 146 `actions/runner` release records and asked the repository-level endpoint about each one. Our calls used a `gh` login with the classic `repo` scope for a user who administers the repository. The organization-level endpoint answered 403 for the same token, because it needs the `admin:org` scope or the fine-grained self-hosted runners permission:

```bash
gh api /repos/your-org/your-repo/actions/runners/deprecations/2.335.1
```

```text
{"runner_version":"2.335.1","runtime_deprecates_at":"2026-09-24T15:30:55Z"}
```

Three things came back that the announcement does not say:

1. **The API only knows 19 versions, 2.321.0 to 2.337.0.** Anything older returns 404. So does 2.327.0, which was replaced by 2.327.1 three days later.
2. **No response had a `registration_deprecates_at` field.** The changelog lists it, but every successful response contained only `runner_version` and `runtime_deprecates_at`. The only registration rule we saw is the fixed 2.329.0 floor.
3. **The runtime dates follow a pattern.** For each version, we counted the whole days, rounded down, between the next non-prerelease release and its `runtime_deprecates_at`.

```chart
{
  "type": "bar",
  "title": "Days a runner version keeps running jobs after the next release ships",
  "unit": " days",
  "caption": "runtime_deprecates_at from GitHub's runner version deprecations API, minus the next release's publish date. 18 versions, 2.321.0 to 2.336.0. Swept 2026-09-30. GitHub's documentation says 30 days.",
  "refs": [
    {
      "value": 30,
      "label": "Documented: 30 days"
    }
  ],
  "rows": [
    {
      "label": "2.321.0",
      "value": 66
    },
    {
      "label": "2.322.0",
      "value": 62
    },
    {
      "label": "2.323.0",
      "value": 64
    },
    {
      "label": "2.324.0",
      "value": 63
    },
    {
      "label": "2.325.0",
      "value": 65
    },
    {
      "label": "2.326.0",
      "value": 68
    },
    {
      "label": "2.327.1",
      "value": 63
    },
    {
      "label": "2.328.0",
      "value": 63
    },
    {
      "label": "2.329.0",
      "value": 65
    },
    {
      "label": "2.330.0",
      "value": 63
    },
    {
      "label": "2.331.0",
      "value": 64
    },
    {
      "label": "2.332.0",
      "value": 67
    },
    {
      "label": "2.333.0",
      "value": 63
    },
    {
      "label": "2.333.1",
      "value": 69
    },
    {
      "label": "2.334.0",
      "value": 63
    },
    {
      "label": "2.335.0",
      "value": 66
    },
    {
      "label": "2.335.1",
      "value": 65
    },
    {
      "label": "2.336.0",
      "value": 70
    }
  ]
}
```

For every one of the 18 versions, the scheduled date fell 62 to 70 days after its successor was published. That is about nine weeks, twice the 30 days in the documentation. We do not know why. The dates may include a rollout delay, or a buffer GitHub keeps for itself.

One test lines up with the API rather than the 30 days. Thirty days after 2.337.0 was published was September 25. On September 30, a 2.336.0 runner still registered and completed our probe job, and its API date is November 5. That is one observation on one day, not a promise of extra time.

Counted from its own release date, a version's scheduled life is 66 to 138 days (median 104). Here is where recent versions stood on September 30, 2026:

| Version | Released   | API runtime deprecation date |
| ------- | ---------- | ---------------------------- |
| 2.337.0 | 2026-08-26 | no end date yet (newest)     |
| 2.336.0 | 2026-07-20 | 2026-11-05                   |
| 2.335.1 | 2026-06-09 | 2026-09-24 (ended)           |
| 2.334.0 | 2026-04-21 | 2026-08-10 (ended)           |
| 2.329.0 | 2025-10-14 | 2026-01-23 (ended)           |

:::warning
The registration minimum is not a safe version. 2.329.0 meets the registration floor, but its API runtime deprecation date, January 23, 2026, passed eight months before enforcement started. We did not test 2.329.0 itself. The one version we tested that was past its date, 2.335.1, registered and then exited, as shown below.
:::

## What a real runner does

API dates are a schedule, not behavior. To see the behavior, we tried to register one runner per version to a private repository in a free organization, with auto-update turned off (`--disableupdate`) so each runner stayed on its version. Each runner that registered then got a single `workflow_dispatch` job. The [script](https://github.com/The-DevOps-Daily/runner-version-window/blob/main/scripts/floor-test.sh) downloads the runner, registers it, starts it, dispatches the job, polls the run for about three minutes, and removes the runner. All output below is from runs on September 30, 2026, between 06:54 and 07:34 UTC, on a linux-arm64 host. An earlier pass of the same four tests that morning, with a first version of the script, gave the same four results; both sets of transcripts are in the repo.

**Below the registration floor, 2.328.0.** The runner is refused before it exists:

```terminal
{
  "title": "runner 2.328.0",
  "prompt": "$",
  "steps": [
    {
      "cmd": "REPO=The-DevOps-Daily/runner-floor-lab scripts/floor-test.sh 2.328.0",
      "output": "07:16:15Z runner 2.328.0 (arm64), label floor-2-328-0-1790752575\n07:20:30Z config.sh --disableupdate\n  \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n  \u2502   RUNNER UPDATE REQUIRED                                                                                            \u2502\n  \u251c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524\n  \u2502                                                                                                                     \u2502\n  \u2502   The minimum runner version required to register with GitHub Actions is now 2.329.0.                               \u2502\n  \u2502   Please upgrade your runner.                                                                                       \u2502\n  \u2502                                                                                                                     \u2502\n  \u2502   For more information, see:                                                                                        \u2502\n  \u2502   https://github.blog/changelog/2026-02-05-github-actions-self-hosted-runner-minimum-version-enforcement-extended   \u2502\n  \u2502                                                                                                                     \u2502\n  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518\n  Response status code does not indicate success: 404 (Not Found).\n07:20:34Z config.sh exit code: 1\n07:20:34Z result: not registered"
    }
  ]
}
```

This is the loud failure, and the easy one. A deploy pipeline that builds runner VMs from an old image fails at `config.sh`, and someone notices.

**Registered, but past its end date, 2.335.1.** This is the one to worry about. Registration works, the runner connects, and then:

```terminal
{
  "title": "runner 2.335.1",
  "prompt": "$",
  "steps": [
    {
      "comment": "the ASCII registration banner is trimmed from the output"
    },
    {
      "cmd": "REPO=The-DevOps-Daily/runner-floor-lab scripts/floor-test.sh 2.335.1",
      "output": "07:06:37Z runner 2.335.1 (arm64), label floor-2-335-1-1790751997\n07:10:50Z config.sh --disableupdate\n  # Authentication\n  \u221a Connected to GitHub\n  # Runner Registration\n  \u221a Runner successfully added\n  # Runner settings\n  \u221a Settings Saved.\n07:10:57Z config.sh exit code: 0\n07:10:57Z run.sh\n  runner status: offline, busy: false\n07:11:34Z dispatched run 36682287765, polling for up to 180s\n07:14:51Z run status after 197s: queued \n07:14:51Z runner process exited with code 0\n07:14:51Z runner output (last lines):\n  \n  \u221a Connected to GitHub\n  \n  Current runner version: '2.335.1'\n  2026-09-30 07:11:04Z: Listening for Jobs\n  An error occurred: Runner version v2.335.1 is deprecated and cannot receive messages.\n  Runner listener exit with terminated error, stop the service, no retry needed.\n  Exiting runner...\n07:15:09Z cancelled run 36682287765"
    }
  ]
}
```

Look at the order. "Runner successfully added" and "Connected to GitHub" both succeed. The runner even reports "Listening for Jobs". Then it logs one error and stops, and the process exits with code 0, the same code as a clean shutdown. The job is not rejected either. It was still queued when the script stopped polling after 197 seconds, and the script cancelled it. We did not measure how long GitHub would keep it queued.

**The same runner, with the exit code turned on.** Exit code 0 does not tell anything that checks exit status that the runner failed. The runner has a setting for this. With `ACTIONS_RUNNER_RETURN_VERSION_DEPRECATED_EXIT_CODE=1` in its environment, `run.sh` exits with code 7 instead of 0 when the version is deprecated. By the runner's source and [pull request #4285](https://github.com/actions/runner/pull/4285), the setting first shipped in 2.333.0. We tested it on 2.335.1:

```terminal
{
  "title": "runner 2.335.1, deprecated exit code on",
  "prompt": "$",
  "steps": [
    {
      "comment": "the ASCII registration banner is trimmed from the output"
    },
    {
      "cmd": "ACTIONS_RUNNER_RETURN_VERSION_DEPRECATED_EXIT_CODE=1 REPO=The-DevOps-Daily/runner-floor-lab scripts/floor-test.sh 2.335.1",
      "output": "07:25:07Z runner 2.335.1 (arm64), label floor-2-335-1-1790753107\n07:29:19Z config.sh --disableupdate\n  # Authentication\n  \u221a Connected to GitHub\n  # Runner Registration\n  \u221a Runner successfully added\n  # Runner settings\n  \u221a Settings Saved.\n07:29:29Z config.sh exit code: 0\n07:29:29Z run.sh (ACTIONS_RUNNER_RETURN_VERSION_DEPRECATED_EXIT_CODE=1)\n  runner status: offline, busy: false\n07:30:04Z dispatched run 36684028728, polling for up to 180s\n07:33:17Z run status after 185s: queued \n07:33:17Z runner process exited with code 7\n07:33:17Z runner output (last lines):\n  \n  \u221a Connected to GitHub\n  \n  Current runner version: '2.335.1'\n  2026-09-30 07:29:37Z: Listening for Jobs\n  An error occurred: Runner version v2.335.1 is deprecated and cannot receive messages.\n  Runner listener exit with deprecated version exit code: 7.\n  Exiting runner...\n07:33:18Z cancelled run 36684028728"
    }
  ]
}
```

Same error, and the new probe job stayed queued too, but now the process exits with a failure code. A supervisor that checks exit status can act on that. By default, systemd treats a non-zero exit as a failed service, and Kubernetes records the container's termination reason as `Error` instead of `Completed`. We did not run either of them. We set the variable in the shell that started `run.sh`, which is the only way we tested it.

**Inside the window, 2.336.0 and 2.337.0.** Both registered, picked up the job within seconds, and finished it:

```terminal
{
  "title": "runner 2.336.0",
  "prompt": "$",
  "steps": [
    {
      "comment": "the ASCII registration banner is trimmed from the output"
    },
    {
      "cmd": "REPO=The-DevOps-Daily/runner-floor-lab scripts/floor-test.sh 2.336.0",
      "output": "07:01:11Z runner 2.336.0 (arm64), label floor-2-336-0-1790751671\n07:05:26Z config.sh --disableupdate\n  # Authentication\n  \u221a Connected to GitHub\n  # Runner Registration\n  \u221a Runner successfully added\n  # Runner settings\n  \u221a Settings Saved.\n07:05:41Z config.sh exit code: 0\n07:05:41Z run.sh\n  runner status: online, busy: false\n07:06:11Z dispatched run 36681802539, polling for up to 180s\n07:06:29Z run status after 18s: completed success\n07:06:29Z runner process: still running\n07:06:29Z runner output (last lines):\n  \n  \u221a Connected to GitHub\n  \n  Current runner version: '2.336.0'\n  2026-09-30 07:05:46Z: Listening for Jobs\n  2026-09-30 07:06:14Z: Running job: probe\n  2026-09-30 07:06:24Z: Job probe completed with result: Succeeded"
    }
  ]
}
```

By the API's schedule, 2.336.0 stops receiving jobs on November 5, 2026, unless it updates first.

## Why this breaks quietly in practice

Runners with auto-update on should mostly follow the schedule by themselves: the runner updates when a new release is out. The risk is in setups where the runner stays on one version because it cannot or may not update:

- **Container images.** A Dockerfile with `ARG RUNNER_VERSION=2.334.0` builds the same runner every time. If those runners do not update themselves, each new one starts on the old version and would behave like the 2.335.1 runner above once its date passes.
- **Actions Runner Controller.** ARC scale sets start runners from an image such as `ghcr.io/actions/actions-runner:2.335.1`, so the image tag tells you which version each new pod starts with.
- **VM templates and golden images.** An AMI or a Packer template built in the spring holds a spring runner. A VM from it starts on that version.
- **`--disableupdate` in install scripts.** Teams add it so runners do not change during a release window, then forget about them.

In our test the only clear message was in the runner's own output. The workflow run just showed "Queued".

## Find every runner version you run

Start with the versions, then check them against the API. On a VM or bare-metal host, ask each installed runner directly. The runner binary prints its version:

```bash
# Run in each runner's install directory, for example /home/runner/actions-runner
./config.sh --version
# or: ./bin/Runner.Listener --version
```

On a fresh 2.337.0 download, both print `2.337.0`. Loop over every install directory you have. A host with several runners has several versions.

On Kubernetes, list the runner images that pods run:

```bash
# Distinct runner image references, including tags such as :latest and digests
kubectl get pods -A -o jsonpath='{..image}' | tr ' ' '\n' | grep -i 'actions-runner' | sort -u
```

A version tag like `:2.335.1` tells you the version each new pod starts with. A tag like `:latest` or a digest does not; resolve those before you check them. Treat both commands as a starting point, not a complete inventory.

Also check the places that build runners, not only the ones that run them: `RUNNER_VERSION` in Dockerfiles, Packer variables, Terraform user-data, and Helm values.

Then feed the versions to the [check script](https://github.com/The-DevOps-Daily/runner-version-window/blob/main/scripts/check-versions.sh). It calls the deprecations API for each version and prints the days left. It needs bash, python3 and `gh`, and it exits non-zero on bad input or an API error, so a broken check never reads as a pass:

```terminal
{
  "title": "check-versions",
  "prompt": "$",
  "steps": [
    {
      "cmd": "printf \"2.337.0\\nv2.336.0\\n2.335.1\\n2.329.0\\n2.320.0\\n\" | REPO=your-org/your-repo scripts/check-versions.sh",
      "output": "VERSION    ENDS         STATUS\n2.337.0    -            no runtime deprecation date announced\n2.336.0    2026-11-05   36 days left\n2.335.1    2026-09-24   ended 5 days ago: stops taking jobs\n2.329.0    2026-01-23   ended 249 days ago: stops taking jobs\n2.320.0    -            unknown to the API (it knows 2.321.0 and later): replace it"
    }
  ]
}
```

Anything that says "ended" is past its API date. In our test, the one such version we ran did not take jobs. Anything under three weeks needs a new image now.

```github
https://github.com/The-DevOps-Daily/runner-version-window
```

## How to keep runners inside the window

**Leave auto-update on for long-lived runners.** It is the default. A runner that updates itself follows the schedule without anyone thinking about it. If you must control when runners change, schedule the update instead of disabling it.

**Update the pinned version on every runner release.** For images and templates, treat each `actions/runner` release as a change to make. Configure your dependency bot to bump the actual runner version or image reference, and check that it really opens those pull requests. Rebuilding an image that still pins the old version does not upgrade anything. Plan around GitHub's documented 30 days; the extra weeks we saw in the API are not a promise.

**Alert on the date, not on the symptom.** Run the check in CI on a schedule and fail when a version in use has less than 21 days left:

```yaml
name: runner-version-check
on:
  schedule:
    - cron: '0 7 * * 1' # every Monday
  workflow_dispatch:

jobs:
  check:
    runs-on: ubuntu-latest # a GitHub-hosted runner, so the check never depends on the runners it checks
    steps:
      - uses: actions/checkout@v4
      - name: Fail if a runner version has less than 21 days left
        shell: bash
        env:
          # A token that administers REPO. The default GITHUB_TOKEN cannot call the deprecations API.
          GH_TOKEN: ${{ secrets.RUNNER_AUDIT_TOKEN }}
          REPO: ${{ github.repository }}
        run: |
          set -euo pipefail
          # Copy scripts/check-versions.sh from the companion repo into yours.
          # runner-versions.txt lists the versions your images and hosts use, one per line.
          scripts/check-versions.sh < runner-versions.txt | tee report.txt
          if grep -E 'ended|unknown|^[0-9.]+ +[0-9-]+ +([0-9]|1[0-9]|20) days left' report.txt; then
            exit 1
          elif [ $? -ne 1 ]; then
            exit 2 # grep itself failed
          fi
```

**Make an expired runner fail loudly.** Where a container or unit starts `run.sh`, set `ACTIONS_RUNNER_RETURN_VERSION_DEPRECATED_EXIT_CODE=1` in its environment, as in the test above, and alert on exit code 7:

```yaml
# Part of a pod spec for a runner container whose command is run.sh
env:
  - name: ACTIONS_RUNNER_RETURN_VERSION_DEPRECATED_EXIT_CODE
    value: '1'
```

One warning, from reading the runner source, not from a test: the `svc.sh` service does not use `run.sh`. Its wrapper, [`bin/RunnerService.js`](https://github.com/actions/runner/blob/v2.337.0/src/Misc/layoutbin/RunnerService.js), has no case for code 7 in 2.335.1 or 2.337.0. It treats an unknown code as a failure and starts the listener again after 5 seconds. It only gives up if `GITHUB_ACTIONS_SERVICE_EXIT_AFTER_N_FAILURES` is set to a positive number and that many unknown exits happen in a row. On hosts that use `svc.sh`, rely on the version check instead.

**Watch for queued jobs.** A job that sits in "Queued" for more than a few minutes on a self-hosted label is worth an alert of its own. It catches this failure and every other reason runners stop, such as capacity, networking, or a broken image.

**Plan for the documented rule, not the measurement.** The API scheduled every version about 64 days after its successor. The documentation says 30. Build to the documented number, and treat any extra weeks as slack you did not count on. The schedule is GitHub's to change.

## What we could not test

- **Enterprise Cloud and data residency.** We tested one free organization. The changelog names Enterprise Cloud, but we did not run a runner there.
- **Supervisors.** We started `run.sh` directly. We did not test how a systemd service, the runner's `svc.sh` wrapper, or ARC reacts to exit code 0 or 7. The `svc.sh` behavior above comes from the source code.
- **Every version.** We ran four versions. We did not test 2.329.0 itself or any other expired version besides 2.335.1.
- **GitHub Enterprise Server.** GitHub says it is not affected, and we did not test it.
- **How the dates are set.** The 62 to 70 day pattern comes from one snapshot of 18 versions. It is a measurement, not a published rule, and it can change.
- **Time.** All of this is one day of data: September 30, 2026, the day after enforcement started.

## Summary

The registration minimum and the runtime rule answer different questions, and GitHub's June changelog says so. 2.329.0 only decides whether a runner can register, and that failure is loud. The rule to plan around is the moving one: each version stops receiving jobs some time after the next release, 30 days by the documentation and about 64 days in the API's current schedule. In our test, the runner past its date registered, connected, logged one error and exited with code 0, while its job waited in the queue. In our direct `run.sh` test, one environment variable changed that to exit code 7.

Find the versions your hosts, images, and scale sets run. Check them against the deprecations API. Rebuild pinned images on every runner release, and alert on the end date before the queue tells you.
