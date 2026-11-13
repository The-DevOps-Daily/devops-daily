---
title: 'UDP vs TCP: How Much Faster Is UDP Really?'
excerpt: 'How much faster UDP really is, measured on localhost, where the difference comes from, and when it is appropriate to use UDP instead of TCP: DNS, calls, games, VPNs and QUIC.'
category:
  name: 'Networking'
  slug: 'networking'
date: '2025-02-14'
publishedAt: '2025-02-14T10:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '13 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Networking
  - TCP
  - UDP
  - Performance
  - Protocols
---

**TLDR:** UDP saves time before and between messages, not per byte: no handshake before the first byte, no waiting for acknowledgments, and a lost packet does not hold back the packets after it. It does not move more data. In our localhost test, TCP sent 2 to 6 times more messages per second than UDP, and UDP lost up to 2.8% of them. The UDP header is 8 bytes and the TCP header 20 bytes (32 with timestamps), so headers are rarely the difference. Choose UDP for traffic where a late packet is worth less than a lost one, such as calls, games and DNS, and TCP or QUIC for everything that must arrive complete.

When you're choosing between UDP and TCP for your application, the question "how much faster is UDP?" comes up constantly. The answer isn't straightforward because it depends heavily on your network conditions, message size, and what reliability features you need to implement on top of UDP.

## What Makes UDP Faster

UDP (User Datagram Protocol) is connectionless and stateless. When you send a UDP packet, it goes straight out without handshakes, acknowledgments, or retransmission logic. Here's what UDP skips:

```
TCP Connection Flow:
Client                    Server
  |                         |
  |----SYN--------------->  |  (1 RTT)
  |<---SYN-ACK-----------|  |
  |----ACK--------------->  |
  |----Data-------------->  |  (+ data transfer)
  |<---ACK----------------|  |

UDP Flow:
Client                    Server
  |                         |
  |----Data-------------->  |  (immediate)
  |----Data-------------->  |
```

TCP requires a three-way handshake before any data moves. That's one full round-trip time (RTT) of overhead before your first byte arrives. For a local network where RTT might be 1ms, this is negligible. For a connection across continents where RTT might be 200ms, that's a noticeable delay.

## Header Overhead Comparison

The header size difference is often cited but is rarely the bottleneck:

```python
# UDP header structure (8 bytes total)
class UDPHeader:
    source_port      # 2 bytes
    dest_port        # 2 bytes
    length           # 2 bytes
    checksum         # 2 bytes

# TCP header structure (minimum 20 bytes, typically 32+ with options)
class TCPHeader:
    source_port      # 2 bytes
    dest_port        # 2 bytes
    sequence_num     # 4 bytes
    ack_num          # 4 bytes
    flags            # 2 bytes
    window_size      # 2 bytes
    checksum         # 2 bytes
    urgent_pointer   # 2 bytes
    options          # 0-40 bytes (often 12 bytes for timestamps)
```

For a 1500-byte packet, TCP uses about 32 bytes (2.1%) while UDP uses 8 bytes (0.5%). This difference is minimal. For tiny packets like gaming updates or DNS queries, the percentage is higher but still not the main factor.

## Real Performance Numbers

To see what the protocols cost on one machine, we sent 100,000 messages of three sizes from one Python process to a receiver process over localhost, once with UDP and once with TCP, and counted what arrived:

