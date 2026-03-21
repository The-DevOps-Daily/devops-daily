---
title: 'Network Tools That Simulate Slow Network Connection'
excerpt: 'Test how your applications handle slow, lossy, or high-latency networks using simulation tools. Learn to use tc, comcast, clumsy, and Network Link Conditioner to throttle bandwidth and add delay for realistic testing.'
category:
  name: 'Networking'
  slug: 'networking'
date: '2025-04-15'
publishedAt: '2025-04-15T11:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Networking
  - Testing
  - Performance
  - Development
  - Tools
---

When developing applications, you usually test on fast local networks or localhost connections. But your users experience real-world conditions: slow mobile connections, congested WiFi, high-latency international links, and packet loss. Testing under these conditions helps you build more resilient applications that handle network problems gracefully.

This guide covers tools that simulate poor network conditions so you can test how your application behaves when the network isn't perfect.

## TLDR

On Linux, use `tc` (traffic control) to add delay, packet loss, and bandwidth limits. On macOS, use Network Link Conditioner. On Windows, use clumsy. For cross-platform testing, use comcast (built on tc) or Toxiproxy for simulating network problems between services. These tools let you throttle bandwidth, add latency, and introduce packet loss to test real-world network conditions.

## Prerequisites

You need administrative or root access to modify network settings. Basic understanding of network concepts like bandwidth, latency, and packet loss helps you interpret the results.

## Linux: tc (Traffic Control)

Linux's built-in `tc` tool provides sophisticated network traffic shaping.

### Add Network Delay

Simulate a 100ms delay on all outgoing traffic:

```bash
# Add 100ms delay to eth0
sudo tc qdisc add dev eth0 root netem delay 100ms
```

Test it:

```bash
ping google.com
```

You'll see round-trip times increase by ~200ms (100ms each way).

### Variable Delay

Add delay with variation to simulate jitter:

```bash
# 100ms ± 10ms delay
sudo tc qdisc add dev eth0 root netem delay 100ms 10ms
```

This creates delays between 90ms and 110ms, simulating network jitter.

### Limit Bandwidth

Throttle bandwidth to simulate slow connections:

```bash
# Limit to 1 Mbit/s
sudo tc qdisc add dev eth0 root tbf rate 1mbit burst 32kbit latency 400ms
```

Test with a download:

```bash
wget http://releases.ubuntu.com/22.04/ubuntu-22.04-desktop-amd64.iso
```

You'll see the download limited to ~1 Mbit/s.

### Packet Loss

Simulate lossy networks:

```bash
# Drop 5% of packets randomly
sudo tc qdisc add dev eth0 root netem loss 5%
```

This simulates unreliable connections where some packets don't make it through.

### Combine Multiple Conditions

Simulate a really bad network:

```bash
# 200ms delay, 20ms jitter, 1% packet loss, 2 Mbit/s bandwidth
sudo tc qdisc add dev eth0 root netem delay 200ms 20ms loss 1% rate 2mbit
```

### Remove Traffic Shaping

Reset to normal:

```bash
sudo tc qdisc del dev eth0 root
```

### Targeting Specific Traffic

Shape traffic to specific IPs or ports:

```bash
# Create filter for specific destination
sudo tc qdisc add dev eth0 root handle 1: prio
sudo tc qdisc add dev eth0 parent 1:3 handle 30: netem delay 200ms

# Filter traffic to specific IP (example: 93.184.216.34)
sudo tc filter add dev eth0 protocol ip parent 1:0 prio 3 u32 \
    match ip dst 93.184.216.34/32 flowid 1:3
```

This adds delay only to traffic going to that IP address.

## macOS: Network Link Conditioner

macOS includes Network Link Conditioner in the Developer Tools.

### Installation

```bash
# Install Xcode command line tools (includes Network Link Conditioner)
xcode-select --install
```

Or download from Apple Developer:
1. Go to developer.apple.com/download/more
2. Search for "Additional Tools for Xcode"
3. Download the package matching your macOS version
4. Open the .dmg and install Network Link Conditioner

### Using Network Link Conditioner

```
1. Open System Preferences
2. Click "Network Link Conditioner" (at the bottom)
3. Turn it ON
4. Select a preset:
   - 3G
   - LTE
   - DSL
   - WiFi
   - Edge
   - Custom (create your own profile)
```

