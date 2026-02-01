---
title: "Artifact Security and Supply Chain Protection"
description: "Securing build artifacts with signing, SLSA framework, and provenance verification"
---

# Artifact Security and Supply Chain Protection

Build artifacts are the output of your CI/CD pipeline - container images, binaries, packages. Securing them ensures what you deploy is what you built.

## The Supply Chain Threat

Recent attacks have shown the importance of artifact security:
- **SolarWinds (2020)** - Malicious code injected into build process
- **Codecov (2021)** - Compromised bash uploader exfiltrated secrets
- **npm packages** - Typosquatting and dependency confusion attacks

## SLSA Framework

SLSA (Supply-chain Levels for Software Artifacts) provides a maturity model for supply chain security.

**SLSA Levels:**

```
Level 0: No guarantees
   |
Level 1: Documentation of build process
   |      - Build script exists
   |      - Provenance exists
   |
Level 2: Tamper resistance of build service
   |      - Hosted build platform
   |      - Signed provenance
   |
Level 3: Hardened build platform
   |      - Isolated builds
   |      - Non-falsifiable provenance
   |
Level 4: High assurance
          - Two-person review
          - Hermetic builds
```

## Container Image Signing with Cosign

Cosign (from Sigstore) enables keyless signing of container images.

### Keyless Signing with GitHub Actions

```yaml
name: Build and Sign Container

on:
  push:
    branches: [main]

permissions:
  contents: read
  packages: write
  id-token: write  # Required for keyless signing

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Build and Push
        id: build
        uses: docker/build-push-action@v5
        with:
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.sha }}
      
      - name: Install Cosign
        uses: sigstore/cosign-installer@v3
      
      - name: Sign Image
        run: |
          cosign sign --yes \
            ghcr.io/${{ github.repository }}@${{ steps.build.outputs.digest }}
        env:
          COSIGN_EXPERIMENTAL: 1
```

### Verifying Signed Images

```bash
# Verify image signature
cosign verify \
  --certificate-identity-regexp "https://github.com/myorg/.*" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  ghcr.io/myorg/myapp:latest
```

### Kubernetes Admission Control

```yaml
# kyverno-policy.yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-image-signatures
spec:
  validationFailureAction: Enforce
  background: true
  rules:
    - name: verify-cosign-signature
      match:
        any:
          - resources:
              kinds:
                - Pod
      verifyImages:
        - imageReferences:
            - "ghcr.io/myorg/*"
          attestors:
            - entries:
                - keyless:
                    issuer: "https://token.actions.githubusercontent.com"
                    subject: "https://github.com/myorg/*"
```

## Provenance and Attestations

Provenance documents how an artifact was built - source commit, build commands, builder identity.

### Generating SLSA Provenance

```yaml
name: Build with SLSA Provenance

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      digest: ${{ steps.build.outputs.digest }}
    steps:
      - uses: actions/checkout@v4
      
      - name: Build Image
        id: build
        uses: docker/build-push-action@v5
        with:
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.sha }}

  provenance:
    needs: build
    uses: slsa-framework/slsa-github-generator/.github/workflows/generator_container_slsa3.yml@v1.9.0
    with:
      image: ghcr.io/${{ github.repository }}
      digest: ${{ needs.build.outputs.digest }}
    permissions:
      id-token: write
      packages: write
```

### Verifying Provenance

```bash
# Install slsa-verifier
go install github.com/slsa-framework/slsa-verifier/v2/cli/slsa-verifier@latest

# Verify container provenance
slsa-verifier verify-image \
  ghcr.io/myorg/myapp@sha256:abc123... \
  --source-uri github.com/myorg/myapp \
  --source-branch main
```

## Software Bill of Materials (SBOM)

SBOMs list all components in your software for vulnerability tracking.

### Generating SBOM with Syft

```yaml
name: Build with SBOM

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Build Image
        run: docker build -t myapp:latest .
      
      - name: Generate SBOM
        uses: anchore/sbom-action@v0
        with:
          image: myapp:latest
          format: spdx-json
          output-file: sbom.spdx.json
      
      - name: Attach SBOM to Image
        run: |
          cosign attach sbom \
            --sbom sbom.spdx.json \
            ghcr.io/myorg/myapp:latest
```

