---
title: 'How to Get the Full Path of a File in Linux'
excerpt: "Learn different methods to get the absolute path of a file in Linux, from simple commands like realpath to handling relative paths and symlinks correctly."
category:
  name: 'Linux'
  slug: 'linux'
date: '2025-01-22'
publishedAt: '2025-01-22T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Linux
  - File System
  - Command Line
  - Bash
  - Path Resolution
---

You know a file exists in your current directory or somewhere relative to where you are, but you need its absolute path - maybe for a configuration file, a script, or to pass to another program. What's the quickest way to get it?

## TL;DR

Use `realpath filename` to get the absolute path of any file. If `realpath` isn't available, use `readlink -f filename` on Linux or `pwd` combined with the filename. For multiple files, use `realpath *` or combine with `find`. To resolve symlinks and get the target's path, both `realpath` and `readlink -f` handle this automatically.

Getting the full path of a file is a common task in shell scripts, when configuring applications, or when you need to reference files from different directories.

Let's say you have a file called `config.json` in your current directory and you need its full path:

```bash
# Get the absolute path
realpath config.json
```

Output:
```
/home/user/projects/myapp/config.json
```

The `realpath` command converts any path (relative or absolute) to its canonical absolute form.

## Using readlink as an Alternative

On some older systems, `realpath` might not be available. Use `readlink -f` instead:

```bash
# Get the absolute path with readlink
readlink -f config.json
```

The `-f` flag means "follow" - it resolves all symlinks and relative path components to give you the canonical path.

On macOS, `readlink` doesn't have the `-f` option by default. If you installed GNU coreutils via Homebrew, use `greadlink`:

```bash
# macOS with GNU coreutils
greadlink -f config.json
```

## Getting the Path of the Current Directory

If you just need the full path of your current directory:

```bash
pwd
```

This prints the working directory - the absolute path to where you are right now.

To combine the current directory with a filename:

```bash
# Manually construct the full path
echo "$(pwd)/config.json"
```

This works but doesn't handle edge cases like `./` or `../` in the path.

## Getting Paths for Multiple Files

To get the full path of all files in the current directory:

```bash
# Get absolute paths for all files
realpath *

# Only for specific file types
realpath *.json

# For files matching a pattern
realpath config*.json
```

Each file's absolute path is printed on a separate line.

## Using find to Get Full Paths

The `find` command always prints full paths by default:

```bash
# Find a file and get its full path
find /home/user -name "config.json"
```

Output:
```
/home/user/projects/myapp/config.json
/home/user/backup/old-config.json
```

If you're already in a directory and want full paths:

```bash
# Find all JSON files in current directory and subdirectories
find "$(pwd)" -name "*.json"
```

The `$(pwd)` expands to the current directory's absolute path, so `find` searches from there and prints absolute paths.

## Resolving Symlinks

If you have a symlink and want to know where it points:

```bash
# Create a symlink for demonstration
ln -s /var/www/app/current /home/user/myapp-link

# Get the target's absolute path
realpath /home/user/myapp-link
```

Output:
```
/var/www/app/current
```

Both `realpath` and `readlink -f` follow symlinks to their ultimate target. If the symlink points to another symlink, they keep following until they reach a real file or directory.

To see the symlink target without resolving further symlinks:

```bash
# Show where the symlink points (may be relative)
readlink /home/user/myapp-link
```

Output might be relative:
```
../var/www/app/current
```

## Getting the Directory of a File

If you have a file path and want just the directory part:

```bash
# Get the directory containing the file
dirname "$(realpath config.json)"
```

This gives you the absolute path to the file's parent directory.

For example:
```bash
realpath config.json
# Output: /home/user/projects/myapp/config.json

dirname "$(realpath config.json)"
# Output: /home/user/projects/myapp
```

## Getting the Absolute Path in a Script

When writing scripts, you often need the absolute path of the script itself or files relative to it:

```bash
#!/bin/bash

# Get the script's directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Get the script's absolute path
SCRIPT_PATH="$(realpath "${BASH_SOURCE[0]}")"

echo "Script directory: $SCRIPT_DIR"
echo "Script path: $SCRIPT_PATH"

# Reference a config file relative to the script
CONFIG_FILE="$SCRIPT_DIR/config.json"
echo "Config file: $CONFIG_FILE"
```

The `${BASH_SOURCE[0]}` variable contains the path to the script, even if it was sourced or called from elsewhere.

## Handling Files with Spaces

File names with spaces need proper quoting:

```bash
# Correct - quotes preserve spaces
realpath "my config file.json"

# Also correct - escaping spaces
realpath my\ config\ file.json
```

When using variables:

```bash
FILE="my config file.json"

# Always quote variables
realpath "$FILE"
```

## Getting Paths for Files in Other Directories

You can get the absolute path of a file anywhere, not just in the current directory:

```bash
# Relative path
realpath ../configs/app.json

# Path with . and ..
realpath ./src/../configs/app.json
```

Both get resolved to clean absolute paths.

## Using basename and dirname Together

The `basename` command gets just the filename without the directory:

```bash
FULL_PATH="/home/user/projects/myapp/config.json"

# Get just the filename
basename "$FULL_PATH"
# Output: config.json

# Get just the directory
dirname "$FULL_PATH"
# Output: /home/user/projects/myapp
```

These are useful for splitting paths in scripts.

## Converting Relative Paths to Absolute Paths

If you have a relative path and need to convert it:

```bash
# You're in /home/user
cd /home/user

# Convert relative path to absolute
realpath projects/myapp/config.json
# Output: /home/user/projects/myapp/config.json
```

This works even if you haven't changed into the directory yet.

## Practical Example: Backup Script

Here's a script that backs up files and logs their absolute paths:

```bash
#!/bin/bash
set -e

BACKUP_DIR="/backup/$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"

# Files to backup (relative paths)
FILES=(
    "config.json"
    "../shared/database.conf"
    "logs/app.log"
)

echo "Backing up files to $BACKUP_DIR"

for file in "${FILES[@]}"; do
    # Get absolute path of source file
    SOURCE=$(realpath "$file")

    # Get just the filename
    FILENAME=$(basename "$file")

    # Copy to backup directory
    cp "$SOURCE" "$BACKUP_DIR/$FILENAME"

    echo "Backed up: $SOURCE"
done

echo "Backup complete!"
```

This script handles relative paths correctly and logs exactly which files were backed up.

## Cross-Platform Considerations

Different operating systems handle paths slightly differently:

On Linux, most modern distributions have `realpath`:
```bash
realpath file.txt
```

On older Linux systems without `realpath`:
```bash
readlink -f file.txt
```

On macOS (without GNU coreutils):
```bash
# This works but is more complex
python3 -c "import os,sys; print(os.path.realpath(sys.argv[1]))" file.txt
```

Or install GNU coreutils:
```bash
brew install coreutils
greadlink -f file.txt
```

## When You Don't Need Full Paths

Sometimes relative paths are better:

- In version control, relative paths make repositories portable
- In configuration files shared between users, relative paths avoid hardcoding usernames
- In containers, relative paths work regardless of mount points

Use absolute paths when:
- Passing paths to system services or cron jobs
- Referencing files from scripts that might be called from different directories
- Logging file locations for debugging
- Configuring applications that need explicit paths

Getting the full path of a file is straightforward with `realpath` or `readlink -f`. These tools handle relative paths, symlinks, and complex path structures, giving you clean absolute paths you can use reliably in scripts and configurations.
