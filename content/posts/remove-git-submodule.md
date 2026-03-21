---
title: 'How to Remove a Git Submodule'
excerpt: 'Need to remove a Git submodule from your repository? Learn the proper steps to cleanly delete submodules and avoid leaving behind configuration artifacts.'
category:
  name: 'Git'
  slug: 'git'
date: '2024-11-22'
publishedAt: '2024-11-22T10:30:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Submodules
  - Version Control
  - Repository Management
  - Development
---

Git submodules can become unnecessary as projects evolve. Maybe you've decided to copy the code directly into your repository, or you're switching to a different dependency management approach. Removing a submodule requires more than just deleting the directory.

**TLDR:** To remove a Git submodule, run `git submodule deinit -f path/to/submodule`, then `git rm -f path/to/submodule`, and finally remove the submodule entry from `.git/config` if it still exists. Commit the changes to complete the removal.

In this guide, you'll learn how to properly remove Git submodules and clean up all associated configuration.

## Prerequisites

You'll need a Git repository with at least one submodule, Git installed on your system, and basic familiarity with Git commands. Understanding what submodules are and how they work will help you avoid common pitfalls.

## Understanding Git Submodules

A Git submodule is a repository nested inside another repository. When you add a submodule, Git stores references in several places:

- `.gitmodules` file - contains submodule path and URL mappings
- `.git/config` file - stores local configuration for the submodule
- `.git/modules/` directory - contains the actual submodule Git repository
- Working directory - the submodule files themselves

Removing a submodule requires cleaning up all these locations. Missing even one can cause Git to complain about the submodule in future operations.

## Modern Method: Using git submodule deinit

Git provides a built-in command to remove submodules cleanly. This is the recommended approach for Git 1.8.3 and later:

```bash
# Remove the submodule (replace with your submodule path)
git submodule deinit -f vendor/plugin

# Remove the submodule directory from Git tracking
git rm -f vendor/plugin

# Commit the changes
git commit -m "Remove vendor/plugin submodule"
```

The `deinit` command removes the submodule's entry from `.git/config` and deletes the submodule files from your working directory. The `git rm` command removes the submodule from the index and staging area.

After running these commands, check that the `.gitmodules` file was updated:

```bash
# View the .gitmodules file
cat .gitmodules
```

If your repository had multiple submodules, you'll see the others still listed. If you removed the only submodule, the file should be empty or deleted.

## Step-by-Step Manual Removal

If you're using an older version of Git or prefer to understand each step, here's the manual process:

First, deinitialize the submodule:

```bash
# Deinitialize the submodule
git submodule deinit -f vendor/plugin
```

This removes the submodule entry from `.git/config` and clears the working directory. The `-f` flag forces the operation even if the submodule has local modifications.

Next, remove the submodule from the repository:

```bash
# Remove from the index and working tree
git rm -f vendor/plugin
```

This stages the removal of the submodule directory and updates `.gitmodules`.

Remove the submodule's Git directory:

```bash
# Delete the submodule's git directory
rm -rf .git/modules/vendor/plugin
```

This removes the submodule's repository data from your main repository. Without this step, the submodule's history remains on disk even though it's no longer in use.

Finally, commit the changes:

```bash
# Commit the submodule removal
git commit -m "Remove vendor/plugin submodule"
```

## Verifying Complete Removal

After removing a submodule, verify that all references are gone:

```bash
# Check for submodule references in .gitmodules
cat .gitmodules

# Check for submodule config in .git/config
git config --list | grep submodule

# List submodules
git submodule status
```

If the removal was successful, your submodule will not appear in any of these outputs. The `.gitmodules` file should either not list your submodule or not exist if it was the only one.

## Handling Multiple Submodules

If you need to remove several submodules, you can loop through them:

```bash
# List of submodules to remove
submodules="vendor/plugin1 vendor/plugin2 lib/external"

# Remove each submodule
for submodule in $submodules; do
  git submodule deinit -f "$submodule"
  git rm -f "$submodule"
  rm -rf ".git/modules/$submodule"
done

# Commit all removals
git commit -m "Remove multiple submodules"
```

This approach removes multiple submodules in one commit, keeping your history clean.

## Replacing a Submodule with Regular Files

Sometimes you want to remove a submodule but keep its contents as regular files in your repository:

```bash
# Save the submodule path
SUBMODULE_PATH="vendor/plugin"

# Copy the submodule contents to a temporary location
cp -r "$SUBMODULE_PATH" /tmp/submodule-backup

# Remove the submodule
git submodule deinit -f "$SUBMODULE_PATH"
git rm -f "$SUBMODULE_PATH"
rm -rf ".git/modules/$SUBMODULE_PATH"

# Copy the files back as regular directory
cp -r /tmp/submodule-backup "$SUBMODULE_PATH"

# Add as regular files
git add "$SUBMODULE_PATH"

# Commit the change
git commit -m "Convert vendor/plugin from submodule to regular directory"
```

This preserves the code while removing the submodule relationship. The files are now part of your repository instead of being a reference to an external repository.

## Troubleshooting Common Issues

If you see errors like "No submodule mapping found in .gitmodules", the submodule might already be partially removed. You can manually clean up:

```bash
# Edit .gitmodules and remove the submodule entry manually
nano .gitmodules

# Edit .git/config and remove submodule entries
nano .git/config

# Remove the submodule directory
rm -rf path/to/submodule
rm -rf .git/modules/path/to/submodule

# Stage the changes
git add .gitmodules
git add path/to/submodule

# Commit
git commit -m "Clean up partially removed submodule"
```

## Removing All Submodules

To completely remove all submodules from a repository:

```bash
# Get list of all submodule paths
git config --file .gitmodules --get-regexp path | awk '{ print $2 }' | while read submodule; do
  git submodule deinit -f "$submodule"
  git rm -f "$submodule"
  rm -rf ".git/modules/$submodule"
done

# Remove the .gitmodules file if you removed all submodules
git rm .gitmodules

# Commit the changes
git commit -m "Remove all submodules"
```

After this, your repository no longer has any submodules.

## What Happens on Other Machines

After you push the submodule removal, other developers need to update their local repositories:

```bash
# Pull the changes
git pull

# Clean up the now-removed submodule directory
git submodule deinit -f path/to/removed/submodule
rm -rf path/to/removed/submodule
```

Git does not automatically remove submodule directories when you pull changes. Team members need to manually clean up their working directories.

Now you know how to properly remove Git submodules from your repository. The key is cleaning up all the references in `.gitmodules`, `.git/config`, and `.git/modules/` to avoid leaving behind configuration artifacts that can cause confusion later.
