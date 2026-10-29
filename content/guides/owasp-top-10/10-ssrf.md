---
title: 'SSRF: Server-Side Request Forgery (A01:2025)'
description: 'Server-side request forgery in the OWASP Top 10:2025: why URL checks fail, a Node.js fetch that checks the address it connects to, and network controls.'
order: 2
---

**TLDR**: Server-side request forgery (SSRF) happens when your server fetches a URL that a user controls and the user points it at something only the server can reach: the cloud metadata service, an admin port on localhost, or another internal service. In the OWASP Top 10:2025 it is part of A01 Broken Access Control. String checks on the URL are not enough. Allow only the destinations you need where you can; otherwise resolve the name, reject every non-public address, connect to the address you checked, and do not follow redirects. Add network rules so a missed case still cannot reach internal systems.

SSRF was its own category, A10, in the 2021 list. The 2025 edition rolled it into [A01 Broken Access Control](/guides/owasp-top-10/01-broken-access-control) (as CWE-918), which describes the problem well: the attacker uses the server's network position to reach resources that access control on the network was supposed to protect.

## Prerequisites

- The companion app from the [guide introduction](/guides/owasp-top-10#h2-the-companion-app), and a terminal in its directory.
- A basic idea of IP addressing: private ranges such as `10.0.0.0/8` and loopback (`127.0.0.1`).

## Why SSRF Is Worse in the Cloud

A server inside a cloud network can reach things a user on the internet cannot:

- **The instance metadata service** at `169.254.169.254` (and `metadata.google.internal` on Google Cloud). On a virtual machine it can hand out temporary credentials for the machine's cloud role.
- **Services bound to localhost**, such as admin interfaces, debug ports and sidecars, which often skip authentication because "only local processes can call them".
- **Internal services** on private addresses: databases with HTTP interfaces, internal APIs, Kubernetes services and the kubelet.

When a feature lets users make the server fetch a URL, all of these become reachable through it.

## Where SSRF Hides

Look for any feature where a user supplies a URL, or a document that contains one:

- link previews and unfurling;
- webhooks, where users register the URL your server calls;
- "import from URL" for images, files and feeds;
- PDF and screenshot renderers, which load every resource in the page;
- integrations that take a server address, such as a custom OAuth or OpenID Connect issuer;
- XML parsers that resolve external entities (see [A02](/guides/owasp-top-10/05-security-misconfiguration)).

The companion app has a link preview. The vulnerable version fetches whatever it gets:

```javascript
// A01 (SSRF): the server fetches any URL it is given
app.post('/api/preview', async (req, res) => {
  const page = await fetch(req.body.url);
  const html = await page.text();
  res.json({ status: page.status, title: /<title>(.*?)<\/title>/i.exec(html)?.[1] ?? null });
});
```

## Why URL Checks Fail

The first fix most people write compares the URL's host name against a list of bad values, such as `localhost` and `169.254.169.254`. It fails for structural reasons, not because the list is incomplete:

- **Names resolve to addresses.** Any public DNS name can point to `127.0.0.1` or a private address. The decision must be made on the resolved IP address, not on the name.
- **The check and the request resolve separately.** If you resolve the name, check the address, and then hand the URL to an HTTP client, the client resolves it again. A DNS record with a very short lifetime can return a public address to the check and an internal one to the request. This is called DNS rebinding.
- **Redirects.** The URL you checked can answer with a redirect to an internal address, and most HTTP clients follow it.
- **IPv6.** A check written for IPv4 misses `::1`, unique local addresses (`fd00::/8`) and IPv4 addresses embedded in IPv6.
- **Parsers disagree.** If the validator and the HTTP client parse the URL differently, the client may connect somewhere the validator never saw.

## A Fetch That Checks the Address It Connects To

The fixed app has its own fetch function that closes those gaps:

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Parse URL", "sub": "http or https only", "icon": "globe", "tone": "slate" },
    { "label": "Resolve", "sub": "every A and AAAA record", "icon": "net", "tone": "blue" },
    { "label": "Check", "sub": "public addresses only", "icon": "shield", "tone": "amber" },
    { "label": "Connect", "sub": "to the checked address", "icon": "server", "tone": "violet" },
    { "label": "Limit", "sub": "no redirects, size, time", "icon": "check", "tone": "green" }
  ]
}
```

```javascript
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

