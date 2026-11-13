---
title: 'How to Keep Docker Data When a Container Exits: Volumes and Bind Mounts'
excerpt: 'Data in a container goes away with the container. Learn when that happens, how named volumes and bind mounts keep data, how to add a volume to an existing container, where database images keep their files, and how to back up and remove volumes safely.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-10-15'
publishedAt: '2024-10-15T09:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '14 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Volumes
  - Bind Mounts
  - Storage
  - PostgreSQL
  - DevOps
---

The first time you remove a database container and run a new one, you find an empty database. Nothing went wrong: everything the container wrote went into its own writable layer, and `docker rm` deleted that layer. Data that must stay needs a volume or a bind mount.

This post explains when data disappears, how to choose between a named volume and a bind mount, how to mount a host directory, how to add a volume to a container that already exists, where the common database images keep their data, and how to back up and remove volumes without losing anything by accident.

## TLDR

- Stopping a container keeps its data. Removing it (`docker rm`, `docker compose down`, a redeploy) deletes the writable layer.
- Put data in a **named volume**: `docker run -v pgdata:/var/lib/postgresql postgres:18`. The volume stays when the container goes.
- Use a **bind mount** to share a host directory: `docker run -v "$(pwd)/data":/app/data myapp`. Good for source code and config files in development.
- You cannot add a mount to an existing container. Create a new container with the mount, and copy the old data first.
- `docker volume prune` removes only anonymous volumes. Named volumes go only with `docker volume rm`, `docker volume prune --all` or `docker compose down -v`.

## Prerequisites

- Docker Engine 23 or later, or Docker Desktop.
- For the database examples, the `postgres:18` image. Older tags use another data path, as shown below.

## Why Does Data Disappear When a Container Is Removed?

Each container gets a thin writable layer on top of the read-only image layers. Every file the app writes outside a mount lands in that layer:

```text
┌──────────────────────────────┐
│  Writable container layer    │  <- your data, deleted by docker rm
├──────────────────────────────┤
│  Read-only image layers      │  <- shared by every container of the image
└──────────────────────────────┘
```

The writable layer lives as long as the container, not as long as the process:

| Action                                                        | Data in the writable layer |
| ------------------------------------------------------------- | -------------------------- |
| `docker stop` and `docker start`                              | Kept                       |
| `docker restart`, a host reboot                               | Kept                       |
| `docker rm`, `docker compose down`                            | Deleted                    |
| Recreate: `docker compose up` after a change, a new image tag | Deleted                    |

Many database images declare a `VOLUME` in their Dockerfile. If you do not mount anything there, Docker creates an **anonymous volume** with a random name. The data then survives `docker rm`, but the new container gets a new, empty anonymous volume, so it looks lost. Find the old one with `docker volume ls` (the long hex names) and mount it by name, or better, use a named volume from the start. `docker rm -v` removes a container together with its anonymous volumes.

## Volumes, Bind Mounts and tmpfs: Which Should I Use?

| Type         | Example                         | Where the data is                  | Use it for                                         |
| ------------ | ------------------------------- | ---------------------------------- | -------------------------------------------------- |
| Named volume | `-v pgdata:/var/lib/postgresql` | Managed by Docker                  | Databases, uploads, anything that must stay        |
| Bind mount   | `-v "$(pwd)/src":/app/src`      | A directory you choose on the host | Source code and config in development              |
| tmpfs        | `--tmpfs /tmp`                  | Memory only                        | Scratch files and secrets that must not touch disk |

Named volumes work the same on Linux, macOS and Windows, and on Docker Desktop they are faster than bind mounts because they stay inside Docker's VM. Bind mounts give you the files directly on the host, with the host's permissions. [Introduction to Docker: Volumes](/guides/introduction-to-docker/06-working-with-docker-volumes) covers all three in depth.

## How Do I Persist Data With a Named Volume?

Mount a named volume at the directory where the app writes. Docker creates the volume if it does not exist:

```bash
docker run -d --name db \
  -e POSTGRES_PASSWORD=change-me \
  -v pgdata:/var/lib/postgresql \
  postgres:18

docker exec db psql -U postgres -c "CREATE DATABASE shop;"

# Remove the container and start a new one on the same volume
docker rm -f db
docker run -d --name db -e POSTGRES_PASSWORD=change-me -v pgdata:/var/lib/postgresql postgres:18
docker exec db psql -U postgres -c "\l"     # shop is still there
```

