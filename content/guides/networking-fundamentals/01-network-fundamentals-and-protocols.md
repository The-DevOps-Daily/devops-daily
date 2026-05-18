---
title: 'Network Fundamentals and Protocols'
description: 'How applications talk over networks: the OSI model, TCP vs UDP, IP addressing, ports, and DNS resolution explained with traceable curl and tcpdump examples.'
order: 1
---

When your application connects to a database, serves web traffic, or calls an external API, it's using network protocols to move data reliably between systems. Understanding these protocols helps you troubleshoot issues, optimize performance, and design better distributed systems.

## Prerequisites

- A computer with terminal access
- Basic familiarity with running commands

## How Applications Actually Communicate

Your application doesn't directly "talk" to a database server. Instead, data gets packaged up, addressed, and sent through multiple network devices before reaching its destination. Think of it like sending a letter - it goes through sorting facilities and postal workers before arriving.

```
┌─────────────┐    ┌─────────┐    ┌─────────┐    ┌─────────────┐
│Your Computer│────│Router 1 │────│Router 2 │────│GitHub Server│
│             │    │         │    │         │    │             │
│   curl      │    │ ISP     │    │Internet │    │ api.github  │
│   command   │    │Gateway  │    │Backbone │    │    .com     │
└─────────────┘    └─────────┘    └─────────┘    └─────────────┘
```

When you run `curl https://api.github.com`, here's what actually happens:

1. Your computer looks up the IP address for `api.github.com`
2. It establishes a connection to that IP address on port 443
3. It sends an HTTP request over an encrypted TLS connection
4. GitHub's servers process the request and send back a response
5. Your computer receives and displays the data

Each step involves different networking protocols working together.

## The Network Stack in Practice

Networking is often explained with the OSI model's seven layers, but you really only need to understand a few key layers for practical troubleshooting:

**Network Layer (IP)**: Gets data to the right machine using IP addresses
**Transport Layer (TCP/UDP)**: Ensures reliable delivery and handles ports
**Application Layer (HTTP/SSH/DNS)**: The protocols your applications actually use

When debugging network problems, you typically work bottom-up through these layers. Can you reach the IP address? Is the port open? Is the application responding correctly?

## What is the OSI Model?

The OSI (Open Systems Interconnection) model is a conceptual framework that standardizes the functions of a telecommunication or computing system into seven abstraction layers. It helps understand how different networking protocols interact.

| Layer | Name              | Description                                          |
| ----- | ----------------- | ---------------------------------------------------- |
| 7     | Application       | User interface and application protocols (HTTP, FTP) |
| 6     | Presentation      | Data format translation (encryption, compression)    |
| 5     | Session           | Establishes, manages, and terminates connections     |
| 4     | Transport         | Reliable data transfer (TCP, UDP)                    |
| 3     | Network           | Routing and addressing (IP)                          |
| 2     | Data Link         | Physical addressing (MAC addresses)                  |
| 1     | Physical          | Physical transmission of data (cables, signals)      |
| 0     | Network Interface | Hardware and drivers for network interfaces          |

The OSI model is a theoretical framework. In practice, most protocols don't fit neatly into one layer. For example, HTTP operates at the application layer but relies on TCP at the transport layer.

The OSI model is useful for understanding how different protocols interact, but you don't need to memorize it. Focus on the practical aspects of networking that apply to your work.

## IP Addresses and Ports

Every network communication needs two pieces of information: where to send the data (IP address) and which service should handle it (port number).

Let's check what's currently running on your machine:

```bash
# See what services are listening for connections
netstat -tuln
```

You'll see output like this:

```
Proto Recv-Q Send-Q Local Address           Foreign Address         State
tcp   0      0      0.0.0.0:22              0.0.0.0:*               LISTEN
tcp   0      0      127.0.0.1:5432          0.0.0.0:*               LISTEN
tcp   0      0      :::80                   :::*                    LISTEN
```

