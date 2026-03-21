---
title: 'Network Usage Top/Htop on Linux'
excerpt: 'Monitor real-time network bandwidth usage on Linux with tools like iftop, nethogs, nload, and bmon. Learn which processes are consuming bandwidth, track interface statistics, and identify network bottlenecks.'
category:
  name: 'Linux'
  slug: 'linux'
date: '2025-05-03'
publishedAt: '2025-05-03T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Linux
  - Networking
  - Monitoring
  - System Administration
  - Performance
---

While `top` and `htop` show CPU and memory usage, they don't display network bandwidth consumption. When you need to see which processes are using network bandwidth, which connections are active, or how much data is flowing through your network interfaces, Linux offers several specialized tools that provide real-time network monitoring similar to how top works for system resources.

This guide covers the best tools for monitoring network usage on Linux, from simple interface statistics to process-level bandwidth tracking.

## TLDR

Use `nethogs` to see bandwidth usage per process (like htop for network). Use `iftop` to see bandwidth usage per connection. Use `nload` for a simple interface bandwidth graph. Use `bmon` for multi-interface monitoring with graphs. Install with your package manager: `sudo apt install nethogs iftop nload bmon`.

## Prerequisites

You need Linux with root access to install monitoring tools and capture network traffic. Basic command-line familiarity helps you interpret the output.

## iftop: Monitor Bandwidth by Connection

iftop shows network usage between your system and remote hosts, similar to how `top` shows process usage.

### Installation

```bash
# Debian/Ubuntu
sudo apt-get install iftop

# Red Hat/CentOS/Fedora
sudo yum install iftop

# Arch Linux
sudo pacman -S iftop
```

### Basic Usage

Run with sudo (required for packet capture):

```bash
sudo iftop
```

Output shows connections in real-time:

```
                 12.5Kb        25.0Kb       37.5Kb        50.0Kb
└────────────────┴─────────────┴────────────────┴─────────────
192.168.1.100  => api.example.com       5.12Kb  3.24Kb  2.18Kb
              <=                        15.2Kb  12.8Kb  10.4Kb

192.168.1.100  => cdn.cloudflare.com    1.05Mb  980Kb   750Kb
              <=                        125Kb   98.5Kb  87.2Kb
```

The arrows show traffic direction:
- `=>` outgoing traffic
- `<=` incoming traffic

The three columns show bandwidth over 2, 10, and 40 second averages.

### Useful Options

```bash
# Monitor specific interface
sudo iftop -i eth0

# Show port numbers instead of service names
sudo iftop -n

# Don't resolve hostnames (faster)
sudo iftop -N

# Show cumulative bandwidth totals
sudo iftop -t

# Filter by network
sudo iftop -F 192.168.1.0/24
```

### Interactive Commands

While iftop is running, press:

- `t`: Toggle display mode (one line per connection vs two)
- `n`: Toggle name resolution
- `p`: Show port numbers
- `P`: Pause display
- `q`: Quit
- `h`: Help

## nethogs: Monitor Bandwidth by Process

nethogs shows which processes are using bandwidth, grouping traffic by application.

### Installation

```bash
# Debian/Ubuntu
sudo apt-get install nethogs

# Red Hat/CentOS
sudo yum install nethogs

# Arch Linux
sudo pacman -S nethogs
```

### Basic Usage

```bash
sudo nethogs
```

Output:

```
NetHogs version 0.8.6

  PID USER     PROGRAM              DEV        SENT      RECEIVED
 2341 user     /usr/bin/firefox     eth0      125.45     1540.2  KB/sec
 5678 user     /usr/bin/spotify     eth0       45.12      102.5  KB/sec
 8901 user     sshd: user@pts/0     eth0        2.15        5.43 KB/sec
 1234 root     /usr/sbin/apache2    eth0        0.85      12.34  KB/sec

  TOTAL                                        173.57     1660.47 KB/sec
```

This shows exactly which programs are using bandwidth and how much.

### Useful Options

```bash
# Monitor specific interface
sudo nethogs eth0

# Set refresh rate (in seconds)
sudo nethogs -d 1

# Trace mode (show total since start)
sudo nethogs -t

# Monitor multiple interfaces
sudo nethogs eth0 wlan0
```

## nload: Visual Interface Bandwidth Monitor

nload provides a simple visual graph of incoming and outgoing bandwidth.

### Installation

