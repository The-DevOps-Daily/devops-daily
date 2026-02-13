---
title: 'Shell Scripting Basics'
description: 'Learn how to automate tasks and create powerful tools using Bash shell scripts.'
order: 9
---

Shell scripting is one of the most powerful skills you can develop as a Linux user. By automating repetitive tasks and combining commands into reusable scripts, you can save time, reduce errors, and create sophisticated tools using nothing but the shell.

In this part, we'll explore the fundamentals of shell scripting, focusing on Bash (Bourne Again SHell), the most common shell in Linux distributions.

## Introduction to Shell Scripts

### What is a Shell Script?

A shell script is a text file containing a series of commands that the shell can execute. It allows you to:

- Automate repetitive tasks
- Combine multiple commands into a single program
- Create custom utilities
- Perform system administration tasks
- Process data and files

### Creating Your First Script

Let's create a simple "Hello, World!" script:

1. Open a text editor:

   ```bash
   nano hello.sh
   ```

2. Enter the following text:

   ```bash
   #!/bin/bash

   # This is a comment
   echo "Hello, World!"
   ```

3. Save the file and exit

4. Make the script executable:

   ```bash
   chmod +x hello.sh
   ```

5. Run the script:
   ```bash
   ./hello.sh
   ```

### Understanding the Shebang

The first line `#!/bin/bash` is called a "shebang" or "hashbang." It tells the system which interpreter should execute the script. Common shebangs include:

- `#!/bin/bash` - Bash shell
- `#!/bin/sh` - POSIX-compliant shell
- `#!/usr/bin/python3` - Python 3
- `#!/usr/bin/perl` - Perl

## Variables and Data Types

### Defining Variables

Variables store data that can be referenced and manipulated in a script:

```bash
# Assign a value to a variable
name="Alice"

# Use the variable (note the $ prefix)
echo "Hello, $name!"
```

Variable naming rules:

- Can include letters, numbers, and underscores
- Cannot start with a number
- Are case-sensitive
- No spaces around the equals sign

### Environment Variables

Environment variables are available to all processes:

```bash
# Display environment variables
echo "Your home directory is: $HOME"
echo "Your username is: $USER"
echo "Your path is: $PATH"

# Set an environment variable for the current session
export MY_VARIABLE="some value"
```

### Command Substitution

Capture the output of a command in a variable:

```bash
# Using backticks (older style)
current_date=`date`

# Using $() syntax (preferred)
current_date=$(date)

echo "Current date and time: $current_date"
```

### Special Variables

Bash provides special variables for script information:

```bash
echo "Script name: $0"
echo "First argument: $1"
echo "Second argument: $2"
echo "All arguments: $@"
echo "Number of arguments: $#"
echo "Process ID: $$"
echo "Exit status of last command: $?"
```

## Input and Output

### Command-Line Arguments

Process arguments passed to your script:

```bash
#!/bin/bash

if [ $# -lt 1 ]; then
    echo "Usage: $0 <name>"
    exit 1
fi

echo "Hello, $1!"
```

Run it with:

```bash
./script.sh Alice
```

### Reading User Input

Get input from users interactively:

```bash
#!/bin/bash

echo "What is your name?"
read name

echo "Hello, $name!"
```

Read with a prompt:

```bash
read -p "Enter your name: " name
```

Read a password (no echo):

```bash
read -sp "Enter your password: " password
echo
```

### Redirecting Input and Output

Redirect output to files:

```bash
# Overwrite file
echo "Hello" > file.txt

# Append to file
echo "World" >> file.txt

# Redirect error messages
command 2> errors.log

# Redirect both output and errors
command > output.log 2>&1
```

Read input from a file:

```bash
while read line; do
    echo "Line: $line"
done < input.txt
```

## Conditional Statements

### if-else Statements

Make decisions in your scripts:

```bash
#!/bin/bash

age=25

if [ $age -lt 18 ]; then
    echo "You are a minor."
elif [ $age -ge 18 ] && [ $age -lt 65 ]; then
    echo "You are an adult."
else
    echo "You are a senior."
fi
```

