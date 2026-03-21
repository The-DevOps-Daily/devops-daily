---
title: 'Cannot Connect to the Docker Daemon at unix:/var/run/docker.sock. Is the Docker Daemon Running?'
excerpt: 'Troubleshoot the common Docker error about not being able to connect to the Docker daemon. Learn why it happens and how to fix it on Linux and macOS.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-04-05'
publishedAt: '2024-04-05T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Troubleshooting
  - Linux
  - macOS
  - DevOps
---

## TLDR

If you see "Cannot connect to the Docker daemon at unix:/var/run/docker.sock", it usually means Docker isn't running or your user doesn't have permission. Start the Docker service or fix permissions to resolve it.

## Prerequisites

- Docker installed
- Terminal access
- Sudo privileges (for some fixes)

## Check if Docker is Running

First, check if the Docker daemon is active. On macOS, make sure Docker Desktop is running. On Linux, use:

```bash
# Check Docker service status (Linux)
systemctl status docker
```

If it's not running, start it:

```bash
# Start Docker service (Linux)
sudo systemctl start docker
```

On macOS, launch Docker Desktop from Applications.

## Fix Permissions on the Docker Socket

If Docker is running but you still get the error, your user might not have permission to access the Docker socket. You can add your user to the `docker` group:

```bash
# Add your user to the docker group (Linux)
sudo usermod -aG docker $USER

# Log out and back in for the group change to take effect
```

On macOS, this is rarely needed, but restarting Docker Desktop can help.

## Check for Stale or Broken Docker Socket

Sometimes the socket file can get corrupted. Remove it and restart Docker:

```bash
# Remove the socket file and restart Docker (Linux)
sudo rm /var/run/docker.sock
sudo systemctl restart docker
```

## Visualizing the Docker Daemon Connection

+-------------------+
| docker client |
+-------------------+
|
v
+-------------------+
| /var/run/docker.sock |
+-------------------+
|
v
+-------------------+
| docker daemon |
+-------------------+

## Next Steps

If you still have issues, check Docker logs or reinstall Docker. For CI environments, make sure the Docker service is started in your pipeline config.

Good luck with your project!
