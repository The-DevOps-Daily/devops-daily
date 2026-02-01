---
title: 'TLS/SSL Fundamentals'
description: 'Understand how TLS protects data in transit, learn about certificate types, the TLS handshake, and common misconfigurations to avoid.'
order: 3
---

Transport Layer Security (TLS) is the protocol that secures HTTPS, protecting data as it travels between clients and servers. Every time you see the padlock icon in your browser, TLS is encrypting your connection using the cryptographic primitives we covered in previous sections.

TLS is the successor to SSL (Secure Sockets Layer). While "SSL" is still commonly used colloquially, all SSL versions are deprecated and insecure. Modern systems use TLS 1.2 or TLS 1.3.

## How TLS Works: The Big Picture

TLS provides three security properties:

| Property | How TLS Achieves It |
|----------|--------------------|
| **Confidentiality** | Symmetric encryption (AES-GCM) |
| **Integrity** | HMAC / AEAD authentication |
| **Authentication** | Certificates + asymmetric crypto |

The TLS handshake establishes these properties before any application data is exchanged.

## The TLS 1.3 Handshake

TLS 1.3 simplified the handshake from 2 round-trips to 1:

```
Client                                              Server
  |
  |  1. ClientHello
  |     - Supported TLS versions
  |     - Supported cipher suites
  |     - Client random
  |     - Key share (ECDHE public key)
  |-------------------------------------------------->
  |
  |  2. ServerHello + EncryptedExtensions +
  |     Certificate + CertificateVerify + Finished
  |     - Selected cipher suite
  |     - Server random
  |     - Key share (ECDHE public key)
  |     - Certificate chain
  |     - Signature proving key ownership
  |<--------------------------------------------------
  |
  |  3. Finished
  |     - Client confirmation
  |-------------------------------------------------->
  |
  |  [Application Data - Encrypted]
  |<------------------------------------------------->
```

### What Happens During the Handshake

1. **Key Exchange**: Client and server use ECDHE (Elliptic Curve Diffie-Hellman Ephemeral) to derive a shared secret without transmitting it
2. **Authentication**: Server presents certificate; client verifies it chains to a trusted CA
3. **Session Keys**: Both sides derive symmetric encryption keys from the shared secret
4. **Encryption**: All subsequent data encrypted with AES-GCM or ChaCha20-Poly1305

## TLS Versions

| Version | Status | Notes |
|---------|--------|-------|
| **TLS 1.3** | Recommended | Fastest, most secure, 1-RTT handshake |
| **TLS 1.2** | Acceptable | Still secure with proper configuration |
| **TLS 1.1** | Deprecated | Disabled in modern browsers |
| **TLS 1.0** | Deprecated | Vulnerable to BEAST, POODLE |
| **SSL 3.0** | Broken | Never use |
| **SSL 2.0** | Broken | Never use |

### Checking TLS Version

```bash
# Check what TLS version a server supports
openssl s_client -connect example.com:443 -tls1_3

# Test with specific version
curl -v --tls-max 1.2 https://example.com

# Using nmap for comprehensive scan
nmap --script ssl-enum-ciphers -p 443 example.com
```

## Cipher Suites

A cipher suite defines the algorithms used for each TLS function:

```
TLS_AES_256_GCM_SHA384
    |    |    |    |
    |    |    |    +-- Hash for key derivation
    |    |    +------- Authentication mode (GCM = AEAD)
    |    +------------ Key size (256-bit)
    +----------------- Encryption algorithm (AES)
```

### Recommended Cipher Suites (TLS 1.3)

TLS 1.3 only allows secure cipher suites:

```
TLS_AES_256_GCM_SHA384        # AES-256 with GCM
TLS_AES_128_GCM_SHA256        # AES-128 with GCM
TLS_CHACHA20_POLY1305_SHA256  # ChaCha20 (mobile-friendly)
```

### TLS 1.2 Cipher Suite Configuration

```nginx
# Nginx: Strong TLS 1.2 configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
ssl_prefer_server_ciphers on;
```

## Certificates

Certificates are digital documents that bind a public key to an identity. They are signed by Certificate Authorities (CAs) to establish trust.

