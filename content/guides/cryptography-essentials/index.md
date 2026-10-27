---
title: 'Cryptography Essentials'
seoTitle: 'Cryptography for DevOps Engineers: Encryption, Hashing, TLS and PKI'
description: 'Hands-on cryptography for DevOps engineers: AES-GCM and key management, hashes and signed releases, TLS 1.3 with post-quantum keys, and a private CA.'
category:
  name: 'Security'
  slug: 'security'
publishedAt: '2025-01-24'
updatedAt: '2026-10-27'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Security
  - DevSecOps
  - Cryptography
  - Encryption
  - TLS
  - PKI
  - OpenSSL
---

Every HTTPS endpoint, SSH session, signed container image, encrypted backup and password database you run depends on a handful of cryptographic building blocks. You rarely implement them, but you choose, configure and operate them every day: which key type to generate, which TLS versions to allow, how a secret gets into a pipeline, when a certificate expires and who notices. Most cryptography incidents in operations come from those choices, not from broken math.

This guide teaches those building blocks the practical way. There is no math. Instead, you run every example on your own machine with the standard tools (OpenSSL, OpenSSH, age, SOPS, GnuPG, step, cosign, nginx and a little Python) and see what correct use and common mistakes look like, with real output.

## What Changed Recently

If you learned this material a few years ago, these are the changes that matter for operations in late 2026:

- **Post-quantum key exchange is on by default.** OpenSSL 3.5+, OpenSSH 10+, Chrome, Firefox and Apple's systems use hybrid ML-KEM key agreement, and so does a large share of HTTPS traffic. NIST plans to retire RSA and elliptic-curve algorithms between 2030 and 2035.
- **OpenSSL 3.0 is out of upstream support** since September 2026. Use 3.5 (LTS until 2030) or newer, or a distribution that still patches 3.0.
- **Certificates are getting short-lived.** Public TLS certificates are limited to 200 days since March 2026 and to 47 days from 2029. Let's Encrypt moves to 64-day certificates in February 2027.
- **OCSP is ending** for public certificates; revocation relies on CRLs and short lifetimes.
- **Public TLS CAs are phasing out client certificates**, so mTLS needs a private CA.
- **The ingress-nginx controller was retired** in March 2026; TLS at the Kubernetes edge moves to the Gateway API.

## How the Parts Fit Together

```diagram
{
  "type": "graph",
  "columns": [
    [
      { "id": "enc", "label": "Encryption", "sub": "Part 1: confidentiality", "icon": "lock", "tone": "blue" },
      { "id": "hash", "label": "Hashing", "sub": "Part 2: integrity", "icon": "check", "tone": "green" }
    ],
    [{ "id": "tls", "label": "TLS", "sub": "Part 3: secure connections", "icon": "net", "tone": "violet" }],
    [{ "id": "pki", "label": "PKI", "sub": "Part 4: who to trust", "icon": "shield", "tone": "amber" }]
  ],
  "edges": [
    ["enc", "tls", "AEAD + key agreement"],
    ["hash", "tls", "HKDF, signatures"],
    ["tls", "pki", "certificates"]
  ]
}
```

TLS is built from the encryption and hashing primitives in Parts 1 and 2, and it relies on the certificates and trust chains from Part 4 to know who is on the other end.

## The Learning Path

1. **[Encryption: AES-GCM, Key Pairs and Post-Quantum Keys](/guides/cryptography-essentials/01-encryption)**: authenticated encryption and nonces, key types, hybrid encryption, age and SOPS for secrets, post-quantum ML-KEM, and key management with a KMS.
2. **[Hashing: Checksums, Signed Releases, HMAC and Passwords](/guides/cryptography-essentials/02-hashing)**: choosing hash functions, verifying releases with GPG and Sigstore, content addressing in Git and registries, webhook HMACs and password hashing.
3. **[TLS in Practice](/guides/cryptography-essentials/03-tls-ssl)**: the TLS 1.3 handshake, post-quantum key exchange on the wire, an nginx configuration tested with `openssl s_client` and testssl.sh, expiry monitoring, mTLS and Kubernetes.
4. **[PKI: Certificate Authorities, Trust Chains and a Private CA](/guides/cryptography-essentials/04-pki)**: real chains and cross-signing, trust stores, a private CA with name constraints, revocation, mTLS with nginx, the step CLI, and signed commits and images.

## Set Up the Lab

Everything runs locally, and no cloud account is needed. The outputs in the guide were recorded on Ubuntu 26.04 LTS in October 2026 with these versions:

| Tool                                        | Version in the guide        | Used in       |
| ------------------------------------------- | --------------------------- | ------------- |
| OpenSSL                                     | 3.5.5                       | All parts     |
| Python 3, cryptography, argon2-cffi, bcrypt | 3.14, 46.0.5, 25.1.0, 5.0.0 | Parts 1, 2, 3 |
| age, SOPS                                   | 1.3.2, 3.13.3               | Part 1        |
| GnuPG, Git, cosign                          | 2.4.8, 2.53.0, 3.1.4        | Parts 2, 4    |
| nginx, curl, OpenSSH                        | 1.28.3, 8.18.0, 10.2p1      | Parts 3, 4    |
| step CLI                                    | 0.31.0                      | Part 4        |

Use OpenSSL 3.5 or later: older versions lack the post-quantum algorithms used in Parts 1 and 3. Debian 13 works too, with two visible differences: its OpenSSH 10.0 does not print the post-quantum warning shown in Part 3, and its python3-bcrypt 4.2 silently truncates long passwords instead of raising the error shown in Part 2. Install the tools for your system:

```tabs
{
  "title": "Install the lab tools",
  "tabs": [
    {
      "label": "Ubuntu 26.04",
      "lang": "bash",
      "code": "sudo apt update\nsudo apt install -y openssl openssh-client gnupg git curl nginx xxd b3sum bsdextrautils bind9-host \\\n  python3-cryptography python3-argon2 python3-bcrypt\n# Optional, for one SSH step in Part 3 (installs and starts an SSH server):\n# sudo apt install -y openssh-server\n\n# age 1.3 (the packaged 1.2 has no post-quantum keys), SOPS, step and cosign from their releases.\n# Part 2 shows how to verify downloads like these.\nARCH=$(dpkg --print-architecture)   # amd64 or arm64\ncd \"$(mktemp -d)\"\ncurl -sSfLO https://github.com/FiloSottile/age/releases/download/v1.3.2/age-v1.3.2-linux-$ARCH.tar.gz\ncurl -sSfLO https://github.com/getsops/sops/releases/download/v3.13.3/sops_3.13.3_$ARCH.deb\ncurl -sSfLO https://github.com/smallstep/cli/releases/download/v0.31.0/step-cli_0.31.0-1_$ARCH.deb\ncurl -sSfLO https://github.com/sigstore/cosign/releases/download/v3.1.4/cosign_3.1.4_$ARCH.deb\nsudo tar -xzf age-v1.3.2-linux-$ARCH.tar.gz -C /usr/local/bin --strip-components=1 age/age age/age-keygen age/age-inspect\nsudo apt install -y ./sops_3.13.3_$ARCH.deb ./step-cli_0.31.0-1_$ARCH.deb ./cosign_3.1.4_$ARCH.deb"
    },
    {
      "label": "macOS",
      "lang": "bash",
      "code": "brew install openssl@3 curl age sops step cosign nginx b3sum gnupg coreutils gnu-sed\n\n# macOS ships LibreSSL as /usr/bin/openssl, a curl without OpenSSL, and BSD date and sed.\n# Put OpenSSL 3, curl and the GNU tools first in PATH for the lab commands:\nexport PATH=\"$(brew --prefix openssl@3)/bin:$(brew --prefix curl)/bin:$(brew --prefix coreutils)/libexec/gnubin:$(brew --prefix gnu-sed)/libexec/gnubin:$PATH\"\n\npython3 -m venv ~/crypto-lab/venv\nsource ~/crypto-lab/venv/bin/activate\npip install cryptography argon2-cffi bcrypt"
    },
    {
      "label": "Windows",
      "lang": "powershell",
      "code": "# Install WSL 2 with the current Ubuntu LTS, then follow the Ubuntu tab inside it\nwsl --install -d Ubuntu"
    }
  ]
}
```

Installing the nginx package also starts the distribution's nginx service on port 80; the lab does not use it and runs its own nginx as your user on port 8443. Each part works in its own directory under `~/crypto-lab`, so you can do the parts in any order. Use a test machine or VM for the steps that use `sudo`.

## Prerequisites

- Comfort with a Linux shell: files, pipes, environment variables.
- Basic HTTP and DNS: what a URL, a port and a hostname are.
- Some experience running services (containers, VMs or servers). The Kubernetes examples are short and optional.

No prior cryptography knowledge is needed.

## Who This Guide Is For

- DevOps, platform and SRE engineers who manage certificates, secrets and TLS endpoints.
- Developers who store passwords, verify webhooks or call APIs over TLS.
- Anyone preparing for security questions in DevOps interviews.

## Practice Hands-On

For the wider picture, the [Security Principles](/guides/security-principles) and [OWASP Top 10](/guides/owasp-top-10) guides pair well with this one.

Step through a full TLS handshake in the browser with the [SSL/TLS Handshake simulator](/games/ssl-tls-handshake), then test yourself with the [Network & Security Fundamentals Quiz](/quizzes/network-security-quiz) and the [Security Architecture interview questions](/interview-questions/senior/security-architecture).
