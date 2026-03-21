---
title: 'How to Reset Git to a Previous Commit'
excerpt: 'Learn different ways to reset your Git repository to a previous commit state. Understand the differences between soft, mixed, and hard resets and when to use each approach.'
category:
  name: 'Git'
  slug: 'git'
date: '2024-12-01'
publishedAt: '2024-12-01T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Version Control
  - Reset
  - Development
  - Command Line
---

Sometimes you need to undo recent commits and return your repository to a previous state. Git provides several methods to reset your repository, each with different levels of impact on your working directory and commit history.

In this guide, you'll learn how to safely reset Git to a previous commit using different reset strategies and understand when to use each approach.

## Prerequisites

You need Git installed on your system and a basic understanding of Git commits and branches. Make sure you're working in a Git repository with commit history. It's recommended to create a backup branch before performing destructive operations.

## Understanding Git Reset Types

Git offers three types of reset operations, each affecting different areas of your repository:

- **Soft Reset**: Moves HEAD to the specified commit but keeps changes staged
- **Mixed Reset**: Moves HEAD and unstages changes (default behavior)
- **Hard Reset**: Moves HEAD and discards all changes completely

Let's explore each type in detail.

## Finding the Target Commit

Before resetting, you need to identify the commit you want to reset to. Use these commands to explore your commit history:

```bash
# View commit history with one line per commit
git log --oneline

# View detailed commit history
git log

# View last 5 commits
git log -5 --oneline

# View commits with graphical representation
git log --graph --oneline --all
```

Each commit has a unique hash (like `a1b2c3d`) that you'll use for the reset operation. You can also use relative references:

```bash
# Reset to the previous commit
HEAD~1

# Reset to 3 commits ago
HEAD~3

# Reset to a specific branch's latest commit
origin/main
```

## Soft Reset: Keeping Changes Staged

A soft reset moves your branch pointer to a previous commit but keeps all changes from the removed commits staged in your index:

```bash
# Soft reset to a specific commit
git reset --soft a1b2c3d

# Soft reset to the previous commit
git reset --soft HEAD~1

# Soft reset to 3 commits ago
git reset --soft HEAD~3
```

After a soft reset, you can see your changes are still staged:

```bash
# Check status after soft reset
git status

# You'll see changes ready to be committed
```

This approach is ideal when you want to squash multiple commits into one:

```bash
# Reset to 3 commits ago but keep changes staged
git reset --soft HEAD~3

# Now create a new commit with all the changes
git commit -m "Combine previous 3 commits into one"
```

## Mixed Reset: Unstaging Changes

Mixed reset is the default behavior when you don't specify a reset type. It moves HEAD to the target commit and unstages changes, but keeps them in your working directory:

```bash
# Mixed reset to a specific commit (default behavior)
git reset a1b2c3d

# Explicitly specify mixed reset
git reset --mixed HEAD~2

# Reset and unstage everything
git reset
```

After a mixed reset, your changes are preserved but unstaged:

```bash
# Check what's changed after mixed reset
git status

# You'll see modified files that need to be staged again
```

This is useful when you want to reorganize your commits:

```bash
# Reset to previous commit, keeping changes unstaged
git reset HEAD~1

# Selectively stage parts of your changes
git add -p file1.js
git commit -m "First part of the changes"

# Stage and commit remaining changes
git add .
git commit -m "Second part of the changes"
```

## Hard Reset: Discarding All Changes

Hard reset is the most destructive option. It moves HEAD to the target commit and completely discards all changes:

```bash
# Hard reset to a specific commit (DESTRUCTIVE)
git reset --hard a1b2c3d

# Hard reset to previous commit
git reset --hard HEAD~1

# Hard reset to remote branch state
git reset --hard origin/main
```

**Warning**: Hard reset permanently deletes uncommitted changes. Always ensure you don't have important work that isn't committed or backed up.

Check your working directory is clean before hard reset:

```bash
# Make sure you don't have uncommitted changes
git status

# If you have important uncommitted changes, stash them first
git stash push -m "Backup before hard reset"

# Then perform the hard reset
git reset --hard HEAD~2
```

## Resetting Individual Files

You can reset specific files to a previous state without affecting other files:

```bash
# Reset a specific file to its state in HEAD~2
git checkout HEAD~2 -- filename.js

# Reset multiple files
git checkout a1b2c3d -- file1.js file2.css

# Reset all files in a directory
git checkout HEAD~1 -- src/components/
```

This creates a new modification in your working directory that you can commit:

```bash
# After resetting specific files, check status
git status

# Commit the file reset
git add filename.js
git commit -m "Reset filename.js to previous version"
```

## Recovering from Reset Operations

If you accidentally perform a destructive reset, Git's reflog can help you recover:

```bash
# View reflog to see recent HEAD movements
git reflog

# Look for the commit you want to recover
# Output shows: a1b2c3d HEAD@{0}: reset: moving to HEAD~3

# Reset back to that commit
git reset --hard a1b2c3d
```

The reflog keeps track of where HEAD has been, allowing you to recover from most reset operations within approximately 30 days.

## Safe Reset Practices

Before performing any destructive reset operation, create a backup:

```bash
# Create a backup branch at current state
git branch backup-before-reset

# Perform your reset operation
git reset --hard HEAD~3

# If something goes wrong, you can return to the backup
git checkout backup-before-reset
```

For shared repositories, avoid using reset on commits that have been pushed:

```bash
# Check if commits have been pushed
git log origin/main..HEAD

# If output is empty, commits are already pushed
# Use git revert instead of reset for pushed commits
```

## Alternative Approaches

### Using Git Revert

For commits that have been shared with others, use revert instead of reset:

```bash
# Revert the last commit (creates a new commit)
git revert HEAD

# Revert multiple commits
git revert HEAD~2..HEAD

# Revert a specific commit
git revert a1b2c3d
```

Revert creates new commits that undo changes, preserving history and avoiding issues with shared repositories.

### Interactive Rebase

For more granular control over commit history:

```bash
# Interactive rebase to modify last 3 commits
git rebase -i HEAD~3

# This opens an editor where you can:
# - pick: keep the commit
# - squash: combine with previous commit
# - drop: remove the commit entirely
```

## Resetting in Different Scenarios

### Undoing a Merge Commit

If you need to undo a merge that hasn't been pushed:

```bash
# Reset to before the merge
git reset --hard HEAD~1

# Or reset to a specific parent of the merge
git reset --hard HEAD^1
```

### Cleaning Up Local Experiments

When you've been experimenting locally and want to start fresh:

```bash
# Hard reset to match remote state
git fetch origin
git reset --hard origin/main

# This discards all local commits and changes
```

### Partial Reset with Staging

Reset some commits but keep specific files staged:

```bash
# Mixed reset to 2 commits ago
git reset HEAD~2

# Stage only the files you want to keep
git add important-file.js

# Create a new commit with selected changes
git commit -m "Keep only important changes"
```

Now you understand the different ways to reset Git to a previous commit. Remember that soft and mixed resets are generally safe, while hard resets can permanently lose work. Always consider the impact on shared repositories and create backups when necessary.