export class SsrfError extends Error {}

// A dns.lookup() call holds a thread pool slot until the resolver answers, even after
// the request that started it has given up. Limit how many run and wait at once, and
// drop waiting lookups that are older than their deadline instead of starting them.
const MAX_ACTIVE_LOOKUPS = 4;
const MAX_WAITING_LOOKUPS = 32;
const MAX_WAIT_MS = 2000;
let activeLookups = 0;
const waitingLookups = [];

function startNextLookup() {
  while (activeLookups < MAX_ACTIVE_LOOKUPS && waitingLookups.length > 0) {
    const next = waitingLookups.shift();
    if (Date.now() > next.expires) {
      next.callback(new SsrfError('DNS lookup waited too long'));
    } else {
      runLookup(next.hostname, next.options, next.callback);
    }
  }
}

function runLookup(hostname, options, callback) {
  activeLookups++;
  dns.lookup(hostname, options, (...args) => {
    activeLookups--;
    startNextLookup();
    callback(...args);
  });
}

export function boundedLookup(hostname, options, callback) {
  if (activeLookups < MAX_ACTIVE_LOOKUPS) return runLookup(hostname, options, callback);
  if (waitingLookups.length >= MAX_WAITING_LOOKUPS) {
    return process.nextTick(callback, new SsrfError('too many DNS lookups'));
  }
  waitingLookups.push({ hostname, options, callback, expires: Date.now() + MAX_WAIT_MS });
}

// IPv4 ranges that are not public: "this network", private, shared (CGNAT), loopback,
// link-local (cloud metadata), IETF, documentation, benchmarking, multicast and reserved.
// Source: the IANA IPv4 and IPv6 special-purpose address registries.
const blockedV4 = new net.BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 3],
]) {
  blockedV4.addSubnet(address, prefix, 'ipv4');
}

// IPv6: only global unicast (2000::/3), minus ranges that embed IPv4 or are reserved.
const globalV6 = new net.BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');
const blockedV6 = new net.BlockList();
blockedV6.addSubnet('2001::', 23, 'ipv6');
blockedV6.addSubnet('2001:db8::', 32, 'ipv6');
blockedV6.addSubnet('2002::', 16, 'ipv6');
blockedV6.addSubnet('3fff::', 20, 'ipv6');

export function isPublicAddress(address) {
  switch (net.isIP(address)) {
    case 4:
      return !blockedV4.check(address, 'ipv4');
    case 6:
      return globalV6.check(address, 'ipv6') && !blockedV6.check(address, 'ipv6');
    default:
      return false;
  }
}

