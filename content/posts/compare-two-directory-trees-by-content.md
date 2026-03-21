---
title: 'How to Compare Two Directory Trees and Find Files That Differ by Content'
excerpt: "Learn different methods to compare two directory structures and identify which files have different content, using tools like diff, rsync, and custom scripts."
category:
  name: 'Linux'
  slug: 'linux'
date: '2024-11-12'
publishedAt: '2024-11-12T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Linux
  - File Comparison
  - diff
  - Command Line
  - Backup Verification
---

You have two directory trees - maybe a backup and the original, or two versions of a project - and you need to know which files have different content. How do you compare them efficiently?

## TL;DR

Use `diff -r dir1 dir2` for a quick recursive comparison showing differences. For a summary of which files differ without showing the actual differences, use `diff -rq dir1 dir2`. For large directories, use `rsync -avn --delete dir1/ dir2/` to see what would change. To compare by checksums, use `find` with `md5sum` or `sha256sum`.

Comparing directory trees is common when verifying backups, checking synchronization, or finding what changed between versions.

Let's say you have two directories you want to compare:

```
project-v1/
├── src/
│   ├── main.js
│   └── utils.js
└── README.md

project-v2/
├── src/
│   ├── main.js
│   └── utils.js
└── README.md
```

## Using diff for Recursive Comparison

The `diff` command with `-r` compares directories recursively:

```bash
diff -r project-v1 project-v2
```

This shows the actual differences in files that don't match. If the directories are identical, there's no output.

Example output when files differ:

```
diff -r project-v1/src/main.js project-v2/src/main.js
15c15
< const version = "1.0";
---
> const version = "2.0";
```

This shows line 15 changed from version 1.0 to 2.0.

## Getting a Summary Without Showing Differences

If you just want to know which files differ, not the actual differences:

```bash
diff -rq project-v1 project-v2
```

The `-q` flag (brief mode) only reports which files differ:

```
Files project-v1/src/main.js and project-v2/src/main.js differ
Only in project-v2: package-lock.json
Only in project-v1: old-config.json
```

This is faster and easier to read when you have many differences.

## Comparing with rsync

The `rsync` command can show what would be different if you synchronized two directories:

```bash
rsync -avn --delete project-v1/ project-v2/
```

