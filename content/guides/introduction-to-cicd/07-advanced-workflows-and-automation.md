---
title: 'Matrix Builds, Reusable Workflows and Merge Queues'
description: 'Scale GitHub Actions: an OS and version matrix, composite actions, reusable workflows, one required check, a merge queue and the new parallel steps.'
order: 7
---

The pipeline now works, but it has grown the way pipelines do: the deploy workflow builds the site with its own copy of the CI steps, the same three setup steps appear in every job, and tests run only on Linux. In this part you fix all three. You test on Linux, Windows and macOS, including an arm64 Linux runner, move the shared setup into a **composite action**, turn CI into a **reusable workflow** that the deploy workflow calls, give branch rules one stable check to require, and merge pull requests through a **merge queue**. At the end you try **parallel steps**, which GitHub added in June 2026.

## Prerequisites

- The repository from [Part 6](/guides/introduction-to-cicd/06-deployment-strategies-and-environments).
- For the merge queue: a public repository owned by an organization, or a private one in an organization on GitHub Enterprise Cloud.

## A Composite Action for Shared Steps

Every job ran the same three steps: set up Node.js, restore the cache, `npm ci`. A **composite action** bundles steps under one name. It lives in a directory with an `action.yml`:

```yaml
name: Set up the app
description: Install Node.js with the npm cache, then install the dependencies with npm ci

inputs:
  node-version:
    description: The Node.js version to install
    default: '24'

runs:
  using: composite
  steps:
    - uses: actions/setup-node@v7
      with:
        node-version: ${{ inputs.node-version }}
        cache: npm
    - name: Install the dependencies
      run: npm ci
      shell: bash
```

A job uses it after the checkout with `uses: ./.github/actions/setup-app`. Inputs work like the inputs of any action; here `node-version` defaults to `'24'`. In a composite action, every `run:` step must name its `shell`.

The `./` path points into the job's workspace, so it only works after `actions/checkout`, and it runs whatever version of the action is in the workspace. Since [July 2026](https://github.blog/changelog/2026-07-30-reference-same-repository-actions-with-self-repository-syntax/), GitHub recommends `$/.github/actions/setup-app` instead: `$/` resolves to the repository at the exact commit that is running, with no checkout needed. zizmor already suggests it. actionlint 1.7.12, the newest release in October 2026, does not know the syntax yet:

```yaml
name: CI

on:
  pull_request:

permissions:
  contents: read

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: $/.github/actions/setup-app
      - run: npm run lint
```

```terminal
{
  "title": "actionlint and $/",
  "prompt": "$",
  "steps": [
    {
      "cmd": "actionlint",
      "output": ".github/workflows/ci.yml:16:15: specifying action \"$/.github/actions/setup-app\" in invalid format because ref is missing. available formats are \"{owner}/{repo}@{ref}\" or \"{owner}/{repo}/{path}@{ref}\" [action]\n   |\n16 |       - uses: $/.github/actions/setup-app\n   |               ^~~~~~~~~~~~~~~~~~~~~~~~~~~"
    }
  ]
}
```

This guide keeps `./`, which is safe here because every job checks out the same commit that the workflow runs from. Switch to `$/` once your linters accept it.

## CI as a Reusable Workflow

The deploy workflow from Part 6 built and tested the site with its own steps, so CI and deployment could drift apart. A **reusable workflow** is a whole workflow that another workflow calls as a job, with `on: workflow_call`. Here is the new `ci.yml`. It runs for pull requests and merge queue groups, and when the deploy workflow calls it:

```yaml
name: CI

on:
  pull_request:
  merge_group:
  workflow_call:

permissions:
  contents: read

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

jobs:
  lint:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: ./.github/actions/setup-app
      - run: npm run lint

  test:
    runs-on: ${{ matrix.os }}
    timeout-minutes: 15
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        node: [22, 24, 26]
        include:
          - os: ubuntu-24.04-arm
            node: 24
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: ./.github/actions/setup-app
        with:
          node-version: ${{ matrix.node }}
      - name: Run the tests and write a JUnit report
        run: >-
          npm test --
          --test-reporter=spec --test-reporter-destination=stdout
          --test-reporter=junit --test-reporter-destination=test-results.xml
      - name: Upload the test report
        if: ${{ !cancelled() }}
        uses: actions/upload-artifact@v7
        with:
          name: test-results-${{ matrix.os }}-node-${{ matrix.node }}
          path: test-results.xml
          retention-days: 7

  build:
    needs: [lint, test]
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: ./.github/actions/setup-app
      - run: npm run build
        env:
          SITE_TITLE: ${{ vars.SITE_TITLE }}
      - name: Upload the site
        uses: actions/upload-artifact@v7
        with:
          name: site
          path: dist/
          retention-days: 14
          if-no-files-found: error

  # One stable check name for branch rulesets, whatever the matrix contains
  all-checks:
    if: ${{ always() }}
    needs: [lint, test, build]
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Fail if a needed job failed or was cancelled
        if: ${{ contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled') }}
        run: exit 1
      - run: echo "All CI jobs passed"
```

What is new:

- **`on: workflow_call`** makes the file callable. It no longer runs on `push`, because the deploy workflow calls it for every push to `main`; otherwise CI would run twice there.
- **`merge_group`** runs CI for the merge queue (below).
- **The OS matrix.** `os: [ubuntu-latest, windows-latest, macos-latest]` times `node: [22, 24, 26]` gives nine combinations, and `include` adds a tenth, Node.js 24 on an arm64 Linux runner. `exclude` would remove combinations. `runs-on: ${{ matrix.os }}` picks the runner per job.
- **`concurrency` for pull requests.** The group is the workflow plus the ref, so each pull request has its own group. `cancel-in-progress` is an expression: true for pull requests, so a new push cancels the outdated run, and false otherwise, so a run that the deploy workflow started is never canceled. Inside a called workflow, `github.workflow` and `github.event_name` are the caller's, so the group is `ci-Deploy-refs/heads/main` there.
- **`all-checks`**, explained below.

And the deploy workflow calls it, packages the site that CI built, and deploys that:

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

# One deployment at a time; a newer run waits instead of cancelling a deployment
concurrency:
  group: pages-production
  cancel-in-progress: false

jobs:
  ci:
    uses: ./.github/workflows/ci.yml

  # Package once, so re-running the deploy job (a rollback) reuses this artifact
  package:
    needs: ci
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Download the site built by CI
        uses: actions/download-artifact@v8
        with:
          name: site
          path: site
      - name: Package the site for GitHub Pages
        uses: actions/upload-pages-artifact@v5
        with:
          path: site/
          retention-days: 14

  deploy:
    needs: package
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    outputs:
      page_url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v5

  smoke-test:
    needs: deploy
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Check that the new version is live
        env:
          PAGE_URL: ${{ needs.deploy.outputs.page_url }}
        run: |
          for attempt in 1 2 3 4 5 6; do
            live=$(curl -sSf "${PAGE_URL}version.json?run=$GITHUB_RUN_ID" | jq -r .commit) || live=""
            echo "Attempt $attempt: live commit ${live:-none}, expected $GITHUB_SHA"
            if [ "$live" = "$GITHUB_SHA" ]; then
              exit 0
            fi
            sleep 10
          done
          echo "::error::The site does not serve commit $GITHUB_SHA"
          exit 1
