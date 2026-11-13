---
title: 'How to Simulate a Slow Internet Connection for Testing'
excerpt: 'Throttle and break the network on purpose: tc netem on Linux, Network Link Conditioner on macOS, Clumsy on Windows, browser DevTools, Toxiproxy for a single service, and three ways to create a connection timeout.'
category:
  name: 'Networking'
  slug: 'networking'
date: '2024-10-22'
publishedAt: '2024-10-22T15:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '17 min read'
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

**TLDR:** On Linux, `tc qdisc ... netem` adds delay, jitter, packet loss and a rate limit to the traffic that leaves an interface. On macOS, use Network Link Conditioner; on Windows, Clumsy. Browser DevTools throttle one tab, and Toxiproxy slows down or cuts the connection to one service, which is often what a test needs. To create a connection timeout on purpose, drop the packets with a firewall rule or connect to an address that does not answer.

Testing your application on fast internet is easy, because that is probably what you have. Your users may be on a weak mobile signal, a congested Wi-Fi network or a satellite link. Simulating poor network conditions helps you find timeouts, frozen screens and broken retries before users do. This post covers the tools for Linux, macOS, Windows and browsers, how to slow down a single service with Toxiproxy, and how to create a connection timeout on purpose.

## Why Simulate Slow Networks

Real users experience:

- High latency: 100 ms or more on a weak mobile signal, and about 600 ms on a geostationary satellite link
- Limited bandwidth: a few hundred kbit/s on an overloaded cell or in-flight Wi-Fi
- Packet loss: often a few percent on bad Wi-Fi and mobile links
- Conditions that change, for example during peak hours or while a phone switches cells

These conditions reveal problems:

- Timeouts that don't happen on fast connections
- UI freezes waiting for data
- Slow page loads
- Broken retry logic
- Poor error handling

## Linux: Using tc (Traffic Control)

The `tc` command is part of iproute2 and controls how Linux sends packets. Its **netem** queueing discipline adds delay, loss, duplication, reordering and a rate limit. It needs root (or `CAP_NET_ADMIN`), and it works on the packets that **leave** an interface: `delay 100ms` on `eth0` adds 100 ms to each round trip, not 200 ms. To delay incoming traffic too, run netem on the other machine, or redirect the incoming packets to an `ifb` device and shape them there.

### Adding Latency

Latency simulates the round-trip time between your machine and a server:

```bash
# Add 100ms latency to all outgoing packets on eth0
sudo tc qdisc add dev eth0 root netem delay 100ms

# Add 100ms ± 10ms variation (jitter)
sudo tc qdisc add dev eth0 root netem delay 100ms 10ms

# Add 100ms ± 10ms, and send the delays with a normal distribution
sudo tc qdisc add dev eth0 root netem delay 100ms 10ms distribution normal
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

netem can do delay, loss and a rate limit in one line:

```bash
# poor mobile connection: 200 ms +-50 ms, 2% loss, 1 Mbit/s
sudo tc qdisc replace dev eth0 root netem delay 200ms 50ms loss 2% rate 1mbit
```

Use `replace` instead of `add`. A second `add` on an interface that already has a root qdisc fails with `Error: Exclusivity flag on, cannot modify.`, while `replace` works whether a qdisc is there or not. If you prefer `tbf` for the rate limit, give the netem qdisc a handle, so that `tbf` can attach below it:

```bash
sudo tc qdisc replace dev eth0 root handle 1: netem delay 200ms 50ms loss 2%
sudo tc qdisc replace dev eth0 parent 1:1 handle 10: tbf rate 1mbit burst 32kbit latency 400ms
tc qdisc show dev eth0
```

Without `handle 1:`, the kernel gives the netem qdisc a random handle such as `8003:`, and the second command fails with `Error: Failed to find specified qdisc.`

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

A small script makes the profiles repeatable. Each profile replaces the previous one, so you can switch between them without `off` in between:

```bash
#!/usr/bin/env bash
# network-throttle.sh - simulate network conditions on one interface
set -euo pipefail

IFACE="${IFACE:-eth0}"  # find yours with: ip -br link

