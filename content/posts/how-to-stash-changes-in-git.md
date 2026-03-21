---
title: 'How to Stash Changes in Git'
excerpt: 'Learn how to temporarily save your work in progress using Git stash. Learn stashing, applying, and managing multiple stashes to handle interruptions in your development workflow.'
category:
  name: 'Git'
  slug: 'git'
date: '2024-11-30'
publishedAt: '2024-11-30T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Version Control
  - Stash
  - Development
  - Workflow
---

You're working on a feature when suddenly you need to switch branches to fix a critical bug or pull the latest changes from remote. Your current work isn't ready for a commit, but you don't want to lose your progress. Git stash provides the perfect solution for temporarily saving your work in progress.

In this guide, you'll learn how to use Git stash to manage interruptions in your development workflow while keeping your working directory clean.

## Prerequisites

You need Git installed on your system and a basic understanding of Git branches and working directory states. Make sure you're working in a Git repository with some uncommitted changes to practice stashing operations.

## Understanding Git Stash

Git stash temporarily saves your uncommitted changes (both staged and unstaged) and reverts your working directory to a clean state matching the last commit. You can later retrieve these changes and continue working where you left off.

The stash acts like a stack - you can push multiple stashes and pop them in reverse order (last in, first out).

## Basic Stashing Operations

### Creating Your First Stash

To stash your current changes:

```bash
# Stash all changes with a default message
git stash

# Stash with a custom message (recommended)
git stash push -m "WIP: working on user authentication"

# Alternative syntax for custom message
git stash save "WIP: implementing search feature"
```

After stashing, your working directory becomes clean:

```bash
# Check status after stashing
git status
# Output: "nothing to commit, working tree clean"
```

### Viewing Your Stashes

To see what stashes you have:

```bash
# List all stashes
git stash list

# View stash content
git stash show

# View detailed changes in a specific stash
git stash show -p stash@{0}

# View detailed changes in the latest stash
git stash show -p
```

The `git stash list` output looks like this:

```
stash@{0}: WIP on feature-branch: a1b2c3d working on user authentication
stash@{1}: WIP on main: e4f5g6h implementing search feature
```

### Applying Stashed Changes

To restore your stashed changes:

```bash
# Apply the most recent stash and keep it in stash list
git stash apply

# Apply a specific stash by reference
git stash apply stash@{1}

# Apply the most recent stash and remove it from stash list
git stash pop

# Apply a specific stash and remove it from stash list
git stash pop stash@{0}
```

The difference between `apply` and `pop`:

- `apply`: Restores changes but keeps the stash in your stash list
- `pop`: Restores changes and removes the stash from your stash list

## Advanced Stashing Techniques

### Stashing Specific Files

You can stash only certain files instead of all changes:

```bash
# Stash specific files
git stash push -m "Stash only CSS changes" styles.css

# Stash multiple specific files
git stash push -m "Stash UI components" src/components/Header.js src/components/Footer.js

# Stash files matching a pattern
git stash push -m "Stash all JavaScript files" *.js
```

### Including Untracked Files

By default, Git stash only saves tracked files. To include untracked files:

```bash
# Stash including untracked files
git stash push -u -m "Include new files"

# Alternative flag for untracked files
git stash push --include-untracked -m "WIP with new files"

# Stash everything including ignored files (rarely needed)
git stash push -a -m "Include all files"
```

### Stashing Only Staged Changes

To stash only the changes that are currently staged:

```bash
# Stash only staged changes, leave unstaged changes in working directory
git stash push --staged -m "Stash only staged changes"

# This is useful when you want to stash prepared changes but keep working on others
```

## Managing Multiple Stashes

### Creating Descriptive Stashes

Always use descriptive messages for your stashes:

```bash
# Good stash messages
git stash push -m "WIP: user login form validation"
git stash push -m "Half-finished API integration for payments"
git stash push -m "Debugging CSS layout issues on mobile"

# Poor stash messages to avoid
git stash  # Uses default message
git stash push -m "stuff"
git stash push -m "wip"
```

### Deleting Stashes

Remove stashes you no longer need:

```bash
# Delete a specific stash
git stash drop stash@{1}

# Delete the most recent stash
git stash drop

# Delete all stashes (be careful!)
git stash clear
```

### Creating Branches from Stashes

Turn a stash into a new branch, which is useful for complex changes:

```bash
# Create a new branch from the most recent stash
git stash branch new-feature-branch

# Create a branch from a specific stash
git stash branch bugfix-branch stash@{2}
```

This command creates a new branch from the commit where the stash was created, applies the stash, and then drops it from the stash list.

## Common Stashing Scenarios

### Switching Branches with Uncommitted Changes

When you need to switch branches but have uncommitted work:

```bash
# You're on feature-branch with uncommitted changes
git status  # Shows modified files

# Stash your changes
git stash push -m "WIP: feature implementation"

# Switch to another branch
git checkout main

# Do your work on main branch
git pull origin main

# Switch back to your feature branch
git checkout feature-branch

# Restore your work
git stash pop
```

### Pulling Latest Changes

When you need to pull remote changes but have local modifications:

```bash
# Stash local changes
git stash push -m "Local changes before pull"

# Pull latest changes from remote
git pull origin main

# Restore your local changes
git stash pop

# If there are conflicts, resolve them and continue
```

### Quick Bug Fixes

When you're in the middle of implementing a feature but need to make a quick fix:

```bash
# Stash current feature work
git stash push -m "Feature work in progress"

# Make your quick fix
git checkout main
# ... make and commit your fix

# Return to feature work
git checkout feature-branch
git stash pop
```

## Handling Stash Conflicts

Sometimes applying a stash creates conflicts with your current working directory:

```bash
# When git stash pop creates conflicts
git stash pop
# Git will mark conflicted files

# Check what files have conflicts
git status

# Resolve conflicts in your editor, then
git add resolved-file.js

# The stash is automatically removed after successful resolution
# If you used 'git stash apply', you need to manually drop the stash
git stash drop stash@{0}
```

## Inspecting Stash Contents

Before applying a stash, you might want to review what changes it contains:

```bash
# See which files were changed
git stash show stash@{0}

# See the actual changes (diff view)
git stash show -p stash@{0}

# Compare stash with current working directory
git diff stash@{0}

# Compare stash with a specific commit
git diff a1b2c3d stash@{0}
```

## Best Practices for Git Stash

### Use Descriptive Messages

Always include meaningful messages that help you remember what the stash contains:

```bash
# Good examples
git stash push -m "API integration half-complete, needs error handling"
git stash push -m "UI components styled, responsive design pending"
git stash push -m "Database migration draft, needs testing"
```

### Keep Stashes Short-Term

Stashes are meant for temporary storage. Don't use them for long-term storage of changes:

```bash
# Review your stashes regularly
git stash list

# Clean up old stashes
git stash drop stash@{3}  # Remove specific old stash
```

### Combine with Branching

For longer-term work interruptions, consider creating a WIP (Work In Progress) branch instead of stashing:

```bash
# For longer interruptions, use a branch
git checkout -b wip/feature-implementation
git add .
git commit -m "WIP: feature implementation checkpoint"
git checkout main
# ... do other work
git checkout wip/feature-implementation
# Continue where you left off
```

### Stash Before Risky Operations

Before performing potentially destructive operations, stash your work as a safety net:

```bash
# Before rebasing or resetting
git stash push -m "Safety backup before rebase"
git rebase -i HEAD~5

# If something goes wrong, you can recover
git stash pop
```

Now you understand how to effectively use Git stash to manage interruptions in your development workflow. Remember that stashing is a temporary solution - for longer-term storage, consider using branches with proper commits.
