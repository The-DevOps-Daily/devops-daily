---
title: 'Why Your CI/CD Pipeline Is Slower Than It Should Be (and How to Fix It)'
excerpt: 'Small pipeline changes give big wins. Parallelize jobs, cache dependencies, pin images, reuse build artifacts, and run only the tests you need.'
category: 'ci'
date: '2025-06-10T09:00:00.000Z'
publishedAt: '2025-06-10T09:00:00.000Z'
updatedAt: '2025-06-10T09:00:00.000Z'
readingTime: 4
author: 'DevOps Daily'
tags:
  - ci
  - cicd
  - performance
  - pipeline
---

## TLDR

Most slow pipelines are a matter of configuration, not raw compute. Parallelize independent work, cache dependencies and images, reuse build artifacts, and run targeted tests. These five changes often shave minutes off every run.

## Why this matters

Slow pipelines cost time and momentum. Every extra minute waiting for feedback lowers developer velocity and increases the cost of iteration. The steps below are practical and platform agnostic. I include short examples for GitHub Actions and GitLab CI because they are easy to adapt.

## 1) Too many serial steps

Running unrelated tasks one after the other wastes wall clock time. Treat jobs as units of work and run jobs in parallel when they do not depend on each other.

### GitHub Actions example

Explanation: two independent jobs run at the same time, saving total time.

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run lint

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test
```

Quick tip: if jobs share the same setup cost, consider extracting common setup into a reusable job or cache the results so the overhead is smaller.

## 2) Pulling "latest" base images

Using floating tags like `latest` forces a fresh image pull and makes builds unpredictable.

Fix: pin a specific version and optionally pin by digest when you need absolute reproducibility.

### `Dockerfile` example

Explanation: pinning to a minor version gives stability while keeping security updates available.

```dockerfile
FROM node:20-alpine
# ... rest of Dockerfile ...
```

When you need byte-for-byte reproducibility, use an image digest:

```dockerfile
# example only, replace with the digest your registry shows
FROM node:20-alpine@sha256:0123456789abcdef...
```

If your CI offers warm image caches, configure your runners to keep common base images between runs.

## 3) No dependency caching

Downloading all dependencies every run is a big time sink. Use the CI cache feature and key it on the lockfile.

### GitHub Actions npm cache example

Explanation: this caches the npm cache directory and only restores when package-lock.json changes.

```yaml
- name: Cache node modules
  uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-

- name: Install
  run: npm ci
```

- For pnpm cache the store path is usually `~/.pnpm-store` or the path configured in your project.
- For pip use `~/.cache/pip`. For Maven and Gradle cache the `.m2` or `.gradle` directories.
- Use restore-keys to get partial cache hits when the exact key is not found.

## 4) Skipping artifact reuse

Building once and throwing away the result is wasteful. Save build outputs and reuse them in downstream jobs.

### GitLab CI example

Explanation: build job creates artifacts that are used by deploy without rebuilding.

```yaml
build:
  stage: build
  script: ./build.sh
  artifacts:
    paths:
      - dist/

deploy:
  stage: deploy
  dependencies:
    - build
  script: ./deploy.sh
```

### GitHub Actions artifact example

Explanation: upload artifacts in the build job, then download them in deploy.

```yaml
# in build job
- uses: actions/upload-artifact@v4
  with:
    name: app-dist
    path: dist/

# in deploy job
- uses: actions/download-artifact@v4
  with:
    name: app-dist
    path: dist/
```

If your platform supports container image layers caching, push a cached intermediate image to your registry so downstream jobs can pull a small delta.

## 5. Running every test, every time

Full test suites are expensive. Run fast checks on every commit and full suites only when needed.

### Selective test example for Jest

Explanation: `--changedSince` runs only tests affected by recent changes.

```bash
npx jest --changedSince=origin/main
```

Alternative: use a simple change detection step in CI and set which suites to run. Example idea:

- If only `frontend/` files changed, run unit and browser tests.
- If `backend/` files changed, run backend unit and integration tests.

### Small change detection snippet (bash)

Explanation: sets a variable you can use to conditionally run jobs or steps.

```bash
CHANGED=$(git diff --name-only origin/main...HEAD)
if echo "$CHANGED" | grep -q '^frontend/'; then
  echo "run frontend tests"
fi
```

### Extra tips that save time

- Use a matrix for similar jobs instead of duplicating config.
- Prefer `npm ci` over `npm install` on CI for reproducible installs and speed.
- Keep CI images small and only install required tools.
- Run heavy integration tests on a schedule or after merge to main, not on every push.
- If you use shared runners, tune concurrency or add self-hosted runners for heavy workloads.

### Short checklist to apply

- Parallelize independent jobs.
- Pin base images and use image caches.
- Cache dependency directories with a key based on the lockfile.
- Save and reuse build artifacts across jobs.
- Run targeted tests when possible, full suites on protected branches or merges.

## Conclusion

Most pipeline speed problems are fixable with configuration and small investments. Start with parallel jobs and caching. Then add artifact reuse and selective testing. You will see faster feedback and higher team throughput.

Thanks for reading. Ship faster.
