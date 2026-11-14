---
title: 'Software Supply Chain Security: CI/CD Pipeline Hardening, SBOMs, Sigstore and SLSA'
excerpt: 'Harden the CI/CD pipeline that builds your software, then prove what it built: isolated runners, OIDC instead of stored keys, restricted egress, SBOMs, keyless signing with Cosign and SLSA provenance with GitHub artifact attestations.'
category:
  name: 'Security'
  slug: 'security'
date: '2025-01-24'
publishedAt: '2025-01-24T09:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '22 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
coverImage: '/images/posts/software-supply-chain-security.jpg'
tags:
  - Security
  - Supply Chain
  - CI/CD
  - SBOM
  - Sigstore
  - SLSA
---

Supply chain attacks hit software where it is built and delivered, not where it runs. In 2020, attackers changed the SolarWinds build server so that Orion updates shipped with a backdoor; SolarWinds said fewer than 18,000 customers installed them. In 2021, a modified Codecov uploader script sent the environment variables of its users' CI jobs, secrets included, to the attackers for about two months. Log4Shell showed the other side: a single transitive dependency that most teams did not know they had.

Your CI/CD pipeline sits in the middle of this. It reads your source code, downloads dependencies and actions from the internet, holds cloud credentials and signing rights, and writes the artifacts that go to production. A pipeline that an attacker can change can put code into every release, and nobody reviews that code.

This post covers both halves: first, harden the pipeline so that it is hard to change and cannot leak its secrets; then make its output verifiable, with an SBOM (what is inside), signatures (who built it) and SLSA provenance (how it was built).

## The Three Pillars

```text
Supply Chain Security
  SBOM (What's inside?) - Track all components and dependencies
  Signing (Can we trust it?) - Verify authenticity of artifacts
  SLSA (How was it built?) - Prove build integrity and provenance
```

All three rest on the pipeline that produces them: a signature from a compromised pipeline is still a valid signature. Harden the pipeline first, then start with SBOMs because they are the easiest to adopt, add signing next, and then provenance.

## How Do I Harden a CI/CD Pipeline?

Treat the pipeline as production infrastructure, because it can change production. These controls stop most real attacks:

1. **Least privilege for every job.** Read-only tokens by default, write permissions only on the job that needs them.
2. **No secrets for untrusted code.** Pull requests from forks, issue titles and branch names are attacker input.
3. **Short-lived cloud credentials through OIDC,** not access keys stored as secrets.
4. **A fresh, unprivileged runner for every job,** and no self-hosted runners for public repositories.
5. **Restricted network egress,** so a compromised step cannot send secrets out.
6. **Everything pinned:** actions to commit SHAs, base images to digests, dependencies to a lockfile.
7. **Signed outputs with provenance,** checked again before deployment.

For GitHub Actions, the [Securing GitHub Actions Workflows](/guides/introduction-to-cicd/09-security-best-practices-and-production-patterns) part of our CI/CD guide shows the first two and the pinning step by step, with zizmor and actionlint. The sections below cover the rest, for GitHub Actions, GitLab CI and Jenkins.

### Where Do Attackers Get Into a Pipeline?

| Entry point                  | Real example                                                                                                                                                        | Control                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| The build system itself      | SolarWinds (2020): malware on the build server added a backdoor during compilation                                                                                  | Ephemeral, isolated build machines; provenance from a hosted builder |
| A tool the pipeline runs     | Codecov (2021): a modified uploader script sent CI environment variables out                                                                                        | Verify downloads by checksum or signature; restrict egress           |
| A third-party action         | `tj-actions/changed-files` (March 2025) and `aquasecurity/trivy-action` (March 2026): version tags were moved to malicious commits that exposed or stole CI secrets | Pin actions to full commit SHAs                                      |
| A dependency                 | Dependency confusion (2021): public packages with the names of internal ones were installed at Apple, Microsoft and dozens of other companies                       | Lockfiles, scoped registries, no install scripts                     |
| The workflow configuration   | A pull request that changes `.github/workflows/` or `.gitlab-ci.yml` to print secrets                                                                               | Fork pull requests get no secrets; `CODEOWNERS` on CI files          |
| The artifact after the build | An image replaced in the registry between build and deploy                                                                                                          | Deploy by digest; verify signatures and provenance at deploy time    |

