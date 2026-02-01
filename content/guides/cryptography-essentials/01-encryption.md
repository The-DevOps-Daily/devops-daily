---
title: 'Encryption Fundamentals'
description: 'Learn symmetric and asymmetric encryption, understand common algorithms like AES and RSA, and master key management best practices.'
order: 1
---

Encryption transforms readable data (plaintext) into unreadable data (ciphertext) that can only be reversed with the correct key. It's the primary tool for protecting data confidentiality—ensuring that even if data is intercepted or stolen, it remains useless to attackers.

There are two fundamental types of encryption: **symmetric** (one key for both encryption and decryption) and **asymmetric** (separate keys for encryption and decryption). Each has distinct use cases, and understanding when to use which is crucial for secure system design.

## Symmetric Encryption

Symmetric encryption uses the same key for both encryption and decryption. It's fast and efficient, making it ideal for encrypting large amounts of data.

### How It Works

```
Plaintext + Key → [Encryption Algorithm] → Ciphertext
Ciphertext + Key → [Decryption Algorithm] → Plaintext
```

The security depends entirely on keeping the key secret. If an attacker obtains the key, they can decrypt all data encrypted with it.

### Common Symmetric Algorithms

| Algorithm | Key Size | Status | Use Case |
|-----------|----------|--------|----------|
| **AES-256** | 256 bits | ✅ Recommended | General purpose, government standard |
| **AES-128** | 128 bits | ✅ Secure | Faster than AES-256, still very secure |
| **ChaCha20** | 256 bits | ✅ Recommended | Mobile/embedded, software implementations |
| **3DES** | 168 bits | ⚠️ Deprecated | Legacy systems only |
| **DES** | 56 bits | ❌ Broken | Never use |
| **RC4** | Variable | ❌ Broken | Never use |

### AES (Advanced Encryption Standard)

AES is the gold standard for symmetric encryption. Adopted by NIST in 2001, it's used everywhere—from HTTPS to disk encryption to cloud storage.

```python
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
import os

# High-level API (recommended for most use cases)
def encrypt_with_fernet(plaintext: bytes) -> tuple[bytes, bytes]:
    """Encrypt data using Fernet (AES-128-CBC + HMAC)."""
    key = Fernet.generate_key()
    f = Fernet(key)
    ciphertext = f.encrypt(plaintext)
    return ciphertext, key

def decrypt_with_fernet(ciphertext: bytes, key: bytes) -> bytes:
    """Decrypt Fernet-encrypted data."""
    f = Fernet(key)
    return f.decrypt(ciphertext)

# Example usage
message = b"Sensitive configuration data"
encrypted, key = encrypt_with_fernet(message)
decrypted = decrypt_with_fernet(encrypted, key)
assert decrypted == message
```

### Block Cipher Modes

AES is a block cipher—it encrypts fixed-size blocks (128 bits). To encrypt data larger than one block, you need a **mode of operation**:

| Mode | Description | Use Case |
|------|-------------|----------|
| **GCM** | Galois/Counter Mode | ✅ Recommended — authenticated encryption |
| **CBC** | Cipher Block Chaining | Common but requires separate MAC |
| **CTR** | Counter Mode | Parallelizable, needs MAC |
| **ECB** | Electronic Codebook | ❌ Never use — reveals patterns |

**Always use authenticated encryption** (like GCM) which provides both confidentiality and integrity:

```python
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os

def encrypt_aes_gcm(plaintext: bytes, associated_data: bytes = b"") -> tuple[bytes, bytes, bytes]:
    """
    Encrypt using AES-256-GCM (authenticated encryption).
    Returns: (ciphertext, key, nonce)
    """
    key = AESGCM.generate_key(bit_length=256)
    aesgcm = AESGCM(key)
    
    # Nonce must be unique for each encryption with the same key
    # 96 bits (12 bytes) is recommended for GCM
    nonce = os.urandom(12)
    
    # Associated data is authenticated but not encrypted
    ciphertext = aesgcm.encrypt(nonce, plaintext, associated_data)
    
    return ciphertext, key, nonce

def decrypt_aes_gcm(ciphertext: bytes, key: bytes, nonce: bytes, 
                    associated_data: bytes = b"") -> bytes:
    """Decrypt AES-256-GCM ciphertext."""
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, ciphertext, associated_data)
```

### The ECB Problem

ECB mode encrypts each block independently, which reveals patterns in the plaintext:

```
Original Image:     ECB Encrypted:      CBC/GCM Encrypted:
███░░░███            ▓▓▓░░░▓▓▓           ▒█░▓▒█░▓▒
█████████            ▓▓▓▓▓▓▓▓▓           ░▓█▒░▓█▒░
███░░░███            ▓▓▓░░░▓▓▓           ▓░▒█▓░▒█▓
(Pattern visible)    (Pattern visible)   (Random - secure)
```

This is why you should **never use ECB** for real data.

## Asymmetric Encryption

Asymmetric encryption uses a **key pair**: a public key (shared openly) and a private key (kept secret). Data encrypted with the public key can only be decrypted with the private key, and vice versa.

### How It Works

```
Encryption:  Plaintext + Public Key  → Ciphertext
Decryption:  Ciphertext + Private Key → Plaintext

Signing:     Message + Private Key → Signature
Verification: Message + Signature + Public Key → Valid/Invalid
```

This solves the **key distribution problem**—you can share your public key with anyone without compromising security.

### Common Asymmetric Algorithms

| Algorithm | Key Size | Status | Use Case |
|-----------|----------|--------|----------|
| **RSA** | 2048+ bits | ✅ Secure | Encryption, signatures, key exchange |
| **ECDSA** | 256+ bits | ✅ Recommended | Digital signatures (smaller, faster) |
| **Ed25519** | 256 bits | ✅ Recommended | Signatures (modern, fast) |
| **ECDH** | 256+ bits | ✅ Recommended | Key exchange |
| **DSA** | 2048+ bits | ⚠️ Deprecated | Legacy signatures only |

### RSA Example

```python
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes, serialization

def generate_rsa_keypair():
    """Generate a 2048-bit RSA key pair."""
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    public_key = private_key.public_key()
    return private_key, public_key

def rsa_encrypt(plaintext: bytes, public_key) -> bytes:
    """Encrypt data with RSA public key."""
    return public_key.encrypt(
        plaintext,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )

def rsa_decrypt(ciphertext: bytes, private_key) -> bytes:
    """Decrypt data with RSA private key."""
    return private_key.decrypt(
        ciphertext,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )

# Example usage
private_key, public_key = generate_rsa_keypair()

message = b"Secret message for recipient"
encrypted = rsa_encrypt(message, public_key)
decrypted = rsa_decrypt(encrypted, private_key)

assert decrypted == message
```

### Digital Signatures with Ed25519

Ed25519 is a modern signature algorithm that's faster and more secure than RSA signatures:

```python
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

def generate_signing_keypair():
    """Generate Ed25519 signing key pair."""
    private_key = Ed25519PrivateKey.generate()
    public_key = private_key.public_key()
    return private_key, public_key

def sign_message(message: bytes, private_key) -> bytes:
    """Sign a message with Ed25519 private key."""
    return private_key.sign(message)

def verify_signature(message: bytes, signature: bytes, public_key) -> bool:
    """Verify an Ed25519 signature."""
    try:
        public_key.verify(signature, message)
        return True
    except Exception:
        return False

# Example: Signing a container image digest
private_key, public_key = generate_signing_keypair()

image_digest = b"sha256:abc123def456..."
signature = sign_message(image_digest, private_key)

# Anyone with the public key can verify
is_valid = verify_signature(image_digest, signature, public_key)
print(f"Signature valid: {is_valid}")  # True
```

## Symmetric vs Asymmetric: When to Use Which

| Aspect | Symmetric | Asymmetric |
|--------|-----------|------------|
| **Speed** | Fast (1000x+) | Slow |
| **Key Management** | Complex (shared secret) | Easier (public/private) |
| **Key Size** | 128-256 bits | 2048+ bits |
| **Use Case** | Bulk data encryption | Key exchange, signatures |

### Hybrid Encryption

In practice, systems use **hybrid encryption**: asymmetric encryption to exchange a symmetric key, then symmetric encryption for the actual data.

```
1. Alice generates random AES key (symmetric)
2. Alice encrypts data with AES key
3. Alice encrypts AES key with Bob's RSA public key (asymmetric)
4. Alice sends: encrypted data + encrypted AES key
5. Bob decrypts AES key with his RSA private key
6. Bob decrypts data with AES key
```

This is exactly how TLS works (covered in Part 3).

## Key Management Best Practices

Encryption is only as strong as your key management. Here are essential practices:

### 1. Never Hardcode Keys

