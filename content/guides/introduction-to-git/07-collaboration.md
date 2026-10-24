---
title: 'Git Workflows: Pull Requests, GitHub Flow, Gitflow'
description: 'How teams work with Git: the pull request flow, merge methods, range-diff, stacked branches with --update-refs, release backports, and picking a workflow.'
order: 7
---

Git does not prescribe how a team should work. It gives you branches, merges and remotes, and a **workflow** is the set of rules a team agrees on: where new work starts, how it is reviewed, how it reaches `main`, and how releases are made. This part walks through the most common one, a short-lived branch per change with a pull request, on the project with real commands, including the parts most tutorials skip: updating a branch during review, seeing what changed between two pushes, and stacking branches that depend on each other. Then it compares the well-known workflows and the repository settings that enforce them.

## Prerequisites

- The `status-page` repository with its remote and Sam's clone from [Part 6](/guides/introduction-to-git/06-remote-repositories).
- Rebasing ([Part 5](/guides/introduction-to-git/05-merging#h2-rebase-replay-your-commits-on-top-of-main)) and force-pushing with a lease ([Part 6](/guides/introduction-to-git/06-remote-repositories#h2-force-push-safely)).

## The Pull Request Flow

A **pull request** (GitHub, Bitbucket, Gitea) or **merge request** (GitLab) is a request to merge one branch into another, with a page for discussion, review and automated checks. Git itself has no pull requests; the hosting service adds them on top of branches. The flow looks like this:

```diagram
{
  "type": "loop",
  "nodes": [
    { "label": "Branch from main", "sub": "git switch -c", "variant": "soft" },
    { "label": "Commit and push", "sub": "git push", "variant": "soft" },
    { "label": "Open a pull request", "sub": "checks run, people review", "variant": "solid" },
    { "label": "Update the branch", "sub": "fixups, rebase, push", "variant": "soft" },
    { "label": "Merge and delete", "sub": "main moves on", "variant": "accent" }
  ],
  "loopBack": "review comments",
  "goal": "main is always releasable"
}
```

### 1. Branch, commit, push

You add a list of recent changes to the page. The branch has two commits: a script, saved as `scripts/changes.sh` with LF line endings, and the documentation for it.

```bash
#!/usr/bin/env bash
# Print the newest commits as an HTML list, for the status page.
set -euo pipefail
cd "$(dirname "$0")/.."

echo '<ul id="changes">'
git log -5 --format='  <li>%h %s</li>'
echo '</ul>'
```

```terminal
{
  "title": "a branch for the change",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git switch -c feature/changes-list",
      "output": "Switched to a new branch 'feature/changes-list'"
    },
    {
      "cmd": "chmod +x scripts/changes.sh && git add --chmod=+x scripts/changes.sh && git commit -q -m \"Add a script that lists recent changes\""
    },
    {
      "cmd": "printf '%s\\n' '- `scripts/changes.sh`: prints the newest commits as an HTML list' >> README.md"
    },
    {
      "cmd": "git commit -q -am \"Document the changes script\" && git push",
      "output": "To /home/dev/server/status-page.git\n * [new branch]      feature/changes-list -> feature/changes-list\nbranch 'feature/changes-list' set up to track 'origin/feature/changes-list'."
    }
  ]
}
```

On GitHub, you would now open the pull request in the browser (the push prints a link) or with `gh pr create --fill`, which uses the commit messages for the title and description. Open it early, as a **draft** if it is not ready, so that the checks run and people can see what you are working on.

### 2. Update the branch during review

A reviewer notices that merge commits fill the list with "Merge branch ..." lines and asks you to leave them out. Fix it in a **fixup commit**: a commit marked to be folded into an earlier one later. Reviewers see the small change on its own, and the branch can still end with clean commits:

```terminal
{
  "title": "a fixup commit",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git diff",
      "output": "diff --git a/scripts/changes.sh b/scripts/changes.sh\nindex 376ab06..3ff943f 100755\n--- a/scripts/changes.sh\n+++ b/scripts/changes.sh\n@@ -4,5 +4,5 @@ set -euo pipefail\n cd \"$(dirname \"$0\")/..\"\n\n echo '<ul id=\"changes\">'\n-git log -5 --format='  <li>%h %s</li>'\n+git log -5 --no-merges --format='  <li>%h %s</li>'\n echo '</ul>'"
    },
    {
      "cmd": "git commit -q -a --fixup HEAD~1 && git push && git log --oneline -3",
      "output": "To /home/dev/server/status-page.git\n   5756dec..d4c03a3  feature/changes-list -> feature/changes-list\nd4c03a3 fixup! Add a script that lists recent changes\n5756dec Document the changes script\nca0ed97 Add a script that lists recent changes"
    }
  ]
}
```

While you were busy, Sam's pull request was merged into `main`:

```terminal
{
  "title": "meanwhile, main moves",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd ~/sam/status-page && git pull -q && echo \"queue   https://queue.example.com/\" >> services.txt && git commit -q -am \"Add the queue service\" && git push",
      "output": "To /home/dev/server/status-page.git\n   7c58821..935c340  main -> main"
    }
  ]
}
```

Before the merge, bring your branch up to date: rebase it onto the new `main` and fold the fixup into its commit in one go. `--autosquash` moves every `fixup!` commit behind the commit it fixes and squashes it. Since Git 2.44 it also works without `-i`; the `rebase.autoSquash true` setting turns it on by default, but only for interactive rebases, so keep the option on the command line here:

```terminal
{
  "title": "rebase onto main and squash the fixup",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd ~/projects/status-page && git fetch",
      "output": "From /home/dev/server/status-page\n   7c58821..935c340  main       -> origin/main"
    },
    {
      "cmd": "git rebase --autosquash origin/main",
      "output": "Successfully rebased and updated refs/heads/feature/changes-list."
    },
    {
      "cmd": "git log --oneline --graph -4",
      "output": "* 2195cb6 Document the changes script\n* fe16feb Add a script that lists recent changes\n* 935c340 Add the queue service\n*   7c58821 Merge branch 'docs/runbook'\n|\\"
    }
  ]
}
```

### 3. See what changed between two versions of the branch

After a rebase, the usual "compare" view is useless: every commit has a new hash and a new base. `git range-diff` compares two versions of a series commit by commit, which is what a reviewer wants to see after a force push. Compare what is on the remote (`@{upstream}`, the old version) with your branch:

```terminal
{
  "title": "git range-diff: old series vs new series",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git range-diff origin/main@{1}..@{upstream} origin/main..HEAD",
      "output": "1:  ca0ed97 ! 1:  fe16feb Add a script that lists recent changes\n    @@ scripts/changes.sh (new)\n     +cd \"$(dirname \"$0\")/..\"\n     +\n     +echo '<ul id=\"changes\">'\n    -+git log -5 --format='  <li>%h %s</li>'\n    ++git log -5 --no-merges --format='  <li>%h %s</li>'\n     +echo '</ul>'\n2:  5756dec = 2:  2195cb6 Document the changes script\n3:  d4c03a3 < -:  ------- fixup! Add a script that lists recent changes"
    }
  ]
}
```

Each line pairs an old commit with a new one: `!` means the commit changed (followed by a diff of the two diffs), `=` means it is the same change, and `<` means the commit exists only in the old series (the fixup, now part of the first commit). `origin/main@{1}` is where `origin/main` was before the last fetch, which is the base the old series started from. GitHub and GitLab show a similar "compare changes" link after a force push.

Push the rewritten branch:

```terminal
{
  "title": "push the rewritten branch",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git push --force-with-lease --force-if-includes",
      "output": "To /home/dev/server/status-page.git\n + d4c03a3...2195cb6 feature/changes-list -> feature/changes-list (forced update)"
    }
  ]
}
```

### 4. Merge and clean up

Your team merges pull requests with a merge commit, so the branch stays visible in the history. On the hosting service, that is the green button; here it is the same Git operation:

```terminal
{
  "title": "merge the pull request",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git switch main && git pull && git merge --no-ff --no-edit feature/changes-list && git push",
      "output": "Switched to branch 'main'\nYour branch is behind 'origin/main' by 1 commit, and can be fast-forwarded.\n  (use \"git pull\" to update your local branch)\nUpdating 7c58821..935c340\nFast-forward\n services.txt | 1 +\n 1 file changed, 1 insertion(+)\nMerge made by the 'ort' strategy.\n README.md          | 1 +\n scripts/changes.sh | 8 ++++++++\n 2 files changed, 9 insertions(+)\n create mode 100755 scripts/changes.sh\nTo /home/dev/server/status-page.git\n   935c340..b9194f6  main -> main"
    },
    {
      "cmd": "git push origin --delete feature/changes-list && git branch -d feature/changes-list",
      "output": "To /home/dev/server/status-page.git\n - [deleted]         feature/changes-list\nDeleted branch feature/changes-list (was 2195cb6)."
    },
    {
      "cmd": "scripts/changes.sh",
      "output": "<ul id=\"changes\">\n  <li>2195cb6 Document the changes script</li>\n  <li>fe16feb Add a script that lists recent changes</li>\n  <li>935c340 Add the queue service</li>\n  <li>327dc74 Runbook: say who is on call</li>\n  <li>3c14138 Runbook: how to roll back a bad build</li>\n</ul>"
    }
  ]
}
```

## Merge Methods on a Pull Request

GitHub, GitLab and Bitbucket let the repository choose which merge buttons exist. They produce different histories from the same branch. To see them side by side, push a demo branch with two commits, then apply each method in a scratch clone:

```terminal
{
  "title": "a demo branch with two commits",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git switch -q -c demo/merge-methods && echo \"<!-- demo -->\" >> template.html && git commit -q -am \"Mark the template as a demo\" && echo \"/* demo */\" >> style.css && git commit -q -am \"Mark the stylesheet as a demo\""
    },
    {
      "cmd": "git push -q && git switch -q main"
    }
  ]
}
```

```terminal
{
  "title": "merge commit, squash and rebase, side by side",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "for m in merge squash rebase; do git clone -q ~/server/status-page.git /tmp/$m; done"
    },
    {
      "comment": "Create a merge commit",
      "cmd": "cd /tmp/merge && git merge -q --no-ff --no-edit origin/demo/merge-methods && git log --oneline --graph -4",
      "output": "*   3ab7a57 Merge remote-tracking branch 'origin/demo/merge-methods'\n|\\\n| * ee39b34 Mark the stylesheet as a demo\n| * 23d1534 Mark the template as a demo\n|/\n*   b9194f6 Merge branch 'feature/changes-list'\n|\\"
    },
    {
      "comment": "Squash and merge",
      "cmd": "cd /tmp/squash && git merge -q --squash origin/demo/merge-methods && git commit -q -m \"Mark the template and stylesheet as a demo (#12)\" && git log --oneline --graph -3",
      "output": "Squash commit -- not updating HEAD\n* 0e63e3b Mark the template and stylesheet as a demo (#12)\n*   b9194f6 Merge branch 'feature/changes-list'\n|\\\n| * 2195cb6 Document the changes script"
    },
    {
      "comment": "Rebase and merge",
      "cmd": "cd /tmp/rebase && git switch -q -c pr origin/demo/merge-methods && git rebase -q --force-rebase main && git switch -q main && git merge -q --ff-only pr && git log --oneline --graph -3",
      "output": "* d5a6aa8 Mark the stylesheet as a demo\n* 1c31218 Mark the template as a demo\n*   b9194f6 Merge branch 'feature/changes-list'\n|\\"
    },
    {
      "comment": "clean up: the scratch clones and the demo branch",
      "cmd": "cd ~/projects/status-page && rm -rf /tmp/merge /tmp/squash /tmp/rebase && git push -q origin --delete demo/merge-methods && git branch -q -D demo/merge-methods"
    }
  ]
}
```

| Method                | History on `main`                                     | Keep the branch's commits? | Good when                                                                         |
| --------------------- | ----------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------- |
| Create a merge commit | The branch's commits plus a merge commit              | Yes, unchanged             | Commits are clean and meaningful, and you want to see where each change came from |
| Squash and merge      | One new commit per pull request                       | No: one commit, new hash   | Branches have messy "wip" commits; one pull request is one change                 |
| Rebase and merge      | The branch's commits replayed on top, no merge commit | Copies with new hashes     | You want a linear history with every commit kept                                  |

`--force-rebase` in the demo makes new commits even though the branch was already on top of `main`, as GitHub's button does. Two side effects to know: after a squash or rebase merge, the branch's own commits are not in `main`, so `git branch -d` refuses to delete it unless its upstream (for example the same branch on the remote) still contains them ([Part 5](/guides/introduction-to-git/05-merging#h2-squash-merge-one-commit-for-the-whole-branch)), and commits that GitHub rewrites on "Rebase and merge" are not signed by you ([Part 9](/guides/introduction-to-git/09-best-practices#h2-sign-your-commits)). Many teams allow only one method, so the history looks the same everywhere.

## Stacked Branches with --update-refs

Sometimes the next change depends on one that is still in review. Instead of waiting, you **stack** a second branch on top of the first, and open a second pull request with the first branch as its base. The pain used to come when the first branch changed: after you rebased it, the second branch still pointed to the old commits. `git rebase --update-refs` (Git 2.38+) rewrites every branch in the stack in one go.

Create a stack: `docs/alerts` adds an alerts page, `docs/alerts.md`:

```markdown
# Alerts

The status page has no alerting of its own.

Page the on-call person when a service is down for 5 minutes.
Open a ticket when a service is slow for an hour.
Ignore single failed checks.
```

and links it from the runbook; `docs/alert-examples` builds on it with examples:

```terminal
{
  "title": "two stacked branches",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git switch -c docs/alerts && git add docs/alerts.md && git commit -q -m \"Add alert rules\" && alerts_commit=$(git rev-parse HEAD)",
      "output": "Switched to a new branch 'docs/alerts'"
    },
    {
      "cmd": "printf '\\nSee [the alert rules](alerts.md) before you page anyone.\\n' >> docs/runbook.md"
    },
    {
      "cmd": "git commit -q -am \"Link the alert rules from the runbook\""
    },
    {
      "cmd": "git switch -c docs/alert-examples",
      "output": "Switched to a new branch 'docs/alert-examples'"
    },
    {
      "cmd": "printf '\\n## Examples\\n\\n- api down since 09:00: page.\\n- docs slow all morning: ticket.\\n' >> docs/alerts.md"
    },
    {
      "cmd": "git commit -q -am \"Add alert examples\" && git log --oneline --graph -4",
      "output": "* bfbe1cc Add alert examples\n* ee08edd Link the alert rules from the runbook\n* fd8d60e Add alert rules\n*   b9194f6 Merge branch 'feature/changes-list'\n|\\"
    }
  ]
}
```

Review of the first pull request asks for a change in its first commit: say what the rules are for. Make the change on top of the stack as a fixup, then rebase the whole stack with `--update-refs`:

```terminal
{
  "title": "fix the bottom of the stack, rebase all of it",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "sed -i 's/^The status page has no alerting of its own\\./The status page has no alerting of its own; these rules are for the monitoring system./' docs/alerts.md"
    },
    {
      "cmd": "git commit -q -a --fixup \"$alerts_commit\""
    },
    {
      "cmd": "git rebase --autosquash --update-refs main",
      "output": "Successfully rebased and updated refs/heads/docs/alert-examples.\nUpdated the following refs with --update-refs:\n\trefs/heads/docs/alerts"
    },
    {
      "cmd": "git log --oneline --graph -4",
      "output": "* 59d529d Add alert examples\n* eb7a783 Link the alert rules from the runbook\n* a581423 Add alert rules\n*   b9194f6 Merge branch 'feature/changes-list'\n|\\"
    }
  ]
}
```

Both branches moved: `docs/alerts` now points to the rewritten second commit, and `docs/alert-examples` sits on top of it. Set `git config --global rebase.updateRefs true` to make this the default. Pushing the rewritten stack takes one command: `git push --force-with-lease --force-if-includes origin docs/alerts docs/alert-examples`.

The fixup and the commits after it change different lines of `docs/alerts.md`. Had the fixup touched the lines right next to a later commit's change, the rebase would have stopped with a conflict at that commit, as any rebase does. Keep fixups small and close to what they fix.

Merge the stack bottom first. Because each branch is now on top of the one below, both merge as fast-forwards:

```terminal
{
  "title": "merge the stack in order",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git switch main && git merge --ff-only docs/alerts && git merge --ff-only docs/alert-examples && git push",
      "output": "Switched to branch 'main'\nYour branch is up to date with 'origin/main'.\nUpdating b9194f6..eb7a783\nFast-forward\n docs/alerts.md  | 7 +++++++\n docs/runbook.md | 2 ++\n 2 files changed, 9 insertions(+)\n create mode 100644 docs/alerts.md\nUpdating eb7a783..59d529d\nFast-forward\n docs/alerts.md | 5 +++++\n 1 file changed, 5 insertions(+)\nTo /home/dev/server/status-page.git\n   b9194f6..59d529d  main -> main"
    },
    {
      "cmd": "git branch -d docs/alerts docs/alert-examples",
      "output": "Deleted branch docs/alerts (was eb7a783).\nDeleted branch docs/alert-examples (was 59d529d)."
    }
  ]
}
```

GitHub added stacked pull requests as a public preview in 2026, with a `gh stack` CLI extension (`gh extension install github/gh-stack`) that manages the branches and their pull requests; [Stacked pull requests on GitHub](/posts/github-stacked-pull-requests-public-preview) looks at what it fixes and when a stack is the wrong shape.

## Release Branches and Backports

If you support released versions while `main` moves on, you need a branch per release line and a way to copy fixes to it. Start `release/0.2` from the `v0.2.0` tag:

```terminal
{
  "title": "a release branch from a tag",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git switch -c release/0.2 v0.2.0 && git push -q && git switch main",
      "output": "Switched to a new branch 'release/0.2'\nSwitched to branch 'main'\nYour branch is up to date with 'origin/main'."
    }
  ]
}
```

A user reports that the footer is hard to read in dark mode. The fix goes to `main` first, like every change: a lighter footer color inside the dark scheme block of `style.css`.

```terminal
{
  "title": "fix on main, then copy it to the release branch",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git diff",
      "output": "diff --git a/style.css b/style.css\nindex 10a6775..62ada5b 100644\n--- a/style.css\n+++ b/style.css\n@@ -17,5 +17,8 @@ h1 { margin-bottom: 0.5rem; }\n   a {\n     color: #8ab4f8;\n   }\n+  footer {\n+    color: #aaa;\n+  }\n }\n li { margin: 0.25rem 0; }"
    },
    {
      "cmd": "git commit -q -am \"Fix the footer contrast in dark mode\" && git push -q && fix=$(git rev-parse HEAD) && git log --oneline -1",
      "output": "fe809bb Fix the footer contrast in dark mode"
    },
    {
      "cmd": "git switch release/0.2 && git cherry-pick -x \"$fix\"",
      "output": "Switched to branch 'release/0.2'\nYour branch is up to date with 'origin/release/0.2'.\nAuto-merging style.css\n[release/0.2 298425e] Fix the footer contrast in dark mode\n Date: Mon Oct 19 09:39:00 2026 +0000\n 1 file changed, 3 insertions(+)"
    },
    {
      "cmd": "git log -1 --format=%B",
      "output": "Fix the footer contrast in dark mode\n\n(cherry picked from commit fe809bb61ecd020bd8a0d255e92c327efb51949f)"
    },
    {
      "cmd": "git tag -a v0.2.1 -m \"Footer contrast fix\" && git push --follow-tags && git switch main",
      "output": "To /home/dev/server/status-page.git\n   3fe83c6..298425e  release/0.2 -> release/0.2\n * [new tag]         v0.2.1 -> v0.2.1\nSwitched to branch 'main'\nYour branch is up to date with 'origin/main'."
    }
  ]
}
```

`git cherry-pick` applies the changes of one commit as a new commit on the current branch. `-x` adds the "(cherry picked from commit ...)" line, so anyone can trace the backport to the original. Fix on `main` first and copy to release branches, not the other way round; otherwise the next release can miss the fix. [How to cherry-pick commits](/posts/how-to-cherry-pick-commits-in-git) covers ranges and conflicts.

## Choose a Workflow

| Workflow                    | How it works                                                                                                                               | Fits                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| **GitHub flow**             | `main` is always deployable; every change is a short branch and a pull request; deploy after merge                                         | Web services and teams that deploy often                                 |
| **Trunk-based development** | Everyone merges into `main` at least daily, through very short branches or straight commits; unfinished features hide behind feature flags | Teams with good automated tests and continuous delivery                  |
| **Release branches**        | GitHub flow plus a `release/x.y` branch per supported version, fixes cherry-picked from `main`                                             | Software that customers install and keep for a while                     |
| **Gitflow**                 | Long-lived `main` and `develop`, plus `feature/*`, `release/*` and `hotfix/*` branches with fixed merge rules                              | Scheduled releases of versioned software with several supported versions |
| **Forking workflow**        | Contributors push to their own fork and open pull requests to the original repository                                                      | Open source, or anywhere contributors cannot push to the main repository |

Most teams that deploy a service land on GitHub flow or trunk-based development: few long-lived branches, small pull requests, and `main` that always works. Gitflow adds a lot of merging for little gain when you deploy continuously; its author added a note to the original article in 2020 saying so, and recommending a simpler workflow such as GitHub flow for software that is delivered continuously ([A successful Git branching model](https://nvie.com/posts/a-successful-git-branching-model/)). It still fits products with planned releases and several maintained versions.

Whatever you pick, two rules matter more than the name: **keep branches short-lived** (days, not weeks), and **keep `main` releasable** (every merge passes the checks).

## Set Up the Repository for a Team

The workflow only holds if the hosting service enforces it. On GitHub, use **rulesets** (Settings, Rules; the older "branch protection rules" still work) for `main`:

- **Require a pull request before merging**, with at least one approval, and dismiss approvals when new commits are pushed.
- **Require status checks to pass**: your CI jobs ([the CI/CD guide](/guides/introduction-to-cicd) builds them).
- **Block force pushes** and **restrict deletions**.
- Optionally **require linear history** (allows only squash and rebase merges) and **require signed commits** ([Part 9](/guides/introduction-to-git/09-best-practices#h2-sign-your-commits)).
- A **merge queue** tests each pull request together with everything merged before it, so `main` stays green when many pull requests merge on the same day. It costs CI time per merge ([what one merge costs in CI](/posts/what-does-one-merge-cost-in-ci)).

A `CODEOWNERS` file (in `.github/`, the repository root or `docs/`) requests reviews automatically from the people responsible for each path, and with the "require review from code owners" rule, their approval is mandatory:

```text
# .github/CODEOWNERS: the last matching pattern wins
*                @OWNER/web-team
/scripts/        @OWNER/platform-team
/docs/runbook.md @OWNER/on-call
```

GitLab has the same ideas under other names: protected branches, approval rules, code owners and merge trains.

## Review Well

- **Small pull requests.** A few hundred changed lines at most. Split big changes into a stack.
- **Describe the why** in the pull request, link the issue, and say how you tested it.
- **Test the branch locally** when the diff is not enough. `gh pr checkout 123` does it in one step; with plain Git on GitHub, `git fetch origin pull/123/head:pr-123` fetches the pull request into a branch called `pr-123`.
- **After a force push, review with range-diff** (or the "compare" link) instead of reading everything again.
- **Do not let pull requests sit.** A branch that waits for a week needs a rebase and a second review.

## Common Mistakes

- **Long-lived feature branches.** Merge in small slices behind a feature flag instead.
- **Pushing fixups as "address review" commits and merging them as they are.** Squash them with `--autosquash` before merging, or use squash merges.
- **Fixing a bug only on the release branch.** Fix it on `main` and cherry-pick it to the release.
- **Settings that only exist in people's heads.** Put them into rulesets and `CODEOWNERS`.

## Summary

- A pull request is a branch plus review and checks; keep it small and open it early.
- Use fixup commits during review and `git rebase --autosquash origin/main` before merging; `git range-diff` shows what changed between pushes.
- Merge commits, squash merges and rebase merges give different histories; pick one for the repository.
- `git rebase --update-refs` keeps stacked branches in line.
- Fix on `main`, then `git cherry-pick -x` to release branches.
- GitHub flow or trunk-based development fits most teams that deploy continuously; rulesets enforce it.

Next: [Git History](/guides/introduction-to-git/08-history), where you search the history, find the commit that broke something, and undo it.

## Keep Learning

- [Git Workflow and Collaboration exercise](/exercises/git-workflow-collaboration)
- Interview questions: [Git workflow strategies](/interview-questions/junior/git-workflow-strategies) and [Git branching strategies](/interview-questions/junior/git-branching-strategies)
- [What cherry-picking a commit means](/posts/git-cherry-pick-commit)
- [Create a remote Git branch](/posts/create-remote-git-branch)
