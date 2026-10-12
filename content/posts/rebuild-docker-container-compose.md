---
title: 'How to Rebuild, Restart and Upgrade a Docker Compose Container'
excerpt: 'restart, up -d, up --build and --force-recreate each apply a different kind of change, and only one of them rebuilds your image. Tested on Compose 5.6: which command picks up code, config and image changes, how to upgrade without losing data, how to get a shell in a running or crashed service, and a Compose 2.38 quirk that can leave old code running.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-12-05'
publishedAt: '2024-12-05T09:00:00Z'
updatedAt: '2026-10-12T09:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Docker
  - Docker Compose
  - Containers
  - Redis
  - Troubleshooting
  - DevOps
---

You change a file, run a Compose command, reload the page, and the old version is still there. Docker Compose has four commands that look interchangeable: `restart`, `up -d`, `up -d --build` and `up -d --force-recreate`. They apply different kinds of change, and only one of them rebuilds an image that already exists. Pick the wrong one and you test old code, or lose the data you meant to keep.

This post shows which command picks up which change, then covers restarting one service, upgrading an image without losing data, and getting a shell inside a service, including one that crashes on start. Every terminal block comes from one script run on a fresh GitHub Actions runner with Docker 28.0.4 and Docker Compose 5.6.0. The blocks are excerpts: BuildKit progress lines and `[exit 0]` markers are left out, and the container ID lines are notes the script printed. The script and the full log, in run order, are linked at the end.

## TLDR

| What changed                                                      | Command                                                | What it does                                                     |
| ----------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------- |
| Code or Dockerfile of a service with `build:`                     | `docker compose up -d --build web`                     | Builds, then recreates the container if the image changed        |
| `environment`, ports, volumes or other settings in `compose.yaml` | `docker compose up -d`                                 | Recreates the services whose config or image changed             |
| The image tag in `compose.yaml`                                   | `docker compose up -d`                                 | Uses the new tag (pulls it if needed) and recreates that service |
| Same tag, newer image in the registry                             | `docker compose pull web`, then `docker compose up -d` | `pull` updates the local image, `up` swaps the container         |
| Nothing, but you want a fresh container                           | `docker compose up -d --force-recreate web`            | Recreates even when nothing changed                              |
| Nothing, the process is stuck                                     | `docker compose restart web`                           | Same container, same config, new process                         |

`restart` never applies changes from `compose.yaml` or a new image. `docker compose down` keeps volumes, and `down -v` deletes the named volumes declared in the file (not external ones) and anonymous volumes.

