---
title: 'How to Find and Restore a Deleted File in Git'
excerpt: 'Accidentally deleted a file and need it back? Learn how to find when a file was deleted and restore it from Git history.'
category:
  name: 'Git'
  slug: 'git'
date: '2025-02-05'
publishedAt: '2025-02-05T10:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '10 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Recovery
  - Deleted Files
  - History
  - Troubleshooting
---

You deleted a file and committed the deletion, or someone else deleted it in a previous commit. Now you need to find and restore it. Git keeps the complete history of all files, making it possible to recover deleted files.

**TLDR:** To restore a deleted file, find the commit that deleted it with `git log --diff-filter=D -- path/to/file`, then restore the file from the parent of that commit with `git restore --source=<commit>^ --staged --worktree -- path/to/file` (or `git checkout <commit>^ -- path/to/file` on Git older than 2.23). The `^` means "parent commit": the last version before the deletion. To put any file back to an older version, see [reset or revert a file to a specific revision](#h2-how-do-i-reset-or-revert-a-file-to-a-specific-revision).

In this guide, you'll learn how to find and recover deleted files from Git history.

## Prerequisites

You'll need Git installed on your system and a repository with deleted files you want to recover. Basic familiarity with Git commands like log and checkout will be helpful.

## Finding When a File Was Deleted

First, locate the commit that deleted the file:

```bash
# Find deletion commit
git log --full-history -- path/to/deleted-file.js

# Output shows commits that touched the file, including deletion:
# commit abc123
# Author: Jane Developer
# Date:   Mon Jan 15 14:30:00 2024
#
#     Remove obsolete authentication code
```

The `--full-history` flag makes sure Git shows the deletion even if the file no longer exists.

## Finding All Deleted Files

To see all files deleted in the repository:

```bash
# List all deleted files
git log --diff-filter=D --summary | grep delete

# Output:
# delete mode 100644 src/old-auth.js
# delete mode 100644 config/legacy.json
```

This shows every file that was deleted throughout history.

## Restoring a Deleted File

Once you know the deletion commit, restore from just before it:

```bash
# abc123 is the commit that deleted the file
# Restore from its parent (the commit before deletion)
git checkout abc123^ -- path/to/deleted-file.js

# The file is now restored in your working directory
git status
# new file:   path/to/deleted-file.js
```

The `^` notation means "parent of this commit" - the version before deletion.

## Restoring to a Specific Commit

To restore the file as it existed at a specific point:

```bash
# Restore from specific commit
git checkout def456 -- path/to/deleted-file.js

# Or restore from a tag
git checkout v1.0.0 -- path/to/deleted-file.js

# Or from a branch
git checkout main~5 -- path/to/deleted-file.js
```

## How Do I Reset or Revert a File to a Specific Revision?

Run `git restore` with the commit as the source. Only that file changes, and the rest of the repository stays as it is:

```bash
git log --oneline -- src/main.js                                  # find the commit, for example 3a7b9f2
git restore --source=3a7b9f2 --staged --worktree -- src/main.js   # file and index now match 3a7b9f2
git commit -m "Restore src/main.js from 3a7b9f2"
```

This replaces your uncommitted changes to that file, staged and unstaged, so commit or stash them first if you need them. Without `--staged --worktree`, `git restore --source` changes only the file on disk, and you stage it with `git add`. The older `git checkout 3a7b9f2 -- src/main.js` changes both the file and the index, like the command above. Some variants:

- **From another branch or a tag:** `git restore --source=main -- config/settings.json`, or `--source=v1.2.0`.
- **The version before a commit:** `--source=3a7b9f2^` is the parent of `3a7b9f2`.
- **Only some changes:** `git restore -p --source=3a7b9f2 -- src/main.js` asks for each hunk.
- **From a stash:** `git restore --source=stash@{0} -- src/main.js`. `git stash show -p stash@{0} src/main.js` does not work: Git reads the path as a second stash name and stops with `Too many revisions specified`.
- **Throw away local edits:** `git restore src/main.js` puts back the version in the index.

To see an old version without changing the file, print it. The path is relative to the root of the repository, or relative to the current directory with `./`:

```bash
git show 3a7b9f2:src/main.js            # from any directory
git show 3a7b9f2:./main.js              # from inside src/
git show 3a7b9f2:src/main.js > /tmp/main.js.old
```

Check that the file exists in the commit before you restore it: `git ls-tree -r --name-only 3a7b9f2 | grep main.js` lists the matching paths. If the file is tracked now but not in that commit, `git restore` deletes it to match the commit. If Git knows the path from neither, it stops with `pathspec 'src/main.js' did not match any file(s) known to git`. To compare before you restore, run `git diff 3a7b9f2 -- src/main.js`. [View the change history of a file](/posts/view-file-change-history-git) shows more ways to find the right commit.

To return the whole repository to an old commit instead of one file, see [revert the repository to a previous commit](/posts/delete-commit-from-branch#h2-how-do-i-revert-the-repository-to-a-previous-commit-without-rewriting-history).

## Finding File by Partial Name

If you do not remember the exact path:

```bash
# Search for files matching pattern
git log --all --full-history --diff-filter=D -- '**/auth*.js'

# Or use grep
git log --all --full-history --summary | grep -i "delete.*auth"
```

## Viewing File Content Before Deletion

To see what the file contained without restoring it:

```bash
# Show file content from before deletion
git show abc123^:path/to/deleted-file.js

# Or pipe to editor
git show abc123^:path/to/deleted-file.js | less
```

## Restoring Multiple Deleted Files

To restore several files at once:

```bash
# Restore multiple files from same commit
git checkout abc123^ -- file1.js file2.js file3.js

# Restore entire directory
git checkout abc123^ -- path/to/directory/
```

## Finding File in Branch History

If the file was deleted from one branch but exists in another:

```bash
# Check if file exists in other branches
git log --all --full-history -- path/to/file.js

# Shows which branches have the file
# Then restore from that branch
git checkout other-branch -- path/to/file.js
```

## Using Git Rev-List for Searching

For more advanced searching:

```bash
# Find all commits that touched the file
git rev-list --all -- path/to/file.js

# Get the last commit that had the file
git rev-list -n 1 HEAD -- path/to/file.js
```

## Recovering Very Old Deletions

For files deleted long ago:

```bash
# Search entire history
git log --all --full-history --oneline -- old-file.js

# Find the commit
# Restore from before deletion
git checkout ancient-commit^ -- old-file.js
```

## Finding When File Was Last Modified

To see the last actual modification before deletion:

```bash
# Show history with diffs
git log -p --full-history -- deleted-file.js

# Last commit shows the deletion (lines removed)
# Previous commit shows last actual changes
```

## Restoring File Deleted in Merge

If a file was deleted during a merge:

```bash
# Find the merge commit
git log --merges --full-history -- deleted-file.js

# Restore from before merge
git checkout merge-commit^ -- deleted-file.js

# Or from other parent
git checkout merge-commit^2 -- deleted-file.js
```

## Creating a Script to Find Deleted Files

Automate the search:

```bash
#!/bin/bash
# find-deleted.sh - Find when a file was deleted

FILE="$1"

echo "Searching for deletion of $FILE..."

# Find deletion commit
COMMIT=$(git rev-list -n 1 HEAD -- "$FILE")

if [ -z "$COMMIT" ]; then
    echo "File not found in history"
    exit 1
fi

echo "Commit that deleted the file: $COMMIT"
git show --summary $COMMIT

echo ""
echo "To restore: git checkout $COMMIT^ -- $FILE"
```

Use it:

```bash
chmod +x find-deleted.sh
./find-deleted.sh path/to/file.js
```

## Restoring File and Viewing Diff

To see what changed when restoring:

```bash
# Restore the file
git checkout abc123^ -- deleted-file.js

# See differences from current branch
git diff HEAD deleted-file.js

# See what the deletion removed
git show abc123 -- deleted-file.js
```

## Recovering from Accidental Deletion

If you just deleted a file but have not committed:

```bash
# File was deleted but not committed
git status
# deleted:    important-file.js

# Restore from HEAD
git checkout HEAD -- important-file.js

# Or restore all deleted files
git checkout HEAD -- .
```

## Finding File in Stash

If you deleted a file and stashed changes:

```bash
# List stashes
git stash list

# Check if file is in a stash
git stash show -p stash@{0} | grep deleted-file.js

# Restore from stash
git checkout stash@{0} -- deleted-file.js
```

## Restoring Directory Structure

If an entire directory was deleted:

```bash
# Find when directory was deleted
git log --full-history -- path/to/directory/

# Restore entire directory
git checkout abc123^ -- path/to/directory/

# All files in the directory are restored
```

## Searching by Content

If you remember file contents but not the name:

```bash
# Search commit messages
git log --all --grep="authentication"

# Search code content
git log -S "specificFunctionName" --all

# Once found, restore as usual
git checkout found-commit -- path/to/file.js
```

## Viewing File History Timeline

To see complete file timeline:

```bash
# View all changes to file
git log --follow --all -p -- file.js

# Shows:
# - Creation
# - All modifications
# - Renames
# - Deletion
```

## Preventing Accidental Deletions

Use Git hooks to warn about deletions:

```bash
# .git/hooks/pre-commit
#!/bin/bash

DELETED=$(git diff --cached --diff-filter=D --name-only)

if [ -n "$DELETED" ]; then
    echo "Warning: The following files will be deleted:"
    echo "$DELETED"
    read -p "Continue? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi
```

## Recovering After Force Push

If someone force-pushed and deleted files:

```bash
# origin/main@{1} is where origin/main pointed before your last fetch
git reflog show origin/main

# Restore files from that point
git restore --source=origin/main@{1} --staged --worktree -- deleted-files/
```

## Best Practices

Always search before assuming a file is gone:

```bash
# Check if file still exists somewhere
git log --all --full-history -- path/to/file

# Check which branches still have the file
git for-each-ref --format='%(refname:short)' refs/heads refs/remotes |
  while read -r ref; do git cat-file -e "$ref:path/to/file" 2>/dev/null && echo "$ref"; done
```

Document why you're restoring:

```bash
git checkout abc123^ -- old-file.js
git add old-file.js
git commit -m "Restore old-file.js - needed for legacy API support
Original deletion in commit abc123 was premature"
```

Review before restoring:

```bash
# Check what you're restoring
git show abc123^:path/to/file.js

# Make sure it's the right version
# Then restore
git checkout abc123^ -- path/to/file.js
```

Create aliases for common recovery operations:

```bash
# Add to ~/.gitconfig
[alias]
    find-deleted = log --diff-filter=D --summary
    restore-deleted = "!f() { git checkout $(git rev-list -n 1 HEAD -- \"$1\")^ -- \"$1\"; }; f"

# Use them
git find-deleted
git restore-deleted path/to/deleted-file.js
```

Do not name an alias after a built-in command. Git ignores an alias called `restore`, and runs the real `git restore` instead.

Now you know how to find and restore deleted files in Git. Use `git log --full-history` to find when a file was deleted, then `git checkout commit^` to restore it from before the deletion. Git's complete history means a committed file is not lost while any commit that contains it still exists.

## Related Resources

- [Introduction to Git: Show Old Versions of Files](/guides/introduction-to-git/08-history#h2-show-old-versions-of-files)
- [View the change history of a file](/posts/view-file-change-history-git)
- [Remove a file from Git without deleting it, or undo git add](/posts/remove-file-from-git-keep-local)
- [Delete or undo a commit: reset, rebase or revert](/posts/delete-commit-from-branch)
- Test yourself: [Git Command Quiz](/quizzes/git-quiz)