```python
"""Send COUNT messages of SIZE bytes over localhost with UDP and with TCP.
The receiver runs in another process and counts what really arrives."""
import multiprocessing as mp, socket, sys, time

COUNT = 100_000

def udp_receiver(port, size, q, ready):
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 4 * 1024 * 1024)
    s.bind(("127.0.0.1", port)); s.settimeout(1.0); ready.set()
    got = 0
    try:
        while True:
            s.recv(65536); got += 1
    except socket.timeout:
        pass
    q.put(got)

def tcp_receiver(port, size, q, ready):
    srv = socket.socket(); srv.bind(("127.0.0.1", port)); srv.listen(); ready.set()
    conn, _ = srv.accept(); total = 0
    while total < COUNT * size:
        data = conn.recv(1 << 20)
        if not data: break
        total += len(data)
    q.put((total // size, time.monotonic()))

def run(proto, size, port):
    q, ready = mp.Queue(), mp.Event()
    target = udp_receiver if proto == "udp" else tcp_receiver
    p = mp.Process(target=target, args=(port, size, q, ready)); p.start(); ready.wait()
    data = b"x" * size
    if proto == "udp":
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        start = time.monotonic()
        for _ in range(COUNT): s.sendto(data, ("127.0.0.1", port))
        elapsed = time.monotonic() - start
        got = q.get()
    else:
        s = socket.create_connection(("127.0.0.1", port))
        start = time.monotonic()
        for _ in range(COUNT): s.sendall(data)
        got, end = q.get(); elapsed = end - start
    p.join()
    print(f"{proto} {size:>5} B: {COUNT/elapsed:>9,.0f} msg/s sent, {got/COUNT:6.1%} delivered")

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 9100
    for size in (100, 1400, 8000):
        for proto in ("udp", "tcp"):
            run(proto, size, port); port += 1
```

We ran it twice; the numbers of the two runs differ by less than 6%:

| Message size | UDP messages/s | UDP delivered | TCP messages/s  | TCP delivered |
| ------------ | -------------- | ------------- | --------------- | ------------- |
| 100 bytes    | 53,788-55,403  | 100%          | 323,061-341,262 | 100%          |
| 1,400 bytes  | 50,817-52,482  | 99.3-99.7%    | 299,205-309,291 | 100%          |
| 8,000 bytes  | 43,072-44,953  | 97.2-99.2%    | 91,334-94,371   | 100%          |

```chart
{
  "type": "bar",
  "title": "Messages per second over localhost, 100,000 messages",
  "unit": " msg/s",
  "caption": "Python 3.11 on a small ARM board (4 cores, Linux 6.12), sender and receiver as two processes. Mean of two runs. UDP delivered 100%, 99.5% and 98.2% of the messages; TCP delivered all of them.",
  "rows": [
    {
      "label": "100 B",
      "value": 54596,
      "series": "UDP"
    },
    {
      "label": "100 B",
      "value": 332162,
      "series": "TCP"
    },
    {
      "label": "1,400 B",
      "value": 51650,
      "series": "UDP"
    },
    {
      "label": "1,400 B",
      "value": 304248,
      "series": "TCP"
    },
    {
      "label": "8,000 B",
      "value": 44012,
      "series": "UDP"
    },
    {
      "label": "8,000 B",
      "value": 92852,
      "series": "TCP"
    }
  ],
  "series": [
    {
      "name": "UDP",
      "color": "#f59e0b"
    },
    {
      "name": "TCP",
      "color": "#0080ff"
    }
  ]
}
```

TCP sent more messages per second, and UDP lost some. The reasons are the features this post is about. TCP is a byte stream: the kernel joins many small writes into large segments, so a hundred 100-byte messages can travel as one packet. UDP sends each message as its own datagram, with the full trip through the network stack every time. When the receiver falls behind, TCP's flow control slows the sender down, while the kernel drops UDP datagrams as soon as the receive buffer is full, and nobody is told.

Localhost has no network in between and almost no round-trip time. The test shows what system calls, buffering and scheduling cost with this Python code on this machine, not a general ranking of the protocols. On a real network, the round trips and the loss that the next sections describe decide the latency, and that is where UDP can be faster.

## Where TCP's "Slowness" Comes From

TCP's performance characteristics come from features that UDP simply doesn't have:

**Flow Control:** TCP adjusts its sending rate based on the receiver's buffer space. This prevents overwhelming a slow receiver but adds computation and can throttle the sender.

**Congestion Control:** TCP backs off when it detects network congestion. This is good for network health but can significantly reduce throughput during congestion events.

**Ordered Delivery:** TCP maintains sequence numbers and reorders packets. If packet 5 arrives before packet 4, TCP holds packet 5 until packet 4 shows up. This head-of-line blocking can add latency.

