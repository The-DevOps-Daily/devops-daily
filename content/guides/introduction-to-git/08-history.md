---
title: 'Git History: Log, Blame, Bisect, Revert and Reflog'
description: 'Search Git history by message, file and content, find who changed a line, bisect a bug, undo with reset, revert and the reflog, and remove a leaked secret.'
order: 8
---

Every commit you make is a record you can search later: what changed, who changed it, when, and (if the message is good) why. This part shows how to get answers out of that record, how to find the commit that broke something with `git bisect`, and how to undo or rewrite commits safely. It ends with the one rewrite you hope you never need: removing a leaked secret from the whole history.

## Prerequisites

- The `status-page` repository from [Part 7](/guides/introduction-to-git/07-collaboration), with Sam's clone. Any repository with some history works for the search commands.
- Comfort with commits and branches ([Parts 3 to 5](/guides/introduction-to-git/03-tracking-changes)).

Sam spent the morning adding services and pushed seven small commits. To follow along, make Sam's commits in Sam's clone (the small `add` function adds one service per commit):

```terminal
{
  "title": "Sam's commits",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd ~/sam/status-page && git pull -q"
    },
    {
      "cmd": "add() { printf '%-7s %s\\n' \"$1\" \"$2\" >> services.txt && git commit -q -am \"Add the $1 service\"; }"
    },
    {
      "cmd": "add mail https://mail.example.com/ && add grafana https://grafana.example.com/ && add legacy http://legacy.example.com/ && add maps https://maps.example.com/ && add cache https://cache.example.com/"
    },
    {
      "cmd": "printf '\\nServices must use HTTPS. Lines starting with # are comments.\\n' >> README.md && git commit -q -am \"Describe the services file format\""
    },
    {
      "cmd": "echo 'a { font-weight: 600; }' >> style.css && git commit -q -am \"Make service links bold\" && git push -q"
    }
  ]
}
```

Then pull them into your clone:

```terminal
{
  "title": "pull Sam's commits",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd ~/projects/status-page && git pull",
      "output": "From /home/dev/server/status-page\n   fe809bb..1c7e00b  main       -> origin/main\nUpdating fe809bb..1c7e00b\nFast-forward\n README.md    | 2 ++\n services.txt | 5 +++++\n style.css    | 1 +\n 3 files changed, 8 insertions(+)"
    }
  ]
}
```

## Read the Log Your Way

`git log` takes dozens of options; a handful cover most needs:

```terminal
{
  "title": "views of the same history",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git log --oneline --graph -12",
      "output": "* 1c7e00b Make service links bold\n* 9c7e38a Describe the services file format\n* ab569ef Add the cache service\n* 91d086b Add the maps service\n* 386e1c5 Add the legacy service\n* ffe4e11 Add the grafana service\n* 312b915 Add the mail service\n* fe809bb Fix the footer contrast in dark mode\n* 59d529d Add alert examples\n* eb7a783 Link the alert rules from the runbook\n* a581423 Add alert rules\n*   b9194f6 Merge branch 'feature/changes-list'\n|\\"
    },
    {
      "comment": "a custom format: short hash, date, author, subject",
      "cmd": "git log --format=\"%h %ad %<(5)%an %s\" --date=short -5",
      "output": "1c7e00b 2026-10-20 Sam   Make service links bold\n9c7e38a 2026-10-20 Sam   Describe the services file format\nab569ef 2026-10-20 Sam   Add the cache service\n91d086b 2026-10-20 Sam   Add the maps service\n386e1c5 2026-10-20 Sam   Add the legacy service"
    },
    {
      "comment": "commits per author",
      "cmd": "git shortlog -sn HEAD",
      "output": "    32\tDev\n    10\tSam"
    }
  ]
}
```

| Format placeholder | Shows                | Placeholder  | Shows                            |
| ------------------ | -------------------- | ------------ | -------------------------------- |
| `%h`, `%H`         | Short and full hash  | `%an`, `%ae` | Author name and email            |
| `%s`, `%b`         | Subject and body     | `%ad`, `%ar` | Author date (absolute, relative) |
| `%d`               | Branch and tag names | `%cn`, `%cd` | Committer name and date          |

