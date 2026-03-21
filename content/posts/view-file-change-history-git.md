---
title: 'How to View the Change History of a File in Git'
excerpt: 'Need to see how a file evolved over time? Learn how to view the complete change history of a file using Git log, diff, and blame commands.'
category:
  name: 'Git'
  slug: 'git'
date: '2025-01-28'
publishedAt: '2025-01-28T11:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Git
  - Version Control
  - History
  - Log
  - Development
---

When debugging or understanding how code evolved, you need to see the complete history of a specific file. Git provides several commands to view when a file changed, who changed it, and what those changes were.

**TLDR:** To view a file's change history, use `git log filename` to see commits that modified it, `git log -p filename` to see the actual changes in each commit, or `git blame filename` to see who last modified each line. For visual history, use `git log --follow --all -p filename` to track the file even through renames.

In this guide, you'll learn how to explore file history using Git's various viewing commands.

## Prerequisites

You'll need Git installed on your system and a repository with commit history. Basic familiarity with Git commands like log and diff will be helpful.

## Viewing Commits That Modified a File

To see all commits that changed a specific file:

```bash
# Show commits that modified the file
git log filename

# Example with a specific file
git log src/app.js
```

This displays commit information for every change to the file:

```
commit a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
Author: Jane Developer <jane@example.com>
Date:   Mon Jan 15 14:30:00 2024 -0500

    Add user authentication feature

commit e4f5g6h7i8j9k0l1m2n3o4p5q6r7s8t9
Author: John Smith <john@example.com>
Date:   Fri Jan 12 09:15:00 2024 -0500

    Initial app setup
```

For a more compact view:

```bash
# One-line format
git log --oneline src/app.js

# Output:
# a1b2c3d Add user authentication feature
# e4f5g6h Initial app setup
```

## Viewing Actual Changes Made to the File

To see not just commits but the actual changes in each commit:

```bash
# Show patches (diffs) for each commit
git log -p src/app.js

# Or use --patch (same as -p)
git log --patch src/app.js
```

This shows each commit followed by the exact changes:

```
commit a1b2c3d
Author: Jane Developer <jane@example.com>
Date:   Mon Jan 15 14:30:00 2024

    Add user authentication feature

diff --git a/src/app.js b/src/app.js
index abc123..def456 100644
--- a/src/app.js
+++ b/src/app.js
@@ -10,6 +10,12 @@ const app = express();
 app.use(express.json());

+// Authentication middleware
+app.use((req, res, next) => {
+  validateToken(req.headers.authorization);
+  next();
+});
+
 app.listen(3000);
```

The `+` lines show additions and `-` lines show deletions.

## Following File Renames

If a file was renamed, use `--follow` to track its complete history:

```bash
# Track file through renames
git log --follow src/app.js

# With patches
git log --follow -p src/app.js
```

Without `--follow`, Git stops at the rename. With it, you see the file's entire history even if it had different names:

```
commit xyz789 (renamed from old-app.js)
commit abc456 (working as old-app.js)
commit def123 (working as old-app.js)
```

## Viewing Changes in a Specific Commit

To see how a file changed in one specific commit:

```bash
# Show changes to file in a specific commit
git show abc123:src/app.js

# Or show the diff for that commit
git show abc123 -- src/app.js
```

This displays only the changes made to that file in that particular commit.

## Using git blame to See Line-by-Line History

The `blame` command shows who last modified each line:

```bash
# Show blame for entire file
git blame src/app.js
```

Output looks like this:

```
a1b2c3d4 (Jane Developer 2024-01-15 14:30:00 +0000  1) const express = require('express');
a1b2c3d4 (Jane Developer 2024-01-15 14:30:00 +0000  2) const app = express();
e4f5g6h7 (John Smith    2024-01-12 09:15:00 +0000  3)
e4f5g6h7 (John Smith    2024-01-12 09:15:00 +0000  4) app.use(express.json());
a1b2c3d4 (Jane Developer 2024-01-15 14:30:00 +0000  5)
a1b2c3d4 (Jane Developer 2024-01-15 14:30:00 +0000  6) // Authentication middleware
```

Each line shows:
- Commit hash
- Author name
- Date
- Line number
- The actual code

For a more readable format:

```bash
# Show blame with more details
git blame -L 10,20 src/app.js  # Only lines 10-20

# Show blame with commit messages
git blame -s src/app.js  # Suppress author names for cleaner output
```

## Viewing Changes Between Two Points

To see how a file changed between two commits, branches, or tags:

```bash
# Compare file between two commits
git diff abc123 def456 -- src/app.js

# Compare file between branches
git diff main feature-branch -- src/app.js

# Compare file between HEAD and 3 commits ago
git diff HEAD~3 HEAD -- src/app.js
```

