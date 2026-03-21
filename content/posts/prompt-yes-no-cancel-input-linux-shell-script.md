---
title: 'How to Prompt for Yes/No/Cancel Input in Linux Shell Scripts'
excerpt: 'Learn how to create interactive shell scripts that prompt users for confirmation with Yes/No/Cancel options using various techniques and best practices.'
category:
  name: 'Linux'
  slug: 'linux'
date: '2024-12-18'
publishedAt: '2024-12-18T13:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Bash
  - Linux
  - shell scripting
  - user input
  - interactive scripts
---

Creating interactive shell scripts that ask for user confirmation helps prevent accidental operations and makes scripts more user-friendly. Linux provides several methods to prompt for Yes/No/Cancel input, from simple read commands to sophisticated menu systems that handle various user response patterns.

## Prerequisites

You'll need access to a Linux terminal with basic Bash scripting knowledge. These examples work on all systems with Bash, including Linux distributions and macOS.

## Simple Yes/No Prompt

The most basic approach uses the `read` command to capture user input and conditional statements to process the response:

```bash
#!/bin/bash

echo "Do you want to continue? (y/n): "
read -r response

case $response in
    [yY]|[yY][eE][sS])
        echo "Continuing..."
        # Your code here
        ;;
    [nN]|[nN][oO])
        echo "Operation cancelled."
        exit 1
        ;;
    *)
        echo "Invalid response. Please enter y or n."
        exit 1
        ;;
esac
```

This script accepts various forms of yes and no responses, including "y", "yes", "Y", "YES", and their negative counterparts. The case statement provides flexible pattern matching for user input.

## Yes/No/Cancel with Three Options

For operations that need a cancel option distinct from "no", create a three-way prompt:

```bash
#!/bin/bash

prompt_user() {
    while true; do
        echo "Do you want to proceed with the installation?"
        echo "y) Yes, continue"
        echo "n) No, skip this step"
        echo "c) Cancel entire operation"
        read -r -p "Enter your choice [y/n/c]: " choice

        case $choice in
            [yY]|[yY][eE][sS])
                return 0  # Yes
                ;;
            [nN]|[nN][oO])
                return 1  # No
                ;;
            [cC]|[cC][aA][nN][cC][eE][lL])
                return 2  # Cancel
                ;;
            *)
                echo "Invalid option. Please enter y, n, or c."
                ;;
        esac
    done
}

# Usage
prompt_user
result=$?

case $result in
    0)
        echo "User chose: Yes"
        # Continue with installation
        ;;
    1)
        echo "User chose: No"
        # Skip this step but continue script
        ;;
    2)
        echo "User chose: Cancel"
        echo "Operation cancelled by user."
        exit 1
        ;;
esac
```

This function returns different exit codes for each choice, allowing the calling script to handle each response appropriately.

## Default Values and Timeout

For automated environments or when scripts might run unattended, provide default values and timeouts:

```bash
#!/bin/bash

prompt_with_default() {
    local prompt="$1"
    local default="$2"
    local timeout="${3:-30}"

    echo -n "$prompt [default: $default] (timeout: ${timeout}s): "

    if read -r -t "$timeout" response; then
        # User provided input
        response=${response:-$default}
    else
        # Timeout occurred
        echo ""
        echo "No response received. Using default: $default"
        response="$default"
    fi

    case $response in
        [yY]|[yY][eE][sS])
            return 0
            ;;
        [nN]|[nN][oO])
            return 1
            ;;
        *)
            echo "Invalid response '$response'. Using default: $default"
            case $default in
                [yY]|[yY][eE][sS]) return 0 ;;
                *) return 1 ;;
            esac
            ;;
    esac
}

# Usage
if prompt_with_default "Continue with backup?" "yes" 15; then
    echo "Starting backup..."
else
    echo "Backup skipped."
fi
```

This function accepts a default value and timeout, making scripts suitable for both interactive and automated use.

## Using select for Menu-Style Prompts

The `select` command creates numbered menus that are easier for users to navigate:

```bash
#!/bin/bash

echo "Choose an option:"
options=("Yes, proceed" "No, skip" "Cancel operation")

select choice in "${options[@]}"; do
    case $REPLY in
        1)
            echo "You chose: Yes"
            # Proceed with operation
            break
            ;;
        2)
            echo "You chose: No"
            # Skip operation but continue
            break
            ;;
        3)
            echo "You chose: Cancel"
            echo "Operation cancelled."
            exit 1
            ;;
        *)
            echo "Invalid option. Please enter 1, 2, or 3."
            ;;
    esac
done
```

The `select` command automatically numbers the options and handles the prompt display, creating a more user-friendly interface for complex choices.

## Confirmation for Dangerous Operations

For operations that could cause data loss, implement multiple confirmation steps:

```bash
#!/bin/bash

confirm_dangerous_operation() {
    local operation="$1"

    echo "WARNING: You are about to $operation"
    echo "This action cannot be undone!"
    echo ""

    # First confirmation
    read -r -p "Are you sure you want to $operation? (type 'yes' to confirm): " first_response

    if [[ "$first_response" != "yes" ]]; then
        echo "Operation cancelled."
        return 1
    fi

    # Second confirmation
    echo ""
    echo "FINAL WARNING: This will permanently $operation"
    read -r -p "Type 'I understand' to proceed: " second_response

    if [[ "$second_response" != "I understand" ]]; then
        echo "Operation cancelled."
        return 1
    fi

    return 0
}

# Usage
if confirm_dangerous_operation "delete all user data"; then
    echo "Proceeding with deletion..."
    # Dangerous operation here
else
    echo "Operation safely cancelled."
fi
```

