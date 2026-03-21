---
title: 'How to Commit Only Part of a File in Git'
excerpt: 'Need to commit some changes in a file but not others? Learn how to stage and commit specific changes within a file using Git patch mode.'
category:
  name: 'Git'
  slug: 'git'
date: '2024-09-28'
publishedAt: '2024-09-28T14:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Commits
  - Version Control
  - Patch
  - Staging
---

You made multiple changes to a file but only want to commit some of them. Maybe you added a feature and fixed an unrelated bug in the same file. Git lets you select specific changes within a file to commit separately.

**TLDR:** To commit only part of a file, use `git add -p filename` to interactively choose which changes to stage. Git shows you each change (called a "hunk") and lets you select which ones to include. Then commit normally with `git commit`.

In this guide, you'll learn how to make surgical commits by staging only the changes you want.

## Prerequisites

You'll need Git installed on your system and a file with multiple distinct changes. Basic familiarity with Git staging and commits will help you follow along.

## Understanding Hunks

Git divides file changes into "hunks" - contiguous blocks of added, modified, or deleted lines:

```diff
File: app.js

Hunk 1:
+function authenticate(user) {
+  return validateToken(user.token);
+}

Hunk 2:
-console.log('Debug info');

Hunk 3:
+function getUserProfile(id) {
+  return database.findUser(id);
+}
```

Each hunk is a separate change you can stage independently.

## Interactive Staging with Patch Mode

To stage parts of a file interactively:

```bash
# Start interactive staging for a file
git add -p app.js

# Or use --patch (same thing)
git add --patch app.js
```

Git shows you each hunk and asks what to do:

```
diff --git a/app.js b/app.js
@@ -10,6 +10,9 @@ const app = express();

 app.use(express.json());

+// Authentication middleware
+app.use(authenticateUser);
+
 app.listen(3000);
Stage this hunk [y,n,q,a,d,s,e,?]?
```

## Patch Mode Commands

When Git shows a hunk, you have several options:

```
y - yes, stage this hunk
n - no, don't stage this hunk
q - quit, don't stage this or any remaining hunks
a - stage this hunk and all later hunks in the file
d - don't stage this hunk or any later hunks in the file
s - split the current hunk into smaller hunks
e - manually edit the current hunk
? - show help
```

The most commonly used are `y` (yes), `n` (no), and `s` (split).

## Basic Workflow Example

Here's a typical workflow for selective commits:

```bash
# You made two unrelated changes in app.js
git diff app.js

# Start patch mode
git add -p app.js

# First hunk: authentication feature
# Stage this hunk [y,n,q,a,d,s,e,?]? y

# Second hunk: debug logging removal
# Stage this hunk [y,n,q,a,d,s,e,?]? n

# Check what's staged
git diff --staged

# Commit only the authentication feature
git commit -m "Add user authentication middleware"

# Later, stage and commit the debug cleanup
git add -p app.js
# Stage this hunk [y,n,q,a,d,s,e,?]? y
git commit -m "Remove debug logging"
```

## Splitting Hunks

Sometimes Git groups related changes into one large hunk. Use `s` to split it:

```bash
git add -p app.js

# Git shows a large hunk
# Stage this hunk [y,n,q,a,d,s,e,?]? s

# Split into 2 hunks.
# @@ -10,3 +10,6 @@
# +function auth() { }
# Stage this hunk [y,n,q,a,d,/,j,J,g,e,?]? y

# @@ -15,2 +18,4 @@
# +function profile() { }
# Stage this hunk [y,n,q,a,d,/,K,g,e,?]? n
```

Splitting gives you finer control over what to stage.

## Manually Editing Hunks

For maximum control, manually edit the hunk:

```bash
git add -p app.js

# Stage this hunk [y,n,q,a,d,s,e,?]? e
```

Git opens your editor with the hunk:

```diff
# Manual hunk edit mode -- see bottom for a quick guide.
@@ -10,6 +10,12 @@ const app = express();

 app.use(express.json());

+// Authentication middleware
+app.use(authenticateUser);
+
+// Debug logging
+console.log('Server starting');
+
 app.listen(3000);
# ---
# To remove '-' lines, make them ' ' lines (context).
# To remove '+' lines, delete them.
# Lines starting with # will be removed.
```

To stage only the authentication lines:

```diff
@@ -10,6 +10,9 @@ const app = express();

 app.use(express.json());

+// Authentication middleware
+app.use(authenticateUser);
+
 app.listen(3000);
```

Delete the debug logging lines and save. Git stages only what remains.

## Staging Multiple Files Selectively

