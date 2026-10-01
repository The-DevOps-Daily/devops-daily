---
title: 'GitHub Is Removing ssh-rsa Signatures: Find What Breaks Before the November 4 Brownout'
excerpt: 'GitHub removes the ssh-rsa signature type and diffie-hellman-group-exchange-sha256 on January 13, 2027, with brownouts on November 4 and December 9. Learn which clients and keys are at risk, which debug lines to read, and how to rotate keys before the first brownout.'
category:
  name: 'Git'
  slug: 'git'
date: '2026-10-01'
publishedAt: '2026-10-01T09:00:00Z'
updatedAt: '2026-10-01T09:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Git
  - GitHub
  - SSH
  - Security
  - CI/CD
  - DevOps
---

On September 22, GitHub [announced](https://github.blog/changelog/2026-09-22-security-improvements-for-ssh) that it will stop accepting two old SSH algorithms: the `ssh-rsa` signature type, which is RSA with SHA-1, and the `diffie-hellman-group-exchange-sha256` key exchange. A laptop with a current OpenSSH will not notice. The clients that break are the ones nobody looks at: an old CI image, a Jenkins agent, a Java tool with an old SSH library, a backup appliance. The first brownout is on November 4, a bad time to find them.

This post covers what changes, which clients and keys are at risk, how to test them, and how to rotate keys.

## TLDR

- **Schedule:** new RSA keys need at least 3072 bits from October 14, 2026. Brownouts on November 4 and December 9. Removal on January 13, 2027.
- **HTTPS remotes are not affected.**
- **Your RSA key can stay** if your client signs with `rsa-sha2-256` or `rsa-sha2-512`.
- **The keys most at risk are old.** Since March 2022, only RSA keys added before November 2, 2021 can sign with SHA-1 on GitHub.
- **Key exchange is the second trap.** Besides the one being removed, GitHub offered us only sntrup761, curve25519 and ECDH. A client that supports none of them fails with any key.
- **Test with `ssh -vT git@github.com`** and read the `kex:` lines. Add `-vvv` to see the signature algorithm for your key.

## Prerequisites

- Git remotes that use SSH (`git@github.com:...` or `ssh://`)
- Shell access to the machines and images that run Git: CI agents, runners, build containers
- The [GitHub CLI](https://cli.github.com/) (`gh`), with the `read:public_key` scope for account keys and admin access for deploy keys
- OpenSSH's `ssh` and `ssh-keygen`

## What GitHub is changing, and when

The changelog lists four changes:

1. Removal of "RSA keys using SHA-1 in SSH (i.e., the ssh-rsa signature type, including ssh-rsa-cert-v01@openssh.com certificates using SHA-1)".
2. Removal of the key exchange mechanism `diffie-hellman-group-exchange-sha256`.
3. "All new RSA SSH keys uploaded after October 14, 2026 must be at least 3072 bits in size, both for signing and authentication." That includes keys you use to sign commits.
4. A new post-quantum key exchange, `mlkem768x25519-sha256`, on github.com and on GitHub Enterprise Cloud with data residency, except for the U.S. region.

```diagram
{
  "type": "flow",
  "title": "GitHub SSH change schedule",
  "nodes": [
    { "label": "Sep 22, 2026", "sub": "changelog published", "icon": "activity", "tone": "slate" },
    { "label": "Oct 14, 2026", "sub": "new RSA keys 3072+ bits, ML-KEM enabled", "icon": "lock", "tone": "blue" },
    { "label": "Nov 4, 2026", "sub": "first brownout", "icon": "activity", "tone": "amber" },
    { "label": "Dec 9, 2026", "sub": "second brownout", "icon": "activity", "tone": "amber" },
    { "label": "Jan 13, 2027", "sub": "ssh-rsa and DH group exchange removed", "icon": "shield", "tone": "red" }
  ]
}
```

Both brownouts cover `ssh-rsa` and `diffie-hellman-group-exchange-sha256`. The changelog gives no time of day or duration for them. On GitHub Enterprise Server, everything takes effect in version 3.25, except ML-KEM, which comes in 3.24. GitHub Enterprise Server users of the unauthenticated Git protocol are affected too.

ML-KEM needs nothing from you: older clients "should automatically fall back", GitHub says. OpenSSH added `mlkem768x25519-sha256` in 9.9 and made it the default in 10.0, according to its [release notes](https://www.openssh.com/releasenotes.html).

## Who is actually affected

**HTTPS users are not.** In GitHub's words: "If your Git remotes start with https://, nothing here will affect you." For SSH users, there are two questions.

**1. Can your client sign with SHA-2?** As GitHub points out, `ssh-rsa` is both a key type and a signature type. Every RSA key has key type `ssh-rsa`, but it can sign with SHA-1 (`ssh-rsa`), SHA-256 (`rsa-sha2-256`) or SHA-512 (`rsa-sha2-512`). The client decides which signature it sends, so the key itself is fine.

In 2021 GitHub [announced](https://github.blog/security/application-security/improving-git-protocol-security-github/) that from March 15, 2022, "RSA keys uploaded after the cut-off point above will work only with SHA-2 signatures", with November 2, 2021 as the cut-off. So if your RSA key was added after that date and works today, your client already signs with SHA-2. The keys at risk are RSA keys added before November 2, 2021, used by a client that still signs with SHA-1.

**2. Does your client share a key exchange with GitHub?** This does not depend on your key. On October 1, 2026, GitHub's SSH server offered us this list:

```text
sntrup761x25519-sha512, sntrup761x25519-sha512@openssh.com,
curve25519-sha256, curve25519-sha256@libssh.org,
ecdh-sha2-nistp256, ecdh-sha2-nistp384, ecdh-sha2-nistp521,
diffie-hellman-group-exchange-sha256, kex-strict-s-v00@openssh.com
```

Plain Diffie-Hellman groups such as `diffie-hellman-group14-sha256` are not offered. When group exchange goes, a client needs sntrup761, curve25519, ECDH or, after October 14, ML-KEM. A client that only does classic Diffie-Hellman fails even with an Ed25519 key.

GitHub lists these minimum versions for RSA with SHA-2 in the default configuration:

| Software | Minimum version                                               |
| -------- | ------------------------------------------------------------- |
| OpenSSH  | 7.2p1                                                         |
| JSch     | 0.1.66 from [the mwiede fork](https://github.com/mwiede/jsch) |
| TeamCity | 2021.2.3                                                      |
| Go SSH   | 0.16.0                                                        |
| libssh2  | 1.11.0                                                        |
| PuTTY    | 0.82                                                          |

Where to look:

- **Old CI images and build containers.** The SSH client is whatever the base image shipped.
- **Jenkins agents.** Command-line Git uses the agent's `ssh`. An agent set to JGit uses Java SSH code instead, so test it separately.
- **Java tools on the original JSch** (`com.jcraft:jsch`). The fork GitHub names is published as `com.github.mwiede:jsch`.
- **Python tools on Paramiko.** It is not in GitHub's table. Its [changelog](https://www.paramiko.org/changelog.html) says 2.9.0 (December 2021) added RSA SHA-2 signatures.
- **libssh2-based tools,** such as curl's SFTP and SCP support and many libgit2-based clients.
- **Windows.** Git for Windows ships its own `ssh.exe`, Windows has a separate built-in OpenSSH, and some setups use PuTTY's `plink` or TortoiseGit's PuTTY-based plink.
- **Appliances** such as artifact servers and backup tools, which often embed their own SSH library.

## Test a client now

Start with `ssh -V`. Anything older than `OpenSSH_7.2` cannot sign with SHA-2, so plan to replace it.

Then connect with verbose output. Key exchange runs before authentication, so no registered key is needed. This is a real run from the Debian 12 machine we wrote this post on, on October 1, 2026:

```terminal
{
  "title": "OpenSSH 9.2p1 against github.com, 2026-10-01",
  "prompt": "$",
  "steps": [
    { "comment": "-F /dev/null ignores ssh_config, no key is offered, the long server-sig-algs line is shortened" },
    {
      "cmd": "ssh -F /dev/null -o BatchMode=yes -o PubkeyAuthentication=no -o UserKnownHostsFile=./kh -o StrictHostKeyChecking=accept-new -vT git@github.com 2>&1 | grep -E '^OpenSSH|kex: algorithm|host key algorithm|Server host key|server-sig-algs|Permanently|denied'",
      "output": "OpenSSH_9.2p1 Debian-2+deb12u10, OpenSSL 3.0.22 25 Aug 2026\ndebug1: kex: algorithm: sntrup761x25519-sha512\ndebug1: kex: host key algorithm: ssh-ed25519\ndebug1: Server host key: ssh-ed25519 SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU\nWarning: Permanently added 'github.com' (ED25519) to the list of known hosts.\ndebug1: kex_input_ext_info: server-sig-algs=<ssh-ed25519-cert-v01@openssh.com,...,rsa-sha2-512,rsa-sha2-256,ssh-rsa>\ngit@github.com: Permission denied (publickey)."
    }
  ]
}
```

Read three lines:

- **`kex: algorithm:`** is the agreed key exchange. If it says `diffie-hellman-group-exchange-sha256`, this client breaks during the brownouts.
- **`kex: host key algorithm:`** is how GitHub's host key is verified. The changelog words the SHA-1 removal generally, so treat `ssh-rsa` here as at risk too.
- **`server-sig-algs=`** lists the signature types GitHub accepts for your key. Today it still ends in `ssh-rsa`.

For your own test, drop `-F /dev/null`. Git uses your `ssh_config`, and a stale `KexAlgorithms` or `HostKeyAlgorithms` line there can pin you to the old algorithms.

**See both offers.** With `-vv`, OpenSSH prints `debug2: KEX algorithms:` and `debug2: host key algorithms:` twice: first your client's offer, then GitHub's. The key exchange list above comes from GitHub's.

**See the signature for your key.** With `-vvv` and a key GitHub accepts, OpenSSH 9.2p1 logs a line of this form when it signs:

```text
debug3: sign_and_send_pubkey: signing using rsa-sha2-512 SHA256:<your key fingerprint>
```

`rsa-sha2-512` or `rsa-sha2-256` is safe. `ssh-rsa` breaks. Our machine has no key registered on GitHub, so we confirmed this line against a local test server.

**Test without the old algorithms.** Remove both from your client's defaults. If this still authenticates, the brownout will not affect this client:

```bash
ssh -o KexAlgorithms=-diffie-hellman-group-exchange-sha256 \
    -o HostKeyAlgorithms=-ssh-rsa \
    -o PubkeyAcceptedAlgorithms=-ssh-rsa \
    -T git@github.com
```

A leading `-` removes algorithms from the default list. Before OpenSSH 8.5, `PubkeyAcceptedAlgorithms` was called `PubkeyAcceptedKeyTypes`.

**Know what failure looks like.** We forced a key exchange GitHub does not offer, and OpenSSH printed this (GitHub's offer list trimmed):

```text
Unable to negotiate with 140.82.121.4 port 22: no matching key exchange method found. Their offer: sntrup761x25519-sha512,...
```

With `HostKeyAlgorithms=ssh-dss`, it printed `no matching host key type found`. Search CI logs for these strings on November 4. Libraries word their errors differently.

**List what the binary supports.** `ssh -Q kex` lists key exchanges and `ssh -Q sig` lists signature algorithms (added in OpenSSH 7.9). For the settings your config actually applies to GitHub, run `ssh -G github.com` and read `kexalgorithms`, `hostkeyalgorithms` and `pubkeyacceptedalgorithms`.

## Test the clients that are not your shell's ssh

**Which ssh does Git run?** `core.sshCommand`, `GIT_SSH` and `GIT_SSH_COMMAND` can point Git at another program. Ask Git:

```bash
GIT_TRACE=1 git ls-remote git@github.com:your-org/your-repo.git 2>&1 | grep run_command
```

On our machine the `run_command` line contained `ssh -o SendEnv=GIT_PROTOCOL git@github.com 'git-upload-pack ...'`, so Git used the `ssh` on the path.

**Java.** Find the original JSch in your dependency tree:

```bash
mvn dependency:tree -Dincludes=com.jcraft:jsch
./gradlew dependencyInsight --dependency com.jcraft --configuration runtimeClasspath
```

The fork's README shows how to exclude `com.jcraft:jsch` when it arrives as a transitive dependency.

**Python.** `python3 -m pip show paramiko` prints the installed version.

**libssh2.** `curl -V` shows the libssh2 version curl links against. On our Debian 12 machine it printed `libssh2/1.10.0`, below GitHub's 1.11.0. We did not test whether it fails against GitHub, and distributions sometimes backport fixes, so test the tool rather than trusting the number.

**Go.** GitHub does not name the module behind "Go SSH". If it means `golang.org/x/crypto`, check its version in `go.mod`.

**Windows.** In PowerShell, `Get-Command ssh` shows which `ssh.exe` comes first on the path. Also check `git config --show-origin --get core.sshCommand` and `GIT_SSH`. If they point at plink, compare its version with PuTTY 0.82.

## Audit your keys

`ssh-keygen -l -f ~/.ssh/id_rsa.pub` prints a key's size in bits, its fingerprint and its type, such as `(RSA)` or `(ED25519)`. With `-f -` it reads keys from standard input.

**Account keys.** This lists every authentication key on your account with its upload date, size and type:

```bash
# Needs the read:public_key scope: gh auth refresh -h github.com -s read:public_key
gh api /user/keys --paginate --jq '.[] | [.created_at[0:10], .title, .key] | @tsv' |
  while IFS=$'\t' read -r created title key; do
    size_type=$(printf '%s\n' "$key" | ssh-keygen -l -f - | awk '{print $1, $NF}')
    printf '%s  %-14s  %s\n' "$created" "$size_type" "$title"
  done
```

RSA keys dated before 2021-11-02 are the only ones GitHub still lets sign with SHA-1. Check the clients that use them first.

**Deploy keys.** The deploy keys API returns `created_at` and `last_used`. This loop needs admin access to each repository and silently skips any it cannot read, so check the count:

```bash
ORG=your-org
gh repo list "$ORG" --limit 1000 --json nameWithOwner --jq '.[].nameWithOwner' |
  while read -r repo; do
    gh api "repos/$repo/keys" --paginate \
      --jq ".[] | [\"$repo\", .id, .created_at[0:10], (.last_used // \"never\")[0:10], .title, .key] | @tsv" 2>/dev/null
  done |
  while IFS=$'\t' read -r repo id created used title key; do
    size_type=$(printf '%s\n' "$key" | ssh-keygen -l -f - | awk '{print $1, $NF}')
    printf '%s\t%s\tadded %s\tused %s\t%s\t%s\n' "$repo" "$id" "$created" "$used" "$size_type" "$title"
  done
```

A key that was never used is a candidate for deletion, not rotation.

**Machine users.** Public authentication keys need no token:

```bash
curl -s https://github.com/your-machine-user.keys | ssh-keygen -l -f -
```

For upload dates, run the account key audit with the machine user's token.

## Rotate to Ed25519

GitHub recommends "an Ed25519 key whenever possible". For an account key:

```bash
# 1. Create the key. Add -N '' only for unattended CI keys.
ssh-keygen -t ed25519 -C "ci-runner-2026-10" -f ~/.ssh/id_ed25519_github

# 2. Register it. If the token lacks the scope, gh prints the refresh command.
gh ssh-key add ~/.ssh/id_ed25519_github.pub --title "ci-runner 2026-10"

# 3. Prove the new key works on its own.
ssh -i ~/.ssh/id_ed25519_github -o IdentitiesOnly=yes -T git@github.com
```

Then point Git at it in `~/.ssh/config` (our post on [using a specific SSH key for Git](/posts/specify-private-ssh-key-for-git-commands) has other ways):

```text
Host github.com
  IdentityFile ~/.ssh/id_ed25519_github
  IdentitiesOnly yes
```

When nothing uses the old key, find its ID with `gh ssh-key list` and remove it with `gh ssh-key delete <id>`.

For deploy keys, `gh repo deploy-key add key.pub --title "deploy 2026-10" -R your-org/your-repo` adds a read-only key, and `--allow-write` grants push access. Its help text warns that the key is "associated with the current authentication token" and is removed if that token is de-authorized. Add long-lived deploy keys in the repository settings instead.

:::warning
A new key type does not fix a key exchange problem. If a client's only key exchange in common with GitHub is `diffie-hellman-group-exchange-sha256`, it fails on January 13 with any key. Upgrade the client or library first.
:::

**Where Ed25519 is not supported:**

- **ECDSA.** GitHub says "All Ed25519 and ECDSA keys we support are strong, secure, and will continue to work for the indefinite future." Use `ssh-keygen -t ecdsa -b 256`.
- **RSA with 3072 bits or more,** if another service needs RSA: `ssh-keygen -t rsa -b 4096`. The client must still sign with SHA-2.
- **Old key parsers.** Since OpenSSH 7.8, `ssh-keygen` writes its own private key format. Some older libraries only read PEM, which `-m PEM` produces for RSA and ECDSA keys.

## Checklist before November 4

**CI images and agents**

1. List every image, runner and agent that runs Git over SSH, including container jobs.
2. Run `ssh -V` in each. Replace anything older than OpenSSH 7.2.
3. Run the test without old algorithms inside each image, with the job's credentials.
4. Check `/etc/ssh/ssh_config`, `/etc/ssh/ssh_config.d/` and baked-in `~/.ssh/config` files for `KexAlgorithms`, `HostKeyAlgorithms`, `PubkeyAcceptedAlgorithms` and `PubkeyAcceptedKeyTypes`.
5. Find JSch, Paramiko, libssh2 and Go SSH in your build tools.

**Deploy keys and machine users**

1. Run the deploy key audit for each organization and delete unused keys.
2. For RSA keys added before November 2, 2021, test the client that uses them, or switch to Ed25519.
3. Audit each machine user's keys with its own token, and test from the host that uses it.

**On the day**

1. Watch CI for `Unable to negotiate` and `Permission denied (publickey)`.
2. Treat any failure as a real finding, even if it stops after the brownout.

## What we could not verify

- **Brownout timing.** The changelog gives dates, not times or durations.
- **Existing small RSA keys.** The 3072-bit rule covers "new RSA SSH keys uploaded after October 14, 2026". The changelog does not say existing 2048-bit keys stop working. We assume deploy keys and re-uploaded old keys count as new uploads, but it does not say so.
- **Libraries.** We did not test JSch, Paramiko, libssh2, Go or PuTTY. The table is GitHub's.
- **A real SHA-1 signature.** We had no RSA key from before November 2021 to test with.
- **Server lists.** These are what GitHub offered on October 1, 2026. They can change.

## Summary

GitHub removes RSA with SHA-1 signatures and one Diffie-Hellman key exchange on January 13, 2027, with brownouts on November 4 and December 9. HTTPS remotes are not affected. Your RSA key can stay, but the client must sign with SHA-2 and share a modern key exchange with GitHub.

Before November 4, test every place that runs Git over SSH with the old algorithms removed, and audit account keys, deploy keys and machine users. Move to Ed25519 where you can, and to ECDSA or 3072-bit RSA where you cannot. For another client-side SSH risk in some of the same libraries, see our post on [libssh2 CVE-2026-55200](/posts/libssh2-cve-2026-55200-client-side-ssh).
