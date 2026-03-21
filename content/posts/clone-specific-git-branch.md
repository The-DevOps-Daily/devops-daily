---
title: 'How to Clone a Specific Git Branch'
excerpt: 'Need to clone just one branch instead of the entire repository? Learn how to clone a specific Git branch directly and save time and disk space.'
category:
  name: 'Git'
  slug: 'git'
date: '2025-05-12'
publishedAt: '2025-05-12T08:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Clone
  - Branches
  - Version Control
  - Workflows
---

When cloning a repository, Git downloads all branches by default, even though you only see the default branch checked out. For large repositories with many branches, this wastes time and disk space. If you only need to work with a specific branch, you can clone just that branch.

**TLDR:** To clone a specific branch, use `git clone -b branch-name --single-branch repository-url`. This downloads only the specified branch and its history. For shallow clones with limited history, add `--depth 1` to the command.

In this guide, you'll learn how to clone specific branches efficiently and when to use different cloning strategies.

## Prerequisites

You'll need Git installed on your system and the URL of the repository you want to clone. Basic familiarity with Git branches and the clone command will help you understand the options.

## Cloning a Specific Branch

To clone a specific branch directly:

```bash
# Clone only the develop branch
git clone -b develop --single-branch https://github.com/username/repository.git

# Clone only a feature branch
git clone -b feature-auth --single-branch https://github.com/username/repository.git
```

The `-b` flag specifies which branch to clone, and `--single-branch` tells Git to only fetch that branch's history. After cloning, you're checked out to the specified branch with only that branch in your local repository.

Verify what you cloned:

```bash
cd repository

# Check current branch
git branch

# Output:
# * develop

# See all branches including remote
git branch -a

# Output:
# * develop
#   remotes/origin/develop
```

Notice that only the specified branch appears, not other branches from the repository.

## Shallow Clone of a Specific Branch

For even faster cloning, combine `--single-branch` with `--depth` to limit history:

```bash
# Clone with only the latest commit
git clone -b main --single-branch --depth 1 https://github.com/username/repository.git

# Clone with the last 10 commits
git clone -b develop --depth 10 --single-branch https://github.com/username/repository.git
```

This approach downloads only the specified number of recent commits, dramatically reducing clone time and disk usage for large repositories.

Shallow clones are perfect for CI/CD pipelines or when you only need to build or test the latest code.

## Cloning and Later Fetching Other Branches

If you clone with `--single-branch` but later need other branches, you can fetch them:

```bash
# Clone only main branch
git clone -b main --single-branch https://github.com/username/repository.git
cd repository

# Later, configure to fetch all branches
git config remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*"

# Fetch all branches
git fetch origin

# Check out another branch
git checkout develop
```

This gives you the initial speed benefit of single-branch cloning while maintaining flexibility for future work.

## Cloning vs. Checking Out After Clone

An alternative approach is to clone normally, then immediately switch to your desired branch:

```bash
# Clone the repository (gets all branches)
git clone https://github.com/username/repository.git
cd repository

# Switch to the branch you want
git checkout feature-auth
```

This method makes sense when:
- You'll likely need multiple branches
- The repository is not large
- You want full access to all branches from the start

Compare the approaches:

```bash
# Method 1: Clone specific branch (faster, less disk space)
git clone -b feature-auth --single-branch https://github.com/username/repo.git

# Method 2: Clone all, then checkout (more complete, more flexible)
git clone https://github.com/username/repo.git && cd repo && git checkout feature-auth
```

## Using Clone with a Custom Directory Name

Specify a directory name when cloning:

```bash
# Clone into custom directory
git clone -b develop --single-branch https://github.com/username/repository.git my-project

cd my-project
```

This is useful when you want to clone multiple branches into separate directories:

```bash
# Clone main branch to one directory
git clone -b main --single-branch https://github.com/username/repo.git repo-main

# Clone develop branch to another directory
git clone -b develop --single-branch https://github.com/username/repo.git repo-develop
```

