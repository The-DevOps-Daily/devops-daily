---
title: 'IP Addressing and Subnetting: CIDR, Private Ranges, NAT and IPv6'
description: 'Read CIDR prefixes, split a network into subnets, avoid overlaps with Docker, Kubernetes and VPNs, watch NAT translate a connection, and use IPv6 in a lab.'
order: 2
---

Addresses look like the simplest part of networking, and they cause some of its longest outages: a VPC that cannot be peered because its range overlaps another one, a Docker network that swallows the office VPN, a subnet that runs out of addresses the day the cluster scales. All of them are planning mistakes, and all of them are easy to avoid once you can read a prefix like `/20` at a glance.

In this part you take an address apart bit by bit, see how a machine decides whether a destination is local, plan a cloud network with a short Python script that also catches overlaps, watch NAT rewrite a real connection, and give two lab hosts IPv6 addresses.

## Prerequisites

- A fresh lab from [Part 1](/guides/networking-fundamentals/01-network-fundamentals-and-protocols#h2-build-the-practice-lab): run `sudo ./netlab.sh down && sudo ./netlab.sh up` before you start, because every part changes the lab.
- `ipcalc` and `python3`, both in the Part 1 package list.

## An IPv4 Address Is 32 Bits

An IPv4 address such as `10.0.2.11` is a 32-bit number written as four bytes in decimal. The **prefix length** after the slash, `/24`, says how many of those bits, counted from the left, name the network. The rest name a host on that network. `ipcalc` shows the bits:

```terminal
{
  "title": "one address, bit by bit",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "web1#",
      "cmd": "ip -4 -br addr show dev eth0",
      "output": "eth0@if9         UP             10.0.2.11/24"
    },
    {
      "prompt": "web1#",
      "cmd": "ipcalc 10.0.2.11/24",
      "output": "Address:   10.0.2.11            00001010.00000000.00000010. 00001011\nNetmask:   255.255.255.0 = 24   11111111.11111111.11111111. 00000000\nWildcard:  0.0.0.255            00000000.00000000.00000000. 11111111\n=>\nNetwork:   10.0.2.0/24          00001010.00000000.00000010. 00000000\nHostMin:   10.0.2.1             00001010.00000000.00000010. 00000001\nHostMax:   10.0.2.254           00001010.00000000.00000010. 11111110\nBroadcast: 10.0.2.255           00001010.00000000.00000010. 11111111\nHosts/Net: 254                   Class A, Private Internet"
    }
  ]
}
```

- **Netmask** `255.255.255.0` is the same prefix written as 32 bits: 24 ones, then zeros. Old tools and some firewalls still ask for it in this form.
- **Network** `10.0.2.0` is the address with all host bits set to 0. It names the subnet and is not given to a host.
- **Broadcast** `10.0.2.255` has all host bits set to 1 and means "every host on this subnet".
- **HostMin** to **HostMax** are the 254 addresses left for machines.
- Ignore "Class A". Classful addressing (A, B, C) was replaced by **CIDR** (Classless Inter-Domain Routing) in 1993. A `/24` inside `10.0.0.0/8` is not a "class C network"; it is just a /24.

Each bit you take from the host part halves the subnet:

| Prefix | Netmask         | Addresses | Usable hosts | Typical use                            |
| ------ | --------------- | --------- | ------------ | -------------------------------------- |
| /16    | 255.255.0.0     | 65,536    | 65,534       | A whole VPC or site                    |
| /19    | 255.255.224.0   | 8,192     | 8,190        | A private subnet for a Kubernetes zone |
| /20    | 255.255.240.0   | 4,096     | 4,094        | A large private subnet                 |
| /24    | 255.255.255.0   | 256       | 254          | A small subnet, one LAN                |
| /26    | 255.255.255.192 | 64        | 62           | A tight subnet                         |
| /28    | 255.255.255.240 | 16        | 14           | Smallest subnet AWS allows             |
| /31    | 255.255.255.254 | 2         | 2            | Point-to-point links (RFC 3021)        |
| /32    | 255.255.255.255 | 1         | 1            | One host, in routes and firewall rules |

The number of addresses is 2 to the power of (32 minus the prefix). Cloud providers keep a few addresses in every subnet for themselves: AWS and Azure reserve 5 (the network address, the next three and the last), Google Cloud reserves 4. A /28 on AWS leaves you 11 hosts, not 14.

## Local or Remote: How a Host Decides

A host sends a packet **directly** to destinations inside its own subnet and hands everything else to its **default gateway** (a router). It decides by comparing prefixes, and `ip route get` shows the decision:

```terminal
{
  "title": "same subnet or not",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "web1#",
      "cmd": "ip route",
      "output": "default via 10.0.2.1 dev eth0\n10.0.2.0/24 dev eth0 proto kernel scope link src 10.0.2.11"
    },
    {
      "comment": "web2 is in 10.0.2.0/24: delivered directly on eth0",
      "prompt": "web1#",
      "cmd": "ip route get 10.0.2.12",
      "output": "10.0.2.12 dev eth0 src 10.0.2.11 uid 0\n    cache"
    },
    {
      "comment": "db is in 10.0.3.0/24: sent to the gateway 10.0.2.1",
      "prompt": "web1#",
      "cmd": "ip route get 10.0.3.10",
      "output": "10.0.3.10 via 10.0.2.1 dev eth0 src 10.0.2.11 uid 0\n    cache"
    },
    {
      "prompt": "web1#",
      "cmd": "ping -c 1 10.0.2.12 > /dev/null && ping -c 1 10.0.3.10 > /dev/null"
    },
    {
      "prompt": "web1#",
      "cmd": "ip neigh",
      "output": "10.0.2.12 dev eth0 lladdr 82:13:d3:92:98:f6 REACHABLE\n10.0.2.1 dev eth0 lladdr ae:82:ed:d1:73:e1 DELAY"
    }
  ]
}
```

To deliver a packet on the local network, the host needs the destination's MAC address, and it finds it with **ARP** ("who has 10.0.2.12?"). `ip neigh` shows the results. Notice what is missing: `web1` never learned the MAC address of `db`. For a remote destination it only needs the gateway's MAC address; the router does the next step.

When several routes match, the **longest prefix wins**: a route for `10.0.3.0/24` beats `default` (which is `0.0.0.0/0`, a prefix of length 0 that matches everything).

## Special Address Ranges

Some ranges have fixed meanings. You will meet all of these in real networks:

| Range                                               | Name                            | What it is for                                                                 |
| --------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------ |
| `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`     | Private (RFC 1918)              | Internal networks. Not routed on the internet; reach the internet through NAT. |
| `100.64.0.0/10`                                     | Shared address space (RFC 6598) | Carrier-grade NAT at ISPs; also used by Tailscale and some cloud services.     |
| `127.0.0.0/8`                                       | Loopback                        | The machine itself (`127.0.0.1`).                                              |
| `169.254.0.0/16`                                    | Link-local                      | Addresses without DHCP; cloud metadata services live at `169.254.169.254`.     |
| `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24` | Documentation (RFC 5737)        | Examples and labs. The lab's "internet" uses `203.0.113.0/24`.                 |
| `224.0.0.0/4`                                       | Multicast                       | One sender, many receivers.                                                    |
| `0.0.0.0/0`                                         | Default route                   | "Everything". As a listen address, `0.0.0.0` means "all addresses".            |

`172.16.0.0/12` runs from `172.16.0.0` to `172.31.255.255`, not to `172.16.255.255`. Docker takes its networks from this range by default, which matters in the next section.

## Plan a Network Without Overlaps

Two networks that use overlapping ranges cannot be connected cleanly: a VPC peering request is refused, a VPN route sends traffic to the wrong place, a laptop on the office Wi-Fi cannot reach a server because Docker took the same range. Plan the ranges up front and check them against everything the network must ever talk to.

The lab uses a simple plan: `10.0.0.0/16` for the private side, one `/24` per tier (edge, app, data). A production VPC needs more care: room for several availability zones, large subnets where containers get their own addresses, and spare space for later. Python's standard `ipaddress` module does the arithmetic. Save this as `subnet-plan.py`:

```python
#!/usr/bin/env python3
"""Plan subnets inside a VPC range and check the plan against other networks."""
import ipaddress
import sys

VPC = ipaddress.ip_network('10.20.0.0/16')
ZONES = ['a', 'b', 'c']
# tier name and prefix per zone; allocate the largest subnets first so they stay aligned
TIERS = [('app', 19), ('data', 22), ('public', 24)]
RESERVED = 5  # AWS keeps 5 addresses in every subnet

OTHERS = {
    'Docker default bridge': '172.17.0.0/16',
    'Docker Swarm overlay pool': '10.0.0.0/8',
    'Kubernetes pods (kind, flannel)': '10.244.0.0/16',
    'Kubernetes services (kubeadm)': '10.96.0.0/12',
    'office VPN': '192.168.1.0/24',
    'partner VPC': '10.20.128.0/18',
}


def allocate(prefix, used):
    for candidate in VPC.subnets(new_prefix=prefix):
        if not any(candidate.overlaps(u) for u in used):
            return candidate
    sys.exit(f'no free /{prefix} left in {VPC}')


plan, used = {}, []
for tier, prefix in TIERS:
    for zone in ZONES:
        net = allocate(prefix, used)
        used.append(net)
        plan[f'{tier}-{zone}'] = net

print(f'VPC {VPC} ({VPC.num_addresses:,} addresses)')
for name, net in plan.items():
    print(f'  {name:<9} {str(net):<16} {net.num_addresses - RESERVED:>6,} usable')
free = VPC.num_addresses - sum(n.num_addresses for n in used)
print(f'  unallocated: {free:,} addresses for later')

print('Overlap check:')
clashes = 0
for name, cidr in OTHERS.items():
    other = ipaddress.ip_network(cidr)
    if other.overlaps(VPC):
        hit = [k for k, n in plan.items() if n.overlaps(other)]
        clashes += 1
        print(f'  CLASH  {cidr:<16} {name}: overlaps the VPC ({len(hit)} of {len(plan)} subnets)')
    else:
        print(f'  ok     {cidr:<16} {name}')
sys.exit(1 if clashes else 0)
```

```terminal
{
  "title": "a three-zone VPC plan, checked for overlaps",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "$",
      "cmd": "python3 subnet-plan.py",
      "output": "VPC 10.20.0.0/16 (65,536 addresses)\n  app-a     10.20.0.0/19      8,187 usable\n  app-b     10.20.32.0/19     8,187 usable\n  app-c     10.20.64.0/19     8,187 usable\n  data-a    10.20.96.0/22     1,019 usable\n  data-b    10.20.100.0/22    1,019 usable\n  data-c    10.20.104.0/22    1,019 usable\n  public-a  10.20.108.0/24      251 usable\n  public-b  10.20.109.0/24      251 usable\n  public-c  10.20.110.0/24      251 usable\n  unallocated: 37,120 addresses for later\nOverlap check:\n  ok     172.17.0.0/16    Docker default bridge\n  CLASH  10.0.0.0/8       Docker Swarm overlay pool: overlaps the VPC (9 of 9 subnets)\n  ok     10.244.0.0/16    Kubernetes pods (kind, flannel)\n  ok     10.96.0.0/12     Kubernetes services (kubeadm)\n  ok     192.168.1.0/24   office VPN\n  CLASH  10.20.128.0/18   partner VPC: overlaps the VPC (0 of 9 subnets)"
    }
  ]
}
```

The plan gives each zone a large app subnet (Kubernetes clusters on AWS give every pod a VPC address, so app subnets fill up fast), a smaller data subnet and a small public subnet for load balancers and NAT gateways, and keeps more than a third of the range free.

The overlap check found two real problems, and the script exits with status 1 so that a CI job would fail:

- The **partner VPC** `10.20.128.0/18` overlaps the VPC range, although none of the planned subnets uses those addresses yet. That is still a clash: AWS refuses to peer two VPCs whose ranges overlap at all. Agree on ranges with every network you might connect to, and keep a central list (a spreadsheet works; IPAM tools such as AWS VPC IPAM or NetBox do it properly).
- The **Docker Swarm overlay pool** `10.0.0.0/8` contains the whole VPC. Docker's local networks come from `172.17.0.0/16` to `172.31.0.0/16` and then from `192.168.0.0/16` in /20 blocks; move them with `default-address-pools` in `/etc/docker/daemon.json` (Part 6). Swarm overlays come from `10.0.0.0/8` in /24 blocks, and that pool is set separately, when you create the swarm: `docker swarm init --default-addr-pool 10.250.0.0/16 --default-addr-pool-mask-length 24`.

## NAT: Private Addresses on the Internet

Private addresses are not routed on the internet. A host with a private address reaches the internet through **NAT** (Network Address Translation): a router replaces the private source address with its own public one, remembers the mapping, and reverses it for the replies. The lab's router does exactly this, with two rules:

```terminal
{
  "title": "the router's NAT rules",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "router#",
      "cmd": "nft list table ip nat",
      "output": "table ip nat {\n\tchain prerouting {\n\t\ttype nat hook prerouting priority dstnat; policy accept;\n\t\tip daddr 203.0.113.80 tcp dport { 80, 443 } dnat to 10.0.1.10\n\t\tip daddr 203.0.113.53 meta l4proto { tcp, udp } th dport 53 dnat to 10.0.3.53\n\t}\n\n\tchain postrouting {\n\t\ttype nat hook postrouting priority srcnat; policy accept;\n\t\tip saddr 10.0.0.0/16 oifname \"br-wan\" masquerade\n\t}\n}"
    }
  ]
}
```

- **Source NAT** (`masquerade`): connections from `10.0.0.0/16` that leave through `br-wan` get the router's address `203.0.113.1` as their source. This is what your home router does, and what a cloud **NAT gateway** does for private subnets.
- **Destination NAT** (`dnat`): connections to the public address `203.0.113.80` on ports 80 and 443 are sent to `lb` at `10.0.1.10`. This is **port forwarding**; a public IP attached to a cloud VM works the same way (a layer 7 load balancer reaches the same goal differently: it is a proxy that opens its own connection to the server, Part 5). A second rule publishes the DNS server `ns1` on `203.0.113.53`.

Watch source NAT happen. `web1` fetches a page from `remote`, the "internet" server, and `remote` logs who connected:

```terminal
{
  "title": "source NAT, seen from both ends",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "web1#",
      "cmd": "curl -s http://203.0.113.20/",
      "output": "served by remote (203.0.113.20)"
    },
    {
      "prompt": "remote#",
      "cmd": "tail -n 1 /run/netlab/log/remote-app.log",
      "output": "203.0.113.1 xff=- \"GET / HTTP/1.1\" 200 -"
    },
    {
      "prompt": "client#",
      "cmd": "curl -s -o /dev/null -w '%{http_code}\\n' http://www.shop.example/",
      "output": "200"
    },
    {
      "comment": "the connection tracking table holds every translation",
      "prompt": "router#",
      "cmd": "conntrack -L -p tcp 2>/dev/null | grep -E 'src=(10.0.2.11|203.0.113.10) ' | grep -E 'dport=80 '",
      "output": "tcp      6 119 TIME_WAIT src=10.0.2.11 dst=203.0.113.20 sport=45790 dport=80 src=203.0.113.20 dst=203.0.113.1 sport=80 dport=45790 [ASSURED] mark=0 use=1\ntcp      6 119 TIME_WAIT src=203.0.113.10 dst=203.0.113.80 sport=43886 dport=80 src=10.0.1.10 dst=203.0.113.10 sport=80 dport=43886 [ASSURED] mark=0 use=1\ntcp      6 119 TIME_WAIT src=203.0.113.10 dst=203.0.113.80 sport=43876 dport=80 src=10.0.1.10 dst=203.0.113.10 sport=80 dport=43876 [ASSURED] mark=0 use=1"
    }
  ]
}
```

`remote` saw the connection come from `203.0.113.1`, the router, never from `10.0.2.11`. Each line of the **connection tracking** table holds both directions of one connection, first as it was sent and then as the reply is expected:

- The line that starts with `src=10.0.2.11` is source NAT: the original direction is `10.0.2.11` to `203.0.113.20`, and the reply comes back to `dst=203.0.113.1`. The router rewrites that back to `10.0.2.11`.
- The lines that start with `src=203.0.113.10` are destination NAT: `client` connected to `203.0.113.80`, and the reply comes from `src=10.0.1.10`, the real server. (One of them is the health check that `netlab.sh up` ran.)

`TIME_WAIT` and the number before it (seconds until the entry expires) show that both connections already closed. Connection tracking is also what makes **stateful firewalls** possible (Part 4), and its table has a size limit: a busy NAT gateway or Kubernetes node that hits `nf_conntrack_max` starts dropping new connections.

NAT has costs and limits. Internet routers do not carry private ranges, so from the internet a private host is reachable only through an address that something publishes for it (destination NAT, a load balancer); inside your own networks anything with a route can reach it, as Part 4 shows. Many users behind one address (carrier-grade NAT) share its 65,535 ports per destination. And addresses change on the way: with source NAT the destination sees the NAT device's address, while destination NAT keeps the client's address (Part 1's capture on `lb` showed `203.0.113.10`). A reverse proxy is different again: it opens its own connection to the backend, so the backend sees the proxy's address, which is why proxies add headers such as `X-Forwarded-For` (Part 5).

## IPv6

IPv6 addresses are 128 bits, written as eight groups of four hex digits: `2001:0db8:0000:0002:0000:0000:0000:0011`. Leading zeros in a group can be dropped and one run of zero groups becomes `::`, so that address is `2001:db8:0:2::11`. The space is so large that the normal subnet size is a `/64`, with 18 quintillion addresses, and nobody counts hosts any more.

Every IPv6 interface gets a **link-local** address (`fe80::/10`) automatically, even in the lab, where nobody configured IPv6:

```terminal
{
  "title": "IPv6 on a lab link",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "web1#",
      "cmd": "ip -6 addr show dev eth0",
      "output": "2: eth0@if9: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default qlen 1000 link-netns router\n    inet6 fe80::8482:baff:fe4f:b0fc/64 scope link proto kernel_ll\n       valid_lft forever preferred_lft forever"
    },
    {
      "comment": "2001:db8::/32 is the IPv6 documentation prefix",
      "prompt": "web1#",
      "cmd": "ip -6 addr add 2001:db8:0:2::11/64 dev eth0"
    },
    {
      "prompt": "web2#",
      "cmd": "ip -6 addr add 2001:db8:0:2::12/64 dev eth0"
    },
    {
      "comment": "give Duplicate Address Detection a moment (see below)",
      "prompt": "web1#",
      "cmd": "sleep 2"
    },
    {
      "prompt": "web1#",
      "cmd": "ping -6 -c 2 2001:db8:0:2::12",
      "output": "PING 2001:db8:0:2::12 (2001:db8:0:2::12) 56 data bytes\n64 bytes from 2001:db8:0:2::12: icmp_seq=1 ttl=64 time=0.200 ms\n64 bytes from 2001:db8:0:2::12: icmp_seq=2 ttl=64 time=0.218 ms\n\n--- 2001:db8:0:2::12 ping statistics ---\n2 packets transmitted, 2 received, 0% packet loss, time 1029ms\nrtt min/avg/max/mdev = 0.200/0.209/0.218/0.009 ms"
    },
    {
      "prompt": "web1#",
      "cmd": "ip -6 neigh",
      "output": "2001:db8:0:2::12 dev eth0 lladdr 82:13:d3:92:98:f6 REACHABLE"
    }
  ]
}
```

IPv6 has no ARP; the **Neighbor Discovery Protocol** (NDP) does the same job with ICMPv6 messages, and `ip -6 neigh` shows its table. A new address is `tentative` for about a second while **Duplicate Address Detection** checks that no other host uses it, which is why the example waits before the ping.

Address types worth knowing:

| Prefix          | Type               | Meaning                                                                                   |
| --------------- | ------------------ | ----------------------------------------------------------------------------------------- |
| `2000::/3`      | Global unicast     | Public, routed on the internet; your ISP or cloud gives you a prefix (often a /48 or /56) |
| `fd00::/8`      | Unique local (ULA) | Private, like RFC 1918                                                                    |
| `fe80::/10`     | Link-local         | Only on one link; every interface has one                                                 |
| `::1/128`       | Loopback           | The machine itself                                                                        |
| `2001:db8::/32` | Documentation      | Examples and labs                                                                         |

The planning is simpler than IPv4: take your prefix and give every subnet a /64. A /48 holds 65,536 of them:

```terminal
{
  "title": "IPv6 subnets from a /48",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "$",
      "cmd": "python3 -c \"import ipaddress; p = ipaddress.ip_network('2001:db8:1234::/48'); s = list(p.subnets(new_prefix=64)); print(len(s), 'subnets:', s[0], s[1], '...', s[-1])\"",
      "output": "65536 subnets: 2001:db8:1234::/64 2001:db8:1234:1::/64 ... 2001:db8:1234:ffff::/64"
    }
  ]
}
```

IPv6 matters for cost as well as scale. AWS charges for every public IPv4 address (USD 0.005 per hour, about USD 3.60 a month, since February 2024), while IPv6 addresses are free, and traffic to IPv6 destinations needs no NAT gateway (an egress-only internet gateway has no hourly or processing charge). Services that only have IPv4 still need translation: IPv6-only subnets reach them through DNS64 and NAT64, which on AWS runs on a NAT gateway and is billed like one. Without NAT, IPv6 hosts are reachable from the internet unless a firewall says otherwise, so the firewall rules in Part 4 must cover both protocols.

## Troubleshoot Address Problems

**Two machines with the same address** cause intermittent failures: connections work, then break, as neighbours update their tables. `arping -D` (duplicate address detection) asks whether anyone already uses an address. Here `web3` checks `10.0.2.12`, which belongs to `web2`:

```terminal
{
  "title": "find a duplicate address",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "web3#",
      "cmd": "arping -D -I eth0 -c 2 10.0.2.12",
      "output": "ARPING 10.0.2.12 from 0.0.0.0 eth0\nUnicast reply from 10.0.2.12 [82:13:D3:92:98:F6]  0.586ms\nSent 1 probes (1 broadcast(s))\nReceived 1 response(s)"
    }
  ]
}
```

Any reply means the address is taken. The reply also shows the MAC address of the machine that has it, which you can look up in the switch or the cloud console.

**No address at all**, or one from `169.254.0.0/16`: DHCP failed. On Ubuntu servers, netplan configures the network (`/etc/netplan/*.yaml`) and systemd-networkd or NetworkManager applies it; `networkctl status` and `journalctl -u systemd-networkd` show what happened. Cloud VMs get their address from the provider's DHCP; changing it inside the VM does not work, change it in the cloud instead.

**Reaching some networks but not others**: read the routing table with `ip route` and ask `ip route get <address>` which route wins. A VPN that adds a route for `10.0.0.0/8` captures every `10.x` destination, including your VPC.

## Common Mistakes

- **Choosing `10.0.0.0/16` or `192.168.0.0/24` for everything.** They are the defaults everyone uses, so they are the ranges most likely to clash when you connect to a partner, a VPN or another VPC. Pick less common ranges such as `10.20.0.0/16` and record them.
- **Making subnets too small.** Kubernetes on AWS gives every pod a VPC address; a /24 per zone runs out at about 250 pods.
- **Forgetting the reserved addresses** in cloud subnets (5 on AWS and Azure, 4 on Google Cloud).
- **Treating NAT as security.** NAT hides addresses, but it is not a firewall. Part 4 shows a host behind NAT that is still reachable.
- **Ignoring IPv6.** Machines often have IPv6 addresses you did not plan, and a firewall that only covers IPv4 leaves them open.

## Summary

- The prefix length says how many bits name the network: a /24 has 256 addresses, each bit less halves or doubles that, and clouds reserve 4 or 5 per subnet.
- Hosts deliver to their own subnet directly (ARP or NDP) and send everything else to the gateway; the longest matching route wins.
- Plan ranges once, leave room, and check for overlaps with Docker, Kubernetes, VPNs and every network you may peer with. A script can do it in CI.
- NAT rewrites addresses and tracks every connection; it lets private hosts reach the internet but is not a firewall.
- IPv6 uses /64 subnets, link-local addresses and NDP, and saves the cost of public IPv4.

Next, [Part 3](/guides/networking-fundamentals/03-dns-and-domain-management) turns names into these addresses: DNS.

## Keep Learning

- Simulators: [binary and bytes](/games/binary-byte-simulator), [AWS VPC](/games/aws-vpc-simulator)
- Interview questions: [AWS VPC networking fundamentals](/interview-questions/junior/aws-vpc-networking)
- [How to get your local IP address](/posts/how-to-get-local-ip-address) and [list every IP address in a local network](/posts/how-to-get-a-list-of-all-valid-ip-addresses-in-a-local-network)
- [Linux networking commands](/guides/introduction-to-linux/08-networking) in the Introduction to Linux guide
