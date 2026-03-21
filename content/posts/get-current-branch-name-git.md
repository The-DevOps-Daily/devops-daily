---
title: 'How to Get the Current Branch Name in Git'
excerpt: 'Need to programmatically get the current Git branch name? Learn multiple methods to retrieve the branch name for scripts, CI/CD pipelines, and shell prompts.'
category:
  name: 'Git'
  slug: 'git'
date: '2025-04-05'
publishedAt: '2025-04-05T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Version Control
  - Scripting
  - Automation
  - Command Line
---

When working with Git in scripts, CI/CD pipelines, or shell configurations, you often need to programmatically determine the current branch name. Git provides several methods to retrieve this information, each suited for different use cases.

**TLDR:** To get the current branch name, use `git branch --show-current` (Git 2.22+) or `git rev-parse --abbrev-ref HEAD` for older versions. For scripts, store it in a variable with `BRANCH=$(git branch --show-current)`.

In this guide, you'll learn different ways to get the current branch name and when to use each method.

## Prerequisites

You'll need Git installed on your system and a repository with at least one branch. Basic familiarity with the command line and shell scripting will help if you plan to use these commands in automation.

## Modern Method: git branch --show-current

The simplest way to get the current branch name is with the `--show-current` flag:

```bash
# Get current branch name
git branch --show-current
```

This outputs just the branch name with no additional formatting:

```
feature-auth
```

This command works in Git 2.22 and later. It's perfect for scripts and automation because it outputs only the branch name with no extra text.

Store the branch name in a variable:

```bash
# Save branch name to a variable
BRANCH=$(git branch --show-current)

# Use the variable
echo "Currently on branch: $BRANCH"
```

This method is clean, reliable, and easy to understand when reading scripts.

## Using git rev-parse

For older Git versions or when you need more flexibility, use `git rev-parse`:

```bash
# Get current branch name (works with older Git versions)
git rev-parse --abbrev-ref HEAD
```

This also outputs just the branch name:

```
feature-auth
```

The `--abbrev-ref` flag tells Git to output the shortened reference name. `HEAD` is a pointer to your current commit, which is usually attached to a branch.

In scripts, use it the same way:

```bash
# Store in variable
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Conditional logic based on branch
if [ "$CURRENT_BRANCH" = "main" ]; then
  echo "You're on the main branch"
else
  echo "You're on branch: $CURRENT_BRANCH"
fi
```

## Getting Branch Name with git symbolic-ref

Another method uses `git symbolic-ref` to read the symbolic reference HEAD points to:

```bash
# Get full branch reference
git symbolic-ref HEAD

# Output: refs/heads/feature-auth
```

This outputs the full reference path. To get just the branch name, use parameter expansion or basename:

```bash
# Extract just the branch name
git symbolic-ref --short HEAD

# Or manually with basename
basename $(git symbolic-ref HEAD)
```

This method is useful when you need to distinguish between branches and other refs, or when working with Git's internal reference structure.

## Using git branch with Grep

Before `--show-current` existed, the common approach was filtering the branch list:

```bash
# Get current branch using grep
git branch | grep '\*' | sed 's/\* //'

# Or using awk
git branch | grep '\*' | awk '{print $2}'
```

The asterisk marks the current branch in the `git branch` output. These commands filter for that line and extract just the name.

While this works, it's less efficient than the modern methods because it lists all branches first, then filters them.

## Checking for Detached HEAD State

When you checkout a specific commit instead of a branch, you enter "detached HEAD" state. In this state, HEAD points directly to a commit rather than a branch:

```bash
# This returns "HEAD" in detached state
git rev-parse --abbrev-ref HEAD
```

To handle detached HEAD in scripts:

```bash
# Get branch name or commit hash
BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [ "$BRANCH" = "HEAD" ]; then
  # In detached HEAD state, get commit hash instead
  BRANCH=$(git rev-parse --short HEAD)
  echo "Detached HEAD at commit: $BRANCH"
else
  echo "On branch: $BRANCH"
fi
```

