---
title: 'DNS Explained: Records, TTLs, Caching and Troubleshooting'
description: 'How DNS resolution works from the root down: run a DNS server and a resolver, read each record type, watch TTL caching, and debug NXDOMAIN and SERVFAIL.'
order: 3
---

DNS turns names into addresses, and almost every request your software makes starts with it. When DNS breaks, the symptoms are confusing: one server reaches the database and another does not, a migration "has not propagated", a deploy works for some users only. Nearly all of these come down to three ideas: who is **authoritative** for a name, who **resolves** it for you, and how long the answer is **cached**.

In this part you trace a real lookup from the root servers down, then use the lab's own DNS: an authoritative server, `ns1`, and a caching resolver on the router. You read every common record type, change a record and watch the old answer live on in the cache, and produce each DNS error on purpose.

## Prerequisites

- A fresh lab from [Part 1](/guides/networking-fundamentals/01-network-fundamentals-and-protocols#h2-build-the-practice-lab): run `sudo ./netlab.sh down && sudo ./netlab.sh up` before you start, because every part changes the lab.
- `dig`, from the `bind9-dnsutils` package (`dnsutils` on older Debian and Ubuntu releases). On macOS it is preinstalled; on Windows use `Resolve-DnsName` in PowerShell.

## How a Name Is Resolved

Four kinds of servers take part in a lookup:

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Your app", "sub": "getaddrinfo()", "icon": "box", "tone": "blue" },
    { "label": "Stub resolver", "sub": "/etc/resolv.conf, systemd-resolved", "icon": "cpu", "tone": "slate" },
    { "label": "Recursive resolver", "sub": "ISP, 1.1.1.1, VPC resolver; caches", "icon": "gear", "tone": "amber" },
    { "label": "Root, TLD", "sub": "who handles .com?", "icon": "globe", "tone": "slate" },
    { "label": "Authoritative", "sub": "the zone's own servers", "icon": "database", "tone": "green" }
  ]
}
```

1. Your application asks the **stub resolver** in the operating system, which checks `/etc/hosts` and a local cache, then forwards the question.
2. A **recursive resolver** (your ISP's, a public one such as `1.1.1.1` or `8.8.8.8`, or the cloud's resolver inside a VPC) does the real work and caches the result.
3. If it has nothing cached, it asks a **root server**, which refers it to the servers for the top-level domain (`.com`).
4. The `.com` servers refer it to the domain's **authoritative** name servers, which hold the actual records and give the final answer.

`dig +trace` does the resolver's job itself and prints every referral. Here it follows `devops-daily.com` from the root:

```terminal
{
  "title": "a lookup from the root down (real internet)",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "dig -4 +trace +nodnssec devops-daily.com",
      "output": "; <<>> DiG 9.20.24-1ubuntu0.4-Ubuntu <<>> -4 +trace +nodnssec devops-daily.com\n;; global options: +cmd\n.\t\t\t515248\tIN\tNS\ta.root-servers.net.\n.\t\t\t515248\tIN\tNS\tb.root-servers.net.\n.\t\t\t515248\tIN\tNS\tc.root-servers.net.\n.\t\t\t515248\tIN\tNS\td.root-servers.net.\n.\t\t\t515248\tIN\tNS\te.root-servers.net.\n.\t\t\t515248\tIN\tNS\tf.root-servers.net.\n.\t\t\t515248\tIN\tNS\tg.root-servers.net.\n.\t\t\t515248\tIN\tNS\th.root-servers.net.\n.\t\t\t515248\tIN\tNS\ti.root-servers.net.\n.\t\t\t515248\tIN\tNS\tj.root-servers.net.\n.\t\t\t515248\tIN\tNS\tk.root-servers.net.\n.\t\t\t515248\tIN\tNS\tl.root-servers.net.\n.\t\t\t515248\tIN\tNS\tm.root-servers.net.\n;; Received 239 bytes from 1.1.1.1#53(1.1.1.1) in 3 ms\n\ncom.\t\t\t172800\tIN\tNS\ta.gtld-servers.net.\ncom.\t\t\t172800\tIN\tNS\tb.gtld-servers.net.\ncom.\t\t\t172800\tIN\tNS\tc.gtld-servers.net.\ncom.\t\t\t172800\tIN\tNS\td.gtld-servers.net.\ncom.\t\t\t172800\tIN\tNS\te.gtld-servers.net.\ncom.\t\t\t172800\tIN\tNS\tf.gtld-servers.net.\ncom.\t\t\t172800\tIN\tNS\tg.gtld-servers.net.\ncom.\t\t\t172800\tIN\tNS\th.gtld-servers.net.\ncom.\t\t\t172800\tIN\tNS\ti.gtld-servers.net.\ncom.\t\t\t172800\tIN\tNS\tj.gtld-servers.net.\ncom.\t\t\t172800\tIN\tNS\tk.gtld-servers.net.\ncom.\t\t\t172800\tIN\tNS\tl.gtld-servers.net.\ncom.\t\t\t172800\tIN\tNS\tm.gtld-servers.net.\n;; Received 841 bytes from 192.5.5.241#53(f.root-servers.net) in 3 ms\n\ndevops-daily.com.\t172800\tIN\tNS\tjeff.ns.cloudflare.com.\ndevops-daily.com.\t172800\tIN\tNS\tvera.ns.cloudflare.com.\n;; Received 361 bytes from 192.35.51.30#53(f.gtld-servers.net) in 51 ms\n\ndevops-daily.com.\t300\tIN\tA\t172.67.146.8\ndevops-daily.com.\t300\tIN\tA\t104.21.95.163\n;; Received 77 bytes from 173.245.58.147#53(vera.ns.cloudflare.com) in 7 ms"
    }
  ]
}
```

Each block is one referral: the 13 root server names, the `.com` servers (`gtld-servers.net`), then the two Cloudflare servers that are authoritative for the domain, and finally the `A` records from one of them. The second number on each line is the **TTL** in seconds: how long a resolver may cache that answer. Referrals near the top are cached for days, which is why most lookups never reach the root.

## The Lab's DNS

The lab runs both sides of DNS:

- **ns1** (`10.0.3.53`, published as `203.0.113.53`) runs BIND and is authoritative for `shop.example` (public names) and `shop.internal` (private names). It does no recursion.
- The **router** runs Unbound, the recursive, caching resolver that every lab host uses. It asks `ns1` for the lab zones.

A zone is a text file. This is the public one:

```terminal
{
  "title": "the shop.example zone on ns1",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "ns1#",
      "cmd": "cat /etc/bind/netlab/db.shop.example",
      "output": "; shop.example: the public names\n$TTL 300\n@        IN SOA   ns1.shop.example. hostmaster.shop.example. (\n                  2026102701 ; serial\n                  3600       ; refresh\n                  600        ; retry\n                  604800     ; expire\n                  60 )       ; negative caching TTL\n         IN NS    ns1.shop.example.\n         IN A     203.0.113.80\n         IN MX    10 mail.shop.example.\n         IN TXT   \"v=spf1 mx -all\"\n         IN CAA   0 issue \"letsencrypt.org\"\nns1      IN A     203.0.113.53\nwww      IN CNAME shop.example.\nmail     IN A     203.0.113.25"
    },
    {
      "prompt": "ns1#",
      "cmd": "named-checkzone shop.example /etc/bind/netlab/db.shop.example",
      "output": "zone shop.example/IN: loaded serial 2026102701\nOK"
    }
  ]
}
```

- `$TTL 300` sets the default TTL: 5 minutes.
- `@` means the zone's own name, `shop.example`. A name without a trailing dot (`www`) is relative to the zone; `mail.shop.example.` with the trailing dot is absolute. Forgetting that dot is a classic zone file bug: `ns1.shop.example` without it becomes `ns1.shop.example.shop.example`.
- The **SOA** record holds the zone's metadata. The **serial** must increase on every change, or secondary servers ignore the update. The last number is the **negative caching TTL**: how long resolvers remember that a name does not exist.
- `named-checkzone` validates the file before you load it. Run it every time.

## Record Types

Ask the authoritative server directly with `@server`. `+noall +answer` prints just the answer lines:

```terminal
{
  "title": "the common record types",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "comment": "A: a name to an IPv4 address (AAAA is the same for IPv6)",
      "prompt": "client#",
      "cmd": "dig @203.0.113.53 +noall +answer shop.example A",
      "output": "shop.example.\t\t300\tIN\tA\t203.0.113.80"
    },
    {
      "comment": "CNAME: an alias; the resolver follows it to the target's records",
      "prompt": "client#",
      "cmd": "dig @203.0.113.53 +noall +answer www.shop.example",
      "output": "www.shop.example.\t300\tIN\tCNAME\tshop.example.\nshop.example.\t\t300\tIN\tA\t203.0.113.80"
    },
    {
      "comment": "MX: mail servers, lowest number first",
      "prompt": "client#",
      "cmd": "dig @203.0.113.53 +noall +answer shop.example MX",
      "output": "shop.example.\t\t300\tIN\tMX\t10 mail.shop.example."
    },
    {
      "comment": "TXT: free text; SPF, DKIM, DMARC and domain verification live here",
      "prompt": "client#",
      "cmd": "dig @203.0.113.53 +noall +answer shop.example TXT",
      "output": "shop.example.\t\t300\tIN\tTXT\t\"v=spf1 mx -all\""
    },
    {
      "comment": "CAA: which certificate authorities may issue certificates for the domain",
      "prompt": "client#",
      "cmd": "dig @203.0.113.53 +noall +answer shop.example CAA",
      "output": "shop.example.\t\t300\tIN\tCAA\t0 issue \"letsencrypt.org\""
    },
    {
      "comment": "NS and SOA: who is authoritative, and the zone's metadata",
      "prompt": "client#",
      "cmd": "dig @203.0.113.53 +noall +answer shop.example NS",
      "output": "shop.example.\t\t300\tIN\tNS\tns1.shop.example."
    },
    {
      "comment": "SRV: host and port of a service (private zone, so ask from inside)",
      "prompt": "web1#",
      "cmd": "dig +noall +answer _postgresql._tcp.shop.internal SRV",
      "output": "_postgresql._tcp.shop.internal.\t60 IN\tSRV\t0 0 5432 db.shop.internal."
    },
    {
      "comment": "PTR: reverse lookup, from an address back to a name",
      "prompt": "web1#",
      "cmd": "dig +noall +answer -x 10.0.3.10",
      "output": "10.3.0.10.in-addr.arpa.\t60\tIN\tPTR\tdb.shop.internal."
    }
  ]
}
```

| Type        | Maps                          | Notes                                                                                                                                                       |
| ----------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A, AAAA     | Name to IPv4, IPv6 address    | Several records give simple round-robin load spreading.                                                                                                     |
| CNAME       | Name to another name          | Not allowed at the zone apex (`shop.example` itself) or next to other records with the same name; DNS providers offer "ALIAS" or "flattening" for the apex. |
| MX          | Domain to mail servers        | Must point to a name with A/AAAA records, never to a CNAME or an IP.                                                                                        |
| TXT         | Name to text                  | SPF, DKIM and DMARC for email, verification tokens for SaaS.                                                                                                |
| CAA         | Domain to allowed CAs         | CAs must check it before issuing a certificate.                                                                                                             |
| NS, SOA     | Zone to its servers, metadata | Set at your registrar (NS) and in the zone.                                                                                                                 |
| SRV         | Service to host and port      | Used by SIP, XMPP, LDAP, Kubernetes headless Services.                                                                                                      |
| PTR         | Address to name               | Lives in `in-addr.arpa`; mail servers check it.                                                                                                             |
| HTTPS, SVCB | Name to connection hints      | Newer (RFC 9460): tells browsers about HTTP/3 and alternative addresses before they connect.                                                                |

The HTTPS record is already in wide use. A real one, from the public internet:

```terminal
{
  "title": "an HTTPS record (real internet)",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "dig +short HTTPS cloudflare.com",
      "output": "1 . alpn=\"h3,h2\" ipv4hint=104.16.132.229,104.16.133.229 ipv6hint=2606:4700::6810:84e5,2606:4700::6810:85e5"
    }
  ]
}
```

`alpn="h3,h2"` tells a browser that HTTP/3 works before it opens the first connection, which saves the extra round trip of discovering it through the `Alt-Svc` header.

## TTLs and Caching

Compare an answer from the authoritative server with the same answer through the resolver, twice, five seconds apart:

```terminal
{
  "title": "authoritative answer vs cached answer",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "comment": "straight from ns1: the aa (authoritative answer) flag and the full TTL",
      "prompt": "client#",
      "cmd": "dig @203.0.113.53 shop.example | grep -E ';; flags|^shop'",
      "output": ";; flags: qr aa rd; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1\nshop.example.\t\t300\tIN\tA\t203.0.113.80"
    },
    {
      "comment": "through the resolver (the default in resolv.conf)",
      "prompt": "client#",
      "cmd": "dig shop.example | grep -E ';; flags|^shop'",
      "output": ";; flags: qr rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1\nshop.example.\t\t300\tIN\tA\t203.0.113.80"
    },
    {
      "comment": "five seconds later: the same cached answer, 5 seconds older",
      "prompt": "client#",
      "cmd": "dig shop.example | grep -E ';; flags|^shop'",
      "output": ";; flags: qr rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1\nshop.example.\t\t294\tIN\tA\t203.0.113.80"
    }
  ]
}
```

The resolver's answer has no `aa` flag: it is a cached copy, and its TTL counts down. When it reaches zero, the resolver asks `ns1` again. Every resolver between your users and your authoritative servers keeps its own copy for up to the TTL.

That is what people call **DNS propagation**. Nothing is pushed anywhere; old answers simply expire from caches. Watch it happen. The resolver already has `mail.shop.example` cached; now change the record on `ns1`, increase the serial and reload the zone:

```terminal
{
  "title": "change a record, then ask again",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "client#",
      "cmd": "dig +short mail.shop.example",
      "output": "203.0.113.25"
    },
    {
      "prompt": "ns1#",
      "cmd": "sed -i -e 's/203.0.113.25/203.0.113.26/' -e 's/2026102701 ; serial/2026102702 ; serial/' /etc/bind/netlab/db.shop.example"
    },
    {
      "prompt": "ns1#",
      "cmd": "rndc reload shop.example",
      "output": "zone reload queued"
    },
    {
      "comment": "the authoritative server has the new address",
      "prompt": "client#",
      "cmd": "dig @203.0.113.53 +noall +answer mail.shop.example",
      "output": "mail.shop.example.\t300\tIN\tA\t203.0.113.26"
    },
    {
      "comment": "the resolver still serves the old one, until the TTL runs out",
      "prompt": "client#",
      "cmd": "dig +noall +answer mail.shop.example",
      "output": "mail.shop.example.\t297\tIN\tA\t203.0.113.25"
    }
  ]
}
```

For the next few minutes, users of this resolver get the old address, and nothing on `ns1` can change that. The fix is planning:

1. Days before a migration, lower the TTL of the records you will change (for example to 60 seconds), and wait at least one old TTL so that caches pick up the short one.
2. Make the change. Caches now expire within a minute.
3. Keep the old server running until traffic stops, because some clients ignore TTLs.
4. Raise the TTL again afterwards.

**Negative answers are cached too.** If a client asks for a name before you create it, resolvers remember "does not exist" for the SOA's negative TTL (60 seconds in the lab, often an hour in real zones). Create records before you announce them.

## Your Machine's Resolver

On Linux, the stub resolver reads `/etc/resolv.conf`. In the lab each host has its own, written by `netlab.sh`:

```terminal
{
  "title": "resolv.conf and the search list",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "web1#",
      "cmd": "cat /etc/resolv.conf",
      "output": "nameserver 10.0.2.1\nsearch shop.internal"
    },
    {
      "comment": "getent resolves like your applications do: /etc/hosts, then DNS with the search list",
      "prompt": "web1#",
      "cmd": "getent hosts db",
      "output": "10.0.3.10       db.shop.internal"
    },
    {
      "comment": "dig ignores the search list unless you ask for it",
      "prompt": "web1#",
      "cmd": "dig +short db"
    },
    {
      "prompt": "web1#",
      "cmd": "dig +short +search db",
      "output": "10.0.3.10"
    }
  ]
}
```

- `nameserver` lists up to three resolvers, tried in order.
- `search shop.internal` lets you type `db` instead of `db.shop.internal`: the resolver tries the short name with each search domain appended.
- `getent hosts` (Linux) answers exactly as your programs would, through `/etc/nsswitch.conf`, `/etc/hosts` and the search list. `dig` talks to a DNS server directly and skips all of that. When an application and `dig` disagree, trust `getent`.

Kubernetes uses search lists heavily: a pod's `resolv.conf` has several search domains and `options ndots:5`, so a name with fewer than five dots is tried with every search domain first. Lookups for external names such as `api.stripe.com` can turn into several failed queries before the real one; a trailing dot (`api.stripe.com.`) skips the search list.

`/etc/hosts` wins over DNS, which makes it handy for testing a new server before you change DNS, and dangerous when you forget the entry. In the lab, give `client` its own hosts file that points `www.shop.example` at `remote`. `ip netns exec` mounts that file when it starts a command, so a shell you opened on `client` earlier keeps the old `/etc/hosts`: run each `client#` command below with `sudo ip netns exec client ...`, or open a new shell after creating (and again after removing) the file:

```terminal
{
  "title": "/etc/hosts overrides DNS",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "comment": "ip netns exec mounts /etc/netns/client/hosts over /etc/hosts for client",
      "prompt": "$",
      "cmd": "printf '127.0.0.1 localhost\\n203.0.113.20 www.shop.example\\n' | sudo tee /etc/netns/client/hosts > /dev/null"
    },
    {
      "prompt": "client#",
      "cmd": "getent hosts www.shop.example",
      "output": "203.0.113.20    www.shop.example"
    },
    {
      "prompt": "client#",
      "cmd": "curl -s http://www.shop.example/",
      "output": "served by remote (203.0.113.20)"
    },
    {
      "comment": "dig does not read /etc/hosts",
      "prompt": "client#",
      "cmd": "dig +short www.shop.example",
      "output": "shop.example.\n203.0.113.80"
    },
    {
      "prompt": "$",
      "cmd": "sudo rm /etc/netns/client/hosts"
    }
  ]
}
```

Most Ubuntu, Debian and Fedora systems run **systemd-resolved**: `/etc/resolv.conf` points at its local stub `127.0.0.53`, and the real upstream servers live in its own configuration. Its commands:

```bash
resolvectl status                 # upstream DNS servers per interface
resolvectl query www.example.com  # resolve through systemd-resolved, with timing and source
sudo resolvectl flush-caches      # forget cached answers
```

