---
title: 'Move the Most Recent Commit(s) to a New Branch with Git'
excerpt: 'Learn how to move recent commits from your current branch to a new branch using git checkout, reset, and cherry-pick. Fix branch organization mistakes effectively.'
category:
  name: 'Git'
  slug: 'git'
date: '2024-12-06'
publishedAt: '2024-12-06T10:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '11 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Version Control
  - Branch Management
  - Cherry-Pick
  - Workflow
---

You started working on a new feature but accidentally committed your changes to the main branch instead of creating a feature branch. Or you realize that your recent commits belong on a different branch entirely. Git provides several ways to move recent commits to a new branch while cleaning up your current branch.

In this guide, you'll learn different methods to transfer recent commits to a new branch and when to use each approach.

## Prerequisites

You need Git installed on your system and basic knowledge of Git branches, commits, and resets. Make sure you're working with commits that haven't been pushed to a shared repository, as moving commits involves rewriting history.

## Understanding Commit Movement

When you move commits to a new branch, you're essentially:

1. Creating a new branch from the current state
2. Resetting the current branch to remove the commits
3. The new branch retains the commits you want to move

This operation is safe for local commits but should be avoided for pushed commits.

## Not Committed Yet? Switch to a New Branch

If the work is not committed yet, you do not need to move anything. Uncommitted changes belong to no branch, so create the new branch and Git takes the staged changes, the unstaged changes and the untracked files with you:

```bash
git status --short
# M  app.js       <- staged
#  M style.css    <- not staged
# ?? widget.js    <- untracked

git switch -c feature-new-ui   # same as git checkout -b feature-new-ui
git status --short
# M  app.js
#  M style.css
# ?? widget.js
```

Commit on the new branch, and the branch you started on stays as it was.

Switching to an **existing** branch is different. If that branch has other content in a file you changed, Git refuses rather than overwrite your work:

```text
error: Your local changes to the following files would be overwritten by checkout:
	style.css
Please commit your changes or stash them before you switch branches.
Aborting
```

Stash the work, switch, and apply it there. `-u` includes untracked files, which a plain `git stash` leaves behind:

```bash
git stash push -u -m "wip: dashboard styles"
git switch feature-dashboard
git stash pop
```

If `git stash pop` reports a conflict, fix the files and `git add` them as in a merge. Git keeps the stash entry when the pop does not apply cleanly ("The stash entry is kept in case you need it again"), so run `git stash drop` once you are done. To take only some files along, stash just those paths with `git stash push -- style.css`.

## Method 1: Create Branch and Reset (Recommended)

This is the most straightforward and commonly used method:

### Moving Recent Commits to a New Branch

```bash
# Create a new branch from current state (this preserves all commits)
git checkout -b new-feature-branch

# Switch back to the original branch
git checkout main

# Reset the original branch to remove recent commits
git reset --hard HEAD~3  # Removes last 3 commits

# Verify the result
git log --oneline -5  # Check main branch
git checkout new-feature-branch
git log --oneline -5  # Check new branch has the commits
```

This method creates a new branch with all your recent work, then removes those commits from the original branch.

### Step-by-Step Example

Let's say you have this situation:

```bash
# Your current commit history on main
git log --oneline
# a1b2c3d (HEAD -> main) Add user dashboard
# e4f5g6h Implement user authentication
# i7j8k9l Fix login validation
# m1n2o3p Previous main branch work
```

You want to move the last 3 commits to a new branch:

```bash
# 1. Create new branch from current state
git checkout -b feature/user-system

# 2. Switch back to main
git checkout main

# 3. Reset main to before your feature commits
git reset --hard m1n2o3p  # or HEAD~3

# 4. Verify the split
git log --oneline  # main now ends at m1n2o3p
git checkout feature/user-system
git log --oneline  # feature branch has all commits
```

## Method 2: Using git branch and Reset

An alternative approach that creates the branch without switching:

```bash
# Create new branch from current commit (without switching)
git branch new-feature-branch

# Reset current branch to remove recent commits
git reset --hard HEAD~2

# The new branch now contains the commits you moved
```

This method is slightly more efficient as it doesn't require switching branches back and forth.

## Method 3: Moving Commits from a Different Branch

If you need to move commits that are already on a different branch:

```bash
# Switch to the source branch
git checkout feature-branch

# Create new branch for the commits you want to move
git checkout -b specific-feature HEAD~2  # Creates branch from 2 commits ago

# Switch back to source branch
git checkout feature-branch

# Remove the commits you moved
git reset --hard HEAD~3  # Remove last 3 commits

# The commits are now isolated on specific-feature branch
```

## Method 4: Interactive Approach for Selective Moving

When you want to move only specific commits, not just the most recent ones:

