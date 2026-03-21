---
title: 'Can Two Different Sockets Share a TCP Port?'
excerpt: "Understand how TCP port sharing works with SO_REUSEADDR and SO_REUSEPORT, when multiple sockets can bind to the same port, and the limitations you need to know."
category:
  name: 'Networking'
  slug: 'networking'
date: '2025-06-12'
publishedAt: '2025-06-12T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Networking
  - TCP
  - Sockets
  - Linux
  - Programming
  - Ports
---

**TLDR:** Yes, multiple sockets can share a port in specific scenarios. Different connections (unique combinations of local IP, local port, remote IP, remote port) can coexist on the same local port - this is how web servers handle multiple clients. Multiple processes can bind to the same port using `SO_REUSEPORT` (Linux 3.9+) for load balancing. `SO_REUSEADDR` lets you rebind a port in TIME_WAIT state but doesn't allow true sharing of listening ports.

The question "can two sockets share a port?" has different answers depending on what you mean by "share." Let's break down the scenarios.

## How TCP Connections Are Identified

A TCP connection is uniquely identified by a tuple of four values:

```
Connection = (Local IP, Local Port, Remote IP, Remote Port)

Example connections on port 80:
Connection 1: (192.168.1.10:80, 192.168.1.100:54321)
Connection 2: (192.168.1.10:80, 192.168.1.101:54322)
Connection 3: (192.168.1.10:80, 192.168.1.100:54323)

All three share local port 80, but they're different connections
```

As long as at least one element differs, connections are unique. This is how a single web server on port 80 handles thousands of clients simultaneously - each client connection has a different remote IP or remote port.

## Scenario 1: Server Accepting Multiple Connections (Always Allowed)

When a server binds to a port and listens, it creates one socket. When clients connect, the `accept()` call creates new sockets - one per connection:

```python
import socket

# Server socket - binds to port 8080
server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
server_socket.bind(('0.0.0.0', 8080))
server_socket.listen(5)

print("Server listening on port 8080")

while True:
    # Each accept() creates a new socket sharing port 8080
    client_socket, addr = server_socket.accept()
    print(f"New connection from {addr}")

    # client_socket is a new socket, but still uses local port 8080
    # Connection: (server_ip:8080, client_ip:client_port)

    # Handle the client (in real code, do this in a thread)
    data = client_socket.recv(1024)
    client_socket.sendall(data)
    client_socket.close()
```

Each `client_socket` is a separate socket object, but they all share the local port 8080. This is normal TCP behavior and always works. The operating system distinguishes connections by the remote address.

## Scenario 2: Binding Multiple Sockets to Same Port (Usually Fails)

By default, you cannot bind two separate sockets to the same port:

```python
import socket

# First socket binds successfully
sock1 = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock1.bind(('0.0.0.0', 8080))
print("Socket 1 bound to port 8080")

# Second socket fails with "Address already in use"
sock2 = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
try:
    sock2.bind(('0.0.0.0', 8080))
except OSError as e:
    print(f"Socket 2 failed: {e}")
    # Output: Socket 2 failed: [Errno 48] Address already in use
```

This protection prevents conflicts - if two programs could listen on the same port, incoming connections would be randomly assigned, causing chaos.

## Scenario 3: SO_REUSEADDR (Rebinding After Close)

`SO_REUSEADDR` lets you bind to a port that's in TIME_WAIT state. When a server closes a socket, the OS keeps the port reserved for a short period (typically 30-120 seconds) to handle any delayed packets:

```
Server closes connection:
Connection moves to TIME_WAIT state
Port 8080 is reserved for ~60 seconds
New bind() to port 8080 fails... unless SO_REUSEADDR is set
```

Here's how to use it:

```python
import socket

def create_server(port):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

    # Allow reusing the port immediately after close
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

    sock.bind(('0.0.0.0', port))
    sock.listen(5)
    return sock

# First server
server1 = create_server(8080)
print("Server started on port 8080")

# Stop and restart without waiting for TIME_WAIT
server1.close()

# Without SO_REUSEADDR, this would fail for ~60 seconds
# With SO_REUSEADDR, it works immediately
server2 = create_server(8080)
print("Server restarted on port 8080")
```

This is standard practice for server applications - you don't want to wait a minute to restart your server after a crash.

**Important:** `SO_REUSEADDR` does **not** let multiple processes bind and listen on the same port simultaneously on most systems. It only helps with rebinding after a close.

## Scenario 4: SO_REUSEPORT (True Port Sharing)

Linux 3.9+ and modern BSD systems support `SO_REUSEPORT`, which allows multiple sockets to bind to the same port:

```python
import socket
import os

def create_server_with_reuseport(port):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

    # Enable SO_REUSEPORT
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEPORT, 1)

    sock.bind(('0.0.0.0', port))
    sock.listen(5)
    return sock

# Process 1
server1 = create_server_with_reuseport(8080)
print(f"Server 1 (PID {os.getpid()}) bound to port 8080")

# Process 2 (in a different process, but shown here for illustration)
server2 = create_server_with_reuseport(8080)
print(f"Server 2 (PID {os.getpid()}) bound to port 8080")

# Both sockets are listening on port 8080
# Kernel distributes incoming connections between them
```