`--date=short`, `--date=iso` and `--date=relative` change how `%ad` is printed. Give `git shortlog` a revision such as `HEAD` in scripts: without one, it reads a log from standard input whenever that is not a terminal. Put a format you like in an alias ([Part 9](/guides/introduction-to-git/09-best-practices#h2-settings-and-aliases-worth-having)).

## Search the History

### By message, author and date

```terminal
{
  "title": "filter by message, author and date",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git log --oneline -i --grep=\"runbook\"",
      "output": "eb7a783 Link the alert rules from the runbook\n7c58821 Merge branch 'docs/runbook'\n327dc74 Runbook: say who is on call\n3c14138 Runbook: how to roll back a bad build\n30ce073 Add a runbook for the status page"
    },
    {
      "cmd": "git log --oneline --author=\"Sam\" --since=\"2026-10-20\"",
      "output": "1c7e00b Make service links bold\n9c7e38a Describe the services file format\nab569ef Add the cache service\n91d086b Add the maps service\n386e1c5 Add the legacy service\nffe4e11 Add the grafana service\n312b915 Add the mail service"
    },
    {
      "cmd": "git log --oneline --since=\"2026-10-15\" --until=\"2026-10-15 23:59\"",
      "output": "3fe83c6 Add the search, auth and cdn services\n956d666 Document how to build the page\n83d2188 Add the status service\n48fdfbd Merge branch 'feature/heading'\nda2194e Reword the page heading\n506e223 Put the team name in the heading\n4843c1b Merge branch 'feature/dark-mode'\nf75ae3c Clarify the footer text"
    }
  ]
}
```

`--grep` searches commit messages (`-i` ignores case), `--author` matches name or email, and `--since`/`--until` accept dates and phrases such as `"2 weeks ago"`. Different kinds of filters combine with AND. Several `--grep` options match commits whose message matches any of them (`--all-match` requires all of them), and several `--author` options match any of the authors.

### By file

```terminal
{
  "title": "the history of one file, across a rename",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git log --oneline -- docs/runbook.md",
      "output": "eb7a783 Link the alert rules from the runbook\n327dc74 Runbook: say who is on call\n3c14138 Runbook: how to roll back a bad build\n30ce073 Add a runbook for the status page"
    },
    {
      "cmd": "git log --oneline -- template.html",
      "output": "48fdfbd Merge branch 'feature/heading'\nda2194e Reword the page heading\n506e223 Put the team name in the heading\nf75ae3c Clarify the footer text\nb764ae4 Rename index.html to template.html"
    },
    {
      "cmd": "git log --oneline --follow -- template.html",
      "output": "da2194e Reword the page heading\n506e223 Put the team name in the heading\nf75ae3c Clarify the footer text\nb764ae4 Rename index.html to template.html\n5c559e6 Add a footer to the page\n3c83098 Add the team name to the page title\n46b8da1 Add the first version of the status page"
    }
  ]
}
```

`-- <path>` limits the log to commits that changed that path. Without `--follow`, the history of `template.html` starts at the rename; with it, Git continues through the commits when the file was still `index.html`. Add `-p` to see each change. [View the change history of a file](/posts/view-file-change-history-git) has more variations, including GUI tools.

### By content: the pickaxe

To find when a piece of text appeared or disappeared, search the diffs instead of the messages:

```terminal
{
  "title": "git log -S and -G",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git log --oneline -S \"billing\"",
      "output": "2a24e58 Add the billing service"
    },
    {
      "cmd": "git log --oneline -G \"font-weight\"",
      "output": "1c7e00b Make service links bold"
    }
  ]
}
```

- `-S <text>` (the **pickaxe**) finds commits that changed how many times the text occurs: the commit that added it and the one that removed it.
- `-G <regex>` finds commits whose diff has an added or removed line matching the regular expression, including lines that were only edited.

### By line: the history of a few lines

`git log -L` follows a range of lines through the history and shows each change to them, even when the lines moved:

```terminal
{
  "title": "every change to the page heading",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git log -L '/<h1>/,+1:template.html' --format=\"%h %s\"",
      "output": "48fdfbd Merge branch 'feature/heading'\n506e223 Put the team name in the heading\n\ndiff --git a/template.html b/template.html\nindex 85a32f2..9a426ec 100644\n--- a/template.html\n+++ b/template.html\n@@ -9,1 +9,1 @@\n-    <h1>Service status</h1>\n+    <h1>Example Team service status</h1>\nda2194e Reword the page heading\n\ndiff --git a/template.html b/template.html\nindex 85a32f2..7c2d52c 100644\n--- a/template.html\n+++ b/template.html\n@@ -9,1 +9,1 @@\n-    <h1>Service status</h1>\n+    <h1>Status of our services</h1>\n46b8da1 Add the first version of the status page\n\ndiff --git a/index.html b/index.html\nnew file mode 100644\nindex 0000000..7df7dcb\n--- /dev/null\n+++ b/index.html\n@@ -0,0 +9,1 @@\n+    <h1>Service status</h1>"
    }
  ]
}
```

The range can be line numbers (`-L 9,12:file`), a regular expression and an offset as above, or a function name in languages Git understands (`-L :main:app.py`).

## Show Old Versions of Files

```terminal
{
  "title": "a file as it was, and a deleted file",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git show v0.1.0:services.txt",
      "output": "# name  URL\napi     https://api.example.com/health\nweb     https://www.example.com/\ndocs    https://docs.example.com/"
    },
    {
      "comment": "which commits deleted files, and which files?",
      "cmd": "git log --oneline --diff-filter=D --name-only",
      "output": "db2cdcd Stop tracking notes.txt\nnotes.txt"
    },
    {
      "cmd": "git show db2cdcd^:notes.txt",
      "output": "ask Sam about the docs URL"
    }
  ]
}
```

`<commit>:<path>` names a file as it was in that commit, and `<commit>^` is that commit's parent: the last version before the deletion. To bring an old version back into your working tree, use `git restore --source=<commit> -- <path>` ([reset or revert a file to a specific revision](/posts/how-to-reset-revert-file-to-specific-revision), [find and restore a deleted file](/posts/find-restore-deleted-file-git)). `git show --stat <commit>` or `git show --name-only <commit>` lists the files a commit changed ([more ways](/posts/list-files-in-commit-git)).

## Compare Commits and Branches

`git diff` takes two commits, or a range:

```terminal
{
  "title": "diff between tags and branches",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git diff --stat v0.1.0 v0.2.1",
      "output": " README.md     |  6 +++++-\n services.txt  |  5 +++++\n style.css     | 15 +++++++++++++++\n template.html |  4 ++--\n 4 files changed, 27 insertions(+), 3 deletions(-)"
    },
    {
      "cmd": "git diff main release/0.2 -- style.css",
      "output": "diff --git a/style.css b/style.css\nindex 5081f63..ab1de81 100644\n--- a/style.css\n+++ b/style.css\n@@ -21,5 +21,3 @@ h1 { margin-bottom: 0.5rem; }\n     color: #aaa;\n   }\n }\n-li { margin: 0.25rem 0; }\n-a { font-weight: 600; }"
    },
    {
      "comment": "commits on release/0.2 without an equivalent change on main",
      "cmd": "git cherry -v main release/0.2",
      "output": "+ 298425e7d7d02e32abc8c390a1594b7a3e7107a7 Fix the footer contrast in dark mode"
    },
    {
      "cmd": "git log --oneline --grep=\"cherry picked from commit\" release/0.2",
      "output": "298425e Fix the footer contrast in dark mode"
    }
  ]
}
```

`git cherry` compares changes rather than hashes: a commit on `release/0.2` whose diff also exists on `main` is marked `-`, and one without an equivalent is marked `+`. The backported fix shows `+` even though it is the same fix. The comparison includes the unchanged lines around each change, and on `main` the `li` rule from Part 6 follows the block that was fixed, while on the release branch nothing does. That is why the `-x` line from [Part 7](/guides/introduction-to-git/07-collaboration#h2-release-branches-and-backports) matters: searching for it finds backports reliably.

Two dots and three dots mean different things in `git log` and `git diff`, which confuses everyone at least once:

| Command                                    | Shows                                                                             |
| ------------------------------------------ | --------------------------------------------------------------------------------- |
| `git log main..feature`                    | Commits in `feature` that are not in `main` (what a merge would bring in)         |
| `git log main...feature`                   | Commits in either branch but not in both (add `--left-right` to see which side)   |
| `git diff main feature` or `main..feature` | The difference between the two snapshots                                          |
| `git diff main...feature`                  | The changes on `feature` since it branched from `main`: what a pull request shows |

[Git diff between two branches](/posts/see-differences-between-branches-git) has more examples.

## Who Changed This Line?

`git blame` shows, for every line of a file, the last commit that changed it:

```terminal
{
  "title": "git blame on part of a file",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git blame -L 10,16 services.txt",
      "output": "2a24e58 (Sam 2026-10-16 09:12:00 +0000 10) billing https://billing.example.com/\n935c340 (Sam 2026-10-19 09:08:00 +0000 11) queue   https://queue.example.com/\n312b915 (Sam 2026-10-20 09:03:00 +0000 12) mail    https://mail.example.com/\nffe4e11 (Sam 2026-10-20 09:03:00 +0000 13) grafana https://grafana.example.com/\n386e1c5 (Sam 2026-10-20 09:03:00 +0000 14) legacy  http://legacy.example.com/\n91d086b (Sam 2026-10-20 09:03:00 +0000 15) maps    https://maps.example.com/\nab569ef (Sam 2026-10-20 09:03:00 +0000 16) cache   https://cache.example.com/"
    }
  ]
}
```

Useful options:

- `-w` ignores whitespace changes, and `-C -C -C` looks for lines moved or copied from other files, so a refactoring does not hide the original author.
- `--ignore-rev <commit>` skips a commit, such as a mass reformatting. List such commits in a `.git-blame-ignore-revs` file and set `git config blame.ignoreRevsFile .git-blame-ignore-revs`; GitHub's blame view reads that file too.
- `git blame <commit> -- <file>` blames an older version.

Blame tells you who and which commit; read the commit message (`git show <hash>`) for why. Git 2.52 also added `git last-modified`, which prints the last commit that touched each file or directory, like the commit column in a hosting service's file browser:

```terminal
{
  "title": "the last commit per path (Git 2.52+)",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git last-modified -- services.txt scripts docs",
      "output": "ab569efec97a0fe4167971944ffc4796b31f699d\tservices.txt\n59d529d30921e75acecb72f0dd29bc929242eb76\tdocs\nfe16feb20028095ea89e6751435166856fa0c1a1\tscripts"
    }
  ]
}
```

## Find the Commit That Broke Something with git bisect

After Sam's commits, the build fails:

```terminal
{
  "title": "the build is broken",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "scripts/build.sh",
      "output": "services.txt:14: want '<name> <https URL>', got 'legacy http://legacy.example.com/'\ncheck failed: 1 bad line(s)"
    }
  ]
}
```

The message points at a line, so `git blame` would find the culprit here. Often you have no such clue: a test fails, the page got slow, a number is wrong. `git bisect` finds the first bad commit by binary search: you give it one bad commit and one good one, and it checks out the commit in the middle for you to test, halving the range each time. Ten steps cover a thousand commits.

The last version you built successfully is where `main` was before the pull, which the reflog calls `main@{1}`. If you have a command that exits with 0 for good and non-zero for bad, `git bisect run` does the testing too:

```terminal
{
  "title": "git bisect run",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git bisect start HEAD main@{1}",
      "output": "Bisecting: 3 revisions left to test after this (roughly 2 steps)\n[386e1c5568ea58d9ec6114adffd01811d787aeea] Add the legacy service"
    },
    {
      "cmd": "git bisect run scripts/build.sh",
      "output": "running 'scripts/build.sh'\nservices.txt:14: want '<name> <https URL>', got 'legacy http://legacy.example.com/'\ncheck failed: 1 bad line(s)\nBisecting: 0 revisions left to test after this (roughly 1 step)\n[ffe4e11b9a0dcc63d49555089b177a1aef182fe7] Add the grafana service\nrunning 'scripts/build.sh'\nservices.txt: OK\nbuilt build/index.html (12 services)\n386e1c5568ea58d9ec6114adffd01811d787aeea is the first 'bad' commit\ncommit 386e1c5568ea58d9ec6114adffd01811d787aeea\nAuthor: Sam <sam@example.com>\nDate:   Tue Oct 20 09:03:00 2026 +0000\n\n    Add the legacy service\n\n services.txt | 1 +\n 1 file changed, 1 insertion(+)\nbisect found first 'bad' commit"
    },
    {
      "cmd": "git bisect reset",
      "output": "Previous HEAD position was ffe4e11 Add the grafana service\nSwitched to branch 'main'\nYour branch is up to date with 'origin/main'."
    }
  ]
}
```

Git tested two commits and named the first bad one. `git bisect reset` returns you to the branch you started from; Git 2.56's `git bisect run --reset-when-found` does that automatically. Without a script, you test each commit yourself and tell Git the result:

```bash
git bisect start
git bisect bad                 # the current commit is broken
git bisect good v0.2.0         # this one worked
# Git checks out a commit in the middle; test it, then:
git bisect good                # or: git bisect bad, or git bisect skip if you cannot test it
# repeat until Git prints "<hash> is the first bad commit"
git bisect reset
```

The exit code 125 from a `bisect run` script means "cannot test this commit" (like `skip`), which helps when some commits do not build. [Git bisect for your data](/posts/git-bisect-for-your-data) applies the same search to a database.

## Undo Commits: reset, revert and the Reflog

### git revert: undo a commit that others already have

The bad commit is on `main` and pushed, so you must not rewrite it. `git revert` makes a **new** commit that applies the opposite change:

```terminal
{
  "title": "revert a pushed commit",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git revert --no-edit \":/Add the legacy service\"",
      "output": "Auto-merging services.txt\nCONFLICT (content): Merge conflict in services.txt\nerror: could not revert 386e1c5... Add the legacy service\nhint: After resolving the conflicts, mark them with\nhint: \"git add/rm <pathspec>\", then run\nhint: \"git revert --continue\".\nhint: You can instead skip this commit with \"git revert --skip\".\nhint: To abort and get back to the state before \"git revert\",\nhint: run \"git revert --abort\".\nhint: Disable this message with \"git config set advice.mergeConflict false\""
    }
  ]
}
```

`:/<text>` names the newest commit whose message matches the text, which saves copying a hash; a hash works just as well. This revert stopped with a conflict: Sam's next two commits added lines right after the legacy line, so the line Git wants to remove no longer has the neighbors it had in the original commit. A revert is a merge in reverse, and conflicts work the same way:

```terminal
{
  "title": "resolve the revert conflict",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "sed -n '12,23p' services.txt",
      "output": "mail    https://mail.example.com/\ngrafana https://grafana.example.com/\n<<<<<<< HEAD\nlegacy  http://legacy.example.com/\nmaps    https://maps.example.com/\ncache   https://cache.example.com/\n||||||| 386e1c5 (Add the legacy service)\nlegacy  http://legacy.example.com/\n=======\n>>>>>>> parent of 386e1c5 (Add the legacy service)"
    },
    {
      "comment": "keep maps and cache, remove the legacy line and the markers"
    },
    {
      "cmd": "git diff HEAD -- services.txt",
      "output": "diff --git a/services.txt b/services.txt\nindex c9ae49b..f7d8f5a 100644\n--- a/services.txt\n+++ b/services.txt\n@@ -11,6 +11,5 @@ billing https://billing.example.com/\n queue   https://queue.example.com/\n mail    https://mail.example.com/\n grafana https://grafana.example.com/\n-legacy  http://legacy.example.com/\n maps    https://maps.example.com/\n cache   https://cache.example.com/"
    },
    {
      "cmd": "git add --resolved && git status --short",
      "output": "M  services.txt"
    },
    {
      "cmd": "git revert --continue",
      "output": "[main db852a7] Revert \"Add the legacy service\"\n 1 file changed, 1 deletion(-)"
    },
    {
      "cmd": "scripts/build.sh && git push -q",
      "output": "services.txt: OK\nbuilt build/index.html (14 services)"
    }
  ]
}
```

`git revert --continue` opens your editor with the prepared message ("Revert ..." and "This reverts commit ..."); save it to finish. The history now shows both the mistake and its reversal, which is honest and safe for everyone who already pulled. To revert a merge commit, tell Git which parent is the mainline: `git revert -m 1 <merge>` undoes everything the merge brought into the first parent (usually `main`). Note that Git then considers that branch merged; to merge it again later, revert the revert first.

### git reset: move the branch back

`git reset <commit>` moves the current branch to another commit. The three modes differ in what happens to the changes in the commits you "remove":

| Mode                | Branch pointer | Staging area              | Working tree                 | Use it to                                    |
| ------------------- | -------------- | ------------------------- | ---------------------------- | -------------------------------------------- |
| `--soft`            | Moves          | Keeps the changes, staged | Untouched                    | Redo the last commits as one                 |
| `--mixed` (default) | Moves          | Reset to the commit       | Untouched, changes unstaged  | Unstage, or regroup changes into new commits |
| `--hard`            | Moves          | Reset                     | Reset: changes are discarded | Throw away commits and local changes         |

```terminal
{
  "title": "reset --soft, --mixed and --hard",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "echo \"/* try 1 */\" >> style.css && git commit -q -am \"Try a color\" && echo \"/* try 2 */\" >> style.css && git commit -q -am \"Try another color\" && git log --oneline -3",
      "output": "f7d48e0 Try another color\n0dd3db4 Try a color\ndb852a7 Revert \"Add the legacy service\""
    },
    {
      "cmd": "git reset --soft HEAD~2 && git log --oneline -1 && git status --short",
      "output": "db852a7 Revert \"Add the legacy service\"\nM  style.css"
    },
    {
      "cmd": "git reset && git status --short",
      "output": "Unstaged changes after reset:\nM\tstyle.css\n M style.css"
    },
    {
      "cmd": "git reset --hard && git status --short && git log --oneline -1",
      "output": "HEAD is now at db852a7 Revert \"Add the legacy service\"\ndb852a7 Revert \"Add the legacy service\""
    }
  ]
}
```

`git reset --hard` is the one command in this part that destroys work that was never committed. Before using it, run `git status` and `git stash` anything you might want. Reset only commits you have not pushed; for pushed commits, revert. [Undo the most recent local commits](/posts/how-to-undo-recent-local-commits-in-git), [reset to a previous commit](/posts/how-to-reset-git-to-previous-commit) and [delete a commit from a branch](/posts/delete-commit-from-branch) go through more cases.

### The reflog: Git's undo history

Every time a branch or `HEAD` moves (commit, reset, rebase, merge, switch), Git writes an entry in the **reflog**. Commits that no branch points to any more are still reachable through it, by default for 30 days:

```terminal
{
  "title": "the reflog",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git reflog -6",
      "output": "db852a7 HEAD@{0}: reset: moving to HEAD\ndb852a7 HEAD@{1}: reset: moving to HEAD\ndb852a7 HEAD@{2}: reset: moving to HEAD~2\nf7d48e0 HEAD@{3}: commit: Try another color\n0dd3db4 HEAD@{4}: commit: Try a color\ndb852a7 HEAD@{5}: commit: Revert \"Add the legacy service\""
    }
  ]
}
```

`HEAD@{2}` means "where HEAD was two moves ago", and `main@{1}` (used for bisect above) means "where `main` was before its last move". `ORIG_HEAD` is set by `reset`, `rebase` and `merge` to where you were before them, so `git reset --hard ORIG_HEAD` undoes the most recent of them, as long as no other reset, rebase or merge ran since (each one overwrites it).

In [Part 4](/guides/introduction-to-git/04-branching#h2-list-rename-and-delete-branches) you deleted the unmerged branch `experiment/search` with `-D`. Its commit is still in the reflog, days later:

```terminal
{
  "title": "recover a deleted branch",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git reflog | grep \"search box\"",
      "output": "38ccb33 HEAD@{90}: commit: Try a search box"
    },
    {
      "cmd": "git branch experiment/search 38ccb33 && git log --oneline -1 experiment/search",
      "output": "38ccb33 Try a search box"
    },
    {
      "comment": "the experiment is still not needed: delete it again",
      "cmd": "git branch -D experiment/search",
      "output": "Deleted branch experiment/search (was 38ccb33)."
    }
  ]
}
```

Reflogs are local: they record what happened in your clone and are never pushed. A fresh clone starts its own reflog and does not get the reflogs of the repository it was cloned from.

## Rewrite Local History with Interactive Rebase

Before you open a pull request, you can clean up your branch: merge "fix typo" commits into the commits they fix, reword messages, drop debugging commits, reorder or split commits. Only do this for commits nobody else has. Here is a branch that needs it:

```terminal
{
  "title": "a branch with three messy commits",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git switch -q -c feature/contact-link"
    },
    {
      "cmd": "sed -i 's|<footer>Updated each time scripts/build.sh runs</footer>|<footer>Updated each time scripts/build.sh runs. Questions: <a href=\"mailto:status@example.com\">status@example.com</a></footer>|' template.html && git commit -q -am \"Add a contact link to the foter\""
    },
    {
      "cmd": "sed -i 's|status@example.com|team-status@example.com|g' template.html && git commit -q -am \"Fix the contact address\""
    },
    {
      "cmd": "sed -i 's|^set -euo pipefail|set -xeuo pipefail|' scripts/build.sh && git commit -q -am \"Print debug output in build.sh\""
    },
    {
      "cmd": "git log --oneline -3",
      "output": "f19e972 Print debug output in build.sh\n0193134 Fix the contact address\n685bfbd Add a contact link to the foter"
    }
  ]
}
```

### Reword any commit with git history (Git 2.54+, experimental)

The first message has a typo, and it is not the last commit, so `--amend` does not reach it. Git 2.54 added `git history`, a simpler command for single rewrites. `git history reword <commit>` opens your editor with the commit's message and rewrites that commit and everything after it:

```terminal
{
  "title": "git history reword (fix \"foter\" in the editor, save, close)",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git history reword HEAD~2"
    },
    {
      "cmd": "git log --oneline -3",
      "output": "c179562 Print debug output in build.sh\n4d6c548 Fix the contact address\n678a72b Add a contact link to the footer"
    }
  ]
}
```

`git history` has four subcommands: `reword`, `fixup` (put the staged changes into an older commit), `split` (split a commit in two, choosing hunks) and `drop` (remove a commit). It updates every branch that contains the rewritten commit, stops instead of leaving you with a conflict to resolve, and does not work across merge commits yet. The Git project marks it **experimental**: its behavior may still change, so for scripts and for anything complex, use `git rebase -i`.

### Squash and drop with git rebase -i

`git rebase -i HEAD~3` opens your editor with a **todo list**: one line per commit, oldest first, each starting with a command. Git opens this list (followed by a comment block that explains the commands):

```text
pick 678a72b # Add a contact link to the footer
pick 4d6c548 # Fix the contact address
pick c179562 # Print debug output in build.sh
```

Change the words at the start of the lines, save and close:

```text
pick 678a72b # Add a contact link to the footer
fixup 4d6c548 # Fix the contact address
drop c179562 # Print debug output in build.sh
```

```terminal
{
  "title": "the rebase runs the edited list",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git rebase -i HEAD~3",
      "output": "Successfully rebased and updated refs/heads/feature/contact-link."
    },
    {
      "cmd": "git log --oneline -2 && git show --stat --format=\"%s\" HEAD",
      "output": "807b192 Add a contact link to the footer\ndb852a7 Revert \"Add the legacy service\"\nAdd a contact link to the footer\n\n template.html | 2 +-\n 1 file changed, 1 insertion(+), 1 deletion(-)"
    }
  ]
}
```

The fix is now part of the first commit, and the debugging commit is gone. The commands you will use most:

| Command  | Does                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `pick`   | Keep the commit as it is                                                                                                        |
| `reword` | Keep the commit, edit its message                                                                                               |
| `edit`   | Stop after this commit, so you can amend it or split it (`git reset HEAD~`, then several commits), then `git rebase --continue` |
| `squash` | Combine with the previous commit and edit the combined message                                                                  |
| `fixup`  | Combine with the previous commit and keep the previous message (`fixup -C` keeps this one's)                                    |
| `drop`   | Remove the commit (deleting the line does the same)                                                                             |
| `exec`   | Run a shell command at that point; the rebase stops if it fails                                                                 |

Moving lines reorders commits. `git rebase -i --autosquash` puts `fixup!` commits in place for you ([Part 7](/guides/introduction-to-git/07-collaboration#h2-the-pull-request-flow)), and `git rebase --exec scripts/check.sh main` runs a check after every commit, so each commit on the branch passes, not only the last. If a rebase goes wrong, `git rebase --abort` stops it. After it finished, find the branch's previous tip in `git reflog` (the entry before `rebase (start)`), check it with `git log`, and `git reset --hard` to it. `ORIG_HEAD` points there too, but only until the next reset, merge or rebase, and an `edit` step that runs `git reset HEAD~` already overwrites it.

The branch is ready. Merge it and push:

```terminal
{
  "title": "merge the cleaned-up branch",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git switch -q main && git merge --ff-only feature/contact-link && git branch -d feature/contact-link && git push -q",
      "output": "Updating db852a7..807b192\nFast-forward\n template.html | 2 +-\n 1 file changed, 1 insertion(+), 1 deletion(-)\nDeleted branch feature/contact-link (was 807b192)."
    }
  ]
}
```

To change the author of commits, see [change the author of a single commit](/posts/change-commit-author-single) and [of multiple commits](/posts/change-author-multiple-commits-git).

## Remove a Secret from History

Sam pushes a deploy script on a branch, and with it a `deploy.env` file that contains a token:

```terminal
{
  "title": "a secret is pushed",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd ~/sam/status-page && git switch -q -c feature/deploy && echo \"DEPLOY_TOKEN=dt_live_4f8a1c9e7b2d\" > deploy.env && printf '#!/usr/bin/env bash\\nset -euo pipefail\\nsource deploy.env\\necho \"deploying build/\"\\n' > deploy.sh && chmod +x deploy.sh && git add . && git add --chmod=+x deploy.sh && git commit -q -m \"Add a deploy script\" && git push -q"
    },
    {
      "cmd": "echo 'echo \"done\"' >> deploy.sh && git commit -q -am \"Print when the deploy is done\" && git push -q && git log --oneline -2",
      "output": "630e774 Print when the deploy is done\n3f72978 Add a deploy script"
    }
  ]
}
```

Deleting the file in a new commit does not help: the token stays in the first commit, in every clone, and on the server. The order of the fix matters:

1. **Revoke or rotate the secret first.** Assume it is compromised the moment it was pushed. Rewriting history does not undo that, and on public repositories, automated scanners find leaked keys within minutes.
2. Remove the file from every commit with **git filter-repo**.
3. Force-push the rewritten branches, and have everyone delete or reset their old copies.

`git filter-repo` is a separate tool (a single Python script) recommended by the Git project in place of the old `git filter-branch`. The current release is 2.47.0:

```tabs
{
  "title": "Install git filter-repo",
  "tabs": [
    {
      "label": "pipx (any OS)",
      "lang": "bash",
      "code": "pipx install git-filter-repo"
    },
    {
      "label": "macOS",
      "lang": "bash",
      "code": "brew install git-filter-repo"
    },
    {
      "label": "Ubuntu / Debian",
      "lang": "bash",
      "code": "sudo apt install git-filter-repo    # Ubuntu 24.04 ships 2.38.0, which is fine for this"
    }
  ]
}
```

It refuses to run in a repository with local work, so start from a fresh clone. For a clone from a local path, add `--no-local`, or filter-repo does not accept it as fresh. It turns the clone's remote branches into local ones and removes `origin`, so you do not push by accident:

```terminal
{
  "title": "rewrite the history without deploy.env",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git clone -q --no-local ~/server/status-page.git ~/cleanup && cd ~/cleanup"
    },
    {
      "cmd": "git filter-repo --invert-paths --path deploy.env",
      "output": "NOTICE: Removing 'origin' remote; see 'Why is my origin removed?'\n        in the manual if you want to push back there.\n        (was /home/dev/server/status-page.git)\nParsed 47 commitsHEAD is now at 807b192 Add a contact link to the footer\n\nNew history written in 0.09 seconds; now repacking/cleaning...\nRepacking your repo and cleaning out old unneeded objects\nCompletely finished after 0.19 seconds."
    },
    {
      "cmd": "git log --all --oneline -- deploy.env"
    },
    {
      "cmd": "git remote add origin ~/server/status-page.git && git push --force --all origin && git push --force --tags origin",
      "output": "To /home/dev/server/status-page.git\n + 630e774...4cd5ccc feature/deploy -> feature/deploy (forced update)\nEverything up-to-date"
    }
  ]
}
```

`git log --all -- deploy.env` prints nothing: no commit on any branch contains the file any more. Only `feature/deploy` was rewritten (its two commits got new hashes); the other branches had no `deploy.env` and kept their hashes. Sam's clone still has the old commits, so Sam replaces the branch with the rewritten one:

```terminal
{
  "title": "everyone else drops the old commits",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd ~/sam/status-page && git fetch",
      "output": "From /home/dev/server/status-page\n + 630e774...4cd5ccc feature/deploy -> origin/feature/deploy  (forced update)\n   1c7e00b..807b192  main           -> origin/main"
    },
    {
      "cmd": "git reset --hard origin/feature/deploy && ls deploy.env",
      "output": "HEAD is now at 4cd5ccc Print when the deploy is done\nls: cannot access 'deploy.env': No such file or directory"
    },
    {
      "comment": "the demo is over: delete the branch and the cleanup clone",
      "cmd": "git switch -q main && git branch -q -D feature/deploy && git push -q origin --delete feature/deploy && rm -rf ~/cleanup && cd ~/projects/status-page && git fetch -q"
    }
  ]
}
```

`git reset --hard` replaced the branch with the rewritten one, and it also deleted `deploy.env` from Sam's working tree, because the file was tracked in the commit Sam was on and is not in the new one. If such a file holds configuration you still need, copy it somewhere safe before the reset, put it back afterwards, and add its name to `.gitignore`.

Other useful forms:

- `git filter-repo --replace-text expressions.txt` replaces text inside files in every commit (a line such as `dt_live_4f8a1c9e7b2d==>REMOVED`), for a secret in a file that must stay.
- `git filter-repo --strip-blobs-bigger-than 10M` removes large files that should never have been committed.
- On GitHub or GitLab, old commits can stay reachable through pull request refs, forks and caches after a force push. GitHub's guide to [removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository) explains when you need to contact support.

[Part 9](/guides/introduction-to-git/09-best-practices#h2-keep-secrets-out) shows how to stop secrets before the commit.

## Common Mistakes

- **`git reset --hard` with uncommitted work.** It is gone. `git stash` first, or use `--keep`, which refuses to throw away local changes.
- **Resetting or rebasing pushed commits on a shared branch.** Use `git revert`.
- **Looking only at `git log` for a file that was renamed.** Add `--follow`.
- **Mixing up `..` and `...`.** `main...feature` in `git diff` is what a pull request shows.
- **Removing a secret without revoking it.** The rewrite is cleanup; the rotation is the fix.
- **Panicking after a bad rebase or reset.** The reflog has the previous state for 30 days.

## Summary

- Filter `git log` by message, author, date, path (`--follow` across renames), content (`-S`, `-G`) or lines (`-L`).
- `git show <commit>:<path>` reads old files; `git diff` and `git cherry` compare branches.
- `git blame` and `git last-modified` find who changed what; `git bisect run` finds the commit that broke a test.
- `git revert` undoes pushed commits; `git reset --soft/--mixed/--hard` reworks local ones; the reflog undoes almost anything.
- `git history` (experimental) and `git rebase -i` rewrite local commits; `git filter-repo` rewrites the whole history after a leak.

Next: [Git Best Practices](/guides/introduction-to-git/09-best-practices), with commit message conventions, signing, hooks and the settings worth changing.

## Keep Learning

- [Revert a repository to a previous commit safely](/posts/how-to-safely-revert-repository-to-previous-commit)
- [How to view Git commit history](/posts/how-to-view-git-commit-history)
- [Modify a specific commit](/posts/modify-specific-commit-git)
- [You cannot rotate a secret you cannot find](/posts/you-cannot-rotate-a-secret-you-cannot-find)
