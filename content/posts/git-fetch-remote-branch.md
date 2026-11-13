---
title: 'Git Fetch a Remote Branch and Check It Out Locally'
excerpt: 'Run git fetch origin branch-name, then git switch branch-name for a local branch that tracks origin/branch-name, or git switch --track origin/branch-name.'
category:
  name: 'Git'
  slug: 'git'
date: '2024-10-20'
publishedAt: '2024-10-20T13:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '10 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Fetch
  - Remote Branches
  - Version Control
  - Workflows
---

**TLDR:** To fetch all remote branches, use `git fetch origin`. To fetch a specific branch, use `git fetch origin branch-name`. After fetching, create a local tracking branch with `git switch branch-name` (or `git checkout branch-name` on Git older than 2.23) or view the remote branch with `git log origin/branch-name`. Fetching downloads the branches but does not merge them into your current work.

Someone pushed a new branch to the remote repository and you want to get it locally. Or you need to update your local copy of remote branches without merging them into your work. Fetching lets you download branches without affecting your working directory.

In this guide, you'll learn how to fetch and work with remote branches.

## Prerequisites

You'll need Git installed on your system, a repository with a configured remote, and basic familiarity with Git branches and remotes.

## Understanding Fetch vs Pull

The key difference between fetch and pull:

```text
git fetch:  Remote → Local repository (no merge)
git pull:   Remote → Local repository → Working directory (with merge)
```

Fetch updates your local copy of remote branches without touching your working files.

## What Is the Difference Between git pull and git fetch?

A normal `git fetch` downloads new commits and updates the remote-tracking branches such as `origin/main`. It does not change your local branches or your files. (A fetch with an explicit destination, such as `git fetch origin pull/123/head:pr-123` below, does write a local branch.) `git pull` runs a fetch and then integrates the upstream branch into your current branch, with a merge or a rebase:

```bash
git pull                          # fetch, then merge or rebase origin/<branch> into the current branch
# is about the same as
git fetch
git merge origin/main             # or: git rebase origin/main
```

Fetch first when you want to see what is new before it changes your branch. `@{u}` is the upstream of the current branch:

```bash
git fetch
git log --oneline HEAD..@{u}      # commits on the remote that you do not have
git diff HEAD...@{u}              # their changes since your branch and the remote split
git merge @{u}                    # or: git rebase @{u}
```

### Tell git pull how to join the histories

When your branch and the remote branch both have new commits, Git needs to know whether to merge or to rebase. Without a setting, current Git versions stop instead of guessing. Git 2.39 prints:

```text
hint: You have divergent branches and need to specify how to reconcile them.
fatal: Need to specify how to reconcile divergent branches.
```

Choose once:

```bash
git config --global pull.rebase true    # replay your local commits on top: a straight history
git config --global pull.ff only        # or: only fast-forward, and stop when the branches diverged
```

