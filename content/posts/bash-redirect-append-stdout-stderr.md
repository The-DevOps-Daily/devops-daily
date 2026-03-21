---
title: 'How to Redirect and Append Both stdout and stderr to a File in Bash'
excerpt: 'Learn different methods to capture both standard output and error streams in Bash, including appending to files and separating streams for better logging.'
category:
  name: 'Bash'
  slug: 'bash'
date: '2024-05-03'
publishedAt: '2024-05-03T13:15:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Bash
  - Redirection
  - Logging
  - Shell
  - Linux
---

Properly handling command output and errors is essential for effective shell scripting and system administration. Understanding how to redirect and append both standard output (stdout) and standard error (stderr) gives you control over where your program's output goes and helps create better logging systems.

## Understanding File Descriptors

Before diving into redirection techniques, it's important to understand the three standard file descriptors:

- `0` (stdin): Standard input
- `1` (stdout): Standard output
- `2` (stderr): Standard error

By default, both stdout and stderr display in your terminal. Redirection allows you to send these streams to files instead.

## Appending Both Streams to the Same File

The most common scenario is capturing all output from a command into a single log file. Here are several methods to achieve this:

### Method 1: Using &>>

The simplest approach uses the `&>>` operator to append both streams:

```bash
# Append both stdout and stderr to a log file
./my_script.sh &>> application.log
```

This operator is available in Bash 4.0 and later. It's equivalent to `>> file 2>&1` but more concise.

### Method 2: Traditional Redirection

For broader compatibility across different shells:

```bash
# Redirect stderr to stdout, then append both to file
./my_script.sh >> application.log 2>&1
```

The order matters here. First, stdout is redirected to append to the file, then stderr is redirected to wherever stdout is going.

### Method 3: Using exec for Script-Wide Redirection

When you want all output from an entire script to go to a file:

```bash
#!/bin/bash

# Redirect all output for the remainder of the script
exec >> script_output.log 2>&1

echo "This goes to the log file"
ls /nonexistent_directory  # Error also goes to log file
echo "Script continues..."
```

This approach is useful for logging everything a script does without modifying individual commands.

## Appending Streams to Separate Files

Sometimes you want to keep normal output and errors in different files:

```bash
# Append stdout to one file, stderr to another
./my_script.sh >> output.log 2>> errors.log
```

This separation makes it easier to review errors without filtering through normal output:

```bash
# Example with a command that produces both output and errors
find /home -name "*.log" >> found_files.log 2>> search_errors.log
```

## Real-World Logging Examples

Here's a practical example for a backup script:

```bash
#!/bin/bash

BACKUP_LOG="/var/log/backup.log"
BACKUP_ERROR_LOG="/var/log/backup_errors.log"

# Function to log with timestamp
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S'): $1"
}

# Redirect all output to appropriate log files
{
    log_message "Starting backup process"

    # Backup database (might produce errors)
    mysqldump -u backup_user -p"$DB_PASSWORD" myapp_db > /backup/db_backup.sql

    if [ $? -eq 0 ]; then
        log_message "Database backup completed successfully"
    else
        log_message "Database backup failed" >&2
    fi

    # Sync files (might have permission errors)
    rsync -av /home/user/documents/ /backup/documents/

    log_message "Backup process completed"

} >> "$BACKUP_LOG" 2>> "$BACKUP_ERROR_LOG"
```

## Using tee for Multiple Destinations

The `tee` command allows you to send output to both a file and the terminal simultaneously:

```bash
# Display output on screen AND append to file
./my_script.sh 2>&1 | tee -a combined_output.log
```

For separate handling of stdout and stderr with tee:

```bash
# More complex example using named pipes
mkfifo stdout_pipe stderr_pipe

# Start tee processes in background
tee -a output.log < stdout_pipe &
tee -a errors.log < stderr_pipe >&2 &

# Run command with redirection to named pipes
./my_script.sh > stdout_pipe 2> stderr_pipe

# Clean up
rm stdout_pipe stderr_pipe
```

## Conditional Logging Based on Success

You can implement smart logging that behaves differently based on command success:

```bash
#!/bin/bash

LOG_FILE="/var/log/app.log"
ERROR_FILE="/var/log/app_errors.log"

run_with_logging() {
    local command="$1"
    local description="$2"

    echo "$(date): Starting: $description" >> "$LOG_FILE"

    # Capture both output and exit code
    if output=$(eval "$command" 2>&1); then
        echo "$(date): Success: $description" >> "$LOG_FILE"
        echo "$output" >> "$LOG_FILE"
    else
        echo "$(date): Failed: $description" >> "$ERROR_FILE"
        echo "$output" >> "$ERROR_FILE"
        echo "$(date): Error logged for: $description" >> "$LOG_FILE"
    fi
}

# Usage examples
run_with_logging "ls /home/user" "Listing user directory"
run_with_logging "cp large_file.txt /backup/" "Copying backup file"
run_with_logging "service nginx restart" "Restarting nginx service"
```

## Handling Output in Loops

When processing multiple items, you might want to aggregate all output:

```bash
#!/bin/bash

PROCESS_LOG="/var/log/batch_process.log"

# Process multiple files
files=("/path/to/file1.txt" "/path/to/file2.txt" "/path/to/file3.txt")

{
    echo "$(date): Starting batch processing"

    for file in "${files[@]}"; do
        echo "Processing: $file"

        # Some processing command that might fail
        if process_file "$file"; then
            echo "Successfully processed: $file"
        else
            echo "Failed to process: $file" >&2
        fi
    done

    echo "$(date): Batch processing completed"

} >> "$PROCESS_LOG" 2>&1
```

## Advanced Redirection with Process Substitution

For complex logging scenarios, you can use process substitution:

```bash
#!/bin/bash

# Function to add timestamps to log lines
timestamp_log() {
    while IFS= read -r line; do
        echo "$(date '+%Y-%m-%d %H:%M:%S'): $line"
    done
}

# Redirect with timestamping
./my_script.sh > >(timestamp_log >> output.log) 2> >(timestamp_log >> errors.log)
```

This approach adds timestamps to each line and can handle stdout and stderr differently while maintaining real-time processing.

## Monitoring Log Files

After setting up logging, you can monitor the files in real-time:

```bash
# Watch both logs simultaneously
tail -f output.log errors.log

# Or in separate terminals
tail -f output.log    # Terminal 1
tail -f errors.log    # Terminal 2
```

These redirection techniques give you fine-grained control over how your scripts handle output and errors, making debugging easier and creating comprehensive audit trails for your automated processes.
