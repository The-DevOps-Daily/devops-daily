---
title: 'Docker Volumes and Bind Mounts: Persist Container Data'
description: 'Keep data when containers are removed: Docker named volumes, bind mounts and tmpfs, a Postgres 18 database on a volume, backups, permissions and cleanup.'
order: 6
---

A container's writable layer is deleted together with the container. That is fine for a web server that only serves files from its image, and fatal for a database. Docker solves this with **mounts**: storage that lives outside the container and is attached to it at a path. In this part you give hello-api's Postgres database a volume, prove that the data survives the container, back it up, and use bind mounts and tmpfs for the cases where they fit better.

## Prerequisites

- Docker installed ([Part 2](/guides/introduction-to-docker/02-docker-installation)) and the `docker run` basics from [Part 4](/guides/introduction-to-docker/04-creating-your-first-container).
- The hello-api project from [Part 5](/guides/introduction-to-docker/05-building-custom-docker-images), which needs this database.

## Three Kinds of Mounts

```diagram
{
  "type": "infra",
  "groups": [
    {
      "label": "Docker host",
      "sub": "Linux, or the VM inside Docker Desktop",
      "icon": "server",
      "tone": "slate",
      "groups": [
        {
          "label": "Storage outside the container",
          "sub": "survives docker rm",
          "icon": "database",
          "tone": "slate",
          "nodes": [
            { "label": "Volume", "sub": "/var/lib/docker/volumes/<name>, managed by Docker", "icon": "database", "tone": "violet" },
            { "label": "Bind mount", "sub": "any host path, e.g. ./site", "icon": "box", "tone": "amber" },
            { "label": "tmpfs", "sub": "host memory, gone when the container stops", "icon": "cpu", "tone": "blue" }
          ]
        },
        {
          "label": "Container",
          "sub": "writable layer: deleted with the container",
          "icon": "box",
          "tone": "accent",
          "nodes": [
            { "label": "/var/lib/postgresql", "sub": "volume", "icon": "database", "tone": "violet" },
            { "label": "/usr/share/nginx/html", "sub": "bind mount", "icon": "box", "tone": "amber" },
            { "label": "/tmp", "sub": "tmpfs", "icon": "cpu", "tone": "blue" }
          ]
        }
      ]
    }
  ]
}
```

| Type           | Where the data lives                       | Use it for                                                            |
| -------------- | ------------------------------------------ | --------------------------------------------------------------------- |
| **Volume**     | A directory Docker manages on the host     | Databases and any data a service owns. The default choice.            |
| **Bind mount** | A file or directory you choose on the host | Source code during development, config files, sharing with host tools |
| **tmpfs**      | The host's memory                          | Scratch files and temporary data that should not stay on disk         |

Volumes are independent of the host's directory layout, work the same on Linux, macOS and Windows, can be backed up and moved with Docker commands, and get the right ownership for the container on first use. Bind mounts depend on a host path existing with the right permissions, which is exactly what you want for development and exactly what you do not want for a production database.

## Create and Manage Volumes

```bash
docker volume create hello-db-data
docker volume ls
docker volume inspect --format '{{ .Mountpoint }}' hello-db-data
```

Example output:

```text
DRIVER    VOLUME NAME
local     hello-db-data
/var/lib/docker/volumes/hello-db-data/_data
```

On Linux the data sits in that directory, owned by root. On Docker Desktop and in rootless mode the path is inside the VM or under your home directory. Treat the location as Docker's business: read and write the data through containers, not by editing files there.

## Run Postgres 18 on a Volume

Start a Postgres container for hello-api with the volume mounted:

```bash
docker run -d --name hello-db \
  -e POSTGRES_USER=hello \
  -e POSTGRES_PASSWORD=change-me \
  -e POSTGRES_DB=hello \
  -v hello-db-data:/var/lib/postgresql \
  postgres:18
```

`-v hello-db-data:/var/lib/postgresql` mounts the named volume at that path. If the volume does not exist, Docker creates it. The `POSTGRES_*` variables are read by the image's entrypoint on the first start only, when it initializes an empty data directory.

