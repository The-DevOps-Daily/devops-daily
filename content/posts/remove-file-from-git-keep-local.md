---
title: 'How to Remove a File from Git Without Deleting It Locally'
excerpt: 'Need to stop tracking a file in Git but keep it on your filesystem? Learn how to remove files from Git repository while preserving them locally.'
category:
  name: 'Git'
  slug: 'git'
date: '2024-09-15'
publishedAt: '2024-09-15T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Version Control
  - File Management
  - Gitignore
  - Repository
---

You accidentally committed a configuration file or environment file that should not be tracked in Git. Now you want to remove it from the repository while keeping it on your local machine for development.

**TLDR:** To remove a file from Git without deleting it locally, use `git rm --cached filename`. This removes the file from Git's index while keeping it in your working directory. Add the file to `.gitignore` to prevent accidentally tracking it again in the future.

In this guide, you'll learn how to stop tracking files in Git while preserving them on your filesystem.

## Prerequisites

You'll need Git installed on your system and a repository with files you want to stop tracking. Basic familiarity with Git commands like add, commit, and gitignore will be helpful.

## Understanding Git's File Tracking

Git tracks files in three main areas:

```
Working Directory  →  Staging Area  →  Repository
(your files)          (git add)        (git commit)
```

When you remove a file with `git rm`, it deletes it from both the staging area and your working directory. To keep it locally, you need the `--cached` flag, which only removes it from Git's tracking.

## Removing a Single File

To stop tracking a specific file while keeping it locally:

```bash
# Remove from Git but keep local copy
git rm --cached config.json

# Check the status
git status
```

Git now shows the file as deleted from the repository:

```
Changes to be committed:
  deleted:    config.json

Untracked files:
  config.json
```

The file is marked as deleted in the staging area but still exists in your working directory. Commit this change:

```bash
# Commit the removal
git commit -m "Stop tracking config.json"

# Push to remote
git push origin main
```

After this, the file remains on your local machine but is no longer tracked by Git.

## Preventing Future Tracking

To make sure you do not accidentally add the file back to Git, add it to `.gitignore`:

```bash
# Add to gitignore
echo "config.json" >> .gitignore

# Commit the gitignore change
git add .gitignore
git commit -m "Add config.json to gitignore"
```

Now Git will ignore this file in future commits, even if you run `git add .`.

## Removing Multiple Files

To remove several files at once:

```bash
# Remove multiple specific files
git rm --cached secrets.env database.config api-keys.json

# Or use wildcards
git rm --cached *.log

# Commit the changes
git commit -m "Stop tracking configuration and log files"
```

This is useful when you have multiple environment files or logs that should not be in version control.

## Removing an Entire Directory

To stop tracking a directory while keeping it locally:

```bash
# Remove directory from Git
git rm --cached -r node_modules/

# Add to gitignore
echo "node_modules/" >> .gitignore

# Commit the changes
git add .gitignore
git commit -m "Stop tracking node_modules directory"
```

The `-r` flag makes the removal recursive, handling all files and subdirectories within the directory.

## Common Use Cases

**Environment Files**

Environment files contain sensitive data like API keys and database passwords:

```bash
# Stop tracking env file
git rm --cached .env

# Add to gitignore
echo ".env" >> .gitignore

# Create a template for others
cp .env .env.example
git add .env.example

# Commit changes
git commit -m "Stop tracking .env, add .env.example template"
```

This approach lets you provide a template (`.env.example`) while keeping actual credentials private.

**IDE Configuration**

IDE-specific files like VS Code or JetBrains settings:

```bash
# Remove IDE files
git rm --cached -r .vscode/
git rm --cached -r .idea/

# Add to gitignore
cat >> .gitignore << EOF
.vscode/
.idea/
*.swp
*.swo
EOF

# Commit
git add .gitignore
git commit -m "Stop tracking IDE configuration files"
```

**Build Artifacts**

Compiled code and build outputs that can be regenerated:

```bash
# Remove build directories
git rm --cached -r dist/
git rm --cached -r build/
git rm --cached -r target/

# Add to gitignore
cat >> .gitignore << EOF
dist/
build/
target/
EOF

git add .gitignore
git commit -m "Stop tracking build artifacts"
```

## Verifying the File is No Longer Tracked

After removing a file, verify it is no longer in the repository:

```bash
# Check repository status
git status

# Verify file exists locally
ls -la config.json

# Confirm file is not in Git
git ls-files | grep config.json
```

If `git ls-files` returns no results, the file is successfully removed from Git's tracking.

## What Happens to Other Team Members

When others pull your changes:

```bash
# On another machine after pulling
git pull origin main
```

Git will remove the file from their working directory. They'll need to recreate it:

```bash
# File is now deleted locally
# They need to recreate it from the example
cp .env.example .env

# Then edit it with their own values
nano .env
```

This is why providing an example file (like `.env.example`) is important - it shows others what configuration they need.

## Removing Files That Were Already in History

Using `git rm --cached` only affects future commits. The file still exists in your repository's history. To completely remove it from all history (useful for accidentally committed secrets):

```bash
# Remove from all history (be careful!)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch config.json" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (only if you're sure!)
git push origin --force --all
```

**Warning:** This rewrites history and requires force pushing. Only do this if the file contained sensitive data and you need to remove it completely. Coordinate with your team before rewriting shared history.

For a safer modern alternative, use `git filter-repo`:

```bash
# Install git-filter-repo first
# Then remove file from all history
git filter-repo --path config.json --invert-paths

# Force push
git push origin --force --all
```

## Handling Already Ignored Files

If you added a file to `.gitignore` but it is still being tracked:

```bash
# The file is in gitignore but still tracked
cat .gitignore | grep config.json
# config.json

# Git still shows changes
git status
# modified: config.json

# Remove from tracking
git rm --cached config.json
git commit -m "Stop tracking config.json"
```

Adding a file to `.gitignore` does not automatically untrack it. You must explicitly remove it with `git rm --cached`.

## Bulk Removal of Ignored Files

To remove all currently tracked files that are now in `.gitignore`:

```bash
# Remove all tracked files temporarily
git rm -r --cached .

# Re-add everything (respecting gitignore)
git add .

# Review what was removed
git status

# Commit the cleanup
git commit -m "Stop tracking files now in gitignore"
```

This is useful after updating `.gitignore` to exclude patterns that were previously tracked.

## Alternative: Using git update-index

For temporary local changes you do not want to commit:

```bash
# Tell Git to ignore changes to this file
git update-index --assume-unchanged config.json

# Make local changes without Git tracking them
nano config.json

# Git will not show the file as modified
git status
```

To start tracking changes again:

```bash
# Resume tracking changes
git update-index --no-assume-unchanged config.json
```

This is different from `git rm --cached` because the file remains in the repository. It is useful for files that need to exist in the repo but have local modifications you do not want to commit.

## Best Practices

Always add removed files to `.gitignore` immediately:

```bash
# Good practice: Remove and ignore in one step
git rm --cached secrets.env && echo "secrets.env" >> .gitignore
git add .gitignore
git commit -m "Stop tracking and ignore secrets.env"
```

Create example files for necessary configuration:

```bash
# Provide templates for required files
cp database.config database.config.example

# Remove sensitive values from example
sed -i 's/password=.*/password=YOUR_PASSWORD_HERE/' database.config.example

# Track the example, ignore the real file
git add database.config.example
echo "database.config" >> .gitignore
git add .gitignore
git commit -m "Add database config template"
```

Document what files team members need to create:

```markdown
# README.md
## Setup

Create the following files from their examples:

```bash
cp .env.example .env
cp database.config.example database.config
```

Then edit with your own values.
```

Now you know how to remove files from Git without deleting them locally. The `git rm --cached` command is your primary tool, and combining it with `.gitignore` prevents the files from being tracked again in the future.
