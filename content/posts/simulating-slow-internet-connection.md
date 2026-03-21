---
title: 'How to Simulate a Slow Internet Connection for Testing'
excerpt: "Learn how to throttle network speed on Linux, macOS, and Windows using tc, Network Link Conditioner, and other tools to test application performance under poor network conditions."
category:
  name: 'Networking'
  slug: 'networking'
date: '2024-10-22'
publishedAt: '2024-10-22T15:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '9 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Networking
  - Testing
  - Performance
  - Linux
  - macOS
  - Windows
  - DevOps
---

**TLDR:** Use `tc` (traffic control) on Linux to add latency, limit bandwidth, and simulate packet loss. On macOS, use Network Link Conditioner from Xcode tools. On Windows, use tools like Clumsy or NetLimiter. Browser DevTools can throttle specific tabs, and proxy tools like Charles or Fiddler work across all platforms.

Testing your application on fast internet is easy - that's probably what you have. But your users might be on slow connections, mobile networks, or congested WiFi. Simulating poor network conditions helps you catch performance issues before users do.

## Why Simulate Slow Networks

Real users experience:
- High latency (200-500ms on mobile, 500-1000ms+ on satellite)
- Limited bandwidth (256kbps to 5Mbps on 3G/4G)
- Packet loss (1-5% on WiFi, higher on mobile)
- Variable conditions (congestion during peak hours)

These conditions reveal problems:
- Timeouts that don't happen on fast connections
- UI freezes waiting for data
- Slow page loads
- Broken retry logic
- Poor error handling

## Linux: Using tc (Traffic Control)

The `tc` command is built into Linux and provides fine-grained control over network traffic. It requires root access.

### Adding Latency

Latency simulates the round-trip time between your machine and a server:

```bash
# Add 100ms latency to all outgoing packets on eth0
sudo tc qdisc add dev eth0 root netem delay 100ms

# Add 100ms ± 10ms variation (jitter)
sudo tc qdisc add dev eth0 root netem delay 100ms 10ms

# Add 100ms ± 10ms with 25% correlation
# (each delay value depends on the previous one - more realistic)
sudo tc qdisc add dev eth0 root netem delay 100ms 10ms 25%
```

To remove the latency:

```bash
# Remove all tc rules from eth0
sudo tc qdisc del dev eth0 root
```

### Limiting Bandwidth

Bandwidth limits simulate slow connections:

```bash
# Limit bandwidth to 1 Mbps
sudo tc qdisc add dev eth0 root tbf rate 1mbit burst 32kbit latency 400ms

# Parameters explained:
# rate 1mbit    - Maximum throughput
# burst 32kbit  - Size of bucket for burst traffic
# latency 400ms - Maximum time a packet can wait in queue
```

For more realistic throttling with bursts:

```bash
# Simulate 3G connection (384 kbps download)
sudo tc qdisc add dev eth0 root tbf rate 384kbit burst 10kb latency 50ms

# Simulate slow WiFi (2 Mbps)
sudo tc qdisc add dev eth0 root tbf rate 2mbit burst 32kb latency 100ms
```

### Simulating Packet Loss

Packet loss causes retransmissions and failed requests:

```bash
# Drop 1% of packets randomly
sudo tc qdisc add dev eth0 root netem loss 1%

# Drop 5% with 25% correlation
# (if a packet is lost, next packet has higher chance of loss - simulates bursty loss)
sudo tc qdisc add dev eth0 root netem loss 5% 25%
```

### Combining Multiple Effects

You can combine latency, bandwidth limits, and packet loss:

```bash
# Simulate poor mobile connection:
# - 200ms latency with ±50ms jitter
# - 1 Mbps bandwidth
# - 2% packet loss

# First, add latency and packet loss with netem
sudo tc qdisc add dev eth0 root handle 1: netem delay 200ms 50ms loss 2%

# Then add bandwidth limiting
sudo tc qdisc add dev eth0 parent 1:1 handle 10: tbf rate 1mbit burst 32kbit latency 400ms
```

### Limiting Specific Ports or IPs

To throttle only HTTP traffic (port 80):

```bash
# Create a filter for port 80
sudo tc qdisc add dev eth0 root handle 1: prio
sudo tc qdisc add dev eth0 parent 1:3 handle 30: netem delay 200ms

# Add filter to match port 80
sudo tc filter add dev eth0 protocol ip parent 1:0 prio 3 u32 \
    match ip dport 80 0xffff flowid 1:3
```

