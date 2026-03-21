---
title: 'How to Redirect All Output to a File in Bash'
excerpt: "Learn how to redirect stdout and stderr to files in Bash, capture both standard output and errors together, and understand the different redirection operators."
category:
  name: 'Bash'
  slug: 'bash'
date: '2025-01-15'
publishedAt: '2025-01-15T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Bash
  - Shell Scripting
  - Redirection
  - Linux
  - Command Line
---

You run a command that produces output and errors, and you want to save everything to a file for later review. How do you capture both stdout and stderr in Bash?

## TL;DR

To redirect all output (both stdout and stderr) to a file, use `command &> file.txt` or `command > file.txt 2>&1`. The first syntax is simpler and works in Bash 4+. To append instead of overwrite, use `command &>> file.txt`. To send output to a file while still seeing it on screen, use `command 2>&1 | tee file.txt`.

Understanding Bash redirection helps you capture output, suppress errors, or split different output streams as needed.

Let's start with a simple command that produces both normal output and errors:

```bash
ls /home /fakedir
```

This outputs:
```
/home:
user1  user2

ls: cannot access '/fakedir': No such file or directory
```

The directory listing goes to stdout (file descriptor 1), and the error goes to stderr (file descriptor 2).

## Basic Output Redirection

Redirect standard output (stdout) only:

```bash
ls /home /fakedir > output.txt
```

This saves the directory listing to `output.txt`, but the error still shows on screen. The file contains:

```
/home:
user1  user2
```

And the error still appears in your terminal.

## Redirecting Stderr

Redirect only errors (stderr):

```bash
ls /home /fakedir 2> errors.txt
```

Now the directory listing shows on screen, but the error is saved to `errors.txt`.

## Redirecting Both Stdout and Stderr

To capture everything in one file, use one of these methods:

**Modern syntax (Bash 4+):**

```bash
ls /home /fakedir &> output.txt
```

The `&>` redirects both stdout and stderr to the same file.

**Traditional syntax (works everywhere):**

```bash
ls /home /fakedir > output.txt 2>&1
```

This redirects stdout to `output.txt`, then redirects stderr (`2`) to wherever stdout (`1`) is going (the file).

```
Command output flow:
stdout (1) ----> output.txt
stderr (2) ----> follows stdout ----> output.txt
```

The order matters - `2>&1` must come after `> output.txt`.

## Appending vs Overwriting

Use `>` to overwrite a file:

```bash
echo "first" > file.txt
echo "second" > file.txt
# file.txt now contains only "second"
```

Use `>>` to append:

```bash
echo "first" >> file.txt
echo "second" >> file.txt
# file.txt now contains "first" and "second"
```

For both stdout and stderr:

```bash
# Overwrite
command &> output.txt

# Append
command &>> output.txt
```

Or with traditional syntax:

```bash
# Append both
command >> output.txt 2>&1
```

## Discarding Output

Send output to `/dev/null` to discard it:

```bash
# Discard stdout only
command > /dev/null

# Discard stderr only
command 2> /dev/null

# Discard both
command &> /dev/null
```

This is useful when you don't care about the output:

```bash
# Run a command silently
wget http://example.com/file.zip &> /dev/null
```

## Separating Stdout and Stderr

To save stdout and stderr to different files:

```bash
command > output.txt 2> errors.txt
```

Now normal output goes to `output.txt` and errors go to `errors.txt`.

## Seeing Output and Saving It

Use `tee` to both display output and save it:

```bash
# Show on screen and save to file
command | tee output.txt
```

For both stdout and stderr:

```bash
command 2>&1 | tee output.txt
```

This redirects stderr to stdout, then pipes everything through `tee`, which writes to the file and displays on screen.

To append instead of overwrite:

```bash
command 2>&1 | tee -a output.txt
```

## Redirecting Output from Scripts

Inside a script, redirect all output:

```bash
#!/bin/bash

# Redirect everything this script outputs
exec &> /var/log/myscript.log

echo "This goes to the log file"
ls /fakedir  # Error also goes to log
```

The `exec` command redirects all subsequent output from the script.

To redirect only a section:

```bash
#!/bin/bash

echo "This shows on screen"

{
    echo "This goes to file"
    ls /fakedir
} &> section-output.txt

echo "This shows on screen again"
```

## Practical Example: Deployment Script

A deployment script that logs everything:

```bash
#!/bin/bash
set -e

LOG_FILE="/var/log/deploy-$(date +%Y%m%d-%H%M%S).log"

# Redirect all output to log file
exec &> "$LOG_FILE"

echo "=== Deployment started at $(date) ==="

echo "Pulling latest code..."
git pull origin main

echo "Installing dependencies..."
npm install

echo "Building application..."
npm run build

echo "Restarting service..."
sudo systemctl restart myapp

echo "=== Deployment completed at $(date) ==="

# Also display the log location on screen (goes to stderr of the exec)
echo "Deployment log saved to: $LOG_FILE" >&2
```

## Practical Example: Cron Job Logging

Cron jobs should redirect output to avoid email notifications:

```bash
# In crontab
0 2 * * * /home/user/backup.sh &>> /var/log/backup.log
```

This appends both stdout and stderr to the log file.

Or discard output completely:

```bash
0 2 * * * /home/user/cleanup.sh &> /dev/null
```

## Redirecting in Complex Commands

With pipes:

```bash
# Both stdout and stderr through the pipe
command 2>&1 | grep error

# Only stderr through the pipe (swap file descriptors)
command 3>&1 1>&2 2>&3 | grep error
```

With command substitution:

```bash
# Capture stdout in a variable, stderr goes to screen
OUTPUT=$(command)

# Capture both stdout and stderr in a variable
OUTPUT=$(command 2>&1)
```

## Understanding File Descriptors

Bash uses these file descriptors by default:

```
0 - stdin  (standard input)
1 - stdout (standard output)
2 - stderr (standard error output)
```

When you use redirection:

```bash
command 2>&1
```

This means "redirect file descriptor 2 (stderr) to file descriptor 1 (stdout)".

You can create custom file descriptors:

```bash
# Open file descriptor 3 for writing to a file
exec 3> custom.log

# Write to it
echo "Log entry" >&3

# Close it
exec 3>&-
```

## Common Patterns

**Run command silently:**

```bash
command &> /dev/null
```

**Save output, show errors:**

```bash
command > output.txt
```

**Save errors, show output:**

```bash
command 2> errors.txt
```

**Save both separately:**

```bash
command > output.txt 2> errors.txt
```

**Save both together:**

```bash
command &> combined.txt
```

**Append both:**

```bash
command &>> combined.txt
```

**Show and save:**

```bash
command 2>&1 | tee output.txt
```

## Debugging Redirection

To see what's being redirected, add `-x` to your script:

```bash
#!/bin/bash
set -x  # Enable debugging

ls /home /fakedir &> output.txt
```

This shows the actual command execution with redirection visible.

## Common Mistakes

Wrong order:

```bash
# Wrong - stderr goes to screen, not to file
command 2>&1 > output.txt

# Right - stderr follows stdout to file
command > output.txt 2>&1
```

The order matters because redirections are processed left to right.

Forgetting to quote filenames with spaces:

```bash
# Wrong
command > my output.txt  # Creates files "my" and "output.txt"

# Right
command > "my output.txt"
```

Using `>` when you meant `>>`:

```bash
# This overwrites the log every time!
echo "$(date) Error occurred" > app.log

# This appends, keeping history
echo "$(date) Error occurred" >> app.log
```

## Redirecting Within Subshells

Redirections in subshells don't affect the parent:

```bash
# This redirect only affects the subshell
(command &> output.txt)

# Parent shell's stdout is unchanged
echo "This still shows on screen"
```

## When to Use Each Method

Use `> file` when:
- You only need stdout
- Errors should show on screen

Use `2> file` when:
- You only want to capture errors
- Normal output should show on screen

Use `&> file` when:
- You want everything in one file
- You're reviewing logs later

Use `| tee file` when:
- You want to see output immediately
- You also want a copy in a file

Use `> /dev/null` when:
- You don't care about output
- You want commands to run silently

Mastering Bash redirection gives you precise control over where output goes. Whether you're logging scripts, debugging errors, or running cron jobs, understanding these patterns helps you capture exactly what you need.
