---
title: 'How do I Squash My Last N Commits Together?'
excerpt: 'Squashing commits helps you clean up your Git history by combining multiple related commits into one. Learn how to use interactive rebase to squash commits while keeping your history organized and meaningful.'
category:
  name: 'Git'
  slug: 'git'
date: '2024-12-20'
publishedAt: '2024-12-20T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Version Control
  - Rebase
  - Commit Management
  - Development
---

When you're working on a feature branch, you might end up with many small commits like "fix typo", "address PR feedback", or "WIP - testing approach". Before merging to your main branch, it's often helpful to combine these into a single, coherent commit that tells a clear story about what changed and why.

Squashing commits keeps your project history clean and makes it easier for team members to understand changes when reviewing the main branch later.

## TLDR

Use `git rebase -i HEAD~N` (where N is the number of commits you want to squash), then change `pick` to `squash` (or `s`) for the commits you want to combine. Save the file, edit the combined commit message, and use `git push --force` if you've already pushed these commits to a remote branch.

## Prerequisites

You need Git installed on your system and a repository with at least a few commits. This guide assumes you're comfortable with basic Git commands like commit and push. Make sure you're working on a feature branch - avoid squashing commits on shared branches like main or develop without coordinating with your team.

## Why Squash Commits?

When you squash commits, you're combining several commits into one. This is particularly useful when:

- You've made multiple small commits while iterating on a feature
- You want to clean up your history before merging a pull request
- You have commits that fix mistakes in earlier commits on the same branch
- You want each commit in your main branch to represent a complete, logical change

Here's what your commit history might look like before and after squashing:

```
Before squashing:
a1b2c3d Add user authentication
e4f5g6h Fix typo in login form
i7j8k9l Update validation logic
m1n2o3p Address code review feedback
p4q5r6s Fix linting errors

After squashing:
z9y8x7w Add user authentication with validation
```

## Squashing Your Last N Commits

The most common way to squash commits is using Git's interactive rebase feature. This lets you choose which commits to combine and edit the resulting commit message.

### Using Interactive Rebase

To squash your last 3 commits, run:

```bash
git rebase -i HEAD~3
```

The `HEAD~3` means "starting from the current commit (HEAD), go back 3 commits". Replace `3` with however many commits you want to squash.

This opens your default text editor with something like:

```
pick a1b2c3d Add user authentication
pick e4f5g6h Fix typo in login form
pick i7j8k9l Update validation logic

# Rebase m1n2o3p..i7j8k9l onto m1n2o3p (3 commands)
#
# Commands:
# p, pick = use commit
# r, reword = use commit, but edit the commit message
# e, edit = use commit, but stop for amending
# s, squash = use commit, but meld into previous commit
# f, fixup = like "squash", but discard this commit's log message
```

To squash all three commits into one, change it to:

```
pick a1b2c3d Add user authentication
squash e4f5g6h Fix typo in login form
squash i7j8k9l Update validation logic
```

Or use the shorthand `s` instead of `squash`:

```
pick a1b2c3d Add user authentication
s e4f5g6h Fix typo in login form
s i7j8k9l Update validation logic
```

Save and close the editor. Git will then open another editor window where you can write the combined commit message. You'll see all the original commit messages - you can delete them and write a single, clear message that describes what the combined commit accomplishes:

```
Add user authentication with validation

Implemented login and registration forms with client-side validation.
Added password strength requirements and email verification.
```

After saving this message, Git completes the rebase and your commits are now squashed into one.

## Understanding Pick, Squash, and Fixup

When you run interactive rebase, you have several options for each commit:

### pick

Use the commit as-is without any changes:

```
pick a1b2c3d Add user authentication
pick e4f5g6h Add password reset feature
```

This keeps both commits separate in your history.

### squash

Combine the commit with the previous one and let you edit the combined message:

```
pick a1b2c3d Add user authentication
squash e4f5g6h Fix typo in login form
```

This merges the second commit into the first, and you'll be prompted to write a new commit message that can incorporate messages from both commits.

### fixup

Like squash, but automatically discard the commit message of the fixup commit:

```
pick a1b2c3d Add user authentication
fixup e4f5g6h Fix typo in login form
```

This is useful when you have commits that are just fixes or small tweaks - you probably don't need "Fix typo" in your final commit message. The fixup commit disappears, and only the first commit's message remains.

## Squashing All Commits in a Feature Branch

