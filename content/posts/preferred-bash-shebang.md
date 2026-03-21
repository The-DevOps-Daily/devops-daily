---
title: 'What Is the Preferred Bash Shebang?'
excerpt: 'Learn which shebang line to use for Bash scripts, the differences between common options, and how to write portable scripts that work across different Unix-like systems.'
category:
  name: 'Bash'
  slug: 'bash'
date: '2024-06-25'
publishedAt: '2024-06-25T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Bash
  - Shell Scripting
  - Linux
  - Unix
  - Best Practices
---

## TLDR

The preferred Bash shebang is `#!/bin/bash` for most Linux systems. Use `#!/usr/bin/env bash` if you need portability across systems where Bash might be installed in different locations. Avoid `#!/bin/sh` for Bash scripts since it may invoke a different shell. The shebang tells the system which interpreter to use when executing your script.

## What Is a Shebang?

The shebang (also called hashbang) is the first line in a script that starts with `#!` followed by the path to an interpreter. When you execute a script, the kernel reads this line to determine which program should process the file:

```bash
#!/bin/bash

echo "This script runs with Bash"
```

Without a shebang, the script runs with your current shell, which might not be Bash and could cause unexpected behavior.

## Common Shebang Options

Here are the most common shebangs you'll encounter for Bash scripts:

**#!/bin/bash** - Direct path to Bash:

```bash
#!/bin/bash

# Your script here
```

This is the standard choice on most Linux distributions where Bash lives at `/bin/bash`. It's fast and explicit.

**#!/usr/bin/env bash** - Uses env to find Bash:

```bash
#!/usr/bin/env bash

# Your script here
```

The `env` command searches for `bash` in your `PATH` and executes the first match. This adds portability but introduces a slight overhead.

**#!/bin/sh** - POSIX shell (not Bash):

```bash
#!/bin/sh

# POSIX-compliant script only
```

This invokes the system's default POSIX shell, which might be `dash`, `ash`, or `bash` in POSIX mode. Don't use this for Bash-specific features.

## When to Use Each Shebang

Your choice depends on where and how your script will run:

**Use `#!/bin/bash` when:**
- Writing scripts for standard Linux servers
- You control the deployment environment
- Performance matters (no PATH lookup needed)
- You're targeting systems where Bash is at `/bin/bash`

**Use `#!/usr/bin/env bash` when:**
- Writing portable scripts for multiple environments
- Users might install Bash in non-standard locations
- Targeting macOS where Bash might be in `/usr/local/bin/bash`
- Creating scripts for distribution (npm packages, GitHub repos)

**Use `#!/bin/sh` when:**
- Writing POSIX-compliant scripts without Bash features
- Maximum portability across all Unix-like systems
- The script needs to run in minimal environments (containers, embedded systems)

The execution flow looks like this:

```
Direct shebang (#!/bin/bash)
    |
    v
Kernel reads shebang
    |
    v
Executes /bin/bash directly
    |
    v
Script runs


env shebang (#!/usr/bin/env bash)
    |
    v
Kernel reads shebang
    |
    v
Executes /usr/bin/env
    |
    v
env searches PATH for bash
    |
    v
Executes found bash
    |
    v
Script runs
```

## Why #!/bin/bash Is Generally Preferred

On the vast majority of Linux systems, Bash is installed at `/bin/bash` by default. Using the direct path has several advantages:

**Speed**: No PATH search overhead
**Explicitness**: Clear which interpreter you're using
**Security**: Can't be hijacked by putting a fake bash earlier in PATH

Here's a complete example:

```bash
#!/bin/bash

set -euo pipefail

DB_HOST="${1:-localhost}"
BACKUP_DIR="/var/backups/db"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Perform backup
timestamp=$(date +%Y%m%d_%H%M%S)
pg_dump -h "$DB_HOST" production_db > "$BACKUP_DIR/backup_${timestamp}.sql"

echo "Backup completed: $BACKUP_DIR/backup_${timestamp}.sql"
```

This script uses Bash-specific features like `${1:-localhost}` parameter expansion and will fail if run with a basic POSIX shell.

## When env Is Better

The `env` approach shines in heterogeneous environments:

```bash
#!/usr/bin/env bash

# This script works whether bash is at:
# /bin/bash (most Linux)
# /usr/local/bin/bash (macOS with Homebrew)
# /opt/homebrew/bin/bash (macOS on Apple Silicon)
# ~/bin/bash (user installation)
```

This flexibility is valuable for open-source tools distributed across different platforms. If someone installs a newer Bash version in their home directory or via a package manager, your script will use it.

However, be aware of the security consideration: if an attacker can modify your PATH, they could make your script execute a malicious bash replacement. For system administration scripts running as root, the direct path is safer.

## Common Mistakes

**Using #!/bin/sh for Bash scripts:**

```bash
#!/bin/sh
# WRONG: This might not be Bash

# This will fail on Ubuntu where /bin/sh is dash
servers=("web1" "web2" "db1")
echo "${servers[0]}"
```

Arrays are a Bash feature. On Ubuntu, `/bin/sh` points to `dash`, which doesn't support arrays, so this script fails.

**Forgetting the shebang:**

```bash
# No shebang

echo "Which shell is running me?"
```

Without a shebang, the script runs with your current shell. If you're testing in Bash but it runs in `dash` in production, you'll get different behavior.

**Spaces in the shebang:**

```bash
#! /bin/bash  # WORKS but uncommon
#!/bin/bash   # PREFERRED
```

While spaces after `#!` technically work, the convention is no space for consistency.

## Shebang with Options

You can pass options to the interpreter in the shebang:

```bash
#!/bin/bash -e

# Script exits immediately if any command fails
cp file1.txt file2.txt
mv file2.txt /destination/
```

The `-e` option (equivalent to `set -e`) makes the script exit on the first error. However, for better clarity, it's often preferable to use `set` commands in the script body:

```bash
#!/bin/bash

set -euo pipefail

# Script logic here
```

This makes the options more visible and easier to modify.

## Checking Your System

To see where Bash is installed on your system:

```bash
which bash
```

Typical output:
```
/bin/bash
```

On macOS with Homebrew:
```
/usr/local/bin/bash
```

To see what `/bin/sh` points to:

```bash
ls -l /bin/sh
```

On Ubuntu/Debian:
```
lrwxrwxrwx 1 root root 4 /bin/sh -> dash
```

On CentOS/RHEL:
```
lrwxrwxrwx 1 root root 4 /bin/sh -> bash
```

## Making Scripts Executable

The shebang only works if your script has execute permission:

```bash
# Create a script
cat > hello.sh << 'EOF'
#!/bin/bash
echo "Hello, World!"
EOF

# Add execute permission
chmod +x hello.sh

# Run it
./hello.sh
```

Without execute permission, you'd need to explicitly invoke the interpreter:

```bash
bash hello.sh
```

## Practical Example: Cross-Platform Script

Here's a script designed to work across different environments:

```bash
#!/usr/bin/env bash

# Verify we're running Bash 4.0 or later
if [ "${BASH_VERSINFO[0]}" -lt 4 ]; then
    echo "Error: This script requires Bash 4.0 or later"
    echo "Current version: $BASH_VERSION"
    exit 1
fi

# Now safe to use Bash 4+ features
declare -A config
config[host]="localhost"
config[port]="5432"
config[database]="production"

echo "Connecting to ${config[host]}:${config[port]}/${config[database]}"
```

This script uses `#!/usr/bin/env bash` for portability but validates the Bash version before using version-specific features like associative arrays.

## Docker and Container Considerations

In containers, especially Alpine Linux-based images, Bash might not be installed at all. The default shell is often `ash` (from BusyBox):

```dockerfile
# Alpine doesn't include Bash by default
FROM alpine:latest

# Install bash if your scripts need it
RUN apk add --no-cache bash

COPY script.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/script.sh
```

For container scripts, consider writing POSIX-compliant `#!/bin/sh` scripts to avoid the Bash dependency, or explicitly install Bash in your Dockerfile.

The choice of shebang reflects a trade-off between portability and specificity. For scripts you control and deploy to known environments, `#!/bin/bash` is clear and direct. For widely distributed tools or scripts running across varied systems, `#!/usr/bin/env bash` offers flexibility. Just make sure your script's features match the interpreter it declares - don't use Bash-specific syntax with a `#!/bin/sh` shebang.