Why `/var/lib/postgresql` and not `/var/lib/postgresql/data`, which many tutorials use? The image tells you. This real run reads the `postgres:18` image config from Docker Hub with `crane`:

```terminal
{
  "title": "where postgres:18 keeps its data (real run)",
  "prompt": "$",
  "steps": [
    {
      "cmd": "crane config --platform linux/amd64 postgres:18 | jq -c '.config | {Volumes, PGDATA: (.Env[] | select(startswith(\"PGDATA=\")))}'",
      "output": "{\"Volumes\":{\"/var/lib/postgresql\":{}},\"PGDATA\":\"PGDATA=/var/lib/postgresql/18/docker\"}"
    }
  ]
}
```

From PostgreSQL 18, the official image stores data in `/var/lib/postgresql/18/docker`, a directory per major version, and declares the volume one level up. That layout lets a future upgrade run `pg_upgrade --link` with the old and new versions side by side on one volume.

:::warning
**The old mount path fails on Postgres 18.** If you mount a volume at `/var/lib/postgresql/data`, the 18 image refuses to start and prints an error that begins like this (the text comes from the image's entrypoint script):

```text
Error: in 18+, these Docker images are configured to store database data in a
       format which is compatible with "pg_ctlcluster" (specifically, using
       major-version-specific directory names).
...
       Counter to that, there appears to be PostgreSQL data in:
         /var/lib/postgresql/data (unused mount/volume)
```

Mount at `/var/lib/postgresql` instead. An existing volume from Postgres 17 or older cannot simply be reused with 18 either: dump and restore, or run `pg_upgrade`.
:::

## Prove That the Data Survives

Write a row, remove the container, start a new one on the same volume and read the row back:

```bash
docker exec hello-db psql -U hello -d hello \
  -c "CREATE TABLE notes (body text)" \
  -c "INSERT INTO notes VALUES ('written before docker rm')"

docker rm -f hello-db

docker run -d --name hello-db \
  -e POSTGRES_USER=hello -e POSTGRES_PASSWORD=change-me -e POSTGRES_DB=hello \
  -v hello-db-data:/var/lib/postgresql \
  postgres:18

docker exec hello-db psql -U hello -d hello -c "SELECT body FROM notes"
```

Example output of the last command (wait a few seconds after the start so Postgres accepts connections):

```text
           body
--------------------------
 written before docker rm
(1 row)
```

The container is new, the data is not. This is the core idea of running stateful services in containers: **containers are disposable, volumes are not.** Leave `hello-db` running; [Part 7](/guides/introduction-to-docker/07-networking-in-docker) connects hello-api to it.

**Anonymous volumes.** The `postgres` image declares `VOLUME /var/lib/postgresql`. If you forget `-v`, Docker still creates a volume, with a random 64-character name. The data survives `docker rm`, but you will have a hard time finding it again, and `docker rm -v` or a container started with `--rm` deletes it. Always name the volumes you care about.

## Back Up and Restore

For a database, use the database's own tools. They produce a consistent backup while the database runs:

```bash
# Back up hello's database to a file on the host
docker exec hello-db pg_dump -U hello -d hello --format=custom > hello.dump

# Restore into a database (here: the same one, replacing existing objects)
docker exec -i hello-db pg_restore -U hello -d hello --clean --if-exists < hello.dump
```

For other data, copy the volume's files with a throwaway container that mounts the volume read-only and a host directory for the archive:

```bash
# Stop the container that writes to the volume first, so the files are consistent
docker stop hello-db
docker run --rm \
  -v hello-db-data:/data:ro \
  -v "$(pwd)":/backup \
  alpine:3.24 tar czf /backup/hello-db-data.tar.gz -C /data .
docker start hello-db

# Restore into a new, empty volume
docker volume create hello-db-data-restored
docker run --rm \
  -v hello-db-data-restored:/data \
  -v "$(pwd)":/backup \
  alpine:3.24 tar xzf /backup/hello-db-data.tar.gz -C /data
```

Do not copy a running database's files: the copy can be inconsistent and fail to start. A backup is also only as good as your last restore test. Restore into a new volume and start a container on it from time to time.

## Bind Mounts for Development

A bind mount puts a host directory into the container. Change a file on the host and the container sees it immediately, which makes it the standard way to work on code or static files without rebuilding the image. Serve a local directory with nginx:

```bash
mkdir -p site && echo '<h1>Served from my laptop</h1>' > site/index.html
```

```tabs
{
  "title": "Mount the current directory's site folder",
  "tabs": [
    {
      "label": "Linux and macOS",
      "lang": "bash",
      "code": "docker run -d --name site -p 8080:80 \\\n  -v \"$(pwd)/site\":/usr/share/nginx/html:ro \\\n  nginx:1.30"
    },
    {
      "label": "Windows PowerShell",
      "lang": "powershell",
      "code": "docker run -d --name site -p 8080:80 `\n  -v \"${PWD}\\site:/usr/share/nginx/html:ro\" `\n  nginx:1.30"
    },
    {
      "label": "Windows cmd",
      "lang": "bat",
      "code": "docker run -d --name site -p 8080:80 ^\n  -v \"%cd%\\site:/usr/share/nginx/html:ro\" ^\n  nginx:1.30"
    }
  ]
}
```

`curl localhost:8080` now returns your file. Edit `site/index.html` and reload: nginx serves the new version at once. The `:ro` suffix makes the mount read-only inside the container, so a bug or an attacker in the container cannot change your files. Remove the container when you are done, so port 8080 is free again: `docker rm -f site`.

Rules for bind mounts:

- **Use absolute paths.** `-v site:/usr/...` without a slash or `./` means a **volume** named `site`, not your directory. `$(pwd)` gives you the absolute path.
- **`-v` creates a missing host path** as an empty directory owned by root. `--mount` fails instead, which catches typos: `--mount type=bind,src="$(pwd)/site",dst=/usr/share/nginx/html,readonly`.
- **A mount hides what the image has at that path.** Mounting an empty directory over `/usr/share/nginx/html` hides the welcome page. (An empty named **volume** is different: Docker copies the image's files into it on first use.)
- **On Docker Desktop**, bind mounts cross from your Mac or Windows filesystem into the Linux VM. Docker Desktop's file sharing makes this much faster than it used to be, but very large directories (a `node_modules` with 100,000 files) are still slower than a volume. On Windows, keep projects inside WSL.

[Part 8](/guides/introduction-to-docker/08-docker-compose) uses Compose Watch instead, which rebuilds or updates the container when files change and avoids most of these problems.

## The -v and --mount Flags

Both flags create the same mounts. `--mount` is longer but explicit, and it is the only way to pass some options:

| What you want                | `-v` / `--tmpfs`                         | `--mount`                                                       |
| ---------------------------- | ---------------------------------------- | --------------------------------------------------------------- |
| Named volume                 | `-v hello-db-data:/var/lib/postgresql`   | `--mount type=volume,src=hello-db-data,dst=/var/lib/postgresql` |
| Read-only bind mount         | `-v "$(pwd)/site":/srv:ro`               | `--mount type=bind,src="$(pwd)/site",dst=/srv,readonly`         |
| tmpfs, 64 MB, no executables | `--tmpfs /tmp:rw,noexec,nosuid,size=64m` | `--mount type=tmpfs,dst=/tmp,tmpfs-size=67108864`               |
| Volume with a subdirectory   | not possible                             | `--mount type=volume,src=shared,dst=/data,volume-subpath=app1`  |

## File Ownership and Non-Root Containers

Files in a mount keep their numeric owner (UID and GID). The user inside the container needs permission to read or write them:

- **Official database images** start as root, `chown` their data directory to their own user (`postgres`, UID 999) and then drop privileges. That is why a fresh volume just works.
- **Your own non-root images** do not do that. hello-api runs as UID 10001 ([Part 5](/guides/introduction-to-docker/05-building-custom-docker-images)). If it had to write to a volume, you would create the directory in the Dockerfile with that owner (`RUN mkdir /data && chown app /data`) before the `VOLUME` or mount point is used; Docker copies the directory's ownership into a new, empty volume.
- **Bind mounts in development**: run the container as your own user so files it writes are not owned by root on your host: `docker run --user "$(id -u):$(id -g)" ...`.

Avoid fixing permission errors with `chmod -R 777`. It works by giving every user on the host write access.

## tmpfs Mounts

A tmpfs mount is memory. It is fast, nothing is written to the container's filesystem or a volume, and its content is gone when the container stops. Like any memory, it can be written to the host's swap space if the host has swap, so a strict "never on disk" rule also needs a host without swap or with encrypted swap:

```bash
docker run -d --name hello-api-tmp \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  hello-api:1.0
```

Combined with `--read-only`, which makes the container's root filesystem read-only, it gives the app a writable scratch directory while everything else in the image stays read-only (mounts such as `/dev/shm`, which gunicorn uses, stay writable too). [Part 9](/guides/introduction-to-docker/09-docker-best-practices) uses this to harden hello-api. Remove the test container with `docker rm -f hello-api-tmp`.

## Volumes on Other Storage

The built-in `local` driver can also mount network storage, for example an NFS share, when the container starts:

```bash
docker volume create --driver local \
  --opt type=nfs \
  --opt o=addr=10.0.0.10,rw,nfsvers=4 \
  --opt device=:/exports/hello \
  hello-nfs
