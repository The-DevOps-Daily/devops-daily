---
title: 'Node.js October 2026 Security Release: Finding Every Node You Actually Run'
excerpt: 'Node.js 22.23.4, 24.22.1 and 26.12.1 fix a Brotli decoder bug that the project says permits remote code execution, plus TLS and DNS bugs. The version bump is one line. pm2 entries, the pm2 daemon, systemd units, cron jobs and containers each keep their own Node, so here is how to find every one and prove it moved.'
category:
  name: 'Linux'
  slug: 'linux'
date: '2026-10-22'
publishedAt: '2026-10-22T09:00:00Z'
updatedAt: '2026-10-22T09:00:00Z'
readingTime: '17 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Linux
  - Node.js
  - Security
  - pm2
  - Patch Management
  - CVE
  - Docker
---

On 21 October 2026 the Node.js project released 22.23.4, 24.22.1 and 26.12.1. The headline fix is CVE-2026-111497, an out-of-bounds write in the Brotli decoder that the advisory says "permits remote code execution". The same release fixes two TLS certificate hostname-check bypasses, a DNS bug that truncates names at a NUL character, and updates the bundled CA store. End-of-life lines get no fix.

Patching Node is a one-line version bump. Finding every Node your servers actually run is the work. When we patched a small production box on release day, six Node apps under pm2 installed with nvm, installing the new version was the easy part. Then we found pm2 entries with the old binary written into them, a systemd unit with the old `PATH` hard-coded, child processes we had not thought about, and cron jobs on two other boxes that pointed at the old install by absolute path. None of them moved when the default version changed.

This post covers what to do now, who is exposed (including services that call `fetch()` on a URL a user controls), the upgrade steps for nvm, pm2, systemd and containers with the traps we hit, how to verify with `/proc`, and a read-only audit script with its real output from one of our machines.

## What to do now

1. **Upgrade every Node** to 22.23.4, 24.22.1 or 26.12.1 or later. Node 20, 25 and older are end-of-life and get no fixed release. Move them to 22, 24 or 26.
2. **List every place Node runs or will start**: running processes, pm2 entries (live and saved), the pm2 daemon, systemd units, crontabs and helper scripts, and containers. Changing the nvm default moves none of them.
3. **Move each one** with the steps below, then check the real binary of every process in `/proc`. Process names do not help: on our build machine `pgrep node` found 0 of 5 Node processes.
4. **Rebuild images** with `--pull` and redeploy. The official `node:22`, `node:24` and `node:26` tags have the fix. `node:20`, `node:25` and `node:18` will not get it.
5. **If a service cannot be upgraded today** and accepts Brotli data from strangers, close that path in front of it (details below). For outbound `fetch()` the fix is the upgrade; until then, turning off features that fetch user-supplied URLs is the way to close that path.
6. **Run the audit script** on every host and keep the output.

## Prerequisites

- Shell access to the hosts that run Node, as the user that owns the Node processes. Root is not needed.
- Python 3.8 or newer for the audit script. It uses only the standard library and only reads.
- The `docker` or `podman` CLI on hosts that run Node in containers.

## What was fixed

The [advisory](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases) lists ten vulnerabilities. The four rated high:

| CVE             | What the advisory calls it                                                      | Lines      |
| --------------- | ------------------------------------------------------------------------------- | ---------- |
| CVE-2026-111497 | Brotli decoder out-of-bounds write permits remote code execution                | 22, 24, 26 |
| CVE-2026-105483 | TLS certificate hostname bypass when the IP is written in fullwidth digits      | 24, 26     |
| CVE-2026-106069 | TLS certificate hostname bypass when the host loosely resolves to an IP address | 22, 24, 26 |
| CVE-2026-105482 | `dns.resolve` truncates names containing a NUL character                        | 22, 24, 26 |

The medium ones are a keep-alive socket that processes a response written before the request was sent (CVE-2026-105481), DNS SANs that can authenticate IP endpoints written in a non-canonical IPv4 form (CVE-2026-106072), and `crypto.randomUUID()` and `randomInt()` caches saved into startup snapshots and single executable applications, so that every process repeats the same values (CVE-2026-106074). The low ones are two Permission Model bypasses and a ZIP header issue on 26.x.

