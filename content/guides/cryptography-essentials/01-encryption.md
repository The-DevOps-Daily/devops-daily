---
title: 'Encryption: AES-GCM, Key Pairs and Post-Quantum Keys'
description: 'Symmetric and asymmetric encryption for DevOps engineers: AES-GCM, nonces, key pairs, age and SOPS for secrets, post-quantum ML-KEM, and key management.'
order: 1
---

**TLDR**: Use authenticated encryption (AES-GCM or ChaCha20-Poly1305) for data, and never reuse a nonce with the same key. Public-key cryptography does not encrypt bulk data; it agrees on or wraps a random data key, which is called hybrid encryption. For files and secrets in Git, use age and SOPS instead of `openssl enc`. For keys that protect data for many years, start using post-quantum hybrid keys (ML-KEM-768 + X25519), which OpenSSL 3.5, OpenSSH 10 and age 1.3 already support. Keep keys in a KMS or secrets manager, and encrypt data keys with them (envelope encryption).

Encryption turns readable data (plaintext) into unreadable data (ciphertext) that only the holder of the right key can turn back. It protects **confidentiality**: a stolen disk, a leaked backup or a copied Git repository is useless without the key. Authenticated encryption, the kind you should use for data and messages, also protects **integrity**: if someone changes the ciphertext, decryption fails instead of returning modified data.

In this part you encrypt and tamper with data, see why one encryption mode leaks patterns, generate the key types you meet in production, and encrypt a secrets file with age and SOPS, first with classic keys and then with post-quantum keys.

## Prerequisites