case "${1:-}" in
  3g)        sudo tc qdisc replace dev "$IFACE" root netem delay 200ms 50ms loss 2% rate 384kbit ;;
  4g)        sudo tc qdisc replace dev "$IFACE" root netem delay 100ms 20ms loss 1% rate 5mbit ;;
  slow-wifi) sudo tc qdisc replace dev "$IFACE" root netem delay 50ms 10ms rate 2mbit ;;
  satellite) sudo tc qdisc replace dev "$IFACE" root netem delay 600ms 100ms rate 1mbit ;;
  off)       sudo tc qdisc del dev "$IFACE" root 2>/dev/null || true ;;
  show)      tc qdisc show dev "$IFACE" ;;
  *)         echo "Usage: $0 {3g|4g|slow-wifi|satellite|off|show}" >&2; exit 1 ;;
esac
```

```bash
chmod +x network-throttle.sh
./network-throttle.sh 3g        # test your application...
./network-throttle.sh off
```

The numbers are a rough starting point, not measurements of real networks. Do not run this on the interface you use for SSH to a remote server with a large loss value, or your own session becomes hard to use. Keep a second session open, or schedule the `off` command before you start, with the interface name written out: `sudo systemd-run --on-active=10min /usr/sbin/tc qdisc del dev eth0 root`.

### Try It Without Root on Your Own Machine

On Linux, an unprivileged user can create a private network namespace with its own loopback interface and run `tc` there. Nothing outside the namespace changes, and it is gone when the shell exits. On loopback, a packet leaves through the same interface in both directions, so the round trip gets the delay twice:

```terminal
{
  "title": "netem in a private network namespace",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "unshare -rn bash"
    },
    {
      "prompt": "#",
      "cmd": "ip link set lo up; ping -c 3 -q 127.0.0.1 | tail -n 1",
      "output": "rtt min/avg/max/mdev = 0.065/0.073/0.088/0.010 ms"
    },
    {
      "prompt": "#",
      "cmd": "tc qdisc add dev lo root netem delay 50ms; ping -c 3 -q 127.0.0.1 | tail -n 1",
      "output": "rtt min/avg/max/mdev = 100.086/100.093/100.097/0.005 ms"
    },
    {
      "prompt": "#",
      "cmd": "tc qdisc add dev lo root netem delay 100ms",
      "output": "Error: Exclusivity flag on, cannot modify."
    },
    {
      "prompt": "#",
      "cmd": "tc qdisc replace dev lo root netem delay 100ms 20ms; ping -c 5 -q 127.0.0.1 | tail -n 1",
      "output": "rtt min/avg/max/mdev = 179.218/199.271/213.112/11.769 ms"
    }
  ]
}
```

Start your app and its tests inside the same shell, and they talk over the slowed-down loopback. Some distributions turn off unprivileged user namespaces; then `unshare` fails with `Operation not permitted`.

## macOS: Network Link Conditioner

Network Link Conditioner is the easiest option on macOS. Apple ships it in the "Additional Tools for Xcode" download, not in Xcode or the Command Line Tools.

### Installation

1. Sign in at [Apple Developer downloads](https://developer.apple.com/download/all/) and download "Additional Tools for Xcode" for your Xcode version.
2. Open the disk image, go to the `Hardware` folder and double-click `Network Link Conditioner.prefPane`.
3. It appears at the bottom of System Settings (System Preferences on older macOS).

### Usage

1. Open Network Link Conditioner in System Settings and turn it on.
2. Choose a profile, such as 3G, Edge, LTE, DSL, Wi-Fi, High Latency DNS or Very Bad Network.
3. Use **Manage Profiles** to see each profile's bandwidth, packet loss and delay for both directions, and to create your own.

It changes all traffic of the Mac, so turn it off when you are done. The same tool exists on an iPhone under Settings, Developer, once the phone is set up for development.

### Command Line Alternative for macOS

Network Link Conditioner uses the `dummynet` traffic shaper of the packet filter, which you can also drive from the terminal:

```bash
# a pipe that adds 100 ms and limits to 1 Mbit/s
sudo dnctl pipe 1 config delay 100 bw 1Mbit/s

# load the normal rules plus one line that sends web traffic through the pipe
(cat /etc/pf.conf; echo "dummynet out proto tcp from any to any port 443 pipe 1") | sudo pfctl -f -
sudo pfctl -E

