---
title: 'How to Enter a Docker Container Already Running with a New TTY'
excerpt: 'Learn how to attach to a running Docker container with a new TTY session for debugging or interaction.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-11-30'
publishedAt: '2024-11-30T09:00:00Z'
updatedAt: '2026-03-21T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Containers
  - TTY
  - DevOps
  - Tutorials
---

## TLDR

To enter a running Docker container with a new TTY session, use the `docker exec` command with the `-it` flags. This allows you to interact with the container's shell for debugging or administrative tasks.

---

When working with Docker, you may need to interact with a running container to debug issues, inspect files, or perform administrative tasks. This guide will show you how to attach to a running container with a new TTY session.

## Prerequisites

Before proceeding, make sure you have:

- Docker installed on your system.
- A running Docker container you want to access.
- Appropriate permissions to interact with Docker.

## Step 1: List Running Containers

To identify the container you want to access, list all running containers using the following command:

```bash
docker ps
```

This will display a list of running containers, including their IDs, names, and other details. For example:

```plaintext
CONTAINER ID   IMAGE          COMMAND                  CREATED        STATUS       PORTS                    NAMES
abc123         nginx:latest   "nginx -g 'daemon of…"   2 hours ago   Up 2 hours   0.0.0.0:8080->80/tcp     my-nginx
```

Note the `CONTAINER ID` or `NAMES` of the container you want to access.

## Step 2: Attach to the Container with a New TTY

To open a new TTY session in the running container, use the `docker exec` command with the `-it` flags:

```bash
docker exec -it <container-name-or-id> /bin/bash
```

Replace `<container-name-or-id>` with the `CONTAINER ID` or `NAMES` from the previous step. For example:

```bash
docker exec -it my-nginx /bin/bash
```

This command starts a new interactive shell session (`/bin/bash`) inside the container.

### Example Output

```plaintext
root@abc123:/#
```

You are now inside the container and can run commands as if you were logged into a separate machine.

## Step 3: Use an Alternative Shell (if Necessary)

Not all containers include `/bin/bash`. If the container uses a minimal base image, you may need to use `/bin/sh` instead:

```bash
docker exec -it <container-name-or-id> /bin/sh
```

For example:

```bash
docker exec -it my-nginx /bin/sh
```

## Step 4: Exit the Container

To exit the container's shell session, type:

```bash
exit
```

This will close the TTY session and return you to your host machine's terminal.

## Additional Tips

- **Inspect Container Logs**: Use `docker logs <container-name-or-id>` to view logs if you don't need an interactive session.
- **Attach vs. Exec**: The `docker attach` command connects to the container's main process, while `docker exec` starts a new process inside the container.
- **Use Docker Compose**: If you're using Docker Compose, you can access a container with:

  ```bash
  docker-compose exec <service-name> /bin/bash
  ```

By following these steps, you can easily interact with running Docker containers for debugging or administrative purposes.

## Related Resources

- [How to Access Docker Container Shell](/posts/how-to-access-docker-container-shell) — more shell access methods
- [Docker TTY Error Fix](/posts/docker-tty-error-fix) — troubleshoot TTY issues
- [How to Attach and Detach Docker Process](/posts/how-to-attach-detach-docker-process) — manage attached sessions
- [Exploring Docker Container File System](/posts/exploring-docker-container-file-system) — browse container files
- [Introduction to Docker Guide](/guides/introduction-to-docker) — Docker fundamentals
