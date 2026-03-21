---
title: 'How to Set a Variable to the Output of a Command in Bash'
excerpt: 'Learn multiple methods to capture command output in Bash variables using command substitution, including best practices and error handling techniques.'
category:
  name: 'Bash'
  slug: 'bash'
date: '2024-10-01'
publishedAt: '2024-10-01T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Bash
  - Scripting
  - Variables
  - Commands
  - Shell
---

Capturing command output in variables is one of the most fundamental operations in Bash scripting. Whether you're processing system information, parsing files, or working with external tools, you'll frequently need to store command results for further processing.

This guide covers the different methods for command substitution, best practices for handling output, and techniques for error management and complex scenarios.

## Command Substitution with $()

The modern and preferred method uses `$()` syntax:

```bash
# Basic command substitution
current_date=$(date)
echo "Today is: $current_date"

# Get current user
username=$(whoami)
echo "Running as: $username"

# Capture file count
file_count=$(ls -1 | wc -l)
echo "Number of files: $file_count"

# Get system information
kernel_version=$(uname -r)
echo "Kernel version: $kernel_version"
```

The `$()` method is preferred because:

- It's more readable and easier to nest
- It handles nested quotes better
- It's POSIX compliant
- It's the modern standard

## Command Substitution with Backticks

The older backtick method still works but is less preferred:

```bash
# Using backticks (older method)
current_time=`date +"%H:%M:%S"`
echo "Current time: $current_time"

# Get hostname
hostname=`hostname`
echo "Hostname: $hostname"
```

Avoid backticks for new scripts because:

- They're harder to read in complex expressions
- Nesting is difficult and error-prone
- Escaping quotes inside is problematic

## Capturing Multi-line Output

Handle commands that produce multiple lines:

```bash
# Capture all lines in a single variable
file_list=$(ls -la)
echo "Directory listing:"
echo "$file_list"

# Process line by line
while IFS= read -r line; do
    echo "Processing: $line"
done <<< "$(find /etc -name "*.conf" -type f)"

# Store in an array
readarray -t files <<< "$(find . -name "*.txt")"
echo "Found ${#files[@]} text files"
for file in "${files[@]}"; do
    echo "  $file"
done
```

## Error Handling and Exit Codes

Capture both output and handle errors properly:

```bash
# Check if command succeeded
if output=$(command_that_might_fail 2>&1); then
    echo "Success: $output"
else
    echo "Command failed with output: $output"
    exit 1
fi

# Separate stdout and stderr
{
    output=$(command 2>&1)
    exit_code=$?
}

if [ $exit_code -eq 0 ]; then
    echo "Command succeeded: $output"
else
    echo "Command failed with exit code $exit_code: $output"
fi

# More robust error handling
run_command() {
    local cmd="$1"
    local output
    local exit_code

    output=$(eval "$cmd" 2>&1)
    exit_code=$?

    if [ $exit_code -eq 0 ]; then
        echo "$output"
        return 0
    else
        echo "Error executing '$cmd': $output" >&2
        return $exit_code
    fi
}

# Usage
if result=$(run_command "ls /nonexistent"); then
    echo "Command output: $result"
else
    echo "Command failed"
fi
```

## Working with JSON and Structured Data

Parse command output that returns structured data:

```bash
# Using jq to parse JSON
get_user_info() {
    local username="$1"
    local user_data

    if user_data=$(curl -s "https://api.github.com/users/$username"); then
        local name=$(echo "$user_data" | jq -r '.name // "N/A"')
        local followers=$(echo "$user_data" | jq -r '.followers')
        local repos=$(echo "$user_data" | jq -r '.public_repos')

        echo "Name: $name"
        echo "Followers: $followers"
        echo "Public repos: $repos"
    else
        echo "Failed to fetch user data"
        return 1
    fi
}

# Parse system information
get_system_info() {
    local cpu_info=$(lscpu | grep "Model name" | cut -d: -f2 | xargs)
    local memory_total=$(free -h | grep "Mem:" | awk '{print $2}')
    local disk_usage=$(df -h / | tail -1 | awk '{print $5}')

    cat << EOF
System Information:
  CPU: $cpu_info
  Memory: $memory_total
  Disk Usage: $disk_usage
EOF
}
```

## Nested Command Substitution

Handle complex scenarios with nested commands:

```bash
# Simple nesting
backup_file="backup_$(date +%Y%m%d)_$(hostname).tar.gz"
echo "Backup file: $backup_file"

# More complex nesting
latest_log=$(ls -t $(find /var/log -name "*.log" -type f) | head -1)
echo "Latest log file: $latest_log"

# Process nested results
config_value=$(grep "$(hostname)" /etc/hosts | awk '{print $2}')
echo "Host configuration: $config_value"

# Advanced example: Find largest file in a directory
largest_file=$(find /home/user -type f -exec ls -la {} \; | \
               sort -k5 -nr | \
               head -1 | \
               awk '{print $9}')
echo "Largest file: $largest_file"
```

## Performance Considerations

Optimize command substitution for better performance:

```bash
# Avoid unnecessary subshells
# Instead of:
slow_method=$(cat file.txt | grep pattern | wc -l)

# Use:
fast_method=$(grep -c pattern file.txt)

# Cache expensive operations
cache_expensive_operation() {
    local cache_file="/tmp/expensive_result_cache"
    local cache_timeout=3600  # 1 hour

    if [[ -f "$cache_file" && $(($(date +%s) - $(stat -c %Y "$cache_file"))) -lt $cache_timeout ]]; then
        cat "$cache_file"
    else
        expensive_command > "$cache_file"
        cat "$cache_file"
    fi
}

# Use it
result=$(cache_expensive_operation)
```

## Advanced Patterns

Handle complex scenarios with sophisticated techniques:

```bash
# Conditional command execution
get_service_status() {
    local service="$1"
    local status

    if command -v systemctl >/dev/null 2>&1; then
        status=$(systemctl is-active "$service" 2>/dev/null || echo "unknown")
    elif command -v service >/dev/null 2>&1; then
        status=$(service "$service" status >/dev/null 2>&1 && echo "active" || echo "inactive")
    else
        status="unsupported"
    fi

    echo "$status"
}

# Timeout for long-running commands
run_with_timeout() {
    local timeout="$1"
    local cmd="$2"
    local output

    if output=$(timeout "$timeout" bash -c "$cmd" 2>&1); then
        echo "$output"
        return 0
    else
        local exit_code=$?
        if [ $exit_code -eq 124 ]; then
            echo "Command timed out after $timeout seconds" >&2
        else
            echo "Command failed: $output" >&2
        fi
        return $exit_code
    fi
}

# Usage
if result=$(run_with_timeout 10 "slow_command"); then
    echo "Result: $result"
else
    echo "Command failed or timed out"
fi
```

## Real-world Examples

Practical examples for common scenarios:

```bash
#!/bin/bash

# System monitoring script
monitor_system() {
    local load_avg=$(uptime | awk -F'load average:' '{print $2}' | xargs)
    local memory_usage=$(free | grep Mem | awk '{printf "%.1f%%", $3/$2 * 100.0}')
    local disk_usage=$(df / | tail -1 | awk '{print $5}')
    local processes=$(ps aux | wc -l)

    cat << EOF
System Status Report - $(date)
================================
Load Average: $load_avg
Memory Usage: $memory_usage
Disk Usage: $disk_usage
Running Processes: $processes
EOF
}

# Network connectivity check
check_connectivity() {
    local hosts=("google.com" "github.com" "stackoverflow.com")

    for host in "${hosts[@]}"; do
        local response_time=$(ping -c 1 -W 2 "$host" 2>/dev/null | \
                             grep "time=" | \
                             sed 's/.*time=\([0-9.]*\).*/\1/')

        if [[ -n "$response_time" ]]; then
            echo "$host: ${response_time}ms"
        else
            echo "$host: unreachable"
        fi
    done
}

# Database backup with timestamp
create_backup() {
    local db_name="$1"
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_file="${db_name}_backup_${timestamp}.sql"

    if mysqldump "$db_name" > "$backup_file" 2>/dev/null; then
        local file_size=$(du -h "$backup_file" | cut -f1)
        echo "Backup created: $backup_file ($file_size)"
    else
        echo "Backup failed for database: $db_name"
        return 1
    fi
}

# Run monitoring
monitor_system
echo
check_connectivity
```

## Best Practices

1. **Use `$()` instead of backticks** for better readability
2. **Always quote variables** to handle spaces and special characters
3. **Handle errors explicitly** - don't assume commands will succeed
4. **Consider performance** for frequently executed commands
5. **Use proper error redirection** when capturing both stdout and stderr
6. **Cache expensive operations** when appropriate
7. **Validate command existence** before using external tools
8. **Use timeouts** for potentially long-running commands

Command substitution is a powerful feature that enables sophisticated data processing in Bash scripts. By following these patterns and best practices, you can create robust scripts that effectively capture and process command output while handling errors gracefully.
