---
title: 'Alpine OpenSSH Password Bypass (CVE-2026-123158): Check and Fix'
excerpt: 'Alpine sshd without PAM could let an attacker into accounts that have no password. Check one host or all your containers, then upgrade and restart sshd.'
category:
  name: 'Security'
  slug: 'security'
date: '2026-11-05'
publishedAt: '2026-11-05T21:00:00Z'
updatedAt: '2026-11-05T21:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Security
  - Linux
  - OpenSSH
  - SSH
  - Alpine Linux
  - Docker
  - CVE
---

If you run sshd on Alpine Linux, upgrade openssh and restart sshd now:

```bash
apk upgrade -U -a && rc-service sshd restart
```

On 2026-11-05, Alpine published fixed `openssh` packages for every branch from 3.16 to edge, and OpenSSH released 10.6p2. The bug is **CVE-2026-123158**. On an affected host, a person who can reach the SSH port can log in to an account that has no password, without a password. The cause, in one sentence: when sshd is built without PAM, an error value from musl's `crypt()` could be treated as a match for accounts that have no password.

This post tells you how to find out if a host or a container is affected, how to fix it, and what to look for in your logs. It does not show how to trigger the bug.

## TLDR

- You are affected only if four conditions are all true. Most fresh containers fail at least one of them.
- The fix is `apk upgrade -U -a`, then a restart of sshd. The upgrade alone does not replace the running daemon.
- If you cannot upgrade, set `PasswordAuthentication no` and restart sshd.
- Our read-only script checks the four conditions, the package version and the restart for a host or for every running container.

## Prerequisites

- Root on the Alpine host, or access to `docker exec` for containers
- A second SSH session open before you change sshd settings

## Who is affected

