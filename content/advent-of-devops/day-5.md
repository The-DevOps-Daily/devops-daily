---
title: 'Day 5 - Debug a Broken Container'
day: 5
excerpt: 'Troubleshoot and fix a container that fails to start. Learn essential debugging techniques for containerized applications.'
description: 'Master Docker debugging skills by diagnosing and fixing common container issues including crashes, networking problems, and misconfiguration.'
publishedAt: '2025-12-05T00:00:00Z'
updatedAt: '2026-04-19T00:00:00Z'
difficulty: 'Beginner'
category: 'Docker'
tags:
  - Docker
  - Debugging
  - Troubleshooting
  - Containers
---

## Description

Your application container keeps crashing immediately after startup. The logs show cryptic errors, and you need to figure out what's wrong. This is a common scenario in production environments where containers fail due to configuration issues, missing dependencies, or runtime errors.

## Task

Debug and fix a broken Docker container that crashes on startup.

**Requirements:**
- Identify why the container is crashing
- Fix the underlying issue
- Verify the container runs successfully
- Document the root cause

## Target

- ✅ Container starts and stays running
- ✅ Application responds to health checks
- ✅ No errors in container logs
- ✅ Root cause identified and documented

## Sample App

### Broken Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Missing package.json copy!
RUN npm install

COPY . .

# Wrong port exposed
EXPOSE 8080

# Incorrect startup command
CMD ["node", "server.js"]
```

### Application Code (server.js)

```javascript
const express = require('express');
const app = express();

