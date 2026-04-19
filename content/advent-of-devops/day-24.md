---
title: 'Day 24 - Harden a Config'
day: 24
excerpt: 'Apply security hardening best practices to application configurations, containers, and infrastructure.'
description: 'Learn security hardening by applying CIS benchmarks, security best practices, and defensive configurations to your infrastructure.'
publishedAt: '2025-12-24T00:00:00Z'
updatedAt: '2026-04-19T00:00:00Z'
difficulty: 'Advanced'
category: 'Security'
tags:
  - Security
  - Hardening
  - Best Practices
  - Configuration
---

## Description

Your infrastructure configurations have security issues: default passwords, overly permissive access, missing security headers, and vulnerable settings. Apply security hardening to protect against attacks.

## Task

Harden application and infrastructure configurations.

**Requirements:**
- Apply security best practices
- Remove default credentials
- Implement least privilege
- Add security headers
- Enable security features

## Target

- ✅ No default credentials
- ✅ Principle of least privilege applied
- ✅ Security headers enabled
- ✅ Unnecessary features disabled
- ✅ Security scans pass

## Sample App

### Before Hardening (Insecure)

#### Dockerfile (Insecure)

```dockerfile
FROM ubuntu:latest

# Running as root!
USER root

# Installing unnecessary packages
RUN apt-get update && apt-get install -y \
    curl wget vim sudo openssh-server

# Default passwords
RUN echo 'root:password123' | chpasswd

# Exposing all ports
EXPOSE 1-65535

# No health check
CMD ["/bin/bash"]
```

#### nginx.conf (Insecure)

```nginx
server {
    listen 80;
    server_name _;

    # Server version exposed
    server_tokens on;

    # No security headers
    location / {
        root /usr/share/nginx/html;
        autoindex on;  # Directory listing enabled!

        # CORS wide open
        add_header Access-Control-Allow-Origin *;
    }
}
```

## Solution

### 1. Hardened Dockerfile

```dockerfile
# Use specific version, not latest
FROM node:20.10-alpine3.18

# Security labels
LABEL maintainer="security@example.com"
LABEL org.opencontainers.image.description="Hardened application container"
LABEL org.opencontainers.image.source="https://github.com/org/repo"

# Install security updates
RUN apk update && \
    apk upgrade && \
    apk add --no-cache \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S appuser && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G appuser appuser

# Set working directory
WORKDIR /app

# Copy package files
COPY --chown=appuser:appuser package*.json ./

# Install dependencies (only production)
RUN npm ci --only=production && \
    npm cache clean --force && \
    rm -rf /tmp/*

# Copy application files
COPY --chown=appuser:appuser . .

# Remove unnecessary files
RUN rm -rf \
    .git \
    .github \
    tests \
    *.md \
    .env.example

# Set file permissions
RUN chmod -R 550 /app && \
    chmod -R 770 /app/logs

# Switch to non-root user
USER appuser

# Use dumb-init to handle signals
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Expose only required port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node healthcheck.js || exit 1

# Run with minimal privileges
CMD ["node", "--max-old-space-size=512", "server.js"]

# Security options (use with docker run)
# --read-only --tmpfs /tmp --tmpfs /app/logs
# --security-opt=no-new-privileges:true
# --cap-drop=ALL --cap-add=NET_BIND_SERVICE
```

### 2. Hardened nginx Configuration

```nginx
# nginx.conf
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
}

http {
    # Hide version
    server_tokens off;
    more_clear_headers Server;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;
    limit_conn_zone $binary_remote_addr zone=addr:10m;

    # Buffer overflow protection
    client_body_buffer_size 1K;
    client_header_buffer_size 1k;
    client_max_body_size 1k;
    large_client_header_buffers 2 1k;

    # Timeouts
    client_body_timeout 10;
    client_header_timeout 10;
    keepalive_timeout 5 5;
    send_timeout 10;

    # SSL/TLS configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_stapling on;
    ssl_stapling_verify on;

    server {
        listen 80;
        server_name example.com;

        # Redirect to HTTPS
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name example.com;

        # SSL certificates
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;

        # HSTS
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

        # Rate limiting
        limit_req zone=general burst=20 nodelay;
        limit_conn addr 10;

        # Logging
        access_log /var/log/nginx/access.log combined;
        error_log /var/log/nginx/error.log warn;

        root /usr/share/nginx/html;
        index index.html;

        location / {
            try_files $uri $uri/ =404;

            # Disable directory listing
            autoindex off;
        }

        location /api {
            # API rate limiting
            limit_req zone=api burst=10 nodelay;

            proxy_pass http://backend:3000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # Timeouts
            proxy_connect_timeout 5s;
            proxy_send_timeout 10s;
            proxy_read_timeout 10s;

            # Buffer sizes
            proxy_buffer_size 4k;
            proxy_buffers 8 4k;
            proxy_busy_buffers_size 8k;
        }

        # Block access to hidden files
        location ~ /\. {
            deny all;
            access_log off;
            log_not_found off;
        }

        # Block access to sensitive files
        location ~* \.(env|log|git|svn|htaccess)$ {
            deny all;
        }

        # Health check (no logging)
        location /health {
            access_log off;
            return 200 "healthy\n";
        }

        # Custom error pages
        error_page 404 /404.html;
        error_page 500 502 503 504 /50x.html;

        location = /404.html {
            internal;
        }

        location = /50x.html {
            internal;
        }
    }
}
```

