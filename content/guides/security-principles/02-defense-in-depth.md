---
title: 'Defense in Depth'
description: 'Learn how to implement layered security strategies to protect your infrastructure from multiple attack vectors.'
order: 2
---

Defense in Depth is a security strategy that employs multiple layers of security controls throughout your infrastructure. If one layer fails, others remain to protect your assets. Think of it like a medieval castle with moats, walls, towers, and guards—each layer adds protection.

## The Layered Security Model

Defense in Depth typically consists of these layers:

```
+-------------------------------------------+
|           Physical Security               |
|  +-------------------------------------+  |
|  |        Network Security             |  |
|  |  +-------------------------------+  |  |
|  |  |       Host Security           |  |  |
|  |  |  +-------------------------+  |  |  |
|  |  |  |  Application Security   |  |  |  |
|  |  |  |  +-------------------+  |  |  |  |
|  |  |  |  |   Data Security   |  |  |  |  |
|  |  |  |  +-------------------+  |  |  |  |
|  |  |  +-------------------------+  |  |  |
|  |  +-------------------------------+  |  |
|  +-------------------------------------+  |
+-------------------------------------------+
```

Each layer provides independent protection, so an attacker must bypass multiple defenses to reach your critical assets.

## Layer 1: Physical Security

Physical security protects the hardware and facilities that house your systems.

### Cloud Considerations

When using cloud providers, physical security is largely their responsibility:

- Data center access controls
- Biometric authentication
- 24/7 surveillance
- Environmental controls

### On-Premises Considerations

For on-premises infrastructure:

```bash
# Physical security checklist
- [ ] Locked server rooms with access logs
- [ ] Security cameras at entry points
- [ ] Badge access systems
- [ ] Visitor sign-in procedures
- [ ] Hardware asset tracking
- [ ] Secure disposal of old equipment
```

## Layer 2: Network Security

Network security controls traffic flow and prevents unauthorized network access.

### Firewalls and Security Groups

Security groups act as virtual firewalls for your cloud resources. The key principle is **default deny**: block everything, then explicitly allow only what's needed. This is the opposite of how many people configure them (allow everything, then try to block bad traffic).

AWS Security Groups are stateful, meaning if you allow inbound traffic on a port, the response traffic is automatically allowed outbound.

```bash
# AWS Security Group - Web Server
aws ec2 create-security-group \
  --group-name web-server-sg \
  --description "Web server security group"

# Allow only necessary ports
aws ec2 authorize-security-group-ingress \
  --group-name web-server-sg \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0
# Only allowing HTTPS (443) from any IP
# SSH should be restricted to specific IPs or use bastion hosts

# Deny all other inbound by default
# Security groups have implicit deny - no need to add deny rules
```

**Common mistakes:**
- Opening SSH (22) to 0.0.0.0/0 (the entire internet)
- Using overly broad CIDR ranges when specific IPs are known
- Leaving test rules in place after debugging

### Network Segmentation

Network segmentation divides your infrastructure into isolated zones. If an attacker compromises one zone, they can't easily move to others. Think of it like compartments in a ship—a breach in one compartment doesn't sink the whole vessel.

**A typical three-tier architecture:**
1. **Public subnet (DMZ)**: Load balancers, bastion hosts—minimal attack surface exposed to internet
2. **Private app subnet**: Application servers—can receive traffic from public subnet only
3. **Private data subnet**: Databases—can only be accessed from app subnet

```hcl
# Terraform: Create separate subnets
resource "aws_subnet" "public" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = "us-east-1a"
  
  tags = {
    Name = "Public Subnet"
    Tier = "DMZ"  # Demilitarized Zone - exposed to internet
  }
}

resource "aws_subnet" "private_app" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = "us-east-1a"
  
  tags = {
    Name = "Private App Subnet"
    Tier = "Application"  # No direct internet access
  }
}

resource "aws_subnet" "private_db" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.3.0/24"
  availability_zone = "us-east-1a"
  
  tags = {
    Name = "Private DB Subnet"
    Tier = "Database"  # Most restricted - only app servers can connect
  }
}
```

**Note:** Each tier should have its own security groups and network ACLs. The database subnet should have no route to the internet gateway.

### Kubernetes Network Policies

By default, Kubernetes allows all pods to communicate with each other. This is convenient but dangerous—a compromised pod can attack any other pod in the cluster. Network Policies let you implement micro-segmentation within Kubernetes.

**Start with a deny-all policy**, then explicitly allow required communication paths:

```yaml
# Deny all ingress by default
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: production
spec:
  podSelector: {}
  policyTypes:
  - Ingress

---
# Allow specific traffic
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-web-to-api
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: api
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: web
    ports:
    - protocol: TCP
      port: 8080
```

## Layer 3: Host Security

Host security hardens the operating system and server configuration. Even if an attacker bypasses network security, a properly hardened host makes exploitation much more difficult. The goal is to reduce the attack surface and detect intrusions quickly.

### OS Hardening

Every service running on a system is a potential attack vector. The principle of **minimal installation** means removing or disabling anything not strictly required.

```bash
# Disable unnecessary services
# Each disabled service = one less potential vulnerability
systemctl disable bluetooth
systemctl disable cups
systemctl disable avahi-daemon

# Remove unnecessary packages
# telnet and ftp transmit credentials in plain text - never use them
apt purge telnet ftp

# Enable automatic security updates
# Critical for patching known vulnerabilities quickly
apt install unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
```

**Additional hardening steps:**
- Enable SELinux or AppArmor for mandatory access controls
- Configure kernel parameters in `/etc/sysctl.conf` (disable IP forwarding, enable syn cookies)
- Implement disk encryption for data at rest

### SSH Hardening

SSH is often the primary remote access method, making it a prime target. These settings significantly reduce the risk of unauthorized access:

```bash
# /etc/ssh/sshd_config
PermitRootLogin no           # Force use of regular accounts, then sudo
PasswordAuthentication no    # Passwords can be brute-forced; keys cannot
PubkeyAuthentication yes     # Only allow SSH key authentication
MaxAuthTries 3               # Lock out after 3 failed attempts
ClientAliveInterval 300      # Disconnect idle sessions after 5 minutes
ClientAliveCountMax 2        # Allow 2 missed keepalives before disconnect
AllowUsers deploy admin      # Whitelist specific users who can SSH
Protocol 2                   # SSH v1 has known vulnerabilities
```

**After making changes:** Run `sshd -t` to test the configuration, then `systemctl restart sshd`. Keep an existing session open while testing to avoid locking yourself out!

### Host-Based Intrusion Detection

AIDE (Advanced Intrusion Detection Environment) creates a database of file checksums and permissions. Any unauthorized changes trigger alerts. This catches malware, rootkits, and unauthorized configuration changes.

```bash
# Install and configure AIDE
apt install aide

# Initialize database
aideinit
# This creates a baseline of all system files

# Check for changes
aide --check
# Compares current state to baseline and reports any modifications
```

**Important:** AIDE alerts on legitimate changes too (system updates, config changes). Update the baseline after authorized changes with `aide --update`.

## Layer 4: Application Security

Application security protects your code and runtime environment. This layer is where developers have the most direct control—and where many breaches originate. Input validation, secure coding practices, and runtime protection all live here.

### Secure Coding Practices

**SQL Injection** remains one of the most dangerous vulnerabilities (consistently in OWASP Top 10). It occurs when user input is directly concatenated into database queries, allowing attackers to execute arbitrary SQL commands.

The fix is simple: **always use parameterized queries**. The database driver handles escaping, making injection impossible.

```python
# Bad: SQL Injection vulnerability
# An attacker could input: 1; DROP TABLE users; --
query = f"SELECT * FROM users WHERE id = {user_input}"

# Good: Parameterized query
# User input is treated as data, never as SQL code
cursor.execute("SELECT * FROM users WHERE id = %s", (user_input,))
```

**This applies to all languages:** Use prepared statements (Java), parameterized queries (Python, Go), or ORM methods (Django, Rails) that handle escaping automatically.

### Container Security

Containers provide isolation, but a misconfigured container can expose your entire system. These practices create defense in depth within your container:

```dockerfile
# Use minimal base image
# Alpine is ~5MB vs ~100MB+ for full Ubuntu
# Smaller image = smaller attack surface
FROM alpine:3.18

# Run as non-root user
# If the container is compromised, attacker has limited privileges
RUN addgroup -g 1000 appgroup && \
    adduser -u 1000 -G appgroup -D appuser

# Copy only necessary files
# Don't copy source code, dev dependencies, or secrets
COPY --chown=appuser:appgroup ./app /app

USER appuser

# Use read-only filesystem where possible
# Prevents attackers from modifying files or installing malware
```

**Additional container security measures:**
- Scan images for vulnerabilities (Trivy, Snyk, Clair)
- Use distroless images for even smaller attack surface
- Implement resource limits to prevent DoS
- Never run containers with `--privileged`

### Web Application Firewall (WAF)