```

`uses: ./.github/workflows/ci.yml` at the job level calls the workflow. (The `smoke-test` job is the one from Part 6; Part 10 shows its final, fixed version.) The called workflow's jobs appear in the run as `ci / lint`, `ci / test (...)` and `ci / build`, and their artifacts belong to the same run, so `package` can download `site`. A separate `package` job keeps the `deploy` job re-runnable, as Part 6 showed.

This run is from a later commit, so its CI already has the two additions from Part 8 (a job summary and `all-checks` on the `ubuntu-slim` runner), but the structure is the one above:

```terminal
{
  "title": "the deploy run",
  "prompt": "$",
  "steps": [
    {
      "cmd": "gh run view 40065982801 --attempt 1",
      "output": "✓ main Deploy · 40065982801 (Attempt #1)\nTriggered via push about 24 minutes ago\n\nJOBS\n✓ ci / lint in 7s (ID 120789220386)\n✓ ci / test (macos-latest, 24) in 21s (ID 120789220586)\n✓ ci / test (windows-latest, 22) in 29s (ID 120789220592)\n✓ ci / test (ubuntu-latest, 26) in 16s (ID 120789220593)\n✓ ci / test (windows-latest, 24) in 24s (ID 120789220602)\n✓ ci / test (ubuntu-latest, 24) in 11s (ID 120789220610)\n✓ ci / test (ubuntu-24.04-arm, 24) in 9s (ID 120789220612)\n✓ ci / test (windows-latest, 26) in 31s (ID 120789220626)\n✓ ci / test (ubuntu-latest, 22) in 11s (ID 120789220645)\n✓ ci / test (macos-latest, 22) in 11s (ID 120789220646)\n✓ ci / test (macos-latest, 26) in 18s (ID 120789220666)\n✓ ci / build in 15s (ID 120789326949)\n✓ ci / all-checks in 2s (ID 120789383785)\n✓ package in 7s (ID 120789402221)\n✓ deploy in 9s (ID 120789437147)\n✓ smoke-test in 4s (ID 120789507532)\n\nANNOTATIONS\n- \"The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026. For more information, see https://github.com/actions/runner-images/issues/14748\"\nci / lint: .github#1\n\n- Due to capacity constraints, jobs targeting macOS arm64 runners may experience longer queue times.\nci / test (macos-latest, 24): .github#1\n\n- \"The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026. For more information, see https://github.com/actions/runner-images/issues/14748\"\nci / test (ubuntu-latest, 26): .github#1\n\n- \"The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026. For more information, see https://github.com/actions/runner-images/issues/14748\"\nci / test (ubuntu-latest, 24): .github#1\n\n- \"The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026. For more information, see https://github.com/actions/runner-images/issues/14748\"\nci / test (ubuntu-latest, 22): .github#1\n\n- Due to capacity constraints, jobs targeting macOS arm64 runners may experience longer queue times.\nci / test (macos-latest, 22): .github#1\n\n- Due to capacity constraints, jobs targeting macOS arm64 runners may experience longer queue times.\nci / test (macos-latest, 26): .github#1\n\n- \"The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026. For more information, see https://github.com/actions/runner-images/issues/14748\"\nci / build: .github#1\n\n- \"The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026. For more information, see https://github.com/actions/runner-images/issues/14748\"\npackage: .github#1\n\n- \"The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026. For more information, see https://github.com/actions/runner-images/issues/14748\"\ndeploy: .github#1\n\n- \"The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026. For more information, see https://github.com/actions/runner-images/issues/14748\"\nsmoke-test: .github#1\n\n\nARTIFACTS\ntest-results-ubuntu-latest-node-22\ntest-results-ubuntu-latest-node-26\ntest-results-ubuntu-latest-node-24\ntest-results-macos-latest-node-22\ntest-results-windows-latest-node-26\ntest-results-macos-latest-node-24\ntest-results-macos-latest-node-26\ntest-results-windows-latest-node-22\nsite\ntest-results-ubuntu-24.04-arm-node-24\ngithub-pages\ntest-results-windows-latest-node-24\n\nFor more information about a job, try: gh run view --job=<job-id>\nView this run on GitHub: https://github.com/The-DevOps-Daily/guide-cicd-demo-2026-10-24/actions/runs/40065982801/attempts/1"
    }
  ]
}
```

Things to know about reusable workflows:

- **Inputs, secrets and outputs.** `on.workflow_call` can declare `inputs` of type `string`, `number` or `boolean` (there is no `choice` or `environment` type here; pass an environment name as a string), `secrets`, and `outputs` that map to job outputs. The caller passes them with `with:` and `secrets:`; `secrets: inherit` passes all of the caller's secrets.
- **Permissions.** A called workflow can only keep or reduce the `GITHUB_TOKEN` permissions of the calling job, never add to them.
- **From other repositories.** `uses: my-org/pipelines/.github/workflows/node-ci.yml@<sha>` calls a workflow from another repository; pin it like an action.
- **Limits.** Since [November 2025](https://github.blog/changelog/2025-11-06-new-releases-for-github-actions-november-2025/), reusable workflows can be nested up to 10 levels, and one run can call up to 50 of them (previously 4 and 20).

Which tool for which job:

|                           | Composite action                | Reusable workflow                    |
| ------------------------- | ------------------------------- | ------------------------------------ |
| Replaces                  | A few steps inside a job        | Whole jobs, with their own runners   |
| Called with               | `uses:` in a step               | `uses:` at the job level             |
| Can choose runners        | No, it runs in the caller's job | Yes, every job has its own `runs-on` |
| Secrets                   | Passed as inputs                | `secrets:` or `secrets: inherit`     |
| Environments, concurrency | No                              | Yes                                  |
| Logs                      | One step in the caller's log    | Separate jobs in the run             |

Use a composite action for "how we set up Node.js", and a reusable workflow for "how we run CI".

## Ten Jobs on Four Kinds of Runner

The matrix ran on three operating systems and four kinds of runner. The "Set up job" log of each job names the image it got:

```terminal
{
  "title": "the images",
  "prompt": "$",
  "steps": [
    {
      "cmd": "gh run view 40064406826 --log | grep -E 'Image: |^[^\\t]*\\t[^\\t]*\\t[^ ]+ (macOS|Microsoft Windows|Ubuntu)$' | cut -f1,3 | sort -u",
      "output": "ci / build\t2026-10-24T04:58:43.2493742Z Image: ubuntu-24.04\nci / lint\t2026-10-24T04:58:08.9045123Z Image: ubuntu-24.04\nci / test (macos-latest, 22)\t2026-10-24T04:58:08.8170770Z Image: macos-26-arm64\nci / test (macos-latest, 24)\t2026-10-24T04:58:07.4041980Z Image: macos-26-arm64\nci / test (macos-latest, 26)\t2026-10-24T04:58:08.9527330Z Image: macos-26-arm64\nci / test (ubuntu-24.04-arm, 24)\t2026-10-24T04:58:11.1206499Z Image: ubuntu-24.04-arm\nci / test (ubuntu-latest, 22)\t2026-10-24T04:58:09.2270681Z Image: ubuntu-24.04\nci / test (ubuntu-latest, 24)\t2026-10-24T04:58:08.9918197Z Image: ubuntu-24.04\nci / test (ubuntu-latest, 26)\t2026-10-24T04:58:08.8448232Z Image: ubuntu-24.04\nci / test (windows-latest, 22)\t2026-10-24T04:58:08.5763490Z Image: windows-2025-vs2026\nci / test (windows-latest, 24)\t2026-10-24T04:58:08.7206322Z Image: windows-2025-vs2026\nci / test (windows-latest, 26)\t2026-10-24T04:58:08.8223767Z Image: windows-2025-vs2026\ndeploy\t2026-10-24T04:59:15.6116804Z Image: ubuntu-24.04\nsmoke-test\t2026-10-24T04:59:31.5903829Z Image: ubuntu-24.04"
    }
  ]
}
```

`windows-latest` is Windows Server 2025 with Visual Studio 2026, and `macos-latest` is macOS 26 on Apple silicon. The same test job took very different times:

```chart
{
  "type": "bar",
  "title": "The same test job (Node.js 24) on four runners",
  "unit": "s",
  "caption": "Job duration from start to finish, one run of the companion repository's CI matrix on 24 October 2026 (gh api .../actions/runs/40064406826/jobs). Single run; times vary between runs.",
  "rows": [
    { "label": "ubuntu-latest", "value": 11, "series": "Linux" },
    { "label": "ubuntu-24.04-arm", "value": 10, "series": "Linux" },
    { "label": "macos-latest", "value": 10, "series": "macOS" },
    { "label": "windows-latest", "value": 30, "series": "Windows" }
  ],
  "series": [
    { "name": "Linux", "color": "#f59e0b" },
    { "name": "macOS", "color": "#94a3b8" },
    { "name": "Windows", "color": "#0080ff" }
  ]
}
```

Windows is slowest. The step times in the jobs API show where: the checkout took 7 seconds instead of 1, and the setup action (Node.js, the cache and `npm ci`) took 15 seconds instead of 4; the tests themselves took about a second everywhere. The `build` job waits for the slowest matrix job, so Windows sets the pace of the whole pipeline. In this public repository all of it was free. In a private repository, each job is billed in whole minutes at its runner's price, and a macOS minute costs about ten times a Linux x64 minute and more than twelve times a Linux arm64 minute:

```chart
{
  "type": "bar",
  "title": "Price per minute of standard runners in private repositories",
  "unit": "$",
  "caption": "GitHub's runner price list, docs.github.com/en/billing/reference/actions-runner-pricing, October 2026. Standard runners are free in public repositories. Each job is rounded up to whole minutes.",
  "rows": [
    { "label": "Linux 2-core arm64", "value": 0.005, "series": "Linux" },
    { "label": "Linux 2-core x64", "value": 0.006, "series": "Linux" },
    { "label": "Windows 2-core", "value": 0.01, "series": "Windows" },
    { "label": "macOS", "value": 0.062, "series": "macOS" }
  ],
  "series": [
    { "name": "Linux", "color": "#f59e0b" },
    { "name": "Windows", "color": "#0080ff" },
    { "name": "macOS", "color": "#94a3b8" }
  ]
}
```

So test every operating system your users have, but not every combination: for a private repository, the full Node.js matrix on Linux plus one Node.js version on Windows and macOS is often enough. `max-parallel` limits how many matrix jobs run at once, and `exclude` drops combinations.

A matrix can also come from data. One job writes a JSON list to its outputs, and the matrix reads it with `fromJSON`, for example to run one test job per package of a monorepo without listing the packages by hand:

```yaml
name: Packages

