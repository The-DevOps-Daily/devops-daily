---
title: 'How to Force a Clean Docker Build and Fix Common Build Errors'
excerpt: 'Rebuild without the cache, fix "docker build requires 1 argument", use files from outside the build context, look inside a build that failed, and give a build SSH keys or secrets without baking them into the image.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-10-25'
publishedAt: '2024-10-25T09:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '13 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Docker Build
  - BuildKit
  - Dockerfile
  - Troubleshooting
  - DevOps
---

`docker build` is fast because it caches every step, and most build problems come from the same place: the cache keeps a step you wanted to run again, the build context does not contain a file you need, or a step fails inside the builder where you cannot look around. Since Docker Engine 23, `docker build` runs on BuildKit, so many older answers about intermediate containers and image IDs no longer apply.

This post covers clean builds, the "requires 1 argument" error, files outside the build context, debugging a failed build, and SSH keys and secrets during a build.

## TLDR

| Problem                                  | Fix                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------- |
| A cached step must run again             | `docker build --no-cache -t app .`, or `--no-cache-filter <stage>`  |
| The base image is old                    | `docker build --pull -t app .`                                      |
| `requires 1 argument`                    | Add the context path at the end: `docker build -t app .`            |
| `COPY ../shared` fails                   | Use the parent directory as context with `-f`, or `--build-context` |
| A step fails and you want to look inside | `--progress=plain`, `--target`, or `docker buildx debug`            |
| The build needs a private Git repository | `RUN --mount=type=ssh` and `docker build --ssh default .`           |

## Prerequisites

- Docker Engine 23 or later, or Docker Desktop. BuildKit is the default builder on both, and `docker build` is an alias for `docker buildx build`.
- A Dockerfile to build. Add `# syntax=docker/dockerfile:1` as its first line to get the current Dockerfile features.

## How Do I Force Docker to Do a Clean Build?

Add `--no-cache`. Docker then runs every step again, instead of reusing cached results:

```bash
docker build --no-cache -t my-app:latest .
```

Three more options control what is fresh:

```bash
# Pull the newest version of the FROM image, but keep the cache for the other steps
docker build --pull -t my-app:latest .

# Both: newest base image and no cache
docker build --pull --no-cache -t my-app:latest .

# Ignore the cache only for one stage of a multi-stage build
docker build --no-cache-filter deps -t my-app:latest .
```

To run one step again without losing the cache of the steps before it, change something that the step depends on. A build argument does that:

```dockerfile
FROM node:24-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
# A new value invalidates the cache from the first RUN after this line
ARG CACHE_BUST=1
# Without the ARG, this line stays cached and never picks up a newer release
RUN npm install --no-save some-package@latest
```

```bash
docker build --build-arg CACHE_BUST="$(date +%s)" -t my-app .
```

A changed `ARG` value causes a cache miss at its first use, and every `RUN` after an `ARG` uses it implicitly. Steps before the `ARG` line stay cached.

Things that do **not** give you a clean build:

- **`docker rmi my-app`.** The build cache is stored apart from images. The next build reuses it anyway. `docker builder prune` removes the cache, and `docker builder prune -a` removes all of it.
- **A cached `RUN apt-get update`.** If the line did not change, Docker reuses the old result, with old package lists. Keep `apt-get update` and `apt-get install` in one `RUN`, so a new package in the list also runs the update.

