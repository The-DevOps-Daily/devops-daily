---
title: 'Network Fundamentals: Layers, IP, TCP, UDP and Ports'
description: 'How a request crosses a network: TCP/IP layers, IP addresses, ports and sockets, TCP vs UDP, HTTP and TLS, traced with curl and tcpdump in a practice lab.'
order: 1
---

When your application calls an API, opens a database connection or serves a web page, it hands bytes to the operating system and trusts the network to deliver them. Most of the time that works. When it does not, the error message names a layer: "Could not resolve host" is DNS, "Connection refused" is a port with nothing listening, "Connection timed out" is usually a firewall, and "certificate verify failed" is TLS. Knowing which layer each message comes from is most of what makes network problems fast to fix.

In this part you build a small practice network on one Linux machine, send a request through it, and watch every step: the name lookup, the TCP handshake, the HTTP exchange and the TLS handshake. The same lab carries through the whole guide.

## Prerequisites

- A Linux machine where you can use `sudo`. Use a throwaway VM or cloud server: the lab installs servers (BIND, Unbound, nginx, HAProxy) that you probably do not want on your laptop. Ubuntu 26.04 LTS and 24.04 LTS both work. A local VM from Multipass or UTM is enough; so is a small cloud server. On DigitalOcean, [create a Droplet](https://m.do.co/c/2a9bba940f39) with Ubuntu 26.04 and delete it when you finish the guide. This is a referral link: new accounts get DigitalOcean's standard [sign-up credit](https://docs.digitalocean.com/platform/billing/signup-credit/), and this site gets credit if you later spend on DigitalOcean ([referral terms](https://docs.digitalocean.com/platform/teams/refer-others/)). You need a valid payment method before you can create a Droplet.
- Comfort with a terminal. No networking knowledge is needed.

Install the tools the lab uses, then stop the server packages from running on the machine itself (the lab starts its own copies inside the practice network):

```bash
sudo apt update
sudo apt install -y iproute2 iputils-ping iputils-tracepath iputils-arping traceroute mtr-tiny \
  tcpdump nftables conntrack curl netcat-openbsd openssl python3 ipcalc iperf3 wireguard-tools \
  bind9 bind9-dnsutils unbound nginx haproxy
sudo systemctl disable --now named unbound nginx haproxy
```

## Build the Practice Lab

The lab is one Bash script, `netlab.sh`. It uses Linux **network namespaces**: each namespace has its own interfaces, addresses, routing table and firewall, which is exactly how containers get their own network. Nine namespaces play nine machines, connected by virtual cables (**veth pairs**) to virtual switches (**bridges**) inside a router:

```diagram
{
  "type": "infra",
  "flow": [
    { "label": "client", "sub": "203.0.113.10", "icon": "globe", "tone": "slate" },
    { "label": "router", "sub": "NAT, firewall, DNS resolver", "icon": "net", "tone": "amber" },
    { "label": "lb", "sub": "nginx :80 :443", "icon": "server", "tone": "green" },
    { "label": "web1-3", "sub": "app :8080", "icon": "box", "tone": "blue" },
    { "label": "db", "sub": ":5432", "icon": "database", "tone": "violet" }
  ],
  "groups": [
    {
      "label": "internet side",
      "sub": "203.0.113.0/24",
      "icon": "globe",
      "tone": "slate",
      "nodes": [
        { "label": "client", "sub": "203.0.113.10", "icon": "cpu", "tone": "slate" },
        { "label": "remote", "sub": "203.0.113.20, web server", "icon": "server", "tone": "slate" }
      ]
    },
    {
      "label": "router",
      "sub": "public 203.0.113.80 (shop), 203.0.113.53 (DNS)",
      "icon": "net",
      "tone": "amber",
      "nodes": [
        { "label": "routing + NAT", "sub": "nftables", "icon": "net", "tone": "amber" },
        { "label": "resolver", "sub": "Unbound", "icon": "gear", "tone": "amber" }
      ]
    },
    {
      "label": "private subnets",
      "sub": "10.0.0.0/16",
      "icon": "shield",
      "tone": "blue",
      "groups": [
        { "label": "edge 10.0.1.0/24", "icon": "net", "tone": "green", "nodes": [ { "label": "lb", "sub": "10.0.1.10, nginx", "icon": "server", "tone": "green" } ] },
        { "label": "app 10.0.2.0/24", "icon": "net", "tone": "blue", "nodes": [ { "label": "web1, web2, web3", "sub": "10.0.2.11-13 :8080", "icon": "box", "tone": "blue" } ] },
        { "label": "data 10.0.3.0/24", "icon": "net", "tone": "violet", "nodes": [ { "label": "db", "sub": "10.0.3.10 :5432", "icon": "database", "tone": "violet" }, { "label": "ns1", "sub": "10.0.3.53, BIND", "icon": "database", "tone": "violet" } ] }
      ]
    }
  ]
}
```

The addresses `203.0.113.0/24` are reserved for documentation (RFC 5737), so they stand in for the public internet without clashing with any real network. The names `shop.example` and `shop.internal` are reserved too. Download the script, read it (it runs as root), and start the lab:

```bash
curl -fsSLO https://raw.githubusercontent.com/The-DevOps-Daily/guide-networking-demo-2026-10-27/v1/netlab.sh
less netlab.sh
chmod +x netlab.sh
```

```terminal
{
  "title": "start the lab",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "sudo ./netlab.sh up",
      "output": "netlab is up. Hosts and addresses:\n  client   203.0.113.10                 a user on the internet\n  remote   203.0.113.20                 a web server on the internet (port 80)\n  router   203.0.113.1                  the gateway: routing, NAT, firewall, DNS resolver\n           10.0.1.1, 10.0.2.1, 10.0.3.1 (public: 203.0.113.80 for lb, 203.0.113.53 for ns1)\n  lb       10.0.1.10                    nginx on ports 80 and 443 (public: 203.0.113.80)\n  web1-3   10.0.2.11, .12, .13          the app on port 8080\n  db       10.0.3.10                    a database stand-in on port 5432\n  ns1      10.0.3.53                    authoritative DNS for shop.example and shop.internal\nRun a command on a lab host:  sudo ip netns exec client curl http://www.shop.example/"
    }
  ]
}
```

Run `sudo ./netlab.sh down` at any time to remove everything, and `sudo ./netlab.sh up` to get a fresh lab. The parts of this guide change the lab on purpose (delays, firewalls, new configs), so start every part with `sudo ./netlab.sh down && sudo ./netlab.sh up`, and close any shells you opened inside lab hosts. The script never touches your own interfaces, routes or firewall, and `down` removes only the namespaces and files that `up` created.

To run a command on a lab host, prefix it with `sudo ip netns exec <host>`, or open a root shell on that host:

```bash
sudo ip netns exec client bash
```

In the rest of the guide the prompt shows which host a command runs on: `client#` means "in a shell on client". The output in this guide comes from the lab on Ubuntu 26.04.1 LTS. Your timings and the random parts (MAC addresses, port numbers) will differ.

## The Layers You Actually Use

Networking is built in layers. Each layer does one job and relies on the layer below it, and each adds its own header in front of the data (**encapsulation**):

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Application", "sub": "HTTP request: GET / Host: www.shop.example", "icon": "globe", "tone": "blue" },
    { "label": "Transport", "sub": "TCP segment: ports 51616 -> 80", "icon": "box", "tone": "green" },
    { "label": "Internet", "sub": "IP packet: 203.0.113.10 -> 203.0.113.80", "icon": "net", "tone": "amber" },
    { "label": "Link", "sub": "Ethernet frame: MAC -> MAC", "icon": "cpu", "tone": "slate" }
  ]
}
```

The model the internet actually uses is the **TCP/IP model** with four layers. The **OSI model** has seven and is the vocabulary people use in conversation ("a layer 4 load balancer", "a layer 7 firewall"), so you need the mapping:

| OSI layer | Name         | TCP/IP layer | What it does                           | Examples                            |
| --------- | ------------ | ------------ | -------------------------------------- | ----------------------------------- |
| 7         | Application  | Application  | The data your program cares about      | HTTP, DNS, SSH, PostgreSQL protocol |
| 6         | Presentation | Application  | Encoding, encryption                   | TLS (in practice)                   |
| 5         | Session      | Application  | Keeping a conversation going           | Rarely a separate thing today       |
| 4         | Transport    | Transport    | Ports, reliability, flow control       | TCP, UDP, QUIC (over UDP)           |
| 3         | Network      | Internet     | Addresses and routing between networks | IPv4, IPv6, ICMP                    |
| 2         | Data link    | Link         | Delivery on one local network          | Ethernet, Wi-Fi, ARP                |
| 1         | Physical     | Link         | Bits on a wire or radio                | Cables, fibre, radio                |

Real protocols do not fit the boxes exactly. TLS sits between TCP and HTTP. QUIC is a transport protocol that runs inside UDP. Treat the model as a checklist for troubleshooting, not as a law: when something fails, you work up from the bottom. Can the packets get there (IP and routing)? Is the port open (TCP)? Does the application answer correctly (HTTP, TLS)?

## Follow One Request

Send a request from `client` to the shop. `-v` makes curl narrate each step, and `-s` hides the progress meter:

```terminal
{
  "title": "one HTTP request, step by step",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "client#",
      "cmd": "curl -sv http://www.shop.example/",
      "output": "* Host www.shop.example:80 was resolved.\n* IPv6: (none)\n* IPv4: 203.0.113.80\n*   Trying 203.0.113.80:80...\n* Established connection to www.shop.example (203.0.113.80 port 80) from 203.0.113.10 port 46302\n* using HTTP/1.x\n> GET / HTTP/1.1\n> Host: www.shop.example\n> User-Agent: curl/8.18.0\n> Accept: */*\n>\n* Request completely sent off\n< HTTP/1.1 200 OK\n< Server: nginx/1.28.3\n< Date: Tue, 27 Oct 2026 09:34:00 GMT\n< Content-Type: text/plain\n< Content-Length: 27\n< Connection: keep-alive\n<\n{ [27 bytes data]\n* Connection #0 to host www.shop.example:80 left intact\nserved by web1 (10.0.2.11)"
    }
  ]
}
```

Read it from the top:

1. **DNS**: curl looked up `www.shop.example` and got `203.0.113.80`. Part 3 shows how that answer was found.
2. **TCP**: `Established connection to www.shop.example (203.0.113.80 port 80) from 203.0.113.10 port ...` means the TCP handshake finished. The client used a random source port.
3. **HTTP**: the lines that start with `>` are the request curl sent; `<` lines are the response headers. `200 OK` is the status code.
4. **The body**: `served by web1 (10.0.2.11)`. The answer came from `web1`, a machine with a private address that `client` never connected to. `lb` received the request and passed it on: it is a **reverse proxy**.

Now watch the same request as packets. `tcpdump` prints every packet that crosses an interface. Open a second terminal, start a capture on `lb`, and send the request again from `client`:

```terminal
{
  "title": "the packets of one request, seen on lb",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "lb#",
      "cmd": "tcpdump -nn -i eth0 -c 10 'tcp port 80'",
      "output": "IP 203.0.113.10.52790 > 10.0.1.10.80: Flags [S], seq 3312841357, win 64240, length 0\nIP 10.0.1.10.80 > 203.0.113.10.52790: Flags [S.], seq 930132585, ack 3312841358, win 65160, length 0\nIP 203.0.113.10.52790 > 10.0.1.10.80: Flags [.], ack 1, win 502, length 0\nIP 203.0.113.10.52790 > 10.0.1.10.80: Flags [P.], seq 1:81, ack 1, win 502, length 80: HTTP: GET / HTTP/1.1\nIP 10.0.1.10.80 > 203.0.113.10.52790: Flags [.], ack 81, win 509, length 0\nIP 10.0.1.10.80 > 203.0.113.10.52790: Flags [P.], seq 1:176, ack 81, win 509, length 175: HTTP: HTTP/1.1 200 OK\nIP 203.0.113.10.52790 > 10.0.1.10.80: Flags [.], ack 176, win 501, length 0\nIP 203.0.113.10.52790 > 10.0.1.10.80: Flags [F.], seq 81, ack 176, win 501, length 0\nIP 10.0.1.10.80 > 203.0.113.10.52790: Flags [F.], seq 176, ack 82, win 509, length 0\nIP 203.0.113.10.52790 > 10.0.1.10.80: Flags [.], ack 177, win 501, length 0"
    },
    {
      "comment": "in the other terminal",
      "prompt": "client#",
      "cmd": "curl -s -o /dev/null http://www.shop.example/"
    }
  ]
}
```

The time stamps and TCP options are cut from the lines to keep them short. The flags in square brackets tell the story:

- `[S]`, `[S.]`, `[.]`: the **three-way handshake**. The client sends SYN, the server answers SYN-ACK, the client acknowledges. No data has moved yet, and one full round trip is gone.
- `[P.]` with `HTTP: GET / HTTP/1.1`: the request. The next `[P.]` is the response. `length` is the number of payload bytes.
- `[F.]`: FIN, each side closing its half of the connection.

Two details are worth noticing. The client address is `203.0.113.10`, but the destination is `10.0.1.10`, not `203.0.113.80`: the router rewrote the destination on the way in (**destination NAT**, Part 2). And `lb` saw only this side of the conversation; its own connection to `web1` is a second, separate TCP connection.

## Addresses, Ports and Sockets

An IP address gets a packet to a machine. A **port** (a 16-bit number, 0 to 65535) gets it to one program on that machine. A program that waits for connections **listens** on a port; `ss` shows which:

```terminal
{
  "title": "who is listening, and where",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "lb#",
      "cmd": "ss -tlnp",
      "output": "State  Recv-Q Send-Q Local Address:Port Peer Address:PortProcess\nLISTEN 0      511          0.0.0.0:443       0.0.0.0:*    users:((\"nginx\",pid=148,fd=7),(\"nginx\",pid=144,fd=7))\nLISTEN 0      511          0.0.0.0:80        0.0.0.0:*    users:((\"nginx\",pid=148,fd=6),(\"nginx\",pid=144,fd=6))"
    },
    {
      "prompt": "web1#",
      "cmd": "ss -tlnp",
      "output": "State  Recv-Q Send-Q Local Address:Port Peer Address:PortProcess\nLISTEN 0      5            0.0.0.0:8080      0.0.0.0:*    users:((\"python3\",pid=139,fd=3))"
    },
    {
      "prompt": "router#",
      "cmd": "ss -ulnp",
      "output": "State  Recv-Q Send-Q Local Address:Port Peer Address:PortProcess\nUNCONN 0      0           10.0.3.1:53        0.0.0.0:*    users:((\"unbound\",pid=138,fd=11))\nUNCONN 0      0           10.0.2.1:53        0.0.0.0:*    users:((\"unbound\",pid=138,fd=9))\nUNCONN 0      0           10.0.1.1:53        0.0.0.0:*    users:((\"unbound\",pid=138,fd=7))\nUNCONN 0      0        203.0.113.1:53        0.0.0.0:*    users:((\"unbound\",pid=138,fd=5))\nUNCONN 0      0          127.0.0.1:53        0.0.0.0:*    users:((\"unbound\",pid=138,fd=3))"
    }
  ]
}
```

The options are `-t` TCP, `-u` UDP, `-l` listening, `-n` numeric (no name lookups) and `-p` the owning process. The **Local Address** column matters more than anything else on that line:

- `0.0.0.0:80` (or `*:80`, or `[::]:80` for IPv6): the service accepts connections on every address of the machine.
- `127.0.0.1:53`: only programs on the same machine can connect (here, the router's own lookups). This is the most common reason a service "works on the server but not from outside": it listens on the loopback address.
- `10.0.1.1:53`: one specific address. Unbound on the router listens on each of its addresses, so each subnet can reach it.

How can port 80 on `lb` serve many clients at once? A TCP connection is identified by four values, the **4-tuple**: source address, source port, destination address and destination port. The client picks a random source port for each connection, so every connection is unique even though they all go to port 80. Open three connections that stay open, then look:

```terminal
{
  "title": "three connections to the same port",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "comment": "three slow requests in the background (/slow answers after 2 s)",
      "prompt": "client#",
      "cmd": "for i in 1 2 3; do curl -s -o /dev/null http://www.shop.example/slow & done"
    },
    {
      "prompt": "lb#",
      "cmd": "ss -tn state established '( sport = :80 )'",
      "output": "Recv-Q Send-Q Local Address:Port Peer Address:Port\n0      0          10.0.1.10:80   203.0.113.10:52828\n0      0          10.0.1.10:80   203.0.113.10:52812\n0      0          10.0.1.10:80   203.0.113.10:52800"
    }
  ]
}
```

All three connections use local port 80; only the client's port differs. The client's operating system picks those **ephemeral ports** from a fixed range:

```terminal
{
  "title": "the ephemeral port range",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "client#",
      "cmd": "cat /proc/sys/net/ipv4/ip_local_port_range",
      "output": "32768\t60999"
    }
  ]
}
```

That range is also the limit you hit when one machine opens tens of thousands of connections to the same destination: every connection needs its own 4-tuple. The posts [Can two sockets share a TCP port?](/posts/can-two-sockets-share-tcp-port) and [port vs socket](/posts/difference-between-port-and-socket) go deeper.

Ports you will meet constantly:

| Port             | Protocol                      | Service                          |
| ---------------- | ----------------------------- | -------------------------------- |
| 22               | TCP                           | SSH                              |
| 53               | UDP and TCP                   | DNS                              |
| 80, 443          | TCP (443 also UDP for HTTP/3) | HTTP, HTTPS                      |
| 3306             | TCP                           | MySQL                            |
| 5432             | TCP                           | PostgreSQL                       |
| 6379             | TCP                           | Redis, Valkey                    |
| 8080, 8000, 3000 | TCP                           | Common development and app ports |

Ports below 1024 are **privileged** on Linux: binding to them needs root or the `CAP_NET_BIND_SERVICE` capability. That is why apps often listen on 8080 behind a proxy on 80.

## TCP and UDP

The transport layer offers two main choices, and they make different promises:

|                             | TCP                                        | UDP                                        |
| --------------------------- | ------------------------------------------ | ------------------------------------------ |
| Connection                  | Handshake first (1 round trip)             | None: just send                            |
| Delivery                    | Retransmits lost data, keeps order         | No retransmission, no ordering             |
| Unit                        | A stream of bytes                          | Separate datagrams                         |
| Flow and congestion control | Yes                                        | No (the application must be careful)       |
| Typical uses                | HTTP/1.1 and HTTP/2, SSH, databases, email | DNS, streaming, games, VoIP, QUIC (HTTP/3) |

DNS is the classic UDP protocol. A query is one datagram and the answer is another, with no handshake:

```terminal
{
  "title": "a DNS query over UDP, seen on the router",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "router#",
      "cmd": "tcpdump -nn -i br-wan -c 2 'udp port 53'",
      "output": "IP 203.0.113.10.39802 > 203.0.113.1.53: 26988+ [1au] A? www.shop.example. (57)\nIP 203.0.113.1.53 > 203.0.113.10.39802: 26988 2/0/1 CNAME shop.example., A 203.0.113.80 (75)"
    },
    {
      "comment": "in the other terminal",
      "prompt": "client#",
      "cmd": "dig +short www.shop.example",
      "output": "shop.example.\n203.0.113.80"
    }
  ]
}
```

Two packets: the question and the answer. If the answer is lost, the client simply asks again after a timeout. DNS switches to TCP when an answer is too large for one datagram.

"UDP is faster" is true in one specific way: it skips the handshake. On a fast local network you cannot see the difference, so the lab can add delay. `tc` with the `netem` queueing discipline makes the router hold every packet to `client` for 50 ms, which turns the link into a 50 ms round trip, like a server on another continent:

```terminal
{
  "title": "add 50 ms of delay to the client link",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "router#",
      "cmd": "tc qdisc add dev p-client root netem delay 50ms"
    },
    {
      "prompt": "client#",
      "cmd": "ping -c 3 203.0.113.80",
      "output": "PING 203.0.113.80 (203.0.113.80) 56(84) bytes of data.\n64 bytes from 203.0.113.80: icmp_seq=1 ttl=64 time=50.1 ms\n64 bytes from 203.0.113.80: icmp_seq=2 ttl=64 time=50.2 ms\n64 bytes from 203.0.113.80: icmp_seq=3 ttl=64 time=50.1 ms\n\n--- 203.0.113.80 ping statistics ---\n3 packets transmitted, 3 received, 0% packet loss, time 2007ms\nrtt min/avg/max/mdev = 50.109/50.153/50.226/0.051 ms"
    }
  ]
}
```

Now time a DNS query, a plain HTTP request and an HTTPS request. curl's `-w` option prints its timers: `time_connect` is when the TCP handshake finished, `time_appconnect` when the TLS handshake finished, and `time_starttransfer` when the first byte of the response arrived. `--resolve` pins the address so that no DNS lookup hides in the numbers:

```terminal
{
  "title": "what each handshake costs at 50 ms round trip",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "client#",
      "cmd": "dig www.shop.example | grep 'Query time'",
      "output": ";; Query time: 51 msec"
    },
    {
      "prompt": "client#",
      "cmd": "curl -s -o /dev/null --resolve www.shop.example:80:203.0.113.80 -w 'connect %{time_connect}s  first byte %{time_starttransfer}s\\n' http://www.shop.example/",
      "output": "connect 0.050541s  first byte 0.102891s"
    },
    {
      "prompt": "client#",
      "cmd": "curl -s -o /dev/null --cacert /etc/netlab/tls/ca.crt --resolve www.shop.example:443:203.0.113.80 -w 'connect %{time_connect}s  tls %{time_appconnect}s  first byte %{time_starttransfer}s\\n' https://www.shop.example/",
      "output": "connect 0.050371s  tls 0.113694s  first byte 0.166225s"
    }
  ]
}
```

The pattern is the point: each handshake costs one round trip. The DNS answer arrives after one round trip, plain HTTP needs two (TCP handshake, then request and response), and HTTPS needs three (TCP, TLS 1.3, then the request). Seven runs of each, median time to the answer:

```chart
{
  "type": "bar",
  "title": "Time to the first answer byte at 50 ms round trip",
  "unit": "ms",
  "caption": "Median of 7 runs in the netlab practice network, with netem adding 50 ms of delay on the router-to-client link. Run on a small ARM board; your numbers will differ slightly, the steps of about 50 ms will not.",
  "rows": [
    { "label": "DNS query (UDP)", "value": 47, "series": "1 round trip" },
    { "label": "HTTP (TCP)", "value": 103, "series": "2 round trips" },
    { "label": "HTTPS (TCP + TLS 1.3)", "value": 165, "series": "3 round trips" }
  ]
}
```

That is why connection reuse matters so much: HTTP keep-alive, connection pools for databases, and HTTP/2, which sends many requests over one connection. It is also why **QUIC**, the transport under **HTTP/3**, runs over UDP: it combines the transport and TLS handshakes into one round trip, and lets a resumed connection send data in the first packet. UDP itself is not magic; QUIC rebuilds reliability and congestion control on top of it. The posts [UDP vs TCP: how much faster is UDP really?](/posts/udp-vs-tcp-performance-comparison) and [when to use UDP instead of TCP](/posts/when-is-it-appropriate-to-use-udp-instead-of-tcp) measure this further.

## HTTP and TLS

HTTPS is HTTP inside a TLS connection. TLS encrypts the traffic and proves the server's identity with a certificate that a trusted **certificate authority** (CA) signed. The lab has its own small CA (`/etc/netlab/tls/ca.crt`); `openssl s_client` shows the handshake result:

```terminal
{
  "title": "the TLS handshake",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "client#",
      "cmd": "openssl s_client -connect www.shop.example:443 -servername www.shop.example -verify_hostname www.shop.example -verify_return_error -CAfile /etc/netlab/tls/ca.crt -brief < /dev/null",
      "output": "Connecting to 203.0.113.80\nCONNECTION ESTABLISHED\nProtocol version: TLSv1.3\nCiphersuite: TLS_AES_256_GCM_SHA384\nPeer certificate: CN=www.shop.example\nHash used: SHA256\nSignature type: ecdsa_secp256r1_sha256\nVerification: OK\nVerified peername: www.shop.example\nNegotiated TLS1.3 group: X25519MLKEM768\nDONE"
    },
    {
      "prompt": "client#",
      "cmd": "curl -sI --cacert /etc/netlab/tls/ca.crt https://www.shop.example/",
      "output": "HTTP/2 200\nserver: nginx/1.28.3\ndate: Tue, 27 Oct 2026 09:34:12 GMT\ncontent-type: text/plain\ncontent-length: 27"
    }
  ]
}
```

`TLSv1.3`, `Verification: OK` and the verified host name are what you want to see. `-servername` sends **SNI** (Server Name Indication), the host name the client wants, so that one address can serve certificates for many sites; `-verify_hostname` checks that the certificate is valid for that name, and `-verify_return_error` makes `s_client` stop on any certificate error instead of carrying on, which it does by default. The key exchange group `X25519MLKEM768` is a hybrid of classic X25519 and the post-quantum ML-KEM, which OpenSSL 3.5 and current browsers prefer by default. curl negotiated **HTTP/2** with the server during the TLS handshake (ALPN), which is why the status line says `HTTP/2 200`.

## When It Fails, Read the Error

Every layer fails with its own message. These are the ones you will see most, produced on purpose in the lab:

```terminal
{
  "title": "four failures, four layers",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "comment": "DNS: the name does not exist",
      "prompt": "client#",
      "cmd": "curl -sS http://nope.shop.example/",
      "output": "curl: (6) Could not resolve host: nope.shop.example"
    },
    {
      "comment": "routing: the router has no route to this network",
      "prompt": "client#",
      "cmd": "nc -zv -w 5 198.51.100.7 80",
      "output": "nc: connect to 198.51.100.7 port 80 (tcp) failed: Network is unreachable"
    },
    {
      "comment": "TCP: the machine is there, but nothing listens on port 81",
      "prompt": "client#",
      "cmd": "nc -zv -w 5 203.0.113.20 81",
      "output": "nc: connect to 203.0.113.20 port 81 (tcp) failed: Connection refused"
    },
    {
      "comment": "TLS: the certificate is not signed by a CA this client trusts",
      "prompt": "client#",
      "cmd": "curl -sS https://www.shop.example/",
      "output": "curl: (60) SSL certificate OpenSSL verify result: unable to get local issuer certificate (20)\nMore details here: https://curl.se/docs/sslcerts.html\n\ncurl failed to verify the legitimacy of the server and therefore could not\nestablish a secure connection to it. To learn more about this situation and\nhow to fix it, please visit the webpage mentioned above."
    }
  ]
}
```

- **Could not resolve host**: DNS. Check the name and the resolver (Part 3).
- **Network is unreachable** or **No route to host**: routing. Here the router had no path to `198.51.100.0/24` and sent an ICMP error back (Part 2 and Part 8).
- **Connection refused**: the machine answered, but nothing listens on that port, or a firewall rejects actively. The host is reachable, so look at the service.
- **Connection timed out**: no answer at all. Usually a firewall drops the packets silently, sometimes the machine is down. Part 4 shows both behaviours side by side.
- **SSL certificate ... verify result** (older curl: "SSL certificate problem"): TLS. The name, the expiry date or the trust chain is wrong.

Recent curl versions print `Could not connect to server` for both a refused and an unreachable connection. Add `-v` to see the reason, or test the port with `nc -zv` as above.

## Common Mistakes

- **Testing reachability with `ping` only.** Many networks block ICMP, and a host that answers ping can still have a closed port. Test the real protocol: `nc -zv host 5432`, `curl -v https://host/`.
- **Listening on 127.0.0.1 and wondering why nobody can connect.** Check the Local Address column of `ss -tlnp`.
- **Treating "refused" and "timed out" as the same error.** Refused means something answered; timed out means nothing did. They point to different fixes.
- **Opening a new connection for every request.** Each new connection pays the handshakes again; at 50 ms round trip that is 100 ms before an HTTPS request even starts.
- **Assuming UDP is always faster or always unreliable.** It skips the handshake, and QUIC shows that reliable protocols can be built on it.

