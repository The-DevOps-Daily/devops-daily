---
title: 'How to List Volumes in Docker Containers'
excerpt: "Learn multiple ways to view Docker volumes attached to containers, inspect volume mounts, find volume locations on the host, and understand volume usage across your Docker environment."
category:
  name: 'Docker'
  slug: 'docker'
date: '2025-02-28'
publishedAt: '2025-02-28T13:00:00Z'
updatedAt: '2026-03-21T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Volumes
  - DevOps
  - Storage
  - Troubleshooting
---

**TLDR:** List all Docker volumes with `docker volume ls`. To see which volumes a specific container uses, run `docker inspect <container>` and look at the "Mounts" section, or use `docker inspect -f '{{ .Mounts }}' <container>` for direct output. For running containers, `docker ps` with custom format shows volume information. Use `docker volume inspect` to see detailed volume information including the host filesystem path.

Understanding what volumes are attached to your containers is crucial for managing persistent data, debugging storage issues, and cleaning up unused resources.

## List All Volumes

To see all volumes on your system:

```bash
docker volume ls

# Output:
# DRIVER    VOLUME NAME
# local     postgres-data
# local     mysql-data
# local     mongo-data
```

This shows volume names but doesn't tell you which containers use them.

## See Volumes for a Specific Container

The most direct way is using `docker inspect`:

```bash
# Inspect a container
docker inspect mycontainer

# Look for the "Mounts" section in the JSON output
```

For cleaner output, use Go templates:

```bash
# Show only mount information
docker inspect -f '{{ .Mounts }}' mycontainer

# Output (example):
# [{volume postgres-data /var/lib/docker/volumes/postgres-data/_data /var/lib/postgresql/data local  true }]
```

### Pretty Print Mounts

For better readability:

```bash
# JSON format
docker inspect -f '{{ json .Mounts }}' mycontainer | python3 -m json.tool

# Output:
# [
#     {
#         "Type": "volume",
#         "Name": "postgres-data",
#         "Source": "/var/lib/docker/volumes/postgres-data/_data",
#         "Destination": "/var/lib/postgresql/data",
#         "Driver": "local",
#         "Mode": "",
#         "RW": true,
#         "Propagation": ""
#     }
# ]
```

Or use `jq` for formatting:

```bash
docker inspect mycontainer | jq '.[0].Mounts'
```

### Extract Specific Mount Details

Get just the volume names:

```bash
# List volume names used by a container
docker inspect -f '{{ range .Mounts }}{{ .Name }} {{ end }}' mycontainer

# Output: postgres-data
```

Get source and destination paths:

```bash
# Show mount paths
docker inspect -f '{{ range .Mounts }}{{ .Source }} -> {{ .Destination }} {{ end }}' mycontainer

# Output: /var/lib/docker/volumes/postgres-data/_data -> /var/lib/postgresql/data
```

Check if mounts are read-write or read-only:

```bash
# Show mount permissions
docker inspect -f '{{ range .Mounts }}{{ .Destination }}: RW={{ .RW }} {{ end }}' mycontainer

# Output: /var/lib/postgresql/data: RW=true
```

## List Volumes for All Running Containers

To see which containers use which volumes:

```bash
# For each running container, show name and volumes
docker ps --format "table {{.Names}}\t{{.Mounts}}"

# Output:
# NAMES         MOUNTS
# mydb          postgres-data
# webapp        uploads,app-data
# cache         redis-data
```

### Custom Format for More Details

```bash
# Show container name, ID, and volumes
docker ps --format "{{.Names}} ({{.ID}}): {{.Mounts}}"

# Output:
# mydb (a1b2c3d4e5f6): postgres-data
# webapp (f6e5d4c3b2a1): uploads,app-data
```

## Find Which Container Uses a Volume

To find out which container is using a specific volume:

```bash
# Check all containers (including stopped ones)
docker ps -a --filter volume=postgres-data

# Output shows containers using postgres-data volume
```

