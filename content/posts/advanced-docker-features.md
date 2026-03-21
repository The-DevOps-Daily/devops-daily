---
title: '5 Advanced Docker Features Worth Knowing'
excerpt: 'Go beyond Docker basics with BuildKit, multi-stage builds, health checks, init processes, and build secrets. Learn practical techniques that improve security, performance, and reliability.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2026-03-02'
publishedAt: '2026-03-02T11:00:00Z'
updatedAt: '2026-03-02T11:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - DevOps
  - Containers
  - BuildKit
  - Security
---

You know how to write a Dockerfile, run containers, and maybe even orchestrate them with Docker Compose. But Docker has evolved significantly, and many powerful features remain underutilized even by experienced users. These advanced capabilities can dramatically improve your container images' security, build times, and runtime reliability.

Most teams stick with the basics because they work well enough. Yet investing time in these five advanced features pays dividends in production. Smaller images deploy faster and have fewer security vulnerabilities. Proper health checks prevent routing traffic to broken containers. Build secrets keep credentials out of your image layers forever.

**TLDR**: This guide covers five advanced Docker features that improve production workloads. BuildKit's experimental syntax enables efficient caching and parallel builds. Multi-stage builds create minimal production images from complex build processes. Health checks let orchestrators verify container readiness. Init processes prevent zombie processes and ensure clean signal handling. Build secrets inject credentials during builds without leaking them into image layers.

## Why Go Beyond Docker Basics

Basic Docker usage, writing a Dockerfile with `FROM`, `RUN`, and `CMD`, works fine for development. But production environments demand more: images need to be small for fast deployment, builds need to be fast for rapid iteration, and containers need to handle signals properly for graceful shutdowns.

Consider a typical scenario: your Node.js application container takes 5 minutes to build because it reinstalls all dependencies every time. Your 2GB image takes forever to push to your registry. In production, your application doesn't respond to termination signals properly, causing 30-second delays during deployments when Kubernetes forcefully kills pods.

Each advanced feature addresses a specific pain point:
- **BuildKit** dramatically speeds up builds with better caching
- **Multi-stage builds** slash image sizes by 80-90%
- **Health checks** prevent traffic routing to broken containers  
- **Init processes** ensure proper signal handling and prevent zombie processes
- **Build secrets** keep credentials out of images permanently

These aren't theoretical improvements. Teams report build time reductions from 10 minutes to under 2 minutes, image size drops from 1.5GB to 200MB, and elimination of mysterious container startup failures.

---

## 1. BuildKit: Next-Generation Image Builds

BuildKit is Docker's modern build engine that replaces the legacy builder. It provides parallel builds, efficient caching, and advanced features like cache mounts and secret mounts. While it's now the default in recent Docker versions, many developers don't leverage its full capabilities.

### Why BuildKit Matters

The legacy builder processes Dockerfile instructions sequentially, rebuilding layers whenever anything changes. BuildKit builds multiple stages in parallel, skips unused stages entirely, and provides sophisticated cache management.

**Legacy builder flow:**
```
Step 1 → Step 2 → Step 3 → Step 4 → Step 5
(5 sequential operations, ~8 minutes)
```

**BuildKit flow:**
```
Step 1 → Step 2 ──┐
                  ├→ Step 5
Step 3 → Step 4 ──┘
(parallel execution, ~3 minutes)
```

### Basic BuildKit Usage

Enable BuildKit for a single build:
```bash
DOCKER_BUILDKIT=1 docker build -t myapp:latest .
```

Enable BuildKit by default:
```json
// ~/.docker/daemon.json
{
  "features": {
    "buildkit": true
  }
}
```

### Advanced: Cache Mounts

Cache mounts persist directories between builds, perfect for package manager caches:

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine

WORKDIR /app

# Cache npm packages between builds
RUN --mount=type=cache,target=/root/.npm \\
    npm install -g pnpm

COPY package.json pnpm-lock.yaml ./

# Cache pnpm store between builds
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \\
    pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

CMD ["node", "dist/index.js"]
```

**Key points:**
- The `# syntax=docker/dockerfile:1` directive enables BuildKit features
- `--mount=type=cache` creates a persistent cache between builds
- The cache persists even when you change code or dependencies
- First build: 4 minutes, subsequent builds: 30 seconds

### When BuildKit Doesn't Help

BuildKit won't magically speed up inherently slow operations:
- Compiling large codebases still takes time
- Downloading gigabytes of data still requires bandwidth
- CPU-intensive operations run at the same speed

