---
title: 'Bash Basics'
description: 'Bash command-line basics: prompt anatomy, command structure, arguments and options, environment variables, filesystem moves, and common shortcuts.'
order: 2
---

Now that you understand what Bash is, let's dive into the basic commands and concepts that will form the foundation of your Bash skills.

## The Command Line Interface

When working with Bash, you'll be typing commands at what's called the prompt. A typical Bash prompt looks like this:

```
username@hostname:~$
```

This tells you:

- Your username
- The hostname of the computer
- Your current directory (~ is shorthand for your home directory)
- The $ symbol indicates you're a regular user (a # would indicate you're the root user)

## Basic Command Structure

Most Bash commands follow this structure:

```
command [options] [arguments]
```

Where:

- `command` is the name of the program you want to run
- `options` modify how the command behaves (usually prefixed with - or --)
- `arguments` are what the command operates on (like filenames)

## Essential Bash Commands

Let's explore some of the most frequently used commands:

### Navigating the File System

```bash
# Print working directory (shows where you are)
pwd

# List files and directories in the current location
ls

# List with details and hidden files
ls -la

# Change directory
cd /path/to/directory

# Go to home directory
cd

# Go up one directory
cd ..

# Go to previous directory
cd -
```

### Creating and Manipulating Files and Directories

```bash
# Create an empty file
touch new_file.txt

# Create a directory
mkdir new_directory

# Create nested directories
mkdir -p parent/child/grandchild

# Copy a file
cp source.txt destination.txt

# Copy a directory and its contents
cp -r source_dir destination_dir

# Move or rename a file/directory
mv old_name.txt new_name.txt

# Delete a file
rm filename.txt

# Delete a directory and its contents
rm -r directory_name
```

Always be cautious with the `rm` command, especially with the `-r` (recursive) and `-f` (force) options, as it permanently deletes files without sending them to a trash bin.

### Viewing File Contents

```bash
# Display entire file content
cat file.txt

# Display file with pagination
less file.txt

# Display the first 10 lines
head file.txt

# Display the last 10 lines
tail file.txt

# Display file with line numbers
nl file.txt
```

When using `less`, you can press:

- `Space` to move forward a page
- `b` to move back a page
- `/` followed by a term to search
- `q` to quit

### Finding Things

```bash
# Search for files and directories
find /path/to/search -name "filename"

# Search for text within files
grep "search_term" file.txt

# Search recursively in all files
grep -r "search_term" /path/to/directory
```

## Command Chaining and Redirection

Bash allows you to combine commands in powerful ways:

### Command Chaining

```bash
# Run command2 only if command1 succeeds
command1 && command2

# Run command2 only if command1 fails
command1 || command2

# Run command2 regardless of whether command1 succeeds
command1 ; command2
```

### Input/Output Redirection

```bash
# Redirect output to a file (overwrite)
command > output.txt

# Redirect output to a file (append)
command >> output.txt

# Redirect input from a file
command < input.txt

# Redirect stderr to stdout
command 2>&1

# Redirect both stdout and stderr to a file
command > output.txt 2>&1
```

### Pipes

Pipes allow you to use the output of one command as the input to another:

```bash
# Filter the output of ls through grep
ls -la | grep ".txt"

# Count the number of files in a directory
ls | wc -l

# Find a process and display details
ps aux | grep "firefox"
```

## Getting Help

When you're stuck or need to learn about a command:

```bash
# Show the manual page for a command
man ls

# Short help summary
ls --help

# Display a brief description
whatis ls

# Find commands related to a keyword
apropos search
```

## Command History

Bash keeps track of the commands you've typed:

```bash
# Show command history
history

# Re-run the last command
!!

# Re-run a specific command from history
!123  # Where 123 is the command number from history

# Search history interactively (press Ctrl+R and start typing)
# Press Ctrl+R again to cycle through matches
```

## Command Completion

Bash offers command completion to save typing:

- Press `Tab` once to complete a command or filename if there's no ambiguity
- Press `Tab` twice to show all possible completions

## Wildcards and Globbing

Wildcards allow you to select multiple files with patterns:

```bash
# Match any single character
ls ?.txt  # Matches a.txt, b.txt, but not ab.txt

# Match any number of characters
ls *.txt  # Matches all .txt files

# Match a range of characters
ls [a-c]*.txt  # Matches files starting with a, b, or c and ending with .txt
```

## Your Bash Environment

Your Bash environment includes variables and settings that affect how Bash behaves:

```bash
# Display all environment variables
env

# Display a specific variable
echo $HOME

# Display your search path
echo $PATH
```

These basics will get you started with Bash. Practice these commands to build muscle memory, and soon they'll become second nature. In the next section, we'll delve into working with files in more depth, a crucial skill for effective Bash usage.
