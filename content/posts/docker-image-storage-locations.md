---
title: 'Where Docker Images Are Stored on Your Host Machine'
excerpt: "Discover where Docker stores images, containers, and volumes on different operating systems, and learn how to manage Docker's storage footprint effectively."
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-11-20'
publishedAt: '2024-11-20T14:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Storage
  - File System
  - Images
  - System Administration
  - Troubleshooting
---

Docker images might seem like they exist in some abstract digital space, but they're actually stored as regular files on your host machine's filesystem. Understanding where Docker keeps these files helps you troubleshoot storage issues, perform maintenance, and better understand how Docker works under the hood.

The location varies significantly between operating systems, and Docker uses different storage drivers that affect how images are organized and stored. This knowledge becomes particularly valuable when you're dealing with disk space issues or need to migrate Docker data between systems.

## Docker Storage on Linux Systems

On Linux, Docker stores all its data in `/var/lib/docker` by default. This directory contains everything Docker needs to operate, including images, containers, volumes, and networks.

```bash
# Explore Docker's main directory
sudo ls -la /var/lib/docker/

# Typical output shows these subdirectories:
# drwx--x--x buildkit/     - Build cache and temporary files
# drwx--x--x containers/   - Container-specific data and logs
# drwx--x--x image/        - Image metadata and manifests
# drwx--x--x network/      - Network configuration
# drwx--x--x overlay2/     - Image layers (most storage drivers)
# drwx--x--x plugins/      - Plugin data
# drwx--x--x runtimes/     - Runtime configurations
# drwx--x--x swarm/        - Docker Swarm data
# drwx--x--x tmp/          - Temporary files
# drwx--x--x volumes/      - Named volumes
```

The `overlay2` directory is where most of your storage is consumed. Docker uses the OverlayFS storage driver by default on modern Linux systems, which stores image layers as separate directories that get combined when containers run.

You can check your current storage driver and get detailed information about disk usage:

```bash
# Check storage driver and Docker system info
docker system info | grep -A 10 "Storage Driver"

# Get detailed disk usage breakdown
docker system df -v
```

Each image layer is stored as a separate directory in `/var/lib/docker/overlay2/`. When you run a container, Docker creates a new writable layer on top of the read-only image layers, allowing multiple containers to share the same base image efficiently.

## Docker Desktop on macOS Storage

Docker Desktop on macOS runs inside a lightweight Linux virtual machine, which means the actual storage location is different from what you might expect. The Docker data doesn't live directly in your macOS filesystem but inside a VM disk image.

```bash
# Docker Desktop stores its VM disk image here:
~/Library/Containers/com.docker.docker/Data/vms/0/data/Docker.raw

# Check the size of Docker's storage
ls -lh ~/Library/Containers/com.docker.docker/Data/vms/0/data/
```

The `Docker.raw` file is a sparse file that can grow quite large. Even though it might show as 64GB in size, it only uses as much disk space as needed for your actual Docker data.

You can access the Linux filesystem inside the Docker Desktop VM:

```bash
# Access the Docker Desktop VM's filesystem
docker run -it --privileged --pid=host debian nsenter -t 1 -m -u -n -i sh

# From inside the VM, you can explore /var/lib/docker
ls -la /var/lib/docker/
```

This technique lets you see the actual Linux directory structure where Docker stores images and containers, even on macOS.

## Windows Docker Storage Locations

Docker on Windows has two different modes: Windows containers and Linux containers. The storage location depends on which mode you're using and whether you're running Docker Desktop or Docker Engine directly.

For Docker Desktop running Linux containers on Windows:

```powershell
# Docker Desktop stores data in your user profile
# Navigate to this location in PowerShell or File Explorer
cd $env:LOCALAPPDATA\Docker\wsl\data\ext4.vhdx

# The actual Docker data is inside a WSL2 virtual machine
# Access it through WSL2
wsl -d docker-desktop
ls -la /var/lib/docker/
```

For Windows containers (when using Windows Server or Docker Desktop in Windows mode):

```powershell
# Windows containers store data in:
C:\ProgramData\Docker\

# Image layers are in:
C:\ProgramData\Docker\windowsfilter\
```

Windows containers use a different layering system than Linux containers, storing layers as separate directories that get combined using Windows filesystem features.

## Storage Drivers and Their Impact

Docker supports multiple storage drivers, each with different characteristics that affect where and how images are stored. The choice of storage driver impacts performance, features available, and the directory structure.

