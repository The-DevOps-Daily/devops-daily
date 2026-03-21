---
title: 'How to Clear Docker Container Logs Properly'
excerpt: 'Learn safe ways to clear or reset Docker container logs, where the logs live, and how to set up log rotation so logs do not grow unbounded.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-12-03'
publishedAt: '2024-12-03T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Logs
  - Operations
  - Linux
  - Troubleshooting
---

Containers can generate a lot of logs. If you are using the default `json-file` logging driver, those logs sit on disk and grow over time. This guide shows practical ways to clear logs for a single container right now, and how to prevent oversized logs in the future with rotation.

## TLDR

- Find the log file path with `docker inspect -f '{{.LogPath}}' <container>`.
- On Linux, truncate the file in place: `sudo truncate -s 0 "$(docker inspect -f '{{.LogPath}}' <container>)"`.
- On macOS/Windows with Docker Desktop, the path is inside the Linux VM. The simplest dev workflow is to recreate the container or use rotation to keep logs small.
- Set rotation so you rarely need to clear logs: `max-size` and `max-file` in Docker daemon or Compose.

Flow you will follow:

```
identify container -> get its LogPath -> truncate once -> add rotation -> verify
```

## Where Docker stores logs by default

With the `json-file` driver, each container logs to a file under the Docker data directory.

```bash
# Show the filesystem path to the current log file
docker inspect -f '{{.LogPath}}' my-app
```

Typical Linux path looks like:

```
/var/lib/docker/containers/<container-id>/<container-id>-json.log
```

On Docker Desktop (macOS/Windows), the log lives inside the Linux VM. Your host shell can read the path value, but file operations happen in the VM, not the host filesystem.

## One-time clear on Linux: truncate the log file

If you just need to reset logs for a running container on a Linux host, truncate the file in place. This does not restart the container and is safe for the `json-file` driver.

```bash
# Replace my-app with your container name or ID
LOGFILE=$(docker inspect -f '{{.LogPath}}' my-app)
sudo truncate -s 0 "$LOGFILE"

# Verify that logs are empty from the container perspective
docker logs my-app --tail 10
```

Why this works:

- Truncating keeps the same file inode open, so Docker keeps writing without errors.
- You are not deleting the file or changing permissions.

Avoid deleting the file outright. If you remove the log file while Docker has it open, you can get confusing results or need to restart the container.

## One-time clear on Docker Desktop (macOS/Windows)

Since the log file is inside the VM, the easiest approach during development is to recreate the container. This resets logs to empty for that container.

```bash
# If you use Compose
docker compose rm -f -s my-app && docker compose up -d my-app

# If you used docker run
docker rm -f my-app
docker run ... # start it again with the same options
```

If you need to truncate without recreating, do it inside the VM. A simple approach is to use a helper container that enters the VM namespaces.

```bash
# Get the log path (this runs on your host shell)
LOG=$(docker inspect -f '{{.LogPath}}' my-app)

# Enter the Linux VM and truncate that path in place
docker run --rm -it --privileged --pid=host justincormack/nsenter1 sh -lc "truncate -s 0 '$LOG'"
```

Note: this only works on Docker Desktop since it provides the Linux VM. For production Linux hosts, use the Linux method above.

## Configure log rotation so logs stay small

Rather than clearing logs manually, configure rotation so Docker keeps a limited number of small files.

### System-wide rotation with daemon.json

Edit `/etc/docker/daemon.json` on Linux and restart Docker. This applies to new containers.

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

Then restart Docker:

```bash
sudo systemctl restart docker
```

If you cannot restart Docker on a shared host, apply rotation at the container level instead.

### Per-container rotation with Docker CLI

Set limits when you create the container. This keeps logs rotating for that container only.

```bash
docker run -d --name my-app \
  --log-driver json-file \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  ghcr.io/examplecorp/my-app:1.2.0
```

### Per-service rotation with Docker Compose

Compose supports the same options via the `logging` section.

```yaml
version: '3.9'
services:
  my-app:
    image: ghcr.io/examplecorp/my-app:1.2.0
    logging:
      driver: json-file
      options:
        max-size: '10m'
        max-file: '3'
```

### Consider the `local` logging driver

The `local` driver stores logs in an efficient format and includes internal rotation by default. It is a good default for single-node hosts.

```bash
docker run -d --name my-app \
  --log-driver local \
  ghcr.io/examplecorp/my-app:1.2.0
```

## Verifying after cleanup or rotation

Run these to confirm behavior.

```bash
# Show current log file and size
docker inspect -f '{{.LogPath}}' my-app
sudo du -h "$(docker inspect -f '{{.LogPath}}' my-app)"

# Generate a few lines and check rotation limits
docker exec my-app sh -lc 'for i in $(seq 1 1000); do echo line-$i; done'
docker logs my-app --tail 20
```

## Troubleshooting

- Logs still huge after rotation: the limits only apply to new writes. Truncate once, then rely on rotation.
- Cannot find LogPath: the container may be using a non-file driver like `journald` or `gelf`. Use the destination system to manage logs instead of truncating locally.
- Permission denied when truncating: prepend `sudo` and make sure your user is in the `docker` group on Linux.
- Docker restart causes app restart: plan a short maintenance window if you edit `daemon.json` on busy hosts.

With these patterns you can reset container logs when needed and keep them under control with rotation so they do not grow without bound. For local development, recreation is often easiest. For servers, use rotation with limits that match your disk budget.


## Related Resources

- [Docker No Space Left: How to Clean Up](/posts/docker-no-space-left-cleanup) — reclaim disk space
- [Remove Old Docker Containers](/posts/remove-old-docker-containers) — container cleanup
- [Docker List Containers](/posts/docker-list-containers) — find containers
- [Introduction to Docker Guide](/guides/introduction-to-docker) — Docker fundamentals
