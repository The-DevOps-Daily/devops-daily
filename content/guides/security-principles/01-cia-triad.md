---
title: 'The CIA Triad'
description: 'Understanding Confidentiality, Integrity, and Availability - the three pillars of information security.'
order: 1
---

The CIA Triad is the cornerstone of information security. It provides a framework for thinking about security controls and helps you make decisions about protecting your systems and data. Every security measure you implement should address one or more of these three principles.

## What is the CIA Triad?

The CIA Triad consists of three fundamental principles:

- **Confidentiality**: Ensuring information is accessible only to authorized individuals
- **Integrity**: Ensuring information is accurate and hasn't been tampered with
- **Availability**: Ensuring information and systems are accessible when needed

These three principles often create tension with each other. For example, making data highly available might reduce confidentiality, or strong integrity checks might impact availability. Good security architecture balances all three.

## Confidentiality

Confidentiality ensures that sensitive information is protected from unauthorized access. This is about keeping secrets secret.

### Threats to Confidentiality

- **Data breaches**: Unauthorized access to databases or file systems
- **Man-in-the-middle attacks**: Intercepting data in transit
- **Social engineering**: Tricking users into revealing information
- **Improper access controls**: Overly permissive permissions

### Controls for Confidentiality

#### Encryption

Encryption transforms readable data into unreadable ciphertext that can only be decrypted with the correct key. This is your primary defense against data theft—even if attackers get access to your files or intercept network traffic, they can't read encrypted data without the decryption key.

**Encrypting files at rest** protects data stored on disks. GPG (GNU Privacy Guard) is a widely-used tool for file encryption:

```bash
# Encrypt a file with GPG
gpg --symmetric --cipher-algo AES256 sensitive-data.txt
# This creates sensitive-data.txt.gpg - the original remains unencrypted
# Use --armor flag to create ASCII output for email/text transmission

# Encrypt data in transit with TLS
openssl s_client -connect example.com:443
# This tests the TLS connection and shows certificate details
```

**Why AES256?** AES (Advanced Encryption Standard) with 256-bit keys is considered secure against brute-force attacks. Even with all the world's computing power, breaking AES-256 would take longer than the age of the universe.

#### Access Controls

File permissions are your first line of defense on any Unix/Linux system. They control who can read, write, or execute files. Understanding and properly configuring these permissions prevents unauthorized access to sensitive data.

The permission system uses three categories: **owner** (u), **group** (g), and **others** (o). Each category can have **read** (4), **write** (2), and **execute** (1) permissions.

```bash
# Restrict file access to owner only
chmod 600 /path/to/sensitive-file
# 600 = owner can read/write (6), group and others have no access (0,0)

# Set restrictive directory permissions
chmod 700 /path/to/sensitive-directory
# 700 = owner has full access (7), no access for group/others
# The execute bit on directories means "can enter/list contents"
```

**Common permission mistakes:**
- Setting 777 (world-writable) on any file or directory
- Leaving sensitive configs readable by all users (644 instead of 600)
- Not checking permissions after extracting archives

#### Secrets Management

Hardcoded secrets are one of the most common security vulnerabilities. When secrets are in your code, they end up in version control, logs, error messages, and eventually in the hands of attackers. Instead, use a secrets manager that provides centralized storage, access control, and audit logging.

```yaml
# Bad: Hardcoded secret
# This will end up in Git history forever, even if you delete it later
database_password: "mysecretpassword"

# Good: Reference from secrets manager
# The actual secret is stored securely and retrieved at runtime
database_password: ${vault:database/credentials#password}
```

**Popular secrets managers include:**
- **HashiCorp Vault**: Self-hosted, feature-rich, great for enterprises
- **AWS Secrets Manager**: Managed service with automatic rotation
- **Azure Key Vault**: Microsoft's managed secrets service
- **SOPS**: Encrypts secrets in files, works with Git

### Real-World Example: Protecting API Keys

Let's walk through a complete example of securely retrieving and using an API key. This pattern keeps secrets out of your codebase and environment files:

```bash
# Retrieve the secret from Vault at runtime
# This creates a short-lived environment variable only for this session
export API_KEY=$(vault kv get -field=api_key secret/myapp)

# Use the API key in your application
# The key never touches disk or appears in your command history
curl -H "Authorization: Bearer $API_KEY" https://api.example.com/data

# For production applications, inject secrets via:
# - Kubernetes Secrets (mounted as files or env vars)
# - AWS Parameter Store with IAM-based access
# - HashiCorp Vault Agent sidecar
```

