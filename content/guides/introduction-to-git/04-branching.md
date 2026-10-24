---
title: 'Git Branches: Create, Switch, Stash and Delete'
description: 'How Git branches work: create and switch with git switch, carry or stash uncommitted work, detached HEAD, list, rename and delete branches safely.'
order: 4
---

A **branch** lets you work on a change without touching the version everyone else uses. You start a branch, commit to it as often as you like, and merge it back when it is ready ([Part 5](/guides/introduction-to-git/05-merging)), or delete it if the idea did not work out. Branches in Git are cheap and fast because of how they are stored, and once you have seen that, the rest of this part (switching, stashing, detached HEAD) follows from it.

## Prerequisites

- The `status-page` repository from [Part 3](/guides/introduction-to-git/03-tracking-changes), or any repository with a few commits.

## A Branch Is a Pointer to a Commit

```terminal
{
  "title": "branches, HEAD and the commits they point to",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd ~/projects/status-page && git branch",
      "output": "* main"
    },
    {
      "cmd": "git log --oneline --decorate -3",
      "output": "1451c97 (HEAD -> main) Add the web-2 service\n1e24459 (tag: v0.1.0) Add spacing below the heading\ndb2cdcd Stop tracking notes.txt"
    },
    {
      "cmd": "cat .git/HEAD",
      "output": "ref: refs/heads/main"
    },
    {
      "cmd": "cat .git/refs/heads/main",
      "output": "1451c97788fdeef4caa131ef8a9dc339db763946"
    }
  ]
}
```

