---
title: 'Increasing the Maximum Number of TCP/IP Connections in Linux'
excerpt: 'Learn how to tune Linux kernel parameters to handle more TCP connections for high-traffic servers. Adjust file descriptors, TCP backlog, port ranges, and connection tracking limits to scale your applications.'
category:
  name: 'Linux'
  slug: 'linux'
date: '2025-03-20'
publishedAt: '2025-03-20T10:30:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Linux
  - Networking
  - Performance
  - Tuning
  - System Administration
---

Linux systems ship with conservative default limits for network connections, which work fine for typical workloads but become bottlenecks for high-traffic servers, load balancers, or applications handling thousands of concurrent connections. When you hit these limits, you'll see errors like "too many open files" or connections timing out even though your server has plenty of CPU and memory available.

This guide explains how to identify and adjust the various Linux kernel parameters that limit TCP/IP connections, allowing your system to handle significantly more simultaneous connections.

## TLDR

Increase file descriptor limits (controls max open sockets), expand the local port range for outbound connections, raise TCP connection backlog queue sizes, and tune TCP TIME_WAIT settings. Key files to modify: `/etc/security/limits.conf` for file descriptors, `/etc/sysctl.conf` for kernel parameters. Use `sysctl -w` to apply changes immediately. For very high connection counts (100k+), also adjust conntrack table size.

## Prerequisites

You need root access to modify system parameters. Basic understanding of how TCP connections work helps you grasp which limits affect your use case. Familiarity with editing system configuration files and restarting services is useful.

## Understanding the Limits

Several different limits affect how many TCP connections your system can handle:

**File descriptors**: Each TCP connection uses a file descriptor. Default limits are often 1024 per process.

**Ephemeral ports**: Outbound connections need local ports. Default range provides about 28,000 ports.

**TCP backlog**: Limits queued incoming connections waiting to be accepted.

**Connection tracking**: Firewall/netfilter tracks connections. Default limit is often too low for high-traffic servers.

**System-wide limits**: Maximum open files across all processes.

Let's address each one.

## Increasing File Descriptor Limits

File descriptors are the most common bottleneck.

### Check Current Limits

```bash
# Per-process soft limit
ulimit -n

# Per-process hard limit
ulimit -Hn

# System-wide limit
cat /proc/sys/fs/file-max
```

Default output might show:

```
1024        # Soft limit per process
4096        # Hard limit per process
185688      # System-wide maximum
```

### Increase Per-Process Limits

Edit `/etc/security/limits.conf`:

```bash
sudo nano /etc/security/limits.conf
```

Add these lines:

```
*  soft  nofile  65536
*  hard  nofile  65536
root  soft  nofile  65536
root  hard  nofile  65536
```

This sets the limit to 65,536 file descriptors for all users.

For specific users or applications:

```
nginx  soft  nofile  100000
nginx  hard  nofile  100000
```

**Note**: Changes take effect on new login sessions. Existing sessions keep their old limits.

### Increase System-Wide Limit

Edit `/etc/sysctl.conf`:

```bash
sudo nano /etc/sysctl.conf
```

Add:

```
fs.file-max = 2097152
```

Apply immediately:

```bash
sudo sysctl -p
```

Verify:

```bash
cat /proc/sys/fs/file-max
```

### For systemd Services

If you're running a service via systemd (like Nginx or Node.js), set limits in the service file:

```bash
sudo nano /etc/systemd/system/myapp.service
```

Add under `[Service]`:

```
[Service]
LimitNOFILE=65536
```

Reload systemd and restart the service:

```bash
sudo systemctl daemon-reload
sudo systemctl restart myapp
```

## Expanding the Local Port Range

For making outbound connections (like a reverse proxy or API client), you're limited by the number of available local ports.

### Check Current Range

```bash
cat /proc/sys/net/ipv4/ip_local_port_range
```

Default:

```
32768   60999
```

This gives about 28,000 ports for outbound connections.

### Increase Port Range

