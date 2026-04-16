---
title: 'Software Supply Chain Security: SBOMs, Sigstore, and SLSA in Practice'
excerpt: 'Protect your software supply chain with practical steps for SBOM generation, artifact signing with Cosign, and SLSA provenance. Includes complete CI/CD pipeline examples for GitHub Actions and GitLab CI.'
category:
  name: 'Security'
  slug: 'security'
date: '2025-01-24'
publishedAt: '2025-01-24T09:00:00Z'
updatedAt: '2025-01-24T09:00:00Z'
readingTime: '11 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
coverImage: '/images/posts/software-supply-chain-security.png'
ogImage: '/images/posts/software-supply-chain-security.svg'
tags:
  - Security
  - Supply Chain
  - SBOM
  - Sigstore
  - SLSA
---

Supply chain attacks have become one of the most damaging threats in software. SolarWinds compromised 18,000 organizations through a poisoned build system. Log4Shell affected millions of applications through a single transitive dependency. The event-stream npm package had Bitcoin-stealing code injected by a malicious maintainer.

These are not edge cases. The average Node.js application pulls in over 1,000 transitive dependencies, and most teams have no idea what is actually running in production. Each dependency is a potential entry point, and one compromised package can cascade across thousands of applications.

This guide covers the three pillars of supply chain security: knowing what is inside your software (SBOM), proving artifacts are authentic (signing), and verifying how they were built (SLSA).

## The Three Pillars

```
Supply Chain Security
  SBOM (What's inside?) - Track all components and dependencies
  Signing (Can we trust it?) - Verify authenticity of artifacts
  SLSA (How was it built?) - Prove build integrity and provenance
```

Start with SBOMs because they are the easiest to adopt. Add signing next. Then work toward SLSA compliance.

## Software Bill of Materials (SBOM)

An SBOM is a machine-readable inventory of every component in your software. Think of it as an ingredients list for your application. When Log4Shell hit in December 2021, organizations with SBOMs answered "Do we use Log4j?" in minutes. Everyone else spent days manually searching codebases.

```bash
# With SBOM: instant answer
grype sbom:app-v1.0.0.json | grep log4j

# Without SBOM: hours of incomplete searching
find . -name '*log4j*.jar'      # Misses transitive deps
grep -r 'log4j' pom.xml          # Incomplete
```

SBOMs are also a regulatory requirement now. US Executive Order 14028 requires SBOMs for federal software. The FDA requires them for medical device approval.

### SBOM Formats: CycloneDX vs SPDX

Two formats dominate. Use CycloneDX for security-focused workflows (it has better vulnerability and VEX integration). Use SPDX for licensing and compliance (it is an ISO standard).

### Generating SBOMs with Syft

Anchore's Syft is the best general-purpose SBOM generator. It supports containers, filesystems, and archives across every major language ecosystem:

```bash
# Install Syft
curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh

# Generate SBOM for a Docker image
syft ghcr.io/myorg/myapp:v1.0.0 -o cyclonedx-json > sbom.json

# For a local directory
syft dir:. -o spdx-json > sbom-spdx.json
```

### Scanning SBOMs for Vulnerabilities

Pair Syft with Grype to scan your SBOM for known vulnerabilities:

```bash
grype sbom:sbom.json

# Output:
# NAME      INSTALLED  VULNERABILITY   SEVERITY
# express   4.17.1     CVE-2022-24999  High
# log4j     2.14.1     CVE-2021-44228  Critical
```

You can also use SBOMs for license compliance checks:

```bash
# Find all GPL-licensed dependencies
jq '.components[] | select(.licenses[0].license.id | contains("GPL"))' sbom.json
```

### SBOM Best Practices

Generate SBOMs on every build and include the full dependency tree (not just direct dependencies). Transitive dependencies are where the risk hides. Store SBOMs alongside your artifacts, either as release assets or OCI artifacts in your registry. Sign them too.

## Artifact Signing with Sigstore

Signing proves that a build artifact has not been tampered with and comes from a trusted source. Sigstore makes this practical by providing keyless signing through OpenID Connect, so you do not have to manage private keys.