# undo: reload the normal rules and remove this pipe
sudo pfctl -f /etc/pf.conf
sudo dnctl pipe delete 1
```

Load `/etc/pf.conf` together with your line. A ruleset that contains only the `dummynet` line replaces the rules that macOS loads at boot. Use a pipe number that nothing else uses (`sudo dnctl pipe show` lists them); `dnctl flush` would remove every pipe, also those of other tools.

## Windows: Third-Party Tools

Windows has no built-in tool that adds delay or packet loss. Policy-based QoS can limit outgoing bandwidth (`New-NetQosPolicy -ThrottleRateActionBitsPerSecond`), but for the rest, two programs cover most needs.

### Clumsy (Free)

[Clumsy](https://github.com/jagt/clumsy) changes packets as they pass through the WinDivert driver:

1. Download it from GitHub and run it as Administrator.
2. Enter a filter that selects the traffic.
3. Turn on the functions you need: **Lag** (delay), **Drop** (loss), **Throttle**, **Duplicate**, **Out of order** and **Tamper**.

The filter uses the WinDivert language, so you can slow down one host or port instead of the whole machine:

```text
outbound and ip.DstAddr == 203.0.113.10
outbound and tcp.DstPort == 443
outbound and tcp.DstPort >= 8000 and tcp.DstPort <= 9000
```

Start with Lag 200 ms and Drop 2%. Clumsy only works while its window is open and the Start button is on.

### NetLimiter (Paid)

[NetLimiter](https://www.netlimiter.com/) limits bandwidth for each application or connection, which is useful when you want to slow down one program and keep the rest of the machine fast. It limits rates; for delay and loss, use Clumsy.

## Browser Developer Tools

For web development, the browser's own throttling is often enough. It applies to one tab, not to the whole system, and it only changes what the browser does.

### Chrome DevTools

1. Open DevTools (`F12`) and the **Network** tab.
2. Open the throttling menu, which shows "No throttling".
3. Pick a preset, such as "Fast 4G", "Slow 4G" or "3G" (older versions call them "Fast 3G" and "Slow 3G"), or "Offline".
4. **Add** creates a custom profile with your own download and upload speed and latency.

Chrome adds the latency in the browser. It does not drop packets, so it does not show what TCP does under loss; use netem, Network Link Conditioner or Clumsy for that.

### Firefox DevTools

1. Open DevTools (`F12`) and the **Network** tab.
2. Open the throttling menu ("No Throttling") next to "Disable Cache".
3. Pick a profile, such as GPRS, Regular 3G, Good 3G, Regular 4G / LTE, DSL or Wi-Fi.

## Proxy-Based Throttling

An HTTP proxy works on any platform and can slow down only some hosts.

### Charles Proxy

1. Download [Charles](https://www.charlesproxy.com/) and start it.
2. Open **Proxy > Throttle Settings**, turn on throttling and pick a preset or your own values.
3. Add hosts under "Only for selected hosts" to leave the rest of your traffic alone.

Charles can also make a connection unreliable or unstable, and rewrite responses to test error handling.

### Fiddler

[Fiddler Classic](https://www.telerik.com/fiddler) on Windows has **Rules > Performance > Simulate Modem Speeds**, and FiddlerScript can add a delay to chosen requests only.

## How Do I Slow Down One Service Instead of the Whole Machine?

Put [Toxiproxy](https://github.com/Shopify/toxiproxy) between your app and the service. It is a TCP proxy with an API: your app connects to the proxy, the proxy connects to the real service, and **toxics** change the traffic in between. Because it works on single connections, it fits integration tests and CI, and it needs no root:

```bash
# the server, in a container (or install toxiproxy-server and toxiproxy-cli)
docker run -d --name toxiproxy --net=host ghcr.io/shopify/toxiproxy -host=127.0.0.1

# a proxy on port 25432 in front of Postgres on 5432
toxiproxy-cli create -l 127.0.0.1:25432 -u 127.0.0.1:5432 postgres

