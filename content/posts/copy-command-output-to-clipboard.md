---
title: 'How to Copy Command Output Directly to Your Clipboard in Linux'
excerpt: "Learn how to pipe command output to your clipboard using xclip, xsel, or pbcopy. Make terminal output available for pasting into applications without selecting and copying manually."
category:
  name: 'Linux'
  slug: 'linux'
date: '2024-09-25'
publishedAt: '2024-09-25T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Linux
  - Command Line
  - Clipboard
  - Productivity
  - xclip
---

You run a command that outputs a long string - maybe a hash, a file path, or a URL - and you need to paste it somewhere else. Instead of selecting and copying with your mouse, can you send it straight to the clipboard?

## TL;DR

On Linux, install `xclip` and pipe command output to it: `command | xclip -selection clipboard`. On macOS, use the built-in `pbcopy`: `command | pbcopy`. For a shorter command, create an alias like `alias clip='xclip -selection clipboard'`, then use `command | clip`. To paste from clipboard in the terminal, use `xclip -selection clipboard -o` or `pbpaste` on macOS.

Getting command output into your clipboard saves time and prevents copy-paste errors.

Let's say you generate an SSH key and want to copy the public key:

```bash
cat ~/.ssh/id_rsa.pub
```

Instead of selecting the output with your mouse, pipe it to the clipboard tool:

```bash
# Linux
cat ~/.ssh/id_rsa.pub | xclip -selection clipboard

# macOS
cat ~/.ssh/id_rsa.pub | pbcopy
```

Now the key is in your clipboard, ready to paste anywhere.

## Installing xclip on Linux

Most Linux distributions don't have `xclip` installed by default:

```bash
# Ubuntu/Debian
sudo apt install xclip

# Fedora/RHEL
sudo dnf install xclip

# Arch
sudo pacman -S xclip
```

After installation, you can pipe to xclip.

## Using xclip

The basic syntax:

```bash
command | xclip -selection clipboard
```

The `-selection clipboard` flag targets the system clipboard (the one used by Ctrl+C and Ctrl+V). Without it, xclip uses the X11 primary selection (middle-click paste).

Examples:

```bash
# Copy current directory path
pwd | xclip -selection clipboard

# Copy file contents
cat config.json | xclip -selection clipboard

# Copy command output
ls -la | xclip -selection clipboard

# Copy your IP address
ip addr show | grep "inet " | head -1 | awk '{print $2}' | xclip -selection clipboard
```

## Creating a Shorter Alias

Typing `-selection clipboard` every time is tedious. Create an alias:

```bash
# Add to ~/.bashrc
alias clip='xclip -selection clipboard'
```

Reload your shell:

```bash
source ~/.bashrc
```

Now use it:

```bash
pwd | clip
echo "Hello" | clip
cat file.txt | clip
```

## Using xsel as an Alternative

`xsel` is another clipboard tool with simpler syntax:

```bash
# Install xsel
sudo apt install xsel

# Copy to clipboard
command | xsel --clipboard

# Create alias
alias clip='xsel --clipboard'
```

Both xclip and xsel work well - choose whichever you prefer.

## macOS: Using pbcopy and pbpaste

macOS includes `pbcopy` and `pbpaste` by default:

```bash
# Copy to clipboard
command | pbcopy

# Paste from clipboard
pbpaste
```

Examples:

```bash
# Copy file contents
cat ~/.ssh/id_rsa.pub | pbcopy

# Copy current directory
pwd | pbcopy

# Generate and copy a UUID
uuidgen | pbcopy

# Copy Git commit hash
git rev-parse HEAD | pbcopy
```

## Pasting from Clipboard to Terminal

To paste clipboard contents into a file or use in a command:

**Linux with xclip:**
```bash
# Output clipboard contents
xclip -selection clipboard -o

# Save clipboard to file
xclip -selection clipboard -o > clipboard-contents.txt

# Use clipboard in a command
echo "The path is: $(xclip -selection clipboard -o)"
```

**Linux with xsel:**
```bash
xsel --clipboard --output

# Or shorter
xsel -ob
```

**macOS:**
```bash
# Output clipboard
pbpaste

# Save to file
pbpaste > file.txt
```

## Practical Example: Copying SSH Keys

Add your SSH key to a remote server:

```bash
# Copy public key to clipboard
cat ~/.ssh/id_rsa.pub | clip

# Or on macOS
cat ~/.ssh/id_rsa.pub | pbcopy
```

Now paste it into the server's `~/.ssh/authorized_keys` file via your web interface or terminal.

## Practical Example: Sharing Long Commands

Share a complex command with a colleague:

```bash
# Copy the command to clipboard
echo 'docker run -d -p 8080:80 -v $(pwd):/usr/share/nginx/html nginx:latest' | clip
```

Now paste it into Slack, email, or a documentation file.

## Practical Example: Working with APIs

Copy API responses:

```bash
# Get data from API and copy to clipboard
curl -s https://api.github.com/users/octocat | clip

# Copy just a specific field
curl -s https://api.github.com/users/octocat | jq -r '.name' | clip
```

## Practical Example: Copy File Hashes

Generate and copy checksums:

```bash
# Copy SHA256 hash
sha256sum important-file.zip | awk '{print $1}' | clip

# Copy MD5 hash
md5sum file.txt | awk '{print $1}' | clip
```

## Copying Multiple Items in Sequence

The clipboard holds only one item at a time. Each copy replaces the previous content:

```bash
# This copies "Hello"
echo "Hello" | clip

# This replaces it with "World"
echo "World" | clip

# Clipboard now contains only "World"
```

To accumulate multiple items, combine them first:

```bash
# Build a string with multiple values
{
    echo "Server Info:"
    echo "IP: $(hostname -I)"
    echo "Hostname: $(hostname)"
    echo "Uptime: $(uptime -p)"
} | clip
```

## Clipboard in Scripts

Use clipboard in automation scripts:

```bash
#!/bin/bash

# Generate a password and copy it
PASSWORD=$(openssl rand -base64 32)
echo "$PASSWORD" | clip

echo "New password generated and copied to clipboard"
echo "Password will also be saved to passwords.txt"
echo "$PASSWORD" >> passwords.txt
```

## Working with Large Output

Clipboard tools handle large content, but be aware of limitations:

```bash
# This might be too large for some clipboard managers
cat large-log-file.log | clip

# Better to copy a summary or filtered version
tail -100 large-log-file.log | clip

# Or search for specific patterns
grep "ERROR" large-log-file.log | clip
```

## Clipboard Over SSH

When connected via SSH, copying to your local clipboard requires some setup:

**Option 1: Use OSC 52 escape sequences (if your terminal supports it)**

Some terminals can accept clipboard data via escape codes. Tools like `clipboard` or `yank` support this.

**Option 2: Forward X11 and use xclip**

```bash
# Connect with X11 forwarding
ssh -X user@server

# Now xclip on the server copies to your local clipboard
cat file.txt | xclip -selection clipboard
```

**Option 3: Use tmux with clipboard support**

Configure tmux to sync with your system clipboard.

## Creating Helper Functions

Create useful clipboard functions:

```bash
# Add to ~/.bashrc

# Copy and paste shortcuts
alias c='xclip -selection clipboard'
alias v='xclip -selection clipboard -o'

# Copy current directory
alias cpwd='pwd | xclip -selection clipboard'

# Copy last command from history
alias clast='fc -ln -1 | xclip -selection clipboard'
```

After sourcing:

```bash
# Copy output
ls | c

# Paste clipboard
v

# Copy current directory
cpwd
```

## Integrating with Git

Useful Git clipboard commands:

```bash
# Copy current branch name
git branch --show-current | clip

# Copy latest commit hash
git rev-parse HEAD | clip

# Copy remote URL
git remote get-url origin | clip

# Copy diff of last commit
git diff HEAD~1 | clip
```

Create Git aliases:

```bash
# Add to ~/.gitconfig
[alias]
    copy-branch = !git branch --show-current | xclip -selection clipboard
    copy-hash = !git rev-parse HEAD | xclip -selection clipboard
```

## When Clipboard Tools Don't Work

If you're in a pure terminal environment without X11 (like a server with no GUI), xclip won't work. In these cases:

- Save output to a file and transfer it
- Use `cat` or `less` to view and manually copy
- Set up X11 forwarding if connecting via SSH
- Use terminal multiplexers with clipboard support

## Clipboard Managers and History

Some clipboard managers keep a history of copied items. Tools like `clipman`, `copyq`, or `diodon` let you access previously copied content.

With these, you can:
- Copy multiple items and paste them later
- Search clipboard history
- Organize frequently used snippets

## Security Considerations

Be careful what you copy to the clipboard:

```bash
# Don't do this with sensitive data
cat private-key.pem | clip

# Clipboard might be logged by monitoring tools
echo "$SECRET_PASSWORD" | clip
```

For sensitive data:
- Clear clipboard after use
- Use secure password managers instead
- Be aware of clipboard monitoring software

Using clipboard tools from the command line streamlines your workflow. Whether you're copying SSH keys, API responses, or file paths, piping to `xclip`, `xsel`, or `pbcopy` is faster and more accurate than manual selection.
