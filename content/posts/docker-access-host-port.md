---
title: 'How to Access Host Port from Docker Container'
excerpt: "Learn how to access a host machine's port from a Docker container using network configurations and best practices."
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-11-20'
publishedAt: '2024-11-20T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Networking
  - Host
  - DevOps
---

## TLDR

To access a host port from a Docker container, use the `host.docker.internal` hostname on macOS/Windows or the host's IP address on Linux. Configure the container's network mode if needed.

---

Sometimes, you need a Docker container to communicate with a service running on the host machine. This guide explains how to access host ports from containers across different platforms.

### Why Access Host Ports?

- **Local Development**: Test containerized apps with services running on the host.
- **Debugging**: Connect to host-based tools or databases.
- **Integration**: Bridge containerized and non-containerized services.

### macOS and Windows: Use `host.docker.internal`

On macOS and Windows, Docker provides a special hostname, `host.docker.internal`, that resolves to the host machine's IP address.

Example:

```bash
# Access a service on host port 8080
curl http://host.docker.internal:8080
```

This works out of the box for most setups.

### Linux: Use the Host's IP Address

On Linux, `host.docker.internal` is not available by default. Instead, use the host's IP address. To find it:

```bash
# Get the host's IP address
ip addr show docker0
```

Look for the `inet` field. For example, if the IP is `172.17.0.1`, use it in your container:

```bash
curl http://172.17.0.1:8080
```

### Using Host Network Mode

For direct access to host ports, run the container in `--network host` mode:

```bash
docker run --rm --network host nginx:alpine
```

In this mode, the container shares the host's network namespace, so it can access all host ports directly. Note that this mode is not recommended for production due to security concerns.

### Visualizing the Connection

  +-------------------+
  |   Host Machine    |
  +-------------------+
         ^
         |
  +-------------------+
  | Docker Container  |
  +-------------------+

### Best Practices

- Use `host.docker.internal` for simplicity on macOS/Windows.
- Avoid `--network host` in production unless absolutely necessary.
- Document host-port dependencies in your project.

By following these steps, you can enable seamless communication between Docker containers and host services.

Good luck with your project!

## Related Resources

- [Connect to Host Localhost from Docker](/posts/connect-to-host-localhost-from-docker) — more on host networking
- [Docker Compose: Ports vs Expose](/posts/docker-compose-ports-vs-expose) — port publishing fundamentals
- [Introduction to Docker: Networking](/guides/introduction-to-docker) — Docker networking guide
- [Docker Quiz](/quizzes/docker-quiz) — test your Docker knowledge
- [DevOps Roadmap](/roadmap) — where Docker fits in your learning path
