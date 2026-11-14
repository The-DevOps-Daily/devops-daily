---
title: 'Node.js November 2026 Security Release: How We Tracked and Patched It'
excerpt: 'Node.js 22.23.5, 24.22.3 and 26.13.1 fix 16 CVEs, seven of them high severity in HTTP/2 and TLS. Here is what was fixed, who should upgrade first, the 15-minute watcher that told us the release was out, and the nvm, pm2 and systemd steps we used to move production in minutes.'
category:
  name: 'Security'
  slug: 'security'
date: '2026-11-11'
publishedAt: '2026-11-11T17:50:00Z'
updatedAt: '2026-11-11T17:50:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Security
  - Node.js
  - CVE
  - pm2
  - Patch Management
  - Linux
  - systemd
---

On 4 November 2026 the Node.js project posted a pre-alert: new releases of the 26.x, 24.x and 22.x lines "on or shortly after, Wednesday, November 11, 2026", and "The highest severity issue fixed in this release is HIGH". No CVE numbers, no components, nothing to triage against. You know a fix is coming, you know it matters, and you do not know when it lands or what it touches.

That gap is where most patch delays come from. The release ships in the afternoon, nobody is watching, and the upgrade happens days later. This time we wrote a small watcher for the release, saw Node.js 24.22.3 appear at 16:58 UTC on release day, and had production on the new version with smoke tests passing 14 minutes later.

This post covers what the release fixes and who should move first, the watcher script, the exact nvm, pm2 and systemd steps we used, and the checklist we will reuse for the next one.

## TL;DR

- **Fixed versions:** Node.js **22.23.5**, **24.22.3** and **26.13.1**. `https://nodejs.org/dist/index.json` marks all three as security releases.
- **What was fixed:** 16 CVEs: 7 high, 6 medium, 3 low. All seven high-severity ones are in HTTP/2 and TLS handling: remote crashes, server memory sent to the peer, and a client-certificate bypass. llhttp, undici, sqlite and brotli were updated too.
- **Move first:** any Node process that terminates TLS or serves HTTP/2 to untrusted clients. Everyone on 22, 24 or 26 should upgrade. End-of-life lines get no fix.
- **Watch for it:** poll `dist/index.json` every 15 minutes, or subscribe to the `nodejs-sec` list and the vulnerability RSS feed.
- **Upgrade order under nvm and pm2:** install, reinstall pm2, back up `dump.pm2`, move apps one at a time with a health check, then move the pm2 daemon by restarting its systemd unit. Do not use `pm2 update` for that last step.

## Prerequisites

- A Linux host running Node.js apps installed with **nvm** and supervised by **pm2**
- A systemd unit for the pm2 daemon (the one `pm2 startup` generates)
- Shell access as the app user, plus root for the unit
- `curl` and `python3` for the watcher and the checks
- A health endpoint per app and a smoke test you trust

## The announcement and the release

