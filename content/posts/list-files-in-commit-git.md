---
title: 'How to List All Files in a Git Commit'
excerpt: 'Need to see which files were changed in a commit? Learn how to list all files modified, added, or deleted in any Git commit using log and show commands.'
category:
  name: 'Git'
  slug: 'git'
date: '2025-02-14'
publishedAt: '2025-02-14T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Commits
  - Version Control
  - Log
  - History
---

When reviewing commits or investigating changes, you often need to see which files were affected. Git provides several commands to list files in a commit, from simple lists to detailed change information.

**TLDR:** To list files in a commit, use `git show --name-only commit-hash` for just filenames, `git show --stat commit-hash` for a summary with line counts, or `git diff-tree --no-commit-id --name-only -r commit-hash` for a clean list. Replace `commit-hash` with the actual commit hash or use `HEAD` for the most recent commit.

In this guide, you'll learn different ways to view files changed in Git commits.

## Prerequisites

You'll need Git installed on your system and a repository with commit history. Basic familiarity with Git commands like log and show will be helpful.

## Listing Files in the Most Recent Commit

To see files in the last commit:

```bash
# Show files in HEAD (most recent commit)
git show --name-only HEAD

# Or just file names without commit message
git diff-tree --no-commit-id --name-only -r HEAD
```

Output shows filenames:

```
src/app.js
src/auth.js
tests/auth.test.js
README.md
```

## Listing Files in a Specific Commit

Use the commit hash to view files in any commit:

```bash
# Show files in specific commit
git show --name-only abc123

# Full hash also works
git show --name-only abc123def456789
```

Replace `abc123` with your actual commit hash. You can find commit hashes with `git log --oneline`.

## Showing File Changes with Statistics

To see not just filenames but how much changed:

```bash
# Show file stats
git show --stat abc123
```

Output includes change counts:

```
commit abc123def456789
Author: Jane Developer <jane@example.com>
Date:   Mon Jan 15 14:30:00 2024

    Add user authentication

 src/app.js         | 25 +++++++++++++++++++------
 src/auth.js        | 45 ++++++++++++++++++++++++++++++++++++++++++++
 tests/auth.test.js | 32 ++++++++++++++++++++++++++++++++
 README.md          |  8 ++++++--
 4 files changed, 102 insertions(+), 12 deletions(-)
```

The numbers show lines added and removed in each file.

## Different Output Formats

Git offers several format options:

```bash
# Just filenames (cleanest)
git show --name-only abc123

# Filenames with status (M=modified, A=added, D=deleted)
git show --name-status abc123

# One-line stats
git show --stat --oneline abc123

# Compact stat format
git show --shortstat abc123
```

Choose the format that shows the information you need.

## Understanding File Status Indicators

When using `--name-status`, Git shows letter codes:

```bash
git show --name-status abc123

# Output:
# M    src/app.js        (Modified)
# A    src/auth.js       (Added)
# D    old/legacy.js     (Deleted)
# R100 old.txt new.txt   (Renamed)
# C    original.js copy.js (Copied)
```

Status codes:
- `M` - Modified
- `A` - Added
- `D` - Deleted
- `R` - Renamed
- `C` - Copied

## Listing Files Without Commit Message

To get just the file list without commit metadata:

```bash
# Clean file list
git diff-tree --no-commit-id --name-only -r abc123

# Output:
# src/app.js
# src/auth.js
# tests/auth.test.js
```

This is useful for scripting or piping to other commands.

## Listing Files in Multiple Commits

To see files across a range of commits:

```bash
# Files in last 3 commits
git log --name-only -3

# Files between two commits
git log --name-only abc123..def456

# Files in all commits from author
git log --name-only --author="Jane"
```

## Filtering by File Type

To show only certain types of files:

```bash
# All JavaScript files in commit
git show --name-only abc123 | grep '.js$'

# All files in src directory
git show --name-only abc123 | grep '^src/'

# Using git log with path filtering
git log --name-only abc123 -- '*.js'
```

## Counting Files in a Commit

To see how many files were changed:

```bash
# Count files in commit
git show --name-only abc123 | tail -n +2 | wc -l

# Or use numstat for detailed counts
git show --numstat abc123
```

