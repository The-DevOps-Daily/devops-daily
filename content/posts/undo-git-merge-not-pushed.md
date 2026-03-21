---
title: 'How to Undo a Git Merge That Has Not Been Pushed Yet'
excerpt: 'Made a merge you regret? Learn how to safely undo a Git merge before pushing it to the remote repository using reset and other recovery techniques.'
category:
  name: 'Git'
  slug: 'git'
date: '2025-01-15'
publishedAt: '2025-01-15T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Version Control
  - Troubleshooting
  - Development
  - Merge
---

You merged the wrong branch, or the merge created conflicts you'd rather handle differently. The good news is that if you have not pushed the merge yet, undoing it is straightforward and safe.

**TLDR:** To undo a merge that has not been pushed, use `git reset --hard HEAD~1` to completely remove the merge commit, or `git reset --merge ORIG_HEAD` to abort a merge in progress. If you want to keep the changes but undo the commit, use `git reset --soft HEAD~1` instead.

In this guide, you'll learn how to undo Git merges safely and recover your repository to the state before the merge.

## Prerequisites

You'll need Git installed on your system and a basic understanding of Git branches and merging. The techniques in this guide work best when the merge has not been pushed to a remote repository yet.

## Understanding What Happens During a Merge

When you merge one branch into another, Git creates a new commit that combines the histories of both branches. This merge commit has two parent commits - one from each branch:

```
    A---B---C feature
   /         \
  D---E---F---M main
```

In this diagram, `M` represents the merge commit that combines `feature` into `main`. The merge commit has both `F` and `C` as parents, creating a point where the two histories join together.

## Quick Reset: Remove the Merge Commit

The fastest way to undo a merge is to reset your branch to the commit before the merge. Git keeps track of where your branch was before the merge using `HEAD~1`:

```bash
# Remove the merge commit and all changes
git reset --hard HEAD~1
```

This command moves your branch pointer back one commit, effectively removing the merge. The `--hard` flag discards all changes from the merge, returning your working directory to the exact state before you merged.

After running this command, your branch history looks like it did before the merge:

```
    A---B---C feature
   /
  D---E---F main (back to before merge)
```

## Keeping Your Changes: Soft Reset

Sometimes you want to undo the merge commit but keep the changes in your working directory. This is useful when you want to re-merge or commit the changes differently:

```bash
# Undo merge but keep changes staged
git reset --soft HEAD~1
```

After a soft reset, all the changes from the merge remain in your staging area. You can review them, make modifications, and create new commits:

```bash
# Check what is staged after soft reset
git status

# Review the changes
git diff --staged

# You can now commit these changes differently
git commit -m "Apply feature changes manually"
```

## Aborting a Merge in Progress

If you started a merge but have not completed it yet (perhaps you're in the middle of resolving conflicts), you can abort the entire merge operation:

```bash
# Abort the current merge
git merge --abort
```

This is the safest option when you're in the middle of a merge and realize you want to back out. It returns your repository to the state before you ran `git merge`.

## Using ORIG_HEAD for Merge Recovery

Git automatically creates a reference called `ORIG_HEAD` whenever you perform certain operations, including merges. This reference points to where HEAD was before the operation:

```bash
# Reset to the state before the merge
git reset --hard ORIG_HEAD
```

This is particularly useful immediately after a merge because `ORIG_HEAD` gives you a reliable way to undo the operation. However, keep in mind that `ORIG_HEAD` gets updated by other Git operations too, so use it right after the merge.

## Mixed Reset: Review Before Recommitting

A mixed reset (the default mode) gives you a middle ground between hard and soft resets:

```bash
# Undo merge, keep changes unstaged
git reset HEAD~1

# Same as above - mixed is the default
git reset --mixed HEAD~1
```

This removes the merge commit and unstages all changes, but keeps them in your working directory. You can then review each change, stage what you want, and create new commits:

```bash
# After mixed reset, see what changed
git status

# Stage specific files
git add src/authentication.js
git add src/validation.js

# Commit only what you want
git commit -m "Add authentication changes"
```

## Verifying Your Repository State

Before and after undoing a merge, check your repository state to make sure everything is as expected:

```bash
# View recent commits and see where HEAD points
git log --oneline --graph -10

# Check the status of your working directory
git status

# See which branch you're on
git branch
```

The `--graph` flag shows you the branch structure visually in your terminal, making it easy to confirm that the merge has been removed.

## What If You Already Pushed?

If you already pushed the merge to a remote repository, you have different options. Never use `git reset` on commits that others might have pulled, as this rewrites history and causes problems for collaborators.

Instead, use `git revert` to create a new commit that undoes the merge:

```bash
# Revert a merge commit (specify parent 1)
git revert -m 1 HEAD

# Push the revert commit
git push origin main
```

The `-m 1` flag tells Git which parent of the merge commit to consider the mainline. Usually you want `1`, which represents the branch you merged into.

## Recovering If Something Goes Wrong

If you reset too far or make a mistake, Git's reflog can help you recover:

```bash
# View all recent operations
git reflog

# Output shows something like:
# a1b2c3d HEAD@{0}: reset: moving to HEAD~1
# e4f5g6h HEAD@{1}: merge feature: Merge made by 'recursive'
# i7j8k9l HEAD@{2}: commit: Update user service
```

To get back to a specific state, reset to that reflog entry:

```bash
# Restore the merge you just undid
git reset --hard HEAD@{1}
```

The reflog keeps entries for about 30 days by default, giving you plenty of time to recover from mistakes.

## Handling Specific Scenarios

If you merged multiple branches and want to undo just the most recent merge, `HEAD~1` works perfectly. But if you want to undo a merge that happened several commits ago, you'll need to find its commit hash:

```bash
# Find the merge commit
git log --oneline --merges -10

# Reset to the commit before the merge
git reset --hard abc1234
```

When you've made commits after the merge and want to undo only the merge while keeping those commits, you'll need interactive rebase:

```bash
# Start interactive rebase
git rebase -i HEAD~5

# In the editor, remove the line with the merge commit
# Save and close - Git will replay commits without the merge
```

Now you know how to safely undo Git merges in various situations. The key is understanding whether the merge has been shared with others - if it has not been pushed, you can safely use reset. If it has been pushed, use revert to maintain a clean collaboration workflow.
