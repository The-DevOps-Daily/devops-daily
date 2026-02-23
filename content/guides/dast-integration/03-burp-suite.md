---
title: 'Burp Suite'
description: 'Master Burp Suite for professional security testing. Learn manual and automated scanning, API testing, and advanced penetration testing techniques.'
---

# Burp Suite

Burp Suite is the industry-standard web application security testing tool used by professional penetration testers and security researchers. While OWASP ZAP excels at automation, Burp Suite shines in manual testing, advanced attack techniques, and deep vulnerability analysis.

## Why Burp Suite?

- **Industry standard**: Used by most professional pen testers
- **Deep analysis**: Advanced scanner with low false positives
- **Extensibility**: 500+ community extensions (BApps)
- **Manual testing**: Full HTTP proxy with request/response manipulation
- **Professional features**: Burp Collaborator, Intruder, Repeater, Scanner

## Editions

| Feature | Community (Free) | Professional ($449/year) | Enterprise (Custom) |
|---------|-----------------|------------------------|--------------------|
| **Proxy** | ✅ | ✅ | ✅ |
| **Repeater** | ✅ | ✅ | ✅ |
| **Intruder** | ⚠️ Limited | ✅ | ✅ |
| **Scanner** | ❌ | ✅ | ✅ |
| **Extensions** | ✅ | ✅ | ✅ |
| **CI/CD Integration** | ❌ | CLI | REST API |
| **Collaborator** | ❌ | ✅ | Private instance |

**For this guide**: We'll cover both Community (free) and Professional features.

## Installation

### Desktop Application

```bash
# macOS
brew install --cask burp-suite

# Linux (Download JAR)
# Visit https://portswigger.net/burp/releases to download the latest version
# Example: wget https://portswigger.net/burp/releases/startdownload?product=community&version=<version>&type=Jar -O burpsuite.jar
java -jar burpsuite.jar

# Windows (Installer)
# Download from https://portswigger.net/burp/communitydownload
```

### Professional License

```bash
# Activate with license key
java -jar burpsuite_pro.jar
```

## Core Tools

### 1. Proxy

Intercept and modify HTTP/HTTPS traffic between browser and server.

**Setup**:

```bash
# 1. Configure Burp to listen on 127.0.0.1:8080
# 2. Configure browser proxy settings:
#    HTTP Proxy: 127.0.0.1:8080
#    HTTPS Proxy: 127.0.0.1:8080
# 3. Install Burp CA certificate (for HTTPS)
#    http://burp/cert
```

**Use cases**:
- Inspect API requests/responses
- Modify authentication tokens
- Test parameter tampering
- Analyze session management

### 2. Repeater (Community + Pro)

**What**: Manually modify and re-send requests
**When**: Testing specific vulnerabilities, experimenting with payloads

**Example**: Testing SQL Injection

```http
# Original request
GET /api/users?id=1 HTTP/1.1
Host: example.com

# Test payload 1
GET /api/users?id=1' OR '1'='1 HTTP/1.1
Host: example.com

# Test payload 2
GET /api/users?id=1 UNION SELECT null,version(),null-- HTTP/1.1
Host: example.com
```

### 3. Intruder (Pro)

**What**: Automated attack tool for brute forcing, fuzzing, parameter discovery
**When**: Testing multiple payloads against endpoints

**Attack types**:

```plaintext
Sniper: Single position, one payload at a time
  username=admin&password=§payload§

Battering Ram: Multiple positions, same payload
  username=§payload§&password=§payload§

Pitchfork: Multiple positions, parallel payloads
  username=§user§&password=§pass§

Cluster Bomb: All combinations
  username=§user§&password=§pass§
```

**Example**: Brute force login

```http
POST /login HTTP/1.1
Host: example.com
Content-Type: application/json

{"username":"§admin§","password":"§pass§"}
```

Payloads:
- Position 1: admin, root, user
- Position 2: password123, admin123, test

### 4. Scanner (Pro)

**What**: Automated vulnerability scanner
**When**: Comprehensive testing of applications

**Scan types**:
- **Passive**: Monitor traffic without attacks
- **Active**: Send attack payloads to test vulnerabilities
- **Live**: Continuously scan as you browse

**Start a scan**:

```plaintext
1. Right-click on request in Proxy/Repeater
2. Select "Scan" > "Active Scan"
3. Configure scan insertion points and checks
4. Review findings in "Dashboard"
```

### 5. Burp Collaborator (Pro)

**What**: Out-of-band (OOB) vulnerability detection
**When**: Testing blind vulnerabilities (SSRF, XXE, SQL injection)

**How it works**:

```bash
# Burp Collaborator provides unique subdomain
payload.burpcollaborator.net

# Test SSRF
GET /fetch?url=http://payload.burpcollaborator.net

# If vulnerable, Burp Collaborator receives DNS/HTTP request
# proving the application made external request
```

## Manual Testing Workflow

### 1. Target Reconnaissance

```plaintext
1. Browse the application with Burp Proxy enabled
2. Map out all endpoints in "Target" > "Site Map"
3. Identify interesting parameters, cookies, headers
4. Note authentication and session management
```

