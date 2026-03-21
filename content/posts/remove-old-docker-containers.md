---
title: 'How to Remove Old Docker Containers'
excerpt: 'Over time, stopped Docker containers pile up and take up space. Learn how to list, filter, and clean up unused containers safely and efficiently.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-11-08'
publishedAt: '2024-11-08T09:00:00Z'
updatedAt: '2024-11-08T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Containers
  - Cleanup
  - DevOps
  - Disk Space
  - Container Management
---

As you build and run containers locally, Docker keeps old ones around, even after they've stopped. These unused containers accumulate quickly and start taking up valuable disk space.

Cleaning them up regularly is good practice, especially if you're doing a lot of testing, CI work, or running short-lived containers in development.

In this guide, you'll learn how to safely remove old Docker containers using a few simple commands.

## Prerequisites

To follow along, make sure you have:

- Docker installed (Docker Engine 24+)
- Terminal access to your machine
- Basic familiarity with container lifecycle (create, run, stop)

## Step 1: List All Containers

To get a sense of what's currently on your system, start by listing all containers:

```bash
docker ps -a
```

This shows both running and stopped containers. Look for the STATUS column, anything that says `Exited` or `Created` is no longer active.

## Step 2: Remove a Single Container by ID or Name

To remove a specific container, use:

```bash
docker rm <container_id_or_name>
```

For example:

```bash
docker rm old-nginx
```

This only works for stopped containers. If it's running, you'll need to stop it first:

```bash
docker stop old-nginx && docker rm old-nginx
```

## Step 3: Remove All Stopped Containers

To wipe out all containers that are no longer running:

```bash
docker container prune
```

You'll get a prompt asking for confirmation:

```text
WARNING! This will remove all stopped containers.
Are you sure you want to continue? [y/N]
```

Press `y` to proceed.

This is the cleanest way to get rid of containers you no longer need.

## Optional: Force Delete Without Prompt

If you're scripting or automating cleanup, you can use the `--force` flag:

```bash
docker container prune --force
```

## Bonus: See How Much Space You're Using

Docker has a handy command to show you disk usage:

```bash
docker system df
```

It shows how much space is taken up by containers, images, volumes, and build cache. Great for keeping track of bloat.

## Related: Remove Everything (Use with Caution)

If you really want to start fresh and clean up everything, not just containers, but also images, volumes, and cache, use:

```bash
docker system prune -a
```

This will:

- Remove all stopped containers
- Remove all unused images (not just dangling ones)
- Remove all unused networks
- Remove build cache

Only use this if you're sure you don't need anything.

---

Old Docker containers can clutter your system and waste disk space over time. By pruning them regularly, you keep your setup clean and reduce the risk of running into space or resource issues.

Make cleanup part of your local workflow, or script it as part of your CI/CD maintenance routine.


## Related Resources

- [Remove Old Unused Docker Images](/posts/remove-old-unused-docker-images) — image cleanup
- [Delete All Local Docker Images](/posts/delete-all-local-docker-images) — bulk cleanup
- [Docker No Space Left: How to Clean Up](/posts/docker-no-space-left-cleanup) — reclaim disk space
- [Docker List Containers](/posts/docker-list-containers) — find containers to remove