For one pull, use `git pull --rebase`, `git pull --no-rebase` (merge) or `git pull --ff-only`. The [remotes chapter of the Git guide](/guides/introduction-to-git/06-remote-repositories#h2-pull-merge-or-rebase) compares them with real output.

### Pull with uncommitted changes

Git refuses a pull that would overwrite your uncommitted changes:

```text
error: Your local changes to the following files would be overwritten by merge:
        src/auth.js
Please commit your changes or stash them before you merge.
```

Commit or stash first, or let Git stash for you: `git pull --rebase --autostash` saves your changes, pulls, and puts the changes back.

### In scripts and deployments

Do not run a plain `git pull` in a deploy script. It can create a merge commit on the server, or stop at a conflict. Use `git pull --ff-only`, which fails when the histories diverged, or make the copy match the remote exactly:

```bash
git fetch origin
git reset --hard origin/main      # discards any local change on the server
```

[Reset a local branch to match the remote](/posts/how-to-reset-local-branch-to-match-remote-head) explains the reset. To see fetch, pull and rebase move the branch pointers, try the [Git concepts simulator](/games/git-concepts-simulator).

## Fetching All Remote Branches

To download all branches from the remote:

```bash
# Fetch all branches from origin
git fetch origin

# Or just
git fetch

# Git downloads all new commits and branches
```

This updates all remote-tracking branches in your repository.

## Viewing Remote Branches After Fetch

After fetching, see what branches are available:

```bash
# List all remote branches
git branch -r

# Output:
#   origin/main
#   origin/develop
#   origin/feature-auth
#   origin/feature-dashboard

# List all branches (local and remote)
git branch -a
```

Remote branches are prefixed with `origin/`.

## Fetching a Specific Branch

To fetch only one branch:

```bash
# Fetch specific branch
git fetch origin feature-auth

# Verify it was fetched
git branch -r | grep feature-auth
```

This is faster when you only need one branch.

## Creating Local Branch from Remote

After fetching, create a local tracking branch:

```bash
# Fetch the branch
git fetch origin feature-auth

# Create local branch tracking remote
git checkout feature-auth

# Git automatically creates local branch from origin/feature-auth
```

Modern Git automatically sets up tracking when you check out a remote branch. For a branch that already exists locally, [set the upstream yourself](/posts/make-git-branch-track-remote).

## Explicit Branch Creation

To explicitly create a local branch from remote:

```bash
# Create and switch to new local branch
git checkout -b feature-auth origin/feature-auth

# Or use git switch
git switch -c feature-auth origin/feature-auth

# Verify tracking
git branch -vv
```

## How Do I Check Out a Remote Branch?

Fetch, then switch to a local branch with the same name. Git creates the local branch and sets `origin/<name>` as its upstream:

```bash
git fetch origin
git switch feature/user-auth
# branch 'feature/user-auth' set up to track 'origin/feature/user-auth'.
```

`git checkout feature/user-auth` does the same. Git can only find branches that you fetched, so if Git says `invalid reference`, run `git fetch` first. `git branch -r` lists the remote branches that Git knows.

### The same branch name on two remotes

With two remotes, for example `origin` and `upstream` in a fork, the short form fails when both have the branch:

```text
fatal: 'topic' matched multiple (2) remote tracking branches
```

Name the remote:

```bash
git switch --track upstream/topic                # local branch "topic" that tracks upstream/topic
git switch -c my-topic --track upstream/topic    # the same, with another local name
```

Or set a default remote for the short form: `git config --global checkout.defaultRemote origin`.

### The local branch already exists

`git switch <name>` then switches to your local branch and does not update it. Pull to bring in the new commits. To throw away the local branch and start again from the remote, `git switch -C <name> origin/<name>` (or `git checkout -B`) resets it. Its local-only commits are no longer on any branch. In a test, the reflog of the branch still listed the dropped commit, so `git reflog show <name>` gets it back.

### Look at a remote branch without a local branch

```bash
git switch --detach origin/feature/user-auth     # read-only look, no branch is created
git switch -                                     # back to where you were
```

### Check out a pull request

GitHub keeps each pull request under `refs/pull/<number>/head`, even when it comes from a fork. Fetch it into a local branch:

```bash
git fetch origin pull/123/head:pr-123
git switch pr-123
```

With the GitHub CLI, `gh pr checkout 123` does both. GitLab uses `refs/merge-requests/<number>/head` for merge requests.

## Fetching with Different Remote

If you have multiple remotes:

```bash
# List remotes
git remote -v

# Fetch from specific remote
git fetch upstream

# Fetch specific branch from upstream
git fetch upstream main
```

## Viewing Remote Branch Without Checking Out

To inspect a remote branch without creating a local branch:

```bash
# View commits
git log origin/feature-auth

# View recent commits
git log --oneline origin/feature-auth -10

# See differences from your current branch
git diff main..origin/feature-auth

# View specific file
git show origin/feature-auth:path/to/file.js
```

## Updating an Already-Fetched Branch

To update a remote branch you previously fetched:

```bash
# Fetch updates
git fetch origin feature-auth

# See what changed
git log HEAD..origin/feature-auth

# Merge updates into your local branch
git merge origin/feature-auth

# Or rebase
git rebase origin/feature-auth
```

## Fetching All Remotes

If you have multiple remotes:

```bash
# Fetch from all remotes
git fetch --all

# This runs fetch on origin, upstream, etc.
```

## Pruning Deleted Remote Branches

To remove references to branches deleted on remote:

```bash
# Fetch and prune
git fetch --prune

# Or prune without fetching
git remote prune origin

# See what would be pruned
git remote prune origin --dry-run
```

Pruning cleans up stale remote-tracking branches.

## Fetching with Depth Limit

For large repositories, fetch limited history:

```bash
# Shallow fetch (last commit only)
git fetch --depth=1 origin feature-branch

# Fetch last 10 commits
git fetch --depth=10 origin feature-branch

# Convert shallow to full
git fetch --unshallow
```

## Fetching Tags with Branches

By default, fetch gets tags for fetched commits:

```bash
# Fetch with tags
git fetch origin

# Fetch all tags
git fetch --tags origin

# Fetch without tags
git fetch --no-tags origin
```

## Checking Fetch Configuration

View your fetch configuration:

```bash
# See remote configuration
git remote show origin

# Output shows:
#   Fetch URL: https://github.com/user/repo.git
#   Push  URL: https://github.com/user/repo.git
#   HEAD branch: main
#   Remote branches:
#     main         tracked
#     feature-auth tracked

# See fetch refspec
git config --get remote.origin.fetch
```

## Fetch and Compare

Common workflow to fetch and review:

```bash
# Fetch updates
git fetch origin main

# See what changed
git log HEAD..origin/main --oneline

# See detailed differences
git diff HEAD origin/main

# If good, merge
git merge origin/main
```

## Fetching for Pull Request Review

To review a pull request branch:

```bash
# Fetch the PR branch
git fetch origin pull-request-branch

# Check it out
git checkout pull-request-branch

# Or review without checking out
git log origin/pull-request-branch
git diff main..origin/pull-request-branch
```

## Fetching Specific Commits

To fetch up to a specific commit:

```bash
# Fetch specific commit
git fetch origin abc123

# The commit and its ancestors are fetched
```

## Setting Up Automatic Fetch

Configure Git to fetch automatically:

```bash
# Remove deleted remote branches on every fetch
git config --global fetch.prune true

# Prefetch in the background every hour, without changing your remote-tracking branches
git maintenance start
```

## Fetch in CI/CD Pipelines

In automated workflows:

```bash
# Fetch specific branch for build
git fetch origin develop

# Checkout to test
git checkout origin/develop

# Or create local branch
git checkout -b test-branch origin/develop
```

## Troubleshooting Fetch Issues

**Issue: Fetch returns nothing**

```bash
# Check remote URL
git remote -v

# Test connectivity
git ls-remote origin

# Fetch with verbose output
git fetch -v origin
```

**Issue: Branch not appearing after fetch**

```bash
# Verify branch exists on remote
git ls-remote --heads origin

# Fetch all branches
git fetch origin

# List remote branches
git branch -r
```

**Issue: Authentication failure**

```bash
# Check credentials
git config --get remote.origin.url

# For HTTPS, use a credential manager (not "store", which saves the token in plain text)
git config --global credential.helper cache

# For SSH, check key
ssh -T git@github.com
```

## Best Practices

Fetch before starting work:

```bash
# Start of day workflow
git fetch --all
git checkout main
git merge origin/main
```

Fetch regularly to stay updated:

```bash
# Good habit: fetch frequently
git fetch origin

# Review what changed
git log HEAD..origin/main --oneline

# Decide when to merge
```

Use fetch + merge instead of pull for control:

```bash
# More control
git fetch origin
git log HEAD..origin/main  # Review changes
git merge origin/main      # Merge when ready

# Less control
git pull  # Fetches and merges immediately
```

Prune regularly:

```bash
# Clean up stale branches
git fetch --prune origin

# Or set as default
git config --global fetch.prune true
```

Fetch before creating branches:

```bash
# Fetch latest
git fetch origin

# Create branch from latest remote
git checkout -b new-feature origin/main
```

## Fetch Aliases

Create shortcuts:

```bash
# Add to ~/.gitconfig
[alias]
    f = fetch --all --prune
    fp = fetch --all --prune --verbose

# Use them
git f
git fp
```

## Comparing Fetch Methods

Different approaches for different needs:

```bash
# Full sync
git fetch --all

# Specific branch
git fetch origin feature-auth

# With pruning
git fetch --prune

# Limited history
git fetch --depth=1 origin main

# Just check for updates
git ls-remote origin HEAD
```

Now you know how to fetch remote branches in Git. Use `git fetch` to download branches without affecting your working directory, then decide when and how to integrate those changes. Fetching gives you control over when to merge remote updates into your work.

## Related Resources

- [Introduction to Git: Push, Fetch, Pull and Tracking Branches](/guides/introduction-to-git/06-remote-repositories)
- [Make an existing branch track a remote branch](/posts/make-git-branch-track-remote)
- [Push a new local branch, rename or delete branches](/posts/how-to-push-new-local-branch-to-remote-and-track)
- [Git clone a specific branch](/posts/clone-specific-git-branch)
- [Git concepts simulator](/games/git-concepts-simulator)
- [Git workflow and collaboration exercise](/exercises/git-workflow-collaboration)
- Test yourself: [Git Command Quiz](/quizzes/git-quiz)