// Fetches a URL for the server, but only from addresses that isAllowed() accepts.
// The check runs on the address the socket connects to, so a DNS answer that
// changes between a check and the request (DNS rebinding) cannot slip through.
export function createSafeFetch({ isAllowed = isPublicAddress } = {}) {
  function lookup(hostname, options, callback) {
    boundedLookup(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) return callback(err);
      const bad = addresses.find((a) => !isAllowed(a.address));
      if (bad) return callback(new SsrfError(`blocked address ${bad.address}`));
      if (options.all) return callback(null, addresses);
      callback(null, addresses[0].address, addresses[0].family);
    });
  }

  return function safeFetch(input, { timeoutMs = 5000, maxBytes = 1_000_000 } = {}) {
    let url;
    try {
      url = new URL(input);
    } catch {
      return Promise.reject(new SsrfError('invalid URL'));
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return Promise.reject(new SsrfError(`scheme ${url.protocol} not allowed`));
    }
    if (url.username || url.password) {
      return Promise.reject(new SsrfError('credentials in URL not allowed'));
    }
    // IP literals never reach lookup(), so check them here.
    const host = url.hostname.replace(/^\[(.*)\]$/, '$1');
    if (net.isIP(host) && !isAllowed(host)) {
      return Promise.reject(new SsrfError(`blocked address ${host}`));
    }
    const client = url.protocol === 'https:' ? https : http;
    return new Promise((resolve, reject) => {
      let settled = false;
      const settle = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(deadline);
        fn(value);
      };
      const fail = (err) => {
        settle(reject, err);
        req.destroy();
      };
      const req = client.get(url, { lookup, agent: false }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400) {
          return fail(new SsrfError('redirects are not followed'));
        }
        const chunks = [];
        let size = 0;
        res.on('data', (chunk) => {
          size += chunk.length;
          if (size > maxBytes) return fail(new SsrfError('response too large'));
          chunks.push(chunk);
        });
        res.on('end', () =>
          settle(resolve, { status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') })
        );
        res.on('error', fail);
      });
      // One deadline for the whole exchange: lookup, connect, headers and body.
      const deadline = setTimeout(() => fail(new SsrfError('timed out')), timeoutMs);
      req.on('upgrade', (res, socket) => {
        socket.destroy();
        fail(new SsrfError('protocol upgrades are not allowed'));
      });
      req.on('error', fail);
      req.on('close', () => settle(reject, new SsrfError('connection closed early')));
    });
  };
}
```

How it works:

- **The address check runs inside the connection.** Node's HTTP client accepts a `lookup` function, which it calls to resolve the host name for the socket. The custom `lookup` resolves every address, rejects the request if any of them is not allowed, and returns the checked addresses to the socket. There is no second resolution, so DNS rebinding has nothing to exploit.
- **IP literals are checked separately**, because Node skips `lookup` for a host that is already an IP address.
- **Ranges, not strings.** `net.BlockList` matches whole ranges, including `0.0.0.0/8`, shared address space (`100.64.0.0/10`, common inside cloud networks) and link-local. For IPv6, only global unicast addresses are allowed, which rejects loopback, link-local, unique local and IPv4-mapped forms in one rule.
- **No redirects, plus limits.** A redirect or a protocol upgrade is an error, the response size is capped, and one deadline covers the whole exchange, from the DNS lookup to the last byte, so a server that trickles data cannot hold the request open.
- **Bounded DNS work.** `dns.lookup()` runs on Node's small thread pool and keeps its slot until the resolver answers, even after the request gave up. `boundedLookup` caps how many lookups run and wait at once, so slow names cannot block the rest of the app.

The route uses it and tells the client only that the URL was refused. The reason goes to the log:

```javascript
import { SsrfError } from './safe-fetch.js';

