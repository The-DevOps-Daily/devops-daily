---
title: 'Network Troubleshooting: ping, mtr, tcpdump, ss and netem'
description: 'A layer-by-layer troubleshooting method on a lab network: simulate latency and loss with tc netem, find MTU problems, read SYN retries, probe endpoints.'
order: 8
---

When something "cannot connect", the fastest engineers do not guess. They ask the same few questions in the same order, from the bottom of the stack up, and they use a tool that answers each question with evidence: an address, a route, a packet, a timer. Most network problems end at the first question that gets a surprising answer.

In this part you get that order as a checklist, then practise each step on the lab. You make the network bad on purpose with `tc netem` (latency, jitter and loss), find an MTU problem, watch TCP retry a dropped connection in a packet capture, and finish with monitoring that notices problems before users do.

## Prerequisites

- A fresh lab from [Part 1](/guides/networking-fundamentals/01-network-fundamentals-and-protocols#h2-build-the-practice-lab): run `sudo ./netlab.sh down && sudo ./netlab.sh up` before you start, because every part changes the lab.
- The errors from Part 1's [When It Fails, Read the Error](/guides/networking-fundamentals/01-network-fundamentals-and-protocols#h2-when-it-fails-read-the-error) section.

## A Troubleshooting Order

Work up the layers, and stop at the first step that fails:

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "1. Name", "sub": "dig, getent hosts", "icon": "globe", "tone": "slate" },
    { "label": "2. Route", "sub": "ip route get, tracepath", "icon": "net", "tone": "blue" },
    { "label": "3. Port", "sub": "nc -zv, ss -tlnp", "icon": "lock", "tone": "amber" },
    { "label": "4. TLS", "sub": "openssl s_client", "icon": "shield", "tone": "violet" },
    { "label": "5. Application", "sub": "curl -v, logs", "icon": "box", "tone": "green" }
  ]
}
```

| Step | Question                                                    | Command                                                                                                 | A surprising answer means                                  |
| ---- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1    | Does the name resolve to the right address?                 | `getent hosts db`, `dig +short db.shop.internal`                                                        | DNS (Part 3)                                               |
| 2    | Is there a route, and which way does it go?                 | `ip route get 10.0.3.10`, `tracepath -n 10.0.3.10`                                                      | Routing, VPN, cloud route tables (Parts 2 and 7)           |
| 3    | Does the port answer? Refused or silent?                    | `nc -zv -w 3 db 5432` on the client, `ss -tlnp` on the server                                           | Service down, wrong bind address, firewall (Parts 1 and 4) |
| 4    | Does TLS complete with the right certificate for this name? | `openssl s_client -connect host:443 -servername host -verify_hostname host -verify_return_error -brief` | Expired or wrong certificate, missing CA                   |
| 5    | Does the application answer correctly, and how fast?        | `curl -v`, `curl -w` timings, the service's logs                                                        | The app, a proxy, a dependency                             |

Run the check from the same place as the failing program: the same host, container or pod. A database that answers from your laptop proves nothing about the pod that cannot reach it.

## Latency, Jitter and Loss

`ping` measures the round trip and loss to one host; `mtr` combines ping and traceroute and measures every hop on the path. First the healthy lab, then the same path with a bad link. `tc` attaches a **queueing discipline** to an interface; `netem` (network emulator) delays, varies and drops packets on their way out. On the router, apply it to the port that leads to `client`:

```terminal
{
  "title": "a healthy path, then a bad one",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "client#",
      "cmd": "mtr -n -r -c 20 10.0.2.11",
      "output": "Start: 2026-10-27T09:35:37+0000\nHOST: devbox                      Loss%   Snt   Last   Avg  Best  Wrst StDev\n  1.|-- 203.0.113.1                0.0%    20    0.2   0.2   0.1   0.4   0.1\n  2.|-- 10.0.2.11                  0.0%    20    0.2   0.2   0.1   0.4   0.1"
    },
    {
      "comment": "40 ms delay, +/- 10 ms of jitter, 5% loss, on packets leaving towards client",
      "prompt": "router#",
      "cmd": "tc qdisc add dev p-client root netem delay 40ms 10ms loss 5%"
    },
    {
      "prompt": "client#",
      "cmd": "ping -q -c 50 -i 0.2 10.0.2.11",
      "output": "PING 10.0.2.11 (10.0.2.11) 56(84) bytes of data.\n\n--- 10.0.2.11 ping statistics ---\n50 packets transmitted, 44 received, 12% packet loss, time 9873ms\nrtt min/avg/max/mdev = 31.009/40.751/49.977/5.535 ms"
    },
    {
      "prompt": "client#",
      "cmd": "mtr -n -r -c 50 -i 0.2 10.0.2.11",
      "output": "Start: 2026-10-27T09:36:12+0000\nHOST: devbox                      Loss%   Snt   Last   Avg  Best  Wrst StDev\n  1.|-- 203.0.113.1               70.0%    50   39.8  41.0  31.0  50.1   6.6\n  2.|-- 10.0.2.11                  6.0%    50   36.1  40.2  30.6  49.5   5.8"
    }
  ]
}
```

How to read it:

- `ping` summarises the bad link: an average round trip near 40 ms and a large `mdev` (the standard deviation), which is the jitter. netem drops 5% of packets at random, so a run of 50 pings can lose none or several; the `mtr` run below is a second sample of 50. Jitter hurts voice and video more than a steady delay does.
- `mtr` lists every hop, and this run shows its classic trap. The last line, `10.0.2.11`, has the real numbers: a few percent loss and about 40 ms. The router's line shows far more "loss" than the destination behind it, which cannot be real loss, because every packet to `10.0.2.11` passed through that router. Linux limits the ICMP "time exceeded" replies that `mtr` relies on to about one per second per destination (`net.ipv4.icmp_ratelimit`), and `mtr -i 0.2` asks five times a second. Judge a path by its last line, and treat loss at a middle hop that does not continue to the end as rate limiting.
- `netem` worked in one direction only, on the router's way out to `client`. Real problems are often one-way too; `mtr` from both ends tells them apart.

This is also the easiest way to test how your own application behaves on a bad network: run it behind `tc netem` and watch timeouts, retries and the user experience. The posts [simulating a slow internet connection](/posts/simulating-slow-internet-connection) and [network tools that simulate slow connections](/posts/network-tools-that-simulate-slow-network-connection) cover the options on macOS and Windows too.

## What Loss Does to TCP

TCP hides loss by sending again, and you pay for it in speed. `iperf3` measures throughput between two machines. Start its server on `web1`, compare the two directions of the bad link, then look at the kernel's counters:

```terminal
{
  "title": "throughput with and without loss",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "comment": "the iperf3 server; -D runs it in the background, -I writes its process ID",
      "prompt": "web1#",
      "cmd": "iperf3 -s -D -I /run/netlab/iperf3.pid"
    },
    {
      "comment": "client sends to web1: this direction has no netem",
      "prompt": "client#",
      "cmd": "iperf3 -c 10.0.2.11 -t 5 | tail -n 4",
      "output": "[  5]   0.00-5.01   sec   506 MBytes   847 Mbits/sec    0            sender\n[  5]   0.00-5.05   sec   506 MBytes   840 Mbits/sec                  receiver\n\niperf Done."
    },
    {
      "comment": "-R: web1 sends to client, through the lossy link",
      "prompt": "client#",
      "cmd": "iperf3 -c 10.0.2.11 -t 5 -R | tail -n 4",
      "output": "[  5]   0.00-5.04   sec  1.50 MBytes  2.50 Mbits/sec   66            sender\n[  5]   0.00-5.00   sec  1.12 MBytes  1.89 Mbits/sec                  receiver\n\niperf Done."
    },
    {
      "comment": "the sender keeps the count: web1 sent in the -R test",
      "prompt": "web1#",
      "cmd": "nstat -az TcpRetransSegs TcpOutSegs",
      "output": "#kernel\nTcpOutSegs                      9071               0.0\nTcpRetransSegs                  67                 0.0"
    },
    {
      "comment": "remove the bad link, and the iperf3 server, before you go on",
      "prompt": "router#",
      "cmd": "tc qdisc del dev p-client root"
    },
    {
      "comment": "stop exactly this server, not every iperf3 on the machine",
      "prompt": "web1#",
      "cmd": "kill \"$(cat /run/netlab/iperf3.pid)\""
    }
  ]
}
```

The column `Retr` counts retransmitted segments on the sending side, and `nstat` shows the same kernel counters (since the namespace started) on `web1`, which sent through the lossy link. Through the lossy link, TCP backs off its congestion window after every loss, and throughput collapses by orders of magnitude, although only 5% of packets were lost. That is why a little packet loss feels like a dead network to users, and why `nstat`'s `TcpRetransSegs` (or `node_netstat_Tcp_RetransSegs` in Prometheus) is one of the most useful counters on a server. The veth links of the lab are not real network cards, so the absolute numbers mean little; the gap between the two directions is the lesson.

## A Packet Capture of a Dropped Connection

A firewall that drops packets produces silence (Part 4), and a capture shows what the silence looks like. Make `db` drop PostgreSQL connections from `web1`:

```terminal
{
  "title": "a drop rule on db",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "db#",
      "cmd": "nft add table inet trap && nft add chain inet trap input '{ type filter hook input priority 0; }' && nft add rule inet trap input ip saddr 10.0.2.11 tcp dport 5432 drop"
    }
  ]
}
```

Then capture on `web1` while it tries to connect, with no timeout of its own (this takes over two minutes). `-ttt` prints the time since the previous packet:

```terminal
{
  "title": "TCP retries a SYN that never gets an answer",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "web1#",
      "cmd": "sysctl net.ipv4.tcp_syn_retries net.ipv4.tcp_syn_linear_timeouts",
      "output": "net.ipv4.tcp_syn_retries = 6\nnet.ipv4.tcp_syn_linear_timeouts = 4"
    },
    {
      "prompt": "web1#",
      "cmd": "tcpdump -nn -ttt -i eth0 -c 11 'tcp port 5432'",
      "output": " 00:00:00.000000 IP 10.0.2.11.46564 > 10.0.3.10.5432: Flags [S], seq 2015202711, win 64240, length 0\n 00:00:01.002829 IP 10.0.2.11.46564 > 10.0.3.10.5432: Flags [S], seq 2015202711, win 64240, length 0\n 00:00:01.024024 IP 10.0.2.11.46564 > 10.0.3.10.5432: Flags [S], seq 2015202711, win 64240, length 0\n 00:00:01.023996 IP 10.0.2.11.46564 > 10.0.3.10.5432: Flags [S], seq 2015202711, win 64240, length 0\n 00:00:01.023970 IP 10.0.2.11.46564 > 10.0.3.10.5432: Flags [S], seq 2015202711, win 64240, length 0\n 00:00:01.024011 IP 10.0.2.11.46564 > 10.0.3.10.5432: Flags [S], seq 2015202711, win 64240, length 0\n 00:00:02.015991 IP 10.0.2.11.46564 > 10.0.3.10.5432: Flags [S], seq 2015202711, win 64240, length 0\n 00:00:04.223995 IP 10.0.2.11.46564 > 10.0.3.10.5432: Flags [S], seq 2015202711, win 64240, length 0\n 00:00:08.192007 IP 10.0.2.11.46564 > 10.0.3.10.5432: Flags [S], seq 2015202711, win 64240, length 0\n 00:00:16.128002 IP 10.0.2.11.46564 > 10.0.3.10.5432: Flags [S], seq 2015202711, win 64240, length 0\n 00:00:33.280012 IP 10.0.2.11.46564 > 10.0.3.10.5432: Flags [S], seq 2015202711, win 64240, length 0"
    },
    {
      "comment": "in the other terminal, with no timeout of its own",
      "prompt": "web1#",
      "cmd": "time nc -z db 5432",
      "output": "\nreal\t2m14.480s\nuser\t0m0.000s\nsys\t0m0.004s"
    },
    {
      "comment": "remove the drop rule again",
      "prompt": "db#",
      "cmd": "nft delete table inet trap"
    }
  ]
}
```

The client sent the same SYN (same source port) eleven times. On current kernels (Linux 6.5 and later, so Ubuntu 24.04's and 26.04's too) the first few retries come at a fixed one-second interval (`tcp_syn_linear_timeouts`), and after that the wait doubles each time (about 2, 4, 8, 16 and 33 seconds here), TCP's **exponential backoff**. After the last SYN the kernel waits once more, and gives up after more than two minutes in total. Any program that does not set its own connect timeout waits that long for every attempt to an address that drops packets. Set explicit connect timeouts in every network client you write or configure.

To save a capture for Wireshark, write it to a file with `-w` and read it back with `-r`; keep captures short and filtered, because they contain everything on the wire, including credentials in plain-text protocols:

```bash
sudo ip netns exec lb tcpdump -nn -i eth0 -c 200 -w /tmp/lb.pcap 'tcp port 80'
tcpdump -nn -r /tmp/lb.pcap | head
```

## MTU Problems

Every link has a **Maximum Transmission Unit**, the largest packet it carries (1500 bytes on Ethernet). Tunnels and overlays add headers and lower it: WireGuard to 1420, VXLAN to 1450, some VPNs and PPPoE links lower still. A path with a smaller MTU somewhere in the middle relies on ICMP "fragmentation needed" messages to tell senders to use smaller packets; when a firewall drops those messages, small requests work and large responses hang forever. Give the data subnet a smaller MTU and find it:

```terminal
{
  "title": "find the path MTU",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "router#",
      "cmd": "ip link set dev p-db mtu 1400"
    },
    {
      "prompt": "db#",
      "cmd": "ip link set dev eth0 mtu 1400"
    },
    {
      "prompt": "web1#",
      "cmd": "tracepath -n 10.0.3.10",
      "output": " 1?: [LOCALHOST]                      pmtu 1500\n 1:  10.0.2.1                                              0.258ms\n 1:  10.0.2.1                                              0.042ms\n 2:  10.0.2.1                                              0.054ms pmtu 1400\n 2:  10.0.3.10                                             0.077ms reached\n     Resume: pmtu 1400 hops 2 back 2"
    },
    {
      "comment": "1472 bytes of data + 28 bytes of headers = 1500: too big, and not allowed to fragment",
      "prompt": "web1#",
      "cmd": "ping -c 1 -M do -s 1472 10.0.3.10",
      "output": "PING 10.0.3.10 (10.0.3.10) 1472(1500) bytes of data.\nping: sendmsg: Message too long\n\n--- 10.0.3.10 ping statistics ---\n1 packets transmitted, 0 received, +1 errors, 100% packet loss, time 0ms"
    },
    {
      "prompt": "web1#",
      "cmd": "ping -c 1 -M do -s 1372 10.0.3.10",
      "output": "PING 10.0.3.10 (10.0.3.10) 1372(1400) bytes of data.\n1380 bytes from 10.0.3.10: icmp_seq=1 ttl=63 time=0.146 ms\n\n--- 10.0.3.10 ping statistics ---\n1 packets transmitted, 1 received, 0% packet loss, time 0ms\nrtt min/avg/max/mdev = 0.146/0.146/0.146/0.000 ms"
    }
  ]
}
```

`tracepath` reports the smaller `pmtu` at the hop where it starts. `ping -M do` sets the "don't fragment" flag: once the host knows the path MTU, a packet that is too large fails locally with `message too long`, and one that fits gets through. When you find an MTU problem, either let ICMP "fragmentation needed" (ICMPv6 "packet too big" for IPv6) through every firewall on the path, or lower the MTU (or the TCP MSS) at the tunnel.

## Where Does the Time Go?

A slow request can be slow in DNS, in the TCP or TLS handshake, or in the server. curl's timers split the total. Save the format once:

```text
       dns  %{time_namelookup}s\n
   connect  %{time_connect}s\n
       tls  %{time_appconnect}s\n
