---
title: 'How to Fix Git Refusing to Merge Unrelated Histories'
excerpt: 'Getting the refusing to merge unrelated histories error? Learn what causes this Git error and how to safely fix it when combining separate repositories.'
category:
  name: 'Git'
  slug: 'git'
date: '2024-12-22'
publishedAt: '2024-12-22T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Merge
  - Troubleshooting
  - Error Fixing
  - Repositories
---

You try to merge or pull and Git stops with the error "refusing to merge unrelated histories". This happens when you attempt to combine two Git repositories that do not share a common ancestor commit.

**TLDR:** To merge unrelated histories, use `git pull origin main --allow-unrelated-histories` or `git merge origin/main --allow-unrelated-histories`. This tells Git you intentionally want to combine two separate repository histories. Make sure this is what you want before proceeding, as it is usually not recommended.

In this guide, you'll learn why this error occurs and how to handle it safely.

## Prerequisites

You'll need Git installed on your system and two repositories you're trying to combine. Understanding basic Git concepts like commits, branches, and repository history will help you follow along.

## Understanding the Error

Git expects every repository to have a connected history:

```
Normal repository:
  A---B---C---D main
```

When you try to merge two completely separate repositories:

```
Repo 1: A---B---C
Repo 2:     X---Y---Z

No common ancestor!
```

Git refuses the merge by default because these repositories have no shared history. They started as separate projects.

## Common Scenarios That Cause This Error

**Scenario 1: New Repository with Existing Remote**

You created a local repository with `git init` and a remote repository on GitHub, both with initial commits:

```bash
# Local repo
git init
git add README.md
git commit -m "Initial commit"

# Try to pull from GitHub repo (also has initial commit)
git remote add origin https://github.com/user/repo.git
git pull origin main
# fatal: refusing to merge unrelated histories
```

**Scenario 2: Combining Two Projects**

You want to merge two separate projects into one repository:

```bash
# Project A
cd project-a
git init
# ... commits ...

# Add Project B as remote
git remote add project-b https://github.com/user/project-b.git
git pull project-b main
# fatal: refusing to merge unrelated histories
```

**Scenario 3: Rebasing Instead of Merging**

You might also see this during rebase:

```bash
git rebase origin/main
# fatal: refusing to merge unrelated histories
```

## Allowing Unrelated Histories

To proceed with the merge, use the `--allow-unrelated-histories` flag:

```bash
# For pull
git pull origin main --allow-unrelated-histories

# For merge
git fetch origin
git merge origin/main --allow-unrelated-histories

# For rebase
git rebase origin/main --allow-unrelated-histories
```

Git will then combine the two histories:

```
After merge:
      A---B---C (local history)
     /         \
  (root)       M (merge commit)
     \         /
      X---Y---Z (remote history)
```

The merge commit `M` connects the two unrelated histories.

## Handling Merge Conflicts

Combining unrelated histories often creates conflicts:

```bash
# Attempt merge
git pull origin main --allow-unrelated-histories

# Conflicts occur
# Auto-merging README.md
# CONFLICT (add/add): Merge conflict in README.md
```

Resolve conflicts like any other merge:

```bash
# View conflicted files
git status

# Edit each conflicted file
nano README.md

# Look for conflict markers and resolve
<<<<<<< HEAD
# Project A README
=======
# Project B README
>>>>>>> origin/main

# Stage resolved files
git add README.md

# Complete the merge
git commit -m "Merge unrelated histories from origin"
```

## Is This What You Really Want?

Before allowing unrelated histories, consider if merging is the right approach:

**You probably DO want to merge if:**
- You created the same repository in two places and want to combine them
- You're starting fresh and want to pull down a template
- You're combining two related projects into a monorepo

**You probably DON'T want to merge if:**
- You cloned the wrong repository
- You added the wrong remote URL
- You're trying to replace your local work with the remote

Verify your remote before proceeding:

```bash
# Check remote URL
git remote -v
# origin  https://github.com/user/correct-repo.git (fetch)
# origin  https://github.com/user/correct-repo.git (push)

# If wrong, update it
git remote set-url origin https://github.com/user/correct-repo.git
```

## Alternative: Start Fresh from Remote

If you want to replace your local repository with the remote:

```bash
# Backup your local work if needed
cp -r . ../project-backup

# Remove local Git history
rm -rf .git

# Clone the remote repository
git clone https://github.com/user/repo.git .

# Or re-initialize and force pull
git init
git remote add origin https://github.com/user/repo.git
git fetch origin
git reset --hard origin/main
```

