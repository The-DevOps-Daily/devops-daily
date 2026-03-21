---
title: 'Docker Complains About "No Space Left on Device": How to Clean Up?'
excerpt: 'Running out of space while using Docker can disrupt your workflow. Learn how to identify and clean up unused Docker resources to free up space.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-11-20'
publishedAt: '2024-11-20T09:00:00Z'
updatedAt: '2026-03-21T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Troubleshooting
  - Cleanup
  - DevOps
  - Tutorials
---

## TLDR

If Docker complains about "no space left on device," it means your system is running out of disk space due to unused Docker resources. Use commands like `docker system prune` to clean up unused containers, images, and volumes. Be cautious when running cleanup commands to avoid deleting resources you still need.

---

Running out of disk space is a common issue when working with Docker, especially if you frequently build images or run containers. Docker stores images, containers, volumes, and networks on your system, which can accumulate over time. This guide will show you how to identify and clean up unused Docker resources to free up space.

## Why Does This Happen?

Docker uses your system's disk to store:

- **Images**: Base images and intermediate layers from builds.
- **Containers**: Running and stopped containers.
- **Volumes**: Persistent data used by containers.
- **Networks**: Custom networks created for container communication.

Over time, these resources can consume significant disk space, leading to the "no space left on device" error.

## Step 1: Check Disk Usage

Before cleaning up, it's helpful to understand how much space Docker is using. You can use the `docker system df` command to get an overview:

```bash
docker system df
```

This command provides a summary of disk usage by images, containers, and volumes. For example:

```plaintext
TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
Images          10        2         5GB       3GB
Containers      5         1         2GB       1.5GB
Local Volumes   8         3         4GB       2GB
Build Cache     -         -         1GB       1GB
```

From this output, you can see which resources are consuming the most space.

## Step 2: Remove Unused Containers

Stopped containers can take up space. To list all stopped containers, run:

```bash
docker ps -a
```

To remove all stopped containers:

```bash
docker container prune
```

This command will prompt you for confirmation before deleting stopped containers.

## Step 3: Remove Unused Images

Docker images, especially dangling images (unused intermediate layers), can consume a lot of space. To list all images:

```bash
docker images
```

To remove dangling images:

```bash
docker image prune
```

To remove all unused images (not just dangling ones):

```bash
docker image prune -a
```

Be cautious with the `-a` flag, as it will delete all images not associated with a running container.

## Step 4: Remove Unused Volumes

Volumes store persistent data and can accumulate over time. To list all volumes:

```bash
docker volume ls
```

To remove unused volumes:

```bash
docker volume prune
```

This will delete volumes not associated with any container.

## Step 5: Remove Unused Networks

Custom networks created for containers can also take up space. To list all networks:

```bash
docker network ls
```

To remove unused networks:

```bash
docker network prune
```

## Step 6: Perform a Full Cleanup

If you want to clean up all unused Docker resources in one go, use:

```bash
docker system prune
```

To include unused volumes in the cleanup:

```bash
docker system prune --volumes
```

This command will prompt you for confirmation before deleting resources.

## Step 7: Monitor Disk Usage Regularly

To avoid running into this issue again, monitor your disk usage regularly. You can also automate cleanup tasks using cron jobs or CI/CD pipelines.

## Additional Tips

- **Backup Important Data**: Before running cleanup commands, make sure to back up any important data stored in volumes.
- **Use Disk Quotas**: If you're running Docker in a shared environment, consider setting disk quotas to prevent overuse.
- **Optimize Dockerfiles**: Reduce image size by optimizing your Dockerfiles (e.g., using multi-stage builds).

By following these steps, you can effectively manage Docker's disk usage and prevent the "no space left on device" error from disrupting your workflow.

## Related Resources

- [Delete All Local Docker Images](/posts/delete-all-local-docker-images) — bulk image cleanup
- [Remove Old Docker Containers](/posts/remove-old-docker-containers) — container cleanup
- [Where Docker Images Are Stored](/posts/docker-image-storage-locations) — understand storage locations
- [Docker Image Optimization](/posts/docker-image-optimization-best-practices) — build smaller images
