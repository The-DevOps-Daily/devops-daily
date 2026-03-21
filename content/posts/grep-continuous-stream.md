---
title: 'How to Grep a Continuous Stream in Real-Time'
excerpt: "Learn how to filter live log streams with grep, including line-buffering for immediate output, following log files, and monitoring command output as it happens."
category:
  name: 'Linux'
  slug: 'linux'
date: '2024-10-18'
publishedAt: '2024-10-18T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Linux
  - grep
  - Logging
  - Command Line
  - Monitoring
---

You're monitoring a log file that's constantly being written to, and you want to filter it with grep, but the output doesn't appear immediately. How do you grep a continuous stream in real-time?

## TL;DR

Use `grep --line-buffered` when piping continuous output to make it flush after each line instead of waiting for a full buffer. For tailing log files, use `tail -f logfile | grep --line-buffered pattern`. The `--line-buffered` flag forces grep to output each matching line immediately rather than batching them. For following multiple files or more advanced features, consider using tools like `multitail` or `lnav`.

By default, grep buffers output when it's not writing directly to a terminal, which causes delays when monitoring live streams.

Let's say you're monitoring a web server log in real-time:

```bash
tail -f /var/log/nginx/access.log | grep "ERROR"
```

Without `--line-buffered`, you might not see matches immediately because grep buffers its output. Add the flag:

```bash
tail -f /var/log/nginx/access.log | grep --line-buffered "ERROR"
```

Now error lines appear as soon as they're logged.

## Understanding Buffering

When programs write to a terminal, they use line buffering (flush after each newline). When writing to a pipe, they use full buffering (flush when the buffer is full, typically 4KB-8KB).

```
Without --line-buffered:
tail -f log.txt | grep "ERROR" | your-script
                 ^
                 Buffers up to 4KB before flushing

With --line-buffered:
tail -f log.txt | grep --line-buffered "ERROR" | your-script
                 ^
                 Flushes after each line
```

This matters for real-time monitoring where you want immediate feedback.

## Tailing and Grepping Log Files

The classic use case for monitoring logs:

```bash
# Monitor for errors
tail -f /var/log/application.log | grep --line-buffered "ERROR"

# Monitor for specific user activity
tail -f /var/log/auth.log | grep --line-buffered "user bobby"

# Monitor multiple patterns
tail -f /var/log/syslog | grep --line-buffered -E "error|warn|fail"
```

The `-E` flag enables extended regular expressions for the OR pattern.

## Following Multiple Files

Use `tail -f` with multiple files:

```bash
tail -f /var/log/app/*.log | grep --line-buffered "ERROR"
```

Or use `--follow=name` to handle log rotation properly:

```bash
tail --follow=name /var/log/app/error.log | grep --line-buffered "Exception"
```

This continues following even if the file is renamed (common during log rotation).

## Grepping Command Output in Real-Time

Monitor a long-running command's output:

```bash
# Monitor build output for errors
make build 2>&1 | grep --line-buffered -i error

# Monitor network connections for specific IPs
watch -n 1 'netstat -an' | grep --line-buffered "192.168.1"

# Monitor docker logs
docker logs -f container_name | grep --line-buffered "WARNING"
```

The `2>&1` redirects stderr to stdout so grep can filter both.

## Highlighting Matches in Color

Add `--color=always` to highlight matches in continuous streams:

```bash
tail -f /var/log/syslog | grep --line-buffered --color=always "ERROR"
```

The `--color=always` forces color output even when piping (normally it only colors terminal output).

## Inverting Matches

Filter out unwanted lines instead of showing matches:

```bash
# Show everything except debug messages
tail -f /var/log/app.log | grep --line-buffered -v "DEBUG"

# Exclude multiple patterns
tail -f /var/log/app.log | grep --line-buffered -v -E "DEBUG|INFO"
```

The `-v` flag inverts the match.

## Case-Insensitive Matching

Use `-i` for case-insensitive filtering:

```bash
# Match ERROR, Error, error, etc.
tail -f /var/log/app.log | grep --line-buffered -i "error"
```

## Practical Example: Monitoring Multiple Severity Levels

Create a function to monitor logs with color-coded severity:

```bash
monitor_logs() {
    tail -f "$1" | grep --line-buffered -E "ERROR|WARNING|INFO" \
        | sed --unbuffered 's/ERROR/\x1b[31mERROR\x1b[0m/g' \
        | sed --unbuffered 's/WARNING/\x1b[33mWARNING\x1b[0m/g' \
        | sed --unbuffered 's/INFO/\x1b[32mINFO\x1b[0m/g'
}

# Usage
monitor_logs /var/log/application.log
```

