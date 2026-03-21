---
title: 'Cannot Connect to Docker Daemon at unix:/var/run/docker.sock - Is the Docker Daemon Running?'
excerpt: "Fix the common 'Cannot connect to the Docker daemon' error with practical solutions for Linux, macOS, and Windows. Learn why this happens and how to resolve permissions and service issues."
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-12-28'
publishedAt: '2024-12-28T09:00:00Z'
updatedAt: '2024-12-28T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Troubleshooting
  - Linux
  - Permissions
  - DevOps
---

You run a Docker command and get: "Cannot connect to the Docker daemon at unix:/var/run/docker.sock. Is the docker daemon running?" What's wrong, and how do you fix it?

## TL;DR

This error means either the Docker daemon isn't running, or your user doesn't have permission to connect to it. Check if Docker is running with `sudo systemctl status docker` (Linux) or by checking Docker Desktop (macOS/Windows). If it's running, add your user to the docker group with `sudo usermod -aG docker $USER`, then log out and back in. On macOS/Windows with Docker Desktop, make sure the application is started.

The error occurs when the Docker client (the `docker` command you run) can't communicate with the Docker daemon (the background service that actually manages containers).

```
Client (docker CLI)  --->  Cannot connect  --->  Daemon (dockerd)
        You                                      Background service
```

Let's diagnose and fix the problem systematically.

## Check If Docker Daemon Is Running

First, verify whether the Docker service is actually running.

On Linux with systemd:

```bash
sudo systemctl status docker
```

If it's not running, you'll see `inactive (dead)`. If it's running, you'll see `active (running)`.

Start Docker if it's stopped:

```bash
sudo systemctl start docker
```

Enable Docker to start on boot:

```bash
sudo systemctl enable docker
```

On macOS or Windows with Docker Desktop, open the Docker Desktop application. If it's not running, the daemon won't be available.

## Permission Issues (Most Common Cause)

Even if Docker is running, you might not have permission to connect to the socket.

The Docker socket `/var/run/docker.sock` is owned by root and the docker group. Your user needs to be in the docker group:

```bash
# Check if docker group exists and who's in it
getent group docker
```

Add your user to the docker group:

```bash
sudo usermod -aG docker $USER
```

The `-aG` flags mean "append to group" - it adds your user without removing you from other groups.

After adding yourself to the group, you need to log out and log back in for the change to take effect. Alternatively, you can start a new shell with the group active:

```bash
newgrp docker
```

Now try a Docker command:

```bash
docker ps
```

If this works, the problem was permissions.

## Verify the Socket Exists

Check if the Docker socket file exists:

```bash
ls -l /var/run/docker.sock
```

You should see something like:

```
srwxrwxrwx 1 root docker 0 Dec 28 10:00 /var/run/docker.sock
```

If the file doesn't exist, Docker isn't running or isn't creating the socket properly.

## Starting Docker Service

On Ubuntu/Debian:

```bash
sudo systemctl start docker
sudo systemctl enable docker
```

On CentOS/RHEL:

```bash
sudo systemctl start docker
sudo systemctl enable docker
```

On older systems using init.d:

```bash
sudo service docker start
```

## Docker Desktop on macOS

If you installed Docker Desktop on macOS:

1. Open the Docker Desktop application from Applications
2. Wait for the whale icon in the menu bar to show it's running
3. Click the icon and verify it says "Docker Desktop is running"

If Docker Desktop won't start:

- Check if there's enough disk space
- Restart your computer
- Reinstall Docker Desktop if necessary

## Docker Desktop on Windows

For Windows users with Docker Desktop:

1. Launch Docker Desktop from the Start menu
2. Wait for the notification that Docker is running
3. Check the system tray for the Docker whale icon

If you're using WSL2 backend:

- Make sure WSL2 is properly installed and updated
- Check that virtualization is enabled in BIOS
- Verify that the WSL2 integration is enabled in Docker Desktop settings

## Checking Docker Installation

Verify Docker is properly installed:

```bash
# Check Docker version
docker --version

# Check if dockerd is installed
which dockerd

# Check Docker system info (requires daemon)
docker info
```

