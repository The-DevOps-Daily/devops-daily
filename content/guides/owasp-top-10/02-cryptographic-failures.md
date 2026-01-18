---
title: 'A02: Cryptographic Failures'
description: 'Learn how cryptographic failures expose sensitive data and how to properly implement encryption, hashing, and secure data handling in your applications.'
---

Previously known as "Sensitive Data Exposure," Cryptographic Failures focuses on failures related to cryptography that lead to exposure of sensitive data. This vulnerability sits at #2 on the OWASP Top 10 because improper cryptography has led to some of the most devastating data breaches in history.

## What are Cryptographic Failures?

Cryptographic failures occur when applications:

- **Transmit sensitive data in clear text** (HTTP, FTP, SMTP without TLS)
- **Use weak or outdated cryptographic algorithms** (MD5, SHA1, DES)
- **Store passwords incorrectly** (plain text, simple hashing, weak salts)
- **Use hard-coded or weak encryption keys**
- **Fail to enforce encryption** (mixed content, optional TLS)

The consequences range from stolen credentials to complete database exposure. When cryptography fails, there's often no second chance—once data is exposed, it can't be un-exposed.

## Common Vulnerability Patterns

### 1. Passwords Stored Incorrectly

Password storage is where many applications fail. Let's look at the progression from worst to best:

**Level 0 - Plain Text (Never do this):**

```javascript
// CATASTROPHIC: Plain text password storage
const user = new User({
  email: req.body.email,
  password: req.body.password  // Stored as-is!
});
```

If your database is breached, every password is immediately compromised. Users often reuse passwords, so this breach extends to their other accounts.

**Level 1 - Simple Hashing (Still dangerous):**

```javascript
// DANGEROUS: Simple hash without salt
const crypto = require('crypto');
const hashedPassword = crypto.createHash('sha256')
  .update(req.body.password)
  .digest('hex');
```

This is vulnerable to rainbow table attacks. Attackers have precomputed hashes for millions of common passwords. A lookup takes milliseconds.

**Level 2 - Hash with Salt (Better, but not enough):**

```javascript
// INSUFFICIENT: SHA-256 with salt
const salt = crypto.randomBytes(16).toString('hex');
const hashedPassword = crypto.createHash('sha256')
  .update(salt + req.body.password)
  .digest('hex');
```

Salting defeats rainbow tables, but SHA-256 is too fast. Modern GPUs can compute billions of SHA-256 hashes per second, making brute force attacks feasible.

**Level 3 - Password Hashing Function (Correct approach):**

```javascript
// SECURE: Use bcrypt with appropriate cost factor
const bcrypt = require('bcrypt');

// Cost factor of 12 means 2^12 iterations
// Adjust based on your security needs and hardware
const SALT_ROUNDS = 12;

async function hashPassword(plainPassword) {
  // bcrypt automatically generates a salt and includes it in the output
  return await bcrypt.hash(plainPassword, SALT_ROUNDS);
}

async function verifyPassword(plainPassword, hashedPassword) {
  return await bcrypt.compare(plainPassword, hashedPassword);
}

// Usage
const hash = await hashPassword('userPassword123');
// Result: $2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYE7zNqK7Kxy
// Contains: algorithm version, cost factor, salt, and hash
```

Bcrypt, Argon2, and scrypt are designed to be slow and memory-intensive, making brute force attacks impractical. Argon2 is the winner of the Password Hashing Competition and is recommended for new applications:

```javascript
// RECOMMENDED: Argon2id for new applications
const argon2 = require('argon2');

async function hashPassword(plainPassword) {
  return await argon2.hash(plainPassword, {
    type: argon2.argon2id,  // Hybrid of Argon2i and Argon2d
    memoryCost: 65536,       // 64 MB memory
    timeCost: 3,             // 3 iterations
    parallelism: 4           // 4 parallel threads
  });
}

async function verifyPassword(plainPassword, hashedPassword) {
  return await argon2.verify(hashedPassword, plainPassword);
}
```

### 2. Sensitive Data in Transit

Data transmitted without encryption can be intercepted by anyone on the network path.

**Vulnerable Pattern:**

```javascript
// VULNERABLE: HTTP API calls
fetch('http://api.example.com/users', {
  method: 'POST',
  body: JSON.stringify({ email, password })
});
```

**Secure Implementation:**

```javascript
// Server configuration - enforce HTTPS
const express = require('express');
const helmet = require('helmet');

const app = express();

// Helmet adds security headers including HSTS
app.use(helmet());

// Force HTTPS redirect
app.use((req, res, next) => {
  if (req.header('x-forwarded-proto') !== 'https') {
    return res.redirect(`https://${req.header('host')}${req.url}`);
  }
  next();
});

// Set secure cookie options
app.use(session({
  secret: process.env.SESSION_SECRET,
  cookie: {
    secure: true,      // Only send over HTTPS
    httpOnly: true,    // Not accessible via JavaScript
    sameSite: 'strict' // CSRF protection
  }
}));
```

Configure HSTS (HTTP Strict Transport Security) to ensure browsers always use HTTPS:

```nginx
# Nginx configuration
server {
    listen 443 ssl http2;
    
    # HSTS header - browser will refuse HTTP for 1 year
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    
    # Modern TLS configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
}
```

### 3. Weak Encryption for Data at Rest

Encrypting sensitive data at rest protects against database breaches, but only if done correctly.

**Vulnerable Patterns:**

```javascript
// VULNERABLE: ECB mode preserves patterns in data
const cipher = crypto.createCipher('aes-256-ecb', key);

