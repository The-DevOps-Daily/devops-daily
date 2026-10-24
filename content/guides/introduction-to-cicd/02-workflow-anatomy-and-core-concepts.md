---
title: 'Workflow Syntax: Triggers, Jobs, Steps and Expressions'
description: 'How a GitHub Actions workflow file works: triggers and filters, manual inputs, jobs and needs, job outputs, contexts, expressions and if conditions.'
order: 2
---

Part 1's workflow ran one job on every push. Real workflows decide when to run, take inputs, split work into jobs that depend on each other and pass values between them. This part covers the syntax for all of that by extending `hello.yml` into two jobs that share a message, and shows how to check a workflow for mistakes before you push it.

## Prerequisites

- The repository from [Part 1](/guides/introduction-to-cicd/01-understanding-cicd-and-first-workflow) with `.github/workflows/hello.yml`.
- Optional: [actionlint](https://github.com/rhysd/actionlint) to check workflows locally. With [shellcheck](https://www.shellcheck.net/) installed, it also checks the scripts in `run:` steps.

## The New hello.yml

Replace the workflow with this version:

```yaml
name: Hello

on:
  push:
    branches: [main]
    paths-ignore:
      - '**.md'
  workflow_dispatch:
    inputs:
      name:
        description: Who to greet
        type: string
        default: world
      shout:
        description: Print the greeting in capitals
        type: boolean
        default: false

permissions:
  contents: read

env:
  GREETING: Hello

jobs:
  greet:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    outputs:
      message: ${{ steps.compose.outputs.message }}
    steps:
      - name: Compose the message
        id: compose
        env:
          NAME: ${{ inputs.name || 'world' }}
          SHOUT: ${{ inputs.shout }}
        run: |
          message="$GREETING, $NAME!"
          if [ "$SHOUT" = "true" ]; then
            message="${message^^}"
          fi
          echo "message=$message" >> "$GITHUB_OUTPUT"

  report:
    needs: greet
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Print the message
        env:
          MESSAGE: ${{ needs.greet.outputs.message }}
        run: echo "$MESSAGE"

      - name: Runs only when started by hand
        if: github.event_name == 'workflow_dispatch'
        run: echo "Started from the Actions tab or with gh workflow run"
```

The two jobs and the value that flows between them:

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "push or dispatch", "sub": "with inputs", "icon": "branch", "tone": "slate" },
    { "label": "greet", "sub": "writes $GITHUB_OUTPUT", "icon": "gear", "tone": "blue" },
    { "label": "outputs.message", "sub": "a string", "icon": "box", "tone": "violet" },
    { "label": "report", "sub": "needs: greet", "icon": "check", "tone": "green" }
  ]
}
```

## Triggers

The `on:` key decides when the workflow runs. This version narrows the `push` trigger with two filters: `branches: [main]` ignores pushes to other branches, and `paths-ignore` skips pushes that change only Markdown files. `paths` does the opposite and runs only when matching files change. Both filters also work on `pull_request`.

These are the triggers you will use most:

| Trigger               | Runs when                                                   | Used in this guide              |
| --------------------- | ----------------------------------------------------------- | ------------------------------- |
| `push`                | Commits are pushed to a branch or a tag is pushed           | Parts 1, 2 and 6                |
| `pull_request`        | A pull request is opened, updated or reopened               | Part 3                          |
| `workflow_dispatch`   | Someone clicks "Run workflow" or runs `gh workflow run`     | Parts 2 and 5                   |
| `schedule`            | A cron schedule matches (UTC unless you set `timezone`)     | Not used; see the note below    |
| `workflow_call`       | Another workflow calls this one as a reusable workflow      | Part 7                          |
| `merge_group`         | A pull request enters a merge queue                         | Part 7                          |
| `pull_request_target` | Like `pull_request`, but with the base repository's secrets | Part 9 explains why to avoid it |

`workflow_dispatch` takes up to 25 inputs (the limit was 10 until [December 2025](https://github.blog/changelog/2025-12-04-actions-workflow-dispatch-workflows-now-support-25-inputs/)) of type `string`, `boolean`, `choice`, `number` or `environment`. The "Run workflow" button only appears once the workflow file is on the default branch.

A `schedule` runs on the default branch, at most every 5 minutes, and is often delayed a few minutes at busy times such as the top of the hour. Since March 2026 you can add a `timezone`, for example `timezone: 'Europe/Berlin'` next to `cron: '30 5 * * 1-5'`. In a public repository, GitHub disables scheduled workflows after 60 days without any repository activity.

## Jobs, Needs and Outputs

Jobs run in parallel by default. `needs: greet` makes `report` wait for `greet`, and skips `report` if `greet` fails. `timeout-minutes` stops a job that hangs; the default is 360 minutes (6 hours), or less where the runner has a lower limit, such as 15 minutes on `ubuntu-slim`.

A job can pass strings to later jobs in three steps:

1. A step with an `id` (`compose`) writes `name=value` lines to the file in `$GITHUB_OUTPUT`.
2. The job maps that step output to a job output: `message: ${{ steps.compose.outputs.message }}`.
3. A job that `needs` it reads `${{ needs.greet.outputs.message }}`.

Job outputs are always strings. For structured data, write JSON and read it with `fromJSON()`. For files, use artifacts (Part 4).

## Contexts and Expressions

Anything inside `${{ }}` is an **expression** that GitHub evaluates before the step runs. Expressions read **contexts**: `github` (the event, ref, SHA, repository), `env`, `vars` and `secrets` (Part 5), `inputs`, `needs`, `steps`, `matrix` (Part 3), `runner` and `job`. Operators such as `==`, `&&`, `||` and `!` and functions such as `contains()`, `startsWith()`, `format()`, `toJSON()`, `fromJSON()` and `hashFiles()` work inside them. Since January 2026 there is also `case()`, which returns the value of the first true condition:

```yaml
env:
  TARGET: ${{ case(github.ref == 'refs/heads/main', 'production', 'development') }}
