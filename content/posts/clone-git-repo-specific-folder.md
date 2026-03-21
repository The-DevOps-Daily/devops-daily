---
title: 'How to Clone a Git Repository into a Specific Folder'
excerpt: 'Want to clone a repository into a custom directory name? Learn how to specify the target folder when cloning Git repositories.'
category:
  name: 'Git'
  slug: 'git'
date: '2025-05-30'
publishedAt: '2025-05-30T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '4 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Clone
  - Directory
  - Workflow
  - Setup
---

When you clone a repository, Git creates a folder based on the repository name. Sometimes you want a different folder name or need to clone into a specific location. Git lets you specify the target directory when cloning.

**TLDR:** To clone into a specific folder, add the folder name after the repository URL: `git clone repository-url folder-name`. To clone into the current directory, use `git clone repository-url .` (dot). The folder is created if it does not exist.

In this guide, you'll learn how to control where Git clones repositories.

## Prerequisites

You'll need Git installed on your system and a repository URL to clone. Basic familiarity with the command line and Git clone command will be helpful.

## Basic Clone with Custom Folder

To clone into a specific folder:

```bash
# Clone into custom folder
git clone https://github.com/username/repository.git my-project

# Creates folder named 'my-project' instead of 'repository'
cd my-project
```

The folder name you specify does not need to match the repository name.

## Cloning into Current Directory

To clone into the current directory (it must be empty):

```bash
# Create and enter directory
mkdir my-project
cd my-project

# Clone into current directory
git clone https://github.com/username/repository.git .

# The dot means "current directory"
```

This is useful when you already created the folder and want to clone into it.

## Cloning with Full Path

You can specify a complete path:

```bash
# Clone to absolute path
git clone https://github.com/username/repository.git /home/user/projects/my-app

# Or relative path
git clone https://github.com/username/repository.git ../other-project

# Or with spaces (use quotes)
git clone https://github.com/username/repository.git "My Project Folder"
```

## Cloning into Nested Directories

Git creates parent directories if they do not exist:

```bash
# Creates both 'projects' and 'frontend' folders
git clone https://github.com/username/repo.git projects/frontend

cd projects/frontend
```

All parent directories are created automatically.

## Cloning Multiple Branches into Separate Folders

To have different branches in different folders:

```bash
# Clone main branch
git clone https://github.com/username/repo.git repo-main

# Clone to another folder for develop branch
git clone -b develop https://github.com/username/repo.git repo-develop

# Clone for feature branch
git clone -b feature-x https://github.com/username/repo.git repo-feature-x
```

Now you can work on multiple branches simultaneously.

## Cloning with Project Structure

For organizing multiple related repositories:

```bash
# Create project structure
mkdir -p myproject/{frontend,backend,mobile}

# Clone into structure
git clone https://github.com/company/frontend.git myproject/frontend
git clone https://github.com/company/backend.git myproject/backend
git clone https://github.com/company/mobile.git myproject/mobile

# Result:
# myproject/
#   frontend/
#   backend/
#   mobile/
```

## Handling Existing Folders

If the folder already exists and is not empty:

```bash
# Try to clone
git clone https://github.com/username/repo.git existing-folder

# Error: destination path 'existing-folder' already exists and is not an empty directory

# Solutions:
# 1. Use different name
git clone https://github.com/username/repo.git existing-folder-new

# 2. Delete folder first
rm -rf existing-folder
git clone https://github.com/username/repo.git existing-folder

# 3. Clone into it if empty
git clone https://github.com/username/repo.git existing-folder/.
```

## Cloning with SSH vs HTTPS

The folder name syntax works with any protocol:

```bash
# HTTPS
git clone https://github.com/username/repo.git my-folder

# SSH
git clone git@github.com:username/repo.git my-folder

# Git protocol
git clone git://github.com/username/repo.git my-folder

# Local path
git clone /path/to/repo.git my-folder
```

## Cloning Bare Repositories

To clone as a bare repository (no working directory):

```bash
# Clone bare repository
git clone --bare https://github.com/username/repo.git repo.git

# Typically named with .git extension
```

Bare repositories are used for central repos or mirrors.