Flushing the local cache on each operating system:

```tabs
{
  "title": "Flush the local DNS cache",
  "tabs": [
    {
      "label": "Linux (systemd-resolved)",
      "lang": "bash",
      "code": "sudo resolvectl flush-caches\nresolvectl statistics   # the cache size drops to 0"
    },
    {
      "label": "macOS",
      "lang": "bash",
      "code": "sudo dscacheutil -flushcache\nsudo killall -HUP mDNSResponder"
    },
    {
      "label": "Windows",
      "lang": "powershell",
      "code": "Clear-DnsClientCache\n# or, in cmd.exe:\nipconfig /flushdns"
    }
  ]
}
```

Flushing your own cache does not flush your resolver's cache, or anyone else's. If the resolver still has the old answer, you wait for the TTL.

## DNS Errors, One by One

`dig` prints a **status** in its header. Each one means something different:

```terminal
{
  "title": "four DNS failures",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "comment": "NXDOMAIN: the name does not exist",
      "prompt": "client#",
      "cmd": "dig nope.shop.example | grep -E 'status|SOA'",
      "output": ";; ->>HEADER<<- opcode: QUERY, status: NXDOMAIN, id: 574\nshop.example.\t\t60\tIN\tSOA\tns1.shop.example. hostmaster.shop.example. 2026102702 3600 600 604800 60"
    },
    {
      "comment": "NOERROR with no answer (NODATA): the name exists, but has no record of this type",
      "prompt": "client#",
      "cmd": "dig shop.example AAAA | grep -E 'status|ANSWER:'",
      "output": ";; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 43311\n;; flags: qr rd ra; QUERY: 1, ANSWER: 0, AUTHORITY: 1, ADDITIONAL: 1"
    },
    {
      "comment": "REFUSED: the server will not answer this client",
      "prompt": "client#",
      "cmd": "dig db.shop.internal | grep status",
      "output": ";; ->>HEADER<<- opcode: QUERY, status: REFUSED, id: 56876"
    },
    {
      "comment": "SERVFAIL: the resolver could not get an answer (the lab has no internet)",
      "prompt": "web1#",
      "cmd": "dig +tries=1 example.com | grep status",
      "output": ";; ->>HEADER<<- opcode: QUERY, status: SERVFAIL, id: 10711"
    },
    {
      "comment": "timeout: no server answered at all",
      "prompt": "client#",
      "cmd": "dig @203.0.113.99 +tries=1 +timeout=2 shop.example",
      "output": ";; communications error to 203.0.113.99#53: timed out\n\n; <<>> DiG 9.20.24-1ubuntu0.4-Ubuntu <<>> @203.0.113.99 +tries=1 +timeout=2 shop.example\n; (1 server found)\n;; global options: +cmd\n;; no servers could be reached"
    }
  ]
}
```

