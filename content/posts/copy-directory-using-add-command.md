---
title: 'Copy Directory to Another Directory Using ADD Command'
excerpt: 'Learn how to use the `ADD` command in Docker to copy directories during image builds.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-07-09'
publishedAt: '2024-07-09T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - ADD Command
  - Tutorials
---

## TLDR

The `ADD` command in Docker allows you to copy directories from your local filesystem or a URL into a Docker image. This is useful for including application files, configurations, or other resources during the build process.

---

The `ADD` command in Docker is a versatile instruction that can copy files and directories into a Docker image. This guide explains how to use it effectively to copy directories.

## Step 1: Understand the `ADD` Command

The `ADD` command has the following syntax:

```dockerfile
ADD <source> <destination>
```

- `<source>`: The path to the directory or file to copy.
- `<destination>`: The path inside the image where the content will be copied.

## Step 2: Copy a Local Directory

To copy a local directory into a Docker image, specify the source and destination paths.

### Example

```dockerfile
FROM ubuntu:latest

# Copy the local 'app' directory to '/usr/src/app' in the image
ADD app /usr/src/app

WORKDIR /usr/src/app
CMD ["bash"]
```

### Explanation

- `ADD app /usr/src/app`: Copies the `app` directory from the build context to `/usr/src/app` in the image.
- `WORKDIR /usr/src/app`: Sets the working directory to `/usr/src/app`.

## Step 3: Copy a Directory from a URL

The `ADD` command can also download and extract files from a URL.

### Example

```dockerfile
FROM ubuntu:latest

# Download and extract a tarball from a URL
ADD https://example.com/files/app.tar.gz /usr/src/app

WORKDIR /usr/src/app
CMD ["bash"]
```

### Explanation

- `ADD https://example.com/files/app.tar.gz /usr/src/app`: Downloads and extracts the tarball to `/usr/src/app`.

## Step 4: Preserve Directory Structure

The `ADD` command preserves the directory structure of the source.

### Example

```dockerfile
FROM ubuntu:latest

# Copy the entire 'config' directory
ADD config /etc/config

CMD ["bash"]
```

### Explanation

- `ADD config /etc/config`: Copies the `config` directory and its contents to `/etc/config`.

## Step 5: Use `.dockerignore` for Exclusions

To exclude certain files or directories, use a `.dockerignore` file.

### Example `.dockerignore`

```
node_modules
*.log
```

### Explanation

- Excludes `node_modules` and all `.log` files from being copied.

## Best Practices

- **Prefer `COPY` for Simplicity**: Use `COPY` instead of `ADD` unless you need its advanced features (e.g., downloading from URLs).
- **Use `.dockerignore`**: Exclude unnecessary files to reduce image size.
- **Validate Paths**: Ensure source paths are correct and within the build context.

By following these steps, you can effectively use the `ADD` command to copy directories into Docker images, enabling efficient and organized builds.