**Retransmission:** When a packet is lost, TCP detects it (via timeout or duplicate ACKs) and resends it. The detection and retransmission add latency that compounds with RTT.

Here's what happens when a packet is lost:

```
TCP with 1% packet loss (100ms RTT):
Send packets 1-10
Packet 5 is lost
After ~100ms, sender realizes via missing ACK
Resend packet 5
Wait another ~100ms for ACK
Total delay: ~200ms for that packet

UDP with 1% packet loss:
Send packets 1-10
Packet 5 is lost
Application never knows (unless you implement detection)
No automatic recovery
```

## When UDP Is Actually Faster

UDP shines in specific scenarios:

**Small, Independent Messages:** DNS queries, game state updates, or sensor data where each message is self-contained and occasional loss is acceptable.

```python
# DNS query - perfect for UDP
def dns_lookup(domain):
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.settimeout(2.0)

    query = build_dns_query(domain)
    sock.sendto(query, ('8.8.8.8', 53))

    try:
        response, _ = sock.recvfrom(512)
        return parse_dns_response(response)
    except socket.timeout:
        return None  # Retry or fail - simple logic
```

**Multicast and Broadcast:** TCP can't do multicast. If you need to send the same data to multiple receivers efficiently, UDP is your only option.

**Real-Time Streams:** Video conferencing or live streaming where old data is worthless. Better to skip a lost frame than wait for retransmission.

```python
# Video streaming - late frames are worthless
def stream_video_udp(sock, video_source):
    frame_num = 0
    while True:
        frame = video_source.get_next_frame()

        # Add frame number so receiver can detect gaps
        packet = struct.pack('!I', frame_num) + frame
        sock.sendto(packet, receiver_address)

        frame_num += 1
        time.sleep(1/30)  # 30 fps

        # No waiting for ACKs - if a frame is lost,
        # the next frame is more valuable than resending
```

## When TCP Is Actually Faster

Counterintuitively, TCP can outperform UDP in several situations:

**Reliable Bulk Transfer:** If you need reliable delivery and implement your own acknowledgment system on UDP, you're basically rebuilding TCP poorly. TCP's implementation is highly optimized.

**Congested Networks:** TCP's congestion control prevents packet loss. If you send UDP too fast and cause packet loss, you waste bandwidth on data that never arrives.

**Long-Lived Connections:** The connection setup cost amortizes over time. A web API that maintains persistent connections doesn't pay the handshake cost repeatedly.

## Building Reliability on UDP

If you need reliability with UDP, you'll add overhead that erodes the speed advantage:

```python
class ReliableUDP:
    """A simplified reliable UDP implementation."""

    def __init__(self, sock):
        self.sock = sock
        self.sequence = 0
        self.pending_acks = {}
        self.receive_buffer = {}

    def send_reliable(self, data, addr):
        """Send data and wait for acknowledgment."""
        seq = self.sequence
        self.sequence += 1

        # Add sequence number to packet
        packet = struct.pack('!I', seq) + data

        # Send and wait for ACK (with retries)
        max_retries = 3
        for attempt in range(max_retries):
            self.sock.sendto(packet, addr)

            # Wait for ACK
            self.sock.settimeout(0.5)
            try:
                ack_packet, _ = self.sock.recvfrom(1024)
                ack_seq = struct.unpack('!I', ack_packet[:4])[0]
                if ack_seq == seq:
                    return True
            except socket.timeout:
                continue

        return False  # Failed after retries

    # Now you've added:
    # - Sequence numbers (like TCP)
    # - Acknowledgments (like TCP)
    # - Retransmission (like TCP)
    # - Timeout logic (like TCP)
    #
    # You've rebuilt TCP's overhead, but less efficiently
```

This is why protocols like QUIC exist - they use UDP as a transport but implement TCP-like reliability features at the application layer with better performance characteristics than kernel-level TCP.

## When Is It Appropriate to Use UDP Instead of TCP?

Use UDP when a late packet is worth less than a lost one, when every message stands on its own, or when one sender must reach many receivers at once. Use TCP, or QUIC, when every byte must arrive and in order: web pages, APIs, file transfers, databases, email and SSH.