Or inspect the volume itself:

```bash
# Inspect a volume
docker volume inspect postgres-data

# Look for containers in "Options" or check manually:
docker ps -a | while read line; do
  docker inspect $(echo $line | awk '{print $1}') 2>/dev/null | \
  grep -q "postgres-data" && echo $line
done
```

A cleaner approach using a script:

```bash
#!/bin/bash
# find-volume-users.sh - Find which containers use a volume

VOLUME_NAME=$1

if [ -z "$VOLUME_NAME" ]; then
    echo "Usage: $0 <volume_name>"
    exit 1
fi

echo "Containers using volume: $VOLUME_NAME"
echo "========================================"

for container in $(docker ps -aq); do
    if docker inspect -f '{{ range .Mounts }}{{ .Name }}{{ end }}' $container | grep -q "$VOLUME_NAME"; then
        name=$(docker inspect -f '{{.Name}}' $container | sed 's/\///')
        state=$(docker inspect -f '{{.State.Status}}' $container)
        echo "$name ($state)"
    fi
done
```

Usage:

```bash
chmod +x find-volume-users.sh
./find-volume-users.sh postgres-data

# Output:
# Containers using volume: postgres-data
# ========================================
# mydb (running)
# old-db-backup (exited)
```

## Inspect Volume Details

Get detailed information about a volume:

```bash
docker volume inspect postgres-data

# Output:
# [
#     {
#         "CreatedAt": "2024-12-21T10:30:00Z",
#         "Driver": "local",
#         "Labels": {},
#         "Mountpoint": "/var/lib/docker/volumes/postgres-data/_data",
#         "Name": "postgres-data",
#         "Options": {},
#         "Scope": "local"
#     }
# ]
```

The "Mountpoint" shows where the volume data is stored on the host filesystem.

### Access Volume Data on Host

```bash
# Get the mount point
MOUNT_POINT=$(docker volume inspect -f '{{ .Mountpoint }}' postgres-data)

# List files in the volume (requires root on Linux)
sudo ls -la $MOUNT_POINT

# Or access via a container
docker run --rm -v postgres-data:/data ubuntu ls -la /data
```

## List Volumes with Size Information

Docker doesn't show volume sizes by default, but you can get it:

```bash
# Get volume size on host
docker system df -v

# Output shows volumes with size:
# VOLUME NAME       LINKS     SIZE
# postgres-data     1         230MB
# mysql-data        1         500MB
# mongo-data        0         0B
```

The "LINKS" column shows how many containers reference the volume.

## Filter Volumes

Find volumes matching specific criteria:

```bash
# Find dangling volumes (not used by any container)
docker volume ls -f dangling=true

# Find volumes with specific driver
docker volume ls -f driver=local

# Find volumes with specific label
docker volume ls -f label=environment=production
```

## List Volumes in Docker Compose

When using Docker Compose, check the configuration:

```bash
# Show volumes defined in compose file
docker-compose config --volumes

# List volumes created by compose
docker volume ls | grep $(docker-compose config --hash='*')
```

Or inspect a specific service:

```bash
# Show volumes for a service
docker-compose config | grep -A 10 "volumes:"
```

## Compare Container Mounts

See differences between containers:

```bash
# Compare mounts of two containers
echo "Container 1:"
docker inspect -f '{{ json .Mounts }}' container1 | python3 -m json.tool

echo -e "\nContainer 2:"
docker inspect -f '{{ json .Mounts }}' container2 | python3 -m json.tool
```

## Practical Examples

### List All Containers and Their Volumes

