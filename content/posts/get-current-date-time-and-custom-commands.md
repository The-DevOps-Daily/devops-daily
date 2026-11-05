---
title: 'How to Get Current Date and Time in Linux Terminal and Create Custom Commands'
excerpt: "Learn how to display the current date and time in various formats using the date command, and create custom shell aliases for quick access to your preferred formats."
category:
  name: 'Linux'
  slug: 'linux'
date: '2025-03-28'
publishedAt: '2025-03-28T09:00:00Z'
updatedAt: '2026-11-05T09:00:00Z'
readingTime: '9 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Linux
  - Bash
  - Date
  - Command Line
  - Shell Aliases
---

You need to check the current date and time, or maybe include a timestamp in a log file or backup name. What's the command, and how can you format it the way you want?

## TL;DR

Use `date` to display the current date and time. Format it with `date +"%Y-%m-%d %H:%M:%S"` for custom output. Create a custom command by adding an alias to your `~/.bashrc` file, like `alias now='date +"%Y-%m-%d %H:%M:%S"'`, then run `source ~/.bashrc` to activate it. After that, typing `now` will show the formatted date and time.

The `date` command is your go-to tool for displaying and formatting date/time information in Linux.

The simplest usage shows the current date and time:

```bash
date
```

Output:
```
Thu Mar 28 14:23:45 UTC 2025
```

This default format includes the day of the week, month, day, time, timezone, and year.

## Formatting the Date Output

Use the `+` flag followed by format specifiers to customize the output:

```bash
# Year-Month-Day format
date +"%Y-%m-%d"
# Output: 2025-03-28

# With time included
date +"%Y-%m-%d %H:%M:%S"
# Output: 2025-03-28 14:23:45

# 12-hour format with AM/PM
date +"%Y-%m-%d %I:%M:%S %p"
# Output: 2025-03-28 02:23:45 PM
```

Common format specifiers:

```
Date components:
%Y - Year (2025)
%y - Year, 2 digits (25)
%m - Month (01-12)
%d - Day of month (01-31)
%B - Full month name (March)
%b - Abbreviated month name (Mar)
%A - Full weekday name (Thursday)
%a - Abbreviated weekday name (Thu)

Time components:
%H - Hour, 24-hour format (00-23)
%I - Hour, 12-hour format (01-12)
%M - Minute (00-59)
%S - Second (00-59)
%p - AM or PM
%Z - Timezone name (UTC, EST, etc.)
%z - Timezone offset (+0000)

Special:
%s - Seconds since epoch (1711634625)
```

## Practical Date Formats

For log files:

```bash
date +"%Y-%m-%d_%H-%M-%S"
# Output: 2025-03-28_14-23-45
```

For human-readable output:

```bash
date +"%B %d, %Y at %I:%M %p"
# Output: March 28, 2025 at 02:23 PM
```

For ISO 8601 format:

```bash
date +"%Y-%m-%dT%H:%M:%S%z"
# Output: 2025-03-28T14:23:45+0000
```

For backup file names (no colons or spaces):

```bash
date +"%Y%m%d_%H%M%S"
# Output: 20250328_142345
```

## Format the Date as YYYY-MM-DD in a Script

`date +%F` is short for `date +%Y-%m-%d`, and `date -I` prints the same. In Bash, the `printf` builtin formats the time without starting a `date` process, which adds up in a loop:

```terminal
{
  "title": "three ways to get YYYY-MM-DD",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "date +%F",
      "output": "2026-11-05"
    },
    {
      "cmd": "date -Iseconds",
      "output": "2026-11-05T16:25:52+00:00"
    },
    {
      "cmd": "printf -v today '%(%F)T' -1; echo \"$today\"",
      "output": "2026-11-05"
    },
    {
      "cmd": "sh -c 'printf \"%(%F)T\\n\" -1'",
      "output": "sh: 1: printf: %(: invalid directive"
    }
  ]
}
```

`-1` means "now". `%(...)T` needs Bash 4.2 or later, so it fails in `sh` (dash here). `date -I` and `date -d` are GNU options; on macOS, use `date +%F` and `date -v-1d +%F` for yesterday.

GNU `date -d` also does date arithmetic. Watch the month steps: "one month after 31 January" is 31 February, which `date` rolls over into March. For the last day of a month, start from the first:

```terminal
{
  "title": "relative dates with GNU date",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "date -d \"yesterday\" +%F",
      "output": "2026-11-04"
    },
    {
      "cmd": "date -d \"2026-11-05 -7 days\" +%F",
      "output": "2026-10-29"
    },
    {
      "cmd": "date -d \"2026-01-31 +1 month\" +%F",
      "output": "2026-03-03"
    },
    {
      "comment": "last day of this month",
      "cmd": "date -d \"$(date +%Y-%m-01) +1 month -1 day\" +%F",
      "output": "2026-11-30"
    },
    {
      "cmd": "date -d \"2026-13-01\" +%F",
      "output": "date: invalid date ‘2026-13-01’"
    }
  ]
}
```

The last command fails with exit code 1, so `date -d "$input" +%F >/dev/null` is a quick way to check that a string is a valid date.

## Creating a Custom Command with an Alias

Let's create a custom command called `now` that shows the date and time in your preferred format.

Open your shell configuration file:

```bash
nano ~/.bashrc
```

Add an alias at the end:

```bash
# Custom date/time command
alias now='date +"%Y-%m-%d %H:%M:%S"'
```

Save the file and reload your configuration:

```bash
source ~/.bashrc
```

Now you can use your custom command:

```bash
now
```

Output:
```
2025-03-28 14:23:45
```

## Creating Multiple Date Aliases

You might want different formats for different purposes:

```bash
# Add these to ~/.bashrc

# Simple date
alias today='date +"%Y-%m-%d"'

# Date and time
alias now='date +"%Y-%m-%d %H:%M:%S"'

# Timestamp for filenames
alias timestamp='date +"%Y%m%d_%H%M%S"'

# Full readable format
alias fulldate='date +"%A, %B %d, %Y at %I:%M:%S %p %Z"'
```

After sourcing your `.bashrc`:

```bash
today
# Output: 2025-03-28

now
# Output: 2025-03-28 14:23:45

timestamp
# Output: 20250328_142345

fulldate
# Output: Thursday, March 28, 2025 at 02:23:45 PM UTC
```

## Using Date in File Names

When creating backups or logs, include timestamps in filenames:

```bash
# Create a backup with timestamp
cp important.txt "important_$(date +%Y%m%d_%H%M%S).txt"

# Create a log file with today's date
touch "log_$(date +%Y-%m-%d).log"

# Create a directory with month and year
mkdir "backup_$(date +%Y_%m)"
```

This prevents overwriting files and makes it easy to sort by date.

## Getting Time in Different Timezones

Display time in a specific timezone:

```bash
# UTC time
TZ=UTC date

# Eastern Time
TZ=America/New_York date

# Tokyo time
TZ=Asia/Tokyo date
```

Create aliases for frequently-used timezones:

```bash
# Add to ~/.bashrc
alias utcnow='TZ=UTC date +"%Y-%m-%d %H:%M:%S %Z"'
alias nynow='TZ=America/New_York date +"%Y-%m-%d %H:%M:%S %Z"'
```

## Getting Unix Timestamp (Seconds Since Epoch)

For programming or logging:

```bash
date +%s
# Output: 1711634625
```

Create an alias for it:

```bash
# Add to ~/.bashrc
alias epoch='date +%s'
```

Then use:

```bash
epoch
# Output: 1711634625
```

## Creating a Function for More Complex Commands

For more complex date formatting that needs parameters, use a function instead of an alias:

```bash
# Add to ~/.bashrc

# Function to show time in any timezone
timein() {
    if [ -z "$1" ]; then
        echo "Usage: timein <timezone>"
        echo "Example: timein America/New_York"
        return 1
    fi
    TZ="$1" date +"%Y-%m-%d %H:%M:%S %Z"
}

# Function to create dated backup of a file
backup() {
    if [ -z "$1" ]; then
        echo "Usage: backup <filename>"
        return 1
    fi
    cp "$1" "${1}.$(date +%Y%m%d_%H%M%S).bak"
    echo "Backup created: ${1}.$(date +%Y%m%d_%H%M%S).bak"
}
```

After sourcing your `.bashrc`:

```bash
timein America/Los_Angeles
# Output: 2025-03-28 07:23:45 PDT

backup important.conf
# Creates: important.conf.20250328_142345.bak
```

## Displaying a Calendar

The `cal` command shows a calendar:

```bash
# Current month
cal

# Specific month and year
cal 12 2025

# Entire year
cal 2025
```

Create an alias for the current month with highlighted today:

```bash
# Add to ~/.bashrc
alias calendar='cal'
```

## Practical Example: Log Entry Script

Here's a script that adds timestamped log entries:

```bash
#!/bin/bash

LOG_FILE="$HOME/activity.log"

# Function to log with timestamp
log() {
    echo "[$(date +"%Y-%m-%d %H:%M:%S")] $*" >> "$LOG_FILE"
}

# Usage
log "Started application"
log "User logged in"
log "Processing complete"

# View the log
cat "$LOG_FILE"
```

Output in `activity.log`:
```
[2025-03-28 14:23:45] Started application
[2025-03-28 14:23:47] User logged in
[2025-03-28 14:23:52] Processing complete
```

## Practical Example: Automated Backup Script

A script that creates daily backups with timestamps:

```bash
#!/bin/bash

SOURCE_DIR="/var/www/app"
BACKUP_DIR="/backup"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/app_backup_$DATE.tar.gz"

# Create backup
tar -czf "$BACKUP_FILE" -C "$(dirname "$SOURCE_DIR")" "$(basename "$SOURCE_DIR")"

echo "Backup created: $BACKUP_FILE"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "app_backup_*.tar.gz" -mtime +7 -delete
```

## Making Aliases Available System-Wide

If you want your aliases available for all users:

```bash
# Create system-wide alias file
sudo nano /etc/profile.d/custom-aliases.sh
```

Add your aliases:

```bash
# System-wide date/time aliases
alias now='date +"%Y-%m-%d %H:%M:%S"'
alias today='date +"%Y-%m-%d"'
```

Make it executable:

```bash
sudo chmod +x /etc/profile.d/custom-aliases.sh
```

These aliases will be available to all users after they log in.

## Checking if Your Alias Works

After adding an alias, verify it's loaded:

```bash
# List all aliases
alias

# Check specific alias
alias now

# Test it
now
```

If it's not working, make sure you sourced your `.bashrc`:

```bash
source ~/.bashrc
```

Or open a new terminal window.

## Removing or Changing Aliases

To temporarily remove an alias in the current session:

```bash
unalias now
```

To permanently remove it, delete or comment out the line in `~/.bashrc`:

```bash
# Open bashrc
nano ~/.bashrc

# Comment out or delete the alias line
# alias now='date +"%Y-%m-%d %H:%M:%S"'
```

Then source the file:

```bash
source ~/.bashrc
```

The `date` command is flexible enough for any date/time formatting you need, and creating custom aliases or functions makes your common formats just a short command away. Whether you're creating timestamped backups, logging events, or just checking the time in different formats, these techniques speed up your workflow.