Node.js security releases follow a fixed pattern. About a week ahead, a pre-alert goes up at [nodejs.org/en/blog/vulnerability](https://nodejs.org/en/blog/vulnerability/november-2026-security-releases) with the target date, the affected lines, and the highest severity. The details stay private until the fixed builds are out, so nobody can work out the bugs from the patch before you can install it.

For this release:

- **4 November:** pre-alert published. 26.x, 24.x and 22.x, highest severity HIGH.
- **11 November, afternoon UTC:** the builds appeared in `dist/index.json` with `"security": true`.
- **11 November, 17:11 UTC:** the advisory page was updated with the full CVE list (the time comes from the nodejs.org repository history).

So the binaries were downloadable before the write-up existed. If you wait for the blog post, you start later than you need to.

You can confirm the fixed versions yourself:

```bash
curl -s https://nodejs.org/dist/index.json | python3 -c '
import sys, json
for r in json.load(sys.stdin):
    if r["version"] in ("v26.13.1", "v24.22.3", "v22.23.5"):
        print(r["version"], r["date"], "security:", r["security"])'
```

```text
v26.13.1 2026-11-10 security: True
v24.22.3 2026-11-10 security: True
v22.23.5 2026-11-11 security: True
```

The `date` field is the build date, which is why two of them show the day before release.

## What was fixed

The advisory lists 16 CVEs. Severity and affected lines below are as the advisory states them.

| CVE             | Component        | Severity | Lines      | What it does                                                                                                                                    |
| --------------- | ---------------- | -------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| CVE-2026-123863 | HTTP/2           | High     | 24, 26     | Any unauthenticated client can abort the server through an assertion in session teardown, over TLS or cleartext                                 |
| CVE-2026-123864 | HTTPS            | High     | 22, 24, 26 | A zero-length TLS write re-enters the HTTP parser; memory from other connections, including TLS private keys, can be copied into a request body |
| CVE-2026-123865 | HTTP/2           | High     | 22, 24, 26 | A protocol error during shutdown leaves the session behind; memory and file descriptors leak with no further cost to the attacker               |
| CVE-2026-123866 | HTTP/2           | High     | 22, 24, 26 | Stream teardown during a backpressured write sends freed memory to the peer                                                                     |
| CVE-2026-126051 | TLS              | High     | 24, 26     | Remote crash in TLS servers that use `SNICallback`, `OCSPRequest`, `newSession`, `resumeSession` or `server.addContext()`                       |
| CVE-2026-123872 | TLS              | High     | 22, 24, 26 | TLS 1.2 renegotiation can change the servername and carry client-certificate auth to a stricter host                                            |
| CVE-2026-123874 | HTTP/2           | High     | 24, 26     | Use-after-free when a `respondWithFile()` or `respondWithFD()` stream is reset during a pending write                                           |
| CVE-2026-123828 | HTTP/2           | Medium   | 24, 26     | One-byte heap overflow in `session.altsvc()` with a long origin                                                                                 |
| CVE-2026-123867 | TLS (mTLS)       | Medium   | 22, 24, 26 | A CA-only SNI context falls back to the default client CA, bypassing per-host mTLS                                                              |
| CVE-2026-123868 | HTTP/2           | Medium   | 24, 26     | Queued inbound DATA is not charged to `maxSessionMemory`, so one stream can hold hundreds of megabytes                                          |
| CVE-2026-123871 | HTTP proxy       | Medium   | 22, 24, 26 | Proxy credentials appear in `ERR_PROXY_INVALID_CONFIG` error messages                                                                           |
| CVE-2026-123877 | https.Agent      | Medium   | 22, 24, 26 | A TLS session from the default trust store can be reused by a request with a stricter `ca` policy                                               |
| CVE-2026-123875 | HTTP/2           | Medium   | 22, 24, 26 | Cancelling a `respondWithFile()` download crashes the server                                                                                    |
| CVE-2026-123829 | Permission Model | Low      | 22, 24, 26 | Recursive `fs.watch` leaks names of denied files (macOS and Windows)                                                                            |
| CVE-2026-123862 | zlib             | Low      | 22, 24, 26 | `params()` plus `destroy()` throws an uncatchable assertion                                                                                     |
| CVE-2026-106071 | Permission Model | Low      | 22, 24, 26 | A wildcard filesystem grant can match paths it should not                                                                                       |

The release notes also update **llhttp** to 9.4.4 on all three lines, **sqlite** to 3.54.1, **undici** to 7.30.2 on 24.x and 8.12.4 on 26.x, and **brotli** to 1.2.1 on 24.x and 26.x.

:::note
The advisory and the release notes do not match exactly on the low-severity Permission Model items. The release notes list CVE-2026-123873 ("permission: check heap snapshot destination") and do not mention CVE-2026-106071. If you run with `--permission`, read both. The action is the same either way: upgrade.
:::

## Who should upgrade first

Everyone on 22.x, 24.x or 26.x should upgrade. End-of-life lines such as 20.x and 25.x get no fixed release, and the advisory notes that end-of-life versions are always affected. Use the following order to decide what moves first.

1. **Node terminates TLS or speaks HTTP/2 to the internet.** `https.createServer`, `http2.createSecureServer`, `http2.createServer`, `tls.createServer`, or a framework option that enables them. Most of the high-severity bugs sit here, and several need nothing more than a default server.
2. **mTLS with per-host policies.** CVE-2026-123872 and CVE-2026-123867 are authorization bypasses, not just crashes.
3. **Everything else.** If a reverse proxy terminates TLS and talks plain HTTP/1.1 to Node, the HTTP/2 and TLS server bugs are not reachable from clients. The client-side fixes (`https.Agent` session reuse, proxy credentials in error messages, the undici update) still apply.

Two quick checks tell you where you stand. First, which Node processes listen, and on which address:

```bash
# Run as root so ss can see every process
ss -ltnpH | while read -r _ _ _ addr _ users; do
  pid=$(echo "$users" | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)
  [ -n "$pid" ] || continue
  exe=$(readlink "/proc/$pid/exe" 2>/dev/null)
  case "$exe" in */node) echo "$addr  $exe" ;; esac   # match the binary, not the process name
done
```

Anything bound to `0.0.0.0`, `[::]` or `*` is reachable from outside the host unless a firewall says otherwise. Second, which code paths you use:

```bash
grep -rnE 'https\.createServer|http2\.create(Secure)?Server|tls\.createServer|respondWith(File|FD)|SNICallback|addContext|altsvc|flushHeaders' \
  --include='*.js' --include='*.mjs' --include='*.cjs' --include='*.ts' src/
```

No hits does not make you safe from the client-side fixes, but it does tell you how urgent the rest is.

## How we watched for the release

The pre-alert gives a date, not a time. We did not want someone refreshing a browser tab all day, and we did not want a cron entry to remember to delete afterwards. So we started one background script on release morning that polls `dist/index.json` every 15 minutes, stops after about 16 hours, and exits as soon as a new 24.x shows up.

```bash
#!/bin/bash
# node-release-watch.sh: poll nodejs.org until a Node 24 release newer than
# the current newest 24.x appears. Every 15 minutes, gives up after ~16 h.
LATEST=v24.22.2   # the newest 24.x when you start the watcher
for i in $(seq 1 64); do
  # index.json is sorted newest first, so the first v24.* entry is the latest 24.x
  v=$(curl -s -m 20 https://nodejs.org/dist/index.json | python3 -c 'import sys,json; d=json.load(sys.stdin); print(next(x["version"] for x in d if x["version"].startswith("v24.")))' 2>/dev/null)
  if [ -n "$v" ] && [ "$v" != "$LATEST" ]; then echo "NEW NODE 24: $v ($(date -u +%H:%M) UTC)"; exit 0; fi
  sleep 900
done
echo "no new Node 24 release after 16 h"
```

```terminal
{
  "title": "release day",
  "prompt": "$",
  "steps": [
    { "comment": "start it in the background and forget about it" },
    { "cmd": "chmod +x node-release-watch.sh" },
    { "cmd": "nohup ./node-release-watch.sh > node-watch.log 2>&1 &" },
    { "comment": "hours later" },
    { "cmd": "cat node-watch.log", "output": "NEW NODE 24: v24.22.3 (16:58 UTC)" }
  ]
}
```

A few notes if you adapt it:

- A failed `curl` or a bad JSON response leaves `v` empty, so a network blip does not trigger a false alert.
- Swap the `echo` for a call to your chat webhook if you want a ping instead of a log line.
- To wake only for security releases, add `and x["security"]` to the filter and set `LATEST` to the newest 24.x security release.
- For the long term, subscribe to the low-volume `nodejs-sec` mailing list and the [vulnerability RSS feed](https://nodejs.org/en/feed/vulnerability.xml). They tell you a release is coming. The watcher tells you the moment it is downloadable.

## How we upgraded

Our Node apps run on a Linux VM. Node comes from nvm, pm2 supervises the apps, and the pm2 daemon starts at boot from the systemd unit that `pm2 startup` generated. The timeline on 11 November, in UTC:

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "16:58", "sub": "watcher sees v24.22.3", "icon": "activity", "tone": "amber" },
    { "label": "17:00", "sub": "nvm install, pm2, dump backup", "icon": "gear", "tone": "blue" },
    { "label": "17:02", "sub": "apps moved one by one", "icon": "box", "tone": "blue" },
    { "label": "17:03", "sub": "move the pm2 daemon", "icon": "server", "tone": "violet" },
    { "label": "17:12", "sub": "all on 24.22.3, smoke tests pass", "icon": "check", "tone": "green" }
  ]
}
```

### Step 1: install the new version and pm2

As the app user:

```bash
nvm install 24.22.3
nvm alias default 24.22.3
nvm use 24.22.3
npm install -g pm2@6.0.13          # same pm2 version you run now; globals are per Node version under nvm
cp ~/.pm2/dump.pm2 ~/.pm2/dump.pm2.bak-$(date -u +%Y%m%dT%H%M)
```

Under nvm, global packages live inside each Node version, so the new Node has no pm2 until you install it. The new `pm2` CLI then talks to the old daemon, which is fine for now.

### Step 2: find out how each entry picks its Node

This is the part that decides whether a restart moves an app. pm2 stores an interpreter per entry:

```bash
pm2 jlist | python3 -c '
import sys, json
for p in json.load(sys.stdin):
    e = p["pm2_env"]
    print(p["name"], e.get("exec_mode"), e.get("exec_interpreter"), e.get("node_version"), sep="\t")'
