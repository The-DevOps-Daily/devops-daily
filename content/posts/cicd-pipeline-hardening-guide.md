---
title: 'CI/CD Pipeline Hardening: A Practical Guide to Securing Your Build Infrastructure'
excerpt: 'Your CI/CD pipeline has access to source code, secrets, and production environments. Here is how to harden it against supply chain attacks, secret exfiltration, and artifact tampering.'
category:
  name: 'Security'
  slug: 'security'
coverImage: '/images/posts/cicd-pipeline-hardening-guide.png'
ogImage: '/images/posts/cicd-pipeline-hardening-guide.svg'
date: '2025-01-24'
publishedAt: '2025-01-24T09:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - security
  - cicd
  - pipeline-security
  - supply-chain
---

Most teams treat their CI/CD pipeline as a trusted internal tool. It runs tests, builds images, and deploys code. Nobody thinks about it until it breaks. But your pipeline has access to everything an attacker wants: source code, cloud credentials, production environments, and signing keys. A compromised pipeline can inject malicious code into every single deployment without anyone noticing.

This is not a theoretical risk. The 2020 SolarWinds attack modified the build process to inject a backdoor into Orion software, affecting 18,000 organizations including US government agencies. In 2021, Codecov's bash uploader was compromised and quietly exfiltrated environment variables from roughly 29,000 CI environments over two months. These attacks worked because the build infrastructure was the least defended part of the software supply chain.

If you are running CI/CD pipelines today without explicit security controls, you have a problem worth fixing.

## How Attackers Think About Your Pipeline

Your pipeline has multiple attack surfaces, and attackers know every one of them:

- **Source and dependencies**: Compromised packages, typosquatting, dependency confusion attacks where a malicious public package shadows your internal one
- **CI configuration**: A malicious pull request modifies `.github/workflows/ci.yml` to exfiltrate secrets to an external server
- **Build environment**: Runner compromise, container escapes, persistent access between jobs
- **Secrets**: Credential theft through log exposure or exfiltration in PR builds
- **Artifacts**: Tampering between build and deployment, injecting backdoors into images

Each one represents a real attack pattern that has been used in the wild. The dependency confusion technique alone has been used successfully against Apple, Microsoft, and dozens of other organizations.

## Five Security Principles That Actually Matter

Before jumping into specific controls, internalize these principles. They should guide every decision you make about pipeline security.

**Least privilege.** Every job should have the minimum permissions it needs. In GitHub Actions, that means explicit permissions per job:

```yaml
jobs:
  build:
    permissions:
      contents: read      # Only read source code
      packages: write     # Write to package registry
    steps:
      - uses: actions/checkout@v4
```

Never use `permissions: write-all`. If you see that in your workflows, fix it today.

**Defense in depth.** No single control is perfect. Layer them: branch protection rules, pipeline config validation, secret management with vault integration, runner isolation, artifact signing, and deployment approval gates. An attacker bypassing one layer should still face five more.

**Immutability.** Tag images with the commit SHA, not `latest`. Once an artifact is built, it should not be overwritten:

```yaml
# Good - immutable reference
docker build -t myapp:${{ github.sha }} .

# Bad - mutable tag that can be overwritten
docker build -t myapp:latest .
```

**Auditability.** Log everything. Capture who triggered the build, what commit was built, which workflow ran, and the run ID. When something goes wrong, forensics start with build provenance.

**Fail closed.** When a security scan fails, the build should fail too. No exceptions, no "we will fix it later" flags in production pipelines:

```yaml
- name: Security scan
  run: |
    trivy image myapp:${{ github.sha }} --exit-code 1
```

## Securing Your Runners

Runners execute your pipeline code. A compromised runner means an attacker can steal secrets, modify builds, and pivot to other systems. The type of runner you use determines your baseline security posture.

**Ephemeral runners are non-negotiable for sensitive workloads.** A persistent self-hosted runner that survives between jobs is an invitation for lateral movement. Configure ephemeral runners that get destroyed after each job:

```yaml
# Self-hosted runner with ephemeral flag
./config.sh --url https://github.com/org/repo \
  --token TOKEN \
  --ephemeral
```

For Kubernetes-based runners, use actions-runner-controller with ephemeral mode enabled.

### GitLab CI Runner Hardening

If you use GitLab, your `config.toml` should drop all capabilities and disable privileged mode:

```toml
[[runners]]
  name = "secure-runner"
  executor = "docker"
  [runners.docker]
    image = "alpine:latest"
    privileged = false
    disable_entrypoint_overwrite = true
    cap_drop = ["ALL"]
    security_opt = ["no-new-privileges:true"]
    network_mode = "bridge"
```

For Kubernetes executors, enforce `run_as_non_root = true` and apply AppArmor profiles.

### Jenkins Container Agents

Jenkinsfiles should use container agents with capabilities dropped and isolated networks:

```groovy
pipeline {
    agent {
        docker {
            image 'maven:3.9-eclipse-temurin-17'
            args '--network=isolated --cap-drop=ALL'
        }
    }
    stages {
        stage('Build') {
            steps {
                sh 'mvn clean package'
            }
        }
    }
}
```

