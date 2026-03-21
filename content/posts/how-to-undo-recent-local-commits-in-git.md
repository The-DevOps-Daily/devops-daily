---
title: 'How to Undo the Most Recent Local Commits in Git'
excerpt: 'Learn different ways to undo recent Git commits using reset, revert, and rebase commands. Understand when to use each method safely.'
category:
  name: 'Git'
  slug: 'git'
date: '2024-12-10'
publishedAt: '2024-12-10T14:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Version Control
  - Troubleshooting
  - Development
  - Command Line
---

You've just made a commit and realized you made a mistake, or you need to undo several recent commits to fix an issue. Git provides several ways to undo commits, each with different implications for your project history and collaboration workflow.

In this guide, you'll learn the different methods to undo recent local commits and when to use each approach safely.

## Prerequisites

You'll need Git installed on your system and a basic understanding of Git concepts like commits, branches, and the staging area. Make sure you're working with local commits that haven't been pushed to a shared repository for the safer methods.

## Understanding Your Options

Before jumping into commands, it's important to understand the three main approaches to undoing commits:

**git reset** removes commits from history entirely, **git revert** creates new commits that undo previous changes, and **git rebase** allows you to modify commit history interactively. Each method serves different scenarios depending on whether you've shared your commits with others.

## Using git reset to Remove Recent Commits

The `git reset` command is the most straightforward way to undo local commits. It moves your branch pointer back to an earlier commit, effectively removing the recent commits from your branch history.

### Soft Reset: Keep Your Changes Staged

A soft reset removes the commits but keeps all your changes in the staging area:

```bash
# Undo the last commit, keep changes staged
git reset --soft HEAD~1

# Undo the last 3 commits, keep changes staged
git reset --soft HEAD~3
```

This is useful when you want to re-commit your changes with a better commit message or combine multiple commits into one. After a soft reset, you can modify your changes and create a new commit.

### Mixed Reset: Keep Changes Unstaged

A mixed reset (the default) removes commits and unstages the changes, but keeps them in your working directory:

```bash
# Undo the last commit, keep changes unstaged
git reset HEAD~1

# Same as above, mixed is the default
git reset --mixed HEAD~1
```

This gives you the opportunity to review your changes, stage only what you want, and create new commits with a cleaner history.

### Hard Reset: Remove Everything

A hard reset completely removes the commits and all associated changes:

```bash
# Completely remove the last commit and its changes
git reset --hard HEAD~1

# Remove the last 2 commits and their changes
git reset --hard HEAD~2
```

**Warning:** Be extremely careful with hard reset. Once you run this command, the changes in those commits are permanently lost unless you have them backed up elsewhere.

## Using git revert for Safe Undoing

When you need to undo commits that have already been shared with others, `git revert` is the safest option. It creates new commits that reverse the changes from previous commits.

To revert the most recent commit:

```bash
git revert HEAD
```

This opens your editor to create a commit message for the revert. The default message is usually fine, but you can customize it to explain why you're reverting the change.

To revert multiple recent commits:

```bash
# Revert the last 3 commits individually
git revert HEAD~2..HEAD

# Revert multiple commits without opening editor for each
git revert --no-edit HEAD~2..HEAD
```

The advantage of `git revert` is that it preserves the original commit history while cleanly undoing changes. This makes it safe to use on shared branches.

## Interactive Rebase for Complex History Editing

When you need more control over which commits to modify, `git rebase` with the interactive flag provides flexible options:

```bash
# Interactive rebase for the last 3 commits
git rebase -i HEAD~3
```

This opens an editor showing your recent commits:

```
pick a1b2c3d Add user authentication
pick e4f5g6h Fix login validation
pick i7j8k9l Update documentation

# Rebase commands:
# p, pick = use commit
# r, reword = use commit, but edit the commit message
# e, edit = use commit, but stop for amending
# s, squash = use commit, but meld into previous commit
# d, drop = remove commit
```

You can change `pick` to different commands to modify your commit history. For example, to remove the middle commit, change `pick` to `drop`:

```
pick a1b2c3d Add user authentication
drop e4f5g6h Fix login validation
pick i7j8k9l Update documentation
```

## Recovering from Mistakes

If you accidentally reset too far or lose commits, Git's reflog can help you recover:

```bash
# Show recent actions in your repository
git reflog

# This shows output like:
# a1b2c3d HEAD@{0}: reset: moving to HEAD~2
# e4f5g6h HEAD@{1}: commit: Fix login validation
# i7j8k9l HEAD@{2}: commit: Update documentation
```

To recover a lost commit, reset to the commit hash from the reflog:

```bash
# Recover to the state before your reset
git reset --hard HEAD@{1}
```

The reflog keeps track of all changes to your branch tips, so you can usually recover from most mistakes within the default 30-day retention period.

## Checking Your Repository State

Before and after undoing commits, it's helpful to check your repository state:

```bash
# See recent commit history
git log --oneline -5

# Check working directory status
git status

# See what changes are staged
git diff --staged

# See unstaged changes
git diff
```

These commands help you understand exactly what state your repository is in and verify that your undo operation worked as expected.

## Best Practices for Undoing Commits

Always check if your commits have been pushed to a shared repository before using destructive commands like `git reset --hard`. If they have been shared, use `git revert` instead to avoid disrupting other developers' work.

Create a backup branch before performing major history modifications:

```bash
# Create backup before undoing commits
git branch backup-before-reset

# Now safely perform your reset
git reset --hard HEAD~3
```

For commits that fix typos in commit messages, use `git commit --amend` for the most recent commit:

```bash
# Fix the message of the last commit
git commit --amend -m "Fixed typo in user authentication feature"
```

When working on a feature branch that you haven't shared yet, you can freely use any of these methods. However, once you've pushed commits to a shared branch, stick to `git revert` to maintain a clean collaboration workflow.

## Handling Different Scenarios

If you need to undo a merge commit, use the `-m` flag with revert to specify which parent to revert to:

```bash
# Revert a merge commit (usually you want parent 1)
git revert -m 1 HEAD
```

When you've made several small commits that should be one larger commit, use interactive rebase to squash them:

```bash
git rebase -i HEAD~4
# Change 'pick' to 'squash' for commits you want to combine
```

For situations where you want to keep some changes from a commit but not others, reset with `--soft` and then selectively stage your changes:

```bash
git reset --soft HEAD~1
git add specific-file.js
git commit -m "Keep only the important changes"
```

Now you have the tools to safely undo Git commits in various scenarios. Remember that the key is understanding whether your commits have been shared with others, which determines whether you can safely rewrite history or need to create new commits that undo previous changes.
