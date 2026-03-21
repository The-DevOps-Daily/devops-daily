---
title: 'Move the Most Recent Commit(s) to a New Branch with Git'
excerpt: 'Learn how to move recent commits from your current branch to a new branch using git checkout, reset, and cherry-pick. Fix branch organization mistakes effectively.'
category:
  name: 'Git'
  slug: 'git'
date: '2024-12-06'
publishedAt: '2024-12-06T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Version Control
  - Branch Management
  - Development
  - Workflow
---

You started working on a new feature but accidentally committed your changes to the main branch instead of creating a feature branch. Or you realize that your recent commits belong on a different branch entirely. Git provides several ways to move recent commits to a new branch while cleaning up your current branch.

In this guide, you'll learn different methods to transfer recent commits to a new branch and when to use each approach.

## Prerequisites

You need Git installed on your system and basic knowledge of Git branches, commits, and resets. Make sure you're working with commits that haven't been pushed to a shared repository, as moving commits involves rewriting history.

## Understanding Commit Movement

When you move commits to a new branch, you're essentially:

1. Creating a new branch from the current state
2. Resetting the current branch to remove the commits
3. The new branch retains the commits you want to move

This operation is safe for local commits but should be avoided for pushed commits.

## Method 1: Create Branch and Reset (Recommended)

This is the most straightforward and commonly used method:

### Moving Recent Commits to a New Branch

```bash
# Create a new branch from current state (this preserves all commits)
git checkout -b new-feature-branch

# Switch back to the original branch
git checkout main

# Reset the original branch to remove recent commits
git reset --hard HEAD~3  # Removes last 3 commits

# Verify the result
git log --oneline -5  # Check main branch
git checkout new-feature-branch
git log --oneline -5  # Check new branch has the commits
```

This method creates a new branch with all your recent work, then removes those commits from the original branch.

### Step-by-Step Example

Let's say you have this situation:

```bash
# Your current commit history on main
git log --oneline
# a1b2c3d (HEAD -> main) Add user dashboard
# e4f5g6h Implement user authentication
# i7j8k9l Fix login validation
# m1n2o3p Previous main branch work
```

You want to move the last 3 commits to a new branch:

```bash
# 1. Create new branch from current state
git checkout -b feature/user-system

# 2. Switch back to main
git checkout main

# 3. Reset main to before your feature commits
git reset --hard m1n2o3p  # or HEAD~3

# 4. Verify the split
git log --oneline  # main now ends at m1n2o3p
git checkout feature/user-system
git log --oneline  # feature branch has all commits
```

## Method 2: Using git branch and Reset

An alternative approach that creates the branch without switching:

```bash
# Create new branch from current commit (without switching)
git branch new-feature-branch

# Reset current branch to remove recent commits
git reset --hard HEAD~2

# The new branch now contains the commits you moved
```

This method is slightly more efficient as it doesn't require switching branches back and forth.

## Method 3: Moving Commits from a Different Branch

If you need to move commits that are already on a different branch:

```bash
# Switch to the source branch
git checkout feature-branch

# Create new branch for the commits you want to move
git checkout -b specific-feature HEAD~2  # Creates branch from 2 commits ago

# Switch back to source branch
git checkout feature-branch

# Remove the commits you moved
git reset --hard HEAD~3  # Remove last 3 commits

# The commits are now isolated on specific-feature branch
```

## Method 4: Interactive Approach for Selective Moving

When you want to move only specific commits, not just the most recent ones:

```bash
# Start an interactive rebase
git rebase -i HEAD~5

# In the editor, mark commits to move as 'drop'
# Keep commits you want to stay on current branch as 'pick'

# After completing rebase, create new branch with dropped commits
# (You'll need to use git reflog to find the dropped commits)
git reflog
git checkout -b moved-commits <commit-hash-before-rebase>
```

This method is more complex but gives you granular control over which commits to move.

## Moving Specific Ranges of Commits

### Moving a Sequence of Recent Commits

```bash
# Move last 4 commits to new branch
git checkout -b feature-branch
git checkout main
git reset --hard HEAD~4
```

