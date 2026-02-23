---
title: 'DAST Fundamentals'
description: 'Understand how Dynamic Application Security Testing works, the types of scans, and when to use DAST in your security strategy.'
---

# DAST Fundamentals

Dynamic Application Security Testing (DAST) is a "black box" security testing approach that finds vulnerabilities by interacting with your running application. Unlike static analysis that reads code, DAST sends requests and analyzes responses—exactly like an attacker would.

## How DAST Works

A DAST scanner follows this workflow:

### 1. Discovery (Crawling)

The scanner explores your application to build a map of all endpoints:

```bash
# Example: ZAP spider discovers endpoints
GET /
GET /api/users
GET /api/products
POST /api/login
```

It follows links, submits forms, and executes JavaScript to find all possible entry points.

### 2. Analysis (Passive Scanning)

While crawling, the scanner passively analyzes responses for issues:

- Missing security headers (CSP, HSTS, X-Frame-Options)
- Exposed sensitive information (stack traces, version numbers)
- Insecure cookies (missing HttpOnly, Secure flags)
- Weak SSL/TLS configurations

**No attacks yet**—just observation.

### 3. Attack (Active Scanning)

The scanner actively probes each endpoint with attack payloads:

```bash
# SQL Injection test
GET /api/users?id=1' OR '1'='1

# XSS test
GET /search?q=<script>alert('XSS')</script>

# Path Traversal test
GET /files?path=../../../../etc/passwd
```

It analyzes responses to detect vulnerabilities:
- Database errors → SQL injection possible
- Script in response → XSS vulnerability
- Sensitive file content → Path traversal

### 4. Reporting

Results are categorized by:
- **Severity**: Critical, High, Medium, Low, Informational
- **Confidence**: High, Medium, Low (likelihood of true positive)
- **CWE/CVE**: Standard vulnerability identifiers
- **OWASP Top 10**: Mapping to common vulnerability categories

## Types of DAST Scans

### Passive Scans

**What**: Observe traffic without attacking
**When**: Always-on monitoring, production environments
**Speed**: Fast (no delays)
**Risk**: None

```yaml
# Example: ZAP passive scan in CI/CD
- name: Passive DAST
  run: |
    zap-baseline.py -t https://staging.example.com \
      -r report.html
```

**Use cases**:
- Continuous monitoring of production traffic
- Initial reconnaissance
- Compliance checks (security headers, cookie flags)

### Active Scans

**What**: Send attack payloads to test vulnerabilities
**When**: Staging/test environments
**Speed**: Slow (can take hours)
**Risk**: High (can cause damage)

```yaml
# Example: ZAP active scan
- name: Active DAST
  run: |
    zap-full-scan.py -t https://staging.example.com \
      -r report.html \
      -z "-config api.maxchildren=2"
```

**Use cases**:
- Pre-release security testing
- Penetration testing
- Comprehensive vulnerability assessment

### API Scans

**What**: Test API endpoints using OpenAPI/Swagger specs
**When**: APIs, microservices
**Speed**: Medium
**Risk**: Medium

```bash
# Example: ZAP API scan with OpenAPI spec
zap-api-scan.py \
  -t https://api.example.com/openapi.json \
  -f openapi \
  -r report.html
```

**Use cases**:
- REST API security testing
- GraphQL endpoint testing
- Microservice security validation

## What DAST Finds

### Common Vulnerabilities Detected

DAST tools can identify many critical vulnerabilities:

- **SQL Injection**: Detects database query manipulation attempts
- **Cross-Site Scripting (XSS)**: Finds script injection points
- **Broken Authentication**: Tests session management and auth flows
- **Sensitive Data Exposure**: Identifies unencrypted data transmission
- **XML External Entities (XXE)**: Tests for XML parser vulnerabilities
- **Broken Access Control**: Checks for IDOR and path traversal
- **Security Misconfiguration**: Finds default credentials and misconfigurations
- **Server-Side Request Forgery (SSRF)**: Tests for internal resource access

### What DAST Misses

DAST has blind spots:

- **Unauthenticated endpoints**: Can't test behind login without credentials
- **Complex workflows**: Multi-step attacks requiring business logic
- **Client-side vulnerabilities**: Issues in mobile apps, desktop clients
- **Code-level flaws**: Buffer overflows, race conditions (need SAST)
- **Logic bugs**: Business rule violations that don't trigger errors

## When to Use DAST

### Perfect for:

- **Pre-production validation**: Test staging before release
- **API security**: Validate REST/GraphQL endpoints
- **Compliance**: Meet PCI-DSS, SOC 2 requirements
- **Regression testing**: Ensure security fixes work
- **Third-party apps**: Test applications without source code

### Not ideal for:

- **Early development**: Too slow for fast iteration (use SAST)
- **Production environments**: Risk of downtime/damage
- **Complex authentication**: Requires manual setup
- **Performance testing**: DAST scans are slow

## DAST in the SDLC

Integrate DAST at multiple stages for comprehensive security coverage. Best practice is to run DAST in staging environments with production-like configurations.

## Common DAST Tools

Popular DAST tools include:

- **OWASP ZAP**: Open source, excellent for automation and CI/CD
- **Burp Suite**: Commercial tool, best for manual testing and advanced features
- **Nuclei**: Open source, fast scans with custom rules
- **Acunetix**: Commercial, enterprise-focused with compliance features
- **Netsparker**: Commercial, automated verification capabilities
- **Arachni**: Open source, designed for web apps and distributed scanning

## Key Metrics

Track these to measure DAST effectiveness:

- **Scan coverage**: Percentage of endpoints tested
- **Vulnerability density**: Issues per 1000 requests
- **False positive rate**: Percentage of findings that aren't real
- **Mean time to remediate (MTTR)**: Days from detection to fix
- **Scan duration**: Time to complete full scan

## Next Steps

Now that you understand DAST fundamentals:

1. **[OWASP ZAP](./02-owasp-zap)** — Learn the most popular open-source DAST tool
2. **[Burp Suite](./03-burp-suite)** — Master professional penetration testing
3. **[CI/CD Integration](./04-cicd-integration)** — Automate DAST in your pipeline

---

**Remember**: DAST is one layer of defense. Combine with SAST, dependency scanning, and infrastructure security for comprehensive protection.
