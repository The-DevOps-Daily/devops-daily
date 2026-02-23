---
title: 'Artifact Signing with Sigstore'
description: 'Learn to sign and verify container images, binaries, and SBOMs using Sigstore, Cosign, and keyless signing. Prevent supply chain attacks.'
---

# Artifact Signing with Sigstore

Artifact signing proves that a build artifact (container image, binary, SBOM) hasn't been tampered with and comes from a trusted source. Sigstore provides keyless signing using OpenID Connect, making cryptographic signing accessible without managing private keys.

## Why Sign Artifacts?

### The SolarWinds Attack

In 2020, attackers compromised SolarWinds' build system and injected malware into signed updates. Organizations trusted the signature because they trusted SolarWinds' certificate.

**Artifact signing prevents:**
- **Tampered artifacts** — Detect if image/binary was modified
- **Malicious registries** — Verify source before deployment  
- **Compromised CI/CD** — Require signed builds from trusted pipelines
- **Man-in-the-middle** — Cryptographic proof of authenticity

## Sigstore Ecosystem

### Core Components

```plaintext
Sigstore
├── Cosign (signing tool)
├── Fulcio (certificate authority)
├── Rekor (transparency log)
└── Sigstore Policy Controller (admission control)
```

**Cosign** — CLI tool for signing and verification  
**Fulcio** — Issues short-lived certificates  
**Rekor** — Immutable transparency log (like Certificate Transparency)  
**Policy Controller** — Kubernetes admission webhook for signature verification

## Installing Cosign

```bash
# macOS
brew install cosign

# Linux
wget \"https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64\"
chmod +x cosign-linux-amd64
sudo mv cosign-linux-amd64 /usr/local/bin/cosign

# Docker
docker run gcr.io/projectsigstore/cosign:latest

# Verify installation
cosign version
```

## Keyless Signing (Recommended)

Sigstore's keyless signing uses your OIDC identity (GitHub, Google, Microsoft) instead of managing keys.

### Sign Container Image

```bash
# Build and push image
docker build -t ghcr.io/myorg/myapp:v1.0.0 .
docker push ghcr.io/myorg/myapp:v1.0.0

# Sign with keyless signing (opens browser for OIDC auth)
cosign sign ghcr.io/myorg/myapp:v1.0.0

# Output
Generating ephemeral keys...
Retrieving signed certificate...
Successfully verified SCT...
tlog entry created with index: 12345678
Pushing signature to: ghcr.io/myorg/myapp
```

### Verify Signature

```bash
# Verify with certificate identity
cosign verify ghcr.io/myorg/myapp:v1.0.0 \\
  --certificate-identity=user@example.com \\
  --certificate-oidc-issuer=https://github.com/login/oauth

# Output
Verification for ghcr.io/myorg/myapp:v1.0.0
The following checks were performed on each of these signatures:
  - The cosign claims were validated
  - Existence of the claims in the transparency log was verified offline
  - The code-signing certificate was verified using trusted certificate authority certificates
```

## Key-Based Signing

For air-gapped environments or when OIDC isn't available:

```bash
# Generate key pair
cosign generate-key-pair
# Creates: cosign.key (private) and cosign.pub (public)

# Sign image with private key
cosign sign --key cosign.key ghcr.io/myorg/myapp:v1.0.0

# Verify with public key
cosign verify --key cosign.pub ghcr.io/myorg/myapp:v1.0.0
```

**Store private key securely:**

```bash
# GitHub Actions secrets
gh secret set COSIGN_PRIVATE_KEY < cosign.key
gh secret set COSIGN_PASSWORD

# HashiCorp Vault
vault kv put secret/cosign key=@cosign.key
```

## Signing in CI/CD

### GitHub Actions (Keyless)

```yaml
name: Build and Sign

on:
  push:
    branches: [main]

permissions:
  contents: read
  packages: write
  id-token: write  # Required for keyless signing

jobs:
  build-sign:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install Cosign
        uses: sigstore/cosign-installer@v3
      
      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Build image
        run: |
          docker build -t ghcr.io/${{ github.repository }}:${{ github.sha }} .
          docker push ghcr.io/${{ github.repository }}:${{ github.sha }}
      
      - name: Sign image
        run: |
          cosign sign --yes ghcr.io/${{ github.repository }}:${{ github.sha }}
```

### GitHub Actions (Key-Based)

```yaml
- name: Sign with private key
  env:
    COSIGN_PASSWORD: ${{ secrets.COSIGN_PASSWORD }}
  run: |
    echo \"${{ secrets.COSIGN_PRIVATE_KEY }}\" > cosign.key
    cosign sign --key cosign.key ghcr.io/${{ github.repository }}:${{ github.sha }}
    rm cosign.key
```

### GitLab CI

```yaml
sign:
  stage: sign
  image: gcr.io/projectsigstore/cosign:latest
  script:
    - cosign sign --yes $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
  id_tokens:
    SIGSTORE_ID_TOKEN:
      aud: sigstore
```

## Signing SBOMs