### 3. Kubernetes Security

```yaml
# hardened-deployment.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: myapp
  namespace: production
automountServiceAccountToken: false  # Disable auto-mounting
---
apiVersion: v1
kind: Secret
metadata:
  name: myapp-token
  namespace: production
  annotations:
    kubernetes.io/service-account.name: myapp
type: kubernetes.io/service-account-token
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
      annotations:
        # Pod security annotations
        container.apparmor.security.beta.kubernetes.io/myapp: runtime/default
    spec:
      serviceAccountName: myapp

      # Security context for pod
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        runAsGroup: 1001
        fsGroup: 1001
        fsGroupChangePolicy: "OnRootMismatch"
        seccompProfile:
          type: RuntimeDefault

      containers:
      - name: myapp
        image: myapp:1.0.0
        imagePullPolicy: Always

        # Security context for container
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          runAsNonRoot: true
          runAsUser: 1001
          capabilities:
            drop:
            - ALL
            add:
            - NET_BIND_SERVICE

        # Resource limits
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"

        # Liveness and readiness probes
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3

        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3

        # Environment variables from secrets
        envFrom:
        - secretRef:
            name: myapp-secrets

        # Volume mounts for writable directories
        volumeMounts:
        - name: tmp
          mountPath: /tmp
        - name: cache
          mountPath: /app/.cache

      volumes:
      - name: tmp
        emptyDir: {}
      - name: cache
        emptyDir: {}

      # Network policy
      # Defined separately below
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: myapp-netpol
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: myapp
  policyTypes:
  - Ingress
  - Egress

  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: nginx-ingress
    ports:
    - protocol: TCP
      port: 3000

  egress:
  # Allow DNS
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
    ports:
    - protocol: UDP
      port: 53

  # Allow database
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432

  # Allow external HTTPS
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 443
```

### 4. Security Scanning Script

```bash
#!/bin/bash

set -euo pipefail

echo "=== Security Hardening Validation ==="

# Check Dockerfile
echo ""
echo "Checking Dockerfile..."
hadolint Dockerfile || echo "⚠️  Dockerfile has issues"

# Check for secrets
echo ""
echo "Checking for secrets..."
gitleaks detect --source . --verbose || echo "⚠️  Potential secrets found"

# Check dependencies
echo ""
echo "Checking dependencies..."
npm audit --audit-level=high || echo "⚠️  Vulnerable dependencies found"

# Check container image
echo ""
echo "Scanning container image..."
trivy image --severity HIGH,CRITICAL myapp:latest || echo "⚠️  Vulnerabilities found"

# Check Kubernetes manifests
echo ""
echo "Checking Kubernetes config..."
kubesec scan k8s/*.yaml || echo "⚠️  Security issues in K8s config"

# Check for default passwords
echo ""
echo "Checking for default passwords..."
grep -r "password.*123\|admin.*admin" --exclude-dir=.git . && echo "❌ Default passwords found" || echo "✅ No default passwords"

# Check file permissions
echo ""
echo "Checking file permissions..."
find . -type f -perm 0777 -ls && echo "⚠️  World-writable files found" || echo "✅ No world-writable files"

# SSL/TLS check (if applicable)
echo ""
echo "Checking SSL/TLS..."
if command -v testssl &> /dev/null; then
    testssl --severity HIGH https://example.com || echo "⚠️  SSL/TLS issues found"
fi

echo ""
echo "=== Security scan complete ==="
```

### 5. Security Checklist Script

