---
title: 'Difference Between git add -A and git add . in Git'
excerpt: 'Confused about when to use git add -A versus git add dot? Learn the key differences and when to use each command for staging files.'
category:
  name: 'Git'
  slug: 'git'
date: '2025-04-18'
publishedAt: '2025-04-18T11:30:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Staging
  - Version Control
  - Commands
  - Workflow
---

You need to stage files for commit and wonder whether to use `git add -A` or `git add .`. Both commands stage changes, but they behave differently depending on where you run them and which types of changes you want to include.

**TLDR:** In modern Git (2.x), `git add -A` and `git add .` behave identically when run from the repository root - both stage all changes including new, modified, and deleted files. The difference matters when run from subdirectories: `git add .` only stages changes in the current directory and below, while `git add -A` stages changes throughout the entire repository.

In this guide, you'll learn the differences between these staging commands and when to use each one.

## Prerequisites

You'll need Git installed on your system (version 2.0 or later) and a repository with various types of changes. Basic familiarity with Git staging will help you understand the examples.

## Understanding File States

Git tracks files in several states:

```
Untracked (new file) → Tracked
Modified            → Staged
Deleted             → Staged for deletion
```

Different `git add` commands handle these states differently.

## Modern Git (Version 2.x) Behavior

In Git 2.x, when run from the repository root:

```bash
# These are now equivalent at repository root
git add -A
git add .
git add --all
```

All three stage:
- New files (untracked)
- Modified files
- Deleted files

Throughout the entire repository.

## Legacy Git (Version 1.x) Behavior

In older Git versions, there were important differences:

```bash
# Git 1.x from repository root:

# git add -A
# - Stages new files
# - Stages modified files
# - Stages deleted files

# git add .
# - Stages new files
# - Stages modified files
# - Does NOT stage deleted files
```

If you're on Git 1.x (check with `git --version`), upgrade to Git 2.x for consistent behavior.

## Behavior in Subdirectories

The real difference emerges when you run commands from subdirectories:

```bash
# Repository structure:
# root/
#   src/
#     app.js (modified)
#     new.js (new file)
#   tests/
#     test.js (modified)
#   old.js (deleted)

cd src

# git add .
# Stages: src/app.js, src/new.js
# Ignores: tests/test.js, old.js (outside current directory)

# git add -A
# Stages: src/app.js, src/new.js, tests/test.js, old.js
# (stages everything in repository)
```

From a subdirectory:
- `git add .` stages changes in current directory and subdirectories only
- `git add -A` stages all changes throughout the entire repository

## Comparing All Variations

Here are all the `git add` variants:

```bash
# Stage all changes in entire repository
git add -A
git add --all

# Stage all changes from current directory down
git add .

# Stage only modified and deleted files (not new files)
git add -u
git add --update

# Stage specific files
git add file1.js file2.js

# Stage by pattern
git add *.js
git add src/**/*.js
```

## Practical Example: Root Directory

From repository root with these changes:

```bash
# Changes:
# M  src/app.js      (modified)
# A  src/new.js      (new)
# D  old.js          (deleted)
# M  README.md       (modified)

# git add . (from root)
git add .
# Stages: src/app.js, src/new.js, README.md, old.js deletion
# Result: All changes staged

# git add -A (from root)
git add -A
# Stages: src/app.js, src/new.js, README.md, old.js deletion
# Result: All changes staged (same as git add .)
```

## Practical Example: Subdirectory

From a subdirectory with the same changes:

```bash
cd src

# git add . (from subdirectory)
git add .
# Stages: src/app.js, src/new.js
# Ignores: README.md, old.js

# git add -A (from subdirectory)
git add -A
# Stages: src/app.js, src/new.js, README.md, old.js deletion
# Result: All changes in repository
```

## When to Use Each Command

**Use `git add -A` when:**
- You want to stage all changes in the entire repository
- You're in a subdirectory but want to stage everything
- You want consistent behavior regardless of where you are

