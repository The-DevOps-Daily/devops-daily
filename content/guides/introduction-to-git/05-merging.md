---
title: 'Git Merge and Rebase: Resolve Merge Conflicts'
description: 'Merge Git branches (fast-forward, merge commit, squash), resolve merge conflicts step by step, rebase onto main, and pick merge or rebase.'
order: 5
---

A branch is only useful once its work gets back into `main`. Git has two ways to do that: **merging**, which joins two lines of history, and **rebasing**, which replays your commits on top of the other line. This part shows both on the project, with the real output, including the part people dread: a **merge conflict**, where both sides changed the same lines and Git needs you to decide.

## Prerequisites

- The `status-page` repository from [Part 4](/guides/introduction-to-git/04-branching): `main` has a README fix and `feature/dark-mode` has two commits.
- Branching basics: `git switch -c`, `git log --graph` ([Part 4](/guides/introduction-to-git/04-branching)).

Before merging anything, start one more branch from the current `main`. It adds a service and documents the build; you come back to it in the rebase section:

```terminal
{
  "title": "a branch for later",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd ~/projects/status-page && git switch -c feature/status-service",
      "output": "Switched to a new branch 'feature/status-service'"
    },
    {
      "cmd": "echo \"status  https://status.example.com/\" >> services.txt && git commit -q -am \"Add the status service\""
    },
    {
      "cmd": "printf '\\n## Build\\n\\nRun `scripts/build.sh`. It checks services.txt and writes build/index.html.\\n' >> README.md"
    },
    {
      "cmd": "git commit -q -am \"Document how to build the page\" && git switch main",
      "output": "Switched to branch 'main'"
    }
  ]
}
```

## How Git Merges

To merge branch `B` into your current branch `A`, Git finds the **merge base**: the newest commit both branches share. What happens next depends on whether `A` has moved since then.

- **Fast-forward.** If `A` has no new commits since the merge base, `B` simply contains everything in `A`. Git moves `A`'s pointer forward to `B`'s commit. No new commit is made and the history stays a straight line.
- **Three-way merge.** If both branches have new commits, Git compares the merge base with each side. Changes made on only one side are taken as they are. Changes to the same lines on both sides are a **conflict**. If there are no conflicts, Git records the result as a **merge commit** with two parents.

```diagram
{
  "type": "branch",
  "nodes": [
    { "label": "merge base", "sub": "newest shared commit", "icon": "box", "tone": "slate" },
    { "label": "compare both sides", "sub": "with the merge base", "icon": "gear", "tone": "blue" }
  ],
  "branch": [
    { "label": "only one side moved: fast-forward", "variant": "good" },
    { "label": "both moved, different lines: merge commit", "variant": "good" },
    { "label": "both changed the same lines: conflict", "variant": "bad" }
  ]
}
```

## Fast-Forward Merge

A small fix on its own branch, then a merge while `main` has not moved:

```terminal
{
  "title": "a fast-forward merge",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git switch -c fix/footer-text",
      "output": "Switched to a new branch 'fix/footer-text'"
    },
    {
      "cmd": "sed -i 's|<footer>Built by scripts/build.sh</footer>|<footer>Updated each time scripts/build.sh runs</footer>|' template.html && git commit -q -am \"Clarify the footer text\""
    },
    {
      "cmd": "git switch main && git merge fix/footer-text",
      "output": "Switched to branch 'main'\nUpdating d81047d..f75ae3c\nFast-forward\n template.html | 2 +-\n 1 file changed, 1 insertion(+), 1 deletion(-)"
    },
    {
      "cmd": "git branch -d fix/footer-text",
      "output": "Deleted branch fix/footer-text (was f75ae3c)."
    }
  ]
}
```

"Fast-forward" means `main` now points to the same commit as `fix/footer-text`. `git branch -d` deleted the branch without complaint because its work is in `main`.

## Merge Commit (Three-Way Merge)

