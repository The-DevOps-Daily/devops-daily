---
title: 'Docker - Ubuntu - bash: ping: command not found [closed]'
excerpt: "Resolve the 'ping: command not found' error in Ubuntu-based Docker containers by installing missing packages."
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-09-10'
publishedAt: '2024-09-10T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Ubuntu
  - Networking
  - DevOps
---

## TLDR

If you see `bash: ping: command not found` in an Ubuntu-based Docker container, install the `iputils-ping` package using `apt-get install`.

---

The `ping` command is often used to test network connectivity, but it may not be available in minimal Ubuntu-based Docker images. This guide explains how to resolve the issue and why it happens.

### Why Is `ping` Missing?

Minimal Docker images, like `ubuntu:latest`, exclude many utilities to keep the image size small. The `ping` command is part of the `iputils-ping` package, which is not installed by default.

### Installing `ping` in a Docker Container

To install `ping`, you need to update the package list and install the `iputils-ping` package:

```bash
# Start a shell in the container
docker exec -it <container_name_or_id> bash

# Update package list
apt-get update

# Install iputils-ping
apt-get install -y iputils-ping
```

Now you can use the `ping` command inside the container.

### Making the Change Persistent

If you frequently need `ping` in your containers, add it to your Dockerfile:

```Dockerfile
FROM ubuntu:latest
RUN apt-get update && apt-get install -y iputils-ping
```

Build the image:

```bash
docker build -t ubuntu-with-ping .
```

This way, every time you run a container from this image, `ping` will be available. For example:

```bash
docker run --rm -it ubuntu-with-ping bash
```

You can now use `ping` without any issues.

### Best Practices

- Use minimal images for production to reduce attack surface.
- Only install tools like `ping` when needed for debugging or testing.
- Document any manual changes to containers.

By following these steps, you can quickly resolve the `ping: command not found` error and ensure your containers have the tools you need.

Good luck with your project!

## Related Resources

- [Docker Alpine: How to Use Bash](/posts/docker-alpine-use-bash) — install tools in Alpine images
- [PS Command Not Working in Docker](/posts/ps-command-not-working-docker) — install missing utilities
- [How to Use Sudo in Docker Container](/posts/how-to-use-sudo-in-docker-container) — permissions in containers
- [Introduction to Docker Guide](/guides/introduction-to-docker) — Docker basics
