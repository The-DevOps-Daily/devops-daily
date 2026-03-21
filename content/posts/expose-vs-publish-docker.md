---
title: 'What is the Difference Between "Expose" and "Publish" in Docker?'
excerpt: "Understanding the difference between 'expose' and 'publish' in Docker is crucial for managing container networking effectively. Learn how these concepts work and when to use them."
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-12-01'
publishedAt: '2024-12-01T09:00:00Z'
updatedAt: '2024-12-01T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Networking
  - Containers
  - DevOps
  - Tutorials
---

## TLDR

In Docker, `EXPOSE` is used to declare the ports a container listens on at runtime, while `--publish` (or `-p`) maps a container's port to a port on the host machine, making it accessible externally. Use `EXPOSE` for documentation and internal communication between containers, and `--publish` to make services available outside the Docker host.

---

When working with Docker, understanding how to manage container networking is essential. Two commonly misunderstood concepts are `EXPOSE` and `--publish`. While they may seem similar, they serve distinct purposes. This guide will help you understand the difference and how to use them effectively.

## What Does `EXPOSE` Do?

The `EXPOSE` instruction in a Dockerfile is a way to declare that a container listens on specific ports at runtime. It does not actually publish the port to the host machine - it simply serves as metadata for the container.

### Example

Here is an example of using `EXPOSE` in a Dockerfile:

```dockerfile
# Dockerfile
FROM nginx:latest

# Declare that the container listens on port 80
EXPOSE 80
```

When you build and run this Dockerfile, Docker knows that the container listens on port 80. However, this port is not accessible from the host machine unless explicitly published.

### Why It Matters

- **Documentation**: `EXPOSE` serves as a form of documentation for developers, indicating which ports the application inside the container uses.
- **Inter-container Communication**: When using Docker's default bridge network, `EXPOSE` allows other containers to communicate with the exposed ports.

## What Does `--publish` Do?

The `--publish` (or `-p`) flag is used when running a container to map a container's port to a port on the host machine. This makes the container's service accessible externally.

### Example

Here is an example of using `--publish` to map a container's port:

```bash
docker run -d -p 8080:80 nginx
```

In this case:

- The container's port `80` is mapped to port `8080` on the host machine.
- You can access the Nginx server by navigating to `http://localhost:8080` in your browser.

### Why It Matters

- **External Access**: `--publish` is essential for making services available outside the Docker host.
- **Custom Port Mapping**: You can map container ports to any available port on the host machine.

## Key Differences Between `EXPOSE` and `--publish`

| Feature       | `EXPOSE`                             | `--publish` (`-p`)                 |
| ------------- | ------------------------------------ | ---------------------------------- |
| Purpose       | Declares container's listening ports | Maps container ports to host ports |
| Accessibility | Internal (within Docker network)     | External (accessible from host)    |
| Usage         | Dockerfile instruction               | Runtime flag                       |
| Example       | `EXPOSE 80`                          | `docker run -p 8080:80`            |

## Combining `EXPOSE` and `--publish`

You can use `EXPOSE` and `--publish` together. For example:

```dockerfile
# Dockerfile
FROM nginx:latest

# Declare the container listens on port 80
EXPOSE 80
```

Run the container with:

```bash
docker run -d -p 8080:80 nginx
```

In this case:

- `EXPOSE` documents that the container listens on port 80.
- `--publish` maps port 80 to port 8080 on the host, making it accessible externally.

## When to Use Each

- Use `EXPOSE` when you want to document the ports your containerized application uses or enable inter-container communication.
- Use `--publish` when you need to make a service accessible from outside the Docker host.

By understanding these concepts, you can better manage your containerized applications and their networking requirements.


## Related Resources

- [Docker Compose: Ports vs Expose](/posts/docker-compose-ports-vs-expose) — the Compose perspective
- [Expose Multiple Ports in Docker](/posts/expose-multiple-ports-docker) — multi-port setups
- [Docker Security Best Practices](/posts/docker-security-best-practices) — minimize attack surface
- [Introduction to Docker: Networking](/guides/introduction-to-docker) — networking deep dive