`feature/dark-mode` and `main` have both moved since the branch started, so merging it makes a merge commit:

```terminal
{
  "title": "a merge commit",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git log --oneline --graph main feature/dark-mode -6",
      "output": "* f75ae3c Clarify the footer text\n* d81047d Fix a typo in the README\n| * c0fce2c Use a muted color for the footer\n| * 121173b Add a dark color scheme\n|/\n* 1451c97 Add the web-2 service\n* 1e24459 Add spacing below the heading"
    },
    {
      "cmd": "git merge --no-edit feature/dark-mode",
      "output": "Merge made by the 'ort' strategy.\n style.css | 12 ++++++++++++\n 1 file changed, 12 insertions(+)"
    },
    {
      "cmd": "git log --oneline --graph -6",
      "output": "*   4843c1b Merge branch 'feature/dark-mode'\n|\\\n| * c0fce2c Use a muted color for the footer\n| * 121173b Add a dark color scheme\n* | f75ae3c Clarify the footer text\n* | d81047d Fix a typo in the README\n|/\n* 1451c97 Add the web-2 service"
    },
    {
      "comment": "a merge commit has two parents",
      "cmd": "git log -1 --format=\"commit %h, parents %p\"",
      "output": "commit 4843c1b, parents f75ae3c c0fce2c"
    },
    {
      "cmd": "git branch -d feature/dark-mode",
      "output": "Deleted branch feature/dark-mode (was c0fce2c)."
    }
  ]
}
```

Without `--no-edit`, Git opens your editor with the message `Merge branch 'feature/dark-mode'` so you can add why the merge happened; saving the file accepts it. The branch's work is now in `main`, so `git branch -d` deletes it without complaint. "ort" is Git's default merge strategy since Git 2.34; it handles renames, and `-s recursive` is now only another name for it.

## Choose How a Merge Is Recorded

| Option         | Result                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------- |
| (none), `--ff` | Fast-forward when possible, otherwise a merge commit. The default                                             |
| `--no-ff`      | Always a merge commit, even when a fast-forward is possible, so the branch stays visible in the history       |
| `--ff-only`    | Fast-forward or nothing: refuse if a merge commit would be needed                                             |
| `--squash`     | Put all of the branch's changes into the staging area as one change, for you to commit as a single new commit |