### The Sigstore Ecosystem

Sigstore has four components:
- **Cosign** is the CLI tool for signing and verification
- **Fulcio** issues short-lived certificates tied to your OIDC identity
- **Rekor** is an immutable transparency log that records every signature
- **Policy Controller** is a Kubernetes admission webhook that rejects unsigned images

### Keyless Signing with Cosign

Keyless signing is the recommended approach. It uses your existing identity (GitHub, Google, Microsoft) instead of long-lived private keys:

```bash
# Sign a container image (opens browser for OIDC auth)
cosign sign ghcr.io/myorg/myapp:v1.0.0

# Verify the signature
cosign verify ghcr.io/myorg/myapp:v1.0.0 \
  --certificate-identity=user@example.com \
  --certificate-oidc-issuer=https://github.com/login/oauth
```

For air-gapped environments where OIDC is not available, generate a key pair instead:

```bash
cosign generate-key-pair
cosign sign --key cosign.key ghcr.io/myorg/myapp:v1.0.0
cosign verify --key cosign.pub ghcr.io/myorg/myapp:v1.0.0
```

### Signing in CI/CD

In GitHub Actions, keyless signing works out of the box with the `id-token: write` permission:

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

      - name: Build and push image
        run: |
          docker build -t ghcr.io/${{ github.repository }}:${{ github.sha }} .
          docker push ghcr.io/${{ github.repository }}:${{ github.sha }}

      - name: Sign image
        run: cosign sign --yes ghcr.io/${{ github.repository }}:${{ github.sha }}
```

### Sign Your SBOMs Too

SBOMs should be signed and attached to the image they describe:

```bash
# Generate SBOM
syft ghcr.io/myorg/myapp:v1.0.0 -o cyclonedx-json > sbom.json

# Sign the SBOM file
cosign sign-blob sbom.json --bundle sbom.json.bundle

# Attach SBOM to image in the registry
cosign attach sbom ghcr.io/myorg/myapp:v1.0.0 --sbom sbom.json
```

### Enforce Signatures in Kubernetes

The Sigstore Policy Controller rejects unsigned images at the admission level:

```yaml
apiVersion: policy.sigstore.dev/v1beta1
kind: ClusterImagePolicy
metadata:
  name: require-signed-images
spec:
  images:
    - glob: "ghcr.io/myorg/**"
  authorities:
    - keyless:
        identities:
          - issuer: https://github.com/login/oauth
            subject: https://github.com/myorg/*
```

With this in place, deploying an unsigned image fails immediately:

```bash
kubectl run test --image=ghcr.io/myorg/unsigned:latest
# Error: admission webhook denied the request: validation failed: no matching signatures
```

## SLSA Framework

SLSA (pronounced "salsa") answers the question: "How can we trust this artifact?" It defines four levels of supply chain integrity that describe how secure your build process is.

| Level | What It Requires | What It Prevents |
|-------|-----------------|------------------|
| SLSA 1 | Build process documented, provenance exists | Nothing formal, but establishes a baseline |
| SLSA 2 | Signed provenance from a trusted service | Tampered builds |
| SLSA 3 | Hardened build platform with access controls | Insider threats, compromised build servers |
| SLSA 4 | Two-party review, hermetic reproducible builds | Everything up to nation-state attacks |

The SolarWinds attack would have been caught at SLSA 3 because it requires a hardened build platform where injecting malware into the build process triggers provenance verification failures.

### Getting to SLSA 2

Most teams should target SLSA 2 as a starting point. GitHub Actions provides this nearly out of the box with the SLSA generator:

```yaml
name: SLSA Provenance

on:
  push:
    tags: ['v*']

permissions:
  actions: read
  id-token: write
  packages: write
  contents: write

jobs:
  build:
    outputs:
      digest: ${{ steps.build.outputs.digest }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build and push
        id: build
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.ref_name }}

  provenance:
    needs: [build]
    permissions:
      actions: read
      id-token: write
      packages: write
    uses: slsa-framework/slsa-github-generator/.github/workflows/generator_container_slsa3.yml@v1.9.0
    with:
      image: ghcr.io/${{ github.repository }}
      digest: ${{ needs.build.outputs.digest }}
      registry-username: ${{ github.actor }}
    secrets:
      registry-password: ${{ secrets.GITHUB_TOKEN }}