- A Linux shell (or WSL, or macOS with Homebrew), with the tools from the [guide overview](/guides/cryptography-essentials#h2-set-up-the-lab): OpenSSL 3.5 or later, Python 3 with the `cryptography` package, age 1.3 or later and SOPS.
- About 30 minutes. Everything runs locally; no cloud account is needed.

The outputs below are real. They come from Ubuntu 26.04 LTS (OpenSSL 3.5.5, Python 3.14 with cryptography 46.0.5, age 1.3.2, SOPS 3.13.3). Keys, nonces and ciphertexts are random, so yours will differ.

Create a working directory for this part:

```terminal
{
  "title": "lab setup",
  "prompt": "$",
  "steps": [
    {
      "cmd": "mkdir -p ~/crypto-lab/part1 && cd ~/crypto-lab/part1"
    },
    {
      "cmd": "openssl version",
      "output": "OpenSSL 3.5.5 27 Jan 2026 (Library: OpenSSL 3.5.5 27 Jan 2026)"
    },
    {
      "cmd": "age --version",
      "output": "v1.3.2"
    }
  ]
}
```

## Symmetric Encryption

Symmetric encryption uses **one secret key** to encrypt and decrypt. It is fast, so it does almost all of the actual work: disk encryption, TLS records, database and backup encryption, and secrets files all use a symmetric cipher in the end.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Plaintext", "sub": "DB_PASSWORD=...", "icon": "box", "tone": "slate" },
    { "label": "AES-256-GCM", "sub": "key + unique nonce", "icon": "lock", "tone": "blue" },
    { "label": "Ciphertext + tag", "sub": "unreadable, tamper-evident", "icon": "shield", "tone": "green" },
    { "label": "Decrypt", "sub": "same key, same nonce", "icon": "lock", "tone": "blue" },
    { "label": "Plaintext", "sub": "or an error if modified", "icon": "check", "tone": "slate" }
  ]
}
```

The whole security rests on the key. Anyone who has it can read and forge every message encrypted with it, so the hard part of symmetric encryption is getting the key to the right places and nowhere else.

### Which Algorithms to Use

| Algorithm                    | Key size     | Status                                                                                                                                                   | Where you meet it                                          |
| ---------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **AES-256-GCM**              | 256 bits     | Recommended                                                                                                                                              | TLS, cloud KMS, SOPS, database and backup encryption       |
| **AES-128-GCM**              | 128 bits     | Recommended                                                                                                                                              | TLS (the most common TLS 1.3 cipher suite)                 |
| **ChaCha20-Poly1305**        | 256 bits     | Recommended                                                                                                                                              | TLS, SSH, WireGuard, age; fast on CPUs without AES support |
| **AES-CBC** (with HMAC)      | 128/256 bits | Legacy; only as encrypt-then-MAC                                                                                                                         | Older formats such as Fernet                               |
| **AES-ECB**                  | any          | Never use for data                                                                                                                                       | Leaks patterns (see below)                                 |
| **3DES, DES, RC4, Blowfish** | varies       | Broken or withdrawn: DES keys are too short, 3DES and Blowfish have 64-bit blocks, RC4 has biased output; NIST disallowed 3DES for encryption after 2023 | Legacy systems only, migrate away                          |

Full-disk encryption is the usual exception to the AEAD rule. Most configurations (LUKS by default, BitLocker, many cloud volumes) use AES-XTS, which keeps the sector size unchanged and hides the data but does not detect tampering. Authenticated disk encryption exists (for example dm-crypt with dm-integrity), but it needs extra space for the tags. XTS is fine against a stolen disk, not against someone who can modify the disk while you use it.

AES-128 is not "weak": 128-bit keys are out of reach for brute force. Many teams pick AES-256 because it keeps a larger margin against future attacks, including quantum computers, which roughly halve the effective strength of a symmetric key. NIST's post-quantum guidance treats AES-128 as still acceptable and AES-256 as the conservative choice.

### Why ECB Mode Leaks Patterns

AES encrypts one 16-byte block at a time. A **mode of operation** decides how blocks are chained. The simplest mode, ECB, encrypts every block on its own, so two identical plaintext blocks always produce two identical ciphertext blocks. You can see it with OpenSSL: the input below is the same 16-byte block twice.

```terminal
{
  "title": "ECB vs CBC on repeated blocks",
  "prompt": "$",
  "steps": [
    {
      "comment": "two identical 16-byte blocks",
      "cmd": "printf 'ATTACK AT DAWN!!ATTACK AT DAWN!!' > blocks.txt"
    },
    {
      "cmd": "KEY=$(openssl rand -hex 16)"
    },
    {
      "comment": "ECB: lines 1 and 2 are identical, the pattern survives",
      "cmd": "openssl enc -aes-128-ecb -K \"$KEY\" -in blocks.txt | xxd",
      "output": "00000000: 906b b080 c87c 49cb b448 163f 6331 a26a  .k...|I..H.?c1.j\n00000010: 906b b080 c87c 49cb b448 163f 6331 a26a  .k...|I..H.?c1.j\n00000020: 3b45 d145 0f9d 8b50 4f3d dda1 0c96 5af0  ;E.E...PO=....Z."
    },
    {
      "comment": "CBC with a random IV: every block differs",
      "cmd": "openssl enc -aes-128-cbc -K \"$KEY\" -iv \"$(openssl rand -hex 16)\" -in blocks.txt | xxd",
      "output": "00000000: 8d2c 9acb 1c8a d4e2 f08b 684c c13a 52a0  .,........hL.:R.\n00000010: c9f7 5257 f0de d432 7d98 363f 8e60 45d6  ..RW...2}.6?.`E.\n00000020: bc50 af27 d03f 5613 8467 d88e 598e 7747  .P.'.?V..g..Y.wG"
    }
  ]
}
```

The third line in each output is a padding block. With ECB, anyone can see which parts of a file repeat, without the key. That is enough to recognize images, table layouts or repeated fields. Never use ECB for data.

CBC hides the repetition but gives no integrity: an attacker can flip bits in the ciphertext, and the receiver decrypts modified data without noticing (and padding errors have enabled "padding oracle" attacks against CBC for years). That is why the modern answer is **authenticated encryption**.

### Authenticated Encryption (AEAD)

An **AEAD** cipher (Authenticated Encryption with Associated Data) encrypts the data and computes an authentication tag over it in one step. Decryption checks the tag first and refuses to return anything if the ciphertext, the tag or the **associated data** changed. Associated data is authenticated but not encrypted: use it to bind a ciphertext to its context, such as the record ID or the name of the secret, so nobody can copy a valid ciphertext into another field.

AES-GCM and ChaCha20-Poly1305 are the two AEAD ciphers you will meet everywhere. Here is AES-256-GCM with Python's `cryptography` package. Save it as `aead.py` in `~/crypto-lab/part1`:

```python
import os

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

key = AESGCM.generate_key(bit_length=256)  # 32 random bytes from the OS
aead = AESGCM(key)

plaintext = b"DB_PASSWORD=lab-only-value"
context = b"orders-api/prod/db-password"  # associated data: authenticated, not encrypted
nonce = os.urandom(12)  # 96-bit nonce, new for every encryption with this key

ciphertext = aead.encrypt(nonce, plaintext, context)
print(f"plaintext:  {len(plaintext)} bytes")
print(f"ciphertext: {len(ciphertext)} bytes (plaintext + 16-byte tag)")
print("decrypted: ", aead.decrypt(nonce, ciphertext, context).decode())

