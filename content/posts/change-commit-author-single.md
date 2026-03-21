---
title: 'How to Change the Commit Author for a Single Commit in Git'
excerpt: 'Made a commit with the wrong author information? Learn how to change the author name and email for a single commit in your Git history.'
category:
  name: 'Git'
  slug: 'git'
date: '2025-03-18'
publishedAt: '2025-03-18T11:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Commits
  - Author
  - Rebase
  - Configuration
---

You committed with the wrong email address or name - maybe you forgot to set up Git on a new machine, or you committed from the wrong account. Git lets you correct the author information for individual commits.

**TLDR:** To change the author of the most recent commit, use `git commit --amend --author="Name <email@example.com>"`. For an older commit, use `git rebase -i HEAD~n`, mark the commit as "edit", then run `git commit --amend --author="Name <email@example.com>"` followed by `git rebase --continue`.

In this guide, you'll learn how to fix author information in commits.

## Prerequisites

You'll need Git installed on your system and commits with incorrect author information. Basic familiarity with Git commits and rebase will be helpful.

## Understanding Author vs Committer

Git tracks two sets of information for each commit:

```bash
# View commit details
git log --format="%h %an <%ae> | %cn <%ce>" -1

# Output:
# abc123 Jane Developer <jane@work.com> | John Smith <john@work.com>
#        ^^^^^^^^^^^^^^^ Author           ^^^^^^^^^^^^^^ Committer
```

- **Author**: Person who originally wrote the code
- **Committer**: Person who committed the code to the repository

Usually they're the same, but they can differ when applying patches or cherry-picking.

## Changing the Most Recent Commit

To fix the author of your last commit:

```bash
# Change author of last commit
git commit --amend --author="Jane Developer <jane@example.com>"

# Git opens editor - save and close to confirm
```

If you don't want to open an editor:

```bash
# Change author without editing message
git commit --amend --author="Jane Developer <jane@example.com>" --no-edit
```

## Using Environment Variables

You can also set author via environment variables:

```bash
# Set author for one commit
GIT_AUTHOR_NAME="Jane Developer" \
GIT_AUTHOR_EMAIL="jane@example.com" \
git commit --amend --no-edit
```

This is useful in scripts.

## Resetting to Current Git Config

To use your currently configured Git identity:

```bash
# First, check your current config
git config user.name
git config user.email

# Reset commit to use current config
git commit --amend --reset-author --no-edit
```

The `--reset-author` flag uses your configured name and email.

## Changing an Older Commit

To change the author of a commit that is not the most recent:

```bash
# Start interactive rebase (go back 5 commits)
git rebase -i HEAD~5
```

Git opens an editor with your commits:

```
pick abc123 First commit
pick def456 Second commit (fix this one)
pick ghi789 Third commit
pick jkl012 Fourth commit
pick mno345 Fifth commit
```

Change `pick` to `edit` for the commit to modify:

```
pick abc123 First commit
edit def456 Second commit (fix this one)
pick ghi789 Third commit
pick jkl012 Fourth commit
pick mno345 Fifth commit
```

Save and close. Git stops at that commit:

```bash
# Git says: Stopped at def456

# Change the author
git commit --amend --author="Jane Developer <jane@example.com>" --no-edit

# Continue the rebase
git rebase --continue
```

## Finding the Commit to Change

If you don't know how far back the commit is:

```bash
# Search for commits by wrong author
git log --author="wrong@email.com" --oneline

# Or see all commits with author info
git log --format="%h %an <%ae>" --all
```

Once you find it, note the commit hash and count how many commits back it is.

## Changing Author for Specific Commit by Hash

If you know the exact commit hash:

```bash
# Rebase to just before that commit
git rebase -i abc123^

# Mark that commit as 'edit'
# Then amend and continue as above
```

The `^` means "parent of this commit", which is where the rebase starts.

## Batch Changing Author

To change the same author across multiple commits:

```bash
git rebase -i HEAD~10

# Mark all commits with wrong author as 'edit'
edit abc123 Commit 1
edit def456 Commit 2
pick ghi789 Commit 3 (correct author)
edit jkl012 Commit 4
```

Git stops at each marked commit:

```bash
# At each stop
git commit --amend --author="Correct Name <correct@email.com>" --no-edit
git rebase --continue
```

## Automating with exec

For many commits, use the exec command:

```bash
git rebase -i HEAD~20

# In the editor, add 'exec' commands
pick abc123 First commit
exec git commit --amend --author="Jane Developer <jane@example.com>" --no-edit --allow-empty
pick def456 Second commit
exec git commit --amend --author="Jane Developer <jane@example.com>" --no-edit --allow-empty
```

