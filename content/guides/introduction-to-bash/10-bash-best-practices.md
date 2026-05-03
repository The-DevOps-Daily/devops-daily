---
title: 'Bash Best Practices'
description: 'Bash scripting best practices for reliable scripts. Covers shebangs, set -euo pipefail, quoting, error handling, functions, and structuring larger scripts.'
order: 10
---

Now that you've learned the fundamentals of Bash scripting, it's time to focus on best practices that will help you write better scripts. Following these guidelines will make your scripts more reliable, maintainable, and secure.

## Structuring Your Scripts

### Start with a Proper Shebang

Always begin your scripts with the appropriate shebang line:

```bash
#!/bin/bash
```

For better portability across systems, you can use:

```bash
#!/usr/bin/env bash
```

This uses the `env` command to locate the Bash interpreter in the user's PATH.

### Add Script Documentation

Include a comment block at the beginning with essential information:

```bash
#!/bin/bash
#
# Name: backup_script.sh
# Description: Backs up important directories to an external drive
# Author: Your Name <your.email@example.com>
# Date: 2024-05-17
# Version: 1.0
# Usage: ./backup_script.sh [options]
#
# Options:
#   -s, --source DIR    Source directory (default: ~/Documents)
#   -d, --dest DIR      Destination directory (default: /mnt/backup)
#   -v, --verbose       Enable verbose output
#   -h, --help          Display this help message and exit
```

This gives users and future maintainers (including yourself) the information they need to understand and use your script.

### Organize Your Code Logically

Arrange your script in a logical structure:

```bash
#!/bin/bash
# Script documentation...

# Define constants
BACKUP_DIR="/mnt/backup"
LOG_FILE="/var/log/backup.log"

# Define functions
log_message() {
    # Function implementation
}

create_backup() {
    # Function implementation
}

# Main script execution
main() {
    # Parse arguments
    # Validate input
    # Perform actions
}

# Call main function
main "$@"
```

This structure makes your script easier to read and maintain.

## Robust Error Handling

### Set Error Handling Options

At the beginning of your script, consider setting these options for better error handling:

```bash
#!/bin/bash

# Exit immediately if a command fails
set -e

# Treat unset variables as an error
set -u

# Exit if any command in a pipe fails (not just the last one)
set -o pipefail
```

These settings help catch errors early rather than allowing your script to continue with incorrect results.

### Check Command Success

Even with `set -e`, explicitly check the success of critical commands:

```bash
if ! mkdir -p "$backup_dir"; then
    echo "Error: Failed to create backup directory: $backup_dir" >&2
    exit 1
fi
```

### Always Handle Cleanup

Use `trap` to ensure cleanup happens even if your script exits unexpectedly:

```bash
#!/bin/bash

# Create a temporary file
temp_file=$(mktemp)

# Clean up the temporary file when the script exits
trap 'rm -f "$temp_file"; echo "Cleaned up temporary files."' EXIT

# Rest of your script...
```

### Provide Verbose Output Options

Give users the option to see more information when things go wrong:

```bash
verbose=false

while getopts ":v" opt; do
    case $opt in
        v)
            verbose=true
            ;;
    esac
done

# Later in the script
if $verbose; then
    echo "Detailed information about what's happening"
fi
```

## Secure Scripting Practices

### Always Quote Variables

Unquoted variables can lead to word splitting and unexpected behavior:

```bash
# Bad practice
file=$1
rm -rf $file  # Dangerous if $file contains spaces or wildcards!

# Good practice
file="$1"
rm -rf "$file"  # Safe - treats the value as a single string
```

### Use Restricted Deletion

When removing files, specify paths explicitly and use safeguards:

```bash
# Bad practice
rm -rf *

# Better practice
rm -rf "$specific_directory"/*

# Best practice - add a sanity check
if [ "$specific_directory" = "/path/to/expected/dir" ]; then
    rm -rf "$specific_directory"/*
else
    echo "Error: Unexpected directory: $specific_directory" >&2
    exit 1
fi
```

### Validate Input

Never trust user input without validation:

```bash
port="$1"

# Validate that the port is a number between 1 and 65535
if ! [[ "$port" =~ ^[0-9]+$ ]] || [ "$port" -lt 1 ] || [ "$port" -gt 65535 ]; then
    echo "Error: Invalid port number. Please specify a number between 1 and 65535." >&2
    exit 1
fi
```

