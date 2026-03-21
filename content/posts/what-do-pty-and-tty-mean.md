---
title: 'What do PTY and TTY Mean?'
excerpt: 'TTY and PTY are interfaces for text input and output in Unix systems. Learn the difference between physical terminals (TTY), pseudo-terminals (PTY), and how they enable SSH sessions, terminal emulators, and command-line tools.'
category:
  name: 'Linux'
  slug: 'linux'
date: '2025-06-05'
publishedAt: '2025-06-05T15:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Linux
  - Terminal
  - Unix
  - SSH
  - System Administration
---

When working with Linux or Unix systems, you'll encounter terms like TTY and PTY in various contexts - from SSH sessions to Docker containers to terminal multiplexers like screen and tmux. These cryptic three-letter acronyms represent fundamental concepts in how Unix systems handle interactive input and output.

Understanding TTY and PTY helps you troubleshoot terminal issues, work effectively with remote sessions, and understand how command-line programs interact with your system.

## TLDR

TTY (TeleTYpewriter) is a terminal device - originally physical hardware, now mostly software. PTY (Pseudo-TTY) is a virtual terminal created by software like SSH, terminal emulators, or tmux. When you open Terminal.app or PuTTY, you're using a PTY. When a program checks if it's running interactively (to show colors or progress bars), it's checking if it's connected to a TTY/PTY.

## Prerequisites

Basic familiarity with the Linux command line will help you understand the examples. No advanced knowledge is required.

## The History: Physical Teletypewriters

TTY stands for "TeleTYpewriter" - actual physical typewriter-like devices used to interact with computers in the 1960s and 1970s.

```
User types on keyboard → Sends to computer
Computer processes command → Sends output back
Output prints on paper
```

These were mechanical terminals with keyboards and printers (no screens). When you typed a command, you'd see it printed on paper, followed by the output. The Unix design for terminal I/O still reflects this history.

## Modern TTYs: Virtual Terminals

Modern Linux systems have virtual terminals (consoles) accessible with `Ctrl+Alt+F1` through `Ctrl+Alt+F7`:

```bash
# See your current TTY
tty
```

Output on a virtual console:

```
/dev/tty1
```

Output in a terminal emulator:

```
/dev/pts/0
```

The difference:

- `/dev/tty1`, `/dev/tty2`, etc.: Virtual consoles (direct kernel-provided terminals)
- `/dev/pts/0`, `/dev/pts/1`, etc.: Pseudo-terminals (PTYs)

## What is a PTY?

A PTY (pseudo-terminal) is a software emulation of a terminal. It consists of two parts:

**Master side (PTM)**: The controlling program (like your terminal emulator or SSH server)

**Slave side (PTS)**: What programs see as their terminal

```
Terminal Emulator (Master)
           ↕
     PTY Interface
           ↕
    Shell (Slave)
```

When you type in your terminal emulator:

1. You type `ls` and press Enter
2. Terminal emulator receives the key presses
3. Sends characters to the PTY master
4. PTY slave delivers them to the shell
5. Shell executes `ls`
6. Output goes to PTY slave
7. PTY master receives it
8. Terminal emulator displays it on screen

## Seeing Your PTYs

List all pseudo-terminals in use:

```bash
# See all pseudo-terminals
ls -l /dev/pts/
```

Output:

```
total 0
crw--w---- 1 user tty  136, 0 Nov 17 10:23 0
crw--w---- 1 user tty  136, 1 Nov 17 10:24 1
crw--w---- 1 user tty  136, 2 Nov 17 10:25 2
```

Each number represents an open terminal session.

Check which PTY you're currently using:

```bash
tty
```

Output:

```
/dev/pts/0
```

See all logged-in users and their terminals:

```bash
who
```

Output:

```
user     pts/0   2025-06-05 10:23 (192.168.1.100)
user     pts/1   2025-06-05 10:24 (192.168.1.100)
admin    tty1    2025-06-05 09:00
```

## TTY in SSH Sessions

When you SSH into a server, SSH creates a PTY for your session:

```bash
# SSH connection
ssh user@server

# Check your TTY
tty
```

Output:

```
/dev/pts/3
```

The SSH server (sshd) acts as the PTY master, and your shell runs connected to the PTY slave. This allows interactive programs like `vim`, `top`, and `less` to work over SSH just like they do locally.

### Disabling PTY Allocation

Some commands don't need a TTY:

```bash
# No PTY allocated (non-interactive)
ssh user@server 'ls -l'

# Force PTY allocation (interactive)
ssh -t user@server 'ls -l'
```

The `-t` flag forces PTY allocation even for commands that don't require it.

## Why Programs Care About TTYs

Programs behave differently when connected to a TTY versus when their output is redirected to a file or pipe.

### Example: ls with colors

```bash
# When connected to a TTY (colors enabled)
ls

# When piped (colors disabled)
ls | cat
```

The `ls` command checks if its output is a TTY. If yes, it uses colors. If no (output is piped), it outputs plain text.

### Checking if Output is a TTY

Programs use the `isatty()` function:

```python
import sys

if sys.stdout.isatty():
    print("Running interactively in a terminal")
else:
    print("Output is redirected (pipe or file)")
```

Run it directly:

```bash
python check_tty.py
```

Output:

```
Running interactively in a terminal
```

Pipe the output:

```bash
python check_tty.py | cat
```

Output:

```
Output is redirected (pipe or file)
```

### Practical Example: Git Output

Git shows colored output when connected to a TTY:

```bash
# Colored output
git log

# No colors when piped
git log | less
```

You can force colors even when not connected to a TTY:

```bash
git -c color.ui=always log | less
```

## Docker and TTYs

Docker containers can run with or without a TTY:

```bash
# Run without TTY (non-interactive)
docker run ubuntu echo "Hello"

# Run with TTY and interactive mode
docker run -it ubuntu bash
```

The flags:

- `-i`: Keep STDIN open (interactive)
- `-t`: Allocate a pseudo-TTY

Together `-it` gives you an interactive shell session.

Without `-t`, you can't run interactive programs:

```bash
# This fails without -t
docker run -i ubuntu vim

# This works
docker run -it ubuntu vim
```

### Checking TTY in Docker

Inside a container:

```bash
docker run -it ubuntu bash
tty
```

Output:

```
/dev/pts/0
```

Without `-t`:

```bash
docker run -i ubuntu tty
```

Output:

```
not a tty
```

## Terminal Multiplexers: tmux and screen

tmux and screen create PTYs that persist even when you disconnect:

```bash
# Start tmux
tmux

# Check your TTY
tty
```

Output:

```
/dev/pts/5
```

Inside tmux, you're connected to a PTY created by tmux. When you detach from tmux (`Ctrl+b d`), the PTY and all programs running in it continue running.

This is why tmux/screen are useful for long-running tasks over SSH:

```
SSH → tmux (PTY master) → shell (PTY slave)
```

If SSH disconnects, tmux keeps running. Reconnect and reattach to the same session.

## Common TTY-Related Commands

### ps Command

See which TTY a process is using:

```bash
ps aux
```

Output:

```
USER       PID  TTY      STAT START   TIME COMMAND
user      1234  pts/0    Ss   10:23   0:00 -bash
user      5678  pts/1    Ss+  10:24   0:00 vim file.txt
user      9012  ?        Ss   09:00   0:01 sshd
```

The TTY column shows:

- `pts/0`, `pts/1`: Pseudo-terminals
- `tty1`, `tty2`: Virtual consoles
- `?`: No controlling terminal (daemon processes)

### stty Command

Control terminal settings:

```bash
# Show all terminal settings
stty -a

# Disable echo (useful for password input)
stty -echo

# Re-enable echo
stty echo

# Set terminal size
stty rows 50 cols 120
```

### Ctrl+C and TTY

When you press `Ctrl+C`, the TTY driver sends a `SIGINT` signal to the foreground process group. This is handled by the terminal, not by the program:

```
User presses Ctrl+C
         ↓
    TTY driver
         ↓
   Sends SIGINT
         ↓
   Program exits
```

Without a TTY, `Ctrl+C` doesn't work the same way.

## /dev/tty: The Controlling Terminal

`/dev/tty` is a special device that always refers to the controlling terminal of the current process:

```bash
# Send output to your terminal, bypassing pipes
echo "This goes to terminal" > /dev/tty
```

Even if the script's stdout is redirected, output to `/dev/tty` appears on your terminal.

Reading from `/dev/tty` for password prompts:

```bash
#!/bin/bash
echo -n "Password: " > /dev/tty
stty -echo
read password < /dev/tty
stty echo
echo
echo "Password received"
```

This ensures the password prompt appears on the terminal and reads from it, regardless of I/O redirection.

## Troubleshooting TTY Issues

### "Not a TTY" Errors

Some programs require a TTY:

```bash
# Fails
ssh user@server sudo command
```

Error:

```
sudo: sorry, you must have a tty to run sudo
```

Solution: Force TTY allocation:

```bash
ssh -t user@server sudo command
```

### Docker "input device is not a TTY"

Error when running Docker without proper flags:

```bash
docker run ubuntu bash
```

Solution: Add `-it`:

```bash
docker run -it ubuntu bash
```

### Terminal Size Problems

If your terminal displays incorrectly after resizing:

```bash
# Reset terminal
reset

# Or update terminal size
stty rows $(tput lines) cols $(tput cols)
```

### Detached Terminal Sessions

If a process loses its controlling terminal:

```bash
# Find processes without a TTY
ps aux | grep '?'
```

These are usually daemons or background processes, which is normal. If an interactive program shows `?`, it might have lost its terminal connection.

## PTY in Programming

Creating a PTY pair in Python:

```python
import pty
import os

# Create a PTY pair
master, slave = pty.openpty()

# Slave side looks like a regular terminal
slave_name = os.ttyname(slave)
print(f"Slave PTY: {slave_name}")

# You can now use master and slave file descriptors
# Master for controlling program
# Slave for programs that need a terminal
```

This is how terminal emulators, SSH servers, and tools like `script` work under the hood.

TTY and PTY are fundamental to how Unix systems handle interactive input and output. TTYs originated as physical terminals but now exist as virtual consoles and pseudo-terminals. PTYs enable modern tools like SSH, Docker, and tmux to provide interactive terminal sessions. Understanding these concepts helps you work more effectively with command-line tools and troubleshoot terminal-related issues.