Flags explained:
- `-a` - archive mode (preserves permissions, times, etc.)
- `-v` - verbose (shows files being compared)
- `-n` - dry run (don't actually copy anything)
- `--delete` - show files that exist in destination but not source

Output shows what would be copied or deleted:

```
sending incremental file list
deleting package-lock.json
src/main.js
old-config.json
```

This means:
- `src/main.js` would be updated in project-v2
- `old-config.json` would be copied to project-v2
- `package-lock.json` would be deleted from project-v2

## Using rsync to Compare by Checksum

By default, `rsync` compares files by size and modification time. To compare by content (checksum):

```bash
rsync -avn --checksum project-v1/ project-v2/
```

The `--checksum` flag makes rsync compute checksums for every file, which is slower but more accurate. Files with identical content but different timestamps won't show as different.

## Comparing with find and md5sum

For a more manual approach, generate checksums for all files in both directories:

```bash
# Generate checksums for first directory
cd project-v1
find . -type f -exec md5sum {} \; | sort > ../checksums-v1.txt

# Generate checksums for second directory
cd ../project-v2
find . -type f -exec md5sum {} \; | sort > ../checksums-v2.txt

# Compare the checksum files
diff ../checksums-v1.txt ../checksums-v2.txt
```

This shows which files have different content based on MD5 checksums.

For more security (less chance of collisions), use SHA-256:

```bash
find . -type f -exec sha256sum {} \; | sort > ../checksums-v1.txt
```

## Ignoring Certain Files or Directories

To exclude specific files or directories from comparison:

```bash
# Exclude node_modules and .git
diff -rq --exclude='node_modules' --exclude='.git' project-v1 project-v2

# Exclude multiple patterns
diff -rq --exclude='*.log' --exclude='*.tmp' --exclude='build' project-v1 project-v2
```

With rsync:

```bash
rsync -avn --exclude='node_modules' --exclude='.git' project-v1/ project-v2/
```

## Comparing Only Specific File Types

To compare only certain files, combine `diff` with `find`:

```bash
# Compare only JavaScript files
find project-v1 -name "*.js" -type f | while read file; do
    relative=${file#project-v1/}
    if [ -f "project-v2/$relative" ]; then
        diff "$file" "project-v2/$relative" > /dev/null || echo "Different: $relative"
    else
        echo "Missing in project-v2: $relative"
    fi
done
```

This checks each .js file in project-v1 against the corresponding file in project-v2.

## Using Tree to Visualize Structure Differences

The `tree` command can help visualize directory structures:

```bash
# Install tree if needed
sudo apt install tree  # Ubuntu/Debian

# Compare structures side by side
tree project-v1 > tree-v1.txt
tree project-v2 > tree-v2.txt
diff tree-v1.txt tree-v2.txt
```

This shows which files or directories exist in one tree but not the other.

## Finding Files That Exist in Only One Directory

To find files that exist in one directory but not the other:

```bash
# Files only in project-v1
diff -rq project-v1 project-v2 | grep "Only in project-v1"

# Files only in project-v2
diff -rq project-v1 project-v2 | grep "Only in project-v2"
```

Or use `comm` with sorted file lists:

```bash
# Get sorted file lists
find project-v1 -type f | sed 's|^project-v1/||' | sort > files-v1.txt
find project-v2 -type f | sed 's|^project-v2/||' | sort > files-v2.txt

# Show files only in project-v1 (column 1)
comm -23 files-v1.txt files-v2.txt

# Show files only in project-v2 (column 2)
comm -13 files-v1.txt files-v2.txt

# Show files in both (column 3)
comm -12 files-v1.txt files-v2.txt
```

## Practical Example: Backup Verification Script

Here's a script to verify a backup matches the original:

```bash
#!/bin/bash
set -e

SOURCE="$1"
BACKUP="$2"

if [ -z "$SOURCE" ] || [ -z "$BACKUP" ]; then
    echo "Usage: $0 <source-dir> <backup-dir>"
    exit 1
fi

echo "Comparing $SOURCE with $BACKUP..."
echo

# Find files that differ
DIFF_OUTPUT=$(diff -rq --exclude='.git' "$SOURCE" "$BACKUP")

if [ -z "$DIFF_OUTPUT" ]; then
    echo "✓ Backup is identical to source"
    exit 0
else
    echo "✗ Differences found:"
    echo "$DIFF_OUTPUT"
    exit 1
fi
```

Run it:

```bash
chmod +x verify-backup.sh
./verify-backup.sh /var/www/app /backup/app
```

## Practical Example: Finding Recently Changed Files

Compare directories but only show files modified in the last day:

```bash
#!/bin/bash

DIR1="$1"
DIR2="$2"

# Find files modified in last 24 hours in DIR1
find "$DIR1" -type f -mtime -1 | while read file; do
    relative=${file#$DIR1/}
    file2="$DIR2/$relative"

    if [ -f "$file2" ]; then
        # Compare content
        if ! cmp -s "$file" "$file2"; then
            echo "Modified: $relative"
        fi
    else
        echo "New file: $relative"
    fi
done
```

## Using git diff for Version-Controlled Projects

If both directories are git repositories, you can use git:

```bash
# Compare two branches or commits
git diff branch1..branch2

# Compare working directory with another directory
git diff --no-index project-v1 project-v2
```

The `--no-index` flag lets you use `git diff` on directories that aren't in a repository.

## Performance Considerations

For large directory trees:

- `diff -rq` is faster than `diff -r` because it doesn't compute actual differences
- `rsync --checksum` is slow because it reads entire files
- `rsync` without `--checksum` is faster but only compares size/time
- Checksums (md5sum/sha256sum) are reliable but slow on large files

For quick checks, use:

```bash
diff -rq dir1 dir2
```

For thorough content comparison:

```bash
rsync -avn --checksum dir1/ dir2/
```

## Comparing Binary Files

The methods above work for text and binary files. For binary-specific comparison:

```bash
# Use cmp for binary comparison
find dir1 -type f | while read file; do
    file2="dir2/${file#dir1/}"
    if [ -f "$file2" ]; then
        cmp -s "$file" "$file2" || echo "Binary files differ: $file"
    fi
done
```

The `cmp` command compares files byte-by-byte and works well with binaries.

## Creating a Detailed Comparison Report

Generate a comprehensive report:

```bash
#!/bin/bash

DIR1="$1"
DIR2="$2"
REPORT="comparison-report.txt"

{
    echo "Directory Comparison Report"
    echo "==========================="
    echo "Generated: $(date)"
    echo "Directory 1: $DIR1"
    echo "Directory 2: $DIR2"
    echo

    echo "Files that differ in content:"
    diff -rq "$DIR1" "$DIR2" | grep "differ$"
    echo

    echo "Files only in $DIR1:"
    diff -rq "$DIR1" "$DIR2" | grep "Only in $DIR1"
    echo

    echo "Files only in $DIR2:"
    diff -rq "$DIR1" "$DIR2" | grep "Only in $DIR2"
    echo

    echo "Total files in $DIR1: $(find "$DIR1" -type f | wc -l)"
    echo "Total files in $DIR2: $(find "$DIR2" -type f | wc -l)"

} > "$REPORT"

echo "Report saved to $REPORT"
cat "$REPORT"
```

Comparing directory trees is straightforward with tools like `diff` and `rsync`. Whether you need a quick check or detailed analysis, these methods help you identify differences, verify backups, and track changes between directory versions.
