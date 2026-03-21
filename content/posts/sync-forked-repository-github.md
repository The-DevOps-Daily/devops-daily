---
title: 'How to Update or Sync a Forked Repository on GitHub'
excerpt: 'Your fork is behind the original repository? Learn how to sync your GitHub fork with the upstream repository and keep it up to date with the latest changes.'
category:
  name: 'Git'
  slug: 'git'
date: '2025-02-20'
publishedAt: '2025-02-20T11:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - GitHub
  - Fork
  - Version Control
  - Open Source
---

When you fork a repository on GitHub, you create your own copy of the project. Over time, the original repository (called the upstream) gets new commits that your fork does not have. To stay current, you need to sync your fork with the upstream repository.

**TLDR:** To sync a forked repository, add the original repository as an upstream remote with `git remote add upstream <original-repo-url>`, fetch the updates with `git fetch upstream`, and merge them into your branch with `git merge upstream/main`. Then push the changes to your fork with `git push origin main`.

In this guide, you'll learn how to keep your forked repository synchronized with the original project.

## Prerequisites

You'll need a GitHub account with a forked repository, Git installed locally, and the fork cloned to your machine. Basic familiarity with Git commands and GitHub workflows will be helpful.

## Understanding Forks and Upstreams

When you fork a repository, GitHub creates a complete copy under your account. Your fork is independent - changes to the original repository do not automatically appear in your fork:

```
Original Repo (upstream)          Your Fork (origin)
github.com/author/project   -->   github.com/you/project
        |                                 |
        |                                 |
    (diverge over time)               (your changes)
```

To keep your fork updated, you need to pull changes from the upstream repository and push them to your fork. This requires adding the upstream repository as a remote in your local clone.

## Adding the Upstream Remote

First, check your current remotes to see what is already configured:

```bash
# View your current remotes
git remote -v
```

Typically, you'll see only your fork:

```
origin  https://github.com/your-username/project.git (fetch)
origin  https://github.com/your-username/project.git (push)
```

Now add the original repository as the upstream remote:

```bash
# Add the upstream repository
git remote add upstream https://github.com/original-author/project.git

# Verify the upstream was added
git remote -v
```

You should now see both remotes:

```
origin    https://github.com/your-username/project.git (fetch)
origin    https://github.com/your-username/project.git (push)
upstream  https://github.com/original-author/project.git (fetch)
upstream  https://github.com/original-author/project.git (push)
```

You only need to add the upstream remote once. Git remembers this configuration for future syncs.

## Fetching Updates from Upstream

Fetching downloads the latest commits from the upstream repository without modifying your local files:

```bash
# Fetch all branches from upstream
git fetch upstream
```

This command downloads all new commits, branches, and tags from the upstream repository. Your local files remain unchanged - Git just updates its knowledge of what exists in the upstream repository.

You can verify what branches are available:

```bash
# List all remote branches
git branch -r
```

You'll see branches from both remotes:

```
  origin/main
  origin/feature-branch
  upstream/main
  upstream/develop
  upstream/release-1.0
```

## Merging Upstream Changes

Before merging, make sure you're on the branch you want to update (typically main or master):

```bash
# Switch to your main branch
git checkout main

# Merge the upstream main branch
git merge upstream/main
```

This merges the commits from upstream/main into your local main branch. If there are no conflicts, Git completes the merge automatically. Your local repository now has all the commits from the upstream repository.

If you have no local commits on main, Git performs a fast-forward merge, simply moving your branch pointer forward:

```
Before merge:
  A---B---C  upstream/main
  |
  D  your main (behind)

After merge:
  A---B---C  both branches
```

## Handling Merge Conflicts

If you've made commits to your main branch that conflict with upstream changes, you'll need to resolve conflicts:

```bash
# Attempt to merge
git merge upstream/main

# Git will notify you of conflicts:
# Auto-merging src/app.js
# CONFLICT (content): Merge conflict in src/app.js
# Automatic merge failed; fix conflicts and then commit the result.
```

Open the conflicted files and look for conflict markers:

```javascript
<<<<<<< HEAD
// Your changes
function authenticate(user) {
  return user.token !== undefined;
}
=======
// Upstream changes
function authenticate(user) {
  return user.token && user.token.length > 0;
}
>>>>>>> upstream/main
```

Edit the file to resolve the conflict, removing the markers and keeping the code you want:

```javascript
// Resolved version
function authenticate(user) {
  return user.token && user.token.length > 0;
}
```

Then complete the merge:

```bash
# Stage the resolved files
git add src/app.js

# Complete the merge
git commit -m "Merge upstream changes and resolve conflicts"
```

## Pushing Updates to Your Fork

After merging upstream changes locally, push them to your fork on GitHub:

```bash
# Push to your fork
git push origin main
```

Your fork is now synchronized with the upstream repository. The changes appear in your GitHub repository, and both your local copy and remote fork are up to date.

## Syncing Other Branches

If the project uses multiple branches (like develop or release branches), you can sync those too:

```bash
# Switch to the develop branch
git checkout develop

# If you do not have it locally, create it from upstream
git checkout -b develop upstream/develop

# Fetch and merge upstream develop
git fetch upstream
git merge upstream/develop

# Push to your fork
git push origin develop
```

This keeps all relevant branches in your fork synchronized with the upstream repository.

## Using Rebase Instead of Merge

If you prefer to keep a linear history without merge commits, use rebase:

```bash
# Fetch upstream changes
git fetch upstream

# Rebase your changes on top of upstream
git rebase upstream/main
```

Rebasing replays your commits on top of the upstream commits, creating a cleaner history. After rebasing, force push to your fork (only if you have not shared this branch):

```bash
# Force push after rebase
git push --force origin main
```

**Warning:** Only use force push on branches that you're the sole contributor to. Never force push to shared branches.

## Checking Sync Status

Before syncing, you might want to see how far behind your fork is:

```bash
# Fetch without merging
git fetch upstream

# Compare your branch to upstream
git log HEAD..upstream/main --oneline
```

This shows commits that exist in upstream/main but not in your local branch. If there is no output, you're already up to date.

To see the actual changes:

```bash
# View the diff between your branch and upstream
git diff HEAD..upstream/main
```

## Keeping Your Fork Clean

If you do not plan to make any changes to the main branch, you can reset it to exactly match upstream:

```bash
# Fetch upstream
git fetch upstream

# Reset main to match upstream exactly
git reset --hard upstream/main

# Force push to your fork
git push --force origin main
```

This discards any commits you made to main and makes it identical to upstream. Only do this if you're certain you do not need those commits.

Now you know how to keep your forked repository synchronized with the upstream project. Regular syncing helps you stay current with bug fixes, new features, and security updates from the original repository. For active projects, consider syncing weekly or before starting new work on your fork.