```

Volume plugins exist for cloud block storage and distributed filesystems, but most teams that need storage which follows a container from host to host use an orchestrator with its own storage system, such as Kubernetes persistent volumes ([Part 10](/guides/introduction-to-docker/10-docker-in-production)). Running more than one database container on the same files never works, on any storage.

## Clean Up Volumes

```bash
docker volume ls --filter dangling=true   # volumes that no container uses: check this list first
docker volume rm hello-db-data-restored   # remove one volume by name (it must not be in use)
docker volume prune                       # remove unused ANONYMOUS volumes
docker volume prune --all                 # remove every unused volume, named ones included
```

Since Docker Engine 23, `docker volume prune` removes only anonymous volumes unless you add `--all`. It asks for confirmation but does not show what it will delete; it prints the names only afterwards. A volume counts as unused as soon as its container is removed, even if you plan to start a new one next week, so list the dangling volumes first and remove the ones you are sure about by name.

## Common Mistakes

- **No named volume for a database.** For images without a `VOLUME` instruction, the data lives in the container's writable layer and disappears with `docker rm`. The postgres image declares one, so Docker creates an anonymous volume instead: the data survives, but it is hard to find, and `docker rm -v` or `--rm` deletes it.
- **`/var/lib/postgresql/data` with Postgres 18.** The container exits with the error above. Mount `/var/lib/postgresql`.
- **A relative path with `-v`.** `-v data:/data` is a volume called `data`, not your `./data` directory.
- **Two containers writing the same database files.** Each database server needs its own data directory.
- **`docker compose down -v` or `docker volume prune --all` by habit.** Both delete named volumes and the data in them ([Part 8](/guides/introduction-to-docker/08-docker-compose)).
- **No restore test.** An untested backup is a guess.

## Summary

- Volumes are Docker-managed storage that outlives containers; use them for databases and service data.
- Bind mounts map host paths into containers; use them for development and config files, preferably read-only.
- tmpfs mounts keep scratch data in memory, and pair well with `--read-only`.
- The Postgres 18 image stores data under `/var/lib/postgresql/18/docker`; mount the volume at `/var/lib/postgresql`.
- Back up with the database's own tools, and test restores.

Next, connect hello-api to this database over a Docker network in [Docker Networking](/guides/introduction-to-docker/07-networking-in-docker).

## Keep Learning

- [How to Handle Persistent Storage for Databases in Docker](/posts/docker-persistent-storage-databases)
- [How to Prevent Data Loss When Docker Containers Exit](/posts/docker-data-loss-when-container-exits)
- [How to Mount a Host Directory in a Docker Container](/posts/docker-mount-host-directory)
- [How to Add a Volume to an Existing Docker Container](/posts/how-to-add-a-volume-to-an-existing-docker-container)
- [Install PostgreSQL 18, including the Docker image](/guides/introduction-to-postgres/02-installation-and-setup)
