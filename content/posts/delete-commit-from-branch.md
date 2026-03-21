---
title: 'How to Delete a Commit from a Git Branch'
excerpt: 'Need to remove a specific commit from your Git branch? Learn how to delete commits using reset, rebase, and revert while preserving your repository history.'
category:
  name: 'Git'
  slug: 'git'
date: '2025-03-10'
publishedAt: '2025-03-10T09:30:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Version Control
  - Commit History
  - Rebase
  - Development
---

You've made a commit that needs to be removed from your branch. Maybe it contains sensitive information, introduces a bug, or simply does not belong in the history. Git provides several ways to delete commits depending on your situation.

**TLDR:** To delete the most recent commit, use `git reset --hard HEAD~1`. To delete a specific commit from history, use `git rebase -i HEAD~n` (where n is the number of commits to go back), then mark the commit as "drop". If the commit is already pushed and shared, use `git revert <commit-hash>` instead to safely undo it.

In this guide, you'll learn different methods to delete commits and when to use each approach.

## Prerequisites

You'll need Git installed on your system and a repository with commits you want to remove. Understanding basic Git concepts like commits, branches, and the staging area will help you follow along safely.

## Understanding the Impact of Deleting Commits

Before deleting commits, you need to understand the implications. If you've already pushed the commit to a shared repository, deleting it rewrites history and can cause problems for other developers.

The decision tree looks like this:

```
Has the commit been pushed?
  |
  ├─ No: Safe to use reset or interactive rebase
  |
  └─ Yes: Use revert to create a new commit that undoes changes
```

Rewriting history on commits that others have pulled forces them to deal with conflicts and diverged histories. Always prefer methods that do not rewrite history when working with shared branches.

## Deleting the Most Recent Commit

To remove the last commit from your branch, use `git reset`:

```bash
# Remove the last commit but keep the changes
git reset --soft HEAD~1

# Remove the last commit and discard the changes
git reset --hard HEAD~1

# Remove the last commit, keep changes unstaged
git reset --mixed HEAD~1
```

The difference between these options:

- `--soft` keeps your changes staged and ready to commit
- `--mixed` (default) keeps your changes in the working directory but unstaged
- `--hard` completely removes the changes

For example, if you want to fix the commit message or combine it with other changes, use soft reset:

```bash
# Remove last commit, keep changes staged
git reset --soft HEAD~1

# Make additional changes
echo "more code" >> file.js

# Create a new commit with everything
git add file.js
git commit -m "Better commit message with all changes"
```

## Deleting Multiple Recent Commits

To remove several recent commits, increase the number after `HEAD~`:

```bash
# Remove the last 3 commits completely
git reset --hard HEAD~3

# Remove the last 5 commits, keep changes unstaged
git reset HEAD~5
```

After resetting, check what was removed:

```bash
# View recent history
git log --oneline -10

# If you reset too far, recover using reflog
git reflog
git reset --hard HEAD@{1}
```

The reflog keeps track of all branch movements, so you can recover from mistakes for about 30 days after they happen.

## Deleting a Specific Commit from History

To remove a specific commit that is not the most recent one, use interactive rebase:

```bash
# Start interactive rebase for the last 5 commits
git rebase -i HEAD~5
```

This opens your editor with a list of commits:

```
pick a1b2c3d Add user authentication
pick e4f5g6h Fix validation bug
pick i7j8k9l Add logging
pick m1n2o3p Update documentation
pick q1r2s3t Add tests

# Commands:
# p, pick = use commit
# r, reword = use commit, but edit message
# e, edit = use commit, but stop for amending
# s, squash = use commit, but meld into previous commit
# d, drop = remove commit
```

To delete a specific commit, change `pick` to `drop` (or just delete the line):

```
pick a1b2c3d Add user authentication
drop e4f5g6h Fix validation bug
pick i7j8k9l Add logging
pick m1n2o3p Update documentation
pick q1r2s3t Add tests
```

Save and close the editor. Git will replay all the commits except the one marked as `drop`. If there are conflicts, Git will pause and let you resolve them:

```bash
# If conflicts occur during rebase
# Edit the conflicted files, then:
git add .
git rebase --continue

# Or abort if needed
git rebase --abort
```

## Finding the Right Commit to Delete

To identify which commit to delete, use Git's log commands:

```bash
# View recent commits with details
git log --oneline -10

# Search for commits by message
git log --grep="bug fix"

# Find commits that changed a specific file
git log --oneline -- path/to/file.js

# See what each commit changed
git log -p -3
```

Once you find the commit hash, you can target it specifically:

```bash
# Rebase back to just before that commit
git rebase -i <commit-hash>^
```

The `^` means "the commit before this one", which is where the rebase will start.

## Deleting Commits from Pushed Branches

If you've already pushed the commits to a remote repository, you have two options:

**Option 1: Revert (Safe for shared branches)**

Create a new commit that undoes the changes:

```bash
# Revert a specific commit
git revert e4f5g6h

# Revert multiple commits
git revert e4f5g6h i7j8k9l

# Revert without opening editor
git revert --no-edit e4f5g6h
```

This creates new commits that undo the changes, preserving the history and keeping other developers' work intact.

**Option 2: Force Push (Dangerous - only for branches you own)**

If you're certain no one else is working on the branch, you can delete commits and force push:

```bash
# Delete commits locally
git reset --hard HEAD~3

# Force push to remote
git push --force origin feature-branch
```

**Warning:** Never force push to shared branches like main or develop. Only use this on feature branches where you're the sole contributor.

## Verifying Commits Were Deleted

After deleting commits, verify the result:

```bash
# Check commit history
git log --oneline --graph -10

# Verify specific commit is gone
git log --all --oneline | grep "e4f5g6h"

# Check the state of files
git status

# Compare with remote branch
git log origin/main..HEAD
```

These commands help you confirm that you deleted the right commits and did not accidentally remove something important.

## Recovering Deleted Commits

If you deleted the wrong commit, the reflog can save you:

```bash
# View all recent operations
git reflog

# Output shows:
# a1b2c3d HEAD@{0}: rebase finished: returning to refs/heads/main
# e4f5g6h HEAD@{1}: rebase: Fix validation bug
# i7j8k9l HEAD@{2}: commit: Add logging
```

To recover:

```bash
# Reset to before the deletion
git reset --hard HEAD@{2}

# Or reset to a specific commit hash
git reset --hard e4f5g6h
```

The reflog is your safety net for recovering from mistakes with Git history.

## Best Practices

Always create a backup branch before deleting commits:

```bash
# Create backup
git branch backup-before-delete

# Delete commits
git reset --hard HEAD~5

# If something went wrong, restore from backup
git reset --hard backup-before-delete
```

For collaborative projects, communicate with your team before deleting commits from shared branches. What seems like a mistake to you might be intentional or might affect their work.

When you must delete commits from a pushed branch, choose the least disruptive time - when others are not actively working, and after coordinating with the team.

Now you know how to delete commits from Git branches using various methods. Remember to check whether commits have been shared before using destructive operations like reset or force push. For shared branches, use revert to safely undo changes without rewriting history.
