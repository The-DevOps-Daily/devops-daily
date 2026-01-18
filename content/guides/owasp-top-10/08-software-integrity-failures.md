---
title: 'A08: Software and Data Integrity Failures'
description: 'Learn about software and data integrity failures, including insecure CI/CD pipelines, unsigned updates, and untrusted deserialization. Understand how to verify the integrity of code and data.'
---

Software and Data Integrity Failures relate to code and infrastructure that does not protect against integrity violations. This is a new category in the 2021 OWASP Top 10, combining insecure deserialization with supply chain security concerns.

## What Are Integrity Failures?

Integrity failures occur when:

- Applications rely on plugins, libraries, or modules from untrusted sources
- CI/CD pipelines don't verify the integrity of code before deployment
- Auto-update functionality downloads updates without signature verification
- Objects or data are deserialized from untrusted sources

When integrity is compromised, attackers can inject malicious code into your software supply chain.

## Common Vulnerability Patterns

### 1. Insecure Deserialization

**The Problem:**

Deserializing untrusted data can lead to remote code execution.

```javascript
// VULNERABLE: Deserializing user-controlled data
app.post('/api/import', (req, res) => {
  // User sends serialized JavaScript object
  const data = eval('(' + req.body.data + ')');  // DANGEROUS!
  // ...
});

// VULNERABLE: Deserializing YAML without restrictions
const yaml = require('js-yaml');
app.post('/config', (req, res) => {
  const config = yaml.load(req.body.yaml);  // Can execute code!
});
```

YAML parsers with full feature support can instantiate objects and call constructors, leading to code execution.

**Secure Implementation:**

```javascript
// SECURE: Use JSON for data interchange
app.post('/api/import', (req, res) => {
  try {
    const data = JSON.parse(req.body.data);  // Safe
    // Validate the structure
    if (!validateSchema(data)) {
      return res.status(400).json({ error: 'Invalid data format' });
    }
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
});

// SECURE: Use safe YAML loading
const yaml = require('js-yaml');
app.post('/config', (req, res) => {
  try {
    // safeLoad only parses basic types, no code execution
    const config = yaml.load(req.body.yaml, { schema: yaml.SAFE_SCHEMA });
  } catch (e) {
    return res.status(400).json({ error: 'Invalid YAML' });
  }
});
```

### 2. Untrusted Dependencies

**The Problem:**

Installing packages from public registries without verification.

```bash
# VULNERABLE: Installing without verification
npm install some-random-package

# VULNERABLE: Using unverified CDN scripts
<script src="https://cdn.example.com/library.js"></script>
```

**Secure Practices:**

```bash
# Use lock files with integrity hashes
npm ci  # Installs from lock file, verifies integrity

# Verify package signatures
npm audit signatures
```

For CDN scripts, use Subresource Integrity (SRI):

```html
<!-- SECURE: Verify script integrity -->
<script 
  src="https://cdn.example.com/library.js"
  integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC"
  crossorigin="anonymous">
</script>
```

### 3. Insecure CI/CD Pipelines

**The Problem:**

CI/CD pipelines that don't verify code integrity can deploy malicious code.

```yaml
# VULNERABLE: No code signing or verification
name: Deploy
on: push
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install
      - run: npm run build
      - run: ./deploy.sh  # Deploys whatever was built
```

**Secure Pipeline:**

```yaml
# SECURE: Verify commits and artifacts
name: Deploy
on:
  push:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      # Verify GPG signature on commits
      - name: Verify commit signature
        run: |
          git verify-commit HEAD || {
            echo "Commit is not signed!"
            exit 1
          }
      
      # Lock file verification
      - name: Install dependencies
        run: npm ci  # Strict installation from lock file
      
      # Security scan before build
      - name: Security audit
        run: npm audit --audit-level=high

  build:
    needs: verify
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build
      
      # Sign the artifact
      - name: Sign artifact
        run: |
          cosign sign-blob --key cosign.key dist/app.js
      
      - uses: actions/upload-artifact@v4
        with:
          name: build
          path: dist/

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/download-artifact@v4
      
      # Verify artifact signature before deploy
      - name: Verify artifact
        run: |
          cosign verify-blob --key cosign.pub dist/app.js
      
      - run: ./deploy.sh
```

### 4. Unsigned Auto-Updates

**The Problem:**

Auto-update mechanisms that don't verify signatures can install malicious updates.

```javascript
// VULNERABLE: Download and execute without verification
async function checkForUpdates() {
  const response = await fetch('https://updates.example.com/latest');
  const update = await response.json();
  
  if (update.version > currentVersion) {
    const binary = await fetch(update.downloadUrl);
    // Install without verification!
    await installUpdate(binary);
  }
}
```

**Secure Implementation:**

```javascript
const crypto = require('crypto');

// Public key for update verification
const UPDATE_PUBLIC_KEY = process.env.UPDATE_PUBLIC_KEY;

async function checkForUpdates() {
  const response = await fetch('https://updates.example.com/latest');
  const update = await response.json();
  
  if (update.version > currentVersion) {
    // Download the update
    const binaryResponse = await fetch(update.downloadUrl);
    const binary = await binaryResponse.buffer();
    
    // Download the signature
    const sigResponse = await fetch(update.signatureUrl);
    const signature = await sigResponse.text();
    
    // Verify signature
    const verify = crypto.createVerify('SHA256');
    verify.update(binary);
    
    if (!verify.verify(UPDATE_PUBLIC_KEY, signature, 'base64')) {
      console.error('Update signature verification failed!');
      return;
    }
    
    // Verify checksum
    const hash = crypto.createHash('sha256').update(binary).digest('hex');
    if (hash !== update.checksum) {
      console.error('Update checksum mismatch!');
      return;
    }
    
    // Now safe to install
    await installUpdate(binary);
  }
}
```

## Supply Chain Security

### Software Bill of Materials (SBOM)

Generate an SBOM to track all components in your software:

```bash
# Generate SBOM using Syft
syft packages dir:. -o spdx-json > sbom.json

# Generate SBOM for container
syft packages docker:myapp:latest -o cyclonedx-json > sbom.json
```

### Container Image Signing

Sign container images to ensure integrity:

```bash
# Sign with Cosign
cosign sign --key cosign.key myregistry/myapp:v1.0.0

# Verify before deploying
cosign verify --key cosign.pub myregistry/myapp:v1.0.0
```

Enforce signature verification in Kubernetes:

```yaml
# Kyverno policy to require signed images
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-image-signature
spec:
  validationFailureAction: enforce
  rules:
  - name: verify-signature
    match:
      resources:
        kinds:
        - Pod
    verifyImages:
    - imageReferences:
      - "myregistry/*"
      attestors:
      - entries:
        - keys:
            publicKeys: |
              -----BEGIN PUBLIC KEY-----
              ...
              -----END PUBLIC KEY-----
```

## Key Takeaways

1. **Never deserialize untrusted data** - use JSON, avoid eval
2. **Use lock files** and verify package integrity
3. **Sign code and artifacts** in your CI/CD pipeline
4. **Verify signatures** before deploying or installing updates
5. **Generate SBOMs** to track your software supply chain
6. **Use Subresource Integrity** for CDN-hosted scripts
7. **Sign container images** and enforce verification
8. **Require signed commits** for sensitive repositories

Software supply chain attacks are increasing in sophistication. Building integrity verification into your development and deployment processes is essential for defense.
