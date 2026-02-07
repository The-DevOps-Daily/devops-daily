---
title: 'How to Publish a Helm Chart'
excerpt: 'Learn how to package and publish your Helm charts to various repositories including GitHub Pages, OCI registries, and ChartMuseum. This guide covers the complete workflow from packaging to distribution.'
category:
  name: 'Kubernetes'
  slug: 'kubernetes'
date: '2026-01-24'
publishedAt: '2025-01-24T09:00:00Z'
updatedAt: '2025-01-24T09:00:00Z'
readingTime: '10 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Kubernetes
  - Helm
  - DevOps
  - Charts
  - Package Management
---

Publishing your Helm charts makes them easy to share with your team or the community. Whether you're distributing internal applications or open-source projects, understanding how to package and host charts is an essential Kubernetes skill. This guide walks you through the complete workflow: packaging your chart, choosing a hosting solution, and publishing to different repository types.

## Prerequisites

Before you begin, make sure you have:

- Helm 3.x installed (`helm version`)
- A working Helm chart you want to publish
- Access to your chosen hosting platform (GitHub, Docker Hub, etc.)
- Basic familiarity with Helm chart structure

## Understanding Helm Chart Repositories

A Helm chart repository is simply an HTTP server that hosts packaged charts and an `index.yaml` file. The index file contains metadata about available charts, versions, and download URLs. When you run `helm repo add`, Helm fetches this index to know what charts are available.

```
Chart Repository Structure:
┌─────────────────────────────────────┐
│  https://example.com/charts/        │
├─────────────────────────────────────┤
│  index.yaml                         │  ← Metadata about all charts
│  myapp-1.0.0.tgz                    │  ← Packaged chart v1.0.0
│  myapp-1.1.0.tgz                    │  ← Packaged chart v1.1.0
│  another-chart-2.0.0.tgz            │  ← Another chart
└─────────────────────────────────────┘
```

Modern Helm (3.8+) also supports OCI registries, letting you store charts alongside container images in registries like Docker Hub, GitHub Container Registry, or Amazon ECR.

## Packaging Your Chart

Before publishing, you need to package your chart into a `.tgz` archive. Start by validating your chart:

```bash
# Lint your chart for issues
helm lint ./mychart

# Verify the chart renders correctly
helm template ./mychart
```

Fix any warnings or errors, then package:

```bash
helm package ./mychart
```

This creates `mychart-1.0.0.tgz` (version comes from `Chart.yaml`). The package includes all chart files, templates, and dependencies.

### Updating Chart Version

Before each release, update the version in `Chart.yaml`:

```yaml
# Chart.yaml
apiVersion: v2
name: mychart
version: 1.1.0        # Increment for new releases
appVersion: "2.0.0"   # Version of the app being deployed
description: My application Helm chart
```

Helm follows semantic versioning. Increment appropriately:
- **Patch** (1.0.1): Bug fixes, no breaking changes
- **Minor** (1.1.0): New features, backward compatible
- **Major** (2.0.0): Breaking changes

## Option 1: GitHub Pages

GitHub Pages is a popular free option for hosting public charts. It serves static files from a repository branch.

### Step 1: Create a Repository

Create a new GitHub repository for your charts, or use an existing one with a `gh-pages` branch.

### Step 2: Package and Index

```bash
# Create a directory for your releases
mkdir -p charts

# Package your chart into that directory
helm package ./mychart -d charts/

# Generate or update the index
helm repo index charts/ --url https://yourusername.github.io/helm-charts/
```

### Step 3: Push to GitHub Pages

```bash
cd charts
git init
git add .
git commit -m "Add mychart 1.0.0"
git branch -M gh-pages
git remote add origin https://github.com/yourusername/helm-charts.git
git push -u origin gh-pages
```

Enable GitHub Pages in your repository settings, pointing to the `gh-pages` branch.

### Step 4: Use Your Repository

```bash
helm repo add myrepo https://yourusername.github.io/helm-charts/
helm repo update
helm search repo myrepo
helm install myapp myrepo/mychart
```

### Automating with GitHub Actions

Automate chart publishing with a GitHub Action:

```yaml
# .github/workflows/release.yml
name: Release Charts

on:
  push:
    branches: [main]
    paths:
      - 'charts/**'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Configure Git
        run: |
          git config user.name "$GITHUB_ACTOR"
          git config user.email "$GITHUB_ACTOR@users.noreply.github.com"

      - name: Install Helm
        uses: azure/setup-helm@v3

      - name: Run chart-releaser
        uses: helm/chart-releaser-action@v1.6.0
        env:
          CR_TOKEN: "${{ secrets.GITHUB_TOKEN }}"
```

This action uses `chart-releaser` to automatically package charts, create GitHub releases, and update the index.

## Option 2: OCI Registry (Docker Hub, GHCR, ECR)

OCI (Open Container Initiative) registries let you store Helm charts alongside container images. This is the modern approach, requiring no separate infrastructure.

### Publishing to Docker Hub

```bash
# Log in to Docker Hub
helm registry login registry-1.docker.io -u yourusername

# Package the chart
helm package ./mychart

# Push to Docker Hub
helm push mychart-1.0.0.tgz oci://registry-1.docker.io/yourusername
```

