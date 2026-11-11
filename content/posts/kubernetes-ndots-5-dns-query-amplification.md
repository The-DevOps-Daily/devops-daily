---
title: 'ndots:5 in Kubernetes: Why One DNS Lookup Turns Into Ten Queries'
excerpt: 'A normal external hostname can make eight or ten DNS requests from a Kubernetes Pod before it succeeds. Trace the resolver rule behind that fan-out, measure it, and choose fixes that do not break cross-namespace Service names.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2026-11-16'
publishedAt: '2026-11-16T07:00:00Z'
updatedAt: '2026-11-16T07:00:00Z'
readingTime: '10 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Kubernetes
  - DNS
  - CoreDNS
  - Networking
  - Performance
  - Troubleshooting
---

Your application asks for `api.example.com`, CoreDNS looks healthy, and yet DNS request volume jumps by a multiple of outbound HTTP traffic. The surprising part is often not a retry or a bad cache. It is the Pod resolver doing exactly what its search path tells it to do. In a measured glibc run, that one two-dot external name produced eight DNS queries, or ten when the Pod also inherited a node search domain.

This post shows the resolver rule, reproduces the count, and gives you a safe way to decide between a trailing dot, a lower `ndots` value, and DNS-side improvements. The numbers below are a controlled resolver experiment, not a promise about every language runtime.

## TL;DR

- Kubernetes documents `ndots:5` and a three-part Service search list for a normal Linux Pod. A name with fewer than five dots is searched under those suffixes before glibc tries it as absolute.
- In our glibc 2.36 measurement, `api.example.com` generated eight A and AAAA queries with three search suffixes. An inherited fourth suffix made it ten. `api.example.com.` and `ndots:2` each made two.
- Do not lower `ndots` blindly. `my-svc.other-ns` made six queries with `ndots:1`, because glibc tried the absolute name first; it made four with `ndots:2` and then found the Service through `svc.cluster.local`.
- Start with the names your workload actually resolves, then measure CoreDNS requests and NXDOMAIN responses. For external configuration, an absolute FQDN with a trailing dot is the narrowest change. For a Pod-wide change, test `ndots: "2"` against every short and cross-namespace Service name it uses.

## Prerequisites

- Access to a non-production namespace and permission to inspect Pods and the `kube-system` namespace.
- A workload inventory that includes external hostnames, same-namespace Services, and cross-namespace Services.
- CoreDNS metrics in your monitoring system, or approval to enable short-lived query logging during a quiet test window.
- A Linux test environment if you want to reproduce the glibc experiment. Other resolver implementations can behave differently.

## What Kubernetes puts in a Pod

For a `ClusterFirst` Linux Pod, Kubernetes shows this resolver shape in its [DNS for Services and Pods documentation](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/):

```text
nameserver <cluster-dns-IP>
search <namespace>.svc.cluster.local svc.cluster.local cluster.local
options ndots:5
```

The actual cluster domain and nameserver differ by installation. The first search suffix lets `payments` find `payments` in the caller's namespace. The second is why `payments.finance` can resolve as `payments.finance.svc.cluster.local`. Kubernetes also allows additional search domains to be merged into Pod DNS configuration, subject to documented list limits, so inspect the running Pod instead of assuming this three-entry example is complete.

```bash
kubectl -n app exec deploy/api -- cat /etc/resolv.conf
```

