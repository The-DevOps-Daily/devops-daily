---
title: 'How to Copy Docker Images Between Hosts Without a Repository'
excerpt: 'Learn how to transfer Docker images directly between machines when a container registry is unavailable or impractical.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2025-05-04'
publishedAt: '2025-05-04T10:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Containers
  - Infrastructure
  - DevOps
---

While using container registries like Docker Hub, Harbor, or AWS ECR is the standard way to distribute Docker images, sometimes you need to transfer images directly between hosts. This might be necessary in air-gapped environments, when bandwidth is limited, or when working with sensitive images that shouldn't be pushed to external services. This guide explains several methods to copy Docker images between machines without using a registry.

## Prerequisites

Before you begin, make sure you have:

- Docker installed on both source and destination hosts
- SSH access between hosts (for some methods)
- Sufficient disk space on both machines
- Administrator/root access or appropriate Docker permissions

## Method 1: Using docker save and docker load

The most straightforward approach uses Docker's built-in `save` and `load` commands.

### Step 1: Save the image to a tar file on the source host

```bash
# Save a single image
docker save my-image:latest > my-image.tar

# Save multiple images to the same file
docker save my-image:latest my-other-image:1.0 > my-images.tar

# Optional: compress the tar file (smaller but slower)
docker save my-image:latest | gzip > my-image.tar.gz
```

The `docker save` command preserves all image layers, tags, and history.

### Step 2: Transfer the tar file to the destination host

You can use any file transfer method:

```bash
# Using scp
scp my-image.tar user@destination-host:/tmp/

# Using rsync (more efficient for large files)
rsync -avP my-image.tar user@destination-host:/tmp/
```

### Step 3: Load the image on the destination host

```bash
# Load from an uncompressed tar file
docker load < /tmp/my-image.tar

# If you compressed the file with gzip
gunzip -c /tmp/my-image.tar.gz | docker load
```

After loading, verify the image is available:

```bash
docker images
```

## Method 2: Direct Transfer via SSH Pipe

For a more efficient transfer without using intermediate storage, you can pipe the image directly through SSH:

```bash
# On the source host, pipe directly to the destination
docker save my-image:latest | ssh user@destination-host 'docker load'
```

This method:

- Avoids storing the tar file on either host
- Transfers the image in a single operation
- Requires stable SSH connectivity

For large images, you can add compression:

```bash
# With compression
docker save my-image:latest | gzip | ssh user@destination-host 'gunzip | docker load'
```

## Method 3: Using docker export and docker import

An alternative approach is to use `docker export` and `docker import`, which works with containers rather than images:

### Step 1: Create a container from the image (if not already running)

```bash
docker create --name temp-container my-image:latest
```

### Step 2: Export the container filesystem

```bash
docker export temp-container > my-container.tar
```

### Step 3: Transfer the tar file to the destination host (as in Method 1)

### Step 4: Import the container on the destination

```bash
cat my-container.tar | docker import - my-image:latest
```

**Important differences from save/load:**

- `export`/`import` flattens the image to a single layer
- Image history and layer information is lost
- Some metadata like environment variables, working directory, and exposed ports needs to be reconfigured

## Method 4: Using External Storage

For completely disconnected hosts or very large images, using external storage media might be the best option:

### Step 1: Save the image to external storage

```bash
# Save directly to an external drive
docker save my-image:latest > /mnt/usb-drive/my-image.tar

# Split large images into smaller chunks
docker save my-image:latest | split -b 4G - /mnt/usb-drive/my-image.tar.part-
```

### Step 2: Transport the external storage to the destination host

### Step 3: Load the image from external storage

```bash
# Load a standard tar file
docker load < /mnt/usb-drive/my-image.tar

# Reassemble and load split files
cat /mnt/usb-drive/my-image.tar.part-* | docker load
```

## Performance Optimization

When transferring large images, consider these optimizations:

### Check image size before transfer

```bash
docker images --format "{{.Repository}}:{{.Tag}} {{.Size}}" | grep my-image
```

