---
title: 'How to Tar a Directory While Excluding Files and Folders'
excerpt: "Create tar archives without including unnecessary files like node_modules, .git, or build artifacts. Learn to use --exclude patterns effectively for cleaner backups."
category:
  name: 'Linux'
  slug: 'linux'
date: '2025-03-10'
publishedAt: '2025-03-10T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Linux
  - tar
  - Archive
  - Backup
  - Command Line
---

You want to create a tar archive of your project, but you don't need the 500MB `node_modules` directory or the `.git` history in there. How do you exclude specific files and folders?

## TL;DR

Use the `--exclude` option with `tar` to skip files and directories. For example: `tar -czf archive.tar.gz --exclude='node_modules' --exclude='.git' project/`. You can specify multiple exclusions, use wildcards, and even read exclusion patterns from a file.

Creating archives without unnecessary files makes them smaller, faster to create, and easier to transfer. Let's look at how to exclude exactly what you don't need.

When you create a basic tar archive of a project directory:

```bash
tar -czf project-backup.tar.gz project/
```

You get everything, including dependencies, build artifacts, and version control data:

```
project-backup.tar.gz (823 MB)
├── project/
│   ├── src/              <- Want this
│   ├── node_modules/     <- Don't want (520 MB)
│   ├── .git/             <- Don't want (280 MB)
│   ├── dist/             <- Don't want (15 MB)
│   └── package.json      <- Want this
```

Most of that space is wasted on files you can regenerate.

## Excluding a Single Directory

Add `--exclude` before the source directory:

```bash
tar -czf project-backup.tar.gz --exclude='node_modules' project/
```

Now `node_modules` is skipped, and your archive is much smaller. The path in the exclusion is relative to the source directory you're archiving.

## Excluding Multiple Items

Add multiple `--exclude` options:

```bash
tar -czf project-backup.tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='dist' \
  --exclude='coverage' \
  project/
```

Each `--exclude` can be a file, directory, or pattern. Order doesn't matter - tar processes all exclusions before creating the archive.

## Using Wildcards in Exclusions

You can use wildcards to exclude patterns:

```bash
# Exclude all .log files
tar -czf backup.tar.gz --exclude='*.log' logs/

# Exclude all .tmp and .cache files
tar -czf backup.tar.gz --exclude='*.tmp' --exclude='*.cache' data/

# Exclude any directory named 'temp'
tar -czf backup.tar.gz --exclude='temp' project/
```

The wildcard matching works on the full path, so `*.log` matches `app.log` and `logs/error.log`.

## Excluding Files by Full Path

If you want to exclude a specific file or directory by its full path within the archive:

```bash
# Exclude a specific file
tar -czf backup.tar.gz --exclude='project/config/secrets.json' project/

# Exclude a specific subdirectory
tar -czf backup.tar.gz --exclude='project/src/legacy' project/
```

The path should match how it appears in the tar archive. If you're archiving `project/`, the paths inside start with `project/`.

## Using an Exclusion File

When you have many exclusions, put them in a file:

```bash
# Create exclusion list
cat > exclude-list.txt <<EOF
node_modules
.git
dist
build
coverage
*.log
*.tmp
.env
.DS_Store
EOF

# Use the exclusion file
tar -czf project-backup.tar.gz --exclude-from=exclude-list.txt project/
```

Each line in the file is treated as a separate `--exclude` pattern. Comments aren't supported, so every line must be a pattern.

This approach is useful for scripted backups where the exclusion list might change:

```bash
#!/bin/bash

PROJECT_DIR="$1"
EXCLUDE_FILE="$PROJECT_DIR/.tarignore"

if [ -f "$EXCLUDE_FILE" ]; then
    tar -czf "$PROJECT_DIR.tar.gz" --exclude-from="$EXCLUDE_FILE" "$PROJECT_DIR"
else
    tar -czf "$PROJECT_DIR.tar.gz" "$PROJECT_DIR"
fi
```

This script looks for a `.tarignore` file in the project and uses it if it exists.

## Excluding Hidden Files and Directories

To exclude all hidden files (starting with `.`):

```bash
tar -czf backup.tar.gz --exclude='*/.*' project/
```

Or exclude specific common hidden directories:

```bash
tar -czf backup.tar.gz \
  --exclude='.git' \
  --exclude='.svn' \
  --exclude='.DS_Store' \
  project/
```

## Practical Example: Web Application Backup

Here's a realistic backup command for a Node.js web application:

```bash
tar -czf webapp-$(date +%Y%m%d).tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='dist' \
  --exclude='build' \
  --exclude='coverage' \
  --exclude='.env' \
  --exclude='*.log' \
  --exclude='.DS_Store' \
  webapp/
```

This creates a dated archive like `webapp-20250310.tar.gz` with only the source code and configuration files you need.