Kubernetes explains its choice in the [service debugging guide](https://kubernetes.io/docs/tasks/debug/debug-application/debug-service/): `ndots:5` is high enough for the DNS names Kubernetes generates. That is the compatibility goal. It lets names such as `service.namespace.svc` participate in search-path resolution, rather than treating any dotted name as immediately external.

The important glibc rule comes from [resolv.conf(5)](https://www.man7.org/linux/man-pages/man5/resolv.conf.5.html): a name with fewer dots than `ndots` is tried against each search suffix in order. At `ndots:5`, `api.example.com` has two dots, so it is below the threshold. With three suffixes, the resolver asks for three search-expanded names before its final absolute lookup. When the application asks for both IPv4 and IPv6 addresses, glibc sends an A and an AAAA question for each candidate, which doubles four candidate names into eight DNS requests. With `AI_ADDRCONFIG` set by the caller on a host without an IPv6 address, glibc skips AAAA, so an IPv4-only setup can see half the count.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "api.example.com", "sub": "2 dots, ndots:5", "icon": "pod", "tone": "blue" },
    { "label": "3 search suffixes", "sub": "6 A and AAAA NXDOMAINs", "icon": "net", "tone": "amber" },
    { "label": "Absolute lookup", "sub": "A and AAAA answer", "icon": "globe", "tone": "green" }
  ]
}
```

The resolver is not proving that the external domain is broken. It is asking whether strings such as `api.example.com.default.svc.cluster.local` are internal names first.

## The measurement: eight, ten, and two

We ran this test on 2026-11-11 on Debian 12 with glibc 2.36. A small UDP DNS stub listened on `127.0.0.2:53`, logged every question, returned addresses only for `api.example.com` and `my-svc.other-ns.svc.cluster.local`, and returned NXDOMAIN for everything else. Each run bind-mounted a Pod-style `resolv.conf` and `hosts: files dns` `nsswitch.conf` over `/etc` in `unshare -rm`, then called `getent ahosts <name>`. That exercises the glibc resolver path used by many Linux applications. `getent ahosts` sets `AI_ADDRCONFIG`, and our test host had an IPv6 address, so every candidate got an A and an AAAA question; on an IPv4-only host, newer glibc versions offer `getent --no-addrconfig ahosts` to see the same pairs.

```chart
{
  "type": "bar",
  "title": "Queries per lookup in the glibc resolver test",
  "unit": " queries",
  "caption": "Measured with the stub, glibc 2.36, date 2026-11-11. Each bar counts logged A and AAAA questions.",
  "rows": [
    { "label": "api.example.com, ndots:5, 3 suffixes", "value": 8, "series": "external name" },
    { "label": "api.example.com, ndots:5, 4 suffixes", "value": 10, "series": "external name" },
    { "label": "api.example.com., trailing dot", "value": 2, "series": "absolute name" },
    { "label": "api.example.com, ndots:1 or ndots:2", "value": 2, "series": "absolute name" },
    { "label": "my-svc.other-ns, ndots:1", "value": 6, "series": "Service name" },
    { "label": "my-svc.other-ns, ndots:2", "value": 4, "series": "Service name" },
    { "label": "nonexistent.example.org, ndots:5", "value": 8, "series": "NXDOMAIN" }
  ],
  "series": [
    { "name": "external name", "color": "#f59e0b" },
    { "name": "absolute name", "color": "#10b981" },
    { "name": "Service name", "color": "#38bdf8" },
    { "name": "NXDOMAIN", "color": "#ef4444" }
  ]
}
```

Here are two of the runs. `getent` prints the address the application would get; the stub's log, cleared before each run, shows every question the resolver sent to get there.

```terminal
{
  "title": "glibc resolver trace",
  "prompt": "$",
  "steps": [
    {
      "comment": "ndots:5, three Kubernetes search suffixes"
    },
    {
      "cmd": "getent ahosts api.example.com | head -n 1",
      "output": "192.0.2.10      STREAM api.example.com"
    },
    {
      "comment": "what the stub saw: 8 questions"
    },
    {
      "cmd": "cut -d' ' -f2- q.log",
      "output": "A    api.example.com.default.svc.cluster.local. -> NXDOMAIN\nAAAA api.example.com.default.svc.cluster.local. -> NXDOMAIN\nA    api.example.com.svc.cluster.local. -> NXDOMAIN\nAAAA api.example.com.svc.cluster.local. -> NXDOMAIN\nA    api.example.com.cluster.local. -> NXDOMAIN\nAAAA api.example.com.cluster.local. -> NXDOMAIN\nA    api.example.com. -> NOERROR\nAAAA api.example.com. -> NOERROR"
    },
    {
      "comment": "the trailing dot makes the name absolute"
    },
    {
      "cmd": "getent ahosts api.example.com. | head -n 1",
      "output": "192.0.2.10      STREAM api.example.com"
    },
    {
      "comment": "what the stub saw: 2 questions"
    },
    {
      "cmd": "cut -d' ' -f2- q.log",
      "output": "A    api.example.com. -> NOERROR\nAAAA api.example.com. -> NOERROR"
    }
  ]
}
```

The four-suffix case adds `eu-west-1.compute.internal` and produces two more NXDOMAINs. A nonexistent name produces eight NXDOMAINs under the three-suffix `ndots:5` configuration. Negative answers are still work for the client and resolver, even if a cache later reduces repeats.

### Reproduce the resolver test

Run the stub as root on a Linux host with Python 3 (it binds port 53). The test also needs a Pod-style `resolv.conf` and an `nsswitch.conf` containing `hosts: files dns`; `attempts:1 timeout:1` only keep a failed run short:

```text
# resolv-5.conf
nameserver 127.0.0.2
search default.svc.cluster.local svc.cluster.local cluster.local
options ndots:5 attempts:1 timeout:1

