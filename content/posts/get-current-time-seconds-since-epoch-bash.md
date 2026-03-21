---
title: 'How to Get the Current Time in Seconds Since the Epoch in Bash on Linux'
excerpt: "Learn how to get Unix timestamps in Bash for logging, benchmarking, and time calculations. Includes examples of converting timestamps, measuring elapsed time, and practical use cases."
category:
  name: 'Bash'
  slug: 'bash'
date: '2024-10-12'
publishedAt: '2024-10-12T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Bash
  - Unix Timestamp
  - Time
  - Linux
  - Shell Scripting
---

You need a timestamp for logging, calculating time differences, or working with APIs that expect Unix time. How do you get the current time in seconds since the epoch in Bash?

## TL;DR

Use `date +%s` to get the current Unix timestamp (seconds since January 1, 1970 00:00:00 UTC). For milliseconds, use `date +%s%3N`. To convert a specific date to epoch seconds, use `date -d "2024-01-15" +%s`. To convert epoch seconds back to a human-readable date, use `date -d @1704067200`.

The Unix epoch is midnight UTC on January 1, 1970. The Unix timestamp counts seconds since that moment, making it useful for time calculations and comparisons.

Get the current timestamp:

```bash
date +%s
```

Output (current time):
```
1711892400
```

This number represents seconds elapsed since the epoch.

## Why Use Unix Timestamps?

Unix timestamps are useful because:
- They're timezone-independent (always UTC)
- Easy to compare and calculate differences
- Widely used in programming and APIs
- Compact representation of time
- No ambiguity about format

## Getting Milliseconds

Some applications need millisecond precision:

```bash
# Seconds with milliseconds (13 digits)
date +%s%3N
```

Output:
```
1711892400123
```

The `%3N` adds milliseconds (3 digits of nanoseconds).

For microseconds:

```bash
date +%s%6N
```

For nanoseconds:

```bash
date +%s%N
```

## Converting Specific Dates to Epoch

Convert a date string to Unix timestamp:

```bash
# Specific date
date -d "2024-01-15" +%s

# Date with time
date -d "2024-01-15 14:30:00" +%s

# Relative dates
date -d "yesterday" +%s
date -d "next week" +%s
date -d "3 days ago" +%s
```

The `-d` flag parses date strings in various formats.

## Converting Epoch Back to Human-Readable Date

Convert a Unix timestamp to readable format:

```bash
# Using @ prefix
date -d @1704067200

# With custom format
date -d @1704067200 +"%Y-%m-%d %H:%M:%S"
```

Output:
```
2024-01-01 00:00:00
```

## Calculating Time Differences

Measure how long something takes:

```bash
#!/bin/bash

# Record start time
START=$(date +%s)

# Do something that takes time
sleep 5
# Your actual work here

# Record end time
END=$(date +%s)

# Calculate difference
ELAPSED=$((END - START))

echo "Operation took $ELAPSED seconds"
```

Output:
```
Operation took 5 seconds
```

## Practical Example: Timestamped Logging

Add timestamps to log entries:

```bash
#!/bin/bash

LOG_FILE="app.log"

log() {
    TIMESTAMP=$(date +%s)
    DATETIME=$(date +"%Y-%m-%d %H:%M:%S")
    echo "[$TIMESTAMP] [$DATETIME] $*" >> "$LOG_FILE"
}

# Usage
log "Application started"
log "User logged in"
log "Processing complete"
```

Log file output:
```
[1711892400] [2024-03-31 15:00:00] Application started
[1711892405] [2024-03-31 15:00:05] User logged in
[1711892412] [2024-03-31 15:00:12] Processing complete
```

## Practical Example: Benchmarking

Compare performance of different approaches:

```bash
#!/bin/bash

benchmark() {
    local description="$1"
    local command="$2"

    local start=$(date +%s%3N)
    eval "$command"
    local end=$(date +%s%3N)

    local elapsed=$((end - start))
    echo "$description: ${elapsed}ms"
}

# Usage
benchmark "Method 1" "for i in {1..1000}; do echo $i > /dev/null; done"
benchmark "Method 2" "seq 1 1000 > /dev/null"
```

Output:
```
Method 1: 245ms
Method 2: 12ms
```

## Creating Unique Filenames with Timestamps

Use timestamps for unique file names:

```bash
# Backup with timestamp
TIMESTAMP=$(date +%s)
cp important.txt "important-$TIMESTAMP.txt.bak"

# Log file with timestamp
LOG_FILE="app-$TIMESTAMP.log"
touch "$LOG_FILE"

# More readable format
READABLE=$(date +"%Y%m%d-%H%M%S")
mkdir "backup-$READABLE"
```

## Checking File Age

Determine how old a file is:

```bash
#!/bin/bash

FILE="$1"

if [ ! -f "$FILE" ]; then
    echo "File not found"
    exit 1
fi

# Get file modification time in epoch seconds
FILE_TIME=$(stat -c %Y "$FILE")

# Get current time
CURRENT_TIME=$(date +%s)

# Calculate age in seconds
AGE=$((CURRENT_TIME - FILE_TIME))

# Convert to days
AGE_DAYS=$((AGE / 86400))

echo "File is $AGE seconds old ($AGE_DAYS days)"
```

