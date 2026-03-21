---
title: 'Defining Variables with and without Export in Linux Shell'
excerpt: 'Understand the difference between regular shell variables and exported environment variables, when to use export, and how variable scope affects scripts and processes.'
category:
  name: 'Linux'
  slug: 'linux'
date: '2024-11-28'
publishedAt: '2024-11-28T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Linux
  - Bash
  - environment variables
  - shell scripting
  - export command
---

Understanding the difference between regular shell variables and exported environment variables is crucial for effective Linux shell scripting and system administration. The `export` command controls whether variables are available to child processes and external programs.

## Prerequisites

You'll need access to a Linux or Unix shell with basic command-line knowledge. The examples work in bash, zsh, and most POSIX-compliant shells.

## Regular Variables vs Exported Variables

**Regular shell variable (local to current shell):**

```bash
MY_VAR="Hello World"
```

**Exported environment variable (available to child processes):**

```bash
export MY_VAR="Hello World"
```

Or in two steps:

```bash
MY_VAR="Hello World"
export MY_VAR
```

## Understanding Variable Scope

**Local variables** are only available in the current shell session:

```bash
# Set a local variable
LOCAL_VAR="I'm local"

# This works in the current shell
echo $LOCAL_VAR
```

**Exported variables** are passed to child processes:

```bash
# Set and export a variable
export GLOBAL_VAR="I'm global"

# This works in the current shell AND child processes
echo $GLOBAL_VAR
```

## Demonstrating the Difference

Create a test script to see the difference:

```bash
#!/bin/bash
# test_vars.sh
echo "LOCAL_VAR in script: $LOCAL_VAR"
echo "GLOBAL_VAR in script: $GLOBAL_VAR"
```

Now test both types:

```bash
# Set variables
LOCAL_VAR="local value"
export GLOBAL_VAR="global value"

# Run the script
bash test_vars.sh
```

Output:

```
LOCAL_VAR in script:
GLOBAL_VAR in script: global value
```

The local variable is empty in the child process (script), while the exported variable is available.

## When to Use Export

**Use export when:**

1. **Variables needed by child processes:**

```bash
export DATABASE_URL="postgresql://localhost:5432/mydb"
./my_application.sh  # Script can access DATABASE_URL
```

2. **Configuration for external programs:**

```bash
export EDITOR="vim"
export BROWSER="firefox"
export PAGER="less"
```

3. **Environment setup for development:**

```bash
export NODE_ENV="development"
export DEBUG="true"
export API_KEY="your-secret-key"
```

**Don't use export when:**

1. **Variables only used in current script:**

```bash
# Internal loop counters, temporary values
counter=0
temp_file="/tmp/processing.tmp"
```

2. **Sensitive data that shouldn't propagate:**

```bash
# Keep passwords local when possible
admin_password="secret123"
```

## Common Export Patterns

**Setting multiple related variables:**

```bash
# Database configuration
export DB_HOST="localhost"
export DB_PORT="5432"
export DB_NAME="production"
export DB_USER="app_user"
```

**Conditional exports based on environment:**

```bash
if [ "$ENVIRONMENT" = "production" ]; then
    export LOG_LEVEL="warn"
    export DEBUG="false"
else
    export LOG_LEVEL="debug"
    export DEBUG="true"
fi
```

**PATH modifications:**

```bash
# Add custom directory to PATH
export PATH="$HOME/bin:$PATH"
export PATH="/usr/local/go/bin:$PATH"
```

## Checking Variable Status

**View all exported variables:**

```bash
export
# or
env
```

**Check if a variable is exported:**

```bash
declare -p MY_VAR
```

Output examples:

- `declare -- MY_VAR="value"` (not exported)
- `declare -x MY_VAR="value"` (exported)

**List specific environment variables:**

```bash
env | grep MY_VAR
printenv MY_VAR
```

## Advanced Export Techniques

**Export with default values:**

```bash
export DATABASE_URL="${DATABASE_URL:-postgresql://localhost:5432/defaultdb}"
export LOG_LEVEL="${LOG_LEVEL:-info}"
```

**Export function definitions:**

```bash
my_function() {
    echo "This function is exported"
}
export -f my_function

# Now available in child processes
bash -c 'my_function'
```

**Temporary exports for single commands:**

```bash
# Export only for this command
TEMP_VAR="temporary" my_script.sh

# Or using env
env TEMP_VAR="temporary" my_script.sh
```

