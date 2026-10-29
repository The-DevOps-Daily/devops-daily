---
title: 'A04:2025 Cryptographic Failures'
description: 'A04:2025 Cryptographic Failures: Argon2id password hashing, AES-GCM with key rotation, secure randomness and TLS with post-quantum key exchange in Node.js.'
order: 5
---

**TLDR**: Cryptographic failures are missing, weak or misused cryptography: passwords stored with a fast hash, data encrypted without integrity protection, keys in source code, tokens from a predictable random number generator, or traffic without TLS. Hash passwords with Argon2id, encrypt sensitive data with an authenticated cipher such as AES-256-GCM and keys from a key management service, use the cryptographically secure random generator for anything secret, and require TLS 1.2 or later everywhere. Start planning for post-quantum cryptography now; your TLS library may already use it.

Cryptographic Failures moved from second place in 2021 to fourth in 2025. The [A04:2025 page](https://owasp.org/Top10/2025/A04_2025-Cryptographic_Failures/) maps 32 CWEs to it, and three of the most common involve weak random numbers. It also adds a new deadline: prepare for post-quantum cryptography so that high-risk systems are safe by the end of 2030.

The usual advice applies first: do not write your own cryptographic algorithms or protocols. Use the primitives of a well-maintained library (here Node.js's built-in `crypto` module, which uses OpenSSL) in the standard ways shown below.

## Prerequisites

- The companion app from the [guide introduction](/guides/owasp-top-10#h2-the-companion-app), on Node.js 24.7 or later.
- The basics of hashing and symmetric encryption. The [Cryptography Essentials guide](/guides/cryptography-essentials) explains them.

## What Goes Wrong

The OWASP description is a checklist. You have a cryptographic failure if:

- data moves in clear text (HTTP, FTP, SMTP without TLS), or TLS certificates are not validated;
- old algorithms are in use: MD5, SHA-1, DES, RC4, ECB mode, or RSA with PKCS#1 v1.5 padding;
- passwords are stored in plain text, encrypted, or hashed with a fast hash;
- keys are hard-coded, reused across environments, checked into Git, or never rotated;
- initialization vectors (IVs) or nonces are reused or predictable;
- encryption is used without integrity protection where data could be changed;
- secrets come from a random generator that was not designed for security.

## Passwords: Hash With a Slow Function

A password database leaks eventually, through a backup, a log, an injection bug. What the attacker can do with it depends on how the passwords were stored:

- **Plain text or encrypted**: every password is exposed (the encryption key usually leaks with the database).
- **A fast hash such as SHA-256**: precomputed tables crack common passwords instantly, and a salt only forces the attacker to guess each user's password separately. Fast hashes are designed for speed, and a GPU computes billions of them per second.
- **A password hashing function** such as Argon2id is slow and memory-hard on purpose, so each guess is expensive, and the memory cost limits how many guesses a GPU can run in parallel.

The difference on one CPU core of a small ARM board, measured with a script from the companion repository:

```terminal
{
  "title": "the cost of one guess",
  "prompt": "$",
  "steps": [
    {
      "cmd": "node scripts/hash-cost.mjs",
      "output": "SHA-256:     69,561 guesses per second\nArgon2id:         9 guesses per second (19 MiB, t=2, p=1)"
    }
  ]
}
```

A server pays that cost once per login, which is acceptable. An attacker pays it for every guess.

The [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) recommends, in order:

1. **Argon2id** with at least 19 MiB of memory, 2 iterations and 1 degree of parallelism.
2. **scrypt** with N=2^17, r=8, p=1, if Argon2id is not available.
3. **PBKDF2-HMAC-SHA256** with 600,000 iterations, when you need FIPS-140 validated algorithms.
4. **bcrypt** only in legacy systems, with a work factor of 10 or more. It ignores everything after 72 bytes of input.

Node.js 24.7 added Argon2 to the built-in `crypto` module (stable since 24.19), so the companion app needs no native add-on:

```javascript
import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const argon2Async = promisify(argon2);

// OWASP Password Storage Cheat Sheet minimum for Argon2id:
// 19 MiB of memory, 2 iterations, 1 degree of parallelism.
const PARAMS = { memory: 19456, passes: 2, parallelism: 1, tagLength: 32 };

const b64 = (buf) => buf.toString('base64').replace(/=+$/, '');

// Returns a PHC-format string: algorithm, version, parameters, salt and hash.
export async function hashPassword(password) {
  const nonce = randomBytes(16);
  const hash = await argon2Async('argon2id', { message: password, nonce, ...PARAMS });
  const { memory: m, passes: t, parallelism: p } = PARAMS;
  return `$argon2id$v=19$m=${m},t=${t},p=${p}$${b64(nonce)}$${b64(hash)}`;
}

export async function verifyPassword(password, phc) {
  try {
    const [, alg, , params, salt, expected] = phc.split('$');
    if (alg !== 'argon2id') return false;
    const p = Object.fromEntries(params.split(',').map((kv) => kv.split('=')));
    const want = Buffer.from(expected, 'base64');
    const got = await argon2Async('argon2id', {
      message: password,
      nonce: Buffer.from(salt, 'base64'),
      memory: Number(p.m),
      passes: Number(p.t),
      parallelism: Number(p.p),
      tagLength: want.length,
    });
    return timingSafeEqual(got, want);
  } catch {
    return false; // a malformed hash never verifies
  }
}

// Used when the user does not exist, so a failed login costs the same time either way.
export const DUMMY_HASH = await hashPassword(randomBytes(32).toString('hex'));
```

The stored string records the algorithm, version, parameters and salt next to the hash, so you can raise the parameters later: verify with the stored parameters, and when a user logs in successfully with an old hash, rehash the password with the new ones. Each call produces a different string, because the salt is random:

```terminal
{
  "title": "two hashes of the same password",
  "prompt": "$",
  "steps": [
    {
      "cmd": "node --input-type=module -e \"import { hashPassword } from './src/passwords.js'; for (let i = 0; i < 2; i++) console.log(await hashPassword('correct horse battery staple'));\"",
      "output": "$argon2id$v=19$m=19456,t=2,p=1$KJETjAwY7g9vWLWF3Us8MA$xyxYQ+Hx9R1qhUjYF18MCwzyRGd2Yj7mlBtBgfi8NuU\n$argon2id$v=19$m=19456,t=2,p=1$1r5QtehTxDDcC3iIp51JaQ$XqjawPy+wbIYa3IJDgpLrL7asJSP/xXkNVfMa/Mw/9c"
    }
  ]
}
```

## Encrypt Data With Authenticated Encryption

Some data must be readable again: an API key you call on the user's behalf, a bank account number for payouts. Encrypt it with an authenticated cipher. AES-256-GCM encrypts and also produces an authentication tag, so any change to the ciphertext makes decryption fail instead of returning altered data.

Older Node.js code used `crypto.createCipher('aes-256-cbc', password)`, which derived the key with MD5 and no salt and reused a fixed IV. Node.js 22 removed it:

```terminal
{
  "title": "createCipher is gone",
  "prompt": "$",
  "steps": [
    {
      "cmd": "node -p \"typeof require('node:crypto').createCipher\"",
      "output": "undefined"
    }
  ]
}
```

The companion app's `crypto-box.js` shows the current pattern, with key versions for rotation and additional authenticated data (AAD) that binds each ciphertext to its record:

```javascript
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// keys: { v1: <32-byte Buffer>, v2: ... } loaded from a secrets manager or KMS,
// never from source code. New data always uses the current key.
export function createBox({ keys, current }) {
  for (const [version, key] of Object.entries(keys)) {
    if (!/^v\d+$/.test(version)) throw new Error(`bad key version ${version}`);
    if (!Buffer.isBuffer(key) || key.length !== 32) {
      throw new Error(`key ${version} must be 32 bytes`);
    }
  }
  if (!keys[current]) throw new Error(`no key for current version ${current}`);

  // context binds the ciphertext to one record (for example "invoice:1001"),
  // so a ciphertext copied to another row fails to decrypt.
  function seal(plaintext, context) {
    const iv = randomBytes(12); // 96-bit nonce, new for every message
    const cipher = createCipheriv('aes-256-gcm', keys[current], iv);
    cipher.setAAD(Buffer.from(context));
    const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [current, iv, tag, data]
      .map((p) => (Buffer.isBuffer(p) ? p.toString('base64url') : p))
      .join('.');
  }

  function open(sealed, context) {
    const [version, iv, tag, data] = sealed.split('.');
    const key = Object.hasOwn(keys, version) ? keys[version] : undefined;
    if (!key) throw new Error(`unknown key version ${version}`);
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'), {
      authTagLength: 16,
    });
    decipher.setAAD(Buffer.from(context));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(data, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  return { seal, open, needsRotation: (sealed) => !sealed.startsWith(`${current}.`) };
}
```

The rules it follows:

- **A new random 12-byte nonce for every message.** Reusing a nonce with the same key breaks GCM's confidentiality and integrity. With random nonces, stay well below 2^32 messages per key, then rotate.
- **The key version travels with the ciphertext**, so old data stays readable after a new key becomes current, and a background job can re-encrypt it (`needsRotation` finds it).
- **The context is authenticated but not encrypted.** A ciphertext copied from invoice 1001 to invoice 1002 fails to decrypt, so an attacker with database write access cannot swap encrypted values between rows.

The tests check those properties:

```terminal
{
  "title": "the cryptography tests",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "npm test -- tests/crypto.test.js",
      "output": "> owasp-top-10-demo@1.0.0 test\n> node --test --test-reporter=spec tests/crypto.test.js\n\n▶ A04 cryptographic failures\n  ✔ round-trips a value with AES-256-GCM (6.202585ms)\n  ✔ detects a changed ciphertext (3.405066ms)\n  ✔ refuses a ciphertext copied to another record (5.008804ms)\n  ✔ opens data sealed with the previous key and flags it for rotation (1.563276ms)\n  ✔ hashes passwords with Argon2id and a random salt (480.617325ms)\n✔ A04 cryptographic failures (503.86296ms)\nℹ tests 5\nℹ suites 1\nℹ pass 5\nℹ fail 0\nℹ cancelled 0\nℹ skipped 0\nℹ todo 0\nℹ duration_ms 899.435714"
    }
  ]
}
```

## Keys Belong in a Key Service

The strongest cipher is useless if the key sits in the repository next to the data. Keep keys in a key management service (AWS KMS, Google Cloud KMS, Azure Key Vault) or a secrets manager such as HashiCorp Vault, and use **envelope encryption** for large amounts of data: the service holds a key-encryption key that never leaves it, and you store each data key only in encrypted form, next to the data it protects. Rotating the key-encryption key does not require re-encrypting the data.

- Use a different key per environment, and never copy production keys to development.
- Give each service access only to the keys it needs, and log every use.
- Scan commits for secrets before they are pushed; [Pre-commit Hooks for Security](/posts/pre-commit-hooks-security-guide) shows how.
- OWASP recommends hardware security modules (HSMs) or cloud HSM-backed keys for the most sensitive keys.

## Randomness for Secrets

Session IDs, reset tokens, API keys and nonces must be unpredictable. `Math.random()` is not designed for that: its output can be predicted from earlier values.

```javascript
// VULNERABLE: predictable reset token
const resetToken = Math.random().toString(36).slice(2);
```

Use the cryptographically secure generator, which the operating system seeds:

```javascript
import { randomBytes, randomInt, randomUUID } from 'node:crypto';

const resetToken = randomBytes(32).toString('base64url'); // 256 bits
const sessionId = randomUUID(); // random (version 4) UUID
const otp = randomInt(0, 1_000_000).toString().padStart(6, '0'); // uniform, no modulo bias
```

In browsers, the same functions are `crypto.getRandomValues()` and `crypto.randomUUID()`.

## Data in Transit

Encrypt every connection that carries sensitive data, inside your network too: browser to load balancer, service to service, and application to database.

- Accept TLS 1.2 and 1.3 only, with forward-secret key exchange. Prefer TLS 1.3.
- Send `Strict-Transport-Security` so browsers never fall back to HTTP ([A02](/guides/owasp-top-10/05-security-misconfiguration#h2-security-headers) shows the header).
- Validate certificates. Setting `NODE_TLS_REJECT_UNAUTHORIZED=0` or `rejectUnauthorized: false` to "fix" a certificate error turns TLS into encryption to whoever answers. For databases, check that the client really verifies the server: [node-postgres Silently Ignores Your TLS Config When the URL Says sslmode](/posts/node-postgres-sslmode-silently-ignores-ssl-options) shows a case where it does not.
- Do not use STARTTLS or SMTP for confidential data, as OWASP notes, and turn off caching for responses with sensitive data.

### Post-Quantum Key Exchange

A large enough quantum computer would break the elliptic curve and RSA key exchanges that TLS uses today. Traffic recorded now could be decrypted then ("harvest now, decrypt later"), which is why OWASP asks you to prepare now. The first step is already shipping: hybrid key exchanges that combine X25519 with ML-KEM, the post-quantum algorithm NIST standardized in 2024 (FIPS 203). Node.js 24 uses OpenSSL 3.5, which offers `X25519MLKEM768` by default. The companion repository has a small script that prints what a connection negotiates:

```terminal
{
  "title": "which key exchange does the server choose?",
  "prompt": "$",
  "steps": [
    {
      "cmd": "node scripts/tls-check.mjs devops-daily.com",
      "output": "devops-daily.com: TLSv1.3, TLS_AES_256_GCM_SHA384, X25519MLKEM768"
    },
    {
      "cmd": "node scripts/tls-check.mjs github.com",
      "output": "github.com: TLSv1.3, TLS_AES_128_GCM_SHA256, X25519"
    },
    {
      "cmd": "node scripts/tls-check.mjs registry.npmjs.org",
      "output": "registry.npmjs.org: TLSv1.2, ECDHE-ECDSA-AES128-GCM-SHA256, X25519"
    }
  ]
}
```

The client offered the hybrid group to all three servers; the first accepted it, the others chose classical X25519, and the npm registry negotiated TLS 1.2. Results change as providers roll out support. For your own services, check what your load balancers and TLS libraries support, keep an inventory of where you use public-key cryptography, and prefer libraries and protocols that can switch algorithms through configuration.

## Keep Less Data

OWASP's simplest advice: data you do not store cannot be stolen. Classify the data you handle (public, internal, confidential, regulated), keep sensitive data only as long as you need it, store only the last digits of card numbers or use a payment provider's tokens, and send `Cache-Control: no-store` on responses that contain it.

## Common Mistakes

- **Encrypting passwords** instead of hashing them, or hashing them with SHA-256.
- **Using a password as a key directly.** Derive keys from passwords with a key derivation function, or better, generate random keys.
- **Reusing a nonce with GCM**, for example a counter that restarts at zero after a deploy.
- **Encryption without authentication** (CBC or CTR mode without a MAC), which lets attackers change data and sometimes decrypt it through error messages.
- **One key for everything, forever.** Version and rotate keys.
- **Disabling certificate checks** to get past an error.

## Summary

- Hash passwords with Argon2id (built into Node.js 24), and store the parameters with the hash.
- Encrypt with AES-256-GCM: a random nonce per message, a key version, and context as AAD.
- Keep keys in a key service, per environment, with rotation.
- Use `crypto.randomBytes()` and friends for every secret value.
- Require TLS 1.2+ with certificate validation everywhere, and plan the move to post-quantum key exchange.

Next, [A05:2025 Injection](/guides/owasp-top-10/03-injection) covers what happens when data turns into code.

## Keep Learning

- [Cryptography Essentials guide](/guides/cryptography-essentials)
- [Secrets Management Best Practices with HashiCorp Vault](/posts/hashicorp-vault-secrets-management-best-practices)
- [You Cannot Rotate a Secret You Cannot Find](/posts/you-cannot-rotate-a-secret-you-cannot-find)
- [HashiCorp Vault Secrets Management checklist](/checklists/hashicorp-vault-secrets-management)