This gets complex quickly. For most testing, throttling all traffic is simpler.

### Script for Easy Testing

Here's a script to make tc easier to use:

```bash
#!/bin/bash
# network-throttle.sh - Simulate network conditions

INTERFACE="eth0"  # Change to your interface (find with: ip link)

case "$1" in
  3g)
    echo "Simulating 3G connection (384 kbps, 200ms latency, 2% loss)"
    sudo tc qdisc add dev $INTERFACE root netem delay 200ms 50ms loss 2%
    sudo tc qdisc add dev $INTERFACE parent 1:1 handle 10: tbf rate 384kbit burst 10kb latency 400ms
    ;;

  4g)
    echo "Simulating 4G connection (5 Mbps, 100ms latency, 1% loss)"
    sudo tc qdisc add dev $INTERFACE root netem delay 100ms 20ms loss 1%
    ;;

  slow-wifi)
    echo "Simulating slow WiFi (2 Mbps, 50ms latency)"
    sudo tc qdisc add dev $INTERFACE root netem delay 50ms 10ms
    sudo tc qdisc add dev $INTERFACE parent 1:1 handle 10: tbf rate 2mbit burst 32kb latency 200ms
    ;;

  satellite)
    echo "Simulating satellite connection (1 Mbps, 600ms latency)"
    sudo tc qdisc add dev $INTERFACE root netem delay 600ms 100ms
    sudo tc qdisc add dev $INTERFACE parent 1:1 handle 10: tbf rate 1mbit burst 16kb latency 800ms
    ;;

  off)
    echo "Removing network throttling"
    sudo tc qdisc del dev $INTERFACE root 2>/dev/null || true
    ;;

  *)
    echo "Usage: $0 {3g|4g|slow-wifi|satellite|off}"
    exit 1
    ;;
esac
```

Usage:

```bash
chmod +x network-throttle.sh

# Simulate 3G
./network-throttle.sh 3g

# Test your application...

# Remove throttling
./network-throttle.sh off
```

## macOS: Network Link Conditioner

Network Link Conditioner is the easiest option for macOS. It's part of Xcode's Additional Tools.

### Installation