first byte  %{time_starttransfer}s\n
     total  %{time_total}s\n
```

```terminal
{
  "title": "a fast request and a slow one",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "client#",
      "cmd": "curl -s -o /dev/null -w @curl-time.txt --cacert /etc/netlab/tls/ca.crt https://www.shop.example/",
      "output": "       dns  0.002622s\n   connect  0.003041s\n       tls  0.017026s\nfirst byte  0.019649s\n     total  0.019768s"
    },
    {
      "prompt": "client#",
      "cmd": "curl -s -o /dev/null -w @curl-time.txt --cacert /etc/netlab/tls/ca.crt https://www.shop.example/slow",
      "output": "       dns  0.000992s\n   connect  0.001636s\n       tls  0.014058s\nfirst byte  2.018406s\n     total  2.018603s"
    }
  ]
}
```

Each timer is cumulative, measured from the start. In the slow request DNS, connect and TLS take the same few milliseconds as before, and the jump is between TLS and the first byte: the server (here, the `/slow` endpoint, which waits two seconds) is slow, not the network. Large gaps in the other places point elsewhere: `dns` to the resolver, `connect` to latency or a busy server's accept queue, `tls` to the handshake or certificate checks such as OCSP.

## Sockets and Connection States

`ss` shows every socket and its state. A summary, and a count by state, are the first things to look at on a busy server:

```terminal
{
  "title": "socket summary and states on lb",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "lb#",
      "cmd": "ss -s",
      "output": "Total: 4\nTCP:   80 (estab 0, closed 78, orphaned 0, timewait 38)\n\nTransport Total     IP        IPv6\nRAW\t  0         0         0\nUDP\t  0         0         0\nTCP\t  2         2         0\nINET\t  2         2         0\nFRAG\t  0         0         0"
    },
    {
      "comment": "count TCP sockets by state",
      "prompt": "lb#",
      "cmd": "ss -tan | awk 'NR > 1 { n[$1]++ } END { for (s in n) print s, n[s] }'",
      "output": "LISTEN 2\nTIME-WAIT 38"
    }
  ]
}
```

- `LISTEN`: servers waiting for connections. `ss -tlnp` shows them with their process.
- `ESTAB`: open connections.
- `TIME-WAIT`: connections that this side closed first, kept for about 60 seconds so that late packets cannot confuse a new connection with the same 4-tuple. Thousands of them on a client mean it opens a new connection per request; use keep-alive and pooling (Part 5 used `keepalive` towards the app servers for this).
- `SYN-RECV` piling up on a server means half-open connections: a SYN flood, or clients that cannot complete the handshake.
- `CLOSE-WAIT` piling up means the application received the peer's close and never closed its own socket: a bug in the application, not the network.

## Monitor Before Users Notice

Interactive tools answer "what is wrong now". Monitoring answers "is anything wrong" all the time. Two kinds of checks cover a network:

- **Black-box probes** from outside: can a client resolve the name, connect, complete TLS and get a 200, and how long does it take? The Prometheus **blackbox exporter** does exactly this for HTTP, TCP, DNS and ICMP.
- **White-box metrics** from inside: interface errors and drops, retransmissions, connection counts, conntrack table use. The Prometheus **node exporter** exposes these from `/proc` and `/sys`.

Run the blackbox exporter on `client`, the outside view. Download it from its [releases page](https://github.com/prometheus/blackbox_exporter/releases) (check the SHA-256 sum), and give it a config with three probe modules:

```yaml
modules:
  https_2xx:
    prober: http
    timeout: 5s
    http:
      preferred_ip_protocol: ip4
      tls_config:
        ca_file: /etc/netlab/tls/ca.crt
  dns_shop:
    prober: dns
    timeout: 5s
    dns:
      query_name: www.shop.example
      query_type: A
      preferred_ip_protocol: ip4
      valid_rcodes: [NOERROR]
  tcp_connect:
    prober: tcp
    timeout: 5s
    tcp:
      preferred_ip_protocol: ip4