### Network Isolation

Restrict what your runners can talk to. If your build only needs GitHub and your package registry, block everything else:

```bash
iptables -A OUTPUT -d github.com -p tcp --dport 443 -j ACCEPT
iptables -A OUTPUT -d ghcr.io -p tcp --dport 443 -j ACCEPT
iptables -A OUTPUT -d registry.npmjs.org -p tcp --dport 443 -j ACCEPT
iptables -A OUTPUT -j DROP
```

### Stop Running Docker-in-Docker Privileged

Privileged DinD is a container escape waiting to happen. Use Kaniko instead for building images without a Docker daemon:

```yaml
build:
  image:
    name: gcr.io/kaniko-project/executor:latest
    entrypoint: [""]
  script:
    - /kaniko/executor
        --context $CI_PROJECT_DIR
        --dockerfile Dockerfile
        --destination $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
```

## Secrets and Credentials

A single exposed API key or database password can compromise your entire infrastructure. The rules are straightforward but routinely violated.

**Never hardcode secrets.** This seems obvious, but it happens constantly:

```yaml
# GitHub Actions - use secret references
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_KEY }}
```

**Use environment scoping.** GitHub Actions, GitLab CI, and Jenkins all support environment-level secrets with approval gates. Production secrets should require manual approval and only be accessible on protected branches:

```yaml
jobs:
  deploy-staging:
    environment: staging

  deploy-production:
    needs: deploy-staging
    environment: production  # Requires manual approval
```

### Use OIDC Instead of Static Credentials

OpenID Connect lets your pipeline authenticate to cloud providers without storing long-lived credentials. This is the single highest-impact change you can make for secrets security:

```yaml
permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789:role/github-actions
          aws-region: us-east-1
          # No static credentials stored anywhere
```

The AWS IAM trust policy locks this down to your specific repo:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::123456789:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringLike": {
        "token.actions.githubusercontent.com:sub": "repo:myorg/myrepo:*"
      }
    }
  }]
}
```

### Vault Integration for Dynamic Secrets

For workloads that need database credentials or other rotating secrets, HashiCorp Vault can generate short-lived credentials on demand:

```yaml
- name: Import Secrets from Vault
  uses: hashicorp/vault-action@v2
  with:
    url: https://vault.example.com
    method: jwt
    role: github-actions
    secrets: |
      secret/data/prod/database url | DATABASE_URL ;
      secret/data/prod/api key | API_KEY
```

Vault's database secrets engine auto-generates credentials with a 1-hour TTL, so even if they leak, the window of exposure is tiny.

### Prevent Exfiltration

Block outbound network access from untrusted code to prevent secrets from being sent to external servers:

```yaml
- name: Run untrusted tests
  run: |
    unshare --net ./run-tests.sh
```

## Artifact Security and Supply Chain Integrity

Your build artifacts are the final output of the pipeline. If an attacker tampers with them between build and deployment, everything upstream was pointless.

### Sign Container Images with Cosign

Cosign from Sigstore enables keyless signing of container images using your CI platform's OIDC identity:

```yaml
permissions:
  contents: read
  packages: write
  id-token: write

steps:
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
```

Then enforce signature verification in your Kubernetes cluster with a Kyverno admission policy:

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-image-signatures
spec:
  validationFailureAction: Enforce
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

This means no unsigned image can run in your cluster. Period.

### Generate SLSA Provenance

The SLSA framework (Supply-chain Levels for Software Artifacts) provides a maturity model for supply chain security. At Level 3, you get isolated builds with non-falsifiable provenance. GitHub makes this straightforward with the SLSA generator:

```yaml
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

### Generate an SBOM

A Software Bill of Materials lists every component in your artifact. When the next Log4j-style vulnerability drops, you need to know which of your services are affected within minutes, not days:

```yaml
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

### Pin Everything

Mutable references are a supply chain risk. Pin base images by digest, not tag:

```dockerfile
FROM node:20-alpine@sha256:abc123def456...

RUN apk add --no-cache \
    curl=8.5.0-r0 \
    openssl=3.1.4-r2

COPY package-lock.json ./
RUN npm ci --ignore-scripts
```

## Quick Security Checklist

Run through this list for your existing pipelines:

- Explicit permissions defined for each job (no `write-all`)
- Secrets not accessible from PR builds
- Dependencies pinned with lockfiles and integrity hashes
- External scripts verified before execution
- Runners are ephemeral with no persistent storage between jobs
- Network egress restricted from runners
- OIDC used instead of long-lived cloud credentials
- Container images signed with Cosign
- SLSA provenance generated for builds
- SBOMs generated and attached to artifacts
- Base images pinned by digest
- CODEOWNERS protecting `.github/`, `Dockerfile`, and CI configs
- Audit logs enabled and monitored

If you checked fewer than half of these, your pipeline is likely more exposed than you think. Start with OIDC, explicit permissions, and ephemeral runners. Those three changes alone eliminate the most common attack vectors.

Pipeline security is not a one-time project. It is an ongoing practice of reducing attack surface, limiting blast radius, and verifying that what you deploy is exactly what you built.
