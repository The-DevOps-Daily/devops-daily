---
title: 'Advanced Networking: WireGuard, Service Mesh, eBPF, HTTP/3'
description: 'Build a WireGuard tunnel, then see what service meshes, zero trust, Gateway API, eBPF and HTTP/3 solve, with configs checked against the real CRDs.'
order: 10
---

The first nine parts covered what every service depends on: addresses, routes, names, ports, firewalls, load balancers, containers and cloud networks. Past that point, networking tools stop being universal and start being answers to specific problems. A service mesh is worth its cost in a large microservice fleet and a burden in a small one; eBPF matters when kube-proxy's rules become the bottleneck; zero trust matters as soon as "inside the network" stops meaning "safe".

This part builds one of these for real, a WireGuard VPN tunnel into the lab, and then walks through the others with the problem each one solves, a minimal configuration (checked against the real CRDs of each project), and when to skip it.

## Prerequisites

- A fresh lab from [Part 1](/guides/networking-fundamentals/01-network-fundamentals-and-protocols#h2-build-the-practice-lab): run `sudo ./netlab.sh down && sudo ./netlab.sh up` before you start, because every part changes the lab, with `wireguard-tools` installed.
- Kubernetes networking from [Part 6](/guides/networking-fundamentals/06-container-networking) and mTLS from [Part 4](/guides/networking-fundamentals/04-network-security-and-firewalls-basics#h2-above-the-packets-mutual-tls).

## A VPN Tunnel with WireGuard

In a fresh lab the router forwards anything, so `remote`, out on the internet side, can reach the database directly (Part 4 showed why that is a problem). Start by loading Part 4's zone firewall, with two extra lines for VPN users that matter later. Save it as `router-vpn.nft`:

```text
#!/usr/sbin/nft -f
# router: Part 4's zone rules, plus what VPN users may reach
table inet filter
delete table inet filter

table inet filter {
    chain forward {
        type filter hook forward priority filter; policy drop;

        ct state established,related accept
        ct state invalid drop

        iifname "br-wan" ct status dnat accept
        iifname "br-edge" oifname "br-app" tcp dport 8080 accept
        iifname "br-app" oifname "br-data" tcp dport 5432 accept
        ip saddr 10.0.0.0/16 oifname "br-wan" accept

        # VPN users: the database and the app servers, nothing else
        iifname "wg0" oifname "br-data" tcp dport 5432 accept
        iifname "wg0" oifname "br-app" tcp dport 8080 accept
    }
}
```

```terminal
{
  "title": "the database is closed to the internet side",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "router#",
      "cmd": "nft -c -f router-vpn.nft && nft -f router-vpn.nft"
    },
    {
      "prompt": "remote#",
      "cmd": "nc -zv -w 3 10.0.3.10 5432",
      "output": "nc: connect to 10.0.3.10 port 5432 (tcp) timed out: Operation now in progress"
    }
  ]
}
```

A **VPN** gives `remote` (think of an engineer's laptop or a branch office) a private path into the network over the public one, and lets the firewall treat its traffic separately. **WireGuard** is a small, fast VPN built into the Linux kernel; each side has a key pair, and peers are configured by public key, like SSH. The commercial and open-source mesh VPNs (Tailscale, NetBird, Netmaker and others) are built on it.

Create a key pair on each side, then the tunnel interfaces. The router listens on UDP port 51820 and gives the tunnel a small network of its own, `10.99.0.0/24`:

```terminal
{
  "title": "keys and a tunnel between remote and the router",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "comment": "a key pair for the router; only the public half leaves the machine",
      "prompt": "router#",
      "cmd": "umask 077 && wg genkey | tee /etc/netlab/wg-router.key | wg pubkey > /etc/netlab/wg-router.pub"
    },
    {
      "prompt": "remote#",
      "cmd": "umask 077 && wg genkey | tee /etc/netlab/wg-remote.key | wg pubkey > /etc/netlab/wg-remote.pub"
    },
    {
      "prompt": "router#",
      "cmd": "ip link add wg0 type wireguard && ip addr add 10.99.0.1/24 dev wg0"
    },
    {
      "prompt": "router#",
      "cmd": "wg set wg0 listen-port 51820 private-key /etc/netlab/wg-router.key peer \"$(cat /etc/netlab/wg-remote.pub)\" allowed-ips 10.99.0.2/32"
    },
    {
      "prompt": "router#",
      "cmd": "ip link set wg0 up"
    },
    {
      "prompt": "remote#",
      "cmd": "ip link add wg0 type wireguard && ip addr add 10.99.0.2/24 dev wg0"
    },
    {
      "comment": "send the tunnel network and the lab's private range through the router",
      "prompt": "remote#",
      "cmd": "wg set wg0 private-key /etc/netlab/wg-remote.key peer \"$(cat /etc/netlab/wg-router.pub)\" endpoint 203.0.113.1:51820 allowed-ips 10.99.0.0/24,10.0.0.0/16 persistent-keepalive 25"
    },
    {
      "prompt": "remote#",
      "cmd": "ip link set wg0 up && ip route add 10.0.0.0/16 dev wg0"
    }
  ]
}
```

In the lab both key pairs land in `/etc/netlab`, because all lab hosts share your machine's file system. On real machines each private key stays on its own machine, and you copy only the `.pub` files. `allowed-ips` is both a routing table and an access list: the router accepts packets from this peer only with source `10.99.0.2`, and `remote` sends anything for `10.0.0.0/16` into the tunnel. Now use it, and look at what crosses the internet side while you do:

```terminal
{
  "title": "private services through the tunnel",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "comment": "the database and an app server, by their private addresses",
      "prompt": "remote#",
      "cmd": "nc -zv -w 3 10.0.3.10 5432",
      "output": "Connection to 10.0.3.10 5432 port [tcp/postgresql] succeeded!"
    },
    {
      "prompt": "remote#",
      "cmd": "curl -s -m 3 http://10.0.2.12:8080/",
      "output": "served by web2 (10.0.2.12)"
    },
    {
      "comment": "meanwhile, on the internet side, in a second terminal",
      "prompt": "router#",
      "cmd": "tcpdump -nn -i br-wan -c 6 'udp port 51820'",
      "output": "IP 203.0.113.20.57003 > 203.0.113.1.51820: UDP, length 96\nIP 203.0.113.1.51820 > 203.0.113.20.57003: UDP, length 96\nIP 203.0.113.20.57003 > 203.0.113.1.51820: UDP, length 96\nIP 203.0.113.20.57003 > 203.0.113.1.51820: UDP, length 96\nIP 203.0.113.1.51820 > 203.0.113.20.57003: UDP, length 96\nIP 203.0.113.1.51820 > 203.0.113.20.57003: UDP, length 96"
    },
    {
      "prompt": "router#",
      "cmd": "wg show wg0",
      "output": "interface: wg0\n  public key: DZDadOOBijz7KUYVdJyK8ambd8RJQw0Dj9VgYnZOKCQ=\n  private key: (hidden)\n  listening port: 51820\n\npeer: dRjRRKVZw6/OQ1T9ei7pwy0nTgMBygfLgPJfQDTop3U=\n  endpoint: 203.0.113.20:57003\n  allowed ips: 10.99.0.2/32\n  latest handshake: 1 second ago\n  transfer: 1.35 KiB received, 988 B sent"
    }
  ]
}
```

The same connection that timed out a minute ago now works, because it arrives on `wg0`, where the two VPN rules allow it. On the internet side there is nothing but encrypted UDP datagrams between `203.0.113.20` and port 51820; the PostgreSQL port and the HTTP request are inside them. `wg show` reports the peer's current address, the time of the last **handshake** (WireGuard renews keys every two minutes while traffic flows) and the bytes moved. The tunnel adds encryption and a key-based identity; the firewall rules for `wg0` decide what that identity may reach.

Cloud provider VPNs (AWS Site-to-Site VPN, Azure VPN Gateway, Google Cloud VPN) speak **IPsec** instead, which is older and has more moving parts, but the model is the same: two endpoints, keys, and a list of networks routed through the tunnel. The post [we took down our mesh VPN control plane](/posts/mesh-vpn-control-plane-outage-what-keeps-working) shows what keeps working in a WireGuard mesh when its coordination server fails.

## Service Meshes

In Part 4 you added mTLS to one endpoint by hand, and in Part 5 you tuned retries and timeouts in one proxy. A **service mesh** does both, plus traffic splitting and per-request metrics, for every connection between services, without changing their code. It has two parts: a **data plane** of proxies that handle the traffic, and a **control plane** that configures them and issues certificates.

The data plane comes in two designs:

- **Sidecar**: an Envoy proxy in every pod, which sees all of the pod's traffic. Full layer 7 features everywhere, at the cost of memory and latency per pod, and restarts to upgrade.
- **Ambient** (Istio, GA since 1.24): a per-node proxy (**ztunnel**) handles mTLS and layer 4 policy for all pods on the node, and optional per-namespace **waypoint** proxies add layer 7 features only where you need them. Much cheaper for the common case, which is "encrypt and authenticate everything".

The main options are **Istio** (sidecar and ambient, the largest feature set), **Linkerd** (sidecar, small and simple, with stable releases now distributed by its vendor, Buoyant), and **Cilium** (mesh features in its eBPF data plane, with Envoy for layer 7). With Istio, three resources cover the basics: require mTLS for a namespace, allow only one service identity to call another, and eject failing endpoints:

```yaml
# every workload in the namespace accepts mTLS only
apiVersion: security.istio.io/v1
kind: PeerAuthentication
metadata:
  name: default
  namespace: shop
spec:
  mtls:
    mode: STRICT
---
# only the web service account may call the api, and only with GET and POST under /api/
apiVersion: security.istio.io/v1
kind: AuthorizationPolicy
metadata:
  name: api-from-web
  namespace: shop
spec:
  selector:
    matchLabels:
      app: api
  action: ALLOW
  rules:
    - from:
        - source:
            principals: ['cluster.local/ns/shop/sa/web']
      to:
        - operation:
            methods: ['GET', 'POST']
            paths: ['/api/*']
---
# connection limits and outlier detection: a server with 5 errors in a row is ejected for 30 s
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:
  name: api
  namespace: shop
spec:
  host: api.shop.svc.cluster.local
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http1MaxPendingRequests: 50
    outlierDetection:
      consecutive5xxErrors: 5
      interval: 10s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
```

The **principal** in the AuthorizationPolicy is a **SPIFFE identity** derived from the pod's Kubernetes service account, carried in the client certificate of the mTLS connection. The policy does not care which IP address the caller has, which is the core idea of the next section. `outlierDetection` is the mesh version of Part 5's passive health checks.

These examples are written for **sidecar** mode. In ambient mode, ztunnel enforces only layer 4 rules: an AuthorizationPolicy with HTTP methods or paths that selects workloads with a `selector` is turned into a DENY policy, so it blocks traffic instead of allowing it. Layer 7 rules in ambient mode go to a waypoint proxy, attached with `targetRefs` that point to the waypoint `Gateway` or to the Service that uses it.

Use a mesh when you have many services, several teams, and a requirement for encryption and identity between all of them. Skip it for a handful of services, where TLS between them, NetworkPolicies and good client libraries cover the same needs with far less to operate.

## Zero Trust

The traditional model trusts the network: inside the firewall is safe, outside is not. Zero trust drops that assumption. Every request is authenticated and authorized on its own, based on **identity** (of the user, the device and the service), and the network location only adds context:

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Request", "sub": "user or service", "icon": "globe", "tone": "slate" },
    { "label": "Identity", "sub": "SSO, device, SPIFFE certificate", "icon": "lock", "tone": "blue" },
    { "label": "Policy", "sub": "who, what, from where, now", "icon": "gear", "tone": "amber" },
    { "label": "Enforcement", "sub": "proxy, mesh, gateway", "icon": "shield", "tone": "violet" },
    { "label": "Service", "sub": "least privilege", "icon": "box", "tone": "green" }
  ]
}
```

In practice that means:

- **Encrypt and authenticate every connection**, also inside the data centre: mTLS between services (Part 4, or a mesh), TLS to databases.
- **Authorize per request** with identities, not addresses: AuthorizationPolicies, OPA, or checks in the application.
- **Give people access to applications, not networks**: identity-aware proxies (Cloudflare Access, Google IAP, Pomerium, Teleport and similar) instead of a VPN that puts a laptop on the whole network. A WireGuard tunnel like the one above is still useful, but scope what it can reach.
- **Keep network segmentation** as a second layer. Zero trust does not mean "no firewalls"; it means the firewall is not the only thing you rely on.

## Gateway API

The **Gateway API** is the Kubernetes standard for traffic into (and, with meshes, between) services, and the successor of Ingress. The ingress-nginx controller, the most widely used Ingress implementation, was retired in March 2026, which made the move urgent for many clusters. Gateway API splits responsibilities: the platform team owns a `Gateway` (listeners, certificates, which namespaces may attach routes), and app teams own `HTTPRoute`s. Weighted backends make canary releases a two-line change:

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: shop
  namespace: shop
spec:
  gatewayClassName: example
  listeners:
    - name: https
      protocol: HTTPS
      port: 443
      hostname: www.shop.example
      tls:
        certificateRefs:
          - name: shop-tls
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: shop
  namespace: shop
spec:
  parentRefs:
    - name: shop
  hostnames: ['www.shop.example']
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /api
      backendRefs:
        - name: api
          port: 8080
          weight: 90
        - name: api-canary
          port: 8080
          weight: 10
    - backendRefs:
        - name: web
          port: 80
```

`gatewayClassName` names the implementation (Envoy Gateway, Istio, Cilium, NGINX Gateway Fabric, a cloud provider's load balancer controller and others). The [Kubernetes guide](/guides/introduction-to-kubernetes/05-services-and-networking) runs a Gateway end to end, and the post on [the ingress-nginx end of life](/posts/ingress-nginx-eol-gateway-api-migration) covers migrating from Ingress.

## eBPF and Cilium

**eBPF** lets small, verified programs run inside the Linux kernel at hooks such as network interfaces, sockets and system calls, without kernel modules. For networking it changes two things:

- **Speed and scale**: Cilium can replace kube-proxy's long chains of NAT rules (Part 6) with eBPF hash-table lookups, and **XDP** programs can drop or redirect packets at the network card before the kernel's network stack allocates memory for them, which is how large DDoS defences and load balancers work.
- **Visibility**: tools such as Hubble (Cilium) watch every flow with its Kubernetes labels, so you can ask "which pods talked to the database in the last hour" without tcpdump.

Cilium's own policy resource also understands layer 7. This policy lets pods labelled `app: web` call the `api` pods with `GET /api/...` only, which a plain NetworkPolicy cannot express:

```yaml
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: api-l7
  namespace: shop
spec:
  endpointSelector:
    matchLabels:
      app: api
  ingress:
    - fromEndpoints:
        - matchLabels:
            app: web
      toPorts:
        - ports:
            - port: '8080'
              protocol: TCP
          rules:
            http:
              - method: GET
                path: '/api/.*'
```

All three files above were sent to a Kubernetes API server with `--dry-run=server` after installing the CRDs of Istio 1.31.3, Gateway API v1.6.3 and Cilium 1.20.4, which validates every field against each project's schema:

```terminal
{
  "title": "server-side validation (companion repo, kind with the projects' CRDs)",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "kubectl apply --dry-run=server -f mesh.yaml -f gateway.yaml -f cilium-l7.yaml",
      "output": "peerauthentication.security.istio.io/default created (server dry run)\nauthorizationpolicy.security.istio.io/api-from-web created (server dry run)\ndestinationrule.networking.istio.io/api created (server dry run)\ngateway.gateway.networking.k8s.io/shop created (server dry run)\nhttproute.gateway.networking.k8s.io/shop created (server dry run)\nciliumnetworkpolicy.cilium.io/api-l7 created (server dry run)"
    }
  ]
}
```

## HTTP/3 and QUIC

**HTTP/3** runs over **QUIC**, a transport on top of UDP that combines the TCP and TLS handshakes into one round trip (Part 1 measured what the separate handshakes cost), keeps one lost packet from stalling every stream on the connection, and survives a client changing networks, such as a phone moving from Wi-Fi to mobile data. Browsers learn that a site supports it from the `Alt-Svc` header (or the HTTPS DNS record from Part 3) and switch on the next request.

nginx supports it since 1.25 (Ubuntu 26.04 ships 1.28; Ubuntu 24.04's 1.24 cannot do this). Add a UDP listener and the header to the `server` block in `/etc/netlab/lb-nginx.conf`, next to the existing `listen 443 ssl;` and certificate lines:

```nginx
listen 443 quic reuseport;
add_header Alt-Svc 'h3=":443"; ma=86400' always;
```

Then check and reload:

```terminal
{
  "title": "an HTTP/3 listener next to HTTPS",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "lb#",
      "cmd": "grep -E 'listen|Alt-Svc' /etc/netlab/lb-nginx.conf",
      "output": "        listen 80;\n        listen 443 ssl;\n        listen 443 quic reuseport;\n        add_header Alt-Svc 'h3=\":443\"; ma=86400' always;"
    },
    {
      "prompt": "lb#",
      "cmd": "nginx -t -q -c /etc/netlab/lb-nginx.conf && nginx -c /etc/netlab/lb-nginx.conf -s reload",
      "output": "2026/10/27 09:39:14 [notice] 234#234: signal process started"
    },
    {
      "comment": "TCP 443 for HTTP/1.1 and HTTP/2, UDP 443 for HTTP/3",
      "prompt": "lb#",
      "cmd": "ss -tulnp 'sport = :443'",
      "output": "Netid State  Recv-Q Send-Q Local Address:Port Peer Address:PortProcess\nudp   UNCONN 0      0            0.0.0.0:443       0.0.0.0:*    users:((\"nginx\",pid=237,fd=11),(\"nginx\",pid=144,fd=11))\ntcp   LISTEN 0      511          0.0.0.0:443       0.0.0.0:*    users:((\"nginx\",pid=237,fd=7),(\"nginx\",pid=144,fd=7))"
    },
    {
      "prompt": "client#",
      "cmd": "curl -sI --cacert /etc/netlab/tls/ca.crt https://www.shop.example/ | grep -i -E '^(HTTP|alt-svc)'",
      "output": "HTTP/2 200\nalt-svc: h3=\":443\"; ma=86400"
    }
  ]
}
```

The `curl` in Ubuntu 26.04 is built without HTTP/3, so it keeps using HTTP/2 and only shows the advertisement; browsers and curl builds with HTTP/3 support (`curl --http3`) would switch. In a real deployment, also open UDP 443 in every firewall and security group on the path (the lab router only forwards TCP), or clients fall back to HTTP/2 after a delay.

## Other Ideas Worth Knowing

- **IPv6 and dual stack.** Kubernetes, the major clouds and most CDNs run dual-stack; IPv6-only subnets avoid IPv4 address charges and, for IPv6 destinations, NAT; IPv4-only services are still reached through DNS64 and NAT64 (Part 2 and Part 7). New networks should plan both from the start.
- **Topology-aware routing.** In Kubernetes, `trafficDistribution: PreferSameZone` on a Service keeps traffic in the client's zone when it can, which cuts latency and cross-zone charges (Part 7). The older value `PreferClose` is deprecated.
- **Anycast and edge networks.** One address announced from many locations, with computation at the edge (CDN workers), puts content and logic close to users; Part 5 used it for global load balancing.
- **Software-defined networking.** Cloud VPCs, Kubernetes CNIs and meshes are all software-defined networks: a controller holds the desired state and programs data planes. You rarely build one, but every part of this guide used one.

## Common Mistakes

- **Adopting a service mesh to fix one problem.** If you need mTLS for three services, use TLS with certificates from a CA; a mesh is a platform to run.
- **Treating a VPN as zero trust.** A tunnel that puts a laptop on the whole network is the old perimeter with a longer cable. Limit `allowed-ips` and firewall what VPN users can reach.
- **Policies by IP address in dynamic environments.** Pods and instances change addresses; write policies with labels, service accounts and security group references.
- **Turning on HTTP/3 without opening UDP 443.** Clients try QUIC, wait, and fall back.
- **Forgetting the fundamentals underneath.** Every mesh, tunnel and eBPF program still depends on DNS, routes, MTU and timeouts. Tunnels lower the MTU (WireGuard to 1420), which is Part 8's MTU problem waiting to happen.

## Summary

- WireGuard builds fast, simple VPN tunnels from key pairs and `allowed-ips`; mesh VPNs and many remote-access products build on it.
- Service meshes add mTLS, identity-based authorization, retries and traffic splitting to every connection; ambient mode lowers their cost, and small systems often do not need one.
- Zero trust authenticates and authorizes every request by identity and keeps segmentation as a second layer.
- Gateway API replaces Ingress, eBPF (with Cilium) speeds up and explains Kubernetes networking, and HTTP/3 over QUIC removes a round trip and head-of-line blocking.

That completes the guide. You built a network from namespaces, addressed and subnetted it, gave it DNS, firewalls, load balancing, containers and a cloud equivalent, learned to troubleshoot and automate it, and saw where it goes next. When you are done with the lab, remove it with `sudo ./netlab.sh down`, remove the Docker containers and the kind cluster from Part 6 (its [Clean Up](/guides/networking-fundamentals/06-container-networking#h2-clean-up) section lists the commands), and delete the VM or Droplet if you created one for it.

## Keep Learning

- Simulators: [service mesh](/games/service-mesh-simulator), [microservices](/games/microservices-simulator)
- Istio: [traffic management quiz](/quizzes/istio-traffic-management-quiz), [flashcards](/flashcards/istio-traffic-management), [checklist](/checklists/istio-traffic-management)
- eBPF: [network observability quiz](/quizzes/ebpf-network-observability-quiz) and [flashcards](/flashcards/ebpf-network-observability)
- Interview questions: [service mesh concepts](/interview-questions/mid/service-mesh-concepts)
- The [Security Principles](/guides/security-principles) guide for least privilege and defence in depth