### Creating Custom Profiles

Click "Manage Profiles" to create custom conditions:

```
Profile Name: Poor WiFi
Downlink:
  - Bandwidth: 1 Mbps
  - Packets dropped: 5%
  - Delay: 100ms
Uplink:
  - Bandwidth: 512 Kbps
  - Packets dropped: 3%
  - Delay: 150ms
```

### Command Line Access

You can also use it via command line:

```bash
# Enable Network Link Conditioner with a profile
sudo /usr/bin/defaults write "/Library/Preferences/Network Link Conditioner.plist" Enabled -bool true

# Disable
sudo /usr/bin/defaults write "/Library/Preferences/Network Link Conditioner.plist" Enabled -bool false
```

## Windows: clumsy

clumsy is a Windows tool for simulating poor network conditions.

### Installation

Download from: https://jagt.github.io/clumsy/

### Using clumsy

1. Run as Administrator
2. Select your network interface
3. Configure filtering rules
4. Enable desired network conditions

### Filtering by IP or Port

Filter traffic to simulate slow connections only to specific destinations:

```
# Filter by destination IP
outbound and ip.DstAddr == 93.184.216.34

# Filter by destination port (HTTP)
outbound and tcp.DstPort == 80

# Filter by port range
outbound and tcp.DstPort >= 8000 and tcp.DstPort <= 9000
```

### Add Lag

```
Function: Lag
Lag time (ms): 200
Chance (%): 100
```

This adds 200ms delay to all matching packets.

### Drop Packets

```
Function: Drop
Chance (%): 5
```

Drops 5% of packets randomly.

### Throttle Bandwidth

```
Function: Throttle
Chance (%): 100
```

Limits bandwidth (requires additional configuration).

### Duplicate Packets

```
Function: Duplicate
Chance (%): 2
```

Duplicates 2% of packets, simulating network conditions where packets arrive multiple times.

## Cross-Platform: comcast

comcast is a cross-platform tool built on Linux's tc.

### Installation

```bash
# Install Go first, then:
go install github.com/tylertreat/comcast@latest
```

Or download pre-built binaries from the GitHub releases page.

### Basic Usage

Simulate a slow 3G connection:

```bash
# Add latency and packet loss
sudo comcast --device=eth0 --latency=250 --packet-loss=5%

# Limit bandwidth
sudo comcast --device=eth0 --target-bw=1000  # 1 Mbit/s
```

### Advanced Options

```bash
# Combine multiple conditions
sudo comcast \
  --device=eth0 \
  --latency=200 \
  --target-bw=2000 \
  --packet-loss=3% \
  --target-addr=192.168.1.100 \
  --target-port=8080
```

This creates:
- 200ms latency
- 2 Mbit/s bandwidth limit
- 3% packet loss
- Only affecting traffic to 192.168.1.100:8080

### Reset Network

Return to normal:

```bash
sudo comcast --device=eth0 --stop
```

## Toxiproxy: Service-Level Network Simulation

Toxiproxy simulates network conditions between services, useful for microservices testing.

### Installation

```bash
# Using Go
go install github.com/Shopify/toxiproxy/v2/cmd/toxiproxy-cli@latest
go install github.com/Shopify/toxiproxy/v2/cmd/toxiproxy-server@latest

# Or using Docker
docker run -d --name toxiproxy -p 8474:8474 -p 20000-20010:20000-20010 shopify/toxiproxy
```

### Create a Proxy

```bash
# Start toxiproxy server
toxiproxy-server &

# Create a proxy for your database
toxiproxy-cli create redis -l localhost:20000 -u localhost:6379
```

Now connect to `localhost:20000` instead of `localhost:6379`. Traffic goes through Toxiproxy.

### Add Latency

```bash
# Add 100ms latency
toxiproxy-cli toxic add redis -t latency -a latency=100
```

### Add Packet Loss

```bash
# Drop 5% of packets
toxiproxy-cli toxic add redis -t slow_close -a delay=5000
```

### Limit Bandwidth

```bash
# Limit to 100 KB/s
toxiproxy-cli toxic add redis -t limit_data -a bytes=102400
```

