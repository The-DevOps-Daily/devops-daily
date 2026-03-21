---
title: 'How to Stash Only One File in Git'
excerpt: 'Need to temporarily save changes to just one file? Learn how to stash a single file in Git while leaving other changes in your working directory.'
category:
  name: 'Git'
  slug: 'git'
date: '2024-10-12'
publishedAt: '2024-10-12T09:30:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Stash
  - Version Control
  - Workflow
  - File Management
---

You have changes to multiple files but only want to temporarily save changes to one specific file. Maybe you need to test something without those changes, or switch branches while keeping other work in progress.

**TLDR:** To stash only one file, use `git stash push -m "message" path/to/file`. This saves changes to the specified file while leaving other modified files in your working directory. To stash multiple specific files, list them all: `git stash push file1 file2 file3`.

In this guide, you'll learn how to selectively stash files in Git.

## Prerequisites

You'll need Git installed on your system (version 2.13 or later for `git stash push`) and a repository with multiple modified files. Basic familiarity with Git stash will be helpful.

## Understanding Git Stash

Git stash temporarily saves your changes and reverts your working directory to match the HEAD commit:

```
Working Directory (modified) → Stash (saved) → Working Directory (clean)
```

By default, `git stash` saves all changes. To stash selectively, use `git stash push` with specific file paths.

## Stashing a Single File

To stash changes to one specific file:

```bash
# Check what files are modified
git status
# modified: app.js
# modified: styles.css
# modified: README.md

# Stash only app.js
git stash push -m "Save app.js changes" app.js

# Check status after stashing
git status
# modified: styles.css
# modified: README.md
```

The changes to `app.js` are now saved in the stash, while `styles.css` and `README.md` remain modified in your working directory.

## Stashing Multiple Specific Files

To stash several files but not all:

```bash
# Stash multiple files
git stash push -m "Save auth and config changes" src/auth.js config/database.js

# Or use wildcards
git stash push -m "Save all JS files" src/*.js
```

List each file you want to stash separated by spaces.

## Stashing with Pathspec Patterns

You can use Git pathspec patterns to match multiple files:

```bash
# Stash all files in a directory
git stash push -m "Save components" src/components/

# Stash all JavaScript files
git stash push -m "Save JS changes" "*.js"

# Stash files in multiple directories
git stash push -m "Save source and tests" src/ tests/
```

Pathspec patterns give you flexible control over which files to stash.

## Viewing Stashed Changes

To see what you stashed:

```bash
# List all stashes
git stash list
# stash@{0}: On main: Save app.js changes
# stash@{1}: On feature: Save auth changes

# Show what's in a specific stash
git stash show stash@{0}

# Show the full diff
git stash show -p stash@{0}
```

The stash list shows all your stashes with their messages and branch information.

## Restoring a Stashed File

To bring back the stashed changes:

```bash
# Apply the most recent stash
git stash pop

# Apply a specific stash
git stash apply stash@{0}

# Apply and keep the stash
git stash apply stash@{0}  # Keeps the stash
git stash pop stash@{0}     # Removes the stash after applying
```

Using `pop` removes the stash after applying it. Using `apply` keeps it in the stash list.

## Stashing Staged vs Unstaged Changes

By default, `git stash push` stashes both staged and unstaged changes:

```bash
# File is staged
git add app.js
git status
# Changes to be committed:
#   modified: app.js

# Stash includes staged changes
git stash push -m "Save staged app.js" app.js

# File is no longer staged or modified
git status
# nothing to commit, working tree clean
```

To keep staging information:

```bash
# Stash while preserving the index (staging area)
git stash push --keep-index -m "Save but keep staged" app.js
```

## Stashing Untracked Files

Regular stash does not save untracked files (new files not added to Git). To include them:

```bash
# Check for untracked files
git status
# Untracked files:
#   new-feature.js

# Stash including untracked files
git stash push -u -m "Save with untracked" new-feature.js

# Or use --include-untracked
git stash push --include-untracked -m "Save with untracked" new-feature.js
```

The `-u` flag tells Git to include untracked files in the stash.

## Stashing Everything Except One File

To stash all changes except a specific file:

```bash
# Method 1: Stash all, then restore one file
git stash push -m "Save everything"
git checkout stash@{0} -- app.js

# Method 2: Stage the file you want to keep, then stash
git add app.js
git stash push --keep-index -m "Save except app.js"
git reset HEAD app.js  # Unstage if needed
```

The second method is cleaner - it stages the file you want to keep, stashes everything else, then unstages the file.

## Creating Multiple Stashes for Different Files

You can create separate stashes for different files:

```bash
# Stash authentication changes
git stash push -m "Auth module work in progress" src/auth.js

# Stash database changes
git stash push -m "Database refactoring" src/database.js

# List stashes
git stash list
# stash@{0}: On main: Database refactoring
# stash@{1}: On main: Auth module work in progress
```

Each stash is independent and can be applied separately.

## Applying Specific Files from a Stash

To restore only certain files from a stash:

```bash
# Apply only app.js from a stash
git checkout stash@{0} -- app.js

# Apply multiple specific files
git checkout stash@{0} -- app.js styles.css
```

This lets you selectively restore files without applying the entire stash.

## Using Stash for Quick Context Switching

Stashing single files is useful when you need to switch context:

```bash
# Scenario: Working on a feature, need to make a quick fix

# Stash feature work
git stash push -m "Feature work" src/feature.js

# Make the fix on clean working directory
git checkout hotfix-branch
# ... make fixes ...
git commit -m "Fix critical bug"

# Return to feature work
git checkout feature-branch
git stash pop
```

Your feature work is safely stored while you handle the urgent issue.

## Stash Workflow for Code Reviews

When reviewing code, stash your work to test the review branch:

```bash
# Save your current work
git stash push -m "My changes before review" src/

# Switch to review branch
git checkout feature-to-review

# Review and test
# ...

# Switch back and restore your work
git checkout your-branch
git stash pop
```

## Cleaning Up Stashes

To remove stashes you no longer need:

```bash
# Remove a specific stash
git stash drop stash@{0}

# Remove the most recent stash
git stash drop

# Remove all stashes
git stash clear
```

Regularly clean up stashes to keep your stash list manageable.

## Stashing with Interactive Mode

For fine-grained control over what to stash:

```bash
# Interactively choose what to stash
git stash push -p

# Git asks about each change:
# Stash this hunk [y,n,q,a,d,e,?]?
# y - yes, stash this hunk
# n - no, don't stash
# q - quit
# a - stash this and all remaining hunks
# d - don't stash this or remaining hunks
# e - manually edit the hunk
```

This lets you stash specific changes within a file, not just entire files.

## Handling Stash Conflicts

When applying a stash conflicts with current changes:

```bash
# Try to apply stash
git stash pop
# CONFLICT (content): Merge conflict in app.js

# Resolve the conflict
nano app.js  # Edit to resolve

# Stage the resolved file
git add app.js

# Drop the stash (it's been applied)
git stash drop
```

Conflicts occur when both the stash and current changes modified the same lines.

## Stash Best Practices

Always use descriptive messages:

```bash
# Good: Descriptive message
git stash push -m "API endpoint refactoring in progress" src/api.js

# Less helpful: Vague message
git stash push -m "temp" src/api.js
```

Stash before pulling or rebasing:

```bash
# Stash before updating branch
git stash push -m "Work in progress"
git pull origin main
git stash pop
```

Create stashes for different types of work:

```bash
# Separate stashes for different concerns
git stash push -m "Experimental feature" src/experiment.js
git stash push -m "Debug logging" src/logger.js
```

Review stashes regularly:

```bash
# Check what stashes you have
git stash list

# Clean up old stashes
git stash clear  # When all stashes are resolved
```

## Alternative: Using Worktrees

For more complex scenarios, consider Git worktrees:

```bash
# Create a worktree for parallel work
git worktree add ../project-hotfix main

# Work in the hotfix directory
cd ../project-hotfix
# Make changes

# Your original directory still has your uncommitted work
cd ../project
```

Worktrees create separate working directories, avoiding the need to stash.

Now you know how to stash individual files in Git. The `git stash push` command with specific file paths gives you precise control over what to save temporarily, letting you manage multiple parallel tasks without committing incomplete work.