```bash
# Debian/Ubuntu
sudo apt-get install nload

# Red Hat/CentOS
sudo yum install nload

# Arch Linux
sudo pacman -S nload
```

### Basic Usage

```bash
nload
```

Output shows ASCII graphs:

```
Device eth0 [192.168.1.100] (1/2):
================================================================================
Incoming:




                                                    Curr: 1.05 MBit/s
                                                    Avg: 850.23 kBit/s
                                                    Min: 125.45 kBit/s
                                                    Max: 2.15 MBit/s
                                                    Ttl: 1.25 GB
Outgoing:




                                                    Curr: 250.45 kBit/s
                                                    Avg: 180.12 kBit/s
                                                    Min: 15.23 kBit/s
                                                    Max: 512.34 kBit/s
                                                    Ttl: 456.78 MB
```

### Useful Options

```bash
# Monitor specific interface
nload eth0

# Monitor multiple interfaces (switch with arrow keys)
nload eth0 wlan0

# Set refresh interval in milliseconds
nload -t 500

# Set unit (default is adaptive)
nload -u M  # Show in MBit/s
```

### Interactive Keys

- `←` `→`: Switch between interfaces
- `↑` `↓`: Adjust graph scale
- `q`: Quit

## bmon: Bandwidth Monitor with Multiple Interfaces

bmon provides detailed statistics with nice graphical output for multiple interfaces simultaneously.

### Installation

```bash
# Debian/Ubuntu
sudo apt-get install bmon

# Red Hat/CentOS
sudo yum install bmon

# Arch Linux
sudo pacman -S bmon
```

### Basic Usage

```bash
bmon
```

Output shows interfaces with graphs:

```
 #   Interface                RX Rate         RX #     TX Rate         TX #
─────────────────────────────────────────────────────────────────────────────
 0   eth0                      1.05MBit        145      250KBit          89
                           (RX Bandwidth Graph)
     ▃▄▅▆▇█▇▆▅▄▃▂▁▁▂▃▄▅▆▇▇▆▅▄▃
                           (TX Bandwidth Graph)
     ▁▁▂▂▃▃▄▄▅▅▆▆▇▇▆▆▅▅▄▄▃▃▂▂

 1   wlan0                      45KBit          12       15KBit           8
```

### Useful Options

```bash
# Show bits per second instead of bytes
bmon -b

# Set output mode
bmon -o ascii        # ASCII graphs
bmon -o curses       # Enhanced curses interface (default)

# Monitor specific interfaces
bmon -p eth0,wlan0

# Set update interval
bmon -r 1000         # Update every 1000ms
```

## iptraf-ng: Interactive IP LAN Monitor

iptraf-ng provides detailed statistics about IP traffic, including protocol breakdowns and TCP connection monitoring.

### Installation

```bash
# Debian/Ubuntu
sudo apt-get install iptraf-ng

# Red Hat/CentOS
sudo yum install iptraf-ng
```

### Basic Usage

```bash
sudo iptraf-ng
```

This opens a menu-driven interface:

```
┌─────────────────────────────────────────────┐
│ IP traffic monitor                          │
│ General interface statistics                │
│ Detailed interface statistics               │
│ Statistical breakdowns...                   │
│   By packet size                            │
│   By TCP/UDP service                        │
│ LAN station monitor                         │
│ Filters...                                  │
│ Configure...                                │
│ Exit                                        │
└─────────────────────────────────────────────┘
```

Select "IP traffic monitor" and choose your interface to see real-time connection details.

## vnstat: Long-Term Bandwidth Statistics

vnstat tracks network bandwidth over time (hours, days, months) rather than showing real-time data.

### Installation and Setup

```bash
# Install vnstat
sudo apt-get install vnstat

# Initialize database for interface
sudo vnstat -i eth0 --create

# Start vnstat daemon
sudo systemctl start vnstat
sudo systemctl enable vnstat
```

vnstat runs in the background, collecting statistics.

### Viewing Statistics

```bash
# Show summary
vnstat

# Show hourly stats
vnstat -h

# Show daily stats
vnstat -d

# Show monthly stats
vnstat -m

# Live bandwidth monitor
vnstat -l
```

Example output:

```
 Database updated: 2025-05-03 10:15:23

   eth0 since 2025-01-01

          rx:  125.45 GiB      tx:  45.23 GiB      total:  170.68 GiB

                     rx      |     tx      |    total    |   avg. rate
     ------------------------+-------------+-------------+---------------
       yesterday    1.25 GiB |   450 MiB   |    1.68 GiB |   195.23 kbit/s
           today     450 MiB |   125 MiB   |     575 MiB |   125.45 kbit/s
     ------------------------+-------------+-------------+---------------
     estimated      1.12 GiB |   320 MiB   |    1.42 GiB |
```

## Combining Tools for Complete Monitoring

Use different tools for different needs:

**Which process is using bandwidth?**
```bash
sudo nethogs
```

**Which remote host am I connected to?**
```bash
sudo iftop
```

**What's my total interface bandwidth?**
```bash
nload
```

**Long-term bandwidth trends?**
```bash
vnstat -d
```

## Creating Simple Bandwidth Alerts

Monitor bandwidth and alert if it exceeds a threshold:

```bash
#!/bin/bash
# bandwidth_alert.sh

INTERFACE="eth0"
THRESHOLD_MB=100

# Get current bandwidth (MB received in last second)
RX1=$(cat /sys/class/net/$INTERFACE/statistics/rx_bytes)
sleep 1
RX2=$(cat /sys/class/net/$INTERFACE/statistics/rx_bytes)

# Calculate bandwidth in MB/s
BANDWIDTH=$(( ($RX2 - $RX1) / 1024 / 1024 ))

if [ $BANDWIDTH -gt $THRESHOLD_MB ]; then
    echo "High bandwidth detected: ${BANDWIDTH}MB/s"
    # Send alert (email, Slack, etc.)
fi
```

Run this periodically with cron:

```bash
# Run every minute
* * * * * /usr/local/bin/bandwidth_alert.sh
```

## Bandwidth Monitoring in Scripts

Get interface statistics programmatically:

```bash
# Read bytes received/transmitted
cat /sys/class/net/eth0/statistics/rx_bytes
cat /sys/class/net/eth0/statistics/tx_bytes

# Or use ip command
ip -s link show eth0
```

Example monitoring script:

```bash
#!/bin/bash

INTERFACE="eth0"

while true; do
    RX1=$(cat /sys/class/net/$INTERFACE/statistics/rx_bytes)
    TX1=$(cat /sys/class/net/$INTERFACE/statistics/tx_bytes)

    sleep 1

    RX2=$(cat /sys/class/net/$INTERFACE/statistics/rx_bytes)
    TX2=$(cat /sys/class/net/$INTERFACE/statistics/tx_bytes)

    RX_RATE=$(( ($RX2 - $RX1) / 1024 ))
    TX_RATE=$(( ($TX2 - $TX1) / 1024 ))

    echo "RX: ${RX_RATE}KB/s  TX: ${TX_RATE}KB/s"
done
```

## Troubleshooting Network Issues

### Finding Bandwidth Hogs

```bash
# See which process is using most bandwidth
sudo nethogs | head -20

# See which remote hosts are consuming bandwidth
sudo iftop -n
```

### Identifying Unusual Traffic

```bash
# Monitor for unexpected connections
sudo iftop -F your-network/24

# Watch for high packet rates
sudo bmon
```

### Checking Interface Errors

```bash
# See error counts
ip -s link show eth0

# Look for errors, drops, or overruns
```

Output:

```
eth0: <BROADCAST,MULTICAST,UP,LOWER_UP>
    RX: bytes  packets  errors  dropped overrun mcast
    125G       89M      0       45      0       12K
    TX: bytes  packets  errors  dropped carrier collsns
    45G        67M      0       0       0       0
```

Errors or dropped packets indicate network problems.

## Quick Reference

| Tool | Best For | Installation |
|------|----------|--------------|
| nethogs | Per-process bandwidth | `apt install nethogs` |
| iftop | Per-connection bandwidth | `apt install iftop` |
| nload | Simple interface graphs | `apt install nload` |
| bmon | Multi-interface monitoring | `apt install bmon` |
| iptraf-ng | Detailed IP statistics | `apt install iptraf-ng` |
| vnstat | Historical bandwidth data | `apt install vnstat` |

Linux provides rich tools for monitoring network bandwidth at different levels - from per-process usage with nethogs to interface-level statistics with nload. Choose the right tool based on whether you need to identify which program is consuming bandwidth, monitor interface throughput, or track long-term usage trends. These tools are essential for troubleshooting network performance issues and understanding your system's network activity.
