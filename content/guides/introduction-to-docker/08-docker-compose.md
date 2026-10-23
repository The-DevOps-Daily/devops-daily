---
title: 'Docker Compose Tutorial: compose.yaml, Services and Commands'
description: 'Run an app and Postgres from one compose.yaml: services, networks, volumes, secrets, health checks, profiles and watch, checked with docker compose config.'
order: 8
---

By the end of [Part 7](/guides/introduction-to-docker/07-networking-in-docker), running hello-api took a network, a volume, two long `docker run` commands and a list of environment variables to remember. **Docker Compose** puts all of that in one file, `compose.yaml`, and gives you one command to start, stop and rebuild the whole application. In this part you write that file for hello-api and Postgres, validate it without starting anything, and learn the commands and features you will use every day.

## Prerequisites

- Docker with the Compose plugin: `docker compose version` prints v2 or newer ([Part 2](/guides/introduction-to-docker/02-docker-installation)). This guide uses Compose v5.6.1.
- The hello-api project from [Part 5](/guides/introduction-to-docker/05-building-custom-docker-images): `app.py`, `requirements.txt`, the multi-stage `Dockerfile` and `.dockerignore`.

The `docker compose config` output in this part is real: Compose parses and validates files without a Docker daemon. Output of commands that start containers is shown as examples.

## docker compose vs docker-compose

Compose started as a separate Python program, `docker-compose`, with files that began with `version: "3.8"`. That program (Compose v1) stopped getting updates in July 2023. Today Compose is a plugin of the Docker CLI written in Go, and you run it as **`docker compose`**, with a space. Compose v2 became v5 in December 2025 (the project skipped v3 and v4 to avoid confusion with the old file versions), and since v5 it hands image builds to Docker Bake, the same build path as `docker build`.

What this means for your files:

- **Name the file `compose.yaml`.** Compose also finds `compose.yml`, `docker-compose.yaml` and `docker-compose.yml`, but `compose.yaml` is the preferred name.
- **Drop the `version:` line.** The file follows the [Compose Specification](https://compose-spec.io/), which has no versions. Compose ignores the key and warns about it. A real run on a file from an old tutorial:

```terminal
{
  "title": "an old file with a version key (real run, Compose v5.6.1)",
  "prompt": "$",
  "steps": [
    {
      "cmd": "cat docker-compose.yml",
      "output": "version: \"3.8\"\nservices:\n  web:\n    image: nginx:1.30\n    ports:\n      - \"8080:80\""
    },
    {
      "cmd": "docker compose config --quiet && echo \"valid\"",
      "output": "time=\"2026-10-23T20:54:01Z\" level=warning msg=\"/home/dev/old-compose/docker-compose.yml: the attribute `version` is obsolete, it will be ignored, please remove it to avoid potential confusion\"\nvalid"
    }
  ]
}
```

The file is still valid; delete the line and the warning goes away.

## The compose.yaml for hello-api

Create the database password as a file. Compose mounts it into the containers as a **secret**, which keeps its value out of the image and out of the container configuration that `docker inspect` shows. (The postgres entrypoint reads the file into a variable while it initializes the database, and removes it before the server starts.)

```bash
mkdir -p secrets && chmod 700 secrets
openssl rand -base64 24 > secrets/db_password.txt
chmod 644 secrets/db_password.txt   # readable inside the container; the 700 directory keeps other host users out
echo "secrets/" >> .gitignore
```

Then add `compose.yaml` next to the Dockerfile:

```yaml
services:
  api:
    build: .
    image: hello-api:${HELLO_API_TAG:-1.0}
    ports:
      # Only the host can reach the API; a reverse proxy publishes it in production
      - '127.0.0.1:${HELLO_API_PORT:-8000}:8000'
    environment:
      DB_HOST: db
      DB_USER: hello
      DB_NAME: hello
      DB_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password
    depends_on:
      db:
        condition: service_healthy
        restart: true
    restart: unless-stopped
    networks:
      - frontend
      - backend
    develop:
      watch:
        # Rebuild the image and recreate the container when the code or the dependencies change
        - action: rebuild
          path: ./app.py
        - action: rebuild
          path: ./requirements.txt

  db:
    image: postgres:18
    environment:
      POSTGRES_USER: hello
      POSTGRES_DB: hello
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password
    volumes:
      - db-data:/var/lib/postgresql
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -h 127.0.0.1 -U hello -d hello']
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 10s
    restart: unless-stopped
    networks:
      - backend

  adminer:
    image: adminer:6
    profiles: [debug]
    ports:
      - '127.0.0.1:8080:8080'
    networks:
      - frontend
      - backend

volumes:
  db-data:

secrets:
  db_password:
    file: ./secrets/db_password.txt

networks:
  frontend:
  backend:
    internal: true
```

Everything from Parts 5 to 7 is here:

- **`services`**: one entry per container. `api` builds from the Dockerfile in `.` and tags the image `hello-api:1.0`; `db` uses the official image.
- **`ports`**: the same `-p` syntax, published on `127.0.0.1` only. `db` publishes nothing.
- **`environment`** and **`secrets`**: the app reads the password from `/run/secrets/db_password` through `DB_PASSWORD_FILE`, and the postgres image does the same through `POSTGRES_PASSWORD_FILE`.
- **`volumes`**: the named volume `db-data` at `/var/lib/postgresql`, the Postgres 18 path from [Part 6](/guides/introduction-to-docker/06-working-with-docker-volumes).
- **`networks`**: `backend` is internal, so the database has no route to the internet; `api` joins both networks, like the `--internal` setup at the end of Part 7.
- **`POSTGRES_USER: hello`** makes the image create `hello` as a database **superuser**, which is convenient for development. [Part 9](/guides/introduction-to-docker/09-docker-best-practices#h2-give-the-app-a-database-role-that-is-not-a-superuser) replaces it with an ordinary role that owns the `hello` database.
- **`depends_on` with `condition: service_healthy`**: Compose starts `api` only after the `db` health check passes. The check uses `-h 127.0.0.1` on purpose: while the image initializes a new database, it runs a temporary server that listens only on a Unix socket, and a plain `pg_isready` would report ready before the real server accepts TCP connections from `api`. `restart: true` restarts `api` when Compose restarts `db`.
- **`restart: unless-stopped`**: the restart policy from [Part 4](/guides/introduction-to-docker/04-creating-your-first-container).
- **`profiles: [debug]`**: `adminer`, a small web UI for databases, starts only when you ask for the `debug` profile.
- **`develop.watch`**: used by `docker compose watch`, below.

Compose creates one default network per project if you declare none, and names everything after the **project**, which defaults to the directory name. In a directory called `hello-api`, the containers are `hello-api-api-1` and `hello-api-db-1`, the volume is `hello-api_db-data`, and the networks are `hello-api_frontend` and `hello-api_backend`. Inside the project, services reach each other by **service name**: `api` connects to `db`.

:::note
Compose mounts a file secret like a read-only bind mount, with the file's permissions from the host. The api container runs as UID 10001, so the file must be readable by it, which is why the commands above set mode `644` explicitly (a strict `umask` would otherwise create it as `600`). The `700` directory keeps other users on the host away from it. Keep the directory out of Git and out of the build context (`.dockerignore` already excludes `secrets/`). On a server, prefer a secret store or an orchestrator's secrets ([Part 10](/guides/introduction-to-docker/10-docker-in-production)).
:::

## Validate Before You Start

`docker compose config` parses the file, applies defaults and variables, and prints the result. It catches typos and wrong indentation before anything runs. These are real runs on the file above:

```terminal
{
  "title": "validate compose.yaml (real run)",
  "prompt": "$",
  "steps": [
    {
      "cmd": "docker compose config --quiet && echo \"compose.yaml is valid\"",
      "output": "compose.yaml is valid"
    },
    {
      "cmd": "docker compose config --services",
      "output": "db\napi"
    },
    {
      "comment": "profiles add services only when you ask for them",
      "cmd": "docker compose --profile debug config --services",
      "output": "db\napi\nadminer"
    }
  ]
}
```

`docker compose config api` prints the normalized definition of a service and the services it depends on, with every default and variable filled in. With `--format json` and `jq` you can pick out the parts you care about:

```terminal
{
  "title": "the api service as Compose sees it (real run)",
  "prompt": "$",
  "steps": [
    {
      "cmd": "docker compose config --format json api | jq '.services.api | {image, build, ports, secrets, depends_on}'",
      "output": "{\n  \"image\": \"hello-api:1.0\",\n  \"build\": {\n    \"context\": \"/home/dev/hello-api\",\n    \"dockerfile\": \"Dockerfile\"\n  },\n  \"ports\": [\n    {\n      \"mode\": \"ingress\",\n      \"host_ip\": \"127.0.0.1\",\n      \"target\": 8000,\n      \"published\": \"8000\",\n      \"protocol\": \"tcp\"\n    }\n  ],\n  \"secrets\": [\n    {\n      \"source\": \"db_password\",\n      \"target\": \"/run/secrets/db_password\"\n    }\n  ],\n  \"depends_on\": {\n    \"db\": {\n      \"condition\": \"service_healthy\",\n      \"restart\": true,\n      \"required\": true\n    }\n  }\n}"
    }
  ]
}
```

Note what Compose filled in: the absolute build context, the default `Dockerfile` name, the secret's `target` path under `/run/secrets/`, `required: true` on the dependency, and the image tag and port from the `${...:-default}` defaults.

A typo fails fast, because Compose checks every key against the Compose Specification schema. Here `healthcheck` is misspelled:

```terminal
{
  "title": "a misspelled key (real run)",
  "prompt": "$",
  "steps": [
    {
      "cmd": "docker compose config --quiet",
      "output": "validating /home/dev/typo/compose.yaml: services.db.helthcheck false schema"
    }
  ]
}
```

Run `docker compose config --quiet` in CI for every change to a Compose file.

## Variables and the .env File

`${HELLO_API_PORT:-8000}` is **interpolation**: Compose replaces it with the variable's value from your shell or from a `.env` file in the project directory, or with the default after `:-`. `${VAR:?message}` makes a variable required. List the variables a file uses:

```terminal
{
  "title": "the variables in compose.yaml (real run)",
  "prompt": "$",
  "steps": [
    {
      "cmd": "docker compose config --variables",
      "output": "NAME                REQUIRED            DEFAULT VALUE       ALTERNATE VALUE\nHELLO_API_PORT      false               8000\nHELLO_API_TAG       false               1.0"
    }
  ]
}
```

Set them in `.env` to change them per machine without editing `compose.yaml`:

```text
# Local settings for this machine; not committed
HELLO_API_PORT=8001
```

```terminal
{
  "title": ".env changes the published port (real run)",
  "prompt": "$",
  "steps": [
    {
      "cmd": "docker compose config --format json api | jq -c '.services.api.ports'",
      "output": "[{\"mode\":\"ingress\",\"host_ip\":\"127.0.0.1\",\"target\":8000,\"published\":\"8001\",\"protocol\":\"tcp\"}]"
    }
  ]
}
```

Delete the file again (`rm .env`) before you continue, so the rest of this part uses port 8000.

Interpolation happens when Compose reads the file. That is different from the `environment:` section, which sets variables **inside** the container. A `.env` file is not passed to containers unless you also list it under `env_file:`. Keep secrets out of both: use `secrets:`.

## Start the Application

```bash
docker compose up -d --build
```

`--build` builds the `api` image from the current Dockerfile and code. Without it, Compose builds only when the image is missing, and the `hello-api:1.0` image from Part 5 already exists. Compose then creates the networks and the volume, starts `db`, waits for its health check and starts `api`. Example output after the build output:

```text
[+] up 6/6
 ✔ Image hello-api:1.0        Built                                        21.7s
 ✔ Network hello-api_backend  Created                                       0.1s
 ✔ Network hello-api_frontend Created                                       0.1s
 ✔ Volume hello-api_db-data   Created                                       0.0s
 ✔ Container hello-api-db-1   Healthy                                       6.4s
 ✔ Container hello-api-api-1  Started                                       6.6s
```

`hello-api_db-data` is a new, empty volume: Compose prefixes names with the project, so it does not reuse `hello-db-data` from Part 6. Remove the old one with `docker volume rm hello-db-data` when you no longer need it. Check the result (example output):

```bash
docker compose ps
curl -s localhost:8000/visits
```

```text
NAME              IMAGE           COMMAND                  SERVICE   CREATED          STATUS                    PORTS
hello-api-api-1   hello-api:1.0   "gunicorn --bind 0.0…"   api       40 seconds ago   Up 33 seconds (healthy)   127.0.0.1:8000->8000/tcp
hello-api-db-1    postgres:18     "docker-entrypoint.s…"   db        40 seconds ago   Up 39 seconds (healthy)   5432/tcp
{"visits":1}
```

Both containers report `healthy`: `db` from the `pg_isready` check in `compose.yaml`, `api` from the `HEALTHCHECK` in its Dockerfile.

## Everyday Commands

| Command                                 | What it does                                                               |
| --------------------------------------- | -------------------------------------------------------------------------- |
| `docker compose up -d`                  | Create or update and start everything; only changed services are recreated |
| `docker compose up -d --build`          | Rebuild images first                                                       |
| `docker compose up -d --wait`           | Return only when services are running and healthy (useful in CI)           |
| `docker compose ps`                     | Status of the project's containers                                         |
| `docker compose logs -f api`            | Follow one service's logs                                                  |
| `docker compose exec db psql -U hello`  | Run a command in a running service container                               |
| `docker compose run --rm api python -V` | Run a one-off command in a new container of a service                      |
| `docker compose restart api`            | Restart without recreating                                                 |
| `docker compose stop` / `start`         | Stop or start containers without removing them                             |
| `docker compose pull`                   | Pull newer versions of the images                                          |
| `docker compose down`                   | Stop and remove containers and networks; volumes stay                      |
| `docker compose down -v`                | Also remove the named volumes declared in the file: **deletes the data**   |

`docker compose logs` prefixes each line with the container (example output):

```text
api-1  | [2026-10-23 21:05:12 +0000] [1] [INFO] Starting gunicorn 26.2.0
api-1  | [2026-10-23 21:05:12 +0000] [1] [INFO] Listening at: http://0.0.0.0:8000 (1)
api-1  | [2026-10-23 21:05:12 +0000] [1] [INFO] Using worker: sync
api-1  | [2026-10-23 21:05:12 +0000] [7] [INFO] Booting worker with pid: 7
api-1  | [2026-10-23 21:05:12 +0000] [8] [INFO] Booting worker with pid: 8
```

:::warning
`docker compose down -v` deletes `hello-api_db-data` and the database in it. Use plain `docker compose down` unless you really want a fresh database.
:::

## Develop with Compose Watch

`docker compose watch` (or `docker compose up --watch`) starts the project and watches the paths listed under `develop.watch`. When you save `app.py` or `requirements.txt`, Compose rebuilds the image and recreates the `api` container. Thanks to the layer cache from [Part 5](/guides/introduction-to-docker/05-building-custom-docker-images), a code change rebuilds only the last layers, which takes seconds.

Watch has faster actions too. `sync` copies changed files into the running container, and `sync+restart` also restarts it (`restart` and `sync+exec` exist as well). Both are faster than a rebuild, but they need a container user that can write to the target path. hello-api's code is owned by root and the app runs as UID 10001 (and Part 9 makes the filesystem read-only), so `rebuild` is the action that works here. Use `sync` with development images that run as a user who owns the code, typically with a framework that reloads code by itself.

Unlike a bind mount, watch works the same on Linux, macOS and Windows, and it does not expose your whole project directory to the container.

## Override Files

Compose merges several files. If a `compose.override.yaml` exists next to `compose.yaml`, `docker compose` loads it automatically, which makes it the usual place for local development settings. This override bind-mounts the code and turns on gunicorn's auto-reload instead of using watch:

```yaml
services:
  api:
    command: ['gunicorn', '--bind', '0.0.0.0:8000', '--reload', '--no-control-socket', 'app:app']
    volumes:
      - ./app.py:/app/app.py:ro
```

```terminal
{
  "title": "the merged api service (real run)",
  "prompt": "$",
  "steps": [
    {
      "cmd": "docker compose config --format json api | jq -c '.services.api | .command, .volumes'",
      "output": "[\"gunicorn\",\"--bind\",\"0.0.0.0:8000\",\"--reload\",\"--no-control-socket\",\"app:app\"]\n[{\"type\":\"bind\",\"source\":\"/home/dev/hello-api/app.py\",\"target\":\"/app/app.py\",\"read_only\":true,\"bind\":{}}]"
    }
  ]
}
```

Delete the override again (`rm compose.override.yaml`) before you continue: Compose would otherwise apply it to every command in this directory, including the hardened setup in Part 9.

Values in later files win, lists like `ports` are merged, and `command` replaces the earlier one. With explicit `-f` flags, Compose loads only the files you name, in order: `docker compose -f compose.yaml -f compose.prod.yaml up -d` is the usual way to apply production settings ([Part 10](/guides/introduction-to-docker/10-docker-in-production)). For bigger projects, `include:` pulls in other Compose files as separate sub-projects, and `extends:` reuses one service definition in another.

## Scale a Service

```bash
docker compose up -d --scale api=3
```

This fails as long as `api` publishes a fixed host port, because three containers cannot all bind `127.0.0.1:8000`. To run several copies, remove the host port from the service and put a reverse proxy in front of it, as [Part 10](/guides/introduction-to-docker/10-docker-in-production) shows. Without the fixed port, the scaled project looks like this (example output):

```text
[+] up 4/4
 ✔ Container hello-api-db-1  Running                                        0.0s
 ✔ Container hello-api-api-1 Started                                        0.4s
 ✔ Container hello-api-api-2 Started                                        0.4s
 ✔ Container hello-api-api-3 Started                                        0.5s
```

Inside the project, the name `api` then resolves to all three containers, and the `hostname` field in hello-api's `/` response shows which one answered.

## Common Mistakes

- **`version:` at the top.** Obsolete; delete it.
- **`depends_on` without a condition.** A plain list only orders the start; the app starts before the database accepts connections. Use `condition: service_healthy` with a health check.
- **`localhost` between services.** Use the service name (`db`).
- **Secrets in `environment:` or in a committed `.env`.** Use `secrets:` and keep secret files out of Git.
- **`docker compose down -v` by habit.** It deletes your data volumes.
- **Expecting `docker compose up` to pull newer images.** With a version tag and the default pull policy, it uses the local image if one exists (only `latest` tags are always checked). Run `docker compose pull` (or `up --pull always`) first.
- **Editing files and expecting running containers to change.** After a change to `compose.yaml`, run `docker compose up -d`; it recreates only the services whose configuration changed. After a change to the code or the Dockerfile, run `docker compose up -d --build`, or use watch.

## Summary

- `compose.yaml` describes services, networks, volumes and secrets; `docker compose up -d` creates them, `down` removes them.
- Validate with `docker compose config --quiet`; it needs no daemon.
- Use health checks with `depends_on: condition: service_healthy`, file-based secrets, and internal networks for databases.
- Variables come from your shell or `.env`; override files and profiles adapt one file to several environments.
- Watch rebuilds and recreates a service when its code changes during development.

Next, harden the image and the container in [Docker Best Practices](/guides/introduction-to-docker/09-docker-best-practices).

## Keep Learning

- [What Is the Difference Between 'docker compose' and 'docker-compose'?](/posts/docker-compose-vs-docker-compose)
- [How Can I Use Environment Variables in docker-compose?](/posts/docker-compose-environment-variables)
- [Docker Compose: Wait for Container X Before Starting Y](/posts/docker-compose-wait-container)
- [How to Rebuild, Restart and Upgrade a Docker Compose Container](/posts/rebuild-docker-container-compose)
- [Docker Compose: Understanding Ports vs Expose](/posts/docker-compose-ports-vs-expose)