# Flip one bit in the ciphertext
tampered = bytearray(ciphertext)
tampered[0] ^= 0x01
try:
    aead.decrypt(nonce, bytes(tampered), context)
except InvalidTag:
    print("tampered ciphertext: InvalidTag, nothing decrypted")

# Same ciphertext, used in a different place
try:
    aead.decrypt(nonce, ciphertext, b"orders-api/dev/db-password")
except InvalidTag:
    print("wrong context:       InvalidTag, nothing decrypted")
```

```bash
python3 aead.py
```

```text
plaintext:  26 bytes
ciphertext: 42 bytes (plaintext + 16-byte tag)
decrypted:  DB_PASSWORD=lab-only-value
tampered ciphertext: InvalidTag, nothing decrypted
wrong context:       InvalidTag, nothing decrypted
```

The library generated the key with the operating system's secure random generator. To use ChaCha20-Poly1305 instead, import `ChaCha20Poly1305` from the same module and create the key with `ChaCha20Poly1305.generate_key()` (it takes no size argument, keys are always 256 bits); `encrypt` and `decrypt` work the same way.

:::tip
Most of the time you should not call AEAD primitives yourself. Use a format that handles keys, nonces and versioning for you: age for files, SOPS for config files, your cloud KMS or Vault's transit engine for application data, and TLS for data in transit.
:::

### Never Reuse a Nonce

The nonce ("number used once") does not need to be secret, but it must never repeat under the same key. GCM and ChaCha20 are stream ciphers inside: they turn the key and nonce into a keystream and XOR it with the data. Two messages encrypted with the same key and nonce share the keystream, and XORing the two ciphertexts cancels it. Save this as `nonce_reuse.py`:

```python
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

aead = AESGCM(AESGCM.generate_key(bit_length=256))
nonce = os.urandom(12)

known = b"status=ok;user=alice;role=read "  # something the attacker can guess
secret = b"token=9f1c2e77a1;role=admin    "  # same length, same key, SAME nonce (the bug)

c1 = aead.encrypt(nonce, known, None)[:-16]  # drop the tags
c2 = aead.encrypt(nonce, secret, None)[:-16]

