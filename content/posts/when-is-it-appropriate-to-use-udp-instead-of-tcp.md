---
title: 'When is it Appropriate to Use UDP Instead of TCP?'
excerpt: 'UDP trades reliability for speed and simplicity. Learn when to choose UDP over TCP for real-time applications, gaming, streaming, and scenarios where low latency matters more than guaranteed delivery.'
category:
  name: 'Networking'
  slug: 'networking'
date: '2025-01-01'
publishedAt: '2025-01-01T13:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Networking
  - Protocols
  - UDP
  - TCP
  - Performance
---

When building network applications, you'll typically choose between TCP and UDP for transporting data. TCP is the default choice for most applications because it guarantees delivery, maintains order, and handles retransmission. But UDP has important use cases where its speed and simplicity outweigh TCP's reliability guarantees.

Understanding when to use UDP helps you build faster, more efficient applications in scenarios where TCP's overhead becomes a limitation.

## TLDR

Use UDP when you need low latency and can tolerate some packet loss: live video streaming, online gaming, VoIP calls, DNS queries, and real-time metrics. Use TCP when you need guaranteed delivery and order: web browsing, file transfers, emails, databases, and API calls. UDP is faster because it skips TCP's handshakes, acknowledgments, and retransmissions.

## Prerequisites

Basic understanding of networking concepts and how data travels over networks will help. Familiarity with the OSI model or TCP/IP stack is useful but not required.

## Understanding TCP vs UDP

### TCP: Reliable but Slower

TCP (Transmission Control Protocol) provides:

- **Guaranteed delivery**: Lost packets are retransmitted
- **Order preservation**: Packets arrive in the order sent
- **Connection-oriented**: Establishes a connection before sending data
- **Flow control**: Adjusts sending rate based on network conditions
- **Error checking**: Detects and corrects corrupted data

This reliability comes with overhead:

```
Client -> SYN -> Server
Client <- SYN-ACK <- Server
Client -> ACK -> Server
(Connection established)

Client -> Data -> Server
Client <- ACK <- Server
(Data acknowledged)
```

Each data segment needs acknowledgment, and lost packets trigger retransmission. This adds latency but ensures complete, ordered delivery.

### UDP: Fast but Unreliable

UDP (User Datagram Protocol) provides:

- **No delivery guarantee**: Packets may be lost
- **No order guarantee**: Packets may arrive out of order
- **Connectionless**: No handshake, just send data
- **No flow control**: Sender doesn't adjust to receiver's capacity
- **Minimal error checking**: Only basic checksum

UDP is simpler:

```
Client -> Data -> Server
(That's it - fire and forget)
```

No handshakes, no acknowledgments, no retransmissions. Data goes out immediately with minimal overhead.

## When UDP Makes Sense

### Real-Time Video Streaming

Video streaming is UDP's ideal use case. When watching a live stream, you care about current content, not perfect delivery:

```
TCP behavior:
- Packet 100 lost
- Wait for retransmission
- Packets 101-120 delayed
- User sees buffering

UDP behavior:
- Packet 100 lost
- Keep displaying packets 101, 102, 103...
- User might see brief glitch
- Stream continues without interruption
```

A dropped frame is preferable to a frozen stream. Modern video codecs handle minor packet loss gracefully, and viewers barely notice occasional missing frames.

**Examples**: YouTube Live, Twitch, Zoom video, WebRTC

### Online Gaming

Multiplayer games need low latency more than perfect reliability:

```
TCP gaming:
- Send player position update
- Wait for acknowledgment
- Total delay: 50-100ms
- Gameplay feels sluggish

UDP gaming:
- Send player position update
- No wait
- Total delay: 10-20ms
- Gameplay feels responsive
```

In a fast-paced shooter, a 50ms delay between pressing a button and seeing the action is noticeable. Games send frequent position updates, so if one packet is lost, the next update (milliseconds later) corrects any discrepancy.

**Examples**: Fortnite, Call of Duty, Counter-Strike, Rocket League

Most games use UDP for time-critical data (player positions, actions) and TCP for important state changes (inventory, chat, matchmaking).

### Voice over IP (VoIP)

Voice calls need low latency to feel natural:

```
Human perception:
- Delay < 150ms: Feels natural
- Delay 150-300ms: Noticeable but acceptable
- Delay > 300ms: Very annoying

TCP retransmission adds:
- 100-500ms extra delay
- Makes conversation awkward
```

If a few milliseconds of audio are lost in a phone call, you barely notice. But if packets are delayed by retransmission, the conversation becomes difficult and unnatural.

**Examples**: Skype, Discord voice, WhatsApp calls, SIP

### DNS Queries

DNS uses UDP for speed:

```
TCP DNS query:
1. TCP handshake (3 packets)
2. Send query
3. Receive response
4. Close connection
Total: 5+ packets

UDP DNS query:
1. Send query
2. Receive response
Total: 2 packets
```

DNS queries are small (often under 512 bytes), and if a response is lost, the client simply retries. The speed advantage is significant, and most DNS queries complete successfully on the first try.

**Example**: Every time you visit a website, your browser queries DNS via UDP.

### Network Monitoring and Metrics

Metrics collection benefits from UDP's low overhead:

```python
# Sending metrics with UDP
import socket

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

# Send metric (fire and forget)
sock.sendto(b'api.requests:1|c', ('metrics-server', 8125))
```

If you're sending thousands of metrics per second, TCP's overhead becomes significant. Losing an occasional metric data point usually doesn't matter because:

- Metrics are aggregated over time
- One missing data point among thousands is statistically insignificant
- The low overhead allows higher throughput

**Examples**: StatsD, Graphite, some Prometheus exporters

### IoT and Sensor Data