### Certificate Contents

```bash
# View certificate details
openssl s_client -connect example.com:443 </dev/null 2>/dev/null | \
  openssl x509 -text -noout

# Key information shown:
# - Subject: CN=example.com (who the cert is for)
# - Issuer: CN=Let's Encrypt (who signed it)
# - Validity: Not Before / Not After dates
# - Public Key: RSA or ECDSA public key
# - Signature: CA's signature proving authenticity
# - Extensions: SANs, key usage, etc.
```

### Certificate Types

| Type | Validation | Use Case |
|------|------------|----------|
| **DV** (Domain Validated) | Proves domain control | Most websites, APIs |
| **OV** (Organization Validated) | Proves org identity | Business sites |
| **EV** (Extended Validation) | Extensive org verification | Banks, high-trust sites |
| **Wildcard** | `*.example.com` | Multiple subdomains |
| **SAN/Multi-domain** | Multiple domains in one cert | Consolidated services |

### Let's Encrypt (Free DV Certificates)

```bash
# Using certbot
sudo certbot certonly --nginx -d example.com -d www.example.com

# Auto-renewal (usually configured automatically)
sudo certbot renew --dry-run

# Certificate location
ls /etc/letsencrypt/live/example.com/
# cert.pem       - Your certificate
# chain.pem      - Intermediate certificates
# fullchain.pem  - cert.pem + chain.pem (use this)
# privkey.pem    - Private key (keep secret!)
```

## Certificate Chain of Trust

Certificates form a chain from your certificate to a trusted root CA:

```
[Root CA Certificate] (Trusted by browsers/OS)
        |
        | signs
        v
[Intermediate CA Certificate]
        |
        | signs
        v
[Your Server Certificate]
```

### Verifying the Chain

```bash
# Check certificate chain
openssl s_client -connect example.com:443 -showcerts </dev/null

# Verify chain manually
openssl verify -CAfile /etc/ssl/certs/ca-certificates.crt \
  -untrusted intermediate.crt server.crt
```

## Common TLS Configurations

### Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name example.com;
    
    # Certificates
    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
    
    # Protocol versions
    ssl_protocols TLSv1.2 TLSv1.3;
    
    # Cipher suites (TLS 1.2)
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;  # Let client choose (TLS 1.3)
    
    # Session caching (performance)
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;  # Better forward secrecy
    
    # OCSP Stapling (faster validation)
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/letsencrypt/live/example.com/chain.pem;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=63072000" always;
}
```

### Apache

```apache
<VirtualHost *:443>
    ServerName example.com
    
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/example.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/example.com/privkey.pem
    
    SSLProtocol all -SSLv3 -TLSv1 -TLSv1.1
    SSLCipherSuite ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256
    SSLHonorCipherOrder off
    
    Header always set Strict-Transport-Security "max-age=63072000"
</VirtualHost>
```

### Kubernetes Ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  annotations:
    # Use cert-manager for automatic certificates
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    # Force HTTPS
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    # HSTS
    nginx.ingress.kubernetes.io/configuration-snippet: |
      add_header Strict-Transport-Security "max-age=63072000" always;
spec:
  tls:
    - hosts:
        - app.example.com
      secretName: app-tls-secret
  rules:
    - host: app.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: app-service
                port:
                  number: 80
```

## Certificate Management

### Generating CSRs (Certificate Signing Requests)

```bash
# Generate private key and CSR
openssl req -new -newkey rsa:2048 -nodes \
  -keyout server.key \
  -out server.csr \
  -subj "/CN=example.com/O=My Company/C=US"

# View CSR contents
openssl req -in server.csr -text -noout

# Generate with Subject Alternative Names (SANs)
openssl req -new -newkey rsa:2048 -nodes \
  -keyout server.key -out server.csr \
  -subj "/CN=example.com" \
  -addext "subjectAltName=DNS:example.com,DNS:www.example.com,DNS:api.example.com"
```

### Self-Signed Certificates (Development Only)

```bash
# Generate self-signed certificate (NOT for production)
openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout dev.key \
  -out dev.crt \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
```

