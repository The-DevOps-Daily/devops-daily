---
title: 'How to List Containers in Docker'
excerpt: 'Learn how to list running and stopped Docker containers, filter by status, and get useful details for troubleshooting and management.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-01-28'
publishedAt: '2024-01-28T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '4 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Containers
  - CLI
  - DevOps
---

## TLDR

Use `docker ps` to list running containers, and `docker ps -a` to see all containers, including those that have exited. Add filters or formatting for more targeted results.

## Prerequisites

- Docker installed (any recent version)
- Terminal access

## Listing Running Containers

To see all containers currently running on your system, use:

```bash
# List running containers
docker ps
```

This shows container IDs, names, images, and status. It's helpful for quickly checking what's active.

## Listing All Containers (Including Stopped)

If you want to see containers that have exited or stopped, add the `-a` flag:

```bash
# List all containers, including stopped ones
docker ps -a
```

This is useful for troubleshooting or cleaning up old containers.

## Filtering and Formatting Output

You can filter containers by status or name, and format the output for scripts or reports.

```bash
# Show only exited containers
docker ps -a --filter status=exited

# Show containers with a specific name
docker ps -a --filter "name=webapp"

# Custom columns for easier reading
docker ps --format "table {{.ID}}\t{{.Names}}\t{{.Status}}"
```

## Next Steps

Try combining these commands with `docker stop`, `docker start`, or `docker rm` to manage your containers more efficiently.

Good luck with your project!

## Related Resources

- [Docker Run vs Docker Start](/posts/docker-run-vs-docker-start) — container lifecycle commands
- [Remove Old Docker Containers](/posts/remove-old-docker-containers) — clean up stopped containers
- [Docker Name Already in Use](/posts/docker-name-already-in-use) — resolve naming conflicts
- [Introduction to Docker Guide](/guides/introduction-to-docker) — Docker fundamentals
- [Docker Quiz](/quizzes/docker-quiz) — test your knowledge