### How Do I Isolate the Runners?

A runner that serves many jobs keeps files, caches, credentials and processes between them, so one malicious job can tamper with the next one. Give every job a fresh machine or container, and destroy it afterwards.

**GitHub Actions.** GitHub-hosted runners run each job on a fresh VM, except the 1 vCPU `ubuntu-slim` runner, which runs the job in a container. For self-hosted runners, create one VM or pod per job (for example with Actions Runner Controller) and register each with `--ephemeral`, which limits a registration to one job. The flag alone does not clean or replace the machine.

**GitLab CI.** With the Docker executor, every job runs in a new container. Keep it unprivileged in the runner's `config.toml`:

```toml
[[runners]]
  name = "build-runner"
  executor = "docker"
  [runners.docker]
    image = "alpine:3.22"            # default image for jobs that name none
    privileged = false               # no privileged containers
    disable_entrypoint_overwrite = true
    cap_drop = ["ALL"]               # add back single capabilities with cap_add if a job needs them
    security_opt = ["no-new-privileges:true"]
```

Mark the runners that hold deployment credentials as **protected**, so only jobs for protected branches and tags can use them.

**Jenkins.** Do not run builds on the controller. Set the number of executors on the built-in node to 0, and run jobs on agents that the Kubernetes or Docker plugin creates for each build.

Never attach self-hosted runners to public repositories: anyone who can open a pull request could run code inside your network.

### How Do I Build Container Images Without Privileged Docker-in-Docker?

A privileged container can do almost everything the host can, including leaving the container. `docker:dind` needs `privileged = true`, so every job on that runner could take over the runner machine. The alternatives:

- **On GitHub-hosted runners,** Docker is already installed on the VM, and the VM is thrown away after the job. Use `docker/build-push-action` there; no Docker-in-Docker is involved.
- **BuildKit in rootless mode** (the `moby/buildkit:rootless` image) builds Dockerfiles without root and without a privileged container. Depending on the host, it may need seccomp and AppArmor relaxed for its user namespaces, which is still much less than `privileged`.
- **Buildah** builds images without a daemon and can run rootless.
- **Kaniko,** which many older guides recommend, was archived by Google in June 2025 and gets no more fixes from the original project. Chainguard maintains a fork; for new pipelines, prefer BuildKit or Buildah.

### How Do I Stop a Job From Sending Secrets Out?

Start by giving secrets only to the jobs that need them. Production credentials belong in a protected environment with required reviewers, which only runs for protected branches ([Part 6](/guides/introduction-to-cicd/06-deployment-strategies-and-environments) of the CI/CD guide). Then limit where the remaining jobs can connect to.

**Run untrusted code without a network.** Install the dependencies first, then run the tests in a container that has no network at all:

```yaml
steps:
  - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
    with:
      persist-credentials: false # otherwise the token sits in .git/config, inside the mount below
  - run: npm ci --ignore-scripts
  - name: Test without network access
    run: docker run --rm --network none -v "$PWD:/app" -w /app node:24 npm test
```

The container gets none of the job's environment variables unless you pass them with `-e`, so it sees neither secrets nor the job token. Pin the image by digest in a real workflow. `unshare --net`, which some guides use for this, needs root: as a normal user it fails with `unshare failed: Operation not permitted` (tested on Linux 6.12).

**Allow only the hosts a job needs.** A firewall rule with a hostname does not do that reliably. `iptables -A OUTPUT -d github.com -j ACCEPT` resolves `github.com` once, when the rule is added (the iptables man page calls a name that needs DNS "a really bad idea"), and services such as GitHub and npm change their addresses. A rule set that ends in `-j DROP` also blocks DNS and the replies of established connections unless you allow them. Use one of these instead:

- An egress proxy with a hostname allowlist (for example Squid or Envoy), with `HTTPS_PROXY` set for the jobs and direct outbound traffic from the runners blocked by the network, such as a security group or a Kubernetes NetworkPolicy.
- On GitHub-hosted runners, an agent such as `step-security/harden-runner`, which can block every endpoint that you do not list:

```yaml
steps:
  - uses: step-security/harden-runner@1d88384fd173af6ecb012dfd0264a306b711241a # v2.22.4
    with:
      egress-policy: block
      allowed-endpoints: >
        github.com:443
        api.github.com:443
        registry.npmjs.org:443
```