### Use compression selectively

Compression makes the transfer file smaller but requires CPU time:

```bash
# For better network efficiency (smaller file)
docker save my-image:latest | gzip | ssh user@destination-host 'gunzip | docker load'

# For faster local processing (no compression)
docker save my-image:latest | ssh user@destination-host 'docker load'
```

### Remove unnecessary images first

Clean up both hosts to ensure adequate space:

```bash
docker system prune -a
```

## Practical Examples

### Example 1: Transferring a Database Image

```bash
# On source host
docker save postgres:14 | gzip > postgres.tar.gz

# Transfer the file
scp postgres.tar.gz user@db-server:/tmp/

# On destination host
gunzip -c /tmp/postgres.tar.gz | docker load
```

### Example 2: Moving a Custom Application Image

```bash
# On source host
docker save mycompany/app:v1.2.3 | ssh user@production-server 'docker load'

# Verify on destination
ssh user@production-server 'docker images mycompany/app'
```

### Example 3: Transferring Multiple Related Images

```bash
# On source host
docker save myapp:latest myapp-db:latest myapp-cache:latest > myapp-bundle.tar

# Transfer and load
rsync -avP myapp-bundle.tar user@destination:/tmp/
ssh user@destination 'docker load < /tmp/myapp-bundle.tar'
```

## Troubleshooting Common Issues

### Insufficient Disk Space

When saving large images:

```
no space left on device
```

**Solution**: Use a different partition or streaming method:

```bash
# Check available space
df -h

# Stream directly without saving to disk
docker save my-image | ssh user@destination 'docker load'
```

### Corrupted Transfers

If you get image verification errors:

```
open /var/lib/docker/.../layer.tar: no such file or directory
```

**Solution**: Ensure the transfer is complete and try again with integrity checking:

```bash
# On source, compute checksum
sha256sum my-image.tar > my-image.tar.sha256

# Transfer both files
scp my-image.tar my-image.tar.sha256 user@destination:/tmp/

# On destination, verify
cd /tmp && sha256sum -c my-image.tar.sha256
```

### Permission Issues

```
permission denied
```

**Solution**: Check permissions and use sudo when necessary:

```bash
# Ensure proper permissions
sudo chown $(whoami) my-image.tar
chmod 644 my-image.tar

# Or use sudo for the operation
sudo docker load < my-image.tar
```

## Best Practices

### Tag Images Properly Before Transfer

Ensure your images have clear tags before saving:

```bash
docker tag myimage:latest myimage:v1.2.3
docker save myimage:v1.2.3 > myimage-v1.2.3.tar
```

### Document Image Dependencies

For complex applications, document all required images:

```bash
# Create a manifest file
docker images --format "{{.Repository}}:{{.Tag}}" | grep myapp > image-manifest.txt

# Save all listed images
cat image-manifest.txt | xargs docker save > myapp-complete.tar
```

### Consider Using docker-compose for Related Images

For applications with multiple components, use docker-compose to ensure consistency:

```bash
# On source, save all images referenced in docker-compose.yml
docker-compose config --services | xargs docker-compose pull
docker-compose config --services | xargs docker-compose images --format "{{.Repository}}:{{.Tag}}" | sort -u | xargs docker save > application-bundle.tar
```

## Next Steps

Now that you know how to transfer Docker images between hosts without a registry, you might want to explore:

- Setting up a private Docker registry for more permanent solutions
- Creating image optimization strategies to reduce transfer sizes
- Automating image transfers using scripts or CI/CD pipelines
- Implementing proper image versioning and tagging strategies

Happy containerizing!

## Related Resources

- [Delete All Local Docker Images](/posts/delete-all-local-docker-images) — clean up images after transfers
- [Docker Image Optimization](/posts/docker-image-optimization-best-practices) — reduce image sizes for faster transfers
- [Introduction to Docker: Working with Images](/guides/introduction-to-docker) — image management fundamentals
- [Docker Flashcards](/flashcards/docker-essentials) — review core Docker concepts