```bash
#!/bin/bash
# list-all-mounts.sh - Show all containers with their volumes

echo "Container Volumes Report"
echo "========================"

for container in $(docker ps -aq); do
    name=$(docker inspect -f '{{.Name}}' $container | sed 's/\///')
    state=$(docker inspect -f '{{.State.Status}}' $container)
    volumes=$(docker inspect -f '{{ range .Mounts }}{{ .Name }} {{ end }}' $container)

    if [ ! -z "$volumes" ]; then
        echo -e "\n$name ($state):"
        echo "  Volumes: $volumes"
    fi
done
```

### Find Unused Volumes

```bash
# List volumes not currently used by any container
docker volume ls -qf dangling=true

# Remove them (be careful!)
docker volume prune

# Or remove specific unused volumes
docker volume rm $(docker volume ls -qf dangling=true)
```

### Check Volume Usage by Size

```bash
# Show volumes sorted by size
docker system df -v | grep -A 100 "VOLUME NAME" | tail -n +2 | sort -k3 -h

# Find largest volumes
docker system df -v --format "table {{.Name}}\t{{.Size}}" | sort -k2 -h -r | head -10
```

### Backup Script with Volume Detection

```bash
#!/bin/bash
# backup-container-volumes.sh - Backup all volumes from a container

CONTAINER=$1
BACKUP_DIR=${2:-./backups}

if [ -z "$CONTAINER" ]; then
    echo "Usage: $0 <container_name> [backup_dir]"
    exit 1
fi

mkdir -p "$BACKUP_DIR"

# Get volume names
VOLUMES=$(docker inspect -f '{{ range .Mounts }}{{ .Name }} {{ end }}' $CONTAINER)

for vol in $VOLUMES; do
    echo "Backing up volume: $vol"
    docker run --rm \
        -v $vol:/data \
        -v $BACKUP_DIR:/backup \
        ubuntu \
        tar czf /backup/${vol}_$(date +%Y%m%d_%H%M%S).tar.gz -C /data .
    echo "Backed up to: $BACKUP_DIR/${vol}_*.tar.gz"
done
```

### Monitor Volume Growth

```bash
#!/bin/bash
# monitor-volumes.sh - Track volume size over time

LOGFILE="volume-sizes.log"

echo "$(date): Volume sizes" >> $LOGFILE
docker system df -v --format "{{.Name}}\t{{.Size}}" >> $LOGFILE
echo "" >> $LOGFILE

# Run this script periodically with cron to track growth
```

## Docker API Method

Query the Docker API directly:

```bash
# List all containers with volume information
curl --unix-socket /var/run/docker.sock \
  http://localhost/containers/json?all=1 | \
  jq '.[] | {name: .Names[0], mounts: .Mounts}'
```

## Visual Tools

For a GUI view of volumes:

```bash
# Portainer (web UI for Docker)
docker run -d -p 9000:9000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  portainer/portainer-ce

# Access at http://localhost:9000
# Navigate to Volumes section to see all volumes and their containers
```

## Quick Reference

```bash
# List all volumes
docker volume ls

# List volumes for specific container
docker inspect -f '{{ .Mounts }}' <container>

# List running containers with their volumes
docker ps --format "table {{.Names}}\t{{.Mounts}}"

# Find which containers use a volume
docker ps -a --filter volume=<volume_name>

# Get volume size
docker system df -v

# Find unused volumes
docker volume ls -qf dangling=true

# Inspect volume details
docker volume inspect <volume_name>

# Get volume host path
docker volume inspect -f '{{ .Mountpoint }}' <volume_name>
```

Understanding how to list and inspect volumes helps you manage persistent data, troubleshoot storage issues, and maintain a clean Docker environment.


## Related Resources

- [Docker Persistent Storage for Databases](/posts/docker-persistent-storage-databases) — database volumes
- [How to Add a Volume to an Existing Container](/posts/how-to-add-a-volume-to-an-existing-docker-container) — add volumes
- [Docker Data Loss When Container Exits](/posts/docker-data-loss-when-container-exits) — why volumes matter
- [Introduction to Docker: Volumes](/guides/introduction-to-docker) — volume fundamentals
