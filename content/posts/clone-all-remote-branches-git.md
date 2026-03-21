---
title: 'How to Clone All Remote Branches in Git'
excerpt: 'Need to work with all branches from a remote repository? Learn how to clone and check out all remote branches efficiently using Git commands.'
category:
  name: 'Git'
  slug: 'git'
date: '2024-12-18'
publishedAt: '2024-12-18T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Version Control
  - Cloning
  - Remote Branches
  - Development
---

When you clone a Git repository, you only get the default branch checked out locally, even though Git downloads references to all remote branches. If you need to work with other branches, you'll need to check them out explicitly.

**TLDR:** When you clone a repository, Git already downloads all branch information. To work with a remote branch locally, use `git checkout branch-name` or `git switch branch-name`. To create local tracking branches for all remote branches at once, use a script that loops through `git branch -r` output.

In this guide, you'll learn how to access and work with all branches from a remote repository.

## Prerequisites

You'll need Git installed on your system and access to a remote repository. Basic familiarity with Git branches and the command line will help you follow along.

## Understanding Remote Branch References

When you clone a repository, Git downloads all branches but only checks out the default branch (usually `main` or `master`). The other branches exist as remote references:

```bash
# Clone a repository
git clone https://github.com/username/repository.git
cd repository

# List all branches including remote ones
git branch -a
```

The output looks something like this:

```
* main
  remotes/origin/HEAD -> origin/main
  remotes/origin/main
  remotes/origin/feature-auth
  remotes/origin/feature-dashboard
  remotes/origin/bugfix-login
```

The branches prefixed with `remotes/origin/` are remote references. They're read-only copies of the branches on the remote server.

## Checking Out a Single Remote Branch

To work with a specific remote branch, you create a local tracking branch:

```bash
# Create and switch to a local branch tracking the remote
git checkout feature-auth

# Modern Git also supports this syntax
git switch feature-auth
```

Git automatically sets up the local branch to track the remote branch. This means when you run `git pull` or `git push`, Git knows which remote branch to sync with:

```
    Local                 Remote
    -----                 ------
    main         <-->     origin/main
    feature-auth <-->     origin/feature-auth
```

## Creating Local Branches for All Remote Branches

If you need local copies of all remote branches, you can loop through them and create tracking branches:

```bash
# Fetch all remote branches first
git fetch --all

# Create local tracking branches for all remote branches
for branch in $(git branch -r | grep -v '\->' | sed 's/origin\///'); do
  git branch --track "$branch" "origin/$branch" 2>/dev/null || true
done
```

This command breaks down as follows:
- `git branch -r` lists all remote branches
- `grep -v '\->'` filters out the HEAD reference
- `sed 's/origin\///'` removes the "origin/" prefix
- `git branch --track` creates a local tracking branch
- `2>/dev/null || true` suppresses errors for branches that already exist locally

After running this, `git branch` shows all branches:

```bash
# View all local branches
git branch
```

You'll see output like:

```
  bugfix-login
  feature-auth
  feature-dashboard
* main
```

## Fetching Updates for All Branches

Once you have multiple local branches, you'll want to keep them updated with the remote:

```bash
# Fetch updates for all remote branches
git fetch --all

# Update your current branch
git pull

# Or update a specific branch without switching to it
git fetch origin feature-auth:feature-auth
```

The `git fetch --all` command downloads new commits from all remote branches but does not modify your working directory. You still need to merge or pull to update your local branches.

## Switching Between Branches

Once you have local copies of multiple branches, switching between them is simple:

```bash
# Switch to a different branch
git checkout feature-dashboard

# Or use the newer switch command
git switch feature-dashboard

# Create a new branch from the current state
git switch -c new-feature
```

The working directory changes to reflect the state of the branch you switch to. Make sure to commit or stash any changes before switching branches.

## Checking Branch Tracking Information

To see which local branches track which remote branches:

```bash
# Show tracking information for all branches
git branch -vv
```

This displays output like:

```
  bugfix-login      a1b2c3d [origin/bugfix-login] Fix authentication error
  feature-auth      e4f5g6h [origin/feature-auth: ahead 2] Add OAuth support
  feature-dashboard i7j8k9l [origin/feature-dashboard] Update dashboard UI
* main              m1n2o3p [origin/main] Merge pull request #42
```

The bracketed information shows which remote branch each local branch tracks and whether you're ahead or behind.

## Working With Specific Branches Only

Sometimes you do not need all branches locally. You can selectively fetch specific branches:

```bash
# Fetch a specific branch
git fetch origin feature-auth

# Create a local tracking branch for it
git checkout -b feature-auth origin/feature-auth

# Or do both in one step with modern Git
git switch -c feature-auth origin/feature-auth
```

This approach saves disk space and keeps your repository cleaner when working on large projects with many branches.

## Cleaning Up Old Branches

Remote branches that have been deleted will not automatically disappear from your local repository. You can clean them up:

```bash
# Remove references to deleted remote branches
git fetch --prune

# Or set it as default behavior
git config --global fetch.prune true

# Delete a local branch
git branch -d feature-old

# Force delete if it has not been merged
git branch -D feature-old
```

The `--prune` flag removes remote-tracking references that no longer exist on the remote server, keeping your branch list clean and up to date.

## Viewing Branch Differences

When working with multiple branches, you'll often want to compare them:

```bash
# See commits in feature-auth that are not in main
git log main..feature-auth

# See the diff between two branches
git diff main..feature-auth

# See files that differ between branches
git diff --name-only main feature-auth
```

These commands help you understand what changes exist in different branches before merging or switching.

## Pushing Multiple Branches

If you've made changes to several local branches and want to push them all:

```bash
# Push all branches to the remote
git push --all origin

# Push all branches and tags
git push --all origin && git push --tags origin
```

Be careful with `git push --all` - it pushes every local branch to the remote, which might not always be what you want, especially if you have experimental or work-in-progress branches.

Now you know how to work with all remote branches in a Git repository. Remember that Git automatically downloads branch information when you clone - you just need to create local tracking branches when you want to work with them. For most workflows, checking out branches as you need them is more practical than creating local copies of every branch upfront.
