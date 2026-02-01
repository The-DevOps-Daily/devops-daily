---
title: 'Hashing Algorithms'
description: 'Understand cryptographic hash functions, their properties, and proper use cases including integrity verification and password storage.'
order: 2
---

A cryptographic hash function takes input of any size and produces a fixed-size output (the hash or digest). Unlike encryption, hashing is a **one-way function**—you cannot recover the original input from the hash. This makes hashing essential for integrity verification, password storage, and digital signatures.

## Properties of Cryptographic Hash Functions

A secure hash function must have these properties:

| Property | Description | Why It Matters |
|----------|-------------|----------------|
| **Deterministic** | Same input always produces same output | Enables verification |
| **Fast to compute** | Hash any size input quickly | Practical for large files |
| **Pre-image resistant** | Cannot find input from hash | Protects original data |
| **Second pre-image resistant** | Cannot find different input with same hash | Prevents forgery |
| **Collision resistant** | Hard to find any two inputs with same hash | Ensures uniqueness |
| **Avalanche effect** | Small input change = completely different hash | Hides patterns |

### The Avalanche Effect

```python
import hashlib

# Tiny change in input = completely different hash
hash1 = hashlib.sha256(b"Hello World").hexdigest()
hash2 = hashlib.sha256(b"Hello World!").hexdigest()  # Added '!'

print(f"'Hello World'  -> {hash1}")
print(f"'Hello World!' -> {hash2}")

# Output:
# 'Hello World'  -> a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e
# 'Hello World!' -> 7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069
# (Completely different despite one character change)
```

## Common Hash Algorithms

| Algorithm | Output Size | Status | Use Case |
|-----------|-------------|--------|----------|
| **SHA-256** | 256 bits | ✅ Recommended | General purpose, checksums, blockchain |
| **SHA-384** | 384 bits | ✅ Secure | Higher security requirements |
| **SHA-512** | 512 bits | ✅ Secure | Large data, 64-bit optimized |
| **SHA-3** | Variable | ✅ Recommended | NIST standard, different design than SHA-2 |
| **BLAKE2** | Variable | ✅ Recommended | Faster than SHA-2, very secure |
| **BLAKE3** | Variable | ✅ Recommended | Fastest, parallelizable |
| **SHA-1** | 160 bits | ❌ Broken | Never use for security |
| **MD5** | 128 bits | ❌ Broken | Never use for security |

### Why MD5 and SHA-1 Are Broken

Both MD5 and SHA-1 have practical collision attacks:

- **MD5**: Collisions can be generated in seconds on a laptop
- **SHA-1**: SHAttered attack (2017) created two different PDFs with the same SHA-1 hash

```python
# ❌ NEVER use for security
md5_hash = hashlib.md5(data).hexdigest()    # Broken
sha1_hash = hashlib.sha1(data).hexdigest()  # Broken

# ✅ Use SHA-256 or better
sha256_hash = hashlib.sha256(data).hexdigest()  # Secure
```

**Note**: MD5 is still acceptable for non-security purposes like checksums for data corruption detection (not malicious tampering).

## Use Case 1: File Integrity Verification

Hashes verify that files haven't been modified:

```python
import hashlib

def calculate_file_hash(filepath: str, algorithm: str = 'sha256') -> str:
    """Calculate hash of a file efficiently."""
    hash_func = hashlib.new(algorithm)
    
    with open(filepath, 'rb') as f:
        # Read in chunks for large files
        for chunk in iter(lambda: f.read(8192), b''):
            hash_func.update(chunk)
    
    return hash_func.hexdigest()

def verify_file_integrity(filepath: str, expected_hash: str, 
                          algorithm: str = 'sha256') -> bool:
    """Verify file matches expected hash."""
    actual_hash = calculate_file_hash(filepath, algorithm)
    return actual_hash == expected_hash

# Example: Verifying a downloaded binary
expected = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
if verify_file_integrity("download.tar.gz", expected):
    print("File integrity verified")
else:
    print("WARNING: File may be corrupted or tampered!")
```

### Command-Line Verification

```bash
# Generate hash
sha256sum myfile.tar.gz > myfile.sha256

# Verify hash
sha256sum -c myfile.sha256
# myfile.tar.gz: OK

# Verify downloaded software
echo "expected_hash_here  terraform.zip" | sha256sum -c -
```

