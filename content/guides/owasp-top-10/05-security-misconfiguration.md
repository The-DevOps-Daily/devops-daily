---
title: 'A05: Security Misconfiguration'
description: 'Learn about security misconfiguration vulnerabilities, common mistakes in configuring applications and infrastructure, and how to implement secure configurations.'
---

Security Misconfiguration is one of the most common vulnerabilities and often the easiest to exploit. It occurs when security settings are not defined, implemented, or maintained properly. Even small misconfigurations can lead to significant breaches.

## What is Security Misconfiguration?

Security misconfiguration can happen at any level of an application stack:

- **Network services** - Unnecessary ports open, weak firewall rules
- **Platform/Framework** - Default configurations, unnecessary features enabled
- **Application server** - Verbose error messages, directory listing
- **Database** - Default credentials, excessive permissions
- **Cloud services** - Public S3 buckets, overly permissive IAM roles

The challenge is that modern applications have many configuration points, and each one is a potential vulnerability.

## Common Misconfiguration Patterns

### 1. Default Credentials

**The Problem:**

Many systems ship with default usernames and passwords that are publicly documented.

```yaml
# VULNERABLE: Default credentials in docker-compose
services:
  database:
    image: postgres:14
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres  # Default!
```

**Secure Configuration:**

```yaml
# SECURE: Use secrets management
services:
  database:
    image: postgres:14
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password

secrets:
  db_password:
    external: true  # Managed outside docker-compose
```

Always change default credentials for:

- Databases (PostgreSQL, MySQL, MongoDB)
- Message brokers (RabbitMQ, Redis)
- Admin panels (WordPress, phpMyAdmin)
- Network devices (routers, switches)
- Cloud services (AWS root account)

### 2. Verbose Error Messages

**The Problem:**

Detailed error messages help attackers understand your system.

```javascript
// VULNERABLE: Stack trace exposed to users
app.use((err, req, res, next) => {
  res.status(500).json({
    error: err.message,
    stack: err.stack,  // Reveals internal paths and code structure!
    query: req.query   // Might contain sensitive data
  });
});
```

Attackers learn:

- Framework and library versions
- File paths and directory structure
- Database schema from SQL errors
- Internal API endpoints

**Secure Configuration:**

```javascript
// SECURE: Generic errors in production, detailed in development
app.use((err, req, res, next) => {
  // Log full error for debugging
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    requestId: req.id,
    path: req.path,
    method: req.method
  });
  
  // Return generic message in production
  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({
      error: 'An unexpected error occurred',
      requestId: req.id  // For support reference
    });
  } else {
    // Detailed errors in development
    res.status(500).json({
      error: err.message,
      stack: err.stack
    });
  }
});
```

### 3. Unnecessary Services and Features

**The Problem:**

Every enabled feature is a potential attack surface.

```nginx
# VULNERABLE: Unnecessary features enabled
server {
    listen 80;
    
    # Directory listing enabled
    autoindex on;
    
    # Server version exposed
    server_tokens on;
    
    location /admin {
        # Admin panel accessible from internet
    }
}
```

**Secure Configuration:**

```nginx
# SECURE: Minimal, hardened configuration
server {
    listen 443 ssl http2;
    
    # Hide server version
    server_tokens off;
    
    # Disable directory listing
    autoindex off;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Admin panel - internal only
    location /admin {
        allow 10.0.0.0/8;  # Internal network only
        deny all;
    }
}
```

### 4. Cloud Misconfigurations

**The Problem:**

Cloud services default to convenience, not security.

```hcl
# VULNERABLE: Public S3 bucket
resource "aws_s3_bucket" "data" {
  bucket = "company-data"
}

resource "aws_s3_bucket_acl" "data" {
  bucket = aws_s3_bucket.data.id
  acl    = "public-read"  # Anyone can read!
}
```

**Secure Configuration:**

```hcl
# SECURE: Private bucket with encryption
resource "aws_s3_bucket" "data" {
  bucket = "company-data"
}

resource "aws_s3_bucket_public_access_block" "data" {
  bucket = aws_s3_bucket.data.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "data" {
  bucket = aws_s3_bucket.data.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_versioning" "data" {
  bucket = aws_s3_bucket.data.id
  versioning_configuration {
    status = "Enabled"
  }
}
```

### 5. Missing Security Headers

**The Problem:**

Browsers have security features that must be explicitly enabled.

```javascript
// VULNERABLE: No security headers
app.get('/', (req, res) => {
  res.send('<html>...</html>');
});
```

**Secure Configuration:**

```javascript
const helmet = require('helmet');

// Helmet sets many security headers automatically
app.use(helmet());

// Customize as needed
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'"],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    upgradeInsecureRequests: [],
  },
}));
```

## Configuration Management Best Practices

### 1. Infrastructure as Code

Define configurations in version-controlled code, not manual settings:

```yaml
# Kubernetes deployment with security context
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  template:
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
      containers:
      - name: api
        image: api:latest
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop:
              - ALL
        resources:
          limits:
            cpu: "500m"
            memory: "256Mi"
          requests:
            cpu: "100m"
            memory: "128Mi"
```

### 2. Configuration Scanning

Use tools to detect misconfigurations before deployment:

```bash
# Scan Terraform for security issues
checkov -d ./terraform/

# Scan Kubernetes manifests
kubesec scan deployment.yaml

# Scan Docker images
trivy image myapp:latest

# Scan CloudFormation
cfn-lint template.yaml
cfn_nag_scan --input-path template.yaml
```

### 3. Environment Separation

Development and production should have different configurations:

```javascript
// config/index.js
const configs = {
  development: {
    debug: true,
    logLevel: 'debug',
    cors: { origin: '*' },
    rateLimit: { max: 1000 }
  },
  production: {
    debug: false,
    logLevel: 'warn',
    cors: { origin: 'https://myapp.com' },
    rateLimit: { max: 100 }
  }
};

module.exports = configs[process.env.NODE_ENV || 'development'];
```

## Key Takeaways

1. **Change all default credentials** immediately after installation
2. **Disable unnecessary features** - every feature is attack surface
3. **Use generic error messages** in production
4. **Implement security headers** using tools like Helmet
5. **Scan configurations** with automated tools (Checkov, tfsec)
6. **Use Infrastructure as Code** for consistent, reviewable configurations
7. **Separate environments** - production should be more restrictive
8. **Review regularly** - configurations drift over time

Security misconfiguration is preventable with proper processes and automation. The key is treating configuration as code and subjecting it to the same rigor as application code.