If `docker --version` works but `docker info` fails, the client is installed but the daemon isn't running.

## Common Scenarios and Solutions

**Scenario 1: "docker: command not found"**

Docker isn't installed. Install it:

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install docker.io

# CentOS/RHEL
sudo yum install docker

# Or install Docker Engine directly from Docker's repos
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

**Scenario 2: Permission denied**

Your user isn't in the docker group:

```bash
sudo usermod -aG docker $USER
newgrp docker
```

**Scenario 3: Socket doesn't exist**

The daemon isn't running:

```bash
sudo systemctl start docker
```

**Scenario 4: Docker service fails to start**

Check logs for the error:

```bash
sudo journalctl -u docker.service -n 50 --no-pager
```

Common issues:
- Port conflicts (another service using Docker's ports)
- Configuration errors in `/etc/docker/daemon.json`
- Insufficient resources (disk space, memory)

## Using sudo as a Temporary Workaround

If you don't want to add your user to the docker group, you can use sudo:

```bash
sudo docker ps
sudo docker run hello-world
```

But this is inconvenient and not recommended for regular use. The docker group approach is better.

## Verifying the Fix

After fixing the issue, test Docker:

```bash
# List running containers
docker ps

# Run a test container
docker run hello-world

# Check system information
docker info
```

If these commands work without sudo and without errors, Docker is properly configured.

## Security Considerations

Adding a user to the docker group gives them root-equivalent access to the system, because they can:

- Mount any host directory into a container
- Run containers with root privileges
- Access any file on the host system through volume mounts

```bash
# Example of why docker group is powerful:
# This gives you a root shell on the host
docker run -v /:/host -it ubuntu chroot /host
```

Only add trusted users to the docker group. For production systems, consider:

- Using Docker in rootless mode
- Implementing proper authentication and authorization
- Using tools like Docker Content Trust
- Auditing Docker commands

## Docker in Rootless Mode

For better security, run Docker without root privileges:

```bash
# Install rootless Docker
dockerd-rootless-setuptool.sh install

# Use it
systemctl --user start docker
```

In rootless mode, the socket is at a different location:

```
/run/user/<uid>/docker.sock
```

The client automatically uses this socket when configured for rootless mode.

## Troubleshooting Checklist

Go through this checklist when encountering the error:

1. Is Docker installed? Run `docker --version`
2. Is the daemon running? Run `sudo systemctl status docker` (Linux) or check Docker Desktop (macOS/Windows)
3. Does the socket exist? Run `ls -l /var/run/docker.sock`
4. Is your user in the docker group? Run `groups` and look for `docker`
5. Have you logged out and back in after adding to group?
6. Are there errors in the Docker logs? Run `sudo journalctl -u docker.service`

## When Docker Desktop Is the Issue

On macOS and Windows, Docker Desktop can have specific issues:

**Not enough resources:**
- Docker Desktop Settings → Resources → Increase CPU/Memory/Disk

**Networking issues:**
- Reset Docker Desktop to factory defaults
- Check firewall/antivirus isn't blocking Docker

**Update issues:**
- Uninstall completely and reinstall the latest version
- Check Docker Desktop release notes for known issues

## Practical Example: First-Time Setup

Here's a complete first-time setup on Ubuntu:

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Add your user to docker group
sudo usermod -aG docker $USER

# Log out and log back in, or use newgrp
newgrp docker

# Test Docker
docker run hello-world
```

If you see "Hello from Docker!" you're all set.

The "Cannot connect to the Docker daemon" error is usually either a stopped service or a permissions issue. Start the Docker service with `systemctl start docker`, add your user to the docker group with `usermod -aG docker $USER`, log out and back in, and you should be good to go. For Docker Desktop users, just make sure the application is running.

## Related Resources

- [How to Fix Docker: Permission Denied](/posts/fix-docker-permission-denied-error) — related permissions troubleshooting
- [Introduction to Docker: Installation](/guides/introduction-to-docker) — set up Docker properly from the start
- [Docker Flashcards](/flashcards/docker-essentials) — review core Docker concepts
- [DevOps Roadmap](/roadmap) — where Docker fits in your learning path
