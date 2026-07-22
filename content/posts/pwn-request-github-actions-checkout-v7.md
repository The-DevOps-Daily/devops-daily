---
title: 'The pwn request just got harder: what actions/checkout v7 changes, and what it does not'
excerpt: 'GitHub is backporting a fork-checkout block to actions/checkout, with enforcement on July 20, 2026. Here is what a pwn request actually is, what the change stops, and the three ways your pipeline is still exposed after you upgrade.'
category:
  name: 'CI/CD'
  slug: 'ci-cd'
date: '2026-07-18'
publishedAt: '2026-07-18T09:00:00Z'
updatedAt: '2026-07-18T09:00:00Z'
readingTime: '11 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - CI/CD
  - GitHub Actions
  - Security
  - Supply Chain
  - DevOps
---

If you run GitHub Actions, a change is about to touch your pipelines whether you asked for it or not. Starting **July 20, 2026**, backported versions of `actions/checkout` refuse to check out fork pull request code inside `pull_request_target` and `workflow_run` workflows. Workflows pinned to a floating tag like `actions/checkout@v4` pick up the new behavior automatically. Some of them will break. A few of them were exploitable and you never knew.

This is GitHub closing the door on the "pwn request," one of the most reliable supply-chain footguns in the ecosystem. The change is good and overdue. It is also narrower than the headlines suggest, and if you read it as "GitHub fixed pwn requests" you will walk away with a false sense of safety. This post explains what a pwn request actually is, what v7 stops, and the three concrete ways your CI is still wide open after you upgrade.

## TL;DR

- **What changed:** `actions/checkout` v7 (and a backport to older majors, enforced July 20, 2026) refuses to fetch a fork PR's code in `pull_request_target` and PR-triggered `workflow_run` runs.
- **Why it matters:** that exact pattern, privileged trigger plus checkout of untrusted fork code, is the classic pwn request that has leaked tokens and secrets across the ecosystem.
- **Who is affected now:** anyone pinned to a floating major tag (`@v4`, `@v3`). SHA-pinned and minor/patch-pinned workflows are not backported and keep the old behavior until you upgrade.
- **What it does NOT fix:** manual `git`/`gh` checkouts inside `run:` blocks, other privileged triggers like `issue_comment`, and every workflow you opt out with `allow-unsafe-pr-checkout: true`.
- **Do this:** grep your org for `pull_request_target`, confirm each one either does not check out fork code or does so in a sandbox, and stop treating the checkout upgrade as the whole job.

## Prerequisites

- Familiarity with GitHub Actions workflow syntax (`on:` triggers, jobs, steps).
- A rough mental model of the `GITHUB_TOKEN` and repository secrets.
- Access to your organization's repositories to audit workflows (or read access plus the GitHub search API).

## What a pwn request actually is

The whole problem lives in the difference between two triggers.

`pull_request` runs in the **fork's** context. It gets a read-only token, no access to your secrets, and it is the safe default for CI on external contributions. The tradeoff: it cannot post a comment back, update a status check with a real token, or read a secret to run an integration test. So people reach for the other trigger.

`pull_request_target` runs in the **base repository's** context. It executes the workflow file from your default branch, with your `GITHUB_TOKEN`, your secrets, and write access to the repo. It exists precisely so that automation, labelers, welcome bots, coverage uploaders, can react to fork PRs with real permissions.

Here is the trap. `pull_request_target` runs the workflow *definition* from your trusted branch, but many people then explicitly check out the pull request's code and run it:

```yaml
# DANGEROUS: privileged trigger + checkout of untrusted fork code
name: coverage
on:
  pull_request_target

jobs:
  cover:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          # this fetches the FORK's head commit...
          ref: ${{ github.event.pull_request.head.sha }}
      # ...and then runs it with the base repo's secrets in scope
      - run: npm ci && npm test
```

An attacker opens a PR from a fork. Their `npm test`, or a `postinstall` script, or a tampered build step, now executes on your runner with your `GITHUB_TOKEN` and any secret the job can see. From there it is a short walk to exfiltrating a `NPM_TOKEN`, a cloud credential, or a Personal Access Token. This is not theoretical: the `tj-actions/changed-files` compromise and the AsyncAPI generator PAT theft both rode this exact pattern, and in June 2026 researchers catalogued hundreds of exploitable repositories at major vendors using nothing but a free GitHub account.

```diagram
{
  "type": "flow",
  "title": "The pwn request",
  "nodes": [
    { "label": "Attacker opens PR from a fork", "icon": "branch" },
    { "label": "pull_request_target fires in BASE repo context (secrets + write token)", "icon": "activity" },
    { "label": "Workflow checks out the fork's head commit", "icon": "box" },
    { "label": "Untrusted code runs with your credentials", "icon": "cpu" },
    { "label": "Token / secret exfiltrated", "icon": "lock" }
  ]
}
```

## What actions/checkout v7 changes

The fix targets the checkout step, the one link in the chain GitHub actually controls.

From v7 (and the backport), `actions/checkout` **refuses to fetch fork PR code** when the run is triggered by `pull_request_target`, or by a `workflow_run` whose upstream event was a `pull_request`. Concretely, it refuses when the PR is from a fork and the step tries to check out that fork's head or merge ref, whether you name it via `ref:`, a `refs/pull/<n>/head` style ref, or the resolved head/merge SHA.

In plain terms: the dangerous snippet above stops working. The checkout step fails instead of silently handing your secrets to a stranger.

Two details decide whether this reaches you on July 20:

- **Floating major tags auto-upgrade.** `actions/checkout@v4` or `@v3` will pull in the backported behavior with no action from you. This is the intended blast radius, it retroactively protects the workflows most likely to be vulnerable.
- **Pinned versions do not.** If you pin to a full SHA (the [supply-chain best practice](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)) or to a minor/patch like `@v4.2.2`, the backport does not touch you. You stay on the old behavior until you bump the pin. So the safest-pinned repos are, ironically, the last to get this particular protection, and they need a deliberate upgrade.

There is a deliberate escape hatch with an intentionally ugly name:

```yaml
- uses: actions/checkout@v4
  with:
    ref: ${{ github.event.pull_request.head.sha }}
    allow-unsafe-pr-checkout: true   # you are now back to the dangerous behavior
```

If you find yourself adding that flag, treat it as a loud signal to redesign the workflow, not a way to make the warning go away.

:::warning
Enforcement for the backport was moved to **Monday, July 20, 2026**. If any of your workflows use a floating `actions/checkout` tag inside `pull_request_target` and legitimately depend on checking out fork code, they will start failing that day. Audit before then, do not get surprised by red pipelines on a Monday morning.
:::

## The three gaps that remain

Here is the part the "just upgrade" articles skip. The v7 change blocks *one* mechanism of pwn request: the checkout action fetching fork code under a privileged trigger. Pwn requests have at least three other doors, and all of them are still open.

### 1. Manual checkout inside a run block

`actions/checkout` refusing to fetch fork code does nothing about you fetching it yourself:

```yaml
# Still fully exploitable after the v7 change
on: pull_request_target
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4      # checks out the SAFE base ref, fine
      - run: |
          # ...then you manually pull the untrusted PR and run it
          gh pr checkout ${{ github.event.pull_request.number }}
          make build
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

The checkout action never fetched the fork code, so its new guard never fires. You did the fetch by hand, and `make build` runs attacker code with the token in scope. Any pattern that reaches untrusted code through `git checkout`, `gh pr checkout`, `git fetch` plus a merge, or curling a PR patch is untouched by this release.

### 2. Other privileged triggers

`pull_request_target` is the famous one, but it is not the only trigger that runs with base-repo permissions. `issue_comment`, `workflow_run` (outside the narrow PR case v7 covers), `discussion_comment`, and others all execute your trusted workflow with real secrets and can be steered by an attacker who controls the comment or the upstream run. The v7 change is scoped to `pull_request_target` and PR-driven `workflow_run`. A `/deploy` chat-op wired to `issue_comment` that then checks out and runs the PR is exactly as dangerous as it was last week.

### 3. Every opt-out you forget to remove

The `allow-unsafe-pr-checkout: true` flag is there for workflows that genuinely need fork code with elevated context (rare, but real). The risk is entropy: someone adds it to unblock a failing pipeline on July 20, ships it, and it lives forever. Six months later nobody remembers why that workflow can run arbitrary fork code with your production deploy key. Track those flags the way you track `# nosec` or `// eslint-disable`, they are debt with a security label.

## What to actually do

Upgrading checkout is step one, not the finish line. Here is the audit that matters.

**Find every privileged trigger.** Across your org, list the workflows that can run with base-repo secrets:

```terminal
{
  "title": "audit privileged triggers",
  "prompt": "$",
  "steps": [
    { "comment": "clone or use gh to search; here, a local sweep of one repo" },
    { "cmd": "grep -rlE 'pull_request_target|issue_comment|workflow_run' .github/workflows/", "output": ".github/workflows/coverage.yml\n.github/workflows/label.yml\n.github/workflows/deploy-preview.yml" },
    { "comment": "for each hit, answer one question: does it run untrusted PR code?" },
    { "cmd": "grep -nE 'head.sha|head.ref|gh pr checkout|allow-unsafe-pr-checkout' .github/workflows/deploy-preview.yml", "output": "22:          ref: ${{ github.event.pull_request.head.sha }}\n31:          gh pr checkout ${{ github.event.pull_request.number }}" }
  ]
}
```

For each privileged workflow, force it into one of three safe shapes:

1. **Do not check out fork code at all.** Labelers, welcome bots, and triage automation almost never need it. They act on metadata (`github.event.pull_request.*`) and never execute the PR. This is the majority of legitimate `pull_request_target` uses.
2. **Split trusted from untrusted.** Run the untrusted build under plain `pull_request` (no secrets), and have a separate, minimal `pull_request_target` or `workflow_run` job that only consumes the *artifact or result*, never the source. GitHub's own guidance is to keep the privileged half tiny and secret-scoped.
3. **If you truly must run fork code with secrets, sandbox it.** Scope the token with `permissions:`, pass only the one secret the job needs, and prefer a required manual approval (environment protection rules) before the privileged job runs.

And pin your actions to full SHAs. Yes, that opts you out of this particular auto-backport, but SHA pinning is the stronger protection against the broader class of action-tag-hijack attacks that hit the ecosystem in 2026. Pin the SHA, then upgrade deliberately with Dependabot so you get security fixes on your schedule instead of a mutable tag's.

```yaml
# Pin the SHA, note the version, let Dependabot bump it
- uses: actions/checkout@<full-40-char-sha>  # v7.0.0
```

## The real lesson

The pwn request has never been a bug in one action. It is a design tension: CI needs privileges to be useful, and pull requests are untrusted by definition. `actions/checkout` v7 removes the single most common way those two collide, and that will quietly prevent a lot of incidents. But the tension is still there in every `run:` block, every comment-triggered workflow, and every opt-out flag.

Treat July 20 as a prompt, not a patch. Upgrade the action, then spend an hour finding every privileged trigger in your org and proving to yourself that none of them run code you would not merge. That hour is worth more than the upgrade.