// VULNERABLE: Hard-coded encryption key
const ENCRYPTION_KEY = 'my-super-secret-key-12345';

// VULNERABLE: Predictable IV (Initialization Vector)
const iv = Buffer.alloc(16, 0);  // All zeros!
```

**Secure Implementation:**

```javascript
const crypto = require('crypto');

// Key should come from environment/secrets manager
// Must be 32 bytes for AES-256
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

function encrypt(plainText) {
  // Generate a random IV for each encryption
  // IV doesn't need to be secret, but must be unique
  const iv = crypto.randomBytes(16);
  
  // Use AES-256-GCM (authenticated encryption)
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // GCM provides an authentication tag - store this too
  const authTag = cipher.getAuthTag();
  
  // Return IV + authTag + ciphertext (all needed for decryption)
  return {
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    content: encrypted
  };
}

function decrypt(encryptedData) {
  const iv = Buffer.from(encryptedData.iv, 'hex');
  const authTag = Buffer.from(encryptedData.authTag, 'hex');
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedData.content, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

AES-GCM provides authenticated encryption, meaning it both encrypts the data AND verifies it hasn't been tampered with. The authentication tag will cause decryption to fail if the ciphertext has been modified.

### 4. Improper Key Management

The strongest encryption is worthless if keys are mishandled.

**Common Mistakes:**

```javascript
// WRONG: Key in source code
const API_KEY = 'sk-1234567890abcdef';

// WRONG: Key in version control
// .env file committed to git

// WRONG: Same key for all environments
// Production using the same key as development
```

**Proper Key Management:**

```javascript
// Use environment variables at minimum
const apiKey = process.env.API_KEY;
if (!apiKey) {
  throw new Error('API_KEY environment variable is required');
}

// Better: Use a secrets manager
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

async function getSecret(secretName) {
  const client = new SecretManagerServiceClient();
  const [version] = await client.accessSecretVersion({
    name: `projects/my-project/secrets/${secretName}/versions/latest`
  });
  return version.payload.data.toString();
}

// AWS Secrets Manager example
const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager();

async function getAWSSecret(secretId) {
  const data = await secretsManager.getSecretValue({ SecretId: secretId }).promise();
  return JSON.parse(data.SecretString);
}
```

## Prevention Best Practices

### 1. Classify Your Data

Not all data needs the same level of protection. Classify data by sensitivity:

```javascript
// Data classification example
const DataClassification = {
  PUBLIC: 'public',           // Marketing content, public docs
  INTERNAL: 'internal',       // Employee directory, internal docs
  CONFIDENTIAL: 'confidential', // Customer data, financial records
  RESTRICTED: 'restricted'    // PII, payment data, health records
};

// Apply appropriate controls based on classification
function getEncryptionRequirements(classification) {
  switch (classification) {
    case DataClassification.RESTRICTED:
      return {
        atRest: true,
        inTransit: true,
        algorithm: 'aes-256-gcm',
        keyRotation: '30d'
      };
    case DataClassification.CONFIDENTIAL:
      return {
        atRest: true,
        inTransit: true,
        algorithm: 'aes-256-gcm',
        keyRotation: '90d'
      };
    default:
      return {
        atRest: false,
        inTransit: true,  // Always encrypt in transit
        algorithm: null,
        keyRotation: null
      };
  }
}
```

### 2. Use Modern TLS Configuration

```yaml
# Example: Kubernetes Ingress with modern TLS
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: secure-ingress
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-ssl-protocols: "TLSv1.2 TLSv1.3"
spec:
  tls:
  - hosts:
    - api.example.com
    secretName: api-tls-cert
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-service
            port:
              number: 443
```

### 3. Implement Key Rotation

Encryption keys should be rotated regularly. Here's a pattern for supporting key rotation:

```javascript
// Support multiple key versions for rotation
const keys = {
  'v1': Buffer.from(process.env.ENCRYPTION_KEY_V1, 'hex'),
  'v2': Buffer.from(process.env.ENCRYPTION_KEY_V2, 'hex'),  // Current
};
const CURRENT_KEY_VERSION = 'v2';

function encrypt(plainText) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', keys[CURRENT_KEY_VERSION], iv);
  
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return {
    keyVersion: CURRENT_KEY_VERSION,  // Store which key was used
    iv: iv.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
    content: encrypted
  };
}

function decrypt(encryptedData) {
  // Use the key version that was used for encryption
  const key = keys[encryptedData.keyVersion];
  if (!key) {
    throw new Error(`Unknown key version: ${encryptedData.keyVersion}`);
  }
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, 
    Buffer.from(encryptedData.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
  
  let decrypted = decipher.update(encryptedData.content, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// Re-encrypt data with new key during rotation
async function rotateEncryption(record) {
  if (record.encryptedData.keyVersion !== CURRENT_KEY_VERSION) {
    const plainText = decrypt(record.encryptedData);
    record.encryptedData = encrypt(plainText);
    await record.save();
  }
}
```

## Key Takeaways

1. **Use password hashing functions** (bcrypt, Argon2) not general-purpose hashes
2. **Encrypt data in transit** - HTTPS everywhere, no exceptions
3. **Use authenticated encryption** (AES-GCM) for data at rest
4. **Never hard-code keys** - use environment variables or secrets managers
5. **Generate unique IVs** for each encryption operation
6. **Plan for key rotation** - include key version in encrypted data
7. **Classify your data** - apply appropriate controls based on sensitivity
8. **Use modern TLS** - TLS 1.2+ with strong cipher suites

Cryptographic failures are often invisible until a breach occurs. By following these practices, you ensure that even if an attacker gains access to your storage, the data remains protected.
