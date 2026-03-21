---
title: "What Is the Difference Between 'docker compose' and 'docker-compose'?"
excerpt: "Confused about 'docker compose' vs 'docker-compose'? Learn the key differences, why the new command exists, and which one you should use for your projects."
category:
  name: 'Docker'
  slug: 'docker'
date: '2025-04-24'
publishedAt: '2025-04-24T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - docker-compose
  - CLI
  - DevOps
---

## TLDR

`docker compose` is the modern, built-in Docker CLI command for managing multi-container apps, while `docker-compose` is the legacy standalone tool. Both use the same YAML files, but `docker compose` is the future and offers better integration, new features, and improved performance.

## The Old Way: `docker-compose`

`docker-compose` (with a hyphen) is the original tool for running multi-container Docker applications. It's a separate Python-based binary you install with pip or your package manager:

```bash
pip install docker-compose
# or
brew install docker-compose
```

You run it like this:

```bash
docker-compose up
```

## The New Way: `docker compose`

`docker compose` (with a space) is the new subcommand built directly into the Docker CLI. It's written in Go, ships with Docker Desktop and recent Docker Engine versions, and is the official replacement for the old tool.

You use it like this:

```bash
docker compose up
```

No need to install anything extra—just update Docker.

## Key Differences

- **Integration:** `docker compose` is part of the main Docker CLI, so you get a consistent experience and better support for new Docker features.
- **Performance:** The new command is faster and uses less memory, especially for large projects.
- **Features:** Some new features (like Compose profiles, better volume/network handling, and Compose Spec support) are only available in `docker compose`.
- **Compatibility:** Both commands use the same `docker-compose.yml` files, but some edge-case flags or behaviors may differ. Check the [Compose V2 migration guide](https://docs.docker.com/compose/migrate/) if you run into issues.
- **Maintenance:** `docker-compose` (the old tool) is in maintenance mode. All new development is on `docker compose`.

## Which Should You Use?

- For new projects, always use `docker compose`.
- For old scripts or CI pipelines, you can keep using `docker-compose` for now, but plan to migrate.
- If you hit a missing feature or bug, check if you're using the latest Docker version.

## How to Check Your Version

To see which Compose you have:

```bash
docker compose version
# or
docker-compose version
```

If you see a warning about Compose V1 being deprecated, it's time to switch.

## Conclusion

`docker compose` is the modern, supported way to manage multi-container Docker apps. It replaces the old `docker-compose` tool, brings new features, and is the best choice for future-proofing your workflow. Update your Docker installation and start using the new command for a smoother experience.

## Related Resources

- [Docker Compose vs Dockerfile](/posts/docker-compose-vs-dockerfile) — understand when to use each
- [Docker Compose vs Kubernetes](/posts/docker-compose-vs-kubernetes-differences) — choosing the right orchestration tool
- [Docker Compose Environment Variables](/posts/docker-compose-environment-variables) — configure Compose services
- [Introduction to Docker Guide](/guides/introduction-to-docker) — learn Docker from scratch
- [DevOps Roadmap](/roadmap) — where Docker fits in your learning path
