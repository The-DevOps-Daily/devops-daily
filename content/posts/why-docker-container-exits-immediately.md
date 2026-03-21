---
title: 'Why Your Docker Container Exits Immediately'
excerpt: "Troubleshoot and fix Docker containers that start and immediately exit. Learn about foreground processes, CMD vs ENTRYPOINT, and common pitfalls that cause containers to stop."
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-12-21'
publishedAt: '2024-12-21T10:00:00Z'
updatedAt: '2024-12-21T10:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Containers
  - Troubleshooting
  - DevOps
  - Linux
---

**TLDR:** Docker containers exit immediately when their main process (defined by CMD or ENTRYPOINT) completes or fails. Common causes include running background services without keeping them in the foreground, syntax errors in commands, missing files, or using shell scripts that exit too quickly. Use `docker logs` to see why it exited and run processes in foreground mode or use tools like `tail -f` to keep the container alive.

When you run a Docker container and it immediately exits, you see something like this:

```bash
docker run myapp
# Returns to prompt immediately

docker ps
# CONTAINER ID   IMAGE   COMMAND   CREATED   STATUS   PORTS   NAMES
# (empty - no running containers)

docker ps -a
# Shows container with status "Exited (0) 2 seconds ago"
```

The container started but stopped right away. Here's why this happens and how to fix it.

## How Docker Containers Work

A Docker container runs as long as its main process is running. When that process exits, the container stops:

```
Container lifecycle:
1. docker run myapp
2. Container starts
3. Runs CMD or ENTRYPOINT command
4. Command completes/exits
5. Container stops automatically

If CMD exits in 1 second → Container runs for 1 second
If CMD runs forever → Container runs forever
```

Unlike virtual machines that boot an OS and keep running, containers are designed to run a single application process. When that process ends, there's nothing to keep the container alive.

## Common Causes and Fixes

### Running Background Services

The most common mistake is starting a service in background mode:

```dockerfile
# Wrong - starts nginx in background and exits
FROM nginx:alpine
CMD ["nginx"]
```

When you run this, nginx starts but daemonizes (runs in background), so the main process exits immediately:

```bash
docker run nginx-app
# Container exits immediately because nginx daemonized
```

Fix it by running the service in foreground mode:

```dockerfile
# Correct - nginx stays in foreground
FROM nginx:alpine
CMD ["nginx", "-g", "daemon off;"]
```

The `-g "daemon off;"` flag tells nginx not to daemonize. Now the nginx process stays attached to the container:

```bash
docker run -d nginx-app
# Container keeps running because nginx is in foreground
```

Other services have similar flags:

```dockerfile
# Apache in foreground
CMD ["apache2-foreground"]

# Redis in foreground (default behavior)
CMD ["redis-server"]

# PostgreSQL
CMD ["postgres"]

# Node.js app (naturally runs in foreground)
CMD ["node", "server.js"]
```

### Using Shell Scripts That Exit

If your CMD runs a shell script that completes quickly:

```dockerfile
FROM ubuntu:22.04
COPY setup.sh /setup.sh
RUN chmod +x /setup.sh
CMD ["/setup.sh"]
```

If `setup.sh` looks like this:

```bash
#!/bin/bash
echo "Setting up..."
export MY_VAR=value
echo "Setup complete"
# Script exits here
```

The container exits as soon as the script finishes. To keep it running, add a long-running process:

```bash
#!/bin/bash
echo "Setting up..."
export MY_VAR=value
echo "Setup complete"

# Keep container alive by running your application
exec /usr/bin/myapp
```

The `exec` command replaces the shell process with your application, making it PID 1 in the container.

### CMD vs ENTRYPOINT Confusion

Understanding the difference prevents common mistakes:

```dockerfile
# CMD can be overridden completely
FROM ubuntu:22.04
CMD ["echo", "Hello"]
```

