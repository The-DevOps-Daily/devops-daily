---
title: 'How to Free Up a TCP/IP Port on Linux, macOS, and Windows'
excerpt: "Learn how to identify processes using a port and free it up by stopping the service, killing the process, or changing configuration across different operating systems."
category:
  name: 'Networking'
  slug: 'networking'
date: '2025-07-21'
publishedAt: '2025-07-21T10:00:00Z'
updatedAt: '2026-11-05T09:00:00Z'
readingTime: '9 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Networking
  - Linux
  - macOS
  - Windows
  - Ports
  - Troubleshooting
---

**TLDR:** Find the process listening on the port with `lsof -i :PORT -sTCP:LISTEN` (Linux/macOS) or `netstat -ano | findstr :PORT` (Windows), then kill it with `kill PID` or `taskkill /PID pid`. For persistent services, stop them properly with `systemctl stop service` or the Services manager. Always identify what's using the port before killing it to avoid disrupting important services.

When you try to start a server or application and see "address already in use" or "port already in use," something else is bound to that port. Here's how to find what's using it and free it up.

## Linux: Find and Free Ports

### Find What's Using the Port

The most straightforward tool is `lsof` (list open files):

```bash
# Find what's using port 8080
sudo lsof -i :8080

# Output:
# COMMAND   PID   USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
# node    12345  john   21u  IPv4  98765      0t0  TCP *:8080 (LISTEN)
```

This tells you:
- `COMMAND`: The program name (`node`)
- `PID`: Process ID (`12345`)
- `USER`: Who owns the process (`john`)
- The port is in `LISTEN` state

If you prefer `ss` (socket statistics):

```bash
# Find listening process on port 8080
sudo ss -tulpn | grep :8080

# Output:
# tcp   LISTEN  0  128  *:8080  *:*  users:(("node",pid=12345,fd=21))
```

Two details make the `ss` output trustworthy. First, `grep :80` also matches `:8080`; an `ss` filter matches the port exactly. Second, `ss -p` shows the process only for sockets you own, so without `sudo` a port held by a system service looks like it has no owner:

```terminal
{
  "title": "exact port filters, and why you need sudo",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "ss -ltn | grep :80",
      "output": "LISTEN 0      5                                   127.0.0.1:8080       0.0.0.0:*"
    },
    {
      "cmd": "ss -ltn 'sport = :80'",
      "output": "State Recv-Q Send-Q Local Address:Port Peer Address:PortProcess"
    },
    {
      "cmd": "ss -ltnp 'sport = :22'",
      "output": "State  Recv-Q Send-Q Local Address:Port Peer Address:PortProcess\nLISTEN 0      128          0.0.0.0:22        0.0.0.0:*\nLISTEN 0      128             [::]:22           [::]:*"
    },
    {
      "cmd": "sudo ss -ltnp 'sport = :22'",
      "output": "State  Recv-Q Send-Q Local Address:Port Peer Address:PortProcess\nLISTEN 0      128          0.0.0.0:22        0.0.0.0:*    users:((\"sshd\",pid=788,fd=3))\nLISTEN 0      128             [::]:22           [::]:*    users:((\"sshd\",pid=788,fd=4))"
    }
  ]
}
```

`-l` lists listening sockets, `-t` TCP (`-u` for UDP), `-n` keeps port numbers instead of service names, and `-p` adds the process. For the remote side of connections, filter on `dport` instead: `ss -tn 'dport = :443'`.

Or use `netstat` (older but still available):

```bash
# Find listening process on port 8080
sudo netstat -tulpn | grep :8080

# Output:
# tcp  0  0  0.0.0.0:8080  0.0.0.0:*  LISTEN  12345/node
```

### Kill the Process

Once you have the PID, you can kill the process:

```bash
# Gracefully terminate (allows cleanup)
kill 12345

# Force kill if it doesn't respond
kill -9 12345

# Or in one command: only the process that listens on the port
sudo lsof -ti tcp:8080 -sTCP:LISTEN | xargs -r kill

# Or with fuser (psmisc)
sudo fuser -k -TERM 8080/tcp
```

The `-t` flag tells `lsof` to output only PIDs, making it easy to pipe to `kill`. Do not drop `-sTCP:LISTEN`. `lsof -i :8080` matches every socket with 8080 at either end, so it also lists programs that are only **connected** to the port: your browser, a `curl` loop, or the SSH tunnel you are working through. Here a server listens on 8080 and one client is connected to it:

```terminal
{
  "title": "lsof -i :8080 lists the client too",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "sudo lsof -i :8080",
      "output": "COMMAND     PID   USER   FD   TYPE   DEVICE SIZE/OFF NODE NAME\npython3 1506062 nobody    3u  IPv4 14289998      0t0  TCP localhost:http-alt (LISTEN)\npython3 1506062 nobody    4u  IPv4 14290018      0t0  TCP localhost:http-alt->localhost:42564 (ESTABLISHED)\npython3 1506065 nobody    3u  IPv4 14288983      0t0  TCP localhost:42564->localhost:http-alt (ESTABLISHED)"
    },
    {
      "cmd": "sudo lsof -ti :8080",
      "output": "1506062\n1506065"
    },
    {
      "cmd": "sudo lsof -ti :8080 -sTCP:LISTEN",
      "output": "1506062"
    },
    {
      "cmd": "sudo fuser 8080/tcp",
      "output": "8080/tcp:            1506062"
    },
    {
      "cmd": "sudo fuser -k -TERM 8080/tcp && sleep 1 && ss -ltn 'sport = :8080'",
      "output": "8080/tcp:            1506062\nState Recv-Q Send-Q Local Address:Port Peer Address:PortProcess"
    }
  ]
}
```

PID 1506065 is the client. `kill -9 $(lsof -ti :8080)` would have killed it too. `fuser 8080/tcp` checks only the local port, so it finds just the server. Without a signal, `fuser -k` sends SIGKILL, which gives the program no chance to clean up; pass `-TERM` first. Add `-n` and `-P` to `lsof` (`lsof -nP -iTCP:8080 -sTCP:LISTEN`) to see `127.0.0.1:8080` instead of `localhost:http-alt`.

### Stop a System Service

If the port is used by a system service, use `systemctl` instead of killing:

```bash
# Check if it's a systemd service
systemctl status nginx

# Stop the service gracefully
sudo systemctl stop nginx

# Prevent it from starting on boot
sudo systemctl disable nginx

# Or stop and disable in one command
sudo systemctl disable --now nginx
```

Stopping via `systemctl` is cleaner than killing - it allows proper shutdown and cleanup.

### Check for Services Running in Docker

If you're using Docker, the port might be occupied by a container:

```bash
# List containers using port mapping
docker ps --format "table {{.ID}}\t{{.Names}}\t{{.Ports}}"

# Output:
# CONTAINER ID   NAMES      PORTS
# a1b2c3d4e5f6   webapp     0.0.0.0:8080->80/tcp

# Stop the container
docker stop a1b2c3d4e5f6

# Or stop by name
docker stop webapp
```

## macOS: Find and Free Ports

macOS uses the same tools as Linux:

### Find What's Using the Port

```bash
# Find process using port 3000
lsof -i :3000

# Output:
# COMMAND   PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
# node    56789  sarah  21u  IPv4 0xabcdef123      0t0  TCP *:3000 (LISTEN)
```

You don't need `sudo` on macOS for `lsof` if you own the process.

### Kill the Process

```bash
# Kill by PID
kill 56789

# Or force kill
kill -9 56789

# One-liner to kill whatever's on port 3000
lsof -ti :3000 | xargs kill -9
```

### Stop macOS Services

For system services:

```bash
# List running services
launchctl list | grep -i apache

# Stop Apache (example)
sudo apachectl stop

# Or for other services
sudo launchctl unload /Library/LaunchDaemons/com.example.service.plist
```

## Windows: Find and Free Ports

Windows uses different tools but the concept is the same. [Close a port on Windows from the command line](/posts/how-to-close-tcp-and-udp-ports-via-windows-command-line) also covers firewall rules.

### Find What's Using the Port

```cmd
REM Find process using port 8080
netstat -ano | findstr :8080

REM Output:
REM TCP    0.0.0.0:8080    0.0.0.0:0    LISTENING    5432
REM                                                   ^^^^
REM                                                   PID
```

The last column is the process ID (PID). To find out what program that is:

```cmd
REM Get process details
tasklist /FI "PID eq 5432"

REM Output:
REM Image Name           PID Session Name     Session#    Mem Usage
REM node.exe            5432 Console                 1     45,678 K
```

Or use PowerShell for a cleaner view:

```powershell
# Find what's using port 8080
Get-NetTCPConnection -LocalPort 8080 |
    Select-Object LocalAddress, LocalPort, State, OwningProcess,
        @{Name="ProcessName";Expression={(Get-Process -Id $_.OwningProcess).Name}}

# Output:
# LocalAddress LocalPort State   OwningProcess ProcessName
# 0.0.0.0           8080 Listen          5432 node
```

### Kill the Process

```cmd
REM Kill process by PID
taskkill /PID 5432

REM Force kill if it doesn't respond
taskkill /PID 5432 /F

REM Kill by process name (kills all instances)
taskkill /IM node.exe /F
```

In PowerShell:

```powershell
# Kill process by PID
Stop-Process -Id 5432

# Force kill
Stop-Process -Id 5432 -Force

# Kill all node processes
Stop-Process -Name node -Force
```

### Stop Windows Services

For system services, use the Services manager or command line:

```cmd
REM Stop a service
net stop "Apache2.4"

REM Or use sc (service control)
sc stop Apache2.4
```

In PowerShell:

```powershell
# Stop a service
Stop-Service -Name "Apache2.4"

# Stop and disable
Stop-Service -Name "Apache2.4"
Set-Service -Name "Apache2.4" -StartupType Disabled
```

Or use the GUI:
1. Press `Win+R`, type `services.msc`, press Enter
2. Find the service in the list
3. Right-click → Stop

## Common Port Conflicts

### Port 80/443 (HTTP/HTTPS)

Usually occupied by a web server:

```bash
# Linux/macOS
sudo lsof -i :80
sudo lsof -i :443

# Likely culprits: apache2, nginx, httpd

# Stop Apache
sudo systemctl stop apache2   # Ubuntu/Debian
sudo systemctl stop httpd      # RHEL/CentOS

# Stop NGINX
sudo systemctl stop nginx
```

On Windows, check IIS:

```cmd
REM Stop IIS
iisreset /stop

REM Or stop the service
net stop W3SVC
```

### Port 3000 (Development Servers)

Often used by Node.js, React, Rails:

```bash
# Find and kill
lsof -ti :3000 | xargs kill -9

# Or on Windows
netstat -ano | findstr :3000
taskkill /PID <pid> /F
```

### Port 5432 (PostgreSQL)

```bash
# Linux
sudo systemctl stop postgresql

# macOS (Homebrew)
brew services stop postgresql

# Windows
net stop postgresql-x64-13
```

### Port 3306 (MySQL)

```bash
# Linux
sudo systemctl stop mysql

# macOS
brew services stop mysql

# Windows
net stop MySQL80
```

### Port 6379 (Redis)

```bash
# Linux
sudo systemctl stop redis

# macOS
brew services stop redis

# Windows
redis-cli shutdown
```

## Preventing Port Conflicts

### Configure Services to Use Different Ports

Instead of killing processes, change port configurations:

```bash
# NGINX - edit /etc/nginx/sites-available/default
server {
    listen 8080;  # Changed from 80
    ...
}

# Restart to apply
sudo systemctl restart nginx
```

For Node.js apps:

```javascript
// Use environment variable for port
const PORT = process.env.PORT || 3000;
app.listen(PORT);
```

Then start with a different port:

```bash
PORT=3001 node app.js
```

### Use Docker Port Mapping

Map container ports to different host ports:

```bash
# Map container port 80 to host port 8080
docker run -p 8080:80 nginx

# Multiple containers on different host ports
docker run -p 8080:80 nginx
docker run -p 8081:80 nginx
```

### Check Ports Before Starting

```bash
#!/bin/bash
# start-server.sh - Check port before starting

PORT=8080

if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
    echo "Port $PORT is already in use"
    echo "Process using port:"
    lsof -i :$PORT
    exit 1
else
    echo "Port $PORT is available"
    ./start-my-server.sh --port $PORT
fi
```

## When Ports Won't Free Up

Sometimes a port stays in TIME_WAIT state after you kill the process:

```bash
# Check port state
sudo ss -tan | grep :8080

# Output:
# TIME-WAIT  0      0      192.168.1.10:8080     192.168.1.100:54321
```

TIME_WAIT prevents immediate reuse of the port. Wait 30-120 seconds, or use `SO_REUSEADDR` in your application:

```python
import socket

sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
sock.bind(('0.0.0.0', 8080))
```

This lets your application bind immediately after the previous instance closed.

## Safety Checks Before Killing

Always verify what you're killing:

```bash
# Check process details
ps aux | grep 12345

# Check what files it has open
lsof -p 12345

# Check command line arguments
cat /proc/12345/cmdline | tr '\0' ' '
```

Don't kill processes unless you know what they are:
- System services might cause issues if killed
- Databases could corrupt data if not shut down properly
- Other users' processes aren't yours to kill (on shared systems)

## Automating Port Cleanup

For development, create a helper script:

```bash
#!/bin/bash
# free-port.sh - Free up a port

PORT=$1

if [ -z "$PORT" ]; then
    echo "Usage: $0 <port>"
    exit 1
fi

echo "Finding process using port $PORT..."
PID=$(lsof -ti :$PORT)

if [ -z "$PID" ]; then
    echo "No process is using port $PORT"
    exit 0
fi

echo "Port $PORT is used by PID $PID"
ps -p $PID -o comm=

read -p "Kill this process? (y/n) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    kill $PID
    echo "Process killed"
else
    echo "Cancelled"
fi
```

Usage:

```bash
chmod +x free-port.sh
./free-port.sh 8080
```

The key to freeing up a port is identifying what's using it first, then deciding the appropriate action - stopping a service cleanly, killing a hung process, or reconfiguring to use a different port. Always verify what you're stopping to avoid breaking production services or other users' work.