## Setting Timeout Conditions

Implement timeouts in scripts:

```bash
#!/bin/bash

TIMEOUT=60  # seconds
START=$(date +%s)

while true; do
    # Your condition
    if some_check; then
        echo "Success!"
        break
    fi

    # Check timeout
    CURRENT=$(date +%s)
    ELAPSED=$((CURRENT - START))

    if [ $ELAPSED -gt $TIMEOUT ]; then
        echo "Timeout after $TIMEOUT seconds"
        exit 1
    fi

    sleep 1
done
```

## Comparing Timestamps

Check if one timestamp is older than another:

```bash
TIMESTAMP1=1704067200  # 2024-01-01
TIMESTAMP2=1711892400  # 2024-03-31

if [ $TIMESTAMP1 -lt $TIMESTAMP2 ]; then
    echo "Timestamp 1 is older"
else
    echo "Timestamp 2 is older"
fi

# Calculate difference
DIFF=$((TIMESTAMP2 - TIMESTAMP1))
DIFF_DAYS=$((DIFF / 86400))
echo "Difference: $DIFF_DAYS days"
```

## Time Zones and Epoch

Epoch time is always UTC. To get a timestamp for a specific timezone:

```bash
# Current time in New York
TZ="America/New_York" date +%s

# Current time in Tokyo
TZ="Asia/Tokyo" date +%s
```

But since epoch is UTC-based, these return the same value - the current UTC time. To get the timestamp for "midnight in New York":

```bash
TZ="America/New_York" date -d "today 00:00:00" +%s
```

## Practical Example: Session Timeout

Track user sessions with expiry:

```bash
#!/bin/bash

SESSION_FILE=".session"
TIMEOUT=3600  # 1 hour

start_session() {
    date +%s > "$SESSION_FILE"
    echo "Session started"
}

check_session() {
    if [ ! -f "$SESSION_FILE" ]; then
        echo "No active session"
        return 1
    fi

    SESSION_START=$(cat "$SESSION_FILE")
    CURRENT=$(date +%s)
    ELAPSED=$((CURRENT - SESSION_START))

    if [ $ELAPSED -gt $TIMEOUT ]; then
        echo "Session expired"
        rm "$SESSION_FILE"
        return 1
    fi

    REMAINING=$((TIMEOUT - ELAPSED))
    echo "Session active ($REMAINING seconds remaining)"
    return 0
}

# Usage
start_session
sleep 5
check_session
```

## Practical Example: Rate Limiting

Implement simple rate limiting:

```bash
#!/bin/bash

RATE_FILE=".last_run"
MIN_INTERVAL=300  # 5 minutes between runs

can_run() {
    if [ ! -f "$RATE_FILE" ]; then
        return 0  # No previous run, allowed
    fi

    LAST_RUN=$(cat "$RATE_FILE")
    CURRENT=$(date +%s)
    ELAPSED=$((CURRENT - LAST_RUN))

    if [ $ELAPSED -lt $MIN_INTERVAL ]; then
        WAIT=$((MIN_INTERVAL - ELAPSED))
        echo "Please wait $WAIT seconds before running again"
        return 1
    fi

    return 0
}

record_run() {
    date +%s > "$RATE_FILE"
}

# Usage
if can_run; then
    echo "Running task..."
    # Do your task
    record_run
fi
```

## Using bc for Precise Calculations

For more complex time calculations:

```bash
#!/bin/bash

START=$(date +%s)
sleep 2
END=$(date +%s)

# Calculate with decimals
ELAPSED=$(echo "$END - $START" | bc)
echo "Elapsed: ${ELAPSED}s"

# Convert seconds to hours
HOURS=$(echo "scale=2; $ELAPSED / 3600" | bc)
echo "That's $HOURS hours"
```

## Common Time Constants

Useful constants for time calculations:

```bash
# Time constants in seconds
SECOND=1
MINUTE=60
HOUR=3600
DAY=86400
WEEK=604800
MONTH=2592000  # 30 days
YEAR=31536000  # 365 days

# Calculate timestamps
ONE_HOUR_AGO=$(($(date +%s) - HOUR))
TOMORROW=$(($(date +%s) + DAY))
NEXT_WEEK=$(($(date +%s) + WEEK))
```

## Epoch Time Limitations

The Unix timestamp has limitations:

- 32-bit systems face the "Year 2038 problem" (max timestamp: 2147483647)
- 64-bit systems are fine until year 292 billion+
- Doesn't include leap seconds
- Always UTC, requires conversion for local time display

For Y2038-safe code on 32-bit systems, consider using 64-bit integers or alternative time representations.

## Converting Between Formats

Quick reference for conversions:

```bash
# Now to epoch
date +%s

# Epoch to human-readable
date -d @1711892400

# Specific date to epoch
date -d "2024-03-31 15:00:00" +%s

# With milliseconds
date +%s%3N

# File modification time to epoch
stat -c %Y filename
```

Getting the Unix timestamp in Bash is simple with `date +%s`. Whether you're logging events, measuring performance, implementing timeouts, or working with time-based logic, epoch seconds provide a reliable, timezone-independent way to work with time.