```bash
# Uses CMD
docker run myapp
# Output: Hello

# CMD is replaced by your command
docker run myapp ls /
# Runs 'ls /' instead of 'echo Hello'
# Container exits after ls completes
```

With ENTRYPOINT:

```dockerfile
# ENTRYPOINT is not replaced, CMD becomes arguments
FROM ubuntu:22.04
ENTRYPOINT ["echo"]
CMD ["Hello"]
```

```bash
# Runs: echo Hello
docker run myapp
# Output: Hello

# Runs: echo Goodbye (CMD is replaced, ENTRYPOINT is not)
docker run myapp Goodbye
# Output: Goodbye
```

For applications that should always run, use ENTRYPOINT:

```dockerfile
# App always runs, arguments can be passed
FROM node:18
WORKDIR /app
COPY . .
ENTRYPOINT ["node", "server.js"]
CMD ["--port", "3000"]
```

### No Command Specified

If you don't specify CMD or ENTRYPOINT and the base image doesn't have one:

```dockerfile
FROM ubuntu:22.04
# No CMD or ENTRYPOINT
```

```bash
docker run myapp
# Container starts with default CMD from ubuntu image (usually /bin/bash)
# But there's no terminal attached, so bash exits immediately
```

Fix by adding a command:

```dockerfile
FROM ubuntu:22.04
CMD ["tail", "-f", "/dev/null"]
# Keeps container running by tailing nothing (useful for debugging)
```

Or run interactively:

```bash
# -i = interactive, -t = allocate pseudo-TTY
docker run -it myapp /bin/bash
# Now you have a shell and container stays running
```

### Application Errors

If your application crashes on startup, the container exits with a non-zero exit code:

```dockerfile
FROM python:3.11
WORKDIR /app
COPY app.py .
CMD ["python", "app.py"]
```

If `app.py` has an error:

```python
import missing_module  # This will fail
print("Hello")
```

```bash
docker run myapp
# Container exits immediately

docker ps -a
# STATUS: Exited (1) 2 seconds ago
# Exit code 1 indicates an error

# Check what went wrong
docker logs <container_id>
# ModuleNotFoundError: No module named 'missing_module'
```

Always check logs when a container exits unexpectedly:

```bash
# Get the container ID
docker ps -a | head -2

# View logs
docker logs <container_id>

# Or use container name
docker logs myapp
```

### Missing Files or Permissions

If your CMD references a file that doesn't exist:

```dockerfile
FROM ubuntu:22.04
CMD ["/app/start.sh"]
```

But you never copied `start.sh`:

```bash
docker run myapp
# Exits immediately

docker logs <container_id>
# /bin/sh: 1: /app/start.sh: not found
```

Or the file exists but isn't executable:

```dockerfile
FROM ubuntu:22.04
COPY start.sh /app/start.sh
# Forgot to make it executable
CMD ["/app/start.sh"]
```

Fix by setting executable permissions:

```dockerfile
FROM ubuntu:22.04
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh
CMD ["/app/start.sh"]
```

## Debugging Strategies

### Check Container Logs

```bash
# View logs of exited container
docker logs <container_id>

# Follow logs in real-time (for running container)
docker logs -f <container_id>

# Show last 50 lines
docker logs --tail 50 <container_id>

# Show timestamps
docker logs -t <container_id>
```

### Check Exit Code

The exit code tells you what happened:

```bash
docker ps -a
# STATUS column shows exit code

# Exit code meanings:
# 0   = Success (normal exit)
# 1   = Application error
# 125 = Docker daemon error
# 126 = Command cannot be executed
# 127 = Command not found
# 137 = Killed (SIGKILL)
# 143 = Terminated (SIGTERM)
```

### Inspect Container Configuration

```bash
# See the full container configuration
docker inspect <container_id>

# See just the command that was run
docker inspect --format='{{.Config.Cmd}}' <container_id>

# See the entrypoint
docker inspect --format='{{.Config.Entrypoint}}' <container_id>
```

### Override CMD to Debug