### SBOM Formats

- **SPDX** - Linux Foundation standard, widely adopted
- **CycloneDX** - OWASP standard, security-focused
- **Syft JSON** - Anchore's native format

## Artifact Registry Security

### Content Trust

```bash
# Docker Content Trust
export DOCKER_CONTENT_TRUST=1

# Push signed image
docker push myregistry.com/myapp:latest

# Pull only verified images
docker pull myregistry.com/myapp:latest
```

### Registry Access Control

```yaml
# GitHub - Restrict package access
# In package settings:
# - Visibility: Private
# - Access: Only specific teams/users
# - Actions: Specific repos only

# ECR Policy
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowPushFromCI",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::123456789:role/github-actions"
      },
      "Action": [
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage"
      ]
    }
  ]
}
```

## Reproducible Builds

Reproducible builds ensure the same source produces identical artifacts.

### Go Reproducible Builds

```dockerfile
# Dockerfile with reproducible Go build
FROM golang:1.21 as builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Reproducible build flags
RUN CGO_ENABLED=0 \
    GOOS=linux \
    GOARCH=amd64 \
    go build -trimpath \
             -ldflags="-s -w -buildid=" \
             -o /app/server ./cmd/server

FROM gcr.io/distroless/static-debian12
COPY --from=builder /app/server /server
ENTRYPOINT ["/server"]
```

### Docker Reproducibility

```dockerfile
# Pin base image by digest, not tag
FROM node:20-alpine@sha256:abc123def456...

# Use specific package versions
RUN apk add --no-cache \
    curl=8.5.0-r0 \
    openssl=3.1.4-r2

# Lock npm dependencies
COPY package-lock.json ./
RUN npm ci --ignore-scripts
```

## Release Artifact Verification

### GitHub Release Checksums

```yaml
name: Release

on:
  push:
    tags: ['v*']

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Build Binaries
        run: |
          GOOS=linux GOARCH=amd64 go build -o myapp-linux-amd64
          GOOS=darwin GOARCH=amd64 go build -o myapp-darwin-amd64
          GOOS=windows GOARCH=amd64 go build -o myapp-windows-amd64.exe
      
      - name: Generate Checksums
        run: |
          sha256sum myapp-* > checksums.txt
      
      - name: Sign Checksums
        run: |
          cosign sign-blob --yes \
            --output-signature checksums.txt.sig \
            checksums.txt
      
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            myapp-*
            checksums.txt
            checksums.txt.sig
```

### Verifying Downloaded Artifacts

```bash
#!/bin/bash
# verify-download.sh

# Download release files
curl -LO https://github.com/myorg/myapp/releases/download/v1.0.0/myapp-linux-amd64
curl -LO https://github.com/myorg/myapp/releases/download/v1.0.0/checksums.txt
curl -LO https://github.com/myorg/myapp/releases/download/v1.0.0/checksums.txt.sig

# Verify signature
cosign verify-blob \
  --certificate-identity-regexp "https://github.com/myorg/.*" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  --signature checksums.txt.sig \
  checksums.txt

# Verify checksum
sha256sum -c checksums.txt --ignore-missing
```

## Artifact Security Checklist

- [ ] All container images signed with Cosign or Docker Content Trust
- [ ] SLSA provenance generated for builds
- [ ] SBOMs generated and attached to artifacts
- [ ] Registry access restricted to CI/CD and authorized users
- [ ] Kubernetes admission policy enforces signature verification
- [ ] Base images pinned by digest
- [ ] Dependencies locked to specific versions
- [ ] Release artifacts include checksums and signatures

## Key Takeaways

1. **Sign everything** - Use Cosign keyless signing for container images
2. **Generate provenance** - SLSA framework provides supply chain transparency
3. **Create SBOMs** - Know what's in your software for vulnerability management
4. **Verify before deploy** - Admission controllers enforce signature policies
5. **Pin versions** - Base images and dependencies pinned by digest/version
