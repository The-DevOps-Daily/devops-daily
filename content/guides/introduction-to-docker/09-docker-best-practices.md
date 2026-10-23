---
title: 'Docker Best Practices: Secure, Small and Maintainable Containers'
description: 'Docker best practices for 2026: lint Dockerfiles, pin images by digest, run as non-root, drop capabilities, scan and sign images, and rotate logs.'
order: 9
---

hello-api works. This part makes it safe to run for a long time: an image that is small, reproducible and free of secrets, a container that runs with the fewest privileges it needs, a supply chain you can check, and logs and shutdowns that do not surprise you at 3 a.m. Each practice comes with the command or configuration that applies it to hello-api, and the lint and validation output is from real runs.

## Prerequisites

- The hello-api project with the multi-stage Dockerfile from [Part 5](/guides/introduction-to-docker/05-building-custom-docker-images) and the `compose.yaml` from [Part 8](/guides/introduction-to-docker/08-docker-compose).

## Lint Every Dockerfile

Most Dockerfile problems are visible in the text. hadolint finds them in milliseconds, and it also runs ShellCheck on the shell code in `RUN` instructions. Here is a Dockerfile with the mistakes that show up in real projects:

```dockerfile
FROM ubuntu
RUN apt-get update
RUN apt-get install -y python3 python3-pip curl
RUN curl -sL https://example.com/setup.sh | bash
COPY . /app
WORKDIR /app
RUN pip3 install -r requirements.txt
ENV API_TOKEN=supersecret
EXPOSE 8000
CMD python3 app.py
```

```terminal
{
  "title": "hadolint 2.15.1 on a typical Dockerfile (real run)",
  "prompt": "$",
  "steps": [
    {
      "cmd": "hadolint Dockerfile",
      "output": "Dockerfile:1 DL3006 warning: Always tag the version of an image explicitly\nDockerfile:2 DL3009 info: Delete the apt lists (/var/lib/apt/lists) after installing something\nDockerfile:3 DL3059 info: Multiple consecutive `RUN` instructions. Consider consolidation.\nDockerfile:3 DL3015 info: Avoid additional packages by specifying `--no-install-recommends`\nDockerfile:3 DL3008 warning: Pin versions in apt get install. Instead of `apt-get install <package>` use `apt-get install <package>=<version>`\nDockerfile:4 DL4006 warning: Set the SHELL option -o pipefail before RUN with a pipe in it. If you are using /bin/sh in an alpine image or if your shell is symlinked to busybox then consider explicitly setting your SHELL to /bin/ash, or disable this check\nDockerfile:7 DL3042 warning: Avoid use of cache directory with pip. Use `pip install --no-cache-dir <package>`\nDockerfile:8 DL3064 warning: Potentially sensitive data should not be used in the `ARG` or `ENV` commands\nDockerfile:10 DL3025 warning: Use arguments JSON notation for CMD and ENTRYPOINT arguments"
    }
  ]
}
```