### Comparison Operators

For numbers:

- `-eq` - Equal to
- `-ne` - Not equal to
- `-lt` - Less than
- `-le` - Less than or equal to
- `-gt` - Greater than
- `-ge` - Greater than or equal to

For strings:

- `=` or `==` - Equal to
- `!=` - Not equal to
- `-z` - String is empty
- `-n` - String is not empty

For files:

- `-e` - File exists
- `-f` - Regular file exists
- `-d` - Directory exists
- `-r` - File is readable
- `-w` - File is writable
- `-x` - File is executable

### Logical Operators

Combine conditions:

- `&&` - AND
- `||` - OR
- `!` - NOT

```bash
if [ $age -ge 18 ] && [ $has_id = "yes" ]; then
    echo "You can enter."
fi

if [ ! -f config.txt ]; then
    echo "Config file missing!"
fi
```

### Case Statements

An alternative to multiple if-else statements:

```bash
#!/bin/bash

read -p "Enter a fruit: " fruit

case $fruit in
    "apple")
        echo "Red fruit"
        ;;
    "banana")
        echo "Yellow fruit"
        ;;
    "grape"|"blueberry")
        echo "Purple fruit"
        ;;
    *)
        echo "Unknown fruit"
        ;;
esac
```

## Loops

### For Loops

Iterate over a list of items:

```bash
# Loop through a list
for name in Alice Bob Charlie; do
    echo "Hello, $name!"
done

# Loop through a range of numbers
for i in {1..5}; do
    echo "Number: $i"
done

# C-style for loop
for ((i=1; i<=5; i++)); do
    echo "Count: $i"
done

# Loop through files
for file in *.txt; do
    echo "Processing $file"
done
```

### While Loops

Execute commands while a condition is true:

```bash
#!/bin/bash

count=1

while [ $count -le 5 ]; do
    echo "Count: $count"
    ((count++))
done
```

Read a file line by line:

```bash
while read line; do
    echo "Line: $line"
done < input.txt
```

### Until Loops

Execute commands until a condition becomes true:

```bash
#!/bin/bash

count=1

until [ $count -gt 5 ]; do
    echo "Count: $count"
    ((count++))
done
```

### Loop Control

Control loop execution:

- `break` - Exit the loop
- `continue` - Skip to the next iteration

```bash
for i in {1..10}; do
    if [ $i -eq 3 ]; then
        continue  # Skip 3
    fi

    if [ $i -eq 8 ]; then
        break     # Stop at 8
    fi

    echo "Number: $i"
done
```

## Functions

### Defining Functions

Group commands into reusable units:

```bash
#!/bin/bash

# Define a function
greet() {
    echo "Hello, $1!"
}

# Call the function
greet "Alice"
greet "Bob"
```

Alternative syntax:

```bash
function greet {
    echo "Hello, $1!"
}
```

### Return Values

Functions can return status codes:

```bash
is_even() {
    if [ $(($1 % 2)) -eq 0 ]; then
        return 0  # Success (true)
    else
        return 1  # Failure (false)
    fi
}

if is_even 4; then
    echo "4 is even"
fi

if ! is_even 7; then
    echo "7 is not even"
fi
```

For returning data, use output:

```bash
get_square() {
    echo $(($1 * $1))
}

result=$(get_square 5)
echo "Square of 5 is $result"
```

### Variable Scope

Variables in Bash are global by default:

```bash
#!/bin/bash

my_var="global"

my_function() {
    my_var="changed"  # Changes the global variable
    local local_var="local"  # Local to the function
}

echo "Before: $my_var"
my_function
echo "After: $my_var"
echo "Local: $local_var"  # This will be empty
```

Use `local` to create function-local variables.

## Arrays

### Creating and Accessing Arrays

Work with lists of data:

```bash
# Create an array
fruits=("apple" "banana" "cherry")

# Access elements
echo ${fruits[0]}  # First element
echo ${fruits[1]}  # Second element

# All elements
echo ${fruits[@]}

# Number of elements
echo ${#fruits[@]}

# Add an element
fruits+=("orange")

# Iterate through array
for fruit in "${fruits[@]}"; do
    echo "Fruit: $fruit"
done
```

