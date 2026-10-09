---
title: 'OpenSSH 10.6 Refuses DOMAIN\user on the Command Line and Weakens ssh -C. We Measured Both'
excerpt: 'OpenSSH 10.6 came out on October 6. It refuses usernames with a backslash or a dollar sign before it connects, which breaks ssh, scp, rsync, git and Ansible logins written as CORP\alice. It also cuts ssh -C to Huffman coding only, so a 32 MiB log now sends 21 MiB instead of 3.7 MiB. We built 10.5 and 10.6 side by side and tested 12 ways of passing a username, 4 kinds of data and 8 SSH clients.'
category:
  name: 'Linux'
  slug: 'linux'
date: '2026-10-10'
publishedAt: '2026-10-10T09:00:00Z'
updatedAt: '2026-10-10T09:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Linux
  - OpenSSH
  - SSH
  - Ansible
  - Windows
  - Security
  - Networking
---

OpenSSH 10.6 was released on October 6, and Homebrew, Arch Linux and Debian unstable already ship it. Its [release notes](https://www.openssh.com/txt/release-10.6) list three changes that alter what you see day to day. `ssh` now refuses usernames that contain `\` or `$` when they come from the command line. `ssh -C` compression no longer uses LZ77, the part of deflate that does most of the work. And `sshd` now logs a warning for every connection that does not use a post-quantum key exchange.

The first change hits anyone who logs in to Windows or AD-joined machines as `CORP\alice`. Microsoft's own [OpenSSH guide](https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_install_firstuse) shows exactly that form: `ssh domain\username@servername`. The second change hits anyone who turned on `-C` for a slow link, and every Ansible user, because Ansible passes `-C` by default. We built OpenSSH 10.5p1 and 10.6p1 from source on the same machine and measured what each change does.

## TLDR

- With a 10.6 client, `CORP\alice` and `svc-backup$` were refused before any connection on 20 of the 24 paths we tried: `user@host`, `-l`, `-o User=`, `ssh://` URIs, scp, sftp, rsync, git, Ansible's `ansible_user` and a `User ${VAR}` line in ssh_config. With 10.5, all 24 reached the server.
- Two ways still work: a literal `User CORP\alice` line in ssh_config, and the `alice@corp.example.com@host` form.
- `ssh -C` on 10.6 compressed a 32 MiB access log to 21.09 MiB. 10.5 compressed the same file to 3.71 MiB. That is 5.7 times more bytes on the wire. JSON logs and source code sent 3.1 to 3.4 times more.
- The side that sends the data decides. If you upgrade only your laptop, downloads from an old server still compress well, and uploads do not.
- `zstd -1` in a pipe compressed the access log 7.6x in 0.44 CPU seconds. zlib level 6, which `ssh -C` used before 10.6, needed 1.50 CPU seconds for 8.7x.
- A default 10.6 sshd logged a warning for paramiko 5.0.0, libssh2 1.10.0 and any client limited to classic key exchange. asyncssh 2.24.1, Go's x/crypto/ssh and OpenSSH 9.2 and newer caused no warning. The setting is global only, so you cannot turn it off for one subnet.

## Prerequisites

- A shell with OpenSSH. Run `ssh -V` to see your client version.
- Optional: the demo repo, which builds both versions and runs every test in this post. It needs a C toolchain, `libssl-dev`, `zlib1g-dev` and about 15 minutes on a small ARM machine.

```github
https://github.com/The-DevOps-Daily/openssh-10-6-check
```

## How we tested

Everything ran on one Debian 12 machine (aarch64, 4 cores). `01-build.sh` downloads `openssh-10.5p1` and `openssh-10.6p1`, checks the SHA256 sums printed in each release note, and builds both into separate prefixes. Each `sshd` runs as an ordinary user on `127.0.0.1`. The username test uses one 10.6 sshd and points both client versions at it. The server log is the evidence: if `sshd` logs `Invalid user CORP\\alice`, the name got through. If the log has no new line, the client refused it.

All usernames other than the local account are fake, so each login that reaches the server ends in `Permission denied`. That is the result we want here. It proves the client sent the name.

## Change 1: usernames with a backslash or a dollar sign

The new check is in `ssh_valid_ruser()` in `readconf.c`. The list of forbidden characters gained two entries, `$` and `\`. The release notes say why: a username from an untrusted source can end up in a shell through `%r` in `ProxyCommand` or `Match exec`. The check runs on every username that came from the command line, and on any `User` value from ssh_config that changed when OpenSSH expanded it.

Here is the same command on both versions, recorded by `09-transcript.sh`:

```terminal
{
  "title": "OpenSSH 10.5p1 and 10.6p1, same command",
  "prompt": "$",
  "steps": [
    { "comment": "every ssh below also gets -F work/base_config: port 18022, the test key, BatchMode" },
    { "cmd": "ssh 'CORP\\alice@127.0.0.1' true   # 10.5p1", "output": "CORP\\\\alice@127.0.0.1: Permission denied (publickey,password,keyboard-interactive)." },
    { "cmd": "ssh 'CORP\\alice@127.0.0.1' true   # 10.6p1", "output": "remote username contains invalid characters" },
    { "cmd": "ssh -o 'User=CORP\\alice' 127.0.0.1 true   # 10.6p1", "output": "remote username contains invalid characters" },
    { "cmd": "head -3 ssh_config   # the Host block the next two commands use", "output": "Host winbox\n  HostName 127.0.0.1\n  User CORP\\alice" },
    { "cmd": "ssh winbox true   # 10.6p1, User line in ssh_config", "output": "CORP\\\\alice@127.0.0.1: Permission denied (publickey,password,keyboard-interactive)." },
    { "cmd": "WIN_USER='CORP\\alice' ssh winbox true   # 10.6p1, User ${WIN_USER} in ssh_config", "output": "remote username contains invalid characters" },
    { "cmd": "ssh 'alice@corp.example.com@127.0.0.1' true   # 10.6p1, UPN form", "output": "alice@corp.example.com@127.0.0.1: Permission denied (publickey,password,keyboard-interactive)." }
  ]
}
```

The doubled backslash in `CORP\\alice` is how OpenSSH prints the name. The server received `CORP\alice`.

`03-usernames.sh` runs four usernames through twelve entry paths with each client version. This is the 10.6p1 column. With 10.5p1, every cell reached the server.

| How the username is passed         | `CORP\alice`   | `svc-backup$`  | `alice@corp.example.com`     |
| ---------------------------------- | -------------- | -------------- | ---------------------------- |
| `ssh user@host`                    | refused        | refused        | reaches server               |
| `ssh -l user host`                 | refused        | refused        | reaches server               |
| `ssh -o User=user host`            | refused        | refused        | reaches server               |
| `ssh ssh://user@host:port`         | refused        | refused        | usage error on both versions |
| ssh_config `User <name>`, literal  | reaches server | reaches server | reaches server               |
| ssh_config `User ${SSH_TEST_USER}` | refused        | refused        | reaches server               |
| `scp user@host:file .`             | refused        | refused        | reaches server               |
| `sftp user@host`                   | refused        | refused        | reaches server               |
| `rsync -e ssh user@host:file .`    | refused        | refused        | reaches server               |
| `git ls-remote user@host:repo.git` | refused        | refused        | reaches server               |
| Ansible with `ansible_user`        | refused        | refused        | reaches server               |
| Ansible, `User` line in ssh_config | reaches server | reaches server | reaches server               |

scp, sftp, rsync and git all start `ssh` with the username as an argument, so they get the same refusal. The message does not change. git prints it and exits with 128. Ansible wraps it:

```text
t | UNREACHABLE!: Task failed: Failed to connect to the host via ssh: remote username contains invalid characters
```

The Ansible row matters because the usual inventory for Windows over SSH sets `ansible_user: 'CORP\alice'`. ansible-core 2.21.5 passes that as `-o User=`, which counts as the command line.

### Who this breaks

- Admins on macOS (Homebrew), Arch or Debian unstable who log in to Windows Server with `DOMAIN\user`, as in Microsoft's guide.
- Linux hosts joined to Active Directory through SSSD, where people log in with the short domain form.
- Ansible inventories that manage Windows over SSH with a down-level logon name in `ansible_user`.
- Scripts that build `ssh "$user@$host"` from a variable that can contain `\` or `$`.

Windows ships its own OpenSSH build on its own schedule. We did not test the Windows client.

### What to do

1. Use the `user@domain` form. The [Win32-OpenSSH examples](https://github.com/PowerShell/Win32-OpenSSH/wiki/ssh.exe-examples) list `ssh user@domain@host` next to `ssh domain\user@host`. OpenSSH splits at the last `@`, so the name reaches the server intact. In our test, only the `ssh://` URI form rejected it, and 10.5 rejected it there too.
2. Put the name in a literal `User` line in ssh_config. The check skips literal values:

   ```text
   Host win-*.corp.example.com
     User CORP\alice
   ```

3. For Ansible, remove `ansible_user` from those hosts and let ssh_config supply the name. Pass the file with `ansible_ssh_common_args: '-F /path/to/ssh_config'`, or put the block in `~/.ssh/config`. Our test shows this path reaches the server on 10.6.
4. Do not template the username into ssh_config as `User ${VAR}`. 10.6 checks the expanded value and refuses it.

## Change 2: ssh -C still compresses, but much less

Before 10.6, `packet.c` started the compressor with `deflateInit(stream, 6)`, which is zlib level 6, the same as `gzip -6`. In 10.6 the call is `deflateInit2(..., Z_BEST_SPEED, Z_DEFLATED, 15, 8, Z_HUFFMAN_ONLY)`. Huffman-only deflate still gives short codes to common bytes. It does not replace repeated strings with references to earlier data, and that is where text gets most of its compression.

The reason is a 2026 paper, ["Crossing the Streams"](https://arxiv.org/abs/2609.07709). All channels in one SSH session share one compression dictionary. If an attacker can send data through one channel, such as a forwarded port, the size of the compressed output can leak secrets from another channel. Without back-references, there is nothing to leak through.

`05-compression.sh` sends four files through every client and server pair, up and down, three times each. `ssh -v` prints the raw and compressed byte counts at exit. The counts changed by at most one byte between runs.

```chart
{
  "type": "bar",
  "title": "Bytes on the wire with ssh -C, by the version of the side that sends",
  "unit": " MiB",
  "caption": "OpenSSH 10.5p1 and 10.6p1, zlib@openssh.com, median of 3 runs. access.log and events.ndjson are 32 MiB each, the OpenSSH source tar is 11.2 MiB. A 16 MiB random file sent 16.01 MiB with both versions.",
  "rows": [
    { "label": "access.log, 10.5", "value": 3.71, "series": "10.5p1 sends" },
    { "label": "access.log, 10.6", "value": 21.09, "series": "10.6p1 sends" },
    { "label": "events.ndjson, 10.5", "value": 6.0, "series": "10.5p1 sends" },
    { "label": "events.ndjson, 10.6", "value": 20.09, "series": "10.6p1 sends" },
    { "label": "openssh-src.tar, 10.5", "value": 2.25, "series": "10.5p1 sends" },
    { "label": "openssh-src.tar, 10.6", "value": 6.93, "series": "10.6p1 sends" }
  ],
  "series": [
    { "name": "10.5p1 sends", "color": "#64748b" },
    { "name": "10.6p1 sends", "color": "#f59e0b" }
  ]
}
```

| File                          |      Raw |      10.5p1 sends |      10.6p1 sends | More bytes |
| ----------------------------- | -------: | ----------------: | ----------------: | ---------: |
| access.log (nginx format)     | 32.0 MiB |  3.71 MiB (8.62x) | 21.09 MiB (1.52x) |       5.7x |
| events.ndjson (JSON logs)     | 32.0 MiB |  6.00 MiB (5.34x) | 20.09 MiB (1.59x) |       3.3x |
| openssh-src.tar (real source) | 11.2 MiB |  2.25 MiB (4.99x) |  6.93 MiB (1.62x) |       3.1x |
| random.bin                    | 16.0 MiB | 16.01 MiB (1.00x) | 16.01 MiB (1.00x) |       none |

The access log and the JSON events are generated from a fixed seed, with IP addresses from the documentation ranges. The source tar is the real `openssh-10.6p1` release, so it is the one corpus that we did not shape. As a cross-check, `07-app-compression.sh` runs plain zlib with `Z_HUFFMAN_ONLY` on the same files. It gave 1.52x, 1.59x and 1.62x, the same as the 10.6 ssh results.

### The sender decides

Each side of an SSH connection compresses what it sends. In our matrix, the upload ratio followed the client version and the download ratio followed the server version, in every case:

- A 10.6 client downloading from a 10.5 server got 8.62x on the access log.
- A 10.5 client downloading from a 10.6 server got 1.52x.

So the change reaches you in stages. Upgrade your laptop and your uploads get bigger. Your downloads change when the servers upgrade.

### What it costs in time

On a fast link, 10.6 is quicker. On loopback with no limit, a 10.6 server sent the access log in 1.84 s (median) and a 10.5 server took 2.19 to 2.54 s, depending on the client, because Huffman coding needs less CPU than searching for repeated strings. On a slow link, the extra bytes win.

`08-shaped-link.sh` adds a 20 Mbit/s `tc` rule on the loopback device, for one port only, and downloads the access log five times with a 10.6 client:

| Method                       | Server |  Median |            Range |
| ---------------------------- | ------ | ------: | ---------------: |
| `ssh -C`                     | 10.5p1 |  4.55 s |   3.39 to 7.50 s |
| `ssh -C`                     | 10.6p1 | 10.46 s | 10.08 to 13.91 s |
| no compression               | 10.6p1 | 15.89 s | 13.57 to 17.08 s |
| `zstd -1` in a pipe, no `-C` | 10.6p1 |  4.94 s |   1.92 to 6.94 s |

The slowest 10.5 run was faster than the fastest 10.6 run. The ranges are wide because the test machine was doing other work. The byte counts above are exact, so plan with them: at 20 Mbit/s, 3.71 MiB needs at least 1.6 s and 21.09 MiB needs at least 8.8 s.

### Who this affects

- Anyone with `Compression yes` in ssh_config, or `ssh -C` and `scp -C` in scripts, over VPNs, satellite or mobile links.
- Ansible. The default `ssh_args` in ansible-core 2.21.5 are `-C -o ControlMaster=auto -o ControlPersist=60s`. Most Ansible traffic is small modules, but `copy`, `fetch` and `synchronize` move text files through the same session.
- Not `rsync -z`, which compresses inside rsync. Not git, which compresses its own packs.

### What to do

Compress at the application level, as the release notes recommend. On our files:

| Method                               | access.log ratio | CPU seconds |
| ------------------------------------ | ---------------: | ----------: |
| zlib level 6 (`ssh -C` before 10.6)  |            8.73x |        1.50 |
| zlib Huffman only (`ssh -C` in 10.6) |            1.52x |        1.25 |
| `gzip -6`                            |            8.73x |        1.82 |
| `zstd -1`                            |            7.63x |        0.44 |
| `zstd -3`                            |            7.57x |        0.67 |

```bash
# A file, compressed with zstd on the way and decompressed on arrival
zstd -1 -c access.log | ssh host 'zstd -dc > access.log'

# A directory
tar -cf - ./logs | zstd -1 | ssh host 'zstd -dc | tar -xf - -C /srv/archive'

# rsync with its own compression (rsync 3.2 and newer can use zstd)
rsync -az --compress-choice=zstd ./logs/ host:/srv/archive/
```

Application-level compression also avoids the attack, because nothing shares a dictionary across channels. For data that is already compressed, such as images, archives and most backups, `-C` never helped, and you can leave it off.

## Change 3: sshd now warns about classic key exchange

`WarnWeakCrypto` came to the client in 10.1. In 10.6 it is also a server option, on by default. Each connection that does not use a post-quantum key exchange adds one line to the log at INFO, the default level:

```text
WARNING: connection from 127.0.0.1 port N is not using a post-quantum key exchange algorithm: "curve25519-sha256" [preauth]
```

`06-weakcrypto.sh` connects eight clients to a 10.5 and a 10.6 sshd, both with default settings, and reads the negotiated key exchange from the log:

| Client                                                | Key exchange                 | 10.6 sshd warns |
| ----------------------------------------------------- | ---------------------------- | --------------- |
| OpenSSH 10.6p1                                        | mlkem768x25519-sha256        | no              |
| OpenSSH 10.5p1                                        | mlkem768x25519-sha256        | no              |
| OpenSSH 9.2p1 (Debian 12)                             | sntrup761x25519-sha512       | no              |
| asyncssh 2.24.1                                       | mlkem768x25519-sha256        | no              |
| Go golang.org/x/crypto/ssh v0.58.0                    | mlkem768x25519-sha256        | no              |
| paramiko 5.0.0                                        | curve25519-sha256@libssh.org | yes             |
| libssh2 1.10.0 (Debian 12 curl, sftp)                 | curve25519-sha256            | yes             |
| OpenSSH 10.6p1 with `KexAlgorithms=curve25519-sha256` | curve25519-sha256            | yes             |

The 10.5 sshd logged no warning for any of them. Fabric and Netmiko are built on paramiko, so automation that uses them adds one warning per connection. If you alert on `WARNING` in auth logs, expect new alerts from those hosts.

You can turn it off with `WarnWeakCrypto no-pq-kex` (only this warning) or `WarnWeakCrypto no` (all of them). The option is global only. In a `Match Address` block, `sshd -t` fails:

```text
sshd-match-test.conf line 10: Directive 'WarnWeakCrypto' is not allowed within a Match block
```

So you cannot keep the warning for people and hide it for one automation subnet. The better fix is on the client side: update the library, or move the job to a client that supports `mlkem768x25519-sha256`.

## What we could not conclude

- We tested one machine and one OpenSSL build (3.0.22). The username check and the compression change are in OpenSSH's own code, so other platforms should behave the same, but we only measured this one.
- We did not test the OpenSSH client that ships with Windows, or any vendor build that patches these changes out.
- The timings vary because the machine was shared. The byte counts and the refusals do not depend on load.
- Two of the four corpora are synthetic. The real source tar gave a ratio between the two synthetic ones, but your logs will compress differently.
- We tested libssh2 1.10.0 only, the version in Debian 12. Newer libssh2 releases may negotiate something else.

## Summary

OpenSSH 10.6 makes three changes that people will see within days of upgrading. Logins written as `CORP\alice` fail with `remote username contains invalid characters`, through ssh, scp, sftp, rsync, git and Ansible, unless the name is a literal `User` line in ssh_config or you switch to `alice@corp.example.com@host`. `ssh -C` now compresses text about 1.5x instead of 5x to 9x, and the side that sends the data decides, so move the compression to zstd or rsync. And a 10.6 sshd logs one warning per connection for paramiko and older libssh2 clients, with no way to scope that per subnet. Run `ssh -V` on your laptop today. If it says 10.6, check your inventories and scripts for `\` in usernames before the next on-call shift finds them for you.
