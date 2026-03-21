---
title: 'How to Modify Existing, Unpushed Commit Messages'
excerpt: 'Learn how to change commit messages for unpushed commits using git commit --amend and interactive rebase. Learn message editing techniques for clean Git history.'
category:
  name: 'Git'
  slug: 'git'
date: '2024-12-04'
publishedAt: '2024-12-04T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Version Control
  - Commit Messages
  - Development
  - Best Practices
---

You've made a commit with a typo in the message, or you realize the commit message doesn't accurately describe what you changed. Before pushing your commits to a shared repository, you can easily modify commit messages to maintain clean, meaningful Git history.

In this guide, you'll learn different methods to edit commit messages for unpushed commits, from simple single-commit changes to complex multi-commit message updates.

## Prerequisites

You need Git installed on your system and basic knowledge of Git commits and command-line text editors. Make sure you're working with commits that haven't been pushed to a shared repository, as modifying pushed commit messages can cause issues for collaborators.

## Understanding Commit Message Modification

When you modify commit messages, Git creates new commits with different hashes, effectively rewriting history. This is safe for local, unpushed commits but should be avoided for commits that others have already pulled from shared repositories.

The key principle is: only modify commit messages for commits that exist solely in your local repository.

## Modifying the Most Recent Commit Message

### Using git commit --amend

The simplest way to change your last commit message:

```bash
# Change the most recent commit message
git commit --amend -m "Corrected commit message"

# Or open editor to modify the message interactively
git commit --amend
```

When you run `git commit --amend` without the `-m` flag, Git opens your default editor with the current commit message, allowing you to modify it:

```
Fix user authentication bug

# Please enter the commit message for your changes. Lines starting
# with '#' will be ignored, and an empty message aborts the commit.
#
# Date:      Thu Dec 4 10:00:00 2024 -0500
#
# On branch feature-login
# Changes to be committed:
#   modified:   src/auth.js
```

Edit the message, save, and close the editor to apply the change.

### Amending Without Changing Files

If you only want to change the message without modifying any files:

```bash
# Just change the message, don't stage new changes
git commit --amend --no-edit -m "New message"

# Or use the editor without staging changes
git commit --amend --only
```

This ensures that only the message changes, without accidentally including new modifications from your working directory.

## Modifying Multiple Commit Messages

### Using Interactive Rebase

To change messages for multiple commits, use interactive rebase:

```bash
# Edit commit messages for the last 3 commits
git rebase -i HEAD~3

# Edit messages for commits since a specific commit
git rebase -i abc123d

# Edit messages for all commits on current branch
git rebase -i main
```

This opens an editor showing your commits:

```
pick a1b2c3d Add user login functionality
pick e4f5g6h Fix password validation
pick i7j8k9l Update login form styling

# Rebase commands:
# p, pick = use commit
# r, reword = use commit, but edit the commit message
# e, edit = use commit, but stop for amending
# s, squash = use commit, but meld into previous commit
# d, drop = remove commit
```

To modify commit messages, change `pick` to `reword` (or `r`):

```
pick a1b2c3d Add user login functionality
reword e4f5g6h Fix password validation
reword i7j8k9l Update login form styling
```

Save and close the editor. Git will then open your editor for each commit marked with `reword`, allowing you to modify each message individually.

### Selective Message Editing

You can be selective about which commits to modify:

```
pick a1b2c3d Add user login functionality
reword e4f5g6h Fix password validation  # Will edit this message
pick i7j8k9l Update login form styling   # Will keep this message
```

This approach lets you fix only the commit messages that need changes while leaving good messages untouched.

## Advanced Message Modification Techniques

### Using git filter-branch for Bulk Changes

For changing messages across many commits with a pattern:

```bash
# Change all commits containing "WIP" to "Work in progress"
git filter-branch --msg-filter 'sed "s/WIP/Work in progress/g"'

# Change author name in all commit messages
git filter-branch --msg-filter 'sed "s/oldname/newname/g"'
```

**Warning**: `git filter-branch` is a powerful tool that rewrites history extensively. Use it carefully and ensure you have backups.

### Combining Commits and Changing Messages

During interactive rebase, you can both combine commits and change their messages:

```
pick a1b2c3d Add user login functionality
squash e4f5g6h Fix password validation     # Combine with previous
squash i7j8k9l Update login form styling   # Combine with previous
```

