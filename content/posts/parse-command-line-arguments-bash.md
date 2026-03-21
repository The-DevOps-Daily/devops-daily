---
title: 'How to Parse Command Line Arguments in Bash'
excerpt: 'Learn various methods to parse command line arguments in Bash scripts, including positional parameters, getopts, and advanced argument handling techniques.'
category:
  name: 'Linux'
  slug: 'linux'
date: '2024-09-05'
publishedAt: '2024-09-05T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '9 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Bash
  - Scripting
  - Arguments
  - CLI
  - Parameters
---

Command line argument parsing is essential for creating flexible and user-friendly Bash scripts. Whether you're building simple utilities or complex automation tools, proper argument handling makes your scripts more professional and easier to use.

This guide covers multiple methods for parsing command line arguments, from basic positional parameters to advanced option handling with validation and help systems.

## Basic Positional Parameters

The simplest way to handle arguments uses positional parameters (`$1`, `$2`, etc.):

```bash
#!/bin/bash

# Basic argument handling
script_name="$0"
first_arg="$1"
second_arg="$2"
third_arg="$3"

echo "Script name: $script_name"
echo "First argument: $first_arg"
echo "Second argument: $second_arg"
echo "Third argument: $third_arg"
echo "All arguments: $@"
echo "Number of arguments: $#"
```

Special variables for arguments:

- `$0` - Script name
- `$1, $2, $3...` - Individual arguments
- `$@` - All arguments as separate quoted strings
- `$*` - All arguments as a single string
- `$#` - Number of arguments

## Using getopts for Options

The `getopts` builtin provides a standard way to parse short options:

```bash
#!/bin/bash

# Default values
verbose=false
output_file=""
input_file=""

# Parse options
while getopts "vho:i:" opt; do
    case $opt in
        v)
            verbose=true
            ;;
        h)
            echo "Usage: $0 [-v] [-h] [-o output_file] [-i input_file]"
            echo "  -v: Verbose mode"
            echo "  -h: Show help"
            echo "  -o: Output file"
            echo "  -i: Input file"
            exit 0
            ;;
        o)
            output_file="$OPTARG"
            ;;
        i)
            input_file="$OPTARG"
            ;;
        \?)
            echo "Invalid option: -$OPTARG" >&2
            exit 1
            ;;
        :)
            echo "Option -$OPTARG requires an argument" >&2
            exit 1
            ;;
    esac
done

# Shift to remove processed options
shift $((OPTIND-1))

# Remaining arguments are in $@
echo "Verbose: $verbose"
echo "Output file: $output_file"
echo "Input file: $input_file"
echo "Remaining arguments: $@"
```

In the getopts string `"vho:i:"`:

- `v` and `h` are flags (no arguments)
- `o:` and `i:` require arguments (colon after the letter)
- The leading `:` enables silent error reporting

## Manual Long Option Parsing

For long options like `--verbose` or `--output=file`, you need manual parsing:

```bash
#!/bin/bash

# Default values
verbose=false
output_file=""
input_file=""
dry_run=false

# Parse long options
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            verbose=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS] [FILES...]"
            echo "Options:"
            echo "  -v, --verbose       Enable verbose output"
            echo "  -h, --help          Show this help message"
            echo "  -o, --output FILE   Specify output file"
            echo "  -i, --input FILE    Specify input file"
            echo "  --dry-run           Show what would be done"
            exit 0
            ;;
        -o|--output)
            output_file="$2"
            shift 2
            ;;
        --output=*)
            output_file="${1#*=}"
            shift
            ;;
        -i|--input)
            input_file="$2"
            shift 2
            ;;
        --input=*)
            input_file="${1#*=}"
            shift
            ;;
        --dry-run)
            dry_run=true
            shift
            ;;
        --)
            shift
            break
            ;;
        -*)
            echo "Unknown option: $1" >&2
            exit 1
            ;;
        *)
            break
            ;;
    esac
done

# Remaining arguments
remaining_args=("$@")

echo "Configuration:"
echo "  Verbose: $verbose"
echo "  Output file: $output_file"
echo "  Input file: $input_file"
echo "  Dry run: $dry_run"
echo "  Remaining arguments: ${remaining_args[*]}"
```

