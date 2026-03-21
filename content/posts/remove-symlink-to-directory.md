---
title: 'How to Remove a Symlink to a Directory in Linux'
excerpt: "Removing a symlink to a directory can be tricky if you're not careful. Learn the correct way to delete symlinks without accidentally removing the target directory's contents."
category:
  name: 'Linux'
  slug: 'linux'
date: '2025-02-15'
publishedAt: '2025-02-15T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Linux
  - File System
  - Symlinks
  - Command Line
  - DevOps
---

You've created a symlink to a directory, and now you need to remove it. Should you use `rm`, `rmdir`, or `unlink`? And what's the deal with trailing slashes?

## TL;DR

Use `rm` or `unlink` to remove a symlink to a directory. Don't add a trailing slash - if you do, you might accidentally delete the contents of the target directory instead of just the symlink. The command is simply: `rm symlinkname` or `unlink symlinkname`.

Symlinks (symbolic links) are pointers to other files or directories. When you remove a symlink, you're only deleting the pointer, not the thing it points to. But there's a catch: if you're not careful with the syntax, you can accidentally delete the actual directory's contents.

Let's start with a practical example. Say you've created a symlink to your project directory:

```bash
# Create a symlink called 'current' pointing to 'project-v2'
ln -s /var/www/project-v2 /var/www/current
```

```
/var/www/
    ├── project-v1/
    ├── project-v2/
    │   ├── index.html
    │   └── config.js
    └── current -> /var/www/project-v2
```

Now you want to remove the `current` symlink. Here's the correct way:

```bash
# Remove the symlink
rm /var/www/current
```

The symlink is gone, but `/var/www/project-v2` and all its contents remain untouched.

## The Trailing Slash Problem

This is where many people get tripped up. If you add a trailing slash when removing a symlink to a directory, the behavior changes:

```bash
# DANGER: This follows the symlink and can delete directory contents
rm -r /var/www/current/
```

With the trailing slash, some shells and commands treat the symlink as if you're referring to the target directory itself. If you're using `rm -r`, you might end up deleting the contents of `/var/www/project-v2` instead of just removing the symlink.

To stay safe, never add a trailing slash when removing a symlink:

```bash
# Correct - removes only the symlink
rm /var/www/current

# Dangerous - might affect the target directory
rm -r /var/www/current/
```

## Using unlink Instead of rm

The `unlink` command is specifically designed to remove a single file or symlink. It's more explicit about what it does:

```bash
# Remove the symlink using unlink
unlink /var/www/current
```

The advantage of `unlink` is that it only removes the link itself - it won't recursively delete anything, and it doesn't accept options like `-r` or `-f`. This makes it safer if you're writing scripts and want to avoid accidental deletions.

## Checking if a Symlink Exists Before Removing It

In scripts, you'll often want to check if a symlink exists before trying to remove it. Use the `-L` test operator:

```bash
#!/bin/bash

SYMLINK_PATH="/var/www/current"

# Check if the path exists and is a symlink
if [ -L "$SYMLINK_PATH" ]; then
    echo "Removing symlink: $SYMLINK_PATH"
    rm "$SYMLINK_PATH"
else
    echo "No symlink found at $SYMLINK_PATH"
fi
```

The `-L` test returns true if the path is a symlink, regardless of whether the target exists. This is different from `-e`, which checks if the path exists (and follows symlinks).

You can also check if a symlink is broken (points to a non-existent target):

```bash
#!/bin/bash

SYMLINK_PATH="/var/www/current"

# Check if it's a symlink but the target doesn't exist
if [ -L "$SYMLINK_PATH" ] && [ ! -e "$SYMLINK_PATH" ]; then
    echo "Removing broken symlink: $SYMLINK_PATH"
    rm "$SYMLINK_PATH"
fi
```

This is useful for cleanup scripts that remove broken symlinks.

## Finding and Removing Multiple Symlinks

If you need to remove all symlinks in a directory, you can combine `find` with `-type l`:

```bash
# Find all symlinks in /var/www and remove them
find /var/www -type l -delete
```

The `-type l` flag matches symlinks, and `-delete` removes them. This command only removes the symlinks themselves, not their targets.

If you want to see what will be deleted before running the command, omit the `-delete` flag first:

```bash
# Preview what would be deleted
find /var/www -type l

# Then actually delete
find /var/www -type l -delete
```

To remove only broken symlinks (where the target no longer exists):

```bash
# Find and remove broken symlinks
find /var/www -xtype l -delete
```

The `-xtype l` option matches symlinks whose targets don't exist.

## Removing Symlinks in a Deployment Script

A common use case is updating a symlink in a deployment script. You want to remove the old symlink and create a new one pointing to the latest release:

```bash
#!/bin/bash
set -e

RELEASES_DIR="/var/www/releases"
CURRENT_LINK="/var/www/current"
NEW_RELEASE="$RELEASES_DIR/release-20250215"

# Remove the old symlink if it exists
[ -L "$CURRENT_LINK" ] && rm "$CURRENT_LINK"

# Create a new symlink pointing to the new release
ln -s "$NEW_RELEASE" "$CURRENT_LINK"

echo "Deployment complete. Current now points to $NEW_RELEASE"
```

This pattern is safe because:
- We check if the symlink exists with `[ -L "$CURRENT_LINK" ]`
- We don't use a trailing slash on the `rm` command
- We use `set -e` so the script stops if anything fails

## What About rmdir?

You might wonder if `rmdir` works for removing symlinks to directories. It does, but it's not recommended:

```bash
# This works but is misleading
rmdir /var/www/current
```

The problem with `rmdir` is that it's meant for removing empty directories. Using it for symlinks is confusing to anyone reading your code. Stick with `rm` or `unlink` for clarity.

## Symlinks vs Hard Links

While we're talking about symlinks, it's worth noting the difference between symbolic links (symlinks) and hard links. Symlinks are pointers to a path, while hard links are additional directory entries pointing to the same inode.

```bash
# Create a symlink (points to a path)
ln -s /var/www/project-v2 /var/www/current-symlink

# Create a hard link (shares the same inode)
ln /var/www/project-v2/index.html /var/www/index-hardlink.html
```

When you remove a symlink, you're just deleting the pointer. When you remove a hard link, you're removing one of potentially many directory entries pointing to the file - the file's data isn't deleted until the last hard link is removed.

For directories, you can only create symlinks, not hard links (with rare exceptions). So when you're working with directory links, you're always dealing with symlinks.

## Replacing a Symlink Atomically

If you're updating a symlink that's actively being used (like in a production deployment), you want to replace it atomically to avoid downtime. The `ln -sf` command isn't atomic - there's a brief moment where the symlink doesn't exist.

For atomic replacement, use `ln` with a temporary name, then `mv`:

```bash
#!/bin/bash

RELEASES_DIR="/var/www/releases"
CURRENT_LINK="/var/www/current"
NEW_RELEASE="$RELEASES_DIR/release-20250215"

# Create a new symlink with a temporary name
ln -s "$NEW_RELEASE" "$CURRENT_LINK.tmp"

# Atomically replace the old symlink with the new one
mv -T "$CURRENT_LINK.tmp" "$CURRENT_LINK"
```

The `mv -T` command treats the destination as a file (not a directory), so it replaces the symlink atomically. This way, there's no moment where `current` doesn't exist.

Removing symlinks is straightforward once you know the rules: use `rm` or `unlink`, never add a trailing slash, and check with `-L` if you need to verify it's actually a symlink. For deployment scripts, consider atomic replacement techniques to avoid downtime.
