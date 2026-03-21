---
title: 'How to Move Uncommitted Work to a New Branch in Git'
excerpt: 'Started working on the wrong branch? Learn how to move your uncommitted changes to a new branch without losing any work.'
category:
  name: 'Git'
  slug: 'git'
date: '2024-11-08'
publishedAt: '2024-11-08T10:30:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Branches
  - Version Control
  - Workflow
  - Stash
---

You started making changes and then realized you're on the wrong branch. Maybe you're on main when you should be on a feature branch. Git makes it easy to move uncommitted work to a new branch without losing anything.

**TLDR:** To move uncommitted changes to a new branch, use `git checkout -b new-branch-name` before committing. Git automatically brings your changes with you. If you have both staged and unstaged changes, they all move together to the new branch.

In this guide, you'll learn different ways to move uncommitted work between branches.

## Prerequisites

You'll need Git installed on your system and a repository with uncommitted changes. Basic familiarity with Git branches and the staging area will help you follow along.

## Understanding Uncommitted Changes

Git handles changes in three states:

```
Working Directory → Staging Area → Committed
(modified files)    (git add)      (git commit)
```

Uncommitted changes exist in either your working directory or staging area. These changes are not tied to a specific branch until you commit them, making them easy to move.

## Moving Changes to a New Branch

The simplest way to move uncommitted work is to create a new branch before committing:

```bash
# You're on main with uncommitted changes
git status
# On branch main
# Changes not staged for commit:
#   modified: app.js
#   modified: styles.css

# Create new branch and switch to it
git checkout -b feature-new-ui

# Your changes come with you
git status
# On branch feature-new-ui
# Changes not staged for commit:
#   modified: app.js
#   modified: styles.css
```

Now you can commit your changes on the new branch:

```bash
# Stage and commit on the new branch
git add .
git commit -m "Add new UI components"
```

The main branch remains unchanged, and your new branch contains all your work.

## Moving Staged and Unstaged Changes

Git moves both staged and unstaged changes when you switch branches:

```bash
# Mixed staged and unstaged changes
git status
# On branch main
# Changes to be committed:
#   modified: app.js
# Changes not staged for commit:
#   modified: styles.css

# Create new branch - both types of changes move
git checkout -b feature-styling

# Verify everything moved
git status
# On branch feature-styling
# Changes to be committed:
#   modified: app.js
# Changes not staged for commit:
#   modified: styles.css
```

Your staging area state is preserved when creating the new branch.

## Using git switch for Modern Git

Git 2.23 and later provide the `switch` command as a clearer alternative:

```bash
# Create new branch and switch to it
git switch -c feature-authentication

# Or the long form
git switch --create feature-authentication
```

The `switch` command works identically to `checkout -b` but has a more intuitive name focused on branch switching.

## Moving Changes to an Existing Branch

If you want to move changes to an existing branch instead of creating a new one:

```bash
# You're on main with uncommitted changes
git status

# Switch to existing branch
git checkout feature-dashboard

# Changes move if there are no conflicts
```

Git allows this only if switching would not overwrite your local changes. If there are conflicts, you'll see:

```
error: Your local changes to the following files would be overwritten by checkout:
  app.js
Please commit your changes or stash them before you switch branches.
```

In this case, use stash or commit first.

## Using Stash When Switching is Blocked

When Git prevents switching due to conflicts, use stash:

```bash
# Stash your changes
git stash push -m "Work in progress"

# Switch to the target branch
git checkout feature-dashboard

# Apply the stashed changes
git stash pop
```

The stash temporarily saves your changes, letting you switch branches freely. Then you reapply them on the new branch.

## Moving Specific Files Only

To move only some changes to a new branch:

```bash
# You have multiple changed files
git status
# modified: app.js
# modified: styles.css
# modified: README.md

# Stash everything
git stash

# Create new branch
git checkout -b feature-ui-only

# Apply only specific files from stash
git checkout stash@{0} -- app.js styles.css

# The other files remain stashed
git stash list
```

This gives you fine-grained control over which changes go to the new branch.

