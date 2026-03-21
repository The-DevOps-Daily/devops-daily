---
title: 'How to Check for Input Arguments in Bash Shell Scripts'
excerpt: 'Learn different methods to validate command-line arguments in your Bash scripts, from simple existence checks to handling optional and required parameters with practical examples.'
category:
  name: 'Bash'
  slug: 'bash'
date: '2024-09-15'
publishedAt: '2024-09-15T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Bash
  - Shell Scripting
  - Command Line
  - DevOps
  - Linux
---

## TLDR

You can check if an argument exists in a Bash script using `$#` to count arguments, `$1`, `$2`, etc. to access specific arguments, and conditional tests like `[ -z "$1" ]` to verify if they're empty. Proper argument validation prevents your scripts from failing unexpectedly and provides better user feedback.

## Why Validate Input Arguments?

When you write shell scripts that accept parameters, you need to verify that users provided the required inputs before processing them. Without validation, your script might fail partway through execution or produce incorrect results if arguments are missing.

Consider this simple backup script that needs a directory path:

```bash
#!/bin/bash

# This script is fragile - what if $1 is empty?
tar -czf backup.tar.gz "$1"
echo "Backup created for $1"
```

If someone runs this script without providing a directory, `tar` will either fail or create an empty archive. Let's look at better approaches.

## Checking if Any Arguments Were Provided

The `$#` variable holds the count of arguments passed to your script. You can use it to check if the user provided at least one argument:

```bash
#!/bin/bash

if [ $# -eq 0 ]; then
    echo "Error: No arguments provided"
    echo "Usage: $0 <directory>"
    exit 1
fi

echo "Backing up directory: $1"
tar -czf backup.tar.gz "$1"
```

This approach gives you a clear exit point and helpful error message when arguments are missing. The `exit 1` signals that the script failed, which is useful when calling it from other scripts or CI/CD pipelines.

## Checking for a Specific Argument

Sometimes you need to verify that a particular positional argument exists. Use the `-z` test to check if a variable is empty:

```bash
#!/bin/bash

if [ -z "$1" ]; then
    echo "Error: Missing source directory"
    exit 1
fi

if [ -z "$2" ]; then
    echo "Error: Missing destination directory"
    exit 1
fi

echo "Copying from $1 to $2"
cp -r "$1" "$2"
```

The `-z` test returns true when the string is empty. Note the quotes around `"$1"` - these prevent errors if the variable contains spaces or is undefined.

You can also use `-n` to check if a variable is _not_ empty:

```bash
if [ -n "$1" ]; then
    echo "Processing: $1"
fi
```

## Using Default Values for Optional Arguments

For optional parameters, you can provide fallback values using parameter expansion. The syntax `${VAR:-default}` uses the default if `VAR` is unset or empty:

```bash
#!/bin/bash

# Use 'backup.tar.gz' if no filename is provided
OUTPUT_FILE="${1:-backup.tar.gz}"
COMPRESSION="${2:-9}"

echo "Creating $OUTPUT_FILE with compression level $COMPRESSION"
tar -cz"$COMPRESSION"f "$OUTPUT_FILE" /home/user/documents
```

This pattern keeps your scripts flexible while still providing sensible defaults.

## Handling Named Arguments

For scripts with multiple options, positional arguments become hard to manage. Use `getopts` or parse arguments manually:

```bash
#!/bin/bash

while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--directory)
            DIRECTORY="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 -d <directory> -o <output>"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

if [ -z "$DIRECTORY" ]; then
    echo "Error: -d|--directory is required"
    exit 1
fi

OUTPUT="${OUTPUT:-backup.tar.gz}"
echo "Backing up $DIRECTORY to $OUTPUT"
```

This approach gives you more flexibility in how users invoke your script. They can provide arguments in any order and use descriptive flags.

The flow of argument checking typically looks like this:

```
Script invoked
     |
     v
Check if required args exist
     |
     +---> Missing? --> Show error & exit
     |
     v
   Present
     |
     v
Apply defaults to optional args
     |
     v
Validate arg values (type, range, etc.)
     |
     v
Process with validated inputs
```

## Combining Multiple Validation Checks

Real-world scripts often need to validate not just existence but also the type and validity of arguments:

```bash
#!/bin/bash

if [ $# -eq 0 ]; then
    echo "Error: Port number required"
    echo "Usage: $0 <port>"
    exit 1
fi

PORT="$1"

# Check if it's a number
if ! [[ "$PORT" =~ ^[0-9]+$ ]]; then
    echo "Error: Port must be a number"
    exit 1
fi

# Check valid port range
if [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
    echo "Error: Port must be between 1 and 65535"
    exit 1
fi

echo "Starting server on port $PORT"
python3 -m http.server "$PORT"
```

This layered validation approach catches different types of input errors and provides specific feedback for each case.

## Practical Example: Deployment Script

Here's a complete example that combines these techniques in a deployment script:

```bash
#!/bin/bash

show_usage() {
    echo "Usage: $0 -e <environment> [-b <branch>] [-v]"
    echo "  -e  Target environment (required): dev, staging, prod"
    echo "  -b  Git branch to deploy (optional, default: main)"
    echo "  -v  Verbose output"
    exit 1
}

VERBOSE=false
BRANCH="main"

while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -b|--branch)
            BRANCH="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            show_usage
            ;;
        *)
            echo "Unknown option: $1"
            show_usage
            ;;
    esac
done

# Validate required argument
if [ -z "$ENVIRONMENT" ]; then
    echo "Error: Environment is required"
    show_usage
fi

# Validate environment value
case $ENVIRONMENT in
    dev|staging|prod)
        ;;
    *)
        echo "Error: Invalid environment. Must be dev, staging, or prod"
        exit 1
        ;;
esac

[ "$VERBOSE" = true ] && echo "Deploying branch $BRANCH to $ENVIRONMENT"

# Deployment logic here
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "Deployment to $ENVIRONMENT complete"
```

This script demonstrates professional-grade argument handling with clear error messages, usage help, and validation of both presence and values.

The key takeaway is to always validate your inputs early in the script. This practice makes your scripts more reliable and easier to troubleshoot when things go wrong. Users get immediate, clear feedback about what they need to fix rather than cryptic error messages from failed commands deep in your script.
