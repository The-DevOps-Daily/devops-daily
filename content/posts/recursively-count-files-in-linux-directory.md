---
title: 'How to Recursively Count Files in a Linux Directory'
excerpt: "Learn different methods to count files in a directory and its subdirectories, including fast one-liners and options for filtering by type, size, or pattern."
category:
  name: 'Linux'
  slug: 'linux'
date: '2024-12-05'
publishedAt: '2024-12-05T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Linux
  - File System
  - Command Line
  - find
  - wc
---

You need to know how many files are in a directory and all its subdirectories. Maybe you're checking how big a codebase is, or verifying a backup, or just curious. What's the quickest way to get an accurate count?

## TL;DR

Use `find /path -type f | wc -l` to count all files recursively. This finds all regular files and counts them with `wc -l`. For faster results on large directories, use `find /path -type f -printf '.' | wc -c`. To exclude hidden files, add `-not -path '*/.*'`. To count only specific file types, add `-name '*.ext'`.

Counting files recursively is a common task for system administration, backup verification, and understanding directory structure. Let's look at the most effective approaches.

The most straightforward method uses `find` to locate all files and `wc` to count them:

```bash
find /path/to/directory -type f | wc -l
```

The `-type f` option tells `find` to match only regular files (not directories, symlinks, or special files). The output is piped to `wc -l`, which counts the number of lines - each file produces one line of output, so this gives you the file count.

```
Directory Structure           find output         wc -l
------------------           -----------         -----
/project/                    /project/file1.js
├── src/                     /project/src/app.js
│   ├── app.js               /project/src/util.js   Count: 5
│   └── util.js              /project/test/app.test.js
└── test/                    /project/README.md
    └── app.test.js
README.md
```

## Counting Files in the Current Directory

If you're already in the directory you want to count, use `.` as the path:

```bash
find . -type f | wc -l
```

This counts all files in the current directory and subdirectories.

## Faster Method for Large Directories

The standard method creates a line of output for each file, which can be slow for directories with millions of files. A faster alternative uses `printf` to output a single character per file:

```bash
find /path/to/directory -type f -printf '.' | wc -c
```

The `-printf '.'` tells `find` to print a dot for each file instead of the full path. Then `wc -c` counts characters (dots) instead of lines. This is faster because it doesn't construct full paths.

On a directory with 100,000 files:
- Standard method: ~2.5 seconds
- Printf method: ~0.8 seconds

The speedup is more noticeable with even larger directories.

## Excluding Hidden Files and Directories

To count only non-hidden files (excluding anything starting with `.`):

```bash
find /path/to/directory -type f -not -path '*/.*' | wc -l
```

The `-not -path '*/.*'` excludes any path containing `/.` (which matches hidden directories like `.git` and their contents).

This is useful when counting source files in a project:

```bash
# Count source files, excluding .git, .cache, etc.
find ~/projects/myapp -type f -not -path '*/.*' | wc -l
```

## Counting Specific File Types

To count only files matching a pattern, add `-name`:

```bash
# Count only JavaScript files
find /path/to/directory -type f -name '*.js' | wc -l

# Count Python files
find /path/to/directory -type f -name '*.py' | wc -l

# Count log files
find /var/log -type f -name '*.log' | wc -l
```

You can combine multiple patterns with `-o` (OR):

```bash
# Count both .js and .jsx files
find /path/to/directory -type f \( -name '*.js' -o -name '*.jsx' \) | wc -l
```

The parentheses group the conditions together.

## Counting Files by Directory Depth

To count files at a specific depth, use `-maxdepth`:

```bash
# Count files only in the top-level directory (no subdirectories)
find /path/to/directory -maxdepth 1 -type f | wc -l

# Count files in the top level and one level down
find /path/to/directory -maxdepth 2 -type f | wc -l
```

This is helpful when you want to see how files are distributed across directory levels.

## Counting Files and Showing the Total Size

Combine file counting with size calculation:

```bash
# Count files and show total size
echo "Files: $(find /path/to/directory -type f | wc -l)"
echo "Size: $(du -sh /path/to/directory | cut -f1)"
```

Or in a more compact format:

```bash
find /path/to/directory -type f -exec ls -l {} \; | \
  awk '{total += $5; count++} END {print "Files:", count, "Total size:", total/1024/1024, "MB"}'
```

This counts files and sums their sizes in one pass.

## Counting Files Modified Recently

To count files modified in the last 7 days:

```bash
find /path/to/directory -type f -mtime -7 | wc -l
```

The `-mtime -7` option finds files modified in the last 7 days. You can adjust the number for different time ranges:
- `-mtime -1`: Last 24 hours
- `-mtime -30`: Last 30 days

For files modified more than 30 days ago:

```bash
find /path/to/directory -type f -mtime +30 | wc -l
```

## Counting Files by Size Range

Count files larger than 10MB:

```bash
find /path/to/directory -type f -size +10M | wc -l
```

Count files between 1MB and 10MB:

```bash
find /path/to/directory -type f -size +1M -size -10M | wc -l
```

This helps identify where disk space is being used.

## Per-Directory File Counts

To see how many files are in each subdirectory:

```bash
for dir in /path/to/directory/*/; do
  count=$(find "$dir" -type f | wc -l)
  echo "$dir: $count files"
done
```

This loops through each subdirectory and counts its files.

A more compact version using `find` and `awk`:

```bash
find /path/to/directory -type f | \
  awk -F/ '{parent=$(NF-1); count[parent]++} END {for (p in count) print p": "count[p]}'
```

This groups files by their parent directory and shows counts.

## Practical Example: Analyzing a Project

Let's say you want to analyze a web application project:

```bash
#!/bin/bash

PROJECT_DIR="$1"

echo "File Analysis for: $PROJECT_DIR"
echo "================================"

# Total files
total=$(find "$PROJECT_DIR" -type f | wc -l)
echo "Total files: $total"

# Source files (excluding node_modules, .git)
source=$(find "$PROJECT_DIR" -type f -not -path '*/node_modules/*' -not -path '*/.git/*' | wc -l)
echo "Source files: $source"

# JavaScript files
js=$(find "$PROJECT_DIR" -type f -name '*.js' -not -path '*/node_modules/*' | wc -l)
echo "JavaScript files: $js"

# Test files
tests=$(find "$PROJECT_DIR" -type f \( -name '*.test.js' -o -name '*.spec.js' \) | wc -l)
echo "Test files: $tests"

# Large files (>1MB)
large=$(find "$PROJECT_DIR" -type f -size +1M | wc -l)
echo "Files larger than 1MB: $large"
```

Run it with:

```bash
chmod +x analyze.sh
./analyze.sh ~/projects/webapp
```

Output:
```
File Analysis for: /home/user/projects/webapp
================================
Total files: 47823
Source files: 342
JavaScript files: 287
Test files: 94
Files larger than 1MB: 12
```

## Comparing Directory Counts

To compare file counts across multiple directories:

```bash
for dir in /var/www/*/; do
  count=$(find "$dir" -type f | wc -l)
  printf "%-40s %6d files\n" "$dir" "$count"
done
```

The `printf` formats the output in aligned columns.

## Alternative: Using ls and wc

While `find` is the most flexible, you can also use `ls` with recursive listing:

```bash
ls -lR /path/to/directory | grep "^-" | wc -l
```

The `grep "^-"` filters for regular files (lines starting with `-` in `ls -l` output). This is less reliable than `find` because it can break on filenames with newlines, but it works for simple cases.

## What About Directories?

To count directories instead of files, change `-type f` to `-type d`:

```bash
# Count directories
find /path/to/directory -type d | wc -l
```

Or count both files and directories:

```bash
# Count all items (files and directories)
find /path/to/directory | wc -l
```

## Counting Inodes

If you want to see how many inodes are used (which includes files, directories, and symlinks):

```bash
# Count all filesystem objects
find /path/to/directory | wc -l
```

This is useful when you're approaching inode limits on a filesystem.

Recursively counting files is simple with `find` and `wc`, but you have many options for filtering, formatting, and analyzing the results. Whether you need a quick count or detailed analysis by file type, size, or modification time, these techniques give you the flexibility to get exactly the information you need.