# point the app at 127.0.0.1:25432, then add toxics
toxiproxy-cli toxic add -t latency -a latency=300 -a jitter=50 postgres   # 300 ms +-50 ms on the data from Postgres
toxiproxy-cli toxic add -t bandwidth -a rate=100 postgres                 # 100 KB/s
toxiproxy-cli inspect postgres                                             # shows the toxics and their names
toxiproxy-cli toxic remove -n latency_downstream postgres                  # names are <type>_<stream>
```

Useful toxics:

| Toxic        | Attributes                                | What it does                                                                       |
| ------------ | ----------------------------------------- | ---------------------------------------------------------------------------------- |
| `latency`    | `latency`, `jitter` (ms)                  | Delays the data                                                                    |
| `bandwidth`  | `rate` (KB/s)                             | Limits the throughput                                                              |
| `timeout`    | `timeout` (ms)                            | Stops all data and closes the connection after the timeout; with 0 it never closes |
| `reset_peer` | `timeout` (ms)                            | Resets the connection, at once or after the timeout                                |
| `slow_close` | `delay` (ms)                              | Waits before the proxy closes its side of the connection                           |
| `limit_data` | `bytes`                                   | Closes the connection after that many bytes                                        |
| `slicer`     | `average_size`, `size_variation`, `delay` | Splits the data into small pieces with gaps between them                           |

Toxiproxy cannot drop single packets: it is a TCP proxy, so the kernel still delivers the bytes that it forwards. For packet loss, use netem. To make the service disappear, disable the proxy through its API (`curl -X POST -d '{"enabled": false}' http://127.0.0.1:8474/proxies/postgres`), so that new connections are refused. Client libraries for Go, Ruby, Python, Java and other languages let a test add and remove toxics in code.

In Docker Compose, run Toxiproxy as one more service, give it a JSON file with the proxies (`-config /config/toxiproxy.json`), and point the app at `toxiproxy:25432` instead of `db:5432`. The image has no shell, so start it with its own command line, not with a `sh -c` script.

You can also run netem inside one container. It needs the `NET_ADMIN` capability and the `tc` program in the image, and it changes only that container's traffic:

```bash
docker run --rm -it --cap-add=NET_ADMIN debian:13 bash
# inside the container:
apt-get update && apt-get install -y iproute2
tc qdisc replace dev eth0 root netem delay 200ms loss 1%
```

## How Do I Artificially Create a Connection Timeout?

Make sure that nothing answers the connection attempt. A closed port answers at once with a reset (`Connection refused`), so it tests a different error. Three ways to get silence:

1. **Drop the packets with a firewall rule.** This works with the real host and port from your configuration:

```bash
sudo nft add table inet chaos
sudo nft add chain inet chaos output '{ type filter hook output priority 0; }'
sudo nft add rule inet chaos output ip daddr 10.0.3.10 tcp dport 5432 drop   # times out
# sudo nft add rule inet chaos output ip daddr 10.0.3.10 tcp dport 5432 reject with tcp reset   # refused at once
sudo nft delete table inet chaos   # remove all of it again
```

2. **Connect to an address that does not answer.** `192.0.2.1` (TEST-NET-1, reserved for documentation) is not routed on the internet, and `10.255.255.1` is a private address that usually does not exist. The result depends on your network: a VPN or a cloud route for `10.0.0.0/8` can answer with `No route to host` instead of silence, so check the error you get.
3. **Fill a server's listen queue.** When a server never calls `accept()` and its queue is full, the kernel ignores new connection attempts. In Python, `listen(0)` holds one waiting connection on Linux, so the second client times out.

This script tests a closed port, a silent server and a full queue on localhost:

```python
import socket, time

def attempt(label, port, timeout=2):
    start = time.monotonic()
    try:
        s = socket.create_connection(("127.0.0.1", port), timeout=timeout)
        s.settimeout(timeout)
        s.sendall(b"GET / HTTP/1.0\r\n\r\n")
        s.recv(1)
        result = "answered"
    except (socket.timeout, TimeoutError) as e:
        result = f"{type(e).__name__}: {e}"
    except OSError as e:
        result = f"{type(e).__name__}: {e}"
    print(f"{label:<30} {result} after {time.monotonic() - start:.1f}s")

# nothing listens: refused at once
attempt("closed port", 9041)

# accepts the connection, never answers: read timeout
silent = socket.socket(); silent.bind(("127.0.0.1", 9042)); silent.listen()
attempt("silent server", 9042)

# backlog full and never accept(): the kernel drops new SYNs, connect times out
full = socket.socket(); full.bind(("127.0.0.1", 9043)); full.listen(0)
held = [  # fills the queue: listen(0) holds one connection on Linux
    socket.create_connection(("127.0.0.1", 9043), timeout=2) for _ in range(1)]
attempt("full listen backlog", 9043)
```