This shows SSH listening on port 22 for all IP addresses (`0.0.0.0`), PostgreSQL listening on port 5432 but only for local connections (`127.0.0.1`), and a web server listening on port 80 for both IPv4 and IPv6.

Here are the most common ports you'll encounter:

```bash
22   # SSH - secure shell access
53   # DNS - domain name resolution
80   # HTTP - web traffic
443  # HTTPS - encrypted web traffic
3306 # MySQL database
5432 # PostgreSQL database
6379 # Redis cache
8080 # Alternative HTTP port (common in development)
```

## TCP vs UDP: Reliability vs Speed

Networks offer two main ways to send data, each optimized for different use cases.

### TCP: Guaranteed Delivery

TCP ensures your data arrives in order and without errors. It's like certified mail - you get confirmation that it was delivered.

Let's see TCP in action by making an HTTP request:

```bash
# Make a request and see the full conversation
curl -v http://httpbin.org/get
```

You'll see the connection establishment (TCP handshake), the HTTP request, and the response. TCP handles all the reliability details automatically.

TCP is perfect for:

- Web applications (HTTP/HTTPS)
- Database connections
- File transfers
- Any situation where losing data would be a problem

### UDP: Fast but No Guarantees

UDP is faster because it doesn't verify delivery. It's like regular mail - usually gets there, but no confirmation.

DNS typically uses UDP because it's fast and losing a single query isn't critical:

```bash
# DNS lookup uses UDP by default
dig google.com
```

UDP works well for:

- DNS queries (can easily retry if needed)
- Video streaming (losing a few frames is better than delays)
- Real-time gaming (speed matters more than perfect data)
- Monitoring metrics (losing an occasional data point is acceptable)

## Testing Network Connectivity

Before diving into application-specific debugging, test basic network connectivity.

### Basic Reachability

```bash
# Test if you can reach a host at all
ping google.com
```

If ping fails, you have a fundamental connectivity problem - either your internet connection is down or there's a routing issue.

### DNS Resolution

```bash
# Check if domain names resolve to IP addresses
nslookup github.com
```

If this fails but ping to an IP address works (like `ping 8.8.8.8`), you have a DNS problem.

### Port Connectivity

```bash
# Test if a specific service is reachable
telnet github.com 443
```

If the connection succeeds, you'll get a blank prompt. Type a few characters and press Enter - you should see an error from the HTTPS server, which confirms the port is open and responding.

For a cleaner test, use netcat if available:

```bash
# Test port connectivity with timeout
nc -zv github.com 443
```

## HTTP: The Web's Communication Protocol

HTTP powers most web applications. Understanding how it works helps you debug API issues and optimize performance.

Let's examine a complete HTTP conversation:

```bash
# See exactly what your browser sends and receives
curl -v https://httpbin.org/json
```

This shows the full HTTP request:

```http
GET /json HTTP/1.1
Host: httpbin.org
User-Agent: curl/7.68.0
Accept: */*
```

And the response:

```http
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 429

{
  "slideshow": {
    "author": "Yours Truly",
    "title": "Sample Slide Show"
  }
}
```

### HTTPS: HTTP with Encryption

HTTPS uses TLS to encrypt the connection. You can inspect the certificate details:

```bash
# Check SSL certificate information
openssl s_client -connect github.com:443 -servername github.com
```

This shows certificate details, encryption methods, and whether the connection is secure.

## DNS: Translating Names to Addresses

DNS translates human-readable domain names into IP addresses. Without it, you'd need to remember `142.250.80.14` instead of `google.com`.

### How DNS Works

When you visit `api.stripe.com`, your computer:

1. Checks its local cache for the IP address
2. Asks your configured DNS server (usually your ISP's)
3. That server might query authoritative DNS servers
4. Eventually returns an IP address to your computer
5. Your computer connects to that IP address

### Testing DNS Resolution

```bash
# Basic DNS lookup
nslookup api.stripe.com

# More detailed information
dig api.stripe.com

# See the full resolution path
dig +trace api.stripe.com
```

Different types of DNS records serve different purposes:

```bash
# IPv4 address
dig api.stripe.com A

# IPv6 address
dig api.stripe.com AAAA

# Mail servers
dig stripe.com MX

# Text records (often used for verification)
dig stripe.com TXT
```

## Network Path Discovery

Your data doesn't travel directly to its destination. It hops through multiple routers and network devices.

```bash
# See the path your data takes
traceroute google.com
```

Each line shows a different router (or "hop") that forwards your packet:

```
1  192.168.1.1 (192.168.1.1)  1.234 ms
2  10.0.0.1 (10.0.0.1)  12.345 ms
3  isp-router.example.com (203.0.113.1)  23.456 ms
```

This is incredibly useful for diagnosing where network problems occur. If packets start getting lost at hop 5, you know the issue is with that specific router or network segment.

## Network Interfaces and Routing

Your computer might have multiple network interfaces - ethernet, WiFi, VPN connections, Docker networks, etc.

```bash
# List all network interfaces
ip addr show
```

You'll see interfaces like:

```
1: lo: <LOOPBACK,UP,LOWER_UP>
    inet 127.0.0.1/8 scope host lo
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP>
    inet 192.168.1.100/24 brd 192.168.1.255 scope global eth0
3: docker0: <NO-CARRIER,BROADCAST,MULTICAST,UP>
    inet 172.17.0.1/16 brd 172.17.255.255 scope global docker0
```

The routing table determines which interface to use for different destinations:

```bash
# View routing table
ip route show
```

Look for the `default` route - this is where packets go when no more specific route exists:

```
default via 192.168.1.1 dev eth0
192.168.1.0/24 dev eth0 proto kernel scope link src 192.168.1.100
```

## Practical Troubleshooting Workflow

When network connectivity fails, work through these steps systematically:

### Step 1: Test Basic Connectivity

```bash
# Can you reach the internet at all?
ping 8.8.8.8
```

If this fails, check your network connection, cables, or WiFi.

### Step 2: Test DNS

```bash
# Does DNS work?
nslookup google.com
```

If DNS fails but the ping in Step 1 worked, your DNS configuration is broken.

### Step 3: Test the Specific Service

```bash
# Is the service you're trying to reach actually running?
telnet api.example.com 443
```

If this fails, either the service is down or a firewall is blocking access.

### Step 4: Check Application Logs

If basic connectivity works but your application still can't connect, check application-specific logs for error messages like "connection timeout" or "connection refused."

## Network Performance Considerations

Different protocols have different performance characteristics that affect your applications.

### Connection Overhead

TCP requires a three-way handshake before sending data:

1. Client: "I want to connect" (SYN)
2. Server: "OK, I'm ready" (SYN-ACK)
3. Client: "Great, let's start" (ACK)

This adds latency to every new connection. For high-performance applications, consider:

- Connection pooling to reuse existing connections
- HTTP/2 to multiplex requests over a single connection
- Persistent connections for frequently-used services

### Bandwidth vs Latency

These are different problems requiring different solutions:

```bash
# Measure latency (how long for a single packet)
ping -c 10 api.example.com

# Measure bandwidth (how much data can transfer)
# This requires iperf3 running on both ends
iperf3 -c iperf.example.com
```

High latency makes applications feel slow, while low bandwidth limits how much data you can transfer.

## Next Steps

You now understand the fundamental protocols that power network communication. These concepts apply whether you're debugging a local development issue, optimizing API performance, or designing distributed systems.

In the next section, we'll dive into IP addressing and subnetting - the foundation for organizing and securing your network infrastructure.

When you encounter connectivity issues, remember to start with the basics: Can you ping the host? Does DNS resolve? Is the port open? Most network problems trace back to these fundamentals.

Happy networking!
