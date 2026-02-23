---
title: 'SLSA Framework'
description: 'Implement Supply chain Levels for Software Artifacts (SLSA) to prove build provenance and achieve hermetic, reproducible builds.'
---

# SLSA Framework

SLSA (Supply chain Levels for Software Artifacts) is a security framework that defines levels of supply chain integrity. It provides a common language for describing how secure your build process is.

## What is SLSA?

SLSA (pronounced \"salsa\") answers the question: **\"How can we trust this artifact?\"**

It defines 4 levels of increasing security:

| Level | Requirements | Protection |
|-------|--------------|------------|
| **SLSA 1** | Build process documented | Basic transparency |
| **SLSA 2** | Signed provenance | Tamper-evident builds |
| **SLSA 3** | Hardened build platform | Insider threat protection |
| **SLSA 4** | Two-party review + hermetic builds | Highest integrity |

## Why SLSA Matters

### SolarWinds Attack Analysis

SolarWinds breach would have been prevented by SLSA 3:

```plaintext
Attack: Compromised build server injected malware
SLSA 3 Requirement: Hardened build platform with access controls
Result: Attack detected via provenance verification
```

### Codecov Breach

```plaintext
Attack: Modified bash script in CI
SLSA 2 Requirement: Signed provenance with script hashes
Result: Tampering detected before deployment
```

## SLSA Levels Explained

### SLSA 1: Build Documentation

**Requirements:**
- Build process exists
- Provenance generated (unsigned)

**Example provenance:**

```json
{
  \"buildType\": \"https://github.com/actions/workflow\",
  \"builder\": {\"id\": \"https://github.com/myorg/myapp/.github/workflows/build.yml@main\"},
  \"invocation\": {
    \"configSource\": {
      \"uri\": \"git+https://github.com/myorg/myapp\",
      \"digest\": {\"sha1\": \"abc123\"}
    }
  },
  \"metadata\": {
    \"buildStartedOn\": \"2025-01-24T10:00:00Z\",
    \"buildFinishedOn\": \"2025-01-24T10:15:00Z\"
  }
}
```

**Benefit:** Know how artifact was built

### SLSA 2: Signed Provenance

**Requirements:**
- Everything in SLSA 1
- Provenance is signed
- Service generates provenance (not user script)

**Example:**

```bash
# Generate signed provenance
slsa-provenance generate \\
  --artifact myapp:v1.0.0 \\
  --builder github.com/myorg/myapp/.github/workflows/release.yml \\
  --output provenance.json

# Sign with Cosign
cosign sign-blob provenance.json --bundle provenance.json.bundle

# Attach to image
cosign attach attestation myapp:v1.0.0 --attestation provenance.json
```

**Benefit:** Tamper-evident builds

### SLSA 3: Hardened Build Platform

**Requirements:**
- Everything in SLSA 2
- Build environment is isolated
- Access controls and audit logging
- Provenance can't be forged by build steps

**GitHub Actions SLSA 3:**

GitHub's hosted runners with SLSA generator:

```yaml
name: SLSA 3 Build

on:
  release:
    types: [created]

permissions:
  contents: write
  id-token: write

jobs:
  build:
    uses: slsa-framework/slsa-github-generator/.github/workflows/generator_container_slsa3.yml@v1.9.0
    with:
      image: ghcr.io/${{ github.repository }}
      registry-username: ${{ github.actor }}
    secrets:
      registry-password: ${{ secrets.GITHUB_TOKEN }}
```

**Benefit:** Protection against insider threats

### SLSA 4: Two-Party Review

**Requirements:**
- Everything in SLSA 3
- All changes require approval from two trusted persons
- Hermetic builds (no network access)
- Reproducible builds

**Example (Google Bazel):**

```python
# BUILD.bazel with hermetic dependencies
container_image(
    name = \"app\",
    base = \"@distroless//cc\",
    files = [\":binary\"],
    # All dependencies pinned by hash
)
```

**Benefit:** Highest supply chain integrity

## Generating SLSA Provenance

### GitHub Actions SLSA Generator

**For Container Images:**

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
    permissions:
      contents: read
      packages: write
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

**For Binaries (Go):**

```yaml
jobs:
  build:
    permissions:
      id-token: write
      contents: write
    uses: slsa-framework/slsa-github-generator/.github/workflows/generator_generic_slsa3.yml@v1.9.0
    with:
      base64-subjects: \"${{ needs.build.outputs.hashes }}\"
      upload-assets: true
```

### in-toto Attestation

SLSA provenance uses in-toto attestation format:

```json
{
  \"_type\": \"https://in-toto.io/Statement/v0.1\",
  \"subject\": [
    {
      \"name\": \"ghcr.io/myorg/myapp\",
      \"digest\": {\"sha256\": \"abc123...\"}
    }
  ],
  \"predicateType\": \"https://slsa.dev/provenance/v0.2\",
  \"predicate\": {
    \"builder\": {\"id\": \"https://github.com/myorg/myapp/.github/workflows/release.yml@refs/heads/main\"},
    \"buildType\": \"https://github.com/slsa-framework/slsa-github-generator@v1\",
    \"invocation\": {...},
    \"buildConfig\": {...},
    \"metadata\": {...},
    \"materials\": [
      {\"uri\": \"git+https://github.com/myorg/myapp@refs/heads/main\", \"digest\": {\"sha1\": \"def456\"}}
    ]
  }
}
```

## Verifying SLSA Provenance

### slsa-verifier Tool

```bash
# Install
go install github.com/slsa-framework/slsa-verifier/v2/cli/slsa-verifier@latest

# Verify container image
slsa-verifier verify-image ghcr.io/myorg/myapp:v1.0.0 \\
  --source-uri github.com/myorg/myapp \\
  --source-tag v1.0.0

# Output
Verified build using builder \"https://github.com/slsa-framework/slsa-github-generator/.github/workflows/generator_container_slsa3.yml@refs/tags/v1.9.0\" at commit abc123
```

### Policy Enforcement

**Kubernetes admission controller:**

```yaml
apiVersion: policy.sigstore.dev/v1beta1
kind: ClusterImagePolicy
metadata:
  name: require-slsa3
spec:
  images:
    - glob: \"ghcr.io/myorg/**\"
  authorities:
    - attestations:
        - predicateType: \"https://slsa.dev/provenance/v0.2\"
          name: slsa3-attestation
          policy:
            type: cue
            data: |
              predicateType: \"https://slsa.dev/provenance/v0.2\"
              predicate: builder: id: =~\"^https://github.com/slsa-framework/slsa-github-generator/\"
```

## Achieving Each SLSA Level

### Path to SLSA 1

1. Generate build provenance
2. Store with artifact
3. Done!

```bash
# Minimal provenance
echo '{\"buildType\":\"manual\",\"builder\":{\"id\":\"local\"},\"invocation\":{}}' > provenance.json
```

### Path to SLSA 2

1. Everything in SLSA 1
2. Use trusted service to generate provenance (GitHub Actions, GitLab CI)
3. Sign provenance
4. Attach to artifact

```bash
cosign attest --predicate provenance.json --type slsaprovenance image:tag
```

### Path to SLSA 3

1. Everything in SLSA 2
2. Use SLSA 3 generator (slsa-github-generator)
3. Harden build environment
4. Enable audit logging
5. Implement access controls

**GitHub Actions:** Use `slsa-github-generator` (shown above)

**Self-hosted:** 
- Isolated build environment (containers, VMs)
- No network access during build
- Audit all build activities

### Path to SLSA 4

1. Everything in SLSA 3
2. Require two-party code review
3. Hermetic builds (pinned dependencies)
4. Reproducible builds

**Example (Bazel):**

```python
load(\"@io_bazel_rules_docker//container:container.bzl\", \"container_image\")

container_image(
    name = \"app\",
    base = \"@distroless_base//image\",
    files = [\":binary\"],
    # Hermetic: all deps declared explicitly
)
```

## SLSA Best Practices

1. **Start with SLSA 2**
   - Most organizations should target SLSA 2
   - GitHub Actions provides this out-of-the-box

2. **Verify provenance before deployment**
   ```bash
   slsa-verifier verify-image $IMAGE --source-uri $REPO
   ```

3. **Store provenance with artifacts**
   - Attach to container registry
   - Include in release assets

4. **Audit provenance regularly**
   - Check builder identity
   - Validate source repository

5. **Combine with signing**
   ```bash
   # Generate and sign provenance
   cosign attest --predicate provenance.json --type slsaprovenance image:tag
   ```

6. **Monitor provenance changes**
   - Alert on unexpected builders
   - Track provenance patterns

7. **Document your SLSA level**
   - README badges
   - Security policy

## SLSA Tooling

### Generators
- **slsa-github-generator** (GitHub Actions, SLSA 3)
- **slsa-verifier** (Verification tool)
- **in-toto** (Provenance framework)

### Verification
- **slsa-verifier** (CLI)
- **Sigstore Policy Controller** (Kubernetes)
- **Kyverno** (Policy engine)

### Build Systems
- **GitHub Actions** (SLSA 3 with generator)
- **Google Cloud Build** (SLSA 3)
- **Bazel** (SLSA 4 capable)

## Next Steps

- **[CI/CD Integration](./04-cicd)** — Automate SBOM, signing, and SLSA provenance

---

**Key takeaway**: SLSA 2 is achievable for most teams today. Use `slsa-github-generator` to generate signed provenance automatically.