Compose 2.38.2 with its default bake builder sometimes kept the old container after `up -d --build` in our tests. That was the version on the GitHub `ubuntu-24.04` runner we used on 12 October 2026. See [the last section](#h2-compose-238-when-build-does-not-replace-the-container) if `docker compose version` prints 2.38.2.

## Prerequisites

- Docker Engine with the Compose plugin, so that `docker compose version` works. The old Python `docker-compose` (Compose v1) has not had a release since 1.29.2 in May 2021, and everything below uses the plugin.
- A project with at least one service that has a `build:` section.
- `curl`, to check what a web service serves.

## The test project

Two services: `web`, built from a Dockerfile, and `cache`, a Redis image with a named volume for its data.

```yaml
name: shop
services:
  web:
    build: .
    ports:
      - '8000:8000'
    environment:
      GREETING: hello
    depends_on:
      - cache
  cache:
    image: redis:7.2-alpine
    volumes:
      - cache-data:/data
volumes:
  cache-data:
```

```dockerfile
FROM python:3.13-alpine
WORKDIR /app
COPY app.py .
CMD ["python", "-u", "app.py"]
```

`app.py` is a small HTTP server that answers with a version string from the code (`MSG = "v1"`) and the value of the `GREETING` environment variable. One `curl` shows which code and which config the running container has.

```terminal
{
  "title": "first start",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "docker compose up -d --quiet-pull",
      "output": "(BuildKit progress lines trimmed)\nImage redis:7.2-alpine Pulling\nImage redis:7.2-alpine Pulled\nImage shop-web Building\n\nImage shop-web Built\nNetwork shop_default Creating\nNetwork shop_default Creating\nVolume shop_cache-data Creating\nVolume shop_cache-data Creating\nVolume shop_cache-data Created\nVolume shop_cache-data Created\nNetwork shop_default Created\nNetwork shop_default Created\nContainer shop-cache-1 Creating\nContainer shop-cache-1 Created\nContainer shop-web-1 Creating\nContainer shop-web-1 Created\nContainer shop-cache-1 Starting\nContainer shop-cache-1 Started\nContainer shop-web-1 Starting\nContainer shop-web-1 Started"
    },
    {
      "cmd": "curl -s localhost:8000",
      "output": "v1 greeting=hello"
    },
    {
      "cmd": "docker compose ps --format 'table {{.Service}}\\t{{.Image}}\\t{{.Status}}'",
      "output": "SERVICE   IMAGE              STATUS\ncache     redis:7.2-alpine   Up 1 second\nweb       shop-web           Up 1 second"
    }
  ]
}
```

## How do I rebuild a container after changing the code or Dockerfile?

Run `up` with `--build` and the service name:

```bash
docker compose up -d --build web
```

`--build` builds the image first, and `up` replaces the container because its image changed. The other two obvious commands do not work. Here is each one after changing `MSG = "v1"` to `MSG = "v2"` in `app.py`:

```terminal
{
  "title": "code change: restart, up -d, up -d --build",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "sed -i 's/MSG = \"v1\"/MSG = \"v2\"/' app.py"
    },
    {
      "cmd": "docker compose restart web",
      "output": "Container shop-web-1 Restarting\nContainer shop-web-1 Started"
    },
    {
      "cmd": "curl -s localhost:8000",
      "output": "v1 greeting=hello"
    },
    {
      "comment": "web container before: b22f441fd3e0, after restart: b22f441fd3e0"
    },
    {
      "cmd": "docker compose up -d",
      "output": "Container shop-cache-1 Running\nContainer shop-web-1 Running"
    },
    {
      "cmd": "curl -s localhost:8000",
      "output": "v1 greeting=hello"
    },
    {
      "cmd": "docker compose up -d --build web",
      "output": "(BuildKit progress lines trimmed)\nImage shop-web Building\n\nImage shop-web Built\nContainer shop-cache-1 Running\nContainer shop-web-1 Recreate\nContainer shop-web-1 Recreated\nContainer shop-web-1 Starting\nContainer shop-web-1 Started"
    },
    {
      "cmd": "curl -s localhost:8000",
      "output": "v2 greeting=hello"
    },
    {
      "comment": "web container before: b22f441fd3e0, after up --build: 1a0c5e4debee"
    }
  ]
}
```

- `restart` stops and starts the same container (same ID), so it runs the same image and the old code.
- `up -d` without `--build` uses the `shop-web` image that is already on the machine. Compose does not watch your source files. With default settings it builds only when the image is missing (as on the first start), and `--build` asks for a build every time. A service can also set `pull_policy: build` to always build.
- `up -d --build web` built a new image and, because the image changed, replaced the container. The container ID changed and the new code answered.

You do not need `docker compose down` before a rebuild. `up --build` replaces only the containers whose image or config changed, while `down` removes every container and the network, which means downtime for all services.

### When the build cache hides a change

Docker reuses a cached layer when the instruction and its input files have not changed. A `RUN apt-get install` or `RUN git clone` line that would fetch something newer today still hits the cache, because the instruction text is the same. `--no-cache` runs every build step again without the layer cache. It does not fetch a newer base image, so add `--pull` for that. Then swap the container:

```bash
docker compose build --no-cache --pull web
docker compose up -d web
```

A `build` on its own never touches the running container. The next `up` picks up the new image. The test run left out that `up` after its `--no-cache` build, which shows up in the upgrade section below. [How to force a clean Docker build](/posts/force-docker-clean-build) covers the cache in more detail.

## How do I restart a single container with Docker Compose?

```bash
docker compose restart web
```

In this project, that restarts `web` and nothing else. A service that lists `web` under `depends_on` with `restart: true` would restart too, and `--no-deps` prevents that. The container stays the same: same ID, same image, same config. Only the process starts again. That is the right tool for a stuck process, or for a service that reads a config file from a bind mount at startup.

It is the wrong tool for changes in `compose.yaml`. Docker's [`compose restart` reference](https://docs.docker.com/reference/cli/docker/compose/restart/) says it directly: "If you make changes to your compose.yml configuration, these changes are not reflected after running this command." Here `GREETING` changes from `hello` to `hi`:

```terminal
{
  "title": "config change: restart vs up -d",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "sed -i 's/GREETING: hello/GREETING: hi/' compose.yaml"
    },
    {
      "cmd": "docker compose restart web",
      "output": "Container shop-web-1 Restarting\nContainer shop-web-1 Started"
    },
    {
      "cmd": "curl -s localhost:8000",
      "output": "v2 greeting=hello"
    },
    {
      "cmd": "docker compose up -d",
      "output": "Container shop-cache-1 Running\nContainer shop-web-1 Recreate\nContainer shop-web-1 Recreated\nContainer shop-web-1 Starting\nContainer shop-web-1 Started"
    },
    {
      "cmd": "curl -s localhost:8000",
      "output": "v2 greeting=hi"
    }
  ]
}
```

`restart` kept the old value. `up -d` saw the changed environment, recreated `web` and left `cache` running. For one service, `docker compose up -d web` does the same, and `docker compose stop web` with `docker compose start web` behaves like `restart`. To start only some services in the first place, see [docker compose up for certain containers](/posts/docker-compose-up-only-certain-containers).

## Force a new container, or leave dependencies alone

### Force a new container when nothing changed

`up -d` leaves a container alone when its image and config match. `--force-recreate` replaces it anyway:

```terminal
{
  "title": "--force-recreate",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "docker compose up -d",
      "output": "Container shop-cache-1 Running\nContainer shop-web-1 Running"
    },
    {
      "comment": "web container before: f3d199d66fa0, after up -d: f3d199d66fa0"
    },
    {
      "cmd": "docker compose up -d --force-recreate web",
      "output": "Container shop-cache-1 Running\nContainer shop-web-1 Recreate\nContainer shop-web-1 Recreated\nContainer shop-web-1 Starting\nContainer shop-web-1 Started"
    },
    {
      "comment": "web container before: f3d199d66fa0, after --force-recreate: 424bff50a255"
    }
  ]
}
```

That is useful when a fix needs a clean writable layer, for example after someone edited files inside the container by hand. A `restart` keeps those edits. [Docker Compose: always recreate containers](/posts/docker-compose-always-recreate-containers) shows how to make this the default.

### Start one service without its dependencies

`up web` also starts the services that `web` lists under `depends_on` if they are stopped. `--no-deps` starts `web` only:

```terminal
{
  "title": "depends_on and --no-deps",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "docker compose stop cache web",
      "output": "Container shop-web-1 Stopping\nContainer shop-web-1 Stopped\nContainer shop-cache-1 Stopping\nContainer shop-cache-1 Stopped"
    },
    {
      "cmd": "docker compose up -d web",
      "output": "Container shop-cache-1 Starting\nContainer shop-cache-1 Started\nContainer shop-web-1 Starting\nContainer shop-web-1 Started"
    },
    {
      "cmd": "docker compose ps --format 'table {{.Service}}\\t{{.Status}}'",
      "output": "SERVICE   STATUS\ncache     Up Less than a second\nweb       Up Less than a second"
    },
    {
      "cmd": "docker compose stop cache web",
      "output": "Container shop-web-1 Stopping\nContainer shop-web-1 Stopped\nContainer shop-cache-1 Stopping\nContainer shop-cache-1 Stopped"
    },
    {
      "cmd": "docker compose up -d --no-deps web",
      "output": "Container shop-web-1 Starting\nContainer shop-web-1 Started"
    },
    {
      "cmd": "docker compose ps -a --format 'table {{.Service}}\\t{{.Status}}'",
      "output": "SERVICE   STATUS\ncache     Exited (0) Less than a second ago\nweb       Up Less than a second"
    },
    {
      "cmd": "docker compose up -d",
      "output": "Container shop-web-1 Running\nContainer shop-cache-1 Starting\nContainer shop-cache-1 Started"
    }
  ]
}
```

## How do I upgrade a container after its image changed?

There are two cases: you changed the tag, or the tag stayed the same and the image behind it moved.

### A new tag

Change the tag in `compose.yaml` and run `up -d`. Before the upgrade, the run stores a key in Redis:

```terminal
{
  "title": "redis 7.2 to 7.4",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "docker compose exec -T cache redis-cli SET orders 42",
      "output": "OK"
    },
    {
      "cmd": "docker compose exec -T cache redis-server --version",
      "output": "Redis server v=7.2.16 sha=00000000:0 malloc=jemalloc-5.3.0 bits=64 build=f0a29854ae29bd4d"
    },
    {
      "cmd": "sed -i 's/redis:7.2-alpine/redis:7.4-alpine/' compose.yaml"
    },
    {
      "cmd": "docker compose up -d --quiet-pull",
      "output": "Image redis:7.4-alpine Pulling\nImage redis:7.4-alpine Pulled\nContainer shop-cache-1 Recreate\nContainer shop-cache-1 Recreated\nContainer shop-web-1 Recreate\nContainer shop-web-1 Recreated\nContainer shop-cache-1 Starting\nContainer shop-cache-1 Started\nContainer shop-web-1 Starting\nContainer shop-web-1 Started"
    },
    {
      "cmd": "docker compose exec -T cache redis-server --version",
      "output": "Redis server v=7.4.11 sha=00000000:0 malloc=jemalloc-5.3.0 bits=64 build=40ff01a501d8e4b6"
    },
    {
      "cmd": "docker compose exec -T cache redis-cli GET orders",
      "output": "42"
    },
    {
      "comment": "cache container before: bccc4f6854c2, after: 56560bbefe60"
    },
    {
      "comment": "web container before: 424bff50a255, after: cac43380f0d1"
    }
  ]
}
```

The key survived because Redis keeps its data in `/data`, and `/data` is the named volume `cache-data`. Compose removed the old container, created a new one from the 7.4 image and mounted the same volume. The named volume is what makes this predictable. Data written outside any volume lives in the container's writable layer and goes away with the old container. [Docker data loss when a container exits](/posts/docker-data-loss-when-container-exits) explains the difference.

`web` was recreated as well. That was not because of `depends_on`: the test run had done a `--no-cache` build of `web` without the `up` that should follow it, so the new `shop-web` image waited for this `up`.

### Rolling back after an upgrade

After 7.4 had written its data, the run switched back to 7.2:

```terminal
{
  "title": "rollback to 7.2",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "sed -i 's/redis:7.4-alpine/redis:7.2-alpine/' compose.yaml"
    },
    {
      "cmd": "docker compose up -d --quiet-pull",
      "output": "Container shop-web-1 Running\nContainer shop-cache-1 Recreate\nContainer shop-cache-1 Recreated\nContainer shop-cache-1 Starting\nContainer shop-cache-1 Started"
    },
    {
      "cmd": "docker compose ps -a --format 'table {{.Service}}\\t{{.Image}}\\t{{.Status}}'",
      "output": "SERVICE   IMAGE              STATUS\ncache     redis:7.2-alpine   Exited (1) 3 seconds ago\nweb       shop-web           Up 5 seconds"
    },
    {
      "cmd": "docker compose logs cache 2>&1 | grep -iE 'rdb|fatal|error' | head -3",
      "output": "cache-1  | 1:M 12 Oct 2026 12:47:42.168 # Can't handle RDB format version 12\ncache-1  | 1:M 12 Oct 2026 12:47:42.168 # Fatal error loading the DB, check server logs. Exiting."
    },
    {
      "cmd": "sed -i 's/redis:7.2-alpine/redis:7.4-alpine/' compose.yaml"
    },
    {
      "cmd": "docker compose up -d",
      "output": "Container shop-web-1 Running\nContainer shop-cache-1 Recreate\nContainer shop-cache-1 Recreated\nContainer shop-cache-1 Starting\nContainer shop-cache-1 Started"
    },
    {
      "cmd": "docker compose exec -T cache redis-cli GET orders",
      "output": "42"
    }
  ]
}
```

Redis 7.2 cannot read the RDB file that 7.4 wrote, so the container exits at once. Going forward to 7.4 again worked, and the key was still there. Postgres is stricter: a data directory from one major version does not start on another major version in either direction.

:::warning
An image rollback is not a data rollback. Before you upgrade a stateful service that you might need to undo, take a backup the database supports, or stop the service and copy its volume.
:::

### The same tag with a newer image

Tags such as `latest`, `8` or `stable` move when the maintainer pushes a new image. `docker compose pull` downloads the new image, and `up -d` replaces the container only if the image is different. To show it without pushing to Docker Hub, the run re-points a local tag, `shop/cache:stable`, from Redis 7.4 to 8.0. That is what a pull does when it finds a new image:

```terminal
{
  "title": "same tag, new image",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "docker tag redis:7.4-alpine shop/cache:stable"
    },
    {
      "cmd": "sed -i 's#redis:7.4-alpine#shop/cache:stable#' compose.yaml"
    },
    {
      "cmd": "docker compose up -d",
      "output": "Container shop-web-1 Running\nContainer shop-cache-1 Recreate\nContainer shop-cache-1 Recreated\nContainer shop-cache-1 Starting\nContainer shop-cache-1 Started"
    },
    {
      "cmd": "docker compose exec -T cache redis-server --version",
      "output": "Redis server v=7.4.11 sha=00000000:0 malloc=jemalloc-5.3.0 bits=64 build=40ff01a501d8e4b6"
    },
    {
      "cmd": "docker pull -q redis:8.0-alpine",
      "output": "docker.io/library/redis:8.0-alpine"
    },
    {
      "cmd": "docker tag redis:8.0-alpine shop/cache:stable"
    },
    {
      "cmd": "docker compose exec -T cache redis-server --version",
      "output": "Redis server v=7.4.11 sha=00000000:0 malloc=jemalloc-5.3.0 bits=64 build=40ff01a501d8e4b6"
    },
    {
      "cmd": "docker compose up -d",
      "output": "Container shop-web-1 Running\nContainer shop-cache-1 Recreate\nContainer shop-cache-1 Recreated\nContainer shop-cache-1 Starting\nContainer shop-cache-1 Started"
    },
    {
      "cmd": "docker compose exec -T cache redis-server --version",
      "output": "Redis server v=8.0.6 sha=00000000:1 malloc=jemalloc-5.3.0 bits=64 build=43e27d09ac6c0bc2"
    },
    {
      "cmd": "docker compose exec -T cache redis-cli GET orders",
      "output": "42"
    }
  ]
}
```

The first `up -d` recreated `cache` because the image name in `compose.yaml` changed. After the tag moved to 8.0, the running container still ran 7.4 until the next `up -d`. Back on a real registry tag (one more recreate, because the name changed again), `pull` and `up -d` do nothing when the registry has no new image:

```terminal
{
  "title": "pull with no new image",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "sed -i 's#shop/cache:stable#redis:8.0-alpine#' compose.yaml"
    },
    {
      "cmd": "docker compose up -d",
      "output": "Container shop-web-1 Running\nContainer shop-cache-1 Recreate\nContainer shop-cache-1 Recreated\nContainer shop-cache-1 Starting\nContainer shop-cache-1 Started"
    },
    {
      "cmd": "docker compose pull cache",
      "output": "Image redis:8.0-alpine Pulling\nImage redis:8.0-alpine Pulled"
    },
    {
      "cmd": "docker compose up -d",
      "output": "Container shop-web-1 Running\nContainer shop-cache-1 Running"
    }
  ]
}
```

So `pull` alone never restarts anything. With unchanged config and running services, `pull` followed by `up -d` recreates nothing when the registry has no new image. When it does find one, the service restarts on the new version, so treat a scheduled pull like any other upgrade.

### Without Compose: plain docker run

For a container started with `docker run`, the same upgrade is pull, stop, remove, and run again with the same volume:

```terminal
{
  "title": "docker run upgrade",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "docker run -d --name cache-plain -v plain-data:/data redis:7.2-alpine",
      "output": "6e5c28d747c8ca098c8138bc171d7cb21ff918ff76ef3aa61f98dc9fa191f3e9"
    },
    {
      "cmd": "docker exec cache-plain redis-cli SET orders 42",
      "output": "OK"
    },
    {
      "cmd": "docker pull -q redis:7.4-alpine",
      "output": "docker.io/library/redis:7.4-alpine"
    },
    {
      "cmd": "docker stop cache-plain",
      "output": "cache-plain"
    },
    {
      "cmd": "docker rm cache-plain",
      "output": "cache-plain"
    },
    {
      "cmd": "docker run -d --name cache-plain -v plain-data:/data redis:7.4-alpine",
      "output": "1abc568dc85ae41113f0f8c5e6b67fe928c7490d31dfb219f75173c5a86780e2"
    },
    {
      "cmd": "docker exec cache-plain redis-server --version",
      "output": "Redis server v=7.4.11 sha=00000000:0 malloc=jemalloc-5.3.0 bits=64 build=40ff01a501d8e4b6"
    },
    {
      "cmd": "docker exec cache-plain redis-cli GET orders",
      "output": "42"
    }
  ]
}
```

You have to repeat every option from the original `docker run`: ports, environment, volumes, restart policy. Get one wrong and the new container behaves differently from the old one. That alone is a good reason to put even a single container in a `compose.yaml`. Old images stay on disk: `docker image prune` removes only untagged images, so remove an old version with `docker image rm redis:7.2-alpine`, or use `docker image prune -a` to remove every image that no container uses.

## How do I open an interactive shell in a Compose service?

For a running service:

```bash
docker compose exec web sh
```

The run used `-T` because a CI job has no terminal. Leave it out when you type the command yourself.

```terminal
{
  "title": "exec into a running service",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "docker compose exec -T web sh -c 'hostname; id -un; ls /app'",
      "output": "cac43380f0d1\nroot\napp.py"
    },
    {
      "cmd": "docker compose exec -T web bash",
      "output": "OCI runtime exec failed: exec failed: unable to start container process: exec: \"bash\": executable file not found in $PATH\n[exit 127]"
    }
  ]
}
```

Alpine-based images such as `python:3.13-alpine` have `sh` but no `bash`. If `bash` is not found, use `sh`.

### When the service is stopped

`exec` runs a command in an existing, running container, so it fails on a stopped service. `run` starts a new one-off container from the same service definition (same image, environment and volumes), and `--rm` removes it when you exit:

```terminal
{
  "title": "exec vs run on a stopped service",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "docker compose stop web",
      "output": "Container shop-web-1 Stopping\nContainer shop-web-1 Stopped"
    },
    {
      "cmd": "docker compose exec -T web sh",
      "output": "service \"web\" is not running\n[exit 1]"
    },
    {
      "cmd": "docker compose run --rm -T web sh -c 'echo new container: $(hostname); cat /app/app.py | head -2'",
      "output": "Container shop-cache-1 Running\nContainer shop-web-run-9168a2cd8c79 Creating\nContainer shop-web-run-9168a2cd8c79 Created\nnew container: f0932887561f\nimport http.server, os\nMSG = \"v2\""
    }
  ]
}
```

### When the service crashes on start

A container that exits at startup cannot be reached with `exec`. Start a one-off container with a shell as its entrypoint, and add `--no-deps` so that `run` does not start the dependencies too:

```terminal
{
  "title": "a service that crashes on start",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "sed -i 's/import http.server, os/import http.server, os, missing_module/' app.py"
    },
    {
      "cmd": "docker compose up -d --build web",
      "output": "(BuildKit progress lines trimmed)\nImage shop-web Building\n\nImage shop-web Built\nContainer shop-cache-1 Running\nContainer shop-web-1 Recreate\nContainer shop-web-1 Recreated\nContainer shop-web-1 Starting\nContainer shop-web-1 Started"
    },
    {
      "cmd": "docker compose ps -a --format 'table {{.Service}}\\t{{.Status}}'",
      "output": "SERVICE   STATUS\ncache     Up 31 seconds\nweb       Exited (1) 2 seconds ago"
    },
    {
      "cmd": "docker compose exec -T web sh",
      "output": "service \"web\" is not running\n[exit 1]"
    },
    {
      "cmd": "docker compose logs --tail 3 web",
      "output": "web-1  |   File \"/app/app.py\", line 1, in <module>\nweb-1  |     import http.server, os, missing_module\nweb-1  | ModuleNotFoundError: No module named 'missing_module'"
    },
    {
      "cmd": "docker compose run --rm -T --no-deps --entrypoint sh web -c 'head -1 /app/app.py'",
      "output": "Container shop-web-run-0c58bfce4547 Creating\nContainer shop-web-run-0c58bfce4547 Created\nimport http.server, os, missing_module"
    },
    {
      "cmd": "sed -i 's/, missing_module//' app.py"
    },
    {
      "cmd": "docker compose up -d --build web",
      "output": "(BuildKit progress lines trimmed)\nImage shop-web Building\n\nImage shop-web Built\nContainer shop-cache-1 Running\nContainer shop-web-1 Recreate\nContainer shop-web-1 Recreated\nContainer shop-web-1 Starting\nContainer shop-web-1 Started"
    }
  ]
}
```

The logs show the cause, and the shell lets you look at the files that the image actually contains. The last two commands fix the code and bring the service back. For a container that runs as a non-root user, `docker compose exec -u root web sh` opens a root shell. [How to access a Docker container's shell](/posts/how-to-access-docker-container-shell) covers the plain `docker exec` options.

## What down removes, and what it keeps

`docker compose down` removes the containers and the network. Volumes stay unless you add `-v`, and volumes marked `external` are never removed:

```terminal
{
  "title": "down vs down -v",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "docker compose down",
      "output": "Container shop-web-1 Stopping\nContainer shop-web-1 Stopped\nContainer shop-web-1 Removing\nContainer shop-web-1 Removed\nContainer shop-cache-1 Stopping\nContainer shop-cache-1 Stopped\nContainer shop-cache-1 Removing\nContainer shop-cache-1 Removed\nNetwork shop_default Removing\nNetwork shop_default Removed"
    },
    {
      "cmd": "docker volume ls --filter name=shop_cache-data --format '{{.Name}}'",
      "output": "shop_cache-data"
    },
    {
      "cmd": "docker compose up -d",
      "output": "Network shop_default Creating\nNetwork shop_default Creating\nNetwork shop_default Created\nNetwork shop_default Created\nContainer shop-cache-1 Creating\nContainer shop-cache-1 Created\nContainer shop-web-1 Creating\nContainer shop-web-1 Created\nContainer shop-cache-1 Starting\nContainer shop-cache-1 Started\nContainer shop-web-1 Starting\nContainer shop-web-1 Started"
    },
    {
      "cmd": "docker compose exec -T cache redis-cli GET orders",
      "output": "42"
    },
    {
      "cmd": "docker compose down -v",
      "output": "Container shop-web-1 Stopping\nContainer shop-web-1 Stopped\nContainer shop-web-1 Removing\nContainer shop-web-1 Removed\nContainer shop-cache-1 Stopping\nContainer shop-cache-1 Stopped\nContainer shop-cache-1 Removing\nContainer shop-cache-1 Removed\nVolume shop_cache-data Removing\nNetwork shop_default Removing\nVolume shop_cache-data Removed\nNetwork shop_default Removed"
    },
    {
      "cmd": "docker volume ls --filter name=shop_cache-data --format '{{.Name}}'"
    }
  ]
}
```

## Compose 2.38: when --build does not replace the container

The first run of the script used the Compose that ships on GitHub's `ubuntu-24.04` runner, version 2.38.2. Its output did not match this post: `up -d --build` built a new image and then reported the container as `Running`, still serving the old code. A focused check ran the same steps four ways: Compose 2.38.2 with its default bake builder (the build output starts with `load local bake definitions`), the same version with `COMPOSE_BAKE=false`, and Compose 5.6.0 with and without bake. Both 5.6.0 runs gave the same results.

| Step                        | 2.38.2, bake (default)            | 2.38.2, `COMPOSE_BAKE=false` | 5.6.0                |
| --------------------------- | --------------------------------- | ---------------------------- | -------------------- |
| `up -d`, nothing changed    | recreated                         | left running                 | left running         |
| edit code, `up -d --build`  | **kept old container, served v1** | recreated, served v2         | recreated, served v2 |
| edit again, `up -d --build` | recreated, served v3              | recreated, served v3         | recreated, served v3 |
| `up -d`, nothing changed    | recreated                         | left running                 | left running         |
| edit, `build`, then `up -d` | recreated, served v4              | recreated, served v4         | recreated, served v4 |

Compose decides whether to recreate by comparing the image recorded on the container (the `com.docker.compose.image` label) with the image the service should run. On 2.38.2 with bake, the labels in the check followed this sequence: the first container had an empty label, so the next `up` with nothing changed recreated it. The v2 build then left the v1 container running. The v3 build recreated the container, but wrote the v2 image ID into its label, so the next unchanged `up` recreated it again. Our reading, which the log is consistent with but cannot prove, is that Compose used the image ID from before the build, both for the comparison and for the label. The Compose issue tracker has reports of similar symptoms on releases we did not test: [#13944](https://github.com/docker/compose/issues/13944) on 5.3.1 (recreates with nothing changed) and [#14014](https://github.com/docker/compose/issues/14014) on 5.4.0 (`up --build` does not restart containers when the image ID changes).

This can make CI test old code when a job rebuilds an existing service after an edit. A fresh job's first `up` is fine, because there is no old container to keep. What to do:

- Run `docker compose version`. If it prints 2.38.2 and your builds start with `load local bake definitions`, upgrade the Compose plugin or set `COMPOSE_BAKE=false`. Both fixed it in our check.
- Or add `--force-recreate` to the rebuild: `docker compose up -d --build --force-recreate web`.
- After a deploy, check what is running instead of trusting the output. These two commands must print the same image ID:

```bash
docker inspect -f '{{.Image}}' "$(docker compose ps -q web)"
docker image inspect -f '{{.Id}}' shop-web
```

## Best practices

- Pick the command by what changed: code needs `--build`, config needs `up -d`, a stuck process needs `restart`.
- Keep state in named volumes, never in the container's writable layer.
- Pin the image tags you upgrade on purpose. A moving tag plus a scheduled `pull` and `up -d` means unplanned upgrades.
- Back up a stateful service before you upgrade it, because older versions often cannot read newer data.
- Check what runs after a deploy (a version endpoint, or the image ID comparison above), especially after a Compose update.

The script that produced every terminal block above, the Compose version check, and the full logs are here:

```github
The-DevOps-Daily/post-command-checks
```

## Related resources

- [Docker Compose: always recreate containers](/posts/docker-compose-always-recreate-containers)
- [How to force a clean Docker build](/posts/force-docker-clean-build)
- [Docker Compose environment variables](/posts/docker-compose-environment-variables)
- [Why a Docker container exits immediately](/posts/why-docker-container-exits-immediately)
- [Docker terminal simulator](/games/docker-terminal-simulator): practice the commands in the browser
- [Introduction to Docker](/guides/introduction-to-docker)