This gives you a clean copy of the remote without merging histories.

## Alternative: Rebase Your Work

If you want your local commits on top of the remote:

```bash
# Allow unrelated histories with rebase
git rebase origin/main --allow-unrelated-histories

# Or fetch and rebase
git fetch origin
git rebase origin/main --allow-unrelated-histories
```

This creates a linear history instead of a merge commit.

## Handling the Initial Commit Scenario

A common case is when both local and remote have initial commits:

```bash
# You have:
git log --oneline
# abc123 Initial commit

# Remote has:
# def456 Initial commit

# These are different commits with the same message
```

Options:

**Option 1: Keep both commits**

```bash
git pull origin main --allow-unrelated-histories
# Creates merge commit connecting both histories
```

**Option 2: Remove your local commit**

```bash
# Soft reset to uncommit but keep files
git reset --soft HEAD~1

# Stash changes
git stash

# Pull remote
git pull origin main

# Apply your changes on top
git stash pop
```

**Option 3: Force push your local (only if you own the remote)**

```bash
git push -f origin main
# Overwrites remote with your local history
```

## Combining Multiple Projects Into a Monorepo

When intentionally merging separate projects:

```bash
# In your main repository
cd main-project

# Add other projects as remotes
git remote add project-a https://github.com/user/project-a.git
git remote add project-b https://github.com/user/project-b.git

# Fetch all remotes
git fetch --all

# Merge project A into a subdirectory
git merge project-a/main --allow-unrelated-histories -m "Merge project A"
mkdir project-a
git mv * project-a/  # Move files into subdirectory

# Merge project B
git merge project-b/main --allow-unrelated-histories -m "Merge project B"
mkdir project-b
# Move project B files into their directory
```

This creates a monorepo with each project in its own directory.

## Using Subtree for Better Organization

Git subtree is better for combining projects:

```bash
# Add project as subtree
git subtree add --prefix=project-a https://github.com/user/project-a.git main

# This automatically handles unrelated histories
```

Subtree merge is cleaner than manual merging for combining repositories.

## Checking Repository History

Before merging, examine both histories:

```bash
# View local history
git log --oneline

# View remote history
git fetch origin
git log --oneline origin/main

# See if they share any commits
git merge-base HEAD origin/main
# Returns nothing if unrelated
```

If `merge-base` returns nothing, the histories are truly unrelated.

## What Happens After Merging

After allowing unrelated histories, your repository has two root commits:

```bash
# View commit graph
git log --graph --oneline --all

# Output shows two roots:
# *   abc123 (HEAD -> main) Merge remote-tracking branch 'origin/main'
# |\
# | * def456 (origin/main) Remote initial commit
# * | ghi789 Local initial commit
```

Future operations work normally because the merge commit connected the histories.

## Preventing This Error

To avoid this situation in the future:

**When starting a new project:**

```bash
# Clone first, then add your code
git clone https://github.com/user/repo.git
cd repo
# Now add your code
```

**When creating a new repository:**

```bash
# Create remote repo WITHOUT initial commit
# Then:
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/user/repo.git
git push -u origin main
```

**When using a template:**

```bash
# Clone the template
git clone https://github.com/user/template.git my-project
cd my-project

# Remove template's remote
git remote remove origin

# Add your own remote
git remote add origin https://github.com/user/my-project.git
git push -u origin main
```

## When Rebase Makes More Sense

If you want a linear history without a merge commit:

```bash
# Fetch remote
git fetch origin

# Rebase your commits on top of remote
git rebase origin/main --allow-unrelated-histories

# Force push (only if you haven't shared your branch)
git push -f origin main
```

This creates a cleaner history:

```
Before rebase:
Local:  A---B---C
Remote:     X---Y---Z

After rebase:
        X---Y---Z---A'---B'---C'
```

## Understanding the Safety Implications

The `--allow-unrelated-histories` flag bypasses a safety check. Use it only when:

- You understand both repositories' contents
- You intentionally want to combine them
- You're prepared to handle conflicts
- You verified the remote URL is correct

Do not use it if:

- You're not sure why you're getting the error
- You might have the wrong remote URL
- You're trying to "fix" an error without understanding it

Now you know how to handle the "refusing to merge unrelated histories" error in Git. The key is understanding whether you truly want to combine two separate repositories or if you need to take a different approach like starting fresh or fixing your remote configuration.
