---
title: 'Increasing the Maximum Number of TCP/IP Connections in Linux and Monitoring Network Usage'
excerpt: 'Find the limit you actually hit, then raise it: file descriptors, the ephemeral port range, listen backlogs, TIME_WAIT and connection tracking. Then watch bandwidth per process, per connection and per interface with nethogs, iftop, nload and ss.'
category:
  name: 'Linux'
  slug: 'linux'
date: '2025-03-20'
publishedAt: '2025-03-20T10:30:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '14 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Linux
  - Networking
  - Performance
  - sysctl
  - Monitoring
  - System Administration
---

Linux defaults work for most servers, but a busy reverse proxy, a WebSocket server or a load test client can run into limits long before the CPU is busy. The symptoms are errors such as `Too many open files` or `Cannot assign requested address`, and connections that hang or time out. Each symptom points to a different limit, so look before you change settings.

This post explains each limit that caps the number of connections, how to check it and how to raise it, and then the tools that show where the network traffic goes.

## TLDR

| Symptom                               | Limit                        | Check                                        | Raise                                            |
| ------------------------------------- | ---------------------------- | -------------------------------------------- | ------------------------------------------------ |
| `Too many open files`                 | File descriptors per process | `cat /proc/<pid>/limits`                     | `LimitNOFILE=` for systemd services              |
| `Cannot assign requested address`     | Ephemeral ports (outgoing)   | `ss -Htan state time-wait \| wc -l`          | `net.ipv4.ip_local_port_range`, connection reuse |
| New connections hang under load       | Listen backlog               | `nstat -az TcpExtListenOverflows`            | `net.core.somaxconn` and the app's backlog       |
| `nf_conntrack: table full` in `dmesg` | Connection tracking          | `/proc/sys/net/netfilter/nf_conntrack_count` | `net.netfilter.nf_conntrack_max`                 |
| Which process uses the bandwidth?     | n/a                          | `sudo nethogs`                               | n/a                                              |

## Prerequisites

- Root access to change kernel parameters and service limits.
- A Linux kernel from the last few years. Some defaults changed in 5.4 and later; the text says which.
- A basic idea of how a TCP connection is opened and closed. The [TCP vs UDP simulator](/games/tcp-vs-udp) shows the handshake.

## Which Limits Cap the Number of TCP Connections?

Five limits matter, and each one affects a different side of the traffic:

- **File descriptors.** Every socket is a file descriptor. A process cannot hold more sockets than its `nofile` limit.
- **Ephemeral ports.** Each outgoing connection to the same destination IP and port needs its own local port. Incoming connections do not use ephemeral ports, because [many sockets share one server port](/posts/can-two-sockets-share-tcp-port).
- **Listen backlog.** The queue of connections that the kernel has accepted but the application has not yet picked up with `accept()`.
- **Connection tracking.** When netfilter tracks connections (for NAT, Docker, or stateful firewall rules), its table has a size limit.
- **Memory.** Each connection has buffers. With very many idle connections, socket memory becomes the limit.

## How Do I Increase the File Descriptor Limit?

Check the limit of the process that fails, not of your shell. A service started by systemd does not get the limits of your login session:

```bash
cat /proc/$(pgrep -o nginx)/limits | grep 'open files'
ls /proc/$(pgrep -o nginx)/fd | wc -l       # descriptors it uses now
ulimit -n                                    # soft limit of your shell
cat /proc/sys/fs/file-nr                     # allocated, unused, system-wide maximum
```

systemd starts services with a soft limit of 1024 and a hard limit of 524288 by default. Set the limit in the unit with a drop-in file:

```bash
sudo systemctl edit nginx
```

```ini
[Service]
LimitNOFILE=65536
```

```bash
sudo systemctl restart nginx
```

`/etc/security/limits.conf` applies only to sessions that go through PAM, such as SSH and console logins. It does not change systemd services:

```text
# /etc/security/limits.conf: for login sessions
deploy  soft  nofile  65536
deploy  hard  nofile  65536
```

The new limit applies to sessions that start after the change. A process can raise its soft limit up to its hard limit, and no limit can go above `fs.nr_open` (1048576 by default). The system-wide `fs.file-max` is very high by default on current 64-bit kernels, so you rarely need to change it. Some applications have their own setting on top: nginx needs `worker_rlimit_nofile` and `worker_connections` large enough for the connections you expect.

## How Do I Get More Ports for Outgoing Connections?

