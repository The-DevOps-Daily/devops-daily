---
title: 'How to Find the IP Address of an SSH Client'
excerpt: "Learn multiple ways to identify the IP address of clients connected to your SSH server, from environment variables to logs and active connection monitoring."
category:
  name: 'SSH'
  slug: 'ssh'
date: '2024-12-09'
publishedAt: '2024-12-09T14:00:00Z'
updatedAt: '2024-12-09T14:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - SSH
  - Networking
  - Security
  - Linux
  - Server Management
---

**TLDR:** Use the `SSH_CLIENT` or `SSH_CONNECTION` environment variables to get the client IP address from within an SSH session. For monitoring all active SSH connections, use `who`, `w`, or check `/var/log/auth.log`. The client IP is also available in SSH logs and can be accessed programmatically through the connection info.

When you're logged into a server via SSH, you might need to know the IP address of the client machine that connected. This is useful for security auditing, access control, debugging connection issues, or just understanding where connections are coming from.

## From Within an Active SSH Session

The simplest method when you're already connected is to check the SSH environment variables. SSH automatically sets several variables that contain connection information:

```bash
# Show the client IP address
echo $SSH_CLIENT
# Output: 192.168.1.100 54321 22
# Format: client_ip client_port server_port
```

The `SSH_CLIENT` variable contains three space-separated values: the client's IP address, the client's source port, and the server's SSH port (usually 22).

To extract just the IP address:

```bash
# Get only the client IP
echo $SSH_CLIENT | awk '{print $1}'
# Output: 192.168.1.100

# Or using cut
echo $SSH_CLIENT | cut -d' ' -f1
```

The `SSH_CONNECTION` variable provides similar information but includes the server's IP as well:

```bash
echo $SSH_CONNECTION
# Output: 192.168.1.100 54321 10.0.0.50 22
# Format: client_ip client_port server_ip server_port

# Extract client IP
echo $SSH_CONNECTION | awk '{print $1}'
```

You can use either variable - `SSH_CLIENT` is simpler if you only need the client IP, while `SSH_CONNECTION` is useful if you also need to know which server interface accepted the connection (helpful on multi-homed servers).

## Checking All Active SSH Connections

To see all currently logged-in users and their IP addresses, use the `who` or `w` commands:

```bash
# Show logged-in users with IP addresses
who
# Output:
# john     pts/0        2024-12-09 14:32 (192.168.1.100)
# sarah    pts/1        2024-12-09 14:45 (10.50.20.15)
```

The `w` command provides more detail, including what each user is doing:

```bash
w
# Output:
# USER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU WHAT
# john     pts/0    192.168.1.100    14:32    0.00s  0.12s  0.00s w
# sarah    pts/1    10.50.20.15      14:45    5:23   0.05s  0.05s vim config.yml
```

For a cleaner output with just IPs:

```bash
# List only IP addresses of connected clients
who | awk '{print $5}' | tr -d '()'

# Or with w
w -h | awk '{print $3}'
```

## Monitoring SSH Connections in Real-Time

To see active SSH connections at the network level, use `ss` or `netstat`:

```bash
# Show established SSH connections (port 22)
ss -tn state established '( dport = :22 or sport = :22 )'

# Output shows local and remote addresses
# Recv-Q Send-Q Local Address:Port  Peer Address:Port
# 0      0      10.0.0.50:22        192.168.1.100:54321
```

To extract just the client IPs from established connections:

```bash
# Get unique client IPs connected to SSH
ss -tn state established '( sport = :22 )' |
    awk 'NR>1 {print $4}' |
    cut -d: -f1 |
    sort -u

# Or with netstat (older systems)
netstat -tn | grep ':22.*ESTABLISHED' | awk '{print $5}' | cut -d: -f1 | sort -u
```

This shows all IP addresses with active SSH connections, even if they haven't fully logged in yet (useful for detecting connection attempts).

## From SSH Authentication Logs

SSH logs every connection attempt, successful or not. The location varies by distribution:

```bash
# Most Linux distributions (Debian, Ubuntu)
tail -f /var/log/auth.log | grep sshd

# Red Hat, CentOS, Fedora
tail -f /var/log/secure | grep sshd

# Or use journalctl on systemd systems
journalctl -u ssh -f
# or
journalctl -u sshd -f
```

Successful login entries look like:

```
Dec 09 14:32:15 server sshd[12345]: Accepted publickey for john from 192.168.1.100 port 54321 ssh2: RSA SHA256:abc123...
```

To extract recent successful logins with IPs:

```bash
# Last 20 successful SSH logins
grep "Accepted" /var/log/auth.log | tail -20

# Extract just the IPs from successful logins
grep "Accepted" /var/log/auth.log |
    awk '{print $(NF-3)}' |
    sort | uniq -c | sort -rn

# Output shows connection count per IP:
#   15 192.168.1.100
#    8 10.50.20.15
#    3 203.0.113.45
```

## Using the `last` Command

The `last` command shows login history from the wtmp database:

```bash
# Show recent SSH logins
last -a

# Output:
# john     pts/0        Mon Dec  9 14:32   still logged in    192.168.1.100
# sarah    pts/1        Mon Dec  9 14:45   still logged in    10.50.20.15
# john     pts/0        Mon Dec  9 09:15 - 12:30  (03:15)     192.168.1.100
```

To see only SSH sessions (not console logins):

```bash
# Filter for pts (pseudo-terminal, used by SSH)
last -a | grep pts

# Show last 10 SSH sessions for a specific user
last -a john | grep pts | head -10
```

## Creating a Script to Monitor Client Connections

Here's a practical script to monitor and log client connections:

```bash
#!/bin/bash
# ssh-client-monitor.sh - Track SSH client connections

log_connection() {
    # This runs when a user logs in
    # Call it from /etc/profile or ~/.bashrc

    if [ -n "$SSH_CLIENT" ]; then
        CLIENT_IP=$(echo $SSH_CLIENT | awk '{print $1}')
        TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
        LOGFILE="/var/log/ssh-connections.log"

        # Log the connection
        echo "$TIMESTAMP - User $USER logged in from $CLIENT_IP" >> "$LOGFILE"

        # Optional: Send alert for non-local IPs
        if ! [[ $CLIENT_IP =~ ^192\.168\. ]] && ! [[ $CLIENT_IP =~ ^10\. ]]; then
            echo "Warning: External SSH login from $CLIENT_IP by $USER at $TIMESTAMP" |
                mail -s "SSH Alert" admin@example.com
        fi
    fi
}

# If sourced in profile, log the connection
log_connection
```

Add this to `/etc/profile` or individual user profiles to track all SSH logins:

```bash
# Add to /etc/profile
if [ -f /usr/local/bin/ssh-client-monitor.sh ]; then
    source /usr/local/bin/ssh-client-monitor.sh
fi
```

## Programmatic Access in Scripts

When writing scripts that need to know the client IP:

```bash
#!/bin/bash
# Example: Block certain actions from specific networks

CLIENT_IP=$(echo $SSH_CLIENT | awk '{print $1}')

# Check if connection is from production network
if [[ $CLIENT_IP =~ ^10\.50\. ]]; then
    echo "Connection from production network detected"
    echo "Destructive commands are disabled"
    exit 1
fi

# Check if connection is local
if [[ $CLIENT_IP =~ ^127\.0\.0\.1$ ]] || [[ $CLIENT_IP =~ ^::1$ ]]; then
    echo "Local connection - full access granted"
fi

# Continue with script logic
echo "Client IP: $CLIENT_IP"
```

Or in Python, if you're running a Python script over SSH:

```python
import os

def get_ssh_client_ip():
    """Get the IP address of the SSH client."""
    ssh_client = os.environ.get('SSH_CLIENT', '')
    if ssh_client:
        return ssh_client.split()[0]
    return None

client_ip = get_ssh_client_ip()
if client_ip:
    print(f"Connected from: {client_ip}")

    # Example: Restrict access based on IP
    if client_ip.startswith('192.168.'):
        print("Local network access")
    else:
        print("External access - enabling audit logging")
else:
    print("Not connected via SSH")
```

## Distinguishing Between Direct and Proxied Connections

If users connect through a jump host or proxy, `SSH_CLIENT` shows the proxy's IP, not the original client:

```
Original Client (192.168.1.100)
    ↓
Jump Host (10.50.1.10)
    ↓
Destination Server (10.50.2.20)

# On destination server:
echo $SSH_CLIENT
# Shows: 10.50.1.10 (jump host, not original client)
```

To track the original client through a jump host, you need to pass the information explicitly:

```bash
# On the jump host, pass client IP as an environment variable
ssh -o SendEnv=ORIGINAL_CLIENT_IP user@destination.server

# Set ORIGINAL_CLIENT_IP on jump host in ~/.ssh/rc or profile:
export ORIGINAL_CLIENT_IP=$SSH_CLIENT

# On destination server, check both:
echo "Immediate connection from: $SSH_CLIENT"
echo "Original client: $ORIGINAL_CLIENT_IP"
```

Note that the receiving server needs to accept the custom environment variable in `/etc/ssh/sshd_config`:

```
AcceptEnv ORIGINAL_CLIENT_IP
```

## Finding Historical Connection Data

For long-term analysis of who's been connecting:

```bash
# Count connections per IP from auth.log
grep "Accepted" /var/log/auth.log* |
    awk '{print $(NF-3)}' |
    sort | uniq -c | sort -rn | head -20

# Show failed authentication attempts by IP
grep "Failed password" /var/log/auth.log* |
    awk '{print $(NF-3)}' |
    sort | uniq -c | sort -rn | head -20

# This helps identify brute-force attempts
```

For more sophisticated analysis, consider tools like `fail2ban` which automatically parse logs and can ban IPs with too many failed attempts.

The combination of environment variables for active sessions and log analysis for historical data gives you complete visibility into SSH client connections. For automated monitoring, integrate these checks into your server provisioning or security scanning workflows.