The speedup comes from intelligent caching and parallelization, not from making individual operations faster.

---

## 2. Multi-Stage Builds: Minimal Production Images

Multi-stage builds use multiple `FROM` statements in a single Dockerfile, each starting a new build stage. You can copy artifacts from earlier stages into later ones, leaving behind build tools, source code, and temporary files.

### The Problem Multi-Stage Builds Solve

Traditional approach (the "fat image" problem):

```dockerfile
FROM node:22
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install
COPY . .
RUN pnpm build
CMD ["node", "dist/index.js"]
```

**Result:** 1.2GB image containing:
- Node.js (expected)
- All build tools (unnecessary in production)
- Source TypeScript files (not needed, we have compiled JS)
- node_modules with devDependencies (only need production deps)
- Build cache and temporary files (waste)

### Multi-Stage Solution

```dockerfile
# syntax=docker/dockerfile:1

# ========================================
# Stage 1: Build
# ========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Build application
COPY . .
RUN pnpm build

# ========================================
# Stage 2: Production
# ========================================
FROM node:22-alpine AS production

WORKDIR /app

# Install only production dependencies
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Copy only built artifacts from builder stage
COPY --from=builder /app/dist ./dist

# Run as non-root user
USER node

CMD ["node", "dist/index.js"]
```

**Result:** 180MB image containing only:
- Node.js runtime
- Production dependencies
- Compiled JavaScript

### Real-World Impact

**Before multi-stage:**
- Image size: 1.2GB
- Docker pull: 2 minutes
- Vulnerabilities: 47 (including build tools)
- Pod startup time: 45 seconds

**After multi-stage:**
- Image size: 180MB
- Docker pull: 12 seconds
- Vulnerabilities: 8 (only runtime deps)
- Pod startup time: 8 seconds

### Advanced Pattern: Distroless Images

For maximum security, use Google's distroless images that contain only your application and runtime dependencies:

```dockerfile
# Build stage
FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/server .

# Production stage
FROM gcr.io/distroless/static-debian12
COPY --from=builder /app/server /server
USER nonroot:nonroot
CMD ["/server"]
```

Distroless images:
- Contain no shell, package manager, or utilities
- Drastically reduce attack surface
- Often under 50MB total
- Make container escape nearly impossible

---

## 3. Health Checks: Verify Container Readiness

Health checks tell Docker (and orchestrators like Kubernetes) whether your container is actually ready to serve traffic, not just that the process is running.

### Why Process Running ≠ Application Ready

Your container process might be running but:
- Still loading configuration files
- Connecting to databases (connection pool warming up)
- Populating caches
- Waiting for dependent services

Without health checks, orchestrators route traffic immediately, causing:
- 502 Bad Gateway errors during deployments
- Failed requests during container restarts
- Cascading failures when containers aren't ready

### Basic Health Check

```dockerfile
FROM node:22-alpine
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --prod
COPY . .

# Health check: curl the /health endpoint every 30 seconds
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \\
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))" || exit 1

CMD ["node", "server.js"]
```

