---
title: 'Introduction to Git'
seoTitle: 'Git Tutorial: Learn Git Step by Step with Real Examples'
description: 'A hands-on Git tutorial in 10 parts: commits, branches, merge conflicts, remotes, pull requests, rebase, bisect, signing and Git 2.56, with real output.'
category:
  name: 'Git'
  slug: 'git'
parts: 10
publishedAt: '2024-06-03T10:00:00Z'
updatedAt: '2026-10-24T09:00:00Z'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Version Control
  - GitHub
  - Branching
  - Collaboration
  - DevOps
---

**Git** records every change to a project, lets several people work on it at once, and merges their work back together. It is the version control system behind almost every software project, and behind most infrastructure code, documentation and configuration too. You can learn a dozen commands in an afternoon; using Git well, without fear of losing work, takes a clear picture of what those commands do.

This guide gives you that picture with one project from start to finish. In Part 2 you create **status-page**, a small status page for a team's services. Over the next parts it gets branches, merges and conflicts, a remote server and a second developer called Sam, pull requests and a release branch, a bug found with `git bisect`, a leaked token removed from the history, signed commits, hooks and a submodule. Every command was run for real, and the output you see is what Git printed.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Parts 1 to 3", "sub": "how Git works, repositories, commits", "icon": "box", "tone": "slate" },
    { "label": "Parts 4 and 5", "sub": "branches, merging, conflicts, rebase", "icon": "branch", "tone": "blue" },
    { "label": "Parts 6 and 7", "sub": "remotes, pull requests, team workflows", "icon": "cloud", "tone": "violet" },
    { "label": "Parts 8 to 10", "sub": "history, best practices, advanced Git", "icon": "check", "tone": "green" }
  ]
}
```

## What You'll Learn

1. **[Git Fundamentals](/guides/introduction-to-git/01-fundamentals)**: snapshots, the working tree, staging area and repository, installing Git 2.56, first-time setup, and what changes in Git 3.0.
2. **[Creating Repositories](/guides/introduction-to-git/02-repositories)**: `git init`, the first commit, what is inside `.git`, `.gitignore`, and `git clone` with `--branch`, `--depth` and `--filter`.
3. **[Tracking Changes](/guides/introduction-to-git/03-tracking-changes)**: `git status`, `git diff`, `git add -p`, commits, `git log`, renames, undoing mistakes with `restore` and `--amend`, and tags.
4. **[Branching](/guides/introduction-to-git/04-branching)**: what a branch is on disk, `git switch`, uncommitted changes and `git stash`, detached HEAD, and cleaning up branches.
5. **[Merging and Rebasing](/guides/introduction-to-git/05-merging)**: fast-forward and merge commits, resolving a conflict step by step, zdiff3 markers, `git rebase`, squash merges, and merge versus rebase.
6. **[Remote Repositories](/guides/introduction-to-git/06-remote-repositories)**: push, fetch and pull, rejected pushes, tracking branches, safe force pushes, pruning, SSH keys and HTTPS logins, forks and push protection.
7. **[Collaboration Workflows](/guides/introduction-to-git/07-collaboration)**: the pull request flow with fixups and `git range-diff`, merge methods, stacked branches with `--update-refs`, backports, and choosing a workflow.
8. **[Git History](/guides/introduction-to-git/08-history)**: searching the log, `git blame`, `git bisect run`, `revert`, `reset` and the reflog, interactive rebase, `git history`, and removing a secret with `git filter-repo`.
9. **[Best Practices](/guides/introduction-to-git/09-best-practices)**: commit messages and Conventional Commits, `.gitattributes`, keeping secrets out, hooks, SSH commit signing, settings and aliases, maintenance.
10. **[Advanced Techniques](/guides/introduction-to-git/10-advanced-techniques)**: Git objects, SHA-256 and reftable, worktrees, partial clones and sparse checkout, rerere, submodules and subtrees, archives, bundles and scripting.

## Git Commands at a Glance

| You want to                                              | Command                                                     | Part                                                                                           |
| -------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Start a repository, or copy one                          | `git init`, `git clone <url>`                               | [2](/guides/introduction-to-git/02-repositories)                                               |
| See what changed                                         | `git status`, `git diff`, `git diff --staged`               | [3](/guides/introduction-to-git/03-tracking-changes)                                           |
| Save a change                                            | `git add -p`, `git commit`                                  | [3](/guides/introduction-to-git/03-tracking-changes)                                           |
| Undo local changes                                       | `git restore`, `git restore --staged`, `git commit --amend` | [3](/guides/introduction-to-git/03-tracking-changes)                                           |
| Work on something separately                             | `git switch -c <branch>`, `git stash`                       | [4](/guides/introduction-to-git/04-branching)                                                  |
| Combine branches                                         | `git merge`, `git rebase`                                   | [5](/guides/introduction-to-git/05-merging)                                                    |
| Share work                                               | `git push -u`, `git fetch`, `git pull --rebase`             | [6](/guides/introduction-to-git/06-remote-repositories)                                        |
| Force-push without losing others' work                   | `git push --force-with-lease --force-if-includes`           | [6](/guides/introduction-to-git/06-remote-repositories)                                        |
| Clean up a branch before review                          | `git commit --fixup`, `git rebase -i --autosquash`          | [7](/guides/introduction-to-git/07-collaboration), [8](/guides/introduction-to-git/08-history) |
| Find who changed a line, or which commit broke something | `git blame`, `git bisect run`                               | [8](/guides/introduction-to-git/08-history)                                                    |
| Undo a pushed commit                                     | `git revert`                                                | [8](/guides/introduction-to-git/08-history)                                                    |
| Get back something you lost                              | `git reflog`                                                | [8](/guides/introduction-to-git/08-history)                                                    |
| Prove that commits are yours                             | `gpg.format ssh`, `commit.gpgSign true`                     | [9](/guides/introduction-to-git/09-best-practices)                                             |
| Clone a huge repository                                  | `git clone --filter=blob:none --sparse`                     | [10](/guides/introduction-to-git/10-advanced-techniques)                                       |

## Which Versions This Guide Uses

The guide was updated on 24 October 2026 for **Git 2.56.0**, the current release (28 September 2026). The terminal output comes from real runs of Git 2.56.0 built from the release tarball, on Linux, as a user called `dev` with the name "Dev" and the email `dev@example.com`, on a machine called `devbox`. Commit dates were fixed to 12 to 22 October 2026, so that the hashes in one part match the hashes in the next. A bare repository in `~/server` plays the hosting service, and a second clone plays Sam.

- Where Git opens an editor or asks a question (`git add -p`, `git rebase -i`, `ssh-keygen`), the answers were typed by a script, and the text tells you what to enter. The output is what Git printed.
- **Not run:** commands that need a hosting service or another operating system: `gh`, `ssh -T git@github.com`, GitHub settings, the Windows and macOS install commands, Git LFS, and `git maintenance start` (which needs a system scheduler). They are shown as code without output, or labelled as an example.

If you learned Git from an older tutorial, these are the changes worth knowing:

| Old habit                                         | Now                                                      | Why                                                    |
| ------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| `git checkout -b <branch>`                        | `git switch -c <branch>`                                 | One command per job; stable since Git 2.51             |
| `git checkout -- <file>`, `git reset HEAD <file>` | `git restore <file>`, `git restore --staged <file>`      | Clear names for "discard" and "unstage"                |
| A `master` branch in new repositories             | `git config --global init.defaultBranch main`            | Matches GitHub and GitLab; the default in Git 3.0      |
| `git push --force`                                | `git push --force-with-lease --force-if-includes`        | Does not delete commits you have not seen              |
| `git pull` without a strategy                     | `pull.rebase true` (or `pull.ff only`)                   | Git refuses to guess when branches diverged            |
| `git filter-branch`, BFG                          | `git filter-repo`                                        | Faster, safer, recommended by the Git project          |
| GPG keys for signing                              | SSH keys with `gpg.format ssh`                           | You already have an SSH key                            |
| `git config --list`, `git config <key> <value>`   | `git config list`, `git config set <key> <value>`        | Subcommands since Git 2.46; the old forms still work   |
| Hooks only in `.git/hooks`                        | `hook.<name>.command` in the config, or `core.hooksPath` | Several hooks per event, defined in config (Git 2.54+) |
| `-s recursive`                                    | The default `ort` strategy                               | `recursive` is only an alias for `ort` since Git 2.50  |

## Prerequisites

- A computer with Linux, macOS or Windows (Git Bash or WSL on Windows).
- Basic terminal use: `cd`, `ls`, running a command. The [Linux command line part](/guides/introduction-to-linux/03-command-line-interface) of the Linux guide covers it, and the [Bash guide](/guides/introduction-to-bash) goes further.
- No account on GitHub or GitLab is needed until [Part 6](/guides/introduction-to-git/06-remote-repositories), and even there everything runs locally first.

## Practice Hands-On

Follow the parts in order and type the commands: you get the same project and, apart from hashes and dates, the same output. To see commits, branches and merges as a graph without installing anything, try the [Git Concepts simulator](/games/git-concepts-simulator), and practice conflicts in the [Git merge conflict simulator](/games/git-merge-conflict-simulator).

## Keep Learning

- [Git clone a specific branch](/posts/clone-specific-git-branch)
- [View the change history of a file](/posts/view-file-change-history-git)
- [Fetch a remote branch and check it out](/posts/git-fetch-remote-branch)
- [Undo a git rebase](/posts/undo-git-rebase)
- Test yourself: [Git Command Quiz](/quizzes/git-quiz), [Git Fundamentals flashcards](/flashcards/git-fundamentals), [Git workflow exercise](/exercises/git-workflow-collaboration)
- Next guide: [Introduction to CI/CD](/guides/introduction-to-cicd)

Start with [Part 1: Git Fundamentals](/guides/introduction-to-git/01-fundamentals), or jump to [merge conflicts](/guides/introduction-to-git/05-merging#h2-resolve-a-merge-conflict) or [undoing commits](/guides/introduction-to-git/08-history#h2-undo-commits-reset-revert-and-the-reflog) if you need that answer now.