When a client connects, the kernel uses a hash of the connection tuple to pick which socket receives it. This provides load balancing across multiple processes:

```
Client 1 connects -> Kernel routes to server1
Client 2 connects -> Kernel routes to server2
Client 3 connects -> Kernel routes to server1
...
```

This is how modern web servers like NGINX can run multiple worker processes all listening on port 80.

### Real-World Example: Multi-Process Server

```python
import socket
import os
from multiprocessing import Process

def worker(worker_id):
    """Each worker process binds to the same port."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEPORT, 1)
    sock.bind(('0.0.0.0', 8080))
    sock.listen(5)

    print(f"Worker {worker_id} (PID {os.getpid()}) listening on port 8080")

    while True:
        client, addr = sock.accept()
        print(f"Worker {worker_id} handling {addr}")

        # Handle request
        client.sendall(f"Handled by worker {worker_id}\n".encode())
        client.close()

if __name__ == '__main__':
    # Start 4 worker processes, all listening on port 8080
    workers = []
    for i in range(4):
        p = Process(target=worker, args=(i,))
        p.start()
        workers.append(p)

    # Wait for workers
    for p in workers:
        p.join()
```

When you connect to port 8080, different workers handle different connections, providing parallel processing.

### Limitations of SO_REUSEPORT

1. **Same user ID:** Only processes with the same effective user ID can share a port (security measure)

2. **All or nothing:** Either all sockets use `SO_REUSEPORT` or none do. You can't mix.

3. **Load balancing is simple:** The kernel uses a hash function, not round-robin or connection count. Uneven distribution is possible.

4. **Platform support:** Linux 3.9+, modern BSDs. Not available on Windows or older systems.

## Scenario 5: Different IP Addresses

You can bind different sockets to the same port if they use different IP addresses:

```python
import socket

# Server with multiple network interfaces
# eth0: 192.168.1.10
# eth1: 10.0.0.5

# Bind to port 8080 on first interface
sock1 = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock1.bind(('192.168.1.10', 8080))
sock1.listen(5)

# Bind to port 8080 on second interface - this works!
sock2 = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock2.bind(('10.0.0.5', 8080))
sock2.listen(5)

print("Listening on 192.168.1.10:8080 and 10.0.0.5:8080")
```

This works because the bind addresses are different:
- `192.168.1.10:8080` vs `10.0.0.5:8080`

If you bind to `0.0.0.0:8080` (all interfaces), you cannot bind another socket to any specific IP on port 8080.

## Scenario 6: UDP Port Sharing

UDP works differently from TCP. With `SO_REUSEADDR`, multiple UDP sockets can bind to the same port:

```python
import socket

# First UDP socket
sock1 = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock1.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
sock1.bind(('0.0.0.0', 9090))

# Second UDP socket on same port
sock2 = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock2.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
sock2.bind(('0.0.0.0', 9090))

# Both receive the same packets (multicast-like behavior)
```

Both sockets receive a copy of each incoming packet. This is useful for:
- Multiple processes monitoring the same data
- Service discovery protocols
- Multicast receivers

## Checking What's Using a Port

When debugging port conflicts, check what's bound:

```bash
# Linux - show process using port 8080
sudo lsof -i :8080
# or
sudo ss -tulpn | grep :8080

# macOS
sudo lsof -i :8080

# Windows
netstat -ano | findstr :8080
```

You'll see output like:

```
COMMAND   PID   USER   FD   TYPE   DEVICE SIZE/OFF NODE NAME
python    1234  john   3u   IPv4   98765  0t0      TCP *:8080 (LISTEN)
python    1235  john   3u   IPv4   98766  0t0      TCP *:8080 (LISTEN)
```

If you see multiple processes with the same port, they're using `SO_REUSEPORT`.

## Common Mistakes

### Forgetting SO_REUSEADDR on Servers

```python
# Wrong - server won't restart quickly after crash
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.bind(('0.0.0.0', 8080))

# Right - server can restart immediately
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
sock.bind(('0.0.0.0', 8080))
```

### Using SO_REUSEPORT Without Understanding Distribution

```python
# This doesn't give you control over which worker gets which connection
sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEPORT, 1)

# If you need specific routing logic, use a single listening socket
# and distribute connections yourself
```

### Assuming Port Sharing Works Everywhere

```python
# This might fail on Windows or old Linux
sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEPORT, 1)

# Check if SO_REUSEPORT is defined
if hasattr(socket, 'SO_REUSEPORT'):
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEPORT, 1)
else:
    print("SO_REUSEPORT not supported on this platform")
```

## When to Use Port Sharing

**Use `SO_REUSEADDR`:**
- Always, for server applications
- Allows quick restart after crashes
- Standard practice

**Use `SO_REUSEPORT`:**
- Multi-process servers for parallel processing
- Taking advantage of multiple CPU cores
- When you want the kernel to load balance
- Only when available on your platform

**Use multiple IPs with same port:**
- When you want different services on different interfaces
- Internal vs external access on same port
- Segregating traffic by network

Two sockets can share a port in multiple ways - through accepting multiple connections on a listening socket, using `SO_REUSEPORT` for multi-process load balancing, or binding to different IP addresses. Understanding these mechanisms helps you build robust, high-performance network applications.