Run the container with a shell to investigate:

```bash
# Override CMD and get a shell
docker run -it myapp /bin/bash

# Now you can test commands manually
ls /app
cat /app/start.sh
/app/start.sh
# See what fails
```

### Keep Container Running for Debugging

Temporarily modify the Dockerfile:

```dockerfile
FROM ubuntu:22.04
COPY app.sh /app.sh

# Comment out the real CMD
# CMD ["/app.sh"]

# Use this while debugging
CMD ["tail", "-f", "/dev/null"]
```

Build and run:

```bash
docker build -t myapp-debug .
docker run -d --name debug myapp-debug

# Execute commands inside the running container
docker exec -it debug /bin/bash
# Now debug interactively
```

## Real-World Examples

### Web Server That Exits

```dockerfile
# Problem: Apache exits immediately
FROM ubuntu:22.04
RUN apt-get update && apt-get install -y apache2
CMD ["apache2"]
```

Fix:

```dockerfile
FROM ubuntu:22.04
RUN apt-get update && apt-get install -y apache2
# Use the foreground script
CMD ["apachectl", "-D", "FOREGROUND"]
```

### Python Application That Exits

```dockerfile
# Problem: Python script runs and exits
FROM python:3.11
COPY script.py .
CMD ["python", "script.py"]
```

If `script.py` is:

```python
print("Starting...")
# Does some work
print("Done")
# Script exits
```

Fix by making it a long-running server:

```python
from flask import Flask
app = Flask(__name__)

@app.route('/')
def hello():
    return "Hello World!"

if __name__ == '__main__':
    # This keeps running
    app.run(host='0.0.0.0', port=5000)
```

### Database Container

```dockerfile
# MySQL container - correct approach
FROM mysql:8.0
ENV MYSQL_ROOT_PASSWORD=mypassword
# No CMD needed - base image has: CMD ["mysqld"]
```

The MySQL base image already has the correct CMD that keeps mysqld running in the foreground.

### Multi-Service Container (Generally Not Recommended)

If you must run multiple services, use a process manager:

```dockerfile
FROM ubuntu:22.04
RUN apt-get update && apt-get install -y supervisor nginx redis-server

COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# supervisord runs in foreground and manages other services
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
```

`supervisord.conf`:

```ini
[supervisord]
nodaemon=true

[program:nginx]
command=/usr/sbin/nginx -g "daemon off;"
autostart=true
autorestart=true

[program:redis]
command=/usr/bin/redis-server
autostart=true
autorestart=true
```

However, it's better practice to use separate containers for each service and link them with Docker Compose.

## Quick Fixes Reference

```bash
# Container exits immediately after start
→ Check logs: docker logs <container>
→ Check exit code: docker ps -a
→ Override CMD: docker run -it myapp /bin/bash

# Service starts but container exits
→ Run service in foreground mode
→ Check service has "-g daemon off" or equivalent

# Script runs and exits
→ Add 'exec' before final command
→ Add a long-running process at the end

# Command not found error
→ Verify file exists in container
→ Check file has execute permissions
→ Use absolute path

# To keep container alive for debugging
→ Add: CMD ["tail", "-f", "/dev/null"]
→ Or: CMD ["sleep", "infinity"]
```

The key to preventing containers from exiting immediately is making sure the main process stays in the foreground and doesn't complete. Check logs first, understand what command is running, and adjust it to remain active for the container's intended lifetime.


## Related Resources

- [Difference Between RUN and CMD](/posts/difference-run-cmd-dockerfile) — understand CMD behavior
- [Docker Run vs Docker Start](/posts/docker-run-vs-docker-start) — container lifecycle
- [Start Stopped Container with Different Command](/posts/start-stopped-docker-container-different-command) — override commands
- [How to Clear Docker Container Logs](/posts/how-to-clear-docker-container-logs-properly) — check logs for clues
- [Introduction to Docker Guide](/guides/introduction-to-docker) — Docker fundamentals