// Port from environment variable
const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.get('/', (req, res) => {
  res.send('Hello from fixed container!');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### package.json

```json
{
  "name": "broken-app",
  "version": "1.0.0",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.0"
  }
}
```

## Solution

### Debugging Steps

#### 1. Check Container Status

```bash
# List all containers including stopped ones
docker ps -a

# Expected output shows container exited
# CONTAINER ID   IMAGE          STATUS
# abc123def456   broken-app     Exited (1) 2 seconds ago
```

#### 2. View Container Logs

```bash
# Check logs for errors
docker logs <container-id>

# Or with follow mode
docker logs -f <container-id>

# Common errors you might see:
# - Cannot find module 'express'
# - ENOENT: no such file or directory
# - Port already in use
```

#### 3. Inspect the Image

```bash
# Check image layers
docker history broken-app:latest

# Inspect container configuration
docker inspect <container-id>
```

#### 4. Interactive Debugging

```bash
# Override entrypoint to explore container
docker run -it --entrypoint /bin/sh broken-app:latest

# Inside container, check:
ls -la /app                    # Check files
cat package.json               # Verify dependencies
npm list                       # Check installed packages
```

### Fixed Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files first (better layer caching)
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Correct port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use npm start for better signal handling
CMD ["npm", "start"]
```

### docker-compose.yml (for easier testing)

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 5s
```

## Explanation

### Common Container Issues

#### 1. Missing Dependencies

**Problem:**
```dockerfile
RUN npm install  # Before copying package.json
```

**Solution:**
```dockerfile
COPY package*.json ./
RUN npm ci --only=production
```

**Why it matters:** Layer ordering is crucial. Dependencies must be defined before installation.

#### 2. Port Mismatch

**Problem:**
```dockerfile
EXPOSE 8080  # But app listens on 3000
```

**Solution:**
```dockerfile
EXPOSE 3000
# And ensure environment variable matches
ENV PORT=3000
```

#### 3. Improper Signal Handling

**Problem:**
```dockerfile
CMD ["node", "server.js"]  # Doesn't handle SIGTERM
```

**Solution:**
```dockerfile
CMD ["npm", "start"]  # Better signal propagation
```

Or use tini:
```dockerfile
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
```

### Debugging Toolkit

#### Essential Commands

```bash
# View real-time logs
docker logs -f --tail 100 <container>

# Execute command in running container
docker exec -it <container> /bin/sh

# View resource usage
docker stats <container>

# Inspect container details
docker inspect <container> | jq '.[0].State'

# View processes in container
docker top <container>
```

#### Common Error Patterns

| Error | Likely Cause | Solution |
|-------|-------------|----------|
| `Cannot find module` | Missing npm install | Copy package.json before RUN |
| `EADDRINUSE` | Port conflict | Change port or stop conflicting service |
| `ENOENT` | File not found | Verify COPY commands |
| `Permission denied` | Wrong user/permissions | Use correct USER or fix permissions |
| `Exit code 137` | Out of memory | Increase memory limit |

### Health Checks

```dockerfile
# HTTP health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1

# TCP health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD nc -z localhost 3000 || exit 1

# Custom script
HEALTHCHECK --interval=30s --timeout=3s \
  CMD /app/healthcheck.sh || exit 1
```

## Result

After fixing the issues:

```bash
# Build the fixed image
docker build -t fixed-app:latest .

# Run the container
docker run -d -p 3000:3000 --name my-app fixed-app:latest

# Verify it's running
docker ps
# CONTAINER ID   IMAGE              STATUS                    PORTS
# xyz789abc123   fixed-app:latest   Up 30 seconds (healthy)   0.0.0.0:3000->3000/tcp

# Test the application
curl http://localhost:3000
# Hello from fixed container!

curl http://localhost:3000/health
# {"status":"healthy"}

# Check logs
docker logs my-app
# Server running on port 3000
```

## Validation

### Test Checklist

```bash
# 1. Container starts successfully
docker ps | grep my-app
# Should show "Up" status

# 2. Health check passes
docker inspect my-app | jq '.[0].State.Health.Status'
# Should return "healthy"

# 3. Application responds
curl -f http://localhost:3000/health
# Should return 200 OK

# 4. No errors in logs
docker logs my-app --tail 50
# Should show normal startup messages

# 5. Container handles restart
docker restart my-app && sleep 5 && curl http://localhost:3000
# Should respond after restart
```

## Advanced Debugging

### Use Multi-Stage Builds for Debugging

```dockerfile
# Debug stage
FROM node:18-alpine AS debug
WORKDIR /app
COPY package*.json ./
RUN npm install  # Include dev dependencies
COPY . .
CMD ["npm", "run", "dev"]

# Production stage
FROM node:18-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
CMD ["npm", "start"]
```

Build debug version:
```bash
docker build --target debug -t app:debug .
```

### Docker Events Monitoring

```bash
# Monitor container events
docker events --filter container=my-app

# Monitor all events
docker events --since '2023-12-05T00:00:00' --until '2023-12-05T23:59:59'
```

### Performance Debugging

```bash
# Limit resources for testing
docker run -d \
  --memory="256m" \
  --cpus="0.5" \
  --name resource-limited \
  fixed-app:latest

# Monitor resource usage
docker stats resource-limited
```

## Best Practices

### ✅ Do's

1. **Use health checks**: Detect issues early
2. **Check logs first**: Most issues are logged
3. **Use .dockerignore**: Prevent unnecessary files
4. **Layer caching**: Order Dockerfile for optimal caching
5. **Run as non-root**: Security best practice

### ❌ Don'ts

1. **Don't ignore exit codes**: They indicate failure types
2. **Don't use `:latest` in prod**: Pin versions
3. **Don't run as root**: Security risk
4. **Don't store secrets in images**: Use secrets management
5. **Don't use `ADD` when `COPY` works**: Less confusion

## Links

- [Docker Debugging Guide](https://docs.docker.com/config/containers/logging/)
- [Dockerfile Best Practices](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)
- [Docker Health Checks](https://docs.docker.com/engine/reference/builder/#healthcheck)
- [Container Troubleshooting](https://docs.docker.com/config/containers/troubleshoot/)
- [Docker CLI Reference](https://docs.docker.com/engine/reference/commandline/cli/)

## Share Your Success

Fixed your broken container? Share your debugging journey!

**Tag [@thedevopsdaily](https://x.com/thedevopsdaily)** on X with:
- What was broken
- How you debugged it
- The fix you applied
- Screenshot of healthy container

Use hashtags: **#AdventOfDevOps #Docker #Debugging #Day5**