```bash
# Check your current storage driver
docker info | grep "Storage Driver"

# Common storage drivers and their characteristics:
# overlay2: Default on modern Linux, stores layers in overlay2/
# aufs: Older systems, stores layers in aufs/
# devicemapper: Red Hat systems, uses device-mapper/
# btrfs: Btrfs filesystems, uses btrfs/
# zfs: ZFS filesystems, uses zfs/
```

The overlay2 driver creates this directory structure:

```
/var/lib/docker/overlay2/
├── 3f4c4d7b8e9a1c2d3e4f5g6h7i8j9k0l/  # Layer directory
│   ├── diff/                           # Layer contents
│   ├── link                           # Short identifier
│   ├── lower                          # Parent layers
│   └── work/                          # OverlayFS working directory
├── l/                                 # Symlinks to layers
│   ├── ABCDEF -> ../3f4c4d7b8e9a1c2d3e4f5g6h7i8j9k0l/diff
│   └── GHIJKL -> ../another-layer/diff
└── backingFsBlockDev                  # Filesystem info
```

This structure allows Docker to efficiently share layers between images and containers while maintaining isolation.

## Managing Docker Storage Space

As you work with Docker, images and containers can consume significant disk space. Docker provides several commands to help you understand and manage storage usage.

```bash
# Get an overview of Docker disk usage
docker system df

# Get detailed information including unused images and containers
docker system df -v

# Remove unused images, containers, networks, and build cache
docker system prune

# Remove everything including unused volumes (be careful!)
docker system prune -a --volumes
```

You can also target specific types of objects for cleanup:

```bash
# Remove only unused images
docker image prune

# Remove unused images older than 24 hours
docker image prune -a --filter "until=24h"

# Remove stopped containers
docker container prune

# Remove unused volumes
docker volume prune

# Remove unused networks
docker network prune
```

For more granular control, you can identify large images and containers:

```bash
# List images sorted by size
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | sort -k3 -h

# Find large containers (including stopped ones)
docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Size}}"
```

## Changing Docker's Storage Location

Sometimes you need to move Docker's storage to a different location, perhaps to a larger disk or faster storage. The process varies by operating system.

On Linux, you can change the Docker root directory:

```bash
# Stop Docker service
sudo systemctl stop docker

# Edit Docker daemon configuration
sudo nano /etc/docker/daemon.json

# Add or modify the data-root setting:
{
  "data-root": "/new/docker/location"
}

# Move existing data (optional)
sudo rsync -aP /var/lib/docker/ /new/docker/location/

# Start Docker service
sudo systemctl start docker
```

For Docker Desktop on macOS and Windows, you can change the storage location through the Docker Desktop settings interface, but this typically involves recreating the entire VM.

## Backup and Migration Strategies

Understanding Docker's storage locations enables effective backup and migration strategies. You can backup the entire Docker directory to preserve all images, containers, and volumes.

```bash
# Create a complete backup of Docker data (Linux)
sudo tar -czf docker-backup.tar.gz -C /var/lib docker/

# Restore from backup
sudo systemctl stop docker
sudo rm -rf /var/lib/docker
sudo tar -xzf docker-backup.tar.gz -C /var/lib/
sudo systemctl start docker
```

For more selective backups, you might export specific images or create volume backups:

```bash
# Export specific images
docker save nginx:latest redis:alpine > images-backup.tar

# Import images on another system
docker load < images-backup.tar

# Backup specific volumes
docker run --rm -v important_data:/data -v $(pwd):/backup ubuntu tar czf /backup/volume-backup.tar.gz -C /data .
```

## Monitoring Storage Health

Regular monitoring of Docker's storage usage helps prevent disk space issues and performance problems. You can create simple scripts to track storage growth over time.

```bash
#!/bin/bash
# docker-storage-monitor.sh
echo "Docker Storage Report - $(date)"
echo "=================================="
echo

echo "Overall Docker Disk Usage:"
docker system df
echo

echo "Top 10 Largest Images:"
docker images --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}" | head -11
echo

echo "Storage Driver Information:"
docker info | grep -A 5 "Storage Driver"
```

Set up this script to run periodically and you'll have better visibility into your Docker storage patterns.

Now you have a thorough understanding of where Docker stores its data and how to manage that storage effectively. This knowledge will help you troubleshoot issues, optimize performance, and maintain your Docker environment as it grows.

## Related Resources

- [Docker No Space Left: How to Clean Up](/posts/docker-no-space-left-cleanup) — reclaim disk space
- [Delete All Local Docker Images](/posts/delete-all-local-docker-images) — bulk cleanup
- [Docker Image vs Container](/posts/docker-image-vs-container) — understand the fundamentals
- [Introduction to Docker Guide](/guides/introduction-to-docker) — learn Docker from scratch