We ran the firewall rules in a private network namespace (`unshare -rn`, as above) against a local web server, then the script:

```terminal
{
  "title": "drop, reject and the Python cases",
  "prompt": "#",
  "autoplay": false,
  "steps": [
    {
      "cmd": "nft add rule inet chaos output tcp dport 8080 tcp flags syn drop"
    },
    {
      "cmd": "curl -sS --connect-timeout 3 http://127.0.0.1:8080/",
      "output": "curl: (28) Failed to connect to 127.0.0.1 port 8080 after 3001 ms: Timeout was reached"
    },
    {
      "cmd": "nft flush chain inet chaos output; nft add rule inet chaos output tcp dport 8080 reject with tcp reset"
    },
    {
      "cmd": "curl -sS --connect-timeout 3 http://127.0.0.1:8080/",
      "output": "curl: (7) Failed to connect to 127.0.0.1 port 8080 after 0 ms: Couldn't connect to server"
    },
    {
      "prompt": "$",
      "cmd": "python3 timeouts.py",
      "output": "closed port                    ConnectionRefusedError: [Errno 111] Connection refused after 0.0s\nsilent server                  TimeoutError: timed out after 2.0s\nfull listen backlog            TimeoutError: timed out after 2.0s"
    }
  ]
}
```

The "silent server" case is a different error: the server accepts the connection and then sends nothing, so the client gets a **read** timeout, not a connect timeout. `nc -l 9999` gives you such a server, and Toxiproxy's `timeout` toxic does the same to a real service. Test both, because many clients have separate settings for them, for example `timeout=(3, 10)` in Python's `requests`, or a connect timeout and a statement or read timeout in most database drivers.

Set the timeout in the client to the value you want. Without one, the operating system decides: Linux gives up on a connection attempt after 6 SYN retries, about 2 minutes (`net.ipv4.tcp_syn_retries`), and a read from a silent server that has accepted the connection can wait forever. In a test, check that the error your code reports names the target and the timeout, so that in production you can tell a slow dependency from a dead one.

## Testing Your Throttling

Verify your throttling is working:

```bash
# latency: the round trip grows by the delay you set
ping -c 10 1.1.1.1

# bandwidth: the rule limits what leaves this machine, so measure an upload
iperf3 -c iperf.example.internal -t 10       # client to server: the shaped direction
iperf3 -c iperf.example.internal -t 10 -R    # server to client: only slowed by delayed ACKs

# what is configured right now
tc -s qdisc show dev eth0
```

Run the `iperf3` server (`iperf3 -s`) on a machine that you control. `tc -s` also counts the packets that netem dropped, which tells you whether the loss you see comes from your rule or from the network.

## Realistic Network Profiles

Use these as starting points. They are rough values to test with, not measurements of real networks:

```text
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

## Related Resources

- [Network Troubleshooting: ping, mtr, tcpdump, ss and netem](/guides/networking-fundamentals/08-network-monitoring-and-troubleshooting#h2-what-loss-does-to-tcp): what added latency and loss do to TCP, measured on a practice network
- [Drop or reject](/guides/networking-fundamentals/04-network-security-and-firewalls-basics#h2-drop-or-reject): what a client sees for each firewall action
- [Ping: Request timed out vs Destination host unreachable](/posts/ping-timeout-vs-destination-unreachable): the same split between silence and an error reply, for ping
- [Call HTTP APIs with timeouts and retries](/guides/introduction-to-python/08-error-handling#h2-call-http-apis-with-timeouts-and-retries) in the Python guide
- [UDP vs TCP: how much faster is UDP?](/posts/udp-vs-tcp-performance-comparison) and the [TCP vs UDP simulator](/games/tcp-vs-udp)
- [Idempotency and retry lab](/games/idempotency-retry-lab): what retries after a timeout do to a payment API
- [Capturing mobile phone traffic on Wireshark](/posts/capturing-mobile-phone-traffic-on-wireshark): see what an app on a phone really sends
