---
title: 'How to Reset Local Git Branch to Match Remote Repository HEAD'
excerpt: 'Learn different methods to reset your local Git branch to exactly match the remote repository HEAD, including hard reset, fetch and reset, and when to use each approach safely.'
category:
  name: 'Git'
  slug: 'git'
date: '2024-12-15'
publishedAt: '2024-12-15T10:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Reset
  - Remote Branches
  - Troubleshooting
  - Command Line
---

When working with Git repositories, you might find yourself in a situation where your local branch has diverged from the remote repository, and you want to completely reset your local branch to match the remote HEAD exactly. This is particularly useful when you want to discard all local changes and start fresh with the latest remote state.

## Prerequisites

Before following this tutorial, you should have:

- Git installed on your system
- A local Git repository that's connected to a remote repository
- Basic understanding of Git concepts like branches, commits, and remotes
- Administrative access to your local repository (be aware this will discard local changes)

## Understanding the Problem

Your local branch can become out of sync with the remote repository in several ways:

- You've made local commits that haven't been pushed
- You've modified files without committing
- The remote repository has been force-pushed or rebased
- You want to abandon local work and start over

## Method 1: Hard Reset with Fetch (Recommended)

The most straightforward and safe approach is to fetch the latest changes from remote and then hard reset your local branch.

### Step 1: Fetch Latest Changes

First, fetch all the latest changes from the remote repository without merging them:

```bash
git fetch origin
```

This command downloads all the latest commits, branches, and tags from the remote repository named "origin" but doesn't modify your current working directory.

### Step 2: Hard Reset to Remote HEAD

Now reset your current branch to match the remote branch exactly:

```bash
git reset --hard origin/main
```

Replace `main` with your actual branch name (it might be `master`, `develop`, or another branch name). `@{u}` names the upstream of the current branch, so `git reset --hard @{u}` works on any branch that has one. On a branch without an upstream, Git stops with `fatal: no upstream configured for branch`.

**Warning**: The `--hard` flag will discard all local changes, including staged and unstaged modifications.

### Step 3: Clean Untracked Files (Optional)

If you also want to remove any untracked files and directories, list them first, then delete them:

```bash
git clean -nd     # dry run: shows what would be deleted
git clean -fd
```

The `-f` flag forces the removal, and `-d` removes untracked directories as well. Files that `.gitignore` matches, such as `node_modules/` or `.env`, stay. Add `-x` to delete those too.

## How Do I Force git pull to Overwrite Local Files?

There is no `git pull` option that discards local changes. Fetch, then reset to the remote branch:

```bash
git stash push -u -m "before reset"   # optional: keep a copy of local changes, untracked files too
git fetch                             # fetches from the remote of the current branch's upstream
git reset --hard @{u}                 # the upstream of the current branch, for example origin/main
git clean -fd                         # optional: delete untracked files
```

`git pull --force` exists, but it does something else: it lets the fetch update a local ref that does not fast-forward. It does not discard local changes, and the merge or rebase step still refuses to overwrite them.

A pull stops for two kinds of local files:

```text
error: Your local changes to the following files would be overwritten by merge:
        config.js
Please commit your changes or stash them before you merge.
```

```text
error: The following untracked working tree files would be overwritten by merge:
        newfile.txt
Please move or remove them before you merge.
```

The first is a change to a tracked file: commit it, stash it, or let the reset above discard it. The second is an untracked file with the same name as a file that the pull brings in: move it away, or delete it with `git clean`. If you want to keep your local changes and still get the new commits, `git pull --rebase --autostash` stashes them, pulls and applies them again. It stashes changes to tracked files only. For an untracked file in the way, rename or move it, pull, and then compare your copy with the file that the pull brought in.

:::warning
`git reset --hard` discards uncommitted changes to tracked files for good, and `git clean -fd` deletes untracked files for good. The reflog keeps only commits. Your local commits that were not pushed are still in `git reflog` for a while after the reset.
:::

## Method 2: Reset Specific Branch