### Moving Commits Between Specific Points

```bash
# Move commits between two specific commits
git checkout -b feature-branch <end-commit>
git checkout main
git reset --hard <start-commit>
```

### Cherry-Picking Specific Commits

For non-consecutive commits, use cherry-pick:

```bash
# Create new branch
git checkout -b selected-commits main~5

# Cherry-pick specific commits
git cherry-pick a1b2c3d
git cherry-pick e4f5g6h

# Remove original commits from main if needed
git checkout main
git rebase -i HEAD~5  # Mark unwanted commits as 'drop'
```

## Handling Different Scenarios

### Moving Commits with Merge History

When your commits include merges:

```bash
# Create branch preserving merge structure
git checkout -b feature-with-merges

# Reset main branch
git checkout main
git reset --hard HEAD~5

# Verify merge history is preserved on new branch
git log --graph --oneline
```

### Moving Commits with File Conflicts

If moving commits would create conflicts:

```bash
# Create the new branch first
git checkout -b problematic-feature

# Switch back and reset more conservatively
git checkout main
git reset --soft HEAD~3  # Soft reset keeps changes staged

# Review changes and commit selectively
git status
git commit -m "Keep only compatible changes on main"
```

### Partial Commit Moving

When you want to move only part of recent work:

```bash
# Create new branch
git checkout -b partial-feature

# Reset current branch to a middle point
git checkout main
git reset --soft HEAD~2

# Selectively commit what should stay on main
git add specific-files.js
git commit -m "Keep these changes on main"

# Reset working directory to clean state
git reset --hard HEAD
```

## Verifying and Testing the Move

### Checking Branch States

After moving commits, verify both branches:

```bash
# Check original branch
git checkout main
git log --oneline -10
git status

# Check new branch
git checkout new-feature-branch
git log --oneline -10
git status

# Verify no commits were lost
git log --all --graph --oneline
```

### Testing Branch Functionality

Ensure both branches work correctly:

```bash
# Test original branch
git checkout main
# Run tests, verify application works

# Test new branch
git checkout new-feature-branch
# Run tests, verify feature works
```

## Recovery from Mistakes

If you make mistakes during the move operation:

```bash
# Use reflog to see recent branch movements
git reflog

# Example output:
# a1b2c3d HEAD@{0}: reset: moving to HEAD~3
# e4f5g6h HEAD@{1}: checkout: moving from feature-branch to main
# i7j8k9l HEAD@{2}: checkout: moving from main to feature-branch

# Recover to previous state
git reset --hard HEAD@{1}
```

### Creating Safety Backups

Before moving commits, create backup branches:

```bash
# Create backup of current state
git branch backup-before-move

# Perform your commit moving operations
git checkout -b new-feature
git checkout main
git reset --hard HEAD~3

# If something goes wrong, restore from backup
git checkout backup-before-move
git branch -D main  # Delete problematic main
git checkout -b main  # Recreate main from backup
```

## Best Practices

### Planning Commit Organization

Prevent the need to move commits by:

```bash
# Always create feature branches before starting work
git checkout -b feature/new-functionality
# Make your commits
git commit -m "Implement feature"

# When ready, merge to main
git checkout main
git merge feature/new-functionality
```

### Communicating Changes

When working in teams and you need to move commits:

```bash
# Document the branch reorganization
git commit -m "Reorganize commits: move user auth to feature branch

- Moved 3 commits from main to feature/user-auth
- Main branch now contains only core functionality
- Feature branch contains user authentication implementation"
```

### Maintaining Clean History

Use descriptive branch names when moving commits:

```bash
# Good branch names for moved commits
git checkout -b feature/user-authentication
git checkout -b bugfix/login-validation
git checkout -b refactor/database-layer

# Avoid generic names
git checkout -b temp-branch
git checkout -b moved-stuff
```

Now you understand how to effectively move recent commits to new branches. This technique helps you maintain organized branch structure and correct mistakes in commit placement while preserving your work and maintaining clean Git history.