```bash
# Generate SBOM
syft ghcr.io/myorg/myapp:v1.0.0 -o cyclonedx-json > sbom.json

# Sign SBOM file
cosign sign-blob sbom.json --bundle sbom.json.bundle

# Attach SBOM to image
cosign attach sbom ghcr.io/myorg/myapp:v1.0.0 --sbom sbom.json

# Verify attached SBOM
cosign verify-attestation ghcr.io/myorg/myapp:v1.0.0 \\
  --type https://cyclonedx.org/bom \\
  --certificate-identity=ci@example.com
```

## Policy Enforcement

### Kubernetes Admission Control

Sigstore Policy Controller enforces signature verification:

```bash
# Install policy controller
kubectl apply -f https://github.com/sigstore/policy-controller/releases/latest/download/policy-controller.yaml
```

**Create ClusterImagePolicy:**

```yaml
apiVersion: policy.sigstore.dev/v1beta1
kind: ClusterImagePolicy
metadata:
  name: require-signed-images
spec:
  images:
    - glob: \"ghcr.io/myorg/**\"
  authorities:
    - keyless:
        identities:
          - issuer: https://github.com/login/oauth
            subject: https://github.com/myorg/*
```

**Result:** Unsigned images are rejected:

```bash
kubectl run test --image=ghcr.io/myorg/unsigned:latest
# Error: admission webhook denied the request: validation failed: no matching signatures
```

### Docker Content Trust

Docker's built-in signing (pre-Sigstore):

```bash
# Enable DCT
export DOCKER_CONTENT_TRUST=1

# Push signed image
docker push ghcr.io/myorg/myapp:v1.0.0
# Prompts for passphrase

# Verify on pull
docker pull ghcr.io/myorg/myapp:v1.0.0
# Fails if signature invalid
```

## Advanced Features

### Signing with Annotations

```bash
cosign sign ghcr.io/myorg/myapp:v1.0.0 \\
  -a build_id=${{ github.run_id }} \\
  -a commit_sha=${{ github.sha }} \\
  -a repo=${{ github.repository }}

# Verify with annotation
cosign verify ghcr.io/myorg/myapp:v1.0.0 \\
  --certificate-identity=ci@example.com \\
  -a repo=myorg/myapp
```

### Signing Multiple Architectures

```bash
# Sign manifest list (multi-arch)
cosign sign ghcr.io/myorg/myapp:v1.0.0  # Signs all architectures

# Verify specific platform
cosign verify ghcr.io/myorg/myapp:v1.0.0@sha256:abc123...
```

### Offline Verification

```bash
# Download Rekor bundle
cosign verify ghcr.io/myorg/myapp:v1.0.0 \\
  --certificate-identity=ci@example.com \\
  --rekor-url=https://rekor.sigstore.dev \\
  > verification.json

# Verify offline using saved bundle
cosign verify ghcr.io/myorg/myapp:v1.0.0 \\
  --offline \\
  --bundle verification.json
```

## Transparency Log (Rekor)

All signatures are recorded in Rekor for auditability:

```bash
# Search Rekor for signatures
rekor-cli search --artifact ghcr.io/myorg/myapp:v1.0.0

# Get entry details
rekor-cli get --uuid <entry-uuid>
```

**Why transparency logs matter:**
- Detect if signing key is compromised (unusual signing activity)
- Audit who signed what and when
- Verify signature existed at a specific time

## Best Practices

1. **Use keyless signing**
   - Easier key management
   - Automatic rotation
   - Audit trail via OIDC

2. **Sign every artifact**
   - Container images
   - Binaries
   - SBOMs
   - Attestations

3. **Verify before deployment**
   - CI/CD verification gates
   - Kubernetes admission control
   - Runtime verification

4. **Include metadata**
   ```bash
   cosign sign -a git_sha=$SHA -a build_id=$ID image:tag
   ```

5. **Automate signing**
   - Sign in CI/CD, not locally
   - Use service accounts for keyless

6. **Monitor Rekor**
   - Alert on unexpected signatures
   - Track signing patterns

7. **Test verification**
   ```bash
   # Should fail
   cosign verify unsigned:image
   
   # Should succeed
   cosign verify signed:image
   ```

## Troubleshooting

### OIDC Authentication Fails

```bash
# Set token manually (CI/CD)
export COSIGN_EXPERIMENTAL=1
export SIGSTORE_ID_TOKEN=$(gcloud auth print-identity-token)
cosign sign --yes image:tag
```

### Verification Fails

```bash
# Check signature exists
cosign triangulate ghcr.io/myorg/myapp:v1.0.0

# Inspect signature
cosign verify ghcr.io/myorg/myapp:v1.0.0 --insecure-ignore-sct
```

### Registry Permissions

```bash
# Ensure write access to push signatures
docker login ghcr.io
cosign sign ghcr.io/myorg/myapp:v1.0.0
```

## Cosign vs Traditional PKI

| Aspect | Traditional PKI | Sigstore/Cosign |
|--------|----------------|----------------|
| **Key Management** | Manual | Automated (keyless) |
| **Certificate Rotation** | Manual | Automatic (short-lived) |
| **Transparency** | None | Public log (Rekor) |
| **Complexity** | High | Low |
| **Cost** | CA fees | Free |

## Next Steps

- **[SLSA Framework](./03-slsa)** — Add build provenance with signed attestations
- **[CI/CD Integration](./04-cicd)** — Automate signing and verification

---

**Key takeaway**: Every artifact should be signed. Start with container images, then expand to binaries and SBOMs.
