---
title: "Docker Can't Connect to Docker Daemon"
excerpt: "Learn how to troubleshoot and resolve the Docker can't connect to Docker daemon error effectively."
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-06-30'
publishedAt: '2024-06-30T09:00:00Z'
updatedAt: '2024-06-30T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Troubleshooting
  - DevOps
---

## TLDR

The "Docker can't connect to Docker daemon" error occurs when the Docker client cannot communicate with the Docker daemon. Check permissions, service status, and environment variables to resolve the issue.

---

The "Docker can't connect to Docker daemon" error is a common issue that prevents Docker commands from working. This guide explains the causes and provides step-by-step solutions to fix it.

## Step 1: Check Docker Service Status

Ensure the Docker daemon is running.

### Command

```bash
sudo systemctl status docker
```

### Example Output

```plaintext
● docker.service - Docker Application Container Engine
   Loaded: loaded (/lib/systemd/system/docker.service; enabled; vendor preset: enabled)
   Active: active (running) since Mon 2024-06-30 09:00:00 UTC; 5min ago
```

### Explanation

- `Active: active (running)`: Indicates the Docker daemon is running.
- If the service is not active, start it using:

```bash
sudo systemctl start docker
```

## Step 2: Verify Permissions

Check if your user has permission to access the Docker daemon.

### Command

```bash
sudo usermod -aG docker $USER
```

### Explanation

- `usermod -aG docker $USER`: Adds your user to the `docker` group.
- Log out and log back in for the changes to take effect.

## Step 3: Check Environment Variables

Ensure the `DOCKER_HOST` environment variable is set correctly.

### Command

```bash
echo $DOCKER_HOST
```

### Example Output

```plaintext
unix:///var/run/docker.sock
```

### Explanation

- `unix:///var/run/docker.sock`: Default socket for Docker communication.
- If the variable is incorrect, reset it using:

```bash
export DOCKER_HOST=unix:///var/run/docker.sock
```

## Step 4: Inspect Docker Socket

Verify the Docker socket exists and has the correct permissions.

### Command

```bash
ls -l /var/run/docker.sock
```

### Example Output

```plaintext
srw-rw---- 1 root docker 0 Jun 30 09:00 /var/run/docker.sock
```

### Explanation

- `srw-rw----`: Indicates the socket is accessible to the `docker` group.
- If permissions are incorrect, fix them using:

```bash
sudo chmod 660 /var/run/docker.sock
sudo chown root:docker /var/run/docker.sock
```

## Step 5: Debugging with Logs

Check Docker logs for additional clues.

### Command

```bash
sudo journalctl -u docker
```

### Explanation

- `journalctl -u docker`: Displays logs for the Docker service.
- Look for errors or warnings that indicate the root cause.

## Best Practices

- **Automate Setup**: Include user permissions and environment variable configuration in your setup scripts.
- **Monitor Docker Service**: Use monitoring tools to ensure the Docker daemon is always running.
- **Secure Docker Socket**: Restrict access to the Docker socket to prevent unauthorized use.

By following these steps, you can resolve the "Docker can't connect to Docker daemon" error and ensure smooth operation of your Docker environment.

## Related Resources

- [Cannot Connect to Docker Daemon at unix:/var/run/docker.sock](/posts/cannot-connect-to-docker-daemon) — in-depth troubleshooting for this error
- [How to Fix Docker: Permission Denied](/posts/fix-docker-permission-denied-error) — solve permission issues
- [Introduction to Docker Guide](/guides/introduction-to-docker) — learn Docker from scratch
- [Docker Quiz](/quizzes/docker-quiz) — test your Docker knowledge
