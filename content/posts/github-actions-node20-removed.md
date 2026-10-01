---
title: 'GitHub Actions Removed Node 20. Find Every node20 Action You Still Run'
excerpt: 'Since September 23, GitHub Actions runs every node20 action on Node 24, and the opt-out is gone. An action that still works only adds a warning, so they are easy to miss until one breaks. Here is how to list every action your workflows use, read its runs.using value, and catch the ones hidden behind SHA pins and composite actions.'
category:
  name: 'CI/CD'
  slug: 'ci-cd'
date: '2026-10-01'
publishedAt: '2026-10-01T09:00:00Z'
updatedAt: '2026-10-01T09:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - CI/CD
  - GitHub Actions
  - Node.js
  - Supply Chain
  - Self-Hosted Runners
  - DevOps
---

On September 23, 2026, GitHub removed Node 20 from GitHub Actions runners. The [final changelog post](https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions) is short: runners now use Node 24 for JavaScript actions, and the temporary opt-out is gone. What it does not spell out is what happens to the actions whose `action.yml` still says `node20`. They do not stop. The runner starts them on Node 24 instead, adds a warning to the job, and moves on. If the action works on Node 24, you get a yellow annotation. If it does not, the step fails or misbehaves, and there is no setting left that brings Node 20 back.

That makes the change quiet, which is the problem. This post shows how to list every action your workflows use, read the runtime each one declares, and find the node20 actions hidden behind SHA pins and composite actions. Then it covers what to do about each one, and the self-hosted runner hosts that GitHub no longer supports.

## TLDR

- **Node 20 is gone from GitHub Actions runners as of September 23, 2026.** JavaScript actions run on Node 24, and `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION` no longer brings Node 20 back.
- **node20 actions are not rejected.** The runner forces them onto Node 24 and adds a job warning that names them. Jobs we checked on September 28 passed with that warning.
- **The risk is the action that breaks on Node 24,** because you can no longer fall back.
- **Floating major tags do not save you.** On October 1, `actions/checkout@v4`, `actions/cache@v4`, `actions/setup-node@v4` and `actions/upload-artifact@v5` all still declared `node20`.
- **SHA pins inside other people's composite actions are invisible to Dependabot,** because the pin lives in a repository you do not own.
- **A 100-line Python script** lists every `uses:` reference in a repository, follows composite actions, and prints each one's `runs.using`.
- **Self-hosted runners on macOS 13.4 or older, or on ARM32, are no longer supported.**

## Prerequisites