## Advanced Argument Parser Function

Here's a comprehensive argument parser that handles both short and long options:

```bash
#!/bin/bash

# Configuration variables
declare -A config=(
    [verbose]=false
    [debug]=false
    [output_file]=""
    [input_file]=""
    [workers]=4
    [timeout]=30
)

show_help() {
    cat << EOF
Usage: $0 [OPTIONS] [FILES...]

A sample script demonstrating argument parsing.

OPTIONS:
    -v, --verbose           Enable verbose output
    -d, --debug             Enable debug mode
    -h, --help              Show this help message
    -o, --output FILE       Specify output file
    -i, --input FILE        Specify input file
    -w, --workers NUM       Number of worker processes (default: 4)
    -t, --timeout SEC       Timeout in seconds (default: 30)

EXAMPLES:
    $0 --verbose --output result.txt file1.txt file2.txt
    $0 -v -w 8 --timeout=60 *.log

EOF
}

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--verbose)
                config[verbose]=true
                shift
                ;;
            -d|--debug)
                config[debug]=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            -o|--output)
                if [[ -n "$2" && "$2" != -* ]]; then
                    config[output_file]="$2"
                    shift 2
                else
                    echo "Error: --output requires a filename" >&2
                    exit 1
                fi
                ;;
            --output=*)
                config[output_file]="${1#*=}"
                shift
                ;;
            -i|--input)
                if [[ -n "$2" && "$2" != -* ]]; then
                    config[input_file]="$2"
                    shift 2
                else
                    echo "Error: --input requires a filename" >&2
                    exit 1
                fi
                ;;
            --input=*)
                config[input_file]="${1#*=}"
                shift
                ;;
            -w|--workers)
                if [[ "$2" =~ ^[0-9]+$ ]]; then
                    config[workers]="$2"
                    shift 2
                else
                    echo "Error: --workers requires a number" >&2
                    exit 1
                fi
                ;;
            --workers=*)
                local workers="${1#*=}"
                if [[ "$workers" =~ ^[0-9]+$ ]]; then
                    config[workers]="$workers"
                else
                    echo "Error: --workers requires a number" >&2
                    exit 1
                fi
                shift
                ;;
            -t|--timeout)
                if [[ "$2" =~ ^[0-9]+$ ]]; then
                    config[timeout]="$2"
                    shift 2
                else
                    echo "Error: --timeout requires a number" >&2
                    exit 1
                fi
                ;;
            --timeout=*)
                local timeout="${1#*=}"
                if [[ "$timeout" =~ ^[0-9]+$ ]]; then
                    config[timeout]="$timeout"
                else
                    echo "Error: --timeout requires a number" >&2
                    exit 1
                fi
                shift
                ;;
            --)
                shift
                break
                ;;
            -*)
                echo "Unknown option: $1" >&2
                echo "Try '$0 --help' for more information." >&2
                exit 1
                ;;
            *)
                break
                ;;
        esac
    done

    # Remaining arguments
    files=("$@")
}

# Validation function
validate_arguments() {
    if [[ -n "${config[input_file]}" && ! -f "${config[input_file]}" ]]; then
        echo "Error: Input file '${config[input_file]}' does not exist" >&2
        exit 1
    fi

    if [[ -n "${config[output_file]}" ]]; then
        local output_dir=$(dirname "${config[output_file]}")
        if [[ ! -d "$output_dir" ]]; then
            echo "Error: Output directory '$output_dir' does not exist" >&2
            exit 1
        fi
    fi

    if [[ ${config[workers]} -lt 1 || ${config[workers]} -gt 32 ]]; then
        echo "Error: Workers must be between 1 and 32" >&2
        exit 1
    fi

    if [[ ${config[timeout]} -lt 1 ]]; then
        echo "Error: Timeout must be at least 1 second" >&2
        exit 1
    fi
}

# Main execution
main() {
    parse_arguments "$@"
    validate_arguments

    # Debug output
    if [[ "${config[debug]}" == "true" ]]; then
        echo "Debug: Configuration:"
        for key in "${!config[@]}"; do
            echo "  $key = ${config[$key]}"
        done
        echo "  files = ${files[*]}"
    fi

    # Your main script logic here
    if [[ "${config[verbose]}" == "true" ]]; then
        echo "Processing ${#files[@]} files with ${config[workers]} workers..."
    fi
}

# Run main function
main "$@"
```