```

### Verifying Provenance

Before deploying, verify that the image was built by a trusted pipeline:

```bash
slsa-verifier verify-image ghcr.io/myorg/myapp:v1.0.0 \
  --source-uri github.com/myorg/myapp \
  --source-tag v1.0.0
```

## Putting It All Together: Complete CI/CD Pipeline

Here is a full supply chain security pipeline that generates SBOMs, scans for vulnerabilities, signs everything, and creates SLSA provenance:

```yaml
name: Secure Supply Chain

on:
  push:
    tags: ['v*']

permissions:
  contents: write
  packages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      image-digest: ${{ steps.build.outputs.digest }}
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

      - name: Build and push
        id: build
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.ref_name }}

      - name: Generate SBOM
        run: |
          curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin
          syft ghcr.io/${{ github.repository }}:${{ github.ref_name }} \
            -o cyclonedx-json=sbom.json

      - name: Scan for vulnerabilities
        run: |
          curl -sSfL https://raw.githubusercontent.com/anchore/grype/main/install.sh | sh -s -- -b /usr/local/bin
          grype sbom:sbom.json --fail-on critical

      - name: Install Cosign
        uses: sigstore/cosign-installer@v3

      - name: Sign image
        run: cosign sign --yes ghcr.io/${{ github.repository }}:${{ github.ref_name }}

      - name: Attach and sign SBOM
        run: |
          cosign attach sbom --sbom sbom.json --type cyclonedx \
            ghcr.io/${{ github.repository }}:${{ github.ref_name }}

  provenance:
    needs: [build]
    permissions:
      actions: read
      id-token: write
      packages: write
    uses: slsa-framework/slsa-github-generator/.github/workflows/generator_container_slsa3.yml@v1.9.0
    with:
      image: ghcr.io/${{ github.repository }}
      digest: ${{ needs.build.outputs.image-digest }}
      registry-username: ${{ github.actor }}
    secrets:
      registry-password: ${{ secrets.GITHUB_TOKEN }}
```

### Pre-Deployment Verification Script

Before anything reaches production, verify the full chain:

```bash
#!/bin/bash
set -euo pipefail

IMAGE=$1
echo "Verifying supply chain for $IMAGE..."

# 1. Verify signature
echo "[1/3] Checking signature..."
cosign verify $IMAGE \
  --certificate-identity-regexp='^https://github.com/myorg/' \
  --certificate-oidc-issuer=https://token.actions.githubusercontent.com

# 2. Verify SLSA provenance
echo "[2/3] Checking SLSA provenance..."
slsa-verifier verify-image $IMAGE \
  --source-uri github.com/myorg/myapp

# 3. Scan for critical vulnerabilities
echo "[3/3] Scanning for vulnerabilities..."
cosign download sbom $IMAGE > /tmp/sbom.json
grype sbom:/tmp/sbom.json --fail-on critical

echo "Supply chain verification passed."
```

## Where to Start

Supply chain security is a journey, not a weekend project. Here is a practical order:

1. **Generate SBOMs on every build.** Install Syft in your CI pipeline and store SBOMs as build artifacts. This takes 15 minutes to set up and pays off the first time a critical CVE drops.

2. **Add vulnerability scanning.** Pair Grype with your SBOMs and fail builds on critical vulnerabilities.

3. **Sign your container images.** Cosign with keyless signing is straightforward in GitHub Actions. It adds one step to your pipeline.

4. **Enforce signatures in Kubernetes.** Deploy the Sigstore Policy Controller so unsigned images cannot run.

5. **Generate SLSA provenance.** Use `slsa-github-generator` to reach SLSA 2/3 automatically.

6. **Monitor and improve.** Track signing rates, SBOM coverage, and SLSA levels across your organization. Alert on unsigned deployments.

The tools are mature, the workflows are documented, and most of this can be automated in a single CI/CD pipeline. The only thing worse than a supply chain attack is one that you could have prevented with a few hours of setup.