// POST /api/preview: fetch a page title for a link the user pasted.
export function preview({ safeFetch, log }) {
  return async (req, res) => {
    const { url } = req.body ?? {};
    if (typeof url !== 'string' || url.length > 2048) {
      return res.status(400).json({ error: 'url must be a string' });
    }
    try {
      const page = await safeFetch(url, { timeoutMs: 3000, maxBytes: 512 * 1024 });
      const title = /<title>([^<]{0,200})<\/title>/i.exec(page.body)?.[1] ?? null;
      res.json({ status: page.status, title });
    } catch (err) {
      if (err instanceof SsrfError) {
        log.warn(
          {
            event: `input_validation_fail:url,${req.user.name}`,
            ip: req.ip,
            reqId: req.id,
            reason: err.message,
          },
          'ssrf'
        );
        return res.status(400).json({ error: 'URL not allowed' });
      }
      res.status(502).json({ error: 'Could not fetch the URL' });
    }
  };
}
```

## Try It

```terminal
{
  "title": "the preview endpoint refuses internal targets",
  "prompt": "$",
  "steps": [
    {
      "cmd": "export DEMO_PASSWORD='correct horse battery staple'"
    },
    {
      "cmd": "node src/server.js > app.log 2>&1 &"
    },
    {
      "cmd": "until curl -s -o /dev/null localhost:3000/; do sleep 0.2; done"
    },
    {
      "cmd": "ALICE=$(curl -s localhost:3000/api/login -H 'content-type: application/json' -d '{\"name\": \"alice\", \"password\": \"correct horse battery staple\"}' | jq -r .token)"
    },
    {
      "cmd": "for url in http://127.0.0.1:3000/ http://localhost:3000/ 'http://[::1]:3000/' http://169.254.169.254/latest/meta-data/ file:///etc/passwd; do curl -s localhost:3000/api/preview -H \"authorization: Bearer $ALICE\" -H 'content-type: application/json' -d \"{\\\"url\\\": \\\"$url\\\"}\"; echo \" $url\"; done",
      "output": "{\"error\":\"URL not allowed\"} http://127.0.0.1:3000/\n{\"error\":\"URL not allowed\"} http://localhost:3000/\n{\"error\":\"URL not allowed\"} http://[::1]:3000/\n{\"error\":\"URL not allowed\"} http://169.254.169.254/latest/meta-data/\n{\"error\":\"URL not allowed\"} file:///etc/passwd"
    },
    {
      "cmd": "jq -c 'select(.msg == \"ssrf\") | {event, reason}' app.log",
      "output": "{\"event\":\"input_validation_fail:url,alice\",\"reason\":\"blocked address 127.0.0.1\"}\n{\"event\":\"input_validation_fail:url,alice\",\"reason\":\"blocked address ::1\"}\n{\"event\":\"input_validation_fail:url,alice\",\"reason\":\"blocked address ::1\"}\n{\"event\":\"input_validation_fail:url,alice\",\"reason\":\"blocked address 169.254.169.254\"}\n{\"event\":\"input_validation_fail:url,alice\",\"reason\":\"scheme file: not allowed\"}"
    },
    {
      "cmd": "kill %1"
    }
  ]
}
```

The client sees the same answer for every refused URL, and the log records why each one was refused. Note that `localhost` was refused after resolution, on its address, not because of its name.

The tests cover the same cases, plus four that need a second server: a redirect from an allowed site to an internal one, a normal fetch from an allowed address, a response that trickles in past the deadline, and a `101 Switching Protocols` answer. They use `127.0.0.2` as the stand-in public site, which works on Linux, where the whole `127.0.0.0/8` range is local:

```terminal
{
  "title": "the SSRF tests",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "npm test -- tests/ssrf.test.js",
      "output": "> owasp-top-10-demo@1.0.0 test\n> node --test --test-reporter=spec tests/ssrf.test.js\n\n▶ SSRF: the preview endpoint\n  ✔ fetches an allowed address (95.855738ms)\n  ✔ blocks http://127.0.0.1:PORT/ (39.8648ms)\n  ✔ blocks http://localhost:PORT/ (31.867204ms)\n  ✔ blocks http://[::1]:PORT/ (17.403471ms)\n  ✔ blocks http://169.254.169.254/latest/meta-data/ (17.152771ms)\n  ✔ blocks file:///etc/passwd (17.952482ms)\n  ✔ does not follow a redirect to an internal address (43.512844ms)\n  ✔ stops a response that trickles in past the deadline (311.070139ms)\n  ✔ refuses a response that switches protocols (13.093547ms)\n✔ SSRF: the preview endpoint (1067.846932ms)\n▶ SSRF: isPublicAddress\n  ✔ 1.1.1.1 is public (1.846475ms)\n  ✔ 2606:4700:4700::1111 is public (0.356421ms)\n  ✔ 10.0.0.5 is not public (0.357791ms)\n  ✔ 100.64.0.1 is not public (0.341736ms)\n  ✔ 127.0.0.1 is not public (0.312866ms)\n  ✔ 169.254.169.254 is not public (0.242127ms)\n  ✔ 172.16.3.4 is not public (0.224034ms)\n  ✔ 192.168.1.1 is not public (0.225312ms)\n  ✔ ::1 is not public (0.25133ms)\n  ✔ ::ffff:127.0.0.1 is not public (0.249645ms)\n  ✔ fd00::1 is not public (0.259811ms)\n  ✔ fe80::1 is not public (0.244163ms)\n  ✔ 192.0.2.10 is not public (0.246144ms)\n  ✔ 3fff::1 is not public (0.249516ms)\n✔ SSRF: isPublicAddress (7.950523ms)\nℹ tests 23\nℹ suites 2\nℹ pass 23\nℹ fail 0\nℹ cancelled 0\nℹ skipped 0\nℹ todo 0\nℹ duration_ms 1940.222718"
    }
  ]
}
```

## Prefer an Allowlist

A blocklist of private ranges is the fallback for features that must reach arbitrary public sites, such as link previews. Many features do not need that:

- Webhooks to known partners, integrations with a fixed set of APIs, and imports from your own storage all have a short list of valid destinations. Check the host name against that list and still use the address check, because an allowed name can point anywhere if its DNS is compromised.
- For webhooks that customers configure, require HTTPS, check the address on every delivery (not only when the URL is saved), and send from a separate worker without access to internal networks.

## Defense in Depth on the Network

An application-level check can have a gap. Make sure the network does not let a mistake become a breach:

- **Send outbound fetches through an egress proxy** or a separate service that can only reach the internet. The application servers themselves then need no general outbound access.
- **Restrict egress** to what the app needs, with firewalls, security groups (which only allow, so allow the destinations you need instead of denying the rest) or Kubernetes network policies. Security groups and network ACLs do not filter traffic to the instance metadata service; the metadata settings below handle that. This NetworkPolicy from the companion repository lets the app's pods resolve names and open HTTPS connections to public addresses (plus their own node, which Kubernetes always allows):

```yaml
# SSRF defense in depth: the invoices pods may resolve names and open HTTPS
# connections to public addresses. Add rules for the services your app really
# needs, such as its database. Kubernetes always lets a pod reach its own node,
# so node services need host-level protection as well.
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: invoices-egress
  namespace: invoices