```

```terminal
{
  "title": "three probes, as Prometheus would run them",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "comment": "started with: blackbox_exporter --config.file=/etc/netlab/blackbox.yml --web.listen-address=127.0.0.1:9115",
      "prompt": "client#",
      "cmd": "curl -s 'http://127.0.0.1:9115/probe?module=https_2xx&target=https://www.shop.example/' | grep -E '^probe_(success|http_status_code|duration_seconds|ssl_earliest_cert_expiry|http_version)'",
      "output": "probe_duration_seconds 0.014114521\nprobe_http_status_code 200\nprobe_http_version 2\nprobe_ssl_earliest_cert_expiry 1.795685735e+09\nprobe_success 1"
    },
    {
      "prompt": "client#",
      "cmd": "curl -s 'http://127.0.0.1:9115/probe?module=dns_shop&target=203.0.113.53' | grep -E '^probe_(success|dns_answer_rrs|duration_seconds)'",
      "output": "probe_dns_answer_rrs 2\nprobe_duration_seconds 0.001173988\nprobe_success 1"
    },
    {
      "comment": "the database is not published to the internet: the probe fails",
      "prompt": "client#",
      "cmd": "curl -s 'http://127.0.0.1:9115/probe?module=tcp_connect&target=203.0.113.80:5432' | grep -E '^probe_(success|duration_seconds)'",
      "output": "probe_duration_seconds 0.000563809\nprobe_success 0"
    }
  ]
}
```

Each probe returns metrics; Prometheus scrapes the `/probe` URL on a schedule (the target goes in the URL, which takes a relabelling step in the scrape config) and alerts on them. `probe_success` is 1 or 0, `probe_duration_seconds` is the whole check, and `probe_ssl_earliest_cert_expiry` is the Unix time when the first certificate in the chain expires, which turns certificate renewals into an alert instead of an outage. Rules that the guide's companion repository checks with `promtool`:

```yaml
groups:
  - name: network
    rules:
      - alert: EndpointDown
        expr: probe_success == 0
        for: 2m
        labels:
          severity: page
        annotations:
          summary: '{{ $labels.instance }} has failed its probe for 2 minutes'
      - alert: EndpointSlow
        expr: probe_duration_seconds > 1
        for: 10m
        labels:
          severity: ticket
        annotations:
          summary: '{{ $labels.instance }} takes {{ $value | humanizeDuration }} to answer'
      - alert: CertificateExpiresSoon
        expr: probe_ssl_earliest_cert_expiry - time() < 14 * 86400
        for: 1h
        labels:
          severity: ticket
        annotations:
          summary: 'The certificate of {{ $labels.instance }} expires in less than 14 days'
      - alert: TcpRetransmitsHigh
        expr: rate(node_netstat_Tcp_RetransSegs[5m]) / rate(node_netstat_Tcp_OutSegs[5m]) > 0.02
        for: 15m
        labels:
          severity: ticket
        annotations:
          summary: 'More than 2% of TCP segments from {{ $labels.instance }} are retransmissions'