The `postgres` image refuses to start without `POSTGRES_PASSWORD` (or another auth setting) on an empty data directory, so always set it. The `POSTGRES_*` variables only apply on the first start, when the image creates the database cluster in an empty volume.

In Compose, declare the volume at the top level and mount it in the service:

```yaml
services:
  db:
    image: postgres:18
    environment:
      POSTGRES_PASSWORD: change-me
    volumes:
      - pgdata:/var/lib/postgresql

volumes:
  pgdata:
```

Compose prefixes the name with the project name, for example `shop_pgdata`. `docker compose down` keeps it, and `docker compose down -v` deletes it. To see which containers use which volumes, see [how to list volumes in Docker containers](/posts/how-to-list-docker-volumes-in-containers).

## How Do I Mount a Host Directory in a Container?

Pass the host path and the container path to `-v`, or use the longer `--mount`:

```bash
# Read and write
docker run --rm -v "$(pwd)/data":/app/data alpine:3.24 ls /app/data

# Read-only, for config files
docker run --rm -v "$(pwd)/config":/etc/myapp:ro alpine:3.24 ls /etc/myapp

# The same with --mount
docker run --rm --mount type=bind,src="$(pwd)/config",dst=/etc/myapp,readonly alpine:3.24 ls /etc/myapp
```

Details that cause most bind-mount problems:

- **Use an absolute host path.** `-v data:/app/data` without `/` or `./` makes a named volume called `data`, not a bind mount. `$(pwd)` gives an absolute path.
- **A missing host directory.** `-v` creates it, owned by root. `--mount` fails with an error instead, which is usually what you want.
- **The mount hides what is in the image.** A bind mount on `/app` replaces the image's `/app` with the host directory. A named volume that is empty copies the image's files in first, a bind mount never does.
- **Permissions.** The container sees the host's UIDs. If the app runs as UID 1000 and the directory belongs to another user, writes fail. Fix the owner on the host (`sudo chown -R 1000:1000 ./data`) or run the container with `-u "$(id -u):$(id -g)"`.
- **SELinux** (Fedora, RHEL): add `:z` (shared) or `:Z` (private to this container) so the container may read the files: `-v "$(pwd)/data":/app/data:Z`.
- **Docker Desktop.** Only shared folders can be mounted. The home directory is shared by default, other paths need **Settings > Resources > File sharing**.

## How Do I Add a Volume to an Existing Docker Container?

You cannot add, remove or change a mount on a container that exists. Mounts, like ports, are fixed when the container is created. Create a new container with the same settings plus the mount. If the old container wrote data that you want to keep, copy it before you remove the old one:

```bash
# 1. Keep the old container, but free the name
docker stop app
docker rename app app-old

# 2. Copy the old data into a new named volume (works on a stopped container)
docker volume create app-data
docker cp app-old:/var/lib/app/. - | docker run --rm -i -v app-data:/dst alpine:3.24 tar -xf - -C /dst

# 3. Start the new container with the same options as before, plus the volume
docker run -d --name app -p 8080:8080 -v app-data:/var/lib/app myorg/app:2.1.0

# 4. Check, then remove the old container
docker inspect -f '{{range .Mounts}}{{.Name}} -> {{.Destination}}{{"\n"}}{{end}}' app
docker rm app-old
```

`docker cp CONTAINER:PATH -` writes a `tar` archive to stdout, and the helper container unpacks it into the volume. If the app runs as a non-root user, fix the owner in the volume afterwards, for example `docker run --rm -v app-data:/dst alpine:3.24 chown -R 1000:1000 /dst`.

To recall the old options, read them from the old container: `docker inspect app-old` shows the image, ports (`HostConfig.PortBindings`), environment (`Config.Env`) and mounts.

With Compose, add the mount to the service and run `docker compose up -d`. Compose sees the changed config and recreates the container. Copy any data out first, because the recreate deletes the old writable layer.

## How Do I Store a Database's Data in Docker?

Give each database its own named volume, mounted at the image's data directory:

| Image                   | Mount the volume at        | Notes                                                            |
| ----------------------- | -------------------------- | ---------------------------------------------------------------- |
| `postgres:18`           | `/var/lib/postgresql`      | The image keeps the cluster in a versioned subdirectory          |
| `postgres:17` and older | `/var/lib/postgresql/data` | The path from most older tutorials                               |
| `mysql:8.4`, `mariadb`  | `/var/lib/mysql`           |                                                                  |
| `mongo`                 | `/data/db`                 |                                                                  |
| `redis`                 | `/data`                    | Only useful with persistence on: `redis-server --appendonly yes` |

