---
title: 'How to Get docker-compose to Always Re-create Containers from Fresh Images'
excerpt: 'Want to make sure docker-compose always uses the latest image and re-creates containers? Learn the right flags, workflow, and best practices to avoid stale containers in development and CI.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2025-05-01'
publishedAt: '2025-05-01T09:00:00Z'
updatedAt: '2025-05-01T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - docker-compose
  - Containers
  - DevOps
---

## TLDR

To make docker-compose always re-create containers from fresh images, use `docker-compose pull` to get the latest images, then run `docker-compose up --force-recreate --build`. This ensures containers are rebuilt or replaced, not reused from cache.

## Why Containers Might Not Be Re-created

By default, `docker-compose up` reuses existing containers if they already exist, even if the image has changed. This can lead to running old code or missing updates, especially in development or CI.

## The Solution: Use the Right Flags

- `--force-recreate`: Forces docker-compose to remove and re-create containers, even if nothing changed in the config.
- `--build`: Builds images before starting containers (useful if you have local Dockerfiles).
- `--pull`: Always attempt to pull newer images before building (Compose V2 only, or use `docker-compose pull` first).

**Recommended workflow:**

```bash
docker-compose pull           # Get the latest images from the registry
docker-compose up --build --force-recreate
```

Or, with Compose V2 (Docker CLI):

```bash
docker compose up --build --force-recreate --pull always
```

## Example

Suppose you updated your app image in a registry. To make sure your containers use the new image:

```bash
docker-compose pull app
# Then:
docker-compose up --build --force-recreate app
```

This will:

- Pull the latest image for `app`
- Build any local images if needed
- Remove and re-create the `app` container

## Cleaning Up Old Containers and Images

If you want to remove stopped containers and unused images:

```bash
docker-compose down --rmi all --volumes
```

- `--rmi all`: Remove all images used by services
- `--volumes`: Remove named volumes declared in the `volumes` section

## Best Practices

- Use `--force-recreate` in development to avoid stale containers
- Use `--pull` or `docker-compose pull` to always get the latest images
- For CI/CD, script these steps to ensure clean deploys
- Document your workflow for your team

## Conclusion

To always get fresh containers from the latest images, combine `docker-compose pull` with `docker-compose up --build --force-recreate`. This keeps your environment up to date and avoids surprises from cached or outdated containers.

## Related Resources

- [Docker Compose Environment Variables](/posts/docker-compose-environment-variables) — manage config across environments
- [Docker Compose: Ports vs Expose](/posts/docker-compose-ports-vs-expose) — container networking fundamentals
- [Delete All Local Docker Images](/posts/delete-all-local-docker-images) — clean up stale images
- [Introduction to Docker Guide](/guides/introduction-to-docker) — comprehensive Docker learning path
- [Docker Multi-Stage Build Exercise](/exercises/docker-multi-stage-build) — hands-on build optimization
