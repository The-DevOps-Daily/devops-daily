---
title: 'How to Get the Directory Where a Bash Script is Located'
excerpt: 'Learn multiple reliable methods to determine the directory path of your Bash script from within the script itself, including handling symbolic links and edge cases.'
category:
  name: 'Bash'
  slug: 'bash'
date: '2024-03-15'
publishedAt: '2024-03-15T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Bash
  - shell scripting
  - file paths
  - Linux
  - automation
---

When writing Bash scripts, you often need to know the directory where your script is located. This becomes essential when your script needs to access configuration files, load other scripts, or work with relative paths. Getting the script's directory isn't as straightforward as it might seem, especially when dealing with symbolic links or different execution contexts.

## Prerequisites

You'll need a basic understanding of Bash scripting and familiarity with file system concepts like absolute and relative paths. Access to a Unix-like system (Linux, macOS, or WSL) is required to test the examples.

## The Basic Approach

The most common method uses the `$0` variable, which contains the path used to invoke the script:

```bash
#!/bin/bash

# Get the directory of the current script
SCRIPT_DIR=$(dirname "$0")
echo "Script directory: $SCRIPT_DIR"

# Convert to absolute path
SCRIPT_DIR=$(cd "$SCRIPT_DIR" && pwd)
echo "Absolute script directory: $SCRIPT_DIR"
```

The `dirname` command extracts the directory portion from a file path, while `$0` represents how the script was called. However, this approach has limitations when dealing with symbolic links or relative paths.

## Handling Symbolic Links Properly

If your script might be called through a symbolic link, you need a more robust approach that resolves the actual location:

```bash
#!/bin/bash

# Method 1: Using readlink to resolve symbolic links
SCRIPT_DIR=$(dirname "$(readlink -f "$0")")
echo "Real script directory: $SCRIPT_DIR"

# Method 2: More portable approach for systems without readlink -f
SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do
    DIR=$(cd -P "$(dirname "$SOURCE")" && pwd)
    SOURCE=$(readlink "$SOURCE")
    [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE"
done
SCRIPT_DIR=$(cd -P "$(dirname "$SOURCE")" && pwd)

echo "Resolved script directory: $SCRIPT_DIR"
```

The `readlink -f` command follows symbolic links to their final destination. The second method provides better portability across different Unix systems that might not support the `-f` flag.

## Cross-Platform Compatible Solution

For maximum portability across different systems, use this approach that works on Linux, macOS, and other Unix variants:

```bash
#!/bin/bash

get_script_dir() {
    local source="${BASH_SOURCE[0]}"
    local dir=""

    # Resolve $source until the file is no longer a symlink
    while [ -h "$source" ]; do
        dir=$(cd -P "$(dirname "$source")" >/dev/null 2>&1 && pwd)
        source=$(readlink "$source")
        # If $source was a relative symlink, resolve it relative to the path where the symlink file was located
        [[ $source != /* ]] && source=$dir/$source
    done

    dir=$(cd -P "$(dirname "$source")" >/dev/null 2>&1 && pwd)
    echo "$dir"
}

SCRIPT_DIR=$(get_script_dir)
echo "Script located in: $SCRIPT_DIR"
```

This function handles symbolic links correctly and suppresses error messages while maintaining compatibility across different shells and systems.

## Practical Usage Examples

Here's how you might use the script directory in real-world scenarios:

```bash
#!/bin/bash

# Get script directory
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

# Load configuration file from same directory
CONFIG_FILE="$SCRIPT_DIR/config.conf"
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
    echo "Configuration loaded from: $CONFIG_FILE"
else
    echo "Warning: Configuration file not found at $CONFIG_FILE"
fi

# Include other scripts from relative paths
HELPERS_DIR="$SCRIPT_DIR/helpers"
if [ -d "$HELPERS_DIR" ]; then
    for helper in "$HELPERS_DIR"/*.sh; do
        if [ -f "$helper" ]; then
            source "$helper"
            echo "Loaded helper: $(basename "$helper")"
        fi
    done
fi

# Work with data files relative to script location
DATA_DIR="$SCRIPT_DIR/data"
OUTPUT_DIR="$SCRIPT_DIR/output"

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Process files from data directory
if [ -d "$DATA_DIR" ]; then
    for data_file in "$DATA_DIR"/*.txt; do
        if [ -f "$data_file" ]; then
            filename=$(basename "$data_file")
            processed_file="$OUTPUT_DIR/processed_$filename"
            # Process the file (example: convert to uppercase)
            tr '[:lower:]' '[:upper:]' < "$data_file" > "$processed_file"
            echo "Processed: $filename -> processed_$filename"
        fi
    done
fi
```

This example demonstrates loading configuration files, including helper scripts, and processing data files all relative to the script's location.

## Handling Different Execution Contexts

Your script might be executed in various ways, each affecting how paths are resolved:

```bash
#!/bin/bash

# Function to demonstrate different execution contexts
show_execution_context() {
    echo "=== Execution Context ==="
    echo "\$0 (script name): $0"
    echo "\$PWD (current directory): $PWD"
    echo "dirname \$0: $(dirname "$0")"
    echo "BASH_SOURCE[0]: ${BASH_SOURCE[0]}"

    # Get absolute script directory
    SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
    echo "Resolved script directory: $SCRIPT_DIR"
    echo
}

show_execution_context

# Test with different file operations
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
echo "Working with files relative to: $SCRIPT_DIR"

# Example: Create a log file in the script's directory
LOG_FILE="$SCRIPT_DIR/script.log"
echo "$(date): Script executed from $PWD" >> "$LOG_FILE"
echo "Log entry written to: $LOG_FILE"
```

Test this script by running it from different directories to see how the paths behave:

```bash
# Run from script directory
./myscript.sh

# Run from parent directory
subdirectory/myscript.sh

# Run from anywhere with absolute path
/full/path/to/myscript.sh
```

## Error Handling and Validation

Always include proper error handling when working with script directories:

```bash
#!/bin/bash

get_script_directory() {
    local source="${BASH_SOURCE[0]}"
    local dir=""

    # Handle case where BASH_SOURCE is not available
    if [ -z "$source" ]; then
        source="$0"
    fi

    # Resolve symbolic links
    while [ -h "$source" ]; do
        dir=$(cd -P "$(dirname "$source")" 2>/dev/null && pwd)
        if [ $? -ne 0 ]; then
            echo "Error: Cannot determine script directory" >&2
            return 1
        fi
        source=$(readlink "$source")
        [[ $source != /* ]] && source="$dir/$source"
    done

    # Get final directory
    dir=$(cd -P "$(dirname "$source")" 2>/dev/null && pwd)
    if [ $? -ne 0 ] || [ -z "$dir" ]; then
        echo "Error: Cannot determine script directory" >&2
        return 1
    fi

    echo "$dir"
}

# Use the function with error checking
SCRIPT_DIR=$(get_script_directory)
if [ $? -eq 0 ]; then
    echo "Script directory: $SCRIPT_DIR"

    # Verify the directory exists and is readable
    if [ -d "$SCRIPT_DIR" ] && [ -r "$SCRIPT_DIR" ]; then
        echo "Directory is accessible: $SCRIPT_DIR"
    else
        echo "Warning: Script directory is not accessible" >&2
    fi
else
    echo "Failed to determine script directory, using current directory" >&2
    SCRIPT_DIR="$PWD"
fi
```

This approach includes comprehensive error checking and fallback strategies.

## Creating a Reusable Library

You can create a reusable function that handles all edge cases:

```bash
#!/bin/bash

# Library function for getting script directory
# Usage: script_dir=$(get_script_dir)
get_script_dir() {
    local source="${BASH_SOURCE[1]:-${BASH_SOURCE[0]}}"
    local dir=""

    # Handle different shell environments
    if [ -z "$source" ]; then
        if [ -n "$0" ]; then
            source="$0"
        else
            echo "." # fallback to current directory
            return
        fi
    fi

    # Resolve all symbolic links
    while [ -h "$source" ]; do
        dir=$(cd -P "$(dirname "$source")" 2>/dev/null && pwd)
        [ $? -ne 0 ] && { echo "."; return; }
        source=$(readlink "$source" 2>/dev/null)
        [ $? -ne 0 ] && { echo "$dir"; return; }
        [[ $source != /* ]] && source="$dir/$source"
    done

    # Get the final directory
    dir=$(cd -P "$(dirname "$source")" 2>/dev/null && pwd)
    echo "${dir:-.}"
}

# Example usage
SCRIPT_DIR=$(get_script_dir)
echo "This script is located in: $SCRIPT_DIR"

# Use it to source other files
CONFIG_FILE="$SCRIPT_DIR/app.conf"
[ -f "$CONFIG_FILE" ] && source "$CONFIG_FILE"

# Or include other scripts
UTILS_SCRIPT="$SCRIPT_DIR/utils.sh"
[ -f "$UTILS_SCRIPT" ] && source "$UTILS_SCRIPT"
```

Save this function in a utilities file that you can source in other scripts.

## Testing Your Implementation

Create a test script to verify your directory detection works correctly:

```bash
#!/bin/bash

# Test script for directory detection
test_script_dir() {
    local expected_dir="$1"

    # Your directory detection code here
    DETECTED_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

    echo "Expected: $expected_dir"
    echo "Detected: $DETECTED_DIR"

    if [ "$DETECTED_DIR" = "$expected_dir" ]; then
        echo "✓ Test passed"
        return 0
    else
        echo "✗ Test failed"
        return 1
    fi
}

# Run the test
ACTUAL_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
test_script_dir "$ACTUAL_DIR"
```

Test your implementation with symbolic links and different execution paths to ensure it works reliably.

## Next Steps

Now you know how to reliably determine your script's directory location. Consider exploring advanced Bash scripting patterns like creating modular script architectures, implementing proper logging systems, or building configuration management for your scripts. You might also want to look into using these techniques with deployment scripts or automation tools.

Good luck with your scripting projects!