For a Python project:

```bash
tar -czf python-app-$(date +%Y%m%d).tar.gz \
  --exclude='venv' \
  --exclude='.venv' \
  --exclude='__pycache__' \
  --exclude='.pytest_cache' \
  --exclude='.git' \
  --exclude='*.pyc' \
  --exclude='.env' \
  python-app/
```

## Excluding Files Based on Size

While tar doesn't have a built-in size filter, you can use `find` to create an exclusion list:

```bash
# Find all files larger than 100MB
find project/ -type f -size +100M > large-files.txt

# Create archive excluding those files
tar -czf backup.tar.gz --exclude-from=large-files.txt project/
```

You'll need to adjust the paths in the exclusion file if they don't match the archive structure.

## Verifying Exclusions Worked

Before creating the archive, you can test what would be included using `--exclude` with `--list`:

```bash
# Dry run - see what would be archived
tar -czf /dev/null \
  --exclude='node_modules' \
  --exclude='.git' \
  -v \
  project/
```

The `-v` (verbose) flag shows each file being added. Check that excluded items don't appear in the output.

After creating the archive, verify its contents:

```bash
# List archive contents
tar -tzf project-backup.tar.gz

# Or with less for easier reading
tar -tzf project-backup.tar.gz | less
```

You can also check the archive size:

```bash
ls -lh project-backup.tar.gz
```

If it's still huge, you probably missed something.

## Combining Inclusion and Exclusion

You can be more precise by excluding broadly and then including specific exceptions. This is useful when most of a directory should be excluded but a few files are needed:

```bash
# Exclude entire logs directory except for the latest log
tar -czf backup.tar.gz \
  --exclude='logs/*' \
  --exclude='!logs/latest.log' \
  project/
```

Note: The `!` negation syntax isn't supported in all versions of tar. For more complex filtering, use `find` to generate a file list:

```bash
# Create archive with only specific files
find project/ -name '*.conf' -o -name '*.json' > include-list.txt
tar -czf config-backup.tar.gz -T include-list.txt
```

## Common Exclusion Patterns by Project Type

For JavaScript/Node.js:
```bash
tar -czf backup.tar.gz \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='build' \
  --exclude='.next' \
  --exclude='out' \
  --exclude='coverage' \
  --exclude='.cache' \
  project/
```

For Python:
```bash
tar -czf backup.tar.gz \
  --exclude='venv' \
  --exclude='.venv' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='.pytest_cache' \
  --exclude='.tox' \
  --exclude='dist' \
  --exclude='build' \
  --exclude='*.egg-info' \
  project/
```

For Java/Maven:
```bash
tar -czf backup.tar.gz \
  --exclude='target' \
  --exclude='.idea' \
  --exclude='.settings' \
  --exclude='*.class' \
  project/
```

For Ruby:
```bash
tar -czf backup.tar.gz \
  --exclude='vendor/bundle' \
  --exclude='.bundle' \
  --exclude='tmp' \
  --exclude='log/*.log' \
  project/
```

## Excluding Git-Ignored Files

If you want to exclude everything in your `.gitignore`, there isn't a direct way to feed `.gitignore` patterns to tar (they use different syntax). But you can use `git archive` instead:

```bash
# Create archive of git repository excluding .gitignore files
git archive -o project.tar.gz HEAD
```

This creates an archive of the repository at the current HEAD, automatically excluding anything in `.gitignore`.

For non-git directories or more control, convert `.gitignore` patterns manually or use a script:

```bash
#!/bin/bash
# Note: This is simplified and won't handle all .gitignore syntax

PROJECT_DIR="$1"

# Convert .gitignore to tar exclusions
if [ -f "$PROJECT_DIR/.gitignore" ]; then
    tar -czf "$PROJECT_DIR.tar.gz" \
      --exclude-vcs \
      --exclude-from="$PROJECT_DIR/.gitignore" \
      "$PROJECT_DIR"
else
    tar -czf "$PROJECT_DIR.tar.gz" --exclude-vcs "$PROJECT_DIR"
fi
```

The `--exclude-vcs` option automatically excludes version control directories like `.git`, `.svn`, etc.

## Performance Considerations

Excluding files happens before compression, so you save time in two ways:
1. Less data to read from disk
2. Less data to compress

A backup that excludes `node_modules`:

```bash
# With node_modules (520 MB raw, 5 minutes)
tar -czf full-backup.tar.gz project/

# Without node_modules (50 MB raw, 30 seconds)
tar -czf lean-backup.tar.gz --exclude='node_modules' project/
```

The exclusion makes the backup 10x faster and 10x smaller.

Using exclusions effectively with tar lets you create lean, fast archives that include only what you need. Whether you're backing up projects, deploying code, or transferring files, knowing how to exclude unnecessary files makes the process much more efficient.
