---
title: 'A10: Server-Side Request Forgery (SSRF)'
description: 'Learn about Server-Side Request Forgery vulnerabilities, how attackers exploit them to access internal resources, and effective prevention strategies.'
---

Server-Side Request Forgery (SSRF) occurs when an application can be tricked into making requests to unintended destinations. This new addition to the 2021 OWASP Top 10 reflects the increasing prevalence of cloud architectures where SSRF can be particularly devastating.

## What is SSRF?

SSRF vulnerabilities occur when an application:

- Fetches remote resources based on user-supplied URLs
- Doesn't validate or sanitize the destination
- Allows access to internal resources that should be protected

In cloud environments, SSRF can access metadata services, internal APIs, and other resources that are protected only by network boundaries.

## Common SSRF Scenarios

### 1. URL Preview Features

**The Problem:**

Many applications fetch URLs to generate previews or thumbnails.

```javascript
// VULNERABLE: Fetches any URL without validation
app.post('/api/preview', async (req, res) => {
  const { url } = req.body;
  
  // Attacker could provide: http://169.254.169.254/latest/meta-data/
  const response = await fetch(url);
  const html = await response.text();
  
  res.json({ preview: extractPreview(html) });
});
```

An attacker can request internal URLs like:

- `http://169.254.169.254/latest/meta-data/` - AWS metadata (credentials!)
- `http://localhost:8080/admin` - Internal admin interface
- `http://10.0.0.5:5432/` - Internal database
- `file:///etc/passwd` - Local file access

**The Impact:**

In AWS, the metadata service at `169.254.169.254` can return IAM credentials:

```json
{
  "AccessKeyId": "AKIAIOSFODNN7EXAMPLE",
  "SecretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  "Token": "..."
}
```

With these credentials, attackers can access your AWS resources.

### 2. Webhook Integrations

**The Problem:**

Allowing users to configure webhook URLs.

```javascript
// VULNERABLE: Sends data to user-provided URL
app.post('/api/webhooks', async (req, res) => {
  const { url, secret } = req.body;
  
  // Save webhook configuration
  await Webhook.create({ url, secret, userId: req.user.id });
  
  res.json({ success: true });
});

// Later, when event occurs:
async function triggerWebhooks(event) {
  const webhooks = await Webhook.find({ event: event.type });
  
  for (const webhook of webhooks) {
    // Could hit internal services!
    await fetch(webhook.url, {
      method: 'POST',
      body: JSON.stringify(event)
    });
  }
}
```

### 3. File Imports from URL

**The Problem:**

Importing files from user-provided URLs.

```javascript
// VULNERABLE: Imports file from any URL
app.post('/api/import', async (req, res) => {
  const { fileUrl } = req.body;
  
  const response = await fetch(fileUrl);
  const data = await response.json();
  
  await processImport(data);
  res.json({ success: true });
});
```

## Prevention Strategies

### 1. URL Validation with Allowlist

The most secure approach is to only allow specific, known-good destinations:

```javascript
const ALLOWED_DOMAINS = [
  'api.trusted-service.com',
  'cdn.example.com'
];

function isAllowedUrl(urlString) {
  try {
    const url = new URL(urlString);
    
    // Only allow HTTPS
    if (url.protocol !== 'https:') {
      return false;
    }
    
    // Check against allowlist
    return ALLOWED_DOMAINS.includes(url.hostname);
  } catch (e) {
    return false;
  }
}

app.post('/api/preview', async (req, res) => {
  const { url } = req.body;
  
  if (!isAllowedUrl(url)) {
    return res.status(400).json({ error: 'URL not allowed' });
  }
  
  const response = await fetch(url);
  // ...
});
```

### 2. Block Internal Networks

When you must accept arbitrary URLs, block internal addresses:

```javascript
const ipaddr = require('ipaddr.js');
const dns = require('dns').promises;

// IP ranges that should never be accessed
const BLOCKED_RANGES = [
  'loopback',     // 127.0.0.0/8
  'private',      // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
  'linkLocal',    // 169.254.0.0/16 (AWS metadata!)
  'uniqueLocal',  // fc00::/7
  'reserved'
];

async function isBlockedAddress(hostname) {
  try {
    // Resolve hostname to IP addresses
    const addresses = await dns.resolve(hostname);
    
    for (const address of addresses) {
      const parsed = ipaddr.parse(address);
      const range = parsed.range();
      
      if (BLOCKED_RANGES.includes(range)) {
        return true;
      }
    }
    
    return false;
  } catch (e) {
    // If we can't resolve, block it
    return true;
  }
}

async function validateUrl(urlString) {
  const url = new URL(urlString);
  
  // Block non-HTTP protocols
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Invalid protocol');
  }
  
  // Block file:// URLs
  if (url.protocol === 'file:') {
    throw new Error('File URLs not allowed');
  }
  
  // Check if hostname resolves to blocked IP
  if (await isBlockedAddress(url.hostname)) {
    throw new Error('Internal addresses not allowed');
  }
  
  return url;
}
```

### 3. Disable Redirects

Attackers can bypass URL validation using redirects:

```javascript
// VULNERABLE: Follows redirects
// Attacker's URL redirects to http://169.254.169.254/
const response = await fetch(url);  // Follows redirect!

// SECURE: Disable redirects and handle manually
const response = await fetch(url, { redirect: 'manual' });

if (response.status >= 300 && response.status < 400) {
  const redirectUrl = response.headers.get('location');
  // Validate the redirect URL before following
  await validateUrl(redirectUrl);
}
```

### 4. Use a Proxy Service

Route external requests through a dedicated proxy that enforces security policies:

```javascript
// Instead of direct fetch, use a secure proxy
async function secureFetch(url) {
  const response = await fetch('http://secure-proxy.internal/fetch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });
  
  return response;
}
```

The proxy service can:

- Validate URLs against blocklists
- Resolve DNS in a controlled environment
- Block access to internal networks
- Limit response size and types
- Log all requests for auditing

### 5. AWS IMDSv2

If using AWS, require IMDSv2 which protects against SSRF:

```hcl
# Terraform: Require IMDSv2
resource "aws_instance" "example" {
  ami           = "ami-12345678"
  instance_type = "t3.micro"

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"  # Require session tokens
    http_put_response_hop_limit = 1           # Prevent container breakout
  }
}
```

With IMDSv2, accessing metadata requires a session token:

```bash
# IMDSv2 requires a PUT request to get a token first
TOKEN=$(curl -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")

# Then use the token to access metadata
curl "http://169.254.169.254/latest/meta-data/" \
  -H "X-aws-ec2-metadata-token: $TOKEN"
```

Simple GET requests (like those from SSRF) won't work.

## Testing for SSRF

### Manual Testing

Try these payloads in URL parameters:

```
http://127.0.0.1/
http://localhost/
http://169.254.169.254/latest/meta-data/
http://[::1]/
http://0.0.0.0/
http://2130706433/  (decimal IP for 127.0.0.1)
http://0x7f.0x0.0x0.0x1/  (hex IP)
http://internal-service.local/
file:///etc/passwd
```

### Automated Scanning

Use tools like Burp Suite or OWASP ZAP to test for SSRF vulnerabilities during security assessments.

## Key Takeaways

1. **Use allowlists** when possible - only allow known-good destinations
2. **Block internal IP ranges** - 127.0.0.0/8, 169.254.0.0/16, 10.0.0.0/8, etc.
3. **Validate after DNS resolution** - hostnames can resolve to internal IPs
4. **Disable automatic redirects** - validate redirect targets
5. **Use IMDSv2 on AWS** - protect metadata service
6. **Implement network segmentation** - limit what servers can access
7. **Use a proxy for external requests** - centralize security controls
8. **Log and monitor** - track outbound requests for anomalies

SSRF is particularly dangerous in cloud environments where network-level protections are often the primary defense for internal services. Defense in depth is essential.