### Publishing to GitHub Container Registry

```bash
# Log in with a personal access token
echo $GITHUB_TOKEN | helm registry login ghcr.io -u yourusername --password-stdin

# Push the chart
helm push mychart-1.0.0.tgz oci://ghcr.io/yourusername
```

### Publishing to Amazon ECR

```bash
# Authenticate with ECR
aws ecr get-login-password --region us-east-1 | \
  helm registry login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com

# Create an ECR repository for your chart
aws ecr create-repository --repository-name mychart --region us-east-1

# Push the chart
helm push mychart-1.0.0.tgz oci://123456789.dkr.ecr.us-east-1.amazonaws.com
```

### Installing from OCI Registry

```bash
# Install directly from OCI reference
helm install myapp oci://registry-1.docker.io/yourusername/mychart --version 1.0.0

# Or pull first, then install
helm pull oci://ghcr.io/yourusername/mychart --version 1.0.0
helm install myapp mychart-1.0.0.tgz
```

Note: OCI registries don't use `helm repo add`. You reference charts directly by their OCI URL.

## Option 3: ChartMuseum

ChartMuseum is a self-hosted chart repository server with a REST API. It's useful for private, on-premises deployments.

### Running ChartMuseum

```bash
# Run with Docker
docker run -d \
  -p 8080:8080 \
  -e STORAGE=local \
  -e STORAGE_LOCAL_ROOTDIR=/charts \
  -v $(pwd)/charts:/charts \
  ghcr.io/helm/chartmuseum:latest

# Or install via Helm
helm repo add chartmuseum https://chartmuseum.github.io/charts
helm install chartmuseum chartmuseum/chartmuseum
```

### Uploading Charts

```bash
# Upload via curl
curl --data-binary "@mychart-1.0.0.tgz" http://localhost:8080/api/charts

# Or use the helm-push plugin
helm plugin install https://github.com/chartmuseum/helm-push
helm cm-push mychart-1.0.0.tgz http://localhost:8080
```

### Using ChartMuseum

```bash
helm repo add mymuseum http://localhost:8080
helm repo update
helm search repo mymuseum
helm install myapp mymuseum/mychart
```

ChartMuseum supports multiple storage backends including S3, GCS, Azure Blob, and local filesystem.

## Best Practices

### Document Your Chart

Include a comprehensive `README.md` in your chart directory:

```markdown
# MyChart

A Helm chart for deploying MyApp.

## Installation

```bash
helm repo add myrepo https://example.com/charts
helm install myapp myrepo/mychart
```

## Configuration

| Parameter | Description | Default |
|-----------|-------------|--------|
| image.tag | Image tag | latest |
| replicas | Number of replicas | 1 |
```

### Add Provenance (Signing)

Sign your charts for integrity verification:

```bash
# Generate a GPG key if you don't have one
gpg --quick-generate-key "Your Name <your@email.com>"

# Package with signature
helm package --sign --key 'Your Name' --keyring ~/.gnupg/secring.gpg ./mychart
```

This creates both `mychart-1.0.0.tgz` and `mychart-1.0.0.tgz.prov` (provenance file).

### Version Your Dependencies

If your chart has dependencies, pin specific versions:

```yaml
# Chart.yaml
dependencies:
  - name: postgresql
    version: "12.5.8"    # Pin to specific version
    repository: https://charts.bitnami.com/bitnami
```

Update dependencies before packaging:

```bash
helm dependency update ./mychart
helm package ./mychart
```

### Test Before Publishing

Always test your packaged chart before publishing:

```bash
# Test installation
helm install test-release ./mychart-1.0.0.tgz --dry-run

# Or run chart tests
helm test test-release
```

## Comparison of Hosting Options

| Feature | GitHub Pages | OCI Registry | ChartMuseum |
|---------|--------------|--------------|-------------|
| Cost | Free | Varies | Self-hosted |
| Setup | Easy | Easy | Moderate |
| Private repos | No | Yes | Yes |
| API access | No | Yes | Yes |
| Auth integration | GitHub | Registry auth | Configurable |
| Best for | Open source | Modern workflows | On-premises |

## Troubleshooting

### Chart Not Found After Publishing

```bash
# Update your local repo index
helm repo update

# Verify the chart exists
helm search repo myrepo/mychart --versions
```

### OCI Push Fails with 401

```bash
# Ensure you're logged in
helm registry login <registry-url>

# Check token permissions (needs push/write access)
```

### Index Not Generated Correctly

```bash
# Regenerate with absolute URL
helm repo index charts/ --url https://yourdomain.com/charts/ --merge charts/index.yaml
```

## Conclusion

Publishing Helm charts is straightforward once you understand the options. For open-source projects, GitHub Pages with chart-releaser automation is hard to beat. For private or enterprise use, OCI registries integrate well with existing container workflows. ChartMuseum remains valuable for air-gapped or on-premises environments.

Whichever method you choose, remember to version your charts properly, document configuration options, and test before publishing. Your users will thank you for a well-maintained chart repository.
