---
title: 'How to Run a Docker Image as a Container'
excerpt: 'Learn how to start a container from a Docker image, pass environment variables, map ports, and manage container lifecycle.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-06-10'
publishedAt: '2024-06-10T09:00:00Z'
updatedAt: '2024-06-10T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Containers
  - Run
  - DevOps
---

## TLDR

Use `docker run` to start a container from an image. You can map ports, set environment variables, and control the container's lifecycle with various flags.

---

Running a Docker image as a container is the core of container-based development. Whether you're testing locally or deploying to production, understanding how to use `docker run` gives you flexibility and control.

### Basic Usage

The simplest way to run a container is:

```bash
docker run nginx:alpine
```

This starts a new container from the `nginx:alpine` image. By default, it runs in the foreground and shows the container's output.

### Running in Detached Mode

To run the container in the background, add the `-d` flag:

```bash
docker run -d nginx:alpine
```

Now the container runs in the background, and you get the container ID.

### Mapping Ports

To access services inside the container, map ports from the host to the container:

```bash
docker run -d -p 8080:80 nginx:alpine
```

This maps port 8080 on your host to port 80 in the container. You can now access the service at `http://localhost:8080`.

### Passing Environment Variables

You can pass environment variables to configure your app:

```bash
docker run -e ENV=production my-app:latest
```

This sets the `ENV` variable inside the container.

### Mounting Volumes

To persist data or share files, mount a host directory:

```bash
docker run -v $(pwd)/data:/app/data my-app:latest
```

This mounts the local `./data` directory to `/app/data` in the container.

### Stopping and Removing Containers

List running containers:

```bash
docker ps
```

Stop a container:

```bash
docker stop <container_id>
```

Remove a container:

```bash
docker rm <container_id>
```

### Best Practices

- Use descriptive container names with `--name`.
- Clean up stopped containers to save resources.
- Use environment variables and volumes for configuration and data.

With these techniques, you can run, manage, and debug containers efficiently in any environment.

Good luck with your project!

## Related Resources

- [Docker Run vs Docker Start](/posts/docker-run-vs-docker-start) — understand the difference
- [Docker Image vs Container](/posts/docker-image-vs-container) — key concepts
- [Docker Compose: Ports vs Expose](/posts/docker-compose-ports-vs-expose) — port mapping
- [Pass Environment Variables to Docker Containers](/posts/pass-environment-variables-docker-containers) — configure at runtime
- [Introduction to Docker Guide](/guides/introduction-to-docker) — learn Docker from scratch
- [Docker Quiz](/quizzes/docker-quiz) — test your knowledge
