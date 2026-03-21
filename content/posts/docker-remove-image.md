---
title: 'How to Remove a Docker Image'
excerpt: 'Learn how to safely remove Docker images, clean up unused layers, and avoid common pitfalls when managing local images.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-03-03'
publishedAt: '2024-03-03T09:00:00Z'
updatedAt: '2024-03-03T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Images
  - Cleanup
  - DevOps
---

## TLDR

Use `docker rmi <image>` to remove a Docker image. If the image is in use by a container, stop and remove the container first. Use `docker image prune` to clean up dangling images.

---

Docker images can pile up quickly, especially during development or CI/CD runs. Removing unused images helps free up disk space and keeps your environment tidy.

### Why Remove Docker Images?

- **Save Disk Space**: Old images can consume gigabytes of storage.
- **Reduce Clutter**: Fewer images make it easier to manage and find what you need.
- **Avoid Conflicts**: Outdated images can cause version mismatches.

### Listing Images

Before removing, list your images to see what's available:

```bash
docker images
```

This shows all images, their tags, and IDs.

### Removing a Specific Image

To remove an image by name or ID:

```bash
# Remove by name
docker rmi nginx:alpine

# Remove by image ID
docker rmi 1a2b3c4d5e6f
```

If the image is used by a container, you'll see an error. Stop and remove the container first:

```bash
docker ps -a  # Find the container using the image
docker stop <container_id>
docker rm <container_id>
docker rmi <image>
```

### Removing Dangling and Unused Images

Dangling images are layers not tagged or referenced by any container. Clean them up with:

```bash
docker image prune
```

To remove all unused images (not just dangling):

```bash
docker image prune -a
```

Note: This command will remove all images not currently used by any container, so use it with caution.

### Best Practices

- Regularly clean up unused images, especially on CI/CD runners.
- Use tags to keep track of image versions.
- Automate cleanup with scheduled jobs if needed.

By managing your Docker images proactively, you keep your development environment fast and reliable.

Good luck with your project!

## Related Resources

- [Delete All Local Docker Images](/posts/delete-all-local-docker-images) — bulk cleanup
- [Docker No Space Left: How to Clean Up](/posts/docker-no-space-left-cleanup) — reclaim disk space
- [Remove Old Docker Containers](/posts/remove-old-docker-containers) — container cleanup
- [Docker Image vs Container](/posts/docker-image-vs-container) — understand the difference