# The attacker has c1, c2 and a guess for the first plaintext, but not the key:
recovered = bytes(a ^ b ^ k for a, b, k in zip(c1, c2, known))
print(recovered.decode())
```

```bash
python3 nonce_reuse.py
```

```text
token=9f1c2e77a1;role=admin
```

The second secret comes back without the key. With GCM, nonce reuse also leaks the authentication key, so the attacker can forge messages too. Random 96-bit nonces are safe for up to about 2^32 messages per key (NIST SP 800-38D); for higher volumes, rotate keys or use a library that manages nonces for you.

### AES or ChaCha20?

On CPUs with AES instructions (AES-NI on x86, the crypto extensions on most ARM server chips), AES-GCM is extremely fast. Without them, ChaCha20-Poly1305 is faster and safer from timing side channels, which is why phones, small devices and TLS clients without AES hardware prefer it. The Raspberry Pi 4 that produced these outputs has no AES instructions, so it shows the difference clearly:

```terminal
{
  "title": "openssl speed, 16 KB blocks, one core",
  "prompt": "$",
  "steps": [
    {
      "comment": "numbers are kB/s; run on a Raspberry Pi 4 (no AES instructions)",
      "cmd": "openssl speed -seconds 3 -bytes 16384 -evp aes-256-gcm 2>/dev/null | tail -1",
      "output": "AES-256-GCM      48782.39k"
    },
    {
      "cmd": "openssl speed -seconds 3 -bytes 16384 -evp chacha20-poly1305 2>/dev/null | tail -1",
      "output": "ChaCha20-Poly1305   267826.34k"
    }
  ]
}
```

ChaCha20-Poly1305 moved about 268 MB/s and AES-256-GCM about 49 MB/s: more than five times faster here. Run the same two commands on your laptop or a cloud VM with AES-NI and the order usually flips. TLS handles this choice for you: clients without AES hardware list ChaCha20 first, and a server that follows the client's order (the setting Mozilla recommends) picks it.

## Asymmetric Encryption

Asymmetric (public-key) cryptography uses a **key pair**: a public key you can hand to anyone and a private key that never leaves its owner. It gives you three operations:

- **Key agreement**: two parties end up with the same shared secret without ever sending it. With X25519 or ECDH, each side combines its private key with the other side's public key. With a key encapsulation mechanism (KEM) such as post-quantum ML-KEM, one side encapsulates a fresh secret to the other side's public key, and only the matching private key can decapsulate it. TLS and SSH do this for every connection.
- **Encryption to a public key**: anyone can encrypt to you; only you can decrypt (RSA-OAEP, or key agreement plus a symmetric cipher, as age does).
- **Signatures**: only the private key holder can sign; anyone with the public key can verify (Ed25519, ECDSA, RSA-PSS, and post-quantum ML-DSA).

### Common Key Types

| Algorithm               | Used for                                  | Strength                                    | Notes                                                        |
| ----------------------- | ----------------------------------------- | ------------------------------------------- | ------------------------------------------------------------ |
| **Ed25519**             | Signatures (SSH keys, Git, Sigstore, JWT) | about 128-bit                               | Small, fast, hard to misuse. The default choice for new keys |
| **X25519**              | Key agreement (TLS, SSH, WireGuard, age)  | about 128-bit                               | The Diffie-Hellman partner of Ed25519                        |
| **ECDSA P-256 / P-384** | Signatures (TLS certificates, cloud KMS)  | 128-bit / 192-bit                           | Widely supported in the Web PKI; needs good randomness       |
| **RSA 3072+**           | Signatures, encryption with OAEP          | RSA-2048 is about 112-bit, RSA-3072 128-bit | Large and slow; still the most compatible                    |
| **ML-KEM-768**          | Post-quantum key agreement                | NIST category 3                             | FIPS 203 (2024). Used in hybrid with X25519                  |
| **ML-DSA-65**           | Post-quantum signatures                   | NIST category 3                             | FIPS 204 (2024). Not yet used by public CAs                  |
| **DSA, RSA-1024**       | Nothing new                               | broken or too weak                          | OpenSSH 10.0 removed DSA                                     |

The strength column follows NIST SP 800-57: a "128-bit" algorithm takes about as much work to break as brute-forcing a 128-bit AES key. Generate one of each with OpenSSL and compare the public key sizes:

```terminal
{
  "title": "generate key pairs",
  "prompt": "$",
  "steps": [
    {
      "cmd": "openssl genpkey -quiet -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out rsa3072.key"
    },
    {
      "cmd": "openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out p256.key"
    },
    {
      "cmd": "openssl genpkey -algorithm ED25519 -out ed25519.key"
    },
    {
      "cmd": "openssl genpkey -algorithm X25519 -out x25519.key"
    },
    {
      "cmd": "openssl genpkey -algorithm ML-KEM-768 -out mlkem768.key"
    },
    {
      "comment": "size of each public key in bytes (DER encoded)",
      "cmd": "for k in rsa3072 p256 ed25519 x25519 mlkem768; do printf '%-9s %5s bytes\\n' \"$k\" \"$(openssl pkey -in $k.key -pubout -outform DER | wc -c)\"; done",
      "output": "rsa3072     422 bytes\np256         91 bytes\ned25519      44 bytes\nx25519       44 bytes\nmlkem768   1206 bytes"
    }
  ]
}
```

Elliptic-curve keys are tiny, RSA keys are large, and the post-quantum ML-KEM key is larger still. That size is the main cost of post-quantum cryptography: more bytes on the wire in every handshake.

### Signatures: Proving Who Wrote Something

A signature proves that the holder of a private key approved exactly these bytes. This is how package managers, container signing (Sigstore), Git commit signing and TLS certificates work. Sign a release note with the Ed25519 key, then change one character:

```terminal
{
  "title": "sign and verify with Ed25519",
  "prompt": "$",
  "steps": [
    {
      "cmd": "printf 'orders-api v2.4.0: rotate DB credentials\\n' > release.txt"
    },
    {
      "cmd": "openssl pkey -in ed25519.key -pubout -out ed25519.pub"
    },
    {
      "cmd": "openssl pkeyutl -sign -inkey ed25519.key -rawin -in release.txt -out release.sig"
    },
    {
      "cmd": "openssl pkeyutl -verify -pubin -inkey ed25519.pub -rawin -in release.txt -sigfile release.sig",
      "output": "Signature Verified Successfully"
    },
    {
      "comment": "change v2.4.0 to v2.4.1 and verify again",
      "cmd": "sed -i 's/v2.4.0/v2.4.1/' release.txt"
    },
    {
      "cmd": "openssl pkeyutl -verify -pubin -inkey ed25519.pub -rawin -in release.txt -sigfile release.sig",
      "output": "E0DC28AE7F000000:error:030000EA:digital envelope routines:EVP_DigestVerify:provider signature failure:../crypto/evp/m_sigver.c:779:ED25519 digest_verify:\nSignature Verification Failure"
    }
  ]
}
```

A signature does not hide anything: `release.txt` stays readable. Signing gives integrity and authenticity; encryption gives confidentiality. You often need both.

### Why Public-Key Encryption Does Not Encrypt Your Data

RSA can encrypt directly, but only a small amount: with a 3072-bit key and OAEP-SHA256 padding, the limit is 318 bytes. Try a 400-byte file:

```terminal
{
  "title": "RSA-OAEP size limit",
  "prompt": "$",
  "steps": [
    {
      "cmd": "openssl pkey -in rsa3072.key -pubout -out rsa3072.pub"
    },
    {
      "cmd": "head -c 400 /dev/urandom > payload.bin"
    },
    {
      "cmd": "openssl pkeyutl -encrypt -pubin -inkey rsa3072.pub -pkeyopt rsa_padding_mode:oaep -pkeyopt rsa_oaep_md:sha256 -in payload.bin -out payload.enc",
      "output": "Public Key operation error\nE02C67A27F000000:error:0200006E:rsa routines:ossl_rsa_padding_add_PKCS1_OAEP_mgf1_ex:data too large for key size:../crypto/rsa/rsa_oaep.c:99:"
    }
  ]
}
```

Public-key operations are also hundreds of times slower than AES. So every real system uses **hybrid encryption**: generate a random symmetric key, encrypt the data with an AEAD cipher, and use the public key only to protect that small random key.

```diagram
{
  "type": "graph",
  "columns": [
    [
      { "id": "file", "label": "Your file", "icon": "box", "tone": "slate" },
      { "id": "fk", "label": "Random file key", "sub": "128 bits, new per file", "icon": "lock", "tone": "amber" }
    ],
    [
      { "id": "payload", "label": "Payload", "sub": "ChaCha20-Poly1305, key derived from the file key", "icon": "shield", "tone": "blue" },
      { "id": "stanza", "label": "Header stanza", "sub": "file key wrapped to the recipient's public key", "icon": "lock", "tone": "violet" }
    ],
    [
      { "id": "age", "label": "Encrypted .age file", "sub": "header + payload", "icon": "check", "tone": "green" }
    ]
  ],
  "edges": [
    ["file", "payload", "encrypt"],
    ["fk", "payload", "HKDF"],
    ["fk", "stanza", "wrap"],
    ["payload", "age"],
    ["stanza", "age"]
  ]
}
```

TLS, SSH, PGP, age and cloud KMS envelope encryption all follow this pattern. The only difference is how the small key reaches the other side: wrapped to a public key (age, PGP), agreed through a key exchange (TLS, SSH), or wrapped by a key that never leaves a KMS.

## Encrypting Files with age

[age](https://age-encryption.org) is a small, modern file encryption tool with no configuration and no algorithm choices to get wrong. It uses X25519 to wrap a random file key and ChaCha20-Poly1305 for the data. Encrypt a secrets file to a key pair:

```terminal
{
  "title": "age with an X25519 key",
  "prompt": "$",
  "steps": [
    {
      "comment": "the identity (private key) file; the public key goes to stderr",
      "cmd": "age-keygen -o orders.key",
      "output": "Public key: age1ypyrzauemt90hd5dm83jcmdhka73xccjzqnw0je6kh5ee3t4pqtsyryapy"
    },
    {
      "cmd": "printf 'DB_PASSWORD=lab-only-value\\n' > db.env"
    },
    {
      "cmd": "age -r \"$(age-keygen -y orders.key)\" -o db.env.age db.env"
    },
    {
      "cmd": "age-inspect db.env.age",
      "output": "db.env.age is an age file, version \"age-encryption.org/v1\".\n\nThis file is encrypted to the following recipient types:\n  - \"X25519\"\n\nThis file does NOT use post-quantum encryption.\n\nSize breakdown (assuming it decrypts successfully):\n\n    Header                       168 bytes\n    Encryption overhead           32 bytes\n    Payload                       27 bytes\n                        -------------------\n    Total                        227 bytes\n\nTip: for machine-readable output, use --json."
    },
    {
      "cmd": "age -d -i orders.key db.env.age",
      "output": "DB_PASSWORD=lab-only-value"
    }
  ]
}
```

`age-inspect` (new in age 1.3) shows the structure: a header with one stanza per recipient, holding the wrapped file key, and the encrypted payload. Add more `-r` flags to encrypt one file to several people or machines; each gets its own stanza. age can also encrypt to existing SSH keys (`age -R ~/.ssh/id_ed25519.pub`), which is handy for sending a secret to a teammate.

## Post-Quantum Encryption

A large quantum computer could break RSA, ECDH, X25519 and ECDSA. None exists today, but encrypted traffic and files can be recorded now and decrypted later ("harvest now, decrypt later"). For data that must stay secret for many years, that risk is already real.

NIST published the first post-quantum standards in August 2024: **ML-KEM** (FIPS 203) for key agreement, and **ML-DSA** (FIPS 204) and **SLH-DSA** (FIPS 205) for signatures. Its transition plan, [NIST IR 8547](https://csrc.nist.gov/pubs/ir/8547/final), deprecates RSA, ECDSA, EdDSA and (EC)DH after 2030 and disallows them after 2035, at every key size.

Deployments use **hybrid** key agreement: X25519 and ML-KEM-768 together, so the result is safe as long as either one holds. Key agreement moved first because it protects against recording today, while signatures only need to resist forgery at the time they are checked. The status in October 2026:

| Where                  | Post-quantum key agreement                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **TLS**                | `X25519MLKEM768` (RFC 10024) is the default first choice in OpenSSL 3.5+, Chrome 131+, Firefox 132+ and Apple's 26 releases (Part 3) |
| **SSH**                | `mlkem768x25519-sha256` is the default in OpenSSH 10.0+ (Part 3)                                                                     |
| **Files**              | age 1.3+ with `age-keygen -pq` (below)                                                                                               |
| **Certificates (PKI)** | Still RSA and ECDSA; ML-DSA certificates are not yet issued by public CAs (Part 4)                                                   |

Try a post-quantum age key. The public key is long, so the command prints its length instead:

```terminal
{
  "title": "age with a post-quantum hybrid key",
  "prompt": "$",
  "steps": [
    {
      "cmd": "age-keygen -pq -o orders-pq.key 2>/dev/null"
    },
    {
      "comment": "characters in the public key (an X25519 key has 62)",
      "cmd": "age-keygen -y orders-pq.key | tr -d '\\n' | wc -c",
      "output": "1959"
    },
    {
      "cmd": "age -r \"$(age-keygen -y orders-pq.key)\" -o db.env.pq.age db.env"
    },
    {
      "cmd": "age-inspect db.env.pq.age",
      "output": "db.env.pq.age is an age file, version \"age-encryption.org/v1\".\n\nThis file is encrypted to the following recipient types:\n  - \"mlkem768x25519\"\n\nThis file uses post-quantum encryption.\n\nSize breakdown (assuming it decrypts successfully):\n\n    Header                      1627 bytes\n    Encryption overhead           32 bytes\n    Payload                       27 bytes\n                        -------------------\n    Total                       1686 bytes\n\nTip: for machine-readable output, use --json."
    },
    {
      "cmd": "age -d -i orders-pq.key db.env.pq.age",
      "output": "DB_PASSWORD=lab-only-value"
    }
  ]
}
```

The header grows from 168 to 1,627 bytes and the public key from 62 to 1,959 characters, and that is the whole cost. age refuses to mix post-quantum and classic recipients in one file ("can't mix post-quantum and classic recipients"), because the file would only be as strong as its weakest stanza. Ubuntu 26.04 still packages age 1.2.1, which has no `-pq` flag; get 1.3 or later from the [age releases page](https://github.com/FiloSottile/age/releases).

## Keeping Secrets in Git with SOPS

[SOPS](https://getsops.io) encrypts the **values** in YAML, JSON, ENV and INI files and leaves the keys readable, so diffs and code review still work. It encrypts each value with AES-256-GCM under one data key, and wraps that data key for each recipient: age keys, PGP keys, or cloud KMS keys. A `.sops.yaml` file in the repository says which recipients apply to which paths.

```terminal
{
  "title": "SOPS with an age recipient",
  "prompt": "$",
  "steps": [
    {
      "comment": "rule: every file under secrets/ is encrypted to the post-quantum age key",
      "cmd": "cat > .sops.yaml <<EOF\ncreation_rules:\n  - path_regex: ^secrets/.*\\.yaml$\n    age: $(age-keygen -y orders-pq.key)\nEOF"
    },
    {
      "cmd": "mkdir -p secrets && printf 'database:\\n  user: orders\\n  password: lab-only-value\\n' > secrets/orders.yaml"
    },
    {
      "cmd": "sops encrypt -i secrets/orders.yaml"
    },
    {
      "comment": "values are encrypted, keys stay readable",
      "cmd": "head -n 4 secrets/orders.yaml",
      "output": "database:\n    user: ENC[AES256_GCM,data:fjhEpIup,iv:AIYaQ1FTDMmLJ79jj6L3zRQSNmKSlUF71yCp5z4ptLc=,tag:6jk7taj3yyw7JnnqxjLGOg==,type:str]\n    password: ENC[AES256_GCM,data:SNGgtTXe+TlhrOVJY4Q=,iv:jpjdfG4OZLTx2xVhQwXT67IP0a4cgw4DGF3Xj5ACEj8=,tag:96Yq8wbDqlZ6XgfFIK6urA==,type:str]\nsops:"
    },
    {
      "comment": "the metadata records the recipients and a MAC over all values",
      "cmd": "grep -E '^\\s+(lastmodified|mac|version):' secrets/orders.yaml",
      "output": "    lastmodified: \"2026-10-27T15:23:56Z\"\n    mac: ENC[AES256_GCM,data:4zeIfKbhsYU/mSr7lnHjTJAjsA1qPRJHn0TArXDgCtkZGkPLUE5Et52yxlGkpwKkZyC46A3Z5flfCCDKBm89oE9uevk9J0Egk33OqCvYCyByDyTd7V7uqtiWodz+LRRHSdX680bkFL8+mCLAxhkUpGytiF+fH5lD13H4UDWPxCA=,iv:RCMgwbB7Ud7akVHnTHocamTB4E/hCZYg43aF4dP5/6E=,tag:7YwbBPc52SVgOIgYBeRWaQ==,type:str]\n    version: 3.13.3"
    },
    {
      "cmd": "SOPS_AGE_KEY_FILE=orders-pq.key sops decrypt secrets/orders.yaml",
      "output": "database:\n    user: orders\n    password: lab-only-value"
    }
  ]
}
```

Each value has its own IV and tag, bound to its key path, and the `mac` covers all values in the file, so nobody can move an encrypted value to another key or change one without SOPS noticing. SOPS does not stop someone from replacing the whole file with another valid one, such as an older version; control which file gets deployed through review and your pipeline. In a team, add one age recipient per person and one per deployment environment (or a KMS key), commit the encrypted file, and give the private key only to the people and pipelines that need it. The [Vault and SOPS exercise](/exercises/infrastructure-security-vault-sops) walks through a full setup.

## Key Management

Encryption moves the problem from protecting data to protecting keys. Most real incidents are key management failures, not broken algorithms.

### Envelope Encryption with a KMS

Cloud KMS services (AWS KMS, Google Cloud KMS, Azure Key Vault) and HashiCorp Vault keep the **key-encryption key** (KEK) inside hardware or a service you cannot export it from. Your application uses a **data key** (DEK) to encrypt its data locally, and stores the DEK only in wrapped form next to the data. It either generates the DEK itself and asks the KMS to wrap it (the documented pattern on Google Cloud and Azure), or, on AWS, calls `GenerateDataKey` to get the plaintext and the wrapped form in one request. To decrypt, it sends the wrapped DEK to the KMS, which checks IAM permissions, logs the request and returns the plaintext DEK.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Get a data key", "sub": "generate and wrap, or GenerateDataKey", "icon": "cloud", "tone": "violet" },
    { "label": "Encrypt locally", "sub": "AES-256-GCM with the DEK", "icon": "lock", "tone": "blue" },
    { "label": "Discard plaintext DEK", "sub": "keep only the wrapped copy", "icon": "shield", "tone": "amber" },
    { "label": "Store together", "sub": "ciphertext + wrapped DEK", "icon": "database", "tone": "green" }
  ]
}
```

