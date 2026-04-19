---
title: 'Day 2 - Fix the Slow Docker Build'
day: 2
excerpt: 'Debug and optimize a poorly written Dockerfile to reduce build time by at least 50%. Learn layer caching, build optimization, and best practices.'
description: 'Improve Docker build performance through layer caching, dependency optimization, and efficient Dockerfile practices.'
publishedAt: '2026-12-02T00:00:00Z'
updatedAt: '2026-12-02T00:00:00Z'
difficulty: 'Beginner'
category: 'Docker'
tags:
  - Docker
  - Performance
  - Optimization
  - Build Cache
---

## Description

You've inherited a Dockerfile from a previous developer, and it's painfully slow. Every code change triggers a full rebuild that takes several minutes. Your team is frustrated with the slow feedback loop during development.

## Task

Rewrite the Dockerfile so the build time is reduced by at least 50%.

**Requirements:**
- Maintain the same functionality
- Reduce build time by minimum 50%
- Optimize layer caching
- Follow Docker best practices

## Target

- **Build Time Reduction**: 50% or more
- **Cache Hit Rate**: Maximize layer reuse
- **First Build**: May be similar, but rebuilds should be fast

## Sample App

### Slow Dockerfile (Before)

```dockerfile
FROM node:20

# Install everything first (breaks cache on any file change)
WORKDIR /app
COPY . .

# Install dependencies (runs every time anything changes)
RUN npm install

# Build the application
RUN npm run build

# Install production dependencies
RUN npm prune --production

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

### package.json

```json
{
  "name": "advent-app",
  "version": "1.0.0",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

## Solution

### Optimized Dockerfile (After)

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files first (better caching)
COPY package*.json ./

# Install all dependencies (including dev deps for build)
RUN npm ci --only=production=false

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 appgroup && \
    adduser -D -u 1001 -G appgroup appuser && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

### .dockerignore

```
node_modules
dist
.git
.gitignore
README.md
.env
.env.local
npm-debug.log
.DS_Store
*.md
.vscode
.idea
coverage
.nyc_output
```

## Explanation

### What Was Wrong?

The original Dockerfile had several performance issues:

1. **Poor Layer Ordering**: Copying all files before installing dependencies
2. **No Cache Optimization**: Every code change invalidated the dependency layer
3. **Missing .dockerignore**: Copying unnecessary files (node_modules, .git)
4. **No Multi-Stage Build**: Including build tools in final image
5. **npm install vs npm ci**: Not using deterministic installs

### Optimizations Applied

#### 1. Dependency Layer Caching

```dockerfile
# ❌ Bad: Code changes invalidate dependency cache
COPY . .
RUN npm install

# ✅ Good: Dependencies cached separately
COPY package*.json ./
RUN npm ci
COPY . .
```

#### 2. Multi-Stage Builds

```dockerfile
# Build stage has dev dependencies
FROM node:20-alpine AS builder
RUN npm ci

# Production stage only has runtime dependencies
FROM node:20-alpine
RUN npm ci --only=production
```

#### 3. Using npm ci Instead of npm install

- `npm ci` is faster and more reliable
- Uses package-lock.json for deterministic installs
- Removes existing node_modules first

#### 4. .dockerignore File

Excludes unnecessary files from build context:
- Reduces context size
- Faster uploads to Docker daemon
- Prevents accidental inclusion of secrets

### Build Time Comparison

| Scenario | Before | After | Improvement |
|----------|--------|-------|-------------|
| First build | 120s | 100s | 17% faster |
| Code change | 120s | 15s | **87% faster** |
| Dependency change | 120s | 80s | 33% faster |

## Result

You should achieve:
- ✅ 50%+ faster rebuilds on code changes
- ✅ Cached dependency layers
- ✅ Smaller final image size
- ✅ Faster CI/CD pipelines

## Validation

### Test Build Performance

```bash
# First build (cold cache)
time docker build -t advent-day2:v1 .

# Make a small code change
echo "console.log('test');" >> src/index.ts

# Rebuild (should be much faster)
time docker build -t advent-day2:v2 .

# Check cache usage
docker build -t advent-day2:v3 . --progress=plain
# Look for "CACHED" messages
```

### Measure Cache Efficiency

```bash
# Build with cache stats
docker build -t advent-day2:latest . \
  --progress=plain 2>&1 | grep -c "CACHED"
```

## Advanced Optimizations

### BuildKit Features

```dockerfile
# syntax=docker/dockerfile:1.4

# Use build cache mounts
RUN --mount=type=cache,target=/root/.npm \
    npm ci
```

### Parallel Multi-Stage Builds

```dockerfile
FROM base AS dependencies
RUN npm ci

FROM base AS test
COPY --from=dependencies /app/node_modules ./node_modules
RUN npm test

FROM base AS build
COPY --from=dependencies /app/node_modules ./node_modules
RUN npm run build
```

## Links

- [Docker Build Cache](https://docs.docker.com/build/cache/)
- [Multi-Stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [.dockerignore](https://docs.docker.com/engine/reference/builder/#dockerignore-file)
- [npm ci Documentation](https://docs.npmjs.com/cli/v9/commands/npm-ci)
- [BuildKit](https://docs.docker.com/build/buildkit/)

## Share Your Success

Optimized your build? Share your results!

**Tag [@thedevopsdaily](https://x.com/thedevopsdaily)** on X with:
- Before/after build times
- Percentage improvement achieved
- Any additional optimizations you discovered

Use hashtags: **#AdventOfDevOps #Docker #Day2 #Performance**
