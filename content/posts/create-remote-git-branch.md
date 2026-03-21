---
title: 'How to Create a Remote Git Branch'
excerpt: 'Need to create a branch on the remote repository? Learn how to push local branches to remote and create remote branches directly.'
category:
  name: 'Git'
  slug: 'git'
date: '2025-03-25'
publishedAt: '2025-03-25T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Branches
  - Remote
  - Version Control
  - Collaboration
---

You created a local branch and want to share it with your team by pushing it to the remote repository. Or you need to create a branch directly on the remote for others to use.

**TLDR:** To create a remote branch from a local branch, use `git push -u origin branch-name`. The `-u` flag sets up tracking so future pushes and pulls work automatically. To create a remote branch without a local one, push an empty branch or use your Git hosting platform's interface.

In this guide, you'll learn how to create and manage remote branches in Git.

## Prerequisites

You'll need Git installed, a repository with remote access, and permissions to push to the remote. Basic familiarity with Git branches and remotes will be helpful.

## Understanding Local vs Remote Branches

Git keeps branches in two places:

```
Local Repository          Remote Repository
----------------          -----------------
main                      origin/main
feature-auth              origin/feature-auth
bugfix-login              (not on remote yet)
```

Local branches exist only on your machine until you push them to a remote repository.

## Creating a Remote Branch from Local

The most common way to create a remote branch is pushing a local branch:

```bash
# Create a local branch
git checkout -b feature-new-ui

# Make some commits
git add .
git commit -m "Add UI components"

# Push to remote and create remote branch
git push -u origin feature-new-ui
```

The `-u` flag (same as `--set-upstream`) sets up tracking between your local and remote branch.

After pushing, verify the remote branch exists:

```bash
# List remote branches
git branch -r

# Output:
#   origin/main
#   origin/feature-new-ui
```

## Setting Up Branch Tracking

The `-u` flag during push sets up tracking:

```bash
# Push with tracking
git push -u origin feature-auth

# Now you can use simple commands
git push        # Pushes to origin/feature-auth
git pull        # Pulls from origin/feature-auth
```

Without tracking, you need to specify the remote and branch every time:

```bash
# Without tracking
git push origin feature-auth
git pull origin feature-auth
```

## Creating Remote Branch Without Local Commits

To create a remote branch from your current position without making new commits:

```bash
# On main branch
git checkout main

# Create and push a new branch from current HEAD
git push origin HEAD:feature-new-branch

# Or explicitly specify the branch
git push origin main:feature-new-branch
```

This creates `feature-new-branch` on the remote, pointing to the same commit as your current branch.

## Pushing an Existing Branch for the First Time

If you have a local branch with commits but have not pushed it yet:

```bash
# Check your local branches
git branch
# * feature-auth
#   main

# Push the branch to remote
git push -u origin feature-auth
```

Git creates the remote branch and sets up tracking.

## Creating Remote Branch with Different Name

To create a remote branch with a different name than your local branch:

```bash
# Local branch is 'feature', push as 'feature-auth'
git push -u origin feature:feature-auth

# Now your local 'feature' tracks remote 'feature-auth'
```

The syntax is `git push origin local-branch:remote-branch`.

## Verifying Remote Branch Creation

After pushing, confirm the branch exists remotely:

```bash
# List all remote branches
git branch -r

# Show detailed remote branch info
git remote show origin

# Output includes:
#   Remote branches:
#     main tracked
#     feature-auth tracked
```

You can also check on your Git hosting platform (GitHub, GitLab, Bitbucket) to see the branch in the UI.

## Creating Empty Remote Branch

To create a remote branch that does not yet have any new commits:

```bash
# Create local branch from current position
git checkout -b feature-placeholder

# Push immediately without new commits
git push -u origin feature-placeholder
```

This is useful for reserving a branch name or setting up a branch for someone else to work on.

## Multiple People Creating the Same Branch

If someone else already created the branch remotely:

```bash
# Try to push your branch
git push -u origin feature-auth
# error: failed to push some refs

# Fetch to see remote branches
git fetch origin

# Check out the remote branch
git checkout feature-auth
# Git automatically creates a local tracking branch

# Or explicitly
git checkout -b feature-auth origin/feature-auth
```

Git warns you if the branch already exists, preventing conflicts.

## Pushing Multiple Branches

To push several branches at once:

```bash
# Push all local branches to remote
git push --all origin

# Push all branches and tags
git push --all origin
git push --tags origin
```