on:
  pull_request:

permissions:
  contents: read

jobs:
  list:
    runs-on: ubuntu-latest
    outputs:
      packages: ${{ steps.find.outputs.packages }}
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - id: find
        run: |
          packages=$(find packages -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | jq -R . | jq -cs .)
          echo "packages=$packages" >> "$GITHUB_OUTPUT"

  test:
    needs: list
    runs-on: ubuntu-latest
    strategy:
      matrix:
        package: ${{ fromJSON(needs.list.outputs.packages) }}
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test --workspace "packages/$PACKAGE"
        env:
          PACKAGE: ${{ matrix.package }}
```

A matrix can have at most 256 jobs per workflow run.

## One Required Check: all-checks

To block merges until CI passes, you add **required status checks** to a branch ruleset. But a matrix creates ten check names that change whenever the matrix changes, and there is a trap: a job that is **skipped** counts as passed. If `lint` fails, `build` is skipped, and a ruleset that requires only `build` lets the pull request merge.

The `all-checks` job at the end of `ci.yml` solves both. It `needs` every other job, runs with `if: always()`, and fails when any of them failed or was canceled. Require only `all-checks`. Part 8 shows it catching a failure.

## A Merge Queue

For a pull request, CI tests a temporary merge of the pull request into `main` as `main` was when the checks ran. When `main` moves on, those results go stale: two pull requests can each pass on their own and still break `main` once both are merged. A **merge queue** fixes that: when you merge, GitHub puts the pull request in a queue, creates a temporary branch with the latest `main` plus the queued changes, runs the required checks on that branch, and merges only if they pass.

To set it up:

1. Make sure every workflow that provides a required check also has the `merge_group` trigger, as `ci.yml` does. Otherwise the check never reports in the queue and the queue waits until it times out.
2. In **Settings > Rules > Rulesets**, create a branch ruleset for the default branch with **Require a pull request before merging**, **Require status checks to pass** (with `all-checks`) and **Require merge queue**. The companion repository uses squash merges, groups of up to five pull requests and a 30-minute timeout. Add a bypass for administrators only if you need direct pushes.
3. Allow auto-merge in **Settings > General**. The GitHub CLI's `gh pr merge` needs it to add a pull request to the queue, as the first attempt below shows.

Then merge as usual. This pull request adds one command to the cheatsheet:

```terminal
{
  "title": "through the merge queue",
  "prompt": "$",
  "steps": [
    {
      "cmd": "gh pr create --fill --base main",
      "output": "https://github.com/The-DevOps-Daily/guide-cicd-demo-2026-10-24/pull/1"
    },
    {
      "comment": "the pull_request checks; all 13 passed",
      "cmd": "gh pr checks 1",
      "output": "All checks were successful\n0 cancelled, 0 failing, 13 successful, 0 skipped, and 0 pending checks\n\n   NAME                                        DESCRIPTION  ELAPSED  URL\n✓  CI/all-checks (pull_request)                             4s       https://github.com/The-DevOps-Daily/gu...\n✓  CI/build (pull_request)                                  8s       https://github.com/The-DevOps-Daily/gu...\n✓  CI/lint (pull_request)                                   10s      https://github.com/The-DevOps-Daily/gu...\n✓  CI/test (macos-latest, 22) (pull_request)                17s      https://github.com/The-DevOps-Daily/gu...\n✓  CI/test (macos-latest, 24) (pull_request)                14s      https://github.com/The-DevOps-Daily/gu...\n✓  CI/test (macos-latest, 26) (pull_request)                23s      https://github.com/The-DevOps-Daily/gu...\n✓  CI/test (ubuntu-24.04-arm, 24) (pull_re...               8s       https://github.com/The-DevOps-Daily/gu...\n✓  CI/test (ubuntu-latest, 22) (pull_request)               10s      https://github.com/The-DevOps-Daily/gu...\n✓  CI/test (ubuntu-latest, 24) (pull_request)               11s      https://github.com/The-DevOps-Daily/gu...\n✓  CI/test (ubuntu-latest, 26) (pull_request)               16s      https://github.com/The-DevOps-Daily/gu...\n✓  CI/test (windows-latest, 22) (pull_requ...               31s      https://github.com/The-DevOps-Daily/gu...\n✓  CI/test (windows-latest, 24) (pull_requ...               31s      https://github.com/The-DevOps-Daily/gu...\n✓  CI/test (windows-latest, 26) (pull_requ...               39s      https://github.com/The-DevOps-Daily/gu..."
    },
    {
      "comment": "without auto-merge allowed, joining the queue fails",
      "cmd": "gh pr merge 1 --squash",
      "output": "! The merge strategy for main is set by the merge queue\nGraphQL: Auto merge is not allowed for this repository (enablePullRequestAutoMerge)"
    },
    {
      "cmd": "gh repo edit --enable-auto-merge",
      "output": "✓ Edited repository The-DevOps-Daily/guide-cicd-demo-2026-10-24"
    },
    {
      "comment": "the merge method now comes from the queue's settings",
      "cmd": "gh pr merge 1",
      "output": "✓ Pull request The-DevOps-Daily/guide-cicd-demo-2026-10-24#1 will be added to the merge queue for main when ready"
    },
    {
      "comment": "CI ran again on the queue's temporary branch",
      "cmd": "gh run list --event merge_group",
      "output": "STATUS  TITLE  WORKFLOW  BRANCH                          EVENT        ID           ELAPSED  AGE\n✓       CI     CI        gh-readonly-queue/main/pr-1...  merge_group  40064958792  53s      about 1 minute ago"
    },
    {
      "cmd": "gh pr view 1 --json state,mergedAt --jq '\"\\(.state) at \\(.mergedAt)\"'",
      "output": "MERGED at 2026-10-24T05:07:30Z"
    }
  ]
}
```

The queue ran CI on `gh-readonly-queue/main/pr-1-<sha>`, the latest `main` plus the pull request, and merged it when `all-checks` passed. The merge to `main` then started the deploy workflow.

Merge queues are available in public repositories owned by organizations, and in private repositories of organizations on GitHub Enterprise Cloud.

## Parallel Steps

Steps in a job run one after another. Since [June 2026](https://github.blog/changelog/2026-06-25-actions-steps-can-now-be-run-in-parallel/) they do not have to: `parallel:` runs a group of steps at once and waits for all of them, and `background: true` starts a step and moves on, until a `wait`, `wait-all` or `cancel` step. This workflow, run once on a throwaway branch of the companion repository, lints, tests and builds at the same time, then serves the built site with a background step and requests it:

```yaml
name: Parallel steps

