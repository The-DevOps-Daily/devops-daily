---
title: 'Understanding the Difference Between COPY and ADD in Dockerfiles'
excerpt: 'Learn when to use COPY vs ADD instructions in your Dockerfiles for better security and build performance'
category:
  name: 'Docker'
  slug: 'docker'
date: '2025-04-20'
publishedAt: '2025-04-20T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags: ['docker', 'dockerfile', 'containers', 'best-practices']
---

Both `COPY` and `ADD` instructions in Dockerfiles let you copy files from your build context into your Docker image. While they might seem interchangeable, there are important differences that impact security, image size, and build performance. This guide explains when to use each command and the best practices for efficient Docker builds.

## Prerequisites

Before you begin, make sure you have:

- Docker installed on your system (version 20.10 or newer)
- Basic understanding of Docker and Dockerfile concepts

## The COPY Instruction: Simple and Reliable

The `COPY` instruction copies files and directories from your build context to the specified path in the container filesystem.

### Basic Usage

```dockerfile
# Copy a single file to the specified location
COPY package.json /app/

# Copy multiple files to a destination
COPY server.js config.json /app/

# Copy entire directory contents
COPY src/ /app/src/

# Copy with permissions (available in Docker 17.09+)
COPY --chown=node:node app/ /app/
```

The `COPY` instruction is straightforward and predictable: it only copies local files from your build context. It doesn't perform any automatic extraction or URL handling.

## The ADD Instruction: Extra Capabilities

The `ADD` instruction extends the functionality of `COPY` with two additional features:

1. Automatic tar extraction
2. URL support

### Local Archive Extraction

```dockerfile
# Extract a local tarball into the container
ADD project.tar.gz /app/

# The contents of project.tar.gz are automatically extracted into /app/
```

When you use `ADD` with a local compressed file (recognized formats include gzip, bzip2, and xz), Docker will automatically extract its contents into the destination directory.

### URL Support

```dockerfile
# Download a file from a URL and place it in the container
ADD https://example.com/app-binary /usr/local/bin/app

# Add a file from a URL with permissions (available in Docker 17.09+)
ADD --chown=node:node https://example.com/file.txt /app/
```

The `ADD` instruction can fetch files from URLs and add them to your image. This capability enables adding resources directly from external sources.

## When to Use COPY (Most of the Time)

In most scenarios, `COPY` is the preferred option. Here's why:

1. **Explicit behavior**: `COPY` is predictable and does exactly what you ask - nothing more, nothing less.

2. **Security considerations**: Using `COPY` reduces the risk of including potentially malicious content from URLs or unexpected files from auto-extracted archives.

3. **Better cache utilization**: Docker's layer caching works more efficiently with `COPY` because the action is more specific and deterministic.

4. **Official recommendation**: Docker's own best practices recommend using `COPY` unless you specifically need the additional features of `ADD`.

### Example: COPY for a Node.js Application

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files first to leverage Docker's layer caching
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --only=production

# Then copy application code
COPY src/ ./src/

# Set appropriate permissions
COPY --chown=node:node . .

USER node
CMD ["node", "src/index.js"]
```

This approach takes advantage of Docker's build cache. If your package files don't change, Docker reuses the cached layer with the installed dependencies, making your builds faster.

## When to Use ADD (Special Cases)

Use `ADD` only when you need its special capabilities:

1. **Auto-extraction of archives**: When you need to extract a local tarball, zip, or other compressed file into your image.

2. **Remote file acquisition**: When you need to download a file from a URL directly into your image.

### Example: ADD for Archive Extraction

```dockerfile
FROM ubuntu:22.04

WORKDIR /app

# Extract application archive into container
ADD app-bundle.tar.gz /app/

# Set permissions after extraction
RUN chown -R app:app /app

USER app
CMD ["./start.sh"]
```

### Example: ADD for Remote Files

```dockerfile
FROM alpine:3.17

# Download a specific version of a binary and make it executable
ADD https://github.com/example/tool/releases/download/v1.2.3/tool-linux-amd64 /usr/local/bin/tool
RUN chmod +x /usr/local/bin/tool

CMD ["tool", "--help"]
```

## Best Practices

### Avoid ADD for Remote Files When Possible

Although `ADD` supports URLs, it's often better to use `RUN` with `curl` or `wget` instead:

```dockerfile
# Better approach for downloading files
RUN curl -fsSL https://example.com/file.tar.gz | tar -xz -C /opt/ \
    && rm -rf /var/lib/apt/lists/*
```

This approach offers several advantages:

1. You can verify checksums or perform additional operations in the same layer
2. You can clean up files in the same layer, reducing image size
3. You have more control over the process

### Layer Optimization

Both `COPY` and `ADD` create a new layer in your Docker image. To optimize build speed and final image size:

1. **Group related files**: Combine related `COPY` operations to reduce the number of layers.

2. **Copy files strategically**: Copy files that change less frequently first, allowing better use of the build cache.

```dockerfile
# Bad: Many separate COPY commands
COPY file1.txt /app/
COPY file2.txt /app/
COPY file3.txt /app/

# Better: Group files into a single COPY command
COPY file1.txt file2.txt file3.txt /app/
```

## Practical Comparison

Here's a quick reference for choosing between `COPY` and `ADD`:

| Task                           | Recommended Instruction  | Notes                                 |
| ------------------------------ | ------------------------ | ------------------------------------- |
| Copy files from build context  | `COPY`                   | Default choice for most scenarios     |
| Extract local archive          | `ADD`                    | Automatically extracts archives       |
| Download from URL              | `RUN` with `curl`/`wget` | Preferred over `ADD` for more control |
| Copy with specific permissions | `COPY --chown=`          | Available since Docker 17.09          |

## Troubleshooting

### Common Issues with COPY and ADD

1. **Path problems**: Both commands are sensitive to the source and destination paths.

   ```dockerfile
   # This copies the contents of src/ to /app/
   COPY src/ /app/

   # This copies the src directory itself to /app/src/
   COPY src /app/
   ```

2. **Build context issues**: You can only copy files from within your build context.

   ```bash
   # If you try to copy files outside the build context:
   COPY /etc/hosts /app/  # This will fail!
   ```

3. **URL timeouts with ADD**: When downloading from URLs, there's no built-in retry or timeout control.

## Next Steps

Now that you understand the differences between `COPY` and `ADD`, you might want to:

- Review your existing Dockerfiles to replace unnecessary `ADD` instructions with `COPY`
- Learn more about multi-stage builds to further optimize your Docker images
- Explore Docker security scanning tools to verify the contents of your images

Happy containerizing!

## Related Resources

- [COPY with Docker Exclusion](/posts/copy-with-docker-exclusion) — .dockerignore patterns
- [Difference Between RUN and CMD](/posts/difference-run-cmd-dockerfile) — more Dockerfile instructions
- [Docker Image Optimization](/posts/docker-image-optimization-best-practices) — build smaller images
- [Docker Security Best Practices](/posts/docker-security-best-practices) — secure Dockerfiles
- [Docker Multi-Stage Build Exercise](/exercises/docker-multi-stage-build) — hands-on practice