Start with `egress-policy: audit` for a few runs to see which endpoints a job really uses, then switch to `block`.

### How Do I Give the Pipeline Cloud Access Without Stored Keys?

Use OpenID Connect. The job asks the CI system for a signed token that names the repository, branch and environment, and the cloud returns credentials that expire after about an hour. [OIDC Instead of Cloud Keys](/guides/introduction-to-cicd/05-environment-variables-and-secrets#h2-oidc-instead-of-cloud-keys) in the CI/CD guide sets it up for AWS, Azure and Google Cloud.

The `Condition` block of the role's trust policy decides who gets the credentials, so make it exact. This condition, common in older examples, lets every branch, tag, pull request and environment of the repository assume the role, and it leaves out the audience check that GitHub's documentation recommends:

```json
{
  "StringLike": {
    "token.actions.githubusercontent.com:sub": "repo:myorg/myrepo:*"
  }
}
```

Match the audience and the full subject instead, here for jobs that run in the `production` environment:

```json
{
  "StringEquals": {
    "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
    "token.actions.githubusercontent.com:sub": "repo:myorg/myrepo:environment:production"
  }
}
```

Repositories created or renamed after 15 July 2026 get a subject with the owner and repository IDs, such as `repo:myorg@123456/myrepo@456789:environment:production`. Copy the subject from a real token, as the CI/CD guide shows, instead of typing it.

For secrets that are not cloud credentials, such as database passwords, HashiCorp Vault accepts the same GitHub token. Bind the Vault role to the `repository` and `environment` claims, and read the secrets with `hashicorp/vault-action`:

```yaml
permissions:
  contents: read
  id-token: write

steps:
  - name: Import secrets from Vault
    uses: hashicorp/vault-action@892a26828f195e65540a40b4768ae4571f51ebfc # v4.0.0
    with:
      url: https://vault.example.com
      method: jwt
      role: myapp-production
      secrets: |
        secret/data/prod/database url | DATABASE_URL ;
        secret/data/prod/api key | API_KEY
```

With Vault's database secrets engine, each job can even get its own database user that expires after a TTL you choose, so a leaked password stops working on its own. Our [secrets management guide](/posts/secrets-management-guide) compares Vault with the cloud secret stores.

### What Should a Pipeline Pin?

Anything that can change under the same name:

- **Actions** to a full commit SHA, with the version in a comment, updated by Dependabot or Renovate. A tag can be moved, as the `tj-actions` and `trivy-action` attacks showed. [Pin Actions to Commits](/guides/introduction-to-cicd/09-security-best-practices-and-production-patterns#h2-pin-actions-to-commits) shows how.
- **Base images** to a digest: `FROM node:24-alpine@sha256:<digest>`. Keep the tag for people to read, and let the update tool change the digest.
- **Dependencies** through a lockfile, installed with `npm ci`, `pip install --require-hashes` or the equivalent. `npm ci --ignore-scripts` also stops the install scripts where most malicious packages run their code; packages that really need a script break, and you allow them one by one. Our [npm install scripts audit](/posts/npm-v12-install-scripts-audit) shows what breaks in practice.
- **Tools you download** in a job, by checksum or signature, not `curl | sh` from a branch. The [Security Gates guide](/guides/security-gates/04-cicd-integration#h2-pin-and-verify-the-gate-tools) verifies Trivy and Conftest this way.

Do not pin OS packages inside an image to exact versions such as `apk add curl=8.5.0-r0`. Alpine's repositories keep only the current version of each package in a release branch, so the build fails as soon as a fix is published. The base image digest already fixes the set of packages you start from.

### A Pipeline Hardening Checklist

- Each workflow starts from read-only permissions; no job has `write-all`.
- Fork pull requests run without secrets, and no workflow runs pull request code with a write token.
- Actions pinned to commit SHAs, base images to digests, dependencies to lockfiles.
- Cloud access through OIDC with an exact `sub` and `aud` match; no long-lived keys in CI secrets.
- Production secrets only in a protected environment with required reviewers.
- Every job on a fresh runner; no self-hosted runners on public repositories; no privileged containers.
- Outbound traffic from runners limited to the hosts the jobs need.
- `CODEOWNERS` covers `.github/`, `.gitlab-ci.yml`, `Jenkinsfile` and `Dockerfile`.
- Images are signed and carry an SBOM and provenance, which the deploy step verifies.
- Audit logs of the CI system are kept and reviewed.

If you can tick fewer than half of these, start with three: read-only token permissions, OIDC and fresh runners. They close the most common ways in. The [CI/CD pipeline setup checklist](/checklists/cicd-pipeline-setup) covers the rest of a new pipeline.

## Software Bill of Materials (SBOM)

An SBOM is a machine-readable inventory of every component in your software. Think of it as an ingredients list for your application. When Log4Shell hit in December 2021, organizations with SBOMs answered "Do we use Log4j?" in minutes. Everyone else spent days manually searching codebases.

```bash
# With an SBOM: one query per service
jq -r '.components[] | select(.name | test("log4j")) | "\(.name) \(.version)"' sbom.json

# Without one: slow and incomplete
find . -name '*log4j*.jar'      # misses jars inside other jars and images
grep -r 'log4j' pom.xml          # misses transitive dependencies
```

Regulators ask for them too. In the US, the FDA requires an SBOM in premarket submissions for medical devices that run software and can connect to the internet, and from December 2027 the EU Cyber Resilience Act requires manufacturers of products with digital elements to draw one up.

### SBOM Formats: CycloneDX vs SPDX

Two formats dominate. Use CycloneDX for security-focused workflows (it has better vulnerability and VEX integration). Use SPDX for licensing and compliance (it is an ISO standard).

### Generating SBOMs with Syft

Anchore's Syft is a widely used open source SBOM generator. It reads container images, directories and archives for most language ecosystems. Install it from a package manager or from a release whose checksum you verify, not by piping a script from a branch into `sh`; in GitHub Actions, `anchore/sbom-action` runs it for you:

```bash
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
# Find all GPL-licensed dependencies (CycloneDX); components without a license are skipped
jq -r '.components[] | select(any(.licenses[]?; (.license.id // .expression // "") | test("GPL"))) | "\(.name) \(.version)"' sbom.json
```

The shorter filter `.licenses[0].license.id | contains("GPL")`, which many examples use, stops with an error at the first component that has no license ID, for example one with a license expression instead (tested with jq 1.6).

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
# The image by digest, as your build printed it
IMAGE=ghcr.io/myorg/myapp@sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08

# Sign it (opens a browser to sign in)
cosign sign "$IMAGE"

# Verify the signature
cosign verify "$IMAGE" \
  --certificate-identity=user@example.com \
  --certificate-oidc-issuer=https://github.com/login/oauth
```

Sign the digest, not a tag. A tag can point to another image a second later, and cosign warns when you give it one.

For air-gapped environments where OIDC is not available, generate a key pair instead:

```bash
cosign generate-key-pair
cosign sign --key cosign.key ghcr.io/myorg/myapp:v1.0.0
cosign verify --key cosign.pub ghcr.io/myorg/myapp:v1.0.0
```

### Signing in CI/CD

In GitHub Actions, keyless signing needs only the `id-token: write` permission. The signature is tied to the workflow's identity, so nobody has a key to steal:

```yaml
# .github/workflows/release.yml
name: Build and sign

on:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  build-sign:
    runs-on: ubuntu-24.04
    permissions:
      contents: read
      packages: write # push to ghcr.io
      id-token: write # keyless signing
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - name: Image name (registry names must be lowercase)
        id: name
        run: echo "image=ghcr.io/${GITHUB_REPOSITORY,,}" >> "$GITHUB_OUTPUT"
      - uses: docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069 # v4.4.1
      - uses: docker/login-action@8aa5831fb8d48d8f76594c7ddde61ae58019f550 # v4.8.0
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - name: Build and push
        id: build
        uses: docker/build-push-action@c3c9e263c25d99ce0380d002d59b67737d91b0dc # v7.4.0
        with:
          context: .
          push: true
          tags: ${{ steps.name.outputs.image }}:${{ github.sha }}
      - uses: sigstore/cosign-installer@756fe2d284c7292c4e9b62c8a28f1e5629c59532 # v4.1.3
      - name: Sign the image by digest
        env:
          IMAGE: ${{ steps.name.outputs.image }}@${{ steps.build.outputs.digest }}
        run: cosign sign --yes "$IMAGE"
```

Anyone can then check that the image was signed by this workflow, on this repository's `main` branch:

```bash
cosign verify "$IMAGE" \
  --certificate-identity=https://github.com/myorg/myapp/.github/workflows/release.yml@refs/heads/main \
  --certificate-oidc-issuer=https://token.actions.githubusercontent.com
```

### Sign Your SBOMs Too

Attach the SBOM to the image as a signed **attestation**, so it cannot be swapped without breaking the signature:

```bash
# Generate the SBOM
syft "$IMAGE" -o cyclonedx-json > sbom.json

# Sign it and store it next to the image in the registry
cosign attest --yes --type cyclonedx --predicate sbom.json "$IMAGE"

# Verify it later, with the same identity flags as cosign verify
cosign verify-attestation --type cyclonedx \
  --certificate-identity=https://github.com/myorg/myapp/.github/workflows/release.yml@refs/heads/main \
  --certificate-oidc-issuer=https://token.actions.githubusercontent.com \
  "$IMAGE"
```

Older examples use `cosign attach sbom`. It stores the SBOM unsigned, it is deprecated in cosign 3, and it will be removed in cosign 4.

### Enforce Signatures in Kubernetes

The Sigstore Policy Controller rejects images at admission that have no valid signature from your workflow:

```yaml
apiVersion: policy.sigstore.dev/v1beta1
kind: ClusterImagePolicy
metadata:
  name: require-signed-images
spec:
  images:
    - glob: 'ghcr.io/myorg/myapp**'
  authorities:
    - keyless:
        identities:
          - issuer: https://token.actions.githubusercontent.com
            subject: https://github.com/myorg/myapp/.github/workflows/release.yml@refs/heads/main
```

Name the exact workflow that signs each image: a signature from any GitHub user, or from a workflow in another repository, must not count. Write one policy per repository, or a `subjectRegExp` when several repositories share a release workflow. The controller only checks namespaces that opt in with the label `policy.sigstore.dev/include: "true"`, so label every namespace that runs your workloads. With this in place, deploying an unsigned image fails:

```bash
kubectl run test --image=ghcr.io/myorg/unsigned:latest
# Error: admission webhook denied the request: validation failed: no matching signatures
```

:::warning
cosign 3 signs in the new Sigstore bundle format by default and stores the signature as an OCI referrer. Policy Controller supports that format only for attestations (with `signatureFormat: bundle` in the policy), not for plain signatures. For the policy above, sign with `cosign sign --new-bundle-format=false` until your admission controller reads bundles; the flag is deprecated and goes away in cosign 4. The longer-lasting option is to require the SLSA provenance attestation that `actions/attest` creates, as the [Policy Controller documentation](https://docs.sigstore.dev/policy-controller/overview/) shows.
:::

Kyverno can do the same with an `ImageValidatingPolicy`. Its older `ClusterPolicy` with `verifyImages`, which many examples still show, is deprecated since Kyverno 1.19, and Kyverno 1.20 blocks creating new ones. [Admission control](/guides/security-gates/01-policy-as-code#h2-enforce-in-the-cluster-admission-control) in the Security Gates guide covers both tools.

## SLSA Framework

SLSA (pronounced "salsa") answers the question: "How was this artifact built, and can I trust that answer?" Its **Build track** has four levels:

| Level    | What it requires                                                                          | What it stops                                                               |
| -------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Build L0 | Nothing                                                                                   | Nothing                                                                     |
| Build L1 | Provenance exists: a record of how the artifact was built                                 | Mistakes, such as releasing from the wrong commit                           |
| Build L2 | The build runs on a hosted platform that signs the provenance                             | Tampering with the artifact or the provenance after the build               |
| Build L3 | A hardened platform: builds are isolated from each other and cannot reach the signing key | Tampering during the build, for example by another build on the same runner |

Older articles describe "SLSA 1 to 4", with two-party review at level 4. That was the draft from 2021. SLSA 1.0 (2023) replaced it with the build levels above, and SLSA 1.2 adds a separate **Source track**, where two-party review is Source L4. SLSA's threat model lists a SolarWinds-style attack as a compromised build process, the threat that Build L3 is designed to make hard.

### Getting to Build L2 and L3

On GitHub, **artifact attestations** are the simplest way. `actions/attest` creates SLSA provenance for an artifact or image digest, signs it with a short-lived Sigstore certificate for the workflow's identity, and stores it with GitHub and, with `push-to-registry`, in the registry. GitHub states that attestations on their own provide SLSA v1.0 Build L2, and Build L3 when the build runs in a reusable workflow that isolates it from the calling workflow.

```yaml
- name: SLSA build provenance
  uses: actions/attest@1e69f48acb82d1966a394da916b4c1698aa569d6 # v4.2.2
  with:
    subject-name: ${{ steps.name.outputs.image }}
    subject-digest: ${{ steps.build.outputs.digest }}
    push-to-registry: true
```

The job needs `id-token: write`, `attestations: write` and `artifact-metadata: write`, and `packages: write` to push to GHCR. Attestations are free for public repositories; private repositories need GitHub Enterprise Cloud. The `slsa-github-generator` reusable workflows that older examples use (`generator_container_slsa3.yml`) are no longer actively maintained, and their README points to artifact attestations. On GitLab CI or Jenkins, create the provenance with your build platform's tooling and sign it with `cosign attest --type slsaprovenance1`.

### Verifying Provenance

Before deploying, verify that the image was built by your workflow, from your repository, on a GitHub-hosted runner:

```bash
gh attestation verify "oci://$IMAGE" \
  --repo myorg/myapp \
  --signer-workflow myorg/myapp/.github/workflows/release.yml \
  --source-ref refs/heads/main \
  --deny-self-hosted-runners
```

`gh attestation verify` needs a GitHub token even for public repositories. Without `--signer-workflow` and `--source-ref`, an attestation from any workflow in the repository, including one started from a pull request branch, would pass.

## Putting It All Together: Complete CI/CD Pipeline

This workflow builds an image, creates its SBOM, fails on critical vulnerabilities, signs it, and attaches the SBOM and SLSA provenance as attestations. Every action is pinned to a commit:

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  release:
    runs-on: ubuntu-24.04
    permissions:
      contents: read
      packages: write # push to ghcr.io
      id-token: write # keyless signing and attestations
      attestations: write
      artifact-metadata: write
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - name: Image name (registry names must be lowercase)
        id: name
        run: echo "image=ghcr.io/${GITHUB_REPOSITORY,,}" >> "$GITHUB_OUTPUT"
      - uses: docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069 # v4.4.1
      - uses: docker/login-action@8aa5831fb8d48d8f76594c7ddde61ae58019f550 # v4.8.0
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - name: Build and push
        id: build
        uses: docker/build-push-action@c3c9e263c25d99ce0380d002d59b67737d91b0dc # v7.4.0
        with:
          context: .
          push: true
          tags: ${{ steps.name.outputs.image }}:${{ github.sha }}
      - name: Generate the SBOM
        uses: anchore/sbom-action@66cbf4bc1f1c0d2edc94016e65bc221b6bb0ad6c # v0.24.3
        with:
          image: ${{ steps.name.outputs.image }}@${{ steps.build.outputs.digest }}
          format: cyclonedx-json
          output-file: sbom.cdx.json
      - name: Fail on critical vulnerabilities
        uses: anchore/scan-action@27805bf3b4e84b4a5c980df22ed233c00390a439 # v7.4.2
        with:
          sbom: sbom.cdx.json
          fail-build: true
          severity-cutoff: critical
      - uses: sigstore/cosign-installer@756fe2d284c7292c4e9b62c8a28f1e5629c59532 # v4.1.3
      - name: Sign the image
        env:
          IMAGE: ${{ steps.name.outputs.image }}@${{ steps.build.outputs.digest }}
        run: cosign sign --yes "$IMAGE"
      - name: Attest the SBOM
        uses: actions/attest@1e69f48acb82d1966a394da916b4c1698aa569d6 # v4.2.2
        with:
          subject-name: ${{ steps.name.outputs.image }}
          subject-digest: ${{ steps.build.outputs.digest }}
          sbom-path: sbom.cdx.json
          push-to-registry: true
      - name: Attest the build provenance
        uses: actions/attest@1e69f48acb82d1966a394da916b4c1698aa569d6 # v4.2.2
        with:
          subject-name: ${{ steps.name.outputs.image }}
          subject-digest: ${{ steps.build.outputs.digest }}
          push-to-registry: true
```

The image is pushed before the scan, so a failed scan stops the job before the signing and attestation steps: this run adds no signature to the image. A signature from an earlier run of the same digest stays valid, though, so a signature does not prove that the latest scan passed. Scan again at deploy time, as the script below does. The [Security Gates guide](/guides/security-gates/04-cicd-integration) builds a fuller version with secret, SAST, policy and license gates in front of the build, and a deploy job that verifies the attestations.

### Pre-Deployment Verification Script

Before anything reaches production, verify the whole chain for the exact digest you are about to deploy:

```bash
#!/bin/bash
set -euo pipefail

IMAGE=$1 # ghcr.io/myorg/myapp@sha256:...
REPO=myorg/myapp
WORKFLOW="https://github.com/${REPO}/.github/workflows/release.yml@refs/heads/main"
ISSUER=https://token.actions.githubusercontent.com

echo "[1/3] Checking the signature..."
cosign verify "$IMAGE" \
  --certificate-identity="$WORKFLOW" \
  --certificate-oidc-issuer="$ISSUER" > /dev/null

echo "[2/3] Checking the SLSA provenance..."
gh attestation verify "oci://${IMAGE}" --repo "$REPO" \
  --signer-workflow "${REPO}/.github/workflows/release.yml" \
  --source-ref refs/heads/main --deny-self-hosted-runners > /dev/null

echo "[3/3] Scanning the attested SBOM..."
gh attestation verify "oci://${IMAGE}" --repo "$REPO" \
  --signer-workflow "${REPO}/.github/workflows/release.yml" \
  --source-ref refs/heads/main --deny-self-hosted-runners \
  --predicate-type https://cyclonedx.org/bom --format json \
  | jq '.[0].verificationResult.statement.predicate' > sbom.cdx.json
grype sbom:sbom.cdx.json --fail-on critical

echo "Supply chain verification passed for $IMAGE"
```

## Where to Start

Supply chain security takes more than a weekend. Here is a practical order:

1. **Harden the pipeline.** Read-only token permissions, OIDC instead of stored keys, and fresh runners for every job.
2. **Pin what can move.** Actions to commit SHAs, base images to digests, dependencies to lockfiles, with an update bot.
3. **Generate SBOMs on every build.** `anchore/sbom-action` takes a few lines, and it pays off the first time a critical CVE drops.
4. **Add vulnerability scanning.** Scan the SBOM with Grype and fail builds on critical vulnerabilities.
5. **Sign your images and attest provenance.** Keyless signing and `actions/attest` add a few steps and no keys.
6. **Verify before you deploy, and at admission.** `gh attestation verify` in the deploy job, and the Sigstore Policy Controller or Kyverno in the cluster.

The tools are mature, and most of this fits into one workflow. A supply chain attack that a few hours of setup would have stopped is the expensive kind.

---

## Related Security Posts

- [Dependency Scanning: Finding Vulnerabilities Before Attackers Do](/posts/dependency-scanning-guide) - Pair your SBOMs with automated scanning to catch vulnerable transitive dependencies before they ship
- [Securing GitHub Actions Workflows](/guides/introduction-to-cicd/09-security-best-practices-and-production-patterns) - Token permissions, script injection, pull request triggers and SHA pinning, checked with zizmor
- [How to Integrate DAST Into Your CI/CD Pipeline](/posts/dast-integration-guide) - Test your deployed artifacts at runtime to catch vulnerabilities that static analysis and signing cannot detect
- [Pre-commit Hooks for Security](/posts/pre-commit-hooks-security-guide) - Catch leaked credentials before they reach the pipeline

For a framework to decide which supply chain risks to address first, see our guide on [threat modeling](/guides/threat-modeling). To see the claims in a real GitHub Actions OIDC token, and an AWS trust policy that accepts only one repository and environment, read [Zero Trust for CI/CD](/guides/security-principles/04-zero-trust#h2-zero-trust-for-cicd). Test yourself with the [CI/CD pipelines quiz](/quizzes/cicd-pipelines-quiz) and the [security architecture interview questions](/interview-questions/topic/security#security-architecture).
