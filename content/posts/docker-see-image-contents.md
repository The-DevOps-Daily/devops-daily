---
title: 'How to See Docker Image Contents'
excerpt: 'Explore the contents of a Docker image using practical commands. Learn how to inspect layers, browse files, and debug images locally.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-02-19'
publishedAt: '2024-02-19T09:00:00Z'
updatedAt: '2026-03-21T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Images
  - Debugging
  - DevOps
---

## TLDR

To see what's inside a Docker image, use `docker run` with an interactive shell, or inspect layers with `docker history` and `docker image inspect`. This helps you debug, verify, or explore images before running them.

## Prerequisites

- Docker installed
- Terminal access

## Start a Shell Inside the Image

The most direct way to explore an image is to start a container with an interactive shell. This lets you browse files and directories as if you were inside a running system.

```bash
# Start a shell in the image (replace with your image name)
docker run --rm -it nginx:alpine sh
```

Now you can use commands like `ls`, `cat`, or `find` to look around. This is great for checking configuration files or installed binaries.

## Inspect Image Layers and Metadata

You can see the history of how an image was built and its metadata using these commands:

```bash
# Show the image build history
docker history nginx:alpine

# Inspect detailed metadata
docker image inspect nginx:alpine
```

This gives you insight into each layer and the commands used to build the image.

## Extract Files Without Running a Container

If you want to extract files from an image without running it, you can use a temporary container and the `docker cp` command:

```bash
# Create a stopped container from the image
container_id=$(docker create nginx:alpine)

# Copy a file or directory from the container
docker cp $container_id:/etc/nginx/nginx.conf ./nginx.conf

# Remove the temporary container
docker rm $container_id
```

This is handy for debugging or retrieving configuration files.

## Next Steps

Try exploring different images, or automate these checks in your CI pipeline to catch issues early.

Good luck with your project!

## Related Resources

- [Exploring Docker Container File System](/posts/exploring-docker-container-file-system) — browse container files
- [Docker Image vs Container](/posts/docker-image-vs-container) — understand the difference
- [Docker Image Optimization](/posts/docker-image-optimization-best-practices) — build smaller images
- [Introduction to Docker: Working with Images](/guides/introduction-to-docker) — image management
