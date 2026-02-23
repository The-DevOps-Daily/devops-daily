---
title: 'CI/CD Integration'
description: 'Automate supply chain security in your CI/CD pipeline. Generate SBOMs, sign artifacts, create SLSA provenance, and enforce policies.'
---

# CI/CD Integration

A secure supply chain requires automation. This guide shows you how to integrate SBOM generation, artifact signing, and SLSA provenance into your CI/CD pipeline.

## Complete Supply Chain Pipeline

```plaintext
Code Commit
  ↓
Build + Test
  ↓
Generate SBOM (Syft)
  ↓
Scan Vulnerabilities (Grype)
  ↓
Sign Image (Cosign)
  ↓
Generate SLSA Provenance
  ↓
Sign Provenance
  ↓
Push to Registry
  ↓
Verify Before Deploy
```

## GitHub Actions (Complete Example)

### Full Supply Chain Workflow

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
          cache-from: type=gha
          cache-to: type=gha,mode=max
      
      - name: Install Syft
        run: curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin
      
      - name: Generate SBOM
        run: |
          syft ghcr.io/${{ github.repository }}:${{ github.ref_name }} \\
            -o cyclonedx-json=sbom.json \\
            -o spdx-json=sbom-spdx.json
      
      - name: Install Grype
        run: curl -sSfL https://raw.githubusercontent.com/anchore/grype/main/install.sh | sh -s -- -b /usr/local/bin
      
      - name: Scan for vulnerabilities
        run: |
          grype sbom:sbom.json --fail-on critical
      
      - name: Install Cosign
        uses: sigstore/cosign-installer@v3
      
      - name: Sign image
        run: |
          cosign sign --yes ghcr.io/${{ github.repository }}:${{ github.ref_name }}
      
      - name: Attach SBOM to image
        run: |
          cosign attach sbom \\
            --sbom sbom.json \\
            --type cyclonedx \\
            ghcr.io/${{ github.repository }}:${{ github.ref_name }}
      
      - name: Sign SBOM
        run: |
          cosign sign --yes ghcr.io/${{ github.repository }}:sha256-$(echo ${{ steps.build.outputs.digest }} | cut -d: -f2).sbom
      
      - name: Upload SBOM to release
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          gh release upload ${{ github.ref_name }} sbom.json sbom-spdx.json

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

  verify:
    needs: [build, provenance]
    runs-on: ubuntu-latest
    steps:
      - name: Install slsa-verifier
        run: |
          go install github.com/slsa-framework/slsa-verifier/v2/cli/slsa-verifier@latest
      
      - name: Verify SLSA provenance
        run: |
          slsa-verifier verify-image \\
            ghcr.io/${{ github.repository }}:${{ github.ref_name }} \\
            --source-uri github.com/${{ github.repository }} \\
            --source-tag ${{ github.ref_name }}
      
      - name: Install Cosign
        uses: sigstore/cosign-installer@v3
      
      - name: Verify signature
        run: |
          cosign verify \\
            --certificate-identity-regexp='^https://github.com/${{ github.repository }}' \\
            --certificate-oidc-issuer=https://token.actions.githubusercontent.com \\
            ghcr.io/${{ github.repository }}:${{ github.ref_name }}
```

## GitLab CI (Complete Example)

```yaml
stages:
  - build
  - sbom
  - scan
  - sign
  - deploy

variables:
  IMAGE: $CI_REGISTRY_IMAGE:$CI_COMMIT_TAG

build:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker build -t $IMAGE .
    - docker push $IMAGE
  only:
    - tags

sbom:
  stage: sbom
  image: anchore/syft:latest
  script:
    - syft $IMAGE -o cyclonedx-json=sbom.json
    - syft $IMAGE -o spdx-json=sbom-spdx.json
  artifacts:
    paths:
      - sbom.json
      - sbom-spdx.json
    reports:
      cyclonedx: sbom.json

scan:
  stage: scan
  image: anchore/grype:latest
  dependencies:
    - sbom
  script:
    - grype sbom:sbom.json --fail-on critical

sign:
  stage: sign
  image: gcr.io/projectsigstore/cosign:latest
  dependencies:
    - sbom
  script:
    - cosign sign --yes $IMAGE
    - cosign attach sbom --sbom sbom.json --type cyclonedx $IMAGE
  id_tokens:
    SIGSTORE_ID_TOKEN:
      aud: sigstore
```

## Jenkins (Complete Example)

```groovy
pipeline {
    agent any
    
    environment {
        IMAGE = \"ghcr.io/myorg/myapp:${env.BUILD_NUMBER}\"
        COSIGN_EXPERIMENTAL = \"1\"
    }
    
    stages {
        stage('Build') {
            steps {
                sh 'docker build -t $IMAGE .'
                sh 'docker push $IMAGE'
            }
        }
        
        stage('SBOM') {
            steps {
                sh '''
                    docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \\
                        anchore/syft:latest $IMAGE -o cyclonedx-json > sbom.json
                '''
                archiveArtifacts artifacts: 'sbom.json'
            }
        }
        
        stage('Scan') {
            steps {
                sh '''
                    docker run --rm -v $(pwd):/workspace \\
                        anchore/grype:latest sbom:/workspace/sbom.json \\
                        --fail-on critical
                '''
            }
        }
        
        stage('Sign') {
            steps {
                withCredentials([string(credentialsId: 'cosign-key', variable: 'COSIGN_KEY')]) {
                    sh '''
                        echo \"$COSIGN_KEY\" > cosign.key
                        cosign sign --key cosign.key $IMAGE
                        rm cosign.key
                    '''
                }
            }
        }
    }
}
```

## Deployment Verification

### Kubernetes Admission Control

Enforce signature and provenance verification before deployment:

```yaml
apiVersion: policy.sigstore.dev/v1beta1
kind: ClusterImagePolicy
metadata:
  name: supply-chain-policy