## Listing Files with Change Details

For detailed information about each file:

```bash
# Show actual changes in files
git show abc123

# Show diff with file stats
git show --stat -p abc123

# Compact diff
git show --compact-summary abc123
```

The `-p` flag shows the actual line-by-line changes (patches).

## Comparing Files Between Commits

To see which files changed between two commits:

```bash
# Files that changed between commits
git diff --name-only abc123 def456

# With status indicators
git diff --name-status abc123 def456

# With stats
git diff --stat abc123 def456
```

## Listing Files in Merge Commits

Merge commits can show files from multiple parents:

```bash
# Show files in merge commit
git show --name-only abc123

# Show first parent changes only
git show --first-parent --name-only abc123

# Show what was actually merged
git diff --name-only abc123^ abc123
```

## Using Shorthand References

Instead of commit hashes, use relative references:

```bash
# Most recent commit
git show --name-only HEAD

# Second most recent
git show --name-only HEAD~1

# Third most recent
git show --name-only HEAD~2

# Parent of HEAD
git show --name-only HEAD^
```

## Listing Files by Branch

To see files in the last commit of a branch:

```bash
# Files in branch tip
git show --name-only feature-auth

# Files in origin/main
git show --name-only origin/main
```

## Formatting for Scripts

For use in scripts or automation:

```bash
# Get array of filenames in bash
files=($(git diff-tree --no-commit-id --name-only -r HEAD))

# Iterate over files
for file in "${files[@]}"; do
  echo "Processing $file"
done

# Or with while loop
git diff-tree --no-commit-id --name-only -r HEAD | while read file; do
  echo "File: $file"
done
```

## Showing Only Specific File Types

To list only added or modified files:

```bash
# Only added files
git show --name-status abc123 | grep '^A'

# Only modified files
git show --name-status abc123 | grep '^M'

# Only deleted files
git show --name-status abc123 | grep '^D'
```

## Getting Detailed File Info

For comprehensive file information:

```bash
# Detailed changes with context
git show --stat --summary abc123

# Machine-readable format
git show --pretty=format:"%H" --name-only abc123

# Custom format
git show --format="" --name-only abc123
```

## Listing Files in Stash

To see files in a stash:

```bash
# Files in most recent stash
git stash show --name-only

# Files in specific stash
git stash show --name-only stash@{1}

# With stats
git stash show --stat stash@{0}
```

## Finding Which Commit Changed a File

To find commits that modified a specific file:

```bash
# Commits that changed file
git log --oneline -- path/to/file

# With file change stats
git log --stat -- path/to/file

# List files changed in each commit
git log --name-only -- path/to/file
```

## Practical Examples

**Review what changed in last commit:**

```bash
git show --stat HEAD
```

**Find files modified in a pull request:**

```bash
# Files between branches
git diff --name-only main..feature-branch
```

**List all JavaScript files changed recently:**

```bash
git log --name-only --since="1 week ago" -- '*.js'
```

**Check which config files were modified:**

```bash
git show --name-only abc123 | grep config
```

**Generate a list for deployment:**

```bash
git diff-tree --no-commit-id --name-only -r abc123 > changed-files.txt
```

## Using Aliases for Common Tasks

Create aliases for frequently used commands:

```bash
# Add to ~/.gitconfig
[alias]
  files = show --name-only
  changed = diff --name-only
  stats = show --stat
```

Use them:

```bash
git files HEAD
git changed main..feature
git stats abc123
```

## Best Practices

Use appropriate detail level:

```bash
# Quick check: Just names
git show --name-only HEAD

# More info: Stats
git show --stat HEAD

# Full details: Complete diff
git show HEAD
```

Check before destructive operations:

```bash
# Before cherry-pick, see what files will change
git show --name-only abc123

# Then cherry-pick
git cherry-pick abc123
```

Document significant commits:

```bash
# Add file list to commit message
git log --name-only abc123 >> CHANGELOG.md
```

Now you know how to list files in Git commits. The `git show --name-only` and `git diff-tree` commands give you flexible ways to view which files were affected by any commit, helping you understand changes and review history effectively.
