---
title: "Secrets Management Fundamentals"
description: "Core concepts of secrets management: threat models, secret types, lifecycle, and security principles"
---

# Secrets Management Fundamentals

Before diving into specific tools, you need to understand the principles that make secrets management effective. This foundation helps you make better decisions regardless of which platform you choose.

## What Are Secrets?

Secrets are any sensitive data that grants access to systems or data:

- **API Keys** - Access tokens for external services (Stripe, GitHub, Slack)
- **Database Credentials** - Usernames and passwords for databases
- **Encryption Keys** - Symmetric keys for data encryption
- **Certificates** - TLS/SSL certificates and private keys
- **SSH Keys** - Private keys for server access
- **OAuth Tokens** - Access and refresh tokens for OAuth flows
- **Signing Keys** - Keys for code signing, JWT signing, etc.

## The Threat Model

Understanding how secrets get compromised helps you defend against attacks:

```
Secret Compromise Vectors
=========================

Source Code       -> Hardcoded secrets, committed .env files
CI/CD Logs        -> Secrets printed to build output
Config Files      -> Unencrypted secrets in deployment configs
Memory Dumps      -> Secrets in application memory
Network Traffic   -> Secrets transmitted without TLS
Backups           -> Secrets in unencrypted database backups
Developer Laptops -> Local copies of production secrets
Third-Party Apps  -> Secrets shared with external services
```

### Real-World Breaches

- **Uber (2016)** - AWS credentials in a GitHub repo led to 57 million user records exposed
- **CircleCI (2023)** - Compromised secrets affected thousands of customers
- **LastPass (2022)** - Encrypted vault backups stolen along with encryption keys

## Core Principles

### 1. Least Privilege

Every service, user, and process should have access only to the secrets it needs.

```
Bad:  Production database password accessible to all developers
Good: Production database password accessible only to production services
```

### 2. Short-Lived Credentials

Credentials that expire quickly limit the window of opportunity for attackers.

```
Static credential: Valid forever until manually rotated
Dynamic credential: Valid for 1 hour, automatically revoked
```

### 3. Encryption at Rest and in Transit

Secrets should never be stored or transmitted in plaintext.

```yaml
# Bad - plaintext in environment
DATABASE_URL=postgres://admin:password123@db.example.com/prod

# Good - encrypted reference
DATABASE_URL=vault:secret/data/prod/database#url
```

### 4. Audit Everything

Every secret access should be logged with:
- Who accessed it
- When it was accessed
- From where (IP, service identity)
- What they did with it

### 5. Rotation Without Downtime

You should be able to rotate any secret without service interruption.

```
Rotation Flow
-------------
1. Generate new credential
2. Update secrets manager
3. Applications fetch new credential
4. Old credential remains valid briefly
5. Revoke old credential
```

## Secret Lifecycle

Every secret goes through these stages:

```
Creation -> Storage -> Distribution -> Usage -> Rotation -> Revocation
    |          |           |            |          |            |
    v          v           v            v          v            v
 Generate  Encrypt     Deliver      Access     Update       Delete
 securely  at rest    securely     control    regularly    completely
```

### Creation

- Generate secrets with sufficient entropy (256+ bits)
- Never use predictable patterns or dictionary words
- Use cryptographically secure random number generators

```python
# Python - Generating secure secrets
import secrets

# API key (URL-safe)
api_key = secrets.token_urlsafe(32)  # 256 bits

# Database password
password = secrets.token_hex(32)  # 256 bits

# Numeric PIN (if required)
pin = ''.join(str(secrets.randbelow(10)) for _ in range(6))
```

### Storage

Secrets must be encrypted at rest with proper key management:

- Use envelope encryption (data key encrypted by master key)
- Store master keys in HSMs when possible
- Implement key rotation for encryption keys

### Distribution

Secrets should be pulled, not pushed:

```
Bad:  CI/CD injects secrets as environment variables at build time
Good: Application fetches secrets from vault at runtime
```

### Usage

- Load secrets into memory only when needed
- Clear secrets from memory after use
- Never log secrets or include them in error messages

```python
# Bad - secret in logs
logger.info(f"Connecting to database with password: {db_password}")

# Good - no secrets in logs
logger.info("Connecting to database")
```

### Rotation

Implement automated rotation:

- **Time-based**: Rotate every N days
- **Event-based**: Rotate on suspected compromise
- **Usage-based**: Rotate after N uses

### Revocation

When secrets are compromised or no longer needed:

- Revoke immediately
- Verify revocation is complete
- Audit for unauthorized use during exposure window

## Secret Types and Strategies

Different secrets require different management strategies:

| Secret Type | Rotation Frequency | Storage | Notes |
|-------------|-------------------|---------|-------|
| API Keys | 90 days | Vault/Cloud SM | Multiple active keys for rotation |
| Database Creds | Dynamic | Vault | Generate per-session when possible |
| TLS Certificates | 90 days | Vault PKI | Automate with ACME/Vault |
| SSH Keys | 1 year | Vault SSH | Consider signed certificates |
| Encryption Keys | 1-2 years | HSM/KMS | Never export, rotate with re-encryption |
| OAuth Tokens | Per session | Memory only | Use refresh tokens, short-lived access |

## Environment Segregation

Never share secrets across environments:

```
Environments and Secrets
------------------------

Development:  dev-db-password     (local/test data only)
Staging:      staging-db-password (synthetic data)
Production:   prod-db-password    (real customer data)

Each environment has completely separate secrets.
Developers NEVER have access to production secrets.
```

## Access Control Patterns

### Role-Based Access Control (RBAC)

```
Role: backend-service
  Can read: secret/data/prod/database
  Can read: secret/data/prod/api-keys
  Cannot read: secret/data/prod/admin/*

Role: developer
  Can read: secret/data/dev/*
  Can read: secret/data/staging/*
  Cannot read: secret/data/prod/*
```

### Identity-Based Access

Modern platforms support workload identity:

- **Kubernetes**: ServiceAccount tokens
- **AWS**: IAM roles for EC2/ECS/Lambda
- **Azure**: Managed Identity
- **GCP**: Workload Identity

```yaml
# Kubernetes pod with service account
apiVersion: v1
kind: Pod
metadata:
  name: myapp
spec:
  serviceAccountName: myapp-sa  # Identity for secrets access
  containers:
    - name: app
      image: myapp:latest
```

## Secrets in CI/CD

CI/CD pipelines need special consideration:

### Do's

- Use platform-native secrets (GitHub Secrets, GitLab CI Variables)
- Fetch secrets at runtime, not build time
- Use OIDC for cloud authentication when possible
- Mask secrets in logs

### Don'ts

- Echo secrets to verify they're set
- Pass secrets as command-line arguments (visible in `ps`)
- Store secrets in artifacts or caches
- Use the same secrets for PR builds as production

```yaml
# GitHub Actions - Good pattern
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write  # OIDC
    steps:
      - name: Configure AWS (OIDC - no stored credentials)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789:role/deploy
          aws-region: us-east-1
```

## Secrets Detection

Prevent secrets from leaking with automated scanning:

```bash
# Pre-commit with gitleaks
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks
```

Tools to consider:
- **gitleaks** - Git repository scanner
- **truffleHog** - Regex and entropy-based detection
- **detect-secrets** - Yelp's secret detection tool
- **GitHub Secret Scanning** - Built into GitHub

## Key Takeaways

1. **Secrets are high-value targets** - Treat them with appropriate care
2. **Short-lived beats long-lived** - Dynamic secrets reduce risk
3. **Audit everything** - You can't respond to what you can't see
4. **Automate rotation** - Manual rotation doesn't scale
5. **Segregate environments** - Production secrets are special