### Handle Special Characters

Be careful with filenames and variables that might contain special characters:

```bash
# Create an array of files that handles special characters properly
files=()
while IFS= read -r -d '' file; do
    files+=("$file")
done < <(find /path -type f -name "*.txt" -print0)

# Process each file safely
for file in "${files[@]}"; do
    process_file "$file"
done
```

### Avoid Command Injection

When using variables in commands, be careful about potential command injection:

```bash
# Bad practice - command injection vulnerability
user_input="$(cat file.txt); rm -rf /"
eval "echo $user_input"  # Dangerous!

# Good practice
user_input="$(cat file.txt)"
echo "$user_input"  # Safe
```

## Improving Maintainability

### Use Constants for Magic Values

Define constants at the top of your script instead of hardcoding values:

```bash
# Define constants
readonly MAX_RETRIES=5
readonly TIMEOUT=10
readonly LOG_DIR="/var/log/myapp"

# Use constants in the script
for ((i=1; i<=MAX_RETRIES; i++)); do
    if connect_to_server; then
        break
    fi
    sleep "$TIMEOUT"
done
```

### Write Modular Code with Functions

Break your script into small, focused functions:

```bash
validate_input() {
    # Input validation logic
}

process_file() {
    local file="$1"
    # Processing logic
}

generate_report() {
    # Report generation logic
}

main() {
    validate_input "$@"
    process_file "$input_file"
    generate_report
}

main "$@"
```

### Add Helpful Comments

Comment on complex sections of code, but avoid stating the obvious:

```bash
# Bad comment - states the obvious
# Increment the counter
counter=$((counter + 1))

# Good comment - explains why
# Retry the API call to handle intermittent network issues
retry_count=$((retry_count + 1))
```

### Use Consistent Indentation and Formatting

Maintain consistent style throughout your script:

```bash
# Consistent indentation (4 spaces is common)
if [ "$condition" = true ]; then
    echo "Condition is true"
    if [ "$another_condition" = true ]; then
        echo "Both conditions are true"
    fi
else
    echo "Condition is false"
fi
```

## Performance Considerations

### Minimize External Program Calls

Bash operations are faster than external commands:

```bash
# Slow - calls external 'date' program in a loop
for ((i=0; i<1000; i++)); do
    timestamp=$(date +%s)
    # Do something with timestamp
done

# Faster - call 'date' once
start_time=$(date +%s)
for ((i=0; i<1000; i++)); do
    timestamp=$((start_time + i))
    # Do something with timestamp
done
```

### Use Built-in Commands When Possible

Prefer Bash built-ins over external commands:

```bash
# Slow - uses external 'grep'
if grep -q "pattern" <<< "$string"; then
    echo "Pattern found"
fi

# Faster - uses Bash's pattern matching
if [[ "$string" == *"pattern"* ]]; then
    echo "Pattern found"
fi
```

### Process Files Efficiently

When processing large files, use streaming tools:

```bash
# Memory-intensive - reads entire file into memory
content=$(cat large_file.txt)
echo "$content" | grep "pattern"

# Memory-efficient - streams the file
grep "pattern" large_file.txt
```

## Debugging Techniques

### Enable Debug Mode

Add debugging support to your scripts:

```bash
#!/bin/bash

# Enable debug mode with -d flag
while getopts ":d" opt; do
    case $opt in
        d)
            set -x  # Print commands before execution
            ;;
    esac
done

# Rest of your script...
```

### Add Debug Functions

Create a dedicated debug function:

```bash
debug() {
    if [ "$DEBUG" = true ]; then
        echo "DEBUG: $*" >&2
    fi
}

# Later in your script
DEBUG=true
debug "Current value of variable: $variable"
```

### Use Shellcheck

