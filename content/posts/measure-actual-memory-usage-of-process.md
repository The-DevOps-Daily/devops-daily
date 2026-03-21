---
title: 'How to Measure the Actual Memory Usage of an Application or Process'
excerpt: "Learn how to accurately measure real memory usage of processes in Linux, understand the difference between virtual, resident, and shared memory, and use the right tools for memory analysis."
category:
  name: 'Linux'
  slug: 'linux'
date: '2025-04-05'
publishedAt: '2025-04-05T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Linux
  - Performance
  - Memory Management
  - Monitoring
  - Troubleshooting
---

You check a process's memory usage with `top` or `ps` and see huge numbers, but you're not sure what they mean or which one represents actual memory consumption. How do you measure real memory usage?

## TL;DR

For actual physical memory used by a process, check the RSS (Resident Set Size) value, which shows memory currently in RAM. Use `ps aux` and look at the RSS column, or use `/proc/[pid]/status` and check VmRSS. For a more accurate picture accounting for shared memory, use the PSS (Proportional Set Size) from `/proc/[pid]/smaps`. Virtual memory (VIRT/VSZ) is usually much larger and doesn't represent actual RAM usage.

Memory measurement in Linux is complex because processes share memory, map files, and use virtual memory. Understanding the different metrics helps you identify real memory issues.

Let's start by running a simple memory check:

```bash
ps aux | grep myapp
```

You'll see output like:

```
USER   PID %CPU %MEM    VSZ   RSS TTY   STAT START   TIME COMMAND
user   1234 2.5  5.2 890000 54000 ?     Ssl  10:23  0:15 myapp
```

The key columns are:
- `VSZ` - Virtual memory size (in KB)
- `RSS` - Resident set size (in KB)
- `%MEM` - Percentage of physical RAM

But what do these numbers really mean?

## Understanding Memory Metrics

Linux provides several memory measurements:

**VIRT/VSZ (Virtual Memory Size):**
- Total virtual memory allocated
- Includes memory not actually in RAM
- Includes shared libraries, mapped files
- Usually much larger than physical memory used

**RES/RSS (Resident Set Size):**
- Physical memory currently in RAM
- Includes shared libraries (counted for each process)
- Better indicator of actual memory usage
- But overstates shared memory usage

**SHR (Shared Memory):**
- Memory shared with other processes
- Libraries loaded by multiple processes
- Doesn't mean the process uses all of it

**PSS (Proportional Set Size):**
- Most accurate measure of real memory use
- Divides shared memory proportionally
- Not shown by top/ps by default

## Using ps to Check Memory

Get memory info for a specific process:

```bash
# By process name
ps aux | grep myapp

# By PID
ps aux | grep 1234

# Show RSS in human-readable format
ps aux --sort -rss | head -10
```

This shows the top 10 processes by RSS (resident memory).

For a cleaner output with specific columns:

```bash
ps -eo pid,comm,rss,vsz | grep myapp
```

Or in megabytes:

```bash
ps -eo pid,comm,rss | awk '{printf "%s %s %.2f MB\n", $1, $2, $3/1024}' | grep myapp
```

## Using top or htop

Real-time memory monitoring with `top`:

```bash
top
```

Press `M` to sort by memory usage. Look at the RES column for resident memory.

For better visualization, install and use `htop`:

```bash
sudo apt install htop  # Ubuntu/Debian
htop
```

Press `F6`, select `MEM%` to sort by memory percentage. The display is color-coded and easier to read than top.

## Checking /proc for Detailed Memory Info

The `/proc` filesystem provides detailed memory information:

```bash
# Replace [pid] with actual process ID
cat /proc/[pid]/status | grep -i mem
```

Output shows various memory metrics:

```
VmPeak:   945032 kB  # Peak virtual memory
VmSize:   890124 kB  # Current virtual memory
VmLck:         0 kB  # Locked memory
VmPin:         0 kB  # Pinned memory
VmHWM:     54320 kB  # Peak resident memory
VmRSS:     54000 kB  # Current resident memory
VmData:   123456 kB  # Data segment size
VmStk:       136 kB  # Stack size
VmExe:        16 kB  # Executable size
VmLib:     45000 kB  # Shared library memory
```

The most useful values:
- `VmRSS` - Memory currently in physical RAM
- `VmHWM` - Peak memory usage (high water mark)

## Getting Proportional Set Size (PSS)

PSS gives the most accurate picture by accounting for shared memory:

```bash
grep Pss /proc/[pid]/smaps | awk '{sum+=$2} END {print sum " KB"}'
```

This sums up the PSS values from all memory mappings. The result is typically lower than RSS because shared memory is divided among processes.

To see PSS for all processes:

```bash
# List all processes with their PSS
for pid in /proc/[0-9]*; do
    if [ -f "$pid/smaps" ]; then
        pss=$(grep Pss "$pid/smaps" 2>/dev/null | awk '{sum+=$2} END {print sum}')
        if [ ! -z "$pss" ] && [ "$pss" -gt 0 ]; then
            name=$(cat "$pid/comm" 2>/dev/null)
            printf "%-20s %10d KB\n" "$name" "$pss"
        fi
    fi
done | sort -k2 -rn | head -10
```

This shows the top 10 processes by actual memory usage (PSS).

## Using smem for Accurate Memory Reporting

The `smem` tool reports PSS and other accurate memory metrics:

```bash
# Install smem
sudo apt install smem  # Ubuntu/Debian

# Show memory usage by process
smem -r

# Show summary by user
smem -u

# Show specific columns
smem -c "pid name pss rss"
```