When you want to squash all commits in your feature branch into a single commit, you can use the merge base as your rebase point:

```bash
# Find where your branch diverged from main
git merge-base main HEAD

# Use that commit hash for rebase
git rebase -i <commit-hash>
```

Or use this shorthand:

```bash
git rebase -i $(git merge-base main HEAD)
```

This shows all commits that are unique to your feature branch. Pick the first one and squash all the others:

```
pick a1b2c3d First commit in feature branch
squash e4f5g6h Second commit
squash i7j8k9l Third commit
squash m1n2o3p Fourth commit
```

## Squashing After You've Already Pushed

If you've already pushed your commits to a remote branch, squashing will rewrite history. After you squash, you'll need to force push:

```bash
# Squash your commits using rebase
git rebase -i HEAD~3

# Force push to update the remote branch
git push --force origin feature-branch-name
```

**Important consideration**: Force pushing rewrites history on the remote. This is fine for feature branches that only you are working on, but be careful with shared branches. If others have pulled your branch and are working on it, force pushing can cause problems for them.

A safer alternative when others might be affected is:

```bash
# Use force-with-lease instead
git push --force-with-lease origin feature-branch-name
```

The `--force-with-lease` flag only pushes if no one else has pushed commits to that branch since you last pulled. This prevents you from accidentally overwriting someone else's work.

## Squashing Without Interactive Rebase

If you want to squash all commits in your current branch into one and you know exactly what you're doing, you can use a soft reset:

```bash
# Reset to the commit where your branch started
git reset --soft $(git merge-base main HEAD)

# All changes are now staged, create a new commit
git commit -m "Add complete user authentication feature"
```

This approach:
1. Keeps all your changes but removes the commits
2. Stages all changes from those removed commits
3. Lets you create a single new commit with all the changes

This is faster than interactive rebase when you know you want everything in one commit, but you lose the chance to review each commit during the process.

## Handling Conflicts During Rebase

Sometimes you'll encounter conflicts while squashing commits, especially if you've modified the same parts of files multiple times:

```bash
Auto-merging src/auth.js
CONFLICT (content): Merge conflict in src/auth.js
error: could not apply e4f5g6h... Fix typo in login form
```

When this happens:

1. Open the conflicted files and resolve the conflicts manually
2. Stage the resolved files with `git add`
3. Continue the rebase:

```bash
# After resolving conflicts
git add src/auth.js
git rebase --continue
```

If you want to abort the rebase and go back to where you started:

```bash
git rebase --abort
```

## Verifying Your Squashed Commits

After squashing, verify that everything looks correct:

```bash
# View your new commit history
git log --oneline -5

# See what changed in the squashed commit
git show HEAD

# Compare with the remote branch (before force pushing)
git log --oneline origin/feature-branch..HEAD
```

Make sure the code changes are all there and the commit message accurately describes what changed.

## Best Practices for Squashing

Keep these guidelines in mind when squashing commits:

**Squash on feature branches, not main**: Only squash commits on branches you control. Don't squash commits that have been merged to main or other shared branches.

**Squash before merging**: Clean up your feature branch commits before creating a pull request or before merging to main. This gives reviewers a cleaner history to understand.

**Keep logical groupings**: Don't squash everything into one commit if your branch includes multiple distinct features. Each significant feature or change should have its own commit.

**Write meaningful commit messages**: After squashing, take time to write a clear commit message that explains what changed and why, not just a list of what you did.

**Coordinate with your team**: If others are working on the same branch, coordinate before squashing and force pushing. Consider squashing only when you're the sole contributor to a branch.

## Common Scenarios

### Squashing "WIP" commits

When you've made several "work in progress" commits:

```bash
git rebase -i HEAD~5
```

Pick the first real commit and squash all the WIP commits into it.

### Cleaning up before a pull request

Before submitting your PR:

```bash
# Squash all commits since branching from main
git rebase -i $(git merge-base main HEAD)

# Force push to your feature branch
git push --force-with-lease origin feature-branch
```

### Fixing mistakes in commit messages

If you have good commits but poor messages:

```bash
git rebase -i HEAD~3
```

Use `reword` instead of `squash` to keep commits separate but fix their messages.

Squashing commits is a powerful way to maintain a clean, readable Git history. Use it to combine related changes, remove noise from your commit log, and make your project's evolution easier to understand. Just remember to only squash on branches you control and coordinate with your team when working on shared branches.