## Cloning into Subdirectory of Existing Repo

You cannot clone into a subdirectory of another Git repository:

```bash
# This fails
cd existing-repo
git clone https://github.com/username/other-repo.git subdir

# Error: refusing to create alternate object database

# Solution: Use submodules
git submodule add https://github.com/username/other-repo.git subdir
```

## Scripting Multiple Clones

Automate cloning multiple repositories:

```bash
#!/bin/bash
# clone-all.sh

repos=(
    "https://github.com/company/frontend:frontend"
    "https://github.com/company/backend:backend"
    "https://github.com/company/api:api"
)

for repo in "${repos[@]}"; do
    url="${repo%:*}"
    folder="${repo#*:}"
    echo "Cloning $url into $folder"
    git clone "$url" "$folder"
done
```

## Cloning with Custom Configuration

Set configuration while cloning:

```bash
# Clone with custom origin name
git clone -o upstream https://github.com/username/repo.git my-folder

# Verify
cd my-folder
git remote -v
# upstream  https://github.com/username/repo.git (fetch)
```

## Cloning Specific Branch to Folder

Clone a specific branch into custom folder:

```bash
# Clone specific branch
git clone -b develop --single-branch https://github.com/username/repo.git develop-folder

cd develop-folder
git branch
# * develop
```

## Shallow Clone into Folder

Clone with limited history into specific folder:

```bash
# Shallow clone
git clone --depth 1 https://github.com/username/repo.git quick-clone

# Only latest commit is cloned
cd quick-clone
git log --oneline
# Shows only 1 commit
```

## Renaming After Clone

If you cloned with the default name and want to rename:

```bash
# Clone with default name
git clone https://github.com/username/repository.git

# Rename the folder
mv repository my-project

cd my-project
# Everything still works
```

Git does not care about the folder name after cloning.

## Cloning into Symbolic Link

You can clone through symbolic links:

```bash
# Create symbolic link
ln -s /mnt/storage/projects /home/user/dev

# Clone into linked location
git clone https://github.com/username/repo.git /home/user/dev/my-project

# Physically stored at /mnt/storage/projects/my-project
```

## Common Patterns

**Workspace organization:**

```bash
# By company
git clone https://github.com/company/repo.git ~/work/company/repo

# By language
git clone https://github.com/user/js-project.git ~/projects/javascript/js-project

# By status
git clone https://github.com/user/active-project.git ~/active/project
```

**Testing different versions:**

```bash
# Current stable
git clone -b main https://github.com/user/repo.git repo-stable

# Beta version
git clone -b beta https://github.com/user/repo.git repo-beta

# Development
git clone -b develop https://github.com/user/repo.git repo-dev
```

## Best Practices

Use descriptive folder names:

```bash
# Good: Clear what it is
git clone url company-website-frontend

# Less clear: Needs context
git clone url frontend
```

Follow consistent naming:

```bash
# Consistent pattern
git clone url client-portal-web
git clone url client-portal-api
git clone url client-portal-mobile
```

Organize by project:

```bash
mkdir client-portal
git clone url1 client-portal/web
git clone url2 client-portal/api
git clone url3 client-portal/mobile
```

Use short names for frequent access:

```bash
# If you type it often, keep it short
git clone https://github.com/long-company-name/repository-name.git proj
```

Document in team workflows:

```bash
# In README or docs:
# Clone to: git clone <url> project-frontend
# This matches team convention
```

## Troubleshooting

**Error: Folder already exists**

```bash
# Check if folder exists
ls -la folder-name

# Remove or use different name
rm -rf folder-name
git clone url folder-name
```

**Error: Permission denied**

```bash
# Check parent directory permissions
ls -ld parent-directory

# Use sudo if needed (be careful)
sudo git clone url /var/www/project
```

**Error: Invalid path**

```bash
# On Windows, avoid these characters: < > : " / \ | ? *
git clone url valid-folder-name

# Not: my-project/feature
# Use: my-project-feature
```

Now you know how to clone a Git repository into a specific folder. Simply add the folder name as an argument after the repository URL: `git clone url folder-name`. This gives you control over your project organization and folder structure.
