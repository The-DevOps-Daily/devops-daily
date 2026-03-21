---
title: 'How Do I Pass Environment Variables to Docker Containers?'
excerpt: 'Environment variables are a clean way to configure your Docker containers without hardcoding values. This guide shows different methods and when to use each.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-11-01'
publishedAt: '2024-11-01T09:00:00Z'
updatedAt: '2026-03-21T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Environment Variables
  - DevOps
  - Configuration
  - Containers
---

Environment variables let you configure your Docker containers without hardcoding values. Whether you're passing secrets, app settings, or deployment-specific flags, env vars make it clean and portable.

In this guide, you'll learn several ways to pass environment variables to containers and when to use each method.

## Prerequisites

You'll need:

- Docker installed (Docker Engine 24+)
- A basic Docker image and container setup

## Option 1: Use `-e` or `--env` on the Command Line

You can set environment variables directly with the `docker run` command:

```bash
docker run -e APP_ENV=production -e DEBUG=false my-app-image
```

This passes `APP_ENV` and `DEBUG` into the container at runtime.

Use this for quick tests or when setting a few variables.

## Option 2: Use an `.env` File

For more variables or shared configs, you can use a `.env` file:

```env
# .env file
APP_ENV=production
DEBUG=false
API_KEY=123abc
```

Then run:

```bash
docker run --env-file .env my-app-image
```

Docker will load every variable from that file into the container.

This is great for local development or keeping secrets out of your terminal history.

## Option 3: Set Env Vars in a Dockerfile

You can bake variables directly into the image using `ENV` in your Dockerfile:

```Dockerfile
# Dockerfile
FROM node:18
ENV APP_ENV=production
ENV DEBUG=false
```

These variables become part of the image and are always available in containers built from it.

Use this for default values that shouldn't change per deployment.

## Option 4: Use Compose Files (Recommended for Dev)

If you're using Docker Compose, you can define environment variables in `docker-compose.yml`:

```yaml
version: '3.8'
services:
  app:
    image: my-app-image
    environment:
      - APP_ENV=production
      - DEBUG=false
```

Or pull from a `.env` file automatically:

```env
# .env file (in same dir as docker-compose.yml)
APP_ENV=production
DEBUG=false
```

Docker Compose loads this automatically, no extra flags needed.

## Bonus: Accessing Env Vars Inside the Container

To see the values inside the container, you can run:

```bash
docker exec my-container printenv
```

Or check a specific variable:

```bash
docker exec my-container printenv APP_ENV
```

---

Environment variables give you a clean, flexible way to configure containers. For local work, `.env` files and Compose are easy to manage. For CI/CD, prefer `--env` flags or secrets managers.

Keep it clean, keep it configurable.

Happy shipping!


## Related Resources

- [Docker Compose Environment Variables](/posts/docker-compose-environment-variables) — Compose env vars
- [Docker Security Best Practices](/posts/docker-security-best-practices) — keep secrets safe
- [Dockerfile: Update PATH](/posts/dockerfile-update-path) — set env vars in builds
- [Introduction to Docker Guide](/guides/introduction-to-docker) — Docker fundamentals
