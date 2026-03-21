---
title: 'How to Change the Output Color of Echo in Linux'
excerpt: 'Learn how to add colors to your echo output in Linux and Bash scripts using ANSI escape codes, tput commands, and color variables for better terminal display.'
category:
  name: 'Linux'
  slug: 'linux'
date: '2024-08-14'
publishedAt: '2024-08-14T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Linux
  - Bash
  - Terminal
  - Colors
  - Echo
---

Adding colors to your terminal output makes scripts more readable, helps highlight important information, and improves the overall user experience. Whether you're creating status messages, error alerts, or interactive prompts, colored output can make your scripts more professional and user-friendly.

This guide covers multiple methods to colorize your echo output, from basic ANSI escape codes to advanced color management techniques.

## Using ANSI Escape Codes

ANSI escape codes are special sequences that control text formatting in terminals. The basic syntax is `\e[COLORm` or `\033[COLORm`:

```bash
# Basic color examples
echo -e "\e[31mThis is red text\e[0m"
echo -e "\e[32mThis is green text\e[0m"
echo -e "\e[33mThis is yellow text\e[0m"
echo -e "\e[34mThis is blue text\e[0m"
echo -e "\e[35mThis is magenta text\e[0m"
echo -e "\e[36mThis is cyan text\e[0m"
echo -e "\e[37mThis is white text\e[0m"
```

The `-e` flag enables interpretation of backslash escapes, and `\e[0m` resets the color back to default.

## Standard Color Codes

Here are the standard ANSI color codes:

```bash
# Foreground colors (text)
BLACK='\e[30m'
RED='\e[31m'
GREEN='\e[32m'
YELLOW='\e[33m'
BLUE='\e[34m'
MAGENTA='\e[35m'
CYAN='\e[36m'
WHITE='\e[37m'

# Background colors
BG_BLACK='\e[40m'
BG_RED='\e[41m'
BG_GREEN='\e[42m'
BG_YELLOW='\e[43m'
BG_BLUE='\e[44m'
BG_MAGENTA='\e[45m'
BG_CYAN='\e[46m'
BG_WHITE='\e[47m'

# Reset color
RESET='\e[0m'

# Example usage
echo -e "${RED}Error:${RESET} Something went wrong"
echo -e "${GREEN}Success:${RESET} Operation completed"
echo -e "${YELLOW}Warning:${RESET} Check your configuration"
```

## Bright and Bold Colors

You can make colors brighter or add bold formatting:

```bash
# Bright colors (high intensity)
BRIGHT_RED='\e[91m'
BRIGHT_GREEN='\e[92m'
BRIGHT_YELLOW='\e[93m'
BRIGHT_BLUE='\e[94m'
BRIGHT_MAGENTA='\e[95m'
BRIGHT_CYAN='\e[96m'
BRIGHT_WHITE='\e[97m'

# Bold colors
BOLD_RED='\e[1;31m'
BOLD_GREEN='\e[1;32m'
BOLD_YELLOW='\e[1;33m'
BOLD_BLUE='\e[1;34m'

# Examples
echo -e "${BRIGHT_RED}Bright red text${RESET}"
echo -e "${BOLD_GREEN}Bold green text${RESET}"
```

## Using tput for Portable Colors

The `tput` command provides a more portable way to set colors that works across different terminal types:

```bash
# Using tput for colors
red=$(tput setaf 1)
green=$(tput setaf 2)
yellow=$(tput setaf 3)
blue=$(tput setaf 4)
magenta=$(tput setaf 5)
cyan=$(tput setaf 6)
white=$(tput setaf 7)
reset=$(tput sgr0)

# Bold colors
bold=$(tput bold)
bold_red=${bold}$(tput setaf 1)
bold_green=${bold}$(tput setaf 2)

# Examples
echo "${red}This is red text${reset}"
echo "${bold_green}This is bold green text${reset}"
```

## Creating a Color Library

Here's a comprehensive color library for your scripts:

```bash
#!/bin/bash

# Color library using ANSI codes
declare -A COLORS=(
    # Regular colors
    [black]='\e[30m'
    [red]='\e[31m'
    [green]='\e[32m'
    [yellow]='\e[33m'
    [blue]='\e[34m'
    [magenta]='\e[35m'
    [cyan]='\e[36m'
    [white]='\e[37m'

    # Bright colors
    [bright_black]='\e[90m'
    [bright_red]='\e[91m'
    [bright_green]='\e[92m'
    [bright_yellow]='\e[93m'
    [bright_blue]='\e[94m'
    [bright_magenta]='\e[95m'
    [bright_cyan]='\e[96m'
    [bright_white]='\e[97m'

    # Background colors
    [bg_black]='\e[40m'
    [bg_red]='\e[41m'
    [bg_green]='\e[42m'
    [bg_yellow]='\e[43m'
    [bg_blue]='\e[44m'
    [bg_magenta]='\e[45m'
    [bg_cyan]='\e[46m'
    [bg_white]='\e[47m'

    # Text formatting
    [bold]='\e[1m'
    [dim]='\e[2m'
    [underline]='\e[4m'
    [blink]='\e[5m'
    [reverse]='\e[7m'
    [strikethrough]='\e[9m'

    # Reset
    [reset]='\e[0m'
)

# Function to print colored text
print_color() {
    local color="$1"
    local text="$2"
    echo -e "${COLORS[$color]}${text}${COLORS[reset]}"
}

# Usage examples
print_color "red" "This is red text"
print_color "bold" "This is bold text"
print_color "bg_yellow" "This has a yellow background"
```

## Status Message Functions

Create reusable functions for common status messages:

```bash
#!/bin/bash

# Color definitions
RED='\e[31m'
GREEN='\e[32m'
YELLOW='\e[33m'
BLUE='\e[34m'
MAGENTA='\e[35m'
CYAN='\e[36m'
BOLD='\e[1m'
RESET='\e[0m'

# Status message functions
success() {
    echo -e "${GREEN}✓${RESET} ${BOLD}SUCCESS:${RESET} $1"
}

error() {
    echo -e "${RED}✗${RESET} ${BOLD}ERROR:${RESET} $1" >&2
}

warning() {
    echo -e "${YELLOW}⚠${RESET} ${BOLD}WARNING:${RESET} $1"
}

info() {
    echo -e "${BLUE}ℹ${RESET} ${BOLD}INFO:${RESET} $1"
}

debug() {
    echo -e "${MAGENTA}🐛${RESET} ${BOLD}DEBUG:${RESET} $1"
}

# Usage examples
success "Database connection established"
error "Failed to connect to server"
warning "Configuration file not found, using defaults"
info "Processing 1000 records"
debug "Variable value: $HOME"
```

## Progress Indicators with Colors

Create colorful progress indicators:

```bash
#!/bin/bash

# Progress bar with colors
show_progress() {
    local current="$1"
    local total="$2"
    local task_name="$3"

    local percentage=$((current * 100 / total))
    local completed=$((percentage / 2))  # Scale to 50 chars
    local remaining=$((50 - completed))

    # Color based on progress
    local color
    if [ $percentage -lt 33 ]; then
        color='\e[31m'  # Red
    elif [ $percentage -lt 66 ]; then
        color='\e[33m'  # Yellow
    else
        color='\e[32m'  # Green
    fi

    printf "\r${task_name}: ["
    printf "${color}%*s" $completed | tr ' ' '█'
    printf '\e[0m%*s' $remaining | tr ' ' '░'
    printf "] %d%%" $percentage
}

# Example usage
for i in {1..100}; do
    show_progress $i 100 "Processing files"
    sleep 0.1
done
echo  # New line after completion
```

## Interactive Menus with Colors

Create colorful interactive menus:

```bash
#!/bin/bash

show_menu() {
    clear
    echo -e "\e[1;36m"
    echo "╔═══════════════════════════════════╗"
    echo "║           MAIN MENU               ║"
    echo "╚═══════════════════════════════════╝"
    echo -e "\e[0m"

    echo -e "\e[32m1)\e[0m Install packages"
    echo -e "\e[33m2)\e[0m Update system"
    echo -e "\e[34m3)\e[0m Show system info"
    echo -e "\e[35m4)\e[0m View logs"
    echo -e "\e[31m5)\e[0m Exit"
    echo
    echo -e "\e[1mPlease select an option:\e[0m "
}

# Menu handling
while true; do
    show_menu
    read -r choice

    case $choice in
        1) echo -e "\e[32mInstalling packages...\e[0m" ;;
        2) echo -e "\e[33mUpdating system...\e[0m" ;;
        3) echo -e "\e[34mShowing system info...\e[0m" ;;
        4) echo -e "\e[35mViewing logs...\e[0m" ;;
        5) echo -e "\e[31mGoodbye!\e[0m"; exit 0 ;;
        *) echo -e "\e[31mInvalid option. Please try again.\e[0m" ;;
    esac

    echo -e "\nPress Enter to continue..."
    read
done
```

## Conditional Coloring

Add colors based on conditions:

```bash
#!/bin/bash

check_service_status() {
    local service="$1"

    if systemctl is-active --quiet "$service"; then
        echo -e "${service}: ${GREEN}RUNNING${RESET}"
    elif systemctl is-enabled --quiet "$service"; then
        echo -e "${service}: ${YELLOW}STOPPED${RESET} (enabled)"
    else
        echo -e "${service}: ${RED}DISABLED${RESET}"
    fi
}

# Check multiple services
services=("nginx" "apache2" "mysql" "postgresql")
echo -e "${BOLD}Service Status:${RESET}"
for service in "${services[@]}"; do
    check_service_status "$service"
done
```

## Color Detection and Fallback

Detect if the terminal supports colors:

```bash
#!/bin/bash

# Check if terminal supports colors
setup_colors() {
    if [[ -t 1 ]] && command -v tput > /dev/null 2>&1; then
        local colors=$(tput colors 2>/dev/null || echo 0)
        if [[ $colors -ge 8 ]]; then
            # Terminal supports colors
            RED='\e[31m'
            GREEN='\e[32m'
            YELLOW='\e[33m'
            BLUE='\e[34m'
            BOLD='\e[1m'
            RESET='\e[0m'
        else
            # No color support
            RED=''
            GREEN=''
            YELLOW=''
            BLUE=''
            BOLD=''
            RESET=''
        fi
    else
        # Output is redirected or tput unavailable
        RED=''
        GREEN=''
        YELLOW=''
        BLUE=''
        BOLD=''
        RESET=''
    fi
}

# Initialize colors
setup_colors

# Usage (works with or without color support)
echo -e "${GREEN}This will be green if supported${RESET}"
echo -e "${RED}This will be red if supported${RESET}"
```

## Best Practices

1. **Always reset colors** after colored text to avoid affecting subsequent output
2. **Use the `-e` flag** with echo to enable escape sequence interpretation
3. **Test on different terminals** to ensure compatibility
4. **Provide fallbacks** for terminals that don't support colors
5. **Use semantic functions** like `success()`, `error()` for consistency
6. **Consider accessibility** - don't rely solely on color to convey information
7. **Store colors in variables** for easy maintenance and consistency

Adding colors to your terminal output enhances the user experience and makes your scripts more professional. Whether you use ANSI escape codes, tput commands, or create comprehensive color libraries, these techniques will help you create more engaging and informative command-line applications.