### Associative Arrays (Dictionaries)

Key-value pairs (Bash 4.0+):

```bash
# Declare an associative array
declare -A user

# Assign values
user[name]="Alice"
user[age]=30
user[city]="New York"

# Access elements
echo "Name: ${user[name]}"
echo "Age: ${user[age]}"

# All keys
echo "Keys: ${!user[@]}"

# All values
echo "Values: ${user[@]}"

# Iterate through key-value pairs
for key in "${!user[@]}"; do
    echo "$key: ${user[$key]}"
done
```

## String Manipulation

### String Operations

Work with text data:

```bash
# String length
string="Hello, World!"
echo ${#string}  # 13

# Substring extraction
echo ${string:7:5}  # "World"

# Replace substring
echo ${string/World/Linux}  # "Hello, Linux!"

# Replace all occurrences
text="apple apple apple"
echo ${text//apple/orange}  # "orange orange orange"

# Remove prefix
echo ${string#Hello, }  # "World!"

# Remove suffix
echo ${string%World!}  # "Hello, "
```

### String Comparison

```bash
if [ "$string1" = "$string2" ]; then
    echo "Strings are equal"
fi

if [[ "$string" == *"World"* ]]; then
    echo "String contains 'World'"
fi

if [[ "$string" =~ ^Hello ]]; then
    echo "String starts with 'Hello'"
fi
```

## Error Handling

### Exit Codes

Scripts return exit codes indicating success (0) or failure (non-zero):

```bash
#!/bin/bash

# Exit with specific code
if [ ! -f "$1" ]; then
    echo "Error: File not found" >&2
    exit 1
fi

# Process the file
echo "Processing $1..."
exit 0
```

### Error Checking

Check command success:

```bash
if ! command; then
    echo "Command failed" >&2
    exit 1
fi
```

Use `set -e` to exit on any error:

```bash
#!/bin/bash
set -e  # Exit immediately if a command fails
```

### Trapping Signals

Handle script interruption:

```bash
#!/bin/bash

# Cleanup function
cleanup() {
    echo "Cleaning up temporary files..."
    rm -f /tmp/tempfile*
    exit 1
}

# Set trap
trap cleanup SIGINT SIGTERM

# Create temp files
touch /tmp/tempfile1 /tmp/tempfile2

# Long-running process
echo "Running... (Press Ctrl+C to interrupt)"
sleep 30

# Normal cleanup
cleanup
```

## Command-Line Parsing

### Basic Argument Handling

Parse arguments manually:

```bash
#!/bin/bash

if [ $# -lt 2 ]; then
    echo "Usage: $0 <source> <destination>"
    exit 1
fi

source=$1
destination=$2

echo "Copying from $source to $destination"
```

### Parsing Options with getopts

Handle command-line options:

```bash
#!/bin/bash

usage() {
    echo "Usage: $0 [-v] [-f filename] [-n number]"
    exit 1
}

verbose=false
filename=""
number=0

while getopts ":vf:n:" opt; do
    case ${opt} in
        v )
            verbose=true
            ;;
        f )
            filename=$OPTARG
            ;;
        n )
            number=$OPTARG
            ;;
        \? )
            echo "Invalid option: $OPTARG" 1>&2
            usage
            ;;
        : )
            echo "Option -$OPTARG requires an argument." 1>&2
            usage
            ;;
    esac
done
shift $((OPTIND -1))

echo "Verbose: $verbose"
echo "Filename: $filename"
echo "Number: $number"
echo "Remaining arguments: $@"
```

## Practical Scripting Examples

Let's apply what we've learned with some useful scripts:

### Backup Script

