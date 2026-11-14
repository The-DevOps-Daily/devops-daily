---
title: 'Delete a Commit from a Git Branch: Reset, Rebase or Revert'
excerpt: 'Remove the last commit with git reset --hard HEAD~1, drop an older one with git rebase -i, or undo a pushed commit safely with git revert <commit-hash>.'
category:
  name: 'Git'
  slug: 'git'
date: '2025-03-10'
publishedAt: '2025-03-10T09:30:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '13 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Version Control
  - Commit History
  - Rebase
  - Reset
  - Revert
---

**TLDR:** To delete the most recent commit, use `git reset --hard HEAD~1`. To delete a specific commit from history, use `git rebase -i HEAD~n` (where n is the number of commits to go back), then mark the commit as "drop". If the commit is already pushed and shared, use `git revert <commit-hash>` instead to safely undo it.

You've made a commit that needs to be removed from your branch. Maybe it contains sensitive information, introduces a bug, or simply does not belong in the history. Git provides several ways to delete commits depending on your situation.

In this guide, you'll learn different methods to delete commits and when to use each approach.

## Prerequisites

You'll need Git installed on your system and a repository with commits you want to remove. Understanding basic Git concepts like commits, branches, and the staging area will help you follow along safely.

## Understanding the Impact of Deleting Commits

Before deleting commits, you need to understand the implications. If you've already pushed the commit to a shared repository, deleting it rewrites history and can cause problems for other developers.

The decision tree looks like this:

```text
Has the commit been pushed?
  |
  ├─ No: Safe to use reset or interactive rebase
  |
  └─ Yes: Use revert to create a new commit that undoes changes
```

Rewriting history on commits that others have pulled forces them to deal with conflicts and diverged histories. Always prefer methods that do not rewrite history when working with shared branches.

## Deleting the Most Recent Commit

To remove the last commit from your branch, use `git reset`:

```bash
# Remove the last commit but keep the changes
git reset --soft HEAD~1

# Remove the last commit and discard the changes
git reset --hard HEAD~1

# Remove the last commit, keep changes unstaged
git reset --mixed HEAD~1
```

The difference between these options:

- `--soft` keeps your changes staged and ready to commit
- `--mixed` (default) keeps your changes in the working directory but unstaged
- `--hard` completely removes the changes

For example, if you want to fix the commit message or combine it with other changes, use soft reset:

```bash
# Remove last commit, keep changes staged
git reset --soft HEAD~1

# Make additional changes
echo "more code" >> file.js

# Create a new commit with everything
git add file.js
git commit -m "Better commit message with all changes"
```

To change only the message or add a forgotten file to the last commit, you do not need a reset: `git commit --amend` replaces the last commit.

## Deleting Multiple Recent Commits

To remove several recent commits, increase the number after `HEAD~`:

```bash
# Remove the last 3 commits completely
git reset --hard HEAD~3

# Remove the last 5 commits, keep changes unstaged
git reset HEAD~5
```

After resetting, check what was removed:

```bash
# View recent history
git log --oneline -10

# If you reset too far, recover using reflog
git reflog
git reset --hard HEAD@{1}
```

The reflog keeps track of all branch movements. By default, Git keeps a reflog entry for 90 days, and an entry for a commit that is no longer on any branch for 30 days (`gc.reflogExpire` and `gc.reflogExpireUnreachable`). After that, `git gc` can delete the commit.

## How Do I Undo the Last Commit but Keep My Changes?

Run `git reset --soft HEAD~1` to keep the changes staged, or `git reset HEAD~1` to keep them as unstaged edits:

```bash
git reset --soft HEAD~1     # the commit is gone, its changes are staged
```

```bash
git reset HEAD~1            # or: the commit is gone, its changes are in the files but not staged
```

Pick the mixed reset (no flag) when you want to commit only some of the files again. After a soft reset, every change of the old commit is still staged, so `git add` on one file does not limit the next commit. In a test, a commit with `a.js` and `b.js` was reset with `--soft`, then `git add a.js` and `git commit` recorded both files again. With `git reset HEAD~1`, only the files you add go into the commit:

```bash
git reset HEAD~1
git add a.js
git commit -m "Add a.js only"     # b.js stays as a local change
```

