---
title: 'Public Key Infrastructure (PKI)'
description: 'Understand how PKI establishes trust through certificate authorities, trust chains, and certificate lifecycle management.'
order: 4
---

Public Key Infrastructure (PKI) is the framework that makes digital certificates trustworthy. Without PKI, anyone could create a certificate claiming to be "google.com" - PKI solves the problem of verifying that a certificate actually belongs to who it claims to represent.

PKI answers the fundamental question: **How do I trust a public key I have never seen before?**

## The Trust Problem

Imagine you visit `https://bank.com`. The server presents a certificate with a public key. How do you know:

1. This certificate really belongs to bank.com?
2. It was not created by an attacker?
3. It has not been revoked or tampered with?

PKI solves this through a **hierarchy of trust** - trusted third parties (Certificate Authorities) vouch for certificate authenticity.

## PKI Components

| Component | Role | Example |
|-----------|------|--------|
| **Root CA** | Ultimate trust anchor, signs intermediate CAs | DigiCert, Let's Encrypt |
| **Intermediate CA** | Issues certificates, signed by Root CA | Let's Encrypt R3 |
| **End-Entity Certificate** | Your server's certificate | `CN=example.com` |
| **Certificate Revocation List (CRL)** | List of revoked certificates | `http://crl.ca.com/revoked.crl` |
| **OCSP Responder** | Real-time revocation status | `http://ocsp.ca.com` |

## How Trust Chains Work

```
[Root CA Certificate]        <- Pre-installed in browsers/OS
         |
         | signs
         v
[Intermediate CA Certificate] <- Downloaded with your cert
         |
         | signs
         v
[Your Server Certificate]     <- Proves you are example.com
```

### Why Intermediate CAs?

1. **Security**: Root CA private key stays offline (air-gapped)
2. **Damage Containment**: Compromised intermediate can be revoked without revoking root
3. **Operational Flexibility**: Different intermediates for different purposes

### Validating a Certificate Chain

```bash
# Download and examine the full chain
openssl s_client -connect example.com:443 -showcerts </dev/null 2>/dev/null | \
  grep -E "subject|issuer"

# Output shows the chain:
# subject=CN = example.com
# issuer=C = US, O = Let's Encrypt, CN = R3
# subject=C = US, O = Let's Encrypt, CN = R3
# issuer=C = US, O = Internet Security Research Group, CN = ISRG Root X1
```

```python
import ssl
import socket

def get_certificate_chain(hostname: str, port: int = 443) -> list:
    """Retrieve the certificate chain from a server."""
    context = ssl.create_default_context()
    
    with socket.create_connection((hostname, port)) as sock:
        with context.wrap_socket(sock, server_hostname=hostname) as ssock:
            # Get the certificate chain
            cert = ssock.getpeercert()
            chain = ssock.getpeercert(binary_form=False)
            
            return {
                'subject': dict(x[0] for x in cert['subject']),
                'issuer': dict(x[0] for x in cert['issuer']),
                'valid_from': cert['notBefore'],
                'valid_until': cert['notAfter'],
                'san': cert.get('subjectAltName', []),
            }

# Example
chain = get_certificate_chain('example.com')
print(f"Subject: {chain['subject']}")
print(f"Issuer: {chain['issuer']}")
```

## Trust Stores

Trust stores are collections of trusted root CA certificates. Your browser/OS comes with pre-installed root certificates.

### System Trust Stores

| System | Location |
|--------|----------|
| **Linux (Debian/Ubuntu)** | `/etc/ssl/certs/ca-certificates.crt` |
| **Linux (RHEL/CentOS)** | `/etc/pki/tls/certs/ca-bundle.crt` |
| **macOS** | Keychain Access app |
| **Windows** | Certificate Manager (`certmgr.msc`) |
| **Node.js** | Built-in or `NODE_EXTRA_CA_CERTS` env var |
| **Python** | `certifi` package or system certs |
| **Java** | `$JAVA_HOME/lib/security/cacerts` |

### Adding Custom CA Certificates

```bash
# Linux (Debian/Ubuntu)
sudo cp my-ca.crt /usr/local/share/ca-certificates/
sudo update-ca-certificates

# Linux (RHEL/CentOS)
sudo cp my-ca.crt /etc/pki/ca-trust/source/anchors/
sudo update-ca-trust

# Docker - add during build
COPY my-ca.crt /usr/local/share/ca-certificates/
RUN update-ca-certificates

# Kubernetes - mount as secret
apiVersion: v1
kind: Pod
spec:
  containers:
    - name: app
      volumeMounts:
        - name: ca-cert
          mountPath: /etc/ssl/certs/my-ca.crt
          subPath: my-ca.crt
  volumes:
    - name: ca-cert
      secret:
        secretName: custom-ca-cert
```

## Certificate Revocation

When a certificate's private key is compromised, the certificate must be revoked. PKI provides two mechanisms:

### Certificate Revocation Lists (CRLs)

```bash
# Find CRL distribution point in certificate
openssl x509 -in cert.pem -noout -text | grep -A 2 "CRL Distribution"

# Download and examine CRL
curl -O http://crl.example.com/ca.crl
openssl crl -in ca.crl -inform DER -text -noout
```

**Drawbacks of CRLs:**
- Can become large (millions of entries)
- Must download entire list
- Cached, so revocations are not immediate

### Online Certificate Status Protocol (OCSP)

```bash
# Check certificate status via OCSP
openssl ocsp -issuer chain.pem -cert server.pem \
  -url http://ocsp.example.com -resp_text

# Response will show:
# Cert Status: good (or revoked)
```

**OCSP Stapling** - Server pre-fetches OCSP response and sends it with certificate:

```nginx
# Nginx OCSP stapling
ssl_stapling on;
ssl_stapling_verify on;
ssl_trusted_certificate /path/to/chain.pem;
resolver 8.8.8.8 8.8.4.4 valid=300s;
```

## Certificate Lifecycle

```
1. Key Generation     2. CSR Creation     3. CA Signing      4. Deployment
    [Private Key] --> [CSR] -----------> [Certificate] --> [Server]
                           Submit to CA     CA validates
                                           and signs
                                           
5. Monitoring         6. Renewal          7. Revocation (if needed)
   [Check expiry] --> [New cert] ----or-- [CRL/OCSP update]
```

### Automating Certificate Lifecycle

```yaml
# cert-manager for Kubernetes
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: app-cert
  namespace: production
spec:
  secretName: app-tls
  duration: 2160h    # 90 days
  renewBefore: 360h  # Renew 15 days before expiry
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
    - app.example.com
    - api.example.com
```

```python
# Certificate monitoring script
import ssl
import socket
from datetime import datetime
import smtplib
from email.message import EmailMessage

def check_cert_expiry(hostname: str) -> int:
    """Return days until certificate expires."""
    context = ssl.create_default_context()
    
    with socket.create_connection((hostname, 443)) as sock:
        with context.wrap_socket(sock, server_hostname=hostname) as ssock:
            cert = ssock.getpeercert()
            not_after = datetime.strptime(
                cert['notAfter'], 
                '%b %d %H:%M:%S %Y %Z'
            )
            return (not_after - datetime.utcnow()).days

def alert_expiring_certs(domains: list, threshold_days: int = 30):
    """Alert on certificates expiring soon."""
    expiring = []
    
    for domain in domains:
        try:
            days = check_cert_expiry(domain)
            if days < threshold_days:
                expiring.append((domain, days))
        except Exception as e:
            expiring.append((domain, f"ERROR: {e}"))
    
    if expiring:
        print("Certificates expiring soon:")
        for domain, days in expiring:
            print(f"  {domain}: {days} days")
        # Send alert email, Slack notification, etc.

# Monitor your domains
domains = [
    'example.com',
    'api.example.com',
    'admin.example.com'
]
alert_expiring_certs(domains, threshold_days=30)
```

## Building a Private PKI

For internal services, you may want your own Certificate Authority:

### Creating a Root CA

```bash
# Generate Root CA private key (keep this VERY secure)
openssl genrsa -aes256 -out root-ca.key 4096

# Create Root CA certificate (valid 10 years)
openssl req -x509 -new -nodes -key root-ca.key \
  -sha256 -days 3650 \
  -out root-ca.crt \
  -subj "/C=US/ST=State/L=City/O=MyOrg/CN=MyOrg Root CA"
```

### Creating an Intermediate CA

```bash
# Generate Intermediate CA key
openssl genrsa -aes256 -out intermediate-ca.key 4096

# Create CSR for Intermediate CA
openssl req -new -key intermediate-ca.key \
  -out intermediate-ca.csr \
  -subj "/C=US/ST=State/L=City/O=MyOrg/CN=MyOrg Intermediate CA"

# Sign Intermediate CA with Root CA (valid 5 years)
openssl x509 -req -in intermediate-ca.csr \
  -CA root-ca.crt -CAkey root-ca.key \
  -CAcreateserial -days 1825 -sha256 \
  -extfile <(echo "basicConstraints=critical,CA:TRUE,pathlen:0") \
  -out intermediate-ca.crt
```

### Issuing End-Entity Certificates

```bash
# Generate server key
openssl genrsa -out server.key 2048

# Create CSR
openssl req -new -key server.key \
  -out server.csr \
  -subj "/CN=internal.example.com"

# Sign with Intermediate CA
openssl x509 -req -in server.csr \
  -CA intermediate-ca.crt -CAkey intermediate-ca.key \
  -CAcreateserial -days 365 -sha256 \
  -extfile <(echo -e "subjectAltName=DNS:internal.example.com,DNS:*.internal.example.com") \
  -out server.crt

# Create full chain
cat server.crt intermediate-ca.crt > server-fullchain.crt
```