- **NXDOMAIN**: the name does not exist. Check the spelling and the zone. The SOA in the answer is what the resolver uses for negative caching.
- **NOERROR, ANSWER: 0** ("NODATA"): the name exists, but not with that record type. Common when an app asks for AAAA first and there is none; harmless, unless the app waits for it.
- **REFUSED**: the server is reachable but will not answer you. Here the resolver keeps `shop.internal` from the internet side of the lab, on purpose. In real life it is an access list, or a query sent to an authoritative server for a zone it does not host.
- **SERVFAIL**: the resolver tried and failed: the authoritative servers are unreachable, or DNSSEC validation failed. The lab has no internet, so the resolver cannot reach the root servers.
- **Timed out / no servers could be reached**: nothing answered. A firewall blocks port 53, or the server is down.

When answers disagree between users, compare the authoritative servers with the resolvers: `dig @<authoritative> name` shows the truth, `dig @1.1.1.1 name` and `dig @8.8.8.8 name` show what two big public resolvers have cached.

## Encrypted DNS

Classic DNS travels in plain text over UDP port 53, so anyone on the path can read and change it. Two encrypted variants are widely deployed: **DNS over TLS** (DoT, TCP port 853) and **DNS over HTTPS** (DoH, port 443). Browsers use DoH by default in many regions, which can bypass the DNS server your company or your VPN expects. Both `dig` and `curl` speak DoH:

```terminal
{
  "title": "DNS over HTTPS (real internet)",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "dig @1.1.1.1 +https +tls-ca +tls-hostname=cloudflare-dns.com +noall +answer devops-daily.com A",
      "output": "devops-daily.com.\t300\tIN\tA\t172.67.146.8\ndevops-daily.com.\t300\tIN\tA\t104.21.95.163"
    },
    {
      "cmd": "curl -s -H 'accept: application/dns-json' 'https://cloudflare-dns.com/dns-query?name=devops-daily.com&type=A'",
      "output": "{\"Status\":0,\"TC\":false,\"RD\":true,\"RA\":true,\"AD\":false,\"CD\":false,\"Question\":[{\"name\":\"devops-daily.com\",\"type\":1}],\"Answer\":[{\"name\":\"devops-daily.com\",\"type\":1,\"TTL\":300,\"data\":\"172.67.146.8\"},{\"name\":\"devops-daily.com\",\"type\":1,\"TTL\":300,\"data\":\"104.21.95.163\"}]}"
    }
  ]
}
```

Encryption alone does not prove who answers: `dig +https` encrypts but does not check the server's certificate unless you add `+tls-ca` (use the system's CAs) and `+tls-hostname` (the name the certificate must carry). curl checks certificates by default. **DNSSEC** is a different thing again: it signs records so that a resolver can verify they came from the zone owner, but it does not encrypt anything.