```bash
# Start an interactive rebase
git rebase -i HEAD~5

# In the editor, mark commits to move as 'drop'
# Keep commits you want to stay on current branch as 'pick'

# After completing rebase, create new branch with dropped commits
# (You'll need to use git reflog to find the dropped commits)
git reflog
git checkout -b moved-commits <commit-hash-before-rebase>
```

This method is more complex but gives you granular control over which commits to move.

## Moving Specific Ranges of Commits

### Moving a Sequence of Recent Commits

```bash
# Move last 4 commits to new branch
git checkout -b feature-branch
git checkout main
git reset --hard HEAD~4
```

### Moving Commits Between Specific Points

```bash
# Move commits between two specific commits
git checkout -b feature-branch <end-commit>
git checkout main
git reset --hard <start-commit>
```

### Cherry-Picking Specific Commits

For non-consecutive commits, use cherry-pick:

```bash
# Create new branch
git switch -c selected-commits main~5

# Cherry-pick specific commits
git cherry-pick 3a7b9f2
git cherry-pick 8c4d1e9

# Remove original commits from main if needed
git checkout main
git rebase -i HEAD~5  # Mark unwanted commits as 'drop'
```

## How Do I Cherry-Pick a Commit in Git?

Switch to the branch that needs the change, and name the commit:

```bash
git switch release/1.4
git cherry-pick -x 3a7b9f2
```

`git cherry-pick` applies the changes of one commit as a new commit on the current branch. The new commit has the same changes, message and author, but a new hash, a new committer date, and you as the committer. `-x` adds the line `(cherry picked from commit 3a7b9f2...)` to the message, so anyone can trace the copy back to the original. Use it whenever you copy a commit to a branch that others use.

Before you pick, read the commit: `git show 3a7b9f2`. If it depends on earlier commits that the target branch does not have, pick those first. Otherwise the pick can stop with a conflict, or apply cleanly and then fail to build. Run the tests after each pick.

### Pick several commits

```bash
git cherry-pick 3a7b9f2 8c4d1e9      # two commits, in this order
```

**A range leaves out its first commit.** `A..B` means "the commits reachable from B but not from A", so A itself is not picked. Add `^` to include it. With four commits on `feature`, Add A to Add D:

```bash
git cherry-pick bd36727..52dac3e    # picks Add B, Add C, Add D
git cherry-pick bd36727^..52dac3e   # picks Add A, Add B, Add C, Add D
```

Git applies a range from the oldest commit to the newest. If one of them turns out empty because the change is already on your branch, Git stops and asks; `git cherry-pick --skip` drops that commit and goes on with the rest.

**Take one file, not the whole commit.** Cherry-pick always applies a whole commit. To copy one file as it is on another branch or commit, restore it and commit it yourself. This replaces your uncommitted changes to that file:

```bash
git restore --source=feature --staged --worktree -- src/auth.js
git commit -m "Take the auth fix from feature"
```

**See what is already picked.** `git cherry -v main feature` lists the commits on `feature`. A `-` marks a commit whose change is already on `main`, for example through a cherry-pick, and a `+` marks one that is not:

```text
+ 1ffa6895d63c7a0ef73e634482241b9413bddcc5 Add A
+ 383a0b6f7475f360e505a30f33a27a38bdb375ab Add B
- 94637059a61f5bc812e0c72af5935063791747b7 Add C
+ 4941b0dfe8f2ff78daaec76115da81c00cd6378d Add D
```

**Undo a cherry-pick.** Each picked commit is a normal commit. If you have not pushed, remove the last N with `git reset --hard HEAD~N`, which also discards uncommitted changes (`git reflog` shows where the branch was before). If you have pushed, `git revert` the picked commits instead, so nobody else's history changes.

### Resolve a conflict, or stop

When a pick conflicts, Git stops and lists the files:

```text
error: could not apply 3a7b9f2... Fix the token check
hint: After resolving the conflicts, mark them with
hint: "git add/rm <pathspec>", then run
hint: "git cherry-pick --continue".
```

