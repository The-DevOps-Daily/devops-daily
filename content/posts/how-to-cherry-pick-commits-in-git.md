---
title: 'How to Cherry Pick Commits in Git'
excerpt: 'Learn how to selectively apply specific commits from one branch to another using git cherry-pick. Learn single and multiple commit cherry-picking with conflict resolution strategies.'
category:
  name: 'Git'
  slug: 'git'
date: '2024-12-02'
publishedAt: '2024-12-02T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Version Control
  - Cherry Pick
  - Development
  - Branch Management
---

You've implemented a critical bug fix on a feature branch, but you need that same fix on your production branch without merging the entire feature. Or perhaps you want to apply a specific commit from another developer's branch to your current work. Git cherry-pick allows you to selectively apply individual commits from one branch to another.

In this guide, you'll learn how to use cherry-pick effectively to move specific changes between branches while maintaining clean commit history.

## Prerequisites

You need Git installed on your system and a basic understanding of Git branches and commits. You should be working in a repository with multiple branches and commit history. Familiarity with merge conflicts resolution will help when dealing with cherry-pick conflicts.

## Understanding Cherry-Pick

Cherry-pick creates a new commit on your current branch with the same changes as an existing commit from another branch. Unlike merging, which brings all commits from a branch, cherry-pick lets you select individual commits.

The new commit will have:

- Same code changes as the original
- Different commit hash
- Same author but different committer (you)
- Current timestamp

## Basic Cherry-Pick Operations

### Cherry-Picking a Single Commit

To cherry-pick a specific commit to your current branch:

```bash
# First, identify the commit hash you want to cherry-pick
git log --oneline other-branch

# Cherry-pick the specific commit
git cherry-pick a1b2c3d

# Check the result
git log --oneline -3
```

The commit hash `a1b2c3d` represents the commit you want to apply. Git will create a new commit on your current branch with the same changes.

### Cherry-Picking from Another Branch

Here's a complete workflow for cherry-picking between branches:

```bash
# Switch to the target branch (where you want to apply the commit)
git checkout main

# Ensure the branch is up to date
git pull origin main

# Cherry-pick the commit from feature branch
git cherry-pick feature-branch~2

# Or use the specific commit hash
git cherry-pick 1a2b3c4d
```

After cherry-picking, you'll see a new commit on your current branch that contains the changes from the selected commit.

## Advanced Cherry-Pick Techniques

### Cherry-Picking Multiple Commits

You can cherry-pick several commits at once:

```bash
# Cherry-pick a range of commits
git cherry-pick a1b2c3d..e4f5g6h

# Cherry-pick multiple specific commits
git cherry-pick a1b2c3d e4f5g6h i7j8k9l

# Cherry-pick commits in order
git cherry-pick feature-branch~5 feature-branch~3 feature-branch~1
```

When cherry-picking multiple commits, Git applies them in the order you specify, creating separate commits for each.

### Cherry-Pick with Custom Commit Message

Modify the commit message during cherry-pick:

```bash
# Cherry-pick and edit the commit message
git cherry-pick -e a1b2c3d

# Cherry-pick without committing (stage changes only)
git cherry-pick -n a1b2c3d

# Add your own commit message after reviewing staged changes
git commit -m "Apply bug fix from feature branch"
```

The `-e` flag opens your editor to modify the commit message, while `-n` (or `--no-commit`) stages the changes without creating a commit, giving you control over the final commit.

## Handling Cherry-Pick Conflicts

When cherry-picking creates conflicts, Git pauses the operation for you to resolve them:

```bash
# When conflicts occur during cherry-pick
git cherry-pick a1b2c3d
# Git outputs: "error: could not apply a1b2c3d... commit message"

# Check which files have conflicts
git status

# View the conflicts
git diff

# Resolve conflicts in your editor, then stage the resolved files
git add resolved-file.js

# Continue the cherry-pick operation
git cherry-pick --continue
```

If you decide to abort the cherry-pick operation:

```bash
# Abort cherry-pick and return to previous state
git cherry-pick --abort

# This undoes any changes made by the cherry-pick attempt
```

## Cherry-Pick Strategies for Different Scenarios

### Applying Hot Fixes

When you need to apply a critical fix across multiple branches:

```bash
# You're on main branch with a critical fix
git checkout hotfix-branch
git commit -m "Fix critical security vulnerability"

# Apply the fix to production branch
git checkout production
git cherry-pick hotfix-branch

# Apply the fix to development branch
git checkout develop
git cherry-pick hotfix-branch

# Now the fix exists on all necessary branches
```

