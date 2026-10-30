---
title: 'eMudhra CA Compromise: Two Roots to Remove, and Dropping Comodo AAA Broke 1 of 16,125 Sites'
excerpt: 'Browsers blocked the eight compromised eMudhra keys in hours; your images and runtimes read their own trust stores. We tested 34 stores from package files, real curl, Python, Node.js, Go and GnuTLS clients, and the chains served by the top 20,000 sites. Debian needed two roots removed because of a Sectigo cross-sign, and removing Comodo AAA broke one site for current OpenSSL.'
category:
  name: 'Security'
  slug: 'security'
date: '2026-11-03'
publishedAt: '2026-11-03T09:00:00Z'
updatedAt: '2026-11-03T09:00:00Z'
readingTime: '13 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Security
  - TLS
  - Certificates
  - Docker
  - Debian
  - Java
  - Node.js
  - Go
---

Firefox and Chrome stopped trusting the eight compromised eMudhra intermediate CA keys within hours of the report on 17 October 2026. Your containers, JVMs, virtualenvs and Go binaries did not get that update. Each of them reads its own copy of a trust store, and that copy decides whether a forged certificate for any hostname is accepted.

We took 34 trust stores out of package files and verified the public test chains for the compromised keys against each one. Then we connected real clients to the public test hosts, and checked what Debian's fix does to the chains that 16,348 of the top 20,000 sites send.

Three results matter if you run anything outside a browser:

- **Two roots, not one.** Each compromised TLS key chains to `emSign ECC Root CA - G3` and, through a Sectigo cross-sign, to `AAA Certificate Services`. Debian 11, 12 and 13, Ubuntu 24.04 as released, Alpine 3.18 and OpenJDK's `cacerts` held both. There, removing only the emSign root leaves the Sectigo path open.
- **The root list predicts everything.** In 560 OpenSSL verifications, the two roots decided every result. The fixed Go, Node.js, Bun and CPython releases reject the keys whatever the store says, even with the old Debian 12 bundle.
- **Removing AAA broke one site.** Of 16,125 served chains, one (`jisc.ac.uk`) failed after Debian's fix with current OpenSSL, GnuTLS and Go. 262 more fail only for a client that never looks for another path.

## TL;DR