on:
  push:
    branches: [try-parallel-steps]

permissions:
  contents: read

jobs:
  checks:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: ./.github/actions/setup-app

      # Three independent commands at once; the job continues when all three finish
      - parallel:
          - name: Lint
            run: npm run lint
          - name: Test
            run: npm test
          - name: Build
            run: npm run build

      # A server that keeps running while later steps use it
      - name: Serve the site
        id: server
        background: true
        run: python3 -m http.server 8080 --directory dist

      - name: Request the site
        run: |
          for _ in 1 2 3 4 5; do
            curl -sf http://localhost:8080/version.json && break
            sleep 1
          done
          curl -sf http://localhost:8080/ | grep -o '<footer>.*</footer>'

      - name: Stop the server
        cancel: server
```

```terminal
{
  "title": "parallel and background steps",
  "prompt": "$",
  "steps": [
    {
      "cmd": "gh run view 40065920237 --verbose",
      "output": "✓ try-parallel-steps Parallel steps · 40065920237\nTriggered via push about 2 minutes ago\n\nJOBS\n✓ checks in 20s (ID 120789036142)\n  ✓ Set up job\n  ✓ Run actions/checkout@v7\n  ✓ Run ./.github/actions/setup-app\n  ✓ Lint\n  ✓ Test\n  ✓ Build\n  ✓ Parallel group\n  X Serve the site\n  ✓ Request the site\n  ✓ Stop the server\n  ✓ Post Run ./.github/actions/setup-app\n  ✓ Post Run actions/checkout@v7\n  ✓ Complete job\n\nANNOTATIONS\n- \"The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026. For more information, see https://github.com/actions/runner-images/issues/14748\"\nchecks: .github#1\n\n\nFor more information about the job, try: gh run view --job=120789036142\nView this run on GitHub: https://github.com/The-DevOps-Daily/guide-cicd-demo-2026-10-24/actions/runs/40065920237"
    },
    {
      "cmd": "gh run view --job 120789036142 --log | grep -E 'Parallel group|Stop the server' | cut -f2-",
      "output": "Parallel group\t2026-10-24T05:21:27.3810521Z Waiting for background step(s) to complete: Lint, Test, Build\nParallel group\t2026-10-24T05:21:27.8155293Z Finished waiting for background step(s).\nParallel group\t2026-10-24T05:21:27.8155900Z   Lint: Succeeded\nParallel group\t2026-10-24T05:21:27.8156288Z   Test: Succeeded\nParallel group\t2026-10-24T05:21:27.8156611Z   Build: Succeeded\nStop the server\t2026-10-24T05:21:28.8803364Z Cancelling background step(s): Serve the site\nStop the server\t2026-10-24T05:21:36.3925361Z Finished cancelling background step(s).\nStop the server\t2026-10-24T05:21:36.3925837Z   Serve the site: Canceled"
    }
  ]
}
```

The three steps ran at the same time, the group was done 0.4 seconds after it started, and each step kept its own log. The server step shows as canceled because `cancel:` stopped it, which is what it is for; the job still succeeded. Up to 10 background steps can run at once in a job, and composite actions cannot contain them.

These keys are newer than the linters. actionlint 1.7.12 rejects them, and zizmor 1.31.1 reads them with experimental support:

```terminal
{
  "title": "the linters and parallel steps",
  "prompt": "$",
  "steps": [
    {
      "cmd": "actionlint",
      "output": ".github/workflows/parallel.yml:21:9: step must run script with \"run\" section or run action with \"uses\" section [syntax-check]\n   |\n21 |       - parallel:\n   |         ^~~~~~~~~\n.github/workflows/parallel.yml:32:9: unexpected key \"background\" for step to run shell command. expected one of \"continue-on-error\", \"env\", \"id\", \"if\", \"name\", \"run\", \"shell\", \"timeout-minutes\", \"working-directory\" [syntax-check]\n   |\n32 |         background: true\n   |         ^~~~~~~~~~~\n.github/workflows/parallel.yml:43:9: step must run script with \"run\" section or run action with \"uses\" section [syntax-check]\n   |\n43 |       - name: Stop the server\n   |         ^~~~~"
    }
  ]
}
```

Until actionlint catches up, keep parallel steps in a workflow that your lint job skips, or wait before you adopt them.

## Other Ways to Connect Workflows

- **`workflow_run`** starts a workflow when another one finishes, for example to comment test results on a pull request from a trusted context. Part 9 explains why to treat it with care.
- **`repository_dispatch`** starts a workflow from outside, through the API, for example when a dependency in another repository releases.
- **Path filters** (`paths:`) skip whole workflows when nothing relevant changed; a job that must report for a required check should run anyway and exit early instead, because a workflow that never starts never reports.
- **YAML anchors** (since [September 2025](https://github.blog/changelog/2025-09-18-actions-yaml-anchors-and-non-public-workflow-templates/)) let you define a block once with `&name` and reuse it with `*name` in the same file.

## Common Mistakes

- **Requiring a job that can be skipped.** Skipped counts as passed. Require an `all-checks` job that checks `needs.*.result`.
- **Forgetting `merge_group`.** The queue then waits for checks that never run.
- **The same `concurrency` group in a caller and the workflow it calls.** The called workflow would wait for its caller, so GitHub cancels the run with a deadlock error. Give each group its own prefix or suffix.
- **A full OS matrix on a private repository.** A macOS minute costs about ten times a Linux x64 minute.
- **Copying the same steps into every job.** Use a composite action, and a reusable workflow for whole pipelines.

## Summary

- A matrix multiplies one job over operating systems and versions; `include`, `exclude` and `max-parallel` shape it.
- Composite actions share steps; reusable workflows (`on: workflow_call`) share whole pipelines, and the deploy workflow now runs the exact CI that pull requests run.
- Require one aggregate check such as `all-checks`, because skipped jobs count as passed.
- A merge queue tests the combination of `main` and the queued pull requests before merging; workflows need the `merge_group` trigger.
- Parallel and background steps (June 2026) run steps at once inside a job; linters do not support them yet.

In [Part 8](/guides/introduction-to-cicd/08-monitoring-debugging-and-optimization) you break the build on purpose and use the logs, annotations and debug logging to find out why.

## Keep Learning

- [Interview question: CI/CD pipeline design](/interview-questions/mid/cicd-pipeline-design)
- [The GitHub Actions Workflow That Eliminated Our DevOps Bottleneck](/posts/github-actions-fast)
- [GitOps: Deploy Docker Containers with GitHub Actions and ArgoCD](/posts/gitops-deploy-docker-containers-github-actions-argocd)
- [CircleCI vs GitHub Actions](/comparisons/circleci-vs-github-actions)