```bash
#!/bin/bash

# Configuration
backup_dir="/backup"
source_dir="/home/user/documents"
date_format=$(date +%Y-%m-%d)
backup_file="backup-$date_format.tar.gz"

# Ensure backup directory exists
mkdir -p "$backup_dir"

# Create backup
echo "Creating backup of $source_dir..."
tar -czf "$backup_dir/$backup_file" "$source_dir"

# Check if backup was successful
if [ $? -eq 0 ]; then
    echo "Backup completed successfully: $backup_dir/$backup_file"

    # List existing backups
    echo "Existing backups:"
    ls -lh "$backup_dir"

    # Remove backups older than 30 days
    find "$backup_dir" -name "backup-*.tar.gz" -mtime +30 -delete
else
    echo "Backup failed!" >&2
    exit 1
fi
```

### System Monitoring Script

```bash
#!/bin/bash

# Function to display header
print_header() {
    echo "========================================"
    echo "    System Monitoring - $(date)"
    echo "========================================"
}

# Function to check disk usage
check_disk() {
    echo "DISK USAGE:"
    df -h | grep -v "tmpfs" | grep -v "Filesystem"

    # Alert if any partition is over 90% full
    critical=$(df -h | grep -v "tmpfs" | awk '$5 > 90 {print $5 " - " $1}')

    if [ ! -z "$critical" ]; then
        echo "WARNING: The following partitions are nearly full:"
        echo "$critical"
    fi

    echo
}

# Function to check memory usage
check_memory() {
    echo "MEMORY USAGE:"
    free -h
    echo
}

# Function to check load average
check_load() {
    echo "LOAD AVERAGE:"
    uptime

    # Get number of cores
    cores=$(nproc)

    # Get 5-minute load average
    load_5min=$(uptime | awk -F'load average: ' '{print $2}' | awk -F', ' '{print $2}')

    # Check if load exceeds number of cores
    if (( $(echo "$load_5min > $cores" | bc -l) )); then
        echo "WARNING: Load average ($load_5min) exceeds number of cores ($cores)"
    fi

    echo
}

# Function to check running processes
check_processes() {
    echo "TOP 5 CPU-INTENSIVE PROCESSES:"
    ps aux --sort=-%cpu | head -6
    echo

    echo "TOP 5 MEMORY-INTENSIVE PROCESSES:"
    ps aux --sort=-%mem | head -6
    echo
}

# Main function
main() {
    print_header
    check_disk
    check_memory
    check_load
    check_processes

    echo "Report completed at $(date)"
}

# Run the script
main
```

### File Processing Script

```bash
#!/bin/bash

# Check arguments
if [ $# -ne 2 ]; then
    echo "Usage: $0 <source_directory> <backup_directory>"
    exit 1
fi

source_dir="$1"
backup_dir="$2"

# Validate directories
if [ ! -d "$source_dir" ]; then
    echo "Error: Source directory does not exist: $source_dir" >&2
    exit 1
fi

# Create backup directory if it doesn't exist
mkdir -p "$backup_dir"

# Counter for processed files
processed=0

# Process each text file
for file in "$source_dir"/*.txt; do
    # Skip if no files match
    [ -e "$file" ] || continue

    filename=$(basename "$file")
    echo "Processing: $filename"

    # Create a backup
    cp "$file" "$backup_dir/${filename}.bak"

    # Convert to uppercase and save
    tr '[:lower:]' '[:upper:]' < "$file" > "$backup_dir/${filename}.upper"

    # Count words
    word_count=$(wc -w < "$file")
    echo "  Word count: $word_count" >> "$backup_dir/summary.log"

    ((processed++))
done

echo "Processed $processed files. Summary saved to $backup_dir/summary.log"
```

### Website Monitor Script