| Traffic                                     | Transport             | Why                                                                                                                      |
| ------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| DNS queries                                 | UDP first             | One small question and one answer; the client asks again after a timeout. Large answers and zone transfers switch to TCP |
| Voice and video calls (WebRTC, SIP and RTP) | UDP                   | A resent audio packet arrives too late to play. The codec hides a small loss                                             |
| Fast online games                           | UDP                   | The next position update replaces a lost one. Chat, purchases and results go over a reliable channel                     |
| Time sync (NTP)                             | UDP                   | Waiting for a retransmission would spoil the time measurement                                                            |
| Metrics such as StatsD                      | UDP                   | Fire and forget: the app never waits for the metrics server, and a few lost samples do not matter                        |
| VPN tunnels (WireGuard, OpenVPN by default) | UDP                   | The TCP connections inside the tunnel already resend lost data. TCP inside TCP resends twice and stalls                  |
| DHCP, mDNS and other discovery              | UDP                   | Broadcast and multicast exist only for UDP, and a DHCP client has no IP address for a connection yet                     |
| HTTP/3                                      | QUIC over UDP         | QUIC adds encryption and reliable streams on top of UDP, so one lost packet stalls only its own stream                   |
| Live video for viewers (YouTube, Twitch)    | HTTP over TCP or QUIC | Players download segments of a few seconds and buffer them. Only low-latency calls need UDP                              |

Several of these are not plain UDP anymore. DNS over TLS and DNS over HTTPS run on TCP or QUIC, and browsers use HTTP/3 where the server offers it. When you choose UDP for your own protocol, you take over the jobs that TCP does for you:

- **Loss and order.** Add sequence numbers, so the receiver can see gaps and old packets, and timeouts with retries where a message must arrive.
- **Rate.** UDP has no congestion control. A sender that ignores loss can fill a link and push out other traffic, including its own.
- **Size.** Keep each datagram below the path MTU, about 1,200 bytes to be safe on the internet. A larger datagram is split into IP fragments or not sent at all, depending on the protocol and the socket settings, and a lost fragment loses the whole datagram.
- **Spoofed senders.** UDP has no handshake, so the source address of a packet can be false. A service that answers a small request with a large response can be used to flood someone else; DNS, NTP and memcached have all been used this way.

If your list of jobs grows toward all of TCP, use TCP or QUIC instead. The [TCP vs UDP simulator](/games/tcp-vs-udp) shows lost and reordered packets side by side.

## Practical Recommendations

Choose UDP when:

- You're sending small, independent messages
- Occasional data loss is acceptable
- You need multicast or broadcast
- You're implementing a custom protocol (like QUIC) with specific reliability needs
- Latency is more important than reliability

Choose TCP when:

- You need reliable, ordered delivery
- You're transferring files or bulk data
- You don't want to implement reliability logic yourself
- You need the connection state that TCP provides
- You're building a standard request-response API

The speed difference between UDP and TCP is about latency, not throughput. UDP gets the first byte out sooner and does not let one lost packet hold back the rest, but it does not move more data, and once you add the reliability your application needs, TCP's well-tested implementation often wins.

Your network conditions, message patterns, and reliability requirements matter far more than the raw protocol speed. Profile your specific use case before optimizing.

## Related Resources

- [Network Fundamentals: Layers, IP, TCP, UDP and Ports](/guides/networking-fundamentals/01-network-fundamentals-and-protocols#h2-tcp-and-udp): TCP and UDP side by side on a practice network you build yourself
- [TCP vs UDP simulator](/games/tcp-vs-udp) and [packet journey simulator](/games/packet-journey)
- [Close vs shutdown on a socket](/posts/close-vs-shutdown-socket): how a TCP connection ends, and `SO_REUSEADDR` after a restart
- [How to simulate a slow network](/posts/simulating-slow-internet-connection): add delay and loss to test both protocols
- [Networking fundamentals quiz](/quizzes/networking-fundamentals-quiz) and [TCP/IP interview questions](/interview-questions/topic/networking#tcp-ip-basics)
