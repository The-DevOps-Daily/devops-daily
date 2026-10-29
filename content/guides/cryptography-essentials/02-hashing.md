---
title: 'Hashing: Checksums, Signed Releases, HMAC and Passwords'
description: 'Hash functions for DevOps: SHA-256 and BLAKE3, verifying releases with checksums, GPG and Sigstore, content digests, HMAC webhooks and Argon2id passwords.'
order: 2
---

**TLDR**: A hash turns any input into a short fingerprint. Use SHA-256 (or SHA-512, SHA-3, BLAKE2, BLAKE3) for integrity, never MD5 or SHA-1 where an attacker is involved. A checksum only proves a download matches the checksum file; verify a signature on that file (GPG or Sigstore) to prove who published it. Git commits and container images are named by hashes, so pin by digest. Use HMAC with a secret key to authenticate messages such as webhooks, and compare with a constant-time function. Store passwords with Argon2id (or bcrypt or scrypt), never with a fast hash.

A cryptographic hash function takes input of any size and returns a fixed-size digest. It is a **one-way** function: you cannot get the input back from the digest. Unlike encryption, there is no key and nothing to decrypt. DevOps work uses hashes all the time: checksums on downloads, image digests in Kubernetes manifests, Git commit IDs, cache keys, webhook signatures and password databases.

In this part you verify a real release with a checksum, a GPG signature and a Sigstore signature, compute a Git object ID and a container image digest by hand, sign and check a webhook payload, and measure why passwords need a slow hash.

## Prerequisites