Check the range the kernel uses for local ports of outgoing connections:

```bash
cat /proc/sys/net/ipv4/ip_local_port_range      # 32768   60999
```

That is about 28,000 ports for each combination of source IP, destination IP and destination port. A proxy that opens many short connections to one backend can use them all, and `connect()` then fails with `Cannot assign requested address`.

You can widen the range:

```bash
# /etc/sysctl.d/90-connections.conf
net.ipv4.ip_local_port_range = 15000 64999
```

```bash
sudo sysctl --system
```

Do not start the range at 1024. Services that listen on ports in the range, such as 3306, 5432 or 8080, can then fail to start when an outgoing connection holds the same number. If a service port must be inside the range, list it in `net.ipv4.ip_local_reserved_ports`.

More ports only delay the problem when the application opens a new connection for every request. Reuse connections first: HTTP keep-alive, connection pools for databases, `keepalive` in nginx `upstream` blocks. More backend IP addresses also multiply the available ports, because each destination IP has its own set.

### TIME_WAIT

After a connection closes, the side that closed it first keeps the port in the `TIME_WAIT` state for 60 seconds. This protects the next connection from old packets. Count the sockets in that state:

```bash
ss -Htan state time-wait | wc -l
ss -s          # summary, including timewait
```

The 60 seconds are fixed in the kernel. `net.ipv4.tcp_fin_timeout` does **not** change them: it controls how long a socket waits in the `FIN_WAIT_2` state. The setting that helps is:

```bash
net.ipv4.tcp_tw_reuse = 1
```

It lets new **outgoing** connections reuse a port in `TIME_WAIT` when the TCP timestamps make it safe. It has no effect on incoming connections, so it does no harm on a server. The default on current kernels is `2`, which allows reuse only for loopback traffic. The old `tcp_tw_recycle` setting broke clients behind NAT and was removed in Linux 4.12. Do not copy it from old guides.

## How Do I Increase the TCP Listen Backlog?

When a server cannot call `accept()` fast enough, finished handshakes wait in its accept queue. When the queue is full, the kernel drops new connections, and clients see slow connects or timeouts. Check for overflows:

```bash
nstat -az TcpExtListenOverflows TcpExtListenDrops    # counters since boot
ss -ltn 'sport = :443'                               # Recv-Q: queued now, Send-Q: queue size
```

The queue size is the smaller of the backlog that the application passes to `listen()` and `net.core.somaxconn`. Since Linux 5.4, `somaxconn` defaults to 4096, so on current kernels the application value usually decides:

```nginx
server {
    listen 443 ssl backlog=4096;
}
```

```python
sock.listen(4096)        # Python: the argument is the backlog
```

Node.js uses a backlog of 511 unless you pass another value to `server.listen()`. Raise `somaxconn` only if you need a larger queue than 4096, or if the kernel is older than 5.4:

```bash
net.core.somaxconn = 8192
net.ipv4.tcp_max_syn_backlog = 8192     # queue for half-open connections; the default depends on memory
```

A full SYN queue is usually covered by SYN cookies (`net.ipv4.tcp_syncookies = 1`, the default). Overflows in a steady state mostly mean the application is too slow to accept, so more workers often help more than a bigger queue.

## How Do I Increase the Connection Tracking Limit?

netfilter tracks connections when NAT or stateful rules are in use, which includes every Docker host. When the table is full, the kernel drops new connections and logs `nf_conntrack: table full, dropping packet`:

```bash
cat /proc/sys/net/netfilter/nf_conntrack_count
cat /proc/sys/net/netfilter/nf_conntrack_max
sudo dmesg | grep -i conntrack
```

Raise the limit:

```bash
# /etc/sysctl.d/90-connections.conf
net.netfilter.nf_conntrack_max = 262144
```

Each entry uses roughly 300 bytes of kernel memory, so 262,144 entries need about 75 MB. The `nf_conntrack` module must be loaded before `sysctl` can set the value; on a host with Docker or a stateful firewall it already is.

## A Starting sysctl File for a Busy Server

Put the settings in a file under `/etc/sysctl.d/`, apply them with `sudo sysctl --system`, and change only the values that match a symptom you measured:

```bash
# /etc/sysctl.d/90-connections.conf
net.ipv4.ip_local_port_range = 15000 64999
net.ipv4.tcp_tw_reuse = 1
net.core.somaxconn = 8192
net.ipv4.tcp_max_syn_backlog = 8192
net.netfilter.nf_conntrack_max = 262144
net.core.netdev_max_backlog = 5000
```