This highlights ERROR in red, WARNING in yellow, and INFO in green. Note the `--unbuffered` flag for sed.

## Practical Example: Alert on Specific Patterns

Watch for critical errors and send alerts:

```bash
#!/bin/bash

ALERT_EMAIL="admin@example.com"

tail -f /var/log/application.log | grep --line-buffered "CRITICAL" | while read line; do
    echo "CRITICAL error detected: $line" | mail -s "Alert: Critical Error" "$ALERT_EMAIL"
    echo "$(date): $line" >> /var/log/critical-alerts.log
done
```

This sends an email and logs each critical error as it occurs.

## Using stdbuf for Other Commands

If you're piping through commands that aren't grep, use `stdbuf` to control buffering:

```bash
# Force line buffering on awk
tail -f /var/log/app.log | stdbuf -oL awk '{print $1, $3}' | grep --line-buffered "ERROR"

# Force line buffering on sed
tail -f /var/log/app.log | stdbuf -oL sed 's/foo/bar/' | grep --line-buffered "ERROR"
```

The `-oL` option sets line buffering for stdout.

## Monitoring Journal Logs

For systemd journal logs, use `journalctl` with follow:

```bash
# Follow journal and filter
journalctl -f | grep --line-buffered "ssh"

# Follow specific service
journalctl -u nginx -f | grep --line-buffered "error"

# Follow with priority filtering
journalctl -p err -f | grep --line-buffered "database"
```

`journalctl -f` is like `tail -f` for systemd journals.

## Advanced: Using Named Pipes

Create a named pipe for more complex filtering:

```bash
# Create a named pipe
mkfifo /tmp/logpipe

# Writer process
tail -f /var/log/app.log > /tmp/logpipe &

# Reader with multiple filters
cat /tmp/logpipe | grep --line-buffered "ERROR" &
cat /tmp/logpipe | grep --line-buffered "WARNING" >> warnings.log &

# Clean up
rm /tmp/logpipe
```

This allows multiple consumers of the same stream.

## Monitoring Network Streams

Use `nc` (netcat) with grep for network streams:

```bash
# Monitor syslog over network
nc -l 514 | grep --line-buffered "ERROR"

# Monitor HTTP traffic (requires proper setup)
nc -l 8080 | grep --line-buffered "POST"
```

## Combining with Other Tools

Chain grep with other real-time processors:

```bash
# Extract and count unique IPs accessing a URL
tail -f /var/log/nginx/access.log \
    | grep --line-buffered "/api/login" \
    | awk '{print $1}' \
    | sort \
    | uniq -c \
    | sort -rn
```

## Performance Considerations

`--line-buffered` has a small performance cost because it flushes after every line:

```bash
# Faster but delayed output
tail -f huge.log | grep "pattern"

# Slower but immediate output
tail -f huge.log | grep --line-buffered "pattern"
```

For very high-volume logs (thousands of lines per second), you might notice CPU usage increase with line buffering. In most cases, the performance difference is negligible.

## Alternative Tools for Log Monitoring

For more features, consider specialized tools:

**multitail** - Monitor multiple files with color coding:
```bash
sudo apt install multitail
multitail /var/log/syslog /var/log/auth.log
```

**lnav** - Advanced log viewer:
```bash
sudo apt install lnav
lnav /var/log/*.log
```

**stern** - For Kubernetes logs:
```bash
stern pod-name | grep --line-buffered "ERROR"
```

## Troubleshooting Buffering Issues

If output still seems delayed:

1. Make sure `--line-buffered` is on the grep command
2. Check if other commands in the pipeline buffer (use `stdbuf`)
3. Try `grep --line-buffered --color=never` (color processing can cause delays)
4. Verify the source actually produces output (try without grep first)

Test buffering:

```bash
# This should show output immediately
{ while true; do echo "line"; sleep 1; done } | grep --line-buffered "line"

# Without --line-buffered, you'd see delays
{ while true; do echo "line"; sleep 1; done } | grep "line"
```

## Stopping Continuous Greps

End monitoring with Ctrl+C. In scripts, handle signals properly:

```bash
#!/bin/bash

# Handle Ctrl+C gracefully
trap 'echo "Monitoring stopped"; exit 0' SIGINT SIGTERM

tail -f /var/log/app.log | grep --line-buffered "ERROR"
```

For real-time log filtering with grep, always use `--line-buffered` when piping continuous streams. This makes grep flush output after each line instead of batching, giving you immediate visibility into log events as they happen.
