---
title: 'How to Discard Unstaged Changes in Git'
excerpt: 'Learn different methods to discard unstaged changes in Git using checkout, restore, and clean commands. Learn selective and bulk change removal techniques.'
category:
  name: 'Git'
  slug: 'git'
date: '2024-12-07'
publishedAt: '2024-12-07T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Version Control
  - Working Directory
  - Development
  - File Management
---

You've been experimenting with code changes, but they didn't work out as planned, or you want to start fresh from your last commit. Git provides several commands to discard unstaged changes and return your working directory to a clean state.

In this guide, you'll learn different methods to discard unstaged changes, from individual files to entire directory trees.

## Prerequisites

You need Git installed on your system and basic knowledge of Git's working directory and staging area concepts. You should be working in a Git repository with some unstaged changes to practice these operations.

## Understanding Unstaged Changes

Unstaged changes are modifications in your working directory that haven't been added to Git's staging area. These include:

- Modified tracked files
- New untracked files
- Deleted files

Git treats each type differently when discarding changes.

## Discarding Changes in Tracked Files

### Using git checkout (Traditional Method)

The traditional way to discard changes in tracked files:

```bash
# Discard changes in a specific file
git checkout -- filename.js

# Discard changes in multiple files
git checkout -- file1.js file2.css file3.html

# Discard all changes in tracked files
git checkout -- .

# Discard changes in a specific directory
git checkout -- src/components/
```

The `--` separator ensures Git treats the following arguments as file paths, not branch names.

### Using git restore (Modern Method)

Git 2.23 introduced `git restore` as a more intuitive replacement:

```bash
# Restore a specific file to its committed state
git restore filename.js

# Restore multiple files
git restore file1.js file2.css

# Restore all modified files
git restore .

# Restore files in a specific directory
git restore src/components/
```

The `git restore` command is clearer in its intent compared to `git checkout`.

## Checking What Will Be Discarded

Before discarding changes, review what you're about to lose:

```bash
# See all unstaged changes
git status

# View detailed changes in modified files
git diff

# See changes in a specific file
git diff filename.js

# Show names of modified files only
git diff --name-only
```

Always review your changes before discarding them, as this operation cannot be undone.

## Discarding Specific Types of Changes

### Modified Files Only

To discard only modifications while keeping new files:

```bash
# Using git restore
git restore .

# Using git checkout
git checkout -- .

# These commands only affect tracked files, leaving untracked files untouched
```

### New Untracked Files

To remove untracked files, use `git clean`:

```bash
# Preview what files will be deleted (dry run)
git clean -n

# Remove untracked files
git clean -f

# Remove untracked files and directories
git clean -fd

# Remove untracked files including ignored files
git clean -fx
```

**Warning**: `git clean` permanently deletes files. Always use `-n` first to preview.

### Deleted Files

To restore deleted files:

```bash
# Restore a deleted file
git restore deleted-file.js

# Restore all deleted files
git restore .

# Check which files were deleted
git status | grep deleted
```

## Interactive and Selective Discarding

### Interactive File Selection

For precise control over which changes to discard:

```bash
# Interactively select changes to discard
git restore -p filename.js

# This allows you to review each change and decide:
# y - discard this change
# n - keep this change
# q - quit and keep remaining changes
# s - split change into smaller parts
```

### Discarding Specific Lines

Using interactive mode, you can discard individual changes within files:

```bash
# Start interactive restore for multiple files
git restore -p .

# Review each change and choose what to discard
# This is useful when you have both good and bad changes in the same file
```

## Handling Different File States

### Mixed Changes (Staged and Unstaged)

When files have both staged and unstaged changes:

```bash
# Check file states
git status

# Output might show:
# modified:   src/app.js  (staged changes)
# modified:   src/app.js  (unstaged changes)

# Discard only unstaged changes
git restore src/app.js

# The staged changes remain ready for commit
```

### Dealing with File Conflicts

If you have merge conflicts that you want to abandon:

```bash
# Discard conflict resolution attempts
git restore --conflict=merge filename.js

# Or start over by restoring to HEAD state
git restore --source=HEAD filename.js
```

## Bulk Operations

### Discarding All Unstaged Changes

Clean slate approach - discard everything unstaged:

```bash
# Discard all unstaged changes in tracked files
git restore .

# Remove all untracked files and directories
git clean -fd

# Verify clean state
git status
# Should show: "nothing to commit, working tree clean"
```

### Pattern-Based Discarding

Discard changes matching specific patterns:

```bash
# Discard changes in all JavaScript files
git restore "*.js"

# Discard changes in all files in src directory
git restore "src/**"

# Discard changes in test files
git restore "*test*"
```

### Directory-Specific Operations

Work with specific directories:

```bash
# Discard changes in specific directory
git restore src/components/

# Remove untracked files in specific directory
git clean -fd src/temp/

# Restore deleted directory
git restore deleted-directory/
```

## Advanced Scenarios

### Restoring from Specific Commits

Sometimes you want to discard changes by reverting to a specific commit state:

```bash
# Restore file to state from specific commit
git restore --source=HEAD~2 filename.js

# Restore file to state from specific commit hash
git restore --source=a1b2c3d filename.js

# Restore multiple files from specific commit
git restore --source=HEAD~1 src/
```

### Selective Restoration

Restore specific parts of files from different commits:

```bash
# Interactively restore from a specific commit
git restore --source=HEAD~1 -p filename.js

# This allows you to selectively take parts of the file from that commit
```

## Safety and Recovery

### Creating Backups Before Discarding

For important changes you might want to recover later:

```bash
# Create a patch file of your changes
git diff > my-changes.patch

# Or stash changes instead of discarding
git stash push -m "Backup before discarding other changes"

# Then discard what you don't want
git restore problematic-file.js

# Apply stash later if needed
git stash pop
```

### Viewing Discarded Changes

Unfortunately, once changes are discarded with `restore` or `checkout`, they're gone. However, you can:

```bash
# Check reflog for any commits that might contain the changes
git reflog

# If you had committed the changes at some point, you might find them there
```

## Best Practices

### Review Before Discarding

Always check what you're about to lose:

```bash
# Good workflow:
git status          # See what's modified
git diff            # Review all changes
git diff filename.js # Review specific file changes
git restore filename.js # Then discard
```

### Use Selective Operations

Instead of discarding everything, be selective:

```bash
# Instead of git restore .
# Discard files individually
git restore problematic-file.js
git restore another-bad-file.css

# Keep files with good changes
```

### Combine with Stashing

Use stashing for temporary storage:

```bash
# Stash good changes
git add good-changes.js
git stash push --staged -m "Good changes to keep"

# Discard everything else
git restore .

# Apply good changes back
git stash pop
```

## Common Workflows

### Quick Clean Reset

When you want to start completely fresh:

```bash
# Complete reset to last commit state
git restore .           # Discard modified files
git clean -fd          # Remove untracked files
git status             # Verify clean state
```

### Selective Cleanup

When you want to keep some changes:

```bash
# Review changes
git status
git diff

# Keep good files by staging them
git add good-file1.js good-file2.css

# Discard everything else
git restore .

# Your good changes are still staged
git status
```

Now you understand how to effectively discard unstaged changes in Git. These techniques help you maintain a clean working directory and recover from experimental changes that didn't work out as planned.