`smem` output columns:
- `PSS` - Proportional set size (most accurate)
- `RSS` - Resident set size
- `USS` - Unique set size (memory used only by this process)

## Memory Usage from Inside a Container

For Docker containers:

```bash
# Memory usage of a container
docker stats container_name --no-stream

# Detailed memory info
docker inspect container_name | grep -i memory
```

For a process inside a container:

```bash
# Enter the container
docker exec -it container_name sh

# Check memory inside
ps aux
cat /proc/[pid]/status | grep VmRSS
```

## Monitoring Memory Over Time

Create a script to log memory usage:

```bash
#!/bin/bash

PID=$1
LOG_FILE="memory-log-$PID.txt"

if [ -z "$PID" ]; then
    echo "Usage: $0 <pid>"
    exit 1
fi

echo "Logging memory for PID $PID to $LOG_FILE"
echo "Timestamp,VmRSS (KB),VmSize (KB)" > "$LOG_FILE"

while true; do
    if [ ! -d "/proc/$PID" ]; then
        echo "Process $PID no longer exists"
        exit 0
    fi

    TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
    VMRSS=$(grep VmRSS /proc/$PID/status | awk '{print $2}')
    VMSIZE=$(grep VmSize /proc/$PID/status | awk '{print $2}')

    echo "$TIMESTAMP,$VMRSS,$VMSIZE" >> "$LOG_FILE"

    sleep 5
done
```

Run it:

```bash
chmod +x monitor-memory.sh
./monitor-memory.sh 1234
```

This logs memory every 5 seconds to a CSV file.

## Finding Memory Leaks

To detect memory leaks, watch for steadily increasing RSS:

```bash
# Watch a specific process
watch -n 1 'ps -p 1234 -o pid,comm,rss,vsz'
```

Or use a script to alert on memory growth:

```bash
#!/bin/bash

PID=$1
THRESHOLD=500000  # KB

INITIAL_RSS=$(grep VmRSS /proc/$PID/status | awk '{print $2}')

while true; do
    sleep 60
    CURRENT_RSS=$(grep VmRSS /proc/$PID/status | awk '{print $2}')
    INCREASE=$((CURRENT_RSS - INITIAL_RSS))

    if [ $INCREASE -gt $THRESHOLD ]; then
        echo "WARNING: Memory increased by ${INCREASE} KB"
        # Send alert, restart process, etc.
    fi

    echo "$(date): RSS = $CURRENT_RSS KB (increase: $INCREASE KB)"
done
```

## Memory Usage by Programming Language

Different languages report memory differently:

**Python:**
```python
import psutil
import os

process = psutil.Process(os.getpid())
memory_info = process.memory_info()
print(f"RSS: {memory_info.rss / 1024 / 1024:.2f} MB")
print(f"VMS: {memory_info.vms / 1024 / 1024:.2f} MB")
```

**Node.js:**
```javascript
const used = process.memoryUsage();
console.log(`RSS: ${used.rss / 1024 / 1024} MB`);
console.log(`Heap Used: ${used.heapUsed / 1024 / 1024} MB`);
console.log(`Heap Total: ${used.heapTotal / 1024 / 1024} MB`);
```

**Go:**
```go
package main

import (
    "fmt"
    "runtime"
)

func main() {
    var m runtime.MemStats
    runtime.ReadMemStats(&m)
    fmt.Printf("Alloc = %v MB\n", m.Alloc / 1024 / 1024)
    fmt.Printf("TotalAlloc = %v MB\n", m.TotalAlloc / 1024 / 1024)
    fmt.Printf("Sys = %v MB\n", m.Sys / 1024 / 1024)
}
```

## Practical Example: Web Server Memory Analysis

Analyze a web server's memory:

```bash
#!/bin/bash

# Find nginx processes
echo "=== Nginx Memory Usage ==="
ps aux | grep nginx | grep -v grep

echo ""
echo "=== Total Nginx Memory (RSS) ==="
ps aux | grep nginx | grep -v grep | awk '{sum+=$6} END {print sum " KB = " sum/1024 " MB"}'

echo ""
echo "=== Per-Process Breakdown ==="
ps -C nginx -o pid,comm,rss,vsz --sort -rss

echo ""
echo "=== Shared Memory Analysis ==="
# Get the master process PID
MASTER_PID=$(ps aux | grep 'nginx: master' | grep -v grep | awk '{print $2}')

if [ ! -z "$MASTER_PID" ]; then
    PSS=$(grep Pss /proc/$MASTER_PID/smaps 2>/dev/null | awk '{sum+=$2} END {print sum}')
    echo "Master process PSS: $PSS KB"
fi
```

## When to Worry About Memory Usage

High RSS is a concern when:
- It grows continuously (memory leak)
- It exceeds available RAM (causes swapping)
- It's significantly higher than expected
- The system starts using swap heavily

High VIRT is usually fine if RSS is reasonable - processes often allocate virtual memory they never actually use.

## Common Memory Issues

**Issue: High memory reported but system isn't slow**
- Check RSS, not VIRT
- Look at shared memory (SHR)
- Use PSS for accurate measurement

**Issue: Memory grows slowly over time**
- Likely a memory leak
- Monitor RSS over hours/days
- Profile the application code

**Issue: Sudden memory spike**
- Check recent process starts
- Look for large file operations
- Check for cache buildup

Accurately measuring memory usage requires looking at the right metrics. Focus on RSS for quick checks, PSS for accuracy, and monitor trends over time to catch leaks. Virtual memory (VIRT/VSZ) is usually not a concern unless RSS is also high.
