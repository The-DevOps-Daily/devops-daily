---
title: 'Redirecting Output to Both a File and stdout in Bash'
excerpt: 'Learn how to capture command output in a file while still seeing it live in your terminal'
category:
  name: 'Linux'
  slug: 'linux'
date: '2024-07-29'
publishedAt: '2024-07-29T12:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags: ['linux', 'bash', 'stdout']
---

When you're debugging a script, running a build, or logging output from a long-running process, it's often useful to both **see output live in the terminal** and **save it to a file** for later. Bash doesn't do this by default, but there are reliable ways to make it work.

Let's walk through some methods to redirect output to both a file and `stdout`, with examples you can drop into real workflows.

## Prerequisites

- Bash shell (`bash --version` ≥ 4.0)
- Basic understanding of standard streams (`stdout`, `stderr`)
- You're working on a Unix-like system (Linux, macOS, WSL)

---

## Using `tee` to Duplicate stdout to a File

The `tee` command reads from standard input and writes to both standard output and one or more files.

### Example: Save test results while still seeing them

```bash
pytest tests/ | tee test-results.log
```

This runs your test suite, prints all output to your terminal, and also writes it to `test-results.log`.

If the file already exists, `tee` will overwrite it by default. Use `-a` to append instead:

```bash
pytest tests/ | tee -a test-results.log
```

This is useful when you're collecting logs across multiple runs.

---

## Capturing stdout and stderr Together

By default, `tee` only captures `stdout`. If you also want `stderr` (useful for errors and warnings), you need to redirect it manually.

### Example: Build logs with error output included

```bash
make 2>&1 | tee build.log
```

Explanation:

- `2>&1` redirects `stderr` (file descriptor 2) to `stdout` (1)
- The combined output is piped to `tee`, which logs and displays it

This helps when you're compiling software or running CI jobs and want a full picture of what happened.

---

## Redirecting Output from Within a Script

Let's say you have a script that produces both standard output and error messages. You can use a function to handle logging consistently.

### Example: Bash script with logged output

```bash
#!/bin/bash

logfile="deploy.log"

# Redirect all output from this block
{
  echo "Starting deployment at $(date)"
  ./build.sh
  ./deploy.sh staging
  echo "Deployment finished at $(date)"
} 2>&1 | tee -a "$logfile"
```

This setup:

- Logs everything (including errors)
- Appends to `deploy.log`
- Still prints to the console for visibility

If you wrap your operations in a logging block like this, you don't have to repeat redirections for each command.

---

## Advanced: Redirect Output from Inside Functions

Sometimes you want specific functions or blocks to log independently. You can wrap the same pattern locally.

### Example: Function-specific logging

```bash
log_build() {
  {
    echo "=== Build Start: $(date) ==="
    make all
    echo "=== Build End: $(date) ==="
  } 2>&1 | tee -a build.log
}
```

This keeps log files clean and contextual, especially handy in CI/CD scripts.

---

## What About `script`?

If you're logging an entire terminal session (not just a single command), check out the `script` command:

```bash
script -q -c "./run-heavy-task.sh" session.log
```

This records everything from the shell session into `session.log`, including prompts and interactive input.

---

## A Note on Exit Codes

When piping into `tee`, you only get the exit status of the last command in the pipeline (`tee`). If you care about the actual command's exit code, capture it with this pattern:

```bash
my_command 2>&1 | tee output.log
exit_code=${PIPESTATUS[0]}
```

This ensures your script behaves correctly if something fails upstream.

---

## Try This Next

- Integrate these patterns into your shell scripts
- Log deployment, build, or test outputs in real-time
- Use timestamps in filenames to archive runs (e.g. `log_$(date +%F_%T).log`)