Use `--all` carefully - it pushes every local branch to the remote, which might not always be desired.

## Creating Branch via Git Hosting Platforms

You can also create branches through your hosting platform's web interface:

**GitHub:**
1. Go to your repository
2. Click the branch dropdown
3. Type a new branch name
4. Click "Create branch"

**GitLab:**
1. Go to Repository > Branches
2. Click "New branch"
3. Enter branch name and source
4. Click "Create branch"

**Bitbucket:**
1. Go to Branches
2. Click "Create branch"
3. Enter name and branching point
4. Click "Create"

Then fetch the branch locally:

```bash
git fetch origin
git checkout new-branch
```

## Creating Branch from Specific Commit

To create a remote branch from a specific commit:

```bash
# Create local branch from commit hash
git checkout -b hotfix abc123

# Push to remote
git push -u origin hotfix

# Or do it in one step
git push origin abc123:refs/heads/hotfix
```

This creates a remote branch starting at that specific commit.

## Creating Branch from Tag

To create a branch based on a tag:

```bash
# Create local branch from tag
git checkout -b release-fixes v1.0.0

# Push to remote
git push -u origin release-fixes

# Or in one step
git push origin refs/tags/v1.0.0:refs/heads/release-fixes
```

## Checking Branch Push Status

To see which local branches have been pushed:

```bash
# Show local and remote branch relationships
git branch -vv

# Output:
#   feature-auth    abc123 [origin/feature-auth] Add authentication
#   feature-ui      def456 Add UI (not pushed yet)
# * main            ghi789 [origin/main] Update README
```

Branches with `[origin/branch-name]` are pushed and tracking. Branches without it exist only locally.

## Deleting Remote Branch After Creation

If you created a remote branch by mistake:

```bash
# Delete remote branch
git push origin --delete feature-wrong-name

# Or use the colon syntax
git push origin :feature-wrong-name
```

This removes the branch from the remote repository.

## Protecting Remote Branches

After creating important remote branches, protect them:

**GitHub:**
1. Go to Settings > Branches
2. Add branch protection rule
3. Configure requirements (reviews, status checks)

**GitLab:**
1. Settings > Repository > Protected branches
2. Select branch and protection level

**Bitbucket:**
1. Repository settings > Branch permissions
2. Add branch permission rule

Protection prevents accidental deletion or forced pushes.

## Common Workflows

**Feature Branch Workflow:**

```bash
# Create feature branch
git checkout -b feature-payment-gateway

# Work and commit
git add .
git commit -m "Implement payment processing"

# Push to remote for review
git push -u origin feature-payment-gateway

# Team reviews on GitHub/GitLab
# After approval, merge via pull request
```

**Hotfix Workflow:**

```bash
# Create hotfix from main
git checkout main
git pull origin main
git checkout -b hotfix-security-patch

# Fix and commit
git commit -am "Fix security vulnerability"

# Push immediately
git push -u origin hotfix-security-patch

# Deploy and merge back to main
```

## Renaming Remote Branch

Git does not have a direct rename command for remote branches:

```bash
# Create new branch with new name
git push origin old-name:new-name

# Delete old branch
git push origin --delete old-name

# Update local tracking
git branch -u origin/new-name
```

This effectively renames the remote branch.

## Syncing Remote Branches

To see which remote branches exist:

```bash
# Fetch updates from remote
git fetch origin

# List remote branches
git branch -r

# See remote branches not in local
git remote show origin
```

Fetching updates your knowledge of remote branches without modifying local branches.

## Best Practices

Use descriptive branch names:

```bash
# Good names
git push -u origin feature/user-authentication
git push -u origin bugfix/login-redirect
git push -u origin release/v2.0

# Less helpful names
git push -u origin feature1
git push -u origin fix
git push -u origin temp
```

Always use `-u` on first push:

```bash
# Good: Sets up tracking
git push -u origin feature-auth

# Works but requires specifying remote/branch later
git push origin feature-auth
```

Clean up old remote branches:

```bash
# Delete merged branches
git push origin --delete feature-completed

# Prune deleted remote branches locally
git fetch --prune
```

Coordinate with team on branch naming:

```bash
# Team conventions
git push -u origin username/feature-name
git push -u origin issue-123-fix-bug
git push -u origin feature/JIRA-456-new-api
```

Now you know how to create remote Git branches. The `git push -u origin branch-name` command is your primary tool for sharing local branches with your team, and understanding the relationship between local and remote branches helps you collaborate effectively.
