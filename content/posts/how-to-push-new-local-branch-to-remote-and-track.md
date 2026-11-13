---
title: 'How to Push a New Local Branch to Remote Git Repository and Track It'
excerpt: 'Push a new branch with git push -u origin <branch>, fix "src refspec does not match any", and rename or delete a branch locally and on the remote.'
category:
  name: 'Git'
  slug: 'git'
date: '2024-12-13'
publishedAt: '2024-12-13T10:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '13 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Branch
  - Remote
  - Version Control
  - Command Line
---

When you create a new branch locally in Git, it exists only on your local machine until you push it to a remote repository. Additionally, you'll want to set up tracking so that a plain `git push` and `git pull` know where to go. This tutorial covers the complete process of pushing a new local branch to a remote repository and establishing proper tracking relationships.

## Prerequisites

Before following this tutorial, you should have:

- Git installed on your system
- A local Git repository connected to a remote repository
- Basic understanding of Git branches and remote repositories
- Permissions to push to the remote repository

## Understanding Branch Tracking

When you create a local branch, Git doesn't automatically know which remote branch it should sync with. Setting up tracking (also called upstream) creates a relationship between your local branch and a remote branch, enabling:

- Simple `git push` and `git pull` commands without specifying remote and branch names
- Status information about how many commits you're ahead or behind
- Automatic completion in many Git tools

## Method 1: Push and Set Upstream in One Command

The most efficient way to push a new branch and set up tracking simultaneously:

### Using the --set-upstream Flag

```bash
git push --set-upstream origin <branch-name>
```

Or using the shorter `-u` flag:

```bash
git push -u origin <branch-name>
```

Example:

```bash
git checkout -b feature/user-authentication
git push -u origin feature/user-authentication
```

This command:

1. Creates the branch on the remote repository
2. Pushes all commits from your local branch
3. Sets up tracking between local and remote branches

### Verification

After pushing, verify the tracking relationship:

```bash
git branch -vv
```

Output should show something like:

```text
* feature/user-authentication 3a7b9f2 [origin/feature/user-authentication] Add user login functionality
  main                        8c4d1e9 [origin/main] Initial commit
```

## Method 2: Push First, Set Tracking Later

If you've already pushed a branch without setting up tracking, you can establish the relationship afterward.

### Initial Push Without Tracking

```bash
git push origin <branch-name>
```

### Set Upstream Branch

```bash
git branch --set-upstream-to=origin/<branch-name>
```

Or use the shorter form:

```bash
git branch -u origin/<branch-name>
```

Example:

```bash
git push origin feature/payment-integration
git branch -u origin/feature/payment-integration
```

## Method 3: Push Current Branch

If you're already on the branch you want to push:

```bash
git push -u origin HEAD
```

The `HEAD` refers to your current branch, so Git automatically uses the current branch name. This is useful when you have long or complex branch names.

## How Do I Create a Remote Branch?

Push a local branch with `-u`. The push creates the branch on the remote and sets it as the upstream of your local branch:

```bash
git switch -c feature/payments
git push -u origin feature/payments
```

To create a remote branch without a local one, push a commit to a new name:

```bash
git push origin HEAD:feature/payments                  # from the current commit
git push origin 3a7b9f2:refs/heads/hotfix              # from a commit hash: write the full ref name
git push origin 'v1.0.0^{commit}:refs/heads/release-1.0'   # from the commit of a tag
```

From a hash, Git cannot guess whether you mean a branch or a tag, so `3a7b9f2:hotfix` fails with `The destination you provided is not a full refname`. From an annotated tag, add `^{commit}`. Without it, Git tries to put the tag object itself on a branch, and the server rejects it with `trying to write non-commit object`.