```

`${{ inputs.name || 'world' }}` uses `||` to fall back to `world` on a push, where there are no inputs.

Notice that the workflow never writes `${{ inputs.name }}` directly into the shell script. It passes the value through `env:` and the script uses `$NAME`. GitHub pastes expressions into the script text before Bash runs it, so a value such as `"; rm -rf ~; echo "` would become code. Through an environment variable it stays data. [Part 9](/guides/introduction-to-cicd/09-security-best-practices-and-production-patterns) covers this **script injection** problem.

## Conditions

`if:` decides whether a job or step runs. It is an expression, so `${{ }}` is optional there. The last step of `report` runs only for manual runs.

By default, a step runs only if all earlier steps succeeded. Status functions change that:

| Condition             | The step runs when                                                    |
| --------------------- | --------------------------------------------------------------------- |
| `success()` (default) | Every earlier step succeeded                                          |
| `failure()`           | An earlier step failed                                                |
| `always()`            | Always, even when the run is canceled                                 |
| `!cancelled()`        | Always, unless the run is canceled; usually what you want for reports |

`continue-on-error: true` on a step lets the job go on after that step fails, and the job still counts as successful. Use it rarely: it hides failures.

## Run It by Hand

Push the new file, then start a manual run with both inputs:

```terminal
{
  "title": "workflow_dispatch",
  "prompt": "$",
  "steps": [
    {
      "comment": "start the workflow with inputs; the command prints the new run",
      "cmd": "gh workflow run hello.yml -f name=\"GitHub Actions\" -f shout=true",
      "output": "https://github.com/The-DevOps-Daily/guide-cicd-demo-2026-10-24/actions/runs/40063790832"
    },
    {
      "cmd": "gh run list --workflow hello.yml",
      "output": "STATUS  TITLE                   WORKFLOW  BRANCH  EVENT              ID           ELAPSED  AGE\n✓       Hello                   Hello     main    workflow_dispatch  40063790832  12s      less than a minu...\n✓       Pass a message betw...  Hello     main    push               40063759857  13s      less than a minu...\n✓       Add a first workflow    Hello     main    push               40063694804  8s       about 1 minute ago"
    },
    {
      "comment": "the report job printed the message it got from greet",
      "cmd": "gh run view --job 120782683217 --log | grep 'Print the message' | cut -f3- | tail -n 1",
      "output": "2026-10-24T04:48:36.3242222Z HELLO, GITHUB ACTIONS!"
    }
  ]
}
```

The `greet` job composed the message from the inputs, and `report` printed it. On the push run, the last step was skipped because the event was `push`. `gh run view --job` shows skipped steps with a dash:

```terminal
{
  "title": "a skipped step",
  "prompt": "$",
  "steps": [
    {
      "cmd": "gh run view --job 120782594172",
      "output": "✓ main Hello · 40063759857\nTriggered via push about 1 minute ago\n\n✓ report in 2s (ID 120782594172)\n  ✓ Set up job\n  ✓ Print the message\n  - Runs only when started by hand\n  ✓ Complete job\n\nANNOTATIONS\n- \"The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026. For more information, see https://github.com/actions/runner-images/issues/14748\"\nreport: .github#1\n\n\nTo see the full job log, try: gh run view --log --job=120782594172\nView this run on GitHub: https://github.com/The-DevOps-Daily/guide-cicd-demo-2026-10-24/actions/runs/40063759857"
    }
  ]
}
```

## Check a Workflow Before You Push

A typo in a workflow often shows up only when the run fails, or worse, when a condition silently never matches. **actionlint** checks workflow files locally: YAML structure, expressions, job dependencies, input names, and with shellcheck, the scripts in `run:`. Here it is on a copy of `hello.yml` with three typical mistakes: `needs: gret`, `inputs.nmae` and an unquoted `$MESSAGE`:

```terminal
{
  "title": "actionlint",
  "prompt": "$",
  "steps": [
    {
      "cmd": "actionlint -version",
      "output": "1.7.12\ninstalled by downloading from release page\nbuilt with go1.26.1 compiler for linux/arm64"
    },
    {
      "cmd": "actionlint",
      "output": ".github/workflows/hello.yml:23:21: property \"nmae\" is not defined in object type {name: string} [expression]\n   |\n23 |           NAME: ${{ inputs.nmae }}\n   |                     ^~~~~~~~~~~\n.github/workflows/hello.yml:26:3: job \"report\" needs job \"gret\" which does not exist in this workflow [job-needs]\n   |\n26 |   report:\n   |   ^~~~~~~\n.github/workflows/hello.yml:32:24: property \"greet\" is not defined in object type {} [expression]\n   |\n32 |           MESSAGE: ${{ needs.greet.outputs.message }}\n   |                        ^~~~~~~~~~~~~~~~~~~~~~~~~~~\n.github/workflows/hello.yml:33:9: shellcheck reported issue in this script: SC2086:info:1:6: Double quote to prevent globbing and word splitting [shellcheck]\n   |\n33 |         run: echo $MESSAGE\n   |         ^~~~"
    }
  ]
}
```

actionlint found all three, plus a follow-up error: `needs.greet` is not available because `report` does not need `greet`. On the real `hello.yml` it prints nothing and exits with status 0:

```terminal
{
  "title": "a clean workflow",
  "prompt": "$",
  "steps": [
    {
      "cmd": "actionlint && echo \"no problems found\"",
      "output": "no problems found"
    }
  ]
}
```

Run actionlint in your editor or as a pre-commit hook. Part 9 adds **zizmor**, which looks for security problems that actionlint does not.

## Common Mistakes

- **Writing `${{ }}` into `run:` scripts.** It works until a value contains a quote. Pass values through `env:`.
- **Comparing booleans as booleans everywhere.** Inputs of type `boolean` are real booleans in `inputs`, but in environment variables and job outputs everything is a string: compare with `"true"`.
- **A job output that is always empty.** The step needs an `id`, and the job needs an `outputs:` entry that points to it.
- **Expecting `workflow_dispatch` on a branch.** The button and `gh workflow run` need the workflow file on the default branch.
- **Overlapping triggers.** `on: [push, pull_request]` without filters runs twice for every push to a pull request branch.

## Summary

- `on:` with `branches`, `paths` and `paths-ignore` filters decides when a workflow runs; `workflow_dispatch` adds manual runs with up to 25 inputs.
- Jobs run in parallel unless they `need` each other; job outputs pass strings between jobs.
- Expressions read contexts such as `github`, `inputs` and `needs`; pass them to scripts through `env:`.
- `if:` with `success()`, `failure()`, `always()` and `!cancelled()` controls what runs after a failure.
- actionlint catches typos and script bugs before you push.

In [Part 3](/guides/introduction-to-cicd/03-building-and-testing-applications) you add the example app and a CI workflow that lints, tests and builds it on every pull request.

## Keep Learning

- [YAML Parsing Simulator](/games/yaml-parsing-simulator) and [Cron Expression Simulator](/games/cron-expression-simulator)
- [GitHub Actions Workflows Quiz](/quizzes/github-actions-quiz)
- [CI/CD Pipelines Quiz](/quizzes/cicd-pipelines-quiz)
