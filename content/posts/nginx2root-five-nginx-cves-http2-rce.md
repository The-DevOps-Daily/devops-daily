---
title: 'nginx2root: Five nginx CVEs, One Pre-Auth Path to Root, and How to Tell If Your Config Is Exposed'
excerpt: 'On 18 November 2026, Xint disclosed five unauthenticated nginx CVEs it calls nginx2root. One of them, CVE-2026-123007, only needs HTTP/2 to be enabled. Here is which of the five apply to your config, the fixed versions per channel, a read-only check script, how to upgrade without dropping connections, and the mitigations to use tonight if you cannot patch yet.'
category:
  name: 'Networking'
  slug: 'networking'
date: '2026-11-18'
publishedAt: '2026-11-18T17:30:00Z'
updatedAt: '2026-11-18T17:30:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: true
tags:
  - Networking
  - Security
  - NGINX
  - CVE
  - DevOps
---

On 18 November 2026, the security research firm [Xint](https://xint.io/blog/nginx2root-remote-code-execution) disclosed five nginx vulnerabilities it groups under the name **nginx2root**, along with a sixth, separate Linux kernel flaw. nginx released [1.31.9 (mainline)](https://nginx.org/en/CHANGES) and [1.30.7 (stable)](https://nginx.org/en/CHANGES-1.30) the same day to fix the five nginx CVEs, and the [nginx.org security advisory list](https://nginx.org/en/security_advisories.html) picked up the new entries. Each of the five is an independent, unauthenticated path to running code as the nginx worker process. The nginx changelog uses cautious wording ("might allow an attacker to cause a segmentation fault, or might have potential other impact"); Xint reports demonstrating full command execution in its own tests. Xint also chained the five with its kernel flaw in the SCTP subsystem to reach root on the host, and reports that on a host with the vulnerable kernel path the chain escaped a Docker container running nginx and took over the host underneath it.

The one that reaches the most servers is **CVE-2026-123007**. It only needs HTTP/2 to be enabled, which is common on TLS sites. Xint measured 56.7 million nginx hosts on Shodan on 10 November, and of the hosts that reported an identifiable version, 98.9% fell inside the vulnerable range. That does not mean every one is exploitable, but it sets the scale.

This post is not a recap. It is the set of decisions you need in the next hour: which of the five apply to your config, the exact fixed versions per channel, how to upgrade without dropping live connections, and what to switch off tonight if you cannot patch yet.

## TL;DR

- **nginx2root is five nginx CVEs** (plus a chained kernel bug), all fixed in **nginx 1.31.9** (mainline) and **1.30.7** (stable), released 18 November 2026. Each one leads to code execution as the nginx worker on its own. They affect different configurations.
- **CVE-2026-123007** (memory corruption in HTTP/2 flow control, severity major) only needs HTTP/2 enabled. It has been in every release since nginx added HTTP/2 in 1.9.5 (2015), up to and including 1.31.8.
- **The other four** need narrower setups: client HTTP/2 with the request proxied to an upstream (123633), client HTTP/3 proxied to an upstream (121810), the `resolver` with a per-request `proxy_pass` and `mirror` or another subrequest (123634), or a mail proxy using `proxy on` with `auth_http` (113425).
- **Disabling HTTP/2 blocks two of the five** (123007 and 123633). It does nothing for the other three. There is no single switch that covers all of them, so patching is the real fix.
- **Upgrade, then make sure the new binary is running.** A package upgrade plus a config reload can leave the old binary serving traffic. You need the package's own binary upgrade, a supported live upgrade, or a restart for the new executable to take over.
- **Check your exposure** with the read-only script below: it reads `nginx -v`, `-V` and `-T` and tells you the version verdict plus which attack-path features are on.

## Prerequisites

- Shell access to each host, container image, or ingress controller that runs nginx.
- The ability to read `nginx -v`, `nginx -V` and `nginx -T` (run as root so `-T` can read every included file).
- A maintenance path to upgrade the package or pull a new image, and to restart the service.

## The five bugs and what each one needs

The important point for triage is that these are not one bug with five numbers. They sit in different modules, and a server is only on a given path if the matching feature is turned on. The ranges below are the vulnerable ranges from the [nginx.org advisory list](https://nginx.org/en/security_advisories.html); all five are fixed in **1.30.7+** (stable) and **1.31.9+** (mainline). The "needs this to be reachable" column follows the Xint writeup.

| CVE             | Bug                                      | Severity | Needs this to be reachable                                      | nginx.org vulnerable range |
| --------------- | ---------------------------------------- | -------- | --------------------------------------------------------------- | -------------------------- |
| CVE-2026-123007 | Memory corruption in HTTP/2 flow control | major    | HTTP/2 enabled                                                  | 1.9.5 - 1.31.8             |
| CVE-2026-123633 | Use-after-free in HTTP/2                 | medium   | Client HTTP/2, request proxied to an upstream, slot pressure    | 1.19.7 - 1.31.8            |
| CVE-2026-121810 | Use-after-free in HTTP/3                 | medium   | Client HTTP/3 (QUIC), request proxied to an upstream            | 1.25.0 - 1.31.8            |
| CVE-2026-123634 | Use-after-free in the resolver           | medium   | `resolver` + same name resolved in a request and its subrequest | 0.6.18 - 1.31.8            |
| CVE-2026-113425 | Use-after-free in the mail proxy         | major    | mail proxy with `proxy on` and `auth_http`                      | 0.5.33 - 1.31.8            |

Note the "needs this to be reachable" column describes the configuration, not a second version cut-off. Xint's tested attack path for a given CVE can start later than the full vulnerable range: for 123634 its tested `mirror`-based path starts at 1.13.4 and also needs `mirror_request_body off`, and for the mail proxy Xint lists 0.5.15 while nginx.org records 0.5.33. Compare your version against the nginx.org range, then check whether the feature is on.

```diagram
{
  "type": "branch",
  "nodes": [
    { "label": "Unauthenticated request", "sub": "HTTP/2, HTTP/3, DNS or mail login", "icon": "globe", "tone": "slate" },
    { "label": "nginx worker", "sub": "unpatched build, feature enabled", "icon": "server", "tone": "red" }
  ],
  "branch": [
    { "label": "Code execution as the worker user", "variant": "bad" },
    { "label": "Chain the SCTP kernel bug to root, where the kernel is vulnerable", "variant": "bad" }
  ]
}
```

A few details that change how you triage:

- **CVE-2026-123007 is the broad one.** HTTP/2 is not on by default in nginx, but the official Docker images build the module in, common distro builds ship it, and HTTP/2 is widely enabled on TLS sites. If you terminate TLS on nginx and serve HTTP/2, assume you are on this path until you patch.
- **The HTTP/2 control frames are not logged as requests.** The `WINDOW_UPDATE` and `RST_STREAM` frames used to trigger 123007 do not show up in your access log and are encrypted in transit, so "nothing in the access log" is not evidence of safety.
- **CVE-2026-123634 is wider than the resolver alone.** Xint tested it through `mirror`, but any feature that creates subrequests, such as SSI, can reach the same bug. Turning off `mirror` by itself does not make you safe.
- **`nginx -t` will not flag any of these.** The vulnerable configs are valid. You find your exposure by checking the version and which features are on, not by a config test.

## Are you exposed? Run the checks

The quick answer is three conditions for the broad CVE: an unpatched version, the HTTP/2 module compiled in, and HTTP/2 actually enabled in the config. Here are the commands straight from the advisory.

```terminal
{
  "title": "nginx2root exposure checks",
  "prompt": "$",
  "steps": [
    { "comment": "1. version: 1.9.5 through 1.31.8 is in range for CVE-2026-123007" },
    { "cmd": "nginx -v", "output": "nginx version: nginx/1.31.8" },
    { "comment": "2. is the HTTP/2 module compiled in?" },
    { "cmd": "nginx -V 2>&1 | grep -o -- '--with-http_v2_module'", "output": "--with-http_v2_module" },
    { "comment": "3. is HTTP/2 enabled in the running config?" },
    { "cmd": "sudo nginx -T 2>&1 | sed 's/#.*//' | grep -nE 'listen[^;]*http2|http2[[:space:]]+on'", "output": "42: listen 443 ssl http2;" },
    { "comment": "4. is HTTP/2 reachable from outside? run this from another host" },
    { "cmd": "openssl s_client -connect HOST:443 -servername HOST -alpn h2 </dev/null 2>&1 | grep 'ALPN protocol:'", "output": "ALPN protocol: h2" }
  ]
}
```

`nginx -T` prints the configuration on disk, which can differ from the running config if you edited it without reloading. With that caveat: if the version is in range and not a backported fix, the module is present, and `ALPN protocol: h2` comes back on the real nginx port, you are vulnerable and externally reachable. Treat that as immediate.

To do all of this at once, including the narrower paths, there is a small read-only script for triage. It reads `nginx -v`, `-V` and `-T`, prints the version verdict and which of the five features are on, and maps that to a per-CVE result. It never sends a request and contains no exploit code. It has a Docker mode for checking an image tag before you deploy it. It is a heuristic starting point, not proof: it reads directives across the whole config and does not replace confirming your distro's backport status by hand.

```github
https://github.com/The-DevOps-Daily/nginx2root-check
```

```bash
# local host (run with sudo so nginx -T sees every include)
sudo sh nginx2root-check.sh

# a container image, before you ship it
sh nginx2root-check.sh --image nginx:1.31.8
```

Against a test image built from the official `nginx:1.31.8` with HTTP/2, a `resolver` and a proxied upstream baked into the config, it reports:

```text
nginx version:    1.31.8 (branch 1.31) -> vulnerable
features enabled: http2=yes http3/quic=no resolver=yes proxy_pass=yes mail_proxy=no ssl_preread=no
attack paths:
  CVE-2026-123007 HTTP/2 flow control      : YES
  CVE-2026-123633 HTTP/2 use-after-free     : YES
  CVE-2026-123634 resolver use-after-free   : likely (resolver in use; confirm per-request proxy_pass + mirror/SSI)
verdict:          Affected: a vulnerable version has at least one nginx2root feature enabled. Patch now.
```

:::warning
A reported version string is not proof either way. Distro packages backport fixes without changing the `X.Y.Z` number, so a build that still says `1.18.0` may already be patched. And a version in range may have HTTP/2 off. Check the version, the module, and the live config together, then compare the full package version against your distro advisory.
:::

## Fixed versions, per channel

The upstream fix is nginx 1.31.9 (mainline) and 1.30.7 (stable). What you can actually install right now depends on your channel. This is a snapshot we checked around 17:00 to 17:10 UTC on 18 November for CVE-2026-123007, the broad one. Distro trackers move through the day, so recheck yours before you decide.

| Channel                                 | Status when checked (around 17:00 UTC, 18 Nov 2026)                                                                      | Source                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| nginx.org mainline                      | **Fixed: 1.31.9**, dated 18 Nov                                                                                          | nginx.org                   |
| nginx.org stable                        | **Fixed: 1.30.7**, dated 18 Nov                                                                                          | nginx.org                   |
| Official Docker image (`library/nginx`) | **Fixed:** `1.31.9` and `1.30.7` tags published today (Hub API `last_updated` 16:5x UTC)                                 | Docker Hub API              |
| Ubuntu (jammy 22.04 / noble 24.04)      | Listed, fix **needed** (upstream 1.31.9 / 1.30.7 noted, no Ubuntu update yet)                                            | ubuntu.com/security         |
| Debian (bookworm / trixie / sid)        | Listed, **vulnerable / unfixed**                                                                                         | security-tracker.debian.org |
| Alpine                                  | No entry found (tracker returned no record)                                                                              | security.alpinelinux.org    |
| RHEL / Red Hat                          | Not found in the security data API                                                                                       | access.redhat.com           |
| F5 NGINX Plus and NGINX products        | Advisory [K000163926](https://my.f5.com/manage/s/article/K000163926) (for 123007; other CVEs have their own F5 articles) | my.f5.com                   |

These rows cover CVE-2026-123007; the other four are tracked per CVE on the same sites. The pattern is the usual one on disclosure day: upstream and the official container images ship first, and the distributions follow over the next hours and days. If your distro has not shipped a fix, your options are the [official nginx.org package repository](https://nginx.org/en/linux_packages.html) for the patched build, or the mitigations below until your distro catches up.

## Upgrade without dropping connections

nginx supports a live binary upgrade: a new master process starts, inherits the listening sockets from the old one, and the old workers drain. On the [nginx.org package repositories](https://nginx.org/en/linux_packages.html), the package upgrade itself performs this for you, so the new binary takes over without a manual restart.

```bash
# 1. check the config is valid before you touch anything
sudo nginx -t

# 2. upgrade the package (nginx.org repo must already be configured)
sudo apt-get update
sudo apt-get install --only-upgrade nginx

# 3. confirm the new version is on disk and the running master matches
nginx -v
ps -eo pid,etime,args | grep '[n]ginx: master process'
```

When we upgraded a stable-channel host on the nginx.org repository today, `apt-get install --only-upgrade nginx` pulled 1.30.7 and did a binary upgrade that inherited the listening sockets. The error log recorded `using inherited sockets`, `nginx -t` passed before and after, and `nginx -v` then reported the fixed build. We did not observe dropped connections during the swap, though we did not run a load test to prove zero loss.

One point people miss: on channels where the package does not do the live upgrade for you, a package install followed by `nginx -s reload` is not enough. Reload re-reads the config but keeps the running executable, so the old, vulnerable binary keeps serving. In that case do the signal-based live upgrade (`USR2` to the master, then `QUIT` to the old master) to swap the binary without dropping connections, or `systemctl restart nginx` if a short interruption is acceptable. Either way, confirm afterward that no `nginx: worker process is shutting down` processes are still handling old HTTP/2 or mail sessions on the old binary.

:::tip
In Kubernetes and other image-based setups there is no in-place upgrade. Pull `nginx:1.31.9` or `nginx:1.30.7`, update the image tag, and roll the pods. Run the check against the new tag first so you ship a build you have verified.
:::

## If you cannot patch tonight, mitigate per path

These are temporary. They reduce the attack surface until you install the fix, and they come straight from the Xint advisory, not from guesswork. Validate and reload after each change.

**Disable HTTP/2 (blocks CVE-2026-123007 and CVE-2026-123633).** On nginx 1.25.1 and later, set `http2 off;` in each affected server block and drop any legacy `http2` parameter from `listen`.

```nginx
listen 443 ssl;
http2 off;
```

On nginx 1.9.5 through 1.25.0 there is no `http2` directive, so instead remove the `http2` parameter from the `listen` line (turn `listen 443 ssl http2;` into `listen 443 ssl;`). Clients on HTTP/1.1 keep working. Services that need HTTP/2, such as native gRPC, do not, so weigh that. After reloading, re-run the external ALPN check and confirm `ALPN protocol: h2` no longer comes back (an empty result can also mean the connection failed, so confirm the site still loads over HTTPS).

**Disable HTTP/3 / QUIC (blocks CVE-2026-121810).** Remove the `quic` listeners, set `http3 off;`, and stop advertising it.

```nginx
listen 443 ssl;
# listen 443 quic reuseport;   # removed
http3 off;
add_header Alt-Svc 'clear' always;
```

Then confirm nothing still listens on UDP 443 with `sudo ss -lunp 'sport = :443'`. For defense in depth, block UDP on that port at the firewall.

**Remove request-time DNS lookups (blocks the tested path for CVE-2026-123634).** This hits servers that pick an upstream per request with a variable `proxy_pass` (for example `proxy_pass http://$host;`) and also use `mirror`. Point `proxy_pass` at a fixed upstream group so there is no DNS lookup during the request.

```nginx
upstream backend_hotfix { server 10.0.0.10:8080; }
location / {
  mirror off;
  proxy_pass http://backend_hotfix;
}
```

Xint notes that `mirror_request_body on` also stopped their exploit but does not fix the resolver bug, so do not lean on that setting alone.

**Restrict the mail proxy (blocks CVE-2026-113425).** This only applies if you run nginx as a mail proxy with `proxy on` and `auth_http`. Bind the IMAP, POP3 and SMTP listeners to loopback, or firewall them to trusted IPs, so untrusted clients cannot reach the login path.

```nginx
listen 127.0.0.1:143;
```

A reload applies the new config to new connections only. Connections already open, such as long-lived HTTP/2 or mail sessions, stay on the old workers with the old config, so a successful ALPN check does not clear them. If old workers are still shown as `is shutting down` after the reload, restart nginx to cut them off. And there is no mitigation that covers all five at once. That is the whole reason to patch rather than paper over it.

## Managed services, ingress controllers and CDNs

The vulnerable code travels with nginx wherever it is bundled, so your exposure is not only the hosts you run directly.

- **ingress-nginx and NGINX Ingress Controller.** Both embed nginx, so the bundled version matters. The community [ingress-nginx](https://kubernetes.github.io/ingress-nginx/user-guide/nginx-configuration/configmap/#use-http2) defaults `use-http2` to true, which puts a default install on the CVE-2026-123007 path; the F5 [NGINX Ingress Controller](https://docs.nginx.com/nginx-ingress-controller/configuration/global-configuration/configmap-resource/) defaults `http2` to false, so exposure there depends on your ConfigMap. Check your own config and the nginx version the controller image bundles. Community ingress-nginx is retired and will not get further security patches, so there is no fix release coming for it; the path forward is to migrate, and our [migration to Gateway API](/posts/ingress-nginx-eol-gateway-api-migration) walks through it, though that is a project, not a tonight fix. For now, confirm whether HTTP/2 is on and treat the data plane accordingly.
- **Distro and appliance images.** Anything that ships nginx inside an image, from load-balancer appliances to base images in your registry, carries the same code. Scan your images with the Docker mode of the check script rather than trusting the tag name.
- **Managed CDNs and load balancers.** If a provider terminates TLS for you on their own nginx fleet, patching is theirs to do. Check your provider's status page. Note that the external ALPN check only reaches the edge; if a CDN sits in front, also run it directly against your origin, because your origin nginx is still exposed to anything that can reach it.

If you are weighing a different proxy as part of this, our [nginx vs Traefik comparison](/comparisons/nginx-vs-traefik) covers the trade-offs, and the [load balancing chapter](/guides/networking-fundamentals/05-load-balancing) of the networking guide covers the fundamentals. This is not the week to rip out your proxy, but it is worth knowing where the lines are.

## Watch for signs of a hit

Because the HTTP/2 trigger frames are not logged as requests, access logs alone will not tell you. The strongest signal is the clearest: an nginx worker should never start an external program. If you run the Linux audit subsystem, a rule on `execve`/`execveat` scoped to the nginx worker UID catches a successful hit.

```bash
# find the worker UID, then audit program launches by it.
# replace NGINX_UID with the numeric UID from the first command.
ps -eo uid,user,args | grep '[n]ginx: worker process'
sudo auditctl -a always,exit -F arch=b64 -S execve,execveat -F euid=NGINX_UID -k nginx_worker_exec
sudo ausearch -k nginx_worker_exec -ts recent -i
```

The rule matches any process running under that UID, so if other services share the account, check each event's PID and parent PID to confirm it came from an nginx worker. A program started by an nginx worker is the clearest sign of a hit, not a guarantee the rule catches every compromise. Weaker signals, which matter when several appear together with no normal cause: one external IP holding a connection open for minutes while `bytes_received` climbs and the server sends little back, many short-lived TLS connections from that same IP, and repeated abnormal worker exits or core dumps in the error log. The rule only records after you install it, so an empty result does not clear an earlier compromise.

## Bottom line

nginx2root is five separate unauthenticated bugs, patched the day they were disclosed. The one that reaches the most servers, CVE-2026-123007, needs only HTTP/2. The fix is in nginx 1.31.9 and 1.30.7 and in the official Docker images today; distros are following. Check your version, module and live config together, upgrade and then make sure the new binary is actually running, and if you cannot patch yet, disable the specific features for the paths you are on. For the broader pattern of memory-safety bugs surfacing in nginx this year, the earlier [NGINX Rift rewrite overflow](/posts/nginx-rift-cve-2026-42945-rewrite-rce) is worth a read, and if you want to understand what sits behind your proxy, our piece on [hash ring points in nginx, HAProxy and Envoy](/posts/hash-ring-points-nginx-haproxy-envoy) goes a level deeper.
