---
title: 'How to Create a Copy of a Directory in Unix/Linux'
excerpt: 'Learn various methods to copy directories in Linux and Unix systems using cp, rsync, and tar commands with practical examples and best practices.'
category:
  name: 'Linux'
  slug: 'linux'
date: '2024-12-12'
publishedAt: '2024-12-12T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Linux
  - Unix
  - file management
  - cp command
  - rsync
  - directory operations
---

Copying directories is a fundamental operation in Unix and Linux systems. Whether you're backing up files, duplicating project structures, or moving data between locations, understanding the different methods and their appropriate use cases will make your file management tasks more efficient.

## Prerequisites

You'll need access to a Unix or Linux terminal with basic command-line knowledge. The commands shown work on most Unix-like systems including Linux, macOS, and BSD variants.

## Method 1: Using cp Command (Basic Copy)

The `cp` command is the most straightforward way to copy directories. Use the `-r` (recursive) flag to copy directories and their contents:

```bash
cp -r source_directory destination_directory
```

For example, to copy a directory called `projects` to `projects_backup`:

```bash
cp -r projects projects_backup
```

If the destination directory doesn't exist, it will be created. If it exists, the source directory will be copied inside it.

## Method 2: Using cp with Preservation Options

To preserve file attributes like timestamps, permissions, and ownership during copying:

```bash
cp -rp source_directory destination_directory
```

The `-p` flag preserves:

- File timestamps (modification, access times)
- File permissions
- File ownership (when possible)

For maximum preservation, use the `-a` (archive) flag:

```bash
cp -a source_directory destination_directory
```

The `-a` flag is equivalent to `-dpR` and preserves everything possible including symbolic links.

## Method 3: Using rsync for Advanced Copying

The `rsync` command offers more control and efficiency, especially for large directories:

```bash
rsync -av source_directory/ destination_directory/
```

Key advantages of rsync:

- Only copies changed files (incremental copying)
- Shows progress during transfer
- Better handling of symbolic links and special files

Common rsync options:

- `-a`: Archive mode (preserves permissions, timestamps, etc.)
- `-v`: Verbose output
- `-z`: Compress data during transfer
- `--progress`: Show transfer progress

Example with progress display:

```bash
rsync -av --progress source_directory/ destination_directory/
```

## Method 4: Using tar for Exact Replication

The `tar` command can create exact copies while preserving all file attributes:

```bash
tar -cf - source_directory | tar -xf - -C destination_path
```

This method pipes the tar archive directly to extract, creating an exact copy. To copy `myproject` to `/backup/myproject`:

```bash
tar -cf - myproject | tar -xf - -C /backup/
```

## Copying Directory Contents Only

To copy only the contents of a directory (not the directory itself), add a trailing slash to the source:

```bash
cp -r source_directory/* destination_directory/
```

Or with rsync:

```bash
rsync -av source_directory/ destination_directory/
```

Note the difference:

- `source_directory` copies the directory itself
- `source_directory/` copies the contents only

## Handling Special Cases

**Copying Hidden Files**: The `cp` command with `*` won't copy hidden files. Use:

```bash
cp -r source_directory/. destination_directory/
```

**Excluding Specific Files**: With rsync, you can exclude patterns:

```bash
rsync -av --exclude='*.log' --exclude='node_modules/' source/ dest/
```

**Following Symbolic Links**: To copy the actual files that symbolic links point to:

```bash
cp -rL source_directory destination_directory
```

## Interactive and Safe Copying

To prompt before overwriting existing files:

```bash
cp -ri source_directory destination_directory
```

To prevent accidental overwrites (no-clobber):

```bash
cp -rn source_directory destination_directory
```

## Copying Across File Systems

When copying between different file systems or when you want to ensure all attributes are preserved:

```bash
rsync -avX source_directory/ destination_directory/
```

The `-X` flag preserves extended attributes on supported file systems.

## Creating Backups with Timestamps

To create backups with timestamps in the directory name:

```bash
backup_name="backup_$(date +%Y%m%d_%H%M%S)"
cp -a important_directory "$backup_name"
```

This creates directories like `backup_20241212_143052`.

## Monitoring Copy Progress

For large directories, monitor progress with `pv` (pipe viewer):

```bash
tar -cf - source_directory | pv | tar -xf - -C destination_path
```

Or use rsync's built-in progress:

```bash
rsync -av --progress --stats source_directory/ destination_directory/
```

## Performance Considerations

**For Local Copies**: `cp` is usually fastest for simple operations:

```bash
cp -a source dest
```

**For Large Directories**: rsync is more efficient for subsequent copies:

```bash
rsync -av source/ dest/
```

**For Remote Copies**: rsync over SSH:

```bash
rsync -av source_directory/ user@remote:/path/destination/
```

## Common Gotchas and Solutions

**Problem**: Copying fails due to permissions
**Solution**: Use sudo when necessary:

```bash
sudo cp -a source_directory destination_directory
```

**Problem**: Running out of space during copy
**Solution**: Check available space first:

```bash
df -h destination_path
du -sh source_directory
```

**Problem**: Interrupting a copy operation
**Solution**: Use rsync for resumable transfers:

```bash
rsync -av --partial source_directory/ destination_directory/
```

## Scripting Directory Copies

Create a reusable backup script:

```bash
#!/bin/bash
backup_directory() {
    local source="$1"
    local backup_base="$2"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_dir="${backup_base}/backup_${timestamp}"

    echo "Creating backup: $backup_dir"
    rsync -av "$source/" "$backup_dir/"
    echo "Backup completed successfully"
}

# Usage: backup_directory /home/user/documents /backups
```

## Next Steps

Now that you can copy directories effectively, consider learning about:

- Setting up automated backups with cron jobs
- Using `find` command for selective copying
- Implementing incremental backup strategies
- Working with compression tools like `gzip` and `xz`
- Managing file permissions and ownership