- A repository with GitHub Actions workflows, checked out locally
- The [GitHub CLI](https://cli.github.com/) (`gh`), logged in. The script uses it to read `action.yml` files from other repositories, including private ones your account can read.
- Python 3.8 or newer
- For the runner section: admin access to list self-hosted runners, or shell access to the runner hosts

## What GitHub removed, and when

GitHub [announced the deprecation](https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/) on September 19, 2025, because Node 20 reached end of life in April 2026. The plan moved several times, and the editor's notes on that post record each move. The final timeline was:

1. **Runner v2.328.0** added Node 24 next to Node 20, with Node 20 still the default. Setting `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` let you test Node 24 early.
2. **June 16, 2026:** runners started using Node 24 by default. `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION=true` let you opt back into Node 20.
3. **September 23, 2026:** Node 20 was removed, and that opt-out stopped working.

The September 23 post says: "This is the final notification that Node 20 is no longer available on GitHub Actions runners. Runners now use Node 24 for JavaScript actions. The temporary ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION opt-out is no longer available." It applies to github.com and GitHub with Data Residency. Maintainers should set `runs.using` to `node24` and release; workflow authors should move to versions that support Node 24.

### What happens to a node20 action now

The changelog says runners now use Node 24 for JavaScript actions. The [runner source](https://github.com/actions/runner/blob/v2.337.0/src/Runner.Common/Util/NodeUtil.cs) shows what that means for an action that declares `node20`. In the final phase, the runner picks Node 24 for any action that declares `node20`, whatever environment variables you set. Actions that declare `node12` or `node16` are first mapped to `node20`, so they end up on Node 24 too. At the end of the job, the runner adds a warning that lists them.

We looked at the annotations of three jobs that ran on GitHub-hosted runners on September 28, in an open-source ebook repository that still pins old actions. All three jobs passed. One of them carried this warning:

```text
Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on Node.js 24: actions/cache@v4, actions/checkout@v4. For more information see: https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/
```

Another job used `actions/checkout@v2`, which declares `node12`, and its warning listed `actions/checkout@v2` as a Node.js 20 action forced onto Node 24. That matches the mapping in the source.

```diagram
{
  "type": "branch",
  "title": "What the runner does with an old JavaScript action",
  "nodes": [
    { "label": "runs.using: node12 or node16", "sub": "mapped to node20 first", "icon": "gear" },
    { "label": "runs.using: node20", "sub": "action.yml", "icon": "box" },
    { "label": "Runner picks Node 24", "sub": "no opt-out since Sept 23", "icon": "cpu", "tone": "amber" }
  ],
  "branch": [
    { "label": "Code works on Node 24", "sub": "step passes, job gets a warning", "variant": "good" },
    { "label": "Code breaks on Node 24", "sub": "step fails, no way back to Node 20", "variant": "bad" }
  ]
}
```

What can break? Node 24 is two major versions after Node 20. The [Node.js 24.0.0 release notes](https://nodejs.org/en/blog/release/v24.0.0) list removals such as `tls.createSecurePair` and `fs.Dirent`'s `path` property, and runtime deprecations such as `url.parse()`. Whether an action hits one of these depends on its code and its dependencies. Until you have run it on Node 24, treat a node20 action as untested.

## Why SHA pins and unmaintained actions are the main risk

Pinning actions to a full commit SHA is good supply-chain practice. It also freezes the runtime. `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683` is v4.2.2, and it will declare `node20` forever. The pin works as intended. It hides the update.

Floating major tags do not help much either. The first-party actions we checked moved to Node 24 in new major versions, so the old major tags stay on Node 20. We read the `action.yml` of each tag on October 1:

| Action                    | Still `node20` | First major on `node24` |
| ------------------------- | -------------- | ----------------------- |
| `actions/checkout`        | `v4`           | `v5`                    |
| `actions/setup-node`      | `v4`           | `v5`                    |
| `actions/cache`           | `v4`           | `v5`                    |
| `actions/upload-artifact` | `v4` and `v5`  | `v6`                    |

Note `upload-artifact`: `v5` still declares `node20`. A newer major does not always mean Node 24, so read the file.

Dependabot helps less than you might expect. Per [GitHub's docs](https://docs.github.com/en/code-security/dependabot/ecosystems-supported-by-dependabot/supported-ecosystems-and-repositories#github-actions), version updates for actions only run when `dependabot.yml` lists the `github-actions` ecosystem. Dependabot only supports the `owner/repo@ref` syntax, ignores actions and reusable workflows referenced by a local path, and does not support `docker://` references. It also only edits files in your repository. When a third-party composite action pins a node20 action inside its own `action.yml`, no pull request in your repository can fix it.

That case is easy to find in the wild. The latest release of `dominikh/staticcheck-action`, v1.4.1 from March 12, 2026, is a composite action. Inside, it pins `actions/cache` to the commit for v4.3.0, which declares `node20`. Your workflow says `dominikh/staticcheck-action@v1.4.1`, and nothing in it mentions Node.

Then there are unmaintained actions. If an action has not had a release in years, no node24 version is coming. You need a plan for it, not a version bump.

## How to find every node20 action

The method is simple:

1. List every `uses:` value in `.github/workflows/*.yml` and in any `action.yml` in the repository.
2. Split each value into owner, repository, optional path, and ref.
3. Read that action's `action.yml` or `action.yaml` at that ref, and look at `runs.using`.
4. If it says `composite`, repeat for the steps inside it.

You can do step 3 by hand with `gh` or with `raw.githubusercontent.com`:

```terminal
{
  "title": "read runs.using by hand",
  "prompt": "$",
  "steps": [
    {
      "cmd": "gh api \"repos/actions/checkout/contents/action.yml?ref=v4\" --jq .content | base64 -d | grep using:",
      "output": "  using: node20"
    },
    {
      "cmd": "curl -s https://raw.githubusercontent.com/actions/checkout/v5/action.yml | grep using:",
      "output": "  using: node24"
    }
  ]
}
```

The `gh` route works for private repositories and accepts any ref: a tag, a branch, or a SHA. For every reference in every workflow, use the script below.

### A quick signal from job annotations

If a workflow ran recently, its jobs already carry the runner's warning. You can read it without opening the web UI:

```bash
# Job IDs for one run
gh run view RUN_ID --json jobs --jq '.jobs[].databaseId'

# The Node 20 warning for one job, if it has one
gh api repos/OWNER/REPO/check-runs/JOB_ID/annotations \
  --jq '.[] | select(.message | startswith("Node.js 20")) | .message'
```

This only covers what ran. A release workflow that runs once a quarter will not show up until it fails. The scan below reads what the workflows declare instead.

### The script

It reads workflows and local actions from disk and fetches everything else through the GitHub API:

```python
#!/usr/bin/env python3
"""Print the runtime (runs.using) of every action a repository's workflows use.

Usage: find-node20-actions.py [path-to-repo]   (needs python3 and a logged-in gh)
Exit codes: 0 all clear, 1 node12/16/20 actions found, 2 some refs could not be checked.
"""
import base64
import os
import pathlib
import re
import subprocess
import sys

USES = re.compile(r"""^\s*(?:-\s+)?uses:\s*['"]?([^'"\s#]+)""")
USING = re.compile(r"""^\s+using:\s*['"]?([A-Za-z0-9_-]+)""")
OLD = {"node12", "node16", "node20"}  # all of these now run on Node 24
PROBLEMS = {"not found", "unparsed", "unknown"}

root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
seen = {}  # ref -> (runtime, text), so each action is fetched and walked once
found_old = found_problem = False


def uses_in(text):
    return [m.group(1) for line in text.splitlines() if (m := USES.match(line))]


def runtime_of(text):
    for line in text.splitlines():
        if m := USING.match(line):
            return m.group(1)
    return "unknown"


def read_remote(owner, repo, path, ref):
    for name in ("action.yml", "action.yaml"):
        file = f"{path}/{name}" if path else name
        r = subprocess.run(
            ["gh", "api", f"repos/{owner}/{repo}/contents/{file}?ref={ref}", "--jq", ".content"],
            capture_output=True, text=True,
        )
        if r.returncode == 0:
            return base64.b64decode(r.stdout).decode()
    return None


def resolve(ref):
    """Return (runtime, action.yml text or None) for one uses: value."""
    if ref.startswith("docker://"):
        return "docker image", None
    if re.search(r"\.ya?ml(@|$)", ref):
        return "reusable workflow", None  # scan that workflow's repo too
    if ref.startswith("./"):
        for name in ("action.yml", "action.yaml"):
            file = root / ref / name
            if file.is_file():
                text = file.read_text()
                return runtime_of(text), text
        return "not found", None
    m = re.fullmatch(r"([^/@]+)/([^/@]+)(?:/([^@]+))?@(.+)", ref)
    if not m:
        return "unparsed", None
    owner, repo, path, version = m.groups()
    text = read_remote(owner, repo, path or "", version)
    if text is None:
        return "not found", None
    return runtime_of(text), text


def walk(source, text):
    global found_old, found_problem
    for ref in uses_in(text):
        first = ref not in seen
        if first:
            seen[ref] = resolve(ref)
        runtime, action_text = seen[ref]
        found_old |= runtime in OLD
        found_problem |= runtime in PROBLEMS
        flag = "!!" if runtime in OLD else "  "
        print(f"{flag} {source:<38} {ref:<52} {runtime}")
        # A remote composite action can wrap a node20 action. Local ones are scanned as files below.
        if first and runtime == "composite" and action_text and not ref.startswith("./"):
            walk(ref, action_text)


files = sorted(root.glob(".github/workflows/*.y*ml"))
for dirpath, dirnames, filenames in os.walk(root):
    dirnames[:] = sorted(d for d in dirnames if d not in ("node_modules", ".git"))
    files += [pathlib.Path(dirpath, n) for n in sorted(filenames) if n in ("action.yml", "action.yaml")]
for f in files:
    text = f.read_text()
    rel = f.relative_to(root)
    if f.name.startswith("action."):
        runtime = runtime_of(text)
        found_old |= runtime in OLD
        found_problem |= runtime in PROBLEMS
        print(f"{'!!' if runtime in OLD else '  '} {str(rel):<38} {'(this action)':<52} {runtime}")
    walk(str(rel), text)

sys.exit(2 if found_problem else 1 if found_old else 0)
```

What it handles:

- **`./local-action` paths** are read from disk, relative to the repository root.
- **`docker://` references** are reported as Docker images, which do not use the runner's Node.
- **Composite actions** in other repositories are followed, so a node20 action two levels down still shows up. Local ones are scanned as files.
- **`action.yml` and `action.yaml`** are both tried, in that order. GitHub's [metadata docs](https://docs.github.com/actions/creating-actions/metadata-syntax-for-github-actions) allow either name.
- **Subdirectory actions** such as `github/codeql-action/init@v4.38.2` resolve to that path in the repository.
- **Reusable workflows** are labeled, not followed. Scan their repositories separately.

A reference it cannot read prints `not found` and makes the exit code 2, so an expired token or a deleted repository never reads as a clean result.

### What we ran

We built a test repository whose workflow mixes every case: a SHA-pinned action, two local actions (one composite, one JavaScript with an `action.yaml`), a `docker://` image, two third-party actions, a subdirectory action, and a reusable workflow. The `octo-org` reference is a made-up name, which the script labels without fetching:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
      - uses: ./.github/actions/setup # composite, uses actions/setup-node@v4
      - uses: ./.github/actions/legacy-js # action.yaml, runs.using: 'node20'
      - uses: docker://alpine:3.20
      - uses: JS-DevTools/npm-publish@v4.1.5
      - uses: dominikh/staticcheck-action@v1.4.1
      - uses: github/codeql-action/init@v4.38.2
  deploy:
    uses: octo-org/shared/.github/workflows/deploy.yml@main
```

Here is the run, on October 1, 2026:

```terminal
{
  "title": "scan the test repository",
  "prompt": "$",
  "steps": [
    {
      "cmd": "python3 find-node20-actions.py demo-repo; echo \"exit code: $?\"",
      "output": "!! .github/workflows/ci.yml               actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 node20\n   .github/workflows/ci.yml               ./.github/actions/setup                              composite\n!! .github/workflows/ci.yml               ./.github/actions/legacy-js                          node20\n   .github/workflows/ci.yml               docker://alpine:3.20                                 docker image\n   .github/workflows/ci.yml               JS-DevTools/npm-publish@v4.1.5                       node24\n   .github/workflows/ci.yml               dominikh/staticcheck-action@v1.4.1                   composite\n   dominikh/staticcheck-action@v1.4.1     actions/setup-go@4b73464bb391d4059bd26b0524d20df3927bd417 node24\n!! dominikh/staticcheck-action@v1.4.1     actions/cache@0057852bfaa89a56745cba8c7296529d2fc39830 node20\n   .github/workflows/ci.yml               github/codeql-action/init@v4.38.2                    node24\n   .github/workflows/ci.yml               octo-org/shared/.github/workflows/deploy.yml@main    reusable workflow\n!! .github/actions/legacy-js/action.yaml  (this action)                                        node20\n   .github/actions/setup/action.yml       (this action)                                        composite\n!! .github/actions/setup/action.yml       actions/setup-node@v4                                node20\nexit code: 1"
    }
  ]
}
```

Rows marked `!!` need work. The `actions/cache` row is the one Dependabot cannot fix: it comes from inside `staticcheck-action`.

We also ran the script on two real repositories. On this site's own repository it printed 20 rows across six workflows, all `node24` or `docker`, and exited 0. On the ebook repository from earlier, it flagged `actions/checkout@v4`, `actions/checkout@v2` (`node12`), and the `actions/cache@v4` inside a composite build action. Those are the same three actions that GitHub's job annotations listed for its September 28 runs.

To scan a whole organization, run the script in each checked-out repository. Remember that it only sees the branch you have checked out.

## Fix each affected action

For each `!!` row you have three options.

**Upgrade to a node24 release.** This is the usual fix. Find the newest release, read its `action.yml` to confirm `node24`, and update the reference. For SHA pins, update the SHA and the version comment together, so Dependabot and humans can still read it. Check the release notes for breaking changes, because the Node 24 releases were often new major versions with other changes too.

**Replace it.** If the action is unmaintained, switch to a maintained one, or drop it for a `run:` step. Many small actions wrap one CLI command, and `gh release create` or `aws s3 sync` in a `run:` step has no Node runtime to go stale.

**Fork it and bump `runs.using`.** For an action with no node24 release, fork it, change `runs.using` to `node24`, run its tests on Node 24, rebuild any bundled `dist/` folder, and pin your fork by SHA. The runner already runs the action on Node 24, so the edit alone only removes the warning. The value is in the testing and in owning the fix. You also own the fork's security updates now.

For composite actions you do not own, such as the `staticcheck-action` case, the fix belongs upstream. Open an issue or a pull request, and fork in the meantime if the wrapped action breaks.

## Internal JavaScript actions

Your own actions need the same change, and nobody else will make it. To find them across an organization, GitHub code search works:

```bash
gh search code node20 --owner YOUR_ORG --filename action.yml
gh search code node20 --owner YOUR_ORG --filename action.yaml
```

Search for the bare word. In our tests, the phrase `"using: node20"` returned nothing, even in an organization where the bare word found files that contain exactly that line. Code search only covers default branches, and the word can also match comments and test fixtures, so confirm each hit with the script. For each real one:

1. Set `runs.using: node24` in its `action.yml`.
2. Run its tests on Node 24, and set the same version in its own CI.
3. Rebuild any bundled output, such as a `dist/` folder built with `ncc`.
4. Publish a new tag, and move the major tag if your consumers use one.
5. Update the repositories that pin the old SHA. The script above finds them.

Self-hosted runners need a runner version that knows `node24`. The announcement names v2.328.0 as the release that added it. GitHub now enforces much newer runner versions anyway, as we covered in our post on [the self-hosted runner version window](/posts/github-self-hosted-runner-version-window).

## Self-hosted runner hosts that lose support

The September 23 post also says: "Node 24 is incompatible with macOS 13.4 and earlier, and it doesn't officially support ARM32. Self-hosted runners using these operating systems or architectures are no longer supported." The Node.js 24.0.0 release notes agree: the minimum macOS version went up to 13.5, and armv7 support was downgraded to experimental.

The runner source has a kill switch for this. On Linux ARM32, when GitHub turns it on, a JavaScript action step fails with "Linux ARM32 runners are no longer supported. Please migrate to a supported platform." That message is from the runner source. We have no ARM32 runner and did not see it in a real job.

To find these hosts, start with the API:

```bash
gh api repos/OWNER/REPO/actions/runners \
  --jq '.runners[] | [.name, .os, ([.labels[].name] | join(","))] | @tsv'
```

Use `orgs/YOUR_ORG/actions/runners` for organization runners. Do not trust the labels alone. [GitHub's docs](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/apply-labels) note that when default labels such as `x64` are set with the configuration script, GitHub "does not validate that the runner is actually using that operating system or architecture." On the hosts themselves, `uname -m` shows the architecture (`armv7l` or `armv6l` means ARM32), and `sw_vers -productVersion` shows the macOS version.

There is no Node-only fix for these hosts. Move ARM32 runners to arm64 hardware or an arm64 OS image, and upgrade old Macs or retire them. A workflow with only `run:` steps and Docker actions needs no JavaScript action, but almost every workflow starts with `actions/checkout`.

## Caveats

- **The script is a line scanner, not a YAML parser.** It can miss `uses:` in flow-style YAML, and it can pick up a line that starts with `uses:` inside a multi-line `run:` block. It takes the first indented `using:` line as the runtime.
- **It reads one branch.** Workflows that exist only on other branches are not scanned.
- **It does not test anything.** A `node20` row means the action declares Node 20. Whether it works on Node 24 is a separate question.
- **Reusable workflows from other repositories are not followed.**
- **Our runtime check is one snapshot.** The tag table and the scan output are from October 1, 2026. Tags move, and maintainers ship releases.
- **We did not test GitHub Enterprise Server.** The September 23 post names github.com and GitHub with Data Residency only.

## Summary

Node 20 left GitHub Actions on September 23, 2026, and the opt-out went with it. Actions that declare `node20`, `node16` or `node12` now run on Node 24, with a warning that names them. The ones that still work are easy to ignore, and the first one that breaks has no fallback.

Read the job annotations for a quick signal, then scan what your workflows declare: every `uses:` reference, resolved to its `action.yml`, with composite actions followed. Watch SHA pins, old major tags, and node20 actions pinned inside third-party composite actions, because no automated update reaches those. Upgrade, replace, or fork each one, move your own JavaScript actions to `node24`, and retire any self-hosted runner on ARM32 or macOS 13.4 or older.
