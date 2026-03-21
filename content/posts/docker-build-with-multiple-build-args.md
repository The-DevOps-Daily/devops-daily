---
title: 'How to Use Multiple Build Arguments in Docker Build'
excerpt: "Learn how to pass multiple build-time variables to Docker builds using --build-arg, set default values in Dockerfiles, and use build arguments for environment-specific configurations."
category:
  name: 'Docker'
  slug: 'docker'
date: '2025-01-09'
publishedAt: '2025-01-09T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Dockerfile
  - Build
  - DevOps
  - Configuration
---

**TLDR:** Pass multiple build arguments to `docker build` by repeating the `--build-arg` flag for each variable: `docker build --build-arg VAR1=value1 --build-arg VAR2=value2 -t myapp .`. Define these arguments in your Dockerfile with `ARG` instructions, optionally with default values. Build args are available only during build time, not at runtime - use ENV for runtime variables.

Build arguments let you customize Docker images at build time without hardcoding values. You can pass configuration like version numbers, API endpoints, or feature flags that affect how the image is built.

## Basic Syntax

In your Dockerfile, declare arguments with `ARG`:

```dockerfile
FROM node:18

# Declare build arguments
ARG NODE_ENV
ARG API_URL
ARG VERSION

# Use them during build
RUN echo "Building for environment: $NODE_ENV"
RUN echo "API URL: $API_URL"
RUN echo "Version: $VERSION"

# Copy and install dependencies
WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
```

Then pass values when building:

```bash
docker build \
  --build-arg NODE_ENV=production \
  --build-arg API_URL=https://api.example.com \
  --build-arg VERSION=1.2.3 \
  -t myapp:1.2.3 \
  .
```

Each `--build-arg` flag provides a value for one argument. You can have as many as you need.

## Default Values

Provide default values in the Dockerfile so the build works even without explicit arguments:

```dockerfile
FROM python:3.11

# Arguments with defaults
ARG PYTHON_ENV=development
ARG WORKERS=4
ARG PORT=8000

# These will use defaults if not provided
RUN echo "Environment: $PYTHON_ENV"
RUN echo "Workers: $WORKERS"
RUN echo "Port: $PORT"

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# You can use build args in CMD as well, but they become hardcoded
CMD ["gunicorn", "--workers", "${WORKERS}", "--bind", "0.0.0.0:${PORT}", "app:app"]
```

Build without arguments (uses defaults):

```bash
docker build -t myapp:dev .
# Uses: PYTHON_ENV=development, WORKERS=4, PORT=8000
```

Build with custom values:

```bash
docker build \
  --build-arg PYTHON_ENV=production \
  --build-arg WORKERS=8 \
  --build-arg PORT=80 \
  -t myapp:prod \
  .
```

## Build Args vs Environment Variables

Build arguments (ARG) are only available during the build process. If you need values at runtime, convert them to environment variables:

```dockerfile
FROM ubuntu:22.04

# Build-time argument
ARG VERSION=1.0.0

# Convert to runtime environment variable
ENV APP_VERSION=$VERSION

# Build-time argument for installation
ARG INSTALL_DEV_TOOLS=false

# Conditionally install based on build arg
RUN if [ "$INSTALL_DEV_TOOLS" = "true" ]; then \
      apt-get update && apt-get install -y vim curl git; \
    fi

# This ENV is available at runtime
ENV NODE_ENV=production

CMD ["echo", "App version: $APP_VERSION"]
```

```bash
# Build with dev tools
docker build --build-arg INSTALL_DEV_TOOLS=true -t myapp:dev .

# Build without dev tools (production)
docker build --build-arg INSTALL_DEV_TOOLS=false -t myapp:prod .

# Run and see the version
docker run myapp:dev
# Output: App version: 1.0.0
```

## Real-World Example: Multi-Environment Build

Here's a practical example for building different environments:

```dockerfile
FROM node:18-alpine AS base

# Build arguments
ARG BUILD_DATE
ARG VERSION=latest
ARG ENVIRONMENT=development

# Install dependencies
WORKDIR /app
COPY package*.json ./

# Development stage
FROM base AS development
ARG NODE_ENV=development
ENV NODE_ENV=$NODE_ENV

RUN npm install
COPY . .
CMD ["npm", "run", "dev"]

# Production stage
FROM base AS production
ARG NODE_ENV=production
ENV NODE_ENV=$NODE_ENV

RUN npm ci --only=production
COPY . .
RUN npm run build

CMD ["npm", "start"]

# Use the stage specified by ENVIRONMENT arg
FROM ${ENVIRONMENT} AS final

# Add metadata using build args
LABEL version="${VERSION}"
LABEL build-date="${BUILD_DATE}"
LABEL environment="${ENVIRONMENT}"

EXPOSE 3000
```

Build for development:

```bash
docker build \
  --build-arg ENVIRONMENT=development \
  --build-arg VERSION=1.0.0-dev \
  --build-arg BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ") \
  -t myapp:dev \
  .
```

Build for production:

```bash
docker build \
  --build-arg ENVIRONMENT=production \
  --build-arg VERSION=1.0.0 \
  --build-arg BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ") \
  -t myapp:1.0.0 \
  .
```

## Using Build Args for Dependency Versions

Lock down versions at build time:

```dockerfile
FROM ubuntu:22.04

# Version arguments
ARG PYTHON_VERSION=3.11
ARG NODE_VERSION=18

# Install specific versions
RUN apt-get update && \
    apt-get install -y \
      python${PYTHON_VERSION} \
      nodejs=${NODE_VERSION}.* \
    && rm -rf /var/lib/apt/lists/*

# Verify versions
RUN python${PYTHON_VERSION} --version && \
    node --version
```

```bash
# Build with specific versions
docker build \
  --build-arg PYTHON_VERSION=3.10 \
  --build-arg NODE_VERSION=16 \
  -t myapp:py3.10-node16 \
  .
```

## Build Args from File

For many arguments, use a file instead of repeating `--build-arg`:

Create `build.args`:

```bash
VERSION=1.5.0
ENVIRONMENT=staging
API_URL=https://staging-api.example.com
DATABASE_URL=postgresql://localhost/stagingdb
CACHE_ENABLED=true
MAX_CONNECTIONS=100
```

Reference it in the build (not directly supported, but you can script it):

```bash
# Read from file and build (bash)
while IFS='=' read -r key value; do
  BUILD_ARGS="$BUILD_ARGS --build-arg $key=$value"
done < build.args

docker build $BUILD_ARGS -t myapp:staging .
```

Or use a build script:

```bash
#!/bin/bash
# build.sh

docker build \
  --build-arg VERSION=1.5.0 \
  --build-arg ENVIRONMENT=staging \
  --build-arg API_URL=https://staging-api.example.com \
  --build-arg DATABASE_URL=postgresql://localhost/stagingdb \
  --build-arg CACHE_ENABLED=true \
  --build-arg MAX_CONNECTIONS=100 \
  -t myapp:staging \
  .
```

```bash
chmod +x build.sh
./build.sh
```

## Conditional Logic with Build Args

Use build arguments to enable/disable features:

```dockerfile
FROM golang:1.21-alpine

ARG ENABLE_CGO=0
ARG ENABLE_RACE_DETECTOR=false
ARG BUILD_TAGS=""

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Build with conditional flags
RUN CGO_ENABLED=${ENABLE_CGO} \
    go build \
    $([ "$ENABLE_RACE_DETECTOR" = "true" ] && echo "-race") \
    -tags="${BUILD_TAGS}" \
    -o /app/server \
    .

CMD ["/app/server"]
```

```bash
# Build with CGO enabled
docker build --build-arg ENABLE_CGO=1 -t myapp:cgo .

# Build with race detector
docker build --build-arg ENABLE_RACE_DETECTOR=true -t myapp:race .

# Build with custom tags
docker build --build-arg BUILD_TAGS="json1,fts5" -t myapp:sqlite .
```