### Remove Toxics

```bash
# Remove all toxics from the proxy
toxiproxy-cli toxic delete redis -n latency
```

## Browser DevTools: Network Throttling

Modern browsers include network throttling for web development.

### Chrome DevTools

```
1. Open DevTools (F12)
2. Go to Network tab
3. Click "No throttling" dropdown
4. Select a preset:
   - Fast 3G
   - Slow 3G
   - Offline
   - Custom (create your own profile)
```

### Custom Throttling Profile

```
Download: 500 Kb/s
Upload: 200 Kb/s
Latency: 200ms
```

### Firefox DevTools

```
1. Open DevTools (F12)
2. Go to Network tab
3. Click throttling dropdown (icon next to Disable Cache)
4. Select throttling profile
```

## Testing Application Behavior

Use these tools to test specific scenarios:

### Slow Load Times

Simulate a 2G connection:

```bash
# Linux
sudo tc qdisc add dev eth0 root netem delay 300ms rate 250kbit

# macOS
# Set Network Link Conditioner to "Edge"

# Windows
# clumsy: Lag 300ms, Throttle to 250 Kbps
```

Test your application's loading spinners, timeout handling, and user feedback.

### Intermittent Connectivity

Simulate packet loss:

```bash
# 10% packet loss
sudo tc qdisc add dev eth0 root netem loss 10%
```

Test retry logic, error handling, and connection recovery.

### High Latency

Simulate satellite or intercontinental connections:

```bash
# 500ms latency
sudo tc qdisc add dev eth0 root netem delay 500ms
```

Test if your application feels responsive or if users see delays.

### Mobile Connection

Simulate 3G:

```bash
sudo comcast \
  --device=eth0 \
  --latency=200 \
  --target-bw=1000 \
  --packet-loss=2%
```

## Automation and CI/CD Integration

Integrate network simulation into your test suite:

### Shell Script Example

```bash
#!/bin/bash
# test_slow_network.sh

# Apply slow network conditions
echo "Applying slow network simulation..."
sudo tc qdisc add dev eth0 root netem delay 200ms rate 1mbit loss 2%

# Run tests
echo "Running tests..."
npm test

# Clean up
echo "Removing network simulation..."
sudo tc qdisc del dev eth0 root

echo "Tests complete"
```

### Docker Compose with Toxiproxy

```yaml
version: '3'
services:
  app:
    build: .
    depends_on:
      - db-proxy

  toxiproxy:
    image: shopify/toxiproxy
    ports:
      - "8474:8474"
      - "5433:5433"

  db:
    image: postgres

  db-proxy:
    image: shopify/toxiproxy
    command: >
      sh -c "toxiproxy-server &
             sleep 1 &&
             toxiproxy-cli create postgres -l 0.0.0.0:5433 -u db:5432 &&
             toxiproxy-cli toxic add postgres -t latency -a latency=100"
```

## Monitoring Impact

While simulating slow networks, monitor your application:

### Response Times

```bash
# HTTP endpoint response time
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:8080/api

# Where curl-format.txt contains:
# time_total: %{time_total}s
```

### Application Logs

Check for timeout errors, retries, or degraded performance messages.

### Resource Usage

Poor network conditions can cause resource buildup:

```bash
# Check connection states
netstat -an | grep ESTABLISHED | wc -l

# Check memory usage
free -h

# Check if queues are building up
ss -s
```

## Best Practices

**Test realistic scenarios**: Don't just test with 100% packet loss. Use realistic values like 1-5% packet loss, 100-500ms latency.

**Test recovery**: After simulating network problems, remove them and verify your application recovers gracefully.

**Combine conditions**: Real networks have multiple issues simultaneously - latency, packet loss, and bandwidth limits.

**Document test scenarios**: Keep a list of network profiles you test against (3G, poor WiFi, satellite, etc.).

**Automate testing**: Include network simulation in your CI/CD pipeline to catch regressions.

Network simulation tools help you build applications that work well even when network conditions aren't ideal. Whether you use Linux's tc, macOS's Network Link Conditioner, Windows's clumsy, or cross-platform tools like Toxiproxy, testing under realistic poor network conditions reveals how your application truly behaves for users on slow or unreliable connections.
