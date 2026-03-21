---
title: 'COPY with Docker but with Exclusion'
excerpt: 'Learn how to use the COPY instruction in Docker with exclusion patterns to optimize your Docker builds.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2025-07-04'
publishedAt: '2025-07-04T09:00:00Z'
updatedAt: '2025-07-04T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Dockerfile
  - COPY
  - Exclusion
  - Tutorials
---

## TLDR

To exclude files or directories when using the `COPY` instruction in Docker, leverage `.dockerignore` files. This ensures that unwanted files are not copied into your Docker image, optimizing build times and reducing image size.

---

The `COPY` instruction in Docker is used to copy files and directories from your local filesystem into a Docker image. However, there are scenarios where you might want to exclude certain files or directories from being copied. This guide will show you how to achieve this using `.dockerignore` files.

## Step 1: Create a `.dockerignore` File

The `.dockerignore` file allows you to specify patterns for files and directories to exclude during the Docker build process. Create a `.dockerignore` file in the same directory as your `Dockerfile`.

### Example `.dockerignore` File

```plaintext
node_modules
*.log
.env
temp/
```

### Explanation

- `node_modules`: Excludes the `node_modules` directory.
- `*.log`: Excludes all `.log` files.
- `.env`: Excludes the `.env` file.
- `temp/`: Excludes the `temp` directory.

## Step 2: Use the `COPY` Instruction

In your `Dockerfile`, use the `COPY` instruction to copy files into the image. The `.dockerignore` file will automatically exclude the specified files and directories.

### Example `Dockerfile`

```dockerfile
FROM node:18
WORKDIR /app
COPY . .
RUN npm install
CMD ["node", "app.js"]
```

### Explanation

- `COPY . .`: Copies all files from the current directory into the `/app` directory in the image, excluding files specified in `.dockerignore`.
- `RUN npm install`: Installs dependencies.
- `CMD ["node", "app.js"]`: Starts the application.

## Step 3: Build the Docker Image

Build the Docker image using the `docker build` command:

```bash
docker build -t my-app .
```

This command builds the image and excludes files specified in `.dockerignore`.

## Advanced Options

### Exclude Files Dynamically

You can dynamically exclude files by generating a `.dockerignore` file during the build process. For example:

```bash
echo "temp/" > .dockerignore
docker build -t my-app .
```

### Multi-Stage Builds

Use multi-stage builds to copy only the necessary files into the final image:

```dockerfile
FROM node:18 AS builder
WORKDIR /app
COPY . .
RUN npm install

FROM node:18
WORKDIR /app
COPY --from=builder /app/dist /app/dist
CMD ["node", "app/dist/app.js"]
```

### Explanation

- The `builder` stage installs dependencies and builds the application.
- The final stage copies only the `dist` directory from the `builder` stage.

## Best Practices

- **Minimize Context**: Use `.dockerignore` to reduce the build context size.
- **Keep `.dockerignore` Updated**: Regularly update `.dockerignore` to exclude unnecessary files.
- **Test Builds**: Test your Docker builds to ensure excluded files are not copied.

By following these steps, you can effectively use the `COPY` instruction in Docker with exclusion patterns, optimizing your Docker builds and improving image efficiency.

## Related Resources

- [Difference Between RUN and CMD in a Dockerfile](/posts/difference-run-cmd-dockerfile) — Dockerfile instruction fundamentals
- [Docker Image Optimization](/posts/docker-image-optimization-best-practices) — build smaller images
- [Advanced Docker Features](/posts/advanced-docker-features) — multi-stage builds and BuildKit
- [Docker Multi-Stage Build Exercise](/exercises/docker-multi-stage-build) — hands-on practice
- [Introduction to Docker: Building Custom Images](/guides/introduction-to-docker) — full Dockerfile guide