```bash
#!/bin/bash

# Configuration
websites=("https://www.example.com" "https://www.google.com" "https://www.github.com")
log_file="/var/log/website_monitor.log"
email="admin@example.com"

# Function to check a website
check_website() {
    local url="$1"
    local timestamp=$(date +"%Y-%m-%d %H:%M:%S")

    # Get HTTP status code
    status_code=$(curl -s -o /dev/null -w "%{http_code}" "$url")

    # Check if status code is 200 (OK)
    if [ "$status_code" -eq 200 ]; then
        echo "[$timestamp] SUCCESS: $url returned status code $status_code" | tee -a "$log_file"
        return 0
    else
        echo "[$timestamp] ERROR: $url returned status code $status_code" | tee -a "$log_file"
        return 1
    fi
}

# Function to send email alert
send_alert() {
    local url="$1"
    local status="$2"

    echo "Website $url is down (Status: $status)" | mail -s "Website Down Alert" "$email"
    echo "Alert sent to $email" | tee -a "$log_file"
}

# Main function
main() {
    echo "Starting website monitoring at $(date)" | tee -a "$log_file"

    for site in "${websites[@]}"; do
        echo "Checking $site..." | tee -a "$log_file"
        if ! check_website "$site"; then
            send_alert "$site" "$status_code"
        fi

        # Sleep between checks to avoid hammering the servers
        sleep 2
    done

    echo "Monitoring completed at $(date)" | tee -a "$log_file"
    echo "-----------------------------------------" | tee -a "$log_file"
}

# Create log file if it doesn't exist
touch "$log_file"

# Run the script
main
```

## Beyond Bash: Alternative Shells

While Bash is the most common shell, there are other options:

### Zsh (Z Shell)

A powerful shell with improved features:

- Better tab completion
- Spelling correction
- Path expansion
- Themeable prompts with Oh-My-Zsh

Convert Bash script to Zsh:

```bash
#!/bin/zsh

# Most Bash scripts work in Zsh
# Zsh-specific features include:
setopt extended_glob
setopt null_glob

# Array indices start at 1 in Zsh
array=(one two three)
echo ${array[1]}  # Prints "one" in Zsh (would be empty in Bash)
```

### Fish (Friendly Interactive Shell)

A user-friendly shell with modern features:

- Syntax highlighting
- Auto-suggestions
- Web-based configuration

Fish script example:

```bash
#!/usr/bin/fish

# Define a function
function greet
    echo "Hello, $argv[1]!"
end

# Call the function
greet "World"

# Fish-specific loop syntax
for i in (seq 1 5)
    echo "Number: $i"
end
```

## Shell Script Best Practices

### Script Organization

- Start with a shebang (`#!/bin/bash`)
- Add a descriptive comment block at the top
- Define constants and configuration at the beginning
- Create functions for reusable code
- Include a `main` function to organize the script flow

### Error Handling

- Check return codes for commands
- Use `set -e` to exit on errors
- Provide helpful error messages with context
- Clean up temporary files with trap

### Security Considerations

- Validate and sanitize input
- Use full paths for commands when possible
- Avoid using `eval` with user input
- Set restrictive permissions on scripts
- Use read-only variables when appropriate: `readonly PASSWORD="secret"`

### Performance

- Minimize external commands in loops
- Use built-in commands when available
- Use process substitution instead of pipes when appropriate
- Consider using arrays instead of string parsing

### Script Templates

Here's a template for a well-structured script:

```bash
#!/bin/bash
#
# Script: example.sh
# Description: A template for shell scripts
# Author: Your Name
# Date: 2025-05-17
#
# Usage: ./example.sh [options] <argument>

# Exit on error
set -e

# Script constants
readonly PROGNAME=$(basename "$0")
readonly ARGS=("$@")

# Configuration
config_file="/etc/example.conf"
temp_dir="/tmp/example_$$"

# Function to display usage
usage() {
    cat << EOF
Usage: $PROGNAME [OPTIONS] <argument>

Options:
  -h, --help      Display this help message
  -v, --verbose   Enable verbose output
  -f FILE         Specify input file

Example:
  $PROGNAME -v -f input.txt

EOF
}

# Function to log messages
log() {
    local level="$1"
    shift
    echo "[$level] $*"
}

# Function to clean up temporary files
cleanup() {
    log "INFO" "Cleaning up..."
    rm -rf "$temp_dir"
}

# Set up trap to clean up on exit
trap cleanup EXIT

# Function to process arguments
process_args() {
    # Create temp directory
    mkdir -p "$temp_dir"

    # Process the main argument
    log "INFO" "Processing argument: $1"
    # Main logic here...
}

# Main function
main() {
    # Parse options
    local verbose=false
    local file=""

    while (( $# > 0 )); do
        case "$1" in
            -h|--help)
                usage
                exit 0
                ;;
            -v|--verbose)
                verbose=true
                shift
                ;;
            -f)
                file="$2"
                shift 2
                ;;
            -*)
                log "ERROR" "Unknown option: $1"
                usage
                exit 1
                ;;
            *)
                break
                ;;
        esac
    done

    if [[ $verbose == true ]]; then
        log "INFO" "Verbose mode enabled"
    fi

    if [[ -n "$file" ]]; then
        log "INFO" "Using file: $file"
    fi

    # Check for required arguments
    if (( $# < 1 )); then
        log "ERROR" "Missing required argument"
        usage
        exit 1
    fi

    # Process arguments
    process_args "$1"

    log "INFO" "Script completed successfully"
}

# Run the script
main "${ARGS[@]}"
```

