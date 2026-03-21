---
title: 'How to Prompt for Yes/No/Cancel Input in a Linux Shell Script'
excerpt: 'Learn different techniques for creating interactive prompts in your shell scripts, from simple yes/no confirmations to three-way choices with proper input validation and user-friendly interfaces.'
category:
  name: 'Bash'
  slug: 'bash'
date: '2024-08-22'
publishedAt: '2024-08-22T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Bash
  - Shell Scripting
  - User Input
  - Linux
  - DevOps
---

## TLDR

To prompt for user input in shell scripts, use the `read` command with a `while` loop to validate responses. For yes/no questions, check for "y" or "n". For yes/no/cancel choices, add a third option like "c" or allow the user to press Ctrl+C. Proper validation and clear prompts make your scripts more user-friendly and prevent accidental destructive operations.

## Simple Yes/No Prompt

The most common interactive prompt asks the user to confirm an action. Here's a basic implementation that keeps asking until it gets a valid response:

```bash
#!/bin/bash

while true; do
    read -p "Do you want to continue? (y/n): " answer
    case $answer in
        [Yy]* )
            echo "Proceeding..."
            break
            ;;
        [Nn]* )
            echo "Cancelled."
            exit 0
            ;;
        * )
            echo "Please answer y or n."
            ;;
    esac
done

echo "Continuing with the rest of the script"
```

The `read -p` command displays a prompt and waits for user input. The case statement matches the first character against "Y" or "y" for yes, "N" or "n" for no, and anything else triggers a retry message.

This pattern is useful before destructive operations like deleting files or dropping databases. The loop makes sure the user can't accidentally bypass the confirmation by pressing Enter.

## Yes/No with Default Option

Sometimes you want to provide a default choice that activates when the user just presses Enter:

```bash
#!/bin/bash

read -p "Delete all logs? (y/N): " answer
answer=${answer:-N}

case $answer in
    [Yy]* )
        echo "Deleting logs..."
        rm -rf /var/log/app/*.log
        ;;
    [Nn]* )
        echo "Keeping logs."
        ;;
    * )
        echo "Invalid input. Keeping logs."
        ;;
esac
```

The `${answer:-N}` syntax sets "N" as the default if the user enters nothing. The capital "N" in the prompt "(y/N)" signals to users that "no" is the default action.

## Three-Way Choice: Yes/No/Cancel

For more complex scenarios, you might need a three-way choice where "cancel" differs from "no". This is common in scripts where "no" means "skip this step" but "cancel" means "abort the entire operation":

```bash
#!/bin/bash

while true; do
    read -p "Deploy to production? (y/n/c): " answer
    case $answer in
        [Yy]* )
            echo "Deploying to production..."
            DEPLOY_ENV="production"
            break
            ;;
        [Nn]* )
            echo "Switching to staging deployment..."
            DEPLOY_ENV="staging"
            break
            ;;
        [Cc]* )
            echo "Deployment cancelled."
            exit 0
            ;;
        * )
            echo "Please answer y (yes), n (no), or c (cancel)."
            ;;
    esac
done

echo "Deploying to $DEPLOY_ENV environment"
# Deployment logic continues here
```

This approach gives users three distinct paths through your script. The logic flow becomes:

```
Display prompt
     |
     v
Wait for input
     |
     v
Validate input
     |
     +---> Invalid? --> Show error, loop back
     |
     v
   Valid
     |
     +---> Yes? --> Set action & continue
     |
     +---> No? --> Set alternate action & continue
     |
     +---> Cancel? --> Exit script
```

## Using Select for Menu-Style Prompts

Bash's built-in `select` command provides a cleaner interface for multiple choices:

```bash
#!/bin/bash

echo "Choose deployment target:"
select environment in "Production" "Staging" "Development" "Cancel"; do
    case $environment in
        "Production")
            echo "Deploying to production..."
            break
            ;;
        "Staging")
            echo "Deploying to staging..."
            break
            ;;
        "Development")
            echo "Deploying to development..."
            break
            ;;
        "Cancel")
            echo "Deployment cancelled."
            exit 0
            ;;
        *)
            echo "Invalid selection. Please enter a number from the menu."
            ;;
    esac
done

echo "Selected: $environment"
```

When you run this script, it displays:

```
Choose deployment target:
1) Production
2) Staging
3) Development
4) Cancel
#?
```

Users enter a number instead of typing the full option. This reduces typing errors and looks more professional.

## Timeout-Based Prompts

In automated environments, you might want the script to proceed automatically if no one responds within a certain time:

```bash
#!/bin/bash

echo "Starting service update in 10 seconds..."
echo "Press 'n' to cancel or wait to continue automatically."

if read -t 10 -n 1 -p "" answer; then
    if [[ $answer =~ ^[Nn]$ ]]; then
        echo -e "\nUpdate cancelled."
        exit 0
    fi
fi

echo -e "\nProceeding with update..."
# Update logic here
```

The `-t 10` option gives the user 10 seconds to respond. The `-n 1` option means `read` will return after a single character, so users don't need to press Enter. If the timeout expires with no input, the script continues automatically.

This pattern works well for deployment scripts running in CI/CD pipelines where you want manual override capability but don't want to block automation indefinitely.

## Practical Example: Database Backup Script

Here's a complete example that combines these techniques in a database backup script:

```bash
#!/bin/bash

DB_NAME="production_db"
BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql"

# Check if backup already exists from today
TODAY=$(date +%Y%m%d)
if ls "$BACKUP_DIR"/${DB_NAME}_${TODAY}* 1> /dev/null 2>&1; then
    echo "Warning: A backup from today already exists."
    while true; do
        read -p "Create another backup? (y/n/c): " answer
        case $answer in
            [Yy]* )
                echo "Creating new backup..."
                break
                ;;
            [Nn]* )
                echo "Using existing backup."
                exit 0
                ;;
            [Cc]* )
                echo "Operation cancelled."
                exit 0
                ;;
            * )
                echo "Please answer y (yes), n (no), or c (cancel)."
                ;;
        esac
    done
fi

# Confirm production database backup
echo "About to backup database: $DB_NAME"
echo "Backup location: $BACKUP_FILE"

select choice in "Proceed" "Skip compression" "Cancel"; do
    case $choice in
        "Proceed")
            echo "Creating compressed backup..."
            pg_dump "$DB_NAME" | gzip > "${BACKUP_FILE}.gz"
            echo "Backup completed: ${BACKUP_FILE}.gz"
            break
            ;;
        "Skip compression")
            echo "Creating uncompressed backup..."
            pg_dump "$DB_NAME" > "$BACKUP_FILE"
            echo "Backup completed: $BACKUP_FILE"
            break
            ;;
        "Cancel")
            echo "Backup cancelled."
            exit 0
            ;;
        *)
            echo "Invalid selection."
            ;;
    esac
done

# Ask about cleanup
while true; do
    read -p "Delete backups older than 30 days? (y/N): " cleanup
    cleanup=${cleanup:-N}
    case $cleanup in
        [Yy]* )
            echo "Cleaning old backups..."
            find "$BACKUP_DIR" -name "${DB_NAME}_*.sql*" -mtime +30 -delete
            echo "Cleanup complete."
            break
            ;;
        [Nn]* )
            echo "Keeping all backups."
            break
            ;;
        * )
            echo "Please answer y or n."
            ;;
    esac
done

echo "Backup script finished successfully."
```

This script demonstrates multiple prompt styles: yes/no/cancel for confirmation, select for choosing backup type, and yes/no with default for the optional cleanup step.

## Handling Ctrl+C Gracefully

Users might press Ctrl+C at any time during prompts. You can trap this signal to perform cleanup:

```bash
#!/bin/bash

cleanup() {
    echo -e "\n\nScript interrupted. Cleaning up..."
    # Perform cleanup here
    exit 130
}

trap cleanup SIGINT

while true; do
    read -p "Enter configuration (or Ctrl+C to abort): " config
    if [ -n "$config" ]; then
        echo "Processing: $config"
        break
    fi
    echo "Input cannot be empty."
done

trap - SIGINT
echo "Configuration complete."
```

The `trap` command catches the SIGINT signal (Ctrl+C) and runs your cleanup function instead of terminating immediately. Exit code 130 is the conventional code for script termination by Ctrl+C.

When designing interactive scripts, think about the user experience. Clear prompts, sensible defaults, and proper validation make scripts feel professional and prevent costly mistakes. Keep prompts concise and make the expected input format obvious through your prompt text and examples.