This shows all changes to the file between those two points:

```
diff --git a/src/app.js b/src/app.js
index abc123..def456 100644
--- a/src/app.js
+++ b/src/app.js
@@ -10,5 +10,8 @@
 function authenticate(user) {
-  return user.token !== undefined;
+  if (!user.token) return false;
+  return validateToken(user.token);
 }
```

## Searching for Specific Changes

To find when specific code was added or removed:

```bash
# Search for commits that added or removed a string
git log -S "authenticate" src/app.js

# Search with regex
git log -G "function.*authenticate" src/app.js
```

The `-S` flag (pickaxe) finds commits where the number of occurrences changed. The `-G` flag uses regex to find commits with matching changes.

## Viewing File at a Specific Point in Time

To see what a file looked like at a specific commit:

```bash
# View file contents at specific commit
git show abc123:src/app.js

# View file as it was 3 commits ago
git show HEAD~3:src/app.js

# View file from a specific branch
git show feature-branch:src/app.js
```

This displays the entire file content as it existed at that point, not the changes made to it.

## Viewing History with Graph Visualization

For a visual representation of how the file evolved across branches:

```bash
# Show branching history for file
git log --graph --oneline --all src/app.js

# Output shows branch structure:
# * a1b2c3d (HEAD -> main) Merge feature
# |\
# | * e4f5g6h (feature) Add authentication
# * | i7j8k9l Update app config
# |/
# * m1n2o3p Initial commit
```

The graph shows how different branches modified the file and where they merged.

## Finding When a Bug Was Introduced

To track down when a problem was introduced:

```bash
# Show commits with changes and commit messages
git log -p -S "buggy_function" src/app.js

# Show commits that touched specific lines
git log -L 50,60:src/app.js
```

The `-L` flag shows history for specific line ranges, which is useful when you know approximately where a bug is.

## Viewing Statistics About File Changes

To see how much a file changed over time:

```bash
# Show stats about file changes
git log --stat src/app.js

# Output:
# commit a1b2c3d
# Author: Jane Developer
# Date:   Mon Jan 15 14:30:00 2024
#
#     Add authentication
#
#  src/app.js | 25 +++++++++++++++++++++++--
#  1 file changed, 23 insertions(+), 2 deletions(-)
```

This shows the number of insertions and deletions in each commit.

## Filtering History by Date

To view changes within a specific time period:

```bash
# Show changes since a date
git log --since="2024-01-01" src/app.js

# Show changes between dates
git log --since="2024-01-01" --until="2024-01-31" src/app.js

# Show changes in the last week
git log --since="1 week ago" src/app.js
```

Date filtering helps when investigating when a problem started appearing.

## Viewing Changes by Author

To see what a specific person changed in a file:

```bash
# Show commits by author
git log --author="Jane" src/app.js

# Show actual changes by author
git log --author="Jane" -p src/app.js

# Case-insensitive author search
git log --author="(?i)jane" -p src/app.js
```

This is useful when following up on changes made by a specific team member.

## Creating an Annotated History

To generate a detailed history report:

```bash
# Detailed log with graph and stats
git log --graph --stat --pretty=format:"%h - %an, %ar : %s" src/app.js

# Output:
# * a1b2c3d - Jane Developer, 2 weeks ago : Add authentication
# |  src/app.js | 25 +++++++++++++++++++++++--
# * e4f5g6h - John Smith, 3 weeks ago : Initial app setup
#    src/app.js | 50 ++++++++++++++++++++++++++++++++++++++++++++++
```

Custom format strings let you display exactly the information you need.

## Comparing File Across Branches

To see how the file differs between branches:

```bash
# Show differences between branches
git diff main..feature-branch src/app.js

# Show log of commits on feature branch not in main
git log main..feature-branch src/app.js
```

This helps understand what changes are coming in a merge or pull request.

## Using GUI Tools for Visual History

Many GUI tools provide visual file history:

```bash
# Launch gitk focused on a file
gitk src/app.js

# Or use git gui blame
git gui blame src/app.js
```

These tools offer graphical interfaces for exploring file history, making it easier to visualize changes over time.

## Best Practices for Investigating File History

Start with a broad view:

```bash
# Get overview of file changes
git log --oneline --stat src/app.js
```

Then drill down into specific commits:

```bash
# Examine interesting commits
git show abc123 src/app.js
```

Use blame for line-specific questions:

```bash
# Who wrote this function?
git blame -L 50,80 src/app.js
```

Combine flags for detailed investigation:

```bash
# Complete history with all details
git log --follow --all --stat -p src/app.js
```

Now you know how to view the complete change history of a file in Git. The combination of `log`, `blame`, and `diff` commands gives you full visibility into how any file evolved, who changed it, and what those changes were.