This keeps the KMS out of the data path (it only handles 32-byte keys), logs every request to wrap or unwrap a data key, and gives you a kill switch: disable the KEK and nobody can unwrap a stored DEK any more. Data keys an application already holds in memory or in a cache stay usable until it drops them, so keep that caching short. Cloud KMS keys cannot be exported; configure Vault transit keys the same way (non-exportable). With AWS, for example (an example command, not run here):

```bash
aws kms generate-data-key --key-id alias/orders-api --key-spec AES_256
```

The two fields that matter in the response (the CLI prints both Base64-encoded) are `Plaintext`, the data key, which the application uses in memory and never writes or logs, and `CiphertextBlob`, the wrapped copy it stores next to the data. SOPS, Vault's transit engine and most database and storage encryption features in the cloud use this pattern for you.

### Rules That Prevent Most Incidents

1. **Generate keys with a secure random generator.** Use `os.urandom` or the `secrets` module in Python, `crypto/rand` in Go, `openssl rand` in shell, or the library's own key generator. Never `random`, timestamps or hashes of hostnames.
2. **Never hardcode keys** in source code, container images or CI configuration. Load them at runtime from a secrets manager or KMS, and scan repositories and images for leaks.
3. **Derive keys from passwords only with a password KDF** (Argon2id, scrypt, or PBKDF2 with a high iteration count). [Part 2](/guides/cryptography-essentials/02-hashing) explains why and shows the parameters.
4. **One key per purpose and environment.** Production and staging must not share keys, and an encryption key should not also be a signing key.
5. **Rotate, and know what rotation does.** Cloud KMS keys can rotate automatically (AWS KMS rotates customer managed keys yearly by default when you enable it, and lets you pick 90 to 2,560 days). Rotation changes the key material used for new encryption and keeps the old versions so existing data still decrypts; it limits how much data one key version protects. It is not the response to a leak. If a data key is exposed, generate a new one and re-encrypt the data; rewrapping the same data key under a new KEK only helps while the data keys themselves stayed secret. If a KEK is exposed, assume the data keys it wrapped are too. Either way, copies that were already stolen stay readable, which is why access to keys matters more than rotation.
6. **Restrict and log key use.** Decrypt permission is the real secret. Grant it per service, and alert on unusual decrypt volume.

