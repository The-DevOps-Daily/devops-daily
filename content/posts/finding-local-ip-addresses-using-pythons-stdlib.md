---
title: "Finding Local IP Addresses Using Python's stdlib"
excerpt: "Learn how to find the local IP address of your machine using only Python's standard library. No third-party packages required."
category:
  name: 'Python'
  slug: 'python'
date: '2024-09-15'
publishedAt: '2024-09-15T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Python
  - Networking
  - IP
  - stdlib
  - DevOps
---

If you're building a tool that interacts with the network or you just need to know which IP address your machine is using on the local network, Python's standard library gives you what you need. No need to install any third-party libraries.

In this post, you'll see a few different ways to find your local IP address using built-in modules like `socket`, `ipaddress`, and `fcntl` (Linux/macOS only).

## Prerequisites

- Python 3.6 or newer
- A local machine with network access
- Terminal access

This guide works on Linux, macOS, and Windows, with some OS-specific notes where needed.

## Method 1: Use `socket.gethostbyname()` (Simple, but Limited)

The `socket` module can resolve your hostname to an IP address. This is a quick way to get the local IP, but it doesn't always return the correct address if multiple interfaces are in use.

```python
import socket

hostname = socket.gethostname()
ip_address = socket.gethostbyname(hostname)

print(f"Local IP address: {ip_address}")
```

**Why it matters:**

- Very simple and portable
- Might return `127.0.0.1` if DNS isn't set up properly

Good for scripts where a rough approximation is enough.

## Method 2: Use `socket` with a UDP Socket (More Reliable)

This method creates a dummy connection to an external IP (like Google DNS) without actually sending any data. It works reliably across platforms.

```python
import socket

def get_local_ip():
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        try:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
        except OSError:
            return "127.0.0.1"

print(f"Local IP address: {get_local_ip()}")
```

**Why it matters:**

- Doesn't require sending traffic
- More accurate in multi-interface setups
- Works well for identifying the main outbound interface

This is the go-to method in most real-world scripts.

## Method 3: List All Interfaces (Linux/macOS)

On Unix-based systems, you can list all network interfaces and their IP addresses using the `fcntl` module. This gives you full visibility into all connected interfaces.

```python
import socket
import fcntl
import struct
import array

def get_all_ips():
    max_interfaces = 128
    bytes = max_interfaces * 32
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    names = array.array("B", b"\0" * bytes)
    outbytes = struct.unpack("iL", fcntl.ioctl(
        s.fileno(), 0x8912, struct.pack("iL", bytes, names.buffer_info()[0])
    ))[0]
    namestr = names.tobytes()
    result = []
    for i in range(0, outbytes, 40):
        name = namestr[i:i+16].split(b"\0", 1)[0].decode()
        ip = socket.inet_ntoa(namestr[i+20:i+24])
        result.append((name, ip))
    return result

for iface, ip in get_all_ips():
    print(f"{iface}: {ip}")
```

**Why it matters:**

- Full list of active interfaces
- No external calls or assumptions
- Great for network diagnostics tools

This doesn't work on Windows, but it's helpful on servers and dev machines.

## Method 4: Use `ipaddress` for Validation

Sometimes you'll want to validate that an address is actually private (like `192.168.x.x` or `10.x.x.x`). The `ipaddress` module can help.

```python
import ipaddress

ip = "192.168.1.101"
parsed = ipaddress.ip_address(ip)

if parsed.is_private:
    print(f"{ip} is a private IP address")
else:
    print(f"{ip} is public or reserved")
```

**Why it matters:**

- Quickly check if an address is local
- Useful for access control or logging

Combine this with Method 2 to ensure you're working with a valid LAN address.

---

If you need a simple local IP, the UDP socket trick (Method 2) is usually the most reliable and portable. For full interface listings, Method 3 gives you everything, if you're on Linux or macOS.

Try combining these methods in a utility module to reuse across projects.