The release also updates the bundled root certificates to NSS 3.131.1 and makes Node reject certificate chains that contain blocked public keys. The advisory lists this as the "ca-cert (eMudhra Intermediate CA Compromise)" update. The bundled undici, c-ares and OpenSSL (22 and 24) are updated too.

Two things the advisory does not give you yet. There is no technical detail on any of the bugs, and on the morning of 22 October all ten CVE IDs were still in the RESERVED state at CVE.org, with no NVD record. So there is no CVSS score; "high" is the Node.js project's rating.

The timeline in UTC, from the release metadata:

- **21 Oct, 10:32 to 10:36**: the fixed binaries on nodejs.org/dist are dated in this window. The GitHub releases were published at 10:38.
- **10:48**: the update to the official Docker images was committed.
- **about 11:35**: the Debian-based official images were built. Docker Hub shows the amd64 and arm64 images as pushed at about 14:40.
- **19:27**: the Brotli project released 1.2.1, 1.1.1 and 1.0.10, each with "CVE-2026-111497: out-of-bounds write permits remote code execution" in the notes. So the bug is in the Brotli decoder itself, and Node shipped the upstream fix as a cherry-picked commit.
- **22:58 to 00:08**: the Alpine-based official images were built, about 12 to 13.5 hours after the release.

## Who is exposed

### Brotli: any Node process that decodes Brotli someone else chose

The decoder is compiled into the `node` binary and sits behind `node:zlib`. Every way into it counts, and three are common:

1. **Your code decompresses Brotli directly**: `zlib.brotliDecompress()`, `brotliDecompressSync()` or `createBrotliDecompress()` on uploads, archives, cache entries or messages.
2. **Your service fetches URLs.** `fetch()` in Node is the bundled undici, and it decodes responses that say `Content-Encoding: br` [with `zlib.createBrotliDecompress`](https://github.com/nodejs/node/blob/v24.22.1/deps/undici/src/lib/web/fetch/index.js#L2256-L2260). It goes by the response's header, whatever the request asked for, so setting `Accept-Encoding: identity` does not keep Brotli away from a hostile server. axios in Node [does the same](https://github.com/axios/axios/blob/v1.20.0/lib/adapters/http.js#L1179-L1209) unless you pass `decompress: false`. Link previews, webhook testers, feed readers, "import from URL" features and AI agents that browse are all services that fetch a URL a user chose.
3. **Your service accepts compressed request bodies.** body-parser 2 [decompresses `br` request bodies](https://github.com/expressjs/body-parser/blob/v2.3.0/lib/read.js#L190-L224) that it parses, and its `inflate` option defaults to `true`. Express 5 ships body-parser 2, so `express.json()` on Express 5 decodes Brotli bodies sent with a JSON content type, from any client. Express 4 uses body-parser 1.x, which handles only gzip and deflate.

Reaching the decoder is not the same as being exploitable, and the advisory does not say what input triggers the bug. These are the paths to upgrade or close first. Because the decoder is in the binary, no npm update fixes it. Upgrading the `undici` package in your `package.json`, for example, still decodes through the old Node's zlib.

If you cannot upgrade a service today, the interim options close only the paths you control:

```js
// Express 5: refuse compressed request bodies (415) until Node is upgraded.
// This also refuses gzip and deflate request bodies.
app.use(express.json({ inflate: false }));
```

```nginx
# In front of any Node service: refuse Brotli request bodies.
if ($http_content_encoding ~* "br") {
    return 415;
}
```

Distribution builds are different. Debian's `nodejs` package (we checked the trixie build of 20.19.2) is built with `--shared-brotli` against the system `libbrotli`, so on Debian the Brotli fix comes from the distribution's brotli package, not from the Node version number. At the time we checked, neither Debian's security tracker nor Ubuntu's notices listed CVE-2026-111497 yet. The audit script reports such builds as unknown rather than guessing.

### TLS hostname checks and DNS

When Node connects over TLS it checks the server's certificate against the host you asked for. Both high-severity TLS bugs are in that check when the host is, or loosely resolves to, an IP address written in a non-standard form: fullwidth digits (24 and 26 only) or a form that "loosely resolves to an IP address" (all lines). The fix makes Node reject non-canonical IP addresses. The advisory gives no more detail than that. Our reading is that the services to look at first are the ones where someone else chooses the host string: webhook senders, URL fetchers and integrations that connect to customer endpoints.

The DNS bug truncated names at a NUL byte in `dns.resolve*()`, and the fix rejects such input. Code that resolves names it got from users is where this matters.

### End-of-life lines

"End-of-Life versions are always affected when a security release occurs," says the advisory. Node 20 reached end of life on 30 April 2026 and Node 25 on 1 June 2026. Neither gets a fixed release, and the official `node:20` and `node:25` image tags stay on 20.20.2 and 25.9.0.

## Why changing the default moves nothing

nvm installs the new version next to the old one, which is what you want: the old one stays for rollback. `nvm alias default 24.22.1` then changes what **new shells** get. Nothing that is already running reads that alias, and nothing that stored a path to the old install reads it either.

```diagram
{
  "type": "branch",
  "nodes": [
    { "label": "nvm install 24.22.1", "sub": "next to the old version", "icon": "box", "tone": "blue" },
    { "label": "nvm alias default", "sub": "new shells get it", "icon": "gear", "tone": "amber" },
    { "label": "What runs the new Node?", "sub": "check /proc, not config", "icon": "shield", "tone": "slate" }
  ],
  "branch": [
    { "label": "New shells, and pm2 apps restarted with --update-env from one", "variant": "good" },
    { "label": "pm2 daemon, cluster workers, absolute interpreters, systemd unit, cron, images: still old", "variant": "bad" }
  ]
}
```

On the production box, each of these needed its own step:

- **pm2 entries with an absolute interpreter.** Several entries had the old Node binary written into them as the interpreter, and the ones started as `npm` or `npx` had their script path under the old version's `bin` directory. Changing the default did not move them. They had to be deleted and recreated with the new interpreter.
- **pm2 entries with a bare `node` interpreter** took the new binary only after `pm2 restart <name> --update-env` from a shell where the new Node came first in `PATH`.
- **The pm2 systemd unit** that `pm2 startup` wrote had the old version's `PATH` and the old pm2 path hard-coded. After editing it, `pm2 update` moved the pm2 daemon itself, which restarts every app at once. The sites on that box were down for under a minute while the Next.js apps started.
- **Child processes.** Checking `/proc/<pid>/exe` for every process turned up chains such as `npx` to `tsx` to `node`, and `npm start` to `next-server`. Each process in a chain has its own binary.
- **Cron jobs and helper scripts** on two other boxes had absolute paths to the old Node.

## What pm2 really does on an upgrade

To check each of those behaviors on its own, `lab/pm2-pin-lab.sh` in the repo starts four throwaway apps in a separate `PM2_HOME` from a shell where Node v24.14.0 comes first in `PATH`: `bare` (`pm2 start server.js`), `via-npm` (`pm2 start npm -- start`, where the start script is `node server.js`), `abs` (`--interpreter` set to the old binary) and `clustered` (`-i 1`, cluster mode). Then it puts v24.22.1 first in `PATH`, as a changed nvm default does, and records the real binary of every process after each step. A plain `pm2 restart` left all four on v24.14.0. This is the state after `pm2 restart <name> --update-env` for each app:

```terminal
{
  "title": "pm2-pin-lab.sh, step B2",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "comment": "excerpt of results/pm2-lab-20261022T063002Z.txt (2026-10-22T06:30:02Z, aarch64, pm2 6.0.14)"
    },
    {
      "comment": "old: v24.14.0, new: v24.22.1 first in PATH; a plain restart left all four apps on v24.14.0"
    },
    {
      "cmd": "lab/pm2-pin-lab.sh <v24.14.0 bin> <v24.22.1 bin>",
      "output": "$ pm2 restart bare --update-env\n$ pm2 restart via-npm --update-env\n$ pm2 restart abs --update-env\n$ pm2 restart clustered --update-env\n\n== B2. pm2 restart --update-env from the new shell\ndaemon     pid 1937570 node v24.14.0   <v24.14.0>/bin/node\nbare       interpreter=node  script=<app>/server.js\n           saved PATH finds node in <v24.22.1>/bin\n  pid 1938284 node v24.22.1    <v24.22.1>/bin/node                          server.js\nvia-npm    interpreter=<v24.14.0>/bin/node  script=<v24.14.0>/bin/npm\n           saved PATH finds node in <v24.22.1>/bin\n  pid 1938375 node v24.14.0    <v24.14.0>/bin/node                          npm start\n    pid 1938462 dash (not node)  /usr/bin/dash                                sh -c node server.js\n      pid 1938468 node v24.22.1    <v24.22.1>/bin/node                          node server.js\nabs        interpreter=<v24.14.0>/bin/node  script=<app>/server.js\n           saved PATH finds node in <v24.22.1>/bin\n  pid 1938455 node v24.14.0    <v24.14.0>/bin/node                          server.js\nclustered  interpreter=node  script=<app>/server.js  (cluster mode)\n           saved PATH finds node in <v24.22.1>/bin\n  pid 1938518 node v24.14.0    <v24.14.0>/bin/node                          server.js"
    }
  ]
}
```

`bare` moved. `via-npm` is split: npm itself still runs on the old Node because pm2 stored the old binary as its interpreter, while its child `node server.js` got the new one from `PATH`. `abs` did not move. `clustered` did not move either, even though its saved `PATH` now finds v24.22.1: in cluster mode the daemon forks the workers with its own Node binary, so they move only when the daemon moves. All four steps, from `results/pm2-lab-20261022T063002Z.txt`:

| App                          | After `restart` | After `restart --update-env` | After delete and recreate | After `pm2 update` |
| ---------------------------- | --------------- | ---------------------------- | ------------------------- | ------------------ |
| `bare` (bare `node`)         | old             | new                          | not recreated: new        | new                |
| `via-npm` (npm path stored)  | old             | npm old, app new             | new                       | new                |
| `abs` (absolute interpreter) | old             | old                          | new                       | new                |
| `clustered` (cluster mode)   | old             | old                          | not recreated: old        | new                |
| pm2 daemon                   | old             | old                          | old                       | new                |

`pm2 update` restarted every app in one command: all four PIDs changed. On the production box that was the step where the sites went down. In the lab the command took 2.3 seconds; that measures the command, not how long the apps were unavailable, and real apps take as long as they take to start.

## Upgrade steps: nvm, pm2 and systemd

Run these as the user that owns the pm2 daemon.

```bash
# 1. Install next to the old version and bring global packages (pm2) along.
nvm install 24.22.1 --reinstall-packages-from=24.14.0
nvm alias default 24.22.1

# 2. Work from a shell where the new Node comes first in PATH.
nvm use 24.22.1
command -v node && node --version

# 3. See what each pm2 entry is pinned to.
pm2 jlist | python3 -c 'import json, sys
for a in json.load(sys.stdin):
    e = a["pm2_env"]
    print(a["name"], e.get("exec_mode"), e.get("exec_interpreter"), e.get("pm_exec_path"), sep="  ")'
```

Then move each entry according to what step 3 shows:

```bash
# Fork mode, interpreter "node": pick up the new PATH.
pm2 restart api --update-env

# Interpreter is an absolute path to the old node, or the script is
# .../v24.14.0/bin/npm or npx: delete and start it again from this shell
# (or from your ecosystem file with the same name and arguments).
pm2 delete web
pm2 start npm --name web -- start

# Save the list that a reboot brings back.
pm2 save

# Regenerate the startup unit: the old one hard-codes the old PATH and pm2 path.
pm2 unstartup     # prints a sudo command; run it
pm2 startup       # prints a sudo command; run it

# Move the daemon, and every cluster-mode app with it.
# This restarts ALL apps at once: do it in a quiet window.
pm2 update
```

The pm2 docs ask for the [`unstartup` and `startup` pair](https://pm2.keymetrics.io/docs/usage/startup/) after every Node upgrade. The new unit is pinned again, this time to the new version. That is fine, as long as something checks it at the next upgrade.

Two details are easy to miss. `pm2 save` writes the saved list, including each entry's environment, so if you save before `--update-env` the reboot copy keeps the old `PATH`. And the daemon only reads the systemd unit when systemd starts it. If someone started pm2 by hand, the fixed unit applies at the next boot, not now.

## Cron jobs and helper scripts

Cron runs with a minimal `PATH`, so jobs that need Node usually name it by absolute path, and that path names one install. The audit script below reads only your own `crontab -l`, so search the system crontabs and your scripts on every host too:

```bash
# Paths inside a versioned nvm, fnm, n, volta or asdf install
sudo grep -rnE '/(\.nvm/versions/node|node-versions|n/versions/node|\.volta/tools/image/node|installs/nodejs)/v?[0-9]+\.[0-9]+\.[0-9]+' \
  /etc/crontab /etc/cron.d /var/spool/cron /etc/systemd/system /usr/local/bin ~/bin 2>/dev/null
```

Update the path in each match. A job that points at a version you later uninstall stops running, which at least fails loudly; one that points at the old version you kept for rollback keeps running vulnerable and says nothing.

## Containers

A container keeps the Node it was built with. Rebuild with `--pull` so the builder fetches the new base image instead of a cached one, deploy by the new tag or digest, and check what is running:

```bash
docker build --pull -t registry.example.com/app:2026-10-22 .

docker ps --format '{{.ID}} {{.Names}}' | while read -r id name; do
  printf '%-30s %s\n' "$name" "$(docker exec -e NODE_OPTIONS= "$id" node --version 2>&1)"
done
```

`node --version` inside a container reports the `node` on the container's `PATH`. If an image carries more than one Node, `docker exec <id> readlink /proc/1/exe` shows which binary the container's main process runs (when the image has `readlink`).

The repo's `registry_scan.py` read the Node version of 24 official `node` tags for amd64 and arm64 from registry metadata only (manifest and image config, no layers) at 06:23 UTC on 22 October. Every 22, 24 and 26 tag we sampled, and the `latest`, `lts` and `alpine` aliases, shipped the fixed version. How long they took:

```chart
{
  "type": "bar",
  "title": "Official node images: hours from the release to build and to push",
  "unit": " h",
  "caption": "Reference: fixed binaries on nodejs.org/dist by 10:36 UTC on 21 Oct 2026. Built: the image config's created time. Pushed: Docker Hub's last_pushed time for that platform image, which is metadata, not proof of when a tag first served it. Latest value in each group of tags. Source: results/registry-20261022T062338Z-summary.txt.",
  "rows": [
    { "label": "Debian-based amd64: built", "value": 1.0, "series": "built" },
    { "label": "Debian-based amd64: pushed", "value": 4.1, "series": "pushed" },
    { "label": "Debian-based arm64: built", "value": 1.0, "series": "built" },
    { "label": "Debian-based arm64: pushed", "value": 4.1, "series": "pushed" },
    { "label": "Alpine amd64: built", "value": 12.4, "series": "built" },
    { "label": "Alpine amd64: pushed", "value": 13.1, "series": "pushed" },
    { "label": "Alpine arm64: built", "value": 13.5, "series": "built" },
    { "label": "Alpine arm64: pushed", "value": 16.1, "series": "pushed" }
  ],
  "series": [
    { "name": "built", "color": "#94a3b8" },
    { "name": "pushed", "color": "#f59e0b" }
  ]
}
```

If you rebuilt an Alpine-based image on the afternoon of 21 October, check it again: by this metadata the fixed Alpine images were built 12 to 13.5 hours after the release. The end-of-life tags will stay where they are: `node:18` (18.20.8, built March 2025), `node:20` (20.20.2, built April 2026) and `node:25` (25.9.0, built April and May 2026).

## Verify with /proc, not with names

pm2 renames its daemon to `PM2 v6.0.14: God Daemon` and Next.js renames its server to `next-server`, and on our build machine the plain `node` processes showed up as `MainThread`. Those names are what `pgrep` matches and what `top` shows. On that machine `pgrep -c node` returned 0 while five processes ran a `node` binary (`results/pgrep-vs-proc-20261022T063334Z.txt`). The kernel's link to the executable does not lie:

```bash
# Every process whose binary is node, with the binary it really runs (root sees all users)
for d in /proc/[0-9]*; do
  exe=$(readlink "$d/exe" 2>/dev/null) || continue
  case "${exe% (deleted)}" in */node|*/nodejs) ;; *) continue ;; esac
  printf '%-8s %-70s %s\n' "${d#/proc/}" "$exe" "$(tr '\0' ' ' < "$d/cmdline" | cut -c1-50)"
done

# The version of one of them, read from the binary without running it.
# Official builds compile in their headers URL. Do not run another user's
# binary with --version as root: that runs their code as root.
sudo grep -a -o -m1 -E 'node-v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?-headers\.tar\.gz' /proc/12345/exe
# node-v24.14.0-headers.tar.gz

# Its children, which have their own binaries
ps -o pid,args --forest -g "$(ps -o sid= -p 12345 | tr -d ' ')"
```

An exe that ends in `(deleted)` means the file was replaced on disk after the process started, so the process still runs the old code until it restarts. For more on that pattern, and on proving a runtime is patched when the version string can mislead, see [PHP2Shell: How to Check That Every PHP You Run Is Actually Patched](/posts/php2shell-check-every-php-is-patched).

## Run the audit script

```github
The-DevOps-Daily/node-runtime-audit
```

`node_runtime_audit.py` is one file of standard-library Python. Its sources are `/proc`, the output of `pm2 jlist` and `crontab -l`, systemd unit files, and `node --version` inside running containers; besides those it only runs `systemctl show` for pm2 units and `docker` or `podman` `ps` and `inspect`, and looks at file metadata. For every running process it reads the real binary through `/proc/<pid>/exe` and the version compiled into that file, which works for deleted binaries and for processes inside containers. By default it never runs a binary it finds on the host, and it does not open the Node binaries that pm2 entries, crontabs and units name: their version comes from a running process that uses the same file, or from the path as a hint, where a path that names an unfixed version counts as vulnerable and one that names a fixed version stays unknown. Files are pinned with `O_PATH` and checked before they are read, so a planted FIFO or device cannot stall it. Command lines and container names are printed with control characters escaped. Run it as the user that owns the Node processes; root is not needed.

This is the real output on the Raspberry Pi we build on, run as the user that owns the Node processes, with `--redact`, which hides user names and app names. By the time of this run, the fnm default, the crontab and the pm2 systemd unit had already been moved to v24.22.1:

```terminal
{
  "title": "node_runtime_audit.py on the Pi",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "comment": "2026-10-22T07:10:33Z Raspberry Pi (Debian 12, aarch64), Node via fnm, pm2 6.0.14, run as the user that owns the Node processes"
    },
    {
      "cmd": "python3 node_runtime_audit.py --redact",
      "output": "node-runtime-audit: Node.js security release of 2026-10-21, fixed releases v22.23.4, v24.22.1, v26.12.1\nlines without a fix (end-of-life) count as vulnerable\nnote: covers the processes, crontab and pm2 of USER; run it as each user that owns Node processes\n\nRunning Node processes (real binary from /proc/<pid>/exe)\n  [vulnerable]  pid 1883303  v24.14.0  USER       /home/USER/.local/share/fnm/node-versions/v24.14.0/installation/bin/node\n      cmd: PM2 v6.0.14: God Daemon (/home/USER/.pm2)\n      parents: systemd(1)\n      why: v24.14.0 < v24.22.1\n  [vulnerable]  pid 1883371  v24.14.0  USER       /home/USER/.local/share/fnm/node-versions/v24.14.0/installation/bin/node\n      cmd: node /home/USER/projects/app-1/node_modules/.bin/next dev\n      parents: bun(1883370) <- node(1883303) <- systemd(1)\n      why: v24.14.0 < v24.22.1\n  [vulnerable]  pid 1883390  v24.14.0  USER       /home/USER/.local/share/fnm/node-versions/v24.14.0/installation/bin/node\n      cmd: next-server (v16.2.6)\n      parents: node(1883371) <- bun(1883370) <- node(1883303) <- systemd(1)\n      why: v24.14.0 < v24.22.1\n  [vulnerable]  pid 1884634  v24.14.0  USER       /home/USER/.local/share/fnm/node-versions/v24.14.0/installation/bin/node\n      cmd: node /home/USER/projects/app-1/.next/dev/build/postcss.js 38963\n      parents: node(1883390) <- node(1883371) <- bun(1883370) <- node(1883303)\n      why: v24.14.0 < v24.22.1\n  183 processes of other users not inspected: run the script as their owner\n\npm2 live list (pm2 jlist, PM2_HOME=/home/USER/.pm2)\n  [unknown]     pm2 CLI /home/USER/.bun/bin/pm2 is writable by group or others (mode 777): not run, live list skipped\n  [vulnerable]  daemon pid 1883303 v24.14.0 /home/USER/.local/share/fnm/node-versions/v24.14.0/installation/bin/node\n\nInstalled Node versions (version managers)\n  fnm in /home/USER/.local/share/fnm\n      installed: v24.14.0 (running), v24.14.1 (from path), v24.22.1 (from path)\n      default alias -> v24.22.1 (from path)\n  `node` on this shell's PATH -> v24.22.1 (from path) /home/USER/.local/share/fnm/node-versions/v24.22.1/installation/bin/node\n  for information only: these do not change the exit code\n\nCrontab: absolute Node paths\n  [unknown]     crontab -l (USER):33\n      /home/USER/.local/share/fnm/node-versions/v24.22.1/installation/bin/node -> v24.22.1 (from path)  (pinned to one install)\n      why: from path: v24.22.1 (a hint, not proof: binaries outside /proc are not read)\n  [unknown]     crontab -l (USER):53\n      /home/USER/.local/share/fnm/node-versions/v24.22.1/installation/bin/node -> v24.22.1 (from path)  (pinned to one install)\n      why: from path: v24.22.1 (a hint, not proof: binaries outside /proc are not read)\n\nsystemd units: absolute Node paths\n  [unknown]     /etc/systemd/system/pm2-USER.service:12\n      /home/USER/.local/share/fnm/node-versions/v24.22.1/installation/bin -> v24.22.1 (from path)  (pinned to one install)\n      why: from path: v24.22.1 (a hint, not proof: binaries outside /proc are not read)\n      unit: pm2-USER.service ActiveState=inactive MainPID=0\n      note: the unit is not what runs pm2 now; its PATH applies at the next boot\n\nContainers\n  no docker or podman CLI found\n\nresult: VULNERABLE: something runs or will start an unfixed Node (exit 1)"
    },
    {
      "cmd": "echo $?",
      "output": "1"
    }
  ]
}
```

The fnm default, the shell's `node`, both cron jobs and the systemd unit point at the v24.22.1 install. The script reports the cron and unit paths as unknown rather than patched, because no running process uses that binary and it does not open it. The four processes that run are v24.14.0. The pm2 daemon is not running under the systemd unit (ActiveState=inactive), so the unit we had fixed is not what runs it now. The one pm2 app is started by `bun`, and the Node processes under it run the app's `node_modules/.bin/next` script. A separate check (`scripts/pm2-path-evidence.py`, `results/pm2-path-20261022T070504Z.txt`) shows that the process the pm2 daemon started and the saved pm2 list both have the v24.14.0 install first on `PATH`, which is where those Node processes come from. If the app is resurrected from that saved list after a reboot, it gets the same `PATH`; we did not reboot to confirm. The fix here is `pm2 restart <app> --update-env` from a fixed shell, then `pm2 save`, then moving the daemon.

The run found one more thing: the `pm2` CLI on that machine is world-writable (mode 777). The script will not run a CLI that someone else could have changed, so it skipped the live pm2 list and reported it as unknown. Check the permissions of your Node installs and global CLIs while you are in there.

The exit code is 1 when anything runs or will start a vulnerable Node, otherwise 2 when anything could not be checked, and 0 when it found nothing vulnerable or unknown within what it covers, including no Node at all. Unknown never counts as patched: a pre-release build, a distribution build linked to the system Brotli, a binary without an embedded version, a unit it could not read, a failed `pm2 jlist`, `crontab -l` or `docker ps`, a config path that only names a fixed version, or a cron path to a Node that no longer exists all give 2. It only sees what the user running it can see, so run it as each user that owns Node processes. To run it across hosts without copying it first:

```bash
for h in deploy@web1 deploy@web2 deploy@web3; do
  ssh "$h" 'python3 - --json' < node_runtime_audit.py > "node-${h#*@}.json"
  echo "$h exit $?"
done
```

The tests build fake hosts with the cases a version check gets wrong: a fake `node` that would leave a marker file if the script ever ran it, a binary replaced while it runs, a container binary, a Debian-style build, a pm2 entry whose config is fixed but whose process was never restarted, npm pinned to the old install while its child gets the new one, a cluster-mode app, an old binary in a directory named after a fixed version, end-of-life and pre-release versions, a cron job on a removed version, a shell wrapper that mentions a fixed version, units owned by other users, and FIFOs, devices, hard links and symlinks planted where a file is expected. One test starts a real process, deletes its binary and checks that the script still reads the running file.

## Rollback

Keep the old version installed until every check passes. Rolling back is the same work in reverse: `nvm alias default 24.14.0`, then the same `--update-env`, delete-and-recreate, `pm2 save`, startup unit and `pm2 update` steps from a shell where the old version comes first. For containers, redeploy the previous image digest. A rollback puts the vulnerable version back, so treat it as a few hours to fix a regression, not as a resting state.

Once the audit shows nothing on the old version, `nvm uninstall 24.14.0`. Anything still pinned to it will then fail to start instead of quietly running the old code, and the audit script reports those paths as missing.

## What we could not check

- **The bugs themselves.** The advisory gives no technical detail, and we did not test whether any code path reaches the Brotli flaw. The exposure section is based on which code calls the decoder.
- **Scores.** The CVE records were still reserved when we checked, so there is no CVSS score.
- **Distribution packages.** Debian and Ubuntu had not published anything for CVE-2026-111497 when we checked. Check your distribution's `nodejs` and `brotli` advisories.
- **Containers on a real host.** The Pi has no Docker, so the container checks are covered by the test fixtures only. The registry scan read real image metadata.
- **The downtime number.** "Under a minute" comes from the production upgrade. The lab's `pm2 update` took 2.3 seconds because its apps do nothing.
- **Bare `node` in cron jobs and units.** The script checks absolute paths and `PATH=` lines; it does not resolve a bare `node` through the job's `PATH`. It reads only your own `crontab -l`, not the system crontabs or the saved pm2 list, and it does not follow `EnvironmentFile=`.
- **Other platforms.** The registry scan covers linux/amd64 and linux/arm64 only. The script needs Linux and `/proc`, and does not cover Kubernetes, stopped containers, or Node binaries renamed to something other than `node` (single executable applications, Electron).

## Checklist

- [ ] Every host: Node 22.23.4, 24.22.1 or 26.12.1 or later installed; Node 20, 25 and older replaced
- [ ] Every pm2 entry: absolute interpreters and npm or npx script paths recreated, bare `node` entries restarted with `--update-env`, then `pm2 save`
- [ ] pm2 startup unit regenerated (`pm2 unstartup`, `pm2 startup`) and the daemon moved with `pm2 update` in a quiet window
- [ ] Cluster-mode apps checked after the daemon moved
- [ ] Crontabs, systemd units and helper scripts searched for absolute paths to the old install
- [ ] Images rebuilt with `--pull` (Alpine-based ones checked after the late rebuild) and redeployed by new tag or digest
- [ ] Services that fetch user-supplied URLs or accept compressed bodies upgraded first; interim measures where they cannot be
- [ ] Every Node process checked by `/proc/<pid>/exe`, not by name, including child processes
- [ ] Node installs and global CLIs (pm2, npm) writable only by their owner
- [ ] Audit script output saved per host, and the old version uninstalled once it is clean

Every fact in this post is listed with its source in the repo's `SOURCES.md`.