```

```terminal
{
  "title": "validate the rules (companion repo, Prometheus 3.15)",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "promtool check rules network-alerts.yml",
      "output": "Checking network-alerts.yml\n  SUCCESS: 4 rules found"
    }
  ]
}
```

Page a person only for what users feel (an endpoint down for minutes), and send the rest to a ticket queue. The [page, ticket or ignore](/posts/cheap-model-alert-triage-digitalocean-inference) post goes through that triage.

### A Small Check Script

Not everything needs Prometheus. A script that checks the paths a service depends on, with timeouts and a clear exit status, is useful in a deploy pipeline, a cron job or right after a firewall change. Save it as `netcheck.sh` and make it executable (`chmod +x netcheck.sh`):

```bash
#!/usr/bin/env bash
# netcheck.sh HOST:PORT...: check that each name resolves and that one of its addresses
# accepts TCP connections on the port
set -u
if [ "$#" -eq 0 ]; then
  echo "usage: $0 HOST:PORT..." >&2
  exit 2
fi
status=0
for target in "$@"; do
  host=${target%:*}
  port=${target##*:}
  case "$port" in
    '' | *[!0-9]*)
      printf 'FAIL  %-22s not a HOST:PORT pair\n' "$target"
      status=1
      continue
      ;;
  esac
  # every address of the name, in the resolver's order; the lookup itself is limited to 3 s
  addrs=$(timeout 3 getent ahosts "$host" | awk '!seen[$1]++ { print $1 }')
  if [ -z "$addrs" ]; then
    printf 'FAIL  %-22s name does not resolve\n' "$target"
    status=1
    continue
  fi
  result=""
  for addr in $addrs; do
    start=$(date +%s%N)
    if out=$(nc -n -zv -w 3 "$addr" "$port" 2>&1); then
      result=$(printf 'ok    %-22s %s, %d ms' "$target" "$addr" $((($(date +%s%N) - start) / 1000000)))
      break
    fi
    case "$out" in
      *"timed out"*) reason="no answer within 3 s" ;;
      *": "*) reason=${out##*: } ;;
      *) reason="connection failed" ;;
    esac
    result=$(printf 'FAIL  %-22s %s, %s' "$target" "$addr" "$reason")
  done
  echo "$result"
  case "$result" in FAIL*) status=1 ;; esac