```python
# ❌ BAD: Key in source code
ENCRYPTION_KEY = "super_secret_key_123"

# ✅ GOOD: Key from environment/secrets manager
import os
ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY')

# ✅ BETTER: Use a secrets manager
from aws_secretsmanager import get_secret
ENCRYPTION_KEY = get_secret('app/encryption-key')
```

### 2. Use Key Derivation Functions (KDFs)

When deriving keys from passwords, use a proper KDF:

```python
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
import os
import base64

def derive_key_from_password(password: str, salt: bytes = None) -> tuple[bytes, bytes]:
    """Derive a secure encryption key from a password."""
    if salt is None:
        salt = os.urandom(16)
    
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,  # 256 bits for AES-256
        salt=salt,
        iterations=600000,  # OWASP recommended minimum
    )
    
    key = kdf.derive(password.encode())
    return key, salt

# Store the salt alongside encrypted data
password = "user_master_password"
key, salt = derive_key_from_password(password)
```

### 3. Rotate Keys Regularly

```yaml
# Example: AWS KMS key rotation policy
Resources:
  EncryptionKey:
    Type: AWS::KMS::Key
    Properties:
      EnableKeyRotation: true  # Automatic annual rotation
      KeyPolicy:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              AWS: !Sub 'arn:aws:iam::${AWS::AccountId}:root'
            Action: 'kms:*'
            Resource: '*'
```

### 4. Use Hardware Security Modules (HSMs) for High-Value Keys

For production systems handling sensitive data:

- **AWS KMS** / **Cloud KMS** / **Azure Key Vault** for cloud workloads
- **HashiCorp Vault** for multi-cloud or on-premises
- **Hardware HSMs** (Luna, nCipher) for highest security requirements

## Common Encryption Mistakes

### 1. Using Encryption Without Authentication

```python
# ❌ BAD: AES-CBC without MAC (vulnerable to padding oracle attacks)
cipher = Cipher(algorithms.AES(key), modes.CBC(iv))

# ✅ GOOD: AES-GCM (authenticated encryption)
aesgcm = AESGCM(key)
ciphertext = aesgcm.encrypt(nonce, plaintext, associated_data)
```

### 2. Reusing Nonces/IVs

```python
# ❌ BAD: Static nonce
NONCE = b"static_nonce"  # Catastrophic for GCM!

# ✅ GOOD: Random nonce for each encryption
nonce = os.urandom(12)
```

### 3. Weak Key Generation

```python
# ❌ BAD: Predictable key
import random
key = bytes([random.randint(0, 255) for _ in range(32)])

# ✅ GOOD: Cryptographically secure random
import os
key = os.urandom(32)

# ✅ ALSO GOOD: Library-provided generation
from cryptography.fernet import Fernet
key = Fernet.generate_key()
```

## Encryption in DevOps Contexts

### Encrypting Secrets in CI/CD

```yaml
# GitHub Actions: Using encrypted secrets
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy with encrypted credentials
        env:
          DB_PASSWORD: ${{ secrets.DB_PASSWORD }}  # Decrypted at runtime
        run: ./deploy.sh
```

### Encrypting Data at Rest

```bash
# AWS S3 bucket with server-side encryption
aws s3 cp sensitive-file.txt s3://my-bucket/ \
  --sse aws:kms \
  --sse-kms-key-id alias/my-key

# Kubernetes secrets encryption at rest
# In kube-apiserver configuration:
--encryption-provider-config=/etc/kubernetes/encryption-config.yaml
```

### SOPS for GitOps

```yaml
# Encrypted with SOPS (secrets shown in plaintext for example)
# Actual file would have encrypted values
database:
    password: ENC[AES256_GCM,data:abc123...]
    host: ENC[AES256_GCM,data:def456...]
sops:
    kms:
        - arn:aws:kms:us-east-1:123456789:key/abc-123
    encrypted_suffix: _encrypted
```

## Summary

Key takeaways for encryption:

- **Symmetric encryption** (AES-256-GCM) for bulk data—fast but requires secure key exchange
- **Asymmetric encryption** (RSA, ECDSA) for key exchange and signatures—solves distribution problem
- **Always use authenticated encryption** (GCM mode)—never encrypt without integrity protection
- **Never reuse nonces/IVs**—catastrophic for stream ciphers and GCM
- **Use proper key management**—secrets managers, KDFs for passwords, regular rotation
- **Avoid deprecated algorithms**—no DES, 3DES, RC4, or ECB mode

In the next section, we'll explore hashing—one-way functions used for integrity verification and password storage.
