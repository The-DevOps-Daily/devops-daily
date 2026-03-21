---
title: 'How to Fix "Argument List Too Long" Error for rm, cp, and mv Commands'
excerpt: "Solve the 'argument list too long' error when working with thousands of files. Learn to use find, xargs, and loops as alternatives to wildcards for bulk file operations."
category:
  name: 'Linux'
  slug: 'linux'
date: '2024-11-08'
publishedAt: '2024-11-08T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Linux
  - File Operations
  - Error Handling
  - Command Line
  - Troubleshooting
---

You try to delete thousands of files with `rm *.log` and get "bash: /bin/rm: Argument list too long". What's happening, and how do you work with large numbers of files?

## TL;DR

The error occurs when shell glob expansion creates a command line longer than the system's limit (usually 128KB-2MB). Use `find` with `-delete` for removal: `find . -name "*.log" -delete`, or pipe to `xargs`: `find . -name "*.log" | xargs rm`. For copying or moving, use `find -exec` or `xargs`. Alternatively, use a loop: `for file in *.log; do rm "$file"; done`.

When you use wildcards like `*.log`, the shell expands them into a list of all matching filenames before running the command. With tens of thousands of files, this list exceeds the system's limit.

Here's what happens when you run `rm *.log`:

```
Step 1: Shell expands *.log to all matching files
        file1.log file2.log file3.log ... (50,000 files)

Step 2: Shell tries to run:
        rm file1.log file2.log file3.log ... (50,000 arguments)

Step 3: Kernel says: "Too many arguments!"
        Error: Argument list too long
```

## Using find with -delete

The simplest solution for removing files:

```bash
find . -name "*.log" -delete
```

This finds all `.log` files and deletes them directly, without creating a huge argument list.

Be careful: test your find command first without `-delete`:

```bash
# Test what will be deleted
find . -name "*.log"

# If that looks right, add -delete
find . -name "*.log" -delete
```

## Using find with -exec

For commands that don't have a find equivalent (like `cp` or custom scripts):

```bash
# Delete files
find . -name "*.log" -exec rm {} \;

# Copy files
find . -name "*.log" -exec cp {} /backup/ \;

# Move files
find . -name "*.log" -exec mv {} /archive/ \;
```

The `{}` is replaced with each filename, and `\;` ends the command.

For better performance, use `+` instead of `\;` to run the command with multiple files at once:

```bash
find . -name "*.log" -exec rm {} +
```

This batches files together, similar to xargs.

## Using find with xargs

Pipe find results to xargs, which batches them efficiently:

```bash
# Delete files
find . -name "*.log" | xargs rm

# Copy files
find . -name "*.log" | xargs -I {} cp {} /backup/

# Move files
find . -name "*.log" | xargs -I {} mv {} /archive/
```

The `-I {}` option tells xargs where to insert the filename.

Handle filenames with spaces correctly:

```bash
find . -name "*.log" -print0 | xargs -0 rm
```

The `-print0` and `-0` options use null characters as separators instead of spaces, preventing issues with filenames containing spaces or special characters.

## Using a Loop

For more control or complex operations, use a loop:

```bash
# Delete files
for file in *.log; do
    rm "$file"
done
```

This processes files one at a time, so there's no argument limit issue.

For very large directories where even the glob expansion fails:

```bash
# Use find to feed the loop
find . -name "*.log" | while read -r file; do
    rm "$file"
done
```

Or with null separators for safety:

```bash
find . -name "*.log" -print0 | while IFS= read -r -d '' file; do
    rm "$file"
done
```

## Checking System Limits

See your system's argument limit:

```bash
getconf ARG_MAX
```

Output (varies by system):
```
2097152
```

This is in bytes. A typical modern Linux system has a limit of 2MB.

To see how much space your glob would use:

```bash
# Count files
ls *.log | wc -l

# Estimate argument size
ls *.log | wc -c
```

## Practical Example: Delete Old Log Files

Remove logs older than 30 days:

```bash
find /var/log -name "*.log" -mtime +30 -delete
```

Or with more control:

```bash
find /var/log -name "*.log" -mtime +30 -print0 | xargs -0 rm -f
```

## Practical Example: Archive Files

Move old files to an archive directory:

```bash
#!/bin/bash

SOURCE="/data/uploads"
ARCHIVE="/archive/$(date +%Y%m%d)"

# Create archive directory
mkdir -p "$ARCHIVE"

# Find and move files older than 90 days
find "$SOURCE" -type f -mtime +90 -exec mv {} "$ARCHIVE"/ \;

echo "Files archived to $ARCHIVE"
```

