---
title: 'How to Write a Dockerfile and Build a Docker Image'
description: 'Write a Dockerfile for a Python API, build it with BuildKit, order layers for caching, lint with hadolint, and use multi-stage builds and a non-root user.'
order: 5
---

Official images get you a web server or a database. For your own application, you write a **Dockerfile**: a text file with the steps that turn your source code into an image. In this part you containerize a small Python web API, starting with the Dockerfile most tutorials show and fixing it step by step until it builds fast, runs as a non-root user and ships only what it needs.

The same app, called **hello-api**, runs through the rest of the guide: it gets a Postgres database in [Part 6](/guides/introduction-to-docker/06-working-with-docker-volumes) and [Part 7](/guides/introduction-to-docker/07-networking-in-docker), a `compose.yaml` in [Part 8](/guides/introduction-to-docker/08-docker-compose), hardening in [Part 9](/guides/introduction-to-docker/09-docker-best-practices) and a CI pipeline in [Part 10](/guides/introduction-to-docker/10-docker-in-production).

## Prerequisites

- Docker Engine 23 or newer, or Docker Desktop, so that `docker build` uses BuildKit ([Part 2](/guides/introduction-to-docker/02-docker-installation)).
- Basic Python is helpful but not required; the app is about 65 lines.

## The Example App