## Use Case 2: Password Storage

**Never store passwords in plaintext.** But regular hashing isn't enough either—you need **password hashing functions** specifically designed to be slow and memory-hard.

### Why Regular Hashes Are Bad for Passwords

```python
# ❌ BAD: Fast hash allows rapid brute force
import hashlib
password_hash = hashlib.sha256(password.encode()).hexdigest()
# Attacker can try billions of guesses per second!

# ❌ ALSO BAD: Unsalted hash vulnerable to rainbow tables
# Same password = same hash for all users
```

### Password Hashing Functions

| Algorithm | Status | Notes |
|-----------|--------|-------|
| **Argon2id** | ✅ Best | PHC winner, memory-hard, recommended |
| **bcrypt** | ✅ Good | Battle-tested, 72-byte limit |
| **scrypt** | ✅ Good | Memory-hard, used in crypto |
| **PBKDF2** | ✅ Acceptable | Widely supported, needs high iterations |

### Argon2id (Recommended)

```python
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

# Initialize with secure defaults
ph = PasswordHasher(
    time_cost=3,        # Number of iterations
    memory_cost=65536,  # 64 MB memory
    parallelism=4,      # 4 threads
)

def hash_password(password: str) -> str:
    """Hash a password with Argon2id."""
    return ph.hash(password)

def verify_password(password: str, hash: str) -> bool:
    """Verify a password against its hash."""
    try:
        ph.verify(hash, password)
        return True
    except VerifyMismatchError:
        return False

# Example usage
password = "user_secret_password"
hashed = hash_password(password)
print(f"Hash: {hashed}")
# $argon2id$v=19$m=65536,t=3,p=4$...(salt)...$...(hash)...

# Verification
assert verify_password("user_secret_password", hashed) == True
assert verify_password("wrong_password", hashed) == False
```

### bcrypt (Widely Supported)

```python
import bcrypt

def hash_password_bcrypt(password: str) -> bytes:
    """Hash a password with bcrypt."""
    salt = bcrypt.gensalt(rounds=12)  # 2^12 iterations
    return bcrypt.hashpw(password.encode(), salt)

def verify_password_bcrypt(password: str, hashed: bytes) -> bool:
    """Verify a bcrypt password hash."""
    return bcrypt.checkpw(password.encode(), hashed)

# Example
hashed = hash_password_bcrypt("my_password")
print(f"Hash: {hashed}")
# b'$2b$12$...(salt+hash)...'

assert verify_password_bcrypt("my_password", hashed) == True
```

### OWASP Password Storage Recommendations

```yaml
# OWASP 2024 recommendations
recommended_algorithms:
  first_choice: argon2id
  argon2id_config:
    memory: 19456  # 19 MiB minimum (46 MiB recommended)
    iterations: 2
    parallelism: 1
  
  second_choice: scrypt
  scrypt_config:
    n: 2^17  # CPU/memory cost
    r: 8     # Block size
    p: 1     # Parallelism
  
  third_choice: bcrypt
  bcrypt_config:
    cost: 10  # Minimum (12+ recommended)
  
  legacy_acceptable: pbkdf2
  pbkdf2_config:
    iterations: 600000  # SHA-256
    # or 210000 for SHA-512
```

## Use Case 3: Message Authentication Codes (HMAC)

HMAC combines hashing with a secret key to provide authentication and integrity:

```python
import hmac
import hashlib

def create_hmac(message: bytes, key: bytes) -> str:
    """Create HMAC-SHA256 for a message."""
    return hmac.new(key, message, hashlib.sha256).hexdigest()

def verify_hmac(message: bytes, key: bytes, expected_mac: str) -> bool:
    """Verify HMAC using constant-time comparison."""
    actual_mac = create_hmac(message, key)
    return hmac.compare_digest(actual_mac, expected_mac)

# Example: Webhook signature verification
secret_key = b"webhook_secret_from_provider"
payload = b'{"event": "payment.completed", "amount": 100}'

# Provider sends this signature in header
signature = create_hmac(payload, secret_key)

# You verify it
if verify_hmac(payload, secret_key, signature):
    print("Webhook is authentic")
else:
    print("WARNING: Invalid webhook signature!")
```