Every rule has a page on the hadolint wiki (`DL` rules are hadolint's own; `SC` rules, when they appear, come from ShellCheck). DL3064 is the most serious finding here: `ENV API_TOKEN=supersecret` puts a secret in the image config, where `docker image inspect` shows it to anyone who pulls the image. BuildKit's own build checks flag it as well (`SecretsUsedInArgOrEnv`) when you run `docker build --check`. Use a secret mount at build time and a secret file at run time ([Part 5](/guides/introduction-to-docker/05-building-custom-docker-images)).

Two serious problems are not on the list, because a linter cannot see them:

- **`curl ... | bash`** runs whatever the server returns today. hadolint only asks for `pipefail` (DL4006). Download a specific version, check its checksum, then run it (`ADD --checksum=sha256:...` does both).
- **`pip3 install` into the system Python** fails on current Debian and Ubuntu images with `externally-managed-environment` (PEP 668). Use a virtual environment, as hello-api does, or an official `python` image.

Some rules do not fit every team. hadolint reads a `.hadolint.yaml` file from the project directory:

```yaml
# Fail the build on warnings and errors, not on info and style
failure-threshold: warning
ignored:
  # We pin the base image by digest and rebuild weekly instead of pinning every apt package
  - DL3008
```

```terminal
{
  "title": "the same Dockerfile with a project config (real run)",
  "prompt": "$",
  "steps": [
    {
      "cmd": "hadolint Dockerfile; echo \"exit code: $?\"",
      "output": "Dockerfile:1 DL3006 warning: Always tag the version of an image explicitly\nDockerfile:2 DL3009 info: Delete the apt lists (/var/lib/apt/lists) after installing something\nDockerfile:3 DL3059 info: Multiple consecutive `RUN` instructions. Consider consolidation.\nDockerfile:3 DL3015 info: Avoid additional packages by specifying `--no-install-recommends`\nDockerfile:4 DL4006 warning: Set the SHELL option -o pipefail before RUN with a pipe in it. If you are using /bin/sh in an alpine image or if your shell is symlinked to busybox then consider explicitly setting your SHELL to /bin/ash, or disable this check\nDockerfile:7 DL3042 warning: Avoid use of cache directory with pip. Use `pip install --no-cache-dir <package>`\nDockerfile:8 DL3064 warning: Potentially sensitive data should not be used in the `ARG` or `ENV` commands\nDockerfile:10 DL3025 warning: Use arguments JSON notation for CMD and ENTRYPOINT arguments\nexit code: 1"
    }
  ]
}
```

Run hadolint in CI on every pull request, together with `docker compose config --quiet` for Compose files ([Part 10](/guides/introduction-to-docker/10-docker-in-production) has the workflow).

## Pin Base Images by Digest

A tag like `python:3.14-slim` moves every time the image is rebuilt, which is often: base images are rebuilt for every security fix in Debian. Two builds of the same commit a week apart can contain different system packages. For reproducible builds, pin the digest as well. `crane digest` reads it from the registry with a `HEAD` request:

```terminal
{
  "title": "the current digest of python:3.14-slim (real run, 23 October 2026)",
  "prompt": "$",
  "steps": [
    {
      "cmd": "crane digest python:3.14-slim",
      "output": "sha256:0514bc76712d64f8bb48adcb95b1ab0d88c69fee95d62fe4c18ee948bee9b1e1"
    }
  ]
}
```

```dockerfile
# Pin both stages to the same digest. The tag stays for humans; Docker uses only the digest.
FROM python:3.14-slim@sha256:0514bc76712d64f8bb48adcb95b1ab0d88c69fee95d62fe4c18ee948bee9b1e1 AS build
# ...build steps from Part 5...

FROM python:3.14-slim@sha256:0514bc76712d64f8bb48adcb95b1ab0d88c69fee95d62fe4c18ee948bee9b1e1
# ...runtime steps from Part 5...
```

This is the digest of the multi-platform index, so the same line works on `amd64` and `arm64`. A pinned digest never gets security fixes by itself, so pair it with a bot that opens pull requests when a new digest appears. Docker's own documentation recommends Dependabot for this; Renovate works too:

```yaml
version: 2
updates:
  # FROM lines in the Dockerfile: tags and digests
  - package-ecosystem: docker
    directory: /
    schedule:
      interval: weekly
  # Images in compose.yaml
  - package-ecosystem: docker-compose
    directory: /
    schedule:
      interval: weekly
  # requirements.txt
  - package-ecosystem: pip
    directory: /
    schedule:
      interval: weekly
```

Rebuild and redeploy on a schedule even when your code does not change, so new base image fixes reach production.

## Keep Images Small

Every package in an image is something to download, store, scan and patch. In order of impact:

1. **Pick a small base**: `-slim` or distroless instead of the full image. [Part 3](/guides/introduction-to-docker/03-working-with-docker-images) measured `python:3.14` at 1,143 MB unpacked and `python:3.14-slim` at 124 MB.
2. **Use multi-stage builds** so compilers and build caches stay in the build stage ([Part 5](/guides/introduction-to-docker/05-building-custom-docker-images)).
3. **Install only what you need**: `apt-get install --no-install-recommends`, and remove `/var/lib/apt/lists/*` in the same `RUN`.
4. **Keep the build context clean** with `.dockerignore`.

"Fewer layers" matters much less than it used to: BuildKit and current storage drivers handle dozens of layers well. Combine `RUN` steps when they belong together (`apt-get update` and `install`), not to hit a layer count.

## Run as a Non-Root User

hello-api's image already switches to UID 10001 with `USER 10001`. Check what any image runs as before you trust it:

```bash
docker image inspect --format '{{.Config.User}}' hello-api:1.0
```

An empty value means root. Many official images start as root on purpose, because their entrypoint must prepare files and then drops privileges (the postgres image switches to the `postgres` user). For your own images, there is rarely a reason to run as root. If a process must bind a port below 1024, let it listen on a high port inside the container and publish it as 80 or 443, or let the reverse proxy do it.

## Drop Privileges at Run Time

Docker gives containers a reduced set of Linux capabilities by default, but still more than most apps need. Add these settings to the `api` and `db` services in `compose.yaml`:

```yaml
services:
  api:
    # ...everything from Part 8, plus:
    read_only: true
    tmpfs:
      - /tmp:size=16m
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 256M
          pids: 200
    logging:
      driver: local
      options:
        max-size: 10m
        max-file: '3'
  db:
    # ...everything from Part 8, plus:
    security_opt:
      - no-new-privileges:true
    shm_size: 128m
```

What each setting does:

- **`read_only: true`** makes the container's root filesystem read-only. An attacker who gets code execution cannot drop files into the app directory or change its code. `/tmp` stays writable as a small tmpfs, and gunicorn already keeps its worker files in `/dev/shm` ([Part 5](/guides/introduction-to-docker/05-building-custom-docker-images)).
- **`cap_drop: [ALL]`** removes every Linux capability. hello-api listens on port 8000 and writes no files, so it needs none. Add back single capabilities with `cap_add` only when something fails.
- **`no-new-privileges`** stops processes from gaining privileges through setuid binaries such as `su` or `sudo`.
- **`deploy.resources.limits`** caps CPU, memory and the number of processes. Compose applies these on a single host, not only in Swarm.
- **`logging`** switches this service to the `local` log driver, which rotates and compresses its files ([below](#h2-rotate-logs)).

The database gets `no-new-privileges` too, but not `cap_drop: [ALL]`: the postgres entrypoint starts as root, changes file ownership and switches users, which needs capabilities such as `CHOWN`, `SETUID` and `SETGID`. Hardening an image you did not build means testing what it needs. The `shm_size: 128m` raises `/dev/shm` from Docker's 64 MB default, which Postgres uses for parallel queries.

Never run application containers with `--privileged`, `--pid=host`, `--network=host` or a mounted `/var/run/docker.sock` unless you know exactly why. Each one removes a layer of isolation, and the Docker socket gives full control of the host ([Part 10](/guides/introduction-to-docker/10-docker-in-production)).

## Give the App a Database Role That Is Not a Superuser

The postgres image creates the user in `POSTGRES_USER` as a **superuser**. Since Part 8, hello-api connects as that user, so a bug or an SQL injection in the app could read and change everything on the database server, and superuser-only features such as `COPY ... FROM PROGRAM` even run shell commands in the database container. The app only needs its own database.

Let the image create its default superuser, `postgres`, with a password of its own, and create the app's role in an **init script**. The image runs the `*.sql` and `*.sh` files in `/docker-entrypoint-initdb.d` once, when it initializes an empty data directory:

```bash
#!/bin/sh
# Runs once, when Postgres initializes an empty data directory:
# create the app's login role and make it the owner of the app database.
app_password="$(cat /run/secrets/db_password)" || exit 1
psql -v ON_ERROR_STOP=1 --username postgres --dbname hello \
  --set app_password="$app_password" <<'SQL'
CREATE ROLE hello LOGIN PASSWORD :'app_password';
ALTER DATABASE hello OWNER TO hello;
SQL
```

The quoted `'SQL'` heredoc keeps the shell away from the SQL, and psql inserts the password as a quoted literal (`:'app_password'`), so special characters cannot break the statement. As the owner of the `hello` database, the role can create tables in its `public` schema (PostgreSQL 15 and later give that right to the database owner), and it has no superuser powers. PostgreSQL still lets every role connect to other databases by default (the `CONNECT` privilege of `PUBLIC`); if the server holds other databases, revoke that with `REVOKE CONNECT ON DATABASE other_db FROM PUBLIC`. Make the script executable (`chmod +x db/init/10-app-role.sh`); the image sources scripts that are not.

Then change the `db` service: drop `POSTGRES_USER`, give the superuser its own secret, mount the script, and point the health check at the `postgres` user:

```yaml
services:
  db:
    image: postgres:18
    environment:
      POSTGRES_DB: hello
      POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password
    secrets:
      - postgres_password
      - db_password
    volumes:
      - db-data:/var/lib/postgresql
      - ./db/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -h 127.0.0.1 -U postgres -d hello']
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 10s

secrets:
  db_password:
    file: ./secrets/db_password.txt
  postgres_password:
    file: ./secrets/postgres_password.txt
```

Create the second secret the same way as the first: `openssl rand -base64 24 > secrets/postgres_password.txt && chmod 644 secrets/postgres_password.txt`. The `api` service does not change: it still connects as `hello` with `db_password`. Init scripts run only on an empty data directory, so recreate the development database once to apply the change, which deletes its data: `docker compose down -v`, then `docker compose up -d --build`. The Postgres guide explains roles and privileges in [Creating a Non-Superuser](/guides/introduction-to-postgres/02-installation-and-setup#h2-creating-a-non-superuser).

With the hardening from the previous section and the new role, `compose.yaml` still validates (real run):

```terminal
{
  "title": "validate the hardened compose.yaml (real run)",
  "prompt": "$",
  "steps": [
    {
      "cmd": "docker compose config --quiet && echo \"compose.yaml is valid\"",
      "output": "compose.yaml is valid"
    },
    {
      "cmd": "docker compose config --format json api | jq -c '.services.api | {read_only, tmpfs, cap_drop, security_opt, limits: .deploy.resources.limits}'",
      "output": "{\"read_only\":true,\"tmpfs\":[\"/tmp:size=16m\"],\"cap_drop\":[\"ALL\"],\"security_opt\":[\"no-new-privileges:true\"],\"limits\":{\"cpus\":1,\"memory\":\"268435456\",\"pids\":200}}"
    }
  ]
}
```

## Keep Secrets Out of Images

- **Build time**: `RUN --mount=type=secret` ([Part 5](/guides/introduction-to-docker/05-building-custom-docker-images)). Never `ARG`, `ENV` or `COPY` for secrets; all three leave them in the image.
- **Run time**: Compose or Swarm secrets mounted as files ([Part 8](/guides/introduction-to-docker/08-docker-compose)), or a secrets manager. Environment variables are acceptable for low-risk values, but they show up in `docker inspect`, in crash reports and in child processes.
- **In Git**: `.env` and `secrets/` in `.gitignore`, and in `.dockerignore` so they never reach the build context.

If a secret ever ended up in an image layer that someone pushed, rotate the secret. Deleting the layer later does not help, because anyone may have pulled it already.

## Scan Images for Vulnerabilities

Scanners read the packages in an image (from its software bill of materials, or by looking at the files) and match them against vulnerability databases:

```bash
# Docker Scout: built into Docker Desktop, a CLI plugin on Docker Engine, needs a Docker account
docker scout quickview hello-api:1.0
docker scout cves --only-severity critical,high hello-api:1.0
docker scout recommendations hello-api:1.0     # suggests a newer or smaller base image

# Trivy and Grype: open source, no account
trivy image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 hello-api:1.0
grype hello-api:1.0 --only-fixed --fail-on high
```

The free Docker Personal plan includes Docker Scout for one repository (Pro: two; Team and Business: unlimited), and local analysis with the CLI. Trivy and Grype download their vulnerability databases on the first run, which takes a few minutes and a fair amount of disk space; CI caches them between runs.

Expect findings: a typical Debian-based image reports dozens of CVEs, most of them low severity or without a fix. Fail the build on fixable critical and high findings, rebuild often to pick up fixed base images, and use a smaller base to shrink the list. [Why Your Base Image Has 1,684 CVEs](/posts/why-your-base-image-has-1684-cves) explains how to read a long scan report.

## Use Hardened Base Images

**Docker Hardened Images** (DHI) are minimal images that Docker maintains with very few known vulnerabilities, signed SBOMs and provenance, and non-root defaults. The free Community tier is open source (Apache 2.0); paid tiers add SLAs for CVE fixes, FIPS variants and extended support. They live on their own registry, `dhi.io`, and need a free Docker account. Without a login the registry refuses access (real run):

```terminal
{
  "title": "dhi.io requires a login (real run)",
  "prompt": "$",
  "steps": [
    {
      "cmd": "crane manifest dhi.io/python:3.13",
      "output": "2026/10/23 20:54:06 No matching credentials were found for \"dhi.io\"\nError: fetching manifest dhi.io/python:3.13: GET https://dhi.io/token?scope=repository%3Apython%3Apull&service=registry.docker.io: unexpected status code 401 Unauthorized: Unauthorized"
    }
  ]
}
```

After `docker login dhi.io`, use them like any base image, for example `FROM dhi.io/python:3.13`. Like distroless images, the runtime images have no shell or package manager, so build in a stage with tools and copy the result into the hardened image. Google's distroless images (`gcr.io/distroless/...`) and Chainguard's images are alternatives with the same idea.

## Know What You Ship: SBOMs, Provenance and Signatures

BuildKit can attach a **software bill of materials** (SBOM) and **provenance** (how, where and from what source the image was built) to an image when you push it:

```bash
docker buildx build --sbom=true --provenance=mode=max \
  -t ghcr.io/my-org/hello-api:1.0 --push .
```

These are the `unknown/unknown` entries you saw in the nginx image index in [Part 1](/guides/introduction-to-docker/01-docker-basics). Scanners and policy tools read them.

To prove an image came from your pipeline, **sign** it. Docker Content Trust (`DOCKER_CONTENT_TRUST=1`), which older guides recommend, was removed from the Docker CLI in Engine 29, and Docker shuts down the Notary v1 service behind it on 8 December 2026. Use [Sigstore cosign](https://docs.sigstore.dev/) or [Notation](https://notaryproject.dev/) instead. With cosign in GitHub Actions, keyless signing uses the workflow's identity, and anyone can verify it:

```bash
DIGEST=sha256:...   # the digest that docker push or the CI build printed
cosign sign "ghcr.io/my-org/hello-api@${DIGEST}"
# Accept only signatures from the delivery workflow on main or on a version tag
cosign verify "ghcr.io/my-org/hello-api@${DIGEST}" \
  --certificate-identity-regexp '^https://github\.com/my-org/hello-api/\.github/workflows/docker\.yml@refs/(heads/main|tags/v[0-9.]+)$' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

Sign and verify digests, not tags: a tag can point to something else tomorrow. Pin the identity to the workflow file and the refs you trust; a pattern that matches the whole repository would also accept signatures from other workflows or pull request runs.

## Rotate Logs

Docker Engine's default log driver, `json-file`, never rotates: one chatty container can fill the disk. Docker Desktop switched new containers to the `local` driver in version 4.94, but Docker Engine on your servers did not. Set rotation per service in Compose (as above), per container with `--log-driver local` or `--log-opt max-size=10m --log-opt max-file=3`, or for the whole host in `daemon.json` ([Part 10](/guides/introduction-to-docker/10-docker-in-production)). A changed default applies only to containers created after the change.

## Shut Down Cleanly

`docker stop` and every deploy send the image's stop signal (`SIGTERM` unless the image sets `STOPSIGNAL`, as nginx does), wait (10 seconds by default) and then kill. hello-api uses the default. To finish in-flight requests:

- **Run the app as process 1 with the exec form** of `CMD` or `ENTRYPOINT`, or `exec` the app at the end of an entrypoint script. A shell as process 1 swallows the signal.
- **Handle `SIGTERM` in the app.** gunicorn does: it stops accepting connections and lets workers finish their requests. For your own code, stop accepting work, finish what is running, close connections, exit.
- **Give it enough time**: `stop_grace_period: 30s` in Compose, `--stop-timeout` with `docker run`.
- **Add an init process** when the app starts child processes that it does not wait for: `init: true` in Compose or `docker run --init` runs `tini` as process 1, which forwards signals and reaps zombie processes.

## Health Checks That Mean Something

A health check should answer "can this container do its job?" quickly and cheaply:

- Check the process itself (`/health` in hello-api), and keep dependency checks (`/ready`) for systems that use them for routing, such as Kubernetes readiness probes ([Part 10](/guides/introduction-to-docker/10-docker-in-production)). A Docker health check that fails whenever the database blips makes every container unhealthy at once.
- Use a tool the image contains: the slim Python image has no `curl`, so hello-api uses Python itself.
- Set `start_period` for slow starters, so the first checks do not count.

## A Short Checklist

- [ ] hadolint and `docker compose config --quiet` pass in CI
- [ ] Base image pinned by digest, with a bot updating it, and a scheduled rebuild
- [ ] Small base, multi-stage build, `.dockerignore`
- [ ] Non-root `USER`; `read_only`, `cap_drop: [ALL]` and `no-new-privileges` where the app allows it
- [ ] Memory, CPU and PID limits
- [ ] The app connects to its database as an ordinary role, not as a superuser
- [ ] No secrets in `ARG`, `ENV`, layers, Git or the build context
- [ ] Image scanned in CI, failing on fixable critical and high findings
- [ ] SBOM and provenance attached; images signed and deployed by digest
- [ ] Log rotation on every host
- [ ] Exec-form `CMD`, `SIGTERM` handled, a meaningful `HEALTHCHECK`

The [Docker Security Hardening Checklist](/checklists/docker-security) goes further, item by item.

## Summary

- Lint Dockerfiles, pin base images by digest and let a bot update them.
- Keep images small and free of secrets.
- Run as non-root, read-only, without capabilities and with resource limits.
- Scan, attach SBOMs and provenance, and sign with cosign or Notation now that Docker Content Trust is gone.
- Rotate logs and make shutdowns clean.

Next, take hello-api to a server in [Docker in Production](/guides/introduction-to-docker/10-docker-in-production).

## Keep Learning

- [Docker Security Best Practices](/posts/docker-security-best-practices)
- [Docker Image Optimization: Best Practices for Smaller, Faster Images](/posts/docker-image-optimization-best-practices)
- [Docker Desktop Switched New Containers to the local Log Driver](/posts/docker-desktop-local-log-driver)
- Checklist: [Docker Security Hardening Checklist](/checklists/docker-security)
- Quiz: [Docker Fundamentals Quiz](/quizzes/docker-quiz)