Edit `/etc/sysctl.conf`:

```
net.ipv4.ip_local_port_range = 1024 65535
```

This expands the range to about 64,000 ports.

Apply:

```bash
sudo sysctl -p
```

**Note**: Ports below 1024 are privileged. Starting at 1024 is safe. Don't go below 1024 unless you have a specific reason.

## Increasing TCP Connection Backlog

The backlog queue holds incoming connections waiting to be accepted by your application.

### TCP SYN Backlog

Controls how many half-open connections the kernel queues:

```bash
# Check current value
cat /proc/sys/net/ipv4/tcp_max_syn_backlog
```

Default is often 1024 or 2048.

Increase it:

```
net.ipv4.tcp_max_syn_backlog = 8192
```

### Application Listen Backlog

Your application also specifies a backlog when calling `listen()`. In most languages:

**Node.js:**
```javascript
server.listen(3000, () => {
  // Default backlog is 511
});

// Increase it
server.listen(3000, null, 1024, () => {
  console.log('Server listening with backlog of 1024');
});
```

**Python:**
```python
import socket

sock = socket.socket()
sock.bind(('0.0.0.0', 8000))
sock.listen(1024)  # Set backlog to 1024
```

**Nginx:**
```nginx
# In nginx.conf
events {
    worker_connections 4096;
}

http {
    server {
        listen 80 backlog=4096;
    }
}
```

### Maximum Listen Backlog

The kernel has a maximum listen backlog:

```bash
# Check current value
cat /proc/sys/net/core/somaxconn
```

Default is often 128, which is very low.

Increase it:

```
net.core.somaxconn = 4096
```

## Handling TIME_WAIT Connections

When a connection closes, it enters TIME_WAIT state for 60 seconds by default. This can exhaust your port pool on high-traffic servers.

### Allow Port Reuse

```
net.ipv4.tcp_tw_reuse = 1
```

This allows reusing ports in TIME_WAIT for outbound connections.

**Important**: Only enable this for clients making many outbound connections (like reverse proxies). Don't enable it on servers accepting inbound connections.

### Reduce TIME_WAIT Duration (Not Recommended)

You can reduce the TIME_WAIT timeout, but this risks connection problems:

```
# Not recommended - can cause issues
net.ipv4.tcp_fin_timeout = 30
```

The default 60 seconds exists for good reasons (preventing old packets from interfering with new connections). Only reduce this if you understand the implications.

## Increasing Connection Tracking Limits

If you're using a firewall (iptables/netfilter), it tracks connections. This has limits too.

### Check Current Conntrack Table Size

```bash
cat /proc/sys/net/netfilter/nf_conntrack_max
```

### Check Current Usage

```bash
cat /proc/sys/net/netfilter/nf_conntrack_count
```

If count approaches max, you'll see connection failures.

### Increase Conntrack Table

```
net.netfilter.nf_conntrack_max = 262144
```

Also increase the hash table size:

```
net.netfilter.nf_conntrack_buckets = 65536
```

Apply:

```bash
sudo sysctl -p
```

**Memory impact**: Conntrack uses memory. Each entry uses about 300 bytes, so 262,144 entries ≈ 75MB RAM.

## TCP Tuning for High Connections

Additional TCP parameters that help with many concurrent connections:

```
# Increase receive and send buffers
net.core.rmem_max = 134217728
net.core.wmem_max = 134217728
net.ipv4.tcp_rmem = 4096 87380 134217728
net.ipv4.tcp_wmem = 4096 65536 134217728

# Increase network device backlog
net.core.netdev_max_backlog = 5000

# Disable TCP slow start after idle
net.ipv4.tcp_slow_start_after_idle = 0

# Enable TCP window scaling
net.ipv4.tcp_window_scaling = 1

# Increase maximum number of orphaned sockets
net.ipv4.tcp_max_orphans = 65536
```

## Complete sysctl Configuration

Here's a comprehensive `/etc/sysctl.conf` for high-connection servers:

```bash
# File system limits
fs.file-max = 2097152

# Network core
net.core.somaxconn = 4096
net.core.netdev_max_backlog = 5000
net.core.rmem_max = 134217728
net.core.wmem_max = 134217728

# TCP settings
net.ipv4.tcp_max_syn_backlog = 8192
net.ipv4.tcp_rmem = 4096 87380 134217728
net.ipv4.tcp_wmem = 4096 65536 134217728
net.ipv4.tcp_window_scaling = 1
net.ipv4.tcp_slow_start_after_idle = 0

# TCP port and connection handling
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_max_orphans = 65536

# Connection tracking (if using iptables)
net.netfilter.nf_conntrack_max = 262144
net.netfilter.nf_conntrack_buckets = 65536
```

Apply all settings:

```bash
sudo sysctl -p
```

## Monitoring Your Limits

Check if you're hitting limits:

### File Descriptors

```bash
# System-wide file descriptor usage
cat /proc/sys/fs/file-nr
```

Output:

```
5120    0    2097152
│       │    │
│       │    └─ Maximum file descriptors
│       └────── Always 0 (historical)
└────────────── Currently open file descriptors
```

### Per-Process File Descriptors

```bash
# For a specific process
ls /proc/<PID>/fd | wc -l

# Or using lsof
lsof -p <PID> | wc -l
```

### Port Usage

```bash
# Count connections in TIME_WAIT
netstat -an | grep TIME_WAIT | wc -l

# Count all TCP connections
netstat -an | grep tcp | wc -l

# See port usage distribution
ss -s
```

### Connection Tracking

```bash
# Check conntrack usage
cat /proc/sys/net/netfilter/nf_conntrack_count
cat /proc/sys/net/netfilter/nf_conntrack_max
```

## Testing Your Changes

Verify your server can handle the increased connections:

### Using Apache Bench

```bash
# Test with 10,000 concurrent connections
ab -n 100000 -c 10000 http://localhost/
```

### Using wrk

```bash
# More realistic HTTP benchmarking
wrk -t4 -c10000 -d30s http://localhost/
```

Watch for errors about too many open files or connection failures.

## Application-Specific Tuning

Different applications have their own limits:

### Nginx

```nginx
events {
    worker_connections 10000;
    use epoll;
}

worker_processes auto;
worker_rlimit_nofile 100000;
```

### Apache

```apache
# In mpm_worker.conf or mpm_event.conf
<IfModule mpm_worker_module>
    ServerLimit           250
    StartServers          10
    MinSpareThreads       75
    MaxSpareThreads       250
    ThreadsPerChild       64
    MaxRequestWorkers     16000
    MaxConnectionsPerChild 0
</IfModule>
```

### Node.js

```javascript
// Increase max listeners
require('events').EventEmitter.defaultMaxListeners = 100;

// Use clustering to utilize all CPU cores
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }
} else {
    // Worker processes
    app.listen(3000);
}
```

## Troubleshooting Common Issues

### "Too many open files" Error

**Cause**: File descriptor limit reached.

**Solution**: Increase `ulimit -n` and `fs.file-max`.

### "Cannot assign requested address"

**Cause**: Out of ephemeral ports.

**Solution**: Increase `ip_local_port_range` or enable `tcp_tw_reuse`.

### Connections Hang or Timeout

**Cause**: SYN backlog queue full.

**Solution**: Increase `tcp_max_syn_backlog` and `somaxconn`.

### "nf_conntrack: table full"

**Cause**: Connection tracking table exhausted.

**Solution**: Increase `nf_conntrack_max` or disable connection tracking if not needed.

Increasing TCP/IP connection limits on Linux involves adjusting multiple parameters across different system layers. Start by increasing file descriptor limits and expanding the ephemeral port range. For very high connection counts, tune TCP backlog queues, connection tracking, and TCP-specific kernel parameters. Always test your changes under realistic load to make sure they're effective and monitor your system to detect when you approach the new limits.