Hosting platforms offer the same choice as buttons on a pull request ("Create a merge commit", "Squash and merge", "Rebase and merge"); [Part 7](/guides/introduction-to-git/07-collaboration#h2-merge-methods-on-a-pull-request) compares them. To make one behavior the default, set `merge.ff` (`false` for always `--no-ff`, `only` for always `--ff-only`).

## Resolve a Merge Conflict

A conflict happens when both branches changed the same lines (or one changed a file the other deleted). Set one up: on a branch, put the team name in the page heading; on `main`, reword the same heading:

```terminal
{
  "title": "two changes to the same line",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git switch -c feature/heading",
      "output": "Switched to a new branch 'feature/heading'"
    },
    {
      "cmd": "sed -i 's|<h1>Service status</h1>|<h1>Example Team service status</h1>|' template.html && git commit -q -am \"Put the team name in the heading\""
    },
    {
      "cmd": "git switch main",
      "output": "Switched to branch 'main'"
    },
    {
      "cmd": "sed -i 's|<h1>Service status</h1>|<h1>Status of our services</h1>|' template.html && git commit -q -am \"Reword the page heading\""
    }
  ]
}
```

Now merge:

```terminal
{
  "title": "CONFLICT",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git merge feature/heading",
      "output": "Auto-merging template.html\nCONFLICT (content): Merge conflict in template.html\nAutomatic merge failed; fix conflicts and then commit the result."
    },
    {
      "cmd": "git status",
      "output": "On branch main\nYou have unmerged paths.\n  (fix conflicts and run \"git commit\")\n  (use \"git merge --abort\" to abort the merge)\n\nUnmerged paths:\n  (use \"git add <file>...\" to mark resolution)\n\tboth modified:   template.html\n\nno changes added to commit (use \"git add\" and/or \"git commit -a\")"
    }
  ]
}
```

The merge stopped halfway. Files without conflicts are already merged and staged; `template.html` is listed under "Unmerged paths". Git wrote both versions into the file, between **conflict markers**:

```terminal
{
  "title": "the conflict markers",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "sed -n '8,14p' template.html",
      "output": "  <body>\n<<<<<<< HEAD\n    <h1>Status of our services</h1>\n=======\n    <h1>Example Team service status</h1>\n>>>>>>> feature/heading\n    <ul id=\"services\"></ul>"
    }
  ]
}
```

- `<<<<<<< HEAD` starts your side: the branch you are on (`main`).
- `=======` separates the two sides.
- `>>>>>>> feature/heading` ends their side: the branch you are merging in.

### Abort, or see the original too

If you are not ready to deal with it, `git merge --abort` puts everything back to how it was before the merge:

```terminal
{
  "title": "git merge --abort",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git merge --abort && git status --short && git log --oneline -1",
      "output": "da2194e Reword the page heading"
    }
  ]
}
```

The default markers show the two results but not what the line looked like before either change. The `zdiff3` conflict style adds the merge base between `|||||||` and `=======`, which often makes the right answer obvious. It is worth turning on for good:

```terminal
{
  "title": "merge again with zdiff3 markers",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git config --global merge.conflictStyle zdiff3"
    },
    {
      "cmd": "git merge feature/heading",
      "output": "Auto-merging template.html\nCONFLICT (content): Merge conflict in template.html\nAutomatic merge failed; fix conflicts and then commit the result."
    },
    {
      "cmd": "sed -n '8,16p' template.html",
      "output": "  <body>\n<<<<<<< HEAD\n    <h1>Status of our services</h1>\n||||||| 4843c1b\n    <h1>Service status</h1>\n=======\n    <h1>Example Team service status</h1>\n>>>>>>> feature/heading\n    <ul id=\"services\"></ul>"
    }
  ]
}
```

Now you can see that the original was `Service status`: one side added the team name, the other reworded it. The right result combines both. (`git checkout --conflict=zdiff3 <file>` rewrites the markers of a file that is already in conflict, if you turn the setting on in the middle of a merge.)

### Fix the file, stage it, commit

Edit `template.html`: keep the line you want and delete all marker lines. Git 2.56 added `git add --resolved`, which stages the files that were in conflict and refuses while markers are still in them. Try it before editing:

```terminal
{
  "title": "resolve, stage, commit",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git add --resolved",
      "output": "fatal: the following paths still have conflict markers:\n\ttemplate.html"
    },
    {
      "comment": "edit the file: keep one heading, remove the markers"
    },
    {
      "cmd": "git diff",
      "output": "diff --cc template.html\nindex 7c2d52c,9a426ec..0000000\n--- a/template.html\n+++ b/template.html\n@@@ -6,7 -6,7 +6,7 @@@\n      <link rel=\"stylesheet\" href=\"style.css\" />\n    </head>\n    <body>\n-     <h1>Status of our services</h1>\n -    <h1>Example Team service status</h1>\n++    <h1>Example Team: status of our services</h1>\n      <ul id=\"services\"></ul>\n      <footer>Updated each time scripts/build.sh runs</footer>\n    </body>"
    },
    {
      "cmd": "git add --resolved && git status --short",
      "output": "M  template.html"
    },
    {
      "cmd": "git commit --no-edit",
      "output": "[main 48fdfbd] Merge branch 'feature/heading'"
    },
    {
      "cmd": "git log --oneline --graph -5",
      "output": "*   48fdfbd Merge branch 'feature/heading'\n|\\\n| * 506e223 Put the team name in the heading\n* | da2194e Reword the page heading\n|/\n*   4843c1b Merge branch 'feature/dark-mode'\n|\\\n| * c0fce2c Use a muted color for the footer"
    }
  ]
}
```

`git diff` during a conflict shows a **combined diff** with two columns of `+` and `-`, one per parent; here it shows the new line replacing both versions. `git add <file>` also marks a file as resolved; `--resolved` is safer because it checks for leftover markers and leaves your other unstaged changes alone. `git merge --continue` works as well as `git commit` to finish.

Some shortcuts for whole files:

```bash
git checkout --ours template.html     # keep your version of the whole file
git checkout --theirs template.html   # take their version of the whole file
git log --merge -p template.html      # the commits on both sides that touched the file
```

### Use a merge tool

A merge tool shows the two sides and the base next to each other. Git knows many tools by name; set one and run `git mergetool` during a conflict:

```tabs
{
  "title": "Configure a merge tool",
  "tabs": [
    {
      "label": "VS Code",
      "lang": "bash",
      "code": "# Git knows VS Code; it runs: code --wait --merge REMOTE LOCAL BASE MERGED\ngit config --global merge.tool vscode\ngit mergetool"
    },
    {
      "label": "Vim / Neovim",
      "lang": "bash",
      "code": "git config --global merge.tool vimdiff   # or nvimdiff\ngit mergetool"
    },
    {
      "label": "Meld",
      "lang": "bash",
      "code": "git config --global merge.tool meld\ngit mergetool"
    }
  ]
}
```

`git mergetool --tool-help` lists the tools Git found on your system. Most editors (VS Code, JetBrains IDEs) also detect conflict markers on their own and offer "Accept current", "Accept incoming" and "Accept both" buttons. To practice without breaking anything, try the [Git merge conflict simulator](/games/git-merge-conflict-simulator).

## Rebase: Replay Your Commits on Top of main

`feature/status-service` started before the merges above, so `main` has moved on. `A..B` means "commits in `B` that are not in `A`" ([Part 8](/guides/introduction-to-git/08-history#h2-compare-commits-and-branches) has more on ranges). A fast-forward is no longer possible:

```terminal
{
  "title": "the branch is behind main",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "comment": "commits on the branch that main does not have",
      "cmd": "git log --oneline main..feature/status-service",
      "output": "e6e5421 Document how to build the page\n86b128a Add the status service"
    },
    {
      "comment": "and how many commits main has that the branch does not",
      "cmd": "git rev-list --count feature/status-service..main",
      "output": "7"
    },
    {
      "cmd": "git merge --ff-only feature/status-service",
      "output": "hint: Diverging branches can't be fast-forwarded, you need to either:\nhint:\nhint: \tgit merge --no-ff\nhint:\nhint: or:\nhint:\nhint: \tgit rebase\nhint:\nhint: Disable this message with \"git config set advice.diverging false\"\nfatal: Not possible to fast-forward, aborting."
    }
  ]
}
```

Instead of a merge commit, you can **rebase** the branch: Git takes the branch's commits, sets them aside, moves the branch to the tip of `main`, and applies the commits again one by one:

```terminal
{
  "title": "git rebase main",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git switch feature/status-service",
      "output": "Switched to branch 'feature/status-service'"
    },
    {
      "cmd": "git rebase main",
      "output": "Successfully rebased and updated refs/heads/feature/status-service."
    },
    {
      "cmd": "git log --oneline --graph main feature/status-service -4",
      "output": "* 956d666 Document how to build the page\n* 83d2188 Add the status service\n*   48fdfbd Merge branch 'feature/heading'\n|\\\n| * 506e223 Put the team name in the heading"
    },
    {
      "cmd": "git switch main && git merge --ff-only feature/status-service && git branch -d feature/status-service",
      "output": "Switched to branch 'main'\nUpdating 48fdfbd..956d666\nFast-forward\n README.md    | 4 ++++\n services.txt | 1 +\n 2 files changed, 5 insertions(+)\nDeleted branch feature/status-service (was 956d666)."
    }
  ]
}
```

The two commits have **new hashes**: they are new commits with the same changes and messages, but a different parent. The old ones still exist for a while: right after a rebase, `ORIG_HEAD` points to where the branch was before it (the next merge or reset overwrites `ORIG_HEAD`), and the reflog keeps the old tip for weeks, which is how you [undo a rebase](/posts/undo-git-rebase).

If a commit does not apply cleanly, the rebase stops at that commit with conflict markers, just like a merge. Fix the files, `git add` them, and run `git rebase --continue`. `git rebase --skip` drops the commit that stopped, and `git rebase --abort` returns everything to how it was before.

:::warning
Rebase only commits that nobody else has. Rebasing a branch that others have pulled gives it new commits with new hashes; their copies still have the old ones, and the next pull mixes both. For your own branch that you pushed only for review, rebasing and force-pushing with `--force-with-lease` is normal ([Part 6](/guides/introduction-to-git/06-remote-repositories#h2-force-push-safely)).
:::

## Squash Merge: One Commit for the Whole Branch

A branch with several small "wip" commits can be merged as one commit with `--squash`:

```terminal
{
  "title": "git merge --squash",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git switch -q -c feature/more-services"
    },
    {
      "cmd": "for s in search auth cdn; do printf '%-7s https://%s.example.com/\\n' \"$s\" \"$s\" >> services.txt; git commit -q -am \"Add the $s service\"; done; git log --oneline -3",
      "output": "7961b45 Add the cdn service\n36ab218 Add the auth service\ne5e8125 Add the search service"
    },
    {
      "cmd": "git switch main && git merge --squash feature/more-services",
      "output": "Switched to branch 'main'\nUpdating 956d666..7961b45\nFast-forward\nSquash commit -- not updating HEAD\n services.txt | 3 +++\n 1 file changed, 3 insertions(+)"
    },
    {
      "cmd": "git commit -m \"Add the search, auth and cdn services\"",
      "output": "[main 3fe83c6] Add the search, auth and cdn services\n 1 file changed, 3 insertions(+)"
    },
    {
      "comment": "no output: main and the branch have identical files",
      "cmd": "git diff main feature/more-services"
    },
    {
      "cmd": "git branch -d feature/more-services",
      "output": "error: the branch 'feature/more-services' is not fully merged\nhint: If you are sure you want to delete it, run 'git branch -D feature/more-services'\nhint: Disable this message with \"git config set advice.forceDeleteBranch false\""
    }
  ]
}
```

The squash commit has one parent and no link to the branch, so Git cannot tell that the branch's commits are in `main`, and `git branch -d` refuses. That is expected after a squash merge. The empty `git diff` right before it confirmed that `main` has exactly the branch's files, so the work landed and `git branch -D feature/more-services` is safe. The same happens after "Squash and merge" on GitHub or GitLab.

Clean up the merged branches and tag the second release:

```terminal
{
  "title": "clean up and tag v0.2.0",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git branch -D feature/more-services && git branch -d feature/heading",
      "output": "Deleted branch feature/more-services (was 7961b45).\nDeleted branch feature/heading (was 506e223)."
    },
    {
      "cmd": "git tag -a v0.2.0 -m \"Dark mode, more services, new heading\" && git tag -n",
      "output": "v0.1.0          First release: three services, build and check scripts\nv0.2.0          Dark mode, more services, new heading"
    }
  ]
}
```

## Merge or Rebase?

Both end with the same files. They differ in the history they leave behind:

|                         | Merge                                          | Rebase                                                    |
| ----------------------- | ---------------------------------------------- | --------------------------------------------------------- |
| History                 | Keeps what really happened, with merge commits | A straight line, as if you started from the newest `main` |
| Commits                 | Unchanged, same hashes                         | Rewritten, new hashes                                     |
| Conflicts               | Resolved once, in the merge commit             | Possibly once per replayed commit                         |
| Safe on shared branches | Yes                                            | No: only on branches only you use                         |
| Good for                | Integrating finished work into `main`          | Updating your own branch before review, tidying commits   |

A common combination: rebase your own branch onto the latest `main` while you work on it (`git fetch`, then `git rebase origin/main`; [Part 6](/guides/introduction-to-git/06-remote-repositories) sets up `origin`), and let the team's pull request merge method decide how it lands. [Rebase vs merge](/interview-questions/junior/git-rebase-vs-merge) is also a classic interview question.

## Merge Strategy Options

You rarely need these, but they are worth knowing:

| Command                                     | Effect                                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `git merge -X ours <branch>`                | On conflicting hunks only, keep your side; other changes from the branch still merge in           |
| `git merge -X theirs <branch>`              | On conflicting hunks only, take their side                                                        |
| `git merge -X ignore-space-change <branch>` | Treat whitespace-only changes as unchanged, which avoids conflicts from reformatting              |
| `git merge -s ours <branch>`                | Record a merge but keep your tree completely; used to mark a branch as merged without its changes |
| `git merge a b c`                           | An "octopus" merge of several branches at once; only works without conflicts                      |

`-X ours` and `-s ours` are easy to mix up: the first is an option of the normal strategy, the second is a different strategy that ignores the other branch entirely. If you resolve the same conflict again and again (for example while rebasing a long-lived branch), `rerere` can record and replay your resolution ([Part 10](/guides/introduction-to-git/10-advanced-techniques#h2-reuse-conflict-resolutions-with-rerere)).

To copy a single commit from one branch to another without merging the branch, use `git cherry-pick`; [Part 7](/guides/introduction-to-git/07-collaboration#h2-release-branches-and-backports) uses it to backport a fix.

## Common Mistakes

- **Committing conflict markers.** Search for `<<<<<<<` before you commit, or use `git add --resolved`, which refuses.
- **Resolving by deleting the other side without reading it.** The other change was made for a reason; zdiff3 markers show what the line looked like before both changes.
- **Rebasing a shared branch.** Merge `main` into it instead, or agree with everyone using it first.
- **`git pull` merges you did not mean to make.** Choose a pull strategy once ([Part 6](/guides/introduction-to-git/06-remote-repositories#h2-pull-merge-or-rebase)).
- **Deleting a squash-merged branch with `-D` without checking.** `-D` deletes unmerged work too. Compare the snapshots first, as above; if `main` has moved on since the squash merge, review what the diff still shows.
- **"refusing to merge unrelated histories".** Two repositories with no common commit; see [this post](/posts/git-refusing-merge-unrelated-histories) before adding `--allow-unrelated-histories`.

## Summary

- A merge finds the merge base; it fast-forwards when only one side moved and makes a merge commit when both did.
- `--no-ff`, `--ff-only` and `--squash` choose how the result is recorded.
- In a conflict, read both sides (zdiff3 also shows the base), edit the file, stage it with `git add --resolved`, and commit. `git merge --abort` gets you out.
- `git rebase main` replays your commits on top of `main` with new hashes; never rebase commits others already have.

Next: [Working with Remote Repositories](/guides/introduction-to-git/06-remote-repositories), where the project gets a server and a second developer.

## Keep Learning

- [How to resolve merge conflicts](/posts/how-do-i-resolve-merge-conflicts-in-a-git-repository) and [how to abort a merge](/posts/abort-merge-conflict-git)
- [Undo a merge that has not been pushed](/posts/undo-git-merge-not-pushed)
- [Squash your last N commits](/posts/how-do-i-squash-my-last-n-commits-together)
- [See the differences between two branches](/posts/see-differences-between-branches-git)
