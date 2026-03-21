---
title: 'How to Prevent Data Loss When Docker Containers Exit'
excerpt: "Learn why data disappears when Docker containers stop, how to persist data with volumes and bind mounts, and best practices for managing stateful applications in containers."
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-10-15'
publishedAt: '2024-10-15T11:30:00Z'
updatedAt: '2026-03-21T09:00:00Z'
readingTime: '9 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Volumes
  - Data Persistence
  - DevOps
  - Storage
---

**TLDR:** Docker containers are ephemeral - any data written inside a container's filesystem is lost when the container is removed. To persist data, use Docker volumes (`docker volume create` and `-v` flag), bind mounts (map host directories), or named volumes in Docker Compose. Volumes persist independently of container lifecycle and are the recommended approach for databases, uploads, and any data you can't afford to lose.

When you first encounter Docker, it's shocking to lose all your data after removing a container. Here's what happens and how to prevent it.

## Why Data Disappears

Docker containers have their own isolated filesystem. When you write data inside a container, it's stored in a writable layer on top of the image:

```
Container filesystem layers:
┌─────────────────────────┐
│  Writable Container     │  ← Your data goes here
│  Layer (temporary)      │     Lost when container is removed
├─────────────────────────┤
│  Read-only Image Layers │  ← Never changes
└─────────────────────────┘
```

When you remove the container:

```bash
# Start a container and write data
docker run --name mydb postgres:15
# Database creates data in /var/lib/postgresql/data

# Stop and remove the container
docker stop mydb
docker rm mydb

# Data is gone! The writable layer is deleted
```

Even if you restart the container (without removing it), data persists:

```bash
# Create container
docker run -d --name mydb postgres:15

# Write some data (create database, tables, etc.)
docker exec -it mydb psql -U postgres -c "CREATE DATABASE myapp;"

# Stop the container
docker stop mydb

# Start it again - data is still there
docker start mydb
docker exec -it mydb psql -U postgres -c "\l"
# myapp database exists
```

But as soon as you `docker rm mydb`, the data is gone. This is by design - containers are meant to be disposable.

## Solution 1: Docker Volumes (Recommended)

Volumes are Docker-managed storage that exists independently of containers:

```bash
# Create a named volume
docker volume create postgres-data

# Use the volume when running a container
docker run -d \
  --name mydb \
  -v postgres-data:/var/lib/postgresql/data \
  postgres:15
```

Now the data lives in the volume, not the container:

```
Volume (persistent):          Container (ephemeral):
┌──────────────────┐         ┌────────────────────┐
│ postgres-data    │<─────── │ /var/lib/postgresql│
│                  │   mount │ /data              │
│ (survives rm)    │         │ (deleted on rm)    │
└──────────────────┘         └────────────────────┘
```

```bash
# Create some data
docker exec -it mydb psql -U postgres -c "CREATE DATABASE myapp;"

# Remove the container
docker stop mydb
docker rm mydb

# Create a new container using the same volume
docker run -d \
  --name mydb2 \
  -v postgres-data:/var/lib/postgresql/data \
  postgres:15

# Data is still there!
docker exec -it mydb2 psql -U postgres -c "\l"
# myapp database exists
```

### Listing Volumes

```bash
# See all volumes
docker volume ls

# Inspect a volume
docker volume inspect postgres-data

# Output shows where data is stored on host:
# "Mountpoint": "/var/lib/docker/volumes/postgres-data/_data"
```

### Removing Volumes

Volumes persist even after container removal:

```bash
# Remove container
docker rm mydb
# Volume still exists

# Remove volume manually
docker volume rm postgres-data

# Or remove all unused volumes
docker volume prune
```

## Solution 2: Bind Mounts

Bind mounts map a host directory directly into the container:

```bash
# Create a directory on the host
mkdir -p /home/user/postgres-data

# Mount it into the container
docker run -d \
  --name mydb \
  -v /home/user/postgres-data:/var/lib/postgresql/data \
  postgres:15
```

Data is stored in `/home/user/postgres-data` on your host machine:

```bash
# View data on host
ls -la /home/user/postgres-data
# base/ global/ pg_wal/ ...

# Remove container
docker rm -f mydb

# Data still exists on host
ls -la /home/user/postgres-data
# Still there!
```

### Bind Mounts vs Volumes

```
Volumes:
✓ Managed by Docker
✓ Work on all platforms
✓ Better performance on Mac/Windows
✓ Can be shared between containers easily
✓ Backup with docker commands
- Less direct access from host

Bind Mounts:
✓ Direct access to files from host
✓ Useful for development (live code editing)
✓ Full control over location
- Must exist before mounting
- Path differences across systems
- Permissions can be tricky
```

For production data like databases, use volumes. For development like mounting source code, use bind mounts.

## Real-World Examples

### PostgreSQL Database

```bash
# Create volume
docker volume create pgdata

# Run database with volume
docker run -d \
  --name postgres \
  -e POSTGRES_PASSWORD=secret \
  -v pgdata:/var/lib/postgresql/data \
  -p 5432:5432 \
  postgres:15

# Use the database (data persists)
docker exec -it postgres psql -U postgres

# Restart, remove, recreate - data survives
docker rm -f postgres
docker run -d --name postgres -e POSTGRES_PASSWORD=secret -v pgdata:/var/lib/postgresql/data postgres:15
```

### MySQL Database

```bash
# Create volume
docker volume create mysql-data

# Run MySQL
docker run -d \
  --name mysql \
  -e MYSQL_ROOT_PASSWORD=rootpass \
  -v mysql-data:/var/lib/mysql \
  -p 3306:3306 \
  mysql:8

# Data persists in mysql-data volume
```