To undo the last 3 commits, use `HEAD~3`. If you already pushed the commits, revert them instead, as [shown below](#h2-how-do-i-revert-the-repository-to-a-previous-commit-without-rewriting-history).

## What Is the Difference Between git reset --soft, --mixed and --hard?

All three move the current branch to the commit you name. They differ in what they do with the index (the staged changes) and the files in your working directory:

| Mode                | Branch | Index (staged)       | Working directory                  | Use it to                                 |
| ------------------- | ------ | -------------------- | ---------------------------------- | ----------------------------------------- |
| `--soft`            | moves  | keeps the changes    | keeps the files                    | re-commit, or squash the last commits     |
| `--mixed` (default) | moves  | resets to the commit | keeps the files                    | choose again what to stage                |
| `--hard`            | moves  | resets to the commit | resets the files: **changes lost** | throw away commits and local changes      |
| `--keep`            | moves  | resets to the commit | keeps local changes, or refuses    | move back without losing uncommitted work |

`--keep` is the safe version of `--hard`. It updates the files that differ between the two commits, keeps your other uncommitted changes, and stops if it would have to overwrite one of them:

```text
error: Entry 'file.txt' not uptodate. Cannot merge.
fatal: Could not reset index file to revision 'HEAD~1'.
```

To reset a single file instead of the whole branch, see [restore a file from a specific commit](/posts/find-restore-deleted-file-git#h2-how-do-i-reset-or-revert-a-file-to-a-specific-revision).

## How Do I Reset My Branch to a Previous Commit?

Find the commit, make a backup branch, and reset to it:

```bash
git log --oneline -10                  # find the commit, for example 3a7b9f2
git status                             # commit or stash anything you want to keep
git branch backup-before-reset         # a second name for the current commit
git reset --hard 3a7b9f2
```

:::warning
`git reset --hard` deletes uncommitted changes in tracked files, and the reflog cannot bring them back, because Git never stored them. Commits are safer: the backup branch and the reflog keep them. Run `git stash push -u` first if you are not sure.
:::

Some details:

- **Relative names:** `HEAD~1` is the parent of the current commit, `HEAD~3` three commits back, and `origin/main` the last fetched state of the remote branch. To make your branch match the remote exactly, see [reset a local branch to match the remote](/posts/how-to-reset-local-branch-to-match-remote-head).
- **Untracked files mostly stay.** A reset does not delete files that Git does not track. The exception: if the target commit has a file at the same path, `--hard` overwrites the untracked file. `git clean -n` lists untracked files, and `git clean -fd` deletes them.
- **Undo the reset:** `git reset --hard backup-before-reset`, or `git reset --hard HEAD@{1}` right after the reset.
- **Pushed commits:** if the commits are on a shared branch, do not reset it. Use the revert below.

## Deleting a Specific Commit from History

To remove a specific commit that is not the most recent one, use interactive rebase:

```bash
# Start interactive rebase for the last 5 commits
git rebase -i HEAD~5
```

This opens your editor with a list of commits:

```text
pick 3d0f1ca Add user authentication
pick b5ca0b9 Fix validation bug
pick e0ea0d4 Add logging
pick 8ff2833 Update documentation
pick c2a91f7 Add tests

# Commands:
# p, pick = use commit
# r, reword = use commit, but edit message
# e, edit = use commit, but stop for amending
# s, squash = use commit, but meld into previous commit
# d, drop = remove commit
```

To delete a specific commit, change `pick` to `drop` (or just delete the line):

```text
pick 3d0f1ca Add user authentication
drop b5ca0b9 Fix validation bug
pick e0ea0d4 Add logging
pick 8ff2833 Update documentation
pick c2a91f7 Add tests
```

Save and close the editor. Git will replay all the commits except the one marked as `drop`. If there are conflicts, Git will pause and let you resolve them:

```bash
# If conflicts occur during rebase
# Edit the conflicted files, then:
git add .
git rebase --continue

# Or abort if needed
git rebase --abort
```

If the rebase already finished and dropped the wrong commit, you can still [undo the rebase](/posts/undo-git-rebase) with `ORIG_HEAD` or the reflog.

## Finding the Right Commit to Delete

To identify which commit to delete, use Git's log commands:

```bash
# View recent commits with details
git log --oneline -10

# Search for commits by message
git log --grep="bug fix"

# Find commits that changed a specific file
git log --oneline -- path/to/file.js

# See what each commit changed
git log -p -3
```

Once you find the commit hash, you can target it specifically:

```bash
# Rebase back to just before that commit
git rebase -i <commit-hash>^
```

The `^` means "the commit before this one", which is where the rebase will start.

## Deleting Commits from Pushed Branches

If you've already pushed the commits to a remote repository, you have two options:

**Option 1: Revert (Safe for shared branches)**

Create a new commit that undoes the changes:

```bash
# Revert a specific commit
git revert b5ca0b9

# Revert multiple commits
git revert b5ca0b9 e0ea0d4

# Revert without opening editor
git revert --no-edit b5ca0b9
```

This creates new commits that undo the changes, preserving the history and keeping other developers' work intact.

**Option 2: Force Push (Dangerous - only for branches you own)**

If you're certain no one else is working on the branch, you can delete commits and force push with a lease:

```bash
# Delete commits locally
git reset --hard HEAD~3

# Replace the remote branch, but only if nobody pushed to it since your last fetch
git push --force-with-lease --force-if-includes origin feature-branch
```

A plain `--force` overwrites the remote branch even when someone else pushed new commits to it. The [force push section of the Git guide](/guides/introduction-to-git/06-remote-repositories#h2-force-push-safely) shows how the lease protects them.

**Warning:** Never force push to shared branches like main or develop. Only use this on feature branches where you're the sole contributor.

## How Do I Revert the Repository to a Previous Commit Without Rewriting History?

Make one new commit whose content is the old commit. `git restore` copies the whole tree of that commit into the index and the working directory:

```bash
git restore --source=3a7b9f2 --staged --worktree -- :/
git commit -m "Return to the state of 3a7b9f2"
git push
```

Commit or stash your local changes first: the command replaces the index and the files with the old content. `:/` means the whole repository, from any subdirectory. The command also deletes files that were added after `3a7b9f2`, so the new commit has exactly the old content. In a test, `git diff 3a7b9f2 HEAD` was empty after the commit. The commits in between stay in the history, so nobody has to repair a clone.

Older answers use `git checkout 3a7b9f2 -- .` for this. It does not delete files that were added later, so the result is not the old state.

### Revert the commits one by one

`git revert` makes one undo commit for each commit, which keeps a clear record of what was undone:

```bash
git revert --no-edit HEAD~2..HEAD     # undoes the last 2 commits: HEAD and HEAD~1, one revert commit each
```

Or, from the same starting point, undo them as one commit:

```bash
git revert --no-commit HEAD~3..HEAD   # undoes the last 3 commits as one staged change
git commit -m "Revert the payment feature"
```

- **A range leaves out its first commit.** `A..B` means the commits after `A` up to `B`. `HEAD~2..HEAD` is two commits, not three. To include `A`, write `A^..B`.
- **`-m` is not the message.** In `git revert`, `-m <number>` picks the parent of a merge commit. `git revert HEAD -m "message"` fails with ``option `mainline' expects a number greater than zero``. Use `--edit` (the default) or `--no-edit`, or `--no-commit` and then `git commit -m`.
- **A range with a merge commit fails** with `commit ... is a merge but no -m option was given`. Revert the merge on its own with `git revert -m 1 <merge>` ([undo a pushed merge](/posts/undo-git-merge-not-pushed#h2-how-do-i-undo-a-merge-that-is-already-pushed)), or use the `git restore` method above.
- **Conflicts:** fix the files, `git add` them, and run `git revert --continue`. `git revert --abort` stops.

### Look at an old commit without changing anything

To test an old state before you revert to it, check it out without a branch, then come back:

```bash
git switch --detach 3a7b9f2     # "detached HEAD": no branch moves
git switch -                     # back to the branch you were on
git switch -c hotfix 3a7b9f2     # or start a new branch from the old commit
```

## Verifying Commits Were Deleted

After deleting commits, verify the result:

```bash
# Check commit history
git log --oneline --graph -10

# Verify specific commit is gone
git log --all --oneline | grep "b5ca0b9"

# Check the state of files
git status

# Compare with remote branch
git log origin/main..HEAD
```

These commands help you confirm that you deleted the right commits and did not accidentally remove something important.

## Recovering Deleted Commits

If you deleted the wrong commit, the reflog can save you:

```bash
# View all recent operations
git reflog

# Output shows:
# 3d0f1ca HEAD@{0}: rebase (finish): returning to refs/heads/main
# b5ca0b9 HEAD@{1}: rebase (pick): Fix validation bug
# e0ea0d4 HEAD@{2}: commit: Add logging
```

To recover:

```bash
# Reset to before the deletion
git reset --hard HEAD@{2}

# Or reset to a specific commit hash
git reset --hard b5ca0b9
```

The reflog is your safety net for recovering from mistakes with Git history.

## Best Practices

Always create a backup branch before deleting commits:

```bash
# Create backup
git branch backup-before-delete

# Delete commits
git reset --hard HEAD~5

# If something went wrong, restore from backup
git reset --hard backup-before-delete
```

For collaborative projects, communicate with your team before deleting commits from shared branches. What seems like a mistake to you might be intentional or might affect their work.

When you must delete commits from a pushed branch, choose the least disruptive time - when others are not actively working, and after coordinating with the team.

Now you know how to delete commits from Git branches using various methods. Remember to check whether commits have been shared before using destructive operations like reset or force push. For shared branches, use revert to safely undo changes without rewriting history.

## Related Resources

- [Introduction to Git: Log, Revert, Reset and Reflog](/guides/introduction-to-git/08-history#h2-undo-commits-reset-revert-and-the-reflog)
- [How to undo a git rebase](/posts/undo-git-rebase)
- [Undo or abort a Git merge](/posts/undo-git-merge-not-pushed)
- [Move the most recent commits to a new branch](/posts/move-most-recent-commits-to-new-branch-git)
- [Git concepts simulator](/games/git-concepts-simulator): watch `reset` move a branch pointer
- Test yourself: [Git Command Quiz](/quizzes/git-quiz)