## Working with Configuration Files

**Environment file pattern (.env):**

```bash
# .env file
DATABASE_URL=postgresql://localhost:5432/mydb
API_KEY=your-secret-key
DEBUG=true
```

**Loading and exporting from file:**

```bash
# Method 1: Source and export
set -a  # Automatically export all variables
source .env
set +a  # Turn off auto-export

# Method 2: Export while reading
while IFS='=' read -r key value; do
    [ -n "$key" ] && export "$key=$value"
done < .env
```

**Safe environment loading function:**

```bash
load_env() {
    local env_file="${1:-.env}"

    if [ -f "$env_file" ]; then
        echo "Loading environment from $env_file"

        # Read file line by line
        while IFS='=' read -r key value; do
            # Skip comments and empty lines
            if [[ ! "$key" =~ ^[[:space:]]*# ]] && [ -n "$key" ]; then
                # Remove quotes from value if present
                value=$(echo "$value" | sed 's/^"\(.*\)"$/\1/')
                export "$key=$value"
                echo "Exported: $key"
            fi
        done < "$env_file"
    else
        echo "Environment file $env_file not found"
        return 1
    fi
}
```

## Shell-Specific Behavior

**Bash-specific exports:**

```bash
# Export arrays (bash 4.4+)
declare -a my_array=("one" "two" "three")
export my_array

# Export with attributes
declare -xi NUMBER=42  # Export as integer
```

**Zsh-specific features:**

```bash
# Zsh global export
typeset -gx GLOBAL_VAR="value"

# Export with type information
typeset -x -i INTEGER_VAR=123
```

## Best Practices

**1. Use meaningful variable names:**

```bash
# Good
export DATABASE_CONNECTION_STRING="..."
export API_BASE_URL="https://api.example.com"

# Avoid
export DB="..."
export URL="..."
```

**2. Group related exports:**

```bash
# Application configuration
export APP_NAME="myapp"
export APP_VERSION="1.0.0"
export APP_ENV="production"

# Database configuration
export DB_HOST="localhost"
export DB_PORT="5432"
export DB_NAME="myapp_prod"
```

**3. Validate exported variables:**

```bash
validate_environment() {
    local required_vars=("DATABASE_URL" "API_KEY" "APP_ENV")
    local missing_vars=()

    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done

    if [ ${#missing_vars[@]} -gt 0 ]; then
        echo "Error: Missing required environment variables:"
        printf '%s\n' "${missing_vars[@]}"
        return 1
    fi
}
```

**4. Use readonly for constants:**

```bash
readonly -x CONFIG_FILE="/etc/myapp/config.ini"
readonly -x VERSION="1.0.0"
```

## Debugging Variable Issues

**Check variable inheritance:**

```bash
# Parent shell
export PARENT_VAR="from parent"
LOCAL_VAR="local only"

# Child shell
bash -c 'echo "PARENT_VAR: $PARENT_VAR"; echo "LOCAL_VAR: $LOCAL_VAR"'
```

**Trace variable assignments:**

```bash
# Enable variable tracing
set -x
export DEBUG_VAR="traced"
set +x
```

**Create debugging function:**

```bash
debug_vars() {
    echo "=== Environment Variables ==="
    env | sort
    echo
    echo "=== Shell Variables ==="
    set | grep "^[A-Z]" | sort
}
```

## Common Pitfalls and Solutions

**Problem**: Variable not available in script
**Solution**: Make sure to export it:

```bash
# Wrong
MY_VAR="value"
./script.sh  # Can't access MY_VAR

# Correct
export MY_VAR="value"
./script.sh  # Can access MY_VAR
```

**Problem**: Exported variable doesn't persist after script ends
**Solution**: Exports only affect child processes, not parent:

```bash
# This won't affect your current shell
./set_env.sh

# This will affect current shell
source ./set_env.sh
# or
. ./set_env.sh
```

**Problem**: Accidental variable pollution
**Solution**: Use subshells for isolation:

```bash
(
    export TEMP_VAR="temporary"
    ./some_script.sh
)
# TEMP_VAR is not available here
```

## Next Steps

Now that you understand variable export in Linux, consider learning about:

- Advanced shell scripting techniques
- Process management and job control
- Shell configuration and customization
- Environment management tools like `direnv`
- Container environment variable management