## Shell Scripting in the Cloud

Shell scripts are extremely valuable for cloud automation. Here's an example of how you might use shell scripting on a DigitalOcean Droplet:

1. Sign up for a DigitalOcean account (use [this link](https://www.jdoqocy.com/click-101674709-15836238) to receive $200 in credits for 60 days)
2. Create a new Droplet
3. Create this automation script:

```bash
#!/bin/bash
#
# server_setup.sh - Automate web server setup on a new DigitalOcean Droplet
#

set -e

# Configuration
APP_USER="webapp"
DOMAIN="example.com"
REPO_URL="https://github.com/yourusername/your-app.git"

# Log function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Update system and install dependencies
setup_system() {
    log "Updating system packages..."
    apt-get update
    apt-get upgrade -y

    log "Installing dependencies..."
    apt-get install -y nginx nodejs npm certbot python3-certbot-nginx git

    # Enable firewall
    log "Configuring firewall..."
    ufw allow OpenSSH
    ufw allow 'Nginx Full'
    ufw --force enable
}

# Create application user
create_user() {
    log "Creating application user..."
    useradd -m -s /bin/bash "$APP_USER"

    log "Setting up deployment directory..."
    mkdir -p /var/www/$DOMAIN
    chown -R "$APP_USER":"$APP_USER" /var/www/$DOMAIN
}

# Configure Nginx
setup_nginx() {
    log "Configuring Nginx..."
    cat > /etc/nginx/sites-available/$DOMAIN << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    root /var/www/$DOMAIN/public;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

    ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
    nginx -t
    systemctl restart nginx
}

# Deploy application
deploy_app() {
    log "Deploying application..."
    su - "$APP_USER" -c "git clone $REPO_URL /var/www/$DOMAIN"

    log "Installing dependencies and building application..."
    cd /var/www/$DOMAIN
    su - "$APP_USER" -c "cd /var/www/$DOMAIN && npm install && npm run build"

    log "Setting up application service..."
    cat > /etc/systemd/system/webapp.service << EOF
[Unit]
Description=Web Application
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=/var/www/$DOMAIN
ExecStart=/usr/bin/npm start
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

    systemctl enable webapp
    systemctl start webapp
}

# Setup SSL
setup_ssl() {
    log "Setting up SSL with Let's Encrypt..."
    certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
}

# Main function
main() {
    log "Starting server setup..."

    setup_system
    create_user
    setup_nginx
    deploy_app
    setup_ssl

    log "Setup completed successfully!"
    log "Your application is now running at https://$DOMAIN"
}

# Check if root
if [ "$(id -u)" -ne 0 ]; then
    echo "This script must be run as root" >&2
    exit 1
fi

# Run script
main
```

This script automates the entire process of setting up a web server with Nginx, Node.js, and SSL certificates.

## Moving Forward

You now have a solid foundation in shell scripting that will allow you to automate tasks and create powerful tools using the Linux command line.

In the next part, we'll explore Linux system administration basics, including user management, system monitoring, backups, and security.

Shell scripting is a skill that develops with practice. Start with simple scripts and gradually build more complex ones. The more you automate routine tasks, the more time you'll have for creative and strategic work.