In Compose, the same flags exist: `docker compose build --no-cache web` and `docker compose build --pull web`. A build alone does not replace the running container: run `docker compose up -d` afterwards, as [rebuild a Compose container](/posts/rebuild-docker-container-compose#h2-how-do-i-rebuild-a-container-after-changing-the-code-or-dockerfile) explains.

## How Do I Fix "docker build requires 1 argument"?

Add the build context, usually `.`, at the end of the command. Current versions print:

```text
ERROR: docker: 'docker buildx build' requires 1 argument

Usage:  docker buildx build [OPTIONS] PATH | URL | -

Run 'docker buildx build --help' for more information
```

The `PATH` is the **build context**: the directory whose files `COPY` and `ADD` can use. It is required even when the Dockerfile is in the current directory:

```bash
docker build -t my-app .                          # context: the current directory
docker build -t my-app ./services/api             # context: another directory
docker build -t my-app -f docker/Dockerfile .     # Dockerfile elsewhere, context still "."
```

The causes:

- **The dot is missing.** `docker build -t my-app` has no context. Older Docker versions printed the same error in another format: `"docker build" requires exactly 1 argument`.
- **`-f` is not a context.** `-f` only names the Dockerfile. You still need the path at the end.
- **The command has two paths.** A space in a path without quotes, or a dash copied from a web page or chat that is a typographic dash instead of the plain `-`, makes Docker see extra arguments. A word with the wrong dash is not an option to Docker, so it counts as one more path, and the build fails the same way. Type the dashes again by hand.

In Compose, the context is the `build` value: `build: .` or `build: { context: ./api, dockerfile: Dockerfile.prod }`.

## How Do I Include Files Outside the Docker Build Context?

You cannot `COPY` from outside the build context. The builder only receives the files of the context, so `COPY ../shared/config.yaml /app/` fails. BuildKit resolves the path inside the context and reports `"/shared/config.yaml": not found`. Symbolic links that point outside the context do not help either: the builder does not follow them out of the context.

Pick one of these fixes.

**Use a higher directory as the context.** Keep the Dockerfile where it is and point `-f` to it. Paths in `COPY` are then relative to the new context:

```text
repo/
├── shared/config.yaml
└── services/api/Dockerfile
```

```bash
cd repo
docker build -f services/api/Dockerfile -t api .
```

```dockerfile
# Paths are relative to repo/, the context
COPY shared/config.yaml /app/config.yaml
COPY services/api/ /app/
```

Add a `.dockerignore` in `repo/` so the bigger context does not send `node_modules`, `.git` or build output to the builder. [COPY with exclusion](/posts/copy-with-docker-exclusion) explains the patterns.

**Add a named build context.** BuildKit can take more than one context. Give the extra directory a name and copy from it with `--from`:

```bash
docker build --build-context shared=../../shared -t api .
```

```dockerfile
COPY --from=shared config.yaml /app/config.yaml
```

Compose has the same feature as `additional_contexts`:

```yaml
services:
  api:
    build:
      context: .
      additional_contexts:
        shared: ../../shared
```

**Copy the file in first.** A build script can run `cp ../../shared/config.yaml ./build/` before `docker build`. It is simple and works everywhere, but the copy must stay out of Git.

If the outside file is a secret, such as an `.env` file or a key, do not put it in the image at all. Pass it as a [build secret](#h2-how-do-i-use-ssh-keys-or-secrets-in-a-docker-build) or mount it when the container runs.

## How Do I Inspect the File System of a Failed Docker Build?

With BuildKit, a failed step leaves no container or image behind, so the old trick of running the last intermediate image ID does not work. Use one of these:

**See the full output.** BuildKit folds the log of each step. `--progress=plain` prints everything, and `--no-cache` makes sure the failing step really runs:

```bash
docker build --progress=plain --no-cache -t app . 2>&1 | tee build.log
```

**Open a shell where the build failed.** `docker buildx debug` starts the build and, if a step fails, opens a shell in that step. It is still marked experimental, so turn it on first:

```bash
export BUILDX_EXPERIMENTAL=1
docker buildx debug --invoke /bin/sh build -t app .
```

The image must contain the shell you name. Exit the shell to end the debug session.

**Build up to a stage and run it.** In a multi-stage build, `--target` stops after a stage. Run the result with a shell and execute the failing command by hand:

```bash
docker build --target build -t app-debug .
docker run --rm -it --entrypoint sh app-debug
```

For a single-stage Dockerfile, move the failing `RUN` and everything after it into a second stage temporarily, or comment it out, build, and run the image the same way.

**Export the files.** `--output` writes the file system of the final stage (or the `--target` stage) to a directory instead of making an image. It only works for a build that succeeds, so use it on the stage before the failing step:

```bash
docker build --target build --output type=local,dest=./build-out .
ls build-out/
```

Remove debug changes from the Dockerfile when you are done.

## How Do I Use SSH Keys or Secrets in a Docker Build?

Never `COPY` a private key or a token into the image. Even if a later step deletes it, it stays in an earlier layer, and anyone who can pull the image can extract it. `ARG` and `ENV` values are visible in the image history, so they are not safe either. BuildKit has two mount types for this.

**SSH agent forwarding**, for `git clone` of private repositories. The key stays on your machine; the build can only ask your SSH agent to sign:

```dockerfile
# syntax=docker/dockerfile:1
FROM alpine:3.24
RUN apk add --no-cache git openssh-client
# Without known_hosts, the clone stops at "Host key verification failed"
RUN mkdir -p -m 0700 ~/.ssh && ssh-keyscan github.com >> ~/.ssh/known_hosts
RUN --mount=type=ssh git clone git@github.com:myorg/private-repo.git /src
```

```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
docker build --ssh default -t app .
```

**Secret files**, for tokens such as an `.npmrc` or a cloud credential. The file is mounted for one `RUN` and is not part of any layer:

```dockerfile
# syntax=docker/dockerfile:1
FROM node:24-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci
```

```bash
docker build --secret id=npmrc,src="$HOME/.npmrc" -t app .
```

In Compose, use `build: { ssh: [default] }` and `build: { secrets: [npmrc] }` with a top-level `secrets:` entry. To pick which key Git uses on the host or in CI, see [how to specify a private SSH key for Git commands](/posts/specify-private-ssh-key-for-git-commands).

When a **running container** needs SSH, mount the agent socket instead of the key files:

```bash
# Linux
docker run --rm -it -v "$SSH_AUTH_SOCK":/ssh-agent -e SSH_AUTH_SOCK=/ssh-agent alpine:3.24 sh

# Docker Desktop on macOS
docker run --rm -it -v /run/host-services/ssh-auth.sock:/ssh-agent -e SSH_AUTH_SOCK=/ssh-agent alpine:3.24 sh
```

If you must mount a key file, mount it read-only (`-v ~/.ssh/deploy_key:/root/.ssh/id_ed25519:ro`) and set the file mode to `600` on the host first: a read-only mount cannot be changed inside the container. Use a deploy key with read access to one repository, not your personal key.

## Related Resources

- [Difference Between RUN, CMD and ENTRYPOINT](/posts/difference-run-cmd-dockerfile): what each Dockerfile instruction does, and `COPY` vs `ADD`
- [How to use multiple build arguments in Docker build](/posts/docker-build-with-multiple-build-args): `ARG` and `--build-arg`
- [COPY with exclusion](/posts/copy-with-docker-exclusion): `.dockerignore` patterns
- [Docker image optimization](/posts/docker-image-optimization-best-practices): smaller images and better cache use
- [Introduction to Docker: Building Custom Images](/guides/introduction-to-docker/05-building-custom-docker-images)
- [Docker multi-stage build exercise](/exercises/docker-multi-stage-build): practice `--target` and stages