**Use `git add .` when:**
- You only want to stage changes in the current directory tree
- You're working on a specific module or feature in one directory
- You want to avoid staging changes outside your current focus

**Use `git add -u` when:**
- You only want to stage modified and deleted files
- You deliberately want to skip new files
- You're cleaning up existing code without adding new files

## Visualizing the Differences

```
Repository structure:
root/
├── src/
│   ├── app.js (M)
│   └── new.js (A)
├── tests/
│   └── test.js (M)
└── README.md (M)

From root directory:
├── git add .   → Stages all (M, A)
├── git add -A  → Stages all (M, A)
└── git add -u  → Stages only (M) - skips new.js

From src/ directory:
├── git add .   → Stages src/* only
├── git add -A  → Stages all in repo
└── git add -u  → Stages only src/app.js
```

## Checking What Will Be Staged

Before running `git add`, check what will be staged:

```bash
# See all unstaged changes
git status

# See what git add . would stage
git status .

# See what git add -A would stage
git status

# Dry run (Git doesn't have this, but you can use status)
git status --short
```

## Staging Workflow Recommendations

For most workflows from repository root:

```bash
# Simple: Stage everything
git add -A
git commit -m "Your message"

# Selective: Review then stage
git status
git add specific-file.js
git commit -m "Your message"

# Interactive: Choose what to stage
git add -p
git commit -m "Your message"
```

When working in a subdirectory:

```bash
# Stage only local changes
git add .

# Stage everything in repository
git add -A

# Go to root first
cd $(git rev-parse --show-toplevel)
git add .
```

## Common Pitfalls

**Accidentally staging unrelated changes:**

```bash
# You're in src/ directory
git add -A  # Oops, staged everything in repo

# Fix: Unstage
git reset

# Better: Stage locally
git add .
```

**Missing deleted files:**

```bash
# Old Git behavior
git add .  # Might not stage deletions

# Modern fix
git add -A  # Stages deletions too
```

**Staging from wrong directory:**

```bash
# You're in src/ but want to stage tests/
git add .  # Only stages src/

# Fix: Specify path
git add ../tests

# Or go to root
git add -A
```

## Using Aliases

Create aliases for common patterns:

```bash
# Add to ~/.gitconfig
[alias]
  aa = add -A
  ap = add -p
  au = add -u
```

Use them:

```bash
git aa  # Stage all changes
git ap  # Interactive staging
git au  # Stage modified/deleted only
```

## Modern Best Practices

For most users with Git 2.x:

```bash
# At repository root, these are equivalent:
git add -A  # Explicit and clear
git add .   # Common and works well

# Choose one and be consistent in your team
```

In subdirectories, be explicit:

```bash
# Clear intent: Stage everything
git add -A

# Clear intent: Stage this directory only
git add .

# Clear intent: Go to root first
cd "$(git rev-parse --show-toplevel)"
git add .
```

## Verifying What Was Staged

After staging, verify:

```bash
# See staged changes
git status

# See diff of staged changes
git diff --staged

# See staged file names only
git diff --staged --name-only
```

## Unstaging Files

If you staged the wrong files:

```bash
# Unstage everything
git reset

# Unstage specific file
git reset HEAD file.js

# Unstage everything in directory
git reset HEAD directory/
```

## Special Cases

**With .gitignore:**

All staging commands respect `.gitignore`:

```bash
# Even with git add -A
git add -A  # Won't stage ignored files
```

**With sparse-checkout:**

In sparse-checkout mode, `git add` only affects checked-out paths.

**In worktrees:**

Each worktree has independent staging. `git add` only affects the current worktree.

Now you know the differences between `git add -A` and `git add .`. In modern Git from the repository root, they're equivalent. The key difference is in subdirectories: `git add .` stages only the current directory tree, while `git add -A` stages all changes throughout the repository. Choose based on whether you want repository-wide or localized staging.