Keep the TCP buffer sizes (`net.ipv4.tcp_rmem`, `tcp_wmem`) at their defaults unless you measured a throughput problem on links with high latency. Linux already tunes buffers per connection, and large values multiply by the number of connections. To check the result, load test from a separate machine with a tool such as `wrk` or `k6`, and watch the counters above during the test. The load test client needs higher limits too: it opens the connections, so it uses the ephemeral ports and file descriptors.

## How Do I See Network Usage Like top or htop?

`top` shows no network traffic, and `htop` can show only the total rate for the system in its Network I/O meter. To see where the traffic goes, use one of these tools, depending on the question:

| Question                              | Tool                     | Install (Debian, Ubuntu)      |
| ------------------------------------- | ------------------------ | ----------------------------- |
| Which process uses the bandwidth?     | `sudo nethogs`           | `sudo apt install nethogs`    |
| Which remote hosts use the bandwidth? | `sudo iftop -i eth0`     | `sudo apt install iftop`      |
| How busy is each interface?           | `nload`, `bmon`          | `sudo apt install nload bmon` |
| How much traffic per day or month?    | `vnstat -d`, `vnstat -m` | `sudo apt install vnstat`     |
| What are the open connections doing?  | `ss -tin`                | included in iproute2          |

On Fedora, install the same packages with `dnf`. On RHEL and its rebuilds, most of them are in EPEL. `nethogs` and `iftop` need root, because they capture packets.

### Bandwidth per Process With nethogs

```bash
sudo nethogs eth0           # interactive, like top
sudo nethogs -t eth0        # trace mode: plain text lines, for logs and scripts
```

The interactive view shows the PID, user, program, and the send and receive rate for each process. Press `m` to switch between KB/s and totals, and `q` to quit.

### Bandwidth per Connection With iftop

```bash
sudo iftop -i eth0 -n -P          # -n: no DNS lookups, -P: show ports
sudo iftop -i eth0 -t -s 10       # text output: one 10-second report, then exit
sudo iftop -i eth0 -f 'port 443'  # pcap filter: only HTTPS traffic
```

By default, each pair of lines is the traffic between your host and one remote host, which can include several connections. With `-P` (or `p` while it runs), iftop splits the traffic by port as well. `=>` is traffic you send and `<=` is traffic you receive, with averages over the last 2, 10 and 40 seconds. Press `n` to toggle DNS lookups.

### Interface Totals and History

`nload eth0` draws incoming and outgoing traffic of one interface, and `bmon` shows all interfaces at once. For history, `vnstat` collects counters in the background with its daemon:

```bash
sudo systemctl enable --now vnstat
vnstat -i eth0 -d       # traffic per day
vnstat -l -i eth0       # live rate
```

### Read the Counters in a Script

The kernel keeps byte counters per interface in `/sys`. Two reads one second apart give the rate:

```bash
iface=eth0
rx1=$(< /sys/class/net/$iface/statistics/rx_bytes)
tx1=$(< /sys/class/net/$iface/statistics/tx_bytes)
sleep 1
rx2=$(< /sys/class/net/$iface/statistics/rx_bytes)
tx2=$(< /sys/class/net/$iface/statistics/tx_bytes)
echo "rx $(( (rx2 - rx1) / 1024 )) KiB/s, tx $(( (tx2 - tx1) / 1024 )) KiB/s"
```

`ip -s link show eth0` shows the same counters together with errors and drops, and `sar -n DEV 1` from the sysstat package prints the rate for every interface each second. Rising `errors` or `dropped` values point to a network or driver problem rather than an application problem.

`ss -tin` shows details for each connection: round-trip time (`rtt`), congestion window, bytes sent and received, and retransmissions. It answers "is this connection slow because of the network" without capturing packets.

## Related Resources

- [Linux performance tuning and troubleshooting exercise](/exercises/linux-performance-troubleshooting): CPU, memory, disk and network analysis step by step
- [Introduction to Linux: Networking](/guides/introduction-to-linux/08-networking): `ip`, `ss`, DNS and `tcpdump`
- [How to free up a TCP port](/posts/how-to-free-up-tcp-port): find the process on a port, find a free port, close a port
- [Packet journey simulator](/games/packet-journey): follow one request through the network stack
- [Fork bomb simulator](/games/fork-bomb-simulator): how `ulimit` and cgroups protect a system from runaway processes