### Certificate Rotation

```python
from datetime import datetime, timedelta
import ssl
import socket

def check_certificate_expiry(hostname: str, port: int = 443) -> dict:
    """Check certificate expiration date."""
    context = ssl.create_default_context()
    
    with socket.create_connection((hostname, port)) as sock:
        with context.wrap_socket(sock, server_hostname=hostname) as ssock:
            cert = ssock.getpeercert()
    
    # Parse expiration date
    not_after = datetime.strptime(
        cert['notAfter'], 
        '%b %d %H:%M:%S %Y %Z'
    )
    
    days_remaining = (not_after - datetime.utcnow()).days
    
    return {
        'hostname': hostname,
        'expires': not_after.isoformat(),
        'days_remaining': days_remaining,
        'needs_renewal': days_remaining < 30
    }

# Example: Monitor certificate expiry
domains = ['example.com', 'api.example.com']
for domain in domains:
    result = check_certificate_expiry(domain)
    if result['needs_renewal']:
        print(f"WARNING: {domain} expires in {result['days_remaining']} days!")
```

## mTLS (Mutual TLS)

Standard TLS only authenticates the server. Mutual TLS (mTLS) also authenticates the client, commonly used in:

- Service-to-service communication
- Zero Trust architectures
- API authentication

```
Standard TLS:                    Mutual TLS:
Client --> Server                Client <--> Server
           [cert]                [cert]      [cert]

Only server proves identity      Both prove identity
```

### mTLS in Service Mesh (Istio)

```yaml
# Istio PeerAuthentication: Require mTLS for all services
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: production
spec:
  mtls:
    mode: STRICT  # Require mTLS, reject plaintext
```

## Common TLS Misconfigurations

### 1. Expired Certificates

```bash
# Check expiration
echo | openssl s_client -connect example.com:443 2>/dev/null | \
  openssl x509 -noout -dates

# Set up monitoring/alerts for certificates expiring < 30 days
```

### 2. Missing Intermediate Certificates

```bash
# Test chain completeness
openssl s_client -connect example.com:443 </dev/null 2>&1 | \
  grep -i "verify"

# Should show: Verify return code: 0 (ok)
# If not, you may be missing intermediate certs
```

### 3. Allowing Weak Protocols/Ciphers

```bash
# Test for weak protocols
nmap --script ssl-enum-ciphers -p 443 example.com | \
  grep -E "SSLv|TLSv1.0|TLSv1.1"

# Use SSL Labs for comprehensive testing
# https://www.ssllabs.com/ssltest/
```

### 4. Missing HSTS Header

```bash
# Check for HSTS
curl -sI https://example.com | grep -i strict-transport

# Should return:
# Strict-Transport-Security: max-age=31536000; includeSubDomains
```

### 5. Certificate Hostname Mismatch

```bash
# Check certificate matches hostname
openssl s_client -connect example.com:443 </dev/null 2>/dev/null | \
  openssl x509 -noout -subject -ext subjectAltName
```

## Testing TLS Configuration

### SSL Labs

The gold standard for TLS testing: https://www.ssllabs.com/ssltest/

Aim for an **A+** rating:
- TLS 1.2+ only
- Strong cipher suites
- HSTS enabled
- No vulnerabilities

### testssl.sh

```bash
# Comprehensive local testing
git clone https://github.com/drwetter/testssl.sh.git
cd testssl.sh
./testssl.sh example.com
```

## Summary

Key takeaways for TLS/SSL:

- **Use TLS 1.3** when possible, TLS 1.2 minimum - disable all SSL and TLS 1.0/1.1
- **Get certificates from Let's Encrypt** - free, automated, trusted
- **Include intermediate certificates** - incomplete chains cause validation failures
- **Monitor expiration dates** - expired certs cause outages
- **Enable HSTS** - forces browsers to always use HTTPS
- **Use mTLS for service-to-service** - especially in zero trust environments
- **Test with SSL Labs** - aim for A+ rating

In the next section, we will explore PKI (Public Key Infrastructure) - the trust framework that makes certificates meaningful.
