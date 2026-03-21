---
title: 'How to Kill All Processes with a Given Partial Name in Linux'
excerpt: "Learn how to terminate multiple processes by matching partial names using pkill, killall, and other methods. Understand the risks and safe practices for bulk process termination."
category:
  name: 'Linux'
  slug: 'linux'
date: '2025-04-12'
publishedAt: '2025-04-12T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Linux
  - Process Management
  - Command Line
  - kill
  - pkill
---

You have multiple processes with similar names (like `python worker-1.py`, `python worker-2.py`, etc.) and you want to kill them all at once. How do you kill processes by matching part of their name?

## TL;DR

Use `pkill pattern` to kill all processes matching the pattern: `pkill worker` kills all processes with "worker" in their name. For more control, use `pkill -f pattern` to match against the full command line including arguments. To see what would be killed before doing it, use `pgrep -a pattern`. For exact name matches, use `killall exact_name`. Always test with `pgrep` first to avoid accidentally killing unrelated processes.

Bulk process termination is useful but dangerous if done carelessly. Let's explore safe methods.

The simplest approach is `pkill`:

```bash
# Kill all processes with "worker" in the name
pkill worker
```

This matches process names (the command name, typically limited to 15 characters).

## Using pkill with Full Command Line Matching

To match against the full command line (including arguments):

```bash
# Match full command line
pkill -f "python worker"

# This kills:
# python worker-1.py
# python worker-2.py
# python worker-queue.py
```

The `-f` flag tells `pkill` to search the entire command line, not just the process name.

## Previewing What Will Be Killed

Always check what you're about to kill using `pgrep`:

```bash
# See matching process names
pgrep worker

# See matching processes with full command
pgrep -a worker

# See with full command line matching
pgrep -af "python worker"
```

The `-a` flag shows the full command line, helping you verify you're targeting the right processes.

## Using killall for Exact Matches

`killall` kills processes by exact name:

```bash
# Kill all processes named exactly "worker"
killall worker

# Case-insensitive match
killall -i Worker
```

Unlike `pkill`, `killall` requires an exact match of the process name.

## Sending Different Signals

By default, these commands send SIGTERM (signal 15). For different signals:

```bash
# Send SIGKILL (force kill, signal 9)
pkill -9 worker

# Send SIGHUP (hangup, signal 1)
pkill -HUP worker

# Send SIGUSR1 (user-defined signal 1)
pkill -USR1 worker
```

Signal 9 (SIGKILL) forcefully terminates processes without cleanup. Use SIGTERM (the default) first to allow graceful shutdown.

## Practical Example: Killing Multiple Worker Processes

You have worker processes that need to be stopped:

```bash
# First, see what's running
pgrep -af worker

# Output:
# 1234 python worker-1.py
# 1235 python worker-2.py
# 1236 python worker-3.py

# Kill them all
pkill -f "python worker"

# Verify they're gone
pgrep -af worker
# (no output means they're all stopped)
```

## Killing by User

Kill all processes owned by a specific user:

```bash
# Kill all processes owned by user 'webapp'
pkill -u webapp

# Kill specific process pattern for a user
pkill -u webapp -f "node server"
```

This is useful when cleaning up after a service account.

## Killing by Parent Process ID

Kill all child processes of a specific parent:

```bash
# Kill all children of PID 1234
pkill -P 1234

# Kill all descendants (children, grandchildren, etc.)
pkill -s 1234
```

## Using ps and xargs

For more complex filtering, combine `ps` with `xargs`:

```bash
# Kill all python processes containing "worker"
ps aux | grep "python.*worker" | grep -v grep | awk '{print $2}' | xargs kill

# Same but with more readable formatting
ps aux | \
  grep "[p]ython.*worker" | \
  awk '{print $2}' | \
  xargs kill
```

The `[p]` trick in grep prevents grep from matching itself.

## Using pgrep with xargs

A cleaner approach using pgrep:

```bash
# Kill all matching processes
pgrep -f "worker" | xargs kill

# With confirmation
pgrep -f "worker" | xargs -p kill

# Force kill
pgrep -f "worker" | xargs kill -9
```

The `-p` flag with xargs prompts for confirmation before killing each process.

## Practical Example: Restart All Workers

Script to gracefully restart worker processes:

```bash
#!/bin/bash

WORKER_PATTERN="python worker"
RESTART_DELAY=5

echo "Stopping workers..."
pkill -f "$WORKER_PATTERN"

echo "Waiting ${RESTART_DELAY}s for graceful shutdown..."
sleep $RESTART_DELAY

# Check if any are still running
REMAINING=$(pgrep -f "$WORKER_PATTERN" | wc -l)
if [ $REMAINING -gt 0 ]; then
    echo "Force killing $REMAINING remaining processes..."
    pkill -9 -f "$WORKER_PATTERN"
fi

echo "Starting new workers..."
for i in {1..4}; do
    python worker-$i.py &
done

echo "Workers restarted"
```