## Handling Untracked Files

Untracked files (new files not yet added to Git) automatically move with you:

```bash
# New files in working directory
git status
# Untracked files:
#   new-component.js
#   new-styles.css

# Create new branch
git checkout -b feature-new-component

# Untracked files come along
git status
# On branch feature-new-component
# Untracked files:
#   new-component.js
#   new-styles.css
```

Since untracked files are not tied to any branch, they remain in your working directory when switching.

## Common Workflow Pattern

Here's a typical workflow when you realize you're on the wrong branch:

```bash
# 1. Check what you've changed
git status
git diff

# 2. Create a new branch from current position
git checkout -b fix-authentication-bug

# 3. Stage and commit your work
git add .
git commit -m "Fix authentication token validation"

# 4. Switch back to main
git checkout main

# 5. Verify main is clean
git status
# On branch main
# nothing to commit, working tree clean
```

The main branch is never affected because you committed the changes on the new branch.

## Moving Changes While Keeping Main Up to Date

If you want your new branch to start from the latest main:

```bash
# You're on main with changes
git stash

# Update main
git pull origin main

# Create new branch from updated main
git checkout -b feature-new-endpoint

# Restore your changes
git stash pop
```

This makes sure your feature branch is based on the latest code.

## What If You Already Committed?

If you committed to the wrong branch, use a different approach:

```bash
# You committed to main by mistake
git log --oneline -1
# abc1234 Add new feature

# Create new branch from current position
git branch feature-new-branch

# Reset main to before your commit
git reset --hard HEAD~1

# Switch to the new branch
git checkout feature-new-branch

# Your commit is now on the new branch
git log --oneline -1
# abc1234 Add new feature
```

This moves the commit itself to a new branch, not just uncommitted changes.

## Handling Merge Conflicts After Moving

When you apply stashed changes to a new branch, conflicts can occur:

```bash
# Apply stash causes conflicts
git stash pop
# CONFLICT (content): Merge conflict in app.js

# Resolve the conflicts in your editor
nano app.js

# Stage the resolved files
git add app.js

# Drop the stash (it's been applied)
git stash drop
```

Conflicts happen when the branch you switched to has different code in the same areas you modified.

## Moving Changes Between Remote Branches

If both branches are tracking remote branches:

```bash
# On local main with changes
git checkout -b feature-api-update

# Commit the changes
git add .
git commit -m "Update API endpoints"

# Push to remote
git push -u origin feature-api-update

# Main branch is unaffected locally and remotely
git checkout main
git status
# On branch main
# Your branch is up to date with 'origin/main'
```

Your changes are now on the remote feature branch without affecting main.

## Quick Reference

Here's a quick decision tree for moving uncommitted work:

```
Have uncommitted changes?
  ├─ Want to create NEW branch?
  │  └─ git checkout -b new-branch-name
  │
  ├─ Want to switch to EXISTING branch?
  │  ├─ No conflicts expected?
  │  │  └─ git checkout existing-branch
  │  │
  │  └─ Conflicts possible?
  │     └─ git stash → git checkout existing-branch → git stash pop
  │
  └─ Already committed?
     └─ git branch new-branch → git reset --hard HEAD~1 → git checkout new-branch
```

## Best Practices

Always check your branch before starting work:

```bash
# Before making changes
git branch
# * main
#   feature-authentication

# Oops, I'm on main
git checkout feature-authentication
# Now start working
```

Create topic branches for new work:

```bash
# Good practice: Always work on feature branches
git checkout main
git pull origin main
git checkout -b feature-user-profile
# Now make changes
```

Use descriptive branch names:

```bash
# Good branch names
git checkout -b fix-login-redirect
git checkout -b feature-payment-gateway
git checkout -b refactor-api-handlers

# Less helpful names
git checkout -b temp
git checkout -b fix
git checkout -b updates
```

Now you know how to move uncommitted work to a new branch in Git. The key is understanding that uncommitted changes are not bound to a specific branch until you commit them, making them easy to move with `git checkout -b` or `git switch -c`.
