---
title: 'Difference Between RUN, CMD and ENTRYPOINT in a Dockerfile'
excerpt: 'RUN executes at build time, CMD sets the default command, and ENTRYPOINT sets the program that always runs. See how the three combine, why a container exits at once, how to run cron, when ADD beats COPY, and how comments work in a Dockerfile.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-11-25'
publishedAt: '2024-11-25T09:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '14 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Dockerfile
  - ENTRYPOINT
  - Containers
  - DevOps
  - Tutorials
---

Three Dockerfile instructions decide what runs and when: `RUN`, `CMD` and `ENTRYPOINT`. They look alike, but `RUN` executes while Docker builds the image, and the other two only describe what happens when a container starts. Most "my container exits at once" and "my arguments are ignored" problems come from mixing them up.

This post explains each instruction, shows how `CMD` and `ENTRYPOINT` combine, and then answers the questions that come next: why a container exits immediately, how to run cron in a container, when to use `ADD` instead of `COPY`, and how comments work in a Dockerfile.

## TLDR

| Instruction  | Runs when       | Purpose                                     | Overridden by                       |
| ------------ | --------------- | ------------------------------------------- | ----------------------------------- |
| `RUN`        | Build time      | Install packages, compile, create files     | Nothing, the result is in the image |
| `CMD`        | Container start | Default command, or default arguments       | Arguments after the image name      |
| `ENTRYPOINT` | Container start | The program that always runs                | `docker run --entrypoint`           |
| `COPY`       | Build time      | Copy files from the build context           | Nothing                             |
| `ADD`        | Build time      | Like `COPY`, plus URLs, Git and `tar` files | Nothing                             |

A container runs as long as its main process runs. If that process ends or goes to the background, the container stops.

## Prerequisites

- Docker Engine 23 or later, or Docker Desktop. BuildKit is the default builder in both.
- Basic knowledge of `docker build` and `docker run`.

## What is `RUN`?

`RUN` executes a command while Docker builds the image. The result, for example installed packages, becomes a new layer of the image.

```dockerfile
FROM ubuntu:24.04

# Install curl, then delete the package lists in the same layer
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
```

- **Build-time execution**: the command runs during `docker build`, never when a container starts.
- **Layer creation**: each `RUN` creates a layer. BuildKit caches it, so the next build reuses it when the instruction and its inputs did not change.

Files that one `RUN` deletes are still in the layers of earlier instructions. That is why the cleanup above is in the same `RUN` as the install.

## What is `CMD`?

`CMD` sets the default command for containers that start from the image. It does not execute during the build.

```dockerfile
FROM node:24-slim
WORKDIR /app
COPY . .
# Default command when the container starts
CMD ["node", "app.js"]
```

Any command after the image name replaces `CMD` completely:

```bash
docker run my-app              # runs: node app.js
docker run my-app node -v      # runs: node -v
```

Use the exec form (`CMD ["node", "app.js"]`). The shell form (`CMD node app.js`) starts `/bin/sh -c "node app.js"`, so the shell is PID 1 and your app does not get the stop signal directly.

## Key Differences Between `RUN` and `CMD`

| Feature        | `RUN`                          | `CMD`                             |
| -------------- | ------------------------------ | --------------------------------- |
| Purpose        | Executes commands during build | Specifies default runtime command |
| Execution time | Build time                     | Container start                   |
| Layer creation | Creates a new image layer      | Only changes the image config     |
| Overridable    | No                             | Yes, at `docker run`              |
| How many count | Every `RUN` executes           | Only the last `CMD` counts        |

## Combining `RUN` and `CMD`

Most Dockerfiles use both: `RUN` to prepare the image and `CMD` to say what to start.

```dockerfile
FROM python:3.14-slim
WORKDIR /app
COPY requirements.txt .
# Build time: install dependencies
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Run time: start the app
CMD ["python", "app.py"]
```

## What Is the Difference Between CMD and ENTRYPOINT?

`ENTRYPOINT` sets the program that always runs. `CMD` gives it default arguments. Arguments after the image name replace `CMD` but not `ENTRYPOINT`:

```dockerfile
FROM alpine:3.24
ENTRYPOINT ["ping", "-c", "3"]
CMD ["localhost"]
```

```bash
docker run pinger                 # runs: ping -c 3 localhost
docker run pinger example.com     # runs: ping -c 3 example.com
docker run --entrypoint sh -it pinger   # replaces ENTRYPOINT, opens a shell
```