# nsswitch.conf
hosts: files dns
```

The stub is deliberately tiny so its log is the evidence, not a timing benchmark.

```python
# stub.py, run with: sudo python3 stub.py 127.0.0.2 q.log
import socket, struct, sys, time

answers = {
    "api.example.com.": ("192.0.2.10", "2001:db8::10"),
    "my-svc.other-ns.svc.cluster.local.": ("10.96.12.34", "2001:db8::34"),
}
types = {1: "A", 28: "AAAA"}

def qname(data, offset=12):
    labels = []
    while data[offset]:
        size = data[offset]
        labels.append(data[offset + 1 : offset + 1 + size].decode())
        offset += size + 1
    return ".".join(labels) + ".", offset + 1

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.bind((sys.argv[1] if len(sys.argv) > 1 else "127.0.0.2", 53))
while True:
    data, peer = sock.recvfrom(512)
    txid = struct.unpack(">H", data[:2])[0]
    name, offset = qname(data)
    qtype = struct.unpack(">H", data[offset : offset + 2])[0]
    question, hit = data[12 : offset + 4], answers.get(name.lower())
    record = b""
    if hit and qtype == 1:
        record = b"\xc0\x0c" + struct.pack(">HHIH", 1, 1, 60, 4) + socket.inet_aton(hit[0])
    elif hit and qtype == 28:
        record = b"\xc0\x0c" + struct.pack(">HHIH", 28, 1, 60, 16) + socket.inet_pton(socket.AF_INET6, hit[1])
    rcode = 0 if hit else 3
    header = struct.pack(">HHHHHH", txid, 0x8180 | rcode, 1, bool(record), 0, 0)
    sock.sendto(header + question + record, peer)
    with open(sys.argv[2] if len(sys.argv) > 2 else "/dev/stdout", "a") as log:
        log.write(f"{time.time():.3f} {types.get(qtype, qtype):<4} {name} -> {'NOERROR' if hit else 'NXDOMAIN'}\n")
```

```bash
# In a second shell. No host root is needed where unprivileged user
# namespaces are enabled: -r maps you to root inside a new user namespace,
# and -m gives that shell a private mount table.
unshare -rm sh -c '
  mount --bind "$PWD/resolv-5.conf" /etc/resolv.conf
  mount --bind "$PWD/nsswitch.conf" /etc/nsswitch.conf
  getent ahosts api.example.com | head -n 1
