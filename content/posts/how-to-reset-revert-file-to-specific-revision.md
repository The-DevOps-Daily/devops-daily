---
title: 'How to Reset or Revert a File to a Specific Revision in Git'
excerpt: 'Learn multiple ways to reset or revert a specific file to a previous version in Git, including using git checkout, git restore, and git show commands with practical examples.'
category:
  name: 'Git'
  slug: 'git'
date: '2024-12-14'
publishedAt: '2024-12-14T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Linux
  - Networking
  - Troubleshooting
  - Command Line
  - Ports
---

Sometimes you need to revert a specific file to a previous version without affecting other files in your Git repository. Whether you've made unwanted changes, introduced bugs, or simply want to restore an earlier version of a file, Git provides several methods to accomplish this task safely and efficiently.

## Prerequisites

Before following this tutorial, you should have:

- Git installed on your system
- A Git repository with commit history
- Basic understanding of Git concepts like commits, branches, and file states
- Knowledge of how to view commit history and file differences

## Understanding File Restoration in Git

Git tracks every change to your files through commits, creating a complete history that you can navigate. When you want to restore a file to a specific revision, you have several options depending on your needs:

- **Restore to working directory**: Replace the current file with a previous version
- **Restore to staging area**: Prepare a previous version for commit
- **Extract file content**: Get the content without changing your current file

## Method 1: Using git checkout (Traditional Method)

The `git checkout` command can restore files from specific commits.

### Restore File from Specific Commit

To restore a file to a specific commit:

```bash
git checkout <commit-hash> -- <file-path>
```

Example:

```bash
git checkout 3a7b9f2 -- src/main.js
```

This command:

1. Retrieves the version of `src/main.js` from commit `3a7b9f2`
2. Places it in your working directory
3. Stages the file for commit

### Restore File from Specific Branch

You can also restore a file from another branch:

```bash
git checkout main -- config/settings.json
```

### Restore Multiple Files

To restore multiple files from the same commit:

```bash
git checkout 3a7b9f2 -- file1.txt file2.js src/component.vue
```

## Method 2: Using git restore (Modern Method)

Git 2.23 introduced `git restore` as a more intuitive alternative to `git checkout` for file operations.

### Restore File to Working Directory

```bash
git restore --source=<commit-hash> <file-path>
```

Example:

```bash
git restore --source=3a7b9f2 src/main.js
```

### Restore and Stage File

To restore a file and immediately stage it:

```bash
git restore --source=3a7b9f2 --staged --worktree src/main.js
```

### Restore from Different Branch

```bash
git restore --source=main src/main.js
```

## Method 3: Using git show (Extract Content)

The `git show` command lets you extract file content without modifying your current files.

### View File Content from Specific Commit

```bash
git show <commit-hash>:<file-path>
```

Example:

```bash
git show 3a7b9f2:src/main.js
```

### Save Content to File

```bash
git show 3a7b9f2:src/main.js > src/main.js.backup
git show 3a7b9f2:src/main.js > src/main.js
```

This approach gives you more control and allows you to:

1. First save a backup of the current version
2. Then replace the file with the previous version

## Finding the Right Commit

Before restoring a file, you need to identify which commit contains the version you want.

### View File History

```bash
git log --oneline <file-path>
```

Example:

```bash
git log --oneline src/main.js
```

Output:

```
3a7b9f2 Fix bug in main function
8c4d1e9 Add error handling
f2a5b8c Initial implementation
```

### View File Changes in Each Commit

```bash
git log -p <file-path>
```

This shows the actual changes made to the file in each commit.

### Find When File Was Last Modified

```bash
git log -1 --pretty=format:"%H %s" <file-path>
```

## Practical Examples

### Example 1: Restore Configuration File

Suppose you modified a configuration file and want to restore it to the last working version:

```bash
# Find the commit with the working configuration
git log --oneline config/database.yml

# Restore the file from 2 commits ago
git restore --source=HEAD~2 config/database.yml

# Stage the restored file
git add config/database.yml
```

### Example 2: Restore Deleted File

If a file was accidentally deleted and you want to restore it:

```bash
# Find the last commit that contained the file
git log --oneline --diff-filter=D -- deleted-file.txt

# Restore the file from the commit before it was deleted
git restore --source=HEAD~1 deleted-file.txt
```

### Example 3: Restore File from Specific Tag

```bash
# Restore file from a tagged version
git restore --source=v1.2.0 src/important-feature.js
```

### Example 4: Partial File Restoration

To restore only specific lines or sections, use interactive mode:

```bash
git checkout -p <commit-hash> -- <file-path>
```

This allows you to selectively apply changes from the specified commit.

## Comparing File Versions

Before restoring, you might want to compare different versions:

### Compare Current File with Previous Version

```bash
git diff <commit-hash> <file-path>
```

### Compare Two Specific Versions

```bash
git diff <commit1-hash> <commit2-hash> <file-path>
```

### View Side-by-Side Comparison

```bash
git difftool <commit-hash> <file-path>
```

## Handling Common Scenarios

### Scenario 1: Undo Recent Changes

To restore a file to its state in the last commit:

```bash
git restore <file-path>
# or
git checkout HEAD -- <file-path>
```

### Scenario 2: Restore File from Stash

```bash
git stash show -p stash@{0} <file-path> > temp.patch
git apply temp.patch
rm temp.patch
```

### Scenario 3: Restore Binary Files

For binary files, use the same commands but be aware that diff operations won't show meaningful content:

```bash
git restore --source=3a7b9f2 assets/logo.png
```

## Safety Considerations

### Create Backups

Before restoring important files, create backups:

```bash
cp important-file.js important-file.js.backup
git restore --source=3a7b9f2 important-file.js
```

### Check File Status

After restoration, verify the changes:

```bash
git status
git diff --staged
```

### Commit Restored Files

Don't forget to commit the restored files:

```bash
git add restored-file.js
git commit -m "Restore file to working version from commit 3a7b9f2"
```

## Troubleshooting

### File Not Found in Commit

If Git says the file doesn't exist in the specified commit:

```bash
# Check if file exists in that commit
git ls-tree <commit-hash> <file-path>

# List all files in the commit
git ls-tree -r <commit-hash>
```

### Path Conflicts

If you have path conflicts, use full paths:

```bash
git restore --source=3a7b9f2 ./src/components/Header.vue
```

### Binary File Issues

For binary files, ensure you're using the correct commit hash and file path:

```bash
git show --name-only <commit-hash>
```

## Best Practices

1. **Always backup important files** before restoration
2. **Verify commit history** to ensure you're restoring the right version
3. **Test restored files** before committing changes
4. **Use descriptive commit messages** when committing restored files
5. **Consider creating a branch** for testing restored files
6. **Document the reason** for file restoration in commit messages

By learning these file restoration techniques, you can confidently recover previous versions of files, undo unwanted changes, and maintain better control over your project's file history.