Always run your scripts through [Shellcheck](https://www.shellcheck.net/), a static analysis tool for shell scripts:

```bash
# Install Shellcheck
# On Debian/Ubuntu
sudo apt install shellcheck

# Run Shellcheck on your script
shellcheck myscript.sh
```

Shellcheck identifies common bugs, stylistic issues, and potential pitfalls in your scripts.

## Practical Examples of Best Practices

Let's look at a few examples that demonstrate these best practices:

### Example 1: File Processing Script

```bash
#!/usr/bin/env bash
#
# Name: process_logs.sh
# Description: Processes log files, extracts errors, and creates a report
# Usage: ./process_logs.sh [options] <log_directory>
#
# Options:
#   -o, --output FILE    Output file (default: error_report.txt)
#   -v, --verbose        Enable verbose output
#   -h, --help           Display this help message and exit

# Exit on error, undefined variables, and pipe failures
set -euo pipefail

# Define constants
readonly DEFAULT_OUTPUT="error_report.txt"
readonly TEMP_DIR=$(mktemp -d)

# Ensure cleanup on exit
trap 'rm -rf "$TEMP_DIR"; echo "Cleaned up temporary files."' EXIT

# Function definitions
show_usage() {
    echo "Usage: $(basename "$0") [options] <log_directory>"
    echo
    echo "Options:"
    echo "  -o, --output FILE    Output file (default: error_report.txt)"
    echo "  -v, --verbose        Enable verbose output"
    echo "  -h, --help           Display this help message and exit"
}

log_message() {
    local level="$1"
    local message="$2"
    local timestamp
    timestamp=$(date "+%Y-%m-%d %H:%M:%S")
    echo "[$level] $timestamp - $message"
}

debug_message() {
    if [ "$verbose" = true ]; then
        log_message "DEBUG" "$1"
    fi
}

process_log_file() {
    local log_file="$1"
    local output_file="$2"

    debug_message "Processing $log_file"

    # Check if file exists and is readable
    if [ ! -r "$log_file" ]; then
        log_message "ERROR" "Cannot read log file: $log_file"
        return 1
    fi

    # Extract error messages
    grep -i "error\|exception\|fail" "$log_file" >> "$output_file" || true

    debug_message "Finished processing $log_file"
    return 0
}

# Main function
main() {
    # Default values
    local output_file="$DEFAULT_OUTPUT"
    local verbose=false

    # Parse options
    while [ $# -gt 0 ]; do
        case "$1" in
            -h|--help)
                show_usage
                exit 0
                ;;
            -v|--verbose)
                verbose=true
                shift
                ;;
            -o|--output)
                if [ -z "$2" ] || [ "${2:0:1}" = "-" ]; then
                    log_message "ERROR" "Option $1 requires an argument"
                    show_usage
                    exit 1
                fi
                output_file="$2"
                shift 2
                ;;
            -*)
                log_message "ERROR" "Unknown option: $1"
                show_usage
                exit 1
                ;;
            *)
                break
                ;;
        esac
    done

    # Check for required argument
    if [ $# -ne 1 ]; then
        log_message "ERROR" "Please specify exactly one log directory"
        show_usage
        exit 1
    fi

    log_directory="$1"

    # Validate the log directory
    if [ ! -d "$log_directory" ]; then
        log_message "ERROR" "Not a directory: $log_directory"
        exit 1
    fi

    # Create a temporary file for output
    temp_output="${TEMP_DIR}/temp_output.txt"
    touch "$temp_output"

    # Process each log file
    log_count=0
    error_count=0

    log_message "INFO" "Starting log processing from $log_directory"

    while IFS= read -r -d '' log_file; do
        log_count=$((log_count + 1))
        if process_log_file "$log_file" "$temp_output"; then
            debug_message "Successfully processed: $log_file"
        else
            error_count=$((error_count + 1))
            log_message "WARN" "Failed to process: $log_file"
        fi
    done < <(find "$log_directory" -type f -name "*.log" -print0)

    # Generate the final report
    {
        echo "Error Report - Generated on $(date)"
        echo "======================="
        echo "Processed $log_count log files with $error_count failures"
        echo "======================="
        echo
        cat "$temp_output"
    } > "$output_file"

    log_message "INFO" "Completed processing. Report saved to $output_file"
}

# Execute main function with all arguments
main "$@"
```

### Example 2: Secure Backup Script

```bash
#!/usr/bin/env bash
#
# Name: secure_backup.sh
# Description: Securely backs up specified directories
# Usage: ./secure_backup.sh [options]
#
# Options:
#   -s, --source DIR     Source directory (default: $HOME)
#   -d, --dest DIR       Destination directory (default: /mnt/backup)
#   -r, --retain N       Number of backups to retain (default: 5)
#   -v, --verbose        Enable verbose output
#   -h, --help           Display this help message and exit

# Exit on error, undefined variables, and pipe failures
set -euo pipefail

# Define constants
readonly DEFAULT_SOURCE="$HOME"
readonly DEFAULT_DEST="/mnt/backup"
readonly DEFAULT_RETAIN=5
readonly TIMESTAMP=$(date "+%Y%m%d_%H%M%S")
readonly LOCK_FILE="/tmp/backup.lock"
readonly LOG_FILE="/var/log/backup.log"

# Ensure single execution and cleanup
cleanup() {
    rm -f "$LOCK_FILE"
    echo "Backup script finished at $(date)" >> "$LOG_FILE"
}

log() {
    local level="$1"
    local message="$2"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $message" >> "$LOG_FILE"

    if [ "$level" = "ERROR" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $message" >&2
    elif [ "$verbose" = true ] || [ "$level" = "INFO" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $message"
    fi
}

show_usage() {
    echo "Usage: $(basename "$0") [options]"
    echo
    echo "Options:"
    echo "  -s, --source DIR     Source directory (default: $DEFAULT_SOURCE)"
    echo "  -d, --dest DIR       Destination directory (default: $DEFAULT_DEST)"
    echo "  -r, --retain N       Number of backups to retain (default: $DEFAULT_RETAIN)"
    echo "  -v, --verbose        Enable verbose output"
    echo "  -h, --help           Display this help message and exit"
}

validate_directory() {
    local dir="$1"
    local dir_type="$2"

    # Check if directory exists
    if [ ! -d "$dir" ]; then
        log "ERROR" "$dir_type directory does not exist: $dir"
        return 1
    fi

    # Check if directory is readable (for source) or writable (for destination)
    if [ "$dir_type" = "Source" ] && [ ! -r "$dir" ]; then
        log "ERROR" "$dir_type directory is not readable: $dir"
        return 1
    elif [ "$dir_type" = "Destination" ] && [ ! -w "$dir" ]; then
        log "ERROR" "$dir_type directory is not writable: $dir"
        return 1
    fi

    return 0
}

create_backup() {
    local source_dir="$1"
    local dest_dir="$2"
    local backup_file="${dest_dir}/backup_${TIMESTAMP}.tar.gz"

    log "INFO" "Creating backup of $source_dir to $backup_file"

    # Ensure destination directory exists
    mkdir -p "$dest_dir"

    # Create the backup
    if tar -czf "$backup_file" -C "$(dirname "$source_dir")" "$(basename "$source_dir")"; then
        log "INFO" "Backup created successfully: $backup_file"
        return 0
    else
        log "ERROR" "Failed to create backup"
        return 1
    fi
}

rotate_backups() {
    local dest_dir="$1"
    local retain="$2"

    log "INFO" "Rotating backups, keeping $retain most recent"

    # Get list of backup files sorted by modification time (oldest first)
    local backup_count
    backup_count=$(find "$dest_dir" -name "backup_*.tar.gz" | wc -l)

    if [ "$backup_count" -le "$retain" ]; then
        log "INFO" "No backups to rotate (have $backup_count, keeping $retain)"
        return 0
    fi

    # Calculate how many to delete
    local delete_count=$((backup_count - retain))

    log "INFO" "Removing $delete_count old backups"

    # Delete oldest backups
    find "$dest_dir" -name "backup_*.tar.gz" -printf "%T@ %p\n" | \
        sort -n | head -n "$delete_count" | cut -d' ' -f2- | \
        xargs -r rm -f

    log "INFO" "Backup rotation completed"
    return 0
}

main() {
    # Default values
    local source_dir="$DEFAULT_SOURCE"
    local dest_dir="$DEFAULT_DEST"
    local retain="$DEFAULT_RETAIN"
    local verbose=false

    # Parse options
    while [ $# -gt 0 ]; do
        case "$1" in
            -h|--help)
                show_usage
                exit 0
                ;;
            -v|--verbose)
                verbose=true
                shift
                ;;
            -s|--source)
                if [ -z "${2:-}" ] || [ "${2:0:1}" = "-" ]; then
                    log "ERROR" "Option $1 requires an argument"
                    show_usage
                    exit 1
                fi
                source_dir="$2"
                shift 2
                ;;
            -d|--dest)
                if [ -z "${2:-}" ] || [ "${2:0:1}" = "-" ]; then
                    log "ERROR" "Option $1 requires an argument"
                    show_usage
                    exit 1
                fi
                dest_dir="$2"
                shift 2
                ;;
            -r|--retain)
                if [ -z "${2:-}" ] || [ "${2:0:1}" = "-" ]; then
                    log "ERROR" "Option $1 requires an argument"
                    show_usage
                    exit 1
                fi
                if ! [[ "$2" =~ ^[0-9]+$ ]]; then
                    log "ERROR" "Retain value must be a positive number"
                    exit 1
                fi
                retain="$2"
                shift 2
                ;;
            *)
                log "ERROR" "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done

    # Check for existing backup process
    if [ -f "$LOCK_FILE" ]; then
        pid=$(cat "$LOCK_FILE")
        if ps -p "$pid" > /dev/null; then
            log "ERROR" "Another backup process is already running (PID: $pid)"
            exit 1
        else
            log "WARN" "Found stale lock file. Previous backup may have failed."
            rm -f "$LOCK_FILE"
        fi
    fi

    # Create lock file
    echo $$ > "$LOCK_FILE"
    trap cleanup EXIT

    # Start log entry
    echo "Backup script started at $(date)" >> "$LOG_FILE"

    # Validate directories
    validate_directory "$source_dir" "Source" || exit 1

    # Create the destination directory if it doesn't exist
    mkdir -p "$dest_dir" 2>/dev/null || true
    validate_directory "$dest_dir" "Destination" || exit 1

    # Create backup
    if ! create_backup "$source_dir" "$dest_dir"; then
        log "ERROR" "Backup failed"
        exit 1
    fi

    # Rotate old backups
    rotate_backups "$dest_dir" "$retain"

    log "INFO" "Backup completed successfully"
    return 0
}

# Execute main function
main "$@"
```

## Further Bash Best Practices

Here are some additional best practices to consider:

### Use Version Control

Keep your scripts in a version control system like Git:

```bash
# Initialize a Git repository for your scripts
git init ~/scripts
cd ~/scripts

# Add your script and commit
git add myscript.sh
git commit -m "Initial version of myscript.sh"
```

### Add a Template File

Create a template for new scripts to ensure you follow best practices consistently:

```bash
#!/usr/bin/env bash
#
# Name: template.sh
# Description: Template for Bash scripts
# Author: Your Name <your.email@example.com>
# Date: $(date "+%Y-%m-%d")
#

# Exit on error, undefined variables, and pipe failures
set -euo pipefail

# Function definitions
show_usage() {
    echo "Usage: $(basename "$0") [options]"
    echo
    echo "Options:"
    echo "  -h, --help           Display this help message and exit"
}

# Main function
main() {
    # Your script logic here
    echo "Hello, world!"
}

# Execute main function with all arguments
main "$@"
```

### Test Your Scripts

Create tests for your scripts to ensure they work as expected:

```bash
#!/usr/bin/env bash
#
# Name: test_script.sh
# Description: Test cases for myscript.sh
#

# Define color codes for test output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

run_test() {
    local test_name="$1"
    local command="$2"
    local expected="$3"

    echo -n "Testing $test_name... "

    # Run the command and capture output
    result=$(eval "$command")

    # Compare with expected output
    if [ "$result" = "$expected" ]; then
        echo -e "${GREEN}PASS${NC}"
        return 0
    else
        echo -e "${RED}FAIL${NC}"
        echo "  Expected: $expected"
        echo "  Got: $result"
        return 1
    fi
}

# Run tests
run_test "basic functionality" "./myscript.sh" "Hello, world!"
run_test "help option" "./myscript.sh --help | grep -c 'Usage:'" "1"

# Report results
echo
echo "Tests completed."
```

## Conclusion

Following these best practices will significantly improve the quality of your Bash scripts. They'll be more reliable, secure, maintainable, and easier for others (including your future self) to understand and modify.

Remember that Bash scripting is a skill that improves with practice. As you write more scripts and encounter different scenarios, you'll develop a better sense of which practices work best for your specific needs.

I encourage you to review existing scripts with these best practices in mind and gradually refactor them to improve their quality. Start applying these principles to new scripts from the beginning, and you'll find that writing robust Bash code becomes second nature.

Happy scripting!