'
cut -d" " -f2- q.log   # the stub's log: one line per question
```

Do not copy this mounting pattern onto a node that is serving workloads. It is a disposable namespace experiment. In a cluster, inspect the effective configuration first and measure the real workload separately.

## Why the extra requests can hurt

The count is not automatically an incident. A cache may answer many repeated questions, and an internal name that matches early stops the search. It becomes expensive when a high-QPS workload resolves external or missing names often enough that the multiplier turns into CoreDNS work, NXDOMAIN volume, and upstream traffic. The latency risk is most visible when one of the search candidates waits for a timeout: [resolv.conf(5)](https://www.man7.org/linux/man-pages/man5/resolv.conf.5.html) warns that search processing can be slow and create substantial network traffic when the listed-domain servers are not local.

Cloud limits can turn the multiplier into a capacity concern. AWS documents a hard limit of [1,024 packets per second per network interface to the Amazon-provided DNS server](https://docs.aws.amazon.com/whitepapers/latest/hybrid-cloud-dns-options-for-vpc/constraints.html). That is not a Kubernetes-wide query limit, and it only applies when traffic reaches that resolver. It is still a reason to count the forwarded requests on EKS rather than treating redundant lookups as free. AWS's [EKS guidance](https://docs.aws.amazon.com/eks/latest/best-practices/monitoring_eks_workloads_for_network_performance_issues.html) names CoreDNS replica placement and NodeLocal DNSCache as responses to DNS throttling.

There is a second, separate failure mode worth keeping distinct from `ndots`: parallel UDP A and AAAA requests can interact badly with connection tracking on some Kubernetes paths. The Kubernetes [NodeLocal DNSCache documentation](https://kubernetes.io/docs/tasks/administer-cluster/nodelocaldns/) says skipping DNAT and conntrack helps reduce conntrack races, and that its cache can use TCP for misses to CoreDNS. The NodeLocal DNSCache [KEP](https://github.com/kubernetes/enhancements/blob/master/keps/sig-network/1024-nodelocal-cache-dns/README.md) describes DNS timeouts often up to 30 seconds from retries, including 5-second A and AAAA timeouts. Do not infer a universal kernel fix from that history. Diagnose your dataplane and kernel instead.

For glibc clients, `single-request-reopen` changes how it reopens the socket when paired A and AAAA requests are mishandled, while `use-vc` forces TCP. Both are documented in [resolv.conf(5)](https://www.man7.org/linux/man-pages/man5/resolv.conf.5.html). They are targeted compatibility options, not an `ndots` optimization, so test them with the actual client image and DNS path before adding them to a Pod spec.

## Pick the smallest safe fix

The first question is what kind of name you are changing.

| Name pattern                               | Lowest-risk first move                        | Why                                                                    |
| ------------------------------------------ | --------------------------------------------- | ---------------------------------------------------------------------- |
| External hostname in static configuration  | Use its trailing-dot FQDN                     | Bypasses search expansion for that one name.                           |
| External hostnames throughout one workload | Test `ndots: "2"`                             | Two-dot external names are tried absolute first.                       |
| Same-namespace Service                     | Keep the short name                           | The first search suffix is useful.                                     |
| `service.namespace` cross-namespace name   | Test carefully with `ndots:2`                 | It retains search-first behavior in the measured run.                  |
| A fleet with repetitive lookup traffic     | Evaluate NodeLocal DNSCache and CoreDNS cache | These reduce resolver-path work without changing application spelling. |

### Use an absolute FQDN when you control the hostname

The trailing dot says the DNS name is already absolute:

```yaml
env:
  - name: API_BASE_URL
    value: 'https://api.example.com.'
```

That made two queries in the measurement. It can be an excellent narrow fix for a configured hostname, but test it end to end. HTTP client URL handling, the `Host` header, certificate matching, proxy routing, and TLS SNI handling are library and proxy specific. Test the exact client, proxy, and certificate path rather than assuming every component treats the final dot the same way.

### Set `ndots: "2"` only after a service-name test

The Kubernetes API represents DNS option values as strings. This Deployment applies `ndots: "2"` to its Pods:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      dnsConfig:
        options:
          - name: ndots
            value: '2' # DNS option values are strings in the Pod API.
      containers:
        - name: api
          image: registry.example.com/api:2026-11-16
```

Kubernetes documents that `dnsConfig.options` are merged with the DNS policy configuration and shows the same quoted `value: "2"` form in its [custom DNS example](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/). In the test, `ndots:2` made `api.example.com` absolute first, while `my-svc.other-ns` searched `my-svc.other-ns.default.svc.cluster.local` then found `my-svc.other-ns.svc.cluster.local`. By contrast, `ndots:1` first sent `my-svc.other-ns.` to upstream resolution, then made the search-path calls.

That is why `ndots:1` is not a free win. Run the application smoke tests for short names, partially qualified Service names, and external names after rollout. If the workload only uses full Service FQDNs and external hosts, its trade-off can differ from a namespace-heavy application.

### Reduce work in the DNS layer