A WAF inspects HTTP traffic and blocks malicious requests before they reach your application. It's your last line of defense for common web attacks like SQL injection, XSS, and path traversal.

**WAFs work best as part of defense in depth**—they catch attacks that slip past other controls, but shouldn't be your only protection.

```yaml
# AWS WAF rule example
Rules:
  - Name: SQLInjectionRule
    Priority: 1  # Lower number = evaluated first
    Action:
      Block: {}  # Block matching requests; could also use Count for monitoring
    Statement:
      SqliMatchStatement:
        FieldToMatch:
          Body: {}  # Inspect request body for SQL injection patterns
        TextTransformations:
          - Priority: 0
            Type: URL_DECODE  # Decode URL-encoded attacks before inspection
```

**Start with managed rule sets** (AWS Managed Rules, OWASP Core Rule Set) and customize based on your application's specific needs and false positives.

## Layer 5: Data Security

Data security protects your most valuable asset—the data itself. If attackers breach all other layers, encryption ensures they still can't read sensitive information. This layer is your final defense.

### Encryption at Rest

Encryption at rest protects data stored on disks, databases, and backups. Even if someone steals a hard drive or gains unauthorized access to storage, they can't read the data without the encryption key.

**AWS KMS (Key Management Service)** handles key management, rotation, and access control:

```bash
# Encrypt EBS volumes
aws ec2 create-volume \
  --availability-zone us-east-1a \
  --size 100 \
  --encrypted \
  --kms-key-id alias/my-key  # Use your own KMS key for full control

# Encrypt S3 bucket
aws s3api put-bucket-encryption \
  --bucket my-bucket \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "aws:kms",
        "KMSMasterKeyID": "alias/my-key"  # All new objects auto-encrypted
      }
    }]
  }'
```

**Tip:** Enable default encryption at the account/organization level so new resources are automatically encrypted.

### Encryption in Transit

Encryption in transit (TLS/HTTPS) protects data as it moves between systems. Without it, anyone on the network path can read the traffic—including credentials, API keys, and sensitive data.

**Force HTTPS everywhere** with redirects and HSTS (HTTP Strict Transport Security):

```yaml
# Kubernetes: Enforce TLS
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: secure-ingress
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"  # Redirect HTTP to HTTPS
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"  # Even for X-Forwarded-Proto
spec:
  tls:
  - hosts:
    - myapp.example.com
    secretName: tls-secret  # Kubernetes secret containing TLS certificate
```

**Also encrypt internal traffic** (service-to-service). Use mTLS (mutual TLS) in Kubernetes with service mesh like Istio or Linkerd.

### Data Classification

Classify data by sensitivity:

| Classification | Examples | Controls |
|----------------|----------|----------|
| Public | Marketing materials | Basic access controls |
| Internal | Employee directory | Authentication required |
| Confidential | Financial reports | Encryption + access logs |
| Restricted | PII, credentials | Encryption + strict access + audit |

## Implementing Defense in Depth

### Step 1: Identify Your Assets

```bash
# Create an asset inventory
Asset Type       | Location        | Sensitivity | Owner
-----------------|-----------------|--------------|---------
Customer DB      | AWS RDS         | Restricted   | Data Team
Web Application  | EKS Cluster     | Confidential | Dev Team
Log Storage      | S3 Bucket       | Internal     | SRE Team
```

### Step 2: Map Attack Vectors

For each asset, identify potential attack paths:

```
Customer Database Attack Vectors:
1. SQL Injection → Application Layer
2. Stolen Credentials → Network Layer
3. Insider Threat → Host Layer
4. Physical Access → Physical Layer
```

### Step 3: Implement Controls at Each Layer

```yaml
# Security controls matrix
Customer Database:
  Physical:
    - AWS manages data center security
    - Multi-AZ deployment
  Network:
    - Private subnet only
    - Security groups: app servers only
    - No public IP
  Host:
    - Managed RDS (AWS handles patching)
    - Encryption enabled
  Application:
    - Parameterized queries
    - Input validation
    - ORM usage
  Data:
    - Encryption at rest (KMS)
    - Encryption in transit (TLS)
    - Regular backups
```

## Key Takeaways

- Defense in Depth uses multiple independent security layers
- No single control should be a single point of failure
- Each layer should be able to detect and respond to attacks
- Regularly test each layer independently and together
- Document your controls and review them periodically

## Practice Exercise

Map your current infrastructure's defense layers:

1. Draw your network architecture
2. Identify the security controls at each layer
3. Find gaps where a single control failure could lead to compromise
4. Propose additional controls to address the gaps
