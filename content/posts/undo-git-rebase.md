---
title: 'How to Undo a Git Rebase'
excerpt: 'Rebase went wrong? Learn how to undo a Git rebase using reflog and reset commands to recover your branch to its state before the rebase operation.'
category:
  name: 'Git'
  slug: 'git'
date: '2024-10-28'
publishedAt: '2024-10-28T14:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Rebase
  - Version Control
  - Recovery
  - Troubleshooting
---

A rebase operation rewrites your commit history, and sometimes it does not go as planned. You might end up with conflicts you cannot resolve, lose commits you wanted to keep, or simply realize you rebased the wrong branch. The good news is that Git keeps track of your branch's previous state, making it possible to undo a rebase.

**TLDR:** To undo a rebase, use `git reflog` to find the commit hash before the rebase started (look for the entry right before the rebase), then run `git reset --hard <commit-hash>` to restore your branch to that state. If you're in the middle of a rebase, use `git rebase --abort` instead.

In this guide, you'll learn how to safely undo rebases and recover your repository to its previous state.

## Prerequisites

You'll need Git installed on your system and a basic understanding of how rebasing works. Familiarity with Git commands like log, reset, and reflog will help you navigate the recovery process.

## Aborting a Rebase in Progress

If you're in the middle of a rebase and have not finished it yet, the easiest solution is to abort:

```bash
# Abort the current rebase
git rebase --abort
```

This command stops the rebase operation and returns your branch to exactly where it was before you started. It's the safest option when you realize mid-rebase that something is not going well.

You'll know you're in the middle of a rebase if:
- Git shows messages about conflicts during the rebase
- Your prompt shows a rebase indicator
- Running `git status` mentions the rebase

After aborting, verify your branch is back to normal:

```bash
# Check branch status
git status

# View recent commits
git log --oneline -5
```

## Understanding the Reflog

The reflog is Git's safety net. It records every change to your branch pointers, including rebases, resets, and commits. Even when commits seem lost, they're usually still in the reflog:

```bash
# View the reflog for your current branch
git reflog
```

The output looks like this:

```
a1b2c3d (HEAD -> main) HEAD@{0}: rebase finished: returning to refs/heads/main
e4f5g6h HEAD@{1}: rebase: commit: Update user service
i7j8k9l HEAD@{2}: rebase: commit: Add authentication
m1n2o3p HEAD@{3}: rebase: checkout feature
q1r2s3t HEAD@{4}: commit: Add validation
u1v2w3x HEAD@{5}: commit: Initial feature work
```

Each entry shows:
- The commit hash at that point
- The HEAD reference number
- What operation caused the change
- A description of the operation

To undo the rebase, you want to reset to the state before it started. In the example above, that's `HEAD@{4}` - the commit before "rebase: checkout feature".

## Undoing a Completed Rebase

After you've finished a rebase, use the reflog to find where your branch was before:

```bash
# View the reflog
git reflog

# Look for the commit before the rebase started
# It's usually labeled something like "commit:" or "checkout:"
# before the "rebase:" entries
```

Once you identify the correct commit, reset to it:

```bash
# Reset to before the rebase
git reset --hard HEAD@{4}

# Or use the specific commit hash
git reset --hard q1r2s3t
```

The `--hard` flag resets your branch pointer, staging area, and working directory to that commit. Your branch is now exactly as it was before the rebase.

Verify the undo worked:

```bash
# Check the commit history
git log --oneline -10

# Compare with the remote if needed
git log origin/main..HEAD
```

## Finding the Right Reflog Entry

Sometimes the reflog has many entries, making it hard to find the right one. Here are some strategies:

```bash
# Show more context for each entry
git reflog show --date=relative

# Output includes timestamps:
# q1r2s3t HEAD@{2 hours ago}: commit: Add validation
# u1v2w3x HEAD@{3 hours ago}: commit: Initial feature work
```

The timestamp helps you identify when you started the rebase. Look for the last commit before that time.

To see what the repository looked like at a specific reflog entry:

```bash
# View log at a specific reflog point
git log HEAD@{4} --oneline -5

# Check what files changed
git diff HEAD@{4}

# See the exact state without changing anything
git show HEAD@{4}
```

These commands let you verify you're resetting to the correct state before actually doing it.

## Undoing a Rebase After Force Pushing

If you already force-pushed the rebased branch to a remote repository, you'll need to force push again after undoing:

```bash
# Undo the rebase locally
git reset --hard HEAD@{4}

# Force push to overwrite the remote branch
git push --force origin feature-branch
```

**Warning:** Only force push to branches you own. Never force push to shared branches like main or develop without coordinating with your team.

If others have already pulled your rebased branch, they'll need to reset their local copies too:

```bash
# On other machines, after you've force-pushed the undo
git fetch origin
git reset --hard origin/feature-branch
```

## Recovering Specific Commits After a Rebase

Sometimes you want to undo a rebase but keep some of the changes. You can cherry-pick commits from the reflog:

```bash
# Reset to before the rebase
git reset --hard HEAD@{4}

# Cherry-pick specific commits from the rebase
git cherry-pick a1b2c3d
git cherry-pick e4f5g6h
```

This gives you fine-grained control over which changes to keep and which to discard.

Another approach is to create a new branch from the rebased state before undoing:

```bash
# Create a branch pointing to the rebased state
git branch rebased-backup HEAD@{0}

# Reset main branch to before rebase
git reset --hard HEAD@{4}

# Now you can cherry-pick or compare
git log rebased-backup --oneline
```

## Understanding What Gets Undone

When you undo a rebase with reset, you're moving your branch pointer back in time. The rebased commits still exist in Git's object database - they're just not reachable from any branch:

```
Before undo:
  A---B---C---D  original commits (unreachable)
                \
                 A'--B'--C'--D'  main (rebased)

After undo:
  A---B---C---D  main (restored)
                \
                 A'--B'--C'--D'  (unreachable, will be garbage collected)
```

The rebased commits remain accessible through the reflog for about 30 days before Git's garbage collector removes them. During this time, you can still access them if needed.

## Preventing Rebase Problems

To avoid needing to undo rebases in the first place, follow these practices:

Create a backup branch before rebasing:

```bash
# Create backup before risky operations
git branch backup-before-rebase

# Perform the rebase
git rebase main

# If it goes wrong, switch to backup
git checkout backup-before-rebase
```

Test rebase on a copy of your branch:

```bash
# Create a test branch
git branch test-rebase

# Try rebasing the test branch
git checkout test-rebase
git rebase main

# If it works, rebase the real branch
# If not, delete the test branch
git branch -D test-rebase
```

Use interactive rebase for complex operations:

```bash
# Interactive rebase shows exactly what will happen
git rebase -i main

# Review the plan before Git executes it
```

## When Reflog Entries Expire

Reflog entries expire after 90 days by default (30 days for unreachable commits). If you need to recover an old rebase, check the reflog expiration settings:

```bash
# Check reflog expiration settings
git config --get gc.reflogExpire
git config --get gc.reflogExpireUnreachable

# Extend the expiration period (if needed)
git config gc.reflogExpire "never"
git config gc.reflogExpireUnreachable "never"
```

You can also prevent Git from pruning old reflog entries during cleanup:

```bash
# Run garbage collection without pruning reflog
git gc --prune=none
```

## Handling Complex Rebase Scenarios

If you rebased multiple times and need to undo all of them, find the earliest rebase in the reflog:

```bash
# View full reflog
git reflog

# Look for the commit before the first rebase
# Reset to that point
git reset --hard <commit-before-first-rebase>
```

For interactive rebases that dropped commits, those commits are still in the reflog:

```bash
# Find dropped commits
git reflog | grep "commit:"

# Cherry-pick them back
git cherry-pick <commit-hash>
```

Now you know how to undo Git rebases and recover your repository to its previous state. The reflog is your most important tool for recovery - it tracks every change to your branches, giving you a safety net when rebases do not go as planned.
