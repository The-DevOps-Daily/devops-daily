---
title: 'How to Start a Stopped Docker Container with a Different Command'
excerpt: 'Need to run a different command in a stopped Docker container? Learn your options for changing the startup command, including docker commit, docker run --entrypoint, and best practices for debugging or recovery.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2025-05-02'
publishedAt: '2025-05-02T09:00:00Z'
updatedAt: '2026-03-21T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Containers
  - Entrypoint
  - DevOps
---

## TLDR

You can't directly change the command of a stopped Docker container when restarting it with `docker start`. Instead, create a new container from the same image with a different command or entrypoint. Use `docker run --entrypoint` or `docker commit` for advanced cases.

## Why Can't You Change the Command with docker start?

When you create a container with `docker run`, the command and entrypoint are set at creation. `docker start` always uses the original command—you can't override it for an existing container.

## Option 1: Create a New Container with a Different Command

The most reliable way is to start a new container from the same image, specifying the new command:

```bash
docker run -it my-image /bin/bash
```

Or, to override the entrypoint:

```bash
docker run -it --entrypoint /bin/sh my-image
```

This gives you a fresh container with your chosen command.

## Option 2: Use docker commit to Save Changes (Advanced)

If you need to preserve changes made in the stopped container (like files or installed packages), you can commit it to a new image:

```bash
docker commit my-container my-temp-image
```

Then run a new container from that image with a different command:

```bash
docker run -it my-temp-image /bin/bash
```

## Option 3: Use docker exec for Running Containers

If the container is running, you can start a new process inside it:

```bash
docker exec -it my-container /bin/bash
```

But this doesn't work if the container is stopped.

## Best Practices

- Use `docker run` with a new command for most cases.
- Use `docker commit` only if you need to preserve changes from the stopped container.
- For debugging, override the entrypoint or command as needed.
- Clean up old containers and images to avoid clutter.

## Conclusion

You can't change the command of a stopped Docker container when restarting it, but you can create a new container from the same image (or a committed image) with any command you need. This gives you flexibility for debugging, recovery, or running alternate workflows.


## Related Resources

- [Docker Run vs Docker Start](/posts/docker-run-vs-docker-start) — understand the difference
- [How to Run a Command on an Existing Container](/posts/how-do-i-run-a-command-on-an-already-existing-docker-container) — exec into containers
- [Why Docker Container Exits Immediately](/posts/why-docker-container-exits-immediately) — debug exit issues
- [Introduction to Docker Guide](/guides/introduction-to-docker) — Docker fundamentals