### MongoDB

```bash
# Create volume
docker volume create mongo-data

# Run MongoDB
docker run -d \
  --name mongodb \
  -v mongo-data:/data/db \
  -p 27017:27017 \
  mongo:7
```

### Web Application with Uploads

```bash
# Create volume for uploaded files
docker volume create app-uploads

# Run application
docker run -d \
  --name webapp \
  -v app-uploads:/app/uploads \
  -p 8080:80 \
  myapp:latest

# User uploads files to /app/uploads in container
# Files are stored in app-uploads volume
# They persist even if you redeploy the app
```

## Using Docker Compose

Docker Compose makes volume management easier:

```yaml
# docker-compose.yml
version: '3.8'

services:
  db:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: secret
    volumes:
      # Named volume (recommended)
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  web:
    image: myapp:latest
    volumes:
      # Bind mount for development
      - ./src:/app/src
      # Named volume for uploads
      - uploads:/app/uploads
    ports:
      - "8080:80"
    depends_on:
      - db

# Define volumes
volumes:
  postgres-data:
  uploads:
```

Start everything:

```bash
docker-compose up -d

# Data persists across down/up cycles
docker-compose down  # Stops and removes containers
docker-compose up -d # Starts new containers, data is still there

# To remove volumes, add -v flag
docker-compose down -v  # WARNING: Deletes all data!
```

### Volume Configuration Options

```yaml
volumes:
  # Simple named volume
  postgres-data:

  # Volume with driver options
  cache-data:
    driver: local
    driver_opts:
      type: tmpfs
      device: tmpfs

  # External volume (created manually)
  shared-data:
    external: true
    name: my-existing-volume
```

## Multiple Volumes

A container can use multiple volumes:

```bash
docker run -d \
  --name app \
  -v app-data:/app/data \
  -v app-logs:/app/logs \
  -v app-config:/app/config \
  myapp:latest
```

Or in Compose:

```yaml
services:
  app:
    image: myapp:latest
    volumes:
      - app-data:/app/data
      - app-logs:/app/logs
      - app-config:/app/config

volumes:
  app-data:
  app-logs:
  app-config:
```

## Read-Only Volumes

For configuration files that shouldn't be modified:

```bash
# Mount volume as read-only
docker run -d \
  --name app \
  -v app-config:/app/config:ro \
  myapp:latest
```

The `:ro` flag makes the volume read-only inside the container.

## Backing Up Volumes

### Backup a Volume

```bash
# Create a backup
docker run --rm \
  -v postgres-data:/data \
  -v $(pwd):/backup \
  ubuntu \
  tar czf /backup/postgres-backup.tar.gz -C /data .

# This creates postgres-backup.tar.gz in current directory
```

What this does:
1. Starts a temporary container (`--rm` removes it after)
2. Mounts the volume to backup as `/data`
3. Mounts current directory as `/backup`
4. Creates a compressed archive of the volume

### Restore a Volume

```bash
# Create a new volume
docker volume create postgres-data-restored

# Restore from backup
docker run --rm \
  -v postgres-data-restored:/data \
  -v $(pwd):/backup \
  ubuntu \
  tar xzf /backup/postgres-backup.tar.gz -C /data
```

## Copying Data Between Volumes

```bash
# Copy from one volume to another
docker run --rm \
  -v old-volume:/from \
  -v new-volume:/to \
  ubuntu \
  cp -av /from/. /to/
```

## Troubleshooting

### Permission Issues

Sometimes containers can't write to volumes:

```bash
# Check permissions in the volume
docker run --rm -v myvolume:/data ubuntu ls -la /data

# Fix permissions (example for PostgreSQL)
docker run --rm \
  -v postgres-data:/data \
  ubuntu \
  chown -R 999:999 /data
# 999 is the postgres user ID in the official image
```

### Volume Not Mounting

```bash
# Verify volume exists
docker volume ls | grep myvolume

# Inspect volume
docker volume inspect myvolume

# Check container mounts
docker inspect mycontainer | grep -A 10 Mounts
```

### Accidentally Deleted Data

If you removed a volume:

```bash
# Check if volume still exists
docker volume ls

# If it's gone, it's really gone
# Restore from backup (you have backups, right?)
```

## Best Practices

**For databases:**
- Always use named volumes
- Back up regularly
- Don't use bind mounts in production

**For development:**
- Use bind mounts for source code
- Use named volumes for dependencies (node_modules, etc.)
- Document required volumes in README

**For production:**
- Use named volumes managed by Docker
- Implement regular backup strategy
- Test restore procedures
- Monitor disk usage

**Quick reference:**

```bash
# Create volume
docker volume create mydata

# Use volume
docker run -v mydata:/path/in/container image

# List volumes
docker volume ls

# Backup volume
docker run --rm -v mydata:/data -v $(pwd):/backup ubuntu tar czf /backup/backup.tar.gz -C /data .

# Remove unused volumes
docker volume prune

# Remove specific volume
docker volume rm mydata
```

The key to preventing data loss is understanding that containers are temporary but volumes are permanent. Use volumes for anything you need to keep, and back them up regularly.

## Related Resources

- [How to Add a Volume to an Existing Docker Container](/posts/how-to-add-a-volume-to-an-existing-docker-container) — add storage after creation
- [Docker Persistent Storage for Databases](/posts/docker-persistent-storage-databases) — database-specific patterns
- [How to List Docker Volumes](/posts/how-to-list-docker-volumes-in-containers) — manage volumes
- [Introduction to Docker: Volumes](/guides/introduction-to-docker) — volume fundamentals
- [Docker Security Checklist](/checklists/docker-security) — secure your data