## Handling Subcommands

For scripts with subcommands (like git), use this pattern:

```bash
#!/bin/bash

show_help() {
    cat << EOF
Usage: $0 <command> [options]

Commands:
    install     Install packages
    remove      Remove packages
    update      Update package list
    search      Search for packages

Run '$0 <command> --help' for command-specific help.
EOF
}

cmd_install() {
    local force=false
    local packages=()

    while [[ $# -gt 0 ]]; do
        case $1 in
            -f|--force)
                force=true
                shift
                ;;
            -h|--help)
                echo "Usage: $0 install [--force] <packages...>"
                echo "Install one or more packages"
                exit 0
                ;;
            -*)
                echo "Unknown option: $1" >&2
                exit 1
                ;;
            *)
                packages+=("$1")
                shift
                ;;
        esac
    done

    echo "Installing packages: ${packages[*]}"
    echo "Force mode: $force"
}

cmd_remove() {
    local packages=()

    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                echo "Usage: $0 remove <packages...>"
                echo "Remove one or more packages"
                exit 0
                ;;
            -*)
                echo "Unknown option: $1" >&2
                exit 1
                ;;
            *)
                packages+=("$1")
                shift
                ;;
        esac
    done

    echo "Removing packages: ${packages[*]}"
}

# Main command dispatcher
case "$1" in
    install)
        shift
        cmd_install "$@"
        ;;
    remove)
        shift
        cmd_remove "$@"
        ;;
    update)
        echo "Updating package list..."
        ;;
    search)
        shift
        echo "Searching for: $*"
        ;;
    -h|--help|"")
        show_help
        ;;
    *)
        echo "Unknown command: $1" >&2
        echo "Try '$0 --help' for more information." >&2
        exit 1
        ;;
esac
```

## Environment Variable Integration

Combine command line arguments with environment variables:

```bash
#!/bin/bash

# Default values (can be overridden by environment variables)
DEFAULT_HOST="${MYAPP_HOST:-localhost}"
DEFAULT_PORT="${MYAPP_PORT:-8080}"
DEFAULT_DEBUG="${MYAPP_DEBUG:-false}"

# Configuration
host="$DEFAULT_HOST"
port="$DEFAULT_PORT"
debug="$DEFAULT_DEBUG"

while [[ $# -gt 0 ]]; do
    case $1 in
        --host)
            host="$2"
            shift 2
            ;;
        --port)
            port="$2"
            shift 2
            ;;
        --debug)
            debug=true
            shift
            ;;
        --no-debug)
            debug=false
            shift
            ;;
        *)
            echo "Unknown option: $1" >&2
            exit 1
            ;;
    esac
done

echo "Configuration:"
echo "  Host: $host"
echo "  Port: $port"
echo "  Debug: $debug"
```

## Best Practices

1. **Always provide help** with `-h` or `--help` options
2. **Validate arguments** before using them
3. **Use meaningful variable names** for clarity
4. **Handle errors gracefully** with clear error messages
5. **Support both short and long options** for flexibility
6. **Document your script** with usage examples
7. **Use default values** where appropriate
8. **Consider environment variables** for configuration
9. **Implement the `--` separator** to handle filenames starting with dashes
10. **Test edge cases** like empty arguments and special characters

Proper argument parsing makes your Bash scripts more professional and user-friendly. Choose the method that best fits your script's complexity, from simple positional parameters for basic scripts to comprehensive parsers for complex command-line tools.