Create a project directory with two files. `app.py` is a [Flask](https://flask.palletsprojects.com/) API with four routes: a greeting, a liveness check, a readiness check that needs the database, and a visit counter stored in Postgres:

```python
import os
import socket

import psycopg
from flask import Flask, jsonify

app = Flask(__name__)


def conninfo():
    # Read the password from a file when one is mounted (Docker secrets), else from the environment
    password = os.environ.get("DB_PASSWORD", "")
    password_file = os.environ.get("DB_PASSWORD_FILE")
    if password_file:
        with open(password_file) as f:
            password = f.read().strip()
    return psycopg.conninfo.make_conninfo(
        host=os.environ.get("DB_HOST", "db"),
        port=os.environ.get("DB_PORT", "5432"),
        dbname=os.environ.get("DB_NAME", "hello"),
        user=os.environ.get("DB_USER", "hello"),
        password=password,
        connect_timeout=3,
    )


@app.get("/")
def index():
    return jsonify(message="Hello from Docker", hostname=socket.gethostname())


@app.get("/health")
def health():
    # Liveness: the process answers. Used by the Dockerfile HEALTHCHECK.
    return jsonify(status="ok")


@app.get("/ready")
def ready():
    # Readiness: the database answers too.
    try:
        with psycopg.connect(conninfo()) as conn:
            conn.execute("SELECT 1")
    except psycopg.Error:
        return jsonify(status="database unavailable"), 503
    return jsonify(status="ready")


@app.get("/visits")
def visits():
    try:
        with psycopg.connect(conninfo()) as conn:
            if conn.execute("SELECT to_regclass('visits')").fetchone()[0] is None:
                # First visit: create the table, one worker at a time
                conn.execute("SELECT pg_advisory_xact_lock(4242)")
                conn.execute(
                    "CREATE TABLE IF NOT EXISTS visits ("
                    " id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,"
                    " visited_at timestamptz NOT NULL DEFAULT now())"
                )
            conn.execute("INSERT INTO visits DEFAULT VALUES")
            count = conn.execute("SELECT count(*) FROM visits").fetchone()[0]
    except psycopg.Error:
        return jsonify(error="database unavailable"), 503
    return jsonify(visits=count)
```

`requirements.txt` pins the three dependencies: Flask, the gunicorn web server and the psycopg Postgres driver:

```text
flask==3.1.3
gunicorn==26.2.0
psycopg[binary]==3.3.6
```

The first visit creates the `visits` table. Two gunicorn workers (and later several containers) can get their first request at the same moment, and `CREATE TABLE IF NOT EXISTS` is not safe against that race in PostgreSQL, so the app takes a transaction-level advisory lock while it creates the table. Real applications create their tables with a migration tool before they start serving.

The app reads its database settings from environment variables, so the same image works on a laptop, in CI and in production. That is the main rule for containerized apps: configuration comes from the environment, not from files baked into the image.

## A First Dockerfile

This is the Dockerfile you find in many tutorials. It works, but it has problems:

```dockerfile
FROM python:3.14
WORKDIR /app
COPY . .
RUN pip install -r requirements.txt
EXPOSE 8000
CMD gunicorn --bind 0.0.0.0:8000 app:app
```

**hadolint** is a Dockerfile linter that checks for these problems before you build. This is its real output for the file above:

```terminal
{
  "title": "hadolint 2.15.1 on the first Dockerfile (real run)",
  "prompt": "$",
  "steps": [
    {
      "cmd": "hadolint Dockerfile",
      "output": "Dockerfile:4 DL3042 warning: Avoid use of cache directory with pip. Use `pip install --no-cache-dir <package>`\nDockerfile:6 DL3025 warning: Use arguments JSON notation for CMD and ENTRYPOINT arguments"
    }
  ]
}
```

hadolint catches two of the problems. Here is the full list:

1. **The base image is the full `python:3.14`**, 1.14 GB unpacked, with compilers the app never uses ([Part 3](/guides/introduction-to-docker/03-working-with-docker-images) has the numbers).
2. **`COPY . .` comes before `pip install`.** Every code change invalidates the layer cache, so every build reinstalls all dependencies.
3. **pip keeps its download cache in the image**, which adds megabytes for nothing (hadolint DL3042).
4. **The shell form of `CMD`** runs `/bin/sh -c "gunicorn ..."`. The shell becomes process 1 and does not pass `SIGTERM` to gunicorn, so `docker stop` waits 10 seconds and then kills it in the middle of requests (hadolint DL3025).
5. **It runs as root.** A bug in the app gives an attacker root inside the container.
6. **Without a `.dockerignore` file**, `COPY . .` copies everything in the directory into the image: your `.git` directory, local virtual environments, and any `.env` file with secrets.

## How a Build Works

`docker build` sends the **build context** (the directory you name, usually `.`) to BuildKit, which runs the Dockerfile instructions in order:

- `FROM` picks the base image, whose layers become the bottom of yours.
- `RUN`, `COPY` and `ADD` change files and create new layers. `WORKDIR` creates its directory if it does not exist.
- `ENV`, `USER`, `EXPOSE`, `CMD`, `ENTRYPOINT`, `HEALTHCHECK` and `LABEL` change only the image config.

BuildKit caches every step. For each instruction it checks whether it has run the same instruction on the same parent before, and for `COPY` and `ADD` whether the copied files changed. The first step that misses the cache is rebuilt, and so is **every step after it**. That is why the order of instructions matters so much: put what changes rarely (the base image, system packages, dependencies) at the top, and what changes on every commit (your code) at the bottom.

## Add a .dockerignore File

`.dockerignore` lists files that never enter the build context. It makes builds faster and keeps secrets and junk out of the image:

```text
# Version control and editor files
.git
.gitignore
.vscode/
# Python caches and local virtual environments
__pycache__/
*.pyc
.venv/
# Secrets and local settings: never send these to the builder
.env
secrets/
# Docker files are not needed inside the image
Dockerfile
.dockerignore
compose*.yaml
```

The syntax is like `.gitignore`. A line that starts with `!` adds an exception. If the build context is large, the build output says so in its first lines (`transferring context`); that is the moment to check this file.

## A Better Dockerfile

This version fixes the problems:

```dockerfile
# syntax=docker/dockerfile:1
FROM python:3.14-slim

# No .pyc files in the image, and log lines appear immediately
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Dependencies first: this layer is rebuilt only when requirements.txt changes
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Then the code, which changes on every commit
COPY app.py .

# An unprivileged system user without a home directory
RUN useradd --system --uid 10001 --no-create-home app
# Switch by UID, so the host and Kubernetes can verify it is not root
USER 10001

EXPOSE 8000
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "2", "--worker-tmp-dir", "/dev/shm", "--no-control-socket", "app:app"]
```

```terminal
{
  "title": "hadolint on the better Dockerfile (real run)",
  "prompt": "$",
  "steps": [
    {
      "cmd": "hadolint Dockerfile && echo \"no findings\"",
      "output": "no findings"
    }
  ]
}
```

What changed, line by line:

- **`# syntax=docker/dockerfile:1`** tells BuildKit to use the latest stable 1.x Dockerfile syntax, which it downloads at build time. You get new Dockerfile features without upgrading Docker.
- **`python:3.14-slim`** instead of the full image.
- **`ENV`** sets two Python options. `PYTHONUNBUFFERED=1` matters in containers: without it, Python buffers stdout and `docker logs` shows lines late or not at all.
- **`COPY requirements.txt` before `COPY app.py`** keeps the dependency layer cached when only the code changes.
- **`--no-cache-dir`** keeps pip's cache out of the image.
- **`useradd` and `USER 10001`** run the app as an unprivileged user. `COPY` creates files owned by root unless you pass `--chown`, so the app can read its code but cannot change it. Use the numeric UID in `USER`: a name like `app` exists only inside the image, so the host and tools such as Kubernetes' `runAsNonRoot` cannot check that it is not root. hadolint 2.15 reports the name form as DL3066.
- **The exec form of `CMD`** (a JSON array) runs gunicorn directly as process 1, so it receives `SIGTERM` from `docker stop` and shuts down cleanly.
- **The gunicorn flags**: `--worker-tmp-dir /dev/shm` keeps gunicorn's worker heartbeat files in memory instead of on the container's overlay filesystem, and `--no-control-socket` turns off the control socket that gunicorn 26 creates in the user's home directory. The `app` user has no home directory, and without this flag gunicorn logs `Control server error: [Errno 13] Permission denied` at startup (it keeps serving, but the error is noise).

### CMD vs ENTRYPOINT

Both define what runs when the container starts:

- **`CMD`** is the default command. Arguments to `docker run IMAGE ...` replace it completely: `docker run hello-api:1.0 python -c 'print(1)'` runs Python instead of gunicorn.
- **`ENTRYPOINT`** is the fixed executable. Arguments to `docker run` are appended to it, and `CMD` provides default arguments.

```dockerfile
FROM hello-api:1.0
ENTRYPOINT ["gunicorn", "app:app"]
CMD ["--bind", "0.0.0.0:8000", "--workers", "2"]
# docker run IMAGE --workers 4  ->  gunicorn app:app --workers 4
```

Use `CMD` alone for applications, and `ENTRYPOINT` when the image is a tool (like `hadolint` or `crane`) or when an entrypoint script must prepare something before the main process, as in the nginx and postgres images. An entrypoint script should end with `exec "$@"` so that the main process replaces the script as process 1.

### COPY vs ADD, ARG vs ENV

- **`COPY`** copies files from the build context. Use it by default.
- **`ADD`** can also download URLs and unpack local tar archives. Use it when you want that, with `--checksum=sha256:...` for downloads, so a changed file fails the build.
- **`ARG`** is a variable that exists only during the build (`docker build --build-arg VERSION=1.2 .`).
- **`ENV`** is set during the build **and** in every container from the image.

Never pass secrets through `ARG` or `ENV`: their values end up in the image history or config, where anyone who pulls the image can read them. Use a secret mount instead, shown below.

## Build and Run

Build the image and give it a name and tag with `-t`:

```bash
docker build -t hello-api:1.0 .
```

BuildKit prints one line per step and the time each step took. Example output of a first build, cut in the middle:

```text
[+] Building 21.4s (12/12) FINISHED                                    docker:default
 => [internal] load build definition from Dockerfile                             0.0s
 => => transferring dockerfile: 733B                                             0.0s
 => resolve image config for docker-image://docker.io/docker/dockerfile:1        1.2s
 => [internal] load metadata for docker.io/library/python:3.14-slim              0.9s
 => [internal] load .dockerignore                                                0.0s
 => => transferring context: 295B                                                0.0s
 => [1/6] FROM docker.io/library/python:3.14-slim@sha256:0514bc76712d64f8bb48a  3.1s
 ...
 => [3/6] COPY requirements.txt .                                                0.0s
 => [4/6] RUN pip install --no-cache-dir -r requirements.txt                     9.8s
 => [5/6] COPY app.py .                                                          0.0s
 => [6/6] RUN useradd --system --uid 10001 --no-create-home app                  0.4s
 => exporting to image                                                           1.6s
 => => naming to docker.io/library/hello-api:1.0                                 0.0s
```

Run it. The app has no database yet, so only the routes that do not need one work:

```bash
docker run -d --name hello-api -p 8000:8000 hello-api:1.0
curl -s localhost:8000/
curl -s localhost:8000/health
curl -s -w ' %{http_code}\n' localhost:8000/visits
```

Example output:

```text
{"hostname":"6e0b3a1f9d42","message":"Hello from Docker"}
{"status":"ok"}
{"error":"database unavailable"}
 503
```

Flask ends each JSON response with a newline, so curl prints the status code from `-w` on the next line.

The `hostname` is the container ID, which shows which container answered (useful when you run several copies in Part 8). `docker logs hello-api` shows gunicorn starting as process 1 (example output in gunicorn 26's format):

```text
[2026-10-23 20:52:10 +0000] [1] [INFO] Starting gunicorn 26.2.0
[2026-10-23 20:52:10 +0000] [1] [INFO] Listening at: http://0.0.0.0:8000 (1)
[2026-10-23 20:52:10 +0000] [1] [INFO] Using worker: sync
[2026-10-23 20:52:10 +0000] [7] [INFO] Booting worker with pid: 7
[2026-10-23 20:52:10 +0000] [8] [INFO] Booting worker with pid: 8
```

When you stop the container, the log ends with `Handling signal: term` and `Shutting down: Master` within a second, instead of after the 10-second timeout. That is the exec form of `CMD` at work. Remove the container before you continue:

```bash
docker rm -f hello-api
```

### Rebuilds Use the Cache

Change a line in `app.py` and build again. Only the `COPY app.py` step and the steps after it run; example output, cut:

```text
 => CACHED [2/6] WORKDIR /app                                                    0.0s
 => CACHED [3/6] COPY requirements.txt .                                         0.0s
 => CACHED [4/6] RUN pip install --no-cache-dir -r requirements.txt              0.0s
 => [5/6] COPY app.py .                                                          0.0s
 => [6/6] RUN useradd --system --uid 10001 --no-create-home app                  0.3s
```

The `useradd` step runs again because it comes after the changed `COPY`. Move steps that never change, like creating the user, above the first `COPY` of your code. The final Dockerfile below does that. To force a full rebuild, use `docker build --no-cache`; add `--pull` to also fetch a newer base image.

## Multi-Stage Builds

A **multi-stage build** uses several `FROM` instructions. Each starts a new stage, and the final image contains only the last stage plus whatever you copy into it with `COPY --from`. Build tools, caches and intermediate files stay behind.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Stage build", "sub": "python:3.14-slim + venv + pip install", "icon": "gear", "tone": "slate" },
    { "label": "COPY --from=build", "sub": "only /opt/venv", "icon": "box", "tone": "accent" },
    { "label": "Final image", "sub": "slim + venv + app.py, user app", "icon": "rocket", "tone": "green" }
  ]
}
```

This is the Dockerfile the rest of the guide uses. It installs the dependencies into a virtual environment in a `build` stage and copies only that environment into the final stage. It also caches pip downloads between builds and adds a health check:

```dockerfile
# syntax=docker/dockerfile:1

