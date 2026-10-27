---
title: 'Load Balancing: nginx, HAProxy, Health Checks and Failover'
description: "Load balance three servers with nginx and HAProxy, compare algorithms, see health checks handle dead and hung servers, and keep the client's IP address."
order: 5
---

One server is one failure away from an outage, and one deploy away from downtime. A **load balancer** sits in front of several servers, sends each request to one of them, and stops sending traffic to servers that fail. That gives you capacity (add servers to handle more traffic), availability (lose a server, keep the service) and safe deploys (take servers out one at a time).

In this part you turn the lab's reverse proxy into a load balancer for `web1`, `web2` and `web3`, first with nginx and then with HAProxy. You break servers on purpose, in the two ways real servers break: dead (connections refused) and hung (no answer), and watch how each load balancer copes.

## Prerequisites

- A fresh lab from [Part 1](/guides/networking-fundamentals/01-network-fundamentals-and-protocols#h2-build-the-practice-lab): run `sudo ./netlab.sh down && sudo ./netlab.sh up` before you start, because every part changes the lab. The three app servers listen on port 8080 and answer `/health` with `ok`.
- HTTP basics and TLS from Part 1.

## Layer 4 and Layer 7

Load balancers work at one of two layers, named after the OSI model:

|              | Layer 4 (transport)                                              | Layer 7 (application)                             |
| ------------ | ---------------------------------------------------------------- | ------------------------------------------------- |
| Sees         | Addresses and ports of TCP or UDP connections                    | HTTP requests: method, path, headers, cookies     |
| Balances     | Whole connections                                                | Individual requests (several per connection)      |
| Can route by | Port, source address                                             | Path, host name, header, cookie                   |
| TLS          | Passes it through, or terminates it                              | Terminates it (needs the certificate)             |
| Examples     | HAProxy `mode tcp`, nginx `stream`, AWS NLB, Kubernetes Services | nginx `http`, HAProxy `mode http`, Envoy, AWS ALB |

Use layer 4 for databases, message brokers and anything that is not HTTP, or when the backend must see the TLS session. Use layer 7 for web traffic: it can retry a failed request on another server, route `/api` and `/static` to different pools, and add headers.

## nginx as a Load Balancer

Replace the lab's nginx config with this version. The `upstream` block lists the servers; `proxy_pass` sends requests to the group instead of a single address:

```nginx
# nginx on lb: load balancing over web1, web2 and web3
worker_processes 1;
pid /run/netlab/lb-nginx.pid;
error_log /run/netlab/log/lb-nginx-error.log;

events {
    worker_connections 256;
}

http {
    access_log /run/netlab/log/lb-nginx-access.log;

    upstream app {
        # after 2 failures, skip the server for 10 s
        server 10.0.2.11:8080 max_fails=2 fail_timeout=10s;
        server 10.0.2.12:8080 max_fails=2 fail_timeout=10s;
        server 10.0.2.13:8080 max_fails=2 fail_timeout=10s;
        # reuse up to 16 idle connections to the servers
        keepalive 16;
    }

    server {
        listen 80;
        listen 443 ssl;
        http2 on;
        server_name www.shop.example shop.example;

        ssl_certificate     /etc/netlab/tls/shop.crt;
        ssl_certificate_key /etc/netlab/tls/shop.key;

        location / {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Connection "";
            proxy_set_header Host $host;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            proxy_connect_timeout 2s;
            proxy_read_timeout 10s;
            # on a connection error or timeout, try the next server, at most twice in total
            proxy_next_upstream error timeout;
            proxy_next_upstream_tries 2;
        }

        location = /nginx_status {
            stub_status;
            allow 127.0.0.1;
            deny all;
        }
    }
}
```

:::note
On Ubuntu 24.04 (nginx 1.24), replace `listen 443 ssl;` and `http2 on;` with the single line `listen 443 ssl http2;`, as in Part 4.
:::

```terminal
{
  "title": "reload and send six requests",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "lb#",
      "cmd": "nginx -t -c /etc/netlab/lb-nginx.conf && nginx -c /etc/netlab/lb-nginx.conf -s reload",
      "output": "nginx: the configuration file /etc/netlab/lb-nginx.conf syntax is ok\nnginx: configuration file /etc/netlab/lb-nginx.conf test is successful\n2026/10/27 09:44:42 [notice] 178#178: signal process started"
    },
    {
      "prompt": "client#",
      "cmd": "for i in 1 2 3 4 5 6; do curl -s http://www.shop.example/; done",
      "output": "served by web1 (10.0.2.11)\nserved by web2 (10.0.2.12)\nserved by web3 (10.0.2.13)\nserved by web1 (10.0.2.11)\nserved by web2 (10.0.2.12)\nserved by web3 (10.0.2.13)"
    }
  ]
}
```

The default algorithm is **round robin**: each request goes to the next server in turn. `proxy_http_version 1.1` with an empty `Connection` header lets the `keepalive` pool reuse connections to the servers, which saves a TCP handshake per request, the same cost you measured in Part 1.

## Choosing an Algorithm

nginx and HAProxy offer the same handful of algorithms. Each is one line in the `upstream` block (nginx) or a `balance` line (HAProxy):

| Algorithm                | nginx                           | HAProxy                                   | Use it when                                                                      |
| ------------------------ | ------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------- |
| Round robin              | (default)                       | `balance roundrobin`                      | Requests cost about the same; the usual choice                                   |
| Weighted                 | `server ... weight=3`           | `server ... weight 3`                     | Servers differ in size, or for a canary with a small share                       |
| Least connections        | `least_conn;`                   | `balance leastconn`                       | Requests vary a lot in duration (uploads, reports, WebSockets)                   |
| Client address hash      | `ip_hash;`                      | `balance source`                          | A client should stick to one server without cookies                              |
| Consistent hash on a key | `hash $request_uri consistent;` | `balance uri` with `hash-type consistent` | Caches: the same key goes to the same server, and adding a server moves few keys |

Weights are easy to see. Give `web1` three times the share:

```terminal
{
  "title": "weights: web1 gets 3 of every 5 requests",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "lb#",
      "cmd": "sed -i 's/server 10.0.2.11:8080 max_fails/server 10.0.2.11:8080 weight=3 max_fails/' /etc/netlab/lb-nginx.conf"
    },
    {
      "prompt": "lb#",
      "cmd": "nginx -t -q -c /etc/netlab/lb-nginx.conf && nginx -c /etc/netlab/lb-nginx.conf -s reload",
      "output": "2026/10/27 09:44:44 [notice] 203#203: signal process started"
    },
    {
      "prompt": "client#",
      "cmd": "for i in $(seq 20); do curl -s http://www.shop.example/; done | sort | uniq -c",
      "output": "     12 served by web1 (10.0.2.11)\n      4 served by web2 (10.0.2.12)\n      4 served by web3 (10.0.2.13)"
    }
  ]
}
```

The post [hash rings in nginx, HAProxy and Envoy](/posts/hash-ring-points-nginx-haproxy-envoy) shows how consistent hashing spreads keys and what it costs in memory.

## When a Server Dies

Stop the app on `web2`. Its port now refuses connections, the cleanest failure there is:

```terminal
{
  "title": "a dead server: refused connections",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "web2#",
      "cmd": "pkill -f 'app.py http web2'"
    },
    {
      "prompt": "client#",
      "cmd": "for i in 1 2 3 4 5 6; do curl -s -o /dev/null -w '%{http_code} %{time_total}s\\n' http://www.shop.example/; done",
      "output": "200 0.003531s\n200 0.003402s\n200 0.045726s\n200 0.004521s\n200 0.002892s\n200 0.002633s"
    },
    {
      "prompt": "lb#",
      "cmd": "grep -o 'connect() failed.*upstream: \"[^\"]*\"' /run/netlab/log/lb-nginx-error.log",
      "output": "connect() failed (111: Connection refused) while connecting to upstream, client: 203.0.113.10, server: www.shop.example, request: \"GET / HTTP/1.1\", upstream: \"http://10.0.2.12:8080/\"\nconnect() failed (111: Connection refused) while connecting to upstream, client: 203.0.113.10, server: www.shop.example, request: \"GET / HTTP/1.1\", upstream: \"http://10.0.2.12:8080/\""
    }
  ]
}
```

Every request still succeeded, quickly. nginx got `Connection refused` from `web2`, retried the request on the next server (`proxy_next_upstream error`), and after two failures (`max_fails=2`) stopped sending traffic to `web2` for 10 seconds (`fail_timeout`). Then it tries `web2` again with one real request. This is a **passive health check**: nginx learns about failures from real traffic. Open-source nginx has no active health checks; they are part of the commercial NGINX Plus.

Bring `web2` back, and break `web3` the nasty way: it stops answering, as a server does when it is overloaded, paused for garbage collection or cut off by a firewall. A firewall rule that drops its traffic does the job:

```terminal
{
  "title": "a hung server: packets disappear",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "web2#",
      "cmd": "python3 /etc/netlab/app.py http web2 8080 >> /run/netlab/log/web2-app.log 2>&1 &"
    },
    {
      "prompt": "web3#",
      "cmd": "nft add table inet hang && nft add chain inet hang input '{ type filter hook input priority 0; }' && nft add rule inet hang input tcp dport 8080 drop"
    },
    {
      "prompt": "client#",
      "cmd": "for i in 1 2 3 4 5 6; do curl -s -o /dev/null -w '%{http_code} %{time_total}s\\n' http://www.shop.example/; done",
      "output": "200 10.038568s\n200 0.003791s\n200 0.006072s\n200 2.013501s\n200 0.002407s\n200 0.002362s"
    },
    {
      "comment": "remove the drop rule again before you go on",
      "prompt": "web3#",
      "cmd": "nft delete table inet hang"
    }
  ]
}
```

Every request still got a 200, but two of them were slow, for two different reasons:

- The first request took 10 seconds. nginx had an idle **keepalive** connection to `web3` from earlier, sent the request over it, and waited for the response until `proxy_read_timeout` (10 seconds) ran out. Only then did it retry on another server.
- A later request took 2 seconds: nginx opened a new connection to `web3` and gave up after `proxy_connect_timeout`.

After those two failures `web3` was skipped for 10 seconds, and every request was fast again, until the next request that tests `web3` pays the price once more. A hung server is far more expensive than a dead one. Three lessons:

- **Set short connect timeouts** between the load balancer and servers on the same network: they connect in milliseconds, so 1 to 2 seconds is plenty. nginx's default `proxy_connect_timeout` is 60 seconds.
- **Set the read timeout from the longest time your app legitimately stays silent.** `proxy_read_timeout` is the limit between two reads from the server, not for the whole response: a server that sends a byte now and then keeps a request open as long as it likes, so long-running requests still need a deadline in the application or the client. The default is also 60 seconds.
- **Use active health checks** where you can, so that real users do not pay for discovering a broken server.

## HAProxy with Active Health Checks

HAProxy checks every server on its own schedule, whether traffic flows or not. This config balances HTTP on port 8081 with a check of `/health` every second, and adds a layer 4 proxy on port 5433 for the database:

```text
# HAProxy on lb: HTTP with active health checks, and a TCP proxy for the database
global
    stats socket /run/netlab/haproxy.sock mode 600 level admin

defaults
    mode http
    timeout connect 2s
    timeout client 30s
    timeout server 30s

frontend shop
    bind :8081
    default_backend app

backend app
    balance roundrobin
    option httpchk
    http-check send meth GET uri /health
    http-check expect status 200
    # check every second; 2 failures mark a server DOWN, 2 successes mark it UP
    default-server inter 1s fall 2 rise 2
    server web1 10.0.2.11:8080 check
    server web2 10.0.2.12:8080 check
    server web3 10.0.2.13:8080 check

frontend postgres
    mode tcp
    bind :5433
    default_backend db

backend db
    mode tcp
    server db1 10.0.3.10:5432 check
```

Check the file, start HAProxy in the foreground in a second terminal (it prints health changes there), and use its **runtime API** on the stats socket to see each server's state:

```terminal
{
  "title": "check the config, start HAProxy, read its state",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "comment": "-c checks the file; -V prints the result (3.x is silent on success otherwise)",
      "prompt": "lb#",
      "cmd": "haproxy -c -V -f /etc/netlab/lb-haproxy.cfg",
      "output": "Configuration file is valid"
    },
    {
      "comment": "in a second terminal: HAProxy stays in the foreground",
      "prompt": "lb#",
      "cmd": "haproxy -f /etc/netlab/lb-haproxy.cfg"
    },
    {
      "prompt": "lb#",
      "cmd": "for i in 1 2 3; do curl -s http://127.0.0.1:8081/; done",
      "output": "served by web1 (10.0.2.11)\nserved by web2 (10.0.2.12)\nserved by web3 (10.0.2.13)"
    },
    {
      "comment": "proxy, server, sessions total, status, last check",
      "prompt": "lb#",
      "cmd": "echo \"show stat\" | nc -U /run/netlab/haproxy.sock | cut -d, -f1,2,8,18,37 | grep -v -E '^(shop|postgres|stats),'",
      "output": "# pxname,svname,stot,status,check_status\napp,web1,1,UP,L7OK\napp,web2,1,UP,L7OK\napp,web3,1,UP,L7OK\napp,BACKEND,3,UP,\ndb,db1,0,UP,L4OK\ndb,BACKEND,0,UP,"
    },
    {
      "comment": "layer 4: HAProxy relays the TCP stream without reading it",
      "prompt": "lb#",
      "cmd": "nc -w 2 127.0.0.1 5433",
      "output": "db: ready"
    }
  ]
}
```

Now kill `web3`'s app and watch the second terminal:

```terminal
{
  "title": "web3 dies, HAProxy notices, web3 comes back",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "web3#",
      "cmd": "pkill -f 'app.py http web3'"
    },
    {
      "comment": "wait (at most 10 s) until HAProxy has marked web3 DOWN",
      "prompt": "lb#",
      "cmd": "for i in $(seq 20); do echo \"show stat\" | nc -U /run/netlab/haproxy.sock | grep -q '^app,web3,.*,DOWN,' && break; sleep 0.5; done"
    },
    {
      "prompt": "lb#",
      "cmd": "for i in 1 2 3 4; do curl -s http://127.0.0.1:8081/; done",
      "output": "served by web1 (10.0.2.11)\nserved by web2 (10.0.2.12)\nserved by web1 (10.0.2.11)\nserved by web2 (10.0.2.12)"
    },
    {
      "prompt": "web3#",
      "cmd": "python3 /etc/netlab/app.py http web3 8080 >> /run/netlab/log/web3-app.log 2>&1 &"
    }
  ]
}
```

```terminal
{
  "title": "meanwhile, in HAProxy's terminal",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "comment": "the messages HAProxy printed (process IDs removed)",
      "prompt": "lb#",
      "cmd": "haproxy -f /etc/netlab/lb-haproxy.cfg",
      "output": "[WARNING] Server app/web3 is DOWN, reason: Layer4 connection problem, info: \"Connection refused\", check duration: 0ms. 2 active and 0 backup servers left. 0 sessions active, 0 requeued, 0 remaining in queue.\n[WARNING] Server app/web3 is UP, reason: Layer7 check passed, code: 200, check duration: 2ms. 3 active and 0 backup servers online. 0 sessions requeued, 0 total in queue."
    }
  ]
}
```

HAProxy marked `web3` DOWN within two seconds of the crash (two failed checks at one-second intervals), before any user request touched it, and sent all four requests to `web1` and `web2`. When the app came back, two good checks marked it UP again. Health checks have their own trade-offs: checks every second from many load balancers add load, and a check that is too strict takes healthy servers out of rotation.

## Keep the Client's Address

Behind a proxy, the server's TCP connection comes from the proxy. The original client address travels in the `X-Forwarded-For` header, which nginx sets with `$proxy_add_x_forwarded_for`. The lab app logs it:

```terminal
{
  "title": "the client address, and a forged one",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "client#",
      "cmd": "curl -s http://www.shop.example/plain > /dev/null"
    },
    {
      "comment": "anyone can send the header themselves",
      "prompt": "client#",
      "cmd": "curl -s -H 'X-Forwarded-For: 192.0.2.66' http://www.shop.example/forged > /dev/null"
    },
    {
      "comment": "what the load balancer saw",
      "prompt": "$",
      "cmd": "sudo grep -h -E 'GET /(plain|forged)' /run/netlab/log/lb-nginx-access.log",
      "output": "203.0.113.10 - - [27/Oct/2026:09:45:19 +0000] \"GET /plain HTTP/1.1\" 200 27 \"-\" \"curl/8.18.0\"\n203.0.113.10 - - [27/Oct/2026:09:45:19 +0000] \"GET /forged HTTP/1.1\" 200 27 \"-\" \"curl/8.18.0\""
    },
    {
      "comment": "what the app servers saw (round robin picked two of them)",
      "prompt": "$",
      "cmd": "sudo grep -h -E 'GET /(plain|forged)' /run/netlab/log/web*-app.log",
      "output": "10.0.1.10 xff=203.0.113.10 \"GET /plain HTTP/1.1\" 200 -\n10.0.1.10 xff=192.0.2.66, 203.0.113.10 \"GET /forged HTTP/1.1\" 200 -"
    }
  ]
}
```

The load balancer saw the real TCP peer, `203.0.113.10`. The app servers see `10.0.1.10`, the load balancer, as their peer; the real client is in `xff=`. nginx appends the address it saw to whatever the client sent, so the forged request arrives as `192.0.2.66, 203.0.113.10`. Only the **rightmost** entries, added by proxies you run, can be trusted. Code that takes the first entry of `X-Forwarded-For` for rate limits or audit logs is trivial to fool. Configure your framework with the proxies it may trust, or have the edge proxy overwrite the header instead of appending to it. In nginx (behind another proxy) that is `real_ip_header X-Forwarded-For;` plus one `set_real_ip_from` line per trusted proxy address or range, and `real_ip_recursive on;` to skip all trusted entries from the right; nginx trusts addresses, not a count of hops.

For layer 4 balancing there is no HTTP header to add. The **PROXY protocol** (HAProxy's `send-proxy`, nginx's `proxy_protocol`, the `proxy_protocol_v2` option of AWS NLB target groups) puts the client address in front of the TCP stream instead; the backend must be configured to expect it.

## Sessions and Stickiness

If the app keeps sessions in memory, a user who lands on another server is logged out. You can make the load balancer **sticky** (`ip_hash`, or a cookie with HAProxy's `cookie SERVERID insert`), but stickiness fights the load balancer: one server collects the heavy users, and a failed server still logs out everyone stuck to it. The better fix is to keep sessions out of the servers, in a shared store such as Redis or Valkey, or in signed cookies or tokens, so that any server can serve any request.

## Beyond One Load Balancer

The load balancer is now the single point of failure. The usual answers:

- **Managed cloud load balancers** (AWS ALB and NLB, Google Cloud Load Balancing, Azure Load Balancer, DigitalOcean Load Balancers) run redundantly across zones for you. Kubernetes Services of type `LoadBalancer` create one.
- **Two load balancers with a floating address**: keepalived moves a virtual IP between two machines with VRRP when one fails.
- **DNS across regions**: several A records, or health-checked DNS (Route 53 failover and latency routing, Cloudflare Load Balancing) that stops returning an unhealthy region's address. Failover is only as fast as the record's TTL (Part 3).
- **Anycast**: the same address is announced from many locations, and the internet's routing delivers each user to the nearest one. CDNs and public DNS resolvers such as `1.1.1.1` work this way.

Databases are different: you cannot spread writes over replicas with round robin. A primary takes the writes, replicas serve reads, and a tool such as Patroni handles failover and tells HAProxy which node is the primary (through its REST API). The [Introduction to PostgreSQL](/guides/introduction-to-postgres) guide covers replication.

## Watch the Load Balancer

nginx's `stub_status` page gives connection counts, and HAProxy's `show stat` gives everything per server. Most monitoring systems scrape one of the two:

```terminal
{
  "title": "nginx stub_status",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "lb#",
      "cmd": "curl -s http://127.0.0.1/nginx_status",
      "output": "Active connections: 1\nserver accepts handled requests\n 43 43 43\nReading: 0 Writing: 1 Waiting: 0"
    }
  ]
}
```

The numbers worth alerting on: the rate of 5xx responses from the load balancer itself, upstream response time (p95 and p99, not the average), servers marked down, and active connections close to `worker_connections`.

## Common Mistakes

- **Health checks that test the whole world.** A `/health` that also checks the database turns a database blip into "every server is down", and the load balancer stops serving even the pages that did not need the database. Keep the load balancer's check about the server itself and the dependencies it cannot work without, and report optional ones separately. Kubernetes makes the same split with two probes: a failed liveness probe restarts the container, and a failed readiness probe only takes the pod out of its Service until it recovers, so dependency checks belong in readiness, never in liveness.
- **Default timeouts.** 60-second connect timeouts turn one hung server into minutes of waiting. Set connect, read and client timeouts on purpose.
- **Retrying requests that are not safe to repeat.** Once nginx has sent a POST or another non-idempotent request to a server, it does not retry it on another server unless you add `non_idempotent` (a request that failed while connecting was never sent, so it is retried). Keep it that way unless the app de-duplicates requests.
- **Trusting `X-Forwarded-For` blindly**, or losing the client address entirely behind a layer 4 balancer.
- **Forgetting that the load balancer needs capacity too**: file descriptors, `worker_connections`, and source ports to the backends (one machine can open at most about 28,000 connections to one backend address and port with the default ephemeral range).

## Summary

- Layer 4 balancers move connections; layer 7 balancers understand requests and can route, retry and add headers.
- Round robin is the default; use weights for uneven servers or canaries, least connections for uneven requests, and consistent hashing for caches.
- Passive checks learn from failed requests; active checks find failures before users do. Hung servers cost much more than dead ones, so keep connect timeouts short.
- Pass the client address with `X-Forwarded-For` (trust only your own proxies' entries) or the PROXY protocol.
- Make the load balancer itself redundant with managed load balancers, VRRP, health-checked DNS or anycast.

Next, [Part 6](/guides/networking-fundamentals/06-container-networking) shows how Docker and Kubernetes build all of this, addresses, NAT and load balancing, for containers.

## Keep Learning

- [Load balancer simulator](/games/load-balancer-simulator) and [latency percentiles simulator](/games/latency-percentiles-simulator)
- Exercise: [nginx load balancing and reverse proxy](/exercises/nginx-load-balancing-reverse-proxy)
- [Cloudflare freed 100 TB of RAM from its hash rings](/posts/hash-ring-points-nginx-haproxy-envoy)
- [Introduction to AWS: load balancing](/guides/introduction-to-aws/07-load-balancing)