## Practical Example: Batch Copy with Progress

Copy thousands of files with progress indication:

```bash
#!/bin/bash

COUNT=$(find . -name "*.jpg" | wc -l)
echo "Copying $COUNT files..."

COPIED=0
find . -name "*.jpg" -print0 | while IFS= read -r -d '' file; do
    cp "$file" /backup/
    COPIED=$((COPIED + 1))
    echo -ne "Progress: $COPIED/$COUNT\r"
done

echo -e "\nDone!"
```

## Comparing Different Methods

**Performance comparison for 100,000 files:**

```bash
# Fastest: find with -delete
time find . -name "*.tmp" -delete
# real: 0m2.341s

# Fast: find with -exec and +
time find . -name "*.tmp" -exec rm {} +
# real: 0m3.112s

# Slower: find with xargs
time find . -name "*.tmp" | xargs rm
# real: 0m3.654s

# Slowest: while loop
time find . -name "*.tmp" | while read f; do rm "$f"; done
# real: 0m45.231s
```

For simple deletion, `find -delete` is fastest. For other operations, `find -exec` with `+` is usually best.

## Handling Directories

To remove directories with many files:

```bash
# Remove directory and all contents
rm -rf large_directory/

# Or use find
find large_directory -delete
```

If `rm -rf` fails with argument list errors (rare), use find:

```bash
find large_directory -type f -delete
find large_directory -type d -delete
```

## Working in Specific Directories

Limit find to current directory only (no subdirectories):

```bash
# Only current directory
find . -maxdepth 1 -name "*.log" -delete
```

Or search only subdirectories (not current):

```bash
# Skip current directory
find . -mindepth 1 -name "*.log" -delete
```

## Excluding Certain Files

Delete some files but not others:

```bash
# Delete all .log except error.log
find . -name "*.log" ! -name "error.log" -delete

# Delete all .txt except those starting with "keep"
find . -name "*.txt" ! -name "keep*" -delete
```

## Dry Run Before Deletion

Always test destructive operations:

```bash
# See what would be deleted
find . -name "*.tmp" -print

# If it looks good, delete
find . -name "*.tmp" -delete
```

Or create a list first:

```bash
# Save list to review
find . -name "*.old" > files-to-delete.txt

# Review the list
less files-to-delete.txt

# Delete based on the list
cat files-to-delete.txt | xargs rm
```

## Parallel Processing with xargs

For faster operations on multi-core systems, use parallel execution:

```bash
# Run 4 rm processes in parallel
find . -name "*.tmp" | xargs -P 4 rm

# Adjust -P based on CPU cores
find . -name "*.log" | xargs -P 8 rm
```

This can significantly speed up operations on large filesystems.

## Alternative: GNU Parallel

For complex parallel operations, use GNU parallel:

```bash
# Install parallel
sudo apt install parallel

# Delete in parallel
find . -name "*.tmp" | parallel rm

# With progress bar
find . -name "*.log" | parallel --progress rm
```

## When Wildcards Work Fine

Wildcards are fine for reasonable numbers of files:

```bash
# This works fine for dozens or hundreds of files
rm *.log
cp *.txt /backup/
mv *.jpg /photos/
```

The error only happens with thousands of files. For normal use, wildcards are simpler and more readable.

## Preventing the Problem

Design your directory structure to avoid accumulating too many files in one directory:

```bash
# Bad: All files in one directory
/uploads/
  file1.jpg
  file2.jpg
  ... (100,000 files)

# Better: Organize by date or hash
/uploads/2024/03/28/
  file1.jpg
  file2.jpg
  ... (100 files per day)
```

Or use subdirectories based on file characteristics:

```bash
# Organize by first letter of filename
/uploads/a/
/uploads/b/
/uploads/c/
```

## Monitoring File Counts

Set up monitoring to alert when directories get too large:

```bash
#!/bin/bash

DIR="/var/uploads"
THRESHOLD=10000

COUNT=$(find "$DIR" -maxdepth 1 -type f | wc -l)

if [ $COUNT -gt $THRESHOLD ]; then
    echo "WARNING: $DIR contains $COUNT files (threshold: $THRESHOLD)"
    # Send alert
fi
```

The "argument list too long" error happens when wildcards expand to too many files. Use `find` with `-delete`, `-exec`, or pipe to `xargs` as robust alternatives that handle any number of files efficiently.