**Security tip:** Avoid using `export` in shell scripts that might be logged. Instead, pass secrets directly to commands or use process substitution.

## Integrity

Integrity ensures that data remains accurate, complete, and trustworthy throughout its lifecycle. This means preventing unauthorized modifications and detecting when changes occur.

### Threats to Integrity

- **Unauthorized modifications**: Attackers changing data or code
- **Accidental changes**: Human error corrupting data
- **Malware**: Software that modifies files or data
- **Man-in-the-middle attacks**: Altering data in transit

### Controls for Integrity

#### Checksums and Hashes

Cryptographic hash functions create a unique "fingerprint" of a file. Even a single bit change produces a completely different hash. This lets you verify that files haven't been tampered with during download, storage, or transfer.

**SHA-256** (Secure Hash Algorithm with 256-bit output) is the current standard. Older algorithms like MD5 and SHA-1 have known vulnerabilities and should be avoided for security purposes.

```bash
# Generate SHA256 checksum
sha256sum important-file.tar.gz > checksum.txt
# Output looks like: 3a7bd3e2f1c8... important-file.tar.gz

# Verify checksum later
sha256sum -c checksum.txt
# important-file.tar.gz: OK
# If the file was modified, you'll see: FAILED
```

**When to use checksums:**
- After downloading software (compare with publisher's checksum)
- Before and after transferring files between systems
- As part of backup verification processes
- In CI/CD pipelines to verify artifact integrity

#### Digital Signatures

While checksums verify integrity, they don't prove who created the file. Digital signatures solve this by combining the hash with cryptographic keys. A signature proves both integrity (the file hasn't changed) and authenticity (it came from the expected source).

```bash
# Sign a file with GPG
gpg --armor --detach-sign release.tar.gz
# Creates release.tar.gz.asc containing the signature

# Verify the signature
gpg --verify release.tar.gz.asc release.tar.gz
# Shows: Good signature from "Developer Name <dev@example.com>"
```

**Important:** Verification only works if you trust the public key. Always verify key fingerprints through a trusted channel.

#### Git Commit Signing

Unsigned Git commits only show who *claims* to have made them. Anyone can impersonate another developer. Signed commits cryptographically prove the author's identity, which is critical for compliance and detecting compromised accounts.

```bash
# Configure Git to sign commits
git config --global commit.gpgsign true
git config --global user.signingkey YOUR_GPG_KEY_ID
# Find your key ID with: gpg --list-secret-keys --keyid-format LONG

# Sign a commit
git commit -S -m "Add new feature"

# Verify signed commits
git log --show-signature
# Shows "Good signature from..." for verified commits
```

**GitHub and GitLab** display a "Verified" badge on signed commits, helping reviewers trust that commits are authentic.

### Real-World Example: Container Image Verification

Container images are a prime target for supply chain attacks. An attacker who compromises your registry can replace legitimate images with malicious ones. Image signing lets you verify that images haven't been tampered with before deploying them.

**Cosign** (part of the Sigstore project) is the modern standard for container image signing:

```bash
# Sign container images with cosign
cosign sign --key cosign.key myregistry.io/myapp:v1.0.0
# This attaches a signature to the image in the registry

# Verify before deployment
cosign verify --key cosign.pub myregistry.io/myapp:v1.0.0
# Fails if signature doesn't match or is missing
```

**In Kubernetes**, you can enforce image verification using admission controllers like Kyverno or OPA Gatekeeper, blocking any unsigned images from being deployed.

## Availability

Availability ensures that systems and data are accessible when authorized users need them. Downtime can be just as damaging as a security breach.

### Threats to Availability

- **DDoS attacks**: Overwhelming systems with traffic
- **Hardware failures**: Disk crashes, power outages
- **Software bugs**: Crashes and memory leaks
- **Ransomware**: Encrypting data and demanding payment

### Controls for Availability

#### Redundancy and Failover

The key to availability is eliminating single points of failure. If any single component can take down your entire system, you need redundancy. This applies to servers, databases, network connections, and even data centers.

**Kubernetes** makes redundancy easy by allowing you to run multiple replicas of your application. If one pod fails, traffic automatically routes to healthy pods:

```yaml
# Kubernetes deployment with replicas
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
spec:
  replicas: 3  # Run 3 identical copies for redundancy
  selector:
    matchLabels:
      app: web-app
  template:
    spec:
      containers:
      - name: web
        image: myapp:latest
        resources:  # Resource limits prevent one pod from starving others
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
```

**Why 3 replicas?** With 3 replicas, you can lose 1 pod and still have 2 handling traffic. This also allows for rolling updates without downtime. For critical services, consider 5+ replicas spread across availability zones.

#### Backup Strategies

Backups are your last line of defense against data loss. The **3-2-1 backup rule** is an industry standard that has saved countless organizations from disasters:

- **3** copies of your data (production + 2 backups)
- **2** different storage media (e.g., disk + cloud)
- **1** copy offsite (protects against site-wide disasters)

```bash
# Example: Backup to S3 with versioning
aws s3 sync /data s3://my-backup-bucket/data --delete
# --delete removes files from S3 that no longer exist locally
# Be careful: this can delete good backups if local data is corrupted!

# Enable versioning for recovery
aws s3api put-bucket-versioning \
  --bucket my-backup-bucket \
  --versioning-configuration Status=Enabled
# Versioning keeps previous versions even after overwrites or deletes
# Critical for recovering from ransomware or accidental deletions
```

**Backup testing is essential.** Untested backups are not backups. Schedule regular restore drills to verify your backups actually work.

#### DDoS Protection

Distributed Denial of Service (DDoS) attacks flood your systems with traffic, making them unavailable to legitimate users. Defense requires multiple layers:

```bash
# Rate limiting with iptables
iptables -A INPUT -p tcp --dport 80 \
  -m connlimit --connlimit-above 50 -j DROP
# Limits each IP to 50 concurrent connections
# Legitimate users rarely need more than a few connections

# Use a WAF or CDN for additional protection
# Services like Cloudflare, AWS WAF, or Akamai can absorb
# large-scale attacks before traffic reaches your servers
```

**Rate limiting alone isn't enough** for serious DDoS attacks. Large attacks can exceed hundreds of gigabits per second—more than most organizations can handle. Cloud-based DDoS protection services have the capacity to absorb these attacks.

### Real-World Example: Health Checks

Health checks let orchestration systems (like Kubernetes) automatically detect and replace unhealthy instances. This turns manual incident response into automatic self-healing.

**Two types of probes:**
- **Liveness probe**: Is the application running? If it fails, Kubernetes restarts the container.
- **Readiness probe**: Can the application handle traffic? If it fails, the pod is removed from the load balancer but not restarted.

```yaml
# Kubernetes liveness and readiness probes
livenessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 10  # Wait 10s before first check (app startup time)
  periodSeconds: 5         # Check every 5 seconds
  failureThreshold: 3      # Restart after 3 consecutive failures
readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  initialDelaySeconds: 5   # Can be ready before liveness starts
  periodSeconds: 3         # Check more frequently for quick traffic routing
```

**Tip:** Your `/health` endpoint should check critical dependencies (database, cache) so the container restarts if something is fundamentally broken. The `/ready` endpoint can be more lenient.

## Balancing the CIA Triad

The three principles often create trade-offs:

| Scenario | Confidentiality | Integrity | Availability | Trade-off |
|----------|-----------------|-----------|--------------|----------|
| Public website | Low | Medium | High | Prioritize uptime over secrecy |
| Banking system | High | High | High | All three critical, highest cost |
| Health records | High | High | Medium | Privacy and accuracy over 24/7 access |
| Internal wiki | Medium | Medium | High | Ease of access for productivity |

### Making Trade-off Decisions

When designing systems, ask:

1. **What data are we protecting?** (Personal, financial, public)
2. **What are the consequences of a breach?** (Legal, reputational, financial)
3. **Who needs access?** (Everyone, authenticated users, specific roles)
4. **What's the acceptable downtime?** (Minutes, hours, days)

## Key Takeaways

- The CIA Triad provides a framework for security decision-making
- **Confidentiality**: Protect sensitive data through encryption and access controls
- **Integrity**: Ensure data accuracy through checksums, signatures, and audit trails
- **Availability**: Maintain uptime through redundancy, backups, and monitoring
- Balance all three based on your specific use case and risk tolerance

## Practice Exercise

Analyze a system you work with:

1. Identify the most critical data it handles
2. Rate its current CIA protection (1-5 for each)
3. Identify one improvement for each principle
4. Consider the trade-offs of implementing those improvements