```

- **Bare `node`, fork mode:** resolved through `PATH`. A restart with `--update-env` picks up the new version.
- **An absolute path** such as `/home/app/.nvm/versions/node/v24.22.2/bin/node`: written in when the app was started with `--interpreter`, or copied from the daemon's own Node. A restart reuses that path, so the entry has to be deleted and started again. If the ecosystem file hard-codes the path, fix the file first.
- **Cluster mode** (`exec_mode` is `cluster_mode`): the daemon forks the workers itself, so they run on the daemon's Node whatever the entry says. They move when the daemon moves in step 4.

### Step 3: move apps one at a time

One app, one health check, then the next. If a check fails, you stop with one app affected and the rest still serving. Run it as a script, so `exit` stops it at the first failure.

```bash
health() {  # health <name> <port> [path]: retry up to 30 times until a 200
  for i in $(seq 1 30); do
    [ "$(curl -s -o /dev/null -w '%{http_code}' -m 5 "http://127.0.0.1:$2${3:-/}")" = 200 ] && { echo "$1 ok"; return 0; }
    sleep 2
  done
  echo "$1 NOT healthy on :$2"; return 1
}

# Bare "node" interpreter: --update-env passes the new PATH
pm2 restart web --update-env && health web 3000 || exit 1

# Absolute interpreter path: recreate the entry from the ecosystem file
pm2 delete api
pm2 start ecosystem.config.cjs --only api && health api 3001 || exit 1

pm2 save
```

Then check what each process actually runs. A 200 only tells you the app is up, not which Node it is on:

```bash
pm2 jlist | python3 -c 'import sys,json; [print(p["name"], p["pm2_env"].get("node_version"), p["pm2_env"]["status"], sep="\t") for p in json.load(sys.stdin)]'
```

Two minutes in, every app was on 24.22.3 except one. That entry had no interpreter set, and in that case pm2 starts the script with the **daemon's** Node. Cluster-mode apps behave the same way, since the daemon forks them itself. Restarting it changed nothing, because the daemon was still on the old version. So the daemon had to move too.

### Step 4: move the pm2 daemon through systemd

The unit that `pm2 startup` writes has the Node version in it twice: in `Environment=PATH=` and in the path to the pm2 binary. Point both at the new version, as root:

```bash
UNIT=/etc/systemd/system/pm2-app.service
cp "$UNIT" "$UNIT.bak"
sed -i 's#/node/v[0-9][0-9.]*/#/node/v24.22.3/#g' "$UNIT"
grep -n '/node/v' "$UNIT"     # every match should now say v24.22.3
systemctl daemon-reload
```

Then restart the daemon through the unit:

```bash
# As the app user, with the new pm2 on PATH
pm2 save
cp ~/.pm2/dump.pm2 ~/.pm2/dump.pm2.pre-daemon
pm2 kill                      # no daemon left for resurrect to attach to

# As root
systemctl restart pm2-app     # ExecStart runs "pm2 resurrect" on the new Node
```

`pm2 kill` stops every app, and `pm2 resurrect` starts them all again from the dump, so plan for a short gap. Give it 30 to 60 seconds before you check.

:::tip
**Don't use `pm2 update` for this. Restart the systemd unit instead.** `pm2 update` relaunches the daemon from your shell, on the Node that runs the pm2 CLI there. From a login shell or `sudo`, that can be an older version still installed on the box, and the new daemon then runs outside the unit that starts it at boot. The unit has the version written into it and is the same path a reboot takes, so restarting it gives the same result every time. If the daemon ever comes back without your apps: `pm2 kill`, copy `dump.pm2.pre-daemon` back to `~/.pm2/dump.pm2`, and restart the unit.
:::

### Step 5: verify from /proc, then smoke test

pm2's view is a good start. The kernel's view is the one that counts. As root:

```bash
# The real binary of every Node process on the host, grouped
for p in /proc/[0-9]*; do
  exe=$(readlink "$p/exe" 2>/dev/null) || continue
  case "$exe" in */node) echo "$exe" ;; esac