This double-confirmation pattern requires users to type specific phrases, reducing the risk of accidental execution of destructive operations.

## Handling Different Input Methods

Some environments might not support interactive input. Create fallback mechanisms:

```bash
#!/bin/bash

get_user_confirmation() {
    local message="$1"
    local default="${2:-no}"

    # Check if running in interactive mode
    if [[ ! -t 0 ]]; then
        echo "Non-interactive mode detected. Using default: $default"
        case $default in
            [yY]|[yY][eE][sS]) return 0 ;;
            *) return 1 ;;
        esac
    fi

    # Check for environment variable override
    if [[ -n "$AUTO_CONFIRM" ]]; then
        echo "Auto-confirmation enabled via environment variable."
        case $AUTO_CONFIRM in
            [yY]|[yY][eE][sS]) return 0 ;;
            *) return 1 ;;
        esac
    fi

    # Interactive prompt
    while true; do
        read -r -p "$message (y/n) [default: $default]: " response
        response=${response:-$default}

        case $response in
            [yY]|[yY][eE][sS]) return 0 ;;
            [nN]|[nN][oO]) return 1 ;;
            *) echo "Please enter y or n." ;;
        esac
    done
}

# Usage examples
# Interactive: script prompts user
# Non-interactive: AUTO_CONFIRM=yes ./script.sh
# Pipe input: echo "yes" | ./script.sh

if get_user_confirmation "Proceed with installation?"; then
    echo "Installing..."
else
    echo "Installation cancelled."
fi
```

This approach handles interactive terminals, environment variable overrides, and piped input, making scripts flexible across different execution environments.

## Creating Reusable Prompt Functions

Build a library of reusable prompt functions for consistent behavior across scripts:

```bash
#!/bin/bash

# Library of prompt functions
source_dir="$(dirname "${BASH_SOURCE[0]}")"

# Simple yes/no with validation
yes_no_prompt() {
    local message="$1"
    local default="${2:-}"

    while true; do
        if [[ -n "$default" ]]; then
            read -r -p "$message (y/n) [default: $default]: " response
            response=${response:-$default}
        else
            read -r -p "$message (y/n): " response
        fi

        case $response in
            [yY]|[yY][eE][sS]) return 0 ;;
            [nN]|[nN][oO]) return 1 ;;
            *) echo "Please enter 'y' for yes or 'n' for no." ;;
        esac
    done
}

# Yes/No/Cancel prompt
yes_no_cancel_prompt() {
    local message="$1"

    while true; do
        echo "$message"
        echo "1) Yes"
        echo "2) No"
        echo "3) Cancel"
        read -r -p "Choose an option [1-3]: " choice

        case $choice in
            1|[yY]|[yY][eE][sS]) return 0 ;;
            2|[nN]|[nN][oO]) return 1 ;;
            3|[cC]|[cC][aA][nN][cC][eE][lL]) return 2 ;;
            *) echo "Invalid choice. Please enter 1, 2, or 3." ;;
        esac
    done
}

# Usage in main script
if yes_no_prompt "Do you want to continue?" "yes"; then
    echo "Continuing..."

    yes_no_cancel_prompt "Save changes before continuing?"
    save_choice=$?

    case $save_choice in
        0) echo "Saving and continuing..." ;;
        1) echo "Continuing without saving..." ;;
        2) echo "Operation cancelled."; exit 1 ;;
    esac
fi
```

These reusable functions provide consistent user experience and reduce code duplication across multiple scripts.

## Visual Enhancements

Add visual elements to make prompts more noticeable and user-friendly:

```bash
#!/bin/bash

# Color codes for visual enhancement
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

enhanced_prompt() {
    local message="$1"
    local level="${2:-info}"

    case $level in
        "warning")
            echo -e "${YELLOW}⚠️  WARNING: $message${NC}"
            ;;
        "danger")
            echo -e "${RED}🚨 DANGER: $message${NC}"
            ;;
        *)
            echo -e "${GREEN}ℹ️  $message${NC}"
            ;;
    esac

    while true; do
        read -r -p "Continue? (y/n): " response
        case $response in
            [yY]|[yY][eE][sS]) return 0 ;;
            [nN]|[nN][oO]) return 1 ;;
            *) echo "Please enter y for yes or n for no." ;;
        esac
    done
}

# Usage
if enhanced_prompt "This will modify system files" "warning"; then
    echo "Proceeding with caution..."
fi

if enhanced_prompt "This will delete all data" "danger"; then
    echo "Executing dangerous operation..."
fi
```

Visual cues help users understand the importance and potential impact of their choices.

## Next Steps

You can now create interactive shell scripts with robust user input handling. Consider exploring more advanced techniques like creating full-screen terminal interfaces with tools like `dialog` or `whiptail`, implementing configuration file-based defaults, or building command-line argument parsing that can override interactive prompts.

Good luck building user-friendly scripts!