- Update `ca-certificates` and rebuild images from a fresh base. A digest pinned before 20 October keeps the old bundle.
- Debian 11, Alpine 3.18 and 3.19 and Node.js 20 get no fix. Their newest packages still trust the keys.
- On Debian and Ubuntu, delete `/etc/ssl/certs/java/cacerts` and run `update-ca-certificates --fresh`; the Java keystore is not rebuilt on its own.
- Upgrade to runtimes that block the keys in code: Go 1.26.10 or 1.27.3 (then rebuild your Go binaries), Node.js 22.23.4, 24.22.1 or 26.12.1, Bun 1.4.4, Python 3.11.18, 3.12.16, 3.13.18, 3.14.10 or 3.15.2.
- If you run a server, do not end your chain at a certificate issued by `AAA Certificate Services`.
- Run [`scan-tree.py`](https://github.com/The-DevOps-Daily/emudhra-trust-store-check) on an unpacked image, a virtualenv or a JDK to find what still trusts the keys.

## Prerequisites

- Container images, CI runners or servers that make outbound TLS connections
- Python 3.9 or later and the OpenSSL 3 command line tool, to run the companion scripts
- `docker` (or any tool that can export an image filesystem) if you want to scan images

## What happened, in short

On 17 October, a researcher reported to the Apple, Chrome, Microsoft and Mozilla root programs that the private keys of eight eMudhra intermediate CAs could be computed from their public certificates. Mozilla confirmed it and had Firefox blocking them through OneCRL by 22:59 UTC the same day. Six of the eight CAs issue TLS certificates; two are code signing CAs ([Mozilla bug 2083449](https://bugzilla.mozilla.org/show_bug.cgi?id=2083449)).

The keys are not theoretical. Between 20 and 21 October, 107,107 certificates signed with six of the keys were logged to Certificate Transparency by people other than eMudhra, including 106,050 proof-of-concept certificates for `google.com` ([comment 44](https://bugzilla.mozilla.org/show_bug.cgi?id=2083449#c44)). Almost none of them carry a revocation URL.

Browsers get blocks through OneCRL, CRLSets and Apple's and Microsoft's trust updates. Almost everything else reads a file. We used the public chains and test hosts of the [incident tracker](https://emudhra.we-have-a-problem.com/), which also lists the patched versions.

| Date (UTC)   | What changed                                                                                                                                       |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 17 to 19 Oct | Firefox (OneCRL), Chrome (CRLSets) and Apple block the certificates; eMudhra and Sectigo revoke them                                               |
| 20 Oct       | Go 1.26.10 and 1.27.3; Debian `20250419~deb12u2` and `20250419+deb13u1`; Ubuntu `20260816ubuntu0.*`; certifi 2026.10.19; curl CA bundle 2026-10-20 |
| 21 Oct       | Node.js 22.23.4, 24.22.1 and 26.12.1                                                                                                               |
| 22 Oct       | Bun 1.4.4                                                                                                                                          |
| 24 to 27 Oct | OpenJDK removes four roots from its source tree (JDK-8395690); no OpenJDK update release yet                                                       |
| 26 Oct       | Python 3.15.2, 3.14.10, 3.13.18, 3.12.16 and 3.11.18                                                                                               |

## One key, two certificates, two roots

Each of the six TLS keys appears in two intermediate certificates with the same subject and the same public key. One was issued by `emSign Root TLS CA - G3`, which is cross-signed by `emSign ECC Root CA - G3`. The other was cross-signed by Sectigo's `AAA Certificate Services` (the old Comodo root, called `Comodo AAA Services root` in Mozilla's data). A leaf signed with the key verifies through either one.

```diagram
{
  "type": "graph",
  "columns": [
    [{ "id": "leaf", "label": "Forged leaf", "sub": "any hostname", "icon": "globe", "tone": "red" }],
    [
      { "id": "em", "label": "EM DV TLS CA - G3B", "sub": "issued by eMudhra", "icon": "lock", "tone": "red", "detail": "Same subject and same public key as the Sectigo cross-sign. Revoked 18 October." },
      { "id": "aaa-x", "label": "EM DV TLS CA - G3B", "sub": "cross-signed by Sectigo", "icon": "lock", "tone": "red", "detail": "Same key, different issuer. Revoked 19 October." }
    ],
    [
      { "id": "tlsg3", "label": "emSign Root TLS CA - G3", "sub": "cross-signed", "icon": "shield", "tone": "amber" },
      { "id": "aaa", "label": "AAA Certificate Services", "sub": "Comodo, 2004", "icon": "shield", "tone": "violet", "detail": "Mozilla stopped trusting it for TLS in April 2025. Stores built from older Mozilla data still hold it." }
    ],
    [{ "id": "eccg3", "label": "emSign ECC Root CA - G3", "sub": "removed 20 Oct", "icon": "shield", "tone": "amber" }]
  ],
  "edges": [["leaf", "em"], ["leaf", "aaa-x"], ["em", "tlsg3"], ["aaa-x", "aaa"], ["tlsg3", "eccg3"]]
}
```

Mozilla stopped trusting `AAA Certificate Services` for TLS in April 2025: its root data (NSS builtins) marks the root as trusted for server authentication in version 2.74 and not in 2.76, which came with NSS 3.111. Debian's `20250419` package is built from 2.74, so Debian 11, 12 and 13 hold AAA, and so do Ubuntu 24.04's release-pocket package and Alpine 3.18. Bundles built from later data (Ubuntu's June 2026 update, Alpine 3.19, certifi, curl, Node.js, Bun, RHEL, Temurin) held only the emSign root. Debian's own August 2026 unstable package, built from 2.90, has no AAA either: the cause is the age of the data. That is why Debian removed two roots and the others removed one.

## Finding 1: the root list decides it

Every script, recorded result and the scanner are in the companion repository. Each stage writes a file the next stage reads, and every number below comes from one of those files.

```github
https://github.com/The-DevOps-Daily/emudhra-trust-store-check
```

We took each trust store out of its package file, so we know exactly which version we tested; the repository records the URL and SHA-256 of every download. For each store, a script first predicted the result: it accepts the emSign path if it holds `emSign ECC Root CA - G3`, and the Sectigo path if it holds `AAA Certificate Services`. Then `openssl verify` checked the 16 public test chains (eight per path, including leaves never logged to CT and chains through a rollover certificate) against each store, with the clock fixed at 30 October 00:00 UTC.

The result: 560 verifications, 0 that differed from the prediction. A store accepts all eight chains of a path, or none.

| Trust store                   | Before the fix                                                            | Fixed in                                                |
| ----------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------- |
| Debian 11 bullseye            | both paths (`20250419~deb12u1~deb11u1`, the newest)                       | no fix, LTS ended 31 August 2026                        |
| Debian 12 bookworm            | both paths (`20250419~deb12u1`)                                           | `20250419~deb12u2`                                      |
| Debian 13 trixie              | both paths (`20250419`)                                                   | `20250419+deb13u1`                                      |
| Ubuntu 24.04                  | both paths (`20240203`, release pocket); emSign path (`20260601~24.04.1`) | `20260816ubuntu0.24.04.1`                               |
| Ubuntu 22.04                  | emSign path (`20260601~22.04.1`)                                          | `20260816ubuntu0.22.04.1`                               |
| Alpine 3.18, 3.19 (EOL)       | both paths (3.18), emSign path (3.19)                                     | no fix in either branch                                 |
| Alpine 3.22                   | not tested                                                                | `20261020-r0` (also in 3.20, 3.21, 3.23, 3.24 and edge) |
| RHEL 9 family                 | emSign path (`2025.2.80_v9.0.305-91.el9`)                                 | `2026.2.92_v9.0.319-90.3.el9_8`                         |
| Python certifi                | emSign path (2025.8.3, 2026.7.22)                                         | 2026.10.18                                              |
| curl CA bundle                | emSign path (2026-09-25)                                                  | 2026-10-20                                              |
| Node.js bundled roots         | emSign path (20.20.2, 22.23.3, 24.22.0)                                   | 22.23.4, 24.22.1                                        |
| Bun bundled roots             | emSign path (1.4.3)                                                       | 1.4.4                                                   |
| OpenJDK source `cacerts`      | both paths (jdk21u before JDK-8395690)                                    | in source since 27 October; no update release yet       |
| Eclipse Temurin JRE `cacerts` | emSign path (21.0.12.1+1; 11.0.32.1+1, the newest 11 build)               | 21.0.13+9 holds neither root                            |

Three details from the table are easy to miss:

- **Temurin is not OpenJDK.** OpenJDK's own `cacerts` holds both roots, and OpenJDK [tells you](https://openjdk.org/emudhra) to delete four of them by hand. Temurin builds its `cacerts` from Mozilla's data, so its 23 October release already holds neither. A JDK from another vendor can be either; check the file, not the version.
- **certifi over-removed first.** certifi 2026.10.18 removed every emSign root, including `emSign Root CA - G1`, which Mozilla still trusts. Users of the InCommon certificate service, which many US universities use, reported breakage in [issue #439](https://github.com/certifi/python-certifi/issues/439), and 2026.10.19 put the unaffected roots back. In our scan below, 47 of the top 20,000 sites chain to `emSign Root CA - G1`.
- **Removing one root is not enough everywhere.** We built one synthetic store, Debian 12's old bundle minus only `emSign ECC Root CA - G3`. It rejected all eight emSign-path chains and accepted all eight Sectigo-path chains. That is what you get if you apply the one-root workaround, which is right for Alpine, to a Debian image.

```terminal
{
  "title": "the Sectigo-path chain against three Debian 12 bundles",
  "autoplay": false,
  "steps": [
    { "comment": "old bundle: holds both roots" },
    { "cmd": "openssl verify -no-CApath -no-CAstore -attime 1793318400 -CAfile debian-12-before.pem -untrusted aaa-chain.pem aaa-chain.pem", "output": "aaa-chain.pem: OK" },
    { "comment": "old bundle minus emSign ECC Root CA - G3 only" },
    { "cmd": "openssl verify -no-CApath -no-CAstore -attime 1793318400 -CAfile minus-emsign.pem -untrusted aaa-chain.pem aaa-chain.pem", "output": "aaa-chain.pem: OK" },
    { "comment": "20250419~deb12u2: both roots removed" },
    { "cmd": "openssl verify -no-CApath -no-CAstore -attime 1793318400 -CAfile debian-12-fixed.pem -untrusted aaa-chain.pem aaa-chain.pem", "output": "C = NL, O = eMudhra BV, CN = EM DV TLS CA - G3B\nerror 20 at 1 depth lookup: unable to get local issuer certificate\nerror aaa-chain.pem: verification failed" }
  ]
}
```

`-no-CApath -no-CAstore` keeps the machine's own `/etc/ssl/certs` out of the test, and `-attime` makes the result repeatable. There is no revocation check, which is also the default in curl, Python's `ssl` module, Node.js, Go and Java.

## Finding 2: a blocklist in the runtime beats a stale store

Four runtimes did not wait for trust stores. Go 1.26.10 and 1.27.3 ([go.dev/issue/82345](https://go.dev/issue/82345)), Node.js 22.23.4, 24.22.1 and 26.12.1, Bun 1.4.4 and the October 26 CPython releases compile a list of the eight compromised public keys into their TLS code, and reject any chain that contains one of them. Bun's release notes mention only a root update; the list is in `blocked_spkis.cpp`. Our first stage downloads the four source files from the fix commits: all four hold the same eight SHA-256 hashes of the SubjectPublicKeyInfo. Because they match the key, not a certificate, they cover both certificates of every key, and the rollover chains.

To see the difference with real clients, we connected curl, Python, Node.js and Go on a Debian 12 machine to two of the public test hosts: one serves the emSign path, the other the Sectigo path. Each client got a trust store from the matrix above. For Go, we built the same small HTTPS client with Go 1.26.9 and 1.26.10. All 24 results matched the prediction:

| Client                    | Trust store                                      | emSign path | Sectigo path |
| ------------------------- | ------------------------------------------------ | ----------- | ------------ |
| curl 7.88.1 (OpenSSL 3.0) | Debian 12 `20250419~deb12u1`                     | accepted    | accepted     |
| curl 7.88.1               | Ubuntu 24.04 `20260601~24.04.1`                  | accepted    | rejected     |
| curl 7.88.1               | Debian 12 `20250419~deb12u2`                     | rejected    | rejected     |
| Python 3.11.2 (Debian 12) | Debian 12 `20250419~deb12u1`                     | accepted    | accepted     |
| Python 3.11.2             | certifi 2026.7.22                                | accepted    | rejected     |
| Python 3.11.2             | certifi 2026.10.19                               | rejected    | rejected     |
| Node.js 24.22.0           | bundled roots                                    | accepted    | rejected     |
| Node.js 24.22.0           | `--use-openssl-ca`, Debian 12 `20250419~deb12u1` | accepted    | accepted     |
| Node.js 24.22.1           | bundled roots                                    | rejected    | rejected     |
| Node.js 24.22.1           | `--use-openssl-ca`, Debian 12 `20250419~deb12u1` | rejected    | rejected     |
| Go 1.26.9                 | `SSL_CERT_FILE`, Debian 12 `20250419~deb12u1`    | accepted    | accepted     |
| Go 1.26.10                | `SSL_CERT_FILE`, Debian 12 `20250419~deb12u1`    | rejected    | rejected     |

With the old Debian bundle, curl, Python, Node.js 24.22.0 and Go 1.26.9 accept a chain signed with a compromised key on both paths. Node.js 24.22.1 and Go 1.26.10 with the same bundle refuse both. Go 1.26.10 reports `x509: no valid chains built`, and Node.js reports `CERT_REVOKED`:

```terminal
{
  "title": "same stale bundle, two Node.js versions (30 October, 11:25 UTC)",
  "autoplay": false,
  "steps": [
    { "comment": "debian-12-before.pem is ca-certificates 20250419~deb12u1; get.js is in tools/" },
    { "cmd": "SSL_CERT_FILE=debian-12-before.pem SSL_CERT_DIR=/nonexistent ./node-24.22.0 --use-openssl-ca get.js dv-g3b-aaa-emudhra.we-have-a-problem.com", "output": "ACCEPT HTTP 200" },
    { "cmd": "SSL_CERT_FILE=debian-12-before.pem SSL_CERT_DIR=/nonexistent ./node-24.22.1 --use-openssl-ca get.js dv-g3b-aaa-emudhra.we-have-a-problem.com", "output": "reject CERT_REVOKED: certificate revoked" }
  ]
}
```

Debian 12's own Python (`3.11.2-6+deb12u9` on our machine) has no denylist, and OpenJDK fixed Java only by removing roots from `cacerts`. Both are only as safe as the bundle they read. On macOS, Apple [says](https://support.apple.com/en-us/149555) that the system `curl`, `git` and `python3` check `/etc/ssl/cert.pem` and accept these chains until a future update.

## Finding 3: what removing AAA breaks

Removing `AAA Certificate Services` closes the Sectigo path, but other chains still use this 2004 root, and Apple and the incident tracker both warn that removing it can break sites. We measured how many.

We connected once to each of the top 20,000 domains of the Tranco list `PYK6J` (or to `www.` if the bare name failed), from one IPv4 address on 30 October between 11:11 and 11:36 UTC, and saved the chain each server sent. 16,348 answered. A small C program on OpenSSL 3.0.22 then verified every chain against Debian 12's bundle before and after the fix (Debian 13's bundles hold the same certificates), in three ways:

- **modern**: the OpenSSL default since 1.1.0, which looks in the trust store first at each step
- **nofirst**: trust store first turned off, alternative chain search on
- **strict**: both turned off, so the verifier follows only the chain the server sent

Of the 16,348 chains, 16,125 verified before the fix in modern mode. 1,296 contain a Sectigo, Comodo, USERTrust or AAA certificate, and 283 include a certificate that AAA issued. After the fix:

| Mode    | Chains that verified before the fix | Anchored at AAA before the fix | Broken by the fix |
| ------- | ----------------------------------- | ------------------------------ | ----------------- |
| modern  | 16,125                              | 1                              | 1                 |
| nofirst | 16,124                              | 262                            | 1                 |
| strict  | 16,111                              | 262                            | 262               |

No chain was anchored at `emSign ECC Root CA - G3`, so every break comes from AAA. Most of the 262 servers send an old copy of a current root, such as `USERTrust RSA Certification Authority`, cross-signed by AAA. A modern verifier finds the self-signed copy of that root in the store first and never reaches AAA. A verifier that follows only the served chain gets to AAA, does not find it, and fails:

```chart
{
  "type": "bar",
  "title": "Chains that break only for a client that follows the served chain",
  "caption": "262 of the 16,111 chains that verified in strict mode before the fix, Tranco PYK6J top 20,000, scanned 30 October 2026. Grouped by the certificate issued by AAA Certificate Services that the server sends. In modern mode, OpenSSL 3.0 accepts all but one of them after the fix.",
  "rows": [
    {
      "label": "USERTrust RSA Certification Authority",
      "value": 193
    },
    {
      "label": "SSL.com TLS ECC or RSA Root CA 2022",
      "value": 31
    },
    {
      "label": "Sectigo Public Server Authentication Root R46",
      "value": 23
    },
    {
      "label": "USERTrust ECC Certification Authority",
      "value": 12
    },
    {
      "label": "COMODO RSA Certification Authority",
      "value": 2
    },
    {
      "label": "SSL.com TLS Issuing ECC CA R2",
      "value": 1
    }
  ]
}
```

The one real break is `jisc.ac.uk`, and it is not a Sectigo certificate. The server sends its leaf and `SSL.com TLS Issuing ECC CA R2`, cross-signed by AAA, and nothing else. The same key also has a certificate from `SSL.com TLS ECC Root CA 2022` ([crt.sh 8505503579](https://crt.sh/?id=8505503579)), which Debian holds, but the server does not send it, and OpenSSL does not fetch missing intermediates. So on our Debian 12 machine after the fix, curl fails:

```terminal
{
  "title": "jisc.ac.uk before and after Debian removed AAA",
  "autoplay": false,
  "steps": [
    {
      "comment": "Debian 12, ca-certificates 20250419~deb12u2, 30 October 11:44 UTC"
    },
    {
      "cmd": "curl -sS -o /dev/null --max-time 20 -w '%{http_code}\\n' https://jisc.ac.uk/",
      "output": "curl: (60) SSL certificate problem: unable to get local issuer certificate\nMore details here: https://curl.se/docs/sslcerts.html\n\ncurl failed to verify the legitimacy of the server and therefore could not\nestablish a secure connection to it. To learn more about this situation and\nhow to fix it, please visit the web page mentioned above.\n000"
    },
    {
      "cmd": "curl -sS -o /dev/null --max-time 20 -w '%{http_code}\\n' --cacert stores/debian-12-before.pem --capath /nonexistent https://jisc.ac.uk/",
      "output": "301"
    }
  ]
}
```

To check this with a second TLS stack, we ran `git ls-remote` (git 2.39.5, which uses GnuTLS 3.7.9 on Debian 12) against `jisc.ac.uk` and a seeded random sample of 20 of the other 261 strict-mode breaks, with both bundles. GnuTLS rejected `jisc.ac.uk` after the fix and accepted the 20 others. Our Go client, built with Go 1.26.9 and 1.26.10, also failed on `jisc.ac.uk` with the fixed bundle (`x509: certificate signed by unknown authority`).

So the AAA removal costs little with current OpenSSL, GnuTLS and Go. The risk is in servers that send only an AAA cross-sign of an intermediate, like `jisc.ac.uk`, where the fix is to send the intermediate that the current root issued, and in clients that cannot search for another path, which we modelled but did not identify.

## Where the old roots hide

Updating the host does not update what your services read. Check these first:

1. **Images built before 20 October**, and every image pinned by digest. The bundle is a file in a layer. Docker's own [note](https://www.docker.com/blog/php2shell-and-emudhra-patched/) puts it plainly: an image "keeps trusting them until it is rebuilt".
2. **Bases and runtimes that will not get a fix.** `debian:bullseye` and everything built on it, `alpine:3.18` and `alpine:3.19`: their newest `ca-certificates` packages still trust both paths or the emSign path. Node.js 20, end of life since 30 April 2026, still bundles the emSign root and has no blocklist.
3. **The Java keystore on Debian and Ubuntu.** `ca-certificates-java` does not rebuild `/etc/ssl/certs/java/cacerts` when `ca-certificates` changes, so OpenJDK packages keep the old roots after the update ([OpenJDK guidance](https://openjdk.org/emudhra#debian)).
4. **Bundles copied by hand.** A `COPY --from=build /etc/ssl/certs/ca-certificates.crt` into a `scratch` or distroless image, a `certifi` pin in a lockfile, or `SSL_CERT_FILE`, `REQUESTS_CA_BUNDLE`, `PIP_CERT` and `NODE_EXTRA_CA_CERTS` pointing at a file from last year.
5. **Static Go binaries built with Go older than 1.26.10.** The blocklist is compiled in, so only a rebuild adds it. `go version -m ./binary` prints the Go version that built it.
6. **Runtimes with their own roots.** Node.js before 22.23.4 or 24.22.1 and Bun before 1.4.4 use bundled roots by default, not the system store.

To find them, the companion repository has `scan-tree.py`. It reads a directory tree and reports bundles, keystores and binaries that hold either root, runtimes that carry the blocklist, and Go programs and CPython `ssl` modules that do not. This is its real output on a test tree with six files: the old Debian 12 bundle, Node.js 24.22.0 and 24.22.1, a fixed certifi bundle (correctly silent), the `ssl` module of Debian 12's Python, and Temurin 11's `cacerts`:

```text
TRUSTS   fixture/etc/ssl/certs/ca-certificates.crt
         CA bundle with 150 certificates holds emSign ECC Root CA - G3 and AAA Certificate Services
TRUSTS   fixture/usr/local/bin/node
         embeds emSign ECC Root CA - G3 in its bundled roots
TRUSTS*  fixture/usr/lib/python3.11/lib-dynload/_ssl.cpython-311-aarch64-linux-gnu.so
         CPython ssl module without the eMudhra blocklist: it accepts whatever its trust store accepts
TRUSTS   fixture/usr/lib/jvm/temurin-11/lib/security/cacerts
         CA bundle with 118 certificates holds emSign ECC Root CA - G3
ok       fixture/opt/node-24.22.1/bin/node
         carries the eMudhra SPKI blocklist (all 8 keys)

4 finding(s) that still trust a chain through the compromised keys.
TRUSTS*: safe only if every trust store the program reads at run time is fixed.
```

`TRUSTS*` means the program has no blocklist of its own, so it is only as safe as the bundle it reads. For a container image, export the filesystem and scan it:

```bash
mkdir rootfs && docker export "$(docker create IMAGE)" | tar -xf - -C rootfs
python3 scan-tree.py rootfs
```

Then fix what it finds:

```bash
# Debian and Ubuntu images: upgrade the bundle, then rebuild the Java keystore
apt-get update && apt-get install --only-upgrade -y ca-certificates
rm -f /etc/ssl/certs/java/cacerts && update-ca-certificates --fresh

# Alpine 3.20 and later (3.18 and 3.19 get no fix: move to a newer base)
apk upgrade --no-cache ca-certificates ca-certificates-bundle

# Check what an image actually has
dpkg-query -W ca-certificates   # fixed: 20250419~deb12u2, 20250419+deb13u1, 20260816ubuntu0.*
apk info -v ca-certificates-bundle   # fixed: 20261020-r0
rpm -q ca-certificates   # RHEL 9 fixed: 2026.2.92_v9.0.319-90.3.el9_8
```

## What we could not conclude

- **How many systems are still exposed.** The matrix says what each version does, not how many copies of each version are running. We picked old versions on purpose.
- **Other JDKs and platform verifiers.** We did not check the `cacerts` of Amazon Corretto, Azul Zulu, Microsoft's build, Oracle JDK or distribution packages, and did not test Windows, macOS or Android; for those we relied on the vendors.
- **RHEL's real extraction.** We did not run `trust extract`; we parsed the p11-kit file and kept certificates trusted for server authentication. Our fixed RHEL 9 store has 118 certificates, the same count as the curl bundle of 20 October, which is a cross-check, not proof.
- **Revocation.** We did not test clients with CRL or OCSP checks turned on. The leaves on the test hosts have no revocation pointers, and the eMudhra CRL endpoint refused some User-Agents ([comment 44](https://bugzilla.mozilla.org/show_bug.cgi?id=2083449#c44)), so we would not count on it.
- **AAA beyond the top 20,000.** One IPv4 address, one morning, the bare name or `www.` only. Internal services, other host names, mail servers and the long tail can differ, and a CDN can send a different chain to a different network.
- **Which real clients behave like "strict" mode.** We modelled them with two OpenSSL flags. OpenSSL 3.0 in modern mode handled 261 of the 262 chains, and GnuTLS 3.7.9 the 20 we sampled. We did not test Java, rustls, Windows, macOS or embedded TLS libraries on them, or Go beyond `jisc.ac.uk`.

## Summary

- Each compromised key chains to two roots. Stores built from Mozilla data older than April 2025, including Debian 11, 12 and 13, need both `emSign ECC Root CA - G3` and `AAA Certificate Services` removed.
- The roots in a store predicted all 560 of our verifications. Check the file, not the version string; `scan-tree.py` does that for a whole image.
- The fixed Go, Node.js, Bun and Python releases block the keys whatever the store says. Debian 11, Alpine 3.18 and 3.19 and Node.js 20 get no fix.
- Removing AAA broke one site in the top 20,000 for current OpenSSL, GnuTLS and Go, and the fix for it is on the server.
