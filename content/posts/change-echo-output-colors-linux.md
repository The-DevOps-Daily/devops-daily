---
title: 'How to Change Echo Text Colors in Linux Terminal'
excerpt: 'Learn how to colorize your terminal output using ANSI escape codes with the echo command to make scripts more readable and visually appealing.'
category:
  name: 'Linux'
  slug: 'linux'
date: '2024-12-08'
publishedAt: '2024-12-08T16:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Linux
  - bash
  - terminal
  - echo
  - colors
---

Adding colors to your terminal output makes scripts more readable and helps distinguish between different types of messages like errors, warnings, and success notifications. The echo command can display colored text using ANSI escape sequences, which are supported by most modern terminals.

## Prerequisites

You'll need access to a Linux or macOS terminal. The techniques shown work with bash, zsh, and most other shells that support ANSI escape codes.

## Basic Color Syntax

ANSI escape codes start with `\033[` followed by color codes and end with `m`. This command displays red text:

```bash
echo -e "\033[31mThis text is red\033[0m"
```

The `-e` flag enables interpretation of backslash escapes. The `31` represents red, and `\033[0m` resets the color back to default. Without the reset code, all subsequent text would remain colored.

## Standard Text Colors

Linux terminals support eight standard colors for text. Here's how to use each one:

```bash
echo -e "\033[30mBlack text\033[0m"
echo -e "\033[31mRed text\033[0m"
echo -e "\033[32mGreen text\033[0m"
echo -e "\033[33mYellow text\033[0m"
echo -e "\033[34mBlue text\033[0m"
echo -e "\033[35mMagenta text\033[0m"
echo -e "\033[36mCyan text\033[0m"
echo -e "\033[37mWhite text\033[0m"
```

Each number corresponds to a specific color, making it easy to remember common combinations for different message types in your scripts.

## Background Colors

You can also change the background color using codes 40-47. This command creates white text on a red background:

```bash
echo -e "\033[41;37mError: File not found\033[0m"
```

The semicolon separates multiple formatting codes. Background red (41) combined with foreground white (37) creates a prominent error message that stands out in terminal output.

## Bright Color Variants

Most terminals support bright versions of the standard colors using codes 90-97 for text and 100-107 for backgrounds:

```bash
echo -e "\033[92mBright green text\033[0m"
echo -e "\033[101;30mBright red background with black text\033[0m"
```

Bright colors provide more visual variety and can help create hierarchical information displays in your terminal applications.

## Text Formatting Options

Beyond colors, you can apply various text formatting effects:

```bash
echo -e "\033[1mBold text\033[0m"
echo -e "\033[4mUnderlined text\033[0m"
echo -e "\033[7mReverse video (inverted)\033[0m"
echo -e "\033[2mDim text\033[0m"
```

These formatting options work independently or in combination with colors to create visually distinct output for different purposes.

## Creating Reusable Color Variables

For scripts that use colors frequently, define variables to make your code cleaner and more maintainable:

```bash
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${RED}Error: Operation failed${NC}"
echo -e "${GREEN}Success: File uploaded${NC}"
echo -e "${YELLOW}Warning: Low disk space${NC}"
```

This approach makes your scripts more readable and allows you to change color schemes by modifying the variable definitions in one place.

## Building a Status Function

You can create a reusable function for consistent status messages throughout your scripts:

```bash
print_status() {
    case $1 in
        "error")
            echo -e "\033[1;31m[ERROR]\033[0m $2"
            ;;
        "success")
            echo -e "\033[1;32m[SUCCESS]\033[0m $2"
            ;;
        "warning")
            echo -e "\033[1;33m[WARNING]\033[0m $2"
            ;;
        "info")
            echo -e "\033[1;34m[INFO]\033[0m $2"
            ;;
    esac
}

# Usage examples
print_status "error" "Configuration file missing"
print_status "success" "Database connection established"
print_status "warning" "Using default settings"
print_status "info" "Processing 150 files"
```

This function provides consistent formatting across your application and makes it easy to change the color scheme later.

## Color Support Detection

Not all terminals support colors. You can check for color support before applying formatting:

```bash
if [ -t 1 ] && command -v tput >/dev/null 2>&1; then
    if [ $(tput colors) -ge 8 ]; then
        RED='\033[0;31m'
        GREEN='\033[0;32m'
        NC='\033[0m'
    else
        RED=''
        GREEN=''
        NC=''
    fi
else
    RED=''
    GREEN=''
    NC=''
fi
```

This code checks if the output is a terminal and if it supports at least 8 colors before setting color variables, ensuring your scripts work in any environment.

## Using tput for Portable Colors

The `tput` command provides a more portable way to handle terminal capabilities:

```bash
echo "$(tput setaf 1)Red text$(tput sgr0)"
echo "$(tput setaf 2)Green text$(tput sgr0)"
echo "$(tput bold)Bold text$(tput sgr0)"
```

The `setaf` command sets foreground color, while `sgr0` resets all formatting. This approach works more reliably across different terminal types.

## Progress Indicators with Colors

Colors enhance progress indicators and status displays. This example shows a simple progress bar:

```bash
for i in {1..10}; do
    printf "\033[32m█\033[0m"
    sleep 0.1
done
echo -e "\n\033[1;32mComplete!\033[0m"
```

The green blocks create a visual progress indicator, with a bold green completion message that clearly signals the end of the operation.

## Next Steps

You can now create visually appealing terminal output that improves the user experience of your scripts. Consider exploring more advanced features like 256-color support, RGB colors in modern terminals, or terminal libraries like `rich` for Python if you need more sophisticated formatting capabilities.

Good luck with your colorful terminals!
