---
title: 'How to Force Git Pull to Overwrite Local Files'
excerpt: 'Learn how to use git reset, git clean, and git checkout to force git pull to overwrite local changes when you need to match the remote repository exactly.'
category:
  name: 'Git'
  slug: 'git'
date: '2024-11-25'
publishedAt: '2024-11-25T14:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Version Control
  - Remote Repositories
  - Troubleshooting
  - Command Line
---

Sometimes you need to discard all local changes and make your repository match the remote repository exactly. This might happen when you've made experimental changes that didn't work out, or when your local repository is in an inconsistent state and you want a fresh start.

In this guide, you'll learn several methods to force `git pull` to overwrite local files and reset your repository to match the remote state.

## Prerequisites

You'll need Git installed and a repository with a remote origin configured. Be aware that the methods in this guide will permanently delete local changes, so use them carefully and ensure you don't need any of your current work.

## Understanding the Problem

By default, Git protects you from losing work by refusing to pull when you have uncommitted changes that would be overwritten:

```bash
git pull origin main
# error: Your local changes to 'config.js' would be overwritten by merge.
# Please commit your changes or stash them before you merge.
```

Git also won't automatically delete untracked files that might conflict with incoming changes. When you want to completely reset your local repository, you need to explicitly tell Git to discard these protections.

## Method 1: Reset and Clean (Recommended)

The safest and most common approach combines `git reset` to remove staged and committed changes with `git clean` to remove untracked files.

First, fetch the latest changes from the remote:

```bash
git fetch origin
```

Then reset your current branch to match the remote branch exactly:

```bash
git reset --hard origin/main
```

This removes all local commits and staged changes, making your branch identical to the remote main branch.

Finally, remove any untracked files and directories:

```bash
git clean -fd
```

The flags mean:

- `-f` forces the deletion of untracked files
- `-d` includes untracked directories

You can combine these into a complete reset sequence:

```bash
git fetch origin
git reset --hard origin/main
git clean -fd
```

## Method 2: Using Git Pull with Force

You can force `git pull` to work by first resetting any conflicting changes:

```bash
# Discard all local changes
git reset --hard HEAD

# Remove untracked files
git clean -fd

# Now pull will work without conflicts
git pull origin main
```

This approach resets your working directory to the last commit, removes untracked files, and then pulls the latest changes.

## Method 3: Checkout Remote Branch Directly

Another approach is to check out the remote branch directly, which automatically overwrites your local branch:

```bash
# Fetch latest changes
git fetch origin

# Checkout the remote branch, overwriting local branch
git checkout -B main origin/main
```

The `-B` flag creates a new branch or resets an existing branch to the specified commit. This effectively replaces your local main branch with the remote version.

## Method 4: Stash and Reset (Preserves Changes)

If you might want to recover your local changes later, you can stash them before resetting:

```bash
# Stash current changes (including untracked files)
git stash push -u -m "Backup before force pull"

# Pull the latest changes
git pull origin main

# Optionally recover your changes later
# git stash pop
```

The `-u` flag includes untracked files in the stash, and `-m` adds a descriptive message.

## Handling Different Scenarios

### Dealing with Merge Conflicts

If you're in the middle of a merge with conflicts:

```bash
# Abort the current merge
git merge --abort

# Reset to remote state
git fetch origin
git reset --hard origin/main
git clean -fd
```

### Recovering from Failed Rebases

If a rebase went wrong and you want to start over:

```bash
# Abort the rebase
git rebase --abort

# Reset to remote state
git fetch origin
git reset --hard origin/main
```

### Multiple Remote Branches

When working with multiple branches that all need resetting:

```bash
# Reset main branch
git checkout main
git fetch origin
git reset --hard origin/main

# Reset feature branch
git checkout feature-branch
git reset --hard origin/feature-branch

# Clean untracked files once
git clean -fd
```

## Safety Considerations and Backup

Before forcing any destructive operations, consider creating a backup:

```bash
# Create a backup branch with current state
git branch backup-$(date +%Y%m%d-%H%M%S)

# Now safely proceed with force operations
git reset --hard origin/main
git clean -fd
```

You can also check what files would be deleted before running clean:

```bash
# See what would be deleted without actually deleting
git clean -n

# See what would be deleted including directories
git clean -nd
```

## Automating the Process

You can create a Git alias for the complete reset process:

```bash
git config --global alias.force-pull '!git fetch origin && git reset --hard origin/$(git rev-parse --abbrev-ref HEAD) && git clean -fd'
```

Now you can use:

```bash
git force-pull
```

This alias automatically determines your current branch name and resets to the corresponding remote branch.

## Alternative: Using Git Worktrees

For situations where you frequently need to switch between clean states, consider using Git worktrees:

```bash
# Create a new worktree for clean testing
git worktree add ../project-clean main

# Work in the clean directory
cd ../project-clean
git pull origin main
```

This keeps your main working directory unchanged while providing a clean environment.

## Recovering After Force Operations

If you realize you needed some of your discarded changes:

Check the reflog for recent commits you might have lost:

```bash
git reflog
```

Look for commits you made before the reset and create a new branch from them:

```bash
git branch recovery-branch a1b2c3d
```

For stashed changes, list and recover them:

```bash
git stash list
git stash apply stash@{0}
```

## Best Practices

Communicate with your team before force-pulling shared branches, as this can cause confusion if others are working on the same code.

Use force operations primarily on feature branches or when you're certain about discarding local work.

Consider the impact on any local configuration files or environment-specific changes that shouldn't be overwritten.

Regular commits and pushes reduce the need for force operations by keeping your local repository in sync with the remote.

These methods give you the tools to completely reset your local repository when needed. Remember that force operations are destructive, so use them thoughtfully and always consider whether you need to preserve any local work before proceeding.
