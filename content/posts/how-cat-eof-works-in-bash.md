---
title: 'How Does cat << EOF Work in Bash?'
excerpt: "Understand heredocs in Bash - the << EOF syntax that lets you write multi-line strings, create files with embedded content, and pass complex input to commands."
category:
  name: 'Bash'
  slug: 'bash'
date: '2024-09-18'
publishedAt: '2024-09-18T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Bash
  - Shell Scripting
  - Heredoc
  - Linux
  - Command Line
---

You've seen scripts with `cat << EOF` followed by multiple lines of text and ending with `EOF`. What is this syntax, and how does it work?

## TL;DR

`cat << EOF` is a heredoc (here document) - a way to pass multiple lines of input to a command in Bash. The `<<` redirects the following lines as input until it reaches the delimiter (EOF in this case). You can use any delimiter word, not just EOF. Variables expand inside heredocs by default, or use `<< 'EOF'` with quotes to prevent expansion.

A heredoc lets you embed multi-line content directly in your script without needing separate files or complex quoting.

Here's a basic example:

```bash
cat << EOF
This is line 1
This is line 2
This is line 3
EOF
```

This prints:
```
This is line 1
This is line 2
This is line 3
```

The `cat` command receives all the lines between `<< EOF` and the closing `EOF` as input, then outputs them.

## Understanding the Syntax

Let's break down `cat << EOF`:

- `cat` - the command that receives input
- `<<` - the heredoc operator (redirection)
- `EOF` - the delimiter marking where input starts and ends

```
cat << EOF           <- Start of heredoc
text here            <- Input to cat
more text            <- More input
EOF                  <- End delimiter (must be on its own line)
```

The delimiter `EOF` (End Of File) is conventional but arbitrary. You can use any word:

```bash
cat << STOP
This works too
STOP

cat << MYDELIMITER
So does this
MYDELIMITER
```

The closing delimiter must be on a line by itself with no leading spaces (unless you use `<<-`, covered later).

## Creating Files with Heredocs

A common use is creating files with multiple lines:

```bash
cat << EOF > config.txt
server_name=localhost
port=8080
debug=true
EOF
```

This creates `config.txt` with those three lines. It's cleaner than using multiple `echo` statements:

```bash
# Without heredoc (verbose)
echo "server_name=localhost" > config.txt
echo "port=8080" >> config.txt
echo "debug=true" >> config.txt

# With heredoc (cleaner)
cat << EOF > config.txt
server_name=localhost
port=8080
debug=true
EOF
```

## Variable Expansion in Heredocs

Variables expand inside heredocs by default:

```bash
NAME="Alice"
PORT=8080

cat << EOF
Hello, $NAME!
Server is running on port $PORT
EOF
```

Output:
```
Hello, Alice!
Server is running on port 8080
```

Command substitution works too:

```bash
cat << EOF
Current directory: $(pwd)
Current user: $(whoami)
Date: $(date +%Y-%m-%d)
EOF
```

## Preventing Variable Expansion

To treat content literally (no variable expansion), quote the delimiter:

```bash
NAME="Alice"

cat << 'EOF'
Hello, $NAME!
This will print literally: $NAME
EOF
```

Output:
```
Hello, $NAME!
This will print literally: $NAME
```

Note the quotes around `'EOF'` - they prevent expansion.

You can use single or double quotes:

```bash
cat << "EOF"
$NAME won't expand here either
EOF
```

## Using <<- to Ignore Leading Tabs

If you're indenting heredoc content in a script for readability, use `<<-` instead of `<<`:

```bash
#!/bin/bash

if true; then
    cat <<- EOF
	This is indented with a tab
	Another line with a tab
	EOF
fi
```

The `<<-` strips leading tab characters (not spaces) from each line, including the delimiter. This lets you indent the heredoc to match your code structure.

Important: This only works with tabs, not spaces. If you use spaces, they'll appear in the output.

## Passing Heredocs to Other Commands

Any command that reads from stdin can use heredocs:

```bash
# Pass multi-line input to grep
grep "error" << EOF
This is a log entry
An error occurred here
Another normal entry
EOF
```

Output:
```
An error occurred here
```

Passing to `mysql`:

```bash
mysql -u root -p << EOF
CREATE DATABASE myapp;
USE myapp;
CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100));
EOF
```

Passing to `ssh`:

```bash
ssh user@server << EOF
cd /var/www
ls -la
df -h
EOF
```

The remote commands execute on the server, with their output shown locally.

## Assigning Heredocs to Variables

You can capture heredoc content in a variable:

```bash
CONFIG=$(cat << EOF
server=localhost
port=8080
debug=true
EOF
)

echo "$CONFIG"
```

This stores the multi-line string in `$CONFIG`. Note the quotes when echoing to preserve newlines.

Another syntax without `cat`:

```bash
read -r -d '' CONFIG << EOF
server=localhost
port=8080
debug=true
EOF

echo "$CONFIG"
```

The `read -r -d ''` reads until it hits the null delimiter, effectively capturing everything until EOF.

## Heredocs in Functions

Heredocs work inside functions:

```bash
create_config() {
    cat << EOF > "$1"
# Configuration file generated on $(date)
server_name=$2
port=$3
EOF
}

# Usage
create_config "app.conf" "localhost" 8080
```

This function creates a config file with parameters passed as arguments.

## Appending with Heredocs

Use `>>` to append instead of overwrite:

```bash
# Create initial file
cat << EOF > log.txt
Application started
EOF

# Append more content
cat << EOF >> log.txt
User logged in
Database connected
EOF
```

## Multi-line Comments with Heredocs

A clever trick for multi-line comments in Bash:

```bash
: << 'COMMENT'
This is a multi-line comment
It won't be executed
Useful for temporarily disabling code blocks
COMMENT

echo "This will run"
```

The `:` command does nothing (it's a no-op), and the heredoc is passed to it but ignored.

## Practical Example: Generating HTML

Creating an HTML file with dynamic content:

```bash
#!/bin/bash

TITLE="My Web Page"
DATE=$(date +%Y-%m-%d)

cat << EOF > index.html
<!DOCTYPE html>
<html>
<head>
    <title>$TITLE</title>
</head>
<body>
    <h1>$TITLE</h1>
    <p>Generated on: $DATE</p>
    <p>Welcome to my website!</p>
</body>
</html>
EOF

echo "HTML file created: index.html"
```

## Practical Example: Docker Compose File

Generating a Docker Compose file with environment-specific values:

```bash
#!/bin/bash

APP_PORT=3000
DB_PASSWORD=$(openssl rand -base64 32)

cat << EOF > docker-compose.yml
version: '3.8'

services:
  app:
    image: myapp:latest
    ports:
      - "$APP_PORT:3000"
    environment:
      - DB_PASSWORD=$DB_PASSWORD
      - NODE_ENV=production

  database:
    image: postgres:14
    environment:
      - POSTGRES_PASSWORD=$DB_PASSWORD
    volumes:
      - db-data:/var/lib/postgresql/data

volumes:
  db-data:
EOF

echo "Docker Compose file created with random password"
```

## Practical Example: Email Template

Sending emails with templates:

```bash
#!/bin/bash

USER_NAME="Alice"
RESET_LINK="https://example.com/reset?token=abc123"

mail -s "Password Reset" user@example.com << EOF
Hello $USER_NAME,

You requested a password reset. Click the link below:

$RESET_LINK

This link expires in 24 hours.

If you didn't request this, please ignore this email.

Best regards,
The Support Team
EOF
```

## Heredocs with Pipes

You can pipe heredoc output to other commands:

```bash
cat << EOF | grep -v "^#" | sort
# This is a comment
zebra
apple
# Another comment
banana
EOF
```

This filters out comments and sorts the remaining lines.

## Common Pitfalls

The closing delimiter must be on its own line with no extra characters:

```bash
# Wrong - has spaces before EOF
cat << EOF
text
    EOF

# Wrong - has text after EOF
cat << EOF
text
EOF

# Correct
cat << EOF
text
EOF
```

Variables in the delimiter don't expand:

```bash
DELIM="END"

# This looks for literal EOF, not the value of $DELIM
cat << $DELIM
text
EOF  # This won't work

# You must use the actual delimiter
cat << EOF
text
EOF
```

## Why Use Heredocs?

Heredocs are great when you need to:

- Embed multi-line text in scripts without external files
- Generate configuration files with variable substitution
- Pass complex input to commands
- Improve script readability compared to multiple echo statements
- Avoid quoting nightmares with special characters

For simple cases, echo might be clearer:

```bash
# For single lines, echo is fine
echo "server=localhost" > config.txt

# For multiple lines with variables, heredoc is cleaner
cat << EOF > config.txt
server=localhost
port=$PORT
debug=true
EOF
```

The `cat << EOF` syntax (heredocs) is a powerful feature for embedding multi-line text in Bash scripts. Whether you're creating configuration files, generating code, or passing complex input to commands, heredocs make your scripts cleaner and more maintainable than alternatives.
