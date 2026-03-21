---
title: 'How to Make an Existing Git Branch Track a Remote Branch'
excerpt: 'Need to set up tracking between a local branch and a remote branch? Learn how to configure branch tracking for easier push and pull operations in Git.'
category:
  name: 'Git'
  slug: 'git'
date: '2025-06-18'
publishedAt: '2025-06-18T12:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Remote Branches
  - Version Control
  - Branch Tracking
  - Workflows
---

You created a local branch and pushed it to a remote repository, but now when you run `git pull` or `git push`, Git asks you to specify which remote branch to use. This happens because your local branch is not configured to track the remote branch.

**TLDR:** To make your current branch track a remote branch, use `git branch --set-upstream-to=origin/branch-name` or `git push -u origin branch-name`. The `-u` flag sets up tracking automatically when pushing. Once configured, you can use `git pull` and `git push` without specifying the remote branch.

In this guide, you'll learn how to set up branch tracking and understand what it does.

## Prerequisites

You'll need Git installed, a repository with remote access, and at least one local branch. Understanding basic Git concepts like branches, remotes, and push/pull operations will help you follow along.

## Understanding Branch Tracking

Branch tracking creates a relationship between a local branch and a remote branch. When tracking is set up, Git remembers which remote branch corresponds to your local branch:

```
Local Branch          Remote Branch
------------          -------------
feature-auth   <-->   origin/feature-auth
```

With this relationship established, you can use simplified commands:

```bash
# Without tracking:
git pull origin feature-auth
git push origin feature-auth

# With tracking:
git pull
git push
```

Git automatically knows which remote branch to use based on the tracking configuration.

## Setting Up Tracking for Current Branch

To configure your current branch to track a remote branch:

```bash
# Make current branch track a remote branch
git branch --set-upstream-to=origin/feature-auth

# Shorter syntax
git branch -u origin/feature-auth
```

After running this command, your local branch tracks the specified remote branch. Verify the configuration:

```bash
# Check tracking information
git branch -vv

# Output shows tracking relationship:
# * feature-auth a1b2c3d [origin/feature-auth] Add authentication
```

The bracketed text shows which remote branch your local branch tracks.

## Setting Up Tracking While Pushing

The easiest way to set up tracking is during your first push:

```bash
# Push and set upstream in one command
git push -u origin feature-auth

# Or use the long form
git push --set-upstream origin feature-auth
```

The `-u` flag tells Git to set the current branch to track the remote branch you're pushing to. This is the most common workflow when creating new branches:

```bash
# Create and switch to new branch
git checkout -b new-feature

# Make some commits
git add .
git commit -m "Add new feature"

# Push and set up tracking
git push -u origin new-feature

# Future pushes only need
git push
```

After the initial push with `-u`, subsequent pushes and pulls do not need to specify the remote or branch name.

## Setting Up Tracking for Different Branch Names

Sometimes your local branch has a different name than the remote branch:

```bash
# Local branch is 'feature', remote is 'feature-auth'
git branch --set-upstream-to=origin/feature-auth feature

# Or if it's your current branch
git branch -u origin/feature-auth
```

This works but can be confusing. It's generally better to rename your local branch to match:

```bash
# Rename local branch to match remote
git branch -m feature feature-auth

# Set up tracking
git branch -u origin/feature-auth
```

Now your local and remote branch names match, reducing confusion.

## Checking Current Tracking Configuration

To see which branches track which remotes:

```bash
# Show tracking info for all branches
git branch -vv

# Output:
#   main           a1b2c3d [origin/main] Update README
# * feature-auth   e4f5g6h [origin/feature-auth: ahead 2] Add OAuth
#   develop        i7j8k9l [origin/develop: behind 1] Merge pull request
```

This shows:
- Current branch (marked with `*`)
- Latest commit hash
- Remote tracking branch in brackets
- Sync status (ahead/behind)
- Latest commit message

For detailed information about a specific branch:

```bash
# Get remote tracking branch for current branch
git rev-parse --abbrev-ref --symbolic-full-name @{u}

# Output: origin/feature-auth
```

## Removing Tracking Relationship

To stop tracking a remote branch:

```bash
# Remove upstream tracking for current branch
git branch --unset-upstream

# Remove tracking for specific branch
git branch --unset-upstream feature-auth
```

After removing tracking, you'll need to specify the remote and branch name when pushing or pulling.

## Setting Up Tracking When Checking Out Remote Branches

When you check out a remote branch, Git automatically creates a tracking relationship:

```bash
# List remote branches
git branch -r

# Output:
#   origin/main
#   origin/feature-auth
#   origin/develop

# Check out remote branch (creates local tracking branch)
git checkout feature-auth

# Git automatically runs something like:
# git checkout -b feature-auth --track origin/feature-auth
```

This creates a local branch that tracks the remote branch with the same name.

Explicitly create a tracking branch with a custom name:

```bash
# Create local branch with different name tracking remote
git checkout -b my-feature --track origin/feature-auth

# Verify tracking
git branch -vv
# Output: * my-feature a1b2c3d [origin/feature-auth] Add feature
```

## Handling Multiple Remotes

If you work with multiple remotes (like origin and upstream), specify which remote to track:

```bash
# Track a branch on the upstream remote
git branch --set-upstream-to=upstream/main

# Track a branch on origin
git branch --set-upstream-to=origin/main

# Check configuration
git branch -vv
```

This is common when working with forks:

```
Your Workflow:
  Local main   -->  origin/main (your fork)
               \->  upstream/main (original repo)
```

You might configure your main branch to track upstream/main for pulling updates, while pushing to origin/main.

## Setting Default Push Behavior

Configure how Git handles pushing branches that do not have tracking set up:

```bash
# Only push current branch to its upstream
git config --global push.default simple

# Push all branches with matching names
git config --global push.default matching

# Only push current branch to same-named remote branch
git config --global push.default current
```

The `simple` setting is the default and safest option - it only pushes the current branch to its tracked upstream branch.

## Tracking Configuration in Git Config

Branch tracking is stored in your repository's Git config:

```bash
# View branch configuration
git config --local --get-regexp "branch.*"

# Output:
# branch.main.remote origin
# branch.main.merge refs/heads/main
# branch.feature-auth.remote origin
# branch.feature-auth.merge refs/heads/feature-auth
```

This shows the remote and merge configuration for each tracking branch. You can manually edit these:

```bash
# Set remote for a branch
git config branch.feature-auth.remote origin

# Set merge branch
git config branch.feature-auth.merge refs/heads/feature-auth
```

But using `git branch -u` is easier and less error-prone.

## Setting Up Tracking in Scripts

When automating Git workflows, set up tracking in scripts:

```bash
#!/bin/bash

# Get current branch name
BRANCH=$(git branch --show-current)

# Set up tracking if not already configured
if ! git config branch.$BRANCH.remote > /dev/null 2>&1; then
  echo "Setting up tracking for $BRANCH"
  git push -u origin "$BRANCH"
else
  echo "Branch $BRANCH already tracks $(git config branch.$BRANCH.remote)/$(git config branch.$BRANCH.merge | sed 's|refs/heads/||')"
fi
```

This script checks if tracking is configured and sets it up if needed.

## Tracking and Pull/Push Behavior

With tracking configured, Git's behavior changes:

```bash
# Without tracking:
git pull
# fatal: The current branch feature-auth has no upstream branch.

# With tracking:
git pull
# Already up to date.
```

The same applies to push:

```bash
# Without tracking:
git push
# fatal: The current branch feature-auth has no upstream branch.
# Use: git push --set-upstream origin feature-auth

# With tracking:
git push
# Everything up-to-date
```

## Fixing No upstream branch Errors

When you see "The current branch has no upstream branch", fix it with:

```bash
# Follow Git's suggestion
git push --set-upstream origin branch-name

# Or set tracking without pushing
git branch -u origin/branch-name

# Then push
git push
```

After setting upstream, the error will not occur again for that branch.

## Best Practices for Branch Tracking

Always set up tracking when creating new branches:

```bash
# Good: Set tracking immediately
git checkout -b new-feature
git push -u origin new-feature

# Less ideal: Set tracking later
git checkout -b new-feature
git push origin new-feature
git branch -u origin/new-feature
```

Keep local and remote branch names identical to avoid confusion:

```bash
# Good: Matching names
git checkout -b feature-auth
git push -u origin feature-auth

# Confusing: Different names
git checkout -b my-feature
git push -u origin feature-auth
```

Regularly check tracking status:

```bash
# Quick check of current branch
git status

# Detailed check of all branches
git branch -vv
```

Now you know how to set up and manage branch tracking in Git. The `-u` flag when pushing is the easiest way to establish tracking for new branches, while `git branch --set-upstream-to` lets you configure tracking for existing branches. With tracking configured, your Git workflow becomes cleaner and requires fewer keystrokes.
