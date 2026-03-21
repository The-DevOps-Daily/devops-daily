---
title: 'What Does Cherry-Picking a Commit Mean in Git?'
excerpt: 'Need to apply a specific commit from one branch to another? Learn how to use git cherry-pick to selectively copy commits without merging entire branches.'
category:
  name: 'Git'
  slug: 'git'
date: '2024-10-05'
publishedAt: '2024-10-05T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Cherry-pick
  - Version Control
  - Commits
  - Branches
---

You made a bug fix on the wrong branch, or you need a specific feature from one branch in another without merging everything. Cherry-picking lets you copy individual commits from one branch to another.

**TLDR:** Cherry-picking applies a specific commit from one branch onto another branch. Use `git cherry-pick commit-hash` to copy a commit to your current branch. This creates a new commit with the same changes but a different commit hash. It's useful for applying hotfixes or specific features across branches without merging.

In this guide, you'll learn how to cherry-pick commits and handle common scenarios.

## Prerequisites

You'll need Git installed on your system and a repository with multiple branches and commits. Basic familiarity with Git branches and commit hashes will be helpful.

## Understanding Cherry-Pick

Cherry-picking copies a commit from one branch to another:

```
Branch A:  A---B---C---D---E
                   ^
                   |
Branch B:  X---Y---Z---C'
                       ^
                       cherry-picked commit
```

The commit `C` from Branch A is copied to Branch B as `C'`. The changes are the same, but `C'` is a new commit with a different hash.

## Basic Cherry-Pick

To cherry-pick a single commit:

```bash
# Switch to the branch where you want the commit
git checkout main

# Cherry-pick the commit
git cherry-pick abc123

# Git applies the changes and creates a new commit
```

Replace `abc123` with the actual commit hash you want to cherry-pick.

## Finding the Commit to Cherry-Pick

First, identify the commit you want:

```bash
# View commits on another branch
git log feature-branch --oneline

# Output:
# abc123 Fix authentication bug
# def456 Add user profile
# ghi789 Update dependencies

# Cherry-pick the bug fix
git cherry-pick abc123
```

You can also use `git log --graph --all --oneline` to see commits across all branches.

## Cherry-Picking Multiple Commits

To cherry-pick several commits in order:

```bash
# Cherry-pick commits abc123, def456, and ghi789
git cherry-pick abc123 def456 ghi789

# Or use a range (commits between abc123 and ghi789)
git cherry-pick abc123..ghi789

# Exclusive range (does not include abc123)
git cherry-pick abc123^..ghi789
```

The range syntax applies all commits in sequence from oldest to newest.

## Cherry-Picking Without Committing

To apply changes without immediately committing:

```bash
# Apply changes but don't commit
git cherry-pick -n abc123

# Or use --no-commit
git cherry-pick --no-commit abc123

# Review changes
git status
git diff --staged

# Then commit when ready
git commit -m "Cherry-pick: Fix authentication bug"
```

This lets you modify the changes before committing.

## Handling Cherry-Pick Conflicts

If the commit conflicts with your current branch:

```bash
# Start cherry-pick
git cherry-pick abc123

# Conflict occurs
# CONFLICT (content): Merge conflict in src/auth.js
# error: could not apply abc123... Fix authentication bug

# Resolve conflicts in your editor
nano src/auth.js

# Stage resolved files
git add src/auth.js

# Continue cherry-pick
git cherry-pick --continue

# Or abort if you change your mind
git cherry-pick --abort
```

Conflicts happen when the same lines were modified differently in both branches.

## Cherry-Picking with Custom Commit Message

To change the commit message when cherry-picking:

```bash
# Cherry-pick and edit commit message
git cherry-pick -e abc123

# Or use --edit
git cherry-pick --edit abc123

# Git opens editor to modify the message
```

This is useful when you want to add context about why the commit was cherry-picked.

## Cherry-Picking from Another Repository

To cherry-pick commits from a different repository:

```bash
# Add the other repository as a remote
git remote add other-repo https://github.com/user/other-repo.git

# Fetch commits
git fetch other-repo

# Cherry-pick from the remote
git cherry-pick other-repo/main~3

# Or using commit hash from that repo
git cherry-pick abc123
```

The commit must be available in your local Git object database after fetching.

## Signing Cherry-Picked Commits

To sign cherry-picked commits:

```bash
# Cherry-pick with GPG signature
git cherry-pick -S abc123

# Or use --gpg-sign
git cherry-pick --gpg-sign abc123
```

This maintains security and attribution for cherry-picked commits.

## Preserving Original Author Information

By default, cherry-pick preserves the original author but updates the committer:

```bash
# Original commit
# Author: Jane Developer
# Committer: Jane Developer

# After cherry-pick
# Author: Jane Developer (preserved)
# Committer: You (updated)
```

To see this information:

```bash
git log --format="%h %an %cn %s"
```

## Cherry-Picking Merge Commits