# Stage 1: install the dependencies into a virtual environment
FROM python:3.14-slim AS build
WORKDIR /build
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY requirements.txt .
# Keep pip's download cache between builds, outside the image
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt

# Stage 2: the image you ship
FROM python:3.14-slim
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
RUN useradd --system --uid 10001 --no-create-home app
WORKDIR /app
COPY --from=build /opt/venv /opt/venv
COPY app.py .
USER 10001
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2)"]
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "2", "--worker-tmp-dir", "/dev/shm", "--no-control-socket", "app:app"]
```

```terminal
{
  "title": "hadolint on the multi-stage Dockerfile (real run)",
  "prompt": "$",
  "steps": [
    {
      "cmd": "hadolint Dockerfile && echo \"no findings\"",
      "output": "no findings"
    }
  ]
}
```

- **`RUN --mount=type=cache`** mounts a directory that BuildKit keeps between builds but never puts in the image. pip finds its downloads there when `requirements.txt` changes, so you do not need `--no-cache-dir` in this stage. Cache mounts live in the builder, so a fresh CI runner starts with an empty cache ([Part 10](/guides/introduction-to-docker/10-docker-in-production) covers CI caching).
- **The virtual environment** gives the app its own `site-packages` that `COPY --from=build` can move as one directory. Both stages use the same base image, so the venv's links to `/usr/local/bin/python3.14` stay valid.
- **`HEALTHCHECK`** calls `/health` with Python's standard library, because the slim image has no `curl` ([Part 4](/guides/introduction-to-docker/04-creating-your-first-container) showed which tools each image ships). `/health` does not touch the database, so the container stays healthy when Postgres restarts; the `/ready` route is the one that checks the database.

Build it with the same command as before, `docker build -t hello-api:1.0 .`. Parts 6 to 8 use this image.

For this app the gain from two stages is modest, because `psycopg[binary]` ships compiled wheels and nothing needs a compiler. The pattern pays off when you compile code: a Go or Rust binary, a frontend bundle built with Node.js, or Python packages with C extensions that need `gcc`. The build stage then has the toolchain, and the final image has only the result. The [multi-stage build exercise](/exercises/docker-multi-stage-build) practices this with a larger example.

### Other BuildKit Features Worth Knowing

- **Secret mounts** pass a secret to one `RUN` step without storing it in any layer:

  ```dockerfile
  # syntax=docker/dockerfile:1
  FROM python:3.14-slim
  COPY requirements.txt .
  # The token exists only while this step runs, as the environment variable PIP_INDEX_TOKEN
  RUN --mount=type=secret,id=pip_token,env=PIP_INDEX_TOKEN \
      pip install --no-cache-dir --index-url "https://__token__:${PIP_INDEX_TOKEN}@pypi.example.com/simple" -r requirements.txt
  ```

  Build it with `docker build --secret id=pip_token,env=PIP_INDEX_TOKEN .`. The `env=` option of the mount needs Dockerfile syntax 1.10 or newer, which `docker/dockerfile:1` gives you.

- **`COPY --link`** copies files into an independent layer that does not depend on the layers below it. When the base image changes, BuildKit can reuse that layer instead of copying again. It is safe when you do not rely on symlinks in the destination path.
- **`COPY --exclude=*.md`** and **`COPY --parents`** filter what you copy and keep directory structure.
- **Build checks**: `docker build --check .` runs BuildKit's own Dockerfile rules (such as `JSONArgsRecommended` for the shell-form `CMD` above) without building. It needs a BuildKit builder, so it does not work without a running daemon; hadolint does.
- **Multi-platform builds**: `docker buildx build --platform linux/amd64,linux/arm64 -t ghcr.io/my-org/hello-api:1.0 --push .` builds one image for both architectures and pushes the image index ([Part 10](/guides/introduction-to-docker/10-docker-in-production)).

## Tag and Push the Image

To use the image on another machine, push it to a registry. Tag it with the registry's name, log in and push. For GitHub Container Registry:

```bash
docker tag hello-api:1.0 ghcr.io/my-org/hello-api:1.0
echo "$GITHUB_TOKEN" | docker login ghcr.io -u my-user --password-stdin
docker push ghcr.io/my-org/hello-api:1.0
```

`--password-stdin` keeps the token out of your shell history and the process list. The push prints the digest of what it uploaded (`1.0: digest: sha256:...`). Record it: that digest identifies exactly this image, even if someone pushes a new `1.0` later.

Tag every build with something unique, such as the version (`1.0.3`) or the Git commit (`git-3f9c2ab`). Moving tags like `latest` or `1.0` are fine as extra names, but deploy by the unique tag or the digest ([Part 10](/guides/introduction-to-docker/10-docker-in-production)).

## Generate a Starting Point with docker init

Docker Desktop includes `docker init`, which asks a few questions about your project (Python, Node, Go, Java, Rust, PHP, ASP.NET Core) and writes a `Dockerfile`, a `.dockerignore`, a `compose.yaml` and a `README.Docker.md`. The result follows most of the practices in this part, so it is a quick start for a new project. Read what it generates before you commit it: it does not know your app's real start command or health endpoint. On Docker Engine without Docker Desktop, the command is not available.

## Common Mistakes

- **`COPY . .` at the top.** Every change rebuilds everything. Copy dependency manifests first.
- **`apt-get update` in its own `RUN`.** The cached layer keeps an old package index, and a later `apt-get install` fails or installs old versions. Always run `apt-get update && apt-get install -y --no-install-recommends ... && rm -rf /var/lib/apt/lists/*` in one `RUN`.
- **Secrets in `ARG`, `ENV` or copied files.** They stay in the image. Use secret mounts at build time and environment variables or secrets at run time.
- **Shell-form `CMD` or `ENTRYPOINT`.** The app never receives `SIGTERM`. Use the JSON form, or `exec` in entrypoint scripts.
- **Running as root.** Add a user and switch to it with `USER`.
- **Huge images.** Use a slim base and multi-stage builds, and check the size with `docker image ls`.

## Summary

- A Dockerfile builds an image step by step, and BuildKit caches every step until the first one that changed.
- Order instructions from least to most frequently changed, and keep the build context small with `.dockerignore`.
- Use a slim base, the exec form of `CMD`, a non-root `USER` and a `HEALTHCHECK`.
- Multi-stage builds keep build tools out of the final image; cache and secret mounts speed up builds without leaking into layers.
- Lint Dockerfiles with hadolint in CI.

The app needs a database. Next, give Postgres storage that survives container restarts in [Docker Volumes and Bind Mounts](/guides/introduction-to-docker/06-working-with-docker-volumes).

## Keep Learning

- [Understanding the Difference Between CMD and ENTRYPOINT in Dockerfiles](/posts/difference-between-cmd-and-entrypoint-in-dockerfiles)
- [Understanding the Difference Between COPY and ADD in Dockerfiles](/posts/dockerfile-copy-vs-add-commands)
- [How to Force Docker for a Clean Build of an Image](/posts/force-docker-clean-build)
- [How Can I Inspect the File System of a Failed Docker Build?](/posts/inspect-filesystem-of-failed-docker-build)
- Exercise: [Docker Multi-Stage Build Optimization](/exercises/docker-multi-stage-build)
- Interview question: [Dockerfile best practices](/interview-questions/junior/dockerfile-best-practices)