### HashiCorp Vault as Private CA

```bash
# Enable PKI secrets engine
vault secrets enable pki

# Configure maximum TTL
vault secrets tune -max-lease-ttl=87600h pki

# Generate root certificate
vault write pki/root/generate/internal \
  common_name="MyOrg Root CA" \
  ttl=87600h

# Enable intermediate PKI
vault secrets enable -path=pki_int pki
vault secrets tune -max-lease-ttl=43800h pki_int

# Create intermediate CA (signed by root)
vault write pki_int/intermediate/generate/internal \
  common_name="MyOrg Intermediate CA"

# Create a role for issuing certificates
vault write pki_int/roles/internal-servers \
  allowed_domains="internal.example.com" \
  allow_subdomains=true \
  max_ttl=720h

# Issue a certificate
vault write pki_int/issue/internal-servers \
  common_name="app.internal.example.com" \
  ttl=24h
```

## PKI Security Best Practices

### 1. Protect Private Keys

```bash
# Set restrictive permissions
chmod 600 private-key.pem
chown root:root private-key.pem

# Use Hardware Security Modules (HSMs) for CA keys
# AWS CloudHSM, Azure Dedicated HSM, or physical HSMs
```

### 2. Use Short Certificate Lifetimes

```yaml
# Modern best practices
recommended_lifetimes:
  root_ca: 10-20 years  # Rarely rotated
  intermediate_ca: 3-5 years
  server_certificates: 90 days  # Let's Encrypt default
  client_certificates: 24-72 hours  # For automated systems
```

### 3. Implement Certificate Transparency

Certificate Transparency (CT) logs provide public audit trails:

```bash
# Check if certificate is in CT logs
curl "https://crt.sh/?q=example.com&output=json" | jq
```

### 4. Monitor for Unauthorized Certificates

```python
import requests
import json

def check_ct_logs(domain: str) -> list:
    """Check Certificate Transparency logs for a domain."""
    url = f"https://crt.sh/?q={domain}&output=json"
    response = requests.get(url)
    
    if response.status_code == 200:
        certs = response.json()
        return [
            {
                'issuer': cert['issuer_name'],
                'not_before': cert['not_before'],
                'not_after': cert['not_after'],
            }
            for cert in certs[:10]  # Last 10 certificates
        ]
    return []

# Alert on unexpected certificates
certs = check_ct_logs('example.com')
for cert in certs:
    print(f"Cert issued by {cert['issuer']} on {cert['not_before']}")
```

## PKI in DevOps Contexts

### Service Mesh Certificate Management

```yaml
# Istio automatic mTLS with cert rotation
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
spec:
  mtls:
    mode: STRICT

# Certificates automatically:
# - Generated by Istio CA (istiod)
# - Rotated every 24 hours
# - Distributed to sidecars
```

### Container Image Signing

```bash
# Sign container images with cosign (Sigstore)
cosign generate-key-pair
cosign sign --key cosign.key myregistry/myimage:v1.0

# Verify signature
cosign verify --key cosign.pub myregistry/myimage:v1.0

# Keyless signing with Fulcio CA
cosign sign myregistry/myimage:v1.0  # Uses OIDC identity
```

### Git Commit Signing

```bash
# Generate GPG key
gpg --full-generate-key

# Configure Git to sign commits
git config --global user.signingkey YOUR_KEY_ID
git config --global commit.gpgsign true

# Sign a commit
git commit -S -m "Signed commit"

# Verify signatures
git log --show-signature
```

## Common PKI Issues

### 1. "Certificate Not Trusted"

```bash
# Check if root CA is in trust store
openssl verify -CAfile /etc/ssl/certs/ca-certificates.crt cert.pem

# Solutions:
# - Add CA to system trust store
# - Include full chain in server config
# - Update ca-certificates package
```

### 2. "Certificate Has Expired"

```bash
# Check certificate dates
openssl x509 -in cert.pem -noout -dates

# Check system time (NTP issues)
date
timedatectl status
```

### 3. "Hostname Mismatch"

```bash
# Check certificate SANs
openssl x509 -in cert.pem -noout -ext subjectAltName

# Ensure connecting hostname matches CN or SAN entry
```

## Summary

Key takeaways for PKI:

- **Trust chains** establish authenticity - certificates are trusted because they chain to a trusted root CA
- **Root CAs stay offline** - intermediates issue day-to-day certificates
- **Revocation matters** - use OCSP stapling for real-time status
- **Automate lifecycle** - tools like cert-manager prevent expiration outages
- **Private PKI** for internal services - HashiCorp Vault or manual CA setup
- **Short lifetimes** reduce exposure - 90 days or less for server certs
- **Monitor CT logs** - detect unauthorized certificate issuance

This concludes the Cryptography Essentials guide. You now understand the building blocks of secure systems: encryption protects confidentiality, hashing ensures integrity, TLS secures data in transit, and PKI establishes trust.