spec:
  images:
    - glob: \"ghcr.io/myorg/**\"
  authorities:
    - keyless:
        identities:
          - issuerRegExp: \".*\"
            subjectRegExp: \"^https://github.com/myorg/.*\"
    - attestations:
        - predicateType: \"https://slsa.dev/provenance/v0.2\"
          name: slsa-provenance
          policy:
            type: cue
            data: |
              predicateType: \"https://slsa.dev/provenance/v0.2\"
              predicate: builder: id: =~\"^https://github.com/slsa-framework/\"
```

### Pre-Deployment Check Script

```bash
#!/bin/bash
set -euo pipefail

IMAGE=$1

echo \"Verifying supply chain for $IMAGE...\"

# 1. Verify signature
echo \"[1/3] Checking signature...\"
cosign verify $IMAGE \\
  --certificate-identity-regexp='^https://github.com/myorg/' \\
  --certificate-oidc-issuer=https://token.actions.githubusercontent.com

# 2. Verify SLSA provenance
echo \"[2/3] Checking SLSA provenance...\"
slsa-verifier verify-image $IMAGE \\
  --source-uri github.com/myorg/myapp

# 3. Check for critical vulnerabilities in SBOM
echo \"[3/3] Scanning for vulnerabilities...\"
SBOM_DIGEST=$(cosign triangulate $IMAGE | grep '.sbom')
cosign download sbom $SBOM_DIGEST > /tmp/sbom.json
grype sbom:/tmp/sbom.json --fail-on critical

echo \"✅ Supply chain verification passed!\"
```

## Monitoring and Metrics

### Track Supply Chain Health

```yaml
# Prometheus metrics
supply_chain_signed_images_total
supply_chain_sbom_generated_total
supply_chain_slsa_level
supply_chain_vulnerability_scan_duration_seconds
```

### Grafana Dashboard

Key metrics to track:
- Percentage of signed images
- SLSA level distribution
- SBOM generation success rate
- Critical vulnerabilities detected
- Time to fix vulnerabilities

## Best Practices

1. **Automate everything**
   - SBOM generation on every build
   - Automatic signing in CI/CD
   - SLSA provenance generation

2. **Fail fast**
   ```yaml
   - name: Scan vulnerabilities
     run: grype $IMAGE --fail-on critical
   ```

3. **Verify before deploy**
   - Pre-deployment checks
   - Kubernetes admission control

4. **Store artifacts**
   - SBOMs with releases
   - Provenance in registry
   - Signatures attached to images

5. **Monitor compliance**
   - Track signing rate
   - Alert on unsigned deployments

6. **Use caching**
   ```yaml
   - uses: actions/cache@v3
     with:
       path: ~/.cache/grype
       key: grype-db-${{ github.run_id }}
   ```

7. **Separate build and sign**
   - Build artifacts in one job
   - Sign in dedicated job with minimal permissions

## Troubleshooting

### SBOM Generation Fails

```bash
# Check Syft version
syft version

# Enable debug mode
syft $IMAGE -o cyclonedx-json -vv
```

### Signing Fails

```bash
# Check OIDC token
echo $SIGSTORE_ID_TOKEN

# Verify registry access
docker pull $IMAGE
```

### Verification Fails

```bash
# Check signature exists
cosign triangulate $IMAGE

# Verify SLSA provenance manually
slsa-verifier verify-image $IMAGE --source-uri $REPO --print-provenance
```

## Complete Security Checklist

- [ ] SBOM generated on every build
- [ ] SBOM includes all transitive dependencies
- [ ] Vulnerabilities scanned automatically
- [ ] Critical vulnerabilities fail the build
- [ ] All artifacts signed (images, binaries, SBOMs)
- [ ] SLSA provenance generated (level 2+)
- [ ] Provenance is signed
- [ ] Signatures verified before deployment
- [ ] Kubernetes admission control enforces policies
- [ ] Supply chain metrics monitored
- [ ] Incident response plan for supply chain breaches

## Next Steps

You've now implemented a complete supply chain security pipeline! Continue improving:

1. **Increase SLSA level** — Move from SLSA 2 to SLSA 3
2. **Add VEX documents** — Document vulnerability triage decisions
3. **Implement GUAC** — Graph-based supply chain analysis
4. **Monitor transparency logs** — Alert on unexpected signing activity

---

**Congratulations!** You now have production-grade supply chain security. Remember: supply chain security is a journey, not a destination. Keep improving.
