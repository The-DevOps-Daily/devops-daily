---
title: 'How to Redirect Output to Both a File and stdout in Bash'
excerpt: 'Discover how to use the tee command and other techniques to send command output to both a file and the terminal simultaneously, useful for logging while monitoring script execution.'
category:
  name: 'Bash'
  slug: 'bash'
date: '2024-10-17'
publishedAt: '2024-10-17T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Bash
  - Shell Scripting
  - Linux
  - Command Line
  - DevOps
---

## TLDR

Use the `tee` command to send output to both a file and stdout simultaneously. The syntax is `command | tee output.txt`, which displays output on screen while saving it to a file. Add the `-a` flag to append instead of overwriting: `command | tee -a output.txt`.

## Using the tee Command

The `tee` command reads from standard input and writes to both standard output and one or more files:

```bash
echo "Testing output" | tee test.txt
```

This displays "Testing output" in your terminal and also saves it to `test.txt`. The name "tee" comes from the T-shaped pipe fitting used in plumbing, which splits flow in two directions.

Here's a practical example with a script that processes data:

```bash
#!/bin/bash

./process-large-dataset.sh | tee processing.log
```

You can watch the progress in real-time while the script runs, and review the complete output later from `processing.log`.

## Appending vs Overwriting

By default, `tee` overwrites the output file. Use `-a` to append instead:

```bash
# Overwrites logfile.txt each time
echo "New log entry" | tee logfile.txt

# Appends to logfile.txt
echo "Another entry" | tee -a logfile.txt
```

This is useful for building logs over time:

```bash
#!/bin/bash

for i in {1..5}; do
    echo "Processing batch $i at $(date)" | tee -a batch.log
    ./process-batch.sh "$i"
done
```

Each iteration adds to the log without losing previous entries.

## Writing to Multiple Files

The `tee` command can write to several files simultaneously:

```bash
echo "Important data" | tee file1.txt file2.txt file3.txt
```

All three files receive the same content, and the output still appears on screen. This is useful for maintaining redundant copies:

```bash
#!/bin/bash

# Save build output to multiple locations
make build | tee build.log /mnt/backup/build.log ~/builds/latest.log
```

## Combining with Other Commands

Since `tee` works in pipelines, you can chain commands before and after it:

```bash
# Filter logs, display matches, and save to file
grep "ERROR" application.log | tee errors.txt | wc -l
```

This shows the error lines on screen, saves them to `errors.txt`, and counts them with `wc -l`. The flow is:

```
grep output
    |
    v
tee (splits stream)
    |
    +---> stdout (terminal)
    |
    +---> errors.txt
    |
    v
wc -l (counts lines)
```

## Capturing stderr with tee

By default, `tee` only captures stdout. To capture stderr as well, redirect it first:

```bash
# Capture both stdout and stderr
./script.sh 2>&1 | tee output.log

# Or using Bash 4+ shorthand
./script.sh |& tee output.log
```

The `2>&1` redirects stderr (file descriptor 2) to stdout (file descriptor 1), so both streams flow through `tee`.

Here's a practical deployment script example:

```bash
#!/bin/bash

# Log everything (stdout and stderr) from deployment
./deploy.sh 2>&1 | tee -a deployment-$(date +%Y%m%d).log
```

This captures all output and errors in a timestamped log file while showing progress in the terminal.

## Using tee with sudo

When writing to files in protected directories, you need elevated permissions:

```bash
# This doesn't work - tee runs without sudo
echo "new config" | tee /etc/app/config.txt

# This works - tee runs with sudo
echo "new config" | sudo tee /etc/app/config.txt
```

The pipe sends data to `tee`, which runs with sudo privileges and can write to protected files.

To suppress the output that `tee` sends to stdout (since you might not need to see it):

```bash
echo "new config" | sudo tee /etc/app/config.txt > /dev/null
```

This writes to the file but discards the terminal output.

## Practical Example: Build System

Here's a complete build script that logs output while showing progress:

```bash
#!/bin/bash

set -euo pipefail

PROJECT="my-application"
LOG_DIR="./build-logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$LOG_DIR/${PROJECT}_${TIMESTAMP}.log"

# Create log directory
mkdir -p "$LOG_DIR"

echo "Build started at $(date)" | tee "$LOG_FILE"
echo "===========================================" | tee -a "$LOG_FILE"

# Run build steps with logging
echo "Installing dependencies..." | tee -a "$LOG_FILE"
npm install 2>&1 | tee -a "$LOG_FILE"

echo "Running tests..." | tee -a "$LOG_FILE"
npm test 2>&1 | tee -a "$LOG_FILE"

echo "Building production bundle..." | tee -a "$LOG_FILE"
npm run build 2>&1 | tee -a "$LOG_FILE"

echo "===========================================" | tee -a "$LOG_FILE"
echo "Build completed at $(date)" | tee -a "$LOG_FILE"

echo "Log saved to: $LOG_FILE"
```

This script creates timestamped logs for each build while showing real-time progress. You can review logs later if something fails.

## Conditional Logging

Sometimes you only want to log when a command fails:

```bash
#!/bin/bash

if ! ./healthcheck.sh 2>&1 | tee healthcheck.log; then
    echo "Health check failed! Check healthcheck.log for details"
    exit 1
fi
```

The command runs, logs to a file, displays output, and the `if` statement checks the exit code to handle failures.

## Logging Only Specific Parts

You don't need to log everything. Combine direct redirection with selective `tee` usage:

```bash
#!/bin/bash

# Verbose initial output goes to log only
echo "Initializing..." > setup.log
./initialize.sh >> setup.log 2>&1

# Important processing step - show and log
echo "Processing data..." | tee -a setup.log
./process-data.sh 2>&1 | tee -a setup.log

# Final status - show only
echo "Complete"
```

This gives you control over what users see versus what gets logged.

## Timestamped Logging

Adding timestamps to log entries makes troubleshooting easier:

```bash
#!/bin/bash

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a application.log
}

log "Starting backup process"
./backup.sh
log "Backup complete"
```

Each log line gets a timestamp, both on screen and in the file.

## Rotating Logs with tee

For long-running processes, implement basic log rotation:

```bash
#!/bin/bash

LOG_FILE="application.log"
MAX_SIZE=10485760  # 10MB in bytes

log_with_rotation() {
    # Check if log file exceeds size limit
    if [ -f "$LOG_FILE" ] && [ $(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE" 2>/dev/null) -gt $MAX_SIZE ]; then
        mv "$LOG_FILE" "$LOG_FILE.$(date +%Y%m%d_%H%M%S)"
    fi

    tee -a "$LOG_FILE"
}

# Usage
echo "Processing batch 1" | log_with_rotation
./process.sh 2>&1 | log_with_rotation
```

This moves the log file when it grows too large, keeping storage under control.

## Monitoring with tee

You can combine `tee` with monitoring tools:

```bash
#!/bin/bash

# Save output and watch for errors
./application.sh 2>&1 | tee >(grep -i "error" > errors-only.txt) | less
```

The `>(...)` syntax creates a process substitution. This command:
1. Displays output in `less` for browsing
2. Saves all output to `errors-only.txt` via the grep filter
3. Shows everything in real-time

## Alternatives to tee

For simple cases where you just need the output in a file without seeing it on screen, use direct redirection:

```bash
# Redirect to file only (no terminal output)
./script.sh > output.txt

# Redirect both stdout and stderr to file
./script.sh > output.txt 2>&1
```

For seeing output in real-time from a file that's being written:

```bash
# Terminal 1 - run script
./long-process.sh > output.txt

# Terminal 2 - watch output
tail -f output.txt
```

But `tee` is more convenient when you want both in a single command.

## Performance Considerations

The `tee` command adds minimal overhead since it's optimized for stream copying. However, if you're processing massive amounts of data:

```bash
# Fast - direct write
large-data-generator | gzip > data.gz

# Slower - writing to file and terminal
large-data-generator | tee data.txt | gzip > data.gz
```

The terminal display can become a bottleneck with high-volume output. In that case, redirect to a file and use `tail -f` in another terminal.

For most real-world use cases involving human-readable logs and script output, `tee` provides the perfect balance of visibility and persistence. It's especially valuable in CI/CD pipelines, deployment scripts, and any automation where you want immediate feedback while maintaining a record for debugging or compliance.
