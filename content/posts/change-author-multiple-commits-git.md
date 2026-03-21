---
title: 'How to Change Author and Committer for Multiple Commits in Git'
excerpt: 'Need to fix incorrect author information across many commits? Learn how to batch update author and committer names and emails in Git history.'
category:
  name: 'Git'
  slug: 'git'
date: '2025-04-12'
publishedAt: '2025-04-12T10:30:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Author
  - Rebase
  - Filter Branch
  - History Rewriting
---

You committed many times with the wrong email or name - maybe you forgot to configure Git on a new machine. Now you need to fix the author information across multiple commits. Git provides several methods to batch update commit metadata.

**TLDR:** To change author for multiple commits, use `git rebase -i` and mark commits as "edit", or use `git filter-branch` for extensive changes across all history. For modern Git, use `git filter-repo` with a mailmap file. These commands rewrite history, so coordinate with your team before force pushing.

In this guide, you'll learn how to safely change author information for many commits.

## Prerequisites

You'll need Git installed on your system and commits with incorrect author information. Basic familiarity with Git rebase and history rewriting will be helpful. Always backup your repository before rewriting history.

## Understanding Author vs Committer

Each commit stores two identities:

```bash
# View full commit info
git log --format=fuller -1

# Author:     Jane Developer <jane@company.com>
# AuthorDate: Mon Jan 15 14:30:00 2024
# Commit:     John Smith <john@company.com>
# CommitDate: Mon Jan 15 14:35:00 2024
```

- **Author**: Original creator of the changes
- **Committer**: Person who committed to the repository

Usually you want to change both to match.

## Using Interactive Rebase for Recent Commits

For a manageable number of recent commits:

```bash
# Rebase last 10 commits
git rebase -i HEAD~10
```

Git opens your editor:

```
pick abc123 Commit 1
pick def456 Commit 2
pick ghi789 Commit 3
...
```

Change `pick` to `edit` for commits to modify:

```
edit abc123 Commit 1
edit def456 Commit 2
edit ghi789 Commit 3
```

Save and close. Git stops at each marked commit:

```bash
# At each stop, change the author
git commit --amend --author="Jane Developer <jane@example.com>" --no-edit
git rebase --continue

# Repeat for each 'edit' stop
```

## Automated Rebase Script

To avoid manual intervention at each commit:

```bash
#!/bin/bash
# fix-author.sh

git rebase -i HEAD~20 --exec 'git commit --amend --author="Jane Developer <jane@example.com>" --no-edit --allow-empty'
```

This automatically changes the author for all commits in the rebase.

## Using Filter-Branch for Extensive Changes

For many commits or complex patterns, use filter-branch:

```bash
git filter-branch --env-filter '
OLD_EMAIL="wrong@email.com"
CORRECT_NAME="Jane Developer"
CORRECT_EMAIL="jane@example.com"

if [ "$GIT_COMMITTER_EMAIL" = "$OLD_EMAIL" ]
then
    export GIT_COMMITTER_NAME="$CORRECT_NAME"
    export GIT_COMMITTER_EMAIL="$CORRECT_EMAIL"
fi
if [ "$GIT_AUTHOR_EMAIL" = "$OLD_EMAIL" ]
then
    export GIT_AUTHOR_NAME="$CORRECT_NAME"
    export GIT_AUTHOR_EMAIL="$CORRECT_EMAIL"
fi
' --tag-name-filter cat -- --branches --tags
```

This changes all commits where the author or committer matches the old email.

## Using Multiple Conditions

To handle several wrong emails:

```bash
git filter-branch --env-filter '
# Define mappings
case "$GIT_AUTHOR_EMAIL" in
    "old1@email.com")
        GIT_AUTHOR_NAME="Jane Developer"
        GIT_AUTHOR_EMAIL="jane@example.com"
        ;;
    "old2@email.com")
        GIT_AUTHOR_NAME="Jane Developer"
        GIT_AUTHOR_EMAIL="jane@example.com"
        ;;
esac

case "$GIT_COMMITTER_EMAIL" in
    "old1@email.com")
        GIT_COMMITTER_NAME="Jane Developer"
        GIT_COMMITTER_EMAIL="jane@example.com"
        ;;
    "old2@email.com")
        GIT_COMMITTER_NAME="Jane Developer"
        GIT_COMMITTER_EMAIL="jane@example.com"
        ;;
esac

export GIT_AUTHOR_NAME GIT_AUTHOR_EMAIL
export GIT_COMMITTER_NAME GIT_COMMITTER_EMAIL
' --tag-name-filter cat -- --branches --tags
```

## Using git-filter-repo (Modern Approach)

The recommended modern tool for rewriting history:

```bash
# Install git-filter-repo
# pip install git-filter-repo

# Create a mailmap file
cat > mailmap.txt << EOF
Correct Name <correct@email.com> <old1@email.com>
Correct Name <correct@email.com> <old2@email.com>
Correct Name <correct@email.com> Old Name <old3@email.com>
EOF

# Apply the changes
git filter-repo --mailmap mailmap.txt

# Filter-repo is faster and safer than filter-branch
```

## Mailmap Format

The mailmap syntax:

```
Proper Name <proper@email.com> <commit@email.com>
Proper Name <proper@email.com> Commit Name <commit@email.com>
<proper@email.com> <commit@email.com>
```

Examples:

```
# Just email change
Jane Developer <jane@example.com> <jane@old.com>

# Name and email change
Jane Developer <jane@example.com> Jane D <jane@old.com>

# Multiple old emails to one new
Jane Developer <jane@example.com> <jane.developer@old.com>
Jane Developer <jane@example.com> <jdeveloper@old.com>
```

## Changing Only Specific Commits

To target commits by date or other criteria:

```bash
git filter-branch --env-filter '
# Only change commits after specific date
COMMIT_DATE=$(git log -1 --format=%at $GIT_COMMIT)
CUTOFF_DATE=$(date -d "2024-01-01" +%s)

if [ "$COMMIT_DATE" -gt "$CUTOFF_DATE" ] && [ "$GIT_AUTHOR_EMAIL" = "old@email.com" ]
then
    export GIT_AUTHOR_NAME="Jane Developer"
    export GIT_AUTHOR_EMAIL="jane@example.com"
    export GIT_COMMITTER_NAME="Jane Developer"
    export GIT_COMMITTER_EMAIL="jane@example.com"
fi
' --tag-name-filter cat -- --branches
```

## Verifying Changes

After rewriting history, verify the changes:

```bash
# Check recent commits
git log --format="%h %an <%ae> | %cn <%ce>" -10

# Check all unique authors
git log --format='%an <%ae>' | sort -u

# Check specific commit
git show --format=fuller abc123
```

## Handling Remote Repository

After changing history locally:

```bash
# Backup first!
git branch backup-before-push

# Force push (coordinate with team!)
git push --force-with-lease origin main

# Or to all branches
git push --force-with-lease origin --all
```

**Warning:** Force pushing rewrites remote history. Only do this on branches you own or after team coordination.

## Changing Author in Specific Branch

To only change commits in one branch:

```bash
# Rewrite only feature-branch
git filter-branch --env-filter '...' feature-branch

# Or with filter-repo
git filter-repo --mailmap mailmap.txt --refs refs/heads/feature-branch
```

## Preserving Merge Commits

When rewriting, preserve merge structure:

```bash
# With filter-branch
git filter-branch --env-filter '...' --tag-name-filter cat -- --branches

# With rebase (use --rebase-merges)
git rebase -i --rebase-merges HEAD~20
```

## Fixing Partial History

To change commits only in a date range:

```bash
# Change commits between two dates
git filter-branch --env-filter '
COMMIT_TIMESTAMP=$(git log -1 --format=%at $GIT_COMMIT)
START=$(date -d "2024-01-01" +%s)
END=$(date -d "2024-06-30" +%s)

if [ "$COMMIT_TIMESTAMP" -ge "$START" ] && [ "$COMMIT_TIMESTAMP" -le "$END" ]
then
    # Apply author changes
    export GIT_AUTHOR_NAME="Jane Developer"
    export GIT_AUTHOR_EMAIL="jane@example.com"
fi
' HEAD~100..HEAD
```

## Handling Multiple Contributors

When fixing a team repository:

```bash
# Create comprehensive mailmap
cat > .mailmap << EOF
Jane Developer <jane@company.com> <jane@old-company.com>
Jane Developer <jane@company.com> <jane.d@personal.com>
John Smith <john@company.com> <john@old.com>
Alice Johnson <alice@company.com> <alice.j@contractor.com>
EOF

# Apply with filter-repo
git filter-repo --mailmap .mailmap

# Commit the mailmap for future reference
git add .mailmap
git commit -m "Add mailmap for author corrections"
```

## Testing Before Force Push

Test the rewrite on a copy:

```bash
# Create test branch
git branch test-rewrite

# Rewrite the test branch
git filter-branch --env-filter '...' test-rewrite

# Verify it looks good
git log --format="%an <%ae>" test-rewrite | sort -u

# If good, apply to main branch
git filter-branch --env-filter '...' main

# Delete test branch
git branch -D test-rewrite
```

## Recovering from Mistakes

If rewrite goes wrong:

```bash
# View reflog to find pre-rewrite state
git reflog

# Reset to before rewrite
git reset --hard HEAD@{5}

# Or use backup branch
git reset --hard backup-before-rewrite
```

## Cleaning Up After Filter-Branch

Filter-branch leaves backup refs:

```bash
# Remove backup refs
git for-each-ref --format="%(refname)" refs/original/ | xargs -n 1 git update-ref -d

# Force garbage collection
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

## Communicating with Team

Before force pushing:

```bash
# Notify team
echo "Team: I need to fix author info in main branch.
Please do not push to main for the next hour.
After I'm done, you'll need to:
1. git fetch origin
2. git reset --hard origin/main
3. Reapply any local commits"
```

## Alternative: Using Mailmap Without Rewriting

To fix how Git displays authors without rewriting history:

```bash
# Create .mailmap in repository root
cat > .mailmap << EOF
Jane Developer <jane@example.com> <jane@old.com>
EOF

# Commit mailmap
git add .mailmap
git commit -m "Add mailmap for author display"

# Git now displays Jane Developer instead of old name
# But commits are not rewritten
git log  # Shows corrected names
```

This is safer but does not actually change commit data.

## Best Practices

Always create a backup:

```bash
git branch backup-$(date +%Y%m%d)
git push origin backup-$(date +%Y%m%d)
```

Test on a single branch first:

```bash
# Test on feature branch
git checkout -b test-branch
git filter-branch --env-filter '...' test-branch
# Verify
# If good, apply to other branches
```

Use filter-repo instead of filter-branch:

```bash
# Modern, faster, safer
git filter-repo --mailmap mailmap.txt

# vs old method
git filter-branch --env-filter '...'
```

Document the change:

```bash
# After fixing
git tag -a author-fix-2024 -m "Fixed author information for commits before this point"
git push origin author-fix-2024
```

Coordinate force pushes:

```bash
# Before force push
# 1. Announce to team
# 2. Pick low-activity time
# 3. Verify everyone is aware
git push --force-with-lease origin --all
```

Now you know how to change author information for multiple commits in Git. Use interactive rebase for recent commits, filter-branch or filter-repo for extensive changes, and always backup before rewriting history. Coordinate with your team when force pushing changes to shared repositories.
