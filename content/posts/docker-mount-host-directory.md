---
title: 'How to Mount a Host Directory in a Docker Container'
excerpt: 'Learn how to mount a local directory into a Docker container for development, data sharing, or configuration. This guide covers syntax, permissions, and real-world use cases.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-05-22'
publishedAt: '2024-05-22T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Volumes
  - Development
  - DevOps
---

## TLDR

Use the `-v` or `--volume` flag with `docker run` to mount a host directory into your container. This is useful for sharing code, data, or configuration files between your system and the container.

## Prerequisites

- Docker installed
- A directory on your host to mount

## Basic Syntax for Mounting a Directory

The `-v` flag lets you specify a host directory and a container directory, separated by a colon. For example:

```bash
# Mount ./data from your host to /app/data in the container
docker run --rm -v $(pwd)/data:/app/data busybox ls /app/data
```

This command runs `ls` inside the container, showing the contents of your local `./data` directory as seen from `/app/data` in the container.

## Read-Only Mounts

If you want the container to have read-only access, add `:ro` to the end:

```bash
# Mount as read-only
docker run --rm -v $(pwd)/config:/etc/config:ro busybox ls /etc/config
```

This is helpful for sharing configuration files without letting the container modify them.

## Permissions and SELinux Notes

On Linux, make sure your user has permission to access the host directory. If you run into permission issues, try adjusting ownership or using `sudo`.

## Next Steps

Try mounting different directories for development, or use named volumes for persistent data. Explore Docker Compose for more complex setups.

Good luck with your project!

## Related Resources

- [How to Add a Volume to an Existing Container](/posts/how-to-add-a-volume-to-an-existing-docker-container) — add volumes after creation
- [Docker Persistent Storage for Databases](/posts/docker-persistent-storage-databases) — database volume patterns
- [Docker Data Loss When Container Exits](/posts/docker-data-loss-when-container-exits) — prevent data loss
- [Introduction to Docker: Volumes](/guides/introduction-to-docker) — volume fundamentals
