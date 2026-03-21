---
title: 'How to Rename a Local Git Branch'
excerpt: 'Learn how to rename Git branches locally using git branch -m, handle the current branch, and update remote tracking references safely.'
category:
  name: 'Git'
  slug: 'git'
date: '2024-12-02'
publishedAt: '2024-12-02T13:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Version Control
  - Branch Management
  - Command Line
  - Development
---

You've created a branch with a typo in the name, or your team has decided to change naming conventions, and now you need to rename an existing Git branch. While Git doesn't have a direct "rename" command, it provides a simple way to move branches to new names while preserving all commit history.

In this guide, you'll learn how to rename local Git branches safely and handle the associated remote tracking references.

## Prerequisites

You'll need Git installed on your system and a repository with at least one branch to rename. Basic familiarity with Git branching will help you understand the implications of renaming branches.

## Renaming Your Current Branch

The most common scenario is renaming the branch you're currently working on. Git makes this straightforward with the `git branch -m` command.

To rename your current branch:

```bash
git branch -m new-branch-name
```

This command moves (renames) your current branch to the new name. The `-m` flag stands for "move" and works similar to the `mv` command in Unix systems.

For example, if you're on a branch called `featur-login` (with a typo) and want to rename it to `feature-login`:

```bash
git branch -m feature-login
```

Your branch is now renamed, and all your commits, branch history, and current working state remain exactly the same.

## Renaming a Different Branch

When you want to rename a branch other than the one you're currently on, you need to specify both the old and new names:

```bash
git branch -m old-branch-name new-branch-name
```

For example, to rename a branch called `experimental-feature` to `user-notifications` while you're on a different branch:

```bash
git branch -m experimental-feature user-notifications
```

This is useful when you want to rename multiple branches without switching between them.

## Checking Your Branch Names

Before and after renaming, it's helpful to verify your branch names. You can list all local branches to see the current state:

```bash
git branch
```

This shows all your local branches with an asterisk next to your current branch:

```
  feature-login
* main
  user-notifications
```

You can also see more detailed information including the last commit on each branch:

```bash
git branch -v
```

This displays output like:

```
  feature-login      a1b2c3d Add login validation
* main              e4f5g6h Update README
  user-notifications i7j8k9l Implement notification system
```

## Handling Remote Tracking Branches

When you rename a local branch that tracks a remote branch, the local tracking reference becomes outdated. You'll need to update or remove the old remote tracking configuration.

First, check if your branch has a remote tracking branch:

```bash
git branch -vv
```

This shows which remote branches your local branches are tracking:

```
  feature-login      a1b2c3d [origin/featur-login] Add login validation
* main              e4f5g6h [origin/main] Update README
```

If your renamed branch was tracking a remote branch, you have two options: update the remote branch name to match, or set up tracking for a new remote branch.

To remove the old remote tracking reference:

```bash
git branch --unset-upstream feature-login
```

To set up tracking for a new remote branch with the correct name:

```bash
git push -u origin feature-login
```

This pushes your renamed branch to the remote and sets up tracking for the new name.

## Renaming Branches with Force

In rare cases, you might try to rename a branch to a name that already exists. Git will prevent this by default:

```bash
git branch -m feature-login existing-branch
# fatal: A branch named 'existing-branch' already exists.
```

If you're certain you want to overwrite the existing branch, use the force flag:

```bash
git branch -M feature-login existing-branch
```

The `-M` flag (capital M) forces the rename even if the target branch name already exists. Be very careful with this option as it will permanently delete the existing branch and replace it with your renamed branch.

## Updating Remote Repositories

If you've already pushed your branch to a remote repository before renaming it, you'll need to handle the remote side of things as well.

After renaming your local branch, push the new branch name to the remote:

```bash
git push -u origin new-branch-name
```

Then delete the old branch from the remote repository:

```bash
git push origin --delete old-branch-name
```

For example, if you renamed `featur-login` to `feature-login`:

```bash
# Push the renamed branch
git push -u origin feature-login

# Delete the old branch from remote
git push origin --delete featur-login
```

This ensures both your local and remote repositories have consistent branch names.

## Common Scenarios and Solutions

### Renaming the Main Development Branch

If you need to rename your main development branch (like changing from `master` to `main`), the process is the same, but you'll need to coordinate with your team:

```bash
# Rename the local branch
git branch -m master main

# Push the new branch
git push -u origin main

# Update the default branch in your repository settings
# (This needs to be done in your Git hosting service)

# Delete the old branch from remote
git push origin --delete master
```

### Fixing Naming Convention Issues

When standardizing branch naming conventions across your team, you might need to rename multiple branches:

```bash
# Rename feature branches to include prefix
git branch -m login-feature feature/login
git branch -m signup-page feature/signup
git branch -m bug-fix-auth bugfix/authentication
```

### Handling Case Sensitivity Issues

On case-insensitive file systems (like macOS), Git might not handle case-only renames as expected. Use the force flag to ensure the rename works:

```bash
# This might not work on case-insensitive systems
git branch -m Feature-Login feature-login

# Use force to ensure it works
git branch -M Feature-Login feature-login
```

## Verifying the Rename

After renaming a branch, verify that everything worked correctly:

```bash
# Check that the branch was renamed
git branch

# Verify your commit history is intact
git log --oneline -5

# Check remote tracking status
git branch -vv

# Ensure you can still commit normally
git status
```

Your renamed branch should appear in the branch list, your commit history should be unchanged, and you should be able to continue working normally.

## Best Practices for Branch Renaming

Choose descriptive, consistent names that follow your team's naming conventions. Common patterns include `feature/description`, `bugfix/issue-number`, or `task/brief-description`.

Communicate with your team before renaming shared branches, especially if other developers might have local copies of the old branch name.

Consider the impact on any automation, CI/CD pipelines, or scripts that reference the old branch name. Update these systems after renaming important branches.

When working with pull requests or merge requests, check if your Git hosting service has automatically updated the target branch name, or if you need to close old requests and create new ones.

Renaming Git branches is a straightforward process that helps maintain clean, organized repositories. Whether you're fixing typos, updating naming conventions, or reorganizing your branch structure, the `git branch -m` command provides a safe way to rename branches while preserving all your work and history.
