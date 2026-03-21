---
title: 'How to Use docker-compose up for Only Certain Containers'
excerpt: 'Want to start just a few services from your docker-compose file? Learn how to use docker-compose up to run only specific containers, with practical examples and tips for multi-service projects.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2025-04-22'
publishedAt: '2025-04-22T09:00:00Z'
updatedAt: '2025-04-22T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - docker-compose
  - Containers
  - DevOps
---

## TLDR

You don't have to start every service in your `docker-compose.yml` at once. Use `docker-compose up <service1> <service2>` to launch only the containers you need. This is handy for development, testing, or when you want to save resources.

## Why Start Only Certain Containers?

In real-world projects, your `docker-compose.yml` might define several services—databases, caches, web apps, workers, and more. Sometimes you only want to run a subset, like just the API and database for local development, or a single worker for debugging.

## How to Start Specific Services

The syntax is simple:

```bash
docker-compose up <service1> <service2>
```

Replace `<service1>` and `<service2>` with the names of the services as defined in your `docker-compose.yml`.

**Example:**

Suppose your `docker-compose.yml` looks like this:

```yaml
version: '3.8'
services:
  db:
    image: postgres:15
  redis:
    image: redis:7
  web:
    build: ./web
    depends_on:
      - db
      - redis
  worker:
    build: ./worker
    depends_on:
      - db
```

To start only the `web` and `db` services:

```bash
docker-compose up web db
```

This will:

- Start `db` first
- Build and start `web`
- Not start `redis` or `worker`

If a service depends on another, Docker Compose will start the dependencies automatically if needed.

## Stopping and Removing Only Certain Containers

You can also stop or remove specific services:

```bash
docker-compose stop web db
docker-compose rm web db
```

This stops or removes just those containers, leaving others running.

## Tips for Multi-Service Projects

- You can list as many services as you want: `docker-compose up service1 service2 ...`
- If you run `docker-compose up` with no arguments, all services are started.
- Use `-d` to run in detached mode: `docker-compose up -d web db`
- To see logs for just certain services: `docker-compose logs web db`

## Conclusion

Starting only the containers you need with `docker-compose up` is a great way to speed up development and save resources. Just specify the service names, and Docker Compose will handle dependencies for you. Check your service names in the YAML file, and use this trick to streamline your workflow.

## Related Resources

- [Docker Compose: Wait for Container X Before Starting Y](/posts/docker-compose-wait-container) — control startup order
- [Docker Compose: Ports vs Expose](/posts/docker-compose-ports-vs-expose) — networking between services
- [Docker Compose Environment Variables](/posts/docker-compose-environment-variables) — configure services
- [Restart a Single Container in Docker Compose](/posts/restart-single-container-docker-compose) — manage individual services
- [Introduction to Docker: Compose](/guides/introduction-to-docker) — Docker Compose guide