## DNS in Your Applications

- **Use names, not addresses**, in connection strings and configs (`db.shop.internal`, not `10.0.3.10`), so that a server can move by changing one record.
- **Know your runtime's cache.** The JVM caches lookups (30 seconds by default when no security manager is set, controlled by `networkaddress.cache.ttl`); Node.js has no DNS cache of its own, so a busy service sends every lookup to the system resolver; Go and Python use the system resolver or their own, depending on build settings.
- **Long-lived connections ignore DNS changes.** A connection pool that opened its connections yesterday keeps talking to the old address after a failover. Set a maximum connection lifetime.
- **Monitor names from outside.** A check that compares the authoritative answer with what public resolvers return catches expired domains, broken delegations and stale records. Save this as `dns-check.sh` and make it executable (`chmod +x dns-check.sh`):

```bash
#!/usr/bin/env bash
# dns-check.sh NAME EXPECTED SERVER...: fail unless every server answers NAME with exactly
# the IPv4 addresses in EXPECTED (comma-separated, any order)
set -u
if [ "$#" -lt 3 ]; then
  echo "usage: $0 NAME ADDRESS[,ADDRESS...] SERVER..." >&2
  exit 2
fi
name=$1
expected=$(tr ',' '\n' <<<"$2" | sort -u | paste -sd, -)
if ! grep -qE '^[0-9]+(\.[0-9]+){3}(,[0-9]+(\.[0-9]+){3})*$' <<<"$expected"; then
  echo "expected addresses must be IPv4 addresses, comma-separated: '$2'" >&2
  exit 2
fi
shift 2
status=0
for server in "$@"; do
  # keep only the addresses (+short also prints CNAME targets and errors), as a sorted list
  answer=$(dig +short +time=2 +tries=1 "@$server" "$name" A 2>/dev/null |
    grep -E '^[0-9]+(\.[0-9]+){3}$' | sort -u | paste -sd, -)
  if [ "$answer" = "$expected" ]; then
    echo "ok    $server: $name -> $answer"
  else
    echo "FAIL  $server: $name -> ${answer:-no answer} (expected $expected)"
    status=1
  fi
done
exit "$status"
```

