---
title: 'How to Fetch a Remote Branch in Git'
excerpt: 'Need to get a branch from the remote repository? Learn how to fetch remote branches and access them locally without merging or checking out.'
category:
  name: 'Git'
  slug: 'git'
date: '2024-10-20'
publishedAt: '2024-10-20T13:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
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

Someone pushed a new branch to the remote repository and you want to get it locally. Or you need to update your local copy of remote branches without merging them into your work. Fetching lets you download branches without affecting your working directory.

**TLDR:** To fetch all remote branches, use `git fetch origin`. To fetch a specific branch, use `git fetch origin branch-name`. After fetching, create a local branch with `git checkout branch-name` or view the remote branch with `git log origin/branch-name`. Fetching downloads the branches but does not merge them into your current work.

In this guide, you'll learn how to fetch and work with remote branches.

## Prerequisites

You'll need Git installed on your system, a repository with a configured remote, and basic familiarity with Git branches and remotes.

## Understanding Fetch vs Pull

The key difference between fetch and pull:

```
git fetch:  Remote → Local repository (no merge)
git pull:   Remote → Local repository → Working directory (with merge)
```

Fetch updates your local copy of remote branches without touching your working files.

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

Modern Git automatically sets up tracking when you check out a remote branch.

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
# Fetch before operations
git config --global fetch.prune true

# Set fetch interval (if using GUI tools)
git config --global gui.gcwarning false
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

# For HTTPS, update credentials
git config --global credential.helper store

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