This table shows what Docker executes for each combination:

| Dockerfile                                  | `docker run image` | `docker run image x` |
| ------------------------------------------- | ------------------ | -------------------- |
| `CMD ["app", "--serve"]` only               | `app --serve`      | `x`                  |
| `ENTRYPOINT ["app"]` only                   | `app`              | `app x`              |
| `ENTRYPOINT ["app"]` and `CMD ["--serve"]`  | `app --serve`      | `app x`              |
| `ENTRYPOINT app` (shell form) and any `CMD` | `/bin/sh -c app`   | `/bin/sh -c app`     |

Three rules follow from the [Dockerfile reference](https://docs.docker.com/reference/dockerfile/#understand-how-cmd-and-entrypoint-interact):

- **Use the exec form for both.** The shell form of `ENTRYPOINT` ignores `CMD` and every argument you pass to `docker run`.
- **`ENTRYPOINT` resets an inherited `CMD`.** If the base image sets a `CMD` and your Dockerfile sets an `ENTRYPOINT`, the inherited `CMD` becomes empty. Set `CMD` again in your Dockerfile if you need default arguments.
- **Pick by intent.** Use `CMD` alone when users often run other commands in the image (a base image, a toolbox). Use `ENTRYPOINT` plus `CMD` when the image is one tool or one service.

For setup steps before the main process, use an entrypoint script that ends with `exec "$@"`. The script runs first, then `exec` replaces it with the `CMD`, so the app becomes PID 1:

```bash
#!/bin/sh
# docker-entrypoint.sh
set -e
# Setup steps go here, for example: wait for a file, render a config
exec "$@"
```

```dockerfile
COPY docker-entrypoint.sh /usr/local/bin/
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
```

The official `postgres` and `nginx` images use this pattern. `docker image inspect -f '{{json .Config.Entrypoint}} {{json .Config.Cmd}}' nginx:1.30` shows both values for any image.

## How Do You Run More Than One Command When a Container Starts?

`CMD` starts one process. To run a setup step first, wrap the commands in a shell, and start the long-running process with `exec`:

```dockerfile
FROM nginx:1.30
# exec replaces the shell, so nginx becomes PID 1 and gets the stop signal
CMD ["sh", "-c", "echo setup done && exec nginx -g 'daemon off;'"]
```

Without `exec`, the shell stays PID 1 and nginx runs as its child. `docker stop` sends SIGTERM to PID 1, the shell does not pass it on, and after 10 seconds Docker kills everything with SIGKILL. We built the image twice, as `sh-exec` with `exec` and `sh-plain` without it, and looked at PID 1 in each container:

```terminal
{
  "title": "the same CMD, with and without exec",
  "prompt": "$",
  "steps": [
    {
      "cmd": "docker exec sh-plain cat /proc/1/cmdline | tr '\\0' ' '",
      "output": "sh -c echo setup done && nginx -g 'daemon off;'"
    },
    {
      "cmd": "docker exec sh-exec cat /proc/1/cmdline | tr '\\0' ' '",
      "output": "nginx: master process nginx -g daemon off;"
    }
  ]
}
```

Then we timed `docker stop` on each one. `sh-plain` took 10 seconds and exited with code 137, which means it was killed and nginx never shut down cleanly. `sh-exec` stopped at once with exit code 0. In Compose, `command:` replaces the image's `CMD` and follows the same rule: `command: sh -c "echo warming cache && exec python -m http.server 8000"`.

Two cases need more than a shell line:

- **One-off steps, such as database migrations.** Put them in a separate service that runs and exits, and make the app wait for it with `depends_on: { migrate: { condition: service_completed_successfully } }`. The app then starts only if the migration exited with code 0. [Dockerfile vs Compose file](/posts/how-docker-works-under-the-hood#h2-dockerfile-vs-compose-file-which-does-what) shows the full file.
- **Two long-running processes**, such as a web server and a queue worker. Run them as two containers from the same image with different commands. A process manager such as supervisord inside one container works, but then Docker sees one process and cannot restart or scale the two parts on their own.

For longer setup logic, use the entrypoint script from [the section above](#h2-what-is-the-difference-between-cmd-and-entrypoint).

## Why Does My Docker Container Exit Immediately?

Because its main process ended. A container lives exactly as long as the process that `ENTRYPOINT` and `CMD` start. Read the exit code and the logs first:

```bash
docker ps -a --filter name=myapp        # STATUS shows "Exited (code) ..."
docker logs myapp                       # what the process printed
docker inspect -f '{{.State.ExitCode}} OOMKilled={{.State.OOMKilled}}' myapp
```

| Exit code | Meaning                                                              |
| --------- | -------------------------------------------------------------------- |
| 0         | The command finished normally. Nothing kept it running               |
| 1         | The app failed. `docker logs` shows its error                        |
| 125       | `docker run` itself failed, for example a bad flag                   |
| 126       | The command exists but cannot be executed (permissions)              |
| 127       | The command was not found                                            |
| 137       | Killed with SIGKILL: `docker kill`, a stop timeout, or out of memory |
| 143       | Stopped with SIGTERM                                                 |

The common causes:

- **The service went to the background.** `CMD ["nginx"]` starts nginx as a daemon, the first process exits, and the container stops with code 0. Keep services in the foreground: `nginx -g 'daemon off;'`, `apachectl -D FOREGROUND`, `redis-server`, `postgres`.
- **The command is a script that finishes.** A setup script must end with `exec` of the real program, as in the entrypoint script above.
- **A shell image with no terminal.** `docker run ubuntu` starts `bash`, which reads an empty input and exits. Run it interactively with `docker run -it ubuntu bash`.
- **The file is missing or not executable.** Docker prints `exec: "/app/start.sh": stat /app/start.sh: no such file or directory` (exit code 127), or a permission error (126). Add `RUN chmod +x /app/start.sh`, or `COPY --chmod=755`.
- **The script has Windows line endings.** The log says `exec /app/start.sh: no such file or directory` although the file exists: the kernel looks for an interpreter called `/bin/sh\r`. Convert the file with `dos2unix` or set `* text=auto eol=lf` in `.gitattributes`.
- **The image is for another CPU.** `exec format error` means, for example, an `amd64` image on an `arm64` host. Build for the right platform with `docker buildx build --platform linux/arm64`.

To look around in an image whose command fails, start a shell instead of the command: `docker run --rm -it --entrypoint sh myapp`. [How to access a container's shell](/posts/how-to-access-docker-container-shell) covers this and stopped containers. To keep a debug container alive on purpose, use `CMD ["sleep", "infinity"]`, never in production.

## How Do I Run a Cron Job Inside a Docker Container?

Run the cron daemon in the foreground as the main process. On Debian and Ubuntu that is `cron -f`:

```dockerfile
FROM ubuntu:24.04
RUN apt-get update \
    && apt-get install -y --no-install-recommends cron curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Files in /etc/cron.d have a user field ("root") and need a final newline
COPY backup-cron /etc/cron.d/backup-cron
RUN chmod 0644 /etc/cron.d/backup-cron

# -f keeps cron in the foreground, so it is PID 1
CMD ["cron", "-f"]
```

```text
# backup-cron: every day at 02:30, output goes to the container log
30 2 * * * root /usr/local/bin/backup.sh > /proc/1/fd/1 2>&1
```

Things that break cron in a container:

- **The file name.** Debian's cron skips files in `/etc/cron.d` whose names contain a dot, so `backup.cron` never runs. Use letters, digits, `-` and `_` only.
- **The environment.** Cron starts jobs with a minimal environment. Variables you pass with `docker run -e` are not visible to the job. Set them in the script or in the cron file.
- **The logs.** Write job output to `/proc/1/fd/1`, as above, so `docker logs` shows it.
- **Background start.** `service cron start` puts cron in the background, so the container exits at once.

[supercronic](https://github.com/aptible/supercronic) is a cron made for containers: it runs in the foreground, logs to stdout and passes the container environment to the jobs. Often the simpler option is no cron in the container at all: let the host's cron or a systemd timer run `docker run --rm myimage backup.sh`, or use a [Kubernetes CronJob](/guides/introduction-to-kubernetes). Check a schedule with the [cron expression simulator](/games/cron-expression-simulator) before you deploy it.

## What Is the Difference Between COPY and ADD?

Both copy files into the image. `COPY` copies files from the build context and does nothing else. `ADD` can also:

- **Extract a local `tar` archive.** A local archive that is uncompressed or in `gzip`, `bzip2`, `xz` or `zstd` format is unpacked into the destination. Docker detects the format from the content, not the file name. A `.zip` file is copied as it is, not extracted.
- **Download a URL.** `ADD https://example.com/tool.tar.gz /opt/` downloads the file. A remote archive is not extracted unless you add `--unpack=true` (Dockerfile syntax 1.17 and later).
- **Check a download.** `ADD --checksum=sha256:<hash> <url> <dest>` fails the build when the file does not match.
- **Clone a Git repository.** `ADD https://github.com/moby/buildkit.git#v0.26.2 /buildkit` adds the files of that ref, and `--checksum` can pin the commit.

```dockerfile
# Plain files: always COPY
COPY package.json package-lock.json ./
COPY --chown=node:node src/ ./src/
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/

# A local archive that you want unpacked: ADD
ADD vendor-libs.tar.gz /opt/vendor/

# A pinned download that the build verifies (the example from the Dockerfile reference)
ADD --checksum=sha256:24454f830cdb571e2c4ad15481119c43b3cafd48dd869a9b2945d1036d1dc68d \
    https://mirrors.edge.kernel.org/pub/linux/kernel/Historic/linux-0.01.tar.gz /
```

Use `COPY` unless you need one of the `ADD` features. Its behavior is easy to predict, and the Docker best-practices guide recommends it. Two details that people often get wrong:

- **Directories copy their contents.** `COPY src /app/` and `COPY src/ /app/` do the same thing: they copy what is inside `src` into `/app`. To keep the directory name, write it in the destination: `COPY src /app/src/`.
- **Only the build context is visible.** `COPY ../shared /app/` fails, because files outside the context are not sent to the builder. [Use files outside the build context](/posts/force-docker-clean-build#h2-how-do-i-include-files-outside-the-docker-build-context) shows the fixes.

To leave files out of a `COPY . .`, use a `.dockerignore` file, as [COPY with exclusion](/posts/copy-with-docker-exclusion) explains.

## How Do I Write a Comment in a Dockerfile?

Start the line with `#`. Docker removes comment lines before it executes the instructions. A `#` in the middle of a line is not a comment: it is part of the instruction's arguments.

```dockerfile
# syntax=docker/dockerfile:1
# The line above is a parser directive, not a comment. It must be first.
FROM python:3.14-slim

# A comment line inside a multi-line RUN is removed before the shell sees it
RUN apt-get update \
# install the client only
    && apt-get install -y --no-install-recommends postgresql-client \
    && rm -rf /var/lib/apt/lists/*
```

- **Parser directives** look like comments: `# syntax=`, `# escape=` and `# check=`. They only work at the very top of the file, before any instruction, comment or empty line. Lower down they are plain comments.
- **A `#` after an instruction is an argument.** In `RUN make # build`, the shell gets the whole text and treats `# build` as a shell comment, so it works. In `COPY app.py /app/ # copy the app`, Docker reads `#`, `copy`, `the` and `app` as more paths, and the build fails. Put the comment on its own line.
- **What to write.** Explain why a line exists, such as a pinned version or a workaround, not what the instruction does.

## Best Practices

- **Use the exec form** for `CMD` and `ENTRYPOINT`, so the app is PID 1 and gets SIGTERM.
- **Keep the main process in the foreground.** A container is one long-running process, not a small server that boots.
- **Combine install and cleanup in one `RUN`**, so deleted files never reach a layer.
- **Prefer `COPY` over `ADD`**, and pin any download with `--checksum`.
- **Keep secrets out of all of these instructions.** `RUN`, `ENV` and `ARG` values are visible in the image history. Use [build secrets](/posts/force-docker-clean-build#h2-how-do-i-use-ssh-keys-or-secrets-in-a-docker-build) instead.

## Related Resources

- [Docker Image Optimization](/posts/docker-image-optimization-best-practices): build smaller, faster images
- [How to force a clean Docker build](/posts/force-docker-clean-build): cache, build context and failed builds
- [Environment variables in Docker and Compose](/posts/docker-compose-environment-variables): `ENV`, `ARG` and `PATH`
- [5 Advanced Docker Features Worth Knowing](/posts/advanced-docker-features): multi-stage builds, BuildKit, and more
- [Introduction to Docker: Building Custom Images](/guides/introduction-to-docker/05-building-custom-docker-images): the full Dockerfile chapter
- [Docker multi-stage build exercise](/exercises/docker-multi-stage-build): practice on a real app
- [Docker terminal simulator](/games/docker-terminal-simulator): try `docker run` and `--entrypoint` in the browser
- [Docker quiz](/quizzes/docker-quiz) and [Docker flashcards](/flashcards/docker-essentials): check what you remember