Fix the files, `git add` them, and run `git cherry-pick --continue`. `git cherry-pick --skip` drops the current commit and goes on with the rest. `git cherry-pick --abort` returns the branch to where it was before the pick. The [merge conflicts section](/posts/undo-git-merge-not-pushed#h2-how-do-i-resolve-merge-conflicts-in-git) shows how to read the conflict markers.

### Other useful options

- **`-n` (`--no-commit`):** apply the changes but do not commit, for example to join several picks into one commit.
- **`-e` (`--edit`):** edit the message before the commit.
- **`-m 1`:** pick a merge commit. Git needs to know which parent is the main line. Picking a merge copies all the changes of the merged branch as one commit, which is rarely what you want. Pick the commits of the branch instead.

### Backport a fix to a release branch

Make the fix on the main branch first, through the normal review. Then copy it to each release branch that still gets fixes:

```bash
git switch main
git log --oneline -5                 # the fix is 3a7b9f2
git switch release/1.4
git cherry-pick -x 3a7b9f2
git push origin release/1.4
```

Fixing `main` first means the fix cannot get lost in the next release. The [collaboration chapter of the Git guide](/guides/introduction-to-git/07-collaboration#h2-release-branches-and-backports) shows the same flow.

### Pick a commit from another repository

Fetch the other repository as a remote, then pick by hash:

```bash
git remote add other https://github.com/acme/other-repo.git
git fetch other
git cherry-pick -x 3a7b9f2
git remote remove other
```

### When not to cherry-pick

To bring a whole branch over, merge or rebase it. A branch that you copy commit by commit gets duplicate commits with new hashes, and a later merge of the two branches can conflict with its own copies.

## Handling Different Scenarios

### Moving Commits with Merge History

When your commits include merges:

```bash
# Create branch preserving merge structure
git checkout -b feature-with-merges

# Reset main branch
git checkout main
git reset --hard HEAD~5

# Verify merge history is preserved on new branch
git log --graph --oneline
```

### Moving Commits with File Conflicts

If moving commits would create conflicts:

```bash
# Create the new branch first
git checkout -b problematic-feature

# Switch back and reset more conservatively
git checkout main
git reset --soft HEAD~3  # Soft reset keeps changes staged

# Review changes and commit selectively
git status
git commit -m "Keep only compatible changes on main"
```

### Partial Commit Moving

When you want to move only part of recent work:

```bash
# Create new branch
git checkout -b partial-feature

# Reset current branch to a middle point
git checkout main
git reset --soft HEAD~2

# Selectively commit what should stay on main
git add specific-files.js
git commit -m "Keep these changes on main"

# Reset working directory to clean state
git reset --hard HEAD
```

## Verifying and Testing the Move

### Checking Branch States

After moving commits, verify both branches:

```bash
# Check original branch
git checkout main
git log --oneline -10
git status

# Check new branch
git checkout new-feature-branch
git log --oneline -10
git status

# Verify no commits were lost
git log --all --graph --oneline
```

### Testing Branch Functionality

Ensure both branches work correctly:

```bash
# Test original branch
git checkout main
# Run tests, verify application works

# Test new branch
git checkout new-feature-branch
# Run tests, verify feature works
```

## Recovery from Mistakes

If you make mistakes during the move operation:

```bash
# Use reflog to see recent branch movements
git reflog

# Example output:
# a1b2c3d HEAD@{0}: reset: moving to HEAD~3
# e4f5g6h HEAD@{1}: checkout: moving from feature-branch to main
# i7j8k9l HEAD@{2}: checkout: moving from main to feature-branch

# Recover to previous state
git reset --hard HEAD@{1}
```

### Creating Safety Backups

Before moving commits, create backup branches:

```bash
# Create backup of current state
git branch backup-before-move

# Perform your commit moving operations
git checkout -b new-feature
git checkout main
git reset --hard HEAD~3

# If something goes wrong, restore from backup
git checkout backup-before-move
git branch -D main  # Delete problematic main
git checkout -b main  # Recreate main from backup
```

## Best Practices

### Planning Commit Organization

Prevent the need to move commits by:

```bash
# Always create feature branches before starting work
git checkout -b feature/new-functionality
# Make your commits
git commit -m "Implement feature"

# When ready, merge to main
git checkout main
git merge feature/new-functionality
```

### Communicating Changes

When working in teams and you need to move commits:

```bash
# Document the branch reorganization
git commit -m "Reorganize commits: move user auth to feature branch

- Moved 3 commits from main to feature/user-auth
- Main branch now contains only core functionality
- Feature branch contains user authentication implementation"
```

### Maintaining Clean History

Use descriptive branch names when moving commits:

```bash
# Good branch names for moved commits
git checkout -b feature/user-authentication
git checkout -b bugfix/login-validation
git checkout -b refactor/database-layer

# Avoid generic names
git checkout -b temp-branch
git checkout -b moved-stuff
```

Now you understand how to effectively move recent commits to new branches. This technique helps you maintain organized branch structure and correct mistakes in commit placement while preserving your work and maintaining clean Git history.

## Related Resources

- [Introduction to Git: Branches, Stash and Detached HEAD](/guides/introduction-to-git/04-branching)
- [Delete or undo a commit: reset, rebase or revert](/posts/delete-commit-from-branch)
- [How to undo a git rebase](/posts/undo-git-rebase)
- [Git concepts simulator](/games/git-concepts-simulator): watch commits move between branches
- [Git workflow strategies interview question](/interview-questions/topic/git#git-workflow-strategies)
- Test yourself: [Git Command Quiz](/quizzes/git-quiz)
