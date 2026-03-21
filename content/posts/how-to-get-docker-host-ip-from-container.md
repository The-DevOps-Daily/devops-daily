---
title: 'How to Get the IP Address of the Docker Host from Inside a Docker Container'
excerpt: "Need your container to talk to the Docker host? Learn practical ways to discover the host's IP address from inside a container, with examples for Linux, macOS, and Windows."
category:
  name: 'Docker'
  slug: 'docker'
date: '2025-04-19'
publishedAt: '2025-04-19T09:00:00Z'
updatedAt: '2026-03-21T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Networking
  - Containers
  - DevOps
---

## TLDR

To access the Docker host from inside a container, you can use special DNS names like `host.docker.internal` (on Docker Desktop), or discover the host's IP address using network tricks on Linux. This guide covers the best approaches for each platform, with code examples and caveats.

## Why Would You Need the Host IP?

Sometimes, a container needs to connect to a service running on the Docker host—maybe a database, a local API, or a debugging tool. Since containers run in their own network namespace, they can't just use `localhost` to reach the host. Instead, you need to know the host's IP address or use a special DNS name.

## The Easy Way: `host.docker.internal` (Docker Desktop)

On Docker Desktop (macOS, Windows, and recent Linux), Docker provides a built-in DNS name that always resolves to the host:

```bash
ping host.docker.internal
```

You can use this name in your app configs, curl commands, or anywhere you need to reach the host. For example:

```bash
curl http://host.docker.internal:8080
```

This works out of the box on Docker Desktop. On Linux, support was added in Docker 20.04+, but may require enabling (see below).

## On Linux: Finding the Host IP

If `host.docker.internal` doesn't work, you can use a few tricks to get the host's IP address from inside a container.

### 1. Use the Default Gateway

Docker's default bridge network sets the host as the gateway. You can find it like this:

```bash
# Inside the container
ip route | awk '/default/ { print $3 }'
```

This prints the gateway IP, which is usually the host's address from the container's perspective. You can use it in scripts or configs:

```bash
export DOCKER_HOST_IP=$(ip route | awk '/default/ { print $3 }')
```

### 2. Add an Extra Host at Runtime

You can explicitly map a hostname to the host's IP when starting the container:

```bash
docker run --add-host=host.docker.internal:host-gateway my-image
```

With recent Docker versions, `host-gateway` is a special value that resolves to the host's IP. Now, `host.docker.internal` will work inside the container, even on Linux.

### 3. Use Host Networking (Linux Only)

If you don't need network isolation, you can run the container with the host's network stack:

```bash
docker run --network host my-image
```

Now, `localhost` inside the container is the same as on the host. This is simple, but removes network isolation and doesn't work on Docker Desktop for Mac/Windows.

## Quick Reference Table

```
+------------------------+---------------------+-----------------------------+
| Platform               | Easiest Solution    | Notes                       |
+------------------------+---------------------+-----------------------------+
| Docker Desktop (all)   | host.docker.internal| Built-in, works everywhere  |
| Linux (modern Docker)  | --add-host/host-gateway | Needs Docker 20.04+   |
| Linux (older Docker)   | ip route trick      | Use gateway IP              |
| Linux (no isolation)   | --network host      | localhost = host            |
+------------------------+---------------------+-----------------------------+
```

## Example: Connecting to a Host Service from a Container

Suppose you have a web server running on your host at port 5000, and you want to access it from a containerized app. Here are two ways to do it:

**Using `host.docker.internal` (Docker Desktop or with --add-host):**

```bash
curl http://host.docker.internal:5000
```

**Using the gateway IP (Linux):**

```bash
HOST_IP=$(ip route | awk '/default/ { print $3 }')
curl http://$HOST_IP:5000
```

## Caveats and Security Notes

- Exposing host services to containers can be risky. Only do this for trusted containers or during development.
- The `--network host` mode removes network isolation—avoid in production unless you know the risks.
- The gateway IP trick may not work with custom Docker networks or in Kubernetes pods.

## Conclusion

Accessing the Docker host from inside a container is easy with the right approach for your platform. Use `host.docker.internal` when available, or fall back to the gateway IP trick on Linux. For advanced setups, check your Docker and network configuration. Test your solution to make sure it works in your environment.


## Related Resources

- [Get Docker Container IP from Host](/posts/how-to-get-docker-container-ip-from-host) — reverse direction
- [Docker Access Host Port](/posts/docker-access-host-port) — host access patterns
- [Connect to Host Localhost from Docker](/posts/connect-to-host-localhost-from-docker) — host networking
- [Introduction to Docker: Networking](/guides/introduction-to-docker) — networking guide