## Using Build Args in Multi-Stage Builds

Pass arguments to specific stages:

```dockerfile
FROM node:18 AS builder

ARG BUILD_ENV=production
ARG API_KEY

# Build step uses API_KEY
RUN echo "Building with API key: ${API_KEY}"
COPY . .
RUN npm run build -- --env=${BUILD_ENV}

FROM nginx:alpine

ARG VERSION=unknown

# Copy build artifacts from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Add version label
LABEL version="${VERSION}"

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

```bash
docker build \
  --build-arg BUILD_ENV=production \
  --build-arg API_KEY=abc123 \
  --build-arg VERSION=2.0.0 \
  -t webapp:2.0.0 \
  .
```

Note that `API_KEY` is only available in the `builder` stage and won't be in the final image - this is good for security.

## Security Considerations

Build arguments can be viewed in the image metadata:

```bash
# Build with a "secret"
docker build --build-arg SECRET_KEY=my-secret -t myapp .

# View the build history - SECRET_KEY is visible!
docker history myapp
```

For actual secrets, use BuildKit secrets (Docker 18.09+):

```dockerfile
# syntax=docker/dockerfile:1

FROM alpine

# Mount a secret (not a build arg)
RUN --mount=type=secret,id=mysecret \
    cat /run/secrets/mysecret > /app/config
```

```bash
# Pass secret securely
docker build --secret id=mysecret,src=./secret.txt -t myapp .
```

The secret is never stored in the image layers.

## Validating Build Arguments

Add validation to prevent invalid builds:

```dockerfile
FROM ubuntu:22.04

ARG ENVIRONMENT
ARG VERSION

# Validate ENVIRONMENT
RUN if [ -z "$ENVIRONMENT" ]; then \
      echo "ERROR: ENVIRONMENT build arg is required"; \
      exit 1; \
    fi

RUN if [ "$ENVIRONMENT" != "development" ] && \
       [ "$ENVIRONMENT" != "staging" ] && \
       [ "$ENVIRONMENT" != "production" ]; then \
      echo "ERROR: ENVIRONMENT must be development, staging, or production"; \
      exit 1; \
    fi

# Validate VERSION format (basic check)
RUN if [ -z "$VERSION" ]; then \
      echo "ERROR: VERSION build arg is required"; \
      exit 1; \
    fi

ENV APP_ENV=$ENVIRONMENT
ENV APP_VERSION=$VERSION
```

```bash
# This will fail
docker build -t myapp .
# ERROR: ENVIRONMENT build arg is required

# This will fail
docker build --build-arg ENVIRONMENT=testing -t myapp .
# ERROR: ENVIRONMENT must be development, staging, or production

# This works
docker build --build-arg ENVIRONMENT=production --build-arg VERSION=1.0 -t myapp .
```

## Docker Compose with Build Args

Pass build arguments through Docker Compose:

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build:
      context: .
      args:
        - NODE_ENV=production
        - VERSION=1.0.0
        - API_URL=https://api.example.com
    ports:
      - "3000:3000"

  app-dev:
    build:
      context: .
      args:
        NODE_ENV: development
        VERSION: 1.0.0-dev
        API_URL: http://localhost:8080
    ports:
      - "3001:3000"
```

```bash
# Build with compose
docker-compose build app

# Or override from environment
NODE_ENV=staging VERSION=1.1.0 docker-compose build app
```

## Checking What Build Args Are Available

To see what build arguments a Dockerfile expects:

```bash
# View the Dockerfile
grep "^ARG" Dockerfile

# Output:
# ARG NODE_ENV
# ARG VERSION=1.0.0
# ARG API_URL
```

Or inspect a built image:

```bash
docker history myapp --no-trunc
# Shows build commands including ARG values used
```

Build arguments are a clean way to customize Docker images at build time without maintaining multiple Dockerfiles. Use them for configuration that affects the build process, but remember they're baked into the image - for runtime configuration, use environment variables with `docker run -e` or Docker Compose.