```terminal
{
  "title": "check the changed record on two servers",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "client#",
      "cmd": "./dns-check.sh mail.shop.example 203.0.113.26 203.0.113.53 203.0.113.1",
      "output": "ok    203.0.113.53: mail.shop.example -> 203.0.113.26\nFAIL  203.0.113.1: mail.shop.example -> 203.0.113.25 (expected 203.0.113.26)"
    }
  ]
}
```

The authoritative server has the new address and the resolver still has the old one, so the check fails until the cache expires. In production you run a check like this from a scheduler or a monitoring system (Part 8 uses the Prometheus blackbox exporter).

## Common Mistakes

- **Changing a record with a long TTL and expecting it to take effect now.** Lower the TTL first, wait, then change.
- **Forgetting to increase the SOA serial**, so secondaries keep the old zone.
- **Missing trailing dots** in zone files, or a CNAME at the zone apex.
- **Testing with `dig` when the application reads `/etc/hosts`** or uses a different resolver. Use `getent hosts` to see what the application sees.
- **Letting a domain or its DNS provider account expire.** Every name under it stops resolving at once; monitor the expiry date.
- **Exposing internal names in public DNS.** Keep private zones on private servers (or cloud private zones) and answer them only on internal networks, as the lab does.

## Summary

- A recursive resolver walks root, TLD and authoritative servers and caches every answer for its TTL; authoritative servers hold the truth.
- A, AAAA, CNAME, MX, TXT, CAA, NS, SOA, SRV and PTR cover nearly everything you configure; HTTPS records are the newest common type.
- "Propagation" is caching. Lower TTLs before a change, and remember that negative answers are cached too.
- `getent hosts` shows what applications see; `dig @server` shows what one server says.
- NXDOMAIN, NODATA, REFUSED, SERVFAIL and a timeout each point to a different fix.

Next, [Part 4](/guides/networking-fundamentals/04-network-security-and-firewalls-basics) controls who may talk to whom: firewalls.

## Keep Learning

- [DNS resolution simulator](/games/dns-simulator)
- Interview questions: [DNS basics](/interview-questions/junior/networking-basics-dns), [what happens when you type a URL](/interview-questions/junior/system-design-dns-resolution)
- [How to fix SSH "Could not resolve hostname"](/posts/ssh-could-not-resolve-hostname-error)
- [DMARCbis: what changed in DMARC](/posts/dmarcbis-what-changed-new-dmarc) for the TXT records behind email authentication