If you want to reset a specific branch (not necessarily the one you're currently on):

### Step 1: Switch to the Target Branch

```bash
git checkout feature-branch
```

### Step 2: Fetch and Reset

```bash
git fetch origin
git reset --hard origin/feature-branch
```

## Method 3: Reset and Set Upstream

If you want to reset and ensure your local branch is properly tracking the remote branch:

```bash
git fetch origin
git reset --hard origin/main
git branch --set-upstream-to=origin/main main
```

This ensures your local branch is tracking the remote branch for future pushes and pulls.

## Method 4: Complete Repository Reset

For a more thorough reset that also deletes every other local branch:

```bash
git fetch origin
git switch main
git reset --hard origin/main
git clean -fd
git for-each-ref --format='%(refname:short)' refs/heads | grep -vx main | xargs -r git branch -D
```

This approach:

1. Fetches latest changes
2. Switches to the main branch
3. Hard resets it to the remote
4. Cleans untracked files
5. Deletes all local branches except main

Do not use `git branch -D $(git branch | grep -v main)`. `git branch` marks the current branch with `*`, and the shell expands that `*` to the file names in the current directory.

## Verification Steps

After resetting, verify that your local branch matches the remote:

### Check Current Status

```bash
git status
```

You should see something like:

```text
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
```

### Compare with Remote

```bash
git log --oneline -5
git log --oneline origin/main -5
```

Both commands should show identical commit histories.

### Check Remote Tracking

```bash
git branch -vv
```

This shows your local branches and their remote tracking information.

## Important Considerations

### Backup Before Reset

Before performing a hard reset, consider creating a backup branch:

```bash
git branch backup-$(date +%Y%m%d%H%M%S)
git reset --hard origin/main
```

### Team Collaboration

When working in a team, communicate before doing hard resets on shared branches. Consider these alternatives:

- Use `git revert` to undo specific commits
- Create a new branch for experimental work
- Use `git stash` to temporarily save work

### Data Loss Prevention

Remember that `git reset --hard` permanently discards:

- Uncommitted changes
- Staged changes
- Local commits that haven't been pushed

### Recovery Options

If you accidentally reset and need to recover:

```bash
git reflog
git reset --hard HEAD@{n}
```

Where `n` is the number from reflog showing your previous state.

## Common Scenarios

### Scenario 1: Discarding Failed Merge

```bash
git fetch origin
git reset --hard origin/main
git clean -fd
```

### Scenario 2: Starting Over After Conflicts

```bash
git fetch origin
git reset --hard origin/main
git branch -D feature-branch
git checkout -b feature-branch origin/feature-branch
```

### Scenario 3: Syncing Fork with Upstream

```bash
git fetch upstream
git reset --hard upstream/main
git push --force-with-lease origin main
```

This throws away any commit on your fork's `main` that `upstream` does not have. [How to sync a forked repository](/posts/sync-forked-repository-github) shows the merge and rebase options.

## Troubleshooting

### Error: "Cannot reset to remote branch"

Make sure you've fetched the latest changes:

```bash
git fetch origin
git branch -r
```

### Error: "Your local changes would be overwritten"

Use the `--hard` flag to force the reset:

```bash
git reset --hard origin/main
```

### Branch Doesn't Exist Remotely

Check available remote branches:

```bash
git branch -r
git fetch origin
```

## Best Practices

1. **Always fetch first**: Ensure you have the latest remote state before resetting
2. **Use with caution**: Hard reset permanently discards local changes
3. **Communicate with team**: Inform team members when resetting shared branches
4. **Create backups**: Save important work before resetting
5. **Verify results**: Check that the reset worked as expected

By following these methods, you can safely reset your local Git branch to match the remote repository HEAD, ensuring your local development environment is synchronized with the latest remote state.

## Related Resources

- [Delete or undo a commit: reset, rebase or revert](/posts/delete-commit-from-branch)
- [What is the difference between git pull and git fetch?](/posts/git-fetch-remote-branch#h2-what-is-the-difference-between-git-pull-and-git-fetch)
- [Introduction to Git: Undo Things](/guides/introduction-to-git/03-tracking-changes#h2-undo-things)
- [Git concepts simulator](/games/git-concepts-simulator)
- Test yourself: [Git Command Quiz](/quizzes/git-quiz)