- The lab tools from the [guide overview](/guides/cryptography-essentials#h2-set-up-the-lab): coreutils, OpenSSL, GnuPG, Git, curl, Python 3 with `argon2-cffi` and `bcrypt`, and [cosign](https://docs.sigstore.dev/cosign/system_config/installation/) for the Sigstore step.
- Internet access for the download steps.
- [Part 1](/guides/cryptography-essentials/01-encryption) is helpful for the section on signatures, but not required.

The outputs are real, from Ubuntu 26.04 LTS on a Raspberry Pi 4 (GnuPG 2.4.8, Git 2.53.0, cosign 3.1.4, Python 3.14 with argon2-cffi 25.1.0 and bcrypt 5.0.0). The guess rates were measured on that small ARM board; faster hardware gives higher rates.

```terminal
{
  "title": "lab setup",
  "prompt": "$",
  "steps": [
    {
      "cmd": "mkdir -p ~/crypto-lab/part2 && cd ~/crypto-lab/part2"
    }
  ]
}
```

## What a Hash Function Guarantees

| Property                        | Meaning                                                      | Why you care                                            |
| ------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------- |
| **Deterministic**               | The same input always gives the same digest                  | Anyone can recompute and compare                        |
| **Fixed size**                  | 32 bytes for SHA-256, whatever the input                     | Cheap to store, compare and publish                     |
| **Pre-image resistance**        | Given a digest, you cannot find an input for it              | Digests do not reveal the data (if it is not guessable) |
| **Second pre-image resistance** | Given an input, you cannot find another with the same digest | Nobody can swap a file for a different one              |
| **Collision resistance**        | You cannot find any two inputs with the same digest          | Signatures over digests stay meaningful                 |

A one-character change gives a completely different digest:

```terminal
{
  "title": "the avalanche effect",
  "prompt": "$",
  "steps": [
    {
      "cmd": "printf 'Hello World' | sha256sum",
      "output": "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e  -"
    },
    {
      "cmd": "printf 'Hello World!' | sha256sum",
      "output": "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069  -"
    }
  ]
}
```

These two digests are the same on every machine, so you can check them yourself. Note the caveat in the pre-image row: a hash does not hide guessable data. Hashing an email address, a phone number or a short password gives no privacy, because an attacker can hash every candidate and compare.

## Which Hash Functions to Use

| Algorithm             | Digest size    | Status                | Where you meet it                                                     |
| --------------------- | -------------- | --------------------- | --------------------------------------------------------------------- |
| **SHA-256**           | 256 bits       | Recommended           | Checksums, TLS, certificates, container digests, Git (SHA-256 repos)  |
| **SHA-384 / SHA-512** | 384 / 512 bits | Recommended           | Certificates, higher security margins; SHA-512 is fast on 64-bit CPUs |
| **SHA-3 (SHA3-256)**  | 256 bits       | Recommended           | A different design from SHA-2, as a backup standard                   |
| **BLAKE2 / BLAKE3**   | variable       | Recommended           | `b2sum` (BLAKE2b), WireGuard (BLAKE2s), `b3sum`, fast file hashing    |
| **SHA-1**             | 160 bits       | Broken for collisions | Classic Git object IDs (with collision detection), old signatures     |
| **MD5**               | 128 bits       | Broken                | Legacy checksums; never for anything an attacker can influence        |

SHA-1 collisions became practical in 2017 (the [SHAttered](https://shattered.io) PDFs) and chosen-prefix collisions in 2020, which is the kind used to forge certificates and signatures. MD5 collisions take seconds on a laptop. For accidental corruption either still "works", but there is no reason to choose them: SHA-256 is fast everywhere and available everywhere.

```terminal
{
  "title": "one file, several hash functions",
  "prompt": "$",
  "steps": [
    {
      "cmd": "printf 'orders-api v2.4.0\\n' > release-notes.txt"
    },
    {
      "cmd": "sha256sum release-notes.txt",
      "output": "71f5cdef2438c0248e0e949ab807eea71ced08178ada3c4d4dbf3d6e32db411e  release-notes.txt"
    },
    {
      "cmd": "sha512sum release-notes.txt | cut -c1-64",
      "output": "b9ff22846fd3791e56ed71af819d2402324925333001440ac627e23217e264e3"
    },
    {
      "cmd": "openssl dgst -sha3-256 release-notes.txt",
      "output": "SHA3-256(release-notes.txt)= 802e173f00aefa923d333e65e1633647034d4ce3e5c8c2ea0cecd79b9b9e3275"
    },
    {
      "cmd": "b3sum release-notes.txt",
      "output": "7c2dec50c1f7cb86a0d2a2b051e6cc73d4255c27b190c325fe04e303d8a3e11b  release-notes.txt"
    }
  ]
}
```

## Verifying Downloads: Checksums Versus Signatures

Most projects publish a checksum file next to each release. A checksum proves that what you downloaded matches the checksum file. It does **not** prove who made either of them: if an attacker controls the download server or the release page, they replace both. To know the file came from the publisher, verify a **signature** over it, made with a key or identity you trust independently of the download.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Download", "sub": "artifact + checksums + signature", "icon": "cloud", "tone": "slate" },
    { "label": "Check the hash", "sub": "sha256sum -c", "icon": "check", "tone": "blue" },
    { "label": "Check the signature", "sub": "GPG key or Sigstore identity", "icon": "shield", "tone": "violet" },
    { "label": "Install", "sub": "only if both pass", "icon": "rocket", "tone": "green" }
  ]
}
```

### A Sigstore-Signed Release

[Sigstore](https://www.sigstore.dev) signs with short-lived certificates tied to an identity, such as a GitHub Actions workflow, and records every signature in a public transparency log (Rekor). There is no long-lived signing key to steal, and you verify **who** signed instead of which key. The [step CLI](https://github.com/smallstep/cli) used in Part 4 is released this way, so verify it before you install it:

```terminal
{
  "title": "verify the step CLI release",
  "prompt": "$",
  "steps": [
    {
      "comment": "amd64 or arm64",
      "cmd": "V=0.31.0; ARCH=$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/')"
    },
    {
      "cmd": "for f in step_linux_${V}_${ARCH}.tar.gz step_linux_${V}_${ARCH}.tar.gz.sigstore.json checksums.txt; do curl -sSfLO \"https://github.com/smallstep/cli/releases/download/v$V/$f\"; done"
    },
    {
      "comment": "1. the hash matches the published checksum file",
      "cmd": "sha256sum -c --ignore-missing checksums.txt",
      "output": "step_linux_0.31.0_arm64.tar.gz: OK"
    },
    {
      "comment": "2. the release was signed by smallstep's release workflow for this tag",
      "cmd": "cosign verify-blob step_linux_${V}_${ARCH}.tar.gz \\\n  --bundle step_linux_${V}_${ARCH}.tar.gz.sigstore.json \\\n  --certificate-identity https://github.com/smallstep/workflows/.github/workflows/goreleaser.yml@refs/heads/main \\\n  --certificate-oidc-issuer https://token.actions.githubusercontent.com \\\n  --certificate-github-workflow-repository smallstep/cli \\\n  --certificate-github-workflow-ref refs/tags/v$V",
      "output": "Verified OK"
    },
    {
      "comment": "the same check fails for a signature from any other workflow",
      "cmd": "cosign verify-blob step_linux_${V}_${ARCH}.tar.gz \\\n  --bundle step_linux_${V}_${ARCH}.tar.gz.sigstore.json \\\n  --certificate-identity https://github.com/attacker/fork/.github/workflows/release.yml@refs/heads/main \\\n  --certificate-oidc-issuer https://token.actions.githubusercontent.com 2>&1 | tail -1",
      "output": "error during command execution: none of the expected identities matched what was in the certificate, got subjects [https://github.com/smallstep/workflows/.github/workflows/goreleaser.yml@refs/heads/main] with issuer https://token.actions.githubusercontent.com"
    }
  ]
}
```

The identity flags are the important part. cosign refuses keyless verification without an expected identity and issuer, but a loose pattern (such as `--certificate-identity-regexp '.*'`) would accept a valid signature from anyone. Take the expected identity from a source you trust independently of the download, such as the project's release documentation; reading the certificate in the bundle only shows what the bundle claims. If a project does not document it, review the identity once on a release you trust, then pin it as above. The signing certificate in this bundle was valid for only ten minutes; the transparency log proves the signature was made during that window, which is why such short-lived certificates work.

### A GPG-Signed Checksum File

Many projects, including HashiCorp and the Linux distributions, sign the checksum file with a long-lived OpenPGP key. Here you check Terraform's `SHA256SUMS` file against HashiCorp's key. The fingerprint is the part you must compare out of band: HashiCorp publishes it on its [security page](https://www.hashicorp.com/en/trust/security). The commands reuse `$ARCH` from the previous block.

```terminal
{
  "title": "verify Terraform's checksum file with GPG",
  "prompt": "$",
  "steps": [
    {
      "comment": "a throwaway keyring for this lab",
      "cmd": "export GNUPGHOME=$(mktemp -d)"
    },
    {
      "cmd": "curl -sSfL https://www.hashicorp.com/.well-known/pgp-key.txt -o hashicorp.asc"
    },
    {
      "comment": "compare this fingerprint with the one on HashiCorp's security page",
      "cmd": "gpg --show-keys --with-fingerprint hashicorp.asc 2>/dev/null",
      "output": "pub   rsa4096 2021-04-19 [SC] [expires: 2030-03-01]\n      C874 011F 0AB4 0511 0D02  1055 3436 5D94 72D7 468F\nuid                      HashiCorp Security (hashicorp.com/security) <security@hashicorp.com>\nsub   rsa4096 2021-04-19 [E] [expires: 2030-03-01]\nsub   rsa4096 2021-04-19 [S] [expired: 2022-04-20]\nsub   rsa4096 2021-04-21 [S] [expires: 2030-03-01]"
    },
    {
      "cmd": "gpg --import hashicorp.asc 2>&1 | head -1",
      "output": "gpg: key 34365D9472D7468F: public key \"HashiCorp Security (hashicorp.com/security) <security@hashicorp.com>\" imported"
    },
    {
      "cmd": "TF=1.17.0"
    },
    {
      "cmd": "curl -sSfLO https://releases.hashicorp.com/terraform/${TF}/terraform_${TF}_SHA256SUMS"
    },
    {
      "cmd": "curl -sSfLO https://releases.hashicorp.com/terraform/${TF}/terraform_${TF}_SHA256SUMS.sig"
    },
    {
      "cmd": "gpg --verify terraform_${TF}_SHA256SUMS.sig terraform_${TF}_SHA256SUMS",
      "output": "gpg: Signature made Wed Oct 21 17:01:23 2026 UTC\ngpg:                using RSA key 374EC75B485913604A831CC7C820C6D5CD27AB87\ngpg: Good signature from \"HashiCorp Security (hashicorp.com/security) <security@hashicorp.com>\" [unknown]\ngpg: WARNING: This key is not certified with a trusted signature!\ngpg:          There is no indication that the signature belongs to the owner.\nPrimary key fingerprint: C874 011F 0AB4 0511 0D02  1055 3436 5D94 72D7 468F\n     Subkey fingerprint: 374E C75B 4859 1360 4A83  1CC7 C820 C6D5 CD27 AB87"
    },
    {
      "comment": "the signed checksum file now vouches for the zip",
      "cmd": "curl -sSfLO https://releases.hashicorp.com/terraform/${TF}/terraform_${TF}_linux_${ARCH}.zip"
    },
    {
      "cmd": "sha256sum -c --ignore-missing terraform_${TF}_SHA256SUMS",
      "output": "terraform_1.17.0_linux_arm64.zip: OK"
    },
    {
      "comment": "a single changed byte in the checksum file breaks the signature",
      "cmd": "cp terraform_${TF}_SHA256SUMS tampered_SHA256SUMS && sed -i '1s/^./0/' tampered_SHA256SUMS && gpg --verify terraform_${TF}_SHA256SUMS.sig tampered_SHA256SUMS 2>&1 | grep -i 'bad signature'",
      "output": "gpg: BAD signature from \"HashiCorp Security (hashicorp.com/security) <security@hashicorp.com>\" [unknown]"
    }
  ]
}
```

"Good signature" plus a matching fingerprint is the result you want. The warning that the key is not certified only means you have not signed HashiCorp's key in your own web of trust; you established trust by comparing the fingerprint instead. Only then does `sha256sum -c` mean something: the zip matches a checksum file that HashiCorp signed. The throwaway keyring lives in `$GNUPGHOME`; remove it with `rm -rf "$GNUPGHOME"` when you are done.

:::tip
In CI, pin the expected checksum or signer identity in the pipeline itself (or use a package manager that does, such as apt with signed repositories or `go.sum`), so a compromised download server cannot change both the file and its checksum.
:::

## Content Addressing: Git and Container Images

When a system names data by its hash, the name proves the content. Git and OCI registries both work this way.

### Git Object IDs

A Git object ID is the hash of a short header (`blob`, the size, a NUL byte) followed by the content. You can reproduce it with `sha1sum` and `sha256sum`:

```terminal
{
  "title": "a Git blob ID by hand",
  "prompt": "$",
  "steps": [
    {
      "cmd": "printf 'hello\\n' > greeting.txt"
    },
    {
      "cmd": "git hash-object greeting.txt",
      "output": "ce013625030ba8dba906f756967f9e9ca394464a"
    },
    {
      "cmd": "printf 'blob 6\\0hello\\n' | sha1sum",
      "output": "ce013625030ba8dba906f756967f9e9ca394464a  -"
    },
    {
      "comment": "the same file in a SHA-256 repository",
      "cmd": "git init -q --object-format=sha256 repo256 && git -C repo256 hash-object ../greeting.txt",
      "output": "2cf8d83d9ee29543b34a87727421fdecb7e3f3a183d337639025de576db9ebb4"
    },
    {
      "cmd": "printf 'blob 6\\0hello\\n' | sha256sum",
      "output": "2cf8d83d9ee29543b34a87727421fdecb7e3f3a183d337639025de576db9ebb4  -"
    }
  ]
}
```

Commits hash their tree, parents, author and message, so one commit ID pins the whole history behind it. New repositories still use SHA-1 by default, but Git has used a hardened SHA-1 that detects the known collision attacks since version 2.13 (2017). SHA-256 repositories work since Git 2.29, and Git 3.0 plans to make them the default (it has no release date yet). SHA-1 and SHA-256 repositories cannot exchange objects yet, and not every hosting service accepts SHA-256 repositories, so check yours before you switch.

### Container Image Digests

A registry names each manifest by the SHA-256 of its exact bytes. Tags such as `3.10` or `latest` are movable labels; a digest cannot change. Fetch a manifest list and hash it yourself:

```terminal
{
  "title": "an image digest is the hash of the manifest",
  "prompt": "$",
  "steps": [
    {
      "cmd": "curl -sSfL -D headers.txt -o pause-index.json -H 'Accept: application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json' https://registry.k8s.io/v2/pause/manifests/3.10"
    },
    {
      "cmd": "grep -i '^docker-content-digest' headers.txt",
      "output": "docker-content-digest: sha256:ee6521f290b2168b6e0935a181d4cff9be1ac3f505666ef0e3c98fae8199917a"
    },
    {
      "cmd": "sha256sum pause-index.json",
      "output": "ee6521f290b2168b6e0935a181d4cff9be1ac3f505666ef0e3c98fae8199917a  pause-index.json"
    }
  ]
}
```

The two values match. Reference images by digest in production manifests (`registry.k8s.io/pause@sha256:...`), and the image cannot be swapped behind the tag. Tools such as Renovate and Dependabot keep digest pins up to date.

## HMAC: Authenticating Messages

A plain hash proves nothing about who made a message: anyone can recompute it. An **HMAC** mixes a secret key into the hash, so only holders of the key can produce or check the tag. This is how GitHub, Stripe, Slack and most other services sign webhooks, how AWS Signature Version 4 signs API requests, and how many token formats (such as JWT with HS256) work.

GitHub sends `X-Hub-Signature-256: sha256=<hex HMAC-SHA256 of the body>`. Compute one with OpenSSL:

```terminal
{
  "title": "HMAC-SHA256 with OpenSSL",
  "prompt": "$",
  "steps": [
    {
      "cmd": "printf '{\"action\":\"opened\",\"number\":42}' > payload.json"
    },
    {
      "cmd": "openssl dgst -sha256 -hmac 'lab-webhook-secret' -r payload.json",
      "output": "cd2de3e1693a210374eb89a9ba1f8bb2089d36e82d3530fee466d0c54889a25e *payload.json"
    }
  ]
}
```

Then check it the way your webhook handler should. Save this as `verify_webhook.py` in `~/crypto-lab/part2`:

```python
import hashlib
import hmac

SECRET = b"lab-webhook-secret"  # in production, load it from your secrets manager

def sign(body: bytes) -> str:
    return "sha256=" + hmac.new(SECRET, body, hashlib.sha256).hexdigest()

def verify(body: bytes, header) -> bool:
    # reject a missing or malformed header instead of raising an error
    if not isinstance(header, str) or not header.isascii():
        return False
    # compare_digest takes the same time wherever the first difference is
    return hmac.compare_digest(sign(body), header)

body = open("payload.json", "rb").read()
header = sign(body)  # what the sender puts in X-Hub-Signature-256
print("header:      ", header)
print("valid body:  ", verify(body, header))
print("changed body:", verify(body.replace(b"42", b"43"), header))
forged = "sha256=" + hashlib.sha256(body).hexdigest()  # a plain hash, no secret
print("plain hash:  ", verify(body, forged))
```

```bash
python3 verify_webhook.py
```

```text
header:       sha256=cd2de3e1693a210374eb89a9ba1f8bb2089d36e82d3530fee466d0c54889a25e
valid body:   True
changed body: False
plain hash:   False
```

The hex digest matches the OpenSSL output. Three rules for webhook handlers:

1. **Compute the HMAC over the raw request body**, before any JSON parsing or re-serialization changes a byte.
2. **Compare with a constant-time function** (`hmac.compare_digest`, `crypto.timingSafeEqual` in Node.js, `hmac.Equal` in Go). A plain `==` can return early at the first different byte, and that timing leaks how much of a guess was right.
3. **Reject old messages.** An HMAC does not stop replays. Providers such as Stripe sign a timestamp together with the body; reject anything older than a few minutes and deduplicate by event ID.

Never build your own MAC as `sha256(secret + message)`: SHA-256 and SHA-512 allow length-extension attacks on that construction. HMAC exists to avoid exactly that.

## Password Storage

Never store passwords, and never store a fast hash of them. When a password database leaks, attackers guess passwords offline, as fast as their hardware allows. A **password hashing function** is deliberately slow and, for the best ones, memory-hard, so each guess costs real time and RAM, and a unique random salt per password stops attackers from cracking all accounts at once with precomputed tables.

Measure how many guesses per second this machine manages with each method. Save this as `guess_rate.py`:

```python
import hashlib
import os
import time

import bcrypt
from argon2 import PasswordHasher

password = b"correct horse battery staple"

def rate(fn, seconds=3.0):
    n, start = 0, time.perf_counter()
    while time.perf_counter() - start < seconds:
        fn()
        n += 1
    return n / (time.perf_counter() - start)

salt = os.urandom(16)
bcrypt_salt = bcrypt.gensalt(rounds=12)
argon2 = PasswordHasher()  # Argon2id, RFC 9106 low-memory profile: t=3, 64 MiB, p=4

print(f"salted SHA-256:     {rate(lambda: hashlib.sha256(salt + password).digest()):>12,.0f} guesses/s")
print(f"bcrypt (cost 12):   {rate(lambda: bcrypt.hashpw(password, bcrypt_salt)):>12,.1f} guesses/s")
print(f"Argon2id (default): {rate(lambda: argon2.hash(password)):>12,.1f} guesses/s")
```

```bash
python3 guess_rate.py
```

```text
salted SHA-256:          260,881 guesses/s
bcrypt (cost 12):            2.1 guesses/s
Argon2id (default):          3.9 guesses/s
```

The script hashes one guess at a time (Argon2id uses its default four lanes, which run as threads). Even so, this small board in Python tries about a quarter of a million salted SHA-256 guesses per second. Dedicated cracking tools on GPUs are many orders of magnitude faster, which is why leaked unsalted or fast-hashed passwords fall within hours. bcrypt and Argon2id cut that rate to a handful per second, and Argon2id's 64 MiB of memory per guess also limits how many guesses a GPU can run in parallel.

### Which Algorithm and Which Parameters

The [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) recommends, in order:

| Algorithm    | Minimum parameters (OWASP)          | Notes                                                                                                            |
| ------------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Argon2id** | 19 MiB memory, 2 iterations, 1 lane | First choice. Libraries often default higher (argon2-cffi: 64 MiB, t=3, p=4)                                     |
| **scrypt**   | N=2^17, r=8, p=1                    | When Argon2id is not available                                                                                   |
| **bcrypt**   | cost 10 or more                     | Legacy systems; 72-byte maximum (older libraries silently truncate, Python bcrypt 5.0+ rejects longer passwords) |
| **PBKDF2**   | 600,000 iterations with HMAC-SHA256 | When you need FIPS-140 validated algorithms                                                                      |

Tune the parameters so one hash takes a few hundred milliseconds on your servers at peak login load. Use a library that stores the algorithm, parameters and salt inside the hash string, as argon2-cffi, bcrypt and most frameworks' password hashers do, so you can raise the cost later and upgrade hashes as users log in. (Raw scrypt or PBKDF2 functions, such as Python's `hashlib.scrypt`, return only the derived bytes; then you must store the salt and parameters yourself.) Save this as `passwords.py`:

```python
import bcrypt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

ph = PasswordHasher()
stored = ph.hash("correct horse battery staple")
print("stored:", stored)

try:
    ph.verify(stored, "Tr0ub4dor&3")
except VerifyMismatchError:
    print("wrong password: VerifyMismatchError")

print("verified:", ph.verify(stored, "correct horse battery staple"))

# Later you raise the memory cost. Old hashes still verify, and you can
# re-hash them with the new parameters at the next successful login.
stronger = PasswordHasher(memory_cost=131072)  # 128 MiB
print("needs rehash:", stronger.check_needs_rehash(stored))

# bcrypt 5.0 refuses passwords longer than 72 bytes instead of silently cutting them
try:
    bcrypt.hashpw(b"x" * 73, bcrypt.gensalt())
except ValueError as e:
    print("bcrypt:", e)
```

```bash
python3 passwords.py
```

```text
stored: $argon2id$v=19$m=65536,t=3,p=4$0ZnV8rqKjIpEhkjy1/M17w$YZPzySdQ3l32F8LlItum4IxjwX6r5wy8f8+L1tICHMw
wrong password: VerifyMismatchError
verified: True
needs rehash: True
bcrypt: password cannot be longer than 72 bytes, truncate manually if necessary (e.g. my_password[:72])
```

The stored string records everything needed to verify it later: `argon2id`, version 19, 64 MiB of memory (`m=65536` KiB), 3 iterations, 4 lanes, then the salt and the hash. Older bcrypt versions truncated long passwords silently, so two long passwords with the same first 72 bytes matched each other; bcrypt 5.0 raises an error instead. If you must accept long passphrases with bcrypt, pre-hash them with HMAC-SHA256 and a server-side key, and encode the result as Base64 so it contains no NUL bytes.

Two more rules: rate-limit and monitor login attempts (slow hashing does not stop online guessing), and support passkeys or a second factor, so a cracked password alone is not enough.

## Common Mistakes

- **MD5 or SHA-1 for anything security-related**: signatures, certificate fingerprints, deduplication of untrusted uploads. Use SHA-256 or better.
- **Trusting a checksum from the same place as the download.** Verify a signature against an identity or key fingerprint you got elsewhere.
- **Pinning images by tag.** Tags move. Pin by digest and let a bot update the digests.
- **Plain hashes as authentication.** Use HMAC with a secret key, compare in constant time, and reject replays.
- **Fast hashes for passwords**, even salted. Use Argon2id, scrypt, bcrypt or PBKDF2 with current parameters.
- **Hashing guessable personal data and calling it anonymous.** A hash of an email address can be reversed by hashing candidates. Use a keyed HMAC (pseudonymization) or don't store it.

## Summary

- Hash functions give fixed-size, one-way fingerprints. Use SHA-256, SHA-512, SHA-3, BLAKE2 or BLAKE3, not MD5 or SHA-1.
- Checksums detect changes; signatures (GPG or Sigstore) prove who published a file. Check both, and pin the signer's identity.
- Git object IDs and container image digests are hashes of the content. Pin images by digest.
- HMAC authenticates messages with a shared secret. Compute it over the raw body, compare in constant time and reject replays.
- Store passwords with Argon2id (or scrypt, bcrypt, PBKDF2) and parameters you can raise over time.

Next, [Part 3](/guides/cryptography-essentials/03-tls-ssl) puts encryption and hashing together in TLS, the protocol behind HTTPS.

## Keep Learning

- [OWASP Top 10, A08: Software and Data Integrity Failures](/guides/owasp-top-10/08-software-integrity-failures)
- [OWASP Top 10, A07: Identification and Authentication Failures](/guides/owasp-top-10/07-authentication-failures)
- [What It Actually Takes to Deliver a Webhook in Production](/posts/reliable-webhook-delivery-retries-signatures-idempotency)
- [How Stripe Avoids Double-Charging Anyone](/posts/how-stripe-avoids-double-charging-idempotency-keys)
- [At Least One Invalid Signature Was Encountered](/posts/at-least-one-invalid-signature-was-encountered)
- [Docker Security Hardening Checklist](/checklists/docker-security)
