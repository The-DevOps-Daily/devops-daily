---
title: 'How to Format Dates as YYYY-MM-DD in Shell Scripts'
excerpt: 'Learn how to format dates in shell scripts using the date command, including YYYY-MM-DD format and other common date patterns for logging, file naming, and timestamp generation.'
category:
  name: 'Bash'
  slug: 'bash'
date: '2024-07-12'
publishedAt: '2024-07-12T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Bash
  - Shell Scripting
  - Date
  - Linux
  - DevOps
---

## TLDR

Use `date +%Y-%m-%d` to get the current date in YYYY-MM-DD format (like 2024-07-12). The `date` command with format specifiers lets you create various date and time formats for log files, timestamps, and file naming in shell scripts.

## Basic YYYY-MM-DD Format

The `date` command with the `+` prefix lets you specify custom formats using percent-encoded directives:

```bash
date +%Y-%m-%d
```

Output:
```
2024-07-12
```

Breaking down the format specifiers:
- `%Y` - Four-digit year (2024)
- `%m` - Two-digit month (01-12)
- `%d` - Two-digit day (01-31)

You can save this to a variable for use in your scripts:

```bash
#!/bin/bash

today=$(date +%Y-%m-%d)
echo "Today is $today"
```

## Common Date Formats

Here are other useful date format patterns:

```bash
# ISO 8601 date (YYYY-MM-DD)
date +%Y-%m-%d
# Output: 2024-07-12

# Date and time (YYYY-MM-DD HH:MM:SS)
date +"%Y-%m-%d %H:%M:%S"
# Output: 2024-07-12 14:35:22

# Compact timestamp (YYYYMMDD_HHMMSS)
date +%Y%m%d_%H%M%S
# Output: 20240712_143522

# Month/Day/Year (US format)
date +%m/%d/%Y
# Output: 07/12/2024

# Day/Month/Year (European format)
date +%d/%m/%Y
# Output: 12/07/2024

# Full month name
date +"%B %d, %Y"
# Output: July 12, 2024

# Abbreviated month
date +"%b %d, %Y"
# Output: Jul 12, 2024

# Unix timestamp (seconds since epoch)
date +%s
# Output: 1720795522
```

## Using Date in File Names

A common use case is creating timestamped backup files:

```bash
#!/bin/bash

backup_date=$(date +%Y-%m-%d)
backup_file="database_backup_${backup_date}.sql"

pg_dump production_db > "$backup_file"
echo "Backup saved to $backup_file"
```

For files that might be created multiple times per day, include the time:

```bash
#!/bin/bash

timestamp=$(date +%Y%m%d_%H%M%S)
log_file="application_${timestamp}.log"

./application.sh > "$log_file" 2>&1
echo "Log saved to $log_file"
```

This creates files like `application_20240712_143522.log`, which sort chronologically and never collide.

## Date Arithmetic

You can calculate dates relative to today using the `-d` option (GNU date) or `-v` option (BSD date on macOS):

**Linux (GNU date):**

```bash
# Yesterday
date -d "yesterday" +%Y-%m-%d
# Output: 2024-07-11

# Tomorrow
date -d "tomorrow" +%Y-%m-%d
# Output: 2024-07-13

# 7 days ago
date -d "7 days ago" +%Y-%m-%d
# Output: 2024-07-05

# Next week
date -d "next week" +%Y-%m-%d
# Output: 2024-07-19

# Specific date offset
date -d "2024-01-01 +90 days" +%Y-%m-%d
# Output: 2024-03-31
```

**macOS (BSD date):**

```bash
# Yesterday
date -v-1d +%Y-%m-%d

# Tomorrow
date -v+1d +%Y-%m-%d

# 7 days ago
date -v-7d +%Y-%m-%d

# Next month
date -v+1m +%Y-%m-%d
```

## Practical Example: Log Rotation Script

Here's a script that uses dates to manage log files:

```bash
#!/bin/bash

set -euo pipefail

LOG_DIR="/var/log/myapp"
RETENTION_DAYS=30
today=$(date +%Y-%m-%d)

# Create today's log file
current_log="$LOG_DIR/app_${today}.log"
touch "$current_log"

# Find and delete old logs
cutoff_date=$(date -d "$RETENTION_DAYS days ago" +%Y-%m-%d)

echo "Removing logs older than $cutoff_date"

find "$LOG_DIR" -name "app_*.log" -type f | while read -r log_file; do
    # Extract date from filename (assumes app_YYYY-MM-DD.log format)
    file_date=$(basename "$log_file" | sed 's/app_\(.*\)\.log/\1/')

    if [[ "$file_date" < "$cutoff_date" ]]; then
        echo "Deleting old log: $log_file"
        rm "$log_file"
    fi
done

echo "Log rotation complete. Current log: $current_log"
```

This script creates date-stamped logs and removes ones older than 30 days.

## Working with Different Timezones

By default, `date` uses your system timezone. You can specify a different timezone using the `TZ` environment variable:

```bash
# Current timezone
date +"%Y-%m-%d %H:%M:%S %Z"
# Output: 2024-07-12 14:35:22 EDT

# UTC time
TZ=UTC date +"%Y-%m-%d %H:%M:%S %Z"
# Output: 2024-07-12 18:35:22 UTC

# Different timezone
TZ=America/Los_Angeles date +"%Y-%m-%d %H:%M:%S %Z"
# Output: 2024-07-12 11:35:22 PDT
```

