---
title: Introduction to Docker
seoTitle: 'Docker Tutorial for Beginners: Containers, Images and Compose'
description: 'Learn Docker step by step with Engine 29: install it, run containers, write Dockerfiles, use volumes, networks and Compose, then deploy to production.'
category:
  name: Docker
  slug: docker
publishedAt: '2025-05-17'
updatedAt: '2026-10-23'
author:
  name: DevOps Daily Team
  slug: devops-daily-team
tags:
  - Docker
  - Containers
  - Docker Compose
  - Dockerfile
  - Container Security
  - DevOps
---

**Docker** packages an application and everything it needs (runtime, libraries, system tools, configuration) into an **image**, and runs that image as an isolated process called a **container**. The image you build on your laptop is the image that runs in CI and on your servers, so "it works on my machine" stops being an excuse. Docker images follow the OCI standard, so the same image also runs on Kubernetes, Podman and cloud container services.

This guide teaches Docker from the first `docker run` to a production deployment. You build one small application along the way, a Python web API called **hello-api** with a Postgres database, and every part adds a piece: an image, a volume, a network, a Compose file, hardening and a delivery pipeline.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Dockerfile", "sub": "the recipe", "icon": "gear", "tone": "slate" },
    { "label": "docker build", "sub": "BuildKit", "icon": "cpu", "tone": "accent" },
    { "label": "Image", "sub": "layers + config", "icon": "box", "tone": "blue" },
    { "label": "Registry", "sub": "Docker Hub, GHCR", "icon": "cloud", "tone": "violet" },
    { "label": "docker run", "sub": "a container", "icon": "rocket", "tone": "green" }
  ]
}
```

## What You'll Learn

The guide has ten parts. Each builds on the previous one, but you can jump to the topic you need.

1. **[What Is Docker? Containers, Images and How Docker Works](/guides/introduction-to-docker/01-docker-basics)**: containers vs virtual machines, the path from `docker run` to containerd and runc, and what an image really is.
2. **[How to Install Docker](/guides/introduction-to-docker/02-docker-installation)**: Docker Engine 29 on Ubuntu, Debian, Fedora and RHEL, Docker Desktop on macOS and Windows, rootless mode, Docker Hub pull limits and the errors you hit on day one.
3. **[Docker Images: Pull, Tag, Inspect and Clean Up](/guides/introduction-to-docker/03-working-with-docker-images)**: names, tags and digests, the new `docker image ls` view, image variants and their real sizes, and freeing disk space.
4. **[Run Your First Docker Container](/guides/introduction-to-docker/04-creating-your-first-container)**: `docker run`, ports, logs, `exec`, the container lifecycle, restart policies, limits and health checks.
5. **[How to Write a Dockerfile and Build a Docker Image](/guides/introduction-to-docker/05-building-custom-docker-images)**: containerize hello-api, fix a typical Dockerfile with hadolint, layer caching, multi-stage builds, cache and secret mounts.
6. **[Docker Volumes and Bind Mounts](/guides/introduction-to-docker/06-working-with-docker-volumes)**: run Postgres 18 on a volume, back it up, and use bind mounts and tmpfs where they fit.
7. **[Docker Networking](/guides/introduction-to-docker/07-networking-in-docker)**: user-defined networks with DNS, port publishing and the firewall trap, internal networks and debugging.
8. **[Docker Compose Tutorial](/guides/introduction-to-docker/08-docker-compose)**: the whole application in one `compose.yaml`, with health checks, secrets, profiles, watch and override files.
9. **[Docker Best Practices](/guides/introduction-to-docker/09-docker-best-practices)**: digest pinning, non-root and read-only containers, scanning, SBOMs and signing, log rotation and clean shutdowns.
10. **[Docker in Production](/guides/introduction-to-docker/10-docker-in-production)**: a GitHub Actions pipeline, a Compose deployment behind an HTTPS proxy, updates and rollbacks, daemon settings, and when to move to Swarm or Kubernetes.

## Docker Best Practices at a Glance

The habits that separate a reliable container setup from a fragile one, each with the part that explains it:

- **Use specific image versions**, never `latest`, and pin digests where builds must be reproducible ([Part 3](/guides/introduction-to-docker/03-working-with-docker-images), [Part 9](/guides/introduction-to-docker/09-docker-best-practices)).
- **Start from a small base image** and build with multi-stage Dockerfiles ([Part 5](/guides/introduction-to-docker/05-building-custom-docker-images)).
- **Order Dockerfile steps for the cache**: dependencies first, code last, with a `.dockerignore` ([Part 5](/guides/introduction-to-docker/05-building-custom-docker-images)).
- **Run as a non-root user**, with a read-only filesystem and no extra capabilities ([Part 9](/guides/introduction-to-docker/09-docker-best-practices)).
- **Keep data in volumes**, and back it up with the database's own tools ([Part 6](/guides/introduction-to-docker/06-working-with-docker-volumes)).
- **Give each application its own network**, and publish only the ports clients need ([Part 7](/guides/introduction-to-docker/07-networking-in-docker)).
- **Keep secrets out of images and environment variables**: use secret mounts and Compose secrets ([Part 8](/guides/introduction-to-docker/08-docker-compose)).
- **Add health checks, restart policies and resource limits** to every service ([Part 4](/guides/introduction-to-docker/04-creating-your-first-container), [Part 8](/guides/introduction-to-docker/08-docker-compose)).
- **Build, scan and sign images in CI**, and deploy by tag or digest ([Part 10](/guides/introduction-to-docker/10-docker-in-production)).

## Which Versions This Guide Uses

The guide was updated on 23 October 2026 for **Docker Engine 29.9.2**, **Docker Compose v5.6.1**, **Buildx 0.38.1** and **Docker Desktop 4.96.3**, with `nginx:1.30`, `postgres:18` and `python:3.14-slim` images.

What is a real run and what is an example:

- **Real runs**: the Docker CLI's own output where it needs no daemon (versions, error messages, `docker compose config`, `docker stack config`, `dockerd --validate`), registry lookups with `docker buildx imagetools` and `crane`, image sizes, Docker Hub's rate-limit headers, hadolint, actionlint, kubeconform and `caddy validate`. hello-api itself was run and tested outside Docker (gunicorn 26.2.0 on Python 3.11, against PGlite, an embedded build of Postgres).
- **Examples**: the output of commands that need a running Docker daemon (`docker run`, `build`, `ps`, `logs`, `compose up`). They follow the format of the versions above, and the guide says so next to each one. Values that come from the real images, such as nginx's startup messages or a page size, are real; container IDs, times and addresses are not.

If you learned Docker from an older tutorial, these changes matter most:

| Then                                             | Now                                                                                            | Since                        |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ---------------------------- |
| `docker-compose` (Python, Compose v1)            | `docker compose` (CLI plugin); v1 gets no updates                                              | July 2023                    |
| `version: "3.8"` at the top of Compose files     | No `version` key; the file is named `compose.yaml`                                             | Compose Specification        |
| `DOCKER_BUILDKIT=1 docker build`                 | BuildKit is the default builder                                                                | Engine 23.0 (2023)           |
| `apt-key add` for Docker's repository            | A keyring file referenced with `Signed-By`; `apt-key` is gone from Debian 13 and Ubuntu 25.04+ | apt 2.9.17 (2024)            |
| `--link` between containers                      | User-defined networks with DNS; links no longer set environment variables                      | Engine 29 (November 2025)    |
| `DOCKER_CONTENT_TRUST=1`                         | Removed from the CLI; sign with cosign or Notation                                             | Engine 29 (November 2025)    |
| Images stored by Docker's own graph drivers      | containerd image store on fresh installs; new `docker image ls` view                           | Engine 29 (November 2025)    |
| `postgres` volumes at `/var/lib/postgresql/data` | Mount at `/var/lib/postgresql` for Postgres 18 images                                          | postgres:18 (2025)           |
| Builds inside Compose                            | Compose v5 hands builds to Docker Bake                                                         | Compose v5.0 (December 2025) |

## Prerequisites

- A computer running Linux, macOS or Windows where you can install software.
- Basic comfort with a terminal. The [Introduction to Linux](/guides/introduction-to-linux) guide covers it.
- For [Part 10](/guides/introduction-to-docker/10-docker-in-production): a GitHub repository and, if you want to deploy, a Linux server with a DNS name.

You do not need to know Python: the example app is short, and every part explains what it does.

## Practice Hands-On

Try the commands from this guide in your browser with the [Docker Terminal simulator](/games/docker-terminal-simulator), see what happens inside the engine in the [Docker under the hood simulator](/games/docker-under-the-hood-simulator), then test yourself with the [Docker quiz](/quizzes/docker-quiz) and the [Docker flashcards](/flashcards/docker-essentials).

## Keep Learning

- [How I Finally Understood Docker and Kubernetes](/posts/how-i-finally-understood-docker-and-kubernetes)
- [Docker Security Hardening Checklist](/checklists/docker-security)
- [Podman vs Docker](/comparisons/podman-vs-docker)
- Next guide: [Introduction to Kubernetes](/guides/introduction-to-kubernetes)

Start with [Part 1: What Is Docker?](/guides/introduction-to-docker/01-docker-basics), or jump to [installing Docker](/guides/introduction-to-docker/02-docker-installation) if you know the concepts.