### Selective Feature Integration

When you want specific features from a branch without the entire branch:

```bash
# Feature branch has 5 commits, you want only 2 of them
git checkout main

# Cherry-pick only the commits you need
git cherry-pick feature-branch~4  # Specific feature implementation
git cherry-pick feature-branch~1  # Bug fix for that feature

# Skip commits you don't want (feature-branch~3, ~2, ~0)
```

### Cross-Repository Cherry-Pick

Cherry-pick commits from another repository:

```bash
# Add the other repository as a remote
git remote add other-repo https://github.com/user/other-repo.git

# Fetch commits from the other repository
git fetch other-repo

# Cherry-pick a commit from the other repository
git cherry-pick other-repo/main~3

# Remove the remote if no longer needed
git remote remove other-repo
```

## Cherry-Pick Best Practices

### Verify Before Cherry-Picking

Always review what you're about to cherry-pick:

```bash
# View the commit details before cherry-picking
git show a1b2c3d

# Check what files the commit modifies
git show --name-only a1b2c3d

# See the changes in the commit
git show --stat a1b2c3d
```

### Maintain Commit References

Keep track of cherry-picked commits for future reference:

```bash
# Include reference to original commit in cherry-pick message
git cherry-pick -e a1b2c3d
# In the editor, add: "(cherry picked from commit a1b2c3d)"

# Or use the -x flag to automatically add the reference
git cherry-pick -x a1b2c3d
```

The `-x` flag automatically appends "(cherry picked from commit hash)" to the commit message, making it easy to track the relationship between commits.

### Test After Cherry-Picking

Always test the cherry-picked changes:

```bash
# After cherry-picking, run your tests
git cherry-pick a1b2c3d

# Run tests to ensure the change works in the new context
npm test  # or your test command

# If tests fail, you may need to make additional adjustments
```

## Common Cherry-Pick Scenarios

### Emergency Production Fixes

When a critical fix needs to go to production immediately:

```bash
# Create and checkout a hotfix branch from production
git checkout production
git checkout -b hotfix/critical-bug

# Make the fix and commit
git add .
git commit -m "Fix critical production bug"

# Cherry-pick to production
git checkout production
git cherry-pick hotfix/critical-bug

# Deploy to production, then cherry-pick to main
git checkout main
git cherry-pick hotfix/critical-bug
```

### Backporting Features

Apply features to older release branches:

```bash
# New feature committed to main
git checkout main
git log --oneline -5  # Find the feature commit

# Backport to release branch
git checkout release/v1.2
git cherry-pick main~2  # The feature commit

# Handle any conflicts due to code differences
# Test thoroughly as the context may be different
```

### Collaborative Development

Incorporating changes from team members:

```bash
# Team member has a useful commit on their branch
git fetch origin
git log --oneline origin/teammate-feature

# Cherry-pick their specific improvement
git cherry-pick origin/teammate-feature~1

# Credit the original author (Git preserves authorship automatically)
```

## Avoiding Cherry-Pick Pitfalls

### Don't Cherry-Pick Merge Commits

Merge commits have multiple parents and can cause confusion:

```bash
# Avoid cherry-picking merge commits
git log --merges  # Shows merge commits

# If you must, specify which parent to follow
git cherry-pick -m 1 merge-commit-hash
```

### Be Careful with Dependencies

Ensure cherry-picked commits don't depend on other uncommitted changes:

```bash
# Before cherry-picking, check if the commit depends on others
git show a1b2c3d  # Review the changes

# If the commit references code that doesn't exist in target branch,
# you may need to cherry-pick dependencies first
```

### Communicate with Your Team

When cherry-picking in shared repositories:

```bash
# Document why you cherry-picked instead of merging
git commit --amend -m "Fix bug XYZ (cherry-picked from feature-branch for urgent release)"

# Consider creating a tracking issue or PR comment
# explaining the cherry-pick decision
```

## Alternative Approaches

### When Not to Use Cherry-Pick

Consider alternatives in these situations:

```bash
# Instead of cherry-picking many commits, consider merging
git merge feature-branch

# Instead of cherry-picking back and forth, consider rebasing
git rebase main feature-branch

# For code sharing, consider creating a shared library or module
```

Now you understand how to effectively use cherry-pick to selectively apply commits across branches. Remember that cherry-pick creates new commits, so use it thoughtfully in shared repositories and always test the results in their new context.