Now you can work on both branches simultaneously without switching.

## Cloning Non-Default Branches

When cloning a specific branch that is not the default, the syntax is the same:

```bash
# Clone a feature branch
git clone -b feature/new-ui --single-branch https://github.com/username/repository.git

# Clone a release branch
git clone -b release/v2.0 --single-branch https://github.com/username/repository.git
```

Git does not distinguish between default and non-default branches - any branch can be cloned directly.

## Converting a Shallow Clone to Full Clone

If you cloned with `--depth` and later need the full history:

```bash
# Fetch all history for current branch
git fetch --unshallow

# Now you have complete history
git log --oneline
```

The `--unshallow` flag converts your shallow clone to a full clone by downloading all missing commits.

## Adding More Branches to Single-Branch Clone

After cloning with `--single-branch`, fetch specific additional branches:

```bash
# Clone only main
git clone -b main --single-branch https://github.com/username/repository.git
cd repository

# Fetch a specific branch
git fetch origin develop:develop

# Check out the newly fetched branch
git checkout develop
```

This syntax (`origin develop:develop`) fetches the remote `develop` branch and creates a local branch with the same name.

## Cloning Tags

You can also clone specific tags:

```bash
# Clone at a specific tag
git clone -b v1.0.0 --single-branch https://github.com/username/repository.git

# Verify you're at the tag
git describe --tags
```

This is useful when you need to work with a specific release version.

## Using Git Clone for CI/CD

In CI/CD pipelines, cloning specific branches with limited depth speeds up builds:

```bash
# Fast clone for CI/CD
git clone -b $BRANCH_NAME --single-branch --depth 1 https://github.com/username/repo.git

# Example in GitHub Actions workflow
- uses: actions/checkout@v3
  with:
    ref: develop
    fetch-depth: 1
```

Most CI/CD systems provide optimized checkout actions that handle this automatically, but understanding the underlying Git commands helps when debugging or creating custom workflows.

## Checking Clone Configuration

After cloning, verify your repository configuration:

```bash
# See remote configuration
git remote -v

# Check fetch configuration
git config --get remote.origin.fetch

# If single-branch was used, output is:
# +refs/heads/main:refs/remotes/origin/main

# For normal clones, output is:
# +refs/heads/*:refs/remotes/origin/*
```

This shows whether you have a single-branch or multi-branch clone.

## Handling Protected Branches

When cloning protected branches (like main or master), you might need authentication:

```bash
# Clone with HTTPS (prompts for credentials)
git clone -b main --single-branch https://github.com/username/private-repo.git

# Clone with SSH (uses SSH key)
git clone -b main --single-branch git@github.com:username/private-repo.git
```

SSH cloning is faster and more secure for repositories you frequently access, as it uses SSH keys instead of passwords.

## Cloning Specific Branches from Multiple Repositories

When working with microservices or multiple related repositories:

```bash
#!/bin/bash

# Clone specific branch from multiple repos
repos=(
  "frontend"
  "backend"
  "api-gateway"
)

for repo in "${repos[@]}"; do
  git clone -b develop --single-branch \
    "https://github.com/company/$repo.git" \
    "$repo-develop"
done
```

This script clones the develop branch from multiple repositories into separate directories.

## Sparse Checkout for Partial Clones

For even more granular control, combine specific branch cloning with sparse checkout:

```bash
# Clone specific branch
git clone -b main --single-branch --depth 1 https://github.com/username/repo.git
cd repo

# Enable sparse checkout
git sparse-checkout init --cone

# Only checkout specific directories
git sparse-checkout set src/app tests
```

This downloads only the specified branch and only checks out specific directories, perfect for monorepos where you only need a subset of the code.

Now you know how to clone specific Git branches efficiently. Using `-b` with `--single-branch` gives you fast, focused clones perfect for single-purpose work, CI/CD pipelines, or when working with large repositories where you only need one branch.