The `postgres:18` change trips up many people. The 18 image keeps its data in `/var/lib/postgresql/18/docker` and declares the volume one level above the version directory. If you mount a volume at the old `/var/lib/postgresql/data` path, the container refuses to start with an error that begins `Error: in 18+, these Docker images are configured to store database data in a format which is compatible with "pg_ctlcluster"`. A volume from Postgres 17 or older also cannot be reused as it is: dump and restore, or run `pg_upgrade`. Run `docker image inspect -f '{{json .Config.Volumes}}' postgres:18` to see the path any image expects.

Rules that keep database data safe:

- **One data directory, one container.** Two database containers on the same volume corrupt it.
- **Stop it cleanly.** `docker stop` sends SIGTERM and waits 10 seconds before SIGKILL. A large database may need longer: `docker stop -t 60 db`, or `stop_grace_period: 1m` in Compose.
- **Bind mounts need the right owner.** The Debian-based `postgres` and `mysql` images run as UID 999, and `postgres:*-alpine` as UID 70. A host directory must belong to that UID.
- **Do not publish the port to the world.** Use `-p 127.0.0.1:5432:5432` for local tools, see [connect to Postgres from outside](/posts/forward-host-port-to-docker-container#h2-how-do-i-connect-to-postgresql-in-a-docker-container-from-the-host).
- **Back up with the database's own tool.** A dump is consistent while the database runs, a copy of its files is not.

## How Do I Back Up and Restore a Docker Volume?

For a database, use a logical dump:

```bash
docker exec db pg_dump -U postgres shop > shop.sql
docker exec -i db psql -U postgres -d shop < shop.sql
```

For any other volume, archive its files with a helper container. Stop the containers that write to the volume first, so the files do not change during the copy:

```bash
# Back up the volume "uploads" to ./uploads.tar.gz
docker run --rm -v uploads:/data:ro -v "$(pwd)":/backup alpine:3.24 \
  tar -czf /backup/uploads.tar.gz -C /data .

# Restore it into a new volume
docker volume create uploads-restored
docker run --rm -v uploads-restored:/data -v "$(pwd)":/backup alpine:3.24 \
  tar -xzf /backup/uploads.tar.gz -C /data
```

To copy one volume into another, mount both: `docker run --rm -v old:/from:ro -v new:/to alpine:3.24 cp -a /from/. /to/`.

## How Do I Remove Volumes Without Losing Data by Accident?

Volumes are never removed with their containers unless you ask for it. The commands that do remove them:

| Command                     | What it removes                                                    |
| --------------------------- | ------------------------------------------------------------------ |
| `docker volume rm pgdata`   | That volume. It fails if a container (even a stopped one) uses it  |
| `docker volume prune`       | Unused **anonymous** volumes only (since Docker Engine 23)         |
| `docker volume prune --all` | Every unused volume, named ones included                           |
| `docker rm -v app`          | The container and its anonymous volumes                            |
| `docker compose down -v`    | The named volumes declared in the Compose file, and anonymous ones |

Run `docker volume ls` before any of them, and `docker ps -a --filter volume=pgdata` to see who uses a volume. A removed volume cannot be recovered.

## Best Practices

- Decide where each service writes, and mount a named volume there before the first start.
- Pin the image tag of a stateful service. A major upgrade (Postgres 17 to 18) needs a dump and restore or `pg_upgrade`, not only a new tag.
- Use bind mounts for code and config in development, named volumes for data everywhere.
- Back up on a schedule, and test the restore.

## Related Resources

- [How to list volumes in Docker containers](/posts/how-to-list-docker-volumes-in-containers): see which container uses which volume
- [What docker compose down removes](/posts/rebuild-docker-container-compose#h2-what-down-removes-and-what-it-keeps)
- [Introduction to Docker: Working with Volumes](/guides/introduction-to-docker/06-working-with-docker-volumes)
- [Running Docker containers on your Linux server](/exercises/docker-server-deployment): an exercise with a database on a volume
- [Docker terminal simulator](/games/docker-terminal-simulator): try volumes in the browser
- [Docker quiz](/quizzes/docker-quiz): check what you know about volumes and mounts
