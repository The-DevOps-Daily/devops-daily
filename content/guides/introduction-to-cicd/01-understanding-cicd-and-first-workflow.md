---
title: 'What Is CI/CD? Your First GitHub Actions Workflow'
description: 'What continuous integration, delivery and deployment mean, how GitHub Actions runs a workflow, and how to push your first workflow and read its logs.'
order: 1
---

Software breaks in boring ways. Someone forgets to run the tests before a merge, two changes that each work alone break when they meet, or a release depends on the one person who remembers the manual steps. **CI/CD** replaces those memories with automation that runs on every change.

In this part you learn what continuous integration, continuous delivery and continuous deployment mean, how GitHub Actions turns an event such as a push into a run on a fresh runner, and you push your first workflow and read its logs.

## Prerequisites

- A GitHub account and a new repository with only a README in it. This guide calls it `cheatsheet`; the companion repository is `The-DevOps-Daily/guide-cicd-demo-2026-10-24`.
- Git and the [GitHub CLI](https://cli.github.com/) on your computer, logged in with `gh auth login`.

## CI, Continuous Delivery and Continuous Deployment

**Continuous integration (CI)** means that everyone merges small changes into the main branch often, at least daily, and that an automated build and test run checks every change before and after it is merged. Problems show up while the change is small and fresh in your mind, not weeks later in a big merge.

**Continuous delivery** adds the release side: every change that passes CI produces something you can deploy, and the deployment itself is a script. A person still decides when to release, often with one click or an approval.

**Continuous deployment** removes that last manual decision: every change that passes the pipeline goes to production automatically. The safety comes from the tests, small changes and fast rollback, not from a person watching.

| Practice               | What is automated                      | Who decides to release |
| ---------------------- | -------------------------------------- | ---------------------- |
| Continuous integration | Build and tests on every change        | Nobody releases yet    |
| Continuous delivery    | Build, tests and the deployment script | A person approves      |
| Continuous deployment  | Everything, up to production           | The pipeline           |

This guide builds continuous delivery: every change on `main` is deployed automatically, but only after a person approves the deployment (Part 6). Removing the approval later turns it into continuous deployment.

## How GitHub Actions Works

GitHub Actions has five building blocks:

- An **event** is something that happens in or to the repository: a push, a pull request, a schedule, a click on "Run workflow".
- A **workflow** is a YAML file in `.github/workflows/`. Its `on:` key lists the events that start it.
- A workflow has one or more **jobs**. Each job runs on its own **runner**. A GitHub-hosted runner is a fresh machine that GitHub creates for that job and deletes afterwards: a virtual machine, or a container for the small `ubuntu-slim` runner. Self-hosted runners are machines you manage yourself. Jobs run in parallel unless one `needs` another.
- A job is a list of **steps** that run in order on the same runner. A step either runs shell commands (`run:`) or uses an **action** (`uses:`), a reusable piece of automation such as `actions/checkout`, which downloads your code.
- Each execution of a workflow is a **run**, with logs for every step.

```diagram
{
  "type": "graph",
  "columns": [
    [
      { "id": "event", "label": "push to main", "sub": "event", "icon": "branch", "tone": "slate", "detail": "GitHub sends the event to every workflow whose on: key matches it." }
    ],
    [
      { "id": "wf", "label": "hello.yml", "sub": "workflow", "icon": "gear", "tone": "blue", "detail": "A YAML file in .github/workflows/. One run starts for each matching event." }
    ],
    [
      { "id": "job", "label": "say-hello", "sub": "job on ubuntu-latest", "icon": "server", "tone": "violet", "detail": "ubuntu-latest is a GitHub-hosted virtual machine, created for this job and deleted when it ends." }
    ],
    [
      { "id": "s1", "label": "checkout", "sub": "uses: an action", "icon": "box", "tone": "green" },
      { "id": "s2", "label": "echo", "sub": "run: a command", "icon": "cpu", "tone": "green" }
    ]
  ],
  "edges": [["event", "wf", "triggers"], ["wf", "job", "starts"], ["job", "s1"], ["job", "s2"]]
}
```

## Write the First Workflow

Clone your new repository and create the file `.github/workflows/hello.yml`. GitHub only looks for workflows in that directory, and the file name is up to you.

```yaml
name: Hello

on:
  push:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  say-hello:
    runs-on: ubuntu-latest
    steps:
      - name: Check out the repository
        uses: actions/checkout@v7
        with:
          persist-credentials: false

      - name: Say hello
        run: echo "Hello from GitHub Actions"

      - name: Show where this job runs
        run: |
          echo "Event:  $GITHUB_EVENT_NAME"
          echo "Branch: $GITHUB_REF_NAME"
          echo "Commit: $GITHUB_SHA"
          echo "Runner: $RUNNER_OS $RUNNER_ARCH, $ImageOS $ImageVersion"
          ls -A
```

Line by line:

- `name` is what the Actions tab shows.
- `on` lists the triggers: every `push` to any branch, and `workflow_dispatch`, which adds a "Run workflow" button (Part 2 adds inputs to it).
- `permissions` sets what the automatic `GITHUB_TOKEN` of this run may do. `contents: read` lets it read the code and nothing else. Set it in every workflow; [Part 9](/guides/introduction-to-cicd/09-security-best-practices-and-production-patterns) explains why.
- `jobs` holds one job, `say-hello`. `runs-on: ubuntu-latest` asks for a GitHub-hosted Linux runner.
- The first step uses the `actions/checkout` action at major version 7. The runner starts empty, and this step clones your repository into it. `persist-credentials: false` stops it from leaving the token configured for later `git` commands, which this job does not need.
- The other two steps run shell commands. On Linux runners, `run:` uses Bash. GitHub sets environment variables such as `GITHUB_SHA` and `RUNNER_OS` in every job, and the runner image sets `ImageOS` and `ImageVersion`.

:::note
This guide references actions by major version tag, such as `actions/checkout@v7`, to keep the examples short. A tag can be moved to different code, so production workflows should pin each action to a full commit SHA. [Part 9](/guides/introduction-to-cicd/09-security-best-practices-and-production-patterns) shows how, and the companion repository is pinned that way.
:::

## Push It and Watch the Run

Commit the file and push it. The push is the event that starts the workflow.

```bash
git add .github/workflows/hello.yml
git commit -m "Add a first workflow"
git push
```

Open the **Actions** tab of the repository to watch the run, or use the GitHub CLI from inside your clone:

```terminal
{
  "title": "the first run",
  "prompt": "$",
  "steps": [
    {
      "comment": "list the recent runs of all workflows",
      "cmd": "gh run list",
      "output": "STATUS  TITLE                 WORKFLOW  BRANCH  EVENT  ID           ELAPSED  AGE\n✓       Add a first workflow  Hello     main    push   40063694804  8s       less than a minute ago"
    },
    {
      "comment": "show one run: its jobs, their times and any annotations",
      "cmd": "gh run view 40063694804",
      "output": "✓ main Hello · 40063694804\nTriggered via push less than a minute ago\n\nJOBS\n✓ say-hello in 5s (ID 120782375744)\n\nANNOTATIONS\n- \"The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026. For more information, see https://github.com/actions/runner-images/issues/14748\"\nsay-hello: .github#1\n\n\nFor more information about the job, try: gh run view --job=120782375744\nView this run on GitHub: https://github.com/The-DevOps-Daily/guide-cicd-demo-2026-10-24/actions/runs/40063694804"
    }
  ]
}
```

`gh run view` without an ID asks you to pick a run, and `gh run watch` follows a run until it finishes.

The run has one annotation, a notice from GitHub: the `ubuntu-latest` label is moving from Ubuntu 24.04 to Ubuntu 26.04. GitHub [announced it on 17 September 2026](https://github.blog/changelog/2026-09-17-ubuntu-26-generally-available-and-latest-migration/), and the move rolls out gradually between 19 October and 19 November 2026, so for a few weeks a job can land on either image. This run still got Ubuntu 24.04. If a tool your build needs changed between the two releases, test with `runs-on: ubuntu-26.04` first, or pin `runs-on: ubuntu-24.04` until you are ready.

## Read the Logs

The log of every step is kept with the run (for 90 days by default). `gh run view --log` prints it with the job name, step name and a timestamp on every line. Here are the last lines of the step that printed the environment, with `cut` dropping the job and step columns:

```terminal
{
  "title": "step output",
  "prompt": "$",
  "steps": [
    {
      "cmd": "gh run view --job 120782375744 --log | grep 'Show where this job runs' | cut -f3- | tail -n 7",
      "output": "2026-10-24T04:47:00.8552682Z Event:  push\n2026-10-24T04:47:00.8553580Z Branch: main\n2026-10-24T04:47:00.8554362Z Commit: dca60e9a75bb6a2dd7f14f6ac13771a7f94b48b7\n2026-10-24T04:47:00.8555116Z Runner: Linux X64, ubuntu24 20261012.334.1\n2026-10-24T04:47:00.8563485Z .git\n2026-10-24T04:47:00.8564145Z .github\n2026-10-24T04:47:00.8564664Z README.md"
    }
  ]
}
```

The workspace contains only what `actions/checkout` downloaded: `.git`, `.github` and the README. Nothing from earlier runs or other jobs is there.

The "Set up job" step at the top of every log tells you what the job ran on. This part of it names the runner version, the image and the token permissions:

```terminal
{
  "title": "set up job",
  "prompt": "$",
  "steps": [
    {
      "cmd": "gh run view --job 120782375744 --log | grep 'Set up job' | cut -f3- | sed -n '1p;16,27p'",
      "output": "2026-10-24T04:46:59.5293799Z Current runner version: '2.338.0'\n2026-10-24T04:46:59.5331209Z ##[group]Runner Image\n2026-10-24T04:46:59.5331805Z Image: ubuntu-24.04\n2026-10-24T04:46:59.5332327Z Version: 20261012.334.1\n2026-10-24T04:46:59.5333376Z Included Software: https://github.com/actions/runner-images/blob/ubuntu24/20261012.334/images/ubuntu/Ubuntu2404-Readme.md\n2026-10-24T04:46:59.5335067Z Image Release: https://github.com/actions/runner-images/releases/tag/ubuntu24%2F20261012.334\n2026-10-24T04:46:59.5336010Z ##[endgroup]\n2026-10-24T04:46:59.5337160Z ##[group]GITHUB_TOKEN Permissions\n2026-10-24T04:46:59.5339707Z Contents: read\n2026-10-24T04:46:59.5340596Z Metadata: read\n2026-10-24T04:46:59.5341230Z ##[endgroup]\n2026-10-24T04:46:59.5343321Z Secret source: Actions\n2026-10-24T04:46:59.5344274Z Cache mode: write"
    }
  ]
}
```

The image link leads to the full list of preinstalled software for that image version: Node.js, Python, Java, Go, Docker, the cloud CLIs and many more. The token permissions match the `permissions:` block of the workflow.

## The Runner

On GitHub-hosted runners, every job starts on a clean machine (a virtual machine, or a container for `ubuntu-slim`), and the machine is deleted when the job ends. That makes runs repeatable, but it also means a job knows nothing about earlier jobs: anything you want to keep, such as dependencies or the built app, has to be cached or uploaded (Part 4).

GitHub-hosted runners for public repositories have 4 vCPUs on Linux and Windows. These are the labels you will use in this guide (October 2026):

| Label              | Machine                                          |
| ------------------ | ------------------------------------------------ |
| `ubuntu-latest`    | Ubuntu 24.04, moving to 26.04, x64               |
| `ubuntu-24.04-arm` | Ubuntu 24.04 on arm64                            |
| `windows-latest`   | Windows Server 2025, x64                         |
| `macos-latest`     | macOS 26 on Apple silicon (arm64)                |
| `ubuntu-slim`      | 1 vCPU container for small jobs, 15-minute limit |

In public repositories, these standard runners are free. In private repositories, they use the minutes included in your plan, then cost per minute; the [overview](/guides/introduction-to-cicd#h2-what-it-costs) lists the prices.

## Common Mistakes

- **The file is in the wrong place.** Workflows must be in `.github/workflows/` at the root of the repository, with a `.yml` or `.yaml` extension. Anywhere else, GitHub ignores them silently.
- **Tabs in YAML.** YAML indentation must be spaces. Part 2 shows how to check a workflow before you push it.
- **Forgetting the checkout.** Without `actions/checkout`, the runner has none of your files.
- **Expecting state to survive.** Files, installed packages and environment variables are gone when the job ends.
- **Leaving out `permissions`.** Without it, the token gets the repository's default permissions, which can include write access.

## Summary

- Continuous integration builds and tests every change; continuous delivery makes every passing change deployable by script; continuous deployment releases it automatically.
- An event starts a workflow, the workflow runs jobs on fresh runners, and each job runs its steps in order.
- `gh run list`, `gh run view` and `gh run view --log` show runs, jobs and logs from the terminal.
- `ubuntu-latest` is moving to Ubuntu 26.04 between 19 October and 19 November 2026.

In [Part 2](/guides/introduction-to-cicd/02-workflow-anatomy-and-core-concepts) you extend this workflow with filters, manual inputs, a second job and a job output.

## Keep Learning

- [CI/CD Fundamentals Quiz](/quizzes/cicd-fundamentals-quiz)
- [CI/CD Concepts flashcards](/flashcards/cicd-concepts)
- [Interview question: CI/CD pipeline stages](/interview-questions/junior/cicd-pipeline-stages)
- [Jenkins vs GitHub Actions](/comparisons/jenkins-vs-github-actions)