This makes sure your scripts handle both normal branch checkouts and detached HEAD states gracefully.

## Using Branch Name in Scripts

Here's a practical example of using the branch name in a deployment script:

```bash
#!/bin/bash

# Get current branch
BRANCH=$(git branch --show-current)

# Deploy based on branch
case "$BRANCH" in
  main)
    echo "Deploying to production..."
    ./deploy-prod.sh
    ;;
  staging)
    echo "Deploying to staging..."
    ./deploy-staging.sh
    ;;
  *)
    echo "Branch '$BRANCH' is not configured for deployment"
    exit 1
    ;;
esac
```

This pattern is common in CI/CD pipelines where different branches trigger different deployment workflows.

## Getting Branch Name in CI/CD

Many CI/CD systems provide the branch name as an environment variable, but you can also get it from Git:

```bash
# GitHub Actions
echo "Branch: ${GITHUB_REF#refs/heads/}"

# GitLab CI
echo "Branch: $CI_COMMIT_REF_NAME"

# Generic Git command (works everywhere)
BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "Branch: $BRANCH"
```

Using the Git command directly makes your scripts portable across different CI/CD platforms.

## Setting Git Alias for Branch Name

Create a Git alias to quickly get the branch name:

```bash
# Create alias
git config --global alias.current-branch 'branch --show-current'

# Use the alias
git current-branch
```

This is convenient for interactive use and makes your intent clear when reading Git commands.

Another useful alias shows the branch with additional context:

```bash
# Create informative branch alias
git config --global alias.branch-info '!git branch --show-current && git log -1 --oneline'

# Use it
git branch-info
# Output:
# feature-auth
# a1b2c3d Add OAuth support
```

## Displaying Branch in Shell Prompt

Many developers configure their shell prompt to show the current branch. Here's how to do it in Bash:

```bash
# Add to ~/.bashrc
parse_git_branch() {
  git branch --show-current 2>/dev/null
}

# Update PS1 prompt
PS1='\u@\h:\w $(parse_git_branch)\$ '
```

This changes your prompt from:

```
user@hostname:~/project$
```

to:

```
user@hostname:~/project feature-auth$
```

For Zsh, use the built-in vcs_info:

```bash
# Add to ~/.zshrc
autoload -Uz vcs_info
precmd() { vcs_info }
zsetopt prompt_subst
PROMPT='%n@%m:%~ ${vcs_info_msg_0_}$ '
```

## Using Branch Name in Commit Messages

Some teams include the branch name in commit messages:

```bash
#!/bin/bash

# Get branch name
BRANCH=$(git branch --show-current)

# Create commit with branch name
MESSAGE="[$BRANCH] Implement user authentication"
git commit -m "$MESSAGE"
```

This is especially useful when branch names include issue numbers:

```bash
# If branch is feature/JIRA-123-add-auth
# Commit message becomes: [feature/JIRA-123-add-auth] Implement user authentication
```

## Validating Branch Names

You can use the branch name to enforce naming conventions:

```bash
#!/bin/bash

BRANCH=$(git branch --show-current)

# Validate branch naming convention
if [[ ! $BRANCH =~ ^(feature|bugfix|hotfix)/ ]]; then
  echo "Error: Branch name must start with feature/, bugfix/, or hotfix/"
  exit 1
fi

echo "Branch name is valid: $BRANCH"
```

This script is useful as a pre-push Git hook to enforce team standards.

## Handling Special Characters

Branch names can contain slashes and other characters. When using them in scripts, quote the variable:

```bash
BRANCH=$(git branch --show-current)

# Always quote to handle spaces and special characters
git push origin "$BRANCH"

# Not recommended (breaks with special characters)
git push origin $BRANCH
```

This prevents issues when branch names contain spaces or shell-special characters.

Now you know multiple ways to get the current Git branch name, from simple one-liners for scripts to methods that handle edge cases like detached HEAD states. The `git branch --show-current` command is the cleanest option for modern Git versions, while `git rev-parse --abbrev-ref HEAD` provides backward compatibility.