**Health check options:**
- `--interval=30s`: Check every 30 seconds
- `--timeout=3s`: Mark as failed if check takes >3 seconds
- `--start-period=40s`: Grace period for app startup (don't count failures)
- `--retries=3`: Fail after 3 consecutive failures

### Application Health Endpoint

Your application should implement a `/health` endpoint:

```javascript
// server.js (Node.js example)
const express = require('express');
const app = express();

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check critical dependencies
    await checkDatabaseConnection();
    await checkRedisConnection();
    
    // Check application state
    if (!app.locals.initialized) {
      return res.status(503).json({ status: 'initializing' });
    }
    
    res.status(200).json({ 
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'unhealthy', 
      error: error.message 
    });
  }
});
```

### What to Check in Health Endpoints

**Do check:**
- Critical database connections
- Required message queues (Kafka, RabbitMQ)
- Disk space availability
- Application initialization state

**Don't check:**
- External APIs (failure shouldn't mark your app unhealthy)
- Non-critical services (monitoring, logging)
- Expensive operations (health checks run frequently)

### Docker Health Check Behavior

```bash
# Check container health status
docker ps
# Shows: STATUS = Up 2 minutes (healthy)

# View health check history
docker inspect --format='{{json .State.Health}}' container_name
```

When a container becomes unhealthy:
- Docker marks it unhealthy but keeps it running
- Orchestrators (Docker Swarm, Kubernetes) stop routing traffic
- Kubernetes can restart unhealthy containers automatically

---

## 4. Init Process: Proper Signal Handling

When you run a process as PID 1 in a container, it inherits special responsibilities from the Linux kernel. Most applications aren't designed to handle these responsibilities, leading to zombie processes and improper shutdowns.

### The PID 1 Problem

In Linux, PID 1 (init process) has special duties:
1. **Reap zombie processes**: Clean up terminated child processes
2. **Forward signals**: Properly handle SIGTERM, SIGINT, SIGKILL
3. **Adopt orphaned processes**: Become parent of orphaned children

Most applications don't implement these behaviors:

```dockerfile
FROM node:22-alpine
COPY app.js .
CMD ["node", "app.js"]  # node runs as PID 1, doesn't handle signals well
```

**Problems:**
- `docker stop` waits 10 seconds then forcefully kills (SIGKILL)
- Zombie processes accumulate if your app spawns children
- Graceful shutdown logic never runs
- Database connections don't close properly

### Solution 1: Use --init Flag

```bash
docker run --init myapp:latest
```

Docker's built-in init process (tini) runs as PID 1 and properly forwards signals to your application.

### Solution 2: Add tini to Your Image

```dockerfile
FROM node:22-alpine

# Install tini
RUN apk add --no-cache tini

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --prod
COPY . .

# Use tini as entrypoint
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
```

### Solution 3: Implement Signal Handling

For Node.js applications, handle signals explicitly:

```javascript
// server.js
const express = require('express');
const app = express();

const server = app.listen(3000, () => {
  console.log('Server started on port 3000');
});

// Graceful shutdown handler
const gracefulShutdown = (signal) => {
  console.log(`Received ${signal}, starting graceful shutdown`);
  
  server.close(() => {
    console.log('HTTP server closed');
    
    // Close database connections
    closeDatabase().then(() => {
      console.log('Database connections closed');
      process.exit(0);
    });
  });
  
  // Force exit after 30 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

// Handle termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

### Real-World Impact

**Without init process:**
- `kubectl delete pod`: 10-second forced kill
- Active requests: terminated mid-flight
- Database connections: not closed properly
- Zombie processes: accumulate over time

**With init process:**
- `kubectl delete pod`: 2-second graceful shutdown
- Active requests: complete before shutdown
- Database connections: closed cleanly
- Zombie processes: properly reaped

---

## 5. Build Secrets: Keep Credentials Out of Images

Build secrets inject sensitive data during the build process without storing it in image layers. This prevents credentials from leaking through image inspection or layer analysis.

### The Problem: Secrets in Layers

**Bad approach (credentials leaked forever):**

```dockerfile
FROM node:22-alpine
WORKDIR /app

# Copy credentials (they're now in this layer FOREVER)
COPY .npmrc ./
RUN npm install
RUN rm .npmrc  # Too late! It's in the previous layer
```

Even after deleting, the file exists in the layer:
```bash
# Anyone with image access can extract credentials
docker save myapp:latest | tar -x
# .npmrc is visible in layer tar archives
```

### Solution: BuildKit Secret Mounts

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine
WORKDIR /app

COPY package.json pnpm-lock.yaml ./

# Mount secret during build (not stored in layers)
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \\
    npm install -g pnpm && \\
    pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

CMD ["node", "dist/index.js"]
```

Build with secret:
```bash
docker build --secret id=npmrc,src=.npmrc -t myapp:latest .
```

**How it works:**
1. BuildKit mounts `.npmrc` as a temporary file during `RUN` command
2. The file is only available during that specific `RUN` instruction
3. The secret is never written to any image layer
4. After the `RUN` completes, the secret is unmounted

### Advanced: Multiple Secrets

```dockerfile
# syntax=docker/dockerfile:1
FROM python:3.12-alpine
WORKDIR /app

COPY requirements.txt ./

# Use multiple secrets
RUN --mount=type=secret,id=pip_config,target=/etc/pip.conf \\
    --mount=type=secret,id=ssh_key,target=/root/.ssh/id_rsa \\
    pip install --no-cache-dir -r requirements.txt

COPY . .
CMD ["python", "app.py"]
```

Build with multiple secrets:
```bash
docker build \\
  --secret id=pip_config,src=pip.conf \\
  --secret id=ssh_key,src=~/.ssh/id_rsa \\
  -t myapp:latest .
```

### CI/CD Integration

**GitHub Actions example:**
```yaml
- name: Build with secrets
  run: |
    echo "${{ secrets.NPM_TOKEN }}" > .npmrc
    docker build --secret id=npmrc,src=.npmrc -t myapp:latest .
    rm .npmrc
```

**GitLab CI example:**
```yaml
build:
  script:
    - echo "$NPM_TOKEN" > .npmrc
    - docker build --secret id=npmrc,src=.npmrc -t myapp:latest .
  after_script:
    - rm -f .npmrc
```

### Verify Secrets Don't Leak

```bash
# Search for secret in all layers
docker history myapp:latest
docker save myapp:latest -o image.tar
tar -xf image.tar
grep -r "secret-pattern" .
# Should return nothing
```

---

## Combining These Features

Here's a production-ready Dockerfile using all five features:

```dockerfile
# syntax=docker/dockerfile:1

# ========================================
# Build Stage
# ========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install build tools with cache mount
RUN --mount=type=cache,target=/root/.npm \\
    npm install -g pnpm

# Install dependencies with secret and cache
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \\
    --mount=type=cache,target=/root/.local/share/pnpm/store \\
    pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# ========================================
# Production Stage
# ========================================
FROM node:22-alpine AS production

# Install tini for proper signal handling
RUN apk add --no-cache tini

WORKDIR /app

# Install production dependencies only
RUN --mount=type=cache,target=/root/.npm \\
    npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \\
    pnpm install --frozen-lockfile --prod

# Copy built application
COPY --from=builder /app/dist ./dist

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \\
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Run as non-root user
USER node

# Use tini as init process
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
```

Build command:
```bash
DOCKER_BUILDKIT=1 docker build \\
  --secret id=npmrc,src=.npmrc \\
  -t myapp:latest \\
  .
```

---

## When to Use Each Feature

| Feature | Use When | Skip When |
|---------|----------|----------|
| **BuildKit** | Always (it's now default) | Legacy Docker versions |
| **Multi-stage builds** | Compiled languages, build tools needed | Simple scripts, static content |
| **Health checks** | Web services, microservices | Batch jobs, CLI tools |
| **Init process** | Long-running services | Single-process containers |
| **Build secrets** | Private registries, paid packages | Public dependencies only |

---

## Common Mistakes

### 1. Cache Mounts Without BuildKit Syntax

```dockerfile
# This fails silently
FROM node:22-alpine
RUN --mount=type=cache,target=/root/.npm npm install
```

**Fix:** Add syntax directive:
```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine
RUN --mount=type=cache,target=/root/.npm npm install
```

### 2. Health Checks That Never Pass

```dockerfile
# Wrong: checks before app starts listening
HEALTHCHECK --interval=10s --start-period=5s \\
  CMD curl -f http://localhost:3000/health
```

**Fix:** Give adequate start period:
```dockerfile
HEALTHCHECK --interval=10s --start-period=40s \\
  CMD curl -f http://localhost:3000/health
```

### 3. Copying Secrets Before Multi-Stage

```dockerfile
# Leaked in builder stage layers
FROM node:22-alpine AS builder
COPY .npmrc ./
RUN npm install
```

**Fix:** Use secret mounts:
```dockerfile
FROM node:22-alpine AS builder
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \\
    npm install
```

---

## Next Steps

Start with the feature that addresses your biggest pain point:

**Slow builds?** → Implement BuildKit cache mounts  
**Large images?** → Add multi-stage builds  
**Deployment failures?** → Add health checks  
**Graceful shutdown issues?** → Use init process  
**Security concerns?** → Switch to build secrets

Then progressively adopt the others. The combined effect is greater than the sum of the parts. A well-optimized Dockerfile using all five features builds faster, produces smaller images, runs more reliably, and maintains better security than basic approaches.

The Docker documentation has detailed guides for each feature. The BuildKit documentation in particular covers many additional capabilities beyond what we've covered here. Experiment with these features in development first, measure the impact, and then roll them out to production.

## Related Resources

- [Docker Security Best Practices](/posts/docker-security-best-practices) — harden containers for production
- [Docker Image Optimization](/posts/docker-image-optimization-best-practices) — build smaller, faster images
- [Docker Multi-Stage Build Exercise](/exercises/docker-multi-stage-build) — hands-on practice
- [Docker Security Checklist](/checklists/docker-security) — verify your setup
- [Introduction to Docker: Best Practices](/guides/introduction-to-docker) — comprehensive guide
- [DevOps Survival Guide](/books/devops-survival-guide) — broader DevOps learning path