This squashes the three commits into one and allows you to write a new combined commit message:

```
Add complete user login functionality

- Implement login form with validation
- Add password validation logic
- Style login form for better UX
```

### Reordering Commits While Changing Messages

You can also reorder commits during the rebase:

```
reword i7j8k9l Update login form styling   # Move this first
pick a1b2c3d Add user login functionality
reword e4f5g6h Fix password validation
```

This changes both the order and messages of your commits.

## Best Practices for Commit Messages

### Writing Clear Commit Messages

When modifying messages, follow these conventions:

```bash
# Good commit messages
git commit --amend -m "Fix user authentication timeout issue"
git commit --amend -m "Add validation for email input field"
git commit --amend -m "Refactor database connection handling"

# Avoid vague messages
git commit --amend -m "Fix stuff"
git commit --amend -m "Updates"
git commit --amend -m "WIP"
```

### Using Conventional Commit Format

Consider using conventional commit format for consistency:

```bash
# Conventional commit examples
git commit --amend -m "feat: add user registration form"
git commit --amend -m "fix: resolve memory leak in image processing"
git commit --amend -m "docs: update API documentation for auth endpoints"
git commit --amend -m "refactor: simplify user validation logic"
```

This format makes it easier to generate changelogs and understand commit purposes.

## Handling Specific Scenarios

### Fixing Typos in Recent Messages

For simple typos in the last commit:

```bash
# Quick fix for the last commit
git commit --amend -m "Fix typo: implement user authentication properly"

# Or use the editor to carefully review the message
git commit --amend
```

### Improving Message Clarity

When you realize a commit message isn't descriptive enough:

```bash
# Before: vague message
git log --oneline -1
# a1b2c3d Update code

# After: descriptive message
git commit --amend -m "Optimize database queries for user search functionality

- Add indexes to frequently queried columns
- Implement query result caching
- Reduce average search time from 2s to 200ms"
```

### Standardizing Message Format

When working on a team with message conventions:

```bash
# Standardize format across commits
git rebase -i HEAD~5

# Change messages to match team conventions:
# "FEAT-123: Add user authentication"
# "BUG-456: Fix password validation error"
# "DOCS-789: Update API documentation"
```

## Safety Considerations

### Checking Commit Status

Before modifying messages, verify commits haven't been pushed:

```bash
# Check if commits exist on remote
git log origin/main..HEAD --oneline

# If this shows commits, they're local and safe to modify
# If empty, commits have been pushed - be cautious
```

### Creating Backup Branches

Always create a backup before major message modifications:

```bash
# Create backup branch
git branch backup-before-rebase

# Perform your message modifications
git rebase -i HEAD~5

# If something goes wrong, restore from backup
git checkout backup-before-rebase
```

### Verifying Changes

After modifying messages, verify the results:

```bash
# Check the new commit history
git log --oneline -5

# Verify commit content hasn't changed
git show HEAD
git show HEAD~1

# Ensure working directory is clean
git status
```

## Recovery from Mistakes

If you make mistakes during message modification:

```bash
# Use reflog to see recent actions
git reflog

# Output shows:
# a1b2c3d HEAD@{0}: rebase -i (finish): returning to refs/heads/feature
# e4f5g6h HEAD@{1}: rebase -i (reword): Fix password validation
# i7j8k9l HEAD@{2}: rebase -i (start): checkout HEAD~3

# Reset to previous state
git reset --hard HEAD@{2}
```

The reflog keeps track of all changes to your branch references, allowing recovery from most modification mistakes.

## Team Collaboration Guidelines

### Communication

When modifying commit messages affects shared work:

```bash
# If you must modify pushed commits (rare), communicate with team
git push --force-with-lease origin feature-branch

# Better: avoid modifying pushed commits entirely
# Instead, add clarifying commits
git commit -m "Clarification: previous commit fixed auth timeout issue"
```

### Preventing Future Message Issues

Set up commit message templates:

```bash
# Create a commit message template
cat > ~/.gitmessage << EOF
# <type>: <subject>
#
# <body>
#
# <footer>
EOF

# Configure Git to use the template
git config --global commit.template ~/.gitmessage
```

This helps ensure consistent, well-formed commit messages from the start.

Now you understand how to effectively modify commit messages for unpushed commits. Remember that clear, descriptive commit messages make your project history more valuable for debugging, code reviews, and collaboration with your team.