To use patch mode for all modified files:

```bash
# Interactive staging for all files
git add -p

# Git shows hunks from each modified file
# Stage changes file by file, hunk by hunk
```

This lets you create focused commits across multiple files.

## Viewing What's Staged vs Not Staged

After selective staging, check what you staged:

```bash
# Show staged changes
git diff --staged

# Show unstaged changes
git diff

# Show both in status
git status
```

This helps verify you staged exactly what you intended.

## Committing Parts of New Files

For new untracked files, Git treats the entire file as one hunk:

```bash
# Add new file interactively
git add -N newfile.js  # Mark as tracked
git add -p newfile.js   # Then stage parts

# Or skip the -N step
git add -p newfile.js
# Will prompt: "Stage addition [y,n,q,a,d,?]?"
```

You can then split or edit the hunk to stage only parts of the new file.

## Using git reset --patch

To unstage parts of already-staged changes:

```bash
# Stage everything
git add app.js

# Oops, change your mind about some changes
git reset -p app.js

# Git shows staged hunks
# Unstage this hunk [y,n,q,a,d,?]? y
```

This is the reverse of `git add -p` - it removes hunks from staging.

## Using git checkout --patch

To discard parts of uncommitted changes:

```bash
# Discard specific changes interactively
git checkout -p app.js

# Discard this hunk [y,n,q,a,d,?]? y

# Or use restore in modern Git
git restore -p app.js
```

**Warning:** This permanently discards the selected changes.

## Creating Multiple Commits from One File

A common workflow is creating separate commits for different logical changes:

```bash
# File has 3 types of changes: feature, bugfix, refactor

# Commit 1: Stage and commit feature
git add -p app.js  # Select only feature hunks
git commit -m "Add user profile feature"

# Commit 2: Stage and commit bugfix
git add -p app.js  # Select only bugfix hunks
git commit -m "Fix authentication token validation"

# Commit 3: Stage and commit refactor
git add -p app.js  # Select remaining hunks
git commit -m "Refactor database queries"
```

Each commit focuses on one logical change, making history clearer.

## Working with git commit --patch

Combine adding and committing in one step:

```bash
# Stage and commit interactively
git commit -p

# Or for a specific file
git commit -p app.js
```

This opens patch mode, then immediately commits what you staged.

## Handling Complex Changes

For very complex files with many changes:

```bash
# First, stage the obvious parts
git add -p app.js
# Stage simple hunks with 'y' and 'n'

# Check what remains
git diff app.js

# Use an editor to manually craft commits
git add -e app.js
# Or
git add --edit app.js
```

The edit mode shows all changes and lets you manually remove lines you do not want to stage.

## Best Practices for Partial Commits

**Organize changes logically:**

```bash
# Good: Separate concerns
# Commit 1: Add feature
# Commit 2: Fix bug
# Commit 3: Update docs

# Less ideal: Mix everything
# Commit 1: Add feature, fix bug, update docs
```

**Use descriptive commit messages:**

```bash
# Good commit message for partial commit
git commit -m "Add email validation to registration form"

# Not helpful
git commit -m "Update app.js"
```

**Review before committing:**

```bash
# Always check what you're about to commit
git diff --staged
git status
```

**Keep unstaged changes minimal:**

```bash
# If too many changes pile up unstaged
git stash          # Save everything
git stash pop      # Restore everything
git add -p         # Now stage carefully
```

## Common Pitfalls

**Hunk too large to split:**

If Git cannot split a hunk automatically:

```bash
# Use manual edit mode
git add -p app.js
# Stage this hunk [y,n,q,a,d,s,e,?]? e

# Manually remove lines you don't want
```

**Accidentally staging the wrong hunk:**

```bash
# Unstage it
git reset -p app.js
```

**Losing track of unstaged changes:**

```bash
# Create a stash of unstaged changes
git stash -k  # Keep staged changes
git commit
git stash pop  # Restore unstaged changes
```

## Alternatives to Patch Mode

**GUI tools** often make partial staging easier:

- **VS Code** - Click specific lines to stage
- **GitKraken** - Drag hunks between panels
- **SourceTree** - Check boxes next to changes
- **Git Extensions** - Visual hunk selection

Command-line tools:

```bash
# Use tig for interactive staging
tig status
# Then press 'u' on hunks to stage

# Use lazygit
lazygit
# Navigate and select hunks visually
```

Now you know how to commit only part of a file in Git. The `git add -p` command gives you fine-grained control over what goes into each commit, helping you create clean, focused commits even when changes are mixed together in your files.
