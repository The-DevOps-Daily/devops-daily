---
title: 'We Took Down Our Mesh VPN Control Plane. Here Is What Kept Working'
excerpt: 'Replacing the VPN with a WireGuard mesh moves the single point of failure from the VPN gateway to the coordination server. We stopped the control server under real Tailscale clients for 30 minutes and measured what survived: existing tunnels did, joins and revocations did not, an expiring key cut a device off on time, and a client restart took a device offline until we turned on netmap caching.'
category:
  name: 'Networking'
  slug: 'networking'
date: '2026-10-03'
publishedAt: '2026-10-03T09:00:00Z'
updatedAt: '2026-10-03T09:00:00Z'
readingTime: '16 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Networking
  - Tailscale
  - Headscale
  - WireGuard
  - Zero Trust
  - Security
---

When you replace a VPN concentrator with a mesh VPN such as Tailscale, NetBird or ZeroTier, traffic stops flowing through one box. Devices connect to each other directly wherever the network allows it. But the mesh still has a centre: the **coordination server** (Tailscale calls it the control plane) that hands out keys, addresses, peer lists and access rules. The old question "what happens when the VPN gateway dies?" becomes "what happens when the control server is unreachable?"

The vendors' answer is reassuring: the data plane keeps working. We wanted to know what that means in practice, so we ran an open-source control server ([Headscale](https://github.com/juanfont/headscale)) with real Tailscale clients, stopped it, and probed the network about once a minute for 30 minutes. Existing tunnels survived the whole outage. Joining, revoking and renewing did not, and what happens when a client restarts during the outage is the result most worth adding to your runbook.

## TLDR

| During a control outage             | What we measured                                                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Existing tunnels                    | Kept working for the full 30 minutes: 27 of 27 probes in each direction                                                                          |
| A new device joins                  | Failed (`NeedsLogin`); it joined by itself 14 to 22 s after control came back                                                                    |
| An admin revokes a device           | Impossible: the admin API is the control server                                                                                                  |
| A device's key expires              | The first probe after the expiry time failed; peers enforce it locally                                                                           |
| A client restarts (no netmap cache) | Came back with no address and stayed off the network until control returned                                                                      |
| A client restarts (netmap cache on) | Reachable again in 15 to 19 s in 11 of 12 timed restarts (one took 140 s); stayed reachable in two 10-minute checks, dropped once in another run |

| With the control server up        | What we measured                                                                       |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| Policy change blocks a connection | The first probe after the change already failed (within 6 s, mostly our probe timeout) |
| Deleting a device                 | Same: blocked at the first probe                                                       |

## Prerequisites

- A Linux machine with `tailscale` and `tailscaled` installed (we used 1.102.4)
- Basic familiarity with Tailscale or another mesh VPN

Everything runs as a normal user on one host, and it does not touch an existing Tailscale install. The scripts are in the companion repo:

```github
https://github.com/The-DevOps-Daily/tailnet-control-outage
```

## The setup

One Headscale process plays the control server. Five `tailscaled` processes play devices, each in **userspace-networking mode** (no TUN device and no root, so they can share one host). Each node serves `hello from <name>` on a local port, and a probe fetches that page through another node's SOCKS5 proxy. A probe only succeeds if traffic really crossed the tailnet.

Each node has one job:

| Node | Job during the outage             |
| ---- | --------------------------------- |
| a, b | A long-lived pair. Never touched. |
| c    | Tries to join.                    |
| d    | Gets restarted.                   |
| e    | Its key expires two minutes in.   |

```diagram
{
  "type": "infra",
  "flow": [
    { "label": "a", "sub": "SOCKS5 probe", "icon": "box", "tone": "blue" },
    { "label": "WireGuard", "sub": "direct path", "icon": "lock", "tone": "green" },
    { "label": "b", "sub": "hello from b", "icon": "box", "tone": "blue" }
  ],
  "groups": [
    {
      "label": "Control plane",
      "sub": "stopped during the test",
      "icon": "server",
      "tone": "red",
      "nodes": [
        { "label": "Headscale 0.29.4", "sub": "keys, peers, policy", "icon": "gear", "tone": "red", "status": "down" }
      ]
    },
    {
      "label": "Devices",
      "sub": "tailscaled 1.102.4, userspace mode",
      "icon": "net",
      "tone": "slate",
      "nodes": [
        { "label": "a, b", "sub": "long-lived pair", "icon": "check", "tone": "green", "status": "ok" },
        { "label": "c", "sub": "joins mid-outage", "icon": "box", "tone": "amber" },
        { "label": "d", "sub": "restarted mid-outage", "icon": "box", "tone": "amber" },
        { "label": "e", "sub": "key expires mid-outage", "icon": "box", "tone": "amber" }
      ]
    }
  ]
}
```