1. Download Xcode from the App Store (or just the Command Line Tools)
2. Download "Additional Tools for Xcode" from [Apple Developer](https://developer.apple.com/download/all/)
3. Open the DMG and find "Network Link Conditioner.prefPane"
4. Double-click to install it in System Preferences

### Usage

1. Open System Preferences → Network Link Conditioner
2. Turn it "ON"
3. Choose a profile:
   - 3G (780 kbps down, 330 kbps up, 200ms latency)
   - DSL (2 Mbps down, 256 kbps up, 50ms latency)
   - Edge (240 kbps down, 200 kbps up, 400ms latency)
   - WiFi (40 Mbps down, 33 Mbps up, 2ms latency)
   - High Latency DNS (100ms delay)
   - LTE (12 Mbps down, 12 Mbps up, 100ms latency)
   - Very Bad Network (1 Mbps down, 1 Mbps up, 400ms latency, 5% loss)

You can also create custom profiles with specific bandwidth, latency, and packet loss settings.

### Command Line Alternative for macOS

If you prefer the command line, use `dnctl` and `pfctl`:

```bash
# Create a dummy network pipe with 100ms delay
sudo dnctl pipe 1 config delay 100

# Enable packet filter
sudo pfctl -E

# Add rule to use the pipe
echo "dummynet in all pipe 1" | sudo pfctl -f -
```

This is more complex than Network Link Conditioner for most use cases.

## Windows: Third-Party Tools

Windows doesn't have built-in throttling tools, but several options exist:

### Clumsy (Free)

Clumsy provides a GUI for network manipulation:

1. Download from [GitHub](https://github.com/jagt/clumsy)
2. Run as Administrator
3. Select your network interface
4. Enable filters:
   - Lag: Add latency
   - Drop: Drop packets
   - Throttle: Limit bandwidth
   - Duplicate: Send packets twice
   - Out of order: Reorder packets

Example configuration:
```
Lag: 200ms
Drop: 2% chance
Throttle: Inbound/Outbound 1000 KB/s
```

Clumsy is great for testing but can be unstable with some applications.

### NetLimiter (Paid)

NetLimiter is more robust but costs money:

1. Download from [netlimiter.com](https://www.netlimiter.com/)
2. Install and launch
3. Right-click any application or connection
4. Set download/upload limits
5. Set priority (to simulate congestion)

NetLimiter works per-application, letting you throttle specific programs.

### WANem (Advanced)

For serious testing, run WANem in a virtual machine:

1. Download WANem VM from [wanem.sourceforge.net](http://wanem.sourceforge.net/)
2. Set up VirtualBox or VMware
3. Configure WANem as a network bridge
4. Route traffic through the VM
5. Configure latency, bandwidth, packet loss via web interface

This simulates a realistic network segment between your machine and the internet.

## Browser Developer Tools

For web development, browser DevTools have built-in throttling:

### Chrome DevTools

1. Open DevTools (`F12`)
2. Click the "Network" tab
3. Click the "Throttling" dropdown (usually shows "No throttling")
4. Select a preset:
   - Slow 3G (400ms RTT, 400 kbps down, 400 kbps up)
   - Fast 3G (300ms RTT, 1.6 Mbps down, 750 kbps up)
   - Offline
5. Or click "Add custom profile" for precise control

Chrome only throttles the current tab, not your entire system.

### Firefox DevTools

1. Open DevTools (`F12`)
2. Click the settings gear icon
3. Under "Advanced Settings", find "Enable throttling"
4. Choose a preset in the Network tab

### Custom Profiles in Chrome

Create realistic profiles for your users:

```javascript
// You can export/import custom profiles in Chrome DevTools
{
  "title": "Rural 4G",
  "download": 3000,    // kbps
  "upload": 1000,      // kbps
  "latency": 150       // ms
}
```

## Proxy-Based Throttling

Proxy tools work across all platforms and can throttle specific domains:

### Charles Proxy

1. Download from [charlesproxy.com](https://www.charlesproxy.com/)
2. Install and start Charles
3. Go to Proxy → Throttle Settings
4. Enable throttling
5. Choose a preset or create custom settings
6. Optionally, throttle only specific hosts

Charles can also simulate:
- High latency DNS
- Random disconnections
- Specific HTTP error codes

### Fiddler

Windows-focused but cross-platform with Fiddler Everywhere:

1. Download from [telerik.com/fiddler](https://www.telerik.com/fiddler)
2. Install and launch
3. Use the built-in traffic simulation
4. Or write custom FiddlerScript to add delays

## Docker Network Throttling

If you're testing containerized apps:

```bash
# Use 'tc' inside a container
docker run --cap-add=NET_ADMIN -it ubuntu bash

# Inside container:
apt-get update && apt-get install -y iproute2
tc qdisc add dev eth0 root netem delay 200ms

# Or use Docker Compose with network configuration
```

Docker Compose doesn't natively support throttling, but you can use `tc` in the container or use a network plugin.

## Testing Your Throttling

Verify your throttling is working:

```bash
# Test latency
ping -c 10 google.com
# Should show increased RTT

# Test bandwidth
curl -o /dev/null https://speed.cloudflare.com/__down?bytes=25000000
# Should download slowly

# Or use speedtest-cli
pip install speedtest-cli
speedtest-cli
```

## Realistic Network Profiles

Use these as starting points for different scenarios:

```
3G (Good signal):
- Latency: 200ms ± 50ms
- Bandwidth: 2 Mbps down / 768 kbps up
- Packet loss: 1%

3G (Poor signal):
- Latency: 400ms ± 100ms
- Bandwidth: 384 kbps down / 128 kbps up
- Packet loss: 5%

4G/LTE:
- Latency: 100ms ± 20ms
- Bandwidth: 10 Mbps down / 5 Mbps up
- Packet loss: 0.5%

Satellite:
- Latency: 600ms ± 100ms
- Bandwidth: 5 Mbps down / 1 Mbps up
- Packet loss: 2%

Congested WiFi:
- Latency: 50ms ± 30ms
- Bandwidth: 2 Mbps down / 1 Mbps up
- Packet loss: 3%
```

Start with the condition most common for your users, then test edge cases. Simulating slow networks during development catches issues that would otherwise surface in production with frustrated users.
