---
title: "How to Get a Docker Container's IP Address from the Host"
excerpt: "Learn how to find a Docker container's internal IP address from your host machine using simple Docker commands. This is useful for debugging, testing services, or container communication."
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-10-11'
publishedAt: '2024-10-11T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Networking
  - Containers
  - DevOps
  - IP Address
  - Docker Networking
featured: false
---

When you're working with Docker, there are times when you need to access a container directly from your host machine. For example, you might want to debug a database, test an internal service, or allow traffic from the host into a container.

This tutorial shows you how to get a Docker container's internal IP address from the host and when it's appropriate to use it. We'll also cover common use cases, networking tips, and safer alternatives when possible.

## Prerequisites

To follow along, make sure you have:

- Docker installed (Docker Engine 24 or later recommended)
- A running Docker container
- Terminal access to your host machine

## Why You Might Need a Docker Container's IP Address

Docker assigns a private IP address to each container. This is usually in the `172.17.0.0/16` range for default bridge networks. Knowing a container's IP can be useful if:

- You want to test connectivity or API responses from the host
- You're debugging services like PostgreSQL, Redis, or custom apps
- You're configuring a firewall or network policy on the host

Keep in mind: container IPs can change if the container restarts or is recreated.

## Step 1: Find the Running Container

Start by listing your running containers using:

```bash
docker ps
```

This gives you the container ID and name. For example:

```text
CONTAINER ID   IMAGE         COMMAND                  NAMES
35c5a6f4a0d1   postgres:16   "docker-entrypoint.sh"   dev-db
```

## Step 2: Inspect the Container's IP Address

Use `docker inspect` with the `--format` flag to pull just the IP address:

```bash
docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' dev-db
```

This returns something like:

```text
172.17.0.3
```

This is the internal IP assigned to the container on the bridge network. You can use this address to connect from your host.

## Step 3: Connect to the Container from the Host

Let's say your container is running a Postgres database. You can connect to it from your host like this:

```bash
psql -h 172.17.0.3 -U postgres
```

Or if it's running a web app:

```bash
curl http://172.17.0.3:8080
```

Important: this only works from the host machine. Other containers won't be able to connect this way unless they share a custom network.

## Tip: Use `docker exec` Instead (For Debugging)

In many cases, it's easier to skip the IP and connect from inside the container directly:

```bash
docker exec -it dev-db psql -U postgres
```

This runs the command inside the container's environment.

## Working with Custom Docker Networks

If you've created a custom user-defined bridge network, Docker gives you built-in DNS between containers.

```bash
# Create a custom Docker network
docker network create mynet

# Start a container on that network
docker run -d --name web --network mynet nginx
```

Now, any other container on `mynet` can access `web` using its container name:

```bash
curl http://web
```

This is more stable than relying on IPs, especially when containers are restarted or recreated.

---

Getting a Docker container's IP address from the host is useful for quick debugging and testing, but it's not ideal for long-term setups. Instead, use Docker networks and container names for more reliable and scalable configurations.

If you find yourself needing container IPs regularly, it might be time to rethink your network strategy.


## Related Resources

- [How to Get Docker Host IP from Container](/posts/how-to-get-docker-host-ip-from-container) — reverse direction
- [Connect to Host Localhost from Docker](/posts/connect-to-host-localhost-from-docker) — host networking
- [Docker Compose: Ports vs Expose](/posts/docker-compose-ports-vs-expose) — networking concepts
- [Introduction to Docker: Networking](/guides/introduction-to-docker) — networking guide
