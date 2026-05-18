---
title: 'Branching Basics'
order: 4
description: 'Create and manage Git branches for parallel development. Covers git branch, checkout, switch, isolating features, and the mental model behind branch pointers.'
---

One of Git's most powerful features is its branching system. Branches allow you to diverge from the main line of development and work on different features or fixes in isolation, without affecting the main codebase.

## Understanding Branches

A branch in Git is simply a lightweight movable pointer to a commit. The default branch in Git is called `main` (previously `master`). Every time you commit, the branch pointer automatically moves forward to your latest commit.

Think of branches as separate workspaces where you can develop features independently before merging them back together.

## Why Use Branches?

Branches serve several important purposes:

- **Isolation**: Develop new features without affecting the stable codebase
- **Experimentation**: Try out ideas without commitment
- **Parallel development**: Multiple developers can work on different features simultaneously
- **Organization**: Separate work by feature, bug fix, or release

## Creating Branches

To create a new branch:

```bash
git branch feature-login
```

This creates a new branch pointer at your current commit but doesn't switch to it. To create a branch and switch to it immediately:

```bash
git checkout -b feature-login
```

The above command is equivalent to:

```bash
git branch feature-login
git checkout feature-login
```

With newer Git versions (2.23+), you can use the more intuitive syntax:

```bash
git switch -c feature-login
```

## Listing Branches

To see all local branches:

```bash
git branch
```

The current branch will be marked with an asterisk (\*).

To see all branches, including remote branches:

```bash
git branch -a
```

To see the last commit on each branch:

```bash
git branch -v
```

## Switching Between Branches

To switch to an existing branch:

```bash
git checkout branch-name
```

Or with the newer syntax:

```bash
git switch branch-name
```

When you switch branches, Git updates the files in your working directory to match the snapshot of the branch you switched to. This means your working directory will look different after switching branches.

### Switching with Uncommitted Changes

If you have uncommitted changes when you try to switch branches, Git will:

1. Let you switch if the changes don't conflict with files in the target branch
2. Prevent you from switching if the changes would be overwritten

If you want to switch branches but aren't ready to commit your changes, you can use Git's stash feature:

```bash
git stash save "Work in progress on feature X"
git checkout other-branch
```

To get your changes back later:

```bash
git checkout original-branch
git stash pop
```

## Working with Branches

After creating a branch, you work with it just like any other Git environment:

1. Make changes to your files
2. Stage changes with `git add`
3. Commit changes with `git commit`

Each commit on your branch builds on the previous one, creating a separate line of development.

### Example Branch Workflow

Here's a typical workflow with branches:

```bash
# Create and switch to a feature branch
git checkout -b feature-user-profiles

# Make changes and commit them
echo "<h1>User Profile</h1>" > profile.html
git add profile.html
git commit -m "Add user profile page"

# Make more changes
echo "<div class='profile-content'></div>" >> profile.html
git add profile.html
git commit -m "Add content container to profile page"

# Switch back to main branch when done
git checkout main
```

## Branch Naming Conventions

Using consistent branch naming conventions helps keep your repository organized:

- **Feature branches**: `feature/feature-name` or `feature-name`
- **Bug fix branches**: `bugfix/issue-description` or `fix-issue-description`
- **Release branches**: `release/version-number`
- **Hotfix branches**: `hotfix/issue-description`

Choose a convention that works for your team and stick with it.

## Visualizing Branches

To see a graphical representation of your branch structure:

```bash
git log --graph --oneline --all
```

This command shows a text-based graph of your commit history across all branches.

For a more focused view of the current branch and its relation to other branches:

```bash
git log --graph --oneline --all --decorate
```

## Deleting Branches

After you've merged a branch, you often want to delete it to keep your repository clean:

```bash
git branch -d feature-login
```

If the branch hasn't been fully merged yet, Git will prevent its deletion. To force delete an unmerged branch:

```bash
git branch -D feature-login
```

> ⚠️ **Warning**: Force deleting a branch discards any unmerged work, so be careful.

## Renaming Branches

To rename the branch you're currently on:

```bash
git branch -m new-branch-name
```

To rename a branch you're not currently on:

```bash
git branch -m old-branch-name new-branch-name
```

## Moving Between Commits

Branches point to commits, but sometimes you want to directly check out a specific commit:

```bash
git checkout commit-hash
```

This puts you in a "detached HEAD" state, where you're not on any branch. This is useful for examining old versions of your code.

To create a new branch from this state:

```bash
git checkout -b new-branch-name
```

## Temporary Commits with Stash

Sometimes you need to switch branches but aren't ready to commit your changes. Git's stash feature lets you temporarily save changes without committing:

```bash
git stash
```

To apply the most recent stash and remove it from the stash list:

```bash
git stash pop
```

To list all stashes:

```bash
git stash list
```

To apply a specific stash:

```bash
git stash apply stash@{2}
```

Stashes are useful for quickly switching context without creating unnecessary commits.

## Best Practices for Branching

- **Keep branches focused**: Each branch should represent a single feature or fix
- **Regularly merge from main**: Update your feature branches with changes from main to reduce merge conflicts
- **Delete merged branches**: Keep your repository clean by deleting branches after merging
- **Use descriptive names**: Branch names should indicate what work is being done
- **Branch from the appropriate base**: Create branches from the point where the change should start

With these branching basics, you're now equipped to work on multiple features in parallel without affecting your main codebase. In the next section, we'll explore how to merge branches and resolve conflicts.
