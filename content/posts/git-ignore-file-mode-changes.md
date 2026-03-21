---
title: 'How to Make Git Ignore File Mode Changes'
excerpt: 'Git showing chmod changes you don not care about? Learn how to configure Git to ignore file permission changes while tracking actual code changes.'
category:
  name: 'Git'
  slug: 'git'
date: '2024-09-18'
publishedAt: '2024-09-18T14:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Configuration
  - Permissions
  - File Mode
  - Workflow
---

You run `git status` and see files marked as changed, but the only difference is their execute permission (chmod). This happens when moving files between different operating systems or when deployment scripts change permissions. Git can ignore these mode changes while still tracking actual content.

**TLDR:** To make Git ignore file mode (permission) changes, run `git config core.fileMode false` for the current repository, or `git config --global core.fileMode false` to apply globally. This makes Git ignore chmod changes but still track file content modifications.

In this guide, you'll learn how to configure Git to handle file permission changes.

## Prerequisites

You'll need Git installed on your system and basic familiarity with file permissions on Unix-like systems. Understanding the difference between file content and file metadata will be helpful.

## Understanding File Mode

Git tracks file permissions as part of metadata:

```bash
# See file permissions in Git
git ls-files --stage

# Output shows mode numbers:
# 100644 abc123... 0    regular-file.txt
# 100755 def456... 0    executable-script.sh
```

Mode numbers:
- `100644` - Regular file (not executable)
- `100755` - Executable file
- `120000` - Symbolic link

## Checking Current File Mode Setting

View your current configuration:

```bash
# Check repository setting
git config core.fileMode

# Check global setting
git config --global core.fileMode

# If not set, Git uses true (default)
```

## Disabling File Mode Tracking

To make Git ignore permission changes:

```bash
# Disable for current repository
git config core.fileMode false

# Verify setting
git config core.fileMode
# Output: false
```

After this, Git ignores chmod changes.

## Applying Globally

To disable for all repositories:

```bash
# Set globally
git config --global core.fileMode false

# Check all repositories now ignore file mode
git config --global core.fileMode
# Output: false
```

This affects all repositories on your machine.

## When File Mode Changes Appear

Common scenarios that trigger mode changes:

**Moving between Windows and Linux:**

```bash
# On Linux
git status
# nothing to commit, working tree clean

# On Windows (after checking out same repo)
git status
# modified:   script.sh
# (only mode change, no content change)
```

**After deployment scripts:**

```bash
# Deployment makes files executable
chmod +x deploy.sh

# Git sees this as change
git status
# modified:   deploy.sh
```

**Extracting from archives:**

```bash
# Unzip file
unzip project.zip

# Permissions may differ
git status
# modified:   (many files)
```

## Fixing Current Mode Changes

If you already have mode changes showing:

```bash
# See mode-only changes
git diff

# Update index to ignore current mode changes
git diff --summary | grep mode

# Apply fileMode setting
git config core.fileMode false

# Refresh index
git status
# Changes should disappear if they were mode-only
```

## When You Cannot Change Configuration

If you do not want to change config:

```bash
# Stage ignoring mode changes
git add --chmod=-x file.sh

# Or update without changing mode
git update-index --chmod=-x file.sh

# Commit
git commit -m "Update file (ignore mode changes)"
```

## Selective File Mode Handling

To ignore mode for some files but not others:

```bash
# Git doesn't support per-file fileMode
# But you can use update-index

# Mark specific file to skip mode
git update-index --assume-unchanged file.sh

# Later, re-enable tracking
git update-index --no-assume-unchanged file.sh
```

## Checking What Changed

To see if a change is mode-only or includes content:

```bash
# See all changes including mode
git diff

# Output shows:
# old mode 100644
# new mode 100755
# (if no content changes follow, it's mode-only)

# Ignore mode in diff
git diff --no-ext-diff
```

## Handling in Team Workflows

When working with a team across different OS:

```bash
# In team documentation:
# "All developers should run:
# git config core.fileMode false"

# Or add to repository setup script
#!/bin/bash
git config core.fileMode false
echo "File mode tracking disabled"
```

## Mode Changes in Pull Requests

When reviewing PRs with mode changes:

```bash
# View PR changes
git diff main..feature-branch

# If only mode changed
git diff --summary main..feature-branch | grep mode

# To ignore mode in review
git diff --no-ext-diff main..feature-branch
```

## Setting Executable Bit Explicitly

When you do want a file executable:

```bash
# Make file executable
chmod +x script.sh

# Force Git to track this
git update-index --chmod=+x script.sh

# Commit the mode change
git add script.sh
git commit -m "Make script.sh executable"
```

This explicitly sets the executable bit in Git.

## Mode Changes After Clone

After cloning on different OS:

```bash
# Clone repository
git clone url repo

# Set file mode to false immediately
cd repo
git config core.fileMode false

# Prevents mode differences from appearing
```

## Impact on Scripts and Executables

Be aware of implications:

```bash
# With fileMode=false:
# - Scripts may not be executable after checkout
# - Need to chmod +x manually
# - Or use shebang and interpreter explicitly

# Without fileMode=false:
# - Mode changes clutter git status
# - But executable bits are preserved
```

Choose based on your workflow needs.

## Windows-Specific Behavior

On Windows, fileMode is typically false by default:

```bash
# Windows Git Bash
git config core.fileMode
# false (default on Windows)

# This is because Windows doesn't have Unix permissions
```

## Checking File Permissions in Git

To see what Git thinks the mode is:

```bash
# Show file mode
git ls-files -s file.sh

# Output:
# 100755 abc123... 0    file.sh
#  ^^^-- executable
```

## Undoing File Mode Disable

If you need to re-enable mode tracking:

```bash
# Re-enable for repository
git config core.fileMode true

# Or remove setting (uses default)
git config --unset core.fileMode

# Globally
git config --global --unset core.fileMode
```

## Best Practices

Set fileMode based on team composition:

```bash
# Mixed Windows/Linux team
git config core.fileMode false

# All Unix team where permissions matter
git config core.fileMode true
```

Document the decision:

```bash
# Add to README.md
# File Permissions
# This project uses `core.fileMode=false` because
# the team works across Windows and Linux.
```

Use .gitattributes for specific files:

```bash
# .gitattributes
*.sh text eol=lf

# Ensures scripts work cross-platform
```

Set in repository setup:

```bash
# setup.sh
#!/bin/bash
echo "Setting up repository..."
git config core.fileMode false
echo "Done. File mode tracking disabled."
```

Consider automation tools:

```bash
# Use tools that handle permissions
# - Docker (consistent across systems)
# - VM (same OS for all)
```

## Troubleshooting

**File mode still showing as changed:**

```bash
# Check config is set
git config core.fileMode

# Refresh index
git update-index --refresh

# Reset if needed
git reset --hard
```

**Need different settings per repository:**

```bash
# Don't use --global
# Set per repository
cd repo1
git config core.fileMode false

cd repo2
git config core.fileMode true
```

**CI/CD pipelines failing due to permissions:**

```bash
# In CI script, explicitly set permissions
chmod +x scripts/*.sh

# Or configure CI environment
git config --global core.fileMode false
```

Now you know how to make Git ignore file mode changes. Use `git config core.fileMode false` to stop Git from tracking permission changes, which is especially useful in cross-platform development. This lets you focus on actual code changes rather than permission metadata.
