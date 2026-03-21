---
title: 'What Does set -e Mean in a Bash Script?'
excerpt: "The set -e command in Bash causes your script to exit immediately when any command fails. Learn when to use it, how it works, and common pitfalls to avoid."
category:
  name: 'Bash'
  slug: 'bash'
date: '2024-12-20'
publishedAt: '2024-12-20T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Bash
  - Shell Scripting
  - Error Handling
  - Linux
  - DevOps
---

You're writing a Bash script to automate a deployment, and someone suggests adding `set -e` at the top. What does it actually do, and should you use it?

## TL;DR

`set -e` tells Bash to exit immediately if any command returns a non-zero exit code (indicating failure). This prevents your script from continuing after an error, which can save you from cascading failures. However, it has nuances - it doesn't work inside pipelines by default, and some commands are exceptions to the rule.

The `set -e` option is one of the most common error-handling mechanisms in shell scripts. When enabled, your script will stop executing as soon as any command fails, rather than blindly continuing to the next line. This behavior is especially useful in deployment scripts, CI/CD pipelines, and any automation where a failed step should halt the entire process.

Let's say you're writing a backup script. Without `set -e`, if one command fails, the script keeps going:

```bash
#!/bin/bash

# Without set -e
mkdir /backup/db
mysqldump mydb > /backup/db/dump.sql
gzip /backup/db/dump.sql
echo "Backup complete!"
```

If the `mkdir` command fails because the directory already exists with wrong permissions, the script continues anyway. The `mysqldump` command then writes to a location that doesn't exist, and you get a misleading "Backup complete!" message at the end.

Now let's add `set -e`:

```bash
#!/bin/bash
set -e

# With set -e
mkdir /backup/db
mysqldump mydb > /backup/db/dump.sql
gzip /backup/db/dump.sql
echo "Backup complete!"
```

If `mkdir` fails now, the script stops immediately. You won't see the "Backup complete!" message, and you won't have a corrupted or missing backup file.

## How Exit Codes Work in Bash

Every command in Linux returns an exit code when it finishes - a number between 0 and 255. By convention, 0 means success, and anything else means failure. You can check the exit code of the last command with `$?`:

```bash
ls /existing-directory
echo $?  # Prints: 0

ls /nonexistent-directory
echo $?  # Prints: 2 (or another non-zero value)
```

Without `set -e`, Bash ignores these exit codes and keeps executing commands. With `set -e`, any non-zero exit code causes the script to exit immediately.

## When set -e Doesn't Apply

There are several situations where `set -e` won't cause your script to exit, even if a command fails. Understanding these exceptions is important.

### Commands in Conditional Statements

If a command is part of an `if` statement, `while` loop, or `until` loop condition, its failure won't trigger `set -e`:

```bash
#!/bin/bash
set -e

# This won't exit the script even if grep fails
if grep "error" /var/log/app.log; then
    echo "Found errors"
fi

echo "Script continues..."
```

This makes sense - you're explicitly checking whether the command succeeds or fails, so `set -e` doesn't interfere.

### Commands with || or &&

When you use `||` (OR) or `&&` (AND) operators, the command is part of a conditional expression, so `set -e` doesn't apply:

```bash
#!/bin/bash
set -e

# Script won't exit here even if first command fails
rm /tmp/cache.txt || echo "File didn't exist"

# Script continues
echo "Moving on..."
```

### Pipelines (Without pipefail)

By default, `set -e` only checks the exit code of the last command in a pipeline:

```bash
#!/bin/bash
set -e

# If cat fails but grep succeeds, the script continues
cat /nonexistent-file | grep "pattern"
```

```
     Command 1      Command 2      Exit code checked
     ---------      ---------      -----------------
        cat      |     grep     ->       grep only
```

If `cat` fails but `grep` returns 0 (because it successfully processed empty input), the pipeline is considered successful. This is one of the biggest gotchas with `set -e`.

To fix this, use `set -o pipefail` alongside `set -e`:

```bash
#!/bin/bash
set -e
set -o pipefail

# Now the script exits if either cat or grep fails
cat /nonexistent-file | grep "pattern"
```

## Combining set -e with set -u and set -o pipefail

Many scripts use a combination of these options for robust error handling:

```bash
#!/bin/bash
set -euo pipefail

# set -e: Exit on any error
# set -u: Exit if you reference an undefined variable
# set -o pipefail: Exit if any command in a pipeline fails
```

The `set -u` option catches typos in variable names:

```bash
#!/bin/bash
set -euo pipefail

DATABSE_NAME="mydb"  # Typo: should be DATABASE_NAME

# This will fail because $DATABASE_NAME is undefined
echo "Backing up $DATABASE_NAME"
```

Without `set -u`, the script would print "Backing up " (with an empty variable), and you'd waste time debugging why the backup didn't work.

## Temporarily Disabling set -e

Sometimes you want to allow a specific command to fail without stopping the script. You have a few options.

Use `|| true` to explicitly mark a command as "okay to fail":

```bash
#!/bin/bash
set -e

# This command can fail without stopping the script
rm /tmp/cache.txt || true

echo "Continuing regardless..."
```

Or disable `set -e` temporarily and re-enable it:

```bash
#!/bin/bash
set -e

# Disable error checking
set +e
risky_command_that_might_fail
set -e

# Error checking is back on
important_command
```

## Practical Example: Deployment Script

Here's a deployment script that uses `set -e` effectively:

```bash
#!/bin/bash
set -euo pipefail

DEPLOY_DIR="/var/www/myapp"
BACKUP_DIR="/var/backups/myapp"

# Create backup directory if it doesn't exist (allowed to fail silently)
mkdir -p "$BACKUP_DIR" || true

# These commands must succeed or the deployment stops
echo "Creating backup..."
tar -czf "$BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S).tar.gz" "$DEPLOY_DIR"

echo "Pulling latest code..."
cd "$DEPLOY_DIR"
git fetch origin
git reset --hard origin/main

echo "Installing dependencies..."
npm ci

echo "Running database migrations..."
npm run migrate

echo "Restarting application..."
systemctl restart myapp

echo "Deployment complete!"
```

If any of the critical commands fail (git, npm, systemctl), the script stops immediately. The `mkdir -p` command is allowed to fail because the directory might already exist, and that's fine.

## Should You Always Use set -e?

Not necessarily. While `set -e` is great for automation scripts where you want fast failure, it's not always appropriate:

- In interactive scripts where you want to handle errors yourself, explicit error checking with `if` statements gives you more control
- In complex scripts with many conditional operations, `set -e` can be confusing because of its exceptions
- In scripts where you need custom error messages or recovery logic, manual error handling is clearer

A common pattern is to check exit codes explicitly when you need fine-grained control:

```bash
#!/bin/bash

if ! git pull origin main; then
    echo "Error: Failed to pull latest changes"
    echo "Please check your network connection and try again"
    exit 1
fi
```

This approach is more verbose but gives you full control over what happens when commands fail.

## Debugging Scripts with set -e

When debugging, you might want to see exactly what's happening before each command runs. Combine `set -e` with `set -x` to print each command before execution:

```bash
#!/bin/bash
set -ex

# Now you'll see each command printed with a + prefix before it runs
mkdir /tmp/test
cd /tmp/test
touch file.txt
```

This helps you identify exactly which command caused the script to exit.

The `set -e` option gives you a safety net for shell scripts, making them fail fast when something goes wrong. It's not perfect - you need to understand its limitations, especially around pipelines and conditionals - but for most automation scripts, starting with `set -euo pipefail` is a solid foundation for error handling.