The [Alpine advisory](https://alpinelinux.org/posts/2026-11-05-openssh-password-authentication-bypass/) says you are affected only if all of these are true:

1. **sshd is built without PAM.** The `openssh-server` package is. The `openssh-server-pam` package is affected too if `UsePAM no` is set, and `UsePAM no` is its default.
2. **`PasswordAuthentication yes`**, which is the OpenSSH default.
3. **An account has `*` in its password field.** On Alpine base images root is `root:*`, but the default `PermitRootLogin prohibit-password` blocks password logins for root. Key-only users, the `alpine` user on tiny-cloud images, and directory users through `musl-nscd` (they have no shadow entry) also count.
4. **At least one local account has a `$5$` or `$6$` hash.** One user with a password is enough.

You are not affected if `PasswordAuthentication` is `no`, if you use `openssh-server-pam` with `UsePAM yes`, if no account has a `$`-style hash, or if your containers do not run sshd. Locked accounts (`!` in the password field) are not affected. Cloud images that cloud-init configures get `PasswordAuthentication no`.

These are the fixed `openssh` versions from the advisory:

| Branch | Fixed version | Branch | Fixed version |
| ------ | ------------- | ------ | ------------- |
| edge   | 10.6_p2-r0    | 3.20   | 9.7_p1-r6     |
| 3.24   | 10.3_p1-r2    | 3.19   | 9.6_p1-r3     |
| 3.23   | 10.2_p1-r1    | 3.18   | 9.3_p2-r4     |
| 3.22   | 10.0_p1-r11   | 3.17   | 9.1_p1-r7     |
| 3.21   | 9.9_p2-r1     | 3.16   | 9.0_p1-r6     |

## Check one host

We wrote a small POSIX `sh` script that reads these facts and changes nothing:

```github
https://github.com/The-DevOps-Daily/alpine-sshd-check
```

It reads the branch from `/etc/alpine-release`, the installed package version from `apk`, the effective settings from `sshd -T`, and the start time of the running sshd. From `/etc/shadow` it reads only the type of each password field: it counts `*` fields and `$5$`/`$6$` fields. It never prints a hash or a user name, and it does not connect to sshd. Because it runs as root, it executes only the packaged sshd binaries in `/usr/sbin`, and only if root owns them and no one else can write to them. Exit codes are `0` not affected, `1` affected, `2` fixed but restart needed, `3` cannot tell. Add `--json` for machine-readable output.

```bash
sudo sh check.sh
```

We ran it in throwaway containers on Alpine 3.21, 3.22, 3.23, 3.24 and edge after `apk add openssh-server`. sshd ran with `--network none`, so no port was open to anyone. Every branch installed the fixed version, and every run exited `0`. This run is the strictest one: Alpine 3.24 with a key-only user set to `*` and one user with a random password, so all four conditions are true. The version is the only thing that keeps it safe:

```terminal
{
  "title": "check.sh in the Alpine 3.24 test container",
  "prompt": "$",
  "steps": [
    {
      "comment": "all four conditions true, fixed package installed"
    },
    {
      "cmd": "docker exec -i asc-users sh -s < check.sh",
      "output": "alpine-sshd-check: CVE-2026-123158\nAlpine release:     3.24.4 (branch 3.24)\nsshd binary:        /usr/sbin/sshd (package openssh-server)\nInstalled openssh:  10.3_p1-r2\nFixed in:           10.3_p1-r2 (installed is fixed: yes)\n[1] non-PAM sshd:                  yes\n[2] PasswordAuthentication yes:    yes\n[3] account with '*' that can use a password login: yes (2 '*' accounts, 1 usable; root is '*': yes, PermitRootLogin prohibit-password)\n[4] local $5$/$6$ hash:            yes (1 found)\nsshd running:       yes, started 2026-11-05T21:22:20Z, binary installed 2026-11-05T21:22:06Z, restart needed: no\nnote: root is '*' but PermitRootLogin is 'prohibit-password'; root counts only with PermitRootLogin yes (an account that can doas to root still matters)\nResult:             NOT AFFECTED: fixed openssh installed (exit 0)"
    }
  ]
}
```

Two things we found while we ran it:

- On 3.24, `adduser -D deploy` wrote `!` (locked), not `*`. A locked account is not affected, but it cannot log in with a key either. If you changed key-only users to `*` so that key login works, those are the accounts that matter.
- OpenSSH 10.6 prints `sshd -T` keywords in mixed case (`PasswordAuthentication yes`). Older versions print lower case. The first version of our script matched only lower case and reported "unknown" on edge. Use `grep -i` in your own checks.

## Check containers

Most containers do not run sshd, and those are not affected. To find the ones that do, `scan-containers.sh` lists the running containers, skips those that are not Alpine or have no sshd process, and pipes `check.sh` into the rest with `docker exec -i ... sh -s`. Nothing is copied into the container.

```terminal
{
  "title": "scan-containers.sh",
  "prompt": "$",
  "steps": [
    {
      "cmd": "sh scan-containers.sh",
      "output": "CONTAINER      IMAGE          ALPINE                INSTALLED    FIXED        EXIT  RESULT\nasc-users      asc-demo:3.24  3.24.4                10.3_p1-r2   10.3_p1-r2   0     not affected\nasc-pa-no      asc-demo:3.24  3.24.4                10.3_p1-r2   10.3_p1-r2   0     not affected\nasc-edge       asc-demo:edge  3.25.0_alpha20260805  10.6_p2-r0   10.6_p2-r0   0     not affected\nasc-3.24       asc-demo:3.24  3.24.4                10.3_p1-r2   10.3_p1-r2   0     not affected\nasc-3.23       asc-demo:3.23  3.23.8                10.2_p1-r1   10.2_p1-r1   0     not affected\nasc-3.22       asc-demo:3.22  3.22.8                10.0_p1-r11  10.0_p1-r11  0     not affected\nasc-3.21       asc-demo:3.21  3.21.10               9.9_p2-r1    9.9_p2-r1    0     not affected"
    }
  ]
}
```

If you build images that install `openssh-server`, a rebuild can reuse a cached `apk add` layer with the old package. Rebuild with `docker build --pull --no-cache`, then replace the running containers. A restart of the old container does not change its package.

## Fix it, and restart sshd

```bash
apk upgrade -U -a
rc-service sshd restart
```

The restart is not optional. The package upgrade replaces the files on disk, but the sshd that is already running keeps its old code until it restarts. `check.sh` compares the start time of the running sshd with the time the sshd binary was installed, and exits `2` if the daemon is older. Run it again after the restart.

On edge, the fix comes with OpenSSH 10.6p2. If you jump from an older 10.x, read our post on [what OpenSSH 10.6 changed](/posts/openssh-10-6-domain-usernames-and-compression) first: it refuses some usernames and changes `ssh -C`.

## Workaround: turn off password logins

If you cannot upgrade now, turn off password authentication. Either step closes the hole.

:::warning
Make sure that key login works first. Keep your current session open, and test a new login in a second session before you close it.
:::

```bash
mkdir -p /etc/ssh/sshd_config.d
echo 'PasswordAuthentication no' > /etc/ssh/sshd_config.d/00-no-passwords.conf
sshd -t && rc-service sshd restart
sshd -T | grep -i passwordauthentication   # must print: passwordauthentication no
```

Alpine's default `sshd_config` reads `/etc/ssh/sshd_config.d/` from 3.19 onward. On 3.18 and older, change the line in `/etc/ssh/sshd_config` itself; the advisory has a `sed` command for that. A `Match` block can turn password logins back on for some users or addresses, and `sshd -T` without `-C` does not show that, so read your `Match` blocks too. In our 3.24 test container, the drop-in changed condition 2 to `no`.

## The tiny-cloud alpine user

The official tiny-cloud images (qcow2, VHD and AMI) from 3.18.11 to 3.24.3 have an `alpine` user with `*` in the password field and passwordless `doas`. They are safe on first boot. They become exposed as soon as any `$6$` hash is on the machine, for example when an admin sets a console password or user-data adds a user with `hashed_passwd`. Then an attacker can get a shell as `alpine` and use `doas` to become root.

Images from 3.21.10, 3.22.8, 3.23.8 and 3.24.4 contain the fixed package. Instances that started from older images do not get the fix from a new image: upgrade openssh on each one, or turn off password logins.

## What to look for in logs

Look for password logins to accounts that have no password. On a host with syslog, that is `/var/log/messages`. For a container that runs `sshd -e`, it is `docker logs`.

```bash
# accounts with '*' in the password field (names only)
awk -F: '$2 == "*" { print $1 }' /etc/shadow

# password logins; compare the user names with the list above
grep 'sshd.*Accepted password for' /var/log/messages
docker logs <container> 2>&1 | grep 'Accepted password for'
```

Any `Accepted password for alpine`, for `root`, or for a key-only user is a bad sign. On exposed machines, also review `doas` use, new users, new files, and changes to `authorized_keys` files. If you cannot rule out such a login, treat the machine as compromised and rebuild it.

## What we could not check

- **A vulnerable package.** Alpine replaced the packages on every branch the same day, so each fresh install got the fixed version. Exit code `1` was tested only with a copy of the script whose fixed-version table we raised by one release.
- **A real "upgraded but not restarted" daemon,** for the same reason. The restart check is in the script, but we did not see it on a real upgrade. We tested that code path only by changing the sshd binary's ctime in a container.
- **`openssh-server-pam`, `musl-nscd` users, tiny-cloud images and branches 3.16 to 3.20.** We did not measure them.
- **Other musl systems.** The [CVE record](https://www.cve.org/CVERecord?id=CVE-2026-123158) covers sshd before 10.6p2 on Linux with musl and without PAM, and names Alpine as the example. We did not check other musl-based distributions or firmware builds.

Sources: the [Alpine advisory](https://alpinelinux.org/posts/2026-11-05-openssh-password-authentication-bypass/), the [OpenSSH 10.6p2 release notes](https://www.openssh.com/releasenotes.html#10.6p2) and the [CVE record](https://www.cve.org/CVERecord?id=CVE-2026-123158).
