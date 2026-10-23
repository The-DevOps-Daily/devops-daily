---
title: 'Linux Networking Commands: ip, ss, DNS and Troubleshooting'
description: 'Learn Linux networking hands-on: ip, ss, ping, dig, curl and tcpdump in a practice network, then firewalls, static IPs and a troubleshooting checklist.'
order: 8
---

Almost every problem on a server eventually becomes a network question. Is the service listening? On which address? Can this machine reach the database? Does the name resolve? Is a firewall dropping the packets? Linux answers each of these with a small set of tools: `ip` for interfaces, addresses and routes, `ss` for sockets, `ping`, `curl` and `nc` for reachability, `dig` for DNS, `tcpdump` to see the packets, and `nftables` (or a front end such as `ufw`) for the firewall.

In this part you build a small practice network on your own machine, without changing its interfaces, routes or firewall, and use every one of those tools on it.

## Prerequisites

- A Linux machine with `sudo` and the `iproute2` tools (`ip`, `ss`), installed everywhere by default.
- For the lab: `python3`, `curl`, `ping`, `nc`, `nft` and `tcpdump` (on Ubuntu: `sudo apt install curl iputils-ping netcat-openbsd nftables tcpdump`).
- Processes and ports from [Part 7](/guides/introduction-to-linux/07-process-management), and a fresh `~/lab` from [Part 3](/guides/introduction-to-linux/03-command-line-interface#h2-set-up-the-practice-directory): the lab web server serves `~/lab/site`.

The output comes from a lab on Ubuntu 24.04.5 LTS. The addresses `192.0.2.0/24` and `198.51.100.0/24` are reserved for documentation (RFC 5737), so they never clash with a real network. MAC addresses of virtual interfaces are random and will differ on your machine.

## Network Basics in Two Minutes

- An **interface** connects the machine to a network: `eth0`, `enp1s0` or `ens3` for Ethernet (current systems use **predictable names** based on the hardware slot), `wlp2s0` for Wi-Fi, `lo` for the loopback that only reaches the machine itself, and virtual ones such as `docker0`, `veth...` or `wg0`.
- An **IP address** with a prefix length, such as `192.0.2.10/24`. The `/24` says that the first 24 bits are the network, so `192.0.2.1` to `192.0.2.254` are on the same local network and can be reached directly.
- The **routing table** decides where packets for other networks go. The **default route** (the gateway) catches everything without a more specific route.
- **DNS** turns names into addresses. **Ports** identify the service on a machine: 22 for SSH, 80 and 443 for HTTP and HTTPS, 5432 for PostgreSQL.

## Build a Practice Network

Linux **network namespaces** give a process its own interfaces, addresses, routes and firewall, which is how containers get their network. Two namespaces connected by a virtual cable (a **veth pair**) make a small two-host network:

```diagram
{
  "type": "infra",
  "groups": [
    {
      "label": "Your machine",
      "sub": "your interfaces and routes are not touched",
      "icon": "server",
      "tone": "slate",
      "groups": [
        {
          "label": "namespace client",
          "sub": "veth-client 192.0.2.1/24",
          "icon": "net",
          "tone": "blue",
          "nodes": [
            { "label": "your shell", "sub": "ping, curl, dig, tcpdump", "icon": "cpu", "tone": "blue" }
          ]
        },
        {
          "label": "namespace web",
          "sub": "veth-web 192.0.2.2/24",
          "icon": "net",
          "tone": "green",
          "nodes": [
            { "label": "web server", "sub": "python3 :80", "icon": "globe", "tone": "green" },
            { "label": "nftables", "sub": "firewall", "icon": "shield", "tone": "amber" }
          ]
        }
      ]
    }
  ]
}
```

Create the first namespace and open a root shell inside it. Everything you run in that shell sees only the namespace's network:

```bash
sudo ip netns add client
sudo mkdir -p /etc/netns/client
sudo cp /etc/hosts /etc/netns/client/hosts   # a private /etc/hosts for the lab
sudo ip netns exec client bash               # a root shell in the empty "client" network
```

The prompt changes to `#` because you are root. A namespace only separates the network: the files on disk, including `/etc`, are shared with your machine. `ip netns exec` makes one exception and mounts the files in `/etc/netns/client/` over their counterparts in `/etc`, which is why the lab gets its own copy of `/etc/hosts` for the DNS section below. A new namespace has only a loopback interface, and it starts switched off:

```terminal
{
  "title": "an empty network namespace",
  "prompt": "#",
  "autoplay": false,
  "steps": [
    {
      "cmd": "ip link",
      "output": "1: lo: <LOOPBACK> mtu 65536 qdisc noqueue state DOWN mode DEFAULT group default qlen 1000\n    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00"
    },
    {
      "cmd": "ping -c 1 127.0.0.1",
      "output": "ping: connect: Network is unreachable"
    },
    {
      "cmd": "ip link set lo up"
    },
    {
      "cmd": "ping -c 1 127.0.0.1",
      "output": "PING 127.0.0.1 (127.0.0.1) 56(84) bytes of data.\n64 bytes from 127.0.0.1: icmp_seq=1 ttl=64 time=0.070 ms\n\n--- 127.0.0.1 ping statistics ---\n1 packets transmitted, 1 received, 0% packet loss, time 0ms\nrtt min/avg/max/mdev = 0.070/0.070/0.070/0.000 ms"
    }
  ]
}
```

Now create the second namespace, connect the two with a veth pair, give each end an address and switch them on. `ip -n web` runs an `ip` command inside the `web` namespace:

```terminal
{
  "title": "connect two namespaces",
  "prompt": "#",
  "autoplay": false,
  "steps": [
    {
      "cmd": "ip netns add web"
    },
    {
      "comment": "a virtual cable: veth-client stays here, veth-web goes into web",
      "cmd": "ip link add veth-client type veth peer name veth-web netns web"
    },
    {
      "cmd": "ip addr add 192.0.2.1/24 dev veth-client"
    },
    {
      "cmd": "ip link set veth-client up"
    },
    {
      "cmd": "ip -n web addr add 192.0.2.2/24 dev veth-web"
    },
    {
      "cmd": "ip -n web link set veth-web up && ip -n web link set lo up"
    },
    {
      "cmd": "ip -br addr",
      "output": "lo               UNKNOWN        127.0.0.1/8 ::1/128\nveth-client@if2  UP             192.0.2.1/24 fe80::6c4d:d7ff:fe6f:453/64"
    }
  ]
}
```

## Inspect Interfaces, Addresses and Routes

`ip` has subcommands for each layer: `ip link` for interfaces, `ip addr` (or `ip a`) for addresses, `ip route` (`ip r`) for routes and `ip neigh` for the neighbours it found on the local network. `-br` gives the short form; leave it out for details.

```terminal
{
  "title": "ip addr, ip route, ip neigh",
  "prompt": "#",
  "autoplay": false,
  "steps": [
    {
      "cmd": "ip addr show veth-client",
      "output": "2: veth-client@if2: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default qlen 1000\n    link/ether 6e:4d:d7:6f:04:53 brd ff:ff:ff:ff:ff:ff link-netns web\n    inet 192.0.2.1/24 scope global veth-client\n       valid_lft forever preferred_lft forever\n    inet6 fe80::6c4d:d7ff:fe6f:453/64 scope link tentative\n       valid_lft forever preferred_lft forever"
    },
    {
      "cmd": "ip route",
      "output": "192.0.2.0/24 dev veth-client proto kernel scope link src 192.0.2.1"
    },
    {
      "cmd": "ping -c 3 192.0.2.2",
      "output": "PING 192.0.2.2 (192.0.2.2) 56(84) bytes of data.\n64 bytes from 192.0.2.2: icmp_seq=1 ttl=64 time=0.120 ms\n64 bytes from 192.0.2.2: icmp_seq=2 ttl=64 time=0.066 ms\n64 bytes from 192.0.2.2: icmp_seq=3 ttl=64 time=0.081 ms\n\n--- 192.0.2.2 ping statistics ---\n3 packets transmitted, 3 received, 0% packet loss, time 2040ms\nrtt min/avg/max/mdev = 0.066/0.089/0.120/0.022 ms"
    },
    {
      "comment": "the MAC address of 192.0.2.2, learned with ARP during the ping",
      "cmd": "ip neigh",
      "output": "192.0.2.2 dev veth-client lladdr 72:4c:1e:86:0a:15 REACHABLE"
    }
  ]
}
```

How to read `ip addr`: `state UP` and `LOWER_UP` mean the interface is on and has a link; `mtu 1500` is the largest packet; `link/ether` is the MAC address; `inet 192.0.2.1/24` is the IPv4 address with its prefix; `scope global` means it can be used to reach other machines; and `valid_lft forever` means it was set by hand, not leased from DHCP.

The route `192.0.2.0/24 dev veth-client proto kernel scope link` was added automatically with the address: the whole `/24` is directly reachable through `veth-client`. In `ping`, `time=` is the round-trip time, and the summary shows packet loss, which should be 0%.

### Routes to Other Networks

There is no route to anything outside `192.0.2.0/24` yet:

```terminal
{
  "title": "the routing table decides",
  "prompt": "#",
  "autoplay": false,
  "steps": [
    {
      "cmd": "ping -c 1 198.51.100.7",
      "output": "ping: connect: Network is unreachable"
    },
    {
      "cmd": "ip route get 198.51.100.7",
      "output": "RTNETLINK answers: Network is unreachable"
    },
    {
      "comment": "send everything else to 192.0.2.2, the default gateway",
      "cmd": "ip route add default via 192.0.2.2"
    },
    {
      "comment": "let web forward packets like a router (most machines have this off)",
      "cmd": "ip netns exec web sysctl -w net.ipv4.ip_forward=1",
      "output": "net.ipv4.ip_forward = 1"
    },
    {
      "cmd": "ip route",
      "output": "default via 192.0.2.2 dev veth-client\n192.0.2.0/24 dev veth-client proto kernel scope link src 192.0.2.1"
    },
    {
      "cmd": "ip route get 198.51.100.7",
      "output": "198.51.100.7 via 192.0.2.2 dev veth-client src 192.0.2.1 uid 0\n    cache"
    },
    {
      "comment": "web forwards packets now, but has no route onward, so it answers that it cannot",
      "cmd": "ping -c 2 -W 1 198.51.100.7",
      "output": "PING 198.51.100.7 (198.51.100.7) 56(84) bytes of data.\nFrom 192.0.2.2 icmp_seq=1 Destination Net Unreachable\nFrom 192.0.2.2 icmp_seq=2 Destination Net Unreachable\n\n--- 198.51.100.7 ping statistics ---\n2 packets transmitted, 0 received, +2 errors, 100% packet loss, time 1024ms"
    }
  ]
}
```

`ip route get` is the fastest way to answer "which interface and gateway would this machine use to reach that address?". Compare the two failures. The first `ping` never left the machine: there was no route, so the kernel refused at once (`connect: Network is unreachable`). The last one left through the gateway, and the gateway sent back `Destination Net Unreachable` because it has no route onward. A third kind of failure is silence: packets leave and nothing comes back, which usually means a firewall drops them or the reply cannot find its way back. On a real machine, `ip route` shows a default route such as `default via 192.168.1.1 dev enp1s0 proto dhcp`.

## Is the Service Listening? ss, curl and nc

Start a web server in the `web` namespace on port 80, then look at it from both sides. Use your own home directory instead of `/home/dev`:

```terminal
{
  "title": "a server, its socket, and a client",
  "prompt": "#",
  "autoplay": false,
  "steps": [
    {
      "cmd": "ip netns exec web python3 -m http.server 80 --bind 192.0.2.2 --directory /home/dev/lab/site > /tmp/web.log 2>&1 &"
    },
    {
      "comment": "on the server: which sockets listen, and which process owns them",
      "cmd": "ip netns exec web ss -tlnp",
      "output": "State  Recv-Q Send-Q Local Address:Port Peer Address:PortProcess\nLISTEN 0      5          192.0.2.2:80        0.0.0.0:*    users:((\"python3\",pid=37,fd=3))"
    },
    {
      "comment": "from the client: is the TCP port open?",
      "cmd": "nc -zv 192.0.2.2 80",
      "output": "Connection to 192.0.2.2 80 port [tcp/http] succeeded!"
    },
    {
      "cmd": "curl -sI http://192.0.2.2/",
      "output": "HTTP/1.0 200 OK\nServer: SimpleHTTP/0.6 Python/3.12.3\nDate: Fri, 23 Oct 2026 21:38:07 GMT\nContent-type: text/html\nContent-Length: 221\nLast-Modified: Fri, 23 Oct 2026 21:38:03 GMT"
    },
    {
      "comment": "-v shows the connection and the HTTP exchange",
      "cmd": "curl -sv -o /dev/null http://192.0.2.2/about.html",
      "output": "*   Trying 192.0.2.2:80...\n* Connected to 192.0.2.2 (192.0.2.2) port 80\n> GET /about.html HTTP/1.1\n> Host: 192.0.2.2\n> User-Agent: curl/8.5.0\n> Accept: */*\n>\n* HTTP 1.0, assume close after body\n< HTTP/1.0 200 OK\n< Server: SimpleHTTP/0.6 Python/3.12.3\n< Date: Fri, 23 Oct 2026 21:38:07 GMT\n< Content-type: text/html\n< Content-Length: 162\n< Last-Modified: Fri, 23 Oct 2026 21:38:03 GMT\n<\n{ [162 bytes data]\n* Closing connection"
    },
    {
      "comment": "the client's closed connections wait briefly in TIME-WAIT",
      "cmd": "ss -tan",
      "output": "State     Recv-Q Send-Q Local Address:Port  Peer Address:PortProcess\nTIME-WAIT 0      0          192.0.2.1:48704    192.0.2.2:80\nTIME-WAIT 0      0          192.0.2.1:48700    192.0.2.2:80"
    }
  ]
}
```

`ss` replaces the old `netstat`. The options you will type most often:

| Command                                       | Shows                                                                                                             |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `ss -tlnp`                                    | TCP sockets that **l**isten, with **n**umeric ports and the **p**rocess (needs `sudo` for other users' processes) |
| `ss -ulnp`                                    | the same for UDP                                                                                                  |
| `ss -tn`                                      | established TCP connections                                                                                       |
| `ss -tn state established '( dport = :443 )'` | connections to port 443 only                                                                                      |
| `ss -s`                                       | a summary with counts per state                                                                                   |

Look at the **Local Address** column. A service bound to `127.0.0.1` (or `::1`) only accepts connections from the same machine, which is the most common reason a service works locally and not from outside. `0.0.0.0` (or `*` and `[::]`) means all addresses.

## DNS: Names to Addresses

The resolver reads `/etc/hosts` first, then asks a DNS server. `getent hosts` resolves a name exactly the way programs do, so use it to test what an application will see:

```terminal
{
  "title": "/etc/hosts and getent",
  "prompt": "#",
  "autoplay": false,
  "steps": [
    {
      "comment": "in the lab this is the private copy from /etc/netns/client/hosts",
      "cmd": "echo '192.0.2.2  web.lab' >> /etc/hosts"
    },
    {
      "cmd": "getent hosts web.lab",
      "output": "192.0.2.2       web.lab"
    },
    {
      "cmd": "curl -sI http://web.lab/ | head -n 1",
      "output": "HTTP/1.0 200 OK"
    }
  ]
}
```

To query DNS servers directly, use `dig` (from `bind9-dnsutils` on Ubuntu and Debian, `bind-utils` on Fedora and RHEL). It asks the server you name and shows exactly what came back, which `ping` and `curl` do not. The lab has no connection to the internet, so run these in a second terminal on your machine, outside the namespace:

```terminal
{
  "title": "dig against a public resolver",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "dig @1.1.1.1 example.com A +noall +answer",
      "output": "example.com.\t\t85\tIN\tA\t172.66.147.243\nexample.com.\t\t85\tIN\tA\t104.20.23.154"
    },
    {
      "comment": "+short prints only the answers",
      "cmd": "dig @1.1.1.1 +short example.com AAAA",
      "output": "2606:4700:10::ac42:93f3\n2606:4700:10::6814:179a"
    },
    {
      "comment": "MX records list the mail servers; a single '0 .' means the domain accepts no mail",
      "cmd": "dig @1.1.1.1 +short example.com MX",
      "output": "0 ."
    }
  ]
}
```

The second column in the answer is the **TTL**: how many more seconds resolvers may cache the record. Without `@server`, `dig` asks the servers in `/etc/resolv.conf`.

On Ubuntu, and on Fedora since version 33, **systemd-resolved** manages DNS. `/etc/resolv.conf` points to its local stub resolver, so the file looks like this (example):

```text
nameserver 127.0.0.53
options edns0 trust-ad
search .
```

Do not edit that file: it is generated. Use `resolvectl status` to see the real upstream servers per interface, `resolvectl query example.com` to resolve through the stub, and `sudo resolvectl flush-caches` to clear the cache. Set servers in the network configuration (netplan, NetworkManager or systemd-networkd). On Debian, which does not use systemd-resolved by default, `/etc/resolv.conf` usually lists the servers directly.

## See the Packets: tcpdump

When the tools above disagree, look at the packets. `tcpdump` prints every packet that matches a filter (`icmp`, `port 80`, `host 192.0.2.2`):

```terminal
{
  "title": "capture four packets",
  "prompt": "#",
  "autoplay": false,
  "steps": [
    {
      "comment": "capture in the background, give it a second to start, send two pings, wait for tcpdump ($!)",
      "cmd": "tcpdump -ni veth-client -c 4 icmp & sleep 1; ping -c 2 192.0.2.2 > /dev/null; wait $!",
      "output": "tcpdump: verbose output suppressed, use -v[v]... for full protocol decode\nlistening on veth-client, link-type EN10MB (Ethernet), snapshot length 262144 bytes\n21:38:08.685797 IP 192.0.2.1 > 192.0.2.2: ICMP echo request, id 61, seq 1, length 64\n21:38:08.685842 IP 192.0.2.2 > 192.0.2.1: ICMP echo reply, id 61, seq 1, length 64\n21:38:09.687685 IP 192.0.2.1 > 192.0.2.2: ICMP echo request, id 61, seq 2, length 64\n21:38:09.687733 IP 192.0.2.2 > 192.0.2.1: ICMP echo reply, id 61, seq 2, length 64\n4 packets captured\n4 packets received by filter\n0 packets dropped by kernel"
    }
  ]
}
```

Each line shows the time, source and destination, and what the packet is: here an ICMP echo request and the echo reply, twice. `-n` skips name lookups, `-c 4` stops after four packets, and `-w file.pcap` saves the capture for Wireshark. On a real interface, add a filter such as `port 443` and `not port 22`, so your own SSH session does not flood the output.

## Firewalls: nftables, ufw and firewalld

The Linux kernel filters packets with **netfilter**. Current distributions program it through **nftables** (`nft`); the old `iptables` command still exists, but on Ubuntu 24.04, Debian 13, Fedora and RHEL it is a compatibility layer (`iptables-nft`) that writes nftables rules. Most people use a front end: **ufw** on Ubuntu and **firewalld** on Fedora and RHEL.

:::warning
On a remote server, allow SSH **before** you enable a firewall with a default-deny policy, and keep your current session open until you have tested a new login. Otherwise you lock yourself out and need the cloud provider's console to get back in.
:::

### nftables

A ruleset for the web server: drop everything that is not explicitly allowed, accept replies to connections the server started, and allow ping, SSH and HTTP. Save it as `/tmp/web.nft`:

```text
#!/usr/sbin/nft -f
flush ruleset

table inet filter {
  chain input {
    type filter hook input priority filter; policy drop;

    ct state established,related accept
    ct state invalid drop
    iif "lo" accept
    meta l4proto { icmp, ipv6-icmp } accept
    tcp dport 22 accept
    tcp dport 80 ip saddr 198.51.100.0/24 counter accept
    counter comment "dropped by policy"
  }
}
```

The rule for port 80 only accepts clients from `198.51.100.0/24`, and our client is `192.0.2.1`. Load the rules into the `web` namespace and test:

:::warning
Always load this file with `ip netns exec web`. Its first line, `flush ruleset`, deletes **every** firewall rule in the network namespace it runs in; run outside the lab, that would be your machine's own firewall.
:::

```terminal
{
  "title": "load and test an nftables ruleset",
  "prompt": "#",
  "autoplay": false,
  "steps": [
    {
      "cmd": "ip netns exec web nft -c -f /tmp/web.nft && echo \"syntax OK\"",
      "output": "syntax OK"
    },
    {
      "cmd": "ip netns exec web nft -f /tmp/web.nft"
    },
    {
      "cmd": "ping -c 1 192.0.2.2 | tail -n 2",
      "output": "1 packets transmitted, 1 received, 0% packet loss, time 0ms\nrtt min/avg/max/mdev = 0.129/0.129/0.129/0.000 ms"
    },
    {
      "cmd": "curl -m 3 -sS -o /dev/null http://192.0.2.2/",
      "output": "curl: (28) Connection timed out after 3006 milliseconds"
    },
    {
      "comment": "allow our subnet, then try again",
      "cmd": "ip netns exec web nft add rule inet filter input tcp dport 80 ip saddr 192.0.2.0/24 counter accept"
    },
    {
      "comment": "new rules go to the end of the chain, so the catch-all counter comes first",
      "cmd": "ip netns exec web nft list chain inet filter input",
      "output": "table inet filter {\n\tchain input {\n\t\ttype filter hook input priority filter; policy drop;\n\t\tct state established,related accept\n\t\tct state invalid drop\n\t\tiif \"lo\" accept\n\t\tmeta l4proto { icmp, ipv6-icmp } accept\n\t\ttcp dport 22 accept\n\t\ttcp dport 80 ip saddr 198.51.100.0/24 counter packets 0 bytes 0 accept\n\t\tcounter packets 3 bytes 180 comment \"dropped by policy\"\n\t\ttcp dport 80 ip saddr 192.0.2.0/24 counter packets 0 bytes 0 accept\n\t}\n}"
    }
  ]
}
```

Order matters: `nft add rule` appends to the end of the chain, after the catch-all `counter` rule, and since that rule only counts and does not decide, the packet still reaches the new `accept` below it. Use `nft insert rule` to put a rule at the top instead.

On a real server, outside any lab, the rules live in `/etc/nftables.conf` on Debian and Ubuntu (RHEL 10 reads `/etc/sysconfig/nftables.conf`, which usually includes files from `/etc/nftables/`). Check the file with `sudo nft -c -f /etc/nftables.conf`, then start the service and enable it at boot with `sudo systemctl enable --now nftables`; after later changes, `sudo systemctl reload nftables` loads the file again. Do not copy the lab ruleset there as it is: write one for the services that server runs, and keep a second session open while you load it.

```terminal
{
  "title": "the new rule lets HTTP through",
  "prompt": "#",
  "steps": [
    {
      "cmd": "curl -sI http://192.0.2.2/ | head -n 1",
      "output": "HTTP/1.0 200 OK"
    }
  ]
}
```

### ufw on Ubuntu

**ufw** ("uncomplicated firewall") generates the rules for you. It stores its settings in `/etc/ufw` and turns itself on at every boot once enabled, so do not try it inside the lab namespace, which shares `/etc` with your machine. Use it on the server you want to protect. A typical setup for a web server, on a fresh Ubuntu 24.04 system:

```terminal
{
  "title": "ufw: deny incoming, allow SSH, HTTP and HTTPS",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "sudo ufw status",
      "output": "Status: inactive"
    },
    {
      "cmd": "sudo ufw default deny incoming",
      "output": "Default incoming policy changed to 'deny'\n(be sure to update your rules accordingly)"
    },
    {
      "cmd": "sudo ufw default allow outgoing",
      "output": "Default outgoing policy changed to 'allow'\n(be sure to update your rules accordingly)"
    },
    {
      "comment": "allow SSH first",
      "cmd": "sudo ufw allow 22/tcp",
      "output": "Rules updated\nRules updated (v6)"
    },
    {
      "cmd": "sudo ufw allow 80,443/tcp",
      "output": "Rules updated\nRules updated (v6)"
    },
    {
      "comment": "without --force, ufw asks to confirm because the change can cut off SSH",
      "cmd": "sudo ufw --force enable",
      "output": "Firewall is active and enabled on system startup"
    },
    {
      "cmd": "sudo ufw status verbose",
      "output": "Status: active\nLogging: on (low)\nDefault: deny (incoming), allow (outgoing), deny (routed)\nNew profiles: skip\n\nTo                         Action      From\n--                         ------      ----\n22/tcp                     ALLOW IN    Anywhere\n80,443/tcp                 ALLOW IN    Anywhere\n22/tcp (v6)                ALLOW IN    Anywhere (v6)\n80,443/tcp (v6)            ALLOW IN    Anywhere (v6)"
    },
    {
      "cmd": "sudo ufw status numbered",
      "output": "Status: active\n\n     To                         Action      From\n     --                         ------      ----\n[ 1] 22/tcp                     ALLOW IN    Anywhere\n[ 2] 80,443/tcp                 ALLOW IN    Anywhere\n[ 3] 22/tcp (v6)                ALLOW IN    Anywhere (v6)\n[ 4] 80,443/tcp (v6)            ALLOW IN    Anywhere (v6)"
    }
  ]
}
```

Other useful forms: `sudo ufw allow from 203.0.113.0/24 to any port 22 proto tcp` (SSH only from your office network), `sudo ufw limit 22/tcp` (rate-limit new SSH connections), `sudo ufw delete allow 80,443/tcp` (remove a rule by repeating it, for IPv4 and IPv6 at once), and `sudo ufw app list` for profiles that packages such as OpenSSH and Nginx install. `sudo ufw delete 3` removes rule 3 from the numbered list; check the number first, because in the list above rule 3 is SSH over IPv6.

:::note
Docker publishes container ports with its own rules, which bypass ufw. A port you published with `docker run -p 8080:80` is reachable from outside even if ufw denies it. Publish on `127.0.0.1:8080:80` when only a local reverse proxy should reach it.
:::

### firewalld on Fedora and RHEL

```bash
sudo firewall-cmd --state
sudo firewall-cmd --get-active-zones                                # which zone each interface is in
sudo firewall-cmd --zone=public --list-all                          # services and ports of that zone
sudo firewall-cmd --permanent --zone=public --add-service=http      # --permanent writes the config
sudo firewall-cmd --permanent --zone=public --add-port=8080/tcp
sudo firewall-cmd --reload                                          # apply the permanent config
```

firewalld groups interfaces into **zones**, each with its own rules. Without `--zone`, commands use the default zone, which is not always the zone your interface is in, so check `--get-active-zones` and name the zone. Without `--permanent`, a change is active immediately but lost at the next reload or reboot, which is a handy way to test.

Cloud servers have a second firewall outside the machine: AWS security groups, DigitalOcean Cloud Firewalls, Azure network security groups. A packet must pass both, so check both when something does not connect.

## Make Network Settings Permanent

Everything you set with `ip` is lost at reboot. Each distribution family stores its configuration differently. A static address of `192.0.2.10/24` with gateway `192.0.2.1` looks like this:

:::warning
Changing the address of the interface you are connected through ends your SSH session. Use the real addresses of your network, not these examples, and keep a way back in: the VM console, your cloud provider's web console, or `netplan try`, which rolls the change back unless you confirm it.
:::

```tabs
{
  "title": "Static IP configuration",
  "tabs": [
    {
      "label": "Ubuntu (netplan)",
      "lang": "yaml",
      "code": "# /etc/netplan/50-static.yaml   (chmod 600; netplan warns if others can read it)\nnetwork:\n  version: 2\n  ethernets:\n    enp1s0:\n      dhcp4: false\n      addresses:\n        - 192.0.2.10/24\n      routes:\n        - to: default\n          via: 192.0.2.1\n      nameservers:\n        addresses: [192.0.2.53, 1.1.1.1]\n\n# apply with automatic rollback if you lose the connection:\n#   sudo netplan try\n# or apply directly:\n#   sudo netplan apply"
    },
    {
      "label": "Fedora / RHEL (nmcli)",
      "lang": "bash",
      "code": "nmcli connection show            # find the connection name\nsudo nmcli connection modify enp1s0 \\\n  ipv4.method manual \\\n  ipv4.addresses 192.0.2.10/24 \\\n  ipv4.gateway 192.0.2.1 \\\n  ipv4.dns \"192.0.2.53 1.1.1.1\"\nsudo nmcli connection up enp1s0\n\n# stored as a keyfile in /etc/NetworkManager/system-connections/\n# RHEL 10 no longer reads the old ifcfg files"
    },
    {
      "label": "Debian (ifupdown)",
      "lang": "text",
      "code": "# /etc/network/interfaces\nauto enp1s0\niface enp1s0 inet static\n    address 192.0.2.10/24\n    gateway 192.0.2.1\n\n# DNS servers go in /etc/resolv.conf (or dns-nameservers with the resolvconf package)\n# apply with: sudo ifdown enp1s0 && sudo ifup enp1s0"
    },
    {
      "label": "systemd-networkd",
      "lang": "ini",
      "code": "# /etc/systemd/network/10-enp1s0.network\n[Match]\nName=enp1s0\n\n[Network]\nAddress=192.0.2.10/24\nGateway=192.0.2.1\nDNS=192.0.2.53\n\n# apply with: sudo networkctl reload"
    }
  ]
}
```

Older netplan examples use `gateway4: 192.0.2.1`. That key is deprecated; use the `routes` list with `to: default`. Desktops and laptops usually leave all of this to NetworkManager: `nmcli device wifi list` and `nmcli device wifi connect "MyNetwork" --ask` connect to Wi-Fi from the terminal.

## SSH: Working on Remote Machines

You connect to almost every Linux server with SSH. Beyond `ssh user@host`, a few features save a lot of time. Put per-host settings in `~/.ssh/config`:

```text
Host web
    HostName 203.0.113.10
    User alice
    Port 22
    IdentityFile ~/.ssh/id_ed25519

Host db
    HostName 10.0.1.20
    User alice
    ProxyJump web
```

Now `ssh web` is enough, and `ssh db` hops through `web` to reach a database server on a private network. `ssh -G` prints the settings it would use, without connecting, which is how you debug a config file:

```terminal
{
  "title": "check what ssh would do",
  "prompt": "$",
  "steps": [
    {
      "cmd": "ssh -G db | grep -E '^(hostname|user|port|proxyjump) '",
      "output": "user alice\nhostname 10.0.1.20\nport 22\nproxyjump web"
    }
  ]
}
```

| Task                                       | Command                                                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Copy files                                 | `scp file web:/tmp/` (uses the SFTP protocol since OpenSSH 9.0), or `rsync -av dir/ web:/srv/dir/` for directories |
| Reach a remote service locally             | `ssh -L 5433:localhost:5432 db` then connect to `localhost:5433`                                                   |
| Share a local service with the remote side | `ssh -R 8080:localhost:3000 web`                                                                                   |
| SOCKS proxy through the server             | `ssh -D 1080 web`                                                                                                  |
| Jump through a bastion host                | `ssh -J web alice@10.0.1.20`                                                                                       |

## A Troubleshooting Checklist

When "it does not connect", go up the stack one layer at a time. Each step has a command that answers it:

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Link", "sub": "ip -br link", "icon": "net", "tone": "slate" },
    { "label": "Address", "sub": "ip -br addr", "icon": "cpu", "tone": "blue" },
    { "label": "Route", "sub": "ip route get", "icon": "branch", "tone": "violet" },
    { "label": "DNS", "sub": "getent / dig", "icon": "globe", "tone": "amber" },
    { "label": "Port", "sub": "ss -tlnp / nc -zv", "icon": "box", "tone": "green" },
    { "label": "Firewall", "sub": "nft / ufw / cloud", "icon": "shield", "tone": "red" }
  ]
}
```

1. **Link**: is the interface `UP` with `LOWER_UP`? A missing `LOWER_UP` means no cable, no Wi-Fi association, or a VM network that is not attached.
2. **Address**: does it have the expected address and prefix? `169.254.x.x` means DHCP failed.
3. **Route**: does `ip route get <target>` pick the right interface and gateway? Can you `ping` the gateway?
4. **DNS**: does `getent hosts name` return the right address? Compare with `dig @1.1.1.1 name` to tell a DNS problem from a network problem.
5. **Port**: does `ss -tlnp` on the server show the service listening on the right address? Does `nc -zv host port` from the client succeed? "Connection refused" means you reached the machine but nothing listens; a timeout means something dropped the packets.
6. **Firewall**: check the host firewall (`sudo nft list ruleset`, `sudo ufw status`) and the cloud firewall.

For the path in between, `tracepath host` (no root needed) or `mtr host` show each router on the way and where the packets stop. Many routers do not answer these probes, so a few `* * *` lines in the middle are normal.

## Old Commands and Their Replacements

The `net-tools` package (`ifconfig`, `netstat`, `route`, `arp`) is a legacy interface that current distributions no longer install by default, and it does not show everything the kernel can do (several addresses on one interface, policy routing, namespaces). Use the `iproute2` equivalents:

| Old                  | New                                                          |
| -------------------- | ------------------------------------------------------------ |
| `ifconfig`           | `ip addr`, `ip -br addr`                                     |
| `ifconfig eth0 up`   | `ip link set eth0 up`                                        |
| `route -n`           | `ip route`                                                   |
| `arp -n`             | `ip neigh`                                                   |
| `netstat -tulpn`     | `ss -tulpn`                                                  |
| `netstat -i`         | `ip -s link`                                                 |
| `brctl`              | `ip link add br0 type bridge`, `bridge link`                 |
| `iwconfig`, `iwlist` | `iw`, `nmcli device wifi`                                    |
| `iptables` rules     | `nft` rules (or `iptables-nft`, which writes nftables rules) |

## Clean Up the Lab

```terminal
{
  "title": "remove the practice network",
  "prompt": "#",
  "autoplay": false,
  "steps": [
    {
      "comment": "stop the processes that still run inside web, such as the web server",
      "cmd": "ip netns pids web | xargs -r kill"
    },
    {
      "cmd": "ip netns del web"
    },
    {
      "comment": "the veth pair went away with the namespace",
      "cmd": "ip -br link",
      "output": "lo               UNKNOWN        00:00:00:00:00:00 <LOOPBACK,UP,LOWER_UP>"
    }
  ]
}
```

A namespace stays alive as long as a process runs in it, so stop the web server first. Once `web` is gone, its end of the veth pair goes with it, and that removes the other end too. Leave the client shell with `exit`, then run `sudo ip netns del client` and `sudo rm -r /etc/netns/client`.

## Common Mistakes

- **Enabling a default-deny firewall before allowing SSH** on a remote server.
- **A service listening on `127.0.0.1`** when it should accept outside connections, or the reverse for databases that should stay private.
- **Editing `/etc/resolv.conf`** on systems where systemd-resolved or NetworkManager generates it. Your change disappears.
- **Applying a netplan change over SSH without `netplan try`**, which rolls back automatically if you cannot confirm.
- **Forgetting the cloud firewall** or security group in front of the server.
- **Trusting `ping` alone.** Many networks block ICMP; test the real port with `nc -zv` or `curl`.

## Summary

- `ip link`, `ip addr`, `ip route` and `ip neigh` show and change interfaces, addresses, routes and neighbours; `ip route get` explains one routing decision.
- `ss -tlnp` shows listening services and their processes; check the bind address.
- `getent hosts` resolves like an application does; `dig @server` queries DNS directly; on Ubuntu, systemd-resolved owns `/etc/resolv.conf`.
- `tcpdump` shows the packets when other tools disagree.
- nftables is the kernel firewall; ufw and firewalld are front ends. Allow SSH first.
- Make settings permanent with netplan, NetworkManager, ifupdown or systemd-networkd, depending on the distribution.

Next: [Shell Scripting Basics](/guides/introduction-to-linux/09-shell-scripting), where you turn the commands from this guide into scripts.

## Keep Learning

- [Networking Fundamentals guide](/guides/networking-fundamentals)
- [Command line for looking at a specific port](/posts/command-line-for-looking-at-specific-port)
- [Increase the maximum number of TCP/IP connections](/posts/increasing-the-maximum-number-of-tcp-ip-connections-in-linux)
- Interview questions: [DNS basics](/interview-questions/junior/networking-basics-dns)
- Simulators: [DNS resolution](/games/dns-simulator), [TCP vs UDP](/games/tcp-vs-udp), [a packet's journey](/games/packet-journey)