IoT devices often use UDP for frequent sensor readings:

```
Temperature sensor sending readings every 5 seconds:

TCP overhead:
- Battery drain from connection management
- Bandwidth usage for acknowledgments
- Delays from retransmissions

UDP efficiency:
- Minimal battery usage
- Low bandwidth
- Immediate transmission
```

When a temperature sensor reports every 5 seconds, losing one reading rarely matters. The next reading arrives shortly, and the overall pattern remains clear.

### Network Time Protocol (NTP)

Time synchronization uses UDP because:

```
NTP goal: Synchronize clocks
Challenge: Network latency

TCP's retransmissions and buffering:
- Add unpredictable delays
- Make latency calculation harder

UDP's direct transmission:
- Predictable network path
- Easier to calculate and compensate for latency
```

NTP measures round-trip time to calculate clock offset. TCP's complexity would make these calculations less accurate.

### Broadcast and Multicast

UDP supports broadcasting and multicasting, TCP doesn't:

```python
# UDP multicast example
import socket

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 2)

# Send to all listeners on this multicast group
sock.sendto(b'Server announcement', ('224.0.0.1', 5000))
```

Broadcasting sends one packet that reaches multiple recipients. This is impossible with TCP's one-to-one connection model.

**Use cases**: Network discovery, service announcements, distributed cache invalidation

## When TCP is Better

Despite UDP's advantages, TCP is the right choice for most applications:

### Web Browsing (HTTP/HTTPS)

Web pages must load completely and correctly:

```
UDP web page:
- 100 packets sent
- 3 packets lost
- Missing images, broken layout
- JavaScript errors

TCP web page:
- All packets delivered
- Complete, working page
```

You can't have a web page with holes in it. TCP ensures every byte arrives correctly.

### File Transfers

Files must be transferred completely and accurately:

```
Downloading a 100MB file:

UDP:
- Fast download
- File corrupted (missing packets)
- Can't use the file

TCP:
- Slightly slower
- File perfect
- Works correctly
```

A corrupted executable, document, or image is useless. TCP guarantees integrity.

### Databases

Database operations require guaranteed delivery:

```sql
-- This INSERT must either succeed completely or fail
INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com');
```

You can't have a database where writes might randomly fail silently. TCP ensures every query is delivered and acknowledged.

### Email

Email messages must arrive completely and in order:

```
UDP email:
- Paragraph 1: Delivered
- Paragraph 2: Lost
- Paragraph 3: Delivered
- Message doesn't make sense

TCP email:
- All paragraphs delivered
- Message readable
```

Email is asynchronous anyway, so the small delay from TCP is acceptable. The reliability is essential.

### APIs and Microservices

API calls usually need reliable delivery:

```javascript
// Payment API call
const response = await fetch('https://api.payment.com/charge', {
  method: 'POST',
  body: JSON.stringify({ amount: 100, customer: 'alice' })
});

// Must know if the charge succeeded
```

Losing a payment request or response would be catastrophic. TCP ensures the request reaches the server and the response reaches the client.

## Hybrid Approaches

Many applications use both protocols:

### HTTP/3 (QUIC)

The newest HTTP version uses UDP at the transport layer but implements its own reliability:

```
Traditional HTTP/2:
- Uses TCP
- TCP's head-of-line blocking
- One lost packet blocks all streams

HTTP/3 (QUIC):
- Uses UDP
- Application-layer reliability
- Per-stream delivery
- Lost packet only blocks affected stream
```

QUIC gets UDP's speed advantages while implementing selective reliability where needed.

### Gaming Protocols

Games often split traffic:

```
UDP for:
- Player positions (sent 60 times/second)
- Projectile locations
- Animation states

TCP for:
- Chat messages
- Inventory updates
- Match results
```

This gives responsive gameplay while ensuring important state changes are reliable.

### Video Conferencing

Modern video apps use sophisticated approaches:

```
UDP for:
- Audio stream (delay sensitive)
- Video stream (delay sensitive)

TCP for:
- Chat messages
- File sharing
- Screen sharing (needs perfect quality)
```

## Implementing UDP Applications

Here's a simple UDP server and client:

**Server:**
```python
import socket

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.bind(('0.0.0.0', 5000))

print("UDP server listening on port 5000")

while True:
    data, addr = sock.recvfrom(1024)
    print(f"Received {data} from {addr}")

    # Echo back to client
    sock.sendto(data, addr)
```

**Client:**
```python
import socket

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

message = b"Hello, UDP server!"
sock.sendto(message, ('localhost', 5000))

# Wait for response (with timeout)
sock.settimeout(2.0)
try:
    data, addr = sock.recvfrom(1024)
    print(f"Received response: {data}")
except socket.timeout:
    print("No response received")
```

Notice the client sets a timeout and handles potential packet loss. This is important when using UDP.

## Making UDP More Reliable

If you need some reliability with UDP, implement it at the application layer:

```python
import socket
import time

def send_with_retry(sock, data, addr, max_retries=3, timeout=1.0):
    """Send UDP packet with retries"""
    for attempt in range(max_retries):
        sock.sendto(data, addr)
        sock.settimeout(timeout)

        try:
            response, _ = sock.recvfrom(1024)
            return response  # Success!
        except socket.timeout:
            print(f"Attempt {attempt + 1} failed, retrying...")

    raise Exception("Failed after all retries")
```

This adds selective reliability without TCP's full overhead.

UDP is appropriate when you need speed over reliability: real-time video, gaming, VoIP, DNS, metrics, and broadcasting. The key is understanding that occasional packet loss is acceptable for your application. For most other use cases - web browsing, file transfers, APIs, databases - TCP's reliability is worth the small performance cost.