done
exit "$status"
```

```terminal
{
  "title": "check what web1 depends on",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "web1#",
      "cmd": "./netcheck.sh db:5432 lb:80 ns1:53 db:6379 cache:6379",
      "output": "ok    db:5432                10.0.3.10, 17 ms\nok    lb:80                  10.0.1.10, 17 ms\nok    ns1:53                 10.0.3.53, 17 ms\nFAIL  db:6379                10.0.3.10, Connection refused\nFAIL  cache:6379             name does not resolve"
    }
  ]
}
```

Three ways to fail, three different messages: a refused port, a name that does not exist, and (if you add a firewall rule) a timeout. The exit status of 1 makes a pipeline step or a cron wrapper fail loudly.

## Common Mistakes

- **Testing from the wrong place.** Run checks from the failing host, container or pod, with its DNS settings and its firewall.
- **Concluding "the network is fine" from ping.** ICMP can pass while a firewall drops the TCP port, and the other way round.
- **Reading loss at a middle `mtr` hop as a fault.** Look at the final hop.
- **Watching averages.** A 50 ms average can hide a p99 of 2 seconds. Alert on percentiles and on failures.
- **No timeouts in clients.** Without a connect timeout, a dropped SYN takes over two minutes to fail.
- **Capturing everything.** Filter captures by host and port, keep them short, and treat pcap files as secrets.

## Summary

- Troubleshoot in order: name, route, port, TLS, application, and run each check from where the failure happens.
- `tc netem` simulates delay, jitter and loss (and, with its `rate` option, a slow link); a few percent of loss can cut TCP throughput dramatically.
- `tcpdump -ttt` shows SYN retries: one second apart at first, then doubling, for over two minutes; `tracepath` and `ping -M do` find MTU problems.
- curl's timers split a slow request into DNS, connect, TLS and server time; `ss` states point to pooling problems, floods and application bugs.
- Black-box probes (blackbox exporter) and white-box counters (node exporter) catch failures, slowness and expiring certificates before users do.

Next, [Part 9](/guides/networking-fundamentals/09-network-automation) puts the network itself into code: firewall rules, cloud networks and tests in a pipeline.

## Keep Learning

- [Ping: request timed out vs destination host unreachable](/posts/ping-timeout-vs-destination-unreachable)
- [Capturing mobile phone traffic with Wireshark](/posts/capturing-mobile-phone-traffic-on-wireshark)
- Simulators: [latency percentiles](/games/latency-percentiles-simulator), [PromQL playground](/games/promql-playground)
- [Monitoring and logging](/guides/introduction-to-kubernetes/09-monitoring-and-logging-in-kubernetes) in the Kubernetes guide