done | sort | uniq -c

# The daemon itself
readlink "/proc/$(cat /home/app/.pm2/pm2.pid)/exe"
```

Every line should end in `v24.22.3/bin/node`. Then run the external smoke tests against the public URLs, not localhost. Ours passed at 17:12 UTC, 14 minutes after the watcher fired.

Once the new version has run cleanly for a day, remove the old ones with `nvm uninstall`. An old Node left on the box is something a shell, a script or a daemon can fall back to without telling you. Until you remove it, check `which node` in every shell you work from, including root's.

## The rest of the fleet

The production host is the urgent part. The rest follows on its own schedule:

- **CI:** `actions/setup-node` with `node-version: 24` picks up 24.22.3 without workflow changes once the runner's tool cache has it. If you want it today rather than when the runner image refreshes, pin `node-version: '24.22.3'`. `check-latest: true` helps too, but the version manifest it reads can lag nodejs.org.
- **Container images:** they need a rebuild. At the time of writing, Docker Hub had no `24.22.3-slim` tag yet and `node:24-slim` was last updated on 5 November, so a rebuild right now would still get the old Node. Check before you rebuild, then use `docker build --pull` and confirm with `docker run --rm --pull always node:24-slim node -v`.

```bash
curl -s https://hub.docker.com/v2/repositories/library/node/tags/24.22.3-slim |
  python3 -c 'import sys,json; print(json.load(sys.stdin).get("last_updated", "not published yet"))'