Merge commits have multiple parents. You must specify which parent to use:

```bash
# Cherry-pick a merge commit (use parent 1)
git cherry-pick -m 1 abc123

# Or use parent 2
git cherry-pick -m 2 abc123
```

Parent 1 is usually the branch you merged into, and parent 2 is the branch you merged from.

## Common Use Cases

**Applying a hotfix to multiple branches:**

```bash
# Fix made on develop
git checkout develop
git commit -m "Fix critical security bug"
# Commit: abc123

# Apply to release branch
git checkout release-1.0
git cherry-pick abc123

# Apply to main
git checkout main
git cherry-pick abc123
```

**Moving a commit to the correct branch:**

```bash
# Accidentally committed to main
git log --oneline -1
# abc123 Add new feature

# Cherry-pick to feature branch
git checkout feature-branch
git cherry-pick abc123

# Remove from main
git checkout main
git reset --hard HEAD~1
```

**Pulling a specific feature without merging:**

```bash
# feature-branch has multiple commits
# You only want one specific feature

git checkout main
git cherry-pick def456  # Just the feature you want
```

## Cherry-Pick vs Merge

Understand when to use each:

```bash
# Cherry-pick: Copy specific commits
git cherry-pick abc123
# - Copies individual commits
# - Creates new commit hashes
# - Doesn't preserve branch history

# Merge: Combine branches
git merge feature-branch
# - Merges all commits
# - Preserves original commits
# - Maintains branch history
```

Use cherry-pick for selective changes, merge for complete branch integration.

## Avoiding Duplicate Commits

Cherry-picking creates duplicates - the same changes exist in two commits:

```
feature:  A---B---C
               |
main:    X---Y---B'---C'
```

Commits `B'` and `C'` are duplicates of `B` and `C`. If you later merge `feature` into `main`, Git handles this by recognizing the duplicate changes.

## Tracking Cherry-Picked Commits

To note that a commit was cherry-picked:

```bash
# Cherry-pick with reference to original
git cherry-pick -x abc123

# Adds to commit message:
# (cherry picked from commit abc123)
```

This helps track the origin of cherry-picked commits.

## Cherry-Picking and Continuing Work

After cherry-picking, you can continue working:

```bash
# Cherry-pick the commit
git cherry-pick abc123

# Make additional changes
nano src/auth.js

# Amend the cherry-picked commit
git add src/auth.js
git commit --amend

# Or create a new commit
git commit -m "Adjust cherry-picked changes for this branch"
```

## Undoing a Cherry-Pick

If you cherry-picked the wrong commit:

```bash
# Immediately after cherry-pick
git reset --hard HEAD~1

# Or using reflog if you made more commits
git reflog
git reset --hard HEAD@{1}
```

## Cherry-Picking in Scripts

Automate cherry-picking in release scripts:

```bash
#!/bin/bash
# Cherry-pick bug fixes to release branch

FIXES=(abc123 def456 ghi789)

git checkout release-1.0

for commit in "${FIXES[@]}"; do
  echo "Cherry-picking $commit"
  git cherry-pick "$commit" || {
    echo "Conflict on $commit - resolve manually"
    exit 1
  }
done

echo "All fixes applied"
```

## Best Practices

Use cherry-pick sparingly:

```bash
# Good: Backporting critical fixes
git cherry-pick hotfix-commit

# Less ideal: Cherry-picking many commits
# Consider merging instead
```

Always cherry-pick from older branches to newer:

```bash
# Good flow
develop → staging → production

# Bad flow
production → develop (merging back is better)
```

Document why you cherry-picked:

```bash
# Include context in commit message
git cherry-pick -e abc123
# Message: "Cherry-pick: Fix auth bug for v1.0 release
#           Original fix was in v2.0 development"
```

Test after cherry-picking:

```bash
git cherry-pick abc123
# Run tests
npm test
# Verify changes work in this context
```

Communicate with team:

```bash
# When cherry-picking shared commits
# Tell team members to avoid confusion
"Applied auth fix from develop to release-1.0 via cherry-pick"
```

## Alternative: Creating Patches

For more control, use patches:

```bash
# Create patch from commit
git format-patch -1 abc123

# Apply patch
git apply 0001-fix-auth-bug.patch

# Or apply as commit
git am 0001-fix-auth-bug.patch
```

Patches give you more flexibility to review and modify changes before applying.

## Cherry-Picking with Specific Files

To cherry-pick only specific files from a commit:

```bash
# Show files in commit
git show --name-only abc123

# Checkout specific files from that commit
git checkout abc123 -- src/auth.js

# Commit the change
git add src/auth.js
git commit -m "Cherry-pick auth.js from abc123"
```

This gives you file-level granularity.

Now you know what cherry-picking means in Git and how to use it effectively. Cherry-pick is a tool for selectively applying commits across branches, useful for backporting fixes or moving commits between branches without merging entire histories.
