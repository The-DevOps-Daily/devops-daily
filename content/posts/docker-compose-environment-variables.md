---
title: 'How to Use Environment Variables in Docker and Docker Compose'
excerpt: 'Pass environment variables with docker run -e and --env-file, set them in Compose with environment, env_file and .env files, learn which value wins, use defaults and required variables, set ENV and PATH in a Dockerfile, and keep secrets out of all of them.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2025-04-23'
publishedAt: '2025-04-23T09:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Docker Compose
  - Environment Variables
  - Dockerfile
  - Configuration
  - DevOps
---

Environment variables are how most containers get their configuration: a database URL, a log level, a feature flag. Docker has several ways to set them, at build time and at run time, and Compose adds a `.env` file that does something different from what most people expect. When a value is not what you think it is, the cause is usually one of these layers overriding another.

This post covers `docker run -e` and `--env-file`, the Compose `environment`, `env_file` and `.env` options and their order of precedence, default and required values, `ENV`, `ARG` and `PATH` in a Dockerfile, and how to check what a container really sees.

## TLDR

| Where                   | Example                               | When it applies                            |
| ----------------------- | ------------------------------------- | ------------------------------------------ |
| `docker run -e`         | `docker run -e LOG_LEVEL=debug myapp` | That one container                         |
| `docker run --env-file` | `docker run --env-file app.env myapp` | That one container                         |
| Compose `environment`   | `environment: { LOG_LEVEL: debug }`   | Every container of the service             |
| Compose `env_file`      | `env_file: app.env`                   | Every container of the service             |
| Compose `.env` file     | `TAG=1.4` next to `compose.yaml`      | Fills in `${TAG}` in the Compose file only |
| Dockerfile `ENV`        | `ENV PATH="/opt/app/bin:${PATH}"`     | The build and every container of the image |
| Dockerfile `ARG`        | `ARG VERSION=1.4`                     | The build only                             |

The `.env` file is not passed into containers. It only fills in `${VARIABLE}` placeholders in `compose.yaml`. To check the result, run `docker compose config`.

## Prerequisites

- Docker Engine or Docker Desktop with the Compose plugin (`docker compose version`).
- A service to test with. The examples use small images such as `alpine:3.24`.

## How Do I Pass Environment Variables to a Docker Container?

Use `-e` (or `--env`) once per variable:

```bash
docker run --rm -e APP_ENV=production -e LOG_LEVEL=info alpine:3.24 env
```

`-e NAME` without a value copies the variable from your shell. That keeps the value out of the command line:

```bash
export API_TOKEN=...            # set it in your shell first
docker run --rm -e API_TOKEN myapp
```

For many variables, put them in a file and pass it with `--env-file`:

```text
# app.env: one VARIABLE=value per line, lines starting with # are comments
APP_ENV=production
LOG_LEVEL=info
DATABASE_URL=postgresql://app@db:5432/app
```

```bash
docker run --rm --env-file app.env myapp
```

`docker run --env-file` takes each value literally. `GREETING="hello"` sets the value to `"hello"`, quotes included, and `$OTHER` is not expanded. Leave the quotes out. Compose `env_file` files follow other rules, see below.

## How Do I Set Environment Variables in Docker Compose?

Use `environment` for a few values and `env_file` for many. Both set variables inside the containers of the service:

```yaml
services:
  api:
    image: myorg/api:${TAG:-latest}
    environment:
      APP_ENV: production
      LOG_LEVEL: ${LOG_LEVEL:-info} # from the shell or .env, with a default
      API_TOKEN: # no value: copied from the shell that runs docker compose
    env_file:
      - path: ./api.env
        required: false # do not fail when the file does not exist
```

`environment` also accepts a list (`- APP_ENV=production`). Use one form per service, not both.

### What Does the .env File Do?

Compose reads a file called `.env` in the project directory (the directory of `compose.yaml`) and uses it to **fill in placeholders** in the Compose file. It does not add those variables to any container:

```text
# .env
TAG=1.4.2
POSTGRES_PASSWORD=change-me
```

```yaml
services:
  db:
    image: postgres:18
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD} # filled in from .env
  api:
    image: myorg/api:${TAG} # filled in from .env
```

Here `db` gets `POSTGRES_PASSWORD` because the Compose file passes it on. `api` does not get `TAG` or `POSTGRES_PASSWORD` as environment variables at all. If a container needs a variable from `.env`, name it under `environment`, or load the file with `env_file: .env`.

Use another file with `docker compose --env-file .env.staging up -d`. To see the final values, run `docker compose config`: it prints the Compose file with every placeholder filled in, and shows a warning for each variable that is not set.

### Default Values and Required Variables

Placeholders support the shell's default and error forms:

| Syntax            | Result                                                              |
| ----------------- | ------------------------------------------------------------------- |
| `${VAR}`          | The value, or an empty string and a warning if `VAR` is not set     |
| `${VAR:-default}` | `default` if `VAR` is unset or empty                                |
| `${VAR-default}`  | `default` only if `VAR` is unset                                    |
| `${VAR:?message}` | Stop with `message` if `VAR` is unset or empty                      |
| `${VAR?message}`  | Stop with `message` only if `VAR` is unset                          |
| `$$VAR`           | A literal `$VAR`, for a variable that the container's shell expands |

`POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in .env}` makes `docker compose up` fail at once with a clear message, instead of starting a database without the setting you expected.

### Which Value Wins?

Two different orders apply. For **placeholders** in the Compose file, a variable in your shell overrides the same variable in `.env`. For the **environment inside the container**, Compose uses this order, highest first:

1. `docker compose run -e NAME=value` on the command line.
2. `environment` or `env_file` entries whose value is a placeholder, filled in from the shell or `.env`.
3. Plain values under `environment`.
4. Values from `env_file`.
5. `ENV` in the image's Dockerfile.

So `environment: { LOG_LEVEL: warn }` beats `LOG_LEVEL=debug` in an `env_file`, and both beat the image's `ENV LOG_LEVEL=info`. Unlike `docker run --env-file`, Compose `env_file` files support quotes and `${VAR}` placeholders.

After you change a variable, run `docker compose up -d`. Compose recreates the services whose environment changed. `docker compose restart` does not apply changes, as [rebuild, restart and upgrade with Compose](/posts/rebuild-docker-container-compose#h2-how-do-i-restart-a-single-container-with-docker-compose) shows.

## How Do I Set Environment Variables in a Dockerfile?

`ENV` sets a variable for the following build steps and for every container of the image. `ARG` sets a variable for the build only:

```dockerfile
FROM python:3.14-slim
# Build time only: docker build --build-arg APP_VERSION=1.4.2 .
ARG APP_VERSION=dev
# Both are visible in the running container
ENV APP_VERSION=${APP_VERSION} \
    PYTHONUNBUFFERED=1
```

Keep comments on their own lines. In `ENV` and `ARG`, a `#` after the value is not a comment, and the build fails.

Use `ENV` for defaults that the app needs, and override them at run time with `-e` or Compose. Use `ARG` for values that only the build needs, such as a version to download. [Multiple build arguments](/posts/docker-build-with-multiple-build-args) covers `ARG` in detail. Values of both end up in the image metadata or history, so neither is a place for passwords.

### How Do I Update PATH in a Dockerfile?

Prepend or append to the existing value with `ENV`:

```dockerfile
FROM ubuntu:24.04
RUN mkdir -p /opt/tools/bin \
    && printf '#!/bin/sh\necho "Hello from PATH"\n' > /opt/tools/bin/hello \
    && chmod +x /opt/tools/bin/hello
ENV PATH="/opt/tools/bin:${PATH}"
CMD ["hello"]
```

```bash
docker build -t path-demo . && docker run --rm path-demo
# Hello from PATH
```

- Always include `${PATH}`. `ENV PATH=/opt/tools/bin` alone removes `/usr/bin` and the other defaults, and most commands stop working.
- `RUN export PATH=...` does not work: each `RUN` is a new shell, and the change is lost after that line.
- A script needs a `#!` line like the one above. Without it, the exec-form `CMD ["hello"]` fails with `exec format error`, because no shell is there to run the file.
- Many images already set `PATH` for their own tools, such as `/usr/local/bin` or `/opt/venv/bin`. Check with `docker run --rm myimage printenv PATH`.

## How Do I Check the Environment of a Running Container?

```bash
docker exec web printenv                # everything the container's processes see
docker exec web printenv LOG_LEVEL      # one variable
docker compose exec api env             # the same for a Compose service
docker inspect -f '{{json .Config.Env}}' web   # what Docker set at create time
```

`docker inspect` shows the variables from the image and the run command. `printenv` shows what a new process in the container gets. Neither shows variables that the app's entrypoint script sets for itself.

## How Do I Keep Secrets Out of Environment Variables?

Environment variables are easy to read: `docker inspect` prints them, child processes inherit them, and crash reports and debug pages often include them. For passwords and keys:

- **Use secret files.** Compose `secrets` mount a file at `/run/secrets/<name>` inside the container:

  ```yaml
  services:
    db:
      image: postgres:18
      environment:
        POSTGRES_PASSWORD_FILE: /run/secrets/db_password
      secrets:
        - db_password

  secrets:
    db_password:
      file: ./secrets/db_password.txt
  ```

  Many official images, such as `postgres` and `mysql`, read a `*_FILE` variable for exactly this case.

- **Never commit `.env` files with real values.** Commit a `.env.example` with the variable names and safe placeholders, and add `.env` to `.gitignore`.
- **Never pass secrets with `ARG` or `ENV`.** Use build secrets (`RUN --mount=type=secret`) for values that only the build needs, as shown in [use secrets in a Docker build](/posts/force-docker-clean-build#h2-how-do-i-use-ssh-keys-or-secrets-in-a-docker-build).

## Related Resources

- [How to rebuild, restart and upgrade a Compose container](/posts/rebuild-docker-container-compose): which command applies a changed variable
- [How to use multiple build arguments in Docker build](/posts/docker-build-with-multiple-build-args): `ARG` and `--build-arg`
- [Introduction to Docker: Docker Compose](/guides/introduction-to-docker/08-docker-compose)
- [Docker security checklist](/checklists/docker-security): secrets, users and images
- [Docker terminal simulator](/games/docker-terminal-simulator): practice `-e` and Compose in the browser
- [Docker quiz](/quizzes/docker-quiz): check what you know
