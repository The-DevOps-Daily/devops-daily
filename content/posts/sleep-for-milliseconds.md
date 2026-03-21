---
title: 'How to Sleep for Milliseconds in Bash and Linux'
excerpt: "Learn how to pause script execution for fractions of a second using sleep, usleep, and other methods for precise timing in Bash scripts and command-line operations."
category:
  name: 'Bash'
  slug: 'bash'
date: '2025-01-30'
publishedAt: '2025-01-30T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Bash
  - Shell Scripting
  - Timing
  - Linux
  - Programming
---

You need to add a short delay in your script - not a full second, just a fraction of one. How do you sleep for milliseconds in Bash?

## TL;DR

Modern versions of `sleep` (GNU coreutils) support fractional seconds: `sleep 0.5` for half a second, `sleep 0.001` for 1 millisecond. For older systems, use `usleep 1000` for 1 millisecond (1000 microseconds) or `sleep 0.001` if available. In scripts, `sleep` with decimal values works on most Linux distributions. For sub-millisecond precision, use programming languages like Python or C instead of shell scripts.

Adding precise delays is useful for rate limiting, polling, animations, or avoiding race conditions in scripts.

The standard `sleep` command on modern Linux accepts fractional seconds:

```bash
# Sleep for half a second (500ms)
sleep 0.5

# Sleep for 100 milliseconds
sleep 0.1

# Sleep for 1 millisecond
sleep 0.001
```

This works with GNU sleep (default on most Linux distributions).

## Checking if Your Sleep Supports Decimals

Test if your sleep command supports fractional seconds:

```bash
sleep 0.1 && echo "Fractional sleep works" || echo "Fractional sleep not supported"
```

Check the version:

```bash
sleep --version
```

If you see "GNU coreutils", fractional seconds are supported.

## Using usleep for Microseconds

The `usleep` command (if available) takes microseconds as an argument:

```bash
# Sleep for 1000 microseconds (1 millisecond)
usleep 1000

# Sleep for 500 milliseconds
usleep 500000

# Sleep for 100 milliseconds
usleep 100000
```

1 millisecond = 1000 microseconds, so multiply your milliseconds by 1000.

Not all systems have `usleep` installed by default. On some systems, it's deprecated in favor of `sleep` with decimal values.

## Converting Between Units

Quick reference for time conversions:

```bash
# 1 second = 1000 milliseconds = 1000000 microseconds

# 100 milliseconds
sleep 0.1          # or usleep 100000

# 50 milliseconds
sleep 0.05         # or usleep 50000

# 10 milliseconds
sleep 0.01         # or usleep 10000

# 1 millisecond
sleep 0.001        # or usleep 1000
```

## Practical Example: Rate Limiting

Make 10 API requests with 200ms between each:

```bash
#!/bin/bash

for i in {1..10}; do
    curl -s https://api.example.com/data?page=$i
    echo "Request $i complete"
    sleep 0.2  # 200ms delay
done
```

This prevents overwhelming the API with rapid requests.

## Practical Example: Progress Animation

Create a simple loading animation:

```bash
#!/bin/bash

echo -n "Loading"
for i in {1..20}; do
    echo -n "."
    sleep 0.1  # 100ms between dots
done
echo " Done!"
```

Output:
```
Loading.................... Done!
```

## Practical Example: Retry Logic with Backoff

Retry a command with exponential backoff:

```bash
#!/bin/bash

MAX_RETRIES=5
DELAY=0.1  # Start with 100ms

for attempt in $(seq 1 $MAX_RETRIES); do
    if curl -sf https://api.example.com/health > /dev/null; then
        echo "Service is up!"
        exit 0
    fi

    echo "Attempt $attempt failed. Retrying in ${DELAY}s..."
    sleep $DELAY

    # Double the delay for next attempt
    DELAY=$(echo "$DELAY * 2" | bc)
done

echo "Service did not respond after $MAX_RETRIES attempts"
exit 1
```

## Using Perl for Precise Delays

If `sleep` doesn't support decimals and `usleep` isn't available, use Perl:

```bash
# Sleep for 150 milliseconds
perl -e 'select(undef, undef, undef, 0.15)'

# Sleep for 1 millisecond
perl -e 'select(undef, undef, undef, 0.001)'
```

The `select` function with null file descriptors acts as a precise sleep.

## Using Python for Delays

Python's time module provides reliable millisecond delays:

```bash
# Sleep for 250 milliseconds
python3 -c 'import time; time.sleep(0.25)'

# Sleep for 1 millisecond
python3 -c 'import time; time.sleep(0.001)'
```

This works consistently across platforms.

## Timing Precision Limitations

Shell sleep commands have limitations:

- Actual sleep time may be longer than requested due to scheduling
- Very short sleeps (<10ms) are less accurate
- System load affects precision
- For sub-millisecond precision, use compiled languages

Example showing timing variability:

```bash
#!/bin/bash

echo "Testing 10ms sleep accuracy:"
for i in {1..5}; do
    START=$(date +%s%N)
    sleep 0.01
    END=$(date +%s%N)
    ACTUAL=$(( (END - START) / 1000000 ))
    echo "Iteration $i: ${ACTUAL}ms"
done
```

Output might show:
```
Testing 10ms sleep accuracy:
Iteration 1: 12ms
Iteration 2: 11ms
Iteration 3: 10ms
Iteration 4: 13ms
Iteration 5: 11ms
```

The actual sleep time varies slightly.

## Creating a Millisecond Sleep Function

Create a helper function for cleaner scripts:

```bash
# Add to your script or ~/.bashrc

# Sleep for N milliseconds
msleep() {
    sleep $(echo "scale=3; $1/1000" | bc)
}

# Usage
msleep 250  # Sleep for 250ms
msleep 100  # Sleep for 100ms
```

Or without bc dependency:

```bash
msleep() {
    local ms=$1
    python3 -c "import time; time.sleep($ms/1000.0)"
}
```

## Polling with Short Intervals

Wait for a condition with short polling intervals:

```bash
#!/bin/bash

TIMEOUT=30  # seconds
INTERVAL=0.1  # 100ms polling interval
ELAPSED=0

while [ ! -f /tmp/ready.flag ]; do
    sleep $INTERVAL
    ELAPSED=$(echo "$ELAPSED + $INTERVAL" | bc)

    if (( $(echo "$ELAPSED >= $TIMEOUT" | bc -l) )); then
        echo "Timeout waiting for ready flag"
        exit 1
    fi
done

echo "Ready flag detected after ${ELAPSED}s"
```

## Debouncing with Delays

Debounce rapid events (useful with file watchers):

```bash
#!/bin/bash

DEBOUNCE_TIME=0.5  # 500ms
LAST_EVENT=0

handle_event() {
    local current=$(date +%s%N)
    local elapsed=$(echo "scale=3; ($current - $LAST_EVENT) / 1000000000" | bc)

    if (( $(echo "$elapsed < $DEBOUNCE_TIME" | bc -l) )); then
        echo "Debouncing event (too soon)"
        return
    fi

    echo "Processing event at $(date)"
    LAST_EVENT=$current
}

# Simulate events
for i in {1..5}; do
    handle_event
    sleep 0.2  # Events every 200ms
done
```

## Benchmarking with Millisecond Precision

Measure execution time in milliseconds:

```bash
#!/bin/bash

START=$(date +%s%N)

# Your command here
ls -R /usr > /dev/null

END=$(date +%s%N)
ELAPSED=$(( (END - START) / 1000000 ))

echo "Operation took ${ELAPSED}ms"
```

## Sleep in Loops

Add delays between loop iterations:

```bash
#!/bin/bash

# Process items with 500ms delay between each
for item in file1.txt file2.txt file3.txt; do
    echo "Processing $item..."
    process_file "$item"
    sleep 0.5
done
```

This prevents resource exhaustion and gives you time to observe progress.

## Interactive Delays

Add delays to make output more readable:

```bash
#!/bin/bash

echo "Starting deployment..."
sleep 0.5

echo "Pulling latest code..."
git pull
sleep 0.5

echo "Installing dependencies..."
npm install
sleep 0.5

echo "Building application..."
npm run build
sleep 0.5

echo "Deployment complete!"
```

The delays give users time to read each step.

## Alternative: Using read with Timeout

For interactive scripts, use `read` with timeout:

```bash
# Wait 0.5 seconds or until user presses Enter
read -t 0.5 -p "Press Enter to continue or wait 0.5s..."
```

This combines a delay with the option to skip it.

## When Not to Use Sleep

Avoid sleep for:

- Waiting for network operations (use timeouts in the command itself)
- Synchronizing concurrent processes (use locks or signals)
- High-precision timing (use a programming language)

Better alternatives:

```bash
# Instead of sleeping and hoping, use curl's timeout
curl --max-time 5 https://api.example.com

# Instead of sleeping between checks, use inotify for file changes
inotifywait -e create /tmp/

# Instead of sleeping in loops, use proper event handling
```

For millisecond delays in Bash, use `sleep 0.1` (100ms) or `sleep 0.001` (1ms) on systems with GNU sleep. For older systems, use `usleep` with microseconds, or fall back to Python/Perl for cross-platform compatibility. Remember that shell sleep is not highly precise for very short intervals.