Or use a more advanced approach with filter-branch (see below).

## Using Filter-Branch for Extensive Changes

For changing many commits throughout history:

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

**Warning:** This rewrites all history. Make a backup first!

## Using git-filter-repo (Modern Approach)

For safer bulk changes, use `git-filter-repo`:

```bash
# Install git-filter-repo first
# pip install git-filter-repo

# Create mailmap file
cat > mailmap << EOF
Jane Developer <jane@example.com> <wrong@email.com>
EOF

# Apply changes
git filter-repo --mailmap mailmap

# Force push if needed
git push --force origin main
```

## Verifying Changes

After changing author information:

```bash
# Check the commit
git show --format=fuller HEAD

# Output shows:
# Author:     Jane Developer <jane@example.com>
# AuthorDate: Mon Jan 15 14:30:00 2024
# Commit:     Jane Developer <jane@example.com>
# CommitDate: Mon Jan 15 14:30:00 2024

# View multiple commits
git log --format="%h %an <%ae>" -5
```

## Changing Both Author and Committer

To set both at once:

```bash
# Change both author and committer
GIT_AUTHOR_NAME="Jane Developer" \
GIT_AUTHOR_EMAIL="jane@example.com" \
GIT_COMMITTER_NAME="Jane Developer" \
GIT_COMMITTER_EMAIL="jane@example.com" \
git commit --amend --no-edit
```

## Pushing Changes

If you modified commits that were already pushed:

```bash
# Force push (coordinate with team first!)
git push --force origin feature-branch

# Safer: force with lease
git push --force-with-lease origin feature-branch
```

**Warning:** Only force push to branches you own or after coordinating with your team.

## Preventing Wrong Author in Future

Set your Git identity globally:

```bash
# Set for all repositories
git config --global user.name "Jane Developer"
git config --global user.email "jane@example.com"

# Verify settings
git config --global user.name
git config --global user.email
```

Or per repository:

```bash
# Set for current repository only
git config user.name "Jane Developer"
git config user.email "jane@work.com"
```

## Using Conditional Includes

For automatic identity switching:

```bash
# ~/.gitconfig
[user]
    name = Jane Developer
    email = jane@personal.com

[includeIf "gitdir:~/work/"]
    path = ~/.gitconfig-work

# ~/.gitconfig-work
[user]
    name = Jane Developer
    email = jane@company.com
```

This automatically uses the right email based on directory.

## Common Scenarios

**Committed from wrong account:**

```bash
# Just committed with wrong account
git commit --amend --reset-author --no-edit
```

**Forgot to set Git config on new machine:**

```bash
# Set config
git config user.name "Jane Developer"
git config user.email "jane@example.com"

# Fix recent commits
git rebase -i HEAD~5
# Mark all as 'edit', then:
git commit --amend --reset-author --no-edit
git rebase --continue
```

**Used work email for personal project:**

```bash
git commit --amend --author="Jane Developer <jane@personal.com>" --no-edit
```

## Handling Merge Commits

Changing author of merge commits requires special handling:

```bash
git rebase -i --rebase-merges HEAD~10

# Or use filter-branch for merge commits
git filter-branch --env-filter '...' -- --all
```

## Best Practices

Always backup before rewriting history:

```bash
# Create backup branch
git branch backup-before-author-change

# Make changes
git rebase -i HEAD~10

# If something goes wrong
git reset --hard backup-before-author-change
```

Only change commits that have not been shared:

```bash
# Good: Local commits
git commit --amend --reset-author

# Risky: Published commits
git push --force
```

Communicate before force pushing:

```bash
# Tell team before force push
"About to fix author info on feature-x branch,
please don't push to it for 5 minutes"
```

Use mailmap for historical display:

```bash
# Create .mailmap file
cat > .mailmap << EOF
Correct Name <correct@email.com> <old@email.com>
EOF

# Commit mailmap
git add .mailmap
git commit -m "Add mailmap for author corrections"
```

Mailmap changes how Git displays authors without rewriting history.

## When Not to Change Author

Do not change author when:

- The commit is on main/master
- Others have pulled the branch
- It's part of a signed commit you don't control
- You're not certain about the correct attribution

In these cases, document the correct author in commit messages or use mailmap.

Now you know how to change the commit author for a single commit. Use `git commit --amend --author` for recent commits and `git rebase -i` for older ones. Remember to only modify commits that have not been shared, and always coordinate with your team before force pushing.
