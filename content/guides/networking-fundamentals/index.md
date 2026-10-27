---
title: 'Networking Fundamentals for Developers'
seoTitle: 'Networking Fundamentals for Developers: TCP/IP, DNS, Subnets and Firewalls'
description: 'Learn networking in a lab you build on one Linux VM: TCP/IP, subnets, DNS, firewalls, load balancing, Docker, Kubernetes, VPCs and troubleshooting.'
category:
  name: 'Networking'
  slug: 'networking'
publishedAt: '2024-11-24T10:00:00Z'
updatedAt: '2026-10-27T09:00:00Z'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Networking
  - TCP/IP
  - DNS
  - Subnetting
  - Firewalls
  - Load Balancing
  - Kubernetes
  - DevOps
---

Every request your software makes crosses a network: a name lookup, a TCP connection, maybe TLS, a load balancer, a firewall, a NAT gateway. When one of those steps fails, the error message names it, and engineers who know the steps fix the problem in minutes instead of hours. This guide teaches those steps by building them.

You start by building a small practice network on one Linux machine, with Linux network namespaces: a client on a stand-in internet, a router with NAT, a firewall and a DNS resolver, a load balancer, three app servers, a database and an authoritative DNS server. Every part starts from a fresh copy of it, changes it, breaks it on purpose and fixes it again, so you see real packets, real DNS answers and real error messages instead of diagrams alone:

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "client", "sub": "203.0.113.10", "icon": "globe", "tone": "slate" },
    { "label": "router", "sub": "NAT, firewall, DNS", "icon": "net", "tone": "amber" },
    { "label": "lb", "sub": "nginx, HAProxy", "icon": "server", "tone": "green" },
    { "label": "web1-3", "sub": "app :8080", "icon": "box", "tone": "blue" },
    { "label": "db", "sub": ":5432", "icon": "database", "tone": "violet" }
  ]
}
```

## What You Will Learn

1. [Network Fundamentals: Layers, IP, TCP, UDP and Ports](/guides/networking-fundamentals/01-network-fundamentals-and-protocols): build the lab, follow one request through DNS, TCP, HTTP and TLS, and measure what each handshake costs.
2. [IP Addressing and Subnetting](/guides/networking-fundamentals/02-ip-addressing-and-subnetting): CIDR prefixes, private ranges, a subnet plan with an overlap check, NAT in the connection tracking table, and IPv6.
3. [DNS Explained](/guides/networking-fundamentals/03-dns-and-domain-management): a lookup from the root servers down, record types, TTLs and caching, and every common DNS error.
4. [Firewalls and Network Security](/guides/networking-fundamentals/04-network-security-and-firewalls-basics): stateful nftables rules, drop versus reject, network segmentation, mutual TLS and rate limits.
5. [Load Balancing](/guides/networking-fundamentals/05-load-balancing): nginx and HAProxy, algorithms, health checks, dead and hung servers, and client addresses behind proxies.
6. [Container Networking](/guides/networking-fundamentals/06-container-networking): a container network built by hand, then Docker's networks and DNS, Kubernetes Services, EndpointSlices and NetworkPolicies.
7. [Cloud Networking](/guides/networking-fundamentals/07-cloud-networking): the lab as an AWS VPC, subnets across zones, security groups and NACLs, endpoints, peering, flow logs and costs.
8. [Network Troubleshooting](/guides/networking-fundamentals/08-network-monitoring-and-troubleshooting): a layer-by-layer method, simulated latency and loss, packet captures, MTU problems and monitoring.
9. [Network Automation](/guides/networking-fundamentals/09-network-automation): firewall changes that roll back on their own, Ansible, a Terraform VPC and a pipeline for network changes.
10. [Advanced Networking](/guides/networking-fundamentals/10-network-concepts): WireGuard tunnels, service meshes, zero trust, Gateway API, eBPF and HTTP/3.

## Prerequisites

- A Linux machine where you can use `sudo`, ideally a throwaway VM or cloud server with Ubuntu 26.04 or 24.04 LTS. Part 1 lists the packages.
- Comfort with a terminal. No networking knowledge is needed.
- For Parts 6, 7 and 9, optionally Docker, a local Kubernetes cluster (kind), an AWS account, Terraform and Ansible. Every part also works as a read-through.

## How the Examples Were Made

The terminal output in this guide is real. The lab output comes from the practice network on Ubuntu 26.04.1 LTS; timings come from a small ARM board, so yours will differ. The Docker, Kubernetes, Terraform, Ansible and Prometheus output comes from the guide's companion repository, whose GitHub Actions workflow runs those commands on fresh Ubuntu runners and also tests the lab script on Ubuntu 24.04 and 26.04. The cloud CLI commands in Part 7 were checked for syntax without credentials, and the one sample record there (a VPC flow log line) is labelled as an example.

```github
The-DevOps-Daily/guide-networking-demo-2026-10-27
```

## Practice in Your Browser

The simulators cover the same ideas with no setup: [a packet's journey](/games/packet-journey), [TCP vs UDP](/games/tcp-vs-udp), [DNS resolution](/games/dns-simulator), [the TLS handshake](/games/ssl-tls-handshake), [load balancing](/games/load-balancer-simulator), [Kubernetes networking](/games/kubernetes-networking-cni-simulator) and [AWS VPC](/games/aws-vpc-simulator).