### Encryption at Rest in Kubernetes

Kubernetes stores Secrets in etcd unencrypted (base64 is an encoding, not encryption) unless you configure encryption at rest. Managed services usually encrypt the disks, but that does not protect a Secret from anyone who can read etcd or its backups. Use the KMS v2 provider (stable since Kubernetes 1.29), which applies the same envelope pattern with an external KMS plugin:

```yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
  - resources:
      - secrets
    providers:
      - kms:
          apiVersion: v2
          name: cloud-kms
          endpoint: unix:///var/run/kms-plugin/socket.sock
          timeout: 3s
      - identity: {} # read Secrets that were stored before encryption was enabled
```

Pass the file to the API server with `--encryption-provider-config`. Managed Kubernetes services expose the same feature as a setting (envelope encryption with a cloud KMS key). After enabling it, rewrite existing Secrets so they are stored encrypted: `kubectl get secrets -A -o json | kubectl replace -f -`.

## Common Mistakes

- **Encrypting without authentication.** AES-CBC or AES-CTR on their own let attackers modify data unnoticed. Use AES-GCM or ChaCha20-Poly1305.
- **Reusing a nonce.** It leaks plaintext, as shown above, and with GCM it lets attackers forge messages. Use random 96-bit nonces and rotate keys long before 2^32 messages.
- **Using `openssl enc` for files.** It has no authentication and no AEAD support (`openssl enc -aes-256-gcm` fails with "AEAD ciphers not supported"), and its password mode is easy to misconfigure. Use age.
- **Encrypting bulk data with RSA.** It is limited to a few hundred bytes and slow. Use hybrid encryption, as every standard format does.
- **Choosing exotic or legacy algorithms.** Stick to AES-GCM, ChaCha20-Poly1305, X25519, Ed25519, ECDSA P-256, RSA 3072+ and, for long-lived secrets, ML-KEM hybrids.
- **Committing plaintext secrets "temporarily".** Git history keeps them. Encrypt with SOPS from the first commit, and rotate any secret that was ever pushed in plaintext.

