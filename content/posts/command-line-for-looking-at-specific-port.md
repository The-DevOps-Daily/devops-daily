---
title: 'How to Check Which Process is Using a Specific Port from Command Line'
excerpt: 'Learn how to identify which processes are listening on specific ports using netstat, lsof, and ss commands across different operating systems.'
category:
  name: 'Linux'
  slug: 'linux'
date: '2024-12-15'
publishedAt: '2024-12-15T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Linux
  - Networking
  - Troubleshooting
  - Command Line
  - Ports
---

When you're debugging network issues or setting up services, you'll often need to check which process is using a specific port. This happens frequently when you get "port already in use" errors or when troubleshooting connectivity issues.

In this guide, you'll learn how to use different command-line tools to examine port usage across Linux, macOS, and Windows systems.

## Prerequisites

You'll need basic command line access and administrator privileges on your system. The tools we'll cover are typically pre-installed on most Unix-like systems.

## Using netstat to Check Port Usage

The `netstat` command is widely available and shows network connections, routing tables, and network statistics. Here's how to use it to check specific ports.

To see all listening ports and their associated processes:

```bash
netstat -tulpn
```

This command breaks down as follows:

- `-t` shows TCP connections
- `-u` shows UDP connections
- `-l` shows only listening ports
- `-p` shows the process ID and name
- `-n` shows numerical addresses instead of resolving hosts

To check a specific port, you can pipe the output to grep. For example, to check if anything is using port 3000:

```bash
netstat -tulpn | grep :3000
```

You'll see output like this if a process is using the port:

```
tcp6       0      0 :::3000                 :::*                    LISTEN      12345/node
```

This tells you that a Node.js process with PID 12345 is listening on port 3000.

## Using lsof for Detailed Port Information

The `lsof` (list open files) command provides more detailed information about which processes have files open, including network connections.

To check what's using a specific port:

```bash
lsof -i :3000
```

This shows all processes using port 3000 on any protocol. The output looks like this:

```
COMMAND   PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node    12345 user   23u  IPv6 0x1234567890      0t0  TCP *:3000 (LISTEN)
```

You can be more specific about the protocol and interface:

```bash
# Check TCP connections only
lsof -i tcp:3000

# Check UDP connections only
lsof -i udp:53

# Check specific interface
lsof -i @127.0.0.1:3000
```

The `lsof` command is particularly useful because it shows the exact command that opened the connection, making it easier to identify the service.

## Using ss for Modern Linux Systems

On newer Linux distributions, `ss` is the recommended replacement for `netstat`. It's faster and provides more detailed information.

To see all listening sockets:

```bash
ss -tulpn
```

To check a specific port:

```bash
ss -tulpn | grep :3000
```

The `ss` command provides cleaner output and better performance:

```
tcp   LISTEN 0      511          *:3000               *:*    users:(("node",pid=12345,fd=23))
```

You can also use `ss` with sport (source port) or dport (destination port) filters:

```bash
# Check source port
ss -tulpn sport = :3000

# Check destination port in established connections
ss -tupn dport = :80
```

## Platform-Specific Commands

### macOS

On macOS, you can use the same `netstat` and `lsof` commands. However, the `netstat` syntax is slightly different:

```bash
# Show listening ports with process info
netstat -anv | grep LISTEN | grep :3000

# Use lsof (recommended on macOS)
lsof -i :3000
```

### Windows

On Windows systems, use `netstat` with different flags:

```cmd
# Show listening ports with process IDs
netstat -ano | findstr :3000

# Show with process names
netstat -anob | findstr :3000
```

You can then use `tasklist` to get more information about a specific process ID:

```cmd
tasklist /fi "PID eq 12345"
```

## Checking Port Ranges

Sometimes you need to check multiple ports at once. Here's how to check a range of ports:

```bash
# Check ports 3000-3010 using netstat
netstat -tulpn | grep -E ':(300[0-9]|301[0])'

# Check ports 8000-8999 using lsof
lsof -i :8000-8999

# Check multiple specific ports using ss
ss -tulpn | grep -E ':(80|443|8080)'
```

## Killing Processes Using Specific Ports

Once you've identified the process using a port, you might need to stop it. You can use the process ID from the previous commands:

```bash
# Kill process by PID
kill 12345

# Force kill if necessary
kill -9 12345

# Kill by port using lsof (be careful with this)
kill $(lsof -t -i:3000)
```

Always be cautious when killing processes, especially system processes. Make sure you understand what the process does before terminating it.

## Troubleshooting Common Issues

When a port appears to be in use but you can't find the process, the connection might be in a TIME_WAIT state. This happens when a connection was recently closed but the system is holding the port for a brief period:

```bash
# Check for TIME_WAIT connections
ss -tan | grep TIME-WAIT | grep :3000
```

These connections will clear automatically after a timeout period, typically 60 seconds.

If you're still having trouble, you can also check if the port is actually reachable from outside:

```bash
# Test if port is open from another machine
telnet your-server-ip 3000

# Or use nc (netcat)
nc -zv your-server-ip 3000
```

Now you have the tools to effectively diagnose port usage issues and identify which processes are using specific ports on your system. These commands will help you troubleshoot network conflicts and ensure your services are running on the expected ports.