[NodeLocal DNSCache](https://kubernetes.io/docs/tasks/administer-cluster/nodelocaldns/) runs a caching agent as a DaemonSet on every node. Kubernetes says Pods normally reach the CoreDNS Service through kube-proxy, while the local-cache design lets Pods query the local agent, avoids DNAT and connection tracking, and provides per-node DNS visibility. It is a cluster change, so size and test it, including its memory limit. The documentation notes that cache entries and concurrent queries affect memory demand.

The CoreDNS [`cache` plugin](https://coredns.io/plugins/cache/) caches successful and denial responses. Its documentation says a default cache is split into 256 shards with 9,984 entries in total, and that negative responses can be cached. Review TTLs, eviction behavior, and the names that are actually repeated before relying on it to mask an avoidable query multiplier.

The CoreDNS [`autopath` plugin](https://coredns.io/plugins/autopath/) moves search-path completion to the server. In Kubernetes it needs `pods verified` for the Kubernetes plugin and the client Pod IP to reach CoreDNS. CoreDNS documents that `pods verified` maintains a watch on all Pods and uses substantially more memory than insecure mode. It also documents a Pod-IP reuse race and notes that a final negative answer still makes the client search manually. Treat it as a measured CoreDNS configuration change, not a default switch.

## Measure before and after

Start at the Pod, then the resolver. Capture `/etc/resolv.conf` (the `getent` calls below need an image that ships it; use a debug container otherwise), list the hostname patterns in configuration, and compare a known external name, an internal short name, a cross-namespace Service name, and a deliberately nonexistent name.

```bash
kubectl -n app exec deploy/api -- cat /etc/resolv.conf
kubectl -n app exec deploy/api -- getent ahosts api.example.com
kubectl -n app exec deploy/api -- getent ahosts payments.finance
kubectl -n app exec deploy/api -- getent ahosts does-not-exist.example.invalid
```

At the resolver, use the CoreDNS Prometheus plugin's documented counters. [`coredns_dns_requests_total`](https://coredns.io/plugins/metrics/) carries query type and transport labels; `coredns_dns_responses_total` carries `rcode`. The latter makes this a useful before-and-after query:

```promql
sum(rate(coredns_dns_requests_total[5m]))

sum(rate(coredns_dns_responses_total{rcode="NXDOMAIN"}[5m]))
```

Keep the query `type`, `zone`, `server`, and response `rcode` labels in your dashboard when narrowing the investigation. They identify the traffic class more quickly than a cluster-wide total. For a brief diagnostic window, you can also add the CoreDNS [`log` plugin](https://coredns.io/plugins/log/) to the relevant server block, collect a small sample, and remove it. CoreDNS warns that logging on busy servers has a performance cost. Query logs can also expose names, so treat them as incident-scoped instrumentation.

If resolver counters say the problem is upstream of CoreDNS, capture packets from an approved privileged debug environment on the node, for example with [`kubectl debug node/NODE -it --image=IMAGE`](https://kubernetes.io/docs/tasks/debug/debug-cluster/kubectl-node-debug/) using an approved image that ships `tcpdump`, and filter UDP and TCP port 53. Check your cluster's security policy before doing this. The goal is to distinguish client-to-CoreDNS repeats from CoreDNS-to-upstream forwarding, not to leave packet capture running.

For a refresher on what happens after a resolver cache miss, the [DNS Resolution Simulator](/games/dns-simulator) lets you step through browser, OS, and resolver caches, then root, TLD, and authoritative servers, and rerun a lookup to see a cache hit. For the Kubernetes naming side, see [Service Located in Another Namespace](/posts/service-located-in-another-namespace).

## The operating rule

`ndots:5` exists so Kubernetes names work naturally. Its cost is that many normal external names look short enough to search first. Use your query mix to decide whether that cost matters, then change the narrowest layer that solves it:

1. Add a trailing dot to a controlled external hostname if the full HTTP and TLS path accepts it.
2. Test `ndots: "2"` on one workload if its cross-namespace Service names still resolve as expected.
3. Add caching or NodeLocal DNSCache when repeated lookup load or DNS-path reliability needs a cluster-level response.
4. Watch CoreDNS request and NXDOMAIN rates before and after, not just application success rates.

The goal is not the smallest possible `ndots` number. It is fewer accidental DNS queries without breaking the service-discovery names that made `ndots:5` useful in the first place.