The outage script stops Headscale and then works through a timeline: probe every node, start c (its join attempt runs from about 25 seconds to 70 seconds), try an admin command, let e's key expire at about two minutes, and restart d at five to six minutes, probing roughly once a minute throughout. Another script then brings the control server back and times the recovery.

## What kept working: the tunnels you already had

The long-lived pair never noticed. In the 30-minute run, a reached b and b reached a on every probe, 27 probes in each direction, the last one 1,793 seconds after the control server stopped. (In one of the shorter runs, a single probe from b to a failed once and the next one succeeded.) Here is the start and the end of that run, from `runs/nocache-30min/02-outage.txt`:

```text
16:34:16 t=0s control server stopped (e's key expires at 2026-10-02T16:36:10Z)
16:34:16 t=0s a->b ok (hello from b) | b->a ok (hello from a) | a->d ok (hello from d) | a->e ok (hello from e)
16:34:41 t=25s a's own status line: offline
...
17:03:09 t=1723s a->b ok (hello from b) | b->a ok (hello from a) | a->d FAIL | a->e FAIL
17:04:19 t=1793s a->b ok (hello from b) | b->a ok (hello from a) | a->d FAIL | a->e FAIL
```

This matches what [Tailscale documents](https://tailscale.com/kb/1091/what-happens-if-the-coordination-server-is-down): every node keeps its peers, their endpoints and the packet filter, and traffic never goes through the coordination server in the first place. Each probe is a fresh HTTP connection, so this shows that new connections between existing peers keep working; we did not hold one long-lived session open.

Note the third line. While a was moving traffic, `tailscale status` showed a itself as `offline`, because a could not reach the control server. If your monitoring alerts on that, it will tell you the mesh is down while it is working. Probe real traffic between real nodes instead.

## What stopped working

### New devices cannot join

Node c started with a valid, reusable pre-auth key and never got past `NeedsLogin`:

```text
t=71s new node c tries to join: timeout waiting for Tailscale service to enter a Running state; check health with "tailscale status" (state NeedsLogin)
```

It kept retrying on its own, and got an address 14 to 22 seconds after the control server came back (three runs). Nobody had to touch it. During the outage, though, a replacement laptop, a new CI runner or an autoscaled node simply cannot get on the network.

### Nobody can revoke anything

The admin interface is the control server. The `headscale nodes list` command we ran to find a node to remove failed with `context deadline exceeded`. With Tailscale's hosted service the equivalent is the admin console and API, and they are part of the same control plane.

This is the security cost of the design. Tailscale's own documentation lists it: during an outage, "existing users cannot have their keys revoked." If you need to cut off a stolen laptop or a departing employee during a control plane incident, the mesh cannot do it for you. The device keeps every peer and every rule it had when the outage started.

### Expiring keys still expire

We set e's key to expire about two minutes into the outage (114 seconds in the 30-minute run). The first probe after that time failed, and every probe after it. The client does this itself: it marks peers whose key has expired and stops talking to them ([`ipn/ipnlocal/expiry.go`](https://github.com/tailscale/tailscale/blob/v1.102.4/ipn/ipnlocal/expiry.go) in the client source).

So key expiry is enforced by the peers themselves, without the control server. That is good for security, and it means a control outage can become a data plane outage: every device whose key expires during the outage drops off, and cannot renew until control is back. After recovery, e stayed `Logged out` until we cleared its expiry on the server, and then it came back within 1 to 2 seconds. In real life an admin extends or clears the expiry, or the user re-authenticates.

If your tailnet uses short key expiry for servers, a long control outage will take them off the network one by one. Tailscale lets you disable or temporarily extend expiry per device, and a device that is tagged when it first authenticates has key expiry disabled by default ([key expiry docs](https://tailscale.com/kb/1028/key-expiry)).

## The restart trap

Five minutes into the outage we restarted d's `tailscaled`, keeping its state directory, the way an unattended upgrade, a reboot or a crashed process does.

Without the netmap cache, d came back with no address and no peers:

```text
t=317s restarted d's tailscaled while control is down: state NoState, ip , netmap cache files: 0
```

Its health check said why (from d's log, in `log-excerpts.txt` in the repo):

```text
You are logged out. The last login error was: fetch control key: Get "http://127.0.0.1:18080/key?v=142": dial tcp 127.0.0.1:18080: connect: connection refused
```

d stayed off the network for the rest of the outage. The client keeps its keys on disk, but without the cache it does not keep the network map: the list of peers, their addresses and the packet filter only live in memory. Without the control server, a restarted client knows who it is but not who anyone else is. It kept retrying, and once the control server was back it logged in again by itself, within 3 to 4 seconds according to its own log.

During a control incident, the devices that restart are exactly the ones that disappear. A device that is replaced rather than restarted, such as a new Kubernetes node or a container without persistent state, is in the same position as c: it has never been on the network and cannot join until control is back.

### Netmap caching fixes it

Tailscale has a fix: **netmap caching**. With it, each client writes its network map to disk and loads it at startup. Tailscale's [September 22 post](https://tailscale.com/blog/making-tailscale-faster) says it is a feature flag in the current client and is expected to be on by default from version 1.104, after more testing (mobile clients later). The cache only helps a device that restarts with its state directory intact; a fresh replacement has nothing cached.

In the 1.102 client we tested, the switch is on the server side. The client only writes the cache when the control server grants it the `cache-network-maps` node attribute. The `TS_USE_CACHED_NETMAP` environment variable defaults to on and works as an off switch. Headscale 0.29 passes node attributes through from its policy file, so turning it on was one block:

```json
{
  "acls": [{ "action": "accept", "src": ["lab@"], "dst": ["lab@:*"] }],
  "nodeAttrs": [{ "target": ["*"], "attr": ["cache-network-maps"] }]
}
```

d then kept nine files under its state directory (`profile-data/<id>/netmap-cache/`), covering itself, its peers, the user, the packet filter, the DERP map and DNS. With the cache on, the same restart came back like this:

```text
Start: loaded netmap from disk cache; 3 peers
t=352s restarted d's tailscaled while control is down: state Running, ip 100.64.0.3, netmap cache files: 9
```

The first line is from d's log (`log-excerpts.txt`), the second from the outage script, both from the same 10-minute run.

d had its address immediately, but peers could not reach it straight away. A restarted client gets a new disco key (the key Tailscale uses for path discovery), and peers normally learn it from the control server. With the cache, the client advertises the new key to its peers directly over the tunnel instead; the logs show `sending TSMP disco key advertisement` and the peers receiving it. We timed how long until a could reach d again, with a retrying constantly (a failed attempt times out after 5 seconds, and the next one starts a second later):

| Restart (netmap cache on) | Port            | Outage before the first restart | a reaches d again after |
| ------------------------- | --------------- | ------------------------------- | ----------------------- |
| 3 restarts                | new random port | under 1 minute                  | 19 s, 16 s, 15 s        |
| 3 restarts                | same fixed port | under 1 minute                  | 19 s, 15 s, 15 s        |
| 3 restarts                | new random port | 6 minutes                       | 140 s, 15 s, 17 s       |
| 3 restarts                | same fixed port | 6 minutes                       | 18 s, 15 s, 16 s        |

```chart
{
  "type": "dots",
  "title": "Time until a peer reaches a restarted node, control server down",
  "unit": "s",
  "caption": "12 restarts with the cache-network-maps attribute, Tailscale 1.102.4 and Headscale 0.29.4. Measured from when the restarted daemon answered, with a new attempt about every 6 s. Without the cache, the node was still unreachable after 300 s.",
  "series": [
    { "name": "new random port", "samples": [19, 16, 15, 140, 15, 17], "median": 16.5 },
    { "name": "same fixed port", "samples": [19, 15, 15, 18, 15, 16], "median": 15.5 }
  ]
}
```

Eleven of the twelve restarts were reachable again in 15 to 19 seconds. One took 140 seconds, on a clean setup, so slow recoveries do happen. The restarts run one after another, so only the first in each row waited the full outage time; within that limit, a longer outage made no consistent difference, and neither did keeping the same UDP port.

Does the recovered path last? We restarted d once more and probed every 30 seconds for 10 minutes, once with a fixed port and once with a random port. Both times the first probe, right after the restart, failed, and the next 19, over the following 10 minutes, all reached d. In our 10-minute cache outage run, though, d answered for two minutes after its restart, then failed two probes in a row (at 484 and 559 seconds) and only answered again at 630 seconds, just before control returned. We could not reproduce that, so treat a cached restart as a big improvement, not a guarantee.

Without the cache, the same test (fixed port) gave up after 300 seconds.

The cache has a security side. The packet filter is on disk too, so a restarted node enforces the rules it had cached, not newer ones. That is the same trade-off a running node already makes during an outage, now extended across restarts.

## When the control server comes back

Recovery was fast and needed no help, except for the expired key. From the 10-minute run without the cache:

```text
16:21:27 control server back
16:21:48 c (tried to join during the outage) gets an address after 21s
16:21:55 a->c reachable after 7s
16:21:55 a->b ok (hello from b) | b->a ok (hello from a)
16:21:55 a->d (restarted during the outage) reachable after 0s
16:22:00 a->e (key expired during the outage): FAIL; e's state: Logged out.
16:22:01 admin clears e's expiry: a->e reachable after 1s
```

## With the control server up, access changes are fast

The flip side is how quickly the control plane enforces a change when it is up. We changed the policy so that a may no longer reach b, reloaded Headscale with `SIGHUP`, and probed again and again until the result changed. Then we restored it, and then deleted b:

```text
17:04:59 policy changed to block a->b: blocked after 6s
17:05:00 policy restored: a->b works again after 1s
17:05:06 node b deleted: a->b blocked after 5s
```

In both blocking cases the first probe after the change already failed. The 5 to 6 seconds is mostly that probe's own 5-second timeout. So with the control server up, a policy change or a removed device takes effect in seconds. With it down, it does not take effect at all. Your access control is only as live as your control plane.

This is also where **ACLs as code** pays off. A policy file in Git, reviewed and applied by CI, is a common way to run both Tailscale and Headscale. During an outage you cannot apply it, but once control is back, the reviewed version goes out in seconds. Git tells you which policy you intended at any point; it does not prove that every device received it, so check from the devices too.

## What we got wrong first

Three mistakes in our first runs are worth sharing, because they are easy to make in your own health checks:

1. **We restarted half of the long-lived pair.** The first run used b both as a long-lived peer and as the restart target, so after about six minutes the "do existing tunnels survive?" measurement was gone. We added d as a separate restart target and ran it again.
2. **Our recovery script read d's address once, at the start.** A node restarted without a cache has no address until it logs in again, so every probe went to an empty address, and the script reported that d never recovered. d's own log showed it had logged in again seconds after control returned. If you write tailnet health checks, look up addresses on every attempt.
3. **Our first probe accepted any response, and our restart check misread a logged-out client.** A review of the scripts pointed out that the probe only checked for a non-empty body; it now requires curl to succeed and the page to name the node we meant to reach. The restart helper used `tailscale status`, which exits with an error when a node is logged out, so it reported the uncached restart as a failed start instead of measuring it; it now uses `tailscale status --json`. Every number in this post comes from runs with the fixed scripts.

## What this means if you are replacing a VPN

- **Count the control plane in your access path.** For Tailscale's hosted service, that means their availability. For Headscale, it is one process with one database, so back up the database and treat upgrades like any other change.
- **Turn on netmap caching** where your client and control server support it, or plan to upgrade to the release where it is the default. In our tests, without it, a restart during the outage took the device off the network until control returned.
- **Do not restart clients during a control incident.** Pause automatic client updates and node rotation until control is back.
- **Choose key expiry on purpose.** Expiry limits the damage of a stolen key and also turns a long control outage into lost devices. Decide per device class, and alert before keys expire.
- **Keep a way to contain a device that does not need the control plane**, such as host firewalls or cloud security groups in front of your most sensitive servers that you can change without the mesh. Revoking sessions at your identity provider helps for applications that check it, but it does not close the network path.
- **Monitor real traffic**, not the self status. `tailscale status` called a working node offline.

## What we could not test

- **Relays.** Everything ran on one host, and the client status showed direct paths; we did not force relayed connections. If your traffic goes through DERP relays, and especially if you run the relay on the same host as Headscale, an outage may take the relays down as well. We did not measure that.
- **Other products.** NetBird, ZeroTier, Twingate and Teleport split control and data differently. The questions in this post (joins, revocation, expiry, restarts) are the right ones to ask of any of them, but our numbers only describe Tailscale clients with a Headscale control server.
- **Tailscale's hosted control plane.** It may roll out features like netmap caching differently from Headscale.
- **Long outages.** Our longest was 30 minutes. Anything key-related scales with your expiry settings, not with our test.

## Summary

- With the control server down for 30 minutes, existing tunnels kept working in both directions on every probe.
- New devices could not join, and nobody could revoke a device. Revocation is the real security cost of the outage.
- Key expiry is enforced by the peers. A key that expires during an outage takes its device off the network until someone re-authenticates it.
- Without the netmap cache, a client restarted during the outage came back with no peers and stayed off the network until control returned. With it (the `cache-network-maps` node attribute, expected as the default from Tailscale 1.104), peers reached it again in 15 to 19 seconds in 11 of 12 restarts, and it stayed reachable in two 10-minute checks (one earlier run saw an unexplained two-minute drop).
- With the control server up, a policy change or a deleted device took effect at the first probe, within seconds.