## Excluding Processes from Kill

Kill matching processes except specific ones:

```bash
# Kill all workers except worker-1
pgrep -f "python worker" | grep -v "$(pgrep -f 'worker-1')" | xargs kill
```

Or more robustly:

```bash
# Save PIDs to exclude
EXCLUDE_PID=$(pgrep -f "worker-1.py")

# Kill all workers except that PID
pgrep -f "python worker" | grep -v "^${EXCLUDE_PID}$" | xargs kill
```

## Killing Zombie Processes

Zombie processes can't be killed directly (they're already dead). Kill their parent instead:

```bash
# Find zombie processes
ps aux | awk '$8 == "Z" {print $2}'

# Find parent of zombie
ps -o ppid= -p <zombie_pid>

# Kill the parent
kill <parent_pid>
```

## Safety Checks Before Killing

Create a safe kill script with checks:

```bash
#!/bin/bash

PATTERN="$1"

if [ -z "$PATTERN" ]; then
    echo "Usage: $0 <pattern>"
    exit 1
fi

# Show what would be killed
echo "Processes matching '$PATTERN':"
pgrep -af "$PATTERN"

# Count matches
COUNT=$(pgrep -f "$PATTERN" | wc -l)
echo "Total: $COUNT processes"

# Confirm
read -p "Kill these $COUNT processes? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Cancelled"
    exit 0
fi

# Kill
pkill -f "$PATTERN"

echo "Processes killed"
```

Usage:

```bash
chmod +x safe-kill.sh
./safe-kill.sh "python worker"
```

## Monitoring Process Termination

Wait for processes to terminate:

```bash
#!/bin/bash

PATTERN="worker"

echo "Sending TERM signal..."
pkill "$PATTERN"

# Wait up to 30 seconds for graceful shutdown
TIMEOUT=30
WAITED=0

while [ $WAITED -lt $TIMEOUT ]; do
    if ! pgrep "$PATTERN" > /dev/null; then
        echo "All processes terminated gracefully"
        exit 0
    fi
    sleep 1
    WAITED=$((WAITED + 1))
done

echo "Timeout reached, force killing remaining processes"
pkill -9 "$PATTERN"
```

## Killing Processes from a Specific Directory

Kill processes whose binary is in a specific directory:

```bash
# Kill all processes running from /opt/myapp/
pgrep -f "^/opt/myapp/" | xargs kill
```

## Using systemctl for Service Processes

For processes managed by systemd, use systemctl:

```bash
# Stop all matching services
systemctl list-units --type=service | grep worker | awk '{print $1}' | xargs systemctl stop

# Or if services follow a pattern
systemctl stop "worker@*.service"
```

This is safer than killing directly because it uses the proper shutdown procedure.

## Logging Process Kills

Log what you kill for auditing:

```bash
#!/bin/bash

PATTERN="$1"
LOGFILE="/var/log/process-kills.log"

# Log what's being killed
pgrep -af "$PATTERN" | while read line; do
    echo "$(date): Killing: $line" | sudo tee -a "$LOGFILE"
done

# Kill processes
pkill -f "$PATTERN"

echo "$(date): Killed all processes matching '$PATTERN'" | sudo tee -a "$LOGFILE"
```

## Common Pitfalls

**Pitfall 1: Accidentally killing too much**

```bash
# This might kill more than you expect!
pkill node

# Better: Be specific
pkill -f "node worker.js"
```

**Pitfall 2: Not checking first**

Always use `pgrep` to preview:

```bash
# Wrong: Kill without checking
pkill worker

# Right: Check first
pgrep -a worker
pkill worker
```

**Pitfall 3: Using kill -9 first**

Try graceful termination first:

```bash
# Wrong: Force kill immediately
pkill -9 worker

# Right: Try graceful shutdown first
pkill worker
sleep 5
pkill -9 worker  # Only if still running
```

## Alternatives for Specific Use Cases

**For Docker containers:**
```bash
docker ps | grep worker | awk '{print $1}' | xargs docker stop
```

**For Kubernetes pods:**
```bash
kubectl delete pods -l app=worker
```

**For screen sessions:**
```bash
screen -ls | grep worker | cut -d. -f1 | xargs -I{} screen -X -S {} quit
```

Killing processes by name pattern is convenient with `pkill` and `killall`, but always verify what you're targeting with `pgrep` first. Use graceful signals (SIGTERM) before resorting to force kills (SIGKILL), and consider using service managers like systemd when available for safer process management.
