---
title: 'Understanding Git Fundamentals'
order: 1
description: 'Git fundamentals explained: distributed version control, the working tree, staging area, and repository, plus the three file states and your first config.'
---

Git is a distributed version control system that helps you track changes in your code, collaborate with others, and maintain a history of your project. Whether you're working alone or as part of a team, Git provides powerful tools to manage your codebase efficiently.

This guide will introduce you to Git's core concepts and show you how to use it in your daily workflow. By the end, you'll understand how to track changes, create repositories, and use essential Git commands.

## What is Git?

Git is a distributed version control system created by Linus Torvalds in 2005. Unlike centralized version control systems, Git gives each developer a complete copy of the repository, including its full history. This means you can work offline, commit changes locally, and synchronize with remote repositories when needed.

Key characteristics of Git include:

- **Speed and efficiency**: Git is designed to handle projects of any size with speed
- **Data integrity**: Git uses SHA-1 hashes to ensure data integrity
- **Distributed workflow**: Everyone has a full copy of the repository
- **Branching capabilities**: Git makes branching and merging operations simple and fast

## How Git Works

To understand Git, you need to know how it tracks your files:

### The Three States

Files in Git pass through three main states:

1. **Modified**: You've changed the file, but haven't committed it yet
2. **Staged**: You've marked a modified file to go into your next commit
3. **Committed**: Your changes are safely stored in your local database

These states correspond to the three main sections of a Git project:

- **Working directory**: Where you modify files
- **Staging area** (or index): Where you prepare what you'll commit next
- **Git repository**: Where Git stores your project data and history

### Snapshots, Not Differences

Instead of storing differences between files (like many other version control systems), Git stores snapshots of your entire project. When you commit, Git takes a "picture" of what your files look like and stores a reference to that snapshot.

For efficiency, if a file hasn't changed, Git doesn't store it again, it just links to the previous identical file it has already stored.

## Installing Git

Before you can start using Git, you'll need to install it on your system.

### On Ubuntu/Debian

```bash
sudo apt update
sudo apt install git
```

### On macOS

You can install Git via Homebrew:

```bash
brew install git
```

Or download the installer from the [Git website](https://git-scm.com/download/mac).

### On Windows

Download and install Git from the [Git website](https://git-scm.com/download/win).

### Verifying Your Installation

To verify that Git is installed correctly, run:

```bash
git --version
```

This should display the installed Git version, like `git version 2.34.1`.

## Configuring Git

After installing Git, you should set your identity. This information will be attached to your commits.

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

You can also set your preferred text editor:

```bash
git config --global core.editor "vim"  # Or nano, emacs, etc.
```

To check your configuration settings:

```bash
git config --list
```

### Configuration Levels

Git has three levels of configuration:

- `--system`: Applies to all users on the system and all their repositories
- `--global`: Applies to all repositories for the current user
- `--local`: Specific to the current repository (default)

For example, to set a repository-specific email address:

```bash
git config --local user.email "project-specific@example.com"
```

Now that you have Git installed and configured, you're ready to start using it for your projects.
