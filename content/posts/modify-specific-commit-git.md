---
title: 'How to Modify a Specific Commit in Git'
excerpt: 'Need to change an old commit? Learn how to modify a specific commit in Git history using interactive rebase and amend commands.'
category:
  name: 'Git'
  slug: 'git'
date: '2025-01-08'
publishedAt: '2025-01-08T14:30:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Commits
  - Rebase
  - Version Control
  - History Editing
---

You committed something with a typo, wrong files, or need to add a forgotten change to an old commit. Git lets you modify commits in your history, but the approach differs depending on whether you've shared the commit with others.

**TLDR:** To modify the most recent commit, use `git commit --amend`. To modify an older commit, use `git rebase -i HEAD~n` (where n is how many commits back), mark the commit as "edit", make your changes, then `git commit --amend` followed by `git rebase --continue`. Only modify commits that have not been pushed to shared branches.

In this guide, you'll learn how to safely modify commits in Git.

## Prerequisites

You'll need Git installed on your system and a repository with commits you want to modify. Understanding basic Git concepts like commits, staging, and rebase will be helpful.

## Modifying the Most Recent Commit

The simplest case is modifying the last commit you made:

```bash
# Oops, forgot to add a file
git add forgotten-file.js

# Amend the last commit
git commit --amend

# Git opens editor to let you change the message if needed
# Save and close to finish
```

This replaces the previous commit with a new one that includes your additional changes.

## Amending Without Changing the Message

To add changes without modifying the commit message:

```bash
# Stage your changes
git add fixed-file.js

# Amend without opening editor
git commit --amend --no-edit
```

This is faster when you only want to add files or changes, not update the message.

## Changing Just the Commit Message

To only update the message of the last commit:

```bash
# Open editor to change message
git commit --amend

# Or specify new message directly
git commit --amend -m "Fixed typo in commit message"
```

No files need to be staged - this only updates the message.

## Modifying an Older Commit

To modify a commit that is not the most recent, use interactive rebase:

```bash
# Start interactive rebase for last 3 commits
git rebase -i HEAD~3
```

Git opens an editor showing your commits:

```
pick abc123 Add user authentication
pick def456 Fix validation bug
pick ghi789 Update documentation

# Rebase commands:
# p, pick = use commit
# r, reword = use commit, but edit message
# e, edit = use commit, but stop for amending
# s, squash = use commit, but meld into previous commit
# f, fixup = like squash, but discard this commit's message
# d, drop = remove commit
```

Change `pick` to `edit` for the commit you want to modify:

```
pick abc123 Add user authentication
edit def456 Fix validation bug
pick ghi789 Update documentation
```

Save and close. Git stops at that commit:

```bash
# Git says:
# Stopped at def456... Fix validation bug
# You can amend the commit now

# Make your changes
nano src/validation.js

# Stage changes
git add src/validation.js

# Amend the commit
git commit --amend

# Continue the rebase
git rebase --continue
```

## Modifying Multiple Commits

To modify several commits:

```bash
git rebase -i HEAD~5

# Mark multiple commits as 'edit'
pick abc123 First commit
edit def456 Second commit (modify this)
pick ghi789 Third commit
edit jkl012 Fourth commit (and this)
pick mno345 Fifth commit
```

Git stops at each marked commit, letting you make changes:

```bash
# At first 'edit' stop
# Make changes
git add .
git commit --amend
git rebase --continue

# At second 'edit' stop
# Make more changes
git add .
git commit --amend
git rebase --continue

# Rebase complete
```

## Changing Author Information

To change the author of a commit:

```bash
# For the most recent commit
git commit --amend --author="Jane Developer <jane@example.com>"

# For an older commit
git rebase -i HEAD~3
# Mark commit as 'edit'
# When stopped:
git commit --amend --author="Jane Developer <jane@example.com>"
git rebase --continue
```

## Adding Files to an Old Commit

To add forgotten files to a previous commit:

```bash
# Start rebase
git rebase -i HEAD~4

# Mark the commit as 'edit'
edit abc123 Add authentication feature

# When Git stops
git add forgotten-test.js
git commit --amend --no-edit

# Continue
git rebase --continue
```

## Removing Files from a Commit

To remove files from an old commit:

```bash
git rebase -i HEAD~3

# Mark as 'edit'
edit def456 Update configs

# When stopped, unstage the file
git reset HEAD unwanted-file.js

# Amend without the file
git commit --amend --no-edit

# The file is now unstaged - you can commit it separately or discard
git checkout -- unwanted-file.js  # Discard changes

# Continue
git rebase --continue
```

## Splitting a Commit

To split one commit into multiple commits:

```bash
git rebase -i HEAD~2

# Mark as 'edit'
edit abc123 Multiple unrelated changes

# When stopped, reset to previous commit
git reset HEAD^

# Now files are unstaged - stage and commit separately
git add feature1.js
git commit -m "Add feature 1"

git add feature2.js
git commit -m "Add feature 2"

# Continue
git rebase --continue
```

## Reordering Commits

To change the order of commits:

```bash
git rebase -i HEAD~4

# Simply reorder the lines
pick ghi789 Third commit
pick abc123 First commit
pick def456 Second commit
pick jkl012 Fourth commit

# Save and Git reorders them
```

Be careful - reordering can cause conflicts if commits depend on each other.

## Squashing Commits Together

To combine multiple commits into one:

```bash
git rebase -i HEAD~3

pick abc123 Add feature part 1
squash def456 Add feature part 2
squash ghi789 Add feature part 3

# Git combines them and lets you edit the message
```

The `squash` command merges commits into the previous one.

## Fixing Merge Commits

Modifying merge commits is trickier:

```bash
# Use --preserve-merges (or --rebase-merges in newer Git)
git rebase -i --preserve-merges HEAD~5

# Or recreate the merge after modifying
git rebase -i HEAD~5  # Skip the merge commit
# Then merge again manually
```

## Handling Rebase Conflicts

When modifying commits causes conflicts:

```bash
# Conflict occurs during rebase
# CONFLICT (content): Merge conflict in file.js

# Resolve conflicts
nano file.js

# Stage resolved files
git add file.js

# Continue rebase
git rebase --continue

# Or skip this commit
git rebase --skip

# Or abort entire rebase
git rebase --abort
```

## Verifying Changes

After modifying commits, verify the result:

```bash
# View modified history
git log --oneline --graph

# See what changed
git show HEAD

# Compare with remote (if not pushed yet)
git log origin/main..HEAD
```

## Pushing Modified Commits

If you modified commits that were already pushed:

```bash
# Force push (dangerous - coordinate with team!)
git push --force origin feature-branch

# Safer alternative - force with lease
git push --force-with-lease origin feature-branch
```

**Warning:** Only force push to branches you own. Never force push to shared branches like main.

## What If You Already Pushed?

If commits are already on a shared branch, consider alternatives to modifying:

```bash
# Option 1: Create a new commit with fixes
git commit -m "Fix issues from previous commit"

# Option 2: Revert and redo
git revert abc123
git commit -m "Correct implementation"

# Option 3: Coordinate with team before force pushing
```

Modifying pushed commits disrupts others who pulled them.

## Recovering from Mistakes

If you mess up during modification:

```bash
# View reflog
git reflog

# Reset to before the rebase
git reset --hard HEAD@{5}

# Or reset to specific commit
git reset --hard abc123
```

The reflog saves you from most mistakes for about 30 days.

## Modifying Commits in Scripts

Automate commit modifications:

```bash
#!/bin/bash
# Script to modify author in last 5 commits

git filter-branch --env-filter '
if [ "$GIT_COMMIT" = "abc123" ]; then
    export GIT_AUTHOR_NAME="Correct Name"
    export GIT_AUTHOR_EMAIL="correct@email.com"
fi
' HEAD~5..HEAD
```

For extensive history rewriting, use `git filter-repo` instead of `filter-branch`.

## Best Practices

Only modify commits that have not been pushed:

```bash
# Good: Local commits only
git commit --amend

# Risky: Already pushed
git push --force
```

Create a backup branch before modifying:

```bash
# Backup current state
git branch backup-before-rebase

# Modify commits
git rebase -i HEAD~5

# If something goes wrong
git reset --hard backup-before-rebase
```

Keep modifications focused:

```bash
# Good: Fix one specific issue
git commit --amend

# Risky: Rewriting extensive history
git rebase -i HEAD~50
```

Test after modifying:

```bash
git rebase -i HEAD~3
# Make modifications
npm test  # Run tests to verify nothing broke
git push
```

Communicate with team when force pushing:

```bash
# Before force push
"Hey team, I need to fix commits on feature-x,
please don't push to it for the next 10 minutes"

git push --force origin feature-x
```

## Alternative: Using Fixup Commits

Instead of modifying history, create fixup commits:

```bash
# Create fixup commit
git commit --fixup=abc123

# Later, auto-squash during rebase
git rebase -i --autosquash HEAD~5
```

This is safer as you're not immediately rewriting history.

## When Not to Modify Commits

Avoid modifying commits when:

- They're already on main/master
- Multiple people are working on the branch
- The commits are tagged releases
- You're not sure what you're doing

In these cases, create new commits instead:

```bash
# Better than modifying old commits
git commit -m "Fix typo from commit abc123"
```

Now you know how to modify specific commits in Git. Use `git commit --amend` for the most recent commit and `git rebase -i` for older commits. Remember to only modify commits that have not been shared with others, and always create backups before rewriting history.
