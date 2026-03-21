---
title: 'How to Explore a Docker Container File System'
excerpt: "Learn different ways to inspect, browse, and copy files from Docker containers, whether they're running or stopped. Essential techniques for debugging and understanding containerized applications."
category:
  name: 'Docker'
  slug: 'docker'
date: '2025-04-18'
publishedAt: '2025-04-18T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Containers
  - Debugging
  - DevOps
  - File System
---

You've got a running Docker container and you need to see what's actually inside - check configuration files, debug why an application isn't finding a file, or understand the directory structure. How do you explore the container's file system?

## TL;DR

For running containers, use `docker exec -it container_name sh` to get an interactive shell, or `docker exec container_name ls /path` to run single commands. For stopped containers, use `docker cp` to copy files out, or export the container with `docker export`. You can also inspect images directly with `docker run --rm -it image_name sh`.

Understanding how to navigate a container's file system is critical for debugging, inspecting configurations, and understanding how your containerized application works.

Let's start with the most common scenario: you have a running container and want to look around.

## Getting a Shell in a Running Container

Use `docker exec` to start an interactive shell:

```bash
# If the container has bash
docker exec -it container_name bash

# If it's a minimal image with only sh
docker exec -it container_name sh

# Using the container ID instead of name
docker exec -it a3f5c8d9e1b2 sh
```

The `-it` flags give you an interactive terminal. Once inside, you can use standard Linux commands:

```bash
# Inside the container
ls -la /
cd /app
cat config.json
find / -name "*.conf"
```

When you're done exploring, type `exit` or press `Ctrl+D` to leave the container.

## Running Single Commands Without a Shell

If you just need to check one thing, run a single command:

```bash
# List files in /app
docker exec container_name ls -la /app

# Check if a file exists
docker exec container_name test -f /etc/nginx/nginx.conf && echo "exists"

# View a configuration file
docker exec container_name cat /etc/nginx/nginx.conf

# Find all Python files
docker exec container_name find /app -name "*.py"
```

This is faster than starting a shell when you know exactly what you want to see.

## Exploring a Container That Won't Start

If your container keeps crashing or exiting, you can't use `docker exec` because it only works with running containers. Instead, start a shell as the container's entry point:

```bash
# Override the entrypoint to start a shell
docker run --rm -it --entrypoint sh image_name
```

This starts a new container from the image, but runs a shell instead of the normal application. Now you can explore the file system and figure out why the application isn't starting.

For example, if your Python application container crashes immediately:

```bash
docker run --rm -it --entrypoint sh python-app:latest

# Inside the container, investigate
ls -la /app
python app.py  # Try running manually to see the error
cat /app/logs/error.log
```

## Copying Files From a Container

To copy files from a container to your host, use `docker cp`:

```bash
# Copy a single file from the container
docker cp container_name:/app/config.json ./config.json

# Copy an entire directory
docker cp container_name:/var/log ./container-logs/

# Copy from a stopped container (works the same)
docker cp stopped_container:/app/data ./data-backup/
```

This works whether the container is running or stopped, which is incredibly useful for debugging and backups.

To copy files into a container:

```bash
# Copy a file to the container
docker cp ./updated-config.json container_name:/app/config.json

# Copy a directory to the container
docker cp ./static-files/ container_name:/app/public/
```

## Exploring Stopped Containers

For stopped containers, you can't use `docker exec`, but you can still access the file system.

Export the entire file system to a tar archive:

```bash
docker export container_name > container-filesystem.tar

# Extract and explore
tar -xf container-filesystem.tar -C extracted-container/
cd extracted-container/
ls -la
```

Now you have the full container file system on your host, and you can browse it normally.

For a quick look at specific files, use `docker cp`:

```bash
# Copy specific files from the stopped container
docker cp stopped_container:/app/crash-report.log ./
docker cp stopped_container:/var/log/application.log ./
```

## Inspecting Container Layers

Docker images are built in layers. You can see the layers with `docker history`:

```bash
# Show image layers and their sizes
docker history image_name

# More detailed output
docker history --no-trunc image_name
```

This shows what each layer added to the image, which helps you understand the file system structure.

To dive deeper, use `docker inspect`:

```bash
# Get detailed container information
docker inspect container_name

# Find the container's mount points
docker inspect container_name | grep -A 10 "Mounts"

# Find the container's file system location on the host
docker inspect -f '{{.GraphDriver.Data.MergedDir}}' container_name
```

The `MergedDir` path shows where Docker stores the container's file system on your host machine. You can explore it directly (requires root access):

```bash
# View the container's files on the host (requires root)
sudo ls -la $(docker inspect -f '{{.GraphDriver.Data.MergedDir}}' container_name)
```

## Exploring Images Before Running Them

If you want to see what's in an image before creating a container:

```bash
# Start a temporary container from the image
docker run --rm -it image_name sh

# After exploring, exit - the container is automatically removed (--rm)
```

## Finding Files and Directories in a Container

Use `find` to locate files:

```bash
# Find all configuration files
docker exec container_name find / -name "*.conf"

# Find files modified in the last 24 hours
docker exec container_name find /app -type f -mtime -1

# Find large files (over 100MB)
docker exec container_name find / -type f -size +100M

# Find files owned by a specific user
docker exec container_name find /app -user www-data
```

## Checking Disk Usage Inside a Container

See how much space is used:

```bash
# Check disk usage of directories
docker exec container_name du -sh /*

# More detailed breakdown
docker exec container_name du -h /app | sort -rh | head -20

# Check available disk space
docker exec container_name df -h
```

This helps identify what's taking up space in the container.

## Practical Example: Debugging a Failed Application

Your Node.js application container starts but immediately exits. Let's investigate:

```bash
# Try to see logs first
docker logs container_name

# If logs don't help, explore the file system
docker run --rm -it --entrypoint sh node-app:latest

# Inside the container:
# Check if the application files exist
ls -la /app

# Check if dependencies are installed
ls -la /app/node_modules

# Check for the expected entry point
cat package.json | grep main

# Try running the app manually
cd /app
node index.js
```

Now you see the actual error message and can fix it.

## Comparing Container and Image File Systems

To see what changed in a running container compared to its image:

```bash
# Show filesystem changes
docker diff container_name
```

Output shows:
- `A` = Added file
- `D` = Deleted file
- `C` = Changed file

Example output:
```
C /app
A /app/uploads/user-avatar.jpg
C /var/log
A /var/log/application.log
```

This is useful for seeing what files your application creates or modifies at runtime.

## Using Volumes to Share Files

If you frequently need to inspect files, consider mounting a volume:

```bash
# Run container with a volume mount
docker run -v /host/path:/container/path image_name

# Now you can access /container/path files directly at /host/path
ls -la /host/path
```

This is particularly useful during development when you want to see log files or configuration changes in real-time.

## Exploring Multi-Container Applications

When working with Docker Compose applications:

```bash
# List all containers in the compose project
docker compose ps

# Execute command in a specific service
docker compose exec service_name sh

# Copy files from a compose service
docker compose cp service_name:/app/logs ./logs/

# View logs from multiple services
docker compose logs -f service1 service2
```

Exploring Docker container file systems is a fundamental debugging skill. Whether you use `docker exec` for running containers, `docker cp` for extracting files, or `docker export` for complete dumps, these techniques give you full visibility into what's happening inside your containers.

## Related Resources

- [Copy Files from Docker Container to Host](/posts/copy-files-from-docker-container-to-host) — extract files
- [Docker Edit File in Container](/posts/docker-edit-file-in-container) — modify files in-place
- [How to See Docker Image Contents](/posts/docker-see-image-contents) — inspect images before running
- [Enter Docker Container with New TTY](/posts/enter-docker-container-new-tty) — interactive debugging
- [Introduction to Docker Guide](/guides/introduction-to-docker) — Docker fundamentals