## Summary

- Data goes down the layers on the sender (HTTP, TCP, IP, Ethernet) and back up on the receiver; troubleshoot from the bottom up.
- An IP address finds the machine, a port finds the program, and the 4-tuple identifies one TCP connection, which is how one port serves thousands of clients.
- TCP spends a round trip on its handshake and TLS 1.3 another; UDP sends at once. Reuse connections to pay those costs once.
- Error messages name the layer: resolve (DNS), route, refused (port), timed out (often a firewall), certificate (TLS).

Next, [Part 2](/guides/networking-fundamentals/02-ip-addressing-and-subnetting) looks at the addresses themselves: subnets, private ranges, NAT and IPv6.

## Keep Learning

- Simulators: [a packet's journey](/games/packet-journey), [TCP vs UDP](/games/tcp-vs-udp), [the TLS handshake](/games/ssl-tls-handshake)
- Interview questions: [TCP/IP fundamentals](/interview-questions/junior/tcp-ip-basics), [HTTP methods and status codes](/interview-questions/junior/http-basics)
- [Network & Security Fundamentals quiz](/quizzes/network-security-quiz)
- [How to find which process listens on a port in Windows](/posts/find-process-listening-on-port-windows) and [on macOS](/posts/who-is-listening-on-a-given-tcp-port-on-mac-os-x)