That is all a branch is: a file in `.git/refs/heads/` that contains the hash of one commit. `HEAD` names the branch you are on. When you commit, Git writes the new commit with the current one as its parent, then updates the branch file to the new hash. `HEAD` follows because it points to the branch, not to a commit.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "HEAD", "sub": "ref: refs/heads/main", "icon": "activity", "tone": "amber" },
    { "label": "main", "sub": "refs/heads/main: a commit hash", "icon": "branch", "tone": "green" },
    { "label": "newest commit", "sub": "Add the web-2 service", "icon": "box", "tone": "blue" },
    { "label": "its parent", "sub": "tag v0.1.0", "icon": "box", "tone": "slate" }
  ]
}
```

Creating a branch writes one more small file, whatever the size of the project. (Git also packs refs into `.git/packed-refs` from time to time, and Git 3.0's reftable format stores them differently; `git rev-parse main` works with every format, so use it in scripts instead of reading files.)

## Create a Branch and Switch to It

The next change is a dark color scheme. Start a branch for it:

```terminal
{
  "title": "git switch -c",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git switch -c feature/dark-mode",
      "output": "Switched to a new branch 'feature/dark-mode'"
    },
    {
      "cmd": "cat .git/HEAD && git branch",
      "output": "ref: refs/heads/feature/dark-mode\n* feature/dark-mode\n  main"
    }
  ]
}
```

`git switch -c <name>` creates the branch at the current commit and switches to it. `git branch <name>` only creates it, and `git switch <name>` switches to a branch that exists. The older `git checkout -b <name>` does the same as `git switch -c`.

Add the dark scheme at the end of `style.css` and commit it:

```css
@media (prefers-color-scheme: dark) {
  body {
    background: #111;
    color: #eee;
  }
  a {
    color: #8ab4f8;
  }
}
```

```terminal
{
  "title": "commit on the branch",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git commit -am \"Add a dark color scheme\"",
      "output": "[feature/dark-mode 121173b] Add a dark color scheme\n 1 file changed, 9 insertions(+)"
    },
    {
      "cmd": "git log --oneline --decorate -3",
      "output": "121173b (HEAD -> feature/dark-mode) Add a dark color scheme\n1451c97 (main) Add the web-2 service\n1e24459 (tag: v0.1.0) Add spacing below the heading"
    }
  ]
}
```

`feature/dark-mode` moved to the new commit; `main` stayed where it was. Switch back to `main` and the change is gone from the working tree, because Git replaced the files with `main`'s snapshot:

```terminal
{
  "title": "switching replaces the files",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git switch main",
      "output": "Switched to branch 'main'"
    },
    {
      "cmd": "grep -c \"prefers-color-scheme\" style.css",
      "output": "0"
    },
    {
      "cmd": "git switch feature/dark-mode && grep -c \"prefers-color-scheme\" style.css",
      "output": "Switched to branch 'feature/dark-mode'\n1"
    }
  ]
}
```

## Uncommitted Changes and Switching

You are on the branch, halfway through the next change, a muted footer color as the first line of `style.css`:

```css
footer {
  color: #777;
}
```

Then someone reports a typo in the README on `main`. Try to switch:

```terminal
{
  "title": "Git refuses to overwrite uncommitted work",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git status --short",
      "output": " M style.css"
    },
    {
      "cmd": "git switch main",
      "output": "error: Your local changes to the following files would be overwritten by checkout:\n\tstyle.css\nPlease commit your changes or stash them before you switch branches.\nAborting"
    }
  ]
}
```

`style.css` is different on `main` and on this branch, so switching would overwrite your edit. Git refuses rather than losing it. When the files you changed are the same on both branches, Git switches and brings the changes along (you see an `M` line); that is also how you move work you started on the wrong branch: `git switch -c new-branch` keeps your uncommitted changes ([more on that](/posts/move-uncommitted-work-to-new-branch)).

Here you have three choices: commit the half-done work, throw it away with `git restore`, or put it aside with **git stash**.

### Put work aside with git stash

`git stash` saves your uncommitted changes (staged and unstaged) on a stack and resets the working tree to the last commit:

```terminal
{
  "title": "stash, fix the typo on main, come back",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git stash push -m \"muted footer color\"",
      "output": "Saved working directory and index state On feature/dark-mode: muted footer color"
    },
    {
      "cmd": "git status --short && git stash list",
      "output": "stash@{0}: On feature/dark-mode: muted footer color"
    },
    {
      "cmd": "git switch main",
      "output": "Switched to branch 'main'"
    },
    {
      "comment": "fix \"teams services\" in README.md in your editor, then commit"
    },
    {
      "cmd": "git commit -am \"Fix a typo in the README\"",
      "output": "[main d81047d] Fix a typo in the README\n 1 file changed, 1 insertion(+), 1 deletion(-)"
    },
    {
      "cmd": "git switch feature/dark-mode",
      "output": "Switched to branch 'feature/dark-mode'"
    },
    {
      "cmd": "git stash pop",
      "output": "On branch feature/dark-mode\nChanges not staged for commit:\n  (use \"git add <file>...\" to update what will be committed)\n  (use \"git restore <file>...\" to discard changes in working directory)\n\tmodified:   style.css\n\nno changes added to commit (use \"git add\" and/or \"git commit -a\")\nDropped refs/stash@{0} (24bbf38d28cf346fc954e080157c54a06dc5c64d)"
    },
    {
      "cmd": "git commit -am \"Use a muted color for the footer\"",
      "output": "[feature/dark-mode c0fce2c] Use a muted color for the footer\n 1 file changed, 3 insertions(+)"
    }
  ]
}
```

`git stash pop` applies the newest stash and removes it from the stack. If applying it causes a conflict, Git keeps the stash so you do not lose it; resolve the conflict, then run `git stash drop`.

| Command                                         | What it does                                                                |
| ----------------------------------------------- | --------------------------------------------------------------------------- |
| `git stash push -m "msg"`                       | Stash tracked changes with a description                                    |
| `git stash push -u`                             | Also stash untracked files (`-a` adds ignored files too)                    |
| `git stash push -- <path>`                      | Stash only some files ([stash a single file](/posts/stash-single-file-git)) |
| `git stash list`, `git stash show -p stash@{1}` | List stashes; show one as a diff                                            |
| `git stash pop`, `git stash apply`              | Apply the newest stash and drop it; apply but keep it                       |
| `git stash branch <name>`                       | Create a branch at the commit the stash was made on, and apply it there     |
| `git stash drop stash@{1}`, `git stash clear`   | Delete one stash; delete all of them                                        |

Stashes are easy to forget. Prefer a commit on the branch (you can tidy it up later, [Part 8](/guides/introduction-to-git/08-history#h2-rewrite-local-history-with-interactive-rebase)) for anything you will not come back to within the hour. Git 2.51 added `git stash export` and `git stash import`, which turn stashes into a ref you can push and fetch, for moving them to another machine.

## See the Branches as a Graph

Both branches now have commits the other does not have:

```terminal
{
  "title": "two lines of work",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git log --oneline --graph --all",
      "output": "* c0fce2c Use a muted color for the footer\n* 121173b Add a dark color scheme\n| * d81047d Fix a typo in the README\n|/\n* 1451c97 Add the web-2 service\n* 1e24459 Add spacing below the heading\n* db2cdcd Stop tracking notes.txt\n* 059af95 Add notes\n* b764ae4 Rename index.html to template.html\n* 5c559e6 Add a footer to the page\n* 3c83098 Add the team name to the page title\n* f96dea5 Add the docs service\n* b8e0203 Ignore build output and local settings\n* 46b8da1 Add the first version of the status page"
    }
  ]
}
```

Read the graph from the top: each `*` is a commit, and the lines show parents. `main` has the README fix; `feature/dark-mode` has two commits on top of "Add the web-2 service", the commit where the branch started. [Part 5](/guides/introduction-to-git/05-merging) merges them. Many editors and tools draw this graph with colors; the [Git Concepts simulator](/games/git-concepts-simulator) lets you build one step by step.

## Detached HEAD: Looking at an Old Commit

You can switch to any commit or tag, not only to a branch. Git then puts you in **detached HEAD** state, which means `HEAD` points straight at a commit:

```terminal
{
  "title": "detached HEAD",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git switch --detach v0.1.0",
      "output": "HEAD is now at 1e24459 Add spacing below the heading"
    },
    {
      "cmd": "cat .git/HEAD && git branch",
      "output": "1e2445947df34424a52bc873803317aa23feb9e3\n* (HEAD detached at v0.1.0)\n  feature/dark-mode\n  main"
    },
    {
      "cmd": "git switch -",
      "output": "Previous HEAD position was 1e24459 Add spacing below the heading\nSwitched to branch 'feature/dark-mode'"
    }
  ]
}
```

In detached HEAD you can look around, build and run old versions, and even commit. But new commits are on no branch: when you switch away, nothing points to them, and Git deletes them during a later cleanup (the reflog keeps them reachable for 30 days by default, [Part 8](/guides/introduction-to-git/08-history#h2-undo-commits-reset-revert-and-the-reflog)). If you want to keep what you did, create a branch right there with `git switch -c <name>`. `git switch -` returns to the branch you were on before. (`git checkout <commit>` also detaches HEAD, without needing `--detach`, which is why people end up there by accident.)

## List, Rename and Delete Branches

```terminal
{
  "title": "list and filter branches",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git branch -v",
      "output": "* feature/dark-mode c0fce2c Use a muted color for the footer\n  main              d81047d Fix a typo in the README"
    },
    {
      "cmd": "git branch --show-current",
      "output": "feature/dark-mode"
    },
    {
      "comment": "which branches are already part of main, and which are not?",
      "cmd": "git branch --merged main && git branch --no-merged main",
      "output": "  main\n* feature/dark-mode"
    }
  ]
}
```

`git branch -v` adds each branch's last commit; `-vv` also shows the remote branch it tracks ([Part 6](/guides/introduction-to-git/06-remote-repositories#h2-tracking-branches)). `--merged` and `--no-merged` answer "is this branch's work in `main` yet?", and `--sort=-committerdate` puts the most recently used branches first. [Get the current branch name](/posts/get-current-branch-name-git) covers more ways to read it in scripts.

To try an idea quickly, start a branch, commit, and see how deleting works:

```terminal
{
  "title": "rename and delete",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git switch -q -c spike/search && echo \"search: todo\" >> README.md && git commit -q -am \"Try a search box\" && git switch -q main"
    },
    {
      "cmd": "git branch -m spike/search experiment/search"
    },
    {
      "cmd": "git branch -d experiment/search",
      "output": "error: the branch 'experiment/search' is not fully merged\nhint: If you are sure you want to delete it, run 'git branch -D experiment/search'\nhint: Disable this message with \"git config set advice.forceDeleteBranch false\""
    },
    {
      "cmd": "git branch -D experiment/search",
      "output": "Deleted branch experiment/search (was 38ccb33)."
    }
  ]
}
```

- `git branch -m old new` renames a branch (`-m new` renames the current one). [Renaming a branch that is already pushed](/posts/how-to-rename-local-git-branch) needs one more step on the remote.
- `git branch -d` deletes a branch only if its commits are merged: into its upstream if it has one ([Part 6](/guides/introduction-to-git/06-remote-repositories#h2-tracking-branches)), otherwise into your current branch. That check has saved a lot of work.
- `git branch -D` deletes it anyway. The commits are not gone yet: Git printed the hash (`was ...`), and the reflog has it too, so you can recreate the branch with `git branch experiment/search <hash>` ([Part 8](/guides/introduction-to-git/08-history#h2-undo-commits-reset-revert-and-the-reflog)).

Deleting a branch on the remote is a separate command ([Part 6](/guides/introduction-to-git/06-remote-repositories#h2-delete-remote-branches); [delete a branch locally and remotely](/posts/how-to-delete-git-branch-locally-and-remotely)).

## Name Branches So Others Understand Them

A branch name is a path-like name: `feature/dark-mode` is stored as `refs/heads/feature/dark-mode`. Most teams use a prefix for the kind of work, and many add a ticket number:

| Prefix                | For                                                                         | Example                      |
| --------------------- | --------------------------------------------------------------------------- | ---------------------------- |
| `feature/`            | New functionality                                                           | `feature/dark-mode`          |
| `fix/`                | Bug fixes                                                                   | `fix/123-broken-footer-link` |
| `chore/`, `docs/`     | Maintenance, documentation                                                  | `docs/contributing-guide`    |
| `release/`, `hotfix/` | Release management ([Part 7](/guides/introduction-to-git/07-collaboration)) | `release/1.4`                |

Names cannot contain spaces, `..`, `~`, `^`, `:` or a few other characters, and a branch `feature` cannot exist next to `feature/dark-mode` (one would have to be a file and a directory at once). `git check-ref-format` tells you whether a name is valid:

```terminal
{
  "title": "check a branch name",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "git check-ref-format --branch \"feature/dark mode\"; echo \"exit code: $?\"",
      "output": "fatal: 'feature/dark mode' is not a valid branch name\nexit code: 128"
    },
    {
      "cmd": "git check-ref-format --branch \"feature/dark-mode\"",
      "output": "feature/dark-mode"
    }
  ]
}
```

## Common Mistakes

- **Working on `main` by accident.** Check `git status` (it starts with "On branch ...") or show the branch in your shell prompt. If you have not committed yet, `git switch -c new-branch` moves the work over; if you have, see [move commits to a new branch](/posts/move-most-recent-commits-to-new-branch-git).
- **Committing in detached HEAD and switching away.** Create a branch before you leave, or recover the commit from the reflog.
- **Long-lived branches.** The longer a branch lives, the more `main` moves away from it and the harder the merge. Merge small pieces often.
- **Using `-D` out of habit.** `-d` refuses to delete unmerged work; read its message before you force it.
- **Forgotten stashes.** `git stash list` once in a while; a stash is not a backup and is never pushed.

## Summary

- A branch is a file with a commit hash; `HEAD` says which branch you are on.
- `git switch -c` creates and switches, `git switch` switches; your files change to the branch's snapshot.
- Git refuses to switch when it would overwrite uncommitted changes; commit, restore or `git stash` them first.
- Detached HEAD means `HEAD` points at a commit; create a branch before committing there.
- `git branch -v`, `--merged`, `-m` and `-d` list, check, rename and delete branches.

Next: [Merging and Resolving Conflicts](/guides/introduction-to-git/05-merging), where the dark mode branch goes into `main`.

## Keep Learning

- [Git Branching Strategies interview questions](/interview-questions/junior/git-branching-strategies)
- [How to stash changes in Git](/posts/how-to-stash-changes-in-git)
- [Check out a remote branch](/posts/how-to-checkout-remote-git-branch)
