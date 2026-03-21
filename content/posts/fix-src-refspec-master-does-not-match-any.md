---
title: 'How to Fix src refspec master does not match any Error in Git'
excerpt: 'Getting the src refspec master does not match any error when pushing? Learn what causes this Git error and how to fix it in different scenarios.'
category:
  name: 'Git'
  slug: 'git'
date: '2024-12-05'
publishedAt: '2024-12-05T13:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Troubleshooting
  - Error Fixing
  - Version Control
  - Push
---

You try to push to a Git repository and get the error "src refspec master does not match any". This cryptic message appears when Git cannot find the branch you're trying to push, and it's one of the most common errors developers encounter when setting up new repositories.

**TLDR:** This error usually means either you have not made any commits yet, you're pushing a branch that does not exist, or your default branch is named "main" instead of "master". Fix it by making an initial commit, pushing to the correct branch name, or checking which branches exist with `git branch -a`.

In this guide, you'll learn why this error occurs and how to fix it in different scenarios.

## Prerequisites

You'll need Git installed and a repository you're trying to push to. Basic familiarity with Git commands like commit and push will help you understand the solutions.

## Understanding the Error

The error "src refspec master does not match any" means Git is looking for a branch called "master" but cannot find it. The term "refspec" refers to the reference specification - in this case, the branch name you're trying to push.

When you run a command like:

```bash
git push origin master
```

Git breaks this down as:
- `push` - send commits to a remote repository
- `origin` - the remote repository name
- `master` - the source branch to push

If the "master" branch does not exist locally, you get this error.

## Cause 1: No Initial Commit

The most common cause is trying to push before making any commits. When you initialize a repository with `git init`, Git does not create any branches until you make the first commit.

Check if you have any commits:

```bash
# View commit history
git log

# If you see "fatal: your current branch 'master' does not have any commits yet"
# or "does not have any commits yet", you need to make an initial commit
```

Make your first commit:

```bash
# Stage files
git add .

# Create initial commit
git commit -m "Initial commit"

# Now push will work
git push origin master
```

After the first commit, Git creates the branch and you can push it successfully.

## Cause 2: Default Branch Named main Instead of master

Many Git hosting services (GitHub, GitLab, Bitbucket) changed their default branch name from "master" to "main". If you initialized your repository recently, it might use "main":

```bash
# Check which branch you're on
git branch

# Output might show:
# * main
```

If your local branch is "main" but you're trying to push "master", you'll get the error. Push to the correct branch:

```bash
# Push to main instead
git push origin main

# Or push and set upstream
git push -u origin main
```

To see all your local branches:

```bash
# List local branches
git branch -a
```

The asterisk shows your current branch. Push to that branch name, not "master".

## Cause 3: Typo in Branch Name

If you mistype the branch name, Git cannot find it:

```bash
# This fails if your branch is actually "master" (with correct spelling)
git push origin maste

# Error: src refspec maste does not match any
```

Double-check the branch name:

```bash
# See exact branch name
git branch --show-current

# Use that exact name when pushing
git push origin $(git branch --show-current)
```

This approach avoids typos by using the actual current branch name.

## Cause 4: Pushing a Non-Existent Branch

You might be trying to push a branch that does not exist locally:

```bash
# Check which branches exist
git branch -a

# Output:
# * main
#   feature-auth
#   remotes/origin/main
```

If "master" is not in the list, you cannot push it. Either switch to a branch that exists:

```bash
# Switch to main
git checkout main

# Push it
git push origin main
```

Or create the "master" branch first:

```bash
# Create master branch from current commit
git checkout -b master

# Push the new branch
git push origin master
```

## Cause 5: Staging Area is Empty

Even if you have commits, the error can occur if you try to push with no staged changes and no commits on the branch:

```bash
# Check if anything is staged
git status

# If output shows "nothing to commit", stage your changes
git add .

# Create a commit
git commit -m "Add project files"

# Now push
git push origin master
```

The workflow should always be: modify files, stage with `git add`, commit with `git commit`, then push.

## Renaming Your Branch to Match Remote

If your remote uses "master" but your local branch is "main", rename it:

```bash
# Rename current branch to master
git branch -m main master

# Push to master
git push origin master

# Set upstream tracking
git push -u origin master
```

The `-m` flag renames the branch. After renaming, your local branch matches what the remote expects.

Alternatively, rename the remote's default branch (if you have admin access):

```bash
# On GitHub, GitLab, etc., go to repository settings
# Change default branch from "master" to "main"

# Then push your main branch
git push origin main
```

## Checking Remote Configuration

Sometimes the error occurs because the remote is not configured correctly:

```bash
# View remote configuration
git remote -v

# Output should show:
# origin  https://github.com/username/repo.git (fetch)
# origin  https://github.com/username/repo.git (push)
```

If there's no remote configured:

```bash
# Add the remote
git remote add origin https://github.com/username/repo.git

# Verify it was added
git remote -v

# Now push
git push -u origin main
```

The `-u` flag sets the upstream tracking relationship, so future pushes work with just `git push`.

## Handling Bare Repositories

If you're pushing to a bare repository (common on servers), make sure it's initialized:

```bash
# On the server, initialize bare repository
git init --bare /path/to/repo.git

# On your local machine
git remote add origin user@server:/path/to/repo.git
git push -u origin master
```

Bare repositories need to exist before you can push to them.

## Using Correct Push Syntax

Make sure you're using the right push syntax:

```bash
# Correct syntax
git push <remote> <branch>

# Examples:
git push origin main
git push origin feature-auth

# To push and set upstream
git push -u origin main

# To push current branch
git push origin HEAD
```

The `HEAD` reference means "whatever branch I'm currently on", which avoids having to specify the branch name.

## Creating the Default Branch

If you want to explicitly create a "master" branch in a new repository:

```bash
# Initialize repository
git init

# Create initial commit
echo "# Project" > README.md
git add README.md
git commit -m "Initial commit"

# You're now on master (or main, depending on Git version)
git branch

# If on main but want master, rename it
git branch -m main master

# Push to remote
git push -u origin master
```

## Changing Default Branch Name in Git Configuration

To set "main" as the default branch name for all new repositories:

```bash
# Set default branch name globally
git config --global init.defaultBranch main

# New repositories will use "main" instead of "master"
git init new-project
cd new-project
git branch
# Output: No branches yet, but first commit will create "main"
```

This aligns your Git configuration with modern hosting services.

## Debugging with Verbose Output

If you're still stuck, use verbose mode to see what Git is doing:

```bash
# Push with verbose output
GIT_TRACE=1 git push origin master

# Or use the verbose flag
git push -v origin master
```

The verbose output shows exactly what Git is trying to do and where it fails, helping you identify the problem.

## Quick Checklist

When you encounter this error, check:

1. Have you made any commits? (`git log`)
2. Does the branch exist? (`git branch`)
3. Is the branch name correct? (main vs master)
4. Is the remote configured? (`git remote -v`)
5. Are files staged and committed? (`git status`)

Going through this checklist usually reveals the issue quickly.

Now you know how to fix the "src refspec master does not match any" error. The key is understanding that Git needs a branch with commits before you can push it, and that the branch name you specify must exactly match an existing local branch. When in doubt, check your current branch with `git branch` and push that instead of assuming the name.
