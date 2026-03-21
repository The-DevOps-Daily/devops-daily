---
title: 'Difference Between Running and Starting a Docker Container'
excerpt: "Confused about 'docker run' vs 'docker start'? Learn the difference between running and starting a Docker container, with practical examples and best practices for your workflow."
category:
  name: 'Docker'
  slug: 'docker'
date: '2025-04-30'
publishedAt: '2025-04-30T09:00:00Z'
updatedAt: '2026-03-21T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Containers
  - DevOps
---

## TLDR

`docker run` creates and starts a new container from an image, while `docker start` restarts an existing, stopped container. Use `run` for new containers, and `start` to bring back a container you previously stopped.

## What Does `docker run` Do?

`docker run` is the main command to create and launch a new container. It does several things at once:

- Creates a new container from the specified image
- Assigns it a unique ID and (optionally) a name
- Sets up networking, storage, and environment variables
- Starts the container's main process

**Example:**

```bash
docker run -d --name my-nginx -p 8080:80 nginx
```

This creates a new container named `my-nginx` from the `nginx` image and starts it in the background.

## What Does `docker start` Do?

`docker start` is used to restart a container that was previously created (and stopped). It does not create a new container or change its configuration.

**Example:**

```bash
docker stop my-nginx  # Stop the container
# ... do something ...
docker start my-nginx # Start it again
```

- The container keeps its data, configuration, and name.
- Any changes made to the container's filesystem persist.

## Key Differences

- `docker run` creates a new container every time you use it.
- `docker start` only works on containers that already exist (but are stopped).
- You can only use `docker run` with an image; `docker start` uses a container name or ID.
- `docker run` lets you set options (ports, env vars, volumes) at creation; `docker start` does not.

## When to Use Each Command

- Use `docker run` when you want a fresh container, possibly with new options.
- Use `docker start` to restart a stopped container with the same settings and data.
- For stateless or short-lived containers, `docker run` is common.
- For persistent services or debugging, `docker start` is handy.

## Best Practices

- Name your containers with `--name` for easier management.
- Use `docker ps -a` to see all containers (running and stopped).
- Remove containers you no longer need with `docker rm` to avoid clutter.

## Conclusion

`docker run` and `docker start` serve different purposes: one creates and starts new containers, the other restarts existing ones. Use the right command for your workflow to keep your Docker environment organized and efficient.

## Related Resources

- [How to Run a Docker Image as a Container](/posts/docker-run-image-as-container) — running containers in depth
- [Docker Image vs Container](/posts/docker-image-vs-container) — understand the fundamentals
- [Docker List Containers](/posts/docker-list-containers) — find your containers
- [Why Docker Container Exits Immediately](/posts/why-docker-container-exits-immediately) — troubleshoot exits
- [Introduction to Docker Guide](/guides/introduction-to-docker) — comprehensive learning
- [Docker Flashcards](/flashcards/docker-essentials) — review concepts
