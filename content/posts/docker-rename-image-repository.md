---
title: 'Docker: How to Change Repository Name or Rename an Image'
excerpt: 'Learn how to rename a Docker image or change its repository name using simple Docker CLI commands. This guide covers real-world scenarios and best practices.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-03-12'
publishedAt: '2024-03-12T09:00:00Z'
updatedAt: '2026-03-21T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Images
  - DevOps
  - Containers
---

## TLDR

To rename a Docker image or change its repository name, use `docker tag` to create a new tag, then optionally remove the old image with `docker rmi`. This is useful when you want to push an image to a different registry or organize your local images.

## Prerequisites

- Docker installed (version 20.10+ recommended)
- Access to your terminal

## Tagging an Image with a New Repository Name

If you want to change the repository name or "rename" an image, you actually create a new tag for the image. This does not duplicate the image data, just adds a new reference.

```bash
# Tag the existing image with a new repository and tag
# Syntax: docker tag <old-name>:<tag> <new-repo>:<new-tag>
docker tag node-app:latest registry.example.com/prod/node-app:1.2.0
```

This command creates a new tag for the `node-app:latest` image, now referenced as `registry.example.com/prod/node-app:1.2.0`. This is especially helpful when preparing to push to a remote registry.

## Removing the Old Image Tag

After retagging, you might want to remove the old tag to keep your local images tidy.

```bash
# Remove the old image tag
docker rmi node-app:latest
```

This only removes the tag, not the underlying image data if other tags still reference it.

## Verifying the Change

You can list your images to confirm the new tag is present and the old one is gone.

```bash
# List all Docker images
docker images
```

You'll see output like:

```
REPOSITORY                        TAG       IMAGE ID       CREATED         SIZE
registry.example.com/prod/node-app 1.2.0    1a2b3c4d5e6f   2 hours ago     150MB
```

## Next Steps

Now you can push your retagged image to a remote registry or use it in your deployments. Try automating this process in your CI/CD pipeline for consistent image naming.

Good luck with your project!

## Related Resources

- [Push Docker Image to Private Repo](/posts/push-docker-image-private-repo) — push renamed images
- [Docker Push: Denied Access](/posts/docker-push-denied-access) — fix push errors
- [Copy Docker Images Between Hosts](/posts/copy-docker-images-between-hosts-withouta-repository) — transfer images
- [Introduction to Docker: Working with Images](/guides/introduction-to-docker) — image management