```

- **Dev machines:** last, since they do not serve untrusted traffic. `nvm install 24.22.3 && nvm alias default 24.22.3`.

For a full audit of every place Node hides on a host (cron jobs, helper scripts, child processes, systemd units with old paths), see our [October 2026 post on finding every Node you run](/posts/node-october-2026-security-release-find-every-node).

## Checklist for the next Node.js security release

**When the pre-alert lands**

1. Note the date, the affected lines and the highest severity.
2. List every host, image and pipeline that runs those lines.
3. Run the exposure checks above to decide the order.
4. Check each pm2 entry's interpreter, and fix ecosystem files that hard-code a Node path.

**On release day**

5. Start the watcher in the morning, and confirm the fixed versions and `"security": true` in `dist/index.json`.
6. `nvm install` the new version, `nvm alias default`, reinstall pm2 under it.
7. Back up `~/.pm2/dump.pm2`.
8. Move apps one at a time: `restart --update-env` for bare `node`, delete and start for absolute paths. Health check each one, then `pm2 save`.
9. Check `node_version` in `pm2 jlist` for every app.
10. Point the systemd unit at the new version, `daemon-reload`, `pm2 kill`, `systemctl restart`. Never `pm2 update`.
11. Verify from `/proc`, then run external smoke tests.

**After**

12. Rebuild container images once the new tag is on Docker Hub, with `--pull`.
13. Make sure CI runs the new version (pin the exact version on release day).
14. Update dev machines.
15. After a day on the new version, `nvm uninstall` the old ones so nothing can fall back to them.

The watcher is what made this fast: it cost nothing to run, and we started within minutes of the release instead of hours. The per-app health checks made every step safe to stop. Keep the checklist somewhere you will find it next time.