If you can create branches in the web interface of GitHub, GitLab or Bitbucket, a branch made there appears locally after `git fetch`. [Check out a remote branch](/posts/git-fetch-remote-branch#h2-how-do-i-check-out-a-remote-branch) shows how to start working on it.

### Push without -u every time

Git 2.37 and later can create the upstream on the first `git push` of a new branch:

```bash
git config --global push.autoSetupRemote true
git switch -c feature/x
git push
# * [new branch]      feature/x -> feature/x
# branch 'feature/x' set up to track 'origin/feature/x'.
```

Without the setting, the first plain `git push` stops and prints the `git push --set-upstream origin feature/x` command to run.

## How Do I Fix "src refspec master does not match any"?

Git has no local branch or commit with the name you pushed. Push a branch that exists:

```bash
git branch --show-current       # the name of your branch, for example main
git push -u origin main         # push that name
git push -u origin HEAD         # or: push the current branch, whatever its name
```

The error has three common causes:

1. **No commits yet.** After `git init`, the branch exists only after the first commit. `git log` confirms it:

   ```text
   fatal: your current branch 'main' does not have any commits yet
   ```

   Make the first commit: `git add .` and `git commit -m "Initial commit"`. Then push.

2. **The branch is `main`, and you pushed `master`** (or the other way round). New repositories on GitHub and GitLab use `main`, and so does Git when `init.defaultBranch` is `main`. Git 3.0 plans to make `main` the default for new repositories ([what changes in Git 3.0](/guides/introduction-to-git/01-fundamentals#h2-what-changes-in-git-30)). Push the name that `git branch --show-current` prints.
3. **A typo** in the branch name, for example `git push origin maste`.

If the remote expects `master` and you want your branch to have that name, rename it: `git branch -m main master`, then `git push -u origin master`.

A missing remote gives a different error, `fatal: 'origin' does not appear to be a git repository`. Add it with `git remote add origin <url>`. If the push is rejected because the remote already has a commit, for example a README, see [refusing to merge unrelated histories](/posts/undo-git-merge-not-pushed#h2-how-do-i-fix-refusing-to-merge-unrelated-histories).

## How Do I Rename a Git Branch?

Rename the current branch with `git branch -m <new-name>`, or any branch with `git branch -m <old> <new>`:

```bash
git branch -m featur-login feature-login
```

The commits, the reflog and the branch settings move to the new name. The upstream does not change: in a test, the renamed branch still tracked `origin/featur-login`. So if you pushed the branch before, push the new name, set it as the upstream, and delete the old remote branch:

```bash
git push -u origin feature-login        # the new name, now the upstream
git push origin --delete featur-login   # the old name
```

On GitHub, deleting the old branch closes the open pull requests that use it as their head branch, and you must open them again from the new branch.

### Rename a shared or default branch

For a branch that other people use, such as `master` to `main`, rename it in the web interface of the hosting service. GitHub then moves branch protection rules, changes the base branch of open pull requests, and redirects web URLs that contain the old name. It does not update GitHub Actions workflows that name the old branch. Each collaborator then runs the commands that [GitHub's documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-branches-in-your-repository/renaming-a-branch) lists:

```bash
git branch -m master main
git fetch origin
git branch -u origin/main main
git remote set-head origin -a
```

On macOS and Windows, a rename that changes only the case (`Feature` to `feature`) can fail, because the file system does not see a difference. `git branch -M` forces it.

## How Do I Delete a Git Branch Locally and Remotely?

Delete the local branch with `git branch -d`, and the remote branch with `git push origin --delete`:

```bash
git switch main                              # you cannot delete the branch you are on
git branch -d feature/login                  # local
git push origin --delete feature/login       # remote
```

`-d` refuses to delete a branch whose commits are not merged:

```text
error: The branch 'feature/login' is not fully merged.
If you are sure you want to delete it, run 'git branch -D feature/login'.
```

`-d` checks the branch against its upstream, or against the current branch if it has no upstream. So a branch whose upstream has all its commits counts as merged, even if it never reached `main`. A branch that you pushed without `-u` and never merged counts as "not fully merged". Use `-D` only when you are sure. Git prints the last commit of the deleted branch, so you can undo the delete:

```bash
git branch -D feature/login
# Deleted branch feature/login (was 0f1ce33).
git branch feature/login 0f1ce33             # undo, if you need it again
```

### Clean up after branches are merged

When a pull request is merged and the remote branch is deleted, your clone still has the remote-tracking branch until you prune:

```bash
git fetch --prune                            # or set it once: git config --global fetch.prune true
git branch -vv                               # local branches whose upstream is gone show ": gone]"
```

To delete every local branch whose upstream is gone:

```bash
git for-each-ref --format='%(refname:short) %(upstream:track)' refs/heads |
  awk '$2 == "[gone]" {print $1}' | xargs -r git branch -d
```

Read the list first: drop the `xargs` part to see it. A gone upstream does not prove that the work was merged, so the command uses `-d`, which refuses branches with commits that are not merged. If your team squash-merges pull requests, `-d` refuses most of them, because the squash commit is a new commit. Check each refused branch, for example with `git log --oneline origin/main..<branch>` and the state of its pull request, before you delete it with `-D`. `git branch --merged main` lists the branches that are merged into `main`.

### When the delete fails

- **`error: Cannot delete branch 'x' checked out at '/path'`**: the branch is open in another [worktree](/guides/introduction-to-git/10-advanced-techniques#h2-worktrees-several-branches-checked-out-at-once). Switch that worktree to another branch, or remove it with `git worktree remove /path`.
- **The remote refuses:** GitHub does not let you delete the default branch, and branch protection rules can block a delete. Change the default branch or the rule first.
- **`error: unable to delete 'x': remote ref does not exist`**: someone already deleted it. Run `git fetch --prune`.

A deleted remote branch is gone from the server, but every clone that fetched it still has the commits. Push it again from such a clone with `git push origin <hash>:refs/heads/<name>`.

## Working with Different Remote Names

If your remote repository isn't named "origin", adjust the commands accordingly:

```bash
git push -u upstream feature/new-feature
git push -u github main
```

### List All Remotes

To see all configured remotes:

```bash
git remote -v
```

## Handling Common Scenarios

### Scenario 1: Creating and Pushing Feature Branch

```bash
# Create and switch to new branch
git checkout -b feature/shopping-cart

# Make your changes and commit
git add .
git commit -m "Implement shopping cart functionality"

# Push and set tracking
git push -u origin feature/shopping-cart
```

### Scenario 2: Push Branch with Different Remote Name

```bash
git checkout -b hotfix/critical-bug
git commit -m "Fix critical security vulnerability"
git push -u production hotfix/critical-bug
```

### Scenario 3: Push to Multiple Remotes

```bash
# Push to origin and set tracking
git push -u origin feature/api-integration

# Also push to backup remote
git push backup feature/api-integration
```

## Verifying Branch Relationships

### Check Branch Tracking Status

```bash
git status
```

With tracking set up, you'll see messages like:

```text
On branch feature/user-authentication
Your branch is up to date with 'origin/feature/user-authentication'.
```

### View All Branch Information

```bash
git branch -vv
```

This shows:

- Branch names
- Latest commit hashes
- Commit messages
- Tracking relationships

### Check Remote Branches

```bash
git branch -r
```

This lists all remote branches that your local Git knows about.

## Managing Branch Relationships

### Change Upstream Branch

To change which remote branch your local branch tracks:

```bash
git branch -u origin/different-branch
```

### Remove Tracking Relationship

```bash
git branch --unset-upstream
```

### Push to Different Branch Name

To push your local branch to a remote branch with a different name:

```bash
git push -u origin local-branch:remote-branch
```

Example:

```bash
git push -u origin feature/login:feature/user-authentication
```

## Advanced Push Options

### Replace a Branch You Pushed Before

A new branch never needs a force push. If you rewrote a branch that you pushed before, for example after a rebase, replace it with a lease:

```bash
git push --force-with-lease origin feature/branch
```

### Push All Branches

To push every local branch, also the ones that are not on the remote yet:

```bash
git push --all origin
```

Use it with care: it also publishes old experiments and backup branches. To push only the current branch by default, keep `push.default` at its default value, `simple`.

### Push Tags Along with Branch

```bash
git push -u origin feature/new-feature --tags
```

## Troubleshooting Common Issues

### Error: "The current branch has no upstream branch"

This means tracking isn't set up. Use:

```bash
git push -u origin <branch-name>
```

### Error: "failed to push some refs"

The remote repository might have changes you don't have locally:

```bash
git fetch origin
git pull origin <branch-name>
git push -u origin <branch-name>
```

### Error: "Permission denied"

Check your authentication and permissions:

```bash
git remote get-url origin
git config user.name
git config user.email
```

### Branch Already Exists on Remote

If the branch exists on the remote, someone else may have created it, or pushed to it. Fetch and look before you decide:

```bash
git fetch origin
git log --oneline <branch-name>..origin/<branch-name>   # commits on the remote that you do not have
```

If those commits belong to someone else, pick another branch name, or put your commits on top of theirs with `git rebase origin/<branch-name>` and push again. Only if you are sure the remote branch is yours and can go, replace it with `git push --force-with-lease -u origin <branch-name>`. A plain `--force` overwrites commits that you have not even seen.

## Best Practices

### Naming Conventions

Use clear, descriptive branch names:

```bash
git checkout -b feature/user-profile-editing
git checkout -b bugfix/login-validation-error
git checkout -b hotfix/security-patch-2024-12
```

### Regular Synchronization

After setting up tracking, regularly sync with remote:

```bash
git fetch origin
git pull
```

### Clean Up Local Tracking

Remove tracking for deleted remote branches:

```bash
git remote prune origin
```

### Verify Before Force Operations

Always check what you're about to push:

```bash
git log origin/<branch-name>..<branch-name>
git diff origin/<branch-name>
```

## Working in Teams

### Communicate Branch Creation

When working in teams, inform colleagues about new branches:

```bash
git push -u origin feature/team-collaboration
# Send notification to team about new branch
```

### Pull Request Workflow

After pushing your branch:

1. Create a pull request on your Git hosting platform
2. Share the branch name with reviewers
3. Keep the branch updated with main branch changes

### Branch Protection

For important branches, consider setting up protection rules on your Git hosting platform to prevent accidental force pushes.

## Summary Commands

Here's a quick reference for the most common operations:

```bash
# Create branch, make changes, and push with tracking
git checkout -b feature/new-feature
git add .
git commit -m "Add new feature"
git push -u origin feature/new-feature

# Set tracking for existing branch
git branch -u origin/feature/existing-branch

# Check tracking status
git branch -vv

# Push current branch with tracking
git push -u origin HEAD
```

By following these methods, you can efficiently push new local branches to remote repositories and establish proper tracking relationships, making your Git workflow smoother and more collaborative.

## Related Resources

- [Introduction to Git: Push, Fetch, Pull and Tracking Branches](/guides/introduction-to-git/06-remote-repositories#h2-tracking-branches)
- [Introduction to Git: List, Rename and Delete Branches](/guides/introduction-to-git/04-branching#h2-list-rename-and-delete-branches)
- [Fetch a remote branch and check it out](/posts/git-fetch-remote-branch)
- [Make an existing branch track a remote branch](/posts/make-git-branch-track-remote)
- [Git concepts simulator](/games/git-concepts-simulator)
- [Git branching strategies interview question](/interview-questions/topic/git#git-branching-strategies)
- Test yourself: [Git Command Quiz](/quizzes/git-quiz) and the [Git workflow exercise](/exercises/git-workflow-collaboration)
