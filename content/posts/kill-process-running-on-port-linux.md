---
title: 'How to Kill a Process Running on a Particular Port in Linux'
excerpt: 'Learn multiple methods to identify and terminate processes that are using specific ports on Linux systems using netstat, lsof, fuser, and ss commands.'
category:
  name: 'Linux'
  slug: 'linux'
date: '2024-12-18'
publishedAt: '2024-12-18T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Linux
  - process management
  - Networking
  - ports
---

When a process is occupying a port you need to use, or when a service becomes unresponsive, you'll need to identify and terminate the process using that specific port. Linux provides several methods to find and kill processes by port number.

## Prerequisites

You'll need access to a Linux terminal with sudo privileges for killing processes owned by other users. The commands shown work on most Linux distributions.

## Method 1: Using lsof Command

The `lsof` (List Open Files) command is one of the most reliable ways to find processes using specific ports. To find what's running on port 8080:

```bash
lsof -i :8080
```

This command will show output similar to:

```
COMMAND  PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
node    1234 user   10u  IPv4  12345      0t0  TCP *:8080 (LISTEN)
```

To kill the process, use the PID from the output:

```bash
kill 1234
```

You can combine both commands in a single line:

```bash
kill $(lsof -t -i:8080)
```

The `-t` flag tells lsof to return only the process ID, making it perfect for piping to kill.

## Method 2: Using netstat and kill

The `netstat` command can also identify processes using specific ports:

```bash
netstat -tlnp | grep :8080
```

This shows output like:

```
tcp 0 0 0.0.0.0:8080 0.0.0.0:* LISTEN 1234/node
```

Extract the PID (1234 in this example) and kill it:

```bash
kill 1234
```

To automate this process:

```bash
kill $(netstat -tlnp | grep :8080 | awk '{print $7}' | cut -d'/' -f1)
```

## Method 3: Using fuser Command

The `fuser` command can directly kill processes using a specific port:

```bash
fuser -k 8080/tcp
```

The `-k` flag kills the processes immediately. Be careful with this command as it doesn't ask for confirmation.

To see which processes would be killed first:

```bash
fuser 8080/tcp
```

## Method 4: Using ss Command

The modern `ss` command (replacement for netstat) can also identify processes:

```bash
ss -tlnp | grep :8080
```

The output format is similar to netstat:

```
LISTEN 0 128 *:8080 *:* users:(("node",pid=1234,fd=10))
```

Extract and kill the process:

```bash
kill $(ss -tlnp | grep :8080 | sed 's/.*pid=\([0-9]*\).*/\1/')
```

## Forcing Process Termination

If a process doesn't respond to the regular `kill` command, use `kill -9` for forceful termination:

```bash
kill -9 1234
```

Or with lsof:

```bash
kill -9 $(lsof -t -i:8080)
```

## Killing Multiple Processes on Same Port

Sometimes multiple processes might use the same port. To kill all of them:

```bash
lsof -t -i:8080 | xargs kill
```

For forceful termination:

```bash
lsof -t -i:8080 | xargs kill -9
```

## Creating a Reusable Function

Add this function to your `.bashrc` or `.zshrc` for easy reuse:

```bash
killport() {
    if [ -z "$1" ]; then
        echo "Usage: killport <port_number>"
        return 1
    fi

    local pid=$(lsof -t -i:$1)
    if [ -z "$pid" ]; then
        echo "No process found running on port $1"
        return 1
    fi

    echo "Killing process $pid running on port $1"
    kill $pid
}
```

After adding this function, reload your shell configuration:

```bash
source ~/.bashrc
```

Now you can simply run:

```bash
killport 8080
```

## Checking for UDP Processes

The examples above focus on TCP connections. For UDP processes, modify the commands:

```bash
lsof -i udp:53
fuser -k 53/udp
ss -ulnp | grep :53
```

## Common Use Cases

**Web Development**: Kill development servers occupying ports:

```bash
killport 3000  # React development server
killport 8000  # Django development server
```

**Database Management**: Free up database ports:

```bash
killport 3306  # MySQL
killport 5432  # PostgreSQL
```

**Debugging Network Issues**: Identify and stop conflicting services:

```bash
lsof -i :80   # Check what's using HTTP port
lsof -i :443  # Check what's using HTTPS port
```

## Troubleshooting

If you get "Permission denied" errors, the process might be owned by another user. Use sudo:

```bash
sudo kill $(sudo lsof -t -i:8080)
```

For systemd services, consider using systemctl instead:

```bash
sudo systemctl stop apache2
sudo systemctl stop nginx
```

## Next Steps

Now that you can kill processes by port, you might want to learn about:

- Monitoring network connections with `netstat` and `ss`
- Managing services with `systemctl`
- Setting up port forwarding and firewall rules
- Process monitoring with `htop` and `ps`
