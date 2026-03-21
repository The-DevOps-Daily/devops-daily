---
title: 'How Do SO_REUSEADDR and SO_REUSEPORT Differ?'
excerpt: "Understand the difference between SO_REUSEADDR and SO_REUSEPORT socket options, when to use each one, and how they solve different problems in network programming."
category:
  name: 'Networking'
  slug: 'networking'
date: '2025-03-15'
publishedAt: '2025-03-15T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Networking
  - Sockets
  - TCP
  - Programming
  - Linux
---

You're writing a server application and you keep seeing `SO_REUSEADDR` and `SO_REUSEPORT` socket options. What's the difference between them, and when should you use each one?

## TL;DR

`SO_REUSEADDR` allows binding to a port that's in TIME_WAIT state after a previous connection closed, and lets multiple sockets bind to the same port if they're on different IP addresses. `SO_REUSEPORT` allows multiple processes to bind to the exact same IP:port combination, with the kernel load-balancing connections between them. Use `SO_REUSEADDR` for quick server restarts and binding to multiple interfaces. Use `SO_REUSEPORT` for multi-process servers that want to share a port.

These socket options solve different problems in network programming, and understanding them helps you build more robust and efficient servers.

When you bind a socket to a port, the operating system tracks which ports are in use. These socket options modify the rules about port reuse.

## SO_REUSEADDR: Reusing Ports in TIME_WAIT

When a TCP connection closes, it enters a TIME_WAIT state (typically 60-120 seconds) to handle delayed packets. During this time, the port is still technically "in use."

Without `SO_REUSEADDR`:

```python
import socket

# First run works fine
server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
server.bind(('0.0.0.0', 8080))
server.listen(5)
# ... server runs and then stops

# Second run immediately after fails:
# socket.error: [Errno 98] Address already in use
```

With `SO_REUSEADDR`:

```python
import socket

server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
server.bind(('0.0.0.0', 8080))
server.listen(5)
# Works immediately, even if port is in TIME_WAIT
```

This is the most common use case: allowing you to restart your server without waiting for TIME_WAIT to expire.

## SO_REUSEADDR: Binding to Multiple Addresses

`SO_REUSEADDR` also allows binding to the same port on different IP addresses:

```python
# Server 1: Bind to specific interface
sock1 = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock1.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
sock1.bind(('192.168.1.100', 8080))

# Server 2: Bind to different interface, same port
sock2 = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock2.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
sock2.bind(('192.168.1.101', 8080))
# Both succeed
```

This is useful when you have multiple network interfaces and want to run different services on each.

## SO_REUSEPORT: Multiple Processes Sharing a Port

`SO_REUSEPORT` (Linux 3.9+) solves a different problem: allowing multiple processes to bind to the exact same address and port.

Without `SO_REUSEPORT`:

```python
# Process 1
sock1 = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock1.bind(('0.0.0.0', 8080))  # Works

# Process 2
sock2 = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock2.bind(('0.0.0.0', 8080))  # Fails: Address already in use
```

With `SO_REUSEPORT`:

```python
# Process 1
sock1 = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock1.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEPORT, 1)
sock1.bind(('0.0.0.0', 8080))  # Works

# Process 2
sock2 = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock2.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEPORT, 1)
sock2.bind(('0.0.0.0', 8080))  # Also works!
```

The kernel distributes incoming connections across all processes listening on the port.

## Load Balancing with SO_REUSEPORT

When multiple processes use `SO_REUSEPORT`, the kernel automatically load-balances:

```python
# worker.py
import socket

def start_worker(worker_id):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEPORT, 1)
    sock.bind(('0.0.0.0', 8080))
    sock.listen(100)

    print(f"Worker {worker_id} listening on port 8080")

    while True:
        client, addr = sock.accept()
        print(f"Worker {worker_id} handling connection from {addr}")
        # Handle client...
        client.close()

if __name__ == '__main__':
    import sys
    worker_id = sys.argv[1]
    start_worker(worker_id)
```

Run multiple workers:

```bash
python worker.py 1 &
python worker.py 2 &
python worker.py 3 &
python worker.py 4 &
```

Incoming connections are distributed across all four workers by the kernel's load-balancing algorithm (usually based on a hash of the connection 4-tuple).

## Practical Example: Web Server with Worker Processes

A simple multi-process HTTP server:

```python
#!/usr/bin/env python3
import socket
import os
import sys

def handle_request(client_socket):
    request = client_socket.recv(1024).decode()
    response = (
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: text/plain\r\n"
        "\r\n"
        f"Hello from process {os.getpid()}\n"
    )
    client_socket.sendall(response.encode())
    client_socket.close()

def start_worker():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEPORT, 1)
    server.bind(('0.0.0.0', 8080))
    server.listen(100)

    print(f"Worker {os.getpid()} started")

    while True:
        client, addr = server.accept()
        handle_request(client)

if __name__ == '__main__':
    num_workers = int(sys.argv[1]) if len(sys.argv) > 1 else 4

    for _ in range(num_workers):
        pid = os.fork()
        if pid == 0:  # Child process
            start_worker()
            sys.exit(0)

    # Parent waits
    os.wait()
```

Run it:

```bash
python3 multiprocess_server.py 4
```

Each HTTP request is handled by a different worker process.

## When to Use Each Option

**Use SO_REUSEADDR when:**

- You want to restart your server quickly without waiting for TIME_WAIT
- You need to bind to the same port on different IP addresses
- You're writing any server that needs reliable restarts

**Use SO_REUSEPORT when:**

- You want multiple processes to share load on the same port
- You're implementing a multi-process server architecture
- You want kernel-level load balancing instead of accept serialization

## Combining Both Options

You can use both together:

```python
server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEPORT, 1)
server.bind(('0.0.0.0', 8080))
```

This gives you both benefits: quick restarts and multi-process capability.

## Platform Differences

`SO_REUSEADDR` behavior varies by operating system:

**Linux:**
- Allows binding to TIME_WAIT ports
- Allows binding to same port on different IPs

**BSD/macOS:**
- More permissive - can cause unexpected behavior
- Be cautious with wildcard binds (0.0.0.0)

**Windows:**
- Different semantics entirely
- Use `SO_EXCLUSIVEADDRUSE` for exclusive binding

`SO_REUSEPORT` is Linux-specific (and some BSD variants). It doesn't exist on Windows.

## Security Considerations

`SO_REUSEPORT` has a security implication: any process can bind to a port if the first process used `SO_REUSEPORT`, potentially intercepting traffic.

To prevent this, the kernel requires:
- Same user ID (UID) for all processes using the port
- Or capabilities/privileges to override

Example of the problem:

```python
# Malicious process trying to steal connections
evil_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
evil_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEPORT, 1)
evil_socket.bind(('0.0.0.0', 8080))
# Fails if not the same UID as the legitimate server
```

## Performance Benefits

`SO_REUSEPORT` can improve performance by:

1. **Reducing lock contention**: Each worker has its own accept queue
2. **CPU cache efficiency**: Connections stick to the same CPU/process
3. **Parallel accept**: Multiple processes can accept simultaneously

Benchmark comparison:

```
Single process with SO_REUSEADDR:
  Requests/sec: 15,000

Four processes with SO_REUSEPORT:
  Requests/sec: 58,000
```

The improvement comes from parallel processing and reduced serialization.

## Example: Node.js Cluster with SO_REUSEPORT

Node.js cluster module uses `SO_REUSEPORT` under the hood (on Linux):

```javascript
const cluster = require('cluster');
const http = require('http');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }
} else {
    http.createServer((req, res) => {
        res.writeHead(200);
        res.end(`Hello from worker ${process.pid}\n`);
    }).listen(8080);
}
```

Each worker binds to port 8080 using `SO_REUSEPORT`, and the kernel distributes connections.

## Debugging Socket Options

Check if a port is using these options:

```bash
# On Linux, check socket options
ss -tlnp | grep 8080

# More detailed socket info
lsof -i :8080

# See socket details
cat /proc/net/tcp
```

In code, verify the options are set:

```python
import socket

sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

# Check if option is set
reuse = sock.getsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR)
print(f"SO_REUSEADDR: {reuse}")  # 1 if enabled
```

## Common Mistakes

**Mistake 1: Forgetting SO_REUSEADDR in servers**

Without it, you'll wait up to 2 minutes between restarts.

**Mistake 2: Using SO_REUSEPORT without understanding load distribution**

Connections aren't evenly distributed - they're hashed. Some workers may get more traffic.

**Mistake 3: Assuming SO_REUSEPORT works everywhere**

It's Linux 3.9+ specific. Check for availability:

```python
import socket

if hasattr(socket, 'SO_REUSEPORT'):
    print("SO_REUSEPORT available")
else:
    print("SO_REUSEPORT not available")
```

`SO_REUSEADDR` lets you restart servers quickly and bind to multiple interfaces. `SO_REUSEPORT` lets you run multiple processes on the same port for parallel processing. Use `SO_REUSEADDR` for almost all servers, and add `SO_REUSEPORT` when you need multi-process load balancing.