## Summary

- Symmetric AEAD ciphers (AES-GCM, ChaCha20-Poly1305) encrypt the data and detect tampering. Use associated data to bind ciphertext to its context.
- Never reuse a nonce with the same key, and never use ECB.
- Public-key cryptography agrees on, wraps or signs small values. Real systems combine it with symmetric encryption (hybrid encryption).
- Prefer Ed25519 and X25519 for new keys, ECDSA P-256 or RSA 3072+ where compatibility needs them, and ML-KEM hybrids for long-lived secrets.
- Use age for files and SOPS for secrets in Git; both support post-quantum recipients today.
- Keep key-encryption keys in a KMS or Vault, encrypt data with data keys, and restrict and log who can decrypt.

Next, [Part 2](/guides/cryptography-essentials/02-hashing) covers hashing: checksums, signed releases, content addressing, HMAC webhooks and password storage.

## Keep Learning

- [OWASP Top 10, A02: Cryptographic Failures](/guides/owasp-top-10/02-cryptographic-failures)
- [Secrets Management Guide: Vault, AWS Secrets Manager, and Azure Key Vault](/posts/secrets-management-guide)
- [Secrets Management Best Practices with HashiCorp Vault](/posts/hashicorp-vault-secrets-management-best-practices)
- [You Cannot Rotate a Secret You Cannot Find](/posts/you-cannot-rotate-a-secret-you-cannot-find)
- [Exercise: Infrastructure Security with Vault and SOPS](/exercises/infrastructure-security-vault-sops)
- [Interview questions: Secrets Management](/interview-questions/mid/secrets-management)
