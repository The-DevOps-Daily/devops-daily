---
title: 'How to Fix Docker: Permission Denied'
excerpt: "Getting a 'permission denied' error when using Docker can be frustrating. Here's how to fix it depending on the OS, Docker command, and user setup."
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-11-15'
publishedAt: '2024-11-15T09:00:00Z'
updatedAt: '2026-03-21T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Troubleshooting
  - Permissions
  - Linux
  - DevOps
---

If you've run into a `permission denied` error with Docker, you're not alone. Whether you're trying to run `docker` without `sudo`, mount a volume, or access a file inside the container, this error is one of the most common stumbling blocks.

In this guide, we'll walk through how to fix Docker permission denied issues depending on the context and your operating system.

## Prerequisites

Before you start, make sure:

- Docker is installed and the service is running
- You have access to a terminal with sufficient permissions

## Scenario 1: Running `docker` Without `sudo` Gives Permission Denied

If you get a permission error like this:

```bash
Got permission denied while trying to connect to the Docker daemon socket
```

It usually means your user isn't in the `docker` group.

### Fix:

1. Add your user to the Docker group:

```bash
sudo usermod -aG docker $USER
```

2. Log out and log back in (or reboot) to apply the group change.

3. Verify with:

```bash
groups $USER
```

4. Test without `sudo`:

```bash
docker ps
```

You should no longer see the error.

## Scenario 2: Permission Denied When Mounting a Volume

If you see an error like:

```bash
Error response from daemon: Mounts denied
```

This is common on macOS or Windows when you're trying to mount a local directory into a container.

### Fix (macOS/Windows):

1. Open Docker Desktop > Settings > Resources > File Sharing
2. Make sure the directory you're trying to mount is listed

If it's not, add it and restart Docker.

### Fix (Linux):

Make sure the directory exists and has the correct permissions:

```bash
mkdir -p /my/data
sudo chown $USER:$USER /my/data
```

Then run:

```bash
docker run -v /my/data:/app/data my-image
```

## Scenario 3: Permission Denied on a File Inside the Container

Sometimes your app can't access a file inside the container due to restrictive permissions.

### Fix:

Check file permissions and ownership in your Dockerfile or entrypoint script. You can add:

```Dockerfile
RUN chmod -R 755 /app && chown -R appuser:appuser /app
```

Or debug live with:

```bash
docker exec -it my-container bash
ls -l /path/to/file
```

Adjust as needed using `chmod` or `chown`.

## Bonus: AppArmor and SELinux

On some Linux systems, you might hit issues due to AppArmor or SELinux blocking access silently.

If you're using SELinux (e.g. on CentOS, RHEL, Fedora), try adding the `:z` or `:Z` flags when mounting:

```bash
docker run -v /host/data:/container/data:Z my-image
```

This adjusts security contexts automatically.

## Still Not Working?

Check Docker logs for more context:

```bash
journalctl -u docker.service
```

Or try running the command with `sudo` to isolate whether it's a user permission issue or something deeper.

---

Permission denied errors in Docker are common but fixable. Whether it's your user group, a volume mount, or file ownership, the key is to identify where the access is blocked and adjust accordingly.

Once you get familiar with the patterns, solving these becomes second nature.


## Related Resources

- [Cannot Connect to Docker Daemon](/posts/cannot-connect-to-docker-daemon) — related daemon issues
- [How to Use Sudo in Docker Container](/posts/how-to-use-sudo-in-docker-container) — container permissions
- [Docker Security Best Practices](/posts/docker-security-best-practices) — run as non-root
- [Introduction to Docker Guide](/guides/introduction-to-docker) — proper Docker setup
