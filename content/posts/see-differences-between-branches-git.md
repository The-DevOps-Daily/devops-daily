---
title: 'How to See the Differences Between Two Branches in Git'
excerpt: 'Need to compare branches before merging? Learn how to view differences between Git branches using diff, log, and other comparison commands.'
category:
  name: 'Git'
  slug: 'git'
date: '2024-12-28'
publishedAt: '2024-12-28T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Diff
  - Branches
  - Comparison
  - Version Control
---

Before merging a feature branch, reviewing a pull request, or understanding what changed between releases, you need to see what differs between two branches. Git provides several commands to compare branches at different levels of detail.

**TLDR:** To see differences between branches, use `git diff branch1..branch2` to show file changes, `git log branch1..branch2` to show commit differences, or `git diff --name-only branch1 branch2` to list changed filenames. The two-dot syntax (`..`) shows differences, while three-dot (`...`) shows changes since the branches diverged.

In this guide, you'll learn how to compare branches effectively in Git.

## Prerequisites

You'll need Git installed on your system and a repository with multiple branches. Basic familiarity with Git branches and the diff command will be helpful.

## Basic Branch Comparison

To see all changes between two branches:

```bash
# Show differences between main and feature branch
git diff main..feature-branch

# Or without the dots (same result)
git diff main feature-branch
```

This shows the actual code changes - additions and deletions in all files.

## Listing Changed Files Only

To see which files differ without showing the changes:

```bash
# List files that differ
git diff --name-only main feature-branch

# Output:
# src/app.js
# src/auth.js
# tests/auth.test.js
# README.md
```

This is useful for getting an overview without detailed diffs.

## Showing File Changes with Status

To see filenames with their change status:

```bash
# Show files with status indicators
git diff --name-status main feature-branch

# Output:
# M    src/app.js        (Modified)
# A    src/auth.js       (Added)
# D    old/legacy.js     (Deleted)
# M    README.md         (Modified)
```

Status codes:
- `M` = Modified
- `A` = Added
- `D` = Deleted
- `R` = Renamed
- `C` = Copied

## Viewing Commit Differences

To see which commits are in one branch but not the other:

```bash
# Commits in feature-branch not in main
git log main..feature-branch

# Show one-line format
git log --oneline main..feature-branch

# Output:
# abc123 Add user authentication
# def456 Fix validation bug
# ghi789 Update documentation
```

This shows commits that will be merged when you merge feature-branch into main.

## Two-Dot vs Three-Dot Syntax

Git offers two comparison modes:

**Two dots (`..`) - Show total differences:**

```bash
# Show all differences between branches
git diff main..feature-branch

# Equivalent to:
git diff main feature-branch
```

**Three dots (`...`) - Show changes since divergence:**

```bash
# Show only what changed in feature-branch since it diverged from main
git diff main...feature-branch

# This excludes changes made to main after the branch point
```

The three-dot syntax is useful for seeing what your branch actually changed, ignoring updates to main.

## Comparing Branches Visually

For a graphical view of branch differences:

```bash
# Show commit graph
git log --graph --oneline --all main feature-branch

# Output shows branching structure:
# * abc123 (feature-branch) Add authentication
# * def456 Fix bug
# | * ghi789 (main) Update config
# |/
# * jkl012 Common ancestor
```

This visualizes where branches diverged and their respective commits.

## Finding Which Branch Contains What

To see if a branch has certain changes:

```bash
# Check if feature-branch has commits from main
git log feature-branch..main

# If empty output, feature-branch is up to date
# If shows commits, feature-branch is behind

# Check if main has commits from feature-branch
git log main..feature-branch

# Shows what's in feature-branch but not in main
```

## Comparing Specific Files

To see differences in specific files between branches:

```bash
# Compare specific file
git diff main feature-branch -- src/app.js

# Compare multiple files
git diff main feature-branch -- src/app.js src/auth.js

# Compare directory
git diff main feature-branch -- src/
```

## Showing Statistics

To see how much changed:

```bash
# Show change statistics
git diff --stat main feature-branch

# Output:
#  src/app.js         | 25 ++++++++++++++++------
#  src/auth.js        | 45 +++++++++++++++++++++++++++++++++++++
#  tests/auth.test.js | 32 ++++++++++++++++++++++++++
#  README.md          |  8 +++++--
#  4 files changed, 102 insertions(+), 12 deletions(-)
```

This shows files changed and line counts.

## Comparing with Remote Branches

To compare your branch with remote branches:

```bash
# Compare local main with remote main
git diff main origin/main

# Compare local feature with remote main
git diff origin/main feature-branch

# Compare two remote branches
git diff origin/main origin/feature-branch
```

Make sure to fetch first to get latest remote changes:

```bash
git fetch --all
git diff origin/main origin/develop
```

## Finding Merge Base

To find where two branches diverged:

```bash
# Find common ancestor
git merge-base main feature-branch

# Output:
# jkl012abc...

# Show what changed since divergence
git diff $(git merge-base main feature-branch)..feature-branch
```

This shows exactly what your branch added since branching off.

## Comparing Across Time

To see how branches evolved:

```bash
# Compare main now vs main yesterday
git diff main@{yesterday} main

# Compare feature-branch 1 week ago vs now
git diff feature-branch@{1.week.ago} feature-branch

# Compare at specific date
git diff main@{2024-01-15} main
```

## Ignoring Whitespace Changes

To ignore whitespace when comparing:

```bash
# Ignore all whitespace
git diff -w main feature-branch

# Ignore whitespace at line ends
git diff --ignore-space-at-eol main feature-branch

# Ignore whitespace changes
git diff --ignore-space-change main feature-branch
```

Useful when comparing code with different formatting.

## Showing Function Context

To see which functions were changed:

```bash
# Show function names in diff
git diff --function-context main feature-branch

# Or use -W
git diff -W main feature-branch
```

This shows the entire function that was modified, providing better context.

## Comparing Binary Files

For binary files, show which changed:

```bash
# Show that binary files differ
git diff --binary main feature-branch

# List binary files that changed
git diff --numstat main feature-branch | grep -E "^-.*-"
```

## Exporting Differences

To save differences to a file:

```bash
# Export to patch file
git diff main feature-branch > changes.patch

# Apply patch later
git apply changes.patch

# Export as formatted patch
git format-patch main..feature-branch
```

## Interactive Diff

For a more interactive comparison:

```bash
# Use difftool for visual diff
git difftool main feature-branch

# Configure difftool (one time setup)
git config --global diff.tool meld
git config --global difftool.prompt false
```

Popular diff tools: meld, kdiff3, vimdiff, Beyond Compare.

## Checking for Conflicts Before Merge

To see if branches will conflict:

```bash
# Try merge without committing
git merge --no-commit --no-ff feature-branch

# Check for conflicts
git status

# Abort the merge
git merge --abort
```

## Comparing Multiple Branches

To compare several branches:

```bash
# Show commits unique to each branch
git log --oneline --graph --all --decorate

# Compare branch A with B and C
git log --oneline branchA ^branchB ^branchC
```

## Practical Comparison Workflows

**Before merging feature branch:**

```bash
# See what will be merged
git diff --stat main feature-branch

# Review commits
git log --oneline main..feature-branch

# Check for conflicts
git diff main...feature-branch
```

**Comparing releases:**

```bash
# Changes between v1.0 and v2.0
git diff v1.0..v2.0 --stat

# List changed files
git diff --name-only v1.0 v2.0

# Detailed changes
git log v1.0..v2.0
```

**Syncing feature branch with main:**

```bash
# See what's new in main
git log feature-branch..main

# See what you'll lose if you rebase
git log main..feature-branch

# Check divergence
git log --graph --oneline main feature-branch
```

## Using Aliases for Common Comparisons

Create shortcuts for frequent comparisons:

```bash
# Add to ~/.gitconfig
[alias]
  compare = diff --stat
  cfiles = diff --name-only
  clog = log --oneline

# Use them
git compare main feature-branch
git cfiles main feature-branch
```

## Best Practices

Always fetch before comparing with remote:

```bash
# Update remote refs
git fetch --all

# Then compare
git diff origin/main feature-branch
```

Use the right comparison for your need:

```bash
# File changes: git diff
git diff main feature-branch

# Commit list: git log
git log main..feature-branch

# Just filenames: --name-only
git diff --name-only main feature-branch
```

Compare from the right perspective:

```bash
# What's in feature not in main
git diff main..feature-branch

# What's in main not in feature
git diff feature-branch..main
```

Check both directions before merging:

```bash
# What you're adding
git diff main..feature-branch

# What you're missing from main
git diff feature-branch..main
```

Now you know how to see differences between Git branches. Use `git diff` for file changes, `git log` for commits, and the appropriate flags for the level of detail you need. Understanding these comparisons helps you review changes before merging and understand branch relationships.
