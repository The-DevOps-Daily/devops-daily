---
title: 'Day 4 - Speed Up CI with Caching'
day: 4
excerpt: 'Optimize a slow GitHub Actions workflow by adding intelligent caching for dependencies. Achieve 40% faster run times.'
description: 'Learn GitHub Actions caching strategies to dramatically reduce CI/CD pipeline execution times.'
publishedAt: '2025-12-04T00:00:00Z'
updatedAt: '2026-04-19T00:00:00Z'
difficulty: 'Intermediate'
category: 'CI/CD'
tags:
  - GitHub Actions
  - Performance
  - Caching
  - Optimization
---

## Description

Your GitHub Actions workflow runs every time, but it's downloading and installing the same dependencies repeatedly. Each run takes 5+ minutes when it could take less than 2 minutes with proper caching.

## Task

Add caching for dependencies to your GitHub Actions workflow.

**Goal**: Achieve 40% faster run times through intelligent caching.

## Target

- **Time Reduction**: 40% or more
- **Cache Hit Rate**: 80%+ on subsequent runs
- **Cache Size**: Reasonable (under 500MB)

## Sample App

### Slow Workflow (Before)

```yaml
name: Slow CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'

      # No caching - downloads every time!
      - name: Install dependencies
        run: npm install

      - name: Run tests
        run: npm test

      - name: Build
        run: npm run build
```

## Solution

### Optimized Workflow (After)

```yaml
name: Fast CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'  # Built-in npm caching

      - name: Cache node modules
        uses: actions/cache@v3
        with:
          path: |
            ~/.npm
            node_modules
          key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
          restore-keys: |
            ${{ runner.os }}-node-

      - name: Install dependencies
        run: npm ci  # Faster than npm install

      - name: Cache build output
        uses: actions/cache@v3
        with:
          path: |
            dist
            .next
          key: ${{ runner.os }}-build-${{ hashFiles('src/**') }}
          restore-keys: |
            ${{ runner.os }}-build-

      - name: Run tests
        run: npm test

      - name: Build
        run: npm run build
```

## Explanation

### Cache Strategy

#### 1. Package Manager Cache

```yaml
- uses: actions/setup-node@v4
  with:
    cache: 'npm'
```

**Benefits:**
- Caches global npm cache directory
- Automatic invalidation on package-lock.json changes
- Zero configuration

#### 2. Node Modules Cache

```yaml
- uses: actions/cache@v3
  with:
    path: node_modules
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
```

**Key Components:**
- **path**: What to cache
- **key**: Unique identifier (OS + lockfile hash)
- **restore-keys**: Fallback if exact key doesn't match

#### 3. Build Output Cache

```yaml
- uses: actions/cache@v3
  with:
    path: dist
    key: ${{ runner.os }}-build-${{ hashFiles('src/**') }}
```

Caches compiled output based on source code hash.

### Cache Key Strategy

#### Exact Match Key

```yaml
key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
```

Creates keys like:
- `Linux-node-a1b2c3d4e5f6...`
- Changes when dependencies change

#### Restore Keys (Fallbacks)

```yaml
restore-keys: |
  ${{ runner.os }}-node-
```

If exact key not found:
1. Try most recent cache starting with `Linux-node-`
2. Partial cache better than no cache

### Performance Comparison

| Scenario | Before | After | Improvement |
|----------|--------|-------|-------------|
| Cold cache | 5m 30s | 5m 00s | 9% |
| Warm cache (no changes) | 5m 30s | **1m 45s** | **68%** |
| Dependency change | 5m 30s | 4m 30s | 18% |

## Result

You should see:
- ✅ 40%+ faster average build times
- ✅ Cache hits on most runs
- ✅ Reduced GitHub Actions minutes usage
- ✅ Faster developer feedback

### Workflow Log Output

```
Cache hit for key: Linux-node-a1b2c3d4e5f6
Restored cache from: /home/runner/.npm
Cache restored successfully
Total time: 1m 47s (previously 5m 32s)
```

## Validation

### Monitor Cache Performance

Add cache statistics step:

```yaml
- name: Cache stats
  run: |
    echo "Cache key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}"
    du -sh ~/.npm 2>/dev/null || echo "No cache"
    du -sh node_modules 2>/dev/null || echo "No node_modules"
```

### Compare Run Times

```bash
# View recent workflow runs
gh run list --workflow=ci.yml --limit 10

# Compare timing
gh run view <run-id> --log | grep "Total time"
```

## Advanced Caching Patterns

### Multi-Stage Caching

```yaml
# Stage 1: Dependencies
- uses: actions/cache@v3
  id: cache-deps
  with:
    path: node_modules
    key: deps-${{ hashFiles('package-lock.json') }}

# Stage 2: Build (depends on source)
- uses: actions/cache@v3
  id: cache-build
  if: steps.cache-deps.outputs.cache-hit == 'true'
  with:
    path: dist
    key: build-${{ hashFiles('src/**') }}

# Only build if cache miss
- name: Build
  if: steps.cache-build.outputs.cache-hit != 'true'
  run: npm run build
```

### Language-Specific Caching

#### Python (pip)

```yaml
- uses: actions/setup-python@v4
  with:
    python-version: '3.11'
    cache: 'pip'
```

#### Go

```yaml
- uses: actions/setup-go@v4
  with:
    go-version: '1.21'
    cache: true
```

#### Docker Layers

```yaml
- uses: docker/build-push-action@v5
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

### Cache Cleanup

```yaml
- name: Clear old caches
  if: github.event_name == 'schedule'
  run: |
    gh cache delete --all --repo ${{ github.repository }}
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Best Practices

### ✅ Do's

1. **Use specific cache keys**: Include lockfile hashes
2. **Set restore-keys**: Fallback to partial matches
3. **Cache immutable data**: node_modules, build artifacts
4. **Monitor cache size**: Keep under 500MB when possible
5. **Version your caches**: Include version in key if needed

### ❌ Don'ts

1. **Don't cache secrets**: Never cache credentials
2. **Don't cache .git**: Checkout action handles this
3. **Don't use generic keys**: `cache-v1` is too broad
4. **Don't cache OS files**: System-specific files
5. **Don't ignore cache misses**: Monitor and optimize

## Links

- [GitHub Actions Cache](https://github.com/actions/cache)
- [Caching Dependencies](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows)
- [Cache Action Examples](https://github.com/actions/cache/blob/main/examples.md)
- [Cache Limits](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#usage-limits-and-eviction-policy)

## Share Your Success

Optimized your CI? Share the results!

**Tag [@thedevopsdaily](https://x.com/thedevopsdaily)** on X with:
- Before/after workflow times
- Cache hit rate percentage
- Amount of time/money saved

Use hashtags: **#AdventOfDevOps #GitHubActions #Performance #Day4**