For logging in distributed systems, UTC is often preferred to avoid timezone confusion:

```bash
#!/bin/bash

log_with_timestamp() {
    local timestamp=$(TZ=UTC date +"%Y-%m-%d %H:%M:%S UTC")
    echo "[$timestamp] $*" | tee -a application.log
}

log_with_timestamp "Application started"
log_with_timestamp "Processing request from user 123"
```

## Parsing and Converting Dates

You can convert date strings to different formats:

```bash
# Convert MM/DD/YYYY to YYYY-MM-DD
input_date="07/12/2024"
output_date=$(date -d "$input_date" +%Y-%m-%d)
echo "$output_date"
# Output: 2024-07-12

# Parse and reformat
date -d "July 12, 2024" +%Y-%m-%d
# Output: 2024-07-12

# ISO 8601 to Unix timestamp
date -d "2024-07-12T14:35:22" +%s
# Output: 1720795522

# Unix timestamp to readable date
date -d @1720795522 +"%Y-%m-%d %H:%M:%S"
# Output: 2024-07-12 14:35:22
```

## Comparing Dates

When you need to compare dates in scripts, using the YYYY-MM-DD format allows simple string comparison:

```bash
#!/bin/bash

expiry_date="2024-12-31"
today=$(date +%Y-%m-%d)

if [[ "$today" > "$expiry_date" ]]; then
    echo "License has expired"
    exit 1
else
    echo "License is valid until $expiry_date"
fi
```

String comparison works because YYYY-MM-DD sorts correctly alphabetically.

For more complex date arithmetic, convert to Unix timestamps:

```bash
#!/bin/bash

start_date="2024-01-01"
end_date="2024-12-31"

start_ts=$(date -d "$start_date" +%s)
end_ts=$(date -d "$end_date" +%s)

diff_seconds=$((end_ts - start_ts))
diff_days=$((diff_seconds / 86400))

echo "Days between dates: $diff_days"
# Output: Days between dates: 365
```

## Date Formatting Reference

Here's a quick reference for common format specifiers:

```bash
%Y  # Year (4 digits)          2024
%y  # Year (2 digits)          24
%m  # Month (01-12)            07
%B  # Full month name          July
%b  # Abbreviated month        Jul
%d  # Day of month (01-31)     12
%H  # Hour 24-hour (00-23)     14
%I  # Hour 12-hour (01-12)     02
%M  # Minute (00-59)           35
%S  # Second (00-59)           22
%p  # AM/PM                    PM
%Z  # Timezone                 EDT
%z  # Timezone offset          -0400
%s  # Unix timestamp           1720795522
%A  # Full weekday name        Friday
%a  # Abbreviated weekday      Fri
%u  # Day of week (1-7)        5
```

## Portable Date Scripts

GNU `date` (Linux) and BSD `date` (macOS) have different syntax for date arithmetic. For portable scripts:

```bash
#!/bin/bash

# Function that works on both Linux and macOS
get_yesterday() {
    if date -v-1d +%Y-%m-%d >/dev/null 2>&1; then
        # BSD date (macOS)
        date -v-1d +%Y-%m-%d
    else
        # GNU date (Linux)
        date -d "yesterday" +%Y-%m-%d
    fi
}

yesterday=$(get_yesterday)
echo "Yesterday was $yesterday"
```

This approach detects which version of `date` is available and uses the appropriate syntax.

## Practical Example: Backup Script with Date-Based Naming

Here's a complete backup script that uses date formatting:

```bash
#!/bin/bash

set -euo pipefail

BACKUP_SOURCE="/var/www/application"
BACKUP_DEST="/backups"
BACKUP_DATE=$(date +%Y-%m-%d)
BACKUP_TIME=$(date +%H%M%S)
BACKUP_NAME="app_backup_${BACKUP_DATE}_${BACKUP_TIME}.tar.gz"
BACKUP_PATH="$BACKUP_DEST/$BACKUP_NAME"

echo "Starting backup at $(date +"%Y-%m-%d %H:%M:%S")"

# Create backup
tar -czf "$BACKUP_PATH" -C "$(dirname "$BACKUP_SOURCE")" "$(basename "$BACKUP_SOURCE")"

# Verify backup was created
if [ -f "$BACKUP_PATH" ]; then
    size=$(du -h "$BACKUP_PATH" | cut -f1)
    echo "Backup completed: $BACKUP_PATH ($size)"
else
    echo "Error: Backup failed" >&2
    exit 1
fi

# Clean up backups older than 7 days
find "$BACKUP_DEST" -name "app_backup_*.tar.gz" -mtime +7 -delete

echo "Backup process finished at $(date +"%Y-%m-%d %H:%M:%S")"
```

This script creates timestamped backups and automatically cleans up old ones, demonstrating several date formatting techniques in a real-world scenario.

The YYYY-MM-DD format is particularly useful because it's ISO 8601 compliant, sorts correctly when used in filenames, and is unambiguous across different locales. Whether you're creating log files, naming backups, or adding timestamps to data, mastering the `date` command's format specifiers makes your shell scripts more organized and maintainable.
