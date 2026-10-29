---
title: 'Firewalls and Network Security: nftables, Segmentation, mTLS'
description: 'Write stateful nftables rules, see drop vs reject from the client side, segment a network into zones, then add mTLS and rate limiting to a proxy in a lab.'
order: 4
---

A firewall decides which packets may pass, based on where they come from, where they go, which protocol and port they use, and whether they belong to a connection that is already allowed. That last part, **connection state**, is what makes modern firewalls usable: you allow the request, and the reply is allowed automatically.

In this part you start from a network with no firewall at all and close it down: first on a single host, then between the network's zones on the router. Along the way you see what a dropped packet and a rejected packet look like from the client, which is how you tell a firewall problem from a dead service. The last sections go above the packet level, with mutual TLS and rate limiting on the load balancer.

## Prerequisites

- A fresh lab from [Part 1](/guides/networking-fundamentals/01-network-fundamentals-and-protocols#h2-build-the-practice-lab): run `sudo ./netlab.sh down && sudo ./netlab.sh up` before you start, because every part changes the lab.
- The addressing from [Part 2](/guides/networking-fundamentals/02-ip-addressing-and-subnetting).
- `nft` from the `nftables` package. Every command here changes only the lab's namespaces.

## NAT Is Not a Firewall

The shop's servers have private addresses behind NAT, so they feel hidden. They are not. Anything that can route packets to the private network reaches them, and `client` can, because its gateway is the lab router:

```terminal
{
  "title": "private addresses, reachable",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "client#",
      "cmd": "curl -s -m 3 http://10.0.2.11:8080/",
      "output": "served by web1 (10.0.2.11)"
    },
    {
      "prompt": "client#",
      "cmd": "nc -zv -w 3 10.0.3.10 5432",
      "output": "Connection to 10.0.3.10 5432 port [tcp/postgresql] succeeded!"
    }
  ]
}
```

On the public internet, ISPs drop packets to private addresses, but plenty of networks can route to yours: a peered VPC, a VPN, a partner link, another machine in the same subnet that an attacker controls. Only a firewall decides what may connect.

## nftables in Five Minutes

On Linux the firewall is part of the kernel (**netfilter**), and **nftables** (`nft`) is its current interface. The tools you may know, `ufw`, `firewalld` and `iptables` (which on current distributions is `iptables-nft`), all write nftables rules underneath.

- A **table** holds chains and belongs to a family: `ip` (IPv4), `ip6`, or `inet` (both, which is what you want for filtering).
- A **chain** with a **hook** sees packets at one point: `input` (to this machine), `output` (from this machine), `forward` (through this machine, as on a router). Its **policy** is what happens to packets that no rule matched.
- **Rules** are checked in order. `drop` ends the packet's journey; `accept` ends only this chain, and another chain on the same hook (one that Docker or firewalld added, for example) can still drop the packet.

Three rules appear in almost every ruleset:

- `ct state established,related accept`: let replies and related packets (such as ICMP errors) through. This is the stateful part, based on the connection tracking table you saw in Part 2.
- `ct state invalid drop`: drop packets that connection tracking cannot place in a valid state, such as a stray ACK for a connection that never started or a malformed header.
- `iif "lo" accept`: never block the machine talking to itself.

## A Host Firewall: Protect the Database

`db` should accept PostgreSQL connections from the app servers only, and ping from anywhere. Write the ruleset to a file so that you can check it before loading it:

```text
#!/usr/sbin/nft -f
# db: only the app subnet may reach PostgreSQL
flush ruleset

table inet filter {
    chain input {
        type filter hook input priority filter; policy drop;

        iif "lo" accept
        ct state established,related accept
        ct state invalid drop
        meta l4proto { icmp, ipv6-icmp } accept

        ip saddr 10.0.2.0/24 tcp dport 5432 accept

        counter comment "everything else"
    }
}
```

```terminal
{
  "title": "check, load and test the db firewall",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "comment": "-c checks the file without changing anything",
      "prompt": "db#",
      "cmd": "nft -c -f /etc/netlab/db-firewall.nft && echo \"syntax ok\"",
      "output": "syntax ok"
    },
    {
      "prompt": "db#",
      "cmd": "nft -f /etc/netlab/db-firewall.nft"
    },
    {
      "comment": "from the app subnet: allowed",
      "prompt": "web1#",
      "cmd": "nc -zv -w 3 db 5432",
      "output": "Connection to db (10.0.3.10) 5432 port [tcp/postgresql] succeeded!"
    },
    {
      "comment": "from the data subnet: dropped",
      "prompt": "ns1#",
      "cmd": "nc -zv -w 3 10.0.3.10 5432",
      "output": "nc: connect to 10.0.3.10 port 5432 (tcp) timed out: Operation now in progress"
    },
    {
      "prompt": "db#",
      "cmd": "nft list chain inet filter input",
      "output": "table inet filter {\n\tchain input {\n\t\ttype filter hook input priority filter; policy drop;\n\t\tiif \"lo\" accept\n\t\tct state established,related accept\n\t\tct state invalid drop\n\t\tmeta l4proto { icmp, ipv6-icmp } accept\n\t\tip saddr 10.0.2.0/24 tcp dport 5432 accept\n\t\tcounter packets 3 bytes 180 comment \"everything else\"\n\t}\n}"
    }
  ]
}
```

`flush ruleset` at the top makes the file complete: loading it replaces everything, and nftables loads the whole file **atomically**, so there is never a moment with half the rules. The `counter` at the end shows how many packets reached the policy, which is the first thing to look at when something is blocked and you do not know why.

## Drop or Reject

The `ns1` test waited 3 seconds and gave up. That is **drop**: the packet disappears and the client hears nothing. The alternative is **reject**: the firewall answers that the connection is not allowed. Change the last rule and try again, then try the ICMP variant that firewalld uses by default:

```terminal
{
  "title": "what the client sees: drop, reject, host-prohibited",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "comment": "drop: silence until the client gives up",
      "prompt": "ns1#",
      "cmd": "time nc -zv -w 3 10.0.3.10 5432",
      "output": "nc: connect to 10.0.3.10 port 5432 (tcp) timed out: Operation now in progress\n\nreal\t0m3.019s\nuser\t0m0.001s\nsys\t0m0.005s"
    },
    {
      "prompt": "db#",
      "cmd": "nft add rule inet filter input reject with tcp reset"
    },
    {
      "comment": "reject with a TCP reset: immediate 'Connection refused'",
      "prompt": "ns1#",
      "cmd": "time nc -zv -w 3 10.0.3.10 5432",
      "output": "nc: connect to 10.0.3.10 port 5432 (tcp) failed: Connection refused\n\nreal\t0m0.003s\nuser\t0m0.000s\nsys\t0m0.003s"
    },
    {
      "comment": "start again from the file, so that the TCP reset rule is gone",
      "prompt": "db#",
      "cmd": "nft -f /etc/netlab/db-firewall.nft"
    },
    {
      "prompt": "db#",
      "cmd": "nft add rule inet filter input reject with icmpx admin-prohibited"
    },
    {
      "comment": "reject with ICMP 'administratively prohibited': looks like a routing error",
      "prompt": "ns1#",
      "cmd": "nc -zv -w 3 10.0.3.10 5432",
      "output": "nc: connect to 10.0.3.10 port 5432 (tcp) failed: No route to host"
    }
  ]
}
```

| Firewall action                      | What the client sees                                                                                 | Good for                                                                                                                        |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `drop`                               | A timeout after the client's own limit (curl and most TCP stacks wait more than a minute by default) | Traffic from the internet: scanners learn nothing, and you send no replies                                                      |
| `reject with tcp reset`              | `Connection refused` at once                                                                         | Internal networks: clients fail fast instead of hanging                                                                         |
| `reject with icmpx admin-prohibited` | `No route to host`                                                                                   | Same, but confusing: firewalld rejects this way by default, so "No route to host" on a host you can ping often means a firewall |

A timeout is the most expensive failure in production, because every caller waits for its full timeout before it can retry or fail over. Inside your own network, rejecting is often kinder than dropping.

## Segment the Network on the Router

A host firewall protects one machine. **Segmentation** puts the rules between zones, so that a compromised web server cannot even try the database's SSH port. The lab already has zones as subnets; the router decides what may cross between them:

```diagram
{
  "type": "graph",
  "columns": [
    [ { "id": "inet", "label": "internet", "sub": "client, remote", "icon": "globe", "tone": "slate" } ],
    [ { "id": "edge", "label": "edge zone", "sub": "lb 10.0.1.0/24", "icon": "server", "tone": "green" } ],
    [ { "id": "app", "label": "app zone", "sub": "web1-3 10.0.2.0/24", "icon": "box", "tone": "blue" } ],
    [ { "id": "data", "label": "data zone", "sub": "db, ns1 10.0.3.0/24", "icon": "database", "tone": "violet" } ]
  ],
  "edges": [
    ["inet", "edge", "80, 443 (DNAT)"],
    ["edge", "app", "8080"],
    ["app", "data", "5432"]
  ]
}
```

Every arrow is one allow rule on the router's `forward` chain; everything else is dropped. Outbound connections to the internet stay allowed for the private zones, so servers can still fetch packages:

```text
#!/usr/sbin/nft -f
# router: what may cross between the zones
table inet filter
delete table inet filter

table inet filter {
    chain forward {
        type filter hook forward priority filter; policy drop;

        ct state established,related accept
        ct state invalid drop

        # internet -> only what the router publishes with DNAT (the shop and its DNS server)
        iifname "br-wan" ct status dnat accept

        # zone to zone: one rule per arrow
        iifname "br-edge" oifname "br-app" tcp dport 8080 accept
        iifname "br-app" oifname "br-data" tcp dport 5432 accept

        # private zones -> internet, and ping inside the private network for troubleshooting
        ip saddr 10.0.0.0/16 oifname "br-wan" accept
        ip saddr 10.0.0.0/16 ip daddr 10.0.0.0/16 icmp type echo-request accept

        counter comment "dropped by policy"
    }
}
```

The first two lines create the table if it does not exist and then delete it, so that the file replaces the table cleanly every time you load it, without touching the router's NAT table.

```terminal
{
  "title": "load the zone rules and test every path",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "router#",
      "cmd": "nft -c -f /etc/netlab/router-filter.nft && nft -f /etc/netlab/router-filter.nft"
    },
    {
      "comment": "the published site still works",
      "prompt": "client#",
      "cmd": "curl -s -m 3 http://www.shop.example/",
      "output": "served by web1 (10.0.2.11)"
    },
    {
      "comment": "the private address does not, any more",
      "prompt": "client#",
      "cmd": "curl -sS -m 3 http://10.0.2.11:8080/",
      "output": "curl: (28) Connection timed out after 3006 milliseconds"
    },
    {
      "comment": "edge -> app on 8080: allowed",
      "prompt": "lb#",
      "cmd": "curl -s -m 3 http://web1:8080/health",
      "output": "ok"
    },
    {
      "comment": "edge -> data: not allowed, not even to PostgreSQL",
      "prompt": "lb#",
      "cmd": "nc -zv -w 3 db 5432",
      "output": "nc: connect to db (10.0.3.10) port 5432 (tcp) timed out: Operation now in progress"
    },
    {
      "comment": "app -> data on 5432: allowed",
      "prompt": "web1#",
      "cmd": "nc -zv -w 3 db 5432",
      "output": "Connection to db (10.0.3.10) 5432 port [tcp/postgresql] succeeded!"
    },
    {
      "comment": "private -> internet: allowed",
      "prompt": "web1#",
      "cmd": "curl -s -m 3 http://203.0.113.20/",
      "output": "served by remote (203.0.113.20)"
    },
    {
      "prompt": "router#",
      "cmd": "nft list chain inet filter forward | grep -E 'counter|policy'",
      "output": "\t\ttype filter hook forward priority filter; policy drop;\n\t\tcounter packets 6 bytes 360 comment \"dropped by policy\""
    }
  ]
}
```

The counter shows the packets that the policy dropped: the retried SYNs of the two blocked tests. In a real network you add `log prefix "fw-drop: "` before the final counter and read the messages with `journalctl -k`, but rate-limit it (`limit rate 10/minute`), because a port scan can write thousands of lines a second.

## The Same Rules with ufw, firewalld and nftables

On a real server you usually use the distribution's front end. These are the `db` rules from above, for the three common tools. Run them on a real server, not in the lab: they change the machine's own firewall and its boot configuration.

:::warning
Allow SSH before you turn on a firewall on a remote server, and keep a second session open while you test. On a cloud server, also check that you have console access, or that the provider's own firewall (security group) lets you back in.
:::

```tabs
{
  "title": "Allow PostgreSQL from the app subnet only",
  "tabs": [
    {
      "label": "ufw (Ubuntu)",
      "lang": "bash",
      "code": "sudo ufw default deny incoming\nsudo ufw default allow outgoing\nsudo ufw allow 22/tcp\nsudo ufw allow from 10.0.2.0/24 to any port 5432 proto tcp\nsudo ufw enable\nsudo ufw status verbose"
    },
    {
      "label": "firewalld (Fedora, RHEL)",
      "lang": "bash",
      "code": "sudo firewall-cmd --permanent --zone=public --add-rich-rule='rule family=\"ipv4\" source address=\"10.0.2.0/24\" port port=\"5432\" protocol=\"tcp\" accept'\nsudo firewall-cmd --reload\nsudo firewall-cmd --zone=public --list-all"
    },
    {
      "label": "nftables (any distribution)",
      "lang": "bash",
      "code": "# put the ruleset in /etc/nftables.conf (the db-firewall.nft file from above, plus SSH),\n# check it, then load it now and at every boot\nsudo nft -c -f /etc/nftables.conf\nsudo systemctl enable --now nftables\nsudo nft list ruleset"
    }
  ]
}
```

Two front-end details cause real outages:

- **Docker bypasses ufw and firewalld for published ports.** `docker run -p 5432:5432` adds its own NAT and forward rules, and the forwarded traffic never passes the `input` chain that ufw manages. Publish on `127.0.0.1:5432:5432` or put rules in Docker's `DOCKER-USER` chain. Part 6 shows what Docker does.
- **IPv6.** A `table ip` ruleset or an iptables-only setup leaves IPv6 open. Use the `inet` family, and make sure ufw has `IPV6=yes` in `/etc/default/ufw` (the default on Ubuntu).

In the cloud, the same rules usually live in the provider's **security groups**, which are stateful firewalls attached to each VM or network interface. Part 7 covers them; most teams use both, the cloud firewall as the outer layer and a host firewall as the inner one.

## Above the Packets: Mutual TLS

A firewall rule like "the app subnet may reach the database" trusts an address. Anything that gets an address in that subnet is trusted too. **Mutual TLS** (mTLS) trusts an identity instead: the server asks the client for a certificate signed by a CA it trusts, and refuses the connection without one. Service meshes (Part 10) do this between every pair of services automatically; here you do it by hand for an admin area.

Create a client certificate from the lab CA. `extendedKeyUsage=clientAuth` marks it as a client certificate:

```terminal
{
  "title": "issue a client certificate",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "$",
      "cmd": "cd /etc/netlab/tls && sudo openssl req -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -subj '/CN=ops-laptop' -keyout ops.key -out ops.csr 2>/dev/null"
    },
    {
      "prompt": "$",
      "cmd": "sudo bash -c 'openssl x509 -req -in ops.csr -CA ca.crt -CAkey ca.key -days 30 -out ops.crt -extfile <(echo extendedKeyUsage=clientAuth)'",
      "output": "Certificate request self-signature ok\nsubject=CN=ops-laptop"
    },
    {
      "prompt": "$",
      "cmd": "openssl x509 -in ops.crt -noout -subject -issuer -ext extendedKeyUsage",
      "output": "subject=CN=ops-laptop\nissuer=CN=netlab CA\nX509v3 Extended Key Usage:\n    TLS Web Client Authentication"
    }
  ]
}
```

## Above the Packets: Rate Limits

Firewalls count packets; they do not know that `/login` is cheap to call and expensive to serve. A reverse proxy can limit requests per client. This version of the lab's nginx config adds both protections: `/admin/` requires a client certificate, and every client gets 5 requests per second with a burst of 10. Replace `/etc/netlab/lb-nginx.conf` with it:

```nginx
# nginx on lb: reverse proxy with mTLS for /admin/ and a per-client rate limit
worker_processes 1;
pid /run/netlab/lb-nginx.pid;
error_log /run/netlab/log/lb-nginx-error.log;

events {
    worker_connections 256;
}

http {
    access_log /run/netlab/log/lb-nginx-access.log;

    # 10 MB of state keyed by client address: about 80,000 clients (128 bytes each on 64-bit)
    limit_req_zone $binary_remote_addr zone=perclient:10m rate=5r/s;
    limit_req_status 429;

    server {
        listen 80;
        listen 443 ssl;
        http2 on;
        server_name www.shop.example shop.example;

        ssl_certificate     /etc/netlab/tls/shop.crt;
        ssl_certificate_key /etc/netlab/tls/shop.key;

        # ask for a client certificate; only /admin/ insists on one
        ssl_client_certificate /etc/netlab/tls/ca.crt;
        ssl_verify_client optional;

        location /admin/ {
            if ($ssl_client_verify != SUCCESS) {
                return 403 "client certificate required\n";
            }
            return 200 "admin area: hello $ssl_client_s_dn\n";
        }

        location / {
            limit_req zone=perclient burst=10 nodelay;
            proxy_pass http://10.0.2.11:8080;
            proxy_set_header Host $host;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

:::note
On Ubuntu 24.04, nginx 1.24 does not know `http2 on;` (it arrived in 1.25.1): delete that line and write `listen 443 ssl http2;` instead. `netlab.sh` makes the same change in its own config on older nginx.
:::

```terminal
{
  "title": "reload nginx, then test mTLS and the rate limit",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "lb#",
      "cmd": "nginx -t -c /etc/netlab/lb-nginx.conf && nginx -c /etc/netlab/lb-nginx.conf -s reload",
      "output": "nginx: the configuration file /etc/netlab/lb-nginx.conf syntax is ok\nnginx: configuration file /etc/netlab/lb-nginx.conf test is successful\n2026/10/27 09:34:49 [notice] 250#250: signal process started"
    },
    {
      "comment": "no client certificate",
      "prompt": "client#",
      "cmd": "curl -s --cacert /etc/netlab/tls/ca.crt https://www.shop.example/admin/",
      "output": "client certificate required"
    },
    {
      "comment": "with the certificate and its key",
      "prompt": "client#",
      "cmd": "curl -s --cacert /etc/netlab/tls/ca.crt --cert /etc/netlab/tls/ops.crt --key /etc/netlab/tls/ops.key https://www.shop.example/admin/",
      "output": "admin area: hello CN=ops-laptop"
    },
    {
      "comment": "30 requests as fast as possible: count the status codes",
      "prompt": "client#",
      "cmd": "for i in $(seq 30); do curl -s -o /dev/null -w '%{http_code}\\n' http://www.shop.example/; done | sort | uniq -c",
      "output": "     14 200\n     16 429"
    }
  ]
}
```

Eleven requests pass at once (one at the rate plus the burst of 10), a few more pass because the bucket refills at 5 per second while the loop runs, and the rest get `429 Too Many Requests`. Return 429 rather than nginx's default 503, so that clients and dashboards can tell "slow down" from "broken". Limit by API key or user ID instead of address when many users share one address behind NAT, and keep the limits in the application too if it is ever reachable without the proxy.

## Common Mistakes

- **Locking yourself out.** Allow SSH first and keep a second session open. On remote machines, save the current rules and schedule their restore before you change anything, with a timer that survives a dropped SSH session: `{ echo 'flush ruleset'; nft list ruleset; } > /root/rules.before` and `systemd-run --on-active=120 --unit=fw-rollback /usr/sbin/nft -f /root/rules.before`, then cancel it with `systemctl stop fw-rollback.timer` once the new rules work. Part 9 wraps this in a script.
- **Allow rules that are too broad.** `ip saddr 10.0.0.0/8 accept` trusts every internal network, including the ones you have not built yet. Name the source subnet and the port.
- **Filtering only inbound traffic.** Malware and data leaks go outbound. On sensitive hosts, restrict `output` to the destinations the service needs.
- **Relying on NAT or on "nobody knows the address".** Scanners find every public address within minutes, and private networks are only as private as their routes.
- **Forgetting IPv6 and Docker.** Use the `inet` family, and remember that Docker's published ports skip ufw.
- **No counters, no logs.** When a connection fails, you need to know which rule dropped it. Count and log the final drop, with a rate limit.

## Summary

- nftables tables hold chains on hooks (`input`, `forward`, `output`); rules match in order, the policy catches the rest, and `ct state established,related accept` makes it stateful.
- Check rulesets with `nft -c -f` and load them from files; a file is applied atomically.
- Drop means a timeout for the client, reject means an instant error; "No route to host" from a reachable host often means an ICMP reject.
- Segment zones on the router or in the cloud, one allow rule per required path, and keep host firewalls as a second layer.
- mTLS authenticates services by certificate, and a proxy's rate limits protect expensive endpoints; both work above the packet level.

Next, [Part 5](/guides/networking-fundamentals/05-load-balancing) spreads the shop's traffic over all three web servers.

## Keep Learning

- [Network & Security Fundamentals quiz](/quizzes/network-security-quiz)
- Simulators: [rate limiting](/games/rate-limit-simulator), [DDoS](/games/ddos-simulator)
- [How to artificially create a connection timeout](/posts/how-to-artificially-create-connection-timeout-error)
- [We put localhost on the internet and watched who turned up](/posts/what-happens-when-you-put-localhost-on-the-internet)
- The [Security Principles](/guides/security-principles) guide for defence in depth and least privilege