```bash
#!/bin/bash

# security-checklist.sh

echo "Security Hardening Checklist"
echo "=============================="
echo ""

check_item() {
    local description=$1
    local command=$2

    echo -n "[$description] "

    if eval "$command" &>/dev/null; then
        echo "✅"
        return 0
    else
        echo "❌"
        return 1
    fi
}

# Dockerfile checks
echo "Dockerfile Security:"
check_item "Non-root user" "grep -q 'USER' Dockerfile && ! grep -q 'USER root' Dockerfile"
check_item "Specific base image tag" "! grep -q 'FROM.*:latest' Dockerfile"
check_item "Health check defined" "grep -q 'HEALTHCHECK' Dockerfile"
check_item "Minimal EXPOSE" "test $(grep -c 'EXPOSE' Dockerfile || echo 0) -le 2"

echo ""
echo "Container Security:"
check_item "Security scanning enabled" "command -v trivy"
check_item "No secrets in image" "! docker run --rm myapp:latest env | grep -i 'password\|secret\|key'"
check_item "Read-only filesystem" "grep -q 'readOnlyRootFilesystem: true' k8s/*.yaml"

echo ""
echo "Network Security:"
check_item "TLS configured" "grep -q 'ssl_protocols' nginx.conf"
check_item "Security headers" "grep -q 'X-Frame-Options' nginx.conf"
check_item "HSTS enabled" "grep -q 'Strict-Transport-Security' nginx.conf"

echo ""
echo "Access Control:"
check_item "No default credentials" "! grep -r 'password.*123\|admin.*admin' ."
check_item "Least privilege" "grep -q 'runAsNonRoot: true' k8s/*.yaml"
check_item "Network policy defined" "test -f k8s/networkpolicy.yaml"

echo ""
echo "Monitoring:"
check_item "Logging configured" "grep -q 'access_log' nginx.conf"
check_item "Health checks" "grep -q 'livenessProbe' k8s/*.yaml"

echo ""
echo "Dependencies:"
check_item "No critical vulnerabilities" "npm audit --audit-level=critical"
check_item "Updated packages" "test $(npm outdated | wc -l) -lt 5"
```

## Explanation

### Security Hardening Principles

#### 1. Least Privilege

```
Start with nothing → Add only what's needed
```

- Run as non-root user
- Drop all capabilities
- Read-only filesystem
- Minimal network access

#### 2. Defense in Depth

```
Multiple layers of security:
- Container security
- Network security
- Application security
- Infrastructure security
```

#### 3. Zero Trust

```
Never trust, always verify:
- Authenticate everything
- Encrypt in transit
- Validate inputs
- Log access
```

### Common Security Issues

| Issue | Risk | Fix |
|-------|------|-----|
| Running as root | Privilege escalation | Use non-root user |
| Default passwords | Unauthorized access | Strong unique passwords |
| No TLS | Data interception | Enable TLS 1.2+ |
| Missing headers | XSS, clickjacking | Add security headers |
| Open ports | Attack surface | Expose only needed ports |

## Result

### Apply Hardening

```bash
# Build hardened image
docker build -t myapp:hardened -f Dockerfile.hardened .

# Run with security options
docker run -d \
  --name myapp \
  --read-only \
  --tmpfs /tmp \
  --tmpfs /app/logs \
  --security-opt=no-new-privileges:true \
  --cap-drop=ALL \
  --cap-add=NET_BIND_SERVICE \
  -p 3000:3000 \
  myapp:hardened

# Deploy hardened Kubernetes config
kubectl apply -f hardened-deployment.yaml

# Run security checks
./security-checklist.sh
```

### Verify Security

```bash
# Check container runs as non-root
docker inspect myapp | jq '.[0].Config.User'
# Should not be "root" or empty

# Verify read-only filesystem
docker exec myapp touch /test
# Should fail

# Check capabilities
docker exec myapp capsh --print
# Should show minimal capabilities

# Test security headers
curl -I https://example.com
# Should include X-Frame-Options, etc.
```

## Validation

### Security Audit Checklist

```bash
# 1. No root user
docker inspect myapp | jq '.[0].Config.User' | grep -v "root"
# Should pass

# 2. Security headers present
curl -I https://example.com | grep -E "X-Frame-Options|Content-Security-Policy"
# Should show headers

# 3. TLS 1.2+ only
nmap --script ssl-enum-ciphers -p 443 example.com
# Should show TLS 1.2/1.3 only

# 4. No vulnerabilities
trivy image --severity CRITICAL myapp:hardened
# Should show 0 critical

# 5. Network policy active
kubectl get networkpolicy -n production
# Should list policy

# 6. Secrets not in environment
kubectl exec -n production myapp-xxx -- env | grep -i "password\|secret"
# Should be empty or from proper secrets
```

## Best Practices

### ✅ Do's

1. **Run as non-root**: Always
2. **Use specific versions**: Not :latest
3. **Minimize attack surface**: Remove unnecessary components
4. **Enable security features**: Headers, TLS, etc.
5. **Regular updates**: Patch vulnerabilities
6. **Audit regularly**: Check configurations

### ❌ Don'ts

1. **Don't use default credentials**: Change immediately
2. **Don't expose unnecessary ports**: Minimal exposure
3. **Don't skip TLS**: Always encrypt
4. **Don't ignore warnings**: Fix security issues
5. **Don't trust input**: Validate everything

## Links

- [CIS Benchmarks](https://www.cisecurity.org/cis-benchmarks/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Docker Security](https://docs.docker.com/engine/security/)
- [Kubernetes Security](https://kubernetes.io/docs/concepts/security/)
- [Mozilla SSL Configuration](https://ssl-config.mozilla.org/)

## Share Your Success

Hardened your configs? Share what you did!

**Tag [@thedevopsdaily](https://x.com/thedevopsdaily)** on X with:
- Security improvements made
- Before/after scan results
- Hardening checklist
- Lessons learned

Use hashtags: **#AdventOfDevOps #Security #Hardening #Day24**
