---
title: 'How to Add a Volume to an Existing Docker Container'
excerpt: 'You cannot change mounts on a running container, but you can safely recreate it with the desired volume. This guide shows exact commands for Docker CLI and Docker Compose, plus ways to migrate or seed data.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2025-01-29'
publishedAt: '2025-01-29T09:00:00Z'
updatedAt: '2025-01-29T09:00:00Z'
readingTime: '9 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Volumes
  - Bind Mounts
  - Operations
  - Docker Compose
---

You started a container and later realized you need to mount a volume - for persistent data, configuration, or logs. Docker does not allow modifying mounts on an existing container. The right approach is to recreate the container with the new volume and keep everything else the same.

## TLDR

- You cannot add a volume to a running container in place.
- Recreate the container with the same image and args, plus the new `-v` or `--mount` option.
- In Docker Compose, add the `volumes:` entry and run a forced recreate.
- If you need existing data inside the new volume, copy it before or after recreation.

Simple flow:

```
inspect old -> capture args -> stop old -> start new with volume -> verify -> remove old
```

Mental model:

```
Before:                           After:
--------                          ------------------------------
container A (no mounts)           container B (same app) + /data
                                  ^ bind/named volume attached
```

## Docker CLI: recreate with a new volume

First, capture the current container settings you will need, then recreate with `-v` or `--mount`. The example below adds a named volume for application data.

```bash
# Example app container without a volume yet
docker run -d --name task-svc \
  -p 8080:8080 \
  ghcr.io/examplecorp/task-service:2.1.0

# Check what is running
docker ps --filter name=task-svc | cat

# Plan: recreate with a named volume at /var/task/data
docker stop task-svc
docker rm task-svc

docker run -d --name task-svc \
  -p 8080:8080 \
  -v task_data:/var/task/data \
  ghcr.io/examplecorp/task-service:2.1.0

# Verify the mount is present
docker inspect -f '{{json .Mounts}}' task-svc | jq .
```

Why this works:

- Mounts are set at container creation time. Recreating applies the new volume cleanly.
- Using a named volume (`task_data`) gives you persistent storage independent of the container lifecycle.

### Using `--mount` long syntax

The long syntax is explicit and supports more options.

```bash
docker run -d --name task-svc \
  -p 8080:8080 \
  --mount type=volume,src=task_data,dst=/var/task/data \
  ghcr.io/examplecorp/task-service:2.1.0
```

### Adding a bind mount instead

If you need to mount a host directory for development, bind mount it.

```bash
mkdir -p ./local-data
docker run -d --name task-svc \
  -p 8080:8080 \
  -v $(pwd)/local-data:/var/task/data \
  ghcr.io/examplecorp/task-service:2.1.0
```

On SELinux-enabled Linux hosts, you may need labels:

```bash
docker run -d --name task-svc \
  -p 8080:8080 \
  -v $(pwd)/local-data:/var/task/data:Z \
  ghcr.io/examplecorp/task-service:2.1.0
```

## Migrating or seeding data

If your old container wrote data inside the image filesystem (e.g., `/var/task/data`), you may want to copy that data into the new volume.

Option A: copy out to host, then into the new volume via a helper container.

```bash
# Copy from the old container path to your host
docker cp task-svc:/var/task/data ./seed-data

# Start a helper to copy host files into the named volume
docker run --rm -v task_data:/dst -v $(pwd)/seed-data:/src alpine \
  sh -lc 'mkdir -p /dst && cp -a /src/. /dst/'
```

Option B: copy directly between containers using a temporary helper.

```bash
# Run the old container again without exposing ports, just to read files
docker run --name task-old --rm -d ghcr.io/examplecorp/task-service:2.1.0

# Use volumes and a helper to copy from the old container's FS to the named volume
docker run --rm \
  --volumes-from task-old:ro \
  -v task_data:/dst \
  alpine sh -lc 'cp -a /var/task/data/. /dst/'

docker stop task-old
```

After seeding, start the new container with the volume attached as shown earlier.

## Docker Compose: add `volumes:` and recreate the service

If you manage the container with Compose, add the volume in `docker-compose.yml` (or `compose.yaml`) and recreate the service.

```yaml
version: '3.9'
services:
  task-svc:
    image: ghcr.io/examplecorp/task-service:2.1.0
    ports:
      - '8080:8080'
    volumes:
      - task_data:/var/task/data
volumes:
  task_data:
```

Apply the change:

```bash
docker compose up -d --no-deps --force-recreate task-svc
```

Why recreate: Compose only applies volume changes on recreation. The command above replaces the container while keeping the network and other services intact.

### Seeding data with Compose

You can seed the named volume the same way using a one-off helper container.

```bash
docker compose run --rm \
  -v task_data:/dst \
  -v $(pwd)/seed-data:/src \
  alpine sh -lc 'cp -a /src/. /dst/'
```

## Verification and rollback

After recreation, validate that the mount is attached and data is present.

```bash
docker inspect -f '{{range .Mounts}}{{.Destination}} -> {{.Name}}{{"\n"}}{{end}}' task-svc | cat
docker exec task-svc sh -lc 'df -h; ls -al /var/task/data | head'
```

If something is wrong, stop and remove the new container and start the previous one again (if you kept it).

```bash
docker stop task-svc && docker rm task-svc
# If you kept a previous container name, start it again; otherwise recreate with prior args
```

## Notes and pitfalls

- Container immutability: mounts are defined at create time; you must recreate to change them.
- Data location: if your app wrote data inside the container FS, copy it into a volume so it persists on future recreations.
- Permissions: match container user IDs when copying (`chown -R 1000:1000 /dst`) if the app runs as non-root.
- Docker Desktop paths: bind mounts must reference shared host folders; adjust file sharing preferences if the mount fails.
- SELinux: use `:Z` or `:z` for bind mounts on Fedora/RHEL/CentOS.

Recreating a container is the safe, repeatable way to add volumes. Once the pattern is in place, future changes are just edits to your command or Compose file followed by a quick recreate.


## Related Resources

- [Docker Data Loss When Container Exits](/posts/docker-data-loss-when-container-exits) — why volumes matter
- [Docker Persistent Storage for Databases](/posts/docker-persistent-storage-databases) — database patterns
- [Mount a Host Directory in Docker](/posts/docker-mount-host-directory) — bind mounts
- [How to List Docker Volumes](/posts/how-to-list-docker-volumes-in-containers) — manage volumes
- [Introduction to Docker: Volumes](/guides/introduction-to-docker) — volume fundamentals