spec:
  podSelector:
    matchLabels:
      app: invoices
  policyTypes: ['Egress']
  egress:
    - to:
        - namespaceSelector: {}
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - protocol: UDP
          port: 53
        - protocol: TCP
          port: 53
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
            except:
              - 10.0.0.0/8
              - 100.64.0.0/10
              - 127.0.0.0/8
              - 169.254.0.0/16
              - 172.16.0.0/12
              - 192.168.0.0/16
      ports:
        - protocol: TCP
          port: 443
```

Network policies take effect only when the cluster's network plugin enforces them, whether they apply to pods that use `hostNetwork` depends on the plugin, and they are additive: another policy that selects the same pods can allow more. Check your plugin and every policy that applies. [hostNetwork Is Still a Footgun](/posts/hostnetwork-footgun-cve-2026-32193) shows what a pod on the host network can reach.

- **Harden the metadata service.** On AWS, require IMDSv2, which needs a session token obtained with a `PUT` request, something a simple SSRF that can only send `GET` requests cannot do. Set it as the account default for new instances in each Region with `aws ec2 modify-instance-metadata-defaults --http-tokens required`, and in Terraform per instance:

```hcl
# SSRF defense in depth: require IMDSv2 session tokens. A hop limit of 1 also keeps
# tokens from containers on bridge networks; containers on the host network still
# reach the service, so block it for them in the host firewall, or set
# http_endpoint = "disabled" when nothing on the instance needs metadata.
resource "aws_instance" "app" {
  ami           = var.ami_id
  instance_type = "t4g.small"

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  root_block_device {
    encrypted = true
  }
}
```

A hop limit of 1 also keeps tokens from containers on bridge networks, because their requests take one more hop. Containers on the host network still reach the service, so block it for them in the host firewall, or disable the endpoint when nothing on the instance needs it. Google Cloud and Azure metadata services require a request header (`Metadata-Flavor: Google` and `Metadata: true`), which stops SSRF bugs that cannot set headers, but not those that can. Give each workload the smallest cloud role it needs, so stolen credentials are worth little.

## Common Mistakes

- **Checking the host name string.** Decide on resolved addresses.
- **Resolving twice.** Validating with one DNS lookup and fetching with another opens the door to DNS rebinding.
- **Following redirects.** Turn them off, or check every hop with the same address rules.
- **Forgetting IPv6 and special ranges.** `::1`, `fd00::/8`, `100.64.0.0/10` and `0.0.0.0` are all internal.
- **Returning the fetched body or detailed errors.** Even without the body, timing and error messages tell an attacker which internal ports are open. Return a generic error.
- **Relying on the application alone.** Add egress rules and metadata hardening.

## Summary

- SSRF turns your server into a client inside your network; in 2025 it is part of A01.
- Use an allowlist of destinations when the feature allows it.
- Otherwise, check every resolved address against public ranges inside the connection itself, and refuse redirects.
- Limit response size and time, and keep error messages generic.
- Back the code up with egress rules, IMDSv2 and small cloud roles.

Next, [A02:2025 Security Misconfiguration](/guides/owasp-top-10/05-security-misconfiguration) covers the settings around the code: headers, error pages, default credentials and infrastructure.

## Keep Learning

- [OWASP Server-Side Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [hostNetwork Is Still a Footgun: What CVE-2026-32193 Teaches Every Cluster](/posts/hostnetwork-footgun-cve-2026-32193)
- [Next.js 16.2.6 and 15.5.18 Ship 13 Security Fixes](/posts/nextjs-16-2-6-15-5-18-security-release), which includes a WebSocket SSRF
- [Kubernetes Security checklist](/checklists/kubernetes-security)