### 2. Parameter Analysis

Test each parameter for common vulnerabilities:

```http
# Original
GET /search?q=test&page=1

# SQL Injection
GET /search?q=test'&page=1

# XSS
GET /search?q=<script>alert(1)</script>&page=1

# Path Traversal
GET /file?path=../../../../etc/passwd

# IDOR
GET /api/user/123 (try 124, 125, etc.)
```

### 3. Authentication Testing

```plaintext
# Test for:
- Weak passwords
- Username enumeration
- Session fixation
- Insufficient session timeout
- Concurrent sessions allowed
- JWT token manipulation
```

### 4. Authorization Testing

```http
# Test horizontal privilege escalation
GET /api/user/1/profile  (User A)
GET /api/user/2/profile  (Try accessing User B)

# Test vertical privilege escalation
GET /admin/users  (Normal user token)
```

## API Testing

### OpenAPI/Swagger

```plaintext
1. Import OpenAPI spec:
   Target > Site Map > Right-click > "Import from OpenAPI definition"
2. Review all endpoints in site map
3. Send interesting requests to Repeater/Intruder
```

### GraphQL

```graphql
# Discover schema
query IntrospectionQuery {
  __schema {
    types {
      name
      fields {
        name
      }
    }
  }
}

# Test injection
query {
  user(id: "1' OR '1'='1") {
    name
    email
  }
}
```

## Extensions (BApps)

Popular extensions for enhanced functionality:

### Must-Have Extensions

```plaintext
1. **Autorize** - Automated authorization testing
2. **HUNT** - Identify common vulnerability parameters
3. **JSON Web Tokens** - JWT manipulation
4. **Param Miner** - Find hidden parameters
5. **Turbo Intruder** - High-speed attacks
6. **Active Scan++** - Additional scan checks
7. **Software Vulnerability Scanner** - CVE detection
```

**Install**:
```plaintext
Extender > BApp Store > Select extension > Install
```

## CI/CD Integration (Pro)

### Burp Suite CLI

```bash
# Professional edition includes CLI scanner
java -jar burpsuite_pro.jar --project-file=project.burp \
  --unpause-spider-and-scanner \
  --config-file=config.json
```

**config.json**:

```json
{
  "target": {
    "scope": {
      "include": [{"rule": "https://staging.example.com/.*"}]
    }
  },
  "scanner": {
    "scan_speed": "fast",
    "scan_accuracy": "normal"
  }
}
```

### GitHub Actions

```yaml
name: Burp Suite Scan

on:
  push:
    branches: [main]

jobs:
  burp_scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Burp Suite Scanner
        env:
          BURP_LICENSE: ${{ secrets.BURP_LICENSE }}
        run: |
          docker run -e BURP_LICENSE \
            -v $(pwd):/config \
            burpsuite/pro \
            --project-file=/config/project.burp \
            --config-file=/config/config.json
      
      - name: Parse Results
        run: |
          python parse_burp_report.py report.xml
```

## Best Practices

1. **Use target scope** - Prevent accidental testing of out-of-scope domains
2. **Save your sessions** - Keep project files for reproducibility
3. **Install extensions** - Enhance functionality with BApps
4. **Learn keyboard shortcuts** - Speed up manual testing
5. **Use Repeater liberally** - Test hypotheses before Intruder attacks
6. **Review scanner findings manually** - Validate before reporting
7. **Respect rate limits** - Don't DOS the application

## Common Workflows

### Workflow 1: Quick Assessment

```plaintext
1. Browse site with Proxy on (5-10 min)
2. Run Active Scan on interesting endpoints (30 min)
3. Review high/critical findings
4. Manual validation in Repeater
```

### Workflow 2: Deep Dive

```plaintext
1. Full site crawl (Spider)
2. Passive scan of all traffic
3. Manual testing of authentication
4. Active scan of key features
5. Intruder attacks on identified parameters
6. Collaborator-based OOB testing
7. Extension-based specialized scans
```

### Workflow 3: API Security

```plaintext
1. Import OpenAPI spec
2. Send all endpoints to Repeater
3. Test authentication and authorization
4. Intruder attacks on parameters
5. JWT manipulation (with extension)
6. Schema injection (GraphQL)
```

## Burp vs ZAP

| Aspect | Burp Suite | OWASP ZAP |
|--------|------------|----------|
| **Cost** | $449/year (Pro) | Free |
| **Best for** | Manual testing | Automation |
| **CI/CD** | CLI (Pro) | Native Docker |
| **Extensions** | 500+ (BApp Store) | 100+ |
| **Learning curve** | Steeper | Gentler |
| **Scanner quality** | Excellent (Pro) | Good |
| **Community** | Large | Very large |

**Recommendation**: Use both
- **ZAP** for automated CI/CD scans
- **Burp** for manual penetration testing

## Next Steps

- **[CI/CD Integration](./04-cicd-integration)** — Automate DAST in your pipeline
- **Practice**: Try Burp Suite on intentionally vulnerable apps:
  - DVWA (Damn Vulnerable Web Application)
  - WebGoat (OWASP)
  - PortSwigger Web Security Academy (free labs)