### Timing Attack Prevention

**Always use constant-time comparison** for security-sensitive comparisons:

```python
# ❌ BAD: Vulnerable to timing attack
if actual_hash == expected_hash:  # String comparison leaks timing info
    return True

# ✅ GOOD: Constant-time comparison
import hmac
if hmac.compare_digest(actual_hash, expected_hash):
    return True
```

## Use Case 4: Content-Addressable Storage

Git, Docker, and many distributed systems use hashes as content identifiers:

```python
import hashlib
import json

def content_address(data: bytes) -> str:
    """Generate content-addressable identifier."""
    return f"sha256:{hashlib.sha256(data).hexdigest()}"

# Docker image digests
layer_data = b"... layer tarball ..."
digest = content_address(layer_data)
print(f"Layer digest: {digest}")
# sha256:abc123def456...

# If content changes, digest changes
# If digest is same, content is guaranteed identical
```

### Git Object Hashing

```bash
# Git uses SHA-1 (transitioning to SHA-256)
echo "Hello" | git hash-object --stdin
# e965047ad7c57865823c7d992b1d046ea66edf78

# Verify a commit
git cat-file -p HEAD | sha1sum
```

## Hashing in DevOps Contexts

### Container Image Digests

```yaml
# Dockerfile: Pin base image by digest (immutable)
FROM nginx@sha256:abc123def456...  # ✅ Reproducible
# FROM nginx:1.25                   # ❌ Tag can change

# Kubernetes: Reference by digest
spec:
  containers:
    - name: app
      image: myregistry/app@sha256:abc123def456...
```

### Artifact Checksums

```bash
# Download and verify Terraform
curl -O https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
curl -O https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_SHA256SUMS

# Verify checksum
sha256sum -c terraform_1.6.0_SHA256SUMS --ignore-missing
# terraform_1.6.0_linux_amd64.zip: OK
```

### Cache Invalidation

```python
import hashlib
import json

def cache_key(config: dict) -> str:
    """Generate cache key from configuration."""
    # Deterministic JSON serialization
    config_str = json.dumps(config, sort_keys=True)
    return hashlib.sha256(config_str.encode()).hexdigest()[:16]

# Same config = same cache key
config = {"version": "1.0", "features": ["a", "b"]}
key = cache_key(config)
print(f"Cache key: {key}")  # Consistent across runs
```

## Common Hashing Mistakes

### 1. Using MD5/SHA-1 for Security

```python
# ❌ BAD: Broken algorithms
file_hash = hashlib.md5(data).hexdigest()
signature = hashlib.sha1(message).hexdigest()

# ✅ GOOD: SHA-256 or better
file_hash = hashlib.sha256(data).hexdigest()
```

### 2. Hashing Passwords with Fast Algorithms

```python
# ❌ BAD: Fast hash for passwords
password_hash = hashlib.sha256(password.encode()).hexdigest()

# ✅ GOOD: Purpose-built password hasher
from argon2 import PasswordHasher
password_hash = PasswordHasher().hash(password)
```

### 3. Not Using Salt for Passwords

```python
# ❌ BAD: Unsalted (vulnerable to rainbow tables)
hash = sha256(password)

# ✅ GOOD: Salted (Argon2/bcrypt do this automatically)
# Each password gets unique salt, stored with hash
```

### 4. Non-Constant Time Comparison

```python
# ❌ BAD: Timing attack vulnerability
if user_token == stored_token:
    authenticate()

# ✅ GOOD: Constant-time comparison
if hmac.compare_digest(user_token, stored_token):
    authenticate()
```

## Summary

Key takeaways for hashing:

- **Hash functions are one-way**—you cannot reverse a hash to get the original input
- **Use SHA-256 or better** for integrity verification—avoid MD5 and SHA-1 for security
- **Use password-specific functions** (Argon2id, bcrypt)—never hash passwords with SHA-256
- **HMAC for authentication**—combine hash with secret key
- **Constant-time comparison**—prevent timing attacks with `hmac.compare_digest()`
- **Content addressing**—use hashes as immutable identifiers (Docker, Git)

In the next section, we'll explore TLS/SSL—how encryption and hashing combine to secure data in transit.
