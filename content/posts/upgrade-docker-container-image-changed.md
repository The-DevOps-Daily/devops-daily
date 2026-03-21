---
title: 'How to Upgrade a Docker Container After Its Image Changed'
excerpt: 'Learn how to upgrade a Docker container to use a new version of its image without downtime.'
category:
  name: 'Docker'
  slug: 'docker'
date: '2024-12-20'
publishedAt: '2024-12-20T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '7 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Docker
  - Containers
  - Upgrades
  - DevOps
  - Tutorials
---

## TLDR

To upgrade a Docker container after its image has changed, pull the updated image, stop the running container, and recreate it using the new image. Use `docker-compose` or orchestration tools like Kubernetes for seamless upgrades.

---

When working with Docker containers, you may need to upgrade a container to use a new version of its image. This guide will show you how to upgrade a Docker container after its image has changed, ensuring minimal downtime and smooth transitions.

## Step 0: Use a volume for Persistent Data

Before upgrading a container, make sure that any persistent data is stored in a Docker volume or bind mount. This ensures that your data remains intact during the upgrade process. If you haven't set up a volume yet, you can do so with the following command:

```bash
docker volume create <volume-name>
```

Then, when you run your container, use the `-v` flag to mount the volume:

```bash
docker run -d --name <container-name> -v <volume-name>:/data <image-name>:<tag>
```

Note that if you don't use a volume, any data stored in the container's filesystem will be lost when you remove the container.

## Step 1: Pull the Updated Image

Start by pulling the updated version of the image from the registry:

```bash
docker pull <image-name>:<new-tag>
```

Replace `<image-name>` and `<new-tag>` with the name and tag of the updated image. For example:

```bash
docker pull nginx:1.21
```

This command downloads the new version of the image to your local system.

## Step 2: Stop the Running Container

Stop the container that is using the old image:

```bash
docker stop <container-name>
```

Replace `<container-name>` with the name or ID of the container. For example:

```bash
docker stop my-nginx
```

## Step 3: Remove the Old Container

Remove the stopped container to free up the name for the new container:

```bash
docker rm <container-name>
```

For example:

```bash
docker rm my-nginx
```

## Step 4: Create a New Container with the Updated Image

Start a new container using the updated image:

```bash
docker run -d --name <container-name> <image-name>:<new-tag>
```

For example:

```bash
docker run -d --name my-nginx nginx:1.21
```

This creates a new container with the updated image.

## Step 5: Verify the Upgrade

Check that the new container is running and using the updated image:

```bash
docker ps
```

You should see the new container in the list.

## Using Docker Compose for Upgrades

If you are using Docker Compose, upgrading a container is even easier. Update the image tag in the `docker-compose.yml` file:

```yaml
version: '3.8'
services:
  web:
    image: nginx:1.21
    ports:
      - '8080:80'
```

Then run the following command to recreate the container:

```bash
docker-compose up -d
```

Docker Compose will pull the updated image and recreate the container.

## Additional Tips

- **Automate Upgrades**: Use CI/CD pipelines to automate image updates and container upgrades.
- **Minimize Downtime**: Use rolling updates or load balancers to minimize downtime during upgrades.
- **Monitor Logs**: Check container logs to ensure the new container is running correctly:

  ```bash
  docker logs <container-name>
  ```

By following these steps, you can efficiently upgrade Docker containers to use new images while maintaining stability and minimizing downtime.


## Related Resources

- [Docker Compose: Always Recreate Containers](/posts/docker-compose-always-recreate-containers) — force updates
- [Rebuild Docker Container in Compose](/posts/rebuild-docker-container-compose) — Compose rebuild
- [Docker Data Loss When Container Exits](/posts/docker-data-loss-when-container-exits) — preserve data during upgrades
- [Introduction to Docker Guide](/guides/introduction-to-docker) — Docker fundamentals
