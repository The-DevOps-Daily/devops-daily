---
title: "ps Command Doesn't Work in Docker Container"
excerpt: 'Learn why the `ps` command might not work in Docker containers and how to resolve it.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-07-11'
publishedAt: '2024-07-11T09:00:00Z'
updatedAt: '2024-07-11T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Troubleshooting
  - Tutorials
---

## TLDR

The `ps` command might not work in Docker containers due to missing packages or limited process visibility. Install `procps` or use alternative tools to inspect processes.

---

The `ps` command is commonly used to list running processes, but it might not work as expected in Docker containers. This guide explains why and provides solutions to troubleshoot and resolve the issue.

## Why Doesn't `ps` Work?

Docker containers often use minimal base images to reduce size. These images might not include the `procps` package, which provides the `ps` command. Additionally, containers have limited visibility into processes outside their namespace.

## Step 1: Check for `procps`

Verify if the `procps` package is installed in your container.

Run the following command inside your Docker container:

```bash
ps
```

You might see an error like this:

```plaintext
bash: ps: command not found
```

If you see this error, the `procps` package is missing.

## Step 2: Install `procps`

Install the `procps` package to enable the `ps` command.

### Command

For Debian/Ubuntu-based images:

```bash
apt-get update && apt-get install -y procps
```

For Alpine-based images:

```bash
apk add procps
```

### Explanation

- `apt-get update`: Updates package lists.
- `apt-get install -y procps`: Installs `procps` on Debian/Ubuntu.
- `apk add procps`: Installs `procps` on Alpine.

## Step 3: Use Alternative Tools

If installing `procps` is not an option, use alternative tools to inspect processes.

### Example

```bash
cat /proc/<pid>/status
```

### Explanation

- `/proc/<pid>/status`: Provides detailed information about a specific process.

## Step 4: Debugging Process Visibility

Containers have limited visibility into processes outside their namespace. Use the `docker top` command to list processes running in a container.

### Command

```bash
docker top <container_name>
```

### Example Output

```plaintext
PID    USER   COMMAND
12345  root   /bin/bash
67890  root   sleep 100
```

### Explanation

- `docker top`: Lists processes running inside the container.

## Best Practices

- **Use Minimal Images**: Only install necessary packages.
- **Automate Setup**: Include `procps` installation in your Dockerfile if `ps` is required.
- **Understand Namespaces**: Learn how Docker isolates processes.

By following these steps, you can resolve issues with the `ps` command in Docker containers and effectively inspect running processes.


## Related Resources

- [Docker Ubuntu: Ping Not Found](/posts/docker-ubuntu-ping-not-found) — install missing tools
- [Docker Alpine: How to Use Bash](/posts/docker-alpine-use-bash) — shell tools in Alpine
- [How to Access Docker Container Shell](/posts/how-to-access-docker-container-shell) — shell access
- [Introduction to Docker Guide](/guides/introduction-to-docker) — Docker fundamentals
